app.get('/api/backups', requireManageBackups, __routeController129);

app.post('/api/backups', requireManageBackups, __routeController130);

app.get('/api/backups/:filename/download', requireManageBackups, __routeController131);

app.delete('/api/backups/:filename', requireManageBackups, __routeController132);

const restoreBackupFromUploadedFile = async (req, res, { activityAction = 'RESTORE_BACKUP' } = {}) => {
  if (!req.file) return res.status(400).json({ error: 'Backup ZIP is required' });
  const restoreRoot = path.join(TEMP_DIR, `restore_${Date.now()}`);
  try {
    if (!String(req.file.originalname || '').toLowerCase().endsWith('.zip')) throw new Error('Backup file must be a ZIP archive.');
    const stat = fs.statSync(req.file.path);
    if (stat.size < 22) throw new Error('Backup ZIP appears to be empty or incomplete.');
    const available = getAvailableStorageBytes(TEMP_DIR);
    if (stat.size > available) throw new Error(`Not enough server storage to restore this backup. Backup is ${formatBytes(stat.size)}, available ${formatBytes(available)}.`);
    const zip = new AdmZip(req.file.path);
    for (const entry of zip.getEntries()) {
      const normalized = entry.entryName.replace(/\\/g, '/');
      if (path.isAbsolute(normalized) || normalized.includes('..')) throw new Error('Unsafe backup ZIP path.');
    }
    if (!zip.getEntry('data.db')) throw new Error('Backup ZIP must contain data.db');
    zip.extractAllTo(restoreRoot, true);
    const restoredDb = path.join(restoreRoot, 'data.db');
    const restoredUploads = path.join(restoreRoot, 'uploads');
    const restoredCalendarAttachments = path.join(restoreRoot, 'calendar-attachments');
    const restoredAvatars = path.join(restoreRoot, 'avatars');
    const restoredDownloadsForms = path.join(restoreRoot, 'downloads-forms');
    const restoredProjectClosureAttachments = path.join(restoreRoot, 'project-closure-attachments');
    const restoredProjectDocumentation = path.join(restoreRoot, 'project-documentation');
    const restoredMonitoringAttachments = path.join(restoreRoot, 'monitoring-attachments');
    const restoredMapMediaOriginals = path.join(restoreRoot, 'map-media', 'originals');
    const restoredMapMediaThumbnails = path.join(restoreRoot, 'map-media', 'thumbnails');
    const restoredMapOrthomosaics = path.join(restoreRoot, 'map-orthomosaics');
    const restoredUserDrive = path.join(restoreRoot, 'user-drive');
    if (!fs.existsSync(restoredDb)) throw new Error('Backup database file is missing');
    const preBackup = await createBackupFile(`pre-restore-${safeBackupFilename()}`);
    logActivity({ req, action: activityAction, details: `Restored ${req.file.originalname}; pre-restore backup ${path.basename(preBackup)}` });
    db.close((closeErr) => {
      if (closeErr) return res.status(500).json({ error: 'Failed to prepare database restore' });
      try {
        for (const suffix of ['', '-wal', '-shm']) {
          const current = `${DB_PATH}${suffix}`;
          if (fs.existsSync(current)) fs.rmSync(current, { force: true });
        }
        fs.copyFileSync(restoredDb, DB_PATH);
        removeDirContents(UPLOADS_DIR);
        if (fs.existsSync(restoredUploads)) fs.cpSync(restoredUploads, UPLOADS_DIR, { recursive: true });
        removeDirContents(CALENDAR_ATTACHMENTS_DIR);
        if (fs.existsSync(restoredCalendarAttachments)) fs.cpSync(restoredCalendarAttachments, CALENDAR_ATTACHMENTS_DIR, { recursive: true });
        removeDirContents(AVATARS_DIR);
        if (fs.existsSync(restoredAvatars)) fs.cpSync(restoredAvatars, AVATARS_DIR, { recursive: true });
        removeDirContents(DOWNLOADS_FORMS_DIR);
        if (fs.existsSync(restoredDownloadsForms)) fs.cpSync(restoredDownloadsForms, DOWNLOADS_FORMS_DIR, { recursive: true });
        removeDirContents(PROJECT_CLOSURE_ATTACHMENTS_DIR);
        if (fs.existsSync(restoredProjectClosureAttachments)) fs.cpSync(restoredProjectClosureAttachments, PROJECT_CLOSURE_ATTACHMENTS_DIR, { recursive: true });
        removeDirContents(PROJECT_DOCUMENTATION_DIR);
        if (fs.existsSync(restoredProjectDocumentation)) fs.cpSync(restoredProjectDocumentation, PROJECT_DOCUMENTATION_DIR, { recursive: true });
        removeDirContents(MONITORING_ATTACHMENTS_DIR);
        if (fs.existsSync(restoredMonitoringAttachments)) fs.cpSync(restoredMonitoringAttachments, MONITORING_ATTACHMENTS_DIR, { recursive: true });
        removeDirContents(MAP_MEDIA_ORIGINALS_DIR);
        if (fs.existsSync(restoredMapMediaOriginals)) fs.cpSync(restoredMapMediaOriginals, MAP_MEDIA_ORIGINALS_DIR, { recursive: true });
        removeDirContents(MAP_MEDIA_THUMBNAILS_DIR);
        if (fs.existsSync(restoredMapMediaThumbnails)) fs.cpSync(restoredMapMediaThumbnails, MAP_MEDIA_THUMBNAILS_DIR, { recursive: true });
        removeDirContents(MAP_ORTHOMOSAIC_DIR);
        if (fs.existsSync(restoredMapOrthomosaics)) fs.cpSync(restoredMapOrthomosaics, MAP_ORTHOMOSAIC_DIR, { recursive: true });
        removeDirContents(USER_DRIVE_DIR);
        if (fs.existsSync(restoredUserDrive)) fs.cpSync(restoredUserDrive, USER_DRIVE_DIR, { recursive: true });
        res.json({ success: true, message: 'Restore complete. Restart the server to reopen the restored database.', pre_restore_backup: path.basename(preBackup) });
        setTimeout(() => process.exit(0), 750);
      } catch (e) {
        res.status(500).json({ error: e.message || 'Restore failed' });
      }
    });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    try { fs.rmSync(restoreRoot, { recursive: true, force: true }); } catch (_) {}
    const message = backupZipErrorMessage(e);
    logError('RESTORE_BACKUP_INVALID_ZIP', message, e.stack);
    res.status(400).json({ error: message });
  }
};

const requireRestorePassword = (req, res) => {
  const password = String(req.body?.restore_password || req.body?.password || '').trim();
  if (!password) {
    res.status(400).json({ error: 'System restore password is required.', code: 'RESTORE_PASSWORD_REQUIRED' });
    return false;
  }
  if (password !== SYSTEM_RESTORE_PASSWORD) {
    res.status(403).json({ error: 'Incorrect system restore password.', code: 'RESTORE_PASSWORD_INVALID' });
    return false;
  }
  return true;
};

app.post('/api/backups/restore', requireManageBackups, requireBackupUploadStorage, backupUpload.single('backup'), __routeController133);

app.post('/api/backups/restore-login', requireBackupUploadStorage, backupUpload.single('backup'), __routeController134);

app.get('/api/config/export', requireConfigImportExport, __routeController135);

app.post('/api/config/preview', requireConfigImportExport, __routeController136);

app.post('/api/config/import', requireConfigImportExport, __routeController137);
