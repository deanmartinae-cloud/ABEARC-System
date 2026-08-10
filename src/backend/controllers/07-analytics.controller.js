// Controllers extracted from src/backend/routes/07-analytics.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController128 = (req, res) => {
  const startDate = req.query.start_date ? String(req.query.start_date) : null;
  const endDate = req.query.end_date ? String(req.query.end_date) : null;
  const stageFilter = req.query.stage ? String(req.query.stage) : '';
  const scopedToMe = String(req.query.scope || '').toLowerCase() === 'my';
  const withDateFilter = startDate && endDate;
  const nowIso = new Date().toISOString();
  const soonIso = addWorkingDaysFromNow(5).toISOString();

  db.all(
    `SELECT id, username, role FROM Users
     WHERE role != 'system'
       AND COALESCE(hidden_from_workflows, 0) = 0
       ${scopedToMe ? 'AND id = ?' : ''}
     ORDER BY username COLLATE NOCASE ASC`,
    scopedToMe ? [req.user.id] : [],
    (userErr, users) => {
    if (userErr) return res.status(500).json({ error: 'DB error' });
    const perUser = new Map((users || []).map(u => [u.id, {
      user_id: u.id, username: u.username, role: u.role,
      assigned_projects: 0,
      active_assigned_projects: 0,
      assigned_documents: 0,
      active_assigned_documents: 0,
      completed_documents: 0,
      for_review_documents: 0,
      overdue_documents: 0,
      due_within_5_days: 0,
      last_activity: null,
      total_assignments: 0,
      active_assignments: 0,
      completed_assignments: 0,
      overdue_assignments: 0,
      for_review_assignments: 0
    }]));

    const updateLastActivity = (stats, value) => {
      if (!stats || !value) return;
      if (!stats.last_activity || new Date(value) > new Date(stats.last_activity)) stats.last_activity = value;
    };

    const projectParams = stageFilter ? [stageFilter] : [];
    db.all(`
      SELECT assigned_user_id as user_id,
             COUNT(DISTINCT id) as assigned_projects,
             SUM(CASE WHEN COALESCE(stage, '') != 'Completed' AND COALESCE(status, '') != 'Completed' AND COALESCE(outcome, CASE WHEN stage = 'Completed' THEN 'Completed' ELSE 'Active' END) = 'Active' THEN 1 ELSE 0 END) as active_assigned_projects,
             MAX(COALESCE(last_activity_at, updated_at, created_at)) as last_activity
      FROM Projects
      WHERE assigned_user_id IS NOT NULL
        ${stageFilter ? 'AND stage = ?' : ''}
      GROUP BY assigned_user_id
    `, projectParams, (projectErr, projectRows) => {
      if (projectErr) return res.status(500).json({ error: 'DB error' });

      (projectRows || []).forEach(row => {
        const stats = perUser.get(row.user_id);
        if (!stats) return;
        stats.assigned_projects = Number(row.assigned_projects || 0);
        stats.active_assigned_projects = Number(row.active_assigned_projects || 0);
        updateLastActivity(stats, row.last_activity);
      });

      db.all(`
        SELECT d.id, d.project_id, d.assigned_user_id as user_id, d.status, d.file_path, d.manual_due_date, d.due_date_override, d.due_date,
               d.upload_date, p.created_at as project_created_at, p.last_activity_at as project_last_activity, p.updated_at as project_updated_at,
               p.stage as project_stage, p.status as project_status, COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) as project_outcome,
               COALESCE(rds.due_days, dt.due_days, 0) as due_days,
               COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
               COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
               COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
               COALESCE(d.requirement_state, 'Required') as requirement_state
        FROM Documents d
        JOIN Projects p ON p.id = d.project_id
        LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
        LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
        LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
        WHERE d.assigned_user_id IS NOT NULL
          AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
          AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
          ${stageFilter ? 'AND d.stage = ?' : ''}
      `, stageFilter ? [stageFilter] : [], (docErr, rows) => {
        if (docErr) return res.status(500).json({ error: 'DB error' });

        const processRow = (i) => {
          if (i >= rows.length) return collectHistory();
          const row = rows[i];
          const stats = perUser.get(row.user_id);
          if (!stats) return processRow(i + 1);

          const projectCompleted = row.project_stage === 'Completed' || row.project_status === 'Completed' || row.project_outcome !== 'Active';
          const checked = row.status === 'Checked';
          const openDocument = !checked && !projectCompleted;

          stats.assigned_documents += 1;
          if (checked) stats.completed_documents += 1;
          if (openDocument) stats.active_assigned_documents += 1;
          if (row.status === 'For Review' && !projectCompleted) stats.for_review_documents += 1;
          updateLastActivity(stats, row.project_last_activity || row.project_updated_at || row.project_created_at);

          getEffectiveDueDate(row, (effErr, effResult) => {
            if (!effErr && effResult?.effective_due_date && openDocument) {
              const dueIso = new Date(effResult.effective_due_date).toISOString();
              if (dueIso < nowIso) stats.overdue_documents += 1;
              if (dueIso >= nowIso && dueIso <= soonIso) stats.due_within_5_days += 1;
            }
            processRow(i + 1);
          });
        };

        const collectHistory = () => {
          const where = withDateFilter ? `WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)` : '';
          const params = withDateFilter ? [startDate, endDate] : [];
          db.all(`
            SELECT created_at as changed_at, 'document' as kind, document_id as item_id, project_id, previous_owner_username, new_owner_username, actor_username as changed_by_username, action
            FROM DocumentOwnershipHistory
            ${where}
            UNION ALL
            SELECT created_at as changed_at, 'project' as kind, project_id as item_id, project_id, previous_owner_username, new_owner_username, actor_username as changed_by_username, action
            FROM ProjectOwnershipHistory
            ${where}
            ORDER BY changed_at DESC
            LIMIT 500
          `, withDateFilter ? [...params, ...params] : [], (histErr, historyRows) => {
            if (histErr) return res.status(500).json({ error: 'DB error' });
            const scopedHistoryRows = scopedToMe
              ? (historyRows || []).filter(row => row.previous_owner_username === req.user.username || row.new_owner_username === req.user.username)
              : (historyRows || []);
            const userStats = Array.from(perUser.values()).map(stats => ({
              ...stats,
              total_assignments: stats.assigned_documents,
              active_assignments: stats.active_assigned_documents,
              completed_assignments: stats.completed_documents,
              for_review_assignments: stats.for_review_documents,
              overdue_assignments: stats.overdue_documents
            }));
            const mostAssignedUser = [...userStats].sort((a, b) => b.assigned_documents - a.assigned_documents)[0] || null;
            const mostOverdueUser = [...userStats].sort((a, b) => b.overdue_documents - a.overdue_documents)[0] || null;
            res.json({
              users: userStats,
              summary: {
                most_assigned_user: mostAssignedUser ? { user_id: mostAssignedUser.user_id, username: mostAssignedUser.username, count: mostAssignedUser.assigned_documents } : null,
                most_overdue_user: mostOverdueUser ? { user_id: mostOverdueUser.user_id, username: mostOverdueUser.username, count: mostOverdueUser.overdue_documents } : null
              },
              history: scopedHistoryRows
            });
          });
        };

        processRow(0);
      });
    });
  });
};
