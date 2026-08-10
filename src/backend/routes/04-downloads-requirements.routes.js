app.get('/api/downloads-forms', requireAuth, __routeController081);

app.post('/api/downloads-forms/upload', requireUploadDownloadsForms, __routeController082);

app.put('/api/downloads-forms/:id', requireAuth, __routeController083);

app.delete('/api/downloads-forms/:id', requireAuth, __routeController084);

app.get('/api/downloads-forms/:id/download', requireAuth, __routeController085);

app.post('/api/downloads-forms/:id/share', requireAuth, __routeController086);

app.get('/api/downloads-forms/:id/shared-download', __routeController087);

app.post('/api/settings/requirements/document-types', checkPrivilege('manage_requirements'), __routeController088);

app.patch('/api/settings/document-due-schedules', checkPrivilege('manage_due_schedules'), __routeController089);

// Update single document type due schedule
app.patch('/api/settings/document-type/:id/due-schedule', checkPrivilege('manage_due_schedules'), __routeController090);

// Get all document types for selector (without circular dependencies)
app.get('/api/document-types/for-selector', __routeController091);

app.get('/api/settings/requirements', __routeController092);

app.get('/api/settings/requirements/reload-override', requireAdmin, __routeController093);

app.patch('/api/settings/requirements/reload-override', requireAdmin, __routeController094);

app.get('/api/settings/requirements/audit', requireAdmin, __routeController095);

app.get('/api/settings/requirements/due-schedules', checkPrivilege('manage_due_schedules'), __routeController096);

app.post('/api/settings/requirements', checkPrivilege('manage_requirements'), __routeController097);

const getRequirementSetId = (projectTypeId, requesteeId, stage, callback) => {
    db.get("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", 
           [projectTypeId, requesteeId, stage], callback);
};

const getStageCompletion = (projectId, stage, callback) => {
    db.get(`
        SELECT
          (SELECT COUNT(*) FROM Documents WHERE project_id = ? AND stage = ? AND ${COUNTABLE_DOCUMENT_EXPR}) as total,
          (SELECT COUNT(*) FROM Documents WHERE project_id = ? AND stage = ? AND status = 'Checked' AND ${COUNTABLE_DOCUMENT_EXPR}) as checked
    `, [projectId, stage, projectId, stage], (err, counts) => {
        if (err) return callback(err);
        const total = counts?.total || 0;
        const checked = counts?.checked || 0;
        callback(null, { total, checked, complete: total > 0 && checked >= total });
    });
};

const getReviewedMonitoringDocumentCount = (projectId, callback) => {
    db.get(`
        SELECT COUNT(*) as checked
        FROM Documents
        WHERE project_id = ?
          AND stage = 'Monitoring'
          AND status = 'Checked'
          AND ${COUNTABLE_DOCUMENT_EXPR}
    `, [projectId], (err, row) => {
        if (err) return callback(err);
        callback(null, Number(row?.checked || 0));
    });
};

const createDocumentsForSet = (projectId, reqSetId, stage, callback) => {
    db.all("SELECT document_type_id, order_index FROM RequirementSetItems WHERE requirement_set_id = ? ORDER BY order_index", [reqSetId], (err, items) => {
        if (err) return callback(err);
        const expectedCount = (items || []).length;
        if (expectedCount === 0) {
            const emptyErr = new Error("Requirement Set application failed. Expected 0 documents but created 0.");
            emptyErr.expected_count = 0;
            emptyErr.created_count = 0;
            return callback(emptyErr);
        }
        const stmt = db.prepare("INSERT INTO Documents (project_id, document_type_id, document_type_name, stage, status, document_order_index) VALUES (?, ?, (SELECT name FROM DocumentTypes WHERE id = ?), ?, 'None', ?)");
        let done = 0;
        let completed = false;
        let finalized = false;
        const fail = (e) => {
            if (completed) return;
            completed = true;
            if (!finalized) {
                finalized = true;
                try { stmt.finalize(); } catch (_) {}
            }
            callback(e);
        };
        items.forEach(it => stmt.run([projectId, it.document_type_id, it.document_type_id, stage, Number(it.order_index || 0)], (e) => {
            if (e) return fail(e);
            if (++done === expectedCount) {
                stmt.finalize((finalizeErr) => {
                    finalized = true;
                    if (finalizeErr) return fail(finalizeErr);
                    db.get("SELECT COUNT(*) as created_count FROM Documents WHERE project_id = ? AND stage = ?", [projectId, stage], (countErr, row) => {
                        if (countErr) return fail(countErr);
                        const createdCount = Number(row?.created_count || 0);
                        if (createdCount !== expectedCount) {
                            const mismatchErr = new Error(`Requirement Set application failed. Expected ${expectedCount} documents but created ${createdCount}.`);
                            mismatchErr.expected_count = expectedCount;
                            mismatchErr.created_count = createdCount;
                            return fail(mismatchErr);
                        }
                        completed = true;
                        callback(null, { expected_count: expectedCount, created_count: createdCount });
                    });
                });
            }
        }));
    });
};

const ensureProjectDocumentsForRequirementSet = (projectId, stage, callback) => {
    if (!['Proposal', 'Implementation'].includes(stage)) return callback(null);
    db.get("SELECT id, project_type_id, requestee_id, stage FROM Projects WHERE id = ?", [projectId], (projectErr, project) => {
        if (projectErr) return callback(projectErr);
        if (!project) return callback(null);
        db.get("SELECT id FROM RequirementSets WHERE project_type_id = ? AND requestee_id = ? AND stage = ?", [project.project_type_id, project.requestee_id, stage], (setErr, set) => {
            if (setErr) return callback(setErr);
            if (!set) return callback(null);
            db.get(`
                SELECT
                  (SELECT COUNT(*) FROM RequirementSetItems WHERE requirement_set_id = ?) as expected_requirement_count,
                  (SELECT COUNT(*) FROM Documents WHERE project_id = ? AND stage = ?) as actual_document_count
            `, [set.id, projectId, stage], (metaErr, meta) => {
                if (metaErr) return callback(metaErr);
                callback(null, {
                    requirement_set_id: set.id,
                    expected_requirement_count: Number(meta?.expected_requirement_count || 0),
                    actual_document_count: Number(meta?.actual_document_count || 0),
                    synced_missing_count: 0
                });
            });
        });
    });
};

const getProjectRequirementMeta = (projectId, stage, syncedMissingCount = 0, callback) => {
    db.get(`
        SELECT p.id, p.project_type_id, p.requestee_id, p.stage as project_stage, rs.id as requirement_set_id,
               (SELECT COUNT(*) FROM RequirementSetItems rsi WHERE rsi.requirement_set_id = rs.id) as expected_requirement_count,
               (SELECT COUNT(*) FROM Documents d WHERE d.project_id = p.id AND d.stage = ?) as actual_document_count
        FROM Projects p
        LEFT JOIN RequirementSets rs ON rs.project_type_id = p.project_type_id AND rs.requestee_id = p.requestee_id AND rs.stage = ?
        WHERE p.id = ?
    `, [stage, stage, projectId], (err, row) => {
        if (err) return callback(err);
        callback(null, {
            requirement_set_id: row?.requirement_set_id || null,
            expected_requirement_count: Number(row?.expected_requirement_count || 0),
            actual_document_count: Number(row?.actual_document_count || 0),
            synced_missing_count: Number(syncedMissingCount || 0),
            stage,
            project_stage: row?.project_stage || null
        });
    });
};

app.post('/api/projects/:id/reload-requirements', checkPrivilege('manage_requirements'), __routeController098);

app.post('/api/projects/:id/sync-requirements', checkPrivilege('manage_requirements'), __routeController099);

