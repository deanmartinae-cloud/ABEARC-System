db.wait(async () => {
  try {
    await ensureUsersSystemRoleMigration();
    await ensureFirstRunAdministrator();
    await ensureCalendarEventTypeDetailMigration();
    await removeNonSystemFeedbackNotifications();
    await ensureEstablishedMonitoringMigration();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://${getLocalIP()}:${PORT}`);
    });
  } catch (migrationErr) {
    console.error('Database migration or startup failed:', migrationErr);
    process.exitCode = 1;
  }
});
