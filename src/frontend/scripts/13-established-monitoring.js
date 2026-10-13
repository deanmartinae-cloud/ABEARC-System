    // ESTABLISHED PROJECT & ASSET MONITORING
    // =========================
    let monitoringInventoryCache = [];
    let monitoringDashboardCache = null;
    let monitoringUsersCache = [];
    let monitoringSelectedId = null;
    let monitoringBadgeLastLoadedAt = 0;
    let monitoringScheduleSelectedUsers = [];
    let monitoringScheduleUserSearchOpen = false;
    let monitoringScheduleUserSearchActiveIndex = -1;
    let monitoringScheduleUserSearchTimer = null;
    let monitoringVisitDrivePhotos = [];
    let monitoringVisitSelectedDrivePhotoIds = [];
    let monitoringVisitDrivePhotosLoading = false;
    let monitoringVisitPhotoSource = 'manual';
    let monitoringVisitManualCaptureDates = [];
    let monitoringVisitManualDateReadId = 0;
    let monitoringVisitActiveItem = null;

    const monitoringInspectionChecklists = {
      'Machinery & Equipment': [
        ['engine_status', 'Engine status'], ['transmission_drive', 'Transmission / drive system'],
        ['hydraulic_system', 'Hydraulic system'], ['electrical_battery', 'Electrical system / battery'],
        ['safety_guards', 'Safety guards and controls'], ['lubrication_leaks', 'Lubrication and fluid leaks'],
        ['tires_tracks', 'Tires / tracks / mobility'], ['attachments', 'Attachments and accessories']
      ],
      Infrastructure: [
        ['structural_condition', 'Structural condition'], ['foundation_subgrade', 'Foundation / subgrade'],
        ['roofing_walls', 'Roofing, walls, and finishes'], ['drainage', 'Drainage and water protection'],
        ['electrical_plumbing', 'Electrical / plumbing services'], ['accessibility_safety', 'Accessibility and user safety'],
        ['signs_guards', 'Signs, railings, and protective guards'], ['erosion_surroundings', 'Erosion and surrounding site condition']
      ],
      'Irrigation System': [
        ['water_source', 'Water source and intake'], ['pump_condition', 'Pump condition'],
        ['conveyance', 'Pipes / canals / conveyance'], ['valves_outlets', 'Valves, gates, and outlets'],
        ['leaks_blockages', 'Leaks, siltation, and blockages'], ['power_supply', 'Power supply and controls'],
        ['distribution_performance', 'Water distribution performance'], ['irrigation_safety', 'Safety and protective devices']
      ],
      Facility: [
        ['structural_condition', 'Structural condition'], ['roof_condition', 'Roof and weather protection'],
        ['doors_windows', 'Doors, windows, and security'], ['electrical_system', 'Electrical system'],
        ['plumbing_drainage', 'Plumbing and drainage'], ['sanitation', 'Sanitation and cleanliness'],
        ['fire_safety', 'Fire and emergency safety'], ['facility_accessibility', 'Accessibility and usability']
      ],
      Vehicle: [
        ['engine_status', 'Engine status'], ['brake_system', 'Brake system'],
        ['steering_suspension', 'Steering and suspension'], ['transmission_drive', 'Transmission / drive system'],
        ['tires_wheels', 'Tires and wheels'], ['lights_electrical', 'Lights and electrical system'],
        ['body_chassis', 'Body and chassis'], ['vehicle_safety', 'Safety equipment and registration']
      ],
      Other: [
        ['physical_condition', 'Physical condition'], ['functional_performance', 'Functional performance'],
        ['completeness', 'Completeness of components'], ['asset_safety', 'Safety condition'],
        ['cleanliness_storage', 'Cleanliness and storage'], ['identification_markings', 'Identification and markings']
      ]
    };
    const monitoringInspectionStatuses = ['Good', 'Fair', 'Needs Attention', 'Not Functional', 'Not Applicable'];

    function monitoringInspectionType(assetType) {
      return monitoringInspectionChecklists[assetType] ? assetType : 'Other';
    }

    function renderMonitoringVisitInspection(item) {
      monitoringVisitActiveItem = item || null;
      const type = monitoringInspectionType(item?.asset_type);
      const typeLabel = document.getElementById('mvInspectionAssetType');
      const fields = document.getElementById('mvInspectionFields');
      if (typeLabel) typeLabel.textContent = item?.asset_type || type;
      if (!fields) return;
      fields.innerHTML = monitoringInspectionChecklists[type].map(([key, label]) => `<div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"><label class="block text-xs font-black text-gray-800 dark:text-gray-100">${esc(label)}<select required data-monitoring-inspection-status="${esc(key)}" class="mt-1.5 w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm"><option value="">Select status</option>${monitoringInspectionStatuses.map(status => `<option>${esc(status)}</option>`).join('')}</select></label><label class="block mt-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">Observation / remarks<input data-monitoring-inspection-remarks="${esc(key)}" maxlength="300" placeholder="Optional" class="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm font-normal"></label></div>`).join('');
    }

    function collectMonitoringVisitInspection() {
      const type = monitoringInspectionType(monitoringVisitActiveItem?.asset_type);
      return {
        version: 1,
        asset_type: monitoringVisitActiveItem?.asset_type || type,
        checklist_type: type,
        items: monitoringInspectionChecklists[type].map(([key, label]) => ({
          key,
          label,
          status: document.querySelector(`[data-monitoring-inspection-status="${key}"]`)?.value || '',
          remarks: document.querySelector(`[data-monitoring-inspection-remarks="${key}"]`)?.value?.trim?.() || ''
        }))
      };
    }

    function printMonitoringChecklist(type, item = null) {
      type = monitoringInspectionType(type || item?.asset_type);
      const rows = monitoringInspectionChecklists[type].map(([key, label], index) => `<tr><td>${index + 1}</td><td><strong>${esc(label)}</strong></td><td class="check-options">&#9633; Good&nbsp;&nbsp; &#9633; Fair&nbsp;&nbsp; &#9633; Needs Attention&nbsp;&nbsp; &#9633; Not Functional&nbsp;&nbsp; &#9633; N/A</td><td>&nbsp;</td></tr>`).join('');
      const assetType = item?.asset_type || type;
      openPrintableWindow(`${assetType} Monitoring Checklist`, `<h1>ABEARC Asset Monitoring Inspection Checklist</h1><div class="grid box"><div><b>Asset type:</b> ${esc(assetType)}</div><div><b>Inventory code:</b> ${esc(item?.inventory_code || '____________________')}</div><div><b>Asset / project:</b> ${esc(item?.asset_name || '________________________________________')}</div><div><b>Recipient:</b> ${esc(item?.recipient_organization || '________________________________________')}</div><div><b>Location:</b> ${esc(item ? ([item.purok, item.barangay, item.district].filter(Boolean).join(', ') || '-') : '________________________________________')}</div><div><b>Inspection date:</b> ____________________</div><div><b>Inspector:</b> ____________________</div><div><b>Visit type:</b> ____________________</div></div><h2>${esc(assetType)} Inspection Points</h2><table><thead><tr><th style="width:5%">No.</th><th style="width:24%">Inspection point</th><th style="width:46%">Condition</th><th>Observation / remarks</th></tr></thead><tbody>${rows}</tbody></table><div class="box"><b>Overall condition:</b> _______________________________________________<br><br><b>Findings:</b><br><br><br><b>Actions taken / recommendations:</b><br><br><br><b>Inspector signature:</b> ____________________ &nbsp;&nbsp; <b>Recipient representative:</b> ____________________</div>`);
    }

    function printMonitoringVisitChecklist() {
      if (!monitoringVisitActiveItem) return toast('Open a monitoring visit first.', 'error');
      printMonitoringChecklist(monitoringVisitActiveItem.asset_type, monitoringVisitActiveItem);
    }

    function openMonitoringChecklistExport() {
      const modal = document.getElementById('monitoringChecklistExportModal');
      if (!modal) return;
      document.getElementById('monitoringChecklistExportType').value = 'Machinery & Equipment';
      modal.classList.remove('hidden');
    }

    function exportMonitoringChecklistTemplate() {
      const type = monitoringValue('monitoringChecklistExportType');
      closeModal('monitoringChecklistExportModal');
      printMonitoringChecklist(type);
    }

    function monitoringInspectionHistoryHtml(data) {
      const items = Array.isArray(data?.items) ? data.items : [];
      if (!items.length) return '';
      return `<details class="mt-2"><summary class="cursor-pointer text-xs font-black text-cyan-700 dark:text-cyan-300">View ${esc(data.asset_type || 'asset')} checklist</summary><div class="mt-2 space-y-1">${items.map(entry => `<div class="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5"><div class="flex justify-between gap-2 text-xs"><span class="font-bold">${esc(entry.label || entry.key || '-')}</span><span class="font-black">${esc(entry.status || '-')}</span></div>${entry.remarks ? `<div class="mt-1 text-[11px] text-gray-500">${esc(entry.remarks)}</div>` : ''}</div>`).join('')}</div></details>`;
    }

    const monitoringValue = (id) => document.getElementById(id)?.value?.trim?.() || '';
    const monitoringDateLabel = (value) => value ? fmtDateOnly(value) : '-';
    const monitoringPriorityClasses = (priority) => ({
      Critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      High: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
      Medium: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      Low: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
    }[priority] || 'bg-gray-100 text-gray-700 border-gray-200');
    const monitoringDueClasses = (status) => ({
      'Never Monitored': 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
      'Overdue': 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
      'Due Soon': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      'Current': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    }[status] || 'bg-gray-100 text-gray-700');
    const monitoringIcons = {
      inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5h14v14H5zM8 9h8M8 13h8M8 17h5"/></svg>',
      operational: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.3 4.7 3.6 16.3A2 2 0 0 0 5.3 19h13.4a2 2 0 0 0 1.7-2.7L13.7 4.7a2 2 0 0 0-3.4 0Z"/></svg>',
      history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2"/></svg>',
      overdue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7v6m0 4h.01"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z"/></svg>',
      tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01"/></svg>',
      priority: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 21V4m0 1h11l-2 4 2 4H5"/></svg>',
      open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5"/></svg>',
      visit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h3"/></svg>',
      schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z"/></svg>',
      more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>'
    };

    async function refreshMonitoringSidebarBadge(force = false) {
      const badge = document.getElementById('monitoringSidebarBadge');
      if (!badge) return;
      if (!currentUser || !hasPrivilege('view_monitoring_inventory')) {
        badge.classList.add('hidden');
        return;
      }
      if (!force && Date.now() - monitoringBadgeLastLoadedAt < 60000) return;
      try {
        monitoringDashboardCache = await fetchJson(`${API}/monitoring/dashboard`, { silentLoading: true });
        monitoringBadgeLastLoadedAt = Date.now();
        updateMonitoringSidebarBadge();
      } catch (_) {}
    }

    async function showMonitoringInventory(pushHistory = true) {
      if (!currentUser) return showAuthView();
      if (!hasPrivilege('view_monitoring_inventory')) return toast('Permission denied: view_monitoring_inventory', 'error');
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      navigateTo('monitoring', {}, pushHistory);
      setSidebarActive('monitoring');
      document.getElementById('monitoringAddBtn')?.classList.toggle('hidden', !hasPrivilege('add_monitoring_inventory'));
      document.getElementById('monitoringImportBtn')?.classList.toggle('hidden', !hasPrivilege('import_monitoring_inventory'));
      document.getElementById('monitoringExportBtn')?.classList.toggle('hidden', !hasPrivilege('export_monitoring_reports'));
      document.getElementById('monitoringChecklistExportBtn')?.classList.toggle('hidden', !hasPrivilege('export_monitoring_reports'));
      await loadMonitoringInventory();
    }

    async function loadMonitoringUsers() {
      if (monitoringUsersCache.length) return monitoringUsersCache;
      try {
        if (typeof ensureCalendarUsers === 'function') monitoringUsersCache = await ensureCalendarUsers();
        else monitoringUsersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, { silentLoading: true }));
      } catch (_) { monitoringUsersCache = []; }
      return monitoringUsersCache;
    }

    async function loadMonitoringInventory() {
      setMonitoringInventoryLoading();
      try {
        const [dashboard, items] = await Promise.all([
          fetchJson(`${API}/monitoring/dashboard`, { silentLoading: true }),
          fetchJson(`${API}/monitoring/inventory`, { silentLoading: true })
        ]);
        monitoringDashboardCache = dashboard;
        monitoringBadgeLastLoadedAt = Date.now();
        monitoringInventoryCache = items || [];
        renderMonitoringDashboard();
        renderMonitoringFilterOptions();
        renderMonitoringInventory();
        updateMonitoringSidebarBadge();
      } catch (error) {
        setMonitoringInventoryError(error.message);
        toast(error.message, 'error');
      }
    }

    function setMonitoringInventoryLoading() {
      const summary = document.getElementById('monitoringListSummary');
      const body = document.getElementById('monitoringInventoryTable');
      const mobile = document.getElementById('monitoringInventoryMobile');
      const grid = document.getElementById('monitoringKpiGrid');
      const empty = document.getElementById('monitoringEmpty');
      if (summary) summary.textContent = 'Loading records...';
      if (empty) empty.classList.add('hidden');
      if (grid) grid.innerHTML = Array.from({ length: 8 }, () => '<div class="monitoring-kpi-card"><div class="monitoring-skeleton h-3 w-20"></div><div class="monitoring-skeleton h-7 w-12 mt-3"></div><div class="monitoring-skeleton h-2 w-24 mt-2"></div></div>').join('');
      if (body) body.innerHTML = Array.from({ length: 5 }, () => '<tr aria-hidden="true"><td colspan="8"><div class="monitoring-skeleton h-10 w-full"></div></td></tr>').join('');
      if (mobile) mobile.innerHTML = Array.from({ length: 3 }, () => '<div class="monitoring-mobile-card" aria-hidden="true"><div class="monitoring-skeleton h-4 w-24"></div><div class="monitoring-skeleton h-5 w-3/4 mt-2"></div><div class="monitoring-skeleton h-16 w-full mt-3"></div></div>').join('');
    }

    function setMonitoringInventoryError(message) {
      const body = document.getElementById('monitoringInventoryTable');
      const mobile = document.getElementById('monitoringInventoryMobile');
      const empty = document.getElementById('monitoringEmpty');
      if (body) body.innerHTML = '';
      if (mobile) mobile.innerHTML = '';
      if (!empty) return;
      empty.classList.remove('hidden');
      empty.innerHTML = `${monitoringIcons.warning}<strong>Inventory could not be loaded</strong><p>${esc(message || 'Try loading the page again.')}</p><button type="button" onclick="loadMonitoringInventory()" class="monitoring-btn monitoring-btn-secondary">Try again</button>`;
    }

    function updateMonitoringSidebarBadge() {
      const badge = document.getElementById('monitoringSidebarBadge');
      if (!badge) return;
      const count = Number(monitoringDashboardCache?.counts?.critical || 0) + Number(monitoringDashboardCache?.counts?.high || 0);
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', !count);
    }

    function showMonitoringPriorityQueueInfo() {
      openConfirmModal(
        '<div class="space-y-2 text-sm"><p>The queue shows records that need attention first. Priority override is followed first when set.</p><p><strong>Critical</strong>: has an open critical task, or the condition is non-operational, irreparable, unsafe, or missing asset.</p><p><strong>High</strong>: never monitored, unverified condition, no condition recorded, or more than 90 days overdue.</p><p><strong>Medium</strong>: overdue up to 90 days, due within 60 days, newly delivered, or has open follow-up tasks.</p><p><strong>Low</strong>: current, monitored, and no open issue pushing it higher.</p><p>The queue sorts Critical, High, then Medium first, with older due dates shown first within the same priority.</p></div>',
        null,
        { title: 'Priority Visit Queue', confirmText: 'OK', confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium' }
      );
    }

    const monitoringMetricInfo = {
      Total: 'All active and archived inventory records currently tracked in Established Projects Monitoring.',
      Operational: 'Inventory records whose latest condition is marked Operational or Functional.',
      'Non-operational': 'Inventory records whose latest condition indicates a critical condition, such as non-operational, irreparable, unsafe, or missing asset.',
      'Never monitored': 'Inventory records with no completed monitoring visit history yet.',
      Overdue: 'Inventory records whose next monitoring date is already past.',
      'Due soon': 'Inventory records whose next monitoring date is within the next 60 days.',
      'Open tasks': 'Unresolved monitoring follow-up tasks that are not completed, closed, or cancelled.',
      'High priority': 'Inventory records tagged Critical or High by the priority rules.'
    };

    function renderMonitoringDashboard() {
      const c = monitoringDashboardCache?.counts || {};
      const metrics = [
        ['Total', c.total || 0, 'All inventory', 'inventory', 'brand'], ['Operational', c.operational || 0, 'Operational / functional', 'operational', 'success'],
        ['Non-operational', c.non_operational || 0, 'Critical condition', 'warning', 'danger'], ['Never monitored', c.never_monitored || 0, 'No monitoring history', 'history', 'warning'],
        ['Overdue', c.overdue || 0, 'Past next monitoring', 'overdue', 'danger'], ['Due soon', c.due_soon || 0, 'Within 60 days', 'calendar', 'warning'],
        ['Open tasks', c.open_tasks || 0, 'Unresolved follow-ups', 'tasks', 'brand'], ['High priority', (c.critical || 0) + (c.high || 0), 'Critical + high', 'priority', 'danger']
      ];
      const grid = document.getElementById('monitoringKpiGrid');
      if (grid) grid.innerHTML = metrics.map(([label, value, sub, icon, tone], index) => {
        const tooltipId = `monitoringMetricTooltip${index}`;
        const info = monitoringMetricInfo[label] || 'This metric summarizes monitoring inventory records.';
        return `<button type="button" class="monitoring-kpi-card" data-tone="${tone}" onclick="this.blur(); showMonitoringMetricDetails('${encodeURIComponent(label)}')" aria-describedby="${tooltipId}"><div class="monitoring-kpi-card__head"><span class="monitoring-kpi-card__label">${esc(label)}</span></div><div class="monitoring-kpi-card__value-row"><span class="monitoring-kpi-card__icon" aria-hidden="true">${monitoringIcons[icon]}</span><div class="monitoring-kpi-card__value">${Number(value)}</div></div><div class="monitoring-kpi-card__sub">${esc(sub)}</div><div id="${tooltipId}" class="monitoring-kpi-card__tooltip" role="tooltip"><strong>${esc(label)}</strong><span>${esc(info)}</span></div></button>`;
      }).join('');
      const analytics = document.getElementById('monitoringAnalyticsGrid');
      if (analytics) {
        const panels = [
          ['Condition profile', monitoringDashboardCache?.by_status || [], 'status'],
          ['District monitoring load', monitoringDashboardCache?.by_district || [], 'district'],
          ['Inventory by type', monitoringDashboardCache?.by_type || [], 'type']
        ];
        analytics.innerHTML = panels.map(([title, rows, kind]) => `<article class="enterprise-card overflow-hidden monitoring-breakdown-card"><div class="monitoring-breakdown-card__header">${esc(title)}</div><div class="monitoring-breakdown-card__list">${rows.slice(0,8).map(row=>`<button type="button" class="monitoring-breakdown-row" onclick="showMonitoringBreakdown('${kind}', '${encodeURIComponent(String(row.name)).replace(/'/g, '%27')}')" aria-label="Show ${esc(row.name)} inventory"><span title="${esc(row.name)}">${esc(row.name)}</span><strong>${Number(row.count||0)}</strong></button>`).join('') || '<div class="monitoring-breakdown-empty">No data.</div>'}</div></article>`).join('');
      }
      const queue = document.getElementById('monitoringPriorityQueue');
      if (queue) {
        const rows = monitoringDashboardCache?.priority_queue || [];
        queue.innerHTML = rows.length ? rows.map(item => `<button type="button" onclick="openMonitoringDetail(${item.id})" class="monitoring-priority-item"><div class="monitoring-priority-item__top"><span class="monitoring-code">${esc(item.inventory_code)}</span><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span></div><div class="monitoring-priority-item__name">${esc(item.asset_name)}</div><div class="monitoring-priority-item__meta">${esc(item.recipient_organization || 'No recipient')} · ${esc(item.barangay || item.district || 'Location missing')}</div><div class="monitoring-status-stack"><span class="monitoring-badge ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span></div></button>`).join('') : `<div class="monitoring-empty-state !py-10">${monitoringIcons.operational}<strong>No priority visits</strong><p>Critical, high-priority, and overdue records will appear here.</p></div>`;
      }
    }

    function setSelectOptions(id, values, firstLabel) {
      const el = document.getElementById(id); if (!el) return;
      const current = el.value;
      el.innerHTML = `<option value="">${esc(firstLabel)}</option>` + [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))).map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
      if ([...el.options].some(option => option.value === current)) el.value = current;
    }

    function renderMonitoringFilterOptions() {
      setSelectOptions('monitoringTypeFilter', monitoringInventoryCache.map(item => item.asset_type), 'All types');
      setSelectOptions('monitoringStatusFilter', monitoringInventoryCache.map(item => item.condition_status || 'Unverified'), 'All conditions');
      setSelectOptions('monitoringDistrictFilter', monitoringInventoryCache.map(item => item.district || 'Unspecified'), 'All districts');
      const assignee = document.getElementById('monitoringAssigneeFilter');
      if (assignee) {
        const current = assignee.value;
        const names = [...new Map(monitoringInventoryCache.filter(item => item.assigned_user_id && item.assigned_username).map(item => [String(item.assigned_user_id), item.assigned_username])).entries()];
        assignee.innerHTML = '<option value="">All assignees</option><option value="__me__">My assignments</option><option value="__unassigned__">Unassigned</option>' + names.sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
        if ([...assignee.options].some(option => option.value === current)) assignee.value = current;
      }
    }

    function filteredMonitoringInventory() {
      const q = monitoringValue('monitoringSearch').toLowerCase();
      const type = monitoringValue('monitoringTypeFilter');
      const status = monitoringValue('monitoringStatusFilter');
      const district = monitoringValue('monitoringDistrictFilter');
      const priority = monitoringValue('monitoringPriorityFilter');
      const due = monitoringValue('monitoringDueFilter');
      const lifecycle = monitoringValue('monitoringLifecycleFilter');
      const assignee = monitoringValue('monitoringAssigneeFilter');
      return monitoringInventoryCache.filter(item => {
        const haystack = [item.inventory_code,item.asset_name,item.asset_type,item.recipient_organization,item.barangay,item.district,item.registration_no,item.machine_serial_no,item.source_of_fund].join(' ').toLowerCase();
        return (!q || haystack.includes(q)) && (!type || item.asset_type === type) && (!status || (item.condition_status || 'Unverified') === status) && (!district || (item.district || 'Unspecified') === district) && (!priority || item.computed_priority === priority) && (!due || item.due_status === due) && (!lifecycle || (item.lifecycle_status || 'Active') === lifecycle) && (!assignee || (assignee === '__me__' ? Number(item.assigned_user_id || 0) === Number(currentUser?.id || 0) : assignee === '__unassigned__' ? !Number(item.assigned_user_id || 0) : Number(item.assigned_user_id || 0) === Number(assignee)));
      }).sort((a,b) => ({Critical:1,High:2,Medium:3,Low:4}[a.computed_priority]-({Critical:1,High:2,Medium:3,Low:4}[b.computed_priority])) || String(a.next_monitoring_date || '').localeCompare(String(b.next_monitoring_date || '')) || a.inventory_code.localeCompare(b.inventory_code));
    }

    function renderMonitoringInventory() {
      const items = filteredMonitoringInventory();
      const summary = document.getElementById('monitoringListSummary');
      if (summary) summary.textContent = `${items.length} of ${monitoringInventoryCache.length} records shown`;
      const body = document.getElementById('monitoringInventoryTable');
      const mobile = document.getElementById('monitoringInventoryMobile');
      const empty = document.getElementById('monitoringEmpty');
      syncMonitoringFilterControls();
      if (empty) {
        empty.classList.toggle('hidden', items.length > 0);
        if (!items.length) empty.innerHTML = `${monitoringIcons.inventory}<strong>No inventory records found</strong><p>${monitoringInventoryCache.length ? 'No records match the current search and filters.' : 'Add the first established project or asset to begin monitoring.'}</p>${monitoringInventoryCache.length ? '<button type="button" onclick="clearMonitoringFilters()" class="monitoring-btn monitoring-btn-secondary">Clear filters</button>' : ''}`;
      }
      const rowActions = item => `<div class="monitoring-row-actions" onclick="event.stopPropagation()">${item.lifecycle_status!=='Archived' && hasPrivilege('conduct_monitoring_visit')?`<button type="button" class="monitoring-row-action" onclick="openMonitoringVisitModal(${item.id})" aria-label="Record visit for ${esc(item.inventory_code)}" title="Record visit">${monitoringIcons.visit}</button>`:''}${item.lifecycle_status!=='Archived' && hasPrivilege('schedule_monitoring_visit')?`<button type="button" class="monitoring-row-action" onclick="openMonitoringScheduleModal(${item.id})" aria-label="Schedule visit for ${esc(item.inventory_code)}" title="Schedule visit">${monitoringIcons.schedule}</button>`:''}</div>`;
      if (body) body.innerHTML = items.map(item => `<tr role="button" tabindex="0" aria-label="Open ${esc(item.inventory_code)} ${esc(item.asset_name)}" onclick="openMonitoringDetail(${item.id})" onkeydown="if ((event.key === 'Enter' || event.key === ' ') && event.target === this) { event.preventDefault(); openMonitoringDetail(${item.id}); }"><td><div class="monitoring-code">${esc(item.inventory_code)}</div><div class="monitoring-asset-name">${esc(item.asset_name)}</div><div class="monitoring-cell-secondary">${esc(item.asset_type)}</div></td><td><div class="monitoring-cell-primary">${esc(item.recipient_organization || '-')}</div><div class="monitoring-cell-secondary">${esc([item.purok,item.barangay,item.district].filter(Boolean).join(', ') || '-')}</div></td><td><div class="monitoring-cell-primary">${esc(item.condition_status || 'Unverified')}</div><div class="monitoring-status-stack"><span class="monitoring-lifecycle ${item.lifecycle_status==='Archived'?'is-archived':''}">${esc(item.lifecycle_status || 'Active')}</span></div></td><td><div class="monitoring-cell-primary">${monitoringDateLabel(item.last_monitoring_date)}</div><div class="monitoring-cell-secondary">${Number(item.visit_count || 0)} visit${Number(item.visit_count || 0) === 1 ? '' : 's'}</div></td><td><div class="monitoring-cell-primary">${monitoringDateLabel(item.next_monitoring_date)}</div><div class="monitoring-status-stack"><span class="monitoring-badge ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span></div></td><td><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span></td><td class="text-center"><span class="monitoring-task-count" title="Open follow-up tasks">${Number(item.open_task_count || 0)}</span></td><td class="text-right">${rowActions(item)}</td></tr>`).join('');
      if (mobile) mobile.innerHTML = items.map(item => `<article role="button" tabindex="0" aria-label="Open ${esc(item.inventory_code)} ${esc(item.asset_name)}" onclick="openMonitoringDetail(${item.id})" onkeydown="if ((event.key === 'Enter' || event.key === ' ') && event.target === this) { event.preventDefault(); openMonitoringDetail(${item.id}); }" class="monitoring-mobile-card"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="monitoring-code">${esc(item.inventory_code)}</div><div class="monitoring-asset-name">${esc(item.asset_name)}</div><div class="monitoring-cell-secondary">${esc(item.recipient_organization || '-')} · ${esc(item.barangay || item.district || '-')}</div></div><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span></div><div class="monitoring-mobile-meta"><div><span>Condition</span><strong>${esc(item.condition_status || 'Unverified')}</strong></div><div><span>Due status</span><strong>${esc(item.due_status)}</strong></div><div><span>Last monitored</span><strong>${monitoringDateLabel(item.last_monitoring_date)}</strong></div><div><span>Next monitoring</span><strong>${monitoringDateLabel(item.next_monitoring_date)}</strong></div></div><div class="monitoring-mobile-actions"><button type="button" onclick="event.stopPropagation(); openMonitoringDetail(${item.id})">Open details</button>${item.lifecycle_status!=='Archived' && hasPrivilege('conduct_monitoring_visit')?`<button type="button" onclick="event.stopPropagation(); openMonitoringVisitModal(${item.id})" class="is-primary">Record visit</button>`:''}</div></article>`).join('');
    }

    function monitoringActiveFilterCount() {
      return ['monitoringSearch','monitoringTypeFilter','monitoringStatusFilter','monitoringDistrictFilter','monitoringPriorityFilter','monitoringDueFilter','monitoringLifecycleFilter','monitoringAssigneeFilter'].filter(id => monitoringValue(id)).length;
    }

    function syncMonitoringFilterControls() {
      const count = monitoringActiveFilterCount();
      const countBadge = document.querySelector('[data-monitoring-filter-count]');
      const clearButton = document.querySelector('[data-monitoring-clear-filters]');
      if (countBadge) {
        countBadge.textContent = String(count);
        countBadge.classList.toggle('hidden', !count);
      }
      if (clearButton) clearButton.disabled = !count;
    }

    function toggleMonitoringFilters(forceOpen = null) {
      const panel = document.querySelector('[data-monitoring-filter-panel]');
      const toggle = document.querySelector('[data-monitoring-filter-toggle]');
      if (!panel || !toggle) return;
      const open = forceOpen == null ? !panel.classList.contains('is-open') : Boolean(forceOpen);
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    function clearMonitoringFilters() {
      ['monitoringSearch','monitoringTypeFilter','monitoringStatusFilter','monitoringDistrictFilter','monitoringPriorityFilter','monitoringDueFilter','monitoringLifecycleFilter','monitoringAssigneeFilter'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      renderMonitoringInventory();
    }

    window.showMonitoringMetricDetails = function(encodedLabel) {
      const label = decodeURIComponent(String(encodedLabel || ''));
      const activeItems = monitoringInventoryCache.filter(item => item.lifecycle_status !== 'Archived');
      let items;
      if (label === 'Total') items = [...monitoringInventoryCache];
      else if (label === 'Operational') items = activeItems.filter(item => /operational|functional/i.test(String(item.condition_status || '')) && !/non[- ]?operational/i.test(String(item.condition_status || '')));
      else if (label === 'Non-operational') items = activeItems.filter(item => /non[- ]?operational|irreparable|unsafe/i.test(String(item.condition_status || '')));
      else if (label === 'Never monitored') items = activeItems.filter(item => item.due_status === 'Never Monitored');
      else if (label === 'Overdue') items = activeItems.filter(item => item.due_status === 'Overdue');
      else if (label === 'Due soon') items = activeItems.filter(item => item.due_status === 'Due Soon');
      else if (label === 'Open tasks') items = activeItems.filter(item => Number(item.open_task_count || 0) > 0);
      else if (label === 'High priority') items = activeItems.filter(item => ['Critical', 'High'].includes(item.computed_priority));
      else items = [];
      const rank = { Critical: 1, High: 2, Medium: 3, Low: 4 };
      items.sort((a, b) => (rank[a.computed_priority] || 9) - (rank[b.computed_priority] || 9)
        || String(a.next_monitoring_date || '').localeCompare(String(b.next_monitoring_date || ''))
        || String(a.inventory_code || '').localeCompare(String(b.inventory_code || '')));
      const openTaskCount = items.reduce((sum, item) => sum + Number(item.open_task_count || 0), 0);
      document.querySelector('[data-monitoring-breakdown-title]').textContent = `${label} metric`;
      document.querySelector('[data-monitoring-breakdown-summary]').textContent = label === 'Open tasks'
        ? `${openTaskCount} open task${openTaskCount === 1 ? '' : 's'} across ${items.length} inventory record${items.length === 1 ? '' : 's'}`
        : `${items.length} inventory record${items.length === 1 ? '' : 's'}`;
      document.querySelector('[data-monitoring-breakdown-content]').innerHTML = items.length
        ? `<div class="space-y-2">${items.map(item => `<button type="button" onclick="openMonitoringBreakdownItem(${item.id})" class="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-cyan-500 dark:hover:border-cyan-400"><div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><div class="monitoring-code">${esc(item.inventory_code)}</div><div class="font-black text-gray-900 dark:text-gray-100 truncate">${esc(item.asset_name)}</div><div class="text-xs text-gray-500">${esc([item.recipient_organization, item.barangay, item.district].filter(Boolean).join(' · ') || 'Location missing')}</div></div><div class="flex flex-wrap gap-1"><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span><span class="monitoring-badge ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span>${label === 'Open tasks' ? `<span class="monitoring-task-count" title="Open follow-up tasks">${Number(item.open_task_count || 0)}</span>` : ''}</div></div></button>`).join('')}</div>`
        : '<div class="text-sm text-gray-500">No inventory records found for this metric.</div>';
      document.querySelector('[data-monitoring-breakdown-modal]').classList.remove('hidden');
    };

    window.showMonitoringBreakdown = function(kind, encodedName) {
      const fields = { status: item => item.condition_status || 'Unverified', district: item => item.district || 'Unspecified', type: item => item.asset_type };
      const titles = { status: 'Condition profile', district: 'District monitoring load', type: 'Inventory by type' };
      if (!fields[kind]) return;
      const name = decodeURIComponent(String(encodedName || ''));
      const items = monitoringInventoryCache.filter(item => fields[kind](item) === name);
      const countRows = (rows, labelFn) => [...rows.reduce((map, item) => {
        const label = labelFn(item) || 'Unspecified';
        map.set(label, (map.get(label) || 0) + 1);
        return map;
      }, new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const summaryList = (rows, clickFn = null) => rows.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${rows.map(([label,count]) => {
        const content = `<div class="text-xs font-bold text-gray-500 truncate">${esc(label)}</div><div class="text-lg font-black text-gray-900 dark:text-gray-100">${Number(count)}</div>`;
        return clickFn ? `<button type="button" onclick="${clickFn(label)}" class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-left hover:border-cyan-500 dark:hover:border-cyan-400">${content}</button>` : `<div class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">${content}</div>`;
      }).join('')}</div>` : '<div class="text-sm text-gray-500">No matching records.</div>';
      const machines = items.filter(item => /machinery|equipment/i.test(String(item.asset_type || '')));
      const summaryOnly = ['status', 'district'].includes(kind);
      const analysis = summaryOnly ? `<div class="space-y-3"><section><div class="text-xs font-black uppercase text-gray-500 mb-2">Asset type mix</div>${summaryList(countRows(items, item => item.asset_type))}</section><section><div class="text-xs font-black uppercase text-gray-500 mb-2">Machinery &amp; Equipment breakdown</div>${summaryList(countRows(machines, item => item.asset_subtype || item.asset_name), label => `showMonitoringMachineBreakdown('${kind}', '${encodeURIComponent(name).replace(/'/g, '%27')}', '${encodeURIComponent(label).replace(/'/g, '%27')}')`)}</section></div>` : '';
      document.querySelector('[data-monitoring-breakdown-title]').textContent = `${titles[kind]}: ${name}`;
      document.querySelector('[data-monitoring-breakdown-summary]').textContent = `${items.length} inventory record${items.length === 1 ? '' : 's'}`;
      document.querySelector('[data-monitoring-breakdown-content]').innerHTML = items.length ? (summaryOnly ? analysis : `<div class="space-y-2">${items.map(item => `<button type="button" onclick="openMonitoringBreakdownItem(${item.id})" class="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-cyan-500 dark:hover:border-cyan-400"><div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><div class="monitoring-code">${esc(item.inventory_code)}</div><div class="font-black text-gray-900 dark:text-gray-100 truncate">${esc(item.asset_name)}</div><div class="text-xs text-gray-500">${esc([item.recipient_organization, item.barangay, item.district].filter(Boolean).join(' · ') || 'Location missing')}</div></div><div class="flex flex-wrap gap-1"><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span><span class="monitoring-badge ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span></div></div></button>`).join('')}</div>`) : '<div class="text-sm text-gray-500">No inventory records found.</div>';
      document.querySelector('[data-monitoring-breakdown-modal]').classList.remove('hidden');
    };

    window.showMonitoringMachineBreakdown = function(kind, encodedName, encodedLabel) {
      const fields = { status: item => item.condition_status || 'Unverified', district: item => item.district || 'Unspecified' };
      if (!fields[kind]) return;
      const name = decodeURIComponent(String(encodedName || ''));
      const label = decodeURIComponent(String(encodedLabel || ''));
      const items = monitoringInventoryCache.filter(item => fields[kind](item) === name && /machinery|equipment/i.test(String(item.asset_type || '')) && (item.asset_subtype || item.asset_name || 'Unspecified') === label);
      document.querySelector('[data-monitoring-breakdown-title]').textContent = `${name}: ${label}`;
      document.querySelector('[data-monitoring-breakdown-summary]').textContent = `${items.length} inventory record${items.length === 1 ? '' : 's'}`;
      document.querySelector('[data-monitoring-breakdown-content]').innerHTML = items.length ? `<div class="space-y-2">${items.map(item => `<button type="button" onclick="openMonitoringBreakdownItem(${item.id})" class="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-cyan-500 dark:hover:border-cyan-400"><div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><div class="monitoring-code">${esc(item.inventory_code)}</div><div class="font-black text-gray-900 dark:text-gray-100 truncate">${esc(item.asset_name)}</div><div class="text-xs text-gray-500">${esc([item.recipient_organization, item.barangay, item.district].filter(Boolean).join(' · ') || 'Location missing')}</div></div><div class="flex flex-wrap gap-1"><span class="monitoring-badge ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span><span class="monitoring-badge ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span></div></div></button>`).join('')}</div>` : '<div class="text-sm text-gray-500">No inventory records found.</div>';
    };

    window.closeMonitoringBreakdownModal = function() {
      document.querySelector('[data-monitoring-breakdown-modal]')?.classList.add('hidden');
    };

    window.openMonitoringBreakdownItem = function(id) {
      closeMonitoringBreakdownModal();
      openMonitoringDetail(id);
    };

    async function populateMonitoringUserSelects(selected = {}) {
      const users = await loadMonitoringUsers();
      ['miAssignedUser','mvTaskAssignee','mtAssignee'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = '<option value="">Unassigned</option>' + users.map(user => `<option value="${user.id}">${esc(calendarUserDisplayName(user))}</option>`).join('');
        if (selected[id]) el.value = String(selected[id]);
      });
    }

    async function populateMonitoringProjectSelect(selectedId = '') {
      const el = document.getElementById('miLinkedProject');
      if (!el) return;
      if (!Array.isArray(projCache) || !projCache.length) {
        projCache = await fetchJson(`${API}/projects`, { silentLoading: true }).catch(() => []);
      }
      el.innerHTML = '<option value="">No linked project</option>' + (projCache || []).map(project => `<option value="${project.id}">${esc(project.name)}</option>`).join('');
      el.value = selectedId ? String(selectedId) : '';
    }

    const monitoringMachineSpecFieldIds = [
      'miMachineBrand', 'miMachineModel', 'miMachineSerial', 'miEngineBrand',
      'miEngineModel', 'miEngineSerial', 'miEngineMake', 'miRatedPower'
    ];

    function monitoringAssetUsesMachineSpecs(assetType) {
      return /machinery|equipment|vehicle/i.test(String(assetType || ''));
    }

    window.syncMonitoringMachineSpecsVisibility = function() {
      const assetType = monitoringValue('miAssetType');
      const visible = monitoringAssetUsesMachineSpecs(assetType);
      const section = document.querySelector('[data-monitoring-machine-specs-section]');
      section?.classList.toggle('hidden', !visible);
      section?.setAttribute('aria-hidden', String(!visible));
      monitoringMachineSpecFieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.disabled = !visible;
      });
      const title = section?.querySelector('[data-monitoring-machine-specs-title]');
      if (title) title.textContent = assetType === 'Vehicle' ? 'Vehicle / engine specifications' : 'Machinery / equipment specifications';
    };

    async function openMonitoringInventoryForm(id = null) {
      if (id && !hasPrivilege('edit_monitoring_inventory')) return toast('Permission denied: edit_monitoring_inventory', 'error');
      if (!id && !hasPrivilege('add_monitoring_inventory')) return toast('Permission denied: add_monitoring_inventory', 'error');
      document.getElementById('monitoringInventoryForm').reset();
      document.getElementById('monitoringEditId').value = id || '';
      document.getElementById('miFrequency').value = 12;
      document.getElementById('monitoringInventoryFormTitle').textContent = id ? 'Edit Monitoring Inventory' : 'Add Monitoring Inventory';
      let item = null;
      if (id) item = (await fetchJson(`${API}/monitoring/inventory/${id}`, { silentLoading: true })).item;
      await populateMonitoringUserSelects({ miAssignedUser: item?.assigned_user_id });
      await populateMonitoringProjectSelect(item?.linked_project_id);
      const map = {
        miAssetType:'asset_type',miAssetSubtype:'asset_subtype',miAssetName:'asset_name',miAssetDescription:'asset_description',miInventoryCode:'inventory_code',miConditionStatus:'condition_status',miFrequency:'monitoring_frequency_months',miRecipient:'recipient_organization',miCommodity:'commodity',miSourceFund:'source_of_fund',miYearFunded:'year_funded',miRegistration:'registration_no',miSupplier:'supplier',miProjectCost:'project_cost',miDateCompleted:'date_completed',miWarrantyExpiry:'warranty_expiry',miResponsibleOffice:'responsible_office',miServiceArea:'service_area',miCapacity:'capacity',miMachineBrand:'machine_brand',miMachineModel:'machine_model',miMachineSerial:'machine_serial_no',miEngineBrand:'engine_brand',miEngineModel:'engine_model',miEngineSerial:'engine_serial_no',miEngineMake:'engine_make',miRatedPower:'rated_power',miContactPerson:'contact_person',miDesignation:'designation',miContactNo:'contact_no',miDateReceived:'date_received',miPurok:'purok',miBarangay:'barangay',miDistrict:'district',miLatitude:'latitude',miLongitude:'longitude',miPriorityOverride:'priority_override',miNotes:'notes'
      };
      const newItemDefaults = { miAssetType: 'Machinery & Equipment', miConditionStatus: 'Unverified', miFrequency: 12 };
      Object.entries(map).forEach(([elId,field]) => {
        const el = document.getElementById(elId);
        if (el) el.value = item ? (item[field] ?? '') : (newItemDefaults[elId] ?? '');
      });
      syncMonitoringMachineSpecsVisibility();
      document.getElementById('monitoringInventoryFormModal').classList.remove('hidden');
    }

    document.getElementById('monitoringInventoryForm').onsubmit = async (event) => {
      event.preventDefault();
      const id = monitoringValue('monitoringEditId');
      const payload = {
        asset_type:monitoringValue('miAssetType'),asset_subtype:monitoringValue('miAssetSubtype'),asset_name:monitoringValue('miAssetName'),asset_description:monitoringValue('miAssetDescription'),inventory_code:monitoringValue('miInventoryCode'),condition_status:monitoringValue('miConditionStatus'),monitoring_frequency_months:Number(monitoringValue('miFrequency')||12),recipient_organization:monitoringValue('miRecipient'),commodity:monitoringValue('miCommodity'),source_of_fund:monitoringValue('miSourceFund'),year_funded:monitoringValue('miYearFunded'),registration_no:monitoringValue('miRegistration'),supplier:monitoringValue('miSupplier'),project_cost:monitoringValue('miProjectCost'),date_completed:monitoringValue('miDateCompleted'),warranty_expiry:monitoringValue('miWarrantyExpiry'),responsible_office:monitoringValue('miResponsibleOffice'),service_area:monitoringValue('miServiceArea'),capacity:monitoringValue('miCapacity'),machine_brand:monitoringValue('miMachineBrand'),machine_model:monitoringValue('miMachineModel'),machine_serial_no:monitoringValue('miMachineSerial'),engine_brand:monitoringValue('miEngineBrand'),engine_model:monitoringValue('miEngineModel'),engine_serial_no:monitoringValue('miEngineSerial'),engine_make:monitoringValue('miEngineMake'),rated_power:monitoringValue('miRatedPower'),contact_person:monitoringValue('miContactPerson'),designation:monitoringValue('miDesignation'),contact_no:monitoringValue('miContactNo'),date_received:monitoringValue('miDateReceived'),purok:monitoringValue('miPurok'),barangay:monitoringValue('miBarangay'),district:monitoringValue('miDistrict'),latitude:monitoringValue('miLatitude'),longitude:monitoringValue('miLongitude'),priority_override:monitoringValue('miPriorityOverride'),assigned_user_id:monitoringValue('miAssignedUser'),linked_project_id:monitoringValue('miLinkedProject'),notes:monitoringValue('miNotes')
      };
      if (!monitoringAssetUsesMachineSpecs(payload.asset_type)) {
        ['machine_brand','machine_model','machine_serial_no','engine_brand','engine_model','engine_serial_no','engine_make','rated_power'].forEach(field => { payload[field] = null; });
      }
      if (!payload.inventory_code) delete payload.inventory_code;
      try {
        await fetchJson(id ? `${API}/monitoring/inventory/${id}` : `${API}/monitoring/inventory`, { method:id?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        closeModal('monitoringInventoryFormModal'); toast(id ? 'Monitoring inventory updated.' : 'Monitoring inventory added.'); await loadMonitoringInventory(); if(id) await openMonitoringDetail(Number(id));
      } catch (error) { toast(error.message,'error'); }
    };

    async function openMonitoringDetail(id) {
      monitoringSelectedId = Number(id);
      const data = await fetchJson(`${API}/monitoring/inventory/${id}`, { silentLoading: true });
      const item = data.item;
      document.getElementById('monitoringDetailTitle').innerHTML = `<div class="text-xs text-cyan-700 dark:text-cyan-300">${esc(item.inventory_code)}</div>${esc(item.asset_name)}`;
      const location = [item.purok,item.barangay,item.district].filter(Boolean).join(', ') || '-';
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      const hasCoordinates = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
      const mapLink = hasCoordinates ? `<button type="button" class="text-cyan-700 dark:text-cyan-300 font-bold hover:underline" onclick="openMonitoringCoordinatesOnMap(${latitude}, ${longitude})">Open in ABEARC map</button>` : 'No coordinates';
      const visits = data.visits || [], tasks = data.tasks || [];
      const visitRows = visits.length ? visits.map(v => {
        const mapPhotoEvidence = (v.map_photos || []).map(photo => {
          const thumb = photo.thumbnail_url ? `${photo.thumbnail_url}?token=${encodeURIComponent(authToken)}` : '';
          const location = [photo.barangay, photo.district].filter(Boolean).join(', ') || `${Number(photo.latitude).toFixed(6)}, ${Number(photo.longitude).toFixed(6)}`;
          const source = photo.confirmation_source || 'Geotag Map';
          return `<button type="button" onclick="openMonitoringMapPhoto(${Number(photo.id)})" class="block w-36 text-left rounded-lg border border-cyan-200 dark:border-cyan-900 overflow-hidden bg-white dark:bg-gray-900 hover:border-cyan-500" title="Open this confirmation photo in Geotag Map">${thumb ? `<img src="${thumb}" alt="GeoCam monitoring confirmation" class="w-full h-20 object-cover">` : ''}<span class="block p-2"><span class="block text-[10px] font-black text-cyan-700 dark:text-cyan-300">Confirmed · ${esc(source)}</span><span class="block text-[10px] text-gray-500 truncate">${esc(location)}</span></span></button>`;
        }).join('');
        const supportingEvidence = (v.attachments || []).map(file => `<a class="block text-cyan-700 dark:text-cyan-300 font-bold hover:underline" href="${API}/monitoring/attachments/${file.id}/download?token=${encodeURIComponent(authToken)}">${esc(file.original_name)}</a>`).join('');
        const noPhotoLabel = v.monitoring_type === 'Imported Monitoring Record'
          ? '<span class="text-xs font-semibold text-gray-500">Imported historical visit</span>'
          : '<span class="text-xs font-semibold text-amber-700 dark:text-amber-300">Legacy visit — recorded before GeoCam confirmation was required</span>';
        const evidence = `<div class="flex flex-wrap gap-2">${mapPhotoEvidence || noPhotoLabel}</div>${supportingEvidence ? `<div class="mt-2">${supportingEvidence}</div>` : ''}`;
        return `<tr><td class="px-3 py-2">${monitoringDateLabel(v.monitoring_date)}</td><td class="px-3 py-2">${esc(v.condition_status || '-')}</td><td class="px-3 py-2">${esc(v.findings || '-')}${monitoringInspectionHistoryHtml(v.inspection_data)}</td><td class="px-3 py-2">${esc(v.actions_recommendations || '-')}</td><td class="px-3 py-2">${esc(v.inspector_username || v.inspector_account || '-')}</td><td class="px-3 py-2">${monitoringDateLabel(v.next_monitoring_date)}</td><td class="px-3 py-2">${evidence}</td></tr>`;
      }).join('') : '<tr><td colspan="7" class="p-5 text-center text-gray-500">No monitoring visits recorded.</td></tr>';
      const taskCards = tasks.length ? tasks.map(t => `<div class="enterprise-muted p-3"><div class="flex items-start justify-between gap-3"><div><div class="font-black">${esc(t.title)}</div><div class="text-xs text-gray-500">${esc(t.category || 'Follow-up')} · Due ${monitoringDateLabel(t.due_date)} · ${esc(t.assigned_username || 'Unassigned')}</div></div><span class="px-2 py-1 rounded-full border text-[10px] font-black ${monitoringPriorityClasses(t.priority)}">${esc(t.priority)}</span></div><div class="text-sm mt-2">${esc(t.details || '')}</div><div class="flex items-center justify-between mt-3"><span class="text-xs font-black">${esc(t.status)}</span>${hasPrivilege('manage_monitoring_tasks') && !['Completed','Closed','Cancelled'].includes(t.status)?`<button onclick="completeMonitoringTask(${t.id})" class="px-2 py-1 rounded border text-xs font-bold">Mark Completed</button>`:''}</div></div>`).join('') : '<div class="text-sm text-gray-500">No open or completed tasks.</div>';
      document.getElementById('monitoringDetailContent').innerHTML = `<div class="flex flex-wrap gap-2 mb-4">${item.lifecycle_status!=='Archived' && hasPrivilege('conduct_monitoring_visit')?`<button onclick="openMonitoringVisitModal(${item.id})" class="px-3 py-2 bg-cyan-700 text-white rounded-lg font-black">Record Visit</button>`:''}${item.lifecycle_status!=='Archived' && hasPrivilege('schedule_monitoring_visit')?`<button onclick="openMonitoringScheduleModal(${item.id})" class="px-3 py-2 border rounded-lg font-bold">Schedule</button>`:''}${item.lifecycle_status!=='Archived' && hasPrivilege('manage_monitoring_tasks')?`<button onclick="openMonitoringTaskModal(${item.id})" class="px-3 py-2 border rounded-lg font-bold">Add Task</button>`:''}${hasPrivilege('edit_monitoring_inventory')?`<button onclick="openMonitoringInventoryForm(${item.id})" class="px-3 py-2 border rounded-lg font-bold">Edit Master Record</button><button onclick="archiveMonitoringItem(${item.id}, '${esc(item.lifecycle_status)}')" class="px-3 py-2 border border-red-200 text-red-700 rounded-lg font-bold">${item.lifecycle_status==='Archived'?'Restore':'Archive'}</button>`:''}</div><div class="grid grid-cols-1 lg:grid-cols-3 gap-4"><div class="lg:col-span-2 enterprise-muted p-4"><div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><div><div class="text-xs text-gray-500">Asset type</div><div class="font-bold">${esc(item.asset_type)}</div><div class="text-xs text-gray-500">${esc(item.asset_subtype || '')}</div></div><div><div class="text-xs text-gray-500">Condition</div><div class="font-bold">${esc(item.condition_status || 'Unverified')}</div></div><div><div class="text-xs text-gray-500">Priority</div><span class="inline-flex mt-1 px-2 py-1 rounded-full border text-[10px] font-black ${monitoringPriorityClasses(item.computed_priority)}">${esc(item.computed_priority)}</span></div><div><div class="text-xs text-gray-500">Due state</div><span class="inline-flex mt-1 px-2 py-1 rounded-full text-[10px] font-black ${monitoringDueClasses(item.due_status)}">${esc(item.due_status)}</span></div><div><div class="text-xs text-gray-500">Recipient</div><div class="font-bold">${esc(item.recipient_organization || '-')}</div></div><div><div class="text-xs text-gray-500">Location</div><div class="font-bold">${esc(location)}</div></div><div><div class="text-xs text-gray-500">Coordinates</div><div>${mapLink}</div></div><div><div class="text-xs text-gray-500">Assigned</div><div class="font-bold">${esc(item.assigned_username || 'Unassigned')}</div></div><div><div class="text-xs text-gray-500">Last monitoring</div><div>${monitoringDateLabel(item.last_monitoring_date)}</div></div><div><div class="text-xs text-gray-500">Next monitoring</div><div>${monitoringDateLabel(item.next_monitoring_date)}</div></div><div><div class="text-xs text-gray-500">Registration</div><div>${esc(item.registration_no || '-')}</div></div><div><div class="text-xs text-gray-500">Linked project</div><div>${esc(item.linked_project_name || '-')}</div></div></div></div><div class="enterprise-muted p-4"><div class="font-black mb-2">Specifications</div><dl class="text-sm space-y-2"><div><dt class="text-xs text-gray-500">Description / scope</dt><dd>${esc(item.asset_description || '-')}</dd></div><div><dt class="text-xs text-gray-500">Commodity</dt><dd>${esc(item.commodity || '-')}</dd></div><div><dt class="text-xs text-gray-500">Source / year</dt><dd>${esc(item.source_of_fund || '-')} · ${esc(item.year_funded || '-')}</dd></div><div><dt class="text-xs text-gray-500">Cost / completion</dt><dd>${item.project_cost!=null?`₱${Number(item.project_cost).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'-'} · ${monitoringDateLabel(item.date_completed)}</dd></div><div><dt class="text-xs text-gray-500">Responsible office / service area</dt><dd>${esc([item.responsible_office,item.service_area].filter(Boolean).join(' · ') || '-')}</dd></div><div><dt class="text-xs text-gray-500">Warranty expiry</dt><dd>${monitoringDateLabel(item.warranty_expiry)}</dd></div><div><dt class="text-xs text-gray-500">Machine</dt><dd>${esc([item.machine_brand,item.machine_model].filter(Boolean).join(' ') || '-')}</dd></div><div><dt class="text-xs text-gray-500">Serial</dt><dd>${esc(item.machine_serial_no || '-')}</dd></div><div><dt class="text-xs text-gray-500">Engine / power</dt><dd>${esc([item.engine_brand,item.engine_model,item.engine_make,item.rated_power].filter(Boolean).join(' · ') || '-')}</dd></div><div><dt class="text-xs text-gray-500">Notes</dt><dd>${esc(item.notes || '-')}</dd></div><div><dt class="text-xs text-gray-500">Imported baseline remarks</dt><dd>${esc(item.baseline_remarks || '-')}</dd></div><div><dt class="text-xs text-gray-500">Imported recommendations</dt><dd>${esc(item.baseline_actions_recommendations || '-')}</dd></div><div><dt class="text-xs text-gray-500">Imported preceding reports</dt><dd>${esc(item.baseline_preceding_reports || '-')}</dd></div></dl></div></div><div class="mt-5"><div class="font-black mb-2">Monitoring history</div><div class="overflow-x-auto border rounded-lg"><table class="min-w-[900px] w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-950 text-xs uppercase text-gray-500"><tr><th class="px-3 py-2">Date</th><th class="px-3 py-2">Condition</th><th class="px-3 py-2">Findings</th><th class="px-3 py-2">Actions / recommendations</th><th class="px-3 py-2">Inspector</th><th class="px-3 py-2">Next</th><th class="px-3 py-2">Evidence</th></tr></thead><tbody class="divide-y">${visitRows}</tbody></table></div></div><div class="mt-5"><div class="font-black mb-2">Issues and follow-up tasks</div><div class="grid grid-cols-1 lg:grid-cols-2 gap-2">${taskCards}</div></div>`;
      document.getElementById('monitoringDetailModal').classList.remove('hidden');
    }

    function monitoringVisitSelectedDriveIds() {
      return [...new Set(monitoringVisitSelectedDrivePhotoIds.map(Number).filter(Boolean))];
    }

    function monitoringVisitManualFiles() {
      return [...(document.getElementById('mvManualConfirmationFiles')?.files || [])];
    }

    function monitoringVisitPhotoCaptureLabel(photo) {
      const value = photo?.captured_at || photo?.uploaded_at;
      if (!value) return photo?.captured_date || '-';
      try {
        return new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }).format(new Date(value));
      } catch (_) {
        return photo?.captured_date || '-';
      }
    }

    function monitoringVisitSelectedCaptureDates() {
      if (monitoringVisitPhotoSource === 'drive') {
        const selected = new Set(monitoringVisitSelectedDriveIds());
        return monitoringVisitDrivePhotos.filter(photo => selected.has(Number(photo.id))).map(photo => photo.captured_date).filter(Boolean);
      }
      return monitoringVisitManualCaptureDates.filter(Boolean);
    }

    function syncMonitoringVisitDateFromEvidence() {
      const dateInput = document.getElementById('mvDate');
      const hint = document.querySelector('[data-monitoring-date-source-hint]');
      if (!dateInput) return false;
      const dates = [...new Set(monitoringVisitSelectedCaptureDates())];
      dateInput.value = dates.length === 1 ? dates[0] : '';
      dateInput.readOnly = true;
      dateInput.setAttribute('aria-readonly', 'true');
      if (hint) {
        hint.textContent = dates.length === 1
          ? `Locked to the verified GeoCam capture date: ${monitoringDateLabel(dates[0])}.`
          : dates.length > 1
            ? 'Selected photos have different capture dates. Use photos from one date only.'
            : 'Select or upload a GeoCam photo to set this date automatically.';
        hint.className = `block mt-1 text-xs font-normal ${dates.length > 1 ? 'text-red-700 dark:text-red-300' : dates.length === 1 ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-500'}`;
      }
      return dates.length === 1;
    }

    async function monitoringManualPhotoCaptureDate(file) {
      const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
      const view = new DataView(buffer);
      const length = view.byteLength;
      if (length < 4 || view.getUint16(0, false) !== 0xffd8) return null;
      let offset = 2;
      while (offset + 4 <= length) {
        if (view.getUint8(offset) !== 0xff) break;
        const marker = view.getUint8(offset + 1);
        offset += 2;
        if (marker === 0xda || marker === 0xd9) break;
        const segmentLength = view.getUint16(offset, false);
        if (segmentLength < 2 || offset + segmentLength > length) break;
        const exifHeader = marker === 0xe1 && segmentLength >= 8
          && view.getUint32(offset + 2, false) === 0x45786966 && view.getUint16(offset + 6, false) === 0;
        if (!exifHeader) {
          offset += segmentLength;
          continue;
        }
        const tiff = offset + 8;
        const little = view.getUint16(tiff, false) === 0x4949;
        const read16 = position => view.getUint16(position, little);
        const read32 = position => view.getUint32(position, little);
        const readAscii = (entry, count) => {
          const start = count <= 4 ? entry + 8 : tiff + read32(entry + 8);
          if (start < 0 || start + count > length) return '';
          let value = '';
          for (let index = 0; index < count; index += 1) {
            const code = view.getUint8(start + index);
            if (!code) break;
            value += String.fromCharCode(code);
          }
          return value.trim();
        };
        const parseIfd = relativeOffset => {
          const entries = new Map();
          const start = tiff + Number(relativeOffset || 0);
          if (start < tiff || start + 2 > length) return entries;
          const count = read16(start);
          for (let index = 0; index < count; index += 1) {
            const entry = start + 2 + index * 12;
            if (entry + 12 > length) break;
            entries.set(read16(entry), { entry, type: read16(entry + 2), count: read32(entry + 4), value: read32(entry + 8) });
          }
          return entries;
        };
        if (read16(tiff + 2) !== 42) return null;
        const root = parseIfd(read32(tiff + 4));
        const exifPointer = root.get(0x8769)?.value;
        const exif = exifPointer ? parseIfd(exifPointer) : new Map();
        const dateEntry = exif.get(0x9003) || exif.get(0x9004) || root.get(0x0132);
        if (!dateEntry || dateEntry.type !== 2) return null;
        const raw = readAscii(dateEntry.entry, dateEntry.count);
        const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
      }
      return null;
    }

    function renderMonitoringVisitPhotoSource() {
      const sourceConfig = {
        manual: ['mvProofSourceUploadBtn', 'mvProofUploadPanel'],
        drive: ['mvProofSourceDriveBtn', 'mvProofDrivePanel']
      };
      Object.entries(sourceConfig).forEach(([source, [buttonId, panelId]]) => {
        const active = source === monitoringVisitPhotoSource;
        const button = document.getElementById(buttonId);
        const panel = document.getElementById(panelId);
        if (button) {
          button.className = `px-3 py-2 rounded-lg border text-xs font-black transition ${active ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700'}`;
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        panel?.classList.toggle('hidden', !active);
      });
    }

    window.setMonitoringVisitPhotoSource = async function(source) {
      if (!['manual', 'drive'].includes(source)) return;
      monitoringVisitPhotoSource = source;
      renderMonitoringVisitPhotoSource();
      syncMonitoringVisitDateFromEvidence();
      if (source === 'drive' && !monitoringVisitDrivePhotos.length) await loadMonitoringVisitDrivePhotos();
      if (source === 'manual') monitoringManualConfirmationChanged();
    };

    function renderMonitoringVisitDrivePhotos() {
      const grid = document.getElementById('mvDrivePhotoGrid');
      const status = document.getElementById('mvDrivePhotoStatus');
      if (!grid || !status) return;
      const selected = new Set(monitoringVisitSelectedDriveIds());
      if (monitoringVisitDrivePhotosLoading) {
        status.textContent = 'Loading eligible GeoCam photos from My Drive...';
        grid.innerHTML = '<div class="sm:col-span-2 lg:col-span-3 p-5 text-center text-sm text-gray-500">Loading...</div>';
        return;
      }
      if (!monitoringVisitDrivePhotos.length) {
        status.textContent = 'No eligible unused GeoCam photo was found in My Drive.';
        grid.innerHTML = '<div class="sm:col-span-2 lg:col-span-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200"><div class="font-black">No eligible My Drive photo.</div><div class="mt-1 text-xs">Only photos received through the GeoCam Android upload and containing complete stamped GPS details are listed.</div></div>';
        return;
      }
      status.textContent = `${selected.size} selected · ${monitoringVisitDrivePhotos.length} eligible My Drive photo${monitoringVisitDrivePhotos.length === 1 ? '' : 's'}. Select photos from one capture date.`;
      grid.innerHTML = monitoringVisitDrivePhotos.map(photo => {
        const isSelected = selected.has(Number(photo.id));
        const thumbnail = photo.view_url ? `${photo.view_url}?token=${encodeURIComponent(authToken)}` : '';
        const location = Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude)) ? `${Number(photo.latitude).toFixed(6)}, ${Number(photo.longitude).toFixed(6)}` : 'Geotag available';
        return `<button type="button" onclick="toggleMonitoringVisitDrivePhoto(${Number(photo.id)})" class="relative text-left rounded-lg border-2 overflow-hidden transition ${isSelected ? 'border-cyan-600 ring-2 ring-cyan-200 dark:ring-cyan-900' : 'border-gray-200 dark:border-gray-700 hover:border-cyan-400'}"><span class="absolute top-2 right-2 z-10 w-6 h-6 rounded-full grid place-items-center text-xs font-black ${isSelected ? 'bg-cyan-700 text-white' : 'bg-white/90 text-gray-500 border'}">${isSelected ? '✓' : ''}</span>${thumbnail ? `<img src="${thumbnail}" alt="Eligible My Drive GeoCam photo" class="w-full h-32 object-cover bg-gray-100 dark:bg-gray-800">` : '<div class="w-full h-32 grid place-items-center bg-gray-100 dark:bg-gray-800 text-xs text-gray-500">No preview</div>'}<span class="block p-3"><span class="block text-xs font-black text-gray-900 dark:text-gray-100 truncate">${esc(photo.original_filename || 'GeoCam photo')}</span><span class="block mt-1 text-[11px] text-gray-500">${esc(monitoringVisitPhotoCaptureLabel(photo))}</span><span class="block mt-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">${esc(location)} · My Drive</span></span></button>`;
      }).join('');
    }

    async function loadMonitoringVisitDrivePhotos() {
      const inventoryId = Number(monitoringValue('monitoringVisitInventoryId'));
      if (!inventoryId) {
        monitoringVisitDrivePhotos = [];
        monitoringVisitSelectedDrivePhotoIds = [];
        renderMonitoringVisitDrivePhotos();
        return;
      }
      monitoringVisitDrivePhotosLoading = true;
      renderMonitoringVisitDrivePhotos();
      try {
        const data = await fetchJson(`${API}/monitoring/inventory/${inventoryId}/my-drive-photos`, { silentLoading: true });
        monitoringVisitDrivePhotos = Array.isArray(data.photos) ? data.photos : [];
        const availableIds = new Set(monitoringVisitDrivePhotos.map(photo => Number(photo.id)));
        monitoringVisitSelectedDrivePhotoIds = monitoringVisitSelectedDriveIds().filter(id => availableIds.has(id));
      } catch (error) {
        monitoringVisitDrivePhotos = [];
        monitoringVisitSelectedDrivePhotoIds = [];
        toast(error.message, 'error');
      } finally {
        monitoringVisitDrivePhotosLoading = false;
        syncMonitoringVisitDateFromEvidence();
        renderMonitoringVisitDrivePhotos();
      }
    }

    window.refreshMonitoringVisitDrivePhotos = async function() {
      await loadMonitoringVisitDrivePhotos();
    };

    window.toggleMonitoringVisitDrivePhoto = function(photoId) {
      const id = Number(photoId);
      if (!monitoringVisitDrivePhotos.some(photo => Number(photo.id) === id)) return;
      if (monitoringVisitSelectedDriveIds().includes(id)) monitoringVisitSelectedDrivePhotoIds = monitoringVisitSelectedDriveIds().filter(value => value !== id);
      else {
        const photo = monitoringVisitDrivePhotos.find(entry => Number(entry.id) === id);
        const currentDates = [...new Set(monitoringVisitSelectedCaptureDates())];
        if (currentDates.length && photo?.captured_date && currentDates[0] !== photo.captured_date) return toast('Use GeoCam photos captured on the same date for one monitoring visit.', 'warning');
        monitoringVisitSelectedDrivePhotoIds = [...monitoringVisitSelectedDriveIds(), id].slice(0, 10);
      }
      syncMonitoringVisitDateFromEvidence();
      renderMonitoringVisitDrivePhotos();
    };

    window.monitoringManualConfirmationChanged = async function() {
      const status = document.getElementById('mvManualPhotoStatus');
      const input = document.getElementById('mvManualConfirmationFiles');
      if (!status || !input) return;
      const files = [...(input.files || [])];
      const readId = ++monitoringVisitManualDateReadId;
      monitoringVisitManualCaptureDates = [];
      syncMonitoringVisitDateFromEvidence();
      if (!files.length) {
        status.className = 'mt-1 text-xs text-gray-500 dark:text-gray-400 break-words';
        status.textContent = 'Choose up to five original JPG or JPEG photos with embedded location and capture-date metadata.';
        return;
      }
      if (files.length > 5) {
        status.textContent = 'Too many files selected. Use up to five GeoCam confirmation photos.';
        status.className = 'mt-2 text-xs font-bold text-red-700 dark:text-red-300';
        return;
      }
      const invalid = files.find(file => !/\.jpe?g$/i.test(file.name));
      if (invalid) {
        status.textContent = `${invalid.name} is not an original JPG or JPEG GeoCam photo.`;
        status.className = 'mt-2 text-xs font-bold text-red-700 dark:text-red-300';
        return;
      }
      status.className = 'mt-2 text-xs font-semibold text-gray-600 dark:text-gray-300';
      status.textContent = 'Reading the embedded GeoCam capture date...';
      const dates = await Promise.all(files.map(file => monitoringManualPhotoCaptureDate(file).catch(() => null)));
      if (readId !== monitoringVisitManualDateReadId) return;
      const uniqueDates = [...new Set(dates.filter(Boolean))];
      if (dates.some(date => !date)) {
        status.className = 'mt-2 text-xs font-bold text-red-700 dark:text-red-300';
        status.textContent = 'One or more photos are missing a readable embedded EXIF capture date.';
        syncMonitoringVisitDateFromEvidence();
        return;
      }
      if (uniqueDates.length !== 1) {
        status.className = 'mt-2 text-xs font-bold text-red-700 dark:text-red-300';
        status.textContent = 'All selected GeoCam photos must have the same embedded capture date.';
        syncMonitoringVisitDateFromEvidence();
        return;
      }
      monitoringVisitManualCaptureDates = dates;
      syncMonitoringVisitDateFromEvidence();
      status.className = 'mt-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300';
      status.textContent = `${files.length} photo${files.length === 1 ? '' : 's'} selected. Monitoring date locked to ${monitoringDateLabel(uniqueDates[0])}; final GeoCam validation occurs on the server.`;
    };

    function setupMonitoringPhotoDropZone() {
      const zone = document.querySelector('[data-monitoring-upload-dropzone]');
      const input = document.getElementById('mvManualConfirmationFiles');
      if (!zone || !input || zone.dataset.dropReady === '1') return;
      zone.dataset.dropReady = '1';
      const chooseFiles = files => {
        if (!files?.length) return;
        const selected = [...files];
        if (selected.some(file => !/\.jpe?g$/i.test(file.name))) return toast('Upload accepts JPG or JPEG photos only.', 'error');
        if (selected.length > 5) return toast('Upload up to five monitoring photos.', 'error');
        const transfer = new DataTransfer();
        selected.forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        monitoringManualConfirmationChanged();
      };
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      });
      input.addEventListener('click', event => event.stopPropagation());
      ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.add('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
      }));
      ['dragleave', 'dragend', 'drop'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.remove('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
      }));
      zone.addEventListener('drop', event => chooseFiles(event.dataTransfer?.files));
    }

    window.openMonitoringMapPhoto = async function(photoId) {
      if (!hasPrivilege('view_abearc_map')) return toast('Permission denied: view_abearc_map', 'error');
      closeModal('monitoringDetailModal');
      await showAbearcMap();
      await openAbearcMapDetails(Number(photoId));
    };

    window.openMonitoringCoordinatesOnMap = async function(latitude, longitude) {
      if (!hasPrivilege('view_abearc_map')) return toast('Permission denied: view_abearc_map', 'error');
      const item = monitoringInventoryCache.find(entry => Number(entry.id) === Number(monitoringSelectedId));
      const opened = await showAbearcMapLocation(latitude, longitude, item?.asset_name || 'Monitoring asset');
      if (!opened) return;
      closeModal('monitoringDetailModal');
      setSidebarActive('map');
    };

    async function openMonitoringVisitModal(id) {
      const item = monitoringInventoryCache.find(x => Number(x.id) === Number(id)) || (await fetchJson(`${API}/monitoring/inventory/${id}`, {silentLoading:true})).item;
      if (item.lifecycle_status === 'Archived') return toast('Restore this inventory record before recording another monitoring visit.', 'warning');
      document.getElementById('monitoringVisitForm').reset();
      monitoringVisitDrivePhotos = [];
      monitoringVisitSelectedDrivePhotoIds = [];
      monitoringVisitPhotoSource = 'manual';
      monitoringVisitManualCaptureDates = [];
      monitoringVisitManualDateReadId += 1;
      await populateMonitoringUserSelects();
      document.getElementById('monitoringVisitInventoryId').value = id;
      document.getElementById('monitoringVisitAsset').textContent = `${item.inventory_code} - ${item.asset_name}`;
      document.getElementById('mvDate').value = '';
      document.getElementById('mvDate').readOnly = true;
      document.getElementById('mvCondition').value = ['Operational','Functional','Needs Repair','Non-operational','Irreparable','Unverified'].includes(item.condition_status) ? item.condition_status : 'Unverified';
      document.getElementById('mvFrequency').value = item.monitoring_frequency_months || 12;
      renderMonitoringVisitInspection(item);
      document.getElementById('mvTaskFields').classList.add('hidden');
      document.getElementById('mvCreateTaskPanel').classList.toggle('hidden', !hasPrivilege('manage_monitoring_tasks'));
      document.getElementById('monitoringVisitModal').classList.remove('hidden');
      setupMonitoringPhotoDropZone();
      renderMonitoringVisitPhotoSource();
      syncMonitoringVisitDateFromEvidence();
      renderMonitoringVisitDrivePhotos();
      monitoringManualConfirmationChanged();
    }

    document.getElementById('monitoringVisitForm').onsubmit = async (event) => {
      event.preventDefault();
      const id = Number(monitoringValue('monitoringVisitInventoryId'));
      const selectedDrivePhotoIds = monitoringVisitPhotoSource === 'drive' ? monitoringVisitSelectedDriveIds() : [];
      const manualFiles = monitoringVisitPhotoSource === 'manual' ? monitoringVisitManualFiles() : [];
      if (monitoringVisitPhotoSource === 'drive' && !selectedDrivePhotoIds.length) return toast('Select at least one eligible GeoCam photo from My Drive.', 'error');
      if (monitoringVisitPhotoSource === 'manual') {
        if (!manualFiles.length) return toast('Choose at least one original GeoCam JPG or JPEG photo.', 'error');
        if (manualFiles.length > 5) return toast('Use up to five manually uploaded confirmation photos.', 'error');
        if (manualFiles.some(file => !/\.jpe?g$/i.test(file.name))) return toast('Manual confirmation accepts only original GeoCam JPG or JPEG photos.', 'error');
      }
      if (!syncMonitoringVisitDateFromEvidence()) return toast('Select valid GeoCam photo evidence from one capture date to set the Monitoring date.', 'error');
      const inspection = collectMonitoringVisitInspection();
      const incompleteInspection = inspection.items.find(entry => !entry.status);
      if (incompleteInspection) return toast(`Select a status for ${incompleteInspection.label}.`, 'error');
      const payload = {
        monitoring_type: monitoringValue('mvType'),
        condition_status: monitoringValue('mvCondition'),
        utilization_status: monitoringValue('mvUtilization'),
        inspection_data: inspection,
        monitoring_frequency_months: Number(monitoringValue('mvFrequency') || 12),
        next_monitoring_date: monitoringValue('mvNextDate'),
        findings: monitoringValue('mvFindings'),
        actions_recommendations: monitoringValue('mvRecommendations'),
        drive_file_ids: selectedDrivePhotoIds
      };
      if (document.getElementById('mvCreateTask').checked) {
        const taskTitle = monitoringValue('mvTaskTitle');
        if (!taskTitle) return toast('Enter a follow-up task title or turn off Create a follow-up task.', 'error');
        payload.task = { title: taskTitle, priority: monitoringValue('mvTaskPriority'), due_date: monitoringValue('mvTaskDue'), assigned_user_id: monitoringValue('mvTaskAssignee') };
      }
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.append(key, ['task', 'drive_file_ids', 'inspection_data'].includes(key) ? JSON.stringify(value) : (value ?? '')));
      manualFiles.forEach(file => form.append('confirmation_photos', file));
      [...(document.getElementById('mvEvidenceFiles').files || [])].forEach(file => form.append('files', file));
      try {
        const response = await fetch(`${API}/monitoring/inventory/${id}/visits`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to record monitoring visit.');
        closeModal('monitoringVisitModal');
        const count = Number(data.confirmation_photo_count || data.map_photo_count || 1);
        const sourceName = monitoringVisitPhotoSource === 'drive' ? 'My Drive' : 'upload';
        toast(`Monitoring visit confirmed with ${count} server-verified GeoCam photo${count === 1 ? '' : 's'} from ${sourceName}.`);
        await loadMonitoringInventory();
        await openMonitoringDetail(id);
      } catch (error) {
        toast(error.message, 'error');
        if (/photo|geocam|geotag|drive|exif/i.test(error.message)) {
          if (monitoringVisitPhotoSource === 'drive') await loadMonitoringVisitDrivePhotos();
        }
      }
    };

    function monitoringScheduleParticipantIds() {
      return monitoringScheduleSelectedUsers.map(user => Number(user.id)).filter(Boolean);
    }

    function sortedMonitoringScheduleUsers() {
      return [...(monitoringUsersCache || [])].sort(calendarParticipantSuggestionCompare);
    }

    function renderMonitoringScheduleParticipantSummary() {
      const el = document.getElementById('monitoringScheduleParticipantSummary');
      if (!el) return;
      const names = monitoringScheduleSelectedUsers.map(user => calendarUserDisplayName(user)).filter(Boolean);
      el.textContent = names.length ? `Participants: ${names.join(', ')}` : 'No participants selected.';
    }

    function renderMonitoringScheduleUserSearch() {
      renderMonitoringScheduleParticipantSummary();
      renderCalendarUserPickerChips({
        targetId: 'monitoringScheduleSelectedUsers',
        clearButtonId: 'monitoringScheduleClearUsersBtn',
        selectedUsers: monitoringScheduleSelectedUsers,
        removeFunction: 'removeMonitoringScheduleParticipant'
      });
      renderCalendarUserPickerResults({
        resultsId: 'monitoringScheduleUserSearchResults',
        inputId: 'monitoringScheduleUserSearchInput',
        selectedUsers: monitoringScheduleSelectedUsers,
        isOpen: monitoringScheduleUserSearchOpen,
        addFunction: 'addMonitoringScheduleParticipant',
        addAllFunction: 'addAllMonitoringScheduleParticipants',
        activeIndex: monitoringScheduleUserSearchActiveIndex,
        loading: !(monitoringUsersCache || []).length,
        allowAll: true,
        availableUsers: monitoringUsersCache
      });
    }

    window.openMonitoringScheduleUserSearch = async function() {
      monitoringScheduleUserSearchOpen = true;
      renderMonitoringScheduleUserSearch();
      await loadMonitoringUsers();
      renderMonitoringScheduleUserSearch();
    };

    window.closeMonitoringScheduleUserSearch = function() {
      monitoringScheduleUserSearchOpen = false;
      monitoringScheduleUserSearchActiveIndex = -1;
      renderMonitoringScheduleUserSearch();
    };

    window.debouncedMonitoringScheduleUserSearch = function() {
      clearTimeout(monitoringScheduleUserSearchTimer);
      monitoringScheduleUserSearchTimer = setTimeout(() => {
        monitoringScheduleUserSearchOpen = true;
        monitoringScheduleUserSearchActiveIndex = -1;
        renderMonitoringScheduleUserSearch();
      }, 200);
    };

    window.handleMonitoringScheduleUserSearchKeydown = function(event) {
      handleCalendarUserPickerKeydown(event, {
        resultsId: 'monitoringScheduleUserSearchResults',
        open: () => { monitoringScheduleUserSearchOpen = true; return true; },
        close: closeMonitoringScheduleUserSearch,
        render: renderMonitoringScheduleUserSearch,
        getIndex: () => monitoringScheduleUserSearchActiveIndex,
        setIndex: value => { monitoringScheduleUserSearchActiveIndex = value; }
      });
    };

    window.addMonitoringScheduleParticipant = function(userId) {
      const user = (monitoringUsersCache || []).find(item => Number(item.id) === Number(userId));
      if (!user || monitoringScheduleSelectedUsers.some(item => Number(item.id) === Number(userId))) return;
      monitoringScheduleSelectedUsers.push(user);
      const input = document.getElementById('monitoringScheduleUserSearchInput');
      if (input) input.value = '';
      monitoringScheduleUserSearchActiveIndex = -1;
      renderMonitoringScheduleUserSearch();
    };

    window.removeMonitoringScheduleParticipant = function(userId) {
      monitoringScheduleSelectedUsers = monitoringScheduleSelectedUsers.filter(user => Number(user.id) !== Number(userId));
      renderMonitoringScheduleUserSearch();
    };

    window.addAllMonitoringScheduleParticipants = function() {
      monitoringScheduleSelectedUsers = sortedMonitoringScheduleUsers();
      const input = document.getElementById('monitoringScheduleUserSearchInput');
      if (input) input.value = '';
      monitoringScheduleUserSearchOpen = false;
      monitoringScheduleUserSearchActiveIndex = -1;
      renderMonitoringScheduleUserSearch();
    };

    window.clearMonitoringScheduleParticipants = function() {
      monitoringScheduleSelectedUsers = [];
      const input = document.getElementById('monitoringScheduleUserSearchInput');
      if (input) input.value = '';
      monitoringScheduleUserSearchOpen = false;
      monitoringScheduleUserSearchActiveIndex = -1;
      renderMonitoringScheduleUserSearch();
    };

    document.addEventListener('click', (event) => {
      const panel = document.getElementById('monitoringScheduleUserSearchPanel');
      if (panel && !panel.contains(event.target)) closeMonitoringScheduleUserSearch();
      if (!event.target.closest('.monitoring-overflow')) document.querySelectorAll('.monitoring-overflow[open]').forEach(menu => menu.removeAttribute('open'));
    });

    async function openMonitoringScheduleModal(id) {
      const item = monitoringInventoryCache.find(x=>Number(x.id)===Number(id)) || (await fetchJson(`${API}/monitoring/inventory/${id}`,{silentLoading:true})).item;
      if (item.lifecycle_status === 'Archived') return toast('Restore this inventory record before scheduling another monitoring visit.', 'warning');
      document.getElementById('monitoringScheduleForm').reset();
      await loadMonitoringUsers();
      const defaultIds = new Set([Number(currentUser?.id || 0), Number(item.assigned_user_id || 0)].filter(Boolean));
      monitoringScheduleSelectedUsers = sortedMonitoringScheduleUsers().filter(user => defaultIds.has(Number(user.id)));
      monitoringScheduleUserSearchOpen = false;
      monitoringScheduleUserSearchActiveIndex = -1;
      document.getElementById('monitoringScheduleInventoryId').value=id;
      document.getElementById('monitoringScheduleAsset').textContent=`${item.inventory_code} - ${item.asset_name}`;
      document.getElementById('msDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
      document.getElementById('msStart').value='08:00';
      document.getElementById('msEnd').value='12:00';
      document.getElementById('msNotes').value='';
      const searchInput = document.getElementById('monitoringScheduleUserSearchInput');
      if (searchInput) searchInput.value='';
      renderMonitoringScheduleUserSearch();
      document.getElementById('monitoringScheduleModal').classList.remove('hidden');
    }

    document.getElementById('monitoringScheduleForm').onsubmit=async(event)=>{
      event.preventDefault();
      const id=Number(monitoringValue('monitoringScheduleInventoryId'));
      const date=monitoringValue('msDate');
      const startTime=monitoringValue('msStart');
      const endTime=monitoringValue('msEnd');
      const participantIds=monitoringScheduleParticipantIds();
      if(!date) return toast('Monitoring schedule date is required.','error');
      if(!participantIds.length) return toast('Select at least one participant / involved user.','error');
      if(!/^\d{2}:\d{2}$/.test(startTime)||!/^\d{2}:\d{2}$/.test(endTime)) return toast('Valid start and end times are required.','error');
      if(endTime<=startTime) return toast('End time must be later than start time.','error');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
      let confirmedPastDate=false;
      if(date<today){
        confirmedPastDate=await confirmModalChoice(
          `<div class="space-y-2 text-sm"><p class="font-bold text-gray-900 dark:text-gray-100">The selected monitoring date, ${esc(monitoringDateLabel(date))}, is earlier than today.</p><p class="text-gray-600 dark:text-gray-300">Continue only when recording a deliberately backdated monitoring schedule.</p></div>`,
          {title:'Confirm Past Monitoring Date',confirmText:'Schedule Past Date',confirmClass:'px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium'}
        );
        if(!confirmedPastDate) return;
      }
      if(!participantIds.includes(Number(currentUser?.id))){
        const choice=await calendarParticipantWarningChoice(
          'You are not included as a participant in this monitoring schedule. You will remain the creator, but it may not appear in your participant schedule list. Continue?',
          {title:'Creator Not Included',addText:'Add Me',continueText:'Continue Without Me'}
        );
        if(choice==='add'){
          const me=(monitoringUsersCache||[]).find(user=>Number(user.id)===Number(currentUser?.id));
          if(me) monitoringScheduleSelectedUsers.unshift(me);
          renderMonitoringScheduleUserSearch();
        } else if(choice!=='continue') return;
      }
      try{
        const conflicts=await calendarCheckConflicts({start_datetime:`${date}T${startTime}:00+08:00`,end_datetime:`${date}T${endTime}:00+08:00`,participant_user_ids:monitoringScheduleParticipantIds()});
        if(conflicts.length && !(await confirmModalChoice(calendarConflictMarkup(conflicts),{title:'Schedule conflicts',confirmText:'Proceed Anyway'})))return;
        await fetchJson(`${API}/monitoring/inventory/${id}/schedule`,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({date,start_time:startTime,end_time:endTime,participant_user_ids:monitoringScheduleParticipantIds(),notes:monitoringValue('msNotes'),confirm_past_date:confirmedPastDate,acknowledge_conflicts:true})
        });
        usersCache = [];
        monitoringUsersCache = [];
        closeModal('monitoringScheduleModal');
        toast('Monitoring visit scheduled in Calendar.');
        await loadMonitoringInventory();
        await openMonitoringDetail(id);
      }catch(error){toast(error.message,'error');}
    };

    async function openMonitoringTaskModal(id){const item=monitoringInventoryCache.find(x=>Number(x.id)===Number(id)) || (await fetchJson(`${API}/monitoring/inventory/${id}`,{silentLoading:true})).item;if(item.lifecycle_status==='Archived')return toast('Restore this inventory record before creating another monitoring task.','warning');document.getElementById('monitoringTaskForm').reset();await populateMonitoringUserSelects({mtAssignee:item.assigned_user_id});document.getElementById('monitoringTaskInventoryId').value=id;document.getElementById('monitoringTaskAsset').textContent=`${item.inventory_code} - ${item.asset_name}`;document.getElementById('monitoringTaskModal').classList.remove('hidden');}
    document.getElementById('monitoringTaskForm').onsubmit=async(event)=>{event.preventDefault();const id=Number(monitoringValue('monitoringTaskInventoryId'));try{await fetchJson(`${API}/monitoring/inventory/${id}/tasks`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:monitoringValue('mtTitle'),details:monitoringValue('mtDetails'),category:monitoringValue('mtCategory'),priority:monitoringValue('mtPriority'),due_date:monitoringValue('mtDueDate'),assigned_user_id:monitoringValue('mtAssignee')})});closeModal('monitoringTaskModal');toast('Monitoring task created.');await loadMonitoringInventory();await openMonitoringDetail(id);}catch(error){toast(error.message,'error');}};
    async function completeMonitoringTask(id){try{await fetchJson(`${API}/monitoring/tasks/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'Completed'})});toast('Monitoring task completed.');await loadMonitoringInventory();if(monitoringSelectedId)await openMonitoringDetail(monitoringSelectedId);}catch(error){toast(error.message,'error');}}
    async function archiveMonitoringItem(id,status){openConfirmModal(`${status==='Archived'?'Restore':'Archive'} this monitoring inventory record?`,async()=>{await fetchJson(`${API}/monitoring/inventory/${id}/archive`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restore:status==='Archived'})});closeModal('monitoringDetailModal');toast(status==='Archived'?'Inventory restored.':'Inventory archived.');await loadMonitoringInventory();});}

    async function exportMonitoringInventory(){try{const response=await fetch(`${API}/monitoring/export.xlsx`,{headers:{Authorization:`Bearer ${authToken}`}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Export failed.');}const blob=await response.blob();downloadBlob(blob,`ABEARC-Monitoring-Inventory-${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())}.xlsx`);}catch(error){toast(error.message,'error');}}
    async function importMonitoringWorkbook(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;const form=new FormData();form.append('file',file);try{const response=await fetch(`${API}/monitoring/import`,{method:'POST',headers:{Authorization:`Bearer ${authToken}`},body:form});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Import failed.');toast(`Imported ${data.imported||0} records; skipped ${data.skipped||0} duplicates.`);await loadMonitoringInventory();}catch(error){toast(error.message,'error');}}
