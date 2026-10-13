/* ABEARC SALT / contour farming layout tool.
 * This module deliberately reuses the map measurement/elevation primitives from
 * 12-abearc-map.js without changing the ordinary contour-line workflow.
 */
let abearcMapSaltAbort = null;
let abearcMapSaltRequestId = 0;
let abearcMapSaltData = null;
let abearcMapSaltSource = ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
let abearcMapSaltSettings = {
  method: 'spacing',
  targetSpacingM: 4,
  verticalIntervalM: 1,
  minSlopePct: 5,
  maxSlopePct: 50,
  boundarySetbackM: 0,
  minRowLengthM: 5,
  showLabels: true
};

function abearcSaltEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function abearcSaltRound(value, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
}

function abearcSaltPolygons() {
  return abearcContourPolygons().map(points => points.map(point => [Number(point[0]), Number(point[1])]));
}

function abearcSaltSelectionKey(polygons = abearcSaltPolygons()) {
  return abearcContourSelectionKey(polygons);
}

function abearcSaltSourceLabel(source = abearcMapSaltSource) {
  const labels = {
    'namria-dtm5-prs92': 'NAMRIA DTM 5 m (PRS92)',
    'aws-copernicus-glo30': 'AWS Copernicus GLO-30 DSM',
    'copernicus-glo90': 'Copernicus GLO-90 DSM',
    'aws-copernicus-glo90': 'AWS Copernicus GLO-90 DSM',
    'aws-mapzen': 'AWS Terrain Tiles (Mapzen)',
    'opentopo-srtm30': 'Open Topo Data SRTM Radar DEM'
  };
  return labels[source] || source;
}

function readAbearcSaltSettings() {
  const panel = document.getElementById('abearcMapSaltPanel');
  if (!panel) return { ...abearcMapSaltSettings };
  const method = panel.querySelector('[data-map-salt-method]')?.value === 'vertical' ? 'vertical' : 'spacing';
  const settings = {
    method,
    targetSpacingM: Number(panel.querySelector('[data-map-salt-spacing]')?.value),
    verticalIntervalM: Number(panel.querySelector('[data-map-salt-vertical]')?.value),
    minSlopePct: Number(panel.querySelector('[data-map-salt-min-slope]')?.value),
    maxSlopePct: Number(panel.querySelector('[data-map-salt-max-slope]')?.value),
    boundarySetbackM: Number(panel.querySelector('[data-map-salt-setback]')?.value),
    minRowLengthM: Number(panel.querySelector('[data-map-salt-min-row]')?.value),
    showLabels: Boolean(panel.querySelector('[data-map-salt-labels]')?.checked)
  };
  if (!(settings.targetSpacingM >= 1 && settings.targetSpacingM <= 100)) throw new Error('Target alley spacing must be between 1 and 100 metres.');
  if (!(settings.verticalIntervalM >= 0.25 && settings.verticalIntervalM <= 50)) throw new Error('Vertical interval must be between 0.25 and 50 metres.');
  if (!(settings.minSlopePct >= 0 && settings.minSlopePct < 200)) throw new Error('Minimum slope must be between 0 and 200%.');
  if (!(settings.maxSlopePct > settings.minSlopePct && settings.maxSlopePct <= 300)) throw new Error('Maximum slope must be greater than the minimum slope and no more than 300%.');
  if (!(settings.boundarySetbackM >= 0 && settings.boundarySetbackM <= 500)) throw new Error('Boundary setback must be between 0 and 500 metres.');
  if (!(settings.minRowLengthM >= 0 && settings.minRowLengthM <= 2000)) throw new Error('Minimum row length must be between 0 and 2,000 metres.');
  return settings;
}

function syncAbearcSaltControls() {
  const panel = document.getElementById('abearcMapSaltPanel');
  if (!panel) return;
  const source = panel.querySelector('[data-map-salt-source]');
  if (source) source.value = abearcMapSaltSource;
  const method = panel.querySelector('[data-map-salt-method]');
  if (method) method.value = abearcMapSaltSettings.method;
  const setValue = (selector, value) => {
    const input = panel.querySelector(selector);
    if (input && document.activeElement !== input) input.value = value;
  };
  setValue('[data-map-salt-spacing]', abearcMapSaltSettings.targetSpacingM);
  setValue('[data-map-salt-vertical]', abearcMapSaltSettings.verticalIntervalM);
  setValue('[data-map-salt-min-slope]', abearcMapSaltSettings.minSlopePct);
  setValue('[data-map-salt-max-slope]', abearcMapSaltSettings.maxSlopePct);
  setValue('[data-map-salt-setback]', abearcMapSaltSettings.boundarySetbackM);
  setValue('[data-map-salt-min-row]', abearcMapSaltSettings.minRowLengthM);
  const labels = panel.querySelector('[data-map-salt-labels]');
  if (labels) labels.checked = abearcMapSaltSettings.showLabels !== false;
  syncAbearcSaltMethodFields();
}

function syncAbearcSaltMethodFields() {
  const panel = document.getElementById('abearcMapSaltPanel');
  if (!panel) return;
  const method = panel.querySelector('[data-map-salt-method]')?.value === 'vertical' ? 'vertical' : 'spacing';
  panel.querySelector('[data-map-salt-spacing-field]')?.classList.toggle('is-disabled', method !== 'spacing');
  panel.querySelector('[data-map-salt-vertical-field]')?.classList.toggle('is-disabled', method !== 'vertical');
  const spacing = panel.querySelector('[data-map-salt-spacing]');
  const vertical = panel.querySelector('[data-map-salt-vertical]');
  if (spacing) spacing.disabled = method !== 'spacing';
  if (vertical) vertical.disabled = method !== 'vertical';
}

function setAbearcSaltSource(source) {
  rememberAbearcMapLayoutChange();
  if (!ABEARC_MAP_ELEVATION_SOURCES.has(source)) return;
  abearcMapSaltSource = source;
  const panel = document.getElementById('abearcMapSaltPanel');
  if (panel && !panel.classList.contains('hidden')) generateAbearcSaltLayout();
}

function abearcSaltPlanarPoint(point, originLat) {
  const radians = originLat * Math.PI / 180;
  return {
    x: Number(point[0]) * 111320 * Math.cos(radians),
    y: Number(point[1]) * 110574
  };
}

function abearcSaltPointSegmentDistanceM(point, start, end) {
  const originLat = Number(point[1]);
  const p = abearcSaltPlanarPoint(point, originLat);
  const a = abearcSaltPlanarPoint(start, originLat);
  const b = abearcSaltPlanarPoint(end, originLat);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const ratio = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + dx * ratio), p.y - (a.y + dy * ratio));
}

function abearcSaltBoundaryDistanceM(point, polygon) {
  let minimum = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    minimum = Math.min(minimum, abearcSaltPointSegmentDistanceM(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return minimum;
}

function abearcSaltCellSlope(surface, row, column) {
  const { grid, columns } = surface;
  const topLeft = grid[row * columns + column];
  const topRight = grid[row * columns + column + 1];
  const bottomRight = grid[(row + 1) * columns + column + 1];
  const bottomLeft = grid[(row + 1) * columns + column];
  const xDistance = Math.max(0.1, (haversineMetres([topLeft.longitude, topLeft.latitude], [topRight.longitude, topRight.latitude])
    + haversineMetres([bottomLeft.longitude, bottomLeft.latitude], [bottomRight.longitude, bottomRight.latitude])) / 2);
  const yDistance = Math.max(0.1, (haversineMetres([topLeft.longitude, topLeft.latitude], [bottomLeft.longitude, bottomLeft.latitude])
    + haversineMetres([topRight.longitude, topRight.latitude], [bottomRight.longitude, bottomRight.latitude])) / 2);
  const dzdx = (((topRight.elevation + bottomRight.elevation) / 2) - ((topLeft.elevation + bottomLeft.elevation) / 2)) / xDistance;
  const dzdy = (((bottomLeft.elevation + bottomRight.elevation) / 2) - ((topLeft.elevation + topRight.elevation) / 2)) / yDistance;
  return Math.hypot(dzdx, dzdy) * 100;
}

function analyzeAbearcSaltSurface(surface, settings) {
  const slopes = [];
  let slopeSuitableCells = 0;
  let layoutSuitableCells = 0;
  for (let row = 0; row < surface.rows - 1; row++) {
    for (let column = 0; column < surface.columns - 1; column++) {
      const topLeft = surface.grid[row * surface.columns + column];
      const topRight = surface.grid[row * surface.columns + column + 1];
      const bottomRight = surface.grid[(row + 1) * surface.columns + column + 1];
      const bottomLeft = surface.grid[(row + 1) * surface.columns + column];
      const center = [
        (topLeft.longitude + topRight.longitude + bottomRight.longitude + bottomLeft.longitude) / 4,
        (topLeft.latitude + topRight.latitude + bottomRight.latitude + bottomLeft.latitude) / 4
      ];
      if (!abearcLngLatPointInPolygon(center, surface.polygon)) continue;
      const slope = abearcSaltCellSlope(surface, row, column);
      slopes.push(slope);
      const slopeSuitable = slope >= settings.minSlopePct && slope <= settings.maxSlopePct;
      if (slopeSuitable) slopeSuitableCells++;
      if (slopeSuitable && (!settings.boundarySetbackM || abearcSaltBoundaryDistanceM(center, surface.polygon) >= settings.boundarySetbackM)) layoutSuitableCells++;
    }
  }
  return { slopes, slopeSuitableCells, layoutSuitableCells, interiorCells: slopes.length };
}

function abearcSaltAddClippedSegment(segments, level, startPoint, endPoint, polygon, setbackM) {
  const deltaX = endPoint[0] - startPoint[0];
  const deltaY = endPoint[1] - startPoint[1];
  const cuts = [0, 1];
  polygon.forEach((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const edgeX = end[0] - start[0];
    const edgeY = end[1] - start[1];
    const denominator = deltaX * edgeY - deltaY * edgeX;
    if (Math.abs(denominator) < 1e-12) return;
    const offsetX = start[0] - startPoint[0];
    const offsetY = start[1] - startPoint[1];
    const distance = (offsetX * edgeY - offsetY * edgeX) / denominator;
    const edgeDistance = (offsetX * deltaY - offsetY * deltaX) / denominator;
    if (distance > 0 && distance < 1 && edgeDistance >= 0 && edgeDistance <= 1) cuts.push(distance);
  });
  cuts.sort((a, b) => a - b);
  for (let index = 1; index < cuts.length; index++) {
    const start = cuts[index - 1];
    const end = cuts[index];
    const middle = (start + end) / 2;
    const midpoint = [startPoint[0] + deltaX * middle, startPoint[1] + deltaY * middle];
    if (!abearcLngLatPointInPolygon(midpoint, polygon)) continue;
    if (setbackM > 0 && abearcSaltBoundaryDistanceM(midpoint, polygon) < setbackM) continue;
    segments.push({
      level,
      index: false,
      points: [
        [startPoint[0] + deltaX * start, startPoint[1] + deltaY * start],
        [startPoint[0] + deltaX * end, startPoint[1] + deltaY * end]
      ]
    });
  }
}

function buildAbearcSaltSurface(surface, interval, settings) {
  const elevations = abearcMapAnalysis.interiorElevations(surface.grid, surface.polygon);
  if (elevations.length < 2) return { paths: [], segments: [] };
  const minimum = Math.min(...elevations);
  const maximum = Math.max(...elevations);
  const crossing = (a, b, level) => {
    if ((a.elevation < level) === (b.elevation < level)) return null;
    const ratio = (level - a.elevation) / (b.elevation - a.elevation);
    return [a.longitude + (b.longitude - a.longitude) * ratio, a.latitude + (b.latitude - a.latitude) * ratio];
  };
  const cells = [];
  for (let row = 0; row < surface.rows - 1; row++) {
    for (let column = 0; column < surface.columns - 1; column++) {
      const topLeft = surface.grid[row * surface.columns + column];
      const topRight = surface.grid[row * surface.columns + column + 1];
      const bottomRight = surface.grid[(row + 1) * surface.columns + column + 1];
      const bottomLeft = surface.grid[(row + 1) * surface.columns + column];
      const centerPoint = [
        (topLeft.longitude + topRight.longitude + bottomRight.longitude + bottomLeft.longitude) / 4,
        (topLeft.latitude + topRight.latitude + bottomRight.latitude + bottomLeft.latitude) / 4
      ];
      if (!abearcLngLatPointInPolygon(centerPoint, surface.polygon)) continue;
      const slope = abearcSaltCellSlope(surface, row, column);
      if (slope < settings.minSlopePct || slope > settings.maxSlopePct) continue;
      if (settings.boundarySetbackM > 0 && abearcSaltBoundaryDistanceM(centerPoint, surface.polygon) < settings.boundarySetbackM) continue;
      cells.push({ topLeft, topRight, bottomRight, bottomLeft });
    }
  }
  const segments = [];
  for (let rawLevel = Math.ceil(minimum / interval) * interval; rawLevel < maximum; rawLevel += interval) {
    const level = Number(rawLevel.toFixed(6));
    cells.forEach(cell => {
      const { topLeft, topRight, bottomRight, bottomLeft } = cell;
      const edges = [
        crossing(topLeft, topRight, level),
        crossing(topRight, bottomRight, level),
        crossing(bottomRight, bottomLeft, level),
        crossing(bottomLeft, topLeft, level)
      ];
      const hits = edges.map((point, edge) => point && { point, edge }).filter(Boolean);
      if (hits.length === 2) abearcSaltAddClippedSegment(segments, level, hits[0].point, hits[1].point, surface.polygon, settings.boundarySetbackM);
      if (hits.length === 4) {
        const center = (topLeft.elevation + topRight.elevation + bottomRight.elevation + bottomLeft.elevation) / 4;
        const pairs = center >= level ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        pairs.forEach(([a, b]) => abearcSaltAddClippedSegment(segments, level, edges[a], edges[b], surface.polygon, settings.boundarySetbackM));
      }
    });
  }
  const paths = stitchAbearcContourSegments(segments)
    .map(path => ({ ...path, lengthM: abearcMeasurePathDistance(path.points) }))
    .filter(path => path.lengthM >= settings.minRowLengthM);
  return { minimum, maximum, segments, paths };
}

function abearcSaltApplicability(percent) {
  if (!(percent > 0)) return { key: 'outside', label: 'Outside configured slope screen' };
  if (percent >= 80) return { key: 'suitable', label: 'Suitable by configured slope screen' };
  return { key: 'partial', label: 'Partially suitable by configured slope screen' };
}

async function loadAbearcSaltSurfaces(polygons, signal, requestId) {
  const sourceResolutionM = ABEARC_MAP_ELEVATION_RESOLUTION_M[abearcMapSaltSource];
  const plan = abearcMapAnalysis.planContourGrids(polygons, sourceResolutionM, {
    maxPolygons: 12,
    maxSamples: ABEARC_MAP_CONTOUR_SAMPLE_BUDGET[abearcMapSaltSource] || 800
  });
  const surfaces = [];
  let effectiveSource = abearcMapSaltSource;
  let sourceLabel = abearcSaltSourceLabel(effectiveSource);
  const body = document.querySelector('#abearcMapSaltPanel [data-map-salt-results]');
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
    const polygon = polygons[polygonIndex];
    const gridPlan = plan.plans[polygonIndex];
    if (body) body.innerHTML = `<div class="abearc-map-salt-loading"><span></span>Analyzing polygon ${polygonIndex + 1} of ${polygons.length} · ${gridPlan.samples.toLocaleString()} terrain samples...</div>`;
    const locations = [];
    for (let row = 0; row < gridPlan.rows; row++) {
      for (let column = 0; column < gridPlan.columns; column++) {
        locations.push({
          latitude: gridPlan.north - (gridPlan.north - gridPlan.south) * row / (gridPlan.rows - 1),
          longitude: gridPlan.west + (gridPlan.east - gridPlan.west) * column / (gridPlan.columns - 1)
        });
      }
    }
    const result = await requestAbearcElevationBatches(locations, signal, effectiveSource, false);
    if (requestId !== abearcMapSaltRequestId) throw Object.assign(new Error('SALT generation cancelled.'), { name: 'AbortError' });
    if (result.elevations.length !== locations.length || result.elevations.some(value => !Number.isFinite(value))) throw new Error('Elevation data is incomplete.');
    effectiveSource = result.sourceKey;
    sourceLabel = result.sourceLabel || sourceLabel;
    surfaces.push({
      polygon,
      columns: gridPlan.columns,
      rows: gridPlan.rows,
      effectiveSpacingM: gridPlan.effectiveSpacingM,
      sourceResolutionM,
      grid: locations.map((location, index) => ({ ...location, elevation: Number(result.elevations[index]) }))
    });
  }
  return { surfaces, effectiveSource, sourceLabel, effectiveSpacingM: plan.effectiveSpacingM, sampleCount: plan.totalSamples };
}

function renderAbearcSaltPanel() {
  const panel = document.getElementById('abearcMapSaltPanel');
  const body = panel?.querySelector('[data-map-salt-results]');
  if (!panel || !body || !abearcMapSaltData) return;
  syncAbearcSaltControls();
  const data = abearcMapSaltData;
  const status = abearcSaltApplicability(data.suitablePercent);
  const warnings = [];
  if (data.effectiveSpacingM > Math.max(10, data.estimatedHorizontalSpacingM * 2)) warnings.push(`DEM grid is about ${Math.round(data.effectiveSpacingM)} m, coarser than the proposed row spacing; field verification is essential.`);
  if (data.intervalAdjusted) warnings.push(`Vertical interval was adjusted to ${data.intervalM.toFixed(2)} m to keep the generated layout within the map processing limit.`);
  if (!data.paths.length && data.suitablePercent > 0) warnings.push('No proposed row met the current minimum row length or contour interval. Adjust the design settings and regenerate.');
  body.innerHTML = `
    <div class="abearc-map-salt-status is-${status.key}"><strong>${abearcSaltEscape(status.label)}</strong><span>${data.suitablePercent.toFixed(1)}% of sampled terrain is within the configured slope range.</span></div>
    <div class="abearc-map-salt-metrics">
      <span><small>Area</small><strong>${data.areaHa.toFixed(2)} ha</strong></span>
      <span><small>Mean slope</small><strong>${data.meanSlopePct.toFixed(1)}%</strong></span>
      <span><small>Elevation</small><strong>${Math.round(data.minimum)}–${Math.round(data.maximum)} m</strong></span>
      <span><small>Rows</small><strong>${data.paths.length}</strong></span>
      <span><small>Total row length</small><strong>${data.totalLengthM >= 1000 ? `${(data.totalLengthM / 1000).toFixed(2)} km` : `${Math.round(data.totalLengthM)} m`}</strong></span>
      <span><small>Design spacing</small><strong>${data.estimatedHorizontalSpacingM.toFixed(1)} m</strong></span>
    </div>
    <div class="abearc-map-salt-summary">
      <span><b>Vertical interval</b>${data.intervalM.toFixed(2)} m</span>
      <span><b>Slope range</b>${data.settings.minSlopePct.toFixed(1)}–${data.settings.maxSlopePct.toFixed(1)}%</span>
      <span><b>Terrain source</b>${abearcSaltEscape(data.sourceLabel)}</span>
      <span><b>Sampling grid</b>${data.effectiveSpacingM < 10 ? data.effectiveSpacingM.toFixed(1) : Math.round(data.effectiveSpacingM)} m</span>
    </div>
    ${warnings.length ? `<div class="abearc-map-salt-warning">${warnings.map(warning => `<span>${abearcSaltEscape(warning)}</span>`).join('')}</div>` : ''}
    <div class="abearc-map-salt-note">Planning screen only. Confirm contour alignment, slope, drainage, obstacles and hedgerow placement in the field before implementation.</div>`;
  panel.dataset.state = 'ready';
}

async function generateAbearcSaltLayout() {
  const polygons = abearcSaltPolygons();
  if (!polygons.length) return toast('Complete an area measurement or select an imported polygon first.', 'error');
  let settings;
  try { settings = readAbearcSaltSettings(); }
  catch (error) { return toast(error.message, 'error'); }
  const historyEntry = rememberAbearcMapLayoutChange();
  abearcMapSaltSettings = { ...settings };
  const key = abearcSaltSelectionKey(polygons);
  abearcMapSaltAbort?.abort();
  abearcMapSaltAbort = new AbortController();
  const requestId = ++abearcMapSaltRequestId;
  const panel = document.getElementById('abearcMapSaltPanel');
  const body = panel?.querySelector('[data-map-salt-results]');
  if (!panel || !body) return;
  panel.classList.remove('hidden');
  panel.dataset.state = 'loading';
  body.innerHTML = '<div class="abearc-map-salt-loading"><span></span>Analyzing terrain and generating SALT rows...</div>';
  try {
    const loaded = await loadAbearcSaltSurfaces(polygons, abearcMapSaltAbort.signal, requestId);
    if (requestId !== abearcMapSaltRequestId || key !== abearcSaltSelectionKey()) return;
    if (abearcMapViewUndoStack.at(-1) !== historyEntry) rememberAbearcMapLayoutChange();
    abearcMapSaltSource = loaded.effectiveSource;
    const analyses = loaded.surfaces.map(surface => analyzeAbearcSaltSurface(surface, settings));
    const allSlopes = analyses.flatMap(item => item.slopes);
    if (!allSlopes.length) throw new Error('The selected polygon contains too few terrain samples for SALT analysis.');
    const meanSlopePct = allSlopes.reduce((sum, value) => sum + value, 0) / allSlopes.length;
    const minimumSlopePct = Math.min(...allSlopes);
    const maximumSlopePct = Math.max(...allSlopes);
    const elevations = loaded.surfaces.flatMap(surface => abearcMapAnalysis.interiorElevations(surface.grid, surface.polygon));
    const minimum = Math.min(...elevations);
    const maximum = Math.max(...elevations);
    const relief = Math.max(0, maximum - minimum);
    const requestedInterval = settings.method === 'vertical'
      ? settings.verticalIntervalM
      : Math.max(0.25, settings.targetSpacingM * Math.max(meanSlopePct, 0.1) / 100);
    const processingMinimum = Math.max(0.25, relief / 200);
    const intervalM = Math.max(requestedInterval, processingMinimum);
    const intervalAdjusted = intervalM > requestedInterval + 1e-9;
    const estimatedHorizontalSpacingM = meanSlopePct > 0.05 ? intervalM * 100 / meanSlopePct : settings.targetSpacingM;
    const built = loaded.surfaces.map(surface => buildAbearcSaltSurface(surface, intervalM, settings));
    const rawPaths = built.flatMap((surface, surfaceIndex) => surface.paths.map(path => ({ ...path, surfaceIndex })));
    rawPaths.sort((a, b) => b.level - a.level || b.lengthM - a.lengthM);
    const paths = rawPaths.map((path, index) => ({
      ...path,
      rowId: `SALT-${String(index + 1).padStart(2, '0')}`,
      lengthM: abearcSaltRound(path.lengthM, 2)
    }));
    const interiorCells = analyses.reduce((sum, item) => sum + item.interiorCells, 0);
    const suitableCells = analyses.reduce((sum, item) => sum + item.slopeSuitableCells, 0);
    const layoutSuitableCells = analyses.reduce((sum, item) => sum + item.layoutSuitableCells, 0);
    const areaM2 = polygons.reduce((sum, polygon) => sum + abearcPolygonArea(polygon), 0);
    abearcMapSaltData = {
      key,
      source: loaded.effectiveSource,
      sourceLabel: loaded.sourceLabel,
      settings: { ...settings },
      intervalM,
      intervalAdjusted,
      estimatedHorizontalSpacingM,
      minimum,
      maximum,
      meanSlopePct,
      minimumSlopePct,
      maximumSlopePct,
      suitablePercent: interiorCells ? suitableCells / interiorCells * 100 : 0,
      layoutCoveragePercent: interiorCells ? layoutSuitableCells / interiorCells * 100 : 0,
      areaHa: areaM2 / 10000,
      sampleCount: loaded.sampleCount,
      effectiveSpacingM: loaded.effectiveSpacingM,
      paths,
      totalLengthM: paths.reduce((sum, path) => sum + path.lengthM, 0)
    };
    renderAbearcSaltPanel();
    renderAbearcMapMeasure();
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== abearcMapSaltRequestId) return;
    abearcMapSaltData = null;
    panel.dataset.state = 'error';
    body.innerHTML = `<div class="abearc-map-elevation-error"><strong>SALT layout unavailable</strong><span>${abearcSaltEscape(error.message || 'Try generating the SALT layout again.')}</span></div>`;
    renderAbearcMapMeasure();
  } finally {
    if (requestId === abearcMapSaltRequestId) abearcMapSaltAbort = null;
  }
}

function showAbearcSaltLayout(force = false) {
  closeAbearcMapMeasureContextMenu();
  const polygons = abearcSaltPolygons();
  if (!polygons.length) return toast('Complete an area measurement or select an imported polygon first.', 'error');
  const key = abearcSaltSelectionKey(polygons);
  if (!force && abearcMapSaltData?.key === key) return closeAbearcSaltLayout();
  closeAbearcElevationProfile();
  const panel = document.getElementById('abearcMapSaltPanel');
  if (!panel) return;
  setupAbearcFloatingMapPanelDrag('abearcMapSaltPanel', '[data-map-salt-drag-handle]');
  syncAbearcSaltControls();
  panel.classList.remove('hidden');
  return generateAbearcSaltLayout();
}

function closeAbearcSaltLayout(redraw = true) {
  if (redraw && abearcMapSaltData) rememberAbearcMapLayoutChange();
  abearcMapSaltAbort?.abort();
  abearcMapSaltAbort = null;
  abearcMapSaltRequestId++;
  abearcMapSaltData = null;
  document.getElementById('abearcMapSaltPanel')?.classList.add('hidden');
  if (redraw) renderAbearcMapMeasure();
}


function isAbearcSaltLayoutCurrent() {
  return Boolean(abearcMapSaltData?.key && abearcMapSaltData.key === abearcSaltSelectionKey());
}

function syncAbearcSaltSelection() {
  if (!abearcMapSaltData) return;
  if (!abearcSaltPolygons().length || abearcMapSaltData.key !== abearcSaltSelectionKey()) closeAbearcSaltLayout(false);
}

function abearcSaltPathMidpoint(points) {
  const lengths = points.slice(1).map((point, index) => haversineMetres(points[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0] || null;
  const target = total / 2;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index++) {
    if (travelled + lengths[index] >= target) {
      const ratio = (target - travelled) / (lengths[index] || 1);
      return [
        points[index][0] + (points[index + 1][0] - points[index][0]) * ratio,
        points[index][1] + (points[index + 1][1] - points[index][1]) * ratio
      ];
    }
    travelled += lengths[index];
  }
  return points[points.length - 1] || null;
}

function renderAbearcSaltLayout(svg) {
  if (!abearcMapSaltData?.paths?.length || !abearcMap) return;
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `abearc-map-salt-layout${abearcMapBasemap === 'google-satellite' ? ' is-satellite' : ' is-light-basemap'}`);
  abearcMapSaltData.paths.forEach(pathData => {
    const points = pathData.points.map(point => abearcMap.project(point));
    if (points.length < 2) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
    path.setAttribute('class', 'abearc-map-salt-row');
    path.setAttribute('data-salt-row-id', pathData.rowId || '');
    group.appendChild(path);
    if (abearcMapSaltData.settings?.showLabels === false) return;
    const midpointLngLat = abearcSaltPathMidpoint(pathData.points);
    if (!midpointLngLat || pathData.lengthM < 12) return;
    const midpoint = abearcMap.project(midpointLngLat);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midpoint.x.toFixed(1));
    label.setAttribute('y', midpoint.y.toFixed(1));
    label.setAttribute('class', 'abearc-map-salt-label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.textContent = pathData.rowId;
    group.appendChild(label);
  });
  svg.appendChild(group);
}

async function exportAbearcSaltKml(confirmExport = true) {
  const data = abearcMapSaltData;
  if (!data?.paths?.length) return toast('Generate a SALT layout first.', 'error');
  if (confirmExport) {
    const confirmed = await confirmModalChoice(`Export ${data.paths.length} proposed SALT contour row${data.paths.length === 1 ? '' : 's'} as KML?`, {
      title: 'Export SALT Layout', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium'
    });
    if (!confirmed) return;
  }
  const placemarks = data.paths.map(path => {
    const coordinates = path.points.map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},${Number(path.level).toFixed(3)}`).join(' ');
    return `<Placemark><name>${abearcSaltEscape(path.rowId)}</name><styleUrl>#saltRow</styleUrl><ExtendedData><Data name="elevation_m"><value>${Number(path.level).toFixed(3)}</value></Data><Data name="length_m"><value>${Number(path.lengthM).toFixed(2)}</value></Data><Data name="vertical_interval_m"><value>${Number(data.intervalM).toFixed(3)}</value></Data><Data name="mean_slope_pct"><value>${Number(data.meanSlopePct).toFixed(2)}</value></Data></ExtendedData><LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${coordinates}</coordinates></LineString></Placemark>`;
  }).join('');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ABEARC SALT contour farming layout</name><Style id="saltRow"><LineStyle><color>ff4ade80</color><width>3</width></LineStyle></Style>${placemarks}</Document></kml>`;
  downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `ABEARC-SALT-layout-${new Date().toISOString().slice(0, 10)}.kml`);
}

async function exportAbearcSaltGeoJson() {
  const data = abearcMapSaltData;
  if (!data?.paths?.length) return toast('Generate a SALT layout first.', 'error');
  const confirmed = await confirmModalChoice(`Export ${data.paths.length} proposed SALT contour row${data.paths.length === 1 ? '' : 's'} as GeoJSON?`, {
    title: 'Export SALT Layout', confirmText: 'Export GeoJSON', confirmClass: 'px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium'
  });
  if (!confirmed) return;
  const polygons = abearcSaltPolygons();
  const features = [
    ...polygons.map((polygon, index) => ({
      type: 'Feature',
      properties: { feature_type: 'selected_area', polygon_index: index + 1 },
      geometry: { type: 'Polygon', coordinates: [[...polygon, polygon[0]]] }
    })),
    ...data.paths.map(path => ({
      type: 'Feature',
      properties: {
        feature_type: 'salt_contour_row',
        row_id: path.rowId,
        elevation_m: path.level,
        length_m: path.lengthM,
        vertical_interval_m: data.intervalM,
        mean_slope_pct: data.meanSlopePct,
        slope_min_pct: data.settings.minSlopePct,
        slope_max_pct: data.settings.maxSlopePct
      },
      geometry: { type: 'LineString', coordinates: path.points.map(point => [Number(point[0]), Number(point[1])]) }
    }))
  ];
  const geojson = { type: 'FeatureCollection', name: 'ABEARC SALT contour farming layout', features };
  downloadBlob(new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8' }), `ABEARC-SALT-layout-${new Date().toISOString().slice(0, 10)}.geojson`);
}

function captureAbearcSaltLayoutState() {
  if (!abearcMapSaltData?.paths?.length) return null;
  return {
    source: abearcMapSaltSource,
    sourceLabel: String(abearcMapSaltData.sourceLabel || '').slice(0, 160),
    settings: { ...abearcMapSaltSettings },
    intervalM: Number(abearcMapSaltData.intervalM) || null,
    estimatedHorizontalSpacingM: Number(abearcMapSaltData.estimatedHorizontalSpacingM) || null,
    minimum: Number(abearcMapSaltData.minimum) || 0,
    maximum: Number(abearcMapSaltData.maximum) || 0,
    meanSlopePct: Number(abearcMapSaltData.meanSlopePct) || 0,
    minimumSlopePct: Number(abearcMapSaltData.minimumSlopePct) || 0,
    maximumSlopePct: Number(abearcMapSaltData.maximumSlopePct) || 0,
    suitablePercent: Number(abearcMapSaltData.suitablePercent) || 0,
    layoutCoveragePercent: Number(abearcMapSaltData.layoutCoveragePercent) || 0,
    areaHa: Number(abearcMapSaltData.areaHa) || 0,
    sampleCount: Number(abearcMapSaltData.sampleCount) || 0,
    effectiveSpacingM: Number(abearcMapSaltData.effectiveSpacingM) || 0,
    totalLengthM: Number(abearcMapSaltData.totalLengthM) || 0,
    paths: abearcMapSaltData.paths.slice(0, 10000).map(path => ({
      rowId: String(path.rowId || '').slice(0, 40),
      level: Number(path.level) || 0,
      lengthM: Number(path.lengthM) || 0,
      points: path.points.slice(0, 5000).map(point => [abearcSaltRound(point[0], 8), abearcSaltRound(point[1], 8)])
    }))
  };
}

function restoreAbearcSaltLayoutState(state) {
  if (!state || !Array.isArray(state.paths) || !state.paths.length) {
    abearcMapSaltData = null;
    return;
  }
  const paths = state.paths.slice(0, 10000).map((path, index) => ({
    rowId: String(path?.rowId || `SALT-${String(index + 1).padStart(2, '0')}`).slice(0, 40),
    level: Number(path?.level) || 0,
    lengthM: Number(path?.lengthM) || 0,
    points: (Array.isArray(path?.points) ? path.points : []).slice(0, 5000)
      .filter(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map(point => [Number(point[0]), Number(point[1])])
  })).filter(path => path.points.length > 1);
  if (!paths.length) {
    abearcMapSaltData = null;
    return;
  }
  if (ABEARC_MAP_ELEVATION_SOURCES.has(state.source)) abearcMapSaltSource = state.source;
  abearcMapSaltSettings = { ...abearcMapSaltSettings, ...(state.settings || {}) };
  abearcMapSaltData = {
    key: abearcSaltSelectionKey(),
    source: abearcMapSaltSource,
    sourceLabel: String(state.sourceLabel || abearcSaltSourceLabel(abearcMapSaltSource)),
    settings: { ...abearcMapSaltSettings },
    intervalM: Number(state.intervalM) || 1,
    estimatedHorizontalSpacingM: Number(state.estimatedHorizontalSpacingM) || abearcMapSaltSettings.targetSpacingM,
    minimum: Number(state.minimum) || 0,
    maximum: Number(state.maximum) || 0,
    meanSlopePct: Number(state.meanSlopePct) || 0,
    minimumSlopePct: Number(state.minimumSlopePct) || 0,
    maximumSlopePct: Number(state.maximumSlopePct) || 0,
    suitablePercent: Number(state.suitablePercent) || 0,
    layoutCoveragePercent: Number(state.layoutCoveragePercent) || 0,
    areaHa: Number(state.areaHa) || 0,
    sampleCount: Number(state.sampleCount) || 0,
    effectiveSpacingM: Number(state.effectiveSpacingM) || 0,
    totalLengthM: Number(state.totalLengthM) || paths.reduce((sum, path) => sum + path.lengthM, 0),
    intervalAdjusted: false,
    paths
  };
  document.getElementById('abearcMapSaltPanel')?.classList.add('hidden');
  renderAbearcMapMeasure();
}

Object.assign(window, {
  cancelAbearcSaltRequest: () => { abearcMapSaltAbort?.abort(); abearcMapSaltRequestId++; },
  showAbearcSaltLayout,
  closeAbearcSaltLayout,
  generateAbearcSaltLayout,
  setAbearcSaltSource,
  syncAbearcSaltMethodFields,
  exportAbearcSaltKml,
  exportAbearcSaltGeoJson,
  renderAbearcSaltLayout,
  syncAbearcSaltSelection,
  isAbearcSaltLayoutCurrent,
  captureAbearcSaltLayoutState,
  restoreAbearcSaltLayoutState
});
