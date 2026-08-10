// Controllers extracted from src/backend/routes/09-disposition-search-maintenance.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController138 = (req, res) => {
  const { name, requester, project_type_id, requestee_id, district, barangay } = req.body;
  const like = `%${String(name || '').trim()}%`;
  db.all(`
    SELECT p.id, p.name, p.requester, p.district, p.barangay, p.stage, p.status, p.created_at,
           pt.name as type_name, r.name as requestee_name
    FROM Projects p
    LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
    LEFT JOIN Requestees r ON r.id = p.requestee_id
    WHERE (LOWER(p.name) LIKE LOWER(?) OR LOWER(p.requester) = LOWER(?) OR (LOWER(p.district) = LOWER(?) AND LOWER(p.barangay) = LOWER(?)))
      AND (? IS NULL OR p.project_type_id = ?)
      AND (? IS NULL OR p.requestee_id = ?)
    ORDER BY p.created_at DESC
    LIMIT 8
  `, [like, requester || '', district || '', barangay || '', project_type_id || null, project_type_id || null, requestee_id || null, requestee_id || null], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
};

const __routeController139 = async (req, res) => {
  try {
    const cleanupRejectedAttachment = () => {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
    };
    const projectId = Number(req.params.id);
    const outcome = String(req.body?.outcome || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const remarks = String(req.body?.remarks || '').trim();
    const decisionDate = String(req.body?.decision_date || '').trim();
    if (!DISPOSITION_OUTCOMES.includes(outcome)) {
      cleanupRejectedAttachment();
      return res.status(400).json({ error: 'Invalid project disposition outcome.' });
    }
    if (!reason) {
      cleanupRejectedAttachment();
      return res.status(400).json({ error: 'Reason is required.' });
    }
    if (!remarks) {
      cleanupRejectedAttachment();
      return res.status(400).json({ error: 'Remarks are required.' });
    }

    const project = await dbGet(`SELECT p.*, au.username as assigned_username FROM Projects p LEFT JOIN Users au ON au.id = p.assigned_user_id WHERE p.id = ?`, [projectId]);
    if (!project) {
      cleanupRejectedAttachment();
      return res.status(404).json({ error: 'Project not found.' });
    }
    const assignedId = Number(project.assigned_user_id || 0);
    const allowedToMarkDisposition = await canMarkProjectDispositionForProject(req.user, project);
    if (!allowedToMarkDisposition) {
      cleanupRejectedAttachment();
      return res.status(403).json({
        error: assignedId
          ? 'Only the assigned project owner or superadmin can mark this project for disposition.'
          : 'Only authorized users can mark unassigned projects for disposition.'
      });
    }
    const previousOutcome = normalizeProjectOutcome(project);
    if (previousOutcome === 'Completed' || project.stage === 'Completed') {
      if (req.user.role !== 'superadmin') {
        cleanupRejectedAttachment();
        return res.status(400).json({ error: 'Completed projects can only be dispositioned by a superadmin.' });
      }
    }
    if (INACTIVE_PROJECT_OUTCOMES.includes(previousOutcome) && req.user.role !== 'superadmin') {
      cleanupRejectedAttachment();
      return res.status(400).json({ error: `This project is already marked as ${previousOutcome}. Reopen it before changing disposition.` });
    }

    const now = decisionDate ? new Date(decisionDate).toISOString() : new Date().toISOString();
    const duplicate = await dbGet(`SELECT id FROM ProjectDispositionRequests WHERE project_id = ? AND status = 'pending'`, [projectId]);
    if (duplicate && req.user.role !== 'superadmin') {
      cleanupRejectedAttachment();
      return res.status(409).json({ error: 'A pending disposition request already exists for this project.' });
    }
    const moved = moveProjectClosureAttachment(req.file, projectId);
    const requestResult = await dbRun(`
      INSERT INTO ProjectDispositionRequests (
        project_id, requested_outcome, previous_outcome, previous_stage, reason, remarks, decision_date,
        attachment_path, attachment_file_name, requested_by_user_id, requested_by_username, status,
        reviewed_by_user_id, reviewed_by_username, reviewed_at, review_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId, outcome, previousOutcome, project.stage, reason, remarks, now,
      moved.attachmentPath, moved.attachmentName, req.user.id, req.user.username,
      req.user.role === 'superadmin' ? 'approved' : 'pending',
      req.user.role === 'superadmin' ? req.user.id : null,
      req.user.role === 'superadmin' ? req.user.username : null,
      req.user.role === 'superadmin' ? new Date().toISOString() : null,
      req.user.role === 'superadmin' ? 'Submitted and approved by superadmin.' : null
    ]);
    const requestRow = await dbGet('SELECT * FROM ProjectDispositionRequests WHERE id = ?', [requestResult.lastID]);
    if (req.user.role === 'superadmin') {
      const applied = await applyProjectDisposition({ req, request: requestRow, project, outcome, reason, remarks, decisionDate: now, attachmentPath: moved.attachmentPath, attachmentName: moved.attachmentName });
      return res.json({ ...applied, request_id: requestResult.lastID, approved: true });
    }
    logActivity({ req, action: 'PROJECT_DISPOSITION_REQUESTED', projectId, project: project.name, requester: project.requester, docType: '-', details: `${req.user.username} requested ${outcome}. Reason: ${reason}.` });
    const approvalRecipients = await getApprovalRecipientIds('approve_project_disposition', true);
    insertNotifications({
      recipients: approvalRecipients,
      actorId: req.user.id,
      type: 'project_disposition_request_pending',
      message: `${req.user.username} requested ${outcome} disposition for ${project.name}.`,
      projectId,
      projectName: project.name,
      stage: project.stage,
      targetKind: 'settings',
      targetMeta: { section: 'pending-confirmations', disposition_request_id: requestResult.lastID, outcome },
      alertKey: `project_disposition_request:${requestResult.lastID}`
    });
    const superiorRecipients = req.user.role === 'user' ? await getDirectSuperiorRecipientIds(req.user.id, false) : [];
    insertNotifications({
      recipients: superiorRecipients.filter(id => !approvalRecipients.map(Number).includes(Number(id))),
      actorId: req.user.id,
      type: 'project_disposition_request_submitted',
      message: `${req.user.username} submitted a disposition request for ${project.name}.`,
      projectId,
      projectName: project.name,
      stage: project.stage,
      targetKind: 'project_disposition',
      targetMeta: { disposition_request_id: requestResult.lastID, outcome },
      alertKey: `project_disposition_superior_visibility:${requestResult.lastID}`
    });
    res.status(202).json({ success: true, pending_approval: true, request_id: requestResult.lastID, message: 'Disposition request submitted for approval.' });
  } catch (err) {
    if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Project disposition error:', err);
    res.status(500).json({ error: 'Failed to mark project disposition.' });
  }
};

const __routeController140 = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const remarks = String(req.body?.remarks || '').trim();
    if (!remarks) return res.status(400).json({ error: 'Remarks are required.' });
    const project = await dbGet(`SELECT * FROM Projects WHERE id = ?`, [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const previousOutcome = normalizeProjectOutcome(project);
    if (previousOutcome === 'Active') return res.status(400).json({ error: 'Project is already active.' });

    const now = new Date().toISOString();
    await dbRun(`UPDATE Projects SET outcome='Active', reopened_at=?, reopened_by_user_id=?, reopened_by_username=?, updated_at=?, last_activity_at=? WHERE id=?`, [
      now, req.user.id, req.user.username, now, now, projectId
    ]);
    await dbRun(`INSERT INTO ProjectDispositionHistory (project_id, previous_outcome, new_outcome, previous_stage, remarks, changed_by_user_id, changed_by_username, changed_at) VALUES (?, ?, 'Active', ?, ?, ?, ?, ?)`, [
      projectId, previousOutcome, project.stage, remarks, req.user.id, req.user.username, now
    ]);
    logActivity({ req, action: 'PROJECT_REOPENED', projectId, project: project.name, requester: project.requester, docType: '-', details: `${req.user.username} reopened project "${project.name}". Remarks: ${remarks}` });
    const pendingAssignees = await dbAll(`SELECT DISTINCT assigned_user_id FROM Documents WHERE project_id = ? AND assigned_user_id IS NOT NULL AND status != 'Checked'`, [projectId]);
    const creator = await getProjectCreator(projectId).catch(() => null);
    insertNotifications({
      recipients: uniqueIds([project.assigned_user_id || creator?.id, ...pendingAssignees.map(r => r.assigned_user_id)]),
      actorId: req.user.id,
      type: 'project_reopened',
      message: `Project reopened: ${project.name}. Reopened by: ${req.user.username}. Remarks: ${remarks}`,
      projectId,
      projectName: project.name,
      stage: project.stage,
      targetKind: 'project_disposition',
      targetMeta: { outcome: 'Active', previous_outcome: previousOutcome, remarks, highlight: 'outcome' },
      alertKey: `project_reopened:${projectId}:${now}`
    });
    res.json({ success: true, outcome: 'Active' });
  } catch (err) {
    console.error('Project reopen error:', err);
    res.status(500).json({ error: 'Failed to reopen project.' });
  }
};

const __routeController141 = async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(String(req.query.status || 'pending')) ? String(req.query.status || 'pending') : 'pending';
    const rows = await dbAll(`
      SELECT pdr.*, p.name as project_name, p.requester, p.stage as project_stage, p.assigned_user_id, au.username as assigned_username
      FROM ProjectDispositionRequests pdr
      JOIN Projects p ON p.id = pdr.project_id
      LEFT JOIN Users au ON au.id = p.assigned_user_id
      WHERE pdr.status = ?
      ORDER BY datetime(pdr.requested_at) DESC, pdr.id DESC
    `, [status]);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load disposition requests.' });
  }
};

const __routeController142 = async (req, res) => {
  try {
    const reviewRemarks = String(req.body?.review_remarks || '').trim();
    const request = await dbGet(`
      SELECT pdr.*, p.name as project_name, p.requester, p.stage as current_stage, p.status as project_status,
             p.outcome as project_outcome, p.assigned_user_id, p.project_type_id, p.requestee_id,
             p.requirement_set_id, p.district, p.barangay, p.created_at, p.updated_at, p.last_activity_at
      FROM ProjectDispositionRequests pdr
      JOIN Projects p ON p.id = pdr.project_id
      WHERE pdr.id = ?
    `, [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Disposition request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Disposition request is not pending.' });
    const project = await dbGet('SELECT * FROM Projects WHERE id = ?', [request.project_id]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const applied = await applyProjectDisposition({
      req,
      request,
      project,
      outcome: request.requested_outcome,
      reason: request.reason,
      remarks: request.remarks,
      decisionDate: request.decision_date,
      attachmentPath: request.attachment_path,
      attachmentName: request.attachment_file_name
    });
    const reviewedAt = new Date().toISOString();
    await dbRun(`UPDATE ProjectDispositionRequests SET status='approved', reviewed_by_user_id=?, reviewed_by_username=?, reviewed_at=?, review_remarks=? WHERE id=?`, [req.user.id, req.user.username, reviewedAt, reviewRemarks, req.params.id]);
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'project_disposition_request_approved',
      message: `Your disposition request for ${project.name} was approved. Status: ${request.requested_outcome}.`,
      projectId: project.id,
      projectName: project.name,
      targetKind: 'project_disposition',
      targetMeta: { disposition_request_id: Number(req.params.id), outcome: request.requested_outcome },
      alertKey: `disposition_request_result:${req.params.id}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 525600
    });
    res.json(applied);
  } catch (e) {
    console.error('Approve disposition request failed:', e);
    res.status(500).json({ error: e.message || 'Failed to approve disposition request.' });
  }
};

const __routeController143 = async (req, res) => {
  try {
    const reviewRemarks = String(req.body?.review_remarks || '').trim();
    if (!reviewRemarks) return res.status(400).json({ error: 'Rejection remarks are required.' });
    const request = await dbGet(`
      SELECT pdr.*, p.name as project_name
      FROM ProjectDispositionRequests pdr
      JOIN Projects p ON p.id = pdr.project_id
      WHERE pdr.id = ?
    `, [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Disposition request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Disposition request is not pending.' });
    const reviewedAt = new Date().toISOString();
    await dbRun(`UPDATE ProjectDispositionRequests SET status='rejected', reviewed_by_user_id=?, reviewed_by_username=?, reviewed_at=?, review_remarks=? WHERE id=?`, [req.user.id, req.user.username, reviewedAt, reviewRemarks, req.params.id]);
    logActivity({ req, action: 'PROJECT_DISPOSITION_REJECTED', projectId: request.project_id, project: request.project_name, docType: '-', details: `Rejected ${request.requested_outcome}. Remarks: ${reviewRemarks}` });
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'project_disposition_request_rejected',
      message: `Your disposition request for ${request.project_name} was rejected by ${req.user.username}.`,
      projectId: request.project_id,
      projectName: request.project_name,
      targetKind: 'project_disposition',
      targetMeta: { disposition_request_id: Number(req.params.id), review_remarks: reviewRemarks },
      alertKey: `disposition_request_result:${req.params.id}`,
      dedupeMode: 'cooldown',
      cooldownMinutes: 525600
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to reject disposition request.' });
  }
};

const __routeController144 = (req, res) => {
  const projectId = req.params.id;
  db.get(`
    SELECT p.*, pt.name as type_name, r.name as requestee_name, au.username as assigned_username,
      tr.transitioned_by_username, tr.source_stage, tr.target_stage, tr.remarks as transition_remarks, tr.transitioned_at
    FROM Projects p
    LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
    LEFT JOIN Requestees r ON r.id = p.requestee_id
    LEFT JOIN Users au ON au.id = p.assigned_user_id
    LEFT JOIN ProjectTransitions tr ON tr.id = (SELECT id FROM ProjectTransitions WHERE project_id = p.id ORDER BY transitioned_at DESC LIMIT 1)
    WHERE p.id = ?
  `, [projectId], (projErr, project) => {
    if (projErr || !project) return res.status(404).json({ error: 'Project not found' });
    const stageOrderCase = `CASE d.stage WHEN 'Proposal' THEN 1 WHEN 'Implementation' THEN 2 WHEN 'Monitoring' THEN 3 ELSE 4 END`;
    db.all(`
      SELECT d.*, au.username as assigned_username, COALESCE(d.document_order_index, d.id) as requirement_order
      FROM Documents d
      LEFT JOIN Users au ON au.id = d.assigned_user_id
      WHERE d.project_id = ?
      ORDER BY ${stageOrderCase}, COALESCE(d.document_order_index, d.id), d.id
    `, [projectId], (docErr, docs) => {
      if (docErr) return res.status(500).json({ error: 'Failed to fetch documents' });
      db.all(`SELECT * FROM ProjectDispositionHistory WHERE project_id = ? ORDER BY datetime(changed_at) DESC, id DESC`, [projectId], (historyErr, dispositionHistory) => {
        if (historyErr) return res.status(500).json({ error: 'Failed to fetch disposition history' });
        db.all(`SELECT * FROM ProjectDispositionRequests WHERE project_id = ? ORDER BY datetime(requested_at) DESC, id DESC`, [projectId], (dispReqErr, dispositionRequests) => {
          if (dispReqErr) return res.status(500).json({ error: 'Failed to fetch disposition requests' });
          db.all(`SELECT * FROM ProjectClosureRequests WHERE project_id = ? ORDER BY datetime(requested_at) DESC, id DESC`, [projectId], (closureReqErr, closureRequests) => {
            if (closureReqErr) return res.status(500).json({ error: 'Failed to fetch closure requests' });
            const attachments = [
              ...(closureRequests || []).filter(r => r.attachment_path).map(r => ({ id: `closure-${r.id}`, file_name: r.attachment_file_name, source_type: 'closure', uploaded_by_username: r.requested_by_username, uploaded_at: r.requested_at })),
              ...(dispositionRequests || []).filter(r => r.attachment_path).map(r => ({ id: `disposition-${r.id}`, file_name: r.attachment_file_name, source_type: 'disposition', uploaded_by_username: r.requested_by_username, uploaded_at: r.requested_at }))
            ];
            logActivity({ req, action: 'PRINT_PROJECT_SUMMARY', projectId, project: project.name, requester: project.requester, details: 'Opened printable project summary/checklist data' });
            res.json({
              project: { ...project, outcome: normalizeProjectOutcome(project) },
              documents: docs || [],
              disposition_history: dispositionHistory || [],
              disposition_requests: dispositionRequests || [],
              closure_requests: closureRequests || [],
              closure_attachments: attachments,
              printed_by: req.user.username,
              print_date: new Date().toISOString()
            });
          });
        });
      });
    });
  });
};

const __routeController145 = (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const params = [`%${q}%`];
  let visibility = '';
  if (req.user.role === 'user') {
    visibility = `AND (p.assigned_user_id = ? OR d.assigned_user_id = ? OR d.uploader_user_id = ?)`;
    params.push(req.user.id, req.user.id, req.user.id);
  }
  db.all(`
    SELECT d.id as document_id, d.project_id, d.stage, d.document_type_name, d.file_name, d.upload_date,
           p.name as project_name, si.content_text, si.index_status, si.error_message
    FROM DocumentSearchIndex si
    JOIN Documents d ON d.id = si.document_id
    JOIN Projects p ON p.id = d.project_id
    WHERE si.content_text LIKE ? ${visibility}
    ORDER BY d.upload_date DESC
    LIMIT 50
  `, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Search failed' });
    const results = (rows || []).map(r => {
      const idx = String(r.content_text || '').toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 70);
      const snippet = idx >= 0 ? String(r.content_text || '').slice(start, start + 180).replace(/\s+/g, ' ') : (r.error_message || 'Text content not available for this file');
      return { ...r, snippet };
    });
    res.json(results);
  });
};

const __routeController146 = (req, res) => {
  db.all(`SELECT id FROM Documents WHERE file_path IS NOT NULL`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    (rows || []).forEach(r => indexDocumentSearch(r.id));
    logActivity({ req, action: 'REBUILD_DOCUMENT_SEARCH', details: `Queued ${(rows || []).length} documents` });
    res.json({ success: true, queued: (rows || []).length });
  });
};

const __routeController147 = (req, res) => {
  const counts = {};
  const queries = {
    total_projects: `SELECT COUNT(*) c FROM Projects`,
    active_projects: `SELECT COUNT(*) c FROM Projects WHERE status != 'Completed' AND stage != 'Completed'`,
    completed_projects: `SELECT COUNT(*) c FROM Projects WHERE status = 'Completed' OR stage = 'Completed'`,
    total_documents: `SELECT COUNT(*) c FROM Documents`,
    uploaded_documents: `SELECT COUNT(*) c FROM Documents WHERE file_path IS NOT NULL`,
    missing_required_documents: `SELECT COUNT(*) c FROM Documents WHERE file_path IS NULL AND ${COUNTABLE_DOCUMENT_EXPR}`,
    users: `SELECT COUNT(*) c FROM Users`,
    activity_logs: `SELECT COUNT(*) c FROM ActivityLogs`,
    documents_without_project: `SELECT COUNT(*) c FROM Documents d LEFT JOIN Projects p ON p.id=d.project_id WHERE p.id IS NULL`,
    projects_without_requirement_set: `SELECT COUNT(*) c FROM Projects WHERE stage IN ('Proposal','Implementation') AND requirement_set_id IS NULL`,
    requirement_sets_without_items: `SELECT COUNT(*) c FROM (SELECT rs.id FROM RequirementSets rs LEFT JOIN RequirementSetItems rsi ON rsi.requirement_set_id=rs.id GROUP BY rs.id HAVING COUNT(rsi.id)=0)`,
    users_without_privileges: `SELECT COUNT(*) c FROM (SELECT u.id FROM Users u LEFT JOIN UserPrivileges up ON up.user_id=u.id WHERE u.role!='superadmin' GROUP BY u.id HAVING COUNT(up.id)=0)`,
    failed_search_indexes: `SELECT COUNT(*) c FROM DocumentSearchIndex WHERE index_status != 'indexed'`
  };
  const keys = Object.keys(queries);
  const run = (i) => {
    if (i >= keys.length) return health();
    db.get(queries[keys[i]], [], (err, row) => {
      counts[keys[i]] = err ? 0 : Number(row?.c || 0);
      run(i + 1);
    });
  };
  const health = () => {
    db.all(`SELECT id, file_path FROM Documents WHERE file_path IS NOT NULL`, [], (err, docs) => {
      const expected = new Set((docs || []).map(d => d.file_path));
      const missing = (docs || []).filter(d => !fs.existsSync(path.join(UPLOADS_DIR, d.file_path))).length;
      const walk = (dir, root = dir, list = []) => {
        if (!fs.existsSync(dir)) return list;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full, root, list);
          else list.push(path.relative(root, full).replace(/\\/g, '/'));
        }
        return list;
      };
      const orphan = walk(UPLOADS_DIR).filter(rel => !expected.has(rel)).length;
      res.json({
        storage: { database: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0, uploads: dirSize(UPLOADS_DIR), user_drive: dirSize(USER_DRIVE_DIR), map_media: dirSize(MAP_MEDIA_DIR), monitoring_attachments: dirSize(MONITORING_ATTACHMENTS_DIR), temp: dirSize(TEMP_DIR), backups: dirSize(BACKUPS_DIR) },
        counts: { ...counts, archived_projects: 0 },
        health: { missing_uploaded_files: missing, orphan_files: orphan }
      });
    });
  };
  run(0);
};

const __routeController148 = async (req, res) => {
  try {
    const database = await dbGet(`PRAGMA quick_check`);
    res.json({
      status: database?.quick_check === 'ok' ? 'healthy' : 'attention',
      database: database?.quick_check || 'unknown',
      uptime_seconds: Math.floor(process.uptime()),
      storage: {
        database_bytes: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
        uploads_bytes: dirSize(UPLOADS_DIR),
        user_drive_bytes: dirSize(USER_DRIVE_DIR),
        backups_bytes: dirSize(BACKUPS_DIR),
        map_media_bytes: dirSize(MAP_MEDIA_DIR)
      },
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'System health check failed.' });
  }
};

const __routeController149 = async (req, res) => {
  try {
    const database = await dbGet(`PRAGMA integrity_check`);
    const requiredDirectories = [DATA_DIR, TEMP_DIR, UPLOADS_DIR, MAP_MEDIA_ORIGINALS_DIR, MAP_MEDIA_THUMBNAILS_DIR, MAP_MEDIA_TEMP_DIR, BACKUPS_DIR];
    res.json({
      success: database?.integrity_check === 'ok' && requiredDirectories.every(dir => fs.existsSync(dir)),
      checks: {
        database_integrity: database?.integrity_check || 'unknown',
        required_directories: requiredDirectories.map(dir => ({ path: dir, exists: fs.existsSync(dir) }))
      },
      tested_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'System diagnostic test failed.' });
  }
};

const __routeController150 = (req, res) => {
  removeDirContents(TEMP_DIR);
  logActivity({ req, action: 'CLEAR_TEMP_FOLDER', details: 'Temporary folder cleared' });
  res.json({ success: true });
};

const __routeController151 = (req, res) => {
  db.all(`SELECT file_path FROM Documents WHERE file_path IS NOT NULL`, [], (err, docs) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const expected = new Set((docs || []).map(d => d.file_path));
    const deleted = [];
    const walkDelete = (dir, root = dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDelete(full, root);
        else {
          const rel = path.relative(root, full).replace(/\\/g, '/');
          if (!expected.has(rel)) { fs.unlinkSync(full); deleted.push(rel); }
        }
      }
    };
    walkDelete(UPLOADS_DIR);
    logActivity({ req, action: 'DELETE_ORPHAN_FILES', details: `Deleted ${deleted.length} orphan files` });
    res.json({ success: true, deleted: deleted.length });
  });
};
