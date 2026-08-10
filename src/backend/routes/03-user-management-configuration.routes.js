// --- USER MANAGEMENT ROUTES (Manage Users privilege) ---

app.get('/api/active-users', requireAuth, __routeController060);

app.post('/api/changelog/feedback', userFeedbackAttachmentUpload.single('attachment'), __routeController061);

app.get('/api/changelog/feedback', requireSystemMaintenance, __routeController062);

const resolveUserFeedbackAttachment = async (feedbackId) => {
  const row = await dbGet(`SELECT attachment_path, attachment_file_name FROM UserFeedback WHERE id = ? AND attachment_path IS NOT NULL`, [Number(feedbackId)]);
  if (!row) return null;
  const full = path.resolve(DATA_DIR, row.attachment_path);
  const root = path.resolve(USER_FEEDBACK_ATTACHMENTS_DIR);
  if (!full.startsWith(`${root}${path.sep}`) || !fs.existsSync(full)) return null;
  return { ...row, full };
};

app.get('/api/changelog/feedback/:id/attachment/view', requireSystemMaintenance, __routeController226);

app.get('/api/changelog/feedback/:id/attachment/download', requireSystemMaintenance, __routeController227);

app.patch('/api/changelog/feedback/:id', requireSystemMaintenance, __routeController063);

// Get all users
app.get('/api/users', requireManageUsers, __routeController064);

// Get single user with privileges
app.get('/api/users/:id', requireManageUsers, __routeController065);

// Create new user
app.post('/api/users', requireManageUsers, __routeController066);

// Update user account fields
app.put('/api/users/:id', requireManageUsers, __routeController067);

// Delete user
app.delete('/api/users/:id', requireManageUsers, __routeController068);

// Update user password
app.put('/api/users/:id/password', requireManageUsers, __routeController069);

app.get('/api/privileges/defaults', requireManageUsers, __routeController070);

// Get all available privileges
app.get('/api/privileges', requireManageUsers, __routeController071);

// Update user privileges
app.put('/api/users/:id/privileges', requireManageUsers, __routeController072);

const tableMap = { 'project-types': 'ProjectTypes', 'requestees': 'Requestees', 'document-types': 'DocumentTypes' };
const privilegeMap = { 'project-types': 'manage_project_types', 'requestees': 'manage_requestees', 'document-types': 'manage_document_types' };
const DOCUMENT_TYPE_CATEGORIES = new Set(['Proposal', 'Implementation']);
const normalizeDocumentTypeCategory = (category) => DOCUMENT_TYPE_CATEGORIES.has(category) ? category : 'Proposal';
const RESERVED_SETTINGS_NAME_PATTERN = /^__(codex|test)_/i;
const isReservedSettingsName = (value = '') => RESERVED_SETTINGS_NAME_PATTERN.test(String(value || '').trim());
const RESERVED_SETTINGS_NAME_ERROR = 'Reserved test placeholder names are not allowed.';
const CONFIG_APPROVAL_SUBMITTED_MESSAGE = 'Configuration change request submitted for Direct Superior approval.';
const CONFIG_APPROVAL_NO_SUPERIOR_MESSAGE = 'Configuration change request cannot be submitted because no Direct Superior is assigned to your account.';
const CONFIG_APPROVAL_DUPLICATE_MESSAGE = 'A pending request already exists for this configuration item. Please wait for your Direct Superior\'s decision before making another change.';
const CONFIG_REQUEST_TABLE = 'ConfigurationChangeRequests';
const CONFIG_AREA_LABELS = {
  'project-types': 'Project Types',
  requestees: 'Requestees',
  'document-types': 'Document Types',
  requirements: 'Requirement Sets',
  'document-due-schedules': 'Due Schedules'
};
const CONFIG_ACTION_LABELS = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  reorder: 'Reorder',
  requirements_update: 'Update Requirement Set',
  due_schedules_update: 'Update Due Schedule',
  requirements_document_type_create: 'Create Document Type'
};

const stableJsonValue = (value) => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableJsonValue(value[key]);
      return acc;
    }, {});
  }
  return value;
};
const stableJsonString = (value) => JSON.stringify(stableJsonValue(value ?? null));
const stableHash = (value) => crypto.createHash('sha256').update(stableJsonString(value)).digest('hex');
const parseStoredJson = (value, fallback = null) => {
  try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
};
const configurationApprovalRequired = (req) => req?.user?.role === 'user' && Number(req.user?.is_system_account || 0) !== 1;
const sendConfigSubmitted = (res, requestId = null) => res.status(202).json({ success: true, pending_approval: true, request_id: requestId, message: CONFIG_APPROVAL_SUBMITTED_MESSAGE });

const getSettingsItemSnapshot = async (type, id) => {
  const table = tableMap[type];
  if (!table) throw new Error('Invalid configuration type.');
  const row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [Number(id)]);
  return row ? stableJsonValue(row) : null;
};

const getSettingsOrderSnapshot = async (type, ids = []) => {
  const table = tableMap[type];
  if (!table) throw new Error('Invalid configuration type.');
  const cleanIds = (ids || []).map(id => Number(id)).filter(Number.isFinite);
  if (!cleanIds.length) return [];
  const rows = await dbAll(`SELECT id, name, order_index FROM ${table} WHERE id IN (${cleanIds.map(() => '?').join(',')}) ORDER BY order_index ASC, id ASC`, cleanIds);
  return stableJsonValue(rows);
};

const getRequirementSnapshot = async ({ projectTypeId, requesteeId, stage }) => {
  const rows = await dbAll(`
    SELECT rs.id as requirement_set_id, rs.project_type_id, rs.requestee_id, rs.stage,
           rsi.document_type_id, rsi.order_index
    FROM RequirementSets rs
    LEFT JOIN RequirementSetItems rsi ON rsi.requirement_set_id = rs.id
    WHERE rs.project_type_id = ? AND rs.requestee_id = ? AND rs.stage = ?
    ORDER BY rsi.order_index ASC, rsi.id ASC
  `, [Number(projectTypeId), Number(requesteeId), stage || 'Proposal']);
  return stableJsonValue(rows || []);
};

const getDueScheduleSnapshot = async (requirementSetId) => {
  if (!requirementSetId) return [];
  const rows = await dbAll(`
    SELECT requirement_set_id, document_type_id as id, due_days, due_hours, document_type_start_point, start_from_document_upload
    FROM RequirementSetDueSchedules
    WHERE requirement_set_id = ?
    ORDER BY document_type_id ASC
  `, [Number(requirementSetId)]);
  return stableJsonValue(rows || []);
};

const validDirectSuperiorForConfigApproval = async (requesterId) => {
  const row = await dbGet(`
    SELECT u.id as requester_id, u.username as requester_username, u.direct_superior_user_id,
           ds.id as superior_id, ds.username as superior_username, ds.role as superior_role,
           COALESCE(ds.is_system_account, 0) as superior_is_system,
           COALESCE(ds.hidden_from_workflows, 0) as superior_hidden
    FROM Users u
    LEFT JOIN Users ds ON ds.id = u.direct_superior_user_id
    WHERE u.id = ?
  `, [Number(requesterId)]);
  if (!row?.superior_id || Number(row.superior_id) === Number(requesterId) || Number(row.superior_is_system || 0) === 1 || Number(row.superior_hidden || 0) === 1) {
    return null;
  }
  return row;
};

const submitConfigurationChangeRequest = async (req, res, change) => {
  const superior = await validDirectSuperiorForConfigApproval(req.user.id);
  if (!superior) {
    logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_FAILED', docType: change.config_section, details: CONFIG_APPROVAL_NO_SUPERIOR_MESSAGE });
    return res.status(400).json({ error: CONFIG_APPROVAL_NO_SUPERIOR_MESSAGE });
  }

  const oldJson = stableJsonString(change.old_value ?? null);
  const newJson = stableJsonString(change.new_value ?? null);
  const existing = await dbGet(`
    SELECT id FROM ${CONFIG_REQUEST_TABLE}
    WHERE requester_user_id = ? AND status = 'pending'
      AND COALESCE(config_table, config_section) = COALESCE(?, ?)
      AND COALESCE(config_key, '') = COALESCE(?, '')
      AND COALESCE(target_id, 0) = COALESCE(?, 0)
      AND action_type = ?
    ORDER BY id DESC LIMIT 1
  `, [req.user.id, change.config_table || change.config_section, change.config_section, change.config_key || null, change.target_id || null, change.action_type]);
  if (existing) return res.status(409).json({ error: CONFIG_APPROVAL_DUPLICATE_MESSAGE, pending_approval: true, request_id: existing.id });

  const result = await dbRun(`
    INSERT INTO ${CONFIG_REQUEST_TABLE} (
      requester_user_id, requester_username, direct_superior_user_id, direct_superior_username,
      config_area, config_table, config_section, config_key, target_id, target_display_name,
      action_type, current_value_json, requested_change_json, current_snapshot_hash,
      requested_snapshot_hash, human_summary, old_value_json, new_value_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    req.user.username,
    superior.superior_id,
    superior.superior_username,
    change.config_area || CONFIG_AREA_LABELS[change.config_section] || change.config_section,
    change.config_table || change.config_section,
    change.config_section,
    change.config_key || null,
    change.target_id || null,
    change.target_display_name || null,
    change.action_type,
    oldJson,
    newJson,
    stableHash(change.old_value ?? null),
    stableHash(change.new_value ?? null),
    change.human_summary || '',
    oldJson,
    newJson
  ]);

  insertNotifications({
    recipients: [superior.superior_id],
    actorId: req.user.id,
    type: 'configuration_approval_request',
    message: `${req.user.username} submitted a Configuration change request for your approval.`,
    targetKind: 'settings',
    targetMeta: { section: 'pending-confirmations', request_id: result.lastID, config_section: change.config_section },
    alertKey: `configuration_change_request:${result.lastID}`
  });
  logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_SUBMITTED', docType: change.config_section, details: `${change.action_type} request #${result.lastID} submitted for Direct Superior approval.` });
  return sendConfigSubmitted(res, result.lastID);
};

const normalizeConfigRequestRow = (row = {}) => ({
  ...row,
  current_value: parseStoredJson(row.current_value_json, null),
  requested_change: parseStoredJson(row.requested_change_json, null),
  current_now: parseStoredJson(row.current_now_json, null),
  old_value: parseStoredJson(row.old_value_json, null),
  new_value: parseStoredJson(row.new_value_json, null)
});

const field = (label, value) => ({ label, value: value === null || value === undefined || value === '' ? '-' : String(value) });
const formatDueText = (item = {}) => {
  const days = Number(item.due_days || 0);
  const hours = Number(item.due_hours || 0);
  const parts = [];
  if (days) parts.push(`${days} working day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  const duration = parts.length ? parts.join(', ') : 'No due duration';
  if (Number(item.start_from_document_upload || 0) === 1) return `${duration} after ${item.start_doc_name || item.start_document_name || 'selected document'} upload`;
  return `${duration} after project creation`;
};
const settingsItemFields = (value = {}) => {
  if (!value) return [field('Status', 'Not existing')];
  return [
    field('Name', value.name),
    value.category !== undefined ? field('Category', value.category || 'Proposal') : null,
    value.due_days !== undefined || value.due_hours !== undefined ? field('Due', formatDueText(value)) : null,
    value.order_index !== undefined ? field('Display Order', value.order_index) : null
  ].filter(Boolean);
};
const requirementFields = async (value = {}) => {
  const projectType = await dbGet('SELECT name FROM ProjectTypes WHERE id = ?', [Number(value.projectTypeId || value.project_type_id || 0)]).catch(() => null);
  const requestee = await dbGet('SELECT name FROM Requestees WHERE id = ?', [Number(value.requesteeId || value.requestee_id || 0)]).catch(() => null);
  const items = Array.isArray(value.items) ? value.items : [];
  const names = [];
  for (const item of items) {
    const row = await dbGet('SELECT name FROM DocumentTypes WHERE id = ?', [Number(item.document_type_id || item.id || 0)]).catch(() => null);
    if (row?.name) names.push(row.name);
  }
  return [
    field('Project Type', projectType?.name || value.projectTypeId || value.project_type_id),
    field('Requestee', requestee?.name || value.requesteeId || value.requestee_id),
    field('Stage', value.stage || 'Proposal'),
    field('Required Documents', names.length ? names.join(', ') : 'No required documents')
  ];
};
const snapshotRequirementFields = async (rows = []) => {
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) return [field('Requirement', 'Not included')];
  return requirementFields({
    projectTypeId: first.project_type_id,
    requesteeId: first.requestee_id,
    stage: first.stage,
    items: rows.filter(r => r.document_type_id).map(r => ({ document_type_id: r.document_type_id }))
  });
};
const dueScheduleFields = async (value = {}) => {
  const items = Array.isArray(value.items) ? value.items : (Array.isArray(value) ? value : []);
  if (!items.length) return [field('Due Schedule', 'No due schedules configured')];
  const lines = [];
  for (const item of items) {
    const row = await dbGet('SELECT name FROM DocumentTypes WHERE id = ?', [Number(item.id || item.document_type_id || 0)]).catch(() => null);
    lines.push(`${row?.name || `Document #${item.id || item.document_type_id}`}: ${formatDueText(item)}`);
  }
  return [field('Schedule', lines.join('\n'))];
};
const formatConfigurationChangePreview = async (request, reqUser = null) => {
  const current = parseStoredJson(request.current_value_json || request.old_value_json, null);
  const requested = parseStoredJson(request.requested_change_json || request.new_value_json, null);
  const currentNow = await currentSnapshotForConfigurationRequest(request).catch(() => null);
  const currentChanged = stableJsonString(currentNow) !== stableJsonString(current);
  const configAreaLabel = request.config_area || CONFIG_AREA_LABELS[request.config_section] || request.config_section || 'Configuration';
  const actionLabel = CONFIG_ACTION_LABELS[request.action_type] || request.action_type || 'Change';
  const title = `${actionLabel} ${configAreaLabel}`;
  let currentFields = [];
  let requestedChangeFields = [];
  if (request.action_type === 'requirements_update') {
    currentFields = await snapshotRequirementFields(current || []);
    requestedChangeFields = await requirementFields(requested || {});
  } else if (request.action_type === 'due_schedules_update') {
    currentFields = await dueScheduleFields(current || []);
    requestedChangeFields = await dueScheduleFields(requested || {});
  } else if (request.action_type === 'reorder') {
    currentFields = (Array.isArray(current) ? current : []).map((item, index) => field(`#${index + 1}`, item.name || `Item ${item.id}`));
    requestedChangeFields = (requested.items || []).map((item, index) => field(`#${index + 1}`, `Item #${item.id}`));
  } else if (request.action_type === 'delete') {
    currentFields = settingsItemFields(current);
    requestedChangeFields = [field('Requested Change', 'Deleted')];
  } else {
    currentFields = settingsItemFields(current);
    requestedChangeFields = settingsItemFields(requested);
  }
  const currentNowFields = currentChanged
    ? (request.action_type === 'requirements_update' ? await snapshotRequirementFields(currentNow || [])
      : request.action_type === 'due_schedules_update' ? await dueScheduleFields(currentNow || [])
      : settingsItemFields(currentNow))
    : [];
  const warnings = [];
  if (request.conflict_reason) warnings.push(request.conflict_reason);
  else if (currentChanged && request.status === 'pending') warnings.push('Current configuration has changed since this request was submitted.');
  const canApprove = request.status === 'pending'
    && Number(request.requester_user_id) !== Number(reqUser?.id || 0)
    && (reqUser?.role === 'superadmin' || Number(request.direct_superior_user_id) === Number(reqUser?.id || 0))
    && !currentChanged;
  return {
    title,
    summary: request.human_summary || `${request.requester_username} requested ${actionLabel.toLowerCase()} in ${configAreaLabel}.`,
    configAreaLabel,
    actionLabel,
    target: request.target_display_name || request.config_key || '-',
    currentFields,
    requestedChangeFields,
    currentNowFields,
    warnings,
    conflictStatus: request.status === 'conflict' || request.status === 'already_changed' || currentChanged ? (request.status === 'pending' ? 'potential_conflict' : request.status) : '',
    canApprove
  };
};

app.get('/api/configuration-change-requests', __routeController073);

app.get('/api/configuration-change-requests/pending-count', __routeController074);

app.get('/api/configuration-change-requests/:id', __routeController075);

app.post('/api/configuration-change-requests/:id/approve', __routeController076);

app.post('/api/configuration-change-requests/:id/clear-stale', __routeController077);

app.post('/api/configuration-change-requests/:id/reject', __routeController078);

app.post('/api/configuration-change-requests/:id/cancel', __routeController079);

const applySettingsCreate = async ({ type, name, category }) => {
  const table = tableMap[type];
  await dbRun('BEGIN TRANSACTION');
  try {
    await dbRun(`UPDATE ${table} SET order_index = order_index + 1`);
    const sql = table === 'DocumentTypes'
      ? `INSERT INTO ${table} (name, category, order_index) VALUES (?, ?, 0)`
      : `INSERT INTO ${table} (name, order_index) VALUES (?, 0)`;
    const params = table === 'DocumentTypes' ? [name, normalizeDocumentTypeCategory(category)] : [name];
    const result = await dbRun(sql, params);
    await dbRun('COMMIT');
    return result;
  } catch (e) {
    await dbRun('ROLLBACK').catch(() => {});
    throw e;
  }
};

const applySettingsUpdate = async ({ type, id, name, category }) => {
  const table = tableMap[type];
  const sql = table === 'DocumentTypes'
    ? `UPDATE ${table} SET name = ?, category = ? WHERE id = ?`
    : `UPDATE ${table} SET name = ? WHERE id = ?`;
  const params = table === 'DocumentTypes' ? [name, normalizeDocumentTypeCategory(category), Number(id)] : [name, Number(id)];
  return dbRun(sql, params);
};

const applySettingsDelete = async ({ type, id }) => dbRun(`DELETE FROM ${tableMap[type]} WHERE id = ?`, [Number(id)]);

const applySettingsReorder = async ({ type, items }) => {
  const table = tableMap[type];
  await dbRun('BEGIN TRANSACTION');
  try {
    for (const item of items || []) await dbRun(`UPDATE ${table} SET order_index = ? WHERE id = ?`, [Number(item.order_index), Number(item.id)]);
    await dbRun('COMMIT');
  } catch (e) {
    await dbRun('ROLLBACK').catch(() => {});
    throw e;
  }
};

const applyDueSchedules = async ({ requirement_set_id, items }) => {
  await dbRun('BEGIN TRANSACTION');
  try {
    for (const item of items || []) {
      const days = Math.max(0, parseInt(item.due_days || 0, 10) || 0);
      const hours = Math.max(0, parseInt(item.due_hours || 0, 10) || 0);
      const startPoint = item.document_type_start_point || 0;
      const startFromUpload = item.start_from_document_upload ? 1 : 0;
      await dbRun(`INSERT INTO RequirementSetDueSchedules
        (requirement_set_id, document_type_id, due_days, due_hours, document_type_start_point, start_from_document_upload)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(requirement_set_id, document_type_id) DO UPDATE SET
          due_days=excluded.due_days,
          due_hours=excluded.due_hours,
          document_type_start_point=excluded.document_type_start_point,
          start_from_document_upload=excluded.start_from_document_upload`,
        [Number(requirement_set_id), Number(item.id), days, hours, startPoint, startFromUpload]);
    }
    await dbRun('COMMIT');
  } catch (e) {
    await dbRun('ROLLBACK').catch(() => {});
    throw e;
  }
};

const applyRequirementsConfig = async ({ projectTypeId, requesteeId, stage, items }) => {
  const currentStage = stage || 'Proposal';
  const submittedItems = Array.isArray(items) ? items : [];
  await dbRun('BEGIN TRANSACTION');
  try {
    let set = await dbGet("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [Number(projectTypeId), Number(requesteeId), currentStage]);
    if (!set) {
      const result = await dbRun("INSERT INTO RequirementSets (project_type_id, requestee_id, stage) VALUES (?, ?, ?)", [Number(projectTypeId), Number(requesteeId), currentStage]);
      set = { id: result.lastID };
    } else {
      await dbRun("DELETE FROM RequirementSetItems WHERE requirement_set_id = ?", [set.id]);
    }
    for (const item of submittedItems) {
      await dbRun("INSERT INTO RequirementSetItems (requirement_set_id, document_type_id, order_index) VALUES (?, ?, ?)", [set.id, Number(item.document_type_id), Number(item.order_index)]);
    }
    await dbRun('COMMIT');
    return { requirement_set_id: set.id, saved_count: submittedItems.length };
  } catch (e) {
    await dbRun('ROLLBACK').catch(() => {});
    throw e;
  }
};

const currentSnapshotForConfigurationRequest = async (request) => {
  const next = parseStoredJson(request.requested_change_json || request.new_value_json, {});
  switch (request.action_type) {
    case 'create': {
      const table = tableMap[next.type || request.config_section];
      if (!table || !next.name) return null;
      const row = await dbGet(`SELECT * FROM ${table} WHERE LOWER(name) = LOWER(?)`, [String(next.name).trim()]);
      return row ? stableJsonValue(row) : null;
    }
    case 'requirements_document_type_create': {
      if (!next.name) return null;
      const row = await dbGet(`SELECT * FROM DocumentTypes WHERE LOWER(name) = LOWER(?)`, [String(next.name).trim()]);
      return row ? stableJsonValue(row) : null;
    }
    case 'update':
    case 'delete':
      return getSettingsItemSnapshot(request.config_section, next.id);
    case 'reorder':
      return getSettingsOrderSnapshot(request.config_section, (next.items || []).map(item => item.id));
    case 'requirements_update':
      return getRequirementSnapshot(next);
    case 'due_schedules_update':
      return getDueScheduleSnapshot(next.requirement_set_id);
    default:
      throw new Error('Unsupported configuration request action.');
  }
};

const applyConfigurationRequestChange = async (request, req) => {
  const next = parseStoredJson(request.requested_change_json || request.new_value_json, {});
  switch (request.action_type) {
    case 'create':
      await applySettingsCreate(next);
      break;
    case 'requirements_document_type_create':
      await applySettingsCreate({ type: 'document-types', name: next.name, category: next.category });
      break;
    case 'update':
      await applySettingsUpdate(next);
      break;
    case 'delete':
      await applySettingsDelete(next);
      break;
    case 'reorder':
      await applySettingsReorder(next);
      break;
    case 'requirements_update':
      await applyRequirementsConfig(next);
      break;
    case 'due_schedules_update':
      await applyDueSchedules(next);
      break;
    default:
      throw new Error('Unsupported configuration request action.');
  }
  logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_APPLIED', docType: request.config_section, details: `Applied configuration request #${request.id}.` });
};

const getSettingsDeleteDependencyMessage = async (request) => {
  const next = parseStoredJson(request.requested_change_json || request.new_value_json, {});
  const id = Number(next.id || request.target_id || 0);
  if (!id) return '';
  if (request.config_section === 'project-types') {
    const row = await dbGet('SELECT COUNT(*) as count FROM Projects WHERE project_type_id = ?', [id]);
    return Number(row?.count || 0) ? `Cannot delete because ${row.count} project(s) still use this project type.` : '';
  }
  if (request.config_section === 'requestees') {
    const row = await dbGet('SELECT COUNT(*) as count FROM Projects WHERE requestee_id = ?', [id]);
    return Number(row?.count || 0) ? `Cannot delete because ${row.count} project(s) still use this requestee.` : '';
  }
  if (request.config_section === 'document-types') {
    const reqItem = await dbGet('SELECT COUNT(*) as count FROM RequirementSetItems WHERE document_type_id = ?', [id]);
    const docs = await dbGet('SELECT COUNT(*) as count FROM Documents WHERE document_type_id = ?', [id]);
    const total = Number(reqItem?.count || 0) + Number(docs?.count || 0);
    return total ? `Cannot delete because this document type is still used by ${total} requirement/document record(s).` : '';
  }
  return '';
};

const ensureNoConfigurationConflict = async (request) => {
  const oldValue = parseStoredJson(request.current_value_json || request.old_value_json, null);
  const current = await currentSnapshotForConfigurationRequest(request);
  if (stableJsonString(current) !== stableJsonString(oldValue)) {
    const createdBeforeApproval = (request.action_type === 'create' || request.action_type === 'requirements_document_type_create') && current;
    return {
      status: createdBeforeApproval ? 'already_changed' : 'conflict',
      message: createdBeforeApproval
        ? 'Cannot apply because this configuration item already exists.'
        : 'Cannot apply because the configuration has changed since request submission.',
      current_now: current
    };
  }
  if (request.action_type === 'delete') {
    const dependencyMessage = await getSettingsDeleteDependencyMessage(request);
    if (dependencyMessage) {
      return { status: 'conflict', message: dependencyMessage, current_now: current };
    }
  }
  return null;
};

app.patch('/api/settings/reorder/:type', __routeController080);

async function processReorder(req, res, table) {
  try {
    const type = req.params.type;
    const items = Array.isArray(req.body) ? req.body : [];
    if (configurationApprovalRequired(req)) {
      const oldValue = await getSettingsOrderSnapshot(type, items.map(item => item.id));
      return submitConfigurationChangeRequest(req, res, {
        config_section: type,
        config_table: type,
        config_key: 'order',
        target_display_name: 'Display order',
        action_type: 'reorder',
        old_value: oldValue,
        new_value: { type, items },
        human_summary: `${req.user.username} requested to reorder ${CONFIG_AREA_LABELS[type] || type}.`
      });
    }
    await applySettingsReorder({ type, items });
    try { 
      logActivity({
        req,
        action: 'SETTINGS_REORDER',
        projectId: null,
        project: '-',
        requester: '-',
        docType: type,
        details: `Reordered ${items.length} items`
      }); 
    } catch(e) {}
    res.json({success: true});
  } catch (err) {
    res.status(500).json({ error: err.message || 'Reorder failed.' });
  }
}

const setupSettings = (type, table) => {
  const privilegeMap = { 
    'project-types': 'manage_project_types', 
    'requestees': 'manage_requestees', 
    'document-types': 'manage_document_types' 
  };
  const requiredPrivilege = privilegeMap[type];
  
  app.get(`/api/settings/${type}`, (req, res) => {
    if (table === 'DocumentTypes') {
      const category = req.query.category || req.query.stage;
      const params = [];
      let where = '';
      if (category && DOCUMENT_TYPE_CATEGORIES.has(category)) {
        where = 'WHERE dt.category = ?';
        params.push(category);
      }
      // Include the name of the trigger document if document_type_start_point is set
      db.all(`SELECT dt.*, trigger_dt.name as start_doc_name 
              FROM ${table} dt 
              LEFT JOIN DocumentTypes trigger_dt ON dt.document_type_start_point = trigger_dt.id
              ${where}
              ORDER BY CASE dt.category WHEN 'Proposal' THEN 0 WHEN 'Implementation' THEN 1 ELSE 2 END, dt.order_index ASC`, params, (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r));
    } else {
      db.all(`SELECT * FROM ${table} ORDER BY order_index ASC`, [], (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r));
    }
  });
  app.post(`/api/settings/${type}`, checkPrivilege(requiredPrivilege), async (req, res) => {
    if (!req.body.name) return res.status(400).json({error:"Name required"});
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({error:"Name required"});
    if (isReservedSettingsName(name)) return res.status(400).json({error: RESERVED_SETTINGS_NAME_ERROR});
    const category = normalizeDocumentTypeCategory(req.body.category);
    try {
      if (configurationApprovalRequired(req)) {
        return submitConfigurationChangeRequest(req, res, {
          config_section: type,
          config_table: type,
          config_key: name,
          target_display_name: name,
          action_type: 'create',
          old_value: null,
          new_value: { type, name, category },
          human_summary: `${req.user.username} requested to create ${name} in ${CONFIG_AREA_LABELS[type] || type}.`
        });
      }
      const result = await applySettingsCreate({ type, name, category });
      try { 
        logActivity({
          req,
          action: 'SETTINGS_ADD',
          projectId: null,
          project: '-',
          requester: '-',
          docType: type,
          details: `Added ${name}`
        }); 
      } catch(e) {}
      res.status(201).json({id: result.lastID, name, category, order_index: 0});
    } catch (err) {
      logError('SETTINGS_ADD', err.message);
      res.status(500).json({error: err.message});
    }
  });
  app.patch(`/api/settings/${type}/:id`, checkPrivilege(requiredPrivilege), async (req, res) => {
    if (!req.body.name || req.body.name.trim() === '') return res.status(400).json({error:"Name required"});
    const name = req.body.name.trim();
    if (isReservedSettingsName(name)) return res.status(400).json({error: RESERVED_SETTINGS_NAME_ERROR});
    const category = normalizeDocumentTypeCategory(req.body.category);
    try {
      const oldValue = await getSettingsItemSnapshot(type, req.params.id);
      if (!oldValue) return res.status(404).json({ error: 'Item not found.' });
      if (configurationApprovalRequired(req)) {
        return submitConfigurationChangeRequest(req, res, {
          config_section: type,
          config_table: type,
          config_key: String(req.params.id),
          target_id: Number(req.params.id),
          target_display_name: oldValue.name || `Item #${req.params.id}`,
          action_type: 'update',
          old_value: oldValue,
          new_value: { type, id: Number(req.params.id), name, category },
          human_summary: `${req.user.username} requested to update ${oldValue.name || `item #${req.params.id}`} in ${CONFIG_AREA_LABELS[type] || type}.`
        });
      }
      const result = await applySettingsUpdate({ type, id: req.params.id, name, category });
      try { 
        logActivity({
          req,
          action: 'SETTINGS_EDIT',
          projectId: null,
          project: '-',
          requester: '-',
          docType: type,
          details: `Edited ID ${req.params.id}`
        }); 
      } catch(e) {}
      res.json({success: true, changes: result.changes});
    } catch (err) {
      res.status(500).json({error: "Update failed"});
    }
  });
  
  app.delete(`/api/settings/${type}/:id`, checkPrivilege(requiredPrivilege), async (req, res) => {
    const id = req.params.id;
    try {
      const oldValue = await getSettingsItemSnapshot(type, id);
      if (!oldValue) return res.status(404).json({ error: 'Item not found.' });
      if (configurationApprovalRequired(req)) {
        return submitConfigurationChangeRequest(req, res, {
          config_section: type,
          config_table: type,
          config_key: String(id),
          target_id: Number(id),
          target_display_name: oldValue.name || `Item #${id}`,
          action_type: 'delete',
          old_value: oldValue,
          new_value: { type, id: Number(id) },
          human_summary: `${req.user.username} requested to delete ${oldValue.name || `item #${id}`} from ${CONFIG_AREA_LABELS[type] || type}.`
        });
      }
      await applySettingsDelete({ type, id });
      logActivity({ req, action: 'SETTINGS_DELETE', project: '-', requester: '-', docType: type, details: `Deleted ID ${id}` });
      res.json({ success: true });
    } catch (err) {
      logError('SETTINGS_DELETE_FAIL', err.message);
      res.status(500).json({ error: "Cannot delete. Item may be in use." });
    }
  });
};

setupSettings('project-types', 'ProjectTypes');
setupSettings('requestees', 'Requestees');
setupSettings('document-types', 'DocumentTypes');
