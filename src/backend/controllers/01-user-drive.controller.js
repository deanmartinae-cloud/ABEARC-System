// Controllers extracted from src/backend/routes/01-user-drive.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController005 = async (req, res) => {
  try {
    const folderId = normalizeUserDriveFolderId(req.query.folder_id);
    await ensureOwnDriveFolder(req.user.id, folderId);
    const search = String(req.query.search || '').trim().toLowerCase();
    const type = String(req.query.type || '').trim().toLowerCase();
    const tag = String(req.query.tag || '').trim().toLowerCase();
    let folderRows = await dbAll(`SELECT * FROM UserDriveFolders WHERE owner_user_id=? AND ${folderId ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'} AND deleted_at IS NULL ORDER BY name COLLATE NOCASE`, folderId ? [req.user.id, folderId] : [req.user.id]);
    let fileRows = await dbAll(`SELECT * FROM UserDriveFiles WHERE owner_user_id=? AND ${folderId ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'} AND deleted_at IS NULL AND status='active'`, folderId ? [req.user.id, folderId] : [req.user.id]);
    folderRows = folderRows.filter(folder => !search || String(folder.name || '').toLowerCase().includes(search));
    fileRows = fileRows.filter(file => {
      const haystack = [file.title, file.original_name, file.description, file.tags, file.file_ext, file.file_type].join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesTag = !tag || String(file.tags || '').toLowerCase().split(',').map(v => v.trim()).includes(tag);
      const matchesType = !type || (type === 'image' ? ['.jpg','.jpeg','.png','.webp'].includes(file.file_ext) : type === 'video' ? ['.mp4','.mov','.webm'].includes(file.file_ext) : type === 'document' ? ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv'].includes(file.file_ext) : type === 'zip' ? file.file_ext === '.zip' : true);
      return matchesSearch && matchesTag && matchesType;
    });
    const usage = await calculateUserDriveUsage(req.user.id);
    const breadcrumbs = [];
    let cursor = folderId;
    while (cursor) {
      const folder = await dbGet(`SELECT id, name, parent_folder_id FROM UserDriveFolders WHERE id=? AND owner_user_id=?`, [cursor, req.user.id]);
      if (!folder) break;
      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      cursor = folder.parent_folder_id;
    }
    folderRows = await withUserDriveFolderSizes(folderRows);
    res.json({ folders: folderRows.map(userDriveFolderPublic), files: fileRows.map(userDriveFilePublic), breadcrumbs, usage: { bytes: usage?.bytes || 0, files: usage?.files || 0, trash_bytes: usage?.trash_bytes || 0, trash_files: usage?.trash_files || 0, quota_bytes: USER_DRIVE_QUOTA_BYTES } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to load My Drive' });
  }
};

const __routeController006 = async (req, res) => {
  try {
    const folderId = normalizeUserDriveFolderId(req.query.folder_id);
    const folderParams = folderId ? [req.user.id, folderId] : [req.user.id];
    const folderRows = await dbAll(`
      SELECT f.*, owner.username as owner_username, COALESCE(parent.name, 'My Drive') as parent_folder_name, COALESCE(parent.name, 'My Drive') as original_location
      FROM UserDriveFolders f
      LEFT JOIN UserDriveFolders parent ON parent.id = f.parent_folder_id
      LEFT JOIN Users owner ON owner.id = f.owner_user_id
      WHERE f.owner_user_id=?
        AND f.deleted_at IS NOT NULL
        AND ${folderId ? 'f.parent_folder_id=?' : '(f.parent_folder_id IS NULL OR parent.deleted_at IS NULL)'}
      ORDER BY datetime(f.deleted_at) DESC
    `, folderParams);
    const fileParams = folderId ? [req.user.id, folderId] : [req.user.id];
    const fileRows = await dbAll(`
      SELECT f.*, owner.username as owner_username, COALESCE(parent.name, 'My Drive') as parent_folder_name, COALESCE(parent.name, 'My Drive') as original_location
      FROM UserDriveFiles f
      LEFT JOIN UserDriveFolders parent ON parent.id = f.parent_folder_id
      LEFT JOIN Users owner ON owner.id = f.owner_user_id
      WHERE f.owner_user_id=?
        AND (f.deleted_at IS NOT NULL OR f.status='deleted')
        AND ${folderId ? 'f.parent_folder_id=?' : '(f.parent_folder_id IS NULL OR parent.deleted_at IS NULL)'}
      ORDER BY datetime(f.deleted_at) DESC
    `, fileParams);
    const usage = await calculateUserDriveUsage(req.user.id);
    const breadcrumbs = [];
    let cursor = folderId;
    while (cursor) {
      const folder = await dbGet(`SELECT id, name, parent_folder_id FROM UserDriveFolders WHERE id=? AND owner_user_id=? AND deleted_at IS NOT NULL`, [cursor, req.user.id]);
      if (!folder) break;
      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      cursor = folder.parent_folder_id;
    }
    const foldersWithSizes = await withUserDriveFolderSizes(folderRows, { includeDeleted: true });
    res.json({ folders: foldersWithSizes.map(userDriveFolderPublic), files: fileRows.map(userDriveFilePublic), breadcrumbs, usage: { bytes: usage?.bytes || 0, files: usage?.files || 0, trash_bytes: usage?.trash_bytes || 0, trash_files: usage?.trash_files || 0, quota_bytes: USER_DRIVE_QUOTA_BYTES } });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load trash' });
  }
};

const __routeController007 = async (req, res) => {
  try {
    const docScannerUpload = isAbedDocScannerUpload(req.body);
    const folderId = docScannerUpload ? null : normalizeUserDriveFolderId(req.body.folder_id);
    const tags = docScannerUpload
      ? safeDriveTags(['abeddocscanner', 'document-scan', 'mobile-upload', ...String(req.body.tags || '').split(',')].join(','))
      : req.body.tags;
    const uploaded = await storeUserDriveUploads(req, req.files, {
      folderId,
      title: req.body.title,
      description: req.body.description,
      tags,
      pathPartsForFile: docScannerUpload ? abedDocScannerFolderParts : null
    });
    logActivity({
      req,
      action: docScannerUpload ? 'USER_DRIVE_ABEDOCSCAN_UPLOAD' : 'USER_DRIVE_UPLOAD',
      details: docScannerUpload
        ? `Uploaded ${uploaded.length} ABEDDocScanner file(s) to ${ABED_DOCSCANNER_UPLOAD_FOLDER}`
        : `Uploaded ${uploaded.length} My Drive file(s)`
    });
    res.status(201).json({ success: true, files: uploaded });
  } catch (err) {
    (req.files || []).forEach(file => { try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {} });
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to upload My Drive file' });
  }
};

const __routeController008 = async (req, res) => {
  try {
    const tags = safeDriveTags(['abedgeocam', 'geotagged', 'camera-upload', ...String(req.body.tags || '').split(',')].join(','));
    const uploaded = await storeUserDriveUploads(req, req.files, {
      imageOnly: true,
      title: req.body.title,
      description: geocamDescription(req.body),
      tags,
      pathPartsForFile: file => geocamFolderParts(req.body, file),
      skipExisting: ['1', 'true', 'yes'].includes(String(req.body.skip_existing || '').toLowerCase())
    });
    const skipped = uploaded.skipped || [];
    logActivity({ req, action: 'USER_DRIVE_ABEDGEOCAM_UPLOAD', details: `Uploaded ${uploaded.length} ABEDGEOCAM photo(s) to My Drive${skipped.length ? `, skipped ${skipped.length} existing` : ''}` });
    res.status(201).json({ success: true, uploaded: uploaded.length, skipped: skipped.length, files: uploaded, skipped_files: skipped });
  } catch (err) {
    (req.files || []).forEach(file => { try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {} });
    res.status(err.statusCode || 400).json({ success: false, uploaded: 0, failed: req.files?.length || 0, errors: [err.message || 'Failed to upload ABEDGEOCAM photo(s).'] });
  }
};

const __routeController009 = async (req, res) => {
  const rows = await dbAll(`
    SELECT original_name
    FROM UserDriveFiles
    WHERE owner_user_id=? AND deleted_at IS NULL AND status='active'
      AND lower(COALESCE(tags, '')) LIKE '%abedgeocam%'
  `, [req.user.id]);
  res.json({ names: rows.map(r => r.original_name).filter(Boolean) });
};

const __routeController010 = async (req, res) => {
  const latest = await latestGeoCamApk();
  if (!latest) return res.json({ available: false });
  res.json({
    available: true,
    id: latest.item.id,
    version: latest.versionName,
    version_code: latest.versionCode,
    filename: latest.item.original_filename || latest.item.stored_filename
  });
};

const __routeController011 = async (req, res) => {
  const latest = await latestGeoCamApk();
  if (!latest) return res.status(404).json({ error: 'GeoCamera APK not found.' });
  await dbRun('UPDATE DownloadsForms SET download_count = COALESCE(download_count, 0) + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), latest.item.id]);
  res.download(latest.full, latest.item.original_filename || latest.item.stored_filename || 'DavaoCityGeoCamera.apk');
};

const __routeController012 = async (req, res) => {
  const latest = await latestDocScannerApk();
  if (!latest) return res.json({ available: false });
  res.json({
    available: true,
    id: latest.item.id,
    version: latest.versionName,
    version_code: latest.versionCode,
    filename: latest.item.original_filename || latest.item.stored_filename
  });
};

const __routeController013 = async (req, res) => {
  const latest = await latestDocScannerApk();
  if (!latest) return res.status(404).json({ error: 'ABED Doc Scanner APK not found.' });
  await dbRun('UPDATE DownloadsForms SET download_count = COALESCE(download_count, 0) + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), latest.item.id]);
  res.download(latest.full, latest.item.original_filename || latest.item.stored_filename || 'ABEDDocScannerClean.apk');
};

const __routeController014 = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });
    const parent = normalizeUserDriveFolderId(req.body?.parent_folder_id);
    await ensureOwnDriveFolder(req.user.id, parent);
    await ensureUniqueDriveFolderName(req.user.id, parent, name);
    const now = new Date().toISOString();
    const result = await dbRun(`INSERT INTO UserDriveFolders (owner_user_id, name, parent_folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [req.user.id, name, parent, now, now]);
    logActivity({ req, action: 'USER_DRIVE_MOVE', details: `Created My Drive folder ${name}` });
    res.status(201).json({ success: true, folder: userDriveFolderPublic(await dbGet(`SELECT * FROM UserDriveFolders WHERE id=?`, [result.lastID])) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create folder' });
  }
};

const __routeController015 = async (req, res) => {
  try {
    const file = await getDriveFileForAccess(req, Number(req.params.id), { requireOwner: true });
    if (!file) return res.status(404).json({ error: 'File not found' });
    const folderId = normalizeUserDriveFolderId(req.body?.parent_folder_id);
    await ensureOwnDriveFolder(req.user.id, folderId);
    await dbRun(`UPDATE UserDriveFiles SET title=?, description=?, tags=?, parent_folder_id=?, updated_at=? WHERE id=?`, [
      String(req.body?.title || file.title || file.original_name).trim(), String(req.body?.description ?? file.description ?? '').trim(), safeDriveTags(req.body?.tags ?? file.tags), folderId, new Date().toISOString(), file.id
    ]);
    logActivity({ req, action: 'USER_DRIVE_RENAME', details: `Updated My Drive file ${file.original_name}` });
    res.json({ success: true, file: userDriveFilePublic(await dbGet(`SELECT * FROM UserDriveFiles WHERE id=?`, [file.id])) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update file' });
  }
};

const __routeController016 = async (req, res) => {
  try {
    const folder = await ensureOwnDriveFolder(req.user.id, Number(req.params.id));
    const parent = normalizeUserDriveFolderId(req.body?.parent_folder_id);
    if (parent === folder.id) return res.status(400).json({ error: 'A folder cannot be moved into itself.' });
    await ensureOwnDriveFolder(req.user.id, parent);
    const nextName = String(req.body?.name || folder.name).trim();
    await ensureUniqueDriveFolderName(req.user.id, parent, nextName, folder.id);
    await dbRun(`UPDATE UserDriveFolders SET name=?, parent_folder_id=?, updated_at=? WHERE id=?`, [nextName, parent, new Date().toISOString(), folder.id]);
    logActivity({ req, action: 'USER_DRIVE_MOVE', details: `Updated My Drive folder ${folder.name}` });
    res.json({ success: true, folder: userDriveFolderPublic(await dbGet(`SELECT * FROM UserDriveFolders WHERE id=?`, [folder.id])) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update folder' });
  }
};

const __routeController017 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { includeDeleted: true });
  if (!file) {
    const reason = await explainDriveFileAccessDenied(req, Number(req.params.id));
    return res.status(reason.status).json({ error: reason.message });
  }
  const full = userDriveAbsolutePath(file);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'Stored file missing' });
  logActivity({ req, action: 'USER_DRIVE_VIEW', details: file.original_name });
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(file.original_name).replace(/"/g, '')}"`);
  res.sendFile(full);
};

const __routeController018 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireDownload: true });
  if (!file) {
    const reason = await explainDriveFileAccessDenied(req, Number(req.params.id), { requireDownload: true });
    return res.status(reason.status).json({ error: reason.message });
  }
  const full = userDriveAbsolutePath(file);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'Stored file missing' });
  logActivity({ req, action: 'USER_DRIVE_DOWNLOAD', details: file.original_name });
  res.download(full, file.original_name);
};

const __routeController019 = async (req, res) => {
  try {
    cleanupOldMyDriveSelectionZips();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No My Drive items selected.' });
    if (items.length > 200) return res.status(400).json({ error: 'Select up to 200 items per ZIP download.' });
    const zip = new AdmZip();
    const usedPaths = new Set();
    for (const raw of items) {
      const id = Number(raw?.id);
      const kind = raw?.kind === 'folder' ? 'folder' : raw?.kind === 'file' ? 'file' : '';
      if (!Number.isInteger(id) || id <= 0 || !kind) return res.status(400).json({ error: 'Invalid My Drive selection.' });
      if (kind === 'folder') {
        const folder = await resolveUserDriveFolderAccess(req, id);
        if (!folder || folder.deleted_at) return res.status(404).json({ error: 'One selected folder is not available.' });
        await addUserDriveFolderToZip(zip, usedPaths, folder);
      } else {
        const file = await getDriveFileForAccess(req, id, { requireDownload: true });
        if (!file) {
          const reason = await explainDriveFileAccessDenied(req, id, { requireDownload: true });
          return res.status(reason.status).json({ error: reason.message });
        }
        const full = userDriveAbsolutePath(file);
        if (!full || !fs.existsSync(full)) return res.status(404).json({ error: `Stored file missing: ${file.original_name || 'file'}` });
        const name = safeZipSegment(file.original_name || file.title || `file-${file.id}`, `file-${file.id}`);
        zip.addLocalFile(full, '', uniqueZipPath(usedPaths, name));
      }
    }
    const filename = `my-drive-selection-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString('hex')}.zip`;
    const dest = path.join(TEMP_DIR, filename);
    zip.writeZip(dest);
    logActivity({ req, action: 'USER_DRIVE_SELECTION_DOWNLOAD', details: `Downloaded ${items.length} My Drive item(s)` });
    res.json({ success: true, filename, download_path: `/user-drive/items/download/${encodeURIComponent(filename)}` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to download selected items' });
  }
};

const __routeController020 = (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!/^my-drive-selection-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}\.zip$/i.test(filename)) return res.status(404).json({ error: 'Download not found.' });
  const full = path.join(TEMP_DIR, filename);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Download expired.' });
  res.download(full, filename);
};

const __routeController021 = async (req, res) => {
  try {
    const folder = await resolveUserDriveFolderAccess(req, Number(req.params.id));
    if (!folder || folder.deleted_at) return res.status(404).json({ error: 'Folder not found or access was removed.' });
    const zip = new AdmZip();
    const usedPaths = new Set();
    await addUserDriveFolderToZip(zip, usedPaths, folder);
    const zipBuffer = zip.toBuffer();
    const filename = `${safeZipSegment(folder.name || 'folder', 'folder')}.zip`;
    logActivity({ req, action: 'USER_DRIVE_FOLDER_DOWNLOAD', details: `Downloaded My Drive folder ${folder.name}` });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to download folder' });
  }
};

const __routeController022 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireOwner: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  await notifyDriveAccessRemovedByOwnerAction(req, { kind: 'file', id: file.id, name: file.title || file.original_name, action: 'trash' });
  await dbRun(`UPDATE UserDriveFiles SET status='deleted', deleted_at=?, updated_at=? WHERE id=?`, [new Date().toISOString(), new Date().toISOString(), file.id]);
  logActivity({ req, action: 'USER_DRIVE_DELETE', details: file.original_name });
  res.json({ success: true });
};

const __routeController023 = async (req, res) => {
  const folder = await ensureOwnDriveFolder(req.user.id, Number(req.params.id));
  const now = new Date().toISOString();
  await notifyDriveAccessRemovedByOwnerAction(req, { kind: 'folder', id: folder.id, name: folder.name, action: 'trash' });
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id
      FROM UserDriveFolders child
      JOIN folder_tree tree ON child.parent_folder_id = tree.id
      WHERE child.owner_user_id=?
    )
    UPDATE UserDriveFolders
    SET deleted_at=?, updated_at=?
    WHERE id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, now, now]);
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id
      FROM UserDriveFolders child
      JOIN folder_tree tree ON child.parent_folder_id = tree.id
      WHERE child.owner_user_id=?
    )
    UPDATE UserDriveFiles
    SET status='deleted', deleted_at=?, updated_at=?
    WHERE owner_user_id=? AND parent_folder_id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, now, now, req.user.id]);
  logActivity({ req, action: 'USER_DRIVE_DELETE', details: `Deleted My Drive folder ${folder.name}` });
  res.json({ success: true });
};

const __routeController024 = async (req, res) => {
  const file = await dbGet(`SELECT * FROM UserDriveFiles WHERE id=? AND owner_user_id=? AND (deleted_at IS NOT NULL OR status='deleted')`, [Number(req.params.id), req.user.id]);
  if (!file) return res.status(404).json({ error: 'File not found in trash' });
  let parent = file.parent_folder_id || null;
  while (parent) {
    const folder = await dbGet(`SELECT id, parent_folder_id FROM UserDriveFolders WHERE id=? AND owner_user_id=?`, [parent, req.user.id]);
    if (!folder) break;
    await dbRun(`UPDATE UserDriveFolders SET deleted_at=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), folder.id]);
    parent = folder.parent_folder_id;
  }
  await dbRun(`UPDATE UserDriveFiles SET status='active', deleted_at=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), file.id]);
  logActivity({ req, action: 'USER_DRIVE_RESTORE', details: file.original_name });
  res.json({ success: true });
};

const __routeController025 = async (req, res) => {
  const folder = await dbGet(`SELECT * FROM UserDriveFolders WHERE id=? AND owner_user_id=? AND deleted_at IS NOT NULL`, [Number(req.params.id), req.user.id]);
  if (!folder) return res.status(404).json({ error: 'Folder not found in trash' });
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    UPDATE UserDriveFolders SET deleted_at=NULL, updated_at=? WHERE id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, new Date().toISOString()]);
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    UPDATE UserDriveFiles SET status='active', deleted_at=NULL, updated_at=? WHERE owner_user_id=? AND parent_folder_id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, new Date().toISOString(), req.user.id]);
  logActivity({ req, action: 'USER_DRIVE_RESTORE', details: `Restored My Drive folder ${folder.name}` });
  res.json({ success: true });
};

const __routeController026 = async (req, res) => {
  const file = await dbGet(`SELECT * FROM UserDriveFiles WHERE id=? AND owner_user_id=? AND (deleted_at IS NOT NULL OR status='deleted')`, [Number(req.params.id), req.user.id]);
  if (!file) return res.status(404).json({ error: 'File not found in trash' });
  await notifyDriveAccessRemovedByOwnerAction(req, { kind: 'file', id: file.id, name: file.title || file.original_name, action: 'delete_forever' });
  const full = userDriveAbsolutePath(file);
  if (full && fs.existsSync(full)) try { fs.unlinkSync(full); } catch (_) {}
  await dbRun(`DELETE FROM UserDriveShares WHERE file_id=?`, [file.id]);
  await dbRun(`DELETE FROM UserDriveFiles WHERE id=?`, [file.id]);
  logActivity({ req, action: 'USER_DRIVE_DELETE_FOREVER', details: file.original_name });
  res.json({ success: true });
};

const __routeController027 = async (req, res) => {
  const folder = await dbGet(`SELECT * FROM UserDriveFolders WHERE id=? AND owner_user_id=? AND deleted_at IS NOT NULL`, [Number(req.params.id), req.user.id]);
  if (!folder) return res.status(404).json({ error: 'Folder not found in trash' });
  await notifyDriveAccessRemovedByOwnerAction(req, { kind: 'folder', id: folder.id, name: folder.name, action: 'delete_forever' });
  const files = await dbAll(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    SELECT * FROM UserDriveFiles WHERE owner_user_id=? AND parent_folder_id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, req.user.id]);
  for (const file of files) {
    const full = userDriveAbsolutePath(file);
    if (full && fs.existsSync(full)) try { fs.unlinkSync(full); } catch (_) {}
    await dbRun(`DELETE FROM UserDriveShares WHERE file_id=?`, [file.id]);
  }
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    DELETE FROM UserDriveFiles WHERE owner_user_id=? AND parent_folder_id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id, req.user.id]);
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    DELETE FROM UserDriveFolderShares WHERE folder_id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id]);
  await dbRun(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    DELETE FROM UserDriveFolders WHERE id IN (SELECT id FROM folder_tree)
  `, [folder.id, req.user.id, req.user.id]);
  logActivity({ req, action: 'USER_DRIVE_DELETE_FOREVER', details: `Deleted forever My Drive folder ${folder.name}` });
  res.json({ success: true });
};

const __routeController028 = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const targetFolderId = normalizeUserDriveFolderId(req.body?.parent_folder_id);
    await ensureOwnDriveFolder(req.user.id, targetFolderId);
    if (!items.length) return res.status(400).json({ error: 'Choose at least one item to move.' });
    for (const item of items) {
      const id = Number(item.id);
      const kind = item.kind === 'folder' ? 'folder' : 'file';
      if (!id) continue;
      if (kind === 'folder') {
        const folder = await ensureOwnDriveFolder(req.user.id, id);
        if (targetFolderId === folder.id) return res.status(400).json({ error: 'A folder cannot be moved into itself.' });
        const descendants = await userDriveFolderDescendantIds(req.user.id, folder.id);
        if (targetFolderId && descendants.includes(Number(targetFolderId))) return res.status(400).json({ error: 'A folder cannot be moved inside one of its subfolders.' });
        await dbRun(`UPDATE UserDriveFolders SET parent_folder_id=?, updated_at=? WHERE id=? AND owner_user_id=?`, [targetFolderId, new Date().toISOString(), folder.id, req.user.id]);
      } else {
        const file = await getDriveFileForAccess(req, id, { requireOwner: true });
        if (file) await dbRun(`UPDATE UserDriveFiles SET parent_folder_id=?, updated_at=? WHERE id=? AND owner_user_id=?`, [targetFolderId, new Date().toISOString(), file.id, req.user.id]);
      }
    }
    logActivity({ req, action: 'USER_DRIVE_MOVE', details: `Moved ${items.length} My Drive item(s)` });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to move My Drive items' });
  }
};

const __routeController029 = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const targetFolderId = normalizeUserDriveFolderId(req.body?.parent_folder_id);
    await ensureOwnDriveFolder(req.user.id, targetFolderId);
    if (!items.length) return res.status(400).json({ error: 'Choose at least one item to copy.' });
    const copied = [];
    const copiedItems = [];
    for (const item of items) {
      const id = Number(item.id);
      const kind = item.kind === 'folder' ? 'folder' : 'file';
      if (!id) continue;
      if (kind === 'folder') {
        const folder = await ensureOwnDriveFolder(req.user.id, id);
        const copiedId = await copyUserDriveFolderTree(folder, req.user, targetFolderId);
        copied.push(copiedId);
        if (copiedId) copiedItems.push({ id: copiedId, kind: 'folder' });
      } else {
        const file = await getDriveFileForAccess(req, id, { requireDownload: true });
        if (file) {
          const copiedId = await copyUserDriveFileRecord(file, req.user, targetFolderId);
          copied.push(copiedId);
          if (copiedId) copiedItems.push({ id: copiedId, kind: 'file' });
        }
      }
    }
    logActivity({ req, action: 'USER_DRIVE_COPY', details: `Copied ${copied.length} My Drive item(s)` });
    res.json({ success: true, copied, copied_items: copiedItems });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to copy My Drive items' });
  }
};

const validateMyDriveGeoCamFile = async (req, id) => {
  const file = await getDriveFileForAccess(req, Number(id), { requireDownload: true });
  if (!file) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  const full = userDriveAbsolutePath(file);
  if (!full || !fs.existsSync(full)) {
    const err = new Error('Stored file missing');
    err.statusCode = 404;
    throw err;
  }
  if (!['.jpg', '.jpeg'].includes(String(file.file_ext || '').toLowerCase())) {
    const err = new Error('Only JPG/JPEG GeoCam photos can be added to Geotag Map.');
    err.statusCode = 400;
    throw err;
  }
  const driveMetadata = monitoringMetadataFromDrivePhoto(file);
  let metadata = driveMetadata;
  if (validateMonitoringGeoCamProofMetadata(driveMetadata)) {
    metadata = await monitoringMetadataFromManualPhoto({
      path: full,
      originalname: file.original_name,
      mimetype: file.file_type
    });
    metadata.source_label = 'My Drive';
    metadata.client_capture_id = metadata.client_capture_id || `my-drive-${Number(file.id)}`;
  }
  const validationError = validateMonitoringGeoCamProofMetadata(metadata);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 400;
    throw err;
  }
  return { file, full, metadata };
};

const addUserDriveGeoCamToMapController = async (req, res) => {
  try {
    if (!(await userHasPrivilegeAsync(req.user, 'upload_map_media'))) return forbidden(res, 'Permission denied: upload_map_media');
    const { file, full, metadata } = await validateMyDriveGeoCamFile(req, Number(req.params.id));
    const fileHash = await hashFile(full);
    const duplicate = await findMapMediaDuplicate({
      ownerUserId: req.user.id,
      clientCaptureId: metadata.client_capture_id,
      fileHash,
      originalFilename: file.original_name
    });
    if (duplicate) return res.json(mapMediaDuplicateResponse(duplicate));
    const normalized = normalizeMapMediaMetadata({
      client_capture_id: metadata.client_capture_id,
      captured_at: metadata.captured_at,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      accuracy_m: metadata.accuracy_m,
      bearing_deg: metadata.bearing_deg,
      district: monitoringStampValue(metadata.stamp_text, 'District'),
      barangay: monitoringStampValue(metadata.stamp_text, 'Barangay'),
      zoning: monitoringStampValue(metadata.stamp_text, 'Zoning'),
      location_zoning: monitoringStampValue(metadata.stamp_text, 'Location Zoning'),
      facing_zoning: monitoringStampValue(metadata.stamp_text, 'Facing Zoning'),
      category: 'My Drive GeoCam',
      remarks: `Imported from My Drive file ${file.original_name}.`,
      stamp_text: metadata.stamp_text,
      visibility: 'organization',
      coordinate_source: 'my_drive_geocam_metadata'
    });
    validateMapMediaDavaoLocation(normalized);
    // My Drive GeoCam imports may not carry Barangay/District text in the stamp.
    // Resolve only missing administrative/zoning fields from the embedded GPS point
    // using ABEARC's local offline CPDO boundary and zoning datasets before insert.
    await fillMapMediaSpatialMetadataFromCoordinates(normalized);
    const stored = safeMapMediaFilename(file.original_name || 'my-drive-geocam.jpg');
    const originalAbsolute = path.join(MAP_MEDIA_ORIGINALS_DIR, stored);
    fs.copyFileSync(full, originalAbsolute);
    let thumbnailPath = null;
    try {
      thumbnailPath = await generateMapMediaThumbnail(originalAbsolute, stored);
    } catch (err) {
      logError('MY_DRIVE_GEOCAM_THUMBNAIL_FAILED', err.message, err.stack);
    }
    const result = await dbRun(`
      INSERT INTO MapMedia (
        owner_user_id, uploaded_by_user_id, client_capture_id, source_type, original_filename, stored_filename,
        original_path, thumbnail_path, file_size, file_type, file_hash, latitude, longitude, accuracy_m, bearing_deg,
        captured_at, zoning, location_zoning, facing_zoning, district, barangay, category, remarks, stamp_text,
        visibility, coordinate_source, location_status, map_status, created_at, updated_at
      ) VALUES (?, ?, ?, 'geocam', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
      req.user.id, req.user.id, normalized.client_capture_id, file.original_name, stored,
      stored, thumbnailPath, Number(file.file_size || 0), file.file_type || 'image/jpeg', fileHash,
      normalized.latitude, normalized.longitude, normalized.accuracy_m, normalized.bearing_deg,
      normalized.captured_at, normalized.zoning, normalized.location_zoning, normalized.facing_zoning,
      normalized.district, normalized.barangay, normalized.category, normalized.remarks, normalized.stamp_text,
      normalized.visibility, normalized.coordinate_source, normalized.location_status, new Date().toISOString(), new Date().toISOString()
    ]);
    logActivity({ req, action: 'USER_DRIVE_GEOCAM_TO_MAP', details: `Added My Drive GeoCam photo ${file.original_name} to Geotag Map` });
    res.status(201).json({ success: true, duplicate: false, map_media_id: result.lastID, thumbnail_url: thumbnailPath ? `/api/map/media/${result.lastID}/thumbnail` : null });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to add photo to Geotag Map.' });
  }
};

const __routeController030 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireOwner: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  const ids = uniqueIds(Array.isArray(req.body?.user_ids) ? req.body.user_ids : [req.body?.user_id]).filter(id => Number(id) !== Number(req.user.id));
  const permission = 'download';
  if (!ids.length) return res.status(400).json({ error: 'Choose at least one user to share with.' });
  const newRecipients = [];
  const itemName = file.title || file.original_name || 'Shared file';
  for (const id of ids) {
    const activeShare = await dbGet(`SELECT id, permission FROM UserDriveShares WHERE file_id=? AND shared_with_user_id=? AND revoked_at IS NULL`, [file.id, id]);
    if (activeShare) {
      await dbRun(`UPDATE UserDriveShares SET permission=?, shared_by_user_id=? WHERE id=?`, [permission, req.user.id, activeShare.id]);
    } else {
      await dbRun(`INSERT INTO UserDriveShares (file_id, shared_by_user_id, shared_with_user_id, permission, created_at) VALUES (?, ?, ?, ?, ?)`, [file.id, req.user.id, id, permission, new Date().toISOString()]);
      newRecipients.push(id);
    }
  }
  if (newRecipients.length) {
    insertNotifications({
      recipients: newRecipients,
      actorId: req.user.id,
      type: 'user_drive_shared',
      message: `${req.user.username} shared a My Drive file with you: ${itemName}.`,
      targetKind: 'user_drive',
      targetMeta: { file_id: file.id, item_kind: 'file', item_name: itemName },
      alertKey: `user_drive_shared:file:${file.id}:${Date.now()}`
    });
  }
  logActivity({ req, action: 'USER_DRIVE_SHARE', details: `Shared ${file.original_name} with ${ids.length} user(s)` });
  res.json({ success: true });
};

const __routeController031 = async (req, res) => {
  const folder = await ensureOwnDriveFolder(req.user.id, Number(req.params.id));
  const ids = uniqueIds(Array.isArray(req.body?.user_ids) ? req.body.user_ids : [req.body?.user_id]).filter(id => Number(id) !== Number(req.user.id));
  const permission = 'download';
  if (!ids.length) return res.status(400).json({ error: 'Choose at least one user to share with.' });
  const newRecipients = [];
  const itemName = folder.name || 'Shared folder';
  for (const id of ids) {
    const activeShare = await dbGet(`SELECT id, permission FROM UserDriveFolderShares WHERE folder_id=? AND shared_with_user_id=? AND revoked_at IS NULL`, [folder.id, id]);
    if (activeShare) {
      await dbRun(`UPDATE UserDriveFolderShares SET permission=?, shared_by_user_id=? WHERE id=?`, [permission, req.user.id, activeShare.id]);
    } else {
      await dbRun(`INSERT INTO UserDriveFolderShares (folder_id, shared_by_user_id, shared_with_user_id, permission, created_at) VALUES (?, ?, ?, ?, ?)`, [folder.id, req.user.id, id, permission, new Date().toISOString()]);
      newRecipients.push(id);
    }
  }
  if (newRecipients.length) {
    insertNotifications({
      recipients: newRecipients,
      actorId: req.user.id,
      type: 'user_drive_shared',
      message: `${req.user.username} shared a My Drive folder with you: ${itemName}.`,
      targetKind: 'user_drive',
      targetMeta: { folder_id: folder.id, item_kind: 'folder', item_name: itemName },
      alertKey: `user_drive_shared:folder:${folder.id}:${Date.now()}`
    });
  }
  logActivity({ req, action: 'USER_DRIVE_SHARE', details: `Shared folder ${folder.name} with ${ids.length} user(s)` });
  res.json({ success: true });
};

const __routeController032 = async (req, res) => {
  const kind = req.query.kind === 'folder' ? 'folder' : 'file';
  const share = kind === 'folder'
    ? await dbGet(`SELECT s.*, f.owner_user_id, f.name as item_name FROM UserDriveFolderShares s JOIN UserDriveFolders f ON f.id=s.folder_id WHERE s.id=? AND s.revoked_at IS NULL`, [Number(req.params.id)])
    : await dbGet(`SELECT s.*, f.owner_user_id, f.original_name as item_name FROM UserDriveShares s JOIN UserDriveFiles f ON f.id=s.file_id WHERE s.id=? AND s.revoked_at IS NULL`, [Number(req.params.id)]);
  if (!share || (Number(share.owner_user_id) !== Number(req.user.id) && !(await canManageAllUserDrive(req.user)))) return res.status(404).json({ error: 'Share not found' });
  await dbRun(`UPDATE ${kind === 'folder' ? 'UserDriveFolderShares' : 'UserDriveShares'} SET revoked_at=? WHERE id=?`, [new Date().toISOString(), share.id]);
  insertNotifications({ recipients: [share.shared_with_user_id], actorId: req.user.id, type: 'user_drive_access_removed', message: `${req.user.username} removed your access to a shared My Drive item: ${share.item_name}.`, targetKind: 'user_drive', targetMeta: kind === 'folder' ? { folder_id: share.folder_id } : { file_id: share.file_id }, alertKey: `user_drive_access_removed:${kind}:${share.id}:${Date.now()}` });
  logActivity({ req, action: 'USER_DRIVE_SHARE_REVOKE', details: share.item_name });
  res.json({ success: true });
};

const __routeController033 = async (req, res) => {
  const kind = req.query.kind === 'folder' ? 'folder' : 'file';
  const share = kind === 'folder'
    ? await dbGet(`SELECT s.*, f.owner_user_id, f.name as item_name FROM UserDriveFolderShares s JOIN UserDriveFolders f ON f.id=s.folder_id WHERE s.id=? AND s.revoked_at IS NULL`, [Number(req.params.id)])
    : await dbGet(`SELECT s.*, f.owner_user_id, f.original_name as item_name FROM UserDriveShares s JOIN UserDriveFiles f ON f.id=s.file_id WHERE s.id=? AND s.revoked_at IS NULL`, [Number(req.params.id)]);
  if (!share || (Number(share.owner_user_id) !== Number(req.user.id) && !(await canManageAllUserDrive(req.user)))) return res.status(404).json({ error: 'Share not found' });
  await dbRun(`UPDATE ${kind === 'folder' ? 'UserDriveFolderShares' : 'UserDriveShares'} SET permission='download' WHERE id=?`, [share.id]);
  logActivity({ req, action: 'USER_DRIVE_SHARE_UPDATE', details: `${share.item_name} share access confirmed` });
  res.json({ success: true });
};

const __routeController034 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireOwner: true, includeDeleted: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ item: userDriveFilePublic(file), ...(await userDriveAccessRows(req, file, 'file')) });
};

const __routeController035 = async (req, res) => {
  const folder = await resolveUserDriveFolderAccess(req, Number(req.params.id), { requireOwner: true, includeDeleted: true });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  res.json({ item: userDriveFolderPublic(folder), ...(await userDriveAccessRows(req, folder, 'folder')) });
};

const __routeController036 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireOwner: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  const newOwner = await dbGet(`SELECT id, username FROM Users WHERE id=? AND role!='system' AND COALESCE(hidden_from_workflows,0)=0`, [Number(req.body?.new_owner_user_id)]);
  if (!newOwner || Number(newOwner.id) === Number(file.owner_user_id)) return res.status(400).json({ error: 'Choose a valid new owner.' });
  const keepOriginal = req.body?.keep_original_owner !== false;
  await dbRun(`UPDATE UserDriveFiles SET owner_user_id=?, owner_username=?, updated_at=? WHERE id=?`, [newOwner.id, newOwner.username, new Date().toISOString(), file.id]);
  if (keepOriginal) {
    const activeShare = await dbGet(`SELECT id FROM UserDriveShares WHERE file_id=? AND shared_with_user_id=? AND revoked_at IS NULL`, [file.id, req.user.id]);
    if (activeShare) await dbRun(`UPDATE UserDriveShares SET permission='download', shared_by_user_id=? WHERE id=?`, [newOwner.id, activeShare.id]);
    else await dbRun(`INSERT INTO UserDriveShares (file_id, shared_by_user_id, shared_with_user_id, permission, created_at) VALUES (?, ?, ?, 'download', ?)`, [file.id, newOwner.id, req.user.id, new Date().toISOString()]);
  }
  insertNotifications({ recipients: [newOwner.id], actorId: req.user.id, type: 'user_drive_owner_transfer', message: `${req.user.username} transferred ownership of a My Drive file to you: ${file.title || file.original_name}.`, targetKind: 'user_drive', targetMeta: { file_id: file.id }, alertKey: `user_drive_transfer:file:${file.id}:${Date.now()}` });
  logActivity({ req, action: 'USER_DRIVE_TRANSFER_OWNER', details: `Transferred ${file.original_name} to ${newOwner.username}` });
  res.json({ success: true });
};

const __routeController037 = async (req, res) => {
  const folder = await ensureOwnDriveFolder(req.user.id, Number(req.params.id));
  const newOwner = await dbGet(`SELECT id, username FROM Users WHERE id=? AND role!='system' AND COALESCE(hidden_from_workflows,0)=0`, [Number(req.body?.new_owner_user_id)]);
  if (!newOwner || Number(newOwner.id) === Number(folder.owner_user_id)) return res.status(400).json({ error: 'Choose a valid new owner.' });
  const keepOriginal = req.body?.keep_original_owner !== false;
  const folderIds = await userDriveFolderDescendantIds(req.user.id, folder.id);
  await dbRun(`UPDATE UserDriveFolders SET owner_user_id=?, updated_at=? WHERE id IN (${folderIds.map(() => '?').join(',')})`, [newOwner.id, new Date().toISOString(), ...folderIds]);
  await dbRun(`UPDATE UserDriveFiles SET owner_user_id=?, owner_username=?, updated_at=? WHERE parent_folder_id IN (${folderIds.map(() => '?').join(',')})`, [newOwner.id, newOwner.username, new Date().toISOString(), ...folderIds]);
  if (keepOriginal) {
    const activeShare = await dbGet(`SELECT id FROM UserDriveFolderShares WHERE folder_id=? AND shared_with_user_id=? AND revoked_at IS NULL`, [folder.id, req.user.id]);
    if (activeShare) await dbRun(`UPDATE UserDriveFolderShares SET permission='download', shared_by_user_id=? WHERE id=?`, [newOwner.id, activeShare.id]);
    else await dbRun(`INSERT INTO UserDriveFolderShares (folder_id, shared_by_user_id, shared_with_user_id, permission, created_at) VALUES (?, ?, ?, 'download', ?)`, [folder.id, newOwner.id, req.user.id, new Date().toISOString()]);
  }
  insertNotifications({ recipients: [newOwner.id], actorId: req.user.id, type: 'user_drive_owner_transfer', message: `${req.user.username} transferred ownership of a My Drive folder to you: ${folder.name}.`, targetKind: 'user_drive', targetMeta: { folder_id: folder.id }, alertKey: `user_drive_transfer:folder:${folder.id}:${Date.now()}` });
  logActivity({ req, action: 'USER_DRIVE_TRANSFER_OWNER', details: `Transferred folder ${folder.name} to ${newOwner.username}` });
  res.json({ success: true });
};

const __routeController038 = async (req, res) => {
  try {
    const folderId = normalizeUserDriveFolderId(req.query.folder_id);
    if (folderId) {
      const folderAccess = await resolveUserDriveFolderAccess(req, folderId);
      if (!folderAccess) return res.status(404).json({ error: 'Shared folder not found or access was removed.' });
      const childFolders = await dbAll(`
        SELECT f.*, owner.username as owner_username, ? as share_id, ? as share_permission, ? as shared_by_username,
               ? as shared_at,
               'inherited_folder' as share_source
        FROM UserDriveFolders f
        LEFT JOIN Users owner ON owner.id=f.owner_user_id
        WHERE f.owner_user_id=? AND f.parent_folder_id=? AND f.deleted_at IS NULL
        ORDER BY f.name COLLATE NOCASE
      `, [folderAccess.share_id || folderAccess.folder_share_id, folderAccess.share_permission, folderAccess.shared_by_username || folderAccess.owner_username || '', folderAccess.shared_at || folderAccess.created_at || '', folderAccess.owner_user_id, folderAccess.id]);
      const childFiles = await dbAll(`
        SELECT f.*, COALESCE(fs.id, ?) as share_id, ? as folder_share_id,
               'download' as share_permission,
               COALESCE(fileSharer.username, ?) as shared_by_username,
               COALESCE(fs.created_at, ?) as shared_at,
               CASE WHEN fs.id IS NOT NULL THEN 'direct_file' ELSE 'inherited_folder' END as share_source
        FROM UserDriveFiles f
        LEFT JOIN UserDriveShares fs ON fs.file_id=f.id AND fs.shared_with_user_id=? AND fs.revoked_at IS NULL
        LEFT JOIN Users fileSharer ON fileSharer.id=fs.shared_by_user_id
        WHERE f.owner_user_id=? AND f.parent_folder_id=? AND f.deleted_at IS NULL AND f.status='active'
        ORDER BY COALESCE(f.title, f.original_name) COLLATE NOCASE
      `, [folderAccess.share_id || folderAccess.folder_share_id, folderAccess.share_id || folderAccess.folder_share_id, folderAccess.shared_by_username || folderAccess.owner_username || '', folderAccess.shared_at || folderAccess.created_at || '', req.user.id, folderAccess.owner_user_id, folderAccess.id]);
      const breadcrumbs = [];
      let cursor = folderAccess.id;
      while (cursor) {
        const crumbAccess = await resolveUserDriveFolderAccess(req, cursor);
        if (!crumbAccess) break;
        breadcrumbs.unshift({ id: crumbAccess.id, name: crumbAccess.name });
        cursor = crumbAccess.parent_folder_id;
      }
      const childFoldersWithSizes = await withUserDriveFolderSizes(childFolders);
      return res.json({ folders: childFoldersWithSizes.map(userDriveFolderPublic), files: childFiles.map(userDriveFilePublic), breadcrumbs });
    }
    const folders = await dbAll(`
      SELECT f.*, fs.id as share_id, 'download' as share_permission, u.username as shared_by_username,
             fs.created_at as shared_at,
             owner.username as owner_username, 'direct_folder' as share_source
      FROM UserDriveFolderShares fs
      JOIN UserDriveFolders f ON f.id=fs.folder_id
      LEFT JOIN Users u ON u.id=fs.shared_by_user_id
      LEFT JOIN Users owner ON owner.id=f.owner_user_id
      WHERE fs.shared_with_user_id=? AND fs.revoked_at IS NULL AND f.deleted_at IS NULL
      ORDER BY datetime(fs.created_at) DESC
    `, [req.user.id]);
    const files = await dbAll(`
      SELECT f.*, s.id as share_id, 'download' as share_permission, u.username as shared_by_username,
             s.created_at as shared_at,
             'direct_file' as share_source
      FROM UserDriveShares s
      JOIN UserDriveFiles f ON f.id=s.file_id
      JOIN Users u ON u.id=s.shared_by_user_id
      WHERE s.shared_with_user_id=? AND s.revoked_at IS NULL AND f.deleted_at IS NULL AND f.status='active'
      ORDER BY datetime(s.created_at) DESC
    `, [req.user.id]);
    const foldersWithSizes = await withUserDriveFolderSizes(folders);
    res.json({ folders: foldersWithSizes.map(userDriveFolderPublic), files: files.map(userDriveFilePublic), breadcrumbs: [] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load shared My Drive items' });
  }
};

const __routeController039 = async (req, res) => {
  const rows = await dbAll(`SELECT owner_user_id, owner_username, COUNT(*) as files, COALESCE(SUM(file_size),0) as bytes, SUM(CASE WHEN deleted_at IS NOT NULL OR status='deleted' THEN 1 ELSE 0 END) as deleted_files, COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL OR status='deleted' THEN file_size ELSE 0 END),0) as deleted_bytes FROM UserDriveFiles GROUP BY owner_user_id, owner_username ORDER BY bytes DESC`);
  res.json({ total_bytes: dirSize(USER_DRIVE_DIR), users: rows });
};

const __routeController040 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireDownload: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(file.file_ext)) return res.status(400).json({ error: 'This file type is not supported by project document uploads.' });
  if (!(await userHasPrivilegeAsync(req.user, 'upload_document'))) return forbidden(res, 'Permission denied: upload_document');
  const doc = await dbGet(`SELECT d.*, p.name as project_name FROM Documents d JOIN Projects p ON p.id=d.project_id WHERE d.id=?`, [Number(req.body?.document_id)]);
  if (!doc) return res.status(404).json({ error: 'Document requirement not found' });
  const source = userDriveAbsolutePath(file);
  if (!source || !fs.existsSync(source)) return res.status(404).json({ error: 'Stored file missing' });
  const projFolder = `Proj_${doc.project_id}`;
  const docFolder = String(doc.document_type_name || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const destDir = path.join(UPLOADS_DIR, projFolder, docFolder);
  fs.mkdirSync(destDir, { recursive: true });
  const stored = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${file.file_ext}`;
  const dest = path.join(destDir, stored);
  fs.copyFileSync(source, dest);
  const rel = path.relative(UPLOADS_DIR, dest).replace(/\\/g, '/');
  const now = new Date().toISOString();
  await dbRun(`UPDATE Documents SET file_path=?, file_name=?, upload_date=?, status='For Review', uploader_user_id=? WHERE id=?`, [rel, file.original_name, now, req.user.id, doc.id]);
  logActivity({ req, action: 'USER_DRIVE_COPY_TO_PROJECT_DOCUMENT', projectId: doc.project_id, project: doc.project_name, docType: doc.document_type_name, details: `Copied ${file.original_name} from My Drive` });
  res.json({ success: true });
};

const __routeController041 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireDownload: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!(await userHasPrivilegeAsync(req.user, 'upload_project_documentation'))) return forbidden(res, 'Permission denied: upload_project_documentation');
  if (!PROJECT_DOCUMENTATION_ALLOWED_EXTENSIONS.includes(file.file_ext)) return res.status(400).json({ error: 'Project Documentation only accepts images and videos.' });
  const projectId = Number(req.body?.project_id);
  const project = await dbGet(`SELECT id, name FROM Projects WHERE id=?`, [projectId]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const stage = ['Proposal','Implementation','Monitoring','Completed'].includes(req.body?.stage) ? req.body.stage : 'Proposal';
  const mediaType = PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS.includes(file.file_ext) ? 'video' : 'photo';
  const source = userDriveAbsolutePath(file);
  const destDir = path.join(PROJECT_DOCUMENTATION_DIR, `project-${projectId}`, stage);
  fs.mkdirSync(destDir, { recursive: true });
  const stored = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${file.file_ext}`;
  const dest = path.join(destDir, stored);
  fs.copyFileSync(source, dest);
  const rel = path.relative(PROJECT_DOCUMENTATION_DIR, dest).replace(/\\/g, '/');
  await dbRun(`INSERT INTO ProjectDocumentationFiles (project_id, uploaded_by_user_id, uploaded_by_username, original_name, stored_name, file_path, file_ext, file_type, file_size, media_type, stage, category, caption, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [projectId, req.user.id, req.user.username, file.original_name, stored, rel, file.file_ext, file.file_type, file.file_size, mediaType, stage, String(req.body?.category || '').trim(), String(req.body?.caption || '').trim(), new Date().toISOString()]);
  logActivity({ req, action: 'USER_DRIVE_COPY_TO_PROJECT_DOCUMENTATION', projectId, project: project.name, docType: stage, details: `Copied ${file.original_name} from My Drive` });
  res.json({ success: true });
};

const __routeController042 = async (req, res) => {
  const file = await getDriveFileForAccess(req, Number(req.params.id), { requireDownload: true });
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!CALENDAR_ATTACHMENT_ALLOWED_EXTENSIONS.includes(file.file_ext)) return res.status(400).json({ error: 'This file type is not supported by schedule attachments.' });
  const access = await getCalendarEventAccess(req, Number(req.body?.event_id));
  if (!access?.event || !access.canEdit) return forbidden(res, 'Permission denied');
  const source = userDriveAbsolutePath(file);
  const destDir = path.join(CALENDAR_ATTACHMENTS_DIR, `event-${access.event.id}`);
  fs.mkdirSync(destDir, { recursive: true });
  const stored = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${file.file_ext}`;
  const dest = path.join(destDir, stored);
  fs.copyFileSync(source, dest);
  const rel = path.relative(CALENDAR_ATTACHMENTS_DIR, dest).replace(/\\/g, '/');
  await dbRun(`INSERT INTO CalendarEventAttachments (event_id, uploaded_by_user_id, file_name, original_name, file_path, file_type, file_ext, file_size, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [access.event.id, req.user.id, stored, file.original_name, rel, file.file_type, file.file_ext, file.file_size, String(req.body?.attachment_type || 'supporting_file')]);
  logActivity({ req, action: 'USER_DRIVE_COPY_TO_CALENDAR_ATTACHMENT', details: `Copied ${file.original_name} to schedule ${access.event.title}` });
  res.json({ success: true });
};
