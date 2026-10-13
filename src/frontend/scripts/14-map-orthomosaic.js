    let abearcOrthomosaics = [];
    let abearcOrthomosaicCanManage = false;
    let abearcOrthomosaicLoadPromise = null;
    let abearcOrthomosaicPollTimer = null;
    let abearcOrthomosaicStageToken = '';
    const abearcOrthomosaicEnabledIds = new Set();
    const abearcOrthomosaicOpacity = {};
    let abearcOrthomosaicVisibilityCustomized = false;
    let abearcOrthomosaicPreferenceOwner = null;
    let abearcOrthomosaicSelectedId = null;
    let abearcOrthomosaicContextId = null;
    let abearcOrthomosaicSelectedSeriesKey = '';
    const abearcOrthomosaicExpandedSeries = new Set();
    let abearcOrthomosaicSeriesMode = 'single';
    let abearcOrthomosaicTimelineIndex = -1;
    let abearcOrthomosaicPlaybackTimer = null;
    let abearcOrthomosaicPlaybackSpeed = 2000;
    let abearcOrthomosaicCompareBeforeId = null;
    let abearcOrthomosaicCompareAfterId = null;
    let abearcOrthomosaicCompareBlend = 50;

    function abearcOrthomosaicHasAccess() {
      return Boolean(currentUser);
    }

    function abearcOrthomosaicPreferenceKey(base) {
      return abearcMapAnalysis.userStorageKey(base, currentUser?.id);
    }

    function abearcOrthomosaicPreferenceValue(base) {
      return abearcMapAnalysis.userStorageValue(localStorage, base, currentUser?.id);
    }

    function loadAbearcOrthomosaicPreferences() {
      const owner = String(currentUser?.id || 'default');
      if (abearcOrthomosaicPreferenceOwner === owner) return;
      abearcOrthomosaicPreferenceOwner = owner;
      abearcOrthomosaicEnabledIds.clear();
      Object.keys(abearcOrthomosaicOpacity).forEach(key => delete abearcOrthomosaicOpacity[key]);
      try {
        const ids = JSON.parse(abearcOrthomosaicPreferenceValue('abearcOrthomosaicEnabledIds') || '[]');
        if (Array.isArray(ids)) ids.map(Number).filter(Number.isFinite).forEach(id => abearcOrthomosaicEnabledIds.add(id));
      } catch (_) {}
      try {
        const opacity = JSON.parse(abearcOrthomosaicPreferenceValue('abearcOrthomosaicOpacity') || '{}');
        if (opacity && typeof opacity === 'object') Object.assign(abearcOrthomosaicOpacity, opacity);
      } catch (_) {}
      abearcOrthomosaicVisibilityCustomized = abearcOrthomosaicPreferenceValue('abearcOrthomosaicVisibilityCustomized') === 'true';
    }

    function abearcOrthomosaicActiveCount() {
      return abearcOrthomosaics.filter(item => item.is_active && item.processing_status === 'ready' && abearcOrthomosaicEnabledIds.has(Number(item.id))).length;
    }

    function saveAbearcOrthomosaicPreferences() {
      loadAbearcOrthomosaicPreferences();
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicEnabledIds'), JSON.stringify([...abearcOrthomosaicEnabledIds]));
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicOpacity'), JSON.stringify(abearcOrthomosaicOpacity));
    }

    function formatAbearcOrthomosaicDate(value) {
      if (!value) return 'Date not set';
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
      return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : String(value);
    }

    function formatAbearcOrthomosaicBytes(value) {
      const bytes = Number(value || 0);
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
      return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    }

    function formatAbearcOrthomosaicArea(value) {
      const hectares = Number(value);
      return hectares > 0
        ? `Area: ${hectares.toLocaleString('en-PH', { maximumFractionDigits: 2 })} ha`
        : 'Area pending';
    }

    function abearcOrthomosaicTimestamp(item) {
      const value = item?.orthomosaic_date || item?.survey_date || item?.uploaded_at || item?.created_at || '';
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) ? timestamp : Number(item?.id || 0);
    }

    function abearcOrthomosaicBoundsOverlap(first, second) {
      if (!Array.isArray(first) || !Array.isArray(second) || first.length !== 4 || second.length !== 4) return false;
      const widthA = Math.max(0, Number(first[2]) - Number(first[0]));
      const heightA = Math.max(0, Number(first[3]) - Number(first[1]));
      const widthB = Math.max(0, Number(second[2]) - Number(second[0]));
      const heightB = Math.max(0, Number(second[3]) - Number(second[1]));
      const areaA = widthA * heightA;
      const areaB = widthB * heightB;
      if (!areaA || !areaB) return false;
      const intersectionWidth = Math.max(0, Math.min(Number(first[2]), Number(second[2])) - Math.max(Number(first[0]), Number(second[0])));
      const intersectionHeight = Math.max(0, Math.min(Number(first[3]), Number(second[3])) - Math.max(Number(first[1]), Number(second[1])));
      const intersection = intersectionWidth * intersectionHeight;
      const areaRatio = Math.min(areaA, areaB) / Math.max(areaA, areaB);
      return areaRatio >= 0.5 && intersection / Math.max(areaA, areaB) >= 0.55;
    }

    function abearcOrthomosaicSeries() {
      const groups = [];
      [...abearcOrthomosaics]
        .sort((a, b) => abearcOrthomosaicTimestamp(b) - abearcOrthomosaicTimestamp(a) || Number(b.id) - Number(a.id))
        .forEach(item => {
          const group = Array.isArray(item.bounds)
            ? groups.find(candidate => candidate.items.some(existing => abearcOrthomosaicBoundsOverlap(item.bounds, existing.bounds)))
            : null;
          if (group) group.items.push(item);
          else groups.push({ items: [item] });
        });
      return groups.map(group => {
        group.items.sort((a, b) => abearcOrthomosaicTimestamp(a) - abearcOrthomosaicTimestamp(b) || Number(a.id) - Number(b.id));
        group.key = `series-${Math.min(...group.items.map(item => Number(item.id)))}`;
        group.latest = group.items.at(-1);
        group.playable = group.items.filter(item => item.is_active && item.processing_status === 'ready' && Array.isArray(item.bounds));
        return group;
      }).sort((a, b) => abearcOrthomosaicTimestamp(b.latest) - abearcOrthomosaicTimestamp(a.latest));
    }

    function abearcOrthomosaicSeriesByKey(key) {
      return abearcOrthomosaicSeries().find(group => group.key === String(key));
    }

    function abearcOrthomosaicSeriesForId(id) {
      return abearcOrthomosaicSeries().find(group => group.items.some(item => Number(item.id) === Number(id)));
    }

    function abearcOrthomosaicDefaultVisibleItems() {
      return abearcOrthomosaicSeries().map(group => group.playable.at(-1)).filter(Boolean);
    }

    function normalizeAbearcOrthomosaicSeriesVisibility() {
      abearcOrthomosaicSeries().forEach(group => {
        const enabled = group.playable.filter(item => abearcOrthomosaicEnabledIds.has(Number(item.id)));
        if (enabled.length < 2) return;
        const keep = enabled.at(-1);
        enabled.forEach(item => {
          if (Number(item.id) !== Number(keep.id)) abearcOrthomosaicEnabledIds.delete(Number(item.id));
        });
      });
    }

    function abearcOrthomosaicEffectiveOpacity(id) {
      const numericId = Number(id);
      if (abearcOrthomosaicSeriesMode === 'compare' && abearcOrthomosaicSelectedSeriesKey) {
        if (numericId === Number(abearcOrthomosaicCompareBeforeId)) return 1;
        if (numericId === Number(abearcOrthomosaicCompareAfterId)) return Math.max(0, Math.min(1, abearcOrthomosaicCompareBlend / 100));
      }
      return Math.max(0, Math.min(1, Number(abearcOrthomosaicOpacity[numericId] ?? 1)));
    }

    function abearcOrthomosaicLayerId(id) { return `abearc-orthomosaic-${Number(id)}`; }
    function abearcOrthomosaicSourceId(id) { return `${abearcOrthomosaicLayerId(id)}-source`; }

    function abearcOrthomosaicThumbnailUrl(item) {
      if (!item?.is_active || item.processing_status !== 'ready') return '';
      const params = new URLSearchParams({ token: authToken || '', v: item.updated_at || '' });
      return `${API}/map/orthomosaics/${Number(item.id)}/thumbnail.png?${params}`;
    }

    function removeAbearcOrthomosaicLayer(id) {
      if (!abearcMap) return;
      const layerId = abearcOrthomosaicLayerId(id);
      const sourceId = abearcOrthomosaicSourceId(id);
      if (abearcMap.getLayer(layerId)) abearcMap.removeLayer(layerId);
      if (abearcMap.getSource(sourceId)) abearcMap.removeSource(sourceId);
    }

    function syncAbearcOrthomosaicVisibilityToggle() {
      const button = document.querySelector('[data-map-orthomosaic-visibility-toggle]');
      if (!button) return;
      const eligible = abearcOrthomosaicDefaultVisibleItems();
      const allVisible = eligible.length > 0 && eligible.every(item => abearcOrthomosaicEnabledIds.has(Number(item.id)));
      const label = allVisible ? 'Hide all orthomaps' : 'Show all orthomaps';
      button.disabled = eligible.length === 0;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(allVisible));
      button.title = label;
      button.querySelector('[data-orthomosaic-show-all]')?.classList.toggle('hidden', !allVisible);
      button.querySelector('[data-orthomosaic-hide-all]')?.classList.toggle('hidden', allVisible);
    }

    function toggleAllAbearcOrthomosaics() {
      rememberAbearcMapLayoutChange();
      const eligible = abearcOrthomosaicDefaultVisibleItems();
      const show = !eligible.every(item => abearcOrthomosaicEnabledIds.has(Number(item.id)));
      stopAbearcOrthomosaicPlayback();
      abearcOrthomosaicVisibilityCustomized = true;
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicVisibilityCustomized'), 'true');
      abearcOrthomosaicSeries().forEach(group => {
        group.playable.forEach(item => {
          const id = Number(item.id);
          abearcOrthomosaicEnabledIds.delete(id);
          removeAbearcOrthomosaicLayer(id);
        });
      });
      if (show) eligible.forEach(item => abearcOrthomosaicEnabledIds.add(Number(item.id)));
      saveAbearcOrthomosaicPreferences();
      renderAbearcOrthomosaics();
    }

    function setupAbearcOrthomosaicLayers() {
      if (!abearcMap || (typeof abearcMap.isStyleLoaded === 'function' && !abearcMap.isStyleLoaded())) return;
      const ready = new Map(abearcOrthomosaics
        .filter(item => item.is_active && item.processing_status === 'ready' && Array.isArray(item.bounds))
        .map(item => [Number(item.id), item]));
      const desired = new Set([...abearcOrthomosaicEnabledIds].filter(id => ready.has(Number(id))).map(Number));
      const layers = abearcMap.getStyle()?.layers || [];
      layers.filter(layer => /^abearc-orthomosaic-\d+$/.test(layer.id)).forEach(layer => {
        const id = Number(layer.id.split('-').at(-1));
        if (!desired.has(id)) removeAbearcOrthomosaicLayer(id);
      });
      ready.forEach((item, id) => {
        if (!desired.has(id)) return;
        const sourceId = abearcOrthomosaicSourceId(id);
        const layerId = abearcOrthomosaicLayerId(id);
        if (!abearcMap.getSource(sourceId)) {
          const params = new URLSearchParams({ token: authToken || '', v: item.updated_at || '' });
          abearcMap.addSource(sourceId, {
            type: 'raster',
            tiles: [`${API}/map/orthomosaics/${id}/tiles/{z}/{x}/{y}.png?${params}`],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 22,
            bounds: item.bounds,
            attribution: `Drone orthomosaic: ${item.name}`
          });
        }
        if (!abearcMap.getLayer(layerId)) {
          const beforeId = abearcMap.getLayer('abearc-zoning')
            ? 'abearc-zoning'
            : abearcMap.getLayer('abearc-noah-flood-100yr')
            ? 'abearc-noah-flood-100yr'
            : (abearcMap.getLayer('abearc-davao-boundary-fill') ? 'abearc-davao-boundary-fill' : undefined);
          abearcMap.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': abearcOrthomosaicEffectiveOpacity(id), 'raster-fade-duration': 180 }
          }, beforeId);
        }
        abearcMap.setPaintProperty(layerId, 'raster-opacity', abearcOrthomosaicEffectiveOpacity(id));
        if (abearcMap.getLayer('abearc-zoning')) abearcMap.moveLayer(layerId, 'abearc-zoning');
      });
      if (abearcOrthomosaicSeriesMode === 'compare') {
        const beforeLayer = abearcOrthomosaicLayerId(abearcOrthomosaicCompareBeforeId);
        const afterLayer = abearcOrthomosaicLayerId(abearcOrthomosaicCompareAfterId);
        const overlayLayer = abearcMap.getLayer('abearc-zoning') ? 'abearc-zoning' : undefined;
        if (abearcMap.getLayer(beforeLayer)) abearcMap.moveLayer(beforeLayer, overlayLayer);
        if (abearcMap.getLayer(afterLayer)) abearcMap.moveLayer(afterLayer, overlayLayer);
      }
    }

    function abearcOrthomosaicStatusLabel(item) {
      if (item.processing_status === 'processing') return 'Processing';
      if (item.processing_status === 'failed') return 'Failed';
      return item.is_active ? 'Ready' : 'Inactive';
    }

    function renderAbearcOrthomosaicCapture(item, child = false) {
      const id = Number(item.id);
      const ready = item.processing_status === 'ready';
      const enabled = ready && item.is_active && abearcOrthomosaicEnabledIds.has(id);
      const thumbnailUrl = abearcOrthomosaicThumbnailUrl(item);
      return `<article data-orthomosaic-id="${id}" class="abearc-map-orthomosaic-item abearc-map-list-item${child ? ' is-series-capture' : ''}${enabled ? ' is-enabled' : ''}${id === Number(abearcOrthomosaicSelectedId) ? ' is-selected' : ''}" oncontextmenu="openAbearcOrthomosaicContextMenu(event, ${id})">
        <button type="button" class="abearc-map-list-open" ${Array.isArray(item.bounds) ? `onclick="selectAbearcOrthomosaicCapture(${id}, true)"` : 'disabled'}>
          <span class="abearc-map-list-thumb abearc-map-orthomosaic-thumb">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14"/></svg>
            ${thumbnailUrl ? `<img alt="" src="${esc(thumbnailUrl)}" onerror="this.remove()">` : ''}
          </span>
          <span class="abearc-map-list-content">
            <span class="abearc-map-list-title">${esc(item.name)}</span>
            <span class="abearc-map-list-place">${esc(formatAbearcOrthomosaicDate(item.orthomosaic_date || item.survey_date || item.uploaded_at))} · ${esc(abearcOrthomosaicStatusLabel(item))}</span>
            <span class="abearc-map-list-meta">${esc(formatAbearcOrthomosaicArea(item.coverage_area_ha))} · ${esc(formatAbearcOrthomosaicBytes(item.file_size))}</span>
          </span>
        </button>
        <button type="button" data-orthomosaic-menu-id="${id}" class="abearc-map-list-edit" title="More actions" aria-label="More actions" onclick="openAbearcOrthomosaicContextMenu(event, ${id})"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg></button>
      </article>`;
    }

    function renderAbearcOrthomosaicSeries(group) {
      if (group.items.length === 1) return renderAbearcOrthomosaicCapture(group.items[0]);
      const expanded = abearcOrthomosaicExpandedSeries.has(group.key);
      const selected = group.key === abearcOrthomosaicSelectedSeriesKey;
      const enabled = group.playable.some(item => abearcOrthomosaicEnabledIds.has(Number(item.id)));
      const first = group.items[0];
      const latest = group.latest;
      const thumbnailUrl = abearcOrthomosaicThumbnailUrl(latest);
      const range = `${formatAbearcOrthomosaicDate(first.orthomosaic_date || first.survey_date || first.uploaded_at)}–${formatAbearcOrthomosaicDate(latest.orthomosaic_date || latest.survey_date || latest.uploaded_at)}`;
      return `<section data-orthomosaic-series-key="${group.key}" class="abearc-map-orthomosaic-series${expanded ? ' is-expanded' : ''}">
        <article class="abearc-map-orthomosaic-item abearc-map-list-item${enabled ? ' is-enabled' : ''}${selected ? ' is-selected' : ''}">
          <button type="button" class="abearc-map-list-open" onclick="selectAbearcOrthomosaicSeries('${group.key}', true)">
            <span class="abearc-map-list-thumb abearc-map-orthomosaic-thumb">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14"/></svg>
              ${thumbnailUrl ? `<img alt="" src="${esc(thumbnailUrl)}" onerror="this.remove()">` : ''}
            </span>
            <span class="abearc-map-list-content">
              <span class="abearc-map-orthomosaic-series-title"><span class="abearc-map-list-title">${esc(latest.name)}</span><span class="abearc-map-orthomosaic-series-badge" aria-label="${group.items.length} captures">${group.items.length}</span></span>
              <span class="abearc-map-list-place">${group.items.length} captures · Latest ${esc(formatAbearcOrthomosaicDate(latest.orthomosaic_date || latest.survey_date || latest.uploaded_at))}</span>
              <span class="abearc-map-list-meta">${esc(range)}</span>
            </span>
          </button>
          <button type="button" class="abearc-map-orthomosaic-series-toggle" onclick="toggleAbearcOrthomosaicSeries(event, '${group.key}')" aria-label="${expanded ? 'Collapse' : 'Expand'} captures" title="${expanded ? 'Collapse' : 'Expand'} captures" aria-expanded="${expanded}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 7 5 5-5 5"/></svg></button>
        </article>
        <div class="abearc-map-orthomosaic-series-captures${expanded ? ' is-expanded' : ''}"><div class="abearc-map-orthomosaic-series-captures-inner">${[...group.items].reverse().map(item => renderAbearcOrthomosaicCapture(item, true)).join('')}</div></div>
      </section>`;
    }

    function renderAbearcOrthomosaics() {
      const panel = document.querySelector('[data-map-orthomosaic-panel]');
      const list = document.querySelector('[data-map-orthomosaic-list]');
      const upload = document.querySelector('[data-map-orthomosaic-upload]');
      const toolbarButton = document.querySelector('[data-map-orthomosaic-toolbar]');
      const accessible = abearcOrthomosaicHasAccess();
      toolbarButton?.classList.toggle('hidden', !accessible);
      if (!accessible) panel?.classList.add('hidden');
      upload?.classList.toggle('hidden', !abearcOrthomosaicCanManage);
      if (!list || !accessible) return;
      list.innerHTML = abearcOrthomosaics.length ? abearcOrthomosaicSeries().map(renderAbearcOrthomosaicSeries).join('') : '<span class="abearc-map-orthomosaic-empty">No orthomosaic maps available.</span>';
      syncAbearcOrthomosaicSeriesControls();
      syncAbearcOrthomosaicVisibilityToggle();
      setupAbearcOrthomosaicLayers();
      syncAbearcMapLayerCount();
    }

    function closeAbearcOrthomosaicContextMenu() {
      document.querySelector('[data-map-orthomosaic-context-menu]')?.classList.add('hidden');
      abearcOrthomosaicContextId = null;
    }

    function abearcOrthomosaicContextItem() {
      return abearcOrthomosaics.find(item => Number(item.id) === Number(abearcOrthomosaicContextId));
    }

    function selectAbearcOrthomosaic(id) {
      abearcOrthomosaicSelectedId = Number(id);
      const group = abearcOrthomosaicSeriesForId(id);
      if (group?.items.length > 1) {
        abearcOrthomosaicSelectedSeriesKey = group.key;
        abearcOrthomosaicExpandedSeries.add(group.key);
        const index = group.playable.findIndex(item => Number(item.id) === Number(id));
        if (index >= 0) abearcOrthomosaicTimelineIndex = index;
      }
      document.querySelectorAll('[data-orthomosaic-id]').forEach(item => {
        item.classList.toggle('is-selected', Number(item.dataset.orthomosaicId) === abearcOrthomosaicSelectedId);
      });
      document.querySelectorAll('[data-orthomosaic-series-key]').forEach(item => {
        item.querySelector(':scope > .abearc-map-list-item')?.classList.toggle('is-selected', item.dataset.orthomosaicSeriesKey === abearcOrthomosaicSelectedSeriesKey);
      });
      syncAbearcOrthomosaicSeriesControls();
    }

    function stopAbearcOrthomosaicPlayback() {
      clearInterval(abearcOrthomosaicPlaybackTimer);
      abearcOrthomosaicPlaybackTimer = null;
      const button = document.querySelector('[data-orthomosaic-play]');
      button?.setAttribute('aria-label', 'Play time series');
      button?.setAttribute('title', 'Play time series');
      button?.querySelector('[data-orthomosaic-play-icon]')?.classList.remove('hidden');
      button?.querySelector('[data-orthomosaic-pause-icon]')?.classList.add('hidden');
    }

    function abearcOrthomosaicApplySeriesIds(group, ids) {
      if (!group) return;
      const desired = new Set(ids.map(Number));
      abearcOrthomosaicVisibilityCustomized = true;
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicVisibilityCustomized'), 'true');
      group.playable.forEach(item => {
        const id = Number(item.id);
        if (desired.has(id)) abearcOrthomosaicEnabledIds.add(id);
        else {
          abearcOrthomosaicEnabledIds.delete(id);
          removeAbearcOrthomosaicLayer(id);
        }
      });
      saveAbearcOrthomosaicPreferences();
      renderAbearcOrthomosaics();
    }

    function abearcOrthomosaicFitItem(item) {
      if (!abearcMap || !Array.isArray(item?.bounds)) return;
      abearcMap.fitBounds([[item.bounds[0], item.bounds[1]], [item.bounds[2], item.bounds[3]]], { padding: 48, duration: 700, maxZoom: 20 });
    }

    function selectAbearcOrthomosaicCapture(id, zoom = false, expandSeries = true) {
      rememberAbearcMapLayoutChange();
      const group = abearcOrthomosaicSeriesForId(id);
      const item = group?.items.find(row => Number(row.id) === Number(id));
      if (!group || !item) return;
      stopAbearcOrthomosaicPlayback();
      [...abearcOrthomosaicExpandedSeries].forEach(key => {
        if (group.items.length === 1 || key !== group.key) abearcOrthomosaicExpandedSeries.delete(key);
      });
      abearcOrthomosaicSelectedSeriesKey = group.items.length > 1 ? group.key : '';
      if (group.items.length > 1 && expandSeries) abearcOrthomosaicExpandedSeries.add(group.key);
      abearcOrthomosaicSeriesMode = 'single';
      abearcOrthomosaicSelectedId = Number(id);
      abearcOrthomosaicTimelineIndex = group.playable.findIndex(row => Number(row.id) === Number(id));
      if (item.is_active && item.processing_status === 'ready') abearcOrthomosaicApplySeriesIds(group, [id]);
      else renderAbearcOrthomosaics();
      if (zoom) abearcOrthomosaicFitItem(item);
    }

    function selectAbearcOrthomosaicSeries(key, zoom = false) {
      rememberAbearcMapLayoutChange();
      const group = abearcOrthomosaicSeriesByKey(key);
      if (!group) return;
      abearcOrthomosaicSelectedSeriesKey = group.key;
      const current = group.playable.find(item => abearcOrthomosaicEnabledIds.has(Number(item.id))) || group.playable.at(-1) || group.latest;
      selectAbearcOrthomosaicCapture(current.id, zoom, false);
      abearcOrthomosaicSelectedSeriesKey = group.key;
      syncAbearcOrthomosaicSeriesControls();
    }

    function toggleAbearcOrthomosaicSeries(event, key) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const expanding = !abearcOrthomosaicExpandedSeries.has(key);
      if (!expanding) {
        abearcOrthomosaicExpandedSeries.delete(key);
        if (abearcOrthomosaicSelectedSeriesKey === key) stopAbearcOrthomosaicPlayback();
      } else {
        abearcOrthomosaicExpandedSeries.clear();
        abearcOrthomosaicExpandedSeries.add(key);
        const group = abearcOrthomosaicSeriesByKey(key);
        const current = group?.playable.find(item => abearcOrthomosaicEnabledIds.has(Number(item.id))) || group?.playable.at(-1);
        abearcOrthomosaicSelectedSeriesKey = key;
        if (current) {
          abearcOrthomosaicSelectedId = Number(current.id);
          abearcOrthomosaicTimelineIndex = group.playable.findIndex(item => Number(item.id) === Number(current.id));
        }
      }
      document.querySelectorAll('[data-orthomosaic-series-key]').forEach(section => {
        const expanded = abearcOrthomosaicExpandedSeries.has(section.dataset.orthomosaicSeriesKey);
        section.classList.toggle('is-expanded', expanded);
        section.querySelector('.abearc-map-orthomosaic-series-captures')?.classList.toggle('is-expanded', expanded);
        const toggle = section.querySelector('.abearc-map-orthomosaic-series-toggle');
        toggle?.setAttribute('aria-expanded', String(expanded));
        toggle?.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} captures`);
        if (toggle) toggle.title = `${expanded ? 'Collapse' : 'Expand'} captures`;
        section.querySelector(':scope > .abearc-map-list-item')?.classList.toggle('is-selected', section.dataset.orthomosaicSeriesKey === abearcOrthomosaicSelectedSeriesKey);
      });
      document.querySelectorAll('[data-orthomosaic-id]').forEach(item => item.classList.toggle('is-selected', Number(item.dataset.orthomosaicId) === Number(abearcOrthomosaicSelectedId)));
      syncAbearcOrthomosaicSeriesControls();
    }

    function syncAbearcOrthomosaicSeriesControls() {
      const controls = document.querySelector('[data-orthomosaic-series-controls]');
      if (!controls) return;
      const group = abearcOrthomosaicSeriesByKey(abearcOrthomosaicSelectedSeriesKey);
      const frames = group?.playable || [];
      const visible = frames.length > 1 && abearcOrthomosaicExpandedSeries.has(group.key);
      controls.classList.toggle('hidden', !visible);
      if (!visible) {
        stopAbearcOrthomosaicPlayback();
        return;
      }
      let index = frames.findIndex(item => Number(item.id) === Number(abearcOrthomosaicSelectedId));
      if (index < 0) index = frames.length - 1;
      abearcOrthomosaicTimelineIndex = Math.max(0, Math.min(frames.length - 1, abearcOrthomosaicTimelineIndex < 0 ? index : abearcOrthomosaicTimelineIndex));
      const current = frames[abearcOrthomosaicTimelineIndex];
      controls.querySelector('[data-orthomosaic-series-title]').textContent = group.latest.name;
      controls.querySelectorAll('[data-orthomosaic-series-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.orthomosaicSeriesMode === abearcOrthomosaicSeriesMode));
      const timelineControls = controls.querySelector('[data-orthomosaic-timeline-controls]');
      const compareControls = controls.querySelector('[data-orthomosaic-compare-controls]');
      timelineControls.classList.toggle('hidden', abearcOrthomosaicSeriesMode !== 'timeline');
      compareControls.classList.toggle('hidden', abearcOrthomosaicSeriesMode !== 'compare');
      const slider = controls.querySelector('[data-orthomosaic-timeline]');
      slider.max = String(frames.length - 1);
      slider.value = String(abearcOrthomosaicTimelineIndex);
      controls.querySelector('[data-orthomosaic-timeline-start]').textContent = formatAbearcOrthomosaicDate(frames[0].orthomosaic_date || frames[0].survey_date || frames[0].uploaded_at);
      controls.querySelector('[data-orthomosaic-timeline-end]').textContent = formatAbearcOrthomosaicDate(frames.at(-1).orthomosaic_date || frames.at(-1).survey_date || frames.at(-1).uploaded_at);
      const options = frames.map(item => `<option value="${Number(item.id)}">${esc(formatAbearcOrthomosaicDate(item.orthomosaic_date || item.survey_date || item.uploaded_at))}</option>`).join('');
      const before = controls.querySelector('[data-orthomosaic-compare-before]');
      const after = controls.querySelector('[data-orthomosaic-compare-after]');
      if (!frames.some(item => Number(item.id) === Number(abearcOrthomosaicCompareBeforeId))) abearcOrthomosaicCompareBeforeId = Number(frames[0].id);
      if (!frames.some(item => Number(item.id) === Number(abearcOrthomosaicCompareAfterId)) || Number(abearcOrthomosaicCompareAfterId) === Number(abearcOrthomosaicCompareBeforeId)) abearcOrthomosaicCompareAfterId = Number(frames.at(-1).id);
      before.innerHTML = options;
      after.innerHTML = options;
      before.value = String(abearcOrthomosaicCompareBeforeId);
      after.value = String(abearcOrthomosaicCompareAfterId);
      controls.querySelector('[data-orthomosaic-blend]').value = String(abearcOrthomosaicCompareBlend);
      controls.querySelector('[data-orthomosaic-blend-output]').textContent = `${abearcOrthomosaicCompareBlend}%`;
      const beforeItem = frames.find(item => Number(item.id) === Number(abearcOrthomosaicCompareBeforeId));
      const afterItem = frames.find(item => Number(item.id) === Number(abearcOrthomosaicCompareAfterId));
      const dateLabel = abearcOrthomosaicSeriesMode === 'compare'
        ? `${formatAbearcOrthomosaicDate(beforeItem?.orthomosaic_date || beforeItem?.survey_date || beforeItem?.uploaded_at)} to ${formatAbearcOrthomosaicDate(afterItem?.orthomosaic_date || afterItem?.survey_date || afterItem?.uploaded_at)}`
        : `${formatAbearcOrthomosaicDate(current.orthomosaic_date || current.survey_date || current.uploaded_at)} · ${abearcOrthomosaicTimelineIndex + 1} of ${frames.length}`;
      controls.querySelector('[data-orthomosaic-series-date]').textContent = dateLabel;
    }

    function setAbearcOrthomosaicSeriesMode(mode) {
      rememberAbearcMapLayoutChange();
      const group = abearcOrthomosaicSeriesByKey(abearcOrthomosaicSelectedSeriesKey);
      if (!group || group.playable.length < 2 || !['single', 'timeline', 'compare'].includes(mode)) return;
      stopAbearcOrthomosaicPlayback();
      abearcOrthomosaicSeriesMode = mode;
      if (mode === 'compare') {
        if (!group.playable.some(item => Number(item.id) === Number(abearcOrthomosaicCompareBeforeId))) abearcOrthomosaicCompareBeforeId = Number(group.playable[0].id);
        if (!group.playable.some(item => Number(item.id) === Number(abearcOrthomosaicCompareAfterId)) || Number(abearcOrthomosaicCompareAfterId) === Number(abearcOrthomosaicCompareBeforeId)) abearcOrthomosaicCompareAfterId = Number(group.playable.at(-1).id);
        abearcOrthomosaicApplySeriesIds(group, [abearcOrthomosaicCompareBeforeId, abearcOrthomosaicCompareAfterId]);
      } else {
        if (abearcOrthomosaicTimelineIndex < 0) abearcOrthomosaicTimelineIndex = group.playable.length - 1;
        const item = group.playable[abearcOrthomosaicTimelineIndex] || group.playable.at(-1);
        abearcOrthomosaicSelectedId = Number(item.id);
        abearcOrthomosaicApplySeriesIds(group, [item.id]);
      }
    }

    function setAbearcOrthomosaicTimelineFrame(value) {
      if (!abearcOrthomosaicPlaybackTimer) rememberAbearcMapLayoutChange();
      const group = abearcOrthomosaicSeriesByKey(abearcOrthomosaicSelectedSeriesKey);
      if (!group?.playable.length) return;
      abearcOrthomosaicSeriesMode = 'timeline';
      abearcOrthomosaicTimelineIndex = Math.max(0, Math.min(group.playable.length - 1, Number(value) || 0));
      const item = group.playable[abearcOrthomosaicTimelineIndex];
      abearcOrthomosaicSelectedId = Number(item.id);
      abearcOrthomosaicApplySeriesIds(group, [item.id]);
    }

    function stepAbearcOrthomosaicTimeline(direction) {
      const group = abearcOrthomosaicSeriesByKey(abearcOrthomosaicSelectedSeriesKey);
      if (!group?.playable.length) return;
      const next = (Math.max(0, abearcOrthomosaicTimelineIndex) + Number(direction) + group.playable.length) % group.playable.length;
      setAbearcOrthomosaicTimelineFrame(next);
    }

    function startAbearcOrthomosaicPlayback() {
      if (!abearcOrthomosaicPlaybackTimer) rememberAbearcMapLayoutChange();
      stopAbearcOrthomosaicPlayback();
      abearcOrthomosaicPlaybackTimer = setInterval(() => stepAbearcOrthomosaicTimeline(1), abearcOrthomosaicPlaybackSpeed);
      const button = document.querySelector('[data-orthomosaic-play]');
      button?.setAttribute('aria-label', 'Pause time series');
      button?.setAttribute('title', 'Pause time series');
      button?.querySelector('[data-orthomosaic-play-icon]')?.classList.add('hidden');
      button?.querySelector('[data-orthomosaic-pause-icon]')?.classList.remove('hidden');
    }

    function toggleAbearcOrthomosaicPlayback() {
      if (abearcOrthomosaicPlaybackTimer) return stopAbearcOrthomosaicPlayback();
      setAbearcOrthomosaicSeriesMode('timeline');
      startAbearcOrthomosaicPlayback();
    }

    function setAbearcOrthomosaicPlaybackSpeed(value) {
      abearcOrthomosaicPlaybackSpeed = [1000, 2000, 4000].includes(Number(value)) ? Number(value) : 2000;
      if (abearcOrthomosaicPlaybackTimer) startAbearcOrthomosaicPlayback();
    }

    function setAbearcOrthomosaicCompareCapture(kind, value) {
      rememberAbearcMapLayoutChange();
      const group = abearcOrthomosaicSeriesByKey(abearcOrthomosaicSelectedSeriesKey);
      const id = Number(value);
      if (!group?.playable.some(item => Number(item.id) === id)) return;
      if (kind === 'before') abearcOrthomosaicCompareBeforeId = id;
      else abearcOrthomosaicCompareAfterId = id;
      if (Number(abearcOrthomosaicCompareBeforeId) === Number(abearcOrthomosaicCompareAfterId)) {
        const alternative = group.playable.find(item => Number(item.id) !== id);
        if (kind === 'before') abearcOrthomosaicCompareAfterId = Number(alternative.id);
        else abearcOrthomosaicCompareBeforeId = Number(alternative.id);
      }
      abearcOrthomosaicSeriesMode = 'compare';
      abearcOrthomosaicApplySeriesIds(group, [abearcOrthomosaicCompareBeforeId, abearcOrthomosaicCompareAfterId]);
    }

    function setAbearcOrthomosaicCompareBlend(value) {
      rememberAbearcMapLayoutChange();
      abearcOrthomosaicCompareBlend = Math.max(0, Math.min(100, Number(value) || 0));
      const output = document.querySelector('[data-orthomosaic-blend-output]');
      if (output) output.textContent = `${abearcOrthomosaicCompareBlend}%`;
      if (abearcMap?.getLayer(abearcOrthomosaicLayerId(abearcOrthomosaicCompareBeforeId))) abearcMap.setPaintProperty(abearcOrthomosaicLayerId(abearcOrthomosaicCompareBeforeId), 'raster-opacity', 1);
      if (abearcMap?.getLayer(abearcOrthomosaicLayerId(abearcOrthomosaicCompareAfterId))) abearcMap.setPaintProperty(abearcOrthomosaicLayerId(abearcOrthomosaicCompareAfterId), 'raster-opacity', abearcOrthomosaicCompareBlend / 100);
    }

    function openAbearcOrthomosaicContextMenu(event, id) {
      const item = abearcOrthomosaics.find(row => Number(row.id) === Number(id));
      const menu = document.querySelector('[data-map-orthomosaic-context-menu]');
      const shell = document.querySelector('#mapPage .abearc-map-shell');
      if (!item || !menu || !shell) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      selectAbearcOrthomosaic(id);
      abearcOrthomosaicContextId = Number(id);
      const ready = item.processing_status === 'ready';
  const opacity = menu.querySelector('[data-orthomosaic-context-opacity]');
      const manageSeparator = menu.querySelector('[data-orthomosaic-context-manage]');
      const rename = menu.querySelector('[data-orthomosaic-context-rename]');
      const active = menu.querySelector('[data-orthomosaic-context-active]');
      const deleteSeparator = menu.querySelector('[data-orthomosaic-context-delete-separator]');
      const remove = menu.querySelector('[data-orthomosaic-context-delete]');
  opacity?.classList.toggle('hidden', !ready);
      const opacityInput = opacity?.querySelector('input');
      const opacityOutput = opacity?.querySelector('output');
      const opacityPercent = Math.round(Number(abearcOrthomosaicOpacity[Number(id)] ?? 1) * 100);
      if (opacityInput) opacityInput.value = String(opacityPercent);
      if (opacityOutput) opacityOutput.textContent = `${opacityPercent}%`;
      manageSeparator?.classList.toggle('hidden', !abearcOrthomosaicCanManage);
      rename?.classList.toggle('hidden', !abearcOrthomosaicCanManage);
      active?.classList.toggle('hidden', !abearcOrthomosaicCanManage || !ready);
      deleteSeparator?.classList.toggle('hidden', !abearcOrthomosaicCanManage);
      remove?.classList.toggle('hidden', !abearcOrthomosaicCanManage);
      const activeLabel = active?.querySelector('[data-orthomosaic-context-active-label]');
      if (activeLabel) activeLabel.textContent = item.is_active ? 'Deactivate' : 'Activate';
      menu.classList.remove('hidden');
      const bounds = shell.getBoundingClientRect();
      const width = menu.offsetWidth || 210;
      const height = menu.offsetHeight || 250;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, Number(event?.clientX || bounds.left + 80) - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, Number(event?.clientY || bounds.top + 80) - bounds.top))}px`;
    }

    function setContextAbearcOrthomosaicOpacity(value, output) {
      if (!abearcOrthomosaicContextId) return;
      setAbearcOrthomosaicOpacity(abearcOrthomosaicContextId, value, output);
    }

    function renameContextAbearcOrthomosaic() {
      if (!abearcOrthomosaicCanManage) return closeAbearcOrthomosaicContextMenu();
      const id = abearcOrthomosaicContextId;
      closeAbearcOrthomosaicContextMenu();
      openAbearcOrthomosaicModal(id);
    }

    function toggleContextAbearcOrthomosaicActive() {
      if (!abearcOrthomosaicCanManage) return closeAbearcOrthomosaicContextMenu();
      const item = abearcOrthomosaicContextItem();
      closeAbearcOrthomosaicContextMenu();
      if (item) setAbearcOrthomosaicActive(item.id, !item.is_active);
    }

    function deleteContextAbearcOrthomosaic() {
      if (!abearcOrthomosaicCanManage) return closeAbearcOrthomosaicContextMenu();
      const id = abearcOrthomosaicContextId;
      closeAbearcOrthomosaicContextMenu();
      deleteAbearcOrthomosaic(id);
    }

    async function loadAbearcOrthomosaics(force = false) {
      if (!abearcOrthomosaicHasAccess()) {
        document.querySelector('[data-map-orthomosaic-panel]')?.classList.add('hidden');
        document.querySelector('[data-map-orthomosaic-toolbar]')?.classList.add('hidden');
        return [];
      }
      loadAbearcOrthomosaicPreferences();
      if (abearcOrthomosaicLoadPromise && !force) return abearcOrthomosaicLoadPromise;
      abearcOrthomosaicLoadPromise = fetchJson(`${API}/map/orthomosaics`, { silentLoading: true, cache: 'no-store' })
        .then(result => {
          abearcOrthomosaics = Array.isArray(result.orthomosaics) ? result.orthomosaics : [];
          abearcOrthomosaicCanManage = Boolean(result.can_manage);
          const availableIds = new Set(abearcOrthomosaics.map(item => Number(item.id)));
          [...abearcOrthomosaicEnabledIds].forEach(id => { if (!availableIds.has(Number(id))) abearcOrthomosaicEnabledIds.delete(Number(id)); });
          if (!abearcOrthomosaicVisibilityCustomized) {
            abearcOrthomosaicEnabledIds.clear();
            abearcOrthomosaicDefaultVisibleItems()
              .filter(item => item.processing_status === 'ready')
              .forEach(item => abearcOrthomosaicEnabledIds.add(Number(item.id)));
          }
          normalizeAbearcOrthomosaicSeriesVisibility();
          saveAbearcOrthomosaicPreferences();
          renderAbearcOrthomosaics();
          clearTimeout(abearcOrthomosaicPollTimer);
          if (abearcOrthomosaics.some(item => item.processing_status === 'processing') && appCurrentView === 'map') {
            abearcOrthomosaicPollTimer = setTimeout(() => loadAbearcOrthomosaics(true), 5000);
          }
          return abearcOrthomosaics;
        })
        .catch(error => {
          console.warn('Unable to load drone orthomosaics:', error);
          const list = document.querySelector('[data-map-orthomosaic-list]');
          if (list) list.innerHTML = '<span class="abearc-map-orthomosaic-error">Orthomosaic service unavailable.</span>';
          return [];
        })
        .finally(() => { abearcOrthomosaicLoadPromise = null; });
      return abearcOrthomosaicLoadPromise;
    }

    function toggleAbearcOrthomosaicDrawer(forceOpen = null) {
      if (!abearcOrthomosaicHasAccess()) return;
      const drawer = document.querySelector('[data-map-orthomosaic-panel]');
      const button = document.querySelector('[data-map-orthomosaic-toolbar]');
      const resultsPanel = document.querySelector('[data-map-results-panel]');
      if (!drawer) return;
      const open = forceOpen == null ? drawer.classList.contains('hidden') : Boolean(forceOpen);
      loadAbearcOrthomosaicPreferences();
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicDrawerOpen'), String(open));
      if (open) {
        window.toggleWeatherStationsDrawer?.(false);
        window.toggleAbearcRamPumpDrawer?.(false);
        window.toggleAbearcMapLayoutsDrawer?.(false);
        toggleAbearcMapResults(true);
      }
      drawer.classList.toggle('hidden', !open);
      if (open) resultsPanel?.classList.add('hidden');
      button?.classList.toggle('is-active', open);
      button?.setAttribute('aria-expanded', String(open));
      button?.setAttribute('aria-pressed', String(open));
      syncAbearcMapRail();
      if (open) {
        toggleAbearcMapLayerMenu(false);
        toggleAbearcQuickLayers(false);
        loadAbearcOrthomosaics(true);
      } else {
        stopAbearcOrthomosaicPlayback();
        closeAbearcOrthomosaicContextMenu();
      }
      setTimeout(() => abearcMap?.resize(), 50);
    }

    function restoreAbearcOrthomosaicDrawer() {
      loadAbearcOrthomosaicPreferences();
      if (abearcOrthomosaicPreferenceValue('abearcOrthomosaicDrawerOpen') === 'true') toggleAbearcOrthomosaicDrawer(true);
      else loadAbearcOrthomosaics();
    }

    const toggleAbearcOrthomosaicPanel = toggleAbearcOrthomosaicDrawer;

    function setAbearcOrthomosaicVisible(id, visible) {
      rememberAbearcMapLayoutChange();
      const item = abearcOrthomosaics.find(row => Number(row.id) === Number(id));
      if (!item || item.processing_status !== 'ready' || !item.is_active) return;
      abearcOrthomosaicVisibilityCustomized = true;
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicVisibilityCustomized'), 'true');
      if (visible) {
        const group = abearcOrthomosaicSeriesForId(id);
        group?.playable.forEach(row => {
          if (Number(row.id) !== Number(id)) {
            abearcOrthomosaicEnabledIds.delete(Number(row.id));
            removeAbearcOrthomosaicLayer(row.id);
          }
        });
        abearcOrthomosaicEnabledIds.add(Number(id));
      }
      else {
        abearcOrthomosaicEnabledIds.delete(Number(id));
        removeAbearcOrthomosaicLayer(id);
      }
      saveAbearcOrthomosaicPreferences();
      renderAbearcOrthomosaics();
    }

    function setAbearcOrthomosaicOpacity(id, value, output) {
      rememberAbearcMapLayoutChange();
      const opacity = Math.max(0, Math.min(1, Number(value) / 100));
      abearcOrthomosaicOpacity[Number(id)] = opacity;
      if (output) output.textContent = `${Math.round(opacity * 100)}%`;
      if (abearcMap?.getLayer(abearcOrthomosaicLayerId(id))) abearcMap.setPaintProperty(abearcOrthomosaicLayerId(id), 'raster-opacity', abearcOrthomosaicEffectiveOpacity(id));
      saveAbearcOrthomosaicPreferences();
    }

    function zoomToAbearcOrthomosaic(id) {
      const item = abearcOrthomosaics.find(row => Number(row.id) === Number(id));
      if (!abearcMap || !Array.isArray(item?.bounds)) return;
      selectAbearcOrthomosaic(id);
      abearcMap.fitBounds([[item.bounds[0], item.bounds[1]], [item.bounds[2], item.bounds[3]]], { padding: 48, duration: 700, maxZoom: 20 });
    }

    function setupAbearcOrthomosaicDropZone() {
      const zone = document.getElementById('abearcOrthomosaicDropZone');
      const input = document.getElementById('abearcOrthomosaicFile');
      if (!zone || !input) return;
      setupGenericFileDropZone({
        zoneId: 'abearcOrthomosaicDropZone',
        inputId: 'abearcOrthomosaicFile',
        labelId: 'abearcOrthomosaicFileLabel',
        emptyText: 'TIF or TIFF georeferenced raster.'
      });
      if (zone.dataset.orthomosaicReady === '1') return;
      zone.dataset.orthomosaicReady = '1';
      input.addEventListener('change', () => inspectAbearcOrthomosaicFile(input.files?.[0]));
      zone.addEventListener('drop', event => inspectAbearcOrthomosaicFile(event.dataTransfer?.files?.[0]));
    }

    function openAbearcOrthomosaicModal(id = null) {
      if (!abearcOrthomosaicCanManage) return;
      const modal = document.getElementById('abearcOrthomosaicModal');
      const item = id == null ? null : abearcOrthomosaics.find(row => Number(row.id) === Number(id));
      modal.dataset.editId = item ? String(item.id) : '';
      document.getElementById('abearcOrthomosaicModalTitle').textContent = item ? 'Edit Drone Orthomosaic' : 'Upload Drone Orthomosaic';
      modal.querySelector('[data-orthomosaic-file-field]').classList.toggle('hidden', Boolean(item));
      document.getElementById('abearcOrthomosaicFile').value = '';
      document.getElementById('abearcOrthomosaicFileLabel').textContent = 'TIF or TIFF georeferenced raster.';
      document.getElementById('abearcOrthomosaicName').value = item?.name || '';
      document.getElementById('abearcOrthomosaicDate').value = String(item?.orthomosaic_date || '').slice(0, 10);
      document.getElementById('abearcOrthomosaicNotes').value = item?.notes || '';
      document.getElementById('abearcOrthomosaicUploadStatus').textContent = '';
      const metadata = document.getElementById('abearcOrthomosaicMetadata');
      metadata.classList.toggle('hidden', !item);
      metadata.textContent = item ? `${item.source_epsg || 'CRS detected'} · ${Number(item.raster_width || 0).toLocaleString()} × ${Number(item.raster_height || 0).toLocaleString()} · ${formatAbearcOrthomosaicBytes(item.file_size)}` : '';
      const save = document.getElementById('abearcOrthomosaicSave');
      save.textContent = item ? 'Save Changes' : 'Upload Orthomosaic';
      save.disabled = !item;
      abearcOrthomosaicStageToken = '';
      setupAbearcOrthomosaicDropZone();
      modal.classList.remove('hidden');
    }

    function closeAbearcOrthomosaicModal() {
      document.getElementById('abearcOrthomosaicModal')?.classList.add('hidden');
    }

    async function inspectAbearcOrthomosaicFile(file) {
      if (!file) return;
      const status = document.getElementById('abearcOrthomosaicUploadStatus');
      const save = document.getElementById('abearcOrthomosaicSave');
      const metadata = document.getElementById('abearcOrthomosaicMetadata');
      delete status.dataset.state;
      save.disabled = true;
      abearcOrthomosaicStageToken = '';
      status.textContent = 'Uploading and reading GeoTIFF metadata...';
      metadata.classList.add('hidden');
      try {
        const body = new FormData();
        body.append('file', file);
        if (file.lastModified) body.append('file_last_modified', new Date(file.lastModified).toISOString());
        const result = await downloadsFormsUploadRequest(`${API}/map/orthomosaics/inspect`, 'POST', body, file.name, {
          title: 'Uploading Drone Orthomap',
          initialStatus: 'Preparing GeoTIFF upload...',
          progressStatus: 'Uploading GeoTIFF...',
          uploadCompleteStatus: 'Upload complete. Reading GeoTIFF metadata...'
        });
        abearcOrthomosaicStageToken = result.token;
        const name = document.getElementById('abearcOrthomosaicName');
        if (!name.value.trim()) name.value = result.suggested_name || '';
        document.getElementById('abearcOrthomosaicDate').value = result.date || '';
        metadata.textContent = `${result.source_epsg || 'Georeferenced CRS'} · ${Number(result.width || 0).toLocaleString()} × ${Number(result.height || 0).toLocaleString()} · Date source: ${String(result.date_source || 'manual').replaceAll('_', ' ')}`;
        metadata.classList.remove('hidden');
        status.textContent = 'GeoTIFF validated. Review the name and date before uploading.';
        save.disabled = false;
      } catch (error) {
        status.textContent = error.message || 'GeoTIFF inspection failed.';
        status.dataset.state = 'error';
      }
    }

    async function saveAbearcOrthomosaic(event) {
      event.preventDefault();
      const modal = document.getElementById('abearcOrthomosaicModal');
      const id = Number(modal.dataset.editId || 0);
      const name = document.getElementById('abearcOrthomosaicName').value.trim();
      const orthomosaicDate = document.getElementById('abearcOrthomosaicDate').value;
      const notes = document.getElementById('abearcOrthomosaicNotes').value.trim();
      const status = document.getElementById('abearcOrthomosaicUploadStatus');
      const save = document.getElementById('abearcOrthomosaicSave');
      delete status.dataset.state;
      if (!id && !abearcOrthomosaicStageToken) return toast('Select and validate a GeoTIFF first.', 'error');
      save.disabled = true;
      status.textContent = id ? 'Saving changes...' : 'Starting orthomosaic processing...';
      try {
        if (id) {
          await fetchJson(`${API}/map/orthomosaics/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, orthomosaic_date: orthomosaicDate, notes }), silentLoading: true });
          toast('Orthomosaic details updated.');
        } else {
          await fetchJson(`${API}/map/orthomosaics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: abearcOrthomosaicStageToken, name, orthomosaic_date: orthomosaicDate, notes }), silentLoading: true });
          toast('Orthomosaic uploaded and queued for processing.');
        }
        closeAbearcOrthomosaicModal();
        toggleAbearcOrthomosaicDrawer(true);
        await loadAbearcOrthomosaics(true);
      } catch (error) {
        status.textContent = error.message || 'Unable to save the orthomosaic.';
        status.dataset.state = 'error';
        save.disabled = false;
      }
    }

    async function setAbearcOrthomosaicActive(id, active) {
      try {
        await fetchJson(`${API}/map/orthomosaics/${Number(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: Boolean(active) }), silentLoading: true });
        if (!active) {
          abearcOrthomosaicEnabledIds.delete(Number(id));
          removeAbearcOrthomosaicLayer(id);
          saveAbearcOrthomosaicPreferences();
        }
        await loadAbearcOrthomosaics(true);
        toast(`Orthomosaic ${active ? 'activated' : 'deactivated'}.`);
      } catch (error) { toast(error.message || 'Unable to update the orthomosaic.', 'error'); }
    }

    async function deleteAbearcOrthomosaic(id) {
      const item = abearcOrthomosaics.find(row => Number(row.id) === Number(id));
      if (!item) return;
      const confirmed = await confirmModalChoice(`Delete ${item.name} – ${formatAbearcOrthomosaicDate(item.orthomosaic_date)}? This removes its original file, processed map, and cached tiles.`, { title: 'Delete Orthomosaic', confirmText: 'Delete' });
      if (!confirmed) return;
      try {
        await fetchJson(`${API}/map/orthomosaics/${Number(id)}`, { method: 'DELETE', silentLoading: true });
        abearcOrthomosaicEnabledIds.delete(Number(id));
        removeAbearcOrthomosaicLayer(id);
        saveAbearcOrthomosaicPreferences();
        await loadAbearcOrthomosaics(true);
        toast('Orthomosaic deleted.');
      } catch (error) { toast(error.message || 'Unable to delete the orthomosaic.', 'error'); }
    }


    function captureAbearcOrthomosaicLayoutState() {
      return {
        enabledIds: [...abearcOrthomosaicEnabledIds].map(Number).filter(Number.isFinite),
        opacity: Object.fromEntries(Object.entries(abearcOrthomosaicOpacity).map(([id, value]) => [String(id), Number(value)])),
        selectedId: Number.isFinite(Number(abearcOrthomosaicSelectedId)) ? Number(abearcOrthomosaicSelectedId) : null,
        selectedSeriesKey: String(abearcOrthomosaicSelectedSeriesKey || ''),
        seriesMode: abearcOrthomosaicSeriesMode,
        timelineIndex: Number(abearcOrthomosaicTimelineIndex),
        compareBeforeId: Number.isFinite(Number(abearcOrthomosaicCompareBeforeId)) ? Number(abearcOrthomosaicCompareBeforeId) : null,
        compareAfterId: Number.isFinite(Number(abearcOrthomosaicCompareAfterId)) ? Number(abearcOrthomosaicCompareAfterId) : null,
        compareBlend: Number(abearcOrthomosaicCompareBlend)
      };
    }

    async function restoreAbearcOrthomosaicLayoutState(state = {}) {
      if (!abearcOrthomosaicHasAccess()) return { missingIds: [] };
      stopAbearcOrthomosaicPlayback();
      if (!abearcMapRestoringView) await loadAbearcOrthomosaics();
      const available = new Set(abearcOrthomosaics.filter(item => item.processing_status === 'ready' && item.is_active).map(item => Number(item.id)));
      const requested = (Array.isArray(state.enabledIds) ? state.enabledIds : []).map(Number).filter(Number.isFinite);
      const missingIds = requested.filter(id => !available.has(id));
      [...abearcOrthomosaicEnabledIds].forEach(id => removeAbearcOrthomosaicLayer(id));
      abearcOrthomosaicEnabledIds.clear();
      requested.filter(id => available.has(id)).forEach(id => abearcOrthomosaicEnabledIds.add(id));
      Object.keys(abearcOrthomosaicOpacity).forEach(key => delete abearcOrthomosaicOpacity[key]);
      if (state.opacity && typeof state.opacity === 'object') {
        Object.entries(state.opacity).forEach(([id, value]) => {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) abearcOrthomosaicOpacity[Number(id)] = Math.max(0, Math.min(1, numeric));
        });
      }
      abearcOrthomosaicVisibilityCustomized = true;
      localStorage.setItem(abearcOrthomosaicPreferenceKey('abearcOrthomosaicVisibilityCustomized'), 'true');
      abearcOrthomosaicSelectedId = available.has(Number(state.selectedId)) ? Number(state.selectedId) : null;
      abearcOrthomosaicSelectedSeriesKey = String(state.selectedSeriesKey || '');
      abearcOrthomosaicSeriesMode = ['single', 'timeline', 'compare'].includes(state.seriesMode) ? state.seriesMode : 'single';
      abearcOrthomosaicTimelineIndex = Number.isInteger(Number(state.timelineIndex)) ? Number(state.timelineIndex) : -1;
      abearcOrthomosaicCompareBeforeId = available.has(Number(state.compareBeforeId)) ? Number(state.compareBeforeId) : null;
      abearcOrthomosaicCompareAfterId = available.has(Number(state.compareAfterId)) ? Number(state.compareAfterId) : null;
      abearcOrthomosaicCompareBlend = Math.max(0, Math.min(100, Number.isFinite(Number(state.compareBlend)) ? Number(state.compareBlend) : 50));
      saveAbearcOrthomosaicPreferences();
      renderAbearcOrthomosaics();
      setupAbearcOrthomosaicLayers();
      syncAbearcOrthomosaicSeriesControls();
      return { missingIds };
    }

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-map-orthomosaic-context-menu]') && !event.target.closest('[data-orthomosaic-menu-id]')) {
        closeAbearcOrthomosaicContextMenu();
      }
    });

    Object.assign(window, {
      loadAbearcOrthomosaics,
      captureAbearcOrthomosaicLayoutState,
      restoreAbearcOrthomosaicLayoutState,
      setupAbearcOrthomosaicLayers,
      abearcOrthomosaicActiveCount,
      toggleAbearcOrthomosaicDrawer,
      restoreAbearcOrthomosaicDrawer,
      toggleAbearcOrthomosaicPanel,
      openAbearcOrthomosaicContextMenu,
      closeAbearcOrthomosaicContextMenu,
      setContextAbearcOrthomosaicOpacity,
      selectAbearcOrthomosaicCapture,
      selectAbearcOrthomosaicSeries,
      toggleAbearcOrthomosaicSeries,
      setAbearcOrthomosaicSeriesMode,
      setAbearcOrthomosaicTimelineFrame,
      stepAbearcOrthomosaicTimeline,
      toggleAbearcOrthomosaicPlayback,
      setAbearcOrthomosaicPlaybackSpeed,
      setAbearcOrthomosaicCompareCapture,
      setAbearcOrthomosaicCompareBlend,
      renameContextAbearcOrthomosaic,
      toggleContextAbearcOrthomosaicActive,
      deleteContextAbearcOrthomosaic,
      toggleAllAbearcOrthomosaics,
      setAbearcOrthomosaicVisible,
      setAbearcOrthomosaicOpacity,
      zoomToAbearcOrthomosaic,
      openAbearcOrthomosaicModal,
      closeAbearcOrthomosaicModal,
      inspectAbearcOrthomosaicFile,
      saveAbearcOrthomosaic,
      setAbearcOrthomosaicActive,
      deleteAbearcOrthomosaic
    });
