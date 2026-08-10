const backupUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') return cb(new Error('Backup file must be a ZIP archive.'), false);
    cb(null, true);
  }
});

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const getAvailableStorageBytes = (dir = DATA_DIR) => {
  const stats = fs.statfsSync(dir);
  return Number(stats.bavail || stats.bfree || 0) * Number(stats.bsize || 0);
};

const requireBackupUploadStorage = (req, res, next) => {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (!Number.isFinite(contentLength) || contentLength <= 0) return next();
  try {
    const available = getAvailableStorageBytes(TEMP_DIR);
    if (contentLength > available) {
      return res.status(400).json({ error: `Not enough server storage for this backup. Required ${formatBytes(contentLength)}, available ${formatBytes(available)}.` });
    }
  } catch (e) {
    logError('BACKUP_STORAGE_CHECK_FAILED', e.message, e.stack);
  }
  next();
};

const userDriveUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  preservePath: true
});

const handleUserDriveUpload = (req, res, next) => {
  userDriveUpload.array('files', 500)(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
      ? 'Files can be up to 500 MB each.'
      : (err.message || 'Failed to upload My Drive file.');
    (req.files || []).forEach(file => { try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {} });
    return res.status(400).json({ error: message });
  });
};

const calendarAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_calendar_upload${ext}`);
  }
});

const calendarAttachmentUpload = multer({
  storage: calendarAttachmentStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!CALENDAR_ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) return cb(new Error('Invalid file type. Allowed files: PDF, images, Word, Excel, PowerPoint, TXT, and CSV only.'), false);
    cb(null, true);
  }
});

const downloadsFormsFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_downloads_forms${ext}`);
  }
});

const downloadsFormsFileUpload = multer({
  storage: downloadsFormsFileStorage,
  limits: { fileSize: 1024 * 1024 * 1024 }
});

const projectClosureAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_closure${ext}`);
  }
});

const projectClosureAttachmentUpload = multer({
  storage: projectClosureAttachmentStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!PROJECT_CLOSURE_ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) return cb(new Error('Invalid file type. Allowed files: PDF, images, Word, Excel, PowerPoint, TXT, and CSV only.'), false);
    cb(null, true);
  }
});

const userFeedbackAttachmentUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const projectDocumentationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_project_documentation${ext}`);
  }
});

const projectDocumentationUpload = multer({
  storage: projectDocumentationStorage,
  limits: { fileSize: 500 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!PROJECT_DOCUMENTATION_ALLOWED_EXTENSIONS.includes(ext)) return cb(new Error('Invalid file type. Allowed photos: JPG, JPEG, PNG, WEBP. Allowed videos: MP4, MOV, WEBM.'), false);
    cb(null, true);
  }
});
