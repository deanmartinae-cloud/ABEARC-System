    let abearcMap = null;
    let abearcMapCameraPersistenceBound = false;
    const abearcMapViewUndoStack = [];
    let abearcMapUndoOrder = 0;
    let abearcMapRestoringView = false;
    let abearcMapLayoutHistoryBatch = null;
    let abearcMapHistoryGesture = null;
    let abearcMapConfig = null;
    let abearcMapFeatures = [];
    let abearcMapAbort = null;
    let abearcMapReloadTimer = null;
    let abearcMapAutoSyncTimer = null;
    const ABEARC_MAP_AUTO_SYNC_INTERVAL_MS = 20000;
    const ABEARC_MAP_FULL_SYNC_INTERVAL_MS = 120000;
    let abearcMapLastServerTime = '';
    let abearcMapLastFullSyncAt = 0;
    let abearcMapExploded = null;
    let abearcMapExplosionCollapseTimer = null;
    let abearcMapSelectedPhotoId = null;
    let abearcMapHoveredPhotoId = null;
    let abearcMapResultSingleClickTimer = null;
    let abearcMapThumbnailContextId = null;
    let abearcMapThumbnailMoveId = null;
    const abearcMapMovedPhotoPositions = new Map();
    const abearcMapMovedPhotoSizes = new Map();
    const abearcMapExpandedPhotos = new Map();
    const abearcMapPhotoAnnotations = new Map();
    const abearcMapSessionHiddenPhotoIds = new Set();
    let abearcMapLayoutFrozenPhotoIds = null;
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
    let abearcMapImportedPolygons = [];
    let abearcMapSelectedImportedPolygons = new Set();
    let abearcMapImportedPolygonContextIndex = null;
    let abearcMapEditingImportedPolygonIndex = null;
    const abearcMapMeasureUndoStack = [];
    let abearcMapHiddenMeasurePointIndexes = new Set();
    let abearcMapMeasurePointContextIndex = null;
    let abearcMapMeasureStorageOwner = null;
    let abearcMapDraggingMeasureIndex = null;
    let abearcMapMeasureDragUndoSaved = false;
    let abearcMapLastTouchedMeasureIndex = null;
    let abearcMapElevationTimer = null;
    let abearcMapElevationAbort = null;
    let abearcMapElevationKey = '';
    let abearcMapElevationRequestId = 0;
    let abearcMapElevationVisible = false;
    let abearcMapElevationProfileData = [];
    let abearcMapElevationAnnotations = new Map();
    let abearcMapElevationAnnotationContextIndex = null;
    let abearcMapContourAbort = null;
    let abearcMapContourRequestId = 0;
    let abearcMapContourData = null;
    const ABEARC_MAP_ELEVATION_SOURCES = new Set([
      'namria-dtm5-prs92',
      'aws-copernicus-glo30',
      'copernicus-glo90',
      'aws-copernicus-glo90',
      'aws-mapzen',
      'opentopo-srtm30'
    ]);
    const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = 'namria-dtm5-prs92';
    const ABEARC_MAP_ELEVATION_RESOLUTION_M = {
      'namria-dtm5-prs92': 5,
      'aws-copernicus-glo30': 30,
      'copernicus-glo90': 90,
      'aws-copernicus-glo90': 90,
      'aws-mapzen': 30,
      'opentopo-srtm30': 30
    };
    const ABEARC_MAP_CONTOUR_SAMPLE_BUDGET = {
      'namria-dtm5-prs92': 8000,
      'aws-copernicus-glo30': 4000,
      'aws-copernicus-glo90': 2000,
      'aws-mapzen': 2000,
      'copernicus-glo90': 800,
      'opentopo-srtm30': 800
    };
    let abearcMapElevationSource = ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
    let abearcMapContourSource = ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
    let abearcMapContourInterval = null;
    let abearcMapContourIndexInterval = null;
    let abearcMapLastSearchFitKey = '';
    let abearcMapCommittedSearch = '';
    let abearcMapCommittedFilters = null;
    let abearcMapFitAllRequested = false;
    let abearcMapCoordinateSearchMarker = null;
    let abearcMapAdministrativeBoundaryData = { type: 'FeatureCollection', features: [] };
    let abearcMapAdministrativeBoundaryAbort = null;
    let abearcMapAdministrativeBoundaryRequestId = 0;
    let abearcMapAdministrativeSearchSelection = null;
    let abearcMapAdministrativeSuggestionRequestId = 0;
    let abearcMapAdministrativeSearchError = '';
    let abearcMapAdministrativeLabelMarker = null;
    let abearcMapAdministrativeLabelFrame = null;
    let abearcMapAdministrativeInteractionsBound = false;
    let abearcMapAdministrativeMeasurePreviousState = null;
    let abearcMapAdministrativeMeasureActive = false;
    const abearcMapPhotoMarkers = new Map();
    let abearcMapPhotosVisible = localStorage.getItem('abearcMapPhotosVisible') !== 'false';
    let abearcMapManualUploadFiles = [];
    let abearcMapManualUploadBound = false;
    let abearcMapSavedPhotoIds = (() => {
      try {
        const ids = JSON.parse(localStorage.getItem('abearcMapSavedPhotoIds') || '[]');
        return new Set(Array.isArray(ids) ? ids.map(Number).filter(id => Number.isFinite(id) && id > 0) : []);
      } catch (_) {
        return new Set();
      }
    })();
    const abearcStoredMapPhotoScope = localStorage.getItem('abearcMapPhotoScope');
    let abearcMapPhotoScope = ['all', 'saved', 'mine'].includes(abearcStoredMapPhotoScope) ? abearcStoredMapPhotoScope : 'all';
let abearcMapAdminResolutionAttemptedIds = new Set();
    let abearcMapGroupSiteSeries = localStorage.getItem('abearcMapGroupSiteSeries') !== 'false';
    let abearcMapViewportTimelineDate = '';
    let abearcMapViewportTimelineLastDate = '';
    let abearcMapViewportTimelineTimer = null;
    let abearcMapViewportTimelinePlaying = false;
    let abearcMapViewportTimelineVisible = localStorage.getItem('abearcMapViewportTimelineVisible') === 'true';
    let abearcMapViewportTimelineCollapsed = localStorage.getItem('abearcMapViewportTimelineCollapsed') !== 'false';
    let abearcMapViewportTimelineMode = localStorage.getItem('abearcMapViewportTimelineMode') === 'asof' ? 'asof' : 'exact';
    let abearcMapViewportTimelineZoom = 1;
    const ABEARC_MAP_VIEWPORT_TIMELINE_PLAY_MS = 1800;
    let abearcDavaoBoundaryVisible = localStorage.getItem('abearcMapDavaoBoundaryVisible') !== 'false';
    let abearcMapLocationMarker = null;
    const abearcStoredBasemap = localStorage.getItem('abearcMapBasemap') || 'google-satellite';
    let abearcMapBasemap = ['google-satellite', 'google-terrain', 'open-topo'].includes(abearcStoredBasemap)
      ? abearcStoredBasemap
      : 'google-satellite';
    let abearcZoningEnabled = localStorage.getItem('abearcMapZoningEnabled') === 'true' || abearcStoredBasemap === 'zoning';
    if (abearcStoredBasemap === 'zoning') {
      localStorage.setItem('abearcMapBasemap', abearcMapBasemap);
      localStorage.setItem('abearcMapZoningEnabled', 'true');
    }
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

    // Environmental overlays are exclusive. Prefer NOAH, then TerraClimate,
    // when older saved state has more than one enabled.
    if (abearcNoahFloodEnabled) {
      abearcChirpsEnabled = false;
      abearcTerraClimateEnabled = false;
    } else if (abearcChirpsEnabled && abearcTerraClimateEnabled) {
      abearcChirpsEnabled = false;
    }

    function abearcMapCameraStorageKey() {
      return `abearcMapCamera:${currentUser?.id || 'default'}`;
    }

    function abearcMapMeasureStorageKey() {
      return `abearcMapMeasure:${currentUser?.id || 'default'}`;
    }

    function captureAbearcMapMeasureState() {
      return {
        mode: abearcMapMeasureMode,
        points: abearcMapMeasurePoints.map(point => [...point]),
        importedPolygons: abearcMapImportedPolygons.map(polygon => ({ name: polygon.name, points: polygon.points.map(point => [...point]) })),
        activeImportedPolygonIndex: abearcMapImportedPolygons.findIndex(polygon => polygon.points === abearcMapMeasurePoints),
        selectedImportedPolygons: [...abearcMapSelectedImportedPolygons],
        hiddenPoints: [...abearcMapHiddenMeasurePointIndexes],
        annotations: [...abearcMapElevationAnnotations].map(([index, annotation]) => [index, { ...annotation }]),
        lastTouchedPoint: abearcMapLastTouchedMeasureIndex,
        editingImportedPolygonIndex: abearcMapEditingImportedPolygonIndex,
        importedContours: abearcMapContourData?.imported
          ? { imported: true, paths: abearcMapContourData.paths.map(path => ({ ...path, points: path.points.map(point => [...point]) })) }
          : null,
        multiMeasurements: window.captureAbearcMultiMeasurementState?.() || null
      };
    }

    function applyAbearcMapMeasureState(state = {}) {
      if (state?.multiMeasurements && window.restoreAbearcMultiMeasurementState?.(state.multiMeasurements, { skipRender: true })) {
        resetAbearcElevationProfile();
        saveAbearcMapMeasure();
        renderAbearcMapMeasure();
        return;
      }
      window.resetAbearcMultiMeasurementCollection?.();
      const validPoint = point => Array.isArray(point)
        && Number.isFinite(Number(point[0])) && Number(point[0]) >= -180 && Number(point[0]) <= 180
        && Number.isFinite(Number(point[1])) && Number(point[1]) >= -90 && Number(point[1]) <= 90;
      const points = (Array.isArray(state.points) ? state.points : []).slice(0, 1000)
        .filter(validPoint).map(point => [Number(point[0]), Number(point[1])]);
      const polygons = (Array.isArray(state.importedPolygons) ? state.importedPolygons : []).slice(0, 1000)
        .map((polygon, index) => ({
          name: String(polygon?.name || `Polygon ${index + 1}`).slice(0, 120),
          points: (Array.isArray(polygon?.points) ? polygon.points : []).slice(0, 1000)
            .filter(validPoint).map(point => [Number(point[0]), Number(point[1])])
        }))
        .filter(polygon => polygon.points.length >= 3);
      const activeIndex = Number(state.activeImportedPolygonIndex);
      abearcMapMeasureMode = ['distance', 'area'].includes(state.mode) ? state.mode : 'off';
      abearcMapImportedPolygons = polygons;
      abearcMapMeasurePoints = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < polygons.length
        ? polygons[activeIndex].points
        : points;
      abearcMapSelectedImportedPolygons = new Set((Array.isArray(state.selectedImportedPolygons) ? state.selectedImportedPolygons : [])
        .map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < polygons.length));
      abearcMapHiddenMeasurePointIndexes = new Set((Array.isArray(state.hiddenPoints) ? state.hiddenPoints : [])
        .map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < abearcMapMeasurePoints.length));
      abearcMapElevationAnnotations = new Map((Array.isArray(state.annotations) ? state.annotations : [])
        .map(entry => [Number(entry?.[0]), entry?.[1]])
        .filter(([index, annotation]) => Number.isInteger(index) && index >= 0 && index < abearcMapMeasurePoints.length && annotation && typeof annotation === 'object')
        .map(([index, annotation]) => [index, {
          text: String(annotation.text || '').slice(0, 80),
          dx: Number.isFinite(Number(annotation.dx)) ? Number(annotation.dx) : 22,
          dy: Number.isFinite(Number(annotation.dy)) ? Number(annotation.dy) : -22,
          mapDx: Number.isFinite(Number(annotation.mapDx)) ? Number(annotation.mapDx) : 22,
          mapDy: Number.isFinite(Number(annotation.mapDy)) ? Number(annotation.mapDy) : -22
        }]).filter(([, annotation]) => annotation.text));
      abearcMapLastTouchedMeasureIndex = Number.isInteger(Number(state.lastTouchedPoint)) ? Number(state.lastTouchedPoint) : (abearcMapMeasurePoints.length ? abearcMapMeasurePoints.length - 1 : null);
      abearcMapEditingImportedPolygonIndex = Number.isInteger(Number(state.editingImportedPolygonIndex)) ? Number(state.editingImportedPolygonIndex) : null;
      const contourPaths = Array.isArray(state.importedContours?.paths) ? state.importedContours.paths : [];
      abearcMapContourData = state.importedContours?.imported && contourPaths.length
        ? { imported: true, paths: contourPaths.slice(0, 10000).map(path => ({ ...path, points: (Array.isArray(path.points) ? path.points : []).filter(validPoint).map(point => [Number(point[0]), Number(point[1])]) })) }
        : null;
      resetAbearcElevationProfile();
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function rememberAbearcMapMeasureState() {
      if (abearcMapRestoringView) return;
      abearcMapMeasureUndoStack.push({ ...captureAbearcMapMeasureState(),
        analysis: typeof captureAbearcMapLayoutAnalysisState === 'function' ? captureAbearcMapLayoutAnalysisState() : null,
        contours: abearcMapContourData, undoOrder: ++abearcMapUndoOrder });
      if (abearcMapMeasureUndoStack.length > 50) abearcMapMeasureUndoStack.shift();
    }

    function undoAbearcMapMeasureChange() {
      const state = abearcMapMeasureUndoStack.pop();
      if (!state) return toast('Nothing to undo');
      if (state.multiMeasurements && window.restoreAbearcMultiMeasurementState?.(state.multiMeasurements, { skipRender: true })) {
        resetAbearcElevationProfile();
        saveAbearcMapMeasure();
        renderAbearcMapMeasure();
        toast('Measurement change undone');
        return;
      }
      abearcMapMeasureMode = state.mode;
      abearcMapImportedPolygons = state.importedPolygons;
      abearcMapMeasurePoints = state.activeImportedPolygonIndex >= 0
        ? abearcMapImportedPolygons[state.activeImportedPolygonIndex].points
        : state.points;
      abearcMapSelectedImportedPolygons = new Set(state.selectedImportedPolygons);
      abearcMapHiddenMeasurePointIndexes = new Set(state.hiddenPoints);
      abearcMapElevationAnnotations = new Map(state.annotations);
      abearcMapLastTouchedMeasureIndex = state.lastTouchedPoint;
      abearcMapEditingImportedPolygonIndex = state.editingImportedPolygonIndex;
      abearcMapContourData = state.contours || state.importedContours;
      if (state.analysis && typeof restoreAbearcMapLayoutAnalysisState === 'function') {
        restoreAbearcMapLayoutAnalysisState(state.analysis);
        abearcMapContourData = state.contours || state.importedContours;
      }
      resetAbearcElevationProfile();
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
      toast('Measurement change undone');
    }

    function restoreAbearcMapMeasure() {
      const owner = String(currentUser?.id || 'default');
      if (abearcMapMeasureStorageOwner === owner) return;
      abearcMapViewUndoStack.length = 0;
      abearcMapLayoutHistoryBatch = null;
      abearcMapMeasureStorageOwner = owner;
      abearcMapMeasureUndoStack.length = 0;
      window.resetAbearcMultiMeasurementCollection?.();
      abearcMapMeasureMode = 'off';
      abearcMapMeasurePoints = [];
      abearcMapImportedPolygons = [];
      abearcMapSelectedImportedPolygons.clear();
      abearcMapImportedPolygonContextIndex = null;
      abearcMapEditingImportedPolygonIndex = null;
      abearcMapHiddenMeasurePointIndexes.clear();
      abearcMapElevationAnnotations.clear();
      abearcMapLastTouchedMeasureIndex = null;
      try {
        const saved = JSON.parse(localStorage.getItem(abearcMapMeasureStorageKey()) || 'null');
        if (saved?.multi_state && window.restoreAbearcMultiMeasurementState?.(saved.multi_state, { skipRender: true })) return;
        if (!['distance', 'area'].includes(saved?.mode) || !Array.isArray(saved?.points)) return;
        const points = saved.points.slice(0, 1000).map(point => [Number(point?.[0]), Number(point?.[1])]);
        if (points.some(point => !Number.isFinite(point[0]) || point[0] < -180 || point[0] > 180
            || !Number.isFinite(point[1]) || point[1] < -90 || point[1] > 90)) return;
        abearcMapMeasureMode = saved.mode;
        abearcMapMeasurePoints = points;
        abearcMapImportedPolygons = (Array.isArray(saved.imported_polygons) ? saved.imported_polygons : [])
          .slice(0, 1000)
          .map((polygon, index) => ({
            name: String(polygon?.name || `Polygon ${index + 1}`).slice(0, 120),
            points: (Array.isArray(polygon?.points) ? polygon.points : []).slice(0, 1000)
              .map(point => [Number(point?.[0]), Number(point?.[1])])
          }))
          .filter(polygon => polygon.points.length >= 3 && polygon.points.every(point =>
            Number.isFinite(point[0]) && point[0] >= -180 && point[0] <= 180
            && Number.isFinite(point[1]) && point[1] >= -90 && point[1] <= 90));
        abearcMapSelectedImportedPolygons = new Set((Array.isArray(saved.selected_imported_polygons) ? saved.selected_imported_polygons : [])
          .map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < abearcMapImportedPolygons.length));
        abearcMapHiddenMeasurePointIndexes = new Set((Array.isArray(saved.hidden_points) ? saved.hidden_points : []).map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < points.length));
        abearcMapElevationAnnotations = new Map((Array.isArray(saved.annotations) ? saved.annotations : [])
          .map(annotation => [Number(annotation?.index), {
            text: String(annotation?.text || '').slice(0, 80),
            dx: Number.isFinite(Number(annotation?.dx)) ? Number(annotation.dx) : 22,
            dy: Number.isFinite(Number(annotation?.dy)) ? Number(annotation.dy) : -22,
            mapDx: Number.isFinite(Number(annotation?.mapDx)) ? Number(annotation.mapDx) : 22,
            mapDy: Number.isFinite(Number(annotation?.mapDy)) ? Number(annotation.mapDy) : -22
          }])
          .filter(([index, annotation]) => Number.isInteger(index) && index >= 0 && index < points.length && annotation.text));
        abearcMapLastTouchedMeasureIndex = points.length ? points.length - 1 : null;
      } catch (_) {}
    }

    function saveAbearcMapMeasure() {
      try {
        const multiState = window.captureAbearcMultiMeasurementState?.() || null;
        const hasMulti = Boolean(window.hasAbearcMultiMeasurements?.());
        if ((!['distance', 'area'].includes(abearcMapMeasureMode) || !abearcMapMeasurePoints.length) && !hasMulti) {
          localStorage.removeItem(abearcMapMeasureStorageKey());
          return;
        }
        localStorage.setItem(abearcMapMeasureStorageKey(), JSON.stringify({
          mode: abearcMapMeasureMode,
          points: abearcMapMeasurePoints,
          imported_polygons: abearcMapImportedPolygons,
          selected_imported_polygons: [...abearcMapSelectedImportedPolygons],
          hidden_points: [...abearcMapHiddenMeasurePointIndexes],
          annotations: [...abearcMapElevationAnnotations].map(([index, annotation]) => ({ index, ...annotation })),
          multi_state: multiState
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
            'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
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
      const terrainSelected = kind === 'google-terrain';
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
          ...(terrainSelected ? {
            'abearc-terrain-dem': {
              type: 'raster-dem',
              tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 12,
              encoding: 'terrarium',
              attribution: 'Elevation data &copy; Mapzen, SRTM'
            }
          } : {}),
          ...(abearcZoningEnabled ? {
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
          } : {}),
          'abearc-area-labels': {
            type: 'raster',
            tiles: googleLabelTiles,
            tileSize: 256,
            attribution: 'Labels &copy; Google',
            minzoom: 3,
            maxzoom: 20
          }
        },
        layers: [
          {
            id: 'abearc-basemap',
            type: 'raster',
            source: 'abearc-basemap'
          },
          ...(terrainSelected ? [{
            id: 'abearc-terrain-hillshade',
            type: 'hillshade',
            source: 'abearc-terrain-dem',
            maxzoom: 16,
            paint: {
              'hillshade-exaggeration': 0.24,
              'hillshade-shadow-color': '#344438',
              'hillshade-highlight-color': '#ffffff',
              'hillshade-accent-color': '#667866'
            }
          }] : []),
          ...(abearcZoningEnabled ? [{
            id: 'abearc-zoning',
            type: 'raster',
            source: 'abearc-zoning'
          }] : []),
          {
            id: 'abearc-area-labels',
            type: 'raster',
            source: 'abearc-area-labels',
            layout: { visibility: labelsVisible ? 'visible' : 'none' },
            paint: { 'raster-opacity': 0.92 }
          },
          ...(abearcZoningEnabled ? [{
            id: 'abearc-zoning-labels',
            type: 'symbol',
            source: 'abearc-zoning-labels',
            minzoom: 9,
            layout: {
              visibility: abearcMapLayerLabels.zoning !== false ? 'visible' : 'none',
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
          }] : [])
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
      syncAbearcMapTimelineTools();
      syncAbearcMapPhotoHeaderActions();
      ensureAbearcMapPhotoUploadBindings();
      restoreAbearcMapMeasure();
      await ensureAbearcMap();
      window.restoreAbearcOrthomosaicDrawer?.();
      renderAbearcMapMeasure();
      setTimeout(() => {
        if (abearcChirpsEnabled && !abearcChirpsPreparing) prepareAbearcChirpsDataset({ silent: true });
        if (abearcTerraClimateEnabled && !abearcTerraClimatePreparing) prepareAbearcTerraClimateDataset({ silent: true });
      }, 0);
      setTimeout(() => abearcMap?.resize(), 60);
      reloadAbearcMap();
      window.reloadAbearcWeatherStations?.();
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
        boxZoom: { boxZoomEnd: handleAbearcMapPhotoBoxZoom },
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
        resizeAbearcExpandedPhotoMarkers();
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('movestart', () => {
        minimizeIdleAbearcMapMeasureTools();
        rememberAbearcMapView();
        closeAbearcMapMeasureContextMenu();
        closeAbearcMapPhotoContextMenu();
        const center = abearcMap.getCenter();
        abearcMapStartMovePoint = abearcMap.project(center);
      });
      abearcMap.on('move', () => {
        resizeAbearcExpandedPhotoMarkers();
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('zoom', () => {
        resizeAbearcExpandedPhotoMarkers();
        scheduleAbearcMapMarkerRender();
        renderAbearcMapMeasure();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('rotate', () => {
        scheduleAbearcMapMarkerRender();
        if (abearcMapExploded) renderAbearcMapExplosion();
      });
      abearcMap.on('moveend', () => {
        scheduleAbearcAdministrativeBoundaryLabel();
        saveAbearcMapCamera();
        collapseAbearcMapExplosionForMovement();
        scheduleAbearcMapMarkerRender();
        renderAbearcMapList();
        syncAbearcMapViewportTimeline();
        renderAbearcMapMeasure();
        if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
        scheduleAbearcZoningLabelsReload(100);
      });
      abearcMap.on('zoomend', () => {
        scheduleAbearcZoningLabelsReload(80);
        renderAbearcMapList();
        if (abearcMapExploded?.collapseOnZoomOut && abearcMap.getZoom() < (Number(abearcMapExploded.zoom) - 0.05)) {
          collapseAbearcMapExplosion({ reason: 'collapseOnZoomOut' });
          renderAbearcMapMeasure();
          if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
          return;
        }
        scheduleAbearcMapMarkerRender();
        if (abearcMapExploded) renderAbearcMapExplosion();
        syncAbearcMapViewportTimeline();
        renderAbearcMapMeasure();
        if (!abearcMapCommittedSearch) scheduleAbearcMapReload(80);
      });
      abearcMap.on('click', handleAbearcMapClick);
      if (!abearcMapCameraPersistenceBound) {
        const persistCamera = () => saveAbearcMapCamera();
        window.addEventListener('pagehide', persistCamera);
        window.addEventListener('beforeunload', persistCamera);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') persistCamera();
        });
        abearcMapCameraPersistenceBound = true;
      }
    }

    function syncAbearcMapBasemapControl() {
      const layerDetails = {
        'google-terrain': { label: 'Terrain', preview: 'abearc-map-layer-preview--terrain' },
        'google-satellite': { label: 'Satellite', preview: 'abearc-map-layer-preview--satellite' },
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
      document.querySelectorAll('[data-map-zoning-overlay]').forEach(button => {
        button.classList.toggle('is-active', abearcZoningEnabled);
        button.setAttribute('aria-pressed', String(abearcZoningEnabled));
        button.setAttribute('aria-label', `${abearcZoningEnabled ? 'Hide' : 'Show'} zoning overlay`);
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
      const count = [abearcMapPhotosVisible, abearcDavaoBoundaryVisible, abearcZoningEnabled, abearcNoahFloodEnabled, abearcChirpsEnabled, abearcTerraClimateEnabled, Boolean(window.abearcWeatherStationsVisible)]
        .filter(Boolean).length + Number(window.abearcOrthomosaicActiveCount?.() || 0);
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
      const headerToggle = document.querySelector('[data-map-photo-visibility-header-toggle]');
      if (headerToggle) {
        headerToggle.setAttribute('aria-pressed', String(abearcMapPhotosVisible));
        headerToggle.setAttribute('aria-label', `${abearcMapPhotosVisible ? 'Hide' : 'Show'} geotag photos`);
        headerToggle.setAttribute('title', `${abearcMapPhotosVisible ? 'Hide' : 'Show'} geotag photos`);
        headerToggle.querySelector('[data-map-photo-visible-icon]')?.classList.toggle('hidden', !abearcMapPhotosVisible);
        headerToggle.querySelector('[data-map-photo-hidden-icon]')?.classList.toggle('hidden', abearcMapPhotosVisible);
      }
      syncAbearcMapLayerCount();
    }

    function syncAbearcMapPhotoHeaderActions() {
      const upload = document.querySelector('[data-map-photo-upload]');
      upload?.classList.toggle('hidden', !hasPrivilege('upload_map_media'));
      syncAbearcMapPhotoVisibilityControl();
    }

    function toggleAbearcMapPhotosVisibility() {
      setAbearcMapPhotosVisible(!abearcMapPhotosVisible);
    }

    function updateAbearcMapPhotoUploadLabel() {
      const label = document.getElementById('abearcMapPhotoUploadFileLabel');
      if (!label) return;
      if (!abearcMapManualUploadFiles.length) {
        label.textContent = 'JPG, PNG, or WEBP · up to 100 photos.';
        return;
      }
      const names = abearcMapManualUploadFiles.slice(0, 3).map(file => file.name).join(', ');
      label.textContent = `${abearcMapManualUploadFiles.length} photo${abearcMapManualUploadFiles.length === 1 ? '' : 's'} selected${names ? ` · ${names}${abearcMapManualUploadFiles.length > 3 ? '…' : ''}` : ''}`;
    }

    function setAbearcMapManualUploadFiles(files) {
      abearcMapManualUploadFiles = Array.from(files || [])
        .filter(file => /\.(jpe?g|png|webp)$/i.test(String(file.name || '')))
        .slice(0, 100);
      updateAbearcMapPhotoUploadLabel();
    }

    function ensureAbearcMapPhotoUploadBindings() {
      if (abearcMapManualUploadBound) return;
      const input = document.getElementById('abearcMapPhotoUploadFiles');
      const zone = document.getElementById('abearcMapPhotoDropZone');
      if (!input || !zone) return;
      abearcMapManualUploadBound = true;
      input.addEventListener('change', () => setAbearcMapManualUploadFiles(input.files));
      zone.addEventListener('click', event => {
        if (event.target === input) return;
        input.click();
      });
      zone.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        input.click();
      });
      ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.add('border-cyan-500', 'bg-cyan-50/60');
      }));
      ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.remove('border-cyan-500', 'bg-cyan-50/60');
      }));
      zone.addEventListener('drop', event => setAbearcMapManualUploadFiles(event.dataTransfer?.files));
    }

    function openAbearcMapPhotoUploadModal() {
      if (!hasPrivilege('upload_map_media')) return toast('Permission denied: upload_map_media', 'error');
      ensureAbearcMapPhotoUploadBindings();
      abearcMapManualUploadFiles = [];
      populateMapFilterOptions();
      const input = document.getElementById('abearcMapPhotoUploadFiles');
      if (input) input.value = '';
      const category = document.getElementById('abearcMapPhotoUploadCategory');
      if (category) category.value = '';
      const remarks = document.getElementById('abearcMapPhotoUploadRemarks');
      const status = document.getElementById('abearcMapPhotoUploadStatus');
      if (remarks) remarks.value = '';
      if (status) status.textContent = '';
      updateAbearcMapPhotoUploadLabel();
      document.getElementById('abearcMapPhotoUploadModal')?.classList.remove('hidden');
    }

    function closeAbearcMapPhotoUploadModal() {
      document.getElementById('abearcMapPhotoUploadModal')?.classList.add('hidden');
    }

    async function uploadAbearcMapPhotos(event) {
      event?.preventDefault?.();
      if (!abearcMapManualUploadFiles.length) return toast('Select at least one geotagged photo.', 'error');
      const save = document.getElementById('abearcMapPhotoUploadSave');
      const status = document.getElementById('abearcMapPhotoUploadStatus');
      const category = String(document.getElementById('abearcMapPhotoUploadCategory')?.value || '').trim();
      if (!category) {
        document.getElementById('abearcMapPhotoUploadCategory')?.focus();
        return toast('Enter a photo category before uploading.', 'error');
      }
      const remarks = String(document.getElementById('abearcMapPhotoUploadRemarks')?.value || '').trim();
      const form = new FormData();
      abearcMapManualUploadFiles.forEach(file => form.append('photos[]', file, file.name));
      form.append('metadata_json', JSON.stringify(abearcMapManualUploadFiles.map(file => ({
        original_filename: file.name, category, visibility: 'organization', remarks, coordinate_source: 'manual_upload_auto'
      }))));
      if (save) { save.disabled = true; save.textContent = 'Uploading…'; }
      if (status) status.textContent = `Reading metadata and uploading ${abearcMapManualUploadFiles.length} photo${abearcMapManualUploadFiles.length === 1 ? '' : 's'}…`;
      try {
        const response = await fetch(`${API}/mobile/map-media/upload-batch`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: form
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && !Array.isArray(data.results)) throw new Error(data.error || 'Photo upload failed.');
        const uploaded = Number(data.uploaded_count || 0);
        const duplicates = Number(data.duplicate_count || 0);
        const failed = Number(data.failed_count || 0);
        const rejected = (data.results || []).filter(item => !item?.success);
        if (status) {
          status.replaceChildren();
          const summary = document.createElement('div');
          summary.className = 'font-semibold';
          summary.textContent = `${uploaded} accepted${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'}` : ''}${failed ? ` · ${failed} rejected` : ''}.`;
          status.appendChild(summary);
          if (rejected.length) {
            const title = document.createElement('div');
            title.className = 'mt-2 text-xs font-bold';
            title.textContent = 'Rejected photos';
            status.appendChild(title);
            const list = document.createElement('ul');
            list.className = 'mt-1 space-y-1 text-xs';
            rejected.slice(0, 12).forEach(item => {
              const row = document.createElement('li');
              row.textContent = item?.error || 'Photo rejected because the original image has no embedded GPS metadata.';
              list.appendChild(row);
            });
            if (rejected.length > 12) {
              const row = document.createElement('li');
              row.textContent = `+${rejected.length - 12} more rejected photo${rejected.length - 12 === 1 ? '' : 's'}.`;
              list.appendChild(row);
            }
            status.appendChild(list);
          }
        }
        if (uploaded || duplicates) {
          await reloadAbearcMap({ forceFull: true });
          toast(`${uploaded} geotag photo${uploaded === 1 ? '' : 's'} uploaded${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}${failed ? ` · ${failed} rejected` : ''}.`, failed ? 'warn' : 'success');
        } else if (failed) {
          toast(failed === 1 ? 'Photo rejected: no embedded GPS metadata was found in the original image.' : `${failed} photos rejected because no embedded GPS metadata was found in the original images.`, 'error');
        }
        if (!failed) {
          setTimeout(closeAbearcMapPhotoUploadModal, 450);
        } else {
          abearcMapManualUploadFiles = [];
          const input = document.getElementById('abearcMapPhotoUploadFiles');
          if (input) input.value = '';
          updateAbearcMapPhotoUploadLabel();
        }
      } catch (error) {
        if (status) status.textContent = error.message || 'Photo upload failed.';
        toast(error.message || 'Photo upload failed.', 'error');
      } finally {
        if (save) { save.disabled = false; save.textContent = 'Upload Photos'; }
      }
    }

    function setAbearcMapPhotosVisible(visible) {
      rememberAbearcMapLayoutChange();
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
      rememberAbearcMapLayoutChange();
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
        window.toggleAbearcOrthomosaicDrawer?.(false);
        window.toggleAbearcMapLayoutsDrawer?.(false);
        syncAbearcMapPhotoVisibilityControl();
        syncAbearcDavaoBoundaryControl();
        syncAbearcNoahFloodControls();
        loadAbearcChirpsConfig();
        loadAbearcTerraClimateConfig();
      }
    }

    function setAbearcMapBasemap(kind) {
      rememberAbearcMapLayoutChange();
      if (!['google-terrain', 'google-satellite', 'open-topo'].includes(kind)) return;
      abearcMapBasemap = kind;
      localStorage.setItem('abearcMapBasemap', kind);
      syncAbearcMapBasemapControl();
      toggleAbearcMapLayerMenu(false);
      closeAbearcMapLayerLabelMenu();
      if (!abearcMapExploded?.persistent && !(abearcMapAltHeld && abearcMapExploded?.collapseOnAltRelease)) collapseAbearcMapExplosion();
      if (!abearcMap) return;
      document.getElementById('abearcMapBasemapError')?.classList.add('hidden');
      abearcMap.setStyle(abearcMapBasemapStyle(kind));
      renderAbearcMapMeasure();
      setTimeout(() => abearcMap?.resize(), 80);
    }

    function setAbearcZoningEnabled(enabled) {
      rememberAbearcMapLayoutChange();
      abearcZoningEnabled = Boolean(enabled);
      localStorage.setItem('abearcMapZoningEnabled', String(abearcZoningEnabled));
      syncAbearcMapBasemapControl();
      if (!abearcZoningEnabled) abearcZoningLabelsAbort?.abort();
      if (abearcMap) abearcMap.setStyle(abearcMapBasemapStyle());
      toast(`Zoning overlay ${abearcZoningEnabled ? 'shown' : 'hidden'}.`);
    }

    function toggleAbearcZoningLayer() {
      setAbearcZoningEnabled(!abearcZoningEnabled);
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

    function syncAbearcEnvironmentalPanel(panel, enabled) {
      panel?.classList.toggle('is-enabled', enabled);
      if (!enabled) {
        panel?.classList.remove('is-expanded');
        const button = panel?.querySelector('[data-map-environment-expand]');
        button?.setAttribute('aria-expanded', 'false');
        if (button) button.setAttribute('aria-label', button.getAttribute('aria-label').replace('Collapse', 'Expand'));
      }
    }

    function toggleAbearcEnvironmentalPanel(key) {
      const selector = key === 'noah' ? '[data-map-noah-flood-panel]' : `[data-map-climate-panel="${key}"]`;
      const panel = document.querySelector(selector);
      if (!panel?.classList.contains('is-enabled')) return;
      const expanded = panel.classList.toggle('is-expanded');
      const button = panel.querySelector('[data-map-environment-expand]');
      button?.setAttribute('aria-expanded', String(expanded));
      if (button) button.setAttribute('aria-label', button.getAttribute('aria-label').replace(expanded ? 'Expand' : 'Collapse', expanded ? 'Collapse' : 'Expand'));
    }

    function syncAbearcClimateBadge() {
      syncAbearcEnvironmentalPanel(document.querySelector('[data-map-climate-panel="chirps"]'), abearcChirpsEnabled);
      syncAbearcEnvironmentalPanel(document.querySelector('[data-map-climate-panel="terraclimate"]'), abearcTerraClimateEnabled);
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
      rememberAbearcMapLayoutChange();
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
        if (!abearcChirpsEnabled) return false;
        rememberAbearcMapLayoutChange();
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
      rememberAbearcMapLayoutChange();
      if (!enabled) {
        abearcChirpsEnabled = false;
        removeAbearcChirpsLayer();
        saveAbearcChirpsState();
        syncAbearcChirpsControls();
        setAbearcChirpsStatus(abearcChirpsConfig ? `Available through ${abearcChirpsConfig.latest_date}` : 'Rainfall overlay hidden');
        if (!abearcTerraClimateEnabled) abearcClimateGraphPopup?.remove();
        return;
      }
      abearcNoahFloodEnabled = false;
      removeAbearcNoahFloodLayer();
      localStorage.setItem('abearcMapNoahFloodEnabled', 'false');
      abearcTerraClimateEnabled = false;
      removeAbearcTerraClimateLayer();
      saveAbearcTerraClimateState();
      abearcChirpsEnabled = true;
      saveAbearcChirpsState();
      syncAbearcTerraClimateControls();
      syncAbearcNoahFloodControls();
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
      rememberAbearcMapLayoutChange();
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
        if (!abearcTerraClimateEnabled) return false;
        rememberAbearcMapLayoutChange();
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
      rememberAbearcMapLayoutChange();
      if (!enabled) {
        abearcTerraClimateEnabled = false;
        removeAbearcTerraClimateLayer();
        saveAbearcTerraClimateState();
        syncAbearcTerraClimateControls();
        setAbearcTerraClimateStatus(abearcTerraClimateConfig ? `Available through ${abearcTerraClimateConfig.latest_date}` : 'Temperature overlay hidden');
        if (!abearcChirpsEnabled) abearcClimateGraphPopup?.remove();
        return;
      }
      abearcNoahFloodEnabled = false;
      removeAbearcNoahFloodLayer();
      localStorage.setItem('abearcMapNoahFloodEnabled', 'false');
      abearcChirpsEnabled = false;
      removeAbearcChirpsLayer();
      saveAbearcChirpsState();
      abearcTerraClimateEnabled = true;
      saveAbearcTerraClimateState();
      syncAbearcChirpsControls();
      syncAbearcNoahFloodControls();
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
      syncAbearcEnvironmentalPanel(panel, abearcNoahFloodEnabled);
      if (toggle) toggle.checked = abearcNoahFloodEnabled;
      if (opacity) opacity.value = String(Math.round(abearcNoahFloodOpacity * 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(abearcNoahFloodOpacity * 100)}%`;
      document.querySelectorAll('[data-map-flood-overlay]').forEach(button => {
        button.classList.toggle('is-active', abearcNoahFloodEnabled);
        button.setAttribute('aria-pressed', String(abearcNoahFloodEnabled));
        button.setAttribute('aria-label', `${abearcNoahFloodEnabled ? 'Hide' : 'Show'} flood hazard overlay`);
      });
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
      rememberAbearcMapLayoutChange();
      abearcNoahFloodEnabled = Boolean(enabled);
      localStorage.setItem('abearcMapNoahFloodEnabled', String(abearcNoahFloodEnabled));
      if (!abearcNoahFloodEnabled) {
        syncAbearcNoahFloodControls();
        removeAbearcNoahFloodLayer();
        abearcNoahFloodPopup?.remove();
        return;
      }
      abearcChirpsEnabled = false;
      abearcTerraClimateEnabled = false;
      removeAbearcChirpsLayer();
      removeAbearcTerraClimateLayer();
      saveAbearcChirpsState();
      saveAbearcTerraClimateState();
      syncAbearcChirpsControls();
      syncAbearcTerraClimateControls();
      abearcClimateGraphPopup?.remove();
      syncAbearcNoahFloodControls();
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
      rememberAbearcMapLayoutChange();
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
      rememberAbearcMapLayoutChange();
      if (!Object.prototype.hasOwnProperty.call(ABEARC_MAP_LAYER_NAMES, kind)) return;
      abearcMapLayerLabels[kind] = Boolean(visible);
      localStorage.setItem('abearcMapLayerLabels', JSON.stringify(abearcMapLayerLabels));
      if (kind === 'zoning') localStorage.setItem('abearcZoningLabelsVisible', String(Boolean(visible)));
      closeAbearcMapLayerLabelMenu();
      if (kind === 'zoning' ? !abearcZoningEnabled : kind !== abearcMapBasemap) return;
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
      if (!abearcMap || !abearcZoningEnabled || abearcMapLayerLabels.zoning === false) return;
      abearcZoningLabelsTimer = setTimeout(reloadAbearcZoningLabels, delay);
    }

    async function reloadAbearcZoningLabels() {
      const source = abearcMap?.getSource('abearc-zoning-labels');
      if (!source || !abearcZoningEnabled || abearcMapLayerLabels.zoning === false) return;
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
      window.setupAbearcOrthomosaicLayers?.();
      window.setupAbearcWeatherLayers?.();
      setupAbearcChirpsLayer();
      setupAbearcTerraClimateLayer();
      setupAbearcNoahFloodLayer();
      if (!abearcMap.getSource('abearc-davao-boundary')) {
        abearcMap.addSource('abearc-davao-boundary', {
          type: 'geojson',
          data: '/assets/data/davao-city-boundary.geojson',
          attribution: 'Davao City boundary: CPDO zoning extent (2019-2028)'
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
      if (!abearcMap.getSource('abearc-administrative-search-boundary')) {
        abearcMap.addSource('abearc-administrative-search-boundary', {
          type: 'geojson',
          data: abearcMapAdministrativeBoundaryData,
          attribution: 'Official administrative boundaries: City Planning and Development Office (CPDO), Davao City'
        });
      }
      if (!abearcMap.getLayer('abearc-administrative-search-boundary-fill')) {
        abearcMap.addLayer({
          id: 'abearc-administrative-search-boundary-fill',
          type: 'fill',
          source: 'abearc-administrative-search-boundary',
          paint: { 'fill-color': '#facc15', 'fill-opacity': 0.16 }
        });
      }
      if (!abearcMap.getLayer('abearc-administrative-search-boundary-line')) {
        abearcMap.addLayer({
          id: 'abearc-administrative-search-boundary-line',
          type: 'line',
          source: 'abearc-administrative-search-boundary',
          paint: {
            'line-color': '#facc15',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 16, 4],
            'line-opacity': 1
          }
        });
      }
      bindAbearcAdministrativeBoundaryInteractions();
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

    function abearcMapFilterElement(id) {
      if (id === 'mapDateFromFilter') return document.querySelector('[data-map-date-from]');
      if (id === 'mapDateToFilter') return document.querySelector('[data-map-date-to]');
      return document.getElementById(id);
    }

    function mapQueryParams({ incremental = false } = {}) {
      const globalQuery = Boolean(abearcMapCommittedSearch) || Boolean(abearcMapAdministrativeSearchSelection) || abearcMapPhotoScope === 'saved' || abearcMapPhotoScope === 'mine';
      const params = new URLSearchParams({ limit: globalQuery ? '5000' : '2500' });
      const searchValue = abearcMapCommittedSearch;
      if (searchValue) params.set('search', searchValue);
      if (abearcMapAdministrativeSearchSelection) {
        params.set('boundary_type', abearcMapAdministrativeSearchSelection.type);
        params.set('boundary_name', abearcMapAdministrativeSearchSelection.name);
        if (abearcMapAdministrativeSearchSelection.code) params.set('boundary_code', abearcMapAdministrativeSearchSelection.code);
      }
      const mapFields = [
        ['category', 'mapCategoryFilter'],
        ['district', 'mapDistrictFilter'],
        ['barangay', 'mapBarangayFilter'],
        ['location_status', 'mapLocationStatusFilter'],
        ['date_from', 'mapDateFromFilter'],
        ['date_to', 'mapDateToFilter']
      ];
      mapFields.forEach(([key, id]) => {
        const value = abearcMapFilterElement(id)?.value;
        if (value) params.set(key, key === 'date_to' ? `${value}T23:59:59` : value);
      });
      if (abearcMapPhotoScope === 'mine' && Number(currentUser?.id) > 0) params.set('user_id', String(Number(currentUser.id)));
      if (document.getElementById('mapMyUploadsOnly')?.checked) params.set('my_uploads_only', 'true');
      if (document.getElementById('mapUnlinkedOnly')?.checked) params.set('unlinked_only', 'true');
      params.set('map_status', 'active');
      if (!globalQuery && abearcMap?.getBounds) {
        const bounds = abearcMap.getBounds();
        const west = Number(bounds.getWest()); const east = Number(bounds.getEast());
        const south = Number(bounds.getSouth()); const north = Number(bounds.getNorth());
        if ([west, east, south, north].every(Number.isFinite)) {
          const lngPad = Math.max(0.002, (east - west) * 0.15);
          const latPad = Math.max(0.002, (north - south) * 0.15);
          params.set('west', String(west - lngPad));
          params.set('east', String(east + lngPad));
          params.set('south', String(south - latPad));
          params.set('north', String(north + latPad));
        }
      }
      if (incremental && abearcMapLastServerTime) params.set('updated_after', abearcMapLastServerTime);
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
        ['mapLocationStatusFilter', 'Location status'],
        ['mapDateFromFilter', 'Date from'],
        ['mapDateToFilter', 'Date to']
      ];
      const labels = fields
        .filter(([id]) => Boolean(abearcMapFilterElement(id)?.value))
        .map(([, label]) => label);
      if (abearcMapAdministrativeSearchSelection) labels.unshift(`${abearcMapAdministrativeSearchSelection.type === 'district' ? 'District' : 'Barangay'} boundary`);
      else if (abearcMapCommittedSearch) labels.unshift('Search');
      if (document.getElementById('mapMyUploadsOnly')?.checked) labels.push('My uploads');
      if (document.getElementById('mapUnlinkedOnly')?.checked) labels.push('Unlinked');
      return labels;
    }

    function updateAbearcMapWorkspaceSummary() {
      const count = abearcMapVisibleListFeatures().length;
      const filters = abearcMapActiveFilterLabels();
      if (abearcMapPhotoScope === 'saved') filters.unshift('Saved');
      if (abearcMapPhotoScope === 'mine') filters.unshift('My geotagged photos');
      const activeFilters = document.querySelector('[data-map-active-filters]');
      const resultsTitle = document.querySelector('[data-map-results-title]');
      const resultsOrder = document.querySelector('[data-map-results-order]');
      if (resultsTitle) resultsTitle.textContent = abearcMapPhotoScope === 'saved'
        ? 'Saved photos'
        : (abearcMapPhotoScope === 'mine' ? 'My geotagged photos' : 'Geotag Photos');
      if (resultsOrder) resultsOrder.textContent = abearcMapPhotoScope === 'saved'
        ? 'Saved on this device'
        : (abearcMapPhotoScope === 'mine' ? 'Uploaded by me' : 'Newest first');
      if (activeFilters) activeFilters.textContent = filters.length
        ? `${filters.length} active filter${filters.length === 1 ? '' : 's'}`
        : 'No active filters';
      const filterButton = document.querySelector('[data-map-filter-button]');
      filterButton?.classList.toggle('has-active-filters', filters.length > 0);
      document.querySelectorAll('[data-map-bulk-rename], [data-map-bulk-download]').forEach(button => {
        button.disabled = count === 0;
      });
      const bulkDelete = document.querySelector('[data-map-bulk-delete]');
      const hasDeletablePhotos = deletableAbearcMapPhotoIds().length > 0;
      bulkDelete?.classList.toggle('hidden', !hasDeletablePhotos);
      document.querySelector('[data-map-bulk-delete-separator]')?.classList.toggle('hidden', !hasDeletablePhotos);
      if (bulkDelete) bulkDelete.disabled = !hasDeletablePhotos;
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
      const layoutsButton = page.querySelector('[data-map-layouts-toolbar]');
      const layoutsDrawer = page.querySelector('[data-map-layouts-panel]');
      if (layoutsButton?.classList.contains('is-active') && layoutsDrawer) {
        const open = forceOpen == null ? layoutsDrawer.classList.contains('hidden') : Boolean(forceOpen);
        window.toggleAbearcMapLayoutsDrawer?.(open);
        return;
      }
      const orthomosaicButton = page.querySelector('[data-map-orthomosaic-toolbar]');
      const orthomosaicDrawer = page.querySelector('[data-map-orthomosaic-panel]');
      if (orthomosaicButton?.classList.contains('is-active') && orthomosaicDrawer) {
        const open = forceOpen == null ? orthomosaicDrawer.classList.contains('hidden') : Boolean(forceOpen);
        orthomosaicDrawer.classList.toggle('hidden', !open);
        animateAbearcMapResize();
        return;
      }
      const compact = window.matchMedia('(max-width: 900px)').matches;
      const currentlyOpen = compact
        ? page.classList.contains('is-results-panel-open')
        : !page.classList.contains('is-results-panel-collapsed');
      const open = forceOpen == null ? !currentlyOpen : Boolean(forceOpen);
      page.querySelector('[data-map-results-panel]')?.classList.toggle('hidden', !open);
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

    function abearcMapBaseScopedFeatures() {
      const features = abearcMapFeatures;
      if (abearcMapLayoutFrozenPhotoIds instanceof Set) {
        return features.filter(feature => abearcMapLayoutFrozenPhotoIds.has(Number(abearcFeatureId(feature))));
      }
      if (abearcMapPhotoScope === 'saved') {
        return features.filter(feature => abearcMapSavedPhotoIds.has(Number(abearcFeatureId(feature))));
      }
      if (abearcMapPhotoScope === 'mine') {
        return features.filter(feature => Number(feature?.properties?.owner_user_id) === Number(currentUser?.id));
      }
      return features;
    }

    function abearcMapPhotoDateKey(feature) {
      const raw = feature?.properties?.captured_at || feature?.properties?.uploaded_at || feature?.properties?.created_at || '';
      if (!raw) return '';
      const date = new Date(raw);
      if (!Number.isFinite(date.getTime())) return /^\d{4}-\d{2}-\d{2}/.test(String(raw)) ? String(raw).slice(0, 10) : '';
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
      } catch (_) {
        return date.toISOString().slice(0, 10);
      }
    }

    function abearcMapRawScopedFeatures({ ignoreViewportTimeline = false } = {}) {
      const features = abearcMapBaseScopedFeatures();
      if (ignoreViewportTimeline || !abearcMapViewportTimelineDate) return features;
      if (abearcMapViewportTimelineMode === 'asof') {
        return features.filter(feature => {
          const key = abearcMapPhotoDateKey(feature);
          return key && key <= abearcMapViewportTimelineDate;
        });
      }
      return features.filter(feature => abearcMapPhotoDateKey(feature) === abearcMapViewportTimelineDate);
    }

    function abearcMapSiteSeriesSemanticKey(feature) {
      const props = feature?.properties || {};
      if (Number(props.inventory_item_id || 0) > 0) return `inventory:${Number(props.inventory_item_id)}`;
      const category = String(props.category || 'General').trim().toLowerCase();
      if (Number(props.project_id || 0) > 0) return `project:${Number(props.project_id)}:${category}`;
      return `place:${String(props.district || '').toLowerCase()}:${String(props.barangay || '').toLowerCase()}:${category}`;
    }

    function abearcMapDistanceMeters(a, b) {
      const ac = a?.geometry?.coordinates || a; const bc = b?.geometry?.coordinates || b;
      const lon1 = Number(ac?.[0]); const lat1 = Number(ac?.[1]); const lon2 = Number(bc?.[0]); const lat2 = Number(bc?.[1]);
      if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return Infinity;
      const toRad = value => value * Math.PI / 180;
      const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
    }

    function abearcMapCollapseSiteSeries(features = [], { force = false } = {}) {
      if ((!abearcMapGroupSiteSeries && !force) || abearcMapLayoutFrozenPhotoIds instanceof Set || features.length < 2) return features;
      const sorted = [...features].sort((a, b) => {
        const at = new Date(a?.properties?.captured_at || a?.properties?.uploaded_at || 0).getTime() || 0;
        const bt = new Date(b?.properties?.captured_at || b?.properties?.uploaded_at || 0).getTime() || 0;
        return bt - at || Number(abearcFeatureId(b)) - Number(abearcFeatureId(a));
      });
      const buckets = new Map();
      const groups = [];
      const cell = 0.00023;
      sorted.forEach(feature => {
        const coordinates = feature?.geometry?.coordinates;
        if (!Array.isArray(coordinates)) return;
        const lon = Number(coordinates[0]); const lat = Number(coordinates[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        const semantic = abearcMapSiteSeriesSemanticKey(feature);
        const bx = Math.floor(lon / cell); const by = Math.floor(lat / cell);
        let group = null;
        for (let dx = -1; dx <= 1 && !group; dx += 1) for (let dy = -1; dy <= 1 && !group; dy += 1) {
          const candidates = buckets.get(`${semantic}|${bx + dx}|${by + dy}`) || [];
          group = candidates.find(item => abearcMapDistanceMeters(item.anchor, feature) <= 25) || null;
        }
        if (!group) {
          group = { anchor: feature, features: [] };
          groups.push(group);
          const key = `${semantic}|${bx}|${by}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(group);
        }
        group.features.push(feature);
      });
      return groups.map(group => {
        if (group.features.length === 1) return group.anchor;
        const representative = { ...group.anchor, properties: { ...(group.anchor.properties || {}) } };
        representative.properties.site_series_count = group.features.length;
        representative.properties.site_series_anchor_id = Number(abearcFeatureId(group.anchor));
        representative.properties.site_series_first_at = group.features[group.features.length - 1]?.properties?.captured_at || group.features[group.features.length - 1]?.properties?.uploaded_at || null;
        representative.properties.site_series_latest_at = group.anchor?.properties?.captured_at || group.anchor?.properties?.uploaded_at || null;
        return representative;
      });
    }

    function abearcMapScopedFeatures() {
      const forceHistoricalSnapshot = Boolean(abearcMapViewportTimelineDate && abearcMapViewportTimelineMode === 'asof');
      return abearcMapCollapseSiteSeries(abearcMapRawScopedFeatures(), { force: forceHistoricalSnapshot });
    }

    function clearAbearcMapLayoutPhotoFreeze() {
      abearcMapLayoutFrozenPhotoIds = null;
    }

    function abearcMapVisibleListFeatures() {
      const scopedFeatures = abearcMapScopedFeatures().filter(feature => !abearcMapSessionHiddenPhotoIds.has(Number(abearcFeatureId(feature))));
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

    function abearcMapVisibleRawFeatures({ ignoreViewportTimeline = true } = {}) {
      const scopedFeatures = abearcMapRawScopedFeatures({ ignoreViewportTimeline })
        .filter(feature => !abearcMapSessionHiddenPhotoIds.has(Number(abearcFeatureId(feature))));
      const canvas = abearcMap?.getCanvas?.();
      const width = Number(canvas?.clientWidth || 0);
      const height = Number(canvas?.clientHeight || 0);
      if (!abearcMap || width <= 0 || height <= 0) return scopedFeatures;
      const edgeAllowance = 2;
      return scopedFeatures.filter(feature => {
        const coordinates = feature?.geometry?.coordinates;
        if (!Array.isArray(coordinates)
            || !Number.isFinite(Number(coordinates[0]))
            || !Number.isFinite(Number(coordinates[1]))) return false;
        const point = abearcMap.project([Number(coordinates[0]), Number(coordinates[1])]);
        return point.x >= -edgeAllowance && point.y >= -edgeAllowance
          && point.x <= width + edgeAllowance && point.y <= height + edgeAllowance;
      });
    }

    function abearcMapViewportTimelineEntries() {
      const groups = new Map();
      abearcMapVisibleRawFeatures({ ignoreViewportTimeline: true }).forEach(feature => {
        const key = abearcMapPhotoDateKey(feature);
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(feature);
      });
      return [...groups.entries()]
        .map(([key, features]) => ({ key, features, count: features.length, time: Date.parse(`${key}T00:00:00+08:00`) || 0 }))
        .sort((a, b) => a.time - b.time || a.key.localeCompare(b.key));
    }

    function formatAbearcMapViewportTimelineDate(key, { compact = false, yearOnly = false } = {}) {
      if (!key) return '';
      const date = new Date(`${key}T00:00:00+08:00`);
      if (!Number.isFinite(date.getTime())) return key;
      if (yearOnly) return date.toLocaleDateString('en-PH', { year: 'numeric', timeZone: 'Asia/Manila' });
      return date.toLocaleDateString('en-PH', compact
        ? { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }
        : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
    }

    function abearcMapViewportTimelineTicks(entries = []) {
      if (!entries.length) return [];
      const first = new Date(`${entries[0].key}T00:00:00Z`);
      const last = new Date(`${entries.at(-1).key}T00:00:00Z`);
      const firstTime = first.getTime();
      const lastTime = last.getTime();
      const spanDays = Math.max(1, (lastTime - firstTime) / 86400000);
      const ticks = [];
      const pushTick = (date, label, major = false) => {
        const time = date.getTime();
        if (time < firstTime || time > lastTime) return;
        if (ticks.some(item => Math.abs(item.time - time) < 12 * 3600000)) return;
        ticks.push({ time, label, major });
      };

      if (spanDays <= 45) {
        const stepDays = spanDays <= 14 ? 2 : 7;
        const cursor = new Date(firstTime);
        cursor.setUTCHours(0, 0, 0, 0);
        while (cursor.getTime() <= lastTime) {
          pushTick(new Date(cursor), cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }), cursor.getUTCDate() === 1);
          cursor.setUTCDate(cursor.getUTCDate() + stepDays);
        }
      } else if (spanDays <= 430) {
        const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
        while (cursor.getTime() <= lastTime) {
          const major = cursor.getUTCMonth() === 0;
          pushTick(new Date(cursor), major
            ? String(cursor.getUTCFullYear())
            : cursor.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }), major);
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      } else if (spanDays <= 1460) {
        const startMonth = Math.floor(first.getUTCMonth() / 3) * 3;
        const cursor = new Date(Date.UTC(first.getUTCFullYear(), startMonth, 1));
        while (cursor.getTime() <= lastTime) {
          const major = cursor.getUTCMonth() === 0;
          pushTick(new Date(cursor), major
            ? String(cursor.getUTCFullYear())
            : cursor.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }), major);
          cursor.setUTCMonth(cursor.getUTCMonth() + 3);
        }
      } else {
        const cursor = new Date(Date.UTC(first.getUTCFullYear(), 0, 1));
        while (cursor.getTime() <= lastTime) {
          pushTick(new Date(cursor), String(cursor.getUTCFullYear()), true);
          cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
        }
      }
      if (!ticks.length || Math.abs(ticks[0].time - firstTime) > 86400000 * 20) {
        pushTick(first, spanDays > 430 ? String(first.getUTCFullYear()) : formatAbearcMapViewportTimelineDate(entries[0].key, { compact: true }), true);
      }
      return ticks.sort((a, b) => a.time - b.time);
    }

    function abearcMapViewportTimelineNearestEntry(entries, time) {
      if (!entries.length) return null;
      const target = Number(time);
      if (!Number.isFinite(target)) return entries[0];
      let nearest = entries[0];
      let distance = Math.abs(entries[0].time - target);
      for (let index = 1; index < entries.length; index += 1) {
        const candidateDistance = Math.abs(entries[index].time - target);
        if (candidateDistance < distance) {
          nearest = entries[index];
          distance = candidateDistance;
        }
      }
      return nearest;
    }

    function renderAbearcMapViewportTimelinePreview(entry, { position = null } = {}) {
      const root = document.querySelector('[data-map-viewport-timeline]');
      const preview = root?.querySelector('[data-map-viewport-timeline-preview]');
      if (!preview || !entry) {
        preview?.classList.add('hidden');
        return;
      }
      preview.classList.remove('hidden');
      const date = preview.querySelector('[data-map-viewport-timeline-preview-date]');
      const count = preview.querySelector('[data-map-viewport-timeline-preview-count]');
      const thumbs = preview.querySelector('[data-map-viewport-timeline-preview-thumbs]');
      if (date) date.textContent = formatAbearcMapViewportTimelineDate(entry.key);
      if (count) count.textContent = `${entry.count.toLocaleString()} photo${entry.count === 1 ? '' : 's'}${abearcMapViewportTimelineMode === 'asof' ? ' · historical snapshot' : ''}`;
      if (thumbs) {
        const sample = entry.features.slice(0, 6);
        thumbs.innerHTML = sample.map(feature => {
          const id = Number(abearcFeatureId(feature));
          const url = abearcAuthenticatedMediaUrl(feature?.properties?.thumbnail_url || '');
          const category = esc(feature?.properties?.category || 'Geotag photo');
          return `<button type="button" onclick="openAbearcMapDetails(${id})" title="Open ${category}">${url ? `<img alt="${category}" src="${url}">` : abearcMarkerPlaceholder()}</button>`;
        }).join('') + (entry.count > sample.length ? `<span>+${entry.count - sample.length}</span>` : '');
      }
      if (Number.isFinite(position)) {
        const clamped = Math.max(11, Math.min(89, Number(position)));
        preview.style.left = `${clamped}%`;
      }
    }

    function stopAbearcMapViewportTimelinePlayback() {
      if (abearcMapViewportTimelineTimer) clearInterval(abearcMapViewportTimelineTimer);
      abearcMapViewportTimelineTimer = null;
      abearcMapViewportTimelinePlaying = false;
      const playIcon = document.querySelector('[data-map-viewport-timeline-play-icon]');
      const pauseIcon = document.querySelector('[data-map-viewport-timeline-pause-icon]');
      const playButton = document.querySelector('[data-map-viewport-timeline-play]');
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
      playButton?.setAttribute('aria-label', 'Play photo timeline');
      playButton?.setAttribute('title', 'Play timeline');
      playButton?.setAttribute('aria-pressed', 'false');
    }

    function syncAbearcMapViewportTimeline() {
      const root = document.querySelector('[data-map-viewport-timeline]');
      const toggleButton = document.querySelector('[data-map-timeline-toggle]');
      if (toggleButton) {
        toggleButton.classList.toggle('is-active', abearcMapViewportTimelineVisible);
        toggleButton.setAttribute('aria-pressed', String(abearcMapViewportTimelineVisible));
        toggleButton.setAttribute('aria-expanded', String(abearcMapViewportTimelineVisible));
        toggleButton.setAttribute('title', abearcMapViewportTimelineVisible ? 'Hide timeline' : 'Timeline');
        toggleButton.setAttribute('aria-label', abearcMapViewportTimelineVisible ? 'Hide timeline' : 'Open timeline');
      }
      if (!root) return;
      root.classList.toggle('is-hidden', !abearcMapViewportTimelineVisible);
      root.classList.toggle('is-collapsed', abearcMapViewportTimelineVisible && abearcMapViewportTimelineCollapsed);
      root.classList.toggle('has-selection', Boolean(abearcMapViewportTimelineDate));
      root.classList.toggle('is-asof', abearcMapViewportTimelineMode === 'asof');
      const handle = root.querySelector('[data-map-viewport-timeline-handle]');
      handle?.setAttribute('aria-expanded', String(abearcMapViewportTimelineVisible && !abearcMapViewportTimelineCollapsed));
      handle?.setAttribute('aria-label', abearcMapViewportTimelineCollapsed ? 'Expand photo timeline' : 'Collapse photo timeline');
      handle?.setAttribute('title', abearcMapViewportTimelineCollapsed ? 'Expand timeline' : 'Collapse timeline');
      if (!abearcMapViewportTimelineVisible) return;

      const entries = abearcMapViewportTimelineEntries();
      const photoCount = entries.reduce((total, entry) => total + entry.count, 0);
      if (abearcMapViewportTimelineDate && !entries.some(entry => entry.key === abearcMapViewportTimelineDate)) {
        abearcMapViewportTimelineDate = '';
        stopAbearcMapViewportTimelinePlayback();
        const source = abearcMap?.getSource?.('abearc-map-media');
        if (source) source.setData(abearcMapScopedFeatureCollection());
        scheduleAbearcMapMarkerRender();
        renderAbearcMapList();
      }

      const title = root.querySelector('[data-map-viewport-timeline-title]');
      const summary = root.querySelector('[data-map-viewport-timeline-summary]');
      const selected = root.querySelector('[data-map-viewport-timeline-selected]');
      const start = root.querySelector('[data-map-viewport-timeline-start]');
      const end = root.querySelector('[data-map-viewport-timeline-end]');
      const allButton = root.querySelector('[data-map-viewport-timeline-all]');
      const previousButton = root.querySelector('[data-map-viewport-timeline-prev]');
      const nextButton = root.querySelector('[data-map-viewport-timeline-next]');
      const playButton = root.querySelector('[data-map-viewport-timeline-play]');
      const exactButton = root.querySelector('[data-map-viewport-timeline-mode-exact]');
      const asofButton = root.querySelector('[data-map-viewport-timeline-mode-asof]');
      const modeNote = root.querySelector('[data-map-viewport-timeline-mode-note]');
      const zoomLabel = root.querySelector('[data-map-viewport-timeline-zoom-label]');
      const marks = root.querySelector('[data-map-viewport-timeline-marks]');
      const ticks = root.querySelector('[data-map-viewport-timeline-ticks]');
      const track = root.querySelector('[data-map-viewport-timeline-track]');
      const compactMarks = root.querySelector('[data-map-viewport-timeline-compact-marks]');
      const compactPreviousButton = root.querySelector('[data-map-viewport-timeline-compact-prev]');
      const compactNextButton = root.querySelector('[data-map-viewport-timeline-compact-next]');
      const compactModeButton = root.querySelector('[data-map-viewport-timeline-compact-mode]');
      const compactSelected = root.querySelector('[data-map-viewport-timeline-compact-selected]');
      const activeEntry = entries.find(entry => entry.key === abearcMapViewportTimelineDate) || null;

      if (title) title.textContent = abearcMapViewportTimelineDate
        ? (abearcMapViewportTimelineMode === 'asof'
          ? `Historical snapshot · ${formatAbearcMapViewportTimelineDate(abearcMapViewportTimelineDate)}`
          : `Observation date · ${formatAbearcMapViewportTimelineDate(abearcMapViewportTimelineDate)}`)
        : 'Geotag Photo Timeline';
      if (summary) summary.textContent = photoCount
        ? `${photoCount.toLocaleString()} photo${photoCount === 1 ? '' : 's'} · ${entries.length.toLocaleString()} observation date${entries.length === 1 ? '' : 's'} inside this map view`
        : 'No dated geotagged photos are currently inside the map view.';
      if (selected) selected.textContent = activeEntry
        ? `${abearcMapViewportTimelineMode === 'asof' ? 'As of' : 'Currently shown'}: ${formatAbearcMapViewportTimelineDate(activeEntry.key)} · ${activeEntry.count.toLocaleString()} captured that day`
        : 'All visible dates';
      if (compactModeButton) {
        const isAsOf = abearcMapViewportTimelineMode === 'asof';
        compactModeButton.textContent = isAsOf ? 'As-of' : 'Exact';
        compactModeButton.setAttribute('aria-pressed', String(isAsOf));
        compactModeButton.setAttribute('aria-label', isAsOf ? 'Timeline mode: As-of date. Click for Exact date.' : 'Timeline mode: Exact date. Click for As-of date.');
        compactModeButton.setAttribute('title', isAsOf ? 'As-of date · click for Exact' : 'Exact date · click for As-of');
      }
      if (compactSelected) {
        compactSelected.textContent = activeEntry
          ? formatAbearcMapViewportTimelineDate(activeEntry.key, { compact: true })
          : (entries.length ? 'All Dates' : '—');
        compactSelected.disabled = entries.length === 0;
        compactSelected.setAttribute('aria-pressed', String(!activeEntry));
        compactSelected.setAttribute('aria-label', activeEntry
          ? `Selected date ${formatAbearcMapViewportTimelineDate(activeEntry.key)}. Click to show all dates.`
          : 'All dates shown. Click to restore the last selected date.');
        compactSelected.setAttribute('title', activeEntry ? 'Show all dates' : 'Restore selected date');
      }
      if (start) start.textContent = entries.length ? formatAbearcMapViewportTimelineDate(entries[0].key, { compact: true }) : '—';
      if (end) end.textContent = entries.length ? formatAbearcMapViewportTimelineDate(entries.at(-1).key, { compact: true }) : '—';
      allButton?.classList.toggle('is-active', !abearcMapViewportTimelineDate);
      allButton?.setAttribute('aria-pressed', String(!abearcMapViewportTimelineDate));
      exactButton?.classList.toggle('is-active', abearcMapViewportTimelineMode === 'exact');
      asofButton?.classList.toggle('is-active', abearcMapViewportTimelineMode === 'asof');
      exactButton?.setAttribute('aria-pressed', String(abearcMapViewportTimelineMode === 'exact'));
      asofButton?.setAttribute('aria-pressed', String(abearcMapViewportTimelineMode === 'asof'));
      if (modeNote) modeNote.textContent = abearcMapViewportTimelineMode === 'asof'
        ? 'As-of date shows the latest available observation at each monitored site on or before the selected date.'
        : 'Exact date shows only photos captured on the selected observation date.';
      if (zoomLabel) zoomLabel.textContent = `${abearcMapViewportTimelineZoom}×`;
      const controlsDisabled = entries.length === 0;
      if (previousButton) previousButton.disabled = controlsDisabled;
      if (nextButton) nextButton.disabled = controlsDisabled;
      if (compactPreviousButton) compactPreviousButton.disabled = controlsDisabled;
      if (compactNextButton) compactNextButton.disabled = controlsDisabled;
      if (playButton) playButton.disabled = entries.length < 2;

      if (!marks || !track || !ticks) return;
      if (!entries.length) {
        marks.innerHTML = '<span class="abearc-map-viewport-timeline-empty">No dated photos in this view</span>';
        ticks.innerHTML = '';
        if (compactMarks) compactMarks.innerHTML = '';
        track.style.width = '100%';
        renderAbearcMapViewportTimelinePreview(null);
        return;
      }

      const firstTime = entries[0].time;
      const lastTime = entries.at(-1).time;
      const span = Math.max(1, lastTime - firstTime);
      const baseWidth = Math.max(620, Math.min(1800, entries.length * 30));
      track.style.width = `max(100%, ${Math.round(baseWidth * abearcMapViewportTimelineZoom)}px)`;
      const positionForTime = time => entries.length === 1 ? 50 : ((time - firstTime) / span) * 100;

      const observationDateKeys = new Set(entries.map(entry => entry.key));
      ticks.innerHTML = abearcMapViewportTimelineTicks(entries).map(tick => {
        const position = positionForTime(tick.time);
        const tickDateKey = new Date(tick.time).toISOString().slice(0, 10);
        const duplicatePhotoDate = observationDateKeys.has(tickDateKey);
        return `<span class="abearc-map-viewport-timeline-tick${tick.major ? ' is-major' : ''}${duplicatePhotoDate ? ' has-photo-date' : ''}" style="left:${position.toFixed(4)}%"><i></i>${duplicatePhotoDate ? '' : `<b>${esc(tick.label)}</b>`}</span>`;
      }).join('');

      const maxCount = Math.max(...entries.map(entry => entry.count), 1);
      const renderedTrackWidth = Math.max(620, Math.round(baseWidth * abearcMapViewportTimelineZoom));
      const activeIndex = entries.findIndex(entry => entry.key === abearcMapViewportTimelineDate);
      const dateLabelIndexes = new Set();
      const forcedIndexes = [0, entries.length - 1, activeIndex].filter(index => index >= 0);
      forcedIndexes.forEach(index => dateLabelIndexes.add(index));
      const labelPositions = forcedIndexes.map(index => positionForTime(entries[index].time) * renderedTrackWidth / 100);
      entries.forEach((entry, index) => {
        if (dateLabelIndexes.has(index)) return;
        const positionPx = positionForTime(entry.time) * renderedTrackWidth / 100;
        if (labelPositions.every(existing => Math.abs(existing - positionPx) >= 58)) {
          dateLabelIndexes.add(index);
          labelPositions.push(positionPx);
        }
      });
      marks.innerHTML = entries.map((entry, index) => {
        const position = positionForTime(entry.time);
        const active = entry.key === abearcMapViewportTimelineDate;
        const label = formatAbearcMapViewportTimelineDate(entry.key);
        const compactDate = formatAbearcMapViewportTimelineDate(entry.key, { compact: true });
        const size = 10 + Math.round(8 * Math.sqrt(entry.count / maxCount));
        const dateText = dateLabelIndexes.has(index) ? `<small>${esc(compactDate)}</small>` : '';
        const countText = entry.count > 1 ? `<span>${entry.count > 99 ? '99+' : entry.count}</span>` : '';
        return `<button type="button" class="abearc-map-viewport-timeline-mark${active ? ' is-active' : ''}" data-map-viewport-timeline-date="${entry.key}" style="left:${position.toFixed(4)}%;--timeline-dot-size:${size}px" onclick="selectAbearcMapViewportTimelineDate('${entry.key}', { focusTimeline: true })" onmouseenter="previewAbearcMapViewportTimelineDate('${entry.key}')" onfocus="previewAbearcMapViewportTimelineDate('${entry.key}')" aria-pressed="${active}" title="${label} · ${entry.count} photo${entry.count === 1 ? '' : 's'}"><i></i>${dateText}${countText}</button>`;
      }).join('');

      if (compactMarks) {
        compactMarks.innerHTML = entries.map(entry => {
          const position = positionForTime(entry.time);
          const active = entry.key === abearcMapViewportTimelineDate;
          return `<i class="abearc-map-viewport-timeline-compact-mark${active ? ' is-active' : ''}" style="left:${position.toFixed(4)}%"></i>`;
        }).join('');
      }
      if (activeEntry) {
        renderAbearcMapViewportTimelinePreview(activeEntry, { position: positionForTime(activeEntry.time) });
      } else {
        renderAbearcMapViewportTimelinePreview(null);
      }

      requestAnimationFrame(() => {
        const activeMark = marks.querySelector('.abearc-map-viewport-timeline-mark.is-active');
        if (activeMark) activeMark.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      });
    }

    function previewAbearcMapViewportTimelineDate(dateKey = '') {
      const entries = abearcMapViewportTimelineEntries();
      const entry = entries.find(item => item.key === dateKey);
      if (!entry) return;
      const firstTime = entries[0]?.time || entry.time;
      const lastTime = entries.at(-1)?.time || entry.time;
      const position = entries.length === 1 ? 50 : ((entry.time - firstTime) / Math.max(1, lastTime - firstTime)) * 100;
      renderAbearcMapViewportTimelinePreview(entry, { position });
    }

    function handleAbearcMapViewportTimelineKey(event) {
      if (!event || event.altKey || event.ctrlKey || event.metaKey) return true;
      const typingTarget = Boolean(event.target?.closest?.('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]'));
      if (typingTarget) return true;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismissAbearcMapViewportTimelineStep();
        return false;
      }
      if (!abearcMapViewportTimelineVisible) return true;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepAbearcMapViewportTimeline(-1);
        return false;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepAbearcMapViewportTimeline(1);
        return false;
      }
      if (event.key === 'Home' || event.key === 'End') {
        const entries = abearcMapViewportTimelineEntries();
        if (!entries.length) return false;
        event.preventDefault();
        const entry = event.key === 'Home' ? entries[0] : entries.at(-1);
        selectAbearcMapViewportTimelineDate(entry.key);
        return false;
      }
      return true;
    }


    function selectAbearcMapViewportTimelineDate(dateKey = '', { announce = true, keepPlayback = false, focusTimeline = false } = {}) {
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')) ? String(dateKey) : '';
      if (!keepPlayback) stopAbearcMapViewportTimelinePlayback();
      if (abearcMapViewportTimelineDate === normalized) {
        syncAbearcMapViewportTimeline();
        return;
      }
      if (normalized) abearcMapViewportTimelineLastDate = normalized;
      abearcMapViewportTimelineDate = normalized;
      collapseAbearcMapExplosion();
      refreshAbearcMapPhotoScope();
      syncAbearcMapViewportTimeline();
      if (focusTimeline) {
        requestAnimationFrame(() => {
          const timelineRoot = document.querySelector('[data-map-viewport-timeline]');
          if (!timelineRoot || timelineRoot.classList.contains('is-hidden')) return;
          if (!timelineRoot.hasAttribute('tabindex')) timelineRoot.setAttribute('tabindex', '-1');
          try { timelineRoot.focus({ preventScroll: true }); } catch (_) { timelineRoot.focus(); }
        });
      }
      if (announce) {
        if (!normalized) toast('Showing geotagged photos from all visible dates');
        else if (abearcMapViewportTimelineMode === 'asof') toast(`Historical map snapshot as of ${formatAbearcMapViewportTimelineDate(normalized)}`);
        else toast(`Showing geotagged photos from ${formatAbearcMapViewportTimelineDate(normalized)}`);
      }
    }

    function toggleAbearcMapViewportTimelineDateSelection() {
      const entries = abearcMapViewportTimelineEntries();
      if (!entries.length) return;
      if (abearcMapViewportTimelineDate) {
        abearcMapViewportTimelineLastDate = abearcMapViewportTimelineDate;
        return selectAbearcMapViewportTimelineDate('');
      }
      const restore = entries.find(entry => entry.key === abearcMapViewportTimelineLastDate) || entries.at(-1);
      if (restore) selectAbearcMapViewportTimelineDate(restore.key);
    }

    function setAbearcMapViewportTimelineMode(mode = 'exact') {
      const normalized = mode === 'asof' ? 'asof' : 'exact';
      if (abearcMapViewportTimelineMode === normalized) {
        syncAbearcMapViewportTimeline();
        return;
      }
      stopAbearcMapViewportTimelinePlayback();
      abearcMapViewportTimelineMode = normalized;
      localStorage.setItem('abearcMapViewportTimelineMode', normalized);
      collapseAbearcMapExplosion();
      refreshAbearcMapPhotoScope();
      syncAbearcMapViewportTimeline();
      toast(normalized === 'asof'
        ? 'As-of timeline mode: showing the latest available observation at each site up to the selected date'
        : 'Exact-date timeline mode: showing photos captured on the selected date');
    }


    function toggleAbearcMapViewportTimelineMode() {
      setAbearcMapViewportTimelineMode(abearcMapViewportTimelineMode === 'asof' ? 'exact' : 'asof');
    }

    function zoomAbearcMapViewportTimeline(direction = 1) {
      const levels = [1, 2, 4];
      const currentIndex = Math.max(0, levels.indexOf(abearcMapViewportTimelineZoom));
      const nextIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + (Number(direction) < 0 ? -1 : 1)));
      abearcMapViewportTimelineZoom = levels[nextIndex];
      syncAbearcMapViewportTimeline();
    }

    function stepAbearcMapViewportTimeline(direction = 1, { fromPlayback = false } = {}) {
      const entries = abearcMapViewportTimelineEntries();
      if (!entries.length) return false;
      const step = Number(direction) < 0 ? -1 : 1;
      let index = entries.findIndex(entry => entry.key === abearcMapViewportTimelineDate);
      if (index < 0) index = step > 0 ? -1 : entries.length;
      const next = index + step;
      if (next < 0 || next >= entries.length) {
        if (fromPlayback) stopAbearcMapViewportTimelinePlayback();
        return false;
      }
      selectAbearcMapViewportTimelineDate(entries[next].key, { announce: !fromPlayback, keepPlayback: fromPlayback });
      return true;
    }

    function toggleAbearcMapViewportTimelinePlayback() {
      if (abearcMapViewportTimelinePlaying) {
        stopAbearcMapViewportTimelinePlayback();
        return;
      }
      const entries = abearcMapViewportTimelineEntries();
      if (entries.length < 2) return;
      if (!abearcMapViewportTimelineDate || abearcMapViewportTimelineDate === entries.at(-1).key) {
        selectAbearcMapViewportTimelineDate(entries[0].key, { announce: false, keepPlayback: true });
      }
      abearcMapViewportTimelinePlaying = true;
      const playIcon = document.querySelector('[data-map-viewport-timeline-play-icon]');
      const pauseIcon = document.querySelector('[data-map-viewport-timeline-pause-icon]');
      const playButton = document.querySelector('[data-map-viewport-timeline-play]');
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
      playButton?.setAttribute('aria-label', 'Pause photo timeline');
      playButton?.setAttribute('title', 'Pause timeline');
      playButton?.setAttribute('aria-pressed', 'true');
      if (abearcMapViewportTimelineTimer) clearInterval(abearcMapViewportTimelineTimer);
      abearcMapViewportTimelineTimer = setInterval(() => {
        if (!stepAbearcMapViewportTimeline(1, { fromPlayback: true })) stopAbearcMapViewportTimelinePlayback();
      }, ABEARC_MAP_VIEWPORT_TIMELINE_PLAY_MS);
    }

    function dismissAbearcMapViewportTimelineStep() {
      if (!abearcMapViewportTimelineVisible) return false;
      if (!abearcMapViewportTimelineCollapsed) {
        toggleAbearcMapViewportTimelineCollapsed(true);
        return true;
      }
      toggleAbearcMapViewportTimelineVisibility(false);
      return true;
    }

    function toggleAbearcMapViewportTimelineVisibility(force = null) {
      const nextVisible = force == null ? !abearcMapViewportTimelineVisible : Boolean(force);
      if (nextVisible === abearcMapViewportTimelineVisible) {
        syncAbearcMapViewportTimeline();
        return;
      }
      abearcMapViewportTimelineVisible = nextVisible;
      localStorage.setItem('abearcMapViewportTimelineVisible', String(nextVisible));
      if (nextVisible) {
        // Opening from the toolbar always starts in the compact arrow-navigation state.
        abearcMapViewportTimelineCollapsed = true;
        localStorage.setItem('abearcMapViewportTimelineCollapsed', 'true');
      } else {
        stopAbearcMapViewportTimelinePlayback();
        renderAbearcMapViewportTimelinePreview(null);
        // Avoid leaving an invisible historical filter active after the timeline is closed.
        if (abearcMapViewportTimelineDate) {
          abearcMapViewportTimelineDate = '';
            refreshAbearcMapPhotoScope();
        }
      }
      syncAbearcMapViewportTimeline();
      animateAbearcMapResize();
    }

    function toggleAbearcMapViewportTimelineCollapsed(force = null) {
      if (!abearcMapViewportTimelineVisible) {
        abearcMapViewportTimelineVisible = true;
        localStorage.setItem('abearcMapViewportTimelineVisible', 'true');
      }
      abearcMapViewportTimelineCollapsed = force == null ? !abearcMapViewportTimelineCollapsed : Boolean(force);
      localStorage.setItem('abearcMapViewportTimelineCollapsed', String(abearcMapViewportTimelineCollapsed));
      if (abearcMapViewportTimelineCollapsed) renderAbearcMapViewportTimelinePreview(null);
      syncAbearcMapViewportTimeline();
      animateAbearcMapResize();
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
      rememberAbearcMapLayoutChange();
      if (!['all', 'saved', 'mine'].includes(scope)) return;
      clearAbearcMapLayoutPhotoFreeze();
      clearAbearcMapCoordinateSearch();
      clearAbearcMapAdministrativeBoundary();
      abearcMapPhotoScope = scope;
      localStorage.setItem('abearcMapPhotoScope', scope);
      ['mapSearchInput', 'mapCategoryFilter', 'mapDistrictFilter', 'mapBarangayFilter', 'mapLocationStatusFilter', 'mapDateFromFilter', 'mapDateToFilter'].forEach(id => {
        const input = abearcMapFilterElement(id);
        if (input) input.value = '';
      });
      ['mapMyUploadsOnly', 'mapUnlinkedOnly'].forEach(id => {
        const input = abearcMapFilterElement(id);
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
      document.querySelector('[data-map-results-panel]')?.classList.remove('hidden');
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
      const toolPanels = [
        ['[data-map-layouts-toolbar]', '[data-map-layouts-panel]'],
        ['[data-map-ram-pump-toolbar]', '[data-map-ram-pump-panel]'],
        ['[data-map-orthomosaic-toolbar]', '[data-map-orthomosaic-panel]'],
        ['[data-weather-stations-rail]', '[data-weather-stations-drawer]'],
      ];
      let alternatePanelSelected = Boolean(document.querySelector('[data-map-results-panel]')?.classList.contains('hidden'));
      for (const [buttonSelector, drawerSelector] of toolPanels) {
        const button = document.querySelector(buttonSelector);
        const drawer = document.querySelector(drawerSelector);
        const selected = Boolean(drawer && !drawer.classList.contains('hidden'));
        if (selected) alternatePanelSelected = true;
        button?.classList.toggle('is-active', selected);
        button?.setAttribute('aria-pressed', String(selected));
        button?.setAttribute('aria-expanded', String(selected));
      }
      if (savedCount) {
        savedCount.textContent = String(abearcMapSavedPhotoIds.size);
        savedCount.classList.toggle('hidden', abearcMapSavedPhotoIds.size === 0);
      }
      if (photoCount) {
        const geotagCount = abearcMapPhotoScope === 'all' ? abearcMapVisibleListFeatures().length : abearcMapFeatures.length;
        photoCount.textContent = String(geotagCount);
        photoCount.classList.toggle('hidden', geotagCount === 0);
      }
      const myPhotos = abearcMapFeatures.filter(feature => Number(feature?.properties?.owner_user_id) === Number(currentUser?.id));
      if (mineCount) {
        mineCount.textContent = String(myPhotos.length);
        mineCount.classList.toggle('hidden', myPhotos.length === 0);
      }
      savedButton?.classList.toggle('is-active', !alternatePanelSelected && abearcMapPhotoScope === 'saved');
      photosButton?.classList.toggle('is-active', !alternatePanelSelected && abearcMapPhotoScope === 'all');
      mineButton?.classList.toggle('is-active', !alternatePanelSelected && abearcMapPhotoScope === 'mine');
      savedButton?.setAttribute('aria-pressed', String(!alternatePanelSelected && abearcMapPhotoScope === 'saved'));
      photosButton?.setAttribute('aria-pressed', String(!alternatePanelSelected && abearcMapPhotoScope === 'all'));
      mineButton?.setAttribute('aria-pressed', String(!alternatePanelSelected && abearcMapPhotoScope === 'mine'));
      syncAbearcMapTimelineTools();
      document.querySelectorAll('[data-map-save-photo-id]').forEach(button => {
        const saved = abearcMapSavedPhotoIds.has(Number(button.dataset.mapSavePhotoId));
        button.classList.toggle('is-saved', saved);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', saved ? 'Remove from saved photos' : 'Save photo');
        button.setAttribute('title', saved ? 'Remove from saved' : 'Save photo');
        const menuLabel = button.querySelector('[data-map-list-menu-save-label]');
        if (menuLabel) menuLabel.textContent = saved ? 'Unsave' : 'Save';
      });
    }

    window.syncAbearcMapRail = syncAbearcMapRail;

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
      if (document.querySelector('[data-map-rail-photos]')?.classList.contains('is-active')) {
        const panel = document.querySelector('[data-map-results-panel]');
        panel?.classList.add('hidden');
        toggleAbearcMapResults(false);
        syncAbearcMapRail();
        return;
      }
      window.toggleWeatherStationsDrawer?.(false);
      window.toggleAbearcRamPumpDrawer?.(false);
      window.toggleAbearcMapLayoutsDrawer?.(false);
      window.toggleAbearcOrthomosaicDrawer?.(false);
      setAbearcMapPhotoScope('all');
    }

    function showAbearcSavedPhotos() {
      if (document.querySelector('[data-map-rail-saved]')?.classList.contains('is-active')) {
        const panel = document.querySelector('[data-map-results-panel]');
        panel?.classList.add('hidden');
        toggleAbearcMapResults(false);
        syncAbearcMapRail();
        return;
      }
      window.toggleWeatherStationsDrawer?.(false);
      window.toggleAbearcRamPumpDrawer?.(false);
      window.toggleAbearcMapLayoutsDrawer?.(false);
      window.toggleAbearcOrthomosaicDrawer?.(false);
      setAbearcMapPhotoScope('saved');
    }

    function showAbearcMyGeotagPhotos() {
      if (document.querySelector('[data-map-rail-mine]')?.classList.contains('is-active')) {
        const panel = document.querySelector('[data-map-results-panel]');
        panel?.classList.add('hidden');
        toggleAbearcMapResults(false);
        syncAbearcMapRail();
        return;
      }
      window.toggleWeatherStationsDrawer?.(false);
      window.toggleAbearcRamPumpDrawer?.(false);
      window.toggleAbearcMapLayoutsDrawer?.(false);
      window.toggleAbearcOrthomosaicDrawer?.(false);
      setAbearcMapPhotoScope('mine');
    }

    function toggleAbearcSavedPhoto(id) {
      const photoId = Number(id);
      if (!Number.isFinite(photoId) || photoId <= 0) return;
      rememberAbearcMapView();
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

    function rememberAbearcMapView() {
      if (!abearcMap || abearcMapRestoringView || abearcMapLayoutHistoryBatch || (typeof abearcMapLayoutRestoring !== 'undefined' && abearcMapLayoutRestoring)) return;
      abearcMapViewUndoStack.push({
        undoOrder: ++abearcMapUndoOrder,
        camera: { center: abearcMap.getCenter().toArray(), zoom: abearcMap.getZoom(), bearing: abearcMap.getBearing(), pitch: abearcMap.getPitch(), padding: abearcMap.getPadding() },
        moved: structuredClone(abearcMapMovedPhotoPositions),
        movedSizes: structuredClone(abearcMapMovedPhotoSizes),
        expanded: structuredClone(abearcMapExpandedPhotos),
        photoAnnotations: structuredClone(abearcMapPhotoAnnotations),
        saved: new Set(abearcMapSavedPhotoIds),
        selected: new Set(abearcMapSelectedPhotoIds),
        selectionMode: abearcMapPhotoSelectionMode,
        hidden: new Set(abearcMapSessionHiddenPhotoIds),
        exploded: structuredClone(abearcMapExploded)
      });
      if (abearcMapViewUndoStack.length > 50) abearcMapViewUndoStack.shift();
      return abearcMapViewUndoStack.at(-1);
    }

    async function undoAbearcMapChange() {
      if (abearcMapRestoringView || (typeof abearcMapLayoutRestoring !== 'undefined' && abearcMapLayoutRestoring)) return;
      const state = abearcMapViewUndoStack.at(-1);
      if (!state || (abearcMapMeasureUndoStack.at(-1)?.undoOrder || 0) > state.undoOrder) return undoAbearcMapMeasureChange();
      abearcMap.stop();
      abearcMapRestoringView = true;
      try {
        abearcMapSavedPhotoIds = new Set(state.saved);
        persistAbearcMapSavedPhotoIds();
        if (state.layout) await restoreAbearcMapHistoryLayout(state);
        resetAbearcMapThumbnailMoves();
        collapseAbearcMapExplosion({ animate: false });
        abearcMapExpandedPhotos.clear();
        abearcMapSessionHiddenPhotoIds.clear();
        state.hidden?.forEach(id => abearcMapSessionHiddenPhotoIds.add(id));
        state.moved.forEach((value, key) => abearcMapMovedPhotoPositions.set(key, value));
        abearcMapMovedPhotoSizes.clear();
        state.movedSizes?.forEach((value, key) => abearcMapMovedPhotoSizes.set(key, value));
        state.expanded.forEach((value, key) => abearcMapExpandedPhotos.set(key, value));
        abearcMapPhotoAnnotations.clear();
        state.photoAnnotations?.forEach((value, key) => abearcMapPhotoAnnotations.set(key, value));
        abearcMapExploded = state.exploded;
        abearcMapSelectedPhotoIds.clear();
        state.selected?.forEach(id => abearcMapSelectedPhotoIds.add(id));
        abearcMapPhotoSelectionMode = Boolean(state.selectionMode);
        abearcMap.getSource?.('abearc-map-media')?.setData({ type: 'FeatureCollection', features: abearcMapScopedFeatures() });
        abearcMap.jumpTo(state.camera);
        renderAbearcMapPhotoMarkers();
        renderAbearcMapExplosion();
        renderAbearcMapList();
        syncAbearcMapRail();
        abearcMapViewUndoStack.pop();
      } catch (error) {
        toast(`Unable to undo: ${error.message}`, 'error');
      } finally { abearcMapRestoringView = false; }
    }

    function hasAbearcMapPhotoLayoutChanges() {
      return abearcMapMovedPhotoPositions.size > 0
        || abearcMapMovedPhotoSizes.size > 0
        || abearcMapExpandedPhotos.size > 0
        || abearcMapPhotoAnnotations.size > 0
        || Boolean(abearcMapExploded?.features?.length);
    }

    async function resetAbearcMapChanges() {
      if (!abearcMap) return;
      if (!hasAbearcMapPhotoLayoutChanges()) {
        toast('No map photo layout changes to reset.');
        return;
      }
      const confirmed = await confirmModalChoice(
        'Reset all moved, resized, expanded, and exploded photo layout changes on the map?',
        {
          title: 'Reset Map Photo Layout',
          confirmText: 'Reset layout',
          confirmClass: 'px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium'
        }
      );
      if (!confirmed) return;
      rememberAbearcMapView();
      abearcMapRestoringView = true;
      try {
        resetAbearcMapThumbnailMoves();
        abearcMapExpandedPhotos.clear();
        abearcMapPhotoAnnotations.clear();
        collapseAbearcMapExplosion({ animate: false });
        renderAbearcMapPhotoMarkers();
        toast('Map photo layout reset.');
      } finally { abearcMapRestoringView = false; }
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

    function parseAbearcMapCoordinates(value) {
      const number = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
      const match = String(value || '').trim().match(new RegExp(`^(${number})\\s*(?:,\\s*|\\s+)(${number})$`));
      if (!match) return null;
      let latitude = Number(match[1]);
      let longitude = Number(match[2]);
      if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) [latitude, longitude] = [longitude, latitude];
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return { invalid: true };
      return { latitude, longitude };
    }

    function clearAbearcMapCoordinateSearch() {
      abearcMapCoordinateSearchMarker?.remove();
      abearcMapCoordinateSearchMarker = null;
    }

    function clearAbearcMapAdministrativeBoundary({ keepSelection = false, keepMeasurement = false } = {}) {
      abearcMapAdministrativeBoundaryRequestId++;
      abearcMapAdministrativeBoundaryAbort?.abort();
      abearcMapAdministrativeBoundaryAbort = null;
      if (!keepSelection) abearcMapAdministrativeSearchSelection = null;
      abearcMapAdministrativeBoundaryData = { type: 'FeatureCollection', features: [] };
      abearcMap?.getSource('abearc-administrative-search-boundary')?.setData(abearcMapAdministrativeBoundaryData);
      abearcMapAdministrativeLabelMarker?.remove();
      abearcMapAdministrativeLabelMarker = null;
      if (abearcMapAdministrativeLabelFrame) cancelAnimationFrame(abearcMapAdministrativeLabelFrame);
      abearcMapAdministrativeLabelFrame = null;
      if (!keepMeasurement && abearcMapAdministrativeMeasureActive) {
        const previous = abearcMapAdministrativeMeasurePreviousState;
        abearcMapAdministrativeMeasureActive = false;
        abearcMapAdministrativeMeasurePreviousState = null;
        if (previous) applyAbearcMapMeasureState(previous);
      }
    }

    function normalizeAbearcAdministrativeSearchText(value) {
      return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\b(?:barangay|brgy|bgry)\.?\b/g, ' ')
        .replace(/\bdistrict\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim().replace(/\s+/g, ' ');
    }

    function abearcMapAdministrativeSearchMatch(value) {
      const query = normalizeAbearcAdministrativeSearchText(value);
      if (!query) return null;
      if (abearcMapAdministrativeSearchSelection
          && normalizeAbearcAdministrativeSearchText(abearcMapAdministrativeSearchSelection.name) === query) {
        return abearcMapAdministrativeSearchSelection;
      }
      for (const [type, id] of [['district', 'mapDistrictFilter'], ['barangay', 'mapBarangayFilter']]) {
        const option = [...(document.getElementById(id)?.options || [])]
          .find(item => item.value && normalizeAbearcAdministrativeSearchText(item.value) === query);
        if (option) return { type, name: option.value.trim(), code: '' };
      }
      return null;
    }

    async function fetchAbearcAdministrativeSuggestions(value, limit = 12) {
      const query = String(value || '').trim();
      if (!query) {
        abearcMapAdministrativeSearchError = '';
        return [];
      }
      try {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        const response = await fetchJson(`${API}/map/administrative-search?${params}`, { silentLoading: true });
        abearcMapAdministrativeSearchError = '';
        return Array.isArray(response?.results) ? response.results : [];
      } catch (err) {
        abearcMapAdministrativeSearchError = String(err?.message || 'Offline barangay/district boundary database is unavailable.');
        console.warn('Offline administrative boundary search failed.', err);
        return [];
      }
    }

    async function resolveAbearcAdministrativeSearch(value) {
      const raw = String(value || '').trim();
      const normalized = normalizeAbearcAdministrativeSearchText(raw);
      if (!normalized) return { match: null, ambiguous: [] };
      if (abearcMapAdministrativeSearchSelection
          && normalizeAbearcAdministrativeSearchText(abearcMapAdministrativeSearchSelection.name) === normalized) {
        return { match: abearcMapAdministrativeSearchSelection, ambiguous: [] };
      }
      const results = await fetchAbearcAdministrativeSuggestions(raw, 30);
      const wantsDistrict = /\bdistrict\b/i.test(raw);
      const wantsBarangay = /\b(?:barangay|brgy|bgry)\.?\b/i.test(raw);
      const exact = results.filter(item => {
        if (normalizeAbearcAdministrativeSearchText(item?.name) !== normalized) return false;
        if (wantsDistrict && item.type !== 'district') return false;
        if (wantsBarangay && item.type !== 'barangay') return false;
        return true;
      });
      if (exact.length === 1) return { match: exact[0], ambiguous: [] };
      if (exact.length > 1) return { match: null, ambiguous: exact };
      const typed = results.filter(item => {
        if (wantsDistrict && item.type !== 'district') return false;
        if (wantsBarangay && item.type !== 'barangay') return false;
        return true;
      });
      if (typed.length) {
        const first = typed[0];
        const firstScore = Number(first.match_score || 0);
        const secondScore = Number(typed[1]?.match_score || 0);
        if (firstScore >= 78 && (!typed[1] || firstScore - secondScore >= 5)) {
          return { match: first, ambiguous: [] };
        }
        if (firstScore >= 74) return { match: null, ambiguous: typed.slice(0, 5) };
      }
      return { match: null, ambiguous: [] };
    }

    function abearcAdministrativeOuterRings(data = abearcMapAdministrativeBoundaryData) {
      const rings = [];
      (data?.features || []).forEach(feature => {
        const geometry = feature?.geometry;
        if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) {
          rings.push(geometry.coordinates[0]);
        } else if (geometry?.type === 'MultiPolygon') {
          (geometry.coordinates || []).forEach(polygon => {
            if (Array.isArray(polygon?.[0])) rings.push(polygon[0]);
          });
        }
      });
      return rings.filter(ring => Array.isArray(ring) && ring.length >= 3)
        .map(ring => ring.slice(0, -1).length >= 3 && ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1] ? ring.slice(0, -1) : ring)
        .filter(ring => ring.length >= 3);
    }

    function abearcAdministrativeGeometryArea(data = abearcMapAdministrativeBoundaryData) {
      let total = 0;
      (data?.features || []).forEach(feature => {
        const geometry = feature?.geometry;
        const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
        (polygons || []).forEach(polygon => {
          if (!Array.isArray(polygon?.[0])) return;
          total += abearcPolygonArea(polygon[0]);
          for (let index = 1; index < polygon.length; index++) total -= abearcPolygonArea(polygon[index] || []);
        });
      });
      return Math.max(0, total);
    }

    function abearcAdministrativeLabelText() {
      const selection = abearcMapAdministrativeSearchSelection;
      if (!selection?.name) return null;
      const hectares = abearcAdministrativeGeometryArea() / 10000;
      return {
        title: `${selection.type === 'district' ? 'District' : 'Barangay'} ${selection.name}`,
        area: `${hectares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
      };
    }

    function abearcAdministrativeLabelCandidate() {
      if (!abearcMap || !abearcMapAdministrativeBoundaryData?.features?.length) return null;
      const photoRects = typeof currentPhotoMarkerRects === 'function' ? currentPhotoMarkerRects().map(item => item.rect) : [];
      const canvas = abearcMap.getCanvasContainer();
      const width = canvas?.clientWidth || 0;
      const height = canvas?.clientHeight || 0;
      const estimatedWidth = 148;
      const estimatedHeight = 42;
      let best = null;
      const rectangleDistance = (point, rect) => {
        const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
        const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
        return Math.hypot(dx, dy);
      };
      const consider = (point, polygon) => {
        const clearance = abearcScreenPointClearance(point, polygon);
        if (clearance < 8) return;
        const labelRect = {
          left: point.x - estimatedWidth / 2,
          right: point.x + estimatedWidth / 2,
          top: point.y - estimatedHeight / 2,
          bottom: point.y + estimatedHeight / 2
        };
        if (labelRect.left < 8 || labelRect.top < 8 || labelRect.right > width - 8 || labelRect.bottom > height - 8) return;
        let minimumPhotoDistance = Infinity;
        let overlaps = 0;
        photoRects.forEach(rect => {
          if (!(labelRect.right + 6 < rect.left || labelRect.left - 6 > rect.right || labelRect.bottom + 6 < rect.top || labelRect.top - 6 > rect.bottom)) overlaps++;
          minimumPhotoDistance = Math.min(minimumPhotoDistance, rectangleDistance(point, rect));
        });
        if (!Number.isFinite(minimumPhotoDistance)) minimumPhotoDistance = 260;
        const score = Math.min(clearance, 150) + Math.min(minimumPhotoDistance, 240) * 0.8 - overlaps * 600;
        if (!best || score > best.score) best = { ...point, score, overlaps };
      };
      abearcAdministrativeOuterRings().forEach(ring => {
        const polygon = ring.map(point => abearcMap.project(point));
        if (polygon.length < 3) return;
        consider(abearcScreenInteriorPoint(polygon), polygon);
        const xs = polygon.map(point => point.x), ys = polygon.map(point => point.y);
        const left = Math.max(0, Math.min(...xs)), right = Math.min(width, Math.max(...xs));
        const top = Math.max(0, Math.min(...ys)), bottom = Math.min(height, Math.max(...ys));
        for (let row = 0; row < 9; row++) {
          for (let column = 0; column < 9; column++) {
            const point = { x: left + (column + 0.5) / 9 * (right - left), y: top + (row + 0.5) / 9 * (bottom - top) };
            if (abearcScreenPointInPolygon(point, polygon)) consider(point, polygon);
          }
        }
      });
      return best;
    }

    function renderAbearcAdministrativeBoundaryLabel() {
      if (!abearcMap || !abearcMapAdministrativeBoundaryData?.features?.length) {
        abearcMapAdministrativeLabelMarker?.remove();
        abearcMapAdministrativeLabelMarker = null;
        return;
      }
      const text = abearcAdministrativeLabelText();
      const candidate = abearcAdministrativeLabelCandidate();
      if (!text || !candidate) return;
      const lngLat = abearcMap.unproject([candidate.x, candidate.y]);
      if (!abearcMapAdministrativeLabelMarker) {
        const element = document.createElement('div');
        element.className = 'abearc-map-admin-boundary-label';
        element.setAttribute('aria-hidden', 'true');
        element.innerHTML = '<strong></strong><span></span>';
        abearcMapAdministrativeLabelMarker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(abearcMap);
      }
      const element = abearcMapAdministrativeLabelMarker.getElement();
      element.querySelector('strong').textContent = text.title;
      element.querySelector('span').textContent = text.area;
      abearcMapAdministrativeLabelMarker.setLngLat(lngLat);
    }

    function scheduleAbearcAdministrativeBoundaryLabel() {
      if (abearcMapAdministrativeLabelFrame) cancelAnimationFrame(abearcMapAdministrativeLabelFrame);
      abearcMapAdministrativeLabelFrame = requestAnimationFrame(() => {
        abearcMapAdministrativeLabelFrame = null;
        renderAbearcAdministrativeBoundaryLabel();
      });
    }

    function activateAbearcAdministrativeBoundaryMeasurement() {
      const selection = abearcMapAdministrativeSearchSelection;
      const rings = abearcAdministrativeOuterRings();
      if (!selection || !rings.length) return false;
      if (!abearcMapAdministrativeMeasureActive) {
        abearcMapAdministrativeMeasurePreviousState = captureAbearcMapMeasureState();
      }
      const prefix = selection.type === 'district' ? 'District' : 'Barangay';
      abearcMapAdministrativeMeasureActive = true;
      abearcMapMeasureMode = 'area';
      abearcMapImportedPolygons = rings.map((points, index) => ({
        name: rings.length > 1 ? `${prefix} ${selection.name} ${index + 1}` : `${prefix} ${selection.name}`,
        points: points.map(point => [Number(point[0]), Number(point[1])])
      }));
      abearcMapSelectedImportedPolygons = new Set(abearcMapImportedPolygons.map((_, index) => index));
      abearcMapMeasurePoints = abearcMapImportedPolygons[0].points;
      abearcMapEditingImportedPolygonIndex = null;
      abearcMapHiddenMeasurePointIndexes.clear();
      abearcMapElevationAnnotations.clear();
      abearcMapLastTouchedMeasureIndex = abearcMapMeasurePoints.length - 1;
      resetAbearcElevationProfile();
      renderAbearcMapMeasure();
      return true;
    }

    function openAbearcAdministrativeBoundaryMeasureMenu(event) {
      const original = event?.originalEvent || event;
      original?.preventDefault?.();
      original?.stopPropagation?.();
      if (!activateAbearcAdministrativeBoundaryMeasurement()) return;
      setTimeout(() => openAbearcMapMeasureContextMenu(original, 0), 0);
    }

    function bindAbearcAdministrativeBoundaryInteractions() {
      if (!abearcMap || abearcMapAdministrativeInteractionsBound) return;
      abearcMapAdministrativeInteractionsBound = true;
      abearcMap.on('contextmenu', 'abearc-administrative-search-boundary-fill', openAbearcAdministrativeBoundaryMeasureMenu);
      abearcMap.on('contextmenu', 'abearc-administrative-search-boundary-line', openAbearcAdministrativeBoundaryMeasureMenu);
      abearcMap.on('mouseenter', 'abearc-administrative-search-boundary-fill', () => {
        if (abearcMap?.getCanvas()) abearcMap.getCanvas().style.cursor = 'context-menu';
      });
      abearcMap.on('mouseleave', 'abearc-administrative-search-boundary-fill', () => {
        if (abearcMap?.getCanvas()) abearcMap.getCanvas().style.cursor = '';
      });
    }

    async function showAbearcMapAdministrativeBoundary(match) {
      if (!match?.name || !match?.type) {
        clearAbearcMapAdministrativeBoundary();
        return false;
      }
      const requestId = ++abearcMapAdministrativeBoundaryRequestId;
      abearcMapAdministrativeBoundaryAbort?.abort();
      abearcMapAdministrativeBoundaryAbort = new AbortController();
      try {
        const query = new URLSearchParams({ query: match.name, type: match.type });
        if (match.code) query.set('code', match.code);
        const boundary = await fetchJson(`${API}/map/administrative-boundary?${query}`, {
          signal: abearcMapAdministrativeBoundaryAbort.signal,
          silentLoading: true
        });
        if (requestId !== abearcMapAdministrativeBoundaryRequestId) return false;
        abearcMapAdministrativeBoundaryData = boundary;
        setupAbearcMapLayers();
        bindAbearcAdministrativeBoundaryInteractions();
        abearcMap?.getSource('abearc-administrative-search-boundary')?.setData(boundary);
        scheduleAbearcAdministrativeBoundaryLabel();
        if (abearcMapAdministrativeMeasureActive) activateAbearcAdministrativeBoundaryMeasurement();
        if (!boundary.features?.length) {
          toast(`No ${match.type} boundary was found for ${match.name}.`, 'error');
          return false;
        }
        const bbox = boundary.bbox;
        if (abearcMap && Array.isArray(bbox) && bbox.length === 4) {
          abearcMap.fitBounds([[Number(bbox[0]), Number(bbox[1])], [Number(bbox[2]), Number(bbox[3])]], {
            padding: { top: 72, right: 72, bottom: 88, left: 72 },
            maxZoom: match.type === 'barangay' ? 15 : 12.5,
            duration: 700
          });
          setTimeout(scheduleAbearcAdministrativeBoundaryLabel, 760);
        }
        return true;
      } catch (err) {
        if (err?.name !== 'AbortError' && requestId === abearcMapAdministrativeBoundaryRequestId) {
          clearAbearcMapAdministrativeBoundary();
          toast('The administrative boundary could not be loaded.', 'error');
        }
        return false;
      }
    }

    async function applyAbearcAdministrativeSearch(match) {
      if (!match?.name || !match?.type) return;
      rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      resetAbearcMapThumbnailMoves();
      clearAbearcMapCoordinateSearch();
      closeAbearcMapSearchHistory();
      const input = document.getElementById('mapSearchInput');
      if (input) input.value = match.name;
      abearcMapAdministrativeSearchSelection = {
        type: match.type,
        name: match.name,
        district: match.district || '',
        code: match.code || '',
        label: match.label || match.name
      };
      abearcMapCommittedSearch = '';
      abearcMapFitAllRequested = false;
      abearcMapLastSearchFitKey = '';
      rememberAbearcMapSearch(match.name);
      updateAbearcMapWorkspaceSummary();
      const shown = await showAbearcMapAdministrativeBoundary(abearcMapAdministrativeSearchSelection);
      if (shown) {
        await reloadAbearcMap();
        const count = abearcMapScopedFeatures().length;
        const placeType = match.type === 'district' ? 'District' : 'Barangay';
        toast(`${placeType} ${match.name} selected · ${count.toLocaleString()} geotagged photo${count === 1 ? '' : 's'} inside boundary.`, count ? 'good' : 'info');
      }
    }

    function syncAbearcMapAdministrativeBoundary() {
      const barangay = document.getElementById('mapBarangayFilter')?.value?.trim();
      const district = document.getElementById('mapDistrictFilter')?.value?.trim();
      const match = abearcMapAdministrativeSearchSelection
        || (barangay ? { type: 'barangay', name: barangay, code: '' }
          : district ? { type: 'district', name: district, code: '' }
            : abearcMapAdministrativeSearchMatch(abearcMapCommittedSearch));
      showAbearcMapAdministrativeBoundary(match);
    }

    function abearcMapSearchHistoryKey() {
      return `abearcMapSearchHistory:${currentUser?.id || 'local'}`;
    }

    function abearcMapSearchHistory() {
      try {
        const history = JSON.parse(localStorage.getItem(abearcMapSearchHistoryKey()) || '[]');
        return Array.isArray(history) ? history.filter(value => typeof value === 'string' && value.trim()).slice(0, 8) : [];
      } catch (_) {
        return [];
      }
    }

    function closeAbearcMapSearchHistory() {
      document.getElementById('abearcMapSearchHistory')?.classList.add('hidden');
      document.getElementById('mapSearchInput')?.setAttribute('aria-expanded', 'false');
    }

    function rememberAbearcMapSearch(value) {
      const search = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 160);
      if (!search || search.toLowerCase() === 'all') return;
      const history = abearcMapSearchHistory().filter(item => item.toLowerCase() !== search.toLowerCase());
      localStorage.setItem(abearcMapSearchHistoryKey(), JSON.stringify([search, ...history].slice(0, 8)));
    }

    function removeAbearcMapSearchHistory(value = null) {
      const history = value == null
        ? []
        : abearcMapSearchHistory().filter(item => item.toLowerCase() !== String(value).toLowerCase());
      localStorage.setItem(abearcMapSearchHistoryKey(), JSON.stringify(history));
      renderAbearcMapSearchHistory();
    }

    function useAbearcMapSearchHistory(value) {
      const input = document.getElementById('mapSearchInput');
      if (!input) return;
      input.value = value;
      rememberAbearcMapSearch(value);
      closeAbearcMapSearchHistory();
      submitAbearcMapSearch();
    }

    async function renderAbearcMapSearchHistory() {
      const menu = document.getElementById('abearcMapSearchHistory');
      const input = document.getElementById('mapSearchInput');
      if (!menu || !input) return;
      const requestId = ++abearcMapAdministrativeSuggestionRequestId;
      const rawQuery = input.value.trim();
      const query = rawQuery.toLowerCase();
      const history = abearcMapSearchHistory().filter(item => !query || item.toLowerCase().includes(query));
      const places = rawQuery.length >= 2 ? await fetchAbearcAdministrativeSuggestions(rawQuery, 10) : [];
      if (requestId !== abearcMapAdministrativeSuggestionRequestId || input.value.trim() !== rawQuery) return;
      menu.replaceChildren();

      const wireKeyboard = button => {
        button.addEventListener('keydown', event => {
          const items = [...menu.querySelectorAll('.abearc-map-search-history__item')];
          const index = items.indexOf(button);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[Math.min(index + 1, items.length - 1)]?.focus();
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (index > 0) items[index - 1].focus();
            else input.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            closeAbearcMapSearchHistory();
            input.focus();
          }
        });
      };

      if (places.length) {
        const header = document.createElement('div');
        header.className = 'abearc-map-search-history__header';
        const title = document.createElement('strong');
        title.textContent = 'Barangays & districts';
        const offline = document.createElement('span');
        offline.className = 'abearc-map-search-history__source';
        offline.textContent = 'Offline CPDO';
        header.append(title, offline);
        menu.appendChild(header);
        places.forEach(place => {
          const row = document.createElement('div');
          row.className = 'abearc-map-search-history__row is-place-row';
          const use = document.createElement('button');
          use.type = 'button';
          use.className = 'abearc-map-search-history__item is-place';
          use.setAttribute('role', 'option');
          use.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z" stroke-linejoin="round" stroke-width="1.8"/><path d="M9 4v13.5M15 6.5V20" stroke-width="1.5"/></svg>';
          const label = document.createElement('span');
          label.textContent = place.label || place.name;
          const type = document.createElement('small');
          type.textContent = place.type === 'district' ? 'District' : 'Barangay';
          label.appendChild(type);
          use.appendChild(label);
          use.addEventListener('pointerdown', event => event.preventDefault());
          use.addEventListener('click', () => applyAbearcAdministrativeSearch(place));
          wireKeyboard(use);
          row.append(use);
          menu.appendChild(row);
        });
      }

      if (rawQuery.length >= 2 && !places.length) {
        const header = document.createElement('div');
        header.className = 'abearc-map-search-history__header';
        const title = document.createElement('strong');
        title.textContent = abearcMapAdministrativeSearchError
          ? 'Offline boundary database unavailable'
          : 'No matching barangay or district';
        const hint = document.createElement('span');
        hint.className = 'abearc-map-search-history__source';
        hint.textContent = abearcMapAdministrativeSearchError
          ? 'Check the local boundary files and restart ABEARC'
          : 'Press Enter to search geotagged photos';
        header.append(title, hint);
        menu.appendChild(header);
      }

      if (history.length) {
        const header = document.createElement('div');
        header.className = 'abearc-map-search-history__header';
        const title = document.createElement('strong');
        title.textContent = 'Recent';
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = 'Clear';
        clear.addEventListener('pointerdown', event => event.preventDefault());
        clear.addEventListener('click', () => removeAbearcMapSearchHistory());
        header.append(title, clear);
        menu.appendChild(header);
        history.forEach(value => {
          const row = document.createElement('div');
          row.className = 'abearc-map-search-history__row';
          const use = document.createElement('button');
          use.type = 'button';
          use.className = 'abearc-map-search-history__item';
          use.setAttribute('role', 'option');
          use.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-width="2"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>';
          const label = document.createElement('span');
          label.textContent = value;
          use.appendChild(label);
          use.addEventListener('pointerdown', event => event.preventDefault());
          use.addEventListener('click', () => useAbearcMapSearchHistory(value));
          wireKeyboard(use);
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'abearc-map-search-history__remove';
          remove.setAttribute('aria-label', `Remove ${value} from recent searches`);
          remove.title = 'Remove';
          remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke-linecap="round" stroke-width="2"/></svg>';
          remove.addEventListener('pointerdown', event => event.preventDefault());
          remove.addEventListener('click', () => removeAbearcMapSearchHistory(value));
          row.append(use, remove);
          menu.appendChild(row);
        });
      }

      if (!places.length && !history.length && rawQuery.length < 2) {
        closeAbearcMapSearchHistory();
        return;
      }
      menu.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    }

    function clearAbearcMapSearchFromEscape(input) {
      const hadSearch = Boolean(input?.value?.trim() || abearcMapCommittedSearch || abearcMapAdministrativeSearchSelection || abearcMapCoordinateSearchMarker);
      if (!hadSearch) return false;
      rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      resetAbearcMapThumbnailMoves();
      closeAbearcMapSearchHistory();
      if (input) input.value = '';
      clearAbearcMapCoordinateSearch();
      clearAbearcMapAdministrativeBoundary();
      abearcMapCommittedSearch = '';
      abearcMapLastSearchFitKey = '';
      abearcMapFitAllRequested = true;
      updateAbearcMapWorkspaceSummary();
      reloadAbearcMap();
      requestAnimationFrame(() => input?.focus());
      return true;
    }

    function handleAbearcMapSearchKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        closeAbearcMapSearchHistory();
        submitAbearcMapSearch();
      } else if (event.key === 'ArrowDown') {
        const first = document.querySelector('#abearcMapSearchHistory .abearc-map-search-history__item');
        if (first) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        const input = event.target?.id === 'mapSearchInput' ? event.target : document.getElementById('mapSearchInput');
        if (clearAbearcMapSearchFromEscape(input)) return;
        closeAbearcMapSearchHistory();
        input?.blur?.();
        collapseAbearcMapSearchIfIdle();
      }
    }

    async function pinAbearcMapCoordinateSearch(latitude, longitude) {
      await ensureAbearcMap();
      if (!abearcMap || typeof maplibregl === 'undefined') return;
      clearAbearcMapCoordinateSearch();
      const content = document.createElement('div');
      content.className = 'abearc-map-coordinate-popup';
      const render = (barangay = 'Looking up...', district = 'Looking up...', zoning = 'Looking up...') => {
        content.innerHTML = `<strong>Searched coordinates</strong><code>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</code><dl><div><dt>Barangay</dt><dd>${esc(barangay)}</dd></div><div><dt>District</dt><dd>${esc(district)}</dd></div><div><dt>Zoning</dt><dd>${esc(zoning)}</dd></div></dl><small>Data source: CPDO offline boundary database</small>`;
      };
      render();
      const popup = new maplibregl.Popup({ offset: 28, closeButton: true, closeOnClick: false, className: 'abearc-map-coordinate-popup-shell' }).setDOMContent(content);
      abearcMapCoordinateSearchMarker = new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(abearcMap);
      abearcMapCoordinateSearchMarker.togglePopup();
      abearcMap.flyTo({ center: [longitude, latitude], zoom: Math.max(16, abearcMap.getZoom()), bearing: 0, pitch: 0, essential: true });
      try {
        const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
        const info = await fetchJson(`${API}/map/location-info?${query}`, { silentLoading: true });
        render(info.barangay || 'Unavailable', info.district || 'Unavailable', info.zoning || 'Outside zoning coverage');
      } catch (_) {
        render('Unavailable', 'Unavailable', 'Unavailable');
      }
    }

    async function submitAbearcMapSearch() {
      rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      resetAbearcMapThumbnailMoves();
      closeAbearcMapSearchHistory();
      const input = document.getElementById('mapSearchInput');
      const control = document.querySelector('#mapPage .abearc-map-search-control');
      const value = input?.value?.trim() || '';
      if (!value && control?.classList.contains('is-collapsed')) {
        expandAbearcMapSearch(true);
        return;
      }
      if (!value) {
        clearAbearcMapCoordinateSearch();
        clearAbearcMapAdministrativeBoundary();
        abearcMapCommittedSearch = '';
        abearcMapLastSearchFitKey = '';
        abearcMapFitAllRequested = true;
        updateAbearcMapWorkspaceSummary();
        reloadAbearcMap();
        document.activeElement?.blur?.();
        collapseAbearcMapSearchIfIdle();
        return;
      }
      if (value.toLowerCase() === 'all') {
        clearAbearcMapCoordinateSearch();
        clearAbearcMapAdministrativeBoundary();
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
      const coordinates = parseAbearcMapCoordinates(value);
      if (coordinates?.invalid) {
        toast('Enter valid coordinates, for example 7.190700, 125.455300.', 'error');
        return;
      }
      if (coordinates) {
        rememberAbearcMapSearch(value);
        clearAbearcMapAdministrativeBoundary();
        abearcMapCommittedSearch = '';
        abearcMapLastSearchFitKey = '';
        abearcMapFitAllRequested = false;
        updateAbearcMapWorkspaceSummary();
        await pinAbearcMapCoordinateSearch(coordinates.latitude, coordinates.longitude);
        return;
      }
      clearAbearcMapCoordinateSearch();
      const administrative = await resolveAbearcAdministrativeSearch(value);
      if (administrative.match) {
        await applyAbearcAdministrativeSearch(administrative.match);
        return;
      }
      if (administrative.ambiguous.length) {
        expandAbearcMapSearch(true);
        renderAbearcMapSearchHistory();
        toast(`More than one barangay named ${value.replace(/^barangay\s+/i, '')} exists. Choose the correct district from the search results.`, 'info');
        return;
      }
      clearAbearcMapAdministrativeBoundary();
      abearcMapFitAllRequested = false;
      abearcMapCommittedSearch = value;
      await reloadAbearcMap();
      const resultCount = abearcMapScopedFeatures().length;
      if (resultCount) {
        rememberAbearcMapSearch(value);
      } else {
        if (abearcMapAdministrativeSearchError) {
          setAbearcMapSyncState('Boundary data unavailable', 'ready');
          toast('Offline barangay/district boundary database is unavailable. Verify the local boundary dataset and restart ABEARC.', 'error');
        } else {
          setAbearcMapSyncState('No results', 'ready');
          toast(`No barangay, district, or geotagged photo results found for “${value}”.`, 'info');
        }
      }
    }

    function handleAbearcMapSearchInput() {
      if (!document.getElementById('mapSearchInput')?.value?.trim() && (abearcMapCommittedSearch || abearcMapAdministrativeSearchSelection)) rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      const value = document.getElementById('mapSearchInput')?.value?.trim() || '';
      const hadAdministrativeSelection = Boolean(abearcMapAdministrativeSearchSelection);
      if (abearcMapAdministrativeSearchSelection
          && normalizeAbearcAdministrativeSearchText(value) !== normalizeAbearcAdministrativeSearchText(abearcMapAdministrativeSearchSelection.name)) {
        clearAbearcMapAdministrativeBoundary();
      }
      if (value) expandAbearcMapSearch();
      renderAbearcMapSearchHistory();
      if (!value) clearAbearcMapCoordinateSearch();
      if (!value) clearAbearcMapAdministrativeBoundary();
      if (value || (!abearcMapCommittedSearch && !hadAdministrativeSelection)) return;
      resetAbearcMapThumbnailMoves();
      abearcMapCommittedSearch = '';
      abearcMapAdministrativeSearchSelection = null;
      abearcMapLastSearchFitKey = '';
      abearcMapFitAllRequested = true;
      updateAbearcMapWorkspaceSummary();
      reloadAbearcMap();
    }

    function expandAbearcMapSearch(focusInput = false) {
      const control = document.querySelector('#mapPage .abearc-map-search-control');
      control?.classList.remove('is-collapsed');
      control?.querySelector('.abearc-map-search-submit')?.setAttribute('aria-expanded', 'true');
      if (focusInput) requestAnimationFrame(() => document.getElementById('mapSearchInput')?.focus());
    }

    function collapseAbearcMapSearchIfIdle() {
      setTimeout(() => {
        const control = document.querySelector('#mapPage .abearc-map-search-control');
        const input = document.getElementById('mapSearchInput');
        const history = document.getElementById('abearcMapSearchHistory');
        if (history?.contains(document.activeElement)) return;
        closeAbearcMapSearchHistory();
        if (!control || input?.value?.trim() || control.querySelector('.abearc-map-search-wrap:focus-within')) return;
        control.classList.add('is-collapsed');
        control.querySelector('.abearc-map-search-submit')?.setAttribute('aria-expanded', 'false');
      }, 80);
    }


    function syncAbearcMapTimelineTools() {
      document.querySelectorAll('[data-map-group-site-series], [data-map-timeline-group-toggle]').forEach(toggle => {
        toggle.checked = abearcMapGroupSiteSeries;
      });
      syncAbearcMapViewportTimeline();
    }

    function toggleAbearcMapTimelineTools(forceOpen = null) {
      const panel = document.querySelector('[data-map-timeline-tools-panel]');
      if (!panel) return;
      const open = forceOpen == null ? panel.classList.contains('hidden') : Boolean(forceOpen);
      panel.classList.toggle('hidden', !open);
      document.getElementById('mapPage')?.classList.toggle('is-timeline-tools-open', open);
      if (open) toggleAbearcMapFilters(false);
      syncAbearcMapTimelineTools();
    }

    function setAbearcMapTimelineDate(which, value) {
      const target = abearcMapFilterElement(which === 'to' ? 'mapDateToFilter' : 'mapDateFromFilter');
      if (!target) return;
      target.value = String(value || '');
      syncAbearcMapTimelineTools();
      reloadAbearcMapForSearch();
    }

    function clearAbearcMapTimelineDates() {
      const from = abearcMapFilterElement('mapDateFromFilter');
      const to = abearcMapFilterElement('mapDateToFilter');
      if (from) from.value = '';
      if (to) to.value = '';
      syncAbearcMapTimelineTools();
      reloadAbearcMapForSearch();
    }

    function setAbearcMapGroupSiteSeries(enabled) {
      abearcMapGroupSiteSeries = Boolean(enabled);
      localStorage.setItem('abearcMapGroupSiteSeries', String(abearcMapGroupSiteSeries));
      document.querySelectorAll('[data-map-group-site-series], [data-map-timeline-group-toggle]').forEach(toggle => {
        toggle.checked = abearcMapGroupSiteSeries;
      });
      refreshAbearcMapPhotoScope();
      syncAbearcMapTimelineTools();
      toast(abearcMapGroupSiteSeries ? 'Repeated site photos grouped into timelines' : 'Showing individual geotag photos');
    }

    function clearAbearcMapFilters() {
      rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      resetAbearcMapThumbnailMoves();
      clearAbearcMapCoordinateSearch();
      clearAbearcMapAdministrativeBoundary();
      ['mapSearchInput', 'mapCategoryFilter', 'mapDistrictFilter', 'mapBarangayFilter', 'mapLocationStatusFilter', 'mapDateFromFilter', 'mapDateToFilter'].forEach(id => {
        const input = abearcMapFilterElement(id);
        if (input) input.value = '';
      });
      ['mapMyUploadsOnly', 'mapUnlinkedOnly'].forEach(id => {
        const input = abearcMapFilterElement(id);
        if (input) input.checked = false;
      });
      abearcMapCommittedSearch = '';
      abearcMapFitAllRequested = false;
      updateAbearcMapWorkspaceSummary();
      reloadAbearcMap();
    }

    function abearcMapAdministrativeMetadataMissing(feature) {
      const props = feature?.properties || {};
      const category = String(props.category || '').trim().toLowerCase();
      const values = [props.barangay, props.district].map(value => String(value || '').trim());
      return values.some(value => {
        const normalized = value.toLowerCase();
        return !normalized
          || ['unknown', 'unavailable', 'n/a', 'na', 'none', 'null', '-'].includes(normalized)
          || /^(?:unknown|unavailable)\s+(?:barangay|brgy|bgry|district)$/.test(normalized)
          || (category && normalized === category);
      });
    }

    async function resolveAbearcMapAdministrativeMetadata(features = []) {
      const targets = features.filter(feature => {
        const id = Number(abearcFeatureId(feature));
        const coordinates = feature?.geometry?.coordinates || [];
        return Number.isInteger(id) && id > 0
          && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))
          && abearcMapAdministrativeMetadataMissing(feature)
          && !abearcMapAdminResolutionAttemptedIds.has(id);
      }).slice(0, 500);
      if (!targets.length) return 0;
      const ids = targets.map(feature => Number(abearcFeatureId(feature)));
      ids.forEach(id => abearcMapAdminResolutionAttemptedIds.add(id));
      try {
        const response = await fetchJson(`${API}/map/media/resolve-administrative`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
          silentLoading: true
        });
        const byId = new Map((response?.results || []).map(row => [Number(row.id), row]));
        let resolved = 0;
        targets.forEach(feature => {
          const row = byId.get(Number(abearcFeatureId(feature)));
          if (!row) return;
          if (row.barangay) feature.properties.barangay = row.barangay;
          if (row.district) feature.properties.district = row.district;
          if (row.barangay || row.district) resolved += 1;
        });
        return resolved;
      } catch (error) {
        ids.forEach(id => abearcMapAdminResolutionAttemptedIds.delete(id));
        console.warn('Could not resolve missing barangay/district metadata.', error);
        return 0;
      }
    }

    async function reloadAbearcMapForSearch() {
      rememberAbearcMapLayoutChange();
      clearAbearcMapLayoutPhotoFreeze();
      resetAbearcMapThumbnailMoves();
      await reloadAbearcMap();
      syncAbearcMapAdministrativeBoundary();
    }

    function scheduleAbearcMapReload(delay = 250) {
      clearTimeout(abearcMapReloadTimer);
      abearcMapReloadTimer = setTimeout(reloadAbearcMap, delay);
    }

    function startAbearcMapAutoSync() {
      if (abearcMapAutoSyncTimer) return;
      abearcMapAutoSyncTimer = setInterval(() => {
        if (appCurrentView !== 'map' || document.hidden) return;
        const forceFull = Date.now() - abearcMapLastFullSyncAt >= ABEARC_MAP_FULL_SYNC_INTERVAL_MS;
        reloadAbearcMap({ background: true, incremental: !forceFull });
      }, ABEARC_MAP_AUTO_SYNC_INTERVAL_MS);
    }

    async function reloadAbearcMap({ background = false, incremental = false } = {}) {
      if (appCurrentView !== 'map') return;
      if (abearcMapRestoringView) return;
      abearcMapCommittedFilters = abearcMapLayoutFilterState();
      if (background && abearcMapLayoutFrozenPhotoIds instanceof Set) return;
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
        const queryParams = mapQueryParams({ incremental: background && incremental });
        const data = await fetchJson(`${API}/map/media?${queryParams.toString()}`, { signal: requestController.signal, silentLoading: true });
        const incomingFeatures = data.features || [];
        if (background && incremental && abearcMapLastServerTime) {
          const merged = new Map(abearcMapFeatures.map(feature => [Number(abearcFeatureId(feature)), feature]));
          incomingFeatures.forEach(feature => merged.set(Number(abearcFeatureId(feature)), feature));
          abearcMapFeatures = [...merged.values()];
        } else {
          abearcMapFeatures = incomingFeatures;
          abearcMapLastFullSyncAt = Date.now();
        }
        if (data.server_time) abearcMapLastServerTime = data.server_time;
        await resolveAbearcMapAdministrativeMetadata(abearcMapFeatures);
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
        const preserveAltExplosion = Boolean(abearcMapExploded?.persistent || (abearcMapAltHeld && abearcMapExploded?.collapseOnAltRelease));
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

    function abearcMapScaleZoom(latitude, targetMaximumDistanceMeters = 10.5) {
      const normalizedLatitude = Math.max(-85, Math.min(85, Number(latitude) || 0));
      const earthCircumferenceMeters = 40075016.686;
      const scaleControlWidthPixels = 140;
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
      if (event?.ctrlKey || event?.metaKey) return toggleAbearcMapPhotoGroupSelection([Number(id)]);
      if (abearcMapResultSingleClickTimer) clearTimeout(abearcMapResultSingleClickTimer);
      abearcMapResultSingleClickTimer = setTimeout(() => {
        abearcMapResultSingleClickTimer = null;
        openAbearcMapDetails(id);
      }, 240);
    }

    function zoomAbearcMapPhotoToTenMeterScale(event, id) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (event?.ctrlKey || event?.metaKey) return;
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
        zoom: abearcMapScaleZoom(latitude),
        bearing: 0,
        pitch: 0,
        duration: 650,
        essential: true
      });
    }

    async function populateMapFilterOptions() {
      try {
        const options = await fetchJson(`${API}/map/filter-options`, { silentLoading: true });
        const categories = document.getElementById('abearcMapPhotoUploadCategories');
        if (categories) categories.innerHTML = (options.categories || []).map(item => `<option value="${esc(item)}"></option>`).join('');
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

    function abearcAdaptiveClusterZoom(features = [], { minimumIncrease = 0.35 } = {}) {
      const currentZoom = Number(abearcMap?.getZoom?.() || 0);
      const maximumZoom = abearcMapMaxZoom();
      const valid = (features || []).filter(feature => {
        const coordinates = feature?.geometry?.coordinates;
        return Number.isFinite(Number(coordinates?.[0])) && Number.isFinite(Number(coordinates?.[1]));
      });
      if (valid.length < 2 || !abearcMapAnalysis?.clusterPhotoPoints) {
        return { zoom: Math.min(maximumZoom, currentZoom + 1), splits: valid.length < 2 };
      }
      const radius = Math.max(48, Number(abearcMapConfig?.cluster?.radius || 54) * 1.15);
      const startZoom = Math.min(maximumZoom, Math.max(currentZoom + minimumIncrease, Math.ceil((currentZoom + minimumIncrease) * 4) / 4));
      for (let zoom = startZoom; zoom <= maximumZoom + 0.001; zoom += 0.25) {
        const candidateZoom = Math.min(zoom, maximumZoom);
        const worldSize = 512 * Math.pow(2, candidateZoom);
        const items = valid.map(feature => {
          const coordinates = feature.geometry.coordinates;
          const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng: Number(coordinates[0]), lat: Number(coordinates[1]) });
          return { id: Number(abearcFeatureId(feature)), feature, x: mercator.x * worldSize, y: mercator.y * worldSize };
        });
        const groups = abearcMapAnalysis.clusterPhotoPoints(items, radius);
        const largest = groups.reduce((max, group) => Math.max(max, group.length), 0);
        if (groups.length > 1 && largest < valid.length) {
          return { zoom: Math.min(maximumZoom, candidateZoom + 0.12), splits: true };
        }
      }
      return { zoom: maximumZoom, splits: false };
    }

    function zoomAbearcPhotoClusterUntilReduced(features, coordinates, { duration = 420 } = {}) {
      const leaves = (features || []).filter(Boolean);
      if (!abearcMap || leaves.length < 2) return false;
      const currentZoom = Number(abearcMap.getZoom());
      const result = abearcAdaptiveClusterZoom(leaves);
      if (!result.splits && (!abearcMapCanZoomIn() || result.zoom <= currentZoom + 0.02)) {
        explodeAbearcPhotoGroup(leaves, coordinates, { collapseOnMapClick: true, collapseOnZoomOut: true });
        return true;
      }
      abearcMap.easeTo({
        center: coordinates,
        zoom: Math.max(currentZoom + 0.25, result.zoom),
        duration,
        essential: true
      });
      return true;
    }

    function handleAbearcMapClick(event) {
      minimizeIdleAbearcMapMeasureTools();
      closeAbearcMapPhotoContextMenu();
      closeAbearcMapMeasureContextMenu();
      if (abearcMapImportedPolygons.length) {
        return Number.isInteger(abearcMapEditingImportedPolygonIndex) ? addAbearcMeasurePoint(event.lngLat) : undefined;
      }
      if (abearcMapMeasureMode !== 'off') return addAbearcMeasurePoint(event.lngLat);
      const measurePanel = document.querySelector('[data-map-measure-panel]');
      if (measurePanel && !measurePanel.classList.contains('is-collapsed')) {
        toggleAbearcMapMeasureTools(false);
      }
      if (abearcMapExploded?.collapseOnMapClick) collapseAbearcMapExplosion({ reason: 'collapseOnMapClick' });
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

    function abearcMapPhotoWorldSize() {
      return 512 * Math.pow(2, abearcMap?.getZoom?.() || 0);
    }

    function ensureAbearcMapMovedPhotoSize(photoId, pixelWidth = 44, pixelHeight = 44) {
      const id = Number(photoId);
      if (!Number.isFinite(id) || !abearcMap) return null;
      const existing = abearcMapMovedPhotoSizes.get(id);
      if (existing?.mapWidth > 0 && existing?.mapHeight > 0) return existing;
      const worldSize = abearcMapPhotoWorldSize();
      const width = Math.max(1, Number(pixelWidth) || 44);
      const height = Math.max(1, Number(pixelHeight) || 44);
      const size = { mapWidth: width / worldSize, mapHeight: height / worldSize };
      abearcMapMovedPhotoSizes.set(id, size);
      return size;
    }

    function applyAbearcMapMovedPhotoScale(element, photoId) {
      if (!element || !abearcMap) return;
      const id = Number(photoId);
      const size = ensureAbearcMapMovedPhotoSize(id);
      if (!size) return;
      const worldSize = abearcMapPhotoWorldSize();
      const width = Math.max(1, size.mapWidth * worldSize);
      const height = Math.max(1, size.mapHeight * worldSize);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      const frame = element.querySelector('.abearc-map-photo-pin__frame');
      if (frame) {
        frame.style.left = '0px';
        frame.style.top = '0px';
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
        frame.style.transform = 'none';
      }
    }

    function abearcMapPhotoFrameCenter(photoId, leaders) {
      const marker = abearcMapPhotoMarkers.get(`photo:${Number(photoId)}`);
      const frame = marker?.getElement?.()?.querySelector?.('.abearc-map-photo-pin__frame');
      if (!frame || !leaders) return null;
      const frameRect = frame.getBoundingClientRect();
      const leadersRect = leaders.getBoundingClientRect();
      if (!(frameRect.width > 0) || !(frameRect.height > 0)) return null;
      return {
        x: frameRect.left - leadersRect.left + frameRect.width / 2,
        y: frameRect.top - leadersRect.top + frameRect.height / 2
      };
    }

    function abearcPhotoMarkerElement({ feature, count = 1, clusterFeature = null }) {
      const el = document.createElement('button');
      el.type = 'button';
      const featureId = Number(abearcFeatureId(feature));
      const markerFeatures = count > 1 ? (clusterFeature?.clusterFeatures || []) : [feature];
      const markerPhotoIds = markerFeatures.map(item => Number(abearcFeatureId(item))).filter(Number.isFinite);
      const hoveredFeature = markerFeatures.find(item => Number(abearcFeatureId(item)) === Number(abearcMapHoveredPhotoId));
      const moved = count === 1 && abearcMapMovedPhotoPositions.has(featureId);
      const expanded = count === 1 && abearcMapExpandedPhotos.has(featureId);
      const selectedInMarker = count > 1
        ? (clusterFeature?.clusterFeatures || []).some(item => Number(abearcFeatureId(item)) === Number(abearcMapSelectedPhotoId))
        : Number(abearcFeatureId(feature)) === Number(abearcMapSelectedPhotoId);
      el.className = `abearc-map-photo-pin${count > 1 ? ' is-cluster' : ''}${selectedInMarker ? ' is-selected' : ''}${hoveredFeature ? ' is-list-hovered' : ''}${moved ? ' is-moved' : ''}${expanded ? ' is-expanded' : ''}`;
      el.classList.toggle('is-multi-selected', markerPhotoIds.some(id => abearcMapSelectedPhotoIds.has(id)));
      if (expanded) {
        const size = abearcMapExpandedPhotos.get(featureId);
        const worldSize = 512 * Math.pow(2, abearcMap?.getZoom?.() || 0);
        const width = size.mapWidth ? size.mapWidth * worldSize : size.width;
        el.style.width = `${width}px`;
        el.style.height = `${width / (Number(size.aspectRatio) || (size.width / size.height))}px`;
        el.dataset.aspectRatio = String(size.aspectRatio || 0);
      } else if (moved) {
        ensureAbearcMapMovedPhotoSize(featureId);
      }
      el.dataset.mapPhotoIds = markerPhotoIds.join(',');
      const siteSeriesCount = count === 1 ? Number(feature.properties?.site_series_count || 1) : 1;
      el.classList.toggle('is-site-series', siteSeriesCount > 1);
      el.title = count > 1 ? `${count} photo locations` : (siteSeriesCount > 1 ? `${siteSeriesCount} observations at this site` : (feature.properties?.category || 'Map photo'));
      const thumbnail = abearcAuthenticatedMediaUrl(feature.properties?.thumbnail_url);
      const bearing = bearingArrowHtml(feature.properties?.bearing_deg);
      el.innerHTML = `
        <span class="abearc-map-photo-pin__frame">
          ${thumbnail ? `<img alt="" src="${thumbnail}">` : abearcMarkerPlaceholder()}
          ${bearing}
        </span>
        <span class="abearc-map-photo-pin__hover-label" aria-hidden="true">${esc((hoveredFeature || feature).properties?.category || 'Map photo')}</span>
        ${count > 1 ? `<span class="abearc-map-photo-pin__count">${esc(count > 999 ? '999+' : count)}</span>` : (siteSeriesCount > 1 ? `<span class="abearc-map-photo-pin__count is-series">${esc(siteSeriesCount > 999 ? '999+' : siteSeriesCount)}</span>` : '')}
      `;
      if (moved && !expanded) {
        applyAbearcMapMovedPhotoScale(el, featureId);
      }
      if (expanded) {
        const image = el.querySelector('.abearc-map-photo-pin__frame img');
        const applyRatio = () => {
          const ratio = image?.naturalWidth > 0 && image?.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0;
          const current = abearcMapExpandedPhotos.get(featureId);
          if (!ratio || !current || current.aspectRatio === ratio) return;
          const size = { ...current, width: current.width, height: current.width / ratio, aspectRatio: ratio };
          abearcMapExpandedPhotos.set(featureId, size);
          el.style.height = `${size.height}px`;
          renderAbearcMapMovedPhotoLeaders();
        };
        image?.addEventListener('load', applyRatio, { once: true });
        if (image?.complete) applyRatio();
      }
      if (expanded) {
        ['nw', 'ne', 'sw', 'se'].forEach(corner => {
          const handle = document.createElement('span');
          handle.className = `abearc-map-photo-resize-handle ${corner}`;
          handle.dataset.corner = corner;
          handle.onpointerdown = event => {
            event.preventDefault(); event.stopPropagation();
            rememberAbearcMapView();
            const start = { x: event.clientX, y: event.clientY, ...abearcMapExpandedPhotos.get(featureId) };
            const move = moveEvent => {
              const dx = moveEvent.clientX - start.x, dy = moveEvent.clientY - start.y;
              const signX = corner.includes('w') ? -1 : 1, signY = corner.includes('n') ? -1 : 1;
              const ratio = Number(start.aspectRatio) > 0 ? Number(start.aspectRatio) : start.width / start.height;
              const delta = Math.abs(dx) > Math.abs(dy * ratio) ? signX * dx : signY * dy * ratio;
              const width = Math.max(96, Math.min(720, start.width + delta));
              const size = { width, height: width / ratio, aspectRatio: ratio, mapWidth: width / (512 * Math.pow(2, abearcMap.getZoom())) };
              abearcMapExpandedPhotos.set(featureId, size); el.style.width = `${size.width}px`; el.style.height = `${size.height}px`; renderAbearcMapMovedPhotoLeaders();
            };
            const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); abearcMap?.dragPan?.enable?.(); };
            abearcMap?.dragPan?.disable?.(); window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
          };
          el.appendChild(handle);
        });
      }
      el.onclick = (event) => {
        event.stopPropagation();
        if (Date.now() < Number(abearcMapPhotoSuppressOpenUntil.get(featureId) || 0)) return;
        if (event.ctrlKey || event.metaKey) return toggleAbearcMapPhotoGroupSelection(markerPhotoIds);
        if (clusterFeature && event.altKey) return handleAbearcClusterClick(clusterFeature, event);
        if (abearcMapMeasureMode !== 'off') {
          if (event.detail > 1) return;
          return addAbearcMeasurePointAt(clusterFeature?.geometry.coordinates || feature.geometry.coordinates);
        }
        if (clusterFeature) return handleAbearcClusterClick(clusterFeature, event);
        if (abearcMapMovedPhotoPositions.has(featureId)) return openAbearcMapDetails(featureId);
        if (Number(feature.properties?.site_series_count || 1) > 1) return openAbearcMapSiteTimeline(featureId);
        const near = closePhotoGroup(feature);
        if (near.length > 1) {
          return zoomAbearcPhotoClusterUntilReduced(near, feature.geometry.coordinates, { duration: 380 });
        }
        openAbearcMapDetails(abearcFeatureId(feature));
      };
      el.ondblclick = (event) => {
        if (event.ctrlKey || event.metaKey) return;
        if (abearcMapMeasureMode === 'off') return;
        event.preventDefault();
        event.stopPropagation();
        deleteAbearcMeasurePointNear(clusterFeature?.geometry.coordinates || feature.geometry.coordinates);
      };
      el.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openAbearcMapPhotoContextMenu(event, featureId, clusterFeature);
      };
      return el;
    }

    function resizeAbearcExpandedPhotoMarkers() {
      if (!abearcMap) return;
      const worldSize = abearcMapPhotoWorldSize();
      abearcMapExpandedPhotos.forEach((size, id) => {
        const marker = abearcMapPhotoMarkers.get(`photo:${id}`);
        if (!marker || !size) return;
        const ratio = Number(size.aspectRatio) > 0 ? Number(size.aspectRatio) : size.width / size.height;
        if (!size.mapWidth) size.mapWidth = size.width / worldSize;
        const width = size.mapWidth * worldSize;
        const element = marker.getElement();
        element.style.width = `${width}px`;
        element.style.height = `${width / ratio}px`;
      });
      abearcMapMovedPhotoPositions.forEach((position, id) => {
        if (abearcMapExpandedPhotos.has(id)) return;
        const marker = abearcMapPhotoMarkers.get(`photo:${id}`);
        if (!marker) return;
        applyAbearcMapMovedPhotoScale(marker.getElement(), id);
      });
      renderAbearcMapMovedPhotoLeaders();
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
      const zoomScale = Math.pow(2, abearcMap.getZoom());
      const worldSize = 512 * zoomScale;
      const canvas = abearcMap.getCanvas();
      const width = canvas?.clientWidth || 0;
      const height = canvas?.clientHeight || 0;
      const markerSize = 48;
      const radius = Math.max(markerSize, Number(abearcMapConfig?.cluster?.radius || 54) * 1.15);
      const candidates = [];
      const scopedFeatures = abearcMapVisibleListFeatures();
      const scopedIds = new Set(scopedFeatures.map(feature => Number(abearcFeatureId(feature))));
      const explodedIds = new Set((abearcMapExploded?.features || []).map(feature => Number(abearcFeatureId(feature))));
      scopedFeatures.forEach(feature => {
        if (explodedIds.has(Number(abearcFeatureId(feature)))) return;
        if (!feature?.geometry?.coordinates || !Number.isFinite(Number(feature.geometry.coordinates[0])) || !Number.isFinite(Number(feature.geometry.coordinates[1]))) return;
        if (abearcMapMovedPhotoPositions.has(Number(abearcFeatureId(feature)))) return;
        const point = abearcMap.project(feature.geometry.coordinates);
        if (point.x < -markerSize || point.y < -markerSize || point.x > width + markerSize || point.y > height + markerSize) return;
        const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng: Number(feature.geometry.coordinates[0]), lat: Number(feature.geometry.coordinates[1]) });
        candidates.push({ feature, id: Number(abearcFeatureId(feature)), x: mercator.x * worldSize, y: mercator.y * worldSize });
      });
      const groups = abearcMapAnalysis.clusterPhotoPoints(candidates, radius).map(items => {
        const key = items.map(item => item.id).join(',');
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
        if (existing && abearcMapPhotoDragBindings.has(Number(group.key.replace('photo:', '')))) {
          existing.setLngLat(group.coordinates);
          return;
        }
        if (existing) existing.remove();
        abearcMapPhotoMarkers.set(group.key, new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(group.coordinates).addTo(abearcMap));
      });
      clearAbearcMapPhotoMarkers(keep);
      renderAbearcMapMovedPhotoLeaders();
      scheduleAbearcAdministrativeBoundaryLabel();
    }

    function handleScreenAbearcClusterClick(cluster, event = {}) {
      const leaves = cluster.clusterFeatures || [];
      if (event.altKey && leaves.length > 1) {
        abearcMapAltHeld = true;
        return explodeAbearcPhotoGroup(leaves, cluster.geometry.coordinates, { collapseOnAltRelease: true });
      }
      if (leaves.length > 1) {
        return zoomAbearcPhotoClusterUntilReduced(leaves, cluster.geometry.coordinates, { duration: 420 });
      }
    }

    function handleAbearcClusterClick(cluster, event = {}) {
      closeAbearcMapPhotoContextMenu();
      minimizeIdleAbearcMapMeasureTools();
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
          const currentZoom = Number(abearcMap.getZoom());
          const sourceExpansionZoom = zoomErr ? currentZoom + 0.5 : Number(zoom);
          const adaptive = abearcAdaptiveClusterZoom(clusterLeaves);
          const targetZoom = Math.min(abearcMapMaxZoom(), Math.max(sourceExpansionZoom, adaptive.zoom, currentZoom + 0.35));
          if (!adaptive.splits && targetZoom >= abearcMapMaxZoom() - 0.02) {
            return explodeAbearcPhotoGroup(clusterLeaves, cluster.geometry.coordinates, { collapseOnMapClick: true, collapseOnZoomOut: true });
          }
          abearcMap.easeTo({ center: cluster.geometry.coordinates, zoom: targetZoom, duration: 420, essential: true });
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
      closeAbearcMapPhotoContextMenu();
      if (!features.length) return;
      const visible = features.slice(0, abearcMapConfig.explosion.maxVisiblePhotos);
      const anchorLng = clusterCoordinates ? Number(clusterCoordinates[0]) : visible.reduce((sum, f) => sum + Number(f.geometry.coordinates[0]), 0) / visible.length;
      const anchorLat = clusterCoordinates ? Number(clusterCoordinates[1]) : visible.reduce((sum, f) => sum + Number(f.geometry.coordinates[1]), 0) / visible.length;
      const selectedFeature = visible.find(feature => Number(abearcFeatureId(feature)) === Number(abearcMapSelectedPhotoId)) || visible[0];
      const previous = abearcMapExploded;
      const ids = new Set(visible.map(feature => Number(abearcFeatureId(feature))));
      const groups = (previous?.groups || []).map(group => ({ ...group, ids: group.ids.filter(id => !ids.has(id)) })).filter(group => group.ids.length);
      groups.push({ ids: [...ids], anchor: [anchorLng, anchorLat], ...options });
      abearcMapExploded = {
        groups,
        features: [...(previous?.features || []).filter(feature => !ids.has(Number(abearcFeatureId(feature)))), ...visible],
        anchor: [anchorLng, anchorLat],
        selectedId: Number(abearcFeatureId(selectedFeature)),
        total: features.length,
        positions: previous?.positions || new Map(),
        collapsingIds: new Set([...(previous?.collapsingIds || [])].filter(id => !ids.has(id))),
        animated: false,
        collapsing: false,
        collapseOnMapClick: groups.some(group => group.collapseOnMapClick),
        collapseOnZoomOut: groups.some(group => group.collapseOnZoomOut),
        collapseOnAltRelease: groups.some(group => group.collapseOnAltRelease),
        persistent: groups.some(group => group.persistent),
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
      const canvasBounds = abearcMap.getCanvas().getBoundingClientRect();
      abearcMapPhotoMarkers.forEach((marker, key) => {
        if (key.startsWith('photo:') && explodedIds.has(Number(key.slice('photo:'.length)))) return;
        const point = abearcMap.project(marker.getLngLat());
        const element = marker.getElement();
        const bounds = [element, ...element.querySelectorAll('.abearc-map-photo-pin__frame, .abearc-map-photo-pin__count')]
          .map(part => part.getBoundingClientRect());
        const padding = 8;
        rects.push({ rect: {
          left: Math.min(...bounds.map(rect => rect.left)) - canvasBounds.left - padding,
          top: Math.min(...bounds.map(rect => rect.top)) - canvasBounds.top - padding,
          right: Math.max(...bounds.map(rect => rect.right)) - canvasBounds.left + padding,
          bottom: Math.max(...bounds.map(rect => rect.bottom)) - canvasBounds.top + padding
        }, point });
      });
      return rects;
    }

    function explosionPositions(features) {
      const occupied = currentPhotoMarkerRects(features);
      const surrounding = occupied.slice();
      const occupiedLines = [];
      const gpsPins = features.map(feature => rectForExplosionPoint(abearcMap.project(feature.geometry.coordinates), 20));
      const canvas = abearcMap.getCanvas();
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const margin = 36;
      const clamp = point => ({
        x: Math.max(Math.min(margin, width / 2), Math.min(width - margin, point.x)),
        y: Math.max(Math.min(margin, height / 2), Math.min(height - margin, point.y))
      });
      const crossesRect = (start, end, rect) => {
        const inside = point => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
        if (inside(start) || inside(end)) return true;
        const corners = [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top },
          { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }];
        return corners.some((corner, i) => segmentsIntersect(start, end, corner, corners[(i + 1) % 4]));
      };
      const saved = abearcMapExploded.positions || (abearcMapExploded.positions = new Map());
      return features.map((feature, index) => {
        const id = Number(abearcFeatureId(feature));
        const origin = abearcMap.project(feature.geometry.coordinates);
        const previous = saved.get(id);
        const clusterCenter = abearcMap.project(abearcMapExploded.groups?.find(group => group.ids.includes(id))?.anchor || abearcMapExploded.anchor || feature.geometry.coordinates);
        const dx = origin.x - clusterCenter.x;
        const dy = origin.y - clusterCenter.y;
        const preferred = Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : -Math.PI / 2 + (Math.PI * 2 * index / Math.max(features.length, 1));
        const candidates = explosionCandidates(origin, preferred, index, features.length).map(clamp);
        if (previous) candidates.unshift(clamp({ x: origin.x + previous.x, y: origin.y + previous.y }));
        const available = candidates.find(point => {
          const rect = rectForExplosionPoint(point);
          const overlaps = gpsPins.some(pin => rectsOverlap(rect, pin)) || occupied.some(item => rectsOverlap(rect, item.rect));
          const crossesMarker = occupied.some(item => crossesRect(origin, point, item.rect))
            || occupiedLines.some(line => crossesRect(line.start, line.end, rect));
          const crossesLine = occupiedLines.some(line => segmentsIntersect(origin, point, line.start, line.end));
          const crossesSurrounding = surrounding.some(item => crossesRect(origin, point, item.rect));
          return !overlaps && !crossesSurrounding && !crossesLine && (!crossesMarker || (previous && point === candidates[0]));
        });
        const chosen = available || candidates
          .map(point => {
            const rect = rectForExplosionPoint(point);
            const pinOverlapCount = gpsPins.filter(pin => rectsOverlap(rect, pin)).length;
            const overlapCount = occupied.filter(item => rectsOverlap(rect, item.rect)).length;
            const lineCrossCount = occupiedLines.filter(line => segmentsIntersect(origin, point, line.start, line.end)).length;
            const surroundingCrossCount = surrounding.filter(item => crossesRect(origin, point, item.rect)).length;
            const markerCrossCount = occupied.filter(item => crossesRect(origin, point, item.rect)).length
              + occupiedLines.filter(line => crossesRect(line.start, line.end, rect)).length;
            return { point, pinOverlapCount, overlapCount, surroundingCrossCount, lineCrossCount, markerCrossCount, distance: Math.hypot(point.x - origin.x, point.y - origin.y) };
          })
          .sort((a, b) => a.pinOverlapCount - b.pinOverlapCount || a.overlapCount - b.overlapCount
            || a.surroundingCrossCount - b.surroundingCrossCount || a.lineCrossCount - b.lineCrossCount
            || a.markerCrossCount - b.markerCrossCount || a.distance - b.distance)[0]?.point
          || { x: origin.x, y: origin.y - 64 };
        occupied.push({ rect: rectForExplosionPoint(chosen), point: chosen });
        occupiedLines.push({ start: origin, end: chosen });
        saved.set(id, { x: chosen.x - origin.x, y: chosen.y - origin.y });
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
      return [row.barangay, row.district].map(value => String(value || '').trim())
        .filter(value => value && !/^(?:unknown|unavailable)(?:\s+(?:barangay|brgy|bgry|district))?$|^(?:n\/a|na|none|null|-)$/i.test(value)
          && !/\b(?:coordinates?|accuracy|elevation|bearing|zoning|date\/time)\s*[:=]/i.test(value))
        .join(', ');
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
      const annotation = field === 'elevation-annotation' || field === 'photo-annotation';
      const annotationTitle = field === 'photo-annotation' ? 'Annotate photos' : 'Add point annotation';
      const label = annotation ? 'Annotation text' : (field === 'category' ? 'Category' : (field === 'bulk-category' ? 'Category' : 'Remarks'));
      document.querySelector('[data-abearc-map-edit-modal] [data-abearc-map-edit-close]')?.click();

      const modal = document.createElement('div');
      modal.dataset.abearcMapEditModal = '';
      modal.className = 'fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm transition-all duration-200';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', annotation ? annotationTitle : (field === 'bulk-category' ? 'Rename all photo categories' : `Edit ${label}`));
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto overflow-hidden fade-in" data-abearc-map-edit-dialog>
          <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">${annotation ? annotationTitle : (field === 'bulk-category' ? 'Rename photo categories' : `Edit ${label}`)}</h3>
        <button type="button" data-abearc-map-edit-close class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-width="2" stroke-linecap="round" /></svg></button>
          </div>
          <form class="p-5 space-y-4" data-abearc-map-edit-form>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">${label}</label>
              ${field === 'remarks'
                ? `<textarea rows="5" data-abearc-map-edit-input class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"></textarea>`
                : `<input type="text" ${field === 'photo-annotation' ? '' : 'required'} ${annotation ? 'maxlength="80"' : ''} data-abearc-map-edit-input class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none">`}
              ${field === 'photo-annotation' ? '<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Keep the default to use each photo’s existing annotation or classification/name. Enter different text to apply one label to all selected photos. Clear the text to remove labels. Drag labels to reposition them, and save a map layout to keep them.</p>' : ''}
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

    function canDeleteAbearcMapPhoto(photo) {
      const ownerId = Number(photo?.properties?.owner_user_id ?? photo?.owner_user_id);
      const ownedByCurrentUser = Number.isFinite(ownerId) && ownerId === Number(currentUser?.id);
      const ownedInMineScope = abearcMapPhotoScope === 'mine' && Number.isFinite(ownerId)
        && ownerId === Number(currentUser?.id);
      return hasPrivilege('delete_other_map_media') || ownedInMineScope || ownedByCurrentUser;
    }

    function isProjectDocumentLinkedMapPhoto(photo) {
      return Number(photo?.properties?.project_document_linked ?? photo?.project_document_linked ?? 0) === 1;
    }

    function manageableAbearcMapPhotoIds() {
      return [...new Set(abearcMapFeatures.filter(canManageAbearcMapPhoto).map(feature => Number(abearcFeatureId(feature))).filter(Number.isInteger))];
    }

    function deletableAbearcMapPhotoIds() {
      return [...new Set(abearcMapVisibleListFeatures()
        .filter(photo => canDeleteAbearcMapPhoto(photo) && !isProjectDocumentLinkedMapPhoto(photo))
        .map(feature => Number(abearcFeatureId(feature)))
        .filter(Number.isInteger))];
    }

    function selectableAbearcMapPhotoIds() {
      return [...new Set(abearcMapVisibleListFeatures().map(feature => Number(abearcFeatureId(feature))).filter(id => Number.isInteger(id) && id > 0))];
    }

    function abearcMapPhotoIdsInBox(start, end) {
      const inside = point => point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
        && point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
      const ids = new Set();
      if (!abearcMapPhotosVisible) return ids;
      const explodedIds = new Set((abearcMapExploded?.features || []).map(feature => Number(abearcFeatureId(feature))));
      abearcMapVisibleListFeatures().forEach(feature => {
        const id = Number(abearcFeatureId(feature));
        if (!explodedIds.has(id) && !abearcMapMovedPhotoPositions.has(id) && inside(abearcMap.project(feature.geometry.coordinates))) ids.add(id);
      });
      const canvas = abearcMap.getContainer().getBoundingClientRect();
      document.querySelectorAll('#mapPage .abearc-map-photo-pin, #mapPage .abearc-map-exploded-photo').forEach(marker => {
        const rect = marker.getBoundingClientRect();
        if (!inside({ x: (rect.left + rect.right) / 2 - canvas.left, y: (rect.top + rect.bottom) / 2 - canvas.top })) return;
        String(marker.dataset.mapPhotoIds || marker.dataset.mapPhotoId || '').split(',').map(Number)
          .filter(id => Number.isInteger(id) && id > 0).forEach(id => ids.add(id));
      });
      return ids;
    }

    function handleAbearcMapPhotoBoxZoom(map, start, end) {
      const ids = abearcMapPhotoIdsInBox(start, end);
      abearcMapSelectedPhotoIds.clear();
      ids.forEach(id => abearcMapSelectedPhotoIds.add(id));
      abearcMapPhotoSelectionMode = ids.size > 0;
      if (abearcMapResultSingleClickTimer) clearTimeout(abearcMapResultSingleClickTimer);
      closeAbearcMapDetails();
      closeAbearcMapPhotoContextMenu();
      renderAbearcMapList();
      if (!ids.size) map.fitScreenCoordinates(start, end, map.getBearing(), { linear: true });
    }

    function syncAbearcMapPhotoSelection() {
      if (abearcMapSelectedPhotoIds.size > 1) closeAbearcMapDetails();
      scheduleAbearcMapMarkerRender();
      if (abearcMapExploded) renderAbearcMapExplosion();
    }

    function currentAbearcMapBulkTargetIds() {
      return abearcMapPhotoSelectionMode ? [...abearcMapSelectedPhotoIds] : manageableAbearcMapPhotoIds();
    }

    function currentAbearcMapDeleteTargetIds() {
      return abearcMapPhotoSelectionMode ? [...abearcMapSelectedPhotoIds] : deletableAbearcMapPhotoIds();
    }

    function updateAbearcMapPhotoSelectionToolbar() {
      syncAbearcMapPhotoSelection();
      const toolbar = document.querySelector('[data-map-selection-toolbar]');
      if (!toolbar) return;
      toolbar.classList.toggle('hidden', !abearcMapPhotoSelectionMode);
      const count = abearcMapSelectedPhotoIds.size;
      const countLabel = toolbar.querySelector('[data-map-selection-count]');
      if (countLabel) countLabel.textContent = `${count.toLocaleString()} selected`;
      toolbar.querySelectorAll('[data-map-selection-save], [data-map-selection-download]').forEach(button => { button.disabled = count === 0; });
      const saveButton = toolbar.querySelector('[data-map-selection-save]');
      if (saveButton) {
        const action = count > 0 && [...abearcMapSelectedPhotoIds].every(id => abearcMapSavedPhotoIds.has(id)) ? 'Unsave' : 'Save';
        saveButton.textContent = action;
        saveButton.title = `${action} selected photos`;
        saveButton.setAttribute('aria-label', saveButton.title);
      }
      const selectedFeatures = [...abearcMapSelectedPhotoIds].map(featureById).filter(Boolean);
      const allManageable = count > 0 && selectedFeatures.length === count && selectedFeatures.every(canManageAbearcMapPhoto);
      const allDeletable = count > 0 && selectedFeatures.length === count && selectedFeatures.every(canDeleteAbearcMapPhoto);
      const renameButton = toolbar.querySelector('[data-map-selection-rename]');
      if (renameButton) {
        renameButton.disabled = !allManageable;
        renameButton.title = allManageable ? 'Rename selected photos (F2)' : 'You can only rename photos you manage';
      }
      const containsSourceProtectedPhoto = [...abearcMapSelectedPhotoIds].some(id => isProjectDocumentLinkedMapPhoto(featureById(id)));
      const deleteButton = toolbar.querySelector('[data-map-selection-delete]');
      if (deleteButton) {
        const showDelete = allDeletable && !containsSourceProtectedPhoto;
        deleteButton.classList.toggle('hidden', !showDelete);
        deleteButton.disabled = !showDelete;
        deleteButton.title = containsSourceProtectedPhoto
          ? 'Remove the source file from its project record to delete this map photo'
          : (allDeletable ? 'Delete selected photos' : "Deleting other users' photos requires permission");
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

    function toggleAbearcMapPhotoGroupSelection(ids) {
      if (abearcMapResultSingleClickTimer) {
        clearTimeout(abearcMapResultSingleClickTimer);
        abearcMapResultSingleClickTimer = null;
      }
      if (!abearcMapPhotoSelectionMode && abearcMapSelectedPhotoId != null) {
        abearcMapSelectedPhotoIds.add(Number(abearcMapSelectedPhotoId));
      }
      const deselect = ids.every(id => abearcMapSelectedPhotoIds.has(id));
      ids.forEach(id => deselect ? abearcMapSelectedPhotoIds.delete(id) : abearcMapSelectedPhotoIds.add(id));
      abearcMapPhotoSelectionMode = abearcMapSelectedPhotoIds.size > 0;
      closeAbearcMapDetails();
      closeAbearcMapPhotoContextMenu();
      renderAbearcMapList();
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

    function saveSelectedAbearcMapPhotos(unsave = null) {
      const ids = [...abearcMapSelectedPhotoIds];
      if (!ids.length) return toast('Select at least one photo.', 'error');
      if (unsave === null) unsave = ids.every(id => abearcMapSavedPhotoIds.has(id));
      if (ids.some(id => abearcMapSavedPhotoIds.has(id) === unsave)) rememberAbearcMapView();
      if (unsave) {
        removeAbearcSavedPhotoIds(ids);
        if (abearcMapPhotoScope === 'saved') refreshAbearcMapPhotoScope();
        else renderAbearcMapList();
        return toast(`${ids.length.toLocaleString()} selected photo${ids.length === 1 ? '' : 's'} unsaved.`);
      }
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
      const ids = currentAbearcMapDeleteTargetIds();
      const selectedFeatures = ids.map(featureById).filter(Boolean);
      if (!ids.length) return toast('There are no photos you can delete in the current results.', 'error');
      if (selectedFeatures.length !== ids.length || selectedFeatures.some(photo => !canDeleteAbearcMapPhoto(photo))) {
        return toast("Deleting other users' photos requires permission.", 'error');
      }
      if (selectedFeatures.some(isProjectDocumentLinkedMapPhoto)) {
        return toast('Remove the source file from its project record to delete this map photo.', 'error');
      }
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
      if (bearing == null || String(bearing).trim() === '') return '';
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

    function openAbearcMapPhotoContextMenu(event, featureId, cluster = null, collapseOnly = false, annotationOnly = false) {
      const id = Number(featureId);
      if (!Number.isFinite(id) || !featureById(id)) return;
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
      const expanded = abearcMapExpandedPhotos.has(id);
      menu.querySelector('[data-map-photo-expand]')?.classList.toggle('hidden', expanded);
      menu.querySelector('[data-map-photo-collapse]')?.classList.toggle('hidden', !expanded);
      menu.querySelector('[data-map-photo-delete]')?.classList.remove('hidden');
      menu.querySelectorAll('button').forEach(button => {
        if (cluster) button.classList.add('hidden');
        else if (!button.matches('[data-map-photo-expand], [data-map-photo-collapse], [data-map-cluster-explode], [data-map-cluster-collapse]')) button.classList.remove('hidden');
      });
      const explode = menu.querySelector('[data-map-cluster-explode]');
      explode.classList.toggle('hidden', !cluster);
      explode.onclick = () => {
        closeAbearcMapPhotoContextMenu();
        rememberAbearcMapView();
        explodeAbearcPhotoGroup(cluster.clusterFeatures, cluster.geometry.coordinates, { persistent: true });
      };
      const collapse = menu.querySelector('[data-map-cluster-collapse]');
      collapse.querySelector('span').textContent = collapseOnly ? 'Collapse photo' : 'Collapse exploded photos';
      collapse.classList.toggle('hidden', Boolean(cluster) || !abearcMapExploded?.features.some(feature => Number(abearcFeatureId(feature)) === id));
      collapse.onclick = () => {
        closeAbearcMapPhotoContextMenu();
        rememberAbearcMapView();
        collapseAbearcMapExplosion({ featureId: id });
      };
      if (collapseOnly) menu.querySelectorAll('button').forEach(button => button.classList.toggle('hidden', button !== collapse));
      const selectedMenu = !annotationOnly && !collapseOnly && abearcMapPhotoSelectionMode && (cluster?.clusterFeatures || [featureById(id)])
        .some(feature => abearcMapSelectedPhotoIds.has(Number(abearcFeatureId(feature))));
      menu.querySelectorAll('[data-map-selection-action]').forEach(button => button.classList.add('hidden'));
      if (selectedMenu) {
        menu.querySelectorAll('button').forEach(button => button.classList.add('hidden'));
        explode.classList.toggle('hidden', !cluster);
        const selected = [...abearcMapSelectedPhotoIds].map(featureById).filter(Boolean);
        const complete = selected.length === abearcMapSelectedPhotoIds.size && selected.length > 0;
        const allSaved = [...abearcMapSelectedPhotoIds].every(photoId => abearcMapSavedPhotoIds.has(photoId));
        menu.querySelector('[data-map-selection-action="save"]').textContent = allSaved ? 'Unsave' : 'Save';
        const actions = {
          annotate: () => annotateAbearcMapPhotos([...abearcMapSelectedPhotoIds]),
          expand: !cluster && selected.some(photo => !abearcMapExpandedPhotos.has(Number(abearcFeatureId(photo)))) ? () => applyAbearcMapSelectedPhotoLayout('expand') : null,
          collapse: selected.some(photo => abearcMapExpandedPhotos.has(Number(abearcFeatureId(photo)))) ? () => applyAbearcMapSelectedPhotoLayout('collapse') : null,
          move: !cluster ? () => beginAbearcMapThumbnailMove([...abearcMapSelectedPhotoIds]) : null,
          save: () => saveSelectedAbearcMapPhotos(allSaved),
          download: downloadSelectedAbearcMapPhotos,
          hide: () => applyAbearcMapSelectedPhotoLayout('hide'),
          delete: complete && selected.every(photo => canDeleteAbearcMapPhoto(photo) && !isProjectDocumentLinkedMapPhoto(photo)) ? deleteSelectedAbearcMapPhotos : null
        };
        menu.querySelectorAll('[data-map-selection-action]').forEach(button => {
          const action = actions[button.dataset.mapSelectionAction];
          const iconSource = button.dataset.mapSelectionAction === 'hide' ? 'delete' : button.dataset.mapSelectionAction;
          const icon = menu.querySelector(`[data-map-photo-${iconSource}] svg`);
          if (icon && !button.querySelector('svg')) button.prepend(icon.cloneNode(true));
          button.classList.toggle('hidden', !action);
          button.onclick = () => { closeAbearcMapPhotoContextMenu(); action?.(); };
        });
      }
      const moveLabel = menu.querySelector('[data-map-photo-move-label]');
      if (moveLabel) moveLabel.textContent = 'Move/Stick Thumbnail';
      const saveButton = menu.querySelector('[data-map-photo-save]');
      saveButton.querySelector('[data-map-photo-save-label]').textContent = abearcMapSavedPhotoIds.has(id) ? 'Unsave' : 'Save';
      saveButton.onclick = () => { closeAbearcMapPhotoContextMenu(); toggleAbearcSavedPhoto(id); };
      const renameAnnotation = menu.querySelector('[data-map-photo-annotation-rename]');
      const removeAnnotation = menu.querySelector('[data-map-photo-annotation-remove]');
      menu.setAttribute('aria-label', annotationOnly ? 'Photo annotation actions' : 'Photo thumbnail actions');
      if (annotationOnly) menu.querySelectorAll('button').forEach(button => button.classList.add('hidden'));
      renameAnnotation.classList.toggle('hidden', !annotationOnly);
      removeAnnotation.classList.toggle('hidden', !annotationOnly);
      renameAnnotation.onclick = () => annotateAbearcMapPhotos([id]);
      removeAnnotation.onclick = () => {
        closeAbearcMapPhotoContextMenu();
        rememberAbearcMapView();
        abearcMapPhotoAnnotations.delete(id);
        renderAbearcMapPhotoAnnotations();
      };
      const width = menu.offsetWidth || 190;
      const height = menu.offsetHeight || 44;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function annotateAbearcMapPhotos(ids = [abearcMapThumbnailContextId]) {
      const photoIds = [...new Set(ids.map(Number))].filter(id => id > 0 && featureById(id));
      closeAbearcMapPhotoContextMenu();
      closeAbearcMapListContextMenu();
      if (!photoIds.length) return;
      const defaults = new Map(photoIds.map(id => [id, String(abearcMapPhotoAnnotations.get(id)?.text || featureById(id).properties?.category || 'General').trim().slice(0, 80)]));
      const current = defaults.get(photoIds[0]);
      openAbearcMapEditModal('photo-annotation', current, next => {
        const text = String(next).trim().slice(0, 80);
        rememberAbearcMapView();
        photoIds.forEach(id => {
          if (text) abearcMapPhotoAnnotations.set(id, { mapDx: 22, mapDy: -42, ...abearcMapPhotoAnnotations.get(id), text: text === current ? defaults.get(id) : text });
          else abearcMapPhotoAnnotations.delete(id);
        });
        renderAbearcMapPhotoAnnotations();
      });
    }

    function renderAbearcMapPhotoAnnotations() {
      const svg = document.getElementById('abearcMapMeasureLayer');
      svg?.querySelector('[data-map-photo-annotations]')?.remove();
      const guides = document.querySelector('[data-map-annotation-guide-layer]');
      if (guides) guides.innerHTML = '';
      if (!svg || !abearcMap || !abearcMapPhotosVisible || !abearcMapPhotoAnnotations.size) return;
      const points = {};
      abearcMapScopedFeatures().forEach(feature => {
        const id = Number(abearcFeatureId(feature));
        if (!abearcMapPhotoAnnotations.has(id) || abearcMapSessionHiddenPhotoIds.has(id)) return;
        const exploded = document.querySelector(`#abearcMapExplosionLayer [data-map-photo-id="${id}"]`);
        const rect = exploded?.getBoundingClientRect(), bounds = svg.getBoundingClientRect();
        const anchor = abearcMapPhotoFrameCenter(id, svg) || (rect
          ? { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 }
          : abearcMap.project(feature.geometry.coordinates));
        if (anchor.x >= 0 && anchor.y >= 0 && anchor.x <= svg.clientWidth && anchor.y <= svg.clientHeight) points[id] = anchor;
      });
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-map-photo-annotations', '');
      svg.appendChild(group);
      renderAbearcMapMeasureAnnotations(group, points, svg.clientWidth, svg.clientHeight, true);
    }

    function applyAbearcMapSelectedPhotoLayout(action) {
      rememberAbearcMapView();
      abearcMapRestoringView = true;
      try {
        const handler = { expand: expandAbearcMapPhoto, collapse: collapseAbearcMapPhoto, hide: deleteAbearcMapPhotoFromContext }[action];
        [...abearcMapSelectedPhotoIds].forEach(id => handler(id));
        if (action === 'hide') cancelAbearcMapPhotoSelection();
      } finally { abearcMapRestoringView = false; }
    }

    function expandAbearcMapPhoto(photoId = abearcMapThumbnailContextId) {
      rememberAbearcMapView();
      const id = Number(photoId); closeAbearcMapPhotoContextMenu();
      if (!Number.isFinite(id)) return;
      if (abearcMapExploded?.features?.some(feature => Number(abearcFeatureId(feature)) === id)) promoteExplodedPhotoToMarker(id);
      abearcMapExpandedPhotos.set(id, abearcMapExpandedPhotos.get(id) || { width: 260, height: 180, aspectRatio: 260 / 180, mapWidth: 260 / (512 * Math.pow(2, abearcMap.getZoom())) });
      if (!abearcMapMovedPhotoPositions.has(id) && featureById(id)) abearcMapMovedPhotoPositions.set(id, [...featureById(id).geometry.coordinates]);
      renderAbearcMapPhotoMarkers();
    }
    function collapseAbearcMapPhoto(photoId = abearcMapThumbnailContextId) {
      rememberAbearcMapView();
      const id = Number(photoId); closeAbearcMapPhotoContextMenu();
      if (!Number.isFinite(id)) return;
      if (abearcMapExploded?.features?.some(feature => Number(abearcFeatureId(feature)) === id)) promoteExplodedPhotoToMarker(id);
      abearcMapExpandedPhotos.delete(id);
      if (abearcMapMovedPhotoPositions.has(id)) ensureAbearcMapMovedPhotoSize(id);
      renderAbearcMapPhotoMarkers();
    }
    function deleteAbearcMapPhotoFromContext(photoId = abearcMapThumbnailContextId) {
      rememberAbearcMapView();
      const id = Number(photoId); closeAbearcMapPhotoContextMenu();
      if (!Number.isFinite(id)) return;
      abearcMapSessionHiddenPhotoIds.add(id);
      abearcMapMovedPhotoPositions.delete(id);
      abearcMapExpandedPhotos.delete(id);
      finishAbearcMapThumbnailMoveMode();
      if (abearcMapExploded?.features) {
        abearcMapExploded.features = abearcMapExploded.features.filter(feature => Number(abearcFeatureId(feature)) !== id);
        if (abearcMapExploded.features.length) {
          abearcMapExploded.selectedId = Number(abearcFeatureId(abearcMapExploded.features[0]));
          renderAbearcMapExplosion();
        } else {
          finishAbearcMapExplosionCollapse();
        }
      }
      renderAbearcMapPhotoMarkers();
      renderAbearcMapMovedPhotoLeaders();
    }
    function promoteExplodedPhotoToMarker(id) {
      const index = abearcMapExploded?.features?.findIndex(feature => Number(abearcFeatureId(feature)) === id);
      if (index == null || index < 0 || !abearcMap) return;
      const position = explosionPositions(abearcMapExploded.features)[index];
      if (position) {
        const lngLat = abearcMap.unproject(position);
        abearcMapMovedPhotoPositions.set(id, [lngLat.lng, lngLat.lat]);
        ensureAbearcMapMovedPhotoSize(id, 54, 54);
      }
      finishAbearcMapExplosionCollapse(new Set([id]));
    }

    function openAbearcMapListContextMenu(event, id, current = 'General') {
      if (abearcMapPhotoSelectionMode && abearcMapSelectedPhotoIds.has(Number(id))) return openAbearcMapPhotoContextMenu(event, id);
      event?.preventDefault?.();
      event?.stopPropagation?.();
      closeAbearcMapPhotoContextMenu();
      closeAbearcMapMeasureContextMenu();
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(details => details.removeAttribute('open'));
      const menu = document.querySelector('[data-map-list-context-menu]');
      const shell = document.querySelector('#mapPage .abearc-map-shell');
      if (!menu || !shell) return;
      if (menu.parentElement !== shell) shell.appendChild(menu);
      abearcMapSelectedPhotoId = Number(id);
      document.querySelectorAll('[data-map-list-photo-id]').forEach(item => item.classList.toggle('is-selected', Number(item.dataset.mapListPhotoId) === Number(id)));
      scheduleAbearcMapMarkerRender();
      menu.dataset.photoId = Number(id);
      menu.dataset.current = current || 'General';
      const feature = featureById(id);
      const manageable = feature ? canManageAbearcMapPhoto(feature) : false;
      const deletable = feature ? canDeleteAbearcMapPhoto(feature) : false;
      const sourceProtected = feature ? isProjectDocumentLinkedMapPhoto(feature) : false;
      const renameButton = menu.querySelector('[data-map-list-menu-rename]');
      const deleteButton = menu.querySelector('[data-map-list-menu-delete]');
      const deleteSeparator = menu.querySelector('[data-map-list-menu-delete-separator]');
      const saveButton = menu.querySelector('[data-map-list-menu-save]');
      renameButton?.classList.toggle('hidden', !manageable);
      deleteButton?.classList.toggle('hidden', !deletable || sourceProtected);
      deleteSeparator?.classList.toggle('hidden', !deletable || sourceProtected);
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
      menu.querySelector('[data-map-list-menu-annotate]').onclick = () => annotateAbearcMapPhotos([id]);
      menu.querySelector('[data-map-list-menu-download]').onclick = () => {
        closeAbearcMapListContextMenu();
        downloadAbearcMapOriginal(id);
      };
      deleteButton.onclick = () => {
        closeAbearcMapListContextMenu();
        deleteAbearcMapPhoto(id);
      };
      const bounds = shell.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 190;
      const height = menu.offsetHeight || 92;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, (event?.clientX || bounds.left + 24) - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, (event?.clientY || bounds.top + 24) - bounds.top))}px`;
    }

    function finishAbearcMapThumbnailMoveMode() {
      for (const binding of abearcMapPhotoDragBindings.values()) {
        binding.marker.off('drag', binding.onDrag);
        binding.marker.off('dragend', binding.onDragEnd);
        binding.marker.setDraggable(false);
        binding.marker.getElement()?.classList.remove('is-moving');
      }
      abearcMapPhotoDragBindings.clear();
      abearcMapThumbnailMoveId = null;
    }

    function beginAbearcMapThumbnailMove(photoIds = [Number(abearcMapThumbnailContextId)]) {
      rememberAbearcMapView();
      finishAbearcMapThumbnailMoveMode();
      const ids = photoIds.filter(id => featureById(id));
      const id = ids[0];
      closeAbearcMapPhotoContextMenu();
      ids.forEach(photoId => {
        if (abearcMapExploded?.features?.some(feature => Number(abearcFeatureId(feature)) === photoId)) promoteExplodedPhotoToMarker(photoId);
        if (!abearcMapMovedPhotoPositions.has(photoId)) abearcMapMovedPhotoPositions.set(photoId, [...featureById(photoId).geometry.coordinates]);
        if (!abearcMapMovedPhotoSizes.has(photoId)) {
          const frame = abearcMapPhotoMarkers.get(`photo:${photoId}`)?.getElement?.()?.querySelector?.('.abearc-map-photo-pin__frame');
          const rect = frame?.getBoundingClientRect?.();
          ensureAbearcMapMovedPhotoSize(photoId, frame?.offsetWidth || rect?.width || 44, frame?.offsetHeight || rect?.height || 44);
        }
      });
      renderAbearcMapPhotoMarkers();
      const marker = abearcMapPhotoMarkers.get(`photo:${id}`);
      if (!Number.isFinite(id) || !marker) return toast('This photo must be shown individually before it can be moved.', 'error');
      abearcMapThumbnailMoveId = id;
      const positions = new Map(ids.map(photoId => [photoId, abearcMap.project(abearcMapMovedPhotoPositions.get(photoId))]));
      ids.forEach(id => {
      const marker = abearcMapPhotoMarkers.get(`photo:${id}`);
      if (!marker) return;
      const start = positions.get(id);
      const onDrag = () => {
        const position = marker.getLngLat();
        const current = abearcMap.project(position);
        positions.forEach((point, photoId) => {
          if (photoId === id) return;
          const target = abearcMap.unproject({ x: point.x + current.x - start.x, y: point.y + current.y - start.y });
          abearcMapMovedPhotoPositions.set(photoId, [target.lng, target.lat]);
          abearcMapPhotoMarkers.get(`photo:${photoId}`)?.setLngLat(target);
        });
        abearcMapMovedPhotoPositions.set(id, [position.lng, position.lat]);
        renderAbearcMapMovedPhotoLeaders();
      };
      const onDragEnd = () => {
        onDrag();
        const position = marker.getLngLat();
        abearcMapMovedPhotoPositions.set(id, [position.lng, position.lat]);
        ids.forEach(photoId => abearcMapPhotoSuppressOpenUntil.set(photoId, Date.now() + 650));
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
      });
      toast(ids.length > 1 ? 'Drag any selected thumbnail to move and stick all selected photos together.' : 'Drag the thumbnail to move and stick it in place. Its GPS guide line follows.');
    }

    function resetAbearcMapThumbnailMoves() {
      closeAbearcMapPhotoContextMenu();
      finishAbearcMapThumbnailMoveMode();
      abearcMapMovedPhotoPositions.clear();
      abearcMapMovedPhotoSizes.clear();
      abearcMapPhotoSuppressOpenUntil.clear();
      renderAbearcMapPhotoMarkers();
      renderAbearcMapMovedPhotoLeaders();
    }

    function renderAbearcMapMovedPhotoLeaders() {
      renderAbearcMapPhotoAnnotations();
      const leaders = document.querySelector('[data-map-moved-photo-leader-layer]');
      if (!leaders || !abearcMap) return;
      leaders.innerHTML = '';
      if (!abearcMapPhotosVisible) return;
      leaders.setAttribute('viewBox', `0 0 ${Math.max(1, leaders.clientWidth)} ${Math.max(1, leaders.clientHeight)}`);
      const leadersRect = leaders.getBoundingClientRect();
      const canvasRect = abearcMap.getCanvas?.()?.getBoundingClientRect?.();
      const offsetX = canvasRect ? canvasRect.left - leadersRect.left : 0;
      const offsetY = canvasRect ? canvasRect.top - leadersRect.top : 0;
      abearcMapMovedPhotoPositions.forEach((position, id) => {
        const feature = featureById(id);
        if (!feature?.geometry?.coordinates || !Array.isArray(position)) return;
        const projectedOrigin = abearcMap.project(feature.geometry.coordinates);
        const origin = { x: projectedOrigin.x + offsetX, y: projectedOrigin.y + offsetY };
        let thumbnailAnchor = abearcMapPhotoFrameCenter(id, leaders);
        if (!thumbnailAnchor) {
          const callout = abearcMap.project(position);
          const expandedSize = abearcMapExpandedPhotos.get(id);
          const movedSize = ensureAbearcMapMovedPhotoSize(id);
          const worldSize = abearcMapPhotoWorldSize();
          const ratio = Number(expandedSize?.aspectRatio) > 0
            ? Number(expandedSize.aspectRatio)
            : Number(expandedSize?.width) > 0 && Number(expandedSize?.height) > 0
              ? Number(expandedSize.width) / Number(expandedSize.height)
              : 1;
          const photoHeight = expandedSize
            ? ((Number(expandedSize.mapWidth) > 0 ? Number(expandedSize.mapWidth) * worldSize : Number(expandedSize.width) || 260) / ratio)
            : ((Number(movedSize?.mapHeight) > 0 ? Number(movedSize.mapHeight) * worldSize : 44));
          thumbnailAnchor = { x: callout.x + offsetX, y: callout.y + offsetY - photoHeight / 2 };
        }
        ['abearc-map-photo-leader-casing', 'abearc-map-photo-leader-line'].forEach(className => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', origin.x);
          line.setAttribute('y1', origin.y);
          line.setAttribute('x2', thumbnailAnchor.x);
          line.setAttribute('y2', thumbnailAnchor.y);
          line.setAttribute('class', className);
          leaders.appendChild(line);
        });
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', origin.x);
        dot.setAttribute('cy', origin.y);
        dot.setAttribute('r', '3');
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
        if (abearcMapExploded.animated) line.style.animation = 'none';
        line.setAttribute('data-map-photo-id', String(featureId));
        line.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        line.oncontextmenu = event => openAbearcMapPhotoContextMenu(event, featureId, null, true);
        leaders.appendChild(line);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', origin.x);
        dot.setAttribute('cy', origin.y);
        dot.setAttribute('r', '4');
        dot.setAttribute('class', 'abearc-map-explosion-dot');
        dot.setAttribute('data-map-photo-id', String(featureId));
        dot.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        dot.oncontextmenu = event => openAbearcMapPhotoContextMenu(event, featureId, null, true);
        leaders.appendChild(dot);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `abearc-map-exploded-photo${abearcMapExploded.animated ? '' : ' is-animating'}${featureId === Number(abearcMapExploded.selectedId) || featureId === Number(abearcMapSelectedPhotoId) ? ' is-selected' : ''}`;
        btn.dataset.mapPhotoId = featureId;
        btn.classList.toggle('is-multi-selected', abearcMapSelectedPhotoIds.has(featureId));
        btn.classList.toggle('is-list-hovered', featureId === Number(abearcMapHoveredPhotoId));
        btn.style.left = `${pos.x}px`;
        btn.style.top = `${pos.y}px`;
        btn.style.setProperty('--explode-from-x', `${origin.x - pos.x}px`);
        btn.style.setProperty('--explode-from-y', `${origin.y - pos.y}px`);
        btn.title = feature.properties.category || 'Map photo';
        btn.onclick = (event) => {
          event.stopPropagation();
          if (event.ctrlKey || event.metaKey) return toggleAbearcMapPhotoGroupSelection([featureId]);
          if (abearcMapMeasureMode !== 'off') {
            if (event.detail > 1) return;
            return addAbearcMeasurePointAt(feature.geometry.coordinates);
          }
          abearcMapExploded.selectedId = featureId;
          openAbearcMapDetails(featureId);
          renderAbearcMapExplosion();
        };
        btn.ondblclick = (event) => {
          if (event.ctrlKey || event.metaKey) return;
          if (abearcMapMeasureMode === 'off') return;
          event.preventDefault();
          event.stopPropagation();
          deleteAbearcMeasurePointNear(feature.geometry.coordinates);
        };
        btn.oncontextmenu = event => {
          event.preventDefault();
          event.stopPropagation();
          openAbearcMapPhotoContextMenu(event, featureId);
        };
        const bearing = feature.properties?.bearing_deg ?? feature.bearing_deg;
        btn.innerHTML = feature.properties.thumbnail_url ? `<img alt="" src="${abearcAuthenticatedMediaUrl(feature.properties.thumbnail_url)}">${bearingArrowHtml(bearing, 'abearc-map-bearing-arrow--exploded')}` : `${abearcMarkerPlaceholder()}${bearingArrowHtml(bearing, 'abearc-map-bearing-arrow--exploded')}`;
        layer.appendChild(btn);
        if (abearcMapExploded.collapsingIds?.has(featureId)) {
          btn.classList.add('is-collapsing');
          line.style.animation = '';
          line.classList.add('is-collapsing');
          dot.classList.add('is-collapsing');
        }
      });
      abearcMapExploded.animated = true;
      renderAbearcMapPhotoAnnotations();
    }

    function collapseAbearcMapExplosionForMovement() {
      if (!abearcMapExploded || !abearcMapStartMovePoint) return;
      renderAbearcMapExplosion();
    }

    function finishAbearcMapExplosionCollapse(ids = null) {
      if (abearcMapExplosionCollapseTimer) {
        clearTimeout(abearcMapExplosionCollapseTimer);
        abearcMapExplosionCollapseTimer = null;
      }
      if (ids && abearcMapExploded) {
        abearcMapExploded.features = abearcMapExploded.features.filter(feature => !ids.has(Number(abearcFeatureId(feature))));
        abearcMapExploded.groups = (abearcMapExploded.groups || []).map(group => ({ ...group, ids: group.ids.filter(id => !ids.has(id)) })).filter(group => group.ids.length);
        ids.forEach(id => { abearcMapExploded.positions?.delete(id); abearcMapExploded.collapsingIds?.delete(id); });
        for (const flag of ['persistent', 'collapseOnAltRelease', 'collapseOnMapClick', 'collapseOnZoomOut']) {
          abearcMapExploded[flag] = abearcMapExploded.groups.some(group => group[flag]);
        }
        if (!abearcMapExploded.features.length) abearcMapExploded = null;
      } else abearcMapExploded = null;
      const layer = document.getElementById('abearcMapExplosionLayer');
      const leaders = document.getElementById('abearcMapLeaderLayer');
      if (leaders) leaders.classList.remove('is-collapsing');
      if (layer) layer.innerHTML = '';
      if (leaders) leaders.innerHTML = '';
      renderAbearcMapPhotoMarkers();
      renderAbearcMapExplosion();
      if (abearcMapExploded?.collapsingIds?.size) {
        abearcMapExplosionCollapseTimer = setTimeout(() => finishAbearcMapExplosionCollapse(abearcMapExploded?.collapsingIds || new Set()), 230);
      }
    }

    function collapseAbearcMapExplosion({ animate = true, featureId = null, reason = null } = {}) {
      if (!abearcMapExploded) return;
      const groups = abearcMapExploded.groups || [];
      const ids = new Set(featureId !== null
        ? (groups.find(group => group.ids.includes(featureId))?.ids || [featureId])
        : reason ? groups.filter(group => !group.persistent && group[reason]).flatMap(group => group.ids)
          : abearcMapExploded.features.map(feature => Number(abearcFeatureId(feature))));
      if (!ids.size) return;
      const layer = document.getElementById('abearcMapExplosionLayer');
      const leaders = document.getElementById('abearcMapLeaderLayer');
      if (!animate || !layer || !leaders || !layer.querySelector('.abearc-map-exploded-photo')) {
        finishAbearcMapExplosionCollapse(ids);
        return;
      }
      abearcMapExploded.collapsingIds ||= new Set();
      ids.forEach(id => abearcMapExploded.collapsingIds.add(id));
      renderAbearcMapExplosion();
      if (abearcMapExplosionCollapseTimer) clearTimeout(abearcMapExplosionCollapseTimer);
      abearcMapExplosionCollapseTimer = setTimeout(() => finishAbearcMapExplosionCollapse(abearcMapExploded?.collapsingIds || new Set()), 230);
    }

    function focusAbearcMapCoordinatesBesideDetails(coordinates, { duration = 260 } = {}) {
      if (!abearcMap) return;
      const longitude = Number(Array.isArray(coordinates) ? coordinates[0] : coordinates?.longitude ?? coordinates?.lng);
      const latitude = Number(Array.isArray(coordinates) ? coordinates[1] : coordinates?.latitude ?? coordinates?.lat);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
      const panel = document.getElementById('abearcMapDetails');
      const apply = (animationDuration = duration) => {
        if (!abearcMap) return;
        const canvasElement = abearcMap.getContainer?.();
        const canvas = canvasElement?.getBoundingClientRect?.();
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) return;
        let offset = [0, 0];
        if (panel && !panel.classList.contains('hidden')) {
          const details = panel.getBoundingClientRect();
          const bottomSheet = window.matchMedia('(max-width: 640px)').matches;
          if (bottomSheet) {
            const visibleHeight = Math.max(0, Math.min(canvas.height, details.top - canvas.top));
            offset = [0, (visibleHeight - canvas.height) / 2];
          } else {
            const visibleRight = Math.max(canvas.left, Math.min(canvas.right, details.left));
            const visibleWidth = Math.max(0, visibleRight - canvas.left);
            offset = [(visibleWidth - canvas.width) / 2, 0];
          }
        }
        abearcMap.easeTo({
          center: [longitude, latitude],
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          offset,
          duration: animationDuration,
          essential: true
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(() => apply(duration)));
      window.setTimeout(() => apply(160), 180);
    }

    function abearcMapTimelinePhotoDate(row = {}) {
      return formatAbearcMapDate(row.captured_at || row.uploaded_at);
    }

    function abearcMapTimelinePhotoUrl(row = {}) {
      return abearcAuthenticatedMediaUrl(row.original_url || row.thumbnail_url || '');
    }

    function syncAbearcMapSiteTimelineMarker(anchorId, row = {}) {
      const photoId = Number(anchorId);
      if (!Number.isFinite(photoId) || photoId <= 0 || !row) return;
      const marker = abearcMapPhotoMarkers.get(`photo:${photoId}`);
      const element = marker?.getElement?.();
      const frame = element?.querySelector?.('.abearc-map-photo-pin__frame');
      if (!frame) return;
      const thumbnailUrl = abearcAuthenticatedMediaUrl(row.thumbnail_url || row.original_url || '');
      let image = frame.querySelector('img');
      if (thumbnailUrl) {
        if (!image) {
          image = document.createElement('img');
          image.alt = '';
          frame.prepend(image);
        }
        if (image.src !== thumbnailUrl) image.src = thumbnailUrl;
      }
      frame.querySelector('.abearc-map-bearing-arrow')?.remove();
      const arrow = bearingArrowHtml(row.bearing_deg);
      if (arrow) frame.insertAdjacentHTML('beforeend', arrow);
      if (element) {
        const dateLabel = abearcMapTimelinePhotoDate(row);
        element.title = `${row.category || 'Geotag site'} · ${dateLabel}`;
      }
    }

    function renderAbearcMapTimelineFrame(panel, photos, index) {
      const safeIndex = Math.max(0, Math.min(photos.length - 1, Number(index) || 0));
      const row = photos[safeIndex];
      const image = panel.querySelector('[data-map-timeline-main-image]');
      const date = panel.querySelector('[data-map-timeline-current-date]');
      const meta = panel.querySelector('[data-map-timeline-current-meta]');
      const slider = panel.querySelector('[data-map-timeline-slider]');
      if (image) image.src = abearcMapTimelinePhotoUrl(row);
      if (date) date.textContent = abearcMapTimelinePhotoDate(row);
      if (meta) meta.textContent = [row.category, mapMediaLocationText(row)].filter(Boolean).join(' · ');
      if (slider) slider.value = String(safeIndex);
      panel.querySelectorAll('[data-map-timeline-thumb-index]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.mapTimelineThumbIndex) === safeIndex));
      const atStart = safeIndex <= 0;
      const atEnd = safeIndex >= photos.length - 1;
      panel.querySelectorAll('[data-map-timeline-prev], [data-map-timeline-image-prev]').forEach(button => { button.disabled = atStart; });
      panel.querySelectorAll('[data-map-timeline-next], [data-map-timeline-image-next]').forEach(button => { button.disabled = atEnd; });
      const deleteButton = panel.querySelector('[data-map-timeline-delete-current]');
      if (deleteButton) {
        const deletable = canDeleteAbearcMapPhoto(row) && !isProjectDocumentLinkedMapPhoto(row);
        deleteButton.classList.toggle('hidden', !deletable);
        deleteButton.disabled = !deletable;
        deleteButton.dataset.photoId = String(Number(row?.id) || '');
      }
      const anchorId = Number(panel.dataset.mapTimelineAnchorId);
      if (Number.isFinite(anchorId) && anchorId > 0) syncAbearcMapSiteTimelineMarker(anchorId, row);
    }

    function updateAbearcMapTimelineCompare(panel, photos) {
      const leftSelect = panel.querySelector('[data-map-compare-left]');
      const rightSelect = panel.querySelector('[data-map-compare-right]');
      const left = photos[Math.max(0, Math.min(photos.length - 1, Number(leftSelect?.value) || 0))];
      const right = photos[Math.max(0, Math.min(photos.length - 1, Number(rightSelect?.value) || photos.length - 1))];
      const leftImage = panel.querySelector('[data-map-compare-left-image]');
      const rightImage = panel.querySelector('[data-map-compare-right-image]');
      const leftDate = panel.querySelector('[data-map-compare-left-date]');
      const rightDate = panel.querySelector('[data-map-compare-right-date]');
      if (leftImage && left) leftImage.src = abearcMapTimelinePhotoUrl(left);
      if (rightImage && right) rightImage.src = abearcMapTimelinePhotoUrl(right);
      if (leftDate && left) leftDate.textContent = abearcMapTimelinePhotoDate(left);
      if (rightDate && right) rightDate.textContent = abearcMapTimelinePhotoDate(right);
    }

    async function deleteAbearcMapSiteTimelineObservation(panel, photos) {
      const slider = panel?.querySelector?.('[data-map-timeline-slider]');
      const index = Math.max(0, Math.min(photos.length - 1, Number(slider?.value) || 0));
      const row = photos[index];
      if (!row || !canDeleteAbearcMapPhoto(row) || isProjectDocumentLinkedMapPhoto(row)) return;
      const confirmed = await confirmModalChoice(
        'Permanently delete this observation photo? This cannot be undone.',
        { title: 'Delete Observation', confirmText: 'Delete photo' }
      );
      if (!confirmed) return;
      try {
        await fetchJson(`${API}/map/media/${Number(row.id)}`, { method: 'DELETE' });
        removeAbearcSavedPhotoIds([row.id]);
        const remaining = photos.filter(photo => Number(photo.id) !== Number(row.id));
        toast('Observation photo deleted');
        await reloadAbearcMap();
        if (!remaining.length) {
          closeAbearcMapDetails();
          return;
        }
        const nextIndex = Math.min(index, remaining.length - 1);
        await openAbearcMapSiteTimeline(remaining[nextIndex].id);
      } catch (error) {
        toast(error.message || 'Failed to delete observation photo.', 'error');
      }
    }

    async function openAbearcMapSiteTimeline(id) {
      const panel = document.getElementById('abearcMapDetails');
      if (!panel) return;
      abearcMapSelectedPhotoId = Number(id);
      panel.dataset.mapTimelineAnchorId = String(Number(id));
      panel.classList.remove('hidden');
      if (window.matchMedia('(max-width: 900px)').matches) toggleAbearcMapResults(false);
      const anchorFeature = featureById(id);
      if (anchorFeature?.geometry?.coordinates) focusAbearcMapCoordinatesBesideDetails(anchorFeature.geometry.coordinates);
      panel.innerHTML = `<div class="abearc-map-detail-shell"><header class="abearc-map-detail-head"><div><div class="abearc-map-detail-kicker">Site history</div><div class="abearc-map-detail-title">Loading timeline…</div></div><button type="button" data-map-details-close class="abearc-map-detail-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="abearc-map-detail-scroll"><div class="abearc-map-detail-body">Loading repeated observations near this site…</div></div></div>`;
      panel.querySelector('[data-map-details-close]')?.addEventListener('click', closeAbearcMapDetails);
      try {
        const data = await fetchJson(`${API}/map/media/${Number(id)}/site-series?radius_m=25`, { silentLoading: true });
        const photos = Array.isArray(data.photos) ? data.photos : [];
        if (photos.length <= 1) return openAbearcMapDetails(id);
        const latest = photos[photos.length - 1];
        const options = photos.map((row, index) => `<option value="${index}">${esc(abearcMapTimelinePhotoDate(row))}</option>`).join('');
        panel.innerHTML = `
          <div class="abearc-map-detail-shell abearc-map-timeline-shell">
            <header class="abearc-map-detail-head">
              <div>
                <div class="abearc-map-detail-kicker">Site history · ${photos.length} observations</div>
                <div class="abearc-map-detail-title">${esc(latest.category || 'Geotag site')}</div>
                <div class="abearc-map-detail-date">${esc(mapMediaLocationText(latest) || 'Same monitored location')}</div>
              </div>
              <button type="button" data-map-details-close class="abearc-map-detail-close" aria-label="Close site history" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18"/></svg></button>
            </header>
            <div class="abearc-map-detail-scroll">
              <div class="abearc-map-timeline-main">
                <div class="abearc-map-timeline-image-shell">
                  <button type="button" class="abearc-map-timeline-image" data-map-timeline-open-current title="Open current photo details"><img data-map-timeline-main-image alt="Selected site observation"></button>
                  <button type="button" class="abearc-map-timeline-image-step is-prev" data-map-timeline-image-prev aria-label="Previous observation" title="Previous observation">‹</button>
                  <button type="button" class="abearc-map-timeline-image-step is-next" data-map-timeline-image-next aria-label="Next observation" title="Next observation">›</button>
                </div>
                <div class="abearc-map-detail-photo-actions">
                  <strong data-map-timeline-current-date></strong>
                  <button type="button" class="abearc-map-detail-delete hidden" data-map-timeline-delete-current aria-label="Delete this observation" title="Delete this observation">${svgDelete}</button>
                </div>
                <span data-map-timeline-current-meta></span>
                <input data-map-timeline-slider type="range" min="0" max="${photos.length - 1}" value="${photos.length - 1}" step="1" aria-label="Site observation timeline">
                <div class="abearc-map-timeline-controls"><button type="button" data-map-timeline-prev>◀ Previous</button><button type="button" data-map-timeline-next>Next ▶</button></div>
                <div class="abearc-map-timeline-thumbs">${photos.map((row, index) => `<button type="button" data-map-timeline-thumb-index="${index}" title="${esc(abearcMapTimelinePhotoDate(row))}">${row.thumbnail_url ? `<img loading="lazy" decoding="async" alt="" src="${abearcAuthenticatedMediaUrl(row.thumbnail_url)}">` : abearcMarkerPlaceholder()}</button>`).join('')}</div>
              </div>
              <section class="abearc-map-timeline-compare">
                <div class="abearc-map-timeline-section-head"><strong>Compare observations</strong><span>Before / after</span></div>
                <div class="abearc-map-compare-grid">
                  <div><select data-map-compare-left>${options}</select><div class="abearc-map-compare-image"><img data-map-compare-left-image alt="Earlier observation"></div><span data-map-compare-left-date></span></div>
                  <div><select data-map-compare-right>${options}</select><div class="abearc-map-compare-image"><img data-map-compare-right-image alt="Later observation"></div><span data-map-compare-right-date></span></div>
                </div>
              </section>
            </div>
          </div>`;
        const slider = panel.querySelector('[data-map-timeline-slider]');
        const leftSelect = panel.querySelector('[data-map-compare-left]');
        const rightSelect = panel.querySelector('[data-map-compare-right]');
        leftSelect.value = '0'; rightSelect.value = String(photos.length - 1);
        const renderCurrent = index => renderAbearcMapTimelineFrame(panel, photos, index);
        const stepCurrent = direction => renderCurrent(Number(slider.value) + (Number(direction) < 0 ? -1 : 1));
        slider.addEventListener('input', () => renderCurrent(Number(slider.value)));
        panel.querySelectorAll('[data-map-timeline-prev], [data-map-timeline-image-prev]').forEach(button => button.addEventListener('click', () => stepCurrent(-1)));
        panel.querySelectorAll('[data-map-timeline-next], [data-map-timeline-image-next]').forEach(button => button.addEventListener('click', () => stepCurrent(1)));
        panel.querySelectorAll('[data-map-timeline-thumb-index]').forEach(button => button.addEventListener('click', () => renderCurrent(Number(button.dataset.mapTimelineThumbIndex))));
        panel.querySelector('[data-map-timeline-open-current]').addEventListener('click', () => openAbearcMapDetails(photos[Number(slider.value)]?.id));
        panel.querySelector('[data-map-timeline-delete-current]')?.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          deleteAbearcMapSiteTimelineObservation(panel, photos);
        });
        panel.addEventListener('keydown', event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
          if (event.key === 'ArrowLeft') { event.preventDefault(); stepCurrent(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); stepCurrent(1); }
        });
        leftSelect.addEventListener('change', () => updateAbearcMapTimelineCompare(panel, photos));
        rightSelect.addEventListener('change', () => updateAbearcMapTimelineCompare(panel, photos));
        panel.querySelector('[data-map-details-close]').addEventListener('click', closeAbearcMapDetails);
        renderCurrent(photos.length - 1);
        updateAbearcMapTimelineCompare(panel, photos);
        focusAbearcMapCoordinatesBesideDetails([latest.longitude, latest.latitude]);
      } catch (error) {
        panel.innerHTML = `<div class="abearc-map-detail-shell"><header class="abearc-map-detail-head"><div><div class="abearc-map-detail-kicker">Site history</div><div class="abearc-map-detail-title">Timeline unavailable</div></div><button type="button" data-map-details-close class="abearc-map-detail-close" aria-label="Close">×</button></header><div class="abearc-map-detail-body">${esc(error.message || 'Could not load the site timeline.')}</div></div>`;
        panel.querySelector('[data-map-details-close]')?.addEventListener('click', closeAbearcMapDetails);
      }
    }

    async function openAbearcMapDetails(id) {
      if (abearcMapPhotoSelectionMode && abearcMapSelectedPhotoIds.size > 1) return;
      const panel = document.getElementById('abearcMapDetails');
      if (!panel) return;
      abearcMapSelectedPhotoId = Number(id);
      delete panel.dataset.mapTimelineAnchorId;
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
        if (abearcMapSelectedPhotoId !== Number(id) || abearcMapSelectedPhotoIds.size > 1) return;
        const locationText = mapMediaLocationText(row);
        const remarksText = mapMediaRemarksText(row);
        const photoUrl = row.original_url || row.thumbnail_url || '';
        const latitude = Number(row.latitude);
        const longitude = Number(row.longitude);
        const canManage = canManageAbearcMapPhoto(row);
        const canDelete = canDeleteAbearcMapPhoto(row);
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
                  ${canDelete && !sourceProtected ? `<button type="button" data-map-delete-photo class="abearc-map-detail-delete" aria-label="Delete photo" title="Delete photo">
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
        focusAbearcMapCoordinatesBesideDetails([longitude, latitude]);
      } catch (e) {
        panel.innerHTML = `<div class="p-4 text-sm text-red-700 dark:text-red-300">${esc(e.message || 'Failed to load photo details')}</div>`;
      }
    }

    function closeAbearcMapDetails() {
      const panel = document.getElementById('abearcMapDetails');
      panel?.classList.add('hidden');
      if (panel) delete panel.dataset.mapTimelineAnchorId;
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
          <button type="button" class="abearc-map-list-open" onclick="${Number(f.properties.site_series_count || 1) > 1 ? `openAbearcMapSiteTimeline(${id})` : `openAbearcMapResultPhoto(event, ${id})`}" ondblclick="zoomAbearcMapPhotoToTenMeterScale(event, ${id})">
            <span class="abearc-map-list-thumb">
              ${f.properties.thumbnail_url ? `<img loading="lazy" decoding="async" alt="" src="${abearcAuthenticatedMediaUrl(f.properties.thumbnail_url)}">` : abearcMarkerPlaceholder()}
            </span>
            <span class="abearc-map-list-content">
              <span class="abearc-map-list-title">${esc(f.properties.category || 'General')}${Number(f.properties.site_series_count || 1) > 1 ? ` <span class="abearc-map-series-chip">${Number(f.properties.site_series_count)} observations</span>` : ''}</span>
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
      if (abearcMapAdministrativeMeasureActive) {
        abearcMapAdministrativeMeasureActive = false;
        abearcMapAdministrativeMeasurePreviousState = null;
      }
      if (window.startAbearcMultiMeasurementMode?.(mode)) return;
      rememberAbearcMapMeasureState();
      abearcMapMeasureMode = !abearcMapImportedPolygons.length && abearcMapMeasureMode === mode ? 'off' : mode;
      abearcMapMeasurePoints = [];
      abearcMapImportedPolygons = [];
      abearcMapSelectedImportedPolygons.clear();
      abearcMapImportedPolygonContextIndex = null;
      abearcMapEditingImportedPolygonIndex = null;
      abearcMapHiddenMeasurePointIndexes.clear();
      abearcMapElevationAnnotations.clear();
      abearcMapLastTouchedMeasureIndex = null;
      saveAbearcMapMeasure();
      resetAbearcElevationProfile();
      updateAbearcMapMeasureTools();
      renderAbearcMapMeasure();
      toast(abearcMapMeasureMode === 'off' ? 'Ruler off' : `${abearcMapMeasureMode === 'area' ? 'Area' : 'Distance'} ruler on`);
    }

    function clearAbearcMapMeasure() {
      if (abearcMapAdministrativeMeasureActive) {
        abearcMapAdministrativeMeasureActive = false;
        abearcMapAdministrativeMeasurePreviousState = null;
      }
      if (window.clearSelectedAbearcMapMeasurement?.()) return;
      const hadMeasurement = abearcMapMeasurePoints.length > 0 || Boolean(abearcMapContourData?.imported);
      if (hadMeasurement) rememberAbearcMapMeasureState();
      abearcMapMeasurePoints = [];
      abearcMapImportedPolygons = [];
      abearcMapSelectedImportedPolygons.clear();
      abearcMapImportedPolygonContextIndex = null;
      abearcMapEditingImportedPolygonIndex = null;
      abearcMapHiddenMeasurePointIndexes.clear();
      abearcMapElevationAnnotations.clear();
      abearcMapLastTouchedMeasureIndex = null;
      if (abearcMapContourData?.imported) closeAbearcContourLines(false);
      removeSavedAbearcMapMeasure();
      resetAbearcElevationProfile();
      updateAbearcMapMeasureTools();
      renderAbearcMapMeasure();
      if (hadMeasurement) toast('Measurement cleared');
    }

    async function importAbearcMapMeasureKml(event) {
      if (abearcMapAdministrativeMeasureActive) {
        abearcMapAdministrativeMeasureActive = false;
        abearcMapAdministrativeMeasurePreviousState = null;
      }
      const input = event.currentTarget;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        if (!/\.kml$/i.test(file.name)) throw new Error('Choose a KML file.');
        if (file.size > 5 * 1024 * 1024) throw new Error('KML files must be 5 MB or smaller.');
        const documentXml = new DOMParser().parseFromString(await file.text(), 'application/xml');
        if (documentXml.getElementsByTagName('parsererror').length) throw new Error('The KML file is not valid XML.');
        const elements = Array.from(documentXml.getElementsByTagName('*'));
        const documentElement = elements.find(element => element.localName === 'Document');
        const documentName = Array.from(documentElement?.children || [])
          .find(element => element.localName === 'name')?.textContent?.trim();
        const contourKml = documentName === 'ABEARC contour lines';
        const polygonElements = elements.filter(element => element.localName === 'Polygon');
        const lineElements = elements.filter(element => element.localName === 'LineString');
        const geometryElements = polygonElements.length
          ? polygonElements
          : lineElements.slice(0, contourKml ? lineElements.length : 1);
        if (!geometryElements.length) throw new Error('No KML LineString or Polygon was found.');
        let totalPoints = 0;
        const geometries = geometryElements.map((geometry, index) => {
          const coordinatesElement = Array.from(geometry.getElementsByTagName('*'))
            .find(element => element.localName === 'coordinates');
          if (!coordinatesElement) throw new Error('A KML geometry has no coordinates.');
          const tokens = coordinatesElement.textContent.trim().split(/\s+/).filter(Boolean);
          totalPoints += tokens.length;
          const pointLimit = contourKml ? 50000 : 1000;
          if (tokens.length > pointLimit || totalPoints > pointLimit) throw new Error(`KML measurements are limited to ${pointLimit.toLocaleString()} points.`);
          const altitudes = [];
          const points = tokens.map(token => {
            const [longitude, latitude, altitude] = token.split(',').map(Number);
            if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
                || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
              throw new Error('The KML contains an invalid coordinate.');
            }
            altitudes.push(Number.isFinite(altitude) ? altitude : null);
            return [longitude, latitude];
          });
          const area = geometry.localName === 'Polygon';
          if (area && points.length > 1
              && Math.abs(points[0][0] - points[points.length - 1][0]) < 1e-10
              && Math.abs(points[0][1] - points[points.length - 1][1]) < 1e-10) points.pop();
          if (points.length < (area ? 3 : 2)) throw new Error(`A KML ${area ? 'polygon' : 'line'} has too few points.`);
          let placemark = geometry.parentElement;
          while (placemark && placemark.localName !== 'Placemark') placemark = placemark.parentElement;
          const nameElement = placemark && Array.from(placemark.children)
            .find(element => element.localName === 'name');
          const styleUrl = placemark && Array.from(placemark.children)
            .find(element => element.localName === 'styleUrl')?.textContent?.trim();
          return {
            name: String(nameElement?.textContent || `${area ? 'Polygon' : 'Line'} ${index + 1}`).trim().slice(0, 120),
            points,
            level: altitudes.find(Number.isFinite),
            index: styleUrl === '#index'
          };
        });
        const area = polygonElements.length > 0;
        if (abearcMapMeasurePoints.length || abearcMapContourData?.imported) {
          const confirmed = await confirmModalChoice(
            contourKml
              ? `Replace the current imported contour lines with these ${geometries.length} contour lines?`
              : `Keep the current measurement and import ${geometries.length === 1 ? 'this KML geometry' : `these ${geometries.length} KML polygons`} as another measurement?`,
            { title: 'Import Measurement KML', confirmText: 'Import KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
          );
          if (!confirmed) return;
        }
        rememberAbearcMapMeasureState();
        if (contourKml) {
          if (geometries.some(geometry => !Number.isFinite(geometry.level))) throw new Error('A contour line has no valid elevation value.');
          abearcMapMeasureMode = 'off';
          abearcMapMeasurePoints = [];
          abearcMapImportedPolygons = [];
          abearcMapSelectedImportedPolygons.clear();
          abearcMapEditingImportedPolygonIndex = null;
          abearcMapHiddenMeasurePointIndexes.clear();
          abearcMapElevationAnnotations.clear();
          abearcMapLastTouchedMeasureIndex = null;
          abearcMapContourData = {
            imported: true,
            paths: geometries.map(geometry => ({ level: geometry.level, index: geometry.index, points: geometry.points }))
          };
          removeSavedAbearcMapMeasure();
          closeAbearcElevationProfile();
          toggleAbearcMapMeasureTools(true);
          renderAbearcMapMeasure();
          const allPoints = geometries.flatMap(geometry => geometry.points);
          fitAbearcMapToSearchResults(allPoints.map(coordinates => ({ geometry: { coordinates } })));
          toast(`${geometries.length} georeferenced contour lines imported from KML`);
          return;
        }
        window.prepareAbearcMultiMeasurementImport?.(area ? 'area' : 'distance', geometries.length === 1 ? geometries[0].name : (documentName || `Imported ${geometries.length} polygons`));
        abearcMapMeasureMode = area ? 'area' : 'distance';
        abearcMapMeasurePoints = geometries[0].points;
        abearcMapImportedPolygons = area && geometries.length > 1 ? geometries : [];
        abearcMapSelectedImportedPolygons.clear();
        abearcMapImportedPolygonContextIndex = null;
        abearcMapEditingImportedPolygonIndex = null;
        abearcMapHiddenMeasurePointIndexes.clear();
        abearcMapElevationAnnotations.clear();
        abearcMapLastTouchedMeasureIndex = abearcMapMeasurePoints.length - 1;
        resetAbearcElevationProfile();
        saveAbearcMapMeasure();
        toggleAbearcMapMeasureTools(true);
        renderAbearcMapMeasure();
        const allPoints = geometries.flatMap(geometry => geometry.points);
        fitAbearcMapToSearchResults(allPoints.map(coordinates => ({ geometry: { coordinates } })));
        toast(geometries.length > 1 ? `${geometries.length} individual polygons imported from KML` : `${area ? 'Area' : 'Distance'} measurement imported from KML`);
      } catch (error) {
        toast(error.message || 'Could not import the KML measurement.', 'error');
      } finally {
        input.value = '';
      }
    }

    function minimizeIdleAbearcMapMeasureTools() {
      if (abearcMapMeasureMode === 'off') toggleAbearcMapMeasureTools(false);
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
      if (clearButton) clearButton.disabled = abearcMapMeasurePoints.length === 0 && !abearcMapContourData?.imported;
      const status = document.querySelector('[data-map-measure-status]');
      if (!status) return;
      if (abearcMapImportedPolygons.length) {
        const selected = abearcMapSelectedImportedPolygons.size;
        status.textContent = Number.isInteger(abearcMapEditingImportedPolygonIndex)
          ? 'Editing polygon'
          : selected
          ? `${selected} of ${abearcMapImportedPolygons.length} polygons selected`
          : `${abearcMapImportedPolygons.length} polygons`;
      } else if (abearcMapContourData?.imported) status.textContent = `${abearcMapContourData.paths.length} contour lines`;
      else if (abearcMapMeasureMode === 'off') status.textContent = 'Choose a tool';
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
      window.renderAbearcMeasurementManager?.();
    }

    function insertAbearcMeasurePoint(point) {
      rememberAbearcMapMeasureState();
      const selectedIndex = Number.isInteger(abearcMapLastTouchedMeasureIndex)
        && abearcMapLastTouchedMeasureIndex >= 0
        && abearcMapLastTouchedMeasureIndex < abearcMapMeasurePoints.length
        ? abearcMapLastTouchedMeasureIndex : abearcMapMeasurePoints.length - 1;
      const insertionIndex = selectedIndex + 1;
      window.adjustAbearcGravityPathEndpoint?.(insertionIndex, 1);
      abearcMapMeasurePoints.splice(insertionIndex, 0, point);
      abearcMapHiddenMeasurePointIndexes = new Set([...abearcMapHiddenMeasurePointIndexes]
        .map(index => index >= insertionIndex ? index + 1 : index));
      abearcMapElevationAnnotations = new Map([...abearcMapElevationAnnotations]
        .map(([index, annotation]) => [index >= insertionIndex ? index + 1 : index, annotation]));
      abearcMapLastTouchedMeasureIndex = insertionIndex;
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function addAbearcMeasurePoint(lngLat) {
      insertAbearcMeasurePoint([lngLat.lng, lngLat.lat]);
    }

    function addAbearcMeasurePointAt(coordinates) {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      insertAbearcMeasurePoint([lng, lat]);
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
        removeAbearcMeasurePointAt(bestIndex);
      }
    }

    function removeAbearcMeasurePointAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= abearcMapMeasurePoints.length) return;
      rememberAbearcMapMeasureState();
      window.adjustAbearcGravityPathEndpoint?.(index, -1);
      abearcMapMeasurePoints.splice(index, 1);
      abearcMapHiddenMeasurePointIndexes = new Set([...abearcMapHiddenMeasurePointIndexes]
        .filter(hiddenIndex => hiddenIndex !== index)
        .map(hiddenIndex => hiddenIndex > index ? hiddenIndex - 1 : hiddenIndex));
      abearcMapElevationAnnotations = new Map([...abearcMapElevationAnnotations]
        .filter(([annotationIndex]) => annotationIndex !== index)
        .map(([annotationIndex, annotation]) => [annotationIndex > index ? annotationIndex - 1 : annotationIndex, annotation]));
      if (abearcMapLastTouchedMeasureIndex === index) abearcMapLastTouchedMeasureIndex = abearcMapMeasurePoints.length ? Math.min(index, abearcMapMeasurePoints.length - 1) : null;
      else if (abearcMapLastTouchedMeasureIndex > index) abearcMapLastTouchedMeasureIndex--;
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
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
      if (event.button !== 0) return;
      closeAbearcMapMeasureContextMenu();
      event.preventDefault();
      event.stopPropagation();
      abearcMapDraggingMeasureIndex = index;
      abearcMapMeasureDragUndoSaved = false;
      selectAbearcMeasurePoint(index);
      abearcMap?.dragPan?.disable();
      window.addEventListener('pointermove', dragAbearcMeasurePoint);
      window.addEventListener('pointerup', stopAbearcMeasureDrag, { once: true });
    }

    function dragAbearcMeasurePoint(event) {
      if (abearcMapDraggingMeasureIndex === null || !abearcMap) return;
      if (!abearcMapMeasureDragUndoSaved) {
        rememberAbearcMapMeasureState();
        abearcMapMeasureDragUndoSaved = true;
      }
      const rect = abearcMap.getCanvasContainer().getBoundingClientRect();
      const lngLat = abearcMap.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      abearcMapMeasurePoints[abearcMapDraggingMeasureIndex] = [lngLat.lng, lngLat.lat];
      renderAbearcMapMeasure();
    }

    function stopAbearcMeasureDrag() {
      if (abearcMapDraggingMeasureIndex !== null) saveAbearcMapMeasure();
      abearcMapDraggingMeasureIndex = null;
      abearcMapMeasureDragUndoSaved = false;
      abearcMap?.dragPan?.enable();
      window.removeEventListener('pointermove', dragAbearcMeasurePoint);
    }

    function deleteAbearcMeasurePoint(event, index) {
      event.preventDefault();
      event.stopPropagation();
      removeAbearcMeasurePointAt(index);
    }

    function openAbearcMapMeasurePointContextMenu(event, index) {
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapMeasureContextMenu();
      closeAbearcMapPhotoContextMenu();
      const menu = document.getElementById('abearcMapMeasurePointContextMenu');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      abearcMapMeasurePointContextIndex = index;
      const annotationLabel = menu.querySelector('[data-map-point-annotation-label]');
      if (annotationLabel) annotationLabel.textContent = abearcMapElevationAnnotations.has(index) ? 'Edit annotation' : 'Add annotation';
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 216;
      const height = menu.offsetHeight || 84;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function editAbearcMeasurePointAnnotationFromMenu() {
      const index = abearcMapMeasurePointContextIndex;
      closeAbearcMapMeasureContextMenu();
      editAbearcMeasurePointAnnotation(index);
    }

    function editAbearcMeasurePointAnnotation(index) {
      if (!Number.isInteger(index) || index < 0 || index >= abearcMapMeasurePoints.length) return;
      const current = abearcMapElevationAnnotations.get(index);
      openAbearcMapEditModal('elevation-annotation', current?.text || '', value => {
        const text = String(value || '').trim();
        if (!text) throw new Error('Enter annotation text.');
        rememberAbearcMapMeasureState();
        abearcMapElevationAnnotations.set(index, {
          text: text.slice(0, 80),
          dx: current?.dx ?? 22,
          dy: current?.dy ?? -22,
          mapDx: current?.mapDx ?? 22,
          mapDy: current?.mapDy ?? -22
        });
        saveAbearcMapMeasure();
        renderAbearcMapMeasure();
        if (abearcMapElevationProfileData.length > 1) renderAbearcElevationProfile(abearcMapElevationProfileData);
      });
    }

    function hideAbearcMeasurePointMarker() {
      const index = abearcMapMeasurePointContextIndex;
      if (!Number.isInteger(index)) return;
      rememberAbearcMapMeasureState();
      abearcMapHiddenMeasurePointIndexes.add(index);
      abearcMapElevationAnnotations.delete(index);
      abearcMapLastTouchedMeasureIndex = null;
      closeAbearcMapMeasureContextMenu();
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
      document.querySelectorAll(`.abearc-map-elevation-point[data-measure-point-index="${index}"], .abearc-map-elevation-annotation[data-measure-point-index="${index}"]`).forEach(point => point.remove());
      toast('Point marker removed; line shape preserved.');
    }

    function removeAbearcMeasurePointFromMenu() {
      const index = abearcMapMeasurePointContextIndex;
      closeAbearcMapMeasureContextMenu();
      removeAbearcMeasurePointAt(index);
      toast('Point removed; line reconnected.');
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
      const panel = document.getElementById('abearcMapElevationProfile');
      panel?.classList.add('hidden');
      panel?.classList.remove('is-updating');
      panel?.removeAttribute('aria-busy');
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

    function setupAbearcFloatingMapPanelDrag(panelId, handleSelector) {
      const panel = document.getElementById(panelId);
      const handle = panel?.querySelector(handleSelector);
      const stage = document.querySelector('#mapPage .abearc-map-stage');
      if (!panel || !handle || !stage || handle.dataset.dragReady === '1') return;
      handle.dataset.dragReady = '1';
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button, details, summary, input, select, a')) return;
        event.preventDefault();
        event.stopPropagation();
        const stageBounds = stage.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const startX = event.clientX; const startY = event.clientY;
        const startLeft = panelBounds.left - stageBounds.left; const startTop = panelBounds.top - stageBounds.top;
        handle.setPointerCapture(event.pointerId);
        handle.classList.add('is-dragging');
        const move = moveEvent => {
          const left = Math.max(8, Math.min(stage.clientWidth - panel.offsetWidth - 8, startLeft + moveEvent.clientX - startX));
          const top = Math.max(8, Math.min(stage.clientHeight - panel.offsetHeight - 8, startTop + moveEvent.clientY - startY));
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        };
        const stop = () => {
          handle.classList.remove('is-dragging');
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', stop);
          handle.removeEventListener('pointercancel', stop);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
      });
    }

    function showAbearcElevationProfile() {
      closeAbearcMapMeasureContextMenu();
      if (!canShowAbearcElevationProfile()) {
        return toast('Complete a distance line or area measurement first.', 'error');
      }
      closeAbearcContourLines();
      abearcMapElevationVisible = true;
      abearcMapElevationKey = '';
      refreshAbearcElevationProfile(true);
    }

    function abearcContourPolygonKey(points = abearcMapMeasurePoints) {
      return points.map(point => point.map(value => Number(value).toFixed(6)).join(',')).join('|');
    }

    function abearcContourPolygons() {
      if (abearcMapImportedPolygons.length && abearcMapSelectedImportedPolygons.size) {
        return [...abearcMapSelectedImportedPolygons]
          .sort((a, b) => a - b)
          .map(index => abearcMapImportedPolygons[index]?.points)
          .filter(points => points?.length > 2);
      }
      return abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2 ? [abearcMapMeasurePoints] : [];
    }

    function abearcContourSelectionKey(polygons = abearcContourPolygons()) {
      return polygons.map(abearcContourPolygonKey).join('||');
    }

    function abearcLngLatPointInPolygon(point, polygon) {
      let inside = false;
      for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const a = polygon[index], b = polygon[previous];
        if ((a[1] > point[1]) !== (b[1] > point[1])
            && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    }

    function abearcContourInterval(minimum, maximum) {
      const rough = Math.max(1, (maximum - minimum) / 10);
      const magnitude = 10 ** Math.floor(Math.log10(rough));
      const normalized = rough / magnitude;
      return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    }

    function stitchAbearcContourSegments(segments) {
      const groups = new Map();
      const pointKey = point => `${point[0].toFixed(8)},${point[1].toFixed(8)}`;
      segments.forEach(segment => {
        const key = `${segment.level}/${segment.index ? 1 : 0}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(segment);
      });
      const paths = [];
      groups.forEach(group => {
        const unused = new Set(group.map((_, index) => index));
        const connections = new Map();
        group.forEach((segment, index) => segment.points.forEach(point => {
          const key = pointKey(point);
          if (!connections.has(key)) connections.set(key, []);
          connections.get(key).push(index);
        }));
        const walk = (startIndex, startKey) => {
          const points = [];
          let segmentIndex = startIndex;
          let currentKey = startKey;
          while (unused.has(segmentIndex)) {
            const segment = group[segmentIndex];
            const firstKey = pointKey(segment.points[0]);
            const from = firstKey === currentKey ? segment.points[0] : segment.points[1];
            const to = firstKey === currentKey ? segment.points[1] : segment.points[0];
            if (!points.length) points.push(from);
            points.push(to);
            unused.delete(segmentIndex);
            currentKey = pointKey(to);
            const next = (connections.get(currentKey) || []).find(index => unused.has(index));
            if (next === undefined) break;
            segmentIndex = next;
          }
          if (points.length > 1) paths.push({ level: group[startIndex].level, index: group[startIndex].index, points });
        };
        connections.forEach((indexes, key) => {
          if (indexes.length === 1 && unused.has(indexes[0])) walk(indexes[0], key);
        });
        while (unused.size) {
          const index = unused.values().next().value;
          walk(index, pointKey(group[index].points[0]));
        }
      });
      return paths;
    }

    function buildAbearcContourData(grid, columns, rows, polygon, requestedInterval = null, requestedIndexInterval = null) {
      const elevations = abearcMapAnalysis.interiorElevations(grid, polygon);
      if (elevations.length < 2) throw new Error('The polygon is too narrow for the available contour grid.');
      const minimum = Math.min(...elevations);
      const maximum = Math.max(...elevations);
      const interval = Number(requestedInterval) > 0 ? Number(requestedInterval) : abearcContourInterval(minimum, maximum);
      const indexInterval = Number(requestedIndexInterval) >= interval ? Number(requestedIndexInterval) : interval * 5;
      const segments = [];
      const crossing = (a, b, level) => {
        if ((a.elevation < level) === (b.elevation < level)) return null;
        const ratio = (level - a.elevation) / (b.elevation - a.elevation);
        return [
          a.longitude + (b.longitude - a.longitude) * ratio,
          a.latitude + (b.latitude - a.latitude) * ratio
        ];
      };
      const addSegment = (level, a, b) => {
        const deltaX = b[0] - a[0], deltaY = b[1] - a[1];
        const cuts = [0, 1];
        polygon.forEach((start, index) => {
          const end = polygon[(index + 1) % polygon.length];
          const edgeX = end[0] - start[0], edgeY = end[1] - start[1];
          const denominator = deltaX * edgeY - deltaY * edgeX;
          if (Math.abs(denominator) < 1e-12) return;
          const offsetX = start[0] - a[0], offsetY = start[1] - a[1];
          const distance = (offsetX * edgeY - offsetY * edgeX) / denominator;
          const edgeDistance = (offsetX * deltaY - offsetY * deltaX) / denominator;
          if (distance > 0 && distance < 1 && edgeDistance >= 0 && edgeDistance <= 1) cuts.push(distance);
        });
        cuts.sort((left, right) => left - right);
        for (let index = 1; index < cuts.length; index++) {
          const start = cuts[index - 1], end = cuts[index];
          const midpoint = (start + end) / 2;
          const middlePoint = [a[0] + deltaX * midpoint, a[1] + deltaY * midpoint];
          if (!abearcLngLatPointInPolygon(middlePoint, polygon)) continue;
          segments.push({
            level,
            index: Math.abs(level / indexInterval - Math.round(level / indexInterval)) < 1e-6,
            points: [
              [a[0] + deltaX * start, a[1] + deltaY * start],
              [a[0] + deltaX * end, a[1] + deltaY * end]
            ]
          });
        }
      };
      for (let rawLevel = Math.ceil(minimum / interval) * interval; rawLevel < maximum; rawLevel += interval) {
        const level = Number(rawLevel.toFixed(6));
        for (let row = 0; row < rows - 1; row++) {
          for (let column = 0; column < columns - 1; column++) {
            const topLeft = grid[row * columns + column];
            const topRight = grid[row * columns + column + 1];
            const bottomRight = grid[(row + 1) * columns + column + 1];
            const bottomLeft = grid[(row + 1) * columns + column];
            const edges = [
              crossing(topLeft, topRight, level),
              crossing(topRight, bottomRight, level),
              crossing(bottomRight, bottomLeft, level),
              crossing(bottomLeft, topLeft, level)
            ];
            const hits = edges.map((point, edge) => point && { point, edge }).filter(Boolean);
            if (hits.length === 2) addSegment(level, hits[0].point, hits[1].point);
            if (hits.length === 4) {
              const center = (topLeft.elevation + topRight.elevation + bottomRight.elevation + bottomLeft.elevation) / 4;
              const pairs = center >= level ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
              pairs.forEach(([a, b]) => addSegment(level, edges[a], edges[b]));
            }
          }
        }
      }
      return { minimum, maximum, interval, indexInterval, segments, paths: stitchAbearcContourSegments(segments) };
    }

    function buildAbearcContourSurfaces(surfaces, requestedInterval = null, requestedIndexInterval = null) {
      const elevations = surfaces.flatMap(surface => abearcMapAnalysis.interiorElevations(surface.grid, surface.polygon));
      if (elevations.length < 2) throw new Error('The selected polygons contain too few interior terrain samples.');
      const minimum = Math.min(...elevations);
      const maximum = Math.max(...elevations);
      const interval = Number(requestedInterval) > 0 ? Number(requestedInterval) : abearcContourInterval(minimum, maximum);
      const indexInterval = Number(requestedIndexInterval) >= interval ? Number(requestedIndexInterval) : interval * 5;
      const built = surfaces.map(surface => ({
        ...surface,
        ...buildAbearcContourData(surface.grid, surface.columns, surface.rows, surface.polygon, interval, indexInterval)
      }));
      return {
        minimum,
        maximum,
        interval,
        indexInterval,
        segments: built.flatMap(surface => surface.segments),
        paths: built.flatMap(surface => surface.paths),
        surfaces: built,
        sampleCount: built.reduce((sum, surface) => sum + surface.grid.length, 0),
        effectiveSpacingM: Math.max(...built.map(surface => surface.effectiveSpacingM)),
        sourceResolutionM: built[0]?.sourceResolutionM
      };
    }

    function setupAbearcContourControls() {
      const panel = document.getElementById('abearcMapContourPanel');
      if (!panel) return;
      let selectedLabel = '';
      panel.querySelectorAll('[data-map-contour-source-option]').forEach(button => {
        const selected = button.dataset.mapContourSourceOption === abearcMapContourSource;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
        if (selected) selectedLabel = button.querySelector('strong')?.textContent?.trim() || '';
      });
      const interval = panel.querySelector('[data-map-contour-interval]');
      const indexInterval = panel.querySelector('[data-map-contour-index-interval]');
      if (interval && abearcMapContourInterval) interval.value = abearcMapContourInterval;
      if (indexInterval && abearcMapContourIndexInterval) indexInterval.value = abearcMapContourIndexInterval;
      const sourceOutput = panel.querySelector('[data-map-contour-source]');
      if (sourceOutput && selectedLabel) {
        sourceOutput.textContent = selectedLabel;
        sourceOutput.title = selectedLabel;
      }
    }

    function renderAbearcContourPanel() {
      const panel = document.getElementById('abearcMapContourPanel');
      const body = panel?.querySelector('[data-map-contour-results]');
      if (!panel || !body || !abearcMapContourData) return;
      setupAbearcContourControls();
      const contour = abearcMapContourData;
      const sourceOutput = panel.querySelector('[data-map-contour-source]');
      if (sourceOutput) sourceOutput.textContent = contour.sourceLabel;
      panel.querySelector('[data-map-contour-interval]').value = contour.interval;
      panel.querySelector('[data-map-contour-index-interval]').value = contour.indexInterval;
      const controls = panel.querySelector('.abearc-map-contour-controls');
      controls?.classList.remove('is-dirty');
      const applyButton = controls?.querySelector('[data-map-contour-apply]');
      if (applyButton) applyButton.disabled = true;
      body.innerHTML = `
        <div class="abearc-map-contour-metrics">
          <span><small>Low</small><strong>${Math.round(contour.minimum)} m</strong></span>
          <span><small>High</small><strong>${Math.round(contour.maximum)} m</strong></span>
          <span><small>Relief</small><strong>${Math.round(contour.maximum - contour.minimum)} m</strong></span>
        </div>
        <div class="abearc-map-contour-legend">
          <span><i class="is-regular"></i>Contour · ${contour.interval} m</span>
          <span><i class="is-index"></i>Index contour · ${contour.indexInterval} m</span>
          <b>${contour.surfaces.length} polygon${contour.surfaces.length === 1 ? '' : 's'} · ${contour.sampleCount.toLocaleString()} samples · ${contour.effectiveSpacingM < 10 ? contour.effectiveSpacingM.toFixed(1) : Math.round(contour.effectiveSpacingM)} m grid</b>
        </div>`;
      panel.dataset.state = 'ready';
    }

    function applyAbearcContourSettings() {
      rememberAbearcMapLayoutChange();
      if (!abearcMapContourData?.surfaces?.length) return toast('Generate contour lines first.', 'error');
      const panel = document.getElementById('abearcMapContourPanel');
      const interval = Number(panel?.querySelector('[data-map-contour-interval]')?.value);
      const indexInterval = Number(panel?.querySelector('[data-map-contour-index-interval]')?.value);
      if (!(interval > 0) || !(indexInterval >= interval)) {
        return toast('Enter valid intervals; the index interval must be at least the contour interval.', 'error');
      }
      if ((abearcMapContourData.maximum - abearcMapContourData.minimum) / interval > 200) {
        const minimumInterval = Math.ceil((abearcMapContourData.maximum - abearcMapContourData.minimum) / 200 * 2) / 2;
        return toast(`Use a contour interval of at least ${minimumInterval} m for this terrain range.`, 'error');
      }
      const multiple = indexInterval / interval;
      if (Math.abs(multiple - Math.round(multiple)) > 1e-6) {
        return toast('The index interval must be a whole multiple of the contour interval.', 'error');
      }
      abearcMapContourInterval = interval;
      abearcMapContourIndexInterval = indexInterval;
      const current = abearcMapContourData;
      const contour = buildAbearcContourSurfaces(current.surfaces, interval, indexInterval);
      abearcMapContourData = { ...current, ...contour };
      renderAbearcContourPanel();
      renderAbearcMapMeasure();
    }

    async function exportAbearcContourKml(confirmExport = true) {
      const contour = abearcMapContourData;
      if (!contour?.paths?.length) return toast('Generate contour lines first.', 'error');
      if (confirmExport) {
        const confirmed = await confirmModalChoice(
          `Export ${contour.paths.length} georeferenced contour line${contour.paths.length === 1 ? '' : 's'} as a 3D KML file?`,
          { title: 'Export Contour KML', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
        );
        if (!confirmed) return;
      }
      const placemarks = contour.paths.map(path => {
        const elevation = Number(path.level);
        const coordinates = path.points.map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},${elevation.toFixed(3)}`).join(' ');
        return `<Placemark><name>Contour ${elevation} m</name><styleUrl>#${path.index ? 'index' : 'regular'}</styleUrl><ExtendedData><Data name="elevation_m"><value>${elevation.toFixed(3)}</value></Data><Data name="contour_type"><value>${path.index ? 'index' : 'regular'}</value></Data></ExtendedData><LineString><altitudeMode>absolute</altitudeMode><coordinates>${coordinates}</coordinates></LineString></Placemark>`;
      }).join('');
      const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ABEARC contour lines</name><Style id="regular"><LineStyle><color>ff78c2f4</color><width>1.5</width></LineStyle></Style><Style id="index"><LineStyle><color>ff3b82f6</color><width>2.5</width></LineStyle></Style>${placemarks}</Document></kml>`;
      downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `ABEARC-contours-${new Date().toISOString().slice(0, 10)}.kml`);
    }

    function setAbearcContourSource(source) {
      rememberAbearcMapLayoutChange();
      if (!ABEARC_MAP_ELEVATION_SOURCES.has(source) || source === abearcMapContourSource) return;
      abearcMapContourSource = source;
      showAbearcContourLines(true);
    }

    function closeAbearcContourLines(redraw = true) {
      if (redraw && abearcMapContourData) rememberAbearcMapLayoutChange();
      abearcMapContourAbort?.abort();
      abearcMapContourAbort = null;
      abearcMapContourRequestId++;
      abearcMapContourData = null;
      document.getElementById('abearcMapContourPanel')?.classList.add('hidden');
      if (redraw) renderAbearcMapMeasure();
    }

    async function showAbearcContourLines(force = false) {
      closeAbearcMapMeasureContextMenu();
      const polygons = abearcContourPolygons().map(points => points.map(point => [...point]));
      if (!polygons.length) {
        return toast('Complete an area measurement first.', 'error');
      }
      const key = abearcContourSelectionKey(polygons);
      if (!force && abearcMapContourData?.key === key) return closeAbearcContourLines();
      closeAbearcElevationProfile();
      abearcMapContourAbort?.abort();
      abearcMapContourAbort = new AbortController();
      const requestId = ++abearcMapContourRequestId;
      const panel = document.getElementById('abearcMapContourPanel');
      const body = panel?.querySelector('[data-map-contour-results]');
      if (!panel || !body) return;
      setupAbearcFloatingMapPanelDrag('abearcMapContourPanel', '[data-map-contour-drag-handle]');
      const historyEntry = rememberAbearcMapLayoutChange();
      setupAbearcContourControls();
      panel.classList.remove('hidden');
      panel.dataset.state = 'loading';
      body.innerHTML = '<div class="abearc-map-contour-loading"><span></span>Generating contour lines...</div>';
      const sourceOutput = panel.querySelector('[data-map-contour-source]');
      const sourceLabel = sourceOutput?.textContent || '';
      try {
        const sourceResolutionM = ABEARC_MAP_ELEVATION_RESOLUTION_M[abearcMapContourSource];
        const plan = abearcMapAnalysis.planContourGrids(polygons, sourceResolutionM, {
          maxPolygons: 12,
          maxSamples: ABEARC_MAP_CONTOUR_SAMPLE_BUDGET[abearcMapContourSource] || 800
        });
        const surfaces = [];
        let effectiveSource = abearcMapContourSource;
        let effectiveSourceLabel = sourceLabel;
        for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
          const polygon = polygons[polygonIndex];
          const gridPlan = plan.plans[polygonIndex];
          if (polygons.length > 1) body.innerHTML = `<div class="abearc-map-contour-loading"><span></span>Generating polygon ${polygonIndex + 1} of ${polygons.length} · ${gridPlan.samples.toLocaleString()} samples...</div>`;
          const { west, east, south, north, columns, rows } = gridPlan;
          const locations = [];
          for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
              locations.push({
                latitude: north - (north - south) * row / (rows - 1),
                longitude: west + (east - west) * column / (columns - 1)
              });
            }
          }
          const result = await requestAbearcElevationBatches(locations, abearcMapContourAbort.signal, effectiveSource, false);
          if (requestId !== abearcMapContourRequestId) return;
          if (abearcContourSelectionKey() !== key) {
            panel.classList.add('hidden');
            return;
          }
          if (result.elevations.length !== locations.length || result.elevations.some(value => !Number.isFinite(value))) {
            throw new Error('Elevation data is incomplete.');
          }
          effectiveSource = result.sourceKey;
          effectiveSourceLabel = result.sourceLabel || effectiveSourceLabel;
          surfaces.push({
            polygon,
            columns,
            rows,
            effectiveSpacingM: gridPlan.effectiveSpacingM,
            sourceResolutionM,
            grid: locations.map((location, index) => ({ ...location, elevation: result.elevations[index] }))
          });
        }
        if (abearcMapViewUndoStack.at(-1) !== historyEntry) rememberAbearcMapLayoutChange();
        abearcMapContourSource = effectiveSource;
        const contour = buildAbearcContourSurfaces(surfaces, abearcMapContourInterval, abearcMapContourIndexInterval);
        abearcMapContourInterval = contour.interval;
        abearcMapContourIndexInterval = contour.indexInterval;
        abearcMapContourData = { ...contour, key, sourceLabel: effectiveSourceLabel };
        renderAbearcContourPanel();
        renderAbearcMapMeasure();
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== abearcMapContourRequestId) return;
        panel.dataset.state = 'error';
        body.innerHTML = `<div class="abearc-map-elevation-error"><strong>Contours unavailable</strong><span>${esc(error.message || 'Try generating the contour lines again.')}</span></div>`;
      } finally {
        if (requestId === abearcMapContourRequestId) abearcMapContourAbort = null;
      }
    }

    async function chooseAbearcMapKmlExport() {
      const confirmed = await confirmModalChoice(`
        <div class="space-y-2 text-left">
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input type="radio" name="abearcKmlExportType" value="area" checked class="mt-0.5">
            <span><strong class="block text-sm text-gray-900 dark:text-gray-100">Area perimeter</strong><small class="text-xs text-gray-500 dark:text-gray-400">Export the measured polygon boundary.</small></span>
          </label>
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input type="radio" name="abearcKmlExportType" value="contours" class="mt-0.5">
            <span><strong class="block text-sm text-gray-900 dark:text-gray-100">Contour lines</strong><small class="text-xs text-gray-500 dark:text-gray-400">Export georeferenced 3D contours with elevation values.</small></span>
          </label>
        </div>`,
        { title: 'Select KML Content', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
      );
      if (!confirmed) return null;
      return document.querySelector('#confirmMessage input[name="abearcKmlExportType"]:checked')?.value || 'area';
    }

    async function exportAbearcMapMeasureKml() {
      closeAbearcMapMeasureContextMenu();
      if (!canShowAbearcElevationProfile()) return toast('Complete a distance line or area measurement first.', 'error');
      const area = abearcMapMeasureMode === 'area';
      const hasCurrentContours = area && !abearcMapContourData?.imported && abearcMapContourData?.paths?.length
        && abearcMapContourData.key === abearcContourSelectionKey();
      const exportChoice = hasCurrentContours ? await chooseAbearcMapKmlExport() : null;
      if (hasCurrentContours && !exportChoice) return;
      if (exportChoice === 'contours') return exportAbearcContourKml(false);
      if (abearcMapImportedPolygons.length) {
        const selectedIndexes = abearcMapSelectedImportedPolygons.size
          ? [...abearcMapSelectedImportedPolygons].sort((a, b) => a - b)
          : abearcMapImportedPolygons.map((_, index) => index);
        if (!exportChoice) {
          const confirmed = await confirmModalChoice(
            `Export ${selectedIndexes.length} ${abearcMapSelectedImportedPolygons.size ? 'selected ' : ''}polygon${selectedIndexes.length === 1 ? '' : 's'} as a KML file?`,
            { title: 'Export Measurement KML', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
          );
          if (!confirmed) return;
        }
        const placemarks = selectedIndexes.map(index => {
          const polygon = abearcMapImportedPolygons[index];
          const closed = [...polygon.points, polygon.points[0]];
          const coordinates = closed.map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},0`).join(' ');
          return `<Placemark><name>${esc(polygon.name)}</name><styleUrl>#measurement</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
        }).join('');
        const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ABEARC polygon measurements</name><Style id="measurement"><LineStyle><color>ff15ccfa</color><width>3</width></LineStyle><PolyStyle><color>4015ccfa</color></PolyStyle></Style>${placemarks}</Document></kml>`;
        return downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `ABEARC-polygon-measurements-${new Date().toISOString().slice(0, 10)}.kml`);
      }
      if (!exportChoice) {
        const confirmed = await confirmModalChoice(
          `Export this ${area ? 'area' : 'distance'} measurement as a KML file?`,
          { title: 'Export Measurement KML', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
        );
        if (!confirmed) return;
      }
      const points = area ? [...abearcMapMeasurePoints, abearcMapMeasurePoints[0]] : abearcMapMeasurePoints;
      const coordinates = points.map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},0`).join(' ');
      const geometry = area
        ? `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
        : `<LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString>`;
      const label = area ? 'Area measurement' : 'Distance measurement';
      const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${label}</name><Style id="measurement"><LineStyle><color>ff15ccfa</color><width>3</width></LineStyle><PolyStyle><color>4015ccfa</color></PolyStyle></Style><Placemark><name>${label}</name><styleUrl>#measurement</styleUrl>${geometry}</Placemark></Document></kml>`;
      downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `ABEARC-${area ? 'area' : 'distance'}-measurement-${new Date().toISOString().slice(0, 10)}.kml`);
    }

    async function downloadAbearcElevationProfileImage() {
      const panel = document.getElementById('abearcMapElevationProfile');
      if (!panel || panel.dataset.state !== 'ready') return toast('Wait for the elevation profile to finish loading.', 'error');
      const chart = panel.querySelector('.abearc-map-elevation-chart');
      if (!chart) return toast('The elevation graph is not ready to download.', 'error');
      const confirmed = await confirmModalChoice(
        'Download the current elevation profile graph as a PNG image?',
        { title: 'Download Elevation Profile', confirmText: 'Download', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium' }
      );
      if (!confirmed) return;
      const chartClone = chart.cloneNode(true);
      [chartClone, ...chartClone.querySelectorAll('*')].forEach((node, index) => {
        const source = [chart, ...chart.querySelectorAll('*')][index];
        const computed = getComputedStyle(source);
        node.style.cssText = Array.from(computed).map(property => `${property}:${computed.getPropertyValue(property)}`).join(';');
      });
      chartClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      chartClone.setAttribute('width', '640');
      chartClone.setAttribute('height', '150');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(chartClone)], { type: 'image/svg+xml;charset=utf-8' }));
      const image = new Image();
      image.onload = () => {
        const width = 650;
        const height = 260;
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const context = canvas.getContext('2d');
        context.scale(2, 2);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.strokeStyle = '#cbd5e1';
        context.strokeRect(0.5, 0.5, width - 1, height - 1);
        context.fillStyle = '#64748b';
        context.font = '800 10px Arial, sans-serif';
        context.fillText(panel.querySelector('[data-map-elevation-kicker]')?.textContent || 'Distance measurement', 16, 19);
        context.fillStyle = '#172b3a';
        context.font = '900 16px Arial, sans-serif';
        context.fillText('Elevation profile', 16, 39);
        context.fillStyle = '#526575';
        context.font = '700 10px Arial, sans-serif';
        context.textAlign = 'right';
        context.fillText(`Source: ${panel.querySelector('[data-map-elevation-selected-source]')?.textContent || ''}`, width - 16, 34, 310);
        context.textAlign = 'left';
        const stats = [...panel.querySelectorAll('.abearc-map-elevation-stats > span')];
        const gap = 8;
        const statWidth = (width - 32 - gap * 3) / 4;
        stats.forEach((stat, index) => {
          const left = 16 + index * (statWidth + gap);
          context.fillStyle = '#f1f6f8';
          context.fillRect(left, 54, statWidth, 42);
          context.fillStyle = '#71808d';
          context.font = '700 9px Arial, sans-serif';
          context.fillText(stat.querySelector('small')?.textContent || '', left + 8, 69);
          context.fillStyle = '#183746';
          context.font = '900 13px Arial, sans-serif';
          context.fillText(stat.querySelector('strong')?.textContent || '', left + 8, 87);
        });
        context.drawImage(image, 5, 106, 640, 150);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) return toast('The elevation profile image could not be created.', 'error');
          downloadBlob(blob, `ABEARC-elevation-profile-${new Date().toISOString().slice(0, 10)}.png`);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        toast('The elevation profile image could not be created.', 'error');
      };
      image.src = url;
    }

    function closeAbearcMapMeasureContextMenu() {
      document.getElementById('abearcMapMeasureContextMenu')?.classList.add('hidden');
      document.getElementById('abearcMapMeasurePointContextMenu')?.classList.add('hidden');
      document.querySelector('[data-map-elevation-annotation-menu]')?.classList.add('hidden');
      abearcMapMeasurePointContextIndex = null;
      abearcMapElevationAnnotationContextIndex = null;
      abearcMapImportedPolygonContextIndex = null;
    }

    function openAbearcMapMeasureContextMenu(event, importedPolygonIndex = null) {
      if (!canShowAbearcElevationProfile()) return;
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapMeasureContextMenu();
      closeAbearcMapPhotoContextMenu();
      const menu = document.getElementById('abearcMapMeasureContextMenu');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage) return;
      const polygon = Number.isInteger(importedPolygonIndex) ? abearcMapImportedPolygons[importedPolygonIndex] : null;
      const properties = menu.querySelector('[data-map-imported-polygon-properties]');
      const editButton = menu.querySelector('[data-map-imported-polygon-edit]');
      const elevationButton = menu.querySelector('[data-map-measure-elevation]');
      const gravityButton = menu.querySelector('[data-map-measure-gravity]');
      const ramPumpButton = menu.querySelector('[data-map-measure-ram-pump]');
      const contourButton = menu.querySelector('[data-map-measure-contours]');
      const saltButton = menu.querySelector('[data-map-measure-salt]');
      const selectedPolygons = polygon
        ? [...abearcMapSelectedImportedPolygons].map(index => abearcMapImportedPolygons[index]).filter(Boolean)
        : [];
      const multiple = selectedPolygons.length > 1;
      properties?.classList.toggle('hidden', !polygon);
      editButton?.classList.toggle('hidden', !polygon || multiple);
      elevationButton?.classList.toggle('hidden', multiple);
      gravityButton?.classList.toggle('hidden', multiple || Boolean(polygon) || abearcMapMeasureMode !== 'distance' || abearcMapMeasurePoints.length < 2);
      ramPumpButton?.classList.toggle('hidden', multiple || Boolean(polygon) || abearcMapMeasureMode !== 'distance' || abearcMapMeasurePoints.length < 2);
      const gravityLabel = gravityButton?.querySelector('[data-map-measure-gravity-label]');
      if (gravityLabel) gravityLabel.textContent = window.isAbearcGravityPathActive?.() ? 'Recalculate gravity-flow path' : 'Find gravity-flow path';
      contourButton?.classList.toggle('hidden', abearcMapMeasureMode !== 'area' || abearcMapMeasurePoints.length < 3);
      saltButton?.classList.toggle('hidden', abearcMapMeasureMode !== 'area' || abearcMapMeasurePoints.length < 3);
      const contourLabel = contourButton?.querySelector('[data-map-measure-contours-label]');
      if (contourLabel) contourLabel.textContent = abearcMapContourData?.key === abearcContourSelectionKey() ? 'Hide contour lines' : 'Show contour lines';
      const saltLabel = saltButton?.querySelector('[data-map-measure-salt-label]');
      if (saltLabel) saltLabel.textContent = window.isAbearcSaltLayoutCurrent?.() ? 'Hide SALT layout' : 'Generate SALT layout';
      if (polygon) {
        abearcMapImportedPolygonContextIndex = importedPolygonIndex;
        const totalArea = selectedPolygons.reduce((sum, selected) => sum + abearcPolygonArea(selected.points), 0);
        const totalPerimeter = selectedPolygons.reduce((sum, selected) => sum + abearcMeasurePathDistance([...selected.points, selected.points[0]]), 0);
        const name = properties.querySelector('[data-map-imported-polygon-name]');
        const area = properties.querySelector('[data-map-imported-polygon-area]');
        const perimeterValue = properties.querySelector('[data-map-imported-polygon-perimeter]');
        const editLabel = editButton.querySelector('[data-map-imported-polygon-edit-label]');
        if (name) name.textContent = multiple ? `${selectedPolygons.length} polygons selected` : polygon.name;
        if (area) area.textContent = `${(totalArea / 10000).toFixed(2)} ha`;
        if (perimeterValue) perimeterValue.textContent = formatAbearcDistance(totalPerimeter);
        if (editLabel) editLabel.textContent = abearcMapEditingImportedPolygonIndex === importedPolygonIndex ? 'Done editing' : 'Edit polygon';
      }
      document.querySelectorAll('.abearc-map-results-menu[open]').forEach(details => details.removeAttribute('open'));
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 210;
      const height = menu.offsetHeight || 128;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function addAbearcMeasurePointFromOverlay(event) {
      if (!abearcMap || event.detail > 1) return;
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapMeasureContextMenu();
      const bounds = abearcMap.getCanvasContainer().getBoundingClientRect();
      addAbearcMeasurePoint(abearcMap.unproject([event.clientX - bounds.left, event.clientY - bounds.top]));
    }

    function forwardAbearcMapWheelFromOverlay(event) {
      const canvas = abearcMap?.getCanvas();
      if (!canvas) return;
      event.preventDefault();
      event.stopPropagation();
      canvas.dispatchEvent(new WheelEvent('wheel', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      }));
    }

    function abearcActiveGravityProfileSource() {
      try {
        if (typeof isAbearcGravityPathActive !== 'function' || !isAbearcGravityPathActive()) return '';
        const state = typeof captureAbearcGravityPathState === 'function' ? captureAbearcGravityPathState() : null;
        const sourceKey = String(state?.sourceKey || '');
        return ABEARC_MAP_ELEVATION_SOURCES.has(sourceKey) ? sourceKey : '';
      } catch (_) {
        return '';
      }
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
      setupAbearcFloatingMapPanelDrag('abearcMapElevationProfile', '[data-map-elevation-drag-handle]');
      const kicker = panel.querySelector('[data-map-elevation-kicker]');
      if (kicker) kicker.textContent = abearcMapMeasureMode === 'area' ? 'Area perimeter' : 'Distance measurement';
      syncAbearcElevationSourceMenu();
      panel.classList.remove('hidden');
      panel.classList.add('is-updating');
      panel.setAttribute('aria-busy', 'true');
      let chart = body.querySelector('.abearc-map-elevation-chart');
      if (!chart) {
        const totalDistance = abearcMeasurePathDistance(abearcElevationPathPoints());
        const unit = totalDistance >= 5000 ? 'km' : 'm';
        const maximum = unit === 'km' ? totalDistance / 1000 : totalDistance;
        const maximumLabel = maximum.toFixed(unit === 'km' ? 2 : 1).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
        body.innerHTML = `<svg class="abearc-map-elevation-chart" viewBox="0 0 640 150" role="img" aria-label="Loading elevation profile from 0 to ${maximumLabel} ${unit}">
          <line class="abearc-map-elevation-grid" x1="54" y1="116" x2="628" y2="116"/>
          <text class="abearc-map-elevation-axis" x="54" y="137" text-anchor="middle">0</text>
          <text class="abearc-map-elevation-axis" x="628" y="137" text-anchor="middle">${maximumLabel}</text>
          <text class="abearc-map-elevation-axis-title" x="341" y="149" text-anchor="middle">Distance (${unit})</text>
        </svg>`;
        chart = body.querySelector('.abearc-map-elevation-chart');
      }
      if (!chart.querySelector('.abearc-map-elevation-updating')) {
        chart.insertAdjacentHTML('beforeend', '<line class="abearc-map-elevation-updating" x1="54" y1="116" x2="628" y2="116" pathLength="100"/>');
      }
      panel.dataset.state = abearcMapElevationProfileData.length > 1 ? 'ready' : 'loading';
    }

    function refreshAbearcElevationProfile(force = false) {
      const eligible = canShowAbearcElevationProfile();
      if (!eligible) return resetAbearcElevationProfile();
      if (!abearcMapElevationVisible) return;
      const gravityLockedSource = abearcActiveGravityProfileSource();
      if (gravityLockedSource && abearcMapElevationSource !== gravityLockedSource) {
        abearcMapElevationSource = gravityLockedSource;
        syncAbearcElevationSourceMenu();
      }
      const profileSource = gravityLockedSource || abearcMapElevationSource;
      const key = `${profileSource}:${abearcMapMeasurePoints.map(point => point.map(value => Number(value).toFixed(6)).join(',')).join('|')}`;
      if (!force && key === abearcMapElevationKey) return;
      abearcMapElevationKey = key;
      clearTimeout(abearcMapElevationTimer);
      abearcMapElevationAbort?.abort();
      setAbearcElevationLoading();
      const requestId = ++abearcMapElevationRequestId;
      abearcMapElevationTimer = setTimeout(() => loadAbearcElevationProfile(requestId), force ? 0 : 450);
    }

    async function requestAbearcElevations(locations, signal, sourceKey = abearcMapElevationSource, allowFallback = true) {
      const requestedLocations = Array.isArray(locations) ? locations : [];
      if (requestedLocations.length < 2) {
        if (!requestedLocations.length) throw new Error('At least one elevation location is required.');
        // Cache misses and batch tails can contain one point; the API needs two.
        const result = await requestAbearcElevations([requestedLocations[0], requestedLocations[0]], signal, sourceKey, allowFallback);
        return { ...result, elevations: result.elevations.slice(0, 1) };
      }

      // Keep every elevation request below the API ceiling at the lowest-level
      // request function, not only in individual callers. Gravity-path final
      // validation can easily contain 600-1,000+ samples when a long contour
      // route is checked at 1.25 m spacing. Previously most gravity callers
      // batched correctly, but any direct request path could still send the
      // whole array and receive "Provide between 2 and 400 elevation
      // locations." Use 300-point chunks here so every current and future
      // caller is protected automatically.
      const requestBatchSize = 300;
      if (requestedLocations.length > requestBatchSize) {
        const elevations = [];
        let effectiveSourceKey = sourceKey;
        let sourceLabel = '';
        for (let offset = 0; offset < requestedLocations.length; offset += requestBatchSize) {
          if (signal?.aborted) throw new DOMException('Request was aborted', 'AbortError');
          const batch = requestedLocations.slice(offset, offset + requestBatchSize);
          // A final one-point tail is legal internally, but the elevation API
          // intentionally requires at least two positions. Repeat the previous
          // location for that request and discard its duplicate result.
          const apiBatch = batch.length === 1 && offset > 0
            ? [requestedLocations[offset - 1], batch[0]]
            : batch;
          const result = await requestAbearcElevations(apiBatch, signal, effectiveSourceKey, allowFallback);
          const values = Array.isArray(result.elevations) ? result.elevations.map(Number) : [];
          const usableValues = batch.length === 1 && apiBatch.length === 2 ? values.slice(1) : values;
          if (usableValues.length !== batch.length || usableValues.some(value => !Number.isFinite(value))) {
            throw new Error('The selected elevation source did not return complete terrain data.');
          }
          if (!allowFallback && result.sourceKey && result.sourceKey !== effectiveSourceKey) {
            throw new Error('The elevation source response did not match the selected dataset.');
          }
          elevations.push(...usableValues);
          effectiveSourceKey = result.sourceKey || effectiveSourceKey;
          sourceLabel = result.sourceLabel || sourceLabel;
        }
        return { elevations, sourceLabel, sourceKey: effectiveSourceKey };
      }

      if (sourceKey === 'aws-mapzen') {
        return {
          elevations: await loadAbearcMapzenElevations(requestedLocations, signal),
          sourceLabel: 'AWS Terrain Tiles (Mapzen)',
          sourceKey
        };
      }
      try {
        const response = await fetch(`${API}/map/elevation-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ source: sourceKey, locations: requestedLocations }),
          signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Elevation data is unavailable.');
        if (data.source_key !== sourceKey) throw new Error('The elevation source response did not match the selected dataset.');
        return {
          elevations: Array.isArray(data.elevations) ? data.elevations.map(Number) : [],
          sourceLabel: String(data.source || ''),
          sourceKey
        };
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (!allowFallback) throw error;
        const elevations = await loadAbearcMapzenElevations(requestedLocations, signal);
        return { elevations, sourceLabel: 'AWS Terrain Tiles (Mapzen)', sourceKey: 'aws-mapzen' };
      }
    }

    async function requestAbearcElevationBatches(locations, signal, sourceKey, allowFallback = true) {
      const elevations = [];
      let effectiveSourceKey = sourceKey;
      let sourceLabel = '';
      for (let offset = 0; offset < locations.length; offset += 300) {
        const result = await requestAbearcElevations(locations.slice(offset, offset + 300), signal, effectiveSourceKey, allowFallback);
        elevations.push(...result.elevations);
        effectiveSourceKey = result.sourceKey;
        sourceLabel = result.sourceLabel || sourceLabel;
      }
      return { elevations, sourceKey: effectiveSourceKey, sourceLabel };
    }

    async function loadAbearcElevationProfile(requestId) {
      const samples = sampleAbearcMeasurePath();
      if (samples.length < 2 || requestId !== abearcMapElevationRequestId) return;
      abearcMapElevationAbort = new AbortController();
      try {
        const gravityLockedSource = abearcActiveGravityProfileSource();
        const requestedSource = gravityLockedSource || abearcMapElevationSource;
        const result = await requestAbearcElevations(
          samples.map(sample => ({ latitude: sample.latitude, longitude: sample.longitude })),
          abearcMapElevationAbort.signal,
          requestedSource,
          !gravityLockedSource
        );
        const { elevations } = result;
        if (gravityLockedSource && result.sourceKey !== gravityLockedSource) {
          throw new Error(`This gravity-flow path is locked to ${gravityLockedSource}; the elevation profile returned a different terrain source.`);
        }
        if (result.sourceKey !== abearcMapElevationSource) {
          abearcMapElevationSource = result.sourceKey;
          syncAbearcElevationSourceMenu();
        }
        if (requestId !== abearcMapElevationRequestId) return;
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

    async function loadAbearcMapzenElevations(samples, signal) {
      const zoom = 12;
      const scale = 2 ** zoom;
      const coordinates = samples.map(sample => {
        const tileX = (sample.longitude + 180) / 360 * scale;
        const tileY = (1 - Math.asinh(Math.tan(sample.latitude * Math.PI / 180)) / Math.PI) / 2 * scale;
        return {
          x: Math.floor(tileX),
          y: Math.floor(tileY),
          pixelX: Math.max(0, Math.min(255, Math.floor((tileX % 1) * 256))),
          pixelY: Math.max(0, Math.min(255, Math.floor((tileY % 1) * 256)))
        };
      });
      const tileKeys = [...new Set(coordinates.map(point => `${point.x}/${point.y}`))];
      const tiles = new Map(await Promise.all(tileKeys.map(async key => {
        const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${key}.png`, { signal });
        if (!response.ok) throw new Error('Terrain elevation data is temporarily unavailable.');
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        bitmap.close?.();
        return [key, { pixels, width: canvas.width }];
      })));
      return coordinates.map(point => {
        const tile = tiles.get(`${point.x}/${point.y}`);
        const offset = (point.pixelY * tile.width + point.pixelX) * 4;
        return tile.pixels[offset] * 256 + tile.pixels[offset + 1] + tile.pixels[offset + 2] / 256 - 32768;
      });
    }

    function setAbearcElevationSource(source) {
      rememberAbearcMapLayoutChange();
      if (!ABEARC_MAP_ELEVATION_SOURCES.has(source)) return;
      const gravityLockedSource = abearcActiveGravityProfileSource();
      if (gravityLockedSource && source !== gravityLockedSource) {
        abearcMapElevationSource = gravityLockedSource;
        abearcMapElevationKey = '';
        syncAbearcElevationSourceMenu();
        const gravitySourceName = (typeof abearcGravitySourceLabel === 'function') ? abearcGravitySourceLabel(gravityLockedSource) : gravityLockedSource;
        toast(`This gravity-flow path is locked to ${gravitySourceName}. Gravity Flow Path uses NAMRIA DTM 5 m (PRS92) only.`, 'error');
        if (abearcMapElevationVisible) refreshAbearcElevationProfile(true);
        return;
      }
      abearcMapElevationSource = source;
      abearcMapElevationKey = '';
      syncAbearcElevationSourceMenu();
      if (abearcMapElevationVisible) refreshAbearcElevationProfile(true);
    }

    function renderAbearcElevationError(message) {
      const panel = document.getElementById('abearcMapElevationProfile');
      const body = panel?.querySelector('[data-map-elevation-body]');
      if (!panel || !body) return;
      panel.classList.remove('is-updating');
      panel.removeAttribute('aria-busy');
      if (abearcMapElevationProfileData.length > 1 && body.querySelector('.abearc-map-elevation-stats')) {
        body.querySelector('.abearc-map-elevation-updating')?.remove();
        panel.dataset.state = 'ready';
        toast(message || 'The elevation profile could not be updated.', 'error');
        return;
      }
      panel.classList.remove('hidden');
      panel.dataset.state = 'error';
      body.innerHTML = `<div class="abearc-map-elevation-error"><strong>Profile unavailable</strong><span>${esc(message || 'Try refreshing the elevation profile.')}</span></div>`;
    }

    function renderAbearcElevationProfile(profile) {
      const panel = document.getElementById('abearcMapElevationProfile');
      const body = panel?.querySelector('[data-map-elevation-body]');
      if (!panel || !body || profile.length < 2) return;
      abearcMapElevationProfileData = profile;
      const elevations = profile.map(point => point.elevation);
      const minimum = Math.min(...elevations);
      const maximum = Math.max(...elevations);
      let ascent = 0;
      let descent = 0;
      let surfaceDistance = 0;
      for (let index = 1; index < elevations.length; index++) {
        const change = elevations[index] - elevations[index - 1];
        const horizontal = Math.max(0, profile[index].distance - profile[index - 1].distance);
        surfaceDistance += Math.hypot(horizontal, change);
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
      let pointDistance = 0;
      const distancePoints = abearcElevationPathPoints().map((point, index, points) => {
        if (index) pointDistance += haversineMetres(points[index - 1], point);
        const nextIndex = Math.min(profile.length - 1, Math.ceil(pointDistance / totalDistance * (profile.length - 1)));
        const previousIndex = Math.max(0, nextIndex - 1);
        const previous = profile[previousIndex];
        const next = profile[nextIndex];
        const span = next.distance - previous.distance;
        const ratio = span > 0 ? (pointDistance - previous.distance) / span : 0;
        return {
          distance: pointDistance,
          elevation: previous.elevation + (next.elevation - previous.elevation) * ratio,
          measurePointIndex: index === abearcMapMeasurePoints.length ? 0 : index
        };
      });
      const pointMarkers = distancePoints
        .filter(point => !abearcMapHiddenMeasurePointIndexes.has(point.measurePointIndex))
        .map(point => `<circle class="abearc-map-elevation-point${point.measurePointIndex === abearcMapLastTouchedMeasureIndex ? ' is-active' : ''}" data-measure-point-index="${point.measurePointIndex}" cx="${x(point.distance).toFixed(1)}" cy="${y(point.elevation).toFixed(1)}" r="3.8"><title>Point ${point.measurePointIndex + 1}: ${formatAbearcDistance(point.distance)}, ${Math.round(point.elevation)} m elevation</title></circle>`).join('');
      const annotatedIndexes = new Set();
      const annotationMeasure = document.createElement('canvas').getContext('2d');
      annotationMeasure.font = '750 10px Arial, sans-serif';
      const annotations = distancePoints.map(point => {
        if (annotatedIndexes.has(point.measurePointIndex) || abearcMapHiddenMeasurePointIndexes.has(point.measurePointIndex)) return '';
        annotatedIndexes.add(point.measurePointIndex);
        const annotation = abearcMapElevationAnnotations.get(point.measurePointIndex);
        if (!annotation) return '';
        const anchorX = x(point.distance);
        const anchorY = y(point.elevation);
        const labelWidth = Math.max(60, Math.min(width - 16, Math.ceil(annotationMeasure.measureText(annotation.text).width) + 16));
        const labelX = Math.max(8, Math.min(width - labelWidth - 8, anchorX + annotation.dx));
        const labelY = Math.max(18, Math.min(height - 8, anchorY + annotation.dy));
        const guideX = anchorX - labelX;
        const guideY = anchorY - labelY;
        const boxX = Math.max(-4, Math.min(labelWidth - 4, guideX));
        const boxY = Math.max(-14, Math.min(6, guideY));
        return `<g class="abearc-map-elevation-annotation" data-measure-point-index="${point.measurePointIndex}" data-anchor-x="${anchorX.toFixed(1)}" data-anchor-y="${anchorY.toFixed(1)}" data-label-width="${labelWidth}" transform="translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})"><line x1="${guideX.toFixed(1)}" y1="${guideY.toFixed(1)}" x2="${boxX.toFixed(1)}" y2="${boxY.toFixed(1)}"/><rect x="-4" y="-14" width="${labelWidth}" height="20" rx="4"/><text x="3" y="0">${esc(annotation.text)}</text></g>`;
      }).join('');
      const stats = {
        low: `${Math.round(minimum)} m`,
        high: `${Math.round(maximum)} m`,
        ascent: `+${Math.round(ascent)} m`,
        descent: `-${Math.round(descent)} m`,
        surfaceDistance: formatAbearcDistance(surfaceDistance)
      };
      const chartMarkup = `
        <defs><linearGradient id="abearcElevationFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0891b2" stop-opacity=".42"/><stop offset="1" stop-color="#0891b2" stop-opacity=".05"/></linearGradient></defs>
        ${yGrid}${xGrid}
        <path class="abearc-map-elevation-area" d="${areaPath}"/>
        <path class="abearc-map-elevation-line" d="${linePath}"/>
        ${pointMarkers}
        ${annotations}
        <text class="abearc-map-elevation-axis-title" x="${plot.left + plotWidth / 2}" y="${height - 1}" text-anchor="middle">Distance (${distanceAxisUnit.label})</text>
        <text class="abearc-map-elevation-axis-title" x="12" y="${plot.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 12 ${plot.top + plotHeight / 2})">Elevation (m)</text>`;
      let chart = body.querySelector('.abearc-map-elevation-chart');
      const statsRow = body.querySelector('.abearc-map-elevation-stats');
      if (!chart || !statsRow) {
        body.innerHTML = `
          <div class="abearc-map-elevation-stats">
            <span><small>Low</small><strong data-map-elevation-stat="low">${stats.low}</strong></span>
            <span><small>High</small><strong data-map-elevation-stat="high">${stats.high}</strong></span>
            <span><small>Ascent</small><strong data-map-elevation-stat="ascent">${stats.ascent}</strong></span>
            <span><small>Descent</small><strong data-map-elevation-stat="descent">${stats.descent}</strong></span>
            <span><small>Surface distance</small><strong data-map-elevation-stat="surfaceDistance">${stats.surfaceDistance}</strong></span>
          </div>
          <svg class="abearc-map-elevation-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Elevation from ${Math.round(minimum)} to ${Math.round(maximum)} metres across ${distanceEnd}">${chartMarkup}</svg>`;
      } else {
        Object.entries(stats).forEach(([name, value]) => {
          const output = statsRow.querySelector(`[data-map-elevation-stat="${name}"]`);
          if (output) output.textContent = value;
        });
        chart.setAttribute('aria-label', `Elevation from ${Math.round(minimum)} to ${Math.round(maximum)} metres across ${distanceEnd}`);
        chart.innerHTML = chartMarkup;
      }
      bindAbearcElevationChartInteractions();
      panel.classList.remove('hidden');
      panel.classList.remove('is-updating');
      panel.removeAttribute('aria-busy');
      panel.dataset.state = 'ready';
    }

    function bindAbearcElevationChartInteractions() {
      const chart = document.querySelector('#abearcMapElevationProfile .abearc-map-elevation-chart');
      if (!chart) return;
      chart.querySelectorAll('.abearc-map-elevation-point').forEach(point => {
        point.addEventListener('click', event => {
          event.stopPropagation();
          selectAbearcMeasurePoint(Number(point.dataset.measurePointIndex));
        });
        point.addEventListener('contextmenu', event => {
          event.preventDefault();
          event.stopPropagation();
          editAbearcMeasurePointAnnotation(Number(point.dataset.measurePointIndex));
        });
      });
      chart.querySelectorAll('.abearc-map-elevation-annotation').forEach(label => {
        label.addEventListener('contextmenu', event => openAbearcElevationAnnotationContextMenu(event, Number(label.dataset.measurePointIndex)));
        label.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          const index = Number(label.dataset.measurePointIndex);
          rememberAbearcMapMeasureState();
          const anchorX = Number(label.dataset.anchorX);
          const anchorY = Number(label.dataset.anchorY);
          const labelWidth = Number(label.dataset.labelWidth);
          const guide = label.querySelector('line');
          label.setPointerCapture(event.pointerId);
          label.classList.add('is-dragging');
          const move = moveEvent => {
            const bounds = chart.getBoundingClientRect();
            const labelX = Math.max(8, Math.min(640 - labelWidth - 8, (moveEvent.clientX - bounds.left) * 640 / bounds.width));
            const labelY = Math.max(18, Math.min(142, (moveEvent.clientY - bounds.top) * 150 / bounds.height));
            label.setAttribute('transform', `translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})`);
            const guideX = anchorX - labelX;
            const guideY = anchorY - labelY;
            guide?.setAttribute('x1', guideX.toFixed(1));
            guide?.setAttribute('y1', guideY.toFixed(1));
            guide?.setAttribute('x2', Math.max(-4, Math.min(labelWidth - 4, guideX)).toFixed(1));
            guide?.setAttribute('y2', Math.max(-14, Math.min(6, guideY)).toFixed(1));
            const annotation = abearcMapElevationAnnotations.get(index);
            if (annotation) Object.assign(annotation, { dx: labelX - anchorX, dy: labelY - anchorY });
          };
          const stop = () => {
            label.classList.remove('is-dragging');
            label.removeEventListener('pointermove', move);
            label.removeEventListener('pointerup', stop);
            label.removeEventListener('pointercancel', stop);
            saveAbearcMapMeasure();
          };
          label.addEventListener('pointermove', move);
          label.addEventListener('pointerup', stop);
          label.addEventListener('pointercancel', stop);
        });
      });
    }

    function openAbearcElevationAnnotationContextMenu(event, index) {
      event.preventDefault();
      event.stopPropagation();
      closeAbearcMapMeasureContextMenu();
      const menu = document.querySelector('[data-map-elevation-annotation-menu]');
      const stage = document.querySelector('.abearc-map-stage');
      if (!menu || !stage || !abearcMapElevationAnnotations.has(index)) return;
      abearcMapElevationAnnotationContextIndex = index;
      const bounds = stage.getBoundingClientRect();
      menu.classList.remove('hidden');
      const width = menu.offsetWidth || 216;
      const height = menu.offsetHeight || 44;
      menu.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.height - height - 8, event.clientY - bounds.top))}px`;
    }

    function removeAbearcElevationAnnotation() {
      const index = abearcMapElevationAnnotationContextIndex;
      if (!Number.isInteger(index)) return;
      rememberAbearcMapMeasureState();
      abearcMapElevationAnnotations.delete(index);
      closeAbearcMapMeasureContextMenu();
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
      if (abearcMapElevationProfileData.length > 1) renderAbearcElevationProfile(abearcMapElevationProfileData);
      toast('Point annotation removed.');
    }

    function selectAbearcMeasurePoint(index) {
      if (!Number.isInteger(index) || index < 0 || index >= abearcMapMeasurePoints.length) return;
      abearcMapLastTouchedMeasureIndex = index;
      syncAbearcElevationPointHighlight();
    }

    function syncAbearcElevationPointHighlight() {
      document.querySelectorAll('.abearc-map-elevation-point, .abearc-map-measure-point[data-measure-point-index]').forEach(point => {
        point.classList.toggle('is-active', Number(point.dataset.measurePointIndex) === abearcMapLastTouchedMeasureIndex);
      });
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

    function abearcScreenPointClearance(point, polygon) {
      if (!abearcScreenPointInPolygon(point, polygon)) return -1;
      let minimumSquared = Infinity;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
        const offsetX = point.x - (a.x + ratio * dx);
        const offsetY = point.y - (a.y + ratio * dy);
        minimumSquared = Math.min(minimumSquared, offsetX * offsetX + offsetY * offsetY);
      }
      return Math.sqrt(minimumSquared);
    }

    function abearcScreenInteriorPoint(points) {
      if (points.length < 3) return abearcScreenCentroid(points);
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      let best = null;
      const consider = point => {
        const clearance = abearcScreenPointClearance(point, points);
        if (clearance >= 0 && (!best || clearance > best.clearance)) best = { ...point, clearance };
      };
      consider(abearcScreenCentroid(points));
      for (let row = 0; row < 9; row++) {
        const y = top + (row + 0.5) / 9 * (bottom - top);
        const intersections = [];
        points.forEach((point, index) => {
          const next = points[(index + 1) % points.length];
          if ((point.y > y) !== (next.y > y)) intersections.push(point.x + (y - point.y) * (next.x - point.x) / (next.y - point.y));
        });
        intersections.sort((a, b) => a - b);
        let widest = null;
        for (let index = 0; index + 1 < intersections.length; index += 2) {
          const width = intersections[index + 1] - intersections[index];
          if (!widest || width > widest.width) widest = { left: intersections[index], right: intersections[index + 1], width };
        }
        if (widest) consider({ x: (widest.left + widest.right) / 2, y });
      }
      // ponytail: bounded refinement keeps map panning cheap; use polylabel if sub-pixel precision becomes necessary.
      let stepX = (right - left) / 9, stepY = (bottom - top) / 9;
      for (let pass = 0; best && pass < 2; pass++) {
        const origin = best;
        for (let row = -2; row <= 2; row++) {
          for (let column = -2; column <= 2; column++) consider({ x: origin.x + column * stepX, y: origin.y + row * stepY });
        }
        stepX /= 3;
        stepY /= 3;
      }
      return best || abearcScreenCentroid(points);
    }

    function abearcScreenPointInPolygon(point, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y)
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    }

    function activateAbearcImportedPolygon(index) {
      const polygon = abearcMapImportedPolygons[index];
      if (!polygon) return false;
      if (abearcMapMeasurePoints !== polygon.points) {
        abearcMapMeasurePoints = polygon.points;
        abearcMapHiddenMeasurePointIndexes.clear();
        abearcMapElevationAnnotations.clear();
        abearcMapLastTouchedMeasureIndex = polygon.points.length - 1;
        resetAbearcElevationProfile();
      }
      return true;
    }

    function selectAbearcImportedPolygon(event, index, projectedPolygons) {
      event.preventDefault();
      event.stopPropagation();
      let activeIndex = index;
      if (event.ctrlKey || event.metaKey) {
        const bounds = document.getElementById('abearcMapMeasureLayer').getBoundingClientRect();
        const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const hits = projectedPolygons.map((polygon, polygonIndex) =>
          abearcScreenPointInPolygon(point, polygon) ? polygonIndex : -1).filter(hit => hit >= 0).reverse();
        if (!hits.length) hits.push(index);
        if (hits.every(hit => abearcMapSelectedImportedPolygons.has(hit))) {
          hits.forEach(hit => abearcMapSelectedImportedPolygons.delete(hit));
        } else {
          activeIndex = hits.find(hit => !abearcMapSelectedImportedPolygons.has(hit));
          abearcMapSelectedImportedPolygons.add(activeIndex);
        }
      } else {
        abearcMapSelectedImportedPolygons.clear();
        abearcMapSelectedImportedPolygons.add(index);
        if (abearcMapEditingImportedPolygonIndex !== index) abearcMapEditingImportedPolygonIndex = null;
      }
      if (abearcMapSelectedImportedPolygons.size > 1) abearcMapEditingImportedPolygonIndex = null;
      activateAbearcImportedPolygon(activeIndex);
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
    }

    function openAbearcImportedPolygonContextMenu(event, index) {
      event.preventDefault();
      event.stopPropagation();
      if (abearcMapSelectedImportedPolygons.size <= 1) abearcMapSelectedImportedPolygons.clear();
      abearcMapSelectedImportedPolygons.add(index);
      if (abearcMapSelectedImportedPolygons.size > 1 || abearcMapEditingImportedPolygonIndex !== index) abearcMapEditingImportedPolygonIndex = null;
      activateAbearcImportedPolygon(index);
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
      openAbearcMapMeasureContextMenu(event, index);
    }

    function toggleAbearcImportedPolygonEdit() {
      const index = abearcMapImportedPolygonContextIndex;
      if (!activateAbearcImportedPolygon(index)) return;
      abearcMapEditingImportedPolygonIndex = abearcMapEditingImportedPolygonIndex === index ? null : index;
      closeAbearcMapMeasureContextMenu();
      renderAbearcMapMeasure();
      toast(Number.isInteger(abearcMapEditingImportedPolygonIndex) ? 'Click the map to add points; drag or right-click vertices to edit them.' : 'Polygon editing finished.');
    }

    function deleteAbearcImportedPolygonPoint(event, polygonIndex, pointIndex) {
      event.preventDefault();
      event.stopPropagation();
      const polygon = abearcMapImportedPolygons[polygonIndex];
      if (!polygon || abearcMapEditingImportedPolygonIndex !== polygonIndex) return;
      if (polygon.points.length <= 3) return toast('A polygon must keep at least three points.', 'error');
      activateAbearcImportedPolygon(polygonIndex);
      removeAbearcMeasurePointAt(pointIndex);
    }

    function selectAllAbearcImportedPolygons() {
      if (appCurrentView !== 'map' || !abearcMapImportedPolygons.length) return false;
      abearcMapSelectedImportedPolygons = new Set(abearcMapImportedPolygons.map((_, index) => index));
      abearcMapEditingImportedPolygonIndex = null;
      saveAbearcMapMeasure();
      renderAbearcMapMeasure();
      toast(`${abearcMapImportedPolygons.length} polygons selected`);
      return true;
    }

    function renderAbearcMapContours(svg) {
      if (!abearcMapContourData?.paths.length || !abearcMap) return;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', `abearc-map-contours${abearcMapBasemap === 'google-satellite' ? ' is-satellite' : ' is-light-basemap'}`);
      abearcMapContourData.paths.forEach(contour => {
        const points = contour.points.map(point => abearcMap.project(point));
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
        path.setAttribute('class', `abearc-map-contour-line${contour.index ? ' is-index' : ''}`);
        group.appendChild(path);
        if (!contour.index) return;
        const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
        const totalLength = lengths.reduce((sum, length) => sum + length, 0);
        const labelText = String(contour.level);
        if (totalLength < Math.max(80, labelText.length * 7 + 36)) return;
        const labelCount = Math.min(3, Math.max(1, Math.floor(totalLength / 320)));
        for (let labelIndex = 0; labelIndex < labelCount; labelIndex++) {
          const target = totalLength * (labelIndex + 1) / (labelCount + 1);
          let travelled = 0;
          let segmentIndex = 0;
          while (segmentIndex < lengths.length - 1 && travelled + lengths[segmentIndex] < target) travelled += lengths[segmentIndex++];
          const start = points[segmentIndex], end = points[segmentIndex + 1];
          const ratio = lengths[segmentIndex] ? (target - travelled) / lengths[segmentIndex] : 0;
          const x = start.x + (end.x - start.x) * ratio;
          const y = start.y + (end.y - start.y) * ratio;
          let angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
          if (angle > 90) angle -= 180;
          if (angle < -90) angle += 180;
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', x.toFixed(1));
          label.setAttribute('y', y.toFixed(1));
          label.setAttribute('class', 'abearc-map-contour-label');
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
          label.setAttribute('transform', `rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`);
          label.textContent = labelText;
          group.appendChild(label);
        }
      });
      svg.appendChild(group);
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
      renderAbearcMapPhotoAnnotations();
      if (abearcMapContourData && !abearcMapContourData.imported && abearcMapContourData.key !== abearcContourSelectionKey()) {
        abearcMapContourData = null;
        document.getElementById('abearcMapContourPanel')?.classList.add('hidden');
      }
      window.syncAbearcSaltSelection?.();
      renderAbearcMapContours(svg);
      window.renderAbearcSaltLayout?.(svg);
      window.renderAbearcInactiveMeasurements?.(svg, width, height);
      const ramPumpHidesActiveMeasurement = abearcMapMeasureMode === 'distance'
        && String(window.abearcRamPumpHiddenMeasurementId || '')
        && String(window.abearcRamPumpHiddenMeasurementId || '') === String(window.abearcMapActiveMeasurementId || abearcMapActiveMeasurementId || '');
      if (ramPumpHidesActiveMeasurement) return;
      if (abearcMapImportedPolygons.length) {
        const projectedPolygons = abearcMapImportedPolygons.map(polygon => polygon.points.map(point => abearcMap.project(point)));
        const renderOrder = abearcMapImportedPolygons.map((_, index) => index).sort((a, b) => {
          const rank = index => index === abearcMapEditingImportedPolygonIndex ? 2 : abearcMapSelectedImportedPolygons.has(index) ? 1 : 0;
          return rank(a) - rank(b) || a - b;
        });
        renderOrder.forEach(index => {
          const points = projectedPolygons[index];
          const selected = abearcMapSelectedImportedPolygons.has(index);
          const editing = abearcMapEditingImportedPolygonIndex === index;
          const closed = [...points, points[0]];
          const fill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          fill.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
          fill.setAttribute('class', `abearc-map-measure-fill abearc-map-imported-polygon${selected ? ' is-selected' : ''}`);
          fill.addEventListener('click', editing ? addAbearcMeasurePointFromOverlay : event => selectAbearcImportedPolygon(event, index, projectedPolygons));
          fill.addEventListener('wheel', forwardAbearcMapWheelFromOverlay, { passive: false });
          fill.addEventListener('contextmenu', event => openAbearcImportedPolygonContextMenu(event, index));
          svg.appendChild(fill);
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          line.setAttribute('points', closed.map(point => `${point.x},${point.y}`).join(' '));
          line.setAttribute('class', `abearc-map-measure-line abearc-map-imported-polygon${selected ? ' is-selected' : ''}`);
          line.addEventListener('click', editing ? addAbearcMeasurePointFromOverlay : event => selectAbearcImportedPolygon(event, index, projectedPolygons));
          line.addEventListener('wheel', forwardAbearcMapWheelFromOverlay, { passive: false });
          line.addEventListener('contextmenu', event => openAbearcImportedPolygonContextMenu(event, index));
          svg.appendChild(line);
          if (editing) points.forEach((point, pointIndex) => {
            if (abearcMapHiddenMeasurePointIndexes.has(pointIndex)) return;
            const activePoint = selected && abearcMapMeasurePoints === abearcMapImportedPolygons[index].points
              && pointIndex === abearcMapLastTouchedMeasureIndex;
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', point.x);
            marker.setAttribute('cy', point.y);
            marker.setAttribute('r', 7);
            if (selected) marker.setAttribute('data-measure-point-index', pointIndex);
            marker.setAttribute('class', `abearc-map-measure-point abearc-map-imported-point${selected ? ' is-selected' : ''}${activePoint ? ' is-active' : ''}${editing ? ' is-editing' : ''}`);
            marker.addEventListener('pointerdown', event => startAbearcMeasureDrag(event, pointIndex));
            marker.addEventListener('dblclick', event => deleteAbearcImportedPolygonPoint(event, index, pointIndex));
            marker.addEventListener('contextmenu', event => openAbearcMapMeasurePointContextMenu(event, pointIndex));
            svg.appendChild(marker);
          });
          if (editing) {
            points.forEach((point, pointIndex) => {
              const nextIndex = (pointIndex + 1) % points.length;
              const next = points[nextIndex];
              addMeasureLabel(
                svg,
                formatAbearcDistance(haversineMetres(abearcMapImportedPolygons[index].points[pointIndex], abearcMapImportedPolygons[index].points[nextIndex])),
                (point.x + next.x) / 2,
                (point.y + next.y) / 2
              );
            });
          }
          const center = abearcScreenInteriorPoint(points);
          if (!abearcMapAdministrativeMeasureActive) {
            const label = addMeasureLabel(svg, `${(abearcPolygonArea(abearcMapImportedPolygons[index].points) / 10000).toFixed(2)} ha`, center.x, center.y, true);
            label.classList.add('is-imported');
            label.classList.toggle('is-selected', selected);
          }
          if (selected && abearcMapSelectedImportedPolygons.size === 1
              && abearcMapMeasurePoints === abearcMapImportedPolygons[index].points) {
            renderAbearcMapMeasureAnnotations(svg, points, width, height);
          }
        });
        return;
      }
      const generatedGravityPath = Boolean(window.isGeneratedAbearcGravityPath?.());
      const generatedEndIndex = generatedGravityPath ? window.abearcGravityPathEndIndex() : -1;
      const pts = abearcMapMeasurePoints.map(p => abearcMap.project(p));
      if (pts.length > 1) {
        const isAreaPolygon = abearcMapMeasureMode === 'area' && pts.length > 2;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        const linePts = isAreaPolygon ? [...pts, pts[0]] : pts;
        if (abearcMapMeasureMode === 'distance' || isAreaPolygon) {
          const hit = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          hit.setAttribute('points', linePts.map(p => `${p.x},${p.y}`).join(' '));
          hit.setAttribute('class', 'abearc-map-measure-hit');
          hit.addEventListener('click', addAbearcMeasurePointFromOverlay);
          hit.addEventListener('wheel', forwardAbearcMapWheelFromOverlay, { passive: false });
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
          fill.addEventListener('click', addAbearcMeasurePointFromOverlay);
          fill.addEventListener('wheel', forwardAbearcMapWheelFromOverlay, { passive: false });
          fill.addEventListener('contextmenu', openAbearcMapMeasureContextMenu);
          svg.insertBefore(fill, poly);
        }
      }
      pts.forEach((p, i) => {
        if (generatedGravityPath
          ? i === 0 || i === generatedEndIndex || (i > generatedEndIndex && !abearcMapHiddenMeasurePointIndexes.has(i))
          : !abearcMapHiddenMeasurePointIndexes.has(i)) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 7);
          c.setAttribute('data-measure-point-index', i);
          c.setAttribute('class', `abearc-map-measure-point${i === abearcMapLastTouchedMeasureIndex ? ' is-active' : ''}`);
          c.addEventListener('pointerdown', event => startAbearcMeasureDrag(event, i));
          c.addEventListener('dblclick', event => deleteAbearcMeasurePoint(event, i));
          c.addEventListener('contextmenu', event => openAbearcMapMeasurePointContextMenu(event, i));
          svg.appendChild(c);
        }
        if (i > 0 && !generatedGravityPath) {
          const mid = { x: (pts[i - 1].x + p.x) / 2, y: (pts[i - 1].y + p.y) / 2 };
          addMeasureLabel(svg, formatAbearcDistance(haversineMetres(abearcMapMeasurePoints[i - 1], abearcMapMeasurePoints[i])), mid.x, mid.y);
        }
      });
      if (abearcMapMeasureMode === 'area' && abearcMapMeasurePoints.length > 2) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        addMeasureLabel(svg, formatAbearcDistance(haversineMetres(abearcMapMeasurePoints[abearcMapMeasurePoints.length - 1], abearcMapMeasurePoints[0])), (last.x + first.x) / 2, (last.y + first.y) / 2);
        const center = abearcScreenInteriorPoint(pts);
        addMeasureLabel(svg, `${(abearcPolygonArea(abearcMapMeasurePoints) / 10000).toFixed(2)} ha`, center.x, center.y, true);
        renderAbearcMapMeasureAnnotations(svg, pts, width, height);
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
      if (!generatedGravityPath) renderAbearcMapMeasureAnnotations(svg, pts, width, height);
    }

    function renderAbearcMapMeasureAnnotations(svg, points, width, height, photos = false) {
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = '750 11px Arial, sans-serif';
      (photos ? abearcMapPhotoAnnotations : abearcMapElevationAnnotations).forEach((annotation, index) => {
        const anchor = points[index];
        if (!anchor || (!photos && abearcMapHiddenMeasurePointIndexes.has(index))) return;
        const labelWidth = Math.max(60, Math.min(width - 16, Math.ceil(measure.measureText(annotation.text).width) + 16));
        const labelX = Math.max(8, Math.min(width - labelWidth - 8, anchor.x + annotation.mapDx));
        const labelY = Math.max(18, Math.min(height - 8, anchor.y + annotation.mapDy));
        const guideX = anchor.x - labelX;
        const guideY = anchor.y - labelY;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `abearc-map-measure-annotation${abearcMapBasemap === 'google-satellite' ? ' is-satellite' : ' is-light-basemap'}`);
        group.setAttribute(photos ? 'data-photo-annotation-id' : 'data-measure-point-index', index);
        group.setAttribute('transform', `translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})`);
        group.innerHTML = `<line x1="${guideX.toFixed(1)}" y1="${guideY.toFixed(1)}" x2="${Math.max(-4, Math.min(labelWidth - 4, guideX)).toFixed(1)}" y2="${Math.max(-15, Math.min(7, guideY)).toFixed(1)}"/><rect x="-4" y="-15" width="${labelWidth}" height="22" rx="4"/><text x="3" y="0">${esc(annotation.text)}</text>`;
        const guide = group.querySelector('line');
        const guideLayer = photos ? document.querySelector('[data-map-annotation-guide-layer]') : null;
        const guideGroup = guideLayer ? group.cloneNode(false) : null;
        if (guideGroup) {
          guideGroup.removeAttribute('data-photo-annotation-id');
          guideGroup.appendChild(guide);
          guideLayer.appendChild(guideGroup);
        }
        group.addEventListener('contextmenu', event => photos ? openAbearcMapPhotoContextMenu(event, index, null, false, true) : openAbearcElevationAnnotationContextMenu(event, index));
        group.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          closeAbearcMapMeasureContextMenu();
          if (photos) rememberAbearcMapView();
          else rememberAbearcMapMeasureState();
          group.setPointerCapture(event.pointerId);
          group.classList.add('is-dragging');
          abearcMap?.dragPan?.disable();
          const move = moveEvent => {
            const bounds = (svg.ownerSVGElement || svg).getBoundingClientRect();
            const x = Math.max(8, Math.min(width - labelWidth - 8, moveEvent.clientX - bounds.left));
            const y = Math.max(18, Math.min(height - 8, moveEvent.clientY - bounds.top));
            const relativeX = anchor.x - x;
            const relativeY = anchor.y - y;
            group.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
            guideGroup?.setAttribute('transform', group.getAttribute('transform'));
            guide?.setAttribute('x1', relativeX.toFixed(1));
            guide?.setAttribute('y1', relativeY.toFixed(1));
            guide?.setAttribute('x2', Math.max(-4, Math.min(labelWidth - 4, relativeX)).toFixed(1));
            guide?.setAttribute('y2', Math.max(-15, Math.min(7, relativeY)).toFixed(1));
            Object.assign(annotation, { mapDx: x - anchor.x, mapDy: y - anchor.y });
          };
          const stop = () => {
            group.classList.remove('is-dragging');
            group.removeEventListener('pointermove', move);
            group.removeEventListener('pointerup', stop);
            group.removeEventListener('pointercancel', stop);
            abearcMap?.dragPan?.enable();
            if (!photos) saveAbearcMapMeasure();
          };
          group.addEventListener('pointermove', move);
          group.addEventListener('pointerup', stop);
          group.addEventListener('pointercancel', stop);
        });
        svg.appendChild(group);
      });
    }

    function addMeasureLabel(svg, text, x, y, total = false) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = text;
      label.setAttribute('x', x);
      label.setAttribute('y', y);
      label.setAttribute('class', total ? 'abearc-map-measure-label is-total' : 'abearc-map-measure-label');
      svg.appendChild(label);
      return label;
    }

    for (const eventName of ['pointerdown', 'click', 'wheel', 'keydown']) {
      document.addEventListener(eventName, event => {
        if (appCurrentView !== 'map' || !event.target?.closest?.('#mapPage')) return;
        if (eventName === 'keydown' && ['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) return;
        if (!event.target.closest('[data-map-measure-panel]')) minimizeIdleAbearcMapMeasureTools();
        if (!event.target.closest('[data-map-photo-context-menu]')) closeAbearcMapPhotoContextMenu();
      }, { capture: true, passive: true });
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
      if (appCurrentView !== 'map' || event.repeat || event.shiftKey
          || !(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 'z'
          || event.target?.closest?.('input:not([type="checkbox"]):not([type="range"]), textarea, [contenteditable="true"]')
          || document.querySelector('.map-print, #confirmModal:not(.hidden), [data-abearc-map-edit-modal]:not(.hidden)')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      undoAbearcMapChange();
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Alt' && appCurrentView === 'map') {
        event.preventDefault();
        abearcMapAltHeld = true;
      }
      if (appCurrentView === 'map' && event.key === 'Escape' && abearcMapSelectedImportedPolygons.size
          && !event.target?.closest?.('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]')
          && !document.querySelector('#confirmModal:not(.hidden), [data-abearc-map-edit-modal]:not(.hidden)')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        abearcMapSelectedImportedPolygons.clear();
        abearcMapEditingImportedPolygonIndex = null;
        closeAbearcMapMeasureContextMenu();
        saveAbearcMapMeasure();
        renderAbearcMapMeasure();
        toast('Polygon selection cleared');
        return;
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
        const measurePointMenu = document.getElementById('abearcMapMeasurePointContextMenu');
        if (measurePointMenu && !measurePointMenu.classList.contains('hidden')) return closeAbearcMapMeasureContextMenu();
        const annotationMenu = document.querySelector('[data-map-elevation-annotation-menu]');
        if (annotationMenu && !annotationMenu.classList.contains('hidden')) return closeAbearcMapMeasureContextMenu();
        const contourPanel = document.getElementById('abearcMapContourPanel');
        if (contourPanel && !contourPanel.classList.contains('hidden')) return closeAbearcContourLines();
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
        if (abearcMapViewportTimelineVisible) {
          event.preventDefault();
          return dismissAbearcMapViewportTimelineStep();
        }
        if (document.body.classList.contains('abearc-map-fullpage')) return toggleAbearcMapFullPage(false);
        if (abearcMapExploded?.features?.length) {
          collapseAbearcMapExplosion();
          return;
        }
        const typingTarget = Boolean(event.target?.closest?.('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]'));
        const dialogOpen = Boolean(document.querySelector('#confirmModal:not(.hidden), [data-abearc-map-edit-modal]:not(.hidden), .map-print'));
        if (!typingTarget && !dialogOpen && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          fitAbearcMapToDavaoCity();
        }
      }
    });

    document.addEventListener('keyup', event => {
      if (event.key !== 'Alt') return;
      if (appCurrentView === 'map') event.preventDefault();
      abearcMapAltHeld = false;
      if (appCurrentView === 'map' && abearcMapExploded?.collapseOnAltRelease) collapseAbearcMapExplosion({ reason: 'collapseOnAltRelease' });
    });

    Object.assign(window, {
      showAbearcMap,
      captureAbearcMapMeasureState,
      applyAbearcMapMeasureState,
      clearAbearcMapLayoutPhotoFreeze,
      showAbearcMapLocation,
      submitAbearcMapSearch,
      handleAbearcMapSearchInput,
      handleAbearcMapSearchKeydown,
      renderAbearcMapSearchHistory,
      expandAbearcMapSearch,
      collapseAbearcMapSearchIfIdle,
      setAbearcMapBasemap,
      setAbearcZoningEnabled,
      toggleAbearcZoningLayer,
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
      toggleAbearcMapPhotosVisibility,
      openAbearcMapPhotoUploadModal,
      closeAbearcMapPhotoUploadModal,
      uploadAbearcMapPhotos,
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
      toggleAbearcEnvironmentalPanel,
      fitAbearcClimateToPhilippines,
      startAbearcClimatePointSelection,
      reloadAbearcMap,
      focusAbearcMapPhoto,
      openAbearcMapResultPhoto,
      zoomAbearcMapPhotoToTenMeterScale,
      reloadAbearcMapForSearch,
      scheduleAbearcMapReload,
      toggleAbearcMapFilters,
      toggleAbearcMapViewportTimelineVisibility,
      toggleAbearcMapViewportTimelineCollapsed,
      toggleAbearcMapViewportTimelineDateSelection,
      handleAbearcMapViewportTimelineKey,
      toggleAbearcMapResults,
      resetAbearcMapView,
      resetAbearcMapChanges,
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
      importAbearcMapMeasureKml,
      selectAllAbearcImportedPolygons,
      setAbearcElevationSource,
      refreshAbearcElevationProfile,
      showAbearcElevationProfile,
      closeAbearcElevationProfile,
      showAbearcContourLines,
      closeAbearcContourLines,
      setAbearcContourSource,
      applyAbearcContourSettings,
      exportAbearcContourKml,
      closeAbearcMapMeasureContextMenu,
      openAbearcMapListContextMenu,
      annotateAbearcMapPhotos,
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
      expandAbearcMapPhoto,
      collapseAbearcMapPhoto,
      deleteAbearcMapPhotoFromContext,
      deleteAllAbearcMapPhotos
    });
