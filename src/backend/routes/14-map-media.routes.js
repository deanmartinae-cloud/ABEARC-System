app.get('/api/map/config', requireMapMediaAccess, __routeController197);
app.get('/api/map/zoning-tiles/:z/:x/:y.png', requireMapMediaAccess, __routeController224);
app.get('/api/map/zoning-labels', requireMapMediaAccess, __routeController300);
app.post('/api/map/elevation-profile', requireMapMediaAccess, __routeController225);
app.post('/api/mobile/map-media/upload', requireMapMediaUpload, mapMediaUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'files', maxCount: 1 }]), __routeController198);
app.post('/api/mobile/map-media/upload-batch', requireMapMediaUpload, mapMediaUpload.array('photos[]', 100), __routeController199);
app.get('/api/mobile/map-media/projects', requireMapMediaUpload, __routeController220);

app.get('/api/map/media', requireMapMediaAccess, __routeController200);
app.post('/api/map/media/bulk-rename', requireMapMediaAccess, __routeController221);
app.post('/api/map/media/bulk-download', requireMapMediaAccess, __routeController222);
app.post('/api/map/media/bulk-delete', requireMapMediaAccess, __routeController223);
app.get('/api/map/media/:id', requireMapMediaAccess, __routeController201);
app.get('/api/map/media/:id/original', requireMapMediaAccess, __routeController202);
app.get('/api/map/media/:id/thumbnail', requireMapMediaAccess, __routeController203);
app.get('/api/map/summary', requireMapMediaAccess, __routeController204);
app.get('/api/map/filter-options', requireMapMediaAccess, __routeController205);
app.get('/api/map/clusters', requireMapMediaAccess, __routeController206);
app.get('/api/map/clusters/:clusterId', requireMapMediaAccess, __routeController207);

app.patch('/api/map/media/:id', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController208);
app.patch('/api/map/media/:id/location', requireMapMediaLocationReview, ensureMapMediaOwnerOrManager, __routeController209);
app.post('/api/map/media/:id/link-project', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController210);
app.post('/api/map/media/:id/unlink-project', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController211);
app.post('/api/map/media/:id/link-calendar-event', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController212);
app.post('/api/map/media/:id/unlink-calendar-event', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController213);
app.post('/api/map/media/:id/hide', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController214);
app.post('/api/map/media/:id/restore', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController215);
app.delete('/api/map/media/:id', requireMapMediaAccess, ensureMapMediaOwnerOrManager, __routeController216);

app.post('/api/map/reindex', requireMapMediaMaintenance, __routeController217);
app.post('/api/map/regenerate-thumbnails', requireMapMediaMaintenance, __routeController218);
app.get('/api/map/storage-health', requireMapMediaMaintenance, __routeController219);
