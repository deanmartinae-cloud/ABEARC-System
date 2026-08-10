
    async function renderDownloadsForms() {
      const el = document.getElementById('content-downloads-forms');
      if (!el) return;
      el.innerHTML = '<div class="settings-card p-4 text-sm text-gray-500">Loading forms and tools...</div>';
      try {
        const data = await fetchJson(`${API}/downloads-forms`);
        downloadsFormsCache = data.items || data.tools || [];
        downloadsFormsMeta = data;
        const activeCount = downloadsFormsCache.filter(item => item.status === 'Active').length;
        el.innerHTML = `
          <div class="enterprise-card overflow-hidden">
            <div class="px-4 py-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.95fr)] gap-3 items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-10 w-10 rounded bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900 text-cyan-700 dark:text-cyan-300 grid place-items-center shrink-0">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M6 3.5h9l3 3V12M15 3.5v4h4M6 3.5a2 2 0 00-2 2v14a2 2 0 002 2h7M8 10.5h6M8 14h5M8 17.5h3.5"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M20.5 13.2a4.5 4.5 0 01-5.7 5.7l-4 4-2.7-2.7 4-4a4.5 4.5 0 015.7-5.7l-2.5 2.5 2.2 2.2 3-2z"/></svg>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Documents</p>
                  <h2 class="text-2xl font-black text-gray-950 dark:text-gray-50 leading-tight">Forms &amp; Tools</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${downloadsFormsCache.length} file${downloadsFormsCache.length === 1 ? '' : 's'} - ${activeCount} active</p>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_150px_auto] gap-2 items-center min-w-0">
                <div class="relative min-w-0">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input id="downloadsFormsSearch" type="search" oninput="filterDownloadsForms()" placeholder="Search forms and tools" class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-cyan-600 outline-none">
                </div>
                <select id="downloadsFormsCategory" onchange="filterDownloadsForms()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-3 py-2.5">
                  <option value="">All Categories</option>
                  ${[...new Set([...downloadsFormsSuggestedCategories, ...(data.categories || [])])].map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
                </select>
                ${data.can_manage ? `<select id="downloadsFormsStatus" onchange="filterDownloadsForms()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-3 py-2.5"><option value="">All Statuses</option><option value="Active">Active</option><option value="Archived">Archived</option></select>` : '<span></span>'}
                ${data.can_upload ? `<button onclick="openDownloadsFormsModal()" class="h-10 px-4 bg-green-600 hover:bg-green-700 text-white rounded font-black whitespace-nowrap">Upload File</button>` : ''}
              </div>
            </div>
            <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-amber-900 dark:text-amber-100">
              Only download and install tools uploaded by authorized ABED personnel.
            </div>
            <div id="downloadsFormsList"></div>
          </div>`;
        renderDownloadsFormsList(downloadsFormsCache);
      } catch (e) {
        el.innerHTML = `<div class="settings-card p-4 text-red-600">${esc(e.message || 'Failed to load forms and tools')}</div>`;
      }
    }

    function filterDownloadsForms() {
      const term = (document.getElementById('downloadsFormsSearch')?.value || '').toLowerCase();
      const category = document.getElementById('downloadsFormsCategory')?.value || '';
      const status = document.getElementById('downloadsFormsStatus')?.value || '';
      const rows = downloadsFormsCache.filter(item => {
        const haystack = [item.title, item.version, item.category, item.description, item.original_filename, item.file_type, item.uploaded_by_username].join(' ').toLowerCase();
        return (!term || haystack.includes(term)) && (!category || item.category === category) && (!status || item.status === status);
      });
      renderDownloadsFormsList(rows);
    }

    function downloadsFormsFileStatusBadge(status) {
      return status === 'Archived'
        ? '<span class="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Archived</span>'
        : '<span class="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Active</span>';
    }

    function canEditDownloadsFormsItem(tool) {
      return tool?.can_edit === true && Number(tool.uploaded_by_user_id) === Number(currentUser?.id);
    }

    function canDeleteDownloadsFormsItem(tool) {
      return tool?.can_delete === true && Number(tool.uploaded_by_user_id) === Number(currentUser?.id);
    }

    function downloadsFormsFileFileLabel(tool) {
      const type = String(tool.file_type || '').toUpperCase();
      const executable = downloadsFormsExecutableExtensions.has(String(tool.file_type || '').toLowerCase());
      const filename = tool.original_filename || tool.stored_filename || '-';
      return `<div class="max-w-[18rem] min-w-0"><div class="font-medium text-gray-800 dark:text-gray-100 truncate" title="${esc(filename)}">${esc(filename)}</div><div class="text-xs text-gray-500">${type || '-'} - ${formatBytes(Number(tool.file_size || 0))}${executable ? ' - executable' : ''}</div></div>`;
    }

    function downloadsFormsTitleCell(tool) {
      const title = tool.title || '-';
      const description = tool.description || 'No description provided.';
      return `<div class="flex items-start gap-2 min-w-0">
        <span class="font-bold text-gray-900 dark:text-gray-100 break-words" title="${esc(title)}">${esc(title)}</span>
        <button type="button" onclick="openDownloadsFormsDescription(${Number(tool.id)})" class="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full border border-cyan-200 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 text-xs font-black hover:bg-cyan-100 dark:hover:bg-cyan-900/40" title="${esc(description)}" aria-label="View description for ${esc(title)}">i</button>
      </div>`;
    }

    function ensureDownloadsFormsDescriptionModal() {
      if (document.getElementById('downloadsFormsDescriptionModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="downloadsFormsDescriptionModal" class="fixed inset-0 bg-black/50 hidden z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onclick="if(event.target === this) closeModal('downloadsFormsDescriptionModal')">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-900">
              <div class="min-w-0">
                <h3 id="downloadsFormsDescriptionTitle" class="text-lg font-black text-gray-900 dark:text-gray-100 truncate"></h3>
                <p id="downloadsFormsDescriptionMeta" class="mt-1 text-xs text-gray-500 dark:text-gray-400"></p>
              </div>
              <button onclick="closeModal('downloadsFormsDescriptionModal')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none p-2">&times;</button>
            </div>
            <div id="downloadsFormsDescriptionBody" class="p-5 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"></div>
          </div>
        </div>`);
    }

    function openDownloadsFormsDescription(id) {
      const tool = downloadsFormsCache.find(item => Number(item.id) === Number(id));
      if (!tool) return toast('File details not found.', 'error');
      ensureDownloadsFormsDescriptionModal();
      document.getElementById('downloadsFormsDescriptionTitle').textContent = tool.title || 'Forms & Tools file';
      document.getElementById('downloadsFormsDescriptionMeta').textContent = `${tool.category || 'Uncategorized'} - Version ${tool.version || '-'}`;
      document.getElementById('downloadsFormsDescriptionBody').textContent = tool.description || 'No description provided.';
      document.getElementById('downloadsFormsDescriptionModal').classList.remove('hidden');
    }

    function downloadsFormsFileActions(tool) {
      return `<div class="flex items-center gap-1.5 whitespace-nowrap">
        <button onclick="downloadDownloadsFormsFile(${Number(tool.id)})" class="w-8 h-8 inline-flex items-center justify-center rounded border border-cyan-200 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="Download" aria-label="Download"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14"/></svg></button>
        ${tool.status === 'Active' ? `<button onclick="shareDownloadsFormsFile(${Number(tool.id)})" class="w-8 h-8 inline-flex items-center justify-center rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50" title="Share" aria-label="Share"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l5 5-5 5m5-5H9a4 4 0 00-4 4v4"/></svg></button>` : ''}
        ${canEditDownloadsFormsItem(tool) ? `<button onclick="openDownloadsFormsModal(${Number(tool.id)})" class="w-8 h-8 inline-flex items-center justify-center rounded border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Edit" aria-label="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.2 5.2l3.6 3.6M4 20l4.2-1 10.6-10.6a2.5 2.5 0 00-3.6-3.6L4.6 15.4 4 20z"/></svg></button>` : ''}
        ${canDeleteDownloadsFormsItem(tool) ? `<button onclick="deleteDownloadsFormsFile(${Number(tool.id)})" class="w-8 h-8 inline-flex items-center justify-center rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50" title="Delete" aria-label="Delete">${svgDelete}</button>` : ''}
      </div>`;
    }

    function renderDownloadsFormsList(tools) {
      const target = document.getElementById('downloadsFormsList');
      if (!target) return;
      const rowHtml = tools.map(tool => `<tr class="border-t border-gray-200 dark:border-gray-700 align-top">
        <td class="px-3 py-3 max-w-[18rem]">${downloadsFormsTitleCell(tool)}</td>
        <td class="px-3 py-3">${esc(tool.version || '-')}</td>
        <td class="px-3 py-3">${esc(tool.category || '-')}</td>
        <td class="px-3 py-3">${downloadsFormsFileFileLabel(tool)}</td>
        <td class="px-3 py-3"><div>${esc(tool.uploaded_by_username || '-')}</div><div class="text-xs text-gray-500">${fmtDateTime(tool.created_at)}</div></td>
        <td class="px-3 py-3">${Number(tool.download_count || 0)}</td>
        <td class="px-3 py-3">${downloadsFormsFileStatusBadge(tool.status)}</td>
        <td class="px-3 py-3">${downloadsFormsFileActions(tool)}</td>
      </tr>`).join('');
      const cardHtml = tools.map(tool => `<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 space-y-3">
        <div class="flex items-start justify-between gap-2"><div class="min-w-0">${downloadsFormsTitleCell(tool, true)}<div class="text-xs text-gray-500 mt-1">Version ${esc(tool.version || '-')} - ${esc(tool.category || '-')}</div></div>${downloadsFormsFileStatusBadge(tool.status)}</div>
        <div class="text-sm">${downloadsFormsFileFileLabel(tool)}</div>
        <div class="grid grid-cols-2 gap-2 text-xs text-gray-500"><div>Uploaded by<br><strong class="text-gray-700 dark:text-gray-300">${esc(tool.uploaded_by_username || '-')}</strong></div><div>Upload date<br><strong class="text-gray-700 dark:text-gray-300">${fmtDateTime(tool.created_at)}</strong></div><div>Downloads<br><strong class="text-gray-700 dark:text-gray-300">${Number(tool.download_count || 0)}</strong></div></div>
        ${downloadsFormsFileActions(tool)}
      </div>`).join('');
      target.innerHTML = `
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-950 text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr><th class="px-3 py-3">Title</th><th class="px-3 py-3">Version</th><th class="px-3 py-3">Category</th><th class="px-3 py-3">File</th><th class="px-3 py-3">Uploaded</th><th class="px-3 py-3">Downloads</th><th class="px-3 py-3">Status</th><th class="px-3 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>${rowHtml || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No forms and tools found.</td></tr>'}</tbody>
          </table>
        </div>
        <div class="md:hidden p-3 space-y-3 bg-white dark:bg-gray-900">${cardHtml || '<div class="p-4 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-500">No forms and tools found.</div>'}</div>`;
    }

    function ensureDownloadsFormsModal() {
      if (document.getElementById('downloadsFormsFileModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="downloadsFormsFileModal" class="fixed inset-0 bg-black/50 hidden z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900"><h3 id="downloadsFormsFileModalTitle" class="text-lg font-bold text-gray-900 dark:text-gray-100">Upload File</h3><button onclick="closeModal('downloadsFormsFileModal')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none p-2">&times;</button></div>
            <form id="downloadsFormsFileForm" class="p-5 space-y-4">
              <input type="hidden" id="downloadsFormsFileId">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm font-semibold mb-1">Title</label><input id="downloadsFormsFileTitle" required class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></div>
                <div><label class="block text-sm font-semibold mb-1">Version</label><input id="downloadsFormsFileVersion" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></div>
                <div><label class="block text-sm font-semibold mb-1">Category</label><input id="downloadsFormsFileCategoryInput" required list="downloadsFormsFileCategoryOptions" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"><datalist id="downloadsFormsFileCategoryOptions"></datalist></div>
                <div><label class="block text-sm font-semibold mb-1">Status</label><select id="downloadsFormsFileStatus" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"><option value="Active">Active</option><option value="Archived">Archived</option></select></div>
              </div>
              <div><label class="block text-sm font-semibold mb-1">Description</label><textarea id="downloadsFormsFileDescription" rows="3" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"></textarea></div>
              <div>
                <label class="block text-sm font-semibold mb-1">File upload</label>
                <div id="downloadsFormsFileDropZone" class="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 px-4 py-6 text-center cursor-pointer transition hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                  <input id="downloadsFormsFileFile" type="file" class="sr-only">
                  <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-300">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
                  </div>
                  <div class="text-sm font-bold text-gray-800 dark:text-gray-100">Drop file here or click to browse</div>
                  <div id="downloadsFormsSelectedFileName" class="mt-1 text-xs text-gray-500 dark:text-gray-400">All file types are allowed.</div>
                </div>
                <p id="downloadsFormsFileFileHelp" class="mt-1 text-xs text-gray-500">All file types are allowed. Maximum size: 1 GB.</p>
              </div>
              <div class="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-100">Only download and install tools uploaded by authorized ABED personnel.</div>
              <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal('downloadsFormsFileModal')" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-bold">Cancel</button><button id="downloadsFormsFileSubmit" type="submit" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">Upload File</button></div>
            </form>
          </div>
        </div>`);
      document.getElementById('downloadsFormsFileForm').onsubmit = submitDownloadsFormsForm;
      setupDownloadsFormsDropZone();
    }

    function updateDownloadsFormsSelectedFileLabel(file = null) {
      const label = document.getElementById('downloadsFormsSelectedFileName');
      if (!label) return;
      label.textContent = file ? `${file.name} - ${formatBytes(file.size || 0)}` : 'All file types are allowed.';
    }

    function setupDownloadsFormsDropZone() {
      const zone = document.getElementById('downloadsFormsFileDropZone');
      const input = document.getElementById('downloadsFormsFileFile');
      if (!zone || !input || zone.dataset.dropReady === '1') return;
      zone.dataset.dropReady = '1';
      zone.addEventListener('click', () => input.click());
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('change', () => updateDownloadsFormsSelectedFileLabel(input.files?.[0] || null));
      ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, event => {
          event.preventDefault();
          zone.classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950/30');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, event => {
          event.preventDefault();
          zone.classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950/30');
        });
      });
      zone.addEventListener('drop', event => {
        const files = event.dataTransfer?.files;
        if (!files || !files.length) return;
        input.files = files;
        updateDownloadsFormsSelectedFileLabel(files[0]);
      });
    }

    function openDownloadsFormsModal(id = null) {
      const tool = id ? downloadsFormsCache.find(t => Number(t.id) === Number(id)) : null;
      if (id && !canEditDownloadsFormsItem(tool)) return toast('Only the uploader can edit this Forms & Tools item.', 'error');
      if (!id && !downloadsFormsMeta.can_upload) return toast('Permission denied: upload_downloads_forms', 'error');
      ensureDownloadsFormsModal();
      document.getElementById('downloadsFormsFileModalTitle').textContent = tool ? 'Edit Forms & Tools File' : 'Upload File';
      document.getElementById('downloadsFormsFileSubmit').textContent = tool ? 'Save Changes' : 'Upload File';
      document.getElementById('downloadsFormsFileId').value = tool?.id || '';
      document.getElementById('downloadsFormsFileTitle').value = tool?.title || '';
      document.getElementById('downloadsFormsFileVersion').value = tool?.version || '';
      document.getElementById('downloadsFormsFileCategoryInput').value = tool?.category || '';
      document.getElementById('downloadsFormsFileDescription').value = tool?.description || '';
      document.getElementById('downloadsFormsFileStatus').value = tool?.status || 'Active';
      const fileInput = document.getElementById('downloadsFormsFileFile');
      fileInput.value = '';
      fileInput.required = !tool;
      updateDownloadsFormsSelectedFileLabel();
      document.getElementById('downloadsFormsFileFileHelp').textContent = tool ? `Drop a replacement file here or leave blank to keep current file: ${tool.original_filename || ''}` : 'All file types are allowed. Maximum size: 1 GB.';
      document.getElementById('downloadsFormsFileCategoryOptions').innerHTML = [...new Set([...downloadsFormsSuggestedCategories, ...(downloadsFormsMeta.categories || [])])].map(c => `<option value="${esc(c)}"></option>`).join('');
      document.getElementById('downloadsFormsFileModal').classList.remove('hidden');
    }

    async function submitDownloadsFormsForm(event) {
      event.preventDefault();
      const id = document.getElementById('downloadsFormsFileId').value;
      const existingTool = id ? downloadsFormsCache.find(item => Number(item.id) === Number(id)) : null;
      if (id && !canEditDownloadsFormsItem(existingTool)) return toast('Only the uploader can edit this Forms & Tools item.', 'error');
      if (!id && !downloadsFormsMeta.can_upload) return toast('Permission denied: upload_downloads_forms', 'error');
      const fd = new FormData();
      fd.append('title', document.getElementById('downloadsFormsFileTitle').value.trim());
      fd.append('version', document.getElementById('downloadsFormsFileVersion').value.trim());
      fd.append('category', document.getElementById('downloadsFormsFileCategoryInput').value.trim());
      fd.append('description', document.getElementById('downloadsFormsFileDescription').value.trim());
      fd.append('status', document.getElementById('downloadsFormsFileStatus').value);
      const file = document.getElementById('downloadsFormsFileFile').files[0];
      if (file) fd.append('file', file);
      const submitButton = document.getElementById('downloadsFormsFileSubmit');
      submitButton.disabled = true;
      try {
        await downloadsFormsUploadRequest(
          `${API}/downloads-forms${id ? `/${id}` : '/upload'}`,
          id ? 'PUT' : 'POST',
          fd,
          file?.name || downloadsFormsCache.find(item => Number(item.id) === Number(id))?.original_filename || 'File details'
        );
        closeModal('downloadsFormsFileModal');
        toast(id ? 'File updated' : 'File uploaded');
        renderDownloadsForms();
      } catch (e) {
        toast(e.message || 'Failed to save file', 'error');
      } finally {
        submitButton.disabled = false;
      }
    }

    async function downloadDownloadsFormsFile(id) {
      const tool = downloadsFormsCache.find(t => Number(t.id) === Number(id));
      const ext = String(tool?.file_type || '').toLowerCase();
      const filename = tool?.original_filename || 'downloads-form-file';
      const proceed = () => {
        try {
          nativeAuthenticatedDownload(`${API}/downloads-forms/${Number(id)}/download`, filename);
          setTimeout(renderDownloadsForms, 1000);
        } catch (e) {
          toast(e.message || 'Download failed', 'error');
        }
      };
      openConfirmModal(
        `Download <strong>${esc(tool?.title || filename)}</strong>?${downloadsFormsExecutableExtensions.has(ext) ? '<div class="mt-2 text-sm text-amber-700 dark:text-amber-300">Only download and install tools uploaded by authorized ABED personnel.</div>' : ''}`,
        proceed,
        { title: 'Confirm Download', confirmText: 'Download', confirmClass: 'px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium' }
      );
    }

    function ensureDownloadsFormsShareModal() {
      if (document.getElementById('downloadsFormsShareModal')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="downloadsFormsShareModal" class="fixed inset-0 bg-black/50 hidden z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onclick="if(event.target === this) closeModal('downloadsFormsShareModal')">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div><h3 class="text-lg font-black text-gray-900 dark:text-gray-100">Share Download</h3><p id="downloadsFormsShareTitle" class="text-sm text-gray-500 dark:text-gray-400 mt-1"></p></div>
              <button onclick="closeModal('downloadsFormsShareModal')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none p-2">&times;</button>
            </div>
            <div class="p-5 space-y-4">
              <div id="downloadsFormsShareLoading" class="py-12 text-center"><div class="spinner w-9 h-9 border-4 border-t-emerald-600 mx-auto"></div><p class="mt-3 text-sm text-gray-500">Creating secure share link...</p></div>
              <div id="downloadsFormsShareContent" class="hidden space-y-4">
                <div class="flex justify-center"><div class="p-3 bg-white rounded-xl border border-gray-200 shadow-sm"><img id="downloadsFormsShareQr" alt="QR code for file download" class="w-64 h-64 max-w-full"></div></div>
                <p class="text-center text-sm text-gray-600 dark:text-gray-300">Scan this QR code to download the file.</p>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Download link</label>
                  <a id="downloadsFormsShareLink" target="_blank" rel="noopener" class="block break-all rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm font-semibold text-cyan-700 dark:text-cyan-300 hover:underline"></a>
                </div>
                <p id="downloadsFormsShareExpiry" class="text-xs text-center text-gray-500 dark:text-gray-400"></p>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" onclick="copyDownloadsFormsShareLink()" class="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Copy Link</button>
                  <a id="downloadsFormsShareDownload" class="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-center font-bold">Download</a>
                </div>
              </div>
            </div>
          </div>
        </div>`);
    }

    async function shareDownloadsFormsFile(id) {
      const tool = downloadsFormsCache.find(t => Number(t.id) === Number(id));
      ensureDownloadsFormsShareModal();
      document.getElementById('downloadsFormsShareTitle').textContent = tool?.title || 'Forms & Tools file';
      document.getElementById('downloadsFormsShareLoading').classList.remove('hidden');
      document.getElementById('downloadsFormsShareContent').classList.add('hidden');
      document.getElementById('downloadsFormsShareModal').classList.remove('hidden');
      try {
        const data = await fetchJson(`${API}/downloads-forms/${id}/share`, { method: 'POST' });
        document.getElementById('downloadsFormsShareQr').src = data.qr_code;
        const link = document.getElementById('downloadsFormsShareLink');
        link.href = data.download_url;
        link.textContent = data.download_url;
        document.getElementById('downloadsFormsShareDownload').href = data.download_url;
        document.getElementById('downloadsFormsShareExpiry').textContent = `Link expires ${fmtDateTime(data.expires_at)}. The device scanning the code must be able to reach this server.`;
        document.getElementById('downloadsFormsShareLoading').classList.add('hidden');
        document.getElementById('downloadsFormsShareContent').classList.remove('hidden');
      } catch (e) {
        closeModal('downloadsFormsShareModal');
        toast(e.message || 'Failed to create share link', 'error');
      }
    }

    async function shareFormsToolsApp(titlePattern, displayName) {
      try {
        let tool = downloadsFormsCache.find(item => item.status === 'Active' && titlePattern.test(String(item.title || '').trim()));
        if (!tool) {
          const data = await fetchJson(`${API}/downloads-forms`);
          downloadsFormsCache = data.items || data.tools || [];
          downloadsFormsMeta = data;
          tool = downloadsFormsCache.find(item => item.status === 'Active' && titlePattern.test(String(item.title || '').trim()));
        }
        if (!tool) throw new Error(`The ${displayName} app is not available in Forms & Tools.`);
        await shareDownloadsFormsFile(Number(tool.id));
      } catch (error) {
        toast(error.message || `Failed to create the ${displayName} share link.`, 'error');
      }
    }

    async function shareAbedGeoCamApp() {
      await shareFormsToolsApp(/^abedgeocam$/i, 'ABEDGeoCam');
    }

    async function shareMyDriveApp() {
      await shareFormsToolsApp(/^(?:abed)?mydrive(?: app)?$/i, 'MyDrive');
    }

    async function copyDownloadsFormsShareLink() {
      const url = document.getElementById('downloadsFormsShareLink')?.href;
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        toast('Download link copied');
      } catch (_) {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        toast('Download link copied');
      }
    }

    function deleteDownloadsFormsFile(id) {
      const tool = downloadsFormsCache.find(t => Number(t.id) === Number(id));
      if (!canDeleteDownloadsFormsItem(tool)) return toast('Only the uploader can delete this Forms & Tools item.', 'error');
      openConfirmModal(`Delete forms and tools file <strong>${esc(tool?.title || 'this file')}</strong>?`, async () => {
        await fetchJson(`${API}/downloads-forms/${id}`, { method: 'DELETE' });
        toast('File deleted');
        renderDownloadsForms();
      });
    }

    async function renderConfigImportExport() {
      const el = document.getElementById('content-config-import-export');
      if (!el) return;
      el.innerHTML = `<div class="settings-card p-4 space-y-4">
        <button onclick="exportConfig()" class="px-4 py-2 bg-cyan-700 text-white rounded-lg font-bold">Export Config</button>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          ${fileDropZoneHtml({ zoneId: 'configImportDropZone', inputId: 'configImportFile', labelId: 'configImportFileLabel', title: 'Drag and drop config JSON here, or click to browse', help: 'JSON config export only.', accept: '.json,application/json' })}
          <button onclick="previewConfigImport()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Preview Import</button>
          <div id="configImportPreview"></div>
        </div>
      </div>`;
      setupGenericFileDropZone({ zoneId: 'configImportDropZone', inputId: 'configImportFile', labelId: 'configImportFileLabel', emptyText: 'JSON config export only.' });
    }
    async function exportConfig() {
      if (!requirePrivilege('import_export_config')) return;
      try {
        const filename = `division-project-tracker-config-${new Date().toISOString().slice(0,10)}.json`;
        const result = await downloadsFormsDownloadRequest(`${API}/config/export`, filename, {
          title: 'Exporting configuration',
          initialStatus: 'Preparing configuration export...',
          progressStatus: 'Downloading configuration...',
          finishingStatus: 'Export complete. Saving file...',
          returnMeta: true
        });
        downloadBlob(result.blob, result.filename || filename);
      } catch (e) {
        toast(e.message || 'Config export failed', 'error');
      }
    }
    async function previewConfigImport() {
      const file = document.getElementById('configImportFile')?.files?.[0];
      if (!file) return toast('Choose a JSON config file', 'error');
      const config = JSON.parse(await file.text());
      const preview = await fetchJson(`${API}/config/preview`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(config) });
      document.getElementById('configImportPreview').innerHTML = `<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-sm space-y-1"><div>Project types: <strong>${preview.project_types}</strong></div><div>Requestees: <strong>${preview.requestees}</strong></div><div>Document types: <strong>${preview.document_types}</strong></div><div>Requirement sets: <strong>${preview.requirement_sets}</strong></div><div>Due schedules: <strong>${preview.due_schedules}</strong></div><button onclick="applyConfigImport()" class="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg font-bold">Apply Import</button></div>`;
      window.pendingConfigImport = config;
    }
    async function applyConfigImport() {
      if (!window.pendingConfigImport) return;
      openConfirmModal('Apply this configuration import? Projects and uploaded documents will not be deleted.', async () => {
        heavyOperationInProgress = true;
        try {
          await fetchJson(`${API}/config/import`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(window.pendingConfigImport) });
          toast('Configuration imported');
        } finally {
          heavyOperationInProgress = false;
        }
      });
    }

    async function renderAdminMaintenance() {
      if (!requirePrivilege('manage_maintenance')) return;
      const el = document.getElementById('content-admin-maintenance');
      if (!el) return;
      el.innerHTML = '<div class="settings-card p-4 text-sm text-gray-500">Loading maintenance summary...</div>';
      try {
        const s = await fetchJson(`${API}/maintenance/summary`);
        const storage = Object.entries(s.storage || {}).map(([k,v]) => `<div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"><div class="text-xs uppercase text-gray-500">${esc(k)}</div><div class="font-black">${formatBytes(v)}</div></div>`).join('');
        const counts = Object.entries(s.counts || {}).map(([k,v]) => `<tr class="border-b dark:border-gray-800"><td class="py-2">${esc(k.replaceAll('_',' '))}</td><td class="font-bold">${v}</td></tr>`).join('');
        el.innerHTML = `<div class="settings-card p-4 space-y-4"><div class="grid grid-cols-2 md:grid-cols-4 gap-3">${storage}</div><div class="overflow-x-auto"><table class="w-full text-sm">${counts}</table></div><div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><div class="p-3 rounded-lg border border-red-200 dark:border-red-800">Missing uploaded files: <strong>${s.health?.missing_uploaded_files || 0}</strong></div><div class="p-3 rounded-lg border border-amber-200 dark:border-amber-800">Orphan files: <strong>${s.health?.orphan_files || 0}</strong></div></div><div class="flex flex-wrap gap-2"><button onclick="clearTempFolder()" class="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-bold">Clear Temp Folder</button><button onclick="rebuildSearchIndex()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Rebuild Document Search Index</button><button onclick="createBackup()" class="px-4 py-2 bg-cyan-700 text-white rounded-lg font-bold">Create Backup</button><button onclick="downloadDiagnosticReport()" class="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-bold">Download Diagnostic Report</button><button onclick="deleteOrphanFiles()" class="px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Delete Orphan Files</button></div></div>`;
        window.lastMaintenanceSummary = s;
      } catch (e) { el.innerHTML = `<div class="text-red-600">${esc(e.message)}</div>`; }
    }
    async function clearTempFolder(){ await fetchJson(`${API}/maintenance/clear-temp`, {method:'POST'}); toast('Temp folder cleared'); renderAdminMaintenance(); }
    async function rebuildSearchIndex(){ if (!requirePrivilege('manage_maintenance')) return; const r = await fetchJson(`${API}/document-search/rebuild`, {method:'POST'}); toast(`Queued ${r.queued || 0} documents`); renderAdminMaintenance(); }
    function downloadDiagnosticReport(){
      showDownloadsFormsProgress('download', `diagnostic-report-${new Date().toISOString().slice(0,10)}.json`, {
        title: 'Preparing diagnostic report',
        initialStatus: 'Collecting maintenance summary...'
      });
      heavyOperationInProgress = true;
      updateDownloadsFormsProgress(1, 3, 'Preparing report...');
      setTimeout(() => {
        const filename = `diagnostic-report-${new Date().toISOString().slice(0,10)}.json`;
        updateDownloadsFormsProgress(2, 3, 'Saving report...');
        downloadBlob(new Blob([JSON.stringify(window.lastMaintenanceSummary || {}, null, 2)], {type:'application/json'}), filename);
        finishDownloadsFormsProgress('Diagnostic report saved.');
        setTimeout(hideDownloadsFormsProgress, 250);
      }, 150);
    }
    function deleteOrphanFiles(){ if (!requirePrivilege('manage_maintenance')) return; openConfirmModal('Delete orphan files from uploads? Database records will not be deleted.', async () => { const r = await fetchJson(`${API}/maintenance/orphan-files`, {method:'DELETE'}); toast(`Deleted ${r.deleted || 0} orphan files`); renderAdminMaintenance(); }); }

    function formatBytes(bytes) {
      const n = Number(bytes || 0);
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
      return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }

    function fileDropZoneHtml({ zoneId, inputId, labelId, title = 'Drag and drop file here, or click to browse', help = '', accept = '', multiple = false } = {}) {
      return `<div id="${zoneId}" role="button" tabindex="0" aria-label="${esc(title)}" class="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 px-4 py-6 text-center cursor-pointer transition hover:border-cyan-500 hover:bg-cyan-50/60 dark:hover:border-cyan-400 dark:hover:bg-cyan-950/20 focus:outline-none focus:ring-2 focus:ring-cyan-500">
        <input id="${inputId}" type="file" ${accept ? `accept="${esc(accept)}"` : ''} ${multiple ? 'multiple' : ''} class="sr-only">
        <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-cyan-700 dark:text-cyan-300">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
        </div>
        <div class="text-sm font-bold text-gray-800 dark:text-gray-100">${esc(title)}</div>
        <div id="${labelId}" class="mt-1 text-xs text-gray-500 dark:text-gray-400 break-words">${esc(help || 'No file selected.')}</div>
      </div>`;
    }

    function setupGenericFileDropZone({ zoneId, inputId, labelId, emptyText = 'No file selected.', multiple = false } = {}) {
      const zone = document.getElementById(zoneId);
      const input = document.getElementById(inputId);
      const label = document.getElementById(labelId);
      if (!zone || !input || zone.dataset.dropReady === '1') return;
      zone.dataset.dropReady = '1';
      const setFiles = (files) => {
        if (!files || !files.length) return;
        if (!multiple && files.length > 1) return toast('Please choose one file only.', 'error');
        try { input.files = files; } catch (e) {}
        const selected = [...files].map(file => `${file.name} (${formatBytes(file.size || 0)})`).join(', ');
        if (label) label.textContent = selected || emptyText;
      };
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      });
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('change', () => {
        if (input.files?.length) setFiles(input.files);
        else if (label) label.textContent = emptyText;
      });
      ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, event => {
          event.preventDefault();
          zone.classList.add('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
        });
      });
      ['dragleave', 'dragend', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, event => {
          event.preventDefault();
          zone.classList.remove('border-cyan-500', 'bg-cyan-50', 'dark:bg-cyan-950/30');
        });
      });
      zone.addEventListener('drop', event => setFiles(event.dataTransfer?.files));
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function nativeAuthenticatedDownload(url, filename = '') {
      const downloadUrl = authToken
        ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(authToken)}`
        : url;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || '';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    const MY_DRIVE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.zip';
    let myDriveFolderId = null;
    let myDriveTab = 'mine';
    let myDriveMode = 'grid';
    let myDriveCache = { folders: [], files: [], breadcrumbs: [], usage: { bytes: 0, files: 0 } };
    let myDriveSelectedItem = null;
    let myDriveSelectedItems = new Map();
    let myDriveSelectionAnchor = null;
    let myDriveBlankLongPressTimer = null;
    let myDriveSelectionBoxState = null;
    let myDriveClipboard = null;
    let myDriveUndoStack = [];
    let myDriveThumbUrls = new Map();
    let myDriveDetailsOpen = false;
    let myDriveSortBy = 'name';
    let myDriveSortDir = 'asc';
    let myDriveFoldersFirst = true;
    let myDriveAutoRefreshTimer = null;
    let myDriveLoading = false;
    let myDriveLastClick = { key: '', at: 0 };
