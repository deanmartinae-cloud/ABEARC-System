const attachAuthUser = (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const token = getBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  db.get(`
    SELECT u.id, u.username, u.role, u.is_system_account, u.hidden_from_workflows,
           s.token, s.expires_at, s.created_at, s.last_activity_at
    FROM UserSessions s
    JOIN Users u ON u.id = s.user_id
    WHERE s.token = ?
  `, [token], (err, row) => {
    if (err || !row) {
      req.user = null;
      return next();
    }

    const now = new Date();
    const createdAt = new Date(row.created_at);
    const lastActivityAt = new Date(row.last_activity_at);
    
    // Check absolute expiry. Mobile GeoCamera sessions use their stored 30-day expiry.
    const storedExpiry = row.expires_at ? new Date(row.expires_at) : null;
    const absoluteExpiryTime = storedExpiry && !isNaN(storedExpiry.getTime())
      ? storedExpiry
      : new Date(createdAt.getTime() + SESSION_ABSOLUTE_EXPIRY_HOURS * 60 * 60 * 1000);
    const longLivedSession = isLongLivedSession(createdAt, absoluteExpiryTime);
    if (now > absoluteExpiryTime) {
      db.run("DELETE FROM UserSessions WHERE token = ?", [token], () => {});
      req.user = null;
      req.authExpiredReason = 'absolute';
      return next();
    }
    
    // Web sessions keep the short inactivity timeout. Mobile sessions last until absolute expiry.
    if (!longLivedSession) {
      const inactivityExpiryTime = new Date(lastActivityAt.getTime() + SESSION_INACTIVITY_EXPIRY_HOURS * 60 * 60 * 1000);
      if (now > inactivityExpiryTime) {
        db.run("DELETE FROM UserSessions WHERE token = ?", [token], () => {});
        req.user = null;
        req.authExpiredReason = 'inactivity';
        return next();
      }
    }

    req.user = {
      id: row.id,
      username: row.username,
      role: row.role,
      is_system_account: Number(row.is_system_account || 0),
      hidden_from_workflows: Number(row.hidden_from_workflows || 0),
      token: row.token,
      session_client_type: longLivedSession ? 'mobile' : 'web'
    };
    next();
  });
};

const requireAuth = (req, res, next) => {
  if (req.path === '/api/auth/login') return next();
  if (req.path === '/api/backups/restore-login' || req.path === '/backups/restore-login') return next();
  if (/^\/(?:api\/)?downloads-forms\/\d+\/shared-download$/.test(req.path)) return next();
  if (!req.user) {
    if (req.authExpiredReason === 'absolute') return res.status(401).json({ error: 'Session expired.', code: 'SESSION_ABSOLUTE_EXPIRED' });
    if (req.authExpiredReason === 'inactivity') return res.status(401).json({ error: 'Session expired due to inactivity.', code: 'SESSION_INACTIVITY_EXPIRED' });
    return unauthorized(res, 'Please log in.');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Please log in.');
  if (!['admin', 'superadmin', 'system'].includes(req.user.role)) return forbidden(res, 'Admin access required.');
  next();
};

// Check for superadmin role
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Please log in.');
  if (req.user.role !== 'superadmin') return forbidden(res, 'Super admin access required.');
  next();
};

// Check user privilege
const checkPrivilege = (privilege) => {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res, 'Please log in.');
    
    if (canRoleBypassPrivilege(req.user, privilege)) return next();
    
    // Check if user has the privilege enabled
    db.get("SELECT enabled FROM UserPrivileges WHERE user_id = ? AND privilege = ?", [req.user.id, privilege], (err, row) => {
      if (err || !row || !row.enabled) return forbidden(res, `Permission denied: ${privilege}`);
      next();
    });
  };
};

const requireAnyPrivilege = (privileges, roleGuard = null) => {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res, 'Please log in.');
    if (privileges.some(privilege => canRoleBypassPrivilege(req.user, privilege))) return next();
    if (roleGuard === 'admin' && req.user.role !== 'admin') return forbidden(res, 'Admin access required.');
    db.all(
      `SELECT privilege FROM UserPrivileges WHERE user_id = ? AND enabled = 1 AND privilege IN (${privileges.map(() => '?').join(',')})`,
      [req.user.id, ...privileges],
      (err, rows) => {
        if (err || !rows || rows.length === 0) return forbidden(res, `Permission denied: ${privileges.join(' or ')}`);
        next();
      }
    );
  };
};

const requireManageUsers = requireAnyPrivilege(['manage_users']);
const requireManageBackups = requireAnyPrivilege(['manage_backups']);
const requireManageMaintenance = requireAnyPrivilege(['manage_maintenance']);
const requireConfigImportExport = requireAnyPrivilege(['import_export_config']);
const requireWorkloadAccess = requireAnyPrivilege(['view_workload_analytics', 'view_workload_dashboard']);
const requireUploadDownloadsForms = requireAnyPrivilege(['upload_downloads_forms']);
const requireManageDownloadsForms = requireAnyPrivilege(['manage_downloads_forms']);
const requireWorkloadAccessOrOwnScope = (req, res, next) => {
  const scope = String(req.query.scope || '').toLowerCase();
  if (scope === 'my') return requireAuth(req, res, next);
  return requireWorkloadAccess(req, res, next);
};

const requireAdminOrSuperAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Please log in.');
  if (!['admin', 'superadmin', 'system'].includes(req.user.role)) return forbidden(res, 'Admin access required.');
  next();
};

const requireSystemMaintenance = (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Please log in.');
  if (!isSystemUser(req.user)) return forbidden(res, 'System / Maintenance access required.');
  next();
};

const resolveCalendarScope = (req, res) => {
  const requestedScope = String(req.query.scope || 'my').toLowerCase();
  const isAdminLike = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const selectedUserIdRaw = req.query.user_id;
  const selectedUserId = selectedUserIdRaw === undefined ? null : Number(selectedUserIdRaw);

  if (req.user?.role === 'user') {
    return { scope: 'my', ownerUserId: req.user.id };
  }

  if (!isAdminLike) {
    return null;
  }

  if (requestedScope === 'global') {
    return { scope: 'global', ownerUserId: null };
  }

  if (requestedScope === 'user') {
    if (!Number.isInteger(selectedUserId) || selectedUserId <= 0) {
      res.status(400).json({ error: 'Valid user_id is required for scope=user.' });
      return null;
    }
    return { scope: 'user', ownerUserId: selectedUserId };
  }

  return { scope: 'my', ownerUserId: req.user.id };
};

const getCalendarFilters = (req) => ({
  stage: req.query.stage ? String(req.query.stage) : null,
  projectTypeId: req.query.project_type_id ? Number(req.query.project_type_id) : null,
  requesteeId: req.query.requestee_id ? Number(req.query.requestee_id) : null,
  status: req.query.status ? String(req.query.status) : null,
  overdueOnly: req.query.overdue_only === 'true',
  dueWithinDays: req.query.due_within_days ? Number(req.query.due_within_days) : null,
  forReviewOnly: req.query.for_review_only === 'true'
});

