
// Ensure directories exist
const isDocker = fs.existsSync('/.dockerenv');

const DATA_DIR = isDocker
  ? '/data'
  : path.join(__dirname, 'data');

const TEMP_DIR = path.join(DATA_DIR, 'temp');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CALENDAR_ATTACHMENTS_DIR = path.join(DATA_DIR, 'calendar-attachments');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const DOWNLOADS_FORMS_DIR = path.join(DATA_DIR, 'downloads-forms');
const DOWNLOADS_FORMS_SHARE_SECRET_PATH = path.join(DATA_DIR, '.downloads-forms-share-secret');
const PROJECT_CLOSURE_ATTACHMENTS_DIR = path.join(DATA_DIR, 'project-closure-attachments');
const USER_FEEDBACK_ATTACHMENTS_DIR = path.join(DATA_DIR, 'user-feedback-attachments');
const PROJECT_DOCUMENTATION_DIR = path.join(DATA_DIR, 'project-documentation');
const USER_DRIVE_DIR = path.join(DATA_DIR, 'user-drive');
const MONITORING_ATTACHMENTS_DIR = path.join(DATA_DIR, 'monitoring-attachments');
const MAP_MEDIA_DIR = path.join(DATA_DIR, 'map-media');
const MAP_MEDIA_ORIGINALS_DIR = path.join(MAP_MEDIA_DIR, 'originals');
const MAP_MEDIA_THUMBNAILS_DIR = path.join(MAP_MEDIA_DIR, 'thumbnails');
const MAP_MEDIA_TEMP_DIR = path.join(MAP_MEDIA_DIR, 'temp');
const MAP_ZONING_DIR = path.join(DATA_DIR, 'map-zoning');
const MAP_ZONING_TILE_CACHE_DIR = path.join(MAP_ZONING_DIR, 'tiles');
const MAP_ZONING_DB_PATH = path.join(MAP_ZONING_DIR, 'zones.db');
const MAP_ZONING_PACKAGED_DB_PATH = path.join(__dirname, 'src', 'backend', 'assets', 'zones.dbz');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'data.db');
const BOOTSTRAP_CREDENTIALS_PATH = path.join(DATA_DIR, '.bootstrap-admin-credentials');
const SYSTEM_RESTORE_PASSWORD = 'CAgrO+2026';
const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const AVATAR_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const CALENDAR_ATTACHMENT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
const PROJECT_CLOSURE_ATTACHMENT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
const PROJECT_DOCUMENTATION_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const PROJECT_DOCUMENTATION_ALLOWED_EXTENSIONS = [...PROJECT_DOCUMENTATION_PHOTO_EXTENSIONS, ...PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS];
const MONITORING_ATTACHMENT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
const USER_DRIVE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024;
const USER_DRIVE_LARGE_EXTENSIONS = ['.mp4', '.mov', '.webm', '.zip'];
const USER_DRIVE_ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm', '.zip'];
const USER_DRIVE_BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.js', '.mjs', '.vbs', '.ps1', '.msi', '.apk', '.jar', '.php', '.html', '.htm', '.svg'];
const MAP_MEDIA_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAP_MEDIA_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAP_MEDIA_MAX_FILE_SIZE_MB = Number(process.env.MAP_MEDIA_MAX_FILE_SIZE_MB || 25);
const MAP_MEDIA_LOW_ACCURACY_THRESHOLD_M = Number(process.env.MAP_MEDIA_LOW_ACCURACY_THRESHOLD_M || 25);
const MAP_MEDIA_DEFAULT_VISIBILITY = process.env.MAP_MEDIA_DEFAULT_VISIBILITY || 'organization';
const MAP_MEDIA_THUMBNAIL_MAX_SIZE = Number(process.env.MAP_MEDIA_THUMBNAIL_MAX_SIZE || 480);
const MAP_MEDIA_STYLE_URL = process.env.MAP_MEDIA_STYLE_URL || 'https://demotiles.maplibre.org/style.json';
const MAP_MEDIA_DEFAULT_CENTER_LAT = Number(process.env.MAP_MEDIA_DEFAULT_CENTER_LAT || 7.1907);
const MAP_MEDIA_DEFAULT_CENTER_LNG = Number(process.env.MAP_MEDIA_DEFAULT_CENTER_LNG || 125.4553);
const MAP_MEDIA_DEFAULT_ZOOM = Number(process.env.MAP_MEDIA_DEFAULT_ZOOM || 10);
const MAP_MEDIA_BATCH_CONCURRENCY = Number(process.env.MAP_MEDIA_BATCH_CONCURRENCY || 2);
const MAP_MEDIA_CLUSTER_RADIUS = Number(process.env.MAP_MEDIA_CLUSTER_RADIUS || 56);
const MAP_MEDIA_CLUSTER_MAX_ZOOM = Number(process.env.MAP_MEDIA_CLUSTER_MAX_ZOOM || 17);
const MAP_MEDIA_CLUSTER_MIN_POINTS = Number(process.env.MAP_MEDIA_CLUSTER_MIN_POINTS || 2);
const MAP_MEDIA_EXPLOSION_MIN_RADIUS = Number(process.env.MAP_MEDIA_EXPLOSION_MIN_RADIUS || 58);
const MAP_MEDIA_EXPLOSION_MAX_RADIUS = Number(process.env.MAP_MEDIA_EXPLOSION_MAX_RADIUS || 190);
const MAP_MEDIA_EXPLOSION_MAX_VISIBLE_PHOTOS = Number(process.env.MAP_MEDIA_EXPLOSION_MAX_VISIBLE_PHOTOS || 36);
const MAP_MEDIA_EXPLOSION_COLLAPSE_PAN_THRESHOLD = Number(process.env.MAP_MEDIA_EXPLOSION_COLLAPSE_PAN_THRESHOLD || 72);
const MAP_MEDIA_EXPLOSION_COLLAPSE_ZOOM_THRESHOLD = Number(process.env.MAP_MEDIA_EXPLOSION_COLLAPSE_ZOOM_THRESHOLD || 0.35);
const USER_DRIVE_MIME_BY_EXT = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
  '.txt': ['text/plain', 'application/octet-stream'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.mp4': ['video/mp4', 'application/octet-stream'],
  '.mov': ['video/quicktime', 'video/mp4', 'application/octet-stream'],
  '.webm': ['video/webm', 'application/octet-stream'],
  '.zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
};
const CALENDAR_TEXT_ATTACHMENT_EXTENSIONS = new Set(['.txt', '.csv']);
const PDF_EXPORT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

[DATA_DIR, TEMP_DIR, UPLOADS_DIR, CALENDAR_ATTACHMENTS_DIR, AVATARS_DIR, DOWNLOADS_FORMS_DIR, PROJECT_CLOSURE_ATTACHMENTS_DIR, USER_FEEDBACK_ATTACHMENTS_DIR, PROJECT_DOCUMENTATION_DIR, USER_DRIVE_DIR, MONITORING_ATTACHMENTS_DIR, MAP_MEDIA_ORIGINALS_DIR, MAP_MEDIA_THUMBNAILS_DIR, MAP_MEDIA_TEMP_DIR, MAP_ZONING_TILE_CACHE_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const getDownloadsFormsShareSecret = () => {
  if (process.env.DOWNLOADS_FORMS_SHARE_SECRET) return process.env.DOWNLOADS_FORMS_SHARE_SECRET;
  if (!fs.existsSync(DOWNLOADS_FORMS_SHARE_SECRET_PATH)) {
    fs.writeFileSync(DOWNLOADS_FORMS_SHARE_SECRET_PATH, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  }
  return fs.readFileSync(DOWNLOADS_FORMS_SHARE_SECRET_PATH, 'utf8').trim();
};

const DOWNLOADS_FORMS_SHARE_SECRET = getDownloadsFormsShareSecret();
const DOWNLOADS_FORMS_SHARED_DOWNLOAD_DEDUPE_MS = 30 * 1000;
const downloadsFormsSharedDownloadClaims = new Map();
const signDownloadsFormsShare = (id, expires) => crypto
  .createHmac('sha256', DOWNLOADS_FORMS_SHARE_SECRET)
  .update(`${Number(id)}.${Number(expires)}`)
  .digest('hex');

const isValidDownloadsFormsShare = (id, expires, signature) => {
  const expiresNumber = Number(expires);
  if (!Number.isInteger(expiresNumber) || expiresNumber <= Date.now()) return false;
  const expected = Buffer.from(signDownloadsFormsShare(id, expiresNumber), 'hex');
  const supplied = Buffer.from(String(signature || ''), 'hex');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
};

const claimDownloadsFormsSharedDownload = (req, id, signature) => {
  if (req.method !== 'GET') return false;
  const now = Date.now();
  const clientIp = getClientIp(req);
  const key = `${Number(id)}:${String(signature || '')}:${clientIp}`;
  const previousClaim = downloadsFormsSharedDownloadClaims.get(key) || 0;
  if (now - previousClaim < DOWNLOADS_FORMS_SHARED_DOWNLOAD_DEDUPE_MS) return false;

  downloadsFormsSharedDownloadClaims.set(key, now);
  if (downloadsFormsSharedDownloadClaims.size > 1000) {
    for (const [claimKey, claimedAt] of downloadsFormsSharedDownloadClaims) {
      if (now - claimedAt >= DOWNLOADS_FORMS_SHARED_DOWNLOAD_DEDUPE_MS) {
        downloadsFormsSharedDownloadClaims.delete(claimKey);
      }
    }
  }
  return true;
};

const getShareOrigin = (req) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const requestHost = forwardedHost || req.get('host') || `localhost:${PORT}`;
  const [hostname, port] = requestHost.split(':');
  const localOnly = ['localhost', '127.0.0.1', '::1'].includes(String(hostname).toLowerCase());
  return `${protocol}://${localOnly ? getLocalIP() : hostname}${port ? `:${port}` : ''}`;
};

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});

const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) return cb(new Error('Invalid file type. Allowed files: PDF, JPG/JPEG, and PNG only.'), false);
    cb(null, true);
  }
});

const db = new sqlite3.Database(DB_PATH);

// SQLite concurrency optimization - configure busy timeout immediately
db.configure('busyTimeout', 10000);

// SQLite concurrency optimization and performance settings
db.serialize(() => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
    PRAGMA busy_timeout = 10000;
  `, (err) => {
    if (err) {
      console.error('SQLite PRAGMA initialization failed:', err);
    } else {
      console.log('SQLite WAL mode enabled.');
    }
  });
});

// SQLite error logging
db.on('error', (err) => {
  console.error('SQLite error:', err);
  if (err.code === 'SQLITE_BUSY') {
    console.error('SQLite BUSY - database locked by another operation');
  } else if (err.code === 'SQLITE_LOCKED') {
    console.error('SQLite LOCKED - table locked by another operation');
  }
});

const SESSION_ABSOLUTE_EXPIRY_HOURS = 9; // Session expires after 9 hours from login
const SESSION_INACTIVITY_EXPIRY_HOURS = 1; // Session expires after 1 hour of inactivity
const MOBILE_SESSION_EXPIRY_DAYS = 30; // GeoCamera mobile sessions expire after 1 month
const MOBILE_SESSION_MIN_EXPIRY_HOURS = 24;
