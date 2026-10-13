const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sqlite3 = require('sqlite3');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const db = new sqlite3.Database(':memory:');
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, err => err ? reject(err) : resolve()));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

(async () => {
  await run('CREATE TABLE Documents (id INTEGER PRIMARY KEY)');
  const schema = read('src/backend/models/00-schema.models.js');
  const migration = schema.match(/ALTER TABLE Documents ADD COLUMN remarks TEXT DEFAULT ''/)[0];
  await run(migration);
  await run('INSERT INTO Documents (id) VALUES (1)');
  assert.equal((await get('SELECT remarks FROM Documents WHERE id = 1')).remarks, '');
  let locked = false;
  let failWrite = false;
  const controller = read('src/backend/controllers/12-documents-and-due-dates.controller.js');
  const context = vm.createContext({
    db: { run(sql, params, callback) { if (failWrite) callback(new Error('disk failure')); else db.run(sql, params, callback); } },
    getDocAndProjectStage: (id, callback) => db.get('SELECT * FROM Documents WHERE id = ?', [id], callback),
    requireUnlockedOrTemporaryStage(req, res, doc, action, allowed) {
      assert.equal(action, 'status_change');
      if (locked) res.status(403).json({ error: 'Locked stage' }); else allowed(null);
    },
    logActivity() {}, updateProjectActivity() {}, logLockedStageEditUse() {}
  });
  vm.runInContext(controller.slice(controller.indexOf('const updateDocumentRemarks ='), controller.indexOf('const __routeController183 =')) + '\nthis.save = updateDocumentRemarks;', context);
  const save = (remarks, id = 1) => new Promise(resolve => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
    context.save({ body: { remarks }, params: { documentId: id } }, res);
  });
  const note = "Review O'Brien's file\n<script>alert('x')</script>";
  assert.equal((await save(`  ${note}  `)).code, 200);
  assert.equal((await get('SELECT remarks FROM Documents WHERE id = 1')).remarks, note);
  for (const value of [null, {}, 42, 'x'.repeat(2001)]) assert.equal((await save(value)).code, 400);
  locked = true;
  assert.equal((await save('blocked')).code, 403);
  locked = false;
  failWrite = true;
  assert.equal((await save('failed')).code, 500);
  failWrite = false;
  assert.equal((await get('SELECT remarks FROM Documents WHERE id = 1')).remarks, note);
  assert.equal((await save('missing', 99)).code, 404);
  assert.equal((await save('')).code, 200);
  assert.equal((await get('SELECT remarks FROM Documents WHERE id = 1')).remarks, '');

  const routes = read('src/backend/routes/12-documents-and-due-dates.routes.js');
  assert.match(routes, /\/remarks', requireAuth, checkPrivilege\('mark_checked'\), updateDocumentRemarks/);
  const page = read('src/frontend/pages/project-detail.page.html');
  assert.match(page, /Actions<\/th><th[^>]*>Remarks<\/th>/);
  const frontend = read('src/frontend/scripts/04-project-detail-documents.js');
  assert.match(frontend, /esc\(d\.remarks \|\| '-'\)/);
  assert.match(frontend, /colspan="8"/);
  assert.match(controller.slice(controller.indexOf('const __routeController182 =')), /d\.remarks/);
  console.log('Document remarks checks passed: migration, persistence, validation, stage lock, failure handling, clearing, and column wiring.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
