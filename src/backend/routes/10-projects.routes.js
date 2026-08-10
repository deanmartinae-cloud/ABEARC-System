app.post('/api/projects', checkPrivilege('create_project'), __routeController152);

app.post('/api/projects/:id/closure-request', requireAnyPrivilege(['request_project_closure', 'transition_stage']), projectClosureAttachmentUpload.single('attachment'), __routeController153);

app.get('/api/project-closure-requests', requireAnyPrivilege(['approve_project_closure']), __routeController154);

app.post('/api/project-closure-requests/:id/approve', requireAnyPrivilege(['approve_project_closure']), __routeController155);

app.post('/api/project-closure-requests/:id/reject', requireAnyPrivilege(['approve_project_closure']), __routeController156);

const canViewProjectClosureArtifacts = async (user, projectId) => {
  if (!user) return false;
  if (user.role === 'superadmin' || await userHasPrivilegeAsync(user, 'view_project_closure_attachments') || await userHasPrivilegeAsync(user, 'approve_project_closure') || await userHasPrivilegeAsync(user, 'approve_project_disposition')) return true;
  const row = await dbGet(`
    SELECT 1
    FROM Projects p
    WHERE p.id = ? AND p.assigned_user_id = ?
    UNION
    SELECT 1
    FROM Documents d
    WHERE d.project_id = ? AND (d.assigned_user_id = ? OR d.uploader_user_id = ?)
    LIMIT 1
  `, [projectId, user.id, projectId, user.id, user.id]);
  return !!row;
};

app.get('/api/projects/:id/pending-confirmations', requireAuth, __routeController157);

app.get('/api/projects/:id/closure-attachments', requireAuth, __routeController158);

const resolveProjectClosureAttachment = async (projectId, attachmentId) => {
  const match = String(attachmentId || '').match(/^(closure|disposition)-(\d+)$/);
  if (!match) return null;
  const table = match[1] === 'closure' ? 'ProjectClosureRequests' : 'ProjectDispositionRequests';
  const row = await dbGet(`SELECT attachment_path, attachment_file_name FROM ${table} WHERE id = ? AND project_id = ? AND attachment_path IS NOT NULL`, [Number(match[2]), projectId]);
  if (!row) return null;
  const full = path.resolve(DATA_DIR, row.attachment_path);
  const root = path.resolve(PROJECT_CLOSURE_ATTACHMENTS_DIR);
  if (!full.startsWith(`${root}${path.sep}`) || !fs.existsSync(full)) return null;
  return { ...row, full };
};

app.get('/api/projects/:id/closure-attachments/:attachmentId/view', requireAuth, __routeController159);

app.get('/api/projects/:id/closure-attachments/:attachmentId/download', requireAuth, __routeController160);

app.patch('/api/projects/:id/stage', checkPrivilege('transition_stage'), __routeController161);

app.patch('/api/projects/:id', checkPrivilege('edit_project'), __routeController162);

app.patch('/api/projects/:id/assignment', requireAuth, __routeController163);

app.patch('/api/work-assignments/bulk', requireAuth, __routeController164);

const stageEditAccessSelect = `
  SELECT a.*, p.name as project_name, p.requester
  FROM ProjectStageEditAccess a
  JOIN Projects p ON p.id = a.project_id
`;

const serializeStageEditAccess = (row) => ({
  id: row.id,
  project_id: row.project_id,
  stage: row.stage,
  granted_to_user_id: row.granted_to_user_id,
  granted_to_username: row.granted_to_username,
  allow_upload: !!row.allow_upload,
  allow_delete_file: !!row.allow_delete_file,
  allow_status_change: !!row.allow_status_change,
  allow_requirement_state_change: !!row.allow_requirement_state_change,
  allow_due_date_change: !!row.allow_due_date_change,
  allow_assignment_change: !!row.allow_assignment_change,
  allowed_actions: accessActionLabels(row),
  reason: row.reason,
  expires_at: row.expires_at,
  revoked_at: row.revoked_at,
  revoked_by_user_id: row.revoked_by_user_id,
  revoked_by_username: row.revoked_by_username,
  revoke_reason: row.revoke_reason,
  created_by_user_id: row.created_by_user_id,
  created_by_username: row.created_by_username,
  created_at: row.created_at,
  updated_at: row.updated_at,
  status: accessStatus(row)
});

const stageEditAccessPayload = (body = {}) => {
  const payload = {};
  STAGE_EDIT_COLUMNS.forEach(col => payload[col] = normalizeAccessBool(body[col]));
  return payload;
};

const validateStageEditAccessPayload = (body = {}, { requireReason = true } = {}) => {
  const stage = String(body.stage || '').trim();
  const reason = String(body.reason || '').trim();
  const grantedToRaw = body.granted_to_user_id;
  const grantedToUserId = grantedToRaw === null || grantedToRaw === '' || typeof grantedToRaw === 'undefined' ? null : Number(grantedToRaw);
  const actions = stageEditAccessPayload(body);
  const selectedCount = STAGE_EDIT_COLUMNS.reduce((sum, col) => sum + Number(actions[col] || 0), 0);
  const expiresAt = body.expires_at ? new Date(String(body.expires_at)) : null;

  if (stage && !VALID_PROJECT_STAGES.includes(stage)) return { error: 'Invalid stage.' };
  if (requireReason && !reason) return { error: 'Reason is required.' };
  if (selectedCount === 0) return { error: 'Select at least one allowed action.' };
  if (grantedToUserId !== null && (!Number.isInteger(grantedToUserId) || grantedToUserId <= 0)) return { error: 'Invalid access recipient.' };
  if (expiresAt && (isNaN(expiresAt.getTime()) || expiresAt <= new Date())) return { error: 'Expiration must be in the future.' };
  return { stage, reason, grantedToUserId, actions, expiresAt: expiresAt ? expiresAt.toISOString() : null };
};

const notifyStageEditAccess = ({ req, row, type, message, alertKeySuffix }) => {
  getStageEditRecipients(row.project_id, row.granted_to_user_id, (_recipientErr, recipients) => {
    insertNotifications({
      recipients: recipients || [],
      actorId: req.user.id,
      type,
      message,
      projectId: row.project_id,
      projectName: row.project_name,
      stage: row.stage,
      targetKind: 'project',
      targetMeta: { stage: row.stage, stage_edit_access_id: row.id },
      alertKey: `stage_edit_access_${alertKeySuffix}:${row.project_id}:${row.stage}:${row.granted_to_user_id || 'all'}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 5
    });
  });
};

app.get('/api/projects/:id/stage-edit-access', requireAuth, __routeController165);

app.post('/api/projects/:id/stage-edit-access', checkPrivilege('manage_stage_edit_access'), __routeController166);

app.patch('/api/stage-edit-access/:accessId', checkPrivilege('manage_stage_edit_access'), __routeController167);

app.patch('/api/stage-edit-access/:accessId/revoke', checkPrivilege('manage_stage_edit_access'), __routeController168);

app.post('/api/projects/:projectId/monitoring-documents', checkPrivilege('manage_requirements'), __routeController169);

async function deleteProjectInternal(req, projectId, { confirmUploadedDelete = false } = {}) {
  const proj = await dbGet(`
    SELECT
      p.id, p.name, p.requester, p.stage, p.assigned_user_id,
      (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY created_at ASC LIMIT 1) as creator_user_id,
      (SELECT COUNT(*) FROM Documents WHERE project_id = p.id AND file_path IS NOT NULL) as uploaded_file_count
    FROM Projects p
    WHERE p.id = ?
  `, [projectId]);
  if (!proj) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  const uploadedFileCount = Number(proj.uploaded_file_count || 0);
  if (uploadedFileCount > 0 && req.user.role !== 'superadmin') {
    const err = new Error('Only superadmin can delete a project with uploaded documents.');
    err.status = 403;
    throw err;
  }
  if (uploadedFileCount > 0 && !confirmUploadedDelete) {
    const err = new Error('This project contains uploaded documents. Please confirm deletion again.');
    err.status = 400;
    throw err;
  }

  const docs = await dbAll(`SELECT id, file_path, assigned_user_id FROM Documents WHERE project_id = ?`, [projectId]);
  const projectName = proj.name || 'Unknown';
  const requester = proj.requester || '';
  const documentIds = docs.map(d => Number(d.id)).filter(Boolean);
  const uploadedFilePaths = docs.map(d => d.file_path).filter(Boolean);
  const documentAssignedUserIds = docs.map(d => d.assigned_user_id).filter(Boolean);
  const notificationRecipients = uniqueIds([req.user.id, proj.assigned_user_id, ...documentAssignedUserIds]);
  let removedProjectMapMedia = [];

  await dbRun("BEGIN TRANSACTION");
  try {
    removedProjectMapMedia = await removeProjectDocumentMapMediaLinks(documentIds, { deleteFiles: false });
    if (documentIds.length) {
      await dbRun(`DELETE FROM DocumentSearchIndex WHERE document_id IN (${documentIds.map(() => '?').join(',')})`, documentIds);
    }
    await dbRun("DELETE FROM DocumentOwnershipHistory WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectOwnershipHistory WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectTransitions WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectDispositionHistory WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectDispositionRequests WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectClosureRequests WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectStageEditAccess WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM ProjectDocumentationFiles WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM DeletionRequests WHERE project_id = ? OR (target_type = 'project' AND target_id = ?)", [projectId, projectId]);
    if (documentIds.length) {
      await dbRun(`UPDATE CalendarEvents SET related_document_id = NULL WHERE related_document_id IN (${documentIds.map(() => '?').join(',')})`, documentIds);
    }
    await dbRun("UPDATE CalendarEvents SET related_project_id = NULL WHERE related_project_id = ?", [projectId]);
    await dbRun("DELETE FROM Documents WHERE project_id = ?", [projectId]);
    await dbRun("DELETE FROM Projects WHERE id = ?", [projectId]);
    await dbRun("COMMIT");
  } catch (err) {
    await dbRun("ROLLBACK").catch(() => {});
    throw err;
  }
  deleteProjectLinkedMapMediaFiles(removedProjectMapMedia);

  try { logActivity({ req, action: 'DELETE_PROJECT', projectId, project: projectName, requester, docType: '-', details: `Project deleted${uploadedFilePaths.length ? ` with ${uploadedFilePaths.length} uploaded file(s)` : ''}` }); } catch(e) { logError('DELETE_PROJECT_LOG', e.message); }
  insertNotifications({
    recipients: notificationRecipients,
    actorId: req.user.id,
    type: "project_deleted",
    message: `${req.user.username} deleted project: ${projectName}`,
    projectId: Number(projectId),
    projectName,
    targetKind: "deleted_project",
    targetMeta: { event_action: "project_deleted", deleted: true, project_id: Number(projectId), project_name: projectName }
  });
  try {
    const projFolder = path.join(UPLOADS_DIR, `Proj_${projectId}`);
    if (fs.existsSync(projFolder)) fs.rmSync(projFolder, { recursive: true, force: true });
  } catch(err) { logError("DELETE_PROJECT_FOLDER", err.message, err.stack); }
  try {
    const closureAttachmentFolder = path.join(PROJECT_CLOSURE_ATTACHMENTS_DIR, `project-${projectId}`);
    if (fs.existsSync(closureAttachmentFolder)) fs.rmSync(closureAttachmentFolder, { recursive: true, force: true });
  } catch(err) { logError("DELETE_PROJECT_CLOSURE_ATTACHMENTS", err.message, err.stack); }
  try {
    const documentationFolder = path.join(PROJECT_DOCUMENTATION_DIR, `project-${projectId}`);
    if (fs.existsSync(documentationFolder)) fs.rmSync(documentationFolder, { recursive: true, force: true });
  } catch(err) { logError("DELETE_PROJECT_DOCUMENTATION", err.message, err.stack); }
  return { success: true, project: proj };
}

app.delete('/api/projects/:id', checkPrivilege('delete_project'), __routeController170);

const PROJECT_DOCUMENTATION_STAGES = ['Proposal', 'Implementation', 'Monitoring', 'Completed'];
const PROJECT_DOCUMENTATION_CATEGORIES = ['Site Validation', 'Implementation', 'Monitoring', 'Completion', 'Others'];

const normalizeProjectDocumentationStage = (stage = '') => {
  const value = String(stage || '').trim().toLowerCase();
  return PROJECT_DOCUMENTATION_STAGES.find(item => item.toLowerCase() === value) || null;
};

const normalizeProjectDocumentationMediaType = (mediaType = '') => {
  const value = String(mediaType || '').trim().toLowerCase();
  return ['photo', 'video'].includes(value) ? value : null;
};

const projectDocumentationMediaTypeForExt = (ext = '') => {
  const normalized = String(ext || '').toLowerCase();
  if (PROJECT_DOCUMENTATION_PHOTO_EXTENSIONS.includes(normalized)) return 'photo';
  if (PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS.includes(normalized)) return 'video';
  return null;
};

const sanitizeProjectDocumentationFilename = (filename = 'documentation') => {
  const parsed = path.parse(String(filename || 'documentation'));
  const base = (parsed.name || 'documentation').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'documentation';
  const ext = (parsed.ext || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${base}${ext}`;
};

const projectDocumentationResponse = (row = {}, req = null) => {
  const origin = req ? getShareOrigin(req) : '';
  return {
    ...row,
    view_url: `${origin}/api/project-documentation/${row.id}/view`,
    download_url: `${origin}/api/project-documentation/${row.id}/download`
  };
};

const safeProjectDocumentationPath = (filePath = '') => {
  if (!filePath) return null;
  const relative = String(filePath).replace(/^project-documentation[\\/]/, '');
  const absolute = path.resolve(PROJECT_DOCUMENTATION_DIR, relative);
  const root = path.resolve(PROJECT_DOCUMENTATION_DIR);
  return absolute === root || absolute.startsWith(root + path.sep) ? absolute : null;
};

const getProjectDocumentationRow = async (id) => dbGet(`
  SELECT pdf.*, p.name as project_name, p.requester, p.assigned_user_id as project_assigned_user_id
  FROM ProjectDocumentationFiles pdf
  JOIN Projects p ON p.id = pdf.project_id
  WHERE pdf.id = ? AND pdf.deleted_at IS NULL
`, [Number(id)]);

const canDeleteProjectDocumentation = async (user, row) => {
  if (!user || !row) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  if (Number(row.uploaded_by_user_id || 0) === Number(user.id)) return true;
  if (Number(row.project_assigned_user_id || 0) === Number(user.id)) return true;
  return userHasPrivilegeAsync(user, 'delete_project_documentation');
};
