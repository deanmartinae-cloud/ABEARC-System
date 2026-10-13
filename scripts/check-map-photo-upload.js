const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/12-abearc-map.js'), 'utf8');
const arrowStart = source.indexOf('    function bearingArrowHtml(');
const arrowEnd = source.indexOf('    function downloadAbearcMapOriginal', arrowStart);
const arrowContext = vm.createContext({ abearcMap: { getBearing: () => 30 } });
vm.runInContext(source.slice(arrowStart, arrowEnd), arrowContext);
for (const missing of [null, undefined, '', ' ', 'N/A', NaN]) {
  assert.equal(arrowContext.bearingArrowHtml(missing), '');
}
assert.match(arrowContext.bearingArrowHtml(0), /Facing 0 degrees/);
assert.match(arrowContext.bearingArrowHtml(90), /--bearing:60deg/);

const controller = fs.readFileSync(path.join(__dirname, '../src/backend/controllers/14-map-media.controller.js'), 'utf8');
const inferenceStart = controller.indexOf('const mapMediaUploadValueMissing');
const inferenceEnd = controller.indexOf('const __routeController198', inferenceStart);
const geotagService = fs.readFileSync(path.join(__dirname, '../src/backend/services/16-project-geotag-auto-map.service.js'), 'utf8');
const numberStart = geotagService.indexOf('const projectGeotagNumber');
const numberEnd = geotagService.indexOf('const projectGeotagCapturedAt', numberStart);
const inferenceContext = vm.createContext({
  fs: { readFileSync: () => Buffer.alloc(0) },
  Buffer,
  monitoringReadExifMetadata: () => ({ latitude: 7, longitude: 125, bearing_deg: null }),
  mapMediaCoordinatePresent: value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value)),
  inspectProjectGeotagImage: async () => ({ accuracyM: 4.5, bearingDeg: null, stampText: 'Accuracy: ±4.5 m' }),
  mapZoningFromStampText: () => ({}), projectGeotagFilenameCapturedAt: () => null,
  logError() {}
});
vm.runInContext(geotagService.slice(geotagService.indexOf('const projectGeotagStampValue'), geotagService.indexOf('const projectGeotagExtractStampText')) + geotagService.slice(numberStart, numberEnd) + controller.slice(inferenceStart, inferenceEnd), inferenceContext);
let exifBearing = null;
const inspectionContext = vm.createContext({
  fs: { readFileSync: () => Buffer.alloc(0) }, path,
  monitoringReadExifMetadata: () => ({ text: 'Accuracy: ±4.5 m', bearing_deg: exifBearing }),
  monitoringPhotoTextCandidates: () => [], monitoringParseExifDate: () => null,
  decodeProjectGeotagQr: async () => '',
  mapMediaCoordinatePresent: inferenceContext.mapMediaCoordinatePresent
});
const qrStart = geotagService.indexOf('const decodeProjectGeotagQr');
const inspectStart = geotagService.indexOf('const inspectProjectGeotagImage');
const inspectEnd = geotagService.indexOf('const projectGeotagRemark', inspectStart);
vm.runInContext(geotagService.slice(0, qrStart) + geotagService.slice(inspectStart, inspectEnd), inspectionContext);
const start = source.indexOf('    async function uploadAbearcMapPhotos(event)');
const end = source.indexOf('    function setAbearcMapPhotosVisible', start);
assert(start >= 0 && end > start);
const requests = [];
let reloads = 0;
const context = vm.createContext({
  API: '/api', authToken: 'test-session',
  abearcMapManualUploadFiles: [{ name: 'gps.jpg' }],
  document: { getElementById: () => null },
  FormData: class {
    constructor() { this.fields = new Map(); }
    append(key, value) { this.fields.set(key, value); }
  },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ uploaded_count: 1, failed_count: 0 }) };
  },
  reloadAbearcMap: async () => { reloads++; },
  toast() {}, setTimeout() {}, closeAbearcMapPhotoUploadModal() {}
});
vm.runInContext(source.slice(start, end), context);
(async () => {
  const inspected = await vm.runInContext("inspectProjectGeotagImage('photo.jpg')", inspectionContext);
  assert.equal(inspected.accuracyM, 4.5);
  assert.equal(inspected.bearingDeg, null);
  exifBearing = 0;
  assert.equal((await vm.runInContext("inspectProjectGeotagImage('photo.jpg')", inspectionContext)).bearingDeg, 0);
  const metadataResult = await vm.runInContext("inferMapMediaUploadMetadata({ path: 'photo.jpg', originalname: 'photo.jpg' }, { accuracy_m: 100 })", inferenceContext);
  assert.equal(metadataResult.accuracy_m, 4.5);
  assert.equal(metadataResult.bearing_deg, undefined);
  await context.uploadAbearcMapPhotos({ preventDefault() {} });
  assert.equal(requests.length, 0);
  context.document.getElementById = id => id === 'abearcMapPhotoUploadCategory' ? { value: '   ', focus() {} } : null;
  await context.uploadAbearcMapPhotos();
  assert.equal(requests.length, 0);
  context.document.getElementById = id => id === 'abearcMapPhotoUploadCategory' ? { value: '  Irrigation  ' } : null;
  await context.uploadAbearcMapPhotos();
  assert.equal(requests.length, 1);
  const { url, options } = requests[0];
  assert.equal(url, '/api/mobile/map-media/upload-batch');
  assert.equal(options.headers.Authorization, 'Bearer test-session');
  const [metadata] = JSON.parse(options.body.fields.get('metadata_json'));
  assert.equal(metadata.visibility, 'organization');
  assert.equal(metadata.category, 'Irrigation');
  assert.equal(reloads, 1);
  const html = fs.readFileSync(path.join(__dirname, '../src/frontend/pages/map.page.html'), 'utf8');
  assert.match(html, /id="abearcMapPhotoUploadCategory" type="text" maxlength="120" list="abearcMapPhotoUploadCategories" required>/);
  assert(!html.includes('abearcMapPhotoUploadVisibility'));
  console.log('Map photo upload checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
