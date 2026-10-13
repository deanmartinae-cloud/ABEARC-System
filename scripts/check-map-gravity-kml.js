// Optional real-terrain regression: node scripts/check-map-gravity-kml.js input.kml [output.kml]
// Requires the installed NAMRIA DTM, or NAMRIA_DTM_PATH pointing to that raster.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const [input, output] = process.argv.slice(2);
assert.ok(input, 'Provide the distance KML path.');
const coordinates = fs.readFileSync(input, 'utf8').match(/<LineString\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/)?.[1];
assert.ok(coordinates, 'KML must contain a LineString.');
const points = coordinates.trim().split(/\s+/).map(point => point.split(',').slice(0, 2).map(Number));
assert.ok(points.length >= 2 && points.every(point => point.length === 2 && point.every(Number.isFinite)));
const backend = read('src/backend/controllers/14-map-media.controller.js');
const map = read('src/frontend/scripts/12-abearc-map.js');
const runner = new Function('fs', 'MAP_NAMRIA_DTM_PATH', 'points', `
  ${backend.slice(backend.indexOf('const mapElevationSources'), backend.indexOf('const __routeController303'))}
  const window = {}, document = {}, API = '/api', authToken = 'test';
  let abearcMapMeasurePoints = points, abearcMapMeasureMode = 'distance', abearcMapImportedPolygons = [];
  let abearcMapElevationSource = 'namria-dtm5-prs92';
  const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = abearcMapElevationSource;
  const ABEARC_MAP_ELEVATION_SOURCES = new Set([abearcMapElevationSource]);
  const ABEARC_MAP_ELEVATION_RESOLUTION_M = {'namria-dtm5-prs92':5};
  function haversineMetres(a,b) {
    const r=Math.PI/180;
    const h=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;
    return 12742000*Math.asin(Math.sqrt(h));
  }
  async function fetch(url, options) {
    const body=JSON.parse(options.body);
    if (body.source !== 'namria-dtm5-prs92') throw new Error('Unexpected terrain source');
    const data=url.endsWith('/gravity-path')
      ? await mapGravityNamriaNativePath({start:body.start,end:body.end,corridorM:body.corridor_m,signal:options.signal})
      : {elevations:await mapElevationNamria(body.locations,options.signal),source_key:body.source,source:'NAMRIA DTM 5 m (PRS92)'};
    return {ok:true,json:async()=>data};
  }
  ${map.slice(map.indexOf('    async function requestAbearcElevations('), map.indexOf('    async function loadAbearcElevationProfile('))}
  ${read('src/frontend/scripts/19-map-gravity-path.js')}
  return {run:()=>abearcGravitySearch('namria-dtm5-prs92'),stats:abearcGravityPathStats,validate:abearcGravityValidateFinalRoute};
`)(fs, process.env.NAMRIA_DTM_PATH || path.join(root, 'data/namria/DTM_5m.tif'), points);

(async () => {
  const result = await runner.run();
  assert.ok(result.indexes?.length >= 2, 'No gravity route found for this KML on NAMRIA.');
  const validation = result.finalTerrainValidation || await runner.validate(result);
  assert.equal(validation.valid, true);
  const stats = runner.stats(result.plan, result.elevations, result.indexes);
  assert.deepEqual(stats.points[0], points[0]);
  assert.deepEqual(stats.points.at(-1), points.at(-1));
  assert.ok(validation.maximumStepAscentM <= 0.10);
  if (output) {
    fs.writeFileSync(output, '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Gravity flow path - NAMRIA</name>' +
      '<Placemark><name>Validated gravity flow path</name><Style><LineStyle><color>ffff8800</color><width>4</width></LineStyle></Style>' +
      '<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>' +
      stats.points.map(point => point.join(',') + ',0').join(' ') + '</coordinates></LineString></Placemark></Document></kml>\n');
  }
  console.log(JSON.stringify({source:result.sourceKey,strategy:result.strategy,vertices:stats.points.length,
    distanceM:stats.routeDistanceM,dropM:stats.totalDropM,samples:validation.sampleCount,
    maximumSampledAscentM:validation.maximumStepAscentM,uniformSlope:result.uniformSlope}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
