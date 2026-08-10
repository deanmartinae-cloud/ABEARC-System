
    async function loadMobileQrLogin() {
      const panel = document.getElementById('mobileQrLoginPanel');
      if (!panel) return;
      panel.innerHTML = '<div class="text-sm text-gray-500 dark:text-gray-400">Generating QR login code...</div>';
      try {
        const data = await fetchJson(`${API}/auth/mobile-qr`, { method: 'POST', silentLoading: true });
        panel.innerHTML = `
          <div class="w-full grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-4 items-center">
            <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <img src="${esc(data.qr_data_url)}" alt="GeoCamera QR login" class="w-56 h-56">
            </div>
            <div class="min-w-0">
              <div class="text-sm font-bold text-gray-900 dark:text-gray-100">Scan from GeoCamera</div>
              <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">Open GeoCamera Settings, tap Link to ABEARC Account, then Scan QR to Login.</div>
              <div class="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Expires</div>
              <div class="text-sm text-gray-900 dark:text-gray-100">${fmtDateTime(data.expires_at)}</div>
              <div class="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Server</div>
              <div class="text-sm text-gray-900 dark:text-gray-100 break-all">${esc(data.server_url || '')}</div>
            </div>
          </div>`;
      } catch (e) {
        panel.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${esc(e.message || 'Failed to generate QR login code.')}</div>`;
      }
    }

    async function renderSettingsTab(t) { 
        if (t === 'appearance' || t === 'change-password' || t === 'mobile-qr-login') return;

        // Handle user-management tab by privilege.
        if (t === 'user-management') {
            if (!hasPrivilege('manage_users')) {
                document.getElementById(`content-${t}`).innerHTML = '<div class="text-red-600">Access denied. Manage Users privilege required.</div>';
                return;
            }
            await renderUserManagement();
            return;
        }
        
        const map={'project-types':'project-types','requestees':'requestees','document-types':'document-types'}; 
        const el=document.getElementById(`content-${t}`); 
        if(t === 'document-due-schedules') {
            const data = await fetchJson(`${API}/settings/document-types`);
            renderDueSchedulesSettings(el, data);
            return;
        }
        const data=t==='requirements'?[]:await fetchJson(`${API}/settings/${map[t]}`); 
        if(t!=='requirements') { 
            if (t === 'document-types') {
                renderDocumentTypesSettings(el, data);
                return;
            }
            el.innerHTML=`<div class="settings-card p-4"><form id="form-${t}" class="flex flex-col sm:flex-row gap-2 mb-4"><input type="text" id="in-${t}" placeholder="New Name" class="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2" required><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Add</button></form><ul id="list-${t}" class="space-y-2"></ul></div>`; 
            const list=document.getElementById(`list-${t}`); 
            data.forEach(d=>{ 
                const li=document.createElement('li'); li.className='flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:shadow-sm'; li.draggable=true; li.dataset.id=d.id; 
                li.innerHTML=`<span class="text-gray-400 cursor-move"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg></span><span class="flex-1 font-medium text-gray-700 dark:text-gray-300">${esc(d.name)}</span><button data-name="${esc(d.name)}" onclick="editItem('${t}',${d.id}, this.dataset.name)" class="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition flex items-center justify-center">${svgEdit}</button><button onclick="openConfirmModal('Delete this item?',()=>delItem('${t}',${d.id}))" class="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition flex items-center justify-center">${svgDelete}</button>`; 
                setupDrag(li, t); list.appendChild(li); 
            }); 
            document.getElementById(`form-${t}`).onsubmit=async(e)=>{e.preventDefault(); const n=e.target.querySelector('input').value; try{const result = await fetchJson(`${API}/settings/${t}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:n})}); if(result?.pending_approval){e.target.reset(); toast(result.message || 'Configuration change request submitted for Direct Superior approval.'); await loadNotifications(notificationsLimit); return;} e.target.reset(); renderSettingsTab(t); toast('Added');} catch(err){toast(err.message,'error');}}; 
        } else { 
            const configGuide = `<div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 text-sm text-blue-800 dark:text-blue-300"><div class="whitespace-pre-line">${esc(configGuideText)}</div></div>`;
            
            const reloadOverrideCard = (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') ? `
            <div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div class="font-black text-amber-900 dark:text-amber-100">Reload Requirements</div>
                    <div class="text-sm text-amber-800 dark:text-amber-200">Allow admins to reload requirement lists/order even when files already exist or the project has moved to another stage.</div>
                </div>
                <label class="inline-flex items-center gap-3 font-bold text-amber-900 dark:text-amber-100 select-none">
                    <input id="reloadRequirementsOverrideToggle" type="checkbox" onchange="toggleReloadRequirementsOverride(this)" class="w-5 h-5 accent-amber-600">
                    Enable
                </label>
            </div>` : '';

            el.innerHTML=`${configGuide}${reloadOverrideCard}
            <!-- Selection Controls -->
            <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-end bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Project Type</label><select id="reqType" onchange="onRequirementsConfigSelectionChange()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></select></div>
                <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Requestee</label><select id="reqReq" onchange="onRequirementsConfigSelectionChange()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></select></div>
                <div><label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Stage</label><select id="reqStageSelect" onchange="onRequirementsConfigSelectionChange()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"><option value="Proposal">Proposal</option><option value="Implementation">Implementation</option></select></div>
                <button id="setConfigBtn" onclick="setConfig()" class="w-full md:w-auto md:justify-self-end bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition flex items-center justify-center gap-2 whitespace-nowrap">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Set Requirements
                </button>
            </div>
            
            <!-- Requirement Set Header (shown after loading) -->
            <div id="reqSetHeaderContainer" class="hidden bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 mb-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 class="text-lg font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 min-w-0">
                        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span class="shrink-0">Requirement Set:</span> <span id="reqSetName" class="font-normal text-gray-600 dark:text-gray-400 truncate"></span>
                    </h3>
                    <button id="printLoadedRequirementsBtn" onclick="printLoadedRequirements()" class="hidden w-full sm:w-auto bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium transition items-center justify-center gap-2 whitespace-nowrap">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9V2h12v7m-12 8H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2m-12 0h12v5H6v-5z"/></svg>
                        Print Requirements
                    </button>
                </div>
            </div>
            
            <!-- Dual Panel Layout -->
            <div id="dualPanelContainer" class="hidden grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <!-- Available Documents Panel -->
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                    <div class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h4 id="availableDocsCountLabel" class="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                            Available Docs
                        </h4>
                        <button id="selectAllAvailableDocsBtn" onclick="selectAllDocs()" class="hidden text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition">Select All</button>
                    </div>
                    <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50">
                        <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                            <div class="relative">
                                <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                <input type="text" id="dualPanelSearch" placeholder="Search available documents..." oninput="filterDualPanelDocs()" class="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                            </div>
                            <button type="button" onclick="openNewRequirementDocumentModal()" class="px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-sm font-black whitespace-nowrap">+ New Document</button>
                        </div>
                    </div>
                    <ul id="availableDocsList" class="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700"></ul>
                </div>
                
                <!-- Selected Requirements Panel -->
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div class="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                        <h4 id="selectedRequirementsCountLabel" class="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                            <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                            Selected Requirements
                        </h4>
                        <button id="removeAllSelectedRequirementsBtn" onclick="removeSelectedDocs()" class="hidden text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition">Remove All</button>
                    </div>
                    <ul id="selectedDocsList" class="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 min-h-[100px] flex-1"></ul>
                    <!-- Save Button at bottom of panel -->
                    <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <button id="saveRequirementsBtn" onclick="saveRequirements()" disabled class="w-full sm:w-auto sm:ml-auto bg-green-600 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:hover:bg-gray-400 font-bold shadow-md transition flex items-center justify-center gap-2 disabled:cursor-not-allowed">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
            <div id="newRequirementDocumentModal" class="fixed inset-0 bg-black/40 hidden z-[90] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
                <form onsubmit="addDocumentTypeFromRequirements(event)" class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
                        <div>
                            <h3 class="text-lg font-black text-gray-950 dark:text-gray-50">New Document</h3>
                            <p id="newRequirementDocumentStageText" class="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a document for the selected stage.</p>
                        </div>
                        <button type="button" onclick="closeNewRequirementDocumentModal()" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                    </div>
                    <div class="p-5 space-y-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Document name</label>
                            <input id="reqNewDocumentTypeModalName" type="text" required class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-600 outline-none" placeholder="Example: Site validation report">
                        </div>
                    </div>
                    <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <button type="button" onclick="closeNewRequirementDocumentModal()" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
                        <button type="submit" class="px-4 py-2 rounded-lg bg-cyan-700 text-white font-bold hover:bg-cyan-800">Add Document</button>
                    </div>
                </form>
            </div>
            
            <!-- Legacy single list (for view mode) -->
            <div id="savedRequirementsCountLabel" class="hidden text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 mb-3"></div>
            <ul id="reqList" class="hidden space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4"></ul>
            `; 
            
            const types=await fetchJson(`${API}/settings/project-types`), reqs=await fetchJson(`${API}/settings/requestees`); 
            const ts=document.getElementById('reqType'), rs=document.getElementById('reqReq'); 
            ts.innerHTML='<option value="">Select Type</option>'; rs.innerHTML='<option value="">Select Requestee</option>'; 
            types.forEach(t=>ts.innerHTML+=`<option value="${t.id}">${esc(t.name)}</option>`); reqs.forEach(r=>rs.innerHTML+=`<option value="${r.id}">${esc(r.name)}</option>`); 
            requirementsConfigCurrentSelection = getRequirementsConfigSelection();
            selectionOrder = [];
            trackInitialState();
            syncConfigActionButtons();
            loadReloadRequirementsOverrideSetting();
        } 
    }

    function hideLoadedRequirementsPrintButton() {
        loadedRequirementsForPrint = null;
        const printBtn = document.getElementById('printLoadedRequirementsBtn');
        if (printBtn) {
            printBtn.classList.add('hidden');
            printBtn.classList.remove('flex');
        }
    }

    function showLoadedRequirementsPrintButton(savedRequirements) {
        const printBtn = document.getElementById('printLoadedRequirementsBtn');
        if (!printBtn) return;
        if ((savedRequirements || []).length > 0) {
            printBtn.classList.remove('hidden');
            printBtn.classList.add('flex');
        } else {
            printBtn.classList.add('hidden');
            printBtn.classList.remove('flex');
        }
    }

    function printLoadedRequirements() {
        if (!loadedRequirementsForPrint || !(loadedRequirementsForPrint.requirements || []).length) return toast('No saved requirements to print.', 'error');
        const { projectType, requestee, stage, requirements } = loadedRequirementsForPrint;
        const rows = (requirements || []).length
          ? requirements.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${esc(item.name || item.doc_name || '-')}</td>
                <td></td>
              </tr>
            `).join('')
          : '<tr><td colspan="3">No document requirements configured yet.</td></tr>';
        openPrintableWindow('Requirements Config', `
          <h1>Document Requirements</h1>
          <div class="grid box">
            <div><b>Project type:</b> ${esc(projectType || '-')}</div>
            <div><b>Requestee:</b> ${esc(requestee || '-')}</div>
            <div><b>Stage:</b> ${esc(stage || '-')}</div>
            <div><b>Print date:</b> ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead><tr><th>No.</th><th>Requirement/document name</th><th>Remarks/check box</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `);
    }

    async function loadConfig(options = {}) {
        configMode = 'view';
        const pid = document.getElementById('reqType').value;
        const rid = document.getElementById('reqReq').value;
        const stage = document.getElementById('reqStageSelect').value;
        
        if(!pid || !rid) {
            hideLoadedRequirementsPrintButton();
            selectionOrder = [];
            trackInitialState();
            const dualPanelContainer = document.getElementById('dualPanelContainer');
            const searchContainer = document.getElementById('dualPanelSearchContainer');
            const legacyList = document.getElementById('reqList');
            if (dualPanelContainer) dualPanelContainer.classList.add('hidden');
            if (searchContainer) searchContainer.classList.add('hidden');
            if (legacyList) {
                legacyList.classList.remove('hidden');
                legacyList.innerHTML = '<li class="text-gray-500 text-center p-4 italic">Select a Project Type and Requestee to load requirements.</li>';
            }
            syncConfigActionButtons();
            if (!options.silentMissingSelection) toast('Please select Project Type and Requestee first.', 'error');
            return;
        }
        
        try {
            const data = await fetchJson(`${API}/settings/requirements?projectTypeId=${pid}&requesteeId=${rid}&stage=${encodeURIComponent(stage)}`, options.silentLoading ? { silentLoading: true } : undefined);
            const typeText = document.getElementById('reqType').options[document.getElementById('reqType').selectedIndex]?.text || '';
            const requesteeText = document.getElementById('reqReq').options[document.getElementById('reqReq').selectedIndex]?.text || '';
            const savedRequirements = [...(data || [])].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            loadedRequirementsForPrint = savedRequirements.length > 0
                ? { projectType: typeText, requestee: requesteeText, stage, requirements: savedRequirements }
                : null;
            showLoadedRequirementsPrintButton(savedRequirements);
            
            // Show requirement set header
            const headerContainer = document.getElementById('reqSetHeaderContainer');
            if (headerContainer) headerContainer.classList.remove('hidden');
            
            // Hide dual panel in view mode, show legacy list
            const dualPanelContainer = document.getElementById('dualPanelContainer');
            const searchContainer = document.getElementById('dualPanelSearchContainer');
            const legacyList = document.getElementById('reqList');
            if (dualPanelContainer) dualPanelContainer.classList.add('hidden');
            if (searchContainer) searchContainer.classList.add('hidden');
            if (legacyList) legacyList.classList.remove('hidden');
            
            renderRequirementsList(savedRequirements, { editable: false, emptyMessage: 'No saved requirements for this selection.' });
            requirementsConfigCurrentSelection = getRequirementsConfigSelection();
            trackInitialState();
            toggleSaveButton(false);
            syncConfigActionButtons();
        } catch(e) { toast(e.message, 'error'); }
    }

    async function loadReloadRequirementsOverrideSetting() {
        if (!(currentUser?.role === 'admin' || currentUser?.role === 'superadmin')) return;
        try {
            const data = await fetchJson(`${API}/settings/requirements/reload-override`, { silentLoading: true });
            reloadRequirementsOverrideEnabled = !!data.enabled;
            const toggle = document.getElementById('reloadRequirementsOverrideToggle');
            if (toggle) toggle.checked = reloadRequirementsOverrideEnabled;
        } catch (e) {}
    }

    async function toggleReloadRequirementsOverride(checkbox) {
        const enabled = !!checkbox.checked;
        try {
            const data = await fetchJson(`${API}/settings/requirements/reload-override`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            reloadRequirementsOverrideEnabled = !!data.enabled;
            checkbox.checked = reloadRequirementsOverrideEnabled;
            toast(`Reload Requirements ${reloadRequirementsOverrideEnabled ? 'enabled' : 'disabled'}`);
            if (currentProjId && activeDetailStage) loadDocs(currentProjId, activeDetailStage, { silent: true });
        } catch (e) {
            checkbox.checked = reloadRequirementsOverrideEnabled;
            toast(e.message, 'error');
        }
    }

    async function setConfig() {
        configMode = 'edit';
        hideLoadedRequirementsPrintButton();
        const pid = document.getElementById('reqType').value;
        const rid = document.getElementById('reqReq').value;
        const stage = document.getElementById('reqStageSelect').value;
        
        if(!pid || !rid) return toast('Please select Project Type and Requestee first.', 'error');
        
        // Show requirement set header
        const headerContainer = document.getElementById('reqSetHeaderContainer');
        if (headerContainer) headerContainer.classList.remove('hidden');
        
        try {
            const [docTypes, existingConfig] = await Promise.all([
                fetchJson(`${API}/settings/document-types`),
                fetchJson(`${API}/settings/requirements?projectTypeId=${pid}&requesteeId=${rid}&stage=${encodeURIComponent(stage)}`)
            ]);
            docCache = docTypes;
            // Use dual panel renderer for modern UI
            renderDualPanel(docTypes, existingConfig);
        } catch(e) { toast(e.message, 'error'); }
    }
