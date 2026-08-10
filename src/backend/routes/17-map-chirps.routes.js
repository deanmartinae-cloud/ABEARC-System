app.get('/api/map/chirps/config', requireMapMediaAccess, __routeController320);
app.get('/api/map/chirps/prepare', requireMapMediaAccess, __routeController321);
app.get('/api/map/chirps-tiles/:z/:x/:y.png', requireMapMediaAccess, __routeController322);
app.get('/api/map/chirps/series', requireMapMediaAccess, __routeController323);
