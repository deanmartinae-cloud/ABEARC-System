app.get('/api/weather/map-stations', checkPrivilege('view_weather_stations'), __routeController500);
app.get('/api/weather/stations', checkPrivilege('view_weather_stations'), __routeController501);
app.get('/api/weather/stations/:id/current', checkPrivilege('view_weather_stations'), __routeController503);
app.get('/api/weather/stations/:id/forecast', checkPrivilege('view_weather_stations'), weatherForecastController);
app.get('/api/weather/stations/:id/history', checkPrivilege('view_weather_stations'), __routeController504);
app.get('/api/weather/stations/:id/agriculture', checkPrivilege('view_weather_stations'), __routeController505);
app.get('/api/weather/stations/:id/summary', checkPrivilege('view_weather_stations'), __routeController506);
app.get('/api/weather/stations/:id/export.csv', requireAnyPrivilege(['export_weather_data']), __routeController507);
app.get('/api/weather/stations/:id/export.xlsx', requireAnyPrivilege(['export_weather_data']), __routeController508);
app.get('/api/weather/stations/:id/report.pdf', requireAnyPrivilege(['export_weather_data']), __routeController509);
app.get('/api/weather/stations/:id/alerts', checkPrivilege('view_weather_stations'), __routeController515);
app.get('/api/weather/stations/:id', checkPrivilege('view_weather_stations'), __routeController502);
app.patch('/api/weather/stations/:id', requireAnyPrivilege(['manage_weather_stations']), __routeController510);
app.post('/api/weather/stations/:id/sync', requireAnyPrivilege(['manage_weather_stations']), __routeController511);
app.post('/api/weather/stations/:id/resync', requireAnyPrivilege(['manage_weather_stations']), __routeController512);
app.post('/api/weather/stations/:id/alerts', requireAnyPrivilege(['manage_weather_alerts']), __routeController516);
app.patch('/api/weather/alerts/:ruleId', requireAnyPrivilege(['manage_weather_alerts']), __routeController517);
app.delete('/api/weather/alerts/:ruleId', requireAnyPrivilege(['manage_weather_alerts']), __routeController518);
app.get('/api/weather/admin/status', requireAnyPrivilege(['manage_weather_integration']), __routeController513);
app.post('/api/weather/admin/discover', requireAnyPrivilege(['manage_weather_integration']), __routeController514);

app.get('/api/weather/admin/credentials', requireAdminOrSuperAdmin, requireAnyPrivilege(['manage_weather_integration']), weatherCredentialStatusController);
app.put('/api/weather/admin/credentials', requireAdminOrSuperAdmin, requireAnyPrivilege(['manage_weather_integration']), weatherSaveCredentialController);
app.delete('/api/weather/admin/credentials', requireAdminOrSuperAdmin, requireAnyPrivilege(['manage_weather_integration']), weatherRemoveCredentialController);

app.get('/api/weather/stations/:id/crop-advisories',checkPrivilege('view_weather_stations'),weatherCropAdvisoriesController);
app.get('/api/weather/crop-advisory-library',checkPrivilege('view_weather_stations'),weatherCropAdvisoryLibraryController);
