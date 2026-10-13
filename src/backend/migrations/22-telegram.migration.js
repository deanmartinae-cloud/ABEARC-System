const ensureTelegramMigration = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramTargets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL UNIQUE,
    chat_type TEXT NOT NULL DEFAULT 'group',
    title TEXT NOT NULL DEFAULT '',
    username TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    registered_by_telegram_user_id TEXT,
    approved_by_user_id INTEGER,
    approved_at TEXT,
    last_seen_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(approved_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_targets_active ON TelegramTargets(active, chat_type, title)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramRegistrationCodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_chat_id TEXT,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_registration_expiry ON TelegramRegistrationCodes(expires_at, used_at)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramWeatherRoutes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    send_resolved INTEGER NOT NULL DEFAULT 1,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(target_id) REFERENCES TelegramTargets(id) ON DELETE CASCADE,
    FOREIGN KEY(rule_id) REFERENCES WeatherAlertRules(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    UNIQUE(target_id, rule_id)
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_weather_routes_rule ON TelegramWeatherRoutes(rule_id, enabled)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramWeatherRouteState (
    route_id INTEGER NOT NULL,
    alert_event_id INTEGER NOT NULL,
    last_status TEXT NOT NULL DEFAULT '',
    transition_seq INTEGER NOT NULL DEFAULT 0,
    last_event_updated_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(route_id, alert_event_id),
    FOREIGN KEY(route_id) REFERENCES TelegramWeatherRoutes(id) ON DELETE CASCADE,
    FOREIGN KEY(alert_event_id) REFERENCES WeatherAlertEvents(id) ON DELETE CASCADE
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramReportSchedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    station_id INTEGER NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    send_hour INTEGER NOT NULL DEFAULT 7,
    send_minute INTEGER NOT NULL DEFAULT 0,
    day_of_week INTEGER,
    day_of_month INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_key TEXT,
    last_run_at TEXT,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(target_id) REFERENCES TelegramTargets(id) ON DELETE CASCADE,
    FOREIGN KEY(station_id) REFERENCES WeatherStations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id) ON DELETE SET NULL
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_report_schedules_due ON TelegramReportSchedules(enabled, frequency, station_id)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramDeliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    source_key TEXT NOT NULL,
    message_text TEXT NOT NULL,
    parse_mode TEXT NOT NULL DEFAULT 'HTML',
    status TEXT NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    last_error TEXT,
    telegram_message_id TEXT,
    telegram_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(target_id) REFERENCES TelegramTargets(id) ON DELETE CASCADE,
    UNIQUE(target_id, kind, source_key)
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_deliveries_queue ON TelegramDeliveries(status, next_attempt_at, created_at)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_telegram_deliveries_target ON TelegramDeliveries(target_id, created_at)`);

  await dbRun(`CREATE TABLE IF NOT EXISTS TelegramSystemState (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await dbRun(`INSERT OR IGNORE INTO TelegramSystemState(setting_key, setting_value) VALUES
    ('update_offset', '0'),
    ('last_poll_at', ''),
    ('last_poll_error', ''),
    ('bot_username', ''),
    ('bot_id', ''),
    ('last_delivery_at', '')`);
};
