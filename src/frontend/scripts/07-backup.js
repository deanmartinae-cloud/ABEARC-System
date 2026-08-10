
    async function renderBackupRestore() {
      const el = document.getElementById('content-backup-restore');
      if (!el) return;
      el.innerHTML = `<div class="settings-card p-4 space-y-4">
        <div class="flex flex-wrap gap-2"><button onclick="createBackup()" class="px-4 py-2 bg-cyan-700 text-white rounded-lg font-bold">Create Backup</button><button onclick="openRestoreBackupModal()" class="px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Restore Backup</button><button onclick="loadBackupHistory()" class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold">Refresh History</button></div>
        <div class="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">Restoring a backup will replace the current database and uploaded files. A pre-restore backup will be created before continuing.</div>
        <div id="backupHistory"></div>
        <div id="restoreBackupModal" class="fixed inset-0 bg-black/40 hidden z-[90] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-black text-gray-950 dark:text-gray-50">Restore Backup</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a ZIP backup and enter the system restore password.</p>
              </div>
              <button type="button" onclick="closeRestoreBackupModal()" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
              <div class="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">This will replace the current database and uploaded files. A pre-restore backup will be created first.</div>
              <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Backup ZIP</label>
                ${fileDropZoneHtml({ zoneId: 'restoreBackupDropZone', inputId: 'restoreBackupFile', labelId: 'restoreBackupFileLabel', title: 'Drag and drop backup ZIP here, or click to browse', help: 'ZIP backups only.', accept: '.zip' })}
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">System restore password</label>
                <input id="restoreBackupPassword" type="password" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <div id="restoreBackupPasswordError" class="hidden mt-1.5 text-xs font-bold text-red-600 dark:text-red-400"></div>
              </div>
            </div>
            <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" data-modal-action="cancel" onclick="closeRestoreBackupModal()" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
              <button type="button" data-modal-action="confirm" onclick="restoreBackup()" class="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700">Restore Backup</button>
            </div>
          </div>
        </div>
      </div>`;
      loadBackupHistory();
    }

    async function loadBackupHistory() {
      const target = document.getElementById('backupHistory');
      if (!target) return;
      try {
        const backups = await fetchJson(`${API}/backups`);
        target.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left border-b dark:border-gray-700"><th class="py-2">Filename</th><th>Size</th><th>Created</th><th class="text-right">Actions</th></tr></thead><tbody>${backups.map(b => `<tr class="border-b dark:border-gray-800"><td class="py-2 font-medium">${esc(b.filename)}</td><td>${formatBytes(b.size)}</td><td>${fmtDateTime(b.created_at)}</td><td class="text-right"><button onclick="downloadBackup('${esc(b.filename)}')" class="px-2 py-1 text-cyan-700 font-bold">Download</button><button onclick="deleteBackup('${esc(b.filename)}')" class="px-2 py-1 text-red-600 font-bold">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="py-4 text-gray-500">No backups yet.</td></tr>'}</tbody></table></div>`;
      } catch (e) { target.innerHTML = `<div class="text-red-600">${esc(e.message)}</div>`; }
    }

    async function createBackup() {
      if (!requirePrivilege('manage_backups')) return;
      openConfirmModal('Create a new backup now?', () => runCreateBackup(), {
        title: 'Create Backup',
        confirmText: 'Create Backup',
        confirmClass: 'px-4 py-2.5 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 font-medium'
      });
    }

    async function runCreateBackup() {
      try {
        showDownloadsFormsProgress('download', 'backup.zip', {
          title: 'Creating backup',
          initialStatus: 'Preparing backup archive...'
        });
        updateDownloadsFormsProgress(0, 0, 'Creating backup archive...');
        const created = await fetchJson(`${API}/backups?meta=1`, {
          method: 'POST',
          silentLoading: true
        });
        finishDownloadsFormsProgress('Backup created.');
        setTimeout(hideDownloadsFormsProgress, 250);
        await loadBackupHistory();
        toast(created?.filename ? `Backup created: ${created.filename}` : 'Backup created');
      } catch (e) {
        hideDownloadsFormsProgress();
        toast(e.message || 'Backup failed', 'error');
      }
    }

    function promptDownloadCreatedBackup(filename) {
      openConfirmModal(`Backup <strong>${esc(filename)}</strong> was created successfully. Download it now?`, () => {
        startBackupDownload(filename);
      });
    }

    function downloadBackup(filename) {
      if (!requirePrivilege('manage_backups')) return;
      openConfirmModal(`Download backup <strong>${esc(filename)}</strong>?`, () => {
        startBackupDownload(filename);
      });
    }

    function startBackupDownload(filename) {
      try {
        nativeAuthenticatedDownload(`${API}/backups/${encodeURIComponent(filename)}/download`, filename);
        toast('Backup download started');
      } catch (e) {
        toast(e.message || 'Backup download failed', 'error');
      }
    }
    function deleteBackup(filename) { if (!requirePrivilege('manage_backups')) return; openConfirmModal(`Delete backup <strong>${esc(filename)}</strong>?`, async () => { await fetchJson(`${API}/backups/${encodeURIComponent(filename)}`, { method:'DELETE' }); toast('Backup deleted'); loadBackupHistory(); }); }
    async function validateBackupZipFile(file) {
      if (!file) throw new Error('Choose a backup ZIP first');
      if (!String(file.name || '').toLowerCase().endsWith('.zip')) throw new Error('Backup file must be a ZIP archive.');
      if (Number(file.size || 0) < 22) throw new Error('Backup ZIP appears to be empty or incomplete.');
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const zipHeader = head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2]);
      if (!zipHeader) throw new Error('The selected file is not a valid ZIP backup.');
      const tailSize = Math.min(Number(file.size || 0), 65557);
      const tail = new Uint8Array(await file.slice(file.size - tailSize).arrayBuffer());
      let hasEndHeader = false;
      for (let i = 0; i <= tail.length - 4; i++) {
        if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
          hasEndHeader = true;
          break;
        }
      }
      if (!hasEndHeader) throw new Error('Backup ZIP appears incomplete. Please download or create the backup again.');
      return true;
    }
    const SYSTEM_RESTORE_PASSWORD = 'CAgrO+2026';
    function validateRestorePassword(password, errorElId) {
      const errorEl = document.getElementById(errorElId);
      const value = String(password || '').trim();
      const setError = (message) => {
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.classList.remove('hidden');
        }
      };
      if (!value) {
        setError('System restore password is required.');
        return false;
      }
      if (value !== SYSTEM_RESTORE_PASSWORD) {
        setError('Incorrect system restore password.');
        return false;
      }
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
      return true;
    }
    function appendRestorePassword(fd, password) {
      fd.append('restore_password', String(password || '').trim());
      return fd;
    }

    function openRestoreBackupModal() {
      if (!requirePrivilege('manage_backups')) return;
      const modal = document.getElementById('restoreBackupModal');
      const fileInput = document.getElementById('restoreBackupFile');
      const passwordInput = document.getElementById('restoreBackupPassword');
      const errorEl = document.getElementById('restoreBackupPasswordError');
      if (fileInput) fileInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
      const fileLabel = document.getElementById('restoreBackupFileLabel');
      if (fileLabel) fileLabel.textContent = 'ZIP backups only.';
      setupGenericFileDropZone({ zoneId: 'restoreBackupDropZone', inputId: 'restoreBackupFile', labelId: 'restoreBackupFileLabel', emptyText: 'ZIP backups only.' });
      if (modal) modal.classList.remove('hidden');
    }

    function closeRestoreBackupModal() {
      document.getElementById('restoreBackupModal')?.classList.add('hidden');
    }

    async function restoreBackup() {
      if (!requirePrivilege('manage_backups')) return;
      const file = document.getElementById('restoreBackupFile')?.files?.[0];
      const password = document.getElementById('restoreBackupPassword')?.value || '';
      if (!file) return toast('Choose a backup ZIP first', 'error');
      if (!validateRestorePassword(password, 'restoreBackupPasswordError')) return;
      try {
        await validateBackupZipFile(file);
      } catch (e) {
        return toast(e.message || 'Invalid backup ZIP.', 'error');
      }
      openConfirmModal('Restoring a backup will replace the current database and uploaded files. A pre-restore backup will be created before continuing.', async () => {
        const fd = appendRestorePassword(new FormData(), password); fd.append('backup', file);
        heavyOperationInProgress = true;
        document.querySelectorAll('#content-backup-restore button, #content-backup-restore input').forEach(el => el.disabled = true);
        try {
          const r = await downloadsFormsUploadRequest(`${API}/backups/restore`, 'POST', fd, file.name, {
            title: 'Restoring backup',
            initialStatus: 'Uploading backup ZIP...',
            progressStatus: 'Uploading backup...',
            uploadCompleteStatus: 'Upload complete. Restoring database and files...'
          });
          document.body.insertAdjacentHTML('beforeend', `<div class="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex items-center justify-center p-6"><div class="max-w-xl text-center space-y-4"><div class="spinner w-10 h-10 border-4 border-t-cyan-600 mx-auto"></div><h1 class="text-2xl font-black text-gray-950 dark:text-gray-50">Restore completed</h1><p class="text-gray-700 dark:text-gray-300">The server is restarting. If the system does not reopen automatically, please refresh the browser or restart the server/container manually.</p></div></div>`);
          toast(r.message || 'Restore complete');
        }
        catch(e) { toast(e.message, 'error'); }
        finally {
          heavyOperationInProgress = false;
          document.querySelectorAll('#content-backup-restore button, #content-backup-restore input').forEach(el => el.disabled = false);
        }
      });
    }

    function ensureLoginRestoreModal() {
      if (document.getElementById('loginRestoreModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="loginRestoreModal" class="fixed inset-0 bg-black/50 hidden z-[90] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-black text-gray-950 dark:text-gray-50">Restore Backup</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a ZIP backup and enter the system restore password.</p>
              </div>
              <button type="button" onclick="closeLoginRestoreModal()" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
              <div class="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">This will replace the current database and uploaded files. A pre-restore backup will be created first.</div>
              <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Backup ZIP</label>
                ${fileDropZoneHtml({ zoneId: 'loginRestoreBackupDropZone', inputId: 'loginRestoreBackupFile', labelId: 'loginRestoreBackupFileLabel', title: 'Drag and drop backup ZIP here, or click to browse', help: 'ZIP backups only.', accept: '.zip' })}
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">System restore password</label>
                <input id="loginRestorePassword" type="password" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <div id="loginRestorePasswordError" class="hidden mt-1.5 text-xs font-bold text-red-600 dark:text-red-400"></div>
              </div>
            </div>
            <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" data-modal-action="cancel" onclick="closeLoginRestoreModal()" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
              <button type="button" data-modal-action="confirm" onclick="submitLoginRestoreBackup()" class="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700">Restore Backup</button>
            </div>
          </div>
        </div>`);
    }
    function openLoginRestoreModal() {
      clearAuthState();
      ensureLoginRestoreModal();
      document.getElementById('loginRestoreBackupFile').value = '';
      document.getElementById('loginRestoreBackupFileLabel').textContent = 'ZIP backups only.';
      document.getElementById('loginRestorePassword').value = '';
      document.getElementById('loginRestorePasswordError').classList.add('hidden');
      setupGenericFileDropZone({ zoneId: 'loginRestoreBackupDropZone', inputId: 'loginRestoreBackupFile', labelId: 'loginRestoreBackupFileLabel', emptyText: 'ZIP backups only.' });
      document.getElementById('loginRestoreModal').classList.remove('hidden');
      setTimeout(() => document.getElementById('loginRestoreBackupFile')?.focus(), 50);
    }
    function closeLoginRestoreModal() {
      document.getElementById('loginRestoreModal')?.classList.add('hidden');
    }
    async function submitLoginRestoreBackup() {
      const file = document.getElementById('loginRestoreBackupFile')?.files?.[0];
      const password = document.getElementById('loginRestorePassword')?.value || '';
      if (!file) return toast('Choose a backup ZIP first', 'error');
      if (!validateRestorePassword(password, 'loginRestorePasswordError')) return;
      try {
        await validateBackupZipFile(file);
      } catch (e) {
        return toast(e.message || 'Invalid backup ZIP.', 'error');
      }
      const fd = appendRestorePassword(new FormData(), password);
      fd.append('backup', file);
      heavyOperationInProgress = true;
      try {
        closeLoginRestoreModal();
        const r = await downloadsFormsUploadRequest(`${API}/backups/restore-login`, 'POST', fd, file.name, {
          title: 'Restoring backup',
          initialStatus: 'Uploading backup ZIP...',
          progressStatus: 'Uploading backup...',
          uploadCompleteStatus: 'Upload complete. Restoring database and files...'
        });
        document.body.insertAdjacentHTML('beforeend', `<div class="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex items-center justify-center p-6"><div class="max-w-xl text-center space-y-4"><div class="spinner w-10 h-10 border-4 border-t-cyan-600 mx-auto"></div><h1 class="text-2xl font-black text-gray-950 dark:text-gray-50">Restore completed</h1><p class="text-gray-700 dark:text-gray-300">The server is restarting. If the system does not reopen automatically, please refresh the browser or restart the server/container manually.</p></div></div>`);
        toast(r.message || 'Restore complete');
      } catch (e) {
        ensureLoginRestoreModal();
        document.getElementById('loginRestoreModal').classList.remove('hidden');
        document.getElementById('loginRestorePasswordError').textContent = e.message || 'Restore failed.';
        document.getElementById('loginRestorePasswordError').classList.remove('hidden');
      } finally {
        heavyOperationInProgress = false;
      }
    }

    let downloadsFormsCache = [];
    let downloadsFormsMeta = { categories: [], can_upload: false, can_manage: false };
    const downloadsFormsExecutableExtensions = new Set(['apk', 'exe', 'msi', 'bat', 'ps1', 'zip', 'rar', '7z']);
    const downloadsFormsSuggestedCategories = ['Applications / Tools', 'Forms', 'Templates', 'Checklists', 'Guides / Manuals', 'Others'];
    let downloadsFormsTransferRequest = null;

    function ensureDownloadsFormsProgressModal() {
      if (document.getElementById('downloadsFormsProgressModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="downloadsFormsProgressModal" class="fixed inset-0 bg-black/50 hidden z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-start gap-4">
              <div id="downloadsFormsProgressIcon" class="spinner w-9 h-9 border-4 border-t-indigo-600 shrink-0"></div>
              <div class="min-w-0 flex-1">
                <h3 id="downloadsFormsProgressTitle" class="text-lg font-black text-gray-900 dark:text-gray-100">Transferring file</h3>
                <p id="downloadsFormsProgressFile" class="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate"></p>
              </div>
              <div id="downloadsFormsProgressPercent" class="text-lg font-black text-indigo-600 dark:text-indigo-300">0%</div>
            </div>
            <div class="mt-5 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div id="downloadsFormsProgressBar" class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 transition-[width] duration-200 ease-out" style="width:0%"></div>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span id="downloadsFormsProgressStatus">Preparing transfer...</span>
              <span id="downloadsFormsProgressBytes"></span>
            </div>
            <button id="downloadsFormsProgressCancel" type="button" onclick="cancelDownloadsFormsTransfer()" class="mt-5 w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>`);
    }

    function transferFilenameFromDisposition(disposition = '', fallback = '') {
      const match = String(disposition || '').match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      if (!match) return fallback;
      try { return decodeURIComponent(match[1].replace(/^"|"$/g, '')); } catch { return match[1].replace(/^"|"$/g, '') || fallback; }
    }

    function showDownloadsFormsProgress(kind, filename, options = {}) {
      ensureDownloadsFormsProgressModal();
      document.getElementById('downloadsFormsProgressTitle').textContent = options.title || (kind === 'upload' ? 'Uploading file' : 'Downloading file');
      document.getElementById('downloadsFormsProgressFile').textContent = filename || options.fallbackFilename || 'File transfer';
      document.getElementById('downloadsFormsProgressPercent').textContent = '0%';
      document.getElementById('downloadsFormsProgressStatus').textContent = options.initialStatus || (kind === 'upload' ? 'Preparing upload...' : 'Preparing download...');
      document.getElementById('downloadsFormsProgressBytes').textContent = '';
      const bar = document.getElementById('downloadsFormsProgressBar');
      bar.style.width = '0%';
      bar.classList.remove('animate-pulse');
      document.getElementById('downloadsFormsProgressCancel').classList.remove('hidden');
      document.getElementById('downloadsFormsProgressModal').classList.remove('hidden');
    }

    function updateDownloadsFormsProgress(loaded, total, status) {
      const hasTotal = Number.isFinite(total) && total > 0;
      const percent = hasTotal ? Math.min(100, Math.round((loaded / total) * 100)) : null;
      const bar = document.getElementById('downloadsFormsProgressBar');
      if (percent === null) {
        bar.style.width = '35%';
        bar.classList.add('animate-pulse');
        document.getElementById('downloadsFormsProgressPercent').textContent = '...';
      } else {
        bar.classList.remove('animate-pulse');
        bar.style.width = `${percent}%`;
        document.getElementById('downloadsFormsProgressPercent').textContent = `${percent}%`;
      }
      document.getElementById('downloadsFormsProgressStatus').textContent = status || 'Transferring...';
      document.getElementById('downloadsFormsProgressBytes').textContent = hasTotal
        ? `${formatBytes(loaded)} / ${formatBytes(total)}`
        : formatBytes(loaded);
    }

    function finishDownloadsFormsProgress(status = 'Finishing...') {
      const bar = document.getElementById('downloadsFormsProgressBar');
      bar.style.width = '100%';
      bar.classList.add('animate-pulse');
      document.getElementById('downloadsFormsProgressPercent').textContent = '100%';
      document.getElementById('downloadsFormsProgressStatus').textContent = status;
      document.getElementById('downloadsFormsProgressCancel').classList.add('hidden');
    }

    function hideDownloadsFormsProgress() {
      document.getElementById('downloadsFormsProgressModal')?.classList.add('hidden');
      downloadsFormsTransferRequest = null;
      heavyOperationInProgress = false;
    }

    function cancelDownloadsFormsTransfer() {
      downloadsFormsTransferRequest?.abort();
    }

    function downloadsFormsUploadRequest(url, method, body, filename, options = {}) {
      showDownloadsFormsProgress('upload', filename, options);
      heavyOperationInProgress = true;
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const requestAuthToken = authToken;
        downloadsFormsTransferRequest = xhr;
        xhr.open(method, url);
        if (requestAuthToken) xhr.setRequestHeader('Authorization', `Bearer ${requestAuthToken}`);
        xhr.upload.onprogress = event => updateDownloadsFormsProgress(event.loaded, event.total, options.progressStatus || 'Uploading...');
        xhr.upload.onload = () => finishDownloadsFormsProgress(options.uploadCompleteStatus || 'Upload complete. Processing file...');
        xhr.onload = () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
          if (xhr.status === 401 && requestAuthToken && requestAuthToken === authToken) handleServerSessionUnauthorized(data.code);
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(data.error || 'Upload failed'));
          resolve(data);
        };
        xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.onloadend = () => setTimeout(hideDownloadsFormsProgress, 250);
        xhr.send(body);
      });
    }

    function downloadsFormsDownloadRequest(url, filename, options = {}) {
      showDownloadsFormsProgress('download', filename, options);
      heavyOperationInProgress = true;
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const requestAuthToken = authToken;
        downloadsFormsTransferRequest = xhr;
        xhr.open(options.method || 'GET', url);
        xhr.responseType = 'blob';
        if (requestAuthToken) xhr.setRequestHeader('Authorization', `Bearer ${requestAuthToken}`);
        Object.entries(options.headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.onprogress = event => updateDownloadsFormsProgress(event.loaded, event.total, options.progressStatus || 'Downloading...');
        xhr.onload = async () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            let data = {};
            try { data = JSON.parse(await xhr.response.text()); } catch {}
            if (xhr.status === 401 && requestAuthToken && requestAuthToken === authToken) handleServerSessionUnauthorized(data.code);
            return reject(new Error(data.error || 'Download failed'));
          }
          finishDownloadsFormsProgress(options.finishingStatus || 'Download complete. Saving file...');
          const resolvedFilename = transferFilenameFromDisposition(xhr.getResponseHeader('Content-Disposition'), filename);
          resolve(options.returnMeta ? { blob: xhr.response, filename: resolvedFilename, xhr } : xhr.response);
        };
        xhr.onerror = () => reject(new Error('Download failed. Check your connection and try again.'));
        xhr.onabort = () => reject(new Error('Download cancelled.'));
        xhr.onloadend = () => setTimeout(hideDownloadsFormsProgress, 250);
        xhr.send(options.body || null);
      });
    }
