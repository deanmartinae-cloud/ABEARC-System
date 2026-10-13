const ensureMapLayoutsMigration = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS MapLayouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    state_json TEXT NOT NULL,
    state_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_user_id) REFERENCES Users(id)
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_map_layouts_owner_updated ON MapLayouts(owner_user_id, updated_at DESC)`);
};
