const ensureMapOrthomosaicMigration = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS MapOrthomosaics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    processed_path TEXT,
    uploaded_by_user_id INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    orthomosaic_date TEXT,
    date_source TEXT,
    survey_date TEXT,
    source_crs TEXT,
    source_epsg TEXT,
    source_bbox_json TEXT,
    west REAL,
    south REAL,
    east REAL,
    north REAL,
    mercator_min_x REAL,
    mercator_min_y REAL,
    mercator_max_x REAL,
    mercator_max_y REAL,
    center_lng REAL,
    center_lat REAL,
    raster_width INTEGER,
    raster_height INTEGER,
    pixel_resolution_x REAL,
    pixel_resolution_y REAL,
    coverage_area_ha REAL,
    file_size INTEGER NOT NULL DEFAULT 0,
    processing_status TEXT NOT NULL DEFAULT 'processing',
    processing_error TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id)
  )`);
  await addColumnIfMissing('MapOrthomosaics', 'coverage_area_ha', 'REAL');
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_map_orthomosaics_status ON MapOrthomosaics(processing_status, is_active)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_map_orthomosaics_date ON MapOrthomosaics(orthomosaic_date)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_map_orthomosaics_uploader ON MapOrthomosaics(uploaded_by_user_id)`);
};
