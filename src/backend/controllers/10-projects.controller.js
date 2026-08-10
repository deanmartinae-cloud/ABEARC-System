// Controllers extracted from src/backend/routes/10-projects.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController152 = (req, res) => {
  const { name, requester, project_type_id, requestee_id, district, barangay, duplicate_confirmed } = req.body;
  if (!name || !requester || !project_type_id || !requestee_id || !barangay || !district) return res.status(400).json({error: "Project name, requester, project type, requestee, barangay, and district are required."});

  const continueCreate = () => {

  getRequirementSetId(project_type_id, requestee_id, 'Proposal', (err, set) => {
    if (err) return res.status(500).json({error: "DB error"});
    if (!set) return res.status(400).json({error: "No requirements configured for Proposal stage."});
    
    const reqSetId = set.id;
    const now = new Date().toISOString(); 
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run("INSERT INTO Projects (name, requester, project_type_id, requestee_id, requirement_set_id, district, barangay, stage, created_at, updated_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposal', ?, ?, ?)",
        [name, requester, project_type_id, requestee_id, reqSetId, district||'', barangay||'', now, now, now], function(err2) {
          if (err2) return db.run("ROLLBACK", () => res.status(err2.message.includes('UNIQUE') ? 400 : 500).json({error: err2.message}));
          const projectId = this.lastID;
          
          createDocumentsForSet(projectId, reqSetId, 'Proposal', (createErr, createResult) => {
             if (createErr) return db.run("ROLLBACK", () => res.status(500).json({error: createErr.message || "Doc creation failed"}));
             db.run("COMMIT", () => {
                try { logActivity({ req, action: 'CREATE_PROJECT', projectId, project: name, requester, docType: '-', details: 'Project created' }); } catch(e) {}
                const sendProjectCreated = (extraRecipients = []) => {
                  insertNotifications({
                    recipients: uniqueIds(extraRecipients),
                    actorId: req.user.id,
                    type: 'project_created',
                    message: `${req.user.username} created a new project: ${name}`,
                    projectId,
                    projectName: name,
                    stage: 'Proposal',
                    targetKind: 'project',
                    targetMeta: { highlight: 'header' },
                    alertKey: `project_created:${projectId}`
                  });
                };
                if (req.user.role === 'superadmin') {
                  sendProjectCreated([]);
                } else {
                  getDirectSuperiorRecipientIds(req.user.id, false)
                    .then(recipients => sendProjectCreated(recipients || []))
                    .catch(() => sendProjectCreated([]));
                }
                res.status(201).json({id: projectId, name, expected_requirement_count: createResult?.expected_count || 0, created_document_count: createResult?.created_count || 0}); 
             });
          });
      });
    });
  });
  };

  if (duplicate_confirmed) {
    return checkPrivilege('confirm_duplicate_project_creation')(req, res, continueCreate);
  }

  const like = `%${String(name || '').trim()}%`;
  db.get(`
    SELECT id FROM Projects
    WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(requester) = LOWER(?) OR (LOWER(district) = LOWER(?) AND LOWER(barangay) = LOWER(?)))
      AND project_type_id = ? AND requestee_id = ?
    LIMIT 1
  `, [like, requester || '', district || '', barangay || '', project_type_id, requestee_id], (dupeErr, dupe) => {
    if (dupeErr) return res.status(500).json({ error: 'DB error' });
    if (dupe) return res.status(409).json({ error: 'Possible duplicate project found. Confirmation is required before creating.', duplicate_required: true });
    continueCreate();
  });
};

const __routeController153 = async (req, res) => {
  const cleanupRejectedAttachment = () => { if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {}); };
  try {
    const projectId = Number(req.params.id);
    const stageRemarks = String(req.body.stage_remarks || '').trim();
    const completionRemarks = String(req.body.completion_remarks || '').trim();
    if (!stageRemarks) return cleanupRejectedAttachment(), res.status(400).json({ error: 'Stage remarks are required.' });
    if (!completionRemarks) return cleanupRejectedAttachment(), res.status(400).json({ error: 'Completion remarks are required.' });
    const project = await dbGet('SELECT * FROM Projects WHERE id = ?', [projectId]);
    if (!project) return cleanupRejectedAttachment(), res.status(404).json({ error: 'Project not found.' });
    if (isInactiveProjectOutcome(project) && req.user.role !== 'superadmin') return cleanupRejectedAttachment(), res.status(400).json({ error: `This project is marked as ${normalizeProjectOutcome(project)}. Reopen it before closing.` });
    if (!['Proposal', 'Implementation', 'Monitoring'].includes(project.stage)) return cleanupRejectedAttachment(), res.status(400).json({ error: 'Project is not in a closable stage.' });
    const readiness = await validateProjectClosureReadiness(projectId, project.stage);
    if (!readiness.ok) return cleanupRejectedAttachment(), res.status(400).json({ error: readiness.error });
    const duplicate = await dbGet(`SELECT id FROM ProjectClosureRequests WHERE project_id = ? AND status = 'pending'`, [projectId]);
    if (duplicate && req.user.role !== 'superadmin') return cleanupRejectedAttachment(), res.status(409).json({ error: 'A pending close-project request already exists for this project.' });
    const moved = moveProjectClosureAttachment(req.file, projectId);
    const now = new Date().toISOString();
    const result = await dbRun(`
      INSERT INTO ProjectClosureRequests (
        project_id, source_stage, stage_remarks, completion_remarks, attachment_path, attachment_file_name,
        requested_by_user_id, requested_by_username, requested_at, status,
        reviewed_by_user_id, reviewed_by_username, reviewed_at, review_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId, project.stage, stageRemarks, completionRemarks, moved.attachmentPath, moved.attachmentName,
      req.user.id, req.user.username, now, req.user.role === 'superadmin' ? 'approved' : 'pending',
      req.user.role === 'superadmin' ? req.user.id : null,
      req.user.role === 'superadmin' ? req.user.username : null,
      req.user.role === 'superadmin' ? now : null,
      req.user.role === 'superadmin' ? 'Submitted and approved by superadmin.' : null
    ]);
    const request = await dbGet('SELECT * FROM ProjectClosureRequests WHERE id = ?', [result.lastID]);
    if (req.user.role === 'superadmin') {
      const applied = await applyProjectClosure({ req, request, project });
      return res.json({ ...applied, request_id: result.lastID, approved: true });
    }
    logActivity({ req, action: 'PROJECT_CLOSURE_REQUESTED', projectId, project: project.name, requester: project.requester, docType: '-', details: `${req.user.username} requested project closure.` });
    const approvalRecipients = await getApprovalRecipientIds('approve_project_closure', true);
    insertNotifications({
      recipients: approvalRecipients,
      actorId: req.user.id,
      type: 'project_closure_request_pending',
      message: `${req.user.username} requested close-project confirmation for ${project.name}.`,
      projectId,
      projectName: project.name,
      stage: project.stage,
      targetKind: 'settings',
      targetMeta: { section: 'pending-confirmations', closure_request_id: result.lastID },
      alertKey: `project_closure_request:${result.lastID}`
    });
    const superiorRecipients = req.user.role === 'user' ? await getDirectSuperiorRecipientIds(req.user.id, false) : [];
    insertNotifications({
      recipients: superiorRecipients.filter(id => !approvalRecipients.map(Number).includes(Number(id))),
      actorId: req.user.id,
      type: 'project_closure_request_submitted',
      message: `${req.user.username} submitted a close-project request for ${project.name}.`,
      projectId,
      projectName: project.name,
      stage: project.stage,
      targetKind: 'stage',
      targetMeta: { closure_request_id: result.lastID },
      alertKey: `project_closure_superior_visibility:${result.lastID}`
    });
    res.status(202).json({ success: true, pending_approval: true, request_id: result.lastID, message: 'Close-project request submitted for approval.' });
  } catch (e) {
    cleanupRejectedAttachment();
    console.error('Project closure request error:', e);
    res.status(500).json({ error: e.message || 'Failed to submit close-project request.' });
  }
};

const __routeController154 = async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(String(req.query.status || 'pending')) ? String(req.query.status || 'pending') : 'pending';
    const rows = await dbAll(`
      SELECT pcr.*, p.name as project_name, p.requester, p.stage as project_stage, p.assigned_user_id, au.username as assigned_username
      FROM ProjectClosureRequests pcr
      JOIN Projects p ON p.id = pcr.project_id
      LEFT JOIN Users au ON au.id = p.assigned_user_id
      WHERE pcr.status = ?
      ORDER BY datetime(pcr.requested_at) DESC, pcr.id DESC
    `, [status]);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load close-project requests.' });
  }
};

const __routeController155 = async (req, res) => {
  try {
    const reviewRemarks = String(req.body?.review_remarks || '').trim();
    const request = await dbGet('SELECT * FROM ProjectClosureRequests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Close-project request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Close-project request is not pending.' });
    const project = await dbGet('SELECT * FROM Projects WHERE id = ?', [request.project_id]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const readiness = await validateProjectClosureReadiness(project.id, request.source_stage || project.stage);
    if (!readiness.ok) return res.status(400).json({ error: readiness.error });
    const reviewedAt = new Date().toISOString();
    await dbRun(`UPDATE ProjectClosureRequests SET status='approved', reviewed_by_user_id=?, reviewed_by_username=?, reviewed_at=?, review_remarks=? WHERE id=?`, [req.user.id, req.user.username, reviewedAt, reviewRemarks, req.params.id]);
    const approvedRequest = await dbGet('SELECT * FROM ProjectClosureRequests WHERE id = ?', [req.params.id]);
    const applied = await applyProjectClosure({ req, request: approvedRequest, project });
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'project_closure_request_approved',
      message: `Your close-project request for ${project.name} was approved. The project is now completed.`,
      projectId: project.id,
      projectName: project.name,
      targetKind: 'stage',
      targetMeta: { closure_request_id: Number(req.params.id), highlight: 'stage' },
      alertKey: `closure_request_result:${req.params.id}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 525600
    });
    res.json(applied);
  } catch (e) {
    console.error('Approve closure request failed:', e);
    res.status(500).json({ error: e.message || 'Failed to approve close-project request.' });
  }
};

const __routeController156 = async (req, res) => {
  try {
    const reviewRemarks = String(req.body?.review_remarks || '').trim();
    if (!reviewRemarks) return res.status(400).json({ error: 'Rejection remarks are required.' });
    const request = await dbGet(`
      SELECT pcr.*, p.name as project_name
      FROM ProjectClosureRequests pcr
      JOIN Projects p ON p.id = pcr.project_id
      WHERE pcr.id = ?
    `, [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Close-project request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Close-project request is not pending.' });
    const reviewedAt = new Date().toISOString();
    await dbRun(`UPDATE ProjectClosureRequests SET status='rejected', reviewed_by_user_id=?, reviewed_by_username=?, reviewed_at=?, review_remarks=? WHERE id=?`, [req.user.id, req.user.username, reviewedAt, reviewRemarks, req.params.id]);
    logActivity({ req, action: 'PROJECT_CLOSURE_REJECTED', projectId: request.project_id, project: request.project_name, docType: '-', details: `Rejected close-project request. Remarks: ${reviewRemarks}` });
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'project_closure_request_rejected',
      message: `Your close-project request for ${request.project_name} was rejected by ${req.user.username}.`,
      projectId: request.project_id,
      projectName: request.project_name,
      targetKind: 'stage',
      targetMeta: { closure_request_id: Number(req.params.id), review_remarks: reviewRemarks },
      alertKey: `closure_request_result:${req.params.id}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 525600
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to reject close-project request.' });
  }
};

const __routeController157 = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const [disposition, closure] = await Promise.all([
      dbGet(`SELECT * FROM ProjectDispositionRequests WHERE project_id = ? AND status = 'pending' ORDER BY datetime(requested_at) DESC, id DESC LIMIT 1`, [projectId]),
      dbGet(`SELECT * FROM ProjectClosureRequests WHERE project_id = ? AND status = 'pending' ORDER BY datetime(requested_at) DESC, id DESC LIMIT 1`, [projectId])
    ]);
    res.json({ disposition, closure });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load pending confirmations.' });
  }
};

const __routeController158 = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    if (!(await canViewProjectClosureArtifacts(req.user, projectId))) return forbidden(res, 'Permission denied.');
    const closureRows = await dbAll(`SELECT id, attachment_path, attachment_file_name, requested_at as created_at, requested_by_username, 'closure' as source_type FROM ProjectClosureRequests WHERE project_id = ? AND attachment_path IS NOT NULL`, [projectId]);
    const dispositionRows = await dbAll(`SELECT id, attachment_path, attachment_file_name, requested_at as created_at, requested_by_username, 'disposition' as source_type FROM ProjectDispositionRequests WHERE project_id = ? AND attachment_path IS NOT NULL`, [projectId]);
    const rows = [...closureRows, ...dispositionRows].map(r => ({
      id: `${r.source_type}-${r.id}`,
      file_name: r.attachment_file_name,
      source_type: r.source_type,
      uploaded_by_username: r.requested_by_username,
      uploaded_at: r.created_at
    })).sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load closure attachments.' });
  }
};

const __routeController159 = async (req, res) => {
  const projectId = Number(req.params.id);
  if (!(await canViewProjectClosureArtifacts(req.user, projectId))) return forbidden(res, 'Permission denied.');
  const attachment = await resolveProjectClosureAttachment(projectId, req.params.attachmentId);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });
  res.sendFile(attachment.full);
};

const __routeController160 = async (req, res) => {
  const projectId = Number(req.params.id);
  if (!(await canViewProjectClosureArtifacts(req.user, projectId))) return forbidden(res, 'Permission denied.');
  const attachment = await resolveProjectClosureAttachment(projectId, req.params.attachmentId);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });
  res.download(attachment.full, attachment.attachment_file_name || path.basename(attachment.full));
};

const __routeController161 = (req, res) => {
    const { stage } = req.body;
    const projectId = req.params.id;
    const stageRemarks = String(req.body.stage_remarks ?? req.body.remarks ?? '').trim();
    const completionRemarks = String(req.body.completion_remarks ?? (stage === 'Completed' ? req.body.remarks || '' : '')).trim();

    if (!['Implementation', 'Monitoring', 'Completed'].includes(stage)) {
        return res.status(400).json({error: "Invalid stage transition"});
    }
    if (stage === 'Completed') {
        return res.status(400).json({error: "Use the close-project request endpoint for Completed transitions."});
    }

    const stageRemarkColumns = {
        Proposal: 'proposal_remarks',
        Implementation: 'implementation_remarks',
        Monitoring: 'monitoring_remarks'
    };
    const stageRemarkTargets = {
        Proposal: 'proposal',
        Implementation: 'implementation',
        Monitoring: 'monitoring'
    };

    const notifyStageRemarksUpdated = (project, sourceStage, projectStage) => {
        return;
    };

    db.get("SELECT * FROM Projects WHERE id=?", [projectId], (err, proj) => {
        if (err || !proj) return res.status(500).json({error: "DB error"});
        if (isInactiveProjectOutcome(proj) && req.user.role !== 'superadmin') {
            return res.status(400).json({error: `This project is marked as ${normalizeProjectOutcome(proj)}. Reopen the project before changing stages.`});
        }
        if (!['Proposal', 'Implementation', 'Monitoring'].includes(proj.stage)) return res.status(400).json({error: "Invalid current stage"});

        const sourceStage = proj.stage;
        const sourceRemarksColumn = stageRemarkColumns[sourceStage];
        if (!sourceRemarksColumn) return res.status(400).json({error: "Invalid current stage"});
        if (!stageRemarks) return res.status(400).json({error: "Remarks required before leaving this stage."});
        if (stage === 'Completed' && !completionRemarks) return res.status(400).json({error: "Completion remarks required."});

        if (stage === 'Implementation' || stage === 'Monitoring') {
            const allowedPrevious = stage === 'Implementation' ? 'Proposal' : 'Implementation';
            if (sourceStage !== allowedPrevious) return res.status(400).json({error: `Project must be in ${allowedPrevious} before proceeding to ${stage}.`});

            getStageCompletion(projectId, allowedPrevious, (err, counts) => {
                if (err) return res.status(500).json({error: "DB error"});
                if (!counts.complete) {
                    return res.status(400).json({error: `Cannot proceed: ${allowedPrevious} documents are not fully checked.`});
                }

                if (stage === 'Monitoring') {
                    const now = new Date().toISOString();
                    return db.run("UPDATE Projects SET stage = 'Monitoring', requirement_set_id = NULL, updated_at = ?, last_activity_at = ?, implementation_remarks = ? WHERE id = ?", [now, now, stageRemarks, projectId], (updateErr) => {
                        if (updateErr) return res.status(500).json({error: "Update failed"});
                        recordProjectTransition(req, projectId, allowedPrevious, 'Monitoring', stageRemarks);
                        try { logActivity({ req, action: 'STAGE_TRANSITION', projectId: proj.id, project: proj.name, requester: proj.requester, docType: '-', details: `${allowedPrevious} -> Monitoring` }); } catch(e) {}
                        notifyProjectEvent({
                          req,
                          type: 'project_stage_changed',
                          message: `${req.user.username} moved ${proj.name} to Monitoring`,
                          project: { ...proj, stage: 'Monitoring' },
                          targetKind: 'stage',
                          targetMeta: { highlight: 'stage' },
                          includeDocumentAssignees: true,
                          alertKey: `stage_transition:${projectId}:${allowedPrevious}:Monitoring`,
                          dedupeMode: 'cooldown',
                          cooldownMinutes: 30
                        });
                        notifyStageRemarksUpdated(proj, allowedPrevious, 'Monitoring');
                        syncProjectToMonitoringInventory(projectId, req.user.id)
                          .then(() => res.json({success: true, stage: 'Monitoring'}))
                          .catch(error => {
                            logError('PROJECT_MONITORING_SYNC', error.message, error.stack);
                            res.status(500).json({error: 'Project moved to Monitoring, but monitoring inventory sync failed.'});
                          });
                    });
                }

                if (stage === 'Implementation') {
                getRequirementSetId(proj.project_type_id, proj.requestee_id, stage, (err, nextSet) => {
                    if (err) return res.status(500).json({error: "DB error"});
                    if (!nextSet) return res.status(400).json({error: `No requirements configured for ${stage} stage.`});

                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");
                        const now = new Date().toISOString();
                        db.run("UPDATE Projects SET stage = ?, requirement_set_id = ?, updated_at = ?, last_activity_at = ?, proposal_remarks = ? WHERE id = ?", [stage, nextSet.id, now, now, stageRemarks, projectId], (err) => {
                            if (err) return db.run("ROLLBACK", () => res.status(500).json({error: "Update failed"}));
                            createDocumentsForSet(projectId, nextSet.id, stage, (createErr) => {
                                if (createErr) return db.run("ROLLBACK", () => res.status(500).json({error: createErr.message || "Doc creation failed"}));
                                db.run("COMMIT", () => {
                                    recordProjectTransition(req, projectId, allowedPrevious, stage, stageRemarks);
                                    try { logActivity({ req, action: 'STAGE_TRANSITION', projectId: proj.id, project: proj.name, requester: proj.requester, docType: '-', details: `${allowedPrevious} -> ${stage}` }); } catch(e) {}
                                    notifyProjectEvent({
                                      req,
                                      type: 'project_stage_changed',
                                      message: `${req.user.username} moved ${proj.name} to ${stage}`,
                                      project: { ...proj, stage },
                                      targetKind: 'stage',
                                      targetMeta: { highlight: 'stage' },
                                      includeDocumentAssignees: true,
                                      alertKey: `stage_transition:${projectId}:${allowedPrevious}:${stage}`,
                                      dedupeMode: 'cooldown',
                                      cooldownMinutes: 30
                                    });
                                    notifyStageRemarksUpdated(proj, allowedPrevious, stage);
                                    res.json({success: true, stage});
                                });
                            });
                        });
                    });
                });
                }
            });
        } 
        else if (stage === 'Completed') {
            const closeProject = () => {
                const now = new Date().toISOString();
                const transitionRemarks = `${sourceStage} Remarks: ${stageRemarks}\nCompletion Remarks: ${completionRemarks}`;
                db.run(`UPDATE Projects SET stage = 'Completed', status = 'Completed', outcome = 'Completed', updated_at = ?, last_activity_at = ?, ${sourceRemarksColumn} = ?, completion_remarks = ?, remarks = ? WHERE id = ?`,
                    [now, now, stageRemarks, completionRemarks, completionRemarks, projectId], (err) => {
                        if (err) return res.status(500).json({error: "Update failed"});
                        recordProjectTransition(req, projectId, sourceStage, 'Completed', transitionRemarks);
                        try { logActivity({ req, action: 'STAGE_TRANSITION', projectId: proj.id, project: proj.name, requester: proj.requester, docType: '-', details: `${sourceStage} -> Completed` }); } catch(e) {}
                        notifyProjectEvent({
                          req,
                          type: 'project_completed',
                          message: `${req.user.username} completed ${proj.name}`,
                          project: { ...proj, stage: 'Completed' },
                          targetKind: 'stage',
                          targetMeta: { highlight: 'stage' },
                          includeDocumentAssignees: true,
                          alertKey: `stage_transition:${projectId}:${sourceStage}:Completed`,
                          dedupeMode: 'cooldown',
                          cooldownMinutes: 30
                        });
                        notifyStageRemarksUpdated(proj, sourceStage, 'Completed');
                        res.json({success: true, stage: 'Completed'});
                    });
            };

            if (sourceStage === 'Monitoring') {
                return getStageCompletion(projectId, sourceStage, (err, counts) => {
                    if (err) return res.status(500).json({error: "DB error"});
                    if (!counts.complete) {
                        return res.status(400).json({
                            error: "All reviewed Monitoring documents are required before closing the project."
                        });
                    }
                    closeProject();
                });
            }
            getStageCompletion(projectId, sourceStage, (err, counts) => {
                if (err) return res.status(500).json({error: "DB error"});
                if (!counts.complete) return res.status(400).json({error: `Cannot close: ${sourceStage} documents are not fully checked.`});
                closeProject();
            });
        }
    });
};

const __routeController162 = (req, res) => {
  const { name, requester, district, barangay, project_type_id, requestee_id } = req.body;
  const projectId = req.params.id;

  if (!name || !requester || !barangay || !district || !project_type_id || !requestee_id) return res.status(400).json({error: "Project name, requester, barangay, district, project type, and requestee are required."});

  db.get("SELECT * FROM Projects WHERE id=?", [projectId], (err, oldProj) => {
    if(err) return res.status(500).json({error: "DB error"});
    if (!oldProj) return res.status(404).json({error: "Project not found"});

    const continueProjectUpdate = () => {
    const newProjectTypeId = project_type_id || oldProj.project_type_id;
    const newRequesteeId = requestee_id || oldProj.requestee_id;
    const lookupChanged = Number(newProjectTypeId) !== Number(oldProj.project_type_id) || Number(newRequesteeId) !== Number(oldProj.requestee_id);

    const updateFields = (reqSetId = oldProj.requirement_set_id, regenerateDocs = false) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const finishUpdate = () => {
          db.run("UPDATE Projects SET name=?, requester=?, project_type_id=?, requestee_id=?, requirement_set_id=?, district=?, barangay=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [name, requester, newProjectTypeId, newRequesteeId, reqSetId, district||'', barangay||'', projectId], function(updateErr) {
              if(updateErr) return db.run("ROLLBACK", () => res.status(500).json({error: "Update failed"}));
              const changes = this.changes;
              const commitUpdate = () => db.run("COMMIT", () => {
                try { logActivity({ req, action: 'EDIT_PROJECT', projectId, project: name, requester, docType: '-', details: `Edited project "${oldProj.name}"` }); } catch(e) {}
                res.json({success: true, changes});
              });

              if (!regenerateDocs) return commitUpdate();
              createDocumentsForSet(projectId, reqSetId, oldProj.stage, (createErr) => {
                if (createErr) return db.run("ROLLBACK", () => res.status(500).json({error: createErr.message || "Doc creation failed"}));
                commitUpdate();
              });
            });
        };

        if (!regenerateDocs) return finishUpdate();
        db.run("DELETE FROM Documents WHERE project_id = ?", [projectId], (deleteErr) => {
          if (deleteErr) return db.run("ROLLBACK", () => res.status(500).json({error: "Document reset failed"}));
          finishUpdate();
        });
      });
    };

    if (!lookupChanged) return updateFields();

    db.get("SELECT COUNT(*) as cnt FROM Documents WHERE project_id = ? AND file_path IS NOT NULL", [projectId], (countErr, row) => {
      if (countErr) return res.status(500).json({error: "DB error"});
      if ((row?.cnt || 0) > 0) return res.status(400).json({error: "Project type and requestee can only be changed before any file is uploaded."});
      if (oldProj.stage === 'Monitoring') return updateFields(null, false);

      getRequirementSetId(newProjectTypeId, newRequesteeId, oldProj.stage, (setErr, set) => {
        if (setErr) return res.status(500).json({error: "DB error"});
        if (!set) return res.status(400).json({error: `No requirements configured for ${oldProj.stage} stage with the selected project type and requestee.`});
        updateFields(set.id, true);
      });
    });
    };

    if (oldProj.assigned_user_id && Number(oldProj.assigned_user_id) !== Number(req.user.id)) {
      canBypassAssignmentOwnership(req.user).then((allowed) => {
        if (!allowed) return res.status(403).json({ error: 'This project is assigned to another user.' });
        continueProjectUpdate();
      }).catch(() => res.status(500).json({ error: 'DB error' }));
      return;
    }
    continueProjectUpdate();
  });
};

const __routeController163 = (req, res) => {
  if (!canAssignDocuments(req.user)) return forbidden(res, 'Admin access required.');
  const hasAssignmentValue = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id');
  if (!hasAssignmentValue) return res.status(400).json({ error: 'assigned_user_id is required.' });
  const assignedUserId = req.body.assigned_user_id === null || req.body.assigned_user_id === '' ? null : Number(req.body.assigned_user_id);
  if (assignedUserId !== null && (!Number.isInteger(assignedUserId) || assignedUserId <= 0)) {
    return res.status(400).json({ error: 'Invalid assigned user.' });
  }

  db.get(`
    SELECT p.*, au.username as assigned_username, req.name as requestee_name
    FROM Projects p
    LEFT JOIN Users au ON au.id = p.assigned_user_id
    LEFT JOIN Requestees req ON req.id = p.requestee_id
    WHERE p.id = ?
  `, [req.params.id], (projectErr, project) => {
    if (projectErr) return res.status(500).json({ error: 'DB error' });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const previousOwnerId = project.assigned_user_id || null;
    if ((previousOwnerId || null) === assignedUserId) {
      return res.json({ success: true, unchanged: true, assigned_user_id: previousOwnerId, assigned_username: project.assigned_username || null });
    }

    const applyAssignment = (newOwner) => {
      const action = previousOwnerId && assignedUserId ? 'REASSIGN_PROJECT' : (assignedUserId ? 'ASSIGN_PROJECT' : 'CLEAR_PROJECT_ASSIGNMENT');
      db.run("UPDATE Projects SET assigned_user_id = ?, last_activity_at = ? WHERE id = ?", [assignedUserId, new Date().toISOString(), req.params.id], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Assignment update failed' });
        db.run(`INSERT INTO ProjectOwnershipHistory (
          project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
          actor_user_id, actor_username, action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, previousOwnerId, project.assigned_username || null, assignedUserId, newOwner?.username || null, req.user.id, req.user.username, action]);

        logActivity({
          req,
          action,
          projectId: project.id,
          project: project.name,
          requester: project.requester,
          docType: '-',
          details: assignedUserId
            ? `Project ownership transferred from ${project.assigned_username || 'creator'} to ${newOwner?.username || 'Unassigned'}.`
            : `Project ownership returned to creator.`
        });

        if (assignedUserId) {
          insertNotifications({
            recipients: [assignedUserId],
            actorId: req.user.id,
            type: 'project_assigned',
            message: `Project ownership transferred to you: ${project.name}.`,
            projectId: project.id,
            projectName: project.name,
            stage: project.stage,
            targetKind: 'project',
            targetMeta: { highlight: 'header' },
            alertKey: `project_assignment:${project.id}:${assignedUserId}`,
            dedupeMode: 'cooldown',
            cooldownMinutes: 10
          });
        }
        if (previousOwnerId && assignedUserId && previousOwnerId !== assignedUserId) {
          insertNotifications({
            recipients: [previousOwnerId],
            actorId: req.user.id,
            type: 'project_unassigned',
            message: `Your assignment for project ${project.name} was removed.`,
            projectId: project.id,
            projectName: project.name,
            stage: project.stage,
            targetKind: 'project',
            targetMeta: { highlight: 'header' },
            alertKey: `project_unassignment:${project.id}:${previousOwnerId}`,
            dedupeMode: 'cooldown',
            cooldownMinutes: 10
          });
        }
        if (previousOwnerId && !assignedUserId) {
          getProjectCreator(project.id).then((creator) => {
            insertNotifications({
              recipients: uniqueIds([previousOwnerId, creator?.id]),
              actorId: req.user.id,
              type: 'project_unassigned',
              message: `Project ownership returned to creator ${creator?.username || 'creator'} for ${project.name}.`,
              projectId: project.id,
              projectName: project.name,
              stage: project.stage,
              targetKind: 'project',
              targetMeta: { highlight: 'header' },
              alertKey: `project_unassignment:${project.id}:${previousOwnerId}`,
              dedupeMode: 'cooldown',
              cooldownMinutes: 10
            });
          });
        }

        res.json({ success: true, assigned_user_id: assignedUserId, assigned_username: newOwner?.username || null, action });
      });
    };

    if (assignedUserId === null) return applyAssignment(null);
    db.get(`SELECT id, username FROM Users
            WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`,
      [assignedUserId], (userErr, user) => {
      if (userErr) return res.status(500).json({ error: 'DB error' });
      if (!user) return res.status(400).json({ error: 'Assigned user must exist and be active.' });
      applyAssignment(user);
    });
  });
};

const __routeController164 = async (req, res) => {
  if (!canAssignDocuments(req.user)) return forbidden(res, 'Admin access required.');
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const assignedUserId = req.body?.assigned_user_id === null || req.body?.assigned_user_id === '' ? null : Number(req.body?.assigned_user_id);
  if (!rawItems.length) return res.status(400).json({ error: 'No work items selected.' });
  if (assignedUserId !== null && (!Number.isInteger(assignedUserId) || assignedUserId <= 0)) {
    return res.status(400).json({ error: 'Invalid assigned user.' });
  }

  let newOwner = null;
  if (assignedUserId !== null) {
    newOwner = await dbGet(`SELECT id, username FROM Users WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`, [assignedUserId]).catch(() => null);
    if (!newOwner) return res.status(400).json({ error: 'Assigned user must exist and be active.' });
  }

  const summary = { success: true, assigned: 0, unchanged: 0, skipped: 0, errors: [] };
  const seen = new Set();
  const items = rawItems.map(item => ({ kind: String(item?.kind || '').toLowerCase(), id: Number(item?.id) }))
    .filter(item => {
      const key = `${item.kind}:${item.id}`;
      if (!['project', 'document'].includes(item.kind) || !Number.isInteger(item.id) || item.id <= 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const canEditStageAsync = (doc) => new Promise((resolve, reject) => {
    canEditLockedStage(req, doc, 'assignment_change', (err, result) => err ? reject(err) : resolve(result));
  });
  const getProjectCreatorAsync = (projectId) => dbGet(
    "SELECT user_id FROM ActivityLogs WHERE project_id = ? AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY created_at ASC LIMIT 1",
    [projectId]
  ).then(row => row?.user_id || null).catch(() => null);

  for (const item of items) {
    try {
      if (item.kind === 'project') {
        const project = await dbGet(`
          SELECT p.*, au.username as assigned_username, reqt.name as requestee_name
          FROM Projects p
          LEFT JOIN Users au ON au.id = p.assigned_user_id
          LEFT JOIN Requestees reqt ON reqt.id = p.requestee_id
          WHERE p.id = ?
        `, [item.id]);
        if (!project) { summary.skipped++; summary.errors.push({ item, error: 'Project not found' }); continue; }
        const previousOwnerId = project.assigned_user_id || null;
        if ((previousOwnerId || null) === assignedUserId) { summary.unchanged++; continue; }
        const action = previousOwnerId && assignedUserId ? 'REASSIGN_PROJECT' : (assignedUserId ? 'ASSIGN_PROJECT' : 'CLEAR_PROJECT_ASSIGNMENT');
        await dbRun("UPDATE Projects SET assigned_user_id = ?, last_activity_at = ? WHERE id = ?", [assignedUserId, new Date().toISOString(), project.id]);
        await dbRun(`INSERT INTO ProjectOwnershipHistory (
          project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
          actor_user_id, actor_username, action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [project.id, previousOwnerId, project.assigned_username || null, assignedUserId, newOwner?.username || null, req.user.id, req.user.username, action]);
        logActivity({ req, action, projectId: project.id, project: project.name, requester: project.requester, docType: '-', details: assignedUserId ? `Project ownership transferred from ${project.assigned_username || 'creator'} to ${newOwner?.username || 'Unassigned'}.` : 'Project ownership returned to creator.' });
        if (assignedUserId) {
          insertNotifications({ recipients: [assignedUserId], actorId: req.user.id, type: 'project_assigned', message: `Project ownership transferred to you: ${project.name}.`, projectId: project.id, projectName: project.name, stage: project.stage, targetKind: 'project', targetMeta: { highlight: 'header' }, alertKey: `project_assignment:${project.id}:${assignedUserId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
        }
        if (previousOwnerId && assignedUserId && previousOwnerId !== assignedUserId) {
          insertNotifications({ recipients: [previousOwnerId], actorId: req.user.id, type: 'project_unassigned', message: `Your assignment for project ${project.name} was removed.`, projectId: project.id, projectName: project.name, stage: project.stage, targetKind: 'project', targetMeta: { highlight: 'header' }, alertKey: `project_unassignment:${project.id}:${previousOwnerId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
        }
        if (previousOwnerId && !assignedUserId) {
          const creatorId = await getProjectCreatorAsync(project.id);
          insertNotifications({ recipients: uniqueIds([previousOwnerId, creatorId]), actorId: req.user.id, type: 'project_unassigned', message: `Project ownership returned to creator for ${project.name}.`, projectId: project.id, projectName: project.name, stage: project.stage, targetKind: 'project', targetMeta: { highlight: 'header' }, alertKey: `project_unassignment:${project.id}:${previousOwnerId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
        }
        summary.assigned++;
        continue;
      }

      const doc = await dbGet(`
        SELECT d.*, p.name as project_name, p.requester, p.stage as proj_stage, p.assigned_user_id as project_assigned_user_id, au.username as assigned_username
        FROM Documents d
        JOIN Projects p ON p.id = d.project_id
        LEFT JOIN Users au ON au.id = d.assigned_user_id
        WHERE d.id = ?
      `, [item.id]);
      if (!doc) { summary.skipped++; summary.errors.push({ item, error: 'Document not found' }); continue; }
      if (normalizeRequirementState(doc.requirement_state) === 'Not Required' && assignedUserId) {
        summary.skipped++; summary.errors.push({ item, error: 'Cannot assign a document marked as Not Required.' }); continue;
      }
      const previousOwnerId = doc.assigned_user_id || null;
      if ((previousOwnerId || null) === assignedUserId) { summary.unchanged++; continue; }
      const access = await canEditStageAsync(doc);
      if (!access.allowed) { summary.skipped++; summary.errors.push({ item, error: access.message || READ_ONLY_STAGE_MESSAGE }); continue; }
      const action = previousOwnerId && assignedUserId ? 'REASSIGN_DOCUMENT' : (assignedUserId ? 'ASSIGN_DOCUMENT' : 'CLEAR_ASSIGNMENT');
      await dbRun("UPDATE Documents SET assigned_user_id = ? WHERE id = ?", [assignedUserId, doc.id]);
      await dbRun(`INSERT INTO DocumentOwnershipHistory (
        document_id, project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
        actor_user_id, actor_username, action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [doc.id, doc.project_id, previousOwnerId, doc.assigned_username || null, assignedUserId, newOwner?.username || null, req.user.id, req.user.username, action]);
      logActivity({ req, action, projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: `${doc.assigned_username || 'Unassigned'} -> ${newOwner?.username || 'Unassigned'}` });
      if (assignedUserId) {
        insertNotifications({ recipients: [assignedUserId], actorId: req.user.id, type: 'document_assigned', message: `You were assigned to ${doc.document_type_name} in ${doc.project_name}.`, projectId: doc.project_id, projectName: doc.project_name, documentId: doc.id, documentName: doc.document_type_name, stage: doc.stage, targetKind: 'document', targetMeta: { document_id: doc.id, stage: doc.stage }, alertKey: `document_assignment:${doc.id}:${assignedUserId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
      }
      if (previousOwnerId && assignedUserId && previousOwnerId !== assignedUserId) {
        insertNotifications({ recipients: [previousOwnerId], actorId: req.user.id, type: 'document_unassigned', message: `Your assignment for ${doc.document_type_name} in ${doc.project_name} was removed.`, projectId: doc.project_id, projectName: doc.project_name, documentId: doc.id, documentName: doc.document_type_name, stage: doc.stage, targetKind: 'document', targetMeta: { document_id: doc.id, stage: doc.stage }, alertKey: `document_unassignment:${doc.id}:${previousOwnerId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
      }
      if (previousOwnerId && !assignedUserId) {
        const creatorId = await getProjectCreatorAsync(doc.project_id);
        insertNotifications({ recipients: uniqueIds([previousOwnerId, doc.project_assigned_user_id, creatorId]), actorId: req.user.id, type: 'document_unassigned', message: `Your assignment for ${doc.document_type_name} in ${doc.project_name} was removed.`, projectId: doc.project_id, projectName: doc.project_name, documentId: doc.id, documentName: doc.document_type_name, stage: doc.stage, targetKind: 'document', targetMeta: { document_id: doc.id, stage: doc.stage }, alertKey: `document_unassignment:${doc.id}:${previousOwnerId}`, dedupeMode: 'cooldown', cooldownMinutes: 10 });
      }
      updateProjectActivity(doc.project_id);
      logLockedStageEditUse({ req, doc, action: 'assignment_change', access, details: `changed assignment for ${doc.document_type_name}` });
      summary.assigned++;
    } catch (e) {
      summary.skipped++;
      summary.errors.push({ item, error: e.message || 'Assignment failed' });
    }
  }
  res.json(summary);
};

const __routeController165 = (req, res) => {
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) return res.status(400).json({ error: 'Invalid project id.' });
  getUserPrivileges(req.user.id, (_privErr, userPrivileges) => {
    const canManageAccess = userHasPrivilege(req.user, 'manage_stage_edit_access', userPrivileges || {});
    const nowISO = new Date().toISOString();
    let where = 'WHERE a.project_id = ?';
    const params = [projectId];
    if (req.user.role === 'superadmin') {
      // full history
    } else if (req.user.role === 'admin' || canManageAccess) {
      where += ' AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > ?)';
      params.push(nowISO);
    } else {
      where += ' AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > ?) AND (a.granted_to_user_id IS NULL OR a.granted_to_user_id = ?)';
      params.push(nowISO, req.user.id);
    }
    db.all(`${stageEditAccessSelect} ${where} ORDER BY a.created_at DESC`, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json((rows || []).map(serializeStageEditAccess));
    });
  });
};

const __routeController166 = (req, res) => {
  const projectId = Number(req.params.id);
  const validation = validateStageEditAccessPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });
  if (!validation.stage) return res.status(400).json({ error: 'Stage is required.' });

  db.get('SELECT id, name, requester FROM Projects WHERE id = ?', [projectId], (projectErr, project) => {
    if (projectErr) return res.status(500).json({ error: 'DB error' });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const finishCreate = (grantee) => {
      const granteeName = grantee?.username || null;
      const sameActionsWhere = STAGE_EDIT_COLUMNS.map(col => `${col} = ?`).join(' AND ');
      const sameActionsParams = STAGE_EDIT_COLUMNS.map(col => validation.actions[col]);
      db.get(`
        SELECT id FROM ProjectStageEditAccess
        WHERE project_id = ? AND stage = ?
          AND ${validation.grantedToUserId === null ? 'granted_to_user_id IS NULL' : 'granted_to_user_id = ?'}
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
          AND ${sameActionsWhere}
        LIMIT 1
      `, [projectId, validation.stage, ...(validation.grantedToUserId === null ? [] : [validation.grantedToUserId]), new Date().toISOString(), ...sameActionsParams], (dupeErr, dupe) => {
        if (dupeErr) return res.status(500).json({ error: 'DB error' });
        if (dupe) return res.status(409).json({ error: 'Duplicate active access already exists for this stage, recipient, and action set.' });

        const nowISO = new Date().toISOString();
        db.run(`
          INSERT INTO ProjectStageEditAccess (
            project_id, stage, granted_to_user_id, granted_to_username,
            allow_upload, allow_delete_file, allow_status_change, allow_requirement_state_change,
            allow_due_date_change, allow_assignment_change, reason, expires_at,
            created_by_user_id, created_by_username, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          projectId, validation.stage, validation.grantedToUserId, granteeName,
          validation.actions.allow_upload, validation.actions.allow_delete_file, validation.actions.allow_status_change,
          validation.actions.allow_requirement_state_change, validation.actions.allow_due_date_change, validation.actions.allow_assignment_change,
          validation.reason, validation.expiresAt, req.user.id, req.user.username, nowISO
        ], function(insertErr) {
          if (insertErr) return res.status(500).json({ error: 'Failed to grant access.' });
          const row = {
            id: this.lastID,
            project_id: projectId,
            project_name: project.name,
            requester: project.requester,
            stage: validation.stage,
            granted_to_user_id: validation.grantedToUserId,
            granted_to_username: granteeName,
            ...validation.actions,
            reason: validation.reason,
            expires_at: validation.expiresAt,
            created_by_user_id: req.user.id,
            created_by_username: req.user.username,
            created_at: nowISO
          };
          const labels = accessActionLabels(row).join(', ');
          const granteeLabel = granteeName || 'All eligible users';
          logActivity({
            req,
            action: 'STAGE_EDIT_ACCESS_GRANTED',
            projectId,
            project: project.name,
            requester: project.requester,
            docType: validation.stage,
            details: `${req.user.role} ${req.user.username} granted temporary ${labels} access for ${validation.stage} stage to ${granteeLabel}${validation.expiresAt ? ` until ${validation.expiresAt}` : ' with no expiration'}. Reason: ${validation.reason}`
          });
          notifyStageEditAccess({
            req,
            row,
            type: 'stage_edit_access_granted',
            alertKeySuffix: 'granted',
            message: `Temporary edit access was granted for ${validation.stage} stage in ${project.name}. Allowed actions: ${labels}. ${validation.expiresAt ? `Expires: ${validation.expiresAt}. ` : ''}Reason: ${validation.reason}`
          });
          res.status(201).json(serializeStageEditAccess(row));
        });
      });
    };

    if (validation.grantedToUserId === null) return finishCreate(null);
    db.get(`SELECT id, username FROM Users
            WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`,
      [validation.grantedToUserId], (userErr, user) => {
      if (userErr) return res.status(500).json({ error: 'DB error' });
      if (!user) return res.status(400).json({ error: 'Selected user does not exist.' });
      finishCreate(user);
    });
  });
};

const __routeController167 = (req, res) => {
  const accessId = Number(req.params.accessId);
  if (!Number.isInteger(accessId) || accessId <= 0) return res.status(400).json({ error: 'Invalid access id.' });
  const validation = validateStageEditAccessPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  db.get(`${stageEditAccessSelect} WHERE a.id = ?`, [accessId], (err, existing) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!existing) return res.status(404).json({ error: 'Access record not found.' });
    if (existing.revoked_at) return res.status(400).json({ error: 'Revoked access cannot be updated.' });
    if (existing.expires_at && new Date(existing.expires_at) <= new Date()) return res.status(400).json({ error: 'Expired access cannot be updated. Create a new access grant.' });
    const nextStage = validation.stage || existing.stage;

    const finishUpdate = (grantee) => {
      const nowISO = new Date().toISOString();
      db.run(`
        UPDATE ProjectStageEditAccess
        SET stage = ?, granted_to_user_id = ?, granted_to_username = ?,
            allow_upload = ?, allow_delete_file = ?, allow_status_change = ?, allow_requirement_state_change = ?,
            allow_due_date_change = ?, allow_assignment_change = ?, reason = ?, expires_at = ?, updated_at = ?
        WHERE id = ?
      `, [
        nextStage, validation.grantedToUserId, grantee?.username || null,
        validation.actions.allow_upload, validation.actions.allow_delete_file, validation.actions.allow_status_change,
        validation.actions.allow_requirement_state_change, validation.actions.allow_due_date_change, validation.actions.allow_assignment_change,
        validation.reason, validation.expiresAt, nowISO, accessId
      ], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Failed to update access.' });
        const row = { ...existing, ...validation.actions, stage: nextStage, granted_to_user_id: validation.grantedToUserId, granted_to_username: grantee?.username || null, reason: validation.reason, expires_at: validation.expiresAt, updated_at: nowISO };
        const labels = accessActionLabels(row).join(', ');
        logActivity({
          req,
          action: 'STAGE_EDIT_ACCESS_UPDATED',
          projectId: row.project_id,
          project: row.project_name,
          requester: row.requester,
          docType: row.stage,
          details: `${req.user.role} ${req.user.username} updated temporary ${labels} access for ${row.stage} stage to ${row.granted_to_username || 'All eligible users'}${row.expires_at ? ` until ${row.expires_at}` : ' with no expiration'}. Reason: ${row.reason}`
        });
        notifyStageEditAccess({
          req,
          row,
          type: 'stage_edit_access_updated',
          alertKeySuffix: 'updated',
          message: `Temporary edit access was updated for ${row.stage} stage in ${row.project_name}. Allowed actions: ${labels}. Reason: ${row.reason}`
        });
        res.json(serializeStageEditAccess(row));
      });
    };

    if (validation.grantedToUserId === null) return finishUpdate(null);
    db.get(`SELECT id, username FROM Users
            WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`,
      [validation.grantedToUserId], (userErr, user) => {
      if (userErr) return res.status(500).json({ error: 'DB error' });
      if (!user) return res.status(400).json({ error: 'Selected user does not exist.' });
      finishUpdate(user);
    });
  });
};

const __routeController168 = (req, res) => {
  const accessId = Number(req.params.accessId);
  const revokeReason = String(req.body?.revoke_reason || '').trim();
  if (!revokeReason) return res.status(400).json({ error: 'Revoke reason is required.' });
  db.get(`${stageEditAccessSelect} WHERE a.id = ?`, [accessId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Access record not found.' });
    if (row.revoked_at) return res.json({ success: true, message: 'Temporary stage edit access was already revoked.', access: serializeStageEditAccess(row) });
    const nowISO = new Date().toISOString();
    db.run(`
      UPDATE ProjectStageEditAccess
      SET revoked_at = ?, revoked_by_user_id = ?, revoked_by_username = ?, revoke_reason = ?, updated_at = ?
      WHERE id = ?
    `, [nowISO, req.user.id, req.user.username, revokeReason, nowISO, accessId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Failed to revoke access.' });
      const next = { ...row, revoked_at: nowISO, revoked_by_user_id: req.user.id, revoked_by_username: req.user.username, revoke_reason: revokeReason, updated_at: nowISO };
      const labels = accessActionLabels(row).join(', ');
      logActivity({
        req,
        action: 'STAGE_EDIT_ACCESS_REVOKED',
        projectId: row.project_id,
        project: row.project_name,
        requester: row.requester,
        docType: row.stage,
        details: `${req.user.role} ${req.user.username} revoked temporary ${labels} access for ${row.stage} stage from ${row.granted_to_username || 'All eligible users'}${row.expires_at ? ` previously expiring ${row.expires_at}` : ' with no expiration'}. Revoke reason: ${revokeReason}`
      });
      notifyStageEditAccess({
        req,
        row: next,
        type: 'stage_edit_access_revoked',
        alertKeySuffix: 'revoked',
        message: `Temporary edit access for ${row.stage} stage in ${row.project_name} was revoked. Reason: ${revokeReason}`
      });
      res.json({ success: true, access: serializeStageEditAccess(next) });
    });
  });
};

const __routeController169 = (req, res) => {
  const projectId = req.params.projectId;
  const year = parseInt(req.body.year);
  const name = String(req.body.name || '').trim();

  if (!year || year < 2000 || year > 2100 || !name) {
    return res.status(400).json({error: "Valid year and document name are required."});
  }

  db.get("SELECT id, name, requester, stage FROM Projects WHERE id = ?", [projectId], (err, proj) => {
    if (err) return res.status(500).json({error: "DB error"});
    if (!proj) return res.status(404).json({error: "Project not found"});
    if (proj.stage !== 'Monitoring') return res.status(400).json({error: "Monitoring documents can only be added while the project is in Monitoring."});

    const docName = `${year} ${name}`;
    db.run("INSERT INTO Documents (project_id, document_type_id, document_type_name, stage, status) VALUES (?, NULL, ?, 'Monitoring', 'None')",
      [projectId, docName], function(insertErr) {
        if (insertErr) return res.status(500).json({error: "Document creation failed"});
        try { logActivity({ req, action: 'MONITORING_DOC_ADD', projectId, project: proj.name, requester: proj.requester, docType: docName, details: 'Monitoring document added' }); } catch(e) {}
        notifyDocumentEvent({
          req,
          type: 'monitoring_document_added',
          message: `${req.user.username} added ${docName}`,
          doc: { id: this.lastID, project_id: Number(projectId), project_name: proj.name, document_type_name: docName, doc_stage: 'Monitoring' }
        });
        updateProjectActivity(projectId);
        res.status(201).json({id: this.lastID, document_type_name: docName});
      });
  });
};

const __routeController170 = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const confirmUploadedDelete = req.query.confirm_uploaded_delete === 'true' || req.body?.confirm_uploaded_delete === true || req.body?.confirm_uploaded_delete === 'true';
    const proj = await dbGet(`
      SELECT p.*, au.username as assigned_username,
             (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY created_at ASC LIMIT 1) as creator_user_id,
             (SELECT u.username FROM ActivityLogs al JOIN Users u ON u.id = al.user_id WHERE al.project_id = p.id AND al.action = 'CREATE_PROJECT' AND al.user_id IS NOT NULL ORDER BY datetime(al.created_at) ASC, al.id ASC LIMIT 1) as creator_username,
             (SELECT COUNT(*) FROM Documents WHERE project_id = p.id AND file_path IS NOT NULL) as uploaded_file_count
      FROM Projects p
      LEFT JOIN Users au ON au.id = p.assigned_user_id
      WHERE p.id = ?
    `, [projectId]);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    const bypass = await canBypassAssignmentOwnership(req.user);
    const isCreator = proj.creator_user_id && Number(proj.creator_user_id) === Number(req.user.id);
    const uploadedFileCount = Number(proj.uploaded_file_count || 0);
    if (uploadedFileCount > 0 && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can delete a project with uploaded documents.' });
    }
    if (proj.assigned_user_id && Number(proj.assigned_user_id) !== Number(req.user.id) && !bypass && !(isCreator && uploadedFileCount === 0)) {
      return res.status(403).json({ error: 'This project is assigned to another user.' });
    }
    if (!isCreator && !bypass && proj.creator_user_id) {
      const result = await createDeletionRequest({
        req,
        targetType: 'project',
        targetId: projectId,
        projectId,
        ownerUserId: proj.creator_user_id,
        ownerUsername: proj.creator_username || '',
        targetName: `project ${proj.name}`,
        targetSnapshot: proj
      });
      return deletionRequestResponse(res, result);
    }
    await deleteProjectInternal(req, projectId, { confirmUploadedDelete });
    res.json({ success: true });
  } catch (err) {
    logError('DELETE_PROJECT', err.message, err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Delete failed' });
  }
};
