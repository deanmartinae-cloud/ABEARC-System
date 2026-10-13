const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const sqlite3 = require('sqlite3');
const ROOT = path.resolve(__dirname, '..');
const repair = process.argv.includes('--repair');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'abearc-geotag-'));
const open = file => new Promise((resolve, reject) => { const db = new sqlite3.Database(file, error => error ? reject(error) : resolve(db)); });
const run = (db, sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, function(error) { error ? reject(error) : resolve({ changes: this.changes, lastID: this.lastID }); }));
const all = (db, sql, args = []) => new Promise((resolve, reject) => db.all(sql, args, (error, rows) => error ? reject(error) : resolve(rows)));
(async () => {
  const source = await open(path.join(ROOT, 'data/data.db'));
  const backup = path.join(temporary, 'before.db');
  await run(source, 'VACUUM INTO ?', [backup]);
  const db = repair ? source : await open(backup);
  const context = vm.createContext({
    fs, path, Buffer, console, require, __dirname: ROOT, sqlite3, sharp: require('sharp'), jsQR: require('jsqr'),
    MAP_ZONING_DB_PATH: path.join(ROOT, 'data/map-zoning/zones.db'),
    dbAll: (sql, args) => all(db, sql, args), dbGet: async (sql, args) => (await all(db, sql, args))[0],
    dbRun: (sql, args) => run(db, sql, args),
    mapMediaAbsolutePath: (_, file) => path.join(ROOT, 'data/map-media/originals', file),
    logError: (...args) => console.error(...args), canManageAllMapMedia: async () => true,
    toNullableNumber: value => value == null || value === '' ? null : Number(value)
  });
  for (const file of ['services/15-established-monitoring.service.js', 'services/16-project-geotag-auto-map.service.js',
    'services/14-map-zoning-tiles.service.js', 'services/14-map-media.service.js', 'models/14-map-media.model.js',
    'controllers/14-map-media.controller.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/backend', file), 'utf8'), context);
  }
  const frontend = fs.readFileSync(path.join(ROOT, 'src/frontend/scripts/12-abearc-map.js'), 'utf8');
  vm.runInContext(frontend.slice(frontend.indexOf('    function mapMediaLocationText'), frontend.indexOf('    function mapMediaRemarksText')), context);
  const before = await all(db, 'SELECT * FROM MapMedia ORDER BY id');
  assert(before.length, 'Actual MapMedia rows are required for verification');
  context.sample = before[0];
  const inspected = await vm.runInContext("inspectProjectGeotagImage(mapMediaAbsolutePath('original', sample.original_path), sample.original_filename)", context);
  console.log('Original image evidence:', JSON.stringify({ id: before[0].id, exifGPS: [inspected.embeddedLatitude, inspected.embeddedLongitude], address: inspected.address, qr: inspected.qrPayload }));
  if (!repair) {
    await run(db, 'UPDATE MapMedia SET latitude=NULL, longitude=NULL, barangay=?, district=? WHERE id=?', ['Unknown Barangay', 'Unknown District', before[0].id]);
    vm.runInContext("for (const v of [null, '', 'Unknown', 'Unknown Barangay', 'Unknown District', '?Coordinates: 7.4, 125.3']) assertMissing(v);", vm.createContext({ assertMissing: value => {
      context.value = value;
      assert(vm.runInContext("mapMediaAdministrativeValueMissing(value, /district/i.test(String(value)) ? 'district' : 'barangay')", context));
    } }));
  }
  const counts = await vm.runInContext('backfillMapMediaSpatialMetadata()', context);
  const after = await all(db, 'SELECT * FROM MapMedia ORDER BY id');
  for (let index = 0; index < before.length; index++) {
    context.prior = before[index]; context.saved = after[index];
    for (const kind of ['barangay', 'district']) {
      context.kind = kind;
      if (vm.runInContext('!mapMediaAdministrativeValueMissing(prior[kind], kind)', context) && (repair || index !== 0)) {
        assert.equal(after[index][kind], before[index][kind], 'Preserve valid ' + kind + ' on ' + before[index].id);
      }
    }
  }
  if (!repair) assert.equal(after[0].latitude, inspected.embeddedLatitude, 'Recover null GPS from original EXIF');
  context.req = { query: { limit: '5000', map_status: 'all' }, user: { id: before[0].owner_user_id } };
  let response;
  context.res = { json: body => { response = JSON.parse(JSON.stringify(body)); }, status: code => { throw Error('API failed: ' + code); } };
  await vm.runInContext('__routeController200(req, res)', context);
  assert(response.features.length, 'Sidebar API must return actual photos');
  const blank = response.features.filter(feature => { context.feature = feature; return !vm.runInContext('mapMediaLocationText(feature.properties)', context); });
  assert.equal(blank.length, 0, 'No actual API photo should display unavailable');
  context.req.query = { limit: '5000', user_id: String(before[0].owner_user_id) };
  await vm.runInContext('__routeController200(req, res)', context);
  assert(response.features.every(feature => Number(feature.properties.owner_user_id) === Number(before[0].owner_user_id)), 'Verify My geotagged photos owner filter');
  console.log('Verified My geotagged photos API:', JSON.stringify(response.features.map(f => ({ id: f.id, barangay: f.properties.barangay, district: f.properties.district }))));
  const evidence = { counts, before: before.map(r => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, barangay: r.barangay, district: r.district })), after: after.map(r => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, barangay: r.barangay, district: r.district })) };
  fs.writeFileSync(path.join(temporary, 'verification.json'), JSON.stringify(evidence, null, 2));
  console.log('Before/after database evidence:', path.join(temporary, 'verification.json'));
  console.log('Geotag backfill and actual sidebar API checks passed.', counts);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
