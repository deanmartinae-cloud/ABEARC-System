// Controllers extracted from src/backend/routes/08-backup-config.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController129 = (req, res) => {
  try {
    const rows = fs.readdirSync(BACKUPS_DIR)
      .filter(name => name.endsWith('.zip'))
      .map(name => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, name));
        return { filename: name, size: stat.size, created_at: stat.birthtime.toISOString() };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
};

const __routeController130 = async (req, res) => {
  try {
    const dest = await createBackupFile();
    const filename = path.basename(dest);
    logActivity({ req, action: 'CREATE_BACKUP', details: filename });
    if (req.query.meta === '1' || req.query.json === '1') {
      const stat = fs.statSync(dest);
      return res.json({ success: true, filename, size: stat.size, created_at: stat.birthtime.toISOString() });
    }
    res.download(dest, filename);
  } catch (e) {
    logError('CREATE_BACKUP_FAILED', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Failed to create backup' });
  }
};

const __routeController131 = (req, res) => {
  const filename = path.basename(req.params.filename || '');
  const full = path.join(BACKUPS_DIR, filename);
  if (!filename.endsWith('.zip') || !fs.existsSync(full)) return res.status(404).json({ error: 'Backup not found' });
  res.download(full, filename);
};

const __routeController132 = (req, res) => {
  const filename = path.basename(req.params.filename || '');
  const full = path.join(BACKUPS_DIR, filename);
  if (!filename.endsWith('.zip') || !fs.existsSync(full)) return res.status(404).json({ error: 'Backup not found' });
  try {
    fs.unlinkSync(full);
    logActivity({ req, action: 'DELETE_BACKUP', details: filename });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete backup' });
  }
};

const __routeController133 = async (req, res) => {
  if (!requireRestorePassword(req, res)) {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (_) {}
    return;
  }
  return restoreBackupFromUploadedFile(req, res);
};

const __routeController134 = async (req, res) => {
  if (!requireRestorePassword(req, res)) {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (_) {}
    return;
  }
  return restoreBackupFromUploadedFile(req, res, { activityAction: 'RESTORE_BACKUP_LOGIN' });
};

const __routeController135 = async (req, res) => {
  try {
    const config = await collectConfigExport();
    logActivity({ req, action: 'EXPORT_CONFIG', details: 'Configuration exported' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="division-project-tracker-config-${new Date().toISOString().slice(0,10)}.json"`);
    res.send(JSON.stringify(config, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'Failed to export config' });
  }
};

const __routeController136 = (req, res) => {
  const config = req.body || {};
  const requirementSetDueSchedules = config.RequirementSetDueSchedules || [];
  const hasRequirementSetDueSchedules = Array.isArray(requirementSetDueSchedules) && requirementSetDueSchedules.length > 0;
  const countConfiguredDueSchedules = (rows) => (rows || []).filter(d =>
    Number(d.due_days || 0) ||
    Number(d.due_hours || 0) ||
    Number(d.start_from_document_upload || 0)
  ).length;
  res.json({
    project_types: (config.ProjectTypes || []).length,
    requestees: (config.Requestees || []).length,
    document_types: (config.DocumentTypes || []).length,
    requirement_sets: (config.RequirementSets || []).length,
    due_schedules: hasRequirementSetDueSchedules
      ? countConfiguredDueSchedules(requirementSetDueSchedules)
      : countConfiguredDueSchedules(config.DocumentTypes || [])
  });
};

const __routeController137 = (req, res) => {
  const config = req.body || {};
  const canImportPrivileges = req.user.role === 'superadmin';
  const requireImportPrivilege = (priv, hasRows) => {
    if (!hasRows || req.user.role === 'superadmin') return true;
    return new Promise(resolve => {
      db.get("SELECT enabled FROM UserPrivileges WHERE user_id = ? AND privilege = ?", [req.user.id, priv], (err, row) => resolve(!err && !!row?.enabled));
    });
  };
  Promise.all([
    requireImportPrivilege('manage_project_types', (config.ProjectTypes || []).length > 0),
    requireImportPrivilege('manage_requestees', (config.Requestees || []).length > 0),
    requireImportPrivilege('manage_document_types', (config.DocumentTypes || []).length > 0),
    requireImportPrivilege('manage_requirements', (config.RequirementSets || []).length > 0 || (config.RequirementSetItems || []).length > 0),
    requireImportPrivilege('manage_due_schedules', (config.RequirementSetDueSchedules || []).length > 0 || (config.DocumentTypes || []).some(d => Number(d.due_days || 0) || Number(d.due_hours || 0) || Number(d.start_from_document_upload || 0)))
  ]).then(allowed => {
    if (allowed.some(v => !v)) return forbidden(res, 'Config import includes sections you do not have permission to manage.');
    const reservedImportName = [
      ...(config.ProjectTypes || []).map(r => r.name),
      ...(config.Requestees || []).map(r => r.name),
      ...(config.DocumentTypes || []).map(r => r.name)
    ].find(isReservedSettingsName);
    if (reservedImportName) return res.status(400).json({ error: RESERVED_SETTINGS_NAME_ERROR });
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    try {
      const upsertSimple = (tbl, rows) => {
        const stmt = db.prepare(`INSERT INTO ${tbl} (id, name, order_index) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, order_index=excluded.order_index`);
        (rows || []).forEach(r => stmt.run([r.id, r.name, r.order_index || 0]));
        stmt.finalize();
      };
      upsertSimple('ProjectTypes', config.ProjectTypes);
      upsertSimple('Requestees', config.Requestees);
      const docStmt = db.prepare(`INSERT INTO DocumentTypes (id, name, category, order_index, due_days, due_hours, document_type_start_point, start_from_document_upload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, order_index=excluded.order_index, due_days=excluded.due_days, due_hours=excluded.due_hours, document_type_start_point=excluded.document_type_start_point, start_from_document_upload=excluded.start_from_document_upload`);
      (config.DocumentTypes || []).forEach(r => docStmt.run([r.id, r.name, normalizeDocumentTypeCategory(r.category), r.order_index || 0, r.due_days || 0, r.due_hours || 0, r.document_type_start_point || 0, r.start_from_document_upload || 0]));
      docStmt.finalize();
      const setStmt = db.prepare(`INSERT INTO RequirementSets (id, project_type_id, requestee_id, stage) VALUES (?, ?, ?, ?)
        ON CONFLICT(project_type_id, requestee_id, stage) DO UPDATE SET project_type_id=excluded.project_type_id`);
      (config.RequirementSets || []).forEach(r => setStmt.run([r.id, r.project_type_id, r.requestee_id, r.stage || 'Proposal']));
      setStmt.finalize();
      (config.RequirementSets || []).forEach(r => db.run('DELETE FROM RequirementSetItems WHERE requirement_set_id = ?', [r.id]));
      const itemStmt = db.prepare(`INSERT OR REPLACE INTO RequirementSetItems (id, requirement_set_id, document_type_id, order_index) VALUES (?, ?, ?, ?)`);
      (config.RequirementSetItems || []).forEach(r => itemStmt.run([r.id, r.requirement_set_id, r.document_type_id, r.order_index || 0]));
      itemStmt.finalize();
      if ((config.RequirementSetDueSchedules || []).length > 0) {
        const dueByKeyStmt = db.prepare(`INSERT INTO RequirementSetDueSchedules
          (requirement_set_id, document_type_id, due_days, due_hours, document_type_start_point, start_from_document_upload)
          SELECT rs.id, ?, ?, ?, ?, ?
          FROM RequirementSets rs
          WHERE rs.project_type_id = ? AND rs.requestee_id = ? AND rs.stage = ?
          ON CONFLICT(requirement_set_id, document_type_id) DO UPDATE SET
            due_days=excluded.due_days,
            due_hours=excluded.due_hours,
            document_type_start_point=excluded.document_type_start_point,
            start_from_document_upload=excluded.start_from_document_upload`);
        const dueByIdStmt = db.prepare(`INSERT INTO RequirementSetDueSchedules
          (requirement_set_id, document_type_id, due_days, due_hours, document_type_start_point, start_from_document_upload)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(requirement_set_id, document_type_id) DO UPDATE SET
            due_days=excluded.due_days,
            due_hours=excluded.due_hours,
            document_type_start_point=excluded.document_type_start_point,
            start_from_document_upload=excluded.start_from_document_upload`);
        (config.RequirementSetDueSchedules || []).forEach(r => {
          const values = [
            r.document_type_id,
            Math.max(0, parseInt(r.due_days || 0, 10) || 0),
            Math.max(0, parseInt(r.due_hours || 0, 10) || 0),
            r.document_type_start_point || 0,
            r.start_from_document_upload ? 1 : 0
          ];
          if (r.project_type_id && r.requestee_id && r.stage) {
            dueByKeyStmt.run([...values, r.project_type_id, r.requestee_id, r.stage]);
          } else {
            dueByIdStmt.run([r.requirement_set_id, ...values]);
          }
        });
        dueByKeyStmt.finalize();
        dueByIdStmt.finalize();
      }
      if (canImportPrivileges) {
        const privStmt = db.prepare(`INSERT INTO UserPrivileges (user_id, privilege, enabled) VALUES (?, ?, ?)
          ON CONFLICT(user_id, privilege) DO UPDATE SET enabled=excluded.enabled`);
        (config.UserPrivileges || []).forEach(r => privStmt.run([r.user_id, r.privilege, r.enabled ? 1 : 0]));
        privStmt.finalize();
      }
      db.run('COMMIT', () => {
        logActivity({ req, action: 'IMPORT_CONFIG', details: 'Configuration imported with merge/update behavior' });
        notifyConfigurationChanged({ req, type: 'configuration_imported', message: `${req.user.username} imported configuration settings.`, section: 'configuration-import' });
        res.json({ success: true });
      });
    } catch (e) {
      db.run('ROLLBACK', () => res.status(400).json({ error: e.message || 'Config import failed' }));
    }
  });
  });
};
