const MAP_CHIRPS_VERSION = '3.0';
const MAP_CHIRPS_DATASET_LABEL = 'CHIRPS v3 Final Daily (RNL)';
const MAP_CHIRPS_MIN_DATE = '1981-01-01';
const MAP_CHIRPS_MAX_RANGE_DAYS = Math.max(31, Number(process.env.MAP_CHIRPS_MAX_RANGE_DAYS || 1826));
const MAP_CHIRPS_TILE_SIZE = 256;
const MAP_CHIRPS_MIN_ZOOM = 5;
const MAP_CHIRPS_MAX_ZOOM = 12;
const MAP_CHIRPS_BOUNDS = Object.freeze({ west: 116.0, south: 4.0, east: 127.0, north: 22.0 });
const MAP_CHIRPS_CACHE_DIR = path.join(DATA_DIR, 'map-chirps');
const MAP_CHIRPS_DATASET_CACHE_DIR = path.join(MAP_CHIRPS_CACHE_DIR, 'datasets');
const MAP_CHIRPS_TILE_CACHE_DIR = path.join(MAP_CHIRPS_CACHE_DIR, 'tiles');
const MAP_CHIRPS_COVERAGE_VERSION = 'philippines-v1';
const MAP_CHIRPS_PALETTE_VERSION = 'purple-v1';
const MAP_CHIRPS_AVAILABILITY_TTL_MS = 6 * 60 * 60 * 1000;
const MAP_CHIRPS_AVAILABILITY_TIMEOUT_MS = Math.max(3000, Number(process.env.MAP_CHIRPS_AVAILABILITY_TIMEOUT_MS || 8000));
const MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS = Math.max(7, Number(process.env.MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS || 120));
const MAP_CHIRPS_BUILD_TIMEOUT_MS = Math.max(30000, Number(process.env.MAP_CHIRPS_BUILD_TIMEOUT_MS || 180000));
const MAP_CHIRPS_FETCH_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.MAP_CHIRPS_FETCH_CONCURRENCY || 4)));
const MAP_CHIRPS_MAX_CACHED_RANGES = Math.max(4, Number(process.env.MAP_CHIRPS_MAX_CACHED_RANGES || 24));
const MAP_CHIRPS_COLOR_STOPS = Object.freeze([
  [0, [0, 0, 0, 0]],
  [1, [224, 247, 250, 255]],
  [10, [128, 222, 234, 255]],
  [25, [38, 198, 218, 255]],
  [50, [30, 136, 229, 255]],
  [100, [63, 81, 181, 255]],
  [200, [123, 31, 162, 255]]
]);

const ensureMapChirpsCacheDirs = () => {
  [MAP_CHIRPS_CACHE_DIR, MAP_CHIRPS_DATASET_CACHE_DIR, MAP_CHIRPS_TILE_CACHE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

let mapChirpsAvailabilityCache = null;
let mapChirpsGeoTiffModulePromise = null;
let mapChirpsTransparentTilePromise = null;
const mapChirpsDatasetCache = new Map();
const mapChirpsDatasetBuilds = new Map();
const mapChirpsTileRenders = new Map();
const mapChirpsSeriesCache = new Map();

const mapChirpsIsoDate = value => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
};

const mapChirpsDate = value => new Date(`${value}T00:00:00.000Z`);
const mapChirpsDateText = date => date.toISOString().slice(0, 10);
const mapChirpsAddDays = (value, days) => {
  const date = mapChirpsDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return mapChirpsDateText(date);
};
const mapChirpsRangeDays = (start, end) => Math.floor((mapChirpsDate(end) - mapChirpsDate(start)) / 86400000) + 1;
const mapChirpsMonthEnd = value => {
  const date = mapChirpsDate(value);
  return mapChirpsDateText(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
};
const mapChirpsIsMonthStart = value => value.endsWith('-01');

const mapChirpsDailyUrl = dateText => {
  const [year, month, day] = dateText.split('-');
  return `https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/final/rnl/${year}/chirps-v3.0.rnl.${year}.${month}.${day}.tif`;
};

const mapChirpsMonthlyUrl = dateText => {
  const [year, month] = dateText.split('-');
  return `https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/chirps-v3.0.${year}.${month}.cog`;
};

const mapChirpsAvailabilityFromDirectory = async year => {
  const response = await fetch(`https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/final/rnl/${year}/`, {
    headers: { 'User-Agent': 'ABEARC-CHIRPS/1.0' },
    signal: AbortSignal.timeout(MAP_CHIRPS_AVAILABILITY_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`CHIRPS directory returned HTTP ${response.status}.`);
  const html = await response.text();
  const matches = [...html.matchAll(/chirps-v3\.0\.rnl\.(\d{4})\.(\d{2})\.(\d{2})\.tif/gi)]
    .map(match => `${match[1]}-${match[2]}-${match[3]}`)
    .filter(mapChirpsIsoDate)
    .sort();
  return matches.at(-1) || null;
};

const mapChirpsLatestCachedDate = async () => {
  ensureMapChirpsCacheDirs();
  try {
    const dates = (await fs.promises.readdir(MAP_CHIRPS_DATASET_CACHE_DIR))
      .map(name => name.match(/^philippines-v1_\d{4}-\d{2}-\d{2}_(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
      .filter(Boolean)
      .sort();
    return dates.at(-1) || null;
  } catch (_) {
    return null;
  }
};

const getMapChirpsAvailability = async (force = false) => {
  if (!force && mapChirpsAvailabilityCache && Date.now() - mapChirpsAvailabilityCache.checkedAt < MAP_CHIRPS_AVAILABILITY_TTL_MS) {
    return mapChirpsAvailabilityCache;
  }
  const now = new Date();
  let latestDate = null;
  let lastError = null;
  for (const year of [now.getUTCFullYear(), now.getUTCFullYear() - 1]) {
    try {
      latestDate = await mapChirpsAvailabilityFromDirectory(year);
      if (latestDate) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!latestDate) {
    latestDate = await mapChirpsLatestCachedDate();
    if (!latestDate) {
      const error = new Error(lastError?.message || 'Unable to determine the latest CHIRPS final date.');
      error.statusCode = 503;
      throw error;
    }
  }
  mapChirpsAvailabilityCache = { minDate: MAP_CHIRPS_MIN_DATE, latestDate, checkedAt: Date.now() };
  return mapChirpsAvailabilityCache;
};

const validateMapChirpsRange = async (startValue, endValue, options = {}) => {
  const start = mapChirpsIsoDate(startValue);
  const end = mapChirpsIsoDate(endValue);
  if (!start || !end) {
    const error = new Error('Choose valid CHIRPS start and end dates.');
    error.statusCode = 400;
    throw error;
  }
  if (start > end) {
    const error = new Error('The CHIRPS start date must not be after the end date.');
    error.statusCode = 400;
    throw error;
  }
  const days = mapChirpsRangeDays(start, end);
  if (days > MAP_CHIRPS_MAX_RANGE_DAYS) {
    const error = new Error(`The selected CHIRPS range exceeds the ${MAP_CHIRPS_MAX_RANGE_DAYS}-day limit.`);
    error.statusCode = 400;
    throw error;
  }
  if (start < MAP_CHIRPS_MIN_DATE) {
    const error = new Error(`CHIRPS v3 begins on ${MAP_CHIRPS_MIN_DATE}.`);
    error.statusCode = 400;
    throw error;
  }
  if (!options.skipAvailability) {
    const availability = await getMapChirpsAvailability();
    if (end > availability.latestDate) {
      const error = new Error(`Final CHIRPS data is currently available through ${availability.latestDate}.`);
      error.statusCode = 400;
      throw error;
    }
  }
  return { start, end, days };
};

const mapChirpsGranules = (start, end) => {
  const granules = [];
  let cursor = start;
  while (cursor <= end) {
    const monthEnd = mapChirpsMonthEnd(cursor);
    if (mapChirpsIsMonthStart(cursor) && monthEnd <= end) {
      granules.push({ type: 'monthly', start: cursor, end: monthEnd, url: mapChirpsMonthlyUrl(cursor) });
      cursor = mapChirpsAddDays(monthEnd, 1);
    } else {
      granules.push({ type: 'daily', start: cursor, end: cursor, url: mapChirpsDailyUrl(cursor) });
      cursor = mapChirpsAddDays(cursor, 1);
    }
  }
  return granules;
};

const mapChirpsWindow = image => {
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  const xValues = [MAP_CHIRPS_BOUNDS.west, MAP_CHIRPS_BOUNDS.east].map(value => (value - originX) / resolutionX);
  const yValues = [MAP_CHIRPS_BOUNDS.north, MAP_CHIRPS_BOUNDS.south].map(value => (value - originY) / resolutionY);
  const x0 = Math.max(0, Math.floor(Math.min(...xValues) + 1e-3));
  const x1 = Math.min(image.getWidth(), Math.ceil(Math.max(...xValues) - 1e-3));
  const y0 = Math.max(0, Math.floor(Math.min(...yValues) + 1e-3));
  const y1 = Math.min(image.getHeight(), Math.ceil(Math.max(...yValues) - 1e-3));
  if (x1 <= x0 || y1 <= y0) throw new Error('The CHIRPS raster does not cover the Philippines map extent.');
  return {
    window: [x0, y0, x1, y1],
    width: x1 - x0,
    height: y1 - y0,
    west: originX + x0 * resolutionX,
    north: originY + y0 * resolutionY,
    resolutionX,
    resolutionY
  };
};

const readMapChirpsGranule = async (granule, signal) => {
  mapChirpsGeoTiffModulePromise ||= import('geotiff');
  const { fromUrl } = await mapChirpsGeoTiffModulePromise;
  const tiff = await fromUrl(granule.url, { cacheSize: 64 }, signal);
  const image = await tiff.getImage();
  const grid = mapChirpsWindow(image);
  const [band] = await image.readRasters({ window: grid.window, samples: [0], signal });
  if (!band || band.length !== grid.width * grid.height) throw new Error(`CHIRPS returned incomplete data for ${granule.start}.`);
  const rawNoDataValue = image.getGDALNoData?.();
  const noDataValue = rawNoDataValue === null || rawNoDataValue === undefined || rawNoDataValue === ''
    ? null
    : Number(rawNoDataValue);
  return { granule, grid, values: band, noDataValue: Number.isFinite(noDataValue) ? noDataValue : null };
};

const mapChirpsDatasetKey = (start, end) => `${MAP_CHIRPS_COVERAGE_VERSION}_${start}_${end}`;
const mapChirpsDatasetPath = key => path.join(MAP_CHIRPS_DATASET_CACHE_DIR, `${key}.json`);
const mapChirpsTilePath = (key, z, x, y) => path.join(MAP_CHIRPS_TILE_CACHE_DIR, MAP_CHIRPS_PALETTE_VERSION, key, String(z), String(x), `${y}.png`);

const readCachedMapChirpsDataset = async key => {
  ensureMapChirpsCacheDirs();
  const filePath = mapChirpsDatasetPath(key);
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    if (!Array.isArray(parsed.values) || !parsed.width || !parsed.height || parsed.values.length !== parsed.width * parsed.height) return null;
    parsed.values = Float32Array.from(parsed.values, value => value === null ? Number.NaN : Number(value));
    return parsed;
  } catch (_) {
    return null;
  }
};

const writeMapChirpsDataset = async dataset => {
  ensureMapChirpsCacheDirs();
  const filePath = mapChirpsDatasetPath(dataset.key);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify({
    ...dataset,
    values: Array.from(dataset.values, value => Number.isFinite(value) ? value : null)
  }));
  await fs.promises.rename(temporaryPath, filePath);
};

const trimMapChirpsMemoryCache = () => {
  while (mapChirpsDatasetCache.size > 8) mapChirpsDatasetCache.delete(mapChirpsDatasetCache.keys().next().value);
};

const pruneMapChirpsDiskCache = async currentKey => {
  ensureMapChirpsCacheDirs();
  try {
    const files = (await fs.promises.readdir(MAP_CHIRPS_DATASET_CACHE_DIR, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'));
    if (files.length <= MAP_CHIRPS_MAX_CACHED_RANGES) return;
    const ranked = await Promise.all(files.map(async entry => {
      const filePath = path.join(MAP_CHIRPS_DATASET_CACHE_DIR, entry.name);
      const stats = await fs.promises.stat(filePath);
      return { key: entry.name.slice(0, -5), filePath, modified: stats.mtimeMs };
    }));
    ranked.sort((a, b) => b.modified - a.modified);
    const expired = ranked
      .filter(item => item.key !== currentKey)
      .slice(Math.max(0, MAP_CHIRPS_MAX_CACHED_RANGES - 1));
    await Promise.all(expired.flatMap(item => [
      fs.promises.rm(item.filePath, { force: true }),
      fs.promises.rm(path.join(MAP_CHIRPS_TILE_CACHE_DIR, MAP_CHIRPS_PALETTE_VERSION, item.key), { recursive: true, force: true })
    ]));
  } catch (error) {
    console.warn('Unable to prune CHIRPS cache:', error.message);
  }
};

const buildMapChirpsDataset = async range => {
  const granules = mapChirpsGranules(range.start, range.end);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAP_CHIRPS_BUILD_TIMEOUT_MS);
  try {
    const results = new Array(granules.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(MAP_CHIRPS_FETCH_CONCURRENCY, granules.length) }, async () => {
      while (cursor < granules.length) {
        const index = cursor++;
        results[index] = await readMapChirpsGranule(granules[index], controller.signal);
      }
    });
    await Promise.all(workers);
    const baseGrid = results[0]?.grid;
    if (!baseGrid) throw new Error('CHIRPS did not return any raster data.');
    const values = new Float32Array(baseGrid.width * baseGrid.height);
    const validCounts = new Uint16Array(values.length);
    for (const result of results) {
      const grid = result.grid;
      if (grid.width !== baseGrid.width || grid.height !== baseGrid.height
          || Math.abs(grid.west - baseGrid.west) > 1e-7 || Math.abs(grid.north - baseGrid.north) > 1e-7
          || Math.abs(grid.resolutionX - baseGrid.resolutionX) > 1e-9 || Math.abs(grid.resolutionY - baseGrid.resolutionY) > 1e-9) {
        throw new Error('CHIRPS raster grids were inconsistent across the selected dates.');
      }
      for (let index = 0; index < values.length; index++) {
        const value = Number(result.values[index]);
        const invalid = !Number.isFinite(value) || value <= -9000
          || (result.noDataValue !== null && Math.abs(value - result.noDataValue) < 1e-6);
        if (!invalid) {
          values[index] += Math.max(0, value);
          validCounts[index]++;
        }
      }
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let validCells = 0;
    for (let index = 0; index < values.length; index++) {
      if (!validCounts[index]) {
        values[index] = Number.NaN;
        continue;
      }
      min = Math.min(min, values[index]);
      max = Math.max(max, values[index]);
      sum += values[index];
      validCells++;
    }
    const key = mapChirpsDatasetKey(range.start, range.end);
    const dataset = {
      key,
      start: range.start,
      end: range.end,
      days: range.days,
      width: baseGrid.width,
      height: baseGrid.height,
      west: baseGrid.west,
      north: baseGrid.north,
      resolutionX: baseGrid.resolutionX,
      resolutionY: baseGrid.resolutionY,
      values,
      stats: {
        min_mm: validCells ? min : null,
        max_mm: validCells ? max : null,
        mean_mm: validCells ? sum / validCells : null,
        valid_cells: validCells
      },
      granules: {
        total: granules.length,
        monthly: granules.filter(item => item.type === 'monthly').length,
        daily: granules.filter(item => item.type === 'daily').length
      },
      generated_at: new Date().toISOString()
    };
    await writeMapChirpsDataset(dataset);
    await pruneMapChirpsDiskCache(dataset.key);
    return dataset;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Preparing the CHIRPS rainfall layer timed out. Try a shorter date range.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getMapChirpsDataset = async (startValue, endValue) => {
  const range = await validateMapChirpsRange(startValue, endValue, { skipAvailability: true });
  const key = mapChirpsDatasetKey(range.start, range.end);
  if (mapChirpsDatasetCache.has(key)) return mapChirpsDatasetCache.get(key);
  if (mapChirpsDatasetBuilds.has(key)) return mapChirpsDatasetBuilds.get(key);
  const build = (async () => {
    const cached = await readCachedMapChirpsDataset(key);
    if (cached) {
      mapChirpsDatasetCache.set(key, cached);
      trimMapChirpsMemoryCache();
      return cached;
    }
    await validateMapChirpsRange(range.start, range.end);
    const dataset = await buildMapChirpsDataset(range);
    mapChirpsDatasetCache.set(key, dataset);
    trimMapChirpsMemoryCache();
    return dataset;
  })().finally(() => mapChirpsDatasetBuilds.delete(key));
  mapChirpsDatasetBuilds.set(key, build);
  return build;
};

const mapChirpsTileLongitude = (tileX, zoom) => tileX / (2 ** zoom) * 360 - 180;
const mapChirpsTileLatitude = (tileY, zoom) => {
  const value = Math.PI - 2 * Math.PI * tileY / (2 ** zoom);
  return 180 / Math.PI * Math.atan(Math.sinh(value));
};

const mapChirpsColor = value => {
  if (!Number.isFinite(value) || value < 0.1) return [0, 0, 0, 0];
  for (let index = 1; index < MAP_CHIRPS_COLOR_STOPS.length; index++) {
    const [upperValue, upperColor] = MAP_CHIRPS_COLOR_STOPS[index];
    const [lowerValue, lowerColor] = MAP_CHIRPS_COLOR_STOPS[index - 1];
    if (value <= upperValue) {
      const ratio = Math.max(0, Math.min(1, (value - lowerValue) / Math.max(0.0001, upperValue - lowerValue)));
      const color = upperColor.map((channel, channelIndex) => Math.round(lowerColor[channelIndex] + (channel - lowerColor[channelIndex]) * ratio));
      color[3] = 255;
      return color;
    }
  }
  return MAP_CHIRPS_COLOR_STOPS.at(-1)[1];
};

const getMapChirpsTransparentTile = () => {
  mapChirpsTransparentTilePromise ||= sharp({
    create: { width: MAP_CHIRPS_TILE_SIZE, height: MAP_CHIRPS_TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toBuffer();
  return mapChirpsTransparentTilePromise;
};

const renderMapChirpsTile = async (dataset, zoom, tileX, tileY) => {
  const west = mapChirpsTileLongitude(tileX, zoom);
  const east = mapChirpsTileLongitude(tileX + 1, zoom);
  const north = mapChirpsTileLatitude(tileY, zoom);
  const south = mapChirpsTileLatitude(tileY + 1, zoom);
  if (east <= MAP_CHIRPS_BOUNDS.west || west >= MAP_CHIRPS_BOUNDS.east
      || north <= MAP_CHIRPS_BOUNDS.south || south >= MAP_CHIRPS_BOUNDS.north) {
    return getMapChirpsTransparentTile();
  }
  const rgba = Buffer.alloc(MAP_CHIRPS_TILE_SIZE * MAP_CHIRPS_TILE_SIZE * 4);
  const worldSize = MAP_CHIRPS_TILE_SIZE * (2 ** zoom);
  for (let pixelY = 0; pixelY < MAP_CHIRPS_TILE_SIZE; pixelY++) {
    const worldY = tileY * MAP_CHIRPS_TILE_SIZE + pixelY + 0.5;
    const latitude = 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / worldSize)));
    if (latitude < MAP_CHIRPS_BOUNDS.south || latitude > MAP_CHIRPS_BOUNDS.north) continue;
    const row = Math.floor((latitude - dataset.north) / dataset.resolutionY);
    if (row < 0 || row >= dataset.height) continue;
    for (let pixelX = 0; pixelX < MAP_CHIRPS_TILE_SIZE; pixelX++) {
      const longitude = (tileX * MAP_CHIRPS_TILE_SIZE + pixelX + 0.5) / worldSize * 360 - 180;
      if (longitude < MAP_CHIRPS_BOUNDS.west || longitude > MAP_CHIRPS_BOUNDS.east) continue;
      const column = Math.floor((longitude - dataset.west) / dataset.resolutionX);
      if (column < 0 || column >= dataset.width) continue;
      const color = mapChirpsColor(dataset.values[row * dataset.width + column]);
      const offset = (pixelY * MAP_CHIRPS_TILE_SIZE + pixelX) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }
  return sharp(rgba, { raw: { width: MAP_CHIRPS_TILE_SIZE, height: MAP_CHIRPS_TILE_SIZE, channels: 4 } })
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toBuffer();
};

const getMapChirpsTile = async (startValue, endValue, zoomValue, tileXValue, tileYValue) => {
  const zoom = Number(zoomValue);
  const tileX = Number(tileXValue);
  const tileY = Number(tileYValue);
  const maxCoordinate = Number.isInteger(zoom) && zoom >= 0 ? 2 ** zoom : 0;
  if (!Number.isInteger(zoom) || zoom < MAP_CHIRPS_MIN_ZOOM || zoom > MAP_CHIRPS_MAX_ZOOM
      || !Number.isInteger(tileX) || !Number.isInteger(tileY)
      || tileX < 0 || tileY < 0 || tileX >= maxCoordinate || tileY >= maxCoordinate) {
    return getMapChirpsTransparentTile();
  }
  const dataset = await getMapChirpsDataset(startValue, endValue);
  ensureMapChirpsCacheDirs();
  const filePath = mapChirpsTilePath(dataset.key, zoom, tileX, tileY);
  if (fs.existsSync(filePath)) return fs.promises.readFile(filePath);
  const renderKey = `${dataset.key}/${zoom}/${tileX}/${tileY}`;
  if (mapChirpsTileRenders.has(renderKey)) return mapChirpsTileRenders.get(renderKey);
  const render = (async () => {
    const buffer = await renderMapChirpsTile(dataset, zoom, tileX, tileY);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(temporaryPath, buffer);
    await fs.promises.rename(temporaryPath, filePath);
    return buffer;
  })().finally(() => mapChirpsTileRenders.delete(renderKey));
  mapChirpsTileRenders.set(renderKey, render);
  return render;
};



const mapChirpsPointValue = async (granule, latitude, longitude, signal) => {
  mapChirpsGeoTiffModulePromise ||= import('geotiff');
  const { fromUrl } = await mapChirpsGeoTiffModulePromise;
  const tiff = await fromUrl(granule.url, { cacheSize: 16 }, signal);
  const image = await tiff.getImage();
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  const column = Math.floor((longitude - originX) / resolutionX);
  const row = Math.floor((latitude - originY) / resolutionY);
  if (column < 0 || column >= image.getWidth() || row < 0 || row >= image.getHeight()) return null;
  const [band] = await image.readRasters({ window: [column, row, column + 1, row + 1], samples: [0], signal });
  const value = Number(band?.[0]);
  const rawNoDataValue = image.getGDALNoData?.();
  const noDataValue = rawNoDataValue === null || rawNoDataValue === undefined || rawNoDataValue === '' ? null : Number(rawNoDataValue);
  if (!Number.isFinite(value) || value <= -9000 || (Number.isFinite(noDataValue) && Math.abs(value - noDataValue) < 1e-6)) return null;
  return Math.max(0, value);
};

const mapChirpsSeriesGranules = range => {
  if (range.days > MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS) return mapChirpsGranules(range.start, range.end);
  const granules = [];
  for (let cursor = range.start; cursor <= range.end; cursor = mapChirpsAddDays(cursor, 1)) {
    granules.push({ type: 'daily', start: cursor, end: cursor, url: mapChirpsDailyUrl(cursor) });
  }
  return granules;
};

const mapChirpsDatasetPointValue = (dataset, latitude, longitude) => {
  if (!dataset || !Number.isFinite(dataset.resolutionX) || !Number.isFinite(dataset.resolutionY)) return null;
  const column = Math.floor((longitude - dataset.west) / dataset.resolutionX);
  const row = Math.floor((latitude - dataset.north) / dataset.resolutionY);
  if (column < 0 || column >= dataset.width || row < 0 || row >= dataset.height) return null;
  const value = Number(dataset.values[row * dataset.width + column]);
  return Number.isFinite(value) ? Math.max(0, value) : null;
};

const mapChirpsCachedSeries = async (range, latitude, longitude) => {
  const dataset = await readCachedMapChirpsDataset(mapChirpsDatasetKey(range.start, range.end));
  const value = mapChirpsDatasetPointValue(dataset, latitude, longitude);
  if (value === null) return null;
  return {
    layer: 'chirps',
    latitude,
    longitude,
    start: range.start,
    end: range.end,
    units: 'mm',
    dataset_label: 'CHIRPS precipitation',
    source: 'Prepared CHIRPS v3 overlay cache',
    source_url: 'https://www.chc.ucsb.edu/data/chirps',
    series_resolution: 'selected-range total (prepared map data)',
    points: [{
      start: range.start,
      end: range.end,
      period: range.start === range.end ? range.start : `${range.start} to ${range.end}`,
      precipitation_mm: Number(value.toFixed(3)),
      resolution: 'selected-range-total'
    }]
  };
};

const mapChirpsClimateServDate = value => {
  const [year, month, day] = String(value).split('-');
  return `${month}/${day}/${year}`;
};

const mapChirpsClimateServFetch = async url => fetch(url, {
  headers: { 'User-Agent': 'ABEARC-CHIRPS/1.0' },
  signal: AbortSignal.timeout(30000)
});

const mapChirpsClimateServDailySeries = async (range, latitude, longitude) => {
  const halfCell = 0.025;
  const geometry = {
    type: 'Polygon',
    coordinates: [[
      [longitude - halfCell, latitude - halfCell],
      [longitude - halfCell, latitude + halfCell],
      [longitude + halfCell, latitude + halfCell],
      [longitude + halfCell, latitude - halfCell],
      [longitude - halfCell, latitude - halfCell]
    ]]
  };
  const params = new URLSearchParams({
    datatype: '0',
    begintime: mapChirpsClimateServDate(range.start),
    endtime: mapChirpsClimateServDate(range.end),
    intervaltype: '0',
    operationtype: '5',
    dateType_Category: 'default',
    isZip_CurrentDataType: 'false',
    geometry: JSON.stringify(geometry)
  });
  const baseUrl = 'https://climateserv.servirglobal.net/chirps';
  const submitResponse = await mapChirpsClimateServFetch(`${baseUrl}/submitDataRequest/?${params.toString()}`);
  if (!submitResponse.ok) throw new Error(`ClimateSERV submitted the CHIRPS graph with HTTP ${submitResponse.status}.`);
  const submitted = await submitResponse.json();
  const requestId = Array.isArray(submitted) ? String(submitted[0] || '') : String(submitted?.id || '');
  if (!/^[0-9a-f-]{30,}$/i.test(requestId)) throw new Error('ClimateSERV did not return a CHIRPS graph request ID.');
  let completed = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const progressResponse = await mapChirpsClimateServFetch(`${baseUrl}/getDataRequestProgress/?id=${encodeURIComponent(requestId)}`);
    if (!progressResponse.ok) throw new Error(`ClimateSERV graph progress returned HTTP ${progressResponse.status}.`);
    const progressPayload = await progressResponse.json();
    const progress = Number(Array.isArray(progressPayload) ? progressPayload[0] : progressPayload);
    if (progress < 0) throw new Error('ClimateSERV could not process the CHIRPS point graph.');
    if (progress >= 100) { completed = true; break; }
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  if (!completed) throw new Error('ClimateSERV timed out while preparing the CHIRPS point graph.');
  const dataResponse = await mapChirpsClimateServFetch(`${baseUrl}/getDataFromRequest/?id=${encodeURIComponent(requestId)}`);
  if (!dataResponse.ok) throw new Error(`ClimateSERV graph data returned HTTP ${dataResponse.status}.`);
  const payload = await dataResponse.json();
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const daily = records.map(record => {
    const year = Number(record?.year);
    const month = Number(record?.month);
    const day = Number(record?.day);
    const value = Number(record?.value?.avg ?? record?.raw_value);
    if (!year || !month || !day) return null;
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      start: date,
      end: date,
      period: date,
      precipitation_mm: Number.isFinite(value) ? Number(Math.max(0, value).toFixed(3)) : null,
      resolution: 'daily'
    };
  }).filter(Boolean).filter(point => point.start >= range.start && point.start <= range.end);
  if (!daily.length) throw new Error('ClimateSERV returned no CHIRPS records for the selected point and dates.');
  if (range.days <= MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS) return daily;
  const monthly = new Map();
  daily.forEach(point => {
    const month = point.start.slice(0, 7);
    if (!monthly.has(month)) monthly.set(month, []);
    monthly.get(month).push(point);
  });
  return [...monthly.entries()].map(([month, values]) => {
    const valid = values.map(item => item.precipitation_mm).filter(Number.isFinite);
    return {
      start: values[0].start,
      end: values.at(-1).end,
      period: month,
      precipitation_mm: valid.length ? Number(valid.reduce((sum, value) => sum + value, 0).toFixed(3)) : null,
      resolution: 'monthly-total'
    };
  });
};

const mapChirpsClimateServSeries = async (range, latitude, longitude) => ({
  layer: 'chirps',
  latitude,
  longitude,
  start: range.start,
  end: range.end,
  units: 'mm',
  dataset_label: 'CHIRPS precipitation',
  source: 'ClimateSERV UCSB CHIRPS',
  source_url: 'https://climateserv.servirglobal.net/',
  series_resolution: range.days <= MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS ? 'daily' : 'monthly totals',
  points: await mapChirpsClimateServDailySeries(range, latitude, longitude)
});

const getMapChirpsSeries = async (startValue, endValue, latitudeValue, longitudeValue) => {
  const range = await validateMapChirpsRange(startValue, endValue);
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || latitude < MAP_CHIRPS_BOUNDS.south || latitude > MAP_CHIRPS_BOUNDS.north
      || !Number.isFinite(longitude) || longitude < MAP_CHIRPS_BOUNDS.west || longitude > MAP_CHIRPS_BOUNDS.east) {
    const error = new Error('Choose a point within the Philippines climate layer extent.');
    error.statusCode = 400;
    throw error;
  }
  const cacheKey = `${range.start}_${range.end}_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  if (mapChirpsSeriesCache.has(cacheKey)) return mapChirpsSeriesCache.get(cacheKey);
  const granules = mapChirpsSeriesGranules(range);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAP_CHIRPS_BUILD_TIMEOUT_MS);
  try {
    const points = new Array(granules.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(MAP_CHIRPS_FETCH_CONCURRENCY, granules.length) }, async () => {
      while (cursor < granules.length) {
        const index = cursor++;
        const granule = granules[index];
        const value = await mapChirpsPointValue(granule, latitude, longitude, controller.signal);
        points[index] = {
          start: granule.start,
          end: granule.end,
          period: granule.start === granule.end ? granule.start : `${granule.start} to ${granule.end}`,
          precipitation_mm: value === null ? null : Number(value.toFixed(3)),
          resolution: granule.type === 'daily' ? 'daily' : 'monthly-total'
        };
      }
    });
    await Promise.all(workers);
    const result = {
      layer: 'chirps',
      latitude,
      longitude,
      start: range.start,
      end: range.end,
      units: 'mm',
      dataset_label: 'CHIRPS precipitation',
      source: 'CHIRPS v3 / Climate Hazards Center, UC Santa Barbara',
      source_url: 'https://www.chc.ucsb.edu/data/chirps',
      series_resolution: range.days <= MAP_CHIRPS_SERIES_DAILY_THRESHOLD_DAYS ? 'daily' : 'monthly totals with daily partial months',
      points
    };
    mapChirpsSeriesCache.set(cacheKey, result);
    while (mapChirpsSeriesCache.size > 48) mapChirpsSeriesCache.delete(mapChirpsSeriesCache.keys().next().value);
    return result;
  } catch (error) {
    // The CHC download host may reject the many range reads used by a point
    // series. ClimateSERV provides the supported CHIRPS time-series workflow.
    try {
      const climateServResult = await mapChirpsClimateServSeries(range, latitude, longitude);
      mapChirpsSeriesCache.set(cacheKey, climateServResult);
      while (mapChirpsSeriesCache.size > 48) mapChirpsSeriesCache.delete(mapChirpsSeriesCache.keys().next().value);
      return climateServResult;
    } catch (climateServError) {
      console.warn('Unable to prepare CHIRPS point graph through ClimateSERV:', climateServError.message);
    }
    // Last-resort continuity for an upstream outage. This is explicitly a
    // selected-range total rather than a fabricated multi-point series.
    const cachedResult = await mapChirpsCachedSeries(range, latitude, longitude);
    if (cachedResult) {
      mapChirpsSeriesCache.set(cacheKey, cachedResult);
      return cachedResult;
    }
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      const timeoutError = new Error('Preparing the CHIRPS point graph timed out. Try a shorter date range.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getMapChirpsConfig = async () => {
  const availability = await getMapChirpsAvailability();
  const defaultEnd = availability.latestDate;
  const defaultStart = mapChirpsAddDays(defaultEnd, -29) < MAP_CHIRPS_MIN_DATE
    ? MAP_CHIRPS_MIN_DATE
    : mapChirpsAddDays(defaultEnd, -29);
  return {
    version: MAP_CHIRPS_VERSION,
    dataset: MAP_CHIRPS_DATASET_LABEL,
    min_date: availability.minDate,
    latest_date: availability.latestDate,
    default_start: defaultStart,
    default_end: defaultEnd,
    max_range_days: MAP_CHIRPS_MAX_RANGE_DAYS,
    resolution_degrees: 0.05,
    units: 'mm accumulated precipitation',
    bounds: [MAP_CHIRPS_BOUNDS.west, MAP_CHIRPS_BOUNDS.south, MAP_CHIRPS_BOUNDS.east, MAP_CHIRPS_BOUNDS.north],
    min_zoom: MAP_CHIRPS_MIN_ZOOM,
    max_zoom: MAP_CHIRPS_MAX_ZOOM,
    color_stops: MAP_CHIRPS_COLOR_STOPS.map(([value, color]) => ({ value, color }))
  };
};
