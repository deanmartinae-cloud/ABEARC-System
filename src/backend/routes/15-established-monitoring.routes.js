// --- ESTABLISHED PROJECT & ASSET MONITORING ---
const findAvailableMonitoringUser = async (userId) => {
  const id = Number(userId || 0);
  if (!Number.isInteger(id) || id <= 0) return null;
  return dbGet(`
    SELECT id, username
    FROM Users
    WHERE id = ?
      AND role != 'system'
      AND COALESCE(is_system_account, 0) = 0
      AND COALESCE(hidden_from_workflows, 0) = 0
  `, [id]);
};

const validateMonitoringInventoryPayload = async (payload = {}, { creating = false } = {}) => {
  if (creating && !payload.asset_name) return 'Asset / project name is required.';
  if (Object.prototype.hasOwnProperty.call(payload, 'asset_name') && !payload.asset_name) return 'Asset / project name cannot be blank.';
  if (Object.prototype.hasOwnProperty.call(payload, 'inventory_code') && !payload.inventory_code) return 'Inventory code cannot be blank.';
  if (Object.prototype.hasOwnProperty.call(payload, 'monitoring_frequency_months') && !Number.isFinite(Number(payload.monitoring_frequency_months))) return 'Monitoring frequency must be a valid number.';
  if (Object.prototype.hasOwnProperty.call(payload, 'project_cost') && payload.project_cost !== null && (!Number.isFinite(Number(payload.project_cost)) || Number(payload.project_cost) < 0)) return 'Project cost must be a valid non-negative number.';
  if (Object.prototype.hasOwnProperty.call(payload, 'latitude') && payload.latitude !== null && (!Number.isFinite(Number(payload.latitude)) || Number(payload.latitude) < -90 || Number(payload.latitude) > 90)) return 'Latitude must be between -90 and 90.';
  if (Object.prototype.hasOwnProperty.call(payload, 'longitude') && payload.longitude !== null && (!Number.isFinite(Number(payload.longitude)) || Number(payload.longitude) < -180 || Number(payload.longitude) > 180)) return 'Longitude must be between -180 and 180.';
  for (const field of ['date_completed', 'warranty_expiry', 'date_received', 'next_monitoring_date']) {
    if (payload[field] && !parseMonitoringDateKey(payload[field])) return `${field.replace(/_/g, ' ')} must be a valid date.`;
    if (payload[field]) payload[field] = parseMonitoringDateKey(payload[field]);
  }
  if (payload.priority_override && !['Critical', 'High', 'Medium', 'Low'].includes(payload.priority_override)) return 'Priority override is invalid.';
  if (payload.lifecycle_status && !['Active', 'Archived'].includes(payload.lifecycle_status)) return 'Lifecycle status is invalid.';
  if (payload.assigned_user_id) {
    const user = await findAvailableMonitoringUser(payload.assigned_user_id);
    if (!user) return 'The selected assigned user is not available.';
  }
  if (payload.linked_project_id) {
    const project = await dbGet(`SELECT id FROM Projects WHERE id = ?`, [Number(payload.linked_project_id)]);
    if (!project) return 'The selected linked project does not exist.';
  }
  return null;
};

app.get('/api/monitoring/geotag-photos/:id/thumbnail', checkPrivilege('view_monitoring_inventory'), async (req, res) => {
  try {
    const photo = await dbGet(`SELECT id, owner_user_id, monitoring_record_id, thumbnail_path FROM MapMedia WHERE id = ?`, [Number(req.params.id)]);
    if (!photo) return res.status(404).json({ error: 'GeoCam monitoring photo not found.' });
    const canView = Number(photo.monitoring_record_id || 0) > 0
      || Number(photo.owner_user_id) === Number(req.user.id)
      || await canManageAllMapMedia(req.user);
    if (!canView) return res.status(403).json({ error: 'You are not allowed to view this GeoCam photo.' });
    const absolute = mapMediaAbsolutePath('thumbnail', photo.thumbnail_path);
    if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: 'GeoCam photo thumbnail is missing.' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(absolute);
  } catch (error) {
    logError('MONITORING_GEOTAG_THUMBNAIL', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load GeoCam monitoring photo.' });
  }
});

app.get('/api/monitoring/dashboard', checkPrivilege('view_monitoring_inventory'), async (req, res) => {
  try {
    const items = await loadMonitoringInventoryRows();
    const activeItems = items.filter(item => item.lifecycle_status !== 'Archived');
    const counts = {
      total: items.length,
      active: activeItems.length,
      operational: activeItems.filter(item => /operational|functional/i.test(String(item.condition_status || '')) && !/non[- ]?operational/i.test(String(item.condition_status || ''))).length,
      non_operational: activeItems.filter(item => /non[- ]?operational|irreparable|unsafe/i.test(String(item.condition_status || ''))).length,
      never_monitored: activeItems.filter(item => item.due_status === 'Never Monitored').length,
      overdue: activeItems.filter(item => item.due_status === 'Overdue').length,
      due_soon: activeItems.filter(item => item.due_status === 'Due Soon').length,
      open_tasks: activeItems.reduce((sum, item) => sum + Number(item.open_task_count || 0), 0),
      critical: activeItems.filter(item => item.computed_priority === 'Critical').length,
      high: activeItems.filter(item => item.computed_priority === 'High').length
    };
    const summarize = (field) => Object.entries(items.reduce((acc, item) => {
      const key = String(item[field] || 'Unspecified').trim() || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const priority_queue = [...items]
      .filter(item => item.lifecycle_status !== 'Archived' && ['Critical','High','Medium'].includes(item.computed_priority))
      .sort((a, b) => (monitoringPriorityRank[a.computed_priority] - monitoringPriorityRank[b.computed_priority]) || String(a.next_monitoring_date || '').localeCompare(String(b.next_monitoring_date || '')) || a.inventory_code.localeCompare(b.inventory_code))
      .slice(0, 30);
    res.json({ counts, by_type: summarize('asset_type'), by_status: summarize('condition_status'), by_district: summarize('district'), priority_queue });
  } catch (error) {
    logError('MONITORING_DASHBOARD', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load monitoring dashboard.' });
  }
});

app.get('/api/monitoring/inventory', checkPrivilege('view_monitoring_inventory'), async (req, res) => {
  try {
    const items = await loadMonitoringInventoryRows();
    res.json(items);
  } catch (error) {
    logError('MONITORING_INVENTORY_LIST', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load monitoring inventory.' });
  }
});

app.get('/api/monitoring/inventory/:id/geotag-photos', checkPrivilege('conduct_monitoring_visit'), async (req, res) => {
  try {
    const inventoryId = Number(req.params.id);
    const item = await dbGet(`SELECT id, lifecycle_status FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    if (item.lifecycle_status === 'Archived') return res.status(409).json({ error: 'Restore this inventory record before recording another monitoring visit.' });
    const manageAll = await canManageAllMapMedia(req.user);
    const rows = await dbAll(`
      SELECT m.*, owner.username AS owner_username
      FROM MapMedia m
      LEFT JOIN Users owner ON owner.id = m.owner_user_id
      WHERE m.source_type = 'geocam'
        AND m.map_status = 'active'
        AND m.monitoring_record_id IS NULL
        AND (m.inventory_item_id IS NULL OR m.inventory_item_id = ?)
        AND m.latitude IS NOT NULL
        AND m.longitude IS NOT NULL
        AND m.location_status IN ('valid', 'low_accuracy')
        AND (? = 1 OR m.owner_user_id = ?)
      ORDER BY datetime(COALESCE(m.captured_at, m.uploaded_at)) DESC, m.id DESC
      LIMIT 1000
    `, [inventoryId, manageAll ? 1 : 0, req.user.id]);
    const photos = rows
      .filter(row => {
        const original = mapMediaAbsolutePath('original', row.original_path);
        return original && fs.existsSync(original) && !validateMonitoringGeoCamMapPhoto(row);
      })
      .map(monitoringMapPhotoPublicFields);
    res.json({ photos });
  } catch (error) {
    logError('MONITORING_GEOTAG_PHOTO_LIST', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load eligible GeoCam photos from Geotag Map.' });
  }
});

app.get('/api/monitoring/inventory/:id/my-drive-photos', checkPrivilege('conduct_monitoring_visit'), async (req, res) => {
  try {
    const inventoryId = Number(req.params.id);
    const item = await dbGet(`SELECT id, lifecycle_status FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    if (item.lifecycle_status === 'Archived') return res.status(409).json({ error: 'Restore this inventory record before recording another monitoring visit.' });
    const rows = await dbAll(`
      SELECT *
      FROM UserDriveFiles
      WHERE owner_user_id = ?
        AND deleted_at IS NULL
        AND status = 'active'
        AND lower(COALESCE(tags, '')) LIKE '%abedgeocam%'
        AND lower(COALESCE(tags, '')) LIKE '%geotagged%'
        AND lower(COALESCE(file_ext, '')) IN ('.jpg', '.jpeg', '.png', '.webp')
      ORDER BY datetime(uploaded_at) DESC, id DESC
      LIMIT 500
    `, [req.user.id]);
    const photos = [];
    for (const row of rows) {
      const metadata = monitoringMetadataFromDrivePhoto(row);
      if (validateMonitoringGeoCamProofMetadata(metadata)) continue;
      const absolute = userDriveAbsolutePath(row);
      if (!absolute || !fs.existsSync(absolute)) continue;
      const fileHash = await hashFile(absolute);
      const alreadyUsed = await dbGet(`SELECT id FROM MapMedia WHERE file_hash = ? AND monitoring_record_id IS NOT NULL LIMIT 1`, [fileHash]);
      if (alreadyUsed) continue;
      photos.push(monitoringDrivePhotoPublicFields(row, metadata));
      if (photos.length >= 100) break;
    }
    res.json({ photos });
  } catch (error) {
    logError('MONITORING_MY_DRIVE_PHOTO_LIST', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load eligible GeoCam photos from My Drive.' });
  }
});

app.get('/api/monitoring/inventory/:id', checkPrivilege('view_monitoring_inventory'), async (req, res) => {
  try {
    const item = await dbGet(`${monitoringInventorySelectSql} WHERE mi.id = ?`, [Number(req.params.id)]);
    if (!item) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    const visits = await dbAll(`SELECT mv.*, u.username AS inspector_account FROM MonitoringVisits mv LEFT JOIN Users u ON u.id = mv.inspector_user_id WHERE mv.inventory_id = ? ORDER BY mv.monitoring_date DESC, mv.id DESC`, [item.id]);
    const attachments = await dbAll(`SELECT id, visit_id, inventory_id, original_name, file_ext, file_type, file_size, uploaded_at FROM MonitoringVisitAttachments WHERE inventory_id = ? ORDER BY uploaded_at ASC, id ASC`, [item.id]);
    const mapPhotos = await dbAll(`
      SELECT m.*, owner.username AS owner_username
      FROM MapMedia m
      LEFT JOIN Users owner ON owner.id = m.owner_user_id
      WHERE m.inventory_item_id = ? AND m.monitoring_record_id IS NOT NULL
      ORDER BY datetime(COALESCE(m.captured_at, m.uploaded_at)) ASC, m.id ASC
    `, [item.id]);
    const attachmentsByVisit = attachments.reduce((map, attachment) => {
      const key = Number(attachment.visit_id);
      if (!map[key]) map[key] = [];
      map[key].push(attachment);
      return map;
    }, {});
    const mapPhotosByVisit = mapPhotos.reduce((map, photo) => {
      const key = Number(photo.monitoring_record_id);
      if (!map[key]) map[key] = [];
      map[key].push(monitoringMapPhotoPublicFields(photo));
      return map;
    }, {});
    visits.forEach(visit => {
      visit.attachments = attachmentsByVisit[Number(visit.id)] || [];
      visit.map_photos = mapPhotosByVisit[Number(visit.id)] || [];
      if (visit.inspection_data) {
        try { visit.inspection_data = JSON.parse(visit.inspection_data); } catch (_) { visit.inspection_data = null; }
      }
    });
    const tasks = await dbAll(`SELECT mt.*, u.username AS assigned_username FROM MonitoringTasks mt LEFT JOIN Users u ON u.id = mt.assigned_user_id WHERE mt.inventory_id = ? ORDER BY CASE mt.status WHEN 'Open' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END, CASE mt.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, mt.due_date ASC, mt.id DESC`, [item.id]);
    res.json({ item: hydrateMonitoringItem(item), visits, tasks });
  } catch (error) {
    logError('MONITORING_INVENTORY_DETAIL', error.message, error.stack);
    res.status(500).json({ error: 'Failed to load monitoring inventory detail.' });
  }
});

app.post('/api/monitoring/inventory', checkPrivilege('add_monitoring_inventory'), async (req, res) => {
  try {
    const payload = cleanMonitoringPayload(req.body || {});
    const validationError = await validateMonitoringInventoryPayload(payload, { creating: true });
    if (validationError) return res.status(400).json({ error: validationError });
    payload.asset_type = payload.asset_type || 'Machinery & Equipment';
    payload.inventory_code = payload.inventory_code || await nextMonitoringInventoryCode(payload.asset_type);
    payload.condition_status = payload.condition_status || 'Unverified';
    payload.lifecycle_status = payload.lifecycle_status || 'Active';
    const id = await insertMonitoringInventoryRecord(payload, req.user.id);
    logActivity({ req, action: 'MONITORING_INVENTORY_CREATED', details: `${payload.inventory_code} - ${payload.asset_name}` });
    const item = await dbGet(`${monitoringInventorySelectSql} WHERE mi.id = ?`, [id]);
    res.status(201).json(hydrateMonitoringItem(item));
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Inventory code already exists.' });
    logError('MONITORING_INVENTORY_CREATE', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create monitoring inventory record.' });
  }
});

app.patch('/api/monitoring/inventory/:id', checkPrivilege('edit_monitoring_inventory'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await dbGet(`SELECT * FROM MonitoringInventory WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    const payload = cleanMonitoringPayload(req.body || {});
    const fields = Object.keys(payload);
    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
    const validationError = await validateMonitoringInventoryPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    await dbRun(`UPDATE MonitoringInventory SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...fields.map(field => payload[field]), new Date().toISOString(), id]);
    logActivity({ req, action: 'MONITORING_INVENTORY_UPDATED', details: `${existing.inventory_code} - ${existing.asset_name}; Fields: ${fields.join(', ')}` });
    const item = await dbGet(`${monitoringInventorySelectSql} WHERE mi.id = ?`, [id]);
    res.json(hydrateMonitoringItem(item));
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Inventory code already exists.' });
    logError('MONITORING_INVENTORY_UPDATE', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update monitoring inventory record.' });
  }
});

app.post('/api/monitoring/inventory/:id/archive', checkPrivilege('edit_monitoring_inventory'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lifecycle = req.body?.restore ? 'Active' : 'Archived';
    const result = await dbRun(`UPDATE MonitoringInventory SET lifecycle_status = ?, updated_at = ? WHERE id = ?`, [lifecycle, new Date().toISOString(), id]);
    if (!result.changes) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    logActivity({ req, action: lifecycle === 'Archived' ? 'MONITORING_INVENTORY_ARCHIVED' : 'MONITORING_INVENTORY_RESTORED', details: `Inventory ID ${id}` });
    res.json({ success: true, lifecycle_status: lifecycle });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inventory lifecycle status.' });
  }
});

app.post('/api/monitoring/inventory/:id/visits', checkPrivilege('conduct_monitoring_visit'), monitoringAttachmentUpload.fields([
  { name: 'files', maxCount: 10 },
  { name: 'confirmation_photos', maxCount: 5 }
]), async (req, res) => {
  const supportingFiles = Array.isArray(req.files?.files) ? req.files.files : [];
  const manualConfirmationFiles = Array.isArray(req.files?.confirmation_photos) ? req.files.confirmation_photos : [];
  const uploadedFiles = [...supportingFiles, ...manualConfirmationFiles];
  const movedFiles = [];
  const createdMapFiles = [];
  let transactionStarted = false;
  let visitDir = null;
  const cleanupFiles = () => {
    [...uploadedFiles.map(file => file.path), ...movedFiles, ...createdMapFiles].filter(Boolean).forEach(filePath => {
      try { if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true }); } catch (_) {}
    });
    if (visitDir) {
      try { if (fs.existsSync(visitDir) && fs.readdirSync(visitDir).length === 0) fs.rmSync(visitDir, { recursive: true, force: true }); } catch (_) {}
    }
  };
  const parseRequestedIds = value => {
    let parsed = value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (_) { parsed = []; }
    }
    return uniqueIds(Array.isArray(parsed) ? parsed : []).filter(id => Number.isInteger(id) && id > 0).slice(0, 10);
  };
  try {
    const inventoryId = Number(req.params.id);
    const item = await dbGet(`SELECT * FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!item) {
      cleanupFiles();
      return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    }
    if (item.lifecycle_status === 'Archived') {
      cleanupFiles();
      return res.status(409).json({ error: 'Restore this inventory record before recording another monitoring visit.' });
    }
    let inspectionData = req.body?.inspection_data;
    if (typeof inspectionData === 'string') {
      try { inspectionData = JSON.parse(inspectionData); } catch (_) { inspectionData = null; }
    }
    const validInspectionStatuses = new Set(['Good', 'Fair', 'Needs Attention', 'Not Functional', 'Not Applicable']);
    const inspectionItems = Array.isArray(inspectionData?.items) ? inspectionData.items : [];
    const inspectionInvalid = !inspectionData || String(inspectionData.asset_type || '') !== String(item.asset_type || '')
      || inspectionItems.length < 1 || inspectionItems.length > 12
      || inspectionItems.some(entry => !/^[a-z0-9_]{1,50}$/.test(String(entry?.key || ''))
        || !String(entry?.label || '').trim() || String(entry.label).length > 100
        || !validInspectionStatuses.has(String(entry?.status || ''))
        || String(entry?.remarks || '').length > 300);
    if (inspectionInvalid) {
      cleanupFiles();
      return res.status(400).json({ error: 'Complete the inspection checklist for this asset type before saving the visit.' });
    }
    const inspectionJson = JSON.stringify({
      version: 1,
      asset_type: String(item.asset_type || ''),
      checklist_type: String(inspectionData.checklist_type || item.asset_type || ''),
      items: inspectionItems.map(entry => ({ key: String(entry.key), label: String(entry.label).trim(), status: String(entry.status), remarks: String(entry.remarks || '').trim() }))
    });
    let monitoringDate = null;
    const findings = String(req.body?.findings || '').trim();
    if (!findings) {
      cleanupFiles();
      return res.status(400).json({ error: 'Findings / remarks are required.' });
    }
    const condition = normalizeMonitoringCondition(req.body?.condition_status || item.condition_status);
    const requestedFrequency = Number(req.body?.monitoring_frequency_months || item.monitoring_frequency_months || 12);
    if (!Number.isFinite(requestedFrequency)) {
      cleanupFiles();
      return res.status(400).json({ error: 'Monitoring frequency must be a valid number of months.' });
    }
    const frequencyMonths = Math.max(1, Math.min(60, requestedFrequency));
    const requestedNextDate = req.body?.next_monitoring_date;
    const parsedNextDate = parseMonitoringDateKey(requestedNextDate);
    if (requestedNextDate && !parsedNextDate) {
      cleanupFiles();
      return res.status(400).json({ error: 'Valid next monitoring date is required.' });
    }
    let nextDate = null;

    const mapMediaIds = parseRequestedIds(req.body?.map_media_ids);
    const driveFileIds = parseRequestedIds(req.body?.drive_file_ids);
    if (mapMediaIds.length) {
      cleanupFiles();
      return res.status(400).json({ error: 'Choose the monitoring photo using Upload or My Drive.' });
    }
    const requestedProofCount = driveFileIds.length + manualConfirmationFiles.length;
    if (!requestedProofCount) {
      cleanupFiles();
      return res.status(400).json({ error: 'Provide at least one monitoring photo using Upload or My Drive.' });
    }
    if (requestedProofCount > 10) {
      cleanupFiles();
      return res.status(400).json({ error: 'Use up to 10 GeoCam confirmation photos per monitoring visit.' });
    }

    const proofCandidates = [];
    if (mapMediaIds.length) {
      const mapMediaRows = await dbAll(`
        SELECT m.*, owner.username AS owner_username
        FROM MapMedia m
        LEFT JOIN Users owner ON owner.id = m.owner_user_id
        WHERE m.id IN (${mapMediaIds.map(() => '?').join(',')})
      `, mapMediaIds);
      if (mapMediaRows.length !== mapMediaIds.length) {
        cleanupFiles();
        return res.status(400).json({ error: 'One or more selected Geotag Map photos are no longer available.' });
      }
      const manageAllMapPhotos = await canManageAllMapMedia(req.user);
      const mapMediaById = new Map(mapMediaRows.map(row => [Number(row.id), row]));
      for (const id of mapMediaIds) {
        const photo = mapMediaById.get(Number(id));
        if (!manageAllMapPhotos && Number(photo.owner_user_id) !== Number(req.user.id)) {
          cleanupFiles();
          return res.status(403).json({ error: 'You can only use your own GeoCam photos from Geotag Map to confirm this monitoring visit.' });
        }
        if (photo.inventory_item_id && Number(photo.inventory_item_id) !== inventoryId) {
          cleanupFiles();
          return res.status(409).json({ error: 'A selected Geotag Map photo is already linked to another inventory item.' });
        }
        const originalPath = mapMediaAbsolutePath('original', photo.original_path);
        if (!originalPath || !fs.existsSync(originalPath)) {
          cleanupFiles();
          return res.status(400).json({ error: 'A selected GeoCam photo file is missing from Geotag Map storage.' });
        }
        const validationError = validateMonitoringGeoCamMapPhoto(photo);
        if (validationError) {
          cleanupFiles();
          return res.status(400).json({ error: validationError });
        }
        const fileHash = photo.file_hash || await hashFile(originalPath);
        proofCandidates.push({
          source_kind: 'map',
          source_label: 'Geotag Map',
          map_row: photo,
          source_path: originalPath,
          file_hash: fileHash,
          metadata: {
            source_label: 'Geotag Map',
            latitude: photo.latitude,
            longitude: photo.longitude,
            captured_at: photo.captured_at,
            stamp_text: photo.stamp_text,
            coordinate_source: photo.coordinate_source || 'upload_payload'
          }
        });
      }
    }

    if (driveFileIds.length) {
      const driveRows = await dbAll(`
        SELECT * FROM UserDriveFiles
        WHERE owner_user_id = ? AND deleted_at IS NULL AND status = 'active'
          AND id IN (${driveFileIds.map(() => '?').join(',')})
      `, [req.user.id, ...driveFileIds]);
      if (driveRows.length !== driveFileIds.length) {
        cleanupFiles();
        return res.status(400).json({ error: 'One or more selected My Drive photos are unavailable or are not owned by your account.' });
      }
      const byId = new Map(driveRows.map(row => [Number(row.id), row]));
      for (const id of driveFileIds) {
        const row = byId.get(Number(id));
        const sourcePath = userDriveAbsolutePath(row);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          cleanupFiles();
          return res.status(400).json({ error: `My Drive photo ${row.original_name || row.id} is missing from storage.` });
        }
        const metadata = monitoringMetadataFromDrivePhoto(row);
        const validationError = validateMonitoringGeoCamProofMetadata(metadata);
        if (validationError) {
          cleanupFiles();
          return res.status(400).json({ error: validationError });
        }
        const embedded = monitoringReadExifMetadata(fs.readFileSync(sourcePath));
        if (Number.isFinite(Number(embedded.latitude)) && Number.isFinite(Number(embedded.longitude))) {
          if (Math.abs(Number(embedded.latitude) - Number(metadata.latitude)) > 0.002 || Math.abs(Number(embedded.longitude) - Number(metadata.longitude)) > 0.002) {
            cleanupFiles();
            return res.status(400).json({ error: `My Drive photo ${row.original_name} has embedded GPS coordinates that do not match its GeoCam upload details.` });
          }
        }
        if (embedded.captured_at) {
          const embeddedDate = monitoringProofCapturedDateKey({ captured_at: embedded.captured_at });
          const metadataDate = monitoringProofCapturedDateKey(metadata);
          if (embeddedDate && metadataDate && embeddedDate !== metadataDate) {
            cleanupFiles();
            return res.status(400).json({ error: `My Drive photo ${row.original_name} has an embedded capture date that does not match its verified GeoCam capture date.` });
          }
        }
        proofCandidates.push({
          source_kind: 'drive',
          source_label: 'My Drive',
          drive_row: row,
          source_path: sourcePath,
          file_hash: await hashFile(sourcePath),
          metadata
        });
      }
    }

    for (const file of manualConfirmationFiles) {
      const metadata = await monitoringMetadataFromManualPhoto(file);
      const validationError = validateMonitoringGeoCamProofMetadata(metadata, null, { requireEmbeddedExif: true });
      if (validationError) {
        cleanupFiles();
        return res.status(400).json({ error: `${file.originalname}: ${validationError}` });
      }
      proofCandidates.push({
        source_kind: 'manual',
        source_label: 'Manual upload',
        manual_file: file,
        source_path: file.path,
        file_hash: await hashFile(file.path),
        metadata
      });
    }

    const proofHashes = new Set();
    for (const proof of proofCandidates) {
      if (proofHashes.has(proof.file_hash)) {
        cleanupFiles();
        return res.status(400).json({ error: 'The same GeoCam confirmation photo was selected more than once.' });
      }
      proofHashes.add(proof.file_hash);
      const alreadyUsed = await dbGet(`SELECT id FROM MapMedia WHERE file_hash = ? AND monitoring_record_id IS NOT NULL LIMIT 1`, [proof.file_hash]);
      if (alreadyUsed) {
        cleanupFiles();
        return res.status(409).json({ error: 'One selected GeoCam photo already confirms another monitoring visit.' });
      }
    }

    const proofDates = proofCandidates.map(proof => monitoringProofCapturedDateKey(proof.metadata));
    if (proofDates.some(date => !date)) {
      cleanupFiles();
      return res.status(400).json({ error: 'Every GeoCam confirmation photo must contain a valid capture date.' });
    }
    const uniqueProofDates = [...new Set(proofDates)];
    if (uniqueProofDates.length !== 1) {
      cleanupFiles();
      return res.status(400).json({ error: 'All GeoCam confirmation photos for one monitoring visit must have the same capture date.' });
    }
    monitoringDate = uniqueProofDates[0];
    nextDate = parsedNextDate || addMonthsToDateKey(monitoringDate, frequencyMonths);
    if (nextDate && nextDate < monitoringDate) {
      cleanupFiles();
      return res.status(400).json({ error: 'Next monitoring date cannot be earlier than the GeoCam photo capture date.' });
    }

    const primaryProof = proofCandidates[0];
    const latitude = Number(primaryProof.metadata.latitude);
    const longitude = Number(primaryProof.metadata.longitude);

    let task = req.body?.task;
    if (typeof task === 'string') {
      try { task = JSON.parse(task); } catch (_) { task = null; }
    }
    let taskTitle = '';
    if (task) {
      taskTitle = String(task.title || '').trim();
      if (!taskTitle) {
        cleanupFiles();
        return res.status(400).json({ error: 'Follow-up task title is required when creating a task from a monitoring visit.' });
      }
      if (!(await userHasPrivilegeAsync(req.user, 'manage_monitoring_tasks'))) {
        cleanupFiles();
        return forbidden(res, 'Permission denied: manage_monitoring_tasks');
      }
      if (task.assigned_user_id) {
        const taskAssignee = await findAvailableMonitoringUser(task.assigned_user_id);
        if (!taskAssignee) {
          cleanupFiles();
          return res.status(400).json({ error: 'The selected follow-up task assignee is not available.' });
        }
      }
      if (task.due_date && !parseMonitoringDateKey(task.due_date)) {
        cleanupFiles();
        return res.status(400).json({ error: 'The follow-up task due date is invalid.' });
      }
    }

    let createdTaskNotification = null;
    await dbRun('BEGIN IMMEDIATE');
    transactionStarted = true;
    const now = new Date().toISOString();
    const result = await dbRun(`INSERT INTO MonitoringVisits (
      inventory_id, monitoring_date, monitoring_type, condition_status, utilization_status, inspection_data, findings,
      actions_recommendations, preceding_reports, latitude, longitude, next_monitoring_date,
      inspector_user_id, inspector_username, finalized, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
      inventoryId, monitoringDate, String(req.body?.monitoring_type || 'Regular Monitoring').trim(), condition,
      String(req.body?.utilization_status || '').trim() || null, inspectionJson, findings,
      String(req.body?.actions_recommendations || '').trim() || null, String(req.body?.preceding_reports || '').trim() || null,
      latitude, longitude, nextDate, req.user.id, req.user.username, now, now
    ]);

    const sourceCounts = { map: 0, drive: 0, manual: 0 };
    for (const proof of proofCandidates) {
      sourceCounts[proof.source_kind] += 1;
      if (proof.source_kind === 'map') {
        const linked = await dbRun(`
          UPDATE MapMedia
          SET inventory_item_id = ?, monitoring_record_id = ?, project_id = COALESCE(project_id, ?),
              project_stage = COALESCE(project_stage, 'Monitoring'), file_hash = COALESCE(file_hash, ?), updated_at = ?
          WHERE id = ? AND monitoring_record_id IS NULL
        `, [inventoryId, result.lastID, item.linked_project_id || null, proof.file_hash, now, proof.map_row.id]);
        if (Number(linked.changes || 0) !== 1) {
          const conflict = new Error('A selected GeoCam photo was linked to another monitoring visit while this visit was being saved. Refresh the photo list and try again.');
          conflict.statusCode = 409;
          throw conflict;
        }
      } else {
        const imported = await ensureMonitoringProofOnGeotagMap({
          req,
          metadata: proof.metadata,
          sourcePath: proof.source_path,
          fileHash: proof.file_hash,
          inventory: item,
          visitId: result.lastID,
          sourceKind: proof.source_kind
        });
        createdMapFiles.push(...(imported.created_paths || []));
      }
    }

    if (supportingFiles.length) {
      visitDir = path.join(MONITORING_ATTACHMENTS_DIR, `inventory-${inventoryId}`, `visit-${result.lastID}`);
      fs.mkdirSync(visitDir, { recursive: true });
      for (const file of supportingFiles) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const storedName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
        const destination = path.join(visitDir, storedName);
        fs.renameSync(file.path, destination);
        movedFiles.push(destination);
        const relativePath = path.relative(MONITORING_ATTACHMENTS_DIR, destination).replace(/\\/g, '/');
        await dbRun(`INSERT INTO MonitoringVisitAttachments (visit_id, inventory_id, original_name, stored_name, file_path, file_ext, file_type, file_size, uploaded_by_user_id, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          result.lastID, inventoryId, file.originalname, storedName, relativePath, ext, file.mimetype || null, Number(file.size || 0), req.user.id, now
        ]);
      }
    }
    await dbRun(`UPDATE MonitoringInventory SET condition_status = ?, last_monitoring_date = ?, next_monitoring_date = ?, monitoring_frequency_months = ?, updated_at = ? WHERE id = ?`, [
      condition, monitoringDate, nextDate, frequencyMonths, now, inventoryId
    ]);
    if (task) {
      const taskPriority = ['Critical','High','Medium','Low'].includes(task.priority) ? task.priority : 'Medium';
      const taskAssigneeId = task.assigned_user_id ? Number(task.assigned_user_id) : null;
      const taskResult = await dbRun(`INSERT INTO MonitoringTasks (inventory_id, visit_id, title, details, category, priority, status, assigned_user_id, due_date, created_by_user_id, created_by_username, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?)`, [
        inventoryId, result.lastID, taskTitle, String(task.details || '').trim() || null, String(task.category || 'Follow-up').trim(),
        taskPriority, taskAssigneeId, parseMonitoringDateKey(task.due_date), req.user.id, req.user.username, now, now
      ]);
      if (taskAssigneeId) createdTaskNotification = { id: taskResult.lastID, title: taskTitle, priority: taskPriority, assignedUserId: taskAssigneeId };
    }
    await dbRun('COMMIT');
    transactionStarted = false;
    uploadedFiles.forEach(file => { try { if (file.path && fs.existsSync(file.path)) fs.rmSync(file.path, { force: true }); } catch (_) {} });
    createdMapFiles.length = 0;
    movedFiles.length = 0;

    if (createdTaskNotification && Number(createdTaskNotification.assignedUserId) !== Number(req.user.id)) {
      insertNotifications({ recipients: [createdTaskNotification.assignedUserId], actorId: req.user.id, type: 'monitoring_task_assigned', priority: createdTaskNotification.priority.toLowerCase(), message: `${createdTaskNotification.title} was assigned for ${item.inventory_code} - ${item.asset_name}.`, targetKind: 'monitoring_inventory', targetMeta: { inventory_id: inventoryId, task_id: createdTaskNotification.id } });
    }
    if (/non[- ]?operational|irreparable|unsafe/i.test(condition)) {
      const recipients = uniqueIds([item.assigned_user_id, ...(await getSuperAdminIdsAsync())]);
      insertNotifications({ recipients, actorId: req.user.id, type: 'monitoring_critical_condition', priority: 'critical', message: `${item.inventory_code} - ${item.asset_name} was recorded as ${condition}.`, targetKind: 'monitoring_inventory', targetMeta: { inventory_id: inventoryId }, alertKey: `monitoring_critical:${inventoryId}:${monitoringDate}` });
    }
    const sourceSummary = Object.entries(sourceCounts).filter(([, count]) => count).map(([source, count]) => `${count} ${source}`).join(', ');
    logActivity({ req, action: 'MONITORING_VISIT_RECORDED', details: `${item.inventory_code} - ${item.asset_name}; ${monitoringDate}; ${condition}; ${proofCandidates.length} GeoCam confirmation photo(s): ${sourceSummary}` });
    res.status(201).json({
      success: true,
      visit_id: result.lastID,
      monitoring_date: monitoringDate,
      next_monitoring_date: nextDate,
      map_photo_count: proofCandidates.length,
      confirmation_photo_count: proofCandidates.length,
      confirmation_sources: sourceCounts
    });
  } catch (error) {
    if (transactionStarted) await dbRun('ROLLBACK').catch(() => {});
    cleanupFiles();
    logError('MONITORING_VISIT_CREATE', error.message, error.stack);
    const statusCode = Number(error.statusCode || 0);
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: statusCode ? error.message : (error.message && /GeoCam|photo|My Drive|EXIF|geotag/i.test(error.message) ? error.message : 'Failed to record monitoring visit.')
    });
  }
});

app.get('/api/monitoring/attachments/:id/download', checkPrivilege('view_monitoring_inventory'), async (req, res) => {
  try {
    const attachment = await dbGet(`SELECT * FROM MonitoringVisitAttachments WHERE id = ?`, [Number(req.params.id)]);
    if (!attachment) return res.status(404).json({ error: 'Monitoring evidence file not found.' });
    const absolute = path.resolve(MONITORING_ATTACHMENTS_DIR, String(attachment.file_path || ''));
    const root = path.resolve(MONITORING_ATTACHMENTS_DIR) + path.sep;
    if (!absolute.startsWith(root) || !fs.existsSync(absolute)) return res.status(404).json({ error: 'Monitoring evidence file is missing from storage.' });
    res.download(absolute, attachment.original_name || attachment.stored_name);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download monitoring evidence.' });
  }
});

app.post('/api/monitoring/inventory/:id/tasks', checkPrivilege('manage_monitoring_tasks'), async (req, res) => {
  try {
    const inventoryId = Number(req.params.id);
    const item = await dbGet(`SELECT * FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    if (item.lifecycle_status === 'Archived') return res.status(409).json({ error: 'Restore this inventory record before creating another monitoring task.' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Task title is required.' });
    const assignedUserId = req.body?.assigned_user_id ? Number(req.body.assigned_user_id) : null;
    if (assignedUserId && !(await findAvailableMonitoringUser(assignedUserId))) return res.status(400).json({ error: 'The selected task assignee is not available.' });
    const requestedDueDate = req.body?.due_date;
    const dueDate = parseMonitoringDateKey(requestedDueDate);
    if (requestedDueDate && !dueDate) return res.status(400).json({ error: 'Valid task due date is required.' });
    const visitId = req.body?.visit_id ? Number(req.body.visit_id) : null;
    if (visitId) {
      const visit = await dbGet(`SELECT id FROM MonitoringVisits WHERE id = ? AND inventory_id = ?`, [visitId, inventoryId]);
      if (!visit) return res.status(400).json({ error: 'The selected monitoring visit does not belong to this inventory record.' });
    }
    const priority = ['Critical','High','Medium','Low'].includes(req.body?.priority) ? req.body.priority : 'Medium';
    const now = new Date().toISOString();
    const result = await dbRun(`INSERT INTO MonitoringTasks (inventory_id, visit_id, title, details, category, priority, status, assigned_user_id, due_date, created_by_user_id, created_by_username, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?)`, [
      inventoryId, visitId, title, String(req.body?.details || '').trim() || null,
      String(req.body?.category || 'Follow-up').trim(), priority, assignedUserId, dueDate, req.user.id, req.user.username, now, now
    ]);
    if (assignedUserId && Number(assignedUserId) !== Number(req.user.id)) insertNotifications({ recipients: [assignedUserId], actorId: req.user.id, type: 'monitoring_task_assigned', priority: priority.toLowerCase(), message: `${title} was assigned for ${item.inventory_code} - ${item.asset_name}.`, targetKind: 'monitoring_inventory', targetMeta: { inventory_id: inventoryId, task_id: result.lastID } });
    logActivity({ req, action: 'MONITORING_TASK_CREATED', details: `${item.inventory_code}: ${title}` });
    res.status(201).json({ success: true, task_id: result.lastID });
  } catch (error) {
    logError('MONITORING_TASK_CREATE', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create monitoring task.' });
  }
});

app.patch('/api/monitoring/tasks/:id', checkPrivilege('manage_monitoring_tasks'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await dbGet(`SELECT mt.*, mi.inventory_code, mi.asset_name FROM MonitoringTasks mt JOIN MonitoringInventory mi ON mi.id = mt.inventory_id WHERE mt.id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'Monitoring task not found.' });
    const allowed = ['title','details','category','priority','status','assigned_user_id','due_date'];
    const payload = {};
    allowed.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) payload[field] = req.body[field] === '' ? null : req.body[field];
    });
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'No valid task fields to update.' });
    if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
      payload.title = String(payload.title || '').trim();
      if (!payload.title) return res.status(400).json({ error: 'Task title cannot be blank.' });
    }
    if (payload.priority && !['Critical','High','Medium','Low'].includes(payload.priority)) return res.status(400).json({ error: 'Task priority is invalid.' });
    if (payload.status && !['Open','In Progress','Completed','Closed','Cancelled'].includes(payload.status)) return res.status(400).json({ error: 'Task status is invalid.' });
    if (Object.prototype.hasOwnProperty.call(payload, 'assigned_user_id')) {
      payload.assigned_user_id = payload.assigned_user_id ? Number(payload.assigned_user_id) : null;
      if (payload.assigned_user_id && !(await findAvailableMonitoringUser(payload.assigned_user_id))) return res.status(400).json({ error: 'The selected task assignee is not available.' });
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'due_date')) {
      const requestedDueDate = payload.due_date;
      payload.due_date = requestedDueDate ? parseMonitoringDateKey(requestedDueDate) : null;
      if (requestedDueDate && !payload.due_date) return res.status(400).json({ error: 'Valid task due date is required.' });
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      payload.completed_at = ['Completed','Closed'].includes(payload.status) ? new Date().toISOString() : null;
    }
    const fields = Object.keys(payload);
    await dbRun(`UPDATE MonitoringTasks SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...fields.map(field => payload[field]), new Date().toISOString(), id]);
    if (Object.prototype.hasOwnProperty.call(payload, 'assigned_user_id') && payload.assigned_user_id && Number(payload.assigned_user_id) !== Number(existing.assigned_user_id || 0) && Number(payload.assigned_user_id) !== Number(req.user.id)) {
      const taskTitle = payload.title || existing.title;
      const taskPriority = payload.priority || existing.priority || 'Medium';
      insertNotifications({ recipients: [payload.assigned_user_id], actorId: req.user.id, type: 'monitoring_task_assigned', priority: String(taskPriority).toLowerCase(), message: `${taskTitle} was assigned for ${existing.inventory_code} - ${existing.asset_name}.`, targetKind: 'monitoring_inventory', targetMeta: { inventory_id: existing.inventory_id, task_id: id } });
    }
    logActivity({ req, action: 'MONITORING_TASK_UPDATED', details: `Task ID ${id}; Fields: ${fields.join(', ')}` });
    res.json({ success: true });
  } catch (error) {
    logError('MONITORING_TASK_UPDATE', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update monitoring task.' });
  }
});

app.post('/api/monitoring/inventory/:id/schedule', checkPrivilege('schedule_monitoring_visit'), async (req, res) => {
  try {
    const inventoryId = Number(req.params.id);
    const item = await dbGet(`SELECT * FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Monitoring inventory record not found.' });
    if (item.lifecycle_status === 'Archived') return res.status(409).json({ error: 'Restore this inventory record before scheduling another monitoring visit.' });
    const dateKey = parseMonitoringDateKey(req.body?.date);
    if (!dateKey) return res.status(400).json({ error: 'Valid monitoring schedule date is required.' });
    const todayKey = monitoringManilaDateKey();
    if (dateKey < todayKey && req.body?.confirm_past_date !== true) {
      return res.status(409).json({ error: 'Confirmation is required before scheduling a monitoring visit in the past.', code: 'PAST_MONITORING_DATE_CONFIRMATION_REQUIRED' });
    }
    const validTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const startTime = validTimePattern.test(String(req.body?.start_time || '')) ? String(req.body.start_time) : '';
    const endTime = validTimePattern.test(String(req.body?.end_time || '')) ? String(req.body.end_time) : '';
    if (!startTime || !endTime) return res.status(400).json({ error: 'Valid start and end times are required.' });
    if (endTime <= startTime) return res.status(400).json({ error: 'End time must be later than start time.' });

    const legacyAssignedUserId = req.body?.assigned_user_id ? Number(req.body.assigned_user_id) : null;
    const requestedParticipantIds = Array.isArray(req.body?.participant_user_ids)
      ? req.body.participant_user_ids
      : [legacyAssignedUserId || item.assigned_user_id || req.user.id];
    const participantUserIds = uniqueIds(requestedParticipantIds);
    if (!participantUserIds.length) return res.status(400).json({ error: 'At least one participant / involved user is required.' });
    const participants = await dbAll(`
      SELECT id, username
      FROM Users
      WHERE id IN (${participantUserIds.map(() => '?').join(',')})
        AND role != 'system'
        AND COALESCE(is_system_account, 0) = 0
        AND COALESCE(hidden_from_workflows, 0) = 0
    `, participantUserIds);
    if (participants.length !== participantUserIds.length) return res.status(400).json({ error: 'One or more selected participants do not exist or cannot be assigned.' });

    const title = `Monitoring: ${item.inventory_code} - ${item.asset_name}`;
    const location = [item.purok, item.barangay, item.district].filter(Boolean).join(', ');
    const description = [`Recipient: ${item.recipient_organization || '-'}`, `Location: ${location || '-'}`, String(req.body?.notes || '').trim()].filter(Boolean).join('\n');
    const now = new Date().toISOString();
    await dbRun('BEGIN IMMEDIATE');
    let eventId = null;
    try {
      const event = await dbRun(`INSERT INTO CalendarEvents (title, description, location, start_datetime, end_datetime, all_day, event_type, event_type_detail, visibility, owner_user_id, related_inventory_id, color, reminder_minutes, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 'monitoring', 'Established Project / Asset Monitoring', 'participants', ?, ?, ?, ?, 'active', ?, ?, ?)`, [
        title, description, location, `${dateKey}T${startTime}:00+08:00`, `${dateKey}T${endTime}:00+08:00`, req.user.id, inventoryId, '#0f766e', '1440', req.user.id, now, now
      ]);
      eventId = event.lastID;
      for (const participantUserId of participantUserIds) {
        const isCreator = Number(participantUserId) === Number(req.user.id);
        await dbRun(`INSERT OR IGNORE INTO CalendarEventParticipants (event_id, user_id, role, response_status, notified_at, created_at) VALUES (?, ?, 'participant', ?, ?, ?)`, [
          eventId, participantUserId, isCreator ? 'accepted' : 'pending', isCreator ? null : now, now
        ]);
      }
      await dbRun(`UPDATE MonitoringInventory SET next_monitoring_date = ?, updated_at = ? WHERE id = ?`, [dateKey, now, inventoryId]);
      await dbRun('COMMIT');
    } catch (transactionError) {
      await dbRun('ROLLBACK').catch(() => {});
      throw transactionError;
    }

    const notifyRecipients = participantUserIds.filter(userId => Number(userId) !== Number(req.user.id));
    if (notifyRecipients.length) {
      insertNotifications({ recipients: notifyRecipients, actorId: req.user.id, type: 'monitoring_visit_scheduled', priority: 'warning', message: `${title} is scheduled on ${dateKey}.`, targetKind: 'monitoring_inventory', targetMeta: { inventory_id: inventoryId, calendar_event_id: eventId } });
    }
    auditCalendarEvent(eventId, req, 'CALENDAR_EVENT_CREATED', title);
    logActivity({ req, action: 'MONITORING_VISIT_SCHEDULED', details: `${item.inventory_code}; ${dateKey}; Participants ${participantUserIds.join(',')}` });
    res.status(201).json({ success: true, event_id: eventId, next_monitoring_date: dateKey, participant_user_ids: participantUserIds });
  } catch (error) {
    logError('MONITORING_SCHEDULE_CREATE', error.message, error.stack);
    res.status(500).json({ error: 'Failed to schedule monitoring visit.' });
  }
});

app.get('/api/monitoring/export.xlsx', checkPrivilege('export_monitoring_reports'), async (req, res) => {
  try {
    const items = await loadMonitoringInventoryRows();
    const visits = await dbAll(`SELECT mv.*, mi.inventory_code, mi.asset_name FROM MonitoringVisits mv JOIN MonitoringInventory mi ON mi.id = mv.inventory_id ORDER BY mv.monitoring_date DESC, mi.inventory_code`);
    const tasks = await dbAll(`SELECT mt.*, mi.inventory_code, mi.asset_name, u.username AS assigned_username FROM MonitoringTasks mt JOIN MonitoringInventory mi ON mi.id = mt.inventory_id LEFT JOIN Users u ON u.id = mt.assigned_user_id ORDER BY mt.status, mt.priority, mt.due_date`);
    const workbook = XLSX.utils.book_new();
    const inventoryRows = items.map(item => ({
      'Inventory Code': item.inventory_code, 'Asset Type': item.asset_type, 'Asset Subtype': item.asset_subtype, 'Asset / Project': item.asset_name,
      'Description': item.asset_description, 'Commodity': item.commodity,
      'Registration No.': item.registration_no, 'Source of Fund': item.source_of_fund, 'Year Funded': item.year_funded, 'Supplier / Contractor': item.supplier,
      'Project Cost': item.project_cost, 'Date Completed': item.date_completed, 'Warranty Expiry': item.warranty_expiry,
      'Responsible Office': item.responsible_office, 'Service Area': item.service_area, 'Capacity': item.capacity, 'Machine Brand': item.machine_brand, 'Machine Model': item.machine_model, 'Machine Serial No.': item.machine_serial_no,
      'Engine Brand': item.engine_brand, 'Engine Model': item.engine_model, 'Engine Serial No.': item.engine_serial_no, 'Engine Make': item.engine_make,
      'Rated Power': item.rated_power, 'Recipient Organization': item.recipient_organization, 'Contact Person': item.contact_person,
      'Designation': item.designation, 'Contact No.': item.contact_no, 'Purok': item.purok, 'Barangay': item.barangay, 'District': item.district,
      'Latitude': item.latitude, 'Longitude': item.longitude, 'Condition': item.condition_status, 'Date Received': item.date_received,
      'Last Monitoring': item.last_monitoring_date, 'Next Monitoring': item.next_monitoring_date, 'Due Status': item.due_status,
      'Priority': item.computed_priority, 'Assigned User': item.assigned_username, 'Linked Project': item.linked_project_name,
      'Open Tasks': item.open_task_count, 'Monitoring Visits': item.visit_count, 'Lifecycle': item.lifecycle_status, 'Notes': item.notes,
      'Imported Remarks': item.baseline_remarks, 'Imported Actions / Recommendations': item.baseline_actions_recommendations,
      'Imported Preceding Reports': item.baseline_preceding_reports
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryRows), 'Monitoring Inventory');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(visits), 'Monitoring History');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tasks), 'Issues and Tasks');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ABEARC-Monitoring-Inventory-${formatDateKey(new Date())}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    logError('MONITORING_EXPORT', error.message, error.stack);
    res.status(500).json({ error: 'Failed to export monitoring inventory.' });
  }
});

app.post('/api/monitoring/import', checkPrivilege('import_monitoring_inventory'), monitoringInventoryImportUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Excel workbook is required.' });
  let transactionStarted = false;
  try {
    const workbook = XLSX.readFile(req.file.path, { cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const headerIndex = rows.findIndex(row => String(row?.[0] || '').trim() === '#' && /machinery|asset|project/i.test(String(row?.[1] || '')));
    if (headerIndex < 0) return res.status(400).json({ error: 'The workbook does not match the supported monitoring inventory format.' });
    const dataStart = headerIndex + 2;
    const assetType = String(req.body?.asset_type || 'Machinery & Equipment').trim() || 'Machinery & Equipment';
    let imported = 0;
    let skipped = 0;
    await dbRun('BEGIN IMMEDIATE');
    transactionStarted = true;
    for (let index = dataStart; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const assetName = String(row[1] || '').trim();
      if (!assetName) continue;
      const sourceRowNumber = row[0] || index - dataStart + 1;
      const sourceDuplicate = await dbGet(`SELECT id FROM MonitoringInventory WHERE source_name = ? AND source_row_number = ? LIMIT 1`, [req.file.originalname, sourceRowNumber]);
      if (sourceDuplicate) { skipped += 1; continue; }
      const reg = String(row[3] || '').trim();
      const serial = String(row[10] || '').trim();
      if (reg && !/not yet registered|^n\/?a$/i.test(reg)) {
        const duplicate = await dbGet(`SELECT id FROM MonitoringInventory WHERE registration_no = ? LIMIT 1`, [reg]);
        if (duplicate) { skipped += 1; continue; }
      } else if (serial && !/^n\/?a$|^ni$|^none$/i.test(serial)) {
        const duplicate = await dbGet(`SELECT id FROM MonitoringInventory WHERE machine_serial_no = ? LIMIT 1`, [serial]);
        if (duplicate) { skipped += 1; continue; }
      }
      const latitudeValue = parseMonitoringCoordinate(row[23]);
      const longitudeValue = parseMonitoringCoordinate(row[24]);
      const latitude = latitudeValue !== null && latitudeValue >= -90 && latitudeValue <= 90 ? latitudeValue : null;
      const longitude = longitudeValue !== null && longitudeValue >= -180 && longitudeValue <= 180 ? longitudeValue : null;
      const code = await nextMonitoringInventoryCode(assetType);
      const lastMonitoring = parseMonitoringDateKey(row[28]);
      const nextMonitoring = lastMonitoring ? addMonthsToDateKey(lastMonitoring, 12) : null;
      const record = {
        inventory_code: code, asset_type: assetType, asset_name: assetName, commodity: row[2], registration_no: reg || null,
        source_of_fund: row[4], year_funded: row[5] == null ? null : String(row[5]), supplier: row[6], capacity: row[7], machine_brand: row[8], machine_model: row[9], machine_serial_no: row[10],
        engine_brand: row[11], engine_model: row[12], engine_serial_no: row[13], engine_make: row[14], rated_power: row[15], recipient_organization: row[16], contact_person: row[17], designation: row[18], contact_no: row[19],
        purok: row[20], barangay: row[21], district: row[22], latitude, longitude, latitude_raw: row[23], longitude_raw: row[24], condition_status: normalizeMonitoringCondition(row[25]),
        date_received: parseMonitoringDateKey(row[26]), monitoring_frequency_months: 12, last_monitoring_date: lastMonitoring, next_monitoring_date: nextMonitoring,
        lifecycle_status: 'Active', baseline_remarks: row[29] || null, baseline_actions_recommendations: row[30] || null,
        baseline_preceding_reports: row[31] || null, source_row_number: sourceRowNumber, source_name: req.file.originalname
      };
      const inventoryId = await insertMonitoringInventoryRecord(record, req.user.id);
      if (lastMonitoring) {
        const now = new Date().toISOString();
        await dbRun(`INSERT INTO MonitoringVisits (inventory_id, monitoring_date, monitoring_type, condition_status, findings, actions_recommendations, preceding_reports, next_monitoring_date, inspector_user_id, inspector_username, finalized, created_at, updated_at) VALUES (?, ?, 'Imported Monitoring Record', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [inventoryId, lastMonitoring, normalizeMonitoringCondition(row[25]), row[29] || null, row[30] || null, row[31] || null, nextMonitoring, req.user.id, req.user.username, now, now]);
      }
      imported += 1;
    }
    await dbRun('COMMIT');
    transactionStarted = false;
    logActivity({ req, action: 'MONITORING_INVENTORY_IMPORTED', details: `${req.file.originalname}; Imported ${imported}; Skipped ${skipped}` });
    res.json({ success: true, imported, skipped });
  } catch (error) {
    if (transactionStarted) await dbRun('ROLLBACK').catch(() => {});
    logError('MONITORING_IMPORT', error.message, error.stack);
    res.status(500).json({ error: 'Failed to import monitoring inventory workbook. No partial import was retained.' });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
});



const runMonitoringAlertSweep = async () => {
  try {
    const items = (await loadMonitoringInventoryRows()).filter(item => item.lifecycle_status !== 'Archived');
    if (!items.length) return;
    const todayKey = monitoringManilaDateKey();
    const needsAttention = items.filter(item => ['Critical', 'High'].includes(item.computed_priority) || ['Never Monitored', 'Overdue'].includes(item.due_status));
    const critical = items.filter(item => item.computed_priority === 'Critical').length;
    const never = items.filter(item => item.due_status === 'Never Monitored').length;
    const overdue = items.filter(item => item.due_status === 'Overdue').length;
    const openTasks = items.reduce((sum, item) => sum + Number(item.open_task_count || 0), 0);
    const adminRows = await dbAll(`SELECT id FROM Users WHERE role IN ('admin','superadmin') AND COALESCE(is_system_account, 0) = 0 AND COALESCE(hidden_from_workflows, 0) = 0`);
    const adminRecipients = uniqueIds(adminRows.map(row => row.id));
    if (adminRecipients.length && (needsAttention.length || openTasks)) {
      insertNotifications({
        recipients: adminRecipients,
        actorId: null,
        type: 'monitoring_daily_summary',
        message: `Established monitoring attention: ${critical} critical, ${never} never monitored, ${overdue} overdue, and ${openTasks} open follow-up task${openTasks === 1 ? '' : 's'}.`,
        targetKind: 'monitoring_inventory',
        targetMeta: { filter: 'priority', critical, never_monitored: never, overdue, open_tasks: openTasks },
        alertKey: 'monitoring_daily_summary:admins',
        alertDate: todayKey,
        dedupeMode: 'daily'
      });
    }
    const assignedGroups = needsAttention.reduce((groups, item) => {
      const userId = Number(item.assigned_user_id || 0);
      if (!userId) return groups;
      if (!groups[userId]) groups[userId] = [];
      groups[userId].push(item);
      return groups;
    }, {});
    for (const [userId, assignedItems] of Object.entries(assignedGroups)) {
      const assignedCritical = assignedItems.filter(item => item.computed_priority === 'Critical').length;
      const assignedOverdue = assignedItems.filter(item => item.due_status === 'Overdue').length;
      const assignedNever = assignedItems.filter(item => item.due_status === 'Never Monitored').length;
      insertNotifications({
        recipients: [Number(userId)],
        actorId: null,
        type: 'monitoring_assignment_summary',
        message: `Your monitoring queue has ${assignedItems.length} priority item${assignedItems.length === 1 ? '' : 's'}: ${assignedCritical} critical, ${assignedOverdue} overdue, and ${assignedNever} never monitored.`,
        targetKind: 'monitoring_inventory',
        targetMeta: { filter: 'my_priority', assigned_user_id: Number(userId) },
        alertKey: `monitoring_daily_summary:user:${Number(userId)}`,
        alertDate: todayKey,
        dedupeMode: 'daily'
      });
    }
  } catch (error) {
    logError('MONITORING_ALERT_SWEEP', error.message, error.stack);
  }
};

setTimeout(runMonitoringAlertSweep, 8000);
setInterval(runMonitoringAlertSweep, 60 * 60 * 1000);
