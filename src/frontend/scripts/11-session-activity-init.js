    async function showRequiredPasswordChange() {
      document.querySelector('.password-change-required-notice')?.classList.remove('hidden');
      updateRoleUi();
      await showSettings(false, { section: 'change-password' });
      history.replaceState(buildAppHistoryState('settings', { section: 'change-password' }), '', location.href);
      toast('Change your temporary password to continue using ABEARC.', 'warning');
    }

    async function restoreSession() {
      // Setup system theme listener for dynamic updates
      setupSystemThemeListener();
      
      if (!authToken) {
        const cachedUser = localStorage.getItem('abedCurrentUser');
        if (cachedUser) {
          try { currentUser = JSON.parse(cachedUser); } catch (e) {}
        }
        updateRoleUi();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
        return;
      }
      const restoreAuthToken = authToken;
      let me;
      try {
        me = await fetchJson(`${API}/auth/me`);
      } catch (e) {
        if (authToken !== restoreAuthToken) return;
        clearAuthState();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
        return;
      }
      if (authToken !== restoreAuthToken) return;

      currentUser = me.user;
      // Ensure currentUser has token property for API calls
      if (!currentUser.token) currentUser.token = authToken;
      // Load privileges from response
      if (me.user.privileges) {
        currentUserPrivileges = me.user.privileges;
      }
      localStorage.setItem('abedCurrentUser', JSON.stringify(currentUser));
      
      // Apply user's theme preference from server
      if (currentUser.theme_preference) {
        applyTheme(currentUser.theme_preference);
      }
      
      updateRoleUi();
      if (Number(currentUser.must_change_password) === 1) {
        await showRequiredPasswordChange();
        return;
      }
      await loadReloadRequirementsOverrideSetting();
      try {
        await loadDash({ silent: true, preservePage: true });
        await loadNotifications();
        startNotificationStream();
        startLiveRefresh();
        startSessionActivityTracking();
        const state = getRestoreAppState();
        if (state?.view === 'dashboard' && state.dashboardState) applyDashboardState(state.dashboardState);
        if (state?.view) syncSidebarActiveForView(state.view, state.view === 'settings' ? { section: state.settingsState?.section || state.settingsSection } : {});
        if (state && state.view && state.view !== 'login') await restoreAppHistoryState(state);
        else if (isSystemUser()) {
          await showSettings(false, { section: getFirstAvailableSettingsSection() });
          history.replaceState(buildAppHistoryState('settings', { section: activeSettingsSection }), '', location.href);
        } else {
          showDashboard(false);
          history.replaceState(buildAppHistoryState('dashboard'), '', location.href);
        }
      } catch (e) {
        console.error('Session view restore failed:', e);
        if (isSystemUser()) {
          await showSettings(false, { section: getFirstAvailableSettingsSection() });
          history.replaceState(buildAppHistoryState('settings', { section: activeSettingsSection }), '', location.href);
        } else {
          showDashboard(false);
          history.replaceState(buildAppHistoryState('dashboard'), '', location.href);
        }
      }
    }

    function restoreRequirementsConfigState(state = {}) {
      const typeEl = document.getElementById('reqType');
      const reqEl = document.getElementById('reqReq');
      const stageEl = document.getElementById('reqStageSelect');
      suppressRequirementsSelectionChange = true;
      if (typeEl && state.projectTypeId) typeEl.value = String(state.projectTypeId);
      if (reqEl && state.requesteeId) reqEl.value = String(state.requesteeId);
      if (stageEl && state.stage) stageEl.value = state.stage;
      suppressRequirementsSelectionChange = false;
      if (typeEl && reqEl) {
        requirementsConfigCurrentSelection = getRequirementsConfigSelection();
        updateReqSetName();
        loadConfig({ silentMissingSelection: true });
      }
    }

    // Call applySettingsTabVisibility after auth restore to ensure proper tab visibility
    async function restoreAuth() {
      setupSystemThemeListener();
      
      if (!authToken) {
        const cachedUser = localStorage.getItem('abedCurrentUser');
        if (cachedUser) {
          try { currentUser = JSON.parse(cachedUser); } catch (e) {}
        }
        updateRoleUi();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
        return;
      }
      const restoreAuthToken = authToken;
      try {
        const me = await fetchJson(`${API}/auth/me`);
        if (authToken !== restoreAuthToken) return;
        currentUser = me.user;
        // Ensure currentUser has token property for API calls
        if (!currentUser.token) currentUser.token = authToken;
        // Load privileges from response
        if (me.user.privileges) {
          currentUserPrivileges = me.user.privileges;
        }
        localStorage.setItem('abedCurrentUser', JSON.stringify(currentUser));
        
        // Apply user's theme preference from server
        if (currentUser.theme_preference) {
          applyTheme(currentUser.theme_preference);
        }
        
        updateRoleUi();
        if (Number(currentUser.must_change_password) === 1) {
          await showRequiredPasswordChange();
          return;
        }
        await loadNotifications();
        startNotificationStream();
        startLiveRefresh();
        startSessionActivityTracking();
        const state = (history.state?.abed && history.state.view !== 'login') ? history.state : readAppStateFromSession();
        if (state && state.view && state.view !== 'login') await restoreAppHistoryState(state);
        else {
          showDashboard(false);
          history.replaceState(buildAppHistoryState('dashboard'), '', location.href);
        }
      } catch (e) {
        if (authToken !== restoreAuthToken) return;
        clearAuthState();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
      }
    }

    // Logout confirmation functions
    window.openLogoutConfirmModal = function() {
        document.getElementById('logoutConfirmModal').classList.remove('hidden');
    };
    
    window.closeLogoutConfirmModal = function() {
        document.getElementById('logoutConfirmModal').classList.add('hidden');
        clearOverlayHistoryMarker('logoutConfirmModal');
    };
    
    window.confirmLogout = async function() {
        if (!(await confirmLeaveRequirementsConfig())) return;
        closeLogoutConfirmModal();
        try {
            if (authToken) await fetchJson(`${API}/auth/logout`, { method: 'POST' });
        } catch (e) {}
        clearAuthState();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
        document.getElementById('loginForm').reset();
        toast('Logged out');
    };

    // Session expired modal functions
    window.openSessionExpiredModal = function() {
        document.getElementById('sessionExpiredModal').classList.remove('hidden');
    };

    function dismissSessionExpiredModal() {
        document.getElementById('sessionExpiredModal').classList.add('hidden');
        clearOverlayHistoryMarker('sessionExpiredModal');
    }
    
    window.closeSessionExpiredModal = function() {
        dismissSessionExpiredModal();
        clearAuthState();
        showAuthView(false);
        history.replaceState(buildAppHistoryState('login'), '', location.href);
        document.getElementById('loginForm').reset();
    };

    async function logout() {
      if (!(await confirmLeaveRequirementsConfig())) return;
      openLogoutConfirmModal();
    }

    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Signing in...';
      try {
        dismissSessionExpiredModal();
        clearAuthState();
        const payload = {
          username: document.getElementById('loginUsername').value.trim(),
          password: document.getElementById('loginPassword').value
        };
        const result = await fetchJson(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!result?.token || !result?.user) throw new Error('Login failed. Please try again.');
        dismissSessionExpiredModal();
        authToken = result.token;
        currentUser = { ...result.user, token: result.user.token || result.token };
        const loggedInUser = currentUser;
        const loggedInToken = authToken;
        // Load privileges from response
        currentUserPrivileges = loggedInUser.privileges || {};
        applyDefaultCalendarFiltersForCurrentUser({ force: true });
        localStorage.setItem('abedAuthToken', authToken);
        localStorage.setItem('abedCurrentUser', JSON.stringify(currentUser));
        startSessionActivityTracking();
        
        // Apply user's theme preference from server
        if (currentUser.theme_preference) {
          applyTheme(currentUser.theme_preference);
        }
        
        updateRoleUi();
        if (Number(currentUser.must_change_password) === 1) {
          await showRequiredPasswordChange();
          return;
        }
        await loadNotifications();
        // A 401 from any initialization request may have invalidated this
        // login. Do not continue or resurrect credentials after that happens.
        if (authToken !== loggedInToken || !currentUser) return;
        startNotificationStream();
        startLiveRefresh();
        toast(`Logged in as ${loggedInUser.role || 'user'}`);
        showDashboard(false);
        history.replaceState(buildAppHistoryState('dashboard'), '', location.href);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Login';
      }
    };

    // Activity Logs Functions
    let activityLogsCurrentPage = 1;
    const ACTIVITY_LOGS_PAGE_SIZE = 50;
    let loadedRequirementsForPrint = null;
    let loadedRequirementSetForDueSchedules = null;
    let currentDueScheduleDocTypeIds = [];

    function getActivityFilters() {
      return {
        startDate: document.getElementById('activityStartDate').value,
        endDate: document.getElementById('activityEndDate').value,
        username: document.getElementById('activityUsername').value.trim(),
        action: document.getElementById('activityAction').value.trim(),
        project: document.getElementById('activityProject').value.trim(),
        docType: document.getElementById('activityDocType').value.trim()
      };
    }

    async function loadActivityLogs(page = 1) {
      if (!hasPrivilege('view_activity_logs')) {
        document.getElementById('activityLogsTableBody').innerHTML = 
          '<tr><td colspan="8" class="px-4 py-8 text-center text-red-600">Access denied. View Activity Logs privilege required.</td></tr>';
        return;
      }

      const filters = getActivityFilters();
      const loading = document.getElementById('activityLogsLoading');
      const tbody = document.getElementById('activityLogsTableBody');
      
      loading.classList.remove('hidden');
      tbody.innerHTML = '';

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: ACTIVITY_LOGS_PAGE_SIZE.toString(),
          ...filters
        });

        const response = await fetch(`${API}/activity-logs?${params}`, {
          headers: currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : (authToken ? { Authorization: `Bearer ${authToken}` } : {})
        });
        
        // Debug logging
        console.log('Activity Logs Response Status:', response.status);
        const responseText = await response.text();
        console.log('Response:', responseText);
        
        if (!response.ok) throw new Error('Failed to load activity logs');
        
        const result = JSON.parse(responseText);
        activityLogsCurrentPage = page;

        if (result.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No activity logs found.</td></tr>';
        } else {
          // Action badge colors mapping
          const actionColors = {
            'LOGIN': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
            'LOGOUT': 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
            'UPLOAD': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
            'DELETE': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
            'UPDATE': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
            'CREATE': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
            'PASSWORD_CHANGE': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
            'LOGIN_FAILED': 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300'
          };
          
          tbody.innerHTML = result.logs.map(log => {
            const badgeClass = actionColors[log.action] || 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300';
            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${log.id}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${fmtDateTime(log.created_at)}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                <div>${esc(log.username || 'System')}</div>
                ${log.user_role ? `<div class="text-[10px] uppercase tracking-wide ${log.user_role === 'system' ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-gray-400'}">${esc(roleDisplayLabel(log.user_role))}</div>` : ''}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="px-2 py-1 ${badgeClass} rounded text-xs font-medium">${esc(log.action)}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${esc(log.project_name || '-')}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${esc(log.document_type || '-')}</td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${esc(log.details)}">${esc(log.details || '-')}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${log.ip_address || '-'}</td>
            </tr>
          `}).join('');
        }

        // Update pagination
        const totalPages = result.totalPages || 1;
        const showFrom = result.total > 0 ? (page - 1) * ACTIVITY_LOGS_PAGE_SIZE + 1 : 0;
        const showTo = Math.min(page * ACTIVITY_LOGS_PAGE_SIZE, result.total);

        document.getElementById('activityLogsShowFrom').textContent = showFrom;
        document.getElementById('activityLogsShowTo').textContent = showTo;
        document.getElementById('activityLogsTotal').textContent = result.total;
        document.getElementById('activityCurrentPage').textContent = page;
        document.getElementById('activityTotalPages').textContent = totalPages;

        document.getElementById('activityPrevBtn').disabled = page <= 1;
        document.getElementById('activityNextBtn').disabled = page >= totalPages;

      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-red-600">Error: ${esc(err.message)}</td></tr>`;
        toast(err.message, 'error');
      } finally {
        loading.classList.add('hidden');
      }
    }

    function changeActivityPage(delta) {
      const newPage = activityLogsCurrentPage + delta;
      if (newPage >= 1) {
        loadActivityLogs(newPage);
      }
    }

    function clearActivityFilters() {
      document.getElementById('activityStartDate').value = '';
      document.getElementById('activityEndDate').value = '';
      document.getElementById('activityUsername').value = '';
      document.getElementById('activityAction').value = '';
      document.getElementById('activityProject').value = '';
      document.getElementById('activityDocType').value = '';
      activityLogsCurrentPage = 1;
      loadActivityLogs(1);
    }
    
    // Quick date filter presets for Activity Logs
    function setActivityDatePreset(preset) {
      const toDateInputValue = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const now = new Date();
      let startDate, endDate;
      
      switch(preset) {
        case 'today':
          startDate = endDate = toDateInputValue(now);
          break;
        case 'last7days':
          endDate = toDateInputValue(now);
          startDate = toDateInputValue(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
          break;
        case 'last30days':
          endDate = toDateInputValue(now);
          startDate = toDateInputValue(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
          break;
      }
      
      document.getElementById('activityStartDate').value = startDate;
      document.getElementById('activityEndDate').value = endDate;
      loadActivityLogs(1);
    }
    
    // Filter for failed logins only
    function filterFailedLogins() {
      document.getElementById('activityAction').value = 'LOGIN_FAILED';
      loadActivityLogs(1);
    }

    async function exportActivityLogs(format) {
      const filters = getActivityFilters();
      const params = new URLSearchParams(filters);
      const url = `${API}/activity-logs/export/${format}?${params}`;
      
      try {
        const filenameMap = { csv: 'csv', excel: 'xls', pdf: 'pdf' };
        const fallbackFilename = `activity_logs_${new Date().toISOString().split('T')[0]}.${filenameMap[format] || format}`;
        const result = await downloadsFormsDownloadRequest(url, fallbackFilename, {
          title: 'Exporting activity logs',
          initialStatus: 'Preparing activity log export...',
          progressStatus: 'Downloading export...',
          finishingStatus: 'Export complete. Saving file...',
          returnMeta: true
        });
        downloadBlob(result.blob, result.filename || fallbackFilename);
        toast(`Exporting activity logs as ${format.toUpperCase()}...`);
      } catch (error) {
        console.error('Export error:', error);
        toast(`Export failed: ${error.message}`);
      }
    }

    async function getPrintableProjectData() {
      if (!currentProjId) throw new Error('No project selected');
      return fetchJson(`${API}/projects/${currentProjId}/print-data`);
    }

    function openPrintableWindow(title, bodyHtml) {
      printPreviewReturnState = {
        state: buildAppHistoryState(appCurrentView || 'dashboard'),
        scroll: getCurrentScrollState()
      };
      printViewOpen = true;
      document.getElementById('printPreviewTitle').textContent = title || 'Print Preview';
      document.getElementById('printPreviewContent').innerHTML = bodyHtml;
      document.getElementById('printPreviewOverlay').classList.remove('hidden');
      saveAppStateToSession(printPreviewReturnState.state);
      setTimeout(() => document.getElementById('printPreviewOverlay')?.scrollTo(0, 0), 0);
    }

    window.closePrintPreview = function() {
      document.getElementById('printPreviewOverlay')?.classList.add('hidden');
      document.getElementById('printPreviewContent').innerHTML = '';
      printViewOpen = false;
      clearOverlayHistoryMarker('printPreviewOverlay');
      if (printPreviewReturnState?.state) {
        history.replaceState(printPreviewReturnState.state, '', location.href);
        setTimeout(() => window.scrollTo(printPreviewReturnState.scroll?.x || 0, printPreviewReturnState.scroll?.y || 0), 50);
      }
      printPreviewReturnState = null;
    };

    window.addEventListener('afterprint', () => {
      printViewOpen = false;
    });

    async function printProjectSummary() {
      if (!requirePrivilege('print_project_summary')) return;
      try {
        const data = await getPrintableProjectData();
        const p = data.project, docs = data.documents || [], dispositionHistory = data.disposition_history || [];
        const dispositionRequests = data.disposition_requests || [];
        const closureRequests = data.closure_requests || [];
        const closureAttachments = data.closure_attachments || [];
        const latestApprovedDisposition = dispositionRequests.find(r => r.status === 'approved') || null;
        const latestApprovedClosure = closureRequests.find(r => r.status === 'approved') || null;
        const latestOutcomeRequest = latestApprovedDisposition || latestApprovedClosure;
        const currentDocs = docs.filter(d => d.stage === p.stage);
        const countableDocs = docs.filter(isCountableRequirement);
        const currentCountableDocs = currentDocs.filter(isCountableRequirement);
        const checked = countableDocs.filter(d => d.status === 'Checked').length;
        const uploaded = countableDocs.filter(d => d.file_path).length;
        const tableRows = docs.map(d => `<tr><td>${esc(d.stage)}</td><td>${esc(d.document_type_name)}</td><td>${esc(d.requirement_state || 'Required')}</td><td>${esc(ownerDisplayName(d))}</td><td>${esc(d.status || '-')}</td><td>${fmtDateTime(d.upload_date)}</td><td>${fmtDateTime(d.checked_at)}</td><td>${d.due_date ? fmtDueDate(d.due_date) : '-'}</td><td>${esc(d.file_name || '-')}</td></tr>`).join('');
        const historyRows = dispositionHistory.map(h => {
          const action = h.new_outcome === 'Active' ? 'Reopened' : 'Disposition';
          return `<tr><td>${fmtDateTime(h.changed_at)}</td><td>${esc(action)}</td><td>${esc(h.changed_by_username || '-')}</td><td>${esc(h.previous_outcome || '-')}</td><td>${esc(h.new_outcome || '-')}</td><td>${esc(h.reason || '-')}</td><td>${esc(h.remarks || '-')}</td><td>${esc(h.attachment_file_name || 'Available in project details')}</td></tr>`;
        }).join('');
        const reopenedRows = dispositionHistory.filter(h => h.new_outcome === 'Active').map(h => `<tr><td>${fmtDateTime(h.changed_at)}</td><td>${esc(h.changed_by_username || '-')}</td><td>${esc(h.remarks || '-')}</td></tr>`).join('');
        const attachmentRows = closureAttachments.map(a => `<tr><td>${esc(a.source_type || '-')}</td><td>${esc(a.attachment_file_name || '-')}</td><td>${esc(a.requested_by_username || '-')}</td><td>${fmtDateTime(a.created_at)}</td><td>Available in project details</td></tr>`).join('');
        openPrintableWindow('Project Summary', `<h1>ABEARC Projects &amp; Services Monitoring Information System - Project Summary</h1><div class="grid box"><div><b>Project name:</b> ${esc(p.name)}</div><div><b>Project type:</b> ${esc(p.type_name || '-')}</div><div><b>Requester:</b> ${esc(p.requester || '-')}</div><div><b>Requestee:</b> ${esc(p.requestee_name || '-')}</div><div><b>Barangay:</b> ${esc(p.barangay || '-')}</div><div><b>District:</b> ${esc(p.district || '-')}</div><div><b>Current stage:</b> ${esc(p.stage)}</div><div><b>Latest project outcome:</b> ${esc(projectOutcome(p))}</div><div><b>Closure/disposition reason:</b> ${esc(p.closure_reason || '-')}</div><div><b>Marked/requested by:</b> ${esc(latestOutcomeRequest?.requested_by_username || p.closed_by_username || '-')}</div><div><b>Confirmed/approved by:</b> ${esc(latestOutcomeRequest?.reviewed_by_username || p.closed_by_username || '-')}</div><div><b>Outcome date:</b> ${fmtDateTime(p.closed_at || latestOutcomeRequest?.reviewed_at || latestOutcomeRequest?.requested_at)}</div><div><b>Overall status:</b> ${esc(p.status || '-')}</div><div><b>Assigned owner:</b> ${esc(p.assigned_username || 'Unassigned')}</div><div><b>Date created:</b> ${fmtDateTime(p.created_at)}</div><div><b>Last activity:</b> ${fmtDateTime(p.last_activity_at)}</div><div><b>Printed by:</b> ${esc(data.printed_by)}</div><div><b>Print date:</b> ${fmtDateTime(data.print_date)}</div></div><div class="box"><b>Proposal remarks:</b> ${esc(p.proposal_remarks || '-')}<br><b>Implementation remarks:</b> ${esc(p.implementation_remarks || '-')}<br><b>Monitoring remarks:</b> ${esc(p.monitoring_remarks || '-')}<br><b>Completion remarks:</b> ${esc(p.completion_remarks || p.remarks || '-')}<br><b>Closure/disposition remarks:</b> ${esc(p.closure_remarks || '-')}</div><div class="box"><b>Current stage document progress:</b> ${currentCountableDocs.filter(d=>d.status==='Checked').length}/${currentCountableDocs.length} checked<br><b>Overall document summary:</b> ${uploaded}/${countableDocs.length} uploaded, ${checked}/${countableDocs.length} checked</div>${historyRows ? `<h2>Disposition and Reopen History</h2><table><thead><tr><th>Date</th><th>Action</th><th>By</th><th>Previous outcome</th><th>New outcome</th><th>Reason</th><th>Remarks</th><th>Attachment</th></tr></thead><tbody>${historyRows}</tbody></table>` : ''}${reopenedRows ? `<h2>Reopened Entries</h2><table><thead><tr><th>Reopened date</th><th>Reopened by</th><th>Reopened remarks</th></tr></thead><tbody>${reopenedRows}</tbody></table>` : ''}${attachmentRows ? `<h2>Supporting Attachments</h2><table><thead><tr><th>Source</th><th>File name</th><th>Uploaded/requested by</th><th>Date</th><th>Access note</th></tr></thead><tbody>${attachmentRows}</tbody></table>` : ''}<h2>Documents</h2><table><thead><tr><th>Stage</th><th>Requirement</th><th>State</th><th>Assigned user</th><th>Status</th><th>Upload date</th><th>Checked date</th><th>Due date</th><th>File name</th></tr></thead><tbody>${tableRows}</tbody></table>`);
      } catch(e) { toast(e.message, 'error'); }
    }

    async function printRequirementsChecklist() {
      if (!requirePrivilege('print_requirements_checklist')) return;
      try {
        const data = await getPrintableProjectData();
        const p = data.project;
        const docs = (data.documents || []).filter(d => d.stage === activeDetailStage);
        const rows = docs.map((d,i) => `<tr><td>${i+1}</td><td>${esc(d.document_type_name)}</td><td></td></tr>`).join('');
        openPrintableWindow('Requirements Checklist', `<h1>Document Requirements</h1><div class="grid box"><div><b>Project name:</b> ${esc(p.name)}</div><div><b>Project type:</b> ${esc(p.type_name || '-')}</div><div><b>Requestee:</b> ${esc(p.requestee_name || '-')}</div><div><b>Stage:</b> ${esc(activeDetailStage)}</div><div><b>Barangay:</b> ${esc(p.barangay || '-')}</div><div><b>District:</b> ${esc(p.district || '-')}</div><div><b>Printed by:</b> ${esc(data.printed_by)}</div><div><b>Print date:</b> ${fmtDateTime(data.print_date)}</div></div><table><thead><tr><th>No.</th><th>Requirement/document name</th><th>Remarks/check box</th></tr></thead><tbody>${rows}</tbody></table>`);
      } catch(e) { toast(e.message, 'error'); }
    }

    async function runDocumentSearch(debounced) {
      if (!hasPrivilege('search_uploaded_documents')) return;
      clearTimeout(documentSearchTimer);
      if (debounced) return documentSearchTimer = setTimeout(() => runDocumentSearch(false), 450);
      const q = document.getElementById('projectDocumentSearchInput')?.value.trim();
      const target = document.getElementById('projectDocumentSearchResults');
      if (!target || !q || q.length < 2) { if (target) target.innerHTML = ''; return; }
      try {
        const results = await fetchJson(`${API}/document-search?q=${encodeURIComponent(q)}`);
        const filtered = currentProjId ? results.filter(r => Number(r.project_id) === Number(currentProjId)) : results;
        target.innerHTML = filtered.map(r => `<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"><div class="font-bold">${esc(r.project_name)} - ${esc(r.document_type_name || '-')}</div><div class="text-xs text-gray-500">${esc(r.stage)} - ${esc(r.file_name || '-')} - Uploaded ${fmtDateTime(r.upload_date)}</div><div class="mt-1">${esc(r.index_status === 'indexed' ? r.snippet : (r.error_message || 'Text content not available for this file'))}</div><div class="mt-2 flex gap-2"><button onclick="goToTarget({ project_id: ${Number(r.project_id)}, document_id: ${Number(r.document_id)}, stage: '${esc(r.stage || 'Proposal')}', target_type: 'document', target_kind: 'document' })" class="px-3 py-1 bg-indigo-600 text-white rounded">Open project</button><button data-doc-id="${Number(r.document_id)}" data-file-name="${esc(r.file_name || '')}" onclick="openFileViewer(this.dataset.docId, this.dataset.fileName)" class="px-3 py-1 border rounded">Open file</button></div></div>`).join('') || '<div class="text-sm text-gray-500">No matching documents found.</div>';
      } catch(e) { target.innerHTML = `<div class="text-red-600 text-sm">${esc(e.message)}</div>`; }
    }

    // Export project documents as PDF
    window.exportProjectPDF = async function() {
      if (!currentProjId) {
        toast('No project selected', 'error');
        return;
      }
      
      const btn = document.getElementById('exportPdfBtn');
      const originalContent = btn.innerHTML;
      
      try {
        // Disable button and show loading state
        btn.disabled = true;
        btn.innerHTML = '<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...';
        
        const url = `${API}/projects/${currentProjId}/export-pdf`;
        
        const result = await downloadsFormsDownloadRequest(url, `project_export_${new Date().toISOString().split('T')[0]}.pdf`, {
          title: 'Exporting project PDF',
          initialStatus: 'Preparing project PDF...',
          progressStatus: 'Downloading PDF...',
          finishingStatus: 'PDF complete. Saving file...',
          returnMeta: true
        });
        downloadBlob(result.blob, result.filename || `project_export_${new Date().toISOString().split('T')[0]}.pdf`);
        
        toast('PDF exported successfully!');
      } catch (error) {
        console.error('Export Project Documents error:', error);
        toast(`Export failed: ${error.message}`, 'error');
      } finally {
        // Restore button
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
    };

    // Toggle password visibility
    window.togglePasswordVisibility = function(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.591a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
      }
    };
    
    // Password strength validation
    window.validatePasswordStrength = function() {
      const pwd = document.getElementById('newPassword').value;
      const bars = [
        document.getElementById('strengthBar1'),
        document.getElementById('strengthBar2'),
        document.getElementById('strengthBar3'),
        document.getElementById('strengthBar4')
      ];
      const textEl = document.getElementById('strengthText');
      
      let strength = 0;
      if (pwd.length >= 8) strength++;
      if (pwd.length >= 12) strength++;
      if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength++;
      if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) strength++;
      
      const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
      const labels = ['Very Weak', 'Weak', 'Medium', 'Strong'];
      
      bars.forEach((bar, i) => {
        if (i < strength) {
          bar.className = `h-1 flex-1 rounded-full ${colors[Math.min(strength - 1, 3)]}`;
        } else {
          bar.className = 'h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-600';
        }
      });
      
      if (pwd.length === 0) {
        textEl.textContent = 'Password strength: Not entered';
      } else {
        textEl.textContent = `Password strength: ${labels[strength - 1] || 'Very Weak'}`;
      }
    };
    
    // Password match validation
    window.validatePasswordMatch = function() {
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const msgEl = document.getElementById('passwordMatchMsg');
      
      if (confirmPassword.length === 0) {
        msgEl.classList.add('hidden');
        return;
      }
      
      msgEl.classList.remove('hidden');
      if (newPassword === confirmPassword) {
        msgEl.textContent = 'Passwords match';
        msgEl.className = 'mt-1 text-xs text-green-600 dark:text-green-400';
      } else {
        msgEl.textContent = 'Passwords do not match';
        msgEl.className = 'mt-1 text-xs text-red-600 dark:text-red-400';
      }
    };

    // Change password form submission
    document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Client-side validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast('All password fields are required.', 'error');
        return;
      }
      
      if (newPassword.length < 8) {
        toast('New password must be at least 8 characters long.', 'error');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        toast('New password and confirmation do not match.', 'error');
        return;
      }
      
      if (currentPassword === newPassword) {
        toast('New password must be different from current password.', 'error');
        return;
      }
      
      const submitBtn = document.getElementById('changePasswordSubmitBtn');
      const originalBtnContent = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Changing...';
      
      try {
        const response = await fetch(`${API}/user/change-password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser?.token || authToken}`
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword
          })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          toast('Password changed successfully. Please login again with your new password.', 'success');
          this.reset();
          
          // Reset strength bars
          ['strengthBar1', 'strengthBar2', 'strengthBar3', 'strengthBar4'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.className = 'h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-600';
          });
          document.getElementById('strengthText').textContent = 'Password strength: Not entered';
          document.getElementById('passwordMatchMsg').classList.add('hidden');
          
          // Logout after successful password change
          setTimeout(() => {
            clearAuthState();
            showAuthView(false);
            history.replaceState(buildAppHistoryState('login'), '', location.href);
            document.getElementById('loginForm').reset();
          }, 2000);
        } else {
          toast(result.error || 'Failed to change password.', 'error');
        }
      } catch (err) {
        console.error('Change password error:', err);
        toast('An error occurred while changing password.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
      }
    });

    initNavigationHistory();
    initOverlayHistoryObserver();
    restoreSession();
  
