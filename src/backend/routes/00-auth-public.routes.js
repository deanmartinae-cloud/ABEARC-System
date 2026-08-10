app.post('/api/auth/login', __routeController001);

app.post('/api/auth/mobile-qr', requireAuth, __routeController002);

app.post('/api/auth/mobile-qr/exchange', __routeController003);

app.get('/api/avatars/:path(*)', __routeController004);

