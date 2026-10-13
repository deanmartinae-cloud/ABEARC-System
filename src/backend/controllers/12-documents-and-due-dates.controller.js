// Controllers extracted from src/backend/routes/12-documents-and-due-dates.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController178 = (req, res) => {
  db.all(`
    SELECT d.id, d.project_id, d.document_type_name, d.file_path, d.file_name, d.status, d.upload_date, d.document_date,
           d.stage, d.requirement_state, d.remarks, d.uploader_user_id, uu.username as uploader_username, d.assigned_user_id, au.username as assigned_username,
           d.manual_due_date, d.due_date_override, d.due_date,
           COALESCE(rds.due_days, dt.due_days, 0) as due_days,
           COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
           COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
           COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
           p.name as project_name, p.requester, p.created_at as project_created_at, p.stage as project_stage,
           COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome,
           p.assigned_user_id as project_assigned_user_id, pau.username as project_assigned_username,
           req.name as requestee_name
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    LEFT JOIN Users uu ON uu.id = d.uploader_user_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    LEFT JOIN Users pau ON pau.id = p.assigned_user_id
    LEFT JOIN Requestees req ON req.id = p.requestee_id
    ORDER BY p.created_at DESC, d.stage ASC, d.id ASC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const results = [];
    const processRow = (index) => {
      if (index >= rows.length) return res.json(results);
      const row = rows[index];
      if (INACTIVE_PROJECT_OUTCOMES.includes(row.project_outcome)) {
        results.push({ ...row, due_at: null, due_date_source: 'inactive_project' });
        return processRow(index + 1);
      }
      getEffectiveDueDate(row, (effErr, effResult) => {
        results.push({ ...row, due_at: effErr ? null : effResult.effective_due_date, due_date_source: effResult?.due_date_source || 'none' });
        processRow(index + 1);
      });
    };
    processRow(0);
  });
};

const __routeController179 = (req, res) => {
  const params = [];
  const reviewVisibilityFilter = req.user.role === 'superadmin' ? '' : 'AND (uu.direct_superior_user_id = ? OR d.uploader_user_id = ?)';
  if (req.user.role !== 'superadmin') params.push(req.user.id, req.user.id);

  db.all(`
    SELECT d.id, d.project_id, d.document_type_name, d.file_path, d.file_name, d.status, d.upload_date, d.document_date,
           d.stage, d.requirement_state, d.remarks, d.uploader_user_id, uu.username as uploader_username, d.assigned_user_id, au.username as assigned_username,
           d.manual_due_date, d.due_date_override, d.due_date,
           COALESCE(rds.due_days, dt.due_days, 0) as due_days,
           COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
           COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
           COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
           p.name as project_name, p.requester, p.created_at as project_created_at, p.stage as project_stage,
           COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome,
           p.assigned_user_id as project_assigned_user_id, pau.username as project_assigned_username,
           req.name as requestee_name
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    JOIN Users uu ON uu.id = d.uploader_user_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    LEFT JOIN Users pau ON pau.id = p.assigned_user_id
    LEFT JOIN Requestees req ON req.id = p.requestee_id
    WHERE d.status = 'For Review'
      AND d.file_path IS NOT NULL
      AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
      AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
      AND d.stage = p.stage
      AND p.stage != 'Completed'
      AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
      ${reviewVisibilityFilter}
    ORDER BY datetime(d.upload_date) DESC, d.id DESC
  `, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const results = [];
    const processRow = (index) => {
      if (index >= (rows || []).length) return res.json(results);
      const row = rows[index];
      getEffectiveDueDate(row, (effErr, effResult) => {
        results.push({ ...row, due_at: effErr ? null : effResult.effective_due_date, due_date_source: effResult?.due_date_source || 'none' });
        processRow(index + 1);
      });
    };
    processRow(0);
  });
};

const __routeController180 = (req, res) => {
  db.all(`
    SELECT d.id, d.project_id, d.document_type_name, d.file_path, d.file_name, d.status, d.upload_date, d.document_date, d.checked_at,
           d.stage, d.requirement_state, d.remarks, d.uploader_user_id, uu.username as uploader_username, d.assigned_user_id, au.username as assigned_username,
           d.checked_by_user_id, d.checked_by_username,
           p.name as project_name, p.requester, p.created_at as project_created_at, p.stage as project_stage,
           COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome,
           p.assigned_user_id as project_assigned_user_id, pau.username as project_assigned_username,
           req.name as requestee_name
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN Users uu ON uu.id = d.uploader_user_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    LEFT JOIN Users pau ON pau.id = p.assigned_user_id
    LEFT JOIN Requestees req ON req.id = p.requestee_id
    WHERE d.status = 'Checked'
      AND d.file_path IS NOT NULL
      AND d.checked_by_user_id = ?
    ORDER BY datetime(d.checked_at) DESC, d.id DESC
  `, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
};

const __routeController181 = (req, res) => {
  if (!canAssignDocuments(req.user)) return forbidden(res, 'Admin access required.');
  const hasAssignmentValue = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id');
  if (!hasAssignmentValue) return res.status(400).json({ error: 'assigned_user_id is required.' });
  const assignedUserId = req.body.assigned_user_id === null || req.body.assigned_user_id === '' ? null : Number(req.body.assigned_user_id);
  if (assignedUserId !== null && (!Number.isInteger(assignedUserId) || assignedUserId <= 0)) {
    return res.status(400).json({ error: 'Invalid assigned user.' });
  }

  db.get(`
    SELECT d.*, p.name as project_name, p.requester, p.stage as proj_stage, p.assigned_user_id as project_assigned_user_id, au.username as assigned_username
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    WHERE d.id = ?
  `, [req.params.documentId], (docErr, doc) => {
    if (docErr) return res.status(500).json({ error: 'DB error' });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const previousOwnerId = doc.assigned_user_id || null;
    if (normalizeRequirementState(doc.requirement_state) === 'Not Required' && assignedUserId) {
      return res.status(400).json({ error: 'Cannot assign a document marked as Not Required.' });
    }
    if ((previousOwnerId || null) === assignedUserId) {
      return res.json({ success: true, unchanged: true, assigned_user_id: previousOwnerId, assigned_username: doc.assigned_username || null });
    }

    const applyAssignment = (newOwner) => {
      const action = previousOwnerId && assignedUserId ? 'REASSIGN_DOCUMENT' : (assignedUserId ? 'ASSIGN_DOCUMENT' : 'CLEAR_ASSIGNMENT');
      requireUnlockedOrTemporaryStage(req, res, doc, 'assignment_change', (stageAccess) => {
      db.run("UPDATE Documents SET assigned_user_id = ? WHERE id = ?", [assignedUserId, req.params.documentId], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Assignment update failed' });
        db.run(`INSERT INTO DocumentOwnershipHistory (
          document_id, project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
          actor_user_id, actor_username, action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.project_id, previousOwnerId, doc.assigned_username || null, assignedUserId, newOwner?.username || null, req.user.id, req.user.username, action]);

        logActivity({
          req,
          action,
          projectId: doc.project_id,
          project: doc.project_name,
          requester: doc.requester,
          docType: doc.document_type_name,
          details: `${doc.assigned_username || 'Unassigned'} -> ${newOwner?.username || 'Unassigned'}`
        });

        if (assignedUserId) {
          insertNotifications({
            recipients: [assignedUserId],
            actorId: req.user.id,
            type: 'document_assigned',
            message: `You were assigned to ${doc.document_type_name} in ${doc.project_name}.`,
            projectId: doc.project_id,
            projectName: doc.project_name,
            documentId: doc.id,
            documentName: doc.document_type_name,
            stage: doc.stage,
            targetKind: 'document',
            targetMeta: { document_id: doc.id, stage: doc.stage },
            alertKey: `document_assignment:${doc.id}:${assignedUserId}`,
            dedupeMode: 'cooldown',
            cooldownMinutes: 10
          });
        }
        if (previousOwnerId && assignedUserId && previousOwnerId !== assignedUserId) {
          insertNotifications({
            recipients: [previousOwnerId],
            actorId: req.user.id,
            type: 'document_unassigned',
            message: `Your assignment for ${doc.document_type_name} in ${doc.project_name} was removed.`,
            projectId: doc.project_id,
            projectName: doc.project_name,
            documentId: doc.id,
            documentName: doc.document_type_name,
            stage: doc.stage,
            targetKind: 'document',
            targetMeta: { document_id: doc.id, stage: doc.stage },
            alertKey: `document_unassignment:${doc.id}:${previousOwnerId}`,
            dedupeMode: 'cooldown',
            cooldownMinutes: 10
          });
        }
        if (previousOwnerId && !assignedUserId) {
          getProjectCreatorId(doc.project_id, (_creatorErr, creatorId) => {
            insertNotifications({
              recipients: uniqueIds([previousOwnerId, doc.project_assigned_user_id, creatorId]),
              actorId: req.user.id,
              type: 'document_unassigned',
              message: `Your assignment for ${doc.document_type_name} in ${doc.project_name} was removed.`,
              projectId: doc.project_id,
              projectName: doc.project_name,
              documentId: doc.id,
              documentName: doc.document_type_name,
              stage: doc.stage,
              targetKind: 'document',
              targetMeta: { document_id: doc.id, stage: doc.stage },
              alertKey: `document_unassignment:${doc.id}:${previousOwnerId}`,
              dedupeMode: 'cooldown',
              cooldownMinutes: 10
            });
          });
        }

        updateProjectActivity(doc.project_id);
        logLockedStageEditUse({ req, doc, action: 'assignment_change', access: stageAccess, details: `changed assignment for ${doc.document_type_name}` });
        res.json({ success: true, assigned_user_id: assignedUserId, assigned_username: newOwner?.username || null, action });
      });
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

const __routeController182 = (req, res) => {
  const stage = req.query.stage || 'Proposal';
  db.all(`
    SELECT
      d.id,
      d.project_id,
      d.document_type_id,
      d.document_type_name,
      d.file_path,
      d.file_name,
      d.status,
      d.upload_date,
      d.document_date,
      d.stage,
      d.uploader_user_id,
      uu.username as uploader_username,
      d.assigned_user_id,
      au.username as assigned_username,
      d.remarks,
      COALESCE(d.requirement_state, 'Required') as requirement_state,
      COALESCE(rds.due_days, dt.due_days, 0) as due_days,
      COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
      COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
      COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
      p.created_at as project_created_at,
      COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome,
      COALESCE(d.document_order_index, d.id) as document_order_index,
      d.manual_due_date,
      d.due_date_override
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    LEFT JOIN Users uu ON uu.id = d.uploader_user_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    WHERE d.project_id = ? AND (d.stage = ? OR d.stage IS NULL)
    ORDER BY COALESCE(d.document_order_index, d.id) ASC, d.id ASC
  `, [req.params.projectId, stage], (e, rows) => {
    if (e) return res.status(500).json({error:"DB error"});
    
    // Process each row to calculate effective due dates using centralized helper
    const results = [];

    const processRow = (index) => {
      if (index >= rows.length) {
        res.json(results);
        return;
      }

      const row = rows[index];
      if (INACTIVE_PROJECT_OUTCOMES.includes(row.project_outcome)) {
        results.push({ ...row, due_at: null, due_date_source: 'inactive_project' });
        return processRow(index + 1);
      }
      
      // Use centralized helper to compute effective due date
      getEffectiveDueDate(row, (effErr, effResult) => {
        if (effErr) {
          results.push({ ...row, due_at: null });
        } else {
          results.push({ ...row, due_at: effResult.effective_due_date, due_date_source: effResult.due_date_source });
        }
        processRow(index + 1);
      });
    };

    processRow(0);
  });
};

const __routeController183 = (req, res) => {
  if (!req.file) return res.status(400).json({error: "No file"});
  
  getDocAndProjectStage(req.params.documentId, (err, doc) => {
    if (err || !doc) return res.status(404).json({error:"Not found"});
    if (INACTIVE_PROJECT_OUTCOMES.includes(doc.project_outcome) && req.user.role !== 'superadmin') {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ error: `This project is marked as ${doc.project_outcome}. Reopen the project before uploading new documents.` });
    }
    if (doc.assigned_user_id && Number(doc.assigned_user_id) !== Number(req.user.id)) {
      canBypassAssignmentOwnership(req.user).then((allowed) => {
        if (!allowed) {
          try { fs.unlinkSync(req.file.path); } catch(e) {}
          return res.status(403).json({ error: 'This document is assigned to another user.' });
        }
        requireUnlockedOrTemporaryStage(req, res, doc, 'upload', proceedUpload, () => { try { fs.unlinkSync(req.file.path); } catch(e) {} });
      }).catch(() => {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        res.status(500).json({ error: 'DB error' });
      });
      return;
    }
    function proceedUpload(stageAccess) {
    if (doc.requirement_state === 'Not Required') {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({error:"This document is marked as not required."});
    }
    if (doc.file_path) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.status(400).json({error:"File exists. Delete first."}); }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const sanitizeShort = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
    const ext = path.extname(req.file.originalname);
    const dShort = sanitizeShort(doc.document_type_name);
    const pShort = sanitizeShort(doc.project_name);
    const rShort = sanitizeShort(doc.requester);
    const finalFileName = `${dateStr}_${dShort}_${pShort}_${rShort}${ext}`;

    const projFolder = `Proj_${doc.project_id}`;
    const docFolder = `Doc_${req.params.documentId}`;
    const fullPath = path.join(UPLOADS_DIR, projFolder, docFolder);
    const finalPath = path.join(fullPath, finalFileName);
    const relPath = path.join(projFolder, docFolder, finalFileName).replace(/\\/g,'/');

    try { fs.mkdirSync(fullPath, {recursive:true}); } catch(e) { 
        logError('UPLOAD_MKDIR', e.message, e.stack);
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        return res.status(500).json({error:"Failed to create folder"}); 
    }

    fs.rename(req.file.path, finalPath, (moveErr) => {
        if (moveErr) { logError('UPLOAD_RENAME', moveErr.message, moveErr.stack); try { fs.unlinkSync(req.file.path); } catch(e) {} return res.status(500).json({error:"Save failed"}); }
        const nowISO = now.toISOString();
        db.run("UPDATE Documents SET file_path=?, file_name=?, upload_date=?, document_date=NULL, status='For Review', uploader_user_id=? WHERE id=?", [relPath, req.file.originalname, nowISO, req.user.id, req.params.documentId], async (dbErr) => {
            if(dbErr) { logError('UPLOAD_DB_UPDATE', dbErr.message, dbErr.stack); return res.status(500).json({error:"DB update failed"}); }
            try { logActivity({ req, action: 'UPLOAD_FILE', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: `Uploaded ${finalFileName}` }); } catch(e) { logError('UPLOAD_LOG', e.message, e.stack); }
            getProjectCreatorId(doc.project_id, (_creatorErr, creatorId) => {
              const reviewerId = doc.assigned_user_id || doc.project_assigned_user_id || creatorId;
              insertNotifications({
                recipients: reviewerId ? [reviewerId] : [],
                actorId: req.user.id,
                type: 'document_for_review',
                message: `${req.user.username} uploaded ${doc.document_type_name} for review in ${doc.project_name}`,
                projectId: doc.project_id,
                projectName: doc.project_name,
                documentId: doc.id,
                documentName: doc.document_type_name,
                stage: doc.doc_stage || doc.stage,
                targetKind: 'document',
                targetMeta: { document_id: doc.id, stage: doc.doc_stage || doc.stage, upload_date: nowISO },
                alertKey: `document_for_review:${doc.id}`,
                dedupeMode: 'cooldown',
                cooldownMinutes: 5
              });
            });
            updateProjectActivity(doc.project_id); 
            indexDocumentSearch(req.params.documentId);
            logLockedStageEditUse({ req, doc, action: 'upload', access: stageAccess, details: `uploaded ${doc.document_type_name}` });
            // After uploading a document, we need to recalculate due dates for any documents that depend on this one
            recalculateDueDatesForDependentDocuments(doc.project_id, doc.document_type_id);
            const geotagMap = await autoAddProjectImageToGeotagMap({
              req,
              sourcePath: finalPath,
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              fileSize: req.file.size,
              projectId: doc.project_id,
              projectName: doc.project_name,
              stage: doc.doc_stage || doc.proj_stage || 'Unspecified',
              documentName: doc.document_type_name,
              sourceDocumentId: Number(doc.id)
            });
            res.json({message:"Success", geotag_map: geotagMap});
        });
    });
    }
    requireUnlockedOrTemporaryStage(req, res, doc, 'upload', proceedUpload, () => { try { fs.unlinkSync(req.file.path); } catch(e) {} });
  });
};

const __routeController184 = (req, res) => {
  getDocAndProjectStage(req.params.docId, (docErr, doc) => {
    if (docErr || !doc || !doc.file_path) return res.status(404).json({error:"File not found"});
    const filePath = path.join(UPLOADS_DIR, doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({error:"File missing on disk"});
    res.download(filePath, doc.file_name);
  });
};

const __routeController185 = async (req, res) => {
  const projectId = req.params.id;
  const stageOrderCase = `CASE d.stage WHEN 'Proposal' THEN 1 WHEN 'Implementation' THEN 2 WHEN 'Monitoring' THEN 3 ELSE 4 END`;

  const projectQuery = `
    SELECT p.id, p.name, p.requester, p.district, p.barangay, p.status, p.stage,
           COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as outcome,
           pt.name as type_name, req.name as requestee_name, au.username as assigned_username
    FROM Projects p
    LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
    LEFT JOIN Requestees req ON req.id = p.requestee_id
    LEFT JOIN Users au ON au.id = p.assigned_user_id
    WHERE p.id = ?
  `;
  const documentQuery = `
    SELECT d.id, d.document_type_name, d.file_path, d.file_name, d.upload_date, d.document_date, d.status,
           d.requirement_state, d.stage, COALESCE(d.document_order_index, d.id) as order_index
    FROM Documents d
    LEFT JOIN Projects p ON p.id = d.project_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id
      AND rs.requestee_id = p.requestee_id
      AND rs.stage = d.stage
    WHERE d.project_id = ?
    ORDER BY ${stageOrderCase} ASC, COALESCE(d.document_order_index, d.id) ASC, d.id ASC
  `;

  db.get(projectQuery, [projectId], (projErr, project) => {
    if (projErr || !project) return res.status(404).json({ error: "Project not found" });

    db.all(documentQuery, [projectId], async (docErr, checklistDocuments) => {
      if (docErr) return res.status(500).json({ error: "Failed to fetch documents" });
      const uploadedDocuments = (checklistDocuments || []).filter(doc => doc.file_path);
      if (!uploadedDocuments.length) return res.status(400).json({ error: "No uploaded documents found for this project." });

      try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const unsupportedFiles = [];
        const missingFiles = [];
        let includedCount = 0;
        const longPaperSize = [612, 936]; // 8.5 x 13 in, 72 points per inch.
        const textColor = rgb(0.12, 0.14, 0.18);
        const missingColor = rgb(0.75, 0.12, 0.12);
        const truncateText = (text, maxChars = 90) => {
          const value = String(text || '-');
          return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
        };
        const formatExportDateTime = (value) => {
          if (!value) return '-';
          try {
            return new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit',
              hour: 'numeric', minute: '2-digit', hour12: true
            }).format(new Date(value));
          } catch (e) { return '-'; }
        };
        const drawText = (page, text, x, y, size = 10, usedFont = font, color = textColor) => {
          page.drawText(String(text ?? '-'), { x, y, size, font: usedFont, color });
        };
        const fitLongPaperPlacement = (sourceWidth, sourceHeight) => {
          const landscape = sourceWidth > sourceHeight;
          const fitWidth = landscape ? sourceHeight : sourceWidth;
          const fitHeight = landscape ? sourceWidth : sourceHeight;
          const scale = Math.min(longPaperSize[0] / fitWidth, longPaperSize[1] / fitHeight);
          const boxWidth = fitWidth * scale;
          const boxHeight = fitHeight * scale;
          const x = (longPaperSize[0] - boxWidth) / 2;
          const y = (longPaperSize[1] - boxHeight) / 2;
          return landscape
            ? { x: x + boxWidth, y, width: sourceWidth * scale, height: sourceHeight * scale, rotate: degrees(90) }
            : { x, y, width: boxWidth, height: boxHeight };
        };

        const cover = pdfDoc.addPage(longPaperSize);
        let y = 886;
        drawText(cover, 'Project Document Export', 48, y, 20, boldFont, rgb(0.22, 0.20, 0.70));
        y -= 34;
        [
          ['Project name', project.name],
          ['Project type', project.type_name || 'Unknown'],
          ['Requester', project.requester || '-'],
          ['Requestee', project.requestee_name || 'Unknown'],
          ['Barangay / District', [project.barangay, project.district].filter(Boolean).join(', ') || '-'],
          ['Current stage', project.stage],
          ['Project assigned to', project.assigned_username || 'Unassigned'],
          ['Export date', new Date().toLocaleString()],
          ['Exported by', req.user?.username || 'Unknown']
        ].forEach(([label, value]) => {
          drawText(cover, `${label}:`, 48, y, 10, boldFont);
          drawText(cover, truncateText(value, 76), 168, y, 10);
          y -= 17;
        });

        const isCountableDoc = (d) => normalizeRequirementState(d.requirement_state) !== 'Not Required' && !(normalizeRequirementState(d.requirement_state) === 'Optional' && !d.file_path);
        const countableChecklistDocuments = checklistDocuments.filter(isCountableDoc);
        const totalRequired = countableChecklistDocuments.length;
        const reviewed = countableChecklistDocuments.filter(d => d.status === 'Checked').length;
        const forReview = countableChecklistDocuments.filter(d => d.status === 'For Review').length;
        const missing = countableChecklistDocuments.filter(d => !d.file_path).length;
        y -= 12;
        drawText(cover, 'Document checklist summary', 48, y, 14, boldFont);
        y -= 22;
        [
          ['Total required documents', totalRequired],
          ['Uploaded documents', uploadedDocuments.length],
          ['Reviewed documents', reviewed],
          ['For Review documents', forReview],
          ['Missing documents', missing]
        ].forEach(([label, value]) => {
          const color = label === 'Missing documents' && missing > 0 ? missingColor : textColor;
          drawText(cover, `${label}:`, 64, y, 10, boldFont, color);
          drawText(cover, value, 230, y, 10, font, color);
          y -= 16;
        });

        y -= 10;
        drawText(cover, 'Checklist', 48, y, 13, boldFont);
        y -= 18;
        let checklistPage = cover;
        const checklistColumns = { stage: 48, document: 112, documentDate: 352, status: 482 };
        const drawChecklistHeader = (page) => {
          drawText(page, 'Stage', checklistColumns.stage, y, 8, boldFont);
          drawText(page, 'Document name', checklistColumns.document, y, 8, boldFont);
          drawText(page, 'Document date', checklistColumns.documentDate, y, 8, boldFont);
          drawText(page, 'Status', checklistColumns.status, y, 8, boldFont);
          y -= 14;
        };
        drawChecklistHeader(checklistPage);
        checklistDocuments.forEach(doc => {
          if (y < 58) {
            checklistPage = pdfDoc.addPage(longPaperSize);
            y = 886;
            drawText(checklistPage, 'Checklist (continued)', 48, y, 13, boldFont);
            y -= 18;
            drawChecklistHeader(checklistPage);
          }
          const state = doc.file_path ? (doc.status || 'Uploaded') : (doc.requirement_state || 'Missing');
          const color = isCountableDoc(doc) && !doc.file_path ? missingColor : textColor;
          drawText(checklistPage, truncateText(doc.stage || '-', 12), checklistColumns.stage, y, 7.5, font, color);
          drawText(checklistPage, truncateText(doc.document_type_name || '-', 46), checklistColumns.document, y, 7.5, font, color);
          drawText(checklistPage, truncateText(formatExportDateTime(doc.document_date), 28), checklistColumns.documentDate, y, 7.5, font, color);
          drawText(checklistPage, truncateText(state, 18), checklistColumns.status, y, 7.5, font, color);
          y -= 14;
        });

        for (const doc of uploadedDocuments) {
          const fullPath = path.join(UPLOADS_DIR, doc.file_path);
          if (!fs.existsSync(fullPath)) {
            missingFiles.push(doc.file_name || doc.document_type_name);
            continue;
          }

          const ext = path.extname(doc.file_name).toLowerCase();
          if (!PDF_EXPORT_EXTENSIONS.includes(ext)) {
            unsupportedFiles.push(doc.file_name || doc.document_type_name);
            continue;
          }

          try {
            const fileBuffer = fs.readFileSync(fullPath);
            if (ext === '.pdf') {
              const embeddedPdf = await PDFDocument.load(fileBuffer);
              for (const sourcePage of embeddedPdf.getPages()) {
                const embeddedPage = await pdfDoc.embedPage(sourcePage);
                const page = pdfDoc.addPage(longPaperSize);
                page.drawPage(embeddedPage, fitLongPaperPlacement(embeddedPage.width, embeddedPage.height));
                includedCount += 1;
              }
            } else {
              const image = ext === '.jpg' || ext === '.jpeg'
                ? await pdfDoc.embedJpg(fileBuffer)
                : await pdfDoc.embedPng(fileBuffer);
              const page = pdfDoc.addPage(longPaperSize);
              page.drawImage(image, fitLongPaperPlacement(image.width, image.height));
              includedCount += 1;
            }
          } catch (fileErr) {
            unsupportedFiles.push(doc.file_name || doc.document_type_name);
            logError('EXPORT_PDF_PROCESS_FILE', fileErr.message, fileErr.stack);
          }
        }

        if (unsupportedFiles.length || missingFiles.length || includedCount === 0) {
          const notes = pdfDoc.addPage(longPaperSize);
          y = 886;
          drawText(notes, 'Export Notes', 48, y, 18, boldFont, rgb(0.70, 0.20, 0.12));
          y -= 30;
          if (includedCount === 0) {
            drawText(notes, 'No uploaded PDF/image files could be included in this compiled PDF.', 48, y, 10, boldFont);
            y -= 22;
          }
          if (unsupportedFiles.length) {
            drawText(notes, 'The following uploaded office files are stored in the system but were not merged because office-to-PDF conversion is not available on this server:', 48, y, 8);
            y -= 18;
            unsupportedFiles.slice(0, 35).forEach(fileName => {
              if (y < 54) return;
              drawText(notes, `- ${truncateText(fileName, 82)}`, 64, y, 9);
              y -= 13;
            });
          }
          if (missingFiles.length && y > 80) {
            y -= 14;
            drawText(notes, 'Missing physical files:', 48, y, 10, boldFont);
            y -= 18;
            missingFiles.slice(0, 20).forEach(fileName => {
              if (y < 54) return;
              drawText(notes, `- ${truncateText(fileName, 82)}`, 64, y, 9);
              y -= 13;
            });
          }
        }

        const pdfBytes = await pdfDoc.save();
        const safeFileName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="project_${safeFileName}.pdf"`);
        res.setHeader('Content-Length', pdfBytes.length);
        res.send(Buffer.from(pdfBytes));

        try {
          logActivity({
            req,
            action: 'EXPORT_PDF',
            projectId: project.id,
            project: project.name,
            details: `Exported project PDF with ${includedCount} included PDF/image page(s), ${unsupportedFiles.length} unsupported file(s), and ${missingFiles.length} missing file(s)`
          });
        } catch (logErr) {}
      } catch (pdfErr) {
        logError('EXPORT_PDF_CREATE', pdfErr.message, pdfErr.stack);
        res.status(500).json({ error: "Failed to create PDF" });
      }
    });
  });
};

const __routeController186 = (req, res) => {
  getDocAndProjectStage(req.params.docId, (err, doc) => {
    if (err || !doc) return res.status(404).json({error:"Not found"});
    if (doc.doc_stage !== 'Monitoring') return res.status(400).json({error: "Only monitoring document slots can be deleted."});
    if (doc.proj_stage !== 'Monitoring') return res.status(403).json({error: "Cannot delete: Monitoring stage is locked."});
    if (doc.file_path) return res.status(400).json({error: "Delete the uploaded file first."});

    db.run("DELETE FROM Documents WHERE id = ?", [req.params.docId], function(deleteErr) {
      if (deleteErr) return res.status(500).json({error:"Delete failed"});
      try { logActivity({ req, action: 'MONITORING_DOC_DELETE', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: 'Monitoring document deleted' }); } catch(e) {}
      notifyDocumentEvent({
        req,
        type: 'document_deleted',
        message: `${req.user.username} deleted ${doc.document_type_name}`,
        doc,
        includeUploader: true,
        alertKey: `document_deleted:${doc.id}`,
        dedupeMode: 'cooldown',
        cooldownMinutes: 5
      });
      updateProjectActivity(doc.project_id);
      res.json({success: true, changes: this.changes});
    });
  });
};

const __routeController187 = (req, res) => {
  getDocAndProjectStage(req.params.docId, (err, doc) => {
    if (err || !doc || !doc.file_path) return res.status(404).json({error:"Not found"});
    requireUnlockedOrTemporaryStage(req, res, doc, 'delete_file', async (stageAccess) => {
      try {
        const bypass = await canBypassAssignmentOwnership(req.user);
        const isUploader = doc.uploader_user_id && Number(doc.uploader_user_id) === Number(req.user.id);
        if (doc.assigned_user_id && Number(doc.assigned_user_id) !== Number(req.user.id) && !bypass && !isUploader) {
          return res.status(403).json({ error: 'This document is assigned to another user.' });
        }
        if (!isUploader && doc.uploader_user_id && Number(doc.uploader_user_id) !== Number(req.user.id) && !bypass) {
          const owner = await dbGet(`SELECT id, username FROM Users WHERE id = ?`, [doc.uploader_user_id]);
          const result = await createDeletionRequest({
            req,
            targetType: 'document_file',
            targetId: Number(doc.id),
            projectId: Number(doc.project_id),
            documentId: Number(doc.id),
            ownerUserId: doc.uploader_user_id,
            ownerUsername: owner?.username || doc.uploader_username || '',
            targetName: `file ${doc.file_name || doc.document_type_name}`,
            targetSnapshot: doc
          });
          return deletionRequestResponse(res, result);
        }
        await deleteDocumentFileInternal(req, req.params.docId, { stageAccess });
        res.json({ message: "Deleted" });
      } catch (e) {
        logError('DELETE_FILE', e.message, e.stack);
        res.status(e.status || 500).json({ error: e.message || "Update failed" });
      }
    });
  });
};

const __routeController188 = (req, res) => {
    const { status } = req.body;
    if (status !== 'Checked' && status !== 'For Review') return res.status(400).json({ error: "Invalid status" });

    getDocAndProjectStage(req.params.documentId, (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: "Document not found" });
        
        if (!doc.file_path || !fs.existsSync(path.join(UPLOADS_DIR, doc.file_path))) {
             return res.status(400).json({ error: "No file uploaded." });
        }

        requireUnlockedOrTemporaryStage(req, res, doc, 'status_change', async (stageAccess) => {
        if (doc.status === status) {
            try {
              await syncProjectDocumentMapMediaReviewState(doc.id);
            } catch (syncErr) {
              logError('PROJECT_GEOTAG_REVIEW_RESYNC', syncErr.message, syncErr.stack);
              return res.status(500).json({ error: 'Document status is unchanged, but its Geotag Map publication could not be synchronized.' });
            }
            return res.json({ success: true, unchanged: true, status: doc.status });
        }

        if (status === 'Checked') {
            if (!doc.document_date) {
              return res.status(400).json({ error: 'Document date is required before this document can be marked Checked. Please inform the uploader to enter the document date.' });
            }
            const now = new Date().toISOString();
            db.run("UPDATE Documents SET status = 'Checked', checked_at = ?, checked_by_user_id = ?, checked_by_username = ? WHERE id = ?", [now, req.user.id, req.user.username, req.params.documentId], async (updateErr) => {
                if (updateErr) return res.status(500).json({ error: "Update failed" });
                try {
                  await syncProjectDocumentMapMediaReviewState(doc.id);
                } catch (syncErr) {
                  logError('PROJECT_GEOTAG_REVIEW_PUBLISH', syncErr.message, syncErr.stack);
                  return res.status(500).json({ error: 'Document was checked, but its Geotag Map photo could not be published.' });
                }
                try { logActivity({ req, action: 'STATUS_CHANGE', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: `Changed to Checked` }); } catch(e) {}
                notifyDocumentEvent({
                  req,
                  type: doc.doc_stage === 'Monitoring' ? 'monitoring_document_reviewed' : 'document_reviewed',
                  message: `${req.user.username} reviewed ${doc.document_type_name}`,
                  doc,
                  includeUploader: true,
                  alertKey: `document_checked:${doc.id}`,
                  dedupeMode: 'cooldown',
                  cooldownMinutes: 5
                });
                updateProjectActivity(doc.project_id);
                logLockedStageEditUse({ req, doc, action: 'status_change', access: stageAccess, details: `changed ${doc.document_type_name} status to Checked` });
                res.json({ success: true, status: 'Checked', checked_at: now });
            });
        } else { 
            db.run("UPDATE Documents SET status = 'For Review', checked_at = NULL, checked_by_user_id = NULL, checked_by_username = NULL WHERE id = ?", [req.params.documentId], async (updateErr) => {
                if (updateErr) return res.status(500).json({ error: "Update failed" });
                try {
                  await syncProjectDocumentMapMediaReviewState(doc.id);
                } catch (syncErr) {
                  logError('PROJECT_GEOTAG_REVIEW_UNPUBLISH', syncErr.message, syncErr.stack);
                  return res.status(500).json({ error: 'Document was reopened, but its Geotag Map photo could not be hidden.' });
                }
                try { logActivity({ req, action: 'STATUS_CHANGE', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: `Reverted to For Review` }); } catch(e) {}
                notifyDocumentEvent({
                  req,
                  type: 'document_reopened',
                  message: `${req.user.username} reopened ${doc.document_type_name} for review`,
                  doc,
                  includeUploader: true,
                  alertKey: `document_checked:${doc.id}`,
                  dedupeMode: 'cooldown',
                  cooldownMinutes: 5
                });
                updateProjectActivity(doc.project_id);
                logLockedStageEditUse({ req, doc, action: 'status_change', access: stageAccess, details: `changed ${doc.document_type_name} status to For Review` });
                res.json({ success: true, status: 'For Review', checked_at: null });
            });
        }
        });
    });
};

const __routeController189 = (req, res) => {
    const requirementState = String(req.body.requirement_state || '').trim();
    if (!['Required', 'Optional', 'Not Required'].includes(requirementState)) return res.status(400).json({ error: "Invalid requirement state" });

    db.get(`
      SELECT d.id, d.project_id, d.document_type_id, d.document_type_name, d.file_path, d.file_name,
             d.status, d.checked_at, d.requirement_state, d.assigned_user_id, d.stage as doc_stage,
             d.manual_due_date, d.due_date_override, d.due_date, d.uploader_user_id,
             p.name as project_name, p.requester, p.stage as proj_stage, p.assigned_user_id as project_assigned_user_id,
             au.username as assigned_username, pau.username as project_assigned_username
      FROM Documents d
      JOIN Projects p ON d.project_id = p.id
      LEFT JOIN Users au ON au.id = d.assigned_user_id
      LEFT JOIN Users pau ON pau.id = p.assigned_user_id
      WHERE d.id = ?
    `, [req.params.documentId], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: "Document not found" });
        checkPrivilege('edit_requirement_state')(req, res, () => {
          requireUnlockedOrTemporaryStage(req, res, doc, 'requirement_state_change', (stageAccess) => applyRequirementState(stageAccess));
        });

        function applyRequirementState(stageAccess) {
        const previousState = normalizeRequirementState(doc.requirement_state);
        const nextState = normalizeRequirementState(requirementState);
        const previousAssignedUserId = doc.assigned_user_id || null;
        const previousAssignedUsername = doc.assigned_username || null;
        const nextAssignedUserId = nextState === 'Not Required' || previousState === 'Not Required' ? null : previousAssignedUserId;
        let nextStatus = 'None';
        let nextCheckedAt = null;
        if (nextState !== 'Not Required' && doc.file_path) {
          nextStatus = ['Checked', 'For Review'].includes(doc.status) ? doc.status : 'For Review';
          nextCheckedAt = nextStatus === 'Checked' ? (doc.checked_at || new Date().toISOString()) : null;
        }

        db.run("UPDATE Documents SET requirement_state = ?, status = ?, checked_at = ?, assigned_user_id = ? WHERE id = ?", [nextState, nextStatus, nextCheckedAt, nextAssignedUserId, req.params.documentId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: "Update failed" });
            if (nextState === 'Not Required' && previousAssignedUserId) {
              db.run(`INSERT INTO DocumentOwnershipHistory (
                document_id, project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
                actor_user_id, actor_username, action, details
              ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
              [
                doc.id,
                doc.project_id,
                previousAssignedUserId,
                previousAssignedUsername,
                req.user.id,
                req.user.username,
                'REQUIREMENT_NOT_REQUIRED_CLEAR_ASSIGNMENT',
                'Assignment cleared because document was marked as Not Required.'
              ]);
            }
            try {
                logActivity({
                    req,
                    action: 'REQUIREMENT_STATE_UPDATE',
                    projectId: doc.project_id,
                    project: doc.project_name,
                    requester: doc.requester,
                    docType: doc.document_type_name,
                    details: `Requirement state changed from ${previousState} to ${nextState}${previousAssignedUserId && nextState === 'Not Required' ? `; assignment cleared from ${previousAssignedUsername || `User #${previousAssignedUserId}`}` : ''}`
                });
            } catch (e) {}
            if (nextState === 'Not Required' && previousAssignedUserId) {
              insertNotifications({
                recipients: [previousAssignedUserId],
                actorId: req.user.id,
                type: 'document_requirement_not_required',
                message: `Your assignment for ${doc.document_type_name} in ${doc.project_name} was removed because the document was marked as Not Required.`,
                projectId: doc.project_id,
                projectName: doc.project_name,
                documentId: doc.id,
                documentName: doc.document_type_name,
                stage: doc.doc_stage,
                targetKind: 'requirement',
                targetMeta: { document_id: doc.id, stage: doc.doc_stage, requirement_state: nextState, previous_requirement_state: previousState },
                alertKey: `document_requirement_state:${doc.id}:not_required:${previousAssignedUserId}`,
                dedupeMode: 'cooldown',
                cooldownMinutes: 15
              });
            } else if (previousState === 'Not Required' && nextState === 'Required') {
              getProjectCreatorId(doc.project_id, (_creatorErr, creatorId) => {
                insertNotifications({
                  recipients: uniqueIds([doc.assigned_user_id, doc.project_assigned_user_id, creatorId]),
                  actorId: req.user.id,
                  type: 'document_requirement_required',
                  message: `${doc.document_type_name} in ${doc.project_name} is now Required again and needs assignment/upload.`,
                  projectId: doc.project_id,
                  projectName: doc.project_name,
                  documentId: doc.id,
                  documentName: doc.document_type_name,
                  stage: doc.doc_stage,
                  targetKind: 'requirement',
                  targetMeta: { document_id: doc.id, stage: doc.doc_stage, requirement_state: nextState, previous_requirement_state: previousState },
                  alertKey: `document_requirement_state:${doc.id}:required:${doc.assigned_user_id || doc.project_assigned_user_id || creatorId || 'owner'}`,
                  dedupeMode: 'cooldown',
                  cooldownMinutes: 15
                });
              });
            } else if (nextState === 'Optional') {
              getProjectCreatorId(doc.project_id, (_creatorErr, creatorId) => {
                insertNotifications({
                  recipients: uniqueIds([creatorId, doc.project_assigned_user_id]),
                  actorId: req.user.id,
                  type: 'document_requirement_optional',
                  message: `${doc.document_type_name} in ${doc.project_name} was marked as Optional.`,
                  projectId: doc.project_id,
                  projectName: doc.project_name,
                  documentId: doc.id,
                  documentName: doc.document_type_name,
                  stage: doc.doc_stage,
                  targetKind: 'requirement',
                  targetMeta: { document_id: doc.id, stage: doc.doc_stage, requirement_state: nextState, previous_requirement_state: previousState },
                  alertKey: `document_requirement_state:${doc.id}:optional:${doc.project_assigned_user_id || creatorId || 'owner'}`,
                  dedupeMode: 'cooldown',
                  cooldownMinutes: 15
                });
              });
            }
            updateProjectActivity(doc.project_id);
            logLockedStageEditUse({ req, doc, action: 'requirement_state_change', access: stageAccess, details: `changed ${doc.document_type_name} requirement from ${previousState} to ${nextState}` });
            res.json({
              success: true,
              requirement_state: nextState,
              status: nextStatus,
              assigned_user_id: nextAssignedUserId,
              assigned_username: nextAssignedUserId ? previousAssignedUsername : null,
              previous_assigned_user_id: nextState === 'Not Required' ? previousAssignedUserId : null,
              previous_assigned_username: nextState === 'Not Required' ? previousAssignedUsername : null
            });
        });
        }
    });
};

const updateDocumentDateController = async (req, res) => {
  const rawValue = String(req.body?.document_date || '').trim();
  if (!rawValue) return res.status(400).json({ error: 'Document date and time are required.' });
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid document date and time.' });

  getDocAndProjectStage(req.params.documentId, async (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.file_path || !fs.existsSync(path.join(UPLOADS_DIR, doc.file_path))) {
      return res.status(400).json({ error: 'Upload the document file before entering its document date.' });
    }
    const isUploader = Number(doc.uploader_user_id || 0) === Number(req.user?.id || 0);
    const isSuperadmin = req.user?.role === 'superadmin';
    if (!isUploader && !isSuperadmin) {
      return res.status(403).json({ error: 'Only the document uploader can enter or edit the document date.' });
    }
    requireUnlockedOrTemporaryStage(req, res, doc, 'upload', (stageAccess) => {
      const isoValue = parsed.toISOString();
      db.run('UPDATE Documents SET document_date = ? WHERE id = ?', [isoValue, req.params.documentId], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Document date update failed.' });
        try {
          logActivity({
            req,
            action: 'DOCUMENT_DATE_SET',
            projectId: doc.project_id,
            project: doc.project_name,
            requester: doc.requester,
            docType: doc.document_type_name,
            details: `Document date set to ${isoValue}`
          });
        } catch (e) {}
        updateProjectActivity(doc.project_id);
        logLockedStageEditUse({ req, doc, action: 'upload', access: stageAccess, details: `updated document date for ${doc.document_type_name}` });
        res.json({ success: true, document_date: isoValue });
      });
    });
  });
};

const updateDocumentRemarksController = async (req, res) => {
  const remarks = String(req.body?.remarks ?? '').trim();
  if (remarks.length > 2000) return res.status(400).json({ error: 'Document remarks must be 2,000 characters or fewer.' });

  try {
    const doc = await dbGet(`
      SELECT d.id, d.project_id, d.document_type_name, d.stage as doc_stage, d.assigned_user_id, d.remarks,
             p.name as project_name, p.requester, p.stage as proj_stage,
             COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome
      FROM Documents d
      JOIN Projects p ON p.id = d.project_id
      WHERE d.id = ?
    `, [req.params.documentId]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (INACTIVE_PROJECT_OUTCOMES.includes(doc.project_outcome) && req.user.role !== 'superadmin') {
      return res.status(400).json({ error: `This project is marked as ${doc.project_outcome}. Reopen the project before editing document remarks.` });
    }
    if (doc.proj_stage !== doc.doc_stage && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'This stage is read-only. Document remarks can only be edited in the current project stage.' });
    }

    const bypassOwnership = await canBypassAssignmentOwnership(req.user);
    const canReview = await userHasPrivilegeAsync(req.user, 'mark_checked');
    const canUploadDocument = await userHasPrivilegeAsync(req.user, 'upload_document');
    const ownsDocument = !doc.assigned_user_id || Number(doc.assigned_user_id) === Number(req.user.id);
    if (!bypassOwnership && !canReview && !(ownsDocument && canUploadDocument)) {
      return res.status(403).json({ error: doc.assigned_user_id ? 'This document is assigned to another user.' : 'You do not have permission to edit document remarks.' });
    }

    const previousRemarks = String(doc.remarks || '').trim();
    if (previousRemarks === remarks) return res.json({ success: true, unchanged: true, remarks });

    await dbRun('UPDATE Documents SET remarks = ? WHERE id = ?', [remarks || null, doc.id]);
    updateProjectActivity(doc.project_id);
    try {
      logActivity({
        req,
        action: remarks ? 'DOCUMENT_REMARKS_UPDATE' : 'DOCUMENT_REMARKS_CLEAR',
        projectId: doc.project_id,
        project: doc.project_name,
        requester: doc.requester,
        docType: doc.document_type_name,
        details: remarks ? 'Updated document remark' : 'Cleared document remark'
      });
    } catch (e) {}
    res.json({ success: true, remarks });
  } catch (e) {
    logError('DOCUMENT_REMARKS_UPDATE', e.message, e.stack);
    res.status(500).json({ error: 'Failed to update document remarks' });
  }
};

const __routeController190 = (req, res) => {
    const { due_date, clear_override } = req.body;
    const projectId = req.params.projectId;

    db.get(`SELECT p.*, au.username as assigned_username FROM Projects p LEFT JOIN Users au ON au.id = p.assigned_user_id WHERE p.id = ?`, [projectId], (err, project) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!project) return res.status(404).json({ error: "Project not found" });

        const notifyProjectDueDateChange = (type, message, targetMeta = {}) => {
          const alertKey = targetMeta.alert_key || `manual_due_date_changed:project:${project.id}`;
          const cleanTargetMeta = { ...targetMeta };
          delete cleanTargetMeta.alert_key;
          getProjectCreatorId(project.id, (_creatorErr, creatorId) => {
            insertNotifications({
              recipients: uniqueIds([creatorId, project.assigned_user_id]),
              actorId: req.user.id,
              type,
              message,
              projectId: project.id,
              projectName: project.name,
              stage: project.stage,
              targetKind: 'project_due_date',
              targetMeta: { highlight: 'project_due_date', ...cleanTargetMeta },
              alertKey,
              dedupeMode: 'cooldown',
              cooldownMinutes: 10
            });
          });
        };

        if (clear_override) {
            if (!project.manual_due_date && !project.due_date_override) {
                return res.json({ success: true, unchanged: true, message: 'No project due date to clear' });
            }
            return db.run("UPDATE Projects SET manual_due_date = NULL, due_date_override = 0, updated_at = ?, last_activity_at = ? WHERE id = ?", [new Date().toISOString(), new Date().toISOString(), projectId], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: "Update failed" });
                try { logActivity({ req, action: 'PROJECT_DUE_DATE_CLEAR', projectId: project.id, project: project.name, requester: project.requester, docType: '-', details: 'Project due date cleared' }); } catch(e) {}
                notifyProjectDueDateChange(
                  'manual_due_date_removed',
                  `Manual due date removed for project ${project.name}`,
                  { previous_due_date: project.manual_due_date || null }
                );
                updateProjectActivity(project.id);
                res.json({ success: true, message: 'Project due date cleared' });
            });
        }

        if (!due_date) return res.status(400).json({ error: "Due date is required" });
        const parsedDate = parseManualDueDateInput(due_date);
        if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Invalid date format" });

        const dueDateISO = parsedDate.toISOString();
        const previousDueTime = project.manual_due_date ? new Date(project.manual_due_date).getTime() : null;
        if (previousDueTime && previousDueTime === parsedDate.getTime()) {
            return res.json({ success: true, unchanged: true, due_date: dueDateISO, message: 'Project due date unchanged' });
        }

        db.run("UPDATE Projects SET manual_due_date = ?, due_date_override = 1, updated_at = ?, last_activity_at = ? WHERE id = ?", [dueDateISO, new Date().toISOString(), new Date().toISOString(), projectId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: "Update failed" });
            try { logActivity({ req, action: 'PROJECT_DUE_DATE_SET', projectId: project.id, project: project.name, requester: project.requester, docType: '-', details: `Project due date set to ${dueDateISO}` }); } catch(e) {}
            notifyProjectDueDateChange(
              'manual_due_date_changed',
              `Manual due date changed for project ${project.name}: ${formatManilaDueDate(dueDateISO)}`,
              { due_date: dueDateISO, previous_due_date: project.manual_due_date || null, alert_key: `manual_due_date_changed:project:${project.id}` }
            );
            runDueDateAlertSweep();
            updateProjectActivity(project.id);
            res.json({ success: true, due_date: dueDateISO });
        });
    });
};

const __routeController191 = (req, res) => {
    const { due_date, clear_override } = req.body;
    
    getDocAndProjectStage(req.params.documentId, (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: "Document not found" });
        requireUnlockedOrTemporaryStage(req, res, doc, 'due_date_change', (stageAccess) => {
        
        // If clearing override - same privilege covers it
        if (clear_override) {
            if (!doc.manual_due_date && !doc.due_date_override) {
                return res.json({ success: true, unchanged: true, message: 'No manual due date override to clear' });
            }
            proceedClear();
            return;
            
            function proceedClear() {
                db.run("UPDATE Documents SET manual_due_date = NULL, due_date_override = 0 WHERE id = ?", [req.params.documentId], (updateErr) => {
                    if (updateErr) return res.status(500).json({ error: "Update failed" });
                    try { logActivity({ req, action: 'DUE_DATE_OVERRIDE_CLEAR', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: 'Manual due date cleared' }); } catch(e) {}
                    notifyDocumentEvent({
                      req,
                      type: 'manual_due_date_removed',
                      message: `Manual due date removed for ${doc.document_type_name} in ${doc.project_name}`,
                      doc,
                      includeCreator: true,
                      includeUploader: false,
                      targetKind: 'due_date',
                      targetMeta: { previous_due_date: doc.manual_due_date || doc.due_date || null },
                      alertKey: `manual_due_date_changed:document:${doc.id}`,
                      dedupeMode: 'cooldown',
                      cooldownMinutes: 10
                    });
                    updateProjectActivity(doc.project_id);
                    logLockedStageEditUse({ req, doc, action: 'due_date_change', access: stageAccess, details: `cleared manual due date for ${doc.document_type_name}` });
                    res.json({ success: true, message: 'Due date override cleared' });
                });
            }
        }
        
        // Validate due_date is provided
        if (!due_date) return res.status(400).json({ error: "Due date is required" });
        
        // Parse and validate date
        const parsedDate = parseManualDueDateInput(due_date);
        if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Invalid date format" });
        
        const dueDateISO = parsedDate.toISOString();
        const previousDueTime = doc.manual_due_date ? new Date(doc.manual_due_date).getTime() : null;
        if (previousDueTime && previousDueTime === parsedDate.getTime()) {
            return res.json({ success: true, unchanged: true, due_date: dueDateISO, message: 'Manual due date unchanged' });
        }
        
        db.run("UPDATE Documents SET manual_due_date = ?, due_date_override = 1 WHERE id = ?", [dueDateISO, req.params.documentId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: "Update failed" });
            try { logActivity({ req, action: 'DUE_DATE_OVERRIDE_SET', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: `Manual due date set to ${dueDateISO}` }); } catch(e) {}
            notifyDocumentEvent({
              req,
              type: 'manual_due_date_changed',
              message: `Manual due date changed for ${doc.document_type_name}: ${formatManilaDueDate(dueDateISO)}`,
              doc,
              includeCreator: true,
              includeUploader: false,
              targetKind: 'due_date',
              targetMeta: { due_date: dueDateISO, previous_due_date: doc.manual_due_date || doc.due_date || null },
              alertKey: `manual_due_date_changed:document:${doc.id}`,
              dedupeMode: 'cooldown',
              cooldownMinutes: 10
            });
            runDueDateAlertSweep();
            updateProjectActivity(doc.project_id);
            logLockedStageEditUse({ req, doc, action: 'due_date_change', access: stageAccess, details: `set manual due date for ${doc.document_type_name}` });
            res.json({ success: true, due_date: dueDateISO });
        });
        });
    });
};

const __routeController192 = (req, res) => {
    const projectId = req.params.projectId;
    
    db.all(`
        SELECT 
            d.id, d.document_type_id, d.document_type_name, d.file_path, d.file_name, 
            d.upload_date, d.status, d.requirement_state, d.stage, d.manual_due_date, d.due_date_override,
            COALESCE(rds.due_days, dt.due_days, 0) as due_days,
            COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
            COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
            COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
            p.created_at as project_created_at,
            COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome
        FROM Documents d
        LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
        JOIN Projects p ON p.id = d.project_id
        LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
        LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
        WHERE d.project_id = ?
        ORDER BY d.stage, COALESCE(d.document_order_index, d.id), d.id
    `, [projectId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Process rows to calculate effective due dates using centralized helper
        const results = [];
        
        const processRow = (index) => {
            if (index >= rows.length) {
                res.json(results);
                return;
            }
            
            const row = rows[index];
            if (INACTIVE_PROJECT_OUTCOMES.includes(row.project_outcome)) {
                results.push({ ...row, calculated_due_date: null, due_date_source: 'inactive_project' });
                return processRow(index + 1);
            }
            
            // Use centralized helper to compute effective due date
            getEffectiveDueDate(row, (effErr, effResult) => {
                if (effErr) {
                    results.push({ ...row, calculated_due_date: null, due_date_source: 'none' });
                } else {
                    results.push({ ...row, calculated_due_date: effResult.effective_due_date, due_date_source: effResult.due_date_source });
                }
                processRow(index + 1);
            });
        };
        
        processRow(0);
    });
};
