
    function myDriveActionAllowed(action) {
      if (action === 'upload') return hasPrivilege('upload_user_drive_file');
      if (action === 'manage') return hasPrivilege('manage_own_user_drive');
      if (action === 'share') return hasPrivilege('share_user_drive_file');
      if (action === 'delete') return hasPrivilege('delete_own_user_drive_file');
      return hasPrivilege('view_user_drive');
    }

    function myDriveIcon(item) {
      if (item.kind === 'folder') return '<svg class="w-8 h-8 text-blue-500 dark:text-blue-300" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4l2 2h7a2 2 0 012 2v8.75A3.25 3.25 0 0117.75 20H6.25A3.25 3.25 0 013 16.75V7.25A3.25 3.25 0 016.25 4H10z"/></svg>';
      const ext = String(item.file_ext || '').replace('.', '').toUpperCase() || 'FILE';
      return `<span class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 grid place-items-center text-[11px] font-black">${esc(ext.slice(0, 4))}</span>`;
    }

    function myDriveFileCategory(item = {}) {
      const ext = String(item.file_ext || '').toLowerCase();
      const type = String(item.file_type || '').toLowerCase();
      if (type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return 'Image';
      if (type.startsWith('video/') || ['.mp4', '.mov', '.webm'].includes(ext)) return 'Video';
      if (ext === '.pdf') return 'PDF';
      if (['.doc', '.docx', '.txt'].includes(ext)) return 'Document';
      if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'Spreadsheet';
      if (['.ppt', '.pptx'].includes(ext)) return 'Presentation';
      if (ext === '.zip') return 'ZIP';
      return 'File';
    }

    function myDriveItemName(item) {
      return item.kind === 'folder' ? item.name : (item.title || item.original_name || 'File');
    }

    function myDriveSharedIndicator(item) {
      if (myDriveTab !== 'shared' && !item.share_id && !item.folder_share_id) return '';
      return `<span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 dark:text-gray-500" title="Shared"><svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15 8c0-1.42-.5-2.73-1.33-3.76.42-.14.86-.24 1.33-.24 2.21 0 4 1.79 4 4s-1.79 4-4 4c-.43 0-.84-.09-1.23-.21-.03-.01-.06-.02-.1-.03A5.98 5.98 0 0015 8zM16.66 13.13C18.03 14.06 19 15.32 19 17v3h4v-3c0-2.18-3.58-3.47-6.34-3.87zM9 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm0 9c2.67 0 8 1.34 8 4v3H1v-3c0-2.66 5.33-4 8-4z"/></svg></span>`;
    }

    function myDriveItemMeta(item) {
      if (item.kind === 'folder') {
        const size = formatBytes(Number(item.folder_size ?? item.file_size ?? 0));
        return item.shared_by_username ? `${size} - Shared by ${item.shared_by_username}` : size;
      }
      const details = [formatBytes(item.file_size || 0), fmtDateTime(item.updated_at || item.uploaded_at)].filter(Boolean).join(' - ');
      return item.shared_by_username ? `Shared by ${item.shared_by_username}` : details;
    }

    function myDriveFileUrl(id, action) {
      return `${API}/user-drive/files/${Number(id)}/${action}`;
    }

    async function fetchMyDriveFileBlob(id, action = 'view') {
      const response = await fetch(myDriveFileUrl(id, action), { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
      if (!response.ok) {
        let message = 'File is not available.';
        try { message = (await response.json()).error || message; } catch (_) {}
        throw new Error(message);
      }
      return response.blob();
    }

    async function showMyDrive(pushHistory = true) {
      if (!hasPrivilege('view_user_drive')) return toast('You do not have access to My Drive.', 'error');
      navigateTo('myDrive', {}, pushHistory);
      await loadMyDrive();
      startMyDriveAutoRefresh();
    }

    function startMyDriveAutoRefresh() {
      if (myDriveAutoRefreshTimer) return;
      myDriveAutoRefreshTimer = setInterval(() => {
        if (appCurrentView !== 'myDrive' || document.hidden || myDriveLoading) return;
        if (myDriveSelectionBoxState) return;
        loadMyDrive({ quiet: true });
      }, 3000);
    }

    function myDriveSnapshot(data = myDriveCache) {
      return JSON.stringify({
        tab: myDriveTab,
        folder: myDriveFolderId || null,
        folders: (data.folders || []).map(item => [item.id, item.name, item.updated_at, item.folder_size, item.file_count]),
        files: (data.files || []).map(item => [item.id, item.original_name, item.title, item.updated_at, item.file_size]),
        crumbs: (data.breadcrumbs || []).map(item => [item.id, item.name])
      });
    }

    function setMyDriveTab(tab) {
      const nextTab = ['shared', 'trash'].includes(tab) ? tab : 'mine';
      if (nextTab !== myDriveTab || nextTab === 'mine' || nextTab === 'trash') myDriveFolderId = null;
      myDriveTab = nextTab;
      clearMyDriveSelection();
      updateAppHistory('myDrive');
      loadMyDrive();
    }

    function toggleMyDriveMode() {
      myDriveMode = myDriveMode === 'grid' ? 'list' : 'grid';
      persistCurrentAppState();
      renderMyDrive();
    }

    function setMyDriveMode(mode) {
      myDriveMode = mode === 'list' ? 'list' : 'grid';
      persistCurrentAppState();
      renderMyDrive();
    }

    function myDriveSortValue(item, sortBy = myDriveSortBy) {
      if (sortBy === 'modified') return new Date((myDriveTab === 'trash' ? item.deleted_at : null) || item.updated_at || item.uploaded_at || item.created_at || 0).getTime() || 0;
      if (sortBy === 'size') return Number(item.kind === 'folder' ? (item.folder_size ?? item.file_size ?? 0) : (item.file_size || 0));
      if (sortBy === 'type') return item.kind === 'folder' ? 'folder' : myDriveFileCategory(item).toLowerCase();
      if (sortBy === 'sharedBy') return String(item.shared_by_username || '').toLowerCase();
      if (sortBy === 'sharedAt') return new Date(item.shared_at || item.created_at || item.updated_at || 0).getTime() || 0;
      return myDriveItemName(item).toLowerCase();
    }

    function sortMyDriveItems(items = []) {
      return [...items].sort((a, b) => {
        if (myDriveFoldersFirst && a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        const av = myDriveSortValue(a);
        const bv = myDriveSortValue(b);
        let result = 0;
        if (typeof av === 'number' && typeof bv === 'number') result = av - bv;
        else result = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
        if (result === 0) result = myDriveItemName(a).localeCompare(myDriveItemName(b), undefined, { sensitivity: 'base', numeric: true });
        return myDriveSortDir === 'desc' ? -result : result;
      });
    }

    function myDriveSortDirectionLabels() {
      if (['modified', 'sharedAt'].includes(myDriveSortBy)) return { asc: 'Oldest first', desc: 'Newest first' };
      if (myDriveSortBy === 'size') return { asc: 'Smallest first', desc: 'Largest first' };
      return { asc: 'A to Z', desc: 'Z to A' };
    }

    function selectMyDriveItem(event, id, kind) {
      if (event?.target?.closest?.('[data-drive-menu-trigger="1"]')) return;
      const item = { id: Number(id), kind };
      const key = myDriveSelectionKey(item);
      const now = Date.now();
      if (!event?.ctrlKey && !event?.metaKey && !event?.shiftKey && myDriveLastClick.key === key && now - myDriveLastClick.at < 500) {
        myDriveLastClick = { key: '', at: 0 };
        openMyDriveItem(id, kind);
        return;
      }
      myDriveLastClick = { key, at: now };
      if (event?.shiftKey && myDriveSelectionAnchor) {
        const visible = [...document.querySelectorAll('#myDriveContent [data-drive-kind][data-drive-id]')].map(el => ({ kind: el.dataset.driveKind, id: Number(el.dataset.driveId) }));
        const start = visible.findIndex(i => myDriveSelectionKey(i) === myDriveSelectionKey(myDriveSelectionAnchor));
        const end = visible.findIndex(i => myDriveSelectionKey(i) === key);
        if (start >= 0 && end >= 0) {
          if (!event.ctrlKey && !event.metaKey) myDriveSelectedItems.clear();
          visible.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(i => myDriveSelectedItems.set(myDriveSelectionKey(i), i));
        } else {
          myDriveSelectedItems.clear();
          myDriveSelectedItems.set(key, item);
          myDriveSelectionAnchor = item;
        }
      } else if (event?.ctrlKey || event?.metaKey) {
        if (myDriveSelectedItems.has(key)) myDriveSelectedItems.delete(key);
        else myDriveSelectedItems.set(key, item);
        myDriveSelectionAnchor = item;
      } else {
        myDriveSelectedItems.clear();
        myDriveSelectedItems.set(key, item);
        myDriveSelectionAnchor = item;
      }
      myDriveSelectedItem = myDriveSelectedItems.get(key) || item;
      updateMyDriveSelectionVisuals();
      renderMyDriveDetailsPanel();
    }

    function myDriveSelectionKey(item) {
      return `${item.kind}:${Number(item.id)}`;
    }

    function clearMyDriveSelection() {
      myDriveSelectedItem = null;
      myDriveSelectionAnchor = null;
      myDriveSelectedItems.clear();
      updateMyDriveSelectionVisuals();
      renderMyDriveDetailsPanel();
    }

    function selectAllMyDriveVisibleItems() {
      if (appCurrentView !== 'myDrive') return;
      const items = getVisibleMyDriveItems();
      myDriveSelectedItems.clear();
      items.forEach(item => myDriveSelectedItems.set(myDriveSelectionKey(item), { id: Number(item.id), kind: item.kind }));
      myDriveSelectedItem = items.length ? { id: Number(items[items.length - 1].id), kind: items[items.length - 1].kind } : null;
      myDriveSelectionAnchor = myDriveSelectedItem;
      updateMyDriveSelectionVisuals();
      renderMyDriveDetailsPanel();
      if (items.length) toast(`${items.length} item(s) selected.`);
    }

    function getVisibleMyDriveItems() {
      return getVisibleMyDriveItemBuckets().items;
    }

    function getVisibleMyDriveItemBuckets() {
      const typeFilter = currentMyDriveTypeFilter();
      const modifiedFilter = currentMyDriveModifiedFilter();
      const matchesModified = item => myDriveMatchesModifiedFilter(item, modifiedFilter);
      const folders = typeFilter ? [] : (myDriveCache.folders || []).filter(matchesModified);
      const files = (myDriveCache.files || []).filter(matchesModified);
      return { folders, files, items: [...folders, ...files] };
    }

    function myDriveCachedItem(id, kind) {
      const list = kind === 'folder' ? (myDriveCache.folders || []) : (myDriveCache.files || []);
      return list.find(item => Number(item.id) === Number(id)) || null;
    }

    function myDriveUndoSnapshot(item) {
      const current = myDriveCachedItem(item.id, item.kind) || item;
      return {
        id: Number(current.id),
        kind: current.kind,
        name: myDriveItemName(current),
        parent_folder_id: current.parent_folder_id ? Number(current.parent_folder_id) : null,
        title: current.title || '',
        description: current.description || '',
        tags: current.tags || '',
        original_name: current.original_name || ''
      };
    }

    function pushMyDriveUndo(action) {
      if (!action?.type) return;
      myDriveUndoStack.push(action);
      if (myDriveUndoStack.length > 25) myDriveUndoStack.shift();
    }

    async function moveMyDriveItemsToParent(items, parentFolderId) {
      if (!items?.length) return;
      await fetchJson(`${API}/user-drive/items/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(item => ({ id: Number(item.id), kind: item.kind })), parent_folder_id: parentFolderId || null })
      });
    }

    async function undoLastMyDriveAction() {
      if (!myDriveUndoStack.length) return toast('Nothing to undo.', 'info');
      const action = myDriveUndoStack.pop();
      try {
        if (action.type === 'move') {
          const groups = new Map();
          (action.items || []).forEach(item => {
            const key = item.parent_folder_id || '';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
          });
          for (const [parentKey, items] of groups.entries()) {
            await moveMyDriveItemsToParent(items, parentKey === '' ? null : Number(parentKey));
          }
          toast(`Move undone for ${action.items.length} item(s).`);
        } else if (action.type === 'copy') {
          for (const item of action.items || []) {
            await fetchJson(`${API}/user-drive/${item.kind === 'folder' ? 'folders' : 'files'}/${Number(item.id)}`, { method: 'DELETE' });
          }
          toast(`Copy undone for ${action.items.length} item(s).`);
        } else if (action.type === 'rename') {
          const item = action.item;
          if (item.kind === 'folder') {
            await fetchJson(`${API}/user-drive/folders/${Number(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item.name, parent_folder_id: item.parent_folder_id }) });
          } else {
            await fetchJson(`${API}/user-drive/files/${Number(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.title || item.name || item.original_name, description: item.description || '', tags: item.tags || '', parent_folder_id: item.parent_folder_id }) });
          }
          toast('Rename undone.');
        }
        clearMyDriveSelection();
        await loadMyDrive();
      } catch (err) {
        myDriveUndoStack.push(action);
        toast(err.message || 'Undo failed.', 'error');
      }
    }

    function updateMyDriveSelectionVisuals() {
      document.querySelectorAll('[data-drive-kind][data-drive-id]').forEach(el => {
        const selected = myDriveSelectedItems.has(`${el.dataset.driveKind}:${Number(el.dataset.driveId)}`);
        el.dataset.driveSelected = selected ? '1' : '0';
        el.classList.toggle('ring-2', selected);
        el.classList.toggle('ring-blue-500', selected);
        el.classList.toggle('bg-blue-50', selected);
        el.classList.toggle('dark:bg-blue-950/30', selected);
      });
    }

    function openMyDriveItem(id, kind) {
      if (kind === 'folder') {
        if (myDriveTab === 'trash') openMyDriveTrashFolder(id);
        else openMyDriveFolder(id);
      }
      else viewMyDriveFile(id);
    }

    async function loadMyDrive(options = {}) {
      if (!hasPrivilege('view_user_drive')) return;
      if (appCurrentView === 'myDrive') startMyDriveAutoRefresh();
      if (myDriveLoading) return;
      myDriveLoading = true;
      const quiet = !!options.quiet;
      const content = document.getElementById('myDriveContent');
      if (!quiet && content) content.innerHTML = '<div class="py-12 text-center text-gray-500 dark:text-gray-400">Loading My Drive...</div>';
      try {
        const before = myDriveSnapshot();
        let nextCache = null;
        if (myDriveTab === 'shared') {
          const params = new URLSearchParams();
          if (myDriveFolderId) params.set('folder_id', myDriveFolderId);
          const data = await fetchJson(`${API}/user-drive/shared-with-me?${params.toString()}`, { silentLoading: true });
          nextCache = { folders: data.folders || [], files: data.files || [], breadcrumbs: data.breadcrumbs || [], usage: myDriveCache.usage || { bytes: 0, files: 0 } };
        } else if (myDriveTab === 'trash') {
          const params = new URLSearchParams();
          if (myDriveFolderId) params.set('folder_id', myDriveFolderId);
          nextCache = await fetchJson(`${API}/user-drive/trash?${params.toString()}`, { silentLoading: true });
        } else {
          const params = new URLSearchParams();
          if (myDriveFolderId) params.set('folder_id', myDriveFolderId);
          const search = document.getElementById('myDriveSearchInput')?.value || '';
          const type = document.getElementById('myDriveTypeFilter')?.value || '';
          if (search) params.set('search', search);
          if (type) params.set('type', type);
          nextCache = await fetchJson(`${API}/user-drive?${params.toString()}`, { silentLoading: true });
        }
        myDriveCache = nextCache || myDriveCache;
        if (!quiet || before !== myDriveSnapshot()) renderMyDrive();
        persistCurrentAppState();
      } catch (err) {
        if (!quiet && content) content.innerHTML = `<div class="py-12 text-center text-red-600 dark:text-red-300">${esc(err.message || 'Failed to load My Drive.')}</div>`;
      } finally {
        myDriveLoading = false;
      }
    }

    function renderMyDrive() {
      const mineActive = myDriveTab === 'mine';
      const sharedActive = myDriveTab === 'shared';
      const trashActive = myDriveTab === 'trash';
      const mineTab = document.getElementById('myDriveMineTab');
      const sharedTab = document.getElementById('myDriveSharedTab');
      const trashTab = document.getElementById('myDriveTrashTab');
      const navActive = 'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold text-left bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200 border-l-4 border-cyan-700 dark:border-cyan-400';
      const navIdle = 'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent';
      if (mineTab) mineTab.className = mineActive ? navActive : navIdle;
      if (sharedTab) sharedTab.className = sharedActive ? navActive : navIdle;
      if (trashTab) trashTab.className = trashActive ? navActive : navIdle;
      updateMyDriveTypeFilterButton();
      updateMyDriveModifiedFilterButton();
      const listModeBtn = document.getElementById('myDriveListModeBtn');
      const gridModeBtn = document.getElementById('myDriveGridModeBtn');
      const modeActive = 'h-8 w-[55px] inline-flex items-center justify-center gap-1 bg-cyan-800 dark:bg-cyan-500 text-white dark:text-gray-950';
      const modeIdle = 'h-8 w-[55px] inline-flex items-center justify-center gap-1 bg-transparent text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';
      const checkIcon = '<svg class="h-[18px] w-[18px] shrink-0 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 18 18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9.2 6.8 13 15 5"/></svg>';
      const listIcon = '<svg class="h-3 w-3.5 shrink-0 pointer-events-none" fill="currentColor" viewBox="0 0 14 12"><path d="M1 0h12a1 1 0 010 2H1A1 1 0 111 0zm0 5h12a1 1 0 010 2H1a1 1 0 010-2zm0 5h12a1 1 0 010 2H1a1 1 0 010-2z"/></svg>';
      const gridIcon = '<svg class="h-3.5 w-3.5 shrink-0 pointer-events-none" fill="currentColor" viewBox="0 0 14 14"><path d="M1 0h4a1 1 0 011 1v4a1 1 0 01-1 1H1a1 1 0 01-1-1V1a1 1 0 011-1zm8 0h4a1 1 0 011 1v4a1 1 0 01-1 1H9a1 1 0 01-1-1V1a1 1 0 011-1zM1 8h4a1 1 0 011 1v4a1 1 0 01-1 1H1a1 1 0 01-1-1V9a1 1 0 011-1zm8 0h4a1 1 0 011 1v4a1 1 0 01-1 1H9a1 1 0 01-1-1V9a1 1 0 011-1z"/></svg>';
      if (listModeBtn) {
        listModeBtn.className = myDriveMode === 'list' ? modeActive : modeIdle;
        listModeBtn.setAttribute('aria-checked', myDriveMode === 'list' ? 'true' : 'false');
        listModeBtn.innerHTML = `${myDriveMode === 'list' ? checkIcon : ''}${listIcon}`;
      }
      if (gridModeBtn) {
        gridModeBtn.className = myDriveMode === 'grid' ? modeActive : modeIdle;
        gridModeBtn.setAttribute('aria-checked', myDriveMode === 'grid' ? 'true' : 'false');
        gridModeBtn.innerHTML = `${myDriveMode === 'grid' ? checkIcon : ''}${gridIcon}`;
      }
      const summary = document.getElementById('myDriveSummary');
      const usedBytes = Number(myDriveCache.usage?.bytes || 0);
      const quotaBytes = Number(myDriveCache.usage?.quota_bytes || (15 * 1024 * 1024 * 1024));
      if (summary) summary.textContent = mineActive ? `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used across ${Number(myDriveCache.usage?.files || 0)} file(s).` : (trashActive ? `Trash uses ${formatBytes(Number(myDriveCache.usage?.trash_bytes || 0))}. Delete forever to free storage.` : 'Files and folders shared with you by other users.');
      const usageText = document.getElementById('myDriveUsageText');
      const usageBar = document.getElementById('myDriveUsageBar');
      if (usageText) usageText.textContent = `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used`;
      if (usageBar) usageBar.style.width = `${Math.min(100, Math.max(usedBytes ? 4 : 0, Math.round((usedBytes / Math.max(1, quotaBytes)) * 100)))}%`;
      renderMyDriveBreadcrumbs();
      renderMyDriveDetailsPanel();
      const content = document.getElementById('myDriveContent');
      if (!content) return;
      setupMyDriveContentDropZone();
      const typeFilter = currentMyDriveTypeFilter();
      const modifiedFilter = currentMyDriveModifiedFilter();
      const { folders: visibleFolders, files: visibleFiles, items } = getVisibleMyDriveItemBuckets();
      const listItems = sortMyDriveItems(items);
      cleanupMyDriveThumbUrls();
      if (!items.length) {
        const filterEmptyText = typeFilter ? 'No files match these filters' : 'No items match these filters';
        content.innerHTML = mineActive && myDriveActionAllowed('upload')
          ? `<div class="min-h-full h-[22rem] grid place-items-center text-center text-sm font-semibold text-gray-400 dark:text-gray-500">${typeFilter || modifiedFilter ? filterEmptyText : 'Drop files here to upload'}</div>`
          : `<div class="py-12 text-center text-gray-500 dark:text-gray-400">${typeFilter || modifiedFilter ? filterEmptyText : (trashActive ? 'Trash is empty.' : (mineActive ? 'No files or folders here yet.' : 'No shared files yet.'))}</div>`;
        return;
      }
      content.innerHTML = myDriveMode === 'grid'
        ? `<div class="space-y-4">${visibleFolders.length ? `<section><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">${visibleFolders.map(renderMyDriveGridItem).join('')}</div></section>` : ''}${visibleFiles.length ? `<section><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">${visibleFiles.map(renderMyDriveGridItem).join('')}</div></section>` : ''}</div>`
        : `<div class="overflow-x-auto bg-white dark:bg-gray-900"><table class="w-full text-sm"><thead>${myDriveListHeaderHtml()}</thead><tbody>${listItems.map(renderMyDriveRow).join('')}</tbody></table></div>`;
      updateMyDriveSelectionVisuals();
      hydrateMyDriveThumbnails();
    }

    function renderMyDriveBreadcrumbs() {
      const el = document.getElementById('myDriveBreadcrumbs');
      if (!el) return;
      if (myDriveTab === 'shared') {
        const crumbs = myDriveCache.breadcrumbs || [];
        el.innerHTML = `<div class="flex items-center gap-2 min-w-0"><button onclick="openMyDriveFolder(null)" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300">Shared with me</button>${crumbs.map(c => `<span class="text-gray-300 dark:text-gray-600">/</span><button onclick="openMyDriveFolder(${Number(c.id)})" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300 truncate">${esc(c.name)}</button>`).join('')}</div>`;
        return;
      }
      if (myDriveTab === 'trash') {
        const crumbs = myDriveCache.breadcrumbs || [];
        el.innerHTML = `<div class="flex items-center gap-2 min-w-0"><button onclick="openMyDriveTrashFolder(null)" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300">Trash</button>${crumbs.map(c => `<span class="text-gray-300 dark:text-gray-600">/</span><button onclick="openMyDriveTrashFolder(${Number(c.id)})" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300 truncate">${esc(c.name)}</button>`).join('')}</div>`;
        return;
      }
      const crumbs = myDriveCache.breadcrumbs || [];
      el.innerHTML = `<div class="flex items-center gap-2 min-w-0"><button onclick="openMyDriveFolder(null)" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300">My Drive</button>${crumbs.map(c => `<span class="text-gray-300 dark:text-gray-600">/</span><button onclick="openMyDriveFolder(${Number(c.id)})" class="font-black text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-300 truncate">${esc(c.name)}</button>`).join('')}</div>`;
    }

    function renderMyDriveGridItem(item) {
      const name = myDriveItemName(item);
      const meta = myDriveItemMeta(item);
      const sharedBy = item.shared_by_name || item.shared_by_username || '';
      const sharedByLine = myDriveTab === 'shared' && sharedBy
        ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate" title="Shared by ${esc(displayUsername(sharedBy))}">Shared by <span class="font-black text-green-700 dark:text-green-300">${esc(displayUsername(sharedBy))}</span></div>`
        : '';
      const dropAttrs = item.kind === 'folder' && myDriveTab === 'mine' ? ` draggable="true" ondragstart="startMyDriveItemDrag(event, ${Number(item.id)}, '${item.kind}')" ondragover="handleMyDriveFolderDragOver(event)" ondragleave="handleMyDriveFolderDragLeave(event)" ondrop="dropMyDriveItemsOnFolder(event, ${Number(item.id)})"` : ` draggable="true" ondragstart="startMyDriveItemDrag(event, ${Number(item.id)}, '${item.kind}')"`;
      if (item.kind === 'file') {
        return `<div data-drive-kind="${item.kind}" data-drive-id="${Number(item.id)}" ${dropAttrs} class="group rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 min-w-0 transition cursor-default overflow-hidden" onclick="selectMyDriveItem(event, ${Number(item.id)}, '${item.kind}')" oncontextmenu="openMyDriveItemMenu(event, ${Number(item.id)}, '${item.kind}')" onpointerdown="startMyDriveLongPress(event, ${Number(item.id)}, '${item.kind}')" onpointerup="cancelMyDriveLongPress()" onpointercancel="cancelMyDriveLongPress()" onpointerleave="cancelMyDriveLongPress()">
          ${renderMyDriveFilePreview(item)}
          <div class="flex min-h-12 items-center gap-3 px-3 py-2 min-w-0">
            <div class="shrink-0">${myDriveIcon(item)}</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <div class="block min-w-0 flex-1 text-left text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title="${esc(name)}">${esc(name)}</div>
                ${myDriveSharedIndicator(item)}
              </div>
              ${sharedByLine}
              <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${esc(myDriveFileCategory(item))} - ${esc(formatBytes(item.file_size || 0))}</div>
            </div>
            ${renderMyDriveActions(item, 'grid')}
          </div>
        </div>`;
      }
      return `<div data-drive-kind="${item.kind}" data-drive-id="${Number(item.id)}" ${dropAttrs} class="group min-h-12 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 min-w-0 transition cursor-default overflow-hidden" onclick="selectMyDriveItem(event, ${Number(item.id)}, '${item.kind}')" oncontextmenu="openMyDriveItemMenu(event, ${Number(item.id)}, '${item.kind}')" onpointerdown="startMyDriveLongPress(event, ${Number(item.id)}, '${item.kind}')" onpointerup="cancelMyDriveLongPress()" onpointercancel="cancelMyDriveLongPress()" onpointerleave="cancelMyDriveLongPress()">
        <div class="flex h-full items-center gap-3 min-w-0">
          <div class="shrink-0">${myDriveIcon(item)}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="block min-w-0 flex-1 text-left text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title="${esc(name)}">${esc(name)}</div>
              ${myDriveSharedIndicator(item)}
            </div>
            ${sharedByLine}
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${esc(meta)}</div>
          </div>
          ${renderMyDriveActions(item, 'grid')}
        </div>
      </div>`;
    }

    function myDriveSortButtonHtml(iconOnly = false) {
      return `<button type="button" onclick="openMyDriveSortMenu(event)" class="ml-auto inline-flex h-9 items-center justify-center gap-1.5 rounded px-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Sort" title="View sort options"><svg class="h-5 w-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h10M8 12h7M8 17h4M5 7h.01M5 12h.01M5 17h.01"/></svg>${iconOnly ? '' : '<span class="text-sm font-bold">Sort</span>'}</button>`;
    }

    function myDriveListHeaderHtml() {
      if (myDriveTab === 'trash') {
        return `<tr class="h-12 text-left border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"><th class="px-4 font-black uppercase text-xs">Name</th><th class="px-4 font-black uppercase text-xs">Owner</th><th class="px-4 font-black uppercase text-xs">Date trashed</th><th class="px-4 font-black uppercase text-xs">File size</th><th class="px-4 font-black uppercase text-xs">Original location</th><th class="w-12 px-2 text-right font-black uppercase text-xs" aria-label="Sort">${myDriveSortButtonHtml(true)}</th><th class="w-12 px-2 text-right font-black uppercase text-xs" aria-label="Actions"></th></tr>`;
      }
      return `<tr class="h-12 text-left border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"><th class="px-4 font-black uppercase text-xs">Name</th><th class="px-4 font-black uppercase text-xs">Type</th><th class="px-4 font-black uppercase text-xs">Size</th>${myDriveTab === 'shared' ? '<th class="px-4 font-black uppercase text-xs">Shared by</th><th class="px-4 font-black uppercase text-xs">Date shared</th>' : '<th class="px-4 font-black uppercase text-xs">Updated</th>'}<th class="w-[5.75rem] px-2 text-right font-black uppercase text-xs" aria-label="Actions">${myDriveSortButtonHtml(false)}</th></tr>`;
    }

    function myDriveOriginalLocation(item = {}) {
      return item.original_location || item.parent_folder_name || (item.parent_folder_id ? 'Folder' : 'My Drive');
    }

    function renderMyDriveRow(item) {
      const name = myDriveItemName(item);
      const dropAttrs = item.kind === 'folder' && myDriveTab === 'mine' ? ` draggable="true" ondragstart="startMyDriveItemDrag(event, ${Number(item.id)}, '${item.kind}')" ondragover="handleMyDriveFolderDragOver(event)" ondragleave="handleMyDriveFolderDragLeave(event)" ondrop="dropMyDriveItemsOnFolder(event, ${Number(item.id)})"` : ` draggable="true" ondragstart="startMyDriveItemDrag(event, ${Number(item.id)}, '${item.kind}')"`;
      const clickAttr = `selectMyDriveItem(event, ${Number(item.id)}, '${item.kind}')`;
      const dblClickAttr = '';
      if (myDriveTab === 'trash') {
        return `<tr data-drive-kind="${item.kind}" data-drive-id="${Number(item.id)}" ${dropAttrs} class="h-12 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70 ${item.kind === 'folder' ? 'cursor-pointer' : 'cursor-default'}" onclick="${clickAttr}"${dblClickAttr} oncontextmenu="openMyDriveItemMenu(event, ${Number(item.id)}, '${item.kind}')" onpointerdown="startMyDriveLongPress(event, ${Number(item.id)}, '${item.kind}')" onpointerup="cancelMyDriveLongPress()" onpointercancel="cancelMyDriveLongPress()" onpointerleave="cancelMyDriveLongPress()">
          <td class="px-4 min-w-[16rem]"><div class="flex items-center gap-3 min-w-0">${myDriveIcon(item)}<span class="font-medium text-left truncate">${esc(name)}</span></div></td>
          <td class="px-4 text-gray-500">${esc(displayUsername(item.owner_username || currentUser?.username || 'Owner'))}</td>
          <td class="px-4 text-gray-500">${fmtDateTime(item.deleted_at || item.updated_at || item.created_at)}</td>
          <td class="px-4 text-gray-500">${item.kind === 'folder' ? formatBytes(Number(item.folder_size ?? item.file_size ?? 0)) : formatBytes(item.file_size || 0)}</td>
          <td class="px-4 text-gray-500">${esc(myDriveOriginalLocation(item))}</td>
          <td class="px-2"></td>
          <td class="px-2 text-right">${renderMyDriveActions(item, 'list')}</td>
        </tr>`;
      }
      return `<tr data-drive-kind="${item.kind}" data-drive-id="${Number(item.id)}" ${dropAttrs} class="h-12 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70 ${item.kind === 'folder' ? 'cursor-pointer' : 'cursor-default'}" onclick="${clickAttr}"${dblClickAttr} oncontextmenu="openMyDriveItemMenu(event, ${Number(item.id)}, '${item.kind}')" onpointerdown="startMyDriveLongPress(event, ${Number(item.id)}, '${item.kind}')" onpointerup="cancelMyDriveLongPress()" onpointercancel="cancelMyDriveLongPress()" onpointerleave="cancelMyDriveLongPress()">
        <td class="px-4 min-w-[16rem]"><div class="flex items-center gap-3 min-w-0">${myDriveIcon(item)}<span class="font-medium text-left truncate">${esc(name)}</span>${myDriveSharedIndicator(item)}</div></td>
        <td class="px-4 text-gray-500">${item.kind === 'folder' ? 'Folder' : esc(myDriveFileCategory(item))}</td>
        <td class="px-4 text-gray-500">${item.kind === 'folder' ? formatBytes(Number(item.folder_size ?? item.file_size ?? 0)) : formatBytes(item.file_size || 0)}</td>
        ${myDriveTab === 'shared' ? `<td class="px-4 text-gray-500">${esc(item.shared_by_name || item.shared_by_username || '-')}</td><td class="px-4 text-gray-500">${fmtDateTime(item.shared_at || item.created_at)}</td>` : `<td class="px-4 text-gray-500">${fmtDateTime(item.updated_at || item.uploaded_at || item.created_at)}</td>`}
        <td class="px-2 text-right">${renderMyDriveActions(item, 'list')}</td>
      </tr>`;
    }

    function renderMyDriveActions(item, view = myDriveMode) {
      const sizeClass = view === 'list' ? 'h-9 w-9 p-[9px]' : 'h-8 w-8 p-[7px]';
      return `<button type="button" onclick="openMyDriveItemMenu(event, ${Number(item.id)}, '${item.kind}')" class="shrink-0 ${sizeClass} rounded text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 inline-flex items-center justify-center align-middle" title="More actions" aria-label="More actions" data-drive-menu-trigger="1">
        <svg class="w-[18px] h-[18px] pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/></svg>
      </button>`;
    }

    function renderMyDriveFilePreview(item = {}) {
      const category = myDriveFileCategory(item);
      const ext = String(item.file_ext || '').replace('.', '').toUpperCase() || category.toUpperCase();
      if (category === 'Image') {
        return `<div class="relative h-32 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden"><div data-drive-thumb="${Number(item.id)}" class="absolute inset-0 grid place-items-center bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200"><span class="text-xs font-black">${esc(ext.slice(0, 4))}</span></div></div>`;
      }
      return `<div class="h-32 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 grid place-items-center overflow-hidden"><div class="h-16 w-16 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 grid place-items-center text-sm font-black text-gray-700 dark:text-gray-200">${esc(ext.slice(0, 4))}</div></div>`;
    }

    function cleanupMyDriveThumbUrls() {
      myDriveThumbUrls.forEach(url => URL.revokeObjectURL(url));
      myDriveThumbUrls.clear();
    }

    async function hydrateMyDriveThumbnails() {
      const targets = [...document.querySelectorAll('[data-drive-thumb]')];
      if (!targets.length) return;
      await Promise.all(targets.map(async target => {
        const id = Number(target.dataset.driveThumb || 0);
        if (!id || !document.body.contains(target)) return;
        try {
          const blob = await fetchMyDriveFileBlob(id, 'view');
          if (!blob.type.startsWith('image/')) return;
          const url = URL.createObjectURL(blob);
          myDriveThumbUrls.set(id, url);
          if (!document.body.contains(target)) {
            URL.revokeObjectURL(url);
            myDriveThumbUrls.delete(id);
            return;
          }
          target.className = 'absolute inset-0 bg-white dark:bg-gray-950';
          target.innerHTML = `<img src="${esc(url)}" alt="" class="h-full w-full object-cover">`;
        } catch (_) {}
      }));
    }

    function ensureMyDriveSortMenu() {
      let menu = document.getElementById('myDriveSortMenu');
      if (menu) return menu;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveSortMenu" class="hidden fixed z-[120] w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-1 text-sm" role="menu" aria-label="Sort controls"></div>`);
      document.addEventListener('click', event => {
        const target = event.target;
        if (!target?.closest?.('#myDriveSortMenu') && !target?.closest?.('[aria-label="Sort"]')) closeMyDriveSortMenu();
      });
      window.addEventListener('scroll', closeMyDriveSortMenu, true);
      window.addEventListener('resize', closeMyDriveSortMenu);
      return document.getElementById('myDriveSortMenu');
    }

    function closeMyDriveSortMenu() {
      document.getElementById('myDriveSortMenu')?.classList.add('hidden');
    }

    function myDriveSortMenuRadio(label, checked, action) {
      return `<button type="button" role="menuitemradio" aria-checked="${checked ? 'true' : 'false'}" onclick="${action}; closeMyDriveSortMenu();" class="w-full h-9 px-3 rounded-lg text-left text-sm font-medium flex items-center gap-3 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span class="w-5 shrink-0">${checked ? '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10.5 8 14l8-8"/></svg>' : ''}</span><span class="flex-1 truncate">${esc(label)}</span></button>`;
    }

    function renderMyDriveSortMenu() {
      const directionLabels = myDriveSortDirectionLabels();
      const sortOptions = [['name', 'Name'], ['modified', myDriveTab === 'trash' ? 'Date trashed' : 'Date modified'], ['type', 'Type'], ['size', 'Size']];
      if (myDriveTab === 'shared') sortOptions.push(['sharedBy', 'Shared by'], ['sharedAt', 'Date shared']);
      return `<div class="px-3 pt-2 pb-1 text-[11px] font-black uppercase text-gray-400 dark:text-gray-500">Sort by</div>
        ${sortOptions.map(([value, label]) => myDriveSortMenuRadio(label, myDriveSortBy === value, `setMyDriveSort('${value}')`)).join('')}
        <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
        <div class="px-3 pt-2 pb-1 text-[11px] font-black uppercase text-gray-400 dark:text-gray-500">Sort direction</div>
        ${myDriveSortMenuRadio(directionLabels.asc, myDriveSortDir === 'asc', `setMyDriveSortDirection('asc')`)}
        ${myDriveSortMenuRadio(directionLabels.desc, myDriveSortDir === 'desc', `setMyDriveSortDirection('desc')`)}
        <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
        ${myDriveSortMenuRadio('On top', myDriveFoldersFirst, `setMyDriveFolderPlacement(true)`)}
        ${myDriveSortMenuRadio('Mixed with files', !myDriveFoldersFirst, `setMyDriveFolderPlacement(false)`)}`;
    }

    function openMyDriveSortMenu(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const menu = ensureMyDriveSortMenu();
      menu.innerHTML = renderMyDriveSortMenu();
      menu.classList.remove('hidden');
      const buttonRect = event?.currentTarget?.getBoundingClientRect?.();
      const x = buttonRect ? buttonRect.right - menu.offsetWidth : (event?.clientX || 24);
      const y = buttonRect ? buttonRect.bottom + 6 : (event?.clientY || 24);
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    }

    function setMyDriveSort(sortBy) {
      const previous = myDriveSortBy;
      myDriveSortBy = sortBy || 'name';
      if (previous !== myDriveSortBy) myDriveSortDir = ['modified', 'sharedAt', 'size'].includes(myDriveSortBy) ? 'desc' : 'asc';
      persistCurrentAppState();
      renderMyDrive();
    }

    function setMyDriveSortDirection(direction) {
      myDriveSortDir = direction === 'desc' ? 'desc' : 'asc';
      persistCurrentAppState();
      renderMyDrive();
    }

    function setMyDriveFolderPlacement(onTop) {
      myDriveFoldersFirst = !!onTop;
      persistCurrentAppState();
      renderMyDrive();
    }

    function openMyDriveFolder(id) {
      myDriveFolderId = id ? Number(id) : null;
      clearMyDriveSelection();
      updateAppHistory('myDrive');
      loadMyDrive();
    }

    function myDriveParentFolderId() {
      const crumbs = myDriveCache.breadcrumbs || [];
      if (!myDriveFolderId && !crumbs.length) return null;
      return crumbs.length > 1 ? Number(crumbs[crumbs.length - 2].id) : null;
    }

    function goBackMyDrive() {
      if (appCurrentView !== 'myDrive') return;
      history.back();
    }

    function goUpMyDriveFolder() {
      if (appCurrentView !== 'myDrive' || !myDriveFolderId) return false;
      const parentId = myDriveParentFolderId();
      if (myDriveTab === 'trash') openMyDriveTrashFolder(parentId);
      else openMyDriveFolder(parentId);
      return true;
    }

    function ensureMyDriveNewMenu() {
      let menu = document.getElementById('myDriveNewMenu');
      if (menu) return menu;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveNewMenu" class="hidden fixed z-[121] min-w-[14rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-1 text-sm"></div>`);
      document.addEventListener('click', event => {
        const target = event.target;
        if (!target?.closest?.('#myDriveNewMenu')) closeMyDriveNewMenu();
      });
      window.addEventListener('scroll', closeMyDriveNewMenu, true);
      window.addEventListener('resize', closeMyDriveNewMenu);
      return document.getElementById('myDriveNewMenu');
    }

    function closeMyDriveNewMenu() {
      document.getElementById('myDriveNewMenu')?.classList.add('hidden');
    }

    function myDriveNewMenuButton(label, action, icon) {
      return `<button type="button" onclick="${action}; closeMyDriveNewMenu();" class="w-full text-left px-3 py-2 rounded-lg font-semibold flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">${myDriveMenuIcon(icon)}<span>${esc(label)}</span></button>`;
    }

    function openMyDriveNewMenu(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (myDriveTab !== 'mine') {
        myDriveTab = 'mine';
        myDriveFolderId = null;
        updateAppHistory('myDrive');
        loadMyDrive();
      }
      ensureMyDriveUploadModal();
      ensureMyDriveQuickUploadInputs();
      const menu = ensureMyDriveNewMenu();
      menu.innerHTML = [
        myDriveNewMenuButton('New folder', 'openMyDriveFolderModal()', 'folder'),
        myDriveNewMenuButton('File upload', "document.getElementById('myDriveQuickFileInput')?.click()", 'upload'),
        myDriveNewMenuButton('Folder upload', "document.getElementById('myDriveQuickFolderInput')?.click()", 'folderUpload')
      ].join('');
      menu.classList.remove('hidden');
      const x = event?.clientX || event?.target?.getBoundingClientRect?.().left || 24;
      const y = event?.clientY || event?.target?.getBoundingClientRect?.().bottom || 24;
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    }

    function startMyDriveBlankLongPress(event) {
      cancelMyDriveBlankLongPress();
      if (event.pointerType === 'mouse' || event.button) return;
      myDriveBlankLongPressTimer = setTimeout(() => openMyDriveNewMenu(event), 550);
    }

    function cancelMyDriveBlankLongPress() {
      if (myDriveBlankLongPressTimer) clearTimeout(myDriveBlankLongPressTimer);
      myDriveBlankLongPressTimer = null;
    }

    function ensureMyDriveSelectionBox() {
      let box = document.getElementById('myDriveSelectionBox');
      if (box) return box;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveSelectionBox" class="hidden fixed z-[119] border border-blue-500 bg-blue-500/10 pointer-events-none rounded"></div>`);
      return document.getElementById('myDriveSelectionBox');
    }

    function startMyDriveSelectionBox(event) {
      if (appCurrentView !== 'myDrive' || !['mine', 'trash'].includes(myDriveTab)) return;
      event.preventDefault();
      cancelMyDriveBlankLongPress();
      myDriveSelectionBoxState = {
        startX: event.clientX,
        startY: event.clientY,
        additive: event.ctrlKey || event.metaKey,
        base: new Map(myDriveSelectedItems)
      };
      if (!myDriveSelectionBoxState.additive) myDriveSelectedItems.clear();
      const box = ensureMyDriveSelectionBox();
      box.classList.remove('hidden');
      updateMyDriveSelectionBox(event);
      document.addEventListener('pointermove', updateMyDriveSelectionBox);
      document.addEventListener('pointerup', finishMyDriveSelectionBox, { once: true });
    }

    function rectsIntersect(a, b) {
      return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
    }

    function updateMyDriveSelectionBox(event) {
      if (!myDriveSelectionBoxState) return;
      const x1 = myDriveSelectionBoxState.startX;
      const y1 = myDriveSelectionBoxState.startY;
      const x2 = event.clientX;
      const y2 = event.clientY;
      const rect = {
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        right: Math.max(x1, x2),
        bottom: Math.max(y1, y2)
      };
      const box = ensureMyDriveSelectionBox();
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${Math.max(1, rect.right - rect.left)}px`;
      box.style.height = `${Math.max(1, rect.bottom - rect.top)}px`;
      myDriveSelectedItems = new Map(myDriveSelectionBoxState.base);
      document.querySelectorAll('#myDriveContent [data-drive-kind][data-drive-id]').forEach(el => {
        if (!rectsIntersect(rect, el.getBoundingClientRect())) return;
        const item = { kind: el.dataset.driveKind, id: Number(el.dataset.driveId) };
        myDriveSelectedItems.set(myDriveSelectionKey(item), item);
      });
      const last = [...myDriveSelectedItems.values()].at(-1);
      myDriveSelectedItem = last || null;
      updateMyDriveSelectionVisuals();
    }

    function finishMyDriveSelectionBox(event) {
      document.removeEventListener('pointermove', updateMyDriveSelectionBox);
      updateMyDriveSelectionBox(event);
      document.getElementById('myDriveSelectionBox')?.classList.add('hidden');
      myDriveSelectionBoxState = null;
    }

    function openMyDriveTrashFolder(id) {
      myDriveTab = 'trash';
      myDriveFolderId = id ? Number(id) : null;
      clearMyDriveSelection();
      updateAppHistory('myDrive');
      loadMyDrive();
    }

    let myDriveLongPressTimer = null;

    function findMyDriveItem(id, kind) {
      const list = kind === 'folder' ? (myDriveCache.folders || []) : (myDriveCache.files || []);
      return list.find(item => Number(item.id) === Number(id));
    }

    function ensureMyDriveItemMenu() {
      let menu = document.getElementById('myDriveItemMenu');
      if (menu) return menu;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveItemMenu" class="hidden fixed z-[120] min-w-[13rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-1 text-sm"></div>`);
      document.addEventListener('click', event => {
        const target = event.target;
        if (!target?.closest?.('#myDriveItemMenu') && !target?.closest?.('[aria-label^="More actions"]')) closeMyDriveItemMenu();
      });
      window.addEventListener('scroll', closeMyDriveItemMenu, true);
      window.addEventListener('resize', closeMyDriveItemMenu);
      return document.getElementById('myDriveItemMenu');
    }

    function closeMyDriveItemMenu() {
      document.getElementById('myDriveItemMenu')?.classList.add('hidden');
    }

    function myDriveMenuIcon(type) {
      const icons = {
        open: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3h6v6m-11 5L21 3M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6"/></svg>',
        download: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 21h16"/></svg>',
        copy: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
        share: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684l6.632 3.316m-6.632-6.632l6.632-3.316M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zm12 7a3 3 0 100-6 3 3 0 000 6z"/></svg>',
        rename: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        trash: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3m-8 0h10"/></svg>',
        folder: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>',
        upload: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
        folderUpload: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v4m-7 6v-8m0 0l-3 3m3-3l3 3"/></svg>',
        restore: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l4 4 4-4H6c0-3.86 3.14-7 7-7s7 3.14 7 7-3.14 7-7 7c-1.93 0-3.68-.78-4.95-2.05l-1.42 1.42C8.27 20.99 10.51 22 13 22c4.97 0 9-4.03 9-9s-4.03-10-9-10zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
        deleteForever: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m4 4l6 6m0-6l-6 6M9 7V4h6v3m-8 0h10"/></svg>',
        info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10.75v5.5M12 7.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        move: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10m0 0l-3-3m3 3l-3 3M17 17H7m0 0l3 3m-3-3l3-3"/></svg>',
        map: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5" stroke-width="2"/></svg>',
        typeAll: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
        typeDocument: '<svg class="w-4 h-4 text-blue-600 dark:text-blue-300" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>',
        typeImage: '<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM5 18l4.5-5 3.2 3.55L15.5 13 19 18H5z"/></svg>',
        typeVideo: '<svg class="w-4 h-4 text-rose-600 dark:text-rose-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-4.5l4 4v-11l-4 4z"/></svg>',
        typeZip: '<svg class="w-4 h-4 text-amber-600 dark:text-amber-300" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 2.5L17.5 8H14V4.5zM9 4h2v2H9V4zm2 2h2v2h-2V6zM9 8h2v2H9V8zm2 2h2v2h-2v-2zm-2 2h2v2H9v-2zm1 3h3v4H8v-2a2 2 0 012-2z"/></svg>',
        typeModified: '<svg class="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M8 3v4m8-4v4M3 10h18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14v3l2 1"/></svg>'
      };
      return icons[type] || '';
    }

    function myDriveMenuButton(label, action, icon = 'open', danger = false) {
      return `<button type="button" role="menuitem" onclick="${action}; closeMyDriveItemMenu();" class="w-full h-9 text-left px-3 rounded-lg text-sm font-medium flex items-center gap-3 ${danger ? 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}">${myDriveMenuIcon(icon)}<span class="flex-1 truncate">${esc(label)}</span></button>`;
    }

    function myDriveMenuSeparator() {
      return '<div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>';
    }

    function myDriveMenuHeading(label) {
      return `<div class="px-3 pt-2 pb-1 text-[11px] font-black uppercase text-gray-400 dark:text-gray-500">${esc(label)}</div>`;
    }

    const MY_DRIVE_TYPE_FILTERS = [
      { value: '', label: 'All types', icon: 'typeAll' },
      { value: 'document', label: 'Documents', icon: 'typeDocument' },
      { value: 'image', label: 'Images', icon: 'typeImage' },
      { value: 'video', label: 'Videos', icon: 'typeVideo' },
      { value: 'zip', label: 'ZIP', icon: 'typeZip' }
    ];

    function currentMyDriveTypeFilter() {
      return document.getElementById('myDriveTypeFilter')?.value || '';
    }

    function updateMyDriveTypeFilterButton() {
      const current = MY_DRIVE_TYPE_FILTERS.find(item => item.value === currentMyDriveTypeFilter()) || MY_DRIVE_TYPE_FILTERS[0];
      const label = document.getElementById('myDriveTypeFilterLabel');
      const icon = document.getElementById('myDriveTypeFilterIcon');
      const button = document.getElementById('myDriveTypeFilterBtn');
      if (label) label.textContent = current.label;
      if (icon) icon.innerHTML = myDriveMenuIcon(current.icon);
      const menu = document.getElementById('myDriveTypeFilterMenu');
      if (button) button.setAttribute('aria-expanded', menu && !menu.classList.contains('hidden') ? 'true' : 'false');
    }

    function ensureMyDriveTypeFilterMenu() {
      let menu = document.getElementById('myDriveTypeFilterMenu');
      if (menu) return menu;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveTypeFilterMenu" class="hidden fixed z-[120] min-w-[12rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-1 text-sm" role="menu" aria-label="File type filter"></div>`);
      document.addEventListener('click', event => {
        const target = event.target;
        if (!target?.closest?.('#myDriveTypeFilterMenu') && !target?.closest?.('#myDriveTypeFilterBtn')) closeMyDriveTypeFilterMenu();
      });
      window.addEventListener('scroll', closeMyDriveTypeFilterMenu, true);
      window.addEventListener('resize', closeMyDriveTypeFilterMenu);
      return document.getElementById('myDriveTypeFilterMenu');
    }

    function closeMyDriveTypeFilterMenu() {
      document.getElementById('myDriveTypeFilterMenu')?.classList.add('hidden');
      updateMyDriveTypeFilterButton();
    }

    function renderMyDriveTypeFilterMenu() {
      const current = currentMyDriveTypeFilter();
      return MY_DRIVE_TYPE_FILTERS.map(item => `<button type="button" role="menuitemradio" aria-checked="${item.value === current ? 'true' : 'false'}" onclick="setMyDriveTypeFilter('${item.value}')" class="w-full h-9 text-left px-3 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">${myDriveMenuIcon(item.icon)}<span class="flex-1 truncate">${esc(item.label)}</span><span class="w-5 shrink-0">${item.value === current ? '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10.5 8 14l8-8"/></svg>' : ''}</span></button>`).join('');
    }

    function openMyDriveTypeFilterMenu(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      closeMyDriveModifiedFilterMenu();
      const menu = ensureMyDriveTypeFilterMenu();
      menu.innerHTML = renderMyDriveTypeFilterMenu();
      menu.classList.remove('hidden');
      const buttonRect = event?.currentTarget?.getBoundingClientRect?.();
      const rect = menu.getBoundingClientRect();
      const x = buttonRect ? buttonRect.left : (event?.clientX || 24);
      const y = buttonRect ? buttonRect.bottom + 6 : (event?.clientY || 24);
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
      updateMyDriveTypeFilterButton();
    }

    function setMyDriveTypeFilter(value) {
      const input = document.getElementById('myDriveTypeFilter');
      if (input) input.value = value || '';
      closeMyDriveTypeFilterMenu();
      persistCurrentAppState();
      loadMyDrive();
    }

    function myDriveModifiedFilterOptions() {
      const year = new Date().getFullYear();
      return [
        { value: '', label: 'Modified', icon: 'typeModified' },
        { value: 'today', label: 'Today', icon: 'typeModified' },
        { value: 'last7', label: 'Last 7 days', icon: 'typeModified' },
        { value: 'last30', label: 'Last 30 days', icon: 'typeModified' },
        { value: 'thisYear', label: `This Year (${year})`, icon: 'typeModified' },
        { value: 'lastYear', label: `Last year (${year - 1})`, icon: 'typeModified' }
      ];
    }

    function currentMyDriveModifiedFilter() {
      return document.getElementById('myDriveModifiedFilter')?.value || '';
    }

    function updateMyDriveModifiedFilterButton() {
      const options = myDriveModifiedFilterOptions();
      const current = options.find(item => item.value === currentMyDriveModifiedFilter()) || options[0];
      const label = document.getElementById('myDriveModifiedFilterLabel');
      const icon = document.getElementById('myDriveModifiedFilterIcon');
      const button = document.getElementById('myDriveModifiedFilterBtn');
      const menu = document.getElementById('myDriveModifiedFilterMenu');
      if (label) label.textContent = current.label;
      if (icon) icon.innerHTML = myDriveMenuIcon(current.icon);
      if (button) button.setAttribute('aria-expanded', menu && !menu.classList.contains('hidden') ? 'true' : 'false');
    }

    function ensureMyDriveModifiedFilterMenu() {
      let menu = document.getElementById('myDriveModifiedFilterMenu');
      if (menu) return menu;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveModifiedFilterMenu" class="hidden fixed z-[120] min-w-[13rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-1 text-sm" role="menu" aria-label="Modified filter"></div>`);
      document.addEventListener('click', event => {
        const target = event.target;
        if (!target?.closest?.('#myDriveModifiedFilterMenu') && !target?.closest?.('#myDriveModifiedFilterBtn')) closeMyDriveModifiedFilterMenu();
      });
      window.addEventListener('scroll', closeMyDriveModifiedFilterMenu, true);
      window.addEventListener('resize', closeMyDriveModifiedFilterMenu);
      return document.getElementById('myDriveModifiedFilterMenu');
    }

    function closeMyDriveModifiedFilterMenu() {
      document.getElementById('myDriveModifiedFilterMenu')?.classList.add('hidden');
      updateMyDriveModifiedFilterButton();
    }

    function renderMyDriveModifiedFilterMenu() {
      const current = currentMyDriveModifiedFilter();
      return myDriveModifiedFilterOptions().map(item => `<button type="button" role="menuitemradio" aria-checked="${item.value === current ? 'true' : 'false'}" onclick="setMyDriveModifiedFilter('${item.value}')" class="w-full h-9 text-left px-3 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">${myDriveMenuIcon(item.icon)}<span class="flex-1 truncate">${esc(item.label)}</span><span class="w-5 shrink-0">${item.value === current ? '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10.5 8 14l8-8"/></svg>' : ''}</span></button>`).join('');
    }

    function openMyDriveModifiedFilterMenu(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      closeMyDriveTypeFilterMenu();
      const menu = ensureMyDriveModifiedFilterMenu();
      menu.innerHTML = renderMyDriveModifiedFilterMenu();
      menu.classList.remove('hidden');
      const buttonRect = event?.currentTarget?.getBoundingClientRect?.();
      const rect = menu.getBoundingClientRect();
      const x = buttonRect ? buttonRect.left : (event?.clientX || 24);
      const y = buttonRect ? buttonRect.bottom + 6 : (event?.clientY || 24);
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
      updateMyDriveModifiedFilterButton();
    }

    function setMyDriveModifiedFilter(value) {
      const input = document.getElementById('myDriveModifiedFilter');
      if (input) input.value = value || '';
      closeMyDriveModifiedFilterMenu();
      persistCurrentAppState();
      renderMyDrive();
    }

    function myDriveItemModifiedDate(item) {
      const raw = item?.updated_at || item?.uploaded_at || item?.deleted_at || item?.created_at;
      const date = raw ? new Date(raw) : null;
      return date && !Number.isNaN(date.getTime()) ? date : null;
    }

    function myDriveMatchesModifiedFilter(item, filter = currentMyDriveModifiedFilter()) {
      if (!filter) return true;
      const date = myDriveItemModifiedDate(item);
      if (!date) return false;
      const now = new Date();
      if (filter === 'today') {
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      }
      if (filter === 'last7') return date.getTime() >= now.getTime() - (7 * 24 * 60 * 60 * 1000);
      if (filter === 'last30') return date.getTime() >= now.getTime() - (30 * 24 * 60 * 60 * 1000);
      if (filter === 'thisYear') return date.getFullYear() === now.getFullYear();
      if (filter === 'lastYear') return date.getFullYear() === now.getFullYear() - 1;
      return true;
    }

    function renderMyDriveItemMenu(item) {
      if (!item) return '<div class="px-3 py-2 text-gray-500 dark:text-gray-400">No actions available</div>';
      if (myDriveTab === 'trash') {
        const selected = getMyDriveActionItems(item);
        const suffix = selected.length > 1 ? ` (${selected.length})` : '';
        return [
          myDriveMenuButton(`Restore${suffix}`, `restoreMyDriveSelection(${Number(item.id)}, '${item.kind}')`, 'restore'),
          myDriveMenuButton(`Delete forever${suffix}`, `deleteMyDriveSelectionForever(${Number(item.id)}, '${item.kind}')`, 'deleteForever', true)
        ].join('');
      }
      const canOwnerActions = myDriveTab === 'mine';
      if (item.kind === 'folder') {
        return [
          myDriveMenuButton('Download', `downloadMyDriveSelectionFromMenu(${Number(item.id)}, 'folder')`, 'download'),
          canOwnerActions && myDriveActionAllowed('share') ? myDriveMenuButton('Share', `openMyDriveShareModal(${Number(item.id)}, 'folder')`, 'share') : '',
          canOwnerActions && myDriveActionAllowed('manage') ? myDriveMenuButton('Rename', `openMyDriveFolderModal(${Number(item.id)})`, 'rename') : '',
          myDriveMenuSeparator(),
          myDriveMenuHeading('Organize'),
          canOwnerActions && myDriveActionAllowed('manage') ? myDriveMenuButton('Move', `setMyDriveClipboard('cut')`, 'move') : '',
          myDriveMenuSeparator(),
          myDriveMenuButton('Folder information', `openMyDriveInfoModal(${Number(item.id)}, 'folder')`, 'info'),
          canOwnerActions && myDriveActionAllowed('delete') ? myDriveMenuButton('Move to trash', `deleteMyDriveFolder(${Number(item.id)})`, 'trash', true) : ''
        ].join('');
      }
      return [
        myDriveMenuButton('Open', `viewMyDriveFile(${Number(item.id)})`, 'open'),
        myDriveMenuButton('Download', `downloadMyDriveSelectionFromMenu(${Number(item.id)}, 'file')`, 'download'),
        ['.jpg', '.jpeg'].includes(String(item.file_ext || '').toLowerCase()) && hasPrivilege('view_abearc_map') && hasPrivilege('upload_map_media') ? myDriveMenuButton('Add to Geotag Map', `addMyDrivePhotosToGeotagMap(${Number(item.id)}, 'file')`, 'map') : '',
        canOwnerActions && myDriveActionAllowed('manage') ? myDriveMenuButton('Rename', `openMyDriveFileModal(${Number(item.id)})`, 'rename') : '',
        canOwnerActions && myDriveActionAllowed('share') ? myDriveMenuButton('Share', `openMyDriveShareModal(${Number(item.id)}, 'file')`, 'share') : '',
        myDriveMenuSeparator(),
        myDriveMenuHeading('Organize'),
        canOwnerActions && myDriveActionAllowed('manage') ? myDriveMenuButton('Move', `setMyDriveClipboard('cut')`, 'move') : '',
        hasPrivilege('attach_drive_file_to_project') ? myDriveMenuButton('Copy to', `openMyDriveCopyModal(${Number(item.id)})`, 'copy') : '',
        myDriveMenuSeparator(),
        myDriveMenuButton('File information', `openMyDriveInfoModal(${Number(item.id)}, 'file')`, 'info'),
        canOwnerActions && myDriveActionAllowed('delete') ? myDriveMenuButton('Move to trash', `deleteMyDriveFile(${Number(item.id)})`, 'trash', true) : ''
      ].join('');
    }

    function getMyDriveActionItems(fallbackItem = null) {
      if (fallbackItem) {
        const key = myDriveSelectionKey(fallbackItem);
        if (!myDriveSelectedItems.has(key)) {
          myDriveSelectedItems.clear();
          myDriveSelectedItems.set(key, { id: Number(fallbackItem.id), kind: fallbackItem.kind });
          myDriveSelectedItem = { id: Number(fallbackItem.id), kind: fallbackItem.kind };
          updateMyDriveSelectionVisuals();
        }
      }
      return [...myDriveSelectedItems.values()];
    }

    function openMyDriveItemMenu(event, id, kind) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const item = findMyDriveItem(id, kind);
      const menu = ensureMyDriveItemMenu();
      menu.innerHTML = renderMyDriveItemMenu(item);
      menu.classList.remove('hidden');
      const x = event?.clientX || 24;
      const y = event?.clientY || 24;
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    }

    async function addMyDrivePhotosToGeotagMap(id, kind = 'file') {
      const files = getMyDriveActionItems({ id: Number(id), kind })
        .filter(item => item.kind === 'file')
        .map(item => findMyDriveItem(item.id, 'file'))
        .filter(item => item && ['.jpg', '.jpeg'].includes(String(item.file_ext || '').toLowerCase()));
      if (!files.length) return toast('Select JPG/JPEG GeoCam photos to add.', 'error');
      let added = 0, duplicate = 0, skipped = 0, firstMapId = null;
      for (const file of files) {
        try {
          const result = await fetchJson(`${API}/user-drive/files/${Number(file.id)}/add-to-geotag-map`, { method: 'POST', silentLoading: true });
          if (result.duplicate) duplicate += 1; else added += 1;
          firstMapId = firstMapId || Number(result.map_media_id || 0);
        } catch (_) {
          skipped += 1;
        }
      }
      toast(`Geotag Map: ${added} added, ${duplicate} already there, ${skipped} skipped.`);
      if (firstMapId) {
        await showAbearcMap();
        if (typeof focusAbearcMapPhoto === 'function') await focusAbearcMapPhoto(firstMapId);
        else await openAbearcMapDetails(firstMapId);
      }
    }

    function myDriveInfoRow(label, value) {
      if (value === undefined || value === null || value === '') return '';
      return `<div class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"><div class="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">${esc(label)}</div><div class="min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 break-words">${value}</div></div>`;
    }

    function getMyDriveSelectedFullItem() {
      if (!myDriveSelectedItem) return null;
      return findMyDriveItem(myDriveSelectedItem.id, myDriveSelectedItem.kind);
    }

    function currentMyDriveLocationLabel() {
      const crumbs = myDriveCache.breadcrumbs || [];
      if (crumbs.length) return crumbs[crumbs.length - 1]?.name || 'Folder';
      if (myDriveTab === 'shared') return 'Shared with me';
      if (myDriveTab === 'trash') return 'Trash';
      return 'My Drive';
    }

    function renderMyDriveDetailsRows(item) {
      if (!item) return '';
      const isFolder = item.kind === 'folder';
      const owner = item.owner_name || item.owner_username || item.created_by_name || item.created_by || '';
      const sharedBy = item.shared_by_name || item.shared_by_username || item.owner_name || item.owner_username || '';
      const size = isFolder ? formatBytes(Number(item.folder_size || item.size || 0)) : formatBytes(Number(item.file_size || item.size || 0));
      const updated = item.updated_at ? fmtDateTime(item.updated_at) : '';
      const created = item.created_at ? fmtDateTime(item.created_at) : '';
      const sharedAt = item.shared_at ? fmtDateTime(item.shared_at) : '';
      const ext = !isFolder ? (item.extension || fileExtension(item.original_name || item.title || '') || '').replace('.', '').toUpperCase() : '';
      return [
        myDriveInfoRow('Type', esc(isFolder ? 'Folder' : myDriveFileCategory(item))),
        myDriveInfoRow('Owner', esc(displayUsername(owner || 'You'))),
        myDriveInfoRow('Size', esc(size)),
        isFolder ? myDriveInfoRow('Files', esc(String(Number(item.file_count || 0)))) : '',
        ext ? myDriveInfoRow('Extension', esc(ext)) : '',
        myDriveInfoRow('Location', esc(currentMyDriveLocationLabel())),
        updated ? myDriveInfoRow('Modified', esc(updated)) : '',
        created ? myDriveInfoRow('Created', esc(created)) : '',
        sharedBy && myDriveTab === 'shared' ? myDriveInfoRow('Shared by', esc(displayUsername(sharedBy))) : '',
        sharedAt && myDriveTab === 'shared' ? myDriveInfoRow('Date shared', esc(sharedAt)) : '',
        item.description ? myDriveInfoRow('Description', esc(item.description)) : '',
        item.tags ? myDriveInfoRow('Tags', esc(item.tags)) : ''
      ].join('');
    }

    function renderMyDriveDetailsPanel() {
      const panel = document.getElementById('myDriveDetailsPanel');
      const body = document.getElementById('myDriveDetailsBody');
      const subtitle = document.getElementById('myDriveDetailsSubtitle');
      const button = document.getElementById('myDriveDetailsToggleBtn');
      const layout = document.getElementById('myDriveLayoutGrid');
      if (!panel || !body) return;
      panel.classList.toggle('hidden', !myDriveDetailsOpen);
      layout?.classList.toggle('lg:grid-cols-[16rem_minmax(0,1fr)_20rem]', myDriveDetailsOpen);
      layout?.classList.toggle('lg:grid-cols-[16rem_minmax(0,1fr)]', !myDriveDetailsOpen);
      if (button) {
        button.setAttribute('aria-pressed', myDriveDetailsOpen ? 'true' : 'false');
        button.classList.toggle('bg-blue-50', myDriveDetailsOpen);
        button.classList.toggle('text-blue-700', myDriveDetailsOpen);
      }
      if (!myDriveDetailsOpen) return;
      const item = getMyDriveSelectedFullItem();
      if (item) {
        if (subtitle) subtitle.textContent = item.kind === 'folder' ? 'Folder information' : 'File information';
        body.innerHTML = `<div class="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">${myDriveIcon(item)}<div class="min-w-0"><div class="font-black text-gray-950 dark:text-gray-50 truncate">${esc(myDriveItemName(item))}</div><div class="text-xs text-gray-500 dark:text-gray-400">${esc(item.kind === 'folder' ? 'Folder' : myDriveFileCategory(item))}</div></div></div><div class="pt-2">${renderMyDriveDetailsRows(item)}</div>`;
        return;
      }
      if (subtitle) subtitle.textContent = 'Current view';
      const folderCount = (myDriveCache.folders || []).length;
      const fileCount = (myDriveCache.files || []).length;
      const totalSize = [...(myDriveCache.folders || []), ...(myDriveCache.files || [])].reduce((sum, item) => sum + Number(item.folder_size || item.file_size || item.size || 0), 0);
      body.innerHTML = [
        myDriveInfoRow('Location', esc(currentMyDriveLocationLabel())),
        myDriveInfoRow('Folders', esc(String(folderCount))),
        myDriveInfoRow('Files', esc(String(fileCount))),
        myDriveInfoRow('Visible size', esc(formatBytes(totalSize)))
      ].join('');
    }

    function toggleMyDriveDetailsPanel(force) {
      myDriveDetailsOpen = typeof force === 'boolean' ? force : !myDriveDetailsOpen;
      persistCurrentAppState();
      renderMyDriveDetailsPanel();
    }

    function ensureMyDriveInfoModal() {
      if (document.getElementById('myDriveInfoModal')) return;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveInfoModal" class="hidden fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
            <div class="min-w-0"><h3 id="myDriveInfoTitle" class="text-lg font-black text-gray-950 dark:text-gray-50 truncate">Details</h3><p id="myDriveInfoSubtitle" class="text-sm text-gray-500 dark:text-gray-400">Item information</p></div>
            <button type="button" onclick="closeModal('myDriveInfoModal')" class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-100">x</button>
          </div>
          <div id="myDriveInfoBody" class="p-5"></div>
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button type="button" onclick="closeModal('myDriveInfoModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold">Close</button>
          </div>
        </div>
      </div>`);
    }

    function openMyDriveInfoModal(id, kind = 'file') {
      const item = findMyDriveItem(id, kind);
      if (!item) return toast('Item not found.', 'error');
      ensureMyDriveInfoModal();
      document.getElementById('myDriveInfoTitle').textContent = myDriveItemName(item);
      document.getElementById('myDriveInfoSubtitle').textContent = item.kind === 'folder' ? 'Folder information' : 'File information';
      document.getElementById('myDriveInfoBody').innerHTML = `<div class="flex items-center gap-3 mb-4">${myDriveIcon(item)}<div class="min-w-0"><div class="font-black text-gray-950 dark:text-gray-50 truncate">${esc(myDriveItemName(item))}</div><div class="text-xs text-gray-500 dark:text-gray-400">${esc(item.kind === 'folder' ? 'Folder' : myDriveFileCategory(item))}</div></div></div>${renderMyDriveDetailsRows(item) || '<div class="text-sm text-gray-500 dark:text-gray-400">No details available.</div>'}`;
      document.getElementById('myDriveInfoModal')?.classList.remove('hidden');
    }

    function startMyDriveLongPress(event, id, kind) {
      cancelMyDriveLongPress();
      if (event.pointerType === 'mouse' || event.button) return;
      myDriveLongPressTimer = setTimeout(() => openMyDriveItemMenu(event, id, kind), 550);
    }

    function cancelMyDriveLongPress() {
      if (myDriveLongPressTimer) clearTimeout(myDriveLongPressTimer);
      myDriveLongPressTimer = null;
    }

    function closeMyDriveOpenMenus() {
      const ids = ['myDriveItemMenu', 'myDriveSortMenu', 'myDriveNewMenu', 'myDriveTypeFilterMenu', 'myDriveModifiedFilterMenu'];
      const open = ids.some(id => !document.getElementById(id)?.classList.contains('hidden'));
      closeMyDriveItemMenu();
      closeMyDriveSortMenu();
      closeMyDriveNewMenu();
      closeMyDriveTypeFilterMenu();
      closeMyDriveModifiedFilterMenu();
      return open;
    }

    function focusMyDriveItem(item) {
      if (!item) return;
      myDriveSelectedItems.clear();
      myDriveSelectedItems.set(myDriveSelectionKey(item), item);
      myDriveSelectedItem = item;
      myDriveSelectionAnchor = item;
      updateMyDriveSelectionVisuals();
      renderMyDriveDetailsPanel();
      document.querySelector(`#myDriveContent [data-drive-kind="${item.kind}"][data-drive-id="${Number(item.id)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function moveMyDriveSelection(delta) {
      const items = [...document.querySelectorAll('#myDriveContent [data-drive-kind][data-drive-id]')].map(el => ({ kind: el.dataset.driveKind, id: Number(el.dataset.driveId) }));
      if (!items.length) return;
      const current = myDriveSelectedItem ? items.findIndex(item => myDriveSelectionKey(item) === myDriveSelectionKey(myDriveSelectedItem)) : -1;
      focusMyDriveItem(items[Math.max(0, Math.min(items.length - 1, current < 0 ? (delta > 0 ? 0 : items.length - 1) : current + delta))]);
    }

    function openMyDriveSelectedItem() {
      const item = myDriveSelectedItem || [...myDriveSelectedItems.values()][0];
      if (item) openMyDriveItem(item.id, item.kind);
    }

    function openMyDriveSelectedContextMenu(event) {
      const item = myDriveSelectedItem || [...myDriveSelectedItems.values()][0];
      if (!item) return;
      const el = document.querySelector(`#myDriveContent [data-drive-kind="${item.kind}"][data-drive-id="${Number(item.id)}"]`);
      const rect = el?.getBoundingClientRect?.();
      openMyDriveItemMenu({ preventDefault() {}, stopPropagation() {}, clientX: rect ? rect.left + 24 : 24, clientY: rect ? rect.top + 24 : 24 }, item.id, item.kind);
      event.preventDefault();
      event.stopPropagation();
    }

    function handleMyDriveKeydown(event) {
      if (appCurrentView !== 'myDrive') return;
      const active = document.activeElement;
      if (active?.id === 'myDriveSearchInput' && event.key === 'Escape' && active.value) {
        active.value = '';
        event.preventDefault();
        loadMyDrive();
        return;
      }
      if (active?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      const key = String(event.key || '').toLowerCase();
      const code = String(event.code || '').toLowerCase();
      const isCopyKey = key === 'c' || code === 'keyc' || event.keyCode === 67;
      const isCutKey = key === 'x' || code === 'keyx' || event.keyCode === 88;
      const isUndoKey = key === 'z' || code === 'keyz' || event.keyCode === 90;
      const isSelectAllKey = key === 'a' || code === 'keya' || event.keyCode === 65;
      const isPasteKey = key === 'v' || code === 'keyv' || event.keyCode === 86;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        const hadSelection = myDriveSelectedItems.size;
        closeMyDriveOpenMenus();
        if (hadSelection) clearMyDriveSelection();
        else if (myDriveDetailsOpen) toggleMyDriveDetailsPanel(false);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        openMyDriveSelectedItem();
        return;
      }
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) return openMyDriveSelectedContextMenu(event);
      if (event.key === 'Backspace' || (event.altKey && event.key === 'ArrowLeft')) {
        event.preventDefault();
        event.stopPropagation();
        history.back();
        return;
      }
      if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        goUpMyDriveFolder();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveMyDriveSelection(1);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        moveMyDriveSelection(-1);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        const items = [...document.querySelectorAll('#myDriveContent [data-drive-kind][data-drive-id]')].map(el => ({ kind: el.dataset.driveKind, id: Number(el.dataset.driveId) }));
        if (items.length) {
          event.preventDefault();
          focusMyDriveItem(event.key === 'Home' ? items[0] : items[items.length - 1]);
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isSelectAllKey) {
        event.preventDefault();
        event.stopPropagation();
        selectAllMyDriveVisibleItems();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isUndoKey && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        undoLastMyDriveAction();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isCopyKey && myDriveSelectedItems.size) {
        event.preventDefault();
        event.stopPropagation();
        setMyDriveClipboard('copy');
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isCutKey && myDriveSelectedItems.size && myDriveTab === 'mine') {
        event.preventDefault();
        event.stopPropagation();
        setMyDriveClipboard('cut');
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isPasteKey && myDriveClipboard && myDriveTab === 'mine') {
        event.preventDefault();
        event.stopPropagation();
        pasteMyDriveClipboard();
        return;
      }
      if (event.key !== 'Delete' || !myDriveSelectedItems.size || !['mine', 'trash'].includes(myDriveTab)) return;
      event.preventDefault();
      const selected = [...myDriveSelectedItems.values()];
      if (myDriveTab === 'trash') {
        if (selected.length === 1) deleteMyDriveItemForever(selected[0].id, selected[0].kind);
        else deleteMyDriveSelectionForever(selected[0].id, selected[0].kind);
        return;
      }
      if (selected.length === 1) {
        if (selected[0].kind === 'folder') deleteMyDriveFolder(selected[0].id);
        else deleteMyDriveFile(selected[0].id);
        return;
      }
      moveSelectedMyDriveItemsToTrash(selected);
    }

    if (!window.myDriveShortcutKeyReady) {
      window.myDriveShortcutKeyReady = true;
      document.addEventListener('keydown', handleMyDriveKeydown, true);
    }

    function isAppTextEntryTarget(target) {
      return !!target?.closest?.('input, textarea, select, [contenteditable="true"]');
    }

    function isPreviewSurfaceOpen() {
      return !!document.querySelector('#fileViewerModal:not(.hidden), #printPreviewOverlay:not(.hidden), #projectDocumentationPreviewModal:not(.hidden)');
    }

    function handleGlobalSelectAllGuard(event) {
      const key = String(event.key || '').toLowerCase();
      const code = String(event.code || '').toLowerCase();
      const isSelectAllKey = key === 'a' || code === 'keya' || event.keyCode === 65;
      if (!(event.ctrlKey || event.metaKey) || !isSelectAllKey) return;
      if (isAppTextEntryTarget(event.target) || isPreviewSurfaceOpen() || appCurrentView === 'myDrive') return;
      event.preventDefault();
      event.stopPropagation();
    }

    if (!window.globalSelectAllGuardReady) {
      window.globalSelectAllGuardReady = true;
      document.addEventListener('keydown', handleGlobalSelectAllGuard, true);
    }

    function setMyDriveClipboard(mode) {
      myDriveClipboard = { mode, items: [...myDriveSelectedItems.values()].map(item => ({ ...item })) };
      toast(`${myDriveClipboard.items.length} item(s) ${mode === 'cut' ? 'ready to move' : 'copied'}.`);
    }

    async function pasteMyDriveClipboard(targetFolderId = myDriveFolderId) {
      if (!myDriveClipboard?.items?.length || myDriveTab !== 'mine') return;
      try {
        const url = `${API}/user-drive/items/${myDriveClipboard.mode === 'cut' ? 'move' : 'copy'}`;
        const sourceItems = myDriveClipboard.items.map(item => myDriveUndoSnapshot(item));
        const result = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: myDriveClipboard.items, parent_folder_id: targetFolderId || null }) });
        if (myDriveClipboard.mode === 'cut') {
          pushMyDriveUndo({ type: 'move', items: sourceItems });
        } else {
          const copiedItems = (result.copied_items || []).map(item => ({ id: Number(item.id), kind: item.kind })).filter(item => item.id);
          if (copiedItems.length) pushMyDriveUndo({ type: 'copy', items: copiedItems });
        }
        toast(`${myDriveClipboard.items.length} item(s) ${myDriveClipboard.mode === 'cut' ? 'moved' : 'copied'}.`);
        if (myDriveClipboard.mode === 'cut') myDriveClipboard = null;
        clearMyDriveSelection();
        loadMyDrive();
      } catch (err) {
        toast(err.message || 'Paste failed.', 'error');
      }
    }

    function startMyDriveItemDrag(event, id, kind) {
      if (myDriveTab !== 'mine') return;
      const key = `${kind}:${Number(id)}`;
      if (!myDriveSelectedItems.has(key)) {
        myDriveSelectedItems.clear();
        myDriveSelectedItems.set(key, { id: Number(id), kind });
        myDriveSelectedItem = { id: Number(id), kind };
        updateMyDriveSelectionVisuals();
      }
      event.dataTransfer?.setData('application/x-abed-drive-items', JSON.stringify([...myDriveSelectedItems.values()]));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }

    function handleMyDriveFolderDragOver(event) {
      if (myDriveTab !== 'mine' || !event.dataTransfer?.types?.includes('application/x-abed-drive-items')) return;
      event.preventDefault();
      event.currentTarget?.classList.add('ring-2', 'ring-blue-500', '!bg-blue-100', 'dark:!bg-blue-950/50');
    }

    function handleMyDriveFolderDragLeave(event) {
      if (event.currentTarget?.contains?.(event.relatedTarget)) return;
      event.currentTarget?.classList.remove('ring-2', 'ring-blue-500', '!bg-blue-100', 'dark:!bg-blue-950/50');
    }

    async function dropMyDriveItemsOnFolder(event, folderId) {
      if (myDriveTab !== 'mine') return;
      const raw = event.dataTransfer?.getData('application/x-abed-drive-items');
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget?.classList.remove('ring-2', 'ring-blue-500', '!bg-blue-100', 'dark:!bg-blue-950/50');
      try {
        const items = JSON.parse(raw || '[]');
        const sourceItems = items.map(item => myDriveUndoSnapshot(item));
        await fetchJson(`${API}/user-drive/items/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, parent_folder_id: Number(folderId) }) });
        pushMyDriveUndo({ type: 'move', items: sourceItems });
        toast(`${items.length} item(s) moved.`);
        clearMyDriveSelection();
        loadMyDrive();
      } catch (err) {
        toast(err.message || 'Move failed.', 'error');
      }
    }

    async function viewMyDriveFile(id) {
      const fileId = Number(id);
      if (!fileId) return toast('No file selected.', 'error');
      const file = findMyDriveItem(fileId, 'file') || {};
      resetFileViewerBlob();
      fileViewerCurrentSource = 'myDrive';
      fileViewerCurrentDocumentId = null;
      fileViewerCurrentMyDriveId = fileId;
      fileViewerCurrentFileName = file.original_name || file.title || 'file';
      renderFileViewerLoading(fileViewerCurrentFileName);
      document.getElementById('fileViewerModal')?.classList.remove('hidden');
      try {
        const response = await fetch(myDriveFileUrl(fileId, 'view'), { headers: authHeaders() });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || (response.status === 403 ? 'You do not have permission to view this file.' : 'Unable to open file preview.'));
        }
        const blob = await response.blob();
        fileViewerCurrentFileName = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fileViewerCurrentFileName) || fileViewerCurrentFileName;
        fileViewerBlobUrl = URL.createObjectURL(blob);
        renderFileViewerPreview(fileViewerBlobUrl, fileViewerCurrentFileName, response.headers.get('Content-Type') || blob.type || file.mime_type);
      } catch (err) {
        toast(err.message || 'Unable to open file preview.', 'error');
        renderFileViewerError(err.message);
      }
    }

    function downloadMyDriveFileFromMenu(id) {
      const file = findMyDriveItem(id, 'file') || {};
      downloadMyDriveFile(id, file.original_name || file.title || 'file');
    }

    function downloadMyDriveFolderFromMenu(id) {
      const folder = findMyDriveItem(id, 'folder') || {};
      downloadMyDriveFolder(id, folder.name || 'folder');
    }

    function downloadMyDriveSelectionFromMenu(id, kind) {
      const items = getMyDriveActionItems({ id: Number(id), kind });
      if (items.length <= 1) {
        if (kind === 'folder') return downloadMyDriveFolderFromMenu(id);
        return downloadMyDriveFileFromMenu(id);
      }
      openConfirmModal(`Download <strong>${items.length} selected item(s)</strong>?`, () => {
        fetchJson(`${API}/user-drive/items/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: items.map(item => ({ id: Number(item.id), kind: item.kind })) })
        }).then(result => nativeAuthenticatedDownload(`${API}${result.download_path}`, result.filename || 'my-drive-selection.zip')).catch(err => toast(err.message || 'Download failed.', 'error'));
      }, {
        title: 'Download My Drive Selection',
        confirmText: 'Download',
        confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium'
      });
    }

    function downloadMyDriveFile(id, filename) {
      openConfirmModal(`Download <strong>${esc(filename || 'this file')}</strong>?`, () => nativeAuthenticatedDownload(`${API}/user-drive/files/${Number(id)}/download`, filename || ''), {
        title: 'Download My Drive File',
        confirmText: 'Download',
        confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium'
      });
    }

    function downloadMyDriveFolder(id, folderName) {
      const filename = `${String(folderName || 'folder').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'folder'}.zip`;
      openConfirmModal(`Download <strong>${esc(folderName || 'this folder')}</strong> as a ZIP file?`, () => nativeAuthenticatedDownload(`${API}/user-drive/folders/${Number(id)}/download`, filename), {
        title: 'Download My Drive Folder',
        confirmText: 'Download',
        confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium'
      });
    }

    function ensureMyDriveUploadModal() {
      if (document.getElementById('myDriveUploadModal')) {
        ensureMyDriveQuickUploadInputs();
        return;
      }
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveUploadModal" class="hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <form id="myDriveUploadForm" onsubmit="submitMyDriveUpload(event)" class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
            <div><h3 class="text-lg font-black text-gray-950 dark:text-gray-50">Upload to My Drive</h3><p class="text-sm text-gray-500 dark:text-gray-400">Files stay private unless you share them.</p></div>
            <button type="button" onclick="closeModal('myDriveUploadModal')" class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-100">x</button>
          </div>
          <div class="p-5 space-y-4">
            ${fileDropZoneHtml({ zoneId: 'myDriveUploadDropZone', inputId: 'myDriveUploadFiles', labelId: 'myDriveUploadFileLabel', title: 'Drag and drop files here, or click to browse', help: 'Documents, images, videos, and ZIP files.', accept: MY_DRIVE_ACCEPT, multiple: true })}
            <input id="myDriveUploadDescription" placeholder="Description (optional)" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
            <input id="myDriveUploadTags" placeholder="Tags, comma separated (optional)" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
          </div>
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onclick="closeModal('myDriveUploadModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold">Upload</button>
          </div>
        </form>
      </div>`);
      ensureMyDriveQuickUploadInputs();
    }

    function ensureMyDriveQuickUploadInputs() {
      if (!document.getElementById('myDriveQuickFileInput')) {
        document.body.insertAdjacentHTML('beforeend', `<input id="myDriveQuickFileInput" type="file" ${MY_DRIVE_ACCEPT ? `accept="${MY_DRIVE_ACCEPT}"` : ''} multiple class="sr-only"><input id="myDriveQuickFolderInput" type="file" webkitdirectory directory multiple class="sr-only">`);
      }
      const fileInput = document.getElementById('myDriveQuickFileInput');
      const folderInput = document.getElementById('myDriveQuickFolderInput');
      if (fileInput && fileInput.dataset.myDriveReady !== '1') {
        fileInput.dataset.myDriveReady = '1';
        fileInput.addEventListener('change', () => {
          if (fileInput.files?.length) uploadMyDriveFiles(fileInput.files).catch(err => toast(err.message || 'Upload failed.', 'error'));
          fileInput.value = '';
        });
      }
      if (folderInput && folderInput.dataset.myDriveReady !== '1') {
        folderInput.dataset.myDriveReady = '1';
        folderInput.addEventListener('change', () => {
          if (folderInput.files?.length) uploadMyDriveFiles(folderInput.files).catch(err => toast(err.message || 'Upload failed.', 'error'));
          folderInput.value = '';
        });
      }
    }

    function openMyDriveUploadModal() {
      if (!myDriveActionAllowed('upload')) return toast('You do not have permission to upload My Drive files.', 'error');
      ensureMyDriveUploadModal();
      document.getElementById('myDriveUploadForm')?.reset();
      const label = document.getElementById('myDriveUploadFileLabel');
      if (label) label.textContent = 'Documents, images, videos, and ZIP files.';
      document.getElementById('myDriveUploadModal')?.classList.remove('hidden');
      setupGenericFileDropZone({ zoneId: 'myDriveUploadDropZone', inputId: 'myDriveUploadFiles', labelId: 'myDriveUploadFileLabel', emptyText: 'Documents, images, videos, and ZIP files.', multiple: true });
      const uploadZone = document.getElementById('myDriveUploadDropZone');
      const fileInput = document.getElementById('myDriveUploadFiles');
      if (uploadZone && uploadZone.dataset.myDriveFolderDropReady !== '1') {
        uploadZone.dataset.myDriveFolderDropReady = '1';
        uploadZone.addEventListener('drop', event => {
          getMyDriveDroppedFiles(event.dataTransfer).then(files => {
            if (!files.length || !fileInput) return;
            const dt = new DataTransfer();
            files.forEach(file => dt.items.add(file));
            fileInput.files = dt.files;
            if (label) label.textContent = `${files.length} file(s) selected`;
          }).catch(() => {});
        });
      }
    }

    function isExternalMyDriveFileDrag(dataTransfer) {
      const types = Array.from(dataTransfer?.types || []);
      return types.includes('Files') && !types.includes('application/x-abed-drive-items');
    }

    function setupMyDriveContentDropZone() {
      const content = document.getElementById('myDriveContent');
      if (!content || content.dataset.myDriveDropReady === '1') return;
      content.dataset.myDriveDropReady = '1';
      content.addEventListener('contextmenu', event => {
        if (myDriveTab !== 'mine' || event.target.closest('[data-drive-kind]')) return;
        openMyDriveNewMenu(event);
      });
      content.addEventListener('pointerdown', event => {
        if (!['mine', 'trash'].includes(myDriveTab) || event.target.closest('[data-drive-kind]')) return;
        if (event.pointerType === 'mouse' && event.button === 0 && !event.ctrlKey && !event.metaKey) clearMyDriveSelection();
        if (event.pointerType === 'mouse' && event.button === 0) startMyDriveSelectionBox(event);
        if (myDriveTab === 'mine') startMyDriveBlankLongPress(event);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => content.addEventListener(eventName, cancelMyDriveBlankLongPress));
      ['dragenter', 'dragover'].forEach(eventName => {
        content.addEventListener(eventName, event => {
          if (myDriveTab !== 'mine' || !myDriveActionAllowed('upload') || !isExternalMyDriveFileDrag(event.dataTransfer)) return;
          event.preventDefault();
          content.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50/50', 'dark:bg-blue-950/20');
        });
      });
      ['dragleave', 'dragend', 'drop'].forEach(eventName => {
        content.addEventListener(eventName, event => {
          if (myDriveTab !== 'mine') return;
          if (isExternalMyDriveFileDrag(event.dataTransfer)) event.preventDefault();
          content.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50/50', 'dark:bg-blue-950/20');
        });
      });
      content.addEventListener('drop', event => {
        if (myDriveTab !== 'mine' || !myDriveActionAllowed('upload') || !isExternalMyDriveFileDrag(event.dataTransfer)) return;
        getMyDriveDroppedFiles(event.dataTransfer)
          .then(files => files.length ? uploadMyDriveFiles(files) : null)
          .catch(err => toast(err.message || 'Upload failed.', 'error'));
      });
    }

    function readMyDriveDirectoryEntries(reader) {
      return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    }

    async function collectMyDriveEntryFiles(entry, pathPrefix = '') {
      if (!entry) return [];
      if (entry.isFile) {
        return new Promise(resolve => {
          entry.file(file => {
            try { Object.defineProperty(file, 'relativePath', { value: `${pathPrefix}${file.name}` }); } catch (e) { file.relativePath = `${pathPrefix}${file.name}`; }
            resolve([file]);
          }, () => resolve([]));
        });
      }
      if (!entry.isDirectory) return [];
      const reader = entry.createReader();
      const files = [];
      let entries = [];
      do {
        entries = await readMyDriveDirectoryEntries(reader);
        for (const child of entries) files.push(...await collectMyDriveEntryFiles(child, `${pathPrefix}${entry.name}/`));
      } while (entries.length);
      return files;
    }

    async function getMyDriveDroppedFiles(dataTransfer) {
      const items = [...(dataTransfer?.items || [])];
      const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
      if (!entries.length) return [...(dataTransfer?.files || [])];
      const files = [];
      for (const entry of entries) files.push(...await collectMyDriveEntryFiles(entry));
      return files;
    }

    function uploadMyDriveFiles(files, { description = '', tags = '' } = {}) {
      if (!files?.length) return Promise.reject(new Error('Choose at least one file.'));
      const fd = new FormData();
      [...files].forEach(file => fd.append('files', file, file.webkitRelativePath || file.relativePath || file.name));
      if (myDriveFolderId) fd.append('folder_id', myDriveFolderId);
      fd.append('description', description);
      fd.append('tags', tags);
      const firstName = files[0]?.name || 'My Drive upload';
      return downloadsFormsUploadRequest(`${API}/user-drive/upload`, 'POST', fd, firstName, { uploadCompleteStatus: 'Upload complete. Saving to My Drive...' })
        .then(() => {
          toast('Uploaded to My Drive.');
          return loadMyDrive();
        });
    }

    function submitMyDriveUpload(event) {
      event.preventDefault();
      const input = document.getElementById('myDriveUploadFiles');
      if (!input?.files?.length) return toast('Choose at least one file.', 'error');
      uploadMyDriveFiles(input.files, {
        description: document.getElementById('myDriveUploadDescription')?.value || '',
        tags: document.getElementById('myDriveUploadTags')?.value || ''
      })
        .then(() => {
          closeModal('myDriveUploadModal');
        })
        .catch(err => toast(err.message || 'Upload failed.', 'error'));
    }

    function openMyDriveFolderModal(id = null) {
      if (!myDriveActionAllowed('manage')) return toast('You do not have permission to manage folders.', 'error');
      if (id) return openMyDriveRenameModal(id, 'folder');
      const folder = id ? (myDriveCache.folders || []).find(item => Number(item.id) === Number(id)) : null;
      const inputId = 'myDriveFolderNameInput';
      openConfirmModal(`<label class="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2" for="${inputId}">Folder name</label><input id="${inputId}" value="${esc(folder?.name || '')}" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">`, async () => {
        const name = document.getElementById(inputId)?.value?.trim();
        if (!name) return toast('Folder name is required.', 'error');
        const body = { name, parent_folder_id: folder ? folder.parent_folder_id : myDriveFolderId };
        await fetchJson(folder ? `${API}/user-drive/folders/${Number(folder.id)}` : `${API}/user-drive/folders`, { method: folder ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast(folder ? 'Folder updated.' : 'Folder created.');
        loadMyDrive();
      }, { title: folder ? 'Edit Folder' : 'New Folder', confirmText: folder ? 'Save' : 'Create', confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium' });
      const input = document.getElementById(inputId);
      input?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        document.getElementById('confirmActionBtn')?.click();
      });
      input?.focus();
      input?.select();
    }

    function openMyDriveRenameModal(id, kind = 'file') {
      if (!myDriveActionAllowed('manage')) return toast('You do not have permission to rename My Drive items.', 'error');
      const item = myDriveCachedItem(id, kind);
      if (!item) return toast('Item not found.', 'error');
      const snapshot = myDriveUndoSnapshot({ id, kind });
      const inputId = 'myDriveRenameInput';
      openConfirmModal(`<label class="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2" for="${inputId}">Name</label><input id="${inputId}" value="${esc(myDriveItemName(item))}" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">`, async () => {
        const name = document.getElementById(inputId)?.value?.trim();
        if (!name) return toast('Name is required.', 'error');
        if (name === snapshot.name) return;
        if (kind === 'folder') {
          await fetchJson(`${API}/user-drive/folders/${Number(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent_folder_id: item.parent_folder_id || null }) });
        } else {
          await fetchJson(`${API}/user-drive/files/${Number(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name, description: item.description || '', tags: item.tags || '', parent_folder_id: item.parent_folder_id || null }) });
        }
        pushMyDriveUndo({ type: 'rename', item: snapshot });
        toast('Renamed.');
        loadMyDrive();
      }, { title: 'Rename', confirmText: 'Rename', confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium' });
      const input = document.getElementById(inputId);
      input?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        document.getElementById('confirmActionBtn')?.click();
      });
      input?.focus();
      input?.select();
    }

    function openMyDriveFileModal(id) {
      openMyDriveRenameModal(id, 'file');
    }

    function deleteMyDriveFile(id) {
      const file = (myDriveCache.files || []).find(item => Number(item.id) === Number(id));
      openConfirmModal(`Move <strong>${esc(myDriveItemName(file || {}))}</strong> to trash?`, async () => {
        await fetchJson(`${API}/user-drive/files/${Number(id)}`, { method: 'DELETE' });
        if (myDriveSelectedItem?.kind === 'file' && Number(myDriveSelectedItem.id) === Number(id)) myDriveSelectedItem = null;
        myDriveSelectedItems.delete(`file:${Number(id)}`);
        toast('File moved to trash.');
        loadMyDrive();
      }, { title: 'Move to Trash', confirmText: 'Move to trash' });
    }

    function deleteMyDriveFolder(id) {
      const folder = (myDriveCache.folders || []).find(item => Number(item.id) === Number(id));
      openConfirmModal(`Move folder <strong>${esc(folder?.name || 'Folder')}</strong> and its files to trash?`, async () => {
        await fetchJson(`${API}/user-drive/folders/${Number(id)}`, { method: 'DELETE' });
        if (myDriveSelectedItem?.kind === 'folder' && Number(myDriveSelectedItem.id) === Number(id)) myDriveSelectedItem = null;
        myDriveSelectedItems.delete(`folder:${Number(id)}`);
        toast('Folder moved to trash.');
        loadMyDrive();
      }, { title: 'Move to Trash', confirmText: 'Move to trash' });
    }

    function moveSelectedMyDriveItemsToTrash(items) {
      const selected = items.filter(item => ['file', 'folder'].includes(item.kind));
      if (!selected.length) return;
      openConfirmModal(`Move <strong>${selected.length}</strong> selected item(s) to trash?`, async () => {
        for (const item of selected) {
          await fetchJson(`${API}/user-drive/${item.kind === 'folder' ? 'folders' : 'files'}/${Number(item.id)}`, { method: 'DELETE' });
        }
        clearMyDriveSelection();
        toast(`${selected.length} item(s) moved to trash.`);
        loadMyDrive();
      }, { title: 'Move to Trash', confirmText: 'Move to trash' });
    }

    async function restoreMyDriveItem(id, kind) {
      const item = findMyDriveItem(id, kind);
      try {
        await fetchJson(`${API}/user-drive/${kind === 'folder' ? 'folders' : 'files'}/${Number(id)}/restore`, { method: 'POST' });
        if (myDriveSelectedItem?.kind === kind && Number(myDriveSelectedItem.id) === Number(id)) myDriveSelectedItem = null;
        toast(`${kind === 'folder' ? 'Folder' : 'File'} restored.`);
        loadMyDrive();
      } catch (err) {
        toast(err.message || `Failed to restore ${myDriveItemName(item || {})}.`, 'error');
      }
    }

    function deleteMyDriveItemForever(id, kind) {
      const item = findMyDriveItem(id, kind);
      openConfirmModal(`Permanently delete <strong>${esc(myDriveItemName(item || {}))}</strong>? This cannot be undone.`, async () => {
        await fetchJson(`${API}/user-drive/${kind === 'folder' ? 'folders' : 'files'}/${Number(id)}/permanent`, { method: 'DELETE' });
        if (myDriveSelectedItem?.kind === kind && Number(myDriveSelectedItem.id) === Number(id)) myDriveSelectedItem = null;
        toast(`${kind === 'folder' ? 'Folder' : 'File'} deleted forever.`);
        loadMyDrive();
      }, { title: 'Delete Forever', confirmText: 'Delete forever' });
    }

    async function restoreMyDriveSelection(id, kind) {
      const fallback = findMyDriveItem(id, kind) || { id, kind };
      const items = getMyDriveActionItems(fallback);
      if (!items.length) return;
      try {
        for (const item of items) {
          await fetchJson(`${API}/user-drive/${item.kind === 'folder' ? 'folders' : 'files'}/${Number(item.id)}/restore`, { method: 'POST' });
        }
        clearMyDriveSelection();
        toast(`${items.length} item(s) restored.`);
        loadMyDrive();
      } catch (err) {
        toast(err.message || 'Failed to restore selected items.', 'error');
      }
    }

    function deleteMyDriveSelectionForever(id, kind) {
      const fallback = findMyDriveItem(id, kind) || { id, kind };
      const items = getMyDriveActionItems(fallback);
      if (!items.length) return;
      openConfirmModal(`Permanently delete <strong>${items.length}</strong> selected item(s)? This cannot be undone.`, async () => {
        for (const item of items) {
          await fetchJson(`${API}/user-drive/${item.kind === 'folder' ? 'folders' : 'files'}/${Number(item.id)}/permanent`, { method: 'DELETE' });
        }
        clearMyDriveSelection();
        toast(`${items.length} item(s) deleted forever.`);
        loadMyDrive();
      }, { title: 'Delete Forever', confirmText: 'Delete forever' });
    }

    let myDriveShareState = { id: null, kind: 'file', selected: [] };

    function ensureMyDriveShareModal() {
      if (document.getElementById('myDriveShareModal')) return;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveShareModal" class="hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-200 dark:border-gray-700 overflow-visible">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
            <div class="min-w-0"><h3 id="myDriveShareTitle" class="text-lg font-black text-gray-950 dark:text-gray-50 truncate">Share</h3><p class="text-sm text-gray-500 dark:text-gray-400">Add people who can access this item.</p></div>
            <button type="button" onclick="closeModal('myDriveShareModal')" class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-100">x</button>
          </div>
          <div class="p-5 space-y-4">
            <div class="relative">
              <input id="myDriveShareUserSearch" type="text" autocomplete="off" placeholder="Search users" oninput="renderMyDriveShareUserResults()" onfocus="renderMyDriveShareUserResults(true)" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-full px-4 py-2.5 text-sm">
              <div id="myDriveShareUserResults" class="hidden absolute left-0 right-0 top-full mt-1 max-h-64 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-[130]"></div>
            </div>
            <div id="myDriveShareSelectedUsers" class="flex flex-wrap gap-2 min-h-[2rem]"></div>
          </div>
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onclick="closeModal('myDriveShareModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold">Cancel</button>
            <button type="button" onclick="submitMyDriveShare()" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black">Share</button>
          </div>
        </div>
      </div>`);
    }

    async function openMyDriveShareModal(id, kind = 'file') {
      if (!myDriveActionAllowed('share')) return toast('You do not have permission to share files.', 'error');
      if (!usersCache.length) usersCache = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, { silentLoading: true }).catch(() => []));
      ensureMyDriveShareModal();
      myDriveShareState = { id: Number(id), kind: kind === 'folder' ? 'folder' : 'file', selected: [] };
      const item = findMyDriveItem(id, myDriveShareState.kind) || {};
      document.getElementById('myDriveShareTitle').textContent = `Share ${myDriveItemName(item)}`;
      document.getElementById('myDriveShareUserSearch').value = '';
      renderMyDriveShareSelectedUsers();
      renderMyDriveShareUserResults(false);
      document.getElementById('myDriveShareModal')?.classList.remove('hidden');
    }

    function renderMyDriveShareSelectedUsers() {
      const target = document.getElementById('myDriveShareSelectedUsers');
      if (!target) return;
      target.innerHTML = myDriveShareState.selected.map(user => `<span class="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 pl-1 pr-3 py-1 text-sm font-bold text-blue-800 dark:text-blue-200">${renderUserAvatar(user, 24, 'text-[10px]')}${esc(displayUsername(user.username || 'User'))}<button type="button" onclick="removeMyDriveShareUser(${Number(user.id)})" class="text-blue-500 hover:text-blue-800">x</button></span>`).join('') || '<span class="text-sm text-gray-500 dark:text-gray-400">No people selected.</span>';
    }

    function renderMyDriveShareUserResults(open = true) {
      const panel = document.getElementById('myDriveShareUserResults');
      const input = document.getElementById('myDriveShareUserSearch');
      if (!panel || !input) return;
      const q = input.value.trim().toLowerCase();
      const selectedIds = new Set(myDriveShareState.selected.map(user => Number(user.id)));
      if (q === '@all' || q === 'all') {
        panel.innerHTML = `<button type="button" onclick="addAllMyDriveShareUsers()" class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"><span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-700 dark:bg-cyan-400 text-xs font-black text-white dark:text-gray-950">All</span><span class="min-w-0"><span class="block font-bold text-gray-900 dark:text-gray-100 truncate">All users</span><span class="block text-xs text-gray-500 dark:text-gray-400 truncate">Select every active user</span></span></button>`;
        panel.classList.toggle('hidden', !open);
        return;
      }
      const rows = (usersCache || []).filter(user => Number(user.id) !== Number(currentUser?.id) && !selectedIds.has(Number(user.id)) && (!q || String(user.username || '').toLowerCase().includes(q) || String(user.display_name || '').toLowerCase().includes(q))).slice(0, 8);
      panel.innerHTML = rows.map(user => `<button type="button" onclick="addMyDriveShareUser(${Number(user.id)})" class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800">${renderUserAvatar(user, 32, 'text-xs')}<span class="min-w-0"><span class="block font-bold text-gray-900 dark:text-gray-100 truncate">${esc(displayUsername(user.username || 'User'))}</span><span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${esc(user.role || '')}</span></span></button>`).join('') || '<div class="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">No matching users.</div>';
      panel.classList.toggle('hidden', !open);
    }

    function addMyDriveShareUser(id) {
      const user = (usersCache || []).find(item => Number(item.id) === Number(id));
      if (!user) return;
      if (!myDriveShareState.selected.some(item => Number(item.id) === Number(id))) myDriveShareState.selected.push(user);
      document.getElementById('myDriveShareUserSearch').value = '';
      renderMyDriveShareSelectedUsers();
      renderMyDriveShareUserResults(false);
    }

    function addAllMyDriveShareUsers() {
      myDriveShareState.selected = (usersCache || [])
        .filter(user => Number(user.id) !== Number(currentUser?.id))
        .sort((a, b) => displayUsername(a.username || 'User').localeCompare(displayUsername(b.username || 'User')));
      document.getElementById('myDriveShareUserSearch').value = '';
      renderMyDriveShareSelectedUsers();
      renderMyDriveShareUserResults(false);
    }

    function removeMyDriveShareUser(id) {
      myDriveShareState.selected = myDriveShareState.selected.filter(user => Number(user.id) !== Number(id));
      renderMyDriveShareSelectedUsers();
      renderMyDriveShareUserResults(false);
    }

    async function submitMyDriveShare() {
      const userIds = myDriveShareState.selected.map(user => Number(user.id)).filter(Boolean);
      if (!userIds.length) return toast('Choose at least one user.', 'error');
      try {
        await fetchJson(`${API}/user-drive/${myDriveShareState.kind === 'folder' ? 'folders' : 'files'}/${Number(myDriveShareState.id)}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_ids: userIds }) });
        closeModal('myDriveShareModal');
        toast(`${myDriveShareState.kind === 'folder' ? 'Folder' : 'File'} shared.`);
      } catch (err) {
        toast(err.message || 'Share failed.', 'error');
      }
    }

    function ensureMyDriveCopyModal() {
      if (document.getElementById('myDriveCopyModal')) return;
      document.body.insertAdjacentHTML('beforeend', `<div id="myDriveCopyModal" class="hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <form id="myDriveCopyForm" onsubmit="submitMyDriveCopy(event)" class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <input type="hidden" id="myDriveCopyFileId">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
            <div><h3 class="text-lg font-black text-gray-950 dark:text-gray-50">Copy My Drive File</h3><p class="text-sm text-gray-500 dark:text-gray-400">Copies the file into the selected official attachment area.</p></div>
            <button type="button" onclick="closeModal('myDriveCopyModal')" class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-100">x</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Copy destination</label>
              <select id="myDriveCopyDestination" onchange="renderMyDriveCopyFields()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                <option value="project-document">Project document requirement</option>
                <option value="project-documentation">Project documentation photo/video</option>
                <option value="calendar">Calendar attachment</option>
                <option value="my-drive">My Drive</option>
              </select>
            </div>
            <div id="myDriveCopyFields" class="space-y-3"></div>
          </div>
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onclick="closeModal('myDriveCopyModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold">Copy File</button>
          </div>
        </form>
      </div>`);
    }

    async function openMyDriveCopyModal(id) {
      if (!hasPrivilege('attach_drive_file_to_project')) return toast('You do not have permission to copy My Drive files to projects.', 'error');
      ensureMyDriveCopyModal();
      if (!projCache.length) projCache = await fetchJson(`${API}/projects`, { silentLoading: true }).catch(() => []);
      document.getElementById('myDriveCopyFileId').value = Number(id);
      document.getElementById('myDriveCopyDestination').value = 'project-document';
      renderMyDriveCopyFields();
      document.getElementById('myDriveCopyModal')?.classList.remove('hidden');
    }

    function myDriveProjectOptions() {
      return (projCache || []).map(p => `<option value="${Number(p.id)}">${esc(p.name || `Project ${p.id}`)}</option>`).join('');
    }

    function myDriveFlattenFolders(folders = []) {
      return (folders || []).filter(folder => Number(folder.id) !== Number(myDriveFolderId));
    }

    function renderMyDriveCopyFields() {
      const dest = document.getElementById('myDriveCopyDestination')?.value || 'project-document';
      const fields = document.getElementById('myDriveCopyFields');
      if (!fields) return;
      if (dest === 'calendar') {
        fields.innerHTML = `<div class="text-sm text-gray-500 dark:text-gray-400">Enter the schedule/event ID from the calendar item you want to attach this file to.</div>
          <input id="myDriveCopyEventId" type="number" min="1" placeholder="Calendar event ID" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
          <select id="myDriveCopyAttachmentType" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2"><option value="supporting_file">Supporting file</option><option value="agenda">Agenda</option><option value="minutes">Minutes</option></select>`;
        return;
      }
      if (dest === 'my-drive') {
        const folders = myDriveFlattenFolders(myDriveCache.folders || []);
        fields.innerHTML = `<div class="text-sm text-gray-500 dark:text-gray-400">Copy this file to your My Drive root or current folder.</div>
          <select id="myDriveCopyTargetFolderId" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
            <option value="">My Drive root</option>
            ${myDriveFolderId ? `<option value="${Number(myDriveFolderId)}">Current folder</option>` : ''}
            ${folders.map(folder => `<option value="${Number(folder.id)}">${esc(folder.name)}</option>`).join('')}
          </select>`;
        return;
      }
      const projectSelect = `<select id="myDriveCopyProjectId" onchange="renderMyDriveCopyFieldsForProject()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2"><option value="">Choose project...</option>${myDriveProjectOptions()}</select>`;
      fields.innerHTML = `<div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">Project</label>${projectSelect}</div><div id="myDriveCopyProjectFields"></div>`;
      renderMyDriveCopyFieldsForProject();
    }

    async function renderMyDriveCopyFieldsForProject() {
      const dest = document.getElementById('myDriveCopyDestination')?.value || 'project-document';
      const projectId = Number(document.getElementById('myDriveCopyProjectId')?.value || 0);
      const target = document.getElementById('myDriveCopyProjectFields');
      if (!target) return;
      if (!projectId) {
        target.innerHTML = '<div class="text-sm text-gray-500 dark:text-gray-400">Choose a project to continue.</div>';
        return;
      }
      if (dest === 'project-documentation') {
        target.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select id="myDriveCopyDocumentationStage" class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2"><option>Proposal</option><option>Implementation</option><option>Monitoring</option><option>Completed</option></select>
          <input id="myDriveCopyDocumentationCategory" placeholder="Category" class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
        </div>
        <input id="myDriveCopyDocumentationCaption" placeholder="Caption (optional)" class="mt-3 w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">`;
        return;
      }
      target.innerHTML = '<div class="text-sm text-gray-500 dark:text-gray-400">Loading document requirements...</div>';
      const docs = await fetchJson(`${API}/documents/${projectId}?stage=Proposal`, { silentLoading: true }).catch(() => []);
      const allDocs = Array.isArray(docs) ? docs : (docs.items || []);
      target.innerHTML = `<label class="block text-xs font-bold uppercase text-gray-500 mb-1 mt-3">Document requirement</label><select id="myDriveCopyDocumentId" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">${allDocs.map(d => `<option value="${Number(d.id)}">${esc(d.stage || 'Proposal')} - ${esc(d.document_type_name || `Document ${d.id}`)}</option>`).join('')}</select>`;
    }

    async function submitMyDriveCopy(event) {
      event.preventDefault();
      const fileId = Number(document.getElementById('myDriveCopyFileId')?.value || 0);
      const dest = document.getElementById('myDriveCopyDestination')?.value || 'project-document';
      let url = `${API}/user-drive/files/${fileId}/copy-to-project-document`;
      let body = {};
      if (dest === 'calendar') {
        url = `${API}/user-drive/files/${fileId}/copy-to-calendar-attachment`;
        body = { event_id: Number(document.getElementById('myDriveCopyEventId')?.value || 0), attachment_type: document.getElementById('myDriveCopyAttachmentType')?.value || 'supporting_file' };
      } else if (dest === 'my-drive') {
        url = `${API}/user-drive/items/copy`;
        body = { items: [{ id: fileId, kind: 'file' }], parent_folder_id: Number(document.getElementById('myDriveCopyTargetFolderId')?.value || 0) || null };
      } else if (dest === 'project-documentation') {
        url = `${API}/user-drive/files/${fileId}/copy-to-project-documentation`;
        body = {
          project_id: Number(document.getElementById('myDriveCopyProjectId')?.value || 0),
          stage: document.getElementById('myDriveCopyDocumentationStage')?.value || 'Proposal',
          category: document.getElementById('myDriveCopyDocumentationCategory')?.value || '',
          caption: document.getElementById('myDriveCopyDocumentationCaption')?.value || ''
        };
      } else {
        body = { document_id: Number(document.getElementById('myDriveCopyDocumentId')?.value || 0) };
      }
      const result = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (dest === 'my-drive') {
        const copiedItems = (result.copied_items || []).map(item => ({ id: Number(item.id), kind: item.kind })).filter(item => item.id);
        if (copiedItems.length) pushMyDriveUndo({ type: 'copy', items: copiedItems });
        loadMyDrive();
      }
      closeModal('myDriveCopyModal');
      toast('File copied.');
    }
