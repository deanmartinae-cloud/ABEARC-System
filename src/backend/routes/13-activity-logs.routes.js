app.get('/api/activity-logs', checkPrivilege('view_activity_logs'), __routeController193);

// Export activity logs to CSV
app.get('/api/activity-logs/export/csv', checkPrivilege('view_activity_logs'), __routeController194);

// Export activity logs to Excel-compatible format
app.get('/api/activity-logs/export/excel', checkPrivilege('view_activity_logs'), __routeController195);

// Export activity logs to PDF
app.get('/api/activity-logs/export/pdf', checkPrivilege('view_activity_logs'), __routeController196);

