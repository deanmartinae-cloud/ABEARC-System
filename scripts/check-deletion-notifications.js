const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const db = new (require('sqlite3').Database)(':memory:');
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbGet = async (sql, params) => (await dbAll(sql, params))[0];
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
const source = fs.readFileSync(path.join(__dirname, '../src/backend/controllers/02-user-profile-notifications.controller.js'), 'utf8');
const events = [], sent = [];
const parseNotificationMeta = value => typeof value === 'string' ? JSON.parse(value) : value;
const context = vm.createContext({
  db, dbAll, dbGet, dbRun, parseNotificationMeta,
  hydrateNotificationRow: (row, extra) => ({ ...row, ...extra }),
  sendNotificationEvent: (userId, row) => events.push({ userId, row }),
  inferNotificationEventAction: () => 'notification',
  deletionRequestSelect: 'SELECT * FROM DeletionRequests dr',
  canBypassAssignmentOwnership: async () => false,
  performApprovedDeletionRequest: async () => 'test.pdf',
  insertNotifications: row => sent.push(row), logActivity() {}, logError() {},
  forbidden: res => res.status(403).json({ error: 'Forbidden' })
});
vm.runInContext(source, context);
const call = (name, userId = 1, id = 1) => new Promise((resolve, reject) => {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
  context[name] = vm.runInContext(name, context);
  Promise.resolve(context[name]({ user: { id: userId }, params: { id }, query: {}, body: {} }, res)).catch(reject);
});

async function main() {
  await dbRun('CREATE TABLE Users (id INTEGER, username TEXT)');
  await dbRun(`CREATE TABLE DeletionRequests (id INTEGER PRIMARY KEY, status TEXT, owner_user_id INTEGER,
    requested_by_user_id INTEGER, responded_at TEXT, responded_by_user_id INTEGER, response_note TEXT,
    target_snapshot TEXT, target_type TEXT, target_id INTEGER, project_id INTEGER, document_id INTEGER)`);
  await dbRun(`CREATE TABLE Notifications (id INTEGER PRIMARY KEY, recipient_user_id INTEGER, actor_user_id INTEGER,
    type TEXT, priority TEXT, message TEXT, project_id INTEGER, project_name TEXT, document_id INTEGER,
    document_name TEXT, stage TEXT, target_kind TEXT, target_meta TEXT, alert_key TEXT, alert_date TEXT,
    read_at TEXT, created_at TEXT, updated_at TEXT)`);
  for (let id = 1; id <= 5; id++) {
    await dbRun(`INSERT INTO DeletionRequests (id, status, owner_user_id, requested_by_user_id, target_snapshot)
      VALUES (?, ?, ?, 9, '{"file_name":"test.pdf"}')`, [id, id === 3 || id === 5 ? 'approved' : 'pending', id === 5 ? 2 : 1]);
    await dbRun(`INSERT INTO Notifications (id, recipient_user_id, type, message, target_kind, target_meta, created_at)
      VALUES (?, ?, 'deletion_request_pending', 'User requested to delete test.pdf. Approve or deny?',
      'deletion_request', ?, '2026-09-22T00:00:00.000Z')`, [id, id === 5 ? 2 : 1, JSON.stringify({ deletion_request_id: id })]);
  }
  assert.equal((await call('__routeController055', 2)).code, 403);
  assert.equal(events.length, 0, 'Unauthorized approval must not resolve notifications');
  assert.equal((await call('__routeController055')).code, 200);
  assert.equal((await call('__routeController056', 1, 2)).code, 200);
  const rows = (await call('__routeController048')).body;
  for (const id of [1, 2, 3]) {
    const row = rows.find(row => row.id === id);
    const status = id === 2 ? 'denied' : 'approved';
    assert.equal(row.type, `deletion_request_${status}`);
    assert.equal(row.target_meta.status, status);
    assert.ok(row.read_at);
    assert.ok(!row.message.includes('Approve or deny?'));
  }
  assert.equal(rows.find(row => row.id === 4).type, 'deletion_request_pending');
  assert.equal((await call('__routeController049')).body.count, 1);
  assert.equal((await dbGet('SELECT type FROM Notifications WHERE id = 5')).type, 'deletion_request_pending');
  assert.equal(events.length, 3, 'Repeated loads must not emit duplicate updates');
  assert.ok(events.every(event => event.userId === 1 && event.row.is_update));
  assert.equal(sent.length, 2, 'Both decisions still notify the requester');
  // A historical decision is repaired even when unread-count is loaded first.
  assert.equal((await call('__routeController049', 2)).body.count, 0);
  console.log('Deletion notification checks passed (approve, deny, old decisions, unread count, recipient isolation, realtime updates).');
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => db.close());
