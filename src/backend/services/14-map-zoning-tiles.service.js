const MAP_ZONING_TILE_SIZE = 256;
const MAP_ZONING_MIN_ZOOM = 9;
const MAP_ZONING_MAX_ZOOM = 20;
const MAP_ZONING_GEOMETRY_MAGIC = 0x3142445A;
const mapZoningTileRenders = new Map();
let mapZoningDatabasePromise = null;
let mapZoningTransparentTilePromise = null;

const ensureMapZoningDatabaseFile = async () => {
  if (fs.existsSync(MAP_ZONING_DB_PATH) && fs.statSync(MAP_ZONING_DB_PATH).size > 0) return;
  if (!fs.existsSync(MAP_ZONING_PACKAGED_DB_PATH)) throw new Error('Packaged zoning database is missing.');
  const temporaryPath = `${MAP_ZONING_DB_PATH}.tmp`;
  await fs.promises.rm(temporaryPath, { force: true });
  await pipeline(
    fs.createReadStream(MAP_ZONING_PACKAGED_DB_PATH),
    zlib.createGunzip(),
    fs.createWriteStream(temporaryPath)
  );
  await fs.promises.rename(temporaryPath, MAP_ZONING_DB_PATH);
};

const getMapZoningDatabase = async () => {
  if (!mapZoningDatabasePromise) {
    mapZoningDatabasePromise = (async () => {
      await ensureMapZoningDatabaseFile();
      return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(MAP_ZONING_DB_PATH, sqlite3.OPEN_READONLY, err => {
          if (err) reject(err);
          else resolve(database);
        });
      });
    })().catch(err => {
      mapZoningDatabasePromise = null;
      throw err;
    });
  }
  return mapZoningDatabasePromise;
};

const mapZoningAll = (database, sql, params) => new Promise((resolve, reject) => {
  database.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

const mapZoningTileLongitude = (tileX, zoom) => tileX / (2 ** zoom) * 360 - 180;
const mapZoningTileLatitude = (tileY, zoom) => {
  const value = Math.PI - 2 * Math.PI * tileY / (2 ** zoom);
  return 180 / Math.PI * Math.atan(Math.sinh(value));
};

const mapZoningProject = (latitudeDeg, longitudeDeg) => {
  const semiMajor = 6378206.4;
  const semiMinor = 6356583.8;
  const flattening = (semiMajor - semiMinor) / semiMajor;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const latitude = latitudeDeg * Math.PI / 180;
  const longitude = longitudeDeg * Math.PI / 180;
  const centralMeridian = 125 * Math.PI / 180;
  const scale = 0.99995;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const tangent = Math.tan(latitude);
  const radius = semiMajor / Math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
  const tangentSquared = tangent * tangent;
  const eccentricityTerm = secondEccentricitySquared * cosLatitude * cosLatitude;
  const longitudeTerm = cosLatitude * (longitude - centralMeridian);
  const meridionalArc = semiMajor * (
    (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256) * latitude
    - (3 * eccentricitySquared / 8 + 3 * eccentricitySquared ** 2 / 32 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(2 * latitude)
    + (15 * eccentricitySquared ** 2 / 256 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(4 * latitude)
    - (35 * eccentricitySquared ** 3 / 3072) * Math.sin(6 * latitude)
  );
  const x = 500000 + scale * radius * (
    longitudeTerm
    + (1 - tangentSquared + eccentricityTerm) * longitudeTerm ** 3 / 6
    + (5 - 18 * tangentSquared + tangentSquared ** 2 + 72 * eccentricityTerm - 58 * secondEccentricitySquared) * longitudeTerm ** 5 / 120
  ) - 169.5;
  const y = scale * (
    meridionalArc
    + radius * tangent * (
      longitudeTerm ** 2 / 2
      + (5 - tangentSquared + 9 * eccentricityTerm + 4 * eccentricityTerm ** 2) * longitudeTerm ** 4 / 24
      + (61 - 58 * tangentSquared + tangentSquared ** 2 + 600 * eccentricityTerm - 330 * secondEccentricitySquared) * longitudeTerm ** 6 / 720
    )
  ) + 96;
  return [x, y];
};

const mapZoningUnproject = (projectedX, projectedY) => {
  let latitude = 7.2;
  let longitude = 125.45;
  for (let iteration = 0; iteration < 7; iteration++) {
    const [x, y] = mapZoningProject(latitude, longitude);
    const [xByLatitude, yByLatitude] = mapZoningProject(latitude + 0.00001, longitude);
    const [xByLongitude, yByLongitude] = mapZoningProject(latitude, longitude + 0.00001);
    const determinant = (xByLatitude - x) * (yByLongitude - y) - (xByLongitude - x) * (yByLatitude - y);
    if (Math.abs(determinant) < 1e-9) break;
    const errorX = projectedX - x;
    const errorY = projectedY - y;
    latitude += 0.00001 * (errorX * (yByLongitude - y) - errorY * (xByLongitude - x)) / determinant;
    longitude += 0.00001 * ((xByLatitude - x) * errorY - (yByLatitude - y) * errorX) / determinant;
  }
  return [longitude, latitude];
};

const mapZoningLabelMinimumZoom = area => {
  const value = Number(area) || 0;
  if (value >= 1800) return 9;
  if (value >= 500) return 10;
  if (value >= 140) return 11;
  if (value >= 40) return 12;
  if (value >= 12) return 14;
  return 17;
};

const getMapZoningLabels = async (query = {}) => {
  const west = Number(query.west);
  const south = Number(query.south);
  const east = Number(query.east);
  const north = Number(query.north);
  const zoom = Math.max(MAP_ZONING_MIN_ZOOM, Math.min(MAP_ZONING_MAX_ZOOM, Number(query.zoom) || MAP_ZONING_MIN_ZOOM));
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north
      || west < -180 || east > 180 || south < -90 || north > 90) {
    const err = new Error('Invalid zoning label bounds.');
    err.statusCode = 400;
    throw err;
  }
  if (zoom < MAP_ZONING_MIN_ZOOM) return { type: 'FeatureCollection', features: [] };
  const projectedCorners = [
    mapZoningProject(north, west), mapZoningProject(north, east),
    mapZoningProject(south, west), mapZoningProject(south, east)
  ];
  const bounds = {
    minX: Math.min(...projectedCorners.map(point => point[0])),
    maxX: Math.max(...projectedCorners.map(point => point[0])),
    minY: Math.min(...projectedCorners.map(point => point[1])),
    maxY: Math.max(...projectedCorners.map(point => point[1]))
  };
  const database = await getMapZoningDatabase();
  const rows = await mapZoningAll(database, `
    SELECT z._id, z.zone_code, z.zone_class, z.lu_desc, z.source_area, z.minx, z.maxx, z.miny, z.maxy
    FROM zone_rtree r JOIN zones z ON z._id = r._id
    WHERE r.maxx >= ? AND r.minx <= ? AND r.maxy >= ? AND r.miny <= ?
    ORDER BY COALESCE(z.source_area, 0) DESC, z._id
    LIMIT 5000
  `, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const gridSize = zoom < 11 ? 390 : zoom < 13 ? 310 : zoom < 15 ? 220 : zoom < 17 ? 155 : 120;
  const occupied = new Set();
  const namePositions = new Map();
  const features = [];
  rows.forEach(row => {
    const minZoom = mapZoningLabelMinimumZoom(row.source_area);
    if (zoom + 0.25 < minZoom) return;
    const centerX = (Number(row.minx) + Number(row.maxx)) / 2;
    const centerY = (Number(row.miny) + Number(row.maxy)) / 2;
    const pixelX = (centerX - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX) * 1024;
    const pixelY = (bounds.maxY - centerY) / Math.max(1, bounds.maxY - bounds.minY) * 1024;
    const name = String(row.zone_class || row.lu_desc || row.zone_code || '').trim();
    if (!name) return;
    const cellKey = `${Math.floor(pixelX / gridSize)}:${Math.floor(pixelY / gridSize)}`;
    if (occupied.has(cellKey)) return;
    const normalizedName = name.toLowerCase();
    const priorPositions = namePositions.get(normalizedName) || [];
    if (priorPositions.some(point => Math.hypot(pixelX - point[0], pixelY - point[1]) < gridSize * 1.65)) return;
    occupied.add(cellKey);
    priorPositions.push([pixelX, pixelY]);
    namePositions.set(normalizedName, priorPositions);
    const coordinates = mapZoningUnproject(centerX, centerY);
    if (coordinates[0] < west - 0.02 || coordinates[0] > east + 0.02 || coordinates[1] < south - 0.02 || coordinates[1] > north + 0.02) return;
    features.push({
      type: 'Feature',
      id: Number(row._id),
      geometry: { type: 'Point', coordinates },
      properties: {
        name,
        zone_code: row.zone_code || '',
        priority: Math.max(0, Number(row.source_area) || 0),
        min_zoom: minZoom
      }
    });
  });
  return { type: 'FeatureCollection', features: features.slice(0, 180) };
};

const mapZoningColor = zoneName => {
  const zone = String(zoneName || '').toLowerCase();
  if (zone.includes('marine protected area buffer')) return '#69d8ef';
  if (zone.includes('marine protected')) return '#088fae';
  if (zone.includes('mangrove')) return '#ffffff';
  if (zone.includes('protection forest')) return '#008000';
  if (zone.includes('production forest')) return '#006900';
  if (zone.includes('protected agricultural')) return '#00a800';
  if (zone.includes('production agricultural')) return '#009a00';
  if (zone.includes('watershed')) return '#678b00';
  if (zone.includes('residential') || zone.includes('housing')) return '#fff600';
  if (zone.includes('commercial')) return '#ff2424';
  if (zone.includes('industrial') && zone.includes('agri')) return '#d363ef';
  if (zone.includes('industrial')) return '#9700cd';
  if (zone.includes('institutional')) return '#1414eb';
  if (zone.includes('parks') || zone.includes('recreation')) return '#5eda63';
  if (zone.includes('waste')) return '#d3ffc2';
  if (zone.includes('cemetery') || zone.includes('memorial')) return '#60de66';
  if (zone.includes('open space') || zone.includes('easement')) return '#9dff12';
  if (zone.includes('buffer') || zone.includes('greenbelt')) return '#65a900';
  if (zone.includes('ecological')) return '#06ae92';
  if (zone.includes('utilities') || zone.includes('transportation') || zone.includes('services')) return '#b9b9b9';
  if (zone.includes('tourism')) return '#ff9900';
  if (zone.includes('river') || zone.includes('creek') || zone.includes('lake')) return '#a4c3dc';
  if (zone.includes('wetland')) return '#aecbe1';
  if (zone.includes('aquaculture')) return '#a9c7e0';
  if (zone.includes('municipal fishing')) return '#aeddf5';
  if (zone.includes('agricultural') || zone.includes('agriculture')) return '#009a00';
  if (zone.includes('forest')) return '#006900';
  return '#b4b4b4';
};

const mapZoningGeometryPath = (geometry, bounds, minimumPointDistance) => {
  if (!Buffer.isBuffer(geometry) || geometry.length < 8 || geometry.readUInt32LE(0) !== MAP_ZONING_GEOMETRY_MAGIC) return '';
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return '';
  let offset = 4;
  const ringCount = geometry.readUInt32LE(offset);
  offset += 4;
  if (ringCount > 100000) return '';
  const parts = [];
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    if (offset + 4 > geometry.length) return '';
    const pointCount = geometry.readUInt32LE(offset);
    offset += 4;
    if (pointCount < 3 || offset + pointCount * 16 > geometry.length) return '';
    let ringPath = '';
    let previousX = Number.NaN;
    let previousY = Number.NaN;
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      const projectedX = geometry.readDoubleLE(offset);
      const projectedY = geometry.readDoubleLE(offset + 8);
      offset += 16;
      const pixelX = (projectedX - bounds.minX) / width * MAP_ZONING_TILE_SIZE;
      const pixelY = (bounds.maxY - projectedY) / height * MAP_ZONING_TILE_SIZE;
      const isEndpoint = pointIndex === 0 || pointIndex === pointCount - 1;
      if (!isEndpoint && Number.isFinite(previousX) && Math.hypot(pixelX - previousX, pixelY - previousY) < minimumPointDistance) continue;
      ringPath += `${ringPath ? 'L' : 'M'}${pixelX.toFixed(1)} ${pixelY.toFixed(1)}`;
      previousX = pixelX;
      previousY = pixelY;
    }
    if (ringPath) parts.push(`${ringPath}Z`);
  }
  return parts.join('');
};

const mapZoningTransparentTile = () => {
  if (!mapZoningTransparentTilePromise) {
    mapZoningTransparentTilePromise = sharp({
      create: { width: MAP_ZONING_TILE_SIZE, height: MAP_ZONING_TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).png().toBuffer();
  }
  return mapZoningTransparentTilePromise;
};

const renderMapZoningTileUncached = async (zoom, tileX, tileY, cachePath) => {
  if (zoom < MAP_ZONING_MIN_ZOOM) return mapZoningTransparentTile();
  const north = mapZoningTileLatitude(tileY, zoom);
  const south = mapZoningTileLatitude(tileY + 1, zoom);
  const west = mapZoningTileLongitude(tileX, zoom);
  const east = mapZoningTileLongitude(tileX + 1, zoom);
  const projectedCorners = [
    mapZoningProject(north, west), mapZoningProject(north, east),
    mapZoningProject(south, west), mapZoningProject(south, east)
  ];
  const bounds = {
    minX: Math.min(...projectedCorners.map(point => point[0])),
    maxX: Math.max(...projectedCorners.map(point => point[0])),
    minY: Math.min(...projectedCorners.map(point => point[1])),
    maxY: Math.max(...projectedCorners.map(point => point[1]))
  };
  const database = await getMapZoningDatabase();
  const rows = await mapZoningAll(database, `
    SELECT z.zone_class, z.lu_desc, z.minx, z.maxx, z.miny, z.maxy, z.geometry
    FROM zone_rtree r JOIN zones z ON z._id = r._id
    WHERE r.maxx >= ? AND r.minx <= ? AND r.maxy >= ? AND r.miny <= ?
    ORDER BY z._id
  `, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);
  if (!rows.length) return mapZoningTransparentTile();
  const minimumFeaturePixels = zoom <= 10 ? 0.8 : zoom <= 12 ? 0.35 : 0;
  const minimumPointDistance = zoom <= 10 ? 1.25 : zoom <= 12 ? 0.7 : 0.25;
  const paths = [];
  rows.forEach(row => {
    const featureWidth = (Number(row.maxx) - Number(row.minx)) / (bounds.maxX - bounds.minX) * MAP_ZONING_TILE_SIZE;
    const featureHeight = (Number(row.maxy) - Number(row.miny)) / (bounds.maxY - bounds.minY) * MAP_ZONING_TILE_SIZE;
    if (Math.max(featureWidth, featureHeight) < minimumFeaturePixels) return;
    const path = mapZoningGeometryPath(row.geometry, bounds, minimumPointDistance);
    if (!path) return;
    paths.push(`<path d="${path}" fill="${mapZoningColor(row.zone_class || row.lu_desc)}"/>`);
  });
  if (!paths.length) return mapZoningTransparentTile();
  const strokeWidth = zoom >= 15 ? 0.45 : zoom >= 12 ? 0.3 : 0.18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g fill-opacity="0.72" fill-rule="evenodd" stroke="#263238" stroke-opacity="0.38" stroke-width="${strokeWidth}" stroke-linejoin="round">${paths.join('')}</g></svg>`;
  const tile = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
  await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.promises.writeFile(cachePath, tile);
  return tile;
};

const renderMapZoningTile = async (rawZoom, rawTileX, rawTileY) => {
  const zoom = Number(rawZoom);
  const tileX = Number(rawTileX);
  const tileY = Number(rawTileY);
  const tileLimit = 2 ** zoom;
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > MAP_ZONING_MAX_ZOOM
      || !Number.isInteger(tileX) || tileX < 0 || tileX >= tileLimit
      || !Number.isInteger(tileY) || tileY < 0 || tileY >= tileLimit) {
    const err = new Error('Invalid zoning tile coordinates.');
    err.statusCode = 400;
    throw err;
  }
  const cachePath = path.join(MAP_ZONING_TILE_CACHE_DIR, String(zoom), String(tileX), `${tileY}.png`);
  if (fs.existsSync(cachePath)) return fs.promises.readFile(cachePath);
  const cacheKey = `${zoom}/${tileX}/${tileY}`;
  if (!mapZoningTileRenders.has(cacheKey)) {
    mapZoningTileRenders.set(cacheKey, renderMapZoningTileUncached(zoom, tileX, tileY, cachePath)
      .finally(() => mapZoningTileRenders.delete(cacheKey)));
  }
  return mapZoningTileRenders.get(cacheKey);
};
