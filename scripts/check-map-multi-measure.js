const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const map = fs.readFileSync(path.join(root, 'src/frontend/scripts/12-abearc-map.js'), 'utf8');
const multi = fs.readFileSync(path.join(root, 'src/frontend/scripts/18-map-multi-measure.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/frontend/pages/map.page.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/frontend/script-manifest.json'), 'utf8'));

assert.ok(manifest.includes('src/frontend/scripts/18-map-multi-measure.js'), 'multi-measure script must be in frontend manifest');
assert.match(page, /data-map-measure-list/);
assert.match(page, /clearAllAbearcMapMeasurements\(\)/);
assert.match(map, /renderAbearcInactiveMeasurements\?\.\(svg, width, height\)/);
assert.match(map, /captureAbearcMultiMeasurementState/);
assert.match(map, /restoreAbearcMultiMeasurementState/);
assert.match(map, /startAbearcMultiMeasurementMode/);

const context = {
  assert,
  console,
  structuredClone,
  setTimeout: fn => { if (typeof fn === 'function') fn(); },
  clearTimeout() {},
  window: {},
  document: { getElementById: () => null, querySelector: () => null },
};
vm.createContext(context);
vm.runInContext(`
let abearcMapMeasureMode = 'distance';
let abearcMapMeasurePoints = [[125,7],[125.001,7.001]];
let abearcMapImportedPolygons = [];
let abearcMapSelectedImportedPolygons = new Set();
let abearcMapImportedPolygonContextIndex = null;
let abearcMapEditingImportedPolygonIndex = null;
let abearcMapHiddenMeasurePointIndexes = new Set();
let abearcMapElevationAnnotations = new Map();
let abearcMapLastTouchedMeasureIndex = 1;
let abearcMapContourAbort = null;
let abearcMapContourData = null;
let abearcMap = null;
let abearcMapBasemap = 'google-satellite';
const rememberAbearcMapMeasureState = () => {};
const saveAbearcMapMeasure = () => {};
const updateAbearcMapMeasureTools = () => {};
const renderAbearcMapMeasure = () => {};
const resetAbearcElevationProfile = () => {};
const closeAbearcElevationProfile = () => {};
const removeSavedAbearcMapMeasure = () => {};
const toast = () => {};
const captureAbearcMapLayoutAnalysisState = () => ({ contours:null, saltLayout:null });
const restoreAbearcMapLayoutAnalysisState = () => {};
const abearcPolygonArea = points => points.length * 10;
const abearcMeasurePathDistance = points => points.length * 100;
const formatAbearcDistance = value => value + ' m';
const fitAbearcMapToSearchResults = () => {};
const downloadBlob = () => {};
const esc = value => String(value);
const confirmModalChoice = async () => true;
const ABEARC_MAP_ELEVATION_SOURCES = new Set();
${multi}

assert.equal(startAbearcMultiMeasurementMode('area'), true);
assert.equal(abearcMapMeasurements.length, 1, 'first completed distance is retained');
assert.equal(abearcMapMeasurements[0].mode, 'distance');
assert.equal(abearcMapMeasureMode, 'area');
assert.equal(abearcMapMeasurePoints.length, 0);
abearcMapMeasurePoints = [[125,7],[125.002,7],[125.002,7.002]];
const distanceId = abearcMapMeasurements[0].id;
assert.equal(selectAbearcMapMeasurement(distanceId), true);
assert.equal(abearcMapMeasureMode, 'distance', 'selected distance becomes active adapter');
assert.equal(abearcMapMeasurePoints.length, 2);
assert.equal(abearcMapMeasurements.length, 1, 'the area is retained when switching back');
const saved = captureAbearcMultiMeasurementState();
assert.equal(saved.inactive.length, 1);
assert.equal(saved.active.mode, 'distance');
resetAbearcMultiMeasurementCollection();
assert.equal(abearcMapMeasurements.length, 0);
assert.equal(restoreAbearcMultiMeasurementState(saved, {skipRender:true}), true);
assert.equal(abearcMapMeasurements.length, 1);
assert.equal(abearcMapMeasureMode, 'distance');
finishAbearcMapMeasurement();
assert.equal(abearcMapMeasurements.length, 2, 'finish preserves the completed measurement');
assert.equal(abearcMapMeasureMode, 'off', 'finish stops adding points');
startAbearcMultiMeasurementMode('area');
abearcMapMeasurePoints = [[125,7]];
finishAbearcMapMeasurement();
assert.equal(abearcMapMeasureMode, 'area', 'incomplete areas cannot finish');
cancelAbearcMapMeasurement();
assert.equal(abearcMapMeasureMode, 'off');
assert.equal(abearcMapMeasurements.length, 2, 'cancel preserves other measurements');
renameAbearcMapMeasurement(abearcMapMeasurements[0].id, '  Site boundary  ');
assert.equal(abearcMapMeasurements[0].name, 'Site boundary');
`, context);

console.log('Multi-measure check passed: completed measurements persist, new drawings do not replace them, selection swaps the legacy active adapter, and state restores.');
