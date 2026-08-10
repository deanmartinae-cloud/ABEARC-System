const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const normalizeBearing = (value) => {
  const bearing = toNullableNumber(value);
  if (bearing === null) return null;
  if (!Number.isFinite(bearing)) return NaN;
  return ((bearing % 360) + 360) % 360;
};

const mapLocationStatus = ({ latitude, longitude, accuracyM, manual = false }) => {
  if (manual) return 'manual_location';
  if (latitude === null || longitude === null) return 'missing_coordinates';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return 'invalid_coordinates';
  if (accuracyM !== null && (!Number.isFinite(accuracyM) || accuracyM < 0)) return 'invalid_coordinates';
  if (accuracyM !== null && accuracyM > mapMediaConfig.lowAccuracyThresholdM) return 'low_accuracy';
  return 'valid';
};

let mapDavaoBoundaryPolygons = null;

const loadMapDavaoBoundaryPolygons = () => {
  if (mapDavaoBoundaryPolygons) return mapDavaoBoundaryPolygons;
  const boundaryPath = path.join(__dirname, 'public', 'assets', 'data', 'davao-city-boundary.geojson');
  const boundary = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
  const geometries = (boundary.features || []).map(feature => feature?.geometry).filter(Boolean);
  mapDavaoBoundaryPolygons = geometries.flatMap(geometry => {
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates;
    return [];
  });
  if (!mapDavaoBoundaryPolygons.length) throw new Error('Davao City boundary is unavailable.');
  return mapDavaoBoundaryPolygons;
};

const mapPointOnBoundarySegment = (longitude, latitude, start, end) => {
  const cross = (latitude - start[1]) * (end[0] - start[0]) - (longitude - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return longitude >= Math.min(start[0], end[0]) - 1e-10
    && longitude <= Math.max(start[0], end[0]) + 1e-10
    && latitude >= Math.min(start[1], end[1]) - 1e-10
    && latitude <= Math.max(start[1], end[1]) + 1e-10;
};

const mapPointInBoundaryRing = (longitude, latitude, ring) => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (mapPointOnBoundarySegment(longitude, latitude, previousPoint, currentPoint)) return true;
    const crossesLatitude = (currentPoint[1] > latitude) !== (previousPoint[1] > latitude);
    if (!crossesLatitude) continue;
    const intersectionLongitude = (previousPoint[0] - currentPoint[0]) * (latitude - currentPoint[1])
      / (previousPoint[1] - currentPoint[1]) + currentPoint[0];
    if (longitude < intersectionLongitude) inside = !inside;
  }
  return inside;
};

const isMapPointInsideDavaoCity = (latitude, longitude) => loadMapDavaoBoundaryPolygons().some(polygon => {
  if (!polygon.length || !mapPointInBoundaryRing(longitude, latitude, polygon[0])) return false;
  return !polygon.slice(1).some(hole => mapPointInBoundaryRing(longitude, latitude, hole));
});

const validateMapMediaDavaoLocation = metadata => {
  if (!Number.isFinite(metadata.latitude) || !Number.isFinite(metadata.longitude)) return;
  if (isMapPointInsideDavaoCity(metadata.latitude, metadata.longitude)) return;
  const err = new Error('Photo rejected. Its geotag location is outside Davao City.');
  err.code = 'MAP_MEDIA_OUTSIDE_DAVAO_CITY';
  err.statusCode = 422;
  throw err;
};

const mapZoningFromStampText = (text = '') => {
  const out = { zoning: '', location_zoning: '', facing_zoning: '' };
  const labels = {
    'Zoning:': 'zoning',
    'Location Zoning:': 'location_zoning',
    'Facing Zoning:': 'facing_zoning'
  };
  let pending = '';
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = String(raw || '').trim();
    if (pending && line && !line.includes(':')) {
      if (!out[pending]) out[pending] = line;
      pending = '';
      return;
    }
    pending = '';
    Object.entries(labels).forEach(([label, key]) => {
      if (!line.startsWith(label)) return;
      const value = line.slice(label.length).trim();
      if (value) out[key] = value;
      else pending = key;
    });
  });
  const known = mapZoningNameFromText(text);
  if (known && !out.zoning && !out.location_zoning && !out.facing_zoning) out.zoning = known;
  return out;
};

const mapZoningNameFromText = (text = '') => {
  const haystack = String(text || '').toLowerCase();
  const zones = [
    'Agri-Industrial Zone', 'Aquaculture Sub-Zone', 'Buffer/Greenbelt Zone', 'Commercial-1 Zone',
    'Commercial-2 Zone', 'Commercial-3 Zone', 'Cemetery/Memorial Park Zone', 'Critical Watershed Zone',
    'Industrial-1 Zone', 'Industrial-2 Zone', 'Industrial-3 Zone', 'Institutional Zone',
    'Mangrove Sub-Zone', 'Open Space/Easement Zone', 'Parks and Recreation Zone',
    'Production Agricultural Sub-Zone', 'Production Forest Sub-Zone', 'Protected Agricultural Sub-Zone',
    'Protection Forest Sub-Zone', 'Residential-1 Zone', 'Residential-3 Zone',
    'Rivers, Creeks, and Lakes Sub-Zone', 'Socialized Housing Zone', 'Special Institutional Zone',
    'Tourism Development Zone', 'Urban Ecological Enhancement Zone', 'Utilities, Transportation, and Services Zone',
    'Wetlands Sub-Zone', 'Waste Management, Treatment, Utilization, Disposal Zone',
    'Agricultural Zone', 'Forest and Forestland Zone', 'General Commercial Zone',
    'General Industrial Zone', 'General Institutional Zone', 'General Residential Zone',
    'Production Water Sub-Zone', 'Protected Water Sub-Zone', 'Unknown/Unclassified'
  ];
  return zones.find(zone => haystack.includes(zone.toLowerCase())) || '';
};

const normalizeMapMediaMetadata = (body = {}) => {
  const latitude = toNullableNumber(body.latitude);
  const longitude = toNullableNumber(body.longitude);
  const accuracyM = toNullableNumber(body.accuracy_m);
  const bearing = normalizeBearing(body.bearing_deg);
  const stampText = String(body.stamp_text || '').trim() || null;
  const remarks = String(body.remarks || '').trim() || null;
  const category = String(body.category || 'General').trim() || 'General';
  const stampAdminValue = label => {
    const line = String(stampText || '').split(/\r?\n/)
      .find(raw => String(raw || '').trim().toLowerCase().startsWith(`${label.toLowerCase()}:`));
    return line ? String(line).trim().slice(label.length + 1).trim() : '';
  };
  const safeAdminValue = (value, label) => {
    const text = String(value || '').trim();
    if (!text || text.toLowerCase() === category.toLowerCase()) return null;
    if (new RegExp(`^unknown ${label}$`, 'i').test(text)) return null;
    if (/^\d{4}[-_.]\d{1,2}[-_.]\d{1,2}$/.test(text)) return null;
    return text;
  };
  const district = safeAdminValue(
    stampAdminValue('District') || body.district, 'district');
  const barangay = safeAdminValue(
    stampAdminValue('Barangay') || body.barangay, 'barangay');
  const stampZoning = mapZoningFromStampText([stampText, remarks, body.location_description].filter(Boolean).join('\n'));
  return {
    client_capture_id: String(body.client_capture_id || '').trim() || null,
    captured_at: String(body.captured_at || '').trim() || null,
    latitude,
    longitude,
    altitude_m: toNullableNumber(body.altitude_m),
    accuracy_m: accuracyM,
    bearing_deg: bearing,
    zoning: String(body.zoning || '').trim() || stampZoning.zoning || null,
    location_zoning: String(body.location_zoning || '').trim() || stampZoning.location_zoning || null,
    facing_zoning: String(body.facing_zoning || '').trim() || stampZoning.facing_zoning || null,
    district,
    barangay,
    location_description: String(body.location_description || '').trim() || null,
    category,
    remarks,
    stamp_text: stampText,
    project_id: body.project_id ? Number(body.project_id) : null,
    project_stage: String(body.project_stage || '').trim() || null,
    calendar_event_id: body.calendar_event_id ? Number(body.calendar_event_id) : null,
    visibility: String(body.visibility || mapMediaConfig.defaultVisibility).trim() || mapMediaConfig.defaultVisibility,
    coordinate_source: String(body.coordinate_source || 'upload_payload').trim() || 'upload_payload',
    location_status: mapLocationStatus({ latitude, longitude, accuracyM })
  };
};
