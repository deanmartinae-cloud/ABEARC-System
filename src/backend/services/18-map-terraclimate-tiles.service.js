const MAP_TERRACLIMATE_VERSION = '1.1';
const MAP_TERRACLIMATE_DATASET_LABEL = 'TerraClimate monthly temperature';
const MAP_TERRACLIMATE_MIN_DATE = '1958-01-01';
const MAP_TERRACLIMATE_MAX_RANGE_MONTHS = Math.max(12, Number(process.env.MAP_TERRACLIMATE_MAX_RANGE_MONTHS || 120));
const MAP_TERRACLIMATE_TILE_SIZE = 256;
const MAP_TERRACLIMATE_MIN_ZOOM = 5;
const MAP_TERRACLIMATE_MAX_ZOOM = 12;
const MAP_TERRACLIMATE_BOUNDS = Object.freeze({ west: 116.0, south: 4.0, east: 127.0, north: 22.0 });
const MAP_TERRACLIMATE_CACHE_DIR = path.join(DATA_DIR, 'map-terraclimate');
const MAP_TERRACLIMATE_DATASET_CACHE_DIR = path.join(MAP_TERRACLIMATE_CACHE_DIR, 'datasets');
const MAP_TERRACLIMATE_TILE_CACHE_DIR = path.join(MAP_TERRACLIMATE_CACHE_DIR, 'tiles');
const MAP_TERRACLIMATE_COVERAGE_VERSION = 'philippines-v1';
const MAP_TERRACLIMATE_AVAILABILITY_TTL_MS = 12 * 60 * 60 * 1000;
const MAP_TERRACLIMATE_REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.MAP_TERRACLIMATE_REQUEST_TIMEOUT_MS || 120000));
const MAP_TERRACLIMATE_AVAILABILITY_TIMEOUT_MS = Math.max(3000, Number(process.env.MAP_TERRACLIMATE_AVAILABILITY_TIMEOUT_MS || 8000));
const MAP_TERRACLIMATE_MAX_CACHED_RANGES = Math.max(4, Number(process.env.MAP_TERRACLIMATE_MAX_CACHED_RANGES || 16));
const MAP_TERRACLIMATE_COLOR_STOPS = Object.freeze([
  [10, [49, 54, 149, 255]],
  [16, [69, 117, 180, 255]],
  [20, [116, 173, 209, 255]],
  [24, [224, 243, 248, 255]],
  [27, [254, 224, 144, 255]],
  [30, [244, 109, 67, 255]],
  [34, [165, 0, 38, 255]],
  [40, [103, 0, 31, 255]]
]);

const ensureMapTerraClimateCacheDirs = () => {
  [MAP_TERRACLIMATE_CACHE_DIR, MAP_TERRACLIMATE_DATASET_CACHE_DIR, MAP_TERRACLIMATE_TILE_CACHE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

let mapTerraClimateAvailabilityCache = null;
let mapTerraClimateTransparentTilePromise = null;
const mapTerraClimateDatasetCache = new Map();
const mapTerraClimateDatasetBuilds = new Map();
const mapTerraClimateTileRenders = new Map();
const mapTerraClimateSeriesCache = new Map();

const mapTerraClimateIsoDate = value => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
};
const mapTerraClimateMonthKey = value => String(value || '').slice(0, 7);
const mapTerraClimateMonthDate = month => `${month}-01`;
const mapTerraClimateMonthEnd = month => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};
const mapTerraClimateAddMonths = (month, amount) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
};
const mapTerraClimateMonths = (start, end) => {
  const out = [];
  for (let month = mapTerraClimateMonthKey(start); month <= mapTerraClimateMonthKey(end); month = mapTerraClimateAddMonths(month, 1)) out.push(month);
  return out;
};

const mapTerraClimateFetch = async (url, options = {}, timeoutMs = MAP_TERRACLIMATE_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': 'ABEARC-TerraClimate/1.0', ...(options.headers || {}) }
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('TerraClimate data request timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const mapTerraClimateYearExists = async year => {
  const candidates = [
    `https://climate.northwestknowledge.net/TERRACLIMATE-DATA/TerraClimate_tmax_${year}.nc`,
    `https://thredds.northwestknowledge.net/thredds/fileServer/TERRACLIMATE_ALL/data/TerraClimate_tmax_${year}.nc`
  ];
  for (const url of candidates) {
    try {
      const response = await mapTerraClimateFetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } }, MAP_TERRACLIMATE_AVAILABILITY_TIMEOUT_MS);
      if (response.ok || response.status === 206) {
        try { await response.body?.cancel(); } catch (_) {}
        return true;
      }
    } catch (_) {}
  }
  return false;
};

const getMapTerraClimateAvailability = async (force = false) => {
  if (!force && mapTerraClimateAvailabilityCache && Date.now() - mapTerraClimateAvailabilityCache.checkedAt < MAP_TERRACLIMATE_AVAILABILITY_TTL_MS) {
    return mapTerraClimateAvailabilityCache;
  }
  const currentYear = new Date().getUTCFullYear();
  let latestYear = null;
  for (let year = currentYear; year >= currentYear - 3; year--) {
    if (await mapTerraClimateYearExists(year)) {
      latestYear = year;
      break;
    }
  }
  if (!latestYear) latestYear = Math.min(2025, currentYear - 1);
  mapTerraClimateAvailabilityCache = {
    minDate: MAP_TERRACLIMATE_MIN_DATE,
    latestDate: `${latestYear}-12-31`,
    checkedAt: Date.now()
  };
  return mapTerraClimateAvailabilityCache;
};

const validateMapTerraClimateRange = async (startValue, endValue, options = {}) => {
  const start = mapTerraClimateIsoDate(startValue);
  const end = mapTerraClimateIsoDate(endValue);
  if (!start || !end) {
    const error = new Error('Choose valid TerraClimate start and end dates.');
    error.statusCode = 400;
    throw error;
  }
  if (start > end) {
    const error = new Error('The TerraClimate start date must not be after the end date.');
    error.statusCode = 400;
    throw error;
  }
  const months = mapTerraClimateMonths(start, end);
  if (months.length > MAP_TERRACLIMATE_MAX_RANGE_MONTHS) {
    const error = new Error(`The selected TerraClimate range exceeds the ${MAP_TERRACLIMATE_MAX_RANGE_MONTHS}-month limit.`);
    error.statusCode = 400;
    throw error;
  }
  if (start < MAP_TERRACLIMATE_MIN_DATE) {
    const error = new Error(`TerraClimate data access begins on ${MAP_TERRACLIMATE_MIN_DATE}.`);
    error.statusCode = 400;
    throw error;
  }
  if (!options.skipAvailability) {
    const availability = await getMapTerraClimateAvailability();
    if (end > availability.latestDate) {
      const error = new Error(`TerraClimate data is currently available through ${availability.latestDate}.`);
      error.statusCode = 400;
      throw error;
    }
  }
  return { start, end, months };
};

const mapTerraClimateAlign4 = value => (value + 3) & ~3;
const mapTerraClimateNcTypeSize = type => ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 4, 6: 8 }[type] || 0);

const parseMapTerraClimateNetCdf = buffer => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32 || buffer.subarray(0, 3).toString('ascii') !== 'CDF') throw new Error('TerraClimate returned an unsupported NetCDF response.');
  const version = buffer[3];
  if (![1, 2].includes(version)) throw new Error(`Unsupported NetCDF format CDF-${version}.`);
  let offset = 4;
  const readU32 = () => { const value = buffer.readUInt32BE(offset); offset += 4; return value; };
  const readI16 = at => buffer.readInt16BE(at);
  const readI32 = at => buffer.readInt32BE(at);
  const readF32 = at => buffer.readFloatBE(at);
  const readF64 = at => buffer.readDoubleBE(at);
  const readName = () => {
    const length = readU32();
    const value = buffer.subarray(offset, offset + length).toString('utf8');
    offset += mapTerraClimateAlign4(length);
    return value;
  };
  const readTypedValuesAt = (type, count, at) => {
    const values = new Array(count);
    const size = mapTerraClimateNcTypeSize(type);
    for (let index = 0; index < count; index++) {
      const position = at + index * size;
      values[index] = type === 1 ? buffer.readInt8(position)
        : type === 2 ? buffer[position]
          : type === 3 ? readI16(position)
            : type === 4 ? readI32(position)
              : type === 5 ? readF32(position)
                : readF64(position);
    }
    return values;
  };
  const readAttributes = () => {
    const tag = readU32();
    const count = readU32();
    if (tag === 0 && count === 0) return {};
    if (tag !== 12) throw new Error('Invalid NetCDF attribute list.');
    const attributes = {};
    for (let index = 0; index < count; index++) {
      const name = readName();
      const type = readU32();
      const length = readU32();
      const size = mapTerraClimateNcTypeSize(type);
      if (!size) throw new Error(`Unsupported NetCDF attribute type ${type}.`);
      const start = offset;
      let value;
      if (type === 2) value = buffer.subarray(start, start + length).toString('utf8').replace(/\0+$/g, '');
      else {
        const values = readTypedValuesAt(type, length, start);
        value = values.length === 1 ? values[0] : values;
      }
      offset += mapTerraClimateAlign4(length * size);
      attributes[name] = value;
    }
    return attributes;
  };
  const numRecords = readU32();
  const dimensions = [];
  {
    const tag = readU32();
    const count = readU32();
    if (!(tag === 0 && count === 0)) {
      if (tag !== 10) throw new Error('Invalid NetCDF dimension list.');
      for (let index = 0; index < count; index++) dimensions.push({ name: readName(), size: readU32() });
    }
  }
  const globalAttributes = readAttributes();
  const variables = [];
  {
    const tag = readU32();
    const count = readU32();
    if (!(tag === 0 && count === 0)) {
      if (tag !== 11) throw new Error('Invalid NetCDF variable list.');
      for (let index = 0; index < count; index++) {
        const name = readName();
        const dimensionCount = readU32();
        const dimensionIds = Array.from({ length: dimensionCount }, () => readU32());
        const attributes = readAttributes();
        const type = readU32();
        const vsize = readU32();
        const begin = version === 1 ? readU32() : Number(buffer.readBigUInt64BE((offset += 8) - 8));
        variables.push({ name, dimensionIds, attributes, type, vsize, begin });
      }
    }
  }
  const recordVariables = variables.filter(variable => variable.dimensionIds.length && dimensions[variable.dimensionIds[0]]?.size === 0);
  const recordSize = recordVariables.reduce((sum, variable) => sum + variable.vsize, 0);
  const readVariable = name => {
    const variable = variables.find(item => item.name === name);
    if (!variable) return null;
    const dimensionsForVariable = variable.dimensionIds.map(id => dimensions[id]);
    const shape = dimensionsForVariable.map(dimension => dimension.size === 0 ? numRecords : dimension.size);
    const typeSize = mapTerraClimateNcTypeSize(variable.type);
    if (!typeSize) throw new Error(`Unsupported NetCDF variable type ${variable.type}.`);
    const isRecord = dimensionsForVariable[0]?.size === 0;
    let raw;
    if (!isRecord) {
      const count = shape.reduce((product, size) => product * size, 1);
      raw = readTypedValuesAt(variable.type, count, variable.begin);
    } else {
      const perRecord = shape.slice(1).reduce((product, size) => product * size, 1);
      raw = new Array(perRecord * numRecords);
      for (let record = 0; record < numRecords; record++) {
        const values = readTypedValuesAt(variable.type, perRecord, variable.begin + record * recordSize);
        for (let index = 0; index < values.length; index++) raw[record * perRecord + index] = values[index];
      }
    }
    const scale = Number(variable.attributes.scale_factor ?? 1);
    const addOffset = Number(variable.attributes.add_offset ?? 0);
    const fillValue = Number(variable.attributes._FillValue ?? variable.attributes.missing_value);
    const values = new Float64Array(raw.length);
    for (let index = 0; index < raw.length; index++) {
      const value = Number(raw[index]);
      values[index] = Number.isFinite(fillValue) && value === fillValue ? Number.NaN : value * (Number.isFinite(scale) ? scale : 1) + (Number.isFinite(addOffset) ? addOffset : 0);
    }
    return { name, shape, values, attributes: variable.attributes };
  };
  return { version, numRecords, dimensions, globalAttributes, variables, readVariable };
};

const mapTerraClimateNcssBases = variable => [
  year => `https://thredds.northwestknowledge.net/thredds/ncss/grid/TERRACLIMATE_ALL/data/TerraClimate_${variable}_${year}.nc`,
  year => `https://thredds.northwestknowledge.net/thredds/ncss/TERRACLIMATE_ALL/data/TerraClimate_${variable}_${year}.nc`,
  year => `http://thredds.northwestknowledge.net:8080/thredds/ncss/grid/TERRACLIMATE_ALL/data/TerraClimate_${variable}_${year}.nc`,
  year => `http://thredds.northwestknowledge.net:8080/thredds/ncss/TERRACLIMATE_ALL/data/TerraClimate_${variable}_${year}.nc`,
  year => `https://www.reacchpna.org/thredds/ncss/grid/TERRACLIMATE_ALL/data/TerraClimate_${variable}_${year}.nc`
];

const mapTerraClimateSubsetQuery = (variable, year, startMonth, endMonth, accept = 'netcdf', point = null) => {
  const params = new URLSearchParams({ var: variable, accept });
  params.set('time_start', `${startMonth}-01T00:00:00Z`);
  params.set('time_end', `${endMonth}-01T00:00:00Z`);
  if (point) {
    params.set('latitude', String(point.latitude));
    params.set('longitude', String(point.longitude));
  } else {
    params.set('north', String(MAP_TERRACLIMATE_BOUNDS.north));
    params.set('south', String(MAP_TERRACLIMATE_BOUNDS.south));
    params.set('west', String(MAP_TERRACLIMATE_BOUNDS.west));
    params.set('east', String(MAP_TERRACLIMATE_BOUNDS.east));
    params.set('disableProjSubset', 'on');
    params.set('horizStride', '1');
    params.set('addLatLon', 'true');
  }
  return params;
};

const fetchMapTerraClimateSubset = async (variable, year, startMonth, endMonth) => {
  let lastError = null;
  for (const baseFactory of mapTerraClimateNcssBases(variable)) {
    const url = `${baseFactory(year)}?${mapTerraClimateSubsetQuery(variable, year, startMonth, endMonth).toString()}`;
    try {
      const response = await mapTerraClimateFetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get('content-type') || '');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || (!contentType.includes('netcdf') && buffer.subarray(0, 3).toString('ascii') !== 'CDF')) throw new Error('Unexpected TerraClimate subset response.');
      return parseMapTerraClimateNetCdf(buffer);
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error(`Unable to download TerraClimate ${variable} data for ${year}: ${lastError?.message || 'service unavailable'}`);
  error.statusCode = lastError?.statusCode || 503;
  throw error;
};

const mapTerraClimateGridFromParsed = (parsed, variableName) => {
  const latVariable = parsed.readVariable('lat') || parsed.readVariable('latitude');
  const lonVariable = parsed.readVariable('lon') || parsed.readVariable('longitude');
  const dataVariable = parsed.readVariable(variableName);
  if (!latVariable || !lonVariable || !dataVariable) throw new Error(`TerraClimate ${variableName} subset was missing latitude, longitude, or temperature data.`);
  const latitudes = Array.from(latVariable.values);
  const longitudes = Array.from(lonVariable.values);
  const timeCount = dataVariable.shape.length >= 3 ? dataVariable.shape[0] : 1;
  const latCount = latitudes.length;
  const lonCount = longitudes.length;
  if (dataVariable.values.length !== timeCount * latCount * lonCount) throw new Error(`TerraClimate ${variableName} subset dimensions were inconsistent.`);
  return { latitudes, longitudes, timeCount, values: dataVariable.values };
};

const mapTerraClimateDatasetKey = (start, end) => `${MAP_TERRACLIMATE_COVERAGE_VERSION}_${mapTerraClimateMonthKey(start)}_${mapTerraClimateMonthKey(end)}`;
const mapTerraClimateDatasetPath = key => path.join(MAP_TERRACLIMATE_DATASET_CACHE_DIR, `${key}.json`);
const mapTerraClimateTilePath = (key, z, x, y) => path.join(MAP_TERRACLIMATE_TILE_CACHE_DIR, key, String(z), String(x), `${y}.png`);

const readCachedMapTerraClimateDataset = async key => {
  ensureMapTerraClimateCacheDirs();
  const filePath = mapTerraClimateDatasetPath(key);
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

const writeMapTerraClimateDataset = async dataset => {
  ensureMapTerraClimateCacheDirs();
  const filePath = mapTerraClimateDatasetPath(dataset.key);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify({ ...dataset, values: Array.from(dataset.values, value => Number.isFinite(value) ? value : null) }));
  await fs.promises.rename(temporaryPath, filePath);
};

const trimMapTerraClimateMemoryCache = () => {
  while (mapTerraClimateDatasetCache.size > 6) mapTerraClimateDatasetCache.delete(mapTerraClimateDatasetCache.keys().next().value);
};

const pruneMapTerraClimateDiskCache = async currentKey => {
  ensureMapTerraClimateCacheDirs();
  try {
    const files = (await fs.promises.readdir(MAP_TERRACLIMATE_DATASET_CACHE_DIR, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.json'));
    if (files.length <= MAP_TERRACLIMATE_MAX_CACHED_RANGES) return;
    const ranked = await Promise.all(files.map(async entry => {
      const filePath = path.join(MAP_TERRACLIMATE_DATASET_CACHE_DIR, entry.name);
      const stats = await fs.promises.stat(filePath);
      return { key: entry.name.slice(0, -5), filePath, modified: stats.mtimeMs };
    }));
    ranked.sort((a, b) => b.modified - a.modified);
    const expired = ranked.filter(item => item.key !== currentKey).slice(Math.max(0, MAP_TERRACLIMATE_MAX_CACHED_RANGES - 1));
    await Promise.all(expired.flatMap(item => [
      fs.promises.rm(item.filePath, { force: true }),
      fs.promises.rm(path.join(MAP_TERRACLIMATE_TILE_CACHE_DIR, item.key), { recursive: true, force: true })
    ]));
  } catch (error) {
    console.warn('Unable to prune TerraClimate cache:', error.message);
  }
};

const buildMapTerraClimateDataset = async range => {
  const groups = new Map();
  range.months.forEach(month => {
    const year = Number(month.slice(0, 4));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(month);
  });
  let base = null;
  let sums = null;
  let counts = null;
  let includedMonths = 0;
  for (const [year, months] of groups) {
    const firstMonth = months[0];
    const lastMonth = months.at(-1);
    const [tminParsed, tmaxParsed] = await Promise.all([
      fetchMapTerraClimateSubset('tmin', year, firstMonth, lastMonth),
      fetchMapTerraClimateSubset('tmax', year, firstMonth, lastMonth)
    ]);
    const tmin = mapTerraClimateGridFromParsed(tminParsed, 'tmin');
    const tmax = mapTerraClimateGridFromParsed(tmaxParsed, 'tmax');
    if (tmin.latitudes.length !== tmax.latitudes.length || tmin.longitudes.length !== tmax.longitudes.length || tmin.timeCount !== tmax.timeCount) {
      throw new Error('TerraClimate minimum and maximum temperature grids were inconsistent.');
    }
    if (!base) {
      const latDescending = tmin.latitudes[0] > tmin.latitudes.at(-1);
      const lonAscending = tmin.longitudes[0] < tmin.longitudes.at(-1);
      if (!lonAscending) throw new Error('TerraClimate longitude ordering is unsupported.');
      const resolutionX = Math.abs(tmin.longitudes[1] - tmin.longitudes[0]);
      const resolutionY = -Math.abs(tmin.latitudes[1] - tmin.latitudes[0]);
      base = {
        width: tmin.longitudes.length,
        height: tmin.latitudes.length,
        west: tmin.longitudes[0] - resolutionX / 2,
        north: (latDescending ? tmin.latitudes[0] : tmin.latitudes.at(-1)) + Math.abs(resolutionY) / 2,
        resolutionX,
        resolutionY,
        latDescending
      };
      sums = new Float64Array(base.width * base.height);
      counts = new Uint16Array(base.width * base.height);
    }
    if (tmin.longitudes.length !== base.width || tmin.latitudes.length !== base.height) throw new Error('TerraClimate grids changed across the selected years.');
    const recordCount = Math.min(months.length, tmin.timeCount, tmax.timeCount);
    includedMonths += recordCount;
    for (let timeIndex = 0; timeIndex < recordCount; timeIndex++) {
      for (let sourceRow = 0; sourceRow < base.height; sourceRow++) {
        const targetRow = base.latDescending ? sourceRow : base.height - sourceRow - 1;
        for (let column = 0; column < base.width; column++) {
          const sourceIndex = timeIndex * base.height * base.width + sourceRow * base.width + column;
          const minValue = Number(tmin.values[sourceIndex]);
          const maxValue = Number(tmax.values[sourceIndex]);
          if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) continue;
          const targetIndex = targetRow * base.width + column;
          sums[targetIndex] += (minValue + maxValue) / 2;
          counts[targetIndex]++;
        }
      }
    }
  }
  if (!base || !sums || !counts) throw new Error('TerraClimate did not return any temperature data.');
  const values = new Float32Array(sums.length);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCells = 0;
  for (let index = 0; index < values.length; index++) {
    if (!counts[index]) {
      values[index] = Number.NaN;
      continue;
    }
    const value = sums[index] / counts[index];
    values[index] = value;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
    validCells++;
  }
  const key = mapTerraClimateDatasetKey(range.start, range.end);
  const dataset = {
    key,
    start: range.start,
    end: range.end,
    months: includedMonths,
    width: base.width,
    height: base.height,
    west: base.west,
    north: base.north,
    resolutionX: base.resolutionX,
    resolutionY: base.resolutionY,
    values,
    stats: {
      min_c: validCells ? min : null,
      max_c: validCells ? max : null,
      mean_c: validCells ? sum / validCells : null,
      valid_cells: validCells
    },
    generated_at: new Date().toISOString()
  };
  await writeMapTerraClimateDataset(dataset);
  await pruneMapTerraClimateDiskCache(dataset.key);
  return dataset;
};

const getMapTerraClimateDataset = async (startValue, endValue) => {
  const range = await validateMapTerraClimateRange(startValue, endValue, { skipAvailability: true });
  const key = mapTerraClimateDatasetKey(range.start, range.end);
  if (mapTerraClimateDatasetCache.has(key)) return mapTerraClimateDatasetCache.get(key);
  if (mapTerraClimateDatasetBuilds.has(key)) return mapTerraClimateDatasetBuilds.get(key);
  const build = (async () => {
    const cached = await readCachedMapTerraClimateDataset(key);
    if (cached) {
      mapTerraClimateDatasetCache.set(key, cached);
      trimMapTerraClimateMemoryCache();
      return cached;
    }
    await validateMapTerraClimateRange(range.start, range.end);
    const dataset = await buildMapTerraClimateDataset(range);
    mapTerraClimateDatasetCache.set(key, dataset);
    trimMapTerraClimateMemoryCache();
    return dataset;
  })().finally(() => mapTerraClimateDatasetBuilds.delete(key));
  mapTerraClimateDatasetBuilds.set(key, build);
  return build;
};

const mapTerraClimateTileLongitude = (tileX, zoom) => tileX / (2 ** zoom) * 360 - 180;
const mapTerraClimateTileLatitude = (tileY, zoom) => {
  const value = Math.PI - 2 * Math.PI * tileY / (2 ** zoom);
  return 180 / Math.PI * Math.atan(Math.sinh(value));
};
const mapTerraClimateColor = value => {
  if (!Number.isFinite(value)) return [0, 0, 0, 0];
  if (value <= MAP_TERRACLIMATE_COLOR_STOPS[0][0]) return MAP_TERRACLIMATE_COLOR_STOPS[0][1];
  for (let index = 1; index < MAP_TERRACLIMATE_COLOR_STOPS.length; index++) {
    const [upperValue, upperColor] = MAP_TERRACLIMATE_COLOR_STOPS[index];
    const [lowerValue, lowerColor] = MAP_TERRACLIMATE_COLOR_STOPS[index - 1];
    if (value <= upperValue) {
      const ratio = Math.max(0, Math.min(1, (value - lowerValue) / Math.max(0.0001, upperValue - lowerValue)));
      return upperColor.map((channel, channelIndex) => Math.round(lowerColor[channelIndex] + (channel - lowerColor[channelIndex]) * ratio));
    }
  }
  return MAP_TERRACLIMATE_COLOR_STOPS.at(-1)[1];
};
const getMapTerraClimateTransparentTile = () => {
  mapTerraClimateTransparentTilePromise ||= sharp({
    create: { width: MAP_TERRACLIMATE_TILE_SIZE, height: MAP_TERRACLIMATE_TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toBuffer();
  return mapTerraClimateTransparentTilePromise;
};

const renderMapTerraClimateTile = async (dataset, zoom, tileX, tileY) => {
  const west = mapTerraClimateTileLongitude(tileX, zoom);
  const east = mapTerraClimateTileLongitude(tileX + 1, zoom);
  const north = mapTerraClimateTileLatitude(tileY, zoom);
  const south = mapTerraClimateTileLatitude(tileY + 1, zoom);
  if (east <= MAP_TERRACLIMATE_BOUNDS.west || west >= MAP_TERRACLIMATE_BOUNDS.east || north <= MAP_TERRACLIMATE_BOUNDS.south || south >= MAP_TERRACLIMATE_BOUNDS.north) {
    return getMapTerraClimateTransparentTile();
  }
  const rgba = Buffer.alloc(MAP_TERRACLIMATE_TILE_SIZE * MAP_TERRACLIMATE_TILE_SIZE * 4);
  const worldSize = MAP_TERRACLIMATE_TILE_SIZE * (2 ** zoom);
  for (let pixelY = 0; pixelY < MAP_TERRACLIMATE_TILE_SIZE; pixelY++) {
    const worldY = tileY * MAP_TERRACLIMATE_TILE_SIZE + pixelY + 0.5;
    const latitude = 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / worldSize)));
    if (latitude < MAP_TERRACLIMATE_BOUNDS.south || latitude > MAP_TERRACLIMATE_BOUNDS.north) continue;
    const row = Math.floor((latitude - dataset.north) / dataset.resolutionY);
    if (row < 0 || row >= dataset.height) continue;
    for (let pixelX = 0; pixelX < MAP_TERRACLIMATE_TILE_SIZE; pixelX++) {
      const longitude = (tileX * MAP_TERRACLIMATE_TILE_SIZE + pixelX + 0.5) / worldSize * 360 - 180;
      if (longitude < MAP_TERRACLIMATE_BOUNDS.west || longitude > MAP_TERRACLIMATE_BOUNDS.east) continue;
      const column = Math.floor((longitude - dataset.west) / dataset.resolutionX);
      if (column < 0 || column >= dataset.width) continue;
      const color = mapTerraClimateColor(dataset.values[row * dataset.width + column]);
      const offset = (pixelY * MAP_TERRACLIMATE_TILE_SIZE + pixelX) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }
  return sharp(rgba, { raw: { width: MAP_TERRACLIMATE_TILE_SIZE, height: MAP_TERRACLIMATE_TILE_SIZE, channels: 4 } })
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toBuffer();
};

const getMapTerraClimateTile = async (startValue, endValue, zoomValue, tileXValue, tileYValue) => {
  const zoom = Number(zoomValue);
  const tileX = Number(tileXValue);
  const tileY = Number(tileYValue);
  const maxCoordinate = Number.isInteger(zoom) && zoom >= 0 ? 2 ** zoom : 0;
  if (!Number.isInteger(zoom) || zoom < MAP_TERRACLIMATE_MIN_ZOOM || zoom > MAP_TERRACLIMATE_MAX_ZOOM
      || !Number.isInteger(tileX) || !Number.isInteger(tileY) || tileX < 0 || tileY < 0 || tileX >= maxCoordinate || tileY >= maxCoordinate) {
    return getMapTerraClimateTransparentTile();
  }
  const dataset = await getMapTerraClimateDataset(startValue, endValue);
  ensureMapTerraClimateCacheDirs();
  const filePath = mapTerraClimateTilePath(dataset.key, zoom, tileX, tileY);
  if (fs.existsSync(filePath)) return fs.promises.readFile(filePath);
  const renderKey = `${dataset.key}/${zoom}/${tileX}/${tileY}`;
  if (mapTerraClimateTileRenders.has(renderKey)) return mapTerraClimateTileRenders.get(renderKey);
  const render = (async () => {
    const buffer = await renderMapTerraClimateTile(dataset, zoom, tileX, tileY);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(temporaryPath, buffer);
    await fs.promises.rename(temporaryPath, filePath);
    return buffer;
  })().finally(() => mapTerraClimateTileRenders.delete(renderKey));
  mapTerraClimateTileRenders.set(renderKey, render);
  return render;
};

const parseMapTerraClimateCsv = text => {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

const fetchMapTerraClimatePointVariable = async (variable, year, firstMonth, lastMonth, latitude, longitude) => {
  let lastError = null;
  for (const baseFactory of mapTerraClimateNcssBases(variable)) {
    // NCSS point responses use an unlimited record dimension that the small
    // grid-oriented NetCDF reader above does not need to support. CSV keeps
    // every requested monthly record explicit and avoids collapsing a range
    // to its first month.
    const params = mapTerraClimateSubsetQuery(variable, year, firstMonth, lastMonth, 'csv', { latitude, longitude });
    const url = `${baseFactory(year)}?${params.toString()}`;
    try {
      const response = await mapTerraClimateFetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseMapTerraClimateCsv(await response.text());
      if (!rows.length) throw new Error('No point records returned.');
      return rows;
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error(`Unable to download TerraClimate ${variable} point data: ${lastError?.message || 'service unavailable'}`);
  error.statusCode = lastError?.statusCode || 503;
  throw error;
};

const mapTerraClimateCsvValue = (row, variable) => {
  const direct = Number(row[variable]);
  if (Number.isFinite(direct)) return Math.abs(direct) > 1000 ? direct / 100 - 100 : direct;
  const candidate = Object.entries(row).find(([key]) => key.toLowerCase() === variable || key.toLowerCase().includes(variable));
  if (!candidate || !Number.isFinite(Number(candidate[1]))) return null;
  const value = Number(candidate[1]);
  return Math.abs(value) > 1000 ? value / 100 - 100 : value;
};
const mapTerraClimateCsvTime = row => {
  const candidate = Object.entries(row).find(([key]) => /time|date/i.test(key));
  const text = String(candidate?.[1] || '');
  const match = text.match(/\d{4}-\d{2}/);
  return match?.[0] || '';
};

const fetchMapNasaPowerDailyTemperature = async (range, latitude, longitude) => {
  const params = new URLSearchParams({
    parameters: 'T2M,T2M_MIN,T2M_MAX',
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: range.start.replaceAll('-', ''),
    end: range.end.replaceAll('-', ''),
    format: 'JSON',
    'time-standard': 'UTC'
  });
  const response = await mapTerraClimateFetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`);
  if (!response.ok) throw new Error(`NASA POWER daily temperature returned HTTP ${response.status}.`);
  const payload = await response.json();
  const parameters = payload?.properties?.parameter || {};
  const meanValues = parameters.T2M || {};
  const minimumValues = parameters.T2M_MIN || {};
  const maximumValues = parameters.T2M_MAX || {};
  const dates = [...new Set([...Object.keys(meanValues), ...Object.keys(minimumValues), ...Object.keys(maximumValues)])]
    .filter(value => /^\d{8}$/.test(value))
    .sort();
  const temperature = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > -900 ? Number(numeric.toFixed(3)) : null;
  };
  const points = dates.map(value => {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return {
      month: date.slice(0, 7),
      start: date,
      end: date,
      tmin_c: temperature(minimumValues[value]),
      mean_c: temperature(meanValues[value]),
      tmax_c: temperature(maximumValues[value])
    };
  }).filter(point => point.start >= range.start && point.start <= range.end)
    .filter(point => [point.tmin_c, point.mean_c, point.tmax_c].some(Number.isFinite));
  if (!points.length) throw new Error('NASA POWER returned no daily temperature records for this point and range.');
  return {
    layer: 'terraclimate',
    latitude,
    longitude,
    start: range.start,
    end: range.end,
    units: '°C',
    dataset_label: 'NASA POWER daily temperature',
    source: 'NASA POWER Daily API (MERRA-2 meteorology)',
    source_url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
    series_resolution: 'daily',
    points
  };
};

const mapTerraClimateDatasetPointValue = (dataset, latitude, longitude) => {
  if (!dataset || !Number.isFinite(dataset.resolutionX) || !Number.isFinite(dataset.resolutionY)) return null;
  const column = Math.floor((longitude - dataset.west) / dataset.resolutionX);
  const row = Math.floor((latitude - dataset.north) / dataset.resolutionY);
  if (column < 0 || column >= dataset.width || row < 0 || row >= dataset.height) return null;
  const value = Number(dataset.values[row * dataset.width + column]);
  return Number.isFinite(value) ? value : null;
};

const mapTerraClimateCachedSeries = async (range, latitude, longitude) => {
  const dataset = await readCachedMapTerraClimateDataset(mapTerraClimateDatasetKey(range.start, range.end));
  const value = mapTerraClimateDatasetPointValue(dataset, latitude, longitude);
  if (value === null) return null;
  const month = `${mapTerraClimateMonthKey(range.start)} to ${mapTerraClimateMonthKey(range.end)}`;
  return {
    layer: 'terraclimate',
    latitude,
    longitude,
    start: range.start,
    end: range.end,
    units: '°C',
    dataset_label: 'TerraClimate monthly temperature',
    source: 'Prepared TerraClimate overlay cache',
    source_url: 'https://www.climatologylab.org/terraclimate.html',
    series_resolution: 'selected-range mean (prepared map data)',
    points: [{
      month,
      start: range.start,
      end: range.end,
      tmin_c: null,
      mean_c: Number(value.toFixed(3)),
      tmax_c: null
    }]
  };
};

const getMapTerraClimateSeries = async (startValue, endValue, latitudeValue, longitudeValue) => {
  const range = await validateMapTerraClimateRange(startValue, endValue);
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || latitude < MAP_TERRACLIMATE_BOUNDS.south || latitude > MAP_TERRACLIMATE_BOUNDS.north
      || !Number.isFinite(longitude) || longitude < MAP_TERRACLIMATE_BOUNDS.west || longitude > MAP_TERRACLIMATE_BOUNDS.east) {
    const error = new Error('Choose a point within the Philippines climate layer extent.');
    error.statusCode = 400;
    throw error;
  }
  const useDailyPowerSeries = range.months.length === 1;
  const cacheKey = `${useDailyPowerSeries ? 'nasa-power-daily-v1' : 'terraclimate-monthly-v2'}_${range.start}_${range.end}_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  if (mapTerraClimateSeriesCache.has(cacheKey)) return mapTerraClimateSeriesCache.get(cacheKey);
  try {
    if (useDailyPowerSeries) {
      const result = await fetchMapNasaPowerDailyTemperature(range, latitude, longitude);
      mapTerraClimateSeriesCache.set(cacheKey, result);
      while (mapTerraClimateSeriesCache.size > 48) mapTerraClimateSeriesCache.delete(mapTerraClimateSeriesCache.keys().next().value);
      return result;
    }
    const groups = new Map();
  range.months.forEach(month => {
    const year = Number(month.slice(0, 4));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(month);
  });
  const points = [];
  for (const [year, months] of groups) {
    const firstMonth = months[0];
    const lastMonth = months.at(-1);
    const [minRows, maxRows] = await Promise.all([
      fetchMapTerraClimatePointVariable('tmin', year, firstMonth, lastMonth, latitude, longitude),
      fetchMapTerraClimatePointVariable('tmax', year, firstMonth, lastMonth, latitude, longitude)
    ]);
    const minByMonth = new Map(minRows.map(row => [mapTerraClimateCsvTime(row), mapTerraClimateCsvValue(row, 'tmin')]));
    const maxByMonth = new Map(maxRows.map(row => [mapTerraClimateCsvTime(row), mapTerraClimateCsvValue(row, 'tmax')]));
    months.forEach(month => {
      const tmin = minByMonth.get(month);
      const tmax = maxByMonth.get(month);
      const mean = Number.isFinite(tmin) && Number.isFinite(tmax) ? (tmin + tmax) / 2 : null;
      points.push({
        month,
        start: mapTerraClimateMonthDate(month),
        end: mapTerraClimateMonthEnd(month),
        tmin_c: Number.isFinite(tmin) ? Number(tmin.toFixed(3)) : null,
        mean_c: Number.isFinite(mean) ? Number(mean.toFixed(3)) : null,
        tmax_c: Number.isFinite(tmax) ? Number(tmax.toFixed(3)) : null
      });
    });
  }
    const result = {
    layer: 'terraclimate',
    latitude,
    longitude,
    start: range.start,
    end: range.end,
    units: '°C',
    dataset_label: 'TerraClimate monthly temperature',
    source: 'TerraClimate / Climatology Lab, University of Idaho',
    source_url: 'https://www.climatologylab.org/terraclimate.html',
    series_resolution: 'monthly',
    points
  };
    mapTerraClimateSeriesCache.set(cacheKey, result);
    while (mapTerraClimateSeriesCache.size > 48) mapTerraClimateSeriesCache.delete(mapTerraClimateSeriesCache.keys().next().value);
    return result;
  } catch (error) {
    // Preserve point access during a temporary NCSS outage by sampling the
    // exact nationwide grid already prepared for the visible overlay.
    const cachedResult = await mapTerraClimateCachedSeries(range, latitude, longitude);
    if (cachedResult) {
      mapTerraClimateSeriesCache.set(cacheKey, cachedResult);
      return cachedResult;
    }
    throw error;
  }
};

const getMapTerraClimateConfig = async () => {
  const availability = await getMapTerraClimateAvailability();
  const defaultEnd = availability.latestDate;
  const defaultEndMonth = mapTerraClimateMonthKey(defaultEnd);
  const defaultStart = `${mapTerraClimateAddMonths(defaultEndMonth, -2)}-01`;
  return {
    version: MAP_TERRACLIMATE_VERSION,
    dataset: MAP_TERRACLIMATE_DATASET_LABEL,
    min_date: availability.minDate,
    latest_date: availability.latestDate,
    default_start: defaultStart,
    default_end: defaultEnd,
    max_range_months: MAP_TERRACLIMATE_MAX_RANGE_MONTHS,
    resolution_degrees: 1 / 24,
    units: '°C mean monthly temperature',
    bounds: [MAP_TERRACLIMATE_BOUNDS.west, MAP_TERRACLIMATE_BOUNDS.south, MAP_TERRACLIMATE_BOUNDS.east, MAP_TERRACLIMATE_BOUNDS.north],
    min_zoom: MAP_TERRACLIMATE_MIN_ZOOM,
    max_zoom: MAP_TERRACLIMATE_MAX_ZOOM,
    color_stops: MAP_TERRACLIMATE_COLOR_STOPS.map(([value, color]) => ({ value, color }))
  };
};
