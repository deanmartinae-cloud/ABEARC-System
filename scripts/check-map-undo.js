const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src/frontend/scripts', name), 'utf8');
const map = read('12-abearc-map.js'), layouts = read('16-map-layouts.js'), print = read('15-map-print.js');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

async function main() {
  await vm.runInNewContext(`(async () => {
    const abearcMapViewUndoStack = [], abearcMapMeasureUndoStack = [];
    let abearcMapUndoOrder = 0, abearcMapRestoringView = false, abearcMapLayoutRestoring = false;
    let abearcMapLayoutHistoryBatch = null, abearcMapHistoryGesture = null;
    let abearcMapSavedPhotoIds = new Set([1]), abearcMapPhotoSelectionMode = true;
    const abearcMapSelectedPhotoIds = new Set([1, 2]);
    const abearcMapMovedPhotoPositions = new Map(), abearcMapMovedPhotoSizes = new Map(), abearcMapExpandedPhotos = new Map(), abearcMapPhotoAnnotations = new Map(), abearcMapSessionHiddenPhotoIds = new Set();
    let abearcMapExploded = null, abearcMapFeatures = [{ id: 1 }, { id: 2 }], abearcMapLayoutFrozenPhotoIds = null;
    let abearcMapContourData = { paths: [] }, abearcMapContourAbort = null, abearcMapContourRequestId = 0;
    let abearcMapAbort = null, abearcMapReloadTimer = null;
    let abearcMapCommittedFilters = { category: 'Before' }, abearcMapCommittedSearch = '';
    let abearcMapActiveLayoutId = 7, abearcMapActiveLayoutRecord = { name: 'Original' }, abearcMapActiveLayoutState = {};
    let camera = { center: [125, 7], zoom: 10, bearing: 0, pitch: 0, padding: {} };
    let layout = { layers: { basemap: 'satellite' }, photos: { filters: { category: 'After' } } }, fail = false, error = '', persisted = '';
    const window = { cancelAbearcSaltRequest() {} };
    const abearcMap = { getCenter: () => ({ toArray: () => [...camera.center] }), getZoom: () => camera.zoom, getBearing: () => camera.bearing, getPitch: () => camera.pitch, getPadding: () => camera.padding, stop() {}, jumpTo(value) { camera = value; rememberAbearcMapView(); }, getSource: () => ({ setData() {} }) };
    const captureAbearcMapLayoutState = () => structuredClone(layout);
    async function restoreAbearcMapLayoutState(value, features) { if (fail) throw new Error('Restore failed'); await Promise.resolve(); layout = structuredClone(value); abearcMapFeatures = features; }
    const abearcMapScopedFeatures = () => abearcMapFeatures;
    function persistAbearcMapSavedPhotoIds() { persisted = JSON.stringify([...abearcMapSavedPhotoIds]); }
    function resetAbearcMapThumbnailMoves() { abearcMapMovedPhotoPositions.clear(); }
    function collapseAbearcMapExplosion() { abearcMapExploded = null; }
    function renderAbearcMapPhotoMarkers() {} function renderAbearcMapExplosion() {} function renderAbearcMapList() {} function syncAbearcMapRail() {} function renderAbearcMapMeasure() {} function renderAbearcMapLayouts() {}
    function toast(message) { error = message; }
    function undoAbearcMapMeasureChange() { abearcMapMeasureUndoStack.pop(); }
    ${between(map, '    function rememberAbearcMapView()', '    function fitAbearcMapToDavaoCity()')}
    ${between(layouts, '    function rememberAbearcMapLayoutChange()', '    // One slider drag')}
    ${between(map, '    function toggleAbearcSavedPhoto(', '    async function downloadAbearcGeoCamApp(')}
    let abearcMapPhotoScope = 'all';
    toggleAbearcSavedPhoto(1);
    assert.equal(abearcMapSavedPhotoIds.has(1), false);
    await undoAbearcMapChange();
    assert.equal(persisted, '[1]', 'Save/Unsave undo persists its restored state');
    const entry = rememberAbearcMapLayoutChange();
    layout.layers.basemap = 'terrain';
    assert.equal(rememberAbearcMapLayoutChange(), entry, 'Nested changes share an undo step');
    assert.equal(abearcMapViewUndoStack.length, 1);
    assert.equal(entry.layout.photos.filters.category, 'Before', 'A changed filter control must snapshot the previously applied value');
    await Promise.resolve();
    abearcMapMeasureUndoStack.push({ undoOrder: ++abearcMapUndoOrder });
    await undoAbearcMapChange();
    assert.equal(layout.layers.basemap, 'terrain', 'Newest measurement edits undo before older layout edits');
    assert.equal(abearcMapViewUndoStack.length, 1);
    await undoAbearcMapChange();
    assert.equal(layout.layers.basemap, 'satellite');
    assert.equal(abearcMapLayoutFrozenPhotoIds, null, 'Undo must not freeze a previously live map');
    assert.equal(abearcMapSelectedPhotoIds.size, 2);
    assert.equal(abearcMapViewUndoStack.length, 0, 'Restoration must not create history');
    abearcMapHistoryGesture = {};
    rememberAbearcMapLayoutChange();layout.layers.basemap = 'terrain';await Promise.resolve();
    rememberAbearcMapLayoutChange();layout.layers.basemap = 'topo';await Promise.resolve();
    assert.equal(abearcMapViewUndoStack.length, 1, 'A slider gesture is one undo step');
    abearcMapHistoryGesture = null;
    fail = true;await undoAbearcMapChange();
    assert.equal(abearcMapViewUndoStack.length, 1, 'A failed restore retains the undo entry');
    assert.match(error, /Restore failed/);assert.equal(abearcMapRestoringView, false);
    fail = false;await undoAbearcMapChange();assert.equal(layout.layers.basemap, 'satellite');
  })()`, { assert, structuredClone, queueMicrotask, clearTimeout });

  vm.runInNewContext(`
    const controls = [{name:'title',value:'Original',checked:false,dataset:{}},{name:'paper',value:'A4',checked:false,dataset:{}}];
    let camera = {center:[125,7],zoom:10,bearing:0,pitch:0};
    const s = { photos:[{dx:0,dy:0,w:72,h:72,hidden:false}], undo:[], el:{querySelectorAll:()=>controls,querySelector:()=>({disabled:true})}, map:{getCenter:()=>({toArray:()=>camera.center}),getZoom:()=>camera.zoom,getBearing:()=>camera.bearing,getPitch:()=>camera.pitch,jumpTo:value=>{camera=value;}} };
    function finish() {} function dimensions() {} function schedule() {}
    ${between(print, '  function captureEdit(', '  function checked(')}
    s.lastEdit=captureEdit(s);
    s.photos[0].hidden=true;controls[0].value='Changed';camera.zoom=15;commitEdit(s);
    assert.equal(s.undo.length,1);commitEdit(s);assert.equal(s.undo.length,1,'Unchanged renders do not add history');
    undoEdit(s);assert.equal(s.photos[0].hidden,false);assert.equal(controls[0].value,'Original');assert.equal(camera.zoom,10);
  `, { assert });
  console.log('Map undo check passed: saved status, chronological history, filters, grouped controls, failure recovery and print edits.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
