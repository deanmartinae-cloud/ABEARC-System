app.get('/api/user/theme', __routeController043);

app.put('/api/user/theme', __routeController044);

app.post('/api/me/avatar', __routeController045);

app.delete('/api/me/avatar', __routeController046);

app.get('/api/auth/me', __routeController047);

app.get('/api/notifications', __routeController048);

app.get('/api/notifications/unread-count', __routeController049);

app.get('/api/notifications/stream', requireAuth, __routeController050);

app.patch('/api/notifications/:id/read', __routeController051);

app.patch('/api/notifications/read-all', __routeController052);

const deletionRequestSelect = `
  SELECT dr.*, ru.username as requested_by_current_username, ou.username as owner_current_username
  FROM DeletionRequests dr
  LEFT JOIN Users ru ON ru.id = dr.requested_by_user_id
  LEFT JOIN Users ou ON ou.id = dr.owner_user_id
`;

async function performApprovedDeletionRequest(req, request) {
  const snapshot = parseNotificationMeta(request.target_snapshot);
  if (request.target_type === 'document_file') {
    await deleteDocumentFileInternal(req, request.document_id || request.target_id, { skipStageLog: true });
    return snapshot.document_type_name || snapshot.file_name || 'document file';
  }
  if (request.target_type === 'project') {
    await deleteProjectInternal(req, request.project_id || request.target_id, { confirmUploadedDelete: true });
    return snapshot.name || 'project';
  }
  if (request.target_type === 'calendar_attachment') {
    const attachment = await dbGet(`SELECT * FROM CalendarEventAttachments WHERE id = ?`, [request.target_id]);
    if (!attachment) return snapshot.original_name || snapshot.file_name || 'calendar attachment';
    await dbRun(`DELETE FROM CalendarEventAttachments WHERE id=?`, [attachment.id]);
    const filePath = safeCalendarAttachmentPath(attachment.file_path);
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      await cleanEmptyCalendarAttachmentFolders(filePath);
    }
    return attachment.original_name || attachment.file_name || 'calendar attachment';
  }
  const err = new Error('Unsupported deletion request target.');
  err.status = 400;
  throw err;
}

app.get('/api/deletion-requests', __routeController053);

app.post('/api/deletion-requests', __routeController054);

app.post('/api/deletion-requests/:id/approve', __routeController055);

app.post('/api/deletion-requests/:id/deny', __routeController056);

// User change own password
app.put('/api/user/change-password', requireAuth, __routeController057);

app.post('/api/auth/activity', requireAuth, __routeController058);

app.post('/api/auth/logout', __routeController059);

