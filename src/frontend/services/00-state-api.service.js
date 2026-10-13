    const API = '/api';
    let projCache = [], typeCache = [], reqCache = [], docCache = [], usersCache = [];
    let currentProjId = null, isEdit = false, confirmCallback = null, confirmPromiseResolver = null;
    const pendingConfirmationsCache = {};
    let workloadCache = null, pendingProjectCreateData = null, documentSearchTimer = null;
    let dashboardStageFilter = 'All';
    let dashboardOutcomeFilter = 'Active';
    let dashboardSavedFilters = { search: '', requestee: 'All', type: 'All', outcome: 'Active', sort: 'created' };
    let reviewDocumentsMode = 'pending';
    let activeWorkPanel = null;
    let workQueueFilter = 'active';
    let workAssignmentSelected = {};
    let workAssignmentMultiSelect = false;
    let workAssignmentTypeFilter = 'both';
    let workAssignmentExpandedProjectDocs = {};
    let assignmentPickerSort = 'least';
    let workItemTargetCache = {};
    let activeDetailStage = 'Proposal'; 
    let currentUser = null;
    let authToken = localStorage.getItem('abedAuthToken') || '';
    let currentUserPrivileges = {}; // Store user privileges as { privilege_name: boolean }
    let currentTheme = localStorage.getItem('abedTheme') || 'light';
    let stableSidebarCollapsed = localStorage.getItem('abearcSidebarCollapsed') === '1';
    let calendarMonth = new Date().toISOString().slice(0, 7);
    let calendarScope = 'my';
    let calendarDisplayView = ['month','week','day','agenda'].includes(localStorage.getItem('abearcCalendarView')) ? localStorage.getItem('abearcCalendarView') : 'month';
    let calendarSidebarCollapsed = window.innerWidth < 768;
    const ALL_MY_TYPE_KEYS = ['project_deadlines', 'meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey', 'site_validation', 'site_geotagging', 'monitoring', 'procurement', 'document_follow_up', 'project_milestone', 'personal', 'maintenance', 'leave', 'other', 'document_review', 'cancelled'];
    const ALL_ABE_TYPE_KEYS = ['project_deadlines', 'meeting', 'training', 'workshop', 'orientation', 'site_inspection', 'site_survey', 'site_validation', 'site_geotagging', 'monitoring', 'procurement', 'document_follow_up', 'project_milestone', 'maintenance', 'leave', 'other', 'document_review', 'cancelled'];
    let calendarQuickFilterState = { expandedGroup: null, selectedTypes: { my: [...ALL_MY_TYPE_KEYS], abe: [...ALL_ABE_TYPE_KEYS] } };
    let calendarTimeFilter = 'all';
    let calendarSelectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

    function applyStableSidebarState() {
      document.body.classList.toggle('sidebar-collapsed', stableSidebarCollapsed);
      const btn = document.getElementById('sidebarCollapseBtn');
      if (btn) {
        const label = stableSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('aria-pressed', String(stableSidebarCollapsed));
        btn.title = label;
      }
    }

    function toggleStableSidebar() {
      stableSidebarCollapsed = !stableSidebarCollapsed;
      localStorage.setItem('abearcSidebarCollapsed', stableSidebarCollapsed ? '1' : '0');
      applyStableSidebarState();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyStableSidebarState);
    } else {
      applyStableSidebarState();
    }

    function setSidebarActive(item) {
      document.querySelectorAll('.op-stable-sidebar [data-sidebar-item]').forEach(btn => {
        const active = btn.dataset.sidebarItem === item;
        btn.classList.toggle('is-active', active);
        btn.toggleAttribute('aria-current', active);
      });
    }

    function syncSidebarActiveForView(view, options = {}) {
      const item = view === 'dashboard'
        ? (activeWorkPanel === 'my' ? 'my-assignments' : activeWorkPanel === 'global' ? 'work-assignment' : activeWorkPanel === 'schedule' ? 'my-schedule' : 'overview')
        : view === 'review' ? 'review'
        : view === 'myDrive' ? 'my-drive'
        : view === 'map' ? 'map'
        : view === 'monitoring' ? 'monitoring'
        : view === 'calendar' ? 'calendar'
        : view === 'settings' ? ((options.section || activeSettingsSection) === 'pending-confirmations' ? 'approvals' : 'settings')
        : null;
      if (view === 'settings' && (options.section || activeSettingsSection) === 'downloads-forms') return setSidebarActive('forms-tools');
      if (item) setSidebarActive(item);
    }

    function applySidebarVisibility() {
      const loggedIn = !!currentUser;
      const visibility = {
        overview: loggedIn,
        'my-assignments': loggedIn,
        'work-assignment': loggedIn && canViewWorkAssignment(),
        calendar: loggedIn && hasPrivilege('view_calendar'),
        'my-schedule': loggedIn && hasPrivilege('view_calendar'),
        map: loggedIn && hasPrivilege('view_abearc_map'),
        monitoring: loggedIn && hasPrivilege('view_monitoring_inventory'),
        review: loggedIn,
        'my-drive': loggedIn && hasPrivilege('view_user_drive'),
        'forms-tools': loggedIn,
        settings: loggedIn,
        approvals: loggedIn && canUsePendingConfirmations()
      };
      Object.entries(visibility).forEach(([item, visible]) => {
        document.querySelector(`[data-sidebar-item="${item}"]`)?.classList.toggle('hidden', !visible);
      });
      document.querySelectorAll('.op-stable-sidebar__section').forEach(section => {
        let hasVisibleItem = false;
        for (let el = section.nextElementSibling; el && !el.classList.contains('op-stable-sidebar__section') && !el.classList.contains('op-stable-sidebar__footer'); el = el.nextElementSibling) {
          if (el.matches('[data-sidebar-item]') && !el.classList.contains('hidden')) hasVisibleItem = true;
        }
        section.classList.toggle('hidden', !hasVisibleItem);
      });
    }
    let calendarSelectedDateKeys = new Set([calendarSelectedDate]);
    let calendarMiniDragState = null;
    let lastCalendarDuesCache = [];
    let lastCalendarEventsCache = [];
    let lastCalendarMonthAgendaCache = [];
    let currentCalendarDetailEvent = null;
    let myScheduleAssignmentsCache = [];
    let myDashboardSchedulesCache = [];
    let dashboardScheduleFilter = 'all';
    let calendarReloadTimer = null;
    let calendarLoadRequestId = 0;
    let calendarUserSearchTimer = null;
    let selectedCalendarUsers = [];
    let calendarUserSearchOpen = false;
    let calendarUserSearchActiveIndex = -1;
    let calendarModalUserSearchTimer = null;
    let calendarModalSelectedUsers = [];
    let calendarModalUserSearchOpen = false;
    let calendarModalUserSearchActiveIndex = -1;
    let calendarDefaultsAppliedForUserId = null;
    let assignmentPickerState = null;
    let appCurrentView = 'login';
    let activeSettingsSection = 'appearance';
    let configurationRequestFilter = 'pending';
    let configurationRequestHighlightId = null;
    let restoringHistoryState = false;
    let suppressOverlayHistory = false;
    let lastDetailScrollTarget = null;
    let suppressNextOpenDetailRefresh = false;
    let suppressNextDetailStageLoad = false;
    let printPreviewReturnState = null;
    let fileViewerBlobUrl = null;
    let fileViewerCurrentDocumentId = null;
    let fileViewerCurrentFileName = '';
    let fileViewerCurrentSource = 'document';
    let fileViewerCurrentMyDriveId = null;
    let stageEditAccessCache = [];
    let stageEditAccessUsersCache = [];
    let privilegeCatalogCache = [];
    let roleDefaultPrivileges = {};
    const SYSTEM_PRIVILEGE_NAMES = new Set([
      'manage_backups', 'manage_maintenance', 'import_export_config',
      'view_activity_logs', 'system_testing', 'system_health_check'
    ]);
    
    // Helper function to check if user has a specific privilege
    function hasPrivilege(privilegeName) {
      if (currentUser?.role === 'superadmin' && !SYSTEM_PRIVILEGE_NAMES.has(privilegeName)) return true;
      return currentUserPrivileges[privilegeName] === true;
    }

    function isSystemUser(user = currentUser) {
      return !!user && (user.role === 'system' || Number(user.is_system_account || 0) === 1);
    }

    function isVisibleWorkUser(user) {
      return !!user && !isSystemUser(user) && Number(user.hidden_from_workflows || 0) !== 1;
    }

    function filterVisibleWorkUsers(users = []) {
      return (Array.isArray(users) ? users : []).filter(isVisibleWorkUser);
    }

    function canBypassAssignmentOwnership() {
      return currentUser?.role === 'superadmin' || hasPrivilege('bypass_assignment_ownership');
    }

    function canActOnAssignedItem(item = {}) {
      return !item.assigned_user_id || Number(item.assigned_user_id) === Number(currentUser?.id) || canBypassAssignmentOwnership();
    }

    function isCurrentUserProjectCreator(project = {}) {
      return !!project?.creator_user_id && Number(project.creator_user_id) === Number(currentUser?.id);
    }

    function canDeleteProjectRecord(project = {}) {
      if (!hasPrivilege('delete_project')) return false;
      if (currentUser?.role === 'superadmin') return true;
      return Number(project?.uploaded_files || 0) === 0 && (canBypassAssignmentOwnership() || canActOnAssignedItem(project) || isCurrentUserProjectCreator(project));
    }

    const PROJECT_DOCUMENTATION_STAGES = ['Proposal', 'Implementation', 'Monitoring', 'Completed'];
    const PROJECT_DOCUMENTATION_CATEGORIES = ['Site Validation', 'Implementation', 'Monitoring', 'Completion', 'Others'];
    const PROJECT_DOCUMENTATION_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
    const PROJECT_DOCUMENTATION_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
    let projectDocumentationCounts = { Proposal: 0, Implementation: 0, Monitoring: 0, Completed: 0 };
    let projectDocumentationViewerStage = 'Proposal';
    let projectDocumentationSelectedFiles = [];
    let projectDocumentationDropZoneReady = false;

    function currentProjectDocumentationStage() {
      const project = projCache.find(p => Number(p.id) === Number(currentProjId));
      if (project?.stage === 'Completed' && !WORKFLOW_STAGES.includes(activeDetailStage)) return 'Completed';
      return PROJECT_DOCUMENTATION_STAGES.includes(activeDetailStage) ? activeDetailStage : 'Proposal';
    }

    function canUploadProjectDocumentation() {
      return currentUser?.role === 'superadmin' || hasPrivilege('upload_project_documentation');
    }

    function canViewProjectDocumentation() {
      return currentUser?.role === 'superadmin' || hasPrivilege('view_project_documentation');
    }

    function projectDocumentationCategoryForStage(stage) {
      if (stage === 'Proposal') return 'Site Validation';
      if (stage === 'Implementation') return 'Implementation';
      if (stage === 'Monitoring') return 'Monitoring';
      if (stage === 'Completed') return 'Completion';
      return 'Others';
    }

    const PROJECT_OUTCOMES = ['Active', 'Completed', 'Not Feasible', 'Deferred', 'Cancelled', 'Withdrawn', 'Duplicate', 'For Future Funding', 'Irreparable', 'Decommissioned'];
    const INACTIVE_PROJECT_OUTCOMES = ['Not Feasible', 'Deferred', 'Cancelled', 'Withdrawn', 'Duplicate', 'For Future Funding', 'Irreparable', 'Decommissioned'];
    function projectOutcome(project = {}) {
      return PROJECT_OUTCOMES.includes(project.outcome) ? project.outcome : (project.stage === 'Completed' ? 'Completed' : 'Active');
    }
    function isInactiveProject(project = {}) {
      return INACTIVE_PROJECT_OUTCOMES.includes(projectOutcome(project));
    }
    function canManageProjectDisposition() {
      return currentUser?.role === 'superadmin' || hasPrivilege('manage_project_disposition');
    }
    function canRequestProjectDisposition() {
      return currentUser?.role === 'superadmin' || hasPrivilege('request_project_disposition') || hasPrivilege('manage_project_disposition');
    }
    function canApproveProjectDisposition() {
      return currentUser?.role === 'superadmin' || hasPrivilege('approve_project_disposition');
    }
    function canRequestProjectClosure() {
      return currentUser?.role === 'superadmin' || hasPrivilege('request_project_closure') || hasPrivilege('transition_stage');
    }
    function canApproveProjectClosure() {
      return currentUser?.role === 'superadmin' || hasPrivilege('approve_project_closure');
    }
    function canViewProjectClosureAttachments() {
      return currentUser?.role === 'superadmin' || hasPrivilege('view_project_closure_attachments');
    }
    function canUsePendingConfirmations() {
      return !!currentUser;
    }
    function canMarkProjectDisposition(project = {}) {
      if (!project) return false;
      const assignedId = Number(project.assigned_user_id || 0);
      const currentId = Number(currentUser?.id || 0);
      const isSuperadmin = currentUser?.role === 'superadmin';
      if (!canRequestProjectDisposition()) return false;
      if (assignedId) return isSuperadmin || assignedId === currentId || hasPrivilege('manage_project_disposition');
      return isSuperadmin || hasPrivilege('manage_project_disposition') || hasPrivilege('request_project_disposition');
    }
    function projectOutcomeBadge(projectOrOutcome) {
      const outcome = typeof projectOrOutcome === 'string' ? projectOrOutcome : projectOutcome(projectOrOutcome);
      const classes = {
        Active: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        Completed: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
        'Not Feasible': 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
        Deferred: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        Cancelled: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        Withdrawn: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
        Duplicate: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        'For Future Funding': 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        Irreparable: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        Decommissioned: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
      };
      return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border whitespace-nowrap ${classes[outcome] || classes.Active}">${esc(outcome)}</span>`;
    }
    
    // Theme management functions
    function applyTheme(theme) {
      const html = document.documentElement;
      if (theme === 'dark') {
        html.classList.add('dark');
      } else if (theme === 'system') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      } else {
        html.classList.remove('dark');
      }
      currentTheme = theme;
      localStorage.setItem('abedTheme', theme);
    }
    
    function setupSystemThemeListener() {
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (currentTheme === 'system') {
            if (e.matches) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        });
      }
    }
    
    async function updateUserTheme(theme) {
      try {
        await fetchJson(`${API}/user/theme`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme })
        });
        applyTheme(theme);
        toast('Theme updated');
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    
    let configMode = 'view'; 
    let selectionOrder = []; 
    let requirementsConfigCurrentSelection = { projectTypeId: '', requesteeId: '', stage: 'Proposal' };
    let suppressRequirementsSelectionChange = false;
    let reloadRequirementsOverrideEnabled = false;
    const WORKFLOW_STAGES = ['Proposal', 'Implementation', 'Monitoring'];
    const STAGE_TAB_IDS = { Proposal: 'projTabProposal', Implementation: 'projTabImpl', Monitoring: 'projTabMonitoring' };
    const DASH_TAB_IDS = { All: 'dashTabAll', Proposal: 'dashTabProposal', Implementation: 'dashTabImplementation', Monitoring: 'dashTabMonitoring', Completed: 'dashTabCompleted', Disposition: 'dashTabDisposition' };
    const DASH_TAB_ACTIVE_CLASSES = { 
      All: 'bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950 shadow-sm', 
      Proposal: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 shadow-sm', 
      Implementation: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm', 
      Monitoring: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 shadow-sm', 
      Completed: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 shadow-sm', 
      Disposition: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 shadow-sm' 
    };
    const STAGE_THEME = {
      Proposal: { text: 'text-yellow-800 dark:text-yellow-200', activeTab: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 shadow-sm', inactiveTab: 'text-gray-600 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20', badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800' },
      Implementation: { text: 'text-blue-800 dark:text-blue-200', activeTab: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm', inactiveTab: 'text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800' },
      Monitoring: { text: 'text-cyan-800 dark:text-cyan-200', activeTab: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 shadow-sm', inactiveTab: 'text-gray-600 dark:text-gray-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20', badge: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800' },
      Completed: { text: 'text-green-800 dark:text-green-200', activeTab: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 shadow-sm', inactiveTab: 'text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20', badge: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' }
    };
    const stageIndex = (stage) => WORKFLOW_STAGES.indexOf(stage);

    const svgEdit = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`;
    const svgDelete = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
    const svgNext = `<svg class="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m6-5H3"></path></svg>`;
    const svgCheck = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    document.getElementById('btnDeleteModal').innerHTML = svgDelete;

    async function fetchJson(url, opts={}) {
      const silentLoading = opts.silentLoading === true;
      const cleanOpts = { ...opts };
      delete cleanOpts.silentLoading;
      const method = String(cleanOpts.method || 'GET').toUpperCase();
      if (!silentLoading) toggleLoad(true);
      try { 
          const headers = new Headers(cleanOpts.headers || {});
          const requestAuthToken = authToken;
          if (requestAuthToken) headers.set('Authorization', `Bearer ${requestAuthToken}`);
          const r = await fetch(url, { ...cleanOpts, headers }); 
          const text = await r.text();
          let data;
          try { data = JSON.parse(text); } catch { throw new Error(text); }
          if (r.status === 401) {
              // Only show session expired modal if user was previously authenticated
              // and the error is not from startup/login auth checks.
              const isLoginEndpoint = url.includes('/auth/login');
              const isAuthProbeEndpoint = url.includes('/auth/me');
              if (!isLoginEndpoint && !isAuthProbeEndpoint && requestAuthToken && requestAuthToken === authToken) {
                  handleServerSessionUnauthorized(data.code);
              }
              throw new Error(data.error || 'Please log in.');
          }
          if (!r.ok) throw new Error(data.error || 'Fail'); 
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) schedulePostMutationRefresh(url);
          return data; 
      } 
      finally { if (!silentLoading) setTimeout(()=>toggleLoad(false), 300); }
    }

    function schedulePostMutationRefresh(url = '') {
      if (!currentUser || restoringHistoryState || heavyOperationInProgress) return;
      if (/\/auth\/(login|logout|activity|mobile-qr)/.test(String(url))) return;
      if (String(url).includes('/user/theme')) return;
      clearTimeout(schedulePostMutationRefresh.timer);
      schedulePostMutationRefresh.timer = setTimeout(() => queueSmartRefresh('mutation'), 350);
    }
    
    const toggleLoad = (s) => document.getElementById('loadingOverlay').classList.toggle('hidden', !s);
    const esc = (s) => s ? String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) : '';
    function readableReminderLead(minutes) {
      const mins = Number(minutes || 0);
      if (!Number.isFinite(mins) || mins <= 0) return 'now';
      if (mins % 1440 === 0) {
        const days = mins / 1440;
        return `in ${days} day${days === 1 ? '' : 's'}`;
      }
      if (mins >= 60 && mins % 60 === 0) {
        const hours = mins / 60;
        return `in ${hours} hour${hours === 1 ? '' : 's'}`;
      }
      return `in ${mins} minute${mins === 1 ? '' : 's'}`;
    }
    function normalizeCalendarReminderMessage(message) {
      return String(message || '').replace(/\bstarts in (\d+) minutes\b/gi, (match, value) => {
        const mins = Number(value);
        if (!Number.isFinite(mins) || mins < 60) return match;
        return `starts ${readableReminderLead(mins)}`;
      });
    }
    const displayUsername = (name) => {
      const raw = String(name || 'User').trim();
      if (!raw) return 'User';
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };
    const uppercaseUsername = (name) => String(name || 'USER').trim().toLocaleUpperCase();
    function userInitials(user = {}) {
      const raw = String(user.display_name || user.username || user.name || user.email || 'User').trim();
      const parts = raw.split(/[\s._-]+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return raw.slice(0, 1).toUpperCase() || 'U';
    }
    function userAvatarUrl(user = {}) {
      return user.avatar_url || (user.avatar_path ? `${API}/avatars/${String(user.avatar_path).replace(/^avatars[\\/]/, '').split(/[\\/]+/).map(encodeURIComponent).join('/')}` : '');
    }
    function renderUserAvatar(user = {}, size = 32, extraClass = '') {
      const initials = esc(userInitials(user));
      const src = userAvatarUrl(user);
      const dim = `width:${Number(size)}px;height:${Number(size)}px`;
      const base = `inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-700 dark:bg-cyan-400 text-white dark:text-gray-950 font-black overflow-hidden ${extraClass}`;
      if (src) return `<span class="${base}" style="${dim}"><img src="${esc(src)}" alt="${esc(displayUsername(user.username || 'User'))}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:center 35%" onerror="this.remove(); this.parentElement.textContent='${initials}'"></span>`;
      return `<span class="${base}" style="${dim}">${initials}</span>`;
    }
    function forceLoginLightMode() {
      document.documentElement.classList.remove('dark');
    }

    async function openCurrentUserAppearanceSettings() {
      closeMobileHeaderMenu();
      await showSettings(true, { section: 'appearance' });
    }
    
    // Global HTML escape helper for safe rendering
    function escapeHTML(str = '') {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    
    // Format date as relative time for activity feeds ONLY
    const fmtDateRelative = (d) => {
      if (!d) return '-';
      try { 
        const value = String(d);
        const date = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? new Date(value) : new Date(value.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
      } 
      catch (e) { return '-'; }
    };
    
    // Get exact notification time difference in minutes/hours/days for proper display
    const getNotificationTimeDiff = (d) => {
      if (!d) return '';
      try {
        const value = String(d);
        const date = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? new Date(value) : new Date(value.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return { value: 0, unit: 'now' };
        if (diffMins < 60) return { value: diffMins, unit: 'm' };
        if (diffHours < 24) return { value: diffHours, unit: 'h' };
        if (diffDays < 7) return { value: diffDays, unit: 'd' };
        return null; // Use full date format
      }
      catch (e) { return ''; }
    };
    
    // Alias for backwards compatibility
    const escapeHtml = escapeHTML;
    
    const parseDateTimeValue = (value) => {
      if (!value) return null;
      const text = String(value).trim();
      const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text);
      return new Date(sqliteUtc ? text.replace(' ', 'T') + 'Z' : text);
    };

    // Format date/time for timestamps (upload dates, checked dates, etc.)
    const fmtDateTime = (d) => {
      if (!d) return '-';
      try {
        return new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(parseDateTimeValue(d));
      } catch (e) { return '-'; }
    };
    
    // Format due date - SAME format as Upload Date (with time and AM/PM)
    const fmtDueDate = (d) => {
      if (!d) return '-';
      try {
        return new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(parseDateTimeValue(d));
      } catch (e) { return '-'; }
    };
    
    // Alias for backwards compatibility with activity feeds
    const fmtDate = fmtDateRelative;
    
    const fmtDateOnly = (d) => {
      if (!d) return '-';
      try { return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit' }).format(parseDateTimeValue(d)); }
      catch (e) { return '-'; }
    };

    const addWorkingDaysClient = (startDate, days) => {
      const result = new Date(startDate);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      return result;
    };
    
    // Format date as relative time for dashboard
    const fmtRelativeDate = (d) => {
      if (!d) return 'None';
      try { 
        const date = new Date(d);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return fmtDateOnly(d);
      } 
      catch (e) { return '-'; }
    };

    let notificationsCache = [];
    let notificationStream = null;
    let unreadNotificationCount = 0;
    let showAllNotifications = false;
    let notificationsLimit = 25;
    let notificationsHasMore = false;
    let dashboardPage = 1;
    let DASHBOARD_PAGE_SIZE = 10;
    let lastDashboardRenderKey = '';
    let liveRefreshTimer = null;
    let liveRefreshInFlight = false;
    let uploadInProgress = false;
    let printViewOpen = false;
    let heavyOperationInProgress = false;
    let lastVisibleRefreshAt = 0;
    const SMART_REFRESH_INTERVAL_MS = 120000;
    const SESSION_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
    const SESSION_ACTIVITY_HEARTBEAT_MS = 5 * 60 * 1000;
    const SESSION_ACTIVITY_CHECK_MS = 30 * 1000;
    let lastPageActivityAt = Number(localStorage.getItem('abedLastPageActivityAt') || Date.now());
    let lastPageActivityStoredAt = lastPageActivityAt;
    let lastSessionHeartbeatAt = 0;
    let sessionActivityTimer = null;
    let sessionHeartbeatInFlight = false;
    const UPLOAD_ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
    const UPLOAD_MAX_FILE_SIZE = 50 * 1024 * 1024;
    let selectedUploadFile = null;

    const normalizeNotificationPriority = (notification) => {
      const type = String(notification?.type || '').toLowerCase();
      const priority = String(notification?.priority || '').toLowerCase();
      if (['critical', 'overdue'].includes(priority) || type.includes('overdue')) return 'critical';
      if (['warning', 'due'].includes(priority) || type.includes('due_soon') || type.includes('due_tomorrow') || type.includes('due_today') || type.includes('due_in_5') || type.includes('unassigned') || type.includes('missing')) return 'warning';
      if (priority === 'success' || type.includes('completed') || type.includes('reviewed')) return 'success';
      if (priority === 'review' || type.includes('for_review')) return 'review';
      return 'info';
    };

    const notificationPriorityMeta = (notification) => ({
      critical: {
        label: 'URGENT',
        rail: 'border-l-red-500',
        dot: 'bg-red-600 dark:bg-red-400',
        card: 'bg-red-50/80 dark:bg-red-950/20',
        pill: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800'
      },
      warning: {
        label: 'REMINDER',
        rail: 'border-l-amber-500',
        dot: 'bg-amber-500 dark:bg-amber-300',
        card: 'bg-amber-50/70 dark:bg-amber-950/20',
        pill: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'
      },
      review: {
        label: 'FOR REVIEW',
        rail: 'border-l-yellow-500',
        dot: 'bg-yellow-500 dark:bg-yellow-300',
        card: 'bg-yellow-50/70 dark:bg-yellow-950/20',
        pill: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800'
      },
      info: {
        label: 'INFO',
        rail: 'border-l-cyan-500',
        dot: 'bg-cyan-600 dark:bg-cyan-300',
        card: 'bg-cyan-50/70 dark:bg-cyan-950/20',
        pill: 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800'
      },
      success: {
        label: 'DONE',
        rail: 'border-l-emerald-500',
        dot: 'bg-emerald-600 dark:bg-emerald-300',
        card: 'bg-emerald-50/70 dark:bg-emerald-950/20',
        pill: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
      }
    }[normalizeNotificationPriority(notification)]);

    const formatNotificationType = (type) => String(type || 'notification')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, ch => ch.toUpperCase());

    const formatProjectLocation = (project = {}) => {
      const parts = [project.barangay, project.district].filter(Boolean);
      return parts.length ? parts.join(', ') : '-';
    };

    const getNotificationActorDisplay = (notification) => {
      const hasActor = !!(notification?.actor_username || notification?.actor_user_id);
      const actorName = notification?.actor_username || (notification?.actor_user_id ? `User #${notification.actor_user_id}` : 'System');
      const type = String(notification?.type || '').toLowerCase();
      const action = String(notification?.event_action || notification?.target_meta?.event_action || '').toLowerCase();
      const targetKind = String(notification?.target_kind || notification?.targetKind || '').toLowerCase();
      const message = String(notification?.message || '').toLowerCase();
      const haystack = `${type} ${action} ${targetKind} ${message}`;

      if (!hasActor || type.startsWith('system_generated_') || ['due_in_5_working_days', 'due_soon', 'due_today', 'overdue'].includes(type)) {
        return { label: 'Generated by', value: 'System' };
      }
      if (haystack.includes('document_uploaded') || haystack.includes('monitoring_document_uploaded') || type === 'document_for_review') {
        return { label: 'Uploaded by', value: actorName };
      }
      if (haystack.includes('document_assigned') || haystack.includes('document_assignment') || haystack.includes('assigned_document')) {
        return { label: 'Assigned by', value: actorName };
      }
      if (haystack.includes('document_reviewed') || haystack.includes('monitoring_document_reviewed') || haystack.includes('reviewed')) {
        return { label: 'Reviewed by', value: actorName };
      }
      if (haystack.includes('document_checked') || haystack.includes('checked') || haystack.includes('mark_checked')) {
        return { label: 'Checked by', value: actorName };
      }
      if (haystack.includes('due_date') || haystack.includes('manual_due_date')) {
        return { label: 'Updated by', value: actorName };
      }
      if (haystack.includes('requirements_set_created')) {
        return { label: 'Created by', value: actorName };
      }
      if (haystack.includes('requirement') || targetKind === 'requirement' || targetKind === 'requirements') {
        return { label: 'Updated by', value: actorName };
      }
      if (haystack.includes('project_stage_changed') || haystack.includes('stage_transitioned') || targetKind === 'stage') {
        return { label: 'Transitioned by', value: actorName };
      }
      if (haystack.includes('project_created')) {
        return { label: 'Created by', value: actorName };
      }
      if (haystack.includes('project_updated') || haystack.includes('project_edited') || haystack.includes('edited project')) {
        return { label: 'Updated by', value: actorName };
      }
      if (haystack.includes('project_assigned') || haystack.includes('project_assignment')) {
        return { label: 'Assigned by', value: actorName };
      }
      return { label: 'Performed by', value: actorName };
    };

    const notificationHasProjectDocumentTarget = (notification) => {
      const targetKind = String(notification?.target_kind || notification?.targetKind || '').toLowerCase();
      const type = String(notification?.type || '').toLowerCase();
      const meta = notification?.target_meta || {};
      if (targetKind === 'user_drive') return type !== 'user_drive_access_removed' && !!(Number(meta.file_id || 0) || Number(meta.folder_id || 0));
      if (['calendar_event', 'calendar', 'settings', 'system', 'requirements'].includes(targetKind)) return true;
      const projectId = Number(notification?.project_id || notification?.projectId || 0);
      return projectId > 0;
    };

    const notificationTargetLabel = (notification) => {
      const targetKind = String(notification?.target_kind || notification?.targetKind || '').toLowerCase();
      if (targetKind === 'calendar_event') return 'View Schedule';
      if (targetKind === 'calendar') return 'Open Calendar';
      if (targetKind === 'user_drive') return Number(notification?.target_meta?.folder_id || 0) ? 'Open Folder' : 'Open File';
      if ((targetKind === 'settings' || targetKind === 'system') && Number(notification?.target_meta?.request_id || 0)) return 'Open Approval Request';
      if (targetKind === 'settings' || targetKind === 'system') return 'Open Settings';
      if (targetKind === 'requirements') return 'Open Requirements';
      if (targetKind === 'deleted_project' || notification?.target_meta?.deleted) return 'Project Deleted';
      const documentId = Number(notification?.document_id || notification?.documentId || 0);
      return documentId > 0 ? 'Go to Document' : 'Go to Project';
    };

    const notificationPrivilegeNames = (meta = {}, key, fallbackKey) => {
      const names = Array.isArray(meta[key]) ? meta[key] : [];
      const fallback = Array.isArray(meta[fallbackKey]) ? meta[fallbackKey].map(name => String(name || '').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())) : [];
      return names.length ? names : fallback;
    };
