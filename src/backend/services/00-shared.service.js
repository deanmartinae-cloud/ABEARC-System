
// Helper to get user privileges
const getUserPrivileges = (userId, callback) => {
  db.all("SELECT privilege, enabled FROM UserPrivileges WHERE user_id = ?", [userId], (err, rows) => {
    if (err) return callback(err, []);
    const privileges = {};
    (rows || []).forEach(row => {
      privileges[row.privilege] = row.enabled === 1;
    });
    callback(null, privileges);
  });
};

// Helper to check if user has a privilege (for frontend use)
const userHasPrivilege = (user, privilege, userPrivileges) => {
  if (canRoleBypassPrivilege(user, privilege)) return true;
  return userPrivileges[privilege] === true;
};

const userHasPrivilegeAsync = async (user, privilege) => {
  if (!user) return false;
  if (canRoleBypassPrivilege(user, privilege)) return true;
  const row = await dbGet("SELECT enabled FROM UserPrivileges WHERE user_id = ? AND privilege = ?", [user.id, privilege]);
  return row?.enabled === 1;
};

const userHasExplicitPrivilegeAsync = async (user, privilege) => {
  if (!user) return false;
  const row = await dbGet("SELECT enabled FROM UserPrivileges WHERE user_id = ? AND privilege = ?", [user.id, privilege]);
  return row?.enabled === 1;
};

const canBypassAssignmentOwnership = async (user) => {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return userHasPrivilegeAsync(user, 'bypass_assignment_ownership');
};

const canMarkProjectDispositionForProject = async (user, project) => {
  if (!user || !project) return false;
  if (user.role === 'superadmin') return true;
  const assignedId = Number(project.assigned_user_id || 0);
  if (assignedId) return assignedId === Number(user.id || 0);
  return userHasPrivilegeAsync(user, 'manage_project_disposition');
};

const requireDocumentAssignmentOwner = async (req, res, doc, actionLabel, next, onDeniedCleanup = null) => {
  if (!doc?.assigned_user_id) return next();
  const allowed = Number(req.user?.id) === Number(doc.assigned_user_id) || await canBypassAssignmentOwnership(req.user);
  if (allowed) return next();
  if (onDeniedCleanup) onDeniedCleanup();
  return res.status(403).json({ error: 'This document is assigned to another user.' });
};

const requireProjectAssignmentOwner = async (req, res, project, actionLabel, next) => {
  if (!project?.assigned_user_id) return next();
  const allowed = Number(req.user?.id) === Number(project.assigned_user_id) || await canBypassAssignmentOwnership(req.user);
  if (allowed) return next();
  return res.status(403).json({ error: 'This project is assigned to another user.' });
};

const getProjectNotificationOwnerIds = (projectId, callback) => {
  db.get(`
    SELECT p.assigned_user_id,
           (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY created_at ASC LIMIT 1) as creator_user_id
    FROM Projects p
    WHERE p.id = ?
  `, [projectId], (err, row) => {
    if (err) return callback(err, []);
    callback(null, uniqueIds([row?.assigned_user_id || row?.creator_user_id]));
  });
};

const getProjectCreator = async (projectId) => {
  return dbGet(`
    SELECT u.id, u.username
    FROM ActivityLogs al
    JOIN Users u ON u.id = al.user_id
    WHERE al.project_id = ? AND al.action = 'CREATE_PROJECT' AND al.user_id IS NOT NULL
    ORDER BY datetime(al.created_at) ASC, al.id ASC
    LIMIT 1
  `, [projectId]);
};

const createDeletionRequest = async ({ req, targetType, targetId, projectId = null, documentId = null, ownerUserId, ownerUsername = '', reason = '', targetSnapshot = {}, targetName = '' }) => {
  if (!ownerUserId) throw new Error('Deletion request owner is required.');
  const existing = await dbGet(`
    SELECT *
    FROM DeletionRequests
    WHERE target_type = ? AND target_id = ? AND requested_by_user_id = ? AND owner_user_id = ? AND status = 'pending'
    ORDER BY id DESC
    LIMIT 1
  `, [targetType, targetId, req.user.id, ownerUserId]);
  if (existing) {
    return { existing: true, request: existing, message: 'A deletion request is already pending.' };
  }
  const snapshotJson = JSON.stringify(targetSnapshot || {});
  const result = await dbRun(`
    INSERT INTO DeletionRequests (
      target_type, target_id, project_id, document_id, requested_by_user_id, requested_by_username,
      owner_user_id, owner_username, reason, target_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [targetType, targetId, projectId, documentId, req.user.id, req.user.username, ownerUserId, ownerUsername || '', reason || '', snapshotJson]);
  const requestId = result.lastID;
  insertNotifications({
    recipients: [ownerUserId],
    actorId: req.user.id,
    type: 'deletion_request_pending',
    message: `${req.user.username} requested to delete ${targetName || targetType}. Approve or deny?`,
    projectId,
    documentId,
    documentName: targetSnapshot?.document_type_name || '',
    projectName: targetSnapshot?.project_name || targetSnapshot?.name || '',
    targetKind: 'deletion_request',
    targetMeta: { deletion_request_id: requestId, target_type: targetType, target_id: Number(targetId), project_id: projectId, document_id: documentId },
    includeActor: false
  });
  logActivity({ req, action: 'DELETE_REQUEST_CREATED', projectId, project: targetSnapshot?.project_name || targetSnapshot?.name || '', docType: targetSnapshot?.document_type_name || targetType, details: `Requested deletion of ${targetName || targetType}` });
  return { existing: false, request: { id: requestId }, message: 'Deletion request sent to the owner for confirmation.' };
};

const deletionRequestResponse = (res, result) => res.status(202).json({
  pending_approval: true,
  existing: !!result.existing,
  deletion_request_id: result.request?.id,
  message: result.message || 'Deletion request sent to the owner for confirmation.'
});

const requireCalendarView = (req, res, next) => checkPrivilege('view_calendar')(req, res, next);

const privilegeDisplayName = (privilege) => {
  const meta = PRIVILEGE_CATALOG.find(p => p.name === privilege);
  return meta?.display_name || String(privilege || '').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
};

const listPrivilegeNames = (privileges = []) => privileges.map(privilegeDisplayName);

const notificationClients = new Map();

const sendNotificationEvent = (userId, payload) => {
  const clients = notificationClients.get(Number(userId));
  if (!clients) return;
  const message = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(client => {
    try { client.write(message); } catch (e) {}
  });
};

const parseNotificationMeta = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return {}; }
};

const hydrateNotificationRow = (row = {}, extra = {}) => {
  const meta = parseNotificationMeta(row.target_meta);
  return {
    ...row,
    target_meta: meta,
    changed_fields: meta.changed_fields || [],
    event_action: meta.event_action || inferNotificationEventAction(row.type, row.target_kind),
    is_update: false,
    ...extra
  };
};

const notificationPriority = (type = '') => {
  const t = String(type || '').toLowerCase();
  if (t.includes('overdue') || t.includes('weather_station_offline') || t.includes('weather_sensor_error')) return 'critical';
  if (t.includes('weather_heavy_rainfall') || t.includes('weather_strong_wind') || t.includes('weather_high_temperature') || t.includes('weather_low_temperature') || t.includes('weather_extended_dry_period') || t.includes('weather_missing_data')) return 'warning';
  if (t.includes('due_today') || t.includes('due_tomorrow') || t.includes('due_soon') || t.includes('due_in_5') || t.includes('manual_due_date') || t.includes('unassigned') || t.includes('missing')) return 'warning';
  if (t.includes('for_review') || t.includes('review')) return t.includes('reviewed') ? 'success' : 'review';
  if (t.includes('completed') || t.includes('reviewed') || t.includes('checked')) return 'success';
  if (t.includes('requirement')) return 'warning';
  if (t.includes('permission') || t.includes('password') || t.includes('role')) return 'info';
  return 'info';
};

const inferNotificationEventAction = (type = '', targetKind = '') => {
  const t = String(type || '').toLowerCase();
  const k = String(targetKind || '').toLowerCase();
  if (t.includes('project_created') || t.includes('create_project')) return 'project_created';
  if (t.includes('project_deleted') || t.includes('delete_project')) return 'project_deleted';
  if (t.includes('project_assignment') || t.includes('owner_assigned') || t.includes('assigned_project')) return 'project_assignment_changed';
  if (t.includes('stage') || t.includes('transition') || t.includes('completed_project') || k === 'stage') return 'stage_transitioned';
  if (t.includes('document_deleted') || t.includes('delete_document')) return 'document_deleted';
  if (t.includes('project_documentation') || k === 'project_documentation') return 'project_documentation';
  if (t.includes('document_uploaded') || t.includes('uploaded') || t.includes('for_review')) return 'document_uploaded';
  if (t.includes('checked') || t.includes('reviewed') || t.includes('document_checked')) return 'document_checked';
  if (t.includes('document_assignment') || t.includes('assigned_document') || (k === 'document' && t.includes('assigned'))) return 'document_assignment_changed';
  if (t.includes('requirement') || k === 'requirement' || k === 'requirements') return 'document_requirement_changed';
  if (t.includes('due') || k.includes('due_date') || k === 'calendar') return 'due_date_changed';
  if (t.includes('project')) return 'project_updated';
  if (t.includes('document')) return 'document_updated';
  return 'notification';
};

const getAdminIds = (callback) => {
  db.all("SELECT id FROM Users WHERE role IN ('admin', 'superadmin')", [], (err, rows) => {
    callback(err, (rows || []).map(r => r.id));
  });
};

const getSuperAdminIds = (callback) => {
  db.all("SELECT id FROM Users WHERE role = 'superadmin'", [], (err, rows) => {
    callback(err, (rows || []).map(r => r.id));
  });
};

const getDirectSuperiorId = (userId, callback) => {
  if (!userId) return callback(null, null);
  db.get("SELECT direct_superior_user_id FROM Users WHERE id = ?", [userId], (err, row) => {
    callback(err, row?.direct_superior_user_id || null);
  });
};

const getDirectSuperiorIdAsync = async (userId) => {
  if (!userId) return null;
  const row = await dbGet("SELECT direct_superior_user_id FROM Users WHERE id = ?", [userId]);
  return row?.direct_superior_user_id || null;
};

const getSuperAdminIdsAsync = async () => {
  const rows = await dbAll("SELECT id FROM Users WHERE role = 'superadmin' AND COALESCE(is_system_account, 0) = 0");
  return (rows || []).map(r => r.id);
};

const getUsersWithPrivilege = async (privilege) => {
  const rows = await dbAll(`
    SELECT DISTINCT u.id
    FROM Users u
    JOIN UserPrivileges up ON up.user_id = u.id AND up.privilege = ? AND COALESCE(up.enabled, 0) = 1
    WHERE u.role != 'system'
      AND COALESCE(u.is_system_account, 0) = 0
      AND COALESCE(u.hidden_from_workflows, 0) = 0
  `, [privilege]);
  return uniqueIds((rows || []).map(r => r.id));
};

const getApprovalRecipientIds = async (privilege, fallbackToSuperadmin = true) => {
  const recipients = await getUsersWithPrivilege(privilege);
  if (recipients.length || !fallbackToSuperadmin) return recipients;
  return getSuperAdminIdsAsync();
};

const getSystemMaintenanceUserIds = async () => {
  const rows = await dbAll(`
    SELECT DISTINCT id
    FROM Users
    WHERE role = 'system'
       OR COALESCE(is_system_account, 0) = 1
  `);
  return uniqueIds((rows || []).map(r => r.id));
};

const getDirectSuperiorRecipientIds = async (userId, fallbackToSuperadmin = true) => {
  const superiorId = await getDirectSuperiorIdAsync(userId);
  if (superiorId) {
    const superior = await dbGet(`
      SELECT id
      FROM Users
      WHERE id = ?
        AND role != 'system'
        AND COALESCE(is_system_account, 0) = 0
        AND COALESCE(hidden_from_workflows, 0) = 0
    `, [superiorId]);
    if (superior?.id) return [superior.id];
  }
  return fallbackToSuperadmin ? getSuperAdminIdsAsync() : [];
};

const getEscalationRecipientsForUser = async (userId, fallbackToSuperadmin = true) => {
  return getDirectSuperiorRecipientIds(userId, fallbackToSuperadmin);
};

const notifySuperadmins = async ({ req, type, message, projectId = null, projectName = '', stage = null, targetKind = 'settings', targetMeta = {}, alertKey = null }) => {
  const recipients = await getSuperAdminIdsAsync();
  insertNotifications({ recipients, actorId: req?.user?.id || null, type, message, projectId, projectName, stage, targetKind, targetMeta, alertKey });
  return recipients;
};

const getProjectCreatorId = (projectId, callback) => {
  db.get("SELECT user_id FROM ActivityLogs WHERE project_id = ? AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY created_at ASC LIMIT 1", [projectId], (err, row) => {
    callback(err, row?.user_id || null);
  });
};

const uniqueIds = (ids) => [...new Set((ids || []).filter(Boolean).map(Number))];

const canAssignDocuments = (user) => user?.role === 'admin' || user?.role === 'superadmin';
const VALID_PROJECT_STAGES = ['Proposal', 'Implementation', 'Monitoring', 'Completed'];
const STAGE_EDIT_ACTIONS = {
  upload: { column: 'allow_upload', label: 'Upload', privilege: 'upload_document', lockedAction: 'LOCKED_STAGE_UPLOAD' },
  delete_file: { column: 'allow_delete_file', label: 'Delete File', privilege: 'delete_document', lockedAction: 'LOCKED_STAGE_FILE_DELETE' },
  status_change: { column: 'allow_status_change', label: 'Change Status', privilege: 'mark_checked', lockedAction: 'LOCKED_STAGE_STATUS_CHANGE' },
  requirement_state_change: { column: 'allow_requirement_state_change', label: 'Change Requirement State', privilege: 'edit_requirement_state', lockedAction: 'LOCKED_STAGE_REQUIREMENT_CHANGE' },
  due_date_change: { column: 'allow_due_date_change', label: 'Change Due Date', privilege: 'set_manual_due_date', lockedAction: 'LOCKED_STAGE_DUE_DATE_CHANGE' },
  assignment_change: { column: 'allow_assignment_change', label: 'Change Assignment', lockedAction: 'LOCKED_STAGE_ASSIGNMENT_CHANGE' }
};
const STAGE_EDIT_COLUMNS = Object.values(STAGE_EDIT_ACTIONS).map(a => a.column);
const READ_ONLY_STAGE_MESSAGE = 'This stage is read-only. Temporary edit access is required.';

const normalizeAccessBool = (value) => value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
const accessStatus = (row, now = new Date()) => {
  if (row?.revoked_at) return 'Revoked';
  if (row?.expires_at && new Date(row.expires_at) <= now) return 'Expired';
  return 'Active';
};
const accessActionLabels = (row = {}) => Object.entries(STAGE_EDIT_ACTIONS)
  .filter(([, meta]) => Number(row[meta.column]) === 1)
  .map(([, meta]) => meta.label);

const getStageEditRecipients = (projectId, grantedToUserId, callback) => {
  if (grantedToUserId) return callback(null, [grantedToUserId]);
  getProjectAssignedUserIds(projectId, (assignedErr, assignedIds) => {
    if (assignedErr) return callback(assignedErr, []);
    getAdminIds((adminErr, adminIds) => callback(adminErr, uniqueIds([...(assignedIds || []), ...(adminIds || [])])));
  });
};

const canEditLockedStage = (req, docRow, action, callback) => {
  const meta = STAGE_EDIT_ACTIONS[action];
  const docStage = docRow?.doc_stage || docRow?.stage;
  if (!req?.user) return callback(null, { allowed: false, locked: true, message: 'Please log in.' });
  if (!meta) return callback(null, { allowed: false, locked: true, message: READ_ONLY_STAGE_MESSAGE });
  if (docRow?.proj_stage === docStage) return callback(null, { allowed: true, locked: false, access: null });
  if (req.user.role === 'superadmin') return callback(null, { allowed: true, locked: true, access: null, superadmin: true });

  const nowISO = new Date().toISOString();
  db.get(`
    SELECT *
    FROM ProjectStageEditAccess
    WHERE project_id = ?
      AND stage = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
      AND (granted_to_user_id IS NULL OR granted_to_user_id = ?)
      AND ${meta.column} = 1
    ORDER BY CASE WHEN granted_to_user_id = ? THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1
  `, [docRow.project_id, docStage, nowISO, req.user.id, req.user.id], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, { allowed: false, locked: true, message: READ_ONLY_STAGE_MESSAGE });
    callback(null, { allowed: true, locked: true, access: row });
  });
};

const requireUnlockedOrTemporaryStage = (req, res, docRow, action, onAllowed, onDeniedCleanup = null) => {
  canEditLockedStage(req, docRow, action, (accessErr, result) => {
    if (accessErr) {
      if (onDeniedCleanup) onDeniedCleanup();
      return res.status(500).json({ error: 'DB error' });
    }
    if (!result.allowed) {
      if (onDeniedCleanup) onDeniedCleanup();
      return res.status(403).json({ error: result.message || READ_ONLY_STAGE_MESSAGE });
    }
    onAllowed(result);
  });
};

const logLockedStageEditUse = ({ req, doc, action, access, details }) => {
  const meta = STAGE_EDIT_ACTIONS[action];
  const docStage = doc?.doc_stage || doc?.stage;
  if (!doc || doc.proj_stage === docStage) return;
  const actionName = meta?.lockedAction || 'LOCKED_STAGE_EDIT';
  const accessDetails = access?.access?.id ? ` Temporary access #${access.access.id}.` : '';
  const reasonDetails = access?.access?.reason ? ` Reason: ${access.access.reason}.` : '';
  try {
    logActivity({
      req,
      action: actionName,
      projectId: doc.project_id,
      project: doc.project_name,
      requester: doc.requester,
      docType: doc.document_type_name,
      details: `${req.user.username} ${details || meta?.label || 'edited'} in locked ${docStage} stage.${accessDetails}${reasonDetails}`
    });
  } catch (e) {}
  getAdminIds((_err, adminIds) => {
    insertNotifications({
      recipients: adminIds || [],
      actorId: req.user.id,
      type: 'locked_stage_edit_performed',
      message: `${req.user.username} performed ${meta?.label || 'an edit'} in read-only ${docStage} stage of ${doc.project_name}.${reasonDetails}`,
      projectId: doc.project_id,
      projectName: doc.project_name,
      documentId: doc.id,
      documentName: doc.document_type_name,
      stage: docStage,
      targetKind: 'document',
      targetMeta: { document_id: doc.id, stage: docStage, action },
      alertKey: `locked_stage_edit:${doc.project_id}:${docStage}:${doc.id}:${action}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 5
    });
  });
};

const getProjectAssignedUserIds = (projectId, callback) => {
  db.all(`
    SELECT assigned_user_id as id FROM Projects WHERE id = ? AND assigned_user_id IS NOT NULL
    UNION
    SELECT assigned_user_id as id FROM Documents WHERE project_id = ? AND assigned_user_id IS NOT NULL
  `, [projectId, projectId], (err, rows) => callback(err, (rows || []).map(r => r.id)));
};

const notifyOwnedDocumentEvent = ({ req, type, doc, message, targetKind = 'document', targetMeta = {}, alertKey = null, alertDate = null, cooldownMinutes = null, dedupeMode = null }) => {
  if (!doc?.assigned_user_id) return;
  insertNotifications({
    recipients: [doc.assigned_user_id],
    actorId: req?.user?.id || null,
    type,
    message,
    projectId: doc.project_id,
    projectName: doc.project_name,
    documentId: doc.id,
    documentName: doc.document_type_name,
    stage: doc.doc_stage || doc.stage,
    targetKind,
    targetMeta: { document_id: doc.id, stage: doc.doc_stage || doc.stage, ...targetMeta },
    alertKey,
    alertDate,
    cooldownMinutes,
    dedupeMode
  });
};

const insertNotifications = ({ recipients, actorId, type, message, projectId = null, projectName = '', documentId = null, documentName = '', stage = null, targetKind = 'project', targetMeta = {}, alertKey = null, alertDate = null, includeActor = false, changedFields = [], cooldownMinutes = null, dedupeMode = null }) => {
  const priority = notificationPriority(type);
  const eventAction = targetMeta?.event_action || inferNotificationEventAction(type, targetKind);
  const changed = targetMeta?.changed_fields || changedFields || [];
  const mode = dedupeMode || (alertKey && alertDate ? 'daily' : (alertKey && Number(cooldownMinutes) > 0 ? 'cooldown' : 'none'));
  const nowISO = new Date().toISOString();
  const storedTargetMeta = { ...(targetMeta || {}), event_action: eventAction, changed_fields: changed };
  const targetMetaJson = JSON.stringify(storedTargetMeta);

  const emitInsertedNotification = (userId, id, isUpdate = false, row = null) => {
    const notification = row ? hydrateNotificationRow(row, { is_update: isUpdate }) : {
      id,
      recipient_user_id: userId,
      actor_user_id: actorId || null,
      type,
      priority,
      message,
      project_id: projectId,
      project_name: projectName || '',
      document_id: documentId,
      document_name: documentName || '',
      stage,
      target_kind: targetKind,
      target_meta: storedTargetMeta,
      changed_fields: changed,
      event_action: eventAction,
      alert_key: alertKey,
      alert_date: alertDate,
      read_at: null,
      created_at: nowISO,
      updated_at: nowISO,
      is_update: isUpdate
    };
    sendNotificationEvent(userId, notification);
  };

  const insertFresh = (userId) => {
    db.run(
      `INSERT OR IGNORE INTO Notifications (
        recipient_user_id, actor_user_id, type, priority, message, project_id, project_name,
        document_id, document_name, stage, target_kind, target_meta, alert_key, alert_date, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, actorId || null, type, priority, message, projectId, projectName || '', documentId, documentName || '', stage, targetKind, targetMetaJson, alertKey, alertDate, nowISO],
      function(err) {
        if (err || this.changes === 0) return;
        emitInsertedNotification(userId, this.lastID, false);
      }
    );
  };

  uniqueIds(recipients).filter(id => includeActor || Number(id) !== Number(actorId)).forEach(userId => {
    if (!userId) return;
    if (mode === 'cooldown' && alertKey && Number(cooldownMinutes) > 0) {
      db.get(
        `SELECT *
         FROM Notifications
         WHERE recipient_user_id = ?
           AND alert_key = ?
           AND datetime(created_at) >= datetime('now', ?)
         ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
         LIMIT 1`,
        [userId, alertKey, `-${Number(cooldownMinutes)} minutes`],
        (findErr, existing) => {
          if (findErr) return insertFresh(userId);
          if (!existing) return insertFresh(userId);
          db.run(
            `UPDATE Notifications
             SET actor_user_id = ?, type = ?, priority = ?, message = ?, project_id = ?, project_name = ?,
                 document_id = ?, document_name = ?, stage = ?, target_kind = ?, target_meta = ?,
                 alert_date = ?, read_at = NULL, updated_at = ?
             WHERE id = ?`,
            [actorId || null, type, priority, message, projectId, projectName || '', documentId, documentName || '', stage, targetKind, targetMetaJson, alertDate, nowISO, existing.id],
            (updateErr) => {
              if (updateErr) return;
              db.get(`SELECT * FROM Notifications WHERE id = ?`, [existing.id], (rowErr, row) => {
                if (rowErr || !row) return;
                emitInsertedNotification(userId, row.id, true, row);
              });
            }
          );
        }
      );
      return;
    }
    insertFresh(userId);
  });
};

const notifyProjectEvent = ({ req, type, message, project, includeCreator = true, includeDocumentAssignees = false, targetKind = 'project', targetMeta = {}, includeActor = false, alertKey = null, alertDate = null, cooldownMinutes = null, dedupeMode = null }) => {
  const finish = (ownerIds, documentAssignedIds = []) => {
    insertNotifications({ recipients: uniqueIds([...(ownerIds || []), ...(documentAssignedIds || [])]), actorId: req?.user?.id, type, message, projectId: project?.id, projectName: project?.name, stage: project?.stage, targetKind, targetMeta, includeActor, alertKey, alertDate, cooldownMinutes, dedupeMode });
  };
  if (!project?.id) return finish([]);
  if (!includeDocumentAssignees) {
    return getProjectNotificationOwnerIds(project.id, (_ownerErr, ownerIds) => finish(includeCreator ? ownerIds : [], []));
  }
  getProjectNotificationOwnerIds(project.id, (_ownerErr, ownerIds) => {
    db.all(`SELECT assigned_user_id as id FROM Documents WHERE project_id = ? AND assigned_user_id IS NOT NULL`, [project.id], (_docErr, rows) => {
      finish(includeCreator ? ownerIds : [], (rows || []).map(r => r.id));
    });
  });
};

const notifyDocumentEvent = ({ req, type, message, doc, includeCreator = true, includeUploader = false, targetKind = 'document', targetMeta = {}, alertKey = null, alertDate = null, cooldownMinutes = null, dedupeMode = null }) => {
  const finish = (ownerIds = []) => {
    const recipients = [];
    if (includeCreator) recipients.push(...ownerIds);
    if (includeUploader && doc?.uploader_user_id) recipients.push(doc.uploader_user_id);
    insertNotifications({
      recipients,
      actorId: req?.user?.id,
      type,
      message,
      projectId: doc.project_id,
      projectName: doc.project_name,
      documentId: doc.id,
      documentName: doc.document_type_name,
      stage: doc.doc_stage || doc.stage,
      targetKind,
      targetMeta: { document_id: doc.id, stage: doc.doc_stage || doc.stage, ...targetMeta },
      alertKey,
      alertDate,
      cooldownMinutes,
      dedupeMode
    });
  };
  if (doc?.assigned_user_id) finish([doc.assigned_user_id]);
  else getProjectNotificationOwnerIds(doc.project_id, (_ownerErr, ownerIds) => finish(ownerIds || []));
};

const ownershipDocumentEventMessage = (type, doc) => {
  if (type.includes('uploaded')) return `Your assigned document ${doc.document_type_name} has been uploaded.`;
  if (type.includes('deleted')) return `Your assigned document ${doc.document_type_name} has been removed.`;
  if (type.includes('reviewed')) return `Your assigned document ${doc.document_type_name} has been reviewed.`;
  if (type.includes('requirement_optional')) return `Your assigned document ${doc.document_type_name} has been marked as Optional.`;
  if (type.includes('requirement_not_required')) return `Your assigned document ${doc.document_type_name} has been marked as Not Required.`;
  if (type.includes('due')) return `Your assigned document ${doc.document_type_name} is due.`;
  return '';
};

const notifyRequirementSetModified = ({ req, projectTypeId, requesteeId, stage, created = false }) => {
  return;
};

const notifyConfigurationChanged = ({ req, type, message, section = 'configuration', targetMeta = {} }) => {
  if (type === 'configuration_exported' || type === 'configuration_updated') return;
  getSystemMaintenanceUserIds().then(systemIds => {
    const recipientsPromise = type === 'configuration_imported'
      ? getSuperAdminIdsAsync().then(superIds => uniqueIds([...systemIds, ...superIds]))
      : Promise.resolve(systemIds);
    return recipientsPromise;
  }).then(recipients => {
    insertNotifications({
      recipients,
      actorId: req?.user?.id,
      type,
      message,
      targetKind: 'settings',
      targetMeta: {
        section,
        changed_by_user_id: req?.user?.id,
        changed_by_username: req?.user?.username,
        ...targetMeta
      },
      alertKey: `${type}:${section}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 5
    });
  }).catch(() => {});
};

