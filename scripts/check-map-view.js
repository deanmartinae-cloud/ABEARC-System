const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/12-abearc-map.js'), 'utf8');
const start = source.indexOf('    function rememberAbearcMapView()');
const end = source.indexOf('    function fitAbearcMapToDavaoCity()', start);
assert(start >= 0 && end > start);
const context = vm.createContext({ assert, structuredClone });
vm.runInContext(`
  const abearcMapViewUndoStack = [], abearcMapMeasureUndoStack = [];
  let abearcMapUndoOrder = 0, abearcMapRestoringView = false;
  let abearcMapLayoutHistoryBatch = null, abearcMapSavedPhotoIds = new Set([1]), abearcMapPhotoSelectionMode = false;
  const abearcMapSelectedPhotoIds = new Set();
  let abearcMapExploded = { persistent: true, features: [{ id: 1 }] };
  const abearcMapMovedPhotoPositions = new Map([[1, [125, 7]]]);
  const abearcMapExpandedPhotos = new Map([[1, { width: 260, height: 180 }]]);
  const abearcMapPhotoAnnotations = new Map([[1, { text: 'Inspection', mapDx: 22, mapDy: -42 }]]);
  const abearcMapFixedPhotoScreenPositions = new Map();
  const abearcMapMovedPhotoSizes = new Map();
  const abearcMapSessionHiddenPhotoIds = new Set();
  const abearcMapConfig = { defaultCenter: [125.6, 7.1], defaultZoom: 11 };
  let camera = { center: [125, 7], zoom: 18, bearing: 45, pitch: 30, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  let measurementUndone = false;
  const abearcMap = {
    getCenter: () => ({ toArray: () => camera.center.slice() }),
    getZoom: () => camera.zoom, getBearing: () => camera.bearing,
    getPitch: () => camera.pitch, getPadding: () => ({ ...camera.padding }),
    stop() {}, jumpTo(value) { rememberAbearcMapView(); camera = value; }
  };
  function resetAbearcMapThumbnailMoves() { abearcMapMovedPhotoPositions.clear(); }
  function collapseAbearcMapExplosion() { abearcMapExploded = null; }
  function closeAbearcMapDetails() {}
  function renderAbearcMapPhotoMarkers() {}
  function renderAbearcMapExplosion() {}
  function persistAbearcMapSavedPhotoIds() {}
  function renderAbearcMapList() {}
  function syncAbearcMapRail() {}
  function toast(message) { throw new Error(message); }
  function undoAbearcMapMeasureChange() { abearcMapMeasureUndoStack.pop(); measurementUndone = true; }
  ${source.slice(start, end)}
  resetAbearcMapChanges();
  assert.equal(camera.zoom, 18);
  assert.equal(camera.center[0], 125);
  assert.equal(camera.center[1], 7);
  assert.equal(camera.bearing, 45);
  assert.equal(camera.pitch, 30);
  assert.equal(abearcMapMovedPhotoPositions.size, 0);
  assert.equal(abearcMapExpandedPhotos.size, 0);
  assert.equal(abearcMapPhotoAnnotations.size, 0);
  assert.equal(abearcMapExploded, null);
  assert.equal(abearcMapViewUndoStack.length, 1);
  undoAbearcMapChange();
  assert.equal(camera.zoom, 18);
  assert.equal(camera.bearing, 45);
  assert.equal(camera.pitch, 30);
  assert.equal(abearcMapMovedPhotoPositions.get(1)[0], 125);
  assert.equal(abearcMapExpandedPhotos.get(1).width, 260);
  assert.equal(abearcMapPhotoAnnotations.get(1).text, 'Inspection');
  assert.equal(abearcMapExploded.persistent, true);
  assert.equal(abearcMapViewUndoStack.length, 0);
  rememberAbearcMapView();
  abearcMapSavedPhotoIds.delete(1);
  camera.zoom = 19;
  abearcMapMeasureUndoStack.push({ undoOrder: ++abearcMapUndoOrder });
  undoAbearcMapChange();
  assert.equal(measurementUndone, true);
  assert.equal(camera.zoom, 19);
  undoAbearcMapChange();
  assert.equal(camera.zoom, 18);
  assert.equal(abearcMapSavedPhotoIds.has(1), true, 'Undo restores saved membership');
`, context);
const explosionSource = source.slice(source.indexOf('    function explodeAbearcPhotoGroup('), source.indexOf('    function rectForExplosionPoint('));
const collapseSource = source.slice(source.indexOf('    function finishAbearcMapExplosionCollapse('), source.indexOf('    async function openAbearcMapDetails('));
vm.runInNewContext(`
  let abearcMapExploded = null, abearcMapExplosionCollapseTimer = null, timer = null;
  const abearcMapSelectedPhotoId = null;
  const abearcMapConfig = { explosion: { maxVisiblePhotos: 20 } };
  const abearcMap = { getZoom: () => 18 };
  const abearcFeatureId = feature => feature.id;
  const document = { getElementById: () => ({ innerHTML: '', classList: { remove() {} }, querySelector: () => ({}) }) };
  function setTimeout(callback) { timer = callback; return 1; }
  function clearTimeout() { timer = null; }
  function closeAbearcMapPhotoContextMenu() {}
  function renderAbearcMapPhotoMarkers() {}
  function renderAbearcMapExplosion() {}
  const photos = ids => ids.map(id => ({ id, geometry: { coordinates: [125, 7] } }));
  ${explosionSource}
  ${collapseSource}
  explodeAbearcPhotoGroup(photos([1, 2]), [125, 7], { persistent: true });
  explodeAbearcPhotoGroup(photos([3, 4]), [126, 8], { persistent: true });
  explodeAbearcPhotoGroup(photos([5, 6]), [127, 9], { collapseOnAltRelease: true });
  assert.equal(abearcMapExploded.features.length, 6);
  collapseAbearcMapExplosion({ reason: 'collapseOnAltRelease' });
  assert.equal(abearcMapExploded.collapsingIds.size, 2);
  assert.equal(abearcMapExploded.collapsingIds.has(1), false);
  assert.equal(abearcMapExploded.features.length, 6, 'Photos remain during the collapse animation');
  timer();
  assert.equal(abearcMapExploded.features.length, 4);
  assert.equal(abearcMapExploded.groups.length, 2);
  collapseAbearcMapExplosion({ featureId: 1 });
  assert.equal(abearcMapExploded.collapsingIds.has(2), true);
  assert.equal(abearcMapExploded.collapsingIds.has(3), false);
  timer();
  assert.equal(abearcMapExploded.features.length, 2);
  assert.equal(abearcMapExploded.features[0].id, 3);
  assert.equal(abearcMapExploded.persistent, true);
  collapseAbearcMapExplosion({ animate: false });
  assert.equal(abearcMapExploded, null);
`, { assert });
const boxSource = source.slice(source.indexOf('    function abearcMapPhotoIdsInBox('), source.indexOf('    function syncAbearcMapPhotoSelection('));
vm.runInNewContext(`
  let abearcMapPhotosVisible = true, abearcMapPhotoSelectionMode = false;
  const abearcMapSelectedPhotoIds = new Set();
  const abearcMapMovedPhotoPositions = new Map([[4, [90, 90]]]);
  const abearcMapExploded = { features: [{ id: 5 }] };
  const abearcMapResultSingleClickTimer = null;
  let detailsClosed = 0, zoomCalls = 0;
  const abearcFeatureId = feature => feature.id;
  const abearcMapVisibleListFeatures = () => [
    { id: 1, geometry: { coordinates: [20, 20] } },
    { id: 2, geometry: { coordinates: [80, 80] } },
    { id: 3, geometry: { coordinates: [85, 85] } },
    { id: 4, geometry: { coordinates: [20, 20] } },
    { id: 5, geometry: { coordinates: [80, 80] } }
  ];
  const abearcMap = {
    project: ([x, y]) => ({ x, y }),
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 100, top: 200 }) }),
    getBearing: () => 30,
    fitScreenCoordinates(start, end, bearing) { assert.equal(bearing, 30); zoomCalls++; }
  };
  const marker = (dataset, x, y) => ({ dataset, getBoundingClientRect: () => ({ left: x + 95, right: x + 105, top: y + 195, bottom: y + 205 }) });
  const document = { querySelectorAll: () => [marker({ mapPhotoIds: '2,3' }, 30, 30), marker({ mapPhotoIds: '4' }, 90, 90), marker({ mapPhotoId: '5' }, 40, 40)] };
  function closeAbearcMapDetails() { detailsClosed++; }
  function closeAbearcMapPhotoContextMenu() {}
  function renderAbearcMapList() {}
  ${boxSource}
  handleAbearcMapPhotoBoxZoom(abearcMap, { x: 50, y: 50 }, { x: 10, y: 10 });
  assert.equal([...abearcMapSelectedPhotoIds].sort().join(','), '1,2,3,5');
  assert.equal(abearcMapPhotoSelectionMode, true);
  assert.equal(detailsClosed, 1);
  assert.equal(zoomCalls, 0, 'Selecting photos must preserve the map view');
  handleAbearcMapPhotoBoxZoom(abearcMap, { x: 110, y: 110 }, { x: 120, y: 120 });
  assert.equal(abearcMapSelectedPhotoIds.size, 0);
  assert.equal(abearcMapPhotoSelectionMode, false);
  assert.equal(zoomCalls, 1, 'An empty selection must still zoom to the box');
  abearcMapPhotosVisible = false;
  assert.equal(abearcMapPhotoIdsInBox({ x: 0, y: 0 }, { x: 100, y: 100 }).size, 0);
`, { assert });
const ctrlSelectionSource = source.slice(source.indexOf('    function toggleAbearcMapPhotoGroupSelection('), source.indexOf('    function toggleAbearcMapPhotoSelection('));
vm.runInNewContext(`
  let abearcMapResultSingleClickTimer = null, abearcMapPhotoSelectionMode = false, abearcMapSelectedPhotoId = 1;
  const abearcMapSelectedPhotoIds = new Set();
  function closeAbearcMapDetails() { abearcMapSelectedPhotoId = null; }
  function closeAbearcMapPhotoContextMenu() {}
  function renderAbearcMapList() {}
  ${ctrlSelectionSource}
  toggleAbearcMapPhotoGroupSelection([2]);
  assert.equal([...abearcMapSelectedPhotoIds].join(','), '1,2');
  assert.equal(abearcMapSelectedPhotoId, null);
  toggleAbearcMapPhotoGroupSelection([2, 3]);
  assert.equal([...abearcMapSelectedPhotoIds].join(','), '1,2,3');
  toggleAbearcMapPhotoGroupSelection([2, 3]);
  assert.equal([...abearcMapSelectedPhotoIds].join(','), '1');
  toggleAbearcMapPhotoGroupSelection([1]);
  assert.equal(abearcMapSelectedPhotoIds.size, 0);
  assert.equal(abearcMapPhotoSelectionMode, false);
`, { assert });
const movedSizeSource = source.slice(source.indexOf('    function abearcMapPhotoWorldSize()'), source.indexOf('    function applyAbearcMapMovedPhotoScale('));
const moveSource = source.slice(source.indexOf('    function beginAbearcMapThumbnailMove('), source.indexOf('    function resetAbearcMapThumbnailMoves('));
vm.runInNewContext(`
  const abearcMapMovedPhotoPositions = new Map(), abearcMapPhotoMarkers = new Map();
  const abearcMapMovedPhotoSizes = new Map();
  const abearcMapPhotoDragBindings = new Map(), abearcMapPhotoSuppressOpenUntil = new Map();
  let abearcMapThumbnailMoveId = null, abearcMapExploded = null, remembered = 0;
  const features = new Map([[1, { geometry: { coordinates: [10, 20] } }], [2, { geometry: { coordinates: [30, 40] } }]]);
  const featureById = id => features.get(id);
  const abearcMap = { getZoom: () => 12, project: p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.lng, y: p.lat }, unproject: p => ({ lng: p.x, lat: p.y }) };
  function rememberAbearcMapView() { remembered++; }
  function closeAbearcMapPhotoContextMenu() {}
  function finishAbearcMapThumbnailMoveMode() { abearcMapThumbnailMoveId = null; }
  function renderAbearcMapMovedPhotoLeaders() {}
  function toast() {}
  ${movedSizeSource}
  function renderAbearcMapPhotoMarkers() {
    abearcMapMovedPhotoPositions.forEach(([lng, lat], id) => {
      const marker = { point: { lng, lat }, callbacks: {}, getLngLat() { return this.point; },
        setLngLat(p) { this.point = p; }, on(name, fn) { this.callbacks[name] = fn; },
        setDraggable() {}, getElement: () => ({ classList: { add() {} } }) };
      abearcMapPhotoMarkers.set('photo:' + id, marker);
    });
  }
  ${moveSource}
  beginAbearcMapThumbnailMove([1, 2]);
  assert.equal(abearcMapPhotoDragBindings.size, 2, 'Every selected thumbnail must be draggable');
  const driver = abearcMapPhotoMarkers.get('photo:2');
  driver.point = { lng: 35, lat: 47 };
  driver.callbacks.drag();
  assert.equal(abearcMapMovedPhotoPositions.get(1).join(','), '15,27');
  assert.equal(abearcMapMovedPhotoPositions.get(2).join(','), '35,47');
  assert.equal(features.get(2).geometry.coordinates.join(','), '30,40', 'Moving thumbnails must preserve GPS coordinates');
  driver.callbacks.dragend();
  assert.equal(abearcMapThumbnailMoveId, null);
  assert.equal(abearcMapPhotoSuppressOpenUntil.size, 2);
  assert.equal(remembered, 1, 'A group move is one undo action');
`, { assert });

const photoScaleHelpers = source.slice(source.indexOf('    function abearcMapPhotoWorldSize()'), source.indexOf('    function abearcPhotoMarkerElement('));
vm.runInNewContext(`
  let zoom = 18;
  const abearcMapMovedPhotoSizes = new Map();
  const frame = { style: {}, getBoundingClientRect: () => ({ left: 320, top: 210, width: Number.parseFloat(frame.style.width) || 44, height: Number.parseFloat(frame.style.height) || 44 }) };
  const element = { style: {}, querySelector: () => frame };
  const marker = { getElement: () => element };
  const abearcMapPhotoMarkers = new Map([['photo:7', marker]]);
  const leaders = { getBoundingClientRect: () => ({ left: 100, top: 50 }) };
  const abearcMap = { getZoom: () => zoom };
  ${photoScaleHelpers}
  ensureAbearcMapMovedPhotoSize(7, 44, 44);
  applyAbearcMapMovedPhotoScale(element, 7);
  assert.equal(Number.parseFloat(frame.style.width), 44);
  zoom = 17;
  applyAbearcMapMovedPhotoScale(element, 7);
  assert.equal(Number.parseFloat(frame.style.width), 22, 'Moved thumbnail must shrink by map zoom, not stay fixed in pixels.');
  zoom = 19;
  applyAbearcMapMovedPhotoScale(element, 7);
  assert.equal(Number.parseFloat(frame.style.width), 88, 'Moved thumbnail must grow again when zooming back in.');
  frame.style.width = '100px'; frame.style.height = '60px';
  const center = abearcMapPhotoFrameCenter(7, leaders);
  assert.equal(center.x, 270);
  assert.equal(center.y, 190, 'Leader endpoint must target the rendered photo center.');
`, { assert });
const annotationSource = source.slice(source.indexOf('    function annotateAbearcMapPhotos('), source.indexOf('    function applyAbearcMapSelectedPhotoLayout('));
vm.runInNewContext(`
  const abearcMapPhotoAnnotations = new Map(), abearcMapSessionHiddenPhotoIds = new Set();
  let abearcMapPhotosVisible = true, abearcMapThumbnailContextId = 1, save, initial, renders = 0, remembered = 0;
  const features = [1, 2, 3].map(id => ({ id, properties: { category: 'Site ' + id }, geometry: { coordinates: [id * 10, 20] } }));
  const featureById = id => features.find(f => f.id === id);
  const abearcFeatureId = f => f.id;
  const abearcMapScopedFeatures = () => features;
  const abearcMap = { project: ([x, y]) => ({ x, y }) };
  const abearcMapPhotoFrameCenter = () => null;
  let renderedIds = [];
  const svg = { clientWidth: 500, clientHeight: 300, querySelector: () => null, appendChild() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const document = { getElementById: () => svg, querySelector: () => null, createElementNS: () => ({ setAttribute() {} }) };
  function renderAbearcMapMeasureAnnotations(group, points, width, height, photos) { assert.equal(photos, true); renderedIds = Object.keys(points); renders++; }
  function closeAbearcMapPhotoContextMenu() { abearcMapThumbnailContextId = null; }
  function closeAbearcMapListContextMenu() {}
  function rememberAbearcMapView() { remembered++; }
  function openAbearcMapEditModal(field, value, callback) { assert.equal(field, 'photo-annotation'); initial = value; save = callback; }
  ${annotationSource}
  annotateAbearcMapPhotos();
  assert.equal(initial, 'Site 1', 'New annotations default to the photo classification/name');
  save('  Inspection  ');
  assert.equal(abearcMapPhotoAnnotations.get(1).text, 'Inspection');
  abearcMapPhotoAnnotations.get(1).mapDx = 90;
  const selection = [1, 2, 2, 999];
  annotateAbearcMapPhotos(selection);
  selection.length = 0;
  save('Shared label');
  assert.equal(abearcMapPhotoAnnotations.size, 2);
  assert.equal(abearcMapPhotoAnnotations.get(1).mapDx, 90);
  assert.equal(abearcMapPhotoAnnotations.get(2).text, 'Shared label');
  assert.equal(remembered, 2, 'Bulk annotation should be one undo step');
  assert.equal(renderedIds.join(','), '1,2');
  abearcMapSessionHiddenPhotoIds.add(1);
  renderAbearcMapPhotoAnnotations();
  assert.equal(renderedIds.join(','), '2');
  annotateAbearcMapPhotos([1, 2]);
  assert.equal(initial, 'Shared label');
  save(' ');
  assert.equal(abearcMapPhotoAnnotations.size, 0);
  annotateAbearcMapPhotos([1, 2]);
  save(initial);
  assert.equal(abearcMapPhotoAnnotations.get(1).text, 'Site 1');
  assert.equal(abearcMapPhotoAnnotations.get(2).text, 'Site 2', 'Bulk defaults keep each photo classification/name');
  annotateAbearcMapPhotos([1]);
  save('Custom label');
  annotateAbearcMapPhotos([1]);
  assert.equal(initial, 'Custom label', 'Editing preserves the existing annotation');
`, { assert });
const saveSelectionSource = source.slice(source.indexOf('    function saveSelectedAbearcMapPhotos('), source.indexOf('    function renameSelectedAbearcMapPhotos('));
const removeSavedSource = source.slice(source.indexOf('    function removeAbearcSavedPhotoIds('), source.indexOf('    function showAbearcGeotagPhotos('));
const toggleSavedSource = source.slice(source.indexOf('    function toggleAbearcSavedPhoto('), source.indexOf('    async function downloadAbearcGeoCamApp('));
const selectionToolbarSource = source.slice(source.indexOf('    function updateAbearcMapPhotoSelectionToolbar('), source.indexOf('    function closeAbearcMapResultsActionMenu('));
vm.runInNewContext(`
  const abearcMapSelectedPhotoIds = new Set([1, 2]);
  const abearcMapSavedPhotoIds = new Set([1, 3]);
  let abearcMapPhotoScope = 'all', refreshed = 0, persisted;
  const localStorage = { setItem(key, value) { persisted = value; } };
  function persistAbearcMapSavedPhotoIds() { persisted = JSON.stringify([...abearcMapSavedPhotoIds]); }
  function syncAbearcMapRail() {}
  function renderAbearcMapList() {}
  function refreshAbearcMapPhotoScope() { refreshed++; }
  function toast() {}
  function rememberAbearcMapView() {}
  const saveButton = { setAttribute(name, value) { this[name] = value; } };
  const toolbar = { classList: { toggle() {} }, querySelector: selector => selector === '[data-map-selection-save]' ? saveButton : null, querySelectorAll: () => [saveButton] };
  const document = { querySelector: () => toolbar };
  const abearcMapPhotoSelectionMode = true;
  function syncAbearcMapPhotoSelection() {}
  const featureById = id => ({ id });
  const canManageAbearcMapPhoto = () => true, canDeleteAbearcMapPhoto = () => true;
  const isProjectDocumentLinkedMapPhoto = () => false, selectableAbearcMapPhotoIds = () => [1, 2];
  ${selectionToolbarSource}
  ${removeSavedSource}
  ${saveSelectionSource}
  ${toggleSavedSource}
  updateAbearcMapPhotoSelectionToolbar();
  assert.equal(saveButton.textContent, 'Save');
  saveSelectedAbearcMapPhotos();
  assert.equal(abearcMapSavedPhotoIds.has(1), true, 'Mixed selections keep saved photos');
  assert.equal(abearcMapSavedPhotoIds.has(2), true, 'Mixed selections save remaining photos');
  updateAbearcMapPhotoSelectionToolbar();
  assert.equal(saveButton.textContent, 'Unsave');
  assert.equal(saveButton['aria-label'], 'Unsave selected photos');
  abearcMapPhotoScope = 'saved';
  saveSelectedAbearcMapPhotos();
  assert.equal([...abearcMapSavedPhotoIds].join(','), '3', 'Unsave only removes selected photos');
  assert.equal(persisted, '[3]');
  assert.equal(refreshed, 1, 'Unsave must update the Saved map scope');
  toggleAbearcSavedPhoto(1);
  assert.equal(abearcMapSavedPhotoIds.has(1), true);
  toggleAbearcSavedPhoto(1);
  assert.equal(abearcMapSavedPhotoIds.has(1), false);
  abearcMapSelectedPhotoIds.clear();
  updateAbearcMapPhotoSelectionToolbar();
  assert.equal(saveButton.disabled, true);
  saveSelectedAbearcMapPhotos(true);
  assert.equal(persisted, '[3]', 'An empty selection leaves saved photos unchanged');
`, { assert });
const photoMenuSource = source.slice(source.indexOf('    function openAbearcMapPhotoContextMenu('), source.indexOf('    function annotateAbearcMapPhotos('));
vm.runInNewContext(`
  const names = ['photo-expand', 'photo-collapse', 'photo-delete', 'cluster-explode', 'cluster-collapse', 'photo-save', 'photo-annotation-rename', 'photo-annotation-remove'];
  const buttons = names.map(name => ({ name, dataset: {}, textContent: '', querySelector() { return this; }, matches(selector) { return selector.includes('[data-map-' + name + ']'); }, classList: { hidden: false, add() { this.hidden = true; }, remove() { this.hidden = false; }, toggle(key, value) { this.hidden = value; } } }));
  const find = name => buttons.find(button => button.name === name);
  const menu = { style: {}, classList: { remove() {}, add() {} }, setAttribute() {}, querySelector: selector => buttons.find(button => selector === '[data-map-' + button.name + ']') || null, querySelectorAll: selector => selector === 'button' ? buttons : [], offsetWidth: 150, offsetHeight: 80 };
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 400 }) };
  const document = { querySelector: selector => selector === '[data-map-photo-context-menu]' ? menu : stage, querySelectorAll: () => [] };
  let abearcMapThumbnailContextId, renamed, remembered = 0, rendered = 0;
  const abearcMapExpandedPhotos = new Map(), abearcMapSavedPhotoIds = new Set();
  const abearcMapPhotoAnnotations = new Map([[1, { text: 'One' }], [2, { text: 'Two' }]]);
  const abearcMapExploded = null, abearcMapPhotoSelectionMode = true;
  const abearcMapSelectedPhotoIds = new Set([1, 2]);
  const featureById = id => ({ id }), abearcFeatureId = feature => feature.id;
  function closeAbearcMapMeasureContextMenu() {}
  function closeAbearcMapPhotoContextMenu() { abearcMapThumbnailContextId = null; }
  function rememberAbearcMapView() { remembered++; }
  function renderAbearcMapPhotoAnnotations() { rendered++; }
  function annotateAbearcMapPhotos(ids) { renamed = ids; }
  ${photoMenuSource}
  const event = { preventDefault() {}, stopPropagation() {}, clientX: 490, clientY: 390 };
  openAbearcMapPhotoContextMenu(event, 1, null, false, true);
  assert.equal(buttons.filter(button => !button.classList.hidden).map(button => button.name).join(','), 'photo-annotation-rename,photo-annotation-remove');
  find('photo-annotation-rename').onclick();
  assert.equal(renamed.join(','), '1', 'Rename targets the clicked annotation, even with multiple photos selected');
  find('photo-annotation-remove').onclick();
  assert.equal(abearcMapPhotoAnnotations.has(1), false);
  assert.equal(abearcMapPhotoAnnotations.has(2), true);
  assert.equal(remembered, 1, 'Removal must be undoable');
  assert.equal(rendered, 1);
  abearcMapSelectedPhotoIds.clear();
  openAbearcMapPhotoContextMenu(event, 2);
  assert.equal(find('photo-annotation-remove').classList.hidden, true, 'Annotation actions must not leak into photo menus');
`, { assert });
const annotationRenderSource = source.slice(source.indexOf('    function renderAbearcMapMeasureAnnotations('), source.indexOf('    function addMeasureLabel('));
vm.runInNewContext(`
  function node() {
    return { attrs: {}, children: [], listeners: {}, classList: { add() {}, remove() {} },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
      cloneNode() { const copy = node(); copy.attrs = { ...this.attrs }; return copy; },
      appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); this.children.push(child); child.parent = this; },
      set innerHTML(value) { this.appendChild(node()); }, querySelector() { return this.children[0]; },
      addEventListener(k, fn) { this.listeners[k] = fn; }, removeEventListener(k) { delete this.listeners[k]; }, setPointerCapture() {} };
  }
  const guideLayer = node(), labels = node();
  labels.getBoundingClientRect = () => ({ left: 0, top: 0 });
  const document = { createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 60 }) }) }), createElementNS: node, querySelector: () => guideLayer };
  const abearcMapPhotoAnnotations = new Map([[1, { text: 'Photo', mapDx: 22, mapDy: -42 }]]);
  const abearcMapBasemap = 'google-satellite', abearcMap = { dragPan: { disable() {}, enable() {} } };
  const esc = value => value;
  function rememberAbearcMapView() {}
  function closeAbearcMapMeasureContextMenu() {}
  ${annotationRenderSource}
  renderAbearcMapMeasureAnnotations(labels, { 1: { x: 100, y: 100 } }, 500, 400, true);
  assert.equal(guideLayer.children.length, 1);
  assert.equal(labels.children[0].children.length, 0, 'The guide line must leave the foreground label group');
  const label = labels.children[0], guide = guideLayer.children[0];
  assert.equal(guide.attrs.transform, label.attrs.transform);
  assert.equal(guide.attrs['data-photo-annotation-id'], undefined);
  label.listeners.pointerdown({ button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {} });
  label.listeners.pointermove({ clientX: 210, clientY: 160 });
  assert.equal(guide.attrs.transform, label.attrs.transform, 'The rear guide follows label dragging');
  assert.equal(guide.children[0].attrs.x1, '-110.0');
`, { assert });
console.log('Map view check passed, including rear annotation guides, annotation menus and Save/Unsave.');
