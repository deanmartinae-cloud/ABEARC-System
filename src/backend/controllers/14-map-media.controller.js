const __routeController197 = (req, res) => {
  res.json(mapMediaConfig);
};

const __routeController224 = async (req, res) => {
  try {
    const tile = await renderMapZoningTile(req.params.z, req.params.x, req.params.y);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
      'Content-Length': tile.length
    });
    res.send(tile);
  } catch (err) {
    logError('MAP_ZONING_TILE_FAILED', err.message, err.stack);
    res.status(err.statusCode || 503).json({ error: err.statusCode === 400 ? err.message : 'Zoning map layer is temporarily unavailable.' });
  }
};

const __routeController300 = async (req, res) => {
  try {
    res.json(await getMapZoningLabels(req.query));
  } catch (err) {
    logError('MAP_ZONING_LABELS_FAILED', err.message, err.stack);
    res.status(err.statusCode || 503).json({ error: err.statusCode === 400 ? err.message : 'Zoning labels are temporarily unavailable.' });
  }
};

const mapElevationSources = {
  'aws-copernicus-glo30': { label: 'AWS Copernicus GLO-30 DSM', resolutionM: 30, provider: 'aws-copernicus', cogCode: '10', bucket: 'copernicus-dem-30m' },
  'copernicus-glo90': { label: 'Copernicus GLO-90 DSM', resolutionM: 90, provider: 'open-meteo' },
  'aws-copernicus-glo90': { label: 'AWS Copernicus GLO-90 DSM', resolutionM: 90, provider: 'aws-copernicus', cogCode: '30', bucket: 'copernicus-dem-90m' },
  'aws-mapzen': { label: 'AWS Terrain Tiles (Mapzen)', resolutionM: 30, provider: 'aws-mapzen' },
  'opentopo-srtm30': { label: 'Open Topo Data SRTM Radar DEM', resolutionM: 30, provider: 'open-topodata', dataset: 'srtm30m' },
  'opentopo-mapzen': { label: 'Open Topo Data Mapzen Terrain', resolutionM: 30, provider: 'open-topodata', dataset: 'mapzen' }
};
const mapElevationCogCache = new Map();

const mapElevationOpenTopoData = async (source, locations, signal) => {
  const response = await fetch(`https://api.opentopodata.org/v1/${source.dataset}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ABEARC-System/1.0 elevation-profile'
    },
    body: JSON.stringify({
      locations: locations
        .map(location => `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`)
        .join('|'),
      interpolation: 'bilinear'
    }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  const elevations = Array.isArray(data.results) ? data.results.map(result => Number(result?.elevation)) : [];
  if (!response.ok || data.status !== 'OK') throw new Error(data.error || `${source.label} is unavailable.`);
  return elevations;
};

const mapElevationOpenMeteo = async (locations, signal) => {
  const params = new URLSearchParams({
    latitude: locations.map(location => location.latitude.toFixed(6)).join(','),
    longitude: locations.map(location => location.longitude.toFixed(6)).join(',')
  });
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || 'Copernicus GLO-90 is unavailable.');
  return Array.isArray(data.elevation) ? data.elevation.map(Number) : [];
};

const mapElevationTileCoordinate = (latitude, longitude, zoom = 12) => {
  const scale = 2 ** zoom;
  const latitudeRadians = latitude * Math.PI / 180;
  const tileX = (longitude + 180) / 360 * scale;
  const tileY = (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale;
  return {
    x: Math.floor(tileX),
    y: Math.floor(tileY),
    pixelX: Math.max(0, Math.min(255, Math.floor((tileX - Math.floor(tileX)) * 256))),
    pixelY: Math.max(0, Math.min(255, Math.floor((tileY - Math.floor(tileY)) * 256)))
  };
};

const mapElevationAwsMapzen = async (locations, signal) => {
  const zoom = 12;
  const tiles = new Map();
  const coordinates = locations.map(location => mapElevationTileCoordinate(location.latitude, location.longitude, zoom));
  for (const coordinate of coordinates) {
    const key = `${coordinate.x}/${coordinate.y}`;
    if (tiles.has(key)) continue;
    const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${key}.png`, { signal });
    if (!response.ok) throw new Error('AWS Terrain Tiles (Mapzen) is unavailable.');
    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    tiles.set(key, decoded);
  }
  return coordinates.map(coordinate => {
    const tile = tiles.get(`${coordinate.x}/${coordinate.y}`);
    const offset = (coordinate.pixelY * tile.info.width + coordinate.pixelX) * tile.info.channels;
    return tile.data[offset] * 256 + tile.data[offset + 1] + tile.data[offset + 2] / 256 - 32768;
  });
};

const mapElevationCogTileName = (latitude, longitude, cogCode) => {
  const tileLatitude = Math.floor(latitude);
  const tileLongitude = Math.floor(longitude);
  const latitudeLabel = `${tileLatitude >= 0 ? 'N' : 'S'}${String(Math.abs(tileLatitude)).padStart(2, '0')}_00`;
  const longitudeLabel = `${tileLongitude >= 0 ? 'E' : 'W'}${String(Math.abs(tileLongitude)).padStart(3, '0')}_00`;
  return `Copernicus_DSM_COG_${cogCode}_${latitudeLabel}_${longitudeLabel}_DEM`;
};

const mapElevationAwsCopernicus = async (source, locations, signal) => {
  const { fromUrl } = await import('geotiff');
  const tileGroups = new Map();
  locations.forEach((location, index) => {
    const tileName = mapElevationCogTileName(location.latitude, location.longitude, source.cogCode);
    if (!tileGroups.has(tileName)) tileGroups.set(tileName, []);
    tileGroups.get(tileName).push({ ...location, index });
  });
  const elevations = new Array(locations.length);
  for (const [tileName, points] of tileGroups) {
    const url = `https://${source.bucket}.s3.amazonaws.com/${tileName}/${tileName}.tif`;
    const cacheKey = `${source.bucket}/${tileName}`;
    let tiff = mapElevationCogCache.get(cacheKey);
    if (!tiff) {
      tiff = await fromUrl(url, { cacheSize: 64 }, signal);
      mapElevationCogCache.set(cacheKey, tiff);
      if (mapElevationCogCache.size > 8) mapElevationCogCache.delete(mapElevationCogCache.keys().next().value);
    }
    const image = await tiff.getImage();
    const [originX, originY] = image.getOrigin();
    const [resolutionX, resolutionY] = image.getResolution();
    for (const point of points) {
      const pixelX = Math.max(0, Math.min(image.getWidth() - 1, Math.floor((point.longitude - originX) / resolutionX)));
      const pixelY = Math.max(0, Math.min(image.getHeight() - 1, Math.floor((point.latitude - originY) / resolutionY)));
      const [band] = await image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1], samples: [0], signal });
      elevations[point.index] = Number(band[0]);
    }
  }
  return elevations;
};

const mapElevationValues = (source, locations, signal) => {
  if (source.provider === 'open-topodata') return mapElevationOpenTopoData(source, locations, signal);
  if (source.provider === 'open-meteo') return mapElevationOpenMeteo(locations, signal);
  if (source.provider === 'aws-mapzen') return mapElevationAwsMapzen(locations, signal);
  if (source.provider === 'aws-copernicus') return mapElevationAwsCopernicus(source, locations, signal);
  throw new Error('Unsupported elevation source.');
};

const __routeController225 = async (req, res) => {
  const locations = Array.isArray(req.body?.locations) ? req.body.locations : [];
  if (locations.length < 2 || locations.length > 100) {
    return res.status(400).json({ error: 'Provide between 2 and 100 elevation profile locations.' });
  }
  const normalized = locations.map(location => ({
    latitude: Number(location?.latitude),
    longitude: Number(location?.longitude)
  }));
  if (normalized.some(location => !Number.isFinite(location.latitude)
      || location.latitude < -90 || location.latitude > 90
      || !Number.isFinite(location.longitude)
      || location.longitude < -180 || location.longitude > 180)) {
    return res.status(400).json({ error: 'Every profile location must contain valid latitude and longitude values.' });
  }

  const sourceKey = String(req.body?.source || 'opentopo-srtm30');
  const source = mapElevationSources[sourceKey];
  if (!source) return res.status(400).json({ error: 'Select a valid elevation source.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const elevations = await mapElevationValues(source, normalized, controller.signal);
    if (elevations.length !== normalized.length || elevations.some(value => !Number.isFinite(value))) {
      const error = new Error(`${source.label} returned incomplete elevation data.`);
      error.statusCode = 502;
      throw error;
    }
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({ elevations, resolution_m: source.resolutionM, source: source.label, source_key: sourceKey });
  } catch (err) {
    logError('MAP_ELEVATION_PROFILE_FAILED', err.message, err.stack);
    res.status(err.name === 'AbortError' ? 504 : (err.statusCode || 503)).json({
      error: err.name === 'AbortError'
        ? 'The terrain elevation service timed out.'
        : 'Terrain elevation data is temporarily unavailable.'
    });
  } finally {
    clearTimeout(timeout);
  }
};

const __routeController198 = async (req, res) => {
  try {
    const uploadFile = req.file || req.files?.photo?.[0] || req.files?.files?.[0];
    const result = await storeMapMediaUpload({ req, file: uploadFile, metadata: req.body });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    const uploadFile = req.file || req.files?.photo?.[0] || req.files?.files?.[0];
    if (uploadFile?.path) fs.promises.unlink(uploadFile.path).catch(() => {});
    res.status(err.statusCode || 400).json({ success: false, code: err.code || 'MAP_MEDIA_UPLOAD_FAILED', error: err.message || 'Failed to upload Geotag Map photo.' });
  }
};

const parseMapMediaBatchMetadata = (raw) => {
  try {
    const value = JSON.parse(String(raw || '[]'));
    return Array.isArray(value) ? value : [];
  } catch (err) {
    const e = new Error('Invalid metadata_json.');
    e.code = 'MAP_MEDIA_INVALID_METADATA_JSON';
    e.statusCode = 400;
    throw e;
  }
};

const batchMetadataForFile = (file, metadataList, index) => {
  const byCapture = metadataList.find(meta => meta.client_capture_id && String(file.originalname || '').includes(String(meta.client_capture_id)));
  if (byCapture) return byCapture;
  const byName = metadataList.find(meta => String(meta.original_filename || '').toLowerCase() === String(file.originalname || '').toLowerCase());
  return byName || metadataList[index] || {};
};

const __routeController199 = async (req, res) => {
  const files = req.files || [];
  let metadataList = [];
  try {
    metadataList = parseMapMediaBatchMetadata(req.body.metadata_json);
  } catch (err) {
    files.forEach(file => fs.promises.unlink(file.path).catch(() => {}));
    return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message });
  }
  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      const metadata = batchMetadataForFile(file, metadataList, index);
      try {
        results[index] = await storeMapMediaUpload({ req, file, metadata });
      } catch (err) {
        if (file?.path) fs.promises.unlink(file.path).catch(() => {});
        results[index] = {
          success: false,
          duplicate: false,
          client_capture_id: metadata?.client_capture_id || null,
          code: err.code || 'MAP_MEDIA_UPLOAD_FAILED',
          error: err.message || 'Failed to upload this photo.'
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(mapMediaConfig.batchConcurrency, Math.max(files.length, 1)) }, worker));
  const uploaded = results.filter(r => r?.success && !r.duplicate).length;
  const duplicates = results.filter(r => r?.success && r.duplicate).length;
  const failed = results.filter(r => !r?.success).length;
  res.status(failed && uploaded + duplicates === 0 ? 400 : 207).json({
    success: failed === 0,
    uploaded_count: uploaded,
    duplicate_count: duplicates,
    failed_count: failed,
    results
  });
};

const __routeController200 = async (req, res) => {
  try {
    const rows = await queryMapMediaRows(req);
    res.json({ type: 'FeatureCollection', features: rows.filter(r => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))).map(mapMediaGeoJsonFeature) });
  } catch (err) {
    res.status(500).json({ success: false, code: 'MAP_MEDIA_QUERY_FAILED', error: 'Failed to load map photos.' });
  }
};

const __routeController201 = async (req, res) => {
  const row = await getMapMediaForUser(req, req.params.id);
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  res.json(mapMediaPublicFields(row));
};

const sendMapMediaFile = async (req, res, kind) => {
  const row = await getMapMediaForUser(req, req.params.id);
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  const relative = kind === 'thumbnail' ? row.thumbnail_path : row.original_path;
  if (!relative) return res.status(404).json({ error: 'Map photo file is not available.' });
  const absolute = mapMediaAbsolutePath(kind, relative);
  if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: 'Map photo file is missing.' });
  if (kind === 'original' && String(req.query.download || '') === '1') {
    return res.download(absolute, row.original_filename || path.basename(absolute));
  }
  res.sendFile(absolute);
};

const __routeController202 = (req, res) => sendMapMediaFile(req, res, 'original');
const __routeController203 = (req, res) => sendMapMediaFile(req, res, 'thumbnail');

const normalizeMapMediaBulkIds = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map(Number)
  .filter(id => Number.isInteger(id) && id > 0))]
  .slice(0, 5000);

const getAuthorizedMapMediaBulkRows = async (req, ids, requireManage = true) => {
  const canManageAll = !requireManage || await canManageAllMapMedia(req.user);
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 400) {
    const chunk = ids.slice(offset, offset + 400);
    const placeholders = chunk.map(() => '?').join(',');
    const ownerClause = canManageAll ? '' : 'AND owner_user_id=?';
    const ownerParams = canManageAll ? [] : [req.user.id];
    rows.push(...await dbAll(`SELECT * FROM MapMedia WHERE id IN (${placeholders}) ${ownerClause}`, [...chunk, ...ownerParams]));
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => order.get(Number(a.id)) - order.get(Number(b.id)));
};

const safeMapMediaBulkCategory = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 100);

const mapMediaArchiveEntryName = (row, usedNames) => {
  const fallback = `geotag-photo-${row.id}.jpg`;
  const raw = path.basename(String(row.original_filename || fallback)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 180) || fallback;
  const parsed = path.parse(raw);
  let candidate = raw;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${parsed.name}-${suffix}${parsed.ext}`;
    suffix++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const __routeController221 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to rename.' });
    const category = safeMapMediaBulkCategory(req.body.category);
    if (!category) return res.status(400).json({ error: 'A photo category is required.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids);
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be renamed.' });
    const updatedAt = new Date().toISOString();
    for (const row of rows) {
      await dbRun(`UPDATE MapMedia SET category=?, updated_at=? WHERE id=?`, [category, updatedAt, row.id]);
    }
    logActivity({ req, action: 'MAP_MEDIA_BULK_CATEGORY_UPDATE', details: `Updated the category of ${rows.length} Geotag Map photos to ${category}` });
    res.json({ success: true, renamed_count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to rename map photos.' });
  }
};

const __routeController222 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to download.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids, false);
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be downloaded.' });
    const available = rows.map(row => ({ row, absolute: mapMediaAbsolutePath('original', row.original_path) }))
      .filter(item => item.absolute && fs.existsSync(item.absolute));
    if (available.length !== rows.length) return res.status(404).json({ error: 'One or more selected photo files are missing.' });
    const totalBytes = available.reduce((sum, item) => sum + Number(fs.statSync(item.absolute).size || 0), 0);
    if (totalBytes > 1024 * 1024 * 1024) return res.status(413).json({ error: 'The selected photos exceed the 1 GB bulk download limit. Narrow the current map results and try again.' });

    const archive = new AdmZip();
    const usedNames = new Set();
    available.forEach(({ row, absolute }) => archive.addLocalFile(absolute, '', mapMediaArchiveEntryName(row, usedNames)));
    const dateLabel = new Date().toISOString().slice(0, 10);
    const archiveName = `geotag-map-photos-${dateLabel}.zip`;
    const temporaryZip = path.join(os.tmpdir(), `abearc-map-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.zip`);
    archive.writeZip(temporaryZip);
    const cleanup = () => fs.promises.unlink(temporaryZip).catch(() => {});
    res.once('finish', cleanup);
    res.once('close', cleanup);
    logActivity({ req, action: 'MAP_MEDIA_BULK_DOWNLOAD', details: `Downloaded ${available.length} Geotag Map photos as ZIP` });
    res.download(temporaryZip, archiveName);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to prepare map photo download.' });
  }
};

const __routeController223 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to delete.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids);
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be deleted.' });
    if (rows.some(row => Number(row.monitoring_record_id || 0) > 0)) {
      return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit cannot be deleted.' });
    }
    const linkedProjectPhoto = await dbGet(`SELECT 1 as linked FROM ProjectDocumentMapMediaLinks WHERE map_media_id IN (${rows.map(() => '?').join(',')}) LIMIT 1`, rows.map(row => row.id));
    if (linkedProjectPhoto) {
      return res.status(409).json({ error: 'A photo published from a reviewed project document cannot be deleted in Geotag Map. Remove its uploaded file from the project record instead.' });
    }
    for (let offset = 0; offset < rows.length; offset += 400) {
      const chunk = rows.slice(offset, offset + 400);
      const placeholders = chunk.map(() => '?').join(',');
      await dbRun(`DELETE FROM MapMedia WHERE id IN (${placeholders})`, chunk.map(row => row.id));
    }
    rows.forEach(row => {
      [mapMediaAbsolutePath('original', row.original_path), mapMediaAbsolutePath('thumbnail', row.thumbnail_path)].forEach(filePath => {
        try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
      });
    });
    logActivity({ req, action: 'MAP_MEDIA_BULK_DELETE', details: `Deleted ${rows.length} Geotag Map photos` });
    res.json({ success: true, deleted_count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete map photos.' });
  }
};

const __routeController204 = async (req, res) => {
  try {
    const [counts, review, categories] = await Promise.all([
      dbGet(`SELECT COUNT(*) total, SUM(CASE WHEN map_status='active' THEN 1 ELSE 0 END) active, SUM(CASE WHEN map_status='hidden' THEN 1 ELSE 0 END) hidden FROM MapMedia`),
      dbAll(`SELECT location_status, COUNT(*) count FROM MapMedia GROUP BY location_status`),
      dbAll(`SELECT category, COUNT(*) count FROM MapMedia GROUP BY category ORDER BY category`)
    ]);
    res.json({ counts, location_review: review, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load map summary.' });
  }
};

const __routeController205 = async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT DISTINCT district, barangay, category, zoning
      FROM MapMedia
      ORDER BY district, barangay, category, zoning
    `);
    const uniq = key => [...new Set(rows.map(r => r[key]).filter(Boolean))];
    res.json({ districts: uniq('district'), barangays: uniq('barangay'), categories: uniq('category'), zonings: uniq('zoning') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load map filter options.' });
  }
};

const __routeController206 = async (req, res) => {
  const rows = await queryMapMediaRows(req);
  res.json({ photos: rows.map(mapMediaPublicFields), clustering: mapMediaConfig.cluster, explosion: mapMediaConfig.explosion });
};

const __routeController207 = async (req, res) => {
  const rows = await queryMapMediaRows(req);
  const clusterId = decodeURIComponent(String(req.params.clusterId || ''));
  const ids = clusterId.split(',').map(Number).filter(Boolean);
  res.json({ photos: rows.filter(row => ids.includes(Number(row.id))).map(mapMediaPublicFields) });
};

const __routeController208 = async (req, res) => {
  try {
    const allowed = ['category', 'remarks', 'visibility', 'project_stage', 'zoning', 'location_zoning', 'facing_zoning', 'district', 'barangay', 'location_description'];
    const sets = [];
    const params = [];
    allowed.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        sets.push(`${key}=?`);
        params.push(req.body[key] === '' ? null : String(req.body[key]));
      }
    });
    if (!sets.length) return res.status(400).json({ error: 'No editable map photo fields supplied.' });
    sets.push('updated_at=?');
    params.push(new Date().toISOString(), req.params.id);
    await dbRun(`UPDATE MapMedia SET ${sets.join(', ')} WHERE id=?`, params);
    logActivity({ req, action: 'MAP_MEDIA_UPDATE', details: `Updated Geotag Map photo ${req.params.id}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update map photo.' });
  }
};

const __routeController209 = async (req, res) => {
  const linkedVisit = await dbGet(`SELECT monitoring_record_id FROM MapMedia WHERE id=?`, [req.params.id]);
  if (Number(linkedVisit?.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'The original GeoCam location of a monitoring-confirmation photo cannot be changed.' });
  }
  const latitude = toNullableNumber(req.body.latitude);
  const longitude = toNullableNumber(req.body.longitude);
  const accuracyM = toNullableNumber(req.body.accuracy_m);
  const status = mapLocationStatus({ latitude, longitude, accuracyM, manual: true });
  if (status === 'invalid_coordinates' || latitude === null || longitude === null) return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  await dbRun(`UPDATE MapMedia SET latitude=?, longitude=?, accuracy_m=?, coordinate_source='manual', location_status='manual_location', updated_at=? WHERE id=?`, [
    latitude, longitude, Number.isFinite(accuracyM) ? accuracyM : null, new Date().toISOString(), req.params.id
  ]);
  logActivity({ req, action: 'MAP_MEDIA_LOCATION_MANUAL', details: `Manually corrected Geotag Map photo ${req.params.id} to ${latitude}, ${longitude}` });
  res.json({ success: true, location_status: 'manual_location' });
};

const __routeController210 = async (req, res) => {
  await validateMapProjectAccess(req.user, req.body.project_id);
  await dbRun(`UPDATE MapMedia SET project_id=?, project_stage=COALESCE(?, project_stage), updated_at=? WHERE id=?`, [Number(req.body.project_id), req.body.project_stage || null, new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_LINK_PROJECT', projectId: Number(req.body.project_id), details: `Linked Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController211 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET project_id=NULL, project_stage=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_UNLINK_PROJECT', details: `Unlinked Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController212 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET calendar_event_id=?, updated_at=? WHERE id=?`, [Number(req.body.calendar_event_id), new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_LINK_CALENDAR', details: `Linked Geotag Map photo ${req.params.id} to calendar event ${req.body.calendar_event_id}` });
  res.json({ success: true });
};

const __routeController213 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET calendar_event_id=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_UNLINK_CALENDAR', details: `Unlinked Geotag Map photo ${req.params.id} from calendar event` });
  res.json({ success: true });
};

const __routeController214 = async (req, res) => {
  const linkedVisit = await dbGet(`SELECT monitoring_record_id FROM MapMedia WHERE id=?`, [req.params.id]);
  if (Number(linkedVisit?.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit must remain visible in Geotag Map.' });
  }
  await dbRun(`UPDATE MapMedia SET map_status='hidden', updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_HIDE', details: `Hidden Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController215 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET map_status='active', updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_RESTORE', details: `Restored Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController216 = async (req, res) => {
  const row = await getMapMediaForUser(req, req.params.id);
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  if (Number(row.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit cannot be deleted.' });
  }
  if (await mapMediaHasProjectDocumentLink(row.id)) {
    return res.status(409).json({ error: 'This photo was published from a reviewed project document. Remove the uploaded file from the project record to delete it from Geotag Map.' });
  }
  await dbRun(`DELETE FROM MapMedia WHERE id=?`, [req.params.id]);
  [mapMediaAbsolutePath('original', row.original_path), mapMediaAbsolutePath('thumbnail', row.thumbnail_path)].forEach(filePath => {
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  });
  logActivity({ req, action: 'MAP_MEDIA_DELETE', details: `Deleted Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController217 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, thumbnail_path, stored_filename FROM MapMedia`);
  res.json({ success: true, checked: rows.length });
};

const __routeController218 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, stored_filename FROM MapMedia WHERE thumbnail_path IS NULL OR thumbnail_path=''`);
  let regenerated = 0;
  for (const row of rows) {
    const original = mapMediaAbsolutePath('original', row.original_path);
    if (!original || !fs.existsSync(original)) continue;
    try {
      const thumb = await generateMapMediaThumbnail(original, row.stored_filename);
      await dbRun(`UPDATE MapMedia SET thumbnail_path=?, updated_at=? WHERE id=?`, [thumb, new Date().toISOString(), row.id]);
      regenerated++;
    } catch (err) {
      logError('MAP_MEDIA_REGENERATE_THUMBNAIL_FAILED', err.message, err.stack);
    }
  }
  res.json({ success: true, queued: rows.length, regenerated });
};

const __routeController219 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, thumbnail_path FROM MapMedia`);
  const missing = [];
  rows.forEach(row => {
    const original = mapMediaAbsolutePath('original', row.original_path);
    const thumbnail = row.thumbnail_path ? mapMediaAbsolutePath('thumbnail', row.thumbnail_path) : null;
    if (!original || !fs.existsSync(original)) missing.push({ id: row.id, kind: 'original' });
    if (thumbnail && !fs.existsSync(thumbnail)) missing.push({ id: row.id, kind: 'thumbnail' });
  });
  res.json({
    success: missing.length === 0,
    storage: {
      originals_bytes: dirSize(MAP_MEDIA_ORIGINALS_DIR),
      thumbnails_bytes: dirSize(MAP_MEDIA_THUMBNAILS_DIR),
      temp_bytes: dirSize(MAP_MEDIA_TEMP_DIR)
    },
    missing
  });
};

const __routeController220 = async (req, res) => {
  const q = `%${String(req.query.search || req.query.q || '').trim()}%`;
  const rows = await dbAll(`
    SELECT id, name, requester, stage, district, barangay
    FROM Projects
    WHERE COALESCE(outcome, 'Active') = 'Active'
      AND (? = '%%' OR name LIKE ? OR requester LIKE ? OR district LIKE ? OR barangay LIKE ?)
    ORDER BY datetime(COALESCE(last_activity_at, updated_at, created_at)) DESC
    LIMIT ?
  `, [q, q, q, q, q, Math.min(Math.max(Number(req.query.limit || 25), 1), 100)]);
  res.json({ projects: rows });
};
