/* ABEARC gravity-flow path finder for Distance measurements.
 * Fast hierarchical terrain routing:
 *   1) endpoint + straight-line feasibility checks
 *   2) adaptive coarse A* corridors
 *   3) fine A* refinement only around a promising coarse route
 *   4) reusable DEM sample cache between stages/runs
 * Ascent is prioritized before distance; downhill-only rejects climbing routes.
 */
let abearcMapGravityPathMeta = null;
let abearcMapGravityPathAbort = null;
let abearcMapGravityPathRequestId = 0;
let abearcMapGravityProgressCancel = null;
let abearcMapGravityProgressValue = 0;

// Small rises are allowed only in the explicitly selected minimum-ascent mode.
// Downhill-only uses a numerical epsilon, never a DEM-noise allowance.
let ABEARC_GRAVITY_ASCENT_TOLERANCE_M = 0.10;
let abearcGravityRoutingMode = 'minimum-ascent';
const ABEARC_GRAVITY_NUMERIC_EPSILON_M = 1e-6;
function abearcGravitySetRoutingMode(mode) {
  abearcGravityRoutingMode = mode === 'downhill-only' ? mode : 'minimum-ascent';
  ABEARC_GRAVITY_ASCENT_TOLERANCE_M = abearcGravityRoutingMode === 'downhill-only' ? ABEARC_GRAVITY_NUMERIC_EPSILON_M : 0.10;
}
const ABEARC_GRAVITY_MAX_CORRIDOR_M = 2500;
const ABEARC_GRAVITY_LOCAL_COARSE_BUDGET = 5000;
const ABEARC_GRAVITY_REMOTE_COARSE_BUDGET = 1800;
const ABEARC_GRAVITY_LOCAL_FINE_BUDGET = 12000;
const ABEARC_GRAVITY_REMOTE_FINE_BUDGET = 3600;
// When the coarse grid says "no path", retry the complete corridor more
// densely instead of assuming that a narrow descending route does not exist.
const ABEARC_GRAVITY_LOCAL_ANY_ROUTE_BUDGET = 50000;
const ABEARC_GRAVITY_REMOTE_ANY_ROUTE_BUDGET = 9000;
const ABEARC_GRAVITY_CACHE_LIMIT = 30000;
const ABEARC_GRAVITY_ELEVATION_BATCH_SIZE = 300;
// Raster-cell-center routing can miss a real path that follows an interpolated
// contour between DEM samples. The contour-rescue stage traces equal-elevation
// lines on the sampled surface, then only crosses to lower contours through
// segments that are independently checked to be non-ascending.
const ABEARC_GRAVITY_CONTOUR_LEVEL_STEP_M = 2;
const ABEARC_GRAVITY_CONTOUR_MAX_LEVELS = 120;
const ABEARC_GRAVITY_CONTOUR_MAX_LINK_M = 600;
const abearcGravityElevationCache = new Map();

// Gravity Flow Path is intentionally locked to the local NAMRIA 5 m DTM.
// Other elevation datasets remain available to the rest of ABEARC, but they
// are not selectable or accepted by the gravity-flow routing tool.
const ABEARC_GRAVITY_SOURCE_KEY = 'namria-dtm5-prs92';
const ABEARC_GRAVITY_SOURCE_OPTIONS = [
  { key: ABEARC_GRAVITY_SOURCE_KEY, label: 'NAMRIA DTM 5 m (PRS92)', detail: 'Local Davao City terrain model · about 5 m resolution', recommended: true }
];

function abearcGravityGeometryKey(points = abearcMapMeasurePoints) {
  return (Array.isArray(points) ? points : []).map(point => `${Number(point?.[0]).toFixed(7)},${Number(point?.[1]).toFixed(7)}`).join('|');
}

function sanitizeAbearcGravityPathState(value) {
  if (!value || typeof value !== 'object') return null;
  const geometryKey = String(value.geometryKey || '').slice(0, 200000);
  if (!geometryKey) return null;
  const number = (candidate, fallback = 0) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
  return {
    version: 2,
    geometryKey,
    endPointIndex: Math.max(0, Math.floor(number(value.endPointIndex, geometryKey.split('|').length - 1))),
    sourceKey: String(value.sourceKey || '').slice(0, 80),
    sourceLabel: String(value.sourceLabel || '').slice(0, 160),
    startElevationM: number(value.startElevationM),
    endElevationM: number(value.endElevationM),
    totalDropM: number(value.totalDropM),
    routeDistanceM: number(value.routeDistanceM),
    straightDistanceM: number(value.straightDistanceM),
    corridorM: number(value.corridorM),
    gridSpacingM: number(value.gridSpacingM),
    coarseGridSpacingM: Math.max(0, number(value.coarseGridSpacingM)),
    ascentToleranceM: number(value.ascentToleranceM, ABEARC_GRAVITY_ASCENT_TOLERANCE_M),
    maximumStepAscentM: Math.max(0, number(value.maximumStepAscentM)),
    totalAscentM: Math.max(0, number(value.totalAscentM)),
    maximumContinuousClimbM: Math.max(0, number(value.maximumContinuousClimbM)),
    routingMode: value.routingMode === 'downhill-only' ? 'downhill-only' : 'minimum-ascent',
    searchStrategy: String(value.searchStrategy || 'hierarchical-a-star').slice(0, 80),
    createdAt: String(value.createdAt || new Date().toISOString()).slice(0, 40)
  };
}

function captureAbearcGravityPathState() {
  if (!abearcMapGravityPathMeta) return null;
  return sanitizeAbearcGravityPathState(abearcMapGravityPathMeta);
}

function restoreAbearcGravityPathState(value) {
  const next = sanitizeAbearcGravityPathState(value);
  abearcMapGravityPathMeta = next;
  return Boolean(next);
}

function isGeneratedAbearcGravityPath() {
  return Boolean(abearcMapGravityPathMeta
    && abearcMapMeasureMode === 'distance'
    && abearcMapMeasurePoints.length >= 2);
}

function abearcGravityPathEndIndex() {
  return isGeneratedAbearcGravityPath()
    ? Math.min(abearcMapGravityPathMeta.endPointIndex, abearcMapMeasurePoints.length - 1) : -1;
}

function adjustAbearcGravityPathEndpoint(index, change) {
  if (abearcMapGravityPathMeta && index <= abearcMapGravityPathMeta.endPointIndex) {
    abearcMapGravityPathMeta.endPointIndex = Math.max(0, abearcMapGravityPathMeta.endPointIndex + change);
  }
}

function isAbearcGravityPathActive() {
  return isGeneratedAbearcGravityPath()
    && abearcMapGravityPathMeta.geometryKey === abearcGravityGeometryKey();
}

function abearcGravitySourceLabel(sourceKey) {
  const labels = {
    'namria-dtm5-prs92': 'NAMRIA DTM 5 m (PRS92)',
    'aws-copernicus-glo30': 'AWS Copernicus GLO-30 DSM',
    'copernicus-glo90': 'Copernicus GLO-90 DSM',
    'aws-copernicus-glo90': 'AWS Copernicus GLO-90 DSM',
    'aws-mapzen': 'AWS Terrain Tiles (Mapzen)',
    'opentopo-srtm30': 'Open Topo Data SRTM Radar DEM'
  };
  return labels[sourceKey] || String(sourceKey || 'Selected elevation source');
}

function abearcGravityCurrentSource() {
  return ABEARC_GRAVITY_SOURCE_KEY;
}

function abearcGravitySourcePickerMarkup() {
  const option = ABEARC_GRAVITY_SOURCE_OPTIONS[0];
  return `<div class="abearc-gravity-source-picker text-left">
    <p class="text-sm text-slate-700">Gravity Flow Path uses the local NAMRIA terrain model only.</p>
    <div class="abearc-gravity-source-list"><div class="abearc-gravity-source-option">
      <span class="abearc-gravity-source-copy">
        <span class="abearc-gravity-source-title"><strong>${esc(option.label)}</strong><em>Required</em></span>
        <small>${esc(option.detail)}</small>
      </span>
    </div></div>
    <label class="abearc-gravity-source-option"><span class="abearc-gravity-source-copy"><strong>Routing goal</strong><select data-gravity-routing-mode aria-label="Routing goal" class="w-full rounded border border-slate-300 p-2 mt-1"><option value="minimum-ascent">Minimize ascent</option><option value="downhill-only">Downhill only</option></select><small>Minimize ascent prioritizes less uphill travel before distance; small rises may remain. Downhill only rejects climbing routes and may find no path.</small></span></label>
    <label class="abearc-gravity-source-option"><input type="checkbox" data-gravity-uniform-slope checked><span class="abearc-gravity-source-copy"><strong>Prefer a more uniform downhill slope</strong><small>Check gentler connections without increasing ascent. Adds processing time; terrain may prevent a uniform slope.</small></span></label>
    <p class="abearc-gravity-source-lock-note"><strong>Source lock:</strong> routing, generated contours, final validation, and the resulting elevation profile all use NAMRIA DTM 5 m (PRS92).</p>
  </div>`;
}

async function chooseAbearcGravitySource() {
  const confirmed = await confirmModalChoice(abearcGravitySourcePickerMarkup(), {
    title: 'Gravity Flow Path',
    confirmText: 'Find Gravity Path',
    confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
  });
  return confirmed ? ABEARC_GRAVITY_SOURCE_KEY : '';
}

function abearcGravityProgressElement() {
  if (typeof document === 'undefined' || !document.body) return null;
  let panel = document.getElementById('abearcGravityPathProgress');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'abearcGravityPathProgress';
  panel.className = 'abearc-gravity-progress hidden';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="abearc-gravity-progress-head">
      <div>
        <strong>Finding gravity-flow path</strong>
        <span data-gravity-progress-stage>Preparing terrain search…</span>
      </div>
      <button type="button" data-gravity-progress-cancel aria-label="Cancel gravity-flow path calculation">Cancel</button>
    </div>
    <div class="abearc-gravity-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div data-gravity-progress-bar></div>
    </div>
    <div class="abearc-gravity-progress-foot">
      <span data-gravity-progress-detail>Preparing…</span>
      <strong data-gravity-progress-percent>0%</strong>
    </div>`;
  panel.querySelector('[data-gravity-progress-cancel]')?.addEventListener('click', () => abearcMapGravityProgressCancel?.());
  document.body.appendChild(panel);
  return panel;
}

function showAbearcGravityProgress(cancelHandler) {
  abearcMapGravityProgressCancel = cancelHandler || null;
  abearcMapGravityProgressValue = 0;
  const panel = abearcGravityProgressElement();
  if (!panel) return;
  panel.classList.remove('hidden');
  updateAbearcGravityProgress(1, 'Preparing terrain search…', 'Checking the selected distance measurement.');
}

function updateAbearcGravityProgress(percent, stage, detail = '') {
  const panel = abearcGravityProgressElement();
  if (!panel) return;
  const requestedPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const safePercent = Math.max(abearcMapGravityProgressValue, requestedPercent);
  abearcMapGravityProgressValue = safePercent;
  const bar = panel.querySelector('[data-gravity-progress-bar]');
  const track = panel.querySelector('.abearc-gravity-progress-track');
  const percentLabel = panel.querySelector('[data-gravity-progress-percent]');
  const stageLabel = panel.querySelector('[data-gravity-progress-stage]');
  const detailLabel = panel.querySelector('[data-gravity-progress-detail]');
  if (bar) bar.style.width = `${safePercent}%`;
  track?.setAttribute('aria-valuenow', String(safePercent));
  if (percentLabel) percentLabel.textContent = `${safePercent}%`;
  if (stageLabel && stage) stageLabel.textContent = String(stage);
  if (detailLabel) detailLabel.textContent = String(detail || '');
}

function hideAbearcGravityProgress() {
  abearcMapGravityProgressCancel = null;
  const panel = typeof document === 'undefined' ? null : document.getElementById('abearcGravityPathProgress');
  panel?.classList.add('hidden');
}

function abearcGravityCacheKey(sourceKey, location) {
  return `${sourceKey}:${Number(location.latitude).toPrecision(15)}:${Number(location.longitude).toPrecision(15)}`;
}

function abearcGravityCacheSet(sourceKey, location, elevation) {
  const key = abearcGravityCacheKey(sourceKey, location);
  if (abearcGravityElevationCache.has(key)) abearcGravityElevationCache.delete(key);
  abearcGravityElevationCache.set(key, Number(elevation));
  while (abearcGravityElevationCache.size > ABEARC_GRAVITY_CACHE_LIMIT) {
    const firstKey = abearcGravityElevationCache.keys().next().value;
    if (firstKey == null) break;
    abearcGravityElevationCache.delete(firstKey);
  }
}

function clearAbearcGravityElevationCache() {
  abearcGravityElevationCache.clear();
}

async function abearcGravityFetchElevations(locations, signal, requestedSourceKey, progressStart = 0, progressEnd = 100, progressLabel = 'Sampling terrain') {
  const sourceKey = requestedSourceKey || abearcGravityCurrentSource();
  const output = new Array(locations.length).fill(NaN);
  const missingIndexes = [];
  for (let index = 0; index < locations.length; index++) {
    const cached = abearcGravityElevationCache.get(abearcGravityCacheKey(sourceKey, locations[index]));
    if (Number.isFinite(cached)) output[index] = Number(cached);
    else missingIndexes.push(index);
  }
  const cachedCount = locations.length - missingIndexes.length;
  if (!missingIndexes.length) {
    updateAbearcGravityProgress(progressEnd, progressLabel, `${locations.length.toLocaleString()} terrain samples reused from cache.`);
    return { elevations: output, sourceKey, sourceLabel: abearcGravitySourceLabel(sourceKey), cachedCount, fetchedCount: 0 };
  }

  let effectiveSourceKey = sourceKey;
  let sourceLabel = abearcGravitySourceLabel(sourceKey);
  let fetchedCount = 0;
  for (let offset = 0; offset < missingIndexes.length; offset += ABEARC_GRAVITY_ELEVATION_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Calculation cancelled', 'AbortError');
    const batchIndexes = missingIndexes.slice(offset, offset + ABEARC_GRAVITY_ELEVATION_BATCH_SIZE);
    const batchLocations = batchIndexes.map(index => locations[index]);
    const result = await requestAbearcElevations(batchLocations, signal, effectiveSourceKey, false);
    const values = Array.isArray(result.elevations) ? result.elevations.map(Number) : [];
    if (values.length !== batchLocations.length || values.some(value => !Number.isFinite(value))) {
      throw new Error('The selected elevation source did not return complete terrain data.');
    }
    if (result.sourceKey && result.sourceKey !== effectiveSourceKey) {
      throw new Error(`Gravity Flow Path is locked to ${abearcGravitySourceLabel(effectiveSourceKey)}; the terrain service returned a different source.`);
    }
    effectiveSourceKey = result.sourceKey || effectiveSourceKey;
    sourceLabel = result.sourceLabel || sourceLabel;
    values.forEach((value, batchIndex) => {
      const outputIndex = batchIndexes[batchIndex];
      output[outputIndex] = value;
      abearcGravityCacheSet(effectiveSourceKey, locations[outputIndex], value);
    });
    fetchedCount += values.length;
    const fraction = missingIndexes.length ? fetchedCount / missingIndexes.length : 1;
    const progress = progressStart + (progressEnd - progressStart) * fraction;
    updateAbearcGravityProgress(progress, progressLabel,
      `${Math.min(fetchedCount, missingIndexes.length).toLocaleString()} / ${missingIndexes.length.toLocaleString()} new samples${cachedCount ? ` · ${cachedCount.toLocaleString()} cached` : ''}`);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { elevations: output, sourceKey: effectiveSourceKey, sourceLabel, cachedCount, fetchedCount };
}


async function abearcGravityFetchServerPath(start, end, signal, sourceKey, corridorM = ABEARC_GRAVITY_MAX_CORRIDOR_M) {
  const response = await fetch(`${API}/map/gravity-path`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: sourceKey,
      routing_mode: abearcGravityRoutingMode,
      start: { longitude: Number(start[0]), latitude: Number(start[1]) },
      end: { longitude: Number(end[0]), latitude: Number(end[1]) },
      corridor_m: Math.max(25, Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, Number(corridorM) || ABEARC_GRAVITY_MAX_CORRIDOR_M))
    }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Server gravity-flow routing is unavailable.');
  if (!data.found) return {
    found: false,
    sourceKey: String(data.sourceKey || sourceKey),
    sourceLabel: String(data.sourceLabel || abearcGravitySourceLabel(sourceKey)),
    corridorM: Number(data.corridorM) || corridorM,
    nativeSpacingM: Math.max(Number(data.pixelWidthM) || 0, Number(data.pixelHeightM) || 0, 5),
    startElevationM: Number(data.startElevationM),
    endElevationM: Number(data.endElevationM),
    activeCount: Number(data.activeCount) || 0,
    reverseReachableCount: Number(data.reverseReachableCount) || 0,
    maskedAStarExpandedCount: Number(data.maskedAStarExpandedCount) || 0,
    bottleneckCount: Number(data.bottleneckCount) || 0,
    reverseAnyAngleEdgesUsed: Number(data.reverseAnyAngleEdgesUsed) || 0,
    refinementStages: Array.isArray(data.refinementStages) ? data.refinementStages.map(String) : [],
    routeGuidedRefinement: Boolean(data.routeGuidedRefinement),
    guideBufferM: Number(data.guideBufferM) || 0,
    subcellAttempted: Boolean(data.subcellAttempted),
    subcellSpacingM: Number(data.subcellSpacingM) || 0,
    nativeContourGenerated: Boolean(data.nativeContourGenerated),
    nativeContourIntervalM: Number(data.nativeContourIntervalM) || 0,
    nativeContourSegmentCount: Number(data.nativeContourSegmentCount) || 0,
    nativeContourPointCount: Number(data.nativeContourPointCount) || 0,
    nativeContourOverflow: Boolean(data.nativeContourOverflow),
    nativeContourPaths: (Array.isArray(data.nativeContourPaths) ? data.nativeContourPaths : [])
      .map(path => ({
        level: Number(path?.level),
        points: (Array.isArray(path?.points) ? path.points : [])
          .map(point => [Number(point?.[0]), Number(point?.[1])])
          .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]))
      }))
      .filter(path => Number.isFinite(path.level) && path.points.length > 1)
  };
  const locations = (Array.isArray(data.locations) ? data.locations : [])
    .map(point => ({ longitude: Number(point?.longitude), latitude: Number(point?.latitude) }))
    .filter(point => Number.isFinite(point.longitude) && Number.isFinite(point.latitude));
  const elevations = (Array.isArray(data.elevations) ? data.elevations : []).map(Number);
  if (locations.length < 2 || elevations.length !== locations.length || elevations.some(value => !Number.isFinite(value))) {
    throw new Error('Server gravity-flow routing returned incomplete route data.');
  }
  const indexes = locations.map((_, index) => index);
  const straightDistanceM = haversineMetres(start, end);
  return {
    found: true,
    plan: {
      rows: 1,
      columns: locations.length,
      startIndex: 0,
      endIndex: locations.length - 1,
      straightDistanceM,
      corridorM: Number(data.corridorM) || corridorM,
      spacingM: Boolean(data.subcellInterpolated)
        ? Math.max(Number(data.pixelWidthM) || 0, Number(data.pixelHeightM) || 0, 1)
        : Math.max(Number(data.pixelWidthM) || 0, Number(data.pixelHeightM) || 0, 5),
      alongStepM: Math.max(Number(data.pixelWidthM) || (data.subcellInterpolated ? 2.5 : 5), 1),
      crossStepM: Math.max(Number(data.pixelHeightM) || (data.subcellInterpolated ? 2.5 : 5), 1),
      locations,
      local: locations.map((_, index) => ({ x: index, y: 0 }))
    },
    elevations,
    indexes,
    sourceKey: String(data.sourceKey || sourceKey),
    sourceLabel: String(data.sourceLabel || abearcGravitySourceLabel(sourceKey)),
    coarseSpacingM: 0,
    validatedMaximumStepAscentM: Number(data.maximumRawStepAscentM) || 0,
    totalRawAscentM: Number(data.totalRawAscentM) || 0,
    acceptedToleranceM: Number(data.acceptedToleranceM) || ABEARC_GRAVITY_ASCENT_TOLERANCE_M,
    noiseCorrected: Boolean(data.noiseCorrected),
    subcellInterpolated: Boolean(data.subcellInterpolated),
    subcellSpacingM: Number(data.subcellSpacingM) || 0,
    reverseReachableCount: Number(data.reverseReachableCount) || 0,
    maskedAStarExpandedCount: Number(data.maskedAStarExpandedCount) || 0,
    bottleneckCount: Number(data.bottleneckCount) || 0,
    pathBottleneckCount: Number(data.pathBottleneckCount) || 0,
    reverseAnyAngleEdgesUsed: Number(data.reverseAnyAngleEdgesUsed) || 0,
    refinementStages: Array.isArray(data.refinementStages) ? data.refinementStages.map(String) : [],
    routeGuidedRefinement: Boolean(data.routeGuidedRefinement),
    guideBufferM: Number(data.guideBufferM) || 0,
    bottleneckRefined: Boolean(data.bottleneckRefined),
    strategy: String(data.strategy || (sourceKey === 'namria-dtm5-prs92' ? 'native-namria-all-descent' : 'remote-source-reverse-mask-masked-a-star'))
  };
}

function abearcGravityLocalFrame(start, end) {
  const straightDistanceM = haversineMetres(start, end);
  if (!(straightDistanceM > 0.5)) throw new Error('The distance measurement is too short to calculate a terrain route.');
  const middleLatitude = (Number(start[1]) + Number(end[1])) / 2;
  const metresPerLongitudeDegree = Math.max(1, 111320 * Math.cos(middleLatitude * Math.PI / 180));
  const metresPerLatitudeDegree = 110574;
  const eastM = (Number(end[0]) - Number(start[0])) * metresPerLongitudeDegree;
  const northM = (Number(end[1]) - Number(start[1])) * metresPerLatitudeDegree;
  const localLengthM = Math.max(0.001, Math.hypot(eastM, northM));
  const alongEast = eastM / localLengthM;
  const alongNorth = northM / localLengthM;
  // Match the routing axis to the distance used by every grid and contour.
  // Mixing geodesic length with unscaled local metres moved the final endpoint.
  const scale = straightDistanceM / localLengthM;
  return {
    straightDistanceM,
    metresPerLongitudeDegree: metresPerLongitudeDegree * scale,
    metresPerLatitudeDegree: metresPerLatitudeDegree * scale,
    alongEast,
    alongNorth,
    crossEast: -alongNorth,
    crossNorth: alongEast
  };
}

function abearcGravityLocalToLngLat(start, frame, x, y) {
  const offsetEastM = frame.alongEast * x + frame.crossEast * y;
  const offsetNorthM = frame.alongNorth * x + frame.crossNorth * y;
  return [
    Number(start[0]) + offsetEastM / frame.metresPerLongitudeDegree,
    Number(start[1]) + offsetNorthM / frame.metresPerLatitudeDegree
  ];
}

function abearcGravityDistanceToSegment(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const vv = vx * vx + vy * vy;
  if (!(vv > 0)) return Math.hypot(wx, wy);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv));
  return Math.hypot(point.x - (a.x + vx * t), point.y - (a.y + vy * t));
}

function abearcGravityDistanceToRoute(point, routeLocal) {
  if (!Array.isArray(routeLocal) || !routeLocal.length) return Infinity;
  if (routeLocal.length === 1) return Math.hypot(point.x - routeLocal[0].x, point.y - routeLocal[0].y);
  let minimum = Infinity;
  for (let index = 1; index < routeLocal.length; index++) {
    minimum = Math.min(minimum, abearcGravityDistanceToSegment(point, routeLocal[index - 1], routeLocal[index]));
  }
  return minimum;
}

function abearcGravityBuildPlan(start, end, options = {}) {
  const frame = abearcGravityLocalFrame(start, end);
  const sourceKey = options.sourceKey || abearcGravityCurrentSource();
  const sourceResolutionM = Math.max(2, Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || 30);
  const requestedSpacingM = Math.max(sourceResolutionM, Number(options.spacingM) || sourceResolutionM);
  const requestedCorridorM = Math.max(requestedSpacingM, Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, Number(options.corridorM) || requestedSpacingM));
  const budget = Math.max(100, Number(options.budget) || ABEARC_GRAVITY_LOCAL_COARSE_BUDGET);
  const routeLocal = Array.isArray(options.routeLocal) ? options.routeLocal : null;
  const routeBufferM = Math.max(sourceResolutionM * 2, Number(options.routeBufferM) || sourceResolutionM * 4);

  // A gravity route sometimes has to move briefly behind Point 1 or beyond
  // Point 2 to get around a ridge. The old grid ended exactly at both endpoint
  // planes, which could incorrectly report "no path" even when a descending
  // detour existed. Keep a longitudinal search margin in addition to the
  // left/right corridor.
  let requestedAlongMarginM = Number(options.alongMarginM);
  if (!Number.isFinite(requestedAlongMarginM)) {
    requestedAlongMarginM = Math.min(
      ABEARC_GRAVITY_MAX_CORRIDOR_M,
      Math.max(sourceResolutionM * 4, Math.min(requestedCorridorM, Math.max(50, frame.straightDistanceM * 0.12)))
    );
  }
  if (routeLocal?.length) {
    const minimumRouteX = Math.min(...routeLocal.map(point => Number(point?.x)).filter(Number.isFinite));
    const maximumRouteX = Math.max(...routeLocal.map(point => Number(point?.x)).filter(Number.isFinite));
    const routeMarginNeeded = Math.max(
      0,
      Number.isFinite(minimumRouteX) ? -minimumRouteX + routeBufferM : 0,
      Number.isFinite(maximumRouteX) ? maximumRouteX - frame.straightDistanceM + routeBufferM : 0
    );
    requestedAlongMarginM = Math.max(requestedAlongMarginM, routeMarginNeeded);
  }
  requestedAlongMarginM = Math.max(0, Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, requestedAlongMarginM));

  let spacingM = requestedSpacingM;
  let coreSegments;
  let marginColumns;
  let columns;
  let halfRows;
  let rows;

  const calculateGridShape = () => {
    coreSegments = Math.max(1, Math.ceil(frame.straightDistanceM / spacingM));
    const alongStep = frame.straightDistanceM / coreSegments;
    marginColumns = Math.max(0, Math.ceil(requestedAlongMarginM / Math.max(0.01, alongStep)));
    columns = coreSegments + marginColumns * 2 + 1;
    halfRows = Math.max(1, Math.ceil(requestedCorridorM / spacingM));
    rows = halfRows * 2 + 1;
    return alongStep;
  };

  if (routeLocal?.length > 1) {
    // Fine refinement is sparse: only cells near the coarse route are sampled.
    // Budget against that narrow ribbon, not the entire bounding rectangle.
    let routeLengthM = 0;
    for (let index = 1; index < routeLocal.length; index++) {
      routeLengthM += Math.hypot(
        routeLocal[index].x - routeLocal[index - 1].x,
        routeLocal[index].y - routeLocal[index - 1].y
      );
    }
    const estimatedCells = Math.max(1, routeLengthM * Math.max(spacingM, routeBufferM * 2) / (spacingM * spacingM));
    if (estimatedCells > budget) spacingM *= Math.sqrt(estimatedCells / budget) * 1.03;
  } else {
    for (let iteration = 0; iteration < 12; iteration++) {
      calculateGridShape();
      if (columns * rows <= budget) break;
      spacingM *= Math.max(1.08, Math.sqrt((columns * rows) / budget) * 1.02);
    }
  }

  const alongStepM = calculateGridShape();
  const crossStepM = spacingM;
  const corridorM = halfRows * crossStepM;
  const alongMarginM = marginColumns * alongStepM;
  const locations = new Array(rows * columns);
  const local = new Array(rows * columns);
  const activeMask = new Uint8Array(rows * columns);
  let activeCount = 0;

  for (let row = 0; row < rows; row++) {
    const y = (row - halfRows) * crossStepM;
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const x = (column - marginColumns) * alongStepM;
      const point = { x, y };
      local[index] = point;
      const [longitude, latitude] = abearcGravityLocalToLngLat(start, frame, x, y);
      locations[index] = { longitude, latitude };
      const active = !routeLocal || abearcGravityDistanceToRoute(point, routeLocal) <= routeBufferM;
      if (active) {
        activeMask[index] = 1;
        activeCount += 1;
      }
    }
  }

  const startColumn = marginColumns;
  const endColumn = marginColumns + coreSegments;
  const startIndex = halfRows * columns + startColumn;
  const endIndex = halfRows * columns + endColumn;
  locations[startIndex] = { longitude: Number(start[0]), latitude: Number(start[1]) };
  locations[endIndex] = { longitude: Number(end[0]), latitude: Number(end[1]) };
  local[startIndex] = { x: 0, y: 0 };
  local[endIndex] = { x: frame.straightDistanceM, y: 0 };
  if (!activeMask[startIndex]) { activeMask[startIndex] = 1; activeCount++; }
  if (!activeMask[endIndex]) { activeMask[endIndex] = 1; activeCount++; }

  return {
    sourceKey,
    sourceResolutionM,
    frame,
    startLngLat: [Number(start[0]), Number(start[1])],
    straightDistanceM: frame.straightDistanceM,
    corridorM,
    alongMarginM,
    budget,
    spacingM: Math.max(alongStepM, crossStepM),
    alongStepM,
    crossStepM,
    rows,
    columns,
    halfRows,
    marginColumns,
    startColumn,
    endColumn,
    startIndex,
    endIndex,
    locations,
    local,
    activeMask,
    activeCount,
    routeBufferM
  };
}

function abearcGravityPlan(start, end, corridorMultiplier = 1) {
  const sourceKey = abearcGravityCurrentSource();
  const sourceResolutionM = Math.max(2, Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || 30);
  const straightDistanceM = haversineMetres(start, end);
  const baseCorridorM = Math.max(sourceResolutionM * 4, Math.min(500, Math.max(75, straightDistanceM * 0.25)));
  const budget = sourceKey === 'namria-dtm5-prs92' ? ABEARC_GRAVITY_LOCAL_COARSE_BUDGET : ABEARC_GRAVITY_REMOTE_COARSE_BUDGET;
  return abearcGravityBuildPlan(start, end, {
    sourceKey,
    corridorM: Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, baseCorridorM * Math.max(1, Number(corridorMultiplier) || 1)),
    spacingM: Math.max(sourceResolutionM * 2.5, 10),
    budget
  });
}

class AbearcGravityMinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  before(a, b) { return a.ascent < b.ascent || (a.ascent === b.ascent && a.priority < b.priority); }
  push(priority, node, ascent = 0) {
    const item = { priority, node, ascent };
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(item, items[parent])) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const tail = items.pop();
    if (!items.length) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      const child = right < items.length && this.before(items[right], items[left]) ? right : left;
      if (!this.before(items[child], tail)) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = tail;
    return root;
  }
}

function abearcGravityFindPathOnGrid(plan, elevations, toleranceM = ABEARC_GRAVITY_ASCENT_TOLERANCE_M) {
  const count = plan.rows * plan.columns;
  if (!Array.isArray(elevations) || elevations.length !== count) return null;
  if (!Number.isFinite(elevations[plan.startIndex]) || !Number.isFinite(elevations[plan.endIndex])) return null;
  if (elevations[plan.endIndex] > elevations[plan.startIndex] + toleranceM) return null;

  // Reverse-reachability search: begin at Point 2 and expand toward terrain
  // that is equal or higher. A node reached this way is proven capable of
  // draining to Point 2 under the same non-ascending rule. This avoids making
  // an early forward choice at Point 1 and extracts the least-ascent route
  // after Point 1 has become reachable.
  const costs = new Float64Array(count); costs.fill(Infinity);
  const ascents = new Float64Array(count); ascents.fill(Infinity);
  const nextTowardOutlet = new Int32Array(count); nextTowardOutlet.fill(-1);
  const closed = new Uint8Array(count);
  const heap = new AbearcGravityMinHeap();
  const startLocal = plan.local[plan.startIndex];
  costs[plan.endIndex] = 0;
  ascents[plan.endIndex] = 0;
  heap.push(0, plan.endIndex);
  const baseOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],            [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  const segmentForwardAscent = (fromIndex, toIndex) => {
    const from = plan.local[fromIndex], to = plan.local[toIndex];
    if (!from || !to) return null;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const baseStep = Math.max(0.75, Math.min(
      Math.max(0.01, Number(plan.alongStepM) || Number(plan.spacingM) || 1),
      Math.max(0.01, Number(plan.crossStepM) || Number(plan.spacingM) || 1)
    ) / 3);
    const samples = Math.max(2, Math.ceil(distance / baseStep));
    let previous = abearcGravityInterpolateLocal(plan, elevations, from);
    if (!Number.isFinite(previous)) return null;
    let ascent = 0;
    for (let step = 1; step <= samples; step++) {
      const ratio = step / samples;
      const point = { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
      const current = abearcGravityInterpolateLocal(plan, elevations, point);
      if (!Number.isFinite(current) || current > previous + toleranceM + 1e-9) return null;
      ascent += Math.max(0, current - previous - 1e-9);
      previous = current;
    }
    return ascent;
  };

  const relax = (current, nextRow, nextColumn, isEscape) => {
    if (nextRow < 0 || nextRow >= plan.rows || nextColumn < 0 || nextColumn >= plan.columns) return false;
    const next = nextRow * plan.columns + nextColumn;
    if (closed[next] || (plan.activeMask && !plan.activeMask[next])) return false;
    const currentElevation = Number(elevations[current]);
    const nextElevation = Number(elevations[next]);
    if (!Number.isFinite(currentElevation) || !Number.isFinite(nextElevation)) return false;
    // Reverse movement from the outlet may only climb (or stay level). The
    // corresponding forward segment therefore descends (or stays level).
    if (nextElevation < currentElevation - toleranceM - 1e-9) return false;
    const segmentAscent = segmentForwardAscent(next, current);
    if (segmentAscent === null) return false;
    const currentPoint = plan.local[current], nextPoint = plan.local[next];
    const moveDistance = Math.max(0.01, Math.hypot(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y));
    const nextCost = costs[current] + moveDistance;
    const nextAscent = ascents[current] + segmentAscent;
    if (nextAscent > ascents[next] || (nextAscent === ascents[next] && nextCost >= costs[next] - 1e-9)) return false;
    costs[next] = nextCost;
    ascents[next] = nextAscent;
    nextTowardOutlet[next] = current;
    heap.push(nextCost + Math.hypot(startLocal.x - nextPoint.x, startLocal.y - nextPoint.y), next, nextAscent);
    return true;
  };

  while (heap.size) {
    const currentEntry = heap.pop();
    const current = currentEntry.node;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === plan.startIndex) break;
    const row = Math.floor(current / plan.columns);
    const column = current % plan.columns;
    let ordinaryMoves = 0;
    for (const [rowOffset, columnOffset] of baseOffsets) {
      if (relax(current, row + rowOffset, column + columnOffset, false)) ordinaryMoves++;
    }

    // When the regular lattice is locally trapped, try a handful of short
    // primitive-angle connections (2:1, 3:1, 3:2, etc.). They are NOT assumed
    // valid from endpoint elevations alone: the complete continuous segment is
    // sampled and must remain non-ascending in the forward direction.
    if (ordinaryMoves <= 2) {
      let escapes = 0;
      for (let radius = 2; radius <= 3 && escapes < 4; radius++) {
        for (let dr = -radius; dr <= radius && escapes < 4; dr++) {
          for (let dc = -radius; dc <= radius && escapes < 4; dc++) {
            if (!dr && !dc) continue;
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
            let a = Math.abs(dr), b = Math.abs(dc);
            while (b) { const t = a % b; a = b; b = t; }
            if ((a || 1) !== 1) continue;
            if (relax(current, row + dr, column + dc, true)) escapes++;
          }
        }
      }
    }
  }

  if (nextTowardOutlet[plan.startIndex] < 0 && plan.endIndex !== plan.startIndex) return null;
  const indexes = [];
  let cursor = plan.startIndex;
  for (let step = 0; step <= count + 1; step++) {
    indexes.push(cursor);
    if (cursor === plan.endIndex) break;
    cursor = nextTowardOutlet[cursor];
    if (cursor < 0) return null;
  }
  return indexes.at(-1) === plan.endIndex ? indexes : null;
}

function abearcGravityInterpolateLocal(plan, elevations, point) {
  if (!plan || !Array.isArray(elevations) || !point) return NaN;
  const alongStepM = Math.max(0.0001, Number(plan.alongStepM) || 0);
  const crossStepM = Math.max(0.0001, Number(plan.crossStepM) || 0);
  let columnFloat = Number(point.x) / alongStepM + Number(plan.marginColumns || 0);
  let rowFloat = Number(point.y) / crossStepM + Number(plan.halfRows || 0);
  // Grid-line roundoff must not pull an unsampled neighbor into interpolation.
  if (Math.abs(columnFloat - Math.round(columnFloat)) < 1e-9) columnFloat = Math.round(columnFloat);
  if (Math.abs(rowFloat - Math.round(rowFloat)) < 1e-9) rowFloat = Math.round(rowFloat);
  if (!Number.isFinite(columnFloat) || !Number.isFinite(rowFloat)
      || columnFloat < -1e-7 || rowFloat < -1e-7
      || columnFloat > plan.columns - 1 + 1e-7 || rowFloat > plan.rows - 1 + 1e-7) return NaN;
  const left = Math.max(0, Math.min(plan.columns - 1, Math.floor(columnFloat)));
  const right = Math.max(0, Math.min(plan.columns - 1, Math.ceil(columnFloat)));
  const top = Math.max(0, Math.min(plan.rows - 1, Math.floor(rowFloat)));
  const bottom = Math.max(0, Math.min(plan.rows - 1, Math.ceil(rowFloat)));
  const q11 = Number(elevations[top * plan.columns + left]);
  const q21 = Number(elevations[top * plan.columns + right]);
  const q12 = Number(elevations[bottom * plan.columns + left]);
  const q22 = Number(elevations[bottom * plan.columns + right]);
  if (![q11, q21, q12, q22].every(Number.isFinite)) return NaN;
  const tx = right === left ? 0 : (columnFloat - left) / (right - left);
  const ty = bottom === top ? 0 : (rowFloat - top) / (bottom - top);
  const topValue = q11 + (q21 - q11) * tx;
  const bottomValue = q12 + (q22 - q12) * tx;
  return topValue + (bottomValue - topValue) * ty;
}

function abearcGravityLocalPointKey(point) {
  return `${Number(point.x).toFixed(3)},${Number(point.y).toFixed(3)}`;
}

function abearcGravityContourSegmentsAtLevel(plan, elevations, level) {
  const segments = [];
  const crossing = (a, b, za, zb) => {
    if (!Number.isFinite(za) || !Number.isFinite(zb)) return null;
    if ((za < level) === (zb < level)) return null;
    const denominator = zb - za;
    if (Math.abs(denominator) < 1e-12) return null;
    const ratio = (level - za) / denominator;
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  };
  for (let row = 0; row < plan.rows - 1; row++) {
    for (let column = 0; column < plan.columns - 1; column++) {
      const tlIndex = row * plan.columns + column;
      const trIndex = tlIndex + 1;
      const blIndex = (row + 1) * plan.columns + column;
      const brIndex = blIndex + 1;
      if (plan.activeMask && (!plan.activeMask[tlIndex] || !plan.activeMask[trIndex] || !plan.activeMask[blIndex] || !plan.activeMask[brIndex])) continue;
      const ztl = Number(elevations[tlIndex]);
      const ztr = Number(elevations[trIndex]);
      const zbr = Number(elevations[brIndex]);
      const zbl = Number(elevations[blIndex]);
      if (![ztl, ztr, zbr, zbl].every(Number.isFinite)) continue;
      const minimum = Math.min(ztl, ztr, zbr, zbl);
      const maximum = Math.max(ztl, ztr, zbr, zbl);
      if (level < minimum || level > maximum || Math.abs(maximum - minimum) < 1e-9) continue;
      const tl = plan.local[tlIndex], tr = plan.local[trIndex], br = plan.local[brIndex], bl = plan.local[blIndex];
      const edges = [
        crossing(tl, tr, ztl, ztr),
        crossing(tr, br, ztr, zbr),
        crossing(br, bl, zbr, zbl),
        crossing(bl, tl, zbl, ztl)
      ];
      const hits = edges.map((point, edge) => point && { point, edge }).filter(Boolean);
      if (hits.length === 2) segments.push([hits[0].point, hits[1].point]);
      else if (hits.length === 4) {
        const center = (ztl + ztr + zbr + zbl) / 4;
        const pairs = center >= level ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        pairs.forEach(([a, b]) => segments.push([edges[a], edges[b]]));
      }
    }
  }
  return segments;
}

function abearcGravityStitchContourSegments(segments) {
  if (!Array.isArray(segments) || !segments.length) return [];
  const unused = new Set(segments.map((_, index) => index));
  const connections = new Map();
  segments.forEach((segment, index) => segment.forEach(point => {
    const key = abearcGravityLocalPointKey(point);
    if (!connections.has(key)) connections.set(key, []);
    connections.get(key).push(index);
  }));
  const paths = [];
  const walk = (startIndex, startKey) => {
    const points = [];
    let segmentIndex = startIndex;
    let currentKey = startKey;
    while (unused.has(segmentIndex)) {
      const segment = segments[segmentIndex];
      const firstKey = abearcGravityLocalPointKey(segment[0]);
      const from = firstKey === currentKey ? segment[0] : segment[1];
      const to = firstKey === currentKey ? segment[1] : segment[0];
      if (!points.length) points.push(from);
      points.push(to);
      unused.delete(segmentIndex);
      currentKey = abearcGravityLocalPointKey(to);
      const next = (connections.get(currentKey) || []).find(index => unused.has(index));
      if (next === undefined) break;
      segmentIndex = next;
    }
    if (points.length > 1) paths.push(points);
  };
  connections.forEach((indexes, key) => {
    if (indexes.length === 1 && unused.has(indexes[0])) walk(indexes[0], key);
  });
  while (unused.size) {
    const index = unused.values().next().value;
    walk(index, abearcGravityLocalPointKey(segments[index][0]));
  }
  return paths;
}

function abearcGravityDensifyContourPath(points, maximumStepM) {
  if (!Array.isArray(points) || points.length < 2) return points || [];
  const output = [{ ...points[0] }];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const segments = Math.max(1, Math.ceil(distance / Math.max(1, maximumStepM)));
    for (let step = 1; step <= segments; step++) {
      const ratio = step / segments;
      output.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
    }
  }
  return output;
}

function abearcGravityContourPathSlice(points, fromIndex, toIndex) {
  if (!Array.isArray(points) || !points.length) return [];
  if (fromIndex === toIndex) return [{ ...points[fromIndex] }];
  const isClosed = points.length > 2 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 0.05;
  if (!isClosed) {
    const start = Math.min(fromIndex, toIndex), end = Math.max(fromIndex, toIndex);
    const slice = points.slice(start, end + 1).map(point => ({ ...point }));
    return fromIndex <= toIndex ? slice : slice.reverse();
  }
  const unique = points.slice(0, -1);
  const count = unique.length;
  const forward = [];
  for (let index = fromIndex; ; index = (index + 1) % count) {
    forward.push({ ...unique[index] });
    if (index === toIndex) break;
  }
  const backward = [];
  for (let index = fromIndex; ; index = (index - 1 + count) % count) {
    backward.push({ ...unique[index] });
    if (index === toIndex) break;
  }
  const length = route => route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - route[index].x, point.y - route[index].y), 0);
  return length(forward) <= length(backward) ? forward : backward;
}

function abearcGravitySegmentIsNonAscending(plan, elevations, startPoint, endPoint, toleranceM = ABEARC_GRAVITY_ASCENT_TOLERANCE_M) {
  const distance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
  const sampleSpacingM = Math.max(2, Math.min(Number(plan.alongStepM) || 30, Number(plan.crossStepM) || 30) / 4);
  const steps = Math.max(1, Math.ceil(distance / sampleSpacingM));
  let previous = abearcGravityInterpolateLocal(plan, elevations, startPoint);
  if (!Number.isFinite(previous)) return false;
  for (let step = 1; step <= steps; step++) {
    const ratio = step / steps;
    const point = {
      x: startPoint.x + (endPoint.x - startPoint.x) * ratio,
      y: startPoint.y + (endPoint.y - startPoint.y) * ratio
    };
    const current = abearcGravityInterpolateLocal(plan, elevations, point);
    if (!Number.isFinite(current) || current > previous + toleranceM) return false;
    previous = current;
  }
  return true;
}

function abearcGravityBuildSpatialBuckets(frontier, bucketSizeM) {
  const buckets = new Map();
  frontier.forEach((entry, index) => {
    const bx = Math.floor(entry.point.x / bucketSizeM);
    const by = Math.floor(entry.point.y / bucketSizeM);
    const key = `${bx}:${by}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  });
  return buckets;
}

function abearcGravityNearbyFrontier(frontier, buckets, point, bucketSizeM, maximumDistanceM, limit = 12) {
  const bx = Math.floor(point.x / bucketSizeM);
  const by = Math.floor(point.y / bucketSizeM);
  const reach = Math.max(1, Math.ceil(maximumDistanceM / bucketSizeM));
  const candidates = [];
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (const index of buckets.get(`${bx + dx}:${by + dy}`) || []) {
        const entry = frontier[index];
        const distance = Math.hypot(point.x - entry.point.x, point.y - entry.point.y);
        if (distance <= maximumDistanceM) candidates.push({ entry, distance });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, limit);
}

function abearcGravityReconstructContourFrontier(frontierEntry) {
  if (!frontierEntry) return [];
  if (!frontierEntry.record) return [{ ...frontierEntry.point }];
  const record = frontierEntry.record;
  const parentRoute = abearcGravityReconstructContourFrontier(record.parentFrontier);
  const contourRoute = abearcGravityContourPathSlice(record.points, record.entryIndex, frontierEntry.pointIndex);
  if (!parentRoute.length) return contourRoute;
  const output = parentRoute.map(point => ({ ...point }));
  const append = point => {
    const previous = output[output.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.01) output.push({ ...point });
  };
  append(record.points[record.entryIndex]);
  contourRoute.slice(1).forEach(append);
  return output;
}

function abearcGravitySimplifyInterpolatedRoute(plan, elevations, points) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const output = [{ ...points[0] }];
  let index = 0;
  while (index < points.length - 1) {
    let nextIndex = Math.min(points.length - 1, index + 24);
    while (nextIndex > index + 1 && !abearcGravitySegmentIsNonAscending(plan, elevations, points[index], points[nextIndex])) nextIndex--;
    if (nextIndex <= index) nextIndex = index + 1;
    output.push({ ...points[nextIndex] });
    index = nextIndex;
  }
  return output;
}

function abearcGravityContourRescue(plan, elevations, startElevationM, endElevationM) {
  if (!plan?.frame || !Array.isArray(plan.startLngLat) || !Array.isArray(elevations) || elevations.length !== plan.rows * plan.columns) return null;
  const dropM = Number(startElevationM) - Number(endElevationM);
  if (!(dropM > ABEARC_GRAVITY_ASCENT_TOLERANCE_M)) return null;
  const sourceResolutionM = Math.max(2, Number(plan.sourceResolutionM) || Number(plan.spacingM) || 30);
  let levelStepM = ABEARC_GRAVITY_CONTOUR_LEVEL_STEP_M;
  if (dropM / levelStepM > ABEARC_GRAVITY_CONTOUR_MAX_LEVELS) levelStepM = dropM / ABEARC_GRAVITY_CONTOUR_MAX_LEVELS;
  levelStepM = Math.max(0.5, levelStepM);
  const densifyStepM = Math.max(4, Math.min(15, sourceResolutionM / 2));
  const maximumLinkM = Math.min(ABEARC_GRAVITY_CONTOUR_MAX_LINK_M, Math.max(250, sourceResolutionM * 12, Number(plan.spacingM || 0) * 8));
  const startPoint = { x: 0, y: 0 };
  const endPoint = { x: Number(plan.straightDistanceM), y: 0 };
  let frontier = [{ point: startPoint, record: null, pointIndex: 0 }];
  const firstLevel = Math.floor((Number(startElevationM) - 1e-6) / levelStepM) * levelStepM;
  const lastLevel = Number(endElevationM) + Math.min(levelStepM * 0.25, 0.25);

  const tryFinish = () => {
    const buckets = abearcGravityBuildSpatialBuckets(frontier, Math.max(50, maximumLinkM / 3));
    const candidates = abearcGravityNearbyFrontier(frontier, buckets, endPoint, Math.max(50, maximumLinkM / 3), maximumLinkM, 24);
    for (const candidate of candidates) {
      const highElevation = abearcGravityInterpolateLocal(plan, elevations, candidate.entry.point);
      if (!Number.isFinite(highElevation) || Number(endElevationM) > highElevation + ABEARC_GRAVITY_ASCENT_TOLERANCE_M) continue;
      if (!abearcGravitySegmentIsNonAscending(plan, elevations, candidate.entry.point, endPoint)) continue;
      const route = abearcGravityReconstructContourFrontier(candidate.entry);
      route.push({ ...endPoint });
      return abearcGravitySimplifyInterpolatedRoute(plan, elevations, route);
    }
    return null;
  };

  const directFinish = tryFinish();
  if (directFinish?.length) return directFinish;

  let processedLevels = 0;
  for (let level = firstLevel; level > lastLevel && processedLevels < ABEARC_GRAVITY_CONTOUR_MAX_LEVELS; level -= levelStepM, processedLevels++) {
    const rawPaths = abearcGravityStitchContourSegments(abearcGravityContourSegmentsAtLevel(plan, elevations, level));
    if (!rawPaths.length) continue;
    const paths = rawPaths.map(points => abearcGravityDensifyContourPath(points, densifyStepM)).filter(points => points.length > 1);
    const bucketSizeM = Math.max(50, maximumLinkM / 3);
    const buckets = abearcGravityBuildSpatialBuckets(frontier, bucketSizeM);
    const nextFrontier = [];
    for (const points of paths) {
      let connection = null;
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
        const lowPoint = points[pointIndex];
        const candidates = abearcGravityNearbyFrontier(frontier, buckets, lowPoint, bucketSizeM, maximumLinkM, 10);
        for (const candidate of candidates) {
          const highElevation = abearcGravityInterpolateLocal(plan, elevations, candidate.entry.point);
          if (!Number.isFinite(highElevation) || level > highElevation + ABEARC_GRAVITY_ASCENT_TOLERANCE_M) continue;
          if (!abearcGravitySegmentIsNonAscending(plan, elevations, candidate.entry.point, lowPoint)) continue;
          if (!connection || candidate.distance < connection.distance) connection = { parentFrontier: candidate.entry, entryIndex: pointIndex, distance: candidate.distance };
          break;
        }
      }
      if (!connection) continue;
      const record = { level, points, entryIndex: connection.entryIndex, parentFrontier: connection.parentFrontier };
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
        nextFrontier.push({ point: points[pointIndex], record, pointIndex });
      }
    }
    if (!nextFrontier.length) continue;
    frontier = nextFrontier;
    const finished = tryFinish();
    if (finished?.length) return finished;
  }
  return null;
}

function abearcGravityContourRouteResult(basePlan, baseElevations, localPoints, sourceKey, sourceLabel, coarseSpacingM) {
  if (!Array.isArray(localPoints) || localPoints.length < 2) return null;
  const locations = localPoints.map(point => {
    const [longitude, latitude] = abearcGravityLocalToLngLat(basePlan.startLngLat, basePlan.frame, point.x, point.y);
    return { longitude, latitude };
  });
  const routeElevations = localPoints.map(point => abearcGravityInterpolateLocal(basePlan, baseElevations, point));
  if (routeElevations.some(value => !Number.isFinite(value)) || !abearcGravityIsNonAscending(routeElevations)) return null;
  const indexes = localPoints.map((_, index) => index);
  return {
    plan: {
      rows: 1,
      columns: localPoints.length,
      startIndex: 0,
      endIndex: localPoints.length - 1,
      straightDistanceM: basePlan.straightDistanceM,
      corridorM: basePlan.corridorM,
      spacingM: Math.max(1, Number(basePlan.sourceResolutionM) || Number(basePlan.spacingM) || 1),
      alongStepM: Math.max(1, Number(basePlan.sourceResolutionM) || 1),
      crossStepM: 0,
      locations,
      local: localPoints.map(point => ({ ...point }))
    },
    elevations: routeElevations,
    indexes,
    sourceKey,
    sourceLabel,
    coarseSpacingM,
    strategy: 'contour-resolved-all-descent'
  };
}


function abearcGravityLngLatToLocal(start, frame, lngLat) {
  const eastM = (Number(lngLat?.[0]) - Number(start?.[0])) * frame.metresPerLongitudeDegree;
  const northM = (Number(lngLat?.[1]) - Number(start?.[1])) * frame.metresPerLatitudeDegree;
  return {
    x: eastM * frame.alongEast + northM * frame.alongNorth,
    y: eastM * frame.crossEast + northM * frame.crossNorth
  };
}

function abearcGravityDensifyLocalPolyline(points, maximumStepM) {
  if (!Array.isArray(points) || points.length < 2) return Array.isArray(points) ? points.map(point => ({ ...point })) : [];
  const output = [{ ...points[0] }];
  const stepLimit = Math.max(2, Number(maximumStepM) || 10);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(distance / stepLimit));
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      output.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
    }
  }
  return output;
}

function abearcGravitySegmentIntersectionProper(a, b, c, d, epsilon = 1e-7) {
  const minAx = Math.min(a.x, b.x) - epsilon, maxAx = Math.max(a.x, b.x) + epsilon;
  const minAy = Math.min(a.y, b.y) - epsilon, maxAy = Math.max(a.y, b.y) + epsilon;
  const minCx = Math.min(c.x, d.x) - epsilon, maxCx = Math.max(c.x, d.x) + epsilon;
  const minCy = Math.min(c.y, d.y) - epsilon, maxCy = Math.max(c.y, d.y) + epsilon;
  if (maxAx < minCx || maxCx < minAx || maxAy < minCy || maxCy < minAy) return false;
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = cross(a, b, c), o2 = cross(a, b, d), o3 = cross(c, d, a), o4 = cross(c, d, b);
  if (((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
      && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))) return true;
  return false;
}

function abearcGravityContourConnectorSafe(a, b, upperElevationM, lowerElevationM, blockerSegments) {
  const upper = Math.max(Number(upperElevationM), Number(lowerElevationM));
  const lower = Math.min(Number(upperElevationM), Number(lowerElevationM));
  for (const segment of blockerSegments || []) {
    const level = Number(segment.level);
    if (!Number.isFinite(level)) continue;
    if (level <= upper + 1e-6 && level >= lower - 1e-6) continue;
    if (abearcGravitySegmentIntersectionProper(a, b, segment.a, segment.b)) return false;
  }
  return true;
}

function abearcGravityContourLevelInterval(paths) {
  const levels = [...new Set((paths || []).map(path => Number(path?.level)).filter(Number.isFinite))].sort((a, b) => a - b);
  const gaps = [];
  for (let index = 1; index < levels.length; index++) {
    const gap = levels[index] - levels[index - 1];
    if (gap > 1e-6) gaps.push(gap);
  }
  if (!gaps.length) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function abearcGravityRouteContourPaths(start, end, startElevationM, endElevationM, contourPaths, options = {}) {
  const usablePaths = (Array.isArray(contourPaths) ? contourPaths : [])
    .map((path, pathIndex) => ({
      pathIndex,
      level: Number(path?.level),
      points: Array.isArray(path?.points) ? path.points : []
    }))
    .filter(path => Number.isFinite(path.level) && path.points.length > 1
      && path.points.every(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))));
  if (!usablePaths.length || !(Number(startElevationM) > Number(endElevationM) + ABEARC_GRAVITY_ASCENT_TOLERANCE_M)) return null;

  const frame = abearcGravityLocalFrame(start, end);
  const sourceResolutionM = Math.max(2, Number(options.sourceResolutionM) || 30);
  const intervalM = Math.max(0.5, Number(options.intervalM) || abearcGravityContourLevelInterval(usablePaths) || 10);
  const densifyStepM = Math.max(4, Math.min(15, sourceResolutionM / 2));
  const maximumConnectorM = Math.max(80, Math.min(300, Number(options.maximumConnectorM) || Math.max(sourceResolutionM * 6, intervalM * 10)));
  const allLevels = [...new Set(usablePaths.map(path => path.level))].sort((a, b) => b - a);
  const firstLevel = allLevels.find(level => level <= Number(startElevationM) + ABEARC_GRAVITY_ASCENT_TOLERANCE_M);
  const lastLevel = [...allLevels].reverse().find(level => level >= Number(endElevationM) - ABEARC_GRAVITY_ASCENT_TOLERANCE_M);
  if (!Number.isFinite(firstLevel) || !Number.isFinite(lastLevel) || firstLevel < lastLevel - 1e-6) return null;
  const routeLevels = allLevels.filter(level => level <= firstLevel + 1e-6 && level >= lastLevel - 1e-6);
  if (!routeLevels.length) return null;

  const nodes = [];
  const edges = [];
  const nodesByLevel = new Map();
  const blockerSegments = [];
  const addNode = (point, level, pathIndex) => {
    const id = nodes.length;
    nodes.push({ id, point: { ...point }, level: Number(level), pathIndex });
    edges.push([]);
    if (!nodesByLevel.has(Number(level))) nodesByLevel.set(Number(level), []);
    nodesByLevel.get(Number(level)).push(id);
    return id;
  };
  const addEdge = (from, to, cost) => edges[from].push({ to, cost: Math.max(0.001, Number(cost) || 0.001) });

  // Keep every available contour as a connector blocker, including levels
  // above Point 1 and below Point 2. A connector that leaves the permitted
  // elevation band must cross one of those contours, so this prevents a
  // seemingly short link from cutting across a hidden ridge or depression.
  for (const path of usablePaths) {
    const localOriginal = path.points.map(point => abearcGravityLngLatToLocal(start, frame, point));
    for (let index = 1; index < localOriginal.length; index++) {
      blockerSegments.push({ level: path.level, a: localOriginal[index - 1], b: localOriginal[index] });
    }
  }

  for (const path of usablePaths) {
    if (!routeLevels.includes(path.level)) continue;
    const localOriginal = path.points.map(point => abearcGravityLngLatToLocal(start, frame, point));
    const local = abearcGravityDensifyLocalPolyline(localOriginal, densifyStepM);
    let previousId = null;
    for (const point of local) {
      const id = addNode(point, path.level, path.pathIndex);
      if (previousId !== null) {
        const distance = Math.hypot(point.x - nodes[previousId].point.x, point.y - nodes[previousId].point.y);
        addEdge(previousId, id, distance);
        addEdge(id, previousId, distance);
      }
      previousId = id;
    }
  }

  if (!nodes.length || !nodesByLevel.get(firstLevel)?.length || !nodesByLevel.get(lastLevel)?.length) return null;
  const bucketSizeM = Math.max(25, maximumConnectorM / 3);
  const makeBuckets = ids => {
    const buckets = new Map();
    for (const id of ids || []) {
      const point = nodes[id].point;
      const bx = Math.floor(point.x / bucketSizeM), by = Math.floor(point.y / bucketSizeM);
      const key = `${bx}:${by}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(id);
    }
    return buckets;
  };
  const nearbyIds = (point, ids, buckets, limit = 8) => {
    const bx = Math.floor(point.x / bucketSizeM), by = Math.floor(point.y / bucketSizeM);
    const reach = Math.max(1, Math.ceil(maximumConnectorM / bucketSizeM));
    const found = [];
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
      for (const id of buckets.get(`${bx + dx}:${by + dy}`) || []) {
        const target = nodes[id].point;
        const distance = Math.hypot(target.x - point.x, target.y - point.y);
        if (distance <= maximumConnectorM) found.push({ id, distance });
      }
    }
    found.sort((a, b) => a.distance - b.distance);
    return found.slice(0, limit);
  };

  for (let levelIndex = 0; levelIndex < routeLevels.length - 1; levelIndex++) {
    const highLevel = routeLevels[levelIndex], lowLevel = routeLevels[levelIndex + 1];
    const highIds = nodesByLevel.get(highLevel) || [], lowIds = nodesByLevel.get(lowLevel) || [];
    if (!highIds.length || !lowIds.length) continue;
    const buckets = makeBuckets(lowIds);
    for (const highId of highIds) {
      let linked = 0;
      for (const candidate of nearbyIds(nodes[highId].point, lowIds, buckets, 12)) {
        if (!abearcGravityContourConnectorSafe(nodes[highId].point, nodes[candidate.id].point, highLevel, lowLevel, blockerSegments)) continue;
        addEdge(highId, candidate.id, candidate.distance);
        linked += 1;
        if (linked >= 3) break;
      }
    }
  }

  const startPoint = { x: 0, y: 0 };
  const endPoint = { x: frame.straightDistanceM, y: 0 };
  const startId = nodes.length;
  nodes.push({ id: startId, point: startPoint, level: Number(startElevationM), pathIndex: -1 });
  edges.push([]);
  const endId = nodes.length;
  nodes.push({ id: endId, point: endPoint, level: Number(endElevationM), pathIndex: -2 });
  edges.push([]);

  const firstIds = nodesByLevel.get(firstLevel) || [];
  const firstBuckets = makeBuckets(firstIds);
  let startLinks = 0;
  for (const candidate of nearbyIds(startPoint, firstIds, firstBuckets, 20)) {
    if (!abearcGravityContourConnectorSafe(startPoint, nodes[candidate.id].point, startElevationM, firstLevel, blockerSegments)) continue;
    addEdge(startId, candidate.id, candidate.distance);
    if (++startLinks >= 8) break;
  }
  if (!startLinks) return null;

  const lastIds = nodesByLevel.get(lastLevel) || [];
  const endCandidates = lastIds.map(id => ({ id, distance: Math.hypot(nodes[id].point.x - endPoint.x, nodes[id].point.y - endPoint.y) }))
    .filter(item => item.distance <= maximumConnectorM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);
  let endLinks = 0;
  for (const candidate of endCandidates) {
    if (!abearcGravityContourConnectorSafe(nodes[candidate.id].point, endPoint, lastLevel, endElevationM, blockerSegments)) continue;
    addEdge(candidate.id, endId, candidate.distance);
    if (++endLinks >= 8) break;
  }
  if (!endLinks) return null;

  const costs = new Float64Array(nodes.length);
  costs.fill(Infinity);
  const previous = new Int32Array(nodes.length);
  previous.fill(-1);
  const closed = new Uint8Array(nodes.length);
  const heap = new AbearcGravityMinHeap();
  costs[startId] = 0;
  heap.push(0, startId);
  while (heap.size) {
    const item = heap.pop();
    const current = item.node;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === endId) break;
    for (const edge of edges[current]) {
      if (closed[edge.to]) continue;
      const nextCost = costs[current] + edge.cost;
      if (nextCost >= costs[edge.to]) continue;
      costs[edge.to] = nextCost;
      previous[edge.to] = current;
      heap.push(nextCost, edge.to);
    }
  }
  if (previous[endId] < 0) return null;

  const routeIds = [];
  for (let cursor = endId, guard = 0; cursor >= 0 && guard <= nodes.length + 1; guard++) {
    routeIds.push(cursor);
    if (cursor === startId) break;
    cursor = previous[cursor];
  }
  routeIds.reverse();
  if (routeIds[0] !== startId || routeIds.at(-1) !== endId) return null;
  const localPoints = routeIds.map(id => ({ ...nodes[id].point }));
  const routeElevations = routeIds.map(id => Number(nodes[id].level));
  if (!abearcGravityIsNonAscending(routeElevations, ABEARC_GRAVITY_ASCENT_TOLERANCE_M)) return null;

  // IMPORTANT: Do not chord-simplify contour-guided routes. A straight
  // shortcut between two vertices that share the same contour level can cut
  // across terrain above that contour, which makes the final applied line show
  // an ascent even though the contour graph itself was monotonic. Preserve the
  // densified contour geometry exactly; duplicate adjacent points are removed
  // below without changing the terrain trace.
  const simplifiedPoints = [];
  const simplifiedElevations = [];
  for (let index = 0; index < localPoints.length; index++) {
    const point = localPoints[index];
    const elevation = routeElevations[index];
    const previousPoint = simplifiedPoints.at(-1);
    if (previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 0.05) continue;
    simplifiedPoints.push({ ...point });
    simplifiedElevations.push(elevation);
  }

  const locations = simplifiedPoints.map(point => {
    const [longitude, latitude] = abearcGravityLocalToLngLat(start, frame, point.x, point.y);
    return { longitude, latitude };
  });
  const indexes = simplifiedPoints.map((_, index) => index);
  const corridorM = simplifiedPoints.reduce((maximum, point) => Math.max(maximum, Math.abs(point.y)), 0);
  return {
    plan: {
      rows: 1,
      columns: simplifiedPoints.length,
      startIndex: 0,
      endIndex: simplifiedPoints.length - 1,
      straightDistanceM: frame.straightDistanceM,
      corridorM,
      spacingM: Math.max(1, Number(options.effectiveSpacingM) || sourceResolutionM),
      alongStepM: Math.max(1, sourceResolutionM),
      crossStepM: 0,
      locations,
      local: simplifiedPoints
    },
    elevations: simplifiedElevations,
    indexes,
    sourceKey: String(options.sourceKey || ''),
    sourceLabel: String(options.sourceLabel || 'Generated contour terrain'),
    coarseSpacingM: Math.max(1, Number(options.effectiveSpacingM) || sourceResolutionM),
    contourIntervalM: intervalM,
    strategy: 'displayed-contour-guided'
  };
}


function abearcGravityContourGraphRescueFromPlan(plan, elevations, startElevationM, endElevationM, sourceKey, sourceLabel) {
  if (!plan?.frame || !Array.isArray(plan.startLngLat) || !Array.isArray(elevations)
      || elevations.length !== plan.rows * plan.columns) return null;
  const dropM = Number(startElevationM) - Number(endElevationM);
  if (!(dropM > ABEARC_GRAVITY_ASCENT_TOLERANCE_M)) return null;

  // Use a modest adaptive interval: dense enough to preserve a narrow contour
  // connection, but bounded so this fallback cannot explode CPU/memory on a
  // large corridor. This is deliberately much cheaper than the earlier 1 m
  // full-corridor experiment that could stall the map.
  let intervalM = dropM <= 60 ? 5 : dropM <= 180 ? 10 : 20;
  if (dropM / intervalM > 48) intervalM = dropM / 48;
  intervalM = Math.max(2, intervalM);

  const firstLevel = Math.floor((Number(startElevationM) - 1e-6) / intervalM) * intervalM;
  const lastLevel = Math.ceil((Number(endElevationM) + 1e-6) / intervalM) * intervalM;
  const contourPaths = [];
  let levelCount = 0;
  for (let level = firstLevel; level >= lastLevel - 1e-9 && levelCount < 64; level -= intervalM, levelCount++) {
    const stitched = abearcGravityStitchContourSegments(abearcGravityContourSegmentsAtLevel(plan, elevations, level));
    for (const localPoints of stitched) {
      if (!Array.isArray(localPoints) || localPoints.length < 2) continue;
      contourPaths.push({
        level: Number(level),
        points: localPoints.map(point => abearcGravityLocalToLngLat(plan.startLngLat, plan.frame, point.x, point.y))
      });
    }
  }
  if (!contourPaths.length) return null;

  const route = abearcGravityRouteContourPaths(
    plan.startLngLat,
    abearcGravityLocalToLngLat(plan.startLngLat, plan.frame, plan.straightDistanceM, 0),
    startElevationM,
    endElevationM,
    contourPaths,
    {
      sourceKey,
      sourceLabel,
      sourceResolutionM: Math.max(2, Number(plan.sourceResolutionM) || Number(plan.spacingM) || 30),
      effectiveSpacingM: Math.max(1, Number(plan.spacingM) || 30),
      intervalM,
      maximumConnectorM: Math.min(300, Math.max(120, Number(plan.spacingM || 0) * 10))
    }
  );
  if (!route?.indexes?.length) return null;
  return {
    ...route,
    strategy: 'sampled-contour-network-all-descent',
    contourIntervalM: intervalM,
    sampledContourPathCount: contourPaths.length
  };
}

function abearcGravityVisibleContourDatasets(sourceKey, sourceLabel) {
  const datasets = [];
  const seen = new Set();
  const addDataset = (data, contourSource, metadata = {}) => {
    if (!data || !Array.isArray(data.paths) || !data.paths.length) return;
    const resolvedSource = String(contourSource || metadata.sourceKey || '');
    const sourceMatches = !Boolean(data.imported) && Boolean(resolvedSource && sourceKey && resolvedSource === sourceKey);
    const first = data.paths[0];
    const last = data.paths[data.paths.length - 1];
    const signature = `${metadata.measurementId || metadata.measurementName || 'active'}:${data.paths.length}:${Number(first?.level)}:${Number(last?.level)}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    datasets.push({
      paths: data.paths,
      sourceKey: resolvedSource || '',
      sourceMatches,
      imported: Boolean(data.imported),
      sourceLabel: String(data.sourceLabel || metadata.sourceLabel || (resolvedSource ? abearcGravitySourceLabel(resolvedSource) : '') || sourceLabel || abearcGravitySourceLabel(sourceKey)),
      sourceResolutionM: Number(data.sourceResolutionM) || Number(metadata.sourceResolutionM) || Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[resolvedSource || sourceKey]) || 30,
      effectiveSpacingM: Number(data.effectiveSpacingM) || Number(metadata.effectiveSpacingM) || Number(data.sourceResolutionM) || Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[resolvedSource || sourceKey]) || 30,
      intervalM: Number(data.interval) || Number(metadata.intervalM) || null,
      measurementId: String(metadata.measurementId || ''),
      measurementName: String(metadata.measurementName || 'Current measurement'),
      origin: String(metadata.origin || 'active')
    });
  };

  // Contours attached to the currently active measurement.
  const activeData = typeof abearcMapContourData !== 'undefined' ? abearcMapContourData : null;
  const activeSource = typeof abearcMapContourSource !== 'undefined' ? String(abearcMapContourSource || '') : '';
  addDataset(activeData, activeSource, { origin: 'active', measurementName: 'Current measurement' });

  // Multi-measure keeps completed analyses (including contours) on inactive
  // measurements. Those contours remain visibly rendered on the map, so the
  // gravity solver must be able to use them too. This is the common workflow:
  // generate contours on Area 1, then select Distance 1 and find a gravity path.
  if (typeof abearcMapMeasurements !== 'undefined' && Array.isArray(abearcMapMeasurements)) {
    for (const record of abearcMapMeasurements) {
      if (!record || record.visible === false) continue;
      const analysis = record.analysis;
      const contours = analysis?.contours;
      if (!contours || !Array.isArray(contours.paths) || !contours.paths.length) continue;
      addDataset({
        imported: Boolean(contours.imported),
        paths: contours.paths,
        sourceLabel: contours.sourceLabel,
        interval: analysis.contourInterval,
        sourceResolutionM: Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[analysis.contourSource]) || 30,
        effectiveSpacingM: Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[analysis.contourSource]) || 30
      }, analysis.contourSource, {
        origin: 'inactive-measurement',
        measurementId: record.id,
        measurementName: record.name || 'Visible area measurement',
        sourceLabel: contours.sourceLabel,
        intervalM: analysis.contourInterval
      });
    }
  }
  return datasets;
}

function abearcGravityDisplayedContourRescue(start, end, startElevationM, endElevationM, sourceKey, sourceLabel, datasets = null) {
  const candidates = Array.isArray(datasets) ? datasets : abearcGravityVisibleContourDatasets(sourceKey, sourceLabel);
  let best = null;
  let bestDistanceM = Infinity;
  for (const candidate of candidates) {
    const route = abearcGravityRouteContourPaths(start, end, startElevationM, endElevationM, candidate.paths, {
      sourceKey: candidate.sourceKey || sourceKey,
      sourceLabel: candidate.sourceLabel || sourceLabel || abearcGravitySourceLabel(sourceKey),
      sourceResolutionM: Number(candidate.sourceResolutionM) || Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || 30,
      effectiveSpacingM: Number(candidate.effectiveSpacingM) || Number(candidate.sourceResolutionM) || Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || 30,
      intervalM: Number(candidate.intervalM) || null,
      maximumConnectorM: Number(candidate.maximumConnectorM) || null
    });
    if (!route?.indexes?.length) continue;
    let distanceM = 0;
    for (let index = 1; index < route.indexes.length; index++) {
      const previous = route.plan.locations[route.indexes[index - 1]];
      const current = route.plan.locations[route.indexes[index]];
      distanceM += haversineMetres([previous.longitude, previous.latitude], [current.longitude, current.latitude]);
    }
    if (distanceM < bestDistanceM) {
      bestDistanceM = distanceM;
      best = {
        ...route,
        contourMeasurementId: candidate.measurementId || '',
        contourMeasurementName: candidate.measurementName || '',
        contourOrigin: candidate.origin || 'active',
        contourSourceKey: candidate.sourceKey || '',
        contourSourceMatches: Boolean(candidate.sourceMatches),
        contourImported: Boolean(candidate.imported),
        visibleContourSetsChecked: candidates.length
      };
    }
  }
  return best;
}


async function abearcGravityCrossSourceContourRescue(start, end, currentStartElevationM, currentEndElevationM, currentSourceKey, currentSourceLabel, candidates, signal) {
  let best = null;
  let bestDistanceM = Infinity;
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate?.paths?.length) continue;
    let startElevationM = currentStartElevationM;
    let endElevationM = currentEndElevationM;
    let sourceKey = candidate.sourceKey || '';
    let sourceLabel = candidate.sourceLabel || 'Visible contour network';
    if (sourceKey && sourceKey !== currentSourceKey && ABEARC_MAP_ELEVATION_SOURCES.has(sourceKey)) {
      try {
        const endpointResult = await requestAbearcElevations([
          { longitude: Number(start[0]), latitude: Number(start[1]) },
          { longitude: Number(end[0]), latitude: Number(end[1]) }
        ], signal, sourceKey, false);
        startElevationM = Number(endpointResult.elevations[0]);
        endElevationM = Number(endpointResult.elevations[1]);
        sourceKey = endpointResult.sourceKey || sourceKey;
        sourceLabel = endpointResult.sourceLabel || sourceLabel;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        // The contour geometry itself still contains elevation levels. If the
        // original DEM is temporarily unavailable, keep the current endpoint
        // elevations rather than discarding a visible contour network.
      }
    }
    const route = abearcGravityDisplayedContourRescue(
      start, end, startElevationM, endElevationM,
      sourceKey || currentSourceKey, sourceLabel || currentSourceLabel, [candidate]
    );
    if (!route?.indexes?.length) continue;
    let distanceM = 0;
    for (let index = 1; index < route.indexes.length; index++) {
      const previous = route.plan.locations[route.indexes[index - 1]];
      const current = route.plan.locations[route.indexes[index]];
      distanceM += haversineMetres([previous.longitude, previous.latitude], [current.longitude, current.latitude]);
    }
    if (distanceM >= bestDistanceM) continue;
    bestDistanceM = distanceM;
    best = {
      ...route,
      sourceKey: sourceKey || candidate.sourceKey || currentSourceKey,
      sourceLabel: `${sourceLabel || candidate.sourceLabel || 'Visible contour network'} (visible contour guidance)`,
      strategy: 'displayed-contour-guided-cross-source',
      contourSourceMatches: false,
      visibleContourSetsChecked: candidates.length
    };
  }
  return best;
}


function abearcGravityDensifyRouteLocations(plan, indexes, maximumStepM = 2.5) {
  const points = (Array.isArray(indexes) ? indexes : [])
    .map(index => plan?.locations?.[index])
    .filter(point => Number.isFinite(Number(point?.longitude)) && Number.isFinite(Number(point?.latitude)));
  if (points.length < 2) return points.map(point => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) }));
  const output = [{ longitude: Number(points[0].longitude), latitude: Number(points[0].latitude) }];
  const stepLimitM = Math.max(1, Number(maximumStepM) || 2.5);
  for (let index = 1; index < points.length; index++) {
    const a = [Number(points[index - 1].longitude), Number(points[index - 1].latitude)];
    const b = [Number(points[index].longitude), Number(points[index].latitude)];
    const distanceM = haversineMetres(a, b);
    const steps = Math.max(1, Math.ceil(distanceM / stepLimitM));
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      output.push({
        longitude: a[0] + (b[0] - a[0]) * ratio,
        latitude: a[1] + (b[1] - a[1]) * ratio
      });
    }
  }
  return output;
}

async function abearcGravityValidateFinalRoute(search, signal, sourceKeyOverride = '') {
  if (!search?.plan || !Array.isArray(search.indexes) || search.indexes.length < 2) {
    return { valid: false, reason: 'missing-route' };
  }
  const sourceKey = String(sourceKeyOverride || search.sourceKey || '');
  const sourceResolutionM = Math.max(2, Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || Number(search.plan.spacingM) || 5);
  // NAMRIA is validated at quarter-cell spacing on the same bilinear surface
  // used by the native sub-cell solver, so even diagonal 2.5/1.25 m route steps
  // are checked between lattice nodes. Other DEMs use at least half
  // their advertised spacing, capped so validation remains practical.
  const sampleStepM = sourceKey === 'namria-dtm5-prs92'
    ? 1.25
    : Math.max(2.5, Math.min(10, sourceResolutionM / 2));
  const locations = abearcGravityDensifyRouteLocations(search.plan, search.indexes, sampleStepM);
  if (locations.length < 2) return { valid: false, reason: 'missing-route' };
  const result = await abearcGravityFetchElevations(
    locations, signal, sourceKey, 94, 98,
    'Verifying final gravity path against terrain…'
  );
  const elevations = Array.isArray(result.elevations) ? result.elevations.map(Number) : [];
  if (elevations.length !== locations.length || elevations.some(value => !Number.isFinite(value))) {
    return { valid: false, reason: 'incomplete-elevation-validation' };
  }
  const ascent = abearcGravityAscentStats(elevations);
  const downhillOnly = abearcGravityRoutingMode === 'downhill-only';
  return {
    valid: ascent.firstAscentIndex < 0 && (!downhillOnly || ascent.maximumContinuousClimbM <= ABEARC_GRAVITY_NUMERIC_EPSILON_M),
    sourceKey: result.sourceKey || sourceKey,
    sourceLabel: result.sourceLabel || search.sourceLabel || abearcGravitySourceLabel(sourceKey),
    sampleStepM,
    sampleCount: locations.length,
    locations,
    elevations,
    ...ascent
  };
}

function abearcGravityAscentStats(elevations, toleranceM = ABEARC_GRAVITY_ASCENT_TOLERANCE_M) {
  let maximumStepAscentM = 0, totalAscentM = 0, maximumContinuousClimbM = 0, firstAscentIndex = -1;
  let low = Number(elevations[0]);
  for (let index = 1; index < elevations.length; index++) {
    const value = Number(elevations[index]);
    const rise = value - Number(elevations[index - 1]);
    maximumStepAscentM = Math.max(maximumStepAscentM, rise);
    totalAscentM += Math.max(0, rise);
    low = Math.min(low, value);
    maximumContinuousClimbM = Math.max(maximumContinuousClimbM, value - low);
    if (rise > toleranceM + 1e-9 && firstAscentIndex < 0) firstAscentIndex = index;
  }
  return { maximumStepAscentM, totalAscentM, maximumContinuousClimbM, firstAscentIndex };
}

function abearcGravityPathStats(plan, elevations, indexes) {
  const points = indexes.map(index => [plan.locations[index].longitude, plan.locations[index].latitude]);
  let routeDistanceM = 0;
  let maximumStepAscentM = 0;
  let totalAscentM = 0;
  for (let index = 1; index < points.length; index++) {
    routeDistanceM += haversineMetres(points[index - 1], points[index]);
    const ascent = Number(elevations[indexes[index]]) - Number(elevations[indexes[index - 1]]);
    if (ascent > 0) {
      totalAscentM += ascent;
      maximumStepAscentM = Math.max(maximumStepAscentM, ascent);
    }
  }
  const startElevationM = Number(elevations[indexes[0]]);
  const endElevationM = Number(elevations[indexes[indexes.length - 1]]);
  return {
    points,
    startElevationM,
    endElevationM,
    totalDropM: startElevationM - endElevationM,
    routeDistanceM,
    maximumStepAscentM,
    totalAscentM
  };
}

function abearcGravitySampleLine(start, end, spacingM) {
  const frame = abearcGravityLocalFrame(start, end);
  const segments = Math.max(1, Math.ceil(frame.straightDistanceM / Math.max(1, spacingM)));
  const locations = [];
  const points = [];
  for (let index = 0; index <= segments; index++) {
    const x = frame.straightDistanceM * (index / segments);
    const point = abearcGravityLocalToLngLat(start, frame, x, 0);
    points.push(point);
    locations.push({ longitude: point[0], latitude: point[1] });
  }
  points[0] = [...start];
  points[points.length - 1] = [...end];
  locations[0] = { longitude: Number(start[0]), latitude: Number(start[1]) };
  locations[locations.length - 1] = { longitude: Number(end[0]), latitude: Number(end[1]) };
  return { points, locations, spacingM: frame.straightDistanceM / segments, straightDistanceM: frame.straightDistanceM };
}

function abearcGravityIsNonAscending(elevations, toleranceM = ABEARC_GRAVITY_ASCENT_TOLERANCE_M) {
  if (!Array.isArray(elevations) || elevations.length < 2 || elevations.some(value => !Number.isFinite(Number(value)))) return false;
  for (let index = 1; index < elevations.length; index++) {
    if (Number(elevations[index]) > Number(elevations[index - 1]) + toleranceM) return false;
  }
  return true;
}

function abearcGravityLineSearchResult(sample, elevationResult) {
  let validatedMaximumStepAscentM = 0;
  for (let index = 1; index < elevationResult.elevations.length; index++) {
    validatedMaximumStepAscentM = Math.max(
      validatedMaximumStepAscentM,
      Number(elevationResult.elevations[index]) - Number(elevationResult.elevations[index - 1])
    );
  }
  // The whole straight alignment was validated at DEM sampling resolution, but
  // only its two endpoints need to become measurement vertices on the map.
  const locations = [sample.locations[0], sample.locations[sample.locations.length - 1]];
  const plan = {
    rows: 1,
    columns: 2,
    startIndex: 0,
    endIndex: 1,
    straightDistanceM: sample.straightDistanceM,
    corridorM: 0,
    spacingM: sample.spacingM,
    alongStepM: sample.straightDistanceM,
    crossStepM: 0,
    locations,
    local: [{ x: 0, y: 0 }, { x: sample.straightDistanceM, y: 0 }]
  };
  return {
    plan,
    elevations: [elevationResult.elevations[0], elevationResult.elevations[elevationResult.elevations.length - 1]],
    indexes: [0, 1],
    sourceKey: elevationResult.sourceKey,
    sourceLabel: elevationResult.sourceLabel,
    coarseSpacingM: sample.spacingM,
    validatedMaximumStepAscentM: Math.max(0, validatedMaximumStepAscentM),
    strategy: 'straight-line'
  };
}

function abearcGravityCorridors(straightDistanceM, sourceResolutionM) {
  const first = Math.max(sourceResolutionM * 4, Math.min(125, Math.max(50, straightDistanceM * 0.08)));
  const corridors = [];
  let value = first;
  while (value < ABEARC_GRAVITY_MAX_CORRIDOR_M) {
    corridors.push(Math.round(value));
    value *= 2;
  }
  if (!corridors.length || corridors[corridors.length - 1] < ABEARC_GRAVITY_MAX_CORRIDOR_M) corridors.push(ABEARC_GRAVITY_MAX_CORRIDOR_M);
  return [...new Set(corridors.map(value => Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, value)))];
}

function abearcGravityPlanLocations(plan) {
  const locations = [];
  const indexes = [];
  for (let index = 0; index < plan.locations.length; index++) {
    if (plan.activeMask && !plan.activeMask[index]) continue;
    locations.push(plan.locations[index]);
    indexes.push(index);
  }
  return { locations, indexes };
}

async function abearcGravityElevationsForPlan(plan, signal, sourceKey, progressStart, progressEnd, progressLabel) {
  const selected = abearcGravityPlanLocations(plan);
  const result = await abearcGravityFetchElevations(selected.locations, signal, sourceKey, progressStart, progressEnd, progressLabel);
  const elevations = new Array(plan.locations.length).fill(NaN);
  selected.indexes.forEach((planIndex, index) => { elevations[planIndex] = Number(result.elevations[index]); });
  return { ...result, elevations };
}

function abearcGravityNoPathMessage(summary) {
  const endpointReason = summary.endpointHigher
    ? `<p class="mt-2"><strong>Endpoint condition:</strong> Point 2 is ${esc(summary.endpointRiseM.toFixed(2))} m higher than Point 1, so a continuously non-ascending route is impossible between these endpoints.</p>`
    : '<p class="mt-2">No connected route passed the terrain checks for the selected routing goal. Try another endpoint or alignment.</p>';
  const visibleCount = Math.max(0, Number(summary.visibleContourSetsChecked) || 0);
  const matchingCount = Math.max(0, Number(summary.sameSourceContourSetsChecked) || 0);
  const contourStatus = visibleCount
    ? `${visibleCount} visible · ${matchingCount} matching the selected DEM${visibleCount > matchingCount ? ` · ${visibleCount - matchingCount} from another/unknown source` : ''}`
    : '0 visible';
  const nativeStatus = summary.nativeNamriaAttempted
    ? (summary.nativeNamriaError
      ? `attempted but unavailable (${esc(summary.nativeNamriaError)})`
      : `completed with reverse reachability at native ~${Math.round(summary.nativeNamriaSpacingM || 5)} m raster spacing${summary.nativeNamriaSubcellAttempted ? ` · continuous sub-cell reachability also checked at about ${Number(summary.nativeNamriaSubcellSpacingM || 2.5).toFixed(1)} m` : ''}${Number(summary.nativeNamriaReverseReachableCount || 0) ? ` · ${Number(summary.nativeNamriaReverseReachableCount).toLocaleString()} terrain nodes in the reverse reachable-mask` : ''}${Number(summary.nativeNamriaMaskedAStarExpandedCount || 0) ? ` · ${Number(summary.nativeNamriaMaskedAStarExpandedCount).toLocaleString()} masked A* nodes expanded` : ''}${Number(summary.nativeNamriaBottleneckCount || 0) ? ` · ${Number(summary.nativeNamriaBottleneckCount).toLocaleString()} bottleneck nodes checked` : ''}${Number(summary.nativeNamriaReverseAnyAngleEdgesUsed || 0) ? ` · ${Number(summary.nativeNamriaReverseAnyAngleEdgesUsed).toLocaleString()} verified any-angle links used` : ''}`)
    : 'not applicable';
  const nativeContourStatus = summary.nativeNamriaContourGenerated
    ? `${Number(summary.nativeNamriaContourPathCount || 0).toLocaleString()} internally generated NAMRIA contour lines checked at ${Number(summary.nativeNamriaContourIntervalM || 10).toFixed(0)} m interval`
    : (summary.nativeNamriaAttempted ? 'no internal contour network produced' : 'not applicable');
  return `<div class="text-left space-y-2">
    <p><strong>No route was found for ${abearcGravityRoutingMode === 'downhill-only' ? 'Downhill only' : 'Minimize ascent'}.</strong></p>
    ${endpointReason}
    <p class="text-sm">Source: ${esc(summary.sourceLabel)}<br>Visible contour networks: ${contourStatus}<br>Native NAMRIA search: ${nativeStatus}<br>Native NAMRIA contour fallback: ${nativeContourStatus}<br>Maximum searched corridor: ±${Math.round(summary.corridorM || 0)} m${summary.gridSpacingM ? `<br>Finest browser terrain grid attempted: about ${Math.round(summary.gridSpacingM)} m` : ''}</p>
    <p class="text-xs text-slate-500">The search uses the same NAMRIA terrain surface for routing and final validation. Downhill only never switches to a climbing route automatically.</p>
  </div>`;
}

async function abearcGravitySearchHierarchical(start, end, signal, requestId, lockedSourceKey = '') {
  const sourceKey = ABEARC_MAP_ELEVATION_SOURCES.has(lockedSourceKey) ? lockedSourceKey : abearcGravityCurrentSource();
  const sourceResolutionM = Math.max(2, Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[sourceKey]) || 30);
  const straightDistanceM = haversineMetres(start, end);
  const sourceLabelDefault = abearcGravitySourceLabel(sourceKey);

  updateAbearcGravityProgress(4, 'Checking endpoints…', 'Reading Point 1 and Point 2 elevations.');
  const endpoints = [
    { longitude: Number(start[0]), latitude: Number(start[1]) },
    { longitude: Number(end[0]), latitude: Number(end[1]) }
  ];
  const endpointResult = await abearcGravityFetchElevations(endpoints, signal, sourceKey, 4, 9, 'Checking endpoints…');
  if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
  const startElevationM = Number(endpointResult.elevations[0]);
  const endElevationM = Number(endpointResult.elevations[1]);
  if (endElevationM > startElevationM + ABEARC_GRAVITY_ASCENT_TOLERANCE_M) {
    return {
      indexes: null,
      endpointHigher: true,
      endpointRiseM: endElevationM - startElevationM,
      startElevationM,
      endElevationM,
      sourceKey: endpointResult.sourceKey,
      sourceLabel: endpointResult.sourceLabel || sourceLabelDefault,
      corridorM: 0,
      gridSpacingM: sourceResolutionM,
      sourceResolutionM,
      straightDistanceM
    };
  }

  // Fast path: if the direct alignment is already downhill at DEM resolution,
  // no 2D routing grid is required.
  const directSpacingM = Math.max(sourceResolutionM, Math.min(sourceResolutionM * 1.5, 15));
  const directSample = abearcGravitySampleLine(start, end, directSpacingM);
  const directResult = await abearcGravityFetchElevations(
    directSample.locations, signal, endpointResult.sourceKey, 10, 22,
    'Testing direct gravity alignment…'
  );
  if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
  if (abearcGravityIsNonAscending(directResult.elevations, ABEARC_GRAVITY_NUMERIC_EPSILON_M)) {
    const candidate = abearcGravityLineSearchResult(directSample, directResult);
    const validation = await abearcGravityValidateFinalRoute(candidate, signal, sourceKey);
    if (validation.valid && validation.maximumContinuousClimbM <= ABEARC_GRAVITY_NUMERIC_EPSILON_M) {
      updateAbearcGravityProgress(96, 'Direct downhill path found', 'No terrain detour is required.');
      return { ...candidate, finalTerrainValidation: validation };
    }
  }

  // A ridge/high point on the straight Point 1 -> Point 2 alignment is NOT a
  // no-path condition. It only invalidates the direct alignment. Record the
  // obstruction so the 2D router can use a more aggressive bypass search.
  const directMaximumElevationM = Math.max(...directResult.elevations.map(Number).filter(Number.isFinite));
  const directObstacleRiseM = Number.isFinite(directMaximumElevationM)
    ? Math.max(0, directMaximumElevationM - startElevationM) : 0;
  const directHasAboveStartBarrier = directObstacleRiseM > ABEARC_GRAVITY_ASCENT_TOLERANCE_M;
  if (directHasAboveStartBarrier) {
    updateAbearcGravityProgress(22, 'Direct alignment blocked by higher ground',
      `Searching around a ridge/high point about ${directObstacleRiseM.toFixed(1)} m above Point 1…`);
  }

  const effectiveSourceKey = directResult.sourceKey || endpointResult.sourceKey || sourceKey;
  const effectiveResolutionM = Math.max(2, Number(ABEARC_MAP_ELEVATION_RESOLUTION_M[effectiveSourceKey]) || sourceResolutionM);

  // Collect visible contour networks for diagnostics, but only contours from
  // the user-selected DEM may guide this source-locked analysis. Contours from
  // other/unknown sources remain visible on the map but are never mixed into
  // the gravity result.
  const visibleContourDatasets = abearcGravityVisibleContourDatasets(
    effectiveSourceKey, directResult.sourceLabel || endpointResult.sourceLabel || sourceLabelDefault
  );
  const sameSourceContourDatasets = visibleContourDatasets.filter(dataset => dataset.sourceMatches);
  const crossSourceContourDatasets = visibleContourDatasets.filter(dataset => !dataset.sourceMatches);
  updateAbearcGravityProgress(23, 'Checking visible contour routes…', visibleContourDatasets.length
    ? `${visibleContourDatasets.length} visible contour network${visibleContourDatasets.length === 1 ? '' : 's'} found · ${sameSourceContourDatasets.length} from the selected DEM${crossSourceContourDatasets.length ? ` · ${crossSourceContourDatasets.length} other-source network${crossSourceContourDatasets.length === 1 ? '' : 's'} ignored by source lock` : ''}.`
    : 'No visible contour network is currently stored with the measurements.');
  const displayedContourResult = abearcGravityDisplayedContourRescue(
    start, end, startElevationM, endElevationM, effectiveSourceKey,
    directResult.sourceLabel || endpointResult.sourceLabel || sourceLabelDefault,
    sameSourceContourDatasets
  );
  if (displayedContourResult?.indexes?.length) {
    const validation = await abearcGravityValidateFinalRoute(displayedContourResult, signal, effectiveSourceKey);
    if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
    if (validation.valid) {
      updateAbearcGravityProgress(97, 'Contour-guided gravity path found',
        `Following ${Number(displayedContourResult.contourIntervalM || 0).toFixed(0)} m generated contours${displayedContourResult.contourMeasurementName ? ` from ${displayedContourResult.contourMeasurementName}` : ''}; final ${validation.sampleStepM.toFixed(1)} m terrain profile checked.`);
      return { ...displayedContourResult, visibleContourSetsChecked: visibleContourDatasets.length, finalTerrainValidation: validation, validatedMaximumStepAscentM: validation.maximumStepAscentM };
    }
    console.warn('Rejected contour-guided route because the final applied polyline ascends on the selected DEM.', validation.maximumContinuousClimbM);
  }

  const localSource = effectiveSourceKey === 'namria-dtm5-prs92';
  let nativeNamriaAttempt = null;
  {
    updateAbearcGravityProgress(25, 'Building reverse gravity reachability…',
      `Starting at Point 2 and expanding backward through ${abearcGravitySourceLabel(effectiveSourceKey)} terrain that can drain continuously to the outlet.`);
    try {
      nativeNamriaAttempt = await abearcGravityFetchServerPath(start, end, signal, effectiveSourceKey, ABEARC_GRAVITY_MAX_CORRIDOR_M);
      if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
      if (nativeNamriaAttempt?.found && nativeNamriaAttempt.indexes?.length) {
        const validation = await abearcGravityValidateFinalRoute(nativeNamriaAttempt, signal, effectiveSourceKey);
        if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
        if (validation.valid) {
          updateAbearcGravityProgress(97, localSource ? 'Native NAMRIA gravity path found' : 'Source-locked gravity path found', nativeNamriaAttempt.noiseCorrected
            ? `Native 5 m route found after correcting only small DTM cell noise (raw ascent ${Number(nativeNamriaAttempt.totalRawAscentM || 0).toFixed(2)} m total).`
            : `Native route verified on the final ${validation.sampleStepM.toFixed(1)} m terrain profile.`);
          nativeNamriaAttempt.visibleContourSetsChecked = visibleContourDatasets.length;
          nativeNamriaAttempt.sameSourceContourSetsChecked = sameSourceContourDatasets.length;
          nativeNamriaAttempt.finalTerrainValidation = validation;
          nativeNamriaAttempt.validatedMaximumStepAscentM = validation.maximumStepAscentM;
          return nativeNamriaAttempt;
        }
        console.warn('Rejected native NAMRIA route because the final applied polyline ascends.', validation.maximumContinuousClimbM);
        nativeNamriaAttempt = { ...nativeNamriaAttempt, found: false, rejectedFinalProfile: true, rejectedMaximumStepAscentM: validation.maximumStepAscentM };
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.warn('Server gravity routing failed; continuing with browser routing.', error);
      nativeNamriaAttempt = { found: false, error: error?.message || 'Server terrain search unavailable' };
    }
  }

  // If strict native-cell and sub-cell routing cannot connect the endpoints,
  // use contours generated directly from the SAME NAMRIA DTM window. This is
  // independent of whether the user has generated/shown contours on the map.
  // The route can move sideways on a level contour and only transition toward
  // lower contour levels, which matches the intended gravity-path rule.
  if (localSource && nativeNamriaAttempt?.nativeContourPaths?.length) {
    updateAbearcGravityProgress(27, 'Tracing native NAMRIA contours…',
      `${nativeNamriaAttempt.nativeContourPaths.length.toLocaleString()} internal contour line${nativeNamriaAttempt.nativeContourPaths.length === 1 ? '' : 's'} · ${Number(nativeNamriaAttempt.nativeContourIntervalM || 10).toFixed(0)} m interval`);
    const nativeContourDataset = {
      paths: nativeNamriaAttempt.nativeContourPaths,
      sourceKey: effectiveSourceKey,
      sourceMatches: true,
      imported: false,
      sourceLabel: nativeNamriaAttempt.sourceLabel || directResult.sourceLabel || sourceLabelDefault,
      sourceResolutionM: Number(nativeNamriaAttempt.nativeSpacingM) || effectiveResolutionM,
      effectiveSpacingM: Number(nativeNamriaAttempt.nativeSpacingM) || effectiveResolutionM,
      intervalM: Number(nativeNamriaAttempt.nativeContourIntervalM) || 10,
      maximumConnectorM: 350,
      measurementName: 'Native NAMRIA terrain',
      origin: 'native-generated'
    };
    const nativeContourResult = abearcGravityDisplayedContourRescue(
      start, end,
      startElevationM, endElevationM,
      effectiveSourceKey, nativeContourDataset.sourceLabel, [nativeContourDataset]
    );
    if (nativeContourResult?.indexes?.length) {
      const candidate = {
        ...nativeContourResult,
        strategy: 'native-namria-generated-contour-guided',
        nativeContourGenerated: true,
        nativeContourIntervalM: Number(nativeNamriaAttempt.nativeContourIntervalM) || 10,
        nativeContourPathCount: nativeNamriaAttempt.nativeContourPaths.length,
        visibleContourSetsChecked: visibleContourDatasets.length,
        sameSourceContourSetsChecked: sameSourceContourDatasets.length
      };
      const validation = await abearcGravityValidateFinalRoute(candidate, signal, effectiveSourceKey);
      if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
      if (validation.valid) {
        updateAbearcGravityProgress(97, 'Native contour-guided gravity path found',
          `Following internally generated NAMRIA ${Number(nativeNamriaAttempt.nativeContourIntervalM || 10).toFixed(0)} m contours; final ${validation.sampleStepM.toFixed(1)} m terrain profile checked.`);
        return { ...candidate, finalTerrainValidation: validation, validatedMaximumStepAscentM: validation.maximumStepAscentM };
      }
      console.warn('Rejected native contour-guided route because its final terrain profile contains ascent.', validation.maximumContinuousClimbM);
    }
  }

  // Do not use cross-source/imported contour geometry as a routing fallback.
  // Gravity Flow Path is fixed to the NAMRIA 5 m DTM and never switches DEMs.
  const coarseBudget = localSource ? ABEARC_GRAVITY_LOCAL_COARSE_BUDGET : ABEARC_GRAVITY_REMOTE_COARSE_BUDGET;
  const fineBudget = localSource ? ABEARC_GRAVITY_LOCAL_FINE_BUDGET : ABEARC_GRAVITY_REMOTE_FINE_BUDGET;
  const baseCoarseSpacingM = Math.max(effectiveResolutionM * 2.5, localSource ? 12 : effectiveResolutionM * 1.5);
  const fineSpacingM = effectiveResolutionM;
  // ponytail: after native sub-cell + contour checks, strict mode stops at the
  // existing search limit; wider/finer terrain coverage needs a separate search budget.
  const corridors = localSource && abearcGravityRoutingMode === 'downhill-only' && nativeNamriaAttempt && !nativeNamriaAttempt.error
    ? [] : abearcGravityCorridors(straightDistanceM, effectiveResolutionM);
  let widestPlan = null;
  let finestAttemptM = baseCoarseSpacingM;

  for (let stageIndex = 0; stageIndex < corridors.length; stageIndex++) {
    if (signal?.aborted) throw new DOMException('Calculation cancelled', 'AbortError');
    const corridorM = corridors[stageIndex];
    const stageStart = 23 + (stageIndex / corridors.length) * 56;
    const stageEnd = 23 + ((stageIndex + 1) / corridors.length) * 56;
    let plan = abearcGravityBuildPlan(start, end, {
      sourceKey: effectiveSourceKey,
      corridorM,
      spacingM: baseCoarseSpacingM,
      budget: coarseBudget
    });
    widestPlan = plan;
    finestAttemptM = Math.min(finestAttemptM, plan.spacingM);
    updateAbearcGravityProgress(stageStart, `Searching ±${Math.round(plan.corridorM)} m corridor…`,
      `Coarse terrain grid · about ${Math.round(plan.spacingM)} m spacing · any non-ascending route accepted`);
    let coarseElevation = await abearcGravityElevationsForPlan(
      plan, signal, effectiveSourceKey, stageStart, Math.max(stageStart + 1, stageEnd - 5),
      `Sampling ±${Math.round(plan.corridorM)} m corridor…`
    );
    if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
    updateAbearcGravityProgress(stageEnd - 4, `Searching ±${Math.round(plan.corridorM)} m corridor…`, 'Running all-descent path search; steep drops are allowed.');
    let coarseIndexes = abearcGravityFindPathOnGrid(plan, coarseElevation.elevations);

    // A coarse grid can miss a narrow descending route even when the direct
    // line never rises above Point 1. Always retry the FULL corridor more
    // densely before declaring it blocked. This is an existence search: it
    // does not require a gradual descent and does not depend on detecting a
    // particular kind of ridge first.
    if (!coarseIndexes?.length) {
      const anyRouteBudget = localSource ? ABEARC_GRAVITY_LOCAL_ANY_ROUTE_BUDGET : ABEARC_GRAVITY_REMOTE_ANY_ROUTE_BUDGET;
      const bypassSpacingM = Math.max(effectiveResolutionM, Math.min(baseCoarseSpacingM * 0.50, plan.spacingM * 0.55));
      const bypassPlan = abearcGravityBuildPlan(start, end, {
        sourceKey: effectiveSourceKey,
        corridorM,
        alongMarginM: corridorM,
        spacingM: bypassSpacingM,
        budget: anyRouteBudget
      });
      finestAttemptM = Math.min(finestAttemptM, bypassPlan.spacingM);
      updateAbearcGravityProgress(stageEnd - 3, 'Searching for any descending route…',
        `${bypassPlan.activeCount.toLocaleString()} terrain cells · about ${Math.round(bypassPlan.spacingM)} m spacing · steep drops allowed`);
      const bypassElevation = await abearcGravityElevationsForPlan(
        bypassPlan, signal, effectiveSourceKey, stageEnd - 3, Math.max(stageEnd - 2, stageEnd - 1),
        'Sampling denser all-descent corridor…'
      );
      if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
      const bypassIndexes = abearcGravityFindPathOnGrid(bypassPlan, bypassElevation.elevations);
      if (bypassIndexes?.length) {
        plan = bypassPlan;
        coarseElevation = bypassElevation;
        coarseIndexes = bypassIndexes;
      } else {
        // A valid route can exist continuously between raster/grid nodes even
        // when no 8-neighbour cell-centre chain exists. Before widening the
        // corridor, trace a compact contour graph on this already-sampled
        // terrain. This is much cheaper than adding long-range neighbors to
        // every A* node and directly targets the "visible contour route but no
        // raster path" case.
        const bypassContourResult = abearcGravityContourGraphRescueFromPlan(
          bypassPlan,
          bypassElevation.elevations,
          startElevationM,
          endElevationM,
          bypassElevation.sourceKey || effectiveSourceKey,
          bypassElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault
        );
        if (bypassContourResult?.indexes?.length) {
          const bypassContourValidation = await abearcGravityValidateFinalRoute(bypassContourResult, signal, effectiveSourceKey);
          if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
          if (bypassContourValidation.valid) {
            updateAbearcGravityProgress(97, 'Contour-network gravity path found',
              `No cell-centre route was required; ${Number(bypassContourResult.contourIntervalM || 0).toFixed(0)} m contours from the selected DEM produced a verified non-ascending alignment.`);
            return {
              ...bypassContourResult,
              finalTerrainValidation: bypassContourValidation,
              validatedMaximumStepAscentM: bypassContourValidation.maximumStepAscentM
            };
          }
          console.warn('Rejected bypass contour-network route because its final selected-DEM profile ascends.', bypassContourValidation.maximumContinuousClimbM);
        }
      }
    }

    if (!coarseIndexes?.length) {
      updateAbearcGravityProgress(stageEnd, `No route inside ±${Math.round(plan.corridorM)} m`,
        stageIndex < corridors.length - 1 ? 'Automatically widening the search corridor…' : 'Maximum corridor reached.');
      await new Promise(resolve => setTimeout(resolve, 0));
      continue;
    }

    const coarseRouteLocal = coarseIndexes.map(index => plan.local[index]);
    const maxCross = coarseRouteLocal.reduce((max, point) => Math.max(max, Math.abs(point.y)), 0);
    const refinementBuffers = [
      Math.max(effectiveResolutionM * 4, plan.spacingM * 1.5, 25),
      Math.max(effectiveResolutionM * 8, plan.spacingM * 3, 50)
    ];

    for (let refineIndex = 0; refineIndex < refinementBuffers.length; refineIndex++) {
      const routeBufferM = refinementBuffers[refineIndex];
      const fineCorridorM = Math.min(ABEARC_GRAVITY_MAX_CORRIDOR_M, Math.max(maxCross + routeBufferM, routeBufferM));
      const refineStart = Math.min(91, stageEnd + refineIndex * 5);
      const refineEnd = Math.min(96, refineStart + 5);
      const finePlan = abearcGravityBuildPlan(start, end, {
        sourceKey: effectiveSourceKey,
        corridorM: fineCorridorM,
        spacingM: fineSpacingM,
        budget: fineBudget,
        routeLocal: coarseRouteLocal,
        routeBufferM
      });
      finestAttemptM = Math.min(finestAttemptM, finePlan.spacingM);
      updateAbearcGravityProgress(refineStart, 'Refining promising route…',
        `${finePlan.activeCount.toLocaleString()} fine-grid cells · about ${Math.round(finePlan.spacingM)} m spacing`);
      const fineElevation = await abearcGravityElevationsForPlan(
        finePlan, signal, effectiveSourceKey, refineStart, refineEnd - 1,
        'Refining terrain around route…'
      );
      if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
      const fineIndexes = abearcGravityFindPathOnGrid(finePlan, fineElevation.elevations);
      if (fineIndexes?.length) {
        updateAbearcGravityProgress(97, 'Fine gravity path found', 'Verifying route statistics…');
        return {
          plan: finePlan,
          elevations: fineElevation.elevations,
          indexes: fineIndexes,
          sourceKey: fineElevation.sourceKey || effectiveSourceKey,
          sourceLabel: fineElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault,
          coarseSpacingM: plan.spacingM,
          strategy: 'hierarchical-a-star'
        };
      }
    }
    // The shortest coarse route can be a false candidate if it jumped over a
    // small DEM rise. Before widening the corridor, search the ENTIRE current
    // corridor on the densest practical grid for a different non-ascending
    // route. This prevents one bad coarse candidate from hiding another valid
    // route elsewhere in the same search area.
    const alternateBudget = localSource ? ABEARC_GRAVITY_LOCAL_ANY_ROUTE_BUDGET : ABEARC_GRAVITY_REMOTE_ANY_ROUTE_BUDGET;
    const alternatePlan = abearcGravityBuildPlan(start, end, {
      sourceKey: effectiveSourceKey,
      corridorM,
      alongMarginM: corridorM,
      spacingM: fineSpacingM,
      budget: alternateBudget
    });
    const materiallyDenser = alternatePlan.spacingM < plan.spacingM * 0.90;
    if (materiallyDenser) {
      finestAttemptM = Math.min(finestAttemptM, alternatePlan.spacingM);
      updateAbearcGravityProgress(Math.min(stageEnd + 1, 92), 'Checking alternate all-descent routes…',
        `${alternatePlan.activeCount.toLocaleString()} full-corridor cells · about ${Math.round(alternatePlan.spacingM)} m spacing`);
      const alternateElevation = await abearcGravityElevationsForPlan(
        alternatePlan, signal, effectiveSourceKey, Math.min(stageEnd + 1, 92), Math.min(stageEnd + 3, 95),
        'Sampling alternate descending routes…'
      );
      if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
      const alternateIndexes = abearcGravityFindPathOnGrid(alternatePlan, alternateElevation.elevations);
      if (!alternateIndexes?.length) {
        updateAbearcGravityProgress(Math.min(stageEnd + 2, 94), 'Tracing contour-resolved gravity routes…',
          'Following equal-elevation DEM contours sideways, then stepping only to lower terrain.');

        // First use the same graph-based contour router that successfully works
        // with exported/generated contour networks. Building that graph from the
        // already-sampled terrain closes the gap between "I can see a contour
        // route" and the raster A* result, without adding expensive long-range
        // neighbor expansion to every terrain cell.
        const graphContourResult = abearcGravityContourGraphRescueFromPlan(
          alternatePlan,
          alternateElevation.elevations,
          startElevationM,
          endElevationM,
          alternateElevation.sourceKey || effectiveSourceKey,
          alternateElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault
        );
        if (graphContourResult?.indexes?.length) {
          const graphValidation = await abearcGravityValidateFinalRoute(graphContourResult, signal, effectiveSourceKey);
          if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
          if (graphValidation.valid) {
            updateAbearcGravityProgress(97, 'Contour-network gravity path found',
              `Generated ${Number(graphContourResult.contourIntervalM || 0).toFixed(0)} m routing contours from the selected DEM; final ${graphValidation.sampleStepM.toFixed(1)} m profile verified non-ascending.`);
            return {
              ...graphContourResult,
              finalTerrainValidation: graphValidation,
              validatedMaximumStepAscentM: graphValidation.maximumStepAscentM
            };
          }
          console.warn('Rejected sampled contour-network route because its final selected-DEM profile ascends.', graphValidation.maximumContinuousClimbM);
        }

        const contourLocalPoints = abearcGravityContourRescue(alternatePlan, alternateElevation.elevations, startElevationM, endElevationM);
        const contourResult = contourLocalPoints?.length
          ? abearcGravityContourRouteResult(
              alternatePlan, alternateElevation.elevations, contourLocalPoints,
              alternateElevation.sourceKey || effectiveSourceKey,
              alternateElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault,
              plan.spacingM
            )
          : null;
        if (contourResult?.indexes?.length) {
          const contourValidation = await abearcGravityValidateFinalRoute(contourResult, signal, effectiveSourceKey);
          if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
          if (contourValidation.valid) {
            updateAbearcGravityProgress(97, 'Contour-resolved gravity path found', 'All route segments stay level or descend on the selected DEM surface.');
            return {
              ...contourResult,
              finalTerrainValidation: contourValidation,
              validatedMaximumStepAscentM: contourValidation.maximumStepAscentM
            };
          }
        }
      }
      if (alternateIndexes?.length && alternatePlan.spacingM <= effectiveResolutionM * 1.05) {
        updateAbearcGravityProgress(97, 'Alternate gravity path found', 'Full-corridor DEM-resolution route verified.');
        return {
          plan: alternatePlan,
          elevations: alternateElevation.elevations,
          indexes: alternateIndexes,
          sourceKey: alternateElevation.sourceKey || effectiveSourceKey,
          sourceLabel: alternateElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault,
          coarseSpacingM: plan.spacingM,
          strategy: 'dense-full-corridor-a-star'
        };
      }
      if (alternateIndexes?.length) {
        const alternateRouteLocal = alternateIndexes.map(index => alternatePlan.local[index]);
        const verifyBufferM = Math.max(effectiveResolutionM * 6, alternatePlan.spacingM * 2, 30);
        const verifyPlan = abearcGravityBuildPlan(start, end, {
          sourceKey: effectiveSourceKey,
          corridorM,
          spacingM: fineSpacingM,
          budget: fineBudget,
          routeLocal: alternateRouteLocal,
          routeBufferM: verifyBufferM
        });
        finestAttemptM = Math.min(finestAttemptM, verifyPlan.spacingM);
        const verifyElevation = await abearcGravityElevationsForPlan(
          verifyPlan, signal, effectiveSourceKey, Math.min(stageEnd + 3, 95), Math.min(stageEnd + 4, 96),
          'Verifying alternate descending route…'
        );
        if (requestId !== abearcMapGravityPathRequestId) throw new DOMException('Request was superseded', 'AbortError');
        const verifyIndexes = abearcGravityFindPathOnGrid(verifyPlan, verifyElevation.elevations);
        if (verifyIndexes?.length) {
          updateAbearcGravityProgress(97, 'Alternate gravity path found', 'Fine DEM route verified.');
          return {
            plan: verifyPlan,
            elevations: verifyElevation.elevations,
            indexes: verifyIndexes,
            sourceKey: verifyElevation.sourceKey || effectiveSourceKey,
            sourceLabel: verifyElevation.sourceLabel || directResult.sourceLabel || sourceLabelDefault,
            coarseSpacingM: alternatePlan.spacingM,
            strategy: 'dense-full-corridor-a-star'
          };
        }
      }
    }

    // No verified route exists on the current sampled corridor. Widen and try
    // again; do not fail merely because the descent would be steep.
    updateAbearcGravityProgress(Math.min(stageEnd + 2, 90), 'No verified all-descent route in this corridor',
      stageIndex < corridors.length - 1 ? 'Widening the terrain corridor for another route…' : 'No finer route remains.');
  }

  return {
    indexes: null,
    endpointHigher: false,
    endpointRiseM: 0,
    startElevationM,
    endElevationM,
    sourceKey: effectiveSourceKey,
    sourceLabel: directResult.sourceLabel || sourceLabelDefault,
    corridorM: Math.max(widestPlan?.corridorM || corridors.at(-1) || 0, Number(nativeNamriaAttempt?.corridorM) || 0),
    gridSpacingM: widestPlan ? finestAttemptM : 0,
    sourceResolutionM: effectiveResolutionM,
    straightDistanceM,
    visibleContourSetsChecked: visibleContourDatasets?.length || 0,
    sameSourceContourSetsChecked: sameSourceContourDatasets?.length || 0,
    nativeNamriaAttempted: Boolean(localSource),
    nativeNamriaFound: Boolean(nativeNamriaAttempt?.found),
    nativeNamriaError: String(nativeNamriaAttempt?.error || ''),
    nativeNamriaSpacingM: Number(nativeNamriaAttempt?.nativeSpacingM) || effectiveResolutionM,
    nativeNamriaSubcellAttempted: Boolean(nativeNamriaAttempt?.subcellAttempted),
    nativeNamriaSubcellSpacingM: Number(nativeNamriaAttempt?.subcellSpacingM) || 0,
    nativeNamriaReverseReachableCount: Number(nativeNamriaAttempt?.reverseReachableCount) || 0,
    nativeNamriaMaskedAStarExpandedCount: Number(nativeNamriaAttempt?.maskedAStarExpandedCount) || 0,
    nativeNamriaBottleneckCount: Number(nativeNamriaAttempt?.bottleneckCount) || 0,
    nativeNamriaReverseAnyAngleEdgesUsed: Number(nativeNamriaAttempt?.reverseAnyAngleEdgesUsed) || 0,
    nativeNamriaContourGenerated: Boolean(nativeNamriaAttempt?.nativeContourGenerated),
    nativeNamriaContourIntervalM: Number(nativeNamriaAttempt?.nativeContourIntervalM) || 0,
    nativeNamriaContourPathCount: Array.isArray(nativeNamriaAttempt?.nativeContourPaths) ? nativeNamriaAttempt.nativeContourPaths.length : 0
  };
}

function abearcGravitySlopeStats(locations, elevations, targetGrade = null) {
  let distanceM = 0, squaredGradeIntegral = 0;
  for (let i = 1; i < locations.length; i++) {
    const a = locations[i - 1], b = locations[i];
    const distance = haversineMetres([a.longitude, a.latitude], [b.longitude, b.latitude]);
    if (distance < 0.001) continue;
    const drop = elevations[i - 1] - elevations[i];
    distanceM += distance;
    squaredGradeIntegral += drop * drop / distance;
  }
  const dropM = elevations[0] - elevations.at(-1);
  const meanGrade = distanceM > 0 ? dropM / distanceM : 0;
  const variance = Math.max(0, squaredGradeIntegral / Math.max(distanceM, 0.001) - meanGrade * meanGrade);
  const grade = targetGrade == null ? meanGrade : targetGrade;
  return { distanceM, meanGrade, variation: Math.sqrt(variance) / Math.max(0.00001, Math.abs(meanGrade)),
    cost: Math.max(0, squaredGradeIntegral - 2 * grade * dropM + grade * grade * distanceM) };
}

async function abearcGravityImproveSlope(search, signal) {
  const validation = search.finalTerrainValidation;
  const locations = validation.locations, elevations = validation.elevations;
  const before = abearcGravitySlopeStats(locations, elevations);
  const unchanged = { ...search, uniformSlope: { improved: false, improvementPct: 0, meanGradePct: before.meanGrade * 100 } };
  if (!(before.meanGrade > 0) || before.variation < 0.05) return unchanged;

  // ponytail: bounded forward shortcuts, not a global grade optimizer. Expand
  // to lateral terrain search only if this local pass proves insufficient.
  const anchors = [0];
  const anchorSpacingM = Math.max(10, before.distanceM / 80);
  let sinceAnchor = 0;
  for (let i = 1; i < locations.length; i++) {
    const a = locations[i - 1], b = locations[i];
    sinceAnchor += haversineMetres([a.longitude, a.latitude], [b.longitude, b.latitude]);
    if (sinceAnchor >= anchorSpacingM || i === locations.length - 1) { anchors.push(i); sinceAnchor = 0; }
  }
  const edges = anchors.map(() => []);
  const samples = [], candidates = [];
  const budget = search.sourceKey === 'namria-dtm5-prs92' ? 30000 : 9000;
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i], to = anchors[i + 1];
    const baseLocations = locations.slice(from, to + 1), baseElevations = elevations.slice(from, to + 1);
    edges[i].push({ to: i + 1, locations: baseLocations, elevations: baseElevations,
      cost: abearcGravitySlopeStats(baseLocations, baseElevations, before.meanGrade).cost });
    for (const skip of [2, 4, 8, 16, 32]) {
      if (i + skip >= anchors.length) continue;
      const last = anchors[i + skip];
      if (elevations[from] - elevations[last] < 0.2) continue;
      const chord = abearcGravityDensifyRouteLocations({ locations: [locations[from], locations[last]] }, [0, 1], validation.sampleStepM);
      if (samples.length + chord.length > budget) continue;
      candidates.push({ from: i, to: i + skip, offset: samples.length, locations: chord });
      samples.push(...chord);
    }
  }
  if (!samples.length) return unchanged;
  const sampled = await abearcGravityFetchElevations(samples, signal, search.sourceKey, 82, 96, 'Checking more uniform downhill connections…');
  for (const candidate of candidates) {
    const values = sampled.elevations.slice(candidate.offset, candidate.offset + candidate.locations.length);
    if (!abearcGravityIsNonAscending(values)) continue;
    edges[candidate.from].push({ to: candidate.to, locations: candidate.locations, elevations: values,
      cost: abearcGravitySlopeStats(candidate.locations, values, before.meanGrade).cost });
  }
  const costs = new Float64Array(anchors.length).fill(Infinity), previous = new Array(anchors.length);
  costs[0] = 0;
  for (let i = 0; i < anchors.length; i++) for (const edge of edges[i]) {
    const cost = costs[i] + edge.cost;
    if (cost < costs[edge.to]) { costs[edge.to] = cost; previous[edge.to] = { ...edge, from: i }; }
  }
  const chosen = [];
  for (let cursor = anchors.length - 1; cursor > 0;) {
    const edge = previous[cursor];
    if (!edge) return unchanged;
    chosen.push(edge); cursor = edge.from;
  }
  chosen.reverse();
  const nextLocations = [locations[0]], nextElevations = [elevations[0]];
  for (const edge of chosen) {
    nextLocations.push(...edge.locations.slice(1));
    nextElevations.push(...edge.elevations.slice(1));
  }
  const after = abearcGravitySlopeStats(nextLocations, nextElevations);
  if (!(after.variation < before.variation * 0.99)) return unchanged;
  const candidate = { ...search, plan: { ...search.plan, locations: nextLocations },
    indexes: nextLocations.map((_, index) => index), elevations: nextElevations };
  const finalValidation = await abearcGravityValidateFinalRoute(candidate, signal, search.sourceKey);
  const verified = abearcGravitySlopeStats(finalValidation.locations, finalValidation.elevations);
  if (!finalValidation.valid || finalValidation.totalAscentM > validation.totalAscentM + ABEARC_GRAVITY_NUMERIC_EPSILON_M
      || finalValidation.maximumContinuousClimbM > validation.maximumContinuousClimbM + ABEARC_GRAVITY_NUMERIC_EPSILON_M
      || !(verified.variation < before.variation * 0.99)) return unchanged;
  return { ...candidate, finalTerrainValidation: finalValidation, validatedMaximumStepAscentM: finalValidation.maximumStepAscentM,
    uniformSlope: { improved: true, improvementPct: (1 - verified.variation / before.variation) * 100, meanGradePct: verified.meanGrade * 100 } };
}

async function abearcGravityRunSearch(start, end, signal, requestId, sourceKey, preferUniformSlope = true, routingMode = 'minimum-ascent') {
  abearcGravitySetRoutingMode(routingMode);
  const report = updateAbearcGravityProgress;
  updateAbearcGravityProgress = (percent, stage, detail) => report(percent * 0.8, stage, detail);
  let search;
  try {
    search = await abearcGravitySearchHierarchical(start, end, signal, requestId, sourceKey);
    if (search.indexes?.length) {
      const validation = search.finalTerrainValidation || await abearcGravityValidateFinalRoute(search, signal, sourceKey);
      if (!validation.valid) throw new Error('The calculated route did not pass the final terrain check. Try another alignment.');
      search = { ...search, finalTerrainValidation: validation, validatedMaximumStepAscentM: validation.maximumStepAscentM };
    }
  } finally { updateAbearcGravityProgress = report; }
  if (!search.indexes?.length) return search;
  if (preferUniformSlope) {
    updateAbearcGravityProgress(81, 'Improving downhill slope consistency…', 'The validated route will be kept if no gentler connection passes the terrain checks.');
    try { search = await abearcGravityImproveSlope(search, signal); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      const slope = abearcGravitySlopeStats(search.finalTerrainValidation.locations, search.finalTerrainValidation.elevations);
      search.uniformSlope = { improved: false, improvementPct: 0, meanGradePct: slope.meanGrade * 100, unavailable: true };
    }
  }
  return { ...search, routingMode: abearcGravityRoutingMode };
}

function abearcGravitySearchInWorker(start, end, signal, requestId, sourceKey, preferUniformSlope, routingMode) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`/assets/js/map-gravity-worker.js?v=${encodeURIComponent(window.__ABEARC_BUILD_ID || '')}`);
    const finish = (error, result) => {
      signal.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const cancel = () => finish(new DOMException('Calculation cancelled', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel();
    worker.onerror = event => finish(new Error(event.message || 'Background gravity routing could not start. Refresh the page and try again.'));
    worker.onmessageerror = () => finish(new Error('Background gravity routing returned unreadable data.'));
    worker.onmessage = async ({ data }) => {
      if (signal.aborted || requestId !== abearcMapGravityPathRequestId) return;
      if (data.type === 'progress') return updateAbearcGravityProgress(data.percent, data.stage, data.detail);
      if (data.type === 'result') return finish(null, data.result);
      if (data.type === 'error') return finish(new Error(data.message));
      if (data.type !== 'elevations' && data.type !== 'native') return;
      try {
        const result = data.type === 'elevations'
          ? await requestAbearcElevations(data.locations, signal, sourceKey, false)
          : await abearcGravityFetchServerPath(start, end, signal, sourceKey, data.corridorM);
        if (!signal.aborted) worker.postMessage({ type: 'response', id: data.id, result });
      } catch (error) {
        if (!signal.aborted) worker.postMessage({ type: 'response', id: data.id, error: error.message });
      }
    };
    worker.postMessage({ type: 'start', start, end, sourceKey, preferUniformSlope, routingMode,
      resolutions: ABEARC_MAP_ELEVATION_RESOLUTION_M,
      contours: abearcGravityVisibleContourDatasets(sourceKey, abearcGravitySourceLabel(sourceKey)) });
  });
}

async function abearcGravitySearch(lockedSourceKey = '', preferUniformSlope = true, routingMode = 'minimum-ascent') {
  if (abearcMapMeasureMode !== 'distance' || abearcMapMeasurePoints.length < 2 || abearcMapImportedPolygons.length) {
    throw new Error('Select a completed Distance measurement first.');
  }
  const sourceKey = ABEARC_GRAVITY_SOURCE_KEY;
  const start = [...abearcMapMeasurePoints[0]];
  const end = [...abearcMapMeasurePoints[abearcMapMeasurePoints.length - 1]];
  const requestId = ++abearcMapGravityPathRequestId;
  abearcMapGravityPathAbort?.abort();
  abearcMapGravityPathAbort = new AbortController();
  const signal = abearcMapGravityPathAbort.signal;
  abearcGravitySetRoutingMode(routingMode);
  if (typeof Worker === 'function') return abearcGravitySearchInWorker(start, end, signal, requestId, sourceKey, preferUniformSlope, routingMode);
  // Headless checks can run directly; a browser must never silently freeze the UI.
  if (typeof document?.createElement === 'function') throw new Error('This browser cannot start background routing. Use a browser with Web Worker support.');
  return abearcGravityRunSearch(start, end, signal, requestId, sourceKey, preferUniformSlope, routingMode);
}

async function findAbearcGravityFlowPath() {
  closeAbearcMapMeasureContextMenu?.();
  if (abearcMapMeasureMode !== 'distance' || abearcMapMeasurePoints.length < 2 || abearcMapImportedPolygons.length) {
    return toast('Select a completed Distance measurement first.', 'error');
  }
  const selectedSourceKey = await chooseAbearcGravitySource(abearcGravityCurrentSource());
  if (!selectedSourceKey) return;
  const preferUniformSlope = document.querySelector('[data-gravity-uniform-slope]')?.checked !== false;
  const routingMode = document.querySelector('[data-gravity-routing-mode]')?.value || 'minimum-ascent';
  // Keep the map's elevation-profile selector synchronized with the explicit
  // gravity source. The search itself also receives this key directly, so a
  // later UI change cannot alter a running analysis.
  abearcMapElevationSource = selectedSourceKey;
  abearcMapElevationKey = '';
  syncAbearcElevationSourceMenu?.();

  const originalGeometryKey = abearcGravityGeometryKey();
  const originalPointCount = abearcMapMeasurePoints.length;
  let cancelledByUser = false;
  let runController = null;
  showAbearcGravityProgress(() => {
    cancelledByUser = true;
    abearcMapGravityPathRequestId += 1;
    runController?.abort();
    hideAbearcGravityProgress();
    toast('Gravity-flow path calculation cancelled.');
  });
  try {
    const pendingSearch = abearcGravitySearch(selectedSourceKey, preferUniformSlope, routingMode);
    runController = abearcMapGravityPathAbort;
    const search = await pendingSearch;
    if (originalGeometryKey !== abearcGravityGeometryKey()) return toast('The distance measurement changed while terrain routing was running. Try again.', 'error');
    if (!search.indexes?.length) {
      updateAbearcGravityProgress(100, 'No gravity-flow path found', 'Search completed.');
      hideAbearcGravityProgress();
      await confirmModalChoice(
        `${abearcGravityNoPathMessage(search)}<p class="text-xs text-slate-500 mt-3">Gravity Flow Path is locked to <strong>NAMRIA DTM 5 m (PRS92)</strong>.</p>`,
        {
          title: 'No Gravity-Flow Path Found',
          confirmText: 'Close',
          confirmClass: 'px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium'
        }
      );
      return;
    }

    const validation = search.finalTerrainValidation;
    if (!validation?.valid || !Number.isFinite(validation.totalAscentM)
        || !Number.isFinite(validation.maximumContinuousClimbM)
        || (routingMode === 'downhill-only' && validation.maximumContinuousClimbM > ABEARC_GRAVITY_NUMERIC_EPSILON_M)) {
      throw new Error('The route is missing a successful terrain check. Try again.');
    }
    const stats = { ...abearcGravityPathStats(search.plan, search.elevations, search.indexes),
      totalAscentM: validation.totalAscentM, maximumContinuousClimbM: validation.maximumContinuousClimbM };
    if (Number.isFinite(search.validatedMaximumStepAscentM)) {
      stats.maximumStepAscentM = Math.max(stats.maximumStepAscentM, Number(search.validatedMaximumStepAscentM));
    }
    updateAbearcGravityProgress(100, 'Gravity-flow path ready', 'Terrain routing complete.');
    await new Promise(resolve => setTimeout(resolve, 120));
    hideAbearcGravityProgress();
    const detourPct = search.plan.straightDistanceM > 0 ? ((stats.routeDistanceM / search.plan.straightDistanceM - 1) * 100) : 0;
    const strategyLabel = search.strategy === 'straight-line' ? 'Direct alignment' : 'Ascent-first terrain routing';
    const hasClimb = stats.maximumContinuousClimbM > ABEARC_GRAVITY_NUMERIC_EPSILON_M;
    const routeStatement = hasClimb
      ? '<p class="text-amber-700"><strong>This route contains uphill terrain.</strong> Review the ascent below before applying it.</p>'
      : '<p><strong>A terrain-checked downhill path was found.</strong></p>';
    const sourceNote = search.strategy === 'displayed-contour-guided-cross-source'
      ? '<p class="text-xs text-amber-700"><strong>Source note:</strong> The selected DEM did not produce a route, so this path follows the visible contour network and is labeled with that contour source instead of being presented as a NAMRIA-derived path.</p>'
      : search.strategy === 'remote-source-reverse-mask-masked-a-star'
        ? `<p class="text-xs text-slate-500"><strong>Remote DEM routing:</strong> Reverse reachability was computed on terrain sampled only from ${esc(search.sourceLabel || abearcGravitySourceLabel(selectedSourceKey))}; the final applied route is re-sampled and checked against that same source.</p>`
        : search.strategy === 'native-namria-generated-contour-guided'
          ? `<p class="text-xs text-slate-500"><strong>Native contour fallback:</strong> No visible contour layer was required. The server generated ${Number(search.nativeContourIntervalM || search.contourIntervalM || 10).toFixed(0)} m contours directly from the installed NAMRIA DTM and routed from the current contour to the next lower contour.</p>`
          : search.noiseCorrected
            ? `<p class="text-xs text-amber-700"><strong>DTM noise note:</strong> Raw local upward steps are limited to ${Number(search.validatedMaximumStepAscentM || 0).toFixed(2)} m, with ${Number(search.totalRawAscentM || 0).toFixed(2)} m total raw ascent. The route is accepted only as sub-metre/native-cell noise correction, not as permission for a real uphill pipe alignment.</p>`
            : search.subcellInterpolated
              ? `<p class="text-xs text-slate-500"><strong>Terrain interpolation:</strong> The route was traced on the continuous bilinear NAMRIA surface at about ${Number(search.subcellSpacingM || search.plan.spacingM || 2.5).toFixed(1)} m spacing, allowing the line to follow contours between 5 m raster-cell centres with ascent measured against the same terrain surface.</p>`
              : '';
    const message = `<div class="text-left space-y-2">
      ${routeStatement}
      <p class="text-sm">Routing goal: <strong>${routingMode === 'downhill-only' ? 'Downhill only' : 'Minimize ascent'}</strong><br>Start elevation: <strong>${stats.startElevationM.toFixed(2)} m</strong><br>End elevation: <strong>${stats.endElevationM.toFixed(2)} m</strong><br>Total drop: <strong>${stats.totalDropM.toFixed(2)} m</strong><br>Route distance: <strong>${formatAbearcDistance(stats.routeDistanceM)}</strong>${detourPct > 1 ? ` (${detourPct.toFixed(1)}% longer than straight)` : ''}<br>Total ascent: <strong>${stats.totalAscentM.toFixed(3)} m</strong><br>Largest continuous climb: <strong>${stats.maximumContinuousClimbM.toFixed(3)} m</strong><br>Maximum sampled upward step: <strong>${stats.maximumStepAscentM.toFixed(3)} m</strong></p>
      <p class="text-sm">Method: ${esc(strategyLabel)}<br>Source: ${esc(search.sourceLabel)}${search.strategy === 'displayed-contour-guided' || search.strategy === 'displayed-contour-guided-cross-source' || search.strategy === 'native-namria-generated-contour-guided' ? `<br>Contour interval used: ${Number(search.nativeContourIntervalM || search.contourIntervalM || 0).toFixed(0)} m${search.contourMeasurementName ? `<br>Contour measurement: ${esc(search.contourMeasurementName)}` : ''}` : `${search.plan.corridorM ? `<br>Search corridor used: ±${Math.round(search.plan.corridorM)} m` : ''}<br>Final terrain grid: about ${Math.round(search.plan.spacingM)} m${search.coarseSpacingM && search.strategy !== 'straight-line' ? `<br>Coarse grid: about ${Math.round(search.coarseSpacingM)} m` : ''}`}</p>
      ${sourceNote}
      ${search.uniformSlope ? `<p class="text-sm"><strong>Slope consistency:</strong> ${search.uniformSlope.improved ? `Grade variation reduced by ${search.uniformSlope.improvementPct.toFixed(0)}%.` : search.uniformSlope.unavailable ? 'The improvement check could not finish; the validated route was retained.' : 'No more uniform route passed the terrain checks; the validated route was retained.'} Average downhill grade: ${search.uniformSlope.meanGradePct.toFixed(2)}%. A perfectly uniform slope depends on the terrain.</p>` : ''}
      ${originalPointCount > 2 ? '<p class="text-xs text-amber-700"><strong>Note:</strong> Applying this route replaces the current intermediate distance points while keeping Point 1 and the final endpoint fixed.</p>' : ''}
      <p class="text-xs text-slate-500">Field survey and hydraulic checks are still required before construction.</p>
    </div>`;
    const apply = await confirmModalChoice(message, {
      title: hasClimb ? 'Route Found · Uphill Terrain' : 'Gravity-Flow Path Found',
      confirmText: 'Apply Path',
      confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
    });
    if (!apply) return;
    if (originalGeometryKey !== abearcGravityGeometryKey()) return toast('The distance measurement changed before the route was applied. Try again.', 'error');

    rememberAbearcMapMeasureState?.();
    abearcMapElevationSource = search.sourceKey || selectedSourceKey;
    abearcMapElevationKey = '';
    syncAbearcElevationSourceMenu?.();
    abearcMapMeasurePoints = stats.points.map(point => [Number(point[0]), Number(point[1])]);
    abearcMapHiddenMeasurePointIndexes = new Set(abearcMapMeasurePoints.map((_, index) => index).filter(index => index > 0 && index < abearcMapMeasurePoints.length - 1));
    abearcMapElevationAnnotations.clear();
    abearcMapLastTouchedMeasureIndex = abearcMapMeasurePoints.length - 1;
    abearcMapGravityPathMeta = sanitizeAbearcGravityPathState({
      geometryKey: abearcGravityGeometryKey(abearcMapMeasurePoints),
      sourceKey: search.sourceKey,
      sourceLabel: search.sourceLabel,
      startElevationM: stats.startElevationM,
      endElevationM: stats.endElevationM,
      totalDropM: stats.totalDropM,
      routeDistanceM: stats.routeDistanceM,
      straightDistanceM: search.plan.straightDistanceM,
      corridorM: search.plan.corridorM,
      gridSpacingM: search.plan.spacingM,
      coarseGridSpacingM: search.coarseSpacingM,
      ascentToleranceM: Number(search.acceptedToleranceM) || ABEARC_GRAVITY_ASCENT_TOLERANCE_M,
      maximumStepAscentM: stats.maximumStepAscentM,
      totalAscentM: stats.totalAscentM,
      maximumContinuousClimbM: stats.maximumContinuousClimbM,
      routingMode,
      searchStrategy: search.strategy,
      createdAt: new Date().toISOString()
    });
    resetAbearcElevationProfile?.();
    saveAbearcMapMeasure?.();
    updateAbearcMapMeasureTools?.();
    renderAbearcMapMeasure?.();
    toast(`Gravity-flow path applied · ${formatAbearcDistance(stats.routeDistanceM)} · ${stats.totalDropM.toFixed(1)} m drop`);
  } catch (error) {
    if (error?.name === 'AbortError' || cancelledByUser) return;
    console.error('Gravity-flow path search failed:', error);
    hideAbearcGravityProgress();
    await confirmModalChoice(
      `<div class="text-left space-y-2"><p><strong>NAMRIA DTM 5 m (PRS92) could not complete the gravity-path analysis.</strong></p><p class="text-sm">${esc(error?.message || 'Elevation data is unavailable.')}</p><p class="text-xs text-slate-500">Gravity Flow Path uses NAMRIA only and does not fall back to another DEM.</p></div>`,
      {
        title: 'NAMRIA Terrain Unavailable',
        confirmText: 'Close',
        confirmClass: 'px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium'
      }
    );
  } finally {
    if (abearcMapGravityPathAbort === runController) {
      hideAbearcGravityProgress();
      abearcMapGravityPathAbort = null;
    }
  }
}

Object.assign(window, {
  findAbearcGravityFlowPath,
  isAbearcGravityPathActive,
  isGeneratedAbearcGravityPath,
  abearcGravityPathEndIndex,
  adjustAbearcGravityPathEndpoint,
  captureAbearcGravityPathState,
  restoreAbearcGravityPathState,
  sanitizeAbearcGravityPathState,
  abearcGravityFindPathOnGrid,
  abearcGravityBuildPlan,
  abearcGravityIsNonAscending,
  abearcGravityContourRescue,
  abearcGravityRouteContourPaths,
  abearcGravityInterpolateLocal,
  abearcGravitySourcePickerMarkup,
  chooseAbearcGravitySource,
  clearAbearcGravityElevationCache
});
