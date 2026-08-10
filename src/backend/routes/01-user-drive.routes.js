
const userDriveRootForUser = (userId) => path.join(USER_DRIVE_DIR, `user-${Number(userId)}`);
const normalizeUserDriveFolderId = (value) => {
  const n = Number(value || 0);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const safeDriveTags = (value) => String(value || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 20).join(', ');
const ABED_DOCSCANNER_UPLOAD_FOLDER = 'ABEDOCSCAN Uploads';
const isAbedDocScannerUpload = (body = {}) => String(body.tags || '')
  .split(',')
  .map(tag => tag.trim().toLowerCase())
  .some(tag => ['abeddocscanner', 'document-scan'].includes(tag));
const abedDocScannerFolderParts = (file = {}) => [
  ABED_DOCSCANNER_UPLOAD_FOLDER,
  path.basename(file.originalname || 'abed-docscanner.pdf')
];
const userDriveFilePublic = (row = {}) => ({
  id: row.id,
  owner_user_id: row.owner_user_id,
  owner_username: row.owner_username,
  parent_folder_id: row.parent_folder_id,
  original_name: row.original_name,
  file_ext: row.file_ext,
  file_type: row.file_type,
  file_size: row.file_size,
  title: row.title || row.original_name,
  description: row.description || '',
  tags: row.tags || '',
  uploaded_at: row.uploaded_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at || null,
  original_location: row.original_location || row.parent_folder_name || (row.parent_folder_id ? 'Folder' : 'My Drive'),
  parent_folder_name: row.parent_folder_name || '',
  shared_by_username: row.shared_by_username || '',
  shared_at: row.shared_at || row.share_created_at || null,
  share_id: row.share_id || null,
  share_permission: row.share_permission || null,
  share_source: row.share_source || (row.folder_share_id ? 'inherited_folder' : (row.share_id ? 'direct_file' : null)),
  folder_share_id: row.folder_share_id || null,
  kind: 'file'
});
const userDriveFolderPublic = (row = {}) => ({
  id: row.id,
  owner_user_id: row.owner_user_id,
  owner_username: row.owner_username || '',
  parent_folder_id: row.parent_folder_id,
  name: row.name,
  folder_size: Number(row.folder_size || row.file_size || 0),
  file_size: Number(row.folder_size || row.file_size || 0),
  file_count: Number(row.file_count || 0),
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at || null,
  original_location: row.original_location || row.parent_folder_name || (row.parent_folder_id ? 'Folder' : 'My Drive'),
  parent_folder_name: row.parent_folder_name || '',
  shared_by_username: row.shared_by_username || '',
  shared_at: row.shared_at || row.share_created_at || null,
  share_id: row.share_id || null,
  share_permission: row.share_permission || null,
  share_source: row.share_source || (row.share_id ? 'direct_folder' : null),
  kind: 'folder'
});

const getUserDriveFolderSize = async (folderId, ownerUserId, { includeDeleted = false } = {}) => {
  if (!folderId || !ownerUserId) return { folder_size: 0, file_count: 0 };
  const deletedWhere = includeDeleted
    ? `(file.deleted_at IS NOT NULL OR file.status='deleted')`
    : `file.deleted_at IS NULL AND file.status='active'`;
  const row = await dbGet(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id
      FROM UserDriveFolders child
      JOIN folder_tree tree ON child.parent_folder_id = tree.id
      WHERE child.owner_user_id=?
    )
    SELECT COALESCE(SUM(file.file_size), 0) as folder_size, COUNT(file.id) as file_count
    FROM UserDriveFiles file
    WHERE file.owner_user_id=?
      AND file.parent_folder_id IN (SELECT id FROM folder_tree)
      AND ${deletedWhere}
  `, [folderId, ownerUserId, ownerUserId, ownerUserId]);
  return {
    folder_size: Number(row?.folder_size || 0),
    file_count: Number(row?.file_count || 0)
  };
};

const withUserDriveFolderSizes = async (folders = [], options = {}) => {
  return Promise.all((folders || []).map(async folder => ({
    ...folder,
    ...(await getUserDriveFolderSize(folder.id, folder.owner_user_id, options))
  })));
};
const ensureOwnDriveFolder = async (userId, folderId) => {
  if (!folderId) return null;
  const folder = await dbGet(`SELECT * FROM UserDriveFolders WHERE id=? AND owner_user_id=? AND deleted_at IS NULL`, [folderId, userId]);
  if (!folder) {
    const err = new Error('Folder not found');
    err.statusCode = 404;
    throw err;
  }
  return folder;
};
const safeUserDrivePathParts = (value) => String(value || '')
  .replace(/\\/g, '/')
  .split('/')
  .map(part => part.trim())
  .filter(part => part && part !== '.' && part !== '..' && !/[<>:"|?*\x00-\x1F]/.test(part))
  .slice(0, 20);
const ensureUserDriveFolderPath = async (userId, parentFolderId, parts) => {
  let parent = parentFolderId || null;
  for (const raw of parts) {
    const name = raw.slice(0, 120);
    let folder = await dbGet(`SELECT * FROM UserDriveFolders WHERE owner_user_id=? AND ${parent ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'} AND deleted_at IS NULL AND lower(name)=lower(?)`, parent ? [userId, parent, name] : [userId, name]);
    if (!folder) {
      const now = new Date().toISOString();
      const result = await dbRun(`INSERT INTO UserDriveFolders (owner_user_id, name, parent_folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [userId, name, parent, now, now]);
      folder = await dbGet(`SELECT * FROM UserDriveFolders WHERE id=?`, [result.lastID]);
    }
    parent = folder.id;
  }
  return parent;
};
const ensureUniqueDriveFolderName = async (userId, parentFolderId, name, excludeId = null) => {
  const existing = await dbGet(`
    SELECT id FROM UserDriveFolders
    WHERE owner_user_id=? AND ${parentFolderId ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'}
      AND deleted_at IS NULL AND lower(name)=lower(?) ${excludeId ? 'AND id<>?' : ''}
  `, parentFolderId ? (excludeId ? [userId, parentFolderId, name, excludeId] : [userId, parentFolderId, name]) : (excludeId ? [userId, name, excludeId] : [userId, name]));
  if (existing) {
    const err = new Error('A folder with this name already exists here.');
    err.statusCode = 400;
    throw err;
  }
};
const uniqueDriveFileDisplayName = async (userId, parentFolderId, filename) => {
  const parsed = path.parse(filename || 'file');
  const base = parsed.name || 'file';
  const ext = parsed.ext || '';
  let candidate = `${base}${ext}`;
  let index = 1;
  while (await dbGet(`
    SELECT id FROM UserDriveFiles
    WHERE owner_user_id=? AND ${parentFolderId ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'}
      AND deleted_at IS NULL AND status='active'
      AND (lower(original_name)=lower(?) OR lower(title)=lower(?))
  `, parentFolderId ? [userId, parentFolderId, candidate, candidate] : [userId, candidate, candidate])) {
    candidate = `${base} (${index++})${ext}`;
  }
  return candidate;
};
const userDriveFolderDescendantIds = async (userId, folderId) => {
  const rows = await dbAll(`
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=?
      UNION ALL
      SELECT child.id FROM UserDriveFolders child JOIN folder_tree tree ON child.parent_folder_id = tree.id WHERE child.owner_user_id=?
    )
    SELECT id FROM folder_tree
  `, [folderId, userId, userId]);
  return rows.map(row => Number(row.id)).filter(Boolean);
};
const canManageAllUserDrive = async (user) => user ? userHasPrivilegeAsync(user, 'manage_all_user_drive') : false;
const calculateUserDriveUsage = async (userId) => dbGet(`
  SELECT COALESCE(SUM(file_size), 0) as bytes,
         COUNT(*) as files,
         COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL OR status='deleted' THEN file_size ELSE 0 END), 0) as trash_bytes,
         SUM(CASE WHEN deleted_at IS NOT NULL OR status='deleted' THEN 1 ELSE 0 END) as trash_files
  FROM UserDriveFiles
  WHERE owner_user_id=?
`, [userId]);
const activeShareRecipientIdsForFile = async (fileId) => {
  const rows = await dbAll(`SELECT DISTINCT shared_with_user_id FROM UserDriveShares WHERE file_id=? AND revoked_at IS NULL`, [fileId]);
  return rows.map(row => Number(row.shared_with_user_id)).filter(Boolean);
};
const activeShareRecipientIdsForFolder = async (folderId) => {
  const rows = await dbAll(`SELECT DISTINCT shared_with_user_id FROM UserDriveFolderShares WHERE folder_id=? AND revoked_at IS NULL`, [folderId]);
  return rows.map(row => Number(row.shared_with_user_id)).filter(Boolean);
};
const notifyDriveAccessRemovedByOwnerAction = async (req, { kind, id, name, action }) => {
  const recipients = kind === 'folder' ? await activeShareRecipientIdsForFolder(id) : await activeShareRecipientIdsForFile(id);
  if (!recipients.length) return;
  const actionText = action === 'delete_forever' ? 'permanently deleted' : 'moved to Trash';
  insertNotifications({ recipients, actorId: req.user.id, type: 'user_drive_access_removed', message: `${req.user.username} removed access to a shared My Drive item: ${name} (${actionText}).`, targetKind: 'user_drive', targetMeta: kind === 'folder' ? { folder_id: id } : { file_id: id }, alertKey: `user_drive_access_removed:${kind}:${id}:${action}:${Date.now()}` });
  logActivity({ req, action: 'USER_DRIVE_SHARE_ACCESS_REMOVED', details: `${name} access removed because owner ${actionText}` });
};
const resolveUserDriveFolderAccess = async (req, folderId, { requireOwner = false, requireDownload = false, includeDeleted = false } = {}) => {
  const folder = await dbGet(`
    SELECT f.*, u.username as owner_username
    FROM UserDriveFolders f
    LEFT JOIN Users u ON u.id=f.owner_user_id
    WHERE f.id=? ${includeDeleted ? '' : 'AND f.deleted_at IS NULL'}
  `, [folderId]);
  if (!folder) return null;
  const isOwner = Number(folder.owner_user_id) === Number(req.user.id);
  const manageAll = !isOwner && await canManageAllUserDrive(req.user);
  if (requireOwner && !isOwner && !manageAll) return null;
  if (isOwner || manageAll) return { ...folder, access_role: isOwner ? 'owner' : 'manager', share_permission: 'download', share_source: isOwner ? 'owner' : 'manager' };
  const share = await dbGet(`
    WITH RECURSIVE ancestors(id, depth) AS (
      SELECT id, 0 FROM UserDriveFolders WHERE id=?
      UNION ALL
      SELECT parent.id, ancestors.depth + 1
      FROM UserDriveFolders child
      JOIN ancestors ON child.id=ancestors.id
      JOIN UserDriveFolders parent ON parent.id=child.parent_folder_id
      WHERE parent.deleted_at IS NULL
    )
    SELECT fs.*, u.username as shared_by_username, ancestors.depth
    FROM ancestors
    JOIN UserDriveFolderShares fs ON fs.folder_id=ancestors.id AND fs.shared_with_user_id=? AND fs.revoked_at IS NULL
    LEFT JOIN Users u ON u.id=fs.shared_by_user_id
    ORDER BY ancestors.depth ASC, datetime(fs.created_at) DESC
    LIMIT 1
  `, [folder.id, req.user.id]);
  if (!share) return null;
  return { ...folder, share_id: share.id, folder_share_id: share.id, share_permission: 'download', shared_by_username: share.shared_by_username || '', shared_at: share.created_at || null, share_source: share.depth === 0 ? 'direct_folder' : 'inherited_folder', access_role: 'shared' };
};
const copyUserDriveFileRecord = async (file, owner, targetFolderId) => {
  const source = userDriveAbsolutePath(file);
  if (!source || !fs.existsSync(source)) return null;
  const userRoot = userDriveRootForUser(owner.id);
  fs.mkdirSync(userRoot, { recursive: true });
  const ext = path.extname(file.original_name || file.stored_name || '').toLowerCase() || file.file_ext || '';
  const storedName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  const dest = path.join(userRoot, storedName);
  fs.copyFileSync(source, dest);
  const rel = path.relative(USER_DRIVE_DIR, dest).replace(/\\/g, '/');
  const now = new Date().toISOString();
  const title = file.title ? `${file.title} copy` : `${file.original_name || 'File'} copy`;
  const result = await dbRun(`INSERT INTO UserDriveFiles (owner_user_id, owner_username, parent_folder_id, original_name, stored_name, file_path, file_ext, file_type, file_size, title, description, tags, uploaded_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    owner.id, owner.username, targetFolderId || null, file.original_name, storedName, rel, file.file_ext || ext, file.file_type || '', file.file_size || 0, title, file.description || '', file.tags || '', now, now
  ]);
  return result.lastID;
};
const copyUserDriveFolderTree = async (sourceFolder, owner, targetFolderId, isRoot = true) => {
  const now = new Date().toISOString();
  const result = await dbRun(`INSERT INTO UserDriveFolders (owner_user_id, name, parent_folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [owner.id, isRoot ? `${sourceFolder.name} copy` : sourceFolder.name, targetFolderId || null, now, now]);
  const newFolderId = result.lastID;
  const childFolders = await dbAll(`SELECT * FROM UserDriveFolders WHERE owner_user_id=? AND parent_folder_id=? AND deleted_at IS NULL ORDER BY id`, [owner.id, sourceFolder.id]);
  for (const child of childFolders) await copyUserDriveFolderTree(child, owner, newFolderId, false);
  const childFiles = await dbAll(`SELECT * FROM UserDriveFiles WHERE owner_user_id=? AND parent_folder_id=? AND deleted_at IS NULL AND status='active'`, [owner.id, sourceFolder.id]);
  for (const file of childFiles) await copyUserDriveFileRecord(file, owner, newFolderId);
  return newFolderId;
};
const getDriveFileForAccess = async (req, fileId, { requireOwner = false, requireDownload = false, includeDeleted = false } = {}) => {
  const file = await dbGet(`
    SELECT f.*
    FROM UserDriveFiles f
    WHERE f.id = ? ${includeDeleted ? '' : "AND f.deleted_at IS NULL AND f.status = 'active'"}
  `, [fileId]);
  if (!file) return null;
  const isOwner = Number(file.owner_user_id) === Number(req.user.id);
  const manageAll = !isOwner && await canManageAllUserDrive(req.user);
  if (requireOwner && !isOwner && !manageAll) return null;
  if (isOwner || manageAll) return { ...file, access_role: isOwner ? 'owner' : 'manager', share_permission: 'download', share_source: isOwner ? 'owner' : 'manager' };
  if (file.deleted_at || file.status !== 'active') return null;
  let resolved = null;
  const directShare = await dbGet(`
    SELECT s.*, u.username as shared_by_username
    FROM UserDriveShares s
    LEFT JOIN Users u ON u.id=s.shared_by_user_id
    WHERE s.file_id=? AND s.shared_with_user_id=? AND s.revoked_at IS NULL
    ORDER BY datetime(s.created_at) DESC
    LIMIT 1
  `, [file.id, req.user.id]);
  if (directShare) {
    resolved = { share_id: directShare.id, share_permission: 'download', shared_by_username: directShare.shared_by_username || '', share_source: 'direct_file' };
  }
  if (file.parent_folder_id) {
    const folderAccess = await resolveUserDriveFolderAccess(req, file.parent_folder_id);
    if (folderAccess) {
      const inherited = {
        folder_share_id: folderAccess.folder_share_id || folderAccess.share_id,
        share_permission: 'download',
        shared_by_username: folderAccess.shared_by_username || '',
        share_source: 'inherited_folder'
      };
      if (!resolved) {
        resolved = { ...resolved, ...inherited, share_id: resolved?.share_id || null };
      } else if (resolved) {
        resolved.folder_share_id = inherited.folder_share_id;
      }
    }
  }
  if (resolved) return { ...file, ...resolved, share_permission: 'download', access_role: 'shared' };
  return null;
};
const explainDriveFileAccessDenied = async (req, fileId, { requireDownload = false } = {}) => {
  const file = await dbGet(`SELECT * FROM UserDriveFiles WHERE id=?`, [fileId]);
  if (!file) return { status: 404, message: 'File not found.' };
  const isOwner = Number(file.owner_user_id) === Number(req.user.id);
  const hadShare = await dbGet(`SELECT id, permission, revoked_at FROM UserDriveShares WHERE file_id=? AND shared_with_user_id=? ORDER BY datetime(created_at) DESC LIMIT 1`, [fileId, req.user.id]);
  const hadFolderShare = file.parent_folder_id ? await dbGet(`
    WITH RECURSIVE ancestors(id) AS (
      SELECT id FROM UserDriveFolders WHERE id=?
      UNION ALL
      SELECT parent.id FROM UserDriveFolders child JOIN ancestors ON child.id=ancestors.id JOIN UserDriveFolders parent ON parent.id=child.parent_folder_id
    )
    SELECT fs.id, fs.permission, fs.revoked_at
    FROM ancestors JOIN UserDriveFolderShares fs ON fs.folder_id=ancestors.id AND fs.shared_with_user_id=?
    ORDER BY datetime(fs.created_at) DESC LIMIT 1
  `, [file.parent_folder_id, req.user.id]) : null;
  const everHadAccess = isOwner || hadShare || hadFolderShare;
  if (!everHadAccess) return { status: 404, message: 'File not found.' };
  if (file.deleted_at || file.status === 'deleted') return { status: 410, message: "This file is in the owner's trash." };
  if ((hadShare?.revoked_at || hadFolderShare?.revoked_at) && !await getDriveFileForAccess(req, fileId)) return { status: 403, message: 'Your access was removed.' };
  return { status: 403, message: 'Your access was removed.' };
};
const userDriveAbsolutePath = (file) => {
  const root = path.resolve(USER_DRIVE_DIR);
  const full = path.resolve(USER_DRIVE_DIR, file.file_path || '');
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
};
const safeZipSegment = (value, fallback = 'Item') => String(value || fallback)
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120) || fallback;
const uniqueZipPath = (usedPaths, desiredPath) => {
  const normalized = String(desiredPath || 'file').replace(/\\/g, '/');
  if (!usedPaths.has(normalized)) {
    usedPaths.add(normalized);
    return normalized;
  }
  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const ext = path.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let counter = 2;
  while (usedPaths.has(`${dir}${stem} (${counter})${ext}`)) counter += 1;
  const next = `${dir}${stem} (${counter})${ext}`;
  usedPaths.add(next);
  return next;
};
const cleanupOldMyDriveSelectionZips = () => {
  try {
    const cutoff = Date.now() - (60 * 60 * 1000);
    for (const name of fs.readdirSync(TEMP_DIR)) {
      if (!/^my-drive-selection-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}\.zip$/i.test(name)) continue;
      const full = path.join(TEMP_DIR, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch (_) {}
};
const validateUserDriveUploadFile = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ext || USER_DRIVE_BLOCKED_EXTENSIONS.includes(ext) || !USER_DRIVE_ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('This file type is not allowed in My Drive.');
  }
  const mime = String(file.mimetype || '').toLowerCase();
  const allowedMimes = USER_DRIVE_MIME_BY_EXT[ext] || [];
  if (mime && allowedMimes.length && !allowedMimes.includes(mime)) {
    throw new Error('This file type does not match the uploaded file.');
  }
  const limit = USER_DRIVE_LARGE_EXTENSIONS.includes(ext) ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
  if (Number(file.size || 0) > limit) throw new Error(USER_DRIVE_LARGE_EXTENSIONS.includes(ext) ? 'Videos and ZIP files can be up to 500 MB.' : 'Documents and images can be up to 50 MB.');
  return ext;
};

const storeUserDriveUploads = async (req, files, { folderId = null, title = '', description = '', tags = '', pathPartsForFile = null, imageOnly = false, skipExisting = false } = {}) => {
  if (!files?.length) {
    const err = new Error('Choose at least one file.');
    err.statusCode = 400;
    throw err;
  }
  await ensureOwnDriveFolder(req.user.id, folderId);
  const usage = await calculateUserDriveUsage(req.user.id);
  const incomingBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (Number(usage?.bytes || 0) + incomingBytes > USER_DRIVE_QUOTA_BYTES) {
    const err = new Error(`My Drive storage limit exceeded. Each user has ${Math.round(USER_DRIVE_QUOTA_BYTES / 1024 / 1024 / 1024)} GB of storage.`);
    err.statusCode = 400;
    throw err;
  }
  const uploaded = [];
  const skipped = [];
  const userRoot = userDriveRootForUser(req.user.id);
  fs.mkdirSync(userRoot, { recursive: true });
  for (const file of files) {
    const ext = validateUserDriveUploadFile(file);
    if (imageOnly && !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const err = new Error('Invalid file type. Allowed files: JPG, JPEG, PNG, and WEBP only.');
      err.statusCode = 400;
      throw err;
    }
    const safeParts = pathPartsForFile ? pathPartsForFile(file) : safeUserDrivePathParts(file.originalname);
    const pathParts = safeParts.length ? safeParts : [path.basename(file.originalname || 'file')];
    const originalBaseName = pathParts[pathParts.length - 1];
    const targetFolderId = pathParts.length > 1 ? await ensureUserDriveFolderPath(req.user.id, folderId, pathParts.slice(0, -1)) : folderId;
    if (skipExisting) {
      const existing = await dbGet(`
        SELECT id FROM UserDriveFiles
        WHERE owner_user_id=? AND ${targetFolderId ? 'parent_folder_id=?' : 'parent_folder_id IS NULL'}
          AND deleted_at IS NULL AND status='active'
          AND lower(original_name)=lower(?)
      `, targetFolderId ? [req.user.id, targetFolderId, originalBaseName] : [req.user.id, originalBaseName]);
      if (existing) {
        skipped.push({ original_name: originalBaseName, file_id: existing.id });
        try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
        continue;
      }
    }
    const displayName = await uniqueDriveFileDisplayName(req.user.id, targetFolderId, originalBaseName);
    const storedName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const dest = path.join(userRoot, storedName);
    fs.renameSync(file.path, dest);
    const rel = path.relative(USER_DRIVE_DIR, dest).replace(/\\/g, '/');
    const result = await dbRun(`INSERT INTO UserDriveFiles (owner_user_id, owner_username, parent_folder_id, original_name, stored_name, file_path, file_ext, file_type, file_size, title, description, tags, uploaded_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      req.user.id, req.user.username, targetFolderId, displayName, storedName, rel, ext, file.mimetype || '', file.size || 0, String(title || displayName).trim(), String(description || '').trim(), safeDriveTags(tags), new Date().toISOString(), new Date().toISOString()
    ]);
    uploaded.push(userDriveFilePublic(await dbGet(`SELECT * FROM UserDriveFiles WHERE id=?`, [result.lastID])));
  }
  uploaded.skipped = skipped;
  return uploaded;
};

const geocamDateInfo = (value) => {
  const date = value ? new Date(value) : new Date();
  const valid = Number.isFinite(date.getTime()) ? date : new Date();
  const yyyy = String(valid.getFullYear());
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  const dd = String(valid.getDate()).padStart(2, '0');
  return { year: yyyy, dateFolder: `${yyyy}-${mm}-${dd}` };
};

const geocamFolderParts = (body = {}, file = {}) => {
  const { year, dateFolder } = geocamDateInfo(body.captured_at);
  const explicit = safeUserDrivePathParts([
    body.district,
    body.barangay,
    body.category,
    body.date_folder || dateFolder
  ].filter(Boolean).join('/'));
  if (explicit.length >= 4) {
    return ['ABEDGEOCAM Uploads', year, explicit[0], explicit[1], explicit[2], explicit[3], path.basename(file.originalname || 'abedgeocam.jpg')];
  }
  const raw = String(body.abedgeocam_path || '').replace(/\\/g, '/');
  const lower = raw.toLowerCase();
  const marker = '/dcim/abed/';
  let tail = '';
  const at = lower.indexOf(marker);
  if (at >= 0) tail = raw.slice(at + marker.length);
  else if (lower.startsWith('dcim/abed/')) tail = raw.slice('dcim/abed/'.length);
  else if (lower.startsWith('abed/')) tail = raw.slice('abed/'.length);
  const parts = safeUserDrivePathParts(tail);
  const district = parts[0] || 'Unknown District';
  const barangay = parts[1] || 'Unknown Barangay';
  const category = parts[2] || 'Default';
  return ['ABEDGEOCAM Uploads', year, district, barangay, category, dateFolder, path.basename(file.originalname || 'abedgeocam.jpg')];
};

const geocamDescription = (body = {}) => {
  const lines = ['Source: ABEDGEOCAM Android camera'];
  [['captured_at', 'GPS datetime'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['accuracy', 'Accuracy'], ['bearing', 'Bearing'], ['zoning', 'Zoning']]
    .forEach(([key, label]) => { if (body[key]) lines.push(`${label}: ${String(body[key]).trim()}`); });
  if (body.stamp_text) lines.push(`Stamp text:\n${String(body.stamp_text).trim()}`);
  if (body.description) lines.push(String(body.description).trim());
  return lines.filter(Boolean).join('\n');
};

const latestGeoCamApk = async () => {
  const rows = await dbAll(`
    SELECT *
    FROM DownloadsForms
    WHERE status='Active'
      AND lower(COALESCE(file_type, '')) = 'apk'
      AND (
        lower(COALESCE(title, '')) LIKE '%geocam%'
        OR lower(COALESCE(original_filename, '')) LIKE '%geocam%'
        OR lower(COALESCE(original_filename, '')) LIKE '%app-release%'
      )
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
  `);
  for (const item of rows) {
    const full = path.resolve(DOWNLOADS_FORMS_DIR, item.file_path || item.stored_filename || '');
    const root = path.resolve(DOWNLOADS_FORMS_DIR);
    if (!full.startsWith(`${root}${path.sep}`) || !fs.existsSync(full)) continue;
    const apk = extractApkVersion(full);
    return { item, full, versionName: apk.versionName || item.version || '', versionCode: Number(apk.versionCode || 0) };
  }
  return null;
};

const latestDocScannerApk = async () => {
  const rows = await dbAll(`
    SELECT *
    FROM DownloadsForms
    WHERE status='Active'
      AND lower(COALESCE(file_type, '')) = 'apk'
      AND (
        lower(COALESCE(title, '')) LIKE '%docscanner%'
        OR lower(COALESCE(title, '')) LIKE '%doc scanner%'
        OR lower(COALESCE(original_filename, '')) LIKE '%docscanner%'
        OR lower(COALESCE(original_filename, '')) LIKE '%docscannerclean%'
        OR lower(COALESCE(original_filename, '')) LIKE '%doc_scanner%'
      )
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
  `);
  for (const item of rows) {
    const full = path.resolve(DOWNLOADS_FORMS_DIR, item.file_path || item.stored_filename || '');
    const root = path.resolve(DOWNLOADS_FORMS_DIR);
    if (!full.startsWith(`${root}${path.sep}`) || !fs.existsSync(full)) continue;
    const apk = extractApkVersion(full);
    return { item, full, versionName: apk.versionName || item.version || '', versionCode: Number(apk.versionCode || 0) };
  }
  return null;
};

app.get('/api/user-drive', checkPrivilege('view_user_drive'), __routeController005);

app.get('/api/user-drive/trash', checkPrivilege('view_user_drive'), __routeController006);

app.post('/api/user-drive/upload', checkPrivilege('upload_user_drive_file'), handleUserDriveUpload, __routeController007);

app.post('/api/mobile/geocam/upload', checkPrivilege('upload_user_drive_file'), handleUserDriveUpload, __routeController008);

app.get('/api/mobile/geocam/existing', checkPrivilege('view_user_drive'), __routeController009);

app.get('/api/mobile/geocam/latest', requireAuth, __routeController010);

app.get('/api/mobile/geocam/latest/download', requireAuth, __routeController011);

app.get('/api/mobile/docscanner/latest', requireAuth, __routeController012);

app.get('/api/mobile/docscanner/latest/download', requireAuth, __routeController013);

app.post('/api/user-drive/folders', checkPrivilege('manage_own_user_drive'), __routeController014);

app.patch('/api/user-drive/files/:id', checkPrivilege('manage_own_user_drive'), __routeController015);

app.patch('/api/user-drive/folders/:id', checkPrivilege('manage_own_user_drive'), __routeController016);

app.get('/api/user-drive/files/:id/view', checkPrivilege('view_user_drive'), __routeController017);

app.get('/api/user-drive/files/:id/download', checkPrivilege('view_user_drive'), __routeController018);

const addUserDriveFolderToZip = async (zip, usedPaths, folder) => {
  const folders = await dbAll(`
      WITH RECURSIVE folder_tree(id, name, parent_folder_id, depth) AS (
        SELECT id, name, parent_folder_id, 0
        FROM UserDriveFolders
        WHERE id=? AND owner_user_id=? AND deleted_at IS NULL
        UNION ALL
        SELECT child.id, child.name, child.parent_folder_id, tree.depth + 1
        FROM UserDriveFolders child
        JOIN folder_tree tree ON child.parent_folder_id = tree.id
        WHERE child.owner_user_id=? AND child.deleted_at IS NULL
      )
      SELECT * FROM folder_tree ORDER BY depth, name COLLATE NOCASE
    `, [folder.id, folder.owner_user_id, folder.owner_user_id]);
  const files = await dbAll(`
      WITH RECURSIVE folder_tree(id) AS (
        SELECT id FROM UserDriveFolders WHERE id=? AND owner_user_id=? AND deleted_at IS NULL
        UNION ALL
        SELECT child.id
        FROM UserDriveFolders child
        JOIN folder_tree tree ON child.parent_folder_id = tree.id
        WHERE child.owner_user_id=? AND child.deleted_at IS NULL
      )
      SELECT *
      FROM UserDriveFiles
      WHERE owner_user_id=?
        AND parent_folder_id IN (SELECT id FROM folder_tree)
        AND deleted_at IS NULL
        AND status='active'
      ORDER BY COALESCE(title, original_name) COLLATE NOCASE
    `, [folder.id, folder.owner_user_id, folder.owner_user_id, folder.owner_user_id]);
  const folderById = new Map((folders || []).map(row => [Number(row.id), row]));
  const folderPathById = new Map();
  const buildFolderPath = (folderId) => {
    const id = Number(folderId);
    if (folderPathById.has(id)) return folderPathById.get(id);
    const row = folderById.get(id);
    if (!row) return '';
    const parentPath = row.parent_folder_id && folderById.has(Number(row.parent_folder_id)) ? buildFolderPath(row.parent_folder_id) : '';
    const value = `${parentPath}${safeZipSegment(row.name, `Folder ${row.id}`)}/`;
    folderPathById.set(id, value);
    return value;
  };
  (folders || []).forEach(row => {
    const dir = buildFolderPath(row.id);
    if (dir && !usedPaths.has(dir)) {
      usedPaths.add(dir);
      zip.addFile(dir, Buffer.alloc(0));
    }
  });
  for (const file of files || []) {
    const full = userDriveAbsolutePath(file);
    if (!full || !fs.existsSync(full)) continue;
    const dir = buildFolderPath(file.parent_folder_id);
    const name = safeZipSegment(file.original_name || file.title || `file-${file.id}`, `file-${file.id}`);
    zip.addLocalFile(full, '', uniqueZipPath(usedPaths, `${dir}${name}`));
  }
};

app.post('/api/user-drive/items/download', checkPrivilege('view_user_drive'), __routeController019);

app.get('/api/user-drive/items/download/:filename', checkPrivilege('view_user_drive'), __routeController020);

app.get('/api/user-drive/folders/:id/download', checkPrivilege('view_user_drive'), __routeController021);

app.delete('/api/user-drive/files/:id', checkPrivilege('delete_own_user_drive_file'), __routeController022);

app.delete('/api/user-drive/folders/:id', checkPrivilege('delete_own_user_drive_file'), __routeController023);

app.post('/api/user-drive/files/:id/restore', checkPrivilege('delete_own_user_drive_file'), __routeController024);

app.post('/api/user-drive/folders/:id/restore', checkPrivilege('delete_own_user_drive_file'), __routeController025);

app.delete('/api/user-drive/files/:id/permanent', checkPrivilege('delete_own_user_drive_file'), __routeController026);

app.delete('/api/user-drive/folders/:id/permanent', checkPrivilege('delete_own_user_drive_file'), __routeController027);

app.post('/api/user-drive/items/move', checkPrivilege('manage_own_user_drive'), __routeController028);

app.post('/api/user-drive/items/copy', checkPrivilege('manage_own_user_drive'), __routeController029);

app.post('/api/user-drive/files/:id/add-to-geotag-map', checkPrivilege('view_user_drive'), addUserDriveGeoCamToMapController);

app.post('/api/user-drive/files/:id/share', checkPrivilege('share_user_drive_file'), __routeController030);

app.post('/api/user-drive/folders/:id/share', checkPrivilege('share_user_drive_file'), __routeController031);

app.delete('/api/user-drive/shares/:id', checkPrivilege('share_user_drive_file'), __routeController032);

app.patch('/api/user-drive/shares/:id', checkPrivilege('share_user_drive_file'), __routeController033);

const userDriveAccessRows = async (req, item, kind) => {
  const owner = await dbGet(`SELECT id, username, role, avatar_path FROM Users WHERE id=?`, [item.owner_user_id]);
  const direct = kind === 'folder'
    ? await dbAll(`SELECT s.id, s.permission, s.created_at, s.shared_with_user_id, u.username, u.role, u.avatar_path FROM UserDriveFolderShares s JOIN Users u ON u.id=s.shared_with_user_id WHERE s.folder_id=? AND s.revoked_at IS NULL ORDER BY u.username COLLATE NOCASE`, [item.id])
    : await dbAll(`SELECT s.id, s.permission, s.created_at, s.shared_with_user_id, u.username, u.role, u.avatar_path FROM UserDriveShares s JOIN Users u ON u.id=s.shared_with_user_id WHERE s.file_id=? AND s.revoked_at IS NULL ORDER BY u.username COLLATE NOCASE`, [item.id]);
  const inherited = [];
  if (kind === 'file' && item.parent_folder_id) {
    let cursor = item.parent_folder_id;
    while (cursor) {
      const folder = await dbGet(`SELECT id, name, parent_folder_id FROM UserDriveFolders WHERE id=?`, [cursor]);
      if (!folder) break;
      const shares = await dbAll(`SELECT s.id, s.permission, s.created_at, s.shared_with_user_id, u.username, u.role, u.avatar_path FROM UserDriveFolderShares s JOIN Users u ON u.id=s.shared_with_user_id WHERE s.folder_id=? AND s.revoked_at IS NULL`, [folder.id]);
      shares.forEach(s => inherited.push({ ...s, source_folder_id: folder.id, source_folder_name: folder.name }));
      cursor = folder.parent_folder_id;
    }
  }
  return {
    owner: owner ? userPublicFields(owner) : null,
    users: [
      ...direct.map(row => ({ ...userPublicFields(row), share_id: row.id, share_kind: kind, permission: 'download', source: kind === 'folder' ? 'Direct folder share' : 'Direct file share', created_at: row.created_at, can_manage: true })),
      ...inherited.map(row => ({ ...userPublicFields(row), share_id: row.id, share_kind: 'folder', permission: 'download', source: `Inherited from ${row.source_folder_name}`, source_folder_id: row.source_folder_id, created_at: row.created_at, can_manage: true }))
    ]
  };
};

app.get('/api/user-drive/files/:id/access', checkPrivilege('share_user_drive_file'), __routeController034);

app.get('/api/user-drive/folders/:id/access', checkPrivilege('share_user_drive_file'), __routeController035);

app.post('/api/user-drive/files/:id/transfer-owner', checkPrivilege('manage_own_user_drive'), __routeController036);

app.post('/api/user-drive/folders/:id/transfer-owner', checkPrivilege('manage_own_user_drive'), __routeController037);

app.get('/api/user-drive/shared-with-me', checkPrivilege('view_user_drive'), __routeController038);

app.get('/api/user-drive/storage-summary', checkPrivilege('manage_all_user_drive'), __routeController039);

app.post('/api/user-drive/files/:id/copy-to-project-document', checkPrivilege('attach_drive_file_to_project'), __routeController040);

app.post('/api/user-drive/files/:id/copy-to-project-documentation', checkPrivilege('attach_drive_file_to_project'), __routeController041);

app.post('/api/user-drive/files/:id/copy-to-calendar-attachment', checkPrivilege('attach_drive_file_to_project'), __routeController042);

// Theme preference endpoints
