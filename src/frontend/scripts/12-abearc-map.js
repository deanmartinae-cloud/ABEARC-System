    let abearcMap = null;
    let abearcMapConfig = null;
    let abearcMapFeatures = [];
    let abearcMapAbort = null;
    let abearcMapReloadTimer = null;
    let abearcMapAutoSyncTimer = null;
    const ABEARC_MAP_AUTO_SYNC_INTERVAL_MS = 5000;
    let abearcMapExploded = null;
    let abearcMapExplosionCollapseTimer = null;
    let abearcMapSelectedPhotoId = null;
    let abearcMapHoveredPhotoId = null;
    let abearcMapResultSingleClickTimer = null;
    let abearcMapThumbnailContextId = null;
    let abearcMapThumbnailMoveId = null;
    const abearcMapMovedPhotoPositions = new Map();
    const abearcMapPhotoDragBindings = new Map();
    const abearcMapPhotoSuppressOpenUntil = new Map();
    let abearcMapStartMovePoint = null;
    let abearcMapAltHeld = false;
    let abearcMapLayerSetupQueued = false;
    let abearcMapMarkerRenderQueued = false;
    let abearcMapResizeAnimationFrame = null;
    let abearcMapStyleErrorTimer = null;
    let abearcMapMeasureMode = 'off';
    let abearcMapMeasurePoints = [];
    let abearcMapMeasureStorageOwner = null;
    let abearcMapDraggingMeasureIndex = null;
    let abearcMapElevationTimer = null;
    let abearcMapElevationAbort = null;
    let abearcMapElevationKey = '';
    let abearcMapElevationRequestId = 0;
    let abearcMapElevationVisible = false;
    const ABEARC_MAP_ELEVATION_SOURCES = new Set([
      'aws-copernicus-glo30',
      'copernicus-glo90',
      'aws-copernicus-glo90',
      'aws-mapzen',
      'opentopo-srtm30',
      'opentopo-mapzen'
    ]);
    const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = 'opentopo-srtm30';
    let abearcMapElevationSource = ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
    let abearcMapLastSearchFitKey = '';
    let abearcMapCommittedSearch = '';
    let abearcMapFitAllRequested = false;
    const abearcMapPhotoMarkers = new Map();
    let abearcMapPhotosVisible = localStorage.getItem('abearcMapPhotosVisible') !== 'false';
    let abearcMapSavedPhotoIds = (() => {
      try {
        const ids = JSON.parse(localStorage.getItem('abearcMapSavedPhotoIds') || '[]');
        return new Set(Array.isArray(ids) ? ids.map(Number).filter(id => Number.isFinite(id) && id > 0) : []);
      } catch (_) {
        return new Set();
      }
    })();
    let abearcMapPhotoScope = 'all';
    let abearcDavaoBoundaryVisible = localStorage.getItem('abearcMapDavaoBoundaryVisible') !== 'false';
    let abearcMapLocationMarker = null;
    let abearcMapBasemap = localStorage.getItem('abearcMapBasemap') || 'google-satellite';
    const ABEARC_MAP_LAYER_NAMES = {
      'google-satellite': 'Satellite',
      zoning: 'Zoning',
      'google-terrain': 'Terrain',
      'open-topo': 'TopoMap'
    };
    let abearcMapLayerLabels = (() => {
      const defaults = { 'google-satellite': true, zoning: true, 'google-terrain': true, 'open-topo': false };
      try {
        const saved = JSON.parse(localStorage.getItem('abearcMapLayerLabels') || 'null');
        if (saved && typeof saved === 'object') Object.keys(defaults).forEach(key => { if (typeof saved[key] === 'boolean') defaults[key] = saved[key]; });
        else if (localStorage.getItem('abearcZoningLabelsVisible') === 'false') defaults.zoning = false;
      } catch (_) {}
      return defaults;
    })();
    let abearcZoningLabelsAbort = null;
    let abearcZoningLabelsTimer = null;
    let abearcMapPhotoSelectionMode = false;
    const abearcMapSelectedPhotoIds = new Set();
    const ABEARC_DAVAO_CITY_BOUNDS = [[125.223472, 6.960937], [125.681018, 7.565447]];
    const ABEARC_PHILIPPINES_CLIMATE_BOUNDS = [[116.0, 4.0], [127.0, 22.0]];
    const abearcChirpsSavedState = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('abearcMapChirps') || 'null');
        return saved && typeof saved === 'object' ? saved : {};
      } catch (_) {
        return {};
      }
    })();
    let abearcChirpsConfig = null;
    let abearcChirpsConfigPromise = null;
    let abearcChirpsPreparing = false;
    let abearcChirpsEnabled = Boolean(abearcChirpsSavedState.enabled);
    let abearcChirpsStartDate = String(abearcChirpsSavedState.start || '');
    let abearcChirpsEndDate = String(abearcChirpsSavedState.end || '');
    let abearcChirpsOpacity = Math.max(0.2, Math.min(1, Number(abearcChirpsSavedState.opacity) || 0.7));
    const abearcTerraClimateSavedState = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('abearcMapTerraClimate') || 'null');
        return saved && typeof saved === 'object' ? saved : {};
      } catch (_) {
        return {};
      }
    })();
    let abearcTerraClimateConfig = null;
    let abearcTerraClimateConfigPromise = null;
    let abearcTerraClimatePreparing = false;
    let abearcTerraClimateEnabled = Boolean(abearcTerraClimateSavedState.enabled);
    let abearcTerraClimateStartDate = String(abearcTerraClimateSavedState.start || '');
    let abearcTerraClimateEndDate = String(abearcTerraClimateSavedState.end || '');
    let abearcTerraClimateOpacity = Math.max(0.2, Math.min(1, Number(abearcTerraClimateSavedState.opacity) || 0.7));
    let abearcClimateGraphPopup = null;
    const ABEARC_NOAH_FLOOD_PMTILES_URL = 'https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/resolve/main/PMTiles/layers/flood_100yr.pmtiles';
    let abearcNoahFloodEnabled = localStorage.getItem('abearcMapNoahFloodEnabled') === 'true';
    let abearcNoahFloodOpacity = Math.max(0.2, Math.min(0.9, Number(localStorage.getItem('abearcMapNoahFloodOpacity')) || 0.58));
    let abearcNoahFloodProtocol = null;
    let abearcNoahFloodProtocolReady = false;
    let abearcNoahFloodPopup = null;

    // Climate overlays are intentionally exclusive. Prefer the most recently
    // introduced temperature layer when old saved state has both enabled.
    if (abearcChirpsEnabled && abearcTerraClimateEnabled) abearcChirpsEnabled = false;

    function abearcMapCameraStorageKey() {
      return `abearcMapCamera:${currentUser?.id || 'default'}`;
    }

    function abearcMapMeasureStorageKey() {
      return `abearcMapMeasure:${currentUser?.id || 'default'}`;
    }

    function restoreAbearcMapMeasure() {
      const owner = String(currentUser?.id || 'default');
      if (abearcMapMeasureStorageOwner === owner) return;
      abearcMapMeasureStorageOwner = owner;
      abearcMapMeasureMode = 'off';
      abearcMapMeasurePoints = [];
      try {
        const saved = JSON.parse(localStorage.getItem(abearcMapMeasureStorageKey()) || 'null');
        if (!['distance', 'area'].includes(saved?.mode) || !Array.isArray(saved?.points)) return;
        const points = saved.points.slice(0, 1000).map(point => [Number(point?.[0]), Number(point?.[1])]);
        if (points.some(point => !Number.isFinite(point[0]) || point[0] < -180 || point[0] > 180
            || !Number.isFinite(point[1]) || point[1] < -90 || point[1] > 90)) return;
        abearcMapMeasureMode = saved.mode;
        abearcMapMeasurePoints = points;
      } catch (_) {}
    }

    function saveAbearcMapMeasure() {
      try {
        if (!['distance', 'area'].includes(abearcMapMeasureMode) || !abearcMapMeasurePoints.length) {
          localStorage.removeItem(abearcMapMeasureStorageKey());
          return;
        }
        localStorage.setItem(abearcMapMeasureStorageKey(), JSON.stringify({
          mode: abearcMapMeasureMode,
          points: abearcMapMeasurePoints
        }));
      } catch (_) {}
    }

    function removeSavedAbearcMapMeasure() {
      try { localStorage.removeItem(abearcMapMeasureStorageKey()); } catch (_) {}
    }

    function readAbearcMapCamera() {
      try {
        const saved = JSON.parse(localStorage.getItem(abearcMapCameraStorageKey()) || 'null');
        const longitude = Number(saved?.longitude);
        const latitude = Number(saved?.latitude);
        const zoom = Number(saved?.zoom);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
        if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) return null;
        return {
          center: [longitude, latitude],
          zoom,
          bearing: Number.isFinite(Number(saved?.bearing)) ? Number(saved.bearing) : 0,
          pitch: Number.isFinite(Number(saved?.pitch)) ? Number(saved.pitch) : 0
        };
      } catch (_) {
        return null;
      }
    }

    function saveAbearcMapCamera() {
      if (!abearcMap) return;
      try {
        const center = abearcMap.getCenter();
        localStorage.setItem(abearcMapCameraStorageKey(), JSON.stringify({
          longitude: center.lng,
          latitude: center.lat,
          zoom: abearcMap.getZoom(),
          bearing: abearcMap.getBearing(),
          pitch: abearcMap.getPitch()
        }));
      } catch (_) {}
    }
    function abearcMapBasemapStyle(kind = abearcMapBasemap) {
      const basemaps = {
        'google-terrain': {
          attribution: 'Map data &copy; Google',
          tiles: [
            'https://mt0.google.com/vt/lyrs=t&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=t&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=t&x={x}&y={y}&z={z}'
          ]
        },
        'google-satellite': {
          attribution: 'Imagery &copy; Google',
          tiles: [
            'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
          ]
        },
        'open-topo': {
          attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
          tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
          ],
          maxzoom: 17
        }
      };
      const selected = basemaps[kind] || basemaps['google-satellite'];
      const zoningSelected = kind === 'zoning';
      const labelsVisible = abearcMapLayerLabels[kind] !== false;
      const zoningTileUrl = `${API}/map/zoning-tiles/{z}/{x}/{y}.png?token=${encodeURIComponent(authToken || '')}`;
      const googleLabelTiles = [0, 1, 2, 3].map(index => `https://mt${index}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}`);
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'abearc-basemap': {
            type: 'raster',
            tiles: selected.tiles,
            tileSize: 256,
            attribution: selected.attribution,
            maxzoom: selected.maxzoom || 20
          },
          ...(zoningSelected ? {
            'abearc-zoning': {
              type: 'raster',
              tiles: [zoningTileUrl],
              tileSize: 256,
              attribution: 'Davao City zoning data',
              minzoom: 9,
              maxzoom: 20
            },
            'abearc-zoning-labels': {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] }
            }
          } : {
            'abearc-area-labels': {
              type: 'raster',
              tiles: googleLabelTiles,
              tileSize: 256,
              attribution: 'Labels &copy; Google',
              minzoom: 3,
              maxzoom: 20
            }
          })
        },
        layers: [
          {
            id: 'abearc-basemap',
            type: 'raster',
            source: 'abearc-basemap'
          },
          ...(zoningSelected ? [{
            id: 'abearc-zoning',
            type: 'raster',
            source: 'abearc-zoning'
          }, {
            id: 'abearc-zoning-labels',
            type: 'symbol',
            source: 'abearc-zoning-labels',
            minzoom: 9,
            layout: {
              visibility: labelsVisible ? 'visible' : 'none',
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Regular'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9.5, 13, 10.5, 17, 12],
              'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
              'text-radial-offset': 0.35,
              'text-justify': 'auto',
              'text-max-width': 14,
              'text-padding': 8,
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'text-optional': true,
              'symbol-sort-key': ['-', ['get', 'priority']]
            },
            paint: {
              'text-color': '#15222b',
              'text-halo-color': 'rgba(255,255,255,0.94)',
              'text-halo-width': 1.4,
              'text-halo-blur': 0.35
            }
          }] : [{
            id: 'abearc-area-labels',
            type: 'raster',
            source: 'abearc-area-labels',
            layout: { visibility: labelsVisible ? 'visible' : 'none' },
            paint: { 'raster-opacity': 0.92 }
          }])
        ]
      };
    }

    async function showAbearcMap(pushHistory = true) {
      if (!currentUser) return showAuthView();
      if (!hasPrivilege('view_abearc_map')) return toast('Permission denied: view_abearc_map', 'error');
      if (!restoringHistoryState && !(await confirmLeaveRequirementsConfig())) return;
      if (appCurrentView === 'dashboard' && !restoringHistoryState) replaceAppHistory('dashboard');
      navigateTo('map', {}, pushHistory);
      const mapShell = document.querySelector('#mapPage .abearc-map-shell');
      const mapRail = document.querySelector('#mapPage .abearc-map-side-rail');
      const resultsPanel = document.querySelector('#mapPage [data-map-results-panel]');
      if (mapShell && mapRail && resultsPanel && mapRail.parentElement !== mapShell) {
        mapShell.insertBefore(mapRail, resultsPanel);
      }
      syncAbearcMapBasemapControl();
      restoreAbearcMapMeasure();
      await ensureAbearcMap();
      renderAbearcMapMeasure();
      setTimeout(() => {
        if (abearcChirpsEnabled && !abearcChirpsPreparing) prepareAbearcChirpsDataset({ silent: true });
        if (abearcTerraClimateEnabled && !abearcTerraClimatePreparing) prepareAbearcTerraClimateDataset({ silent: true });
      }, 0);
      setTimeout(() => abearcMap?.resize(), 60);
      reloadAbearcMap();
      startAbearcMapAutoSync();
    }

    async function showAbearcMapLocation(latitude, longitude, label = 'Monitoring asset') {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        toast('This monitoring record does not have valid coordinates.', 'error');
        return false;
      }
      await showAbearcMap();
      if (appCurrentView !== 'map' || !abearcMap || typeof maplibregl === 'undefined') return false;

      abearcMapLocationMarker?.remove();
      const popupContent = document.createElement('div');
      const title = document.createElement('strong');
      const coordinates = document.createElement('div');
      title.textContent = label || 'Monitoring asset';
      coordinates.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      coordinates.style.marginTop = '0.25rem';
      coordinates.style.fontSize = '0.75rem';
      popupContent.append(title, coordinates);

      const popup = new maplibregl.Popup({ offset: 28, closeButton: true }).setDOMContent(popupContent);
      abearcMapLocationMarker = new maplibregl.Marker({ color: '#0e7490' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(abearcMap);
      abearcMapLocationMarker.togglePopup();
      abearcMap.flyTo({ center: [lng, lat], zoom: Math.max(16, abearcMap.getZoom()), bearing: 0, pitch: 0, essential: true });
      setTimeout(() => abearcMap?.resize(), 60);
      return true;
    }

    async function ensureAbearcMap() {
      if (!abearcMapConfig) {
        abearcMapConfig = await fetchJson(`${API}/map/config`, { silentLoading: true });
        populateMapFilterOptions();
      }
      if (typeof maplibregl === 'undefined' && window.abearcMapLibreReady) {
        try {
          await window.abearcMapLibreReady;
        } catch (_) {
          document.getElementById('abearcMapBasemapError')?.classList.remove('hidden');
        }
      }
      if (abearcMap || typeof maplibregl === 'undefined') return;
      const savedCamera = readAbearcMapCamera();
      abearcMap = new maplibregl.Map({
        container: 'abearcMapCanvas',
        style: abearcMapBasemapStyle(),
        center: savedCamera?.center || abearcMapConfig.defaultCenter,
        zoom: savedCamera?.zoom ?? abearcMapConfig.defaultZoom,
        bearing: savedCamera?.bearing || 0,
        pitch: savedCamera?.pitch || 0,
        attributionControl: false
      });
      abearcMap.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
      abearcMap.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }), 'top-right');
      abearcMap.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: 'metric' }), 'bottom-right');
      abearcMap.on('error', event => {
        if (event?.sourceId || event?.tile) return;
        clearTimeout(abearcMapStyleErrorTimer);
        abearcMapStyleErrorTimer = setTimeout(() => {
          if (!abearcMap?.isStyleLoaded()) document.getElementById('abearcMapBasemapError')?.classList.remove('hidden');
        }, 1200);
      });
      abearcMap.on('load', () => {
        scheduleAbearcMapLayerSetup();
        setTimeout(() => abearcMap?.resize(), 50);
      });
      abearcMap.on('style.load', () => {
        clearTimeout(abearcMapStyleErrorTimer);
        document.getElementById('abearcMapBasemapError')?.classList.add('hidden');
        scheduleAbearcMapLayerSetup();
        scheduleAbearcZoningLabelsReload(0);
      });
      abearcMap.on('idle', () => document.getElementById('abearcMapBasemapError')?.classList.add('hidden'));
      abearcMap.on('resize', () => {
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('movestart', () => {
        const center = abearcMap.getCenter();
        abearcMapStartMovePoint = abearcMap.project(center);
      });
      abearcMap.on('move', () => {
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('zoom', () => {
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('rotate', () => {
        scheduleAbearcMapMarkerRender();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('moveend', () => {
        saveAbearcMapCamera();
        collapseAbearcMapExplosionForMovement();
        scheduleAbearcMapMarkerRender();
        renderAbearcMapList();
        renderAbearcMapMeasure();
        if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
        scheduleAbearcZoningLabelsReload(100);
      });
      abearcMap.on('zoomend', () => {
        scheduleAbearcZoningLabelsReload(80);
        renderAbearcMapList();
        if (abearcMapExploded?.collapseOnZoomOut && abearcMap.getZoom() < (Number(abearcMapExploded.zoom) - 0.05)) {
          collapseAbearcMapExplosion();
          renderAbearcMapMeasure();
          if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
          return;
        }
        scheduleAbearcMapMarkerRender();
        if (abearcMapExploded) renderAbearcMapExplosion();
        renderAbearcMapMeasure();
        if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
      });
      abearcMap.on('click', handleAbearcMapClick);
    }

    function syncAbearcMapBasemapControl() {
      const layerDetails = {
        'google-terrain': { label: 'Terrain', preview: 'abearc-map-layer-preview--terrain' },
        'google-satellite': { label: 'Satellite', preview: 'abearc-map-layer-preview--satellite' },
        zoning: { label: 'Zoning', preview: 'abearc-map-layer-preview--zoning' },
        'open-topo': { label: 'TopoMap', preview: 'abearc-map-layer-preview--topomap' }
      };
      const selectedLayer = layerDetails[abearcMapBasemap] || layerDetails['google-satellite'];
      const thumbnail = document.querySelector('[data-map-layer-thumbnail]');
      const quickThumbnail = document.querySelector('[data-map-quick-thumbnail]');
      const label = document.querySelector('[data-map-layer-label]');
      if (thumbnail) {
        Object.values(layerDetails).forEach(layer => thumbnail.classList.toggle(layer.preview, layer === selectedLayer));
      }
      if (quickThumbnail) {
        Object.values(layerDetails).forEach(layer => quickThumbnail.classList.toggle(layer.preview, layer === selectedLayer));
      }
      const quickLabel = document.querySelector('[data-map-quick-label]');
      if (quickLabel) quickLabel.textContent = selectedLayer.label;
      if (label) label.textContent = 'Layers';
      const button = document.getElementById('abearcMapBasemapSelect');
      if (button) {
        const selectedLabel = selectedLayer.label;
        button.title = `Layers: ${selectedLabel} basemap`;
        button.setAttribute('aria-label', `Layers, ${selectedLabel} basemap selected`);
      }
      document.querySelectorAll('[data-map-basemap]').forEach(button => {
        const selected = button.dataset.mapBasemap === abearcMapBasemap;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-checked', String(selected));
      });
      syncAbearcMapPhotoVisibilityControl();
      syncAbearcDavaoBoundaryControl();
      syncAbearcNoahFloodControls();
    }

    function toggleAbearcQuickLayers(forceOpen = null) {
      const menu = document.querySelector('.abearc-map-quick-layers');
      const button = document.querySelector('[data-map-quick-layer-toggle]');
      if (!menu || !button) return;
      const open = forceOpen == null ? menu.classList.contains('hidden') : Boolean(forceOpen);
      menu.classList.toggle('hidden', !open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', `${open ? 'Close' : 'Open'} layers`);
    }

    function syncAbearcMapLayerCount() {
      const count = [abearcMapPhotosVisible, abearcDavaoBoundaryVisible, abearcNoahFloodEnabled, abearcChirpsEnabled, abearcTerraClimateEnabled]
        .filter(Boolean).length;
      const output = document.querySelector('[data-map-layer-count]');
      if (output) {
        output.textContent = String(count);
        output.setAttribute('aria-label', `${count} active map layer${count === 1 ? '' : 's'}`);
      }
    }

    function syncAbearcMapPhotoVisibilityControl() {
      const toggle = document.querySelector('[data-map-photo-visibility-toggle]');
      if (toggle) toggle.checked = abearcMapPhotosVisible;
      const control = document.querySelector('[data-map-photo-visibility-control]');
      if (control) control.setAttribute('aria-checked', String(abearcMapPhotosVisible));
      syncAbearcMapLayerCount();
    }

    function setAbearcMapPhotosVisible(visible) {
      abearcMapPhotosVisible = Boolean(visible);
      localStorage.setItem('abearcMapPhotosVisible', String(abearcMapPhotosVisible));
      syncAbearcMapPhotoVisibilityControl();
      if (!abearcMapPhotosVisible) {
        collapseAbearcMapExplosion({ animate: false });
        clearAbearcMapPhotoMarkers();
        renderAbearcMapMovedPhotoLeaders();
        renderAbearcMapExplosion();
        toast('Geotag photos hidden from the map.');
        return;
      }
      scheduleAbearcMapMarkerRender();
      toast('Geotag photos shown on the map.');
    }

    function syncAbearcDavaoBoundaryControl() {
      const toggle = document.querySelector('[data-map-davao-boundary-toggle]');
      const control = document.querySelector('[data-map-davao-boundary-control]');
      if (toggle) toggle.checked = abearcDavaoBoundaryVisible;
      if (control) control.setAttribute('aria-checked', String(abearcDavaoBoundaryVisible));
      syncAbearcMapLayerCount();
    }

    function setAbearcDavaoBoundaryVisible(visible) {
      abearcDavaoBoundaryVisible = Boolean(visible);
      localStorage.setItem('abearcMapDavaoBoundaryVisible', String(abearcDavaoBoundaryVisible));
      ['abearc-davao-boundary-fill', 'abearc-davao-boundary-line'].forEach(layerId => {
        if (abearcMap?.getLayer(layerId)) abearcMap.setLayoutProperty(layerId, 'visibility', abearcDavaoBoundaryVisible ? 'visible' : 'none');
      });
      syncAbearcDavaoBoundaryControl();
      toast(`Davao City boundary ${abearcDavaoBoundaryVisible ? 'shown' : 'hidden'}.`);
    }

    function toggleAbearcMapLayerMenu(forceOpen = null) {
      const menu = document.querySelector('.abearc-map-layer-menu');
      const button = document.getElementById('abearcMapBasemapSelect');
      if (!menu) return;
      closeAbearcMapLayerLabelMenu();
      const open = forceOpen == null ? menu.classList.contains('hidden') : Boolean(forceOpen);
      menu.classList.toggle('hidden', !open);
      button?.setAttribute('aria-expanded', String(open));
      if (open) {
        syncAbearcMapPhotoVisibilityControl();
        syncAbearcDavaoBoundaryControl();
        syncAbearcNoahFloodControls();
        loadAbearcChirpsConfig();
        loadAbearcTerraClimateConfig();
      }
    }

    function setAbearcMapBasemap(kind) {
      if (!['google-terrain', 'google-satellite', 'zoning', 'open-topo'].includes(kind)) return;
      abearcMapBasemap = kind;
      localStorage.setItem('abearcMapBasemap', kind);
      syncAbearcMapBasemapControl();
      toggleAbearcMapLayerMenu(false);
      closeAbearcMapLayerLabelMenu();
      if (!(abearcMapAltHeld && abearcMapExploded?.collapseOnAltRelease)) collapseAbearcMapExplosion();
      if (!abearcMap) return;
      document.getElementById('abearcMapBasemapError')?.classList.add('hidden');
      abearcMap.setStyle(abearcMapBasemapStyle(kind));
      setTimeout(() => abearcMap?.resize(), 80);
    }

    function abearcMapCurrentBasemap() {
      return abearcMapBasemap;
    }

    function abearcChirpsDate(value) {
      const text = String(value || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
      const date = new Date(`${text}T00:00:00.000Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? date : null;
    }

    function abearcChirpsAddDays(value, days) {
      const date = abearcChirpsDate(value);
      if (!date) return '';
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }

    function saveAbearcChirpsState() {
      try {
        localStorage.setItem('abearcMapChirps', JSON.stringify({
          enabled: abearcChirpsEnabled,
          start: abearcChirpsStartDate,
          end: abearcChirpsEndDate,
          opacity: abearcChirpsOpacity
        }));
      } catch (_) {}
    }

    function setAbearcChirpsStatus(text, state = '') {
      const status = document.getElementById('abearcChirpsStatus');
      if (!status) return;
      status.textContent = text;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    }

    function syncAbearcClimateBadge() {
      document.querySelector('[data-map-climate-panel="chirps"]')?.classList.toggle('is-enabled', abearcChirpsEnabled);
      document.querySelector('[data-map-climate-panel="terraclimate"]')?.classList.toggle('is-enabled', abearcTerraClimateEnabled);
      syncAbearcMapLayerCount();
    }

    function syncAbearcChirpsControls() {
      const startInput = document.getElementById('abearcChirpsStartDate');
      const endInput = document.getElementById('abearcChirpsEndDate');
      const toggle = document.getElementById('abearcChirpsToggle');
      const opacity = document.getElementById('abearcChirpsOpacity');
      const opacityValue = document.getElementById('abearcChirpsOpacityValue');
      if (abearcChirpsConfig) {
        [startInput, endInput].forEach(input => {
          if (!input) return;
          input.min = abearcChirpsConfig.min_date;
          input.max = abearcChirpsConfig.latest_date;
        });
      }
      if (startInput && abearcChirpsStartDate) startInput.value = abearcChirpsStartDate;
      if (endInput && abearcChirpsEndDate) endInput.value = abearcChirpsEndDate;
      if (toggle) toggle.checked = abearcChirpsEnabled;
      if (opacity) opacity.value = String(Math.round(abearcChirpsOpacity * 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(abearcChirpsOpacity * 100)}%`;
      syncAbearcClimateBadge();
    }

    async function loadAbearcChirpsConfig(force = false) {
      if (abearcChirpsConfig && !force) return abearcChirpsConfig;
      if (abearcChirpsConfigPromise && !force) return abearcChirpsConfigPromise;
      setAbearcChirpsStatus('Checking availability…');
      abearcChirpsConfigPromise = fetchJson(`${API}/map/chirps/config`, { silentLoading: true })
        .then(config => {
          abearcChirpsConfig = config;
          const savedStartValid = abearcChirpsDate(abearcChirpsStartDate)
            && abearcChirpsStartDate >= config.min_date && abearcChirpsStartDate <= config.latest_date;
          const savedEndValid = abearcChirpsDate(abearcChirpsEndDate)
            && abearcChirpsEndDate >= config.min_date && abearcChirpsEndDate <= config.latest_date;
          if (!savedStartValid || !savedEndValid || abearcChirpsStartDate > abearcChirpsEndDate) {
            abearcChirpsStartDate = config.default_start;
            abearcChirpsEndDate = config.default_end;
          }
          saveAbearcChirpsState();
          syncAbearcChirpsControls();
          setAbearcChirpsStatus(`Available through ${config.latest_date}`, 'ready');
          scheduleAbearcMapLayerSetup();
          return config;
        })
        .catch(error => {
          console.warn('Unable to load CHIRPS configuration:', error);
          abearcChirpsEnabled = false;
          syncAbearcChirpsControls();
          setAbearcChirpsStatus('Availability check failed', 'error');
          return null;
        })
        .finally(() => { abearcChirpsConfigPromise = null; });
      return abearcChirpsConfigPromise;
    }

    function removeAbearcChirpsLayer() {
      if (!abearcMap) return;
      if (abearcMap.getLayer('abearc-chirps-rainfall')) abearcMap.removeLayer('abearc-chirps-rainfall');
      if (abearcMap.getSource('abearc-chirps-rainfall')) abearcMap.removeSource('abearc-chirps-rainfall');
    }

    function setupAbearcChirpsLayer() {
      if (!abearcMap || !abearcChirpsEnabled || !abearcChirpsConfig
          || !abearcChirpsStartDate || !abearcChirpsEndDate) return;
      if (!abearcMap.getSource('abearc-chirps-rainfall')) {
        const params = new URLSearchParams({
          start: abearcChirpsStartDate,
          end: abearcChirpsEndDate,
          token: authToken || ''
        });
        abearcMap.addSource('abearc-chirps-rainfall', {
          type: 'raster',
          tiles: [`${API}/map/chirps-tiles/{z}/{x}/{y}.png?${params.toString()}`],
          tileSize: 256,
          minzoom: Number(abearcChirpsConfig.min_zoom || 5),
          maxzoom: Number(abearcChirpsConfig.max_zoom || 12),
          bounds: abearcChirpsConfig.bounds,
          attribution: 'CHIRPS v3 precipitation © Climate Hazards Center, UC Santa Barbara'
        });
      }
      if (!abearcMap.getLayer('abearc-chirps-rainfall')) {
        const beforeId = abearcMap.getLayer('abearc-davao-boundary-fill') ? 'abearc-davao-boundary-fill' : undefined;
        abearcMap.addLayer({
          id: 'abearc-chirps-rainfall',
          type: 'raster',
          source: 'abearc-chirps-rainfall',
          paint: {
            'raster-opacity': abearcChirpsOpacity,
            'raster-resampling': 'nearest',
            'raster-fade-duration': 120
          }
        }, beforeId);
      }
    }

    function refreshAbearcChirpsLayer() {
      if (!abearcMap || (typeof abearcMap.isStyleLoaded === 'function' && !abearcMap.isStyleLoaded())) return;
      removeAbearcChirpsLayer();
      setupAbearcChirpsLayer();
    }

    function setAbearcChirpsOpacity(value) {
      abearcChirpsOpacity = Math.max(0.2, Math.min(1, Number(value) / 100 || 0.7));
      const output = document.getElementById('abearcChirpsOpacityValue');
      if (output) output.textContent = `${Math.round(abearcChirpsOpacity * 100)}%`;
      if (abearcMap?.getLayer('abearc-chirps-rainfall')) {
        abearcMap.setPaintProperty('abearc-chirps-rainfall', 'raster-opacity', abearcChirpsOpacity);
      }
      saveAbearcChirpsState();
    }

    async function prepareAbearcChirpsDataset({ silent = false } = {}) {
      const config = await loadAbearcChirpsConfig();
      if (!config || abearcChirpsPreparing) return false;
      const startInput = document.getElementById('abearcChirpsStartDate');
      const endInput = document.getElementById('abearcChirpsEndDate');
      const start = String(startInput?.value || abearcChirpsStartDate || '');
      const end = String(endInput?.value || abearcChirpsEndDate || '');
      const startDate = abearcChirpsDate(start);
      const endDate = abearcChirpsDate(end);
      if (!startDate || !endDate || start > end) {
        setAbearcChirpsStatus('Choose a valid date range', 'error');
        if (!silent) toast('Choose a valid CHIRPS start and end date.', 'error');
        return false;
      }
      const days = Math.floor((endDate - startDate) / 86400000) + 1;
      if (start < config.min_date || end > config.latest_date || days > Number(config.max_range_days || 1826)) {
        const message = end > config.latest_date
          ? `Final CHIRPS data is available through ${config.latest_date}.`
          : `Select no more than ${Number(config.max_range_days || 1826).toLocaleString()} days.`;
        setAbearcChirpsStatus(message, 'error');
        if (!silent) toast(message, 'error');
        return false;
      }
      abearcChirpsPreparing = true;
      const applyButton = document.getElementById('abearcChirpsApply');
      if (applyButton) applyButton.disabled = true;
      setAbearcChirpsStatus(`Preparing ${days.toLocaleString()} day${days === 1 ? '' : 's'}…`);
      try {
        const params = new URLSearchParams({ start, end });
        const result = await fetchJson(`${API}/map/chirps/prepare?${params}`, { silentLoading: true });
        abearcChirpsStartDate = start;
        abearcChirpsEndDate = end;
        abearcTerraClimateEnabled = false;
        removeAbearcTerraClimateLayer();
        saveAbearcTerraClimateState();
        syncAbearcTerraClimateControls();
        abearcChirpsEnabled = true;
        saveAbearcChirpsState();
        syncAbearcChirpsControls();
        refreshAbearcChirpsLayer();
        refreshAbearcOpenClimateGraph();
        const mean = Number(result?.stats?.mean_mm);
        const max = Number(result?.stats?.max_mm);
        const summary = Number.isFinite(mean) && Number.isFinite(max)
          ? `Mean ${mean.toFixed(1)} mm · Max ${max.toFixed(1)} mm`
          : `${days.toLocaleString()} days ready`;
        setAbearcChirpsStatus(summary, 'ready');
        if (!silent) toast(`CHIRPS rainfall layer updated: ${start} to ${end}.`);
        return true;
      } catch (error) {
        console.warn('Unable to prepare CHIRPS rainfall:', error);
        syncAbearcChirpsControls();
        setAbearcChirpsStatus(error?.message || 'Rainfall layer failed', 'error');
        if (!silent) toast(error?.message || 'Unable to load CHIRPS rainfall for the selected dates.', 'error');
        return false;
      } finally {
        abearcChirpsPreparing = false;
        if (applyButton) applyButton.disabled = false;
      }
    }

    function applyAbearcChirpsRange() {
      return prepareAbearcChirpsDataset({ silent: false });
    }

    function setAbearcChirpsEnabled(enabled) {
      if (!enabled) {
        abearcChirpsEnabled = false;
        removeAbearcChirpsLayer();
        saveAbearcChirpsState();
        syncAbearcChirpsControls();
        setAbearcChirpsStatus(abearcChirpsConfig ? `Available through ${abearcChirpsConfig.latest_date}` : 'Rainfall overlay hidden');
        if (!abearcTerraClimateEnabled) abearcClimateGraphPopup?.remove();
        return;
      }
      abearcTerraClimateEnabled = false;
      removeAbearcTerraClimateLayer();
      saveAbearcTerraClimateState();
      abearcChirpsEnabled = true;
      saveAbearcChirpsState();
      syncAbearcTerraClimateControls();
      syncAbearcChirpsControls();
      abearcClimateGraphPopup?.remove();
      prepareAbearcChirpsDataset({ silent: false });
    }

    function setAbearcChirpsPreset(days) {
      const endInput = document.getElementById('abearcChirpsEndDate');
      const startInput = document.getElementById('abearcChirpsStartDate');
      const end = String(endInput?.value || abearcChirpsConfig?.latest_date || abearcChirpsEndDate || '');
      const start = abearcChirpsAddDays(end, -(Math.max(1, Number(days) || 1) - 1));
      if (endInput) endInput.value = end;
      if (startInput) startInput.value = start < (abearcChirpsConfig?.min_date || '') ? abearcChirpsConfig.min_date : start;
      applyAbearcChirpsRange();
    }

    function saveAbearcTerraClimateState() {
      try {
        localStorage.setItem('abearcMapTerraClimate', JSON.stringify({
          enabled: abearcTerraClimateEnabled,
          start: abearcTerraClimateStartDate,
          end: abearcTerraClimateEndDate,
          opacity: abearcTerraClimateOpacity
        }));
      } catch (_) {}
    }

    function setAbearcTerraClimateStatus(text, state = '') {
      const status = document.getElementById('abearcTerraClimateStatus');
      if (!status) return;
      status.textContent = text;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    }

    function syncAbearcTerraClimateControls() {
      const startInput = document.getElementById('abearcTerraClimateStartDate');
      const endInput = document.getElementById('abearcTerraClimateEndDate');
      const toggle = document.getElementById('abearcTerraClimateToggle');
      const opacity = document.getElementById('abearcTerraClimateOpacity');
      const opacityValue = document.getElementById('abearcTerraClimateOpacityValue');
      if (abearcTerraClimateConfig) {
        [startInput, endInput].forEach(input => {
          if (!input) return;
          input.min = abearcTerraClimateConfig.min_date;
          input.max = abearcTerraClimateConfig.latest_date;
        });
      }
      if (startInput && abearcTerraClimateStartDate) startInput.value = abearcTerraClimateStartDate;
      if (endInput && abearcTerraClimateEndDate) endInput.value = abearcTerraClimateEndDate;
      if (toggle) toggle.checked = abearcTerraClimateEnabled;
      if (opacity) opacity.value = String(Math.round(abearcTerraClimateOpacity * 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(abearcTerraClimateOpacity * 100)}%`;
      syncAbearcClimateBadge();
    }

    async function loadAbearcTerraClimateConfig(force = false) {
      if (abearcTerraClimateConfig && !force) return abearcTerraClimateConfig;
      if (abearcTerraClimateConfigPromise && !force) return abearcTerraClimateConfigPromise;
      setAbearcTerraClimateStatus('Checking availability…');
      abearcTerraClimateConfigPromise = fetchJson(`${API}/map/terraclimate/config`, { silentLoading: true })
        .then(config => {
          abearcTerraClimateConfig = config;
          const savedStartValid = abearcChirpsDate(abearcTerraClimateStartDate)
            && abearcTerraClimateStartDate >= config.min_date && abearcTerraClimateStartDate <= config.latest_date;
          const savedEndValid = abearcChirpsDate(abearcTerraClimateEndDate)
            && abearcTerraClimateEndDate >= config.min_date && abearcTerraClimateEndDate <= config.latest_date;
          if (!savedStartValid || !savedEndValid || abearcTerraClimateStartDate > abearcTerraClimateEndDate) {
            abearcTerraClimateStartDate = config.default_start;
            abearcTerraClimateEndDate = config.default_end;
          }
          saveAbearcTerraClimateState();
          syncAbearcTerraClimateControls();
          setAbearcTerraClimateStatus(`Available through ${config.latest_date}`, 'ready');
          scheduleAbearcMapLayerSetup();
          return config;
        })
        .catch(error => {
          console.warn('Unable to load TerraClimate configuration:', error);
          abearcTerraClimateEnabled = false;
          syncAbearcTerraClimateControls();
          setAbearcTerraClimateStatus('Availability check failed', 'error');
          return null;
        })
        .finally(() => { abearcTerraClimateConfigPromise = null; });
      return abearcTerraClimateConfigPromise;
    }

    function removeAbearcTerraClimateLayer() {
      if (!abearcMap) return;
      if (abearcMap.getLayer('abearc-terraclimate-temperature')) abearcMap.removeLayer('abearc-terraclimate-temperature');
      if (abearcMap.getSource('abearc-terraclimate-temperature')) abearcMap.removeSource('abearc-terraclimate-temperature');
    }

    function setupAbearcTerraClimateLayer() {
      if (!abearcMap || !abearcTerraClimateEnabled || !abearcTerraClimateConfig
          || !abearcTerraClimateStartDate || !abearcTerraClimateEndDate) return;
      if (!abearcMap.getSource('abearc-terraclimate-temperature')) {
        const params = new URLSearchParams({
          start: abearcTerraClimateStartDate,
          end: abearcTerraClimateEndDate,
          token: authToken || ''
        });
        abearcMap.addSource('abearc-terraclimate-temperature', {
          type: 'raster',
          tiles: [`${API}/map/terraclimate-tiles/{z}/{x}/{y}.png?${params.toString()}`],
          tileSize: 256,
          minzoom: Number(abearcTerraClimateConfig.min_zoom || 5),
          maxzoom: Number(abearcTerraClimateConfig.max_zoom || 12),
          bounds: abearcTerraClimateConfig.bounds,
          attribution: 'TerraClimate temperature © Climatology Lab / University of Idaho'
        });
      }
      if (!abearcMap.getLayer('abearc-terraclimate-temperature')) {
        const beforeId = abearcMap.getLayer('abearc-davao-boundary-fill') ? 'abearc-davao-boundary-fill' : undefined;
        abearcMap.addLayer({
          id: 'abearc-terraclimate-temperature',
          type: 'raster',
          source: 'abearc-terraclimate-temperature',
          paint: {
            'raster-opacity': abearcTerraClimateOpacity,
            'raster-resampling': 'nearest',
            'raster-fade-duration': 120
          }
        }, beforeId);
      }
    }

    function refreshAbearcTerraClimateLayer() {
      if (!abearcMap || (typeof abearcMap.isStyleLoaded === 'function' && !abearcMap.isStyleLoaded())) return;
      removeAbearcTerraClimateLayer();
      setupAbearcTerraClimateLayer();
    }

    function setAbearcTerraClimateOpacity(value) {
      abearcTerraClimateOpacity = Math.max(0.2, Math.min(1, Number(value) / 100 || 0.7));
      const output = document.getElementById('abearcTerraClimateOpacityValue');
      if (output) output.textContent = `${Math.round(abearcTerraClimateOpacity * 100)}%`;
      if (abearcMap?.getLayer('abearc-terraclimate-temperature')) {
        abearcMap.setPaintProperty('abearc-terraclimate-temperature', 'raster-opacity', abearcTerraClimateOpacity);
      }
      saveAbearcTerraClimateState();
    }

    function abearcTerraClimateMonthCount(start, end) {
      const startDate = abearcChirpsDate(start);
      const endDate = abearcChirpsDate(end);
      if (!startDate || !endDate || startDate > endDate) return 0;
      return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth() + 1;
    }

    async function prepareAbearcTerraClimateDataset({ silent = false } = {}) {
      const config = await loadAbearcTerraClimateConfig();
      if (!config || abearcTerraClimatePreparing) return false;
      const startInput = document.getElementById('abearcTerraClimateStartDate');
      const endInput = document.getElementById('abearcTerraClimateEndDate');
      const start = String(startInput?.value || abearcTerraClimateStartDate || '');
      const end = String(endInput?.value || abearcTerraClimateEndDate || '');
      const monthCount = abearcTerraClimateMonthCount(start, end);
      if (!monthCount) {
        setAbearcTerraClimateStatus('Choose a valid date range', 'error');
        if (!silent) toast('Choose a valid TerraClimate start and end date.', 'error');
        return false;
      }
      if (start < config.min_date || end > config.latest_date || monthCount > Number(config.max_range_months || 120)) {
        const message = end > config.latest_date
          ? `TerraClimate data is available through ${config.latest_date}.`
          : `Select no more than ${Number(config.max_range_months || 120).toLocaleString()} months.`;
        setAbearcTerraClimateStatus(message, 'error');
        if (!silent) toast(message, 'error');
        return false;
      }
      abearcTerraClimatePreparing = true;
      const applyButton = document.getElementById('abearcTerraClimateApply');
      if (applyButton) applyButton.disabled = true;
      setAbearcTerraClimateStatus(`Preparing ${monthCount} month${monthCount === 1 ? '' : 's'}…`);
      try {
        const params = new URLSearchParams({ start, end });
        const result = await fetchJson(`${API}/map/terraclimate/prepare?${params}`, { silentLoading: true });
        abearcTerraClimateStartDate = start;
        abearcTerraClimateEndDate = end;
        abearcChirpsEnabled = false;
        removeAbearcChirpsLayer();
        saveAbearcChirpsState();
        syncAbearcChirpsControls();
        abearcTerraClimateEnabled = true;
        saveAbearcTerraClimateState();
        syncAbearcTerraClimateControls();
        refreshAbearcTerraClimateLayer();
        refreshAbearcOpenClimateGraph();
        const mean = Number(result?.stats?.mean_c);
        const min = Number(result?.stats?.min_c);
        const max = Number(result?.stats?.max_c);
        const summary = Number.isFinite(mean) && Number.isFinite(min) && Number.isFinite(max)
          ? `Mean ${mean.toFixed(1)} °C · ${min.toFixed(1)}–${max.toFixed(1)} °C`
          : `${monthCount} month${monthCount === 1 ? '' : 's'} ready`;
        setAbearcTerraClimateStatus(summary, 'ready');
        if (!silent) toast(`TerraClimate temperature layer updated: ${start} to ${end}.`);
        return true;
      } catch (error) {
        console.warn('Unable to prepare TerraClimate temperature:', error);
        syncAbearcTerraClimateControls();
        setAbearcTerraClimateStatus(error?.message || 'Temperature layer failed', 'error');
        if (!silent) toast(error?.message || 'Unable to load TerraClimate temperature for the selected dates.', 'error');
        return false;
      } finally {
        abearcTerraClimatePreparing = false;
        if (applyButton) applyButton.disabled = false;
      }
    }

    function applyAbearcTerraClimateRange() {
      return prepareAbearcTerraClimateDataset({ silent: false });
    }

    function setAbearcTerraClimateEnabled(enabled) {
      if (!enabled) {
        abearcTerraClimateEnabled = false;
        removeAbearcTerraClimateLayer();
        saveAbearcTerraClimateState();
        syncAbearcTerraClimateControls();
        setAbearcTerraClimateStatus(abearcTerraClimateConfig ? `Available through ${abearcTerraClimateConfig.latest_date}` : 'Temperature overlay hidden');
        if (!abearcChirpsEnabled) abearcClimateGraphPopup?.remove();
        return;
      }
      abearcChirpsEnabled = false;
      removeAbearcChirpsLayer();
      saveAbearcChirpsState();
      abearcTerraClimateEnabled = true;
      saveAbearcTerraClimateState();
      syncAbearcChirpsControls();
      syncAbearcTerraClimateControls();
      abearcClimateGraphPopup?.remove();
      prepareAbearcTerraClimateDataset({ silent: false });
    }

    function setAbearcTerraClimatePreset(months) {
      const endInput = document.getElementById('abearcTerraClimateEndDate');
      const startInput = document.getElementById('abearcTerraClimateStartDate');
      const end = String(endInput?.value || abearcTerraClimateConfig?.latest_date || abearcTerraClimateEndDate || '');
      const endDate = abearcChirpsDate(end);
      if (!endDate) return;
      const count = Math.max(1, Number(months) || 1);
      const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - count + 1, 1));
      const start = startDate.toISOString().slice(0, 10);
      if (endInput) endInput.value = end;
      if (startInput) startInput.value = start < (abearcTerraClimateConfig?.min_date || '') ? abearcTerraClimateConfig.min_date : start;
      applyAbearcTerraClimateRange();
    }

    function syncAbearcNoahFloodControls() {
      const panel = document.querySelector('[data-map-noah-flood-panel]');
      const toggle = document.querySelector('[data-map-noah-flood-toggle]');
      const opacity = document.querySelector('[data-map-noah-flood-opacity]');
      const opacityValue = document.querySelector('[data-map-noah-flood-opacity-value]');
      panel?.classList.toggle('is-enabled', abearcNoahFloodEnabled);
      if (toggle) toggle.checked = abearcNoahFloodEnabled;
      if (opacity) opacity.value = String(Math.round(abearcNoahFloodOpacity * 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(abearcNoahFloodOpacity * 100)}%`;
      const quickButton = document.querySelector('[data-map-quick-flood]');
      quickButton?.classList.toggle('is-active', abearcNoahFloodEnabled);
      quickButton?.setAttribute('aria-pressed', String(abearcNoahFloodEnabled));
      quickButton?.setAttribute('aria-label', `${abearcNoahFloodEnabled ? 'Hide' : 'Show'} flood hazard`);
      syncAbearcMapLayerCount();
    }

    function ensureAbearcNoahFloodProtocol() {
      if (abearcNoahFloodProtocolReady) return true;
      if (typeof maplibregl === 'undefined' || !window.pmtiles?.Protocol) return false;
      abearcNoahFloodProtocol = new window.pmtiles.Protocol();
      maplibregl.addProtocol('pmtiles', abearcNoahFloodProtocol.tile);
      abearcNoahFloodProtocolReady = true;
      return true;
    }

    function removeAbearcNoahFloodLayer() {
      if (!abearcMap) return;
      if (abearcMap.getLayer('abearc-noah-flood-100yr')) abearcMap.removeLayer('abearc-noah-flood-100yr');
      if (abearcMap.getSource('abearc-noah-flood-100yr')) abearcMap.removeSource('abearc-noah-flood-100yr');
    }

    function setupAbearcNoahFloodLayer() {
      if (!abearcMap || !abearcNoahFloodEnabled || !ensureAbearcNoahFloodProtocol()) return;
      if (!abearcMap.getSource('abearc-noah-flood-100yr')) {
        abearcMap.addSource('abearc-noah-flood-100yr', {
          type: 'vector',
          url: `pmtiles://${ABEARC_NOAH_FLOOD_PMTILES_URL}`,
          attribution: 'Project NOAH / DOST-PAGASA / University of the Philippines · ODbL'
        });
      }
      if (!abearcMap.getLayer('abearc-noah-flood-100yr')) {
        const beforeId = abearcMap.getLayer('abearc-davao-boundary-fill') ? 'abearc-davao-boundary-fill' : undefined;
        abearcMap.addLayer({
          id: 'abearc-noah-flood-100yr',
          type: 'fill',
          source: 'abearc-noah-flood-100yr',
          'source-layer': 'flood_100yr',
          paint: {
            'fill-color': ['match', ['to-number', ['get', 'Var']], 1, '#facc15', 2, '#f97316', 3, '#dc2626', 'rgba(0,0,0,0)'],
            'fill-opacity': abearcNoahFloodOpacity,
            'fill-outline-color': 'rgba(127,29,29,.55)'
          }
        }, beforeId);
      }
    }

    function setAbearcNoahFloodEnabled(enabled) {
      abearcNoahFloodEnabled = Boolean(enabled);
      localStorage.setItem('abearcMapNoahFloodEnabled', String(abearcNoahFloodEnabled));
      syncAbearcNoahFloodControls();
      if (!abearcNoahFloodEnabled) {
        removeAbearcNoahFloodLayer();
        abearcNoahFloodPopup?.remove();
        return;
      }
      if (!ensureAbearcNoahFloodProtocol()) {
        abearcNoahFloodEnabled = false;
        localStorage.setItem('abearcMapNoahFloodEnabled', 'false');
        syncAbearcNoahFloodControls();
        toast('The Project NOAH layer library did not load.', 'error');
        return;
      }
      setupAbearcNoahFloodLayer();
      toast('Project NOAH 100-year flood hazard shown. Select a map point to inspect its category.');
    }

    function toggleAbearcNoahFloodLayer() {
      setAbearcNoahFloodEnabled(!abearcNoahFloodEnabled);
    }

    function setAbearcNoahFloodOpacity(value) {
      abearcNoahFloodOpacity = Math.max(0.2, Math.min(0.9, Number(value) / 100 || 0.58));
      localStorage.setItem('abearcMapNoahFloodOpacity', String(abearcNoahFloodOpacity));
      syncAbearcNoahFloodControls();
      if (abearcMap?.getLayer('abearc-noah-flood-100yr')) {
        abearcMap.setPaintProperty('abearc-noah-flood-100yr', 'fill-opacity', abearcNoahFloodOpacity);
      }
    }

    function fitAbearcClimateToPhilippines() {
      if (!abearcMap) return;
      toggleAbearcMapLayerMenu(false);
      abearcMap.fitBounds(ABEARC_PHILIPPINES_CLIMATE_BOUNDS, {
        padding: 42,
        duration: 700,
        maxZoom: 7
      });
    }

    function startAbearcClimatePointSelection() {
      if (!abearcChirpsEnabled && !abearcTerraClimateEnabled) {
        toast('Turn on a climate layer before selecting a map point.', 'error');
        return;
      }
      toggleAbearcMapLayerMenu(false);
      const canvas = abearcMap?.getCanvas?.();
      if (canvas) canvas.style.cursor = 'crosshair';
      toast('Click any location in the Philippines to view its climate graph and download data.');
    }

    function abearcClimateEnabledLayers() {
      const layers = [];
      if (abearcChirpsEnabled && abearcChirpsStartDate && abearcChirpsEndDate) {
        layers.push({ key: 'chirps', label: 'CHIRPS rainfall', start: abearcChirpsStartDate, end: abearcChirpsEndDate });
      }
      if (abearcTerraClimateEnabled && abearcTerraClimateStartDate && abearcTerraClimateEndDate) {
        layers.push({ key: 'terraclimate', label: 'TerraClimate temperature', start: abearcTerraClimateStartDate, end: abearcTerraClimateEndDate });
      }
      return layers;
    }

    function abearcClimateCsvText(data) {
      const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
      if (data?.layer === 'chirps') {
        const header = ['period_start', 'period_end', 'precipitation_mm', 'resolution', 'latitude', 'longitude'];
        const rows = (data.points || []).map(point => [point.start, point.end, point.precipitation_mm, point.resolution, data.latitude, data.longitude]);
        return [header, ...rows].map(row => row.map(quote).join(',')).join('\n');
      }
      const header = ['month', 'period_start', 'period_end', 'tmin_c', 'mean_c', 'tmax_c', 'latitude', 'longitude'];
      const rows = (data?.points || []).map(point => [point.month, point.start, point.end, point.tmin_c, point.mean_c, point.tmax_c, data.latitude, data.longitude]);
      return [header, ...rows].map(row => row.map(quote).join(',')).join('\n');
    }

    function downloadAbearcClimateCsv(container) {
      const data = container?._abearcClimateSeries;
      if (!data) return;
      const blob = new Blob([abearcClimateCsvText(data)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.layer}_${String(data.start).replaceAll('-', '')}_${String(data.end).replaceAll('-', '')}_${Number(data.latitude).toFixed(4)}_${Number(data.longitude).toFixed(4)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadAbearcClimatePng(container) {
      const canvas = container?.querySelector('canvas');
      const data = container?._abearcClimateSeries;
      if (!canvas || !data) return;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      drawAbearcClimateChart(exportCanvas, data, { forceLight: true });
      exportCanvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${data.layer}_${String(data.start).replaceAll('-', '')}_${String(data.end).replaceAll('-', '')}_${Number(data.latitude).toFixed(4)}_${Number(data.longitude).toFixed(4)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    }

    function abearcClimatePointTime(point) {
      const value = String(point?.start || (point?.month ? `${point.month}-01` : ''));
      const timestamp = Date.parse(`${value}T00:00:00Z`);
      return Number.isFinite(timestamp) ? timestamp : null;
    }

    function abearcClimateTimeAxis(points, plotWidth, rangeStart = '', rangeEnd = '') {
      const pointTimes = points.map(abearcClimatePointTime);
      const validTimes = pointTimes.filter(Number.isFinite);
      if (!validTimes.length) return null;
      const selectedStart = Date.parse(`${String(rangeStart).slice(0, 10)}T00:00:00Z`);
      const selectedEnd = Date.parse(`${String(rangeEnd).slice(0, 10)}T00:00:00Z`);
      const minimum = Math.min(...validTimes, ...(Number.isFinite(selectedStart) ? [selectedStart] : []));
      const maximum = Math.max(...validTimes, ...(Number.isFinite(selectedEnd) ? [selectedEnd] : []));
      const spanDays = Math.max(0, (maximum - minimum) / 86400000);
      const targetTicks = Math.max(2, Math.min(7, Math.floor(plotWidth / 105) + 1));
      const candidates = spanDays <= 120
        ? [
            { unit: 'day', step: 1, days: 1 },
            { unit: 'day', step: 2, days: 2 },
            { unit: 'day', step: 3, days: 3 },
            { unit: 'day', step: 7, days: 7 },
            { unit: 'day', step: 14, days: 14 },
            { unit: 'month', step: 1, days: 30.4375 }
          ]
        : spanDays <= 1461
          ? [
              { unit: 'month', step: 1, days: 30.4375 },
              { unit: 'month', step: 2, days: 60.875 },
              { unit: 'month', step: 3, days: 91.3125 },
              { unit: 'month', step: 6, days: 182.625 },
              { unit: 'year', step: 1, days: 365.25 }
            ]
          : [
              { unit: 'year', step: 1, days: 365.25 },
              { unit: 'year', step: 2, days: 730.5 },
              { unit: 'year', step: 5, days: 1826.25 },
              { unit: 'year', step: 10, days: 3652.5 }
            ];
      const interval = candidates.find(candidate => spanDays / candidate.days <= targetTicks - 1)
        || candidates.at(-1);
      const ticks = [];
      if (minimum === maximum) {
        ticks.push(minimum);
      } else {
        const cursor = new Date(minimum);
        if (interval.unit === 'day') {
          cursor.setUTCHours(0, 0, 0, 0);
          const dayNumber = Math.floor(cursor.getTime() / 86400000);
          cursor.setTime((dayNumber + (interval.step - dayNumber % interval.step) % interval.step) * 86400000);
        } else if (interval.unit === 'month') {
          cursor.setUTCDate(1);
          const monthNumber = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth();
          const alignedMonth = monthNumber + (interval.step - monthNumber % interval.step) % interval.step;
          cursor.setUTCFullYear(Math.floor(alignedMonth / 12), alignedMonth % 12, 1);
        } else {
          cursor.setUTCMonth(0, 1);
          const year = cursor.getUTCFullYear();
          cursor.setUTCFullYear(year + (interval.step - year % interval.step) % interval.step, 0, 1);
        }
        while (cursor.getTime() <= maximum && ticks.length < 20) {
          if (cursor.getTime() >= minimum) ticks.push(cursor.getTime());
          if (interval.unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + interval.step);
          else if (interval.unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + interval.step);
          else cursor.setUTCFullYear(cursor.getUTCFullYear() + interval.step);
        }
        if (!ticks.length || ticks[0] - minimum > interval.days * 86400000 * 0.45) ticks.unshift(minimum);
        if (maximum - ticks.at(-1) > interval.days * 86400000 * 0.45) ticks.push(maximum);
      }
      const format = timestamp => {
        const date = new Date(timestamp);
        if (interval.unit === 'day') {
          const options = { month: 'short', day: 'numeric', timeZone: 'UTC' };
          if (spanDays > 45 || new Date(minimum).getUTCFullYear() !== new Date(maximum).getUTCFullYear()) options.year = '2-digit';
          return date.toLocaleDateString('en-US', options);
        }
        if (interval.unit === 'month') return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        return date.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
      };
      return { pointTimes, minimum, maximum, ticks, format };
    }

    function abearcClimateSourceMetadata(data) {
      if (data?.source) return { label: data.source, url: data.source_url || '' };
      if (data?.layer === 'chirps') {
        return {
          label: 'CHIRPS / Climate Hazards Center, UC Santa Barbara',
          url: 'https://www.chc.ucsb.edu/data/chirps'
        };
      }
      if (data?.layer === 'terraclimate' && String(data?.series_resolution || '').toLowerCase().includes('daily')) {
        return {
          label: 'NASA POWER Daily API (MERRA-2 meteorology)',
          url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/'
        };
      }
      return {
        label: 'TerraClimate / Climatology Lab, University of Idaho',
        url: 'https://www.climatologylab.org/terraclimate.html'
      };
    }

    function drawAbearcClimateChart(canvas, data, { forceLight = false } = {}) {
      if (!canvas || !data) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const dark = !forceLight && (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
      ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, width, height);
      const axisColor = dark ? '#cbd5e1' : '#475569';
      const gridColor = dark ? 'rgba(148,163,184,.25)' : 'rgba(100,116,139,.22)';
      const textColor = dark ? '#e2e8f0' : '#1f2937';
      const margin = { left: 72, right: 54, top: 82, bottom: 68 };
      const plotW = width - margin.left - margin.right;
      const plotH = height - margin.top - margin.bottom;
      const points = data.points || [];
      const configuredSeries = data.layer === 'chirps'
        ? [{ key: 'precipitation_mm', label: 'Rainfall (mm)', color: '#0f6f9f' }]
        : [
            { key: 'tmin_c', label: 'Tmin', color: '#2563eb' },
            { key: 'mean_c', label: 'Mean', color: '#f59e0b' },
            { key: 'tmax_c', label: 'Tmax', color: '#dc2626' }
          ];
      const series = configuredSeries.filter(item => points.some(point => Number.isFinite(Number(point[item.key]))));
      const allValues = series.flatMap(item => points.map(point => Number(point[item.key])).filter(Number.isFinite));
      if (!allValues.length) {
        ctx.fillStyle = textColor;
        ctx.font = '24px sans-serif';
        ctx.fillText('No climate data at this point.', margin.left, height / 2);
        return;
      }
      const niceStep = (range, targetTicks = 5) => {
        const rough = Math.max(Number.EPSILON, range / Math.max(1, targetTicks));
        const magnitude = 10 ** Math.floor(Math.log10(rough));
        const normalized = rough / magnitude;
        const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
        return factor * magnitude;
      };
      const rawMin = Math.min(...allValues);
      const rawMax = Math.max(...allValues);
      const rawRange = Math.max(data.layer === 'chirps' ? rawMax : rawMax - rawMin, data.layer === 'chirps' ? 0.1 : 0.5);
      let yStep = niceStep(rawRange, 5);
      let minY = data.layer === 'chirps' ? 0 : Math.floor((rawMin - rawRange * 0.08) / yStep) * yStep;
      let maxY = Math.ceil((rawMax + rawRange * 0.08) / yStep) * yStep;
      if (maxY <= minY) maxY = minY + yStep;
      let yTickCount = Math.round((maxY - minY) / yStep);
      if (yTickCount > 7) {
        yStep = niceStep(maxY - minY, 5);
        minY = data.layer === 'chirps' ? 0 : Math.floor(minY / yStep) * yStep;
        maxY = Math.ceil(maxY / yStep) * yStep;
        yTickCount = Math.round((maxY - minY) / yStep);
      }
      const yDecimals = yStep >= 1 ? 0 : yStep >= 0.1 ? 1 : 2;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.font = '18px sans-serif';
      ctx.fillStyle = axisColor;
      for (let step = 0; step <= yTickCount; step++) {
        const ratio = step / Math.max(1, yTickCount);
        const y = margin.top + plotH * ratio;
        ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(width - margin.right, y); ctx.stroke();
        const value = maxY - (maxY - minY) * ratio;
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(yDecimals), margin.left - 10, y + 6);
      }
      const timeAxis = abearcClimateTimeAxis(points, plotW, data.start, data.end);
      const xAt = index => {
        const timestamp = timeAxis?.pointTimes?.[index];
        if (points.length <= 1) return margin.left + plotW / 2;
        if (!timeAxis || !Number.isFinite(timestamp) || timeAxis.maximum === timeAxis.minimum) {
          return margin.left + (points.length <= 1 ? plotW / 2 : plotW * index / (points.length - 1));
        }
        return margin.left + plotW * (timestamp - timeAxis.minimum) / (timeAxis.maximum - timeAxis.minimum);
      };
      const yAt = value => margin.top + (maxY - value) / (maxY - minY) * plotH;
      series.forEach(item => {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.key === 'mean_c' ? 4 : 3;
        ctx.beginPath();
        let drawing = false;
        points.forEach((point, index) => {
          const value = Number(point[item.key]);
          if (!Number.isFinite(value)) { drawing = false; return; }
          const x = xAt(index); const y = yAt(value);
          if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        if (points.length <= 60) {
          points.forEach((point, index) => {
            const value = Number(point[item.key]);
            if (!Number.isFinite(value)) return;
            ctx.beginPath();
            ctx.fillStyle = item.color;
            ctx.arc(xAt(index), yAt(value), points.length === 1 ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.font = 'bold 21px sans-serif';
      const title = data.dataset_label || (data.layer === 'chirps' ? 'CHIRPS precipitation' : 'TerraClimate temperature');
      ctx.fillText(`${title} · ${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}`, margin.left, 24);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = axisColor;
      ctx.fillText(`Source: ${abearcClimateSourceMetadata(data).label}`, margin.left, 48);
      ctx.font = '17px sans-serif';
      ctx.textAlign = 'center';
      const xTicks = timeAxis?.ticks?.length
        ? timeAxis.ticks.map(timestamp => ({
            x: timeAxis.maximum === timeAxis.minimum
              ? margin.left + plotW / 2
              : margin.left + plotW * (timestamp - timeAxis.minimum) / (timeAxis.maximum - timeAxis.minimum),
            label: timeAxis.format(timestamp)
          }))
        : points.map((point, index) => ({ x: xAt(index), label: String(index + 1) }));
      xTicks.forEach(tick => {
        const x = tick.x;
        ctx.strokeStyle = gridColor;
        ctx.beginPath(); ctx.moveTo(x, height - margin.bottom); ctx.lineTo(x, height - margin.bottom + 7); ctx.stroke();
        ctx.fillStyle = axisColor;
        ctx.fillText(tick.label, x, height - 22);
      });
      let legendX = margin.left;
      const legendY = margin.top - 12;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      series.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY - 2, 18, 4);
        legendX += 25;
        ctx.fillStyle = textColor;
        ctx.fillText(item.label, legendX, legendY);
        legendX += ctx.measureText(item.label).width + 28;
      });
      ctx.textBaseline = 'alphabetic';
    }

    async function loadAbearcClimateGraphLayer(container, layer, latitude, longitude) {
      const status = container.querySelector('[data-climate-graph-status]');
      const canvas = container.querySelector('canvas');
      const csvButton = container.querySelector('[data-climate-download-csv]');
      const pngButton = container.querySelector('[data-climate-download-png]');
      if (status) status.textContent = 'Loading graph data…';
      if (csvButton) csvButton.disabled = true;
      if (pngButton) pngButton.disabled = true;
      const params = new URLSearchParams({ start: layer.start, end: layer.end, lat: latitude, lng: longitude });
      try {
        const data = await fetchJson(`${API}/map/${layer.key}/series?${params}`, { silentLoading: true, cache: 'no-store' });
        container._abearcClimateSeries = data;
        drawAbearcClimateChart(canvas, data);
        if (status) status.textContent = `${data.series_resolution} · ${layer.start} to ${layer.end}`;
        if (csvButton) csvButton.disabled = false;
        if (pngButton) pngButton.disabled = false;
      } catch (error) {
        container._abearcClimateSeries = null;
        const ctx = canvas?.getContext?.('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (status) status.textContent = error?.message || 'Unable to load graph data.';
      }
    }

    function refreshAbearcOpenClimateGraph() {
      if (!abearcClimateGraphPopup?.isOpen?.()) return;
      const lngLat = abearcClimateGraphPopup.getLngLat?.();
      if (!lngLat) return;
      const point = abearcMap?.project?.(lngLat);
      const floodFeature = point ? abearcNoahFloodFeatureAtPoint(point) : null;
      openAbearcClimateGraph(lngLat, floodFeature);
    }

    function abearcNoahFloodFeatureAtPoint(point) {
      if (!abearcNoahFloodEnabled || !abearcMap?.getLayer('abearc-noah-flood-100yr')) return null;
      return abearcMap.queryRenderedFeatures(point, { layers: ['abearc-noah-flood-100yr'] })?.[0] || null;
    }

    function abearcNoahFloodDescriptor(feature) {
      const level = Number(feature?.properties?.Var);
      if (level === 1) return { key: 'low', label: 'Low flood hazard', depth: 'Generally 0–0.5 m depth' };
      if (level === 2) return { key: 'medium', label: 'Medium flood hazard', depth: 'Generally >0.5–1.5 m depth' };
      if (level === 3) return { key: 'high', label: 'High flood hazard', depth: 'Generally >1.5 m depth' };
      return { key: 'none', label: 'No mapped category at this point', depth: 'Outside a published NOAH flood-hazard polygon' };
    }

    function createAbearcNoahFloodSummary(feature) {
      const descriptor = abearcNoahFloodDescriptor(feature);
      const summary = document.createElement('div');
      summary.className = 'abearc-map-flood-popup';
      const title = document.createElement('strong');
      title.textContent = 'NOAH 100-year flood scenario';
      const level = document.createElement('span');
      level.className = `abearc-map-flood-popup__level is-${descriptor.key}`;
      level.textContent = descriptor.label;
      const depth = document.createElement('span');
      depth.textContent = descriptor.depth;
      const note = document.createElement('small');
      note.textContent = 'Hazard accounts for depth and flow velocity; it is not a real-time flood observation.';
      summary.append(title, level, depth, note);
      return summary;
    }

    function openAbearcNoahFloodInfo(lngLat, feature) {
      if (!abearcMap || typeof maplibregl === 'undefined') return;
      abearcClimateGraphPopup?.remove();
      abearcNoahFloodPopup?.remove();
      abearcNoahFloodPopup = new maplibregl.Popup({ offset: [0, -10], maxWidth: '300px', closeOnClick: false })
        .setLngLat([Number(lngLat.lng), Number(lngLat.lat)])
        .setDOMContent(createAbearcNoahFloodSummary(feature))
        .addTo(abearcMap);
    }

    function openAbearcClimateGraph(lngLat, floodFeature = null) {
      const layers = abearcClimateEnabledLayers();
      if (!layers.length || !abearcMap || typeof maplibregl === 'undefined') return;
      const latitude = Number(lngLat?.lat);
      const longitude = Number(lngLat?.lng);
      const withinPhilippinesExtent = Number.isFinite(latitude) && latitude >= 4 && latitude <= 22
        && Number.isFinite(longitude) && longitude >= 116 && longitude <= 127;
      if (!withinPhilippinesExtent) return;
      abearcNoahFloodPopup?.remove();
      abearcClimateGraphPopup?.remove();
      const container = document.createElement('section');
      container.className = 'abearc-climate-chart-popup';
      const header = document.createElement('div');
      header.className = 'abearc-climate-chart-popup__header';
      const title = document.createElement('strong');
      title.textContent = 'Climate data';
      const coordinate = document.createElement('span');
      coordinate.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      header.append(title, coordinate);
      container.appendChild(header);
      let selectedLayer = layers[0];
      if (layers.length > 1) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Climate graph layer');
        layers.forEach(layer => {
          const option = document.createElement('option');
          option.value = layer.key;
          option.textContent = layer.label;
          select.appendChild(option);
        });
        select.addEventListener('change', () => {
          selectedLayer = layers.find(layer => layer.key === select.value) || layers[0];
          loadAbearcClimateGraphLayer(container, selectedLayer, latitude, longitude);
        });
        container.appendChild(select);
      } else {
        const layerName = document.createElement('div');
        layerName.className = 'abearc-climate-chart-popup__layer';
        layerName.textContent = selectedLayer.label;
        container.appendChild(layerName);
      }
      if (abearcNoahFloodEnabled) container.appendChild(createAbearcNoahFloodSummary(floodFeature));
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 400;
      canvas.setAttribute('aria-label', 'Climate time-series graph');
      container.appendChild(canvas);
      const footer = document.createElement('div');
      footer.className = 'abearc-climate-chart-popup__footer';
      const status = document.createElement('span');
      status.dataset.climateGraphStatus = '';
      status.textContent = 'Loading graph data…';
      const actions = document.createElement('div');
      const csvButton = document.createElement('button');
      csvButton.type = 'button'; csvButton.dataset.climateDownloadCsv = ''; csvButton.textContent = 'CSV'; csvButton.disabled = true;
      csvButton.addEventListener('click', () => downloadAbearcClimateCsv(container));
      const pngButton = document.createElement('button');
      pngButton.type = 'button'; pngButton.dataset.climateDownloadPng = ''; pngButton.textContent = 'PNG'; pngButton.disabled = true;
      pngButton.addEventListener('click', () => downloadAbearcClimatePng(container));
      actions.append(csvButton, pngButton);
      footer.append(status, actions);
      container.appendChild(footer);
      abearcClimateGraphPopup = new maplibregl.Popup({ offset: [0, -12], maxWidth: '410px', closeOnClick: false })
        .setLngLat([longitude, latitude])
        .setDOMContent(container)
        .addTo(abearcMap);
      loadAbearcClimateGraphLayer(container, selectedLayer, latitude, longitude);
    }

    function closeAbearcMapLayerLabelMenu() {
      const menu = document.querySelector('[data-map-layer-label-menu]');
      if (!menu) return;
      menu.classList.add('hidden');
      delete menu.dataset.layerKind;
    }

    function openAbearcMapLayerLabelMenu(event, kind) {
      if (!Object.prototype.hasOwnProperty.call(ABEARC_MAP_LAYER_NAMES, kind)) return;
      event.preventDefault();
      event.stopPropagation();
      const menu = document.querySelector('[data-map-layer-label-menu]');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      const visible = abearcMapLayerLabels[kind] !== false;
      menu.dataset.layerKind = kind;
      const title = menu.querySelector('[data-map-layer-label-title]');
      const action = menu.querySelector('[data-map-layer-label-action]');
      const toggle = menu.querySelector('[data-map-layer-label-toggle]');
      if (title) title.textContent = `${ABEARC_MAP_LAYER_NAMES[kind]} labels`;
      if (action) action.textContent = visible ? 'Hide area labels' : 'Show area labels';
      if (toggle) {
        toggle.setAttribute('aria-checked', String(visible));
        toggle.onclick = () => setAbearcMapLayerLabelsVisible(kind, !visible);
      }
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 220;
      const height = menu.offsetHeight || 94;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function setAbearcMapLayerLabelsVisible(kind, visible) {
      if (!Object.prototype.hasOwnProperty.call(ABEARC_MAP_LAYER_NAMES, kind)) return;
      abearcMapLayerLabels[kind] = Boolean(visible);
      localStorage.setItem('abearcMapLayerLabels', JSON.stringify(abearcMapLayerLabels));
      if (kind === 'zoning') localStorage.setItem('abearcZoningLabelsVisible', String(Boolean(visible)));
      closeAbearcMapLayerLabelMenu();
      if (kind !== abearcMapBasemap) return;
      const layerId = kind === 'zoning' ? 'abearc-zoning-labels' : 'abearc-area-labels';
      if (abearcMap?.getLayer(layerId)) abearcMap.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      if (kind === 'zoning' && visible) scheduleAbearcZoningLabelsReload(0);
      if (kind === 'zoning' && !visible) abearcZoningLabelsAbort?.abort();
      toast(`${ABEARC_MAP_LAYER_NAMES[kind]} area labels ${visible ? 'shown' : 'hidden'}`);
    }

    function setAbearcZoningLabelsVisible(visible) {
      setAbearcMapLayerLabelsVisible('zoning', visible);
    }

    function scheduleAbearcZoningLabelsReload(delay = 120) {
      clearTimeout(abearcZoningLabelsTimer);
      if (!abearcMap || abearcMapBasemap !== 'zoning' || abearcMapLayerLabels.zoning === false) return;
      abearcZoningLabelsTimer = setTimeout(reloadAbearcZoningLabels, delay);
    }

    async function reloadAbearcZoningLabels() {
      const source = abearcMap?.getSource('abearc-zoning-labels');
      if (!source || abearcMapBasemap !== 'zoning' || abearcMapLayerLabels.zoning === false) return;
      abearcZoningLabelsAbort?.abort();
      abearcZoningLabelsAbort = new AbortController();
      const bounds = abearcMap.getBounds();
      const params = new URLSearchParams({
        west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(),
        zoom: abearcMap.getZoom().toFixed(2)
      });
      try {
        const data = await fetchJson(`${API}/map/zoning-labels?${params}`, { signal: abearcZoningLabelsAbort.signal, silentLoading: true });
        if (abearcMap?.getSource('abearc-zoning-labels') === source) source.setData(data);
      } catch (error) {
        if (error?.name !== 'AbortError') console.warn('Unable to refresh zoning labels:', error);
      }
    }

    function scheduleAbearcMapLayerSetup() {
      if (!abearcMap || abearcMapLayerSetupQueued) return;
      abearcMapLayerSetupQueued = true;
      requestAnimationFrame(() => {
        abearcMapLayerSetupQueued = false;
        if (!setupAbearcMapLayers()) {
          abearcMap.once('idle', scheduleAbearcMapLayerSetup);
          return;
        }
        const source = abearcMap.getSource('abearc-map-media');
        if (source && abearcMapFeatures.length) {
          source.setData(abearcMapScopedFeatureCollection());
          scheduleAbearcMapMarkerRender();
          abearcMap.once('idle', scheduleAbearcMapMarkerRender);
        } else {
          reloadAbearcMap();
        }
      });
    }

    function setupAbearcMapLayers() {
      if (!abearcMap) return false;
      if (typeof abearcMap.isStyleLoaded === 'function' && !abearcMap.isStyleLoaded()) return false;
      setupAbearcChirpsLayer();
      setupAbearcTerraClimateLayer();
      setupAbearcNoahFloodLayer();
      if (!abearcMap.getSource('abearc-davao-boundary')) {
        abearcMap.addSource('abearc-davao-boundary', {
          type: 'geojson',
          data: '/assets/data/davao-city-boundary.geojson',
          attribution: 'Davao City administrative boundary: PSA / GeoRiskPH'
        });
      }
      if (!abearcMap.getLayer('abearc-davao-boundary-fill')) {
        abearcMap.addLayer({
          id: 'abearc-davao-boundary-fill',
          type: 'fill',
          source: 'abearc-davao-boundary',
          layout: { visibility: abearcDavaoBoundaryVisible ? 'visible' : 'none' },
          paint: {
            'fill-color': '#0b78a8',
            'fill-opacity': 0.07
          }
        });
      }
      if (!abearcMap.getLayer('abearc-davao-boundary-line')) {
        abearcMap.addLayer({
          id: 'abearc-davao-boundary-line',
          type: 'line',
          source: 'abearc-davao-boundary',
          layout: { visibility: abearcDavaoBoundaryVisible ? 'visible' : 'none' },
          paint: {
            'line-color': '#0077a8',
            'line-width': 2.25,
            'line-opacity': 0.92,
            'line-dasharray': [3, 2]
          }
        });
      }
      if (!abearcMap.getSource('abearc-map-media')) {
        abearcMap.addSource('abearc-map-media', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: abearcMapConfig.cluster.radius,
          clusterMaxZoom: abearcMapConfig.cluster.maxZoom
        });
      }
      if (!abearcMap.getLayer('abearc-map-clusters')) {
        abearcMap.addLayer({
          id: 'abearc-map-clusters',
          type: 'circle',
          source: 'abearc-map-media',
          filter: ['has', 'point_count'],
          paint: { 'circle-radius': 1, 'circle-opacity': 0 }
        });
      }
      if (!abearcMap.getLayer('abearc-map-points')) {
        abearcMap.addLayer({
          id: 'abearc-map-points',
          type: 'circle',
          source: 'abearc-map-media',
          filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': 1, 'circle-opacity': 0 }
        });
      }
      return true;
    }

    function mapQueryParams() {
      const params = new URLSearchParams({ limit: '5000' });
      const searchValue = abearcMapCommittedSearch;
      if (searchValue) params.set('search', searchValue);
      const mapFields = [
        ['category', 'mapCategoryFilter'],
        ['district', 'mapDistrictFilter'],
        ['barangay', 'mapBarangayFilter'],
        ['location_status', 'mapLocationStatusFilter']
      ];
      mapFields.forEach(([key, id]) => {
        const value = document.getElementById(id)?.value;
        if (value) params.set(key, value);
      });
      if (document.getElementById('mapMyUploadsOnly')?.checked) params.set('my_uploads_only', 'true');
      if (document.getElementById('mapUnlinkedOnly')?.checked) params.set('unlinked_only', 'true');
      params.set('map_status', 'active');
      return params;
    }

    function abearcMapSearchFitKey() {
      const search = abearcMapCommittedSearch;
      if (!search) return '';
      return [
        search,
        document.getElementById('mapCategoryFilter')?.value || '',
        document.getElementById('mapDistrictFilter')?.value || '',
        document.getElementById('mapBarangayFilter')?.value || '',
        document.getElementById('mapLocationStatusFilter')?.value || '',
        document.getElementById('mapMyUploadsOnly')?.checked ? 'mine' : '',
        document.getElementById('mapUnlinkedOnly')?.checked ? 'unlinked' : ''
      ].join('|');
    }

    function fitAbearcMapToSearchResults(features = []) {
      if (!abearcMap || typeof maplibregl === 'undefined') return;
      const coordinates = features
        .map(feature => feature?.geometry?.coordinates)
        .filter(value => Array.isArray(value)
          && Number.isFinite(Number(value[0]))
          && Number.isFinite(Number(value[1])))
        .map(value => [Number(value[0]), Number(value[1])]);
      if (!coordinates.length) return;
      if (coordinates.length === 1) {
        abearcMap.easeTo({
          center: coordinates[0],
          zoom: Math.min(18, Math.max(abearcMap.getZoom(), 16)),
          duration: 550
        });
        return;
      }
      const bounds = coordinates.slice(1).reduce(
        (result, coordinate) => result.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
      );
      const canvasWidth = abearcMap.getCanvas()?.clientWidth || 0;
      const detailsOpen = !document.getElementById('abearcMapDetails')?.classList.contains('hidden');
      const rightPadding = detailsOpen && canvasWidth > 520
        ? Math.min(410, Math.max(72, canvasWidth - 260))
        : 72;
      abearcMap.fitBounds(bounds, {
        padding: { top: 72, right: rightPadding, bottom: 88, left: 72 },
        maxZoom: 18,
        duration: 650
      });
    }

    function abearcMapActiveFilterLabels() {
      const fields = [
        ['mapCategoryFilter', 'Category'],
        ['mapDistrictFilter', 'District'],
        ['mapBarangayFilter', 'Barangay'],
        ['mapLocationStatusFilter', 'Location status']
      ];
      const labels = fields
        .filter(([id]) => Boolean(document.getElementById(id)?.value))
        .map(([, label]) => label);
      if (abearcMapCommittedSearch) labels.unshift('Search');
      if (document.getElementById('mapMyUploadsOnly')?.checked) labels.push('My uploads');
      if (document.getElementById('mapUnlinkedOnly')?.checked) labels.push('Unlinked');
      return labels;
    }

    function updateAbearcMapWorkspaceSummary() {
      const count = abearcMapVisibleListFeatures().length;
      const filters = abearcMapActiveFilterLabels();
      if (abearcMapPhotoScope === 'saved') filters.unshift('Saved');
      if (abearcMapPhotoScope === 'mine') filters.unshift('My geotagged photos');
      const listCount = document.querySelector('[data-map-list-count]');
      const activeFilters = document.querySelector('[data-map-active-filters]');
      const resultsTitle = document.querySelector('[data-map-results-title]');
      const resultsOrder = document.querySelector('[data-map-results-order]');
      if (listCount) listCount.textContent = count.toLocaleString();
      if (resultsTitle) resultsTitle.textContent = abearcMapPhotoScope === 'saved'
        ? 'Saved photos'
        : (abearcMapPhotoScope === 'mine' ? 'My geotagged photos' : 'Photo results');
      if (resultsOrder) resultsOrder.textContent = abearcMapPhotoScope === 'saved'
        ? 'Saved on this device'
        : (abearcMapPhotoScope === 'mine' ? 'Uploaded by me' : 'Newest first');
      if (activeFilters) activeFilters.textContent = filters.length
        ? `${filters.length} active filter${filters.length === 1 ? '' : 's'}`
        : 'No active filters';
      const filterButton = document.querySelector('[data-map-filter-button]');
      filterButton?.classList.toggle('has-active-filters', filters.length > 0);
      document.querySelectorAll('[data-map-bulk-rename], [data-map-bulk-download], [data-map-bulk-delete]').forEach(button => {
        button.disabled = count === 0;
      });
      syncAbearcMapRail();
    }
    function setAbearcMapSyncState(text, state = 'ready') {
      const status = document.querySelector('[data-map-sync-state]');
      if (!status) return;
      status.dataset.state = state;
      const label = status.querySelector('strong');
      if (label) label.textContent = text;
    }

    function toggleAbearcMapFilters(forceOpen = null) {
      const page = document.getElementById('mapPage');
      const popover = document.getElementById('abearcMapFilters');
      if (!page || !popover) return;
      const open = forceOpen == null ? popover.classList.contains('hidden') : Boolean(forceOpen);
      popover.classList.toggle('hidden', !open);
      page.classList.toggle('is-filter-panel-open', open);
      const button = document.querySelector('[data-map-filter-button]');
      button?.classList.toggle('is-active', open);
      button?.setAttribute('aria-expanded', String(open));
    }

    function animateAbearcMapResize(duration = 320) {
      if (abearcMapResizeAnimationFrame) cancelAnimationFrame(abearcMapResizeAnimationFrame);
      const startedAt = performance.now();
      const resizeFrame = now => {
        abearcMap?.resize();
        renderAbearcMapMovedPhotoLeaders();
        if (now - startedAt < duration) {
          abearcMapResizeAnimationFrame = requestAnimationFrame(resizeFrame);
        } else {
          abearcMapResizeAnimationFrame = null;
          abearcMap?.resize();
        }
      };
      abearcMapResizeAnimationFrame = requestAnimationFrame(resizeFrame);
    }

    function toggleAbearcMapResults(forceOpen = null) {
      const page = document.getElementById('mapPage');
      if (!page) return;
      const compact = window.matchMedia('(max-width: 900px)').matches;
      const currentlyOpen = compact
        ? page.classList.contains('is-results-panel-open')
        : !page.classList.contains('is-results-panel-collapsed');
      const open = forceOpen == null ? !currentlyOpen : Boolean(forceOpen);
      page.classList.toggle('is-results-panel-open', compact && open);
      page.classList.toggle('is-results-panel-collapsed', !compact && !open);
      const button = document.querySelector('.abearc-map-results-toggle');
      button?.setAttribute('aria-pressed', String(open));
      button?.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} photo results`);
      button?.setAttribute('title', `${open ? 'Hide' : 'Show'} photo results`);
      const label = document.querySelector('[data-map-results-toggle-label]');
      if (label) label.textContent = open ? 'Hide results' : 'Show results';
      animateAbearcMapResize();
    }

    function abearcMapScopedFeatures() {
      if (abearcMapPhotoScope === 'saved') {
        return abearcMapFeatures.filter(feature => abearcMapSavedPhotoIds.has(Number(abearcFeatureId(feature))));
      }
      if (abearcMapPhotoScope === 'mine') {
        return abearcMapFeatures.filter(feature => Number(feature?.properties?.owner_user_id) === Number(currentUser?.id));
      }
      return abearcMapFeatures;
    }

    function abearcMapVisibleListFeatures() {
      const scopedFeatures = abearcMapScopedFeatures();
      const canvas = abearcMap?.getCanvas?.();
      const width = Number(canvas?.clientWidth || 0);
      const height = Number(canvas?.clientHeight || 0);
      if (!abearcMap || width <= 0 || height <= 0) return scopedFeatures;
      const edgeAllowance = 24;
      return scopedFeatures.filter(feature => {
        const id = Number(abearcFeatureId(feature));
        const locations = [feature?.geometry?.coordinates];
        const movedPosition = abearcMapMovedPhotoPositions.get(id);
        if (Array.isArray(movedPosition)) locations.push(movedPosition);
        return locations.some(coordinates => {
          if (!Array.isArray(coordinates)
              || !Number.isFinite(Number(coordinates[0]))
              || !Number.isFinite(Number(coordinates[1]))) return false;
          const point = abearcMap.project([Number(coordinates[0]), Number(coordinates[1])]);
          return point.x >= -edgeAllowance && point.y >= -edgeAllowance
            && point.x <= width + edgeAllowance && point.y <= height + edgeAllowance;
        });
      });
    }

    function abearcMapScopedFeatureCollection() {
      return { type: 'FeatureCollection', features: abearcMapScopedFeatures() };
    }

    function refreshAbearcMapPhotoScope({ fit = false } = {}) {
      const scopedFeatures = abearcMapScopedFeatures();
      const source = abearcMap?.getSource('abearc-map-media');
      if (source) source.setData({ type: 'FeatureCollection', features: scopedFeatures });
      collapseAbearcMapExplosion();
      scheduleAbearcMapMarkerRender();
      renderAbearcMapList();
      syncAbearcMapRail();
      if (fit && scopedFeatures.length) fitAbearcMapToSearchResults(scopedFeatures);
      return scopedFeatures;
    }

    function setAbearcMapPhotoScope(scope) {
      if (!['all', 'saved', 'mine'].includes(scope)) return;
      abearcMapPhotoScope = scope;
      ['mapSearchInput', 'mapCategoryFilter', 'mapDistrictFilter', 'mapBarangayFilter', 'mapLocationStatusFilter'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      ['mapMyUploadsOnly', 'mapUnlinkedOnly'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.checked = false;
      });
      abearcMapCommittedSearch = '';
      abearcMapLastSearchFitKey = '';
      abearcMapFitAllRequested = true;
      if (!abearcMapPhotosVisible) {
        abearcMapPhotosVisible = true;
        localStorage.setItem('abearcMapPhotosVisible', 'true');
        syncAbearcMapPhotoVisibilityControl();
      }
      abearcMapPhotoSelectionMode = false;
      abearcMapSelectedPhotoIds.clear();
      closeAbearcMapDetails();
      refreshAbearcMapPhotoScope({ fit: true });
      toggleAbearcMapResults(true);
      reloadAbearcMap();
    }

    function syncAbearcMapRail() {
      const savedCount = document.querySelector('[data-map-saved-count]');
      const photoCount = document.querySelector('[data-map-rail-photo-count]');
      const mineCount = document.querySelector('[data-map-rail-mine-count]');
      const savedButton = document.querySelector('[data-map-rail-saved]');
      const photosButton = document.querySelector('[data-map-rail-photos]');
      const mineButton = document.querySelector('[data-map-rail-mine]');
      if (savedCount) {
        savedCount.textContent = String(abearcMapSavedPhotoIds.size);
        savedCount.classList.toggle('hidden', abearcMapSavedPhotoIds.size === 0);
      }
      if (photoCount) {
        photoCount.textContent = String(abearcMapFeatures.length);
        photoCount.classList.toggle('hidden', abearcMapFeatures.length === 0);
      }
      const myPhotos = abearcMapFeatures.filter(feature => Number(feature?.properties?.owner_user_id) === Number(currentUser?.id));
      if (mineCount) {
        mineCount.textContent = String(myPhotos.length);
        mineCount.classList.toggle('hidden', myPhotos.length === 0);
      }
      savedButton?.classList.toggle('is-active', abearcMapPhotoScope === 'saved');
      photosButton?.classList.toggle('is-active', abearcMapPhotoScope === 'all');
      mineButton?.classList.toggle('is-active', abearcMapPhotoScope === 'mine');
      savedButton?.setAttribute('aria-pressed', String(abearcMapPhotoScope === 'saved'));
      photosButton?.setAttribute('aria-pressed', String(abearcMapPhotoScope === 'all'));
      mineButton?.setAttribute('aria-pressed', String(abearcMapPhotoScope === 'mine'));
      document.querySelectorAll('[data-map-save-photo-id]').forEach(button => {
        const saved = abearcMapSavedPhotoIds.has(Number(button.dataset.mapSavePhotoId));
        button.classList.toggle('is-saved', saved);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', saved ? 'Remove from saved photos' : 'Save photo');
        button.setAttribute('title', saved ? 'Remove from saved' : 'Save photo');
        const menuLabel = button.querySelector('[data-map-list-menu-save-label]');
        if (menuLabel) menuLabel.textContent = saved ? 'Remove from Saved' : 'Save photo';
      });
    }

    function persistAbearcMapSavedPhotoIds() {
      localStorage.setItem('abearcMapSavedPhotoIds', JSON.stringify([...abearcMapSavedPhotoIds]));
    }

    function removeAbearcSavedPhotoIds(ids = []) {
      let changed = false;
      ids.forEach(id => {
        const photoId = Number(id);
        if (Number.isFinite(photoId) && photoId > 0) changed = abearcMapSavedPhotoIds.delete(photoId) || changed;
      });
      if (changed) {
        persistAbearcMapSavedPhotoIds();
        syncAbearcMapRail();
      }
      return changed;
    }

    function showAbearcGeotagPhotos() {
      setAbearcMapPhotoScope('all');
    }

    function showAbearcSavedPhotos() {
      setAbearcMapPhotoScope('saved');
    }

    function showAbearcMyGeotagPhotos() {
      setAbearcMapPhotoScope('mine');
    }

    function toggleAbearcSavedPhoto(id) {
      const photoId = Number(id);
      if (!Number.isFinite(photoId) || photoId <= 0) return;
      const wasSaved = abearcMapSavedPhotoIds.has(photoId);
      if (wasSaved) abearcMapSavedPhotoIds.delete(photoId);
      else abearcMapSavedPhotoIds.add(photoId);
      persistAbearcMapSavedPhotoIds();
      if (abearcMapPhotoScope === 'saved') refreshAbearcMapPhotoScope();
      else {
        renderAbearcMapList();
        syncAbearcMapRail();
      }
      toast(wasSaved ? 'Photo removed from Saved.' : 'Photo saved for quick access.');
    }

    async function downloadAbearcGeoCamApp() {
      await shareAbedGeoCamApp();
    }

    function syncAbearcMapFullPageControl() {
      const expanded = document.body.classList.contains('abearc-map-fullpage');
      const button = document.querySelector('[data-map-fullpage-toggle]');
      button?.setAttribute('aria-pressed', String(expanded));
      button?.setAttribute('aria-label', expanded ? 'Exit full-page map' : 'Expand map to full page');
      button?.setAttribute('title', expanded ? 'Exit full page' : 'Full-page map');
      const label = document.querySelector('[data-map-fullpage-label]');
      if (label) label.textContent = expanded ? 'Exit full page' : 'Full page';
      document.querySelector('[data-map-fullpage-expand-icon]')?.classList.toggle('hidden', expanded);
      document.querySelector('[data-map-fullpage-collapse-icon]')?.classList.toggle('hidden', !expanded);
    }

    function toggleAbearcMapFullPage(forceExpanded = null) {
      const expanded = forceExpanded == null
        ? !document.body.classList.contains('abearc-map-fullpage')
        : Boolean(forceExpanded);
      document.body.classList.toggle('abearc-map-fullpage', expanded);
      document.getElementById('mapPage')?.classList.toggle('is-fullpage', expanded);
      if (expanded) {
        toggleAbearcMapResults(false);
        toggleAbearcMapLayerMenu(false);
        toggleAbearcQuickLayers(false);
      }
      syncAbearcMapFullPageControl();
      window.setTimeout(() => abearcMap?.resize(), 240);
    }

    function resetAbearcMapView() {
      if (!abearcMap) return;
      collapseAbearcMapExplosion();
      abearcMap.easeTo({ bearing: 0, pitch: 0, duration: 500 });
    }

    function fitAbearcMapToDavaoCity() {
      if (!abearcMap) return;
      collapseAbearcMapExplosion();
      closeAbearcMapDetails();
      abearcMap.fitBounds(ABEARC_DAVAO_CITY_BOUNDS, {
        padding: { top: 72, right: 72, bottom: 88, left: 72 },
        maxZoom: 11.5,
        bearing: 0,
        pitch: 0,
        duration: 700
      });
    }

    function submitAbearcMapSearch() {
      resetAbearcMapThumbnailMoves();
      const input = document.getElementById('mapSearchInput');
      const value = input?.value?.trim() || '';
      if (!value) {
        abearcMapCommittedSearch = '';
        abearcMapLastSearchFitKey = '';
        abearcMapFitAllRequested = true;
        updateAbearcMapWorkspaceSummary();
        reloadAbearcMap();
        return;
      }
      if (value.toLowerCase() === 'all') {
        ['mapCategoryFilter', 'mapDistrictFilter', 'mapBarangayFilter', 'mapLocationStatusFilter'].forEach(id => {
          const field = document.getElementById(id);
          if (field) field.value = '';
        });
        ['mapMyUploadsOnly', 'mapUnlinkedOnly'].forEach(id => {
          const field = document.getElementById(id);
          if (field) field.checked = false;
        });
        abearcMapCommittedSearch = '';
        abearcMapLastSearchFitKey = '';
        abearcMapFitAllRequested = true;
        updateAbearcMapWorkspaceSummary();
        reloadAbearcMap();
        return;
      }
      abearcMapFitAllRequested = false;
      abearcMapCommittedSearch = value;
      reloadAbearcMap();
    }

    function handleAbearcMapSearchInput() {
      const value = document.getElementById('mapSearchInput')?.value?.trim() || '';
      if (value || !abearcMapCommittedSearch) return;
      resetAbearcMapThumbnailMoves();
      abearcMapCommittedSearch = '';
      abearcMapLastSearchFitKey = '';
      abearcMapFitAllRequested = true;
      updateAbearcMapWorkspaceSummary();
      reloadAbearcMap();
    }

    function clearAbearcMapFilters() {
      resetAbearcMapThumbnailMoves();
      ['mapSearchInput', 'mapCategoryFilter', 'mapDistrictFilter', 'mapBarangayFilter', 'mapLocationStatusFilter'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      ['mapMyUploadsOnly', 'mapUnlinkedOnly'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.checked = false;
      });
      abearcMapCommittedSearch = '';
      abearcMapFitAllRequested = false;
      updateAbearcMapWorkspaceSummary();
      reloadAbearcMap();
    }

    function reloadAbearcMapForSearch() {
      resetAbearcMapThumbnailMoves();
      reloadAbearcMap();
    }

    function scheduleAbearcMapReload(delay = 250) {
      clearTimeout(abearcMapReloadTimer);
      abearcMapReloadTimer = setTimeout(reloadAbearcMap, delay);
    }

    function startAbearcMapAutoSync() {
      if (abearcMapAutoSyncTimer) return;
      abearcMapAutoSyncTimer = setInterval(() => {
        if (appCurrentView !== 'map' || document.hidden) return;
        reloadAbearcMap({ background: true });
      }, ABEARC_MAP_AUTO_SYNC_INTERVAL_MS);
    }

    async function reloadAbearcMap({ background = false } = {}) {
      if (appCurrentView !== 'map') return;
      await ensureAbearcMap();
      if (!abearcMap?.getSource('abearc-map-media')) scheduleAbearcMapLayerSetup();
      if (!abearcMap?.getSource('abearc-map-media')) return;
      if (abearcMapAbort) {
        if (background) return;
        abearcMapAbort.abort();
      }
      abearcMapAbort = new AbortController();
      const requestController = abearcMapAbort;
      const fitAllRequested = abearcMapFitAllRequested && !background;
      const searchFitKey = abearcMapSearchFitKey();
      if (!searchFitKey) abearcMapLastSearchFitKey = '';
      if (!background) setAbearcMapSyncState('Loading photos', 'loading');
      try {
        const queryParams = mapQueryParams();
        const data = await fetchJson(`${API}/map/media?${queryParams.toString()}`, { signal: requestController.signal, silentLoading: true });
        abearcMapFeatures = data.features || [];
        const refreshedIds = new Set(abearcMapFeatures.map(feature => Number(abearcFeatureId(feature))));
        [...abearcMapSelectedPhotoIds].forEach(id => { if (!refreshedIds.has(id)) abearcMapSelectedPhotoIds.delete(id); });
        const snapshotLimit = Number(queryParams.get('limit') || 0);
        const completeUnfilteredSnapshot = [...queryParams.keys()].every(key => ['limit', 'map_status'].includes(key))
          && snapshotLimit > 0
          && abearcMapFeatures.length < snapshotLimit;
        if (completeUnfilteredSnapshot) {
          removeAbearcSavedPhotoIds([...abearcMapSavedPhotoIds].filter(id => !refreshedIds.has(id)));
        }
        abearcMap.getSource('abearc-map-media').setData(abearcMapScopedFeatureCollection());
        const preserveAltExplosion = Boolean(abearcMapAltHeld && abearcMapExploded?.collapseOnAltRelease);
        if (preserveAltExplosion) {
          const refreshedById = new Map(abearcMapFeatures.map(feature => [Number(abearcFeatureId(feature)), feature]));
          abearcMapExploded.features = abearcMapExploded.features
            .map(feature => refreshedById.get(Number(abearcFeatureId(feature))) || feature)
            .filter(Boolean);
        }
        scheduleAbearcMapMarkerRender();
        abearcMap.once('idle', scheduleAbearcMapMarkerRender);
        renderAbearcMapList();
        if (preserveAltExplosion && abearcMapExploded.features.length > 1) {
          renderAbearcMapExplosion();
        } else {
          collapseAbearcMapExplosion();
        }
        if (fitAllRequested) {
          abearcMapFitAllRequested = false;
          fitAbearcMapToSearchResults(abearcMapScopedFeatures());
        } else if (searchFitKey && searchFitKey !== abearcMapLastSearchFitKey) {
          abearcMapLastSearchFitKey = searchFitKey;
          fitAbearcMapToSearchResults(abearcMapScopedFeatures());
        }
        setAbearcMapSyncState(`${abearcMapVisibleListFeatures().length.toLocaleString()} in view`, 'ready');
      } catch (e) {
        if (e.name !== 'AbortError' && !background) {
          setAbearcMapSyncState('Load failed', 'error');
          toast(e.message || 'Failed to load map photos', 'error');
        }
      } finally {
        if (abearcMapAbort === requestController) abearcMapAbort = null;
      }
    }

    async function focusAbearcMapPhoto(id) {
      await reloadAbearcMap();
      const row = await fetchJson(`${API}/map/media/${Number(id)}`, { silentLoading: true });
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && abearcMap) {
        abearcMap.flyTo({ center: [longitude, latitude], zoom: Math.max(16, abearcMap.getZoom()), bearing: 0, pitch: 0, essential: true });
      }
      await openAbearcMapDetails(id);
    }

    function abearcMapTenMeterScaleZoom(latitude) {
      const normalizedLatitude = Math.max(-85, Math.min(85, Number(latitude) || 0));
      const earthCircumferenceMeters = 40075016.686;
      const scaleControlWidthPixels = 140;
      const targetMaximumDistanceMeters = 10.5;
      const zoom = Math.log2(
        (earthCircumferenceMeters * Math.cos(normalizedLatitude * Math.PI / 180) * scaleControlWidthPixels)
        / (512 * targetMaximumDistanceMeters)
      );
      const minimumZoom = Number(abearcMap?.getMinZoom?.() ?? 0);
      const maximumZoom = Number(abearcMap?.getMaxZoom?.() ?? 22);
      return Math.max(minimumZoom, Math.min(maximumZoom, zoom));
    }

    function openAbearcMapResultPhoto(event, id) {
      event?.preventDefault?.();
      if (abearcMapResultSingleClickTimer) clearTimeout(abearcMapResultSingleClickTimer);
      abearcMapResultSingleClickTimer = setTimeout(() => {
        abearcMapResultSingleClickTimer = null;
        openAbearcMapDetails(id);
      }, 240);
    }

    function zoomAbearcMapPhotoToTenMeterScale(event, id) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (abearcMapResultSingleClickTimer) {
        clearTimeout(abearcMapResultSingleClickTimer);
        abearcMapResultSingleClickTimer = null;
      }
      const feature = featureById(id);
      const coordinates = feature?.geometry?.coordinates;
      const longitude = Number(coordinates?.[0]);
      const latitude = Number(coordinates?.[1]);
      if (!abearcMap || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
      collapseAbearcMapExplosion({ animate: false });
      closeAbearcMapDetails();
      abearcMapSelectedPhotoId = Number(id);
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => {
        item.classList.toggle('is-selected', Number(item.dataset.mapListPhotoId) === Number(id));
      });
      scheduleAbearcMapMarkerRender();
      abearcMap.easeTo({
        center: [longitude, latitude],
        zoom: abearcMapTenMeterScaleZoom(latitude),
        bearing: 0,
        pitch: 0,
        duration: 650,
        essential: true
      });
    }

    async function populateMapFilterOptions() {
      try {
        const options = await fetchJson(`${API}/map/filter-options`, { silentLoading: true });
        [['mapCategoryFilter', options.categories], ['mapDistrictFilter', options.districts], ['mapBarangayFilter', options.barangays]].forEach(([id, items]) => {
          const select = document.getElementById(id);
          if (!select) return;
          const first = select.options[0]?.outerHTML || '<option value="">All</option>';
          select.innerHTML = first + (items || []).map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
        });
      } catch (_) {}
    }

    function featureById(id) {
      return abearcMapFeatures.find(f => Number(f.id) === Number(id));
    }

    function abearcFeatureId(feature) {
      return feature?.id || feature?.properties?.map_media_id;
    }

    function abearcAuthenticatedMediaUrl(url) {
      if (!url || !authToken) return url || '';
      const separator = String(url).includes('?') ? '&' : '?';
      return `${url}${separator}token=${encodeURIComponent(authToken)}`;
    }

    function jsString(value = '') {
      return JSON.stringify(String(value ?? ''));
    }

    function abearcMapMaxZoom() {
      const value = typeof abearcMap?.getMaxZoom === 'function' ? Number(abearcMap.getMaxZoom()) : 22;
      return Number.isFinite(value) ? value : 22;
    }

    function abearcNextClusterZoom(step = 2) {
      const currentZoom = abearcMap.getZoom();
      return Math.min(currentZoom + step, abearcMapMaxZoom());
    }

    function abearcMapCanZoomIn(epsilon = 0.02) {
      return abearcMap && abearcMap.getZoom() < abearcMapMaxZoom() - epsilon;
    }

    function handleAbearcMapClick(event) {
      if (abearcMapMeasureMode !== 'off') return addAbearcMeasurePoint(event.lngLat);
      const measurePanel = document.querySelector('[data-map-measure-panel]');
      if (measurePanel && !measurePanel.classList.contains('is-collapsed')) {
        toggleAbearcMapMeasureTools(false);
      }
      if (abearcMapExploded?.collapseOnMapClick) collapseAbearcMapExplosion();
      const floodFeature = abearcNoahFloodFeatureAtPoint(event.point);
      if (abearcChirpsEnabled || abearcTerraClimateEnabled) {
        const canvas = abearcMap?.getCanvas?.();
        if (canvas) canvas.style.cursor = '';
        openAbearcClimateGraph(event.lngLat, floodFeature);
      } else if (abearcNoahFloodEnabled) {
        openAbearcNoahFloodInfo(event.lngLat, floodFeature);
      }
    }

    function latestAbearcFeature(features = []) {
      return features.filter(Boolean).sort((a, b) => {
        const at = new Date(a.properties?.captured_at || a.properties?.uploaded_at || 0).getTime() || 0;
        const bt = new Date(b.properties?.captured_at || b.properties?.uploaded_at || 0).getTime() || 0;
        return bt - at || Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
    }

    function abearcMarkerPlaceholder() {
      return '<span class="abearc-map-photo-placeholder" aria-hidden="true"></span>';
    }

    function abearcPhotoMarkerElement({ feature, count = 1, clusterFeature = null }) {
      const el = document.createElement('button');
      el.type = 'button';
      const featureId = Number(abearcFeatureId(feature));
      const markerFeatures = count > 1 ? (clusterFeature?.clusterFeatures || []) : [feature];
      const markerPhotoIds = markerFeatures.map(item => Number(abearcFeatureId(item))).filter(Number.isFinite);
      const hoveredFeature = markerFeatures.find(item => Number(abearcFeatureId(item)) === Number(abearcMapHoveredPhotoId));
      const moved = count === 1 && abearcMapMovedPhotoPositions.has(featureId);
      const selectedInMarker = count > 1
        ? (clusterFeature?.clusterFeatures || []).some(item => Number(abearcFeatureId(item)) === Number(abearcMapSelectedPhotoId))
        : Number(abearcFeatureId(feature)) === Number(abearcMapSelectedPhotoId);
      el.className = `abearc-map-photo-pin${count > 1 ? ' is-cluster' : ''}${selectedInMarker ? ' is-selected' : ''}${hoveredFeature ? ' is-list-hovered' : ''}${moved ? ' is-moved' : ''}`;
      el.dataset.mapPhotoIds = markerPhotoIds.join(',');
      el.title = count > 1 ? `${count} photos` : (feature.properties?.category || 'Map photo');
      const thumbnail = abearcAuthenticatedMediaUrl(feature.properties?.thumbnail_url);
      const bearing = bearingArrowHtml(feature.properties?.bearing_deg);
      el.innerHTML = `
        <span class="abearc-map-photo-pin__frame">
          ${thumbnail ? `<img alt="" src="${thumbnail}">` : abearcMarkerPlaceholder()}
          ${bearing}
        </span>
        <span class="abearc-map-photo-pin__hover-label" aria-hidden="true">${esc((hoveredFeature || feature).properties?.category || 'Map photo')}</span>
        ${count > 1 ? `<span class="abearc-map-photo-pin__count">${esc(count > 999 ? '999+' : count)}</span>` : '<span class="abearc-map-photo-pin__tail"></span>'}
      `;
      el.onclick = (event) => {
        event.stopPropagation();
        if (Date.now() < Number(abearcMapPhotoSuppressOpenUntil.get(featureId) || 0)) return;
        if (abearcMapMeasureMode !== 'off') {
          if (event.detail > 1) return;
          return addAbearcMeasurePointAt(feature.geometry.coordinates);
        }
        if (clusterFeature) return handleAbearcClusterClick(clusterFeature, event);
        if (abearcMapMovedPhotoPositions.has(featureId)) return openAbearcMapDetails(featureId);
        const near = closePhotoGroup(feature);
        if (near.length > 1) {
          if (!abearcMapCanZoomIn()) return explodeAbearcPhotoGroup(near, feature.geometry.coordinates, { collapseOnMapClick: true, collapseOnZoomOut: true });
          return abearcMap.easeTo({ center: feature.geometry.coordinates, zoom: abearcNextClusterZoom(), duration: 350 });
        }
        openAbearcMapDetails(abearcFeatureId(feature));
      };
      el.ondblclick = (event) => {
        if (abearcMapMeasureMode === 'off') return;
        event.preventDefault();
        event.stopPropagation();
        deleteAbearcMeasurePointNear(feature.geometry.coordinates);
      };
      el.oncontextmenu = (event) => {
        if (count !== 1 || abearcMapMeasureMode !== 'off') return;
        event.preventDefault();
        event.stopPropagation();
        openAbearcMapPhotoContextMenu(event, featureId);
      };
      return el;
    }

    function syncAbearcMapPhotoHover() {
      const hoveredId = Number(abearcMapHoveredPhotoId);
      const hasHoveredPhoto = Number.isFinite(hoveredId) && hoveredId > 0;
      document.querySelectorAll('.abearc-map-photo-pin').forEach(marker => {
        const ids = String(marker.dataset.mapPhotoIds || '').split(',').map(Number);
        const matched = hasHoveredPhoto && ids.includes(hoveredId);
        marker.classList.toggle('is-list-hovered', matched);
        marker.style.zIndex = matched ? '30' : '';
        if (matched) {
          const feature = featureById(hoveredId);
          const label = marker.querySelector('.abearc-map-photo-pin__hover-label');
          if (label) label.textContent = feature?.properties?.category || 'Map photo';
        }
      });
      document.querySelectorAll('.abearc-map-exploded-photo[data-map-photo-id]').forEach(marker => {
        marker.classList.toggle('is-list-hovered', hasHoveredPhoto && Number(marker.dataset.mapPhotoId) === hoveredId);
      });
      document.querySelectorAll('.abearc-map-explosion-line[data-map-photo-id], .abearc-map-explosion-dot[data-map-photo-id]').forEach(leaderPart => {
        leaderPart.classList.toggle('is-list-hovered', hasHoveredPhoto && Number(leaderPart.dataset.mapPhotoId) === hoveredId);
      });
    }

    function setAbearcMapPhotoHover(id) {
      const photoId = Number(id);
      if (!Number.isFinite(photoId) || photoId <= 0 || photoId === Number(abearcMapHoveredPhotoId)) return;
      abearcMapHoveredPhotoId = photoId;
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => {
        item.classList.toggle('is-map-hovered', Number(item.dataset.mapListPhotoId) === photoId);
      });
      syncAbearcMapPhotoHover();
    }

    function clearAbearcMapPhotoHover(id = null) {
      if (id != null && Number(id) !== Number(abearcMapHoveredPhotoId)) return;
      abearcMapHoveredPhotoId = null;
      document.querySelectorAll('[data-map-list-photo-id].is-map-hovered').forEach(item => item.classList.remove('is-map-hovered'));
      syncAbearcMapPhotoHover();
    }

    function clearAbearcMapPhotoMarkers(keep = new Set()) {
      for (const [key, marker] of abearcMapPhotoMarkers.entries()) {
        if (keep.has(key)) continue;
        marker.remove();
        abearcMapPhotoMarkers.delete(key);
      }
    }

    function scheduleAbearcMapMarkerRender() {
      if (!abearcMap || abearcMapMarkerRenderQueued) return;
      abearcMapMarkerRenderQueued = true;
      requestAnimationFrame(() => {
        abearcMapMarkerRenderQueued = false;
        renderAbearcMapPhotoMarkers();
      });
    }

    function abearcVisibleFeatureGroups() {
      if (!abearcMap) return [];
      const zoomScale = Math.pow(2, Math.floor(abearcMap.getZoom()));
      const worldSize = 512 * zoomScale;
      const canvas = abearcMap.getCanvas();
      const width = canvas?.clientWidth || 0;
      const height = canvas?.clientHeight || 0;
      const markerSize = 48;
      const radius = Math.max(markerSize, Number(abearcMapConfig?.cluster?.radius || 54) * 1.15);
      const buckets = new Map();
      const scopedFeatures = abearcMapVisibleListFeatures();
      const scopedIds = new Set(scopedFeatures.map(feature => Number(abearcFeatureId(feature))));
      scopedFeatures.forEach(feature => {
        if (!feature?.geometry?.coordinates || !Number.isFinite(Number(feature.geometry.coordinates[0])) || !Number.isFinite(Number(feature.geometry.coordinates[1]))) return;
        if (abearcMapMovedPhotoPositions.has(Number(abearcFeatureId(feature)))) return;
        const point = abearcMap.project(feature.geometry.coordinates);
        if (point.x < -markerSize || point.y < -markerSize || point.x > width + markerSize || point.y > height + markerSize) return;
        const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng: Number(feature.geometry.coordinates[0]), lat: Number(feature.geometry.coordinates[1]) });
        const key = `${Math.floor((mercator.x * worldSize) / radius)}:${Math.floor((mercator.y * worldSize) / radius)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ feature, point });
      });
      const groups = [...buckets.entries()].map(([key, items]) => {
        const features = items.map(item => item.feature);
        const latest = latestAbearcFeature(features);
        const lng = items.reduce((sum, item) => sum + Number(item.feature.geometry.coordinates[0]), 0) / items.length;
        const lat = items.reduce((sum, item) => sum + Number(item.feature.geometry.coordinates[1]), 0) / items.length;
        return {
          key: items.length > 1 ? `cluster:${key}` : `photo:${abearcFeatureId(latest)}`,
          feature: latest,
          count: items.length,
          coordinates: items.length > 1 ? [lng, lat] : latest.geometry.coordinates,
          clusterFeatures: features
        };
      });
      abearcMapMovedPhotoPositions.forEach((position, id) => {
        if (!scopedIds.has(Number(id))) return;
        const feature = featureById(id);
        if (!feature?.geometry?.coordinates || !Array.isArray(position)) return;
        const original = abearcMap.project(feature.geometry.coordinates);
        const callout = abearcMap.project(position);
        const visible = [original, callout].some(point => point.x >= -markerSize && point.y >= -markerSize
          && point.x <= width + markerSize && point.y <= height + markerSize);
        if (!visible) return;
        groups.push({ key: `photo:${id}`, feature, count: 1, coordinates: position, clusterFeatures: [feature] });
      });
      return groups;
    }

    function renderAbearcMapPhotoMarkers() {
      if (!abearcMap || !abearcMapPhotosVisible) {
        clearAbearcMapPhotoMarkers();
        renderAbearcMapMovedPhotoLeaders();
        return;
      }
      const groups = abearcVisibleFeatureGroups();
      const keep = new Set();
      const explodedIds = new Set((abearcMapExploded?.features || []).map(feature => Number(abearcFeatureId(feature))));
      groups.forEach(group => {
        if (!group.feature?.geometry?.coordinates) return;
        if (explodedIds.size && group.clusterFeatures?.some(feature => explodedIds.has(Number(abearcFeatureId(feature))))) return;
        keep.add(group.key);
        const clusterFeature = group.count > 1 ? {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: group.coordinates },
          properties: { point_count: group.count, screen_cluster: true },
          clusterFeatures: group.clusterFeatures
        } : null;
        const element = abearcPhotoMarkerElement({
          feature: group.feature,
          count: group.count,
          clusterFeature
        });
        const existing = abearcMapPhotoMarkers.get(group.key);
        if (existing && group.key === `photo:${abearcMapThumbnailMoveId}`) {
          existing.setLngLat(group.coordinates);
          return;
        }
        if (existing) existing.remove();
        abearcMapPhotoMarkers.set(group.key, new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(group.coordinates).addTo(abearcMap));
      });
      clearAbearcMapPhotoMarkers(keep);
      renderAbearcMapMovedPhotoLeaders();
    }

    function handleScreenAbearcClusterClick(cluster, event = {}) {
      const leaves = cluster.clusterFeatures || [];
      if (event.altKey && leaves.length > 1) {
        abearcMapAltHeld = true;
        return explodeAbearcPhotoGroup(leaves, cluster.geometry.coordinates, { collapseOnAltRelease: true });
      }
      if (leaves.length > 1 && !abearcMapCanZoomIn()) {
        return explodeAbearcPhotoGroup(leaves, cluster.geometry.coordinates, { collapseOnMapClick: true, collapseOnZoomOut: true });
      }
      abearcMap.easeTo({
        center: cluster.geometry.coordinates,
        zoom: abearcNextClusterZoom(),
        duration: 420
      });
    }

    function handleAbearcClusterClick(cluster, event = {}) {
      if (cluster.properties?.screen_cluster) return handleScreenAbearcClusterClick(cluster, event);
      const source = abearcMap.getSource('abearc-map-media');
      source.getClusterLeaves(cluster.properties.cluster_id, abearcMapConfig.explosion.maxVisiblePhotos + 1, 0, (leafErr, leaves) => {
        const clusterLeaves = leaves || [];
        if (event.altKey && !leafErr && (leaves || []).length > 1) {
          abearcMapAltHeld = true;
          return explodeAbearcPhotoGroup(clusterLeaves, cluster.geometry.coordinates, { collapseOnAltRelease: true });
        }
        if (!leafErr && clusterLeaves.length > 1 && !abearcMapCanZoomIn()) {
          return explodeAbearcPhotoGroup(clusterLeaves, cluster.geometry.coordinates, { collapseOnMapClick: true, collapseOnZoomOut: true });
        }
        source.getClusterExpansionZoom(cluster.properties.cluster_id, (zoomErr, zoom) => {
          const currentZoom = abearcMap.getZoom();
          const expansionZoom = zoomErr ? currentZoom + 2 : Number(zoom);
          const targetZoom = Math.min(Math.max(expansionZoom, currentZoom + 0.5), abearcMapMaxZoom());
          abearcMap.easeTo({ center: cluster.geometry.coordinates, zoom: targetZoom, duration: 420 });
        });
      });
    }

    function closePhotoGroup(feature) {
      const origin = abearcMap.project(feature.geometry.coordinates);
      const tolerance = Math.max(34, abearcMapConfig.cluster.radius * 0.65);
      return abearcMapVisibleListFeatures().filter(candidate => {
        const point = abearcMap.project(candidate.geometry.coordinates);
        return Math.hypot(point.x - origin.x, point.y - origin.y) <= tolerance;
      }).sort((a, b) => String(a.properties.captured_at || a.properties.uploaded_at || '').localeCompare(String(b.properties.captured_at || b.properties.uploaded_at || '')) || Number(a.id) - Number(b.id));
    }

    function explodeAbearcPhotoGroup(features, clusterCoordinates = null, options = {}) {
      if (abearcMapExplosionCollapseTimer) {
        clearTimeout(abearcMapExplosionCollapseTimer);
        abearcMapExplosionCollapseTimer = null;
      }
      const visible = features.slice(0, abearcMapConfig.explosion.maxVisiblePhotos);
      const anchorLng = clusterCoordinates ? Number(clusterCoordinates[0]) : visible.reduce((sum, f) => sum + Number(f.geometry.coordinates[0]), 0) / visible.length;
      const anchorLat = clusterCoordinates ? Number(clusterCoordinates[1]) : visible.reduce((sum, f) => sum + Number(f.geometry.coordinates[1]), 0) / visible.length;
      const selectedFeature = visible.find(feature => Number(abearcFeatureId(feature)) === Number(abearcMapSelectedPhotoId)) || visible[0];
      abearcMapExploded = {
        features: visible,
        anchor: [anchorLng, anchorLat],
        selectedId: Number(abearcFeatureId(selectedFeature)),
        total: features.length,
        positions: null,
        animated: false,
        collapsing: false,
        collapseOnMapClick: Boolean(options.collapseOnMapClick),
        collapseOnZoomOut: Boolean(options.collapseOnZoomOut),
        collapseOnAltRelease: Boolean(options.collapseOnAltRelease),
        zoom: abearcMap?.getZoom ? Number(abearcMap.getZoom()) : null
      };
      renderAbearcMapPhotoMarkers();
      renderAbearcMapExplosion();
    }

    function rectForExplosionPoint(point, size = 58) {
      return { left: point.x - size / 2, top: point.y - size / 2, right: point.x + size / 2, bottom: point.y + size / 2 };
    }

    function rectsOverlap(a, b, pad = 6) {
      return !(a.right + pad < b.left || a.left - pad > b.right || a.bottom + pad < b.top || a.top - pad > b.bottom);
    }

    function segmentsIntersect(a, b, c, d) {
      const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
      return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
    }

    function explosionCandidates(anchor, preferredAngle, index, count) {
      const out = [];
      const minR = abearcMapConfig.explosion.minRadius;
      const maxR = abearcMapConfig.explosion.maxRadius + 180;
      const spreadAngle = -Math.PI / 2 + (Math.PI * 2 * index / Math.max(count, 1));
      const angleSteps = [0, -0.28, 0.28, -0.56, 0.56, -0.9, 0.9, Math.PI / 2, -Math.PI / 2, Math.PI];
      for (let ring = 0; ring < 8; ring++) {
        const radius = Math.min(maxR, minR + ring * 38 + (index % 2) * 10);
        angleSteps.forEach(step => {
          const base = ring < 3 ? preferredAngle : spreadAngle;
          const angle = base + step + (ring % 2 ? 0.14 : 0);
          out.push({ x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius });
        });
      }
      return out;
    }

    function currentPhotoMarkerRects(explodedFeatures = []) {
      const explodedIds = new Set(explodedFeatures.map(feature => Number(abearcFeatureId(feature))));
      const rects = [];
      abearcMapPhotoMarkers.forEach((marker, key) => {
        if (key.startsWith('photo:') && explodedIds.has(Number(key.slice('photo:'.length)))) return;
        const point = abearcMap.project(marker.getLngLat());
        rects.push({ rect: rectForExplosionPoint(point, 58), point });
      });
      return rects;
    }

    function explosionPositions(features) {
      const occupied = currentPhotoMarkerRects(features);
      const occupiedLines = [];
      return features.map((feature, index) => {
        const origin = abearcMap.project(feature.geometry.coordinates);
        const clusterCenter = abearcMap.project(abearcMapExploded?.anchor || feature.geometry.coordinates);
        const dx = origin.x - clusterCenter.x;
        const dy = origin.y - clusterCenter.y;
        const preferred = Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : -Math.PI / 2 + (Math.PI * 2 * index / Math.max(features.length, 1));
        const candidates = explosionCandidates(origin, preferred, index, features.length);
        const available = candidates.find(point => {
          const rect = rectForExplosionPoint(point);
          const overlaps = occupied.some(item => rectsOverlap(rect, item.rect));
          const crossesMarker = occupied.some(item => segmentsIntersect(origin, point, origin, item.point));
          const crossesLine = occupiedLines.some(line => segmentsIntersect(origin, point, line.start, line.end));
          return !overlaps && !crossesMarker && !crossesLine;
        });
        const chosen = available || candidates
          .map(point => {
            const rect = rectForExplosionPoint(point);
            const overlapCount = occupied.filter(item => rectsOverlap(rect, item.rect)).length;
            const lineCrossCount = occupiedLines.filter(line => segmentsIntersect(origin, point, line.start, line.end)).length;
            return { point, score: overlapCount * 10000 + lineCrossCount * 5000 + Math.hypot(point.x - origin.x, point.y - origin.y) };
          })
          .sort((a, b) => a.score - b.score)[0]?.point
          || { x: origin.x, y: origin.y - 64 };
        occupied.push({ rect: rectForExplosionPoint(chosen), point: chosen });
        occupiedLines.push({ start: origin, end: chosen });
        return chosen;
      });
    }

    function mapMediaAgeStatus(row = {}) {
      const raw = row.captured_at || row.uploaded_at || row.created_at;
      const taken = raw ? new Date(raw) : null;
      if (!taken || Number.isNaN(taken.getTime())) return 'Unknown age';
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const then = new Date(taken.getFullYear(), taken.getMonth(), taken.getDate());
      if (then >= today) return 'Today';
      const days = Math.max(1, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
        - Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000));
      if (days >= 365) {
        const years = Math.floor(days / 365);
        return `${years} year${years === 1 ? '' : 's'} ago`;
      }
      if (days >= 30) {
        const months = Math.floor(days / 30);
        return `${months} month${months === 1 ? '' : 's'} ago`;
      }
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    function formatAbearcMapDate(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return 'Capture date unavailable';
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    }

    function mapMediaZoningText(row = {}) {
      const stampZoning = zoningFromStampText([row.stamp_text, row.remarks, row.location_description].filter(Boolean).join('\n'));
      return [
        row.zoning || stampZoning.zoning,
        row.location_zoning || stampZoning.location_zoning,
        row.facing_zoning || stampZoning.facing_zoning
      ].filter(Boolean).join(' / ') || 'N/A';
    }

    function zoningFromStampText(text = '') {
      const out = { zoning: '', location_zoning: '', facing_zoning: '' };
      const labels = {
        'Zoning:': 'zoning',
        'Location Zoning:': 'location_zoning',
        'Facing Zoning:': 'facing_zoning'
      };
      let pending = '';
      String(text || '').split(/\r?\n/).forEach(raw => {
        const line = String(raw || '').trim();
        if (pending && line && !line.includes(':')) {
          if (!out[pending]) out[pending] = line;
          pending = '';
          return;
        }
        pending = '';
        Object.entries(labels).forEach(([label, key]) => {
          if (!line.startsWith(label)) return;
          const value = line.slice(label.length).trim();
          if (value) out[key] = value;
          else pending = key;
        });
      });
      const known = zoningNameFromText(text);
      if (known && !out.zoning && !out.location_zoning && !out.facing_zoning) out.zoning = known;
      return out;
    }

    function zoningNameFromText(text = '') {
      const haystack = String(text || '').toLowerCase();
      const zones = [
        'Agri-Industrial Zone', 'Aquaculture Sub-Zone', 'Buffer/Greenbelt Zone', 'Commercial-1 Zone',
        'Commercial-2 Zone', 'Commercial-3 Zone', 'Cemetery/Memorial Park Zone', 'Critical Watershed Zone',
        'Industrial-1 Zone', 'Industrial-2 Zone', 'Industrial-3 Zone', 'Institutional Zone',
        'Mangrove Sub-Zone', 'Open Space/Easement Zone', 'Parks and Recreation Zone',
        'Production Agricultural Sub-Zone', 'Production Forest Sub-Zone', 'Protected Agricultural Sub-Zone',
        'Protection Forest Sub-Zone', 'Residential-1 Zone', 'Residential-3 Zone',
        'Rivers, Creeks, and Lakes Sub-Zone', 'Socialized Housing Zone', 'Special Institutional Zone',
        'Tourism Development Zone', 'Urban Ecological Enhancement Zone', 'Utilities, Transportation, and Services Zone',
        'Wetlands Sub-Zone', 'Waste Management, Treatment, Utilization, Disposal Zone',
        'Agricultural Zone', 'Forest and Forestland Zone', 'General Commercial Zone',
        'General Industrial Zone', 'General Institutional Zone', 'General Residential Zone',
        'Production Water Sub-Zone', 'Protected Water Sub-Zone', 'Unknown/Unclassified'
      ];
      return zones.find(zone => haystack.includes(zone.toLowerCase())) || '';
    }

    function mapMediaLocationText(row = {}) {
      const values = [row.barangay, row.district].map(v => String(v || '').trim()).filter(Boolean);
      const category = String(row.category || '').trim().toLowerCase();
      const suspicious = values.some(value => value.toLowerCase() === category
        || /^(?:unknown barangay|unknown district)$/i.test(value)
        || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{4}/i.test(value));
      return values.length && !suspicious ? values.join(', ') : '';
    }

    function mapMediaRemarksText(row = {}) {
      const defaultText = `ABEDGEOCAM Android camera uploaded by ${row.uploaded_by_username || row.owner_username || 'user'}.`;
      const existing = String(row.remarks || '').trim();
      if (!existing || existing === 'Source: ABEDGEOCAM Android camera' || existing.startsWith('Source: ABEDGEOCAM Android camera\n')) return defaultText;
      return existing;
    }

    function editSvgMarkup() {
      return typeof svgEdit === 'string' ? svgEdit : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
    }

    function openAbearcMapEditModal(field, currentValue, onSave) {
      const label = field === 'category' ? 'Category' : (field === 'bulk-category' ? 'Category' : 'Remarks');
      document.querySelector('[data-abearc-map-edit-modal] [data-abearc-map-edit-close]')?.click();

      const modal = document.createElement('div');
      modal.dataset.abearcMapEditModal = '';
      modal.className = 'fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm transition-all duration-200';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', field === 'bulk-category' ? 'Rename all photo categories' : `Edit ${label}`);
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto overflow-hidden fade-in" data-abearc-map-edit-dialog>
          <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">${field === 'bulk-category' ? 'Rename photo categories' : `Edit ${label}`}</h3>
            <button type="button" data-abearc-map-edit-close class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none p-2" aria-label="Close">&times;</button>
          </div>
          <form class="p-5 space-y-4" data-abearc-map-edit-form>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">${label}</label>
              ${field === 'remarks'
                ? `<textarea rows="5" data-abearc-map-edit-input class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"></textarea>`
                : `<input type="text" required data-abearc-map-edit-input class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none">`}
              ${field === 'bulk-category' ? `<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">The selected category will be applied to every photo currently shown in Photo Results.</p>` : ''}
            </div>
            <div data-abearc-map-edit-error class="hidden text-sm text-red-700 dark:text-red-300" role="alert"></div>
            <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
              <button type="button" data-abearc-map-edit-cancel class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" data-abearc-map-edit-save class="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-60 disabled:cursor-wait">${field === 'bulk-category' ? 'Rename all' : 'Save'}</button>
            </div>
          </form>
        </div>`;

      const input = modal.querySelector('[data-abearc-map-edit-input]');
      const form = modal.querySelector('[data-abearc-map-edit-form]');
      const saveButton = modal.querySelector('[data-abearc-map-edit-save]');
      const error = modal.querySelector('[data-abearc-map-edit-error]');
      input.value = currentValue || '';

      const close = () => {
        document.removeEventListener('keydown', handleKeydown, true);
        modal.remove();
      };
      const handleKeydown = event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      };

      modal.querySelector('[data-abearc-map-edit-close]')?.addEventListener('click', close);
      modal.querySelector('[data-abearc-map-edit-cancel]')?.addEventListener('click', close);
      modal.addEventListener('click', event => {
        if (event.target === modal) close();
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = field === 'bulk-category' ? 'Renaming...' : 'Saving...';
        error.classList.add('hidden');
        try {
          await onSave(input.value);
          close();
        } catch (e) {
          error.textContent = e.message || `Failed to update ${label.toLowerCase()}.`;
          error.classList.remove('hidden');
          saveButton.disabled = false;
          saveButton.textContent = field === 'bulk-category' ? 'Rename all' : 'Save';
          input.focus();
        }
      });

      document.body.appendChild(modal);
      document.addEventListener('keydown', handleKeydown, true);
      requestAnimationFrame(() => {
        input.focus();
        if ((field === 'category' || field === 'bulk-category') && typeof input.select === 'function') input.select();
      });
    }

    function editAbearcMapField(id, field, currentValue = '') {
      const label = field === 'category' ? 'Category' : 'Remarks';
      openAbearcMapEditModal(field, currentValue, async next => {
        await fetchJson(`${API}/map/media/${Number(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: next }) });
        toast(`${label} updated`);
        await reloadAbearcMap();
        openAbearcMapDetails(id);
      });
    }

    function currentAbearcMapPhotoIds() {
      return [...new Set(abearcMapFeatures.map(feature => Number(abearcFeatureId(feature))).filter(id => Number.isInteger(id) && id > 0))];
    }

    function canManageAbearcMapPhoto(photo) {
      const ownerId = Number(photo?.properties?.owner_user_id ?? photo?.owner_user_id);
      return Number.isFinite(ownerId) && (ownerId === Number(currentUser?.id) || hasPrivilege('manage_all_map_media'));
    }

    function isProjectDocumentLinkedMapPhoto(photo) {
      return Number(photo?.properties?.project_document_linked ?? photo?.project_document_linked ?? 0) === 1;
    }

    function manageableAbearcMapPhotoIds() {
      return [...new Set(abearcMapFeatures.filter(canManageAbearcMapPhoto).map(feature => Number(abearcFeatureId(feature))).filter(Number.isInteger))];
    }

    function selectableAbearcMapPhotoIds() {
      return [...new Set(abearcMapVisibleListFeatures().map(feature => Number(abearcFeatureId(feature))).filter(id => Number.isInteger(id) && id > 0))];
    }

    function currentAbearcMapBulkTargetIds() {
      return abearcMapPhotoSelectionMode ? [...abearcMapSelectedPhotoIds] : manageableAbearcMapPhotoIds();
    }

    function updateAbearcMapPhotoSelectionToolbar() {
      const toolbar = document.querySelector('[data-map-selection-toolbar]');
      if (!toolbar) return;
      toolbar.classList.toggle('hidden', !abearcMapPhotoSelectionMode);
      const count = abearcMapSelectedPhotoIds.size;
      const countLabel = toolbar.querySelector('[data-map-selection-count]');
      if (countLabel) countLabel.textContent = `${count.toLocaleString()} selected`;
      toolbar.querySelectorAll('[data-map-selection-save], [data-map-selection-download]').forEach(button => { button.disabled = count === 0; });
      const selectedFeatures = [...abearcMapSelectedPhotoIds].map(featureById).filter(Boolean);
      const allManageable = count > 0 && selectedFeatures.length === count && selectedFeatures.every(canManageAbearcMapPhoto);
      const renameButton = toolbar.querySelector('[data-map-selection-rename]');
      if (renameButton) {
        renameButton.disabled = !allManageable;
        renameButton.title = allManageable ? 'Rename selected photos (F2)' : 'You can only rename photos you manage';
      }
      const containsSourceProtectedPhoto = [...abearcMapSelectedPhotoIds].some(id => isProjectDocumentLinkedMapPhoto(featureById(id)));
      const deleteButton = toolbar.querySelector('[data-map-selection-delete]');
      if (deleteButton) {
        deleteButton.disabled = !allManageable || containsSourceProtectedPhoto;
        deleteButton.title = containsSourceProtectedPhoto
          ? 'Remove the source file from its project record to delete this map photo'
          : (allManageable ? 'Delete selected photos' : 'You can only delete photos you manage');
      }
      const availableIds = selectableAbearcMapPhotoIds();
      const selectAll = toolbar.querySelector('[data-map-select-all]');
      if (selectAll) {
        selectAll.disabled = availableIds.length === 0;
        selectAll.checked = availableIds.length > 0 && availableIds.every(id => abearcMapSelectedPhotoIds.has(id));
        selectAll.indeterminate = count > 0 && !selectAll.checked;
      }
    }

    function closeAbearcMapResultsActionMenu() {
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(menu => menu.removeAttribute('open'));
    }

    function beginAbearcMapPhotoSelection() {
      closeAbearcMapResultsActionMenu();
      abearcMapPhotoSelectionMode = true;
      abearcMapSelectedPhotoIds.clear();
      renderAbearcMapList();
      document.querySelector('[data-map-select-all]')?.focus({ preventScroll: true });
    }

    function cancelAbearcMapPhotoSelection() {
      abearcMapPhotoSelectionMode = false;
      abearcMapSelectedPhotoIds.clear();
      closeAbearcMapResultsActionMenu();
      closeAbearcMapListContextMenu();
      closeAbearcMapPhotoContextMenu();
      renderAbearcMapList();
      document.querySelector('.abearc-map-results-menu summary')?.focus({ preventScroll: true });
    }

    function toggleAbearcMapPhotoSelection(id, selected) {
      const feature = abearcMapFeatures.find(item => Number(abearcFeatureId(item)) === Number(id));
      if (!feature) return;
      if (selected) abearcMapSelectedPhotoIds.add(Number(id));
      else abearcMapSelectedPhotoIds.delete(Number(id));
      renderAbearcMapList();
    }

    function toggleAllAbearcMapPhotos(selected) {
      selectableAbearcMapPhotoIds().forEach(id => selected ? abearcMapSelectedPhotoIds.add(id) : abearcMapSelectedPhotoIds.delete(id));
      renderAbearcMapList();
    }

    function saveSelectedAbearcMapPhotos() {
      const ids = [...abearcMapSelectedPhotoIds];
      if (!ids.length) return toast('Select at least one photo.', 'error');
      let added = 0;
      ids.forEach(id => {
        if (abearcMapSavedPhotoIds.has(id)) return;
        abearcMapSavedPhotoIds.add(id);
        added += 1;
      });
      localStorage.setItem('abearcMapSavedPhotoIds', JSON.stringify([...abearcMapSavedPhotoIds]));
      renderAbearcMapList();
      syncAbearcMapRail();
      toast(added ? `${added.toLocaleString()} selected photo${added === 1 ? '' : 's'} saved.` : 'All selected photos are already saved.');
    }

    function renameSelectedAbearcMapPhotos() {
      if (!abearcMapSelectedPhotoIds.size) return toast('Select at least one of your photos.', 'error');
      renameAllAbearcMapCategories();
    }

    function downloadSelectedAbearcMapPhotos() {
      if (!abearcMapSelectedPhotoIds.size) return toast('Select at least one of your photos.', 'error');
      downloadAllAbearcMapPhotos();
    }

    function deleteSelectedAbearcMapPhotos() {
      if (!abearcMapSelectedPhotoIds.size) return toast('Select at least one of your photos.', 'error');
      deleteAllAbearcMapPhotos();
    }

    async function renameAllAbearcMapCategories() {
      const ids = currentAbearcMapBulkTargetIds();
      if (!ids.length) return toast('There are no manageable photos in the current results.', 'error');
      const scope = abearcMapPhotoSelectionMode ? 'selected' : 'your';
      const confirmed = await confirmModalChoice(
        `Rename the category for <strong>${ids.length.toLocaleString()}</strong> ${scope} photos currently shown in Photo Results?`,
        {
          title: 'Rename All Categories',
          confirmText: 'Continue',
          confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
        }
      );
      if (!confirmed) return;
      openAbearcMapEditModal('bulk-category', 'General', async value => {
        const category = String(value || '').trim();
        if (!category) throw new Error('Enter a photo category.');
        const result = await fetchJson(`${API}/map/media/bulk-rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, category })
        });
        toast(`${Number(result.renamed_count || ids.length).toLocaleString()} photo categories updated`);
        if (abearcMapPhotoSelectionMode) cancelAbearcMapPhotoSelection();
        await reloadAbearcMap();
      });
    }

    async function downloadAllAbearcMapPhotos() {
      const ids = abearcMapPhotoSelectionMode ? [...abearcMapSelectedPhotoIds] : currentAbearcMapPhotoIds();
      if (!ids.length) return toast('There are no photos in the current results.', 'error');
      const selectedScope = abearcMapPhotoSelectionMode;
      const confirmed = await confirmModalChoice(
        `Download ${selectedScope ? 'the selected' : 'all'} <strong>${ids.length.toLocaleString()}</strong> photos ${selectedScope ? '' : 'currently shown in Photo Results '}as a ZIP file?`,
        {
          title: selectedScope ? 'Download Selected Photos' : 'Download All Photos',
          confirmText: 'Download',
          confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
        }
      );
      if (!confirmed) return;
      const button = document.querySelector(selectedScope ? '[data-map-selection-download]' : '[data-map-bulk-download]');
      const label = button?.querySelector('span');
      if (button) button.disabled = true;
      if (label) label.textContent = 'Preparing...';
      try {
        const response = await fetch(`${API}/map/media/bulk-download`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids })
        });
        if (!response.ok) {
          const message = await response.json().then(data => data.error).catch(() => 'Failed to prepare the photo download.');
          throw new Error(message || 'Failed to prepare the photo download.');
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
        const filename = filenameMatch?.[1] || `geotag-map-photos-${new Date().toISOString().slice(0, 10)}.zip`;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        toast(`${ids.length.toLocaleString()} photos downloaded`);
      } catch (error) {
        toast(error.message || 'Failed to download map photos.', 'error');
      } finally {
        if (button) button.disabled = false;
        if (label) label.textContent = 'Download all';
      }
    }

    async function deleteAllAbearcMapPhotos() {
      const ids = currentAbearcMapBulkTargetIds();
      if (!ids.length) return toast('There are no manageable photos in the current results.', 'error');
      const scope = abearcMapPhotoSelectionMode ? 'selected' : 'your';
      const confirmed = await confirmModalChoice(
        `Permanently delete <strong>${ids.length.toLocaleString()}</strong> ${scope} photos currently shown in Photo Results? This cannot be undone.`,
        { title: abearcMapPhotoSelectionMode ? 'Delete Selected Photos' : 'Delete Photos', confirmText: 'Delete photos' }
      );
      if (!confirmed) return;
      const button = document.querySelector('[data-map-bulk-delete]');
      const label = button?.querySelector('span');
      if (button) button.disabled = true;
      if (label) label.textContent = 'Deleting...';
      try {
        const result = await fetchJson(`${API}/map/media/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        removeAbearcSavedPhotoIds(ids);
        closeAbearcMapDetails();
        toast(`${Number(result.deleted_count || ids.length).toLocaleString()} photos deleted`);
        if (abearcMapPhotoSelectionMode) cancelAbearcMapPhotoSelection();
        await reloadAbearcMap();
      } catch (error) {
        toast(error.message || 'Failed to delete map photos.', 'error');
      } finally {
        if (button) button.disabled = false;
        if (label) label.textContent = 'Delete all';
      }
    }

    function bearingArrowHtml(bearing, extraClass = '') {
      const value = Number(bearing);
      if (!Number.isFinite(value)) return '';
      const normalized = ((value % 360) + 360) % 360;
      const mapBearing = abearcMap && typeof abearcMap.getBearing === 'function' ? Number(abearcMap.getBearing()) || 0 : 0;
      const screenBearing = ((normalized - mapBearing) % 360 + 360) % 360;
      const className = `abearc-map-bearing-arrow${extraClass ? ` ${extraClass}` : ''}`;
      return `<span class="${className}" style="--bearing:${screenBearing}deg" title="Facing ${normalized.toFixed(0)} degrees"></span>`;
    }

    function downloadAbearcMapOriginal(id, filename = '') {
      const photoId = Number(id);
      if (!Number.isFinite(photoId) || photoId <= 0) return;
      const link = document.createElement('a');
      link.href = abearcAuthenticatedMediaUrl(`${API}/map/media/${photoId}/original?download=1`);
      link.download = filename || `map-photo-${photoId}`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function downloadAbearcMapPhotoFromContext() {
      const id = Number(abearcMapThumbnailContextId);
      closeAbearcMapPhotoContextMenu();
      if (Number.isFinite(id) && id > 0) downloadAbearcMapOriginal(id);
    }

    function openAbearcMapOriginalViewer(id, url, filename = '') {
      const viewer = document.getElementById('abearcMapOriginalViewer');
      if (!viewer) return;
      if (viewer.parentElement !== document.body) document.body.appendChild(viewer);
      viewer.classList.remove('hidden');
      document.body.classList.add('abearc-map-original-open');
      viewer.innerHTML = `
        <div class="abearc-map-original-toolbar">
          <button type="button" class="abearc-map-original-close" aria-label="Close full photo preview">Back</button>
          <button type="button" class="abearc-map-original-download" aria-label="Download original photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
            <span>Download</span>
          </button>
        </div>
        <img src="${esc(abearcAuthenticatedMediaUrl(url))}" alt="Original map photo">
      `;
      viewer.querySelector('.abearc-map-original-close')?.addEventListener('click', closeAbearcMapOriginalViewer);
      viewer.querySelector('.abearc-map-original-download')?.addEventListener('click', () => downloadAbearcMapOriginal(id, filename));
    }

    function closeAbearcMapOriginalViewer() {
      const viewer = document.getElementById('abearcMapOriginalViewer');
      if (!viewer) return;
      viewer.classList.add('hidden');
      viewer.innerHTML = '';
      document.body.classList.remove('abearc-map-original-open');
    }

    function closeAbearcMapPhotoContextMenu() {
      document.querySelector('[data-map-photo-context-menu]')?.classList.add('hidden');
      abearcMapThumbnailContextId = null;
    }

    function closeAbearcMapListContextMenu() {
      const menu = document.querySelector('[data-map-list-context-menu]');
      if (!menu) return;
      menu.classList.add('hidden');
      delete menu.dataset.photoId;
      delete menu.dataset.current;
    }

    function openAbearcMapPhotoContextMenu(event, featureId) {
      const id = Number(featureId);
      if (!Number.isFinite(id) || !featureById(id) || !abearcMapPhotoMarkers.has(`photo:${id}`)) return;
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapMeasureContextMenu();
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(details => details.removeAttribute('open'));
      const menu = document.querySelector('[data-map-photo-context-menu]');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      abearcMapThumbnailContextId = id;
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 190;
      const height = menu.offsetHeight || 44;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function openAbearcMapListContextMenu(event, id, current = 'General') {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      closeAbearcMapPhotoContextMenu();
      closeAbearcMapMeasureContextMenu();
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(details => details.removeAttribute('open'));
      const menu = document.querySelector('[data-map-list-context-menu]');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      abearcMapSelectedPhotoId = Number(id);
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => item.classList.toggle('is-selected', Number(item.dataset.mapListPhotoId) === Number(id)));
      scheduleAbearcMapMarkerRender();
      menu.dataset.photoId = Number(id);
      menu.dataset.current = current || 'General';
      const feature = featureById(id);
      const manageable = feature ? canManageAbearcMapPhoto(feature) : false;
      const sourceProtected = feature ? isProjectDocumentLinkedMapPhoto(feature) : false;
      const renameButton = menu.querySelector('[data-map-list-menu-rename]');
      const deleteButton = menu.querySelector('[data-map-list-menu-delete]');
      const saveButton = menu.querySelector('[data-map-list-menu-save]');
      renameButton?.classList.toggle('hidden', !manageable);
      deleteButton?.classList.toggle('hidden', !manageable || sourceProtected);
      if (saveButton) {
        saveButton.dataset.mapSavePhotoId = Number(id);
        saveButton.onclick = () => {
          closeAbearcMapListContextMenu();
          toggleAbearcSavedPhoto(id);
        };
      }
      syncAbearcMapRail();
      renameButton.onclick = () => {
        closeAbearcMapListContextMenu();
        editAbearcMapField(id, 'category', current || 'General');
      };
      menu.querySelector('[data-map-list-menu-download]').onclick = () => {
        closeAbearcMapListContextMenu();
        downloadAbearcMapOriginal(id);
      };
      deleteButton.onclick = () => {
        closeAbearcMapListContextMenu();
        deleteAbearcMapPhoto(id);
      };
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 190;
      const height = menu.offsetHeight || 92;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, (event?.clientX || bounds.left + 24) - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, (event?.clientY || bounds.top + 24) - bounds.top))}px`;
    }

    function finishAbearcMapThumbnailMoveMode() {
      const id = Number(abearcMapThumbnailMoveId);
      const binding = abearcMapPhotoDragBindings.get(id);
      if (binding) {
        binding.marker.off('drag', binding.onDrag);
        binding.marker.off('dragend', binding.onDragEnd);
        binding.marker.setDraggable(false);
        binding.marker.getElement()?.classList.remove('is-moving');
        abearcMapPhotoDragBindings.delete(id);
      }
      abearcMapThumbnailMoveId = null;
    }

    function beginAbearcMapThumbnailMove() {
      const id = Number(abearcMapThumbnailContextId);
      closeAbearcMapPhotoContextMenu();
      const marker = abearcMapPhotoMarkers.get(`photo:${id}`);
      if (!Number.isFinite(id) || !marker) return toast('This photo must be shown individually before it can be moved.', 'error');
      finishAbearcMapThumbnailMoveMode();
      abearcMapThumbnailMoveId = id;
      const onDrag = () => {
        const position = marker.getLngLat();
        abearcMapMovedPhotoPositions.set(id, [position.lng, position.lat]);
        renderAbearcMapMovedPhotoLeaders();
      };
      const onDragEnd = () => {
        const position = marker.getLngLat();
        abearcMapMovedPhotoPositions.set(id, [position.lng, position.lat]);
        abearcMapPhotoSuppressOpenUntil.set(id, Date.now() + 650);
        finishAbearcMapThumbnailMoveMode();
        marker.getElement()?.classList.add('is-moved');
        renderAbearcMapMovedPhotoLeaders();
        toast('Photo thumbnail moved. Its original GPS location is connected by the leader line.');
      };
      abearcMapPhotoDragBindings.set(id, { marker, onDrag, onDragEnd });
      marker.on('drag', onDrag);
      marker.on('dragend', onDragEnd);
      marker.setDraggable(true);
      marker.getElement()?.classList.add('is-moving');
      toast('Drag the photo thumbnail to its preferred map position. The leader line will follow automatically.');
    }

    function resetAbearcMapThumbnailMoves() {
      closeAbearcMapPhotoContextMenu();
      finishAbearcMapThumbnailMoveMode();
      abearcMapMovedPhotoPositions.clear();
      abearcMapPhotoSuppressOpenUntil.clear();
      renderAbearcMapPhotoMarkers();
      renderAbearcMapMovedPhotoLeaders();
    }

    function renderAbearcMapMovedPhotoLeaders() {
      const leaders = document.querySelector('[data-map-moved-photo-leader-layer]');
      if (!leaders || !abearcMap) return;
      leaders.innerHTML = '';
      if (!abearcMapPhotosVisible) return;
      leaders.setAttribute('viewBox', `0 0 ${Math.max(1, leaders.clientWidth)} ${Math.max(1, leaders.clientHeight)}`);
      abearcMapMovedPhotoPositions.forEach((position, id) => {
        const feature = featureById(id);
        if (!feature?.geometry?.coordinates || !Array.isArray(position)) return;
        const origin = abearcMap.project(feature.geometry.coordinates);
        const callout = abearcMap.project(position);
        ['abearc-map-photo-leader-casing', 'abearc-map-photo-leader-line'].forEach(className => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', origin.x);
          line.setAttribute('y1', origin.y);
          line.setAttribute('x2', callout.x);
          line.setAttribute('y2', callout.y);
          line.setAttribute('class', className);
          leaders.appendChild(line);
        });
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', origin.x);
        dot.setAttribute('cy', origin.y);
        dot.setAttribute('r', '4');
        dot.setAttribute('class', 'abearc-map-photo-leader-dot');
        leaders.appendChild(dot);
      });
    }

    function renderAbearcMapExplosion() {
      const layer = document.getElementById('abearcMapExplosionLayer');
      const leaders = document.getElementById('abearcMapLeaderLayer');
      if (!layer || !leaders) return;
      layer.innerHTML = '';
      leaders.innerHTML = '';
      if (!abearcMapPhotosVisible) return;
      if (!abearcMapExploded) return;
      if (abearcMapExploded.collapsing) return;
      const positions = explosionPositions(abearcMapExploded.features);
      leaders.setAttribute('viewBox', `0 0 ${Math.max(1, leaders.clientWidth)} ${Math.max(1, leaders.clientHeight)}`);
      abearcMapExploded.features.forEach((feature, index) => {
        const featureId = Number(abearcFeatureId(feature));
        const pos = positions[index];
        const origin = abearcMap.project(feature.geometry.coordinates);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', origin.x);
        line.setAttribute('y1', origin.y);
        line.setAttribute('x2', pos.x);
        line.setAttribute('y2', pos.y);
        line.setAttribute('pathLength', '1');
        line.setAttribute('class', 'abearc-map-explosion-line');
        line.setAttribute('data-map-photo-id', String(featureId));
        line.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        leaders.appendChild(line);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', origin.x);
        dot.setAttribute('cy', origin.y);
        dot.setAttribute('r', '4');
        dot.setAttribute('class', 'abearc-map-explosion-dot');
        dot.setAttribute('data-map-photo-id', String(featureId));
        dot.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        leaders.appendChild(dot);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `abearc-map-exploded-photo${abearcMapExploded.animated ? '' : ' is-animating'}${featureId === Number(abearcMapExploded.selectedId) || featureId === Number(abearcMapSelectedPhotoId) ? ' is-selected' : ''}`;
        btn.dataset.mapPhotoId = featureId;
        btn.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        btn.style.left = `${pos.x}px`;
        btn.style.top = `${pos.y}px`;
        btn.style.setProperty('--explode-from-x', `${origin.x - pos.x}px`);
        btn.style.setProperty('--explode-from-y', `${origin.y - pos.y}px`);
        btn.title = feature.properties.category || 'Map photo';
        btn.onclick = (event) => {
          event.stopPropagation();
          if (abearcMapMeasureMode !== 'off') {
            if (event.detail > 1) return;
            return addAbearcMeasurePointAt(feature.geometry.coordinates);
          }
          abearcMapExploded.selectedId = featureId;
          openAbearcMapDetails(featureId);
          renderAbearcMapExplosion();
        };
        btn.ondblclick = (event) => {
          if (abearcMapMeasureMode === 'off') return;
          event.preventDefault();
          event.stopPropagation();
          deleteAbearcMeasurePointNear(feature.geometry.coordinates);
        };
        const bearing = feature.properties?.bearing_deg ?? feature.bearing_deg;
        btn.innerHTML = feature.properties.thumbnail_url ? `<img alt="" src="${abearcAuthenticatedMediaUrl(feature.properties.thumbnail_url)}">${bearingArrowHtml(bearing, 'abearc-map-bearing-arrow--exploded')}` : `${abearcMarkerPlaceholder()}${bearingArrowHtml(bearing, 'abearc-map-bearing-arrow--exploded')}`;
        layer.appendChild(btn);
      });
      abearcMapExploded.animated = true;
    }

    function collapseAbearcMapExplosionForMovement() {
      if (!abearcMapExploded || !abearcMapStartMovePoint) return;
      renderAbearcMapExplosion();
    }

    function finishAbearcMapExplosionCollapse() {
      if (abearcMapExplosionCollapseTimer) {
        clearTimeout(abearcMapExplosionCollapseTimer);
        abearcMapExplosionCollapseTimer = null;
      }
      abearcMapExploded = null;
      const layer = document.getElementById('abearcMapExplosionLayer');
      const leaders = document.getElementById('abearcMapLeaderLayer');
      if (leaders) leaders.classList.remove('is-collapsing');
      if (layer) layer.innerHTML = '';
      if (leaders) leaders.innerHTML = '';
      renderAbearcMapPhotoMarkers();
    }

    function collapseAbearcMapExplosion({ animate = true } = {}) {
      if (!abearcMapExploded) return;
      const layer = document.getElementById('abearcMapExplosionLayer');
      const leaders = document.getElementById('abearcMapLeaderLayer');
      if (!animate || !layer || !leaders || !layer.querySelector('.abearc-map-exploded-photo')) {
        finishAbearcMapExplosionCollapse();
        return;
      }
      abearcMapExploded.collapsing = true;
      leaders.classList.add('is-collapsing');
      layer.querySelectorAll('.abearc-map-exploded-photo').forEach(btn => btn.classList.add('is-collapsing'));
      if (abearcMapExplosionCollapseTimer) clearTimeout(abearcMapExplosionCollapseTimer);
      abearcMapExplosionCollapseTimer = setTimeout(finishAbearcMapExplosionCollapse, 230);
    }

    async function openAbearcMapDetails(id) {
      const panel = document.getElementById('abearcMapDetails');
      if (!panel) return;
      abearcMapSelectedPhotoId = Number(id);
      if (window.matchMedia('(max-width: 900px)').matches) toggleAbearcMapResults(false);
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => {
        item.classList.toggle('is-selected', Number(item.dataset.mapListPhotoId) === Number(id));
      });
      scheduleAbearcMapMarkerRender();
      if (abearcMapExploded) {
        abearcMapExploded.selectedId = Number(id);
        renderAbearcMapExplosion();
      }
      const feature = featureById(id);
      panel.classList.remove('hidden');
      panel.innerHTML = `
        <div class="abearc-map-detail-shell">
          <div class="abearc-map-detail-head">
            <div>
              <div class="abearc-map-detail-kicker">Photo details</div>
              <div class="abearc-map-detail-title">Loading...</div>
            </div>
          </div>
          <div class="abearc-map-detail-scroll">
            <div class="abearc-map-detail-body text-sm text-gray-500 dark:text-gray-400">Loading photo details...</div>
          </div>
        </div>`;
      try {
        const row = await fetchJson(`${API}/map/media/${Number(id)}`, { silentLoading: true });
        const locationText = mapMediaLocationText(row);
        const remarksText = mapMediaRemarksText(row);
        const photoUrl = row.original_url || row.thumbnail_url || '';
        const latitude = Number(row.latitude);
        const longitude = Number(row.longitude);
        const canManage = canManageAbearcMapPhoto(row);
        const sourceProtected = isProjectDocumentLinkedMapPhoto(row);
        const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
          ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : 'N/A';
        panel.innerHTML = `
          <div class="abearc-map-detail-shell">
            <header class="abearc-map-detail-head">
              <div>
                <div class="abearc-map-detail-kicker">Photo details</div>
                <div class="abearc-map-detail-title">
                  <span>${esc(row.category || 'General')}</span>
                  ${canManage ? `<button type="button" data-map-edit-field="category" data-current="${esc(row.category || 'General')}" class="abearc-map-icon-edit" title="Edit category">${editSvgMarkup()}</button>` : ''}
                </div>
                <div class="abearc-map-detail-date">${esc(formatAbearcMapDate(row.captured_at || row.uploaded_at))}</div>
              </div>
              <button type="button" data-map-details-close class="abearc-map-detail-close" aria-label="Close photo details" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18"/></svg>
              </button>
            </header>
            <div class="abearc-map-detail-scroll">
              ${row.thumbnail_url ? `<button type="button" data-map-original-url="${esc(photoUrl)}" data-map-original-filename="${esc(row.original_filename || `map-photo-${id}`)}" class="abearc-map-detail-image-wrap"><img src="${abearcAuthenticatedMediaUrl(row.thumbnail_url)}" alt="${esc(row.category || 'Map photo')}"></button>` : ''}
              <div class="abearc-map-detail-body">
                <div class="abearc-map-detail-photo-actions">
                  <span class="abearc-map-detail-status">${esc(mapMediaAgeStatus(row))}</span>
                  <button type="button" data-map-save-photo-id="${id}" onclick="toggleAbearcSavedPhoto(${id})" class="abearc-map-detail-save${abearcMapSavedPhotoIds.has(Number(id)) ? ' is-saved' : ''}" aria-pressed="${abearcMapSavedPhotoIds.has(Number(id))}" aria-label="${abearcMapSavedPhotoIds.has(Number(id)) ? 'Remove from saved photos' : 'Save photo'}" title="${abearcMapSavedPhotoIds.has(Number(id)) ? 'Remove from saved' : 'Save photo'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.7L6 21V4.5Z"/></svg>
                  </button>
                  ${canManage && !sourceProtected ? `<button type="button" data-map-delete-photo class="abearc-map-detail-delete" aria-label="Delete photo" title="Delete photo">
                    ${svgDelete}
                  </button>` : ''}
                </div>
                ${locationText ? `<div class="abearc-map-detail-location">${esc(locationText)}</div>` : ''}
                <dl class="abearc-map-detail-metadata">
                  <div class="abearc-map-detail-row"><dt>Coordinates</dt><dd>${esc(coordinates)}</dd></div>
                  <div class="abearc-map-detail-row"><dt>Accuracy</dt><dd>${row.accuracy_m == null ? 'N/A' : `${esc(row.accuracy_m)} m`}</dd></div>
                  <div class="abearc-map-detail-row"><dt>Zoning</dt><dd>${esc(mapMediaZoningText(row))}</dd></div>
                  <div class="abearc-map-detail-row"><dt>Project</dt><dd>${esc(row.project_name || 'Unlinked')}</dd></div>
                  ${sourceProtected ? '<div class="abearc-map-detail-row"><dt>Source</dt><dd>Reviewed project document (remove it from the project record to delete this map photo)</dd></div>' : ''}
                  <div class="abearc-map-detail-row"><dt>Uploaded by</dt><dd>${esc(row.uploaded_by_username || row.owner_username || 'Unknown')}</dd></div>
                </dl>
                <div class="abearc-map-detail-remarks">
                  <div class="abearc-map-detail-remarks-head">
                    <span>Remarks</span>
                    ${canManage ? `<button type="button" data-map-edit-field="remarks" data-current="${esc(remarksText)}" class="abearc-map-icon-edit" title="Edit remarks">${editSvgMarkup()}</button>` : ''}
                  </div>
                  <p>${esc(remarksText)}</p>
                </div>
              </div>
            </div>
          </div>`;
        bindAbearcMapDetailsActions(panel, id);
        syncAbearcMapRail();
        if (feature) abearcMap.easeTo({ center: feature.geometry.coordinates, duration: 250 });
      } catch (e) {
        panel.innerHTML = `<div class="p-4 text-sm text-red-700 dark:text-red-300">${esc(e.message || 'Failed to load photo details')}</div>`;
      }
    }

    function closeAbearcMapDetails() {
      const panel = document.getElementById('abearcMapDetails');
      panel?.classList.add('hidden');
      abearcMapSelectedPhotoId = null;
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => item.classList.remove('is-selected'));
      scheduleAbearcMapMarkerRender();
      if (abearcMapExploded) {
        abearcMapExploded.selectedId = null;
        renderAbearcMapExplosion();
      }
    }

    function bindAbearcMapDetailsActions(panel, id) {
      panel.querySelector('[data-map-details-close]')?.addEventListener('click', closeAbearcMapDetails);
      panel.querySelectorAll('[data-map-edit-field]').forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          editAbearcMapField(id, button.dataset.mapEditField, button.dataset.current || '');
        });
      });
      panel.querySelector('[data-map-original-url]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openAbearcMapOriginalViewer(id, event.currentTarget.dataset.mapOriginalUrl || '', event.currentTarget.dataset.mapOriginalFilename || '');
      });
      panel.querySelector('[data-map-delete-photo]')?.addEventListener('click', () => deleteAbearcMapPhoto(id));
    }

    async function deleteAbearcMapPhoto(id) {
      const confirmed = await confirmModalChoice(
        'Permanently delete this Geotag Map photo? This cannot be undone.',
        { title: 'Delete Photo', confirmText: 'Delete photo' }
      );
      if (!confirmed) return;
      try {
        await fetchJson(`${API}/map/media/${Number(id)}`, { method: 'DELETE' });
        removeAbearcSavedPhotoIds([id]);
        closeAbearcMapDetails();
        toast('Map photo deleted');
        await reloadAbearcMap();
      } catch (error) {
        toast(error.message || 'Failed to delete map photo.', 'error');
      }
    }

    async function hideAbearcMapPhoto(id) {
      try {
        await fetchJson(`${API}/map/media/${Number(id)}/hide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        toast('Map photo hidden. Enable Hidden to restore it.');
        document.getElementById('abearcMapDetails')?.classList.add('hidden');
        reloadAbearcMap();
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    async function restoreAbearcMapPhoto(id) {
      try {
        await fetchJson(`${API}/map/media/${Number(id)}/restore`, { method: 'POST' });
        toast('Map photo restored');
        document.getElementById('abearcMapDetails')?.classList.add('hidden');
        reloadAbearcMap();
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    function renderAbearcMapList() {
      const list = document.getElementById('abearcMapList');
      if (!list) return;
      const items = abearcMapVisibleListFeatures().slice(0, 80);
      list.innerHTML = items.length ? items.map(f => {
        const locationText = mapMediaLocationText(f.properties);
        const id = Number(abearcFeatureId(f));
        const selectionControl = abearcMapPhotoSelectionMode
          ? `<label class="abearc-map-list-selector" title="Select photo"><input type="checkbox" ${abearcMapSelectedPhotoIds.has(id) ? 'checked' : ''} onchange="toggleAbearcMapPhotoSelection(${id}, this.checked)" aria-label="Select ${esc(f.properties.category || 'photo')}"></label>`
          : '';
        return `
        <div data-map-list-photo-id="${id}" class="abearc-map-list-item${id === Number(abearcMapSelectedPhotoId) ? ' is-selected' : ''}${abearcMapSelectedPhotoIds.has(id) ? ' is-multi-selected' : ''}${abearcMapPhotoSelectionMode ? ' is-selection-mode' : ''}" oncontextmenu="openAbearcMapListContextMenu(event, ${id}, '${esc(f.properties.category || 'General')}')">
          ${selectionControl}
          <button type="button" class="abearc-map-list-open" onclick="openAbearcMapResultPhoto(event, ${id})" ondblclick="zoomAbearcMapPhotoToTenMeterScale(event, ${id})">
            <span class="abearc-map-list-thumb">
              ${f.properties.thumbnail_url ? `<img alt="" src="${abearcAuthenticatedMediaUrl(f.properties.thumbnail_url)}">` : abearcMarkerPlaceholder()}
            </span>
            <span class="abearc-map-list-content">
              <span class="abearc-map-list-title">${esc(f.properties.category || 'General')}</span>
              <span class="abearc-map-list-place">${esc(locationText || 'Barangay/district unavailable')}</span>
              <span class="abearc-map-list-meta">${esc(mapMediaAgeStatus(f.properties))}</span>
            </span>
          </button>
          ${!abearcMapPhotoSelectionMode ? `<button type="button" data-map-list-menu-id="${id}" data-current="${esc(f.properties.category || 'General')}" class="abearc-map-list-edit" title="More actions" aria-label="More actions"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg></button>` : ''}
        </div>
      `}).join('') : `<div class="abearc-map-list-empty">${abearcMapPhotoScope === 'saved'
        ? 'No saved photos yet. Use Save photo from a photo\'s three-dot menu.'
        : (abearcMapPhotoScope === 'mine' ? 'You have no geotagged photo uploads in this view.' : 'No map photos match this view.')}</div>`;
      updateAbearcMapWorkspaceSummary();
      updateAbearcMapPhotoSelectionToolbar();
      syncAbearcMapRail();
      list.querySelectorAll('[data-map-list-menu-id]').forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          openAbearcMapListContextMenu(event, button.dataset.mapListMenuId, button.dataset.current || 'General');
        });
      });
      list.querySelectorAll('[data-map-list-photo-id]').forEach(item => {
        const id = Number(item.dataset.mapListPhotoId);
        item.addEventListener('pointerenter', () => setAbearcMapPhotoHover(id));
        item.addEventListener('pointerleave', () => {
          if (!item.matches(':focus-within')) clearAbearcMapPhotoHover(id);
        });
        item.addEventListener('focusin', () => setAbearcMapPhotoHover(id));
        item.addEventListener('focusout', () => requestAnimationFrame(() => {
          if (!item.matches(':focus-within')) clearAbearcMapPhotoHover(id);
        }));
      });
      syncAbearcMapPhotoHover();
    }

    function setAbearcMapMeasureMode(mode) {
      abearcMapMeasureMode = abearcMapMeasureMode === mode ? 'off' : mode;
      abearcMapMeasurePoints = [];
      saveAbearcMapMeasure();
      resetAbearcElevationProfile();
      updateAbearcMapMeasureTools();
      renderAbearcMapMeasure();
      toast(abearcMapMeasureMode === 'off' ? 'Ruler off' : `${abearcMapMeasureMode === 'area' ? 'Area' : 'Distance'} ruler on`);
    }

    function clearAbearcMapMeasure() {
      const hadMeasurement = abearcMapMeasurePoints.length > 0;
      abearcMapMeasurePoints = [];
      removeSavedAbearcMapMeasure();
      resetAbearcElevationProfile();
      updateAbearcMapMeasureTools();
      renderAbearcMapMeasure();
      if (hadMeasurement) toast('Measurement cleared');
    }

    function toggleAbearcMapMeasureTools(forceExpanded = null) {
      const panel = document.querySelector('[data-map-measure-panel]');
      if (!panel) return;
      const expanded = forceExpanded === null
        ? panel.classList.contains('is-collapsed')
        : !!forceExpanded;
      panel.classList.toggle('is-collapsed', !expanded);
      const toggle = panel.querySelector('[data-map-measure-toggle]');
      if (toggle) {
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.title = expanded ? 'Collapse measurement tools' : 'Open measurement tools';
      }
      panel.querySelector('.abearc-map-measure-actions')?.setAttribute(
        'aria-hidden', expanded ? 'false' : 'true');
    }

    function updateAbearcMapMeasureTools() {
      const panel = document.querySelector('[data-map-measure-panel]');
      if (panel) panel.dataset.mode = abearcMapMeasureMode;
      document.querySelectorAll('[data-map-measure-mode]').forEach(button => {
        const active = button.dataset.mapMeasureMode === abearcMapMeasureMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const clearButton = document.querySelector('[data-map-measure-clear]');
      if (clearButton) clearButton.disabled = abearcMapMeasurePoints.length === 0;
      const status = document.querySelector('[data-map-measure-status]');
      if (!status) return;
      if (abearcMapMeasureMode === 'off') status.textContent = 'Choose a tool';
      else if (!abearcMapMeasurePoints.length) {
        status.textContent = abearcMapMeasureMode === 'area' ? 'Tap 3 or more points' : 'Tap the map to start';
      } else if (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length < 3) {
        status.textContent = `${abearcMapMeasurePoints.length} point${abearcMapMeasurePoints.length === 1 ? '' : 's'} · ${3 - abearcMapMeasurePoints.length} more needed`;
      } else if ((abearcMapMeasureMode === 'distance' && abearcMapMeasurePoints.length > 1)
          || (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2)) {
        status.textContent = `Right-click ${abearcMapMeasureMode === 'area' ? 'area' : 'line'} for options`;
      } else {
        status.textContent = `${abearcMapMeasurePoints.length} point${abearcMapMeasurePoints.length === 1 ? '' : 's'} placed`;
      }
    }

    function addAbearcMeasurePoint(lngLat) {
      abearcMapMeasurePoints.push([lngLat.lng, lngLat.lat]);
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function addAbearcMeasurePointAt(coordinates) {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      abearcMapMeasurePoints.push([lng, lat]);
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function deleteAbearcMeasurePointNear(coordinates) {
      if (!abearcMap || !Array.isArray(coordinates) || abearcMapMeasurePoints.length === 0) return;
      const target = abearcMap.project(coordinates);
      let bestIndex = -1;
      let bestDistance = Infinity;
      abearcMapMeasurePoints.forEach((point, index) => {
        const projected = abearcMap.project(point);
        const distance = Math.hypot(projected.x - target.x, projected.y - target.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      if (bestIndex >= 0 && bestDistance <= 18) {
        abearcMapMeasurePoints.splice(bestIndex, 1);
        saveAbearcMapMeasure();
        renderAbearcMapMeasure();
      }
    }

    function measurePointAtEvent(event) {
      if (!abearcMap || abearcMapMeasurePoints.length === 0) return -1;
      const rect = abearcMap.getCanvasContainer().getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return abearcMapMeasurePoints.findIndex(point => {
        const projected = abearcMap.project(point);
        return Math.hypot(projected.x - x, projected.y - y) <= 13;
      });
    }

    function startAbearcMeasureDrag(event, index) {
      event.preventDefault();
      event.stopPropagation();
      abearcMapDraggingMeasureIndex = index;
      abearcMap?.dragPan?.disable();
      window.addEventListener('pointermove', dragAbearcMeasurePoint);
      window.addEventListener('pointerup', stopAbearcMeasureDrag, { once: true });
    }

    function dragAbearcMeasurePoint(event) {
      if (abearcMapDraggingMeasureIndex === null || !abearcMap) return;
      const rect = abearcMap.getCanvasContainer().getBoundingClientRect();
      const lngLat = abearcMap.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      abearcMapMeasurePoints[abearcMapDraggingMeasureIndex] = [lngLat.lng, lngLat.lat];
      renderAbearcMapMeasure();
    }

    function stopAbearcMeasureDrag() {
      if (abearcMapDraggingMeasureIndex !== null) saveAbearcMapMeasure();
      abearcMapDraggingMeasureIndex = null;
      abearcMap?.dragPan?.enable();
      window.removeEventListener('pointermove', dragAbearcMeasurePoint);
    }

    function deleteAbearcMeasurePoint(event, index) {
      event.preventDefault();
      event.stopPropagation();
      abearcMapMeasurePoints.splice(index, 1);
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function haversineMetres(a, b) {
      const R = 6371008.8;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(b[1] - a[1]);
      const dLng = toRad(b[0] - a[0]);
      const lat1 = toRad(a[1]);
      const lat2 = toRad(b[1]);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    function formatAbearcDistance(m) {
      return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km` : `${m.toFixed(1)} m`;
    }

    function abearcMeasurePathDistance(points = abearcMapMeasurePoints) {
      return points.slice(1).reduce((sum, point, index) => sum + haversineMetres(points[index], point), 0);
    }

    function canShowAbearcElevationProfile() {
      return (abearcMapMeasureMode === 'distance' && abearcMapMeasurePoints.length > 1)
        || (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2);
    }

    function abearcElevationPathPoints() {
      if (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2) {
        return [...abearcMapMeasurePoints, abearcMapMeasurePoints[0]];
      }
      return abearcMapMeasurePoints;
    }

    function sampleAbearcMeasurePath(points = abearcElevationPathPoints()) {
      if (points.length < 2) return [];
      const segments = points.slice(1).map((point, index) => haversineMetres(points[index], point));
      const totalDistance = segments.reduce((sum, distance) => sum + distance, 0);
      if (!(totalDistance > 0)) return [];
      const sampleCount = Math.min(100, Math.max(24, Math.ceil(totalDistance / 90) + 1));
      const samples = [];
      let segmentIndex = 0;
      let segmentStartDistance = 0;
      for (let index = 0; index < sampleCount; index++) {
        const distance = totalDistance * index / (sampleCount - 1);
        while (segmentIndex < segments.length - 1 && distance > segmentStartDistance + segments[segmentIndex]) {
          segmentStartDistance += segments[segmentIndex++];
        }
        const segmentDistance = segments[segmentIndex] || 1;
        const ratio = Math.max(0, Math.min(1, (distance - segmentStartDistance) / segmentDistance));
        const start = points[segmentIndex];
        const end = points[segmentIndex + 1];
        samples.push({
          distance,
          longitude: start[0] + (end[0] - start[0]) * ratio,
          latitude: start[1] + (end[1] - start[1]) * ratio
        });
      }
      return samples;
    }

    function resetAbearcElevationProfile() {
      abearcMapElevationVisible = false;
      clearTimeout(abearcMapElevationTimer);
      abearcMapElevationAbort?.abort();
      abearcMapElevationAbort = null;
      abearcMapElevationKey = '';
      abearcMapElevationRequestId++;
      document.getElementById('abearcMapElevationProfile')?.classList.add('hidden');
      closeAbearcMapMeasureContextMenu();
    }

    function closeAbearcElevationProfile() {
      abearcMapElevationVisible = false;
      clearTimeout(abearcMapElevationTimer);
      abearcMapElevationAbort?.abort();
      abearcMapElevationAbort = null;
      abearcMapElevationRequestId++;
      document.getElementById('abearcMapElevationProfile')?.classList.add('hidden');
      document.querySelector('.abearc-map-elevation-menu')?.removeAttribute('open');
    }

    function showAbearcElevationProfile() {
      closeAbearcMapMeasureContextMenu();
      if (!canShowAbearcElevationProfile()) {
        return toast('Complete a distance line or area measurement first.', 'error');
      }
      abearcMapElevationVisible = true;
      abearcMapElevationKey = '';
      refreshAbearcElevationProfile(true);
    }

    function closeAbearcMapMeasureContextMenu() {
      document.getElementById('abearcMapMeasureContextMenu')?.classList.add('hidden');
    }

    function openAbearcMapMeasureContextMenu(event) {
      if (!canShowAbearcElevationProfile()) return;
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapPhotoContextMenu();
      const menu = document.getElementById('abearcMapMeasureContextMenu');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(details => details.removeAttribute('open'));
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 210;
      const height = menu.offsetHeight || 92;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function syncAbearcElevationSourceMenu() {
      let selectedLabel = '';
      document.querySelectorAll('[data-map-elevation-source]').forEach(button => {
        const selected = button.dataset.mapElevationSource === abearcMapElevationSource;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
        if (selected) selectedLabel = button.querySelector('strong')?.textContent?.trim() || '';
      });
      const label = document.querySelector('[data-map-elevation-selected-source]');
      if (label && selectedLabel) {
        label.textContent = selectedLabel;
        label.title = selectedLabel;
      }
    }

    function setAbearcElevationLoading() {
      const panel = document.getElementById('abearcMapElevationProfile');
      const body = panel?.querySelector('[data-map-elevation-body]');
      if (!panel || !body) return;
      const kicker = panel.querySelector('[data-map-elevation-kicker]');
      if (kicker) kicker.textContent = abearcMapMeasureMode === 'area' ? 'Area perimeter' : 'Distance measurement';
      syncAbearcElevationSourceMenu();
      panel.classList.remove('hidden');
      panel.dataset.state = 'loading';
      body.innerHTML = '<div class="abearc-map-elevation-loading"><span></span>Loading terrain elevations...</div>';
    }

    function refreshAbearcElevationProfile(force = false) {
      const eligible = canShowAbearcElevationProfile();
      if (!eligible) return resetAbearcElevationProfile();
      if (!abearcMapElevationVisible) return;
      const key = `${abearcMapElevationSource}:${abearcMapMeasurePoints.map(point => point.map(value => Number(value).toFixed(6)).join(',')).join('|')}`;
      if (!force && key === abearcMapElevationKey) return;
      abearcMapElevationKey = key;
      clearTimeout(abearcMapElevationTimer);
      abearcMapElevationAbort?.abort();
      setAbearcElevationLoading();
      const requestId = ++abearcMapElevationRequestId;
      abearcMapElevationTimer = setTimeout(() => loadAbearcElevationProfile(requestId), force ? 0 : 450);
    }

    async function loadAbearcElevationProfile(requestId) {
      const samples = sampleAbearcMeasurePath();
      if (samples.length < 2 || requestId !== abearcMapElevationRequestId) return;
      abearcMapElevationAbort = new AbortController();
      try {
        const response = await fetch(`${API}/map/elevation-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: abearcMapElevationSource,
            locations: samples.map(sample => ({ latitude: sample.latitude, longitude: sample.longitude }))
          }),
          signal: abearcMapElevationAbort.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Elevation data is unavailable.');
        if (requestId !== abearcMapElevationRequestId) return;
        if (data.source_key !== abearcMapElevationSource) {
          throw new Error('The elevation source response did not match the selected dataset. Refresh the app and try again.');
        }
        const elevations = Array.isArray(data.elevations) ? data.elevations.map(Number) : [];
        if (elevations.length !== samples.length || elevations.some(value => !Number.isFinite(value))) {
          throw new Error('Elevation data is incomplete.');
        }
        renderAbearcElevationProfile(samples.map((sample, index) => ({ ...sample, elevation: elevations[index] })));
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== abearcMapElevationRequestId) return;
        renderAbearcElevationError(error.message);
      } finally {
        if (requestId === abearcMapElevationRequestId) abearcMapElevationAbort = null;
      }
    }

    function setAbearcElevationSource(source) {
      if (!ABEARC_MAP_ELEVATION_SOURCES.has(source)) return;
      abearcMapElevationSource = source;
      abearcMapElevationKey = '';
      syncAbearcElevationSourceMenu();
      if (abearcMapElevationVisible) refreshAbearcElevationProfile(true);
    }

    function renderAbearcElevationError(message) {
      const panel = document.getElementById('abearcMapElevationProfile');
      const body = panel?.querySelector('[data-map-elevation-body]');
      if (!panel || !body) return;
      panel.classList.remove('hidden');
      panel.dataset.state = 'error';
      body.innerHTML = `<div class="abearc-map-elevation-error"><strong>Profile unavailable</strong><span>${esc(message || 'Try refreshing the elevation profile.')}</span></div>`;
    }

    function renderAbearcElevationProfile(profile) {
      const panel = document.getElementById('abearcMapElevationProfile');
      const body = panel?.querySelector('[data-map-elevation-body]');
      if (!panel || !body || profile.length < 2) return;
      const elevations = profile.map(point => point.elevation);
      const minimum = Math.min(...elevations);
      const maximum = Math.max(...elevations);
      let ascent = 0;
      let descent = 0;
      for (let index = 1; index < elevations.length; index++) {
        const change = elevations[index] - elevations[index - 1];
        if (change > 0) ascent += change;
        else descent += Math.abs(change);
      }
      const width = 640;
      const height = 150;
      const plot = { left: 54, right: 12, top: 10, bottom: 34 };
      const plotWidth = width - plot.left - plot.right;
      const plotHeight = height - plot.top - plot.bottom;
      const totalDistance = profile[profile.length - 1].distance;
      const rawRange = Math.max(1, maximum - minimum);
      const roughStep = rawRange / 4;
      const magnitude = 10 ** Math.floor(Math.log10(roughStep));
      const normalizedStep = roughStep / magnitude;
      const yStep = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude;
      let chartMinimum = Math.floor((minimum - yStep * 0.35) / yStep) * yStep;
      let chartMaximum = Math.ceil((maximum + yStep * 0.35) / yStep) * yStep;
      if (chartMaximum <= chartMinimum) chartMaximum = chartMinimum + yStep;
      const x = distance => plot.left + (distance / totalDistance) * plotWidth;
      const y = elevation => plot.top + (chartMaximum - elevation) / (chartMaximum - chartMinimum) * plotHeight;
      const linePath = profile.map((point, index) => `${index ? 'L' : 'M'} ${x(point.distance).toFixed(1)} ${y(point.elevation).toFixed(1)}`).join(' ');
      const areaPath = `${linePath} L ${x(totalDistance).toFixed(1)} ${(plot.top + plotHeight).toFixed(1)} L ${plot.left} ${(plot.top + plotHeight).toFixed(1)} Z`;
      const distanceEnd = formatAbearcDistance(totalDistance);
      const yTicks = [];
      for (let value = chartMinimum; value <= chartMaximum + yStep * 0.25; value += yStep) yTicks.push(value);
      const distanceAxisUnit = totalDistance >= 5000 ? { divisor: 1000, label: 'km' } : { divisor: 1, label: 'm' };
      const distanceAxisTotal = totalDistance / distanceAxisUnit.divisor;
      const distanceRoughStep = Math.max(1, distanceAxisTotal / 4);
      const distanceMagnitude = 10 ** Math.floor(Math.log10(distanceRoughStep));
      const distanceNormalizedStep = distanceRoughStep / distanceMagnitude;
      const distanceStep = (distanceNormalizedStep <= 1 ? 1 : distanceNormalizedStep <= 2 ? 2 : distanceNormalizedStep <= 5 ? 5 : 10) * distanceMagnitude;
      const xTicks = [];
      for (let value = 0; value < distanceAxisTotal - distanceStep * 0.35; value += distanceStep) {
        xTicks.push({ distance: value * distanceAxisUnit.divisor, label: String(Math.round(value)) });
      }
      const distanceEndPrecision = distanceAxisUnit.label === 'km' ? (distanceAxisTotal >= 100 ? 1 : 2) : 1;
      const distanceEndLabel = distanceAxisTotal.toFixed(distanceEndPrecision).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
      xTicks.push({ distance: totalDistance, label: distanceEndLabel });
      const yGrid = yTicks.map(value => `<line class="abearc-map-elevation-grid${value === chartMinimum ? '' : ' is-guide'}" x1="${plot.left}" y1="${y(value).toFixed(1)}" x2="${width - plot.right}" y2="${y(value).toFixed(1)}"/><text class="abearc-map-elevation-axis" x="${plot.left - 8}" y="${(y(value) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(value)}</text>`).join('');
      const xGrid = xTicks.map(tick => `<line class="abearc-map-elevation-grid is-guide" x1="${x(tick.distance).toFixed(1)}" y1="${plot.top}" x2="${x(tick.distance).toFixed(1)}" y2="${plot.top + plotHeight}"/><text class="abearc-map-elevation-axis" x="${x(tick.distance).toFixed(1)}" y="${height - 13}" text-anchor="middle">${tick.label}</text>`).join('');
      body.innerHTML = `
        <div class="abearc-map-elevation-stats">
          <span><small>Low</small><strong>${Math.round(minimum)} m</strong></span>
          <span><small>High</small><strong>${Math.round(maximum)} m</strong></span>
          <span><small>Ascent</small><strong>+${Math.round(ascent)} m</strong></span>
          <span><small>Descent</small><strong>-${Math.round(descent)} m</strong></span>
        </div>
        <svg class="abearc-map-elevation-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Elevation from ${Math.round(minimum)} to ${Math.round(maximum)} metres across ${distanceEnd}">
          <defs><linearGradient id="abearcElevationFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0891b2" stop-opacity=".42"/><stop offset="1" stop-color="#0891b2" stop-opacity=".05"/></linearGradient></defs>
          ${yGrid}${xGrid}
          <path class="abearc-map-elevation-area" d="${areaPath}"/>
          <path class="abearc-map-elevation-line" d="${linePath}"/>
          <text class="abearc-map-elevation-axis-title" x="${plot.left + plotWidth / 2}" y="${height - 1}" text-anchor="middle">Distance (${distanceAxisUnit.label})</text>
          <text class="abearc-map-elevation-axis-title" x="12" y="${plot.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 12 ${plot.top + plotHeight / 2})">Elevation (m)</text>
        </svg>`;
      panel.classList.remove('hidden');
      panel.dataset.state = 'ready';
    }

    function abearcPolygonArea(points) {
      if (points.length < 3) return 0;
      const R = 6371008.8;
      let total = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        total += (b[0] - a[0]) * Math.PI / 180 * (2 + Math.sin(a[1] * Math.PI / 180) + Math.sin(b[1] * Math.PI / 180));
      }
      return Math.abs(total * R * R / 2);
    }

    function abearcScreenCentroid(points) {
      if (!points.length) return { x: 0, y: 0 };
      if (points.length < 3) {
        return {
          x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y, 0) / points.length
        };
      }
      let twiceArea = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const cross = a.x * b.y - b.x * a.y;
        twiceArea += cross;
        cx += (a.x + b.x) * cross;
        cy += (a.y + b.y) * cross;
      }
      if (Math.abs(twiceArea) < 0.001) {
        return {
          x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y, 0) / points.length
        };
      }
      return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
    }

    function renderAbearcMapMeasure() {
      updateAbearcMapMeasureTools();
      refreshAbearcElevationProfile();
      const svg = document.getElementById('abearcMapMeasureLayer');
      if (!svg || !abearcMap) return;
      svg.innerHTML = '';
      const canvas = abearcMap.getCanvasContainer();
      const width = Math.max(1, canvas?.clientWidth || svg.clientWidth);
      const height = Math.max(1, canvas?.clientHeight || svg.clientHeight);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const pts = abearcMapMeasurePoints.map(p => abearcMap.project(p));
      if (pts.length > 1) {
        const isAreaPolygon = abearcMapMeasureMode === 'area' && pts.length > 2;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        const linePts = isAreaPolygon ? [...pts, pts[0]] : pts;
        if (abearcMapMeasureMode === 'distance' || isAreaPolygon) {
          const hit = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          hit.setAttribute('points', linePts.map(p => `${p.x},${p.y}`).join(' '));
          hit.setAttribute('class', 'abearc-map-measure-hit');
          hit.addEventListener('contextmenu', openAbearcMapMeasureContextMenu);
          svg.appendChild(hit);
        }
        poly.setAttribute('points', linePts.map(p => `${p.x},${p.y}`).join(' '));
        poly.setAttribute('class', 'abearc-map-measure-line');
        svg.appendChild(poly);
        if (isAreaPolygon) {
          const fill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          fill.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
          fill.setAttribute('class', 'abearc-map-measure-fill');
          fill.addEventListener('contextmenu', openAbearcMapMeasureContextMenu);
          svg.insertBefore(fill, poly);
        }
      }
      pts.forEach((p, i) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 7); c.setAttribute('class', 'abearc-map-measure-point');
        c.addEventListener('pointerdown', event => startAbearcMeasureDrag(event, i));
        c.addEventListener('dblclick', event => deleteAbearcMeasurePoint(event, i));
        svg.appendChild(c);
        if (i > 0) {
          const mid = { x: (pts[i - 1].x + p.x) / 2, y: (pts[i - 1].y + p.y) / 2 };
          addMeasureLabel(svg, formatAbearcDistance(haversineMetres(abearcMapMeasurePoints[i - 1], abearcMapMeasurePoints[i])), mid.x, mid.y);
        }
      });
      if (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        addMeasureLabel(svg, formatAbearcDistance(haversineMetres(abearcMapMeasurePoints[abearcMapMeasurePoints.length - 1], abearcMapMeasurePoints[0])), (last.x + first.x) / 2, (last.y + first.y) / 2);
        const center = abearcScreenCentroid(pts);
        addMeasureLabel(svg, `${(abearcPolygonArea(abearcMapMeasurePoints) / 10000).toFixed(2)} ha`, center.x, center.y, true);
        return;
      }
      if (abearcMapMeasurePoints.length > 1) {
        const distance = abearcMeasurePathDistance();
        const last = pts[pts.length - 1];
        const label = abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2
          ? `${(abearcPolygonArea(abearcMapMeasurePoints) / 10000).toFixed(2)} ha`
          : formatAbearcDistance(distance);
        addMeasureLabel(svg, label, last.x + 14, last.y - 14, true);
      }
    }

    function addMeasureLabel(svg, text, x, y, total = false) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = text;
      label.setAttribute('x', x);
      label.setAttribute('y', y);
      label.setAttribute('class', total ? 'abearc-map-measure-label is-total' : 'abearc-map-measure-label');
      svg.appendChild(label);
    }

    document.addEventListener('click', event => {
      if (!event.target.closest('#abearcMapMeasureContextMenu')) closeAbearcMapMeasureContextMenu();
      if (!event.target.closest('[data-map-photo-context-menu]')) closeAbearcMapPhotoContextMenu();
      if (!event.target.closest('[data-map-list-context-menu]') && !event.target.closest('[data-map-list-menu-id]')) closeAbearcMapListContextMenu();
      if (!event.target.closest('[data-map-layer-label-menu]') && !event.target.closest('[data-map-basemap]')) closeAbearcMapLayerLabelMenu();
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(menu => {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
      });
      if (!event.target.closest('.abearc-map-quick-layer-control')) toggleAbearcQuickLayers(false);
      const page = document.getElementById('mapPage');
      if (!page) return;
      if (page.classList.contains('is-filter-panel-open')
          && !event.target.closest('#abearcMapFilters')
          && !event.target.closest('[data-map-filter-button]')) {
        toggleAbearcMapFilters(false);
      }
      if (page.classList.contains('is-results-panel-open')
          && window.matchMedia('(max-width: 900px)').matches
          && !event.target.closest('[data-map-results-panel]')
          && !event.target.closest('.abearc-map-results-toggle')) {
        toggleAbearcMapResults(false);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Alt' && appCurrentView === 'map') {
        event.preventDefault();
        abearcMapAltHeld = true;
      }
      if (appCurrentView === 'map' && abearcMapPhotoSelectionMode && !event.repeat) {
        const dialogOpen = Boolean(document.querySelector('#confirmModal:not(.hidden), [data-abearc-map-edit-modal]:not(.hidden)'));
        const typingTarget = Boolean(event.target?.closest?.('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]'));
        if (!dialogOpen && event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelAbearcMapPhotoSelection();
          return;
        }
        if (!dialogOpen && !typingTarget) {
          const key = String(event.key || '').toLowerCase();
          if ((event.ctrlKey || event.metaKey) && key === 'a') {
            event.preventDefault();
            toggleAllAbearcMapPhotos(true);
            return;
          }
          if ((event.ctrlKey || event.metaKey) && key === 'd') {
            event.preventDefault();
            downloadSelectedAbearcMapPhotos();
            return;
          }
          if (event.key === 'F2') {
            event.preventDefault();
            renameSelectedAbearcMapPhotos();
            return;
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            deleteSelectedAbearcMapPhotos();
            return;
          }
        }
      }
      if (event.key === 'Escape' && appCurrentView === 'map') {
        const layerLabelMenu = document.querySelector('[data-map-layer-label-menu]');
        if (layerLabelMenu && !layerLabelMenu.classList.contains('hidden')) return closeAbearcMapLayerLabelMenu();
        const listMenu = document.querySelector('[data-map-list-context-menu]');
        if (listMenu && !listMenu.classList.contains('hidden')) return closeAbearcMapListContextMenu();
        const photoMenu = document.querySelector('[data-map-photo-context-menu]');
        if (photoMenu && !photoMenu.classList.contains('hidden')) return closeAbearcMapPhotoContextMenu();
        if (abearcMapThumbnailMoveId !== null) return finishAbearcMapThumbnailMoveMode();
        const measureMenu = document.getElementById('abearcMapMeasureContextMenu');
        if (measureMenu && !measureMenu.classList.contains('hidden')) return closeAbearcMapMeasureContextMenu();
        const elevationProfile = document.getElementById('abearcMapElevationProfile');
        if (elevationProfile && !elevationProfile.classList.contains('hidden')) return closeAbearcElevationProfile();
        if (!document.getElementById('abearcMapOriginalViewer')?.classList.contains('hidden')) return closeAbearcMapOriginalViewer();
        const details = document.getElementById('abearcMapDetails');
        if (details && !details.classList.contains('hidden')) {
          details.querySelector('[data-map-details-close]')?.click();
          return;
        }
        if (document.getElementById('mapPage')?.classList.contains('is-filter-panel-open')) return toggleAbearcMapFilters(false);
        if (document.getElementById('mapPage')?.classList.contains('is-results-panel-open')) return toggleAbearcMapResults(false);
        if (!document.querySelector('.abearc-map-quick-layers')?.classList.contains('hidden')) return toggleAbearcQuickLayers(false);
        if (!document.querySelector('.abearc-map-layer-menu')?.classList.contains('hidden')) return toggleAbearcMapLayerMenu(false);
        if (!document.querySelector('[data-map-measure-panel]')?.classList.contains('is-collapsed')) return toggleAbearcMapMeasureTools(false);
        if (document.body.classList.contains('abearc-map-fullpage')) return toggleAbearcMapFullPage(false);
        collapseAbearcMapExplosion();
      }
    });

    document.addEventListener('keyup', event => {
      if (event.key !== 'Alt') return;
      if (appCurrentView === 'map') event.preventDefault();
      abearcMapAltHeld = false;
      if (appCurrentView === 'map' && abearcMapExploded?.collapseOnAltRelease) collapseAbearcMapExplosion();
    });

    Object.assign(window, {
      showAbearcMap,
      showAbearcMapLocation,
      submitAbearcMapSearch,
      handleAbearcMapSearchInput,
      setAbearcMapBasemap,
      abearcMapCurrentBasemap,
      setAbearcZoningLabelsVisible,
      setAbearcMapLayerLabelsVisible,
      openAbearcMapLayerLabelMenu,
      closeAbearcMapLayerLabelMenu,
      toggleAbearcMapLayerMenu,
      toggleAbearcQuickLayers,
      toggleAbearcMapFullPage,
      showAbearcGeotagPhotos,
      showAbearcSavedPhotos,
      showAbearcMyGeotagPhotos,
      toggleAbearcSavedPhoto,
      downloadAbearcGeoCamApp,
      setAbearcMapPhotosVisible,
      setAbearcDavaoBoundaryVisible,
      setAbearcChirpsEnabled,
      setAbearcChirpsPreset,
      setAbearcChirpsOpacity,
      applyAbearcChirpsRange,
      setAbearcTerraClimateEnabled,
      setAbearcTerraClimatePreset,
      setAbearcTerraClimateOpacity,
      applyAbearcTerraClimateRange,
      setAbearcNoahFloodEnabled,
      toggleAbearcNoahFloodLayer,
      setAbearcNoahFloodOpacity,
      fitAbearcClimateToPhilippines,
      startAbearcClimatePointSelection,
      reloadAbearcMap,
      focusAbearcMapPhoto,
      openAbearcMapResultPhoto,
      zoomAbearcMapPhotoToTenMeterScale,
      reloadAbearcMapForSearch,
      scheduleAbearcMapReload,
      toggleAbearcMapFilters,
      toggleAbearcMapResults,
      resetAbearcMapView,
      fitAbearcMapToDavaoCity,
      clearAbearcMapFilters,
      openAbearcMapDetails,
      hideAbearcMapPhoto,
      restoreAbearcMapPhoto,
      deleteAbearcMapPhoto,
      editAbearcMapField,
      openAbearcMapOriginalViewer,
      closeAbearcMapOriginalViewer,
      toggleAbearcMapMeasureTools,
      setAbearcMapMeasureMode,
      clearAbearcMapMeasure,
      setAbearcElevationSource,
      refreshAbearcElevationProfile,
      showAbearcElevationProfile,
      closeAbearcElevationProfile,
      closeAbearcMapMeasureContextMenu,
      openAbearcMapListContextMenu,
      beginAbearcMapThumbnailMove,
      resetAbearcMapThumbnailMoves,
      beginAbearcMapPhotoSelection,
      cancelAbearcMapPhotoSelection,
      toggleAbearcMapPhotoSelection,
      toggleAllAbearcMapPhotos,
      saveSelectedAbearcMapPhotos,
      renameSelectedAbearcMapPhotos,
      deleteSelectedAbearcMapPhotos,
      renameAllAbearcMapCategories,
      downloadAllAbearcMapPhotos,
      downloadSelectedAbearcMapPhotos,
      downloadAbearcMapPhotoFromContext,
      deleteAllAbearcMapPhotos
    });
