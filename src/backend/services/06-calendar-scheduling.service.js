// Calendar scheduling uses existing events and authorization; private titles never leak.
const calendarScheduleError = message => Object.assign(new Error(message), { statusCode: 400 });
const requireCalendarScheduling = async (req,res,next) => {
  try { for(const privilege of ['create_calendar_event','edit_own_calendar_event','schedule_monitoring_visit'])if(await userHasPrivilegeAsync(req.user,privilege))return next();return forbidden(res); }
  catch { return res.status(500).json({error:'Unable to check scheduling permission.'}); }
};

const calendarValidateMetadata = body => {
  if(body.status!==undefined&&!['active','completed','cancelled','archived'].includes(body.status))throw calendarScheduleError('Choose a valid activity status.');
  if(body.priority!==undefined&&!['low','normal','high','urgent'].includes(body.priority))throw calendarScheduleError('Choose a valid priority.');
  if(body.meeting_link){let url;try{url=new URL(body.meeting_link);}catch{throw calendarScheduleError('Enter a valid meeting URL.');}if(!['https:','http:'].includes(url.protocol))throw calendarScheduleError('Meeting links must use HTTP or HTTPS.');}
  if(body.title!==undefined&&!String(body.title).trim())throw calendarScheduleError('Title is required.');
  if(Array.isArray(body.reminder_minutes)&&body.reminder_minutes.some(value=>!Number.isInteger(value)||value<0||value>525600))throw calendarScheduleError('Reminders must be whole minutes from 0 to 525600.');
};

const calendarScheduleInput = body => {
  const start = parseManualDueDateInput(body.start_datetime);
  const end = body.end_datetime ? parseManualDueDateInput(body.end_datetime) : new Date(start.getTime() + 3600000);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw calendarScheduleError('End time must be after start time.');
  const ids = uniqueIds(body.participant_user_ids || []);
  if (ids.length > 200 || ids.some(id => !Number.isInteger(id) || id <= 0)) throw calendarScheduleError('Invalid participants.');
  return { start, end, ids };
};

const calendarScheduleConflicts = async (req, body) => {
  const { start, end, ids } = calendarScheduleInput(body);
  if (!ids.length) return [];
  const users = await dbAll(`SELECT id FROM Users WHERE id IN (${ids.map(() => '?').join(',')}) AND role != 'system' AND COALESCE(hidden_from_workflows,0)=0`, ids);
  if (users.length !== ids.length) throw calendarScheduleError('One or more participants are unavailable for assignment.');
  const rows = await dbAll(`SELECT ce.*, cp.user_id, u.username,
    (SELECT user_id FROM CalendarEventParticipants WHERE event_id=ce.id AND user_id=?) AS participant_user_id
    FROM CalendarEvents ce JOIN CalendarEventParticipants cp ON cp.event_id=ce.id JOIN Users u ON u.id=cp.user_id
    WHERE cp.user_id IN (${ids.map(() => '?').join(',')}) AND ce.id != ?
    AND COALESCE(ce.status,'active')='active' AND cp.response_status NOT IN ('declined','had_prior_schedule')
    AND datetime(ce.start_datetime) < datetime(?)
    AND datetime(COALESCE(ce.end_datetime, datetime(ce.start_datetime,'+1 hour'))) > datetime(?)`,
  [req.user.id, ...ids, Number(body.exclude_event_id || 0), end.toISOString(), start.toISOString()]);
  const conflicts = [];
  for (const row of rows) {
    const visible = await canViewCalendarEvent(req.user, row);
    conflicts.push({ user_id: row.user_id, username: row.username, title: visible ? row.title : 'Busy (private activity)', start: row.start_datetime, end: row.end_datetime, event_id: visible ? row.id : null });
  }
  return conflicts;
};

const calendarCheckBeforeSave = async (req, res, body, eventId = 0) => {
  calendarValidateMetadata(body);
  if(body.related_inventory_id!==undefined){
    const previous=eventId ? await dbGet('SELECT related_inventory_id FROM CalendarEvents WHERE id=?',[eventId]) : null;
    if(Number(previous?.related_inventory_id||0)!==Number(body.related_inventory_id||0)){
      if(!(await userHasPrivilegeAsync(req.user,'schedule_monitoring_visit')))throw Object.assign(new Error('Permission required to change monitoring links.'),{statusCode:403});
      if(body.related_inventory_id && !(await dbGet("SELECT id FROM MonitoringInventory WHERE id=? AND lifecycle_status!='Archived'",[Number(body.related_inventory_id)])))throw calendarScheduleError('Choose an active monitoring inventory record.');
    }
  }
  const conflicts = await calendarAllScheduleConflicts(req, { ...body, exclude_event_id: eventId });
  if (conflicts.length && body.acknowledge_conflicts !== true) {
    res.status(409).json({ error: 'Schedule conflict. Review the affected participants before proceeding.', conflicts });
    return false;
  }
  return true;
};

const calendarAllScheduleConflicts = async (req, body) => {
  const conflicts=[];
  if (['future','series'].includes(body.series_scope)) {
    const event=await getCalendarEventFull(Number(body.exclude_event_id));
    if(!event || !(await canEditCalendarEvent(req.user,event)))throw Object.assign(new Error('Permission denied'),{statusCode:403});
    const rows=await dbAll('SELECT * FROM CalendarEvents WHERE series_id=? AND (? = ? OR recurrence_index>=?)',[event.series_id,body.series_scope,'series',event.recurrence_index]);
    const {start,end}=calendarScheduleInput(body),delta=+start-+new Date(event.start_datetime),duration=end-start;
    for(const row of rows){const nextStart=new Date(+new Date(row.start_datetime)+delta);conflicts.push(...await calendarScheduleConflicts(req,{...body,start_datetime:nextStart.toISOString(),end_datetime:new Date(+nextStart+duration).toISOString(),exclude_event_id:row.id}));}
    return conflicts.filter(c=>!rows.some(row=>row.id===c.event_id));
  }
  for(const window of calendarRepeatWindows(body)) conflicts.push(...await calendarScheduleConflicts(req,{...body,start_datetime:window.start.toISOString(),end_datetime:window.end.toISOString()}));
  return conflicts;
};

const calendarAvailableSlots = async (req, body) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(body.through || '')) throw calendarScheduleError('Choose a valid date range.');
  const from = new Date(`${body.from}T00:00:00+08:00`);
  const through = new Date(`${body.through}T00:00:00+08:00`);
  const days = (through - from) / 86400000;
  const duration = Number(body.duration);
  const time = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0,2)) * 60 + Number(value.slice(3)) : NaN;
  const workStart = time(body.work_start), workEnd = time(body.work_end);
  if (!Number.isInteger(days) || days < 0 || days > 30 || !Number.isInteger(duration) || duration < 15 || duration > 720 || !Number.isFinite(workStart) || !Number.isFinite(workEnd) || workEnd <= workStart) throw calendarScheduleError('Use up to 31 days, a duration of 15–720 minutes, and valid working hours.');
  if (!Array.isArray(body.participant_user_ids) || !body.participant_user_ids.length) throw calendarScheduleError('Select at least one participant first.');
  const busy = await calendarScheduleConflicts(req, { ...body, start_datetime: from.toISOString(), end_datetime: new Date(+through + 86400000).toISOString() });
  const slots = [];
  for (let day = 0; day <= days && slots.length < 40; day++) {
    for (let minute = workStart; minute + duration <= workEnd && slots.length < 40; minute += 30) {
      if (body.preference === 'morning' && minute + duration > 720 || body.preference === 'afternoon' && minute < 720) continue;
      const start = new Date(+from + day * 86400000 + minute * 60000);
      const end = new Date(+start + duration * 60000);
      if (busy.some(b => new Date(b.start) < end && new Date(b.end || +new Date(b.start) + 3600000) > start)) continue;
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }
  return slots;
};
