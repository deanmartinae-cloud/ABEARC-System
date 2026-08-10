    async function showCalendarView(pushHistory = true){ 
      if (!currentUser) return showAuthView(); 
      if (!hasPrivilege('view_calendar')) return toast('Permission denied: view_calendar', 'error');
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      
      // Save current dashboard filter state before navigating to calendar
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
      
      navigateTo('calendar', { month: calendarMonth, scope: calendarScope }, pushHistory);
      setupCalendarScopeControls();
      loadCalendarView(); 
    }

    function setupCalendarScopeControls() {
      const scopeSelect = document.getElementById('calendarScopeSelect');
      const typeSelect = document.getElementById('calendarTypeFilter');
      calendarTimeFilter = 'all';
      if (calendarScope === 'all_visible' || calendarScope === 'all_schedules' || calendarScope === 'abe_calendar' || calendarScope === 'abed_wide' || calendarScope === 'division' || calendarScope === 'global') calendarScope = 'abe';
      if (calendarScope === 'assigned') calendarScope = 'my';
      if (calendarScope === 'my_meetings') {
        calendarScope = 'my';
        if (typeSelect) typeSelect.value = 'meeting';
      }
      if (calendarScope === 'my_project_deadlines') {
        calendarScope = 'my';
        if (typeSelect) typeSelect.value = 'project_deadlines';
      }
      if (['project_deadlines', 'meeting', 'meetings', 'training', 'trainings', 'site_inspection', 'site_inspections', 'site_geotagging', 'past_schedules', 'past'].includes(calendarScope)) {
        const legacyScope = calendarScope;
        const mappedType = legacyScope === 'project_deadlines' ? 'project_deadlines'
          : legacyScope === 'past' || legacyScope === 'past_schedules' ? ''
            : normalizeCalendarScopeValue(legacyScope);
        calendarScope = defaultCalendarScopeForCurrentUser();
        if (typeSelect && mappedType) typeSelect.value = mappedType;
      }
      if (scopeSelect) {
        renderCalendarScopeOptions();
        scopeSelect.value = calendarScope;
      }
      const viewSelect = document.getElementById('calendarViewSelect');
      if (viewSelect) viewSelect.value = calendarDisplayView;
      applyCalendarSidebarState();
      renderCalendarUserSearch();
      renderCalendarSideFilters();
      document.getElementById('calendarCreateFab')?.classList.toggle('hidden', !hasPrivilege('create_calendar_event'));
    }

    function renderCalendarScopeOptions() {
      const scopeSelect = document.getElementById('calendarScopeSelect');
      if (!scopeSelect) return;
      const options = currentUser?.role === 'superadmin'
        ? [['abe', 'ABE Calendar'], ['my', 'My Calendar']]
        : [['my', 'My Calendar'], ['abe', 'ABE Calendar']];
      scopeSelect.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    }

    function applyCalendarSidebarState() {
      const view = document.getElementById('calendarView');
      const toggle = document.getElementById('calendarSidebarToggleBtn');
      view?.classList.toggle('calendar-sidebar-collapsed', !!calendarSidebarCollapsed);
      if (toggle) {
        toggle.setAttribute('aria-pressed', calendarSidebarCollapsed ? 'true' : 'false');
        toggle.title = calendarSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar';
      }
    }

    function toggleCalendarSidebar() {
      calendarSidebarCollapsed = !calendarSidebarCollapsed;
      applyCalendarSidebarState();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
    }

    function goToCurrentCalendarMonth() {
      calendarSelectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      calendarSelectedDateKeys = new Set([calendarSelectedDate]);
      calendarMonth = calendarSelectedDate.slice(0, 7);
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView();
    }

    function goToCalendarMonthViewToday() {
      calendarDisplayView = 'month';
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      calendarSelectedDate = today;
      calendarSelectedDateKeys = new Set([today]);
      calendarMonth = today.slice(0, 7);
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    function setCalendarScope(scope) {
      calendarScope = normalizeCalendarScopeValue(scope || defaultCalendarScopeForCurrentUser());
      calendarTimeFilter = 'all';
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView();
    }

    function setCalendarDisplayView(view) {
      calendarDisplayView = ['month', 'week', 'day', 'agenda'].includes(view) ? view : 'month';
      calendarSelectedDateKeys = new Set([calendarSelectedDate]);
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    function setCalendarTypeQuickFilter(type) {
      const select = document.getElementById('calendarTypeFilter');
      if (select) select.value = type || '';
      const group = calendarScope === 'abe' ? 'abe' : 'my';
      calendarQuickFilterState.expandedGroup = group;
      calendarQuickFilterState.selectedTypes[group] = type ? [type] : getCalendarTypesForGroup(group);
      renderCalendarSideFilters();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView();
    }

    function calendarFilterChanged() {
      const type = document.getElementById('calendarTypeFilter')?.value || '';
      const group = calendarScope === 'abe' ? 'abe' : 'my';
      calendarQuickFilterState.expandedGroup = group;
      calendarQuickFilterState.selectedTypes[group] = type ? [type] : getCalendarTypesForGroup(group);
      renderCalendarSideFilters();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    function calendarUserDisplayName(user) {
      return user?.display_name || displayUsername(user?.username || user?.name || user?.email || 'User');
    }

    function calendarUserInitials(user) {
      const label = calendarUserDisplayName(user);
      const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return String(label || user?.username || 'U').slice(0, 1).toUpperCase();
    }

    async function ensureCalendarUsers() {
      if (Array.isArray(usersCache) && usersCache.length) return usersCache;
      usersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, { silentLoading: true }).catch(() => []));
      return usersCache;
    }

    function calendarParticipantSuggestionCompare(a, b) {
      const countDifference = Number(b?.participant_selection_count || 0) - Number(a?.participant_selection_count || 0);
      if (countDifference) return countDifference;
      const aRecent = Date.parse(a?.participant_last_selected_at || '') || 0;
      const bRecent = Date.parse(b?.participant_last_selected_at || '') || 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      const aMe = Number(a?.id) === Number(currentUser?.id);
      const bMe = Number(b?.id) === Number(currentUser?.id);
      if (aMe !== bMe) return aMe ? -1 : 1;
      return calendarUserDisplayName(a).localeCompare(calendarUserDisplayName(b), undefined, { sensitivity: 'base' });
    }

    function calendarFilteredUsers(inputId = 'calendarUserSearchInput', selectedUsers = selectedCalendarUsers, availableUsers = usersCache) {
      const q = (document.getElementById(inputId)?.value || '').trim().toLowerCase();
      const selectedIds = new Set(selectedUsers.map(u => Number(u.id)));
      return (availableUsers || [])
        .filter(user => !selectedIds.has(Number(user.id)))
        .filter(user => {
          if (!q) return true;
          return [user.display_name, user.name, user.username, user.email, user.role]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
        })
        .sort(calendarParticipantSuggestionCompare)
        .slice(0, 20);
    }

    function closeParticipantPickersFromOutsideClick(event) {
      const target = event.target;
      [
        ['calendarModalUserSearchPanel', 'calendarModalUserSearchResults', 'closeCalendarModalUserSearch'],
        ['monitoringScheduleUserSearchPanel', 'monitoringScheduleUserSearchResults', 'closeMonitoringScheduleUserSearch']
      ].forEach(([panelId, resultsId, closeFunction]) => {
        const panel = document.getElementById(panelId);
        const results = document.getElementById(resultsId);
        if (!panel || !results || results.classList.contains('hidden') || panel.contains(target)) return;
        window[closeFunction]?.();
      });
    }

    document.addEventListener('pointerdown', closeParticipantPickersFromOutsideClick);

    function renderCalendarUserPickerChips({ targetId, clearButtonId, selectedUsers, removeFunction }) {
      const chips = document.getElementById(targetId);
      const clearBtn = document.getElementById(clearButtonId);
      if (chips) {
        chips.innerHTML = selectedUsers.map(user => `
          <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 px-1.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-100">
            ${renderUserAvatar(user, 20, 'text-[10px]')}
            <span class="truncate">${esc(calendarUserDisplayName(user))}</span>
            <button type="button" onclick="${removeFunction}(${Number(user.id)})" class="shrink-0 rounded-full px-1 text-gray-500 hover:bg-white/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white" title="Remove ${esc(calendarUserDisplayName(user))}">&times;</button>
          </span>
        `).join('');
      }
      if (clearBtn) clearBtn.classList.toggle('hidden', selectedUsers.length === 0);
    }

    function renderCalendarUserPickerResults({
      resultsId,
      inputId,
      selectedUsers,
      isOpen,
      addFunction,
      addAllFunction,
      activeIndex = -1,
      loading = false,
      allowAll = true,
      availableUsers = usersCache
    }) {
      const results = document.getElementById(resultsId);
      if (!results) return;
      if (!isOpen) {
        results.classList.add('hidden');
        return;
      }
      results.classList.remove('hidden');
      if (loading) {
        results.innerHTML = `<div class="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">Loading users...</div>`;
        return;
      }
      const query = (document.getElementById(inputId)?.value || '').trim();
      if (allowAll && query.toLowerCase() === 'all') {
        results.innerHTML = `
          <button type="button" data-user-picker-option onclick="${addAllFunction}()" class="${activeIndex === 0 ? 'is-active ' : ''}w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
            <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-700 dark:bg-cyan-400 text-xs font-black text-white dark:text-gray-950">All</span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-gray-900 dark:text-gray-100">All users</span>
              <span class="block truncate text-xs text-gray-500 dark:text-gray-400">Select every active user</span>
            </span>
          </button>`;
        return;
      }
      const matches = calendarFilteredUsers(inputId, selectedUsers, availableUsers);
      if (!matches.length) {
        results.innerHTML = `<div class="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">${query ? 'No users found.' : 'Start typing to search users.'}</div>`;
        return;
      }
      results.innerHTML = matches.map((user, index) => `
        <button type="button" data-user-picker-option onclick="${addFunction}(${Number(user.id)})" class="${activeIndex === index ? 'is-active ' : ''}w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
          ${renderUserAvatar(user, 32, 'text-xs')}
          <span class="min-w-0">
            <span class="block truncate text-sm font-black text-gray-900 dark:text-gray-100">${esc(calendarUserDisplayName(user))}</span>
            <span class="block truncate text-xs text-gray-500 dark:text-gray-400">${esc(user.email || user.role || user.username || '')}</span>
          </span>
        </button>
      `).join('');
    }

    function handleCalendarUserPickerKeydown(event, { resultsId, open, close, render, getIndex, setIndex }) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      if (!open()) return;
      render();
      const options = [...(document.getElementById(resultsId)?.querySelectorAll('[data-user-picker-option]') || [])];
      if (!options.length) return;
      let index = getIndex();
      if (event.key === 'ArrowDown') index = Math.min(index + 1, options.length - 1);
      if (event.key === 'ArrowUp') index = Math.max(index - 1, 0);
      setIndex(index);
      render();
      if (event.key === 'Enter') {
        const currentOptions = [...(document.getElementById(resultsId)?.querySelectorAll('[data-user-picker-option]') || [])];
        currentOptions[Math.max(0, index)]?.click();
      }
    }

    function renderCalendarUserSearch() {
      const summary = document.getElementById('calendarUserFilterSummary');
      renderCalendarUserPickerChips({
        targetId: 'calendarSelectedUsers',
        clearButtonId: 'calendarClearUsersBtn',
        selectedUsers: selectedCalendarUsers,
        removeFunction: 'removeCalendarUserFilter'
      });
      if (summary) {
        const active = selectedCalendarUsers.length > 0;
        summary.classList.toggle('hidden', !active);
        summary.textContent = active ? 'Viewing schedules for:' : '';
      }
      renderCalendarUserSearchResults();
    }

    function renderCalendarUserSearchResults({ loading = false } = {}) {
      renderCalendarUserPickerResults({
        resultsId: 'calendarUserSearchResults',
        inputId: 'calendarUserSearchInput',
        selectedUsers: selectedCalendarUsers,
        isOpen: calendarUserSearchOpen,
        addFunction: 'addCalendarUserFilter',
        addAllFunction: 'addAllCalendarUserFilters',
        activeIndex: calendarUserSearchActiveIndex,
        loading
      });
    }

    async function openCalendarUserSearch() {
      calendarUserSearchOpen = true;
      renderCalendarUserSearchResults({ loading: !(usersCache || []).length });
      await ensureCalendarUsers();
      renderCalendarUserSearch();
    }

    function closeCalendarUserSearch() {
      calendarUserSearchOpen = false;
      calendarUserSearchActiveIndex = -1;
      renderCalendarUserSearchResults();
    }

    function debouncedCalendarUserSearch() {
      clearTimeout(calendarUserSearchTimer);
      calendarUserSearchTimer = setTimeout(() => {
        calendarUserSearchOpen = true;
        calendarUserSearchActiveIndex = -1;
        renderCalendarUserSearchResults();
      }, 200);
    }

    function handleCalendarUserSearchKeydown(event) {
      handleCalendarUserPickerKeydown(event, {
        resultsId: 'calendarUserSearchResults',
        open: () => {
          calendarUserSearchOpen = true;
          return true;
        },
        close: closeCalendarUserSearch,
        render: renderCalendarUserSearchResults,
        getIndex: () => calendarUserSearchActiveIndex,
        setIndex: value => { calendarUserSearchActiveIndex = value; }
      });
    }

    window.addCalendarUserFilter = function(userId) {
      const user = (usersCache || []).find(u => Number(u.id) === Number(userId));
      if (!user || selectedCalendarUsers.some(u => Number(u.id) === Number(userId))) return;
      selectedCalendarUsers.push(user);
      const input = document.getElementById('calendarUserSearchInput');
      if (input) input.value = '';
      calendarUserSearchOpen = true;
      calendarUserSearchActiveIndex = -1;
      renderCalendarUserSearch();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    };

    window.addAllCalendarUserFilters = function() {
      selectedCalendarUsers = [...(usersCache || [])].sort((a, b) => calendarUserDisplayName(a).localeCompare(calendarUserDisplayName(b)));
      const input = document.getElementById('calendarUserSearchInput');
      if (input) input.value = '';
      calendarUserSearchOpen = false;
      calendarUserSearchActiveIndex = -1;
      renderCalendarUserSearch();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    };

    window.removeCalendarUserFilter = function(userId) {
      selectedCalendarUsers = selectedCalendarUsers.filter(user => Number(user.id) !== Number(userId));
      renderCalendarUserSearch();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    };

    window.clearCalendarUserFilters = function() {
      if (!selectedCalendarUsers.length) return;
      selectedCalendarUsers = [];
      const input = document.getElementById('calendarUserSearchInput');
      if (input) input.value = '';
      calendarUserSearchOpen = false;
      calendarUserSearchActiveIndex = -1;
      renderCalendarUserSearch();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    };

    document.addEventListener('click', (event) => {
      const panel = document.getElementById('calendarUserSearchPanel');
      if (panel && !panel.contains(event.target)) closeCalendarUserSearch();
      const modalPanel = document.getElementById('calendarModalUserSearchPanel');
      if (modalPanel && !modalPanel.contains(event.target)) closeCalendarModalUserSearch();
    });

    function defaultCalendarScopeForCurrentUser() {
      return currentUser?.role === 'superadmin' ? 'abe' : 'my';
    }

    function applyDefaultCalendarFiltersForCurrentUser({ force = false } = {}) {
      if (!currentUser) return;
      const key = `${currentUser.id || currentUser.username || 'user'}:${currentUser.role || 'user'}`;
      if (!force && calendarDefaultsAppliedForUserId === key) return;
      calendarDisplayView = 'month';
      calendarScope = 'my';
      calendarSidebarCollapsed = false;
      calendarQuickFilterState = { expandedGroup: null, selectedTypes: { my: [...ALL_MY_TYPE_KEYS], abe: [...ALL_ABE_TYPE_KEYS] } };
      calendarTimeFilter = 'all';
      const typeSelect = document.getElementById('calendarTypeFilter');
      if (typeSelect) typeSelect.value = '';
      calendarDefaultsAppliedForUserId = key;
    }

    function normalizeCalendarScopeValue(scope = 'all_visible') {
      const value = String(scope || 'all_visible');
      if (value === 'assigned') return 'my';
      if (value === 'all_visible' || value === 'all_schedules' || value === 'division' || value === 'global' || value === 'abed_wide') return 'abe';
      if (value === 'meetings') return 'meeting';
      if (value === 'my_meetings') return 'my_meetings';
      if (value === 'my_project_deadlines') return 'my_project_deadlines';
      if (value === 'trainings') return 'training';
      if (value === 'site_inspections') return 'site_inspection';
      if (value === 'site_geotaggings') return 'site_geotagging';
      if (value === 'past_schedules') return 'past';
      return value;
    }

    function setCalendarSidebarFilter(scope, type = '') {
      calendarScope = normalizeCalendarScopeValue(scope || defaultCalendarScopeForCurrentUser());
      calendarQuickFilterState.expandedGroup = calendarScope === 'abe' ? 'abe' : 'my';
      calendarQuickFilterState.selectedTypes[calendarQuickFilterState.expandedGroup] = type ? [type] : getCalendarTypesForGroup(calendarQuickFilterState.expandedGroup);
      const typeSelect = document.getElementById('calendarTypeFilter');
      if (typeSelect) typeSelect.value = type || '';
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    const calendarQuickFilterTypes = [
      ['project_deadlines', 'Deadlines', ['my', 'abe']],
      ['meeting', 'Meeting', ['my', 'abe']],
      ['training', 'Training', ['my', 'abe']],
      ['workshop', 'Workshop', ['my', 'abe']],
      ['orientation', 'Orientation', ['my', 'abe']],
      ['site_inspection', 'Site Inspection', ['my', 'abe']],
      ['site_survey', 'Site Survey', ['my', 'abe']],
      ['site_validation', 'Site Validation', ['my', 'abe']],
      ['site_geotagging', 'Site Geotagging', ['my', 'abe']],
      ['monitoring', 'Monitoring', ['my', 'abe']],
      ['procurement', 'Procurement', ['my', 'abe']],
      ['document_follow_up', 'Document Follow-up', ['my', 'abe']],
      ['project_milestone', 'Project Milestone', ['my', 'abe']],
      ['personal', 'Personal', ['my']],
      ['maintenance', 'Maintenance', ['my', 'abe']],
      ['leave', 'Leave / Out of Office', ['my', 'abe']],
      ['other', 'Others', ['my', 'abe']],
      ['document_review', 'For Review', ['my', 'abe']],
      ['cancelled', 'Cancelled', ['my', 'abe']]
    ];

    function getCalendarTypesForGroup(group) {
      return group === 'abe' ? [...ALL_ABE_TYPE_KEYS] : [...ALL_MY_TYPE_KEYS];
    }

    function selectAllCalendarTypes(group) {
      calendarQuickFilterState.selectedTypes[group] = getCalendarTypesForGroup(group);
    }

    function clearCalendarTypes(group) {
      calendarQuickFilterState.selectedTypes[group] = [];
    }

    function isCalendarTypeSelected(group, type) {
      return (calendarQuickFilterState.selectedTypes?.[group] || []).includes(type);
    }

    function toggleCalendarType(group, type) {
      const selected = new Set(calendarQuickFilterState.selectedTypes[group] || []);
      if (selected.has(type)) selected.delete(type);
      else selected.add(type);
      calendarQuickFilterState.selectedTypes[group] = [...selected];
    }

    function isCalendarGroupAllSelected(group) {
      const all = getCalendarTypesForGroup(group);
      const selected = new Set(calendarQuickFilterState.selectedTypes?.[group] || []);
      return all.every(type => selected.has(type));
    }

    function calendarActiveQuickFilterTypes() {
      const group = calendarQuickFilterState.expandedGroup || (calendarScope === 'abe' ? 'abe' : 'my');
      return calendarQuickFilterState.selectedTypes?.[group] || [];
    }

    function normalizeCalendarEventTypeKey(type) {
      const key = String(type || '').toLowerCase();
      if (key === 'canceled') return 'cancelled';
      if (key === 'document_followup' || key === 'follow_up') return 'document_follow_up';
      return key;
    }

    function calendarEventIsCheckedDocument(event = {}) {
      const eventType = normalizeCalendarEventTypeKey(event.event_type || event.type || event.schedule_type);
      const status = normalizeCalendarEventTypeKey(event.status);
      return event.source === 'document_checked'
        || eventType === 'document_checked'
        || eventType === 'checked'
        || eventType === 'checked_completed'
        || (event.document_id && (eventType === 'completed' || status === 'checked'));
    }

    function eventIsCancelled(event = {}) {
      return ['status', 'type', 'schedule_type', 'event_type'].some(key => {
        const value = normalizeCalendarEventTypeKey(event[key]);
        return value === 'cancelled';
      });
    }

    function calendarEventMatchesQuickFilter(event) {
      const selected = calendarActiveQuickFilterTypes();
      if (!selected.length) return false;
      const eventType = normalizeCalendarEventTypeKey(event.event_type || event.type || event.schedule_type);
      const status = normalizeCalendarEventTypeKey(event.status);
      return selected.some(type => {
        const normalized = normalizeCalendarEventTypeKey(type);
        if (normalized === 'cancelled') return eventIsCancelled(event);
        if (normalized === 'project_deadlines') return ['document_due', 'project_due', 'pending_due_rollup'].includes(event.source) || ['deadline', 'project_deadline', 'document_deadline', 'project_deadlines'].includes(eventType);
        if (normalized === 'document_review') return event.source === 'document_review' || eventType === 'document_review';
        return eventType === normalized;
      });
    }

    function syncCalendarQuickFilterTypeSelect() {
      const selected = calendarActiveQuickFilterTypes();
      const typeSelect = document.getElementById('calendarTypeFilter');
      const backendFilterTypes = new Set(['project_deadlines', 'meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey', 'site_validation', 'site_geotagging', 'monitoring', 'maintenance', 'leave', 'personal', 'other', 'document_review']);
      if (typeSelect) typeSelect.value = selected.length === 1 && backendFilterTypes.has(selected[0]) ? selected[0] : '';
    }

    function setCalendarQuickFilterGroup(group) {
      if (!['my', 'abe'].includes(group)) return;
      const wasExpanded = calendarQuickFilterState.expandedGroup === group;
      calendarQuickFilterState.expandedGroup = wasExpanded ? null : group;
      if (!wasExpanded) {
        calendarScope = group;
        selectAllCalendarTypes(group);
      }
      syncCalendarQuickFilterTypeSelect();
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      if (wasExpanded) renderCalendarSideFilters();
      else loadCalendarView({ silent: true });
    }

    function clearCalendarQuickFilterGroup(group) {
      if (!['my', 'abe'].includes(group)) return;
      calendarQuickFilterState.expandedGroup = group;
      calendarScope = group;
      clearCalendarTypes(group);
      syncCalendarQuickFilterTypeSelect();
      renderCalendarSideFilters();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    function toggleCalendarQuickFilterType(group, type) {
      if (!['my', 'abe'].includes(group)) return;
      calendarQuickFilterState.expandedGroup = group;
      calendarScope = group;
      toggleCalendarType(group, type);
      syncCalendarQuickFilterTypeSelect();
      renderCalendarSideFilters();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView({ silent: true });
    }

    function renderCalendarSideFilters() {
      const el = document.getElementById('calendarSideFilters');
      if (!el) return;
      const groups = [
        ['my', 'My Calendar'],
        ['abe', 'ABE Calendar']
      ];
      el.innerHTML = groups.map(([group, label]) => {
        const expanded = calendarQuickFilterState.expandedGroup === group;
        const activeGroup = calendarScope === group;
        const selected = new Set(calendarQuickFilterState.selectedTypes?.[group] || []);
        const items = calendarQuickFilterTypes.filter(([, , scopes]) => scopes.includes(group));
        return `
          <div class="calendar-filter-group">
            <button type="button" onclick="setCalendarQuickFilterGroup('${group}')" class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-black transition ${activeGroup ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}">
              <span class="flex items-center min-w-0"><span class="truncate">${esc(label)}</span></span>
              <span class="flex items-center gap-2">
                ${expanded && selected.size ? `<span onclick="event.stopPropagation(); clearCalendarQuickFilterGroup('${group}')" class="inline-flex w-5 h-5 items-center justify-center rounded-full text-xs hover:bg-white/70 dark:hover:bg-gray-800" title="Clear ${esc(label)}">&times;</span>` : ''}
                <span class="text-base leading-none">${expanded ? 'v' : '>'}</span>
              </span>
            </button>
            <div class="${expanded ? 'block' : 'hidden'} mt-1 ml-4 space-y-0.5">
              ${items.map(([type, typeLabel]) => {
                const active = selected.has(type);
                const color = getCalendarTypeColor(type);
                return `<button type="button" onclick="event.stopPropagation(); toggleCalendarQuickFilterType('${group}', '${type}')" aria-pressed="${active ? 'true' : 'false'}" class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-bold transition ${active ? 'bg-gray-50 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}">
                  <span class="calendar-type-filter-box ${active ? 'is-selected' : ''}" style="--calendar-type-color:${esc(color)}">${active ? '&#10003;' : ''}</span>
                  <span class="truncate">${esc(typeLabel)}</span>
                </button>`;
              }).join('')}
            </div>
          </div>`;
      }).join('');
    }

    function setCalendarTimeFilter(filter) {
      calendarTimeFilter = 'all';
      setupCalendarScopeControls();
      loadCalendarView({ silent: true });
    }

    function debouncedCalendarReload() {
      clearTimeout(calendarReloadTimer);
      calendarReloadTimer = setTimeout(() => {
        if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
        loadCalendarView({ silent: true });
      }, 250);
    }

    function buildCalendarQuery() {
      const params = new URLSearchParams();
      const range = getCalendarVisibleRange();
      params.set('month', calendarMonth);
      params.set('start', `${range.start}T00:00`);
      params.set('end', `${range.end}T23:59`);
      params.set('scope', calendarScope || defaultCalendarScopeForCurrentUser());
      params.set('include_project_dues', '1');
      params.set('include_manual_events', '1');
      if (selectedCalendarUsers.length) {
        params.set('user_ids', selectedCalendarUsers.map(u => Number(u.id)).filter(Boolean).join(','));
        params.set('personnel_filter', '1');
      }
      let type = document.getElementById('calendarTypeFilter')?.value || '';
      const search = document.getElementById('calendarSearchInput')?.value || '';
      if (type) params.set('event_type', type);
      if (search.trim()) params.set('search', search.trim());
      return params.toString();
    }

    function buildCalendarMonthAgendaQuery() {
      const params = new URLSearchParams();
      const [year, month] = calendarMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      params.set('month', calendarMonth);
      params.set('start', `${calendarMonth}-01T00:00`);
      params.set('end', `${calendarMonth}-${String(lastDay).padStart(2, '0')}T23:59`);
      params.set('scope', calendarScope || defaultCalendarScopeForCurrentUser());
      params.set('include_project_dues', '1');
      params.set('include_manual_events', '1');
      if (selectedCalendarUsers.length) {
        params.set('user_ids', selectedCalendarUsers.map(u => Number(u.id)).filter(Boolean).join(','));
        params.set('personnel_filter', '1');
      }
      const type = document.getElementById('calendarTypeFilter')?.value || '';
      const search = document.getElementById('calendarSearchInput')?.value || '';
      if (type) params.set('event_type', type);
      if (search.trim()) params.set('search', search.trim());
      return params.toString();
    }
    function changeCalendarMonth(offset) {
      if (calendarDisplayView === 'day') {
        calendarSelectedDate = shiftDateKey(calendarSelectedDate, offset);
      } else if (calendarDisplayView === 'week') {
        calendarSelectedDate = shiftDateKey(calendarSelectedDate, offset * 7);
      } else {
        const [year, month] = calendarMonth.split('-').map(Number);
        const next = new Date(year, month - 1 + offset, 1);
        calendarSelectedDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      }
      calendarSelectedDateKeys = new Set([calendarSelectedDate]);
      calendarMonth = calendarSelectedDate.slice(0, 7);
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
      loadCalendarView();
    }
    async function loadCalendarView(options = {}) {
      try {
        setupCalendarScopeControls();
        const [data, monthAgendaData] = await Promise.all([
          fetchJson(`${API}/calendar/events?${buildCalendarQuery()}`, options.silent ? { silentLoading: true } : {}),
          fetchJson(`${API}/calendar/events?${buildCalendarMonthAgendaQuery()}`, { silentLoading: true }).catch(() => ({ events: [] }))
        ]);
        lastCalendarEventsCache = applyCalendarTimeFilter(data.events || []).filter(event => !calendarEventIsCheckedDocument(event)).filter(calendarEventMatchesQuickFilter);
        lastCalendarMonthAgendaCache = applyCalendarTimeFilter(monthAgendaData.events || []).filter(event => !calendarEventIsCheckedDocument(event)).filter(calendarEventMatchesQuickFilter);
        lastCalendarDuesCache = summarizeCalendarEventsForLegacyDetails(lastCalendarEventsCache);
        renderUnifiedCalendar(lastCalendarEventsCache);
      } catch (e) {
        if (!options.silent) toast(e.message, 'error');
      }
    }

    const calendarEventTypeLabels = {
      general: 'General',
      meeting: 'Meeting',
      workshop: 'Workshop',
      orientation: 'Orientation',
      site_inspection: 'Site Inspection',
      site_survey: 'Site Survey',
      site_validation: 'Site Validation',
      site_geotagging: 'Site Geotagging',
      training: 'Training',
      monitoring: 'Monitoring',
      deadline: 'Project Deadline',
      project_deadline: 'Project Deadline',
      document_deadline: 'Project Deadline',
      procurement: 'Procurement',
      document_follow_up: 'Document Follow-up',
      document_followup: 'Document Follow-up',
      follow_up: 'Follow-up',
      project_milestone: 'Project Milestone',
      maintenance: 'Maintenance',
      personal: 'Personal',
      leave: 'Leave / Out of Office',
      other: 'Others',
      overdue: 'Overdue',
      document_review: 'For Review',
      cancelled: 'Cancelled'
    };
    const calendarTypeColors = {
      general: '#2563eb',
      meeting: '#2563eb',
      workshop: '#9333ea',
      orientation: '#0284c7',
      site_inspection: '#7c3aed',
      site_survey: '#7c3aed',
      site_validation: '#8b5cf6',
      site_geotagging: '#0d9488',
      training: '#16a34a',
      monitoring: '#0f766e',
      deadline: '#dc2626',
      project_deadline: '#dc2626',
      document_deadline: '#dc2626',
      project_deadlines: '#dc2626',
      procurement: '#d97706',
      document_follow_up: '#0891b2',
      project_milestone: '#4f46e5',
      maintenance: '#475569',
      personal: '#6b7280',
      leave: '#db2777',
      other: '#64748b',
      overdue: '#dc2626',
      document_review: '#ca8a04',
      cancelled: '#991b1b'
    };

    function getCalendarTypeColor(type = 'general') {
      const normalized = normalizeCalendarEventTypeKey(type || 'general');
      return calendarTypeColors[normalized] || calendarTypeColors.general;
    }

    function calendarEventTypeLabel(event = {}) {
      if (event.event_type === 'other' && String(event.event_type_detail || '').trim()) {
        return String(event.event_type_detail).trim();
      }
      return calendarEventTypeLabels[event.event_type] || event.event_type || 'Calendar';
    }

    function calendarEventColor(event = {}) {
      return event.color || getCalendarTypeColor(event.event_type || event.type || event.schedule_type || (event.source === 'project_due' ? 'project_deadline' : 'general'));
    }

    function calendarSourceLabel(event = {}) {
      const visibility = String(event.visibility || '').toLowerCase();
      if (['abed_wide', 'division', 'global'].includes(visibility)) return 'ABE Calendar';
      if (event.source === 'project_due' || event.source === 'document_due') return Number(event.owner_user_id) === Number(currentUser?.id) ? 'My Calendar' : 'ABE Calendar';
      if (event.source === 'manual_event') {
        return (event.participants || []).some(participant => Number(participant.user_id) === Number(currentUser?.id)) ? 'My Calendar' : 'ABE Calendar';
      }
      return 'ABE Calendar';
    }
    function shiftDateKey(dateKey, days) {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function easterSundayDateKey(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function lastMondayDateKey(year, month) {
      const d = new Date(year, month, 0);
      while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
      return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function philippineHolidayForDate(dateKey) {
      const year = Number(dateKey.slice(0, 4));
      const fixed = {
        [`${year}-01-01`]: "New Year's Day",
        [`${year}-04-09`]: 'Araw ng Kagitingan',
        [`${year}-05-01`]: 'Labor Day',
        [`${year}-06-12`]: 'Independence Day',
        [`${year}-08-21`]: 'Ninoy Aquino Day',
        [`${year}-11-01`]: "All Saints' Day",
        [`${year}-11-02`]: "All Souls' Day",
        [`${year}-11-30`]: 'Bonifacio Day',
        [`${year}-12-08`]: 'Feast of the Immaculate Conception',
        [`${year}-12-24`]: 'Christmas Eve',
        [`${year}-12-25`]: 'Christmas Day',
        [`${year}-12-30`]: 'Rizal Day',
        [`${year}-12-31`]: 'Last Day of the Year',
        [lastMondayDateKey(year, 8)]: 'National Heroes Day'
      };
      const easter = easterSundayDateKey(year);
      fixed[shiftDateKey(easter, -3)] = 'Maundy Thursday';
      fixed[shiftDateKey(easter, -2)] = 'Good Friday';
      fixed[shiftDateKey(easter, -1)] = 'Black Saturday';
      const proclaimed = {
        '2026-02-17': 'Chinese New Year',
        '2026-04-02': 'Maundy Thursday',
        '2026-04-03': 'Good Friday',
        '2026-04-04': 'Black Saturday',
        '2026-11-02': "All Souls' Day"
      };
      return proclaimed[dateKey] || fixed[dateKey] || '';
    }

    function calendarHolidayChip(dateKey) {
      const holiday = philippineHolidayForDate(dateKey);
      return holiday ? `<div title="${esc(holiday)}" class="truncate rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 text-[11px] font-black text-red-700 dark:text-red-200">PH Holiday: ${esc(holiday)}</div>` : '';
    }

    function weekStartDateKey(dateKey) {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() - d.getDay());
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getCalendarVisibleRange() {
      if (calendarDisplayView === 'day') return { start: calendarSelectedDate, end: calendarSelectedDate };
      if (calendarDisplayView === 'week') {
        const start = weekStartDateKey(calendarSelectedDate);
        return { start, end: shiftDateKey(start, 6) };
      }
      const [year, month] = calendarMonth.split('-').map(Number);
      const first = `${calendarMonth}-01`;
      const start = weekStartDateKey(first);
      const endOfMonth = new Date(year, month, 0);
      const endKey = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      const endStart = weekStartDateKey(endKey);
      return { start, end: shiftDateKey(endStart, 6) };
    }

    function setCalendarSelectedDate(dateKey) {
      calendarSelectedDate = dateKey;
      calendarSelectedDateKeys = new Set([dateKey]);
      calendarMonth = dateKey.slice(0, 7);
      setupCalendarScopeControls();
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
    }

    function calendarSelectedDateList() {
      const keys = [...(calendarSelectedDateKeys || new Set())].filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
      return keys.length ? keys : [calendarSelectedDate];
    }

    function calendarDateRangeKeys(startKey, endKey) {
      const keys = [];
      const forward = startKey <= endKey;
      let cursor = forward ? startKey : endKey;
      const end = forward ? endKey : startKey;
      while (cursor <= end) {
        keys.push(cursor);
        cursor = shiftDateKey(cursor, 1);
      }
      return keys;
    }

    function applyMiniCalendarSelection(dateKeys, options = {}) {
      const keys = [...new Set((dateKeys || []).filter(Boolean))].sort();
      if (!keys.length) keys.push(calendarSelectedDate);
      calendarSelectedDateKeys = new Set(keys);
      calendarSelectedDate = options.anchor || keys[0];
      calendarMonth = calendarSelectedDate.slice(0, 7);
      if (options.view) calendarDisplayView = options.view;
      setupCalendarScopeControls();
      renderUnifiedCalendar(keys.length > 1 && lastCalendarMonthAgendaCache.length ? lastCalendarMonthAgendaCache : lastCalendarEventsCache);
      if (appCurrentView === 'calendar' && !restoringHistoryState) replaceAppHistory('calendar', { month: calendarMonth, scope: calendarScope });
    }

    function handleMiniCalendarPointerDown(event, dateKey) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const additive = event.ctrlKey || event.metaKey;
      calendarMiniDragState = { start: dateKey, end: dateKey, additive, base: new Set(calendarSelectedDateKeys), moved: false, pointerId: event.pointerId };
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    }

    function handleMiniCalendarPointerEnter(event, dateKey) {
      if (!calendarMiniDragState) return;
      calendarMiniDragState.end = dateKey;
      calendarMiniDragState.moved = calendarMiniDragState.moved || dateKey !== calendarMiniDragState.start;
      const range = calendarDateRangeKeys(calendarMiniDragState.start, dateKey);
      const keys = calendarMiniDragState.additive ? [...calendarMiniDragState.base, ...range] : range;
      applyMiniCalendarSelection(keys, { anchor: dateKey });
    }

    function handleMiniCalendarPointerMove(event) {
      if (!calendarMiniDragState) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-mini-calendar-date]');
      const dateKey = target?.dataset?.miniCalendarDate;
      if (dateKey && dateKey !== calendarMiniDragState.end) handleMiniCalendarPointerEnter(event, dateKey);
    }

    function handleMiniCalendarPointerUp(event, dateKey) {
      if (!calendarMiniDragState) return;
      const state = calendarMiniDragState;
      calendarMiniDragState = null;
      event.currentTarget?.releasePointerCapture?.(state.pointerId);
      if (state.moved) {
        const range = calendarDateRangeKeys(state.start, state.end || dateKey);
        const keys = state.additive ? [...state.base, ...range] : range;
        applyMiniCalendarSelection(keys, { anchor: dateKey });
        return;
      }
      if (state.additive) {
        const next = new Set(state.base);
        if (next.has(dateKey)) next.delete(dateKey);
        else next.add(dateKey);
        if (!next.size) next.add(dateKey);
        applyMiniCalendarSelection([...next], { anchor: dateKey });
        return;
      }
      applyMiniCalendarSelection([dateKey], { anchor: dateKey, view: 'day' });
      loadCalendarView({ silent: true });
    }

    function calendarEventHasPassed(event) {
      const when = event?.end || event?.start;
      const ts = new Date(when).getTime();
      return Number.isFinite(ts) && ts < Date.now();
    }

    function applyCalendarTimeFilter(events = []) {
      calendarTimeFilter = 'all';
      return events;
    }

    function calendarEventDateKey(event) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(event.start));
    }

    function calendarEventTimeLabel(event) {
      if (event.all_day) return 'All day';
      return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(event.start));
    }

    function calendarEventChip(event, compact = false) {
      const color = calendarEventColor(event);
      return `<button type="button" onclick="openCalendarEventDetail('${esc(event.id)}')" class="w-full text-left px-2 py-1 rounded-md text-xs font-bold text-white truncate shadow-sm hover:opacity-90" style="background:${esc(color)}" title="${esc(event.title)}">${esc(event.title)}</button>`;
    }

    function calendarEventListCard(event) {
      const color = calendarEventColor(event);
      const typeLabel = calendarEventTypeLabel(event);
      const meta = [typeLabel, calendarSourceLabel(event)].filter(Boolean).join(' - ');
      const sub = [event.location, event.project_name || event.related_project_name].filter(Boolean).join(' - ');
      return `<button onclick="openCalendarEventDetail('${esc(event.id)}')" class="calendar-schedule-card w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition" style="--calendar-type-color:${esc(color)}">
        <div class="flex items-start gap-3">
          <span class="mt-1 w-2.5 h-2.5 rounded-full flex-none" style="background:${esc(color)}"></span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-black text-gray-500 dark:text-gray-400">${esc(meta)}</div>
            <div class="font-black text-gray-900 dark:text-gray-100 truncate">${esc(event.title || 'Untitled Schedule')}</div>
            ${sub ? `<div class="text-sm text-gray-600 dark:text-gray-400 truncate">${esc(sub)}</div>` : ''}
          </div>
        </div>
      </button>`;
    }

    function calendarEventEndDateKey(event) {
      const value = event?.end || event?.start;
      return value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(value)) : calendarEventDateKey(event);
    }

    function calendarEventDurationDays(event) {
      const start = calendarEventDateKey(event);
      const end = calendarEventEndDateKey(event);
      return Math.max(1, Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1);
    }

    function calendarEventDateRangeLabel(event) {
      if (!event?.start) return 'Date not available';
      const startDate = calendarEventDateKey(event);
      const endDate = calendarEventEndDateKey(event);
      if (event.all_day) {
        return startDate === endDate
          ? `${fmtDateOnly(event.start)} - All day`
          : `${fmtDateOnly(event.start)} - ${fmtDateOnly(event.end || event.start)} - All day`;
      }
      if (!event.end) return `${fmtDateOnly(event.start)} - ${calendarEventTimeLabel(event)}`;
      const startTime = calendarEventTimeLabel(event);
      const endTime = calendarEventTimeLabel({ ...event, start: event.end, all_day: false });
      return startDate === endDate
        ? `${fmtDateOnly(event.start)} - ${startTime} to ${endTime}`
        : `${fmtDateTime(event.start)} to ${fmtDateTime(event.end)}`;
    }

    function calendarEventDurationLabel(event) {
      if (!event?.start) return '';
      if (event.all_day) {
        const days = calendarEventDurationDays(event);
        return `${days} day${days === 1 ? '' : 's'} (all day)`;
      }
      if (!event.end) return 'No end time specified';
      const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
      if (!Number.isFinite(durationMs) || durationMs <= 0) return 'No duration';
      const totalMinutes = Math.round(durationMs / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const parts = [];
      if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
      if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
      if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
      return parts.join(', ') || 'Less than a minute';
    }

    function calendarEventOverlapsDate(event, dateKey) {
      const start = calendarEventDateKey(event);
      const end = calendarEventEndDateKey(event);
      return start <= dateKey && end >= dateKey;
    }

    function summarizeCalendarEventsForLegacyDetails(events) {
      const map = {};
      events.forEach(event => {
        const key = calendarEventDateKey(event);
        if (!map[key]) map[key] = { due: 0, completed: 0, forReview: 0 };
        if (['document_due', 'project_due'].includes(event.source)) map[key].due++;
        if (event.source === 'pending_due_rollup') map[key].due += (event.pending_items || []).length || 0;
        if (event.source === 'document_review') map[key].forReview++;
        if (event.source === 'manual_event') map[key].completed++;
      });
      return Object.entries(map).map(([due_date, counts]) => ({
        due_date,
        due_count: counts.due,
        completed_count: counts.completed,
        for_review_count: counts.forReview
      }));
    }

    function renderUnifiedCalendar(events = []) {
      const title = document.getElementById('calendarTitle');
      const grid = document.getElementById('calendarGrid');
      const list = document.getElementById('calendarListView');
      const header = document.getElementById('calendarWeekHeader');
      const monthShell = document.getElementById('calendarMonthShell');
      const weekShell = document.getElementById('calendarWeekShell');
      const dayShell = document.getElementById('calendarDayShell');
      const agendaShell = document.getElementById('calendarAgendaShell');
      const [year, month] = calendarMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const range = getCalendarVisibleRange();
      if (title) {
        title.textContent = calendarDisplayView === 'day'
          ? fmtDateOnly(calendarSelectedDate)
            : calendarDisplayView === 'week'
              ? `${fmtDateOnly(range.start)} - ${fmtDateOnly(range.end)}`
            : calendarDisplayView === 'agenda'
              ? 'Schedules'
              : new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(firstDay);
      }
      const totals = events.reduce((acc, event) => {
        if (['document_due', 'project_due'].includes(event.source)) acc.due++;
        if (event.source === 'pending_due_rollup') acc.due += (event.pending_items || []).length || 0;
        if (event.event_type === 'meeting') acc.meetings++;
        if (event.source === 'document_review') acc.review++;
        if (event.source === 'manual_event') acc.manual++;
        return acc;
      }, { due: 0, meetings: 0, review: 0, manual: 0 });
      [['calendarMetricDue', totals.due], ['calendarMetricCompleted', totals.meetings], ['calendarMetricReview', totals.review], ['calendarMetricChecked', totals.manual]].forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      });
      renderMiniCalendar(events);
      renderUpcomingCalendarEvents(events);
      if (calendarSelectedDateList().length > 1) {
        grid?.classList.add('hidden');
        list?.classList.add('hidden');
        header?.classList.add('hidden');
        monthShell?.classList.add('hidden');
        weekShell?.classList.toggle('hidden', calendarSelectedDateList().length > 7);
        dayShell?.classList.add('hidden');
        agendaShell?.classList.toggle('hidden', calendarSelectedDateList().length <= 7);
        if (calendarSelectedDateList().length <= 7) {
          renderSelectedDateColumnsView(events);
          if (agendaShell) agendaShell.innerHTML = '';
        } else {
          renderSelectedDateAgendaView(events);
          if (weekShell) weekShell.innerHTML = '';
        }
        return;
      }
      monthShell?.classList.toggle('hidden', calendarDisplayView !== 'month');
      weekShell?.classList.toggle('hidden', calendarDisplayView !== 'week');
      dayShell?.classList.toggle('hidden', calendarDisplayView !== 'day');
      agendaShell?.classList.toggle('hidden', calendarDisplayView !== 'agenda');
      if (calendarDisplayView === 'month') {
        if (grid) grid.className = 'calendar-month-weeks';
        grid?.classList.remove('hidden');
        list?.classList.add('hidden');
        header?.classList.remove('hidden');
        renderCalendarMonth(events);
        if (weekShell) weekShell.innerHTML = '';
        if (dayShell) dayShell.innerHTML = '';
        if (agendaShell) agendaShell.innerHTML = '';
      } else if (calendarDisplayView === 'week') {
        grid?.classList.add('hidden');
        list?.classList.add('hidden');
        header?.classList.add('hidden');
        renderCalendarWeekView(events);
      } else if (calendarDisplayView === 'day') {
        grid?.classList.add('hidden');
        list?.classList.add('hidden');
        header?.classList.add('hidden');
        renderCalendarDayView(events);
      } else {
        grid?.classList.add('hidden');
        list?.classList.add('hidden');
        header?.classList.add('hidden');
        renderCalendarAgendaView(events);
      }
    }

    function renderCalendarMonth(events = []) {
      const grid = document.getElementById('calendarGrid');
      if (!grid) return;
      const [year, month] = calendarMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const firstKey = `${calendarMonth}-01`;
      const gridStart = weekStartDateKey(firstKey);
      const visibleLimit = 2;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      let html = '';
      for (let week = 0; week < 6; week++) {
        const weekStart = shiftDateKey(gridStart, week * 7);
        const weekEnd = shiftDateKey(weekStart, 6);
        const weekSegments = events
          .map(event => {
            const eventStart = calendarEventDateKey(event);
            const eventEnd = calendarEventEndDateKey(event);
            if (eventStart > weekEnd || eventEnd < weekStart) return null;
            const segmentStart = eventStart < weekStart ? weekStart : eventStart;
            const segmentEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
            const startCol = Math.round((new Date(`${segmentStart}T00:00:00`) - new Date(`${weekStart}T00:00:00`)) / 86400000);
            const endCol = Math.round((new Date(`${segmentEnd}T00:00:00`) - new Date(`${weekStart}T00:00:00`)) / 86400000);
            return { event, eventStart, eventEnd, segmentStart, segmentEnd, startCol, endCol, span: endCol - startCol + 1 };
          })
          .filter(Boolean)
          .sort((a, b) => {
            const aMulti = calendarEventDurationDays(a.event) > 1 ? 0 : 1;
            const bMulti = calendarEventDurationDays(b.event) > 1 ? 0 : 1;
            if (aMulti !== bMulti) return aMulti - bMulti;
            if (a.eventStart !== b.eventStart) return a.eventStart.localeCompare(b.eventStart);
            if (b.span !== a.span) return b.span - a.span;
            return String(a.event.title || '').localeCompare(String(b.event.title || ''));
          });
        const laneOccupancy = [];
        weekSegments.forEach(segment => {
          let lane = 0;
          while (laneOccupancy[lane]?.some(existing => !(segment.endCol < existing.startCol || segment.startCol > existing.endCol))) lane++;
          segment.lane = lane;
          (laneOccupancy[lane] ||= []).push(segment);
        });
        const visibleByDate = {};
        const totalByDate = {};
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const dateKey = shiftDateKey(weekStart, dayIndex);
          totalByDate[dateKey] = events.filter(event => calendarEventOverlapsDate(event, dateKey)).length;
          visibleByDate[dateKey] = weekSegments.filter(segment => segment.lane < visibleLimit && segment.startCol <= dayIndex && segment.endCol >= dayIndex).length;
        }
        const cells = Array.from({ length: 7 }, (_, dayIndex) => {
          const isoDate = shiftDateKey(weekStart, dayIndex);
          const day = Number(isoDate.slice(-2));
          const holiday = calendarHolidayChip(isoDate);
          const isToday = isoDate === today;
          const isSelected = isoDate === calendarSelectedDate;
          const isCurrentMonth = isoDate.slice(0, 7) === calendarMonth;
          const moreCount = Math.max(0, (totalByDate[isoDate] || 0) - (visibleByDate[isoDate] || 0));
          const more = moreCount ? `<button onclick="event.stopPropagation(); openCalendarDayAgenda('${isoDate}')" class="calendar-day-more text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:underline">+${moreCount} more</button>` : '';
          return `<div data-calendar-date="${isoDate}" onclick="if(event.target === this) { setCalendarSelectedDate('${isoDate}'); openCalendarEventModal(null, '${isoDate}'); }" class="calendar-day-cell relative border-b border-r border-gray-100 dark:border-gray-800 p-2 flex flex-col gap-1 ${isCurrentMonth ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950 text-gray-400 dark:text-gray-600'} ${isToday ? 'ring-2 ring-cyan-500 ring-inset bg-cyan-50 dark:bg-cyan-950/20' : ''} ${isSelected && !isToday ? 'ring-2 ring-indigo-400 ring-inset' : ''}">
            <div class="relative z-[4] flex items-center gap-1.5 min-w-0">
              <button onclick="event.stopPropagation(); setCalendarSelectedDate('${isoDate}'); calendarDisplayView='day'; setupCalendarScopeControls(); loadCalendarView()" class="shrink-0 min-w-7 h-7 px-2 rounded-full text-sm font-black ${isToday ? 'bg-cyan-700 text-white dark:bg-cyan-400 dark:text-gray-950' : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'}">${day}</button>
              <div class="min-w-0 flex-1 overflow-hidden">${holiday}</div>
            </div>
            ${more}
          </div>`;
        }).join('');
        const bars = weekSegments
          .filter(segment => segment.lane < visibleLimit)
          .map(segment => {
            const event = segment.event;
            const color = event.color || '#2563eb';
            const label = esc(event.title || 'Untitled Schedule');
            return `<button type="button" onclick="openCalendarEventDetail('${esc(event.id)}')" class="calendar-span-event hover:opacity-90" style="grid-column:${segment.startCol + 1} / span ${segment.span}; grid-row:${segment.lane + 1}; background:${esc(color)}" title="${esc(event.title || 'Untitled Schedule')}">${label}</button>`;
          }).join('');
        html += `<div class="calendar-week-row">${cells}<div class="calendar-week-event-layer">${bars}</div></div>`;
      }
      grid.innerHTML = html;
    }

    function renderCalendarListMode(events = [], mode = 'agenda') {
      const list = document.getElementById('calendarListView');
      if (!list) return;
      let filtered = [...events];
      if (mode === 'day') filtered = filtered.filter(e => calendarEventDateKey(e) === calendarSelectedDate);
      if (mode === 'week') {
        const start = weekStartDateKey(calendarSelectedDate);
        const end = shiftDateKey(start, 6);
        filtered = filtered.filter(e => calendarEventDateKey(e) >= start && calendarEventDateKey(e) <= end);
      }
      const groups = filtered.reduce((acc, event) => {
        const key = calendarEventDateKey(event);
        (acc[key] ||= []).push(event);
        return acc;
      }, {});
      if (mode === 'day') groups[calendarSelectedDate] ||= [];
      if (mode === 'week') {
        const start = weekStartDateKey(calendarSelectedDate);
        for (let i = 0; i < 7; i++) groups[shiftDateKey(start, i)] ||= [];
      }
      if (!filtered.length && mode === 'agenda') {
        const emptyText = selectedCalendarUsers.length > 1
          ? 'No schedules found for the selected users.'
          : selectedCalendarUsers.length === 1
            ? 'No schedules found for the selected user.'
            : 'No calendar items found.';
        list.innerHTML = `<div class="p-8 text-center text-gray-500 dark:text-gray-400 font-semibold">${emptyText}</div>`;
        return;
      }
      list.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => `
        <section class="p-4">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <div class="text-sm font-black text-gray-900 dark:text-gray-100">${fmtDateOnly(date)}</div>
            ${philippineHolidayForDate(date) ? `<span class="px-2 py-1 rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs font-black text-red-700 dark:text-red-200">PH Holiday: ${esc(philippineHolidayForDate(date))}</span>` : ''}
          </div>
          <div class="space-y-2">${items.length ? items.map(event => `
            <button onclick="openCalendarEventDetail('${esc(event.id)}')" class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div class="flex items-start gap-3">
                <span class="mt-1 w-3 h-3 rounded-full flex-none" style="background:${esc(event.color || '#2563eb')}"></span>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-gray-500 dark:text-gray-400">${esc(calendarEventTimeLabel(event))} · ${esc(calendarEventTypeLabel(event))}</div>
                  <div class="font-black text-gray-900 dark:text-gray-100 truncate">${esc(event.title)}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400 truncate">${esc([event.location, event.project_name].filter(Boolean).join(' · '))}</div>
                </div>
              </div>
            </button>`).join('') : '<div class="text-sm text-gray-500 dark:text-gray-400">No events.</div>'}</div>
        </section>`).join('');
    }

    function calendarEventsForDate(events = [], dateKey) {
      return events
        .filter(event => calendarEventOverlapsDate(event, dateKey))
        .sort((a, b) => new Date(a.start) - new Date(b.start) || String(a.title || '').localeCompare(String(b.title || '')));
    }

    function renderSelectedDateColumnsView(events = []) {
      const shell = document.getElementById('calendarWeekShell');
      if (!shell) return;
      const selectedDates = calendarSelectedDateList().slice(0, 7);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const titleText = selectedDates.length === 1
        ? fmtDateOnly(selectedDates[0])
        : `${fmtDateOnly(selectedDates[0])} - ${fmtDateOnly(selectedDates[selectedDates.length - 1])}`;
      shell.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <div class="text-sm font-black text-gray-900 dark:text-gray-100">${esc(titleText)}</div>
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">${selectedDates.length} selected day${selectedDates.length === 1 ? '' : 's'}</div>
        </div>
        <div class="calendar-view-scroll">
          <div class="calendar-week-view-grid" style="grid-template-columns: repeat(${selectedDates.length}, minmax(0, 1fr));">
            ${selectedDates.map(dateKey => {
              const dayEvents = calendarEventsForDate(events, dateKey);
              const date = new Date(`${dateKey}T00:00:00`);
              const weekday = new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date);
              const holiday = philippineHolidayForDate(dateKey);
              return `<section class="calendar-week-day-column p-3 ${dateKey === today ? 'bg-cyan-50/60 dark:bg-cyan-950/20' : ''}">
                <button type="button" onclick="applyMiniCalendarSelection(['${dateKey}'], { anchor: '${dateKey}', view: 'day' }); loadCalendarView({ silent: true })" class="w-full text-left mb-3">
                  <div class="text-xs font-black uppercase text-gray-500 dark:text-gray-400">${esc(weekday)}</div>
                  <div class="text-2xl font-black ${dateKey === today ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-100'}">${Number(dateKey.slice(-2))}</div>
                  <div class="text-xs font-bold text-gray-500 dark:text-gray-400">${esc(new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date))}</div>
                  ${holiday ? `<div class="mt-1 text-[11px] font-black text-red-700 dark:text-red-300 truncate">${esc(holiday)}</div>` : ''}
                </button>
                <div class="space-y-2">${dayEvents.length ? dayEvents.map(calendarEventListCard).join('') : `<div class="text-xs font-semibold text-gray-400 dark:text-gray-500 py-2">No events</div>`}</div>
              </section>`;
            }).join('')}
          </div>
        </div>`;
    }

    function renderSelectedDateAgendaView(events = []) {
      const shell = document.getElementById('calendarAgendaShell');
      if (!shell) return;
      const selectedDates = calendarSelectedDateList();
      const selectedSet = new Set(selectedDates);
      const groups = {};
      events.forEach(event => {
        const key = calendarEventDateKey(event);
        if (selectedSet.has(key)) (groups[key] ||= []).push(event);
      });
      Object.keys(groups).forEach(dateKey => groups[dateKey].sort((a, b) => new Date(a.start) - new Date(b.start) || String(a.title || '').localeCompare(String(b.title || ''))));
      const datesWithEvents = selectedDates.filter(dateKey => (groups[dateKey] || []).length);
      shell.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <div class="text-lg font-black text-gray-900 dark:text-gray-100">Selected Dates</div>
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">${selectedDates.length} selected days</div>
        </div>
        <div class="calendar-view-scroll">
          ${datesWithEvents.length ? datesWithEvents.map(dateKey => {
            const date = new Date(`${dateKey}T00:00:00`);
            const heading = `${new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)} - ${new Intl.DateTimeFormat('en-PH', { weekday: 'long' }).format(date)}`;
            const holiday = philippineHolidayForDate(dateKey);
            return `<section class="p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <div class="text-sm font-black text-gray-900 dark:text-gray-100">${esc(heading)}</div>
                ${holiday ? `<span class="px-2 py-1 rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs font-black text-red-700 dark:text-red-200">PH Holiday: ${esc(holiday)}</span>` : ''}
              </div>
              <div class="space-y-2">${groups[dateKey].map(calendarEventListCard).join('')}</div>
            </section>`;
          }).join('') : `<div class="h-full min-h-[18rem] grid place-items-center text-center text-gray-500 dark:text-gray-400"><div><div class="font-black text-gray-700 dark:text-gray-200">No events for the selected dates.</div></div></div>`}
        </div>`;
    }

    function renderCalendarWeekView(events = []) {
      const shell = document.getElementById('calendarWeekShell');
      if (!shell) return;
      const start = weekStartDateKey(calendarSelectedDate);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const days = Array.from({ length: 7 }, (_, index) => shiftDateKey(start, index));
      shell.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <div class="text-sm font-black text-gray-900 dark:text-gray-100">${esc(fmtDateOnly(start))} - ${esc(fmtDateOnly(shiftDateKey(start, 6)))}</div>
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">Week schedule</div>
        </div>
        <div class="calendar-view-scroll">
          <div class="calendar-week-view-grid">
            ${days.map(dateKey => {
              const dayEvents = calendarEventsForDate(events, dateKey);
              const date = new Date(`${dateKey}T00:00:00`);
              const weekday = new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date);
              const holiday = philippineHolidayForDate(dateKey);
              return `<section class="calendar-week-day-column p-3 ${dateKey === today ? 'bg-cyan-50/60 dark:bg-cyan-950/20' : ''}">
                <button type="button" onclick="setCalendarSelectedDate('${dateKey}'); calendarDisplayView='day'; setupCalendarScopeControls(); loadCalendarView({ silent: true })" class="w-full text-left mb-3">
                  <div class="text-xs font-black uppercase text-gray-500 dark:text-gray-400">${esc(weekday)}</div>
                  <div class="text-2xl font-black ${dateKey === today ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-100'}">${Number(dateKey.slice(-2))}</div>
                  ${holiday ? `<div class="mt-1 text-[11px] font-black text-red-700 dark:text-red-300 truncate">${esc(holiday)}</div>` : ''}
                </button>
                <div class="space-y-2">${dayEvents.length ? dayEvents.map(calendarEventListCard).join('') : `<div class="text-xs font-semibold text-gray-400 dark:text-gray-500 py-2">No schedules</div>`}</div>
              </section>`;
            }).join('')}
          </div>
        </div>`;
    }

    function renderCalendarDayView(events = []) {
      const shell = document.getElementById('calendarDayShell');
      if (!shell) return;
      const dayEvents = calendarEventsForDate(events, calendarSelectedDate);
      const holiday = philippineHolidayForDate(calendarSelectedDate);
      shell.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <div class="text-lg font-black text-gray-900 dark:text-gray-100">${esc(fmtDateOnly(calendarSelectedDate))}</div>
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">Day schedule</div>
          ${holiday ? `<div class="mt-2 inline-flex px-2 py-1 rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs font-black text-red-700 dark:text-red-200">PH Holiday: ${esc(holiday)}</div>` : ''}
        </div>
        <div class="calendar-view-scroll p-4">
          ${dayEvents.length ? `<div class="space-y-2">${dayEvents.map(calendarEventListCard).join('')}</div>` : `<div class="h-full min-h-[18rem] grid place-items-center text-center text-gray-500 dark:text-gray-400"><div><div class="font-black text-gray-700 dark:text-gray-200">No schedules for this day.</div></div></div>`}
        </div>`;
    }

    function renderCalendarAgendaView(events = []) {
      const shell = document.getElementById('calendarAgendaShell');
      if (!shell) return;
      const groups = events
        .slice()
        .sort((a, b) => new Date(a.start) - new Date(b.start) || String(a.title || '').localeCompare(String(b.title || '')))
        .reduce((acc, event) => {
          const key = calendarEventDateKey(event);
          (acc[key] ||= []).push(event);
          return acc;
        }, {});
      const dates = Object.keys(groups).sort();
      shell.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <div class="text-lg font-black text-gray-900 dark:text-gray-100">Agenda</div>
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">Schedules grouped by date</div>
        </div>
        <div class="calendar-view-scroll">
          ${dates.length ? dates.map(dateKey => {
            const date = new Date(`${dateKey}T00:00:00`);
            const heading = `${new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)} - ${new Intl.DateTimeFormat('en-PH', { weekday: 'long' }).format(date)}`;
            const holiday = philippineHolidayForDate(dateKey);
            return `<section class="p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <div class="text-sm font-black text-gray-900 dark:text-gray-100">${esc(heading)}</div>
                ${holiday ? `<span class="px-2 py-1 rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs font-black text-red-700 dark:text-red-200">PH Holiday: ${esc(holiday)}</span>` : ''}
              </div>
              <div class="space-y-2">${groups[dateKey].map(calendarEventListCard).join('')}</div>
            </section>`;
          }).join('') : `<div class="h-full min-h-[18rem] grid place-items-center text-center text-gray-500 dark:text-gray-400"><div><div class="font-black text-gray-700 dark:text-gray-200">No schedules found.</div></div></div>`}
        </div>`;
    }

    function renderMiniCalendar(events = []) {
      const el = document.getElementById('calendarMiniGrid');
      if (!el) return;
      const [year, month] = calendarMonth.split('-').map(Number);
      const first = new Date(year, month - 1, 1);
      const days = new Date(year, month, 0).getDate();
      const monthEvents = lastCalendarMonthAgendaCache.length ? lastCalendarMonthAgendaCache : events;
      const datesWithEvents = new Set();
      for (let day = 1; day <= days; day++) {
        const dateKey = `${calendarMonth}-${String(day).padStart(2, '0')}`;
        if (monthEvents.some(event => calendarEventOverlapsDate(event, dateKey))) datesWithEvents.add(dateKey);
      }
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const selectedKeys = new Set(calendarSelectedDateList());
      const weekStart = calendarDisplayView === 'week' ? weekStartDateKey(calendarSelectedDate) : '';
      const weekEnd = weekStart ? shiftDateKey(weekStart, 6) : '';
      let html = ['S','M','T','W','T','F','S'].map(d => `<div class="font-black text-gray-400">${d}</div>`).join('');
      for (let i = 0; i < first.getDay(); i++) html += '<div></div>';
      for (let day = 1; day <= days; day++) {
        const key = `${calendarMonth}-${String(day).padStart(2, '0')}`;
        const isHoliday = !!philippineHolidayForDate(key);
        const isSelected = selectedKeys.has(key);
        const isAnchor = key === calendarSelectedDate;
        const inSelectedWeek = !!weekStart && key >= weekStart && key <= weekEnd;
        const baseClass = isSelected
          ? 'bg-cyan-700 text-white font-black shadow-sm'
          : inSelectedWeek
            ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 font-black'
            : (isHoliday ? 'text-red-700 dark:text-red-300 font-black hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800');
        const todayClass = today === key && !isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900' : '';
        const anchorClass = isAnchor ? 'ring-2 ring-cyan-500 ring-offset-1 dark:ring-offset-gray-900' : '';
        html += `<button type="button" data-mini-calendar-date="${key}" onpointerdown="handleMiniCalendarPointerDown(event, '${key}')" onpointerenter="handleMiniCalendarPointerEnter(event, '${key}')" onpointermove="handleMiniCalendarPointerMove(event)" onpointerup="handleMiniCalendarPointerUp(event, '${key}')" onpointercancel="calendarMiniDragState=null" class="relative rounded-md py-1 select-none touch-none ${baseClass} ${todayClass} ${anchorClass}" title="${esc(fmtDateOnly(key))}">${day}${datesWithEvents.has(key) ? '<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-80"></span>' : ''}</button>`;
      }
      el.innerHTML = html;
    }

    function renderUpcomingCalendarEvents(events = []) {
      const el = document.getElementById('calendarUpcomingList');
      if (!el) return;
      const heading = document.querySelector('#calendarUpcomingSidebar .text-xs.font-black.uppercase');
      if (heading) heading.textContent = 'Upcoming This Month';
      const now = Date.now();
      const agendaEvents = lastCalendarMonthAgendaCache.length ? lastCalendarMonthAgendaCache : events;
      const upcoming = agendaEvents
        .filter(e => calendarEventDateKey(e).slice(0, 7) === calendarMonth)
        .filter(e => new Date(e.start).getTime() >= now || calendarMonth !== new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()).slice(0, 7))
        .sort((a, b) => new Date(a.start) - new Date(b.start) || String(a.title || '').localeCompare(String(b.title || '')));
      el.innerHTML = upcoming.length ? upcoming.map(event => {
        const cancelled = eventIsCancelled(event);
        return `
        <button onclick="openCalendarEventDetail('${esc(event.id)}')" class="w-full text-left p-2 rounded-lg border ${cancelled ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}">
          <div class="text-xs font-bold ${cancelled ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}">${esc(fmtDateOnly(event.start))} - ${esc(calendarEventTimeLabel(event))}</div>
          ${cancelled ? '<div class="mt-1 text-[10px] font-black uppercase text-red-700 dark:text-red-300">Cancelled</div>' : ''}
          <div class="text-sm font-black ${cancelled ? 'text-red-800 dark:text-red-200 line-through' : 'text-gray-900 dark:text-gray-100'} truncate">${esc(event.title)}</div>
        </button>`;
      }).join('') : `<div class="text-sm text-gray-500 dark:text-gray-400 p-2">No upcoming items this month.</div>`;
    }

    async function ensureCalendarPickerData() {
      const tasks = [];
      if (!usersCache.length) tasks.push(fetchJson(`${API}/active-users`, { silentLoading: true }).then(data => usersCache = filterVisibleWorkUsers(data)).catch(() => []));
      if (!projCache.length) tasks.push(fetchJson(`${API}/projects`, { silentLoading: true }).then(data => projCache = data || []).catch(() => []));
      await Promise.all(tasks);
      renderCalendarModalUserSearch();
    }

    function sortedCalendarParticipantUsers() {
      return [...(usersCache || [])].sort(calendarParticipantSuggestionCompare);
    }

    function calendarParticipantLabel(user = {}) {
      return calendarUserDisplayName(user);
    }

    function selectedCalendarParticipantIds() {
      return calendarModalSelectedUsers.map(user => Number(user.id)).filter(Boolean);
    }

    function currentCalendarParticipantUser() {
      return (usersCache || []).find(user => Number(user.id) === Number(currentUser?.id)) || currentUser;
    }

    function calendarModalHasCurrentUser() {
      return selectedCalendarParticipantIds().includes(Number(currentUser?.id));
    }

    function addCurrentUserCalendarParticipant() {
      const me = currentCalendarParticipantUser();
      if (!me?.id || calendarModalHasCurrentUser()) return;
      if (document.getElementById('calendarEventType')?.value === 'personal') calendarModalSelectedUsers = [me];
      else calendarModalSelectedUsers.unshift(me);
    }

    function renderCalendarParticipantSummary() {
      const el = document.getElementById('calendarParticipantSummary');
      if (!el) return;
      const names = calendarModalSelectedUsers.map(user => calendarParticipantLabel(user)).filter(Boolean);
      el.textContent = names.length ? `Participants: ${names.join(', ')}` : 'No participants selected.';
    }

    function calendarParticipantWarningChoice(message, { title, addText, continueText }) {
      return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        const cancelBtn = [...modal.querySelectorAll('button[onclick="closeConfirmModal()"]')].pop();
        const actionBtn = document.getElementById('confirmActionBtn');
        const restore = () => {
          cancelBtn.textContent = 'Cancel';
          cancelBtn.setAttribute('onclick', 'closeConfirmModal()');
          cancelBtn.onclick = closeConfirmModal;
          actionBtn.onclick = () => { if(confirmCallback) confirmCallback(); closeConfirmModal(); };
        };
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmMessage').innerHTML = esc(message);
        confirmCallback = null;
        confirmPromiseResolver = () => { restore(); resolve('cancel'); };
        cancelBtn.textContent = addText;
        actionBtn.textContent = continueText;
        actionBtn.className = "px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium";
        cancelBtn.onclick = () => {
          confirmPromiseResolver = null;
          restore();
          closeModal('confirmModal');
          resolve('add');
        };
        actionBtn.onclick = () => {
          confirmPromiseResolver = null;
          restore();
          closeModal('confirmModal');
          resolve('continue');
        };
        modal.classList.remove('hidden');
      });
    }

    function setCalendarParticipantSelection(ids = []) {
      const selected = new Set(ids.map(Number).filter(Boolean));
      calendarModalSelectedUsers = sortedCalendarParticipantUsers().filter(user => selected.has(Number(user.id)));
      enforceCalendarParticipantLimit();
      renderCalendarModalUserSearch();
    }

    function enforceCalendarParticipantLimit() {
      const isPersonal = document.getElementById('calendarEventType')?.value === 'personal';
      const ids = selectedCalendarParticipantIds();
      if (!isPersonal || ids.length <= 1) return;
      const keep = ids[ids.length - 1];
      calendarModalSelectedUsers = calendarModalSelectedUsers.filter(user => Number(user.id) === Number(keep));
      toast('Personal schedules allow one involved user only.', 'error');
    }

    window.calendarEventTypeChanged = function() {
      enforceCalendarParticipantLimit();
      const type = document.getElementById('calendarEventType')?.value;
      const otherWrap = document.getElementById('calendarEventOtherTypeWrap');
      const otherInput = document.getElementById('calendarEventOtherType');
      const isOther = type === 'other';
      otherWrap?.classList.toggle('hidden', !isOther);
      if (otherInput) {
        otherInput.required = isOther;
        if (!isOther) otherInput.value = '';
      }
      const help = document.getElementById('calendarParticipantHelp');
      if (help) help.textContent = 'Select everyone who should see this schedule in their calendar.';
      renderCalendarModalUserSearch();
    };

    function renderCalendarModalUserSearch() {
      renderCalendarParticipantSummary();
      renderCalendarUserPickerChips({
        targetId: 'calendarModalSelectedUsers',
        clearButtonId: 'calendarModalClearUsersBtn',
        selectedUsers: calendarModalSelectedUsers,
        removeFunction: 'removeCalendarModalParticipant'
      });
      renderCalendarUserPickerResults({
        resultsId: 'calendarModalUserSearchResults',
        inputId: 'calendarModalUserSearchInput',
        selectedUsers: calendarModalSelectedUsers,
        isOpen: calendarModalUserSearchOpen,
        addFunction: 'addCalendarModalParticipant',
        addAllFunction: 'addAllCalendarModalParticipants',
        activeIndex: calendarModalUserSearchActiveIndex,
        allowAll: document.getElementById('calendarEventType')?.value !== 'personal'
      });
    }

    window.openCalendarModalUserSearch = async function() {
      calendarModalUserSearchOpen = true;
      renderCalendarUserPickerResults({
        resultsId: 'calendarModalUserSearchResults',
        inputId: 'calendarModalUserSearchInput',
        selectedUsers: calendarModalSelectedUsers,
        isOpen: true,
        addFunction: 'addCalendarModalParticipant',
        addAllFunction: 'addAllCalendarModalParticipants',
        activeIndex: calendarModalUserSearchActiveIndex,
        loading: !(usersCache || []).length,
        allowAll: document.getElementById('calendarEventType')?.value !== 'personal'
      });
      await ensureCalendarUsers();
      renderCalendarModalUserSearch();
    };

    window.closeCalendarModalUserSearch = function() {
      calendarModalUserSearchOpen = false;
      calendarModalUserSearchActiveIndex = -1;
      renderCalendarModalUserSearch();
    };

    window.debouncedCalendarModalUserSearch = function() {
      clearTimeout(calendarModalUserSearchTimer);
      calendarModalUserSearchTimer = setTimeout(() => {
        calendarModalUserSearchOpen = true;
        calendarModalUserSearchActiveIndex = -1;
        renderCalendarModalUserSearch();
      }, 200);
    };

    window.handleCalendarModalUserSearchKeydown = function(event) {
      handleCalendarUserPickerKeydown(event, {
        resultsId: 'calendarModalUserSearchResults',
        open: () => {
          calendarModalUserSearchOpen = true;
          return true;
        },
        close: closeCalendarModalUserSearch,
        render: renderCalendarModalUserSearch,
        getIndex: () => calendarModalUserSearchActiveIndex,
        setIndex: value => { calendarModalUserSearchActiveIndex = value; }
      });
    };

    window.addCalendarModalParticipant = function(userId) {
      const user = (usersCache || []).find(item => Number(item.id) === Number(userId));
      if (!user || calendarModalSelectedUsers.some(item => Number(item.id) === Number(userId))) return;
      if (document.getElementById('calendarEventType')?.value === 'personal') {
        calendarModalSelectedUsers = [user];
      } else {
        calendarModalSelectedUsers.push(user);
      }
      const input = document.getElementById('calendarModalUserSearchInput');
      if (input) input.value = '';
      calendarModalUserSearchActiveIndex = -1;
      renderCalendarModalUserSearch();
    };

    window.removeCalendarModalParticipant = function(userId) {
      calendarModalSelectedUsers = calendarModalSelectedUsers.filter(user => Number(user.id) !== Number(userId));
      renderCalendarModalUserSearch();
    };

    window.addAllCalendarModalParticipants = function() {
      if (document.getElementById('calendarEventType')?.value === 'personal') {
        return toast('Personal schedules allow one involved user only.', 'error');
      }
      calendarModalSelectedUsers = sortedCalendarParticipantUsers();
      const input = document.getElementById('calendarModalUserSearchInput');
      if (input) input.value = '';
      calendarModalUserSearchOpen = false;
      calendarModalUserSearchActiveIndex = -1;
      renderCalendarModalUserSearch();
    };

    window.clearCalendarModalParticipants = function() {
      calendarModalSelectedUsers = [];
      const input = document.getElementById('calendarModalUserSearchInput');
      if (input) input.value = '';
      calendarModalUserSearchOpen = false;
      calendarModalUserSearchActiveIndex = -1;
      renderCalendarModalUserSearch();
    };

    function toDateTimeLocal(value) {
      if (!value) return '';
      const d = new Date(value);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function defaultCalendarEventEndTime() {
      const end = document.getElementById('calendarEventEnd');
      if (!end || end.value) return;
      const startDate = (document.getElementById('calendarEventStart')?.value || '').slice(0, 10);
      if (startDate) end.value = `${startDate}T17:00`;
    }

    window.openCalendarEventModal = async function(eventId = null, dateKey = null) {
      if (!hasPrivilege('create_calendar_event') && !eventId) return toast('Permission denied: create_calendar_event', 'error');
      await ensureCalendarPickerData();
      const event = eventId ? lastCalendarEventsCache.find(e => e.id === eventId || (e.source === 'manual_event' && String(e.raw_id) === String(eventId))) : null;
      document.getElementById('calendarEventModalTitle').textContent = event ? 'Edit Schedule' : 'Create Schedule';
      document.getElementById('calendarEventId').value = event?.raw_id || '';
      document.getElementById('calendarEventTitle').value = event?.title || '';
      const typeSelect = document.getElementById('calendarEventType');
      const nextType = event?.event_type && [...typeSelect.options].some(opt => opt.value === event.event_type) ? event.event_type : 'meeting';
      typeSelect.value = nextType;
      document.getElementById('calendarEventOtherType').value = nextType === 'other' ? (event?.event_type_detail || '') : '';
      const defaultStart = dateKey ? `${dateKey}T08:00` : `${toDateTimeLocal(new Date()).slice(0, 10)}T08:00`;
      document.getElementById('calendarEventStart').value = event ? toDateTimeLocal(event.start) : defaultStart;
      document.getElementById('calendarEventEnd').value = event?.end ? toDateTimeLocal(event.end) : '';
      document.getElementById('calendarEventLocation').value = event?.location || '';
      document.getElementById('calendarEventDescription').value = event?.description || '';
      const selectedParticipantIds = new Set((event?.participants || []).filter(p => p.role !== 'organizer').map(p => String(p.user_id)));
      document.getElementById('calendarModalUserSearchInput') && (document.getElementById('calendarModalUserSearchInput').value = '');
      calendarModalUserSearchOpen = false;
      calendarModalUserSearchActiveIndex = -1;
      if (!event && currentUser?.id) selectedParticipantIds.add(String(currentUser.id));
      setCalendarParticipantSelection([...selectedParticipantIds].map(Number));
      [...document.getElementById('calendarEventReminders').options].forEach(opt => opt.selected = false);
      calendarEventTypeChanged();
      document.getElementById('calendarEventModal').classList.remove('hidden');
    };

    window.saveCalendarEvent = async function({ skipParticipantWarnings = false } = {}) {
      const eventId = document.getElementById('calendarEventId').value;
      const title = document.getElementById('calendarEventTitle').value.trim();
      const start = document.getElementById('calendarEventStart').value;
      const eventType = document.getElementById('calendarEventType').value;
      const eventTypeDetail = document.getElementById('calendarEventOtherType').value.trim();
      if (!title || !start) return toast('Title and start date are required', 'error');
      if (eventType === 'other' && !eventTypeDetail) return toast('Please specify the schedule type for Others.', 'error');
      const body = {
        title,
        event_type: eventType,
        event_type_detail: eventType === 'other' ? eventTypeDetail : '',
        all_day: false,
        start_datetime: start,
        end_datetime: document.getElementById('calendarEventEnd').value || null,
        location: document.getElementById('calendarEventLocation').value,
        description: document.getElementById('calendarEventDescription').value,
        participant_user_ids: selectedCalendarParticipantIds(),
        reminder_minutes: [...document.getElementById('calendarEventReminders').selectedOptions].map(o => Number(o.value))
      };
      if (body.event_type === 'personal' && body.participant_user_ids.length > 1) {
        return toast('Personal schedules allow one involved user only.', 'error');
      }
      if (!skipParticipantWarnings && !body.participant_user_ids.length) {
        openConfirmModal('No participants selected. Add at least one participant before saving.', null, {
          title: 'No Participants Selected',
          confirmText: 'OK',
          confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
        });
        return;
      }
      if (!skipParticipantWarnings && !body.participant_user_ids.includes(Number(currentUser?.id))) {
        const choice = await calendarParticipantWarningChoice(
          'You are not included as a participant in this schedule. You will still be the creator, but this schedule may not appear in your participant schedule list. Continue?',
          { title: 'Creator Not Included', addText: 'Add Me', continueText: 'Continue Without Me' }
        );
        if (choice === 'add') {
          addCurrentUserCalendarParticipant();
          renderCalendarModalUserSearch();
          return saveCalendarEvent({ skipParticipantWarnings: true });
        }
        if (choice !== 'continue') return;
      }
      if (!skipParticipantWarnings) {
        const participantPreview = calendarModalSelectedUsers.map(user => `
          <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 px-1.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-100">
            ${renderUserAvatar(user, 20, 'text-[10px]')}
            <span class="truncate">${esc(calendarParticipantLabel(user))}</span>
          </span>
        `).join('');
        const confirmed = await confirmModalChoice(
          `<div class="space-y-3 text-sm"><div class="font-bold text-gray-900 dark:text-gray-100">Confirm selected participants before saving.</div><div class="flex flex-wrap gap-1.5">${participantPreview || '<span class="text-gray-500 dark:text-gray-400">No participants selected.</span>'}</div></div>`,
          { title: 'Confirm Participants', confirmText: 'Save Schedule', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
        );
        if (!confirmed) return;
      }
      try {
        await fetchJson(eventId ? `${API}/calendar/events/${eventId}` : `${API}/calendar/events`, {
          method: eventId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        usersCache = [];
        if (typeof monitoringUsersCache !== 'undefined') monitoringUsersCache = [];
        closeModal('calendarEventModal');
        toast(eventId ? 'Schedule updated' : 'Schedule created');
        await loadCalendarView({ silent: true });
        await loadNotifications();
      } catch (e) {
        toast(e.message || 'Failed to save schedule', 'error');
      }
    };

    window.openManualCalendarEventById = async function(rawId) {
      try {
        const data = await fetchJson(`${API}/calendar/events/${Number(rawId)}`, { silentLoading: true });
        if (!data?.event) return toast('Schedule not found or no longer available.', 'error');
        renderCalendarEventDetail(data.event);
      } catch (e) {
        toast('Schedule not found or no longer available.', 'error');
      }
    };

    function calendarTargetStage(event) {
      return event.document_stage || event.project_stage || 'Proposal';
    }

    function calendarDocumentationLabel(eventType = 'general') {
      const key = String(eventType || 'general');
      if (key === 'meeting') return { title: 'Meeting Minutes', noteType: 'meeting_minutes', write: 'Write Minutes', upload: 'Upload Documents', attachmentType: 'meeting_document' };
      if (key === 'site_inspection') return { title: 'Site Inspection Notes', noteType: 'inspection_notes', write: 'Write Notes', upload: 'Upload Report / Photos', attachmentType: 'inspection_report' };
      if (key === 'site_survey') return { title: 'Site Survey Notes', noteType: 'inspection_notes', write: 'Write Notes', upload: 'Upload Survey File / Photos', attachmentType: 'inspection_report' };
      if (key === 'site_validation') return { title: 'Site Validation Notes', noteType: 'inspection_notes', write: 'Write Notes', upload: 'Upload Validation File / Photos', attachmentType: 'inspection_report' };
      if (key === 'site_geotagging') return { title: 'Site Geotagging Notes', noteType: 'geotagging_notes', write: 'Write Notes', upload: 'Upload Documents', attachmentType: 'geotagging_document' };
      if (key === 'training') return { title: 'Training Notes', noteType: 'training_notes', write: 'Write Notes', upload: 'Upload Report / Attendance', attachmentType: 'training_report' };
      if (key === 'workshop') return { title: 'Workshop Notes', noteType: 'training_notes', write: 'Write Notes', upload: 'Upload Report / Attendance', attachmentType: 'training_report' };
      if (key === 'orientation') return { title: 'Orientation Notes', noteType: 'training_notes', write: 'Write Notes', upload: 'Upload Report / Attendance', attachmentType: 'training_report' };
      if (key === 'monitoring') return { title: 'Monitoring Notes', noteType: 'maintenance_notes', write: 'Write Notes', upload: 'Upload Monitoring File / Photos', attachmentType: 'supporting_file' };
      if (key === 'procurement') return { title: 'Procurement Notes', noteType: 'procurement_notes', write: 'Write Notes', upload: 'Upload Document', attachmentType: 'procurement_document' };
      if (key === 'document_follow_up') return { title: 'Follow-up Notes', noteType: 'followup_notes', write: 'Write Notes', upload: 'Upload File', attachmentType: 'supporting_file' };
      if (key === 'project_milestone') return { title: 'Project Milestone Notes', noteType: 'milestone_notes', write: 'Write Notes', upload: 'Upload File', attachmentType: 'supporting_file' };
      if (key === 'maintenance') return { title: 'Maintenance Notes', noteType: 'maintenance_notes', write: 'Write Notes', upload: 'Upload Report', attachmentType: 'supporting_file' };
      if (key === 'personal') return { title: 'Personal Notes', noteType: 'general_notes', write: 'Write Notes', upload: 'Upload File', attachmentType: 'supporting_file' };
      return { title: 'Documentation / Notes', noteType: 'general_notes', write: 'Write Notes', upload: 'Upload File', attachmentType: 'supporting_file' };
    }

    function calendarResponseStatusLabel(status) {
      if (status === 'accepted') return 'Accepted';
      if (status === 'had_prior_schedule') return 'Had Prior Schedule';
      return 'Pending';
    }

    function calendarParticipantResponseClass(status) {
      const key = String(status || 'pending').toLowerCase();
      if (key === 'accepted') return 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800';
      if (key === 'had_prior_schedule') return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800';
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
    }

    function calendarVisibilityLabel(value) {
      const key = String(value || 'personal').toLowerCase();
      if (key === 'abed_wide' || key === 'division' || key === 'global') return 'ABE Calendar';
      if (key === 'participants') return 'Participants Only';
      return 'Personal';
    }

    function calendarResponseButtons(eventId) {
      return `<div class="flex flex-wrap gap-2">
        <button onclick="respondCalendarEvent(${Number(eventId)}, 'accepted')" class="px-3 py-2 rounded-lg bg-green-600 text-white font-bold">Accept</button>
        <button onclick="respondCalendarEvent(${Number(eventId)}, 'had_prior_schedule')" class="px-3 py-2 rounded-lg bg-blue-600 text-white font-bold">Had Prior Schedule</button>
      </div>`;
    }

    function renderCalendarResponseBlock(full, changing = false) {
      if (!full || full.source !== 'manual_event') return '';
      const isCreator = Number(full.created_by_user_id) === Number(currentUser?.id) || full.is_creator;
      if (isCreator) return '';
      const status = String(full.response_status || 'pending').toLowerCase();
      if (full.has_passed) return `<div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm font-semibold text-gray-600 dark:text-gray-300">This schedule has already passed.</div>`;
      const isParticipant = (full.participants || []).some(p => Number(p.user_id) === Number(currentUser?.id));
      if (!isParticipant) return '';
      if (full.can_respond && (changing || status === 'pending' || !status)) return `<div id="calendarResponseBlock" class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-2"><div class="text-sm font-black text-gray-900 dark:text-gray-100">Your response</div>${calendarResponseButtons(full.raw_id)}</div>`;
      if (status === 'pending' || !status) return '';
      const message = status === 'accepted'
        ? 'You accepted this schedule.'
        : status === 'had_prior_schedule'
          ? 'You had a prior schedule for this invitation.'
          : 'Your response is pending.';
      return `<div id="calendarResponseBlock" class="p-3 rounded-lg ${calendarParticipantResponseClass(status)} flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-black">Your response: ${esc(calendarResponseStatusLabel(status))}</div>
        <div class="text-xs font-semibold opacity-80">${esc(message)}</div>
      </div>`;
    }

    window.showCalendarResponseChoices = function() {
      const el = document.getElementById('calendarResponseBlock');
      if (el && currentCalendarDetailEvent) el.outerHTML = renderCalendarResponseBlock(currentCalendarDetailEvent, true);
    };

    function pendingDueRollupCard(item = {}) {
      const isProject = item.kind === 'project';
      const projectId = Number(item.project_id || item.id || 0);
      const documentId = isProject ? null : Number(item.document_id || item.id || 0);
      const stage = item.stage || item.project_stage || 'Proposal';
      const targetKind = item.target_kind || (isProject ? 'project_due_date' : 'document');
      const status = item.status || (isProject ? 'Active' : 'Pending');
      const overdueText = Number.isFinite(Number(item.days_overdue))
        ? `${Number(item.days_overdue)} day${Number(item.days_overdue) === 1 ? '' : 's'} overdue`
        : '';
      const openButton = projectId ? `<button onclick="closeModal('calendarEventDetailModal'); goToTarget({ project_id:${projectId}, document_id:${documentId ? documentId : 'null'}, stage:'${esc(stage)}', target_kind:'${esc(targetKind)}', target_type:'${isProject ? 'project' : 'document'}' })" class="mt-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-200">${isProject ? 'Open Project' : 'Open Document'}</button>` : '';
      return `<div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div class="min-w-0">
            <div class="font-black text-gray-900 dark:text-gray-100">${esc(item.project_name || 'Untitled Project')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Requester: ${esc(item.requester || '-')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">${isProject ? 'Due type' : 'Document'}: ${esc(item.due_type || item.document_type_name || '-')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Assigned to: ${esc(item.assigned_username || 'Unassigned')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Status: ${esc(status)}</div>
          </div>
          <div class="shrink-0 text-left sm:text-right">
            <div class="text-sm font-black text-red-700 dark:text-red-300">${esc(fmtDueDate(item.original_due_date || item.due_date))}</div>
            ${overdueText ? `<div class="text-xs font-bold text-red-600 dark:text-red-300">${esc(overdueText)}</div>` : ''}
          </div>
        </div>
        ${openButton}
      </div>`;
    }

    function renderPendingDueRollupDetail(full) {
      currentCalendarDetailEvent = full;
      const items = full.pending_items || [];
      document.getElementById('calendarEventDetailTitle').textContent = full.title || `${items.length} Pending Due${items.length === 1 ? '' : 's'}`;
      document.getElementById('calendarEventDetailWhen').textContent = `Carried over to ${fmtDateOnly(full.start)}`;
      document.getElementById('calendarEventDetailBody').innerHTML = `
        <div class="inline-flex px-2 py-1 rounded-full text-xs font-black text-white bg-red-600">Pending Dues</div>
        ${full.description ? `<div class="text-sm text-gray-600 dark:text-gray-300">${esc(full.description)}</div>` : ''}
        <div class="space-y-2">${items.length ? items.map(pendingDueRollupCard).join('') : '<div class="text-sm text-gray-500 dark:text-gray-400">No carried-over pending dues found.</div>'}</div>`;
      document.getElementById('calendarEventDetailActions').innerHTML = `
        <button onclick="closeModal('calendarEventDetailModal')" class="px-3 py-2 rounded-lg bg-gray-800 text-white font-bold">Close</button>`;
      document.getElementById('calendarEventDetailModal').classList.remove('hidden');
    }

    function renderCalendarEventDetail(full) {
      if (full?.source === 'pending_due_rollup') {
        renderPendingDueRollupDetail(full);
        return;
      }
      currentCalendarDetailEvent = full;
      document.getElementById('calendarEventDetailTitle').textContent = full.title;
      document.getElementById('calendarEventDetailWhen').textContent = calendarEventDateRangeLabel(full);
      const participantChips = (full.participants || [])
        .filter(p => String(p.role || '').toLowerCase() !== 'organizer')
        .map(p => {
          const isCreatorParticipant = Number(p.user_id) === Number(full.created_by_user_id);
          if (isCreatorParticipant) {
            return `<span class="px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">${esc(p.username)} - Creator</span>`;
          }
          const status = String(p.response_status || 'pending').toLowerCase();
          return `<span class="px-2 py-1 rounded-full text-xs font-bold ${calendarParticipantResponseClass(status)}">${esc(p.username)} - ${esc(calendarResponseStatusLabel(status))}</span>`;
        })
        .join('');
      document.getElementById('calendarEventDetailBody').innerHTML = `
        <div class="inline-flex px-2 py-1 rounded-full text-xs font-black text-white" style="background:${esc(full.color || '#2563eb')}">${esc(calendarEventTypeLabel(full))}</div>
        ${full.status && full.status !== 'active' ? `<div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm font-bold text-red-700 dark:text-red-200">Status: ${esc(full.status)}</div>` : ''}
        ${renderCalendarResponseBlock(full)}
        <div class="text-sm"><span class="font-bold text-gray-700 dark:text-gray-200">Duration:</span> ${esc(calendarEventDurationLabel(full))}</div>
        ${full.location ? `<div class="text-sm"><span class="font-bold text-gray-700 dark:text-gray-200">Location:</span> ${esc(full.location)}</div>` : ''}
        ${full.description ? `<div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${esc(full.description)}</div>` : ''}
        ${full.owner_username ? `<div class="text-sm"><span class="font-bold text-gray-700 dark:text-gray-200">Organizer / Created by:</span> ${esc(full.owner_username)}</div>` : ''}
        ${full.project_name ? `<div class="text-sm"><span class="font-bold text-gray-700 dark:text-gray-200">Project:</span> ${esc(full.project_name)}</div>` : ''}
        ${full.document_name ? `<div class="text-sm"><span class="font-bold text-gray-700 dark:text-gray-200">Document:</span> ${esc(full.document_name)}</div>` : ''}
        ${full.source === 'manual_event' ? `<div><div class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Participants</div><div class="flex flex-wrap gap-1">${participantChips || '<span class="text-sm text-gray-500">No participants</span>'}</div></div><div id="calendarDocumentationSection" class="pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">Loading documentation...</div>` : ''}`;
      const stage = calendarTargetStage(full);
      const canCancelSchedule = full.status !== 'cancelled' && full.source === 'manual_event' && full.can_cancel;
      const canDeleteSchedule = full.source === 'manual_event' && full.can_delete;
      document.getElementById('calendarEventDetailActions').innerHTML = `
        ${full.can_edit ? `<button onclick="closeModal('calendarEventDetailModal'); openCalendarEventModal('${esc(full.id)}')" class="px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold">Edit</button>` : ''}
        ${canCancelSchedule ? `<button onclick="cancelCalendarEvent(${Number(full.raw_id)})" class="px-3 py-2 rounded-lg bg-amber-600 text-white font-bold">Cancel Schedule</button>` : ''}
        ${canDeleteSchedule ? `<button onclick="deleteCalendarEvent(${Number(full.raw_id)})" class="px-3 py-2 rounded-lg bg-red-700 text-white font-bold">Delete Schedule</button>` : ''}
        ${full.project_id ? `<button onclick="closeModal('calendarEventDetailModal'); goToTarget({ project_id:${Number(full.project_id)}, document_id:${full.document_id ? Number(full.document_id) : 'null'}, stage:'${esc(stage)}', target_kind:'${full.document_id ? 'document' : 'project'}', target_type:'${full.document_id ? 'document' : 'project'}' })" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold text-gray-700 dark:text-gray-200">${full.document_id ? 'Open Document' : 'Open Project'}</button>` : ''}
        <button onclick="closeModal('calendarEventDetailModal')" class="px-3 py-2 rounded-lg bg-gray-800 text-white font-bold">Close</button>`;
      document.getElementById('calendarEventDetailModal').classList.remove('hidden');
      if (full.source === 'manual_event') loadCalendarDocumentation(full.raw_id, full.event_type);
    }

    window.openCalendarEventDetail = async function(id) {
      const event = lastCalendarEventsCache.find(e => e.id === id);
      if (!event) return toast('Schedule not found or no longer available.', 'error');
      if (event.source !== 'manual_event') {
        renderCalendarEventDetail(event);
        return;
      }
      try {
        const direct = await fetchJson(`${API}/calendar/events/${event.raw_id}`, { silentLoading: true });
        renderCalendarEventDetail(direct.event || event);
      } catch (e) {
        toast('Schedule not found or no longer available.', 'error');
      }
    };
    async function loadCalendarDocumentation(eventId, eventType) {
      const el = document.getElementById('calendarDocumentationSection');
      if (!el) return;
      try {
        const [notesData, attachmentData] = await Promise.all([
          fetchJson(`${API}/calendar/events/${Number(eventId)}/notes`, { silentLoading: true }),
          fetchJson(`${API}/calendar/events/${Number(eventId)}/attachments`, { silentLoading: true })
        ]);
        renderCalendarDocumentation(eventId, eventType, notesData.notes || [], attachmentData.attachments || [], notesData.can_add || attachmentData.can_add);
      } catch (e) {
        el.innerHTML = `<div class="text-sm text-red-600 dark:text-red-300">Documentation is not available.</div>`;
      }
    }

    function renderCalendarDocumentation(eventId, eventType, notes = [], attachments = [], canAdd = false) {
      const el = document.getElementById('calendarDocumentationSection');
      if (!el) return;
      const labels = calendarDocumentationLabel(eventType);
      const noteCards = notes.map(note => {
        const canModify = currentCalendarDetailEvent?.can_edit || Number(note.created_by_user_id) === Number(currentUser?.id);
        const final = Number(note.is_final || 0) === 1;
        const actionButtons = final
          ? `<button onclick="viewCalendarNote(${Number(eventId)}, ${Number(note.id)})" class="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">View</button>`
          : `${canModify ? `<button onclick="openCalendarNoteModal(${Number(eventId)}, ${Number(note.id)})" class="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">Edit</button>` : ''}
            ${currentCalendarDetailEvent?.can_edit ? `<button onclick="finalizeCalendarNote(${Number(eventId)}, ${Number(note.id)})" class="px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold">Finalize</button>` : ''}
            ${canModify ? `<button onclick="deleteCalendarNote(${Number(eventId)}, ${Number(note.id)})" class="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">Delete</button>` : ''}`;
        return `<div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-black text-gray-900 dark:text-gray-100">${esc(note.title || labels.title)}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${final ? 'Finalized' : 'Draft'}${note.created_by_username ? ` - Prepared by ${esc(note.created_by_username)}` : ''}${note.updated_at ? ` - Updated ${esc(fmtDateTime(note.updated_at))}` : ''}</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${final ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-200' : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200'}">${final ? 'Finalized' : 'Draft'}</span>
          </div>
          ${note.content ? `<div class="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">${esc(note.content)}</div>` : ''}
          <div class="mt-3 flex flex-wrap gap-2">
            ${actionButtons}
          </div>
        </div>`;
      }).join('');
      const attachmentCards = attachments.map(file => {
        const canModify = currentCalendarDetailEvent?.can_edit || Number(file.uploaded_by_user_id) === Number(currentUser?.id);
        return `<div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div class="min-w-0">
            <div class="font-bold text-gray-900 dark:text-gray-100 truncate">${esc(file.original_name || file.file_name)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${esc(file.attachment_type || 'supporting_file')}${file.uploaded_by_username ? ` - ${esc(file.uploaded_by_username)}` : ''}${file.uploaded_at ? ` - ${esc(fmtDateTime(file.uploaded_at))}` : ''}</div>
          </div>
          <div class="flex gap-1 flex-none">
            <button onclick="viewCalendarAttachment(${Number(eventId)}, ${Number(file.id)})" class="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">View</button>
            ${canModify ? `<button onclick="deleteCalendarAttachment(${Number(eventId)}, ${Number(file.id)})" class="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">Delete</button>` : ''}
          </div>
        </div>`;
      }).join('');
      el.innerHTML = `
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-black text-gray-900 dark:text-gray-100">${esc(labels.title)}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Review past schedules, minutes, notes, and uploaded documentation.</div>
            </div>
            ${canAdd ? `<div class="flex flex-wrap gap-2"><button onclick="openCalendarNoteModal(${Number(eventId)})" class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">${esc(labels.write)}</button><button onclick="uploadCalendarAttachment(${Number(eventId)})" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">${esc(labels.upload)}</button></div>` : ''}
          </div>
          <div class="space-y-2">${noteCards || `<div class="text-sm text-gray-500 dark:text-gray-400">No written notes yet.</div>`}</div>
          <div>
            <div class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Attachments</div>
            <div class="space-y-2">${attachmentCards || `<div class="text-sm text-gray-500 dark:text-gray-400">No attachments yet.</div>`}</div>
          </div>
        </div>`;
    }

    window.openCalendarNoteModal = async function(eventId, noteId = null) {
      const labels = calendarDocumentationLabel(currentCalendarDetailEvent?.event_type);
      document.getElementById('calendarNoteEventId').value = Number(eventId);
      document.getElementById('calendarNoteId').value = noteId ? Number(noteId) : '';
      document.getElementById('calendarNoteType').value = labels.noteType;
      document.getElementById('calendarNoteModalTitle').textContent = labels.title;
      document.getElementById('calendarNoteModalSubtitle').textContent = currentCalendarDetailEvent?.title || '';
      document.getElementById('calendarNoteTitle').value = '';
      document.getElementById('calendarNoteContent').value = '';
      if (noteId) {
        const data = await fetchJson(`${API}/calendar/events/${Number(eventId)}/notes`, { silentLoading: true });
        const note = (data.notes || []).find(n => Number(n.id) === Number(noteId));
        if (note) {
          document.getElementById('calendarNoteTitle').value = note.title || '';
          document.getElementById('calendarNoteContent').value = note.content || '';
        }
      }
      document.getElementById('calendarNoteModal').classList.remove('hidden');
    };

    window.saveCalendarNote = async function() {
      const eventId = Number(document.getElementById('calendarNoteEventId').value);
      const noteId = document.getElementById('calendarNoteId').value;
      const body = {
        note_type: document.getElementById('calendarNoteType').value,
        title: document.getElementById('calendarNoteTitle').value.trim(),
        content: document.getElementById('calendarNoteContent').value.trim()
      };
      if (!body.title && !body.content) return toast('Add a title or note content first.', 'error');
      await fetchJson(noteId ? `${API}/calendar/events/${eventId}/notes/${Number(noteId)}` : `${API}/calendar/events/${eventId}/notes`, {
        method: noteId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      closeModal('calendarNoteModal');
      toast('Schedule documentation saved');
      await loadCalendarDocumentation(eventId, currentCalendarDetailEvent?.event_type);
      await loadCalendarView({ silent: true });
    };

    window.finalizeCalendarNote = async function(eventId, noteId) {
      openConfirmModal(`<div class="space-y-1 text-sm">
        <div class="font-bold text-gray-900 dark:text-gray-100">Finalize this note?</div>
        <div>Finalized notes become read-only and can only be viewed or downloaded.</div>
      </div>`, async () => {
        try {
          await fetchJson(`${API}/calendar/events/${Number(eventId)}/notes/${Number(noteId)}/finalize`, { method: 'POST' });
          toast('Documentation finalized');
          await loadCalendarDocumentation(eventId, currentCalendarDetailEvent?.event_type);
        } catch (e) {
          toast(e.message || 'Failed to finalize documentation', 'error');
        }
      });
      document.getElementById('confirmActionBtn').textContent = 'Finalize';
      document.getElementById('confirmActionBtn').className = 'px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium';
    };

    window.deleteCalendarNote = async function(eventId, noteId) {
      openConfirmModal(`<div class="space-y-1 text-sm">
        <div class="font-bold text-gray-900 dark:text-gray-100">Delete this schedule note?</div>
        <div>This will remove the written note from this schedule.</div>
      </div>`, async () => {
        await fetchJson(`${API}/calendar/events/${Number(eventId)}/notes/${Number(noteId)}`, { method: 'DELETE' });
        toast('Schedule note deleted');
        await loadCalendarDocumentation(eventId, currentCalendarDetailEvent?.event_type);
        await loadCalendarView({ silent: true });
      });
      document.getElementById('confirmActionBtn').textContent = 'Delete';
    };

    window.viewCalendarNote = async function(eventId, noteId) {
      const data = await fetchJson(`${API}/calendar/events/${Number(eventId)}/notes`, { silentLoading: true });
      const note = (data.notes || []).find(n => Number(n.id) === Number(noteId));
      if (!note) return toast('Schedule note not found.', 'error');
      const title = note.title || calendarDocumentationLabel(currentCalendarDetailEvent?.event_type).title;
      document.getElementById('calendarNoteViewTitle').textContent = title;
      document.getElementById('calendarNoteViewSubtitle').textContent = currentCalendarDetailEvent?.title || '';
      document.getElementById('calendarNoteViewBody').innerHTML = `
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            ${currentCalendarDetailEvent?.title ? `<span><strong>Schedule:</strong> ${esc(currentCalendarDetailEvent.title)}</span>` : ''}
            ${note.created_by_username ? `<span><strong>Created by:</strong> ${esc(note.created_by_username)}</span>` : ''}
            ${note.finalized_by_username ? `<span><strong>Finalized by:</strong> ${esc(note.finalized_by_username)}</span>` : ''}
            ${note.finalized_at ? `<span><strong>Finalized:</strong> ${esc(fmtDateTime(note.finalized_at))}</span>` : ''}
          </div>
          <div class="text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">${esc(note.content || '')}</div>
        </div>`;
      document.getElementById('calendarNoteViewDownload').href = `${API}/calendar/events/${Number(eventId)}/notes/${Number(noteId)}/download?token=${encodeURIComponent(authToken || '')}`;
      document.getElementById('calendarNoteViewModal').classList.remove('hidden');
    };

    function calendarFileExtension(file = {}) {
      const name = String(file.original_name || file.file_name || '').toLowerCase();
      const dot = name.lastIndexOf('.');
      return dot >= 0 ? name.slice(dot) : String(file.file_ext || '').toLowerCase();
    }

    function calendarAttachmentUrl(eventId, attachmentId, action = 'view') {
      return `${API}/calendar/events/${Number(eventId)}/attachments/${Number(attachmentId)}/${action}?token=${encodeURIComponent(authToken || '')}`;
    }

    window.viewCalendarAttachment = async function(eventId, attachmentId) {
      const data = await fetchJson(`${API}/calendar/events/${Number(eventId)}/attachments`, { silentLoading: true });
      const file = (data.attachments || []).find(f => Number(f.id) === Number(attachmentId));
      if (!file) return toast('Schedule attachment not found.', 'error');
      const canEdit = currentCalendarDetailEvent?.can_edit || Number(file.uploaded_by_user_id) === Number(currentUser?.id);
      const ext = calendarFileExtension(file);
      const viewUrl = calendarAttachmentUrl(eventId, attachmentId, 'view');
      const downloadUrl = calendarAttachmentUrl(eventId, attachmentId, 'download');
      window.currentCalendarAttachmentViewer = { eventId: Number(eventId), attachmentId: Number(attachmentId), file, ext, canEdit, dirty: false };
      document.getElementById('calendarAttachmentViewTitle').textContent = file.original_name || file.file_name || 'Schedule Document';
      document.getElementById('calendarAttachmentViewMeta').textContent = [file.uploaded_by_username ? `Uploaded by ${file.uploaded_by_username}` : '', file.uploaded_at ? fmtDateTime(file.uploaded_at) : '', file.file_size ? `${Math.ceil(Number(file.file_size) / 1024)} KB` : ''].filter(Boolean).join(' - ');
      document.getElementById('calendarAttachmentDownload').href = downloadUrl;
      document.getElementById('calendarAttachmentSaveBtn').classList.add('hidden');
      const body = document.getElementById('calendarAttachmentViewBody');
      if (['.pdf'].includes(ext)) {
        body.innerHTML = `<iframe src="${viewUrl}" class="w-full min-h-[65vh] bg-white rounded-lg border border-gray-200 dark:border-gray-700"></iframe>`;
      } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        body.innerHTML = `<div class="min-h-[55vh] flex items-center justify-center"><img src="${viewUrl}" alt="${esc(file.original_name || 'Attachment')}" class="max-w-full max-h-[72vh] rounded-lg shadow bg-white"></div>`;
      } else if (['.txt', '.csv'].includes(ext)) {
        const response = await fetch(viewUrl, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
        if (!response.ok) throw new Error('Unable to load attachment preview');
        const text = await response.text();
        body.innerHTML = `<textarea id="calendarAttachmentTextEditor" ${canEdit ? '' : 'readonly'} class="w-full min-h-[60vh] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 font-mono text-sm">${esc(text)}</textarea>`;
        if (canEdit) {
          const editor = document.getElementById('calendarAttachmentTextEditor');
          editor.addEventListener('input', () => {
            window.currentCalendarAttachmentViewer.dirty = true;
            document.getElementById('calendarAttachmentSaveBtn').classList.remove('hidden');
          });
        }
      } else {
        body.innerHTML = `<div class="min-h-[55vh] flex items-center justify-center text-center p-8">
          <div class="max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
            <div class="text-lg font-black text-gray-900 dark:text-gray-100 mb-2">Preview unavailable</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Office document preview/editing requires an installed document editor service.</div>
          </div>
        </div>`;
      }
      document.getElementById('calendarAttachmentViewModal').classList.remove('hidden');
    };

    window.saveCalendarAttachmentContent = async function() {
      const state = window.currentCalendarAttachmentViewer;
      const editor = document.getElementById('calendarAttachmentTextEditor');
      if (!state || !editor || !state.dirty) return;
      await fetchJson(`${API}/calendar/events/${state.eventId}/attachments/${state.attachmentId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.value })
      });
      state.dirty = false;
      document.getElementById('calendarAttachmentSaveBtn').classList.add('hidden');
      toast('Attachment saved');
    };

    window.toggleCalendarAttachmentFullView = function() {
      const shell = document.getElementById('calendarAttachmentViewShell');
      shell.classList.toggle('sm:max-w-5xl');
      shell.classList.toggle('sm:max-w-[96vw]');
      shell.classList.toggle('h-[96vh]');
    };

    window.closeCalendarAttachmentViewer = async function() {
      if (window.currentCalendarAttachmentViewer?.dirty) {
        const confirmed = await confirmModalChoice('Discard unsaved attachment changes?', { confirmText: 'Discard' });
        if (!confirmed) return;
      }
      window.currentCalendarAttachmentViewer = null;
      document.getElementById('calendarAttachmentViewModal').classList.add('hidden');
      document.getElementById('calendarAttachmentViewShell').classList.add('sm:max-w-5xl');
      document.getElementById('calendarAttachmentViewShell').classList.remove('sm:max-w-[96vw]', 'h-[96vh]');
    };

    function ensureCalendarAttachmentUploadModal() {
      if (document.getElementById('calendarAttachmentUploadModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="calendarAttachmentUploadModal" class="fixed inset-0 bg-black/50 hidden z-[90] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
              <div><h3 class="text-lg font-black text-gray-950 dark:text-gray-50">Upload File</h3><p id="calendarAttachmentUploadSubtitle" class="mt-1 text-sm text-gray-500 dark:text-gray-400"></p></div>
              <button type="button" onclick="closeModal('calendarAttachmentUploadModal')" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
              <input id="calendarAttachmentUploadEventId" type="hidden">
              ${fileDropZoneHtml({ zoneId: 'calendarAttachmentUploadDropZone', inputId: 'calendarAttachmentUploadFile', labelId: 'calendarAttachmentUploadFileLabel', title: 'Drag and drop file here, or click to browse', help: 'PDF, images, Office files, TXT, or CSV.', accept: '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv' })}
            </div>
            <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" onclick="closeModal('calendarAttachmentUploadModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
              <button type="button" onclick="submitCalendarAttachmentUpload()" class="px-4 py-2 rounded-lg bg-cyan-700 text-white font-bold hover:bg-cyan-800">Upload File</button>
            </div>
          </div>
        </div>`);
      setupGenericFileDropZone({ zoneId: 'calendarAttachmentUploadDropZone', inputId: 'calendarAttachmentUploadFile', labelId: 'calendarAttachmentUploadFileLabel', emptyText: 'PDF, images, Office files, TXT, or CSV.' });
    }

    window.uploadCalendarAttachment = function(eventId) {
      ensureCalendarAttachmentUploadModal();
      document.getElementById('calendarAttachmentUploadEventId').value = Number(eventId);
      document.getElementById('calendarAttachmentUploadFile').value = '';
      document.getElementById('calendarAttachmentUploadFileLabel').textContent = 'PDF, images, Office files, TXT, or CSV.';
      document.getElementById('calendarAttachmentUploadSubtitle').textContent = calendarDocumentationLabel(currentCalendarDetailEvent?.event_type).upload;
      document.getElementById('calendarAttachmentUploadModal').classList.remove('hidden');
    };

    window.submitCalendarAttachmentUpload = async function() {
      const eventId = Number(document.getElementById('calendarAttachmentUploadEventId')?.value || 0);
      const file = document.getElementById('calendarAttachmentUploadFile')?.files?.[0];
      if (!eventId || !file) return toast('Choose a file to upload.', 'error');
      const labels = calendarDocumentationLabel(currentCalendarDetailEvent?.event_type);
      const form = new FormData();
      form.append('file', file);
      form.append('attachment_type', labels.attachmentType);
      await fetchJson(`${API}/calendar/events/${eventId}/attachments`, { method: 'POST', body: form });
      closeModal('calendarAttachmentUploadModal');
      toast('Attachment uploaded');
      await loadCalendarDocumentation(eventId, currentCalendarDetailEvent?.event_type);
      await loadCalendarView({ silent: true });
    };

    window.deleteCalendarAttachment = async function(eventId, attachmentId) {
      openConfirmModal(`<div class="space-y-1 text-sm">
        <div class="font-bold text-gray-900 dark:text-gray-100">Delete this uploaded file?</div>
        <div>This will remove the file from this schedule.</div>
      </div>`, async () => {
        const result = await fetchJson(`${API}/calendar/events/${Number(eventId)}/attachments/${Number(attachmentId)}`, { method: 'DELETE' });
        if (result?.pending_approval) {
          toast(result.existing ? 'A deletion request is already pending.' : 'Deletion request sent for owner confirmation.');
          await loadNotifications(notificationsLimit);
          return;
        }
        toast('Attachment deleted');
        await loadCalendarDocumentation(eventId, currentCalendarDetailEvent?.event_type);
        await loadCalendarView({ silent: true });
      });
      document.getElementById('confirmActionBtn').textContent = 'Delete';
    };

    window.respondCalendarEvent = async function(id, status) {
      const result = await fetchJson(`${API}/calendar/events/${id}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_status: status }) });
      const responseLabel = calendarResponseStatusLabel(result.response_status || status);
      toast(`Schedule response saved: ${responseLabel}.`);
      if (currentCalendarDetailEvent) currentCalendarDetailEvent.response_status = result.response_status || status;
      await openManualCalendarEventById(id);
      await loadCalendarView({ silent: true });
      myScheduleAssignmentsCache = await fetchJson(`${API}/calendar/my-schedules`, { silentLoading: true }).then(data => data.schedules || []).catch(() => myScheduleAssignmentsCache);
      myDashboardSchedulesCache = await fetchJson(`${API}/dashboard/my-schedules`, { silentLoading: true }).then(data => data.schedules || []).catch(() => myDashboardSchedulesCache);
      updateMyScheduleBadge();
      if (['my', 'schedule'].includes(activeWorkPanel)) renderOwnershipWorkPanel();
      await loadNotifications();
    };

    window.cancelCalendarEvent = async function(id) {
      openConfirmModal(
        '<div class="space-y-2 text-sm"><p>Cancel this schedule?</p><p class="text-gray-500 dark:text-gray-400">The schedule record will remain visible with a cancelled status.</p></div>',
        async () => {
          await fetchJson(`${API}/calendar/events/${id}`, { method: 'DELETE' });
          toast('Schedule cancelled');
          closeModal('calendarEventDetailModal');
          await loadCalendarView({ silent: true });
        },
        { title: 'Cancel Schedule', confirmText: 'Cancel Schedule' }
      );
    };

    window.deleteCalendarEvent = async function(id) {
      if (!currentCalendarDetailEvent?.can_delete) return toast('Only the schedule creator with delete privilege can delete this schedule.', 'error');
      openConfirmModal(
        '<div class="space-y-2 text-sm"><p>Delete this schedule permanently?</p><p class="font-bold text-red-700 dark:text-red-300">This removes the schedule record, participants, notes, attachments, and reminders. This action cannot be undone.</p></div>',
        async () => {
          await fetchJson(`${API}/calendar/events/${id}/permanent`, { method: 'DELETE' });
          toast('Schedule deleted');
          closeModal('calendarEventDetailModal');
          await loadCalendarView({ silent: true });
        },
        { title: 'Delete Schedule Permanently', confirmText: 'Delete Schedule' }
      );
    };

    window.openCalendarDayAgenda = function(dateKey) {
      const items = lastCalendarEventsCache.filter(event => calendarEventOverlapsDate(event, dateKey));
      openDetailListModal({
        title: 'Day Agenda',
        dateLabel: fmtDateOnly(dateKey),
        typeLabel: `${items.length} item${items.length === 1 ? '' : 's'}`,
        type: 'agenda',
        items: items.map(event => `<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onclick="closeModal('calendarDetailModal'); openCalendarEventDetail('${esc(event.id)}')">
          <div class="text-xs font-bold text-gray-500 dark:text-gray-400">${esc(calendarEventTimeLabel(event))} · ${esc(calendarEventTypeLabel(event))}</div>
          <div class="font-black text-gray-900 dark:text-gray-100">${esc(event.title)}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">${esc([event.location, event.project_name].filter(Boolean).join(' · '))}</div>
        </div>`),
        emptyText: 'No calendar items for this day.'
      });
    };

    window.exportCalendarCsv = function() {
      const rows = [['Date','Start Time','End Time','Title','Type','Location','Visibility','Organizer','Participants','Related Project','Status']];
      lastCalendarEventsCache.forEach(event => rows.push([
        fmtDateOnly(event.start),
        calendarEventTimeLabel(event),
        event.end ? calendarEventTimeLabel({ ...event, start: event.end }) : '',
        event.title,
        calendarEventTypeLabel(event),
        event.location || '',
        event.visibility || '',
        event.owner_username || '',
        (event.participants || []).map(p => p.username).join('; '),
        event.project_name || '',
        event.status || ''
      ]));
      const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `abed-calendar-${calendarMonth}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    
    const calendarMetricLabels = { 
      due: 'Due / Overdue', 
      completed: 'Meetings', 
      forReview: 'For Review'
    };

    function calendarItemCard(item, type) {
      if (type === 'completed' || item.kind === 'project') {
        const dueLine = item.kind === 'project' ? `<div class="text-sm text-red-600 dark:text-red-400 font-semibold mt-1">Project due: ${fmtDueDate(item.due_date)}</div>` : `<div class="text-sm text-gray-600 dark:text-gray-400">Completed: ${fmtDateOnly(item.completed_at)}</div>`;
        const targetKind = type === 'due' ? 'project_due_date' : 'project';
        return `<div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer" onclick="closeModal('calendarDetailModal'); goToTarget({ project_id: ${Number(item.id)}, document_id: null, stage: '${esc(item.stage || 'Proposal')}', target_kind: '${targetKind}', target_type: '${esc(type)}' })">
          <div class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(item.project_name)}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Requester: ${escapeHtml(item.requester)}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Type: ${escapeHtml(item.type_name || '-')}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Project owner: ${escapeHtml(item.project_assigned_username || 'Unassigned')}</div>
          ${item.requestee_name ? `<div class="text-sm text-gray-600 dark:text-gray-400">Requestee: ${escapeHtml(item.requestee_name || '-')}</div>` : ''}
          ${dueLine}
          ${item._calendar_date ? `<div class="text-xs text-gray-500 dark:text-gray-500 mt-1">Calendar date: ${escapeHtml(item._calendar_date)}</div>` : ''}
        </div>`;
      }
      const accent = type === 'forReview'
          ? `<div class="text-sm text-yellow-600 dark:text-yellow-400 mt-1">Uploaded: ${fmtDateTime(item.upload_date)}</div>`
          : `<div class="text-sm text-red-600 dark:text-red-400 font-semibold mt-1">Due: ${fmtDueDate(item.due_date)}</div>`;
      return `<div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer" onclick="closeModal('calendarDetailModal'); goToTarget({ project_id: ${Number(item.project_id)}, document_id: ${Number(item.id)}, stage: '${esc(item.stage || 'Proposal')}', target_kind: 'document', target_type: '${esc(type)}' })">
        <div class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(item.project_name)}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Requester: ${escapeHtml(item.requester)}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Document: ${escapeHtml(item.document_type_name)}</div>
        ${item.requestee_name ? `<div class="text-sm text-gray-600 dark:text-gray-400">Requestee: ${escapeHtml(item.requestee_name || '-')}</div>` : ''}
        ${item.type_name ? `<div class="text-sm text-gray-600 dark:text-gray-400">Type: ${escapeHtml(item.type_name || '-')}</div>` : ''}
        <div class="text-sm text-gray-600 dark:text-gray-400">Assigned to: ${escapeHtml(ownerDisplayName(item))}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Project owner: ${escapeHtml(item.project_assigned_username || 'Unassigned')}</div>
        ${item.status ? `<div class="text-sm text-gray-600 dark:text-gray-400">Status: ${escapeHtml(item.status)}</div>` : ''}
        ${accent}
        <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">Stage: ${escapeHtml(item.stage || 'Proposal')}${item._calendar_date ? ` - Calendar date: ${escapeHtml(item._calendar_date)}` : ''}</div>
      </div>`;
    }

    async function fetchCalendarDetailItems(date, type) {
      const data = await fetchJson(`${API}/calendar/details?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}&${buildCalendarQuery()}`, { silentLoading: true });
      return data.items || [];
    }

    // Show details modal for calendar day counts
    window.showCalendarDetails = async function(date, type) {
      try {
        toggleLoad(true);
        const items = await fetchCalendarDetailItems(date, type);
        openDetailListModal({
          title: 'Calendar Details',
          dateLabel: date,
          typeLabel: calendarMetricLabels[type] || type,
          type,
          items: items.map(item => calendarItemCard(item, type)),
          emptyText: 'No items found'
        });
        toggleLoad(false);
      } catch (e) {
        toggleLoad(false);
        console.error('Calendar details error:', e);
        toast(e.message || 'Failed to load details', 'error');
      }
    }

    window.showCalendarMetricDetails = async function(type) {
      try {
        toggleLoad(true);
        const dues = lastCalendarDuesCache.length
          ? lastCalendarDuesCache
          : await fetchJson(`${API}/calendar/dues?${buildCalendarQuery()}`, { silentLoading: true });
        const countField = { due: 'due_count', completed: 'completed_count', forReview: 'for_review_count' }[type];
        const dates = dues.filter(item => (item[countField] || 0) > 0).map(item => item.due_date);
        const details = await Promise.all(dates.map(date => fetchCalendarDetailItems(date, type).then(items => items.map(item => ({ ...item, _calendar_date: date })))));
        const items = details.flat();
        const [year, month] = calendarMonth.split('-').map(Number);
        const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
        openDetailListModal({
          title: 'Calendar Metric Details',
          dateLabel: monthLabel,
          typeLabel: calendarMetricLabels[type] || type,
          type,
          items: items.map(item => calendarItemCard(item, type)),
          emptyText: 'No items found for this month.'
        });
        toggleLoad(false);
      } catch (e) {
        toggleLoad(false);
        console.error('Calendar metric details error:', e);
        toast(e.message || 'Failed to load calendar metric details', 'error');
      }
    }
