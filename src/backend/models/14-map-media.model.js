const mapMediaPublicFields = (row = {}) => ({
  ...row,
  thumbnail_url: row.thumbnail_path ? `/api/map/media/${row.id}/thumbnail` : null,
  original_url: `/api/map/media/${row.id}/original`
});

const mapMediaGeoJsonFeature = (row = {}) => ({
  type: 'Feature',
  id: row.id,
  geometry: {
    type: 'Point',
    coordinates: [Number(row.longitude), Number(row.latitude)]
  },
  properties: {
    map_media_id: row.id,
    thumbnail_url: row.thumbnail_path ? `/api/map/media/${row.id}/thumbnail` : null,
    owner_user_id: row.owner_user_id,
    owner_username: row.owner_username,
    captured_at: row.captured_at,
    uploaded_at: row.uploaded_at,
    accuracy_m: row.accuracy_m,
    bearing_deg: row.bearing_deg,
    zoning: row.zoning,
    district: row.district,
    barangay: row.barangay,
    category: row.category,
    project_id: row.project_id,
    project_stage: row.project_stage,
    project_document_linked: Number(row.project_document_linked || 0),
    location_status: row.location_status,
    map_status: row.map_status,
    photo_count: 1
  }
});
