const MAP_LAYOUT_STATE_MAX_BYTES = 5 * 1024 * 1024;

const normalizeMapLayoutName = (value) => String(value || '').trim().slice(0, 160);
const normalizeMapLayoutDescription = (value) => String(value || '').trim().slice(0, 1000);

const serializeMapLayoutState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('A valid map layout state is required.');
    error.statusCode = 400;
    throw error;
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAP_LAYOUT_STATE_MAX_BYTES) {
    const error = new Error('This map layout is too large to save.');
    error.statusCode = 413;
    throw error;
  }
  return serialized;
};

const mapLayoutSummary = row => ({
  id: Number(row.id),
  name: row.name,
  description: row.description || '',
  state_version: Number(row.state_version || 1),
  created_at: row.created_at,
  updated_at: row.updated_at
});

const __routeController420 = async (req, res) => {
  try {
    const rows = await dbAll(`SELECT id, name, description, state_version, created_at, updated_at
      FROM MapLayouts WHERE owner_user_id=? ORDER BY datetime(updated_at) DESC, id DESC`, [req.user.id]);
    res.json({ layouts: rows.map(mapLayoutSummary) });
  } catch (error) {
    logError('MAP_LAYOUT_LIST_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to load map layouts.' });
  }
};

const __routeController421 = async (req, res) => {
  try {
    const row = await dbGet(`SELECT id, name, description, state_json, state_version, created_at, updated_at
      FROM MapLayouts WHERE id=? AND owner_user_id=?`, [Number(req.params.id), req.user.id]);
    if (!row) return res.status(404).json({ error: 'Map layout not found.' });
    let state;
    try { state = JSON.parse(row.state_json); } catch (_) { state = null; }
    if (!state || typeof state !== 'object') return res.status(500).json({ error: 'This saved map layout is invalid.' });
    const frozenPhotoIds = Array.isArray(state?.photos?.frozenPhotoIds) ? state.photos.frozenPhotoIds : [];
    const photoRows = await queryActiveMapMediaRowsByIds(frozenPhotoIds);
    const canReadPrivatePhotos = await canManageAllMapMedia(req.user);
    const photoFeatures = photoRows
      .filter(item => canReadPrivatePhotos || !['private','owner'].includes(String(item.visibility || 'organization').toLowerCase()) || Number(item.owner_user_id) === Number(req.user.id))
      .filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
      .map(mapMediaGeoJsonFeature);
    res.json({ ...mapLayoutSummary(row), state, photo_features: photoFeatures });
  } catch (error) {
    logError('MAP_LAYOUT_GET_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to open this map layout.' });
  }
};

const __routeController422 = async (req, res) => {
  try {
    const name = normalizeMapLayoutName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Enter a name for this map layout.' });
    const description = normalizeMapLayoutDescription(req.body?.description);
    const stateVersion = Math.max(1, Math.min(999, Number(req.body?.state_version) || 1));
    const stateJson = serializeMapLayoutState(req.body?.state);
    const now = new Date().toISOString();
    const result = await dbRun(`INSERT INTO MapLayouts
      (owner_user_id, name, description, state_json, state_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.user.id, name, description, stateJson, stateVersion, now, now]);
    const id = Number(result.lastID);
    logActivity({ req, action: 'MAP_LAYOUT_CREATED', details: `${name} (#${id})` });
    res.status(201).json({ id, name, description, state_version: stateVersion, created_at: now, updated_at: now });
  } catch (error) {
    logError('MAP_LAYOUT_CREATE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 500).json({ error: error.message || 'Unable to save this map layout.' });
  }
};

const __routeController423 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await dbGet(`SELECT id, name FROM MapLayouts WHERE id=? AND owner_user_id=?`, [id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Map layout not found.' });
    const updates = [];
    const params = [];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const name = normalizeMapLayoutName(req.body.name);
      if (!name) return res.status(400).json({ error: 'Enter a name for this map layout.' });
      updates.push('name=?'); params.push(name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
      updates.push('description=?'); params.push(normalizeMapLayoutDescription(req.body.description));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'state')) {
      updates.push('state_json=?'); params.push(serializeMapLayoutState(req.body.state));
      updates.push('state_version=?'); params.push(Math.max(1, Math.min(999, Number(req.body?.state_version) || 1)));
    }
    if (!updates.length) return res.json({ success: true, changed: false });
    const now = new Date().toISOString();
    updates.push('updated_at=?'); params.push(now, id, req.user.id);
    await dbRun(`UPDATE MapLayouts SET ${updates.join(', ')} WHERE id=? AND owner_user_id=?`, params);
    const row = await dbGet(`SELECT id, name, description, state_version, created_at, updated_at FROM MapLayouts WHERE id=?`, [id]);
    logActivity({ req, action: 'MAP_LAYOUT_UPDATED', details: `${row?.name || existing.name} (#${id})` });
    res.json({ success: true, changed: true, ...mapLayoutSummary(row) });
  } catch (error) {
    logError('MAP_LAYOUT_UPDATE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 500).json({ error: error.message || 'Unable to update this map layout.' });
  }
};

const __routeController424 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await dbGet(`SELECT id, name FROM MapLayouts WHERE id=? AND owner_user_id=?`, [id, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Map layout not found.' });
    await dbRun(`DELETE FROM MapLayouts WHERE id=? AND owner_user_id=?`, [id, req.user.id]);
    logActivity({ req, action: 'MAP_LAYOUT_DELETED', details: `${row.name} (#${id})` });
    res.json({ success: true });
  } catch (error) {
    logError('MAP_LAYOUT_DELETE_FAILED', error.message, error.stack);
    res.status(500).json({ error: 'Unable to delete this map layout.' });
  }
};
