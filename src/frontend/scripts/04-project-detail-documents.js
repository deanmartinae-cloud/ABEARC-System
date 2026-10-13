    
    async function showDetails(pid, stage = 'Proposal', pushHistory = true){
      if (typeof stage === 'boolean') {
        pushHistory = stage;
        stage = activeDetailStage || 'Proposal';
      }
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      // Save current dashboard filter state before navigating to detail view
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
      if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
      
      if (Number(currentProjId) !== Number(pid)) projectDocumentationCounts = {};
      currentProjId=pid;
      activeDetailStage = stage || 'Proposal';
      const p = projCache.find(x => x.id == pid);
      if(!p) {
        toast('This project is no longer available.', 'error');
        suppressNextDetailStageLoad = false;
        suppressNextOpenDetailRefresh = false;
        return await showDashboard(false);
      }

      navigateTo('projectDetail', { projectId: pid, stage: activeDetailStage }, pushHistory);

      renderProjectDetailHeader(p);
      if (!suppressNextDetailStageLoad) {
        switchDetailStage(activeDetailStage);
      }
      suppressNextDetailStageLoad = false;
      if (!suppressNextOpenDetailRefresh) {
        setTimeout(() => queueSmartRefresh('open-detail'), 0);
      }
      suppressNextOpenDetailRefresh = false;
    }

    function renderProjectDetailHeader(p) {
      if (!p) return;
      const title = p.name || '';
      document.getElementById('detailTitle').textContent = title;
      document.getElementById('detailTitle').title = title;

      document.getElementById('detailRequester').textContent = p.requester || '-';
      document.getElementById('detailMeta').innerHTML = `${p.type_name || 'Unknown'} - ${p.requestee_name || 'Unknown'}`;
      
      document.getElementById('detailLocation').textContent = formatProjectLocation(p);
      
      const detailProgress = document.getElementById('detailProgress');
      detailProgress.className = `inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-black ${getStageTheme(p.stage).text}`;
      if (p.stage === 'Completed') {
          detailProgress.innerHTML = `<span class="${getStageTheme('Completed').text} font-semibold">Stage: Completed</span>`;
      } else {
          detailProgress.textContent = `Stage: ${p.stage} | ${p.progress}% Complete`;
      }
      
      const detailDateFields = `
        <div><span class="font-bold">Created:</span> ${fmtDateTime(p.created_at)}</div>
        <div><span class="font-bold">Last Activity:</span> ${fmtDateTime(p.last_activity_at)}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1"><span class="font-bold">Outcome:</span> ${projectOutcomeBadge(p)}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1"><span class="font-bold">Assigned to:</span> ${projectAssignmentSelect(p)}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1"><span class="font-bold">Project due:</span> ${isInactiveProject(p) ? '<span class="text-gray-500 dark:text-gray-400 font-semibold">Inactive project</span>' : projectDueDateControl(p, { id: 'projectDueDateTarget' })}</div>`;
      const detailPrintButtonClass = 'w-full justify-center px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center font-bold shadow-sm';
      document.getElementById('detailDates').innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="min-w-0 flex-1 space-y-1">${detailDateFields}</div>
          <div class="w-full sm:w-40 shrink-0 grid grid-cols-1 gap-2 sm:-mt-1">
            <button onclick="printProjectSummary()" class="${detailPrintButtonClass}">Print Summary</button>
            <button onclick="printRequirementsChecklist()" class="${detailPrintButtonClass}">Print Checklist</button>
            <button id="viewDocumentationBtn" type="button" onclick="openProjectDocumentationViewer()" disabled class="hidden">
              <span id="viewDocumentationBtnLabel">View Documentation (0)</span>
            </button>
          </div>
        </div>`;
      updateProjectDocumentationButtons();
      
      // Display remarks box with stage and completion remarks
      const detailRemarksContainer = document.getElementById('detailRemarksContainer');
      let remarksHtml = '';
      const completionRemarks = p.completion_remarks || p.remarks;
      
      if (p.proposal_remarks) {
        remarksHtml += `<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-2"><p class="text-sm text-blue-800 dark:text-blue-200"><strong>Proposal Remarks:</strong> ${escapeHtml(p.proposal_remarks)}</p></div>`;
      }
      if (p.implementation_remarks) {
        remarksHtml += `<div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mb-2"><p class="text-sm text-purple-800 dark:text-purple-200"><strong>Implementation Remarks:</strong> ${escapeHtml(p.implementation_remarks)}</p></div>`;
      }
      if (p.monitoring_remarks) {
        remarksHtml += `<div class="p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg mb-2"><p class="text-sm text-cyan-800 dark:text-cyan-200"><strong>Monitoring Remarks:</strong> ${escapeHtml(p.monitoring_remarks)}</p></div>`;
      }
      if (p.stage === 'Completed' && completionRemarks) {
        remarksHtml += `<div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"><p class="text-sm text-green-800 dark:text-green-200"><strong>Completion Remarks:</strong> ${escapeHtml(completionRemarks)}</p></div>`;
      }
      if (isInactiveProject(p)) {
        remarksHtml = `<div class="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-2 text-sm text-amber-900 dark:text-amber-100"><div class="font-black">This project is marked as ${esc(projectOutcome(p))}.</div><div class="mt-1">Pending document requirements are no longer counted as active workload. Uploaded documents remain preserved for audit and reference.</div></div>` + remarksHtml;
      }
      if (projectOutcome(p) !== 'Active') {
        remarksHtml += `<div class="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg mt-2 text-sm"><div class="font-black text-gray-900 dark:text-gray-100">Project Outcome: ${esc(projectOutcome(p))}</div><div class="mt-1 text-gray-700 dark:text-gray-300"><strong>Reason:</strong> ${esc(p.closure_reason || '-')}</div><div class="text-gray-700 dark:text-gray-300"><strong>Remarks:</strong> ${esc(p.closure_remarks || p.completion_remarks || p.remarks || '-')}</div><div class="text-gray-700 dark:text-gray-300"><strong>Marked by:</strong> ${esc(p.closed_by_username || p.transitioned_by_username || '-')}</div><div class="text-gray-700 dark:text-gray-300"><strong>Date:</strong> ${fmtDateTime(p.closed_at || p.transitioned_at || p.updated_at)}</div></div>`;
      }
      
      if (remarksHtml) {
        document.getElementById('detailRemarksContent').innerHTML = remarksHtml;
        detailRemarksContainer.classList.remove('hidden');
      } else {
        detailRemarksContainer.classList.add('hidden');
        document.getElementById('detailRemarksContent').innerHTML = '';
      }
      const transitionInfo = p.transitioned_at ? `<div class="p-3 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-lg mb-2"><p class="text-sm text-cyan-800 dark:text-cyan-200"><strong>Latest Transition:</strong> ${escapeHtml(p.source_stage || '-')} to ${escapeHtml(p.target_stage || '-')} by ${escapeHtml(p.transitioned_by_username || '-')} on ${fmtDateTime(p.transitioned_at)}</p>${p.transition_remarks ? `<p class="text-xs text-cyan-700 dark:text-cyan-300 mt-1">${escapeHtml(p.transition_remarks)}</p>` : ''}</div>` : '';
      if (transitionInfo) {
        document.getElementById('detailRemarksContent').innerHTML = transitionInfo + (remarksHtml || '');
        detailRemarksContainer.classList.remove('hidden');
      }
      
      // Show/hide Export Project Documents button based on privilege
      const exportPdfBtn = document.getElementById('exportPdfBtn');
      const canExportProjectPdf = hasPrivilege('export_project_documents');
      if (canExportProjectPdf) {
        exportPdfBtn.classList.remove('hidden');
      } else {
        exportPdfBtn.classList.add('hidden');
      }
      document.getElementById('manageStageEditAccessBtn')?.classList.toggle('hidden', !canManageStageEditAccess());
      renderProjectPendingConfirmations(p.id);
    }

    async function renderProjectPendingConfirmations(projectId) {
      const container = document.getElementById('detailRemarksContainer');
      const content = document.getElementById('detailRemarksContent');
      if (!container || !content || !projectId) return;
      content.querySelector('#projectPendingConfirmations')?.remove();
      content.querySelector('#projectClosureAttachmentsPanel')?.remove();
      try {
        const [pending, attachments] = await Promise.all([
          fetchJson(`${API}/projects/${projectId}/pending-confirmations`, { silentLoading: true }).catch(() => ({})),
          canViewProjectClosureAttachments() ? fetchJson(`${API}/projects/${projectId}/closure-attachments`, { silentLoading: true }).catch(() => []) : Promise.resolve([])
        ]);
        if (Number(currentProjId) !== Number(projectId)) return;
        pendingConfirmationsCache[projectId] = pending || {};
        const banners = [];
        if (pending?.disposition_request) {
          const r = pending.disposition_request;
          banners.push(`<div class="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-900 dark:text-amber-100"><strong>Pending disposition confirmation:</strong> ${esc(r.requested_outcome || '-')} requested by ${esc(r.requested_by_username || '-')} on ${fmtDateTime(r.requested_at)}</div>`);
        }
        if (pending?.closure_request) {
          const r = pending.closure_request;
          banners.push(`<div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm text-indigo-900 dark:text-indigo-100"><strong>Pending close-project confirmation</strong> requested by ${esc(r.requested_by_username || '-')} on ${fmtDateTime(r.requested_at)}</div>`);
        }
        if (banners.length) {
          content.insertAdjacentHTML('afterbegin', `<div id="projectPendingConfirmations" class="space-y-2 mb-2">${banners.join('')}</div>`);
          container.classList.remove('hidden');
        }
        if (Array.isArray(attachments) && attachments.length) {
          const items = attachments.map(a => `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div class="min-w-0">
                <div class="font-bold truncate">${esc(a.attachment_file_name || 'Attachment')}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${esc(a.source_type || 'attachment')} by ${esc(a.requested_by_username || '-')} on ${fmtDateTime(a.created_at)}</div>
              </div>
              <div class="flex gap-2">
                <button onclick="viewProtectedFile('${API}/projects/${projectId}/closure-attachments/${a.attachment_id}/view')" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">View</button>
                <button onclick="downloadProtectedFile('${API}/projects/${projectId}/closure-attachments/${a.attachment_id}/download')" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Download</button>
              </div>
            </div>`).join('');
          content.insertAdjacentHTML('beforeend', `<div id="projectClosureAttachmentsPanel" class="mt-2 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"><div class="font-black text-gray-900 dark:text-gray-100 mb-2">Closure / Disposition Supporting Documents</div><div class="space-y-2">${items}</div></div>`);
          container.classList.remove('hidden');
        }
        renderTransitionButton();
      } catch (e) {
        pendingConfirmationsCache[projectId] = {};
      }
    }
    
    // Open project from calendar popup with optional document highlighting
    window.openProjectFromCalendar = async function(projectId, documentId, stage, targetKind = null) {
      try {
        closeModal('calendarDetailModal');
        const hasDocument = !!documentId;

        return goToTarget({
          project_id: Number(projectId),
          document_id: hasDocument ? Number(documentId) : null,
          stage: stage || 'Proposal',
          target_kind: hasDocument
            ? 'document'
            : targetKind || 'project',
          target_type: hasDocument ? 'document' : targetKind || 'project'
        });
      } catch (e) {
        console.error('Error opening project from calendar:', e);
        toast('Failed to open project', 'error');
        return false;
      }
    };

    function openConfirmModal(message, callback, { title = 'Confirm Action', confirmText = 'Confirm', confirmClass = "px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium" } = {}) {
      document.getElementById('confirmModalTitle').textContent = title;
      document.getElementById('confirmMessage').innerHTML = message;
      confirmCallback = callback;
      confirmPromiseResolver = null;
      document.getElementById('confirmActionBtn').textContent = confirmText;
      document.getElementById('confirmActionBtn').className = confirmClass;
      document.getElementById('confirmModal').classList.remove('hidden');
    }

    function confirmModalChoice(message, { title = 'Confirm Action', confirmText = 'Confirm', confirmClass = "px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium" } = {}) {
      return new Promise(resolve => {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmMessage').innerHTML = message;
        confirmCallback = null;
        confirmPromiseResolver = resolve;
        const actionBtn = document.getElementById('confirmActionBtn');
        actionBtn.textContent = confirmText;
        actionBtn.className = confirmClass;
        actionBtn.onclick = () => {
          const resolver = confirmPromiseResolver;
          confirmPromiseResolver = null;
          closeModal('confirmModal');
          actionBtn.onclick = () => { if(confirmCallback) confirmCallback(); closeConfirmModal(); };
          if (resolver) resolver(true);
        };
        document.getElementById('confirmModal').classList.remove('hidden');
      });
    }

    async function hasConfiguredRequirementsForStage(project, targetStage) {
        if (!project || targetStage !== 'Implementation') return true;
        const params = new URLSearchParams({
            projectTypeId: project.project_type_id,
            requesteeId: project.requestee_id,
            stage: targetStage
        });
        const requirements = await fetchJson(`${API}/settings/requirements?${params.toString()}`, { silentLoading: true });
        return Array.isArray(requirements) && requirements.length > 0;
    }

    async function openStageTransitionModal(targetStage) {
        if (!requirePrivilege('transition_stage')) return;
        const p = projCache.find(x => x.id == currentProjId);
        if(!p) return;
        if (isInactiveProject(p) && currentUser?.role !== 'superadmin') {
            toast(`This project is marked as ${projectOutcome(p)}. Reopen the project before changing stages.`, 'error');
            return;
        }

        if (targetStage === 'Implementation') {
            try {
                toggleLoad(true);
                const hasRequirements = await hasConfiguredRequirementsForStage(p, targetStage);
                toggleLoad(false);
                if (!hasRequirements) {
                    toast(`No requirements configured for ${targetStage} stage.`, 'error');
                    return;
                }
            } catch (e) {
                toggleLoad(false);
                toast(e.message || `Unable to check ${targetStage} requirements.`, 'error');
                return;
            }
        }
        
        const nowLabel = new Date().toLocaleString();
        let msg = `<div class="space-y-1 text-sm"><div><strong>Project:</strong> ${esc(p.name)}</div><div><strong>Current stage:</strong> ${esc(p.stage)}</div><div><strong>${targetStage === 'Completed' ? 'Completed by' : 'Transitioned by'}:</strong> ${esc(currentUser?.username || '-')}</div><div><strong>${targetStage === 'Completed' ? 'Completion date' : 'Transition date'}:</strong> ${esc(nowLabel)}</div><div><strong>${targetStage === 'Completed' ? 'Target status' : 'Target stage'}:</strong> ${esc(targetStage)}</div>`;
        if (targetStage !== 'Completed') {
            msg += `<div class="mt-2 text-amber-700 dark:text-amber-300">Previous stage uploads will no longer be editable after this transition.</div>`;
        } else {
            msg += `<div class="mt-2">Submit this project for closure confirmation. The project will remain in its current stage until approved unless you are a superadmin.</div>`;
        }
        msg += `</div>`;
        
        const currentStageLabel = `${p.stage} Remarks`;
        let textareaHtml = `<div class="mt-3 space-y-3"><label class="block text-sm font-semibold text-gray-700 dark:text-gray-200" for="stageRemarks">${esc(currentStageLabel)}</label><textarea id="stageRemarks" class="w-full border border-gray-300 rounded-lg p-2 text-sm" rows="3" placeholder="Enter ${esc(p.stage.toLowerCase())} remarks..."></textarea>`;
        if (targetStage === 'Completed') {
            textareaHtml += '<label class="block text-sm font-semibold text-gray-700 dark:text-gray-200" for="completionRemarks">Completion Remarks</label><textarea id="completionRemarks" class="w-full border border-gray-300 rounded-lg p-2 text-sm" rows="3" placeholder="Enter completion remarks..."></textarea>';
            textareaHtml += `<div><label class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5" for="closureAttachment">Supporting document/s for closing the project</label>${fileDropZoneHtml({ zoneId: 'closureAttachmentDropZone', inputId: 'closureAttachment', labelId: 'closureAttachmentLabel', title: 'Drag and drop supporting file here, or click to browse', help: 'Optional supporting document.' })}</div>`;
        }
        textareaHtml += '</div>';

        openConfirmModal(msg + textareaHtml, null);
        if (targetStage === 'Completed') {
            setupGenericFileDropZone({ zoneId: 'closureAttachmentDropZone', inputId: 'closureAttachment', labelId: 'closureAttachmentLabel', emptyText: 'Optional supporting document.' });
        }
        
        document.getElementById('confirmActionBtn').onclick = async () => {
            const stageRemarksInput = document.getElementById('stageRemarks');
            const stageRemarks = stageRemarksInput ? stageRemarksInput.value.trim() : '';
            if (!stageRemarks) return toast('Remarks required before leaving this stage.', 'error');
            const completionRemarksInput = document.getElementById('completionRemarks');
            const completionRemarks = completionRemarksInput ? completionRemarksInput.value.trim() : '';
            if (targetStage === 'Completed' && !completionRemarks) return toast('Completion remarks required.', 'error');

            closeModal('confirmModal');
            try {
                if (targetStage === 'Completed') {
                    const form = new FormData();
                    form.append('stage_remarks', stageRemarks);
                    form.append('completion_remarks', completionRemarks);
                    const file = document.getElementById('closureAttachment')?.files?.[0];
                    if (file) form.append('attachment', file);
                    const result = await fetchJson(`${API}/projects/${p.id}/closure-request`, { method: 'POST', body: form });
                    toast(result?.pending_approval ? 'Close request submitted for superadmin confirmation.' : 'Project closed.');
                } else {
                    await fetchJson(`${API}/projects/${p.id}/stage`, { 
                        method: 'PATCH', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({
                            stage: targetStage,
                            stage_remarks: stageRemarks,
                            completion_remarks: completionRemarks
                        }) 
                    });
                    toast(`Moved to ${targetStage}`);
                }
                await refreshAfterMutation({ projectId: p.id, targetStage: targetStage === 'Completed' ? p.stage : targetStage, silent: false });
            } catch(e) { toast(e.message, 'error'); }
            
            document.getElementById('confirmActionBtn').onclick = () => { if(confirmCallback) confirmCallback(); closeConfirmModal(); };
        };
        document.getElementById('confirmActionBtn').textContent = targetStage === 'Completed'
          ? (currentUser?.role === 'superadmin' ? 'Close Project' : 'Submit Close Request')
          : 'Confirm';
        document.getElementById('confirmActionBtn').className = "px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium";
        document.getElementById('confirmModal').classList.remove('hidden');
    }

    function closeConfirmModal() { 
        const resolver = confirmPromiseResolver;
        confirmPromiseResolver = null;
        document.getElementById('confirmModal').classList.add('hidden'); 
        document.getElementById('confirmActionBtn').onclick = () => { if(confirmCallback) confirmCallback(); closeConfirmModal(); };
        confirmCallback = null; 
        clearOverlayHistoryMarker('confirmModal');
        if (resolver) resolver(false);
    }
    document.getElementById('confirmActionBtn').onclick = () => { if(confirmCallback) confirmCallback(); closeConfirmModal(); };

    function handleConfirmModalEnterKey(event) {
      if (event.defaultPrevented) return;
      if (event.key !== 'Enter') return;
      const modal = document.getElementById('confirmModal');
      if (!modal || modal.classList.contains('hidden')) return;
      const active = document.activeElement;
      if (active?.matches?.('input, textarea, select, button, [contenteditable="true"]')) return;
      event.preventDefault();
      document.getElementById('confirmActionBtn')?.click();
    }

    if (!window.confirmModalEnterKeyReady) {
      window.confirmModalEnterKeyReady = true;
      document.addEventListener('keydown', handleConfirmModalEnterKey);
    }

    function canEditDocumentDate(doc) {
      if (!doc?.file_path || !currentUser) return false;
      const project = projCache.find(p => Number(p.id) === Number(doc.project_id || currentProjId));
      const docStage = doc.stage || activeDetailStage;
      const stageEditable = !project || project.stage === docStage || currentUser.role === 'superadmin' || hasTemporaryStageAccess(docStage, 'upload');
      const isUploader = Number(doc.uploader_user_id || 0) === Number(currentUser.id || 0);
      return stageEditable && (isUploader || currentUser.role === 'superadmin');
    }

    function ensureDocumentDateModal() {
      let modal = document.querySelector('[data-document-date-modal="modal"]');
      if (modal) return modal;
      modal = document.createElement('div');
      modal.dataset.documentDateModal = 'modal';
      modal.className = 'fixed inset-0 bg-black/40 hidden z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" data-document-date-modal="panel" onclick="event.stopPropagation()">
          <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start gap-3 bg-gray-50 dark:bg-gray-900">
            <div class="min-w-0"><h3 class="text-lg font-bold text-gray-900 dark:text-white">Document Date</h3><p class="text-sm text-gray-600 dark:text-gray-400 mt-1" data-document-date-modal="name"></p></div>
            <button type="button" data-document-date-modal="close" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none p-1" aria-label="Close">&times;</button>
          </div>
          <div class="p-5 space-y-3">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">Document Date &amp; Time</label>
            <input type="datetime-local" data-document-date-modal="input" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-cyan-600 outline-none">
            <p class="text-xs text-gray-500 dark:text-gray-400">Enter the date and time stated for this document. This is separate from the file upload date.</p>
          </div>
          <div class="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2">
            <button type="button" data-document-date-modal="cancel" class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-200">Cancel</button>
            <button type="button" data-document-date-modal="save" class="px-4 py-2.5 bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950 rounded-lg font-bold">Save Document Date</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.classList.add('hidden');
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
      modal.querySelector('[data-document-date-modal="close"]').addEventListener('click', close);
      modal.querySelector('[data-document-date-modal="cancel"]').addEventListener('click', close);
      modal.querySelector('[data-document-date-modal="save"]').addEventListener('click', saveDocumentDate);
      return modal;
    }

    function closeDocumentDateModal() {
      document.querySelector('[data-document-date-modal="modal"]')?.classList.add('hidden');
    }

    let activeDocumentDateId = null;
    window.openDocumentDateModal = function(docId) {
      const doc = currentProjectDocumentById(docId);
      if (!doc) return toast('Document is no longer available.', 'error');
      if (!doc.file_path) return toast('Upload the document before entering its document date.', 'error');
      if (!canEditDocumentDate(doc)) return toast('Only the document uploader can enter or edit the document date.', 'error');
      activeDocumentDateId = Number(docId);
      const modal = ensureDocumentDateModal();
      modal.querySelector('[data-document-date-modal="name"]').textContent = doc.document_type_name || 'Document';
      const input = modal.querySelector('[data-document-date-modal="input"]');
      const source = doc.document_date || doc.upload_date || new Date().toISOString();
      const d = new Date(source);
      input.value = Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 0);
    };

    async function saveDocumentDate() {
      const modal = ensureDocumentDateModal();
      const input = modal.querySelector('[data-document-date-modal="input"]');
      if (!activeDocumentDateId || !input?.value) return toast('Document date and time are required.', 'error');
      const parsed = new Date(input.value);
      if (Number.isNaN(parsed.getTime())) return toast('Enter a valid document date and time.', 'error');
      const saveBtn = modal.querySelector('[data-document-date-modal="save"]');
      const oldText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        await fetchJson(`${API}/documents/${activeDocumentDateId}/document-date`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_date: parsed.toISOString() })
        });
        closeDocumentDateModal();
        toast('Document date saved.');
        await refreshAfterMutation({ projectId: currentProjId, documentId: activeDocumentDateId, silent: false });
      } catch (e) {
        toast(e.message || 'Unable to save document date.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = oldText;
      }
    }

    function showDocumentDateRequiredNotice(doc) {
      let modal = document.querySelector('[data-document-date-required="modal"]');
      if (!modal) {
        modal = document.createElement('div');
        modal.dataset.documentDateRequired = 'modal';
        modal.className = 'fixed inset-0 bg-black/40 hidden z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm';
        modal.innerHTML = `
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full sm:max-w-md" onclick="event.stopPropagation()">
            <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between gap-3"><div><h3 class="text-lg font-bold text-gray-900 dark:text-white">Document Date Required</h3><p class="text-sm text-gray-500 dark:text-gray-400 mt-1">This document cannot be marked Checked yet.</p></div><button type="button" data-document-date-required="close" class="text-gray-400 text-2xl leading-none">&times;</button></div>
            <div class="p-5"><p class="text-sm text-gray-700 dark:text-gray-200" data-document-date-required="message"></p></div>
            <div class="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end"><button type="button" data-document-date-required="ok" class="px-4 py-2.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg font-bold">Close</button></div>
          </div>`;
        document.body.appendChild(modal);
        const close = () => modal.classList.add('hidden');
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        modal.querySelector('[data-document-date-required="close"]').addEventListener('click', close);
        modal.querySelector('[data-document-date-required="ok"]').addEventListener('click', close);
      }
      const uploader = doc?.uploader_username ? ` ${doc.uploader_username}` : ' the uploader';
      modal.querySelector('[data-document-date-required="message"]').textContent = `Please inform${uploader} to enter the Document Date and time before this document can be marked Checked.`;
      modal.classList.remove('hidden');
    }

    async function toggleStatus(docId, statusBtn) {
      if (!requirePrivilege('mark_checked')) return;
      const currentStatus = statusBtn.dataset.status;
      const nextStatus = currentStatus === 'For Review' ? 'Checked' : 'For Review';
      const currentDoc = currentProjectDocumentById(docId);
      if (nextStatus === 'Checked' && currentDoc && !currentDoc.document_date) {
        showDocumentDateRequiredNotice(currentDoc);
        return;
      }
      const msg = currentStatus === 'For Review' 
        ? "Confirm document has been reviewed and checked?" 
        : "Revert this document back to review status?";

      openConfirmModal(msg, async () => {
        try {
          await fetchJson(`${API}/documents/${docId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
          });
          toast('Status updated');
          await refreshAfterMutation({ projectId: currentProjId, documentId: docId, silent: false });
        } catch(err) { toast(err.message, 'error'); }
      });
    }

    async function updateRequirementState(docId, requirementState) {
      try {
        await fetchJson(`${API}/documents/${docId}/requirement-state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement_state: requirementState })
        });
        toast(`Document marked as ${requirementState.toLowerCase()}`);
        await refreshAfterMutation({ projectId: currentProjId, documentId: docId, silent: false });
      } catch(err) {
        toast(err.message, 'error');
      }
    }

    function openRequirementStateModal(docId) {
      document.getElementById('requirementStateMessage').textContent = 'Choose how this document should be treated.';
      document.getElementById('requirementOptionalBtn').onclick = async () => {
        closeModal('requirementStateModal');
        await updateRequirementState(docId, 'Optional');
      };
      document.getElementById('requirementNotRequiredBtn').onclick = async () => {
        closeModal('requirementStateModal');
        await updateRequirementState(docId, 'Not Required');
      };
      document.getElementById('requirementStateModal').classList.remove('hidden');
    }

    async function toggleRequirementState(docId, statusBtn) {
      const currentState = statusBtn.dataset.requirementState || 'Required';
      const hasFile = statusBtn.dataset.hasFile === '1';
      if (currentState === 'Not Required' && hasFile) {
        if (!requirePrivilege('manage_requirements')) return;
        openConfirmModal(`Make this document required again?`, async () => {
          await updateRequirementState(docId, 'Required');
        });
        return;
      }
      if (!requirePrivilege('manage_requirements')) return;
      if (currentState === 'Required') {
        openRequirementStateModal(docId);
        return;
      }
      openConfirmModal(`Make this document required again?`, async () => {
        await updateRequirementState(docId, 'Required');
      });
    }

    async function loadDash(options = {}) {
      // Store current filter values before reloading
      const currentSearch = document.getElementById('searchInput')?.value || dashboardSavedFilters.search;
      const currentRequesteeFilter = document.getElementById('filterRequestee')?.value || dashboardSavedFilters.requestee;
      const currentTypeFilter = document.getElementById('filterType')?.value || dashboardSavedFilters.type;
      const currentOutcomeFilter = document.getElementById('filterOutcome')?.value || dashboardSavedFilters.outcome || dashboardOutcomeFilter || 'Active';
      const currentSortOrder = document.getElementById('sortOrder')?.value || dashboardSavedFilters.sort;
      const fetchOpts = options.silent ? { silentLoading: true } : {};
      
      try { 
        projCache = await fetchJson(`${API}/projects`, fetchOpts);
        typeCache = await fetchJson(`${API}/settings/project-types`, fetchOpts);
        reqCache = await fetchJson(`${API}/settings/requestees`, fetchOpts);
        usersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, fetchOpts).catch(() => []));
        const requesteeSel = document.getElementById('filterRequestee');
        const sel = document.getElementById('filterType'); 
        const outcomeSel = document.getElementById('filterOutcome');
        requesteeSel.innerHTML = '<option value="All">All Requests</option>';
        reqCache.forEach(r=>requesteeSel.innerHTML+=`<option value="${esc(r.name)}">${esc(r.name)}</option>`);
        sel.innerHTML = '<option value="All">All Types</option>'; 
        typeCache.forEach(t=>sel.innerHTML+=`<option value="${esc(t.name)}">${esc(t.name)}</option>`); 
        
        if (currentRequesteeFilter !== 'All') {
          const requesteeExists = reqCache.some(r => r.name === currentRequesteeFilter);
          if (requesteeExists) {
            requesteeSel.value = currentRequesteeFilter;
          }
        }
        
        // Restore filterType if it still exists in the new options
        if (currentTypeFilter !== 'All') {
          const typeExists = typeCache.some(t => t.name === currentTypeFilter);
          if (typeExists) {
            sel.value = currentTypeFilter;
          }
        }
        if (outcomeSel) outcomeSel.value = currentOutcomeFilter;
        dashboardOutcomeFilter = currentOutcomeFilter;
        
        // Fetch all documents to calculate overdue count accurately
        const allDocs = await fetchJson(`${API}/documents`, fetchOpts);
        window.allDocumentsCache = allDocs;
        myScheduleAssignmentsCache = await fetchJson(`${API}/calendar/my-schedules`, { ...fetchOpts, silentLoading: true })
          .then(data => data.schedules || [])
          .catch(() => []);
        myDashboardSchedulesCache = await fetchJson(`${API}/dashboard/my-schedules`, { ...fetchOpts, silentLoading: true })
          .then(data => data.schedules || [])
          .catch(() => []);
        workloadCache = null;
        
        // Restore search input
        document.getElementById('searchInput').value = currentSearch;
        
        // Restore sort order (don't reset to default)
        document.getElementById('sortOrder').value = currentSortOrder;
        
        // Save current filter state for persistence across project views
        dashboardSavedFilters = {
          search: currentSearch,
          requestee: requesteeSel.value,
          type: sel.value,
          outcome: outcomeSel?.value || currentOutcomeFilter,
          sort: currentSortOrder
        };
        
        if (!options.preservePage) dashboardPage = 1;
        renderOwnershipWorkPanel();
        renderProjects();
        await loadReviewDocuments({ silent: true });
        updateSidebarBadges();
        if (appCurrentView === 'review') renderReviewDocumentsPage();
      } catch(e){ toast(`Unable to refresh dashboard: ${e.message}`, 'error'); }
    }

    function getProjectWorkMetrics(projectId) {
      const now = new Date();
      const dueSoonLimit = addWorkingDaysClient(now, 5);
      const project = projCache.find(p => Number(p.id) === Number(projectId));
      if (project && projectOutcome(project) !== 'Active') {
        return { overdueAssigned: 0, overdueUnassigned: 0, dueSoon: 0, forReview: 0, oldestReviewUpload: null };
      }
      const docs = (window.allDocumentsCache || []).filter(d => Number(d.project_id) === Number(projectId) && (d.project_stage || d.stage) !== 'Completed' && isCountableRequirement(d));
      let oldestReviewUpload = null;
      const metrics = {
        overdueAssigned: 0,
        overdueUnassigned: 0,
        dueSoon: 0,
        forReview: 0,
        oldestReviewUpload: null
      };
      docs.forEach(doc => {
        const dueAt = doc.due_at ? new Date(doc.due_at) : null;
        const isOpen = doc.status !== 'Checked';
        if (dueAt && isOpen && dueAt < now) {
          if (doc.assigned_user_id) metrics.overdueAssigned += 1;
          else metrics.overdueUnassigned += 1;
        } else if (dueAt && isOpen && dueAt <= dueSoonLimit) {
          metrics.dueSoon += 1;
        }
        if (doc.status === 'For Review') {
          metrics.forReview += 1;
          const uploadedAt = doc.upload_date ? new Date(doc.upload_date) : null;
          if (uploadedAt && (!oldestReviewUpload || uploadedAt < oldestReviewUpload)) oldestReviewUpload = uploadedAt;
        }
      });
      metrics.oldestReviewUpload = oldestReviewUpload;
      return metrics;
    }

    function renderProjects() {
      const q = document.getElementById('searchInput').value.toLowerCase(); 
      const requesteeFilter = document.getElementById('filterRequestee').value;
      const f = document.getElementById('filterType').value;
      const outcomeFilter = document.getElementById('filterOutcome')?.value || dashboardOutcomeFilter || 'Active';
      const sort = document.getElementById('sortOrder').value;
      dashboardOutcomeFilter = outcomeFilter;
      
      // Save filter state on every render
      dashboardSavedFilters = { search: q, requestee: requesteeFilter, type: f, outcome: outcomeFilter, sort: sort };
      const renderKey = `${q}|${requesteeFilter}|${f}|${outcomeFilter}|${sort}|${dashboardStageFilter}`;
      if (lastDashboardRenderKey && renderKey !== lastDashboardRenderKey) {
        dashboardPage = 1;
      }
      lastDashboardRenderKey = renderKey;
      
      let data = projCache.filter(p => {
        const searchText = `${p.name || ''} ${p.requester || ''} ${p.type_name || ''} ${p.requestee_name || ''} ${p.barangay || ''} ${p.district || ''} ${p.assigned_username || ''}`.toLowerCase();
        const matchesSearch = !q || searchText.includes(q);
        const matchesRequestee = requesteeFilter === 'All' || p.requestee_name === requesteeFilter;
        const matchesType = f === 'All' || p.type_name === f;
        const outcome = projectOutcome(p);
        const matchesStage = dashboardStageFilter === 'All'
          || (dashboardStageFilter === 'Disposition' ? INACTIVE_PROJECT_OUTCOMES.includes(outcome) : p.stage === dashboardStageFilter);
        const matchesOutcome = dashboardStageFilter === 'Disposition'
          ? INACTIVE_PROJECT_OUTCOMES.includes(outcome)
          : (outcomeFilter === 'All' || outcome === outcomeFilter);
        return matchesSearch && matchesRequestee && matchesType && matchesStage && matchesOutcome;
      });
      const totalFilteredProjects = data.length;
      const filteredDataForCounts = [...data];
      window.dashboardVisibleProjectsCache = filteredDataForCounts;
      
      // Apply sorting
      data.sort((a, b) => {
        if (sort === 'created') {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        } else if (sort === 'recent') {
          return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
        } else if (sort === 'overdue') {
          const aMetrics = getProjectWorkMetrics(a.id);
          const bMetrics = getProjectWorkMetrics(b.id);
          const aRank = aMetrics.overdueAssigned ? 1 : (aMetrics.overdueUnassigned ? 2 : (aMetrics.dueSoon ? 3 : (aMetrics.forReview ? 4 : 5)));
          const bRank = bMetrics.overdueAssigned ? 1 : (bMetrics.overdueUnassigned ? 2 : (bMetrics.dueSoon ? 3 : (bMetrics.forReview ? 4 : 5)));
          if (aRank !== bRank) return aRank - bRank;
          const aScore = aMetrics.overdueAssigned + aMetrics.overdueUnassigned + aMetrics.dueSoon + aMetrics.forReview;
          const bScore = bMetrics.overdueAssigned + bMetrics.overdueUnassigned + bMetrics.dueSoon + bMetrics.forReview;
          if (bScore !== aScore) return bScore - aScore;
          return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
        } else if (sort === 'review') {
          const aMetrics = getProjectWorkMetrics(a.id);
          const bMetrics = getProjectWorkMetrics(b.id);
          if (bMetrics.forReview !== aMetrics.forReview) return bMetrics.forReview - aMetrics.forReview;
          if (aMetrics.oldestReviewUpload && bMetrics.oldestReviewUpload) return aMetrics.oldestReviewUpload - bMetrics.oldestReviewUpload;
          if (aMetrics.oldestReviewUpload) return -1;
          if (bMetrics.oldestReviewUpload) return 1;
          return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
        } else if (sort === 'progress') {
          return parseInt(b.progress || 0) - parseInt(a.progress || 0);
        } else if (sort === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        }
        return 0;
      });
      
      const pageSize = DASHBOARD_PAGE_SIZE || Math.max(data.length, 1);
      const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
      if (dashboardPage > totalPages) dashboardPage = totalPages;
      const pageStart = (dashboardPage - 1) * pageSize;
      data = data.slice(pageStart, pageStart + pageSize);

      const tb = document.getElementById('projectsTable'); const tbMobile = document.getElementById('projectsTableMobile'); const emp = document.getElementById('emptyProjects');
      updateDashboardCounts(filteredDataForCounts, data.length, totalFilteredProjects);
      renderDashboardPagination(totalFilteredProjects, totalPages);
      if(!data.length){
        tb.innerHTML='';
        tbMobile.innerHTML='';
        emp.classList.remove('hidden');
        if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
        return;
      }
      emp.classList.add('hidden');
      let h='', hm='';
      
      const nowDate = new Date();
      const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
      
      data.forEach(p=>{
        const outcome = projectOutcome(p);
        const inactiveProject = isInactiveProject(p);
        const isCompleted = outcome === 'Completed' || p.stage === 'Completed';
        const progress = parseInt(p.progress) || 0;
        const isOngoing = p.isOngoing === true;
        
        // Stage color for left border
        const stageColors = {
          Proposal: 'border-yellow-400',
          Implementation: 'border-blue-400',
          Monitoring: 'border-cyan-400',
          Completed: 'border-green-400'
        };
        const leftBorder = stageColors[p.stage] || 'border-gray-300';
        
        // Check for overdue
        const isOverdue = p.due_at && new Date(p.due_at) < todayStart && !isCompleted && !inactiveProject;
        const hasRecentActivity = p.last_activity_at && (nowDate - new Date(p.last_activity_at)) < 3 * 24 * 60 * 60 * 1000;
        
        // Progress bar style - FIXED-WIDTH segmented compliance progress bar
        let progressBarHtml;
        if (isCompleted) {
          progressBarHtml = `<div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span class="text-xs font-semibold text-green-600 dark:text-green-400">Done</span></div>`;
        } else if (isOngoing) {
          // Monitoring stage with no documents yet - show Ongoing indicator
          progressBarHtml = `<div class="flex items-center gap-1.5"><span class="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span><span class="text-xs font-semibold text-cyan-600 dark:text-cyan-400">Ongoing</span></div>`;
        } else {
          // Segmented compliance progress bar: each required doc = one segment
          const totalReqDocs = parseInt(p.total_req_docs) || 0;
          const checkedDocs = parseInt(p.checked_docs) || 0;
          const forReviewDocs = parseInt(p.for_review_docs) || 0;
          const missingDocs = totalReqDocs - checkedDocs - forReviewDocs;
          
          // Build tooltip content
          let tooltipContent = `Checked: ${checkedDocs} | For Review: ${forReviewDocs} | Missing: ${missingDocs}`;
          if (isOverdue && missingDocs > 0) {
            tooltipContent += ` | Overdue Missing: ${missingDocs}`;
          }
          
          // Create segments: green for checked, yellow for review, gray/red for missing
          const segments = [];
          
          // Checked segments (green)
          for (let i = 0; i < checkedDocs; i++) {
            const isFirst = i === 0;
            const isLast = i === totalReqDocs - 1;
            const roundedClasses = isFirst ? 'rounded-l' : (isLast ? 'rounded-r' : '');
            const borderClass = isLast ? '' : 'border-r border-white/40 dark:border-gray-900/30';
            segments.push(`<div class="h-2.5 bg-green-500 flex-1 ${roundedClasses} ${borderClass}" title="Checked"></div>`);
          }
          
          // For Review segments (yellow/amber)
          for (let i = 0; i < forReviewDocs; i++) {
            const segIndex = checkedDocs + i;
            const isFirst = segIndex === 0;
            const isLast = segIndex === totalReqDocs - 1;
            const roundedClasses = isFirst ? 'rounded-l' : (isLast ? 'rounded-r' : '');
            const borderClass = isLast ? '' : 'border-r border-white/40 dark:border-gray-900/30';
            segments.push(`<div class="h-2.5 bg-yellow-400 flex-1 ${roundedClasses} ${borderClass}" title="For Review"></div>`);
          }
          
          // Missing segments (gray or red if overdue)
          const missingColor = isOverdue ? 'bg-red-400' : 'bg-gray-300 dark:bg-gray-600';
          for (let i = 0; i < missingDocs; i++) {
            const segIndex = checkedDocs + forReviewDocs + i;
            const isFirst = segIndex === 0;
            const isLast = segIndex === totalReqDocs - 1;
            const roundedClasses = isFirst ? 'rounded-l' : (isLast ? 'rounded-r' : '');
            const borderClass = isLast ? '' : 'border-r border-white/40 dark:border-gray-900/30';
            segments.push(`<div class="h-2.5 ${missingColor} flex-1 ${roundedClasses} ${borderClass}" title="${isOverdue ? 'Overdue' : 'Missing'}"></div>`);
          }
          
          // Fixed-width container with flex layout - percentage OUTSIDE the bar
          progressBarHtml = `<div class="flex items-center gap-2"><div class="tooltip w-24 h-2.5 bg-gray-200 dark:bg-gray-700 rounded flex overflow-hidden" data-tip="${tooltipContent}">${segments.join('')}</div><span class="text-[10px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">${progress}%</span></div>`;
        }
        
        // Status indicators
        let statusIndicators = '';
        if (isOverdue) {
          statusIndicators += `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded border border-red-200 dark:border-red-800"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>Overdue</span>`;
        }
        
        // Metadata line - show Created date for desktop mode
        const createdStr = fmtDateTime(p.created_at);
        const locationText = formatProjectLocation(p);
        const metadataLine = `<div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span title="Created: ${p.created_at}">Created: ${createdStr}</span>
          ${locationText !== '-' ? `<span class="text-gray-300 dark:text-gray-600">-</span><span title="Location">${esc(locationText)}</span>` : ''}
          ${p.due_at ? `<span class="text-gray-300 dark:text-gray-600">-</span><span class="${isOverdue ? 'text-red-700 dark:text-red-300 font-black' : 'text-gray-600 dark:text-gray-300'}">Due: ${fmtDueDate(p.due_at)}</span>` : ''}
          ${statusIndicators ? `<span class="text-gray-300 dark:text-gray-600">-</span>${statusIndicators}` : ''}
        </div>`;
        
        const stageBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-black ${getStageTheme(p.stage).badge} border whitespace-nowrap">${esc(p.stage)}</span>`;
        const outcomeBadge = projectOutcomeBadge(p);

        const canEditThisProject = hasPrivilege('edit_project') && canActOnAssignedItem(p);
        const canDeleteThisProject = canDeleteProjectRecord(p);
        const canOpenProjectModal = canEditThisProject || canDeleteThisProject;
        const projectActionTitle = canEditThisProject ? 'Edit Project' : 'Delete Project';
        const editButtonDesktop = canOpenProjectModal ? `<button 
                  data-id="${p.id}"
                  data-name="${esc(p.name)}"
                  data-requester="${esc(p.requester)}"
                  data-type="${p.project_type_id}"
                  data-requestee="${p.requestee_id}"
                  data-district="${esc(p.district || '')}"
                  data-barangay="${esc(p.barangay || '')}"
                  data-has-uploaded-files="${p.uploaded_files > 0 ? '1' : '0'}"
                  onclick="openEditFromDataset(this)"
                  class="p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition flex items-center justify-center"
                  title="${projectActionTitle}">
                  ${svgEdit}
                </button>` : '';
        
        h+=`<tr data-id="${Number(p.id)}" data-stage="${p.stage === 'Completed' ? 'Implementation' : esc(p.stage)}" onclick="openDashboardProjectFromRow(this, event)" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group align-middle border-l-4 ${leftBorder}">
            <td class="px-4 py-3 pr-2">
              <div class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 truncate" title="${esc(p.name)}">${esc(p.name)}</div>
              ${metadataLine}
            </td>
            <td class="px-4 py-3"><span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-semibold text-gray-600 dark:text-gray-300">${esc(p.type_name)}</span></td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 truncate" style="max-width: 144px;" title="${esc(p.requester || '-')}">${esc(p.requester || '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">${esc(p.requestee_name || '-')}</td>
            <td class="px-4 py-3"><div class="flex flex-wrap gap-1.5">${stageBadge}<span class="text-gray-400 dark:text-gray-500 font-black">/</span>${outcomeBadge}</div></td>
            <td class="px-4 py-3">
              ${progressBarHtml}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">${fmtRelativeDate(p.last_activity_at)}</td>
            <td class="px-4 py-3 text-left align-middle">
              <div class="flex justify-start items-center gap-2">
                ${editButtonDesktop}
              </div>
            </td>
        </tr>`;

        const editButtonMobile = canOpenProjectModal ? `<button 
                data-id="${p.id}"
                data-name="${esc(p.name)}"
                data-requester="${esc(p.requester)}"
                data-type="${p.project_type_id}"
                data-requestee="${p.requestee_id}"
                data-district="${esc(p.district || '')}"
                data-barangay="${esc(p.barangay || '')}"
                data-has-uploaded-files="${p.uploaded_files > 0 ? '1' : '0'}"
                onclick="openEditFromDataset(this)"
                class="w-10 h-10 p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center"
                title="${projectActionTitle}">
                ${svgEdit}
              </button>` : '';
        hm+=`<div data-id="${Number(p.id)}" data-stage="${p.stage === 'Completed' ? 'Implementation' : esc(p.stage)}" onclick="openDashboardProjectFromRow(this, event)" class="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group border-l-4 ${leftBorder} mobile-project-card">
            <div class="mb-2 mobile-project-card-header flex justify-between items-start gap-2">
                <div>
                    <span class="font-bold text-gray-900 dark:text-gray-100 text-lg block group-hover:text-indigo-700 dark:group-hover:text-indigo-400">${esc(p.name)}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${esc(p.type_name)}</span>
                </div>
                <div class="inline-flex flex-row flex-nowrap items-center justify-end gap-1 whitespace-nowrap max-w-full">${stageBadge}<span class="text-gray-400 dark:text-gray-500 font-black shrink-0">/</span>${outcomeBadge}</div>
            </div>
            <div class="mobile-project-card-meta text-xs text-gray-500 dark:text-gray-400 mb-1">${esc(p.requester)} to ${esc(p.requestee_name || "-")}</div>
            ${locationText !== '-' ? `<div class="mobile-project-card-location text-xs text-gray-500 dark:text-gray-400 mb-2">${esc(locationText)}</div>` : ''}

            ${progressBarHtml}

            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">Last activity: ${fmtDateTime(p.last_activity_at)}</div>
            ${p.due_at ? `<div class="text-xs mt-1 ${isOverdue ? 'text-red-700 dark:text-red-300 font-black' : 'text-gray-500 dark:text-gray-400'}">Due: ${fmtDueDate(p.due_at)}</div>` : ''}

            ${editButtonMobile ? `<div class="mobile-project-card-actions flex gap-2 mt-3">${editButtonMobile}</div>` : ''}
        </div>`;
      });
      tb.innerHTML=h; tbMobile.innerHTML=hm;
      if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
    }

    function renderDashboardPagination(totalItems, totalPages) {
      const tableWrap = document.querySelector('#dashboardView .overflow-x-auto.bg-white');
      if (!tableWrap) return;
      let pager = document.getElementById('dashboardPager');
      if (!pager) {
        pager = document.createElement('div');
        pager.id = 'dashboardPager';
        pager.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-200 dark:border-gray-700 text-sm';
        tableWrap.appendChild(pager);
      }
      if (!totalItems) {
        pager.classList.add('hidden');
        return;
      }
      pager.classList.remove('hidden');
      const pageSize = DASHBOARD_PAGE_SIZE || Math.max(totalItems, 1);
      const from = (dashboardPage - 1) * pageSize + 1;
      const to = Math.min(totalItems, dashboardPage * pageSize);
      const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(page => page === 1 || page === totalPages || Math.abs(page - dashboardPage) <= 1);
      const pageButtons = pages.map((page, i) => {
        const gap = i && page - pages[i - 1] > 1 ? '<span class="px-1 text-gray-400">...</span>' : '';
        return `${gap}<button onclick="goDashboardPage(${page})" class="dashboard-page-btn ${page === dashboardPage ? 'is-active' : ''} w-8">${page}</button>`;
      }).join('');
      pager.innerHTML = `
        <div class="text-gray-600 dark:text-gray-400">Showing ${from} to ${to} of ${totalItems} projects</div>
        <div class="flex items-center gap-2">
          <select onchange="setDashboardPageSize(this.value)" class="px-3">
            ${[10, 25, 50].map(size => `<option value="${size}" ${DASHBOARD_PAGE_SIZE === size ? 'selected' : ''}>${size} / page</option>`).join('')}
            <option value="all" ${DASHBOARD_PAGE_SIZE === 0 ? 'selected' : ''}>All / page</option>
          </select>
          <button onclick="changeDashboardPage(-1)" ${dashboardPage <= 1 ? 'disabled' : ''} class="w-8 disabled:opacity-40" aria-label="Previous page">&lsaquo;</button>
          ${pageButtons}
          <button onclick="changeDashboardPage(1)" ${dashboardPage >= totalPages ? 'disabled' : ''} class="w-8 disabled:opacity-40" aria-label="Next page">&rsaquo;</button>
        </div>`;
    }

    function setDashboardPageSize(size) {
      DASHBOARD_PAGE_SIZE = size === 'all' ? 0 : Number(size) || 10;
      dashboardPage = 1;
      renderProjects();
    }

    function goDashboardPage(page) {
      dashboardPage = Math.max(1, Number(page) || 1);
      renderProjects();
    }

    function changeDashboardPage(delta) {
      dashboardPage = Math.max(1, dashboardPage + delta);
      renderProjects();
    }

    function openProjectDispositionModal() {
      const p = projCache.find(x => Number(x.id) === Number(currentProjId));
      if (!p || !canMarkProjectDisposition(p)) return;
      if (projectOutcome(p) !== 'Active') return toast('Reopen the project before changing disposition.', 'error');
      const today = new Date().toISOString().slice(0, 10);
      openConfirmModal(`
        <div class="space-y-3 text-sm">
          <div>
            <div class="text-lg font-black text-gray-950 dark:text-gray-50">Mark Project Disposition</div>
            <div class="mt-1 text-amber-700 dark:text-amber-300 font-semibold">This will close the project from active workload and due alerts, but will not delete uploaded documents or activity history.</div>
          </div>
          <label class="block"><span class="font-bold">Outcome</span><select id="projectDispositionOutcome" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800">${INACTIVE_PROJECT_OUTCOMES.map(outcome => `<option>${esc(outcome)}</option>`).join('')}</select></label>
          <label class="block"><span class="font-bold">Reason</span><select id="projectDispositionReason" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800"><option>Technical issue</option><option>Budget limitation</option><option>Site issue</option><option>Legal / ownership issue</option><option>Duplicate / already covered</option><option>Request withdrawn</option><option>For future funding</option><option>Other</option></select></label>
          <label class="block"><span class="font-bold">Remarks</span><textarea id="projectDispositionRemarks" rows="4" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800" placeholder="Describe the disposition decision..." required></textarea></label>
          <label class="block"><span class="font-bold">Decision date</span><input id="projectDispositionDate" type="date" value="${today}" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800"></label>
          <div><span class="font-bold">Supporting attachment</span>${fileDropZoneHtml({ zoneId: 'projectDispositionAttachmentDropZone', inputId: 'projectDispositionAttachment', labelId: 'projectDispositionAttachmentLabel', title: 'Drag and drop supporting file here, or click to browse', help: 'Optional supporting attachment.' })}</div>
        </div>
      `, null);
      setupGenericFileDropZone({ zoneId: 'projectDispositionAttachmentDropZone', inputId: 'projectDispositionAttachment', labelId: 'projectDispositionAttachmentLabel', emptyText: 'Optional supporting attachment.' });
      const btn = document.getElementById('confirmActionBtn');
      btn.textContent = currentUser?.role === 'superadmin' ? 'Confirm Disposition' : 'Submit for Confirmation';
      btn.className = "px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium";
      btn.onclick = async () => {
        const remarks = document.getElementById('projectDispositionRemarks')?.value.trim();
        if (!remarks) return toast('Remarks are required.', 'error');
        const form = new FormData();
        form.append('outcome', document.getElementById('projectDispositionOutcome')?.value || 'Not Feasible');
        form.append('reason', document.getElementById('projectDispositionReason')?.value || '');
        form.append('remarks', remarks);
        const decisionDate = document.getElementById('projectDispositionDate')?.value;
        if (decisionDate) form.append('decision_date', decisionDate);
        const file = document.getElementById('projectDispositionAttachment')?.files?.[0];
        if (file) form.append('attachment', file);
        try {
          const result = await fetchJson(`${API}/projects/${p.id}/disposition`, { method: 'POST', body: form });
          closeConfirmModal();
          toast(result?.pending_approval ? 'Disposition request submitted for superadmin confirmation.' : 'Project disposition saved.');
          await refreshAfterMutation({ projectId: p.id, targetStage: activeDetailStage, silent: false });
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }

    function openProjectReopenModal() {
      const p = projCache.find(x => Number(x.id) === Number(currentProjId));
      if (!p || !canManageProjectDisposition()) return;
      openConfirmModal(`<div class="space-y-3 text-sm"><div class="text-lg font-black text-gray-950 dark:text-gray-50">Reopen Project</div><div>This will restore the project to Active workload tracking.</div><label class="block"><span class="font-bold">Remarks</span><textarea id="projectReopenRemarks" rows="4" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800" placeholder="Why is this project being reopened?"></textarea></label></div>`, null);
      const btn = document.getElementById('confirmActionBtn');
      btn.textContent = 'Confirm Reopen';
      btn.className = "px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium";
      btn.onclick = async () => {
        const remarks = document.getElementById('projectReopenRemarks')?.value.trim();
        if (!remarks) return toast('Remarks are required.', 'error');
        try {
          await fetchJson(`${API}/projects/${p.id}/reopen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remarks }) });
          closeConfirmModal();
          toast('Project reopened.');
          await refreshAfterMutation({ projectId: p.id, targetStage: activeDetailStage, silent: false });
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }

    function renderTransitionButton() {
        const area = document.getElementById('transitionBtnArea'); area.innerHTML = ''; const p = projCache.find(x => x.id == currentProjId); if (!p) return;
        const pending = pendingConfirmationsCache[p.id] || {};
        const dispositionButtons = [];
        const outcome = projectOutcome(p);
        if (canMarkProjectDisposition(p) && outcome === 'Active' && !pending.disposition_request && (p.stage !== 'Completed' || currentUser?.role === 'superadmin')) {
          dispositionButtons.push(`<button onclick="openProjectDispositionModal()" class="w-full sm:w-auto flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition">Mark Disposition</button>`);
        }
        if (canManageProjectDisposition() && outcome !== 'Active') {
          dispositionButtons.push(`<button onclick="openProjectReopenModal()" class="w-full sm:w-auto flex items-center justify-center bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-gray-950 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition">Reopen Project</button>`);
        }
        if (!hasPrivilege('transition_stage')) {
          if (dispositionButtons.length) {
            area.innerHTML = `<div class="flex flex-col sm:flex-row justify-end gap-2">${dispositionButtons.join('')}</div>`;
            area.classList.remove('hidden');
          } else {
            area.classList.add('hidden');
          }
          return;
        }
        
        if (p.stage === 'Completed') {
            area.innerHTML = `
                <div class="flex flex-col sm:flex-row justify-end gap-2">
                ${dispositionButtons.join('')}
                <button class="px-4 py-2 rounded-lg bg-green-100 text-green-700 border border-green-200 font-semibold cursor-not-allowed w-full sm:w-auto">
                    COMPLETED
                </button>
                </div>
            `;
            area.classList.remove('hidden');
            return;
        }
        
        if (activeDetailStage !== p.stage) {
          if (dispositionButtons.length) {
            area.innerHTML = `<div class="flex flex-col sm:flex-row justify-end gap-2">${dispositionButtons.join('')}</div>`;
            area.classList.remove('hidden');
          } else {
            area.classList.add('hidden');
          }
          return;
        }
        if (isInactiveProject(p) && currentUser?.role !== 'superadmin') {
          area.innerHTML = `<div class="flex flex-col sm:flex-row justify-end gap-2">${dispositionButtons.join('')}<span class="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-bold">Reopen before changing stages.</span></div>`;
          area.classList.remove('hidden');
          return;
        }
        
        const progressVal = parseInt(p.progress);
        const monitoringReviewedCount = parseInt(p.monitoring_reviewed_count) || 0;
        const canClose = p.stage === 'Monitoring' ? monitoringReviewedCount > 0 : progressVal === 100;
        const nextStage = p.stage === 'Proposal' ? 'Implementation' : (p.stage === 'Implementation' ? 'Monitoring' : '');
        let buttons = dispositionButtons.join('');
        if (pending.closure_request) {
            buttons += `<span class="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 text-sm font-bold">Close request pending confirmation</span>`;
        } else if (canClose && canRequestProjectClosure()) {
            buttons += `<button onclick="openStageTransitionModal('Completed')" class="w-full sm:w-auto flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition">Close Project${svgCheck}</button>`;
        }
        if (progressVal === 100 && nextStage) {
            buttons += `<button onclick="openStageTransitionModal('${nextStage}')" class="w-full sm:w-auto flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition">Proceed to ${nextStage}${svgNext}</button>`;
        }
        if (buttons) {
            area.innerHTML = `<div class="flex flex-col sm:flex-row justify-end gap-2">${buttons}</div>`;
            area.classList.remove('hidden');
        } else {
            area.classList.add('hidden');
        }
    }

    async function projectRequirementsChanged(project, docs, stage, options = {}) {
      if (!project?.project_type_id || !project?.requestee_id) return false;
      const params = new URLSearchParams({
        projectTypeId: project.project_type_id,
        requesteeId: project.requestee_id,
        stage
      });
      const configured = await fetchJson(`${API}/settings/requirements?${params.toString()}`, options.silent ? { silentLoading: true } : {});
      const expected = (configured || [])
        .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0))
        .map(item => Number(item.id));
      const current = (docs || [])
        .filter(doc => doc.document_type_id)
        .sort((a, b) => Number(a.document_order_index || 0) - Number(b.document_order_index || 0))
        .map(doc => Number(doc.document_type_id));
      return expected.length !== current.length || expected.some((item, index) => item !== current[index]);
    }

    let activeDocumentRemarkId = null;
    let documentRequirementLongPressTimer = null;
    let documentRequirementLongPressPoint = null;

    function currentProjectDocumentById(docId) {
      return (window.currentProjectDocumentsCache || []).find(doc => Number(doc.id) === Number(docId)) || null;
    }

    function canEditDocumentRemark(doc) {
      if (!doc || !currentUser) return false;
      const project = projCache.find(p => Number(p.id) === Number(doc.project_id || currentProjId));
      const docStage = doc.stage || activeDetailStage;
      if (project && isInactiveProject(project) && currentUser.role !== 'superadmin') return false;
      if (project && project.stage !== docStage && currentUser.role !== 'superadmin') return false;
      const canWorkDocument = hasPrivilege('upload_document') || hasPrivilege('mark_checked') || currentUser.role === 'superadmin';
      return canWorkDocument && (canActOnAssignedItem(doc) || hasPrivilege('mark_checked') || currentUser.role === 'superadmin');
    }

    function documentRemarkIndicatorHtml(doc) {
      const remarks = String(doc?.remarks || '').trim();
      if (!remarks) return '';
      const compact = remarks.replace(/\s+/g, ' ').slice(0, 240);
      return `<button type="button" onclick="event.stopPropagation(); openDocumentRemarkModal(${Number(doc.id)})" class="document-requirement-remark-indicator" title="Remark: ${esc(compact)}" aria-label="View remark for ${esc(doc.document_type_name || 'document')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h5m7-2a8 8 0 11-3.1-6.3L20 4v8z"/></svg>
      </button>`;
    }

    function documentRemarkElement(role) {
      return document.querySelector(`[data-document-remark="${role}"]`);
    }

    function updateDocumentRemarkCounter() {
      const textarea = documentRemarkElement('text');
      const counter = documentRemarkElement('counter');
      if (!textarea || !counter) return;
      counter.textContent = `${textarea.value.length} / 2000`;
    }

    function openDocumentRemarkModal(docId) {
      closeDocumentRequirementContextMenu();
      const doc = currentProjectDocumentById(docId);
      if (!doc) return toast('Document is no longer available.', 'error');
      activeDocumentRemarkId = Number(doc.id);
      const editable = canEditDocumentRemark(doc);
      const textarea = documentRemarkElement('text');
      const saveBtn = documentRemarkElement('save');
      const hint = documentRemarkElement('hint');
      documentRemarkElement('title').textContent = doc.document_type_name || 'Document Remark';
      documentRemarkElement('subtitle').textContent = `${doc.stage || activeDetailStage} stage • ${doc.assigned_username ? `Assigned to ${doc.assigned_username}` : 'Unassigned'}`;
      textarea.value = String(doc.remarks || '');
      textarea.readOnly = !editable;
      textarea.classList.toggle('opacity-80', !editable);
      saveBtn.classList.toggle('hidden', !editable);
      hint.textContent = editable
        ? 'Keep this concise; the remark is shared with users who can view this project.'
        : 'Read-only for this user or stage.';
      updateDocumentRemarkCounter();
      documentRemarkElement('modal').classList.remove('hidden');
      if (editable) setTimeout(() => textarea.focus(), 50);
    }

    function closeDocumentRemarkModal() {
      documentRemarkElement('modal')?.classList.add('hidden');
      activeDocumentRemarkId = null;
    }

    async function saveDocumentRemark() {
      const docId = Number(activeDocumentRemarkId || 0);
      const textarea = documentRemarkElement('text');
      const saveBtn = documentRemarkElement('save');
      if (!docId || !textarea || textarea.readOnly) return;
      const remarks = textarea.value.trim();
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        const result = await fetchJson(`${API}/documents/${docId}/remarks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remarks })
        });
        const doc = currentProjectDocumentById(docId);
        if (doc) doc.remarks = result?.remarks || '';
        closeDocumentRemarkModal();
        toast(remarks ? 'Document remark saved.' : 'Document remark cleared.');
        await refreshAfterMutation({ projectId: currentProjId, documentId: docId, silent: true });
      } catch (err) {
        toast(err.message || 'Unable to save document remark.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }

    function documentRequirementMenuIcon(kind) {
      const paths = {
        file: '<path stroke-linecap="round" stroke-linejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path stroke-linecap="round" stroke-linejoin="round" d="M14 2v6h6"/>',
        upload: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"/>',
        remark: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h5m7-2a8 8 0 11-3.1-6.3L20 4v8z"/>',
        due: '<rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M16 3v4M8 3v4M3 10h18"/>',
        check: '<path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/>',
        state: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h10"/>',
        delete: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14M10 11v5m4-5v5"/>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="document-requirement-context-menu__icon" aria-hidden="true">${paths[kind] || paths.state}</svg>`;
    }

    function closeDocumentRequirementContextMenu() {
      document.getElementById('documentRequirementContextMenu')?.remove();
    }

    function positionDocumentRequirementContextMenu(menu, x, y) {
      const gap = 8;
      const rect = menu.getBoundingClientRect();
      const left = Math.max(gap, Math.min(x, window.innerWidth - rect.width - gap));
      const top = Math.max(gap, Math.min(y, window.innerHeight - rect.height - gap));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function openDocumentRequirementContextMenu(event, docId) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const x = Number(event?.clientX || 12);
      const y = Number(event?.clientY || 12);
      openDocumentRequirementContextMenuAt(docId, x, y);
      return false;
    }

    function openDocumentRequirementContextMenuAt(docId, x, y) {
      closeDocumentRequirementContextMenu();
      const doc = currentProjectDocumentById(docId);
      if (!doc) return;
      const project = projCache.find(p => Number(p.id) === Number(doc.project_id || currentProjId));
      const docStage = doc.stage || activeDetailStage;
      const isLocked = !!(project && project.stage !== docStage);
      const inactiveProject = !!(project && isInactiveProject(project));
      const hasFile = !!doc.file_path;
      const isNotRequired = (doc.requirement_state || 'Required') === 'Not Required';
      const canActOnThisDocument = canActOnAssignedItem(doc);
      const uploadedByMe = Number(doc.uploader_user_id || 0) === Number(currentUser?.id || 0);
      const canUploadStageDoc = !hasFile && !isNotRequired && canUpload() && (!inactiveProject || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(docStage, 'upload')) && canActOnThisDocument;
      const canStatusStageDoc = hasFile && !isNotRequired && hasPrivilege('mark_checked') && (!isLocked || hasTemporaryStageAccess(docStage, 'status_change'));
      const canRequirementStageDoc = hasPrivilege('edit_requirement_state') && (!isLocked || hasTemporaryStageAccess(docStage, 'requirement_state_change'));
      const dueClickable = !inactiveProject && (hasPrivilege('set_manual_due_date') || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(docStage, 'due_date_change'));
      const canDeleteDocument = hasFile && (hasPrivilege('delete_document') || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(docStage, 'delete_file')) && (canActOnThisDocument || uploadedByMe);
      const canDeleteMonitoringRequirement = !hasFile && docStage === 'Monitoring' && hasPrivilege('manage_requirements') && !isLocked;
      const canEditRemark = canEditDocumentRemark(doc);
      const hasRemark = !!String(doc.remarks || '').trim();

      const items = [];
      if (hasFile) items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'open-file')">${documentRequirementMenuIcon('file')}<span>Open file</span></button>`);
      if (canUploadStageDoc) items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'upload')">${documentRequirementMenuIcon('upload')}<span>Upload file</span></button>`);
      if (hasFile || canUploadStageDoc) items.push('<div class="document-requirement-context-menu__separator"></div>');
      if (canEditRemark) {
        items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'remark')">${documentRequirementMenuIcon('remark')}<span>${hasRemark ? 'Edit remark' : 'Add remark'}</span></button>`);
      } else if (hasRemark) {
        items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'remark')">${documentRequirementMenuIcon('remark')}<span>View remark</span></button>`);
      } else {
        items.push(`<button type="button" class="document-requirement-context-menu__item is-disabled" disabled>${documentRequirementMenuIcon('remark')}<span>No remark</span></button>`);
      }
      if (dueClickable) items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'due')">${documentRequirementMenuIcon('due')}<span>${doc.due_at ? 'Edit due date' : 'Set due date'}</span></button>`);
      if (canStatusStageDoc) items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'status')">${documentRequirementMenuIcon('check')}<span>${doc.status === 'Checked' ? 'Return to For Review' : 'Mark as Checked'}</span></button>`);
      if (canRequirementStageDoc && (!hasFile || isNotRequired)) items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, 'requirement-state')">${documentRequirementMenuIcon('state')}<span>Change requirement state</span></button>`);
      if (canDeleteDocument || canDeleteMonitoringRequirement) {
        items.push('<div class="document-requirement-context-menu__separator"></div>');
        items.push(`<button type="button" role="menuitem" class="document-requirement-context-menu__item is-danger" onclick="runDocumentRequirementContextAction(${Number(doc.id)}, '${canDeleteDocument ? 'delete-file' : 'delete-monitoring'}')">${documentRequirementMenuIcon('delete')}<span>${canDeleteDocument ? 'Delete file' : 'Delete monitoring document'}</span></button>`);
      }

      const menu = document.createElement('div');
      menu.id = 'documentRequirementContextMenu';
      menu.className = 'document-requirement-context-menu';
      menu.setAttribute('role', 'menu');
      menu.innerHTML = `<div class="document-requirement-context-menu__header"><div class="document-requirement-context-menu__name">${esc(doc.document_type_name || 'Document')}</div><div class="document-requirement-context-menu__meta">${esc(docStage)} • ${esc(doc.status || (hasFile ? 'For Review' : 'No File'))}</div></div>${items.join('')}`;
      document.body.appendChild(menu);
      positionDocumentRequirementContextMenu(menu, x, y);
      menu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }

    function runDocumentRequirementContextAction(docId, action) {
      const doc = currentProjectDocumentById(docId);
      closeDocumentRequirementContextMenu();
      if (!doc) return toast('Document is no longer available.', 'error');
      if (action === 'open-file' && doc.file_path) return openFileViewer(String(doc.id), doc.file_name || 'Document');
      if (action === 'upload') return openUp(doc.id, doc.document_type_name || 'Document');
      if (action === 'remark') return openDocumentRemarkModal(doc.id);
      if (action === 'due') {
        const proxy = document.createElement('button');
        proxy.dataset.docId = String(doc.id);
        proxy.dataset.dueAt = String(doc.due_at || '');
        proxy.dataset.docName = String(doc.document_type_name || 'Document');
        return openDocumentDueDateFromButton(proxy);
      }
      if (action === 'status') return toggleStatus(doc.id, { dataset: { status: doc.status || 'For Review' } });
      if (action === 'requirement-state') return toggleRequirementState(doc.id, { dataset: { requirementState: doc.requirement_state || 'Required', hasFile: doc.file_path ? '1' : '0' } });
      if (action === 'delete-file') return openConfirmModal('Delete file?', () => delFile(doc.id));
      if (action === 'delete-monitoring') return openConfirmModal('Delete monitoring document?', () => delMonitoringDoc(doc.id));
    }

    function startDocumentRequirementLongPress(event, docId) {
      if (!event || event.pointerType === 'mouse') return;
      if (event.target?.closest?.('button, input, select, textarea, a, label')) return;
      cancelDocumentRequirementLongPress();
      documentRequirementLongPressPoint = { x: event.clientX, y: event.clientY };
      documentRequirementLongPressTimer = setTimeout(() => {
        const point = documentRequirementLongPressPoint || { x: 12, y: 12 };
        openDocumentRequirementContextMenuAt(docId, point.x, point.y);
        documentRequirementLongPressTimer = null;
      }, 550);
    }

    function cancelDocumentRequirementLongPress() {
      if (documentRequirementLongPressTimer) clearTimeout(documentRequirementLongPressTimer);
      documentRequirementLongPressTimer = null;
      documentRequirementLongPressPoint = null;
    }

    if (!window.documentRequirementContextMenuHandlersReady) {
      window.documentRequirementContextMenuHandlersReady = true;
      document.addEventListener('click', event => {
        if (!event.target.closest?.('#documentRequirementContextMenu')) closeDocumentRequirementContextMenu();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeDocumentRequirementContextMenu();
          if (!documentRemarkElement('modal')?.classList.contains('hidden')) closeDocumentRemarkModal();
        }
      });
      window.addEventListener('resize', closeDocumentRequirementContextMenu);
      window.addEventListener('scroll', closeDocumentRequirementContextMenu, true);
    }

    async function loadDocs(projectId, stage, options = {}) {
      try {
        if (!usersCache.length) usersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, options.silent ? { silentLoading: true } : {}).catch(() => []));
        const docsResponse = await fetchJson(`${API}/documents/${projectId}?stage=${stage}`, options.silent ? { silentLoading: true } : {});
        const docs = Array.isArray(docsResponse) ? docsResponse : (docsResponse.items || []);
        window.currentProjectDocumentsCache = docs;
        if (Number(projectId) === Number(currentProjId)) refreshProjectDocumentationCounts({ silent: true });
        const p = projCache.find(x => x.id == projectId); const isLocked = p && p.stage !== stage;
        const inactiveProject = p && isInactiveProject(p);
        if (p && stage === 'Monitoring') {
          p.monitoring_reviewed_count = docs.filter(isReviewedMonitoringDocument).length;
          renderTransitionButton();
        }
        const tb = document.getElementById('documentsTable'); const tbMobile = document.getElementById('documentsTableMobile'); let h='', hm='';
        const hasUploadedFiles = docs.some(d => !!d.file_path);
        const reloadBtn = document.getElementById('reloadRequirementsBtn');
        if (reloadBtn) {
          const canReloadBase = hasPrivilege('manage_requirements') && p && ['Proposal', 'Implementation'].includes(stage) && (reloadRequirementsOverrideEnabled || (p.stage === stage && !hasUploadedFiles));
          const hasRequirementChanges = canReloadBase && await projectRequirementsChanged(p, docs, stage, options);
          const canReload = canReloadBase && hasRequirementChanges;
          reloadBtn.classList.toggle('hidden', !canReload);
        }
        const canAddMonitoringDoc = hasPrivilege('manage_requirements') && stage === 'Monitoring' && p && p.stage === 'Monitoring' && !inactiveProject;
        if (canAddMonitoringDoc) {
          const addBtn = `<button onclick="openMonitoringDocModal()" class="bg-cyan-800 dark:bg-cyan-500 hover:bg-cyan-900 dark:hover:bg-cyan-400 text-white dark:text-gray-950 px-4 py-2 rounded-lg font-bold shadow-sm">Add Monitoring Document</button>`;
          h += `<tr><td colspan="8" class="px-4 py-4 bg-cyan-50/60 dark:bg-cyan-950/20">${addBtn}</td></tr>`;
          hm += `<div class="p-4 bg-cyan-50/60 dark:bg-cyan-950/20">${addBtn}</div>`;
        }
        docs.forEach(d=>{
          const has = !!d.file_path;
          const requirementState = d.requirement_state || 'Required';
          const isOptional = requirementState === 'Optional';
          const isNotRequired = requirementState === 'Not Required';
          const assignedToMe = Number(d.assigned_user_id) === Number(currentUser?.id);
          const canAssignStageDoc = canAssignOwnership() && (!isLocked || hasTemporaryStageAccess(stage, 'assignment_change'));
          const ownerControl = isNotRequired ? '<span class="text-gray-400">-</span>' : (canAssignStageDoc ? assignmentSelect(d) : ownershipBadge(d));
          const canRequirementStageDoc = hasPrivilege('edit_requirement_state') && (!isLocked || hasTemporaryStageAccess(stage, 'requirement_state_change'));
          const canStatusStageDoc = hasPrivilege('mark_checked') && (!isLocked || hasTemporaryStageAccess(stage, 'status_change'));
          const canManageStageDoc = canRequirementStageDoc;
          const canActOnThisDocument = canActOnAssignedItem(d);
          const uploadedByMe = Number(d.uploader_user_id || 0) === Number(currentUser?.id || 0);
          const canResetUploadedNotRequired = has && isNotRequired && !isLocked && hasPrivilege('manage_requirements');
          const canResetUploadedNotRequiredLocked = has && isNotRequired && canRequirementStageDoc;
          const canDeleteDocument = (hasPrivilege('delete_document') || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(stage, 'delete_file')) && (canActOnThisDocument || uploadedByMe);
          const dueAt = d.due_at;
          const isOverdue = dueAt && d.status !== 'Checked' && new Date(dueAt) < new Date() && !inactiveProject;
          let statusClass = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700', statusLabel = 'No File', btnClass = 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700', btnLabel = 'Uploaded';
          if (isOptional) { statusClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800'; statusLabel = 'Optional'; }
          if (isNotRequired) { statusClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'; statusLabel = 'Not Required'; }
          if (has && !isNotRequired) { if (d.status === 'Checked') { statusClass = 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-200 border-green-200 dark:border-green-800'; statusLabel = 'Checked'; btnClass = 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-200 border-green-200 dark:border-green-800'; } else { statusClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'; statusLabel = 'For Review'; btnClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'; } }
          const f = has ? `<div class="tooltip w-48 truncate" data-tip="${esc(d.file_name)}"><button type="button" data-doc-id="${Number(d.id)}" data-file-name="${esc(d.file_name)}" onclick="openFileViewer(this.dataset.docId, this.dataset.fileName)" class="inline-flex max-w-full items-center rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold text-xs text-left">${esc(d.file_name.length>25?d.file_name.slice(0,25)+'...':d.file_name)}</button></div>` : `<span class="text-gray-400">-</span>`;
          const dueClickable = !inactiveProject && (hasPrivilege('set_manual_due_date') || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(stage, 'due_date_change'));
          const dueHtml = inactiveProject ? `<span class="inline-flex items-center rounded-full px-2.5 py-1 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 font-bold">Inactive project</span>` : (dueClickable
            ? `<button type="button" data-doc-id="${d.id}" data-due-at="${esc(d.due_at || '')}" data-doc-name="${esc(d.document_type_name)}" onclick="openDocumentDueDateFromButton(this)" class="inline-flex items-center rounded-full px-2.5 py-1 border text-xs ${dueAt ? (isOverdue ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 font-bold') : 'border-dashed border-gray-300 dark:border-gray-700 text-gray-400 font-bold'} cursor-pointer hover:border-blue-300 dark:hover:border-blue-700" title="${dueAt ? 'Click to edit due date' : 'Click to set due date'}">${dueAt ? fmtDueDate(dueAt) : 'Set due date'}</button>`
            : (dueAt ? `<span class="inline-flex items-center rounded-full px-2.5 py-1 border text-xs ${isOverdue ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 font-bold'}" title="Due date">${fmtDueDate(dueAt)}</span>` : `<span class="inline-flex items-center rounded-full px-2.5 py-1 border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-400">Set due date</span>`));
          const canEditDate = canEditDocumentDate(d);
          const documentDateHtml = !has
            ? `<span class="text-gray-400">-</span>`
            : (d.document_date
              ? (canEditDate
                ? `<button type="button" onclick="openDocumentDateModal(${d.id})" class="text-left text-xs text-gray-500 dark:text-gray-400 hover:text-cyan-700 dark:hover:text-cyan-300" title="Click to edit document date">${fmtDateTime(d.document_date)}</button>`
                : `<span class="text-xs text-gray-500 dark:text-gray-400">${fmtDateTime(d.document_date)}</span>`)
              : (canEditDate
                ? `<button type="button" onclick="openDocumentDateModal(${d.id})" class="inline-flex items-center rounded-full px-2.5 py-1 border border-dashed border-amber-300 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 font-bold hover:border-cyan-400" title="Enter document date and time">Enter date</button>`
                : `<span class="inline-flex items-center rounded-full px-2.5 py-1 border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-400 dark:text-gray-500 font-bold cursor-not-allowed select-none" title="Only the uploader can enter the document date">Enter date</span>`));
          let desktopStatusBadge = `<span class="text-xs px-2.5 py-1 rounded-full border font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 whitespace-nowrap">No File</span>`;
          if (!has && canManageStageDoc) {
            desktopStatusBadge = `<span data-requirement-state="${esc(requirementState)}" data-has-file="0" onclick="toggleRequirementState(${d.id}, this)" class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} cursor-pointer select-none whitespace-nowrap" title="${requirementState === 'Required' ? 'Click to choose Optional or Not Required' : 'Click to make required again'}">${statusLabel}</span>`;
          } else if (has && !isNotRequired) {
            const onclick = canStatusStageDoc ? `data-status="${d.status}" onclick="toggleStatus(${d.id}, this)"` : '';
            const cursor = canStatusStageDoc ? 'cursor-pointer select-none' : 'cursor-default';
            desktopStatusBadge = `<span ${onclick} class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} ${cursor} whitespace-nowrap" title="Click to toggle status">${statusLabel}</span>`;
          } else if (has && isNotRequired) {
            const canResetState = canResetUploadedNotRequired || canResetUploadedNotRequiredLocked;
            const onclick = canResetState ? `data-requirement-state="${esc(requirementState)}" data-has-file="1" onclick="toggleRequirementState(${d.id}, this)"` : '';
            const cursor = canResetState ? 'cursor-pointer select-none' : 'cursor-not-allowed opacity-80';
            desktopStatusBadge = `<span ${onclick} class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} ${cursor} whitespace-nowrap" title="${canResetState ? 'Click to make required again' : 'Not Required'}">${statusLabel}</span>`;
          } else if (isOptional || isNotRequired) {
            desktopStatusBadge = `<span class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} whitespace-nowrap">${statusLabel}</span>`;
          }
          const canUploadStageDoc = canUpload() && (!inactiveProject || currentUser?.role === 'superadmin') && (!isLocked || hasTemporaryStageAccess(stage, 'upload')) && canActOnThisDocument;
          const actBtnDesktop = has ? `<button disabled class="${btnClass} border px-3 py-1.5 rounded-lg text-sm font-bold cursor-not-allowed flex items-center gap-1">${btnLabel}</button>` : (isNotRequired ? '' : (canUploadStageDoc ? `<button data-name="${esc(d.document_type_name)}" onclick="openUp(${d.id}, this.dataset.name)" class="bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950 hover:bg-cyan-900 dark:hover:bg-cyan-400 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">Upload</button>` : ''));
          const reqBtnDesktop = '';
          const delBtnDesktop = canDeleteDocument && has ? `<button onclick="openConfirmModal('Delete file?',()=>delFile(${d.id}))" class="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center" title="Delete file">${svgDelete}</button>` : (canManageStageDoc && stage === 'Monitoring' ? `<button onclick="openConfirmModal('Delete monitoring document?',()=>delMonitoringDoc(${d.id}))" class="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center">${svgDelete}</button>` : '');
          const rowTone = isNotRequired ? 'bg-slate-50/60 dark:bg-slate-900/20 opacity-80' : (isOverdue ? 'bg-red-50/60 dark:bg-red-900/10' : (assignedToMe ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : (!d.assigned_user_id ? 'bg-gray-50/50 dark:bg-gray-900/40' : '')));
          h+=`<tr id="document-row-${d.id}" data-doc-id="${d.id}" oncontextmenu="return openDocumentRequirementContextMenu(event, ${d.id})" class="${rowTone} hover:bg-gray-50 dark:hover:bg-gray-800/70 transition group align-middle"><td class="px-4 py-4 font-bold text-gray-950 dark:text-gray-50 group-hover:text-cyan-800 dark:group-hover:text-cyan-300 overflow-hidden"><div class="flex items-center gap-2 min-w-0"><span class="min-w-0 break-words">${esc(d.document_type_name)}</span>${documentRemarkIndicatorHtml(d)}</div></td><td class="px-4 py-4 overflow-hidden">${ownerControl}</td><td class="px-4 py-4 overflow-hidden">${f}</td><td class="px-4 py-4 text-xs">${documentDateHtml}</td><td class="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">${has?fmtDateTime(d.upload_date):'-'}</td><td class="px-4 py-4 text-xs">${dueHtml}</td><td class="px-4 py-4">${desktopStatusBadge}</td><td class="px-4 py-4 text-center align-middle"><div class="flex justify-center items-center gap-2">${actBtnDesktop}${reqBtnDesktop}${delBtnDesktop}</div></td></tr>`;
          let mobileBadge = `<span class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass}">${statusLabel}</span>`;
          if (!has && canManageStageDoc) {
            mobileBadge = `<span data-requirement-state="${esc(requirementState)}" data-has-file="0" onclick="toggleRequirementState(${d.id}, this)" class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} cursor-pointer select-none" title="${requirementState === 'Required' ? 'Tap to choose Optional or Not Required' : 'Tap to make required again'}">${statusLabel}</span>`;
          } else if (has && !isNotRequired) {
            const onclick = canStatusStageDoc ? `data-status="${d.status}" onclick="toggleStatus(${d.id}, this)"` : '';
            const cursor = canStatusStageDoc ? 'cursor-pointer select-none' : 'cursor-default';
            mobileBadge = `<span ${onclick} class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} ${cursor}" title="Tap to toggle status">${statusLabel}</span>`;
          } else if (has && isNotRequired) {
            const canResetState = canResetUploadedNotRequired || canResetUploadedNotRequiredLocked;
            const onclick = canResetState ? `data-requirement-state="${esc(requirementState)}" data-has-file="1" onclick="toggleRequirementState(${d.id}, this)"` : '';
            const cursor = canResetState ? 'cursor-pointer select-none' : 'cursor-not-allowed opacity-80';
            mobileBadge = `<span ${onclick} class="text-xs px-2.5 py-1 rounded-full border font-bold ${statusClass} ${cursor}" title="${canResetState ? 'Tap to make required again' : 'Not Required'}">${statusLabel}</span>`;
          }
          const mobileUploadBtn = !has && !isNotRequired && canUploadStageDoc ? `<button data-name="${esc(d.document_type_name)}" onclick="openUp(${d.id}, this.dataset.name)" class="w-full bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950 font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-cyan-900 dark:hover:bg-cyan-400 shadow-sm">Upload File</button>` : '';
          const mobileReqBtn = '';
          const mobileManageBtn = canDeleteDocument && has ? `<div class="flex gap-2"><button disabled class="flex-1 ${btnClass} border font-bold text-sm px-4 py-2.5 rounded-lg cursor-not-allowed">${btnLabel}</button>${mobileReqBtn}<button onclick="openConfirmModal('Delete file?',()=>delFile(${d.id}))" class="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center" title="Delete file">${svgDelete}</button></div>` : (has ? `<div class="flex gap-2"><button disabled class="flex-1 ${btnClass} border font-bold text-sm px-4 py-2.5 rounded-lg cursor-not-allowed">${btnLabel}</button>${mobileReqBtn}</div>` : (canManageStageDoc && stage === 'Monitoring' ? `<div class="flex gap-2">${mobileUploadBtn}<button onclick="openConfirmModal('Delete monitoring document?',()=>delMonitoringDoc(${d.id}))" class="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center">${svgDelete}</button></div>` : ''));
          const mobileMissingAction = isNotRequired ? '' : mobileUploadBtn;
          const mobileEmptyAction = stage === 'Monitoring' && canManageStageDoc ? mobileManageBtn : mobileMissingAction;
          hm+=`<div id="document-row-${d.id}" data-doc-id="${d.id}" oncontextmenu="return openDocumentRequirementContextMenu(event, ${d.id})" onpointerdown="startDocumentRequirementLongPress(event, ${d.id})" onpointerup="cancelDocumentRequirementLongPress()" onpointercancel="cancelDocumentRequirementLongPress()" onpointerleave="cancelDocumentRequirementLongPress()" class="p-4 border-b border-gray-100 dark:border-gray-700 ${rowTone || 'bg-white dark:bg-gray-900'} hover:bg-gray-50 dark:hover:bg-gray-800 transition group">
            <div class="flex justify-between items-start mb-2">
              <div class="font-black text-gray-950 dark:text-gray-50 text-base flex-1 pr-2 group-hover:text-cyan-800 dark:group-hover:text-cyan-300 flex items-center gap-2 min-w-0"><span class="min-w-0">${esc(d.document_type_name)}</span>${documentRemarkIndicatorHtml(d)}</div>
              ${mobileBadge}
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <span class="text-gray-500 dark:text-gray-400">Status:</span>
                <span class="ml-1 font-medium">${statusLabel}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Due:</span>
                ${dueClickable ? `<button type="button" data-doc-id="${d.id}" data-due-at="${esc(d.due_at || '')}" data-doc-name="${esc(d.document_type_name)}" onclick="openDocumentDueDateFromButton(this)" class="ml-1 text-left ${isOverdue ? 'text-red-700 dark:text-red-300 font-black' : 'text-gray-700 dark:text-gray-200'} hover:text-blue-600">${dueAt ? fmtDueDate(dueAt) : 'Set due date'}</button>` : `<span class="ml-1 ${isOverdue ? 'text-red-700 dark:text-red-300 font-black' : 'text-gray-700 dark:text-gray-200'}">${dueAt ? fmtDueDate(dueAt) : '-'}</span>`}
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Document Date:</span>
                <span class="ml-1">${documentDateHtml}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Uploaded:</span>
                <span class="ml-1">${has?fmtDateTime(d.upload_date):'-'}</span>
              </div>
              <div class="col-span-2">
                <span class="text-gray-500 dark:text-gray-400">Assigned To:</span>
                <span class="ml-1">${ownerControl}</span>
              </div>
            </div>
            ${has ? `<button type="button" data-doc-id="${Number(d.id)}" data-file-name="${esc(d.file_name)}" onclick="openFileViewer(this.dataset.docId, this.dataset.fileName)" class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 cursor-pointer block truncate text-left max-w-full" title="${esc(d.file_name)}">${esc(d.file_name.length>30?d.file_name.slice(0,30)+'...':d.file_name)}</button>` : ''}
            <div class="mt-2">${has ? mobileManageBtn : mobileEmptyAction}</div>
          </div>`;
        });
        tb.innerHTML=h; tbMobile.innerHTML=hm;
      } catch(e){toast(e.message,'error');}
    }

    function setProjectLookupFieldsLocked(locked) {
      ['projType', 'projReq'].forEach(id => {
        const el = document.getElementById(id);
        el.disabled = locked;
        el.classList.toggle('bg-gray-100', locked);
        el.classList.toggle('text-gray-500', locked);
        el.title = locked ? 'Locked because this project already has uploaded files.' : '';
      });
    }

    function setProjectModalEditability(canEdit) {
      ['projName', 'projRequester', 'projBar', 'projDist', 'projType', 'projReq'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !canEdit;
        el.classList.toggle('bg-gray-100', !canEdit);
        el.classList.toggle('dark:bg-gray-800', !canEdit);
        el.classList.toggle('cursor-not-allowed', !canEdit);
      });
      document.getElementById('btnSubmitProj')?.classList.toggle('hidden', !canEdit);
    }

    function openCreateModal() { if (!requirePrivilege('create_project')) return; isEdit=false; document.getElementById('projectForm').reset(); setProjectModalEditability(true); setProjectLookupFieldsLocked(false); document.getElementById('modalTitle').textContent='New Project'; document.getElementById('btnSubmitProj').textContent='Create'; document.getElementById('btnDeleteModal').classList.add('hidden'); loadProjDropdowns(); document.getElementById('projectModal').classList.remove('hidden'); }
    async function confirmDeleteProject() {
      if (!requirePrivilege('delete_project')) return;
      const id = document.getElementById('projId').value;
      if (!id) return;
      let project = projCache.find(p => Number(p.id) === Number(id));
      if (!project) {
        await loadDash({ silent: true, preservePage: true }).catch(() => {});
        project = projCache.find(p => Number(p.id) === Number(id));
      }
      if (project && !canDeleteProjectRecord(project)) return toast('You cannot delete this project.', 'error');
      const hasUploadedFiles = (parseInt(project?.uploaded_files) || 0) > 0;
      if (hasUploadedFiles && currentUser?.role !== 'superadmin') {
        return toast('Only superadmin can delete a project with uploaded documents.', 'error');
      }
      if (!hasUploadedFiles) {
        return openConfirmModal('Delete this project?', async () => {
          await deleteProject(id);
        });
      }
      openConfirmModal('This project contains uploaded documents. Delete this project and all uploaded files?', () => {
        setTimeout(() => {
          openConfirmModal('Final confirmation: this will permanently delete the project record and uploaded documents. Continue?', async () => {
            await deleteProject(id, { confirmUploadedDelete: true });
          });
        }, 0);
      });
    }
    async function loadProjDropdowns() { const types = await fetchJson(`${API}/settings/project-types`); const reqs = await fetchJson(`${API}/settings/requestees`); const ts = document.getElementById('projType'), rs = document.getElementById('projReq'); ts.innerHTML='<option value="">Select Type</option>'; rs.innerHTML='<option value="">Select Requestee</option>'; types.forEach(t=>ts.innerHTML+=`<option value="${t.id}">${esc(t.name)}</option>`); reqs.forEach(r=>rs.innerHTML+=`<option value="${r.id}">${esc(r.name)}</option>`); }
    async function editProject(id) { if (!hasPrivilege('edit_project') && !hasPrivilege('delete_project')) return; const p = projCache.find(x=>x.id===id); if(!p) return; const canEditThisProject = hasPrivilege('edit_project') && canActOnAssignedItem(p); const canDeleteThisProject = canDeleteProjectRecord(p); if (!canEditThisProject && !canDeleteThisProject) return toast('This project is assigned to another user.', 'error'); isEdit=true; document.getElementById('modalTitle').textContent=canEditThisProject ? 'Edit Project' : 'Delete Project'; document.getElementById('btnSubmitProj').textContent='Save Changes'; document.getElementById('btnDeleteModal').classList.toggle('hidden', !canDeleteThisProject); await loadProjDropdowns(); document.getElementById('projId').value=p.id; document.getElementById('projName').value=p.name; document.getElementById('projRequester').value=p.requester; document.getElementById('projBar').value=p.barangay; document.getElementById('projDist').value=p.district; document.getElementById('projType').value=p.project_type_id; document.getElementById('projReq').value=p.requestee_id; setProjectLookupFieldsLocked(canEditThisProject && p.uploaded_files > 0); setProjectModalEditability(canEditThisProject); document.getElementById('projectModal').classList.remove('hidden'); }
    
    async function openEditFromDataset(btn) {
      const data = btn.dataset;
      const project = projCache.find(p => Number(p.id) === Number(data.id));
      const canEditThisProject = hasPrivilege('edit_project') && (!project || canActOnAssignedItem(project));
      const canDeleteThisProject = project && canDeleteProjectRecord(project);
      if (!canEditThisProject && !canDeleteThisProject) return toast('This project is assigned to another user.', 'error');
      await loadProjDropdowns();
      setProjectLookupFieldsLocked(canEditThisProject && data.hasUploadedFiles === '1');
      setProjectModalEditability(canEditThisProject);

      document.getElementById('projId').value = data.id;
      document.getElementById('projName').value = data.name;
      document.getElementById('projRequester').value = data.requester;
      document.getElementById('projType').value = data.type;
      document.getElementById('projReq').value = data.requestee;
      document.getElementById('projBar').value = data.barangay;
      document.getElementById('projDist').value = data.district;

      document.getElementById('modalTitle').textContent = canEditThisProject ? "Edit Project" : "Delete Project";
      document.getElementById('btnSubmitProj').textContent = "Update";
      document.getElementById('btnDeleteModal').classList.toggle('hidden', !canDeleteThisProject);

      isEdit = true;
      document.getElementById('projectModal').classList.remove('hidden');
    }

    document.getElementById('projectForm').onsubmit = async (e) => {
      if (!requirePrivilege(isEdit ? 'edit_project' : 'create_project')) return;
      e.preventDefault();
      const btn=document.getElementById('btnSubmitProj');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Processing...';
      const data={name:e.target.name.value, requester:e.target.requester.value, barangay:e.target.barangay.value, district:e.target.district.value, project_type_id:parseInt(e.target.project_type_id.value), requestee_id:parseInt(e.target.requestee_id.value)};
      try {
        if(isEdit) {
          const project = projCache.find(p => Number(p.id) === Number(e.target.id.value));
          if (project && !canActOnAssignedItem(project)) return toast('This project is assigned to another user.', 'error');
          await fetchJson(`${API}/projects/${e.target.id.value}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
          toast('Updated');
          closeModal('projectModal');
          await refreshAfterMutation({ projectId: e.target.id.value });
        } else {
          pendingProjectCreateData = data;
          const dupes = await fetchJson(`${API}/projects/duplicate-check`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
          if (dupes.length) {
            const rows = dupes.map(d => `<div class="p-2 border-b border-gray-100 dark:border-gray-700"><div class="font-bold">${esc(d.name)}</div><div class="text-xs">${esc(d.requester || '-')} - ${esc(formatProjectLocation(d))} - ${esc(d.stage || '-')} - ${esc(d.status || '-')} - ${fmtDateTime(d.created_at)}</div></div>`).join('');
            openConfirmModal(`<div class="space-y-2"><div class="font-bold">Possible duplicate projects found.</div>${rows}<div class="text-sm">Continue creating this project?</div></div>`, async () => createProjectAfterDuplicateCheck(true));
          } else {
            await createProjectAfterDuplicateCheck(false);
          }
        }
      } catch(err) { toast(err.message, 'error'); }
      finally { btn.disabled=false; btn.innerHTML=isEdit?'Save Changes':'Create'; }
    };

    async function createProjectAfterDuplicateCheck(duplicateConfirmed = false) {
      const data = pendingProjectCreateData;
      if (!data) return;
      if (duplicateConfirmed && !hasPrivilege('confirm_duplicate_project_creation')) return toast('Permission denied: confirm_duplicate_project_creation', 'error');
      const result = await fetchJson(`${API}/projects`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(duplicateConfirmed ? { ...data, duplicate_confirmed: true } : data)});
      toast('Created');
      closeModal('projectModal');
      pendingProjectCreateData = null;
      await refreshAfterMutation({ projectId: result.id, refreshDetails: false });
      const newProject = projCache.find(p => Number(p.id) === Number(result.id)) || projCache.find(p => p.name === data.name && p.requester === data.requester);
      if (newProject) await showDetails(newProject.id, 'Proposal');
    }
    async function deleteProject(id, options = {}) {
      if (!requirePrivilege('delete_project')) return;
      const deleteUrl = `${API}/projects/${id}${options.confirmUploadedDelete ? '?confirm_uploaded_delete=true' : ''}`;
      try {
        const result = await fetchJson(deleteUrl, { method:'DELETE' });
        if (result?.pending_approval) {
          toast(result.existing ? 'A deletion request is already pending.' : 'Deletion request sent for owner confirmation.');
          await loadNotifications(notificationsLimit);
          return;
        }
        const deletedCurrentProject = Number(currentProjId) === Number(id);
        closeModal('projectModal');
        if (deletedCurrentProject) {
          currentProjId = null;
          await showDashboard(false);
        }
        await refreshAfterMutation({ projectId: id, refreshDetails: false });
        toast('Project deleted');
      } catch(e) { toast(e.message,'error'); }
    }
    
    function uploadFileExtension(fileName = '') {
        const dot = String(fileName).lastIndexOf('.');
        return dot >= 0 ? String(fileName).slice(dot).toLowerCase() : '';
    }

    function validateUploadFile(file) {
        if (!file) return 'Please choose a file to upload.';
        if (!UPLOAD_ALLOWED_EXTENSIONS.includes(uploadFileExtension(file.name))) {
            return 'Invalid file type. Allowed files: PDF, JPG/JPEG, and PNG only.';
        }
        if (file.size > UPLOAD_MAX_FILE_SIZE) {
            return 'File too large. Maximum size is 50MB.';
        }
        return '';
    }

    function updateUploadDropZoneState({ dragging = false, uploading = false } = {}) {
        const dropZone = document.getElementById('uploadDropZone');
        const dropText = document.getElementById('uploadDropText');
        if (!dropZone || !dropText) return;
        dropZone.classList.toggle('border-cyan-500', dragging || uploading);
        dropZone.classList.toggle('bg-cyan-50', dragging || uploading);
        dropZone.classList.toggle('dark:bg-cyan-950/20', dragging || uploading);
        dropZone.classList.toggle('opacity-70', uploading);
        dropZone.classList.toggle('cursor-not-allowed', uploading);
        dropZone.setAttribute('aria-disabled', uploading ? 'true' : 'false');
        dropText.textContent = uploading ? 'Uploading...' : 'Drag and drop file here, or click to browse';
    }

    function setUploadSelectedFile(file) {
        const input = document.getElementById('uploadFile');
        const selected = document.getElementById('uploadSelectedFile');
        if (!input || !selected) return false;
        const error = validateUploadFile(file);
        if (error) {
            selectedUploadFile = null;
            input.value = '';
            selected.classList.add('hidden');
            selected.textContent = '';
            toast(error, 'error');
            return false;
        }
        selectedUploadFile = file;
        try {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
        } catch (e) {}
        selected.textContent = `Selected file: ${file.name}`;
        selected.classList.remove('hidden');
        return true;
    }

    function resetUploadDropZone() {
        selectedUploadFile = null;
        const input = document.getElementById('uploadFile');
        const selected = document.getElementById('uploadSelectedFile');
        if (input) input.value = '';
        if (selected) {
            selected.classList.add('hidden');
            selected.textContent = '';
        }
        updateUploadDropZoneState();
    }

    function openUp(id, name) { 
        if (!canUpload()) return toast('You do not have permission to upload documents.', 'error');
        document.querySelector('#uploadForm [name="docId"]').value=id; 
        document.getElementById('uploadDocType').value=name; 
        resetUploadDropZone();
        document.getElementById('uploadModal').classList.remove('hidden'); 
    }
    
    // New functions for Edit Due Schedule Modal
    let currentEditDocTypeId = null;
    let currentEditDocTypeCategory = 'Proposal';
    
    window.openEditDueScheduleModal = async function(docTypeId) {
        currentEditDocTypeId = docTypeId;
        try {
            const data = (window.dueScheduleDocTypesCache || []).length ? window.dueScheduleDocTypesCache : await fetchJson(`${API}/settings/document-types`);
            const item = data.find(d => d.id === docTypeId);
            if (!item) {
                toast('Document type not found', 'error');
                return;
            }
            
            document.getElementById('editDueScheduleId').value = item.id;
            currentEditDocTypeCategory = item.category || 'Proposal';
            document.getElementById('editDueScheduleDocName').textContent = item.name;
            document.getElementById('editDueDays').value = item.due_days || 0;
            document.getElementById('editDueHours').value = item.due_hours || 0;
            
            // Set trigger type
            if (item.start_from_document_upload && item.document_type_start_point) {
                document.getElementById('triggerDocument').checked = true;
                document.getElementById('selectedTriggerDocId').value = item.document_type_start_point;
                document.getElementById('selectedTriggerDocLabel').textContent = item.start_doc_name || 'Document';
                document.getElementById('triggerDocumentSelectorContainer').classList.remove('hidden');
            } else {
                document.getElementById('triggerProject').checked = true;
                document.getElementById('selectedTriggerDocId').value = '';
                document.getElementById('selectedTriggerDocLabel').textContent = 'Click to select a document type';
                document.getElementById('triggerDocumentSelectorContainer').classList.add('hidden');
            }
            
            document.getElementById('editDueScheduleModal').classList.remove('hidden');
        } catch (e) {
            toast(e.message, 'error');
        }
    };
    
    window.toggleTriggerDocumentSelector = function(show) {
        const container = document.getElementById('triggerDocumentSelectorContainer');
        if (show) {
            container.classList.remove('hidden');
            // Load document types for the dropdown
            loadTriggerDocTypes();
        } else {
            container.classList.add('hidden');
            document.getElementById('selectedTriggerDocId').value = '';
            document.getElementById('selectedTriggerDocLabel').textContent = 'Click to select a document type';
            closeTriggerDocDropdown();
        }
    };
    
    // New inline dropdown functions for trigger document selection
    window.toggleTriggerDocDropdown = async function() {
        const panel = document.getElementById('triggerDocDropdownPanel');
        const arrow = document.getElementById('triggerDocDropdownArrow');
        
        if (panel.classList.contains('hidden')) {
            await loadTriggerDocTypes();
            panel.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
            document.getElementById('triggerDocSearchInput').focus();
        } else {
            closeTriggerDocDropdown();
        }
    };
    
    window.closeTriggerDocDropdown = function() {
        const panel = document.getElementById('triggerDocDropdownPanel');
        const arrow = document.getElementById('triggerDocDropdownArrow');
        panel.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    };
    
    window.loadTriggerDocTypes = async function() {
        try {
            const excludeId = currentEditDocTypeId;
            const params = new URLSearchParams({ excludeId, category: currentEditDocTypeCategory || 'Proposal' });
            let data = await fetchJson(`${API}/document-types/for-selector?${params.toString()}`);
            if (currentDueScheduleDocTypeIds.length) {
                const allowed = new Set(currentDueScheduleDocTypeIds.map(Number));
                data = data.filter(item => allowed.has(Number(item.id)));
            }
            const list = document.getElementById('triggerDocTypeList');
            list.innerHTML = '';
            
            if (data.length === 0) {
                list.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">No document types available</div>';
            } else {
                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition flex items-center justify-between group';
                    div.dataset.id = item.id;
                    div.dataset.name = item.name;
                    div.onclick = () => selectTriggerDocumentInline(item.id, item.name);
                    div.innerHTML = `
                        <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 text-sm">${esc(item.name)}</span>
                        <svg class="w-4 h-4 text-gray-300 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    `;
                    list.appendChild(div);
                });
            }
        } catch (e) {
            toast(e.message, 'error');
        }
    };
    
    window.filterTriggerDocTypes = function() {
        const search = document.getElementById('triggerDocSearchInput').value.toLowerCase();
        const items = document.querySelectorAll('#triggerDocTypeList > div');
        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            item.style.display = name.includes(search) ? '' : 'none';
        });
    };
    
    window.selectTriggerDocumentInline = function(triggerDocId, triggerDocName) {
        document.getElementById('selectedTriggerDocId').value = triggerDocId;
        document.getElementById('selectedTriggerDocLabel').textContent = triggerDocName;
        closeTriggerDocDropdown();
        toast(`Will start from "${triggerDocName}" upload`);
    };
    
    window.saveEditDueSchedule = async function() {
        const docId = document.getElementById('editDueScheduleId').value;
        if (!loadedRequirementSetForDueSchedules?.requirementSetId) {
            toast('Load a requirement set first.', 'error');
            return;
        }
        const dueDays = Math.max(0, parseInt(document.getElementById('editDueDays').value || '0', 10) || 0);
        const dueHours = Math.max(0, parseInt(document.getElementById('editDueHours').value || '0', 10) || 0);
        
        const isDocumentTrigger = document.getElementById('triggerDocument').checked;
        const documentTypeStartPoint = isDocumentTrigger ? parseInt(document.getElementById('selectedTriggerDocId').value || '0', 10) || 0 : 0;
        const startFromUpload = isDocumentTrigger && documentTypeStartPoint > 0 ? 1 : 0;
        
        // Validate: prevent circular dependency
        if (documentTypeStartPoint && parseInt(documentTypeStartPoint) === parseInt(docId)) {
            toast('A document type cannot depend on itself.', 'error');
            return;
        }
        
        try {
            const result = await fetchJson(`${API}/settings/document-type/${docId}/due-schedule`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    due_days: dueDays,
                    due_hours: dueHours,
                    document_type_start_point: documentTypeStartPoint,
                    start_from_document_upload: startFromUpload,
                    requirement_set_id: loadedRequirementSetForDueSchedules?.requirementSetId
                })
            });
            if (result?.pending_approval) {
                toast(result.message || 'Configuration change request submitted for Direct Superior approval.');
                closeModal('editDueScheduleModal');
                await loadDueScheduleRequirementSet();
                await loadNotifications(notificationsLimit);
                return;
            }
            toast('Due schedule updated');
            closeModal('editDueScheduleModal');
            await loadDueScheduleRequirementSet();
            await refreshAfterMutation({ refreshNotifications: false });
        } catch (e) {
            toast(e.message, 'error');
        }
    };
    
    function updateProjectDocumentationButtons() {
      const actions = document.getElementById('projectDocumentationActions');
      if (!actions) return;
      const canUpload = canUploadProjectDocumentation();
      const canView = canViewProjectDocumentation();
      actions.classList.toggle('hidden', !canUpload);
      document.getElementById('uploadDocumentationBtn')?.classList.toggle('hidden', !canUpload);
      const stage = currentProjectDocumentationStage();
      const count = Number(projectDocumentationCounts[stage] || 0);
      const button = document.getElementById('viewDocumentationBtn');
      if (button) {
        button.disabled = !canView || count === 0;
        button.className = 'w-full justify-center px-4 py-2.5 rounded-lg transition font-bold flex items-center gap-2 ' + (button.disabled
          ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          : 'bg-cyan-700 dark:bg-cyan-500 text-white dark:text-gray-950 hover:bg-cyan-800 dark:hover:bg-cyan-400 shadow-md hover:shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2');
        button.classList.toggle('hidden', !canView);
        button.title = count ? `View ${stage} photos and videos` : `No documentation uploaded for ${stage}`;
      }
      const label = document.getElementById('viewDocumentationBtnLabel');
      if (label) label.textContent = `View Documentation (${count})`;
    }

    async function refreshProjectDocumentationCounts(options = {}) {
      const projectId = currentProjId;
      if (!currentProjId || !canViewProjectDocumentation()) {
        projectDocumentationCounts = { Proposal: 0, Implementation: 0, Monitoring: 0, Completed: 0 };
        updateProjectDocumentationButtons();
        return;
      }
      try {
        const counts = await fetchJson(`${API}/projects/${projectId}/documentation/counts`, options.silent ? { silentLoading: true } : {});
        if (Number(projectId) !== Number(currentProjId)) return;
        projectDocumentationCounts = { Proposal: 0, Implementation: 0, Monitoring: 0, Completed: 0, ...(counts || {}) };
      } catch (e) {
        if (Number(projectId) !== Number(currentProjId)) return;
        projectDocumentationCounts = { Proposal: 0, Implementation: 0, Monitoring: 0, Completed: 0 };
      }
      updateProjectDocumentationButtons();
    }

    function projectDocumentationExt(name = '') {
      const dot = String(name).lastIndexOf('.');
      return dot >= 0 ? String(name).slice(dot).toLowerCase() : '';
    }

    function projectDocumentationFileType(file) {
      const ext = projectDocumentationExt(file?.name || '');
      if (PROJECT_DOCUMENTATION_PHOTO_EXTENSIONS.includes(ext)) return 'photo';
      if (PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS.includes(ext)) return 'video';
      return '';
    }

    function validateProjectDocumentationFiles(files = []) {
      if (!files.length) return 'Select at least one file.';
      if (files.length > 20) return 'Maximum 20 files per upload batch.';
      for (const file of files) {
        const type = projectDocumentationFileType(file);
        if (!type) return `Unsupported file type: ${file.name}`;
        if (type === 'photo' && file.size > 25 * 1024 * 1024) return `Photo exceeds 25 MB: ${file.name}`;
        if (type === 'video' && file.size > 500 * 1024 * 1024) return `Video exceeds 500 MB: ${file.name}`;
      }
      return '';
    }

    function renderProjectDocumentationSelectedFiles() {
      const target = document.getElementById('projectDocumentationSelectedFiles');
      if (!target) return;
      if (!projectDocumentationSelectedFiles.length) {
        target.innerHTML = '<div class="text-xs text-gray-500 dark:text-gray-400">No files selected.</div>';
        return;
      }
      target.innerHTML = projectDocumentationSelectedFiles.map((file, index) => {
        const type = projectDocumentationFileType(file) || 'file';
        return `<div class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
          <div class="min-w-0">
            <div class="font-bold text-gray-900 dark:text-gray-100 truncate">${esc(file.name)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${esc(type)} - ${formatBytes(file.size || 0)}</div>
          </div>
          <button type="button" onclick="removeProjectDocumentationSelectedFile(${index})" class="px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold">Remove</button>
        </div>`;
      }).join('');
    }

    function removeProjectDocumentationSelectedFile(index) {
      projectDocumentationSelectedFiles.splice(Number(index), 1);
      renderProjectDocumentationSelectedFiles();
    }

    function setProjectDocumentationSelectedFiles(fileList) {
      projectDocumentationSelectedFiles = Array.from(fileList || []);
      const error = validateProjectDocumentationFiles(projectDocumentationSelectedFiles);
      if (error) {
        toast(error, 'error');
        projectDocumentationSelectedFiles = [];
      }
      renderProjectDocumentationSelectedFiles();
    }

    function setupProjectDocumentationDropZone() {
      if (projectDocumentationDropZoneReady) return;
      const zone = document.getElementById('projectDocumentationDropZone');
      const input = document.getElementById('projectDocumentationFiles');
      if (!zone || !input) return;
      projectDocumentationDropZoneReady = true;
      const openPicker = () => input.click();
      zone.addEventListener('click', openPicker);
      zone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      });
      input.addEventListener('change', () => setProjectDocumentationSelectedFiles(input.files));
      ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.add('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
      }));
      ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.remove('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
      }));
      zone.addEventListener('drop', event => setProjectDocumentationSelectedFiles(event.dataTransfer?.files || []));
    }

    function openProjectDocumentationUploadModal() {
      if (!currentProjId || !canUploadProjectDocumentation()) return toast('Permission denied: upload_project_documentation', 'error');
      const stage = currentProjectDocumentationStage();
      setupProjectDocumentationDropZone();
      projectDocumentationSelectedFiles = [];
      document.getElementById('projectDocumentationFiles').value = '';
      document.getElementById('projectDocumentationStage').value = stage;
      document.getElementById('projectDocumentationStageDisplay').value = stage;
      document.getElementById('projectDocumentationUploadTitle').textContent = `Upload ${stage} Documentation`;
      document.getElementById('projectDocumentationUploadSubtitle').textContent = 'Upload project photos and videos used as field documentation/evidence.';
      document.getElementById('projectDocumentationCategory').value = projectDocumentationCategoryForStage(stage);
      document.getElementById('projectDocumentationCaption').value = '';
      document.getElementById('projectDocumentationUploadProgress').classList.add('hidden');
      document.getElementById('projectDocumentationUploadSubmit').disabled = false;
      renderProjectDocumentationSelectedFiles();
      document.getElementById('projectDocumentationUploadModal').classList.remove('hidden');
    }

    function uploadProjectDocumentation(url, form) {
      const bar = document.getElementById('projectDocumentationUploadProgressBar');
      const label = document.getElementById('projectDocumentationUploadProgressText');
      bar.style.width = '0%';
      bar.setAttribute('aria-valuenow', '0');
      label.textContent = '0%';
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const requestAuthToken = authToken;
        xhr.open('POST', url);
        if (requestAuthToken) xhr.setRequestHeader('Authorization', `Bearer ${requestAuthToken}`);
        xhr.upload.onprogress = event => {
          if (!event.lengthComputable || !event.total) {
            bar.removeAttribute('aria-valuenow');
            label.textContent = `${formatBytes(event.loaded)} uploaded`;
            return;
          }
          const percent = Math.min(100, Math.floor(event.loaded / event.total * 100));
          bar.style.width = `${percent}%`;
          bar.setAttribute('aria-valuenow', String(percent));
          label.textContent = `${percent}%`;
        };
        xhr.upload.onload = () => {
          bar.style.width = '100%';
          bar.setAttribute('aria-valuenow', '100');
          label.textContent = '100% — Saving documentation...';
        };
        xhr.onload = () => {
          let data;
          try { data = JSON.parse(xhr.responseText); }
          catch { return reject(new Error('Invalid upload response. Please refresh to check whether the files were saved.')); }
          if (xhr.status === 401 && requestAuthToken && requestAuthToken === authToken) handleServerSessionUnauthorized(data.code);
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(data.error || 'Upload failed'));
          schedulePostMutationRefresh(url);
          resolve(data);
        };
        xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.send(form);
      });
    }

    document.getElementById('projectDocumentationUploadForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentProjId) return;
      const error = validateProjectDocumentationFiles(projectDocumentationSelectedFiles);
      if (error) return toast(error, 'error');
      const stage = document.getElementById('projectDocumentationStage').value || currentProjectDocumentationStage();
      const form = new FormData();
      form.append('stage', stage);
      form.append('category', document.getElementById('projectDocumentationCategory').value || 'Others');
      form.append('caption', document.getElementById('projectDocumentationCaption').value || '');
      projectDocumentationSelectedFiles.forEach(file => form.append('files', file));
      const progress = document.getElementById('projectDocumentationUploadProgress');
      const submit = document.getElementById('projectDocumentationUploadSubmit');
      progress.classList.remove('hidden');
      submit.disabled = true;
      try {
        const result = await uploadProjectDocumentation(`${API}/projects/${currentProjId}/documentation`, form);
        toast(`Uploaded ${result.uploaded?.length || projectDocumentationSelectedFiles.length} documentation file(s)`);
        closeModal('projectDocumentationUploadModal');
        projectDocumentationSelectedFiles = [];
        await refreshProjectDocumentationCounts({ silent: true });
        if (!document.getElementById('projectDocumentationViewerModal')?.classList.contains('hidden')) await loadProjectDocumentationViewer();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        submit.disabled = false;
        progress.classList.add('hidden');
      }
    });

    async function openProjectDocumentationViewer(stage = currentProjectDocumentationStage()) {
      if (!currentProjId || !canViewProjectDocumentation()) return toast('Permission denied: view_project_documentation', 'error');
      projectDocumentationViewerStage = stage;
      document.getElementById('projectDocumentationMediaFilter').value = '';
      document.getElementById('projectDocumentationCategoryFilter').value = '';
      document.getElementById('projectDocumentationViewerModal').classList.remove('hidden');
      await loadProjectDocumentationViewer();
    }

    async function loadProjectDocumentationViewer() {
      if (!currentProjId) return;
      const stage = projectDocumentationViewerStage || currentProjectDocumentationStage();
      document.getElementById('projectDocumentationViewerTitle').textContent = `${stage} Documentation`;
      document.getElementById('projectDocumentationViewerSubtitle').textContent = 'Photos and videos for this project stage.';
      const gallery = document.getElementById('projectDocumentationGallery');
      gallery.innerHTML = '<div class="h-full min-h-[260px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"><span class="spinner mr-2"></span> Loading documentation...</div>';
      try {
        const mediaType = document.getElementById('projectDocumentationMediaFilter').value;
        const category = document.getElementById('projectDocumentationCategoryFilter').value;
        const params = new URLSearchParams({ stage });
        if (mediaType) params.set('media_type', mediaType);
        if (category) params.set('category', category);
        const data = await fetchJson(`${API}/projects/${currentProjId}/documentation?${params.toString()}`, { silentLoading: true });
        renderProjectDocumentationGallery(data.files || []);
      } catch (e) {
        gallery.innerHTML = `<div class="p-6 text-center text-sm text-red-600 dark:text-red-300">${esc(e.message || 'Failed to load documentation.')}</div>`;
      }
    }

    function canDeleteProjectDocumentationFile(file = {}) {
      if (currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || hasPrivilege('delete_project_documentation')) return true;
      const project = projCache.find(p => Number(p.id) === Number(file.project_id || currentProjId));
      return Number(file.uploaded_by_user_id || 0) === Number(currentUser?.id || 0) || Number(project?.assigned_user_id || 0) === Number(currentUser?.id || 0);
    }

    function projectDocumentationProtectedUrl(url = '') {
      if (!authToken) return url;
      const separator = String(url).includes('?') ? '&' : '?';
      return `${url}${separator}token=${encodeURIComponent(authToken)}`;
    }

    function renderProjectDocumentationGallery(files = []) {
      const gallery = document.getElementById('projectDocumentationGallery');
      if (!files.length) {
        gallery.innerHTML = '<div class="h-full min-h-[260px] flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">No documentation files for this stage yet.</div>';
        return;
      }
      gallery.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">${files.map(file => {
        const isVideo = file.media_type === 'video';
        const viewUrl = projectDocumentationProtectedUrl(file.view_url);
        const downloadUrl = projectDocumentationProtectedUrl(file.download_url);
        const preview = isVideo
          ? `<video src="${esc(viewUrl)}" class="w-full h-44 object-cover bg-black" muted preload="metadata"></video>`
          : `<img src="${esc(viewUrl)}" alt="${esc(file.original_name)}" class="w-full h-44 object-cover bg-gray-100 dark:bg-gray-800">`;
        const deleteBtn = canDeleteProjectDocumentationFile(file) ? `<button type="button" onclick="confirmDeleteProjectDocumentation(${Number(file.id)})" class="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 text-xs font-bold">Delete</button>` : '';
        return `<article class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <button type="button" data-media-type="${esc(file.media_type)}" data-url="${esc(viewUrl)}" data-name="${esc(file.original_name)}" onclick="openProjectDocumentationPreviewFromButton(this)" class="block w-full text-left">${preview}</button>
          <div class="p-3 space-y-2">
            <div class="font-black text-sm text-gray-900 dark:text-gray-100 break-words">${esc(file.original_name)}</div>
            <div class="flex flex-wrap gap-1.5 text-[11px] font-bold">
              <span class="px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/30">${esc(file.media_type || '-')}</span>
              <span class="px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">${esc(file.category || 'Others')}</span>
            </div>
            ${file.caption ? `<p class="text-xs text-gray-600 dark:text-gray-300 break-words">${esc(file.caption)}</p>` : ''}
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div>Uploaded by<br><strong class="text-gray-700 dark:text-gray-200">${esc(file.uploaded_by_username || '-')}</strong></div>
              <div>Size<br><strong class="text-gray-700 dark:text-gray-200">${formatBytes(file.file_size || 0)}</strong></div>
              <div class="col-span-2">Date<br><strong class="text-gray-700 dark:text-gray-200">${fmtDateTime(file.uploaded_at)}</strong></div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-2">
              <button type="button" data-media-type="${esc(file.media_type)}" data-url="${esc(viewUrl)}" data-name="${esc(file.original_name)}" onclick="openProjectDocumentationPreviewFromButton(this)" class="px-3 py-1.5 rounded-lg bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950 text-xs font-bold">View</button>
              <button type="button" data-download-url="${esc(downloadUrl)}" onclick="downloadProjectDocumentationFromButton(this)" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold">Download</button>
              ${deleteBtn || '<span></span>'}
            </div>
          </div>
        </article>`;
      }).join('')}</div>`;
    }

    function openProjectDocumentationPreviewFromButton(button) {
      openProjectDocumentationPreview(button.dataset.mediaType, button.dataset.url, button.dataset.name);
    }

    function openProjectDocumentationPreview(mediaType, url, name) {
      document.getElementById('projectDocumentationPreviewTitle').textContent = name || 'Documentation Preview';
      document.getElementById('projectDocumentationPreviewMeta').textContent = mediaType === 'video' ? 'Video preview' : 'Photo preview';
      document.getElementById('projectDocumentationPreviewBody').innerHTML = mediaType === 'video'
        ? `<video src="${esc(url)}" controls autoplay class="max-w-full max-h-[78vh] bg-black"></video>`
        : `<img src="${esc(url)}" alt="${esc(name)}" class="max-w-full max-h-[78vh] object-contain">`;
      document.getElementById('projectDocumentationPreviewModal').classList.remove('hidden');
    }

    function downloadProjectDocumentation(id) {
      const a = document.createElement('a');
      a.href = `${API}/project-documentation/${Number(id)}/download`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function downloadProjectDocumentationFromButton(button) {
      const a = document.createElement('a');
      a.href = button.dataset.downloadUrl || '#';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function confirmDeleteProjectDocumentation(id) {
      openConfirmModal('Delete this documentation file?', async () => {
        try {
          await fetchJson(`${API}/project-documentation/${Number(id)}`, { method: 'DELETE' });
          toast('Documentation deleted');
          await refreshProjectDocumentationCounts({ silent: true });
          await loadProjectDocumentationViewer();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    }

    function setupUploadDropZone() {
      const dropZone = document.getElementById('uploadDropZone');
      const input = document.getElementById('uploadFile');
      const modal = document.getElementById('uploadModal');
      if (!dropZone || !input || !modal) return;

      const openPicker = () => {
        if (uploadInProgress) return;
        if (!canUpload()) return toast('You do not have permission to upload documents.', 'error');
        input.click();
      };

      dropZone.addEventListener('click', openPicker);
      dropZone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      });
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (file) setUploadSelectedFile(file);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!uploadInProgress) updateUploadDropZoneState({ dragging: true });
        });
      });
      ['dragleave', 'dragend'].forEach(eventName => {
        dropZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          updateUploadDropZoneState();
        });
      });
      dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        updateUploadDropZoneState();
        if (uploadInProgress) return;
        if (!canUpload()) return toast('You do not have permission to upload documents.', 'error');
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return toast('No file was dropped.', 'error');
        if (files.length > 1) return toast('Please upload one file only.', 'error');
        setUploadSelectedFile(files[0]);
      });

      document.addEventListener('dragover', (event) => {
        if (!modal.classList.contains('hidden')) event.preventDefault();
      });
      document.addEventListener('drop', (event) => {
        if (!modal.classList.contains('hidden')) event.preventDefault();
      });
    }

    setupUploadDropZone();

    document.getElementById('uploadForm').onsubmit = async (e) => {
      e.preventDefault(); 
      const btn=document.getElementById('btnUpload'); 
      const input = document.getElementById('uploadFile');
      const file = selectedUploadFile || (input.files && input.files[0]);
      const id=e.target.docId.value;
      if (!id) return toast('No project/document selected.', 'error');
      const fileError = validateUploadFile(file);
      if (fileError) return toast(fileError, 'error');
      const fd=new FormData(); fd.append('file', file); 
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Uploading...';
      updateUploadDropZoneState({ uploading: true });
      uploadInProgress = true;
      try { 
          const result = await fetchJson(`${API}/documents/${id}/upload`, {method:'POST', body:fd}); 
          toast(result.geotag_map?.valid ? 'Uploaded; valid geotag photo will appear on Geotag Map after this document is checked' : 'Uploaded'); 
          closeModal('uploadModal'); 
          await refreshAfterMutation({ projectId: currentProjId, documentId: id, silent: false });
      } catch(err){ toast(err.message,'error'); } 
      finally { uploadInProgress = false; btn.disabled=false; btn.innerHTML='Upload'; updateUploadDropZoneState(); }
    };

    async function delFile(id) { 
        if (!requirePrivilege('delete_document')) return;
        try { 
            const result = await fetchJson(`${API}/documents/${id}/file`, {method:'DELETE'});
            if (result?.pending_approval) {
              toast(result.existing ? 'A deletion request is already pending.' : 'Deletion request sent for owner confirmation.');
              await loadNotifications(notificationsLimit);
              return;
            }
            toast('Deleted'); 
            await refreshAfterMutation({ projectId: currentProjId, documentId: id, silent: false });
        } catch(e){toast(e.message,'error');} 
    }

    function openMonitoringDocModal() {
        if (!requirePrivilege('manage_requirements')) return;
        const yearInput = document.getElementById('monitoringYear');
        const nameInput = document.getElementById('monitoringDocName');
        yearInput.value = new Date().getFullYear();
        nameInput.value = 'Monitoring Report';
        document.getElementById('monitoringDocModal').classList.remove('hidden');
    }

    document.getElementById('monitoringDocForm').onsubmit = async (e) => {
        if (!requirePrivilege('manage_requirements')) return;
        e.preventDefault();
        const btn = document.getElementById('btnMonitoringDoc');
        const data = {
            year: parseInt(document.getElementById('monitoringYear').value),
            name: document.getElementById('monitoringDocName').value.trim()
        };
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Adding...';
        try {
            await fetchJson(`${API}/projects/${currentProjId}/monitoring-documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
            toast('Monitoring document added');
            closeModal('monitoringDocModal');
            await refreshAfterMutation({ projectId: currentProjId, targetStage: 'Monitoring', silent: false });
        } catch(e) {
            toast(e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Add';
        }
    };

    async function delMonitoringDoc(id) {
        if (!requirePrivilege('manage_requirements')) return;
        try {
            await fetchJson(`${API}/documents/${id}`, {method:'DELETE'});
            toast('Deleted');
            await refreshAfterMutation({ projectId: currentProjId, documentId: id, targetStage: 'Monitoring', silent: false });
        } catch(e) {
            toast(e.message, 'error');
        }
    }

    async function reloadProjectRequirements() {
      if (!requirePrivilege('manage_requirements')) return;
      const p = projCache.find(x => x.id == currentProjId);
      if (!p) return;
      if (!['Proposal', 'Implementation'].includes(activeDetailStage) || (!reloadRequirementsOverrideEnabled && p.stage !== activeDetailStage)) {
        return toast('Reload Requirements is only available for the active Proposal or Implementation stage.', 'error');
      }
      openConfirmModal(`Reload requirements from the latest Requirements Config? This will update the current requirement list/order for this stage.${reloadRequirementsOverrideEnabled ? ' Uploaded files will be preserved.' : ' This is only allowed because no documents have been uploaded yet.'}`, async () => {
        try {
          await fetchJson(`${API}/projects/${currentProjId}/reload-requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: activeDetailStage }) });
          toast('Requirements reloaded');
          await refreshAfterMutation({ projectId: currentProjId, targetStage: activeDetailStage, silent: false });
        } catch(e) {
          toast(e.message, 'error');
        }
      });
    }

    const settingsSectionMeta = {
      'telegram-integration': {group:'Configuration',title:'Telegram Integration',subtitle:'Connect approved chats and send weather alerts through your Telegram bot.',access:'Privilege controlled'},
      'appearance': {
        group: 'My Account',
        title: 'Appearance',
        subtitle: 'Manage your profile avatar, theme, and account preferences.',
        access: 'Available'
      },
      'change-password': {
        group: 'My Account',
        title: 'Change Password',
        subtitle: 'Update your account password without changing your role or permissions.',
        access: 'Available'
      },
      'mobile-qr-login': {
        group: 'My Account',
        title: 'Mobile QR Login',
        subtitle: 'Generate a short-lived QR code for signing in to GeoCamera.',
        access: 'Available'
      },
      'changelog': {
        group: 'Administration',
        title: 'Changelog',
        subtitle: 'Review recent updates to ABEARC.',
        access: 'Available'
      },
      'project-types': {
        group: 'Configuration',
        title: 'Project Types',
        subtitle: 'Maintain the project type options used when creating and filtering projects.',
        access: 'Permission controlled'
      },
      'requestees': {
        group: 'Configuration',
        title: 'Requestees',
        subtitle: 'Maintain requestee offices and recipients used across project workflows.',
        access: 'Permission controlled'
      },
      'document-types': {
        group: 'Configuration',
        title: 'Document Types',
        subtitle: 'Maintain document requirement names, categories, and display order for Proposal and Implementation stages.',
        access: 'Permission controlled'
      },
      'document-due-schedules': {
        group: 'Configuration',
        title: 'Due Schedules',
        subtitle: 'Configure due schedules for documents included in the currently loaded requirement set.',
        access: 'Permission controlled'
      },
      'requirements': {
        group: 'Configuration',
        title: 'Requirements Config',
        subtitle: 'Build required document sets by project type, requestee, and stage.',
        access: 'Permission controlled'
      },
      'user-management': {
        group: 'Administration',
        title: 'Users and Privileges',
        subtitle: 'Manage accounts, roles, and access privileges.',
        access: 'Manage Users privilege'
      },
      'activity-logs': {
        group: 'Administration',
        title: 'Activity Logs',
        subtitle: 'Audit user actions, exports, uploads, and security events.',
        access: 'View Activity Logs privilege'
      },
      'workload-analytics': {
        group: 'Administration',
        title: 'Workload Analytics',
        subtitle: 'Review ownership distribution and assignment pressure.',
        access: 'Workload Analytics privilege'
      },
      'backup-restore': {
        group: 'Administration',
        title: 'Backup and Restore',
        subtitle: 'Create downloadable backups, restore ZIP backups, and manage backup history.',
        access: 'Manage Backups privilege'
      },
      'downloads-forms': {
        group: 'Documents',
        title: 'Forms & Tools',
        subtitle: 'View and download ABED-approved tools, forms, templates, checklists, guides, and utilities.',
        access: 'Available to authenticated users'
      },
      'pending-confirmations': {
        group: 'Administration',
        title: 'Pending Confirmations',
        subtitle: 'Approve or reject pending project disposition and close-project requests.',
        access: 'Approval privilege'
      },
      'config-import-export': {
        group: 'Administration',
        title: 'Config Import/Export',
        subtitle: 'Export or merge system configuration without changing projects or uploaded files.',
        access: 'Permission controlled'
      },
      'admin-maintenance': {
        group: 'Administration',
        title: 'Admin Maintenance',
        subtitle: 'Review storage, health checks, and safe maintenance actions.',
        access: 'Admin Maintenance privilege'
      }
    };

    const settingsSectionKeywords = {
      appearance: 'theme display dark light system branding logo header',
      'change-password': 'password account credential security',
      'mobile-qr-login': 'mobile qr login geocamera abearc account scan link',
      changelog: 'changelog release notes version updates feedback bug change improvement v1.49 september 2026 kml import export multiple polygons contour lines namria dtm elevation profile annotations coordinate search barangay district cpdo calendar quick filters dashboard pagination permissions reliability v1.48 august 2026 drone orthomap orthomosaic timeline time series compare playback geotiff terrain topography elevation overlays project document export download nas deployment v1.47 established asset monitoring inventory metrics inspection checklist machinery infrastructure irrigation facility vehicle print export geocam share qr saved badge sql upload reliability v1.46 shared map visibility project geotag automation keyboard live mydrive synchronization v1.45 monitoring registry visits tasks priority scheduling v1.44 geotag map auto sync persistent camera zoom bulk rename category download delete all confirmations davao zoning tiles boundary perimeter outside upload rejection opentopomap scale extent measure ruler fixed workspace sidebar uniform icons v1.43 geocam map layers offline terrain v1.42 geotag map naming v1.41 terminology v1.40 geocam send upload ui v1.39 destination selection v1.38 stamped photo enforcement v1.37 abearc map search fit bounds all results global dataset viewport adjust matching photos search filters no snap redundant reload v1.36 commercial grade abearc map ui ux evidence workspace command bar filter rail live results sync states photo list details drawer responsive mobile filter panel measurement controls operational redesign v1.35 geocam photo details effective zoning facing zone road capture details label metadata integration v1.34 abearc map measuring layer full height bottom clipping svg overlay canvas dimensions resize sync ruler v1.33 abearc map layers click only no hover focus open tray explicit toggle v1.32 abearc map edit modal category remarks system design responsive bottom sheet desktop dialog inline validation escape close v1.31 google maps style layers image tile overlaid caption horizontal thumbnail tray alt cluster explosion modifier release fixed viewport map page no scroll v1.30 abearc map persistent ctrl explosion pan rotate zoom refresh selected image google maps style layers thumbnail bottom left full page original photo preview escape close details v1.29 abearc map max zoom cluster explosion selected photo highlight yellow thumbnail empty map click zoom out ctrl release exploded selection v1.28 abearc map ctrl release unexplode animation exploded photo direction arrows compass bearing thumbnails reverse collapse v1.27 abearc map compass correct bearing arrows thumbnail direction map rotation rotate exploded photo arrows v1.26 abearc map pinned cluster explosion source marker hidden animated thumbnails white leader lines coordinate dots avoid line crossing stay exploded escape ctrl click collapse v1.25 abearc map bearing arrow thumbnail outline explosion each photo coordinate avoid occupied thumbnails hide removed original preview full tab detail thumbnail zoning recovery stamp remarks image metadata known zone names v1.24 abearc map clustered photo click continue zoom max zoom no cluster cap screen cluster source cluster close photo group v1.23 abearc map open original edit icon direct event listener zoning stamp remarks fallback ruler area label center closed polygon photo coordinate measure ctrl held explosion release collapse v1.22 abearc map cluster click zoom in ctrl click explode prevent zoom out clustered photo pins v1.21 abearc map live ruler draggable measure points double click delete point original viewer edit icons global handlers remarks geocam zoning stamp fallback bearing arrow no zoom cluster explode v1.20 abearc map details editable category remarks zoning location hide unhide original viewer bearing arrow age status ctrl cluster explosion ruler distance area v1.19 abearc map broken thumbnail image authenticated media token samsung gallery cluster stable mercator no shaking stacked photo badge v1.18 abearc map photo pins not visible deterministic screen clustering render markers loaded features v1.17 abearc map geocam style photo thumbnail pins latest image cluster count marker not circle map photo preview v1.16 abearc map failed to load map photos mapMediaGeoJsonFeature mapMediaPublicFields backend manifest map media model v1.15 geocam abearc map upload storeMapMediaUpload not defined backend manifest map media service v1.14 abearc map blank map area maplibre canvas basemap loading viewport height google terrain google satellite v1.13 geocam map upload error details multipart photo files field invalid map image v1.12 abearc map layer basemap google terrain google satellite v1.11 abearc map geocam direct upload map media clustering exploded photo groups leader lines location review thumbnails maplibre v1.10 requirements reload override admin v1.09 mobile upload geocam doc scanner abedocscan sync skip existing qr login v1.08 work assignment bulk assign for review direct superior calendar participant my drive shared folder folder download owner transfer configuration stale request ABEARC v1.07 v1.06 v1.05 v1.04 v1.03 v1.02 v1.01',
      'project-types': 'project types project type categories classification',
      requestees: 'requestees offices recipients requester requestee',
      'document-types': 'document types documents proposal implementation categories display order requirement names',
      requirements: 'requirements config requirement sets available docs project type requestee proposal implementation load requirements',
      'document-due-schedules': 'due schedules due days due hours start point working days requirement set proposal implementation documents',
      'user-management': 'users user management privileges roles accounts administration access',
      'activity-logs': 'activity logs audit actions exports uploads security today last 7 days last 30 days',
      'workload-analytics': 'workload analytics assignments ownership active task unassigned assigned review overdue due soon',
      'backup-restore': 'backup restore backups database uploads zip pre restore',
      'downloads-forms': 'forms and tools applications installers templates utilities apk exe msi zip upload archive download',
      'pending-confirmations': 'pending confirmations approvals project disposition close closure requests reject approve',
      'config-import-export': 'config import export configuration project types requestees document types requirement sets due schedules',
      'admin-maintenance': 'admin maintenance storage health cleanup logs system'
    };
