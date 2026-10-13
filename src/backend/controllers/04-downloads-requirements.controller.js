// Controllers extracted from src/backend/routes/04-downloads-requirements.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController081 = async (req, res) => {
  try {
    const canManage = await canManageDownloadsForms(req.user);
    const params = [];
    const where = [];
    if (!canManage) {
      where.push("(status = 'Active' OR uploaded_by_user_id = ?)");
      params.push(req.user.id);
    } else if (req.query.status && ['Active', 'Archived'].includes(String(req.query.status))) {
      where.push('status = ?');
      params.push(String(req.query.status));
    }
    if (req.query.category) {
      where.push('LOWER(category) = LOWER(?)');
      params.push(String(req.query.category));
    }
    if (req.query.search) {
      where.push('(LOWER(title) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(original_filename) LIKE LOWER(?))');
      const term = `%${String(req.query.search).trim()}%`;
      params.push(term, term, term);
    }
    const sql = `
      SELECT *
      FROM DownloadsForms
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY status ASC, datetime(created_at) DESC, title COLLATE NOCASE ASC
    `;
    const items = (await dbAll(sql, params)).map(item => {
      const isOwner = Number(item.uploaded_by_user_id) === Number(req.user.id);
      return { ...item, can_edit: isOwner, can_delete: isOwner };
    });
    const categoryParams = [];
    const categoryWhere = ["category IS NOT NULL", "TRIM(category) != ''"];
    if (!canManage) {
      categoryWhere.push("(status = 'Active' OR uploaded_by_user_id = ?)");
      categoryParams.push(req.user.id);
    }
    const categories = await dbAll(`
      SELECT DISTINCT category
      FROM DownloadsForms
      WHERE ${categoryWhere.join(' AND ')}
      ORDER BY category COLLATE NOCASE ASC
    `, categoryParams);
    res.json({ items, tools: items, categories: categories.map(r => r.category), can_upload: req.user.role === 'superadmin' || await userHasPrivilegeAsync(req.user, 'upload_downloads_forms'), can_manage: canManage });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to list forms and tools' });
  }
};

const __routeController082 = (req, res) => {
  downloadsFormsFileUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'File upload is required.' });
    try {
      const title = String(req.body.title || req.body.name || '').trim();
      if (!title) throw new Error('Title is required.');
      const originalFilename = sanitizeDownloadsFormsFilename(req.file.originalname);
      const ext = path.extname(originalFilename).toLowerCase();
      const storedFilename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${originalFilename}`;
      const destination = path.join(DOWNLOADS_FORMS_DIR, storedFilename);
      fs.renameSync(req.file.path, destination);
      const apkVersion = ext === '.apk' ? extractApkVersion(destination) : {};
      const now = new Date().toISOString();
      const result = await dbRun(`
        INSERT INTO DownloadsForms (
          title, version, category, description, original_filename, stored_filename, file_path,
          file_type, file_size, uploaded_by_user_id, uploaded_by_username, status, download_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        title,
        String(apkVersion.versionName || req.body.version || '').trim(),
        String(req.body.category || '').trim(),
        String(req.body.description || '').trim(),
        originalFilename,
        storedFilename,
        storedFilename,
        ext.replace('.', ''),
        req.file.size || 0,
        req.user.id,
        req.user.username,
        normalizeDownloadsFormsStatus(req.body.status),
        now,
        now
      ]);
      logActivity({ req, action: 'DOWNLOADS_FORMS_UPLOAD', docType: 'downloads-forms', details: `Uploaded ${title} (${originalFilename})` });
      const item = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [result.lastID]);
      res.status(201).json(item);
    } catch (e) {
      try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
      res.status(400).json({ error: e.message || 'Failed to upload file' });
    }
  });
};

const __routeController083 = (req, res) => {
  downloadsFormsFileUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    try {
      const existing = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]);
      if (!existing) throw new Error('Forms & Tools file not found.');
      if (Number(existing.uploaded_by_user_id) !== Number(req.user.id)) {
        try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
        return forbidden(res, 'Only the uploader can edit this Forms & Tools item.');
      }
      const title = String(req.body.title ?? req.body.name ?? existing.title).trim();
      if (!title) throw new Error('Title is required.');
      const values = {
        title,
        version: String(req.body.version ?? existing.version ?? '').trim(),
        category: String(req.body.category ?? existing.category ?? '').trim(),
        description: String(req.body.description ?? existing.description ?? '').trim(),
        status: normalizeDownloadsFormsStatus(req.body.status ?? existing.status),
        original_filename: existing.original_filename,
        stored_filename: existing.stored_filename,
        file_path: existing.file_path,
        file_type: existing.file_type,
        file_size: existing.file_size
      };
      let replacedFile = false;
      if (req.file) {
        const originalFilename = sanitizeDownloadsFormsFilename(req.file.originalname);
        const ext = path.extname(originalFilename).toLowerCase();
        const storedFilename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${originalFilename}`;
        const destination = path.join(DOWNLOADS_FORMS_DIR, storedFilename);
        fs.renameSync(req.file.path, destination);
        const apkVersion = ext === '.apk' ? extractApkVersion(destination) : {};
        const oldPath = path.resolve(DOWNLOADS_FORMS_DIR, existing.file_path || existing.stored_filename || '');
        const toolsRoot = path.resolve(DOWNLOADS_FORMS_DIR);
        if (oldPath.startsWith(`${toolsRoot}${path.sep}`) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        if (apkVersion.versionName) values.version = apkVersion.versionName;
        values.original_filename = originalFilename;
        values.stored_filename = storedFilename;
        values.file_path = storedFilename;
        values.file_type = ext.replace('.', '');
        values.file_size = req.file.size || 0;
        replacedFile = true;
      }
      const now = new Date().toISOString();
      const uploadedAt = replacedFile ? now : existing.created_at;
      await dbRun(`
        UPDATE DownloadsForms
        SET title = ?, version = ?, category = ?, description = ?, original_filename = ?, stored_filename = ?,
            file_path = ?, file_type = ?, file_size = ?, status = ?, created_at = ?, updated_at = ?
        WHERE id = ?
      `, [values.title, values.version, values.category, values.description, values.original_filename, values.stored_filename, values.file_path, values.file_type, values.file_size, values.status, uploadedAt, now, req.params.id]);
      const action = values.status === 'Archived' && existing.status !== 'Archived'
        ? 'DOWNLOADS_FORMS_ARCHIVE'
        : (replacedFile ? 'DOWNLOADS_FORMS_REPLACE' : 'DOWNLOADS_FORMS_EDIT');
      const verb = action === 'DOWNLOADS_FORMS_ARCHIVE' ? 'Archived' : (action === 'DOWNLOADS_FORMS_REPLACE' ? 'Replaced file for' : 'Edited');
      logActivity({ req, action, docType: 'downloads-forms', details: `${verb} ${values.title}` });
      res.json(await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]));
    } catch (e) {
      try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
      res.status(e.message === 'Forms & Tools file not found.' ? 404 : 400).json({ error: e.message || 'Failed to update file' });
    }
  });
};

const __routeController084 = async (req, res) => {
  try {
    const existing = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Forms & Tools file not found.' });
    if (Number(existing.uploaded_by_user_id) !== Number(req.user.id)) {
      return forbidden(res, 'Only the uploader can delete this Forms & Tools item.');
    }
    await dbRun('DELETE FROM DownloadsForms WHERE id = ?', [req.params.id]);
    const full = path.resolve(DOWNLOADS_FORMS_DIR, existing.file_path || existing.stored_filename || '');
    const toolsRoot = path.resolve(DOWNLOADS_FORMS_DIR);
    if (full.startsWith(`${toolsRoot}${path.sep}`) && fs.existsSync(full)) fs.unlinkSync(full);
    logActivity({ req, action: 'DOWNLOADS_FORMS_DELETE', docType: 'downloads-forms', details: `Deleted ${existing.title} (${existing.original_filename})` });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to delete file' });
  }
};

const __routeController085 = async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Forms & Tools file not found.' });
    const canManage = await canManageDownloadsForms(req.user);
    if (item.status === 'Archived' && !canManage) return forbidden(res, 'Archived files are not available for download.');
    const full = path.resolve(DOWNLOADS_FORMS_DIR, item.file_path || item.stored_filename || '');
    const toolsRoot = path.resolve(DOWNLOADS_FORMS_DIR);
    if (!full.startsWith(`${toolsRoot}${path.sep}`) || !fs.existsSync(full)) return res.status(404).json({ error: 'File missing on disk.' });
    await dbRun('UPDATE DownloadsForms SET download_count = COALESCE(download_count, 0) + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);
    logActivity({ req, action: 'DOWNLOADS_FORMS_DOWNLOAD', docType: 'downloads-forms', details: `Downloaded ${item.title} (${item.original_filename})` });
    res.download(full, item.original_filename || item.stored_filename);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to download file' });
  }
};

const __routeController086 = async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Forms & Tools file not found.' });
    if (item.status !== 'Active') return res.status(400).json({ error: 'Archived files cannot be shared.' });

    const full = path.resolve(DOWNLOADS_FORMS_DIR, item.file_path || item.stored_filename || '');
    const toolsRoot = path.resolve(DOWNLOADS_FORMS_DIR);
    if (!full.startsWith(`${toolsRoot}${path.sep}`) || !fs.existsSync(full)) {
      return res.status(404).json({ error: 'File missing on disk.' });
    }

    const expires = Date.now() + (24 * 60 * 60 * 1000);
    const signature = signDownloadsFormsShare(item.id, expires);
    const downloadUrl = `${getShareOrigin(req)}/api/downloads-forms/${item.id}/shared-download?expires=${expires}&signature=${signature}`;
    const qrCode = await QRCode.toDataURL(downloadUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#ffffff' }
    });

    logActivity({ req, action: 'DOWNLOADS_FORMS_SHARE', docType: 'downloads-forms', details: `Created a share link for ${item.title} (${item.original_filename})` });
    res.json({
      title: item.title,
      filename: item.original_filename || item.stored_filename,
      download_url: downloadUrl,
      qr_code: qrCode,
      expires_at: new Date(expires).toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to create share link' });
  }
};

const __routeController087 = async (req, res) => {
  try {
    if (!isValidDownloadsFormsShare(req.params.id, req.query.expires, req.query.signature)) {
      return res.status(403).send('This download link is invalid or has expired.');
    }
    const item = await dbGet('SELECT * FROM DownloadsForms WHERE id = ?', [req.params.id]);
    if (!item || item.status !== 'Active') return res.status(404).send('This file is no longer available.');

    const full = path.resolve(DOWNLOADS_FORMS_DIR, item.file_path || item.stored_filename || '');
    const toolsRoot = path.resolve(DOWNLOADS_FORMS_DIR);
    if (!full.startsWith(`${toolsRoot}${path.sep}`) || !fs.existsSync(full)) return res.status(404).send('File missing on disk.');

    if (claimDownloadsFormsSharedDownload(req, item.id, req.query.signature)) {
      await dbRun('UPDATE DownloadsForms SET download_count = COALESCE(download_count, 0) + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);
      logActivity({ req, action: 'DOWNLOADS_FORMS_SHARED_DOWNLOAD', docType: 'downloads-forms', details: `Downloaded shared file ${item.title} (${item.original_filename})` });
    }
    res.download(full, item.original_filename || item.stored_filename);
  } catch (e) {
    res.status(500).send(e.message || 'Failed to download file.');
  }
};

const __routeController088 = async (req, res) => {
  const name = (req.body.name || '').trim();
  const category = normalizeDocumentTypeCategory(req.body.category || req.body.stage);
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (isReservedSettingsName(name)) return res.status(400).json({ error: RESERVED_SETTINGS_NAME_ERROR });
  try {
    const existing = await dbGet('SELECT id, name, category, order_index FROM DocumentTypes WHERE LOWER(name) = LOWER(?)', [name]);
    if (existing) return res.json({ ...existing, existing: true });
    if (configurationApprovalRequired(req)) {
      return submitConfigurationChangeRequest(req, res, {
        config_section: 'document-types',
        config_table: 'document-types',
        config_key: name,
        target_display_name: name,
        action_type: 'requirements_document_type_create',
        old_value: null,
        new_value: { name, category },
        human_summary: `${req.user.username} requested to create document type ${name} from Requirements Config.`
      });
    }
    const result = await applySettingsCreate({ type: 'document-types', name, category });
    logActivity({ req, action: 'SETTINGS_ADD', project: '-', requester: '-', docType: 'document-types', details: `Added ${name} from Requirements Config` });
    res.status(201).json({ id: result.lastID, name, category, order_index: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const __routeController089 = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.items) ? req.body.items : []);
  const requirementSetId = parseInt(req.body?.requirement_set_id || req.query.requirementSetId || 0, 10);
  if (!requirementSetId) return res.status(400).json({ error: 'Requirement set is required.' });
  try {
    const oldValue = await getDueScheduleSnapshot(requirementSetId);
    if (configurationApprovalRequired(req)) {
      return submitConfigurationChangeRequest(req, res, {
        config_section: 'document-due-schedules',
        config_table: 'document-due-schedules',
        config_key: String(requirementSetId),
        target_id: requirementSetId,
        target_display_name: `Requirement Set #${requirementSetId}`,
        action_type: 'due_schedules_update',
        old_value: oldValue,
        new_value: { requirement_set_id: requirementSetId, items },
        human_summary: `${req.user.username} requested to update due schedules for requirement set #${requirementSetId}.`
      });
    }
    await applyDueSchedules({ requirement_set_id: requirementSetId, items });
    try { logActivity({ req, action: 'SETTINGS_EDIT', project: '-', requester: '-', docType: 'DocumentDueSchedules', details: `Updated ${items.length} due schedules` }); } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const __routeController090 = async (req, res) => {
  const { due_days, due_hours, document_type_start_point, start_from_document_upload, requirement_set_id } = req.body;
  const id = req.params.id;
  const requirementSetId = parseInt(requirement_set_id || 0, 10);
  if (!requirementSetId) return res.status(400).json({ error: 'Requirement set is required.' });
  
  // Validate: prevent circular dependency (document can't depend on itself)
  if (document_type_start_point && parseInt(document_type_start_point) === parseInt(id)) {
    return res.status(400).json({ error: 'A document type cannot depend on itself.' });
  }
  
  const days = Math.max(0, parseInt(due_days || 0, 10) || 0);
  const hours = Math.max(0, parseInt(due_hours || 0, 10) || 0);
  const startPoint = document_type_start_point ? parseInt(document_type_start_point) : 0;
  const startFromUpload = start_from_document_upload ? 1 : 0;
  try {
    const oldValue = await getDueScheduleSnapshot(requirementSetId);
    const items = [{ id: Number(id), due_days: days, due_hours: hours, document_type_start_point: startPoint, start_from_document_upload: startFromUpload }];
    if (configurationApprovalRequired(req)) {
      return submitConfigurationChangeRequest(req, res, {
        config_section: 'document-due-schedules',
        config_table: 'document-due-schedules',
        config_key: `${requirementSetId}:${id}`,
        target_id: Number(id),
        target_display_name: `Document Type #${id}`,
        action_type: 'due_schedules_update',
        old_value: oldValue,
        new_value: { requirement_set_id: requirementSetId, items },
        human_summary: `${req.user.username} requested to update a due schedule in requirement set #${requirementSetId}.`
      });
    }
    await applyDueSchedules({ requirement_set_id: requirementSetId, items });
    try { logActivity({ req, action: 'SETTINGS_EDIT', project: '-', requester: '-', docType: 'DocumentDueSchedule', details: `Updated due schedule for ID ${id}` }); } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const __routeController091 = (req, res) => {
  const excludeId = req.query.excludeId;
  const category = req.query.category || req.query.stage;
  const whereClauses = [];
  const params = [];
  
  if (excludeId) {
    whereClauses.push('id != ?');
    params.push(excludeId);
  }

  if (category && DOCUMENT_TYPE_CATEGORIES.has(category)) {
    whereClauses.push('category = ?');
    params.push(category);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT id, name, category FROM DocumentTypes ${where} ORDER BY order_index ASC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const __routeController092 = (req, res) => {
  const { projectTypeId, requesteeId, stage } = req.query;
  db.all(`
    SELECT rs.id as requirement_set_id, rsi.id as item_id, rsi.order_index, rsi.document_type_id, dt.name as doc_name
    FROM RequirementSets rs
    JOIN RequirementSetItems rsi ON rs.id = rsi.requirement_set_id
    JOIN DocumentTypes dt ON rsi.document_type_id = dt.id
    WHERE rs.project_type_id = ? AND rs.requestee_id = ? AND rs.stage = ?
    ORDER BY rsi.order_index ASC`, [projectTypeId, requesteeId, stage || 'Proposal'], (err, rows) => {
      if (err) return res.status(500).json({error: err.message});
      res.json(rows.map(r => ({requirement_set_id: r.requirement_set_id, id: r.document_type_id, name: r.doc_name, order_index: r.order_index})));
  });
};

const __routeController093 = async (req, res) => {
  try {
    const row = await dbGet(`SELECT value FROM SystemSettings WHERE key = ?`, ['reload_requirements_override_enabled']);
    res.json({ enabled: row?.value === '1' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
};

const __routeController094 = async (req, res) => {
  const enabled = req.body?.enabled ? '1' : '0';
  try {
    await dbRun(`
      INSERT INTO SystemSettings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `, ['reload_requirements_override_enabled', enabled, new Date().toISOString()]);
    try { logActivity({ req, action: 'SETTINGS_EDIT', project: '-', requester: '-', docType: 'Requirements', details: `${enabled === '1' ? 'Enabled' : 'Disabled'} Reload Requirements override` }); } catch (e) {}
    res.json({ enabled: enabled === '1' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
};

const __routeController095 = async (req, res) => {
  try {
    const sets = await dbAll(`
      SELECT rs.id as requirement_set_id, rs.project_type_id, pt.name as project_type_name,
             rs.requestee_id, r.name as requestee_name, rs.stage
      FROM RequirementSets rs
      LEFT JOIN ProjectTypes pt ON pt.id = rs.project_type_id
      LEFT JOIN Requestees r ON r.id = rs.requestee_id
      ORDER BY pt.name COLLATE NOCASE, r.name COLLATE NOCASE, rs.stage
    `);

    const audits = [];
    for (const set of sets) {
      const documents = await dbAll(`
        SELECT rsi.document_type_id, dt.name as document_name, rsi.order_index
        FROM RequirementSetItems rsi
        LEFT JOIN DocumentTypes dt ON dt.id = rsi.document_type_id
        WHERE rsi.requirement_set_id = ?
        ORDER BY rsi.order_index ASC, rsi.id ASC
      `, [set.requirement_set_id]);

      const projects = await dbAll(`
        SELECT p.id as project_id, p.name as project_name, p.stage,
               COUNT(d.id) as actual_document_count
        FROM Projects p
        LEFT JOIN Documents d ON d.project_id = p.id AND d.stage = p.stage
        WHERE p.project_type_id = ?
          AND p.requestee_id = ?
          AND p.stage = ?
          AND p.stage IN ('Proposal', 'Implementation')
        GROUP BY p.id
        ORDER BY p.created_at DESC, p.id DESC
      `, [set.project_type_id, set.requestee_id, set.stage]);

      const configuredCount = documents.length;
      const projectComparisons = projects.map(project => ({
        project_id: project.project_id,
        project_name: project.project_name,
        stage: project.stage,
        configured_document_count: configuredCount,
        actual_document_count: Number(project.actual_document_count || 0),
        mismatch: Number(project.actual_document_count || 0) < configuredCount
      }));

      audits.push({
        ...set,
        configured_document_count: configuredCount,
        documents,
        existing_project_count: projectComparisons.length,
        projects: projectComparisons,
        mismatch_count: projectComparisons.filter(p => p.mismatch).length
      });
    }

    res.json(audits);
  } catch (e) {
    logError('REQUIREMENTS_AUDIT_FAILED', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Requirement audit failed' });
  }
};

const __routeController096 = (req, res) => {
  const { projectTypeId, requesteeId, stage } = req.query;
  if (!projectTypeId || !requesteeId) return res.status(400).json({ error: 'IDs required' });
  db.get("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [projectTypeId, requesteeId, stage || 'Proposal'], (setErr, set) => {
    if (setErr) return res.status(500).json({ error: setErr.message });
    if (!set) return res.json({ requirement_set_id: null, items: [] });
    db.all(`
      SELECT
        rs.id as requirement_set_id,
        rsi.document_type_id as id,
        dt.name,
        dt.category,
        rsi.order_index,
        COALESCE(rds.due_days, dt.due_days, 0) as due_days,
        COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
        COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
        COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
        trigger_dt.name as start_doc_name
      FROM RequirementSets rs
      JOIN RequirementSetItems rsi ON rsi.requirement_set_id = rs.id
      JOIN DocumentTypes dt ON dt.id = rsi.document_type_id
      LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = rsi.document_type_id
      LEFT JOIN DocumentTypes trigger_dt ON trigger_dt.id = COALESCE(rds.document_type_start_point, dt.document_type_start_point)
      WHERE rs.id = ?
      ORDER BY rsi.order_index ASC`, [set.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ requirement_set_id: set.id, items: rows || [] });
      });
  });
};

const __routeController097 = async (req, res) => {
  const { projectTypeId, requesteeId, items, stage } = req.body;
  if (!projectTypeId || !requesteeId) return res.status(400).json({error: "IDs required"});
  const currentStage = stage || 'Proposal';
  const submittedItems = Array.isArray(items) ? items : [];
  const submittedCount = submittedItems.length;

  if (configurationApprovalRequired(req)) {
    try {
      const names = await dbGet(`
        SELECT pt.name as project_type_name, r.name as requestee_name
        FROM ProjectTypes pt
        JOIN Requestees r ON r.id = ?
        WHERE pt.id = ?
      `, [requesteeId, projectTypeId]);
      if (!names) return res.status(400).json({error: "Invalid project type or requestee"});
      if (isReservedSettingsName(names.project_type_name) || isReservedSettingsName(names.requestee_name)) {
        return res.status(400).json({error: RESERVED_SETTINGS_NAME_ERROR});
      }
      const oldValue = await getRequirementSnapshot({ projectTypeId, requesteeId, stage: currentStage });
      return submitConfigurationChangeRequest(req, res, {
        config_section: 'requirements',
        config_table: 'requirements',
        config_key: `${projectTypeId}:${requesteeId}:${currentStage}`,
        target_display_name: `${names.project_type_name} / ${names.requestee_name} / ${currentStage}`,
        action_type: 'requirements_update',
        old_value: oldValue,
        new_value: { projectTypeId: Number(projectTypeId), requesteeId: Number(requesteeId), stage: currentStage, items: submittedItems },
        human_summary: `${req.user.username} requested to update requirements for ${names.project_type_name} / ${names.requestee_name} / ${currentStage}.`
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to submit configuration change request.' });
    }
  }
  
  db.get(`
    SELECT pt.name as project_type_name, r.name as requestee_name
    FROM ProjectTypes pt
    JOIN Requestees r ON r.id = ?
    WHERE pt.id = ?
  `, [requesteeId, projectTypeId], (nameErr, names) => {
    if (nameErr) return res.status(500).json({error: "DB Error"});
    if (!names) return res.status(400).json({error: "Invalid project type or requestee"});
    if (isReservedSettingsName(names.project_type_name) || isReservedSettingsName(names.requestee_name)) {
      return res.status(400).json({error: RESERVED_SETTINGS_NAME_ERROR});
    }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.get("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [projectTypeId, requesteeId, currentStage], (err, set) => {
      let setId;
      let createdSet = !set;
      if (err) return db.run("ROLLBACK", () => res.status(500).json({error: "DB Error"}));
      if (set) { 
        setId = set.id; 
        createdSet = false;
        db.run("DELETE FROM RequirementSetItems WHERE requirement_set_id = ?", [setId], (deleteErr) => {
          if (deleteErr) return db.run("ROLLBACK", () => res.status(500).json({ error: deleteErr.message || "Failed to clear old requirements" }));
          insertItems(setId);
        }); 
      } else {
        db.run("INSERT INTO RequirementSets (project_type_id, requestee_id, stage) VALUES (?, ?, ?)", [projectTypeId, requesteeId, currentStage], function(err2) {
          if (err2) {
             if (err2.message.includes('UNIQUE')) {
                db.get("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [projectTypeId, requesteeId, currentStage], (e, s) => {
                   if(s) { setId = s.id; createdSet = false; db.run("DELETE FROM RequirementSetItems WHERE requirement_set_id = ?", [setId], (deleteErr) => {
                     if (deleteErr) return db.run("ROLLBACK", () => res.status(500).json({ error: deleteErr.message || "Failed to clear old requirements" }));
                     insertItems(setId);
                   }); }
                   else db.run("ROLLBACK", () => res.status(500).json({error: "DB Error"}));
                });
             } else {
               return db.run("ROLLBACK", () => res.status(500).json({error: "DB Error"}));
             }
          } else {
            setId = this.lastID;
            createdSet = true;
            insertItems(setId);
          }
        });
      }

      function insertItems(id) {
        const finishAndVerify = () => {
          db.get("SELECT COUNT(*) as saved_count FROM RequirementSetItems WHERE requirement_set_id = ?", [id], (countErr, row) => {
            if (countErr) return db.run("ROLLBACK", () => res.status(500).json({ error: countErr.message || "Requirement save verification failed" }));
            const savedCount = Number(row?.saved_count || 0);
            if (savedCount !== submittedCount) {
              return db.run("ROLLBACK", () => res.status(500).json({
                error: `Requirement save mismatch. Submitted ${submittedCount} but saved ${savedCount}.`,
                requirement_set_id: id,
                saved_count: savedCount,
                submitted_count: submittedCount,
                stage: currentStage,
                project_type_id: projectTypeId,
                requestee_id: requesteeId
              }));
            }
            db.run("COMMIT", () => {
              try { logActivity({ req, action: 'SETTINGS_EDIT', project: '-', requester: '-', docType: 'Requirements', details: `Updated set for ${currentStage}` }); } catch(e) {}
              notifyRequirementSetModified({ req, projectTypeId, requesteeId, stage: currentStage, created: createdSet });
              res.json({
                success: true,
                requirement_set_id: id,
                saved_count: savedCount,
                submitted_count: submittedCount,
                stage: currentStage,
                project_type_id: projectTypeId,
                requestee_id: requesteeId
              });
            });
          });
        };
        if (!submittedItems.length) return finishAndVerify();
        const stmt = db.prepare("INSERT INTO RequirementSetItems (requirement_set_id, document_type_id, order_index) VALUES (?, ?, ?)");
        let done = 0;
        submittedItems.forEach((item) => {
          stmt.run([id, item.document_type_id, item.order_index], (e) => {
            if (e) return db.run("ROLLBACK", () => res.status(500).json({error: e.message}));
            if (++done === submittedItems.length) { stmt.finalize(); finishAndVerify(); }
          });
        });
      }
    });
  });
  });
};

const __routeController098 = async (req, res) => {
  const projectId = Number(req.params.id);
  const project = await dbGet("SELECT * FROM Projects WHERE id = ?", [projectId]).catch(() => null);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const overrideRow = await dbGet(`SELECT value FROM SystemSettings WHERE key = ?`, ['reload_requirements_override_enabled']).catch(() => null);
  const overrideEnabled = overrideRow?.value === '1' && ['admin', 'superadmin', 'system'].includes(req.user.role);
  const requestedStage = String(req.body?.stage || project.stage);
  const targetStage = overrideEnabled && ['Proposal', 'Implementation'].includes(requestedStage) ? requestedStage : project.stage;

  if (!['Proposal', 'Implementation'].includes(targetStage)) {
    return res.status(400).json({ error: "Requirements can only be reloaded in Proposal or Implementation." });
  }
  if (!overrideEnabled && targetStage !== project.stage) {
    return res.status(400).json({ error: "Requirements can only be reloaded for the active stage." });
  }

  const uploaded = await dbGet(`SELECT COUNT(*) as uploaded FROM Documents WHERE project_id = ? AND stage = ? AND file_path IS NOT NULL`, [projectId, targetStage]).catch(() => null);
  if (!overrideEnabled && (uploaded?.uploaded || 0) > 0) {
    return res.status(400).json({ error: "Cannot reload requirements after documents have been uploaded for this stage." });
  }

  const set = await dbGet("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [project.project_type_id, project.requestee_id, targetStage]).catch(() => null);
  if (!set) return res.status(400).json({ error: `No requirements configured for ${targetStage}.` });

  try {
    await dbRun("BEGIN TRANSACTION");
    if (overrideEnabled) {
      await dbRun(`
        DELETE FROM Documents
        WHERE project_id = ? AND stage = ? AND file_path IS NULL
          AND document_type_id NOT IN (SELECT document_type_id FROM RequirementSetItems WHERE requirement_set_id = ?)
      `, [projectId, targetStage, set.id]);
      await dbRun(`
        UPDATE Documents
           SET document_type_name = (SELECT name FROM DocumentTypes WHERE id = Documents.document_type_id),
               document_order_index = (
                 SELECT order_index FROM RequirementSetItems
                  WHERE requirement_set_id = ? AND document_type_id = Documents.document_type_id
               )
         WHERE project_id = ? AND stage = ?
           AND document_type_id IN (SELECT document_type_id FROM RequirementSetItems WHERE requirement_set_id = ?)
      `, [set.id, projectId, targetStage, set.id]);
      await dbRun(`
        INSERT INTO Documents (project_id, document_type_id, document_type_name, stage, status, document_order_index)
        SELECT ?, rsi.document_type_id, dt.name, ?, 'None', rsi.order_index
          FROM RequirementSetItems rsi
          JOIN DocumentTypes dt ON dt.id = rsi.document_type_id
         WHERE rsi.requirement_set_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM Documents d
              WHERE d.project_id = ? AND d.stage = ? AND d.document_type_id = rsi.document_type_id
           )
      `, [projectId, targetStage, set.id, projectId, targetStage]);
    } else {
      const existingRemarks = await dbAll("SELECT document_type_id, remarks FROM Documents WHERE project_id = ? AND stage = ? AND remarks IS NOT NULL AND TRIM(remarks) != ''", [projectId, targetStage]);
      const remarksByType = new Map((existingRemarks || []).map(row => [Number(row.document_type_id), row.remarks]));
      await dbRun("DELETE FROM Documents WHERE project_id = ? AND stage = ?", [projectId, targetStage]);
      const items = await dbAll("SELECT document_type_id, order_index FROM RequirementSetItems WHERE requirement_set_id = ? ORDER BY order_index", [set.id]);
      if (!items.length) throw new Error("No requirements configured for this stage.");
      for (const it of items) {
        await dbRun("INSERT INTO Documents (project_id, document_type_id, document_type_name, stage, status, document_order_index, remarks) VALUES (?, ?, (SELECT name FROM DocumentTypes WHERE id = ?), ?, 'None', ?, ?)", [projectId, it.document_type_id, it.document_type_id, targetStage, Number(it.order_index || 0), remarksByType.get(Number(it.document_type_id)) || null]);
      }
    }
    await dbRun("UPDATE Projects SET requirement_set_id = ?, updated_at = ?, last_activity_at = ? WHERE id = ?", [set.id, new Date().toISOString(), new Date().toISOString(), projectId]);
    await dbRun("COMMIT");
  } catch (err) {
    await dbRun("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: err.message || "Failed to reload requirements" });
  }

  try { logActivity({ req, action: 'RELOAD_REQUIREMENTS', projectId, project: project.name, requester: project.requester, docType: 'Requirements', details: `Reloaded ${targetStage} requirements${overrideEnabled ? ' with admin override' : ''}` }); } catch(e) {}
  notifyProjectEvent({
    req,
    type: 'requirement_set_applied',
    message: `Requirements were reloaded for ${project.name} - ${targetStage}.`,
    project,
    targetKind: 'project',
    targetMeta: { highlight: 'requirements', stage: targetStage },
    includeDocumentAssignees: true,
    alertKey: `requirements_reloaded:${projectId}:${targetStage}`,
    dedupeMode: 'cooldown',
    cooldownMinutes: 15
  });
  res.json({ success: true });
};

const __routeController099 = (req, res) => {
  res.status(410).json({ error: "Requirement sync is disabled. Use Reload Requirements before any documents are uploaded." });
};
