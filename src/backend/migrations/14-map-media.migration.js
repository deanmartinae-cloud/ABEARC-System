db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS MapMedia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    uploaded_by_user_id INTEGER NOT NULL,
    project_id INTEGER,
    project_stage TEXT,
    inventory_item_id INTEGER,
    monitoring_record_id INTEGER,
    calendar_event_id INTEGER,
    client_capture_id TEXT,
    source_type TEXT NOT NULL DEFAULT 'geocam',
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    thumbnail_path TEXT,
    file_size INTEGER DEFAULT 0,
    file_type TEXT,
    file_hash TEXT,
    latitude REAL,
    longitude REAL,
    altitude_m REAL,
    accuracy_m REAL,
    bearing_deg REAL,
    captured_at TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    zoning TEXT,
    location_zoning TEXT,
    facing_zoning TEXT,
    district TEXT,
    barangay TEXT,
    location_description TEXT,
    category TEXT DEFAULT 'General',
    remarks TEXT,
    stamp_text TEXT,
    visibility TEXT DEFAULT 'organization',
    coordinate_source TEXT DEFAULT 'upload_payload',
    location_status TEXT DEFAULT 'valid',
    map_status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_user_id) REFERENCES Users(id),
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(calendar_event_id) REFERENCES CalendarEvents(id)
  )`);

  [
    ['owner_user_id', 'INTEGER'],
    ['uploaded_by_user_id', 'INTEGER'],
    ['project_id', 'INTEGER'],
    ['project_stage', 'TEXT'],
    ['inventory_item_id', 'INTEGER'],
    ['monitoring_record_id', 'INTEGER'],
    ['calendar_event_id', 'INTEGER'],
    ['client_capture_id', 'TEXT'],
    ['source_type', "TEXT DEFAULT 'geocam'"],
    ['original_filename', 'TEXT'],
    ['stored_filename', 'TEXT'],
    ['original_path', 'TEXT'],
    ['thumbnail_path', 'TEXT'],
    ['file_size', 'INTEGER DEFAULT 0'],
    ['file_type', 'TEXT'],
    ['file_hash', 'TEXT'],
    ['latitude', 'REAL'],
    ['longitude', 'REAL'],
    ['altitude_m', 'REAL'],
    ['accuracy_m', 'REAL'],
    ['bearing_deg', 'REAL'],
    ['captured_at', 'TEXT'],
    ['uploaded_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
    ['zoning', 'TEXT'],
    ['location_zoning', 'TEXT'],
    ['facing_zoning', 'TEXT'],
    ['district', 'TEXT'],
    ['barangay', 'TEXT'],
    ['location_description', 'TEXT'],
    ['category', "TEXT DEFAULT 'General'"],
    ['remarks', 'TEXT'],
    ['stamp_text', 'TEXT'],
    ['visibility', "TEXT DEFAULT 'organization'"],
    ['coordinate_source', "TEXT DEFAULT 'upload_payload'"],
    ['location_status', "TEXT DEFAULT 'valid'"],
    ['map_status', "TEXT DEFAULT 'active'"],
    ['created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP']
  ].forEach(([column, definition]) => {
    columnExists('MapMedia', column, (err, exists) => {
      if (!err && !exists) db.run(`ALTER TABLE MapMedia ADD COLUMN ${column} ${definition}`);
    });
  });

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mapmedia_capture ON MapMedia(owner_user_id, client_capture_id) WHERE client_capture_id IS NOT NULL`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_hash ON MapMedia(owner_user_id, file_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_coordinates ON MapMedia(latitude, longitude)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_captured ON MapMedia(captured_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_uploaded ON MapMedia(uploaded_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_owner ON MapMedia(owner_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_project ON MapMedia(project_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_location ON MapMedia(district, barangay)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mapmedia_status ON MapMedia(map_status, location_status)`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectDocumentMapMediaLinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    map_media_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, map_media_id),
    FOREIGN KEY(document_id) REFERENCES Documents(id) ON DELETE CASCADE,
    FOREIGN KEY(map_media_id) REFERENCES MapMedia(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES Projects(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_doc_map_document ON ProjectDocumentMapMediaLinks(document_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_doc_map_media ON ProjectDocumentMapMediaLinks(map_media_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_doc_map_project ON ProjectDocumentMapMediaLinks(project_id)`);

  db.run(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
          SELECT id, 'view_abearc_map', 1 FROM Users WHERE role IN ('admin', 'user')`);
  db.run(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
          SELECT id, 'upload_map_media', 1 FROM Users WHERE role IN ('admin', 'user')`);
  db.run(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
          SELECT id, 'manage_own_map_media', 1 FROM Users WHERE role IN ('admin', 'user')`);
  db.run(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
          SELECT id, 'review_map_locations', 1 FROM Users WHERE role IN ('admin', 'user')`);
  db.run(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
          SELECT id, 'manage_all_map_media', 1 FROM Users WHERE role = 'admin'`);
});
