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

const mapMediaAdministrativeValueMissing = (value, kind = '') => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return true;
  // Legacy stamp parsing stored the text AFTER 'District' as the district.
  if (/\b(?:coordinates?|accuracy|elevation|bearing|zoning|date\/time)\s*[:=]/i.test(normalized)) return true;
  if (['unknown', 'unavailable', 'n/a', 'na', 'none', 'null', '-'].includes(normalized)) return true;
  if (/^(?:unknown|unavailable)\s+(?:barangay|brgy|bgry|district)$/.test(normalized)) return true;
  return false;
};

const mapMediaZoningValueMissing = value => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return !normalized || ['unknown', 'unknown/unclassified', 'unavailable', 'n/a', 'na', 'none', 'null', '-'].includes(normalized);
};

const mapMediaCoordinatePresent = value => value !== null && value !== undefined
  && String(value).trim() !== '' && Number.isFinite(Number(value));

const fillMapMediaSpatialMetadataFromCoordinates = async metadata => {
  if (!metadata || !mapMediaCoordinatePresent(metadata.latitude) || !mapMediaCoordinatePresent(metadata.longitude)) return metadata;
  const missingDistrict = mapMediaAdministrativeValueMissing(metadata.district, 'district');
  const missingBarangay = mapMediaAdministrativeValueMissing(metadata.barangay, 'barangay');
  const missingZoning = mapMediaZoningValueMissing(metadata.zoning) && mapMediaZoningValueMissing(metadata.location_zoning);
  if (!missingDistrict && !missingBarangay && !missingZoning) return metadata;
  try {
    const info = await getMapCoordinateInfo(Number(metadata.latitude), Number(metadata.longitude));
    if (missingDistrict && info?.district) metadata.district = info.district;
    if (missingBarangay && info?.barangay) metadata.barangay = info.barangay;
    if (mapMediaZoningValueMissing(metadata.location_zoning) && info?.zoning) metadata.location_zoning = info.zoning;
    if (mapMediaZoningValueMissing(metadata.zoning) && info?.zoning) metadata.zoning = info.zoning;
  } catch (error) {
    logError('MAP_MEDIA_SPATIAL_METADATA_LOOKUP_FAILED', error.message, error.stack);
  }
  return metadata;
};

const recoverStoredMapMediaMetadataFromOriginal = async row => {
  if (!row || !row.original_path) return row;
  const needsCoordinates = !mapMediaCoordinatePresent(row.latitude) || !mapMediaCoordinatePresent(row.longitude);
  const needsDescription = !String(row.location_description || '').trim();
  const needsAccuracy = !mapMediaCoordinatePresent(row.accuracy_m);
  if (!needsCoordinates && !needsDescription && !needsAccuracy) return row;
  try {
    const absolute = mapMediaAbsolutePath('original', row.original_path);
    if (!absolute || !fs.existsSync(absolute)) return row;
    const inspected = await inspectProjectGeotagImage(absolute, row.original_filename || '').catch(() => null);
    if (!inspected) return row;
    const before = {
      latitude: row.latitude,
      longitude: row.longitude,
      district: row.district,
      barangay: row.barangay,
      location_description: row.location_description,
      captured_at: row.captured_at,
      stamp_text: row.stamp_text,
      accuracy_m: row.accuracy_m
    };
    // Recover a complete pair; never combine one stored axis with another source.
    if (!mapMediaCoordinatePresent(row.latitude) || !mapMediaCoordinatePresent(row.longitude)) {
      const hasExifPair = mapMediaCoordinatePresent(inspected.embeddedLatitude) && mapMediaCoordinatePresent(inspected.embeddedLongitude);
      const latitude = hasExifPair ? inspected.embeddedLatitude : inspected.latitude;
      const longitude = hasExifPair ? inspected.embeddedLongitude : inspected.longitude;
      if (mapMediaCoordinatePresent(latitude) && mapMediaCoordinatePresent(longitude)
          && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180) {
        row.latitude = Number(latitude);
        row.longitude = Number(longitude);
      }
    }
    // Administrative names come exclusively from the packaged CPDO polygons.
    if (!String(row.location_description || '').trim() && inspected.address?.address) row.location_description = String(inspected.address.address).trim();
    if (!String(row.captured_at || '').trim() && inspected.capturedAt) row.captured_at = inspected.capturedAt;
    if (!String(row.stamp_text || '').trim() && inspected.stampText) row.stamp_text = inspected.stampText;
    if (Number.isFinite(inspected.accuracyM) && inspected.accuracyM >= 0) row.accuracy_m = inspected.accuracyM;
    const changed = Object.keys(before).some(key => String(before[key] ?? '') !== String(row[key] ?? ''));
    if (changed && Number(row.id) > 0) {
      await dbRun(`UPDATE MapMedia SET latitude=?, longitude=?, district=?, barangay=?, location_description=?, captured_at=?, stamp_text=?, accuracy_m=?, updated_at=? WHERE id=?`, [
        mapMediaCoordinatePresent(row.latitude) ? Number(row.latitude) : null,
        mapMediaCoordinatePresent(row.longitude) ? Number(row.longitude) : null,
        row.district || null,
        row.barangay || null,
        row.location_description || null,
        row.captured_at || null,
        row.stamp_text || null,
        mapMediaCoordinatePresent(row.accuracy_m) ? Number(row.accuracy_m) : null,
        new Date().toISOString(),
        Number(row.id)
      ]).catch(error => logError('MAP_MEDIA_ORIGINAL_METADATA_SAVE_FAILED', error.message, error.stack));
    }
  } catch (error) {
    logError('MAP_MEDIA_ORIGINAL_METADATA_RECOVERY_FAILED', error.message, error.stack);
  }
  return row;
};

const enrichStoredMapMediaSpatialMetadata = async row => {
  if (!row) return row;
  await recoverStoredMapMediaMetadataFromOriginal(row);
  if (!mapMediaCoordinatePresent(row.latitude) || !mapMediaCoordinatePresent(row.longitude)) return row;
  const before = { district: row.district, barangay: row.barangay, zoning: row.zoning, location_zoning: row.location_zoning };
  await fillMapMediaSpatialMetadataFromCoordinates(row);
  const changed = ['district', 'barangay', 'zoning', 'location_zoning'].some(key => String(before[key] || '') !== String(row[key] || ''));
  if (changed && Number(row.id) > 0) {
    await dbRun(`UPDATE MapMedia SET district=?, barangay=?, zoning=?, location_zoning=?, updated_at=? WHERE id=?`, [
      row.district || null, row.barangay || null, row.zoning || null, row.location_zoning || null, new Date().toISOString(), Number(row.id)
    ]).catch(error => logError('MAP_MEDIA_SPATIAL_METADATA_SAVE_FAILED', error.message, error.stack));
  }
  return row;
};

const enrichMapMediaRowsAdministrativeMetadata = async (rows = []) => {
  const targets = (rows || []).filter(row => {
    const district = String(row.district || '').trim();
    const barangay = String(row.barangay || '').trim();
    const hasCoordinates = mapMediaCoordinatePresent(row.latitude) && mapMediaCoordinatePresent(row.longitude);
    const hasOriginal = Boolean(String(row.original_path || '').trim());
    return (hasCoordinates || hasOriginal)
      && (mapMediaAdministrativeValueMissing(district, 'district')
        || mapMediaAdministrativeValueMissing(barangay, 'barangay'));
  });
  if (!targets.length) return rows;

  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const row = targets[cursor++];
      try {
        await recoverStoredMapMediaMetadataFromOriginal(row);
        if (!mapMediaCoordinatePresent(row.latitude) || !mapMediaCoordinatePresent(row.longitude)) continue;
        const location = await getMapBarangayAtCoordinate(Number(row.latitude), Number(row.longitude));
        if (!location) continue;
        const districtMissing = mapMediaAdministrativeValueMissing(row.district, 'district');
        const barangayMissing = mapMediaAdministrativeValueMissing(row.barangay, 'barangay');
        let changed = false;
        if (districtMissing && location.district) { row.district = location.district; changed = true; }
        if (barangayMissing && location.barangay) { row.barangay = location.barangay; changed = true; }
        if (changed && Number(row.id) > 0) {
          await dbRun(`UPDATE MapMedia SET district=?, barangay=?, updated_at=? WHERE id=?`, [
            row.district || null, row.barangay || null, new Date().toISOString(), Number(row.id)
          ]);
        }
      } catch (error) {
        logError('MAP_MEDIA_ADMIN_METADATA_LOOKUP_FAILED', error.message, error.stack);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, targets.length || 1) }, worker));
  return rows;
};

const enrichMapMediaRowsSpatialMetadata = async (rows = [], limit = 60) => {
  const targets = (rows || []).filter(row => {
    const hasCoordinates = mapMediaCoordinatePresent(row.latitude) && mapMediaCoordinatePresent(row.longitude);
    const hasOriginal = Boolean(String(row.original_path || '').trim());
    return (hasCoordinates || hasOriginal)
      && (mapMediaAdministrativeValueMissing(row.district, 'district')
        || mapMediaAdministrativeValueMissing(row.barangay, 'barangay')
        || (mapMediaZoningValueMissing(row.zoning) && mapMediaZoningValueMissing(row.location_zoning)));
  })
    .slice(0, Math.max(0, Number(limit) || 0));
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const row = targets[cursor++];
      await enrichStoredMapMediaSpatialMetadata(row);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, targets.length || 1) }, worker));
  return rows;
};

const backfillMapMediaCaptureDates = async (limit = 40) => {
  const rows = await dbAll(`
    SELECT id, original_path, original_filename
    FROM MapMedia
    WHERE COALESCE(TRIM(captured_at),'')=''
      AND COALESCE(TRIM(original_path),'')<>''
    ORDER BY id
    LIMIT ?
  `, [Math.max(1, Math.min(100, Number(limit) || 40))]);
  let updated = 0;
  for (const row of rows) {
    try {
      const absolute = mapMediaAbsolutePath('original', row.original_path);
      if (!absolute || !fs.existsSync(absolute)) continue;
      const inspected = await inspectProjectGeotagImage(absolute, row.original_filename).catch(() => null);
      const capturedAt = inspected?.capturedAt || projectGeotagFilenameCapturedAt(row.original_filename);
      if (!capturedAt) continue;
      await dbRun(`UPDATE MapMedia SET captured_at=?, updated_at=? WHERE id=? AND COALESCE(TRIM(captured_at),'')=''`, [
        capturedAt, new Date().toISOString(), Number(row.id)
      ]);
      updated += 1;
    } catch (error) {
      logError('MAP_MEDIA_CAPTURE_DATE_BACKFILL_ITEM_FAILED', error.message, error.stack);
    }
  }
  if (rows.length) console.log(`Map media capture-date backfill checked ${rows.length} photo(s); updated ${updated}.`);
  return rows.length;
};

const backfillMapMediaMetadataInBackground = async () => {

  for (let batch = 0; batch < 10; batch += 1) {
    const checked = await backfillMapMediaCaptureDates(40);
    if (checked < 40) break;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
};

const backfillMapMediaSpatialMetadata = async () => {
  const rows = await dbAll('SELECT * FROM MapMedia ORDER BY id');
  const counts = { repaired: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    if (!mapMediaAdministrativeValueMissing(row.barangay, 'barangay')
        && !mapMediaAdministrativeValueMissing(row.district, 'district')) {
      counts.skipped++;
      console.log('Map media ' + row.id + ': skipped (existing administrative values).');
      continue;
    }
    try {
      await enrichMapMediaRowsAdministrativeMetadata([row]);
      const saved = await dbGet('SELECT latitude, longitude, barangay, district FROM MapMedia WHERE id=?', [row.id]);
      if (!mapMediaAdministrativeValueMissing(saved.barangay, 'barangay')
          && !mapMediaAdministrativeValueMissing(saved.district, 'district')) {
        counts.repaired++;
        console.log('Map media ' + row.id + ': repaired (' + saved.barangay + ', ' + saved.district + ').');
      } else {
        counts.failed++;
        const reason = !mapMediaCoordinatePresent(saved.latitude) || !mapMediaCoordinatePresent(saved.longitude)
          ? 'no recoverable GPS; original missing or metadata unreadable'
          : 'no matching packaged CPDO polygon or incomplete polygon properties';
        console.warn('Map media ' + row.id + ': failed (' + reason + ').');
      }
    } catch (error) {
      counts.failed++;
      console.error('Map media ' + row.id + ': failed (' + error.message + ').');
    }
  }
  console.log('Map media offline administrative backfill:', JSON.stringify(counts));
  return counts;
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
  await fillMapMediaSpatialMetadataFromCoordinates(meta);
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
const mapMediaReadAccessClause = async (req, alias = 'm') => {
  const manager = await canManageAllMapMedia(req.user);
  if (manager) return { sql: '1=1', params: [] };
  return {
    sql: `(LOWER(COALESCE(${alias}.visibility, 'organization')) NOT IN ('private','owner') OR ${alias}.owner_user_id = ?)`,
    params: [Number(req.user.id)]
  };
};

const mapMediaHaversineMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = value => Number(value) * Math.PI / 180;
  const aLat = Number(lat1); const aLon = Number(lon1); const bLat = Number(lat2); const bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return Infinity;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
};

const mapMediaSeriesSemanticClause = (anchor, alias = 'm') => {
  if (Number(anchor.inventory_item_id || 0) > 0) {
    return { sql: `${alias}.inventory_item_id = ?`, params: [Number(anchor.inventory_item_id)] };
  }
  const category = String(anchor.category || 'General').trim().toLowerCase();
  if (Number(anchor.project_id || 0) > 0) {
    return {
      sql: `${alias}.project_id = ? AND LOWER(COALESCE(${alias}.category, 'General')) = ?`,
      params: [Number(anchor.project_id), category]
    };
  }
  return {
    sql: `LOWER(COALESCE(${alias}.category, 'General')) = ? AND COALESCE(${alias}.district, '') = ? AND COALESCE(${alias}.barangay, '') = ?`,
    params: [category, String(anchor.district || ''), String(anchor.barangay || '')]
  };
};

const queryMapMediaSiteSeries = async (req, anchorId, radiusM = 25) => {
  const anchor = await getMapMediaForUser(req, anchorId);
  if (!anchor) return null;
  const latitude = Number(anchor.latitude);
  const longitude = Number(anchor.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { anchor, photos: [] };
  const radius = Math.min(100, Math.max(5, Number(radiusM) || 25));
  const latDelta = radius / 111320;
  const lonDelta = radius / Math.max(1000, 111320 * Math.cos(latitude * Math.PI / 180));
  const access = await mapMediaReadAccessClause(req, 'm');
  const semantic = mapMediaSeriesSemanticClause(anchor, 'm');
  const rows = await dbAll(`
    SELECT m.*, owner.username as owner_username, uploader.username as uploaded_by_username, p.name as project_name,
      EXISTS(SELECT 1 FROM ProjectDocumentMapMediaLinks link WHERE link.map_media_id = m.id) as project_document_linked
    FROM MapMedia m
    LEFT JOIN Users owner ON owner.id = m.owner_user_id
    LEFT JOIN Users uploader ON uploader.id = m.uploaded_by_user_id
    LEFT JOIN Projects p ON p.id = m.project_id
    WHERE ${access.sql}
      AND m.map_status='active'
      AND m.location_status IN ('valid','low_accuracy','manual_location')
      AND m.latitude BETWEEN ? AND ? AND m.longitude BETWEEN ? AND ?
      AND ${semantic.sql}
    ORDER BY datetime(COALESCE(m.captured_at, m.uploaded_at)) ASC, m.id ASC
    LIMIT 300
  `, [...access.params, latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta, ...semantic.params]);
  const photos = rows.filter(row => mapMediaHaversineMeters(latitude, longitude, row.latitude, row.longitude) <= radius);
  return { anchor, photos };
};

const queryMapMediaRows = async (req) => {
  const where = [];
  const params = [];
  const add = (sql, ...values) => { where.push(sql); params.push(...values); };
  const access = await mapMediaReadAccessClause(req, 'm');
  add(access.sql, ...access.params);
  const boundaryType = String(req.query.boundary_type || '').trim().toLowerCase();
  const boundaryName = String(req.query.boundary_name || '').trim();
  const boundaryCode = String(req.query.boundary_code || '').trim();
  let administrativeBoundaryFeature = null;
  if (boundaryName && ['district', 'barangay'].includes(boundaryType)) {
    administrativeBoundaryFeature = getMapAdministrativeBoundaryFeature(boundaryName, boundaryType, boundaryCode);
    if (!administrativeBoundaryFeature) return [];
    const boundaryBox = administrativeBoundaryFeature.bbox;
    if (Array.isArray(boundaryBox) && boundaryBox.length === 4 && boundaryBox.every(Number.isFinite)) {
      add(`m.longitude BETWEEN ? AND ? AND m.latitude BETWEEN ? AND ?`, boundaryBox[0], boundaryBox[2], boundaryBox[1], boundaryBox[3]);
    }
  }
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
  if (req.query.updated_after) add(`datetime(COALESCE(m.updated_at, m.created_at, m.uploaded_at)) > datetime(?)`, String(req.query.updated_after));
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
  const candidateLimit = search || administrativeBoundaryFeature ? 5000 : limit;
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
  // Administrative names are lightweight local polygon lookups and must be
  // resolved for every returned photo, not only the first metadata batch.
  await enrichMapMediaRowsAdministrativeMetadata(rows);
  // Zoning recovery is heavier (SQLite geometry lookup), so keep it bounded.
  await enrichMapMediaRowsSpatialMetadata(rows, 60);
  const spatialRows = administrativeBoundaryFeature
    ? rows.filter(row => mapAdministrativeFeatureContainsPoint(administrativeBoundaryFeature, row.longitude, row.latitude))
    : rows;
  if (!search) return spatialRows.slice(0, limit);
  const normalizedSearch = normalizeMapMediaSearchText(search);
  const categoryMatches = spatialRows.filter(row => normalizeMapMediaSearchText(row.category).includes(normalizedSearch));
  if (categoryMatches.length) return categoryMatches.slice(0, limit);
  return spatialRows
    .map((row, index) => ({ row, index, score: mapMediaFuzzySearchScore(row, search) }))
    .filter(result => result.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.row);
};

const queryActiveMapMediaRowsByIds = async (ids = []) => {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : [])
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))]
    .slice(0, 5000);
  if (!normalizedIds.length) return [];
  const rows = [];
  for (let offset = 0; offset < normalizedIds.length; offset += 400) {
    const chunk = normalizedIds.slice(offset, offset + 400);
    const placeholders = chunk.map(() => '?').join(',');
    rows.push(...await dbAll(`
      SELECT m.*, owner.username as owner_username, uploader.username as uploaded_by_username, p.name as project_name,
        EXISTS(SELECT 1 FROM ProjectDocumentMapMediaLinks link WHERE link.map_media_id = m.id) as project_document_linked
      FROM MapMedia m
      LEFT JOIN Users owner ON owner.id = m.owner_user_id
      LEFT JOIN Users uploader ON uploader.id = m.uploaded_by_user_id
      LEFT JOIN Projects p ON p.id = m.project_id
      WHERE m.id IN (${placeholders})
        AND m.map_status='active'
        AND m.location_status IN ('valid','low_accuracy','manual_location')
    `, chunk));
  }
  const order = new Map(normalizedIds.map((id, index) => [id, index]));
  return rows.sort((a, b) => order.get(Number(a.id)) - order.get(Number(b.id)));
};

const getMapMediaForUser = async (req, id, { enrich = true } = {}) => {
  const access = await mapMediaReadAccessClause(req, 'm');
  const row = await dbGet(`
    SELECT m.*, owner.username as owner_username, uploader.username as uploaded_by_username, p.name as project_name,
      EXISTS(SELECT 1 FROM ProjectDocumentMapMediaLinks link WHERE link.map_media_id = m.id) as project_document_linked
    FROM MapMedia m
    LEFT JOIN Users owner ON owner.id = m.owner_user_id
    LEFT JOIN Users uploader ON uploader.id = m.uploaded_by_user_id
    LEFT JOIN Projects p ON p.id = m.project_id
    WHERE m.id=? AND ${access.sql}
  `, [id, ...access.params]);
  if (!row) return null;
  if (!enrich) return row;
  await enrichStoredMapMediaSpatialMetadata(row);
  return enrichMapMediaRowWithRecoveredStamp(row);
};
