const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (src, re, msg) => assert.match(src, re, msg);

const config = read('src/backend/config/21-weather.config.js');
const migration = read('src/backend/migrations/21-weather.migration.js');
const provider = read('src/backend/services/21-weather-provider.service.js');
const analytics = read('src/backend/services/21-weather-analytics.service.js');
const sync = read('src/backend/services/21-weather-sync.service.js');
const controller = read('src/backend/controllers/21-weather.controller.js');
const routes = read('src/backend/routes/21-weather.routes.js');
const frontend = read('src/frontend/scripts/23-map-weather.js')+'\n'+read('src/frontend/scripts/24-weather-experience.js');
const modal = read('src/frontend/modals/map-weather.modals.html');
const map = read('src/frontend/scripts/12-abearc-map.js');
const layouts = read('src/frontend/scripts/16-map-layouts.js');
const startup = read('src/backend/startup/00-listen.startup.js');
const core = read('src/backend/utils/00-core.utils.js');

must(config, /process\.env\.ZENTRA_API_KEY/, 'Weather API key must come from the server environment.');
assert(!/eyJhbGciOi/.test([config,provider,analytics,sync,controller,routes,frontend,modal].join('\n')), 'A JWT-like credential was embedded in the weather implementation.');
assert(!/X-API-Key/.test(frontend + modal), 'Frontend must never send the ZENTRA API key.');
must(provider, /headers:\s*\{\s*'X-API-Key':\s*activeKey/, 'Backend provider must authenticate with a server-side API key.');
must(provider, /expand:\s*'max_min_timestamp,settings,ports,location,hardware,connectivity,subscription'/, 'Device discovery must request required metadata expansions.');
must(sync, /nextReadingId[\s\S]+authoritative exclusive continuation[\s\S]+cursorAfter/, 'Incremental synchronization must use ZENTRA next_reading_id semantics.');
must(sync, /INSERT OR IGNORE INTO WeatherReadings/, 'Weather readings must be idempotent.');
must(migration, /UNIQUE\(station_id, source_key\)/, 'Weather reading schema must prevent duplicates.');
must(migration, /retry_count[\s\S]+next_attempt_at/, 'Historical resync jobs must persist retry/backoff state.');
must(sync, /weatherBackfillErrorIsTransient[\s\S]+status='queued'[\s\S]+next_attempt_at/, 'Transient historical resync failures must recover automatically.');
must(controller, /weatherValidateTimezone[\s\S]+timeZone:timezone/, 'Station timezone must be validated as an IANA timezone.');
must(modal, /abearcWeatherTimezone/, 'Station timezone management UI is missing.');
must(analytics, /circular_mean/, 'Wind direction must use circular averaging.');
must(analytics, /weatherFao56Et0Daily/, 'Defensible FAO-56 ET0 calculation is missing.');
must(analytics, /weatherWindAt2m/, 'ET0 wind-height normalization is missing.');
must(analytics, /weatherCurrentConditionsMany[\s\S]+PARTITION BY wr\.station_id,wr\.series_id/, 'Map current conditions must use a bulk station query.');
must(controller, /export\.csv|weatherExportCsv|text\/csv/i, 'CSV export is missing.');
must(controller, /XLSX/, 'Excel export is missing.');
must(controller, /PDFDocument/, 'PDF weather report is missing.');
must(routes, /\/api\/weather\/stations\/:id\/history/, 'Historical weather route is missing.');
must(routes, /\/api\/weather\/admin\/discover/, 'Weather discovery admin route is missing.');
must(frontend, /abearc-weather-stations/, 'Weather map source/layers are missing.');
must(frontend, /renderAbearcWeatherSensorInventory/, 'Sensor inventory UI is missing.');
must(frontend, /wireAbearcWeatherChartInteractions[\s\S]+data-weather-chart-tooltip/, 'Interactive weather chart tooltip wiring is missing.');
must(frontend, /data-weather-chart-detail[\s\S]+weatherChartWindow/, 'Weather charts must zoom and pan the displayed time range.');
must(modal, /Overview[\s\S]+Charts[\s\S]+Rainfall[\s\S]+Agriculture[\s\S]+Data Table[\s\S]+Reports[\s\S]+Station/, 'Weather dashboard tabs are incomplete.');
must(map, /setupAbearcWeatherLayers/, 'ABEARC map does not initialize weather layers.');
must(layouts, /weatherStationsVisible|weather_stations|weatherStations/i, 'My Map Layouts does not preserve weather layer state.');
must(startup, /ensureWeatherMigration[\s\S]+startWeatherScheduler/, 'Weather migration/scheduler must start with ABEARC.');
for (const privilege of ['view_weather_stations','export_weather_data','manage_weather_stations','manage_weather_alerts','manage_weather_integration']) {
  assert(core.includes(privilege), `Missing privilege: ${privilege}`);
}
const weatherSources = [config,migration,provider,analytics,sync,controller,routes,frontend,modal];
assert(!/\bTODO\b|\bFIXME\b|mock implementation/i.test(weatherSources.join('\n')), 'Temporary weather implementation markers remain.');
console.log('Weather station integration structural checks passed.');

// A source added by another overlay temporarily makes isStyleLoaded() false.
// Weather setup must retry after loading, including after a basemap change.
const vm = require('node:vm');
const layers = new Map(), sources = new Map(), idle = new Set();
let styleLoaded = false;
const mapStub = {
  isStyleLoaded: () => styleLoaded,
  once: (event, callback) => { assert.equal(event, 'idle'); idle.add(callback); },
  hasImage: () => true,
  getSource: id => sources.get(id),
  addSource: id => sources.set(id, { setData(data) { this.data = data; } }),
  getLayer: id => layers.get(id),
  addLayer: layer => layers.set(layer.id, layer),
  setLayoutProperty: (id,key,value) => { layers.get(id).layout[key]=value; },
  on: () => {}
};
const context = vm.createContext({ window: {}, localStorage: { getItem: () => null },
  document: { querySelectorAll: () => [], addEventListener: () => {} },
  abearcMap: mapStub, hasPrivilege: () => true });
vm.runInContext(frontend + `\nabearcWeatherStationsCache=[{id:1,display_name:'Test station',latitude:7.19,longitude:125.43}];`, context);
for (let pass = 0; pass < 2; pass += 1) {
  styleLoaded = false; layers.clear(); sources.clear();
  assert.equal(context.setupAbearcWeatherLayers(), false);
  context.setupAbearcWeatherLayers();
  assert.equal(idle.size, 1, 'Repeated setup must share one idle retry.');
  styleLoaded = true;
  const callbacks = [...idle]; idle.clear(); callbacks.forEach(callback => callback());
  assert(layers.has('abearc-weather-stations'), 'Weather station layer must appear after loading.');
  assert.equal(sources.get('abearc-weather-stations').data.features.length, 1);
}
console.log('Weather map loading regression check passed.');
