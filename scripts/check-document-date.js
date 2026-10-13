const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const schema = read('src/backend/models/00-schema.models.js');
const migrations = read('src/backend/migrations/00-runtime.migrations.js');
const startup = read('src/backend/startup/00-listen.startup.js');
assert.match(schema, /upload_date DATETIME, document_date DATETIME, checked_at DATETIME/);
assert.doesNotMatch(schema, /columnExists\('Documents', 'document_date'/);
assert.match(migrations, /ensureDocumentDateMigration/);
assert.match(migrations, /addColumnIfMissing\('Documents', 'document_date', 'DATETIME'\)/);
assert.match(migrations, /idx_documents_document_date/);
assert.match(startup, /await ensureDocumentDateMigration\(\)/);

const routes = read('src/backend/routes/12-documents-and-due-dates.routes.js');
assert.match(routes, /\/api\/documents\/:documentId\/document-date', requireAuth, updateDocumentDateController/);
assert.match(routes, /upload_date=NULL, document_date=NULL, checked_at=NULL/);

const controller = read('src/backend/controllers/12-documents-and-due-dates.controller.js');
assert.match(controller, /upload_date=\?, document_date=NULL, status='For Review'/);
assert.match(controller, /Document date is required before this document can be marked Checked/);
assert.match(controller, /'Document name'.*'Document date'.*'Status'/s);
assert.match(controller, /formatExportDateTime\(doc\.document_date\)/);

const page = read('src/frontend/pages/project-detail.page.html');
const header = page.match(/<tr><th[\s\S]*?<\/tr>/)?.[0] || '';
assert.ok(header.indexOf('Document Date') > header.indexOf('File'));
assert.ok(header.indexOf('Document Date') < header.indexOf('Date Uploaded'));
assert.match(page, /table-fixed/);
assert.match(page, /<col style="width:19%">/);

const frontend = read('src/frontend/scripts/04-project-detail-documents.js');
assert.match(frontend, /Enter date/);
assert.match(frontend, /Only the document uploader can enter or edit the document date/);
assert.match(frontend, /showDocumentDateRequiredNotice\(currentDoc\)/);
assert.match(frontend, /fmtDateTime\(d\.document_date\)/);
assert.match(frontend, /colspan="8"/);
assert.match(frontend, /border-gray-300[\s\S]*text-gray-400[\s\S]*Only the uploader can enter the document date/);

const printSource = read('src/frontend/scripts/11-session-activity-init.js');
assert.match(printSource, /<th>Document date<\/th><th>Upload date<\/th>/);
const documentsHeader = printSource.match(/<h2>Documents<\/h2><table><thead><tr>([\s\S]*?)<\/tr>/)?.[1] || '';
assert.ok(!documentsHeader.includes('File name'));
assert.match(printSource, /fmtDateTime\(d\.document_date\)/);
assert.match(printSource, /nativeAuthenticatedDownload\(url, fallbackFilename\)/);
assert.ok(!/downloadsFormsDownloadRequest\(url, `project_export_/.test(printSource), 'Project document export should not buffer the compiled PDF through XHR');

// Exercise document-date write permission and persistence behavior in isolation.
const dateStart = controller.indexOf('const updateDocumentDateController =');
const dateEnd = controller.indexOf('const updateDocumentRemarksController =');
assert.ok(dateStart >= 0 && dateEnd > dateStart);
let storedDate = null;
let doc = {
  id: 7, project_id: 3, project_name: 'Sample Project', requester: 'Requester', document_type_name: 'DED',
  file_path: 'Proj_3/Doc_7/sample.pdf', uploader_user_id: 5, doc_stage: 'Proposal'
};
const dateContext = vm.createContext({
  fs: { existsSync: () => true },
  path: { join: (...parts) => parts.join('/') },
  UPLOADS_DIR: '/uploads',
  getDocAndProjectStage: (_id, cb) => cb(null, doc),
  requireUnlockedOrTemporaryStage: (_req, _res, _doc, action, allowed) => { assert.equal(action, 'upload'); allowed(null); },
  db: { run: (_sql, params, cb) => { storedDate = params[0]; cb(null); } },
  logActivity() {}, updateProjectActivity() {}, logLockedStageEditUse() {}
});
vm.runInContext(controller.slice(dateStart, dateEnd) + '\nthis.updateDocumentDateController = updateDocumentDateController;', dateContext);
function invokeDate(body, user = { id: 5, username: 'uploader', role: 'user' }) {
  return new Promise(resolve => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(payload) { resolve({ code: this.code, payload }); } };
    dateContext.updateDocumentDateController({ body, params: { documentId: '7' }, user }, res);
  });
}

(async () => {
  let out = await invokeDate({ document_date: '2026-09-23T09:15:00+08:00' });
  assert.equal(out.code, 200);
  assert.equal(out.payload.document_date, '2026-09-23T01:15:00.000Z');
  assert.equal(storedDate, out.payload.document_date);

  out = await invokeDate({ document_date: '2026-09-23T09:15:00+08:00' }, { id: 9, username: 'reviewer', role: 'user' });
  assert.equal(out.code, 403);

  out = await invokeDate({ document_date: 'not-a-date' });
  assert.equal(out.code, 400);

  const statusStart = controller.indexOf('const __routeController188 =');
  const statusEnd = controller.indexOf('const __routeController189 =');
  const statusContext = vm.createContext({
    fs: { existsSync: () => true }, path: { join: (...parts) => parts.join('/') }, UPLOADS_DIR: '/uploads',
    getDocAndProjectStage: (_id, cb) => cb(null, { ...doc, status: 'For Review', document_date: null }),
    requireUnlockedOrTemporaryStage: (_req, _res, _doc, _action, allowed) => allowed(null),
    syncProjectDocumentMapMediaReviewState: async () => {}, logError() {}, logActivity() {}, notifyDocumentEvent() {},
    updateProjectActivity() {}, logLockedStageEditUse() {}, db: { run() { throw new Error('DB update should not run without document date'); } }
  });
  vm.runInContext(controller.slice(statusStart, statusEnd) + '\nthis.updateStatus = __routeController188;', statusContext);
  out = await new Promise(resolve => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(payload) { resolve({ code: this.code, payload }); } };
    statusContext.updateStatus({ body: { status: 'Checked' }, params: { documentId: '7' }, user: { id: 9, username: 'reviewer' } }, res);
  });
  assert.equal(out.code, 400);
  assert.match(out.payload.error, /inform the uploader/i);

  console.log('Document date checks passed: schema, uploader-only entry, Checked guard, fixed-width table, print summary, and export checklist wiring verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
