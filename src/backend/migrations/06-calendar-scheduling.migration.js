const ensureCalendarSchedulingMigration = async () => {
  await addColumnIfMissing('CalendarEvents','series_id','TEXT');
  await addColumnIfMissing('CalendarEvents','recurrence_index','INTEGER');
  await addColumnIfMissing('CalendarEvents','priority',"TEXT DEFAULT 'normal'");
  await addColumnIfMissing('CalendarEvents','meeting_link','TEXT');
  await addColumnIfMissing('CalendarEvents','notes','TEXT');
  await addColumnIfMissing('CalendarEvents','external_provider','TEXT');
  await addColumnIfMissing('CalendarEvents','external_event_id','TEXT');
  await addColumnIfMissing('CalendarEvents','sync_status',"TEXT DEFAULT 'not_configured'");
  await dbRun('CREATE INDEX IF NOT EXISTS idx_calendar_events_series ON CalendarEvents(series_id,recurrence_index)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_external_event ON CalendarEvents(external_provider,external_event_id) WHERE external_event_id IS NOT NULL');
  await dbRun("UPDATE CalendarEventReminderLogs SET reminder_key=reminder_key||':'||(SELECT start_datetime FROM CalendarEvents WHERE id=event_id) WHERE instr(reminder_key,':')=0 AND EXISTS(SELECT 1 FROM CalendarEvents WHERE id=event_id)");
};
