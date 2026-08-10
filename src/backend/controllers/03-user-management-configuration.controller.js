// Controllers extracted from src/backend/routes/03-user-management-configuration.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController060 = async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT u.id, u.username, u.role, u.avatar_path, u.direct_superior_user_id,
             u.is_system_account, u.hidden_from_workflows, ds.username as direct_superior_username,
             COALESCE(participant_usage.selection_count, 0) as participant_selection_count,
             participant_usage.last_selected_at as participant_last_selected_at
      FROM Users u
      LEFT JOIN Users ds ON ds.id = u.direct_superior_user_id
      LEFT JOIN (
        SELECT cep.user_id,
               COUNT(*) as selection_count,
               MAX(COALESCE(cep.created_at, ce.created_at, ce.updated_at)) as last_selected_at
        FROM CalendarEventParticipants cep
        JOIN CalendarEvents ce ON ce.id = cep.event_id
        WHERE ce.created_by_user_id = ?
        GROUP BY cep.user_id
      ) participant_usage ON participant_usage.user_id = u.id
      WHERE u.role != 'system' AND COALESCE(u.hidden_from_workflows, 0) = 0
      ORDER BY u.role = 'superadmin' DESC, u.role = 'admin' DESC, u.username COLLATE NOCASE ASC
    `, [req.user.id]);
    res.json((rows || []).map(user => ({
      ...userPublicFields(user),
      participant_selection_count: Number(user.participant_selection_count || 0),
      participant_last_selected_at: user.participant_last_selected_at || null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const __routeController061 = async (req, res) => {
  const cleanupAttachment = () => { try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {} };
  try {
    const allowedTypes = new Set(['bug', 'change_request', 'improvement']);
    const allowedPriorities = new Set(['low', 'normal', 'high', 'urgent']);
    const type = String(req.body?.type || '').trim().toLowerCase();
    const title = String(req.body?.title || '').trim();
    const details = String(req.body?.details || '').trim();
    const priority = String(req.body?.priority || 'normal').trim().toLowerCase();
    const attachment = req.file || null;
    if (!allowedTypes.has(type)) { cleanupAttachment(); return res.status(400).json({ error: 'Select a valid feedback type.' }); }
    if (!title || title.length > 180) { cleanupAttachment(); return res.status(400).json({ error: 'Title is required and must be 180 characters or fewer.' }); }
    if (!details || details.length > 5000) { cleanupAttachment(); return res.status(400).json({ error: 'Details are required and must be 5,000 characters or fewer.' }); }
    if (!allowedPriorities.has(priority)) { cleanupAttachment(); return res.status(400).json({ error: 'Select a valid priority.' }); }

    const now = new Date().toISOString();
    const result = await dbRun(`
      INSERT INTO UserFeedback (
        type, title, details, priority, submitted_by_user_id, submitted_by_username, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    `, [type, title, details, priority, req.user.id, req.user.username, now, now]);
    if (attachment) {
      const dir = path.join(USER_FEEDBACK_ATTACHMENTS_DIR, `feedback-${result.lastID}`);
      fs.mkdirSync(dir, { recursive: true });
      const stored = `${Date.now()}_${path.basename(attachment.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      fs.renameSync(attachment.path, path.join(dir, stored));
      await dbRun(`UPDATE UserFeedback SET attachment_path = ?, attachment_file_name = ? WHERE id = ?`, [
        path.relative(DATA_DIR, path.join(dir, stored)),
        attachment.originalname,
        result.lastID
      ]);
    }
    const feedback = await dbGet(`SELECT * FROM UserFeedback WHERE id = ?`, [result.lastID]);
    const reviewerIds = await getSystemMaintenanceUserIds();
    insertNotifications({
      recipients: reviewerIds,
      actorId: req.user.id,
      type: 'user_feedback_submitted',
      message: `${req.user.username} submitted ${type === 'bug' ? 'a bug' : type === 'change_request' ? 'a change request' : 'an improvement'}: ${title}.`,
      targetKind: 'user_feedback',
      targetMeta: { feedback_id: feedback.id, feedback_type: type, priority, title },
      alertKey: `user_feedback:${feedback.id}`,
      dedupeMode: 'none'
    });
    logActivity({
      req,
      action: 'USER_FEEDBACK_SUBMITTED',
      docType: 'Changelog Feedback',
      details: `${type}: ${title}`
    });
    res.status(201).json({ success: true, feedback });
  } catch (err) {
    cleanupAttachment();
    console.error('Feedback submission error:', err);
    res.status(500).json({ error: 'Failed to save feedback.' });
  }
};

const __routeController062 = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['submitted', 'reviewing', 'planned', 'completed', 'closed']);
    const rows = status && allowedStatuses.has(status)
      ? await dbAll(`SELECT * FROM UserFeedback WHERE status = ? ORDER BY datetime(created_at) DESC, id DESC`, [status])
      : await dbAll(`SELECT * FROM UserFeedback ORDER BY datetime(created_at) DESC, id DESC`);
    res.json({ feedback: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load feedback.' });
  }
};

const __routeController063 = async (req, res) => {
  try {
    const feedbackId = Number(req.params.id);
    const status = String(req.body?.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['submitted', 'reviewing', 'planned', 'completed', 'closed']);
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) return res.status(400).json({ error: 'Invalid feedback id.' });
    if (!allowedStatuses.has(status)) return res.status(400).json({ error: 'Select a valid feedback status.' });

    const existing = await dbGet(`SELECT * FROM UserFeedback WHERE id = ?`, [feedbackId]);
    if (!existing) return res.status(404).json({ error: 'Feedback submission not found.' });

    const now = new Date().toISOString();
    await dbRun(`UPDATE UserFeedback SET status = ?, updated_at = ? WHERE id = ?`, [status, now, feedbackId]);
    const feedback = await dbGet(`SELECT * FROM UserFeedback WHERE id = ?`, [feedbackId]);
    logActivity({
      req,
      action: 'USER_FEEDBACK_STATUS_UPDATED',
      docType: 'Changelog Feedback',
      details: `Updated feedback #${feedbackId} from ${existing.status} to ${status}: ${existing.title}`
    });
    res.json({ success: true, feedback });
  } catch (err) {
    console.error('Feedback status update error:', err);
    res.status(500).json({ error: 'Failed to update feedback status.' });
  }
};

const __routeController226 = async (req, res) => {
  try {
    const row = await resolveUserFeedbackAttachment(req.params.id);
    if (!row) return res.status(404).json({ error: 'Feedback attachment not found.' });
    res.sendFile(row.full);
  } catch (err) {
    res.status(500).json({ error: 'Failed to open feedback attachment.' });
  }
};

const __routeController227 = async (req, res) => {
  try {
    const row = await resolveUserFeedbackAttachment(req.params.id);
    if (!row) return res.status(404).json({ error: 'Feedback attachment not found.' });
    res.download(row.full, row.attachment_file_name || path.basename(row.full));
  } catch (err) {
    res.status(500).json({ error: 'Failed to download feedback attachment.' });
  }
};

const __routeController064 = (req, res) => {
  const where = ['superadmin', 'system'].includes(req.user.role) ? '' : `WHERE u.role NOT IN ('superadmin', 'system')`;
  db.all(`SELECT u.id, u.username, u.role, u.avatar_path, u.created_at, u.direct_superior_user_id,
                 u.is_system_account, u.hidden_from_workflows, ds.username as direct_superior_username,
          (SELECT COUNT(*) FROM UserPrivileges up WHERE up.user_id = u.id AND up.enabled = 1) as privilege_count
          FROM Users u
          LEFT JOIN Users ds ON ds.id = u.direct_superior_user_id
          ${where} ORDER BY u.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(row => ({ ...row, avatar_url: avatarUrlForPath(row.avatar_path) })));
  });
};

const __routeController065 = (req, res) => {
  db.get(`SELECT u.id, u.username, u.role, u.avatar_path, u.created_at, u.direct_superior_user_id,
                 u.is_system_account, u.hidden_from_workflows, ds.username as direct_superior_username
          FROM Users u
          LEFT JOIN Users ds ON ds.id = u.direct_superior_user_id
          WHERE u.id = ?`, [req.params.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (['superadmin', 'system'].includes(user.role) && !['superadmin', 'system'].includes(req.user.role)) {
      return forbidden(res, 'Cannot manage protected system accounts.');
    }
    
    db.all(`SELECT privilege, enabled FROM UserPrivileges WHERE user_id = ?`, [req.params.id], (err2, privs) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...user, avatar_url: avatarUrlForPath(user.avatar_path), privileges: privs || [] });
    });
  });
};

const __routeController066 = (req, res) => {
  const { username, password, role } = req.body;
  const requestedPrivileges = Array.isArray(req.body.privileges) ? req.body.privileges : null;
  const directSuperiorUserId = role === 'system' || req.body.direct_superior_user_id === '' || req.body.direct_superior_user_id == null
    ? null
    : Number(req.body.direct_superior_user_id);
  if (!username || !password || !role) return res.status(400).json({ error: 'Username, password, and role are required.' });
  if (!['superadmin', 'admin', 'user', 'system'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (['superadmin', 'system'].includes(role) && !['superadmin', 'system'].includes(req.user.role)) {
    return forbidden(res, 'Only superadmin or system maintenance accounts can create protected accounts.');
  }
  if (directSuperiorUserId !== null && (!Number.isInteger(directSuperiorUserId) || directSuperiorUserId <= 0)) return res.status(400).json({ error: 'Invalid direct superior.' });
  const knownPrivileges = new Set(PRIVILEGE_CATALOG.map(item => item.name));
  if (requestedPrivileges && requestedPrivileges.some(item => !knownPrivileges.has(item.privilege))) {
    return res.status(400).json({ error: 'One or more selected privileges are invalid.' });
  }
  if (!['superadmin', 'system'].includes(req.user.role)
      && requestedPrivileges?.some(item => item.enabled && SUPERADMIN_MANAGED_PRIVILEGES.has(item.privilege))) {
    return forbidden(res, 'Only superadmin or system maintenance accounts can assign protected privileges.');
  }
  
  const passwordHash = hashPassword(password);

  const createUser = () => db.run(`INSERT INTO Users (
      username, password_hash, role, direct_superior_user_id, is_system_account, hidden_from_workflows
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [username, passwordHash, role, directSuperiorUserId, role === 'system' ? 1 : 0, role === 'system' ? 1 : 0], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) return res.status(400).json({ error: 'Username already exists.' });
      return res.status(500).json({ error: err.message });
    }
    const newUserId = this.lastID;
    
    const defaultSet = new Set(ROLE_DEFAULT_PRIVILEGES[role] || []);
    const selectedMap = requestedPrivileges
      ? new Map(requestedPrivileges.map(item => [item.privilege, Boolean(item.enabled)]))
      : null;
    const privStmt = db.prepare("INSERT INTO UserPrivileges (user_id, privilege, enabled) VALUES (?, ?, ?)");
    PRIVILEGE_CATALOG.forEach(item => {
      const enabled = selectedMap ? selectedMap.get(item.name) === true : defaultSet.has(item.name);
      privStmt.run([newUserId, item.name, enabled ? 1 : 0]);
    });
    privStmt.finalize();
    
    try { 
      logActivity({
        req,
        action: 'USER_CREATE',
        projectId: null,
        project: '-',
        requester: '-',
        docType: '-',
        details: `Created ${role} account: ${username}`
      }); 
    } catch(e) {}
    insertNotifications({
      recipients: [newUserId],
      actorId: req.user.id,
      type: 'system_user_created',
      message: `Your ${role} account has been created.`,
      targetKind: 'settings',
      targetMeta: { section: 'change-password' },
      includeActor: Number(newUserId) === Number(req.user.id)
    });
    res.json({ success: true, id: newUserId, message: 'User created successfully.' });
  });
  if (directSuperiorUserId === null) return createUser();
  db.get(`SELECT id FROM Users
          WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`,
    [directSuperiorUserId], (superiorErr, superior) => {
    if (superiorErr) return res.status(500).json({ error: superiorErr.message });
    if (!superior) return res.status(400).json({ error: 'Direct superior not found.' });
    createUser();
  });
};

const __routeController067 = (req, res) => {
  const { role, username } = req.body;
  const hasDirectSuperiorField = Object.prototype.hasOwnProperty.call(req.body || {}, 'direct_superior_user_id');
  const directSuperiorUserId = !hasDirectSuperiorField || req.body.direct_superior_user_id === '' || req.body.direct_superior_user_id == null ? null : Number(req.body.direct_superior_user_id);
  if (role && !['superadmin', 'admin', 'user', 'system'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (['superadmin', 'system'].includes(role) && !['superadmin', 'system'].includes(req.user.role)) {
    return forbidden(res, 'Only superadmin or system maintenance accounts can assign protected roles.');
  }
  if (hasDirectSuperiorField && directSuperiorUserId !== null && (!Number.isInteger(directSuperiorUserId) || directSuperiorUserId <= 0)) return res.status(400).json({ error: 'Invalid direct superior.' });
  const nextUsername = username ? String(username).trim() : '';
  
  db.get(`SELECT id, username, role, direct_superior_user_id FROM Users WHERE id = ?`, [req.params.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (['superadmin', 'system'].includes(user.role) && !['superadmin', 'system'].includes(req.user.role)) {
      return forbidden(res, 'Cannot manage protected system accounts.');
    }
    const proceedUpdate = () => {
      const updates = [];
      const params = [];
      if (nextUsername && nextUsername !== user.username) {
        updates.push('username = ?');
        params.push(nextUsername);
      }
      if (role && role !== user.role) {
        updates.push('role = ?', 'is_system_account = ?', 'hidden_from_workflows = ?');
        params.push(role, role === 'system' ? 1 : 0, role === 'system' ? 1 : 0);
        if (role === 'system') updates.push('direct_superior_user_id = NULL');
      }
      if (role !== 'system' && hasDirectSuperiorField && Number(directSuperiorUserId || 0) !== Number(user.direct_superior_user_id || 0)) {
        updates.push('direct_superior_user_id = ?');
        params.push(directSuperiorUserId);
      }
      if (updates.length === 0) return res.json({ success: true, changed: false, message: 'No account changes detected.' });
      const updateSQL = `UPDATE Users SET ${updates.join(', ')} WHERE id = ?`;
      params.push(req.params.id);
      db.run(updateSQL, params, function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        const changedParts = [
          nextUsername && nextUsername !== user.username ? `username to ${nextUsername}` : '',
          role && role !== user.role ? `role to ${role}` : '',
          hasDirectSuperiorField && Number(directSuperiorUserId || 0) !== Number(user.direct_superior_user_id || 0) ? `direct superior updated` : ''
        ].filter(Boolean);
        const roleChanged = !!(role && role !== user.role);
        try { 
          logActivity({
            req,
            action: hasDirectSuperiorField && Number(directSuperiorUserId || 0) !== Number(user.direct_superior_user_id || 0) ? 'DIRECT_SUPERIOR_UPDATED' : 'USER_UPDATE',
            projectId: null,
            project: '-',
            requester: '-',
            docType: '-',
            details: `Updated user ${user.username}: ${changedParts.join(', ')}`
          }); 
        } catch(e) {}
        insertNotifications({
          recipients: [Number(req.params.id)],
          actorId: req.user.id,
          type: roleChanged ? 'system_user_role_changed' : 'system_account_updated',
          message: `${req.user.username} updated your account${changedParts.length ? `: ${changedParts.join(', ')}` : ''}.`,
          targetKind: 'settings',
          targetMeta: { section: 'appearance' }
        });
        res.json({ success: true, changed: true, message: 'User updated successfully.' });
      });
    };
    const validateSystemConversion = (next) => {
      if (role !== 'system' || user.role === 'system') return next();
      db.get(`
        SELECT
          (SELECT COUNT(*) FROM Projects WHERE assigned_user_id = ?) +
          (SELECT COUNT(*) FROM Documents WHERE assigned_user_id = ?) +
          (SELECT COUNT(*) FROM CalendarEventParticipants WHERE user_id = ?) +
          (SELECT COUNT(*) FROM Users WHERE direct_superior_user_id = ?) AS workflow_links
      `, [req.params.id, req.params.id, req.params.id, req.params.id], (linkErr, linked) => {
        if (linkErr) return res.status(500).json({ error: linkErr.message });
        if (Number(linked?.workflow_links || 0) > 0) {
          return res.status(409).json({
            error: 'Remove this user from project/document assignments, calendar participants, and direct-superior relationships before converting the account to System / Maintenance.'
          });
        }
        next();
      });
    };
    if (nextUsername && nextUsername !== user.username) {
      return db.get(`SELECT id FROM Users WHERE username = ? AND id != ?`, [nextUsername, req.params.id], (dupeErr, dupeRow) => {
        if (dupeErr) return res.status(500).json({ error: dupeErr.message });
        if (dupeRow) return res.status(400).json({ error: 'Username already exists.' });
        validateSystemConversion(proceedUpdate);
      });
    }
    if (role === 'system') return validateSystemConversion(proceedUpdate);
    if (hasDirectSuperiorField) {
      if (directSuperiorUserId !== null && Number(directSuperiorUserId) === Number(req.params.id)) return res.status(400).json({ error: 'A user cannot be their own direct superior.' });
      if (directSuperiorUserId !== null) {
        return db.get(`SELECT id FROM Users
                       WHERE id = ? AND role != 'system' AND COALESCE(hidden_from_workflows, 0) = 0`,
          [directSuperiorUserId], (superiorErr, superior) => {
          if (superiorErr) return res.status(500).json({ error: superiorErr.message });
          if (!superior) return res.status(400).json({ error: 'Direct superior not found.' });
          proceedUpdate();
        });
      }
    }
    proceedUpdate();
  });
};

const __routeController068 = (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.user?.id;
  
  // Prevent deleting currently logged-in user
  if (parseInt(userId) === currentUserId) {
    return res.status(403).json({ error: 'Cannot delete your own account while logged in.' });
  }
  
  db.get(`SELECT username, role FROM Users WHERE id = ?`, [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (['superadmin', 'system'].includes(user.role) && !['superadmin', 'system'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot delete protected system accounts.' });
    }
    
    // Use a transaction to ensure all deletes happen atomically
    db.serialize(() => {
        db.run("BEGIN TRANSACTION", (transErr) => {
        if (transErr) {
          return res.status(500).json({ error: 'Failed to start transaction: ' + transErr.message });
        }
        
        // Delete in correct order to avoid foreign key violations
        // 1. Clear direct superior references first
        db.run(`UPDATE Users SET direct_superior_user_id = NULL WHERE direct_superior_user_id = ?`, [userId], (superiorErr) => {
          if (superiorErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Failed to clear direct superior assignments: ' + superiorErr.message });
          }

        // 2. Delete UserPrivileges
        db.run(`DELETE FROM UserPrivileges WHERE user_id = ?`, [userId], (privErr) => {
          if (privErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Failed to delete user privileges: ' + privErr.message });
          }
          
          // 2. Delete UserSessions
          db.run(`DELETE FROM UserSessions WHERE user_id = ?`, [userId], (sessErr) => {
            if (sessErr) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: 'Failed to delete user sessions: ' + sessErr.message });
            }
            
            // 3. Delete or detach user-linked records that have foreign keys
            const auditSql = user.role === 'system'
              ? `UPDATE ActivityLogs SET user_id = NULL WHERE user_id = ?`
              : `DELETE FROM ActivityLogs WHERE user_id = ?`;
            db.run(auditSql, [userId], (logErr) => {
              if (logErr) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Failed to delete activity logs: ' + logErr.message });
              }

              db.run(`DELETE FROM Notifications WHERE recipient_user_id = ?`, [userId], (notifyDeleteErr) => {
                if (notifyDeleteErr) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: 'Failed to delete user notifications: ' + notifyDeleteErr.message });
                }

                db.run(`UPDATE Notifications SET actor_user_id = NULL WHERE actor_user_id = ?`, [userId], (notifyActorErr) => {
                  if (notifyActorErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Failed to detach user notifications: ' + notifyActorErr.message });
                  }
              
              db.all(`
                SELECT d.id, d.project_id, d.document_type_name, p.name as project_name, p.requester
                FROM Documents d
                JOIN Projects p ON p.id = d.project_id
                WHERE d.assigned_user_id = ?
              `, [userId], (assignedErr, assignedDocs) => {
                if (assignedErr) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: 'Failed to find assigned documents: ' + assignedErr.message });
                }

                db.run(`UPDATE Documents SET assigned_user_id = NULL WHERE assigned_user_id = ?`, [userId], (clearErr) => {
                  if (clearErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Failed to clear document assignments: ' + clearErr.message });
                  }

                  (assignedDocs || []).forEach(doc => {
                    db.run(`INSERT INTO DocumentOwnershipHistory (
                      document_id, project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
                      actor_user_id, actor_username, action
                    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, 'CLEAR_ASSIGNMENT')`,
                    [doc.id, doc.project_id, userId, user.username, req.user.id, req.user.username]);
                    logActivity({
                      req,
                      action: 'CLEAR_ASSIGNMENT',
                      projectId: doc.project_id,
                      project: doc.project_name,
                      requester: doc.requester,
                      docType: doc.document_type_name,
                      details: `Cleared assignment because ${user.username} was deleted`
                    });
                  });

                  db.all(`SELECT id, name, requester FROM Projects WHERE assigned_user_id = ?`, [userId], (projectAssignErr, assignedProjects) => {
                    if (projectAssignErr) {
                      db.run("ROLLBACK");
                      return res.status(500).json({ error: 'Failed to find assigned projects: ' + projectAssignErr.message });
                    }

                    db.run(`UPDATE Projects SET assigned_user_id = NULL WHERE assigned_user_id = ?`, [userId], (projectClearErr) => {
                      if (projectClearErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Failed to clear project assignments: ' + projectClearErr.message });
                      }

                      (assignedProjects || []).forEach(project => {
                        db.run(`INSERT INTO ProjectOwnershipHistory (
                          project_id, previous_owner_id, previous_owner_username, new_owner_id, new_owner_username,
                          actor_user_id, actor_username, action
                        ) VALUES (?, ?, ?, NULL, NULL, ?, ?, 'CLEAR_PROJECT_ASSIGNMENT')`,
                        [project.id, userId, user.username, req.user.id, req.user.username]);
                        logActivity({
                          req,
                          action: 'CLEAR_PROJECT_ASSIGNMENT',
                          projectId: project.id,
                          project: project.name,
                          requester: project.requester,
                          docType: '-',
                          details: `Cleared project assignment because ${user.username} was deleted`
                        });
                      });

                  // 4. Finally delete the user
                  db.run(`DELETE FROM Users WHERE id = ?`, [userId], function(delErr) {
                    if (delErr) {
                      db.run("ROLLBACK");
                      return res.status(500).json({ error: 'Failed to delete user: ' + delErr.message });
                    }
                    
                    // Commit the transaction
                    db.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        return res.status(500).json({ error: 'Failed to commit transaction: ' + commitErr.message });
                      }
                      
                      // Log the deletion activity (after successful commit)
                      try { 
                        logActivity({
                          req,
                          action: 'USER_DELETE',
                          projectId: null,
                          project: '-',
                          requester: '-',
                          docType: '-',
                          details: `Deleted ${user.role} account: ${user.username}`
                        }); 
                      } catch(e) {}
                      
                      res.json({ success: true, message: 'User deleted successfully.' });
                  });
                });
              });
            });
          });
        });
        });
      });
    });
  });
});
        });
      });
    });
  });
};

const __routeController069 = (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required.' });
  
  db.get(`SELECT username, role FROM Users WHERE id = ?`, [req.params.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (['superadmin', 'system'].includes(user.role) && !['superadmin', 'system'].includes(req.user.role)) {
      return forbidden(res, 'Cannot manage protected system accounts.');
    }
    
    const passwordHash = hashPassword(password);
    db.run(`UPDATE Users SET password_hash = ? WHERE id = ?`, [passwordHash, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      try { 
        logActivity({
          req,
          action: 'USER_PASSWORD_CHANGE',
          projectId: null,
          project: '-',
          requester: '-',
          docType: '-',
          details: `Password changed for user: ${user.username}`
        }); 
      } catch(e) {}
      insertNotifications({
        recipients: [Number(req.params.id)],
        actorId: req.user.id,
        type: 'system_password_changed',
        message: `${req.user.username} changed your password.`,
        targetKind: 'settings',
        targetMeta: { section: 'change-password' }
      });
      res.json({ success: true, message: 'Password updated successfully.' });
    });
  });
};

const __routeController070 = (req, res) => {
  res.json({ catalog: PRIVILEGE_CATALOG, defaults: ROLE_DEFAULT_PRIVILEGES });
};

const __routeController071 = (req, res) => {
  return res.json(PRIVILEGE_CATALOG);
  const privileges = [
    // Project Management
    { name: 'create_project', description: 'Can create new projects', category: 'Project Management' },
    { name: 'edit_project', description: 'Can edit existing projects', category: 'Project Management' },
    { name: 'delete_project', description: 'Can delete projects', category: 'Project Management' },
    { name: 'transition_stage', description: 'Can transition project stages (Proposal → Implementation → Monitoring → Completed)', category: 'Project Management' },
    
    // Document Management
    { name: 'upload_document', description: 'Can upload documents', category: 'Document Management' },
    { name: 'delete_document', description: 'Can delete uploaded files in an opened project', category: 'Document Management' },
    { name: 'mark_checked', description: 'Can mark uploaded documents/reviews as checked', category: 'Document Management' },
    { name: 'edit_requirement_state', description: 'Can change document requirement states such as Required, Optional, and Not Required', category: 'Document Management' },
    { name: 'set_manual_due_date', description: 'Can manually override and set project/document due dates', category: 'Document Management' },
    { name: 'export_project_documents', description: 'Can export project documents as PDF', category: 'Document Management' },
    
    // Configuration
    { name: 'manage_requirements', description: 'Manage requirement mappings', category: 'Configuration' },
    { name: 'manage_due_schedules', description: 'Manage document type due schedules', category: 'Configuration' },
    { name: 'manage_document_types', description: 'Manage document types', category: 'Configuration' },
    { name: 'manage_project_types', description: 'Manage project types', category: 'Configuration' },
    { name: 'manage_requestees', description: 'Manage requestees', category: 'Configuration' }
  ];
  res.json(privileges);
};

const __routeController072 = (req, res) => {
  const { privileges } = req.body; // Array of { privilege: string, enabled: boolean }
  if (!Array.isArray(privileges)) return res.status(400).json({ error: 'Privileges must be an array.' });
  const known = new Set(PRIVILEGE_CATALOG.map(p => p.name));
  const invalid = privileges.find(p => !known.has(p.privilege));
  if (invalid) return res.status(400).json({ error: `Unknown privilege: ${invalid.privilege}` });
  if (!['superadmin', 'system'].includes(req.user.role)
      && privileges.some(p => p.enabled && SUPERADMIN_MANAGED_PRIVILEGES.has(p.privilege))) {
    return forbidden(res, 'Only superadmin or system maintenance accounts can assign protected privileges.');
  }
  const submittedMap = new Map();
  privileges.forEach(p => submittedMap.set(p.privilege, !!p.enabled));
  const normalizedPrivileges = Array.from(submittedMap, ([privilege, enabled]) => ({ privilege, enabled }));
  
  db.get(`SELECT username, role FROM Users WHERE id = ?`, [req.params.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (['superadmin', 'system'].includes(user.role) && !['superadmin', 'system'].includes(req.user.role)) {
      return forbidden(res, 'Cannot manage protected system accounts.');
    }
    if (user.role === 'user' && normalizedPrivileges.some(p => p.enabled && ADMIN_ONLY_PRIVILEGES.has(p.privilege))) {
      return forbidden(res, 'Admin-only privileges cannot be assigned to regular users.');
    }

    db.all(`SELECT privilege, enabled FROM UserPrivileges WHERE user_id = ?`, [req.params.id], (oldErr, oldRows) => {
      if (oldErr) return res.status(500).json({ error: oldErr.message });
      const oldMap = new Map((oldRows || []).map(row => [row.privilege, row.enabled === 1]));
      const enabledPrivileges = normalizedPrivileges
        .filter(p => p.enabled && oldMap.get(p.privilege) !== true)
        .map(p => p.privilege);
      const disabledPrivileges = normalizedPrivileges
        .filter(p => !p.enabled && oldMap.get(p.privilege) === true)
        .map(p => p.privilege);

      if (enabledPrivileges.length === 0 && disabledPrivileges.length === 0) {
        return res.json({ success: true, changed: false, message: 'No privilege changes detected.' });
      }

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        const upsertStmt = db.prepare(`
          INSERT INTO UserPrivileges (user_id, privilege, enabled) 
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, privilege) DO UPDATE SET enabled = ?
        `);
        
        normalizedPrivileges.forEach(p => {
          upsertStmt.run([req.params.id, p.privilege, p.enabled ? 1 : 0, p.enabled ? 1 : 0]);
        });
        
        upsertStmt.finalize();
        db.run("COMMIT", (commitErr) => {
          if (commitErr) return res.status(500).json({ error: commitErr.message });
          const enabledNames = listPrivilegeNames(enabledPrivileges);
          const disabledNames = listPrivilegeNames(disabledPrivileges);
          const changes = [
            enabledNames.length ? `Enabled: ${enabledNames.join(', ')}` : '',
            disabledNames.length ? `Disabled: ${disabledNames.join(', ')}` : ''
          ].filter(Boolean).join('. ');
          const targetMeta = {
            section: 'user-management',
            enabled_privileges: enabledPrivileges,
            disabled_privileges: disabledPrivileges,
            enabled_privilege_names: enabledNames,
            disabled_privilege_names: disabledNames,
            changed_by: req.user.username
          };
        try { 
          logActivity({
            req,
            action: 'USER_PRIVILEGES_UPDATE',
            projectId: null,
            project: '-',
            requester: '-',
            docType: '-',
            details: `Updated privileges for user: ${user.username}. ${changes}.`
          }); 
        } catch(e) {}
        insertNotifications({
          recipients: [Number(req.params.id)],
          actorId: req.user.id,
          type: 'system_permission_changed',
          message: `${req.user.username} updated your permissions.`,
          targetKind: 'settings',
          targetMeta,
          alertKey: `permission_changed:${req.params.id}:${Date.now()}`
        });
          res.json({
            success: true,
            changed: true,
            message: 'Privileges updated successfully.',
            enabled_privileges: enabledPrivileges,
            disabled_privileges: disabledPrivileges,
            enabled_privilege_names: enabledNames,
            disabled_privilege_names: disabledNames
          });
        });
      });
    });
  });
};

const __routeController073 = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const params = [];
    const where = [];
    if (status === 'conflict') {
      where.push("ccr.status IN ('conflict', 'already_changed')");
    } else if (status && status !== 'all') {
      where.push('ccr.status = ?');
      params.push(status);
    }
    if (req.user.role === 'superadmin') {
      // Superadmin oversight sees all requests.
    } else {
      where.push('(ccr.direct_superior_user_id = ? OR ccr.requester_user_id = ?)');
      params.push(req.user.id, req.user.id);
    }
    const rows = await dbAll(`
      SELECT ccr.*, ds.username as direct_superior_username, au.username as approver_display_name
      FROM ${CONFIG_REQUEST_TABLE} ccr
      LEFT JOIN Users ds ON ds.id = ccr.direct_superior_user_id
      LEFT JOIN Users au ON au.id = ccr.approver_user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CASE ccr.status WHEN 'pending' THEN 0 ELSE 1 END, datetime(ccr.created_at) DESC, ccr.id DESC
      LIMIT 200
    `, params);
    const payload = await Promise.all(rows.map(async row => ({
      ...normalizeConfigRequestRow(row),
      preview: await formatConfigurationChangePreview(row, req.user)
    })));
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load configuration change requests.' });
  }
};

const __routeController074 = async (req, res) => {
  try {
    const params = ['pending'];
    const where = ['status = ?'];
    if (req.user.role !== 'superadmin') {
      where.push('(direct_superior_user_id = ? OR requester_user_id = ?)');
      params.push(req.user.id, req.user.id);
    }
    const row = await dbGet(`SELECT COUNT(*) as count FROM ${CONFIG_REQUEST_TABLE} WHERE ${where.join(' AND ')}`, params);
    res.json({ count: Number(row?.count || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load pending count.' });
  }
};

const __routeController075 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await dbGet(`
      SELECT ccr.*, ds.username as direct_superior_username, au.username as approver_display_name
      FROM ${CONFIG_REQUEST_TABLE} ccr
      LEFT JOIN Users ds ON ds.id = ccr.direct_superior_user_id
      LEFT JOIN Users au ON au.id = ccr.approver_user_id
      WHERE ccr.id = ?
    `, [id]);
    if (!request) return res.status(404).json({ error: 'Configuration change request not found.' });
    const allowed = req.user.role === 'superadmin'
      || Number(request.direct_superior_user_id) === Number(req.user.id)
      || Number(request.requester_user_id) === Number(req.user.id);
    if (!allowed) return forbidden(res, 'You are not allowed to view this configuration change request.');
    res.json({
      ...normalizeConfigRequestRow(request),
      preview: await formatConfigurationChangePreview(request, req.user)
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load configuration change request.' });
  }
};

const __routeController076 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await dbGet(`SELECT * FROM ${CONFIG_REQUEST_TABLE} WHERE id = ?`, [id]);
    if (!request) return res.status(404).json({ error: 'Configuration change request not found.' });
    if (request.status !== 'pending') return res.status(409).json({ error: `Request is already ${request.status}.` });
    if (Number(request.requester_user_id) === Number(req.user.id)) return forbidden(res, 'Requester cannot approve their own configuration change request.');
    if (req.user.role !== 'superadmin' && Number(request.direct_superior_user_id) !== Number(req.user.id)) {
      logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_UNAUTHORIZED_APPROVAL', docType: request.config_section, details: `Unauthorized approval attempt for request #${id}.` });
      return forbidden(res, 'Only the assigned Direct Superior can approve this configuration change request.');
    }

    const conflict = await ensureNoConfigurationConflict(request);
    if (conflict) {
      const now = new Date().toISOString();
      const conflictStatus = conflict.status || 'conflict';
      const conflictMessage = conflict.message || 'Cannot apply because the configuration has changed since request submission.';
      const currentNowJson = stableJsonString(conflict.current_now ?? null);
      await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
        SET status = ?, approver_user_id = ?, approver_username = ?, approver_remarks = ?, decided_at = ?, conflict_reason = ?, current_now_json = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
        [conflictStatus, req.user.id, req.user.username, conflictMessage, now, conflictMessage, currentNowJson, now, id]);
      insertNotifications({
        recipients: [request.requester_user_id],
        actorId: req.user.id,
        type: 'configuration_request_conflict',
        message: `Your Configuration change request could not be approved because the configuration was changed before approval. ${conflictMessage}`,
        targetKind: 'settings',
        targetMeta: { section: 'pending-confirmations', request_id: id },
        alertKey: `configuration_change_request_decision:${id}`
      });
      logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_CONFLICT', docType: request.config_section, details: `Request #${id} blocked by conflict: ${conflictMessage}` });
      return res.status(409).json({ error: conflictMessage, status: conflictStatus });
    }

    const now = new Date().toISOString();
    const remarks = String(req.body?.remarks || req.body?.review_remarks || '').trim();
    const result = await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
      SET status = 'approved', approver_user_id = ?, approver_username = ?, approver_remarks = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
      [req.user.id, req.user.username, remarks, now, now, id]);
    if (!result.changes) return res.status(409).json({ error: 'Request was already decided.' });
    try {
      await applyConfigurationRequestChange(request, req);
      await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE} SET applied_at = ?, updated_at = ? WHERE id = ?`, [new Date().toISOString(), new Date().toISOString(), id]);
    } catch (applyErr) {
      const applyMessage = applyErr.message || 'Failed to apply configuration change.';
      await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
        SET status = 'conflict', approver_remarks = ?, conflict_reason = ?, updated_at = ?
        WHERE id = ?`,
        [applyMessage, applyMessage, new Date().toISOString(), id]);
      insertNotifications({
        recipients: [request.requester_user_id],
        actorId: req.user.id,
        type: 'configuration_request_conflict',
        message: `Your Configuration change request could not be applied. ${applyMessage}`,
        targetKind: 'settings',
        targetMeta: { section: 'pending-confirmations', request_id: id },
        alertKey: `configuration_change_request_decision:${id}`
      });
      logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_CONFLICT', docType: request.config_section, details: `Request #${id} could not be applied: ${applyMessage}` });
      throw applyErr;
    }
    insertNotifications({
      recipients: [request.requester_user_id],
      actorId: req.user.id,
      type: 'configuration_request_approved',
      message: `Your Configuration change request was approved and applied.${remarks ? ` Remarks: ${remarks}` : ''}`,
      targetKind: 'settings',
      targetMeta: { section: 'pending-confirmations', request_id: id },
      alertKey: `configuration_change_request_decision:${id}`
    });
    logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_APPROVED', docType: request.config_section, details: `Approved and applied request #${id}.` });
    notifyConfigurationChanged({ req, type: 'configuration_changed', message: `${req.user.username} approved and applied a configuration change request.`, section: request.config_section, targetMeta: { request_id: id } });
    res.json({ success: true });
  } catch (e) {
    logError('CONFIG_CHANGE_REQUEST_APPROVE', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Failed to approve request.' });
  }
};

const __routeController077 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await dbGet(`SELECT * FROM ${CONFIG_REQUEST_TABLE} WHERE id = ?`, [id]);
    if (!request) return res.status(404).json({ error: 'Configuration change request not found.' });
    if (request.status !== 'pending') return res.status(409).json({ error: `Request is already ${request.status}.` });
    if (Number(request.requester_user_id) === Number(req.user.id)) return forbidden(res, 'Requester cannot clear their own configuration change request.');
    if (req.user.role !== 'superadmin' && Number(request.direct_superior_user_id) !== Number(req.user.id)) {
      logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_UNAUTHORIZED_CLEAR', docType: request.config_section, details: `Unauthorized stale-clear attempt for request #${id}.` });
      return forbidden(res, 'Only the assigned Direct Superior can clear this pending configuration change request.');
    }

    const conflict = await ensureNoConfigurationConflict(request);
    if (!conflict) return res.status(400).json({ error: 'This request is still valid. Approve or reject it instead.' });

    const now = new Date().toISOString();
    const conflictStatus = conflict.status || 'conflict';
    const conflictMessage = conflict.message || 'Cannot apply because the configuration has changed since request submission.';
    const currentNowJson = stableJsonString(conflict.current_now ?? null);
    const result = await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
      SET status = ?, approver_user_id = ?, approver_username = ?, approver_remarks = ?, decided_at = ?, conflict_reason = ?, current_now_json = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
      [conflictStatus, req.user.id, req.user.username, conflictMessage, now, conflictMessage, currentNowJson, now, id]);
    if (!result.changes) return res.status(409).json({ error: 'Request was already decided.' });
    insertNotifications({
      recipients: [request.requester_user_id],
      actorId: req.user.id,
      type: 'configuration_request_conflict',
      message: `Your Configuration change request was cleared from pending because it can no longer be applied. ${conflictMessage}`,
      targetKind: 'settings',
      targetMeta: { section: 'pending-confirmations', request_id: id },
      alertKey: `configuration_change_request_decision:${id}`
    });
    logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_CLEARED_STALE', docType: request.config_section, details: `Cleared stale request #${id}: ${conflictMessage}` });
    res.json({ success: true, status: conflictStatus });
  } catch (e) {
    logError('CONFIG_CHANGE_REQUEST_CLEAR_STALE', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Failed to clear pending request.' });
  }
};

const __routeController078 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await dbGet(`SELECT * FROM ${CONFIG_REQUEST_TABLE} WHERE id = ?`, [id]);
    if (!request) return res.status(404).json({ error: 'Configuration change request not found.' });
    if (request.status !== 'pending') return res.status(409).json({ error: `Request is already ${request.status}.` });
    if (Number(request.requester_user_id) === Number(req.user.id)) return forbidden(res, 'Requester cannot reject their own configuration change request.');
    if (req.user.role !== 'superadmin' && Number(request.direct_superior_user_id) !== Number(req.user.id)) {
      logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_UNAUTHORIZED_REJECTION', docType: request.config_section, details: `Unauthorized rejection attempt for request #${id}.` });
      return forbidden(res, 'Only the assigned Direct Superior can reject this configuration change request.');
    }
    const remarks = String(req.body?.remarks || req.body?.review_remarks || '').trim();
    if (!remarks) return res.status(400).json({ error: 'Rejection remarks are required.' });
    const now = new Date().toISOString();
    const result = await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
      SET status = 'rejected', approver_user_id = ?, approver_username = ?, approver_remarks = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
      [req.user.id, req.user.username, remarks, now, now, id]);
    if (!result.changes) return res.status(409).json({ error: 'Request was already decided.' });
    insertNotifications({
      recipients: [request.requester_user_id],
      actorId: req.user.id,
      type: 'configuration_request_rejected',
      message: `Your Configuration change request was rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
      targetKind: 'settings',
      targetMeta: { section: 'pending-confirmations', request_id: id },
      alertKey: `configuration_change_request_decision:${id}`
    });
    logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_REJECTED', docType: request.config_section, details: `Rejected request #${id}.${remarks ? ` Remarks: ${remarks}` : ''}` });
    res.json({ success: true });
  } catch (e) {
    logError('CONFIG_CHANGE_REQUEST_REJECT', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Failed to reject request.' });
  }
};

const __routeController079 = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await dbGet(`SELECT * FROM ${CONFIG_REQUEST_TABLE} WHERE id = ?`, [id]);
    if (!request) return res.status(404).json({ error: 'Configuration change request not found.' });
    if (request.status !== 'pending') return res.status(409).json({ error: `Request is already ${request.status}.` });
    if (req.user.role !== 'superadmin' && Number(request.requester_user_id) !== Number(req.user.id)) {
      return forbidden(res, 'Only the requester can cancel this configuration change request.');
    }
    const now = new Date().toISOString();
    await dbRun(`UPDATE ${CONFIG_REQUEST_TABLE}
      SET status = 'cancelled', approver_user_id = ?, approver_username = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
      [req.user.id, req.user.username, now, now, id]);
    logActivity({ req, action: 'CONFIG_CHANGE_REQUEST_CANCELLED', docType: request.config_section, details: `Cancelled request #${id}.` });
    res.json({ success: true });
  } catch (e) {
    logError('CONFIG_CHANGE_REQUEST_CANCEL', e.message, e.stack);
    res.status(500).json({ error: e.message || 'Failed to cancel request.' });
  }
};

const __routeController080 = (req, res) => {
  const table = tableMap[req.params.type];
  const privilege = privilegeMap[req.params.type];
  if (!table) return res.status(400).json({error: "Invalid type"});
  
  // Apply privilege check for specific settings types
  if (privilege) {
    return checkPrivilege(privilege)(req, res, () => {
      processReorder(req, res, table);
    });
  }
  
  processReorder(req, res, table);
};
