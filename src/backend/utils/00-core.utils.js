// --- HELPER FUNCTIONS ---

const logError = (action, message = '', stack = '') => {
  console.error(`[${new Date().toISOString()}] ${action}: ${message}`, stack || '');
};

const logActivity = ({
  req = null,
  actorUserId = null,
  actorUsername = '',
  action = '',
  projectId = null,
  project = '',
  requester = '',
  docType = '',
  details = ''
}) => {
  try {

    // =========================
    // DATABASE LOGGING
    // =========================

    const userId = actorUserId || req?.user?.id || null;
    const username = actorUsername || req?.user?.username || 'System';
    const ipAddress = getClientIp(req);

    db.run(
      `INSERT INTO ActivityLogs (
        user_id,
        username,
        action,
        project_id,
        project_name,
        requester,
        document_type,
        details,
        created_at,
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        action,
        projectId,
        project,
        requester,
        docType,
        details,
        new Date().toISOString(),
        ipAddress
      ],
      (err) => {
        if (err) {
          console.error('Activity DB log failed:', err.message);
        }
      }
    );

    // Update session last_activity_at for authenticated users
    if (req?.user?.token && !['LOGIN', 'LOGIN_FAILED', 'LOGOUT'].includes(action)) {
      db.run("UPDATE UserSessions SET last_activity_at = ? WHERE token = ?", [new Date().toISOString(), req.user.token], () => {});
    }

  } catch (err) {
    console.error('Activity logging failed:', err);
  }
};

const cleanEmptyFolders = (fullDirPath) => {
  try {
    let currentPath = fullDirPath;
    while (currentPath !== UPLOADS_DIR && currentPath.startsWith(UPLOADS_DIR)) {
      if (fs.existsSync(currentPath)) {
        if (fs.readdirSync(currentPath).length === 0) {
          fs.rmdirSync(currentPath);
          currentPath = path.dirname(currentPath);
        } else break;
      } else break;
    }
  } catch (e) { logError("FOLDER_CLEANUP_FAIL", e.message, e.stack); }
};

const updateProjectActivity = (projectId) => {
  const now = new Date().toISOString();
  db.run("UPDATE Projects SET last_activity_at = ? WHERE id = ?", [now, projectId], (err) => {
    if (err) logError("PROJECT_ACTIVITY_UPDATE", err.message);
  });
};

const columnExists = (table, column, callback) => {
  db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
    if (err) return callback(err, false);
    const exists = rows.some(r => r.name === column);
    callback(null, exists);
  });
};

const normalizeRequirementState = (state) => {
  const value = String(state || 'Required').trim().toLowerCase();
  if (value === 'not required') return 'Not Required';
  if (value === 'optional') return 'Optional';
  return 'Required';
};

const getDocAndProjectStage = (docId, callback) => {
  db.get(`SELECT d.id, d.stage as doc_stage, p.stage as proj_stage, p.id as project_id, p.name as project_name, p.requester as requester, p.assigned_user_id as project_assigned_user_id,
          d.project_id, d.document_type_name, d.file_path, d.file_name, d.status, d.requirement_state, d.document_type_id, d.uploader_user_id, d.assigned_user_id, d.manual_due_date, d.due_date_override,
          uu.username as uploader_username,
          COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome
          FROM Documents d JOIN Projects p ON d.project_id = p.id 
          LEFT JOIN Users uu ON uu.id = d.uploader_user_id
          WHERE d.id = ?`, [docId], (err, row) => {
    if (err || !row) return callback(err, null);
    callback(null, row);
  });
};
const COUNTABLE_DOCUMENT_EXPR = `COALESCE(requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(requirement_state, 'Required') = 'Optional' AND file_path IS NULL)`;
const PROJECT_OUTCOMES = ['Active', 'Completed', 'Not Feasible', 'Deferred', 'Cancelled', 'Withdrawn', 'Duplicate', 'For Future Funding', 'Irreparable', 'Decommissioned'];
const INACTIVE_PROJECT_OUTCOMES = ['Not Feasible', 'Deferred', 'Cancelled', 'Withdrawn', 'Duplicate', 'For Future Funding', 'Irreparable', 'Decommissioned'];
const DISPOSITION_OUTCOMES = INACTIVE_PROJECT_OUTCOMES;
const normalizeProjectOutcome = (project = {}) => {
  const outcome = PROJECT_OUTCOMES.includes(project.outcome) ? project.outcome : null;
  if (outcome) return outcome;
  return project.stage === 'Completed' ? 'Completed' : 'Active';
};
const isInactiveProjectOutcome = (project = {}) => INACTIVE_PROJECT_OUTCOMES.includes(normalizeProjectOutcome(project));

const PRIVILEGE_CATALOG = [
  { name: 'create_project', display_name: 'Create Project', description: 'Can create new projects', category: 'Work Operation' },
  { name: 'edit_project', display_name: 'Edit Project', description: 'Can edit existing projects', category: 'Work Operation' },
  { name: 'delete_project', display_name: 'Delete Project', description: 'Can delete projects', category: 'Work Operation' },
  { name: 'bypass_assignment_ownership', display_name: 'Bypass Assignment Ownership Restrictions', description: 'Can upload, delete, edit, or delete assigned items even when not the assigned owner.', category: 'Work Operation' },
  { name: 'transition_stage', display_name: 'Transition Stage', description: 'Can transition project stages (Proposal to Implementation to Monitoring to Completed)', category: 'Work Operation' },
  { name: 'manage_project_disposition', display_name: 'Manage Project Disposition', description: 'Can mark projects as Not Feasible, Deferred, Cancelled, Withdrawn, Duplicate, For Future Funding, or reopen closed projects.', category: 'Work Operation' },
  { name: 'request_project_disposition', display_name: 'Request Project Disposition', description: 'Can submit project disposition requests for superadmin confirmation.', category: 'Work Operation' },
  { name: 'approve_project_disposition', display_name: 'Approve Project Disposition', description: 'Can approve or reject pending project disposition requests.', category: 'Work Operation' },
  { name: 'request_project_closure', display_name: 'Request Project Closure', description: 'Can submit close-project requests with supporting documents.', category: 'Work Operation' },
  { name: 'approve_project_closure', display_name: 'Approve Project Closure', description: 'Can approve or reject pending close-project requests.', category: 'Work Operation' },
  { name: 'confirm_duplicate_project_creation', display_name: 'Continue Duplicate Project Creation', description: 'Can continue creating a project after a duplicate warning appears.', category: 'Work Operation' },
  { name: 'manage_stage_edit_access', display_name: 'Manage Temporary Stage Edit Access', description: 'Can grant, update, and revoke temporary edit access for read-only project stages.', category: 'Work Operation' },
  { name: 'manage_direct_superiors', display_name: 'Manage Direct Superior Assignments', description: "Can assign or update a user's direct superior for notification routing.", category: 'Work Operation' },
  { name: 'upload_document', display_name: 'Upload Document', description: 'Can upload documents', category: 'Document Management' },
  { name: 'delete_document', display_name: 'Delete Document', description: 'Can delete uploaded files in an opened project', category: 'Document Management' },
  { name: 'upload_project_documentation', display_name: 'Upload Project Documentation', description: 'Can upload project photos and videos as stage documentation/evidence.', category: 'Document Management' },
  { name: 'view_project_documentation', display_name: 'View Project Documentation', description: 'Can view and download project documentation photos and videos.', category: 'Document Management' },
  { name: 'delete_project_documentation', display_name: 'Delete Project Documentation', description: 'Can delete project documentation photos and videos.', category: 'Document Management' },
  { name: 'mark_checked', display_name: 'Mark Checked', description: 'Can mark uploaded documents/reviews as checked', category: 'Document Management' },
  { name: 'edit_requirement_state', display_name: 'Edit Requirement State', description: 'Can change document requirement states such as Required, Optional, and Not Required', category: 'Document Management' },
  { name: 'set_manual_due_date', display_name: 'Set Manual Due Date', description: 'Can manually override and set project/document due dates', category: 'Document Management' },
  { name: 'export_project_documents', display_name: 'Export Project Documents', description: 'Can export project documents as PDF', category: 'Document Management' },
  { name: 'search_uploaded_documents', display_name: 'Search Uploaded Documents', description: 'Can search inside uploaded document contents.', category: 'Document Management' },
  { name: 'view_monitoring_inventory', display_name: 'View Established Project Monitoring', description: 'Can view established projects, machinery, infrastructure, facilities, irrigation systems, vehicles, and other monitoring inventory.', category: 'Established Project Monitoring' },
  { name: 'add_monitoring_inventory', display_name: 'Add Monitoring Inventory', description: 'Can add machinery, infrastructure, facilities, irrigation systems, vehicles, and other monitored inventory.', category: 'Established Project Monitoring' },
  { name: 'edit_monitoring_inventory', display_name: 'Edit Monitoring Inventory', description: 'Can edit monitoring inventory master records and assignments.', category: 'Established Project Monitoring' },
  { name: 'conduct_monitoring_visit', display_name: 'Conduct Monitoring Visit', description: 'Can record monitoring visits, findings, condition, recommendations, next monitoring dates, and evidence.', category: 'Established Project Monitoring' },
  { name: 'schedule_monitoring_visit', display_name: 'Schedule Monitoring Visit', description: 'Can schedule monitoring visits and place them on the calendar.', category: 'Established Project Monitoring' },
  { name: 'manage_monitoring_tasks', display_name: 'Manage Monitoring Tasks', description: 'Can create, assign, update, and close monitoring issues and follow-up tasks.', category: 'Established Project Monitoring' },
  { name: 'import_monitoring_inventory', display_name: 'Import Monitoring Inventory', description: 'Can bulk import monitoring inventory from Excel workbooks.', category: 'Established Project Monitoring' },
  { name: 'export_monitoring_reports', display_name: 'Export Monitoring Reports', description: 'Can export monitoring inventory, monitoring history, and task reports to Excel.', category: 'Established Project Monitoring' },
  { name: 'view_calendar', display_name: 'View Calendar', description: 'Can view the calendar module.', category: 'Calendar' },
  { name: 'create_calendar_event', display_name: 'Create Calendar Event', description: 'Can create personal or participant-based calendar events.', category: 'Calendar' },
  { name: 'edit_own_calendar_event', display_name: 'Edit Own Calendar Event', description: 'Can edit calendar events created by the user.', category: 'Calendar' },
  { name: 'delete_own_calendar_event', display_name: 'Delete Own Calendar Event', description: 'Can delete or cancel calendar events created by the user.', category: 'Calendar' },
  { name: 'delete_any_calendar_event', display_name: 'Delete Any Calendar Event', description: 'Can permanently delete a schedule even when another user created it. Does not grant edit or cancel access.', category: 'Calendar' },
  { name: 'manage_division_calendar', display_name: 'Manage ABE Calendar', description: 'Can create, edit, and cancel ABE Calendar events.', category: 'Calendar' },
  { name: 'manage_global_calendar', display_name: 'Manage ABE Calendar (Legacy)', description: 'Legacy privilege mapped to ABE Calendar management.', category: 'Calendar' },
  { name: 'view_global_calendar', display_name: 'View ABE Calendar (Legacy)', description: 'Legacy privilege mapped to ABE Calendar viewing.', category: 'Calendar' },
  { name: 'respond_calendar_event', display_name: 'Respond to Calendar Event', description: 'Can accept calendar invitations or mark that the user had a prior schedule.', category: 'Calendar' },
  { name: 'print_project_summary', display_name: 'Print Project Summary', description: 'Can print the Project Summary Sheet.', category: 'Reports / Printing' },
  { name: 'print_requirements_checklist', display_name: 'Print Requirements Checklist', description: 'Can print the document requirements checklist.', category: 'Reports / Printing' },
  { name: 'view_project_closure_attachments', display_name: 'View Project Closure Attachments', description: 'Can view and download closure/disposition supporting documents.', category: 'Reports / Printing' },
  { name: 'manage_requirements', display_name: 'Manage Requirements', description: 'Manage requirement mappings', category: 'Work Configuration' },
  { name: 'manage_due_schedules', display_name: 'Manage Due Schedules', description: 'Manage document type due schedules', category: 'Work Configuration' },
  { name: 'manage_document_types', display_name: 'Manage Document Types', description: 'Manage document types', category: 'Work Configuration' },
  { name: 'manage_project_types', display_name: 'Manage Project Types', description: 'Manage project types', category: 'Work Configuration' },
  { name: 'manage_requestees', display_name: 'Manage Requestees', description: 'Manage requestees', category: 'Work Configuration' },
  { name: 'manage_users', display_name: 'Manage Users', description: 'Can access and manage user accounts and user permissions.', category: 'Workforce / Work Administration' },
  { name: 'view_workload_dashboard', display_name: 'View Workload Dashboard', description: 'Can access the Dashboard Workload View.', category: 'Workforce / Work Administration' },
  { name: 'view_workload_analytics', display_name: 'View Workload Analytics', description: 'Can view workload analytics and assignment statistics.', category: 'Workforce / Work Administration' },
  { name: 'upload_downloads_forms', display_name: 'Upload Forms & Tools', description: 'Can upload tools, forms, templates, checklists, guides, and other downloadable files for staff use.', category: 'Forms & Tools' },
  { name: 'manage_downloads_forms', display_name: 'Manage Forms & Tools', description: 'Can edit, replace, archive, or delete downloadable tools, forms, templates, checklists, guides, and other downloadable files.', category: 'Forms & Tools' },
  { name: 'view_user_drive', display_name: 'View My Drive', description: 'Can access own private My Drive files.', category: 'My Drive' },
  { name: 'upload_user_drive_file', display_name: 'Upload My Drive Files', description: 'Can upload files to own My Drive.', category: 'My Drive' },
  { name: 'manage_own_user_drive', display_name: 'Manage Own My Drive', description: 'Can rename, move, organize, and update own My Drive files and folders.', category: 'My Drive' },
  { name: 'share_user_drive_file', display_name: 'Share My Drive Files', description: 'Can share own My Drive files with selected users.', category: 'My Drive' },
  { name: 'delete_own_user_drive_file', display_name: 'Delete Own My Drive Files', description: 'Can delete own My Drive files and folders.', category: 'My Drive' },
  { name: 'manage_all_user_drive', display_name: 'Manage All My Drive Storage', description: 'Maintenance privilege for inspecting My Drive storage usage and recovery.', category: 'My Drive' },
  { name: 'attach_drive_file_to_project', display_name: 'Attach My Drive Files', description: 'Can copy My Drive files into project documents, project documentation, or calendar attachments when target permissions allow.', category: 'My Drive' },
  { name: 'view_abearc_map', display_name: 'View Geotag Map', description: 'Can view geotagged field photos on Geotag Map.', category: 'Geotag Map' },
  { name: 'upload_map_media', display_name: 'Upload Map Photos', description: 'Can upload GeoCamera photos directly to Geotag Map.', category: 'Geotag Map' },
  { name: 'manage_own_map_media', display_name: 'Manage Own Map Photos', description: 'Can edit, hide, link, and delete own Geotag Map photos.', category: 'Geotag Map' },
  { name: 'manage_all_map_media', display_name: 'Manage All Map Photos', description: 'Can review, edit, hide, link, and delete all Geotag Map photos.', category: 'Geotag Map' },
  { name: 'review_map_locations', display_name: 'Review Map Locations', description: 'Can correct missing, invalid, or low-accuracy Geotag Map photo locations.', category: 'Geotag Map' },
  { name: 'manage_backups', display_name: 'Manage Backups', description: 'Can create, download, restore, and delete system backups.', category: 'System Administration' },
  { name: 'manage_maintenance', display_name: 'Admin Maintenance', description: 'Can access maintenance tools and run technical maintenance actions.', category: 'System Administration' },
  { name: 'import_export_config', display_name: 'Import/Export Configuration', description: 'Can export and import project management configuration.', category: 'System Administration' },
  { name: 'view_activity_logs', display_name: 'View Activity Logs', description: 'Can view system and security activity logs.', category: 'System Administration' },
  { name: 'system_testing', display_name: 'System Testing', description: 'Can run technical system diagnostic tests.', category: 'System Administration' },
  { name: 'system_health_check', display_name: 'System Health Check', description: 'Can inspect technical system health information.', category: 'System Administration' }
];

const SYSTEM_PRIVILEGES = new Set([
  'manage_backups',
  'manage_maintenance',
  'import_export_config',
  'view_activity_logs',
  'system_testing',
  'system_health_check',
  'manage_all_user_drive'
]);

const ROLE_DEFAULT_PRIVILEGES = {
  superadmin: PRIVILEGE_CATALOG
    .map(p => p.name)
    .filter(name => !SYSTEM_PRIVILEGES.has(name) && name !== 'delete_any_calendar_event'),
  admin: [
    'create_project', 'edit_project', 'delete_project', 'transition_stage', 'confirm_duplicate_project_creation',
    'manage_project_disposition', 'request_project_disposition', 'request_project_closure', 'manage_direct_superiors', 'view_project_closure_attachments',
    'upload_document', 'delete_document', 'upload_project_documentation', 'view_project_documentation', 'delete_project_documentation', 'mark_checked', 'edit_requirement_state', 'set_manual_due_date',
    'export_project_documents', 'search_uploaded_documents', 'view_workload_dashboard',
    'view_monitoring_inventory', 'add_monitoring_inventory', 'edit_monitoring_inventory', 'conduct_monitoring_visit',
    'schedule_monitoring_visit', 'manage_monitoring_tasks', 'import_monitoring_inventory', 'export_monitoring_reports',
    'view_calendar', 'create_calendar_event', 'edit_own_calendar_event', 'delete_own_calendar_event',
    'manage_division_calendar', 'view_global_calendar', 'respond_calendar_event',
    'print_project_summary', 'print_requirements_checklist',
    'manage_due_schedules', 'manage_requirements', 'manage_project_types', 'manage_requestees', 'manage_document_types',
    'view_workload_analytics',
    'view_user_drive', 'upload_user_drive_file', 'manage_own_user_drive', 'share_user_drive_file', 'delete_own_user_drive_file', 'attach_drive_file_to_project',
    'view_abearc_map', 'upload_map_media', 'manage_own_map_media', 'manage_all_map_media', 'review_map_locations'
  ],
  user: [
    'create_project', 'edit_project', 'transition_stage', 'confirm_duplicate_project_creation',
    'manage_project_disposition', 'request_project_disposition', 'request_project_closure',
    'upload_document', 'delete_document', 'upload_project_documentation', 'view_project_documentation', 'export_project_documents', 'search_uploaded_documents',
    'view_monitoring_inventory', 'add_monitoring_inventory', 'conduct_monitoring_visit', 'schedule_monitoring_visit',
    'view_calendar', 'create_calendar_event', 'edit_own_calendar_event', 'delete_own_calendar_event', 'respond_calendar_event',
    'print_project_summary', 'print_requirements_checklist',
    'manage_requirements', 'manage_document_types', 'manage_project_types', 'manage_requestees',
    'view_user_drive', 'upload_user_drive_file', 'manage_own_user_drive', 'share_user_drive_file', 'delete_own_user_drive_file', 'attach_drive_file_to_project',
    'view_abearc_map', 'upload_map_media', 'manage_own_map_media', 'review_map_locations'
  ],
  system: [
    'manage_backups', 'manage_maintenance', 'import_export_config', 'view_activity_logs',
    'system_testing', 'system_health_check', 'manage_users', 'manage_all_user_drive'
  ]
};

const SUPERADMIN_MANAGED_PRIVILEGES = new Set([
  'manage_users', 'manage_backups', 'manage_maintenance', 'import_export_config',
  'view_activity_logs', 'system_testing', 'system_health_check',
  'manage_stage_edit_access', 'approve_project_disposition', 'approve_project_closure'
]);
const ADMIN_ONLY_PRIVILEGES = new Set(['view_workload_analytics', 'view_workload_dashboard']);

const isSystemUser = (user) => Boolean(user && (user.role === 'system' || Number(user.is_system_account) === 1));
const isOperationalUser = (user) => Boolean(user && !isSystemUser(user));
const isVisibleWorkUser = (user) => isOperationalUser(user) && Number(user.hidden_from_workflows || 0) !== 1;
const isAssignableUser = (user) => isVisibleWorkUser(user);
const isCalendarInvitableUser = (user) => isVisibleWorkUser(user);
const canRoleBypassPrivilege = (user, privilege) => user?.role === 'superadmin' && !SYSTEM_PRIVILEGES.has(privilege);

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// Helper: Add working days (skip weekends) to a date
const addWorkingDays = (startDate, days) => {
  let result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

// Helper: Format date as YYYY-MM-DD
const formatDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const safeBackupFilename = () => {
  const d = new Date();
  const parts = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ];
  const time = [d.getHours(), d.getMinutes()].map(v => String(v).padStart(2, '0')).join('-');
  return `division-project-tracker-backup-${parts.join('-')}-${time}.zip`;
};

const dirSize = (dir) => {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
};

const addFolderToZip = (zip, folder, zipRoot) => {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    const rel = path.posix.join(zipRoot, entry.name);
    if (entry.isDirectory()) addFolderToZip(zip, full, rel);
    else zip.addLocalFile(full, path.posix.dirname(rel));
  }
};

const safeRelativePath = (root, relativePath) => {
  const relative = String(relativePath || '').replace(/^[/\\]+/, '');
  const absolute = path.resolve(root, relative);
  const resolvedRoot = path.resolve(root);
  return absolute === resolvedRoot || absolute.startsWith(resolvedRoot + path.sep) ? absolute : null;
};

const sanitizeDownloadsFormsFilename = (filename = 'file') => {
  const parsed = path.parse(String(filename || 'file'));
  const base = (parsed.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'file';
  const ext = (parsed.ext || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${base}${ext}`;
};

const normalizeDownloadsFormsStatus = (status = 'Active') => String(status || '').toLowerCase() === 'archived' ? 'Archived' : 'Active';

const readStringPool = (buf, off) => {
  const count = buf.readUInt32LE(off + 8);
  const flags = buf.readUInt32LE(off + 16);
  const stringsStart = off + buf.readUInt32LE(off + 20);
  const utf8 = !!(flags & 0x100);
  const strings = [];
  const len = (p) => {
    const b = buf[p];
    return b & 0x80 ? { value: ((b & 0x7f) << 8) | buf[p + 1], bytes: 2 } : { value: b, bytes: 1 };
  };
  for (let i = 0; i < count; i++) {
    let p = stringsStart + buf.readUInt32LE(off + 28 + i * 4);
    if (utf8) {
      const a = len(p); p += a.bytes;
      const b = len(p); p += b.bytes;
      strings.push(buf.toString('utf8', p, p + b.value));
    } else {
      const chars = buf.readUInt16LE(p); p += 2;
      strings.push(buf.toString('utf16le', p, p + chars * 2));
    }
  }
  return strings;
};

const extractApkVersion = (apkPath) => {
  try {
    const entry = new AdmZip(apkPath).getEntry('AndroidManifest.xml');
    if (!entry) return {};
    const buf = entry.getData();
    let off = 8, strings = [], resourceMap = [], out = {};
    while (off + 8 <= buf.length) {
      const type = buf.readUInt16LE(off);
      const size = buf.readUInt32LE(off + 4);
      if (type === 0x0001) strings = readStringPool(buf, off);
      else if (type === 0x0180) {
        for (let p = off + 8; p < off + size; p += 4) resourceMap.push(buf.readUInt32LE(p));
      } else if (type === 0x0102) {
        const attrStart = off + buf.readUInt16LE(off + 2) + buf.readUInt16LE(off + 24);
        const attrSize = buf.readUInt16LE(off + 26);
        const attrCount = buf.readUInt16LE(off + 28);
        for (let i = 0; i < attrCount; i++) {
          const p = attrStart + i * attrSize;
          const nameIdx = buf.readUInt32LE(p + 4);
          const rawIdx = buf.readUInt32LE(p + 8);
          const dataType = buf[p + 15];
          const data = buf.readUInt32LE(p + 16);
          const name = strings[nameIdx] || '';
          const resId = resourceMap[nameIdx];
          if (name === 'versionName' || resId === 0x0101021c) out.versionName = rawIdx !== 0xffffffff ? strings[rawIdx] : (dataType === 3 ? strings[data] : String(data));
          if (name === 'versionCode' || resId === 0x0101021b) out.versionCode = data;
        }
        if (out.versionName || out.versionCode) return out;
      }
      off += size || 8;
    }
    return out;
  } catch (_) {
    return {};
  }
};

const canManageDownloadsForms = async (user) => {
  if (!user) return false;
  if (canRoleBypassPrivilege(user, 'manage_downloads_forms')) return true;
  const row = await dbGet("SELECT enabled FROM UserPrivileges WHERE user_id = ? AND privilege = ?", [user.id, 'manage_downloads_forms']);
  return row?.enabled === 1;
};

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_avatar${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
    if (!AVATAR_ALLOWED_EXTENSIONS.includes(ext) || !allowedMime) return cb(new Error('Invalid file type. Please upload JPG, PNG, or WEBP.'), false);
    cb(null, true);
  }
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const collectConfigExport = async () => {
  const tables = ['ProjectTypes', 'Requestees', 'DocumentTypes', 'RequirementSets', 'RequirementSetItems', 'UserPrivileges'];
  const config = { exported_at: new Date().toISOString(), version: 2 };
  await Promise.all(tables.map(async (tbl) => {
    config[tbl] = await dbAll(`SELECT * FROM ${tbl}`);
  }));
  config.RequirementSetDueSchedules = await dbAll(`
    SELECT
      rs.id as requirement_set_id,
      rs.project_type_id,
      rs.requestee_id,
      rs.stage,
      rds.document_type_id,
      dt.name as document_type_name,
      dt.category as document_type_category,
      COALESCE(rds.due_days, 0) as due_days,
      COALESCE(rds.due_hours, 0) as due_hours,
      COALESCE(rds.document_type_start_point, 0) as document_type_start_point,
      COALESCE(rds.start_from_document_upload, 0) as start_from_document_upload
    FROM RequirementSets rs
    JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id
    JOIN DocumentTypes dt ON dt.id = rds.document_type_id
    ORDER BY rs.project_type_id, rs.requestee_id, rs.stage, dt.order_index ASC
  `);
  return config;
};

const checkpointDatabase = () => new Promise((resolve, reject) => {
  db.serialize(() => {
    db.run('PRAGMA wal_checkpoint(TRUNCATE);', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
});

const createBackupFile = async (filename = safeBackupFilename()) => {
  // Flush SQLite WAL changes into the main data.db before creating the backup.
  await checkpointDatabase();

  const zip = new AdmZip();

  if (!fs.existsSync(DB_PATH)) {
    throw new Error('Database file not found.');
  }

  zip.addLocalFile(DB_PATH, '');

  // Keep uploaded files included in the backup.
  addFolderToZip(zip, UPLOADS_DIR, 'uploads');
  addFolderToZip(zip, CALENDAR_ATTACHMENTS_DIR, 'calendar-attachments');
  addFolderToZip(zip, AVATARS_DIR, 'avatars');
  addFolderToZip(zip, DOWNLOADS_FORMS_DIR, 'downloads-forms');
  addFolderToZip(zip, PROJECT_CLOSURE_ATTACHMENTS_DIR, 'project-closure-attachments');
  addFolderToZip(zip, PROJECT_DOCUMENTATION_DIR, 'project-documentation');
  addFolderToZip(zip, MONITORING_ATTACHMENTS_DIR, 'monitoring-attachments');
  addFolderToZip(zip, MAP_MEDIA_ORIGINALS_DIR, 'map-media/originals');
  addFolderToZip(zip, MAP_MEDIA_THUMBNAILS_DIR, 'map-media/thumbnails');
  addFolderToZip(zip, USER_DRIVE_DIR, 'user-drive');

  // Keep config.json included for compatibility/reference.
  const config = await collectConfigExport();
  zip.addFile('config.json', Buffer.from(JSON.stringify(config, null, 2), 'utf8'));

  const dest = path.join(BACKUPS_DIR, filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
  zip.writeZip(dest);

  return dest;
};

const backupZipErrorMessage = (error) => {
  const message = String(error?.message || '');
  if (/ADM-ZIP|END header|Invalid or unsupported zip|invalid zip|unexpected end/i.test(message)) {
    return 'The selected backup file is not a valid or complete ZIP archive. Please create/download the backup again and retry.';
  }
  return message || 'Invalid backup ZIP';
};

const removeDirContents = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
};

const avatarUrlForPath = (avatarPath) => avatarPath
  ? `/api/avatars/${String(avatarPath).replace(/^avatars[\\/]/, '').split(/[\\/]+/).map(encodeURIComponent).join('/')}`
  : null;
const sanitizeAvatarFilename = (filename = 'avatar') => path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
const safeAvatarAbsolutePath = (avatarPath) => {
  if (!avatarPath) return null;
  const relative = String(avatarPath).replace(/^avatars[\\/]/, '');
  const absolute = path.resolve(AVATARS_DIR, relative);
  return absolute.startsWith(path.resolve(AVATARS_DIR) + path.sep) ? absolute : null;
};
const userPublicFields = (user = {}) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  is_system_account: Number(user.is_system_account || 0),
  hidden_from_workflows: Number(user.hidden_from_workflows || 0),
  theme_preference: user.theme_preference || 'light',
  avatar_path: user.avatar_path || null,
  avatar_url: avatarUrlForPath(user.avatar_path)
});

const extractSearchText = async (filePath, ext) => {
  if (ext === '.pdf') {
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    try {
      const data = await parser.getText();
      return data.text || '';
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    return workbook.SheetNames.map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
  }
  if (['.txt', '.csv'].includes(ext)) return fs.readFileSync(filePath, 'utf8');
  return '';
};

const indexDocumentSearch = (documentId) => {
  db.get(`
    SELECT d.id, d.file_path, d.file_name, d.document_type_name, d.stage, p.name as project_name
    FROM Documents d JOIN Projects p ON p.id = d.project_id WHERE d.id = ?
  `, [documentId], async (err, doc) => {
    if (err || !doc) return;
    const full = doc.file_path ? path.join(UPLOADS_DIR, doc.file_path) : null;
    const ext = path.extname(doc.file_name || doc.file_path || '').toLowerCase();
    let text = [doc.file_name, doc.project_name, doc.document_type_name, doc.stage].filter(Boolean).join('\n');
    let status = 'metadata_only';
    let errorMessage = null;
    if (full && fs.existsSync(full)) {
      try {
        const extracted = await extractSearchText(full, ext);
        if (extracted && extracted.trim()) {
          text += `\n${extracted}`;
          status = 'indexed';
        } else {
          errorMessage = 'Text content not available for this file';
        }
      } catch (e) {
        errorMessage = 'Text content not available for this file';
      }
    } else {
      errorMessage = 'File missing on disk';
    }
    db.run(`INSERT INTO DocumentSearchIndex (document_id, content_text, index_status, error_message, indexed_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET content_text=excluded.content_text, index_status=excluded.index_status, error_message=excluded.error_message, indexed_at=excluded.indexed_at`,
      [documentId, text, status, errorMessage, new Date().toISOString()]);
  });
};

const recordProjectTransition = (req, projectId, sourceStage, targetStage, remarks) => {
  db.run(`INSERT INTO ProjectTransitions (project_id, transitioned_by_user_id, transitioned_by_username, source_stage, target_stage, remarks, transitioned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, req.user?.id || null, req.user?.username || 'System', sourceStage, targetStage, remarks || '', new Date().toISOString()]);
};

const isWorkingDay = (date) => {
  const day = new Date(date).getDay();
  return day !== 0 && day !== 6;
};

const manilaDateStart = (dateKey) => new Date(`${dateKey}T00:00:00+08:00`);

const workingDaysUntil = (fromDateKey, toDateKey) => {
  const from = manilaDateStart(fromDateKey);
  const to = manilaDateStart(toDateKey);
  if (to < from) return -1;
  if (to.getTime() === from.getTime()) return 0;
  let cursor = new Date(from);
  let count = 0;
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor)) count++;
  }
  return count;
};

const addWorkingDaysFromNow = (days) => addWorkingDays(new Date(), days);

const formatManilaDueDate = (date) => {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  } catch (e) {
    return String(date || '');
  }
};

const parseManualDueDateInput = (value) => {
  if (typeof value !== 'string') return new Date(value);
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw)) {
    return new Date(`${raw}+08:00`);
  }
  return new Date(raw);
};

// Centralized helper to compute effective due date for a document
// Priority: manual_due_date > computed conditional due date > stored due_date > null
function getEffectiveDueDate(docRow, callback) {
  // Priority 1: Manual override takes highest priority
  if (docRow.manual_due_date) {
    return callback(null, { effective_due_date: docRow.manual_due_date, due_date_source: 'manual' });
  }
  
  // Priority 2: Computed conditional due date based on settings
  const dueDays = parseInt(docRow.due_days || 0, 10) || 0;
  const dueHours = parseInt(docRow.due_hours || 0, 10) || 0;
  
  if (dueDays > 0 || dueHours > 0) {
    // Check if this document type depends on another document upload
    if (docRow.start_from_document_upload && docRow.document_type_start_point) {
      // Find when trigger document was uploaded
      db.get(`SELECT upload_date FROM Documents 
              WHERE project_id = ? AND document_type_id = ? AND file_path IS NOT NULL 
              ORDER BY upload_date ASC LIMIT 1`, 
              [docRow.project_id || docRow.id, docRow.document_type_start_point], (triggerErr, triggerRow) => {
        if (triggerErr || !triggerRow || !triggerRow.upload_date) {
          if (docRow.due_date) {
            return callback(null, { effective_due_date: docRow.due_date, due_date_source: 'stored' });
          }
          // Trigger document not uploaded yet, no due date
          return callback(null, { effective_due_date: null, due_date_source: 'none' });
        }
        
        let startDate = new Date(triggerRow.upload_date);
        let dueDate;
        if (dueDays > 0) {
          dueDate = addWorkingDays(startDate, dueDays);
          dueDate.setHours(dueDate.getHours() + dueHours);
        } else {
          dueDate = new Date(startDate);
          dueDate.setHours(dueDate.getHours() + dueHours);
        }
        
        return callback(null, { effective_due_date: dueDate.toISOString(), due_date_source: 'auto-dependent' });
      });
      return;
    } else {
      // Default: start from project creation
      const projectCreatedAt = docRow.project_created_at || docRow.created_at;
      if (!projectCreatedAt) {
        if (docRow.due_date) {
          return callback(null, { effective_due_date: docRow.due_date, due_date_source: 'stored' });
        }
        return callback(null, { effective_due_date: null, due_date_source: 'none' });
      }
      
      let startDate = new Date(projectCreatedAt);
      let dueDate;
      if (dueDays > 0) {
        dueDate = addWorkingDays(startDate, dueDays);
        dueDate.setHours(dueDate.getHours() + dueHours);
      } else {
        dueDate = new Date(startDate);
        dueDate.setHours(dueDate.getHours() + dueHours);
      }
      
      return callback(null, { effective_due_date: dueDate.toISOString(), due_date_source: 'auto-project' });
    }
  }
  
  if (docRow.due_date) {
    return callback(null, { effective_due_date: docRow.due_date, due_date_source: 'stored' });
  }

  // No due date configured
  return callback(null, { effective_due_date: null, due_date_source: 'none' });
}

const verifyPassword = (password, storedHash = '') => {
  const [salt, hash] = String(storedHash).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  const original = Buffer.from(hash, 'hex');
  return original.length === candidate.length && crypto.timingSafeEqual(original, candidate);
};

const generateSessionToken = () => crypto.randomBytes(48).toString('hex');

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlJson = (value) => base64UrlEncode(JSON.stringify(value));
const mobileQrSignature = (payload) => crypto
  .createHmac('sha256', process.env.MOBILE_QR_LOGIN_SECRET || process.env.SESSION_SECRET || 'abearc-mobile-qr-login')
  .update(payload)
  .digest('base64url');
const createMobileQrLoginToken = (userId) => {
  const payload = base64UrlJson({
    typ: 'abearc-mobile-login',
    aud: MOBILE_QR_LOGIN_AUDIENCE,
    sub: Number(userId),
    exp: Date.now() + MOBILE_QR_LOGIN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  });
  return `${payload}.${mobileQrSignature(payload)}`;
};
const verifyMobileQrLoginToken = (token = '') => {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = mobileQrSignature(payload);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (data?.typ !== 'abearc-mobile-login' || data?.aud !== MOBILE_QR_LOGIN_AUDIENCE) return null;
  if (!Number.isInteger(Number(data.sub)) || Number(data.sub) <= 0) return null;
  if (!Number(data.exp) || Date.now() > Number(data.exp)) return null;
  return data;
};
const requestBaseUrl = (req) => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host || `localhost:${PORT}`}`.replace(/\/+$/, '');
};

const unauthorized = (res, message = 'Unauthorized') => res.status(401).json({ error: message });
const forbidden = (res, message = 'Forbidden') => res.status(403).json({ error: message });

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return String(req.query.token || '').trim();
  return authHeader.slice(7).trim();
};

const isGeoCameraClient = (req) => String(req.headers['x-abearc-client'] || '')
  .toLowerCase()
  .includes('geocamera');

const sessionExpiryForRequest = (req) => {
  if (isGeoCameraClient(req)) return new Date(Date.now() + MOBILE_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return new Date(Date.now() + SESSION_ABSOLUTE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
};

const mobileSessionExpiry = () => new Date(Date.now() + MOBILE_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

const isLongLivedSession = (createdAt, expiresAt) => {
  if (!createdAt || !expiresAt || isNaN(createdAt.getTime()) || isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() - createdAt.getTime() >= MOBILE_SESSION_MIN_EXPIRY_HOURS * 60 * 60 * 1000;
};
