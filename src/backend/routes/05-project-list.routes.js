app.get('/api/projects', __routeController100);

const MANUAL_CALENDAR_EVENT_TYPES = new Set([
  'meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey',
  'site_validation', 'site_geotagging', 'monitoring', 'maintenance', 'leave',
  'personal', 'other'
]);
const SYSTEM_CALENDAR_EVENT_TYPES = new Set([
  'deadline', 'project_deadline', 'document_deadline', 'document_review',
  'for_review', 'cancelled', 'overdue'
]);
const LEGACY_CALENDAR_EVENT_TYPES = new Set(['general', 'procurement', 'document_follow_up', 'project_milestone']);
const CALENDAR_EVENT_TYPES = new Set([
  ...MANUAL_CALENDAR_EVENT_TYPES,
  ...SYSTEM_CALENDAR_EVENT_TYPES,
  ...LEGACY_CALENDAR_EVENT_TYPES
]);
const MANUAL_CALENDAR_VISIBILITIES = new Set(['personal', 'participants']);
const LEGACY_CALENDAR_VISIBILITIES = new Set(['abed_wide', 'division', 'global']);
const CALENDAR_VISIBILITIES = new Set([...MANUAL_CALENDAR_VISIBILITIES, ...LEGACY_CALENDAR_VISIBILITIES]);
const CALENDAR_RESPONSE_STATUSES = new Set(['pending', 'accepted', 'had_prior_schedule']);
const CALENDAR_ACTIVE_RESPONSE_STATUSES = new Set(['accepted', 'had_prior_schedule']);
const CALENDAR_TYPE_COLORS = {
  general: '#2563eb',
  meeting: '#2563eb',
  workshop: '#9333ea',
  orientation: '#0284c7',
  site_inspection: '#7c3aed',
  site_survey: '#7c3aed',
  site_validation: '#8b5cf6',
  site_geotagging: '#0d9488',
  training: '#16a34a',
  monitoring: '#0f766e',
  deadline: '#dc2626',
  procurement: '#d97706',
  document_follow_up: '#0891b2',
  project_milestone: '#4f46e5',
  maintenance: '#475569',
  personal: '#6b7280',
  leave: '#db2777',
  other: '#64748b',
  overdue: '#dc2626',
  document_review: '#ca8a04'
};
const CALENDAR_SYSTEM_SCOPES = new Set(['abe', 'my', 'project_deadlines', 'my_project_deadlines']);
const CALENDAR_MANUAL_SCOPES = new Set(['abe', 'my', 'my_meetings', 'abed_wide', 'personal', 'participants', 'meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey', 'site_validation', 'site_geotagging', 'monitoring', 'maintenance', 'leave', 'other', 'past']);
const CALENDAR_NOTE_TYPES = new Set(['meeting_minutes', 'inspection_notes', 'geotagging_notes', 'training_notes', 'procurement_notes', 'followup_notes', 'milestone_notes', 'maintenance_notes', 'general_notes']);
const CALENDAR_ATTACHMENT_TYPES = new Set(['meeting_minutes_file', 'meeting_document', 'attendance_sheet', 'inspection_report', 'training_report', 'procurement_document', 'geotagging_document', 'photo_documentation', 'supporting_file', 'other']);

const normalizeCalendarType = (value) => {
  const key = String(value || 'general').trim().toLowerCase().replace(/[\s/-]+/g, '_');
  if (key === 'document_followup' || key === 'follow_up') return 'document_follow_up';
  if (key === 'for_review') return 'document_review';
  if (key === 'project_deadlines') return 'project_deadline';
  return CALENDAR_EVENT_TYPES.has(key) ? key : 'general';
};

const calendarTypeFilterKey = (value = '') => {
  const key = String(value || '').trim().toLowerCase().replace(/[\s/-]+/g, '_');
  if (!key || key === 'all') return '';
  if (key === 'for_review') return 'document_review';
  if (key === 'checked' || key === 'checked_completed' || key === 'completed' || key === 'document_checked') return '';
  if (key === 'project_deadline' || key === 'project_deadlines' || key === 'document_deadline' || key === 'document_deadlines') return 'project_deadlines';
  return normalizeCalendarType(key);
};

const isManualCalendarType = (type) => MANUAL_CALENDAR_EVENT_TYPES.has(normalizeCalendarType(type));
const assertManualCalendarType = (type) => {
  const normalized = normalizeCalendarType(type);
  if (!isManualCalendarType(normalized)) {
    const err = new Error('This schedule type is system-generated and cannot be manually created.');
    err.statusCode = 400;
    throw err;
  }
  return normalized;
};

const normalizeCalendarTypeDetail = (eventType, value) => {
  if (eventType !== 'other') return '';
  const detail = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!detail) {
    const err = new Error('Please specify the schedule type for Others.');
    err.statusCode = 400;
    throw err;
  }
  return detail;
};

const normalizeCalendarScope = (scope = 'all_visible') => {
  const key = String(scope || 'all_visible').toLowerCase();
  if (key === 'assigned') return 'my';
  if (key === 'abe' || key === 'all_schedules' || key === 'all_visible') return 'abe';
  if (key === 'my_project_deadlines') return 'my_project_deadlines';
  if (key === 'my_meetings') return 'my_meetings';
  if (key === 'division' || key === 'global' || key === 'abed_wide') return 'abe';
  if (key === 'meetings') return 'meeting';
  if (key === 'trainings') return 'training';
  if (key === 'site_inspections') return 'site_inspection';
  if (key === 'site_geotaggings') return 'site_geotagging';
  if (key === 'follow_ups' || key === 'follow-up' || key === 'followups') return 'followups';
  if (key === 'past_schedules') return 'past';
  return key;
};

const normalizeCalendarVisibility = (visibility = 'personal') => {
  const key = String(visibility || 'personal').toLowerCase();
  if (key === 'division' || key === 'global' || key === 'abed-wide' || key === 'abed_wide') return 'abed_wide';
  if (key === 'participants_only') return 'participants';
  return CALENDAR_VISIBILITIES.has(key) ? key : 'personal';
};

const assertManualCalendarVisibility = (visibility = 'personal') => {
  const normalized = normalizeCalendarVisibility(visibility);
  if (!MANUAL_CALENDAR_VISIBILITIES.has(normalized)) {
    const err = new Error('Only Personal and Participants Only visibility are allowed for manual schedules.');
    err.statusCode = 400;
    throw err;
  }
  return normalized;
};

const isAbedWideVisibility = (visibility = '') => ['abed_wide', 'division', 'global'].includes(String(visibility || '').toLowerCase());

const canManageAbedWideCalendar = async (user) => {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return (await userHasPrivilegeAsync(user, 'manage_division_calendar')) || (await userHasPrivilegeAsync(user, 'manage_global_calendar'));
};

const canViewAbeCalendarWide = async (user) => {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return userHasPrivilegeAsync(user, 'view_calendar');
};

const calendarNoteTypeForEvent = (eventType = 'general') => {
  const key = normalizeCalendarType(eventType);
  if (key === 'meeting') return 'meeting_minutes';
  if (['site_inspection', 'site_survey', 'site_validation'].includes(key)) return 'inspection_notes';
  if (key === 'site_geotagging') return 'geotagging_notes';
  if (['training', 'workshop', 'orientation'].includes(key)) return 'training_notes';
  if (key === 'procurement') return 'procurement_notes';
  if (key === 'document_follow_up') return 'followup_notes';
  if (key === 'project_milestone') return 'milestone_notes';
  if (key === 'maintenance' || key === 'monitoring') return 'maintenance_notes';
  return 'general_notes';
};

const calendarEventHasPassed = (event) => {
  const when = event?.end_datetime || event?.start_datetime || event?.end || event?.start;
  if (!when) return false;
  const ts = new Date(when).getTime();
  return Number.isFinite(ts) && ts < Date.now();
};

const getEffectiveDueDateAsync = (row) => new Promise((resolve) => {
  getEffectiveDueDate(row, (err, result) => resolve(err ? null : result));
});

const getCalendarRange = (req) => {
  let start = req.query.start ? parseManualDueDateInput(String(req.query.start)) : null;
  let end = req.query.end ? parseManualDueDateInput(String(req.query.end)) : null;
  if (!start || isNaN(start.getTime())) {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    start = new Date(`${month}-01T00:00:00+08:00`);
  }
  if (!end || isNaN(end.getTime())) {
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
  }
  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() };
};

const calendarDateKey = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(value));
const serializeParticipants = (participants = []) => participants.map(p => ({
  user_id: p.user_id,
  username: p.username,
  avatar_path: p.avatar_path || null,
  avatar_url: avatarUrlForPath(p.avatar_path),
  role: p.role || 'participant',
  response_status: p.response_status || 'pending'
}));

const calendarParticipantStatusForUser = (event, userId, currentStatus = 'pending') => {
  return Number(event?.created_by_user_id) === Number(userId) ? 'accepted' : (currentStatus || 'pending');
};

const parseCalendarUserFilterIds = (value) => uniqueIds(String(value || '')
  .split(',')
  .map(id => Number(id))
  .filter(id => Number.isInteger(id) && id > 0));

const calendarEventInvolvesAnyUser = (event, userIds = []) => {
  if (!userIds.length || !event) return true;
  const selected = new Set(userIds.map(Number));
  if (event.source === 'manual_event') {
    return (event.participants || []).some(p => selected.has(Number(p.user_id)));
  }
  const directIds = [
    event.owner_user_id,
    event.created_by_user_id,
    event.assigned_user_id,
    event.project_owner_user_id
  ].map(Number).filter(Boolean);
  if (directIds.some(id => selected.has(id))) return true;
  if ((event.pending_items || []).some(item => [item.owner_user_id, item.assigned_user_id, item.project_owner_user_id].map(Number).filter(Boolean).some(id => selected.has(id)))) return true;
  return (event.participants || []).some(p => selected.has(Number(p.user_id)));
};

const canViewCalendarEvent = async (user, event) => {
  if (!user || !event) return false;
  if (await canViewAbeCalendarWide(user)) return true;
  if (Number(event.participant_user_id) === Number(user.id)) return true;
  if (isAbedWideVisibility(event.visibility)) return true;
  return false;
};

const canEditCalendarEvent = async (user, event) => {
  if (!user || !event) return false;
  if (Number(event.created_by_user_id) !== Number(user.id)) return false;
  return userHasPrivilegeAsync(user, 'edit_own_calendar_event');
};

const canDeleteCalendarEvent = async (user, event) => {
  if (!user || !event) return false;
  if (Number(event.created_by_user_id) === Number(user.id)) {
    return userHasPrivilegeAsync(user, 'delete_own_calendar_event');
  }
  return userHasExplicitPrivilegeAsync(user, 'delete_any_calendar_event');
};

const canCancelCalendarEvent = async (user, event) => {
  if (!user || !event) return false;
  if (Number(event.created_by_user_id) !== Number(user.id)) return false;
  return userHasPrivilegeAsync(user, 'delete_own_calendar_event');
};

const getCalendarEventFull = async (eventId) => {
  const event = await dbGet(`
    SELECT ce.*, ou.username as owner_username, cu.username as created_by_username,
           COALESCE(p.name, dp.name) as related_project_name, COALESCE(p.stage, dp.stage) as related_project_stage,
           d.document_type_name as related_document_name, d.stage as related_document_stage,
           dp.stage as document_project_stage
    FROM CalendarEvents ce
    LEFT JOIN Users ou ON ou.id = ce.owner_user_id
    LEFT JOIN Users cu ON cu.id = ce.created_by_user_id
    LEFT JOIN Documents d ON d.id = ce.related_document_id
    LEFT JOIN Projects dp ON dp.id = d.project_id
    LEFT JOIN Projects p ON p.id = COALESCE(ce.related_project_id, d.project_id)
    WHERE ce.id = ?
  `, [eventId]);
  if (!event) return null;
  event.participants = await dbAll(`
    SELECT cep.user_id, u.username, u.avatar_path, cep.role, cep.response_status, cep.notified_at, cep.created_at
    FROM CalendarEventParticipants cep
    JOIN Users u ON u.id = cep.user_id
    WHERE cep.event_id = ?
    ORDER BY CASE cep.role WHEN 'organizer' THEN 0 ELSE 1 END, u.username COLLATE NOCASE
  `, [eventId]);
  return event;
};

const normalizeManualCalendarEvent = async (req, event) => {
  const participant = (event.participants || []).find(p => Number(p.user_id) === Number(req.user.id));
  const participantRole = String(participant?.role || '').toLowerCase();
  const isCreator = Number(event.created_by_user_id) === Number(req.user.id);
  const participantStatus = participant ? calendarParticipantStatusForUser(event, req.user.id, participant.response_status) : null;
  const hasPassed = calendarEventHasPassed(event);
  const docCounts = await dbGet(`
    SELECT
      (SELECT COUNT(*) FROM CalendarEventNotes WHERE event_id = ?) as notes_count,
      (SELECT COUNT(*) FROM CalendarEventAttachments WHERE event_id = ?) as attachments_count
  `, [event.id, event.id]).catch(() => ({ notes_count: 0, attachments_count: 0 }));
  const isRespondableParticipant = !!participant
    && !isCreator
    && ['participant', 'optional'].includes(participantRole)
    && String(participantStatus || 'pending').toLowerCase() === 'pending'
    && String(event.status || 'active') === 'active'
    && !hasPassed;
  return {
    id: `manual:${event.id}`,
    raw_id: event.id,
    source: 'manual_event',
    title: event.title,
    description: event.description || '',
    location: event.location || '',
    start: event.start_datetime,
    end: event.end_datetime || null,
    all_day: !!event.all_day,
    event_type: normalizeCalendarType(event.event_type),
    event_type_detail: normalizeCalendarType(event.event_type) === 'other' ? String(event.event_type_detail || '').trim() : '',
    color: event.color || CALENDAR_TYPE_COLORS[normalizeCalendarType(event.event_type)],
    visibility: normalizeCalendarVisibility(event.visibility || 'personal'),
    status: event.status || 'active',
    project_id: event.related_project_id || null,
    project_name: event.related_project_name || '',
    project_stage: event.related_project_stage || event.document_project_stage || '',
    document_id: event.related_document_id || null,
    document_name: event.related_document_name || '',
    document_stage: event.related_document_stage || '',
    owner_user_id: event.owner_user_id,
    owner_username: event.owner_username || '',
    created_by_user_id: event.created_by_user_id,
    created_by_username: event.created_by_username || '',
    participants: serializeParticipants((event.participants || []).map(p => ({
      ...p,
      response_status: calendarParticipantStatusForUser(event, p.user_id, p.response_status)
    }))),
    response_status: participantStatus,
    participant_role: participantRole || null,
    is_creator: isCreator,
    has_passed: hasPassed,
    notes_count: Number(docCounts?.notes_count || 0),
    attachments_count: Number(docCounts?.attachments_count || 0),
    documentation_search_text: event.documentation_search_text || '',
    can_edit: await canEditCalendarEvent(req.user, event),
    can_cancel: await canCancelCalendarEvent(req.user, event),
    can_delete: await canDeleteCalendarEvent(req.user, event),
    can_respond: isRespondableParticipant && await userHasPrivilegeAsync(req.user, 'respond_calendar_event')
  };
};

const calendarSystemEvent = (item) => ({
  id: `${item.source}:${item.id}`,
  raw_id: item.id,
  source: item.source,
  title: item.title,
  description: item.description || '',
  location: '',
  start: item.start,
  end: item.end || item.start,
  all_day: false,
  event_type: item.event_type,
  color: item.color || CALENDAR_TYPE_COLORS[item.event_type] || CALENDAR_TYPE_COLORS.general,
  visibility: 'abed_wide',
  status: item.status || 'active',
  project_id: item.project_id || null,
  project_name: item.project_name || '',
  document_id: item.document_id || null,
  document_name: item.document_name || '',
  project_stage: item.project_stage || '',
  document_stage: item.document_stage || '',
  owner_user_id: item.owner_user_id || null,
  participants: [],
  response_status: null,
  can_edit: false,
  can_delete: false,
  can_respond: false,
  pending_items: item.pending_items || []
});

const collectSystemCalendarEvents = async (req, range, scope = 'all_visible') => {
  scope = normalizeCalendarScope(scope);
  if (!CALENDAR_SYSTEM_SCOPES.has(scope)) return [];
  const ownerUserId = (scope === 'my' || scope === 'my_project_deadlines') ? req.user.id : null;
  const scopedDocWhere = '';
  const scopedProjectWhere = '';
  const scopedDocParams = [];
  const scopedProjectParams = [];
  const events = [];
  const todayKey = manilaDateKey();
  const todayStart = manilaDateStart(todayKey);
  const pendingCarryOver = [];
  const addPendingCarryOverEvent = (item) => {
    pendingCarryOver.push(item);
  };
  const pendingDaysOverdue = (dueValue) => {
    const dueKey = calendarDateKey(dueValue);
    return Math.max(0, Math.floor((todayStart.getTime() - manilaDateStart(dueKey).getTime()) / 86400000));
  };
  const emitPendingCarryOverSummary = () => {
    if (!pendingCarryOver.length) return;
    const docCount = pendingCarryOver.filter(item => item.kind === 'document').length;
    const projectCount = pendingCarryOver.filter(item => item.kind === 'project').length;
    const title = `${pendingCarryOver.length} Pending Due${pendingCarryOver.length === 1 ? '' : 's'}`;
    const parts = [];
    if (docCount) parts.push(`${docCount} document${docCount === 1 ? '' : 's'}`);
    if (projectCount) parts.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`);
    events.push(calendarSystemEvent({
      id: `${todayKey}:${pendingCarryOver.length}`,
      source: 'pending_due_rollup',
      title,
      description: `Carried over from past due dates: ${parts.join(', ') || 'pending dues'}.`,
      start: `${todayKey}T08:00:00+08:00`,
      event_type: 'overdue',
      color: CALENDAR_TYPE_COLORS.overdue,
      status: 'active',
      pending_items: pendingCarryOver
    }));
  };
  const docs = await dbAll(`
    SELECT d.id, d.project_id, d.document_type_name, d.manual_due_date, d.due_date_override, d.due_date,
           d.status, d.requirement_state, d.file_path, d.upload_date, d.checked_at, d.assigned_user_id, au.username as assigned_username,
           p.name as project_name, p.requester, p.created_at, p.stage as project_stage, COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome, p.assigned_user_id as project_owner_user_id, pau.username as project_assigned_username,
           (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY datetime(created_at) ASC, id ASC LIMIT 1) as creator_user_id,
           d.stage as document_stage,
           COALESCE(rds.due_days, dt.due_days, 0) as due_days,
           COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
           COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
           COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN Users au ON au.id = d.assigned_user_id
    LEFT JOIN Users pau ON pau.id = p.assigned_user_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    WHERE COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
      AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
      AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
      ${scopedDocWhere}
  `, scopedDocParams);
  for (const doc of docs) {
    const effectiveDocOwnerId = doc.assigned_user_id || doc.project_owner_user_id || doc.creator_user_id || null;
    if (ownerUserId && Number(effectiveDocOwnerId) !== Number(ownerUserId)) continue;
    if (doc.status !== 'Checked') {
      const eff = await getEffectiveDueDateAsync(doc);
      if (eff?.effective_due_date) {
        const due = new Date(eff.effective_due_date);
        if (due < todayStart) {
          if (todayStart >= range.start && todayStart <= range.end) {
            addPendingCarryOverEvent({
              kind: 'document',
              id: doc.id,
              project_id: doc.project_id,
              project_name: doc.project_name,
              requester: doc.requester || '',
              due_type: doc.document_type_name || 'Document',
              document_type_name: doc.document_type_name || 'Document',
              original_due_date: eff.effective_due_date,
              due_date: eff.effective_due_date,
              days_overdue: pendingDaysOverdue(eff.effective_due_date),
              assigned_username: doc.assigned_username || doc.project_assigned_username || '',
              owner_user_id: effectiveDocOwnerId,
              assigned_user_id: doc.assigned_user_id || doc.project_owner_user_id || null,
              status: doc.status || 'Pending',
              stage: doc.document_stage || doc.project_stage || 'Proposal',
              project_stage: doc.project_stage || '',
              document_id: doc.id,
              target_kind: 'document'
            });
          }
        } else if (due >= range.start && due <= range.end) {
          events.push(calendarSystemEvent({
            id: doc.id,
            source: 'document_due',
            title: `Due: ${doc.document_type_name || 'Document'}`,
            description: `${doc.project_name || 'Project'} document requirement`,
            start: eff.effective_due_date,
            event_type: 'deadline',
            project_id: doc.project_id,
            project_name: doc.project_name,
            project_stage: doc.project_stage,
            document_id: doc.id,
            document_name: doc.document_type_name,
            document_stage: doc.document_stage,
            owner_user_id: effectiveDocOwnerId
          }));
        }
      }
    }
    if (!['project_deadlines', 'my_project_deadlines'].includes(scope) && doc.file_path && doc.status !== 'Checked' && doc.upload_date) {
      const uploaded = new Date(doc.upload_date);
      if (uploaded >= range.start && uploaded <= range.end) {
        events.push(calendarSystemEvent({
          id: doc.id,
          source: 'document_review',
          title: `For Review: ${doc.document_type_name || 'Document'}`,
          description: doc.project_name || '',
          start: doc.upload_date,
          event_type: 'document_review',
          project_id: doc.project_id,
          project_name: doc.project_name,
          project_stage: doc.project_stage,
          document_id: doc.id,
          document_name: doc.document_type_name,
          document_stage: doc.document_stage,
          owner_user_id: effectiveDocOwnerId
        }));
      }
    }
  }
  const projectDues = await dbAll(`
    SELECT p.id, p.name, p.requester, p.stage, COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as outcome, p.manual_due_date, p.assigned_user_id,
           au.username as assigned_username,
           (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY datetime(created_at) ASC, id ASC LIMIT 1) as creator_user_id
    FROM Projects p
    LEFT JOIN Users au ON au.id = p.assigned_user_id
    WHERE p.stage != 'Completed' AND COALESCE(p.outcome, 'Active') = 'Active' AND p.manual_due_date IS NOT NULL ${scopedProjectWhere}
  `, scopedProjectParams);
  projectDues.forEach(project => {
    const effectiveProjectOwnerId = project.assigned_user_id || project.creator_user_id || null;
    if (ownerUserId && Number(effectiveProjectOwnerId) !== Number(ownerUserId)) return;
    const due = new Date(project.manual_due_date);
    if (due < todayStart) {
      if (todayStart >= range.start && todayStart <= range.end) {
        addPendingCarryOverEvent({
          kind: 'project',
          id: project.id,
          project_id: project.id,
          project_name: project.name,
          requester: project.requester || '',
          due_type: 'Project due date',
          original_due_date: project.manual_due_date,
          due_date: project.manual_due_date,
          days_overdue: pendingDaysOverdue(project.manual_due_date),
          assigned_username: project.assigned_username || '',
          owner_user_id: effectiveProjectOwnerId,
          assigned_user_id: project.assigned_user_id || null,
          status: project.outcome || 'Active',
          stage: project.stage || 'Proposal',
          target_kind: 'project_due_date'
        });
      }
      return;
    }
    if (due < range.start || due > range.end) return;
    events.push(calendarSystemEvent({
      id: project.id,
      source: 'project_due',
      title: `Project Due: ${project.name}`,
      description: project.requester || '',
      start: project.manual_due_date,
      event_type: 'project_milestone',
      project_id: project.id,
      project_name: project.name,
      project_stage: project.stage,
      owner_user_id: effectiveProjectOwnerId
    }));
  });
  emitPendingCarryOverSummary();
  if (scope === 'project_deadlines' || scope === 'my_project_deadlines') return events;
  const transitions = await dbAll(`
    SELECT pt.id, pt.project_id, pt.target_stage, pt.transitioned_at, p.name as project_name, p.assigned_user_id
    FROM ProjectTransitions pt
    JOIN Projects p ON p.id = pt.project_id
    WHERE datetime(pt.transitioned_at) BETWEEN datetime(?) AND datetime(?) ${scopedProjectWhere}
  `, [range.startISO, range.endISO, ...scopedProjectParams]);
  transitions.forEach(t => events.push(calendarSystemEvent({
    id: t.id,
    source: 'project_transition',
    title: `Stage Transition: ${t.project_name} to ${t.target_stage}`,
    start: t.transitioned_at,
    event_type: 'project_milestone',
    project_id: t.project_id,
    project_name: t.project_name,
    project_stage: t.target_stage,
    owner_user_id: t.assigned_user_id || null
  })));
  return events;
};

const calendarRecipientsForEvent = async (eventId) => (await dbAll(`SELECT user_id FROM CalendarEventParticipants WHERE event_id = ?`, [eventId])).map(r => r.user_id);
const auditCalendarEvent = (eventId, req, action, details = '') => db.run(`INSERT INTO CalendarEventAuditLogs (event_id, actor_user_id, action, details) VALUES (?, ?, ?, ?)`, [eventId, req.user?.id || null, action, details || '']);
const notifyCalendarUsers = ({ req, event, recipients, type, message, alertKeyBase, cooldownMinutes = 10 }) => insertNotifications({
  recipients,
  actorId: req.user?.id,
  type,
  message,
  projectId: event.related_project_id || null,
  projectName: event.related_project_name || '',
  documentId: event.related_document_id || null,
  documentName: event.related_document_name || '',
  targetKind: 'calendar_event',
  targetMeta: {
    event_id: event.id,
    event_source: 'manual_event',
    event_title: event.title,
    start_datetime: event.start_datetime,
    end_datetime: event.end_datetime,
    location: event.location || '',
    event_type: event.event_type,
    related_project_id: event.related_project_id || null,
    related_document_id: event.related_document_id || null,
    project_stage: event.related_project_stage || event.document_project_stage || '',
    document_stage: event.related_document_stage || ''
  },
  alertKey: alertKeyBase,
  cooldownMinutes,
  dedupeMode: cooldownMinutes > 0 ? 'cooldown' : 'none'
});

