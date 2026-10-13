app.post('/api/calendar/conflicts', requireCalendarScheduling, async (req, res) => {
  try { res.json({ conflicts: await calendarAllScheduleConflicts(req, req.body || {}) }); }
  catch (err) { res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Unable to check availability. Please try again.' }); }
});

app.post('/api/calendar/availability', requireCalendarScheduling, async (req, res) => {
  try { res.json({ slots: await calendarAvailableSlots(req, req.body || {}) }); }
  catch (err) { res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Unable to find available times. Please try again.' }); }
});

app.get('/api/calendar/events', requireCalendarView, __routeController101);

app.post('/api/calendar/events', checkPrivilege('create_calendar_event'), __routeController102);

app.get('/api/calendar/events/:id', requireCalendarView, __routeController103);

app.put('/api/calendar/events/:id', requireCalendarView, __routeController104);

app.delete('/api/calendar/events/:id', requireCalendarView, __routeController105);

app.delete('/api/calendar/events/:id/permanent', requireCalendarView, __routeController106);

app.post('/api/calendar/events/:id/respond', checkPrivilege('respond_calendar_event'), __routeController107);

app.post('/api/calendar/events/:id/participants', requireCalendarView, __routeController108);

app.delete('/api/calendar/events/:id/participants/:userId', requireCalendarView, __routeController109);

const getCalendarEventAccess = async (req, eventId) => {
  const event = await getCalendarEventFull(Number(eventId));
  if (!event) return { event: null, participant: null, canView: false, canEdit: false, canAddDocumentation: false };
  const participant = (event.participants || []).find(p => Number(p.user_id) === Number(req.user.id));
  const canView = await canViewCalendarEvent(req.user, { ...event, participant_user_id: participant?.user_id });
  const canEdit = await canEditCalendarEvent(req.user, event);
  const participantRole = String(participant?.role || '').toLowerCase();
  const isOwner = Number(event.owner_user_id) === Number(req.user.id) || Number(event.created_by_user_id) === Number(req.user.id);
  const isContributor = !!participant && ['participant', 'optional'].includes(participantRole);
  const canAddDocumentation = canView && (req.user.role === 'superadmin' || isOwner || isContributor || canEdit);
  return { event, participant, canView, canEdit, canAddDocumentation };
};

const canModifyCalendarDocumentation = async (req, event, row = {}) => {
  if (!event || !row) return false;
  if (req.user.role === 'superadmin') return true;
  if (Number(row.created_by_user_id || row.uploaded_by_user_id) === Number(req.user.id)) {
    if (Number(row.is_final || 0) === 1) {
      return Number(event.owner_user_id) === Number(req.user.id) || Number(event.created_by_user_id) === Number(req.user.id) || await canEditCalendarEvent(req.user, event);
    }
    return true;
  }
  if (Number(event.owner_user_id) === Number(req.user.id) || Number(event.created_by_user_id) === Number(req.user.id)) return true;
  return canEditCalendarEvent(req.user, event);
};

const sanitizeCalendarFilename = (filename = 'attachment') => {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const base = path.basename(String(filename || 'attachment'), ext)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'calendar_attachment';
  return `${base}${ext}`;
};

const normalizeScheduleTypeFolder = (type = '') => {
  const key = String(type || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const aliases = {
    documentfollowup: 'document-follow-up',
    'document-followup': 'document-follow-up',
    'follow-up': 'document-follow-up',
    'leave-out-of-office': 'leave'
  };
  const normalized = aliases[key] || key || 'general';
  const known = new Set(['general', 'meeting', 'training', 'workshop', 'orientation', 'site-inspection', 'site-survey', 'site-validation', 'site-geotagging', 'procurement', 'document-follow-up', 'project-milestone', 'personal', 'maintenance', 'monitoring', 'leave', 'other']);
  return known.has(normalized) ? normalized : 'general';
};

const calendarAttachmentDateFolder = (event = {}) => {
  const date = new Date(event.start_datetime || event.start || '');
  if (Number.isFinite(date.getTime())) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
};

const buildCalendarAttachmentRelativePath = async (event, originalName) => {
  const dateFolder = calendarAttachmentDateFolder(event);
  const typeFolder = normalizeScheduleTypeFolder(event.event_type);
  const eventFolder = `event-${Number(event.id)}`;
  const safeName = sanitizeCalendarFilename(originalName);
  let storedName = `${Date.now()}_${safeName}`;
  let relativePath = path.posix.join(dateFolder, typeFolder, eventFolder, storedName);
  let fullPath = safeCalendarAttachmentPath(relativePath);
  while (fullPath && fs.existsSync(fullPath)) {
    storedName = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${safeName}`;
    relativePath = path.posix.join(dateFolder, typeFolder, eventFolder, storedName);
    fullPath = safeCalendarAttachmentPath(relativePath);
  }
  if (!fullPath) throw new Error('Unable to build a safe attachment path');
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  return { relativePath, fullPath, storedName };
};

const safeCalendarAttachmentPath = (filePath = '') => {
  const raw = String(filePath || '').trim().replace(/\\/g, '/');
  if (!raw || path.isAbsolute(raw) || raw.includes('\0')) return null;
  const normalized = path.posix.normalize(raw);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) return null;
  const base = path.resolve(CALENDAR_ATTACHMENTS_DIR);
  const resolved = path.resolve(base, normalized);
  if (!resolved.startsWith(`${base}${path.sep}`)) return null;
  return resolved;
};

const cleanEmptyCalendarAttachmentFolders = async (filePath = '') => {
  const base = path.resolve(CALENDAR_ATTACHMENTS_DIR);
  let dir = path.dirname(path.resolve(filePath));
  while (dir && dir !== base && dir.startsWith(`${base}${path.sep}`)) {
    try {
      await fs.promises.rmdir(dir);
      dir = path.dirname(dir);
    } catch (err) {
      break;
    }
  }
};

const calendarAttachmentExtension = (attachment = {}) => {
  const fromColumn = String(attachment.file_ext || '').toLowerCase();
  if (fromColumn) return fromColumn.startsWith('.') ? fromColumn : `.${fromColumn}`;
  return path.extname(attachment.original_name || attachment.file_name || attachment.file_path || '').toLowerCase();
};

const calendarAttachmentContentType = (attachment = {}) => {
  const ext = calendarAttachmentExtension(attachment);
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  return attachment.file_type || map[ext] || 'application/octet-stream';
};

const contentDispositionFileName = (name = 'attachment') => String(name || 'attachment').replace(/[\r\n"]/g, '_');

const calendarAttachmentPublic = (attachment = {}) => {
  if (!attachment) return attachment;
  const { file_path, ...safe } = attachment;
  return safe;
};

const calendarAttachmentUploadSingle = (req, res, next) => {
  calendarAttachmentUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    res.status(400).json({ error: err.message || 'Failed to upload attachment' });
  });
};

app.get('/api/calendar/events/:id/notes', requireCalendarView, __routeController110);

app.post('/api/calendar/events/:id/notes', requireCalendarView, __routeController111);

app.put('/api/calendar/events/:id/notes/:noteId', requireCalendarView, __routeController112);

app.delete('/api/calendar/events/:id/notes/:noteId', requireCalendarView, __routeController113);

app.post('/api/calendar/events/:id/notes/:noteId/finalize', requireCalendarView, __routeController114);

app.get('/api/calendar/events/:id/notes/:noteId/download', requireCalendarView, __routeController115);

app.get('/api/calendar/events/:id/attachments', requireCalendarView, __routeController116);

app.post('/api/calendar/events/:id/attachments', requireCalendarView, calendarAttachmentUploadSingle, __routeController117);

app.get('/api/calendar/events/:id/attachments/:attachmentId/view', requireCalendarView, __routeController118);

app.get('/api/calendar/events/:id/attachments/:attachmentId/download', requireCalendarView, __routeController119);

app.put('/api/calendar/events/:id/attachments/:attachmentId/content', requireCalendarView, __routeController120);

app.delete('/api/calendar/events/:id/attachments/:attachmentId', requireCalendarView, __routeController121);

const parseReminderMinutes = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(n => Number.isFinite(n) && n >= 0);
  } catch (e) {}
  return String(value).split(',').map(v => Number(v.trim())).filter(n => Number.isFinite(n) && n >= 0);
};

const formatCalendarReminderLead = (minutes) => {
  const mins = Number(minutes || 0);
  if (!Number.isFinite(mins) || mins <= 0) return 'now';
  if (mins % 1440 === 0) {
    const days = mins / 1440;
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (mins >= 60 && mins % 60 === 0) {
    const hours = mins / 60;
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `in ${mins} minute${mins === 1 ? '' : 's'}`;
};

const runCalendarReminders = async (req = { user: { id: null, username: 'System' } }) => {
  const now = new Date();
  const events = await dbAll(`SELECT * FROM CalendarEvents WHERE status='active' AND reminder_minutes IS NOT NULL AND TRIM(reminder_minutes) != '' AND datetime(start_datetime) >= datetime('now', '-7 days') AND datetime(start_datetime) <= datetime('now', '+30 days')`);
  let sent = 0;
  for (const event of events) {
    const start = new Date(event.start_datetime);
    for (const mins of parseReminderMinutes(event.reminder_minutes)) {
      const due = new Date(start.getTime() - mins * 60000);
      if (due > now || due < new Date(now.getTime() - 10 * 60000)) continue;
      const key = `${mins === 0 ? 'event_start' : `${mins}minutes_before`}:${event.start_datetime}`;
      const recipients = uniqueIds([event.owner_user_id, ...(await calendarRecipientsForEvent(event.id))]);
      for (const userId of recipients) {
        try {
          await dbRun(`INSERT INTO CalendarEventReminderLogs (event_id, user_id, reminder_key) VALUES (?, ?, ?)`, [event.id, userId, key]);
        } catch (e) {
          continue;
        }
        notifyCalendarUsers({ req, event, recipients: [userId], type: 'calendar_event_reminder', message: `Reminder: ${event.title} starts ${formatCalendarReminderLead(mins)}.`, alertKeyBase: `calendar_event_reminder:${event.id}:${userId}:${key}`, cooldownMinutes: 0 });
        sent++;
      }
    }
  }
  return sent;
};

app.post('/api/calendar/reminders/run', requireCalendarView, __routeController122);

app.get('/api/calendar/my-schedules', requireCalendarView, __routeController123);

app.get('/api/dashboard/my-schedules', requireCalendarView, __routeController124);

setInterval(() => {
  runCalendarReminders().catch(err => console.error('Calendar reminder sweep failed:', err));
}, 5 * 60 * 1000);

app.get('/api/calendar/dues', __routeController125);

// API endpoint for calendar details modal
app.get('/api/calendar/details', __routeController126);

app.get('/api/calendar/summary', __routeController127);
