const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'src/frontend/scripts/19-map-gravity-path.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'src/backend/controllers/14-map-media.controller.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'src/frontend/scripts/map-gravity-worker.js'), 'utf8');
const haversineMetres = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742017.6 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const context = vm.createContext({ assert, console, setTimeout, clearTimeout, window: {}, document: {}, haversineMetres,
  ABEARC_MAP_ELEVATION_RESOLUTION_M: { 'namria-dtm5-prs92': 5 } });
vm.runInContext(frontend + backend.slice(backend.indexOf('const mapGravityHeap = class'), backend.indexOf('const mapGravityNamriaNativePath = async')), context);
vm.runInContext(`
abearcGravitySetRoutingMode('minimum-ascent');
const stats = abearcGravityAscentStats([100, 99, 99.08, 99.16, 99.24, 98]);
assert.equal(stats.firstAscentIndex, -1);
assert.ok(Math.abs(stats.maximumContinuousClimbM - .24) < 1e-9, 'small steps must not hide a continuous climb');
assert.ok(Math.abs(stats.totalAscentM - .24) < 1e-9);
abearcGravitySetRoutingMode('downhill-only');
assert.ok(abearcGravityAscentStats([100, 99, 99.0005, 98]).firstAscentIndex >= 0);
assert.equal(abearcGravityIsNonAscending([100, 99, 99.0005, 98]), false);
for (const Heap of [mapGravityHeap, AbearcGravityMinHeap]) {
  const heap = new Heap();
  heap.push(10, 1, .05); heap.push(20, 2, 0); heap.push(5, 3, 0);
  assert.deepEqual([heap.pop().node, heap.pop().node, heap.pop().node], [3, 2, 1]);
}
const width = 7, height = 5;
const elevations = new Float64Array([
  100,99,98,97,96,95,95,
  100,100,100,100,100,100,95,
  100,99,99.05,98,97,96,95,
  100,100,100,100,100,100,95,
  100,100,100,100,100,100,95
]);
const reachableMask = new Uint8Array(width * height).fill(1);
const result = mapGravityFindMaskedAStarPath({ elevations, width, height, reachableMask,
  startIndex:14, endIndex:20, pixelWidthM:5, pixelHeightM:5, ascentToleranceM:.10 });
assert.ok(result.path?.length, 'a longer descending bypass must be found');
assert.ok(result.totalRawAscentM < 1e-6, 'ascent must take priority over route length');
const plan = { rows:height, columns:width, halfRows:2, startIndex:14, endIndex:20,
  alongStepM:5, crossStepM:5, spacingM:5,
  local:Array.from(elevations, (_, i) => ({ x:(i % width)*5, y:(Math.floor(i/width)-2)*5 })) };
const route = abearcGravityFindPathOnGrid(plan, Array.from(elevations), .10);
assert.ok(route?.length);
assert.ok(abearcGravityAscentStats(route.map(i => elevations[i])).totalAscentM < 1e-6);
// Strict mode checks the complete climb, including repeated sub-epsilon steps.
const values = [100, 99, 99.0000006, 99.0000012, 98];
requestAbearcElevations = async locations => ({ elevations:locations.map((_, i) => values[i]), sourceKey:'namria-dtm5-prs92' });
abearcGravityDensifyRouteLocations = () => values.map((_, i) => ({longitude:i, latitude:0}));
updateAbearcGravityProgress = () => {};
globalThis.testValidation = abearcGravityValidateFinalRoute({plan:{spacingM:5},indexes:[0,1],sourceKey:'namria-dtm5-prs92'});
`, context);

async function main() {
  assert.equal((await context.testValidation).valid, false, 'repeated tiny rises must not pass downhill-only validation');
  let posted, mode;
  const self = { location:{ search:'' }, postMessage: data => { posted = data; } };
  const workerContext = vm.createContext({ self, importScripts: () => {},
    abearcMapGravityPathRequestId:0,
    abearcGravityRunSearch: async (...args) => {
      mode = args[6];
      return {plan:{locations:[{longitude:1,latitude:1},{longitude:2,latitude:2}]}, elevations:[100,99],indexes:[0,1],
        finalTerrainValidation:{valid:true,totalAscentM:0,maximumContinuousClimbM:0,locations:[1,2],elevations:[100,99]}};
    } });
  vm.runInContext(worker, workerContext);
  await self.onmessage({data:{type:'start',resolutions:{'namria-dtm5-prs92':5},sourceKey:'namria-dtm5-prs92',routingMode:'downhill-only'}});
  assert.equal(mode, 'downhill-only');
  assert.equal(posted.type, 'result');
  assert.equal(posted.result.finalTerrainValidation.valid, true, 'worker must retain the validation needed by Apply');
  assert.equal(posted.result.finalTerrainValidation.totalAscentM, 0);
  assert.equal(posted.result.finalTerrainValidation.locations, undefined, 'large terrain arrays stay in the worker');
  console.log('Ascent routing passed: ascent-first choices, continuous climbs, strict mode and worker validation.');
  if (process.argv[2] !== '--namria-kml') return;
  const folder = process.argv[3];
  const terrainSource = backend.slice(backend.indexOf('const mapElevationSources ='), backend.indexOf('const mapGravityRemoteSampledPath =')).replaceAll("import('geotiff')", 'loadGeoTiff()');
  const terrainContext = new Function('fs', 'process', 'MAP_NAMRIA_DTM_PATH', 'loadGeoTiff', terrainSource
    + ';return {sample:mapElevationNamria,route:mapGravityNamriaNativePath};')(fs, process, '', () => import('geotiff'));
  const distanceTerrain = new Function('fs', 'process', 'MAP_NAMRIA_DTM_PATH', 'loadGeoTiff', terrainSource
    .replace('const nextAscent = ascents[current] + segmentAscent;', 'const nextAscent = 0;')
    + ';return {sample:mapElevationNamria,route:mapGravityNamriaNativePath};')(fs, process, '', () => import('geotiff'));
  const makeRouter = (terrain, distanceOnly = false) => new Function('haversineMetres', 'terrain', `
    const window = {}, document = {}, API = '', authToken = 'local-test';
    const ABEARC_MAP_ELEVATION_SOURCES = new Set(['namria-dtm5-prs92']);
    const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = 'namria-dtm5-prs92';
    const ABEARC_MAP_ELEVATION_RESOLUTION_M = {'namria-dtm5-prs92':5};
    const requestAbearcElevations = async (locations, signal) => ({elevations:await terrain.sample(locations, signal),sourceKey:'namria-dtm5-prs92'});
    const fetch = async (_, options) => {
      const body = JSON.parse(options.body);
      const result = await terrain.route({start:body.start,end:body.end,corridorM:body.corridor_m,routingMode:body.routing_mode,signal:options.signal});
      return {ok:true,json:async()=>result};
    };
    ${distanceOnly ? frontend.replace('const nextAscent = ascents[current] + segmentAscent;', 'const nextAscent = 0;') : frontend}
    updateAbearcGravityProgress = () => {};
    return (start, end, mode) => abearcGravityRunSearch(start, end, null, 0, 'namria-dtm5-prs92', true, mode);
  `)(haversineMetres, terrain);
  const router = makeRouter(terrainContext), distanceRouter = makeRouter(distanceTerrain, true);
  const readKml = number => fs.readFileSync(path.join(folder, `ABEARC-distance-measurement-2026-10-06 (${number}).kml`), 'utf8')
    .match(/<coordinates>([\s\S]*?)<\/coordinates>/)[1].trim().split(/\s+/).map(s => s.split(',').slice(0,2).map(Number));
  const profile = async points => {
    const locations = [points[0]];
    for (let i=1;i<points.length;i++) {
      const n = Math.max(1, Math.ceil(haversineMetres(points[i-1],points[i])/1.25));
      for (let j=1;j<=n;j++) locations.push(points[i-1].map((v,k)=>v+(points[i][k]-v)*j/n));
    }
    const elevations = await terrainContext.sample(locations.map(p=>({longitude:p[0],latitude:p[1]})));
    context.benchmarkElevations = elevations;
    return vm.runInContext('abearcGravityAscentStats(benchmarkElevations, .10)', context);
  };
  for (const [ends, previous] of [[3,5],[6,7]]) {
    const points = readKml(ends);
    console.log(JSON.stringify({pair:ends, previous, profile:await profile(readKml(previous))}));
    for (const routingMode of ['distance-baseline','minimum-ascent','downhill-only']) {
      const begin = performance.now();
      const result = await (routingMode === 'distance-baseline' ? distanceRouter : router)(points[0], points.at(-1), routingMode);
      const validation = result.finalTerrainValidation;
      console.log(JSON.stringify({pair:ends,routingMode,milliseconds:Math.round(performance.now()-begin),found:!!result.indexes?.length,
        strategy:result.strategy,profile:validation ? {valid:validation.valid,totalAscentM:validation.totalAscentM,
          maximumContinuousClimbM:validation.maximumContinuousClimbM,maximumStepAscentM:validation.maximumStepAscentM} : undefined}));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
