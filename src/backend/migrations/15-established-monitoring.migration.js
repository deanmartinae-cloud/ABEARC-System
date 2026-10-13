const ensureEstablishedMonitoringMigration = async () => {
  await addColumnIfMissing('CalendarEvents', 'related_inventory_id', 'INTEGER');
  await addColumnIfMissing('MapMedia', 'inventory_item_id', 'INTEGER');
  await addColumnIfMissing('MapMedia', 'monitoring_record_id', 'INTEGER');

  const monitoringColumns = {
    source_row_number: 'INTEGER',
    source_name: 'TEXT',
    asset_subtype: 'TEXT',
    asset_description: 'TEXT',
    project_cost: 'REAL',
    date_completed: 'TEXT',
    warranty_expiry: 'TEXT',
    responsible_office: 'TEXT',
    service_area: 'TEXT',
    latitude_raw: 'TEXT',
    longitude_raw: 'TEXT',
    monitoring_frequency_months: 'INTEGER DEFAULT 12',
    last_monitoring_date: 'TEXT',
    next_monitoring_date: 'TEXT',
    priority_override: 'TEXT',
    assigned_user_id: 'INTEGER',
    linked_project_id: 'INTEGER',
    lifecycle_status: "TEXT DEFAULT 'Active'",
    notes: 'TEXT',
    baseline_remarks: 'TEXT',
    baseline_actions_recommendations: 'TEXT',
    baseline_preceding_reports: 'TEXT',
    created_by_user_id: 'INTEGER',
    created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
  };

  for (const [column, definition] of Object.entries(monitoringColumns)) {
    await addColumnIfMissing('MonitoringInventory', column, definition);
  }

  await addColumnIfMissing('MonitoringVisits', 'inspection_data', 'TEXT');

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_calendar_events_related_inventory ON CalendarEvents(related_inventory_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_mapmedia_monitoring_inventory ON MapMedia(inventory_item_id, monitoring_record_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_mapmedia_monitoring_record ON MapMedia(monitoring_record_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_type ON MonitoringInventory(asset_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_status ON MonitoringInventory(condition_status, lifecycle_status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_location ON MonitoringInventory(district, barangay)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_dates ON MonitoringInventory(last_monitoring_date, next_monitoring_date)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_monitoring_inventory_assignee ON MonitoringInventory(assigned_user_id)`);
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_inventory_source_row ON MonitoringInventory(source_name, source_row_number) WHERE source_name IS NOT NULL AND source_row_number IS NOT NULL`);

  const monitoringPrivileges = [
    'view_monitoring_inventory',
    'add_monitoring_inventory',
    'edit_monitoring_inventory',
    'conduct_monitoring_visit',
    'schedule_monitoring_visit',
    'manage_monitoring_tasks',
    'import_monitoring_inventory',
    'export_monitoring_reports'
  ];
  const userPrivileges = new Set([
    'view_monitoring_inventory',
    'add_monitoring_inventory',
    'conduct_monitoring_visit',
    'schedule_monitoring_visit'
  ]);
  const users = await dbAll(`SELECT id, role FROM Users`);
  for (const user of users) {
    const defaults = user.role === 'superadmin' || user.role === 'admin'
      ? monitoringPrivileges
      : user.role === 'user'
        ? monitoringPrivileges.filter(privilege => userPrivileges.has(privilege))
        : [];
    for (const privilege of defaults) {
      await dbRun(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled) VALUES (?, ?, 1)`, [user.id, privilege]);
    }
  }

  const result = await seedInitialMonitoringInventory();
  if (result?.skipped_existing) {
    console.log('Established monitoring inventory already contains data; packaged AFME seed was not reapplied.');
  }

  const projectRows = await dbAll(`SELECT id FROM Projects WHERE stage IN ('Monitoring', 'Completed')`);
  for (const project of projectRows) {
    await syncProjectToMonitoringInventory(project.id, null);
  }
};
