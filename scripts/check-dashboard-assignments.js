const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const db = new (require('sqlite3').Database)(':memory:');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, err => err ? reject(err) : resolve()));
const context = vm.createContext({
  db, dbRun, dbGet: async (sql, params) => (await dbAll(sql, params))[0],
  INACTIVE_PROJECT_OUTCOMES: ['Cancelled', 'Deferred', 'Disapproved'],
  getEffectiveDueDate: (row, callback) => callback(null, { effective_due_date: row.manual_due_date, due_date_source: 'manual' }),
  canAssignDocuments: user => user.role === 'admin',
  forbidden: res => res.status(403).json({ error: 'Forbidden' }),
  normalizeRequirementState: value => value || 'Required',
  canEditLockedStage: (req, doc, action, callback) => callback(null, { allowed: true }),
  logActivity() {}, insertNotifications() {}, updateProjectActivity() {}, logLockedStageEditUse() {}
});
vm.runInContext(read('src/backend/controllers/12-documents-and-due-dates.controller.js'), context);
vm.runInContext(read('src/backend/controllers/10-projects.controller.js'), context);
const call = (name, body = {}, role = 'admin') => new Promise((resolve, reject) => {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
  Promise.resolve(vm.runInContext(name, context)({ body, user: { id: 1, username: 'Owner', role } }, res)).catch(reject);
});

async function main() {
  await dbRun('CREATE TABLE Users (id INTEGER PRIMARY KEY, username TEXT, role TEXT, hidden_from_workflows INTEGER)');
  await dbRun('CREATE TABLE Projects (id INTEGER PRIMARY KEY, name TEXT, requester TEXT, created_at TEXT, stage TEXT, outcome TEXT, assigned_user_id INTEGER, project_type_id INTEGER, requestee_id INTEGER, last_activity_at TEXT)');
  await dbRun('CREATE TABLE Documents (id INTEGER PRIMARY KEY, project_id INTEGER, document_type_id INTEGER, document_type_name TEXT, file_path TEXT, file_name TEXT, status TEXT, upload_date TEXT, document_date TEXT, stage TEXT, requirement_state TEXT, remarks TEXT, uploader_user_id INTEGER, assigned_user_id INTEGER, manual_due_date TEXT, due_date_override TEXT, due_date TEXT)');
  await dbRun('CREATE TABLE DocumentTypes (id INTEGER PRIMARY KEY, due_days INTEGER, due_hours INTEGER, document_type_start_point INTEGER, start_from_document_upload INTEGER)');
  await dbRun('CREATE TABLE RequirementSets (id INTEGER PRIMARY KEY, project_type_id INTEGER, requestee_id INTEGER, stage TEXT)');
  await dbRun('CREATE TABLE RequirementSetDueSchedules (requirement_set_id INTEGER, document_type_id INTEGER, due_days INTEGER, due_hours INTEGER, document_type_start_point INTEGER, start_from_document_upload INTEGER)');
  await dbRun('CREATE TABLE Requestees (id INTEGER PRIMARY KEY, name TEXT)');
  for (const table of ['ProjectOwnershipHistory', 'DocumentOwnershipHistory']) {
    await dbRun(`CREATE TABLE ${table} (document_id INTEGER, project_id INTEGER, previous_owner_id INTEGER, previous_owner_username TEXT, new_owner_id INTEGER, new_owner_username TEXT, actor_user_id INTEGER, actor_username TEXT, action TEXT)`);
  }
  await dbRun("INSERT INTO Users VALUES (1, 'Owner', 'admin', 0), (2, 'Assignee', 'user', 0)");
  await dbRun("INSERT INTO Projects (id, name, stage, outcome) VALUES (1, 'Test project', 'Proposal', 'Active')");
  for (let id = 1; id <= 4; id++) {
    await dbRun("INSERT INTO Documents (id, project_id, document_type_name, stage, requirement_state, status, assigned_user_id, uploader_user_id, file_path) VALUES (?, 1, 'Test document', 'Proposal', 'Required', ?, ?, ?, ?)",
      [id, id === 3 ? 'Checked' : id === 2 ? 'For Review' : 'Pending', id <= 2 ? 2 : null, id === 2 ? 1 : null, id === 2 || id === 3 ? 'test.pdf' : null]);
  }
  let result = await call('__routeController178');
  assert.equal(result.code, 200, JSON.stringify(result.body));
  assert.equal(result.body.length, 4, 'Each document must appear exactly once, even without an uploader');
  assert.equal(result.body[1].uploader_username, 'Owner');
  assert.equal(result.body[1].assigned_username, 'Assignee');

  const elements = new Map();
  const errors = [];
  const ui = vm.createContext({
    window: { allDocumentsCache: result.body }, setInterval() {},
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, { value: '', addEventListener() {}, classList: { toggle() {} } }); return elements.get(id); } },
    projCache: [{ id: 1, stage: 'Proposal', outcome: 'Active' }],
    currentUser: { id: 2 }, isSuperAdmin: () => false, projectOutcome: p => p.outcome || 'Active',
    DASH_TAB_IDS: {}, PROJECT_OUTCOMES: ['Active'], INACTIVE_PROJECT_OUTCOMES: [],
    API: '/api', dashboardSavedFilters: {}, dashboardOutcomeFilter: 'Active', esc: String, filterVisibleWorkUsers: users => users,
    fetchJson: async url => { if (url === '/api/documents') throw new Error('Document service unavailable'); return []; },
    toast: message => errors.push(message)
  });
  vm.runInContext(read('src/frontend/scripts/02-auth-dashboard.js'), ui);
  const documentSource = read('src/frontend/scripts/04-project-detail-documents.js');
  vm.runInContext(documentSource.slice(documentSource.indexOf('    async function loadDash('), documentSource.indexOf('    function getProjectWorkMetrics(')), ui);
  ui.updateDashboardClock = () => {};
  ui.updateDashboardCounts(ui.projCache);
  assert.equal(elements.get('metricUploaded').textContent, 2);
  assert.equal(elements.get('metricReviewed').textContent, 1);
  assert.equal(elements.get('metricForReview').textContent, 1);
  assert.equal(elements.get('metricAssignedDocs').textContent, 2);
  assert.equal(ui.getMyAssignmentAttentionCount(), 2);
  assert.equal(ui.getWorkAssignmentUnassignedCount(), 2, 'One unassigned project and one unfinished document');

  const items = [{ kind: 'document', id: 4 }, { kind: 'project', id: 1 }];
  assert.equal((await call('__routeController164', { items, assigned_user_id: 2 }, 'user')).code, 403);
  result = await call('__routeController164', { items, assigned_user_id: 2 });
  assert.equal(result.body.assigned, 2, JSON.stringify(result.body));
  assert.equal(result.body.skipped, 0);
  ui.window.allDocumentsCache = (await call('__routeController178')).body;
  ui.projCache = await dbAll('SELECT * FROM Projects');
  assert.equal(ui.getMyAssignmentAttentionCount(), 4, 'Bulk assignments must be visible to the assigned user');
  assert.equal(ui.getWorkAssignmentUnassignedCount(), 0);
  const cached = ui.window.allDocumentsCache;
  await ui.loadDash({ silent: true });
  assert.equal(ui.window.allDocumentsCache, cached, 'A failed refresh must preserve documents');
  assert.match(errors[0], /Unable to refresh dashboard: Document service unavailable/);
  console.log('Dashboard assignment checks passed: real SQLite query, metrics, personal/global queues, bulk assignment, authorization and failed-refresh recovery.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
