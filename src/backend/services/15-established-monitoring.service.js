const INITIAL_MONITORING_INVENTORY_SOURCE = 'CAgrO-ABED AFME Inventory and Monitoring January 2026(1).xlsx';
const INITIAL_MONITORING_WORKBOOK_PATH = path.join(__dirname, 'src', 'backend', 'assets', 'CAgrO-ABED_AFME_Inventory_January_2026.xlsx');

const monitoringManilaDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);

const parseMonitoringDateKey = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = Date.UTC(1899, 11, 30) + Math.round(value * 86400000);
    return new Date(millis).toISOString().slice(0, 10);
  }
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return text;
    return null;
  }
  const us = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    const month = Number(us[1]);
    const day = Number(us[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const addMonthsToDateKey = (dateKey, months = 12) => {
  const parsed = parseMonitoringDateKey(dateKey);
  if (!parsed) return null;
  const [year, month, day] = parsed.split('-').map(Number);
  const offset = Math.max(0, Number(months || 0));
  const targetMonthIndex = (month - 1) + offset;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
};

const normalizeMonitoringCondition = (value) => String(value || '').trim() || 'Unverified';

const parseMonitoringCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let number = Number(match[0]);
  if (!Number.isFinite(number)) return null;
  if (/[SW]/i.test(text)) number = -Math.abs(number);
  return number;
};


const monitoringPhotoTextCandidates = (buffer) => {
  const values = [];
  const maxHead = 4 * 1024 * 1024;
  const maxTail = 1024 * 1024;
  const head = buffer.slice(0, Math.min(buffer.length, maxHead));
  const tailStart = Math.max(head.length, buffer.length - maxTail);
  const sample = tailStart < buffer.length ? Buffer.concat([head, buffer.slice(tailStart)]) : head;
  try { values.push(sample.toString('utf8')); } catch (_) {}
  try { values.push(sample.toString('latin1')); } catch (_) {}
  try { values.push(sample.toString('utf16le')); } catch (_) {}
  return values.map(value => String(value || '').replace(/\0+/g, '\n'));
};

const monitoringExtractStampText = (values = []) => {
  const labels = ['GPS Datetime', 'Date/Time', 'Address', 'Coordinates', 'Latitude', 'Longitude', 'Accuracy', 'Bearing', 'Elevation', 'District', 'Barangay', 'Facing Zoning', 'Location Zoning', 'Zoning'];
  const lines = [];
  for (const value of values) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = String(value || '').match(new RegExp(`${escaped}\\s*[:=]?\\s*([^\\r\\n]{1,180})`, 'i'));
      if (match?.[1]) lines.push(`${label}: ${String(match[1]).trim()}`);
    }
  }
  return [...new Set(lines)].join('\n');
};

const monitoringParseExifDate = (value) => {
  const text = String(value || '').replace(/\0/g, '').trim();
  const match = text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return text || null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
};

const monitoringReadExifMetadata = (buffer) => {
  const out = { latitude: null, longitude: null, altitude_m: null, bearing_deg: null, captured_at: null, text: '' };
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return out;
  let app1Start = -1;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const dataStart = offset + 2;
    if (marker === 0xe1 && buffer.slice(dataStart, dataStart + 6).toString('ascii') === 'Exif\0\0') {
      app1Start = dataStart + 6;
      break;
    }
    offset += length;
  }
  if (app1Start < 0 || app1Start + 8 > buffer.length) return out;
  const little = buffer.slice(app1Start, app1Start + 2).toString('ascii') === 'II';
  const readU16 = pos => little ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos);
  const readU32 = pos => little ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos);
  const readI32 = pos => little ? buffer.readInt32LE(pos) : buffer.readInt32BE(pos);
  if (readU16(app1Start + 2) !== 42) return out;
  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const readValue = (entry, type, count) => {
    const size = (typeSize[type] || 1) * count;
    const dataPos = size <= 4 ? entry + 8 : app1Start + readU32(entry + 8);
    if (dataPos < 0 || dataPos + size > buffer.length) return null;
    if (type === 2) return buffer.slice(dataPos, dataPos + size).toString('ascii').replace(/\0+$/g, '').trim();
    if (type === 7 || type === 1) return buffer.slice(dataPos, dataPos + size);
    const values = [];
    for (let i = 0; i < count; i += 1) {
      const pos = dataPos + i * (typeSize[type] || 1);
      if (type === 3) values.push(readU16(pos));
      else if (type === 4) values.push(readU32(pos));
      else if (type === 9) values.push(readI32(pos));
      else if (type === 5) {
        const den = readU32(pos + 4);
        values.push(den ? readU32(pos) / den : 0);
      } else if (type === 10) {
        const den = readI32(pos + 4);
        values.push(den ? readI32(pos) / den : 0);
      }
    }
    return count === 1 ? values[0] : values;
  };
  const parseIfd = (relativeOffset) => {
    const result = new Map();
    const ifd = app1Start + Number(relativeOffset || 0);
    if (ifd < app1Start || ifd + 2 > buffer.length) return result;
    const count = readU16(ifd);
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (entry + 12 > buffer.length) break;
      const tag = readU16(entry);
      const type = readU16(entry + 2);
      const valueCount = readU32(entry + 4);
      result.set(tag, readValue(entry, type, valueCount));
    }
    return result;
  };
  const root = parseIfd(readU32(app1Start + 4));
  const exif = root.get(0x8769) ? parseIfd(root.get(0x8769)) : new Map();
  const gps = root.get(0x8825) ? parseIfd(root.get(0x8825)) : new Map();
  const decodeText = value => {
    if (typeof value === 'string') return value;
    if (!Buffer.isBuffer(value)) return '';
    const prefix = value.slice(0, 8).toString('ascii').replace(/\0/g, '').trim();
    const body = value.slice(prefix ? 8 : 0);
    if (/UNICODE/i.test(prefix)) return body.toString('utf16le').replace(/\0/g, '').trim();
    return body.toString('utf8').replace(/\0/g, '').trim();
  };
  const textParts = [root.get(0x010e), root.get(0x9c9c), exif.get(0x9286)].map(decodeText).filter(Boolean);
  out.text = textParts.join('\n');
  out.captured_at = monitoringParseExifDate(exif.get(0x9003) || exif.get(0x9004) || root.get(0x0132));
  const gpsCoordinate = (values, ref) => {
    const parts = Array.isArray(values) ? values : [];
    if (parts.length < 3 || parts.some(value => !Number.isFinite(Number(value)))) return null;
    let result = Number(parts[0]) + Number(parts[1]) / 60 + Number(parts[2]) / 3600;
    if (/^[SW]$/i.test(String(ref || ''))) result = -Math.abs(result);
    return result;
  };
  out.latitude = gpsCoordinate(gps.get(0x0002), gps.get(0x0001));
  out.longitude = gpsCoordinate(gps.get(0x0004), gps.get(0x0003));
  const altitude = gps.get(0x0006);
  if (Number.isFinite(Number(altitude))) out.altitude_m = Number(gps.get(0x0005) || 0) === 1 ? -Math.abs(Number(altitude)) : Number(altitude);
  const bearing = gps.get(0x0011);
  if (Number.isFinite(Number(bearing))) out.bearing_deg = Number(bearing);
  return out;
};

const monitoringGeoCamSignaturePresent = (textValues = [], stampText = '') => {
  const all = [...textValues, stampText].join('\n');
  if (/ABEDGEOCAM|DavaoCityGeoCamera|GeoCam Android camera/i.test(all)) return true;
  const labels = ['GPS Datetime', 'Latitude', 'Longitude', 'Accuracy', 'Bearing'];
  return labels.filter(label => new RegExp(`${label}\\s*[:=]`, 'i').test(all)).length >= 4;
};

const monitoringMetadataFromManualPhoto = async (file = {}) => {
  const buffer = fs.readFileSync(file.path);
  const exif = monitoringReadExifMetadata(buffer);
  const textValues = [...monitoringPhotoTextCandidates(buffer), exif.text];
  const stampText = monitoringExtractStampText(textValues);
  const stampedLatitude = monitoringStampCoordinate(stampText, 'latitude');
  const stampedLongitude = monitoringStampCoordinate(stampText, 'longitude');
  return {
    source_label: 'Manual upload',
    client_capture_id: null,
    captured_at: exif.captured_at,
    latitude: exif.latitude,
    longitude: exif.longitude,
    altitude_m: exif.altitude_m,
    accuracy_m: null,
    bearing_deg: exif.bearing_deg,
    stamp_text: stampText,
    stamped_latitude: stampedLatitude,
    stamped_longitude: stampedLongitude,
    coordinate_source: 'embedded_exif_manual',
    source_verified: monitoringGeoCamSignaturePresent(textValues, stampText),
    original_filename: file.originalname,
    file_type: file.mimetype || 'image/jpeg'
  };
};

const monitoringDriveDescriptionValue = (description, label) => {
  const match = String(description || '').match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.+)$`, 'im'));
  return match?.[1] ? String(match[1]).trim() : null;
};

const monitoringMetadataFromDrivePhoto = (row = {}) => {
  const description = String(row.description || '');
  const stampMarker = description.search(/^Stamp text\s*:/im);
  const stampText = stampMarker >= 0 ? description.slice(stampMarker).replace(/^Stamp text\s*:\s*/i, '').trim() : '';
  const latitude = parseMonitoringCoordinate(monitoringDriveDescriptionValue(description, 'Latitude'));
  const longitude = parseMonitoringCoordinate(monitoringDriveDescriptionValue(description, 'Longitude'));
  const tags = String(row.tags || '').toLowerCase();
  return {
    source_label: 'My Drive',
    client_capture_id: `monitoring-drive-${Number(row.id)}`,
    captured_at: monitoringDriveDescriptionValue(description, 'GPS datetime'),
    latitude,
    longitude,
    altitude_m: null,
    accuracy_m: parseMonitoringCoordinate(monitoringDriveDescriptionValue(description, 'Accuracy')),
    bearing_deg: parseMonitoringCoordinate(monitoringDriveDescriptionValue(description, 'Bearing')),
    stamp_text: stampText,
    stamped_latitude: monitoringStampCoordinate(stampText, 'latitude'),
    stamped_longitude: monitoringStampCoordinate(stampText, 'longitude'),
    coordinate_source: 'my_drive_geocam_metadata',
    source_verified: /source\s*:\s*abedgeocam android camera/i.test(description)
      && tags.includes('abedgeocam') && tags.includes('geotagged'),
    original_filename: row.original_name,
    file_type: row.file_type || 'image/jpeg'
  };
};

const monitoringProofCapturedDateKey = (metadata = {}) => {
  if (!metadata.captured_at) return null;
  return monitoringMapPhotoCapturedDateKey({ captured_at: metadata.captured_at });
};

const validateMonitoringGeoCamProofMetadata = (metadata = {}, monitoringDate = null, { requireEmbeddedExif = false } = {}) => {
  const label = metadata.source_label || 'Selected photo';
  if (!metadata.source_verified) return `${label} could not be verified as an original GeoCam Android photo with embedded image-stamp details.`;
  if (!Number.isFinite(Number(metadata.latitude)) || !Number.isFinite(Number(metadata.longitude))) return `${label} does not contain valid geotag coordinates.`;
  if (!String(metadata.captured_at || '').trim()) return `${label} is missing its original capture date and time.`;
  const stampText = String(metadata.stamp_text || '').trim();
  if (!stampText) return `${label} is missing the GeoCam image-stamp details.`;
  const stampedLatitude = Number.isFinite(Number(metadata.stamped_latitude)) ? Number(metadata.stamped_latitude) : monitoringStampCoordinate(stampText, 'latitude');
  const stampedLongitude = Number.isFinite(Number(metadata.stamped_longitude)) ? Number(metadata.stamped_longitude) : monitoringStampCoordinate(stampText, 'longitude');
  if (!Number.isFinite(stampedLatitude) || !Number.isFinite(stampedLongitude)) return `${label} image stamp must contain readable Latitude and Longitude values.`;
  if (Math.abs(stampedLatitude - Number(metadata.latitude)) > 0.002 || Math.abs(stampedLongitude - Number(metadata.longitude)) > 0.002) {
    return `${label} image-stamp coordinates do not match its geotag coordinates.`;
  }
  if (requireEmbeddedExif && String(metadata.coordinate_source || '') !== 'embedded_exif_manual') return `${label} must contain embedded EXIF GPS metadata.`;
  const capturedDate = monitoringProofCapturedDateKey(metadata);
  if (!capturedDate) return `${label} is missing a valid capture date.`;
  if (monitoringDate && capturedDate !== monitoringDate) return `${label} was captured on ${capturedDate}, not on the monitoring visit date ${monitoringDate}.`;
  return null;
};

const monitoringDrivePhotoPublicFields = (row = {}, metadata = {}) => ({
  id: row.id,
  owner_user_id: row.owner_user_id,
  owner_username: row.owner_username || null,
  original_filename: row.original_name,
  captured_at: metadata.captured_at,
  captured_date: monitoringProofCapturedDateKey(metadata),
  latitude: metadata.latitude,
  longitude: metadata.longitude,
  accuracy_m: metadata.accuracy_m,
  stamp_text: metadata.stamp_text,
  source: 'my_drive',
  view_url: `/api/user-drive/files/${row.id}/view`
});

const monitoringMapPhotoCapturedDateKey = (row = {}) => {
  const value = row.captured_at || row.uploaded_at;
  if (!value) return null;
  const raw = String(value).trim();
  const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/);
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  if (datePrefix && !hasExplicitTimezone) return parseMonitoringDateKey(datePrefix[1]);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return monitoringManilaDateKey(parsed);
};

const monitoringStampCoordinate = (stampText, kind) => {
  const label = kind === 'latitude'
    ? '(?:latitude|lat)'
    : '(?:longitude|long|lon|lng)';
  const match = String(stampText || '').match(new RegExp(`${label}\\s*[:=]?\\s*([+-]?\\d{1,3}(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
};

const validateMonitoringGeoCamMapPhoto = (row = {}, monitoringDate = null) => {
  if (!row?.id) return 'The selected Geotag Map photo does not exist.';
  if (String(row.source_type || '').toLowerCase() !== 'geocam') return 'Only photos sent by the GeoCam app can confirm a monitoring visit.';
  if (String(row.map_status || 'active') !== 'active') return 'The selected GeoCam photo is hidden or unavailable in Geotag Map.';
  if (row.monitoring_record_id) return 'The selected GeoCam photo already confirms another monitoring visit.';
  if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) return 'The selected GeoCam photo does not contain valid geotag coordinates.';
  if (!['valid', 'low_accuracy'].includes(String(row.location_status || ''))) return 'The selected GeoCam photo must contain its original GPS location from the GeoCam app.';
  if (String(row.coordinate_source || 'upload_payload').toLowerCase() === 'manual') return 'A manually positioned map photo cannot confirm a monitoring visit.';
  if (!String(row.client_capture_id || '').trim()) return 'The selected photo is missing its GeoCam capture identifier.';
  if (!String(row.captured_at || '').trim()) return 'The selected GeoCam photo is missing its original capture date and time.';
  const stampText = String(row.stamp_text || '').trim();
  if (!stampText) return 'The selected photo is missing the GeoCam image-stamp details.';
  const stampedLatitude = monitoringStampCoordinate(stampText, 'latitude');
  const stampedLongitude = monitoringStampCoordinate(stampText, 'longitude');
  if (!Number.isFinite(stampedLatitude) || !Number.isFinite(stampedLongitude)) return 'The GeoCam image stamp must contain readable Latitude and Longitude values.';
  if (Math.abs(stampedLatitude - Number(row.latitude)) > 0.002 || Math.abs(stampedLongitude - Number(row.longitude)) > 0.002) {
    return 'The coordinates in the GeoCam image stamp do not match the uploaded geotag coordinates.';
  }
  const capturedDate = monitoringMapPhotoCapturedDateKey(row);
  if (!capturedDate) return 'The selected GeoCam photo is missing a valid capture date.';
  if (monitoringDate && capturedDate !== monitoringDate) return `The selected GeoCam photo was captured on ${capturedDate}, not on the monitoring visit date ${monitoringDate}.`;
  return null;
};

const monitoringMapPhotoPublicFields = (row = {}) => ({
  id: row.id,
  owner_user_id: row.owner_user_id,
  owner_username: row.owner_username || null,
  original_filename: row.original_filename,
  latitude: row.latitude,
  longitude: row.longitude,
  accuracy_m: row.accuracy_m,
  bearing_deg: row.bearing_deg,
  captured_at: row.captured_at,
  captured_date: monitoringMapPhotoCapturedDateKey(row),
  uploaded_at: row.uploaded_at,
  district: row.district,
  barangay: row.barangay,
  zoning: row.zoning,
  location_zoning: row.location_zoning,
  facing_zoning: row.facing_zoning,
  category: row.category,
  stamp_text: row.stamp_text,
  location_status: row.location_status,
  coordinate_source: row.coordinate_source || null,
  confirmation_source: String(row.coordinate_source || '').includes('my_drive')
    ? 'My Drive'
    : String(row.coordinate_source || '').includes('embedded_exif_manual')
      ? 'Manual upload'
      : 'Geotag Map',
  thumbnail_url: row.thumbnail_path ? `/api/monitoring/geotag-photos/${row.id}/thumbnail` : null,
  map_thumbnail_url: row.thumbnail_path ? `/api/map/media/${row.id}/thumbnail` : null,
  original_url: `/api/map/media/${row.id}/original`
});

const monitoringStampValue = (stampText, label) => {
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(stampText || '').match(new RegExp(`${escaped}\\s*[:=]?\\s*([^\\r\\n]{1,160})`, 'i'));
  return match?.[1] ? String(match[1]).trim() : null;
};

const ensureMonitoringProofOnGeotagMap = async ({ req, metadata, sourcePath, fileHash, inventory, visitId, sourceKind }) => {
  const alreadyUsed = await dbGet(`SELECT id, monitoring_record_id FROM MapMedia WHERE file_hash = ? AND monitoring_record_id IS NOT NULL ORDER BY id LIMIT 1`, [fileHash]);
  if (alreadyUsed) {
    const error = new Error('This GeoCam photo already confirms another monitoring visit.');
    error.statusCode = 409;
    throw error;
  }
  const existing = await dbGet(`SELECT * FROM MapMedia WHERE owner_user_id = ? AND file_hash = ? ORDER BY id DESC LIMIT 1`, [req.user.id, fileHash]);
  const now = new Date().toISOString();
  if (existing) {
    if (existing.inventory_item_id && Number(existing.inventory_item_id) !== Number(inventory.id)) {
      const error = new Error('This GeoCam photo is already linked to another monitoring inventory item.');
      error.statusCode = 409;
      throw error;
    }
    const linked = await dbRun(`
      UPDATE MapMedia
      SET inventory_item_id = ?, monitoring_record_id = ?, project_id = COALESCE(project_id, ?),
          project_stage = COALESCE(project_stage, 'Monitoring'), map_status = 'active', updated_at = ?
      WHERE id = ? AND monitoring_record_id IS NULL
    `, [inventory.id, visitId, inventory.linked_project_id || null, now, existing.id]);
    if (Number(linked.changes || 0) !== 1) {
      const error = new Error('This GeoCam photo was linked to another monitoring visit while the visit was being saved.');
      error.statusCode = 409;
      throw error;
    }
    return { map_media_id: existing.id, created_paths: [], created: false };
  }

  const normalized = normalizeMapMediaMetadata({
    client_capture_id: metadata.client_capture_id || `monitoring-${sourceKind}-${String(fileHash).slice(0, 32)}`,
    captured_at: metadata.captured_at,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    altitude_m: metadata.altitude_m,
    accuracy_m: metadata.accuracy_m,
    bearing_deg: metadata.bearing_deg,
    zoning: monitoringStampValue(metadata.stamp_text, 'Zoning'),
    location_zoning: monitoringStampValue(metadata.stamp_text, 'Location Zoning'),
    facing_zoning: monitoringStampValue(metadata.stamp_text, 'Facing Zoning'),
    district: monitoringStampValue(metadata.stamp_text, 'District'),
    barangay: monitoringStampValue(metadata.stamp_text, 'Barangay'),
    category: 'Monitoring Confirmation',
    remarks: `Monitoring confirmation imported from ${metadata.source_label || sourceKind}.`,
    stamp_text: metadata.stamp_text,
    project_id: inventory.linked_project_id || null,
    project_stage: 'Monitoring',
    visibility: 'organization',
    coordinate_source: metadata.coordinate_source || sourceKind
  });
  validateMapMediaDavaoLocation(normalized);
  await validateMapProjectAccess(req.user, normalized.project_id);

  const stored = safeMapMediaFilename(metadata.original_filename || 'monitoring-confirmation.jpg');
  const originalAbsolute = path.join(MAP_MEDIA_ORIGINALS_DIR, stored);
  fs.copyFileSync(sourcePath, originalAbsolute);
  const createdPaths = [originalAbsolute];
  let thumbnailPath = null;
  try {
    thumbnailPath = await generateMapMediaThumbnail(originalAbsolute, stored);
    if (thumbnailPath) createdPaths.push(path.join(MAP_MEDIA_THUMBNAILS_DIR, thumbnailPath));
  } catch (error) {
    logError('MONITORING_CONFIRMATION_THUMBNAIL', error.message, error.stack);
  }
  try {
    const stat = fs.statSync(sourcePath);
    const result = await dbRun(`
      INSERT INTO MapMedia (
        owner_user_id, uploaded_by_user_id, project_id, project_stage, inventory_item_id, monitoring_record_id,
        client_capture_id, source_type, original_filename, stored_filename, original_path, thumbnail_path,
        file_size, file_type, file_hash, latitude, longitude, altitude_m, accuracy_m, bearing_deg,
        captured_at, zoning, location_zoning, facing_zoning, district, barangay, location_description,
        category, remarks, stamp_text, visibility, coordinate_source, location_status, map_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'Monitoring', ?, ?, ?, 'geocam', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
      req.user.id, req.user.id, inventory.linked_project_id || null, inventory.id, visitId,
      normalized.client_capture_id, metadata.original_filename || stored, stored, stored, thumbnailPath,
      Number(stat.size || 0), metadata.file_type || 'image/jpeg', fileHash,
      normalized.latitude, normalized.longitude, normalized.altitude_m, normalized.accuracy_m, normalized.bearing_deg,
      normalized.captured_at, normalized.zoning, normalized.location_zoning, normalized.facing_zoning,
      normalized.district, normalized.barangay, normalized.location_description,
      normalized.category, normalized.remarks, normalized.stamp_text, normalized.visibility,
      normalized.coordinate_source, normalized.location_status, now, now
    ]);
    logActivity({ req, action: 'MONITORING_CONFIRMATION_ADDED_TO_MAP', projectId: inventory.linked_project_id || null, details: `${metadata.original_filename || stored} added from ${metadata.source_label || sourceKind}` });
    return { map_media_id: result.lastID, created_paths: createdPaths, created: true };
  } catch (error) {
    createdPaths.forEach(filePath => { try { if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true }); } catch (_) {} });
    throw error;
  }
};

const monitoringPriorityRank = { Critical: 1, High: 2, Medium: 3, Low: 4 };

const computeMonitoringPriority = (item = {}) => {
  const override = String(item.priority_override || '').trim();
  if (monitoringPriorityRank[override]) return override;
  const condition = String(item.condition_status || '').toLowerCase();
  const openCritical = Number(item.critical_task_count || 0) > 0;
  if (openCritical || /non[- ]?operational|irreparable|unsafe|missing asset/.test(condition)) return 'Critical';
  const today = manilaDateStart(monitoringManilaDateKey());
  const lastDate = parseMonitoringDateKey(item.last_monitoring_date);
  const nextDate = parseMonitoringDateKey(item.next_monitoring_date) || (lastDate ? addMonthsToDateKey(lastDate, item.monitoring_frequency_months || 12) : null);
  if (!lastDate || !condition || condition === 'unverified') return 'High';
  if (nextDate) {
    const days = Math.ceil((manilaDateStart(nextDate) - today) / 86400000);
    if (days < 0) return days < -90 ? 'High' : 'Medium';
    if (days <= 60) return 'Medium';
  }
  if (Number(item.open_task_count || 0) > 0 || /newly delivered/.test(condition)) return 'Medium';
  return 'Low';
};

const hydrateMonitoringItem = (item = {}) => {
  const lastDate = parseMonitoringDateKey(item.last_monitoring_date);
  const nextDate = parseMonitoringDateKey(item.next_monitoring_date) || (lastDate ? addMonthsToDateKey(lastDate, item.monitoring_frequency_months || 12) : null);
  let due_status = 'Current';
  if (!lastDate) due_status = 'Never Monitored';
  else if (nextDate) {
    const days = Math.ceil((manilaDateStart(nextDate) - manilaDateStart(monitoringManilaDateKey())) / 86400000);
    if (days < 0) due_status = 'Overdue';
    else if (days <= 60) due_status = 'Due Soon';
  }
  return { ...item, next_monitoring_date: nextDate, due_status, computed_priority: computeMonitoringPriority({ ...item, next_monitoring_date: nextDate }) };
};

const monitoringInventorySelectSql = `
  SELECT mi.*,
         au.username AS assigned_username,
         p.name AS linked_project_name,
         (SELECT COUNT(*) FROM MonitoringTasks mt WHERE mt.inventory_id = mi.id AND mt.status NOT IN ('Completed','Closed','Cancelled')) AS open_task_count,
         (SELECT COUNT(*) FROM MonitoringTasks mt WHERE mt.inventory_id = mi.id AND mt.status NOT IN ('Completed','Closed','Cancelled') AND mt.priority = 'Critical') AS critical_task_count,
         (SELECT COUNT(*) FROM MonitoringVisits mv WHERE mv.inventory_id = mi.id) AS visit_count
  FROM MonitoringInventory mi
  LEFT JOIN Users au ON au.id = mi.assigned_user_id
  LEFT JOIN Projects p ON p.id = mi.linked_project_id
`;

const loadMonitoringInventoryRows = async () => {
  const rows = await dbAll(`${monitoringInventorySelectSql} ORDER BY mi.inventory_code ASC`);
  return rows.map(hydrateMonitoringItem);
};

const nextMonitoringInventoryCode = async (assetType = 'Asset') => {
  const prefixMap = {
    'Machinery & Equipment': 'AFME',
    Infrastructure: 'INFRA',
    'Irrigation System': 'IRR',
    Facility: 'FAC',
    Vehicle: 'VEH',
    Other: 'ASSET'
  };
  const prefix = prefixMap[assetType] || 'ASSET';
  const rows = await dbAll(`SELECT inventory_code FROM MonitoringInventory WHERE inventory_code LIKE ?`, [`${prefix}-%`]);
  const maxNumber = rows.reduce((max, row) => {
    const match = String(row.inventory_code || '').match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const width = prefix === 'AFME' ? 4 : 5;
  return `${prefix}-${String(maxNumber + 1).padStart(width, '0')}`;
};

const monitoringWritableFields = [
  'inventory_code','asset_type','asset_subtype','asset_name','asset_description','commodity','registration_no','source_of_fund','year_funded','supplier',
  'project_cost','date_completed','warranty_expiry','responsible_office','service_area','capacity',
  'machine_brand','machine_model','machine_serial_no','engine_brand','engine_model','engine_serial_no','engine_make','rated_power',
  'recipient_organization','contact_person','designation','contact_no','purok','barangay','district','latitude','longitude','latitude_raw','longitude_raw',
  'condition_status','date_received','monitoring_frequency_months','next_monitoring_date','priority_override','assigned_user_id','linked_project_id','lifecycle_status','notes',
  'baseline_remarks','baseline_actions_recommendations','baseline_preceding_reports'
];

const cleanMonitoringPayload = (body = {}) => {
  const payload = {};
  monitoringWritableFields.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    let value = body[field];
    if (['assigned_user_id','linked_project_id'].includes(field)) value = value ? Number(value) : null;
    if (field === 'monitoring_frequency_months') value = Math.max(1, Math.min(60, Number(value || 12)));
    if (field === 'project_cost') value = value === '' || value === null || value === undefined ? null : Number(value);
    if (['latitude','longitude'].includes(field)) value = value === '' || value === null || value === undefined ? null : Number(value);
    if (typeof value === 'string') value = value.trim() || null;
    payload[field] = value;
  });
  return payload;
};

const insertMonitoringInventoryRecord = async (record, createdByUserId = null) => {
  const fields = monitoringWritableFields.filter(field => Object.prototype.hasOwnProperty.call(record, field));
  const values = fields.map(field => record[field]);
  fields.push('source_row_number','source_name','last_monitoring_date','created_by_user_id','created_at','updated_at');
  values.push(record.source_row_number || null, record.source_name || null, record.last_monitoring_date || null, createdByUserId || null, new Date().toISOString(), new Date().toISOString());
  const result = await dbRun(`INSERT INTO MonitoringInventory (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, values);
  return result.lastID;
};

const syncProjectToMonitoringInventory = async (projectId, createdByUserId = null) => {
  const project = await dbGet(`
    SELECT p.*, pt.name AS project_type_name, r.name AS requestee_name
    FROM Projects p
    LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
    LEFT JOIN Requestees r ON r.id = p.requestee_id
    WHERE p.id = ?
  `, [Number(projectId)]);
  if (!project || !['Monitoring', 'Completed'].includes(project.stage)) return null;

  const assetType = ['Machinery & Equipment', 'Infrastructure', 'Irrigation System', 'Facility', 'Vehicle', 'Other'].includes(project.project_type_name)
    ? project.project_type_name
    : 'Other';
  const today = monitoringManilaDateKey();
  const record = {
    asset_type: assetType,
    asset_subtype: project.project_type_name || null,
    asset_name: project.name,
    asset_description: `Project Control record moved to ${project.stage}.`,
    recipient_organization: project.requester,
    barangay: project.barangay,
    district: project.district,
    responsible_office: project.requestee_name,
    condition_status: 'Unverified',
    date_completed: project.stage === 'Completed' ? today : null,
    monitoring_frequency_months: 12,
    linked_project_id: project.id,
    assigned_user_id: project.assigned_user_id || null,
    lifecycle_status: 'Active',
    notes: project.completion_remarks || project.monitoring_remarks || project.implementation_remarks || project.proposal_remarks || null,
    source_name: 'Project Control',
    source_row_number: project.id
  };

  const existing = await dbGet(`SELECT id FROM MonitoringInventory WHERE linked_project_id = ? OR (source_name = ? AND source_row_number = ?) LIMIT 1`, [project.id, record.source_name, record.source_row_number]);
  if (!existing) {
    record.inventory_code = await nextMonitoringInventoryCode(assetType);
    return insertMonitoringInventoryRecord(record, createdByUserId);
  }

  const fields = [
    'asset_type','asset_subtype','asset_name','asset_description','recipient_organization','barangay','district',
    'responsible_office','linked_project_id','assigned_user_id','lifecycle_status','notes','source_name','source_row_number'
  ];
  const values = fields.map(field => record[field]);
  await dbRun(`
    UPDATE MonitoringInventory
    SET ${fields.map(field => `${field} = ?`).join(', ')},
        date_completed = COALESCE(date_completed, ?),
        updated_at = ?
    WHERE id = ?
  `, [...values, record.date_completed, new Date().toISOString(), existing.id]);
  return existing.id;
};

const parseInitialMonitoringWorkbook = () => {
  if (!fs.existsSync(INITIAL_MONITORING_WORKBOOK_PATH)) throw new Error(`Initial monitoring workbook is missing: ${INITIAL_MONITORING_WORKBOOK_PATH}`);
  const workbook = XLSX.readFile(INITIAL_MONITORING_WORKBOOK_PATH, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const headerIndex = rows.findIndex(row => String(row?.[0] || '').trim() === '#' && /machinery|asset|project/i.test(String(row?.[1] || '')));
  if (headerIndex < 0) throw new Error('The packaged AFME workbook format is not recognized.');
  const records = [];
  for (let index = headerIndex + 2; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const assetName = String(row[1] || '').trim();
    if (!assetName) continue;
    const sourceRowNumber = Number(row[0]) || records.length + 1;
    const lastMonitoring = parseMonitoringDateKey(row[28]);
    const nextMonitoring = lastMonitoring ? addMonthsToDateKey(lastMonitoring, 12) : null;
    records.push({
      inventory_code: `AFME-${String(sourceRowNumber).padStart(4, '0')}`,
      source_row_number: sourceRowNumber,
      source_name: INITIAL_MONITORING_INVENTORY_SOURCE,
      asset_type: 'Machinery & Equipment',
      asset_name: assetName,
      commodity: row[2] == null ? null : String(row[2]),
      registration_no: row[3] == null ? null : String(row[3]),
      source_of_fund: row[4] == null ? null : String(row[4]),
      year_funded: row[5] == null ? null : String(row[5]),
      supplier: row[6] == null ? null : String(row[6]),
      capacity: row[7] == null ? null : String(row[7]),
      machine_brand: row[8] == null ? null : String(row[8]),
      machine_model: row[9] == null ? null : String(row[9]),
      machine_serial_no: row[10] == null ? null : String(row[10]),
      engine_brand: row[11] == null ? null : String(row[11]),
      engine_model: row[12] == null ? null : String(row[12]),
      engine_serial_no: row[13] == null ? null : String(row[13]),
      engine_make: row[14] == null ? null : String(row[14]),
      rated_power: row[15] == null ? null : String(row[15]),
      recipient_organization: row[16] == null ? null : String(row[16]),
      contact_person: row[17] == null ? null : String(row[17]),
      designation: row[18] == null ? null : String(row[18]),
      contact_no: row[19] == null ? null : String(row[19]),
      purok: row[20] == null ? null : String(row[20]),
      barangay: row[21] == null ? null : String(row[21]),
      district: row[22] == null ? null : String(row[22]),
      latitude: parseMonitoringCoordinate(row[23]),
      longitude: parseMonitoringCoordinate(row[24]),
      latitude_raw: row[23] == null ? null : String(row[23]),
      longitude_raw: row[24] == null ? null : String(row[24]),
      condition_status: normalizeMonitoringCondition(row[25]),
      date_received: parseMonitoringDateKey(row[26]),
      monitoring_frequency_months: 12,
      last_monitoring_date: lastMonitoring,
      next_monitoring_date: nextMonitoring,
      lifecycle_status: 'Active',
      baseline_remarks: row[29] == null ? null : String(row[29]),
      baseline_actions_recommendations: row[30] == null ? null : String(row[30]),
      baseline_preceding_reports: row[31] == null ? null : String(row[31])
    });
  }
  return records;
};

const seedInitialMonitoringInventory = async () => {
  const count = await dbGet(`SELECT COUNT(*) AS count FROM MonitoringInventory`);
  if (Number(count?.count || 0) > 0) return { seeded: 0, skipped_existing: true };
  const records = parseInitialMonitoringWorkbook();
  await dbRun('BEGIN IMMEDIATE');
  try {
    let seeded = 0;
    let visits = 0;
    for (const item of records) {
      const inventoryId = await insertMonitoringInventoryRecord(item, null);
      if (item.last_monitoring_date) {
        await dbRun(`INSERT INTO MonitoringVisits (
          inventory_id, monitoring_date, monitoring_type, condition_status, findings, actions_recommendations,
          preceding_reports, next_monitoring_date, inspector_username, finalized, created_at, updated_at
        ) VALUES (?, ?, 'Imported Monitoring Record', ?, ?, ?, ?, ?, 'Imported from Excel', 1, ?, ?)`, [
          inventoryId, item.last_monitoring_date, item.condition_status, item.baseline_remarks,
          item.baseline_actions_recommendations, item.baseline_preceding_reports, item.next_monitoring_date,
          new Date().toISOString(), new Date().toISOString()
        ]);
        visits += 1;
      }
      seeded += 1;
    }
    await dbRun('COMMIT');
    console.log(`Seeded ${seeded} monitoring inventory records and ${visits} historical visits from the AFME workbook.`);
    return { seeded, visits };
  } catch (error) {
    await dbRun('ROLLBACK').catch(() => {});
    throw error;
  }
};

const monitoringCalendarDateKey = (value) => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return monitoringManilaDateKey(parsed);
  return parseMonitoringDateKey(String(value || '').slice(0, 10));
};

const syncMonitoringInventoryScheduleFromCalendar = async (event = {}, { removed = false } = {}) => {
  const inventoryId = Number(event.related_inventory_id || 0);
  if (!inventoryId) return;
  try {
    const eventStatus = String(event.status || 'active').toLowerCase();
    const eventType = String(event.event_type || '').toLowerCase();
    if (!removed && eventStatus === 'active' && eventType === 'monitoring') {
      const scheduledDate = monitoringCalendarDateKey(event.start_datetime);
      if (scheduledDate) {
        await dbRun(`UPDATE MonitoringInventory SET next_monitoring_date = ?, updated_at = ? WHERE id = ?`, [scheduledDate, new Date().toISOString(), inventoryId]);
        return;
      }
    }
    const activeEvents = await dbAll(`
      SELECT id, start_datetime
      FROM CalendarEvents
      WHERE related_inventory_id = ?
        AND event_type = 'monitoring'
        AND COALESCE(status, 'active') = 'active'
        AND id != ?
      ORDER BY datetime(start_datetime) ASC, id ASC
    `, [inventoryId, Number(event.id || 0)]);
    const todayKey = monitoringManilaDateKey();
    const nextScheduledDate = (activeEvents || [])
      .map(row => monitoringCalendarDateKey(row.start_datetime))
      .filter(dateKey => dateKey && dateKey >= todayKey)
      .sort()[0] || null;
    const inventory = await dbGet(`SELECT last_monitoring_date, monitoring_frequency_months FROM MonitoringInventory WHERE id = ?`, [inventoryId]);
    if (!inventory) return;
    const fallbackDate = inventory.last_monitoring_date
      ? addMonthsToDateKey(inventory.last_monitoring_date, inventory.monitoring_frequency_months || 12)
      : null;
    await dbRun(`UPDATE MonitoringInventory SET next_monitoring_date = ?, updated_at = ? WHERE id = ?`, [nextScheduledDate || fallbackDate, new Date().toISOString(), inventoryId]);
  } catch (error) {
    logError('MONITORING_CALENDAR_SYNC', error.message, error.stack);
  }
};
