// Controllers extracted from src/backend/routes/06-calendar.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController101 = async (req, res) => {
  try {
    const range = getCalendarRange(req);
    const scope = normalizeCalendarScope(req.query.scope || 'abe');
    const includeProjectDues = req.query.include_project_dues !== '0';
    const includeManualEvents = req.query.include_manual_events !== '0';
    const typeFilter = calendarTypeFilterKey(req.query.event_type || '');
    const search = String(req.query.search || '').trim().toLowerCase();
    const selectedUserIds = parseCalendarUserFilterIds(req.query.user_ids || req.query.participant_user_ids || '');
    const personnelFilterActive = selectedUserIds.length > 0 || String(req.query.personnel_filter || '') === '1';
    const systemScope = selectedUserIds.length && scope === 'my_project_deadlines'
      ? 'project_deadlines'
      : selectedUserIds.length && scope === 'my'
        ? 'abe'
        : scope;
    const events = [];
    if (includeProjectDues) events.push(...await collectSystemCalendarEvents(req, range, systemScope));
    if (includeManualEvents && !['project_deadlines', 'my_project_deadlines'].includes(scope) && typeFilter !== 'project_deadlines') {
      let scopedTypeFilter = MANUAL_CALENDAR_EVENT_TYPES.has(typeFilter) ? typeFilter : '';
      if (['meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey', 'site_validation', 'site_geotagging', 'monitoring', 'maintenance', 'leave', 'other'].includes(scope)) scopedTypeFilter = scope;
      if (scope === 'my_meetings') scopedTypeFilter = 'meeting';
      if (scope === 'followups') scopedTypeFilter = 'document_follow_up';
      const visibilityScope = ['abed_wide', 'personal', 'participants'].includes(scope) ? scope : '';
      const wideCalendarAccess = scope === 'abe' && await canViewAbeCalendarWide(req.user);
      const selectedPersonnelAccess = personnelFilterActive && await canViewAbeCalendarWide(req.user);
      const rows = await dbAll(`
        SELECT DISTINCT ce.*, ou.username as owner_username, p.name as related_project_name, d.document_type_name as related_document_name,
               me.user_id as participant_user_id
        FROM CalendarEvents ce
        LEFT JOIN CalendarEventParticipants me ON me.event_id = ce.id AND me.user_id = ?
        LEFT JOIN Users ou ON ou.id = ce.owner_user_id
        LEFT JOIN Projects p ON p.id = ce.related_project_id
        LEFT JOIN Documents d ON d.id = ce.related_document_id
        WHERE COALESCE(ce.status, 'active') != 'archived'
          AND datetime(COALESCE(ce.end_datetime, ce.start_datetime)) >= datetime(?)
          AND datetime(ce.start_datetime) <= datetime(?)
          AND (? = 1 OR me.user_id IS NOT NULL)
          AND (? = '' OR (? = 'abed_wide' AND ce.visibility IN ('abed_wide', 'division', 'global')) OR ce.visibility = ?)
          AND (? = '' OR ce.event_type = ?)
          AND (? IS NULL OR ce.related_project_id = ?)
      `, [req.user.id, range.startISO, range.endISO, (wideCalendarAccess || selectedPersonnelAccess) ? 1 : 0, visibilityScope, visibilityScope, visibilityScope, scopedTypeFilter, scopedTypeFilter, req.query.project_id ? Number(req.query.project_id) : null, req.query.project_id ? Number(req.query.project_id) : null]);
      for (const row of rows) {
        const full = await getCalendarEventFull(row.id);
        if (!full) continue;
        if (!personnelFilterActive && (scope === 'my' || scope === 'my_meetings') && !full.participants.some(p => Number(p.user_id) === Number(req.user.id))) continue;
        if (!(await canViewCalendarEvent(req.user, { ...full, participant_user_id: row.participant_user_id }))) continue;
        if (search) {
          const docSearchRows = await dbAll(`
            SELECT title || ' ' || content as text FROM CalendarEventNotes WHERE event_id = ?
            UNION ALL
            SELECT original_name as text FROM CalendarEventAttachments WHERE event_id = ?
          `, [full.id, full.id]).catch(() => []);
          full.documentation_search_text = (docSearchRows || []).map(r => r.text || '').join(' ');
        }
        events.push(await normalizeManualCalendarEvent(req, full));
      }
    }
    let result = events;
    if (selectedUserIds.length) {
      result = result.filter(ev => calendarEventInvolvesAnyUser(ev, selectedUserIds));
    }
    if (typeFilter) {
      result = result.filter(ev => {
        if (typeFilter === 'project_deadlines') return ['document_due', 'project_due', 'pending_due_rollup'].includes(ev.source);
        if (typeFilter === 'document_review') return ev.source === 'document_review' || normalizeCalendarType(ev.event_type) === 'document_review';
        if (typeFilter === 'cancelled') return String(ev.status || '').toLowerCase() === 'cancelled';
        return normalizeCalendarType(ev.event_type) === typeFilter || ev.event_type === typeFilter;
      });
    }
    if (search) {
      result = result.filter(ev => [ev.title, ev.description, ev.location, ev.project_name, ev.document_name, ev.event_type, ev.event_type_detail, ev.documentation_search_text, ...(ev.participants || []).map(p => p.username)].join(' ').toLowerCase().includes(search));
    }
    result.sort((a, b) => new Date(a.start) - new Date(b.start));
    res.json({ events: result });
  } catch (err) {
    console.error('Unified calendar events error:', err);
    res.status(500).json({ error: 'Failed to load calendar events' });
  }
};

const __routeController102 = async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const start = parseManualDueDateInput(body.start_datetime);
    if (isNaN(start.getTime())) return res.status(400).json({ error: 'Valid start date is required' });
    const end = body.end_datetime ? parseManualDueDateInput(body.end_datetime) : null;
    if (end && (isNaN(end.getTime()) || end < start)) return res.status(400).json({ error: 'End date must not be earlier than start date' });
    const eventType = assertManualCalendarType(body.event_type);
    const eventTypeDetail = normalizeCalendarTypeDetail(eventType, body.event_type_detail);
    const visibility = body.visibility ? assertManualCalendarVisibility(body.visibility) : (eventType === 'personal' ? 'personal' : 'participants');
    const ownerUserId = Number(body.owner_user_id || req.user.id);
    const participants = uniqueIds(Array.isArray(body.participant_user_ids) ? body.participant_user_ids : []);
    if (eventType === 'personal' && participants.length > 1) return res.status(400).json({ error: 'Personal schedules allow one involved user only.' });
    if (participants.length) {
      const found = await dbAll(`
        SELECT id FROM Users
        WHERE id IN (${participants.map(() => '?').join(',')})
          AND role != 'system'
          AND COALESCE(hidden_from_workflows, 0) = 0
      `, participants);
      if (found.length !== participants.length) return res.status(400).json({ error: 'One or more participants do not exist' });
    }
    let relatedProjectId = body.related_project_id ? Number(body.related_project_id) : null;
    if (relatedProjectId && !(await dbGet(`SELECT id FROM Projects WHERE id = ?`, [relatedProjectId]))) return res.status(400).json({ error: 'Related project not found' });
    if (body.related_document_id) {
      const doc = await dbGet(`SELECT id, project_id FROM Documents WHERE id = ?`, [Number(body.related_document_id)]);
      if (!doc) return res.status(400).json({ error: 'Related document not found' });
      if (!relatedProjectId) relatedProjectId = Number(doc.project_id);
    }
    const reminderMinutes = Array.isArray(body.reminder_minutes) ? JSON.stringify(body.reminder_minutes.map(Number).filter(n => Number.isFinite(n) && n >= 0)) : String(body.reminder_minutes || '');
    const insert = await dbRun(`INSERT INTO CalendarEvents (title, description, location, start_datetime, end_datetime, all_day, event_type, event_type_detail, visibility, owner_user_id, related_project_id, related_document_id, color, reminder_minutes, recurrence_rule, status, created_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`, [
      title, String(body.description || '').trim(), String(body.location || '').trim(), start.toISOString(), end ? end.toISOString() : null, 0, eventType, eventTypeDetail, visibility, ownerUserId, relatedProjectId, body.related_document_id ? Number(body.related_document_id) : null, body.color || CALENDAR_TYPE_COLORS[eventType], reminderMinutes, String(body.recurrence_rule || '').trim(), req.user.id, new Date().toISOString()
    ]);
    const eventId = insert.lastID;
    for (const userId of participants) {
      const isCreatorParticipant = Number(userId) === Number(req.user.id);
      await dbRun(`INSERT OR IGNORE INTO CalendarEventParticipants (event_id, user_id, role, response_status, notified_at) VALUES (?, ?, 'participant', ?, ?)`, [
        eventId,
        userId,
        isCreatorParticipant ? 'accepted' : 'pending',
        isCreatorParticipant ? null : new Date().toISOString()
      ]);
    }
    const event = await getCalendarEventFull(eventId);
    const notifyRecipients = participants.filter(id => Number(id) !== Number(req.user.id));
    if (notifyRecipients.length) notifyCalendarUsers({ req, event, recipients: notifyRecipients, type: 'calendar_event_created', message: `You have been added to a schedule: ${title}.`, alertKeyBase: `calendar_event_created:${eventId}` });
    auditCalendarEvent(eventId, req, 'CALENDAR_EVENT_CREATED', title);
    logActivity({ req, action: 'CALENDAR_EVENT_CREATED', projectId: event.related_project_id, project: event.related_project_name || '', docType: event.related_document_name || '-', details: `Calendar event created: ${title}` });
    res.status(201).json({ success: true, event: await normalizeManualCalendarEvent(req, event) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Calendar create error:', err);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
};

const __routeController103 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    const participant = event.participants.find(p => Number(p.user_id) === Number(req.user.id));
    if (!(await canViewCalendarEvent(req.user, { ...event, participant_user_id: participant?.user_id }))) return forbidden(res);
    const normalized = await normalizeManualCalendarEvent(req, event);
    normalized.audit = await dbAll(`SELECT al.*, u.username FROM CalendarEventAuditLogs al LEFT JOIN Users u ON u.id = al.actor_user_id WHERE al.event_id = ? ORDER BY al.created_at DESC LIMIT 25`, [event.id]);
    res.json({ event: normalized });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load calendar event' });
  }
};

const __routeController104 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canEditCalendarEvent(req.user, event))) return forbidden(res, 'Permission denied');
    const body = req.body || {};
    const title = String(body.title ?? event.title).trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const start = body.start_datetime ? parseManualDueDateInput(body.start_datetime) : new Date(event.start_datetime);
    const endFieldProvided = Object.prototype.hasOwnProperty.call(body, 'end_datetime');
    const end = endFieldProvided
      ? (body.end_datetime ? parseManualDueDateInput(body.end_datetime) : null)
      : (event.end_datetime ? new Date(event.end_datetime) : null);
    if (isNaN(start.getTime())) return res.status(400).json({ error: 'Valid start date is required' });
    if (end && (isNaN(end.getTime()) || end < start)) return res.status(400).json({ error: 'End date must not be earlier than start date' });
    const eventType = assertManualCalendarType(body.event_type || event.event_type);
    const eventTypeDetail = normalizeCalendarTypeDetail(eventType, body.event_type_detail ?? event.event_type_detail);
    const visibility = body.visibility !== undefined ? assertManualCalendarVisibility(body.visibility || event.visibility) : (event.visibility || (eventType === 'personal' ? 'personal' : 'participants'));
    if (eventType === 'personal' && Array.isArray(body.participant_user_ids) && uniqueIds(body.participant_user_ids).length > 1) return res.status(400).json({ error: 'Personal schedules allow one involved user only.' });
    const importantChanged = title !== event.title || start.toISOString() !== new Date(event.start_datetime).toISOString() || (end ? end.toISOString() : null) !== (event.end_datetime ? new Date(event.end_datetime).toISOString() : null) || String(body.location ?? event.location ?? '') !== String(event.location ?? '') || visibility !== event.visibility || eventType !== normalizeCalendarType(event.event_type) || eventTypeDetail !== String(event.event_type_detail || '');
    let relatedProjectId = event.related_project_id || null;
    if (body.related_project_id !== undefined) relatedProjectId = body.related_project_id !== '' && body.related_project_id !== null ? Number(body.related_project_id) : null;
    let relatedDocumentId = event.related_document_id || null;
    if (body.related_document_id !== undefined) relatedDocumentId = body.related_document_id !== '' && body.related_document_id !== null ? Number(body.related_document_id) : null;
    if (relatedDocumentId && !relatedProjectId) {
      const doc = await dbGet(`SELECT project_id FROM Documents WHERE id = ?`, [relatedDocumentId]);
      if (doc) relatedProjectId = Number(doc.project_id);
    }
    const eventColor = body.color || (eventType === normalizeCalendarType(event.event_type) ? event.color : null) || CALENDAR_TYPE_COLORS[eventType];
    await dbRun(`UPDATE CalendarEvents SET title=?, description=?, location=?, start_datetime=?, end_datetime=?, all_day=?, event_type=?, event_type_detail=?, visibility=?, related_project_id=?, related_document_id=?, color=?, reminder_minutes=?, recurrence_rule=?, status=?, updated_at=? WHERE id=?`, [
      title, String(body.description ?? event.description ?? '').trim(), String(body.location ?? event.location ?? '').trim(), start.toISOString(), end ? end.toISOString() : null, 0, eventType, eventTypeDetail, visibility, relatedProjectId, relatedDocumentId, eventColor, Array.isArray(body.reminder_minutes) ? JSON.stringify(body.reminder_minutes) : String(body.reminder_minutes ?? event.reminder_minutes ?? ''), String(body.recurrence_rule ?? event.recurrence_rule ?? '').trim(), String(body.status || event.status || 'active'), new Date().toISOString(), event.id
    ]);
    let participantSpecificNotificationsSent = false;
    if (Array.isArray(body.participant_user_ids)) {
      const nextIds = new Set(uniqueIds(body.participant_user_ids).map(Number));
      const currentIds = event.participants.map(p => Number(p.user_id));
      for (const id of currentIds.filter(id => !nextIds.has(id))) {
        await dbRun(`DELETE FROM CalendarEventParticipants WHERE event_id=? AND user_id=?`, [event.id, id]);
        notifyCalendarUsers({ req, event, recipients: [id], type: 'calendar_participant_removed', message: `You have been removed from the schedule: ${event.title}.`, alertKeyBase: `calendar_participant_removed:${event.id}:${id}` });
        participantSpecificNotificationsSent = true;
      }
      for (const id of [...nextIds].filter(id => !currentIds.includes(Number(id)))) {
        const isCreatorParticipant = Number(id) === Number(event.created_by_user_id);
        await dbRun(`INSERT OR IGNORE INTO CalendarEventParticipants (event_id, user_id, role, response_status, notified_at) VALUES (?, ?, 'participant', ?, ?)`, [
          event.id,
          id,
          isCreatorParticipant ? 'accepted' : 'pending',
          isCreatorParticipant ? null : new Date().toISOString()
        ]);
        if (!isCreatorParticipant) {
          notifyCalendarUsers({ req, event, recipients: [id], type: 'calendar_participant_added', message: `You have been added to a schedule: ${title}.`, alertKeyBase: `calendar_participant_added:${event.id}:${id}` });
          participantSpecificNotificationsSent = true;
        }
      }
      if (nextIds.has(Number(event.created_by_user_id))) {
        await dbRun(`UPDATE CalendarEventParticipants SET response_status='accepted' WHERE event_id=? AND user_id=?`, [event.id, event.created_by_user_id]);
      }
    }
    const updated = await getCalendarEventFull(event.id);
    await syncMonitoringInventoryScheduleFromCalendar(updated, { removed: String(updated.status || 'active').toLowerCase() !== 'active' || String(updated.event_type || '').toLowerCase() !== 'monitoring' });
    if (importantChanged && !participantSpecificNotificationsSent) {
      const recipients = (await calendarRecipientsForEvent(event.id)).filter(id => Number(id) !== Number(req.user.id));
      notifyCalendarUsers({ req, event: updated, recipients, type: 'calendar_event_updated', message: `Schedule updated: ${title}.`, alertKeyBase: `calendar_event_updated:${event.id}`, cooldownMinutes: 10 });
    }
    auditCalendarEvent(event.id, req, 'CALENDAR_EVENT_UPDATED', title);
    logActivity({ req, action: 'CALENDAR_EVENT_UPDATED', projectId: updated.related_project_id, project: updated.related_project_name || '', docType: updated.related_document_name || '-', details: `Calendar event updated: ${title}` });
    res.json({ success: true, event: await normalizeManualCalendarEvent(req, updated) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Calendar update error:', err);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
};

const __routeController105 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canCancelCalendarEvent(req.user, event))) return forbidden(res, 'Permission denied');
    await dbRun(`UPDATE CalendarEvents SET status='cancelled', updated_at=? WHERE id=?`, [new Date().toISOString(), event.id]);
    await syncMonitoringInventoryScheduleFromCalendar(event, { removed: true });
    const recipients = (await calendarRecipientsForEvent(event.id)).filter(id => Number(id) !== Number(req.user.id));
    notifyCalendarUsers({ req, event, recipients, type: 'calendar_event_cancelled', message: `Schedule cancelled: ${event.title}.`, alertKeyBase: `calendar_event_cancelled:${event.id}` });
    auditCalendarEvent(event.id, req, 'CALENDAR_EVENT_CANCELLED', event.title);
    logActivity({ req, action: 'CALENDAR_EVENT_CANCELLED', projectId: event.related_project_id, project: event.related_project_name || '', docType: event.related_document_name || '-', details: `Calendar event cancelled: ${event.title}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel calendar event' });
  }
};

const __routeController106 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canDeleteCalendarEvent(req.user, event))) return forbidden(res, 'Only the schedule creator with delete privilege can delete this schedule.');
    const attachments = await dbAll(`SELECT file_path FROM CalendarEventAttachments WHERE event_id = ?`, [event.id]);
    await dbRun("BEGIN TRANSACTION");
    try {
      await dbRun("DELETE FROM CalendarEventReminderLogs WHERE event_id = ?", [event.id]);
      await dbRun("DELETE FROM CalendarEventParticipants WHERE event_id = ?", [event.id]);
      await dbRun("DELETE FROM CalendarEventAttachments WHERE event_id = ?", [event.id]);
      await dbRun("DELETE FROM CalendarEventNotes WHERE event_id = ?", [event.id]);
      await dbRun("DELETE FROM CalendarEventAuditLogs WHERE event_id = ?", [event.id]);
      await dbRun("DELETE FROM CalendarEvents WHERE id = ?", [event.id]);
      await dbRun("COMMIT");
    } catch (err) {
      await dbRun("ROLLBACK").catch(() => {});
      throw err;
    }
    await syncMonitoringInventoryScheduleFromCalendar(event, { removed: true });
    attachments.forEach(a => {
      const filePath = safeCalendarAttachmentPath(a.file_path);
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
        cleanEmptyCalendarAttachmentFolders(filePath).catch(() => {});
      }
    });
    try { logActivity({ req, action: 'CALENDAR_EVENT_DELETED', projectId: event.related_project_id, project: event.related_project_name || '', docType: event.related_document_name || '-', details: `Calendar event permanently deleted: ${event.title}` }); } catch(e) {}
    res.json({ success: true });
  } catch (err) {
    logError('DELETE_CALENDAR_EVENT_PERMANENT', err.message, err.stack);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
};

const __routeController107 = async (req, res) => {
  try {
    const status = String(req.body?.response_status || '').toLowerCase();
    if (!CALENDAR_ACTIVE_RESPONSE_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid response status' });
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    const participant = event.participants.find(p => Number(p.user_id) === Number(req.user.id));
    if (Number(event.created_by_user_id) === Number(req.user.id)) {
      return forbidden(res, 'Schedule creators do not respond to their own invitations');
    }
    if (!participant || !['participant', 'optional'].includes(String(participant.role || '').toLowerCase()) || String(event.status || 'active') !== 'active' || calendarEventHasPassed(event)) {
      return forbidden(res, 'Only invited participants can respond');
    }
    if (String(participant.response_status || 'pending').toLowerCase() === status) {
      return res.json({ success: true, event_id: event.id, response_status: status });
    }
    await dbRun(`UPDATE CalendarEventParticipants SET response_status=? WHERE event_id=? AND user_id=?`, [status, event.id, req.user.id]);
    const responseLabel = status === 'accepted' ? 'Accepted' : 'Had Prior Schedule';
    const activityDetails = status === 'accepted' ? 'Accepted schedule invitation.' : 'Marked schedule invitation as Had Prior Schedule.';
    notifyCalendarUsers({ req, event, recipients: [event.owner_user_id], type: 'calendar_response_received', message: `${req.user.username} responded “${responseLabel}” to your schedule invitation.`, alertKeyBase: `calendar_response:${event.id}:${req.user.id}`, cooldownMinutes: 1440 });
    auditCalendarEvent(event.id, req, 'CALENDAR_RESPONSE_UPDATED', status);
    logActivity({ req, action: 'CALENDAR_RESPONSE_UPDATED', projectId: event.related_project_id, project: event.related_project_name || '', docType: event.related_document_name || '-', details: activityDetails });
    res.json({ success: true, event_id: event.id, response_status: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update response' });
  }
};

const __routeController108 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canEditCalendarEvent(req.user, event))) return forbidden(res, 'Permission denied');
    const ids = uniqueIds(Array.isArray(req.body?.user_ids) ? req.body.user_ids : []);
    const current = new Set(event.participants.map(p => Number(p.user_id)));
    const added = [];
    for (const id of ids.filter(id => !current.has(Number(id)))) {
      const isCreatorParticipant = Number(id) === Number(event.created_by_user_id);
      await dbRun(`INSERT OR IGNORE INTO CalendarEventParticipants (event_id, user_id, role, response_status, notified_at) VALUES (?, ?, 'participant', ?, ?)`, [
        event.id,
        id,
        isCreatorParticipant ? 'accepted' : 'pending',
        isCreatorParticipant ? null : new Date().toISOString()
      ]);
      added.push(id);
    }
    added
      .filter(id => Number(id) !== Number(event.created_by_user_id))
      .forEach(id => notifyCalendarUsers({ req, event, recipients: [id], type: 'calendar_participant_added', message: `You have been added to a schedule: ${event.title}.`, alertKeyBase: `calendar_participant_added:${event.id}:${id}` }));
    auditCalendarEvent(event.id, req, 'CALENDAR_PARTICIPANT_ADDED', added.join(','));
    res.json({ success: true, added });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add participants' });
  }
};

const __routeController109 = async (req, res) => {
  try {
    const event = await getCalendarEventFull(Number(req.params.id));
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canEditCalendarEvent(req.user, event))) return forbidden(res, 'Permission denied');
    const userId = Number(req.params.userId);
    if (Number(userId) === Number(event.owner_user_id)) return res.status(400).json({ error: 'Cannot remove event owner' });
    await dbRun(`DELETE FROM CalendarEventParticipants WHERE event_id=? AND user_id=?`, [event.id, userId]);
    notifyCalendarUsers({ req, event, recipients: [userId], type: 'calendar_participant_removed', message: `You have been removed from the schedule: ${event.title}.`, alertKeyBase: `calendar_participant_removed:${event.id}:${userId}` });
    auditCalendarEvent(event.id, req, 'CALENDAR_PARTICIPANT_REMOVED', String(userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove participant' });
  }
};

const __routeController110 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const notes = await dbAll(`
      SELECT n.*, cu.username as created_by_username, uu.username as updated_by_username, fu.username as finalized_by_username
      FROM CalendarEventNotes n
      LEFT JOIN Users cu ON cu.id = n.created_by_user_id
      LEFT JOIN Users uu ON uu.id = n.updated_by_user_id
      LEFT JOIN Users fu ON fu.id = n.finalized_by_user_id
      WHERE n.event_id = ?
      ORDER BY datetime(n.updated_at || n.created_at) DESC, n.id DESC
    `, [access.event.id]);
    res.json({ notes, can_add: access.canAddDocumentation });
  } catch (err) {
    console.error('Calendar notes list error:', err);
    res.status(500).json({ error: 'Failed to load schedule notes' });
  }
};

const __routeController111 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canAddDocumentation) return forbidden(res, 'Permission denied');
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!title && !content) return res.status(400).json({ error: 'Note title or content is required' });
    const requestedType = String(req.body?.note_type || calendarNoteTypeForEvent(access.event.event_type));
    const noteType = CALENDAR_NOTE_TYPES.has(requestedType) ? requestedType : calendarNoteTypeForEvent(access.event.event_type);
    const now = new Date().toISOString();
    const result = await dbRun(`INSERT INTO CalendarEventNotes (event_id, note_type, title, content, created_by_user_id, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [access.event.id, noteType, title, content, req.user.id, req.user.id, now]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_NOTE_CREATED', title || noteType);
    logActivity({ req, action: 'CALENDAR_NOTE_CREATED', projectId: access.event.related_project_id, project: access.event.related_project_name || '', docType: access.event.related_document_name || '-', details: `Schedule note added: ${access.event.title}` });
    const note = await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, note });
  } catch (err) {
    console.error('Calendar note create error:', err);
    res.status(500).json({ error: 'Failed to save schedule note' });
  }
};

const __routeController112 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const note = await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ? AND event_id = ?`, [Number(req.params.noteId), access.event.id]);
    if (!note) return res.status(404).json({ error: 'Schedule note not found' });
    if (Number(note.is_final || 0) === 1) return forbidden(res, 'Finalized notes are read-only');
    if (!(await canModifyCalendarDocumentation(req, access.event, note))) return forbidden(res, 'Permission denied');
    const title = String(req.body?.title ?? note.title ?? '').trim();
    const content = String(req.body?.content ?? note.content ?? '').trim();
    if (!title && !content) return res.status(400).json({ error: 'Note title or content is required' });
    const now = new Date().toISOString();
    await dbRun(`UPDATE CalendarEventNotes SET title=?, content=?, updated_by_user_id=?, updated_at=? WHERE id=? AND event_id=?`, [title, content, req.user.id, now, note.id, access.event.id]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_NOTE_UPDATED', title || note.note_type);
    res.json({ success: true, note: await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ?`, [note.id]) });
  } catch (err) {
    console.error('Calendar note update error:', err);
    res.status(500).json({ error: 'Failed to update schedule note' });
  }
};

const __routeController113 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const note = await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ? AND event_id = ?`, [Number(req.params.noteId), access.event.id]);
    if (!note) return res.status(404).json({ error: 'Schedule note not found' });
    if (Number(note.is_final || 0) === 1) return forbidden(res, 'Finalized notes cannot be deleted');
    if (!(await canModifyCalendarDocumentation(req, access.event, note))) return forbidden(res, 'Permission denied');
    await dbRun(`DELETE FROM CalendarEventNotes WHERE id=? AND event_id=?`, [note.id, access.event.id]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_NOTE_DELETED', note.title || note.note_type);
    res.json({ success: true });
  } catch (err) {
    console.error('Calendar note delete error:', err);
    res.status(500).json({ error: 'Failed to delete schedule note' });
  }
};

const __routeController114 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!(await canEditCalendarEvent(req.user, access.event)) && req.user.role !== 'superadmin') return forbidden(res, 'Permission denied');
    const note = await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ? AND event_id = ?`, [Number(req.params.noteId), access.event.id]);
    if (!note) return res.status(404).json({ error: 'Schedule note not found' });
    if (Number(note.is_final || 0) === 1) return res.status(400).json({ error: 'This note is already finalized.' });
    await dbRun(`UPDATE CalendarEventNotes SET is_final=1, finalized_by_user_id=?, finalized_at=?, updated_by_user_id=?, updated_at=? WHERE id=? AND event_id=?`, [req.user.id, new Date().toISOString(), req.user.id, new Date().toISOString(), note.id, access.event.id]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_NOTE_FINALIZED', note.title || note.note_type);
    res.json({ success: true, note: await dbGet(`SELECT * FROM CalendarEventNotes WHERE id = ?`, [note.id]) });
  } catch (err) {
    console.error('Calendar note finalize error:', err);
    res.status(500).json({ error: 'Failed to finalize schedule note' });
  }
};

const __routeController115 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const note = await dbGet(`
      SELECT n.*, cu.username as created_by_username, fu.username as finalized_by_username
      FROM CalendarEventNotes n
      LEFT JOIN Users cu ON cu.id = n.created_by_user_id
      LEFT JOIN Users fu ON fu.id = n.finalized_by_user_id
      WHERE n.id = ? AND n.event_id = ?
    `, [Number(req.params.noteId), access.event.id]);
    if (!note) return res.status(404).json({ error: 'Schedule note not found' });
    if (Number(note.is_final || 0) !== 1) return forbidden(res, 'Only finalized notes can be downloaded from this route');
    const fileName = `${(note.title || 'meeting-minutes').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'meeting-minutes'}.txt`;
    const body = [
      `Schedule: ${access.event.title || ''}`,
      `Title: ${note.title || ''}`,
      `Created by: ${note.created_by_username || ''}`,
      `Finalized by: ${note.finalized_by_username || ''}`,
      `Finalized date: ${note.finalized_at || ''}`,
      '',
      note.content || ''
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${contentDispositionFileName(fileName)}"`);
    res.send(body);
  } catch (err) {
    console.error('Calendar note download error:', err);
    res.status(500).json({ error: 'Failed to download finalized note' });
  }
};

const __routeController116 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const attachments = await dbAll(`
      SELECT a.*, u.username as uploaded_by_username
      FROM CalendarEventAttachments a
      LEFT JOIN Users u ON u.id = a.uploaded_by_user_id
      WHERE a.event_id = ?
      ORDER BY datetime(a.uploaded_at) DESC, a.id DESC
    `, [access.event.id]);
    res.json({ attachments: attachments.map(calendarAttachmentPublic), can_add: access.canAddDocumentation });
  } catch (err) {
    console.error('Calendar attachments list error:', err);
    res.status(500).json({ error: 'Failed to load schedule attachments' });
  }
};

const __routeController117 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    if (!access.canAddDocumentation) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return forbidden(res, 'Permission denied');
    }
    if (!req.file) return res.status(400).json({ error: 'Attachment file is required' });
    const requestedType = String(req.body?.attachment_type || 'supporting_file');
    const attachmentType = CALENDAR_ATTACHMENT_TYPES.has(requestedType) ? requestedType : 'supporting_file';
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const { relativePath, fullPath, storedName } = await buildCalendarAttachmentRelativePath(access.event, req.file.originalname);
    await fs.promises.rename(req.file.path, fullPath);
    req.file.path = fullPath;
    const result = await dbRun(`INSERT INTO CalendarEventAttachments (event_id, uploaded_by_user_id, file_name, original_name, file_path, file_type, file_ext, file_size, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      access.event.id, req.user.id, storedName, req.file.originalname, relativePath, req.file.mimetype || calendarAttachmentContentType({ file_ext: fileExt }), fileExt, req.file.size || 0, attachmentType
    ]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_ATTACHMENT_UPLOADED', req.file.originalname);
    logActivity({ req, action: 'CALENDAR_ATTACHMENT_UPLOADED', projectId: access.event.related_project_id, project: access.event.related_project_name || '', docType: access.event.related_document_name || '-', details: `Schedule attachment uploaded: ${req.file.originalname}` });
    res.status(201).json({ success: true, attachment: calendarAttachmentPublic(await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=?`, [result.lastID])) });
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
      cleanEmptyCalendarAttachmentFolders(req.file.path).catch(() => {});
    }
    console.error('Calendar attachment upload error:', err);
    res.status(500).json({ error: 'Failed to upload schedule attachment' });
  }
};

const __routeController118 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const attachment = await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=? AND event_id=?`, [Number(req.params.attachmentId), access.event.id]);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    const filePath = safeCalendarAttachmentPath(attachment.file_path);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Attachment file not found' });
    res.setHeader('Content-Type', calendarAttachmentContentType(attachment));
    res.setHeader('Content-Disposition', `inline; filename="${contentDispositionFileName(attachment.original_name || attachment.file_name)}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Calendar attachment view error:', err);
    res.status(500).json({ error: 'Failed to view schedule attachment' });
  }
};

const __routeController119 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const attachment = await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=? AND event_id=?`, [Number(req.params.attachmentId), access.event.id]);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    const filePath = safeCalendarAttachmentPath(attachment.file_path);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Attachment file not found' });
    res.download(filePath, attachment.original_name || attachment.file_name);
  } catch (err) {
    console.error('Calendar attachment download error:', err);
    res.status(500).json({ error: 'Failed to download schedule attachment' });
  }
};

const __routeController120 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const attachment = await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=? AND event_id=?`, [Number(req.params.attachmentId), access.event.id]);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if (!(await canModifyCalendarDocumentation(req, access.event, attachment))) return forbidden(res, 'Permission denied');
    const ext = calendarAttachmentExtension(attachment);
    if (!CALENDAR_TEXT_ATTACHMENT_EXTENSIONS.has(ext)) return res.status(400).json({ error: 'Only TXT and CSV calendar attachments can be edited in the browser.' });
    const filePath = safeCalendarAttachmentPath(attachment.file_path);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Attachment file not found' });
    const content = String(req.body?.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) return res.status(400).json({ error: 'Text attachment content is too large.' });
    await fs.promises.writeFile(filePath, content, 'utf8');
    const stats = await fs.promises.stat(filePath);
    const now = new Date().toISOString();
    await dbRun(`UPDATE CalendarEventAttachments SET file_size=?, updated_by_user_id=?, updated_at=? WHERE id=? AND event_id=?`, [stats.size, req.user.id, now, attachment.id, access.event.id]);
    auditCalendarEvent(access.event.id, req, 'CALENDAR_ATTACHMENT_UPDATED', attachment.original_name || attachment.file_name);
    res.json({ success: true, attachment: calendarAttachmentPublic(await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=?`, [attachment.id])) });
  } catch (err) {
    console.error('Calendar attachment content update error:', err);
    res.status(500).json({ error: 'Failed to update schedule attachment' });
  }
};

const __routeController121 = async (req, res) => {
  try {
    const access = await getCalendarEventAccess(req, req.params.id);
    if (!access.event) return res.status(404).json({ error: 'Calendar event not found' });
    if (!access.canView) return forbidden(res);
    const attachment = await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id=? AND event_id=?`, [Number(req.params.attachmentId), access.event.id]);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    const bypass = await canBypassAssignmentOwnership(req.user);
    const isUploader = attachment.uploaded_by_user_id && Number(attachment.uploaded_by_user_id) === Number(req.user.id);
    if (!isUploader && !bypass) {
      if (!(access.canEdit || Number(access.event.owner_user_id) === Number(req.user.id))) return forbidden(res, 'Permission denied');
      if (!attachment.uploaded_by_user_id) return forbidden(res, 'Attachment uploader is unknown.');
      const owner = await dbGet(`SELECT id, username FROM Users WHERE id = ?`, [attachment.uploaded_by_user_id]);
      const result = await createDeletionRequest({
        req,
        targetType: 'calendar_attachment',
        targetId: Number(attachment.id),
        projectId: access.event.related_project_id || null,
        documentId: access.event.related_document_id || null,
        ownerUserId: attachment.uploaded_by_user_id,
        ownerUsername: owner?.username || '',
        targetName: `calendar attachment ${attachment.original_name || attachment.file_name}`,
        targetSnapshot: { ...attachment, project_name: access.event.related_project_name, document_type_name: access.event.related_document_name }
      });
      return deletionRequestResponse(res, result);
    }
    await dbRun(`DELETE FROM CalendarEventAttachments WHERE id=? AND event_id=?`, [attachment.id, access.event.id]);
    const filePath = safeCalendarAttachmentPath(attachment.file_path);
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      await cleanEmptyCalendarAttachmentFolders(filePath);
    }
    auditCalendarEvent(access.event.id, req, 'CALENDAR_ATTACHMENT_DELETED', attachment.original_name || attachment.file_name);
    res.json({ success: true });
  } catch (err) {
    console.error('Calendar attachment delete error:', err);
    res.status(500).json({ error: 'Failed to delete schedule attachment' });
  }
};

const __routeController122 = async (req, res) => {
  try {
    const sent = await runCalendarReminders(req);
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run calendar reminders' });
  }
};

const __routeController123 = async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT DISTINCT ce.*, ou.username as owner_username, p.name as related_project_name, p.stage as related_project_stage,
             d.document_type_name as related_document_name, d.stage as related_document_stage,
             dp.stage as document_project_stage,
             me.user_id as participant_user_id, me.response_status as my_response_status, me.role as my_participant_role
      FROM CalendarEvents ce
      JOIN CalendarEventParticipants me ON me.event_id = ce.id AND me.user_id = ?
      LEFT JOIN Users ou ON ou.id = ce.owner_user_id
      LEFT JOIN Projects p ON p.id = ce.related_project_id
      LEFT JOIN Documents d ON d.id = ce.related_document_id
      LEFT JOIN Projects dp ON dp.id = d.project_id
      WHERE ce.status = 'active'
        AND datetime(COALESCE(ce.end_datetime, ce.start_datetime)) >= datetime('now')
      ORDER BY datetime(ce.start_datetime) ASC
      LIMIT 100
    `, [req.user.id]);
    const schedules = [];
    for (const row of rows) {
      const full = await getCalendarEventFull(row.id);
      if (!full) continue;
      schedules.push(await normalizeManualCalendarEvent(req, full));
    }
    res.json({ schedules });
  } catch (err) {
    console.error('My schedules error:', err);
    res.status(500).json({ error: 'Failed to load schedules' });
  }
};

const __routeController124 = async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT DISTINCT ce.id
      FROM CalendarEvents ce
      JOIN CalendarEventParticipants me ON me.event_id = ce.id AND me.user_id = ?
      WHERE ce.status = 'active'
      ORDER BY
        CASE WHEN datetime(COALESCE(ce.end_datetime, ce.start_datetime)) >= datetime('now') THEN 0 ELSE 1 END,
        CASE WHEN datetime(COALESCE(ce.end_datetime, ce.start_datetime)) >= datetime('now') THEN datetime(ce.start_datetime) END ASC,
        CASE WHEN datetime(COALESCE(ce.end_datetime, ce.start_datetime)) < datetime('now') THEN datetime(ce.start_datetime) END DESC
      LIMIT 300
    `, [req.user.id]);
    const schedules = [];
    for (const row of rows) {
      const full = await getCalendarEventFull(row.id);
      if (!full) continue;
      const participant = (full.participants || []).find(p => Number(p.user_id) === Number(req.user.id));
      if (!participant) continue;
      if (!(await canViewCalendarEvent(req.user, { ...full, participant_user_id: participant?.user_id }))) continue;
      schedules.push(await normalizeManualCalendarEvent(req, full));
    }
    res.json({ schedules });
  } catch (err) {
    console.error('Dashboard my schedules error:', err);
    res.status(500).json({ error: 'Failed to load my schedules' });
  }
};

const __routeController125 = (req, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  const todayKey = manilaDateKey();
  const includeCompleted = req.query.includeCompleted === 'true';
  const filters = getCalendarFilters(req);
  const scopeInfo = resolveCalendarScope(req, res);
  if (!scopeInfo) return;
  const ownerUserId = scopeInfo.ownerUserId;
  const scopedDocWhere = ownerUserId ? ` AND (d.assigned_user_id = ? OR p.assigned_user_id = ?)` : '';
  const scopedProjectWhere = ownerUserId ? ` AND p.assigned_user_id = ?` : '';
  const scopedDocParams = ownerUserId ? [ownerUserId, ownerUserId] : [];
  const scopedProjectParams = ownerUserId ? [ownerUserId] : [];
  
  // Query for documents with due dates - uploaded files remain due until checked.
  db.all(`
    SELECT 
      d.id,
      d.project_id,
      d.manual_due_date,
      d.due_date_override,
      d.due_date,
      p.created_at,
      COALESCE(rds.due_days, dt.due_days, 0) as due_days,
      COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
      COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
      COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
      d.status,
      d.requirement_state,
      d.file_path,
      p.stage as project_stage,
      p.project_type_id,
      p.requestee_id
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    WHERE 
      (p.stage != 'Completed' OR ?)
      AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
      AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
      AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
      AND d.status != 'Checked'
      AND (COALESCE(rds.due_days, dt.due_days, 0) > 0 OR COALESCE(rds.due_hours, dt.due_hours, 0) > 0 OR d.manual_due_date IS NOT NULL OR d.due_date IS NOT NULL)
      ${scopedDocWhere}
  `, [includeCompleted ? 1 : 0, ...scopedDocParams], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    
    // Process rows asynchronously to handle trigger document lookups
    const results = [];
    let processedCount = 0;
    
    const processRow = (index) => {
      if (index >= rows.length) {
        // All rows processed, now get completed projects
        getCompletedProjects();
        return;
      }
      
      const row = rows[index];
      if (filters.stage && String(row.project_stage) !== String(filters.stage)) return processRow(index + 1);
      if (filters.projectTypeId && Number(row.project_type_id) !== Number(filters.projectTypeId)) return processRow(index + 1);
      if (filters.requesteeId && Number(row.requestee_id) !== Number(filters.requesteeId)) return processRow(index + 1);
      if (filters.status && String(row.status) !== String(filters.status)) return processRow(index + 1);
      
      // Use centralized helper to compute effective due date
      getEffectiveDueDate(row, (effErr, effResult) => {
        if (effErr || !effResult.effective_due_date) {
          // No effective due date, skip this document for due count
          processRow(index + 1);
          return;
        }
        
        const dueTs = new Date(effResult.effective_due_date).getTime();
        const nowTs = Date.now();
        if (filters.overdueOnly && !(dueTs < nowTs)) return processRow(index + 1);
        if (Number.isFinite(filters.dueWithinDays) && filters.dueWithinDays > 0) {
          const maxTs = nowTs + (filters.dueWithinDays * 24 * 60 * 60 * 1000);
          if (!(dueTs >= nowTs && dueTs <= maxTs)) return processRow(index + 1);
        }

        const originalDueDateKey = calendarDateKey(effResult.effective_due_date);
        const dueDateKey = originalDueDateKey < todayKey ? todayKey : originalDueDateKey;
        if (!results[dueDateKey]) results[dueDateKey] = { due: 0, completed: 0, forReview: 0 };
        results[dueDateKey].due++;
        processRow(index + 1);
      });
    };
    
    const getCompletedProjects = () => {
      // Get completed projects count by completion date
      db.all(`
        SELECT p.updated_at as completed_at
        FROM Projects p
        WHERE p.stage = 'Completed' AND p.updated_at IS NOT NULL
        ${filters.stage ? ' AND p.stage = ?' : ''}
        ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
        ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
        ${scopedProjectWhere}
      `, [
        ...(filters.stage ? [filters.stage] : []),
        ...(filters.projectTypeId ? [filters.projectTypeId] : []),
        ...(filters.requesteeId ? [filters.requesteeId] : []),
        ...scopedProjectParams
      ], (err2, completedRows) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        
        // Process completed projects
        if (!filters.forReviewOnly) {
          completedRows.forEach(row => {
            const completedDateKey = formatDateKey(row.completed_at);
            if (!results[completedDateKey]) results[completedDateKey] = { due: 0, completed: 0, forReview: 0 };
            results[completedDateKey].completed++;
          });
        }
        
        getForReviewDocuments();
      });
    };
    
    const getForReviewDocuments = () => {
      db.all(`
        SELECT d.upload_date
        FROM Documents d
        JOIN Projects p ON p.id = d.project_id
        WHERE 
          (p.stage != 'Completed' OR ?)
          AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
          AND d.file_path IS NOT NULL
          AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
          AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
          AND d.status != 'Checked'
          ${filters.stage ? ' AND p.stage = ?' : ''}
          ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
          ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
          ${filters.status ? ' AND d.status = ?' : ''}
          ${scopedDocWhere}
      `, [includeCompleted ? 1 : 0,
          ...(filters.stage ? [filters.stage] : []),
          ...(filters.projectTypeId ? [filters.projectTypeId] : []),
          ...(filters.requesteeId ? [filters.requesteeId] : []),
          ...(filters.status ? [filters.status] : []),
          ...scopedDocParams], (err4, reviewRows) => {
        if (err4) return res.status(500).json({ error: 'DB error' });
        
        // Process documents for review (count on upload date)
        reviewRows.forEach(row => {
          const uploadDateKey = formatDateKey(row.upload_date);
          if (!results[uploadDateKey]) results[uploadDateKey] = { due: 0, completed: 0, forReview: 0 };
          results[uploadDateKey].forReview++;
        });

        db.all(`
          SELECT p.id, p.manual_due_date
          FROM Projects p
          WHERE p.stage != 'Completed'
            AND COALESCE(p.outcome, 'Active') = 'Active'
            AND p.manual_due_date IS NOT NULL
            ${filters.stage ? ' AND p.stage = ?' : ''}
            ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
            ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
            ${scopedProjectWhere}
        `, [
          ...(filters.stage ? [filters.stage] : []),
          ...(filters.projectTypeId ? [filters.projectTypeId] : []),
          ...(filters.requesteeId ? [filters.requesteeId] : []),
          ...scopedProjectParams
        ], (projectDueErr, projectDueRows) => {
          if (projectDueErr) return res.status(500).json({ error: 'DB error' });
          if (!filters.forReviewOnly) {
            (projectDueRows || []).forEach(row => {
              const dueTs = new Date(row.manual_due_date).getTime();
              const nowTs = Date.now();
              if (filters.overdueOnly && !(dueTs < nowTs)) return;
              if (Number.isFinite(filters.dueWithinDays) && filters.dueWithinDays > 0) {
                const maxTs = addWorkingDaysFromNow(filters.dueWithinDays).getTime();
                if (!(dueTs >= nowTs && dueTs <= maxTs)) return;
              }
              const originalProjectDueDateKey = calendarDateKey(row.manual_due_date);
              const projectDueDateKey = originalProjectDueDateKey < todayKey ? todayKey : originalProjectDueDateKey;
              if (!results[projectDueDateKey]) results[projectDueDateKey] = { due: 0, completed: 0, forReview: 0 };
              results[projectDueDateKey].due++;
            });
          }

          // Filter by month and convert to array
          const result = Object.entries(results)
            .filter(([date]) => date.startsWith(month))
            .map(([due_date, counts]) => ({
              due_date,
              due_count: filters.forReviewOnly ? 0 : counts.due,
              completed_count: filters.forReviewOnly ? 0 : counts.completed,
              for_review_count: counts.forReview
            }))
            .sort((a, b) => a.due_date.localeCompare(b.due_date));
          
          res.json(result);
        });
      });
    };
    
    processRow(0);
  });
};

const __routeController126 = (req, res) => {
  const date = req.query.date;
  const type = req.query.type; // 'due', 'completed', 'forReview'
  const filters = getCalendarFilters(req);
  const scopeInfo = resolveCalendarScope(req, res);
  if (!scopeInfo) return;
  const ownerUserId = scopeInfo.ownerUserId;
  const scopedDocWhere = ownerUserId ? ` AND (d.assigned_user_id = ? OR p.assigned_user_id = ?)` : '';
  const scopedProjectWhere = ownerUserId ? ` AND p.assigned_user_id = ?` : '';
  const scopedDocParams = ownerUserId ? [ownerUserId, ownerUserId] : [];
  const scopedProjectParams = ownerUserId ? [ownerUserId] : [];
  
  if (!date || !type) return res.status(400).json({ error: 'Date and type are required' });
  
  if (type === 'completed') {
    db.all(`
      SELECT p.id, p.name as project_name, p.requester, pt.name as type_name, p.updated_at as completed_at, p.stage,
             au.username as project_assigned_username
      FROM Projects p
      LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
      LEFT JOIN Users au ON au.id = p.assigned_user_id
      WHERE p.stage = 'Completed' AND substr(p.updated_at, 1, 10) = ?
      ${filters.stage ? ' AND p.stage = ?' : ''}
      ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
      ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
      ${scopedProjectWhere}
      ORDER BY p.name ASC
    `, [date,
        ...(filters.stage ? [filters.stage] : []),
        ...(filters.projectTypeId ? [filters.projectTypeId] : []),
        ...(filters.requesteeId ? [filters.requesteeId] : []),
        ...scopedProjectParams], (err, rows) => {
      if (err) {
        console.error('Calendar details completed error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ items: rows || [] });
    });
  } else if (type === 'due') {
    db.all(`
      SELECT 
        d.id, p.id as project_id, p.name as project_name, p.requester, dt.name as document_type_name, pt.name as type_name,
        p.created_at,
        COALESCE(rds.due_days, dt.due_days, 0) as due_days,
        COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
        p.requestee_id, pr.name as requestee_name,
        COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
        COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
        d.status, d.requirement_state, d.file_path,
        d.manual_due_date, d.due_date_override, d.due_date,
        p.stage as project_stage,
        au.username as assigned_username,
        pau.username as project_assigned_username
      FROM Documents d
      JOIN Projects p ON p.id = d.project_id
      LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
      LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
      LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
      LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
      LEFT JOIN Requestees pr ON pr.id = p.requestee_id
      LEFT JOIN Users au ON au.id = d.assigned_user_id
      LEFT JOIN Users pau ON pau.id = p.assigned_user_id
      WHERE 
        p.stage != 'Completed'
        AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
        AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
        AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
        AND d.status != 'Checked'
        AND (COALESCE(rds.due_days, dt.due_days, 0) > 0 OR COALESCE(rds.due_hours, dt.due_hours, 0) > 0 OR d.manual_due_date IS NOT NULL OR d.due_date IS NOT NULL)
        ${filters.stage ? ' AND p.stage = ?' : ''}
        ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
        ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
        ${filters.status ? ' AND d.status = ?' : ''}
        ${scopedDocWhere}
    `, [
      ...(filters.stage ? [filters.stage] : []),
      ...(filters.projectTypeId ? [filters.projectTypeId] : []),
      ...(filters.requesteeId ? [filters.requesteeId] : []),
      ...(filters.status ? [filters.status] : []),
      ...scopedDocParams
    ], (err, rows) => {
      if (err) {
        console.error('Calendar details due error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Process rows asynchronously to handle trigger document lookups
      const results = [];

      const appendProjectDueResults = () => {
        db.all(`
          SELECT p.id, p.name as project_name, p.requester, pt.name as type_name, pr.name as requestee_name,
                 p.manual_due_date, p.stage, au.username as project_assigned_username
          FROM Projects p
          LEFT JOIN ProjectTypes pt ON pt.id = p.project_type_id
          LEFT JOIN Requestees pr ON pr.id = p.requestee_id
          LEFT JOIN Users au ON au.id = p.assigned_user_id
          WHERE p.stage != 'Completed'
            AND COALESCE(p.outcome, 'Active') = 'Active'
            AND p.manual_due_date IS NOT NULL
            ${filters.stage ? ' AND p.stage = ?' : ''}
            ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
            ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
            ${scopedProjectWhere}
          ORDER BY p.name ASC
        `, [
          ...(filters.stage ? [filters.stage] : []),
          ...(filters.projectTypeId ? [filters.projectTypeId] : []),
          ...(filters.requesteeId ? [filters.requesteeId] : []),
          ...scopedProjectParams
        ], (projectDueErr, projectDueRows) => {
          if (projectDueErr) return res.status(500).json({ error: 'Database error' });
          const nowTs = Date.now();
          (projectDueRows || []).forEach(project => {
            const projectDueKey = calendarDateKey(project.manual_due_date);
            if (date === todayKey ? projectDueKey > todayKey : projectDueKey !== date) return;
            const dueTs = new Date(project.manual_due_date).getTime();
            if (filters.overdueOnly && !(dueTs < nowTs)) return;
            if (Number.isFinite(filters.dueWithinDays) && filters.dueWithinDays > 0) {
              const maxTs = addWorkingDaysFromNow(filters.dueWithinDays).getTime();
              if (!(dueTs >= nowTs && dueTs <= maxTs)) return;
            }
            results.push({
              ...project,
              kind: 'project',
              project_id: project.id,
              due_date: project.manual_due_date,
              assigned_username: project.project_assigned_username || null
            });
          });
          res.json({ items: results });
        });
      };
      
      const processRow = (index) => {
        if (index >= rows.length) {
          appendProjectDueResults();
          return;
        }
        
        const row = rows[index];
        
        // Use centralized helper to compute effective due date
        getEffectiveDueDate(row, (effErr, effResult) => {
          if (effErr || !effResult.effective_due_date) {
            processRow(index + 1);
            return;
          }
          
          const dueKey = calendarDateKey(effResult.effective_due_date);
          if (date === todayKey ? dueKey <= todayKey : dueKey === date) {
            const dueTs = new Date(effResult.effective_due_date).getTime();
            const nowTs = Date.now();
            if (filters.overdueOnly && !(dueTs < nowTs)) return processRow(index + 1);
            if (Number.isFinite(filters.dueWithinDays) && filters.dueWithinDays > 0) {
              const maxTs = addWorkingDaysFromNow(filters.dueWithinDays).getTime();
              if (!(dueTs >= nowTs && dueTs <= maxTs)) return processRow(index + 1);
            }
            results.push({ 
              ...row, 
              due_date: effResult.effective_due_date,
              stage: row.project_stage || 'Proposal'
            });
          }
          processRow(index + 1);
        });
      };
      
      processRow(0);
    });
  } else if (type === 'forReview') {
    db.all(`
      SELECT 
        d.id, p.id as project_id, p.name as project_name, p.requester,
        CASE WHEN dt.name IS NOT NULL THEN dt.name ELSE d.document_type_name END as document_type_name,
        d.status, d.upload_date, d.requirement_state, d.file_path,
        p.stage as project_stage,
        au.username as assigned_username,
        pau.username as project_assigned_username
      FROM Documents d
      JOIN Projects p ON p.id = d.project_id
      LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
      LEFT JOIN Users au ON au.id = d.assigned_user_id
      LEFT JOIN Users pau ON pau.id = p.assigned_user_id
      WHERE 
        p.stage != 'Completed'
        AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active'
        AND d.file_path IS NOT NULL
        AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
        AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
        AND d.status != 'Checked'
        AND substr(d.upload_date, 1, 10) = ?
        ${filters.stage ? ' AND p.stage = ?' : ''}
        ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
        ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
        ${filters.status ? ' AND d.status = ?' : ''}
        ${scopedDocWhere}
      ORDER BY p.name ASC
    `, [date,
        ...(filters.stage ? [filters.stage] : []),
        ...(filters.projectTypeId ? [filters.projectTypeId] : []),
        ...(filters.requesteeId ? [filters.requesteeId] : []),
        ...(filters.status ? [filters.status] : []),
        ...scopedDocParams], (err, rows) => {
      if (err) {
        console.error('Calendar details forReview error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Add stage to each item for navigation
      const items = (rows || []).map(row => ({ ...row, stage: row.project_stage || 'Proposal' }));
      res.json({ items });
    });
  } else {
    res.status(400).json({ error: 'Invalid type' });
  }
};

const __routeController127 = (req, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  const scopeInfo = resolveCalendarScope(req, res);
  if (!scopeInfo) return;
  const ownerUserId = scopeInfo.ownerUserId;
  const filters = getCalendarFilters(req);
  const scopedDocWhere = ownerUserId ? ` AND (d.assigned_user_id = ? OR p.assigned_user_id = ?)` : '';
  const scopedProjectWhere = ownerUserId ? ` AND p.assigned_user_id = ?` : '';
  const scopedDocParams = ownerUserId ? [ownerUserId, ownerUserId] : [];
  const scopedProjectParams = ownerUserId ? [ownerUserId] : [];
  const nowTs = Date.now();
  const end5Ts = addWorkingDaysFromNow(5).getTime();
  const todayKey = manilaDateKey();
  const summary = { overdue: 0, due_today: 0, due_within_5_days: 0, for_review: 0, completed_projects_month: 0, most_loaded_user: null, most_overdue_user: null, unassigned_required_documents: 0 };
  const perUser = {};

  db.all(`
    SELECT d.id, d.assigned_user_id, d.status, d.file_path, d.manual_due_date, d.due_date_override, d.due_date,
           p.created_at, p.stage as project_stage, p.project_type_id, p.requestee_id,
           COALESCE(rds.due_days, dt.due_days, 0) as due_days,
           COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
           COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
           COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
           COALESCE(d.requirement_state, 'Required') as requirement_state
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    WHERE COALESCE(d.requirement_state, 'Required') != 'Not Required'
      AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
      ${filters.stage ? ' AND p.stage = ?' : ''}
      ${filters.projectTypeId ? ' AND p.project_type_id = ?' : ''}
      ${filters.requesteeId ? ' AND p.requestee_id = ?' : ''}
      ${scopedDocWhere}
  `, [
    ...(filters.stage ? [filters.stage] : []),
    ...(filters.projectTypeId ? [filters.projectTypeId] : []),
    ...(filters.requesteeId ? [filters.requesteeId] : []),
    ...scopedDocParams
  ], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const dueRows = rows.filter(r => (Number(r.due_days) > 0 || Number(r.due_hours) > 0 || r.manual_due_date || r.due_date) && r.status !== 'Checked');
    const processDue = (i) => {
      if (i >= dueRows.length) return continueSummary(rows);
      const row = dueRows[i];
      getEffectiveDueDate(row, (e, eff) => {
        if (!e && eff?.effective_due_date) {
          const dueTs = new Date(eff.effective_due_date).getTime();
          const dueKey = calendarDateKey(eff.effective_due_date);
          if (dueTs < nowTs) summary.overdue++;
          if (dueKey === todayKey) summary.due_today++;
          if (dueTs >= nowTs && dueTs <= end5Ts) summary.due_within_5_days++;
          if (row.assigned_user_id) {
            perUser[row.assigned_user_id] = perUser[row.assigned_user_id] || { active: 0, overdue: 0 };
            perUser[row.assigned_user_id].active++;
            if (dueTs < nowTs) perUser[row.assigned_user_id].overdue++;
          }
        }
        processDue(i + 1);
      });
    };

    const continueSummary = (allRows) => {
      const forReviewRows = allRows.filter(r => r.file_path && r.status !== 'Checked' && (!filters.status || r.status === filters.status));
      summary.for_review = forReviewRows.length;
      summary.unassigned_required_documents = allRows.filter(r => !r.assigned_user_id && !r.file_path).length;
      db.all(`SELECT COUNT(*) as c FROM Projects p WHERE p.stage = 'Completed' AND substr(p.updated_at,1,7)=? ${scopedProjectWhere}`, [month, ...scopedProjectParams], (e2, pRows) => {
        if (!e2) summary.completed_projects_month = Number(pRows?.[0]?.c || 0);
        const sortable = Object.entries(perUser);
        if (sortable.length) {
          const ml = sortable.sort((a, b) => b[1].active - a[1].active)[0];
          const mo = sortable.sort((a, b) => b[1].overdue - a[1].overdue)[0];
          summary.most_loaded_user = { user_id: Number(ml[0]), active_assignments: ml[1].active };
          summary.most_overdue_user = { user_id: Number(mo[0]), overdue_assignments: mo[1].overdue };
        }
        res.json(summary);
      });
    };
    processDue(0);
  });
};
