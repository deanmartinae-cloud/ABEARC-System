// Controllers extracted from src/backend/routes/00-auth-public.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController001 = (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  db.get(`SELECT id, username, password_hash, role, theme_preference, avatar_path,
                 is_system_account, hidden_from_workflows, must_change_password
          FROM Users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user || !verifyPassword(password, user.password_hash)) {
      // Log failed login attempt
      try {
        logActivity({
          req,
          action: 'LOGIN_FAILED',
          project: '-',
          requester: '-',
          docType: '-',
          details: `Failed login attempt for username: ${username}`
        });
      } catch(e) {}
      return unauthorized(res, 'Invalid username or password.');
    }

    const token = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = sessionExpiryForRequest(req);
    db.run("INSERT INTO UserSessions (user_id, token, expires_at, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?)", [user.id, token, expiresAt, now, now], (sessionErr) => {
      if (sessionErr) return res.status(500).json({ error: 'Login failed' });
      
      // Get user privileges
      getUserPrivileges(user.id, (privErr, privileges) => {
        // Log successful login
        try {
          logActivity({
            req,
            actorUserId: user.id,
            actorUsername: user.username,
            action: 'LOGIN',
            projectId: null,
            project: '-',
            requester: '-',
            docType: '-',
            details: `User ${username} logged in successfully`
          });
        } catch(e) {}
        
        const responseData = { 
          token, 
          user: { 
            ...userPublicFields(user),
            privileges: privileges || {}
          } 
        };
        res.json(responseData);
      });
    });
  });
};

const __routeController002 = async (req, res) => {
  try {
    const qrToken = createMobileQrLoginToken(req.user.id);
    const serverUrl = requestBaseUrl(req);
    const payload = JSON.stringify({
      type: 'abearc-mobile-login',
      server_url: serverUrl,
      qr_token: qrToken
    });
    const qr_data_url = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320
    });
    res.json({
      payload,
      qr_data_url,
      server_url: serverUrl,
      expires_at: new Date(Date.now() + MOBILE_QR_LOGIN_TTL_MS).toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate QR login code.' });
  }
};

const __routeController003 = (req, res) => {
  const qrToken = String(req.body?.qr_token || '').trim();
  const data = verifyMobileQrLoginToken(qrToken);
  if (!data) return unauthorized(res, 'QR login code is invalid or expired.');

  db.get(`SELECT id, username, role, theme_preference, avatar_path,
                 is_system_account, hidden_from_workflows, must_change_password
          FROM Users WHERE id = ?`, [Number(data.sub)], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return unauthorized(res, 'QR login user was not found.');
    if (Number(user.must_change_password) === 1) {
      return res.status(403).json({
        error: 'Change the temporary password in the ABEARC web application before using QR login.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    const token = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = mobileSessionExpiry();
    db.run("INSERT INTO UserSessions (user_id, token, expires_at, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?)", [user.id, token, expiresAt, now, now], (sessionErr) => {
      if (sessionErr) return res.status(500).json({ error: 'QR login failed' });
      getUserPrivileges(user.id, (privErr, privileges) => {
        try {
          logActivity({
            req,
            actorUserId: user.id,
            actorUsername: user.username,
            action: 'LOGIN',
            projectId: null,
            project: '-',
            requester: '-',
            docType: '-',
            details: `User ${user.username} logged in from GeoCamera QR`
          });
        } catch (e) {}
        res.json({
          token,
          user: {
            ...userPublicFields(user),
            privileges: privileges || {}
          }
        });
      });
    });
  });
};

const __routeController004 = (req, res) => {
  const requested = String(req.params.path || '').replace(/\\/g, '/');
  if (!requested || requested.includes('..') || path.isAbsolute(requested)) return res.status(404).end();
  const full = safeAvatarAbsolutePath(requested);
  if (!full || !fs.existsSync(full)) return res.status(404).end();
  const ext = path.extname(full).toLowerCase();
  if (!AVATAR_ALLOWED_EXTENSIONS.includes(ext)) return res.status(404).end();
  res.sendFile(full);
};
