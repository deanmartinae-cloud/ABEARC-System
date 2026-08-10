const mapMediaDuplicateResponse = (row) => ({
  success: true,
  duplicate: true,
  map_media_id: row.id,
  thumbnail_url: row.thumbnail_path ? `/api/map/media/${row.id}/thumbnail` : null,
  message: 'This photo was already uploaded to Geotag Map.'
});

const findMapMediaDuplicate = async ({ ownerUserId, clientCaptureId, fileHash, originalFilename, skipFilenameDuplicate = false, duplicateSourceType = null }) => {
  if (clientCaptureId) {
    const row = await dbGet(`SELECT * FROM MapMedia WHERE owner_user_id=? AND client_capture_id=?`, [ownerUserId, clientCaptureId]);
    if (row) return row;
  }
  if (fileHash) {
    const row = await dbGet(`SELECT * FROM MapMedia WHERE owner_user_id=? AND file_hash=?${duplicateSourceType ? ' AND source_type=?' : ''}`, duplicateSourceType ? [ownerUserId, fileHash, duplicateSourceType] : [ownerUserId, fileHash]);
    if (row) return row;
  }
  if (originalFilename && !skipFilenameDuplicate) {
    const row = await dbGet(`SELECT * FROM MapMedia WHERE owner_user_id=? AND original_filename=? ORDER BY id DESC LIMIT 1`, [ownerUserId, originalFilename]);
    if (row) return row;
  }
  return null;
};

const recoverMapMediaStampText = (relativePath) => {
  try {
    const absolute = mapMediaAbsolutePath('original', relativePath);
    if (!absolute || !fs.existsSync(absolute)) return '';
    const buffer = fs.readFileSync(absolute);
    const text = `${buffer.toString('utf8')}\n${buffer.toString('latin1')}`.replace(/\0+/g, '\n');
    const lines = [];
    ['Facing Zoning', 'Location Zoning', 'Zoning'].forEach(label => {
      const match = text.match(new RegExp(`${label}\\s*:?\\s*([^\\r\\n]{2,120})`, 'i'));
      if (match && match[1]) lines.push(`${label}: ${String(match[1]).trim()}`);
    });
    const known = mapZoningNameFromText(text);
    if (known) lines.push(`Zoning: ${known}`);
    return [...new Set(lines)].join('\n');
  } catch (_) {
    return '';
  }
};

const enrichMapMediaRowWithRecoveredStamp = (row = {}) => {
  if (!row || (row.zoning || row.location_zoning || row.facing_zoning || mapZoningNameFromText(row.stamp_text || row.remarks || ''))) return row;
  const recovered = recoverMapMediaStampText(row.original_path);
  if (!recovered) return row;
  const parsed = mapZoningFromStampText(recovered);
  return {
    ...row,
    stamp_text: [row.stamp_text, recovered].filter(Boolean).join('\n'),
    zoning: row.zoning || parsed.zoning || null,
    location_zoning: row.location_zoning || parsed.location_zoning || null,
    facing_zoning: row.facing_zoning || parsed.facing_zoning || null
  };
};

const validateMapProjectAccess = async (user, projectId) => {
  if (!projectId) return;
  const project = await dbGet(`SELECT id, assigned_user_id FROM Projects WHERE id=?`, [projectId]);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 400;
    throw err;
  }
  if (user.role === 'superadmin' || await canManageAllMapMedia(user)) return;
  if (Number(project.assigned_user_id || 0) && Number(project.assigned_user_id) !== Number(user.id)) {
    const err = new Error('You are not allowed to link photos to this project.');
    err.statusCode = 403;
    throw err;
  }
};

const storeMapMediaUpload = async ({ req, file, metadata, skipProjectAccessValidation = false, skipFilenameDuplicate = false, sourceType = 'geocam', duplicateSourceType = null }) => {
  if (!file) {
    const err = new Error('Photo file is required.');
    err.code = 'MAP_MEDIA_MISSING_FILE';
    err.statusCode = 400;
    throw err;
  }
  const meta = normalizeMapMediaMetadata(metadata);
  validateMapMediaDavaoLocation(meta);
  if (!skipProjectAccessValidation) await validateMapProjectAccess(req.user, meta.project_id);
  const fileHash = await hashFile(file.path);
  const duplicate = await findMapMediaDuplicate({
    ownerUserId: req.user.id,
    clientCaptureId: meta.client_capture_id,
    fileHash,
    originalFilename: file.originalname,
    skipFilenameDuplicate,
    duplicateSourceType
  });
  if (duplicate) {
    try { fs.unlinkSync(file.path); } catch (_) {}
    return mapMediaDuplicateResponse(duplicate);
  }
  const moved = moveMapMediaOriginal(file.path, file.originalname);
  let thumbnailPath = null;
  try {
    thumbnailPath = await generateMapMediaThumbnail(moved.absolute, moved.stored);
  } catch (err) {
    logError('MAP_MEDIA_THUMBNAIL_FAILED', err.message, err.stack);
  }
  let result;
  try {
    result = await dbRun(`
      INSERT INTO MapMedia (
        owner_user_id, uploaded_by_user_id, project_id, project_stage, calendar_event_id,
        client_capture_id, source_type, original_filename, stored_filename, original_path, thumbnail_path,
        file_size, file_type, file_hash, latitude, longitude, altitude_m, accuracy_m, bearing_deg,
        captured_at, zoning, location_zoning, facing_zoning, district, barangay, location_description,
        category, remarks, stamp_text, visibility, coordinate_source, location_status, map_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
      req.user.id, req.user.id, meta.project_id, meta.project_stage, meta.calendar_event_id,
      meta.client_capture_id, sourceType, file.originalname, moved.stored, moved.relative, thumbnailPath,
      file.size, file.mimetype, fileHash, Number.isFinite(meta.latitude) ? meta.latitude : null, Number.isFinite(meta.longitude) ? meta.longitude : null,
      Number.isFinite(meta.altitude_m) ? meta.altitude_m : null, Number.isFinite(meta.accuracy_m) ? meta.accuracy_m : null,
      Number.isFinite(meta.bearing_deg) ? meta.bearing_deg : null, meta.captured_at, meta.zoning, meta.location_zoning, meta.facing_zoning,
      meta.district, meta.barangay, meta.location_description, meta.category, meta.remarks, meta.stamp_text,
      meta.visibility, meta.coordinate_source, meta.location_status, new Date().toISOString(), new Date().toISOString()
    ]);
  } catch (err) {
    try { if (thumbnailPath) fs.unlinkSync(mapMediaAbsolutePath('thumbnail', thumbnailPath)); } catch (_) {}
    try { fs.unlinkSync(moved.absolute); } catch (_) {}
    throw err;
  }
  logActivity({ req, action: 'MAP_MEDIA_UPLOAD', projectId: meta.project_id, details: `Uploaded Geotag Map photo ${file.originalname} (${meta.location_status})` });
  return {
    success: true,
    duplicate: false,
    map_media_id: result.lastID,
    client_capture_id: meta.client_capture_id,
    location_status: meta.location_status,
    thumbnail_url: thumbnailPath ? `/api/map/media/${result.lastID}/thumbnail` : null
  };
};

const normalizeMapMediaSearchText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const mapMediaDamerauLevenshtein = (left, right) => {
  const a = String(left || '');
  const b = String(right || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
};

const mapMediaAllowedSearchDistance = (length) => {
  if (length <= 2) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
};

const mapMediaFuzzySearchScore = (row, rawQuery) => {
  const query = normalizeMapMediaSearchText(rawQuery);
  if (!query) return 0;
  const haystack = normalizeMapMediaSearchText([
    row.original_filename,
    row.remarks,
    row.stamp_text,
    row.location_description,
    row.category,
    row.zoning,
    row.location_zoning,
    row.facing_zoning,
    row.district,
    row.barangay,
    row.project_name,
    row.owner_username,
    row.uploaded_by_username
  ].filter(Boolean).join(' '));
  if (!haystack) return null;
  if (haystack.includes(query)) return 0;

  const queryTokens = [...new Set(query.split(' ').filter(Boolean))];
  const haystackTokens = [...new Set(haystack.split(' ').filter(Boolean))];
  let total = 0;
  for (const queryToken of queryTokens) {
    if (haystackTokens.includes(queryToken)) continue;
    if (haystackTokens.some(token => token.startsWith(queryToken) || (queryToken.length >= 4 && token.includes(queryToken)))) {
      total += 0.2;
      continue;
    }
    const allowed = mapMediaAllowedSearchDistance(queryToken.length);
    if (!allowed) return null;
    let bestDistance = Infinity;
    let bestLength = queryToken.length;
    for (const token of haystackTokens) {
      if (Math.abs(token.length - queryToken.length) > allowed) continue;
      const distance = mapMediaDamerauLevenshtein(queryToken, token);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLength = Math.max(queryToken.length, token.length);
      }
      if (bestDistance === 1) break;
    }
    if (bestDistance > allowed) return null;
    total += 0.5 + (bestDistance / Math.max(1, bestLength));
  }
  return 1 + (total / Math.max(1, queryTokens.length));
};
const queryMapMediaRows = async (req) => {
  const where = [];
  const params = [];
  const add = (sql, ...values) => { where.push(sql); params.push(...values); };
  const mapStatus = String(req.query.map_status || 'active');
  if (mapStatus !== 'all') add(`m.map_status = ?`, mapStatus);
  if (req.query.location_status) add(`m.location_status = ?`, String(req.query.location_status));
  else add(`m.location_status IN ('valid','low_accuracy','manual_location')`);
  ['project_id', 'user_id'].forEach(key => {
    if (req.query[key]) add(key === 'user_id' ? `m.owner_user_id = ?` : `m.${key} = ?`, Number(req.query[key]));
  });
  ['project_stage', 'district', 'barangay', 'category', 'zoning'].forEach(key => {
    if (req.query[key]) add(`m.${key} = ?`, String(req.query[key]));
  });
  if (req.query.my_uploads_only === 'true') add(`m.uploaded_by_user_id = ?`, req.user.id);
  if (req.query.unlinked_only === 'true') add(`m.project_id IS NULL`);
  if (req.query.low_accuracy_only === 'true') add(`m.location_status = 'low_accuracy'`);
  if (req.query.date_from) add(`datetime(COALESCE(m.captured_at, m.uploaded_at)) >= datetime(?)`, String(req.query.date_from));
  if (req.query.date_to) add(`datetime(COALESCE(m.captured_at, m.uploaded_at)) <= datetime(?)`, String(req.query.date_to));
  const west = toNullableNumber(req.query.west);
  const south = toNullableNumber(req.query.south);
  const east = toNullableNumber(req.query.east);
  const north = toNullableNumber(req.query.north);
  if ([west, south, east, north].every(Number.isFinite)) {
    add(`m.longitude BETWEEN ? AND ? AND m.latitude BETWEEN ? AND ?`, west, east, south, north);
  }

  if (req.query.cursor) add(`m.id < ?`, Number(req.query.cursor));
  const limit = Math.min(Math.max(Number(req.query.limit || 1000), 1), 5000);
  const search = String(req.query.search || '').trim();
  const candidateLimit = search ? 5000 : limit;
  const sql = `
    SELECT m.*, owner.username as owner_username, uploader.username as uploaded_by_username, p.name as project_name,
      EXISTS(SELECT 1 FROM ProjectDocumentMapMediaLinks link WHERE link.map_media_id = m.id) as project_document_linked
    FROM MapMedia m
    LEFT JOIN Users owner ON owner.id = m.owner_user_id
    LEFT JOIN Users uploader ON uploader.id = m.uploaded_by_user_id
    LEFT JOIN Projects p ON p.id = m.project_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY datetime(COALESCE(m.captured_at, m.uploaded_at)) DESC, m.id DESC
    LIMIT ?
  `;
  const rows = await dbAll(sql, [...params, candidateLimit]);
  if (!search) return rows;
  const normalizedSearch = normalizeMapMediaSearchText(search);
  const categoryMatches = rows.filter(row => normalizeMapMediaSearchText(row.category).includes(normalizedSearch));
  if (categoryMatches.length) return categoryMatches.slice(0, limit);
  return rows
    .map((row, index) => ({ row, index, score: mapMediaFuzzySearchScore(row, search) }))
    .filter(result => result.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.row);
};

const getMapMediaForUser = async (req, id) => {
  const row = await dbGet(`
    SELECT m.*, owner.username as owner_username, uploader.username as uploaded_by_username, p.name as project_name,
      EXISTS(SELECT 1 FROM ProjectDocumentMapMediaLinks link WHERE link.map_media_id = m.id) as project_document_linked
    FROM MapMedia m
    LEFT JOIN Users owner ON owner.id = m.owner_user_id
    LEFT JOIN Users uploader ON uploader.id = m.uploaded_by_user_id
    LEFT JOIN Projects p ON p.id = m.project_id
    WHERE m.id=?
  `, [id]);
  if (!row) return null;
  return enrichMapMediaRowWithRecoveredStamp(row);
};
