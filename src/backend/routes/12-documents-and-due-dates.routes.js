app.get('/api/documents', requireAuth, __routeController178);

app.get('/api/documents/for-review', requireAuth, __routeController179);

app.get('/api/documents/reviewed', requireAuth, __routeController180);

app.patch('/api/documents/:documentId/assignment', requireAuth, __routeController181);

app.get('/api/documents/:projectId', __routeController182);

app.post('/api/documents/:documentId/upload', checkPrivilege('upload_document'), upload.single('file'), __routeController183);

// Helper function to recalculate due dates for documents that depend on a trigger document
function recalculateDueDatesForDependentDocuments(projectId, uploadedDocTypeId) {
    // Find all document types that have this document type as their start point
    db.all(`
      SELECT rds.document_type_id as id
      FROM Projects p
      JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = p.stage
      JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id
      WHERE p.id = ? AND rds.document_type_start_point = ? AND rds.start_from_document_upload = 1
    `, [projectId, uploadedDocTypeId], (depErr, depRows) => {
        if (depErr || !depRows || depRows.length === 0) return;
        
        const dependentDocTypeIds = depRows.map(r => r.id);
        
        // Update the due_date column for dependent documents in this project
        db.all(`SELECT d.id, COALESCE(rds.due_days, dt.due_days, 0) as due_days, COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours
                FROM Documents d 
                JOIN Projects p ON p.id = d.project_id
                LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id 
                LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
                LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
                WHERE d.project_id = ? AND d.document_type_id IN (${dependentDocTypeIds.map(() => '?').join(',')})`, 
                [projectId, ...dependentDocTypeIds], (docErr, docRows) => {
            if (docErr || !docRows || docRows.length === 0) return;
            
            // Get the upload date of the trigger document
            db.get(`SELECT upload_date FROM Documents 
                    WHERE project_id = ? AND document_type_id = ? AND file_path IS NOT NULL 
                    ORDER BY upload_date ASC LIMIT 1`, 
                    [projectId, uploadedDocTypeId], (triggerErr, triggerRow) => {
                if (triggerErr || !triggerRow || !triggerRow.upload_date) return;
                
                const startDate = new Date(triggerRow.upload_date);
                
                // Update each dependent document's due_date
                docRows.forEach(doc => {
                    let dueDate;
                    if (doc.due_days > 0) {
                        dueDate = addWorkingDays(startDate, doc.due_days);
                        dueDate.setHours(dueDate.getHours() + (doc.due_hours || 0));
                    } else {
                        dueDate = new Date(startDate);
                        dueDate.setHours(dueDate.getHours() + (doc.due_hours || 0));
                    }
                    
                    const dueDateISO = dueDate.toISOString();
                    db.run(`UPDATE Documents SET due_date = ? WHERE id = ?`, [dueDateISO, doc.id], (updateErr) => {
                        if (updateErr) console.error('Failed to update due_date:', updateErr);
                    });
                });
            });
        });
    });
}

app.get('/api/documents/:docId/download', requireAuth, __routeController184);

// Export Project Documents endpoint for project documents
app.get('/api/projects/:id/export-pdf', checkPrivilege('export_project_documents'), __routeController185);

app.delete('/api/documents/:docId', checkPrivilege('manage_requirements'), __routeController186);

async function deleteDocumentFileInternal(req, docId, { stageAccess = null, skipStageLog = false } = {}) {
  const doc = await dbGet(`
    SELECT d.id, d.stage as doc_stage, p.stage as proj_stage, p.id as project_id, p.name as project_name, p.requester,
           p.assigned_user_id as project_assigned_user_id, d.project_id, d.document_type_name, d.file_path, d.file_name,
           d.status, d.requirement_state, d.document_type_id, d.uploader_user_id, d.assigned_user_id,
           uu.username as uploader_username
    FROM Documents d
    JOIN Projects p ON d.project_id = p.id
    LEFT JOIN Users uu ON uu.id = d.uploader_user_id
    WHERE d.id = ?
  `, [docId]);
  if (!doc || !doc.file_path) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const fp = path.join(UPLOADS_DIR, doc.file_path);
  if (fs.existsSync(fp)) {
    try { fs.unlinkSync(fp); } catch(e) { logError('DELETE_FILE_UNLINK', e.message, e.stack); }
    cleanEmptyFolders(path.dirname(fp));
  }
  await dbRun("UPDATE Documents SET file_path=NULL, file_name=NULL, upload_date=NULL, checked_at=NULL, status=? WHERE id=?", ['None', docId]);
  await dbRun("DELETE FROM DocumentSearchIndex WHERE document_id = ?", [docId]).catch(() => {});
  await removeProjectDocumentMapMediaLinks([docId]);
  try { logActivity({ req, action: 'DELETE_FILE', projectId: doc.project_id, project: doc.project_name, requester: doc.requester, docType: doc.document_type_name, details: 'Deleted file' }); } catch(logErr) { logError('DELETE_FILE_LOG', logErr.message, logErr.stack); }
  notifyDocumentEvent({
    req,
    type: 'document_deleted',
    message: `${req.user.username} deleted ${doc.document_type_name}`,
    doc,
    includeUploader: true,
    alertKey: `document_deleted:${doc.id}`,
    dedupeMode: 'cooldown',
    cooldownMinutes: 5
  });
  updateProjectActivity(doc.project_id);
  if (!skipStageLog) logLockedStageEditUse({ req, doc, action: 'delete_file', access: stageAccess, details: `deleted file for ${doc.document_type_name}` });
  return doc;
}

app.delete('/api/documents/:docId/file', checkPrivilege('delete_document'), __routeController187);

app.patch('/api/documents/:documentId/status', checkPrivilege('mark_checked'), __routeController188);

app.patch('/api/documents/:documentId/requirement-state', __routeController189);

// Update manual due date override for a project
app.put('/api/projects/:projectId/due-date', checkPrivilege('set_manual_due_date'), __routeController190);

// Update manual due date override for a document
app.put('/api/documents/:documentId/due-date', checkPrivilege('set_manual_due_date'), __routeController191);

// Get documents for a project with calculated due dates
app.get('/api/projects/:projectId/documents-with-due-dates', __routeController192);

const manilaDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);

const runDueDateAlertSweep = () => {
  db.all(`
    SELECT d.id, d.project_id, d.document_type_name, d.file_path, d.status, d.requirement_state, d.stage, d.uploader_user_id, d.assigned_user_id,
           d.manual_due_date, d.due_date_override, d.due_date,
           COALESCE(rds.due_days, dt.due_days, 0) as due_days,
           COALESCE(rds.due_hours, dt.due_hours, 0) as due_hours,
           COALESCE(rds.document_type_start_point, dt.document_type_start_point, 0) as document_type_start_point,
           COALESCE(rds.start_from_document_upload, dt.start_from_document_upload, 0) as start_from_document_upload,
           p.name as project_name, p.created_at as project_created_at, p.stage as project_stage, p.assigned_user_id as project_assigned_user_id
    FROM Documents d
    JOIN Projects p ON p.id = d.project_id
    LEFT JOIN DocumentTypes dt ON dt.id = d.document_type_id
    LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = d.stage
    LEFT JOIN RequirementSetDueSchedules rds ON rds.requirement_set_id = rs.id AND rds.document_type_id = d.document_type_id
    WHERE p.stage != 'Completed'
      AND COALESCE(p.outcome, 'Active') = 'Active'
      AND COALESCE(d.requirement_state, 'Required') != 'Not Required'
      AND NOT (COALESCE(d.requirement_state, 'Required') = 'Optional' AND d.file_path IS NULL)
      AND COALESCE(d.status, 'None') != 'Checked'
  `, [], (err, rows) => {
    if (err || !rows) return;
    const todayKey = manilaDateKey();
    rows.forEach(doc => {
      getEffectiveDueDate(doc, (effErr, eff) => {
        if (effErr || !eff?.effective_due_date) return;
        const due = new Date(eff.effective_due_date);
        if (Number.isNaN(due.getTime())) return;
        const now = new Date();
        const dueKey = manilaDateKey(due);
        const days = workingDaysUntil(todayKey, dueKey);
        let type = '';
        let message = '';
        if (days === 5) {
          type = 'due_in_5_working_days';
          message = `Document is due in 5 working days: ${doc.document_type_name} for ${doc.project_name}`;
        } else if (days === 1) {
          type = 'due_tomorrow';
          message = `Document is due in 1 working day: ${doc.document_type_name} for ${doc.project_name}`;
        } else if (days === 0) {
          type = 'due_today';
          message = `Document is due today: ${doc.document_type_name} for ${doc.project_name}`;
        } else if (days < 0) {
          const overdueDays = Math.abs(days);
          if (![1, 3, 7].includes(overdueDays) && !(overdueDays > 7 && (overdueDays - 7) % 5 === 0)) return;
          type = `overdue_day_${overdueDays}`;
          message = `Document is overdue (${overdueDays} working day${overdueDays === 1 ? '' : 's'}): ${doc.document_type_name} for ${doc.project_name}`;
        } else {
          return;
        }

        getProjectCreatorId(doc.project_id, (_creatorErr, creatorId) => {
          const recipients = doc.assigned_user_id ? [doc.assigned_user_id] : (doc.project_assigned_user_id ? [doc.project_assigned_user_id] : [creatorId]);
          insertNotifications({
            recipients,
            actorId: null,
            type,
            message,
            projectId: doc.project_id,
            projectName: doc.project_name,
            documentId: doc.id,
            documentName: doc.document_type_name,
            stage: doc.stage,
            targetKind: 'due_date',
            targetMeta: { document_id: doc.id, stage: doc.stage, due_date: eff.effective_due_date },
            alertKey: `${type}:document:${doc.id}`,
            alertDate: todayKey,
            dedupeMode: 'daily'
          });
        });
      });
    });

    db.all(`
      SELECT id, name, requester, stage, assigned_user_id, manual_due_date
      FROM Projects
      WHERE stage != 'Completed'
        AND COALESCE(outcome, 'Active') = 'Active'
        AND manual_due_date IS NOT NULL
    `, [], (projectErr, projects) => {
      if (projectErr || !projects) return;
      const todayKey = manilaDateKey();
      projects.forEach(project => {
        const due = new Date(project.manual_due_date);
        if (Number.isNaN(due.getTime())) return;
        const dueKey = manilaDateKey(due);
        const days = workingDaysUntil(todayKey, dueKey);
        let type = '';
        let message = '';
        if (days === 5) {
          type = 'due_in_5_working_days';
          message = `Project is due in 5 working days: ${project.name}`;
        } else if (days === 1) {
          type = 'due_tomorrow';
          message = `Project is due in 1 working day: ${project.name}`;
        } else if (days === 0) {
          type = 'due_today';
          message = `Project is due today: ${project.name}`;
        } else if (days < 0) {
          const overdueDays = Math.abs(days);
          if (![1, 3, 7].includes(overdueDays) && !(overdueDays > 7 && (overdueDays - 7) % 5 === 0)) return;
          type = `overdue_day_${overdueDays}`;
          message = `Project is overdue (${overdueDays} working day${overdueDays === 1 ? '' : 's'}): ${project.name}`;
        } else {
          return;
        }

        getProjectCreatorId(project.id, (_creatorErr, creatorId) => {
          insertNotifications({
            recipients: uniqueIds([project.assigned_user_id || creatorId]),
            actorId: null,
            type,
            message,
            projectId: project.id,
            projectName: project.name,
            documentId: null,
            documentName: '',
            stage: project.stage,
            targetKind: 'project_due_date',
            targetMeta: { project_due_date: project.manual_due_date, highlight: 'project_due_date' },
            alertKey: `${type}:project:${project.id}`,
            alertDate: todayKey,
            dedupeMode: 'daily'
          });
        });
      });
    });
  });
};

setTimeout(runDueDateAlertSweep, 5000);
setInterval(runDueDateAlertSweep, 60 * 60 * 1000);

const normalizeActivityDateBoundary = (value, boundary) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return `${trimmed} ${boundary === 'end' ? '23:59:59' : '00:00:00'}`;
};

const buildActivityLogFilters = (query) => {
    const { 
        startDate, 
        endDate, 
        username, 
        action, 
        project, 
        docType
    } = query;
    
    let whereClauses = [];
    let params = [];
    
    if (startDate) {
        whereClauses.push('datetime(created_at) >= datetime(?)');
        params.push(normalizeActivityDateBoundary(startDate, 'start'));
    }
    
    if (endDate) {
        whereClauses.push('datetime(created_at) <= datetime(?)');
        params.push(normalizeActivityDateBoundary(endDate, 'end'));
    }
    
    if (username && username.trim()) {
        whereClauses.push('username LIKE ?');
        params.push(`%${username.trim()}%`);
    }
    
    if (action && action.trim()) {
        whereClauses.push('action LIKE ?');
        params.push(`%${action.trim()}%`);
    }
    
    if (project && project.trim()) {
        whereClauses.push('(project_id = ? OR project_name LIKE ?)');
        params.push(project.trim(), `%${project.trim()}%`);
    }
    
    if (docType && docType.trim()) {
        whereClauses.push('document_type LIKE ?');
        params.push(`%${docType.trim()}%`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return { whereClause, params };
};

const activityLogExportDescriptor = (query) => {
    const safe = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    const parts = [];
    if (query.startDate && query.endDate) {
        parts.push(query.startDate === query.endDate ? safe(query.startDate) : `${safe(query.startDate)}_to_${safe(query.endDate)}`);
    } else if (query.startDate) {
        parts.push(`from_${safe(query.startDate)}`);
    } else if (query.endDate) {
        parts.push(`until_${safe(query.endDate)}`);
    } else {
        parts.push('all');
    }
    if (query.username) parts.push(`user_${safe(query.username)}`);
    if (query.action) parts.push(`action_${safe(query.action)}`);
    if (query.project) parts.push(`project_${safe(query.project)}`);
    if (query.docType) parts.push(`document_${safe(query.docType)}`);

    const labelParts = [];
    if (query.startDate || query.endDate) labelParts.push(`Date: ${query.startDate || 'beginning'} to ${query.endDate || 'present'}`);
    if (query.username) labelParts.push(`User: ${query.username}`);
    if (query.action) labelParts.push(`Action: ${query.action}`);
    if (query.project) labelParts.push(`Project: ${query.project}`);
    if (query.docType) labelParts.push(`Document: ${query.docType}`);

    return {
        stem: `activity_logs_${parts.filter(Boolean).join('_')}`.slice(0, 150),
        filterLabel: labelParts.length ? labelParts.join(' | ') : 'Filters: All activity logs'
    };
};

// Get activity logs with filters
