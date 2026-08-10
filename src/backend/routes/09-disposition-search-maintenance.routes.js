app.post('/api/projects/duplicate-check', checkPrivilege('create_project'), __routeController138);

const moveProjectClosureAttachment = (file, projectId) => {
  if (!file?.path) return { attachmentPath: null, attachmentName: null };
  const projectDir = path.join(PROJECT_CLOSURE_ATTACHMENTS_DIR, `project-${projectId}`);
  fs.mkdirSync(projectDir, { recursive: true });
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  const safeOriginal = path.basename(file.originalname || `attachment${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const stored = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${safeOriginal}`;
  const dest = path.join(projectDir, stored);
  fs.renameSync(file.path, dest);
  return {
    attachmentPath: path.relative(DATA_DIR, dest).replace(/\\/g, '/'),
    attachmentName: file.originalname || safeOriginal
  };
};

const applyProjectDisposition = async ({ req, request = null, project, outcome, reason, remarks, decisionDate = '', attachmentPath = null, attachmentName = null, actorUser = null }) => {
  const actor = actorUser || req.user;
  const projectId = Number(project.id);
  const previousOutcome = normalizeProjectOutcome(project);
  const now = decisionDate ? new Date(decisionDate).toISOString() : new Date().toISOString();
  await dbRun(`UPDATE Projects SET outcome=?, closure_reason=?, closure_remarks=?, closed_at=?, closed_by_user_id=?, closed_by_username=?, previous_stage_before_closure=?, updated_at=?, last_activity_at=? WHERE id=?`, [
    outcome, reason, remarks, now, actor.id, actor.username, project.stage, now, now, projectId
  ]);
  await dbRun(`INSERT INTO ProjectDispositionHistory (project_id, previous_outcome, new_outcome, previous_stage, reason, remarks, attachment_path, attachment_file_name, changed_by_user_id, changed_by_username, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    projectId, previousOutcome, outcome, project.stage, reason, remarks, attachmentPath, attachmentName, actor.id, actor.username, now
  ]);
  logActivity({ req, action: request ? 'PROJECT_DISPOSITION_APPROVED' : 'PROJECT_DISPOSITION_CHANGED', projectId, project: project.name, requester: project.requester, docType: '-', details: `${actor.username} marked project "${project.name}" as ${outcome}. Reason: ${reason}.` });
  const pendingAssignees = await dbAll(`SELECT DISTINCT assigned_user_id FROM Documents WHERE project_id = ? AND assigned_user_id IS NOT NULL AND status != 'Checked'`, [projectId]);
  const creator = await getProjectCreator(projectId).catch(() => null);
  const recipients = uniqueIds([project.assigned_user_id || creator?.id, ...pendingAssignees.map(r => r.assigned_user_id)])
    .filter(id => !request?.requested_by_user_id || Number(id) !== Number(request.requested_by_user_id));
  insertNotifications({
    recipients,
    actorId: actor.id,
    type: 'project_disposition_changed',
    message: `Project marked as ${outcome}: ${project.name}. Reason: ${reason}. Confirmed by: ${actor.username}.`,
    projectId,
    projectName: project.name,
    stage: project.stage,
    targetKind: 'project_disposition',
    targetMeta: { outcome, reason, remarks, section: 'pending-confirmations', request_id: request?.id || null },
    alertKey: `project_outcome_changed:${projectId}:${outcome}`,
    dedupeMode: 'cooldown',
    cooldownMinutes: 525600
  });
  return { success: true, outcome, changed_at: now };
};

const validateProjectClosureReadiness = (projectId, sourceStage) => new Promise((resolve, reject) => {
  getStageCompletion(projectId, sourceStage, (err, counts) => {
    if (err) return reject(err);
    if (!counts.complete) {
      return resolve({
        ok: false,
        error: sourceStage === 'Monitoring'
          ? 'All reviewed Monitoring documents are required before closing the project.'
          : `Cannot close: ${sourceStage} documents are not fully checked.`
      });
    }
    resolve({ ok: true, counts });
  });
});

const applyProjectClosure = async ({ req, request, project, actorUser = null }) => {
  const actor = actorUser || req.user;
  const now = new Date().toISOString();
  const sourceStage = request.source_stage || project.stage;
  const stageRemarkColumns = { Proposal: 'proposal_remarks', Implementation: 'implementation_remarks', Monitoring: 'monitoring_remarks' };
  const sourceRemarksColumn = stageRemarkColumns[sourceStage];
  if (!sourceRemarksColumn) throw new Error('Invalid source stage.');
  const transitionRemarks = `${sourceStage} Remarks: ${request.stage_remarks}\nCompletion Remarks: ${request.completion_remarks}`;
  await dbRun(`UPDATE Projects SET stage = 'Completed', status = 'Completed', outcome = 'Completed', updated_at = ?, last_activity_at = ?, ${sourceRemarksColumn} = ?, completion_remarks = ?, remarks = ? WHERE id = ?`, [
    now, now, request.stage_remarks, request.completion_remarks, request.completion_remarks, project.id
  ]);
  await syncProjectToMonitoringInventory(project.id, actor.id);
  recordProjectTransition({ ...req, user: actor }, project.id, sourceStage, 'Completed', transitionRemarks);
  logActivity({ req, action: 'PROJECT_CLOSURE_APPROVED', projectId: project.id, project: project.name, requester: project.requester, docType: '-', details: `${actor.username} approved closing project "${project.name}".` });
  const pendingAssignees = await dbAll(`SELECT DISTINCT assigned_user_id FROM Documents WHERE project_id = ? AND assigned_user_id IS NOT NULL`, [project.id]);
  const creator = await getProjectCreator(project.id).catch(() => null);
  const recipients = uniqueIds([project.assigned_user_id || creator?.id, ...pendingAssignees.map(r => r.assigned_user_id)])
    .filter(id => Number(id) !== Number(request.requested_by_user_id));
  insertNotifications({
    recipients,
    actorId: actor.id,
    type: 'project_completed',
    message: `Project completed: ${project.name}. Confirmed by: ${actor.username}.`,
    projectId: project.id,
    projectName: project.name,
    stage: 'Completed',
    targetKind: 'stage',
    targetMeta: { section: 'pending-confirmations', closure_request_id: request.id, highlight: 'stage' },
    alertKey: `project_outcome_changed:${project.id}:Completed`,
    dedupeMode: 'cooldown',
    cooldownMinutes: 525600
  });
  return { success: true, stage: 'Completed' };
};

app.post('/api/projects/:id/disposition', requireAnyPrivilege(['request_project_disposition', 'manage_project_disposition']), projectClosureAttachmentUpload.single('attachment'), __routeController139);

app.post('/api/projects/:id/reopen', checkPrivilege('manage_project_disposition'), __routeController140);

app.get('/api/project-disposition-requests', requireAnyPrivilege(['approve_project_disposition']), __routeController141);

app.post('/api/project-disposition-requests/:id/approve', requireAnyPrivilege(['approve_project_disposition']), __routeController142);

app.post('/api/project-disposition-requests/:id/reject', requireAnyPrivilege(['approve_project_disposition']), __routeController143);

app.get('/api/projects/:id/print-data', requireAnyPrivilege(['print_project_summary', 'print_requirements_checklist']), __routeController144);

app.get('/api/document-search', checkPrivilege('search_uploaded_documents'), __routeController145);

app.post('/api/document-search/rebuild', requireManageMaintenance, __routeController146);

app.get('/api/maintenance/summary', requireManageMaintenance, __routeController147);

app.get('/api/system/health', checkPrivilege('system_health_check'), __routeController148);

app.post('/api/system/test', checkPrivilege('system_testing'), __routeController149);

app.post('/api/maintenance/clear-temp', requireManageMaintenance, __routeController150);

app.delete('/api/maintenance/orphan-files', requireManageMaintenance, __routeController151);
