const sharp = require('sharp');

const mapMediaUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MAP_MEDIA_TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const mapMediaUpload = multer({
  storage: mapMediaUploadStorage,
  limits: { fileSize: mapMediaConfig.maxFileSizeBytes, files: 100 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (!MAP_MEDIA_ALLOWED_EXTENSIONS.includes(ext) || !MAP_MEDIA_ALLOWED_MIME_TYPES.includes(mime)) {
      return cb(new Error('Invalid map image type. Use JPG, PNG, or WEBP.'), false);
    }
    cb(null, true);
  }
});

const hashFile = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const safeMapMediaFilename = (originalName = 'photo.jpg') => {
  const ext = MAP_MEDIA_ALLOWED_EXTENSIONS.includes(path.extname(originalName).toLowerCase())
    ? path.extname(originalName).toLowerCase()
    : '.jpg';
  return `${Date.now()}_${crypto.randomBytes(10).toString('hex')}${ext}`;
};

const moveMapMediaOriginal = (tempPath, originalName) => {
  const stored = safeMapMediaFilename(originalName);
  const relative = stored;
  const destination = path.join(MAP_MEDIA_ORIGINALS_DIR, stored);
  fs.renameSync(tempPath, destination);
  return { stored, relative, absolute: destination };
};

const generateMapMediaThumbnail = async (originalAbsolutePath, storedFilename) => {
  const thumbName = `${path.parse(storedFilename).name}.webp`;
  const destination = path.join(MAP_MEDIA_THUMBNAILS_DIR, thumbName);
  await sharp(originalAbsolutePath)
    .rotate()
    .resize({ width: mapMediaConfig.thumbnailMaxSize, height: mapMediaConfig.thumbnailMaxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(destination);
  return thumbName;
};

const mapMediaAbsolutePath = (kind, relativePath) => {
  const root = kind === 'thumbnail' ? MAP_MEDIA_THUMBNAILS_DIR : MAP_MEDIA_ORIGINALS_DIR;
  return safeRelativePath(root, relativePath);
};
