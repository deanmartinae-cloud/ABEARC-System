const monitoringInventoryImportUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      return cb(new Error('Invalid file type. Monitoring inventory import requires an Excel workbook.'), false);
    }
    cb(null, true);
  }
});

const monitoringAttachmentUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'confirmation_photos') {
      if (!['.jpg', '.jpeg'].includes(ext)) {
        return cb(new Error('Manual monitoring confirmation requires the original GeoCam JPG or JPEG photo.'), false);
      }
      return cb(null, true);
    }
    if (!MONITORING_ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Invalid file type. Monitoring evidence supports PDF, images, Word, Excel, TXT, and CSV files.'), false);
    }
    cb(null, true);
  }
});
