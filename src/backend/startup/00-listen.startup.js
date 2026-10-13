db.wait(async () => {
  try {
    await ensureUsersSystemRoleMigration();
    await ensureRoleDefaultPrivileges();
    await ensureCalendarEventTypeDetailMigration();
    await ensureDocumentRemarksMigration();
    await ensureDocumentDateMigration();
    await ensureCalendarSchedulingMigration();
    await removeNonSystemFeedbackNotifications();
    await ensureEstablishedMonitoringMigration();
    await ensureMapOrthomosaicMigration();
    await ensureMapLayoutsMigration();
    await ensureWeatherMigration();
    await ensureTelegramMigration();
    await backfillOrthomosaicCoverageAreas();
    await resumeOrthomosaicProcessing();
    await backfillMapMediaSpatialMetadata();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://${getLocalIP()}:${PORT}`);
      startWeatherScheduler();
      startTelegramScheduler();
      setTimeout(() => backfillMapMediaMetadataInBackground().catch(err => {
        logError('MAP_MEDIA_METADATA_BACKFILL_FAILED', err.message, err.stack);
      }), 1200);
    });
  } catch (migrationErr) {
    console.error('Database migration or startup failed:', migrationErr);
    process.exitCode = 1;
  }
});
