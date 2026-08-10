
    function buildPermissionChangeDetails(notification, { fullPage = false } = {}) {
      if (notification?.type !== 'system_permission_changed') return '';
      const meta = notification.target_meta || {};
      const enabled = notificationPrivilegeNames(meta, 'enabled_privilege_names', 'enabled_privileges');
      const disabled = notificationPrivilegeNames(meta, 'disabled_privilege_names', 'disabled_privileges');
      if (!enabled.length && !disabled.length) return '';
      const renderGroup = (label, items) => {
        if (!items.length) return '';
        const shown = fullPage ? items : items.slice(0, 3);
        const more = !fullPage && items.length > shown.length ? `<li class="text-gray-500 dark:text-gray-400">+${items.length - shown.length} more</li>` : '';
        return `<div class="mt-2">
          <div class="font-black text-gray-700 dark:text-gray-200">${label}:</div>
          <ul class="mt-1 space-y-0.5">${shown.map(item => `<li>&bull; ${esc(item)}</li>`).join('')}${more}</ul>
        </div>`;
      };
      return `<div class="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-950/40 p-3 text-xs ${fullPage ? 'sm:text-sm' : ''} text-gray-600 dark:text-gray-300">
        <div class="font-black text-gray-900 dark:text-gray-100">Permissions updated</div>
        ${renderGroup('Enabled', enabled)}
        ${renderGroup('Disabled', disabled)}
      </div>`;
    }

    function buildUserDriveNotificationDetails(notification, { fullPage = false } = {}) {
      if (String(notification?.target_kind || '').toLowerCase() !== 'user_drive') return '';
      const meta = notification.target_meta || {};
      const itemName = meta.item_name || notification.document_name || '';
      const kind = meta.item_kind || (Number(meta.folder_id || 0) ? 'folder' : 'file');
      if (!itemName) return '';
      return `<div class="mt-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-950/20 p-3 text-xs ${fullPage ? 'sm:text-sm' : ''} text-gray-700 dark:text-gray-200">
        ${itemName ? `<div><span class="font-black text-gray-900 dark:text-gray-100">${esc(kind === 'folder' ? 'Folder' : 'File')}:</span> ${esc(itemName)}</div>` : ''}
      </div>`;
    }

    function updateNotificationFilterTabs() {
      const activeCls = 'bg-white dark:bg-gray-900 text-cyan-800 dark:text-cyan-200 shadow-sm border border-cyan-200 dark:border-cyan-800';
      const inactiveCls = 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 border border-transparent';
      [
        ['notificationUnreadTab', !showAllNotifications],
        ['notificationAllTab', showAllNotifications],
        ['notificationDrawerUnreadTab', !showAllNotifications],
        ['notificationDrawerAllTab', showAllNotifications],
        ['notificationPageUnreadTab', !showAllNotifications],
        ['notificationPageAllTab', showAllNotifications]
      ].forEach(([id, active]) => {
        const btn = document.getElementById(id);
        if (btn) btn.className = `px-3 py-2 rounded-md text-xs sm:text-sm font-black transition ${active ? activeCls : inactiveCls}`;
      });
    }

    function setNotificationFilter(mode) {
      showAllNotifications = mode === 'all';
      if (showAllNotifications && notificationsLimit < 100) {
        notificationsLimit = 100;
        loadNotifications(notificationsLimit);
        return;
      }
      renderNotifications();
    }

    function updateNotificationBadge(count) {
      unreadNotificationCount = Number(count) || 0;
      const badge = document.getElementById('notificationBadge');
      if (!badge) return;
      badge.textContent = unreadNotificationCount > 9 ? '9+' : String(unreadNotificationCount);
      badge.classList.toggle('hidden', unreadNotificationCount === 0);
    }

    function notificationSortTime(n) {
      return new Date(n?.updated_at || n?.created_at || 0).getTime() || 0;
    }

    function sortNotificationsCache() {
      notificationsCache.sort((a, b) => notificationSortTime(b) - notificationSortTime(a) || Number(b.id || 0) - Number(a.id || 0));
    }

    function upsertNotificationCache(notification) {
      const id = Number(notification?.id || 0);
      if (!id) return { inserted: false, unreadDelta: 0 };
      const idx = notificationsCache.findIndex(n => Number(n.id) === id);
      const wasUnread = idx >= 0 ? !notificationsCache[idx].read_at : false;
      const isUnread = !notification.read_at;
      if (idx >= 0) {
        notificationsCache[idx] = { ...notificationsCache[idx], ...notification };
      } else {
        notificationsCache.push(notification);
      }
      sortNotificationsCache();
      notificationsCache = notificationsCache.slice(0, notificationsLimit);
      if (idx >= 0) return { inserted: false, unreadDelta: (isUnread ? 1 : 0) - (wasUnread ? 1 : 0) };
      return { inserted: true, unreadDelta: isUnread ? 1 : 0 };
    }

    function buildNotificationItemsHtml({ fullPage = false } = {}) {
      const visibleNotifications = showAllNotifications ? notificationsCache : notificationsCache.filter(n => !n.read_at);
      return visibleNotifications.length ? visibleNotifications.map(n => {
        const unread = !n.read_at;
        const meta = notificationPriorityMeta(n);
        const projectLine = n.project_name ? `<span>${esc(n.project_name)}</span>` : `<span>System</span>`;
        const docLine = n.document_name ? `<span>Doc: ${esc(n.document_name)}</span>` : '';
        const stageLine = n.stage ? `<span>Stage: ${esc(n.stage)}</span>` : '';
        const actorDisplay = getNotificationActorDisplay(n);
        const actorLine = fullPage ? `<span>${esc(actorDisplay.label)}: ${esc(actorDisplay.value)}</span>` : '';
        const notificationDate = n.updated_at || n.created_at;
        const absoluteDate = fullPage ? esc(new Date(notificationDate).toLocaleString()) : '';
        const permissionDetails = buildPermissionChangeDetails(n, { fullPage });
        const userDriveDetails = buildUserDriveNotificationDetails(n, { fullPage });
        const isCalendarNotification = String(n.target_kind || '').toLowerCase() === 'calendar_event';
        const isFeedbackNotification = String(n.target_kind || '').toLowerCase() === 'user_feedback';
        const isDeletionRequest = String(n.target_kind || '').toLowerCase() === 'deletion_request' && String(n.type || '').toLowerCase() === 'deletion_request_pending' && Number(n.target_meta?.deletion_request_id || 0);
        const deletionButtons = isDeletionRequest
          ? `<div class="mt-3 flex flex-wrap gap-2">
              <button type="button" onclick="event.stopPropagation(); approveDeletionRequest(${Number(n.target_meta.deletion_request_id)})" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-700 text-white text-xs font-bold hover:bg-green-800 transition">Approve</button>
              <button type="button" onclick="event.stopPropagation(); denyDeletionRequest(${Number(n.target_meta.deletion_request_id)})" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 transition">Deny</button>
            </div>`
          : '';
        const hasNotificationTarget = notificationHasProjectDocumentTarget(n) || isFeedbackNotification;
        const actionButton = hasNotificationTarget
          ? `<button type="button" onclick="event.stopPropagation(); openNotificationTarget(${n.id})" class="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-700 text-white dark:bg-cyan-500 dark:text-gray-950 text-xs font-bold hover:bg-cyan-800 dark:hover:bg-cyan-400 transition">
              ${isFeedbackNotification ? 'Open Submitted Feedback' : esc(notificationTargetLabel(n))}
            </button>${isCalendarNotification && Number(n.project_id || n.target_meta?.related_project_id || 0) ? `<button type="button" onclick="event.stopPropagation(); openNotificationProjectTarget(${n.id})" class="mt-3 ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition">Open Project</button>` : ''}`
          : '';
        return `<div ${hasNotificationTarget ? `onclick="openNotificationTarget(${Number(n.id)})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); openNotificationTarget(${Number(n.id)});}"` : ''} class="w-full text-left border-l-4 ${meta.rail} ${unread ? meta.card : 'bg-white dark:bg-gray-900'} ${hasNotificationTarget ? 'cursor-pointer hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20' : ''} ${fullPage ? 'px-5 py-4' : 'px-4 py-3'}">
          <div class="flex items-start gap-3 ${fullPage ? 'md:gap-4' : ''}">
            <span class="mt-1.5 w-2.5 h-2.5 rounded-full ${unread ? meta.dot : 'bg-gray-300 dark:bg-gray-600'} shrink-0"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="${unread ? 'font-bold text-gray-950 dark:text-gray-50' : 'font-medium text-gray-600 dark:text-gray-300'} ${fullPage ? 'text-base' : 'text-sm'} leading-snug">${esc(normalizeCalendarReminderMessage(n.message))}</div>
                <span class="shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${meta.pill}">${esc(meta.label)}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs ${fullPage ? 'sm:text-sm' : ''} text-gray-500 dark:text-gray-400">
                ${projectLine}
                ${docLine}
                ${stageLine}
                ${actorLine}
              </div>
              <div class="mt-1 flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>${esc(formatNotificationType(n.type))}</span>
                <span class="shrink-0">${fullPage ? absoluteDate : fmtDateRelative(notificationDate)}</span>
              </div>
              ${permissionDetails}
              ${userDriveDetails}
              ${deletionButtons}
              ${actionButton}
            </div>
          </div>
        </div>`;
      }).join('') : `<div class="p-8 text-center text-gray-500 dark:text-gray-400">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>
        <div class="font-semibold text-gray-700 dark:text-gray-200">${showAllNotifications ? 'No notifications yet' : 'No unread notifications'}</div>
        <div class="text-sm mt-1">You're all caught up!</div>
      </div>`;
    }

    function renderNotifications() {
      const html = buildNotificationItemsHtml();
      const pageHtml = buildNotificationItemsHtml({ fullPage: true });
      const list = document.getElementById('notificationList');
      const drawerList = document.getElementById('notificationDrawerList');
      const pageList = document.getElementById('notificationPageList');
      if (list) list.innerHTML = html;
      if (drawerList) drawerList.innerHTML = html;
      if (pageList) pageList.innerHTML = pageHtml;
      const viewAllBtn = document.getElementById('notificationViewAllBtn');
      const drawerViewAllBtn = document.getElementById('notificationDrawerViewAllBtn');
      if (viewAllBtn) viewAllBtn.textContent = 'View All Notifications';
      if (drawerViewAllBtn) drawerViewAllBtn.textContent = 'View All Notifications';
      const loadMoreBtn = document.getElementById('notificationLoadMoreBtn');
      if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !notificationsHasMore || appCurrentView !== 'notifications');
      updateNotificationFilterTabs();
    }

    async function loadNotifications(limit = notificationsLimit) {
      if (!authToken) return;
      try {
        const [items, countData] = await Promise.all([
          fetchJson(`${API}/notifications?limit=${limit}`, { silentLoading: true }),
          fetchJson(`${API}/notifications/unread-count`, { silentLoading: true })
        ]);
        notificationsCache = items || [];
        sortNotificationsCache();
        notificationsHasMore = (items || []).length === limit;
        updateNotificationBadge(countData.count || 0);
        renderNotifications();
      } catch (e) {}
    }

    async function refreshAfterDeletionRequestDecision() {
      await loadNotifications(notificationsLimit);
      await refreshAfterMutation({ refreshNotifications: false, refreshCalendar: true }).catch(() => {});
      if (currentCalendarDetailEvent?.raw_id) {
        await loadCalendarDocumentation(currentCalendarDetailEvent.raw_id, currentCalendarDetailEvent.event_type).catch(() => {});
      }
    }

    async function approveDeletionRequest(id) {
      try {
        await fetchJson(`${API}/deletion-requests/${Number(id)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        toast('Deletion request approved');
        await refreshAfterDeletionRequestDecision();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function denyDeletionRequest(id) {
      try {
        await fetchJson(`${API}/deletion-requests/${Number(id)}/deny`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        toast('Deletion request denied');
        await refreshAfterDeletionRequestDecision();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function loadMoreNotifications() {
      if (!authToken) return;
      try {
        const items = await fetchJson(`${API}/notifications?limit=100&offset=${notificationsCache.length}`, { silentLoading: true });
        (items || []).forEach(item => upsertNotificationCache(item));
        notificationsHasMore = (items || []).length === 100;
        renderNotifications();
      } catch (e) { toast(e.message, 'error'); }
    }

    function startNotificationStream() {
      stopNotificationStream();
      if (!authToken || typeof EventSource === 'undefined') return;
      notificationStream = new EventSource(`${API}/notifications/stream?token=${encodeURIComponent(authToken)}`);
      notificationStream.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data || '{}');
          const result = upsertNotificationCache(notification);
          if (notification.is_update) {
            updateNotificationBadge(Math.max(0, unreadNotificationCount + result.unreadDelta));
          } else {
            updateNotificationBadge(Math.max(0, unreadNotificationCount + result.unreadDelta));
          }
          renderNotifications();
          handleRealtimeNotificationEvent(notification);
        } catch (e) {
          loadNotifications(notificationsLimit);
        }
      });
      notificationStream.onerror = () => {};
    }

    function stopNotificationStream() {
      if (notificationStream) notificationStream.close();
      notificationStream = null;
    }

    function toggleNotificationsPanel() {
      if (typeof closeMobileHeaderMenu === 'function') closeMobileHeaderMenu();
      if (window.matchMedia('(max-width: 767px)').matches) {
        showAllNotifications = false;
        renderNotifications();
        document.getElementById('notificationDrawer').classList.remove('hidden');
        document.getElementById('notificationDrawer').classList.add('flex');
        return;
      }
      const panel = document.getElementById('notificationPanel');
      const willOpen = panel.classList.contains('hidden');
      if (willOpen) {
        showAllNotifications = false;
        renderNotifications();
      }
      panel.classList.toggle('hidden');
      if (!willOpen) clearOverlayHistoryMarker('notificationPanel');
    }

    function closeNotificationDrawer() {
      document.getElementById('notificationDrawer').classList.add('hidden');
      document.getElementById('notificationDrawer').classList.remove('flex');
      clearOverlayHistoryMarker('notificationDrawer');
    }

    function showNotificationsView(pushHistory = true) {
      if (!currentUser) return showAuthView();
      document.getElementById('notificationPanel')?.classList.add('hidden');
      closeNotificationDrawer();
      showAllNotifications = true;
      notificationsLimit = 100;
      navigateTo('notifications', {}, pushHistory);
      renderNotifications();
      loadNotifications(notificationsLimit);
    }

    function openAllNotifications() {
      const drawer = document.getElementById('notificationDrawer');
      const mobileDrawerOpen = drawer && !drawer.classList.contains('hidden');
      if (mobileDrawerOpen) {
        setNotificationFilter('all');
        return;
      }
      document.getElementById('notificationPanel')?.classList.add('hidden');
      clearOverlayHistoryMarker('notificationPanel');
      showNotificationsView(true);
    }

    async function markAllNotificationsRead() {
      try {
        await fetchJson(`${API}/notifications/read-all`, { method: 'PATCH' });
        notificationsCache = notificationsCache.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }));
        updateNotificationBadge(0);
        renderNotifications();
        await loadNotifications(notificationsLimit);
      } catch (e) { toast(e.message, 'error'); }
    }

    async function markNotificationRead(id) {
      const notification = notificationsCache.find(n => Number(n.id) === Number(id));
      if (!notification || notification.read_at) return notification;
      try {
        await fetchJson(`${API}/notifications/${id}/read`, { method: 'PATCH' });
        updateNotificationBadge(Math.max(0, unreadNotificationCount - 1));
        notification.read_at = new Date().toISOString();
        renderNotifications();
        await loadNotifications(notificationsLimit);
      } catch (e) {}
      return notification;
    }

    async function openNotificationTarget(id) {
      const notification = await markNotificationRead(id);
      if (!notification) return;
      const targetKind = String(notification?.target_kind || notification?.targetKind || '').toLowerCase();
      if (targetKind === 'deleted_project' || notification?.target_meta?.deleted) {
        document.getElementById('notificationPanel')?.classList.add('hidden');
        closeNotificationDrawer();
        toast('This project has already been deleted.', 'error');
        return;
      }
      if (targetKind === 'calendar_event') {
        document.getElementById('notificationPanel')?.classList.add('hidden');
        closeNotificationDrawer();
        const eventId = Number(notification?.target_meta?.event_id || 0);
        if (!eventId) return toast('Schedule not found or no longer available.', 'error');
        if (notification?.target_meta?.start_datetime) {
          const start = new Date(notification.target_meta.start_datetime);
          if (!isNaN(start.getTime())) {
            calendarSelectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(start);
            calendarMonth = calendarSelectedDate.slice(0, 7);
          }
        }
        calendarScope = 'my';
        await showCalendarView();
        await openManualCalendarEventById(eventId);
        return;
      }
      if (targetKind === 'monitoring_inventory') {
        document.getElementById('notificationPanel')?.classList.add('hidden');
        closeNotificationDrawer();
        if (!hasPrivilege('view_monitoring_inventory')) return toast('You do not have access to Established Monitoring.', 'error');
        await showMonitoringInventory();
        const inventoryId = Number(notification?.target_meta?.inventory_id || 0);
        if (inventoryId) await openMonitoringDetail(inventoryId);
        return;
      }
      if (targetKind === 'user_drive') {
        await openUserDriveNotificationTarget(notification);
        return;
      }
      if (targetKind === 'user_feedback') {
        if (!isSystemUser()) return toast('System / Maintenance access required.', 'error');
        document.getElementById('notificationPanel')?.classList.add('hidden');
        closeNotificationDrawer();
        await showSettings();
        await switchSettingsSection('changelog');
        setTimeout(() => {
          const target = document.getElementById('submittedFeedbackSection');
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          highlightElement(target, true);
        }, 250);
        return;
      }
      if (['requirements', 'calendar', 'settings', 'system'].includes(targetKind)) {
        document.getElementById('notificationPanel')?.classList.add('hidden');
        closeNotificationDrawer();
        await goToTarget(notification);
        return;
      }
      if (!notificationHasProjectDocumentTarget(notification)) return;
      document.getElementById('notificationPanel')?.classList.add('hidden');
      closeNotificationDrawer();
      await goToTarget(notification);
    }

    async function openUserDriveNotificationTarget(notification) {
      const meta = notification?.target_meta || {};
      const fileId = Number(meta.file_id || 0);
      const folderId = Number(meta.folder_id || 0);
      if (!fileId && !folderId) return toast('Shared Drive item is not available.', 'error');
      if (!hasPrivilege('view_user_drive')) return toast('You do not have access to My Drive.', 'error');
      document.getElementById('notificationPanel')?.classList.add('hidden');
      closeNotificationDrawer();
      const search = document.getElementById('myDriveSearchInput');
      const type = document.getElementById('myDriveTypeFilter');
      const modified = document.getElementById('myDriveModifiedFilter');
      if (search) search.value = '';
      if (type) type.value = '';
      if (modified) modified.value = '';
      myDriveTab = 'shared';
      myDriveFolderId = null;
      clearMyDriveSelection();
      navigateTo('myDrive', {}, true);
      await loadMyDrive();
      const targetKind = folderId ? 'folder' : 'file';
      const targetId = folderId || fileId;
      const item = findMyDriveItem(targetId, targetKind);
      if (!item) return toast('Shared Drive item is not available.', 'error');
      myDriveSelectedItems.set(myDriveSelectionKey(item), item);
      myDriveSelectedItem = item;
      myDriveSelectionAnchor = item;
      updateMyDriveSelectionVisuals();
      renderMyDriveDetailsPanel();
      setTimeout(() => {
        const el = document.querySelector(`#myDriveContent [data-drive-kind="${targetKind}"][data-drive-id="${targetId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }

    async function openNotificationProjectTarget(id) {
      const notification = await markNotificationRead(id);
      if (!notification) return;
      document.getElementById('notificationPanel')?.classList.add('hidden');
      closeNotificationDrawer();
      const meta = notification.target_meta || {};
      const projectId = Number(notification.project_id || meta.related_project_id || 0);
      const documentId = Number(notification.document_id || meta.related_document_id || 0);
      if (!projectId) return toast('Target project is not available.', 'error');
      await goToTarget({
        project_id: projectId,
        document_id: documentId || null,
        stage: meta.document_stage || meta.project_stage || meta.stage || 'Proposal',
        target_kind: documentId ? 'document' : 'project',
        target_type: documentId ? 'document' : 'project'
      });
    }

    function normalizeGoToTarget(target = {}) {
      const projectId = Number(target.project_id || target.projectId || target.id);
      const rawDocumentId = target.document_id || target.documentId || null;
      const documentId = rawDocumentId ? Number(rawDocumentId) : null;

      const stage =
        target.stage ||
        target.target_meta?.stage ||
        target.project_stage ||
        'Proposal';

      let targetKind =
        target.target_kind ||
        target.targetKind ||
        target.target_type ||
        target.targetType ||
        'project';

      let targetType =
        target.target_type ||
        target.targetType ||
        target.target_meta?.target_type ||
        targetKind;

      if (documentId) {
        targetKind = 'document';
      }

      if (
        targetKind === 'overdue' ||
        targetKind === 'dueSoon' ||
        targetKind === 'due_soon' ||
        targetKind === 'project_due' ||
        targetKind === 'project_due_date'
      ) {
        targetKind = 'project_due_date';
      }

      if (
        targetType === 'overdue' ||
        targetType === 'dueSoon' ||
        targetType === 'due_soon' ||
        targetType === 'project_due' ||
        targetType === 'project_due_date'
      ) {
        targetType = targetType === 'dueSoon' ? 'due_soon' : targetType;
      }

      return {
        project_id: Number.isFinite(projectId) ? projectId : null,
        document_id: documentId,
        stage,
        target_kind: targetKind,
        target_type: targetType,
        priority: target.priority || (targetType === 'overdue' ? 'overdue' : 'info'),
        target_meta: {
          ...(target.target_meta || {}),
          stage,
          target_type: targetType
        }
      };
    }

    function saveGoToTargetStateOnly(target) {
      if (!target?.project_id) return;

      const scrollTarget = target.document_id
        ? `document-${target.document_id}`
        : target.target_kind === 'project_due_date'
          ? 'project-due'
          : 'project-header';

      lastDetailScrollTarget = scrollTarget;

      replaceAppHistory('projectDetail', {
        projectId: target.project_id,
        documentId: target.document_id || null,
        stage: target.stage || target.target_meta?.stage || 'Proposal',
        targetKind: target.target_kind || 'project',
        targetType: target.target_type || target.target_meta?.target_type || target.target_kind || 'project',
        scrollTarget
      });
    }

    async function goToTarget(target) {
      const nonProjectTargetKind = target?.target_kind || target?.targetKind;
      if (nonProjectTargetKind === 'monitoring_inventory') {
        if (!hasPrivilege('view_monitoring_inventory')) return false;
        await showMonitoringInventory();
        const inventoryId = Number(target?.target_meta?.inventory_id || 0);
        if (inventoryId) await openMonitoringDetail(inventoryId);
        return true;
      }
      if (['requirements', 'calendar', 'settings', 'system'].includes(nonProjectTargetKind)) {
        return navigateToNotificationTarget(target);
      }

      const normalized = normalizeGoToTarget(target);

      if (!normalized?.project_id) {
        toast('Target project is not available.', 'error');
        return false;
      }

      saveGoToTargetStateOnly(normalized);

      return await openAndHighlightTarget(normalized);
    }
    window.goToTarget = goToTarget;

    async function navigateToNotificationTarget(n) {
      if (!n) return false;
      const targetKind = n.target_kind || n.targetKind;
      if (targetKind === 'requirements') {
        await openRequirementsConfigFromNotification(n);
        return true;
      }
      if (targetKind === 'calendar') {
        const date = n.target_meta?.date || n.alert_date;
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) calendarMonth = date.slice(0, 7);
        showCalendarView();
        if (date) {
          await waitForElement(`[data-calendar-date="${date}"]`, 3200);
          highlightElement(document.querySelector(`[data-calendar-date="${date}"]`), true);
        }
        return true;
      }
      if (targetKind === 'settings' || targetKind === 'system') {
        const section = n.target_meta?.section || (targetKind === 'system' ? 'user-management' : 'requirements');
        const requestId = Number(n.target_meta?.request_id || 0);
        if (section === 'pending-confirmations' && requestId) {
          configurationRequestFilter = 'all';
          configurationRequestHighlightId = requestId;
        }
        await showSettings();
        await switchSettingsSection(section);
        setTimeout(() => {
          const target = requestId ? document.getElementById(`configuration-request-${requestId}`) : document.getElementById(`content-${section || 'user-management'}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightElement(target, true);
        }, 300);
        return true;
      }
      if (targetKind === 'user_feedback') {
        if (!isSystemUser()) return false;
        await showSettings();
        await switchSettingsSection('changelog');
        setTimeout(() => {
          const target = document.getElementById('submittedFeedbackSection');
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          highlightElement(target, true);
        }, 250);
        return true;
      }

      return openAndHighlightTarget(normalizeGoToTarget(n));
    }

    async function openRequirementsConfigFromNotification(n) {
      if (!hasPrivilege('manage_requirements')) {
        toast('Permission denied: manage_requirements', 'error');
        return;
      }
      await showSettings();
      await switchSettingsSection('requirements');
      for (let i = 0; i < 12; i++) {
        if (document.getElementById('reqType') && document.getElementById('reqReq') && document.getElementById('reqStageSelect')) break;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      const meta = n.target_meta || {};
      const typeEl = document.getElementById('reqType');
      const reqEl = document.getElementById('reqReq');
      const stageEl = document.getElementById('reqStageSelect');
      if (typeEl && meta.project_type_id) typeEl.value = String(meta.project_type_id);
      if (reqEl && meta.requestee_id) reqEl.value = String(meta.requestee_id);
      if (stageEl && meta.stage) stageEl.value = meta.stage;
      requirementsConfigCurrentSelection = getRequirementsConfigSelection();
      updateReqSetName();
      await loadConfig({ silentMissingSelection: true });
      setTimeout(() => highlightElement(document.getElementById('reqSetHeaderContainer') || document.getElementById('content-requirements')), 250);
    }

    async function waitForElement(selector, timeoutMs = 2400) {
      if (!selector) return null;
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const candidates = [...document.querySelectorAll(selector)];
        const visible = candidates.find(el => el.offsetParent !== null) || candidates[0];
        if (visible) return visible;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return null;
    }

    function isElementActuallyVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      let node = el;
      while (node && node.nodeType === 1) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        node = node.parentElement;
      }
      return true;
    }

    function findVisibleTarget(selector) {
      const candidates = [...document.querySelectorAll(selector)];

      return candidates.find(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          isElementActuallyVisible(el)
        );
      }) || candidates[0] || null;
    }

    function detailDocumentTargetSelector(documentId) {
      const id = String(documentId || '').replace(/"/g, '\\"');
      return `#detailView:not(.hidden) #documentsTable [data-doc-id="${id}"], #detailView:not(.hidden) #documentsTableMobile [data-doc-id="${id}"]`;
    }

    async function openAndHighlightTarget(target) {
      if (!target?.project_id) return false;

      if (!projCache.length) {
        await loadDash({ silent: true, preservePage: true });
      }

      const projectExists = projCache.some(p => Number(p.id) === Number(target.project_id));
      if (!projectExists) {
        toast('This project is no longer available.', 'error');
        await showDashboard(false);
        return false;
      }

      const targetStage = await resolveTargetStage(target);

      suppressNextOpenDetailRefresh = true;
      suppressNextDetailStageLoad = true;
      await showDetailsAndWait(target.project_id, targetStage, true);

      target.stage = targetStage;
      target.target_meta = {
        ...(target.target_meta || {}),
        stage: targetStage
      };

      if (target.target_kind === 'project_documentation' || target.target_meta?.open_documentation) {
        await openProjectDocumentationViewer(targetStage);
        return true;
      }

      await waitForDetailTarget(target);

      await waitForNextPaint();

      return highlightGoToTarget(target);
    }

    function waitForNextPaint() {
      return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    }

    async function showDetailsAndWait(pid, stage = 'Proposal', pushHistory = true) {
      await showDetails(pid, stage, pushHistory);

      await waitForElement('#detailView:not(.hidden)', 3000);
      await waitForElement('#detailTitle', 3000);

      if (currentProjId !== Number(pid)) {
        currentProjId = Number(pid);
      }

      if (activeDetailStage !== stage) {
        activeDetailStage = stage;
      }

      await switchDetailStage(stage, { replaceHistory: false, silentDocs: true });

      return true;
    }

    async function resolveTargetStage(target) {
      const fallbackStage = target.stage || target.target_meta?.stage || 'Proposal';

      if (!target.document_id) return fallbackStage;

      const localDocsCache = typeof docsCache !== 'undefined' ? docsCache : [];
      const cachedDoc = (window.allDocumentsCache || localDocsCache || []).find(d => Number(d.id) === Number(target.document_id));
      if (cachedDoc?.stage) return cachedDoc.stage;
      if (cachedDoc?.project_stage) return cachedDoc.project_stage;

      return fallbackStage;
    }

    async function waitForDetailTarget(target) {
      if (target.document_id) {
        await waitForElement(detailDocumentTargetSelector(target.document_id), 6000);
        return true;
      }

      if (target.target_kind === 'project_due_date') {
        await waitForElement('#projectDueDateTarget, #detailDates, #detailTitle', 3000);
        return true;
      }

      if (target.target_kind === 'remarks') {
        await waitForElement('#detailRemarksContainer, #detailTitle', 3000);
        return true;
      }

      await waitForElement('#detailTitle', 3000);
      return true;
    }

    function highlightGoToTarget(target) {
      let el = null;

      if (target.document_id) {
        el = findVisibleTarget(detailDocumentTargetSelector(target.document_id));
      } else if (target.target_kind === 'project_due_date') {
        el =
          document.getElementById('projectDueDateTarget') ||
          document.getElementById('detailDates') ||
          document.getElementById('detailTitle');
      } else if (target.target_kind === 'remarks') {
        el =
          document.getElementById('detailRemarksContainer') ||
          document.getElementById('detailTitle');
      } else {
        el =
          document.getElementById('detailTitle') ||
          document.getElementById('detailDates');
      }

      if (!el) {
        toast('Target item is no longer available.', 'error');
        return false;
      }

      highlightElement(el, true);
      return true;
    }

    function getStickyScrollOffset() {
      const header = document.querySelector('header');
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      return headerHeight + (window.innerWidth < 768 ? 18 : 12);
    }

    function findScrollParent(el) {
      let node = el?.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const canScroll = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
        if (canScroll) return node;
        node = node.parentElement;
      }
      return null;
    }

    function scrollTargetIntoView(el, behavior = 'smooth') {
      if (!el) return;
      const offset = getStickyScrollOffset();
      const scrollParent = findScrollParent(el);
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const childRect = el.getBoundingClientRect();
        scrollParent.scrollTo({
          top: scrollParent.scrollTop + childRect.top - parentRect.top - 24,
          behavior
        });
      }
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const targetTop = Math.max(0, window.pageYOffset + rect.top - offset);
        window.scrollTo({ top: targetTop, behavior });
      });
    }

    window.addEventListener('beforeunload', () => {
      if (currentUser) saveAppStateToSession(buildAppHistoryState(appCurrentView || 'dashboard'));
    });

    function highlightElement(el, strong = false) {
      if (!el) return;
      scrollTargetIntoView(el);
      const originalBg = el.style.backgroundColor;
      const originalTransition = el.style.transition;
      el.style.backgroundColor = strong ? 'rgba(191, 219, 254, 0.82)' : 'rgba(219, 234, 254, 0.95)';
      el.style.transition = 'background-color 0.25s ease, outline-color 0.25s ease';
      el.classList.add('notification-target-highlight');
      setTimeout(() => {
        el.style.backgroundColor = originalBg;
        el.style.transition = originalTransition;
        el.classList.remove('notification-target-highlight');
      }, 4200);
    }

    document.addEventListener('click', (event) => {
      const panel = document.getElementById('notificationPanel');
      const entry = document.getElementById('notificationEntry');
      if (!panel || panel.classList.contains('hidden')) return;
      if (entry && !entry.contains(event.target)) {
        panel.classList.add('hidden');
        clearOverlayHistoryMarker('notificationPanel');
      }
    });

    function startLiveRefresh() {
      stopLiveRefresh();
      if (!authToken) return;
      liveRefreshTimer = setInterval(() => queueSmartRefresh('periodic'), SMART_REFRESH_INTERVAL_MS);
    }

    function stopLiveRefresh() {
      if (liveRefreshTimer) clearInterval(liveRefreshTimer);
      liveRefreshTimer = null;
      liveRefreshInFlight = false;
    }

    function isSessionExpiredModalOpen() {
      const modal = document.getElementById('sessionExpiredModal');
      return !!modal && !modal.classList.contains('hidden');
    }

    function handleLocalSessionIdleExpiry() {
      if (!authToken || isSessionExpiredModalOpen()) return;
      clearAuthState();
      showAuthView(false);
      history.replaceState(buildAppHistoryState('login'), '', location.href);
      openSessionExpiredModal();
    }

    function handleServerSessionUnauthorized(code) {
      const showExpiredModal = code === 'SESSION_INACTIVITY_EXPIRED';
      clearAuthState();
      showAuthView(false);
      history.replaceState(buildAppHistoryState('login'), '', location.href);
      if (showExpiredModal) openSessionExpiredModal();
    }

    function syncStoredPageActivity() {
      try {
        const stored = Number(localStorage.getItem('abedLastPageActivityAt') || 0);
        if (stored > lastPageActivityAt) lastPageActivityAt = stored;
      } catch (e) {}
    }

    async function sendPageActivityHeartbeat({ force = false } = {}) {
      if (!authToken || sessionHeartbeatInFlight || document.hidden) return;
      const requestAuthToken = authToken;
      const now = Date.now();
      syncStoredPageActivity();
      if (!force && now - lastSessionHeartbeatAt < SESSION_ACTIVITY_HEARTBEAT_MS) return;
      if (now - lastPageActivityAt >= SESSION_INACTIVITY_LIMIT_MS) return handleLocalSessionIdleExpiry();
      sessionHeartbeatInFlight = true;
      try {
        const response = await fetch(`${API}/auth/activity`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${requestAuthToken}` },
          keepalive: true
        });
        if (response.status === 401 && requestAuthToken === authToken) {
          const data = await response.json().catch(() => ({}));
          handleServerSessionUnauthorized(data.code);
          return;
        }
        if (response.ok) lastSessionHeartbeatAt = now;
      } catch (e) {
      } finally {
        sessionHeartbeatInFlight = false;
      }
    }

    function notePageActivity() {
      if (!authToken || isSessionExpiredModalOpen()) return;
      const now = Date.now();
      syncStoredPageActivity();
      if (now - lastPageActivityAt >= SESSION_INACTIVITY_LIMIT_MS) return handleLocalSessionIdleExpiry();
      lastPageActivityAt = now;
      if (now - lastPageActivityStoredAt > 15000) {
        lastPageActivityStoredAt = now;
        try { localStorage.setItem('abedLastPageActivityAt', String(now)); } catch (e) {}
      }
      sendPageActivityHeartbeat();
    }

    function checkPageInactivity() {
      if (!authToken || isSessionExpiredModalOpen()) return;
      syncStoredPageActivity();
      if (Date.now() - lastPageActivityAt >= SESSION_INACTIVITY_LIMIT_MS) handleLocalSessionIdleExpiry();
    }

    function startSessionActivityTracking() {
      if (!authToken) return;
      const now = Date.now();
      lastPageActivityAt = now;
      lastPageActivityStoredAt = now;
      lastSessionHeartbeatAt = 0;
      try { localStorage.setItem('abedLastPageActivityAt', String(now)); } catch (e) {}
      if (sessionActivityTimer) clearInterval(sessionActivityTimer);
      sessionActivityTimer = setInterval(checkPageInactivity, SESSION_ACTIVITY_CHECK_MS);
      sendPageActivityHeartbeat({ force: true });
    }

    function stopSessionActivityTracking({ clearSharedActivity = true } = {}) {
      if (sessionActivityTimer) clearInterval(sessionActivityTimer);
      sessionActivityTimer = null;
      sessionHeartbeatInFlight = false;
      lastSessionHeartbeatAt = 0;
      if (clearSharedActivity) {
        try { localStorage.removeItem('abedLastPageActivityAt'); } catch (e) {}
      }
    }

    ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(eventName => {
      window.addEventListener(eventName, notePageActivity, { passive: true, capture: true });
    });

    function isProjectOrDocumentNotification(notification) {
      const kind = String(notification?.target_kind || '').toLowerCase();
      const type = String(notification?.type || '').toLowerCase();
      return !!notification?.project_id || !!notification?.document_id || ['project', 'document', 'stage', 'remarks', 'due_date', 'project_due_date', 'requirement'].includes(kind) || type.includes('project') || type.includes('document');
    }

    function isViewVisible(viewId) {
      const el = document.getElementById(viewId);
      return !!el && !el.classList.contains('hidden');
    }

    function isBlockingOverlayOpen() {
      if (typeof OVERLAY_IDS === 'undefined') return false;
      return OVERLAY_IDS.some(id => {
        const el = document.getElementById(id);
        if (!el || el.classList.contains('hidden')) return false;
        if (id === 'notificationPanel' || id === 'notificationDrawer') return false;
        return true;
      });
    }

    function notificationAction(notification) {
      return String(notification?.event_action || notification?.target_meta?.event_action || notification?.type || '').toLowerCase();
    }

    function notificationStage(notification) {
      return notification?.stage || notification?.target_meta?.stage || notification?.target_meta?.source_stage || notification?.target_meta?.target_stage || '';
    }

    function notificationMatchesCurrentProject(notification) {
      return !!currentProjId && Number(notification?.project_id) === Number(currentProjId);
    }

    function notificationAffectsProjectHeader(notification) {
      const action = notificationAction(notification);
      const kind = String(notification?.target_kind || '').toLowerCase();
      return [
        'project_created',
        'project_updated',
        'project_deleted',
        'project_assignment_changed',
        'document_uploaded',
        'document_deleted',
        'document_checked',
        'document_requirement_changed',
        'document_assignment_changed',
        'stage_transitioned',
        'due_date_changed'
      ].some(token => action.includes(token))
        || ['project', 'stage', 'remarks', 'project_due_date', 'due_date'].includes(kind);
    }

    function notificationAffectsDocuments(notification) {
      const action = notificationAction(notification);
      const kind = String(notification?.target_kind || '').toLowerCase();
      return !!notification?.document_id
        || ['document', 'requirement', 'due_date'].includes(kind)
        || action.includes('document_')
        || action.includes('requirement')
        || action.includes('due_date');
    }

    function notificationAffectsCalendar(notification) {
      const action = notificationAction(notification);
      const kind = String(notification?.target_kind || '').toLowerCase();
      return ['due_date', 'project_due_date', 'calendar', 'calendar_event'].includes(kind)
        || [
          'document_uploaded',
          'document_deleted',
          'document_checked',
          'document_assignment_changed',
          'project_assignment_changed',
          'stage_transitioned',
          'due_date_changed',
          'project_updated'
        ].some(token => action.includes(token));
    }

    async function handleRealtimeNotificationEvent(notification) {
      if (!authToken || !notification) return;
      if (notification.type === 'system_permission_changed') {
        await refreshCurrentUserPrivileges({ silent: true });
      }
      if (!isProjectOrDocumentNotification(notification) && !notificationAffectsCalendar(notification)) return;
      if (document.hidden || uploadInProgress || printViewOpen || heavyOperationInProgress || isUserEditing() || isBlockingOverlayOpen()) return;

      const detailOpen = isViewVisible('detailView') && notificationMatchesCurrentProject(notification);
      const dashboardOpen = isViewVisible('dashboardView');
      const calendarOpen = isViewVisible('calendarView');

      try {
        if (detailOpen) {
          const eventStage = notificationStage(notification);
          const stageMatches = !eventStage || eventStage === activeDetailStage || notification?.target_meta?.target_stage === activeDetailStage || notification?.target_meta?.source_stage === activeDetailStage;
          if (notificationAffectsDocuments(notification) && stageMatches) {
            await loadDocs(currentProjId, activeDetailStage, { silent: true });
          }
          if (notificationAffectsProjectHeader(notification)) {
            await loadDash({ silent: true, preservePage: true });
            const project = projCache.find(p => Number(p.id) === Number(currentProjId));
            if (project) {
              renderProjectDetailHeader(project);
              renderTransitionButton();
            }
          }
          return;
        }

        if (dashboardOpen && (isProjectOrDocumentNotification(notification) || notificationAffectsCalendar(notification))) {
          await loadDash({ silent: true, preservePage: true });
          return;
        }

        if (calendarOpen && notificationAffectsCalendar(notification)) {
          await loadCalendarView({ silent: true });
        }
      } catch (e) {
        if (detailOpen && currentProjId) {
          await loadDocs(currentProjId, activeDetailStage, { silent: true }).catch(() => {});
        } else if (dashboardOpen) {
          await loadDash({ silent: true, preservePage: true }).catch(() => {});
        } else if (calendarOpen) {
          await loadCalendarView({ silent: true }).catch(() => {});
        }
      }
    }

    function isUserEditing() {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName;
      const isTextEntry = tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
      if (!isTextEntry) return false;
      return !!active.closest('.fixed, form, #settingsView');
    }

    function canSmartRefresh(reason = 'manual') {
      if (!authToken || liveRefreshInFlight) return false;
      if (document.hidden) return false;
      if (uploadInProgress || printViewOpen || heavyOperationInProgress) return false;
      if (isUserEditing() || isBlockingOverlayOpen()) return false;
      return true;
    }

    function queueSmartRefresh(reason = 'periodic') {
      if (!canSmartRefresh(reason)) return;
      if (reason === 'periodic' && Date.now() - lastVisibleRefreshAt < SMART_REFRESH_INTERVAL_MS - 1000) return;
      refreshVisibleData({ reason });
    }

    async function refreshVisibleData({ reason = 'periodic' } = {}) {
      if (!canSmartRefresh(reason)) return;
      liveRefreshInFlight = true;
      try {
        await loadNotifications(notificationsLimit);
        if (!document.getElementById('dashboardView').classList.contains('hidden')) {
          await loadDash({ silent: true, preservePage: true });
        } else if (!document.getElementById('detailView').classList.contains('hidden') && currentProjId) {
          await loadDash({ silent: true, preservePage: true });
          renderProjectDetailHeader(projCache.find(p => Number(p.id) === Number(currentProjId)));
          await loadDocs(currentProjId, activeDetailStage, { silent: true });
        } else if (!document.getElementById('reviewView').classList.contains('hidden')) {
          await loadReviewDocuments({ silent: true });
          renderReviewDocumentsPage();
        } else if (!document.getElementById('myDriveView').classList.contains('hidden')) {
          await loadMyDrive({ quiet: true });
        } else if (!document.getElementById('calendarView').classList.contains('hidden')) {
          await loadCalendarView({ silent: true });
        } else if (!document.getElementById('settingsView').classList.contains('hidden') && activeSettingsSection) {
          await switchSettingsSection(activeSettingsSection);
        }
      } catch (e) {
      } finally {
        lastVisibleRefreshAt = Date.now();
        liveRefreshInFlight = false;
      }
    }

    async function refreshAfterMutation({
      projectId = null,
      documentId = null,
      refreshDashboard = true,
      refreshDetails = true,
      refreshDocuments = true,
      refreshCalendar = true,
      refreshNotifications = true,
      refreshWorkPanels = true,
      refreshWorkload = true,
      preserveView = true,
      targetStage = null,
      silent = true
    } = {}) {
      const detailVisible = isViewVisible('detailView');
      const dashboardVisible = isViewVisible('dashboardView');
      const reviewVisible = isViewVisible('reviewView');
      const calendarVisible = isViewVisible('calendarView');
      const settingsVisible = isViewVisible('settingsView');
      const changedProjectId = projectId ? Number(projectId) : null;
      const detailProjectMatches = detailVisible && currentProjId && (!changedProjectId || Number(currentProjId) === changedProjectId);
      const fetchOptions = { silent, preservePage: true };

      if (refreshWorkload) workloadCache = null;

      if (refreshDashboard) {
        await loadDash(fetchOptions);
      } else if (refreshWorkPanels) {
        renderOwnershipWorkPanel();
      }

      if (reviewVisible) {
        await loadReviewDocuments({ silent });
        renderReviewDocumentsPage();
      } else {
        await loadReviewDocuments({ silent: true });
      }

      if (refreshDetails && detailProjectMatches) {
        const nextStage = targetStage || activeDetailStage || 'Proposal';
        const project = projCache.find(p => Number(p.id) === Number(currentProjId));
        if (project) {
          renderProjectDetailHeader(project);
          renderTransitionButton();
          if (refreshDocuments) {
            await switchDetailStage(nextStage, { silentDocs: silent, replaceHistory: preserveView });
          } else if (targetStage && targetStage !== activeDetailStage) {
            activeDetailStage = targetStage;
          }
        }
      }

      if (refreshWorkPanels && !dashboardVisible) {
        renderOwnershipWorkPanel();
      }

      if (refreshWorkload) {
        const dashboardWorkloadVisible = dashboardVisible && ['my', 'global'].includes(activeWorkPanel) && workQueueFilter === 'workload';
        if (dashboardWorkloadVisible && !refreshDashboard) await renderDashboardWorkload();
        if (settingsVisible && activeSettingsSection === 'workload-analytics') {
          await loadWorkloadAnalyticsData();
        }
      }

      if (refreshCalendar && calendarVisible) {
        await loadCalendarView(silent ? { silent: true } : {});
      }

      if (refreshNotifications) {
        await loadNotifications(notificationsLimit);
      }
    }

    window.addEventListener('focus', () => {
      notePageActivity();
      queueSmartRefresh('focus');
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        notePageActivity();
        queueSmartRefresh('visible');
      }
    });

    function dismissToast(el) {
      if (!el || el.dataset.dismissing === '1') return;
      el.dataset.dismissing = '1';
      if (el._toastTimer) clearTimeout(el._toastTimer);
      el.style.transition = 'transform 220ms ease, opacity 220ms ease';
      const direction = Number(el.dataset.swipeDirection || 1);
      el.style.transform = `translateX(${direction * 120}%)`;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 240);
    }

    function dismissAllToasts() {
      document.querySelectorAll('#toastContainer .toast').forEach(dismissToast);
    }

    function attachToastDismissHandlers(el) {
      if (!el || el.dataset.dismissHandlersAttached === '1') return;
      el.dataset.dismissHandlersAttached = '1';
      let startX = 0, startY = 0, currentX = 0, swiping = false;
      el.addEventListener('touchstart', (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        startX = currentX = touch.clientX;
        startY = touch.clientY;
        swiping = false;
        el.style.transition = '';
      }, { passive: true });
      el.addEventListener('touchmove', (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (!swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) swiping = true;
        if (!swiping) return;
        currentX = touch.clientX;
        el.dataset.swipeDirection = dx < 0 ? -1 : 1;
        el.style.transform = `translateX(${dx}px)`;
        el.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / Math.max(160, el.offsetWidth)));
      }, { passive: true });
      el.addEventListener('touchend', () => {
        if (!swiping) return;
        const dx = currentX - startX;
        const threshold = Math.min(Math.max(el.offsetWidth * 0.35, 80), 160);
        if (Math.abs(dx) >= threshold) return dismissToast(el);
        el.style.transition = 'transform 180ms ease, opacity 180ms ease';
        el.style.transform = '';
        el.style.opacity = '1';
      }, { passive: true });
    }

    function toast(m, t='success') {
      const c=document.getElementById('toastContainer'); const el=document.createElement('div');
      if (!c) return;
      c.querySelectorAll('.toast').forEach(existing => {
        if (existing._toastTimer) clearTimeout(existing._toastTimer);
        existing.remove();
      });
      el.className=`toast pointer-events-auto bg-gray-800 dark:bg-gray-700 border border-gray-700 dark:border-gray-600 shadow-xl rounded-r-lg ${t==='success'?'border-l-4 border-l-green-500':'border-l-4 border-l-red-500'} p-4 flex items-center gap-3 min-w-[320px] transform -translate-x-full opacity-0 transition-all duration-500`;
      el.innerHTML=`${t==='success'?'<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>':'<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'}<span class="text-sm font-medium text-white">${esc(m)}</span>`;
      c.appendChild(el);
      attachToastDismissHandlers(el);
      requestAnimationFrame(()=>el.classList.remove('-translate-x-full','opacity-0'));
      el._toastTimer = setTimeout(()=>dismissToast(el),4000);
    }
    const APP_VIEW_IDS = {
      login: 'loginView',
      dashboard: 'dashboardView',
      review: 'reviewView',
      myDrive: 'myDriveView',
      map: 'mapPage',
      monitoring: 'monitoringInventoryView',
      calendar: 'calendarView',
      notifications: 'notificationsView',
      settings: 'settingsView',
      projectDetail: 'detailView'
    };
    const APP_STATE_STORAGE_KEY = 'abedSessionAppState';
    const OVERLAY_IDS = [
      'confirmModal',
      'projectModal',
      'uploadModal',
      'projectDocumentationUploadModal',
      'projectDocumentationViewerModal',
      'projectDocumentationPreviewModal',
      'fileViewerModal',
      'stageEditAccessModal',
      'logoutConfirmModal',
      'sessionExpiredModal',
      'manualDueDateModal',
      'monitoringDocModal',
      'monitoringInventoryFormModal',
      'monitoringTaskModal',
      'monitoringScheduleModal',
      'monitoringVisitModal',
      'monitoringDetailModal',
      'editModal',
      'editDueScheduleModal',
      'createUserModal',
      'editUserModal',
      'assignmentPickerModal',
      'calendarDetailModal',
      'calendarEventModal',
      'calendarEventDetailModal',
      'calendarNoteModal',
      'requirementStateModal',
      'dashboardFilterDrawer',
      'notificationDrawer',
      'notificationPanel',
      'settingsDrawer',
      'printPreviewOverlay'
    ];

    document.addEventListener('click', (event) => {
      if (event.target.closest('#toastContainer .toast')) return;
      const insideVisibleOverlay = OVERLAY_IDS.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden') && el.contains(event.target);
      });
      if (!insideVisibleOverlay) dismissAllToasts();
    }, true);

    function closeModal(id){
      document.getElementById(id)?.classList.add('hidden');
      clearOverlayHistoryMarker(id);
    }
    function hideViews(){Object.values(APP_VIEW_IDS).forEach(v=>document.getElementById(v)?.classList.add('hidden'));}

    function collectRequirementsConfigState() {
      return {
        projectTypeId: document.getElementById('reqType')?.value || '',
        requesteeId: document.getElementById('reqReq')?.value || '',
        stage: document.getElementById('reqStageSelect')?.value || 'Proposal'
      };
    }

    function collectSettingsState() {
      return {
        section: activeSettingsSection || 'appearance',
        searchText: document.getElementById('settingsSearch')?.value || '',
        requirementsConfig: collectRequirementsConfigState()
      };
    }

    function collectCalendarState() {
      const selectedType = document.getElementById('calendarTypeFilter')?.value || '';
      return {
        month: calendarMonth,
        selectedDate: calendarSelectedDate,
        scope: calendarScope,
        viewMode: calendarDisplayView,
        searchText: document.getElementById('calendarSearchInput')?.value || '',
        typeFilter: selectedType,
        myCalendarExpanded: true,
        myCalendarFilters: {
          deadlines: selectedType !== 'meeting',
          meetings: selectedType !== 'project_deadlines'
        },
        selectedUserIds: selectedCalendarUsers.map(user => Number(user.id)).filter(Boolean),
        sidebarCollapsed: calendarSidebarCollapsed,
        quickFilter: {
          expandedGroup: calendarQuickFilterState.expandedGroup || null,
          selectedTypes: {
            my: [...(calendarQuickFilterState.selectedTypes?.my || [])],
            abe: [...(calendarQuickFilterState.selectedTypes?.abe || [])]
          }
        }
      };
    }

    function getCurrentScrollState() {
      return { x: window.scrollX || 0, y: window.scrollY || 0 };
    }

    function saveAppStateToSession(state = buildAppHistoryState(appCurrentView || 'dashboard')) {
      if (!currentUser || state.view === 'login') return;
      try {
        const payload = JSON.stringify({
          ...state,
          scroll: getCurrentScrollState(),
          savedAt: Date.now()
        });
        sessionStorage.setItem(APP_STATE_STORAGE_KEY, payload);
        localStorage.setItem(APP_STATE_STORAGE_KEY, payload);
      } catch (e) {}
    }

    function readAppStateFromSession() {
      try {
        const raw = sessionStorage.getItem(APP_STATE_STORAGE_KEY) || localStorage.getItem(APP_STATE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function getRestoreAppState() {
      const historyState = history.state?.abed && history.state.view !== 'login' ? history.state : null;
      const sessionState = readAppStateFromSession();
      if (!historyState) return sessionState;
      if (!sessionState?.view || sessionState.view === 'login') return historyState;
      return Number(sessionState.savedAt || 0) >= Number(historyState.savedAt || 0) ? sessionState : historyState;
    }

    function restoreScrollState(state) {
      const scroll = state?.scroll;
      if (!scroll) return;
      setTimeout(() => window.scrollTo(scroll.x || 0, scroll.y || 0), 120);
    }

    async function restoreCalendarState(state = {}) {
      const calendarState = state.calendarState || {
        month: state.calendarMonth,
        scope: state.calendarScope
      };
      if (calendarState.month) calendarMonth = calendarState.month;
      if (calendarState.selectedDate) {
        calendarSelectedDate = calendarState.selectedDate;
        calendarSelectedDateKeys = new Set([calendarSelectedDate]);
      }
      else if (calendarState.month && (!calendarSelectedDate || calendarSelectedDate.slice(0, 7) !== calendarState.month)) {
        calendarSelectedDate = `${calendarState.month}-01`;
        calendarSelectedDateKeys = new Set([calendarSelectedDate]);
      }
      if (calendarState.scope) calendarScope = normalizeCalendarScopeValue(calendarState.scope);
      if (calendarState.viewMode) calendarDisplayView = ['month', 'week', 'day', 'agenda'].includes(calendarState.viewMode) ? calendarState.viewMode : 'month';
      calendarSidebarCollapsed = Object.prototype.hasOwnProperty.call(calendarState, 'sidebarCollapsed') ? !!calendarState.sidebarCollapsed : false;
      if (calendarState.quickFilter) {
        const group = ['my', 'abe'].includes(calendarState.quickFilter.expandedGroup) ? calendarState.quickFilter.expandedGroup : null;
        calendarQuickFilterState = {
          expandedGroup: group,
          selectedTypes: {
            my: Array.isArray(calendarState.quickFilter.selectedTypes?.my) ? calendarState.quickFilter.selectedTypes.my : [...ALL_MY_TYPE_KEYS],
            abe: Array.isArray(calendarState.quickFilter.selectedTypes?.abe) ? calendarState.quickFilter.selectedTypes.abe : [...ALL_ABE_TYPE_KEYS]
          }
        };
        if (group) calendarScope = group;
      }

      const searchInput = document.getElementById('calendarSearchInput');
      const typeSelect = document.getElementById('calendarTypeFilter');
      if (searchInput) searchInput.value = calendarState.searchText || '';
      if (typeSelect) typeSelect.value = calendarState.typeFilter || '';

      const selectedIds = [...new Set((calendarState.selectedUserIds || []).map(Number).filter(Boolean))];
      if (selectedIds.length) {
        const users = await ensureCalendarUsers();
        const byId = new Map((users || []).map(user => [Number(user.id), user]));
        selectedCalendarUsers = selectedIds.map(id => byId.get(id)).filter(Boolean);
      } else {
        selectedCalendarUsers = [];
      }
      calendarUserSearchOpen = false;
      renderCalendarUserSearch();
    }

    function restoreSettingsState(state = {}) {
      const settingsState = state.settingsState || {};
      const searchInput = document.getElementById('settingsSearch');
      if (searchInput) {
        searchInput.value = settingsState.searchText || '';
        filterSettingsMenu();
      }
    }

    function collectMyDriveState() {
      return {
        tab: myDriveTab || 'mine',
        folderId: myDriveFolderId ? Number(myDriveFolderId) : null,
        mode: myDriveMode || 'grid',
        detailsOpen: !!myDriveDetailsOpen,
        sortBy: myDriveSortBy || 'name',
        sortDir: myDriveSortDir || 'asc',
        foldersFirst: !!myDriveFoldersFirst,
        searchText: document.getElementById('myDriveSearchInput')?.value || '',
        typeFilter: currentMyDriveTypeFilter(),
        modifiedFilter: currentMyDriveModifiedFilter()
      };
    }

    function restoreMyDriveState(state = {}) {
      const myDriveState = state.myDriveState || {};
      myDriveTab = ['mine', 'shared', 'trash'].includes(myDriveState.tab) ? myDriveState.tab : 'mine';
      myDriveFolderId = myDriveState.folderId ? Number(myDriveState.folderId) : null;
      myDriveMode = myDriveState.mode === 'list' ? 'list' : 'grid';
      myDriveDetailsOpen = !!myDriveState.detailsOpen;
      myDriveSortBy = myDriveState.sortBy || 'name';
      myDriveSortDir = myDriveState.sortDir === 'desc' ? 'desc' : 'asc';
      myDriveFoldersFirst = Object.prototype.hasOwnProperty.call(myDriveState, 'foldersFirst') ? !!myDriveState.foldersFirst : true;
      const searchInput = document.getElementById('myDriveSearchInput');
      const typeFilter = document.getElementById('myDriveTypeFilter');
      const modifiedFilter = document.getElementById('myDriveModifiedFilter');
      if (searchInput) searchInput.value = myDriveState.searchText || '';
      if (typeFilter) typeFilter.value = myDriveState.typeFilter || '';
      if (modifiedFilter) modifiedFilter.value = myDriveState.modifiedFilter || '';
    }

    function collectDashboardState() {
      return {
        search: document.getElementById('searchInput')?.value ?? dashboardSavedFilters.search,
        requestee: document.getElementById('filterRequestee')?.value ?? dashboardSavedFilters.requestee,
        type: document.getElementById('filterType')?.value ?? dashboardSavedFilters.type,
        outcome: document.getElementById('filterOutcome')?.value ?? dashboardSavedFilters.outcome,
        sort: document.getElementById('sortOrder')?.value ?? dashboardSavedFilters.sort,
        stage: dashboardStageFilter,
        page: dashboardPage,
        activeWorkPanel,
        workQueueFilter
      };
    }

    function applyDashboardState(state = {}) {
      dashboardSavedFilters = {
        search: state.search ?? dashboardSavedFilters.search ?? '',
        requestee: state.requestee ?? dashboardSavedFilters.requestee ?? 'All',
        type: state.type ?? dashboardSavedFilters.type ?? 'All',
        outcome: state.outcome ?? dashboardSavedFilters.outcome ?? 'Active',
        sort: state.sort ?? dashboardSavedFilters.sort ?? 'created'
      };
      dashboardOutcomeFilter = dashboardSavedFilters.outcome || 'Active';
      dashboardStageFilter = state.stage || dashboardStageFilter || 'All';
      dashboardPage = Number(state.page || dashboardPage || 1);
      activeWorkPanel = state.activeWorkPanel || null;
      workQueueFilter = state.workQueueFilter || workQueueFilter || 'active';
    }

    function buildAppHistoryState(view, options = {}) {
      const dashboardState = options.dashboardState || collectDashboardState();
      const state = {
        abed: true,
        view,
        dashboardState,
        myDriveState: collectMyDriveState(),
        calendarMonth,
        calendarScope,
        calendarState: collectCalendarState(),
        settingsSection: activeSettingsSection,
        settingsState: collectSettingsState(),
        scrollTarget: options.scrollTarget || lastDetailScrollTarget || null
      };
      if (view === 'projectDetail') {
        state.projectId = Number(options.projectId || currentProjId);
        state.stage = options.stage || activeDetailStage || 'Proposal';
        state.documentId = options.documentId || null;
        state.targetKind = options.targetKind || null;
        state.targetType = options.targetType || null;
      }
      if (view === 'settings') {
        state.settingsSection = options.section || activeSettingsSection || 'appearance';
        state.settingsState = {
          ...collectSettingsState(),
          section: state.settingsSection
        };
        if (state.settingsSection === 'requirements') state.requirementsConfig = state.settingsState.requirementsConfig;
      }
      if (view === 'calendar') {
        state.calendarState = {
          ...collectCalendarState(),
          month: options.month || calendarMonth,
          scope: options.scope || calendarScope
        };
        state.calendarMonth = state.calendarState.month;
        state.calendarScope = state.calendarState.scope;
      }
      if (view === 'myDrive') {
        state.myDriveState = {
          ...collectMyDriveState(),
          ...(options.myDriveState || {})
        };
      }
      state.key = appHistoryKey(state);
      return state;
    }

    function appHistoryKey(state = {}) {
      const drive = state.myDriveState || {};
      return [state.view || 'login', state.projectId || '', state.stage || '', state.settingsSection || '', state.calendarMonth || '', state.calendarScope || '', drive.tab || '', drive.folderId || ''].join(':');
    }

    function updateAppHistory(view, options = {}, pushHistory = true) {
      const state = buildAppHistoryState(view, options);
      state.savedAt = Date.now();
      appCurrentView = view;
      if (restoringHistoryState) return;
      const current = history.state && history.state.abed ? history.state : null;
      if (!pushHistory) {
        history.replaceState(state, '', location.href);
        saveAppStateToSession(state);
        return;
      }
      if (!current) {
        history.replaceState(state, '', location.href);
        saveAppStateToSession(state);
        return;
      }
      if (current.key === state.key && !current.overlay) {
        history.replaceState(state, '', location.href);
        saveAppStateToSession(state);
        return;
      }
      history.pushState(state, '', location.href);
      saveAppStateToSession(state);
    }

    function replaceAppHistory(view = appCurrentView, options = {}) {
      const state = buildAppHistoryState(view, options);
      state.savedAt = Date.now();
      history.replaceState(state, '', location.href);
      saveAppStateToSession(state);
    }

    function persistCurrentAppState(options = {}) {
      if (!currentUser || restoringHistoryState || appCurrentView === 'login') return;
      replaceAppHistory(appCurrentView, options);
    }

    function navigateTo(view, options = {}, pushHistory = true) {
      if (Number(currentUser?.must_change_password) === 1
          && !(view === 'settings' && options.section === 'change-password')) {
        view = 'settings';
        options = { section: 'change-password' };
        pushHistory = false;
      }
      if (appCurrentView === 'map' && view !== 'map') window.resetAbearcMapThumbnailMoves?.();
      hideViews();
      if (view !== 'dashboard') {
        activeWorkPanel = null;
        setDashboardMainMode(false);
        document.getElementById('ownershipWorkPanel')?.classList.add('hidden');
      }
      const id = APP_VIEW_IDS[view] || APP_VIEW_IDS.dashboard;
      document.getElementById(id)?.classList.remove('hidden');
      appCurrentView = view;
      document.body.classList.toggle('calendar-page-active', view === 'calendar');
      document.body.classList.toggle('map-page-active', view === 'map');
      syncSidebarActiveForView(view, options);
      updateAppHistory(view, options, pushHistory);
    }

    function isOverlayVisible(id) {
      const el = document.getElementById(id);
      if (!el) return false;
      if (id === 'settingsDrawer') return el.classList.contains('open');
      if (id === 'notificationDrawer') return !el.classList.contains('hidden');
      if (id === 'notificationPanel') return !el.classList.contains('hidden');
      if (id === 'dashboardFilterDrawer') return !el.classList.contains('hidden');
      return !el.classList.contains('hidden');
    }

    function pushOverlayHistory(id) {
      if (suppressOverlayHistory || restoringHistoryState || !currentUser) return;
      const current = history.state && history.state.abed ? history.state : buildAppHistoryState(appCurrentView || 'dashboard');
      if (current.overlay === id) return;
      history.pushState({ ...current, overlay: id, key: `${current.key || appHistoryKey(current)}:overlay:${id}` }, '', location.href);
    }

    function clearOverlayHistoryMarker(id) {
      const current = history.state;
      if (!current?.abed || current.overlay !== id || suppressOverlayHistory) return;
      const next = { ...current };
      delete next.overlay;
      next.key = appHistoryKey(next);
      history.replaceState(next, '', location.href);
    }

    function closeOverlayById(id) {
      suppressOverlayHistory = true;
      try {
        if (id === 'settingsDrawer') closeMobileSettingsDrawer();
        else if (id === 'notificationDrawer') closeNotificationDrawer();
        else if (id === 'notificationPanel') document.getElementById('notificationPanel')?.classList.add('hidden');
        else if (id === 'dashboardFilterDrawer') closeDashboardFilterDrawer();
        else if (id === 'confirmModal') closeConfirmModal();
        else if (id === 'fileViewerModal') closeFileViewer();
        else if (id === 'logoutConfirmModal') closeLogoutConfirmModal();
        else closeModal(id);
      } finally {
        suppressOverlayHistory = false;
      }
    }

    const systemElementIsVisible = el => {
      if (!el || el.classList.contains('hidden')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const systemElementStackLevel = el => {
      let level = 0;
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const zIndex = Number.parseInt(getComputedStyle(node).zIndex, 10);
        if (Number.isFinite(zIndex)) level = Math.max(level, zIndex);
      }
      return level;
    };

    function visibleModalElements() {
      const selector = [
        '[id$="Modal"]', '[role="dialog"]', '[aria-modal="true"]', '[data-abearc-map-edit-modal]',
        '#settingsDrawer', '#notificationDrawer', '#notificationPanel', '#dashboardFilterDrawer',
        '#printPreviewOverlay', '#abearcMapOriginalViewer', '.fixed.inset-0'
      ].join(', ');
      return [...new Set(document.querySelectorAll(selector))]
        .filter(systemElementIsVisible)
        .sort((a, b) => systemElementStackLevel(b) - systemElementStackLevel(a) || (a.contains(b) ? 1 : b.contains(a) ? -1 : 0));
    }

    function visiblePopupElements() {
      const selector = [
        '[role="menu"]', '[role="listbox"]', 'details[open]', '[id$="Menu"]', '[id$="DropdownPanel"]',
        '.calendar-user-picker-results', '#triggerDocDropdownPanel', '.abearc-map-measure-context-menu',
        '.abearc-map-results-menu-popover', '.abearc-map-filter-popover'
      ].join(', ');
      return [...new Set(document.querySelectorAll(selector))]
        .filter(popup => {
          const details = popup.closest('details');
          return (!details || details.open) && systemElementIsVisible(popup);
        })
        .sort((a, b) => systemElementStackLevel(b) - systemElementStackLevel(a));
    }

    function visibleFocusableElements(el) {
      return [...el.querySelectorAll('button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"]), [role="menuitem"], [role="option"]')]
        .filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true' && systemElementIsVisible(item));
    }

    function visibleButtonsIn(el) {
      return visibleFocusableElements(el).filter(item => item.matches('button, [role="button"]'));
    }

    const isModalCancelButton = button => {
      const text = String(button.textContent || '').trim().toLowerCase();
      const label = String(button.getAttribute('aria-label') || button.title || '').trim().toLowerCase();
      const action = String(button.getAttribute('onclick') || '').toLowerCase();
      return button.matches('[data-modal-action="cancel"], [data-modal-action="close"]')
        || ['cancel', 'close', 'back', 'no', 'dismiss', '×', 'x'].includes(text)
        || /close|cancel|dismiss|back/.test(label)
        || /close|cancel|dismiss/.test(action);
    };

    function clickModalConfirm(modal) {
      const activeForm = document.activeElement?.closest?.('form');
      const buttons = visibleButtonsIn(modal).filter(button => !isModalCancelButton(button));
      const confirmButton = modal.querySelector('[data-modal-action="confirm"]')
        || modal.querySelector('#confirmActionBtn')
        || (activeForm && modal.contains(activeForm) ? activeForm.querySelector('button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)') : null)
        || buttons.find(button => button.matches('[type="submit"], .is-primary, [data-primary-action]'))
        || buttons.find(button => /^(save|create|update|confirm|submit|apply|continue|download|print|open|upload|restore|send|add)\b/i.test(String(button.textContent || '').trim()));
      confirmButton?.click();
    }

    function clickModalCancel(modal) {
      const cancelButton = modal.querySelector('[data-modal-action="cancel"], [data-modal-action="close"]')
        || visibleButtonsIn(modal).find(isModalCancelButton);
      if (cancelButton) {
        cancelButton.click();
        return;
      }
      if (['settingsDrawer', 'notificationDrawer', 'notificationPanel', 'dashboardFilterDrawer'].includes(modal.id)) {
        closeOverlayById(modal.id);
      }
    }

    function closeSystemPopup(popup) {
      const details = popup.matches('details') ? popup : popup.closest('details');
      if (details) {
        details.removeAttribute('open');
        details.querySelector('summary')?.focus({ preventScroll: true });
        return;
      }
      if (popup.matches('.abearc-map-layer-menu') && typeof window.toggleAbearcMapLayerMenu === 'function') {
        window.toggleAbearcMapLayerMenu(false);
        return;
      }
      if (popup.matches('.abearc-map-filter-popover') && typeof window.toggleAbearcMapFilters === 'function') {
        window.toggleAbearcMapFilters(false);
        return;
      }
      if (popup.matches('[data-map-layer-label-menu]') && typeof window.closeAbearcMapLayerLabelMenu === 'function') {
        window.closeAbearcMapLayerLabelMenu();
        return;
      }
      if (popup.matches('.abearc-map-measure-context-menu') && typeof window.closeAbearcMapMeasureContextMenu === 'function') {
        window.closeAbearcMapMeasureContextMenu();
        return;
      }
      popup.classList.add('hidden');
      if (popup.id) {
        const trigger = document.querySelector(`[aria-controls="${CSS.escape(popup.id)}"]`)
          || document.getElementById(popup.id.replace(/Menu$/, 'MenuBtn'))
          || document.getElementById(popup.id.replace(/Menu$/, 'Btn'));
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus({ preventScroll: true });
      }
    }

    function handleSystemPopupKeydown(event, popup) {
      const items = visibleFocusableElements(popup).filter(item => item.matches('button, a, [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [tabindex]'));
      const activeIndex = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSystemPopup(popup);
        return true;
      }
      if (event.key === 'Tab') {
        closeSystemPopup(popup);
        return false;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !items.length) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      let nextIndex = activeIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;
      else if (event.key === 'ArrowDown') nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      else nextIndex = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus({ preventScroll: true });
      return true;
    }

    function trapSystemModalFocus(event, modal) {
      const focusable = visibleFocusableElements(modal);
      if (!focusable.length) {
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
        modal.focus({ preventScroll: true });
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!modal.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', (event) => {
      if (event.isComposing || event.defaultPrevented) return;
      const modal = visibleModalElements()[0];
      const mapPhotoSelectionToolbar = document.querySelector('[data-map-selection-toolbar]');
      const mapPhotoSelectionActive = appCurrentView === 'map'
        && mapPhotoSelectionToolbar
        && !mapPhotoSelectionToolbar.classList.contains('hidden');
      if (event.key === 'Escape' && mapPhotoSelectionActive && !modal
          && typeof window.cancelAbearcMapPhotoSelection === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.cancelAbearcMapPhotoSelection();
        return;
      }
      const popup = visiblePopupElements()[0];
      if (popup && handleSystemPopupKeydown(event, popup)) return;
      if (popup && popup.contains(document.activeElement) && ['Enter', ' '].includes(event.key)) return;
      if (!modal && event.key === 'Backspace' && appCurrentView === 'projectDetail' && !isUserEditing() && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        history.back();
        return;
      }
      if (!modal) return;
      const active = document.activeElement;
      if (event.key === 'Tab') {
        trapSystemModalFocus(event, modal);
      } else if (event.key === 'Enter') {
        const modifiedConfirm = event.ctrlKey || event.metaKey;
        const inputType = String(active?.getAttribute?.('type') || 'text').toLowerCase();
        const inputUsesEnter = active?.matches?.('input') && !['', 'text', 'search', 'email', 'password', 'tel', 'url', 'number', 'date', 'time', 'datetime-local', 'month', 'week'].includes(inputType);
        if (!modifiedConfirm && (active?.matches?.('textarea, select, button, a, summary, [contenteditable="true"], [role="button"], [role="menuitem"], [role="option"]') || inputUsesEnter)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        clickModalConfirm(modal);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        clickModalCancel(modal);
      }
    }, true);

    function closeTopOverlayFromPopstate() {
      const topOverlay = OVERLAY_IDS.find(isOverlayVisible);
      if (!topOverlay) return false;
      closeOverlayById(topOverlay);
      return true;
    }

    function initOverlayHistoryObserver() {
      const observer = new MutationObserver((records) => {
        if (suppressOverlayHistory || restoringHistoryState) return;
        records.forEach(record => {
          const id = record.target.id;
          if (OVERLAY_IDS.includes(id) && isOverlayVisible(id)) pushOverlayHistory(id);
        });
      });
      OVERLAY_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
      });
    }

    function initNavigationHistory() {
      if (!history.state?.abed) {
        history.replaceState(buildAppHistoryState('login'), '', location.href);
      }
      window.addEventListener('popstate', async (event) => {
        if (closeTopOverlayFromPopstate()) return;
        const state = event.state;
        if (!state?.abed) {
          if (currentUser) await restoreAppHistoryState(buildAppHistoryState('dashboard'));
          else showAuthView(false);
          return;
        }
        await restoreAppHistoryState(state);
      });
    }

    async function restoreAppHistoryState(state) {
      if (!state?.view) {
        return currentUser ? await showDashboard(false) : showAuthView(false);
      }
      if (!currentUser && state.view !== 'login') {
        showAuthView(false);
        return;
      }
      restoringHistoryState = true;
      try {
        if (state.dashboardState) applyDashboardState(state.dashboardState);
        if (state.scrollTarget) lastDetailScrollTarget = state.scrollTarget;
        if (state.view === 'login') {
          showAuthView(false);
        } else if (state.view === 'dashboard') {
          await showDashboard(false, { dashboardState: state.dashboardState });
        } else if (state.view === 'review') {
          await showReviewDocumentsPage(false);
        } else if (state.view === 'myDrive') {
          restoreMyDriveState(state);
          await showMyDrive(false);
        } else if (state.view === 'monitoring') {
          await showMonitoringInventory(false);
        } else if (state.view === 'calendar') {
          await restoreCalendarState(state);
          await showCalendarView(false);
        } else if (state.view === 'map') {
          await showAbearcMap(false);
        } else if (state.view === 'notifications') {
          showNotificationsView(false);
        } else if (state.view === 'settings') {
          await showSettings(false, { section: state.settingsState?.section || state.settingsSection || 'appearance' });
          restoreSettingsState(state);
          const requirementsState = state.settingsState?.requirementsConfig || state.requirementsConfig;
          if ((state.settingsState?.section || state.settingsSection) === 'requirements' && requirementsState) {
            setTimeout(() => restoreRequirementsConfigState(requirementsState), 350);
          }
        } else if (state.view === 'projectDetail') {
          if (!projCache.length) await loadDash({ silent: true, preservePage: true });
          const exists = projCache.some(p => Number(p.id) === Number(state.projectId));
          if (!exists) {
            toast('This project is no longer available.', 'error');
            showDashboard(false, { dashboardState: state.dashboardState });
            replaceAppHistory('dashboard');
          } else {
            if (state.scrollTarget) {
              await goToTarget({
                project_id: state.projectId,
                document_id: state.documentId || extractDocumentIdFromScrollTarget(state.scrollTarget),
                stage: state.stage || 'Proposal',
                target_kind: state.scrollTarget === 'project-due'
                  ? 'project_due_date'
                  : state.scrollTarget?.startsWith('document-')
                    ? 'document'
                    : 'project',
                target_type: state.targetType || state.targetKind || 'project'
              });
              return;
            }
            await showDetails(state.projectId, state.stage || 'Proposal', false);
          }
        } else {
          currentUser ? await showDashboard(false) : showAuthView(false);
        }
      } finally {
        restoringHistoryState = false;
        if (!(state.view === 'projectDetail' && state.scrollTarget)) restoreScrollState(state);
      }
    }

    function extractDocumentIdFromScrollTarget(scrollTarget) {
      const match = String(scrollTarget || '').match(/^document-(\d+)$/);
      return match ? Number(match[1]) : null;
    }
    const isAdmin = () => currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    const isSuperAdmin = () => currentUser?.role === 'superadmin';
    const canAssignOwnership = () => currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    const canViewWorkAssignment = () => currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    const canUpload = () => hasPrivilege('upload_document');
    const getStageTheme = (stage) => STAGE_THEME[stage] || STAGE_THEME.Proposal;
    function clearAuthState({ expectedToken = authToken } = {}) {
      const tokenBeingCleared = String(expectedToken || '');
      let storedToken = '';
      try { storedToken = String(localStorage.getItem('abedAuthToken') || ''); } catch (e) {}
      // localStorage is shared by every tab. An expired tab must not erase a
      // newer session that another tab has already written.
      const ownsSharedAuthState = !storedToken || (!!tokenBeingCleared && storedToken === tokenBeingCleared);
      currentUser = null;
      authToken = '';
      currentUserPrivileges = {};
      if (ownsSharedAuthState) {
        localStorage.removeItem('abedAuthToken');
        localStorage.removeItem('abedCurrentUser');
      }
      sessionStorage.removeItem(APP_STATE_STORAGE_KEY);
      if (ownsSharedAuthState) localStorage.removeItem(APP_STATE_STORAGE_KEY);
      calendarScope = 'my';
      calendarDefaultsAppliedForUserId = null;
      appCurrentView = 'login';
      document.body.classList.remove('calendar-page-active');
      document.body.classList.remove('map-page-active');
      stopNotificationStream();
      notificationsCache = [];
      updateNotificationBadge(0);
      updateSidebarBadges();
      renderNotifications();
      stopLiveRefresh();
      stopSessionActivityTracking({ clearSharedActivity: ownsSharedAuthState });
      forceLoginLightMode();
      updateRoleUi();
    }
    function updateRoleUi() {
      const newProjectBtn = document.getElementById('newProjectBtn');
      const settingsBtn = document.getElementById('settingsBtn');
      const userManagementTab = document.getElementById('tab-user-management');
      const userInfoBar = document.getElementById('userInfoBar');
      const headerUserBox = document.getElementById('headerUserBox');
      const notificationEntry = document.getElementById('notificationEntry');
      const mobileHeaderMenuEntry = document.getElementById('mobileHeaderMenuEntry');
      const mobileMenuNewProjectBtn = document.getElementById('mobileMenuNewProjectBtn');
      const mobileMenuMyDriveBtn = document.getElementById('mobileMenuMyDriveBtn');
      const mobileMenuMonitoringBtn = document.getElementById('mobileMenuMonitoringBtn');
      const mobileHeaderMenuName = document.getElementById('mobileHeaderMenuName');
      const mobileHeaderMenuRole = document.getElementById('mobileHeaderMenuRole');
      const globalWorkBtn = document.getElementById('globalWorkBtn');
      const myDriveHeaderBtn = document.getElementById('myDriveHeaderBtn');
      const myDriveDashboardBtn = document.getElementById('myDriveDashboardBtn');
      const brandHomeButton = document.getElementById('brandHomeButton');
      const brandBadgeUser = document.getElementById('brandBadgeUser');
      const loginRestoreShortcut = document.getElementById('loginRestoreShortcut');
      if (!newProjectBtn || !settingsBtn || !userInfoBar || !headerUserBox) return;
      const loggedIn = !!currentUser;
      if (loginRestoreShortcut) loginRestoreShortcut.classList.toggle('hidden', loggedIn);
      if (brandHomeButton) brandHomeButton.classList.toggle('brand-authenticated', loggedIn);
      if (brandBadgeUser) {
        brandBadgeUser.textContent = loggedIn ? uppercaseUsername(currentUser.username) : '';
        brandBadgeUser.title = loggedIn ? uppercaseUsername(currentUser.username) : '';
      }
      
      // New Project button should appear if user has create_project privilege
      newProjectBtn.classList.toggle('hidden', !loggedIn || !hasPrivilege('create_project'));
      
      // Settings button should appear for all authenticated users (to access General Settings: Appearance and Change Password)
      settingsBtn.classList.toggle('hidden', !loggedIn);
      
      // Show User Management tab when the user has the privilege.
      if (userManagementTab) userManagementTab.classList.toggle('hidden', !hasPrivilege('manage_users'));
      if (notificationEntry) notificationEntry.classList.toggle('hidden', !loggedIn);
      if (mobileHeaderMenuEntry) mobileHeaderMenuEntry.classList.toggle('hidden', !loggedIn);
      if (mobileMenuNewProjectBtn) mobileMenuNewProjectBtn.classList.toggle('hidden', !loggedIn || !hasPrivilege('create_project'));
      const canOpenMyDrive = loggedIn && hasPrivilege('view_user_drive');
      if (mobileMenuMyDriveBtn) mobileMenuMyDriveBtn.classList.toggle('hidden', !canOpenMyDrive);
      if (mobileMenuMonitoringBtn) mobileMenuMonitoringBtn.classList.toggle('hidden', !loggedIn || !hasPrivilege('view_monitoring_inventory'));
      if (myDriveHeaderBtn) myDriveHeaderBtn.classList.toggle('hidden', !canOpenMyDrive);
      if (myDriveDashboardBtn) myDriveDashboardBtn.classList.toggle('hidden', !canOpenMyDrive);
      if (globalWorkBtn) {
        const showGlobalWork = loggedIn && canViewWorkAssignment();
        globalWorkBtn.classList.toggle('hidden', !showGlobalWork);
        if (!showGlobalWork && activeWorkPanel === 'global') activeWorkPanel = null;
      }
      applySidebarVisibility();
      if (loggedIn) {
        updateSidebarBadges();
        loadReviewDocuments({ silent: true });
        if (typeof refreshMonitoringSidebarBadge === 'function') refreshMonitoringSidebarBadge(true);
      }
      else {
        window.reviewDocumentsCache = [];
        window.reviewedDocumentsCache = [];
        updateSidebarBadges();
      }
      userInfoBar.classList.toggle('hidden', !loggedIn);
      userInfoBar.classList.toggle('flex', loggedIn);
      if (loggedIn) {
        const role = String(currentUser.role || 'user').replace('_', ' ');
        if (mobileHeaderMenuName) mobileHeaderMenuName.textContent = displayUsername(currentUser.username || 'User');
        if (mobileHeaderMenuRole) mobileHeaderMenuRole.textContent = role;
        headerUserBox.className = 'inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 min-w-0 max-w-[11rem] sm:max-w-[14rem] cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:border-cyan-300 dark:hover:border-cyan-700 transition';
        headerUserBox.setAttribute('role', 'button');
        headerUserBox.setAttribute('tabindex', '0');
        headerUserBox.setAttribute('title', 'Open My Account Appearance settings');
        headerUserBox.setAttribute('aria-label', 'Open My Account Appearance settings');
        headerUserBox.onclick = openCurrentUserAppearanceSettings;
        headerUserBox.onkeydown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openCurrentUserAppearanceSettings();
          }
        };
        headerUserBox.innerHTML = `
          ${renderUserAvatar(currentUser, 30, 'text-xs')}
          <span class="min-w-0 text-left leading-tight">
            <span class="block truncate text-sm font-black text-gray-900 dark:text-gray-100">${esc(displayUsername(currentUser.username))}</span>
            <span class="block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400 capitalize">${esc(role)}</span>
          </span>
        `;
      } else {
        headerUserBox.className = 'hidden';
        headerUserBox.innerHTML = '';
        headerUserBox.removeAttribute('role');
        headerUserBox.removeAttribute('tabindex');
        headerUserBox.removeAttribute('title');
        headerUserBox.removeAttribute('aria-label');
        headerUserBox.onclick = null;
        headerUserBox.onkeydown = null;
        closeMobileHeaderMenu();
      }
      
      // Update settings tab visibility when UI updates
      if (loggedIn) {
        updateSettingsTabVisibility();
      }
      setWorkButtonState();
    }

    function closeMobileHeaderMenu() {
      const menu = document.getElementById('mobileHeaderMenu');
      const btn = document.getElementById('mobileHeaderMenuBtn');
      if (menu) menu.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    window.closeMobileHeaderMenu = closeMobileHeaderMenu;

    window.toggleMobileHeaderMenu = function() {
      const menu = document.getElementById('mobileHeaderMenu');
      const btn = document.getElementById('mobileHeaderMenuBtn');
      if (!menu) return;
      const opening = menu.classList.contains('hidden');
      if (opening) {
        if (typeof closeNotificationsPanel === 'function') closeNotificationsPanel();
        menu.classList.remove('hidden');
      } else {
        menu.classList.add('hidden');
      }
      if (btn) btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    };

    document.addEventListener('click', (event) => {
      const entry = document.getElementById('mobileHeaderMenuEntry');
      if (entry && !entry.contains(event.target)) closeMobileHeaderMenu();
    });

    function requirePrivilege(privilegeName) {
      if (hasPrivilege(privilegeName)) return true;
      toast('Permission denied: ' + privilegeName, 'error');
      return false;
    }

    async function refreshCurrentUserPrivileges({ silent = true } = {}) {
      if (!authToken) return;
      try {
        const me = await fetchJson(`${API}/auth/me`, { silentLoading: silent });
        currentUser = me.user;
        if (!currentUser.token) currentUser.token = authToken;
        currentUserPrivileges = me.user?.privileges || {};
        localStorage.setItem('abedCurrentUser', JSON.stringify(currentUser));
        applyDefaultCalendarFiltersForCurrentUser();
        updateRoleUi();
        applyNavigationVisibility();
        if (!canManageStageEditAccess()) closeModal('stageEditAccessModal');
        if (currentProjId) {
          const project = projCache.find(p => Number(p.id) === Number(currentProjId));
          if (project) renderProjectDetailHeader(project);
        }
      } catch (e) {}
    }

    function ownerDisplayName(doc) {
      if (isNotRequiredDocument(doc)) return '-';
      if (!doc.assigned_user_id) return 'Unassigned';
      return doc.assigned_username || 'Unknown user';
    }

    function isNotRequiredDocument(doc) {
      return String(doc?.requirement_state || '').trim().toLowerCase() === 'not required';
    }

    function ownershipBadge(doc) {
      if (isNotRequiredDocument(doc)) {
        return '<span class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700">-</span>';
      }
      const isMine = Number(doc.assigned_user_id) === Number(currentUser?.id);
      const cls = !doc.assigned_user_id
        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'
        : (isMine ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800' : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700');
      return `<span class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${cls}">${esc(ownerDisplayName(doc))}</span>`;
    }

    function assignmentSelect(doc) {
      if (isNotRequiredDocument(doc)) return '<span class="text-gray-400">-</span>';
      if (!canAssignOwnership()) return ownershipBadge(doc);
      return `<button onclick="event.stopPropagation(); openAssignmentPicker('document', ${doc.id}, ${doc.assigned_user_id || 'null'})" class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${doc.assigned_user_id ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800'} hover:shadow-sm">${esc(ownerDisplayName(doc))}</button>`;
    }

    async function assignDocumentOwner(docId, next) {
      try {
        const result = await fetchJson(`${API}/documents/${docId}/assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_user_id: next })
        });
        toast(result.unchanged ? 'Assignment unchanged' : 'Assignment updated');
        await refreshAfterMutation({ documentId: docId });
      } catch (e) {
        toast(e.message, 'error');
      }
    }
