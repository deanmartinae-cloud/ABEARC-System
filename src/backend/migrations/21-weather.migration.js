const ensureWeatherMigration = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherStations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL DEFAULT 'zentra',
    provider_device_id TEXT NOT NULL,
    source_name TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    organization_id TEXT,
    organization_name TEXT,
    device_type TEXT,
    model TEXT,
    can_read_data INTEGER NOT NULL DEFAULT 1,
    latitude REAL,
    longitude REAL,
    elevation REAL,
    elevation_unit TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
    location_path TEXT,
    logging_interval_minutes REAL,
    upload_frequency_minutes REAL,
    firmware_version TEXT,
    hardware_revision TEXT,
    connectivity_type TEXT,
    subscription_status TEXT,
    visible INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    default_graphs_json TEXT NOT NULL DEFAULT '[]',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    ports_json TEXT NOT NULL DEFAULT '[]',
    sensor_errors_json TEXT NOT NULL DEFAULT '[]',
    connectivity_json TEXT NOT NULL DEFAULT '{}',
    subscription_json TEXT NOT NULL DEFAULT '{}',
    data_first_timestamp INTEGER,
    data_last_timestamp INTEGER,
    last_measurement_ts INTEGER,
    last_successful_sync_at TEXT,
    last_sync_attempt_at TEXT,
    last_sync_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_device_id)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherSeries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    series_key TEXT NOT NULL,
    port_num TEXT,
    measurement TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    unit TEXT,
    sensor_name TEXT,
    position TEXT,
    aggregation_method TEXT NOT NULL DEFAULT 'avg',
    category TEXT NOT NULL DEFAULT 'other',
    enabled INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    UNIQUE(station_id, series_key)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherReadings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    source_key TEXT NOT NULL,
    reading_id INTEGER,
    timestamp_utc INTEGER NOT NULL,
    datetime_source TEXT,
    port_num TEXT,
    measurement TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    unit TEXT,
    sensor_name TEXT,
    position TEXT,
    value REAL,
    error_code INTEGER,
    error_message TEXT,
    statistic TEXT,
    quality_status TEXT NOT NULL DEFAULT 'valid',
    inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    FOREIGN KEY(series_id) REFERENCES WeatherSeries(id) ON DELETE CASCADE,
    UNIQUE(station_id, source_key)
  )`);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_readings_station_ts ON WeatherReadings(station_id, timestamp_utc)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_readings_series_ts ON WeatherReadings(station_id, series_id, timestamp_utc)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_readings_reading_id ON WeatherReadings(station_id, reading_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_readings_key_ts ON WeatherReadings(station_id, normalized_key, timestamp_utc)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherSyncState (
    station_id INTEGER PRIMARY KEY,
    cursor_reading_id INTEGER NOT NULL DEFAULT 0,
    initial_backfill_complete INTEGER NOT NULL DEFAULT 0,
    latest_source_reading_id INTEGER,
    last_success_at TEXT,
    last_attempt_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_allowed_at TEXT,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherBackfillJobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    from_ts INTEGER NOT NULL,
    to_ts INTEGER NOT NULL,
    next_token TEXT,
    next_url TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    created_by_user_id INTEGER,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);
  const weatherBackfillColumns = new Set((await dbAll(`PRAGMA table_info(WeatherBackfillJobs)`)).map(row => String(row.name || '')));
  if (!weatherBackfillColumns.has('next_url')) await dbRun(`ALTER TABLE WeatherBackfillJobs ADD COLUMN next_url TEXT`);
  if (!weatherBackfillColumns.has('retry_count')) await dbRun(`ALTER TABLE WeatherBackfillJobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`);
  if (!weatherBackfillColumns.has('next_attempt_at')) await dbRun(`ALTER TABLE WeatherBackfillJobs ADD COLUMN next_attempt_at TEXT`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_backfill_status ON WeatherBackfillJobs(status, next_attempt_at, created_at)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherSyncRuns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_from_ts INTEGER,
    requested_to_ts INTEGER,
    cursor_before INTEGER,
    cursor_after INTEGER,
    rows_received INTEGER NOT NULL DEFAULT 0,
    rows_inserted INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE SET NULL
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_sync_runs_station ON WeatherSyncRuns(station_id, started_at)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherAlertRules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL,
    measurement_key TEXT,
    comparator TEXT,
    threshold REAL,
    secondary_threshold REAL,
    duration_minutes INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    notification_enabled INTEGER NOT NULL DEFAULT 1,
    label TEXT NOT NULL DEFAULT '',
    created_by_user_id INTEGER,
    updated_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY(updated_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherAlertEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    station_id INTEGER NOT NULL,
    event_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    value REAL,
    message TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    resolved_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(rule_id) REFERENCES WeatherAlertRules(id) ON DELETE CASCADE,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    UNIQUE(rule_id, event_key)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherSystemSettings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`UPDATE WeatherSeries SET normalized_key='lightning_count',category='storm',aggregation_method='sum' WHERE normalized_key='other_lightning_activity' AND lower(measurement)='lightning activity'`);
  await dbRun(`UPDATE WeatherReadings SET normalized_key='lightning_count' WHERE normalized_key='other_lightning_activity' AND series_id IN (SELECT id FROM WeatherSeries WHERE normalized_key='lightning_count')`);
  // Repair earlier classification: a precipitation rate is not accumulated rain.
  await dbRun(`UPDATE WeatherSeries SET normalized_key='sensor_temperature',category='health' WHERE normalized_key='relative_humidity' AND lower(measurement) LIKE '%rh sensor temp%'`);
  await dbRun(`UPDATE WeatherReadings SET normalized_key='sensor_temperature' WHERE normalized_key='relative_humidity' AND series_id IN (SELECT id FROM WeatherSeries WHERE normalized_key='sensor_temperature')`);
  await dbRun(`UPDATE WeatherSeries SET normalized_key='rain_rate',aggregation_method='avg_max' WHERE normalized_key='precipitation' AND (unit IN ('mm/hr','mm/h') OR lower(measurement) LIKE '%precip%rate%')`);
  await dbRun(`UPDATE WeatherReadings SET normalized_key='rain_rate' WHERE normalized_key='precipitation' AND series_id IN (SELECT id FROM WeatherSeries WHERE normalized_key='rain_rate')`);
  await dbRun(`CREATE TABLE IF NOT EXISTS WeatherForecastCache (
    station_id INTEGER PRIMARY KEY REFERENCES WeatherStations(id) ON DELETE CASCADE,
    cache_key TEXT NOT NULL, payload_json TEXT, retry_at TEXT
  )`);
  await dbRun(`INSERT OR IGNORE INTO WeatherSystemSettings(setting_key, setting_value) VALUES ('provider', ?), ('last_discovery_at', '')`, [WEATHER_PROVIDER]);
};
