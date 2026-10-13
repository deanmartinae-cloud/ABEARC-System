const ORTHOMOSAIC_STAGE_TTL_MS = 24 * 60 * 60 * 1000;
const ORTHOMOSAIC_TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X4nHCwAAAABJRU5ErkJggg==', 'base64');
const orthomosaicTileJobs = new Map();
const orthomosaicCancelledIds = new Set();
let orthomosaicProcessingQueue = Promise.resolve();

const orthomosaicGdalBinDir = (() => {
  const configured = String(process.env.GDAL_BIN_DIR || '').trim();
  if (configured) return configured;
  if (process.platform !== 'win32') return '';
  const installed = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'GDAL');
  return fs.existsSync(path.join(installed, 'gdalinfo.exe')) ? installed : '';
})();

const orthomosaicGdalEnvironment = () => {
  if (!orthomosaicGdalBinDir) return process.env;
  return {
    ...process.env,
    PATH: `${orthomosaicGdalBinDir}${path.delimiter}${process.env.PATH || ''}`,
    GDAL_DATA: process.env.GDAL_DATA || path.join(orthomosaicGdalBinDir, 'gdal-data'),
    GDAL_DRIVER_PATH: process.env.GDAL_DRIVER_PATH || path.join(orthomosaicGdalBinDir, 'gdalplugins'),
    PROJ_LIB: process.env.PROJ_LIB || path.join(orthomosaicGdalBinDir, 'projlib')
  };
};

const runOrthomosaicCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
  const executable = orthomosaicGdalBinDir ? path.join(orthomosaicGdalBinDir, `${command}.exe`) : command;
  execFile(executable, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024, env: orthomosaicGdalEnvironment(), ...options }, (error, stdout, stderr) => {
    if (error) {
      const detail = String(stderr || error.message || '').trim();
      error.message = detail || error.message;
      return reject(error);
    }
    resolve(stdout);
  });
});

const getOrthomosaicGdalInfo = async (filePath) => {
  try {
    return JSON.parse(await runOrthomosaicCommand('gdalinfo', ['-json', '-mdd', 'all', filePath]));
  } catch (error) {
    if (error.code === 'ENOENT') {
      const unavailable = new Error('GeoTIFF processing is unavailable because GDAL is not installed on this server.');
      unavailable.statusCode = 503;
      throw unavailable;
    }
    throw error;
  }
};

const getOrthomosaicCoverageAreaHa = async (row, filePath) => {
  const info = JSON.parse(await runOrthomosaicCommand('gdalinfo', ['-json', '-approx_stats', filePath]));
  const alpha = (info.bands || []).find(band => band.colorInterpretation === 'Alpha');
  const alphaMean = Number(alpha?.mean ?? alpha?.metadata?.['']?.STATISTICS_MEAN ?? 255);
  const coverageRatio = Math.max(0, Math.min(1, alphaMean / 255));
  const nativeArea = Number(row.raster_width) * Number(row.raster_height)
    * Number(row.pixel_resolution_x) * Number(row.pixel_resolution_y);
  if (nativeArea > 0 && /^EPSG:32[67]\d{2}$/.test(String(row.source_epsg || ''))) {
    return nativeArea * coverageRatio / 10000;
  }
  const transform = (info.geoTransform || []).map(Number);
  const width = Number(info.size?.[0]);
  const height = Number(info.size?.[1]);
  const pixelArea = transform.length === 6 ? Math.abs(transform[1] * transform[5] - transform[2] * transform[4]) : 0;
  const latitudeScale = Math.cos(Number(row.center_lat || 0) * Math.PI / 180) ** 2;
  return width > 0 && height > 0 && pixelArea > 0
    ? width * height * pixelArea * latitudeScale * coverageRatio / 10000
    : null;
};

const parseOrthomosaicDate = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/(19|20)\d{2}[-/:]\d{2}[-/:]\d{2}/);
  if (!match) return '';
  const normalized = match[0].replace(/[/:]/g, '-');
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? normalized : '';
};

const flattenOrthomosaicMetadata = (value, prefix = '', rows = []) => {
  if (value == null) return rows;
  if (typeof value !== 'object') {
    rows.push([prefix, String(value)]);
    return rows;
  }
  Object.entries(value).forEach(([key, child]) => flattenOrthomosaicMetadata(child, prefix ? `${prefix}.${key}` : key, rows));
  return rows;
};

const detectOrthomosaicDate = (info, fileLastModified = '') => {
  const rows = flattenOrthomosaicMetadata(info?.metadata || {});
  const priorities = [
    { source: 'orthomosaic_creation_metadata', pattern: /(ortho|stitch|mosaic|processing|production|generated|export).*(date|time)|(date|time).*(ortho|stitch|mosaic|processing|production|generated|export)/i },
    { source: 'survey_capture_metadata', pattern: /(survey|capture|acquisition|flight).*(date|time)|(date|time).*(survey|capture|acquisition|flight)/i },
    { source: 'embedded_file_metadata', pattern: /(create|creation|datetime|date_time|modified|timestamp|date)/i }
  ];
  for (const priority of priorities) {
    for (const [key, value] of rows) {
      if (!priority.pattern.test(key)) continue;
      const date = parseOrthomosaicDate(value);
      if (date) return { date, source: priority.source };
    }
  }
  const fallback = parseOrthomosaicDate(fileLastModified);
  return fallback ? { date: fallback, source: 'file_last_modified' } : { date: '', source: 'manual' };
};

const orthomosaicCoordinates = (geometry) => {
  const points = [];
  const walk = value => {
    if (Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      points.push([Number(value[0]), Number(value[1])]);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  walk(geometry?.coordinates || geometry);
  return points;
};

const orthomosaicBoundsFromInfo = (info) => {
  const points = orthomosaicCoordinates(info?.wgs84Extent);
  if (!points.length) return null;
  const lngs = points.map(point => point[0]);
  const lats = points.map(point => point[1]);
  return { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) };
};

const orthomosaicEpsgFromWkt = (wkt) => {
  const matches = [...String(wkt || '').matchAll(/ID\["EPSG",\s*(\d+)\]/g)];
  return matches.length ? `EPSG:${matches.at(-1)[1]}` : '';
};

const orthomosaicEpsgFromInfo = info => {
  const stacEpsg = Number(info?.stac?.['proj:epsg']);
  return Number.isInteger(stacEpsg) && stacEpsg > 0
    ? `EPSG:${stacEpsg}`
    : orthomosaicEpsgFromWkt(info?.coordinateSystem?.wkt);
};

const inspectOrthomosaicFile = async (filePath, fileLastModified = '') => {
  const info = await getOrthomosaicGdalInfo(filePath);
  const wkt = String(info?.coordinateSystem?.wkt || '');
  const geotransform = Array.isArray(info?.geoTransform) ? info.geoTransform.map(Number) : [];
  const sourceCorners = info?.cornerCoordinates || null;
  if (!wkt || geotransform.length !== 6 || !sourceCorners) {
    const error = new Error('This TIFF does not contain a valid coordinate reference system and affine georeferencing. Upload a GeoTIFF.');
    error.statusCode = 400;
    throw error;
  }
  const date = detectOrthomosaicDate(info, fileLastModified);
  const bounds = orthomosaicBoundsFromInfo(info);
  return {
    date: date.date,
    date_source: date.source,
    source_crs: wkt,
    source_epsg: orthomosaicEpsgFromInfo(info),
    source_bbox: sourceCorners,
    bounds,
    center: bounds ? [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2] : null,
    width: Number(info?.size?.[0] || 0),
    height: Number(info?.size?.[1] || 0),
    pixel_resolution_x: Math.abs(Number(geotransform[1] || 0)),
    pixel_resolution_y: Math.abs(Number(geotransform[5] || 0)),
    metadata: info?.metadata || {}
  };
};

const cleanOrthomosaicStages = () => {
  const cutoff = Date.now() - ORTHOMOSAIC_STAGE_TTL_MS;
  for (const name of fs.readdirSync(MAP_ORTHOMOSAIC_TEMP_DIR)) {
    const full = path.join(MAP_ORTHOMOSAIC_TEMP_DIR, name);
    try { if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true, recursive: true }); } catch (_) {}
  }
};

const orthomosaicDatasetDir = id => path.join(MAP_ORTHOMOSAIC_DIR, String(Number(id)));
const orthomosaicAbsolutePath = relativePath => {
  const full = path.resolve(DATA_DIR, String(relativePath || ''));
  const root = path.resolve(MAP_ORTHOMOSAIC_DIR);
  return full.startsWith(`${root}${path.sep}`) ? full : null;
};

const mercatorToLngLat = (x, y) => {
  const lng = Number(x) / 20037508.342789244 * 180;
  const lat = (2 * Math.atan(Math.exp(Number(y) / 6378137)) - Math.PI / 2) * 180 / Math.PI;
  return [lng, Math.max(-85.05112878, Math.min(85.05112878, lat))];
};

const processOrthomosaic = async (id, actor = {}) => {
  const row = await dbGet(`SELECT * FROM MapOrthomosaics WHERE id=?`, [id]);
  if (!row || orthomosaicCancelledIds.has(Number(id))) return;
  const original = orthomosaicAbsolutePath(row.original_path);
  const processedDir = path.join(orthomosaicDatasetDir(id), 'processed');
  const processed = path.join(processedDir, 'orthomosaic.cog.tif');
  const temporary = path.join(processedDir, 'orthomosaic.processing.tif');
  fs.mkdirSync(processedDir, { recursive: true });
  fs.rmSync(temporary, { force: true });
  try {
    if (!original || !fs.existsSync(original)) throw new Error('Original orthomosaic file is missing.');
    await runOrthomosaicCommand('gdalwarp', [
      '-overwrite', '-of', 'COG', '-t_srs', 'EPSG:3857', '-dstalpha', '-r', 'lanczos',
      '-wo', 'NUM_THREADS=ALL_CPUS', '-co', 'COMPRESS=DEFLATE', '-co', 'BIGTIFF=IF_SAFER',
      '-co', 'RESAMPLING=LANCZOS', original, temporary
    ]);
    if (orthomosaicCancelledIds.has(Number(id)) || !(await dbGet(`SELECT id FROM MapOrthomosaics WHERE id=?`, [id]))) {
      fs.rmSync(orthomosaicDatasetDir(id), { recursive: true, force: true });
      return;
    }
    fs.renameSync(temporary, processed);
    const info = await getOrthomosaicGdalInfo(processed);
    const corners = info.cornerCoordinates || {};
    const xs = Object.values(corners).filter(Array.isArray).map(point => Number(point[0])).filter(Number.isFinite);
    const ys = Object.values(corners).filter(Array.isArray).map(point => Number(point[1])).filter(Number.isFinite);
    if (!xs.length || !ys.length) throw new Error('Processed orthomosaic extent could not be determined.');
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const [west, south] = mercatorToLngLat(minX, minY);
    const [east, north] = mercatorToLngLat(maxX, maxY);
    const coverageAreaHa = await getOrthomosaicCoverageAreaHa(row, processed).catch(error => {
      logError('ORTHOMOSAIC_AREA_CALCULATION', error.message, error.stack);
      return null;
    });
    const relativeProcessed = path.relative(DATA_DIR, processed).replace(/\\/g, '/');
    await dbRun(`UPDATE MapOrthomosaics SET processed_path=?, west=?, south=?, east=?, north=?,
      mercator_min_x=?, mercator_min_y=?, mercator_max_x=?, mercator_max_y=?, center_lng=?, center_lat=?,
      coverage_area_ha=?, processing_status='ready', processing_error=NULL, updated_at=? WHERE id=?`, [
      relativeProcessed, west, south, east, north, minX, minY, maxX, maxY,
      (west + east) / 2, (south + north) / 2, coverageAreaHa, new Date().toISOString(), id
    ]);
    logActivity({ actorUserId: actor.id, actorUsername: actor.username || 'System', action: 'ORTHOMOSAIC_PROCESSING_COMPLETED', details: `${row.name} (#${id})` });
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    if (!orthomosaicCancelledIds.has(Number(id))) {
      await dbRun(`UPDATE MapOrthomosaics SET processing_status='failed', processing_error=?, updated_at=? WHERE id=?`, [String(error.message || 'Processing failed').slice(0, 1000), new Date().toISOString(), id]);
      logActivity({ actorUserId: actor.id, actorUsername: actor.username || 'System', action: 'ORTHOMOSAIC_PROCESSING_FAILED', details: `${row.name} (#${id}): ${String(error.message || 'Processing failed').slice(0, 500)}` });
    }
  }
};

const queueOrthomosaicProcessing = (id, actor = {}) => {
  orthomosaicProcessingQueue = orthomosaicProcessingQueue
    .then(() => processOrthomosaic(Number(id), actor))
    .catch(error => logError('ORTHOMOSAIC_PROCESSING_QUEUE', error.message, error.stack));
  return orthomosaicProcessingQueue;
};

const resumeOrthomosaicProcessing = async () => {
  const rows = await dbAll(`SELECT o.id, u.username FROM MapOrthomosaics o LEFT JOIN Users u ON u.id=o.uploaded_by_user_id WHERE o.processing_status='processing' ORDER BY o.id`);
  rows.forEach(row => queueOrthomosaicProcessing(row.id, { username: row.username || 'System' }));
};

const backfillOrthomosaicCoverageAreas = async () => {
  const rows = await dbAll(`SELECT * FROM MapOrthomosaics WHERE processing_status='ready' AND coverage_area_ha IS NULL ORDER BY id`);
  for (const row of rows) {
    const processed = orthomosaicAbsolutePath(row.processed_path);
    if (!processed || !fs.existsSync(processed)) continue;
    try {
      const area = await getOrthomosaicCoverageAreaHa(row, processed);
      if (Number.isFinite(area)) await dbRun(`UPDATE MapOrthomosaics SET coverage_area_ha=? WHERE id=?`, [area, row.id]);
    } catch (error) {
      logError('ORTHOMOSAIC_AREA_BACKFILL', error.message, error.stack);
    }
  }
};

const orthomosaicTileBounds = (z, x, y) => {
  const zoom = Number(z); const column = Number(x); const row = Number(y);
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 22 || !Number.isInteger(column) || !Number.isInteger(row)) return null;
  const count = 2 ** zoom;
  if (column < 0 || row < 0 || column >= count || row >= count) return null;
  const world = 20037508.342789244;
  return {
    minX: -world + column * (world * 2 / count), maxX: -world + (column + 1) * (world * 2 / count),
    maxY: world - row * (world * 2 / count), minY: world - (row + 1) * (world * 2 / count)
  };
};

const getOrthomosaicTile = async (orthomosaic, z, x, y) => {
  const bounds = orthomosaicTileBounds(z, x, y);
  if (!bounds) { const error = new Error('Invalid tile coordinates.'); error.statusCode = 400; throw error; }
  if (bounds.maxX <= Number(orthomosaic.mercator_min_x) || bounds.minX >= Number(orthomosaic.mercator_max_x)
      || bounds.maxY <= Number(orthomosaic.mercator_min_y) || bounds.minY >= Number(orthomosaic.mercator_max_y)) return ORTHOMOSAIC_TRANSPARENT_PNG;
  const processed = orthomosaicAbsolutePath(orthomosaic.processed_path);
  if (!processed || !fs.existsSync(processed)) { const error = new Error('Processed orthomosaic is unavailable.'); error.statusCode = 503; throw error; }
  const tile = path.join(orthomosaicDatasetDir(orthomosaic.id), 'tiles', String(z), String(x), `${y}.png`);
  if (fs.existsSync(tile)) return fs.readFileSync(tile);
  const key = `${orthomosaic.id}/${z}/${x}/${y}`;
  if (!orthomosaicTileJobs.has(key)) {
    orthomosaicTileJobs.set(key, (async () => {
      fs.mkdirSync(path.dirname(tile), { recursive: true });
      const temporary = `${tile}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp.png`;
      try {
        await runOrthomosaicCommand('gdal_translate', [
          '-of', 'PNG', '-projwin', String(bounds.minX), String(bounds.maxY), String(bounds.maxX), String(bounds.minY),
          '-outsize', '256', '256', '-r', 'lanczos', processed, temporary
        ], { env: { ...orthomosaicGdalEnvironment(), GDAL_PAM_ENABLED: 'NO' } });
        fs.renameSync(temporary, tile);
      } finally {
        fs.rmSync(temporary, { force: true });
        fs.rmSync(`${temporary}.aux.xml`, { force: true });
      }
      return fs.readFileSync(tile);
    })().finally(() => orthomosaicTileJobs.delete(key)));
  }
  return orthomosaicTileJobs.get(key);
};

const getOrthomosaicThumbnail = async orthomosaic => {
  const processed = orthomosaicAbsolutePath(orthomosaic.processed_path);
  if (!processed || !fs.existsSync(processed)) { const error = new Error('Processed orthomosaic is unavailable.'); error.statusCode = 503; throw error; }
  const thumbnail = path.join(orthomosaicDatasetDir(orthomosaic.id), 'thumbnail.png');
  if (fs.existsSync(thumbnail)) return fs.readFileSync(thumbnail);
  const minX = Number(orthomosaic.mercator_min_x); const minY = Number(orthomosaic.mercator_min_y);
  const maxX = Number(orthomosaic.mercator_max_x); const maxY = Number(orthomosaic.mercator_max_y);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) { const error = new Error('Orthomosaic bounds are unavailable.'); error.statusCode = 503; throw error; }
  const span = Math.max(maxX - minX, maxY - minY) * 1.06;
  const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2; const half = span / 2;
  const key = `thumbnail:${orthomosaic.id}`;
  if (!orthomosaicTileJobs.has(key)) {
    orthomosaicTileJobs.set(key, (async () => {
      const temporary = `${thumbnail}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp.png`;
      try {
        await runOrthomosaicCommand('gdal_translate', [
          '-of', 'PNG', '-projwin', String(centerX - half), String(centerY + half), String(centerX + half), String(centerY - half),
          '-outsize', '256', '256', '-r', 'lanczos', processed, temporary
        ], { env: { ...orthomosaicGdalEnvironment(), GDAL_PAM_ENABLED: 'NO' } });
        fs.renameSync(temporary, thumbnail);
      } finally {
        fs.rmSync(temporary, { force: true });
        fs.rmSync(`${temporary}.aux.xml`, { force: true });
      }
      return fs.readFileSync(thumbnail);
    })().finally(() => orthomosaicTileJobs.delete(key)));
  }
  return orthomosaicTileJobs.get(key);
};
