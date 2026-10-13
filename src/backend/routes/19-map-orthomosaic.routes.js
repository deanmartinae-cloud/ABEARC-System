app.get('/api/map/orthomosaics', requireDroneOrthomosaicAccess, __routeController400);
app.post('/api/map/orthomosaics/inspect', requireDroneOrthomosaicManagement, requireOrthomosaicUploadStorage, orthomosaicUpload.single('file'), __routeController401);
app.post('/api/map/orthomosaics', requireDroneOrthomosaicManagement, __routeController402);
app.patch('/api/map/orthomosaics/:id', requireDroneOrthomosaicManagement, __routeController403);
app.delete('/api/map/orthomosaics/:id', requireDroneOrthomosaicManagement, __routeController404);
app.get('/api/map/orthomosaics/:id/tiles/:z/:x/:y.png', requireDroneOrthomosaicAccess, __routeController405);
app.get('/api/map/orthomosaics/:id/thumbnail.png', requireDroneOrthomosaicAccess, __routeController406);
