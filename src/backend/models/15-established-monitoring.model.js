db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS MonitoringInventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_code TEXT UNIQUE NOT NULL,
    source_row_number INTEGER,
    source_name TEXT,
    asset_type TEXT NOT NULL DEFAULT 'Machinery & Equipment',
    asset_subtype TEXT,
    asset_name TEXT NOT NULL,
    asset_description TEXT,
    commodity TEXT,
    registration_no TEXT,
    source_of_fund TEXT,
    year_funded TEXT,
    supplier TEXT,
    project_cost REAL,
    date_completed TEXT,
    warranty_expiry TEXT,
    responsible_office TEXT,
    service_area TEXT,
    capacity TEXT,
    machine_brand TEXT,
    machine_model TEXT,
    machine_serial_no TEXT,
    engine_brand TEXT,
    engine_model TEXT,
    engine_serial_no TEXT,
    engine_make TEXT,
    rated_power TEXT,
    recipient_organization TEXT,
    contact_person TEXT,
    designation TEXT,
    contact_no TEXT,
    purok TEXT,
    barangay TEXT,
    district TEXT,
    latitude REAL,
    longitude REAL,
    latitude_raw TEXT,
    longitude_raw TEXT,
    condition_status TEXT,
    date_received TEXT,
    monitoring_frequency_months INTEGER DEFAULT 12,
    last_monitoring_date TEXT,
    next_monitoring_date TEXT,
    priority_override TEXT,
    assigned_user_id INTEGER,
    linked_project_id INTEGER,
    lifecycle_status TEXT DEFAULT 'Active',
    notes TEXT,
    baseline_remarks TEXT,
    baseline_actions_recommendations TEXT,
    baseline_preceding_reports TEXT,
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assigned_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY(linked_project_id) REFERENCES Projects(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS MonitoringVisits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    monitoring_date TEXT NOT NULL,
    monitoring_type TEXT DEFAULT 'Regular Monitoring',
    condition_status TEXT,
    utilization_status TEXT,
    inspection_data TEXT,
    findings TEXT,
    actions_recommendations TEXT,
    preceding_reports TEXT,
    latitude REAL,
    longitude REAL,
    next_monitoring_date TEXT,
    inspector_user_id INTEGER,
    inspector_username TEXT,
    finalized INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inventory_id) REFERENCES MonitoringInventory(id) ON DELETE CASCADE,
    FOREIGN KEY(inspector_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS MonitoringTasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    visit_id INTEGER,
    title TEXT NOT NULL,
    details TEXT,
    category TEXT DEFAULT 'Follow-up',
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Open',
    assigned_user_id INTEGER,
    due_date TEXT,
    completed_at TEXT,
    created_by_user_id INTEGER,
    created_by_username TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inventory_id) REFERENCES MonitoringInventory(id) ON DELETE CASCADE,
    FOREIGN KEY(visit_id) REFERENCES MonitoringVisits(id) ON DELETE SET NULL,
    FOREIGN KEY(assigned_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS MonitoringVisitAttachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    inventory_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_ext TEXT,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    uploaded_by_user_id INTEGER,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(visit_id) REFERENCES MonitoringVisits(id) ON DELETE CASCADE,
    FOREIGN KEY(inventory_id) REFERENCES MonitoringInventory(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_type ON MonitoringInventory(asset_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_status ON MonitoringInventory(condition_status, lifecycle_status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_location ON MonitoringInventory(district, barangay)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_dates ON MonitoringInventory(last_monitoring_date, next_monitoring_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_assignee ON MonitoringInventory(assigned_user_id)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_inventory_source_row ON MonitoringInventory(source_name, source_row_number) WHERE source_name IS NOT NULL AND source_row_number IS NOT NULL`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_visit_attachments_visit ON MonitoringVisitAttachments(visit_id, uploaded_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_visits_inventory_date ON MonitoringVisits(inventory_id, monitoring_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_inventory_status ON MonitoringTasks(inventory_id, status, due_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_assignee ON MonitoringTasks(assigned_user_id, status, due_date)`);
});
