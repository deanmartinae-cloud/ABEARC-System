// Controllers extracted from src/backend/routes/11-project-documentation.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController171 = async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await dbGet(`SELECT id FROM Projects WHERE id = ?`, [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const rows = await dbAll(`
      SELECT stage, COUNT(*) as count
      FROM ProjectDocumentationFiles
      WHERE project_id = ? AND deleted_at IS NULL
      GROUP BY stage
    `, [projectId]);
    const counts = Object.fromEntries(PROJECT_DOCUMENTATION_STAGES.map(stage => [stage, 0]));
    rows.forEach(row => {
      if (counts[row.stage] !== undefined) counts[row.stage] = Number(row.count || 0);
    });
    res.json(counts);
  } catch (err) {
    logError('PROJECT_DOCUMENTATION_COUNTS', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load documentation counts.' });
  }
};

const __routeController172 = async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const stage = normalizeProjectDocumentationStage(req.query.stage);
    if (!stage) return res.status(400).json({ error: 'Valid stage is required.' });
    const project = await dbGet(`SELECT id FROM Projects WHERE id = ?`, [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const mediaType = normalizeProjectDocumentationMediaType(req.query.media_type);
    const category = String(req.query.category || '').trim();
    const where = [`pdf.project_id = ?`, `pdf.stage = ?`, `pdf.deleted_at IS NULL`];
    const params = [projectId, stage];
    if (mediaType) {
      where.push(`pdf.media_type = ?`);
      params.push(mediaType);
    }
    if (category) {
      where.push(`pdf.category = ?`);
      params.push(category);
    }
    const files = await dbAll(`
      SELECT pdf.*, p.name as project_name, p.assigned_user_id as project_assigned_user_id
      FROM ProjectDocumentationFiles pdf
      JOIN Projects p ON p.id = pdf.project_id
      WHERE ${where.join(' AND ')}
      ORDER BY datetime(pdf.uploaded_at) DESC, pdf.id DESC
    `, params);
    res.json({ count: files.length, files: files.map(row => projectDocumentationResponse(row, req)), categories: PROJECT_DOCUMENTATION_CATEGORIES });
  } catch (err) {
    logError('PROJECT_DOCUMENTATION_LIST', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load project documentation.' });
  }
};

const __routeController173 = (req, res) => {
  projectDocumentationUpload.fields([{ name: 'files', maxCount: 20 }, { name: 'files[]', maxCount: 20 }])(req, res, async (uploadErr) => {
    const uploadedTempFiles = [...(req.files?.files || []), ...(req.files?.['files[]'] || [])];
    const cleanupTemps = () => uploadedTempFiles.forEach(file => { try { if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {} });
    if (uploadErr) {
      cleanupTemps();
      return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    }
    try {
      const projectId = Number(req.params.projectId);
      const stage = normalizeProjectDocumentationStage(req.body?.stage);
      if (!stage) {
        cleanupTemps();
        return res.status(400).json({ error: 'Valid stage is required.' });
      }
      if (!uploadedTempFiles.length) {
        return res.status(400).json({ error: 'Select at least one documentation file.' });
      }
      if (uploadedTempFiles.length > 20) {
        cleanupTemps();
        return res.status(400).json({ error: 'Maximum 20 files per upload batch.' });
      }
      const project = await dbGet(`SELECT id, name, requester, assigned_user_id FROM Projects WHERE id = ?`, [projectId]);
      if (!project) {
        cleanupTemps();
        return res.status(404).json({ error: 'Project not found' });
      }
      const categoryInput = String(req.body?.category || 'Others').trim();
      const category = PROJECT_DOCUMENTATION_CATEGORIES.includes(categoryInput) ? categoryInput : 'Others';
      const caption = String(req.body?.caption || '').trim().slice(0, 2000);
      const destinationDir = path.join(PROJECT_DOCUMENTATION_DIR, `project-${projectId}`, stage);
      fs.mkdirSync(destinationDir, { recursive: true });
      const uploaded = [];
      for (const file of uploadedTempFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const mediaType = projectDocumentationMediaTypeForExt(ext);
        if (!mediaType) throw new Error(`Unsupported file type: ${file.originalname}`);
        if (mediaType === 'photo' && file.size > 25 * 1024 * 1024) throw new Error(`Photo exceeds 25 MB: ${file.originalname}`);
        if (mediaType === 'video' && file.size > 500 * 1024 * 1024) throw new Error(`Video exceeds 500 MB: ${file.originalname}`);
        const safeOriginal = sanitizeProjectDocumentationFilename(file.originalname);
        const storedName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${safeOriginal}`;
        const destination = path.join(destinationDir, storedName);
        fs.renameSync(file.path, destination);
        const relativePath = path.relative(PROJECT_DOCUMENTATION_DIR, destination).replace(/\\/g, '/');
        const result = await dbRun(`
          INSERT INTO ProjectDocumentationFiles (
            project_id, uploaded_by_user_id, uploaded_by_username, original_name, stored_name, file_path,
            file_ext, file_type, file_size, media_type, stage, category, caption, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [projectId, req.user.id, req.user.username, file.originalname, storedName, relativePath, ext, file.mimetype || '', file.size, mediaType, stage, category, caption, new Date().toISOString()]);
        uploaded.push({ id: result.lastID, original_name: file.originalname, stored_name: storedName, file_path: relativePath, file_ext: ext, file_size: file.size, media_type: mediaType, stage, category, caption });
      }
      logActivity({ req, action: 'PROJECT_DOCUMENTATION_UPLOADED', projectId, project: project.name, requester: project.requester, docType: stage, details: `Uploaded ${uploaded.length} documentation file(s): ${uploaded.map(f => f.original_name).slice(0, 8).join(', ')}` });
      if (project.assigned_user_id && Number(project.assigned_user_id) !== Number(req.user.id)) {
        insertNotifications({
          recipients: [project.assigned_user_id],
          actorId: req.user.id,
          type: 'project_documentation_uploaded',
          message: `${req.user.username} uploaded ${uploaded.length} documentation file(s) to ${project.name} - ${stage}.`,
          projectId,
          projectName: project.name,
          stage,
          targetKind: 'project_documentation',
          targetMeta: { project_id: projectId, stage, open_documentation: true },
          includeActor: false,
          alertKey: `project_documentation_upload:${projectId}:${stage}:${Date.now()}`
        });
      }
      res.status(201).json({ success: true, uploaded });
    } catch (err) {
      cleanupTemps();
      logError('PROJECT_DOCUMENTATION_UPLOAD', err.message, err.stack);
      res.status(400).json({ error: err.message || 'Failed to upload project documentation.' });
    }
  });
};

const __routeController174 = async (req, res) => {
  try {
    const row = await getProjectDocumentationRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'Documentation file not found' });
    const full = safeProjectDocumentationPath(row.file_path);
    if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', row.file_type || (row.media_type === 'video' ? 'video/mp4' : 'image/jpeg'));
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(row.original_name || row.stored_name).replace(/"/g, '')}"`);
    res.sendFile(full);
  } catch (err) {
    res.status(500).json({ error: 'Failed to open documentation file.' });
  }
};

const __routeController175 = async (req, res) => {
  try {
    const row = await getProjectDocumentationRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'Documentation file not found' });
    const full = safeProjectDocumentationPath(row.file_path);
    if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    logActivity({ req, action: 'PROJECT_DOCUMENTATION_DOWNLOAD', projectId: row.project_id, project: row.project_name, docType: row.stage, details: `Downloaded ${row.original_name}` });
    res.download(full, row.original_name || row.stored_name);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download documentation file.' });
  }
};

const __routeController176 = async (req, res) => {
  try {
    const row = await getProjectDocumentationRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'Documentation file not found' });
    if (!await canDeleteProjectDocumentation(req.user, row)) return forbidden(res, 'Permission denied: project documentation owner access required.');
    const categoryInput = String(req.body?.category || row.category || 'Others').trim();
    const category = PROJECT_DOCUMENTATION_CATEGORIES.includes(categoryInput) ? categoryInput : 'Others';
    const caption = String(req.body?.caption || '').trim().slice(0, 2000);
    await dbRun(`UPDATE ProjectDocumentationFiles SET category = ?, caption = ?, updated_at = ? WHERE id = ?`, [category, caption, new Date().toISOString(), row.id]);
    logActivity({ req, action: 'PROJECT_DOCUMENTATION_UPDATED', projectId: row.project_id, project: row.project_name, docType: row.stage, details: `Updated documentation ${row.original_name}; category ${category}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update documentation file.' });
  }
};

const __routeController177 = async (req, res) => {
  try {
    const row = await getProjectDocumentationRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'Documentation file not found' });
    if (!await canDeleteProjectDocumentation(req.user, row)) return forbidden(res, 'Permission denied: delete_project_documentation');
    await dbRun(`UPDATE ProjectDocumentationFiles SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [new Date().toISOString(), new Date().toISOString(), row.id]);
    const full = safeProjectDocumentationPath(row.file_path);
    if (full && fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch (e) { logError('PROJECT_DOCUMENTATION_UNLINK', e.message, e.stack); }
    }
    logActivity({ req, action: 'PROJECT_DOCUMENTATION_DELETED', projectId: row.project_id, project: row.project_name, docType: row.stage, details: `Deleted documentation ${row.original_name}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete documentation file.' });
  }
};
