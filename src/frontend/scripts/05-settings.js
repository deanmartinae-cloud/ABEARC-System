
    function updateSettingsSectionHeader(section) {
      const meta = settingsSectionMeta[section] || settingsSectionMeta.appearance;
      const kicker = document.getElementById('settingsSectionKicker');
      const title = document.getElementById('settingsSectionTitle');
      const subtitle = document.getElementById('settingsSectionSubtitle');
      const access = document.getElementById('settingsSectionAccess');
      if (kicker) kicker.textContent = meta.group;
      if (title) title.textContent = meta.title;
      if (subtitle) subtitle.textContent = meta.subtitle;
      if (access) access.textContent = meta.access;
    }

    async function switchSettingsSection(section) {
      if (!restoringHistoryState && activeSettingsSection === 'requirements' && section !== 'requirements' && !(await confirmLeaveRequirementsConfig())) return;
      document.getElementById('settingsView')?.classList.toggle('settings-standalone-section', section === 'downloads-forms');
      // Check privilege for settings sections
      const sectionPrivileges = {
        'project-types': 'manage_project_types',
        'requestees': 'manage_requestees',
        'document-types': 'manage_document_types',
        'document-due-schedules': 'manage_due_schedules',
        'requirements': 'manage_requirements',
        'mobile-qr-login': null,
        'changelog': null,
        'user-management': 'manage_users',
        'activity-logs': 'view_activity_logs',
        'workload-analytics': 'view_workload_analytics',
        'backup-restore': 'manage_backups',
        'downloads-forms': null,
        'pending-confirmations': () => canUsePendingConfirmations(),
        'config-import-export': 'import_export_config',
        'admin-maintenance': 'manage_maintenance'
      };
      
      const requiredPrivilege = sectionPrivileges[section];
      if (typeof requiredPrivilege === 'function' && !requiredPrivilege()) {
        toast('Permission denied', 'error');
        return;
      }
      if (typeof requiredPrivilege === 'string' && requiredPrivilege && !hasPrivilege(requiredPrivilege)) {
        toast('Permission denied: ' + requiredPrivilege, 'error');
        return;
      }
      
      // Update sidebar navigation state
      activeSettingsSection = section;
      if (appCurrentView === 'settings' && !restoringHistoryState) replaceAppHistory('settings', { section });
      document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('text-indigo-600', 'dark:text-indigo-400', 'bg-indigo-50', 'dark:bg-indigo-900/20');
        item.classList.add('text-gray-700', 'dark:text-gray-300');
      });
      
      const activeNav = document.getElementById(`nav-${section}`);
      if (activeNav) {
        activeNav.classList.remove('text-gray-700', 'dark:text-gray-300');
        activeNav.classList.add('text-indigo-600', 'dark:text-indigo-400', 'bg-indigo-50', 'dark:bg-indigo-900/20');
      }
      updateSettingsSectionHeader(section);
      
      // Hide all content sections
      document.querySelectorAll('.settings-content').forEach(c => c.classList.add('hidden'));
      
      // Show selected content
      const contentEl = document.getElementById(`content-${section}`);
      if (contentEl) {
        contentEl.classList.remove('hidden');
      }
      
      // Load content based on section
      if (section === 'activity-logs') {
        loadActivityLogs();
      } else if (section === 'workload-analytics') {
        renderWorkloadAnalytics();
      } else if (section === 'backup-restore') {
        renderBackupRestore();
      } else if (section === 'downloads-forms') {
        renderDownloadsForms();
      } else if (section === 'changelog') {
        renderChangelog();
      } else if (section === 'pending-confirmations') {
        renderPendingConfirmations();
      } else if (section === 'config-import-export') {
        renderConfigImportExport();
      } else if (section === 'admin-maintenance') {
        renderAdminMaintenance();
      } else if (section === 'landing') {
        loadSettingsDashboard();
      } else if (section === 'appearance') {
        updateSettingsUserProfile();
      } else if (section === 'mobile-qr-login') {
        loadMobileQrLogin();
      } else {
        await renderSettingsTab(section);
      }
      
      // Close mobile drawer after selection (only on mobile)
      if (window.innerWidth < 768) {
        closeMobileSettingsDrawer();
      }
    }
    
    // Toggle mobile settings drawer
    function toggleMobileSettingsDrawer() {
      openMobileSettingsDrawer();
    }
    
    // Open mobile settings drawer
    function openMobileSettingsDrawer() {
      const drawer = document.getElementById('settingsDrawer');
      const overlay = document.getElementById('settingsDrawerOverlay');
      
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.classList.add('settings-drawer-open');
    }
    
    // Close mobile settings drawer
    function closeMobileSettingsDrawer() {
      const drawer = document.getElementById('settingsDrawer');
      const overlay = document.getElementById('settingsDrawerOverlay');
      
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.classList.remove('settings-drawer-open');
      clearOverlayHistoryMarker('settingsDrawer');
    }
    
    // Handle ESC key to close drawer
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeMobileSettingsDrawer();
      }
    });
    
    // Legacy function for backward compatibility
    function switchTab(t) {
      switchSettingsSection(t);
    }
    
    // Filter settings menu based on search
    function filterSettingsMenu() {
      const query = document.getElementById('settingsSearch').value.toLowerCase();
      const navItems = document.querySelectorAll('.settings-nav-item[data-group]');
      const groups = document.querySelectorAll('.settings-menu-group');
      const results = document.getElementById('settingsSearchResults');
      if (appCurrentView === 'settings' && !restoringHistoryState) replaceAppHistory('settings', { section: activeSettingsSection || 'appearance' });
      const searchable = Object.entries(settingsSectionMeta).filter(([id]) => id !== 'downloads-forms').map(([id, meta]) => ({
        id,
        text: `${meta.group} ${meta.title} ${meta.subtitle} ${id} ${settingsSectionKeywords[id] || ''}`.toLowerCase(),
        title: meta.title,
        group: meta.group
      })).filter(item => !query || item.text.includes(query));
      if (results) {
        results.innerHTML = query
          ? searchable.slice(0, 8).map(item => `<button onclick="switchSettingsSection('${item.id}')" class="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-gray-200 dark:border-gray-700 text-xs"><span class="font-bold text-gray-800 dark:text-gray-100">${esc(item.title)}</span><span class="block text-gray-500 dark:text-gray-400">${esc(item.group)}</span></button>`).join('') || '<div class="text-xs text-gray-500 px-2 py-1">No settings matches</div>'
          : '';
      }
      
      navItems.forEach(item => {
        const section = item.id?.replace('nav-', '');
        const meta = settingsSectionMeta[section];
        const text = `${item.textContent} ${meta?.subtitle || ''} ${section || ''}`.toLowerCase();
        const group = item.dataset.group;
        
        if (query === '' || text.includes(query)) {
          item.style.display = '';
          // Show parent group if item matches
          if (group) {
            groups.forEach(g => {
              if (g.dataset.group === group) g.style.display = '';
            });
          }
        } else {
          item.style.display = 'none';
        }
      });
      
      // Hide empty groups
      groups.forEach(group => {
        const visibleItems = group.parentElement.querySelectorAll(`.settings-nav-item[data-group="${group.dataset.group}"]:not([style*="display: none"])`);
        if (visibleItems.length === 0 && query !== '') {
          group.style.display = 'none';
        } else if (query === '') {
          group.style.display = '';
        }
      });
    }
    
    // Load settings dashboard overview
    async function loadSettingsDashboard() {
      try {
        // Fetch counts in parallel
        const canViewUserCount = isSuperAdmin();
        const [users, projects, documents] = await Promise.all([
          canViewUserCount ? fetchJson(`${API}/users`).catch(() => null) : Promise.resolve(null),
          fetchJson(`${API}/projects`).catch(() => []),
          fetchJson(`${API}/documents`).catch(() => [])
        ]);
        
        // Update dashboard cards
        document.getElementById('dashTotalUsers') && (document.getElementById('dashTotalUsers').textContent = Array.isArray(users) ? users.length : '-');
        document.getElementById('dashTotalProjects') && (document.getElementById('dashTotalProjects').textContent = projects.length || '-');
        document.getElementById('dashTotalDocuments') && (document.getElementById('dashTotalDocuments').textContent = documents.length || '-');
        
        const pendingReviews = documents.filter(d => d.status === 'For Review').length;
        document.getElementById('dashPendingReviews') && (document.getElementById('dashPendingReviews').textContent = pendingReviews || '-');
        
        // Count due documents (documents with due_date in next 7 days)
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueDocs = documents.filter(d => {
          const dueValue = d.due_at || d.due_date;
          if (!dueValue) return false;
          const dueDate = new Date(dueValue);
          return dueDate >= now && dueDate <= weekFromNow;
        }).length;
        document.getElementById('dashDueDocuments') && (document.getElementById('dashDueDocuments').textContent = dueDocs || '-');
        
        // Estimate requirement sets (count unique project type + requestee combinations)
        // This is a simplified estimate
        document.getElementById('dashRequirementSets') && (document.getElementById('dashRequirementSets').textContent = '-');
        document.getElementById('dashActiveSessions') && (document.getElementById('dashActiveSessions').textContent = '-');
        
      } catch (err) {
        console.error('Error loading dashboard:', err);
      }
    }

    function toggleSaveButton(hasChanges) {
      const btn = document.getElementById('saveRequirementsBtn');
      if (btn) {
        btn.disabled = !hasChanges;
      }
    }

    function syncConfigActionButtons() {
      const setBtn = document.getElementById('setConfigBtn');
      const bottomBtn = document.getElementById('saveRequirementsBtn');
      const hasChanges = configMode === 'edit' && hasUnsavedChanges();

      if (setBtn) {
        // Keep Set Requirements button for entering edit mode only
        setBtn.textContent = 'Set Requirements';
        setBtn.className = 'flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition flex items-center justify-center gap-2';
        setBtn.onclick = setConfig;
      }

      if (bottomBtn) {
        bottomBtn.disabled = !hasChanges;
      }
    }

    function renderRequirementsList(data, { editable, emptyMessage = 'No data available' } = {}) {
        const container = document.getElementById('reqList');
        if (!container) return;
        container.innerHTML = '';
        const savedLabel = document.getElementById('savedRequirementsCountLabel');
        if (savedLabel) {
            savedLabel.textContent = editable ? '' : `Saved Requirements Confirmed: ${data.length}`;
            savedLabel.classList.toggle('hidden', editable);
        }
        
        if (!data.length) {
            selectionOrder = [];
            container.innerHTML = `<li class="text-gray-500 text-center p-4 italic">${esc(emptyMessage)}</li>`;
            syncConfigActionButtons();
            return;
        }

        // Sort data by order_index to ensure proper numerical sequence display
        const sortedData = [...data].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

        // Update selectionOrder to match the sorted order for consistency
        selectionOrder = sortedData.map(item => item.id);

        sortedData.forEach(item => {
            const isSelected = selectionOrder.includes(item.id);
            const orderIndex = isSelected ? selectionOrder.indexOf(item.id) + 1 : null;

            const li = document.createElement('li');
            li.className = `flex items-center gap-3 p-3 border rounded-lg transition select-none ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`;
            
            li.onclick = (e) => { 
                if (configMode !== 'edit') return; 
                toggleConfigItem(item.id); 
            };
            
            let badgeHtml = orderIndex ? `<span class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">${orderIndex}</span>` : `<span class="bg-gray-200 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">-</span>`;
            
            if (editable) {
                li.innerHTML = `
                    <input type="checkbox" 
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer pointer-events-none" 
                        ${isSelected ? 'checked' : ''} 
                        onclick="event.stopPropagation(); toggleConfigItem(${item.id}, this)">
                    <span class="flex-1 font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}">${esc(item.name)}</span>
                    ${badgeHtml}
                `;
            } else {
                const order = item.order_index !== undefined ? item.order_index + 1 : '';
                li.innerHTML = `
                    <span class="flex-1 font-medium text-gray-800 dark:text-gray-200">${esc(item.name)}</span>
                    ${order ? `<span class="text-xs font-bold text-gray-400 dark:text-gray-500">#${order}</span>` : ''}
                `;
                li.style.cursor = 'default';
                li.classList.remove('hover:bg-gray-50');
            }
            
            container.appendChild(li);
        });
        syncConfigActionButtons();
    }

    function updateRequirementCountLabels(availableCount = 0, selectedCount = selectionOrder.length) {
        const availableLabel = document.getElementById('availableDocsCountLabel');
        const selectedLabel = document.getElementById('selectedRequirementsCountLabel');
        const savedLabel = document.getElementById('savedRequirementsCountLabel');
        const selectAllBtn = document.getElementById('selectAllAvailableDocsBtn');
        const removeAllBtn = document.getElementById('removeAllSelectedRequirementsBtn');
        if (availableLabel) {
            availableLabel.innerHTML = `<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> Available Documents (${availableCount})`;
        }
        if (selectedLabel) {
            selectedLabel.innerHTML = `<svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Selected Requirements (${selectedCount})`;
        }
        if (selectAllBtn) selectAllBtn.classList.toggle('hidden', Number(availableCount || 0) === 0);
        if (removeAllBtn) removeAllBtn.classList.toggle('hidden', Number(selectedCount || 0) === 0);
        if (savedLabel && configMode === 'edit') savedLabel.classList.add('hidden');
    }

    // Dual Panel Requirement Builder Functions
    function getRequirementsConfigSelection() {
        return {
            projectTypeId: document.getElementById('reqType')?.value || '',
            requesteeId: document.getElementById('reqReq')?.value || '',
            stage: document.getElementById('reqStageSelect')?.value || 'Proposal'
        };
    }

    function setRequirementsConfigSelection(selection = {}) {
        const typeEl = document.getElementById('reqType');
        const reqEl = document.getElementById('reqReq');
        const stageEl = document.getElementById('reqStageSelect');
        if (typeEl) typeEl.value = selection.projectTypeId || '';
        if (reqEl) reqEl.value = selection.requesteeId || '';
        if (stageEl) stageEl.value = selection.stage || 'Proposal';
    }

    function sameRequirementsConfigSelection(a = {}, b = {}) {
        return String(a.projectTypeId || '') === String(b.projectTypeId || '')
          && String(a.requesteeId || '') === String(b.requesteeId || '')
          && String(a.stage || 'Proposal') === String(b.stage || 'Proposal');
    }

    function isRequirementsConfigDirty() {
        return appCurrentView === 'settings' && activeSettingsSection === 'requirements' && hasUnsavedChanges();
    }

    function discardRequirementConfigChanges() {
        configMode = 'view';
        initialSelectionOrder = [...selectionOrder];
        syncConfigActionButtons();
    }

    async function confirmDiscardRequirementsForSelectionChange() {
        if (!isRequirementsConfigDirty()) return true;
        const confirmed = await confirmModalChoice('You have unsaved requirement changes. Changing the selection will discard them. Continue?');
        if (confirmed) discardRequirementConfigChanges();
        return confirmed;
    }

    async function confirmLeaveRequirementsConfig() {
        if (!isRequirementsConfigDirty()) return true;
        const confirmed = await confirmModalChoice('You have unsaved requirement changes. Leaving this page will discard them. Continue?');
        if (confirmed) discardRequirementConfigChanges();
        return confirmed;
    }

    async function onRequirementsConfigSelectionChange() {
        if (suppressRequirementsSelectionChange) return;
        const previous = { ...requirementsConfigCurrentSelection };
        const next = getRequirementsConfigSelection();
        if (sameRequirementsConfigSelection(previous, next)) {
            updateReqSetName();
            return;
        }

        const canChange = await confirmDiscardRequirementsForSelectionChange();
        if (!canChange) {
            suppressRequirementsSelectionChange = true;
            setRequirementsConfigSelection(previous);
            suppressRequirementsSelectionChange = false;
            updateReqSetName();
            return;
        }

        requirementsConfigCurrentSelection = next;
        updateReqSetName();
        await loadConfig({ silentMissingSelection: true });
        if (appCurrentView === 'settings' && activeSettingsSection === 'requirements' && !restoringHistoryState) {
            replaceAppHistory('settings', { section: 'requirements' });
        }
    }

    function updateReqSetName() {
        const typeSelect = document.getElementById('reqType');
        const reqSelect = document.getElementById('reqReq');
        const stageSelect = document.getElementById('reqStageSelect');
        const nameEl = document.getElementById('reqSetName');
        const headerContainer = document.getElementById('reqSetHeaderContainer');
        
        if (!typeSelect || !reqSelect || !stageSelect || !nameEl) return;
        
        const typeText = typeSelect.options[typeSelect.selectedIndex]?.text || 'Not selected';
        const reqText = reqSelect.options[reqSelect.selectedIndex]?.text || 'Not selected';
        const stageText = stageSelect.value || 'Proposal';
        if (typeSelect.value && reqSelect.value) {
            nameEl.textContent = `${typeText} - ${reqText} - ${stageText}`;
            if (headerContainer) headerContainer.classList.remove('hidden');
        } else {
            nameEl.textContent = '';
            if (headerContainer) headerContainer.classList.add('hidden');
        }
    }

    let selectedRequirementsDraggedEl = null;
    let selectedRequirementsDragStartOrder = [];
    let selectedRequirementsDropped = false;

    function getSelectedRequirementsListItems() {
        return [...(document.getElementById('selectedDocsList')?.querySelectorAll('li[data-id]') || [])];
    }

    function setupSelectedRequirementsDropZone(selectedList) {
        if (!selectedList || selectedList.dataset.dropReady === '1') return;
        selectedList.dataset.dropReady = '1';
        selectedList.addEventListener('dragover', (e) => {
            if (!selectedRequirementsDraggedEl) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const after = getSelectedRequirementsListItems().find(item => {
                if (item === selectedRequirementsDraggedEl) return false;
                const rect = item.getBoundingClientRect();
                return e.clientY < rect.top + rect.height / 2;
            });
            if (after) selectedList.insertBefore(selectedRequirementsDraggedEl, after);
            else selectedList.appendChild(selectedRequirementsDraggedEl);
        });
        selectedList.addEventListener('drop', (e) => {
            if (!selectedRequirementsDraggedEl) return;
            e.preventDefault();
            selectedRequirementsDropped = true;
            updateSelectionOrderFromDOM({ rerender: true });
        });
    }

    function setupSelectedRequirementDragItem(li, docId) {
        li.addEventListener('dragstart', (e) => {
            selectedRequirementsDraggedEl = li;
            selectedRequirementsDragStartOrder = [...selectionOrder];
            selectedRequirementsDropped = false;
            li.style.opacity = '0.4';
            e.dataTransfer.setData('text/plain', docId);
            e.dataTransfer.effectAllowed = 'move';
        });
        li.addEventListener('dragend', () => {
            li.style.opacity = '1';
            if (!selectedRequirementsDropped) {
                selectionOrder = [...selectedRequirementsDragStartOrder];
                refreshDualPanel();
            }
            selectedRequirementsDraggedEl = null;
            selectedRequirementsDragStartOrder = [];
            selectedRequirementsDropped = false;
        });
    }

    function renderDualPanel(docTypes, existingConfig) {
        const availableList = document.getElementById('availableDocsList');
        const selectedList = document.getElementById('selectedDocsList');
        const dualPanelContainer = document.getElementById('dualPanelContainer');
        const searchContainer = document.getElementById('dualPanelSearchContainer');
        const legacyList = document.getElementById('reqList');
        
        if (!availableList || !selectedList) return;
        
        // Show dual panel in edit mode, hide legacy list
        if (dualPanelContainer) dualPanelContainer.classList.remove('hidden');
        if (searchContainer) searchContainer.classList.remove('hidden');
        if (legacyList) legacyList.classList.add('hidden');
        
        // Sort existingConfig by order_index to ensure proper numerical sequence
        const sortedExistingConfig = [...existingConfig].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        const stageCategory = document.getElementById('reqStageSelect')?.value || 'Proposal';
        const existingIds = sortedExistingConfig.map(item => item.id);
        const availableDocs = docTypes.filter(doc => (doc.category || 'Proposal') === stageCategory && !existingIds.includes(doc.id));
        
        // Update selection order based on existing config - this preserves the order from the server
        selectionOrder = [...existingIds];
        
        // Track initial state for change detection
        trackInitialState();
        
        // Build selected docs in the exact order of selectionOrder (not filtered from docTypes)
        const selectedDocs = selectionOrder.map(id => docTypes.find(doc => doc.id === id)).filter(doc => doc !== undefined);
        updateRequirementCountLabels(availableDocs.length, selectedDocs.length);
        
        // Render Available Docs
        availableList.innerHTML = '';
        if (availableDocs.length === 0) {
            availableList.innerHTML = '<li class="text-gray-400 text-center p-4 italic text-sm">All documents selected</li>';
        } else {
            availableDocs.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition';
                li.onclick = () => moveDocToSelected(doc.id);
                li.innerHTML = `
                    <span class="w-5 h-5 flex items-center justify-center text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    </span>
                    <span class="flex-1 font-medium text-gray-700 dark:text-gray-300">${esc(doc.name)}</span>
                `;
                availableList.appendChild(li);
            });
        }
        
    // Render Selected Requirements with drag handles for reordering
    selectedList.innerHTML = '';
    setupSelectedRequirementsDropZone(selectedList);
    if (selectedDocs.length === 0) {
        selectedList.innerHTML = '<li class="text-gray-400 text-center p-4 italic text-sm">No requirements selected yet</li>';
    } else {
        selectedDocs.forEach((doc, index) => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 cursor-move hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition';
            li.draggable = true;
            li.dataset.id = doc.id;
            setupSelectedRequirementDragItem(li, doc.id);
                
                li.innerHTML = `
                    <span class="w-5 h-5 flex items-center justify-center text-gray-400 cursor-grab">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>
                    </span>
                    <span class="flex-1 font-medium text-indigo-900 dark:text-indigo-300">${index + 1}. ${esc(doc.name)}</span>
                    <button onclick="moveDocToAvailable(${doc.id})" class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition" title="Remove">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                `;
                selectedList.appendChild(li);
            });
        }
        
        syncConfigActionButtons();
        filterDualPanelDocs();
    }

    function moveDocToSelected(docId) {
        if (configMode !== 'edit') return;
        if (!selectionOrder.includes(docId)) {
            selectionOrder.push(docId);
        }
        refreshDualPanel();
    }

    function moveDocToAvailable(docId) {
        if (configMode !== 'edit') return;
        selectionOrder = selectionOrder.filter(id => id !== docId);
        refreshDualPanel();
    }

    function selectAllDocs() {
        if (configMode !== 'edit') return;
        const stageCategory = document.getElementById('reqStageSelect')?.value || 'Proposal';
        docCache.filter(doc => (doc.category || 'Proposal') === stageCategory).forEach(doc => {
            if (!selectionOrder.includes(doc.id)) {
                selectionOrder.push(doc.id);
            }
        });
        refreshDualPanel();
    }

    function removeSelectedDocs() {
        if (configMode !== 'edit') return;
        // Remove all from selection
        selectionOrder = [];
        refreshDualPanel();
    }

    function openNewRequirementDocumentModal() {
        if (configMode !== 'edit') return;
        const stage = document.getElementById('reqStageSelect')?.value || 'Proposal';
        const modal = document.getElementById('newRequirementDocumentModal');
        const input = document.getElementById('reqNewDocumentTypeModalName');
        const stageText = document.getElementById('newRequirementDocumentStageText');
        if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
        if (stageText) stageText.textContent = `Add a document for the ${stage} stage. It will be selected automatically.`;
        if (input) input.value = '';
        if (modal) modal.classList.remove('hidden');
        setTimeout(() => input?.focus(), 50);
    }

    function closeNewRequirementDocumentModal() {
        document.getElementById('newRequirementDocumentModal')?.classList.add('hidden');
    }

    async function addDocumentTypeFromRequirements(event) {
        event.preventDefault();
        if (configMode !== 'edit') return;
        const input = document.getElementById('reqNewDocumentTypeModalName') || document.getElementById('reqNewDocumentTypeName');
        const name = (input?.value || '').trim();
        const stage = document.getElementById('reqStageSelect')?.value || 'Proposal';
        if (!name) return toast('Document type name required', 'error');
        try {
            const created = await fetchJson(`${API}/settings/requirements/document-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category: stage })
            });
            if (created?.pending_approval) {
                if (input) input.value = '';
                closeNewRequirementDocumentModal();
                toast(created.message || 'Configuration change request submitted for Direct Superior approval.');
                await loadNotifications(notificationsLimit);
                return;
            }
            docCache = [created, ...docCache.filter(doc => doc.id !== created.id)];
            selectionOrder.push(created.id);
            if (input) input.value = '';
            closeNewRequirementDocumentModal();
            refreshDualPanel();
            toast('Document type added');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function filterDualPanelDocs() {
        const searchTerm = document.getElementById('dualPanelSearch')?.value.toLowerCase() || '';
        const availableList = document.getElementById('availableDocsList');
        
        if (!availableList) return;
        
        const items = availableList.querySelectorAll('li');
        items.forEach(li => {
            const text = li.textContent.toLowerCase();
            li.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    }

    function updateSelectionOrderFromDOM({ rerender = false } = {}) {
        const selectedList = document.getElementById('selectedDocsList');
        if (!selectedList) return;
        
        const newOrder = [];
        selectedList.querySelectorAll('li').forEach(li => {
            const id = parseInt(li.dataset.id);
            if (!newOrder.includes(id)) {
                newOrder.push(id);
            }
        });
        selectionOrder = newOrder;
        syncConfigActionButtons();
        if (rerender) refreshDualPanel();
    }

    // Track initial state for change detection
    let initialSelectionOrder = [];
    let initialDocCache = [];
    
    function trackInitialState() {
        initialSelectionOrder = [...selectionOrder];
        initialDocCache = docCache ? [...docCache] : [];
    }
    
    function hasUnsavedChanges() {
        if (configMode !== 'edit') return false;
        if (selectionOrder.length !== initialSelectionOrder.length) return true;
        for (let i = 0; i < selectionOrder.length; i++) {
            if (selectionOrder[i] !== initialSelectionOrder[i]) return true;
        }
        return false;
    }

    function refreshDualPanel() {
        if (!docCache || docCache.length === 0) return;
        
        const availableList = document.getElementById('availableDocsList');
        const selectedList = document.getElementById('selectedDocsList');
        
        if (!availableList || !selectedList) return;
        
        // Build selected docs in the exact order of selectionOrder
        const stageCategory = document.getElementById('reqStageSelect')?.value || 'Proposal';
        const selectedDocs = selectionOrder.map(id => docCache.find(doc => doc.id === id)).filter(doc => doc !== undefined);
        const availableDocs = docCache.filter(doc => (doc.category || 'Proposal') === stageCategory && !selectionOrder.includes(doc.id));
        updateRequirementCountLabels(availableDocs.length, selectedDocs.length);
        
        // Re-render available docs
        availableList.innerHTML = '';
        if (availableDocs.length === 0) {
            availableList.innerHTML = '<li class="text-gray-400 text-center p-4 italic text-sm">All documents selected</li>';
        } else {
            availableDocs.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition';
                li.onclick = () => moveDocToSelected(doc.id);
                li.innerHTML = `
                    <span class="w-5 h-5 flex items-center justify-center text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    </span>
                    <span class="flex-1 font-medium text-gray-700 dark:text-gray-300">${esc(doc.name)}</span>
                `;
                availableList.appendChild(li);
            });
        }
        
        // Re-render selected docs
        selectedList.innerHTML = '';
        setupSelectedRequirementsDropZone(selectedList);
        if (selectedDocs.length === 0) {
            selectedList.innerHTML = '<li class="text-gray-400 text-center p-4 italic text-sm">No requirements selected yet</li>';
        } else {
            selectedDocs.forEach((doc, index) => {
                const li = document.createElement('li');
                li.className = 'flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 cursor-move hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition';
                li.draggable = true;
                li.dataset.id = doc.id;
                setupSelectedRequirementDragItem(li, doc.id);
                
                li.innerHTML = `
                    <span class="w-5 h-5 flex items-center justify-center text-gray-400 cursor-grab">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>
                    </span>
                    <span class="flex-1 font-medium text-indigo-900 dark:text-indigo-300">${index + 1}. ${esc(doc.name)}</span>
                    <button onclick="moveDocToAvailable(${doc.id})" class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition" title="Remove">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                `;
                selectedList.appendChild(li);
            });
        }
        
        syncConfigActionButtons();
        filterDualPanelDocs();
    }

    function toggleConfigItem(id, checkbox) {
        if (configMode !== 'edit') return;
        
        if (checkbox && checkbox.checked) {
            if (!selectionOrder.includes(id)) {
                selectionOrder.push(id);
            }
        } else if (checkbox && !checkbox.checked) {
             selectionOrder = selectionOrder.filter(i => i !== id);
        } else {
             if (selectionOrder.includes(id)) {
                selectionOrder = selectionOrder.filter(i => i !== id);
            } else {
                selectionOrder.push(id);
            }
        }
        // Check if we're in dual panel mode or legacy list mode
        const dualPanelContainer = document.getElementById('dualPanelContainer');
        const isDualPanelVisible = dualPanelContainer && !dualPanelContainer.classList.contains('hidden');
        
        if (isDualPanelVisible) {
            refreshDualPanel();
        } else {
            renderRequirementsList(docCache, { editable: true });
        }
        syncConfigActionButtons();
    }

    async function saveRequirements() { 
        if (configMode !== 'edit') return;
        
        const pid = parseInt(document.getElementById('reqType').value);
        const rid = parseInt(document.getElementById('reqReq').value);
        const stage = document.getElementById('reqStageSelect') ? document.getElementById('reqStageSelect').value : 'Proposal';
        
        const items = selectionOrder.map((id, index) => ({
            document_type_id: id,
            order_index: index
        }));
        
        try{
            const saveResult = await fetchJson(`${API}/settings/requirements`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectTypeId:pid,requesteeId:rid,stage:stage,items})});
            if (saveResult?.pending_approval) {
                trackInitialState();
                syncConfigActionButtons();
                toast(saveResult.message || 'Configuration change request submitted for Direct Superior approval.');
                await loadNotifications(notificationsLimit);
                return;
            }
            const confirmed = await fetchJson(`${API}/settings/requirements?projectTypeId=${pid}&requesteeId=${rid}&stage=${encodeURIComponent(stage)}`, { silentLoading: true });
            const confirmedOrder = [...(confirmed || [])]
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(item => Number(item.id));
            const selectedOrder = selectionOrder.map(Number);
            const orderMatches = confirmedOrder.length === selectedOrder.length
                && confirmedOrder.every((id, index) => id === selectedOrder[index]);
            if (!orderMatches) {
                return toast(`Save mismatch. Selected ${selectionOrder.length} but only ${(confirmed || []).length} were saved. Please reload and try again.`, 'error');
            }
            if (selectionOrder.length === 0) {
                toast('Requirements cleared successfully.');
            } else {
                toast(`Saved successfully. ${confirmed.length} requirements confirmed.`);
            }
            selectionOrder = confirmedOrder.map(Number);
            trackInitialState();
            syncConfigActionButtons();
            await loadConfig({ silentLoading: true });
            trackInitialState();
            syncConfigActionButtons();
            await refreshAfterMutation({
                refreshDashboard: false,
                refreshDetails: false,
                refreshDocuments: false,
                refreshCalendar: false,
                refreshWorkPanels: false,
                refreshWorkload: false
            });
        } catch(e){toast(e.message,'error');}
    }

    function renderDocumentTypesSettings(el, data) {
        const categories = ['Proposal', 'Implementation'];
        const selectedCategory = window.documentTypeCategoryPreference || document.getElementById('documentTypeCategory')?.value || 'Proposal';
        el.innerHTML = `
          <div class="space-y-4">
            <form id="form-document-types" class="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
              <input type="text" id="in-document-types" placeholder="New document type" class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2" required>
              <select id="documentTypeCategory" class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2">
                <option value="Proposal">Proposal</option>
                <option value="Implementation">Implementation</option>
              </select>
              <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Add</button>
            </form>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="search" id="documentTypeSearch" oninput="filterDocumentTypesSettings()" placeholder="Search document types..." class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
            <div id="list-document-types" class="grid grid-cols-1 lg:grid-cols-2 gap-4"></div>
          </div>
        `;
        const categorySelect = document.getElementById('documentTypeCategory');
        if (categorySelect) categorySelect.value = selectedCategory;
        const list = document.getElementById('list-document-types');
        categories.forEach(category => {
          const docs = data.filter(d => (d.category || 'Proposal') === category);
          const section = document.createElement('section');
          section.className = 'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900';
          section.innerHTML = `
            <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h4 class="font-bold text-gray-800 dark:text-gray-100">${category}</h4>
            </div>
            <ul class="space-y-2 p-3 min-h-[72px]" data-document-category="${category}"></ul>
          `;
          const ul = section.querySelector('ul');
          if (docs.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center p-4 italic text-sm">No document types yet</li>';
          } else {
            docs.forEach(d => {
              const li = document.createElement('li');
              li.className = 'document-type-item flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:shadow-sm';
              li.draggable = true;
              li.dataset.id = d.id;
              li.dataset.name = d.name || '';
              li.dataset.category = category;
              li.innerHTML = `<span class="text-gray-400 cursor-move"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg></span><span class="flex-1 font-medium text-gray-700 dark:text-gray-300">${esc(d.name)}</span><button data-name="${esc(d.name)}" data-category="${category}" onclick="editItem('document-types',${d.id}, this.dataset.name, this.dataset.category)" class="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition flex items-center justify-center">${svgEdit}</button><button onclick="openConfirmModal('Delete this item?',()=>delItem('document-types',${d.id}))" class="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition flex items-center justify-center">${svgDelete}</button>`;
              setupDrag(li, 'document-types');
              ul.appendChild(li);
            });
          }
          list.appendChild(section);
        });
        document.getElementById('form-document-types').onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById('in-document-types').value;
          const category = document.getElementById('documentTypeCategory').value;
          try {
            const result = await fetchJson(`${API}/settings/document-types`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, category }) });
            if (result?.pending_approval) {
              window.documentTypeCategoryPreference = category;
              document.getElementById('in-document-types').value = '';
              toast(result.message || 'Configuration change request submitted for Direct Superior approval.');
              await loadNotifications(notificationsLimit);
              return;
            }
            window.documentTypeCategoryPreference = category;
            document.getElementById('in-document-types').value = '';
            renderSettingsTab('document-types');
            toast('Added');
          } catch(err) { toast(err.message, 'error'); }
        };
    }

    function filterDocumentTypesSettings() {
      const term = (document.getElementById('documentTypeSearch')?.value || '').toLowerCase();
      document.querySelectorAll('.document-type-item').forEach(item => {
        item.style.display = item.dataset.name.toLowerCase().includes(term) ? 'flex' : 'none';
      });
    }

    function formatDueScheduleDuration(item) {
        if (!(item.due_days > 0 || item.due_hours > 0)) return '-';
        const parts = [];
        if (item.due_days > 0) parts.push(`${item.due_days} day${item.due_days !== 1 ? 's' : ''}`);
        if (item.due_hours > 0) parts.push(`${item.due_hours} hour${item.due_hours !== 1 ? 's' : ''}`);
        return parts.join(', ');
    }

    function formatDueScheduleStart(item) {
        if (item.start_from_document_upload && item.document_type_start_point) {
            return `When "${item.start_doc_name || 'Document'}" is uploaded`;
        }
        return 'Project Creation';
    }

    function renderDueSchedulesSettings(el, data = []) {
        window.dueScheduleDocTypesCache = data;
        el.innerHTML = `
            <div class="settings-card p-4 space-y-4">
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                    Load a requirement set to configure due schedules only for documents included in that set.
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Project Type</label><select id="dueReqType" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></select></div>
                    <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Requestee</label><select id="dueReqReq" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></select></div>
                    <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Stage</label><select id="dueReqStage" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"><option value="Proposal">Proposal</option><option value="Implementation">Implementation</option></select></div>
                    <button onclick="loadDueScheduleRequirementSet()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold">Load Requirements</button>
                </div>
                <div id="dueScheduleLoadedSummary" class="hidden rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-sm font-bold text-blue-900 dark:text-blue-100"></div>
                <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="search" id="dueScheduleSearch" oninput="filterDueSchedulesSettings()" placeholder="Search documents..." class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                </div>
                <div id="dueScheduleGroups" class="space-y-4"></div>
            </div>
        `;
        populateDueScheduleSelectors().then(() => {
            if (loadedRequirementSetForDueSchedules) loadDueScheduleRequirementSet();
            else renderDueScheduleScopedRows();
        });
    }

    async function populateDueScheduleSelectors() {
        const typeSelect = document.getElementById('dueReqType');
        const reqSelect = document.getElementById('dueReqReq');
        if (!typeSelect || !reqSelect) return;
        const [types, reqs] = await Promise.all([
            fetchJson(`${API}/settings/project-types`),
            fetchJson(`${API}/settings/requestees`)
        ]);
        typeSelect.innerHTML = '<option value="">Select Type</option>';
        reqSelect.innerHTML = '<option value="">Select Requestee</option>';
        types.forEach(t => typeSelect.innerHTML += `<option value="${t.id}">${esc(t.name)}</option>`);
        reqs.forEach(r => reqSelect.innerHTML += `<option value="${r.id}">${esc(r.name)}</option>`);
        if (loadedRequirementSetForDueSchedules) {
            typeSelect.value = loadedRequirementSetForDueSchedules.projectTypeId || '';
            reqSelect.value = loadedRequirementSetForDueSchedules.requesteeId || '';
            document.getElementById('dueReqStage').value = loadedRequirementSetForDueSchedules.stage || 'Proposal';
        }
    }

    async function loadDueScheduleRequirementSet() {
        const typeSelect = document.getElementById('dueReqType');
        const reqSelect = document.getElementById('dueReqReq');
        const stageSelect = document.getElementById('dueReqStage');
        const pid = typeSelect?.value;
        const rid = reqSelect?.value;
        const stage = stageSelect?.value || 'Proposal';
        if (!pid || !rid) return toast('Please select Project Type and Requestee first.', 'error');
        try {
            const params = new URLSearchParams({ projectTypeId: pid, requesteeId: rid, stage });
            const scheduleData = await fetchJson(`${API}/settings/requirements/due-schedules?${params.toString()}`);
            window.dueScheduleDocTypesCache = scheduleData.items || [];
            loadedRequirementSetForDueSchedules = {
                requirementSetId: scheduleData.requirement_set_id,
                projectTypeId: pid,
                requesteeId: rid,
                projectType: typeSelect.options[typeSelect.selectedIndex]?.text || '',
                requestee: reqSelect.options[reqSelect.selectedIndex]?.text || '',
                stage,
                requirements: scheduleData.items || []
            };
            renderDueScheduleScopedRows();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function renderDueScheduleScopedRows() {
        const groups = document.getElementById('dueScheduleGroups');
        if (!groups) return;
        groups.innerHTML = '';
        const summary = document.getElementById('dueScheduleLoadedSummary');
        if (!loadedRequirementSetForDueSchedules) {
            currentDueScheduleDocTypeIds = [];
            if (summary) summary.classList.add('hidden');
            groups.innerHTML = '<div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">Select a Project Type, Requestee, and Stage, then click Load Requirements.</div>';
            return;
        }
        const scope = loadedRequirementSetForDueSchedules;
        const data = window.dueScheduleDocTypesCache || [];
        const allowedIds = new Set((scope.requirements || []).map(item => Number(item.id)));
        const scopedDocs = data.filter(item => allowedIds.has(Number(item.id)) && (item.category || 'Proposal') === scope.stage);
        currentDueScheduleDocTypeIds = scopedDocs.map(item => Number(item.id));
        if (summary) {
            summary.textContent = `${scope.projectType} - ${scope.requestee} - ${scope.stage}`;
            summary.classList.remove('hidden');
        }
        const section = document.createElement('section');
        section.className = 'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900';
        section.innerHTML = `
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h4 class="font-bold text-gray-800 dark:text-gray-100">${esc(scope.stage)} Documents</h4>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Starts From</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700"></tbody>
                    </table>
                </div>
            `;
        const tbody = section.querySelector('tbody');
        if (scopedDocs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-6 text-center text-sm text-gray-400 italic">No documents in the loaded requirement set</td></tr>';
        } else {
            scopedDocs.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'due-schedule-item hover:bg-gray-50 dark:hover:bg-gray-800 transition';
                row.dataset.name = item.name || '';
                row.dataset.category = scope.stage;
                row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${esc(item.name)}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-500 dark:text-gray-400">${esc(formatDueScheduleDuration(item))}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-500 dark:text-gray-400">${esc(formatDueScheduleStart(item))}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onclick="openEditDueScheduleModal(${item.id})" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center justify-end gap-1 ml-auto">
                                ${svgEdit}
                                <span>Edit</span>
                            </button>
                        </td>
                    `;
                tbody.appendChild(row);
            });
        }
        groups.appendChild(section);
    }

    function filterDueSchedulesSettings() {
        const term = (document.getElementById('dueScheduleSearch')?.value || '').toLowerCase();
        document.querySelectorAll('.due-schedule-item').forEach(item => {
            item.style.display = item.dataset.name.toLowerCase().includes(term) ? '' : 'none';
        });
    }
    
    async function delItem(t,id){ try{const result = await fetchJson(`${API}/settings/${t}/${id}`,{method:'DELETE'}); if(result?.pending_approval){toast(result.message || 'Configuration change request submitted for Direct Superior approval.'); await loadNotifications(notificationsLimit); return;} renderSettingsTab(t);toast('Deleted');}catch(e){toast(e.message,'error');} }
    function editItem(type,id,currentName,currentCategory='Proposal'){ openEditModal(type,id,currentName,currentCategory); } 
    function openEditModal(type,id,currentName,currentCategory='Proposal'){ document.getElementById('editType').value=type; document.getElementById('editId').value=id; document.getElementById('editNameInput').value=currentName; const wrap=document.getElementById('editCategoryWrap'); const input=document.getElementById('editCategoryInput'); if(type==='document-types'){wrap.classList.remove('hidden'); input.value=currentCategory || 'Proposal';} else {wrap.classList.add('hidden');} document.getElementById('editModal').classList.remove('hidden'); } 
    function closeEditModal(){ document.getElementById('editModal').classList.add('hidden'); }
    document.getElementById('editForm').onsubmit=async(e)=>{e.preventDefault(); const type=document.getElementById('editType').value, id=document.getElementById('editId').value, newName=document.getElementById('editNameInput').value; const body={name:newName}; if(type==='document-types') body.category=document.getElementById('editCategoryInput').value; try{const result = await fetchJson(`${API}/settings/${type}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(result?.pending_approval){toast(result.message || 'Configuration change request submitted for Direct Superior approval.'); closeEditModal(); await loadNotifications(notificationsLimit); return;} toast('Updated'); closeEditModal(); renderSettingsTab(type);} catch(err){toast(err.message,'error');}};

    let dragEl=null; function setupDrag(el,t){ el.addEventListener('dragstart',e=>{dragEl=el;el.style.opacity='0.4';}); el.addEventListener('dragend',e=>{el.style.opacity='1';sendReorder(t);dragEl=null;}); el.addEventListener('dragover',e=>{e.preventDefault();if(e.currentTarget!==dragEl){const r=e.currentTarget.getBoundingClientRect(); e.clientY<r.top+r.height/2?e.currentTarget.parentNode.insertBefore(dragEl,e.currentTarget):e.currentTarget.parentNode.insertBefore(dragEl,e.currentTarget.nextSibling);}}); }
    async function sendReorder(t){ const list=document.getElementById(`list-${t}`); const items=[...list.querySelectorAll('li[data-id]')].map((el,i)=>({id:parseInt(el.dataset.id),order_index:i})); try{const result = await fetchJson(`${API}/settings/reorder/${t}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)}); if(result?.pending_approval){toast(result.message || 'Configuration change request submitted for Direct Superior approval.'); await renderSettingsTab(t); await loadNotifications(notificationsLimit);}}catch(e){toast(e.message,'error');} }
    async function saveDueSchedules() {
        const rows = [...document.querySelectorAll('[data-due-schedule-row]')].map(row => {
            const id = parseInt(row.dataset.id, 10);
            const startPointData = window.selectedStartPoints ? window.selectedStartPoints[id] : null;
            return {
                id: id,
                due_days: Math.max(0, parseInt(row.querySelector('[data-due-days]').value || '0', 10) || 0),
                due_hours: Math.max(0, parseInt(row.querySelector('[data-due-hours]').value || '0', 10) || 0),
                document_type_start_point: startPointData ? startPointData.document_type_start_point : 0,
                start_from_document_upload: startPointData ? (startPointData.start_from_document_upload ? 1 : 0) : 0
            };
        });
        try {
            const result = await fetchJson(`${API}/settings/document-due-schedules`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirement_set_id: loadedRequirementSetForDueSchedules?.requirementSetId, items: rows })
            });
            if (result?.pending_approval) {
                window.selectedStartPoints = {};
                toast(result.message || 'Configuration change request submitted for Direct Superior approval.');
                await renderSettingsTab('document-due-schedules');
                await loadNotifications(notificationsLimit);
                return;
            }
            // Clear temporary selections after save
            window.selectedStartPoints = {};
            toast('Due schedules saved');
            await renderSettingsTab('document-due-schedules');
            await refreshAfterMutation({ refreshNotifications: false });
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    // Manual Due Date Override Modal Functions
    window.openManualDueDateModal = async function(docId, currentDueDate, docName) {
        try {
            const modal = document.getElementById('manualDueDateModal');
            document.getElementById('manualDueDateTargetKind').value = 'document';
            document.getElementById('manualDueDateDocId').value = docId;
            document.getElementById('manualDueDateDocName').textContent = docName;
            
            // Set current date/time if exists
            const dateInput = document.getElementById('manualDueDateInput');
            if (currentDueDate) {
                const d = new Date(currentDueDate);
                const localISO = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                dateInput.value = localISO;
            } else {
                // Default to tomorrow at 9 AM
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                const localISO = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                dateInput.value = localISO;
            }
            
            modal.classList.remove('hidden');
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    window.openProjectDueDateModal = async function(projectId, currentDueDate, projectName) {
        try {
            const modal = document.getElementById('manualDueDateModal');
            document.getElementById('manualDueDateTargetKind').value = 'project';
            document.getElementById('manualDueDateDocId').value = projectId;
            document.getElementById('manualDueDateDocName').textContent = `Project: ${projectName}`;
            const dateInput = document.getElementById('manualDueDateInput');
            if (currentDueDate) {
                const d = new Date(currentDueDate);
                const localISO = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                dateInput.value = localISO;
            } else {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                const localISO = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                dateInput.value = localISO;
            }
            modal.classList.remove('hidden');
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    async function refreshDueDateSurfaces() {
        const targetKind = document.getElementById('manualDueDateTargetKind')?.value || 'document';
        const targetId = document.getElementById('manualDueDateDocId')?.value || null;
        await refreshAfterMutation({
            projectId: targetKind === 'project' ? targetId : currentProjId,
            documentId: targetKind === 'document' ? targetId : null
        });
    }

    window.saveManualDueDate = async function() {
        const targetKind = document.getElementById('manualDueDateTargetKind')?.value || 'document';
        const docId = document.getElementById('manualDueDateDocId').value;
        const dueDate = document.getElementById('manualDueDateInput').value;
        
        if (!dueDate) {
            toast('Please select a due date', 'error');
            return;
        }
        
        try {
            const endpoint = targetKind === 'project' ? `${API}/projects/${docId}/due-date` : `${API}/documents/${docId}/due-date`;
            await fetchJson(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ due_date: dueDate })
            });
            toast('Due date updated');
            closeModal('manualDueDateModal');
            await refreshDueDateSurfaces();
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    window.clearManualDueDate = async function() {
        const targetKind = document.getElementById('manualDueDateTargetKind')?.value || 'document';
        const docId = document.getElementById('manualDueDateDocId').value;
        
        try {
            const endpoint = targetKind === 'project' ? `${API}/projects/${docId}/due-date` : `${API}/documents/${docId}/due-date`;
            await fetchJson(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear_override: true })
            });
            toast('Due date override cleared');
            closeModal('manualDueDateModal');
            await refreshDueDateSurfaces();
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    function authHeaders() {
        return currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : (authToken ? { Authorization: `Bearer ${authToken}` } : {});
    }

    function getFilenameFromDisposition(contentDisposition, fallback = 'download') {
        const header = String(contentDisposition || '');
        const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
        if (encoded?.[1]) {
            try { return decodeURIComponent(encoded[1].replace(/"/g, '')); } catch (e) {}
        }
        const plain = header.match(/filename="?([^";]+)"?/i);
        return plain?.[1] || fallback;
    }

    function fileExtension(fileName = '') {
        const dot = String(fileName).lastIndexOf('.');
        return dot >= 0 ? String(fileName).slice(dot).toLowerCase() : '';
    }

    function resetFileViewerBlob() {
        if (fileViewerBlobUrl) {
            URL.revokeObjectURL(fileViewerBlobUrl);
            fileViewerBlobUrl = null;
        }
    }

    function renderFileViewerLoading(fileName) {
        document.getElementById('fileViewerTitle').textContent = fileName || 'File Preview';
        document.getElementById('fileViewerMeta').textContent = 'Loading preview...';
        const downloadBtn = document.getElementById('fileViewerDownloadBtn');
        if (downloadBtn) downloadBtn.disabled = true;
        document.getElementById('fileViewerBody').innerHTML = `
          <div class="h-full min-h-[320px] flex items-center justify-center text-sm text-gray-600 dark:text-gray-300">
            <span class="spinner mr-2"></span> Loading preview...
          </div>`;
    }

    function renderFileViewerError(message) {
        document.getElementById('fileViewerMeta').textContent = 'Preview unavailable';
        document.getElementById('fileViewerBody').innerHTML = `
          <div class="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6">
            <div class="text-lg font-black text-gray-900 dark:text-gray-100 mb-2">Unable to open file preview.</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">${esc(message || 'Please try again or download the file.')}</div>
          </div>`;
    }

    function renderFileViewerPreview(blobUrl, fileName, contentType) {
        const ext = fileExtension(fileName);
        const type = String(contentType || '').split(';')[0].toLowerCase();
        const isPdf = type === 'application/pdf' || ext === '.pdf';
        const isImage = type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
        const isVideo = type.startsWith('video/') || ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
        const isText = type.startsWith('text/') || ['.txt', '.csv', '.json', '.md', '.log', '.xml'].includes(ext);
        const isOffice = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext);
        const body = document.getElementById('fileViewerBody');
        const downloadBtn = document.getElementById('fileViewerDownloadBtn');
        if (downloadBtn) downloadBtn.disabled = false;
        document.getElementById('fileViewerTitle').textContent = fileName || 'File Preview';
        document.getElementById('fileViewerMeta').textContent = isPdf ? 'PDF preview' : (isImage ? 'Image preview' : isVideo ? 'Video preview' : isText ? 'Text preview' : 'Preview unavailable');

        if (isPdf) {
            body.innerHTML = `<iframe title="PDF preview for ${esc(fileName)}" src="${blobUrl}" class="w-full h-full min-h-[70vh] rounded-lg bg-white border border-gray-200 dark:border-gray-800"></iframe>`;
            return;
        }
        if (isImage) {
            body.innerHTML = `<div class="min-h-full flex items-start justify-center"><img src="${blobUrl}" alt="${esc(fileName)}" class="max-w-full h-auto rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"></div>`;
            return;
        }
        if (isVideo) {
            body.innerHTML = `<div class="min-h-full flex items-center justify-center"><video src="${blobUrl}" controls class="max-w-full max-h-[72vh] rounded-lg bg-black shadow-lg"></video></div>`;
            return;
        }
        if (isText) {
            fetch(blobUrl).then(response => response.text()).then(text => {
                body.innerHTML = `<pre class="whitespace-pre-wrap break-words text-left bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-100 min-h-[320px]">${esc(text.slice(0, 200000))}</pre>`;
            }).catch(() => renderFileViewerError('Unable to read this text file.'));
            return;
        }
        if (isOffice) {
            body.innerHTML = `
              <div class="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6">
                <div class="text-lg font-black text-gray-900 dark:text-gray-100 mb-2">Preview is not available for Office files.</div>
                <div class="text-sm text-gray-600 dark:text-gray-300">Download the file to open it in Word, Excel, or PowerPoint.</div>
              </div>`;
            return;
        }
        body.innerHTML = `
          <div class="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6">
            <div class="text-lg font-black text-gray-900 dark:text-gray-100 mb-2">Preview is not available for this file type.</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">You can still download the file if you have access.</div>
          </div>`;
    }

    window.openFileViewer = async function(documentId, fileName = '') {
        const docId = Number(documentId);
        if (!docId) return toast('No project/document selected.', 'error');
        resetFileViewerBlob();
        fileViewerCurrentSource = 'document';
        fileViewerCurrentDocumentId = docId;
        fileViewerCurrentMyDriveId = null;
        fileViewerCurrentFileName = fileName || 'download';
        renderFileViewerLoading(fileViewerCurrentFileName);
        document.getElementById('fileViewerModal').classList.remove('hidden');

        try {
            const response = await fetch(`${API}/documents/${docId}/download`, { headers: authHeaders() });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || (response.status === 404 ? 'File not found.' : response.status === 403 ? 'You do not have permission to view this file.' : 'Unable to open file preview.'));
            }
            const blob = await response.blob();
            const headerFilename = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fileViewerCurrentFileName);
            fileViewerCurrentFileName = headerFilename || fileViewerCurrentFileName;
            fileViewerBlobUrl = URL.createObjectURL(blob);
            renderFileViewerPreview(fileViewerBlobUrl, fileViewerCurrentFileName, response.headers.get('Content-Type') || blob.type);
        } catch (e) {
            toast(e.message || 'Unable to open file preview.', 'error');
            renderFileViewerError(e.message);
        }
    };

    window.closeFileViewer = function() {
        resetFileViewerBlob();
        fileViewerCurrentDocumentId = null;
        fileViewerCurrentMyDriveId = null;
        fileViewerCurrentSource = 'document';
        fileViewerCurrentFileName = '';
        document.getElementById('fileViewerBody').innerHTML = '';
        closeModal('fileViewerModal');
    };

    window.downloadDocumentFile = async function(documentId, fileName = '') {
        const docId = Number(documentId);
        if (!docId) return toast('No project/document selected.', 'error');
        try {
            const result = await downloadsFormsDownloadRequest(`${API}/documents/${docId}/download`, fileName || 'download', {
              title: 'Downloading document',
              initialStatus: 'Preparing document download...',
              progressStatus: 'Downloading document...',
              finishingStatus: 'Download complete. Saving file...',
              returnMeta: true
            });
            downloadBlob(result.blob, result.filename || fileName || 'download');
        } catch (e) {
            toast(e.message || 'Failed to download file', 'error');
        }
    };

    window.downloadCurrentFileViewerFile = function() {
        if (fileViewerCurrentSource === 'myDrive' && fileViewerCurrentMyDriveId) {
            downloadMyDriveFile(fileViewerCurrentMyDriveId, fileViewerCurrentFileName || 'file');
            return;
        }
        if (!fileViewerCurrentDocumentId) return toast('No project/document selected.', 'error');
        downloadDocumentFile(fileViewerCurrentDocumentId, fileViewerCurrentFileName);
    };

    window.viewProtectedFile = async function(url, fileName = 'Attachment') {
        resetFileViewerBlob();
        fileViewerCurrentDocumentId = null;
        fileViewerCurrentFileName = fileName || 'Attachment';
        renderFileViewerLoading(fileViewerCurrentFileName);
        document.getElementById('fileViewerModal').classList.remove('hidden');
        try {
            const response = await fetch(url, { headers: authHeaders() });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Unable to open file preview.');
            }
            const blob = await response.blob();
            const headerFilename = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fileViewerCurrentFileName);
            fileViewerCurrentFileName = headerFilename || fileViewerCurrentFileName;
            fileViewerBlobUrl = URL.createObjectURL(blob);
            renderFileViewerPreview(fileViewerBlobUrl, fileViewerCurrentFileName, response.headers.get('Content-Type') || blob.type);
        } catch (e) {
            toast(e.message || 'Unable to open file preview.', 'error');
            renderFileViewerError(e.message);
        }
    };

    window.downloadProtectedFile = async function(url, fileName = 'download') {
        try {
            const result = await downloadsFormsDownloadRequest(url, fileName || 'download', {
              title: 'Downloading file',
              initialStatus: 'Preparing download...',
              progressStatus: 'Downloading...',
              finishingStatus: 'Download complete. Saving file...',
              returnMeta: true
            });
            downloadBlob(result.blob, result.filename || fileName || 'download');
        } catch (e) {
            toast(e.message || 'Failed to download file', 'error');
        }
    };

    // Backward-compatible authenticated download helper for older call sites.
    window.openFile = async function(url) {
        const match = String(url || '').match(/\/api\/documents\/(\d+)\/download/);
        if (match) return downloadDocumentFile(match[1]);
        try {
            const fallbackName = url.split('/').pop() || 'download';
            const result = await downloadsFormsDownloadRequest(url, fallbackName, {
              title: 'Downloading file',
              initialStatus: 'Preparing download...',
              progressStatus: 'Downloading...',
              finishingStatus: 'Download complete. Saving file...',
              returnMeta: true
            });
            downloadBlob(result.blob, result.filename || fallbackName);
        } catch (e) {
            toast(e.message || 'Failed to download file', 'error');
        }
    };

    let submittedFeedbackCache = [];
    const submittedFeedbackStatuses = ['submitted', 'reviewing', 'planned', 'completed', 'closed'];
