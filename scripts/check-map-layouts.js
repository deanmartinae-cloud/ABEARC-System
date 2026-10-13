const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const requireText = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};

const manifest = read('src/backend/manifest.json');
const migration = read('src/backend/migrations/20-map-layouts.migration.js');
const controller = read('src/backend/controllers/20-map-layouts.controller.js');
const routes = read('src/backend/routes/20-map-layouts.routes.js');
const startup = read('src/backend/startup/00-listen.startup.js');
const mediaService = read('src/backend/services/14-map-media.service.js');
const map = read('src/frontend/scripts/12-abearc-map.js');
const orthomosaic = read('src/frontend/scripts/14-map-orthomosaic.js');
const print = read('src/frontend/scripts/15-map-print.js');
const layouts = read('src/frontend/scripts/16-map-layouts.js');
const page = read('src/frontend/pages/map.page.html');
const head = read('src/frontend/layout/head.html');
const scriptManifest = read('src/frontend/script-manifest.json');
const build = read('scripts/build-frontend.js');

requireText(manifest, /20-map-layouts\.migration\.js[\s\S]+20-map-layouts\.controller\.js[\s\S]+20-map-layouts\.routes\.js/, 'Map Layouts backend modules are not wired into the runtime manifest.');
requireText(migration, /CREATE TABLE IF NOT EXISTS MapLayouts[\s\S]+owner_user_id INTEGER NOT NULL[\s\S]+state_json TEXT NOT NULL[\s\S]+idx_map_layouts_owner_updated/, 'MapLayouts migration is incomplete.');
requireText(startup, /ensureMapLayoutsMigration\(\)/, 'MapLayouts migration is not run at startup.');
['get', 'get', 'post', 'patch', 'delete'].forEach(method => requireText(routes, new RegExp(`app\\.${method}\\('\\/api\\/map\\/layouts`), `Missing ${method.toUpperCase()} Map Layouts route.`));
if ((routes.match(/requireMapMediaAccess/g) || []).length !== 5) throw new Error('Every Map Layouts route must require map access.');
requireText(controller, /WHERE owner_user_id=\?/, 'Map layout listing must be scoped to the signed-in user.');
requireText(controller, /WHERE id=\? AND owner_user_id=\?/, 'Map layout read/update/delete operations must be owner-scoped.');
requireText(controller, /MAP_LAYOUT_STATE_MAX_BYTES = 5 \* 1024 \* 1024/, 'Saved layout state needs a server-side size limit.');
requireText(controller, /queryActiveMapMediaRowsByIds\(frozenPhotoIds\)[\s\S]+photo_features/, 'Opening a layout must hydrate its exact saved photo IDs.');
requireText(mediaService, /queryActiveMapMediaRowsByIds[\s\S]+m\.map_status='active'[\s\S]+location_status IN \('valid','low_accuracy','manual_location'\)/, 'Saved layout photo hydration must respect active map-media visibility.');

requireText(page, /data-map-layouts-panel/, 'My Map Layouts drawer is missing.');
requireText(page, /data-map-layouts-toolbar/, 'My Map Layouts rail button is missing.');
if (!(page.indexOf('data-map-layouts-toolbar') < page.indexOf('data-map-orthomosaic-toolbar'))) throw new Error('My Map Layouts must appear before Drone Orthomaps in the map rail.');
requireText(head, /map-layouts\.css/, 'Map Layouts stylesheet is not linked.');
requireText(head, /map-print\.css/, 'Map Print stylesheet is not linked.');
requireText(scriptManifest, /15-map-print\.js[\s\S]+16-map-layouts\.js/, 'Map Print and Map Layouts scripts are not loaded in order.');
requireText(build, /pdf-lib[\s\S]+pdf-lib\.min\.js/, 'PDF export browser asset is not included in the frontend build.');

requireText(map, /abearcMapLayoutFrozenPhotoIds instanceof Set[\s\S]+return features\.filter/, 'Exact layout photo sets must override Saved/Mine scope.');
requireText(map, /background && abearcMapLayoutFrozenPhotoIds instanceof Set/, 'Background map sync must not replace a frozen layout photo snapshot.');
requireText(layouts, /camera:[\s\S]+layers:[\s\S]+photos:[\s\S]+measurements:[\s\S]+orthomosaics:/, 'Map layout capture is missing one or more primary workspace state groups.');
requireText(layouts, /frozenPhotoIds: scopedIds[\s\S]+hiddenPhotoIds[\s\S]+movedPhotos[\s\S]+movedPhotoSizes[\s\S]+expandedPhotos/, 'Photo composition state is incomplete, including map-relative moved-thumbnail size.');
requireText(layouts, /captureAbearcMapLayoutAnalysisState[\s\S]+contours:[\s\S]+paths/, 'Contour geometry is not preserved in saved layouts.');
requireText(layouts, /restoreAbearcMapLayoutState\(state = \{\}, frozenPhotoFeatures = null\)[\s\S]+photo_features|restoreAbearcMapLayoutState\(layout\.state, Array\.isArray\(layout\.photo_features\)/, 'Exact server-hydrated photo features are not used during layout restore.');
requireText(layouts, /ABEARC_MAP_LAYOUT_FILE_FORMAT = 'ABEARC_MAP_LAYOUT'[\s\S]+\.abmap/, '.abmap import is missing.');
assert(!/printAbearcMapLayout|Print \/ Export|openAbearcMapPrint|Update with current map/.test(layouts), 'Map layouts must not include print or bulk update actions.');
requireText(layouts, /exportAbearcMapLayout[\s\S]+\.abmap/, 'Layout file export must be available.');
const layoutPanel = page.slice(page.indexOf('<aside id="abearcMapLayoutsDrawer"'), page.indexOf('</aside>', page.indexOf('<aside id="abearcMapLayoutsDrawer"')));
assert(!/Print \/ Export|openAbearcMapPrint/.test(layoutPanel), 'Map layouts panel must not include print/export actions.');
requireText(print, /openAbearcMapPrint=async function\(options=\{\}\)/, 'Print Mode does not accept saved-layout options.');
requireText(print, /photoLayout:[\s\S]+moved:[\s\S]+expanded:/, 'Print Mode does not copy moved/resized photo layout state.');
requireText(orthomosaic, /captureAbearcOrthomosaicLayoutState[\s\S]+restoreAbearcOrthomosaicLayoutState/, 'Orthomosaic layout capture/restore hooks are missing.');

console.log('Map Layouts check passed: persistence, ownership, exact photos, map state, import/export, and removal of print actions verified.');

(async () => {
  const start = layouts.indexOf('    async function openAbearcMapLayout(id)');
  const end = layouts.indexOf('    async function updateAbearcMapLayout(id)', start);
  let choice = 'save', proceed = false, saveOk = false, requests = 0, saves = 0, restores = 0;
  const context = vm.createContext({
    API: '/api',
    abearcMapActiveLayoutId: 1,
    abearcMapActiveLayoutRecord: null, abearcMapActiveLayoutState: null,
    abearcMapLayoutHasUnsavedChanges: () => true,
    confirmModalChoice: async () => proceed,
    document: { querySelector: () => ({ value: choice }) },
    updateAbearcMapLayout: async () => { saves++; return saveOk; },
    fetchJson: async () => { requests++; return { id: 2, name: 'Layout', state: {} }; },
    restoreAbearcMapLayoutState: async () => { restores++; return { missingPhotoIds: [], missingOrthomosaicIds: [] }; },
    captureAbearcMapLayoutState: () => ({}), renderAbearcMapLayouts() {}, toast() {}
  });
  vm.runInContext(layouts.slice(start, end), context);
  assert.equal(await context.openAbearcMapLayout(2), null);
  assert.equal(requests, 0, 'cancel must not replace the current layout');
  proceed = true;
  assert.equal(await context.openAbearcMapLayout(2), null);
  assert.equal(saves, 1);
  assert.equal(requests, 0, 'failed save must prevent switching layouts');
  saveOk = true;
  assert.equal((await context.openAbearcMapLayout(2)).id, 2);
  assert.equal(restores, 1);
  choice = 'discard';
  await context.openAbearcMapLayout(2);
  assert.equal(saves, 2, 'discard must skip saving');
  assert.equal(restores, 2);
  console.log('Layout switch checks passed: cancel, failed save, save and discard.');
})().catch(error => { console.error(error); process.exitCode = 1; });
