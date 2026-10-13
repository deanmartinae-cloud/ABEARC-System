const assert = require('assert');
const fs = require('fs');
const path = require('path');
const analysis = require('../src/frontend/scripts/11-abearc-map-analysis.js');
const vm = require('vm');

const nearby = [{ id: 2, x: 61, y: 0 }, { id: 1, x: 59, y: 0 }, { id: 3, x: 200, y: 0 }];
assert.deepStrictEqual(analysis.clusterPhotoPoints(nearby, 60).map(group => group.map(p => p.id)), [[1, 2], [3]]);
assert.deepStrictEqual(analysis.clusterPhotoPoints([...nearby].reverse(), 60), analysis.clusterPhotoPoints(nearby, 60));
assert.strictEqual(analysis.clusterPhotoPoints(nearby.map(p => ({ ...p, x: p.x * 100 })), 60).length, 3);

// Exercise actual marker click handlers with a moved photo and a cluster cover at different GPS coordinates.
const mapScript = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/12-abearc-map.js'), 'utf8');
const markerCode = mapScript.slice(mapScript.indexOf('    function abearcPhotoMarkerElement('), mapScript.indexOf('    function syncAbearcMapPhotoHover('));
const clicked = [];
const context = {
  document: { createElement: () => ({ dataset: {}, style: {}, classList: { toggle() {} } }) },
  abearcMapSelectedPhotoIds: new Set(),
  abearcMapMovedPhotoSizes: new Map(),
  abearcFeatureId: f => f.id, abearcMapHoveredPhotoId: null, abearcMapSelectedPhotoId: null,
  abearcMapMovedPhotoPositions: new Map([[1, [0, 0]]]), abearcMapExpandedPhotos: new Map(),
  ensureAbearcMapMovedPhotoSize: () => ({ mapWidth: 1, mapHeight: 1 }),
  applyAbearcMapMovedPhotoScale: () => {},
  abearcMapPhotoSuppressOpenUntil: new Map(), abearcMapMeasureMode: 'distance',
  abearcAuthenticatedMediaUrl: () => '', bearingArrowHtml: () => '', abearcMarkerPlaceholder: () => '', esc: String,
  addAbearcMeasurePointAt: coordinates => clicked.push(coordinates),
  handleAbearcClusterClick: () => clicked.push('explode'),
  deleteAbearcMeasurePointNear: coordinates => clicked.push(coordinates)
};
vm.createContext(context); vm.runInContext(markerCode, context);
const feature = { id: 1, geometry: { coordinates: [125, 7] }, properties: {} };
const clusterFeature = { geometry: { coordinates: [125.1, 7.1] }, clusterFeatures: [feature] };
const click = { detail: 1, stopPropagation() {}, preventDefault() {} };
context.abearcPhotoMarkerElement({ feature }).onclick(click);
const clusterMarker = context.abearcPhotoMarkerElement({ feature, count: 2, clusterFeature });
clusterMarker.onclick(click); clusterMarker.ondblclick(click);
assert.deepStrictEqual(clicked, [feature.geometry.coordinates, clusterFeature.geometry.coordinates, clusterFeature.geometry.coordinates]);
clusterMarker.onclick({ ...click, altKey: true });
assert.strictEqual(clicked.at(-1), 'explode');

const layoutContext = {
  abearcMap: { project: p => ({ x: p[0], y: p[1] }), getCanvas: () => ({ clientWidth: 800, clientHeight: 600, getBoundingClientRect: () => ({ left: 100, top: 50 }) }) },
  abearcMapConfig: { explosion: { minRadius: 72, maxRadius: 340 } },
  abearcMapPhotoMarkers: new Map(), abearcFeatureId: f => f.id,
  abearcMapExploded: { anchor: [20, 20], positions: null }
};
vm.createContext(layoutContext);
vm.runInContext(mapScript.slice(mapScript.indexOf('    function rectForExplosionPoint('), mapScript.indexOf('    function mapMediaAgeStatus(')), layoutContext);
const exploded = Array.from({ length: 6 }, (_, id) => ({ id, geometry: { coordinates: [20, 20] } }));
const placed = layoutContext.explosionPositions(exploded);
placed.forEach((point, i) => {
  assert(point.x >= 36 && point.x <= 764 && point.y >= 36 && point.y <= 564, 'Exploded photo must fit the viewport.');
  placed.slice(i + 1).forEach(other => assert(!layoutContext.rectsOverlap(layoutContext.rectForExplosionPoint(point), layoutContext.rectForExplosionPoint(other)), 'Exploded photos should not overlap when space is available.'));
});
assert.deepStrictEqual(layoutContext.explosionPositions(exploded.slice(1)), placed.slice(1), 'Hiding one photo must not shuffle remaining photos.');
const spread = [[350, 280], [410, 280], [410, 340], [350, 340]].map((coordinates, id) => ({ id, geometry: { coordinates } }));
layoutContext.abearcMapExploded = { anchor: [380, 310], positions: new Map([[0, { x: 60, y: 0 }]]) };
const spreadPositions = layoutContext.explosionPositions(spread);
spreadPositions.forEach((point, i) => {
  const origin = layoutContext.abearcMap.project(spread[i].geometry.coordinates);
  spread.forEach(photo => assert(!layoutContext.rectsOverlap(layoutContext.rectForExplosionPoint(point), layoutContext.rectForExplosionPoint(layoutContext.abearcMap.project(photo.geometry.coordinates), 20)), 'No thumbnail should cover any GPS pin, including after restoring a cached position.'));
  spreadPositions.slice(i + 1).forEach((end, offset) => assert(!layoutContext.segmentsIntersect(origin, point, layoutContext.abearcMap.project(spread[i + offset + 1].geometry.coordinates), end), 'Spread GPS pins should have non-crossing leaders when space is available.'));
});

const square = (west, south, size) => [[west, south], [west + size, south], [west + size, south + size], [west, south + size]];
for (const [key, bounds] of [
  ['cluster:nearby', { left: 370, top: 195, right: 430, bottom: 255 }],
  ['photo:99', { left: 300, top: 110, right: 560, bottom: 260 }]
]) {
  const element = { querySelectorAll: () => [], getBoundingClientRect: () => ({ left: bounds.left + 100, top: bounds.top + 50, right: bounds.right + 100, bottom: bounds.bottom + 50 }) };
  layoutContext.abearcMapPhotoMarkers = new Map([[key, { getElement: () => element, getLngLat: () => [400, 255] }]]);
  layoutContext.abearcMapExploded = { anchor: [400, 300], positions: new Map([[0, { x: 0, y: -100 }]]) };
  const origin = { x: 400, y: 300 };
  const [end] = layoutContext.explosionPositions([{ id: 0, geometry: { coordinates: [400, 300] } }]);
  const obstacle = layoutContext.currentPhotoMarkerRects()[0].rect;
  assert.strictEqual(obstacle.left, bounds.left - 8, 'Use real DOM bounds in map coordinates.');
  assert(!layoutContext.rectsOverlap(layoutContext.rectForExplosionPoint(end), obstacle), 'Exploded photo must avoid surrounding cluster or expanded photo.');
  for (let step = 0; step <= 100; step++) {
    const x = origin.x + (end.x - origin.x) * step / 100, y = origin.y + (end.y - origin.y) * step / 100;
    assert(!(x >= obstacle.left && x <= obstacle.right && y >= obstacle.top && y <= obstacle.bottom), 'Leader must avoid surrounding photo even when a cached position crosses it.');
  }
}
const small = analysis.planContourGrids([square(125.4, 7.1, 0.0018)], 5);
assert(small.plans[0].columns > 18, 'A small NAMRIA polygon should sample more finely than the old 18-column grid.');
assert(small.effectiveSpacingM <= 6, 'A small polygon should retain approximately 5 m NAMRIA spacing.');

const large = analysis.planContourGrids([square(125.3, 7.0, 0.1)], 5, { maxSamples: 8000 });
assert(large.totalSamples <= 8000, 'Adaptive contour plans must honor the total sample budget.');
assert(large.effectiveSpacingM > 5, 'Large areas must report their coarser effective grid spacing.');
assert.throws(() => analysis.planContourGrids(Array.from({ length: 13 }, (_, index) => square(125.3 + index * 0.001, 7, 0.0005)), 5), /at most 12 polygons/);

const polygon = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
const grid = [
  { longitude: 0.5, latitude: 0.5, elevation: 10 },
  { longitude: 0.5, latitude: 1.5, elevation: 20 },
  { longitude: 1.5, latitude: 1.5, elevation: 999 }
];
assert.deepStrictEqual(analysis.interiorElevations(grid, polygon), [10, 20], 'Terrain outside a concave polygon must not affect contour statistics.');
assert.strictEqual(analysis.userStorageKey('orthomaps', 42), 'orthomaps:42');

const values = new Map([['orthomaps', 'legacy']]);
const storage = { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) };
assert.strictEqual(analysis.userStorageValue(storage, 'orthomaps', 42), 'legacy');
storage.setItem('orthomaps:42', 'user-42');
assert.strictEqual(analysis.userStorageValue(storage, 'orthomaps', 42), 'user-42');
assert.strictEqual(analysis.userStorageValue(storage, 'orthomaps', 7), 'legacy');
assert.strictEqual(values.get('orthomaps:7'), 'legacy', 'Legacy preferences should migrate independently for each user.');

const cityBoundary = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/frontend/data/davao-city-boundary.geojson'), 'utf8'));
assert.match(cityBoundary.features?.[0]?.properties?.source || '', /CPDO.*zoning extent/i);
assert.deepStrictEqual(cityBoundary.bbox, [125.214661, 6.959498, 125.678843, 7.574888], 'Davao City boundary must retain the CPDO zoning footprint.');
assert(cityBoundary.features[0].geometry.coordinates[0][0].length > 1000, 'Davao City zoning boundary is unexpectedly incomplete.');

console.log('Map analysis check passed: contours, user preferences, and the CPDO zoning boundary verified.');
