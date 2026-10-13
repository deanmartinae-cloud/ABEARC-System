    const ABEARC_MAP_LAYOUT_STATE_VERSION = 1;
    const ABEARC_MAP_LAYOUT_FILE_FORMAT = 'ABEARC_MAP_LAYOUT';
    let abearcMapLayouts = [];
    let abearcMapLayoutsLoading = false;
    let abearcMapLayoutsLoadError = '';
    let abearcMapActiveLayoutId = null;
    let abearcMapActiveLayoutRecord = null;
    let abearcMapActiveLayoutState = null;
    let abearcMapLayoutRestoring = false;
    let abearcMapLayoutPage = 0;
    let abearcMapLayoutPageSize = 5;

    function rememberAbearcMapLayoutChange() {
      if (abearcMapRestoringView || abearcMapLayoutRestoring) return;
      if (abearcMapLayoutHistoryBatch) return abearcMapLayoutHistoryBatch;
      const previous = abearcMapViewUndoStack.at(-1);
      if (abearcMapHistoryGesture && previous?.gesture === abearcMapHistoryGesture) return previous;
      const state = rememberAbearcMapView();
      if (!state) return;
      state.layout = captureAbearcMapLayoutState();
      if (abearcMapCommittedFilters) state.layout.photos.filters = { ...abearcMapCommittedFilters, search: abearcMapCommittedSearch };
      state.features = abearcMapFeatures.slice();
      state.frozen = abearcMapLayoutFrozenPhotoIds ? new Set(abearcMapLayoutFrozenPhotoIds) : null;
      state.contours = abearcMapContourData;
      state.activeLayout = [abearcMapActiveLayoutId, abearcMapActiveLayoutRecord, abearcMapActiveLayoutState];
      state.gesture = abearcMapHistoryGesture;
      abearcMapLayoutHistoryBatch = state;
      queueMicrotask(() => { if (abearcMapLayoutHistoryBatch === state) abearcMapLayoutHistoryBatch = null; });
      return state;
    }

    async function restoreAbearcMapHistoryLayout(state) {
      abearcMapAbort?.abort();
      clearTimeout(abearcMapReloadTimer);
      abearcMapContourAbort?.abort();
      abearcMapContourRequestId++;
      window.cancelAbearcSaltRequest?.();
      await restoreAbearcMapLayoutState(state.layout, state.features);
      abearcMapLayoutFrozenPhotoIds = state.frozen;
      abearcMapContourData = state.contours;
      [abearcMapActiveLayoutId, abearcMapActiveLayoutRecord, abearcMapActiveLayoutState] = state.activeLayout;
      renderAbearcMapMeasure();
      renderAbearcMapLayouts();
    }

    // One slider drag is one edit, including all intermediate input events.
    document.addEventListener('pointerdown', event => {
      if (event.target?.matches?.('#mapPage input[type="range"]')) abearcMapHistoryGesture = {};
    }, true);
    document.addEventListener('pointerup', () => { abearcMapHistoryGesture = null; }, true);
    document.addEventListener('pointercancel', () => { abearcMapHistoryGesture = null; }, true);

    function abearcMapLayoutEscape(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    }

    function abearcMapLayoutDate(value) {
      const date = new Date(value || 0);
      if (!Number.isFinite(date.getTime())) return '';
      return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    }

    function abearcMapLayoutRound(value, digits = 7) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      return Number(number.toFixed(digits));
    }

    function abearcMapLayoutFilterState() {
      return {
        search: String(abearcMapCommittedSearch || ''),
        category: String(document.getElementById('mapCategoryFilter')?.value || ''),
        district: String(document.getElementById('mapDistrictFilter')?.value || ''),
        barangay: String(document.getElementById('mapBarangayFilter')?.value || ''),
        locationStatus: String(document.getElementById('mapLocationStatusFilter')?.value || ''),
        myUploadsOnly: Boolean(document.getElementById('mapMyUploadsOnly')?.checked),
        unlinkedOnly: Boolean(document.getElementById('mapUnlinkedOnly')?.checked)
      };
    }

    function captureAbearcMapLayoutAnalysisState() {
      const contourPaths = Array.isArray(abearcMapContourData?.paths)
        ? abearcMapContourData.paths.map(path => ({
            level: Number(path?.level) || 0,
            index: Boolean(path?.index),
            points: (Array.isArray(path?.points) ? path.points : [])
              .filter(point => Array.isArray(point) && point.length >= 2 && point.every(value => Number.isFinite(Number(value))))
              .map(point => [abearcMapLayoutRound(point[0]), abearcMapLayoutRound(point[1])])
          })).filter(path => path.points.length > 1)
        : [];
      return {
        elevationSource: ABEARC_MAP_ELEVATION_SOURCES.has(abearcMapElevationSource) ? abearcMapElevationSource : ABEARC_MAP_DEFAULT_ELEVATION_SOURCE,
        contourSource: ABEARC_MAP_ELEVATION_SOURCES.has(abearcMapContourSource) ? abearcMapContourSource : ABEARC_MAP_DEFAULT_ELEVATION_SOURCE,
        contourInterval: Number(abearcMapContourInterval) || null,
        contourIndexInterval: Number(abearcMapContourIndexInterval) || null,
        saltSource: typeof abearcMapSaltSource !== 'undefined' ? abearcMapSaltSource : null,
        saltSettings: typeof abearcMapSaltSettings !== 'undefined' ? { ...abearcMapSaltSettings } : null,
        contours: contourPaths.length ? {
          imported: Boolean(abearcMapContourData?.imported),
          sourceLabel: String(abearcMapContourData?.sourceLabel || '').slice(0, 160),
          paths: contourPaths
        } : null,
        saltLayout: window.captureAbearcSaltLayoutState?.() || null
      };
    }

    function restoreAbearcMapLayoutAnalysisState(state = {}) {
      const source = ABEARC_MAP_ELEVATION_SOURCES.has(state.elevationSource) ? state.elevationSource : ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
      const contourSource = ABEARC_MAP_ELEVATION_SOURCES.has(state.contourSource) ? state.contourSource : ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
      abearcMapElevationSource = source;
      abearcMapContourSource = contourSource;
      abearcMapContourInterval = Number(state.contourInterval) > 0 ? Number(state.contourInterval) : null;
      abearcMapContourIndexInterval = Number(state.contourIndexInterval) > 0 ? Number(state.contourIndexInterval) : null;
      const contourPaths = (Array.isArray(state.contours?.paths) ? state.contours.paths : []).slice(0, 10000)
        .map(path => ({
          level: Number(path?.level) || 0,
          index: Boolean(path?.index),
          points: (Array.isArray(path?.points) ? path.points : []).slice(0, 5000)
            .filter(point => Array.isArray(point) && point.length >= 2
              && Number.isFinite(Number(point[0])) && Number(point[0]) >= -180 && Number(point[0]) <= 180
              && Number.isFinite(Number(point[1])) && Number(point[1]) >= -90 && Number(point[1]) <= 90)
            .map(point => [Number(point[0]), Number(point[1])])
        })).filter(path => path.points.length > 1);
      if (contourPaths.length) {
        const levels = contourPaths.map(path => Number(path.level)).filter(Number.isFinite);
        const imported = Boolean(state.contours?.imported);
        abearcMapContourData = {
          imported,
          paths: contourPaths,
          key: imported ? undefined : abearcContourSelectionKey(),
          sourceLabel: String(state.contours?.sourceLabel || 'Saved layout contours').slice(0, 160),
          interval: abearcMapContourInterval || null,
          indexInterval: abearcMapContourIndexInterval || null,
          minimum: levels.length ? Math.min(...levels) : 0,
          maximum: levels.length ? Math.max(...levels) : 0,
          surfaces: [],
          sampleCount: 0,
          effectiveSpacingM: 0
        };
      }
      window.restoreAbearcSaltLayoutState?.(state.saltLayout || null);
      if (state.saltSource && typeof abearcMapSaltSource !== 'undefined') abearcMapSaltSource = state.saltSource;
      if (state.saltSettings && typeof abearcMapSaltSettings !== 'undefined') abearcMapSaltSettings = { ...state.saltSettings };
      syncAbearcElevationSourceMenu();
    }

    function captureAbearcMapLayoutState() {
      if (!abearcMap) throw new Error('Open the ABEARC map before saving a layout.');
      const center = abearcMap.getCenter();
      const scopedIds = abearcMapScopedFeatures().map(feature => Number(abearcFeatureId(feature))).filter(Number.isFinite);
      const scopedSet = new Set(scopedIds);
      const movedPhotos = {};
      abearcMapMovedPhotoPositions.forEach((position, id) => {
        if (!scopedSet.has(Number(id)) || !Array.isArray(position)) return;
        movedPhotos[String(id)] = [abearcMapLayoutRound(position[0]), abearcMapLayoutRound(position[1])];
      });
      const movedPhotoSizes = {};
      abearcMapMovedPhotoSizes.forEach((size, id) => {
        if (!scopedSet.has(Number(id)) || !(Number(size?.mapWidth) > 0) || !(Number(size?.mapHeight) > 0)) return;
        movedPhotoSizes[String(id)] = {
          mapWidth: abearcMapLayoutRound(Number(size.mapWidth), 12),
          mapHeight: abearcMapLayoutRound(Number(size.mapHeight), 12)
        };
      });
      const expandedPhotos = {};
      abearcMapExpandedPhotos.forEach((size, id) => {
        if (!scopedSet.has(Number(id))) return;
        expandedPhotos[String(id)] = {
          width: Math.max(96, Math.min(720, Number(size?.width) || 260)),
          height: Math.max(1, Number(size?.height) || 180),
          aspectRatio: Number(size?.aspectRatio) > 0 ? Number(size.aspectRatio) : null,
          mapWidth: Number(size?.mapWidth) > 0 ? abearcMapLayoutRound(Number(size.mapWidth), 12) : null
        };
      });
      return {
        stateVersion: ABEARC_MAP_LAYOUT_STATE_VERSION,
        camera: {
          center: [abearcMapLayoutRound(center.lng), abearcMapLayoutRound(center.lat)],
          zoom: abearcMapLayoutRound(abearcMap.getZoom(), 4),
          bearing: abearcMapLayoutRound(abearcMap.getBearing(), 3),
          pitch: abearcMapLayoutRound(abearcMap.getPitch(), 3)
        },
        layers: {
          basemap: abearcMapBasemap,
          zoningEnabled: Boolean(abearcZoningEnabled),
          layerLabels: { ...abearcMapLayerLabels },
          photosVisible: Boolean(abearcMapPhotosVisible),
          davaoBoundaryVisible: Boolean(abearcDavaoBoundaryVisible),
          noahFlood: { enabled: Boolean(abearcNoahFloodEnabled), opacity: Number(abearcNoahFloodOpacity) },
          chirps: { enabled: Boolean(abearcChirpsEnabled), start: abearcChirpsStartDate, end: abearcChirpsEndDate, opacity: Number(abearcChirpsOpacity) },
          terraClimate: { enabled: Boolean(abearcTerraClimateEnabled), start: abearcTerraClimateStartDate, end: abearcTerraClimateEndDate, opacity: Number(abearcTerraClimateOpacity) },
          weatherStations: { enabled: window.abearcWeatherStationsVisible !== false, labelMode: window.abearcWeatherLabelMode || 'status' }
        },
        photos: {
          scope: abearcMapPhotoScope,
          filters: abearcMapLayoutFilterState(),
          frozenPhotoIds: scopedIds,
          hiddenPhotoIds: [...abearcMapSessionHiddenPhotoIds].map(Number).filter(id => scopedSet.has(id)),
          movedPhotos,
          movedPhotoSizes,
          annotations: [...abearcMapPhotoAnnotations].filter(([id]) => scopedSet.has(id)).map(([id, annotation]) => [id, { ...annotation }]),
          expandedPhotos
        },
        measurements: { ...captureAbearcMapMeasureState(), layoutAnalysis: captureAbearcMapLayoutAnalysisState() },
        ramPump: window.captureAbearcRamPumpState?.() || null,
        orthomosaics: window.captureAbearcOrthomosaicLayoutState?.() || null
      };
    }

    function abearcMapLayoutComparable(state) {
      if (!state || typeof state !== 'object') return null;
      return JSON.stringify(state);
    }

    function abearcMapLayoutHasUnsavedChanges() {
      if (!abearcMapActiveLayoutState || abearcMapLayoutRestoring || !abearcMap) return false;
      try { return abearcMapLayoutComparable(captureAbearcMapLayoutState()) !== abearcMapLayoutComparable(abearcMapActiveLayoutState); }
      catch (_) { return false; }
    }

    function syncAbearcMapLayoutActiveSummary() {
      const dirty = abearcMapLayoutHasUnsavedChanges();
      document.querySelectorAll('[data-map-layout-save]').forEach(button => {
        button.classList.toggle('hidden', Number(button.dataset.mapLayoutSave) !== Number(abearcMapActiveLayoutId) || !dirty);
      });
    }

    function changeAbearcMapLayoutPage(delta) {
      abearcMapLayoutPage = delta ? Math.max(0, abearcMapLayoutPage + delta) : 0;
      renderAbearcMapLayouts();
    }

    function toggleAbearcMapLayoutSort() {
      const button = document.querySelector('[data-map-layout-sort]');
      if (!button) return;
      button.dataset.sort = button.dataset.sort === 'name' ? 'updated' : 'name';
      button.title = button.dataset.sort === 'name' ? 'Name A–Z. Click for recently updated first.' : 'Recently updated first. Click to sort by name.';
      button.setAttribute('aria-label', button.dataset.sort === 'name' ? 'Sort by recently updated' : 'Sort by name');
      changeAbearcMapLayoutPage(0);
    }

    function abearcMapLayoutActionIcon(path) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="${path}"/></svg>`;
    }

    function renderAbearcMapLayouts() {
      const list = document.querySelector('[data-map-layout-list]');
      const railCount = document.querySelector('[data-map-layout-rail-count]');
      if (railCount) {
        railCount.textContent = String(abearcMapLayouts.length);
        railCount.classList.toggle('hidden', abearcMapLayouts.length === 0);
      }
      syncAbearcMapLayoutActiveSummary();
      if (!list) return;
      if (abearcMapLayoutsLoading) {
        list.innerHTML = '<span class="abearc-map-layout-empty">Loading layouts…</span>';
        return;
      }
      if (abearcMapLayoutsLoadError) {
        list.innerHTML = `<div class="abearc-map-layout-empty" role="alert">${abearcMapLayoutEscape(abearcMapLayoutsLoadError)} <button type="button" onclick="loadAbearcMapLayouts(true)">Retry</button></div>`;
        return;
      }
      if (!abearcMapLayouts.length) {
        abearcMapLayoutPage = 0;
        const pagination = document.querySelector('[data-map-layout-pagination]');
        if (pagination) {
          pagination.querySelector('[data-map-layout-page]').textContent = '1 / 1';
          pagination.querySelectorAll('button').forEach(button => { button.disabled = true; });
        }
        list.innerHTML = '<span class="abearc-map-layout-empty">No saved layouts yet. Save the current map when it is arranged the way you want.</span>';
        return;
      }
      const search = String(document.querySelector('[data-map-layout-search]')?.value || '').trim().toLowerCase();
      const sort = document.querySelector('[data-map-layout-sort]')?.dataset.sort || 'updated';
      const visibleLayouts = abearcMapLayouts.filter(layout => `${layout.name || ''} ${layout.description || ''}`.toLowerCase().includes(search))
        .sort((a, b) => sort === 'name' ? String(a.name).localeCompare(String(b.name)) : String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      const pageSize = Math.max(1, Math.floor((list.clientHeight || 360) / 72));
      abearcMapLayoutPageSize = pageSize;
      const pages = Math.max(1, Math.ceil(visibleLayouts.length / pageSize));
      abearcMapLayoutPage = Math.min(abearcMapLayoutPage, pages - 1);
      const pagination = document.querySelector('[data-map-layout-pagination]');
      if (pagination) {
        pagination.querySelector('[data-map-layout-page]').textContent = `${abearcMapLayoutPage + 1} / ${pages}`;
        pagination.querySelector('[data-map-layout-prev]').disabled = abearcMapLayoutPage === 0;
        pagination.querySelector('[data-map-layout-next]').disabled = abearcMapLayoutPage >= pages - 1;
      }
      if (!visibleLayouts.length) {
        list.innerHTML = '<span class="abearc-map-layout-empty">No layouts match your search.</span>';
        return;
      }
      list.innerHTML = visibleLayouts.slice(abearcMapLayoutPage * pageSize, (abearcMapLayoutPage + 1) * pageSize).map(layout => {
        const active = Number(layout.id) === Number(abearcMapActiveLayoutId);
        return `<article class="abearc-map-layout-card${active ? ' is-active' : ''}" data-map-layout-id="${Number(layout.id)}" oncontextmenu="openAbearcMapLayoutMenu(event, ${Number(layout.id)})">
          <button type="button" class="abearc-map-layout-card-open" onclick="openAbearcMapLayout(${Number(layout.id)})">
            <strong>${abearcMapLayoutEscape(layout.name)}</strong>
            ${layout.description ? `<span>${abearcMapLayoutEscape(layout.description)}</span>` : ''}
            <small>Updated ${abearcMapLayoutEscape(abearcMapLayoutDate(layout.updated_at))}</small>
          </button>
          <button type="button" class="abearc-map-layout-save hidden" data-map-layout-save="${Number(layout.id)}" onclick="updateActiveAbearcMapLayout()">Save</button>
          <details class="abearc-map-layout-card-menu">
            <summary onclick="openAbearcMapLayoutMenu(event, ${Number(layout.id)}, true)" aria-label="Layout actions" title="Layout actions"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="4" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="10" cy="16" r="2"/></svg></summary>
            <div class="abearc-map-layout-card-menu-popover">
              <button type="button" onclick="closeAbearcMapLayoutMenus(); duplicateAbearcMapLayout(${Number(layout.id)})">${abearcMapLayoutActionIcon('M9 9h12v12H9V9ZM15 9V3H3v12h6')}<span>Duplicate</span></button>
              <button type="button" onclick="closeAbearcMapLayoutMenus(); beginAbearcMapLayoutRename(${Number(layout.id)})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg><span>Rename</span></button>
              <button type="button" onclick="closeAbearcMapLayoutMenus(); exportAbearcMapLayout(${Number(layout.id)})">${abearcMapLayoutActionIcon('M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5')}<span>Export .abmap</span></button>
              <button type="button" class="is-danger" onclick="closeAbearcMapLayoutMenus(); deleteAbearcMapLayout(${Number(layout.id)})">${abearcMapLayoutActionIcon('M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7')}<span>Delete</span></button>
            </div>
          </details>
        </article>`;
      }).join('');
      syncAbearcMapLayoutActiveSummary();
    }

    async function loadAbearcMapLayouts(force = false) {
      if (abearcMapLayoutsLoading) return abearcMapLayouts;
      abearcMapLayoutsLoading = true;
      abearcMapLayoutsLoadError = '';
      try {
        renderAbearcMapLayouts();
        const result = await fetchJson(`${API}/map/layouts`, { silentLoading: true, cache: 'no-store', priority: 'high', signal: AbortSignal.timeout(15000) });
        abearcMapLayouts = Array.isArray(result.layouts) ? result.layouts : [];
        return abearcMapLayouts;
      } catch (error) {
        abearcMapLayoutsLoadError = error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'Loading layouts timed out. Please retry.'
          : error.message || 'Unable to load map layouts.';
        toast(abearcMapLayoutsLoadError, 'error');
        return [];
      } finally {
        abearcMapLayoutsLoading = false;
        renderAbearcMapLayouts();
      }
    }

    function closeAbearcMapLayoutMenus() {
      document.querySelectorAll('.abearc-map-layout-card-menu[open]').forEach(menu => menu.removeAttribute('open'));
    }

    function openAbearcMapLayoutMenu(event, id, toggle = false) {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.querySelector(`[data-map-layout-id="${Number(id)}"] details`);
      if (!menu) return;
      const wasOpen = menu.open;
      closeAbearcMapLayoutMenus();
      if (toggle && wasOpen) return;
      menu.open = true;
      const popover = menu.querySelector('.abearc-map-layout-card-menu-popover');
      const anchor = menu.querySelector('summary').getBoundingClientRect();
      const rect = popover.getBoundingClientRect();
      const x = event.type === 'contextmenu' ? event.clientX : anchor.right;
      const y = event.type === 'contextmenu' ? event.clientY : anchor.bottom;
      popover.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
      popover.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    }

    function toggleAbearcMapLayoutsDrawer(forceOpen = null) {
      const drawer = document.querySelector('[data-map-layouts-panel]');
      const button = document.querySelector('[data-map-layouts-toolbar]');
      const resultsPanel = document.querySelector('[data-map-results-panel]');
      if (!drawer || !button) return;
      const open = forceOpen == null ? drawer.classList.contains('hidden') : Boolean(forceOpen);
      if (open) {
        window.toggleWeatherStationsDrawer?.(false);
        window.toggleAbearcRamPumpDrawer?.(false);
        window.toggleAbearcOrthomosaicDrawer?.(false);
        toggleAbearcMapLayerMenu(false);
        toggleAbearcQuickLayers(false);
      }
      drawer.classList.toggle('hidden', !open);
      if (open) resultsPanel?.classList.add('hidden');
      button.classList.toggle('is-active', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-pressed', String(open));
      syncAbearcMapRail();
      if (open) loadAbearcMapLayouts(true);
      else {
        closeAbearcMapLayoutMenus();
        cancelAbearcMapLayoutNameEditor();
      }
      animateAbearcMapResize();
    }

    function beginAbearcMapLayoutSave() {
      const form = document.getElementById('abearcMapLayoutNameForm');
      if (!form) return;
      form.classList.remove('hidden');
      form.querySelector('[data-map-layout-edit-id]').value = '';
      form.querySelector('[data-map-layout-name-form-label]').textContent = 'Layout name';
      form.querySelector('[data-map-layout-name-submit]').textContent = 'Save as new layout';
      const input = form.querySelector('[data-map-layout-name-input]');
      input.value = '';
      requestAnimationFrame(() => input.focus());
    }

    function beginAbearcMapLayoutRename(id) {
      const layout = abearcMapLayouts.find(item => Number(item.id) === Number(id));
      const form = document.getElementById('abearcMapLayoutNameForm');
      if (!layout || !form) return;
      form.classList.remove('hidden');
      form.querySelector('[data-map-layout-edit-id]').value = String(layout.id);
      form.querySelector('[data-map-layout-name-form-label]').textContent = 'Rename layout';
      form.querySelector('[data-map-layout-name-submit]').textContent = 'Rename';
      const input = form.querySelector('[data-map-layout-name-input]');
      input.value = layout.name || '';
      requestAnimationFrame(() => { input.focus(); input.select(); });
    }

    function cancelAbearcMapLayoutNameEditor() {
      const form = document.getElementById('abearcMapLayoutNameForm');
      if (!form) return;
      form.classList.add('hidden');
      form.reset();
      form.querySelector('[data-map-layout-edit-id]').value = '';
    }

    async function saveAbearcMapLayoutName(event) {
      event?.preventDefault?.();
      const form = document.getElementById('abearcMapLayoutNameForm');
      const id = Number(form?.querySelector('[data-map-layout-edit-id]')?.value || 0);
      const name = String(form?.querySelector('[data-map-layout-name-input]')?.value || '').trim();
      if (!name) return;
      try {
        if (id) {
          const updated = await fetchJson(`${API}/map/layouts/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), silentLoading: true
          });
          if (Number(abearcMapActiveLayoutId) === id) {
            abearcMapActiveLayoutRecord = { ...(abearcMapActiveLayoutRecord || {}), ...updated, name };
          }
          toast('Map layout renamed.');
        } else {
          const state = captureAbearcMapLayoutState();
          const created = await fetchJson(`${API}/map/layouts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, state_version: ABEARC_MAP_LAYOUT_STATE_VERSION, state }), silentLoading: true
          });
          abearcMapActiveLayoutId = Number(created.id);
          abearcMapActiveLayoutRecord = created;
          abearcMapActiveLayoutState = state;
          toast('Current map saved to My Map Layouts.');
        }
        cancelAbearcMapLayoutNameEditor();
        await loadAbearcMapLayouts(true);
      } catch (error) {
        toast(error.message || 'Unable to save the map layout.', 'error');
      }
    }

    function applyAbearcMapLayoutFilterState(filters = {}) {
      abearcMapCommittedFilters = { ...filters };
      const values = {
        mapSearchInput: filters.search || '',
        mapCategoryFilter: filters.category || '',
        mapDistrictFilter: filters.district || '',
        mapBarangayFilter: filters.barangay || '',
        mapLocationStatusFilter: filters.locationStatus || ''
      };
      Object.entries(values).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value; });
      const mine = document.getElementById('mapMyUploadsOnly'); if (mine) mine.checked = Boolean(filters.myUploadsOnly);
      const unlinked = document.getElementById('mapUnlinkedOnly'); if (unlinked) unlinked.checked = Boolean(filters.unlinkedOnly);
      abearcMapCommittedSearch = String(filters.search || '');
      abearcMapLastSearchFitKey = '';
      abearcMapFitAllRequested = false;
    }

    async function abearcMapLayoutWaitForStyle() {
      if (!abearcMap || abearcMap.isStyleLoaded()) return;
      await new Promise(resolve => {
        let timeout = setTimeout(resolve, 8000);
        abearcMap.once('style.load', () => { clearTimeout(timeout); resolve(); });
      });
    }

    async function restoreAbearcMapLayoutState(state = {}, frozenPhotoFeatures = null) {
      if (!state || typeof state !== 'object') throw new Error('This saved map layout is invalid.');
      rememberAbearcMapLayoutChange();
      abearcMapLayoutRestoring = true;
      try {
        await ensureAbearcMap();
        const layers = state.layers || {};
        const photos = state.photos || {};
        const filters = photos.filters || {};
        const nextBasemap = ['google-satellite', 'google-terrain', 'open-topo'].includes(layers.basemap) ? layers.basemap : 'google-satellite';
        const nextZoning = Boolean(layers.zoningEnabled);
        const styleChanged = nextBasemap !== abearcMapBasemap || nextZoning !== abearcZoningEnabled;

        abearcMapBasemap = nextBasemap;
        abearcZoningEnabled = nextZoning;
        abearcMapLayerLabels = { ...abearcMapLayerLabels, ...(layers.layerLabels || {}) };
        abearcMapPhotosVisible = layers.photosVisible !== false;
        abearcDavaoBoundaryVisible = layers.davaoBoundaryVisible !== false;
        localStorage.setItem('abearcMapBasemap', abearcMapBasemap);
        localStorage.setItem('abearcMapZoningEnabled', String(abearcZoningEnabled));
        localStorage.setItem('abearcMapLayerLabels', JSON.stringify(abearcMapLayerLabels));
        localStorage.setItem('abearcMapPhotosVisible', String(abearcMapPhotosVisible));
        localStorage.setItem('abearcMapDavaoBoundaryVisible', String(abearcDavaoBoundaryVisible));

        if (styleChanged) {
          abearcMap.setStyle(abearcMapBasemapStyle());
          await abearcMapLayoutWaitForStyle();
        }
        setupAbearcMapLayers();
        syncAbearcMapBasemapControl();
        syncAbearcMapPhotoVisibilityControl();
        syncAbearcDavaoBoundaryControl();
        ['abearc-davao-boundary-fill', 'abearc-davao-boundary-line'].forEach(layerId => {
          if (abearcMap?.getLayer(layerId)) abearcMap.setLayoutProperty(layerId, 'visibility', abearcDavaoBoundaryVisible ? 'visible' : 'none');
        });

        abearcNoahFloodEnabled = false;
        abearcChirpsEnabled = false;
        abearcTerraClimateEnabled = false;
        removeAbearcNoahFloodLayer();
        removeAbearcChirpsLayer();
        removeAbearcTerraClimateLayer();

        abearcNoahFloodOpacity = Math.max(.2, Math.min(.9, Number(layers.noahFlood?.opacity) || .58));
        abearcChirpsStartDate = String(layers.chirps?.start || '');
        abearcChirpsEndDate = String(layers.chirps?.end || '');
        abearcChirpsOpacity = Math.max(.2, Math.min(1, Number(layers.chirps?.opacity) || .7));
        abearcTerraClimateStartDate = String(layers.terraClimate?.start || '');
        abearcTerraClimateEndDate = String(layers.terraClimate?.end || '');
        abearcTerraClimateOpacity = Math.max(.2, Math.min(1, Number(layers.terraClimate?.opacity) || .7));
        localStorage.setItem('abearcMapNoahFloodOpacity', String(abearcNoahFloodOpacity));

        if (layers.noahFlood?.enabled) {
          abearcNoahFloodEnabled = true;
          localStorage.setItem('abearcMapNoahFloodEnabled', 'true');
          setupAbearcNoahFloodLayer();
        } else {
          localStorage.setItem('abearcMapNoahFloodEnabled', 'false');
          if (layers.chirps?.enabled) {
            abearcChirpsEnabled = true;
            const start = document.getElementById('abearcChirpsStartDate'); if (start) start.value = abearcChirpsStartDate;
            const end = document.getElementById('abearcChirpsEndDate'); if (end) end.value = abearcChirpsEndDate;
            if (!abearcMapRestoringView) {
              await loadAbearcChirpsConfig();
              await prepareAbearcChirpsDataset({ silent: true });
            } else setupAbearcChirpsLayer();
          } else if (layers.terraClimate?.enabled) {
            abearcTerraClimateEnabled = true;
            const start = document.getElementById('abearcTerraClimateStartDate'); if (start) start.value = abearcTerraClimateStartDate;
            const end = document.getElementById('abearcTerraClimateEndDate'); if (end) end.value = abearcTerraClimateEndDate;
            if (!abearcMapRestoringView) {
              await loadAbearcTerraClimateConfig();
              await prepareAbearcTerraClimateDataset({ silent: true });
            } else setupAbearcTerraClimateLayer();
          }
        }
        saveAbearcChirpsState();
        saveAbearcTerraClimateState();
        syncAbearcChirpsControls();
        syncAbearcTerraClimateControls();
        syncAbearcNoahFloodControls();
        window.setAbearcWeatherStationsVisible?.(layers.weatherStations?.enabled !== false, { persist: true, reload: true });
        window.setWeatherLabelMode?.(layers.weatherStations?.labelMode || 'status');

        applyAbearcMapLayoutFilterState(filters);
        abearcMapPhotoScope = ['all', 'saved', 'mine'].includes(photos.scope) ? photos.scope : 'all';
        localStorage.setItem('abearcMapPhotoScope', abearcMapPhotoScope);
        abearcMapLayoutFrozenPhotoIds = new Set((Array.isArray(photos.frozenPhotoIds) ? photos.frozenPhotoIds : []).map(Number).filter(Number.isFinite));
        abearcMapSessionHiddenPhotoIds.clear();
        (Array.isArray(photos.hiddenPhotoIds) ? photos.hiddenPhotoIds : []).map(Number).filter(Number.isFinite).forEach(id => abearcMapSessionHiddenPhotoIds.add(id));
        finishAbearcMapThumbnailMoveMode();
        abearcMapMovedPhotoPositions.clear();
        Object.entries(photos.movedPhotos || {}).forEach(([id, position]) => {
          if (Array.isArray(position) && position.length >= 2 && position.every(value => Number.isFinite(Number(value)))) {
            abearcMapMovedPhotoPositions.set(Number(id), [Number(position[0]), Number(position[1])]);
          }
        });
        abearcMapMovedPhotoSizes.clear();
        Object.entries(photos.movedPhotoSizes || {}).forEach(([id, size]) => {
          const mapWidth = Number(size?.mapWidth);
          const mapHeight = Number(size?.mapHeight);
          if (mapWidth > 0 && mapHeight > 0) abearcMapMovedPhotoSizes.set(Number(id), { mapWidth, mapHeight });
        });
        abearcMapExpandedPhotos.clear();
        abearcMapPhotoAnnotations.clear();
        (Array.isArray(photos.annotations) ? photos.annotations : []).forEach(entry => {
          const id = Number(entry?.[0]), annotation = entry?.[1];
          if (!Number.isInteger(id) || id <= 0 || !annotation || typeof annotation.text !== 'string') return;
          const text = annotation.text.trim().slice(0, 80);
          if (text) abearcMapPhotoAnnotations.set(id, {
            text,
            mapDx: Number.isFinite(Number(annotation.mapDx)) ? Number(annotation.mapDx) : 22,
            mapDy: Number.isFinite(Number(annotation.mapDy)) ? Number(annotation.mapDy) : -42
          });
        });
        Object.entries(photos.expandedPhotos || {}).forEach(([id, size]) => {
          const width = Math.max(96, Math.min(720, Number(size?.width) || 260));
          const height = Math.max(1, Number(size?.height) || 180);
          const aspectRatio = Number(size?.aspectRatio) > 0 ? Number(size.aspectRatio) : width / height;
          const mapWidth = Number(size?.mapWidth);
          abearcMapExpandedPhotos.set(Number(id), { width, height, aspectRatio, ...(mapWidth > 0 ? { mapWidth } : {}) });
        });
        collapseAbearcMapExplosion({ animate: false });
        applyAbearcMapMeasureState(state.measurements || {});
        restoreAbearcMapLayoutAnalysisState(state.measurements?.layoutAnalysis || {});
        window.restoreAbearcRamPumpState?.(state.ramPump || null, { skipRender: true });

        const camera = state.camera || {};
        if (Array.isArray(camera.center) && camera.center.length >= 2 && camera.center.every(value => Number.isFinite(Number(value)))) {
          abearcMap.jumpTo({
            center: [Number(camera.center[0]), Number(camera.center[1])],
            zoom: Number.isFinite(Number(camera.zoom)) ? Number(camera.zoom) : abearcMap.getZoom(),
            bearing: Number.isFinite(Number(camera.bearing)) ? Number(camera.bearing) : 0,
            pitch: Number.isFinite(Number(camera.pitch)) ? Number(camera.pitch) : 0
          });
        }

        if (Array.isArray(frozenPhotoFeatures)) {
          abearcMapFeatures = frozenPhotoFeatures.filter(feature => feature?.type === 'Feature');
          const photoSource = abearcMap?.getSource('abearc-map-media');
          photoSource?.setData({ type: 'FeatureCollection', features: abearcMapScopedFeatures() });
          scheduleAbearcMapMarkerRender();
          renderAbearcMapList();
          setAbearcMapSyncState(`${abearcMapVisibleListFeatures().length.toLocaleString()} in view`, 'ready');
        } else {
          await reloadAbearcMap();
        }
        syncAbearcMapAdministrativeBoundary();
        renderAbearcMapPhotoMarkers();
        renderAbearcMapMovedPhotoLeaders();
        renderAbearcMapMeasure();
        window.renderAbearcRamPumpOverlay?.();
        syncAbearcMapRail();
        const orthomosaicResult = state.orthomosaics && window.restoreAbearcOrthomosaicLayoutState
          ? await window.restoreAbearcOrthomosaicLayoutState(state.orthomosaics)
          : { missingIds: [] };
        const availablePhotoIds = new Set(abearcMapFeatures.map(feature => Number(abearcFeatureId(feature))));
        const missingPhotoIds = [...abearcMapLayoutFrozenPhotoIds].filter(id => !availablePhotoIds.has(id));
        return { missingPhotoIds, missingOrthomosaicIds: orthomosaicResult?.missingIds || [] };
      } finally {
        abearcMapLayoutRestoring = false;
      }
    }

    async function openAbearcMapLayout(id) {
      try {
        if (abearcMapLayoutHasUnsavedChanges()) {
          const proceed = await confirmModalChoice(`
            <span>The open layout has unsaved changes.</span>
            <span class="abearc-map-layout-switch-options" role="radiogroup" aria-label="Handle unsaved layout changes">
              <label><input type="radio" name="map-layout-switch" value="save" checked><span>Save changes before opening the layout</span></label>
              <label><input type="radio" name="map-layout-switch" value="discard"><span>Discard changes and open the layout</span></label>
            </span>
          `, { title: 'Unsaved layout changes', confirmText: 'Continue' });
          if (!proceed) return null;
          if (document.querySelector('input[name="map-layout-switch"]:checked')?.value !== 'discard') {
            if (!await updateAbearcMapLayout(abearcMapActiveLayoutId)) return null;
          }
        }
        const layout = await fetchJson(`${API}/map/layouts/${Number(id)}`, { silentLoading: true, cache: 'no-store' });
        const missing = await restoreAbearcMapLayoutState(layout.state, Array.isArray(layout.photo_features) ? layout.photo_features : null);
        abearcMapActiveLayoutId = Number(layout.id);
        abearcMapActiveLayoutRecord = layout;
        abearcMapActiveLayoutState = captureAbearcMapLayoutState();
        renderAbearcMapLayouts();
        const missingCount = missing.missingPhotoIds.length + missing.missingOrthomosaicIds.length;
        toast(missingCount
          ? `Map layout opened. ${missingCount} referenced item${missingCount === 1 ? '' : 's'} are no longer available.`
          : `Map layout opened: ${layout.name}`);
        return layout;
      } catch (error) {
        toast(error.message || 'Unable to open this map layout.', 'error');
        return null;
      }
    }

    async function updateAbearcMapLayout(id) {
      try {
        const state = captureAbearcMapLayoutState();
        const updated = await fetchJson(`${API}/map/layouts/${Number(id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state_version: ABEARC_MAP_LAYOUT_STATE_VERSION, state }), silentLoading: true
        });
        if (Number(id) === Number(abearcMapActiveLayoutId)) {
          abearcMapActiveLayoutRecord = { ...(abearcMapActiveLayoutRecord || {}), ...updated };
          abearcMapActiveLayoutState = state;
        }
        await loadAbearcMapLayouts(true);
        toast('Map layout updated with the current map.');
        return true;
      } catch (error) { toast(error.message || 'Unable to update the map layout.', 'error'); return false; }
    }

    function updateActiveAbearcMapLayout() {
      if (!abearcMapActiveLayoutId) return toast('Open a saved map layout first.', 'error');
      return updateAbearcMapLayout(abearcMapActiveLayoutId);
    }

    async function duplicateAbearcMapLayout(id) {
      try {
        const source = await fetchJson(`${API}/map/layouts/${Number(id)}`, { silentLoading: true });
        await fetchJson(`${API}/map/layouts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${source.name} - Copy`.slice(0, 160), description: source.description || '', state_version: source.state_version || 1, state: source.state }), silentLoading: true
        });
        await loadAbearcMapLayouts(true);
        toast('Map layout duplicated.');
      } catch (error) { toast(error.message || 'Unable to duplicate the map layout.', 'error'); }
    }

    async function deleteAbearcMapLayout(id) {
      const layout = abearcMapLayouts.find(item => Number(item.id) === Number(id));
      if (!layout) return;
      const confirmed = await confirmModalChoice(`Delete the saved map layout “${layout.name}”? This does not delete any geotag photos, orthomaps, or map data.`, { title: 'Delete Map Layout', confirmText: 'Delete' });
      if (!confirmed) return;
      try {
        await fetchJson(`${API}/map/layouts/${Number(id)}`, { method: 'DELETE', silentLoading: true });
        if (Number(abearcMapActiveLayoutId) === Number(id)) {
          abearcMapActiveLayoutId = null; abearcMapActiveLayoutRecord = null; abearcMapActiveLayoutState = null;
        }
        await loadAbearcMapLayouts(true);
        toast('Map layout deleted.');
      } catch (error) { toast(error.message || 'Unable to delete the map layout.', 'error'); }
    }

    async function exportAbearcMapLayout(id) {
      try {
        const layout = await fetchJson(`${API}/map/layouts/${Number(id)}`, { silentLoading: true });
        const payload = { format: ABEARC_MAP_LAYOUT_FILE_FORMAT, format_version: 1, exported_at: new Date().toISOString(),
          layout: { name: layout.name, description: layout.description || '', state_version: layout.state_version || 1, state: layout.state } };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${String(layout.name || 'Map layout').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100)}.abmap`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { toast(error.message || 'Unable to export the map layout.', 'error'); }
    }

    async function importAbearcMapLayout(event) {
      const input = event?.target;
      const file = input?.files?.[0];
      if (input) input.value = '';
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('The layout file is too large.');
        const payload = JSON.parse(await file.text());
        if (payload?.format !== ABEARC_MAP_LAYOUT_FILE_FORMAT || !payload?.layout?.state || typeof payload.layout.state !== 'object') {
          throw new Error('This is not a valid ABEARC .abmap layout file.');
        }
        const name = String(payload.layout.name || file.name.replace(/\.abmap$/i, '') || 'Imported map layout').slice(0, 160);
        await fetchJson(`${API}/map/layouts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: payload.layout.description || '', state_version: payload.layout.state_version || 1, state: payload.layout.state }), silentLoading: true
        });
        await loadAbearcMapLayouts(true);
        toast('Map layout imported.');
      } catch (error) { toast(error.message || 'Unable to import this map layout.', 'error'); }
    }

    document.addEventListener('click', event => {
      if (!event.target.closest('.abearc-map-layout-card-menu')) closeAbearcMapLayoutMenus();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAbearcMapLayoutMenus(); });
    // Only compare the layout while its panel is visible; do not rerender menus.
    setInterval(() => {
      if (!document.getElementById('mapPage')?.classList.contains('hidden')
          && !document.querySelector('[data-map-layouts-panel]')?.classList.contains('hidden')) syncAbearcMapLayoutActiveSummary();
    }, 800);
    const layoutList = document.querySelector('[data-map-layout-list]');
    if (layoutList) new ResizeObserver(() => {
      if (!layoutList.clientHeight) return;
      const size = Math.max(1, Math.floor(layoutList.clientHeight / 72));
      if (size !== abearcMapLayoutPageSize) renderAbearcMapLayouts();
    }).observe(layoutList);

    Object.assign(window, {
      toggleAbearcMapLayoutsDrawer,
      loadAbearcMapLayouts,
      beginAbearcMapLayoutSave,
      beginAbearcMapLayoutRename,
      cancelAbearcMapLayoutNameEditor,
      saveAbearcMapLayoutName,
      captureAbearcMapLayoutState,
      openAbearcMapLayout,
      updateAbearcMapLayout,
      updateActiveAbearcMapLayout,
      duplicateAbearcMapLayout,
      deleteAbearcMapLayout,
      importAbearcMapLayout,
      exportAbearcMapLayout,
      openAbearcMapLayoutMenu,
      changeAbearcMapLayoutPage,
      toggleAbearcMapLayoutSort,
      closeAbearcMapLayoutMenus,
      renderAbearcMapLayouts
    });
