const path = require('path');
const os = require('os');
const realFs = require('fs');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const sidebarSource = realFs.readFileSync(path.join(ROOT, 'src/frontend/components/stable-sidebar.html'), 'utf8');
const changelogSource = realFs.readFileSync(path.join(ROOT, 'src/frontend/scripts/06-feedback-users.js'), 'utf8');
if (!sidebarSource.includes('ABEARC System v1.53') ||
    !changelogSource.includes('Information System v1.53') ||
    !changelogSource.includes('Calendar 2.0')) {
  throw new Error('ABEARC v1.53 must match across the sidebar and changelog.');
}
const mapFrontendSource = realFs.readFileSync(
  path.join(ROOT, 'src/frontend/scripts/12-abearc-map.js'),
  'utf8'
);
const terrainTileSource = mapFrontendSource.match(
  /'google-terrain':\s*\{([\s\S]*?)\n\s*\},\n\s*'google-satellite'/
)?.[1] || '';
if (!terrainTileSource.includes('lyrs=p&') || terrainTileSource.includes('lyrs=t&')) {
  throw new Error('Terrain basemap must use complete Google terrain tiles (lyrs=p).');
}
if (!mapFrontendSource.includes("type: 'raster-dem'") ||
    !mapFrontendSource.includes("encoding: 'terrarium'") ||
    !mapFrontendSource.includes("type: 'hillshade'")) {
  throw new Error('Terrain basemap must include elevation data and hillshading.');
}
const mapPageSource = realFs.readFileSync(path.join(ROOT, 'src/frontend/pages/map.page.html'), 'utf8');
const applicationStyleSource = realFs.readFileSync(path.join(ROOT, 'src/frontend/styles/application.css'), 'utf8');
const importedLineStyle = applicationStyleSource.match(/\.abearc-map-measure-line\.abearc-map-imported-polygon\s*\{([^}]*)\}/)?.[1] || '';
if (mapFrontendSource.includes('Loading terrain elevations...') ||
    !mapFrontendSource.includes('abearc-map-elevation-updating') ||
    !mapFrontendSource.includes("panel.classList.add('is-updating')") ||
    !applicationStyleSource.includes('@keyframes abearc-map-elevation-sweep')) {
  throw new Error('Elevation updates must preserve the profile tile and load along its distance axis.');
}
const driveShortcutSource = realFs.readFileSync(path.join(ROOT, 'src/frontend/scripts/09-my-drive.js'), 'utf8');
const appConfigSource = realFs.readFileSync(path.join(ROOT, 'src/backend/config/00-dependencies-and-app.config.js'), 'utf8');
const attachAuthSource = realFs.readFileSync(path.join(ROOT, 'src/backend/middleware/02-attach-auth.middleware.js'), 'utf8');
if (!appConfigSource.includes("skip: req => Boolean(req.user) || !req.path.startsWith('/api')") ||
    !appConfigSource.includes("['GET', 'HEAD', 'OPTIONS'].includes(req.method)") ||
    !appConfigSource.includes('user:${req.user.id}') ||
    !attachAuthSource.includes('app.use(attachAuthUser);\napp.use(limiter);')) {
  throw new Error('Rate limiting must bypass authenticated and read-only UI traffic while retaining unauthenticated API protection.');
}
if (mapPageSource.includes('data-map-basemap="zoning"') ||
    !mapPageSource.includes('data-map-zoning-overlay') ||
    !mapPageSource.includes('data-map-flood-overlay')) {
  throw new Error('Zoning and flood hazard must be overlays, not basemaps.');
}
if (!mapPageSource.includes('accept=".kml,application/vnd.google-earth.kml+xml"') ||
    !mapPageSource.includes('onchange="importAbearcMapMeasureKml(event)"') ||
    !mapFrontendSource.includes('function importAbearcMapMeasureKml(event)') ||
    !mapFrontendSource.includes("elements.filter(element => element.localName === 'Polygon')") ||
    !mapFrontendSource.includes("element.localName === 'LineString'") ||
    !mapFrontendSource.includes("documentName === 'ABEARC contour lines'") ||
    !mapFrontendSource.includes('contourKml ? 50000 : 1000') ||
    !mapFrontendSource.includes('imported: true') ||
    !mapFrontendSource.includes('function selectAbearcImportedPolygon(event, index, projectedPolygons)') ||
    !mapFrontendSource.includes('function openAbearcImportedPolygonContextMenu(event, index)') ||
    !mapFrontendSource.includes('function toggleAbearcImportedPolygonEdit()') ||
    !mapFrontendSource.includes('const renderOrder = abearcMapImportedPolygons') ||
    !mapFrontendSource.includes('const nextIndex = (pointIndex + 1) % points.length') ||
    !mapFrontendSource.includes('openAbearcMapMeasurePointContextMenu(event, pointIndex)') ||
    !mapFrontendSource.includes('function abearcScreenInteriorPoint(points)') ||
    !mapFrontendSource.includes('const totalArea = selectedPolygons.reduce') ||
    !mapFrontendSource.includes('abearcMapSelectedImportedPolygons.size <= 1') ||
    !mapFrontendSource.includes('new Set(abearcMapImportedPolygons.map((_, index) => index))') ||
    !mapFrontendSource.includes("toast('Polygon selection cleared')") ||
    !mapFrontendSource.includes('function undoAbearcMapMeasureChange()') ||
    !mapFrontendSource.includes('abearcMapMeasureUndoStack.length > 50') ||
    !driveShortcutSource.includes('window.selectAllAbearcImportedPolygons?.()') ||
    !mapFrontendSource.includes('selected_imported_polygons') ||
    !mapFrontendSource.includes('function selectAbearcMeasurePoint(index)') ||
    !mapFrontendSource.includes(".abearc-map-measure-point[data-measure-point-index]") ||
    !mapPageSource.includes('data-map-imported-polygon-properties') ||
    !mapPageSource.includes('data-map-imported-polygon-edit') ||
    !mapPageSource.includes('data-map-measure-elevation') ||
    !applicationStyleSource.includes('.abearc-map-measure-import') ||
    !importedLineStyle.includes('stroke: #06b6d4') ||
    !applicationStyleSource.includes('rgba(6, 182, 212, 0.18)') ||
    applicationStyleSource.includes('rgba(6, 182, 212, 0.3)')) {
  throw new Error('KML measurement import must support multiple selectable and editable polygons with scoped properties.');
}
const mapPermissionSource = realFs.readFileSync(path.join(ROOT, 'src/backend/middleware/14-map-media-permissions.middleware.js'), 'utf8');
const mapRouteSource = realFs.readFileSync(path.join(ROOT, 'src/backend/routes/14-map-media.routes.js'), 'utf8');
const mapControllerSource = realFs.readFileSync(path.join(ROOT, 'src/backend/controllers/14-map-media.controller.js'), 'utf8');
const dockerfileSource = realFs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
if (!mapPageSource.includes('data-map-measure-contours') ||
    !mapPageSource.includes('id="abearcMapContourPanel"') ||
    !mapPageSource.includes('data-map-contour-source-option="namria-dtm5-prs92"') ||
    !mapPageSource.includes('data-map-contour-apply disabled') ||
    !mapPageSource.includes('data-map-contour-index-interval') ||
    !mapFrontendSource.includes('function buildAbearcContourData(') ||
    !mapFrontendSource.includes('function buildAbearcContourSurfaces(') ||
    !mapFrontendSource.includes('function abearcContourSelectionKey(') ||
    !mapFrontendSource.includes('function stitchAbearcContourSegments(') ||
    !mapFrontendSource.includes('function insertAbearcMeasurePoint(point)') ||
    !mapFrontendSource.includes('abearcMapMeasurePoints.splice(insertionIndex, 0, point)') ||
    !mapFrontendSource.includes('Number.isInteger(abearcMapEditingImportedPolygonIndex) ? addAbearcMeasurePoint(event.lngLat)') ||
    !mapFrontendSource.includes("fill.addEventListener('click', editing ? addAbearcMeasurePointFromOverlay") ||
    !mapFrontendSource.includes('function renderAbearcMapContours(') ||
    !mapFrontendSource.includes('let abearcMapContourSource = ABEARC_MAP_DEFAULT_ELEVATION_SOURCE') ||
    !mapFrontendSource.includes('function applyAbearcContourSettings()') ||
    !mapFrontendSource.includes('function exportAbearcContourKml(confirmExport = true)') ||
    !mapFrontendSource.includes('function chooseAbearcMapKmlExport()') ||
    !mapFrontendSource.includes('value="contours"') ||
    !mapFrontendSource.includes("exportChoice === 'contours'") ||
    !mapFrontendSource.includes('<altitudeMode>absolute</altitudeMode>') ||
    !mapPageSource.includes('onclick="exportAbearcContourKml()"') ||
    !mapFrontendSource.includes('level / indexInterval - Math.round(level / indexInterval)') ||
    !mapFrontendSource.includes("label.setAttribute('dominant-baseline', 'central')") ||
    !mapFrontendSource.includes('rotate(${angle.toFixed(1)}') ||
    !mapFrontendSource.includes('Generating polygon ${polygonIndex + 1} of ${polygons.length}') ||
    !applicationStyleSource.includes('.abearc-map-contour-line.is-index') ||
    !mapControllerSource.includes('maxElevationLocations = 5000') ||
    !mapControllerSource.includes('locations.length > 100 ? 60000 : 20000') ||
    !mapControllerSource.includes("source.provider === 'open-topodata'") ||
    !mapControllerSource.includes('image.getTileWidth?.() || 256')) {
  throw new Error('Area measurements must generate clipped 1-2-5 interval contours with fifth-interval index lines.');
}
if (!mapControllerSource.includes("'namria-dtm5-prs92'") ||
    !mapControllerSource.includes("provider: 'namria-local'") ||
    !mapFrontendSource.includes("'namria-dtm5-prs92'") ||
    !mapPageSource.includes('data-map-elevation-source="namria-dtm5-prs92"') ||
    !dockerfileSource.includes('/data/map-elevation/namria')) {
  throw new Error('NAMRIA DTM elevation source is not wired through backend, frontend, and persistent Docker data.');
}
if (mapControllerSource.includes("'opentopo-mapzen'") || mapFrontendSource.includes("'opentopo-mapzen'")
    || mapPageSource.includes('data-map-elevation-source="opentopo-mapzen"')) {
  throw new Error('Removed Open Topo Data Mapzen elevation source is still wired.');
}
if (!mapFrontendSource.includes('pmtiles://${ABEARC_NOAH_FLOOD_PMTILES_URL}')
    || mapFrontendSource.includes("filter: ['within', boundary]")) {
  throw new Error('Project NOAH flood hazard must use the direct, unfiltered PMTiles source.');
}
const coreSource = realFs.readFileSync(path.join(ROOT, 'src/backend/utils/00-core.utils.js'), 'utf8');
if (!coreSource.includes("name: 'delete_other_map_media'") ||
    !mapPermissionSource.includes("canRoleBypassPrivilege(user, 'delete_other_map_media')") ||
    !mapRouteSource.includes('ensureMapMediaOwnerOrDeletePrivilege, __routeController216') ||
    !mapControllerSource.includes("getAuthorizedMapMediaBulkRows(req, ids, 'delete')") ||
    !mapFrontendSource.includes("hasPrivilege('delete_other_map_media')") ||
    !mapFrontendSource.includes("abearcMapPhotoScope === 'mine' && Number.isFinite(ownerId)") ||
    !applicationStyleSource.includes('#mapPage [data-map-list-menu-delete].hidden') ||
    !applicationStyleSource.includes('display: none !important;')) {
  throw new Error('Geotag photo deletion must require ownership or the dedicated cross-owner delete privilege.');
}
const TEST_DATA = realFs.mkdtempSync(path.join(os.tmpdir(), 'abearc-wiring-'));
const registrations = [];

function mapDataPath(value) {
  if (typeof value !== 'string') return value;
  const normalized = path.resolve(value);
  const localData = path.join(ROOT, 'data');
  if (normalized === '/data' || normalized.startsWith('/data' + path.sep)) {
    return path.join(TEST_DATA, path.relative('/data', normalized));
  }
  if (normalized === localData || normalized.startsWith(localData + path.sep)) {
    return path.join(TEST_DATA, path.relative(localData, normalized));
  }
  return value;
}

const fsStub = Object.create(realFs);
for (const method of ['existsSync', 'mkdirSync', 'writeFileSync', 'readFileSync', 'readdirSync', 'statSync', 'rmSync', 'unlinkSync']) {
  fsStub[method] = (...args) => realFs[method](mapDataPath(args[0]), ...args.slice(1));
}
fsStub.existsSync = (value) => value === '/.dockerenv' ? false : realFs.existsSync(mapDataPath(value));

function middleware(req, res, next) { if (next) next(); }
function express() {
  const app = {
    set() { return app; },
    use(...args) {
      registrations.push({ method: 'USE', path: typeof args[0] === 'string' ? args[0] : '' });
      return app;
    },
    listen() {
      registrations.push({ method: 'LISTEN', path: '' });
      return { close() {} };
    }
  };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (route, ...handlers) => {
      registrations.push({ method: method.toUpperCase(), path: String(route), handlers: handlers.length });
      return app;
    };
  }
  return app;
}
express.json = () => middleware;
express.static = () => middleware;

class FakeDatabase {
  configure() {}
  serialize(fn) { if (fn) fn(); }
  exec() {}
  on() {}
  run() { return this; }
  get() { return this; }
  all() { return this; }
  prepare() { return { run() {}, finalize() {} }; }
  wait() {}
}

function multer() {
  return {
    single: () => middleware,
    array: () => middleware,
    fields: () => middleware,
    none: () => middleware
  };
}
multer.diskStorage = options => options;
multer.MulterError = class MulterError extends Error {};

const originalLoad = Module._load;
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'fs') return fsStub;
  if (request === 'express') return express;
  if (request === 'sqlite3') return { verbose: () => ({ Database: FakeDatabase }) };
  if (request === 'multer') return multer;
  if (request === 'express-rate-limit') return () => middleware;
  if (request === 'pdf-lib') return { PDFDocument: {}, StandardFonts: {}, rgb: () => ({}) };
  if (request === 'adm-zip') return class AdmZip {};
  if (request === 'pdf-parse') return { PDFParse: class PDFParse {} };
  if (request === 'mammoth') return {};
  if (request === 'xlsx') return {};
  if (request === 'qrcode') return {};
  if (request === 'jsqr') return () => null;
  if (request === 'sharp') return () => ({ rotate() { return this; }, resize() { return this; }, webp() { return this; }, async toFile() {} });
  return originalLoad(request, parent, isMain);
};
global.setInterval = () => 0;
global.setTimeout = () => 0;

try {
  require(path.join(ROOT, 'server.js'));
  const routeCount = registrations.filter(item => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(item.method)).length;
  const loginIndex = registrations.findIndex(item => item.method === 'POST' && item.path === '/api/auth/login');
  const protectionIndex = registrations.findIndex(item => item.method === 'USE' && item.path === '/api');
  const protectedIndex = registrations.findIndex(item => item.method === 'GET' && item.path === '/api/user-drive');

  if (routeCount !== 328) throw new Error(`Expected 328 runtime route registrations, received ${routeCount}.`);
  const telegramRouteIndex = registrations.findIndex(item => item.method === 'GET' && item.path === '/api/telegram/status');
  if (telegramRouteIndex <= protectionIndex) throw new Error('Telegram routes must be registered after API authentication.');
  const gravityRouteIndex = registrations.findIndex(item => item.method === 'POST' && item.path === '/api/map/gravity-path');
  if (gravityRouteIndex < 0) throw new Error('Native NAMRIA gravity-path route is not registered.');
  const weatherMapRouteIndex = registrations.findIndex(item => item.method === 'GET' && item.path === '/api/weather/map-stations');
  const weatherSyncRouteIndex = registrations.findIndex(item => item.method === 'POST' && item.path === '/api/weather/stations/:id/sync');
  const weatherAdminRouteIndex = registrations.findIndex(item => item.method === 'GET' && item.path === '/api/weather/admin/status');
  if (weatherMapRouteIndex < 0 || weatherSyncRouteIndex < 0 || weatherAdminRouteIndex < 0) throw new Error('Weather station routes are not fully registered.');
  if (!(loginIndex >= 0 && protectionIndex > loginIndex && protectedIndex > protectionIndex)) {
    throw new Error(`API middleware order changed: login=${loginIndex}, protection=${protectionIndex}, protected=${protectedIndex}.`);
  }
  console.log(`Runtime wiring check passed: ${routeCount} routes; public authentication remains before API protection.`);
} finally {
  Module._load = originalLoad;
  global.setInterval = originalSetInterval;
  global.setTimeout = originalSetTimeout;
  realFs.rmSync(TEST_DATA, { recursive: true, force: true });
}
