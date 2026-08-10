// Initialize Schema
db.serialize(() => {
  // ===========================================
  // STEP 1: CREATE ALL TABLES FIRST
  // ===========================================
  
  db.run(`CREATE TABLE IF NOT EXISTS ProjectTypes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, order_index INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS Requestees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, order_index INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS DocumentTypes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, category TEXT DEFAULT 'Proposal', order_index INTEGER DEFAULT 0, due_days INTEGER DEFAULT 0, due_hours INTEGER DEFAULT 0, document_type_start_point INTEGER DEFAULT 0, start_from_document_upload INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user', 'system')),
    theme_preference TEXT DEFAULT 'light' CHECK(theme_preference IN ('light', 'dark', 'system')),
    avatar_path TEXT,
    direct_superior_user_id INTEGER,
    is_system_account INTEGER DEFAULT 0,
    hidden_from_workflows INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // UserPrivileges table for granular permissions
  db.run(`CREATE TABLE IF NOT EXISTS UserPrivileges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    privilege TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES Users(id),
    UNIQUE(user_id, privilege)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS UserSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES Users(id)
  )`);
  
  // ActivityLogs table for audit trail
  db.run(`CREATE TABLE IF NOT EXISTS ActivityLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT,
    project_id INTEGER,
    project_name TEXT,
    requester TEXT,
    document_type TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    FOREIGN KEY(user_id) REFERENCES Users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS RequirementSets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_type_id INTEGER, requestee_id INTEGER, stage TEXT DEFAULT 'Proposal',
    UNIQUE(project_type_id, requestee_id, stage),
    FOREIGN KEY(project_type_id) REFERENCES ProjectTypes(id), FOREIGN KEY(requestee_id) REFERENCES Requestees(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS RequirementSetItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT, requirement_set_id INTEGER, document_type_id INTEGER, order_index INTEGER DEFAULT 0,
    FOREIGN KEY(requirement_set_id) REFERENCES RequirementSets(id), FOREIGN KEY(document_type_id) REFERENCES DocumentTypes(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS RequirementSetDueSchedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_set_id INTEGER NOT NULL,
    document_type_id INTEGER NOT NULL,
    due_days INTEGER DEFAULT 0,
    due_hours INTEGER DEFAULT 0,
    document_type_start_point INTEGER DEFAULT 0,
    start_from_document_upload INTEGER DEFAULT 0,
    UNIQUE(requirement_set_id, document_type_id),
    FOREIGN KEY(requirement_set_id) REFERENCES RequirementSets(id),
    FOREIGN KEY(document_type_id) REFERENCES DocumentTypes(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS SystemSettings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, requester TEXT,
    project_type_id INTEGER, requestee_id INTEGER, requirement_set_id INTEGER,
    district TEXT, barangay TEXT, status TEXT DEFAULT 'Active',
    stage TEXT DEFAULT 'Proposal',
    outcome TEXT DEFAULT 'Active',
    closure_reason TEXT,
    closure_remarks TEXT,
    closed_at TEXT,
    closed_by_user_id INTEGER,
    closed_by_username TEXT,
    previous_stage_before_closure TEXT,
    reopened_at TEXT,
    reopened_by_user_id INTEGER,
    reopened_by_username TEXT,
    assigned_user_id INTEGER,
    manual_due_date DATETIME,
    due_date_override INTEGER DEFAULT 0,
    remarks TEXT,
    proposal_remarks TEXT,
    implementation_remarks TEXT,
    monitoring_remarks TEXT,
    completion_remarks TEXT,
    created_at DATETIME, updated_at DATETIME, last_activity_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, document_type_id INTEGER, document_type_name TEXT,
    file_path TEXT, file_name TEXT, status TEXT DEFAULT 'None', upload_date DATETIME, checked_at DATETIME, requirement_state TEXT DEFAULT 'Required',
    stage TEXT DEFAULT 'Proposal',
    due_date DATETIME,
    manual_due_date DATETIME,
    uploader_user_id INTEGER,
    assigned_user_id INTEGER,
    checked_by_user_id INTEGER,
    checked_by_username TEXT,
    document_order_index INTEGER DEFAULT 0,
    due_date_override INTEGER DEFAULT 0,
    FOREIGN KEY(project_id) REFERENCES Projects(id), FOREIGN KEY(document_type_id) REFERENCES DocumentTypes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS DocumentOwnershipHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    previous_owner_id INTEGER,
    previous_owner_username TEXT,
    new_owner_id INTEGER,
    new_owner_username TEXT,
    actor_user_id INTEGER,
    actor_username TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(document_id) REFERENCES Documents(id),
    FOREIGN KEY(project_id) REFERENCES Projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectOwnershipHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    previous_owner_id INTEGER,
    previous_owner_username TEXT,
    new_owner_id INTEGER,
    new_owner_username TEXT,
    actor_user_id INTEGER,
    actor_username TEXT,
    action TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES Projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_user_id INTEGER NOT NULL,
    actor_user_id INTEGER,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    project_id INTEGER,
    project_name TEXT,
    document_id INTEGER,
    document_name TEXT,
    stage TEXT,
    target_kind TEXT DEFAULT 'project',
    target_meta TEXT,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    alert_key TEXT,
    alert_date TEXT,
    updated_at DATETIME,
    FOREIGN KEY(recipient_user_id) REFERENCES Users(id),
    FOREIGN KEY(actor_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ConfigurationChangeRequests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_user_id INTEGER NOT NULL,
    requester_username TEXT NOT NULL,
    direct_superior_user_id INTEGER NOT NULL,
    direct_superior_username TEXT,
    config_area TEXT,
    config_table TEXT,
    config_section TEXT NOT NULL,
    config_key TEXT,
    target_id INTEGER,
    target_display_name TEXT,
    action_type TEXT NOT NULL,
    current_value_json TEXT,
    requested_change_json TEXT,
    current_now_json TEXT,
    current_snapshot_hash TEXT,
    requested_snapshot_hash TEXT,
    human_summary TEXT,
    old_value_json TEXT,
    new_value_json TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','conflict','already_changed')),
    approver_user_id INTEGER,
    approver_username TEXT,
    approver_remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME,
    applied_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    conflict_reason TEXT,
    FOREIGN KEY(requester_user_id) REFERENCES Users(id),
    FOREIGN KEY(direct_superior_user_id) REFERENCES Users(id),
    FOREIGN KEY(approver_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS DeletionRequests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    project_id INTEGER,
    document_id INTEGER,
    requested_by_user_id INTEGER NOT NULL,
    requested_by_username TEXT,
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    responded_by_user_id INTEGER,
    response_note TEXT,
    target_snapshot TEXT,
    FOREIGN KEY(requested_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(owner_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectTransitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    transitioned_by_user_id INTEGER,
    transitioned_by_username TEXT,
    source_stage TEXT,
    target_stage TEXT,
    remarks TEXT,
    transitioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(transitioned_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectDispositionHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    previous_outcome TEXT,
    new_outcome TEXT NOT NULL,
    previous_stage TEXT,
    reason TEXT,
    remarks TEXT,
    attachment_path TEXT,
    attachment_file_name TEXT,
    changed_by_user_id INTEGER,
    changed_by_username TEXT,
    changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(changed_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectDispositionRequests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    requested_outcome TEXT NOT NULL,
    previous_outcome TEXT,
    previous_stage TEXT,
    reason TEXT,
    remarks TEXT,
    decision_date TEXT,
    attachment_path TEXT,
    attachment_file_name TEXT,
    requested_by_user_id INTEGER,
    requested_by_username TEXT,
    requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
    reviewed_by_user_id INTEGER,
    reviewed_by_username TEXT,
    reviewed_at TEXT,
    review_remarks TEXT,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(requested_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(reviewed_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectClosureRequests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    source_stage TEXT,
    stage_remarks TEXT NOT NULL,
    completion_remarks TEXT NOT NULL,
    attachment_path TEXT,
    attachment_file_name TEXT,
    requested_by_user_id INTEGER,
    requested_by_username TEXT,
    requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
    reviewed_by_user_id INTEGER,
    reviewed_by_username TEXT,
    reviewed_at TEXT,
    review_remarks TEXT,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(requested_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(reviewed_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectStageEditAccess (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    stage TEXT NOT NULL,
    granted_to_user_id INTEGER NULL,
    granted_to_username TEXT NULL,
    allow_upload INTEGER DEFAULT 0,
    allow_delete_file INTEGER DEFAULT 0,
    allow_status_change INTEGER DEFAULT 0,
    allow_requirement_state_change INTEGER DEFAULT 0,
    allow_due_date_change INTEGER DEFAULT 0,
    allow_assignment_change INTEGER DEFAULT 0,
    reason TEXT NOT NULL,
    expires_at TEXT NULL,
    revoked_at TEXT NULL,
    revoked_by_user_id INTEGER NULL,
    revoked_by_username TEXT NULL,
    revoke_reason TEXT NULL,
    created_by_user_id INTEGER NOT NULL,
    created_by_username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NULL,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(granted_to_user_id) REFERENCES Users(id),
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS DocumentSearchIndex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL UNIQUE,
    content_text TEXT,
    index_status TEXT DEFAULT 'metadata_only',
    error_message TEXT,
    indexed_at DATETIME,
    FOREIGN KEY(document_id) REFERENCES Documents(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT,
    all_day INTEGER DEFAULT 0,
    event_type TEXT DEFAULT 'general',
    event_type_detail TEXT,
    visibility TEXT DEFAULT 'personal',
    owner_user_id INTEGER,
    related_project_id INTEGER,
    related_document_id INTEGER,
    color TEXT,
    reminder_minutes TEXT,
    recurrence_rule TEXT,
    status TEXT DEFAULT 'active',
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY(owner_user_id) REFERENCES Users(id),
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(related_project_id) REFERENCES Projects(id),
    FOREIGN KEY(related_document_id) REFERENCES Documents(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEventParticipants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'participant',
    response_status TEXT DEFAULT 'pending',
    notified_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES CalendarEvents(id),
    FOREIGN KEY(user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEventReminderLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reminder_key TEXT NOT NULL,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id, reminder_key),
    FOREIGN KEY(event_id) REFERENCES CalendarEvents(id),
    FOREIGN KEY(user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEventAuditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES CalendarEvents(id),
    FOREIGN KEY(actor_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEventNotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    note_type TEXT DEFAULT 'general_notes',
    title TEXT,
    content TEXT,
    created_by_user_id INTEGER,
    updated_by_user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    is_final INTEGER DEFAULT 0,
    finalized_by_user_id INTEGER,
    finalized_at TEXT,
    FOREIGN KEY(event_id) REFERENCES CalendarEvents(id),
    FOREIGN KEY(created_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(updated_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(finalized_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS CalendarEventAttachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    uploaded_by_user_id INTEGER,
    file_name TEXT NOT NULL,
    original_name TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_ext TEXT,
    file_size INTEGER,
    attachment_type TEXT DEFAULT 'supporting_file',
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id INTEGER,
    updated_at TEXT,
    FOREIGN KEY(event_id) REFERENCES CalendarEvents(id),
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS DownloadsForms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    version TEXT,
    category TEXT,
    description TEXT,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    uploaded_by_user_id INTEGER,
    uploaded_by_username TEXT,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Archived')),
    download_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ProjectDocumentationFiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    uploaded_by_user_id INTEGER,
    uploaded_by_username TEXT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_ext TEXT,
    file_type TEXT,
    file_size INTEGER,
    media_type TEXT CHECK(media_type IN ('photo','video')),
    stage TEXT NOT NULL,
    category TEXT,
    caption TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY(project_id) REFERENCES Projects(id),
    FOREIGN KEY(uploaded_by_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserDriveFolders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    parent_folder_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY(owner_user_id) REFERENCES Users(id),
    FOREIGN KEY(parent_folder_id) REFERENCES UserDriveFolders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserDriveFiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT,
    parent_folder_id INTEGER,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_ext TEXT,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    title TEXT,
    description TEXT,
    tags TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','deleted')),
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY(owner_user_id) REFERENCES Users(id),
    FOREIGN KEY(parent_folder_id) REFERENCES UserDriveFolders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserDriveShares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    shared_by_user_id INTEGER NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    permission TEXT DEFAULT 'view' CHECK(permission IN ('view','download')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    UNIQUE(file_id, shared_with_user_id, revoked_at),
    FOREIGN KEY(file_id) REFERENCES UserDriveFiles(id),
    FOREIGN KEY(shared_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(shared_with_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserDriveFolderShares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL,
    shared_by_user_id INTEGER NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    permission TEXT DEFAULT 'view' CHECK(permission IN ('view','download')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    UNIQUE(folder_id, shared_with_user_id, revoked_at),
    FOREIGN KEY(folder_id) REFERENCES UserDriveFolders(id),
    FOREIGN KEY(shared_by_user_id) REFERENCES Users(id),
    FOREIGN KEY(shared_with_user_id) REFERENCES Users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserFeedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('bug', 'change_request', 'improvement')),
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    submitted_by_user_id INTEGER NOT NULL,
    submitted_by_username TEXT NOT NULL,
    attachment_path TEXT,
    attachment_file_name TEXT,
    status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'reviewing', 'planned', 'completed', 'closed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(submitted_by_user_id) REFERENCES Users(id)
  )`);

  // ===========================================
  // STEP 2: ADD MISSING COLUMNS (MIGRATIONS)
  // ===========================================
  
  // Add theme_preference column to existing Users table if not exists
  columnExists('Users', 'theme_preference', (err, exists) => { 
    if (!exists) db.run("ALTER TABLE Users ADD COLUMN theme_preference TEXT DEFAULT 'light'", (e)=>{}); 
  });
  columnExists('Users', 'avatar_path', (err, exists) => {
    if (!exists) db.run("ALTER TABLE Users ADD COLUMN avatar_path TEXT", (e)=>{});
  });
  columnExists('UserFeedback', 'attachment_path', (err, exists) => {
    if (!exists) db.run("ALTER TABLE UserFeedback ADD COLUMN attachment_path TEXT", (e)=>{});
  });
  columnExists('UserFeedback', 'attachment_file_name', (err, exists) => {
    if (!exists) db.run("ALTER TABLE UserFeedback ADD COLUMN attachment_file_name TEXT", (e)=>{});
  });
  columnExists('Users', 'direct_superior_user_id', (err, exists) => {
    if (!exists) db.run("ALTER TABLE Users ADD COLUMN direct_superior_user_id INTEGER", (e)=>{});
  });
  [
    ['requester_username', 'TEXT'],
    ['direct_superior_username', 'TEXT'],
    ['config_area', 'TEXT'],
    ['config_table', 'TEXT'],
    ['config_key', 'TEXT'],
    ['target_id', 'INTEGER'],
    ['target_display_name', 'TEXT'],
    ['current_value_json', 'TEXT'],
    ['requested_change_json', 'TEXT'],
    ['current_now_json', 'TEXT'],
    ['current_snapshot_hash', 'TEXT'],
    ['requested_snapshot_hash', 'TEXT'],
    ['human_summary', 'TEXT'],
    ['approver_username', 'TEXT'],
    ['updated_at', 'DATETIME'],
    ['conflict_reason', 'TEXT']
  ].forEach(([column, type]) => {
    columnExists('ConfigurationChangeRequests', column, (err, exists) => {
      if (!exists) db.run(`ALTER TABLE ConfigurationChangeRequests ADD COLUMN ${column} ${type}`, (e)=>{});
    });
  });
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='configuration_change_requests'", [], (legacyErr, legacyTable) => {
    if (!legacyTable) return;
    db.run(`
      INSERT OR IGNORE INTO ConfigurationChangeRequests (
        id, requester_user_id, requester_username, direct_superior_user_id, direct_superior_username,
        config_area, config_table, config_section, config_key, action_type,
        current_value_json, requested_change_json, old_value_json, new_value_json, status,
        approver_user_id, approver_username, approver_remarks, created_at, decided_at, applied_at, conflict_reason
      )
      SELECT
        ccr.id, ccr.requester_user_id, COALESCE(ru.username, ''), ccr.direct_superior_user_id, ds.username,
        ccr.config_section, ccr.config_section, ccr.config_section, ccr.config_key, ccr.action_type,
        ccr.old_value_json, ccr.new_value_json, ccr.old_value_json, ccr.new_value_json, ccr.status,
        ccr.approver_user_id, au.username, ccr.approver_remarks, ccr.created_at, ccr.decided_at, ccr.applied_at, ccr.conflict_reason
      FROM configuration_change_requests ccr
      LEFT JOIN Users ru ON ru.id = ccr.requester_user_id
      LEFT JOIN Users ds ON ds.id = ccr.direct_superior_user_id
      LEFT JOIN Users au ON au.id = ccr.approver_user_id
    `, (e)=>{});
  });
  // System role columns are migrated safely in ensureUsersSystemRoleMigration() before app.listen().
  // Do not reference is_system_account or hidden_from_workflows in this asynchronous schema block because
  // older databases may not have those columns yet.
  
  // SAFE MIGRATIONS
  columnExists('RequirementSets', 'stage', (err, exists) => { if (!exists) db.run("ALTER TABLE RequirementSets ADD COLUMN stage TEXT DEFAULT 'Proposal'", (e)=>{}); });
  columnExists('Projects', 'stage', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN stage TEXT DEFAULT 'Proposal'", (e)=>{}); });
  columnExists('Projects', 'outcome', (err, exists) => {
    if (!exists) {
      db.run("ALTER TABLE Projects ADD COLUMN outcome TEXT DEFAULT 'Active'", () => {
        db.run("UPDATE Projects SET outcome = CASE WHEN stage = 'Completed' THEN 'Completed' ELSE 'Active' END WHERE outcome IS NULL OR TRIM(outcome) = ''");
      });
    } else {
      db.run("UPDATE Projects SET outcome = CASE WHEN stage = 'Completed' THEN 'Completed' ELSE 'Active' END WHERE outcome IS NULL OR TRIM(outcome) = ''");
    }
  });
  columnExists('Projects', 'closure_reason', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN closure_reason TEXT", (e)=>{}); });
  columnExists('Projects', 'closure_remarks', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN closure_remarks TEXT", (e)=>{}); });
  columnExists('Projects', 'closed_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN closed_at TEXT", (e)=>{}); });
  columnExists('Projects', 'closed_by_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN closed_by_user_id INTEGER", (e)=>{}); });
  columnExists('Projects', 'closed_by_username', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN closed_by_username TEXT", (e)=>{}); });
  columnExists('Projects', 'previous_stage_before_closure', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN previous_stage_before_closure TEXT", (e)=>{}); });
  columnExists('Projects', 'reopened_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN reopened_at TEXT", (e)=>{}); });
  columnExists('Projects', 'reopened_by_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN reopened_by_user_id INTEGER", (e)=>{}); });
  columnExists('Projects', 'reopened_by_username', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN reopened_by_username TEXT", (e)=>{}); });
  columnExists('Projects', 'project_type_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN project_type_id INTEGER", (e)=>{}); });
  columnExists('Projects', 'requestee_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN requestee_id INTEGER", (e)=>{}); });
  columnExists('Projects', 'updated_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN updated_at DATETIME", (e)=>{}); });
  columnExists('Projects', 'last_activity_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN last_activity_at DATETIME", (e)=>{}); });
  columnExists('Projects', 'assigned_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN assigned_user_id INTEGER", (e)=>{}); });
  columnExists('Projects', 'manual_due_date', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN manual_due_date DATETIME", (e)=>{}); });
  columnExists('Projects', 'due_date_override', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN due_date_override INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('Documents', 'stage', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN stage TEXT DEFAULT 'Proposal'", (e)=>{}); });
  columnExists('Documents', 'document_type_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN document_type_id INTEGER", (e)=>{}); });
  columnExists('Documents', 'document_type_name', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN document_type_name TEXT", (e)=>{}); });
  columnExists('Documents', 'checked_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN checked_at DATETIME", (e)=>{}); });
  columnExists('Documents', 'checked_by_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN checked_by_user_id INTEGER", (e)=>{}); });
  columnExists('Documents', 'checked_by_username', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN checked_by_username TEXT", (e)=>{}); });
  columnExists('Documents', 'requirement_state', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN requirement_state TEXT DEFAULT 'Required'", (e)=>{}); });
  columnExists('Documents', 'uploader_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN uploader_user_id INTEGER", (e)=>{}); });
  columnExists('Documents', 'assigned_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE Documents ADD COLUMN assigned_user_id INTEGER", (e)=>{}); });
  columnExists('Notifications', 'updated_at', (err, exists) => { if (!exists) db.run("ALTER TABLE Notifications ADD COLUMN updated_at DATETIME", (e)=>{}); });
  columnExists('CalendarEventNotes', 'is_final', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventNotes ADD COLUMN is_final INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('CalendarEventNotes', 'finalized_by_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventNotes ADD COLUMN finalized_by_user_id INTEGER", (e)=>{}); });
  columnExists('CalendarEventNotes', 'finalized_at', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventNotes ADD COLUMN finalized_at TEXT", (e)=>{}); });
  columnExists('CalendarEventAttachments', 'file_ext', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventAttachments ADD COLUMN file_ext TEXT", (e)=>{}); });
  columnExists('CalendarEventAttachments', 'updated_by_user_id', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventAttachments ADD COLUMN updated_by_user_id INTEGER", (e)=>{}); });
  columnExists('CalendarEventAttachments', 'updated_at', (err, exists) => { if (!exists) db.run("ALTER TABLE CalendarEventAttachments ADD COLUMN updated_at TEXT", (e)=>{}); });
  columnExists('DocumentOwnershipHistory', 'details', (err, exists) => { if (!exists) db.run("ALTER TABLE DocumentOwnershipHistory ADD COLUMN details TEXT", (e)=>{}); });
  columnExists('Projects', 'remarks', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN remarks TEXT", (e)=>{}); });
  columnExists('Projects', 'proposal_remarks', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN proposal_remarks TEXT", (e)=>{}); });
  columnExists('Projects', 'implementation_remarks', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN implementation_remarks TEXT", (e)=>{}); });
  columnExists('Projects', 'monitoring_remarks', (err, exists) => { if (!exists) db.run("ALTER TABLE Projects ADD COLUMN monitoring_remarks TEXT", (e)=>{}); });
  columnExists('Projects', 'completion_remarks', (err, exists) => {
    const backfillCompletionRemarks = () => db.run("UPDATE Projects SET completion_remarks = remarks WHERE (completion_remarks IS NULL OR TRIM(completion_remarks) = '') AND remarks IS NOT NULL AND TRIM(remarks) != ''", (e)=>{});
    if (!exists) {
      db.run("ALTER TABLE Projects ADD COLUMN completion_remarks TEXT", (e)=>{ if (!e) backfillCompletionRemarks(); });
    } else {
      backfillCompletionRemarks();
    }
  });
  const safeAddProjectDispositionColumn = (definition, afterAdd = null) => {
    db.run(`ALTER TABLE Projects ADD COLUMN ${definition}`, (e) => {
      if (afterAdd && (!e || String(e.message || '').includes('duplicate column name'))) afterAdd();
    });
  };
  safeAddProjectDispositionColumn("outcome TEXT DEFAULT 'Active'", () => {
    db.run("UPDATE Projects SET outcome = CASE WHEN stage = 'Completed' THEN 'Completed' ELSE 'Active' END WHERE outcome IS NULL OR TRIM(outcome) = ''");
  });
  safeAddProjectDispositionColumn("closure_reason TEXT");
  safeAddProjectDispositionColumn("closure_remarks TEXT");
  safeAddProjectDispositionColumn("closed_at TEXT");
  safeAddProjectDispositionColumn("closed_by_user_id INTEGER");
  safeAddProjectDispositionColumn("closed_by_username TEXT");
  safeAddProjectDispositionColumn("previous_stage_before_closure TEXT");
  safeAddProjectDispositionColumn("reopened_at TEXT");
  safeAddProjectDispositionColumn("reopened_by_user_id INTEGER");
  safeAddProjectDispositionColumn("reopened_by_username TEXT");
  columnExists('ProjectTypes', 'order_index', (err, exists) => { if (!exists) db.run("ALTER TABLE ProjectTypes ADD COLUMN order_index INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('Requestees', 'order_index', (err, exists) => { if (!exists) db.run("ALTER TABLE Requestees ADD COLUMN order_index INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('DocumentTypes', 'order_index', (err, exists) => { if (!exists) db.run("ALTER TABLE DocumentTypes ADD COLUMN order_index INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('Documents', 'document_order_index', (err, exists) => {
    if (!exists) db.run("ALTER TABLE Documents ADD COLUMN document_order_index INTEGER DEFAULT 0", () => {
      db.run("UPDATE Documents SET document_order_index = id WHERE document_order_index IS NULL OR document_order_index = 0");
    });
  });
  columnExists('DocumentTypes', 'due_days', (err, exists) => { if (!exists) db.run("ALTER TABLE DocumentTypes ADD COLUMN due_days INTEGER DEFAULT 0", (e)=>{}); });
  columnExists('DocumentTypes', 'category', (err, exists) => {
    if (!exists) {
      db.run("ALTER TABLE DocumentTypes ADD COLUMN category TEXT DEFAULT 'Proposal'", () => {
        db.run(`
          UPDATE DocumentTypes
          SET category = 'Implementation'
          WHERE id IN (
            SELECT DISTINCT rsi.document_type_id
            FROM RequirementSetItems rsi
            JOIN RequirementSets rs ON rs.id = rsi.requirement_set_id
            WHERE rs.stage = 'Implementation'
          )
        `);
      });
    }
  });
  // Add column for document_type_start_point if not exists
  columnExists('DocumentTypes', 'document_type_start_point', (err, exists) => { 
    if (!exists) db.run("ALTER TABLE DocumentTypes ADD COLUMN document_type_start_point INTEGER DEFAULT 0", (e)=>{}); 
  });
  
  // Add column for start_from_document_upload flag
  columnExists('DocumentTypes', 'start_from_document_upload', (err, exists) => { 
    if (!exists) db.run("ALTER TABLE DocumentTypes ADD COLUMN start_from_document_upload INTEGER DEFAULT 0", (e)=>{}); 
  });
  
  // Add columns for manual due date override support in Documents table
  // Note: These columns are now in the base schema, but keeping migration for existing DBs
  // No need to add via ALTER TABLE since they're in CREATE TABLE now

  // Remove UNIQUE constraint from Projects.name safely
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='Projects'", (err, row) => {
    if (row && row.sql.includes('name TEXT UNIQUE')) {
       db.serialize(() => {
         db.run("BEGIN TRANSACTION");
         db.run(`CREATE TABLE Projects_new (
           id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, requester TEXT,
           project_type_id INTEGER, requestee_id INTEGER, requirement_set_id INTEGER,
           district TEXT, barangay TEXT, status TEXT DEFAULT 'Active',
           stage TEXT DEFAULT 'Proposal',
           outcome TEXT DEFAULT 'Active',
           closure_reason TEXT,
           closure_remarks TEXT,
           closed_at TEXT,
           closed_by_user_id INTEGER,
           closed_by_username TEXT,
           previous_stage_before_closure TEXT,
           reopened_at TEXT,
           reopened_by_user_id INTEGER,
           reopened_by_username TEXT,
           assigned_user_id INTEGER,
           manual_due_date DATETIME,
           due_date_override INTEGER DEFAULT 0,
           created_at DATETIME, updated_at DATETIME, last_activity_at DATETIME
         )`, () => {
           db.run("INSERT INTO Projects_new (id, name, requester, project_type_id, requestee_id, requirement_set_id, district, barangay, status, stage, outcome, assigned_user_id, created_at, updated_at, last_activity_at) SELECT id, name, requester, project_type_id, requestee_id, requirement_set_id, district, barangay, status, stage, CASE WHEN stage = 'Completed' THEN 'Completed' ELSE 'Active' END, assigned_user_id, created_at, updated_at, last_activity_at FROM Projects", () => {
             db.run("DROP TABLE Projects", () => {
               db.run("ALTER TABLE Projects_new RENAME TO Projects", (e) => {
                 if(e) console.error("Migration error:", e);
                 else db.run("COMMIT");
               });
             });
           });
         });
       });
    }
  });

  // ===========================================
  // STEP 3: SEED DATA
  // ===========================================
  
  const seeds = [
    { tbl: 'ProjectTypes', vals: [['Infrastructure',1],['Irrigation',2],['Machinery & Equipment',3],['Materials',4]] },
    { tbl: 'Requestees', vals: [['Local Government Unit',1],['Department of Agriculture',2],['Private Entity',3]] }
  ];
  seeds.forEach(s => s.vals.forEach(v => db.run(`INSERT OR IGNORE INTO ${s.tbl} (name, order_index) VALUES (?, ?)`, v)));
  db.get("SELECT COUNT(*) as cnt FROM Users", (err, row) => {
    if (err || (row?.cnt || 0) > 0) return;
    const stmt = db.prepare("INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)");
    // Create superadmin account
    stmt.run(['superadmin', hashPassword('superadmin123'), 'superadmin']);
    stmt.run(['admin', hashPassword('admin123'), 'admin']);
    stmt.run(['user', hashPassword('user123'), 'user']);
    stmt.finalize();
  });

  // ===========================================
  // STEP 4: CREATE ALL INDEXES LAST
  // ===========================================
  
  // ActivityLogs indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_activitylogs_created ON ActivityLogs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_activitylogs_username ON ActivityLogs(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_activitylogs_action ON ActivityLogs(action)`);
  
  // Projects indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_stage ON Projects(stage)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_outcome ON Projects(outcome)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_last_activity ON Projects(last_activity_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON Projects(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_assigned_user ON Projects(assigned_user_id)`);
  
  // Documents indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_project_id ON Documents(project_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_stage ON Documents(stage)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_status ON Documents(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_due_date ON Documents(due_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_assigned_user ON Documents(assigned_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON Documents(upload_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_documentation_project_stage ON ProjectDocumentationFiles(project_id, stage, deleted_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_documentation_uploaded_by ON ProjectDocumentationFiles(uploaded_by_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_documentation_uploaded_at ON ProjectDocumentationFiles(uploaded_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON Notifications(recipient_user_id, read_at, created_at)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_daily_alert ON Notifications(recipient_user_id, alert_key, alert_date) WHERE alert_key IS NOT NULL AND alert_date IS NOT NULL`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_alert_key_recent ON Notifications(recipient_user_id, alert_key, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_config_requests_superior_status ON ConfigurationChangeRequests(direct_superior_user_id, status, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_config_requests_requester_status ON ConfigurationChangeRequests(requester_user_id, status, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_config_requests_status_created ON ConfigurationChangeRequests(status, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_config_requests_target_pending ON ConfigurationChangeRequests(requester_user_id, config_table, config_key, target_id, action_type, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deletion_requests_owner_status ON DeletionRequests(owner_user_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deletion_requests_requester_status ON DeletionRequests(requested_by_user_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deletion_requests_target_status ON DeletionRequests(target_type, target_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_disposition_project ON ProjectDispositionHistory(project_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_disposition_outcome ON ProjectDispositionHistory(new_outcome)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_disposition_changed_by ON ProjectDispositionHistory(changed_by_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_disposition_requests_status ON ProjectDispositionRequests(status, requested_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_disposition_requests_project_status ON ProjectDispositionRequests(project_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_closure_requests_status ON ProjectClosureRequests(status, requested_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_closure_requests_project_status ON ProjectClosureRequests(project_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stage_edit_access_project_stage ON ProjectStageEditAccess(project_id, stage)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stage_edit_access_user ON ProjectStageEditAccess(granted_to_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stage_edit_access_expires ON ProjectStageEditAccess(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stage_edit_access_revoked ON ProjectStageEditAccess(revoked_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_feedback_status_created ON UserFeedback(status, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_feedback_submitter ON UserFeedback(submitted_by_user_id, created_at)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_req_due_set_doc ON RequirementSetDueSchedules(requirement_set_id, document_type_id)`);
  db.run(`
    INSERT OR IGNORE INTO RequirementSetDueSchedules (
      requirement_set_id, document_type_id, due_days, due_hours, document_type_start_point, start_from_document_upload
    )
    SELECT
      rsi.requirement_set_id,
      rsi.document_type_id,
      COALESCE(dt.due_days, 0),
      COALESCE(dt.due_hours, 0),
      COALESCE(dt.document_type_start_point, 0),
      COALESCE(dt.start_from_document_upload, 0)
    FROM RequirementSetItems rsi
    JOIN DocumentTypes dt ON dt.id = rsi.document_type_id
    WHERE COALESCE(dt.due_days, 0) > 0
       OR COALESCE(dt.due_hours, 0) > 0
       OR COALESCE(dt.start_from_document_upload, 0) > 0
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_projecttransitions_project ON ProjectTransitions(project_id, transitioned_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documentsearch_document ON DocumentSearchIndex(document_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON CalendarEvents(start_datetime, end_datetime)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_events_visibility ON CalendarEvents(visibility, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON CalendarEvents(owner_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_participants_event ON CalendarEventParticipants(event_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_participants_user ON CalendarEventParticipants(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_reminder_logs_event_user ON CalendarEventReminderLogs(event_id, user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_notes_event ON CalendarEventNotes(event_id, note_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_attachments_event ON CalendarEventAttachments(event_id, attachment_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_downloadsforms_status ON DownloadsForms(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_downloadsforms_category ON DownloadsForms(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_downloadsforms_created ON DownloadsForms(created_at)`);
  db.run(`DELETE FROM CalendarEventParticipants
          WHERE role = 'organizer'
            AND EXISTS (
              SELECT 1 FROM CalendarEvents ce
              WHERE ce.id = CalendarEventParticipants.event_id
                AND ce.owner_user_id = CalendarEventParticipants.user_id
            )`);
  
  // Users indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username)`);
  
  // UserSessions indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON UserSessions(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON UserSessions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON UserSessions(last_activity_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_files_owner ON UserDriveFiles(owner_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_files_folder ON UserDriveFiles(parent_folder_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_files_uploaded ON UserDriveFiles(uploaded_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_files_deleted ON UserDriveFiles(deleted_at, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_folders_owner ON UserDriveFolders(owner_user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_folders_parent ON UserDriveFolders(parent_folder_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_folders_deleted ON UserDriveFolders(deleted_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_shares_file ON UserDriveShares(file_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_shares_user ON UserDriveShares(shared_with_user_id, revoked_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_folder_shares_folder ON UserDriveFolderShares(folder_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_drive_folder_shares_user ON UserDriveFolderShares(shared_with_user_id, revoked_at)`);

  db.run(`DELETE FROM UserPrivileges WHERE privilege = 'mark_uploaded_not_required'`);
  db.run(`
    INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled)
    SELECT id, 'delete_any_calendar_event', 0
    FROM Users
  `);
  db.all(`SELECT id, role FROM Users`, [], (err, users) => {
    if (err || !users) return;
    const stmt = db.prepare(`INSERT OR IGNORE INTO UserPrivileges (user_id, privilege, enabled) VALUES (?, ?, 1)`);
    users.forEach(user => {
      (ROLE_DEFAULT_PRIVILEGES[user.role] || []).forEach(priv => stmt.run([user.id, priv]));
    });
    stmt.finalize();
  });
});

// --- ROUTES ---
