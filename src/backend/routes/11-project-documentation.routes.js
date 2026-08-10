app.get('/api/projects/:projectId/documentation/counts', checkPrivilege('view_project_documentation'), __routeController171);

app.get('/api/projects/:projectId/documentation', checkPrivilege('view_project_documentation'), __routeController172);

app.post('/api/projects/:projectId/documentation', checkPrivilege('upload_project_documentation'), __routeController173);

app.get('/api/project-documentation/:id/view', checkPrivilege('view_project_documentation'), __routeController174);

app.get('/api/project-documentation/:id/download', checkPrivilege('view_project_documentation'), __routeController175);

app.patch('/api/project-documentation/:id', checkPrivilege('upload_project_documentation'), __routeController176);

app.delete('/api/project-documentation/:id', requireAuth, __routeController177);

