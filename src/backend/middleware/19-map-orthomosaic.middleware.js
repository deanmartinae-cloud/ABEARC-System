const canManageDroneOrthomosaics = async (user) => {
  if (!user) return false;
  const row = await dbGet(`SELECT enabled FROM UserPrivileges WHERE user_id=? AND privilege='manage_drone_orthomosaics'`, [user.id]);
  return Number(row?.enabled || 0) === 1;
};

const requireDroneOrthomosaicAccess = requireAuth;
const requireDroneOrthomosaicManagement = async (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Please log in.');
  if (!await canManageDroneOrthomosaics(req.user)) return forbidden(res, 'Permission denied: manage_drone_orthomosaics');
  next();
};

const orthomosaicUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MAP_ORTHOMOSAIC_TEMP_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});

const orthomosaicUpload = multer({
  storage: orthomosaicUploadStorage,
  limits: { fileSize: MAP_ORTHOMOSAIC_MAX_FILE_SIZE_GB * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['.tif', '.tiff'].includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Invalid orthomosaic file type. Upload a georeferenced GeoTIFF (.tif or .tiff).'));
    }
    cb(null, true);
  }
});

const requireOrthomosaicUploadStorage = (req, res, next) => {
  const contentLength = Number(req.headers['content-length'] || 0);
  const available = getAvailableStorageBytes(MAP_ORTHOMOSAIC_TEMP_DIR);
  if (contentLength > 0 && contentLength > available) {
    return res.status(507).json({ error: `Not enough storage for this orthomosaic. Available: ${formatBytes(available)}.` });
  }
  next();
};
