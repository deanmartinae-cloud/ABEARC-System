const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const analysis = require('../src/frontend/scripts/11-abearc-map-analysis.js');

const ROOT = path.resolve(__dirname, '..');
const saltSource = fs.readFileSync(path.join(ROOT, 'src/frontend/scripts/17-map-salt.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(ROOT, 'src/frontend/scripts/12-abearc-map.js'), 'utf8');
const layoutSource = fs.readFileSync(path.join(ROOT, 'src/frontend/scripts/16-map-layouts.js'), 'utf8');
const mapPage = fs.readFileSync(path.join(ROOT, 'src/frontend/pages/map.page.html'), 'utf8');
const head = fs.readFileSync(path.join(ROOT, 'src/frontend/layout/head.html'), 'utf8');
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/frontend/script-manifest.json'), 'utf8'));

assert(mapPage.includes('data-map-measure-salt'), 'Area-measure menu must expose SALT layout generation.');
assert(mapPage.includes('id="abearcMapSaltPanel"'), 'SALT design panel must exist.');
assert(head.includes('/assets/css/map-salt.css'), 'SALT stylesheet must be wired into the frontend.');
assert(scripts.includes('src/frontend/scripts/17-map-salt.js'), 'SALT script must be in the frontend manifest.');
assert(mapSource.includes('window.renderAbearcSaltLayout?.(svg)'), 'Measurement SVG must render SALT rows.');
assert(mapSource.includes('window.syncAbearcSaltSelection?.()'), 'SALT rows must invalidate when the selected polygon changes.');
assert(layoutSource.includes('captureAbearcSaltLayoutState'), 'My Map Layouts must capture SALT geometry.');
assert(layoutSource.includes('restoreAbearcSaltLayoutState'), 'My Map Layouts must restore SALT geometry.');

const context = {
  console,
  window: {},
  document: { getElementById: () => null, querySelector: () => null },
  ABEARC_MAP_DEFAULT_ELEVATION_SOURCE: 'namria-dtm5-prs92',
  ABEARC_MAP_ELEVATION_SOURCES: new Set(['namria-dtm5-prs92']),
  ABEARC_MAP_ELEVATION_RESOLUTION_M: { 'namria-dtm5-prs92': 5 },
  ABEARC_MAP_CONTOUR_SAMPLE_BUDGET: { 'namria-dtm5-prs92': 8000 },
  abearcMapAnalysis: analysis,
  abearcMapBasemap: 'google-satellite',
  abearcMap: null,
  abearcContourPolygons: () => [],
  abearcContourSelectionKey: () => '',
  abearcLngLatPointInPolygon: (point, polygon) => analysis.pointInPolygon(point, polygon),
  haversineMetres: analysis.haversineMetres,
  abearcPolygonArea: () => 0,
  abearcMeasurePathDistance: points => points.slice(1).reduce((sum, point, index) => sum + analysis.haversineMetres(points[index], point), 0),
  stitchAbearcContourSegments: segments => segments.map(segment => ({ ...segment, points: segment.points.map(point => [...point]) })),
  toast: () => {},
  closeAbearcMapMeasureContextMenu: () => {},
  closeAbearcElevationProfile: () => {},
  setupAbearcFloatingMapPanelDrag: () => {},
  renderAbearcMapMeasure: () => {},
  requestAbearcElevationBatches: async () => ({ elevations: [], sourceKey: 'namria-dtm5-prs92', sourceLabel: 'test' }),
  downloadBlob: () => {},
  confirmModalChoice: async () => true,
  API: '', authToken: ''
};
vm.createContext(context);
vm.runInContext(saltSource, context, { filename: '17-map-salt.js' });

const west = 125, south = 7, step = 0.0001;
const polygon = [[west - step / 2, south - step / 2], [west + step * 2.5, south - step / 2], [west + step * 2.5, south + step * 2.5], [west - step / 2, south + step * 2.5]];
const grid = [];
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    grid.push({ longitude: west + col * step, latitude: south + row * step, elevation: 100 + col * 2 });
  }
}
const surface = { polygon, rows: 3, columns: 3, grid, effectiveSpacingM: 11, sourceResolutionM: 5 };
const settings = { minSlopePct: 5, maxSlopePct: 50, boundarySetbackM: 0, minRowLengthM: 0 };
const terrain = context.analyzeAbearcSaltSurface(surface, settings);
assert.equal(terrain.interiorCells, 4, 'All four synthetic cells should be analyzed.');
assert.equal(terrain.slopeSuitableCells, 4, 'Synthetic sloping terrain should pass the configured slope screen.');
assert(terrain.slopes.every(value => value > 10 && value < 30), 'Slope computation should produce a realistic percent grade.');
const rows = context.buildAbearcSaltSurface(surface, 1, settings);
assert(rows.paths.length > 0, 'SALT generator should create contour-following rows on suitable terrain.');
assert(rows.paths.every(path => path.points.length >= 2), 'Every generated SALT row must contain georeferenced geometry.');
assert.equal(typeof context.window.captureAbearcSaltLayoutState, 'function');
assert.equal(typeof context.window.restoreAbearcSaltLayoutState, 'function');
assert.equal(typeof context.window.exportAbearcSaltKml, 'function');
assert.equal(typeof context.window.exportAbearcSaltGeoJson, 'function');

console.log(`SALT map check passed: ${rows.paths.length} synthetic contour-farming row segments generated.`);
