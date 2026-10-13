const PROJECT_GEOTAG_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const projectGeotagStampValue = (stampText, label) => {
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(stampText || '').match(new RegExp(`^${escaped}\\s*[:=]\\s*([^\\r\\n]{1,240})`, 'im'));
  return match?.[1] ? String(match[1]).trim() : '';
};

const projectGeotagExtractStampText = (values = []) => {
  const labels = ['GPS Datetime', 'Date/Time', 'Date Taken', 'GPS Location', 'Address', 'Coordinates', 'Latitude', 'Longitude', 'Accuracy', 'Elevation', 'Bearing', 'District', 'Barangay', 'Facing Zoning', 'Location Zoning', 'Zoning'];
  const lines = [];
  for (const value of values) {
    const text = String(value || '').replace(/\0+/g, '\n');
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = text.match(new RegExp(`${escaped}\\s*[:=]\\s*([^\\r\\n]{1,240})`, 'i'));
      if (!match?.[1]) continue;
      const clean = String(match[1]).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
      if (clean) lines.push(`${label}: ${clean}`);
    }
  }
  return [...new Set(lines)].join('\n');
};

const projectGeotagCoordinates = (value = '') => {
  const text = String(value || '');
  const patterns = [
    /(?:GPS\s*Location|Coordinates?)\s*[:=]\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)/ig,
    /geo:\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)/ig,
    /([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
      return { latitude, longitude };
    }
  }
  return null;
};

const projectGeotagNumber = value => {
  const match = String(value || '').match(/[+-]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const projectGeotagCapturedAt = value => {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalizedExif = monitoringParseExifDate(text);
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(normalizedExif || ''))) return normalizedExif;
  const parsed = new Date(`${text} GMT+0800`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const projectGeotagFilenameCapturedAt = filename => {
  const match = String(filename || '').match(/(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])([0-2]\d)([0-5]\d)([0-5]\d)(?:[^0-9]|$)/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : iso;
};

const projectGeotagAddressParts = value => {
  const address = String(value || '').trim();
  const barangay = address.match(/(?:brgy\.?|barangay)\s+([^,;]+)/i)?.[1]?.trim() || '';
  const district = address.match(/(?:,|^)\s*([^,;]+?)\s+district\b/i)?.[1]?.trim() || '';
  return { address, barangay, district: district ? `${district} District` : '' };
};

const decodeProjectGeotagQr = async sourcePath => {
  const { data, info } = await sharp(sourcePath)
    .rotate()
    .resize({ width: 2600, height: 2600, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const decoded = jsQR(pixels, info.width, info.height, { inversionAttempts: 'attemptBoth' });
  return decoded?.data ? String(decoded.data).trim() : '';
};

const inspectProjectGeotagImage = async (sourcePath, originalFilename = '') => {
  const buffer = fs.readFileSync(sourcePath);
  const exif = monitoringReadExifMetadata(buffer);
  const candidates = exif.text ? [exif.text] : monitoringPhotoTextCandidates(buffer);
  const embeddedStampText = projectGeotagExtractStampText(candidates);
  const qrPayload = await decodeProjectGeotagQr(sourcePath).catch(() => '');
  const qrStampText = projectGeotagExtractStampText([qrPayload]);
  const stampText = [...new Set([embeddedStampText, qrStampText].filter(Boolean))].join('\n');
  const qrCoordinates = projectGeotagCoordinates(qrPayload);
  const stampedCoordinates = projectGeotagCoordinates(projectGeotagStampValue(stampText, 'Coordinates')) || (() => {
    const latitude = projectGeotagNumber(projectGeotagStampValue(stampText, 'Latitude'));
    const longitude = projectGeotagNumber(projectGeotagStampValue(stampText, 'Longitude'));
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  })();
  const capturedAt = exif.captured_at
    || projectGeotagCapturedAt(projectGeotagStampValue(stampText, 'GPS Datetime')
      || projectGeotagStampValue(stampText, 'Date/Time')
      || projectGeotagStampValue(stampText, 'Date Taken'))
    || projectGeotagFilenameCapturedAt(originalFilename || path.basename(sourcePath));
  const accuracyM = projectGeotagNumber(projectGeotagStampValue(stampText, 'Accuracy'));
  const stampedBearing = projectGeotagNumber(projectGeotagStampValue(stampText, 'Bearing'));
  const bearingDeg = Number.isFinite(stampedBearing) ? stampedBearing : (mapMediaCoordinatePresent(exif.bearing_deg) ? Number(exif.bearing_deg) : null);
  const altitudeM = Number.isFinite(Number(exif.altitude_m)) ? Number(exif.altitude_m) : projectGeotagNumber(projectGeotagStampValue(stampText, 'Elevation'));
  const address = projectGeotagAddressParts(projectGeotagStampValue(stampText, 'Address'));
  const stampedBarangay = projectGeotagStampValue(stampText, 'Barangay');
  const stampedDistrictRaw = projectGeotagStampValue(stampText, 'District');
  if (!address.barangay && stampedBarangay) address.barangay = stampedBarangay;
  if (!address.district && stampedDistrictRaw) {
    address.district = /district$/i.test(stampedDistrictRaw) ? stampedDistrictRaw : `${stampedDistrictRaw} District`;
  }
  const errors = [];
  if (!qrPayload || !qrCoordinates) errors.push('The image does not contain a readable geotag QR code.');
  if (!stampText || !stampedCoordinates) errors.push('The image is missing readable stamped coordinates.');
  if (!capturedAt) errors.push('The image is missing a readable capture date and time.');
  if (!Number.isFinite(accuracyM)) errors.push('The image is missing stamped GPS accuracy.');
  if (qrCoordinates && stampedCoordinates
      && (Math.abs(qrCoordinates.latitude - stampedCoordinates.latitude) > 0.002
        || Math.abs(qrCoordinates.longitude - stampedCoordinates.longitude) > 0.002)) {
    errors.push('The QR coordinates do not match the image-stamp coordinates.');
  }
  if (qrCoordinates && Number.isFinite(Number(exif.latitude)) && Number.isFinite(Number(exif.longitude))
      && (Math.abs(qrCoordinates.latitude - Number(exif.latitude)) > 0.002
        || Math.abs(qrCoordinates.longitude - Number(exif.longitude)) > 0.002)) {
    errors.push('The QR coordinates do not match the embedded EXIF GPS coordinates.');
  }
  return {
    valid: errors.length === 0,
    errors,
    qrPayload,
    stampText: [stampText, qrPayload ? `QR payload: ${qrPayload}` : ''].filter(Boolean).join('\n'),
    latitude: qrCoordinates?.latitude ?? stampedCoordinates?.latitude ?? exif.latitude,
    longitude: qrCoordinates?.longitude ?? stampedCoordinates?.longitude ?? exif.longitude,
    embeddedLatitude: exif.latitude,
    embeddedLongitude: exif.longitude,
    capturedAt,
    accuracyM,
    altitudeM,
    bearingDeg,
    address
  };
};

const projectGeotagRemark = context => {
  const projectName = String(context.projectName || 'Unnamed project').trim();
  const stage = String(context.stage || 'Unspecified').trim();
  const documentName = String(context.documentName || context.originalName || 'project image').trim();
  const originalName = String(context.originalName || '').trim();
  const category = String(context.category || '').trim();
  const caption = String(context.caption || '').trim();
  const uploader = String(context.uploader || '').trim();
  const parts = [`This geotagged photo was uploaded for the project “${projectName}” under the ${stage} progress stage as “${documentName}”`];
  if (originalName && originalName !== documentName) parts.push(`from the file “${originalName}”`);
  if (category && category !== documentName) parts.push(`in the ${category} category`);
  let sentence = `${parts.join(', ')}.`;
  if (caption) sentence += ` Documentation note: ${caption.replace(/\s+/g, ' ').slice(0, 500)}.`;
  if (uploader) sentence += ` It was uploaded by ${uploader}.`;
  return sentence;
};

const appendProjectGeotagContext = async (mapMediaId, projectId, stage, remarks) => {
  const row = await dbGet(`SELECT project_id, project_stage, remarks FROM MapMedia WHERE id = ?`, [mapMediaId]);
  if (!row) return;
  const existingRemarks = String(row.remarks || '').trim();
  const nextRemarks = existingRemarks.includes(remarks) ? existingRemarks : [existingRemarks, remarks].filter(Boolean).join('\n\n');
  const canLinkProject = !row.project_id || Number(row.project_id) === Number(projectId);
  await dbRun(`UPDATE MapMedia SET project_id = ?, project_stage = ?, remarks = ?, updated_at = ? WHERE id = ?`, [
    canLinkProject ? projectId : row.project_id,
    canLinkProject ? stage : row.project_stage,
    nextRemarks,
    new Date().toISOString(),
    mapMediaId
  ]);
};

const syncProjectDocumentMapMediaById = async mapMediaId => {
  const row = await dbGet(`
    SELECT m.id, m.source_type,
      SUM(CASE WHEN d.status = 'Checked' AND d.file_path IS NOT NULL THEN 1 ELSE 0 END) as checked_links
    FROM MapMedia m
    LEFT JOIN ProjectDocumentMapMediaLinks link ON link.map_media_id = m.id
    LEFT JOIN Documents d ON d.id = link.document_id
    WHERE m.id = ?
    GROUP BY m.id
  `, [mapMediaId]);
  if (!row || String(row.source_type || '') !== 'project_document') return;
  const nextStatus = Number(row.checked_links || 0) > 0 ? 'active' : 'pending_review';
  await dbRun(`UPDATE MapMedia SET map_status = ?, updated_at = ? WHERE id = ?`, [nextStatus, new Date().toISOString(), mapMediaId]);
};

const syncProjectDocumentMapMediaReviewState = async documentId => {
  const links = await dbAll(`SELECT map_media_id FROM ProjectDocumentMapMediaLinks WHERE document_id = ?`, [documentId]);
  for (const link of links) await syncProjectDocumentMapMediaById(link.map_media_id);
};

const linkProjectDocumentMapMedia = async ({ documentId, mapMediaId, projectId }) => {
  await dbRun(`INSERT OR IGNORE INTO ProjectDocumentMapMediaLinks (document_id, map_media_id, project_id, created_at) VALUES (?, ?, ?, ?)`, [
    documentId,
    mapMediaId,
    projectId,
    new Date().toISOString()
  ]);
  await syncProjectDocumentMapMediaById(mapMediaId);
};

const deleteProjectLinkedMapMediaFiles = rows => {
  (rows || []).forEach(row => {
    [mapMediaAbsolutePath('original', row.original_path), mapMediaAbsolutePath('thumbnail', row.thumbnail_path)].forEach(filePath => {
      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    });
  });
};

const removeProjectDocumentMapMediaLinks = async (documentIds, { deleteFiles = true } = {}) => {
  const ids = [...new Set((Array.isArray(documentIds) ? documentIds : [documentIds]).map(Number).filter(id => Number.isInteger(id) && id > 0))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const affected = await dbAll(`
    SELECT DISTINCT m.*
    FROM MapMedia m
    JOIN ProjectDocumentMapMediaLinks link ON link.map_media_id = m.id
    WHERE link.document_id IN (${placeholders})
  `, ids);
  await dbRun(`DELETE FROM ProjectDocumentMapMediaLinks WHERE document_id IN (${placeholders})`, ids);
  const removed = [];
  for (const row of affected) {
    if (String(row.source_type || '') !== 'project_document') continue;
    const remaining = await dbGet(`SELECT COUNT(*) as count FROM ProjectDocumentMapMediaLinks WHERE map_media_id = ?`, [row.id]);
    if (Number(remaining?.count || 0) > 0) {
      await syncProjectDocumentMapMediaById(row.id);
      continue;
    }
    await dbRun(`DELETE FROM MapMedia WHERE id = ?`, [row.id]);
    removed.push(row);
  }
  if (deleteFiles) deleteProjectLinkedMapMediaFiles(removed);
  return removed;
};

const mapMediaHasProjectDocumentLink = async mapMediaId => Boolean(await dbGet(`SELECT 1 as linked FROM ProjectDocumentMapMediaLinks WHERE map_media_id = ? LIMIT 1`, [mapMediaId]));

const autoAddProjectImageToGeotagMap = async ({ req, sourcePath, originalName, mimeType, fileSize, projectId, projectName, stage, documentName, category, caption, sourceDocumentId }) => {
  const ext = path.extname(originalName || sourcePath || '').toLowerCase();
  if (!PROJECT_GEOTAG_IMAGE_EXTENSIONS.has(ext) && !String(mimeType || '').toLowerCase().startsWith('image/')) return { eligible: false, added: false };
  try {
    const inspection = await inspectProjectGeotagImage(sourcePath);
    if (!inspection.valid) return { eligible: true, valid: false, added: false, reasons: inspection.errors };
    const remarks = projectGeotagRemark({ projectName, stage, documentName, originalName, category, caption, uploader: req.user?.username });
    const temporaryPath = path.join(MAP_MEDIA_TEMP_DIR, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext || '.jpg'}`);
    fs.copyFileSync(sourcePath, temporaryPath);
    let result;
    try {
      result = await storeMapMediaUpload({
        req,
        file: { path: temporaryPath, originalname: originalName || path.basename(sourcePath), mimetype: mimeType || 'image/jpeg', size: Number(fileSize || fs.statSync(sourcePath).size) },
        metadata: {
          project_id: projectId,
          project_stage: stage,
          captured_at: inspection.capturedAt,
          latitude: inspection.latitude,
          longitude: inspection.longitude,
          altitude_m: inspection.altitudeM,
          accuracy_m: inspection.accuracyM,
          bearing_deg: inspection.bearingDeg,
          district: inspection.address.district,
          barangay: inspection.address.barangay,
          location_description: inspection.address.address,
          category: category || documentName || 'Project Documentation',
          remarks,
          stamp_text: inspection.stampText,
          coordinate_source: 'project_document_qr_stamp'
        },
        skipProjectAccessValidation: true,
        skipFilenameDuplicate: true,
        sourceType: 'project_document',
        duplicateSourceType: 'project_document'
      });
    } finally {
      try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_) {}
    }
    await appendProjectGeotagContext(result.map_media_id, projectId, stage, remarks);
    await linkProjectDocumentMapMedia({ documentId: sourceDocumentId, mapMediaId: result.map_media_id, projectId });
    logActivity({ req, action: 'PROJECT_GEOTAG_AUTO_MAP_PENDING', projectId, project: projectName, docType: documentName, details: `${result.duplicate ? 'Linked existing' : 'Validated'} stamped image ${originalName}; pending document review before Geotag Map publication` });
    return { eligible: true, valid: true, added: false, pending_review: true, duplicate: Boolean(result.duplicate), map_media_id: result.map_media_id };
  } catch (err) {
    logError('PROJECT_GEOTAG_AUTO_MAP_FAILED', err.message, err.stack);
    return { eligible: true, valid: false, added: false, reasons: [err.message || 'Geotag Map validation failed.'] };
  }
};
