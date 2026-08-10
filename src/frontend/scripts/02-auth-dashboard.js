    function showAuthView(pushHistory = true) {
      forceLoginLightMode();
      navigateTo('login', {}, pushHistory);
    }
    
    function filterDashboardByStage(stage) {
        dashboardStageFilter = stage;
        Object.entries(DASH_TAB_IDS).forEach(([key, btnId]) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.className = `px-3 py-1.5 text-sm font-bold rounded-md transition ${dashboardStageFilter === key ? DASH_TAB_ACTIVE_CLASSES[key] || DASH_TAB_ACTIVE_CLASSES.All : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`;
        });
        renderProjects();
    }

    function dashboardTabLabel(stage, count) {
        return `${stage}${count > 0 ? ` <span class="ml-1 text-xs font-bold">(${count})</span>` : ''}`;
    }

    function setDashboardText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function updateDashboardClock() {
        const now = new Date();
        const dashboardHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(now)) % 24;
        setDashboardText('dashboardGreetingText', dashboardHour < 12 ? 'Good morning' : dashboardHour < 18 ? 'Good afternoon' : 'Good evening');
        setDashboardText('dashboardGreetingName', displayUsername(currentUser?.display_name || currentUser?.username || 'User'));
        setDashboardText('dashboardTodayDate', new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now));
        setDashboardText('dashboardTodayTime', new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(now));
    }

    setInterval(() => { if (appCurrentView === 'dashboard') updateDashboardClock(); }, 1000);

    function updateDashboardCounts(visibleData, pageCount = visibleData.length, totalCount = visibleData.length) {
        const counts = {
            All: projCache.length,
            Proposal: projCache.filter(p => p.stage === 'Proposal').length,
            Implementation: projCache.filter(p => p.stage === 'Implementation').length,
            Monitoring: projCache.filter(p => p.stage === 'Monitoring').length,
            Completed: projCache.filter(p => p.stage === 'Completed').length,
            Disposition: projCache.filter(p => INACTIVE_PROJECT_OUTCOMES.includes(projectOutcome(p))).length
        };
        const outcomeCounts = PROJECT_OUTCOMES.reduce((acc, outcome) => {
          acc[outcome] = projCache.filter(p => projectOutcome(p) === outcome).length;
          return acc;
        }, {});

        Object.entries(DASH_TAB_IDS).forEach(([stage, btnId]) => {
            const btn = document.getElementById(btnId);
            if (btn) btn.innerHTML = dashboardTabLabel(stage, counts[stage] || 0);
        });

        const allDocs = window.allDocumentsCache || [];
        const visibleIds = new Set((visibleData || []).map(p => Number(p.id)));
        const visibleProjectById = Object.fromEntries((visibleData || []).map(p => [Number(p.id), p]));
        const visibleDocs = allDocs.filter(d => visibleIds.has(Number(d.project_id)));
        const countableDocs = visibleDocs.filter(isCountableRequirement);
        const activeVisibleProjectIds = new Set((visibleData || []).filter(p => projectOutcome(p) === 'Active').map(p => Number(p.id)));
        const activeCountableDocs = countableDocs.filter(d => activeVisibleProjectIds.has(Number(d.project_id)));
        const isCurrentProjectStage = (doc) => {
          const project = visibleProjectById[Number(doc.project_id)] || projCache.find(p => Number(p.id) === Number(doc.project_id));
          return !project || String(doc.stage || doc.project_stage || project.stage || 'Proposal') === String(project.stage || 'Proposal');
        };
        const currentCountableDocs = activeCountableDocs.filter(isCurrentProjectStage);
        const uploadedCount = countableDocs.filter(d => !!d.file_path).length;
        const reviewedCount = countableDocs.filter(d => d.status === 'Checked').length;
        const forReviewCount = currentCountableDocs.filter(d => d.status === 'For Review').length;
        const toBeUploadedCount = currentCountableDocs.filter(d => !d.file_path).length;
        const assignedDocs = activeCountableDocs.filter(d => d.assigned_user_id);
        const overdueAssignedDocs = assignedDocs.filter(d => d.due_at && d.status !== 'Checked' && new Date(d.due_at) < new Date());
        // Update metric pills
        document.getElementById('metricUploaded').textContent = uploadedCount;
        document.getElementById('metricReviewed').textContent = reviewedCount;
        document.getElementById('metricForReview').textContent = forReviewCount;
        document.getElementById('metricToBeUploaded').textContent = toBeUploadedCount;
        document.getElementById('metricAssignedDocs').textContent = assignedDocs.length;
        document.getElementById('metricUnassignedDocs').textContent = getWorkAssignmentUnassignedCount();
        document.getElementById('metricOverdueAssignedDocs').textContent = overdueAssignedDocs.length;

        updateDashboardClock();

        const countEl = document.getElementById('displayedProjectCount');
        if (countEl) {
            setDashboardText('dashboardShownCount', `${pageCount} project${pageCount === 1 ? '' : 's'} shown`);
            setDashboardText('dashboardTotalCount', `out of ${totalCount} project${totalCount === 1 ? '' : 's'}`);
            countEl.classList.toggle('hidden', totalCount === 0);
        }
    }

    async function renderDashboardWorkload() {
      const scopedToMe = activeWorkPanel === 'my';
      if (!scopedToMe && (!isAdmin() || !hasPrivilege('view_workload_dashboard'))) return;
      const body = document.getElementById('workloadDashboardBody');
      if (!body) return;
      body.innerHTML = '<div class="py-6 text-sm text-gray-500">Loading workload...</div>';
      try {
        const stage = document.getElementById('workloadStageFilter')?.value || '';
        const qs = new URLSearchParams();
        if (stage) qs.set('stage', stage);
        if (scopedToMe) qs.set('scope', 'my');
        const data = await fetchJson(`${API}/analytics/workload?${qs.toString()}`, { silentLoading: true });
        workloadCache = data;
        const users = data.users || [];
        const userSel = document.getElementById('workloadUserFilter');
        if (!scopedToMe && userSel && userSel.options.length <= 1) users.forEach(u => userSel.innerHTML += `<option value="${u.user_id}">${esc(u.username)}</option>`);
        const selectedUser = scopedToMe ? String(currentUser?.id || '') : (userSel?.value || '');
        const roleSel = document.getElementById('workloadRoleFilter');
        if (!scopedToMe && roleSel && roleSel.options.length <= 1) {
          [...new Set(users.map(u => u.role).filter(Boolean))].sort().forEach(role => roleSel.innerHTML += `<option value="${esc(role)}">${esc(role)}</option>`);
        }
        const selectedRole = scopedToMe ? '' : (roleSel?.value || '');
        const rows = users.filter(u => (!selectedUser || Number(u.user_id) === Number(selectedUser)) && (!selectedRole || u.role === selectedRole));
        body.innerHTML = `<table class="min-w-[980px] w-full text-sm"><thead><tr class="text-left border-b dark:border-gray-700"><th class="py-2">User</th><th>Role</th><th>Assigned Projects</th><th>Assigned Documents</th><th>Active Documents</th><th>For Review</th><th>Overdue</th><th>Due in 5 Working Days</th><th>Completed Documents</th><th>Last Activity</th></tr></thead><tbody>${rows.map(u => `<tr class="border-b dark:border-gray-800"><td class="py-2 font-bold">${esc(u.username)}</td><td>${esc(u.role)}</td><td>${u.assigned_projects || 0}</td><td>${u.assigned_documents || 0}</td><td>${u.active_assigned_documents || 0}</td><td>${u.for_review_documents || 0}</td><td>${u.overdue_documents || 0}</td><td>${u.due_within_5_days || 0}</td><td>${u.completed_documents || 0}</td><td>${u.last_activity ? fmtDateTime(u.last_activity) : '-'}</td></tr>`).join('') || '<tr><td colspan="10" class="py-4 text-gray-500">No matching workload records.</td></tr>'}</tbody></table>`;
      } catch (e) {
        body.innerHTML = `<div class="text-red-600">${esc(e.message)}</div>`;
      }
    }

    const dashboardMetricLabels = {
      uploaded: 'Uploaded Documents',
      reviewed: 'Reviewed Documents',
      forReview: 'Documents For Review',
      missing: 'Documents To Be Uploaded',
      assigned: 'Assigned Documents',
      unassigned: 'Actionable Unassigned',
      overdue: 'Overdue Assigned Documents'
    };

    const metricBadgeClasses = {
      uploaded: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
      reviewed: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900',
      forReview: 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900',
      missing: 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
      assigned: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900',
      unassigned: 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      overdue: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900',
      due: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900',
      completed: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900'
    };

    function isCountableRequirement(doc) {
      const state = String(doc?.requirement_state || 'Required').trim().toLowerCase();
      if (state === 'not required') return false;
      if (state === 'optional' && !doc?.file_path) return false;
      return true;
    }

    function isReviewedMonitoringDocument(doc) {
      return String(doc.stage || '') === 'Monitoring' && doc.status === 'Checked' && isCountableRequirement(doc);
    }

    function getDashboardVisibleProjects() {
      return window.dashboardVisibleProjectsCache || projCache || [];
    }

    function getDashboardMetricItems(type) {
      const visibleProjects = getDashboardVisibleProjects();
      const visibleIds = new Set(visibleProjects.map(p => Number(p.id)));
      const visibleProjectById = Object.fromEntries(visibleProjects.map(p => [Number(p.id), p]));
      const docs = window.allDocumentsCache || [];
      const visibleDocs = docs.filter(d => visibleIds.has(Number(d.project_id)));
      const isCurrentProjectStage = (doc) => {
        const project = visibleProjectById[Number(doc.project_id)] || projCache.find(p => Number(p.id) === Number(doc.project_id));
        return !project || String(doc.stage || doc.project_stage || project.stage || 'Proposal') === String(project.stage || 'Proposal');
      };

      if (type === 'uploaded') return visibleDocs.filter(d => !!d.file_path && isCountableRequirement(d));
      if (type === 'reviewed') return visibleDocs.filter(d => d.status === 'Checked' && isCountableRequirement(d));
      if (type === 'forReview') return visibleDocs.filter(d => d.status === 'For Review' && isCurrentProjectStage(d) && isCountableRequirement(d));
      if (type === 'missing') return visibleDocs.filter(d => !d.file_path && isCurrentProjectStage(d) && isCountableRequirement(d));
      if (type === 'assigned') return visibleDocs.filter(d => isCountableRequirement(d) && !!d.assigned_user_id);
      if (type === 'unassigned') {
        const docs = (window.allDocumentsCache || []).filter(isActiveWorkDocument).map(d => ({ ...d, kind: 'document' }));
        const projects = (projCache || []).filter(isActiveWorkProject).map(p => ({ ...p, kind: 'project' }));
        return [...docs, ...projects].filter(isUnassignedWorkItem);
      }
      if (type === 'overdue') return visibleDocs.filter(d => isCountableRequirement(d) && d.assigned_user_id && d.due_at && d.status !== 'Checked' && new Date(d.due_at) < new Date());
      return [];
    }

    function metricDocumentCard(doc, type) {
      if (doc.kind === 'project') {
        const stage = doc.stage || 'Proposal';
        return `<div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer" onclick="closeModal('calendarDetailModal'); goToTarget({ project_id: ${Number(doc.id)}, document_id: null, stage: '${esc(stage)}', target_kind: 'project', target_type: '${esc(type)}' })">
          <div class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(doc.name || 'Untitled project')}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Task: Project assignment</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Requester: ${escapeHtml(doc.requester || '-')}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Requestee: ${escapeHtml(doc.requestee_name || '-')}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Assigned to: ${escapeHtml(projectOwnerDisplayName(doc))}</div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">Stage: ${escapeHtml(stage)}</div>
        </div>`;
      }
      const project = projCache.find(p => Number(p.id) === Number(doc.project_id)) || {};
      const stage = doc.stage || doc.project_stage || project.stage || 'Proposal';
      const dueLine = doc.due_at ? `<div class="text-sm ${new Date(doc.due_at) < new Date() && doc.status !== 'Checked' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}">Due: ${fmtDueDate(doc.due_at)}</div>` : '';
      const uploadedLine = doc.upload_date ? `<div class="text-sm text-gray-600 dark:text-gray-400">Uploaded: ${fmtDateTime(doc.upload_date)}</div>` : '';
      const fileLine = doc.file_name ? `<div class="text-sm text-gray-600 dark:text-gray-400">File: ${escapeHtml(doc.file_name)}</div>` : '';
      return `<div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer" onclick="closeModal('calendarDetailModal'); goToTarget({ project_id: ${Number(doc.project_id)}, document_id: ${Number(doc.id)}, stage: '${esc(stage)}', target_kind: 'document', target_type: '${esc(type)}' })">
        <div class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(doc.project_name || project.name || 'Untitled project')}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Document: ${escapeHtml(doc.document_type_name || '-')}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Requester: ${escapeHtml(doc.requester || project.requester || '-')}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Requestee: ${escapeHtml(doc.requestee_name || project.requestee_name || '-')}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Assigned to: ${escapeHtml(ownerDisplayName(doc))}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Status: ${escapeHtml(doc.status || (doc.file_path ? 'Uploaded' : 'To be uploaded'))}</div>
        ${fileLine}
        ${uploadedLine}
        ${dueLine}
        <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">Stage: ${escapeHtml(stage)}</div>
      </div>`;
    }

    function openDetailListModal({ title, dateLabel, typeLabel, type, items, emptyText }) {
      const titleEl = document.getElementById('calendarDetailTitle');
      if (titleEl) titleEl.textContent = title;
      document.getElementById('calendarDetailDate').textContent = dateLabel;
      document.getElementById('calendarDetailType').textContent = typeLabel;
      const badge = document.getElementById('calendarDetailBadge');
      badge.className = `ml-2 px-3 py-1 rounded-full text-xs font-bold ${metricBadgeClasses[type] || metricBadgeClasses.uploaded}`;
      badge.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
      document.getElementById('calendarDetailList').innerHTML = items.length
        ? items.map(item => typeof item === 'string' ? item : metricDocumentCard(item, type)).join('')
        : `<div class="text-center text-gray-500 dark:text-gray-400 py-8">${emptyText || 'No items found'}</div>`;
      document.getElementById('calendarDetailModal').classList.remove('hidden');
    }

    function showDashboardMetricDetails(type) {
      const items = getDashboardMetricItems(type);
      openDetailListModal({
        title: 'Document Metric Details',
        dateLabel: 'Dashboard',
        typeLabel: dashboardMetricLabels[type] || 'Documents',
        type,
        items,
        emptyText: 'No documents found for this metric.'
      });
    }

    function projectOwnerDisplayName(project) {
      if (!project.assigned_user_id) return 'Unassigned';
      return project.assigned_username || 'Unknown user';
    }

    function projectAssignmentSelect(project) {
      if (!canAssignOwnership()) return esc(projectOwnerDisplayName(project));
      return `<button onclick="event.stopPropagation(); openAssignmentPicker('project', ${project.id}, ${project.assigned_user_id || 'null'})" class="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${project.assigned_user_id ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'} hover:shadow-sm">${esc(projectOwnerDisplayName(project))}</button>`;
    }

    function canSetManualDueDate() {
      return hasPrivilege('set_manual_due_date') || currentUser?.role === 'superadmin';
    }

    window.openProjectDueDateFromButton = function(btn) {
      openProjectDueDateModal(btn.dataset.projectId, btn.dataset.dueAt || '', btn.dataset.projectName || 'Project');
    };

    window.openDocumentDueDateFromButton = function(btn) {
      openManualDueDateModal(btn.dataset.docId, btn.dataset.dueAt || '', btn.dataset.docName || 'Document');
    };

    function projectDueDateControl(project, options = {}) {
      const dueAt = project.due_at || project.manual_due_date || '';
      const dueClickable = canSetManualDueDate();
      const isOverdue = dueAt && project.stage !== 'Completed' && new Date(dueAt) < new Date();
      const label = dueAt ? fmtDueDate(dueAt) : 'Set due date';
      const idAttr = options.id ? `id="${options.id}"` : '';
      const cls = dueAt
        ? `inline-flex items-center rounded-full px-2.5 py-1 border text-xs ${isOverdue ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 font-bold'}`
        : 'inline-flex items-center rounded-full px-2.5 py-1 border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-400 font-bold';
      if (!dueClickable) return `<span ${idAttr} class="${cls}">${label}</span>`;
      return `<button ${idAttr} type="button" onclick="event.stopPropagation(); openProjectDueDateFromButton(this)" data-project-id="${project.id}" data-due-at="${esc(dueAt)}" data-project-name="${esc(project.name || 'Project')}" class="${cls} cursor-pointer hover:border-blue-300 dark:hover:border-blue-700" title="${dueAt ? 'Click to edit project due date' : 'Click to set project due date'}">${label}</button>`;
    }

    async function assignProjectOwner(projectId, next) {
      try {
        const result = await fetchJson(`${API}/projects/${projectId}/assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_user_id: next })
        });
        toast(result.unchanged ? 'Assignment unchanged' : 'Project assignment updated');
        await refreshAfterMutation({ projectId });
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    function openAssignmentPicker(kind, id, currentAssignedUserId) {
      if (kind === 'document') {
        const doc = (window.currentProjectDocumentsCache || window.allDocumentsCache || []).find(d => Number(d.id) === Number(id));
        if (isNotRequiredDocument(doc)) {
          toast('This document is marked as Not Required and cannot be assigned.', 'error');
          return;
        }
      }
      assignmentPickerState = { kind, id, currentAssignedUserId: currentAssignedUserId || null };
      document.getElementById('assignmentPickerTitle').textContent = kind === 'project' ? 'Assign Project Owner' : 'Assign Document Owner';
      document.getElementById('assignmentPickerSearch').value = '';
      renderAssignmentPickerList();
      document.getElementById('assignmentPickerModal').classList.remove('hidden');
    }

    function openBulkAssignmentPicker() {
      const items = getSelectedWorkAssignmentItems();
      if (!items.length) return toast('Select work items first.', 'error');
      assignmentPickerState = { kind: 'bulk', items, currentAssignedUserId: null };
      document.getElementById('assignmentPickerTitle').textContent = `Assign ${items.length} Selected Item${items.length === 1 ? '' : 's'}`;
      document.getElementById('assignmentPickerSearch').value = '';
      renderAssignmentPickerList();
      document.getElementById('assignmentPickerModal').classList.remove('hidden');
    }

    function getClientWorkloadByUser() {
      const map = {};
      (usersCache || []).forEach(u => map[Number(u.id)] = { active: 0, overdue: 0, forReview: 0 });
      (projCache || []).filter(isActiveWorkProject).forEach(p => {
        const id = Number(p.assigned_user_id || 0);
        if (id && map[id]) map[id].active++;
      });
      (window.allDocumentsCache || []).filter(isActiveWorkDocument).forEach(d => {
        const id = Number(d.assigned_user_id || 0);
        if (!id || !map[id]) return;
        map[id].active++;
        if (isWorkItemOverdue({ ...d, kind: 'document' })) map[id].overdue++;
        if (d.status === 'For Review') map[id].forReview++;
      });
      return map;
    }

    function directSuperiorName(user) {
      const id = Number(user?.direct_superior_user_id || 0);
      if (!id) return '';
      return (usersCache || []).find(u => Number(u.id) === id)?.username || '';
    }

    function renderAssignmentPickerList() {
      const state = assignmentPickerState;
      const list = document.getElementById('assignmentPickerList');
      if (!state || !list) return;
      const q = (document.getElementById('assignmentPickerSearch')?.value || '').toLowerCase();
      const workload = getClientWorkloadByUser();
      const sort = assignmentPickerSort || 'least';
      const filtered = (usersCache || []).filter(u => {
        const haystack = `${u.username || ''} ${u.display_name || ''} ${u.role || ''} ${directSuperiorName(u)}`.toLowerCase();
        return haystack.includes(q);
      }).sort((a, b) => {
        if (sort === 'name') return String(a.username || '').localeCompare(String(b.username || ''));
        if (sort === 'role') return String(a.role || '').localeCompare(String(b.role || '')) || String(a.username || '').localeCompare(String(b.username || ''));
        return (workload[Number(a.id)]?.active || 0) - (workload[Number(b.id)]?.active || 0) || String(a.username || '').localeCompare(String(b.username || ''));
      });
      const current = Number(state.currentAssignedUserId || 0);
      const includeUnassigned = !q;
      const sortTabs = `<div class="sticky top-0 z-10 bg-white dark:bg-gray-800 pb-2 flex flex-wrap gap-1.5">
        ${[['least', 'Least loaded'], ['name', 'Name A-Z'], ['role', 'Role']].map(([key, label]) => `<button type="button" onclick="assignmentPickerSort='${key}'; renderAssignmentPickerList()" class="px-2.5 py-1 rounded-full border text-[11px] font-bold ${sort === key ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}">${label}</button>`).join('')}
      </div>`;
      const unassignedBtn = includeUnassigned ? `<button onclick="applyAssignmentPickerSelection(null)" class="w-full text-left px-3 py-2 rounded-lg border font-semibold ${current ? 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200' : 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200'}">Unassigned</button>` : '';
      list.innerHTML = sortTabs + unassignedBtn + filtered.map(u => {
        const stats = workload[Number(u.id)] || {};
        const superior = directSuperiorName(u);
        return `<button onclick="applyAssignmentPickerSelection(${u.id})" class="w-full text-left px-3 py-2 rounded-lg border font-semibold flex items-center gap-3 ${Number(u.id) === current ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}">
          ${renderUserAvatar(u, 34, 'text-xs')}
          <span class="min-w-0 flex-1">
            <span class="block truncate font-black">${esc(Number(u.id)===Number(currentUser?.id)?'You':u.username)}</span>
            <span class="block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">${esc(u.role || '-')}${superior ? ` - Superior: ${esc(superior)}` : ''}</span>
          </span>
          <span class="shrink-0 text-right text-[11px] text-gray-500 dark:text-gray-400">
            <span class="block font-black text-gray-700 dark:text-gray-200">${Number(stats.active || 0)} active</span>
            <span>${Number(stats.overdue || 0)} overdue / ${Number(stats.forReview || 0)} review</span>
          </span>
        </button>`;
      }).join('');
    }

    async function applyAssignmentPickerSelection(userId) {
      if (!assignmentPickerState) return;
      const state = assignmentPickerState;
      closeModal('assignmentPickerModal');
      assignmentPickerState = null;
      if (state.kind === 'bulk') await bulkAssignWorkItems(state.items, userId);
      else if (state.kind === 'project') await assignProjectOwner(state.id, userId);
      else await assignDocumentOwner(state.id, userId);
    }

    function workUrgencyScore(item) {
      if (item && projectOutcome(item) !== 'Active' && (item.kind === 'project' || item.project_outcome)) return 99;
      if (item.due_at && item.status !== 'Checked' && new Date(item.due_at) < new Date()) return 0;
      if (item.due_at && item.status !== 'Checked') return 1;
      if (item.kind === 'project') return 2;
      if (item.status === 'For Review') return 2;
      return 3;
    }

    const WORK_QUEUE_TONES = {
      active: {
        chip: 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700',
        activeChip: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600',
        row: 'bg-white dark:bg-gray-900'
      },
      assigned: {
        chip: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800',
        activeChip: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-100 border-cyan-300 dark:border-cyan-700',
        row: 'bg-white dark:bg-gray-900'
      },
      unassigned: {
        chip: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800',
        activeChip: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-100 border-amber-300 dark:border-amber-700',
        row: 'bg-amber-50/40 dark:bg-amber-950/10'
      },
      forReview: {
        chip: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800',
        activeChip: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-100 border-amber-300 dark:border-amber-700',
        row: 'bg-white dark:bg-gray-900'
      },
      overdue: {
        chip: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800',
        activeChip: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-100 border-red-300 dark:border-red-700',
        row: 'bg-red-50/70 dark:bg-red-950/20'
      },
      dueSoon: {
        chip: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800',
        activeChip: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-100 border-amber-300 dark:border-amber-700',
        row: 'bg-white dark:bg-gray-900'
      }
    };

    function isActiveWorkProject(project) {
      return project && projectOutcome(project) === 'Active' && project.stage !== 'Completed' && project.status !== 'Completed';
    }

    function isActiveWorkDocument(doc) {
      const projectStage = doc.project_stage || doc.stage;
      const outcome = doc.project_outcome || projectOutcome(projCache.find(p => Number(p.id) === Number(doc.project_id)) || {});
      return doc
        && outcome === 'Active'
        && projectStage !== 'Completed'
        && doc.status !== 'Checked'
        && isCountableRequirement(doc);
    }

    function isWorkItemOverdue(item) {
      const dueAt = item.due_at || item.manual_due_date;
      const stage = item.stage || item.project_stage;
      return !!dueAt && (item.kind !== 'project' || projectOutcome(item) === 'Active') && (!item.project_outcome || item.project_outcome === 'Active') && item.status !== 'Checked' && stage !== 'Completed' && new Date(dueAt) < new Date();
    }

    function isWorkItemDueSoon(item) {
      const dueAt = item.due_at || item.manual_due_date;
      const stage = item.stage || item.project_stage;
      return !!dueAt && (item.kind !== 'project' || projectOutcome(item) === 'Active') && (!item.project_outcome || item.project_outcome === 'Active') && item.status !== 'Checked' && stage !== 'Completed' && !isWorkItemOverdue(item) && (new Date(dueAt) - new Date()) <= 3 * 24 * 60 * 60 * 1000;
    }

    function isUnassignedWorkItem(item) {
      if (!item || item.assigned_user_id) return false;
      return item.kind === 'project' ? isActiveWorkProject(item) : isActiveWorkDocument(item);
    }

    function getWorkAssignmentUnassignedCount() {
      const docs = (window.allDocumentsCache || []).filter(isActiveWorkDocument);
      const projects = (projCache || []).filter(isActiveWorkProject).map(p => ({ ...p, kind: 'project' }));
      return [...docs.map(d => ({ ...d, kind: 'document' })), ...projects].filter(isUnassignedWorkItem).length;
    }

    function workQueueMatchesFilter(item, filter) {
      if (filter === 'unassigned') return isUnassignedWorkItem(item);
      if (filter === 'assigned') return !!item.assigned_user_id && (item.kind === 'project' ? isActiveWorkProject(item) : isActiveWorkDocument(item));
      if (filter === 'forReview') return item.kind === 'document' && item.status === 'For Review' && isActiveWorkDocument(item);
      if (filter === 'overdue') return isWorkItemOverdue(item);
      if (filter === 'dueSoon') return isWorkItemDueSoon(item);
      return true;
    }

    function getMyAssignmentAttentionCount() {
      if (!currentUser || isSuperAdmin()) return 0;
      const myId = Number(currentUser.id);
      const docs = (window.allDocumentsCache || [])
        .filter(doc => {
          return Number(doc.assigned_user_id) === myId
            && doc.status !== 'Completed'
            && isActiveWorkDocument(doc);
        });
      const projects = (projCache || [])
        .filter(project => Number(project.assigned_user_id) === myId && isActiveWorkProject(project));
      return docs.length + projects.length;
    }

    function updateMyAssignmentBadge() {
      const count = getMyAssignmentAttentionCount();
      ['myAssignmentBadge', 'myAssignmentSidebarBadge'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('hidden', count === 0);
      });
    }

    function getMyScheduleUpcomingCount() {
      if (!currentUser) return 0;
      return (myDashboardSchedulesCache || []).filter(schedule => {
        if (!schedule || String(schedule.status || 'active') !== 'active') return false;
        return !isMySchedulePast(schedule);
      }).length;
    }

    function updateMyScheduleBadge() {
      const count = getMyScheduleUpcomingCount();
      ['myScheduleBadge', 'myScheduleSidebarBadge'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('hidden', count === 0);
      });
    }

    function updateWorkAssignmentBadge() {
      const badge = document.getElementById('workAssignmentSidebarBadge');
      if (!badge) return;
      const count = getWorkAssignmentUnassignedCount();
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0 || !canViewWorkAssignment());
    }

    function updateSidebarBadges() {
      updateMyAssignmentBadge();
      updateMyScheduleBadge();
      updateWorkAssignmentBadge();
      updateForReviewSidebarBadge();
      return updatePendingConfirmationsBadge();
    }

    function setWorkQueueFilter(filter) {
      if (filter === 'workload' && !canViewWorkloadTab()) filter = 'active';
      workQueueFilter = filter || 'active';
      renderOwnershipWorkPanel();
      if (appCurrentView === 'dashboard') replaceAppHistory('dashboard');
    }

    function renderWorkQueueChip(key, label, count) {
      const tone = WORK_QUEUE_TONES[key] || WORK_QUEUE_TONES.active;
      const active = workQueueFilter === key;
      return `<button type="button" onclick="setWorkQueueFilter('${key}')" class="enterprise-pill ${active ? tone.activeChip : tone.chip}" title="${esc(label)}">${esc(label)}${count === '' || count === undefined ? '' : ` <span class="font-black">${count}</span>`}</button>`;
    }

    function renderWorkloadQueueButton() {
      const active = workQueueFilter === 'workload';
      return `<button type="button" onclick="setWorkQueueFilter('workload')" class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-black border transition shadow-sm ${active ? 'bg-indigo-700 dark:bg-indigo-500 text-white dark:text-gray-950 border-indigo-700 dark:border-indigo-500' : 'bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'}" title="Workload">Workload</button>`;
    }

    function canViewWorkloadTab() {
      if (activeWorkPanel === 'my') return !!currentUser;
      return isAdmin() && hasPrivilege('view_workload_dashboard');
    }

    function renderWorkloadTabShell() {
      if (!canViewWorkloadTab()) return '';
      const scopedToMe = activeWorkPanel === 'my';
      return `<div class="p-4 space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-end gap-3">
          <div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">Stage</label><select id="workloadStageFilter" onchange="renderDashboardWorkload()" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"><option value="">All</option><option>Proposal</option><option>Implementation</option><option>Monitoring</option><option>Completed</option></select></div>
          ${scopedToMe ? `<div class="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-sm font-bold text-blue-700 dark:text-blue-200">Showing ${esc(displayUsername(currentUser?.username || 'your'))} only</div>` : `<div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">User</label><select id="workloadUserFilter" onchange="renderDashboardWorkload()" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"><option value="">All users</option></select></div>
          <div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">Role</label><select id="workloadRoleFilter" onchange="renderDashboardWorkload()" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"><option value="">All roles</option></select></div>`}
        </div>
        <div id="workloadDashboardBody" class="overflow-x-auto"></div>
      </div>`;
    }

    function resetWorkAssignmentOpenState() {
      workQueueFilter = 'unassigned';
      workAssignmentMultiSelect = false;
      workAssignmentSelected = {};
      workAssignmentTypeFilter = 'both';
      workAssignmentExpandedProjectDocs = {};
    }

    function setWorkAssignmentTypeFilter(value) {
      workAssignmentTypeFilter = ['both', 'project', 'document'].includes(value) ? value : 'both';
      renderOwnershipWorkPanel();
    }

    function selectedWorkKey(kind, id) {
      return `${kind}:${Number(id)}`;
    }

    function getSelectedWorkAssignmentItems() {
      return Object.keys(workAssignmentSelected || {}).filter(key => workAssignmentSelected[key]).map(key => {
        const [kind, id] = key.split(':');
        return { kind, id: Number(id) };
      }).filter(item => item.kind && Number.isInteger(item.id));
    }

    function toggleWorkAssignmentSelection(kind, id, checked) {
      const key = selectedWorkKey(kind, id);
      if (checked) workAssignmentSelected[key] = true;
      else delete workAssignmentSelected[key];
      renderWorkAssignmentBulkBar();
    }

    function clearWorkAssignmentSelection() {
      workAssignmentSelected = {};
      renderOwnershipWorkPanel();
    }

    function selectUnassignedInProject(projectId) {
      const pid = Number(projectId);
      (window.allDocumentsCache || [])
        .filter(d => Number(d.project_id) === pid && isUnassignedWorkItem({ ...d, kind: 'document' }))
        .forEach(d => workAssignmentSelected[selectedWorkKey('document', d.id)] = true);
      renderOwnershipWorkPanel();
    }

    async function assignUnassignedDocsInProject(projectId) {
      workAssignmentSelected = {};
      selectUnassignedInProject(projectId);
      openBulkAssignmentPicker();
    }

    async function bulkAssignWorkItems(items, userId) {
      try {
        const result = await fetchJson(`${API}/work-assignments/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, assigned_user_id: userId })
        });
        workAssignmentSelected = {};
        const parts = [`${result.assigned || 0} updated`, `${result.unchanged || 0} unchanged`, `${result.skipped || 0} skipped`];
        toast(parts.join(', '), (result.errors || []).length ? 'warning' : 'success');
        await refreshAfterMutation({});
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    function renderWorkAssignmentBulkBar() {
      const old = document.getElementById('workAssignmentBulkBar');
      if (old) old.remove();
      const selected = getSelectedWorkAssignmentItems();
      if (!workAssignmentMultiSelect || !selected.length || activeWorkPanel !== 'global') return;
      document.body.insertAdjacentHTML('beforeend', `<div id="workAssignmentBulkBar" class="fixed left-3 right-3 bottom-3 z-40 sm:left-[260px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="text-sm font-black text-gray-900 dark:text-gray-100">${selected.length} selected</div>
        <div class="flex gap-2">
          <button type="button" onclick="openBulkAssignmentPicker()" class="px-4 py-2 rounded-lg bg-cyan-700 text-white font-bold hover:bg-cyan-800">Assign to user</button>
          <button type="button" onclick="clearWorkAssignmentSelection()" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold">Clear selection</button>
        </div>
      </div>`);
    }

    function workDueStatusBadge(item) {
      const dueAt = item.due_at || item.manual_due_date || '';
      if (!dueAt) return '<span class="text-xs font-bold text-gray-500 dark:text-gray-400">No due date</span>';
      if (isWorkItemOverdue(item)) return '<span class="text-xs font-black text-red-700 dark:text-red-300">Overdue</span>';
      if (isWorkItemDueSoon(item)) return '<span class="text-xs font-black text-amber-700 dark:text-amber-300">Due Soon</span>';
      return `<span class="text-xs font-bold text-gray-600 dark:text-gray-300">Due: ${fmtDueDate(dueAt)}</span>`;
    }

    function workStatusBadge(doc) {
      const cls = doc.status === 'For Review'
        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'
        : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700';
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-black ${cls}">${esc(doc.status || 'Pending')}</span>`;
    }

    function renderGroupedWorkAssignments(items) {
      const docsByProject = {};
      const projectsById = {};
      (projCache || []).filter(isActiveWorkProject).forEach(p => projectsById[Number(p.id)] = { ...p, kind: 'project' });
      items.forEach(item => {
        const pid = Number(item.kind === 'project' ? item.id : item.project_id);
        if (!docsByProject[pid]) docsByProject[pid] = { project: projectsById[pid] || { id: pid, name: item.project_name, stage: item.project_stage || item.stage, requester: item.requester, requestee_name: item.requestee_name }, docs: [], includeProject: false };
        if (item.kind === 'project') docsByProject[pid].includeProject = true;
        else docsByProject[pid].docs.push(item);
      });
      const groups = Object.values(docsByProject).sort((a, b) => String(a.project.name || '').localeCompare(String(b.project.name || '')));
      if (!groups.length) return '<div class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No work items found.</div>';
      return `<div class="divide-y divide-gray-100 dark:divide-gray-800">${groups.map(group => {
        const p = group.project;
        const pid = Number(p.id);
        const docs = group.docs.sort((a, b) => workUrgencyScore(a) - workUrgencyScore(b) || String(a.document_type_name || '').localeCompare(String(b.document_type_name || '')));
        const allDocs = (window.allDocumentsCache || []).filter(d => Number(d.project_id) === pid && isActiveWorkDocument(d));
        const counts = {
          unassigned: allDocs.filter(d => !d.assigned_user_id).length,
          overdue: allDocs.filter(d => isWorkItemOverdue({ ...d, kind: 'document' })).length
        };
        const unassignedDocs = allDocs.filter(d => !d.assigned_user_id).sort((a, b) => String(a.document_type_name || '').localeCompare(String(b.document_type_name || '')));
        const showProjectDocExpand = ['project', 'both'].includes(workAssignmentTypeFilter) && counts.unassigned > 0;
        const projectDocsExpanded = !!workAssignmentExpandedProjectDocs[pid];
        const unassignedDocRows = unassignedDocs.map(doc => renderGroupedDocumentRow(doc)).join('');
        const queueRows = docs.map(doc => renderGroupedDocumentRow(doc)).join('') || `<div class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">${group.includeProject ? 'Project owner needs assignment.' : 'No documents in this queue.'}</div>`;
        const projectTarget = esc(JSON.stringify({ project_id: pid, document_id: null, stage: p.stage || 'Proposal', target_kind: 'project', target_type: 'project' }));
        return `<section class="bg-white dark:bg-gray-900">
          <div class="px-4 py-4 bg-gray-50 dark:bg-gray-950">
            <div class="flex flex-col lg:flex-row lg:items-center gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-2">
                  ${workAssignmentMultiSelect && group.includeProject ? `<input type="checkbox" onclick="event.stopPropagation(); toggleWorkAssignmentSelection('project', ${pid}, this.checked)" ${workAssignmentSelected[selectedWorkKey('project', pid)] ? 'checked' : ''} class="work-bulk-checkbox rounded border-gray-300 text-cyan-700 focus:ring-cyan-500">` : ''}
                  <button type="button" onclick="goToTarget(${projectTarget})" class="min-w-0 text-left">
                    <div class="text-base font-black text-gray-950 dark:text-gray-50 truncate">${esc(p.name || 'Untitled project')}</div>
                    <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">${esc(p.stage || 'Proposal')} - Requester: ${esc(p.requester || '-')} - Requestee: ${esc(p.requestee_name || '-')}</div>
                  </button>
                </div>
                <div class="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                  <span>Unassigned documents: <strong>${counts.unassigned}</strong></span>${showProjectDocExpand ? `<button type="button" data-project-docs-toggle="${pid}" onclick="toggleWorkAssignmentProjectDocs(${pid})" class="font-bold text-cyan-700 dark:text-cyan-300 hover:underline">${projectDocsExpanded ? 'Hide' : 'Expand'}</button>` : ''}${counts.overdue > 0 ? `<span class="text-red-700 dark:text-red-300 font-bold">Overdue: ${counts.overdue}</span>` : ''}
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                <div class="text-xs text-gray-500 dark:text-gray-400">Project Owner: ${projectAssignmentSelect(p)}</div>
                ${workAssignmentMultiSelect ? `<button type="button" onclick="selectUnassignedInProject(${pid})" class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200">Select unassigned</button>` : ''}
                ${counts.unassigned > 0 ? `<button type="button" onclick="assignUnassignedDocsInProject(${pid})" class="px-3 py-1.5 rounded-lg bg-cyan-700 text-white text-xs font-bold">Assign all unassigned</button>` : '<span class="text-xs font-bold text-gray-500 dark:text-gray-400">All documents assigned.</span>'}
              </div>
            </div>
          </div>
          ${showProjectDocExpand ? `<div data-project-docs-panel="${pid}" class="work-assignment-docs-panel ${projectDocsExpanded ? 'is-expanded' : ''}"><div class="divide-y divide-gray-100 dark:divide-gray-800">${unassignedDocRows}</div></div>` : `<div class="divide-y divide-gray-100 dark:divide-gray-800">${queueRows}</div>`}
        </section>`;
      }).join('')}</div>`;
    }

    function toggleWorkAssignmentProjectDocs(pid) {
      const key = Number(pid);
      const expanded = !!workAssignmentExpandedProjectDocs[key];
      const panel = document.querySelector(`[data-project-docs-panel="${key}"]`);
      const toggle = document.querySelector(`[data-project-docs-toggle="${key}"]`);
      if (expanded && panel) {
        panel.classList.remove('is-expanded');
        if (toggle) toggle.textContent = 'Expand';
        setTimeout(() => {
          workAssignmentExpandedProjectDocs[key] = false;
          renderOwnershipWorkPanel();
        }, 280);
        return;
      }
      workAssignmentExpandedProjectDocs[key] = true;
      renderOwnershipWorkPanel();
    }

    function renderGroupedDocumentRow(doc) {
      const stage = doc.stage || doc.project_stage || 'Proposal';
      const key = selectedWorkKey('document', doc.id);
      const target = esc(JSON.stringify({ project_id: Number(doc.project_id), document_id: Number(doc.id), stage, target_kind: 'document', target_type: doc.status === 'For Review' ? 'review' : 'document' }));
      return `<div class="px-4 py-3 grid grid-cols-1 md:grid-cols-[${workAssignmentMultiSelect ? '32px_' : ''}minmax(0,1fr)_190px_150px] gap-3 md:items-center hover:bg-cyan-50/40 dark:hover:bg-cyan-950/10">
        ${workAssignmentMultiSelect ? `<input type="checkbox" onclick="event.stopPropagation(); toggleWorkAssignmentSelection('document', ${Number(doc.id)}, this.checked)" ${workAssignmentSelected[key] ? 'checked' : ''} class="work-bulk-checkbox rounded border-gray-300 text-cyan-700 focus:ring-cyan-500">` : ''}
        <button type="button" onclick="goToTarget(${target})" class="min-w-0 text-left">
          <div class="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">${esc(doc.document_type_name || '-')}</div>
        </button>
        <div>${assignmentSelect(doc)}</div>
        <div>${workDueStatusBadge({ ...doc, kind: 'document' })}</div>
      </div>`;
    }

    function renderWorkItem(item) {
      const isProject = item.kind === 'project';
      const itemStage = item.stage || item.project_stage || 'Proposal';
      const dueAt = item.due_at || item.manual_due_date || '';
      const overdue = dueAt && item.status !== 'Checked' && itemStage !== 'Completed' && new Date(dueAt) < new Date();
      const dueSoon = dueAt && item.status !== 'Checked' && itemStage !== 'Completed' && !overdue && (new Date(dueAt) - new Date()) <= 3 * 24 * 60 * 60 * 1000;
      const unassigned = !item.assigned_user_id;
      const rowTone = overdue ? WORK_QUEUE_TONES.overdue.row : (unassigned ? WORK_QUEUE_TONES.unassigned.row : WORK_QUEUE_TONES.assigned.row);
      const dueClass = overdue ? 'text-red-700 dark:text-red-300 font-black' : (dueSoon ? 'text-amber-700 dark:text-amber-300 font-black' : 'text-gray-600 dark:text-gray-300 font-semibold');
      const assignee = isProject ? projectOwnerDisplayName(item) : ownerDisplayName(item);
      const assigneeCell = isProject ? projectAssignmentSelect(item) : assignmentSelect(item);
      const title = isProject ? item.name : item.document_type_name;
      const typeLabel = isProject ? 'Project' : 'Document';
      // For My Assignment: show "You" if assigned to current user, otherwise show assignee name
      // For Work Assignment: show actual assignee name or "Unassigned"
      const isMyWork = activeWorkPanel === 'my';
      const isAssignedToMe = Number(item.assigned_user_id) === Number(currentUser?.id);
      const displayAssignee = isMyWork && isAssignedToMe ? 'You' : assignee;
      const projectId = isProject ? item.id : item.project_id;
      const documentId = isProject ? null : item.id;
      const targetType = isProject
        ? (overdue ? 'overdue' : (dueSoon ? 'due_soon' : 'project'))
        : (item.status === 'For Review' ? 'review' : (overdue ? 'overdue' : (dueSoon ? 'due_soon' : (unassigned ? 'assignment' : 'document'))));
      const targetKind = documentId ? 'document' : (['overdue', 'due_soon'].includes(targetType) ? 'project_due_date' : 'project');
      const targetKey = `${activeWorkPanel || 'work'}-${workQueueFilter}-${isProject ? 'project' : 'document'}-${Number(projectId)}-${documentId ? Number(documentId) : 'project'}`;
      workItemTargetCache[targetKey] = {
        project_id: Number(projectId),
        document_id: documentId ? Number(documentId) : null,
        stage: itemStage,
        target_kind: targetKind,
        target_type: targetType,
        target_meta: {
          stage: itemStage,
          target_type: targetType
        }
      };
      const meta = isProject 
        ? `${item.requester || '-'} - ${item.requestee_name || '-'}` 
        : `${item.project_name || '-'} - ${item.requester || '-'} - ${item.requestee_name || '-'}`;
      const dueControl = canSetManualDueDate()
        ? (isProject
          ? projectDueDateControl(item)
          : `<button type="button" onclick="event.stopPropagation(); openDocumentDueDateFromButton(this)" data-doc-id="${item.id}" data-due-at="${esc(dueAt)}" data-doc-name="${esc(item.document_type_name || 'Document')}" class="inline-flex items-center rounded-full px-2.5 py-1 border text-xs ${dueAt ? (overdue ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 font-bold') : 'border-dashed border-gray-300 dark:border-gray-700 text-gray-400 font-bold'} cursor-pointer hover:border-blue-300 dark:hover:border-blue-700" title="${dueAt ? 'Click to edit due date' : 'Click to set due date'}">${dueAt ? fmtDueDate(dueAt) : 'Set due date'}</button>`)
        : `<button type="button" onclick="event.stopPropagation(); openWorkItemTarget('${esc(targetKey)}')" class="text-left text-xs ${dueClass} whitespace-normal md:whitespace-nowrap">${dueAt ? fmtDueDate(dueAt) : 'No due date'}</button>`;
      return `<div class="work-row w-full text-left px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800 ${rowTone} cursor-pointer" data-work-target-key="${esc(targetKey)}" data-project-id="${Number(projectId)}" data-document-id="${documentId ? Number(documentId) : ''}" data-stage="${esc(itemStage)}" data-target-kind="${targetKind}" data-target-type="${targetType}" onclick="openWorkItemTarget(this.dataset.workTargetKey)">
        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_190px_170px] gap-3 items-start">
          <button type="button" onclick="event.stopPropagation(); openWorkItemTarget(this.closest('.work-row').dataset.workTargetKey)" class="min-w-0 text-left">
            <div class="font-black text-sm text-gray-950 dark:text-gray-50 truncate">${esc(title)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">${esc(meta)}</div>
          </button>
          <button type="button" onclick="event.stopPropagation(); openWorkItemTarget(this.closest('.work-row').dataset.workTargetKey)" class="text-left text-xs text-gray-600 dark:text-gray-300"><span class="md:hidden font-bold uppercase text-gray-400 dark:text-gray-500 mr-1">Type</span>${typeLabel}</button>
          <div class="text-xs text-gray-700 dark:text-gray-200 truncate" title="${esc(displayAssignee)}"><span class="md:hidden font-bold uppercase text-gray-400 dark:text-gray-500 mr-1">Assigned to</span>${assigneeCell}</div>
          <div class="text-left text-xs ${dueClass} whitespace-normal md:whitespace-nowrap"><span class="md:hidden font-bold uppercase text-gray-400 dark:text-gray-500 mr-1">Due</span>${dueControl}</div>
        </div>
      </div>`;
    }

    function scheduleTimeMs(value) {
      const ms = new Date(value || '').getTime();
      return Number.isFinite(ms) ? ms : null;
    }

    function myScheduleEndTimeMs(schedule) {
      return scheduleTimeMs(schedule?.end) ?? scheduleTimeMs(schedule?.end_datetime) ?? scheduleTimeMs(schedule?.start) ?? scheduleTimeMs(schedule?.start_datetime);
    }

    function isMySchedulePast(schedule, now = Date.now()) {
      const endMs = myScheduleEndTimeMs(schedule);
      return Number.isFinite(endMs) && endMs < now;
    }

    function myScheduleStatusLabel(schedule) {
      const participant = (schedule.participants || []).find(p => Number(p.user_id) === Number(currentUser?.id));
      const response = String(participant?.response_status || schedule.response_status || '').toLowerCase();
      if (isMySchedulePast(schedule) && response === 'pending') return 'Past';
      if (Number(schedule.created_by_user_id) === Number(currentUser?.id)) return 'Creator';
      if (participant) return calendarResponseStatusLabel(String(participant.response_status || 'pending').toLowerCase());
      if (Number(schedule.owner_user_id) === Number(currentUser?.id)) return 'Created by you';
      return '';
    }

    function myScheduleMatchesFilter(schedule) {
      const isPast = isMySchedulePast(schedule);
      const participant = (schedule.participants || []).find(p => Number(p.user_id) === Number(currentUser?.id));
      const response = String(participant?.response_status || schedule.response_status || '').toLowerCase();
      if (dashboardScheduleFilter === 'upcoming') return !isPast;
      if (dashboardScheduleFilter === 'past') return isPast;
      if (dashboardScheduleFilter === 'pending') return Number(schedule.created_by_user_id) !== Number(currentUser?.id) && response === 'pending' && !isPast;
      return true;
    }

    function setMyScheduleFilter(filter = 'all') {
      dashboardScheduleFilter = ['all', 'upcoming', 'past', 'pending'].includes(filter) ? filter : 'all';
      renderOwnershipWorkPanel();
    }

    function renderMyScheduleFilterChip(key, label, count) {
      const active = dashboardScheduleFilter === key;
      return `<button type="button" onclick="setMyScheduleFilter('${key}')" class="enterprise-pill ${active ? 'bg-cyan-700 dark:bg-cyan-500 text-white dark:text-gray-950 border-cyan-700 dark:border-cyan-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}">${esc(label)} <span class="font-black">${Number(count || 0)}</span></button>`;
    }

    function renderMyScheduleItem(schedule) {
      const statusLabel = myScheduleStatusLabel(schedule);
      const typeLabel = calendarEventTypeLabel(schedule);
      const dateLabel = schedule.end && schedule.end !== schedule.start
        ? `${fmtDateTime(schedule.start)} - ${fmtDateTime(schedule.end)}`
        : fmtDateTime(schedule.start);
      return `<div class="p-4 border-b last:border-b-0 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20 cursor-pointer transition" data-calendar-event-id="${Number(schedule.raw_id)}" onclick="openManualCalendarEventById(Number(this.dataset.calendarEventId))">
        <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <div class="font-black text-gray-950 dark:text-gray-50">${esc(schedule.title || 'Untitled Schedule')}</div>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800">${esc(typeLabel)}</span>
              ${statusLabel ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">${esc(statusLabel)}</span>` : ''}
            </div>
            <div class="text-xs font-bold text-gray-600 dark:text-gray-300">${esc(dateLabel)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${schedule.location ? `${esc(schedule.location)} - ` : ''}Created by ${esc(schedule.owner_username || schedule.created_by_username || '-')}</div>
            ${schedule.description ? `<div class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">${esc(schedule.description)}</div>` : ''}
        </div>
      </div>`;
    }

    function renderMySchedulePanel(panel) {
      const schedules = [...(myDashboardSchedulesCache || [])];
      const now = Date.now();
      const counts = schedules.reduce((acc, schedule) => {
        const isPast = isMySchedulePast(schedule, now);
        const participant = (schedule.participants || []).find(p => Number(p.user_id) === Number(currentUser?.id));
        const response = String(participant?.response_status || schedule.response_status || '').toLowerCase();
        acc.all++;
        if (isPast) acc.past++; else acc.upcoming++;
        if (Number(schedule.created_by_user_id) !== Number(currentUser?.id) && response === 'pending' && !isPast) acc.pending++;
        return acc;
      }, { all: 0, upcoming: 0, past: 0, pending: 0 });
      const filtered = schedules.filter(myScheduleMatchesFilter);
      panel.innerHTML = `<div class="work-panel bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 space-y-3">
          <div>
            <div class="text-base font-black text-gray-950 dark:text-gray-50 whitespace-nowrap">My Schedule</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${filtered.length} schedule${filtered.length === 1 ? '' : 's'} involving you</div>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            ${renderMyScheduleFilterChip('upcoming', 'Upcoming', counts.upcoming)}
            ${renderMyScheduleFilterChip('pending', 'Pending Invitations', counts.pending)}
            ${renderMyScheduleFilterChip('past', 'Past', counts.past)}
            ${renderMyScheduleFilterChip('all', 'All', counts.all)}
          </div>
        </div>
        ${filtered.length ? filtered.map(renderMyScheduleItem).join('') : `<div class="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"><div class="font-black text-gray-700 dark:text-gray-200">No schedules found.</div><div>Calendar schedules involving you will appear here.</div></div>`}
      </div>`;
    }

    function setWorkButtonState() {
      if (isSuperAdmin() && activeWorkPanel === 'my') activeWorkPanel = null;
      const activeCls = 'dashboard-action-active bg-emerald-700 dark:bg-emerald-500 text-white dark:text-gray-950 border-emerald-700 dark:border-emerald-500';
      const inactiveCls = 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';
      const projectsBtn = document.getElementById('projectsBtn');
      if (projectsBtn) projectsBtn.className = `px-3.5 py-2 rounded-lg font-bold transition shadow-sm flex items-center gap-2 border ${!activeWorkPanel ? activeCls : inactiveCls}`;
      [['myWorkBtn', 'my'], ['myScheduleBtn', 'schedule'], ['globalWorkBtn', 'global']].forEach(([id, mode]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const shouldHide = (mode === 'my' && isSuperAdmin()) || (mode === 'global' && !canViewWorkAssignment());
        const anchorCls = ['my', 'schedule'].includes(mode) ? 'relative overflow-visible' : '';
        btn.className = `px-3.5 py-2 rounded-lg font-bold transition shadow-sm flex items-center gap-2 border ${anchorCls} ${activeWorkPanel === mode ? activeCls : inactiveCls} ${shouldHide ? 'hidden' : ''}`;
      });
      updateMyAssignmentBadge();
      updateMyScheduleBadge();
      updateWorkAssignmentBadge();
    }

    function setDashboardMainMode(enabled) {
      document.getElementById('dashboardView')?.classList.toggle('dashboard-main-active', !!enabled);
    }

    function showProjectsPanel(updateHistory = true) {
      activeWorkPanel = null;
      setDashboardMainMode(true);
      document.getElementById('dashboardHeaderCard')?.classList.remove('hidden');
      document.getElementById('dashboardFilterCard')?.classList.remove('hidden');
      document.getElementById('dashboardMetricsCard')?.classList.remove('hidden');
      setWorkButtonState();
      renderOwnershipWorkPanel();
      if (updateHistory && appCurrentView === 'dashboard') replaceAppHistory('dashboard');
    }

    async function toggleWorkPanel(mode) {
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      if (mode === 'global' && !canViewWorkAssignment()) return;
      activeWorkPanel = mode;
      if (mode === 'global' && activeWorkPanel !== 'global') {
        resetWorkAssignmentOpenState();
      }
      setWorkButtonState();
      renderOwnershipWorkPanel();
      if (appCurrentView === 'dashboard') replaceAppHistory('dashboard');
    }

    function showMyAssignments() {
      toggleWorkPanel('my');
    }

    function showMySchedules() {
      toggleWorkPanel('schedule');
    }

    function renderOwnershipWorkPanel() {
      const panel = document.getElementById('ownershipWorkPanel');
      if (!panel) return;
      updateMyAssignmentBadge();
      updateMyScheduleBadge();
      updateWorkAssignmentBadge();
      if (!activeWorkPanel) {
        setDashboardMainMode(true);
        panel.classList.add('hidden');
        panel.innerHTML = '';
        if (workQueueFilter === 'workload') workQueueFilter = 'active';
        document.getElementById('dashboardHeaderCard')?.classList.remove('hidden');
        document.getElementById('projectsPanelWrap')?.classList.remove('hidden');
        document.getElementById('dashboardFilterCard')?.classList.remove('hidden');
        document.getElementById('dashboardMetricsCard')?.classList.remove('hidden');
        return;
      }
      setDashboardMainMode(false);
      panel.classList.remove('hidden');
      document.getElementById('dashboardHeaderCard')?.classList.add('hidden');
      document.getElementById('projectsPanelWrap')?.classList.add('hidden');
      document.getElementById('dashboardFilterCard')?.classList.add('hidden');
      document.getElementById('dashboardMetricsCard')?.classList.add('hidden');
      workItemTargetCache = {};
      if (activeWorkPanel === 'schedule') {
        if (workQueueFilter === 'workload') workQueueFilter = 'active';
        renderMySchedulePanel(panel);
        return;
      }
      const docs = (window.allDocumentsCache || []).filter(isActiveWorkDocument);
      const projects = (projCache || []).filter(isActiveWorkProject).map(p => ({ ...p, kind: 'project' }));
      const q = activeWorkPanel === 'global' ? '' : (document.getElementById('searchInput')?.value || '').toLowerCase();
      const allItems = [...docs.map(d => ({ ...d, kind: 'document' })), ...projects];
      const baseItems = allItems.filter(item => {
        const text = item.kind === 'project'
          ? `${item.name || ''} ${item.requester || ''} ${item.requestee_name || ''} ${item.assigned_username || ''}`.toLowerCase()
          : `${item.document_type_name || ''} ${item.project_name || ''} ${item.requester || ''} ${item.requestee_name || ''} ${item.assigned_username || ''}`.toLowerCase();
        if (q && !text.includes(q)) return false;
        if (activeWorkPanel === 'my') return Number(item.assigned_user_id) === Number(currentUser?.id);
        return true;
      });
      if (activeWorkPanel === 'my' && workQueueFilter === 'unassigned') workQueueFilter = 'active';
      if (workQueueFilter === 'workload' && !canViewWorkloadTab()) workQueueFilter = 'active';
      if (activeWorkPanel === 'global' && !['unassigned', 'dueSoon', 'overdue'].includes(workQueueFilter)) workQueueFilter = 'unassigned';
      const typedItems = activeWorkPanel === 'global' && workAssignmentTypeFilter !== 'both'
        ? baseItems.filter(item => item.kind === workAssignmentTypeFilter)
        : baseItems;
      const filtered = typedItems
        .filter(item => workQueueMatchesFilter(item, workQueueFilter))
        .sort((a, b) => workUrgencyScore(a) - workUrgencyScore(b) || new Date(a.due_at || '2999-01-01') - new Date(b.due_at || '2999-01-01'));
      const counts = {
        active: typedItems.length,
        assigned: typedItems.filter(item => !!item.assigned_user_id).length,
        unassigned: typedItems.filter(isUnassignedWorkItem).length,
        forReview: typedItems.filter(item => item.kind === 'document' && item.status === 'For Review').length,
        overdue: typedItems.filter(isWorkItemOverdue).length,
        dueSoon: typedItems.filter(isWorkItemDueSoon).length
      };
      const title = activeWorkPanel === 'my' ? 'My Assignments' : 'Work Assignment';
      const primaryChips = activeWorkPanel === 'global'
        ? [
          renderWorkQueueChip('unassigned', 'Unassigned', counts.unassigned),
          renderWorkQueueChip('dueSoon', 'Due Soon', counts.dueSoon),
          renderWorkQueueChip('overdue', 'Overdue', counts.overdue)
        ].join('')
        : [
          renderWorkQueueChip('active', 'Active Task', counts.active),
          renderWorkQueueChip('assigned', 'Assigned', counts.assigned),
          renderWorkQueueChip('forReview', 'For Review', counts.forReview),
          renderWorkQueueChip('overdue', 'Overdue', counts.overdue),
          renderWorkQueueChip('dueSoon', 'Due Soon', counts.dueSoon)
        ].join('');
      const workloadOpen = activeWorkPanel === 'my' && workQueueFilter === 'workload';
      const typeFilter = activeWorkPanel === 'global' ? `<select onchange="setWorkAssignmentTypeFilter(this.value)" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-bold text-gray-700 dark:text-gray-200">
        <option value="both" ${workAssignmentTypeFilter === 'both' ? 'selected' : ''}>Project + Document</option>
        <option value="project" ${workAssignmentTypeFilter === 'project' ? 'selected' : ''}>Project</option>
        <option value="document" ${workAssignmentTypeFilter === 'document' ? 'selected' : ''}>Document</option>
      </select>` : '';
      panel.innerHTML = `<div class="work-panel bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div class="text-base font-black text-gray-950 dark:text-gray-50 whitespace-nowrap">${title}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${workloadOpen ? 'Assignments per user' : `${filtered.length} active item${filtered.length === 1 ? '' : 's'} in this queue`}</div>
            </div>
            ${activeWorkPanel === 'global' ? `<button type="button" onclick="workAssignmentMultiSelect=!workAssignmentMultiSelect; if(!workAssignmentMultiSelect) workAssignmentSelected={}; renderOwnershipWorkPanel()" class="self-start sm:self-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900">${workAssignmentMultiSelect ? 'Cancel Bulk Assign' : 'Bulk Assign'}</button>` : ''}
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div class="flex flex-wrap gap-2 text-xs">${primaryChips}</div>
            ${typeFilter}
          </div>
        </div>
        ${workloadOpen ? renderWorkloadTabShell() : (activeWorkPanel === 'global' ? renderGroupedWorkAssignments(filtered) : `<div class="hidden md:grid grid-cols-[minmax(0,1fr)_120px_190px_170px] gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
          <div>Work item</div>
          <div>Type</div>
          <div>Assigned to</div>
          <div>Due Date</div>
        </div>
        ${filtered.length ? filtered.map(renderWorkItem).join('') : `<div class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">${activeWorkPanel === 'my' ? 'No active work assigned to you.' : 'No active work found.'}</div>`}`)}
      </div>`;
      if (workloadOpen) renderDashboardWorkload();
      renderWorkAssignmentBulkBar();
    }

    async function openWorkItem(projectId, documentId, stage, targetType = 'project') {
      const hasDocument = !!documentId;

      return goToTarget({
        project_id: Number(projectId),
        document_id: hasDocument ? Number(documentId) : null,
        stage: stage || 'Proposal',
        target_kind: hasDocument
          ? 'document'
          : ['overdue', 'due_soon', 'dueSoon', 'project_due_date', 'project_due'].includes(targetType)
            ? 'project_due_date'
            : 'project',
        target_type: targetType
      });
    }

    async function openWorkItemFromDataset(row) {
      const targetRow = row?.closest?.('.work-row') || row;
      if (!targetRow?.dataset) {
        toast('Target project is not available.', 'error');
        return false;
      }

      const projectId = Number(targetRow.dataset.projectId);
      const documentId = targetRow.dataset.documentId ? Number(targetRow.dataset.documentId) : null;
      const stage = targetRow.dataset.stage || 'Proposal';
      const targetType = targetRow.dataset.targetType || (documentId ? 'document' : 'project');
      const targetKind = documentId ? 'document' : (targetRow.dataset.targetKind || 'project');

      return goToTarget({
        project_id: projectId,
        document_id: documentId,
        stage,
        target_kind: targetKind,
        target_type: targetType,
        target_meta: {
          stage,
          target_type: targetType
        }
      });
    }

    async function openWorkItemTarget(key) {
      const target = workItemTargetCache[key];
      if (!target) {
        toast('Target project is not available.', 'error');
        return false;
      }
      if (target.target_kind === 'calendar_event' && target.calendar_event_id) {
        await openManualCalendarEventById(target.calendar_event_id);
        return true;
      }
      return goToTarget({ ...target, target_meta: { ...(target.target_meta || {}) } });
    }

    async function openProjectTarget(projectId, stage = 'Proposal') {
      return goToTarget({
        project_id: Number(projectId),
        stage: stage || 'Proposal',
        target_type: 'project',
        target_kind: 'project'
      });
    }

    async function openDashboardProject(projectId, stage = 'Proposal') {
      lastDetailScrollTarget = null;
      return showDetails(Number(projectId), stage || 'Proposal', true);
    }
    function openDashboardProjectFromRow(row, event) {
      if (event?.target?.closest?.('button,a,input,select,textarea,[role="button"]')) return false;
      return openDashboardProject(Number(row?.dataset?.id), row?.dataset?.stage || 'Proposal');
    }
    window.openWorkItem = openWorkItem;
    window.openWorkItemFromDataset = openWorkItemFromDataset;
    window.openWorkItemTarget = openWorkItemTarget;
    window.openProjectTarget = openProjectTarget;
    window.openDashboardProject = openDashboardProject;
    window.openDashboardProjectFromRow = openDashboardProjectFromRow;

    const configGuideText = `Configure document requirements based on the project type, the agency to which the project is requested, and the project stage.`;

    const STAGE_EDIT_ACTION_META = {
      upload: { field: 'allow_upload', label: 'Upload' },
      delete_file: { field: 'allow_delete_file', label: 'Delete File' },
      status_change: { field: 'allow_status_change', label: 'Change Status' },
      requirement_state_change: { field: 'allow_requirement_state_change', label: 'Change Requirement State' },
      due_date_change: { field: 'allow_due_date_change', label: 'Change Due Date' },
      assignment_change: { field: 'allow_assignment_change', label: 'Change Assignment' }
    };

    function stageAccessStatus(access) {
      if (access.revoked_at) return 'Revoked';
      if (access.expires_at && new Date(access.expires_at) <= new Date()) return 'Expired';
      return 'Active';
    }

    function stageAccessActionLabels(access) {
      return Object.values(STAGE_EDIT_ACTION_META).filter(meta => !!access[meta.field]).map(meta => meta.label);
    }

    async function loadStageEditAccess(projectId) {
      if (!projectId || !currentUser) { stageEditAccessCache = []; return []; }
      try {
        stageEditAccessCache = await fetchJson(`${API}/projects/${projectId}/stage-edit-access`, { silentLoading: true });
      } catch (e) {
        stageEditAccessCache = [];
      }
      return stageEditAccessCache;
    }

    function hasTemporaryStageAccess(stage, action) {
      if (currentUser?.role === 'superadmin') return true;
      const meta = STAGE_EDIT_ACTION_META[action];
      if (!meta) return false;
      return (stageEditAccessCache || []).some(access =>
        access.stage === stage &&
        stageAccessStatus(access) === 'Active' &&
        !!access[meta.field] &&
        (!access.granted_to_user_id || Number(access.granted_to_user_id) === Number(currentUser?.id))
      );
    }

    function activeStageAccessFor(stage) {
      return (stageEditAccessCache || []).filter(access =>
        access.stage === stage &&
        stageAccessStatus(access) === 'Active' &&
        (!access.granted_to_user_id || Number(access.granted_to_user_id) === Number(currentUser?.id) || currentUser?.role === 'superadmin')
      );
    }

    function renderTemporaryStageAccessBanner(stage, isLocked) {
      const banner = document.getElementById('temporaryStageAccessBanner');
      if (!banner) return;
      const accessRows = activeStageAccessFor(stage);
      if (!isLocked || !accessRows.length) {
        banner.classList.add('hidden');
        banner.innerHTML = '';
        return;
      }
      const first = accessRows[0];
      const actionText = [...new Set(accessRows.flatMap(stageAccessActionLabels))].join(', ') || 'selected actions';
      const expiryText = first.expires_at ? `until ${fmtDateTime(first.expires_at)}` : 'with no expiration';
      banner.innerHTML = `<div class="font-black">Temporary Edit Access Active</div><div class="mt-1">${currentUser?.role === 'superadmin' ? 'Temporary edit access is active for this stage.' : 'You have temporary edit access for this read-only stage.'}</div><div class="mt-1"><span class="font-bold">Allowed actions:</span> ${esc(actionText)} ${esc(expiryText)}.</div><div class="mt-1"><span class="font-bold">Reason:</span> ${esc(first.reason || '-')}</div>`;
      banner.classList.remove('hidden');
    }

    async function switchDetailStage(stage, options = {}) {
        activeDetailStage = stage;
        if (appCurrentView === 'projectDetail' && currentProjId && !restoringHistoryState && options.replaceHistory !== false) replaceAppHistory('projectDetail', { projectId: currentProjId, stage });
        const notice = document.getElementById('stageLockedNotice');
        WORKFLOW_STAGES.forEach(key => {
            const tab = document.getElementById(STAGE_TAB_IDS[key]);
            if (!tab) return;
            const stageClass = `detail-stage-tab-${key.toLowerCase()}`;
            tab.className = `detail-stage-tab ${stageClass} flex-1 sm:flex-none px-4 py-2.5 text-sm transition ${stage === key ? 'detail-stage-tab-active' : ''}`;
        });
        const p = projCache.find(x => x.id == currentProjId);
        const isLocked = p && (p.stage === 'Completed' || (stageIndex(stage) >= 0 && stageIndex(p.stage) > stageIndex(stage)));
        await loadStageEditAccess(currentProjId);
        notice.classList.toggle('hidden', !isLocked);
        renderTemporaryStageAccessBanner(stage, isLocked);
        const docsPromise = loadDocs(currentProjId, stage, options.silentDocs ? { silent: true } : {});
        refreshProjectDocumentationCounts({ silent: true });
        renderTransitionButton();
        return docsPromise;
    }

    function stageEditAccessActionInputs() {
      return [...document.querySelectorAll('[data-stage-access-action]')];
    }

    window.updateStageEditAccessActionCount = function() {
      const inputs = stageEditAccessActionInputs();
      const checked = inputs.filter(input => input.checked).length;
      const count = document.getElementById('stageEditAccessActionCount');
      if (count) count.textContent = `${checked} action${checked === 1 ? '' : 's'} selected`;
      const checkAll = document.getElementById('stageEditAccessCheckAll');
      const uncheckAll = document.getElementById('stageEditAccessUncheckAll');
      if (checkAll) checkAll.disabled = checked === inputs.length;
      if (uncheckAll) uncheckAll.disabled = checked === 0;
      [checkAll, uncheckAll].forEach(btn => btn?.classList.toggle('opacity-50', btn.disabled));
    };

    window.setStageEditAccessActions = function(checked) {
      stageEditAccessActionInputs().forEach(input => input.checked = !!checked);
      updateStageEditAccessActionCount();
    };

    window.toggleStageEditAccessExpiration = function() {
      const noExpiration = document.getElementById('stageEditAccessNoExpiration')?.checked;
      const expires = document.getElementById('stageEditAccessExpires');
      if (expires) {
        expires.disabled = !!noExpiration;
        expires.classList.toggle('opacity-60', !!noExpiration);
      }
    };

    window.applyStageEditAccessReasonSuggestion = function() {
      const select = document.getElementById('stageEditAccessReasonSuggestion');
      const textarea = document.getElementById('stageEditAccessReason');
      if (!select || !textarea) return;
      const value = select.value;
      if (!value) return;
      if (value === '__other') {
        textarea.focus();
        select.value = '';
        return;
      }
      textarea.value = textarea.value.trim() ? `${textarea.value.trim()}\n${value}` : value;
      textarea.focus();
      select.value = '';
      toast('Suggested reason added. You may edit it before saving.');
    };

    function defaultStageEditExpirationValue() {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }

    function canManageStageEditAccess() {
      return hasPrivilege('manage_stage_edit_access');
    }

    async function loadStageEditAccessUsers() {
      if (stageEditAccessUsersCache.length) return stageEditAccessUsersCache;
      try {
        stageEditAccessUsersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, { silentLoading: true }));
      } catch (e) {
        stageEditAccessUsersCache = usersCache || [];
      }
      return stageEditAccessUsersCache;
    }

    function renderStageEditAccessList() {
      const target = document.getElementById('stageEditAccessList');
      if (!target) return;
      const rows = stageEditAccessCache || [];
      target.innerHTML = rows.map(access => {
        const status = stageAccessStatus(access);
        const actions = stageAccessActionLabels(access).join(', ') || '-';
        const statusCls = status === 'Active' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : (status === 'Expired' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700');
        return `<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 text-sm">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-gray-900 dark:text-gray-100">${esc(access.stage)} - ${esc(access.granted_to_username || 'All eligible users')}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Allowed: ${esc(actions)}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Expires: ${access.expires_at ? fmtDateTime(access.expires_at) : 'No expiration'}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Created by: ${esc(access.created_by_username || '-')} on ${fmtDateTime(access.created_at)}</div>
            </div>
            <span class="inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black ${statusCls}">${status}</span>
          </div>
          <div class="mt-2 text-xs text-gray-700 dark:text-gray-300"><span class="font-bold">Reason:</span> ${esc(access.reason || '-')}</div>
          ${access.revoke_reason ? `<div class="mt-1 text-xs text-gray-500 dark:text-gray-400"><span class="font-bold">Revoke reason:</span> ${esc(access.revoke_reason)}</div>` : ''}
          ${canManageStageEditAccess() && status === 'Active' ? `<button type="button" onclick="revokeStageEditAccess(${Number(access.id)})" class="mt-3 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-bold text-xs hover:bg-red-100 dark:hover:bg-red-900/40">Revoke Access</button>` : ''}
        </div>`;
      }).join('') || '<div class="text-sm text-gray-500 dark:text-gray-400 p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">No temporary stage edit access records for this project.</div>';
    }

    window.openStageEditAccessModal = async function() {
      if (!canManageStageEditAccess()) return toast('Permission denied: manage_stage_edit_access', 'error');
      const project = projCache.find(p => Number(p.id) === Number(currentProjId));
      document.getElementById('stageEditAccessProjectName').textContent = project ? `${project.name} - currently viewing ${activeDetailStage}` : '';
      document.getElementById('stageEditAccessStage').value = activeDetailStage || 'Proposal';
      document.getElementById('stageEditAccessReason').value = '';
      document.getElementById('stageEditAccessReasonSuggestion').value = '';
      document.getElementById('stageEditAccessNoExpiration').checked = false;
      document.getElementById('stageEditAccessExpires').value = defaultStageEditExpirationValue();
      toggleStageEditAccessExpiration();
      setStageEditAccessActions(false);
      const users = await loadStageEditAccessUsers();
      const userSelect = document.getElementById('stageEditAccessUser');
      userSelect.innerHTML = '<option value="">All eligible users</option>' + (users || []).map(u => `<option value="${Number(u.id)}">${esc(u.username)} (${esc(u.role || 'user')})</option>`).join('');
      await loadStageEditAccess(currentProjId);
      renderStageEditAccessList();
      document.getElementById('stageEditAccessModal').classList.remove('hidden');
    };

    window.revokeStageEditAccess = async function(accessId) {
      openConfirmModal(`
        <div class="space-y-3 text-sm">
          <p>Revoking this temporary access immediately removes the user's permission to edit the selected project stage.</p>
          <label class="block">
            <span class="block font-bold text-gray-900 dark:text-gray-100 mb-1.5">Reason for revoking access</span>
            <textarea id="stageEditAccessRevokeReason" rows="4" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="Enter the revoke reason"></textarea>
          </label>
        </div>`, null, { title: 'Revoke Temporary Access', confirmText: 'Revoke Access' });
      document.getElementById('confirmActionBtn').onclick = async () => {
        const revoke_reason = document.getElementById('stageEditAccessRevokeReason')?.value.trim();
        if (!revoke_reason) return toast('Revoke reason is required.', 'error');
        try {
          await fetchJson(`${API}/stage-edit-access/${accessId}/revoke`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revoke_reason })
          });
          closeConfirmModal();
          toast('Temporary stage edit access revoked.');
          await loadStageEditAccess(currentProjId);
          renderStageEditAccessList();
          renderTemporaryStageAccessBanner(activeDetailStage, !!(projCache.find(p => Number(p.id) === Number(currentProjId)) && stageIndex(projCache.find(p => Number(p.id) === Number(currentProjId)).stage) > stageIndex(activeDetailStage)));
          await loadDocs(currentProjId, activeDetailStage, { silent: true });
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    };

    document.getElementById('stageEditAccessForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const actions = {};
      stageEditAccessActionInputs().forEach(input => actions[input.dataset.stageAccessAction] = input.checked);
      const selected = Object.values(actions).filter(Boolean).length;
      if (!selected) return toast('Select at least one allowed action.', 'error');
      const reason = document.getElementById('stageEditAccessReason').value.trim();
      if (!reason) return toast('Reason is required.', 'error');
      const noExpiration = document.getElementById('stageEditAccessNoExpiration').checked;
      const expiresValue = document.getElementById('stageEditAccessExpires').value;
      if (!noExpiration && (!expiresValue || new Date(expiresValue) <= new Date())) return toast('Expiration must be in the future.', 'error');
      const body = {
        stage: document.getElementById('stageEditAccessStage').value,
        granted_to_user_id: document.getElementById('stageEditAccessUser').value || null,
        ...actions,
        reason,
        expires_at: noExpiration ? null : new Date(expiresValue).toISOString()
      };
      try {
        await fetchJson(`${API}/projects/${currentProjId}/stage-edit-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        toast('Temporary stage edit access granted.');
        document.getElementById('stageEditAccessReason').value = '';
        setStageEditAccessActions(false);
        await loadStageEditAccess(currentProjId);
        renderStageEditAccessList();
        await loadDocs(currentProjId, activeDetailStage, { silent: true });
        const p = projCache.find(x => Number(x.id) === Number(currentProjId));
        const isLocked = p && (p.stage === 'Completed' || (stageIndex(activeDetailStage) >= 0 && stageIndex(p.stage) > stageIndex(activeDetailStage)));
        renderTemporaryStageAccessBanner(activeDetailStage, isLocked);
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    function arrangeCompactDashboard() {
      const metricsSlot = document.getElementById('dashboardMetricsSlot');
      const headerCard = document.getElementById('dashboardHeaderCard');
      const metrics = document.getElementById('summaryMetricsBar');
      const metricsCard = document.getElementById('dashboardMetricsCard');
      if (metricsSlot && headerCard && metricsSlot.parentElement !== headerCard) headerCard.appendChild(metricsSlot);
      if (metrics && metricsCard && metrics.parentElement !== metricsCard) metricsCard.appendChild(metrics);
      metricsCard?.classList.remove('hidden');
    }

    async function showDashboard(pushHistory = true, options = {}){ 
      if (!currentUser) return showAuthView(); 
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      if (options.projectsPanel) activeWorkPanel = null;
      if (['my', 'schedule', 'global'].includes(options.workPanel)) {
        activeWorkPanel = options.workPanel;
        if (options.workPanel === 'global' && options.resetWorkAssignment) resetWorkAssignmentOpenState();
      }
      if (options.dashboardState) applyDashboardState(options.dashboardState);
      navigateTo('dashboard', { dashboardState: collectDashboardState() }, pushHistory);
      arrangeCompactDashboard();
      setDashboardMainMode(!activeWorkPanel);
      document.getElementById('dashboardHeaderCard')?.classList.toggle('hidden', !!activeWorkPanel);
      document.getElementById('dashboardFilterCard')?.classList.toggle('hidden', !!activeWorkPanel);
      
      // Restore saved filters when returning to dashboard
      const searchInput = document.getElementById('searchInput');
      const filterRequestee = document.getElementById('filterRequestee');
      const filterType = document.getElementById('filterType');
      const filterOutcome = document.getElementById('filterOutcome');
      const sortOrder = document.getElementById('sortOrder');
      
      if (searchInput) searchInput.value = dashboardSavedFilters.search;
      if (filterRequestee && reqCache.some(r => r.name === dashboardSavedFilters.requestee)) {
        filterRequestee.value = dashboardSavedFilters.requestee;
      }
      if (filterType && typeCache.some(t => t.name === dashboardSavedFilters.type)) {
        filterType.value = dashboardSavedFilters.type;
      }
      if (filterOutcome) filterOutcome.value = dashboardSavedFilters.outcome || dashboardOutcomeFilter || 'Active';
      if (sortOrder) sortOrder.value = dashboardSavedFilters.sort;
      
      if (activeWorkPanel) {
        setWorkButtonState();
        renderOwnershipWorkPanel();
      } else {
        showProjectsPanel(false);
      }
      loadDash();
    }

    async function showReviewDocumentsPage(pushHistory = true) {
      if (!currentUser) return showAuthView();
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
      setSidebarActive('review');
      navigateTo('review', {}, pushHistory);
      await loadReviewDocuments({ silent: true });
      renderReviewDocumentsPage();
    }

    async function loadReviewDocuments(options = {}) {
      if (!currentUser) {
        window.reviewDocumentsCache = [];
        window.reviewedDocumentsCache = [];
        updateForReviewSidebarBadge();
        return [];
      }
      try {
        window.reviewDocumentsCache = await fetchJson(`${API}/documents/for-review`, options.silent ? { silentLoading: true } : {});
        window.reviewedDocumentsCache = await fetchJson(`${API}/documents/reviewed`, options.silent ? { silentLoading: true } : {});
      } catch (e) {
        window.reviewDocumentsCache = [];
        window.reviewedDocumentsCache = [];
        if (!options.silent) toast(e.message, 'error');
      }
      updateForReviewSidebarBadge();
      return window.reviewDocumentsCache;
    }

    function updateForReviewSidebarBadge() {
      const badge = document.getElementById('forReviewSidebarBadge');
      if (!badge) return;
      const count = (window.reviewDocumentsCache || []).length;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0 || !currentUser);
    }

    function setReviewDocumentsMode(mode) {
      reviewDocumentsMode = mode === 'reviewed' ? 'reviewed' : 'pending';
      renderReviewDocumentsPage();
    }

    function renderReviewDocumentsPage() {
      const list = document.getElementById('reviewDocumentsList');
      if (!list) return;
      const q = (document.getElementById('reviewDocumentsSearch')?.value || '').trim().toLowerCase();
      const reviewedMode = reviewDocumentsMode === 'reviewed';
      const pendingBtn = document.getElementById('reviewModePendingBtn');
      const reviewedBtn = document.getElementById('reviewModeReviewedBtn');
      pendingBtn?.classList.toggle('bg-yellow-600', !reviewedMode);
      pendingBtn?.classList.toggle('text-white', !reviewedMode);
      pendingBtn?.classList.toggle('text-gray-600', reviewedMode);
      pendingBtn?.classList.toggle('dark:text-gray-300', reviewedMode);
      reviewedBtn?.classList.toggle('bg-green-600', reviewedMode);
      reviewedBtn?.classList.toggle('text-white', reviewedMode);
      reviewedBtn?.classList.toggle('text-gray-600', !reviewedMode);
      reviewedBtn?.classList.toggle('dark:text-gray-300', !reviewedMode);
      const reviewDocs = reviewedMode ? (window.reviewedDocumentsCache || []) : (window.reviewDocumentsCache || []);
      const docs = reviewDocs
        .filter(doc => {
          const text = `${doc.project_name || ''} ${doc.document_type_name || ''} ${doc.requester || ''} ${doc.requestee_name || ''} ${doc.assigned_username || ''} ${doc.uploader_username || ''} ${doc.checked_by_username || ''} ${doc.file_name || ''} ${doc.stage || doc.project_stage || ''}`.toLowerCase();
          return !q || text.includes(q);
        });
      const total = reviewDocs.length;
      const subtext = document.getElementById('reviewDocumentsSubtext');
      if (subtext) subtext.textContent = reviewedMode ? `${docs.length} of ${total} reviewed document${total === 1 ? '' : 's'}` : `${docs.length} of ${total} document${total === 1 ? '' : 's'} for review`;
      if (!docs.length) {
        list.innerHTML = `<div class="p-10 text-center text-gray-500 dark:text-gray-400">${q ? `No matching ${reviewedMode ? 'reviewed documents' : 'documents for review'}.` : `No ${reviewedMode ? 'reviewed documents yet' : 'documents for review'}.`}</div>`;
        return;
      }
      list.innerHTML = `<table class="min-w-[920px] w-full text-left text-sm">
        <thead class="bg-gray-50 dark:bg-gray-950 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <tr><th class="px-4 py-3">Project</th><th class="px-4 py-3">Document</th><th class="px-4 py-3">Stage</th><th class="px-4 py-3">Assigned to</th><th class="px-4 py-3">Uploaded by</th><th class="px-4 py-3">${reviewedMode ? 'Reviewed' : 'Uploaded'}</th><th class="px-4 py-3">File</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          ${docs.map(doc => {
            const stage = doc.stage || doc.project_stage || 'Proposal';
            const target = esc(JSON.stringify({ project_id: Number(doc.project_id), document_id: Number(doc.id), stage, target_kind: 'document', target_type: 'forReview' }));
            const statusLabel = reviewedMode ? 'Reviewed' : 'For Review';
            const statusClass = reviewedMode ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300';
            return `<tr class="hover:bg-yellow-50/60 dark:hover:bg-yellow-950/20 cursor-pointer" onclick="goToTarget(${target})">
              <td class="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">${esc(doc.project_name || 'Untitled project')}<div class="text-xs font-medium text-gray-500 dark:text-gray-400">${esc(doc.requester || '-')}</div></td>
              <td class="px-4 py-3 text-gray-700 dark:text-gray-200">${esc(doc.document_type_name || '-')}<div class="text-xs ${statusClass} font-bold">${statusLabel}</div></td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${esc(stage)}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${esc(ownerDisplayName(doc))}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${esc(doc.uploader_username || '-')}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${reviewedMode ? (doc.checked_at ? fmtDateTime(doc.checked_at) : '-') : (doc.upload_date ? fmtDateTime(doc.upload_date) : '-')}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${esc(doc.file_name || '-')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    }

    function resetDashboardFilters() {
      const searchInput = document.getElementById('searchInput');
      const filterRequestee = document.getElementById('filterRequestee');
      const filterType = document.getElementById('filterType');
      const filterOutcome = document.getElementById('filterOutcome');
      const sortOrder = document.getElementById('sortOrder');
      if (searchInput) searchInput.value = '';
      if (filterRequestee) filterRequestee.value = 'All';
      if (filterType) filterType.value = 'All';
      if (filterOutcome) filterOutcome.value = 'Active';
      dashboardOutcomeFilter = 'Active';
      if (sortOrder) sortOrder.value = 'created';
      filterDashboardByStage('All');
      dashboardSavedFilters = { search: '', requestee: 'All', type: 'All', outcome: 'Active', sort: 'created' };
      dashboardPage = 1;
      renderProjects();
      renderOwnershipWorkPanel();
      closeDashboardFilterDrawer();
    }

    function openDashboardFilterDrawer() {
      const drawer = document.getElementById('dashboardFilterDrawer');
      if (!drawer) return;
      const req = document.getElementById('filterRequestee');
      const type = document.getElementById('filterType');
      const outcome = document.getElementById('filterOutcome');
      const sort = document.getElementById('sortOrder');
      const dReq = document.getElementById('drawerRequestee');
      const dType = document.getElementById('drawerType');
      const dOutcome = document.getElementById('drawerOutcome');
      const dSort = document.getElementById('drawerSort');
      if (dReq && req) dReq.innerHTML = req.innerHTML;
      if (dType && type) dType.innerHTML = type.innerHTML;
      if (dOutcome && outcome) dOutcome.innerHTML = outcome.innerHTML;
      if (dSort && sort) dSort.innerHTML = sort.innerHTML;
      if (dReq && req) dReq.value = req.value;
      if (dType && type) dType.value = type.value;
      if (dOutcome && outcome) dOutcome.value = outcome.value;
      if (dSort && sort) dSort.value = sort.value;
      drawer.classList.remove('hidden');
    }
    function closeDashboardFilterDrawer() {
      document.getElementById('dashboardFilterDrawer')?.classList.add('hidden');
      clearOverlayHistoryMarker('dashboardFilterDrawer');
    }
    function syncDashboardDrawerFilters() {}
    function applyDashboardDrawerFilters() {
      const req = document.getElementById('filterRequestee');
      const type = document.getElementById('filterType');
      const outcome = document.getElementById('filterOutcome');
      const sort = document.getElementById('sortOrder');
      const dReq = document.getElementById('drawerRequestee');
      const dType = document.getElementById('drawerType');
      const dOutcome = document.getElementById('drawerOutcome');
      const dSort = document.getElementById('drawerSort');
      if (req && dReq) req.value = dReq.value;
      if (type && dType) type.value = dType.value;
      if (outcome && dOutcome) outcome.value = dOutcome.value;
      if (sort && dSort) sort.value = dSort.value;
      closeDashboardFilterDrawer();
      renderProjects();
    }
    async function showSettings(pushHistory = true, options = {}){ 
      // All authenticated users can access General Settings (Appearance and Change Password)
      const targetSection = options.section || getFirstAvailableSettingsSection();
      if (!restoringHistoryState && appCurrentView === 'settings' && activeSettingsSection === 'requirements' && targetSection !== 'requirements' && !(await confirmLeaveRequirementsConfig())) return;
      
      // Save current dashboard filter state before navigating to settings
      const searchInput = document.getElementById('searchInput');
      const filterRequestee = document.getElementById('filterRequestee');
      const filterType = document.getElementById('filterType');
      const filterOutcome = document.getElementById('filterOutcome');
      const sortOrder = document.getElementById('sortOrder');
      
      if (searchInput) dashboardSavedFilters.search = searchInput.value;
      if (filterRequestee) dashboardSavedFilters.requestee = filterRequestee.value;
      if (filterType) dashboardSavedFilters.type = filterType.value;
      if (filterOutcome) dashboardSavedFilters.outcome = filterOutcome.value;
      if (sortOrder) dashboardSavedFilters.sort = sortOrder.value;
      applyDefaultCalendarFiltersForCurrentUser();
      if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
      
      navigateTo('settings', { section: targetSection }, pushHistory);
      
      // Apply sidebar navigation visibility
      applySettingsSidebarVisibility();
      
      // Update user profile header
      updateSettingsUserProfile();
      
      // Switch to first available section - prioritize Appearance for non-admin users
      await switchSettingsSection(targetSection);
    }

    function showFormsTools(pushHistory = true) {
      return showSettings(pushHistory, { section: 'downloads-forms' });
    }
    
    // Get the first available settings section based on privileges
    function getFirstAvailableSettingsSection() {
      // For regular users without admin privileges, default to Appearance
      if (!hasPrivilege('manage_project_types') && 
          !hasPrivilege('manage_requestees') && 
          !hasPrivilege('manage_document_types') && 
          !hasPrivilege('manage_due_schedules') && 
          !hasPrivilege('manage_requirements') && 
          !hasPrivilege('import_export_config') &&
          !hasPrivilege('manage_users') &&
          !hasPrivilege('view_activity_logs') &&
          !hasPrivilege('view_workload_analytics') &&
          !hasPrivilege('manage_backups') &&
          !canUsePendingConfirmations() &&
          !hasPrivilege('manage_maintenance')) {
        return 'appearance';
      }
      
      // For admin users, show their first available admin section
      if (hasPrivilege('manage_project_types')) return 'project-types';
      if (hasPrivilege('manage_requestees')) return 'requestees';
      if (hasPrivilege('manage_document_types')) return 'document-types';
      if (hasPrivilege('manage_requirements')) return 'requirements';
      if (hasPrivilege('manage_due_schedules')) return 'document-due-schedules';
      if (hasPrivilege('manage_users')) return 'user-management';
      if (hasPrivilege('view_activity_logs')) return 'activity-logs';
      if (hasPrivilege('view_workload_analytics')) return 'workload-analytics';
      if (hasPrivilege('import_export_config')) return 'config-import-export';
      if (hasPrivilege('manage_backups')) return 'backup-restore';
      if (canUsePendingConfirmations()) return 'pending-confirmations';
      if (hasPrivilege('manage_maintenance')) return 'admin-maintenance';
      return 'appearance'; // fallback
    }
    
    // Apply sidebar navigation visibility based on privileges
    function applySettingsSidebarVisibility() {
      // First hide ALL settings nav items
      const allNavItems = ['project-types', 'requestees', 'document-types', 'document-due-schedules', 'requirements', 'user-management', 'activity-logs', 'workload-analytics', 'backup-restore', 'downloads-forms', 'pending-confirmations', 'config-import-export', 'admin-maintenance'];
      for (const navId of allNavItems) {
        const navBtn = document.getElementById(`nav-${navId}`);
        if (navBtn) navBtn.classList.add('hidden');
      }
      
      // Hide Administration section by default
      const adminSectionElements = document.querySelectorAll('.administration-section');
      adminSectionElements.forEach(el => el.style.display = 'none');
      
      // Hide Configuration section by default
      const configSectionElements = document.querySelectorAll('[data-group="configuration"]');
      configSectionElements.forEach(el => el.style.display = 'none');
      
      // Now show only authorized nav items
      let hasConfigPrivileges = false;
      if (hasPrivilege('manage_project_types')) {
        document.getElementById('nav-project-types')?.classList.remove('hidden');
        hasConfigPrivileges = true;
      }
      if (hasPrivilege('manage_requestees')) {
        document.getElementById('nav-requestees')?.classList.remove('hidden');
        hasConfigPrivileges = true;
      }
      if (hasPrivilege('manage_document_types')) {
        document.getElementById('nav-document-types')?.classList.remove('hidden');
        hasConfigPrivileges = true;
      }
      if (hasPrivilege('manage_requirements')) {
        document.getElementById('nav-requirements')?.classList.remove('hidden');
        hasConfigPrivileges = true;
      }
      if (hasPrivilege('manage_due_schedules')) {
        document.getElementById('nav-document-due-schedules')?.classList.remove('hidden');
        hasConfigPrivileges = true;
      }
      if (hasPrivilege('import_export_config')) {
        document.getElementById('nav-config-import-export')?.classList.remove('hidden');
      }
      // Show Configuration section header if any config privileges are enabled
      if (hasConfigPrivileges) {
        configSectionElements.forEach(el => el.style.display = '');
      }
      if (hasPrivilege('manage_users')) document.getElementById('nav-user-management')?.classList.remove('hidden');
      if (hasPrivilege('view_activity_logs')) document.getElementById('nav-activity-logs')?.classList.remove('hidden');
      if (hasPrivilege('view_workload_analytics')) document.getElementById('nav-workload-analytics')?.classList.remove('hidden');
      if (hasPrivilege('manage_backups')) document.getElementById('nav-backup-restore')?.classList.remove('hidden');
      if (canUsePendingConfirmations()) document.getElementById('nav-pending-confirmations')?.classList.remove('hidden');
      if (hasPrivilege('manage_maintenance')) document.getElementById('nav-admin-maintenance')?.classList.remove('hidden');
      adminSectionElements.forEach(el => el.style.display = '');
      // My Account and Changelog are always visible for all users
      document.getElementById('nav-appearance')?.classList.remove('hidden');
      document.getElementById('nav-change-password')?.classList.remove('hidden');
      document.getElementById('nav-mobile-qr-login')?.classList.remove('hidden');
      document.getElementById('nav-changelog')?.classList.remove('hidden');
      updatePendingConfirmationsBadge();
    }

    async function updatePendingConfirmationsBadge() {
      const badges = ['pendingConfirmationsBadge', 'approvalsSidebarBadge']
        .map(id => document.getElementById(id))
        .filter(Boolean);
      if (!badges.length || !currentUser || !canUsePendingConfirmations()) {
        badges.forEach(badge => badge.classList.add('hidden'));
        return;
      }
      try {
        const data = await fetchJson(`${API}/configuration-change-requests/pending-count`, { silentLoading: true });
        const count = Number(data?.count || 0);
        badges.forEach(badge => {
          badge.textContent = count > 99 ? '99+' : String(count);
          badge.classList.toggle('hidden', count <= 0);
        });
      } catch (e) {
        badges.forEach(badge => badge.classList.add('hidden'));
      }
    }
    
    // Update user profile header in settings sidebar
    function updateSettingsUserProfile() {
      if (currentUser) {
        const avatarEl = document.getElementById('settingsUserAvatar');
        const nameEl = document.getElementById('settingsUserName');
        const roleEl = document.getElementById('settingsUserRole');
        const profilePreview = document.getElementById('profileAvatarPreview');
        const profileName = document.getElementById('profileAvatarName');
        const profileRole = document.getElementById('profileAvatarRole');
        
        if (avatarEl) {
          avatarEl.className = 'w-10 h-10 rounded-xl overflow-hidden shadow-sm';
          avatarEl.innerHTML = renderUserAvatar(currentUser, 40, 'text-lg');
        }
        if (nameEl) {
          nameEl.textContent = displayUsername(currentUser.username);
        }
        if (roleEl) {
          roleEl.textContent = (currentUser.role || 'user').replace('_', ' ').toUpperCase();
        }
        if (profilePreview) profilePreview.innerHTML = renderUserAvatar(currentUser, 88, 'text-2xl');
        if (profileName) profileName.textContent = displayUsername(currentUser.username);
        if (profileRole) profileRole.textContent = (currentUser.role || 'user').replace('_', ' ').toUpperCase();
      }
    }

    function applyUpdatedCurrentUser(user) {
      if (!user) return;
      currentUser = { ...currentUser, ...user, token: currentUser?.token || authToken };
      localStorage.setItem('abedCurrentUser', JSON.stringify(currentUser));
      usersCache = (usersCache || []).map(u => Number(u.id) === Number(currentUser.id) ? { ...u, ...user } : u);
      updateRoleUi();
      updateSettingsUserProfile();
      renderCalendarUserSearch();
    }

    async function uploadCurrentUserAvatar(input) {
      const file = input?.files?.[0];
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        input.value = '';
        return toast('Invalid file type. Please upload JPG, PNG, or WEBP.', 'error');
      }
      const form = new FormData();
      form.append('avatar', file);
      try {
        const result = await fetchJson(`${API}/me/avatar`, { method: 'POST', body: form });
        applyUpdatedCurrentUser(result.user);
        toast('Avatar updated successfully.');
      } catch (e) {
        toast(e.message || 'Failed to upload avatar. Please try again.', 'error');
      } finally {
        input.value = '';
      }
    }

    function removeCurrentUserAvatar() {
      openConfirmModal('Remove your profile avatar?', async () => {
        try {
          const result = await fetchJson(`${API}/me/avatar`, { method: 'DELETE' });
          applyUpdatedCurrentUser(result.user);
          toast('Avatar removed.');
        } catch (e) {
          toast(e.message || 'Failed to remove avatar. Please try again.', 'error');
        }
      });
    }
    
    // Centralized settings tab visibility logic - hides ALL tabs first, then shows only authorized ones
    function applySettingsTabVisibility() {
      // First hide ALL settings tabs and their content sections
      const allTabs = ['project-types', 'requestees', 'document-types', 'requirements', 'document-due-schedules', 'user-management'];
      for (const tabId of allTabs) {
        const tabBtn = document.getElementById(`tab-${tabId}`);
        const contentSection = document.getElementById(`content-${tabId}`);
        if (tabBtn) tabBtn.classList.add('hidden');
        if (contentSection) contentSection.classList.add('hidden');
      }
      
      // Now show only authorized tabs
      if (hasPrivilege('manage_project_types')) {
        document.getElementById('tab-project-types')?.classList.remove('hidden');
        document.getElementById('content-project-types')?.classList.remove('hidden');
      }
      if (hasPrivilege('manage_requestees')) {
        document.getElementById('tab-requestees')?.classList.remove('hidden');
        document.getElementById('content-requestees')?.classList.remove('hidden');
      }
      if (hasPrivilege('manage_document_types')) {
        document.getElementById('tab-document-types')?.classList.remove('hidden');
        document.getElementById('content-document-types')?.classList.remove('hidden');
      }
      if (hasPrivilege('manage_requirements')) {
        document.getElementById('tab-requirements')?.classList.remove('hidden');
        document.getElementById('content-requirements')?.classList.remove('hidden');
      }
      if (hasPrivilege('manage_due_schedules')) {
        document.getElementById('tab-document-due-schedules')?.classList.remove('hidden');
        document.getElementById('content-document-due-schedules')?.classList.remove('hidden');
      }
      // User Management requires the manage_users privilege.
      if (hasPrivilege('manage_users')) {
        document.getElementById('tab-user-management')?.classList.remove('hidden');
        document.getElementById('content-user-management')?.classList.remove('hidden');
      }
      
      // Appearance tab is always visible to authenticated users
      document.getElementById('tab-appearance')?.classList.remove('hidden');
      document.getElementById('content-appearance')?.classList.remove('hidden');
    }
    
    function updateSettingsTabVisibility() {
      // Tab visibility mapping
      const tabPrivileges = {
        'project-types': 'manage_project_types',
        'requestees': 'manage_requestees',
        'document-types': 'manage_document_types',
        'requirements': 'manage_requirements',
        'document-due-schedules': 'manage_due_schedules',
        'user-management': 'manage_users'
      };
      
      for (const [tabId, privilege] of Object.entries(tabPrivileges)) {
        const tabBtn = document.getElementById(`tab-${tabId}`);
        if (!tabBtn) continue;
        
        let shouldShow = false;
        if (privilege) {
          shouldShow = hasPrivilege(privilege);
        }
        
        tabBtn.classList.toggle('hidden', !shouldShow);
      }
    }
    
    function getFirstAvailableSettingsTab() {
      const tabs = ['project-types', 'requestees', 'document-types', 'requirements', 'document-due-schedules', 'user-management'];
      for (const tab of tabs) {
        const tabBtn = document.getElementById(`tab-${tab}`);
        if (tabBtn && !tabBtn.classList.contains('hidden')) {
          return tab;
        }
      }
      return null;
    }
