const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/12-abearc-map.js'), 'utf8');
const render = source.slice(source.indexOf('    function renderAbearcMapMeasure()'), source.indexOf('    function renderAbearcMapMeasureAnnotations('));
const element = () => ({ children: [], attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, appendChild(child) { this.children.push(child); }, addEventListener() {} });
const svg = element();
let checks = 0, labels = 0, active = true;
const points = Array.from({ length: 5000 }, (_, i) => [125 + i / 100000, 7]);
const context = vm.createContext({
  document: { getElementById: () => svg, createElementNS: element },
  window: { isGeneratedAbearcGravityPath() { checks++; return active; }, abearcGravityPathEndIndex: () => points.length - 1 },
  abearcMap: { project: p => ({ x: p[0], y: p[1] }), getCanvasContainer: () => ({ clientWidth: 1000, clientHeight: 800 }) },
  abearcMapMeasurePoints: points, abearcMapMeasureMode: 'distance',
  abearcMapHiddenMeasurePointIndexes: new Set(points.map((_, i) => i).slice(1, -1)),
  abearcMapImportedPolygons: [], abearcMapContourData: null, abearcMapLastTouchedMeasureIndex: 4999,
  updateAbearcMapMeasureTools() {}, refreshAbearcElevationProfile() {}, renderAbearcMapPhotoAnnotations() {},
  renderAbearcMapContours() {}, renderAbearcMapMeasureAnnotations() {},
  addAbearcMeasurePointFromOverlay() {}, forwardAbearcMapWheelFromOverlay() {}, openAbearcMapMeasureContextMenu() {},
  startAbearcMeasureDrag() {}, deleteAbearcMeasurePoint() {}, openAbearcMapMeasurePointContextMenu() {},
  abearcMeasurePathDistance: () => 5000, formatAbearcDistance: value => `${value} m`, haversineMetres: () => 1,
  addMeasureLabel() { labels++; }
});
vm.runInContext(render, context);
context.renderAbearcMapMeasure();
assert.equal(checks, 1, 'dense gravity paths must be checked once per redraw, not once per vertex');
assert.equal(labels, 1, 'gravity path keeps its total label without thousands of segment labels');
assert.deepEqual(svg.children.filter(el => el.attributes.class?.includes('abearc-map-measure-point')).map(el => el.attributes['data-measure-point-index']), [0, points.length - 1], 'generated routes retain only start and end markers');
assert.equal(svg.children.filter(el => el.attributes.points).length, 2);
assert.equal(svg.children.find(el => el.attributes.class === 'abearc-map-measure-line').attributes.points.split(' ').length, points.length, 'full validated path geometry is retained');
active = false; checks = 0; labels = 0;
context.abearcMapMeasurePoints = points.slice(0, 3);
context.renderAbearcMapMeasure();
assert.equal(checks, 1);
assert.equal(labels, 3, 'ordinary distance measurements retain segment labels');
console.log('Gravity redraw check passed: one route check, full geometry, normal measurement labels preserved.');

const gravity = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/19-map-gravity-path.js'), 'utf8');
vm.runInContext(`let abearcMapGravityPathMeta = null; const ABEARC_GRAVITY_ASCENT_TOLERANCE_M = 0.05;\n${gravity.slice(gravity.indexOf('function abearcGravityGeometryKey('), gravity.indexOf('function abearcGravitySourceLabel('))}`, context);
vm.runInContext(`restoreAbearcGravityPathState({ geometryKey: abearcGravityGeometryKey(), sourceKey: 'namria-dtm5-prs92' });`, context);
assert.equal(context.isAbearcGravityPathActive(), true);
context.abearcMapMeasurePoints = context.abearcMapMeasurePoints.map(point => [...point]);
context.abearcMapMeasurePoints[1][0] += 0.001;
assert.equal(context.isAbearcGravityPathActive(), false, 'edited geometry must lose its original terrain validation');
assert.equal(context.isGeneratedAbearcGravityPath(), true, 'edited routes retain total-only presentation');
const saved = context.captureAbearcGravityPathState();
context.restoreAbearcGravityPathState(null);
assert.equal(context.isGeneratedAbearcGravityPath(), false);
context.restoreAbearcGravityPathState(saved);
assert.equal(context.isGeneratedAbearcGravityPath(), true, 'route presentation survives save/restore');
assert.equal(context.isAbearcGravityPathActive(), false, 'restore must not revalidate edited geometry');
console.log('Edited gravity route check passed: appearance persists while terrain validation is invalidated.');

context.window.isGeneratedAbearcGravityPath = context.isGeneratedAbearcGravityPath;
context.window.abearcGravityPathEndIndex = context.abearcGravityPathEndIndex;
context.window.adjustAbearcGravityPathEndpoint = context.adjustAbearcGravityPathEndpoint;
context.rememberAbearcMapMeasureState = () => {};
context.saveAbearcMapMeasure = () => {};
context.abearcMapElevationAnnotations = new Map();
context.abearcMapMeasurePoints = points.slice(0, 6).map(point => [...point]);
context.abearcMapHiddenMeasurePointIndexes = new Set([1, 2, 3, 4]);
context.abearcMapLastTouchedMeasureIndex = 5;
vm.runInContext(`restoreAbearcGravityPathState({ geometryKey: abearcGravityGeometryKey() });`, context);
vm.runInContext(source.slice(source.indexOf('    function insertAbearcMeasurePoint('), source.indexOf('    function addAbearcMeasurePoint(')), context);
vm.runInContext(source.slice(source.indexOf('    function removeAbearcMeasurePointAt('), source.indexOf('    function measurePointAtEvent(')), context);
vm.runInContext(source.slice(source.indexOf('    function deleteAbearcMeasurePoint(event,'), source.indexOf('    function openAbearcMapMeasurePointContextMenu(')), context);
const markerIndexes = () => svg.children.filter(el => el.attributes.class?.includes('abearc-map-measure-point')).map(el => el.attributes['data-measure-point-index']);
svg.children = []; labels = 0;
context.insertAbearcMeasurePoint([125.1, 7]);
assert.deepEqual(markerIndexes(), [0, 5, 6], 'manual extension adds a third visible marker without moving the generated endpoint');
assert.equal(labels, 1);
svg.children = [];
context.deleteAbearcMeasurePoint({ preventDefault() {}, stopPropagation() {} }, 5);
assert.deepEqual(markerIndexes(), [0, 4, 5], 'double-click deletion retreats to the previous hidden generated point and retains extension');
assert.equal(context.abearcMapMeasurePoints.length, 6);
svg.children = [];
context.deleteAbearcMeasurePoint({ preventDefault() {}, stopPropagation() {} }, 4);
assert.deepEqual(markerIndexes(), [0, 3, 4], 'repeated deletion continues retreating through the generated route');
const extended = context.captureAbearcGravityPathState();
context.restoreAbearcGravityPathState(extended);
assert.equal(context.abearcGravityPathEndIndex(), 3, 'edited generated endpoint survives save and restore');
console.log('Gravity endpoint edit check passed: manual extension marker, double-click retreat, repeated retreat and persistence.');
