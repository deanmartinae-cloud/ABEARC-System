// Controllers extracted from src/backend/routes/05-project-list.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController100 = (req, res) => {
  const query = `
    SELECT p.*, pt.name as type_name, req.name as requestee_name, au.username as assigned_username,
      tr.transitioned_by_username, tr.source_stage, tr.target_stage, tr.remarks as transition_remarks, tr.transitioned_at,
      (SELECT COUNT(*) FROM Documents d 
       WHERE d.project_id = p.id AND d.stage = p.stage AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) IN ('Active', 'Completed') AND COALESCE(d.requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)) as total_req_docs,
      (SELECT COUNT(*) FROM Documents d 
       WHERE d.project_id = p.id AND d.status = 'Checked' AND d.stage = p.stage AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) IN ('Active', 'Completed') AND COALESCE(d.requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)) as checked_docs,
      (SELECT COUNT(*) FROM Documents d 
       WHERE d.project_id = p.id AND d.status = 'For Review' AND d.stage = p.stage AND COALESCE(p.outcome, CASE WHEN p.stage = 'Completed' THEN 'Completed' ELSE 'Active' END) IN ('Active', 'Completed') AND COALESCE(d.requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)) as for_review_docs,
      (SELECT COUNT(*) FROM Documents d
       WHERE d.project_id = p.id AND d.file_path IS NOT NULL) as uploaded_files,
      (SELECT user_id FROM ActivityLogs
       WHERE project_id = p.id AND action = 'CREATE_PROJECT' AND user_id IS NOT NULL
       ORDER BY datetime(created_at) ASC, id ASC LIMIT 1) as creator_user_id,
      (SELECT u.username FROM ActivityLogs al JOIN Users u ON u.id = al.user_id
       WHERE al.project_id = p.id AND al.action = 'CREATE_PROJECT' AND al.user_id IS NOT NULL
       ORDER BY datetime(al.created_at) ASC, al.id ASC LIMIT 1) as creator_username,
      (SELECT COUNT(*) FROM Documents d 
       WHERE d.project_id = p.id AND d.status = 'Checked' AND COALESCE(d.requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)) as total_checked_all_stages
      ,(SELECT COUNT(*) FROM Documents d
       WHERE d.project_id = p.id AND d.stage = 'Monitoring' AND d.status = 'Checked' AND COALESCE(d.requirement_state, 'Required') != 'Not Required' AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)) as monitoring_reviewed_count
    FROM Projects p
    LEFT JOIN ProjectTypes pt ON p.project_type_id = pt.id
    LEFT JOIN Requestees req ON p.requestee_id = req.id
    LEFT JOIN Users au ON au.id = p.assigned_user_id
    LEFT JOIN ProjectTransitions tr ON tr.id = (SELECT id FROM ProjectTransitions WHERE project_id = p.id ORDER BY transitioned_at DESC LIMIT 1)
    ORDER BY p.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({error: "DB error"});
    res.json(rows.map(r => {
      const outcome = normalizeProjectOutcome(r);
      const progress = outcome === 'Completed' || r.stage === 'Completed' ? 100 : (INACTIVE_PROJECT_OUTCOMES.includes(outcome) ? 0 : (r.total_req_docs > 0 ? Math.round((r.checked_docs / r.total_req_docs) * 100) : 0));
      // For Monitoring stage with no documents yet, show Ongoing status instead of 0%
      if (r.stage === 'Monitoring' && r.total_req_docs === 0) {
        return { ...r, outcome, due_at: INACTIVE_PROJECT_OUTCOMES.includes(outcome) ? null : (r.manual_due_date || null), due_date_source: r.manual_due_date && !INACTIVE_PROJECT_OUTCOMES.includes(outcome) ? 'manual' : 'none', progress: 0, reviewed_count: r.total_checked_all_stages, isOngoing: true };
      }
      return { ...r, outcome, due_at: INACTIVE_PROJECT_OUTCOMES.includes(outcome) ? null : (r.manual_due_date || null), due_date_source: r.manual_due_date && !INACTIVE_PROJECT_OUTCOMES.includes(outcome) ? 'manual' : 'none', progress, reviewed_count: r.total_checked_all_stages };
    }));
  });
};
