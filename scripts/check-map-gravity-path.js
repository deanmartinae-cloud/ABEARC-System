const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const gravity = fs.readFileSync(path.join(root, 'src/frontend/scripts/19-map-gravity-path.js'), 'utf8');
const map = fs.readFileSync(path.join(root, 'src/frontend/scripts/12-abearc-map.js'), 'utf8');
const multi = fs.readFileSync(path.join(root, 'src/frontend/scripts/18-map-multi-measure.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/frontend/pages/map.page.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/frontend/script-manifest.json'), 'utf8'));
const head = fs.readFileSync(path.join(root, 'src/frontend/layout/head.html'), 'utf8');
const gravityCss = fs.readFileSync(path.join(root, 'src/frontend/styles/map-gravity-path.css'), 'utf8');
new vm.Script(fs.readFileSync(path.join(root, 'src/frontend/scripts/map-gravity-worker.js'), 'utf8'));

assert.ok(manifest.includes('src/frontend/scripts/19-map-gravity-path.js'), 'gravity path script must be in frontend manifest');
assert.match(page, /data-map-measure-gravity/);
assert.match(page, /findAbearcGravityFlowPath\(\)/);
assert.match(map, /isAbearcGravityPathActive/);
assert.match(multi, /gravityPath: window\.captureAbearcGravityPathState/);
assert.match(multi, /restoreAbearcGravityPathState/);
assert.match(head, /map-gravity-path\.css/);
assert.match(gravityCss, /abearc-gravity-progress-track/);
assert.match(gravity, /data-gravity-progress/);
assert.match(gravity, /abearcGravitySearchHierarchical/);
assert.match(gravity, /Reverse-reachability search/);
assert.match(gravity, /primitive-angle connections/);
assert.match(gravity, /abearcGravityElevationCache/);
assert.match(gravity, /Testing direct gravity alignment/);
assert.match(gravity, /Refining promising route/);
assert.match(gravity, /Searching for any descending route/);
assert.match(gravity, /steep drops are allowed/);
assert.match(gravity, /Automatically widening the search corridor/);
assert.match(gravity, /Do not chord-simplify contour-guided routes/);
assert.match(gravity, /Verifying final gravity path against terrain/);
assert.match(gravity, /Rejected native contour-guided route because its final terrain profile contains ascent/);
assert.match(gravity, /Gravity Flow Path uses the local NAMRIA terrain model only/);
assert.match(gravity, /Find Gravity Path/);
assert.match(gravity, /ABEARC_GRAVITY_SOURCE_KEY = 'namria-dtm5-prs92'/);
assert.match(gravity, /Source lock:/);
assert.match(gravity, /requestAbearcElevations\(batchLocations, signal, effectiveSourceKey, false\)/, 'gravity terrain requests must not silently fall back to another DEM');
assert.doesNotMatch(gravity, /Try Another Source/);
assert.match(map, /abearcActiveGravityProfileSource/);
assert.match(map, /!gravityLockedSource/, 'ordinary elevation profiles may fall back, but active gravity-path profiles must stay source-locked');
assert.match(map, /Gravity Flow Path uses NAMRIA DTM 5 m \(PRS92\) only/);
assert.doesNotMatch(gravity, /await abearcGravityCrossSourceContourRescue\(/, 'source-locked gravity routing must not use cross-source contour fallback');
assert.doesNotMatch(gravity, /toggleLoad\?\.\(true\)/);

const context = {
  assert,
  console,
  window: {},
  document: {},
  Date,
  Math,
  Number,
  String,
  Array,
  Set,
  Map,
  Float64Array,
  Int32Array,
  Uint8Array,
};
vm.createContext(context);
vm.runInContext(`
let abearcMapMeasurePoints = [];
let abearcMapMeasureMode = 'distance';
let abearcMapImportedPolygons = [];
let abearcMapElevationSource = 'namria-dtm5-prs92';
const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = 'namria-dtm5-prs92';
const ABEARC_MAP_ELEVATION_SOURCES = new Set(['namria-dtm5-prs92']);
const ABEARC_MAP_ELEVATION_RESOLUTION_M = {'namria-dtm5-prs92': 5};
const haversineMetres = () => 100;
const esc = value => String(value);
const formatAbearcDistance = value => value + ' m';
const toast = () => {};
const toggleLoad = () => {};
const closeAbearcMapMeasureContextMenu = () => {};
${gravity}

const rows = 3, columns = 5;
const local = [];
const locations = [];
for (let r=0;r<rows;r++) for (let c=0;c<columns;c++) {
  local.push({x:c*10,y:(r-1)*10});
  locations.push({longitude:c,latitude:r});
}
const plan = {
  rows, columns, halfRows:1, startIndex:5, endIndex:9,
  straightDistanceM:40, corridorM:10, alongStepM:10, crossStepM:10,
  local, locations
};
// The center row contains a forced ascent (95 -> 99), while the upper row
// provides a continuous descending bypass from the fixed start to fixed end.
const elevations = [99,94,90,85,79, 100,95,99,85,80, 99,96,91,86,79];
const route = abearcGravityFindPathOnGrid(plan, elevations, 0.05);
assert.ok(Array.isArray(route) && route.length >= 2, 'a descending bypass should be found');
assert.equal(route[0], plan.startIndex);
assert.equal(route.at(-1), plan.endIndex);
for (let i=1;i<route.length;i++) {
  assert.ok(elevations[route[i]] <= elevations[route[i-1]] + 0.05, 'every routed DEM step must be non-ascending');
}
const impossible = elevations.slice();
impossible[plan.endIndex] = 101;
assert.equal(abearcGravityFindPathOnGrid(plan, impossible, 0.05), null, 'an endpoint above the start must not produce a gravity path');
assert.equal(abearcGravityIsNonAscending([100,99,99,98], 0.05), true, 'direct downhill sequences should pass the fast feasibility test');
assert.equal(abearcGravityIsNonAscending([100,99,99.2,98], 0.05), false, 'the fast feasibility test must reject an uphill step');
// Regression: downhill magnitude must never be treated as a slope limit. A
// route with abrupt drops is valid as long as no sampled step climbs.
assert.equal(abearcGravityIsNonAscending([120,119,60,59,10], 0.10), true, 'very steep downhill steps must remain valid');
const steepRows = 1, steepColumns = 5;
const steepPlan = {
  rows:steepRows, columns:steepColumns, halfRows:0, startIndex:0, endIndex:4,
  straightDistanceM:40, corridorM:0, alongStepM:10, crossStepM:10,
  local:[{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:30,y:0},{x:40,y:0}],
  locations:[0,1,2,3,4].map(c => ({longitude:c,latitude:0}))
};
const steepElevations = [120,118,70,25,10];
const steepRoute = abearcGravityFindPathOnGrid(steepPlan, steepElevations, 0.10);
assert.equal(Array.from(steepRoute).join(','), '0,1,2,3,4', 'path finder must accept abrupt downhill drops without a gradual-slope penalty');

// Regression: Point 2 is lower, but the direct alignment crosses a ridge that
// is higher than Point 1. The search grid must extend behind Point 1 / beyond
// Point 2 so a continuously descending detour is still possible.
const detourPlan = abearcGravityBuildPlan([0,0], [0.001,0], {
  sourceKey:'namria-dtm5-prs92', corridorM:20, alongMarginM:20, spacingM:10, budget:5000
});
assert.ok(detourPlan.startColumn > 0, 'gravity grid must include search space behind Point 1');
assert.ok(detourPlan.endColumn < detourPlan.columns - 1, 'gravity grid must include search space beyond Point 2');
const detourElevations = new Array(detourPlan.rows * detourPlan.columns).fill(NaN);
const centerRow = detourPlan.halfRows;
const upperRow = Math.max(0, centerRow - 1);
const farRow = Math.max(0, centerRow - 2);
const pathCells = [detourPlan.startIndex];
// The only exit from P1 first moves behind P1, then two rows sideways; the
// original endpoint-bounded grid could never represent this route.
pathCells.push(centerRow * detourPlan.columns + detourPlan.startColumn - 1);
pathCells.push(upperRow * detourPlan.columns + detourPlan.startColumn - 1);
pathCells.push(farRow * detourPlan.columns + detourPlan.startColumn - 1);
for (let column = detourPlan.startColumn; column <= detourPlan.endColumn; column++) {
  pathCells.push(farRow * detourPlan.columns + column);
}
pathCells.push(upperRow * detourPlan.columns + detourPlan.endColumn);
pathCells.push(detourPlan.endIndex);
pathCells.forEach((cell, index) => { detourElevations[cell] = 100 - index; });
// The straight-ahead center-row cell is an impassable ridge higher than P1.
const ridgeCell = centerRow * detourPlan.columns + detourPlan.startColumn + 1;
detourElevations[ridgeCell] = 110;
detourElevations[detourPlan.endIndex] = 80;
const detourRoute = abearcGravityFindPathOnGrid(detourPlan, detourElevations, 0.05);
assert.ok(Array.isArray(detourRoute) && detourRoute.length > 2, 'a lower endpoint must still be reachable by a descending detour around higher direct terrain');
assert.ok(detourRoute.some(index => detourPlan.local[index].x < 0), 'the regression route must prove that a temporary detour behind Point 1 is supported');
for (let i=1;i<detourRoute.length;i++) {
  assert.ok(detourElevations[detourRoute[i]] <= detourElevations[detourRoute[i-1]] + 0.05, 'ridge-bypass route must remain continuously non-ascending');
}


// Regression: a valid continuously descending route can run through the
// interpolated DEM surface between raster cell centres. The ordinary 8-neighbour
// cell-centre graph has no route here, while the contour-resolved rescue does.
const contourRows = 4, contourColumns = 6, contourHalfRows = 2;
const contourLocal = [], contourLocations = [];
for (let row = 0; row < contourRows; row++) for (let column = 0; column < contourColumns; column++) {
  contourLocal.push({ x: column * 10, y: (row - contourHalfRows) * 10 });
  contourLocations.push({ longitude: column / 1000, latitude: row / 1000 });
}
const contourPlan = {
  sourceResolutionM: 10,
  rows: contourRows,
  columns: contourColumns,
  halfRows: contourHalfRows,
  marginColumns: 0,
  alongStepM: 10,
  crossStepM: 10,
  spacingM: 10,
  straightDistanceM: 50,
  corridorM: 20,
  startIndex: 12,
  endIndex: 17,
  local: contourLocal,
  locations: contourLocations,
  activeMask: new Uint8Array(contourRows * contourColumns).fill(1),
  frame: {
    straightDistanceM: 50,
    metresPerLongitudeDegree: 111320,
    metresPerLatitudeDegree: 110574,
    alongEast: 1,
    alongNorth: 0,
    crossEast: 0,
    crossNorth: 1
  },
  startLngLat: [0, 0]
};
const contourElevations = [
  96,102,96,86,78,74,
  96,89,84,92,88,85,
  100,92,86,87,88,75,
  101,94,96,91,81,79
];
const reverseContinuousRoute = abearcGravityFindPathOnGrid(contourPlan, contourElevations, 0.10);
if (Array.isArray(reverseContinuousRoute)) {
  assert.equal(reverseContinuousRoute[0], contourPlan.startIndex);
  assert.equal(reverseContinuousRoute.at(-1), contourPlan.endIndex);
  for (let index = 1; index < reverseContinuousRoute.length; index++) {
    assert.ok(abearcGravitySegmentIsNonAscending(contourPlan, contourElevations, contourPlan.local[reverseContinuousRoute[index - 1]], contourPlan.local[reverseContinuousRoute[index]], 0.10), 'every reverse-reachability segment must remain non-ascending on the continuous terrain surface');
  }
}
const contourRoute = abearcGravityContourRescue(contourPlan, contourElevations, 100, 75);
assert.ok(Array.isArray(contourRoute) && contourRoute.length >= 2, 'contour-resolved rescue must recover a descending path between DEM cell centres');
const contourRouteElevations = contourRoute.map(point => abearcGravityInterpolateLocal(contourPlan, contourElevations, point));
assert.ok(abearcGravityIsNonAscending(contourRouteElevations, 0.10), 'contour-resolved rescue vertices must remain non-ascending');
const contourGraphRoute = abearcGravityContourGraphRescueFromPlan(contourPlan, contourElevations, 100, 75, 'namria-dtm5-prs92', 'Test DEM');
assert.ok(contourGraphRoute?.indexes?.length >= 2, 'sampled contour-network rescue must recover a graph route when cell-centre routing fails');
assert.equal(contourGraphRoute.strategy, 'sampled-contour-network-all-descent');
for (let index = 1; index < contourRoute.length; index++) {
  assert.ok(abearcGravitySegmentIsNonAscending(contourPlan, contourElevations, contourRoute[index - 1], contourRoute[index], 0.10), 'every contour-resolved route segment must remain non-ascending on the interpolated DEM');
}


// Regression: when generated contours already show a connected downhill route,
// use that same visible contour geometry rather than rejecting it because a
// separately sampled raster grid contains small local rises.
const visibleContourPaths = [
  { level:100, points:[[0.00015,-0.00025],[0.00020,0],[0.00028,0.00022]] },
  { level:90,  points:[[0.00036,-0.00025],[0.00042,0],[0.00050,0.00022]] },
  { level:80,  points:[[0.00062,-0.00025],[0.00070,0],[0.00078,0.00022]] }
];
const visibleContourRoute = abearcGravityRouteContourPaths(
  [0,0], [0.001,0], 105, 75, visibleContourPaths,
  { sourceKey:'namria-dtm5-prs92', sourceLabel:'Test DEM', sourceResolutionM:5, effectiveSpacingM:5, intervalM:10 }
);
assert.ok(visibleContourRoute?.indexes?.length >= 2, 'generated visible contours must be usable as an all-descent routing scaffold');
assert.equal(visibleContourRoute.strategy, 'displayed-contour-guided');
assert.equal(visibleContourRoute.elevations[0], 105);
assert.equal(visibleContourRoute.elevations.at(-1), 75);
assert.ok(abearcGravityIsNonAscending(visibleContourRoute.elevations, 0.10), 'visible-contour route levels must never ascend');
assert.deepEqual([...new Set(visibleContourRoute.elevations)], [105,100,90,80,75], 'route should descend through the available contour levels in order');

// Regression: multi-measure renders contours belonging to an inactive Area
// while a Distance is selected. The gravity tool must use those *visible*
// contours instead of looking only at the active Distance analysis state.
abearcMapContourData = null;
abearcMapContourSource = 'namria-dtm5-prs92';
abearcMapMeasurements = [{
  id:'area-1', name:'Area 1', mode:'area', visible:true,
  analysis:{
    contourSource:'namria-dtm5-prs92', contourInterval:10,
    contours:{ imported:false, sourceLabel:'Test DEM', paths:visibleContourPaths }
  }
}];
const inactiveContourDatasets = abearcGravityVisibleContourDatasets('namria-dtm5-prs92', 'Test DEM');
assert.equal(inactiveContourDatasets.length, 1, 'visible inactive Area contours must be exposed to gravity routing');
assert.equal(inactiveContourDatasets[0].measurementName, 'Area 1');
const inactiveContourRoute = abearcGravityDisplayedContourRescue([0,0], [0.001,0], 105, 75, 'namria-dtm5-prs92', 'Test DEM', inactiveContourDatasets);
assert.ok(inactiveContourRoute?.indexes?.length >= 2, 'gravity routing must use visible contours stored on inactive Area 1 while Distance 1 is active');
assert.equal(inactiveContourRoute.contourMeasurementName, 'Area 1');
assert.equal(inactiveContourRoute.visibleContourSetsChecked, 1);

// Regression: visible contours must not disappear merely because the currently
// selected elevation source is different. They remain available as explicitly
// labeled cross-source guidance rather than being counted as zero.
abearcMapMeasurements = [{
  id:'area-srtm', name:'Area SRTM', mode:'area', visible:true,
  analysis:{
    contourSource:'opentopo-srtm30', contourInterval:10,
    contours:{ imported:false, sourceLabel:'Open Topo Data SRTM Radar DEM', paths:visibleContourPaths }
  }
}, {
  id:'area-imported', name:'Imported Contours', mode:'area', visible:true,
  analysis:{
    contourSource:'namria-dtm5-prs92', contourInterval:10,
    contours:{ imported:true, sourceLabel:'Imported contour KML', paths:visibleContourPaths }
  }
}];
const mixedContourDatasets = abearcGravityVisibleContourDatasets('namria-dtm5-prs92', 'NAMRIA DTM 5 m (PRS92)');
assert.equal(mixedContourDatasets.length, 2, 'different-source and imported visible contour networks must remain available to the router');
assert.equal(mixedContourDatasets.filter(item => item.sourceMatches).length, 0, 'different-source/imported contours must not be mislabeled as the selected DEM');
assert.ok(mixedContourDatasets.some(item => item.sourceKey === 'opentopo-srtm30'), 'SRTM contour source metadata must be retained');
assert.ok(mixedContourDatasets.some(item => item.imported), 'imported contour KML geometry must remain visible to routing fallback');

const refinePlan = abearcGravityBuildPlan([0,0], [0.001,0], {
  sourceKey:'namria-dtm5-prs92', corridorM:40, spacingM:5, budget:5000,
  routeLocal:[{x:0,y:0},{x:100,y:0}], routeBufferM:10
});
assert.ok(refinePlan.activeCount < refinePlan.locations.length, 'fine refinement should sample only cells near the coarse route');
assert.ok(refinePlan.activeMask[refinePlan.startIndex] && refinePlan.activeMask[refinePlan.endIndex], 'fine refinement must always keep both endpoints active');
const edgePlan = {
  rows:3, columns:5, halfRows:0, alongStepM:5, crossStepM:5.1,
  local:Array.from({length:15}, (_, i) => ({x:(i % 5)*5, y:Math.floor(i/5)*5.1})),
  startIndex:5, endIndex:9, activeMask:new Uint8Array([0,0,0,0,0, 1,1,1,1,1, 0,0,0,0,0])
};
const edgeHeights = [NaN,NaN,NaN,NaN,NaN, 100,99,98,97,96, NaN,NaN,NaN,NaN,NaN];
assert.equal(abearcGravityInterpolateLocal(edgePlan, edgeHeights, {x:2.5,y:5.1 + 1e-14}), 99.5,
  'roundoff at sampled grid lines must not require an unsampled neighboring row');
assert.ok(Number.isNaN(abearcGravityInterpolateLocal(edgePlan, edgeHeights, {x:2.5,y:5.2})),
  'real missing terrain must still block routing');
const kmlStart = [125.385277,7.4338092], kmlEnd = [125.37986155,7.42925961];
const kmlFrame = abearcGravityLocalFrame(kmlStart, kmlEnd);
const reconstructedEnd = abearcGravityLocalToLngLat(kmlStart, kmlFrame, kmlFrame.straightDistanceM, 0);
assert.ok(reconstructedEnd.every((value, i) => Math.abs(value - kmlEnd[i]) < 1e-10),
  'local routing coordinates must preserve the exact KML endpoint');
`, context);

console.log('Gravity-flow path check passed: reverse continuous reachability, NAMRIA-only source locking, generated-contour-guided routing, all-descent hierarchical routing, steep-drop acceptance, dense full-corridor fallback, contour-resolved between-cell rescue, progress UI, DEM caching, longitudinal detours, masked fine refinement, and no-path rejection verified.');

// Exercise gravity's real cache/batching caller against the real request helper.
context.setTimeout = setTimeout;
context.API = '/api';
context.authToken = 'test';
let requests = 0;
context.fetch = async (_url, options) => {
  const { source, locations } = JSON.parse(options.body);
  assert.equal(source, 'namria-dtm5-prs92');
  assert.ok(locations.length >= 2 && locations.length <= 300);
  requests++;
  return { ok:true, json:async () => ({
    source_key:source, source:'Test DEM', elevations:locations.map(point => 1000 - point.longitude)
  }) };
};
vm.runInContext(map.slice(map.indexOf('    async function requestAbearcElevations('),
  map.indexOf('    async function loadAbearcElevationProfile(')), context);
vm.runInContext(`(async () => {
  const locations = Array.from({length:601}, (_, i) => ({longitude:i / 100, latitude:7}));
  for (const count of [1, 301, 601]) {
    clearAbearcGravityElevationCache();
    const result = await abearcGravityFetchElevations(locations.slice(0,count), null, 'namria-dtm5-prs92');
    assert.equal(result.elevations.length, count);
    result.elevations.forEach((value, i) => assert.equal(value, 1000 - locations[i].longitude));
  }
  clearAbearcGravityElevationCache();
  await abearcGravityFetchElevations(locations.slice(0,2), null, 'namria-dtm5-prs92');
  const partial = await abearcGravityFetchElevations(locations.slice(0,3), null, 'namria-dtm5-prs92');
  assert.equal(partial.cachedCount, 2);
  assert.equal(partial.fetchedCount, 1);
  assert.equal(partial.elevations[2], 999.98);
  const batched = await requestAbearcElevationBatches(locations.slice(0,301), null, 'namria-dtm5-prs92', false);
  assert.equal(batched.elevations.length, 301);
  assert.equal(batched.elevations[300], 997);
  await assert.rejects(requestAbearcElevations([], null, 'namria-dtm5-prs92', false));
  const slopeLocations = [{longitude:0,latitude:0},{longitude:1,latitude:0},{longitude:2,latitude:0}];
  assert.equal(abearcGravitySlopeStats(slopeLocations,[100,95,90]).variation,0);
  assert.ok(Math.abs(abearcGravitySlopeStats(slopeLocations,[100,100,90]).variation-1)<1e-12);
  const validRoute = {sourceKey:'namria-dtm5-prs92',plan:{locations:slopeLocations},indexes:[0,1,2],elevations:[100,100,90],
    finalTerrainValidation:{valid:true,locations:slopeLocations,elevations:[100,100,90],sampleStepM:5,maximumStepAscentM:0}};
  abearcGravitySearchHierarchical = async () => validRoute;
  clearAbearcGravityElevationCache();
  requestAbearcElevations = async () => { throw new Error('Terrain temporarily unavailable'); };
  const retained = await abearcGravityRunSearch([0,0],[2,0],null,0,'namria-dtm5-prs92',true);
  assert.equal(retained.plan,validRoute.plan,'optional slope sampling failure must preserve the validated route');
  assert.equal(retained.uniformSlope.unavailable,true);
  const noOptimization = await abearcGravityRunSearch([0,0],[2,0],null,0,'namria-dtm5-prs92',false);
  assert.equal(noOptimization.uniformSlope,undefined);
  requestAbearcElevations = async () => { const error=new Error('Cancelled'); error.name='AbortError'; throw error; };
  await assert.rejects(abearcGravityRunSearch([0,0],[2,0],null,0,'namria-dtm5-prs92',true), {name:'AbortError'});
})()`, context).then(() => {
  assert.equal(requests, 10);
  console.log('Gravity elevation integration passed: singleton cache misses and 301/601-point batch tails preserve every elevation.');
}).catch(error => { console.error(error); process.exitCode = 1; });
