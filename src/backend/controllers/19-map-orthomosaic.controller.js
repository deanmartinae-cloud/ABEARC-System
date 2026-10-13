const parseMapOrthomosaicJson = (value, fallback = null) => {
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

const mapOrthomosaicResponse = row => ({
  id: Number(row.id), name: row.name, original_filename: row.original_filename,
  uploaded_by_user_id: Number(row.uploaded_by_user_id), uploaded_by: row.uploaded_by || '', uploaded_at: row.uploaded_at,
  orthomosaic_date: row.orthomosaic_date, date_source: row.date_source, survey_date: row.survey_date,
  source_crs: row.source_crs, source_epsg: row.source_epsg, source_bbox: parseMapOrthomosaicJson(row.source_bbox_json, null),
  bounds: [row.west, row.south, row.east, row.north].every(value => Number.isFinite(Number(value)))
    ? [Number(row.west), Number(row.south), Number(row.east), Number(row.north)] : null,
  center: [row.center_lng, row.center_lat].every(value => Number.isFinite(Number(value)))
    ? [Number(row.center_lng), Number(row.center_lat)] : null,
  raster_width: Number(row.raster_width || 0), raster_height: Number(row.raster_height || 0),
  pixel_resolution_x: Number(row.pixel_resolution_x || 0), pixel_resolution_y: Number(row.pixel_resolution_y || 0),
  coverage_area_ha: row.coverage_area_ha != null && Number.isFinite(Number(row.coverage_area_ha)) ? Number(row.coverage_area_ha) : null,
  file_size: Number(row.file_size || 0), processing_status: row.processing_status,
  processing_error: row.processing_error || '', notes: row.notes || '', is_active: Number(row.is_active) === 1,
  created_at: row.created_at, updated_at: row.updated_at
});

const __routeController400 = async (req, res) => {
  try {
    const manage = await canManageDroneOrthomosaics(req.user);
    const where = manage ? '' : `WHERE o.is_active=1 AND o.processing_status='ready'`;
    const rows = await dbAll(`SELECT o.*, u.username AS uploaded_by FROM MapOrthomosaics o LEFT JOIN Users u ON u.id=o.uploaded_by_user_id ${where} ORDER BY COALESCE(o.orthomosaic_date, o.uploaded_at) DESC, o.id DESC`);
    res.set('Cache-Control', 'private, no-store');
    res.json({ orthomosaics: rows.map(mapOrthomosaicResponse), can_manage: manage });
  } catch (error) {
    logError('ORTHOMOSAIC_LIST_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to load drone orthomosaics.' });
  }
};

const __routeController401 = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A GeoTIFF file is required.' });
  try {
    cleanOrthomosaicStages();
    const inspection = await inspectOrthomosaicFile(req.file.path, req.body?.file_last_modified);
    const token = crypto.randomBytes(24).toString('hex');
    const extension = path.extname(req.file.originalname).toLowerCase();
    const stagedPath = path.join(MAP_ORTHOMOSAIC_TEMP_DIR, `${token}${extension}`);
    fs.renameSync(req.file.path, stagedPath);
    fs.writeFileSync(path.join(MAP_ORTHOMOSAIC_TEMP_DIR, `${token}.json`), JSON.stringify({
      token, user_id: Number(req.user.id), original_filename: req.file.originalname,
      file_size: Number(req.file.size || 0), staged_path: stagedPath, inspection, created_at: new Date().toISOString()
    }));
    res.json({ token, suggested_name: path.basename(req.file.originalname, extension).replace(/[_-]+/g, ' ').trim(), ...inspection, source_crs: undefined, has_valid_georeferencing: true });
  } catch (error) {
    try { fs.rmSync(req.file.path, { force: true }); } catch (_) {}
    res.status(error.statusCode || 400).json({ error: error.message || 'Unable to inspect this GeoTIFF.' });
  }
};

const __routeController402 = async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const name = String(req.body?.name || '').trim();
  const date = String(req.body?.orthomosaic_date || '').trim();
  const notes = String(req.body?.notes || '').trim();
  if (!/^[a-f0-9]{48}$/.test(token)) return res.status(400).json({ error: 'The staged upload token is invalid or expired.' });
  if (name.length < 3 || name.length > 160) return res.status(400).json({ error: 'Enter an orthomosaic name between 3 and 160 characters.' });
  if (date && !parseOrthomosaicDate(date)) return res.status(400).json({ error: 'Enter a valid orthomosaic date.' });
  const stageMetaPath = path.join(MAP_ORTHOMOSAIC_TEMP_DIR, `${token}.json`);
  if (!fs.existsSync(stageMetaPath)) return res.status(410).json({ error: 'The staged upload expired. Select the GeoTIFF again.' });
  const stage = parseMapOrthomosaicJson(fs.readFileSync(stageMetaPath, 'utf8'), null);
  if (!stage || Number(stage.user_id) !== Number(req.user.id) || !fs.existsSync(stage.staged_path)) return res.status(403).json({ error: 'This staged upload is not available to your account.' });
  let insertedId = null;
  try {
    const inspection = stage.inspection || {};
    const selectedDate = parseOrthomosaicDate(date) || inspection.date || null;
    const dateSource = selectedDate && selectedDate !== inspection.date ? 'manual_correction' : (inspection.date_source || 'manual');
    const result = await dbRun(`INSERT INTO MapOrthomosaics (
      name, original_filename, original_path, uploaded_by_user_id, uploaded_at, orthomosaic_date, date_source,
      source_crs, source_epsg, source_bbox_json, center_lng, center_lat, raster_width, raster_height,
      pixel_resolution_x, pixel_resolution_y, file_size, processing_status, notes, is_active, metadata_json, created_at, updated_at
    ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, 1, ?, ?, ?)`, [
      name, stage.original_filename, req.user.id, new Date().toISOString(), selectedDate, dateSource,
      inspection.source_crs || '', inspection.source_epsg || '', JSON.stringify(inspection.source_bbox || null),
      inspection.center?.[0] ?? null, inspection.center?.[1] ?? null, inspection.width || 0, inspection.height || 0,
      inspection.pixel_resolution_x || 0, inspection.pixel_resolution_y || 0, stage.file_size || 0, notes,
      JSON.stringify(inspection.metadata || {}), new Date().toISOString(), new Date().toISOString()
    ]);
    insertedId = Number(result.lastID);
    const originalDir = path.join(orthomosaicDatasetDir(insertedId), 'original');
    fs.mkdirSync(originalDir, { recursive: true });
    const safeOriginal = String(stage.original_filename || 'orthomosaic.tif').replace(/[^a-zA-Z0-9._-]/g, '_');
    const original = path.join(originalDir, safeOriginal);
    fs.renameSync(stage.staged_path, original);
    await dbRun(`UPDATE MapOrthomosaics SET original_path=? WHERE id=?`, [path.relative(DATA_DIR, original).replace(/\\/g, '/'), insertedId]);
    fs.rmSync(stageMetaPath, { force: true });
    logActivity({ req, action: 'ORTHOMOSAIC_UPLOADED', details: `${name} (#${insertedId}); ${stage.original_filename}` });
    queueOrthomosaicProcessing(insertedId, { id: req.user.id, username: req.user.username });
    res.status(202).json({ success: true, id: insertedId, status: 'processing' });
  } catch (error) {
    if (insertedId) {
      await dbRun(`DELETE FROM MapOrthomosaics WHERE id=?`, [insertedId]).catch(() => {});
      fs.rmSync(orthomosaicDatasetDir(insertedId), { recursive: true, force: true });
    }
    res.status(500).json({ error: error.message || 'Unable to save this orthomosaic.' });
  }
};

const __routeController403 = async (req, res) => {
  try {
  const id = Number(req.params.id);
  const row = await dbGet(`SELECT * FROM MapOrthomosaics WHERE id=?`, [id]);
  if (!row) return res.status(404).json({ error: 'Orthomosaic not found.' });
  const updates = []; const params = []; const changes = [];
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
    const name = String(req.body.name || '').trim();
    if (name.length < 3 || name.length > 160) return res.status(400).json({ error: 'Enter an orthomosaic name between 3 and 160 characters.' });
    updates.push('name=?'); params.push(name); changes.push(`renamed to ${name}`);
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'orthomosaic_date')) {
    const date = String(req.body.orthomosaic_date || '').trim();
    if (date && !parseOrthomosaicDate(date)) return res.status(400).json({ error: 'Enter a valid orthomosaic date.' });
    updates.push('orthomosaic_date=?', `date_source='manual_correction'`); params.push(date || null); changes.push('date updated');
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
    updates.push('notes=?'); params.push(String(req.body.notes || '').trim().slice(0, 4000)); changes.push('notes updated');
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
    const active = Boolean(req.body.is_active);
    if (active && row.processing_status !== 'ready') return res.status(400).json({ error: 'Only a ready orthomosaic can be activated.' });
    updates.push('is_active=?'); params.push(active ? 1 : 0); changes.push(active ? 'activated' : 'deactivated');
  }
  if (!updates.length) return res.json({ success: true, changed: false });
  updates.push('updated_at=?'); params.push(new Date().toISOString(), id);
  await dbRun(`UPDATE MapOrthomosaics SET ${updates.join(', ')} WHERE id=?`, params);
  logActivity({ req, action: 'ORTHOMOSAIC_METADATA_UPDATED', details: `${row.name} (#${id}): ${changes.join(', ')}` });
  res.json({ success: true, changed: true });
  } catch (error) {
    logError('ORTHOMOSAIC_UPDATE_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to update this orthomosaic.' });
  }
};

const __routeController404 = async (req, res) => {
  try {
  const id = Number(req.params.id);
  const row = await dbGet(`SELECT * FROM MapOrthomosaics WHERE id=?`, [id]);
  if (!row) return res.status(404).json({ error: 'Orthomosaic not found.' });
  orthomosaicCancelledIds.add(id);
  await dbRun(`DELETE FROM MapOrthomosaics WHERE id=?`, [id]);
  fs.rmSync(orthomosaicDatasetDir(id), { recursive: true, force: true });
  logActivity({ req, action: 'ORTHOMOSAIC_DELETED', details: `${row.name} (#${id})` });
  res.json({ success: true });
  } catch (error) {
    logError('ORTHOMOSAIC_DELETE_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to delete this orthomosaic.' });
  }
};

const __routeController405 = async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM MapOrthomosaics WHERE id=? AND processing_status='ready' AND is_active=1`, [Number(req.params.id)]);
    if (!row) return res.status(404).end();
    const tile = await getOrthomosaicTile(row, req.params.z, req.params.x, req.params.y);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400', 'Content-Length': tile.length });
    res.end(tile);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    logError('ORTHOMOSAIC_TILE_FAILED', error.message, error.stack);
    res.status(503).end();
  }
};

const __routeController406 = async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM MapOrthomosaics WHERE id=? AND processing_status='ready' AND is_active=1`, [Number(req.params.id)]);
    if (!row) return res.status(404).end();
    const thumbnail = await getOrthomosaicThumbnail(row);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400', 'Content-Length': thumbnail.length });
    res.end(thumbnail);
  } catch (error) {
    logError('ORTHOMOSAIC_THUMBNAIL_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).end();
  }
};
