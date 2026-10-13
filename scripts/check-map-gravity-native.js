const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(path.join(root, 'src/backend/controllers/14-map-media.controller.js'), 'utf8');
const start = controller.indexOf('const mapGravityHeap = class');
const end = controller.indexOf('const mapGravityNamriaNativePath = async');
assert.ok(start >= 0 && end > start, 'native gravity raster helpers must be present');
const helperSource = controller.slice(start, end);

const context = { assert, console, Math, Number, Array, Float64Array, Int32Array, Uint8Array };
vm.createContext(context);
vm.runInContext(`${helperSource}
// A sampled grid edge does not need terrain from the unused adjacent row.
const edgeElevations = new Float64Array([100, 99, 98, NaN, NaN, NaN]);
const edgeSample = mapGravityContinuousGridSampler(edgeElevations, 3, 2);
assert.equal(edgeSample(0.5, 0), 99.5);
assert.ok(Number.isNaN(edgeSample(0.5, 0.5)), 'missing terrain with nonzero weight must still block routing');
assert.ok(mapGravityFindReverseReachabilityPath({
  elevations:edgeElevations, width:3, height:2,
  activeMask:new Uint8Array([1,1,1,0,0,0]), startIndex:0, endIndex:2,
  pixelWidthM:5, pixelHeightM:5, ascentToleranceM:0.10
})?.path?.length, 'a valid descending sampled edge must remain routable');
const rows = 3, columns = 5;
const elevations = new Float64Array([
  99,94,90,85,79,
  100,95,99,85,80,
  99,96,91,86,79
]);
const mask = new Uint8Array(rows * columns).fill(1);
const exact = mapGravityFindRasterPath({
  elevations, width:columns, height:rows, activeMask:mask,
  startIndex:5, endIndex:9, pixelWidthM:5, pixelHeightM:5,
  maximumStepAscentM:0.10, ascentPenalty:0
});
assert.ok(exact?.path?.length >= 2, 'native raster solver must find an exact descending bypass');
const reverseExact = mapGravityFindReverseReachabilityPath({
  elevations, width:columns, height:rows, activeMask:mask,
  startIndex:5, endIndex:9, pixelWidthM:5, pixelHeightM:5,
  ascentToleranceM:0.10, allowAnyAngleEscapes:true, maximumEscapeRadius:3
});
assert.ok(reverseExact?.path?.length >= 2, 'reverse reachability must prove the descending bypass from the outlet backward to Point 1');
assert.equal(reverseExact.path[0], 5);
assert.equal(reverseExact.path.at(-1), 9);
assert.ok(reverseExact.reachableCount > 0, 'reverse reachability must report the terrain region explored from Point 2');
const reverseMask = mapGravityBuildReverseReachableMask({
  elevations, width:columns, height:rows, activeMask:mask,
  startIndex:5, endIndex:9, ascentToleranceM:0.10,
  allowAnyAngleEscapes:true, maximumEscapeRadius:3
});
assert.ok(reverseMask?.reachableMask?.[5], 'reverse mask must independently prove Point 1 can drain to Point 2');
const maskedAStar = mapGravityFindMaskedAStarPath({
  elevations, width:columns, height:rows, activeMask:mask,
  reachableMask:reverseMask.reachableMask, bottleneckMask:reverseMask.bottleneckMask,
  startIndex:5, endIndex:9, pixelWidthM:5, pixelHeightM:5,
  ascentToleranceM:0.10, allowAnyAngleEscapes:true, maximumEscapeRadius:3
});
assert.ok(maskedAStar?.path?.length >= 2, 'masked A* must extract a forward route only after reverse feasibility is known');
assert.ok(maskedAStar.expandedCount <= reverseMask.reachableCount, 'masked A* must not expand outside the reverse reachable terrain mask');
for (let i=1;i<reverseExact.path.length;i++) assert.ok(elevations[reverseExact.path[i]] <= elevations[reverseExact.path[i-1]] + 0.10);
assert.equal(exact.path[0], 5);
assert.equal(exact.path.at(-1), 9);
for (let i=1;i<exact.path.length;i++) assert.ok(elevations[exact.path[i]] <= elevations[exact.path[i-1]] + 0.10);

const steep = mapGravityFindRasterPath({
  elevations:new Float64Array([120,118,70,25,10]), width:5, height:1,
  activeMask:new Uint8Array(5).fill(1), startIndex:0, endIndex:4,
  pixelWidthM:5, pixelHeightM:5, maximumStepAscentM:0.10, ascentPenalty:0
});
assert.equal(Array.from(steep.path).join(','), '0,1,2,3,4', 'steep downward drops must remain valid in native routing');

const noisy = new Float64Array([
  100,99.6,99.9,99.2,98.8,
  101,100.5,100.1,99.7,99.0
]);
const noisyMask = new Uint8Array(10).fill(1);
const strictNoisy = mapGravityFindRasterPath({
  elevations:noisy, width:5, height:2, activeMask:noisyMask,
  startIndex:0, endIndex:4, pixelWidthM:5, pixelHeightM:5,
  maximumStepAscentM:0.10, ascentPenalty:0
});
assert.equal(strictNoisy, null, 'strict native routing must reject a local upward DTM jitter above 0.10 m');
const tolerantNoisy = mapGravityFindRasterPath({
  elevations:noisy, width:5, height:2, activeMask:noisyMask,
  startIndex:0, endIndex:4, pixelWidthM:5, pixelHeightM:5,
  maximumStepAscentM:1.0, ascentPenalty:100000
});
assert.ok(tolerantNoisy?.path?.length >= 2, 'bounded DTM-noise fallback must recover the otherwise descending route');
assert.ok(tolerantNoisy.maximumRawStepAscentM <= 1.0 + 1e-9);

// Regression: a contour can pass between 5 m cell centres even though no
// strictly descending centre-to-centre route exists. The 2x bilinear lattice
// must recover that continuous-surface route without allowing uphill steps.
const betweenCell = new Float64Array([
  90.6,102.7,109.7,97.9,106.0,
  102.7,103.3,106.1,99.1,90.7,
  105.0,106.2,97.1,99.9,95.0,
  90.2,97.8,93.2,109.6,106.0,
  93.7,93.4,108.4,98.7,105.2
]);
const betweenMask = new Uint8Array(25).fill(1);
const centreOnly = mapGravityFindRasterPath({
  elevations:betweenCell, width:5, height:5, activeMask:betweenMask,
  startIndex:10, endIndex:14, pixelWidthM:5, pixelHeightM:5,
  maximumStepAscentM:0.10, ascentPenalty:0
});
assert.equal(centreOnly, null, 'cell-centre search should reproduce the false no-path regression');
const interpolated = mapGravityFindInterpolatedRasterPath({
  elevations:betweenCell, width:5, height:5,
  startX:0, startY:2, endX:4, endY:2,
  pixelWidthM:5, pixelHeightM:5, corridorM:20, factor:2, ascentToleranceM:0.10
});
assert.ok(interpolated?.found && interpolated.result?.path?.length >= 2, 'sub-cell interpolated search must recover the between-cell contour route');
for (let i=1;i<interpolated.result.path.length;i++) {
  const previousElevation = interpolated.elevations[interpolated.result.path[i-1]];
  const currentElevation = interpolated.elevations[interpolated.result.path[i]];
  assert.ok(currentElevation <= previousElevation + 0.10 + 1e-9, 'interpolated route must remain non-ascending');
}

// Coarse-to-fine regression: once a coarse route exists, the 2.5 m continuous
// grid should be cropped/masked around that route rather than resampling an
// equally large full corridor.
const guideWidth=20, guideHeight=12;
const guideTerrain=new Float64Array(guideWidth*guideHeight);
for (let row=0;row<guideHeight;row++) for (let column=0;column<guideWidth;column++) {
  guideTerrain[row*guideWidth+column]=200-column*2-row*0.01;
}
const guideRawPoints=[];
for (let column=0;column<guideWidth;column++) guideRawPoints.push({x:column,y:6});
const fullRefine=mapGravityFindInterpolatedRasterPath({
  elevations:guideTerrain,width:guideWidth,height:guideHeight,
  startX:0,startY:6,endX:19,endY:6,pixelWidthM:5,pixelHeightM:5,
  corridorM:25,factor:2,ascentToleranceM:0.10
});
const guidedRefine=mapGravityFindInterpolatedRasterPath({
  elevations:guideTerrain,width:guideWidth,height:guideHeight,
  startX:0,startY:6,endX:19,endY:6,pixelWidthM:5,pixelHeightM:5,
  corridorM:25,factor:2,ascentToleranceM:0.10,
  guideRawPoints,guideBufferM:6
});
assert.ok(fullRefine?.found && guidedRefine?.found, 'both full and route-guided continuous refinements must retain the valid downhill path');
assert.ok(guidedRefine.routeGuided, 'coarse-to-fine refinement must report route guidance');
assert.ok(guidedRefine.activeCount < fullRefine.activeCount, 'route-guided 2.5 m refinement must activate fewer terrain nodes than the full corridor');
// Regression from the September 29 KML: straight chords between contour
// crossings climb off the bilinear DTM and cause false no-path rejection.
for (const terrain of [[0,10,10,30], [0,20,20,0], [20,0,0,20]]) {
  const contours = mapGravityBuildNativeContourPaths({
    elevations:terrain, width:2, height:2, originX:-0.5, originY:-0.5,
    resolutionX:1, resolutionY:1, left:0, top:0,
    minimumLevelM:4, maximumLevelM:6, intervalM:5
  });
  assert.ok(contours.paths.length);
  for (const contour of contours.paths) for (let i=1; i<contour.points.length; i++) {
    const a=contour.points[i-1], b=contour.points[i];
    for (let step=0; step<=10; step++) {
      const t=step/10;
      const elevation=mapGravityBilinearElevation(terrain,2,2,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
      assert.ok(Math.abs(elevation-contour.level)<=0.020001, 'every contour segment must stay on the actual bilinear surface');
    }
  }
}
`, context);



// The regular NAMRIA elevation-profile endpoint must sample the same continuous
// cell-centre bilinear surface as the gravity solver. Otherwise a level contour
// can look like a staircase in the displayed profile and strict validation can
// reject the route even though the routing surface itself is non-ascending.
assert.match(controller, /const rasterX = .*\/ resolutionX - 0\.5;/);
assert.match(controller, /const rasterY = .*\/ resolutionY - 0\.5;/);
assert.match(controller, /top \+ \(bottom - top\) \* query\.ty/);
assert.match(controller, /mapGravityBuildReverseReachableMask/);
assert.match(controller, /mapGravityFindMaskedAStarPath/);
assert.match(controller, /factor:\s*2/);
assert.match(controller, /factor:\s*4/);
assert.match(controller, /1\.25m bottleneck-only refinement/);
assert.match(controller, /guideRawPoints/);
assert.match(controller, /const routeIndexes = Array\.from\(subcell\.result\.path\)/);

assert.match(controller, /mapGravityBuildNativeContourPaths/);
assert.match(controller, /nativeContourPaths/);
assert.match(controller, /mapGravityRemoteSampledPath/);
assert.match(controller, /Gravity Flow Path supports NAMRIA DTM 5 m \(PRS92\) only/);
assert.match(controller, /const result = await mapGravityNamriaNativePath\(searchArgs\)/);
assert.match(controller, /gravity-flow terrain search timed out/i);
console.log('Gravity routing check passed: Gravity Flow Path is locked to NAMRIA DTM 5 m (PRS92) native routing only.');
