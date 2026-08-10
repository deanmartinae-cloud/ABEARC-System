// Controllers extracted from src/backend/routes/02-user-profile-notifications.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController043 = (req, res) => {
  db.get("SELECT theme_preference FROM Users WHERE id = ?", [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ theme: row?.theme_preference || 'light' });
  });
};

const __routeController044 = (req, res) => {
  const { theme } = req.body;
  const allowedThemes = ['light', 'dark', 'system'];
  if (!theme || !allowedThemes.includes(theme)) {
    return res.status(400).json({ error: `Invalid theme. Must be one of: ${allowedThemes.join(', ')}` });
  }
  db.run("UPDATE Users SET theme_preference = ? WHERE id = ?", [theme, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, theme });
  });
};

const __routeController045 = (req, res) => {
  avatarUpload.single('avatar')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.message || 'Failed to upload avatar. Please try again.';
      return res.status(400).json({ error: message });
    }
  try {
    if (!req.file) return res.status(400).json({ error: 'Avatar image is required.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!AVATAR_ALLOWED_EXTENSIONS.includes(ext)) throw new Error('Invalid file type. Please upload JPG, PNG, or WEBP.');
    const existing = await dbGet(`SELECT avatar_path FROM Users WHERE id = ?`, [req.user.id]);
    const userDir = path.join(AVATARS_DIR, `user-${Number(req.user.id)}`);
    fs.mkdirSync(userDir, { recursive: true });
    const filename = `avatar${ext}`;
    const dest = path.join(userDir, sanitizeAvatarFilename(filename));
    fs.copyFileSync(req.file.path, dest);
    const relativePath = path.posix.join('user-' + Number(req.user.id), path.basename(dest));
    await dbRun(`UPDATE Users SET avatar_path = ? WHERE id = ?`, [relativePath, req.user.id]);
    if (existing?.avatar_path && existing.avatar_path !== relativePath) {
      const oldPath = safeAvatarAbsolutePath(existing.avatar_path);
      if (oldPath && fs.existsSync(oldPath)) fs.rmSync(oldPath, { force: true });
    }
    try { fs.rmSync(req.file.path, { force: true }); } catch (_) {}
    const updated = await dbGet(`SELECT id, username, role, theme_preference, avatar_path,
                                        is_system_account, hidden_from_workflows, must_change_password
                                 FROM Users WHERE id = ?`, [req.user.id]);
    res.json({ success: true, user: userPublicFields(updated) });
  } catch (err) {
    if (req.file?.path) try { fs.rmSync(req.file.path, { force: true }); } catch (_) {}
    res.status(400).json({ error: err.message || 'Failed to upload avatar. Please try again.' });
  }
  });
};

const __routeController046 = async (req, res) => {
  try {
    const existing = await dbGet(`SELECT avatar_path FROM Users WHERE id = ?`, [req.user.id]);
    await dbRun(`UPDATE Users SET avatar_path = NULL WHERE id = ?`, [req.user.id]);
    const oldPath = safeAvatarAbsolutePath(existing?.avatar_path);
    if (oldPath && fs.existsSync(oldPath)) fs.rmSync(oldPath, { force: true });
    const updated = await dbGet(`SELECT id, username, role, theme_preference, avatar_path,
                                        is_system_account, hidden_from_workflows, must_change_password
                                 FROM Users WHERE id = ?`, [req.user.id]);
    res.json({ success: true, user: userPublicFields(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove avatar. Please try again.' });
  }
};

const __routeController047 = (req, res) => {
  db.get(`SELECT id, username, role, theme_preference, avatar_path,
                 is_system_account, hidden_from_workflows, must_change_password
          FROM Users WHERE id = ?`, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get user privileges
    getUserPrivileges(req.user.id, (privErr, privileges) => {
      res.json({ 
        user: { 
          ...userPublicFields(row),
          privileges: privileges || {}
        } 
      });
    });
  });
};

const __routeController048 = (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || 50, 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);
  db.all(`
    SELECT n.id, n.recipient_user_id, n.actor_user_id, u.username as actor_username,
           n.type, n.priority, n.message, n.project_id, n.project_name,
           n.document_id, n.document_name, n.stage, n.target_kind, n.target_meta,
           n.alert_key, n.alert_date, n.read_at, n.created_at, n.updated_at
    FROM Notifications n
    LEFT JOIN Users u ON u.id = n.actor_user_id
    WHERE n.recipient_user_id = ?
    ORDER BY datetime(COALESCE(n.updated_at, n.created_at)) DESC, datetime(n.created_at) DESC, n.id DESC
    LIMIT ? OFFSET ?
  `, [req.user.id, limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(row => {
      const meta = parseNotificationMeta(row.target_meta);
      return {
        ...row,
        target_meta: meta,
        changed_fields: meta.changed_fields || [],
        event_action: meta.event_action || inferNotificationEventAction(row.type, row.target_kind)
      };
    }));
  });
};

const __routeController049 = (req, res) => {
  db.get("SELECT COUNT(*) as count FROM Notifications WHERE recipient_user_id = ? AND read_at IS NULL", [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row?.count || 0 });
  });
};

const __routeController050 = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const userId = Number(req.user.id);
  if (!notificationClients.has(userId)) notificationClients.set(userId, new Set());
  notificationClients.get(userId).add(res);
  res.write(`event: ready\ndata: {"ok":true}\n\n`);

  const keepAlive = setInterval(() => {
    try { res.write(`: keep-alive\n\n`); } catch (e) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const clients = notificationClients.get(userId);
    if (!clients) return;
    clients.delete(res);
    if (!clients.size) notificationClients.delete(userId);
  });
};

const __routeController051 = (req, res) => {
  db.run("UPDATE Notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND recipient_user_id = ?", [new Date().toISOString(), req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

const __routeController052 = (req, res) => {
  db.run("UPDATE Notifications SET read_at = COALESCE(read_at, ?) WHERE recipient_user_id = ? AND read_at IS NULL", [new Date().toISOString(), req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

const __routeController053 = async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').trim();
    const params = [req.user.id];
    let where = `WHERE (dr.owner_user_id = ? OR dr.requested_by_user_id = ?)`;
    params.push(req.user.id);
    if (status) {
      where += ` AND dr.status = ?`;
      params.push(status);
    }
    const rows = await dbAll(`${deletionRequestSelect} ${where} ORDER BY datetime(dr.created_at) DESC, dr.id DESC`, params);
    res.json(rows.map(r => ({ ...r, target_snapshot: parseNotificationMeta(r.target_snapshot) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load deletion requests' });
  }
};

const __routeController054 = async (req, res) => {
  try {
    const targetType = String(req.body?.target_type || '').trim();
    const targetId = Number(req.body?.target_id || 0);
    const reason = String(req.body?.reason || '').trim();
    if (!targetType || !targetId) return res.status(400).json({ error: 'target_type and target_id are required.' });
    const bypass = await canBypassAssignmentOwnership(req.user);
    if (targetType === 'document_file') {
      const doc = await dbGet(`
        SELECT d.*, p.name as project_name, p.requester, p.stage as proj_stage, p.assigned_user_id as project_assigned_user_id, u.username as uploader_username
        FROM Documents d
        JOIN Projects p ON p.id = d.project_id
        LEFT JOIN Users u ON u.id = d.uploader_user_id
        WHERE d.id = ?
      `, [targetId]);
      if (!doc || !doc.file_path) return res.status(404).json({ error: 'Document file not found' });
      if (!doc.uploader_user_id) return res.status(400).json({ error: 'Document uploader is unknown.' });
      if (Number(doc.uploader_user_id) === Number(req.user.id) || bypass) return res.status(400).json({ error: 'You can delete this item directly.' });
      if (doc.assigned_user_id) return res.status(403).json({ error: 'This document is assigned to another user.' });
      const result = await createDeletionRequest({ req, targetType, targetId, projectId: doc.project_id, documentId: doc.id, ownerUserId: doc.uploader_user_id, ownerUsername: doc.uploader_username || '', reason, targetName: `file ${doc.file_name || doc.document_type_name}`, targetSnapshot: doc });
      return deletionRequestResponse(res, result);
    }
    if (targetType === 'project') {
      const project = await dbGet(`
        SELECT p.*, (SELECT user_id FROM ActivityLogs WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL ORDER BY datetime(created_at) ASC, id ASC LIMIT 1) as creator_user_id,
                  (SELECT COUNT(*) FROM Documents WHERE project_id = p.id AND file_path IS NOT NULL) as uploaded_file_count,
                  (SELECT u.username FROM ActivityLogs al JOIN Users u ON u.id = al.user_id WHERE al.project_id = p.id AND al.action = 'CREATE_PROJECT' AND al.user_id IS NOT NULL ORDER BY datetime(al.created_at) ASC, al.id ASC LIMIT 1) as creator_username
        FROM Projects p WHERE p.id = ?
      `, [targetId]);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (Number(project.uploaded_file_count || 0) > 0 && req.user.role !== 'superadmin') return res.status(403).json({ error: 'Only superadmin can delete a project with uploaded documents.' });
      if (!project.creator_user_id) return res.status(400).json({ error: 'Project creator is unknown.' });
      if (Number(project.creator_user_id) === Number(req.user.id) || bypass) return res.status(400).json({ error: 'You can delete this item directly.' });
      if (project.assigned_user_id) return res.status(403).json({ error: 'This project is assigned to another user.' });
      const result = await createDeletionRequest({ req, targetType, targetId, projectId: project.id, ownerUserId: project.creator_user_id, ownerUsername: project.creator_username || '', reason, targetName: `project ${project.name}`, targetSnapshot: project });
      return deletionRequestResponse(res, result);
    }
    if (targetType === 'calendar_attachment') {
      const attachment = await dbGet(`
        SELECT a.*, ce.related_project_id as project_id, ce.related_document_id as document_id, ce.title as event_title, u.username as uploader_username
        FROM CalendarEventAttachments a
        JOIN CalendarEvents ce ON ce.id = a.event_id
        LEFT JOIN Users u ON u.id = a.uploaded_by_user_id
        WHERE a.id = ?
      `, [targetId]);
      if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
      if (!attachment.uploaded_by_user_id) return res.status(400).json({ error: 'Attachment uploader is unknown.' });
      if (Number(attachment.uploaded_by_user_id) === Number(req.user.id) || bypass) return res.status(400).json({ error: 'You can delete this item directly.' });
      const result = await createDeletionRequest({ req, targetType, targetId, projectId: attachment.project_id || null, documentId: attachment.document_id || null, ownerUserId: attachment.uploaded_by_user_id, ownerUsername: attachment.uploader_username || '', reason, targetName: `calendar attachment ${attachment.original_name || attachment.file_name}`, targetSnapshot: attachment });
      return deletionRequestResponse(res, result);
    }
    res.status(400).json({ error: 'Unsupported deletion request target.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create deletion request' });
  }
};

const __routeController055 = async (req, res) => {
  try {
    const request = await dbGet(`${deletionRequestSelect} WHERE dr.id = ?`, [Number(req.params.id)]);
    if (!request) return res.status(404).json({ error: 'Deletion request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Deletion request is no longer pending.' });
    const bypass = await canBypassAssignmentOwnership(req.user);
    if (Number(request.owner_user_id) !== Number(req.user.id) && !bypass) return forbidden(res, 'Only the owner can approve this deletion request.');
    const label = await performApprovedDeletionRequest(req, request);
    await dbRun(`UPDATE DeletionRequests SET status='approved', responded_at=?, responded_by_user_id=?, response_note=? WHERE id=?`, [new Date().toISOString(), req.user.id, req.body?.response_note || '', request.id]);
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'deletion_request_approved',
      message: `Your deletion request for ${label} was approved.`,
      projectId: request.project_id,
      documentId: request.document_id,
      targetKind: 'deletion_request',
      targetMeta: { deletion_request_id: request.id, target_type: request.target_type, target_id: request.target_id, status: 'approved' },
      includeActor: false
    });
    logActivity({ req, action: 'DELETE_REQUEST_APPROVED', projectId: request.project_id, docType: request.target_type, details: `Approved deletion request #${request.id}` });
    res.json({ success: true });
  } catch (err) {
    logError('DELETE_REQUEST_APPROVE', err.message, err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Failed to approve deletion request' });
  }
};

const __routeController056 = async (req, res) => {
  try {
    const request = await dbGet(`${deletionRequestSelect} WHERE dr.id = ?`, [Number(req.params.id)]);
    if (!request) return res.status(404).json({ error: 'Deletion request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Deletion request is no longer pending.' });
    const bypass = await canBypassAssignmentOwnership(req.user);
    if (Number(request.owner_user_id) !== Number(req.user.id) && !bypass) return forbidden(res, 'Only the owner can deny this deletion request.');
    await dbRun(`UPDATE DeletionRequests SET status='denied', responded_at=?, responded_by_user_id=?, response_note=? WHERE id=?`, [new Date().toISOString(), req.user.id, req.body?.response_note || '', request.id]);
    const snapshot = parseNotificationMeta(request.target_snapshot);
    const label = snapshot.document_type_name || snapshot.file_name || snapshot.name || request.target_type;
    insertNotifications({
      recipients: [request.requested_by_user_id],
      actorId: req.user.id,
      type: 'deletion_request_denied',
      message: `Your deletion request for ${label} was denied.`,
      projectId: request.project_id,
      documentId: request.document_id,
      targetKind: 'deletion_request',
      targetMeta: { deletion_request_id: request.id, target_type: request.target_type, target_id: request.target_id, status: 'denied' },
      includeActor: false
    });
    logActivity({ req, action: 'DELETE_REQUEST_DENIED', projectId: request.project_id, docType: request.target_type, details: `Denied deletion request #${request.id}` });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to deny deletion request' });
  }
};

const __routeController057 = (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  console.log('Password change request for user:', req.user?.id);
  
  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All password fields are required.' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }
  
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }
  
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password.' });
  }
  
  // Verify current password
  db.get("SELECT id, username, password_hash, role, must_change_password FROM Users WHERE id = ?", [req.user.id], (err, user) => {
    if (err) {
      console.error('Database error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!verifyPassword(currentPassword, user.password_hash)) {
      console.log('Current password verification failed for user:', user.username);
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    
    // Update password
    const newPasswordHash = hashPassword(newPassword);
    console.log('Updating password for user:', user.username, 'userId:', req.user.id);
    
    db.run("UPDATE Users SET password_hash = ?, must_change_password = 0 WHERE id = ?", [newPasswordHash, req.user.id], function(err) {
      if (err) {
        console.error('Database error updating password:', err);
        return res.status(500).json({ error: 'Failed to update password' });
      }
      
      console.log('Password updated. Rows changed:', this.changes);
      
      if (this.changes === 0) {
        console.error('No rows changed during password update');
        return res.status(400).json({ error: 'Password update failed - no changes made' });
      }
      
      // Log activity
      try {
        logActivity({
          req,
          action: 'PASSWORD_CHANGE',
          projectId: null,
          project: '-',
          requester: '-',
          docType: '-',
          details: `User ${user.username} changed own password`
        });
      } catch(e) {
        console.error('Error logging password change activity:', e);
      }
      insertNotifications({
        recipients: [req.user.id],
        actorId: req.user.id,
        type: 'system_password_changed',
        message: 'Your password was changed.',
        targetKind: 'settings',
        targetMeta: { section: 'change-password' },
        includeActor: true
      });
      
      if (Number(user.must_change_password) === 1 && user.role === 'superadmin' && fs.existsSync(BOOTSTRAP_CREDENTIALS_PATH)) {
        try { fs.rmSync(BOOTSTRAP_CREDENTIALS_PATH, { force: true }); } catch (_) {}
      }
      db.run("DELETE FROM UserSessions WHERE user_id = ?", [req.user.id], (sessionErr) => {
        if (sessionErr) console.error('Failed to revoke sessions after password change:', sessionErr);
        res.json({ success: true, message: 'Password changed successfully. Please sign in again.' });
      });
    });
  });
};

const __routeController058 = (req, res) => {
  const now = new Date().toISOString();
  db.run("UPDATE UserSessions SET last_activity_at = ? WHERE token = ?", [now, req.user.token], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      success: true,
      last_activity_at: now,
      inactivity_expires_at: new Date(Date.now() + SESSION_INACTIVITY_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
    });
  });
};

const __routeController059 = (req, res) => {
  // Log logout
  try {
    logActivity({
      req,
      action: 'LOGOUT',
      projectId: null,
      project: '-',
      requester: '-',
      docType: '-',
      details: `User ${req.user.username} logged out`
    });
  } catch(e) {}
  
  db.run("DELETE FROM UserSessions WHERE token = ?", [req.user.token], () => {
    res.json({ success: true });
  });
};
