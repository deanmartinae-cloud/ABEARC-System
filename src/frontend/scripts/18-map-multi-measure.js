/* ABEARC Map Multi-Measurement Manager
 * Keeps the legacy selected-measurement globals as the active editing adapter,
 * while preserving unlimited completed measurements as independent map objects.
 */

let abearcMapMeasurements = [];
let abearcMapActiveMeasurementId = null;
let abearcMapActiveMeasurementName = '';
let abearcMapMeasurementSequence = 0;

function resetAbearcMultiMeasurementCollection() {
  abearcMapMeasurements = [];
  abearcMapActiveMeasurementId = null;
  abearcMapActiveMeasurementName = '';
  abearcMapMeasurementSequence = 0;
}

function abearcMultiMeasureClone(value) {
  if (value === null || value === undefined) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function abearcMultiMeasureId() {
  abearcMapMeasurementSequence += 1;
  return `measure-${Date.now().toString(36)}-${abearcMapMeasurementSequence.toString(36)}`;
}

function abearcMultiMeasurementIsValid(mode = abearcMapMeasureMode, points = abearcMapMeasurePoints, importedPolygons = abearcMapImportedPolygons) {
  if (Array.isArray(importedPolygons) && importedPolygons.length) return importedPolygons.some(polygon => Array.isArray(polygon?.points) && polygon.points.length >= 3);
  if (mode === 'area') return Array.isArray(points) && points.length >= 3;
  if (mode === 'distance') return Array.isArray(points) && points.length >= 2;
  return false;
}

function abearcMultiMeasurementKind(record) {
  if (record?.importedPolygons?.length) return 'area';
  return record?.mode === 'area' ? 'area' : 'distance';
}

function abearcMultiMeasurementDefaultName(mode) {
  const kind = mode === 'area' ? 'Area' : 'Distance';
  const all = [...abearcMapMeasurements];
  if (abearcMultiMeasurementIsValid()) all.push({ mode: abearcMapMeasureMode, importedPolygons: abearcMapImportedPolygons });
  const count = all.filter(record => abearcMultiMeasurementKind(record) === mode).length + 1;
  return `${kind} ${count}`;
}

function abearcMultiCaptureAnalysis() {
  if (typeof captureAbearcMapLayoutAnalysisState !== 'function') return null;
  return abearcMultiMeasureClone(captureAbearcMapLayoutAnalysisState());
}

function abearcMultiClearAnalysis() {
  try { abearcMapContourAbort?.abort(); } catch (_) {}
  try { abearcMapContourData = null; } catch (_) {}
  try { window.restoreAbearcSaltLayoutState?.(null); } catch (_) {}
  document.getElementById('abearcMapContourPanel')?.classList.add('hidden');
  document.getElementById('abearcMapSaltPanel')?.classList.add('hidden');
  closeAbearcElevationProfile?.();
}

function abearcMultiCaptureCurrentRecord({ includeAnalysis = true, allowInvalid = false } = {}) {
  const valid = abearcMultiMeasurementIsValid();
  if (!allowInvalid && !valid) return null;
  if (!valid && !['distance', 'area'].includes(abearcMapMeasureMode) && !abearcMapMeasurePoints.length && !abearcMapImportedPolygons.length) return null;
  if (!abearcMapActiveMeasurementId) abearcMapActiveMeasurementId = abearcMultiMeasureId();
  if (!abearcMapActiveMeasurementName) abearcMapActiveMeasurementName = abearcMultiMeasurementDefaultName(abearcMapMeasureMode);
  return {
    id: String(abearcMapActiveMeasurementId),
    name: String(abearcMapActiveMeasurementName || '').slice(0, 120),
    mode: ['distance', 'area'].includes(abearcMapMeasureMode) ? abearcMapMeasureMode : 'off',
    points: (Array.isArray(abearcMapMeasurePoints) ? abearcMapMeasurePoints : []).map(point => [Number(point[0]), Number(point[1])]),
    importedPolygons: (Array.isArray(abearcMapImportedPolygons) ? abearcMapImportedPolygons : []).map((polygon, index) => ({
      name: String(polygon?.name || `Polygon ${index + 1}`).slice(0, 120),
      points: (Array.isArray(polygon?.points) ? polygon.points : []).map(point => [Number(point[0]), Number(point[1])])
    })),
    selectedImportedPolygons: [...(abearcMapSelectedImportedPolygons || [])],
    hiddenPoints: [...(abearcMapHiddenMeasurePointIndexes || [])],
    annotations: [...(abearcMapElevationAnnotations || new Map())].map(([index, annotation]) => [Number(index), { ...annotation }]),
    lastTouchedPoint: Number.isInteger(abearcMapLastTouchedMeasureIndex) ? abearcMapLastTouchedMeasureIndex : null,
    editingImportedPolygonIndex: Number.isInteger(abearcMapEditingImportedPolygonIndex) ? abearcMapEditingImportedPolygonIndex : null,
    visible: true,
    analysis: includeAnalysis ? abearcMultiCaptureAnalysis() : null,
    gravityPath: window.captureAbearcGravityPathState?.() || null
  };
}

function abearcMultiSanitizePoint(point) {
  if (!Array.isArray(point) || point.length < 2) return null;
  const longitude = Number(point[0]);
  const latitude = Number(point[1]);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  return [longitude, latitude];
}

function abearcMultiSanitizeRecord(record, index = 0) {
  if (!record || typeof record !== 'object') return null;
  const mode = ['distance', 'area'].includes(record.mode) ? record.mode : 'off';
  const points = (Array.isArray(record.points) ? record.points : []).slice(0, 5000).map(abearcMultiSanitizePoint).filter(Boolean);
  const importedPolygons = (Array.isArray(record.importedPolygons) ? record.importedPolygons : []).slice(0, 1000).map((polygon, polygonIndex) => ({
    name: String(polygon?.name || `Polygon ${polygonIndex + 1}`).slice(0, 120),
    points: (Array.isArray(polygon?.points) ? polygon.points : []).slice(0, 5000).map(abearcMultiSanitizePoint).filter(Boolean)
  })).filter(polygon => polygon.points.length >= 3);
  const inferredMode = importedPolygons.length ? 'area' : mode;
  const valid = importedPolygons.length || (inferredMode === 'area' ? points.length >= 3 : inferredMode === 'distance' ? points.length >= 2 : false);
  if (!valid) return null;
  const hiddenPoints = (Array.isArray(record.hiddenPoints) ? record.hiddenPoints : []).map(Number).filter(value => Number.isInteger(value) && value >= 0 && value < points.length);
  const annotations = (Array.isArray(record.annotations) ? record.annotations : []).map(entry => [Number(entry?.[0]), entry?.[1]])
    .filter(([pointIndex, annotation]) => Number.isInteger(pointIndex) && pointIndex >= 0 && pointIndex < points.length && annotation && typeof annotation === 'object')
    .map(([pointIndex, annotation]) => [pointIndex, {
      text: String(annotation.text || '').slice(0, 80),
      dx: Number.isFinite(Number(annotation.dx)) ? Number(annotation.dx) : 22,
      dy: Number.isFinite(Number(annotation.dy)) ? Number(annotation.dy) : -22,
      mapDx: Number.isFinite(Number(annotation.mapDx)) ? Number(annotation.mapDx) : 22,
      mapDy: Number.isFinite(Number(annotation.mapDy)) ? Number(annotation.mapDy) : -22
    }]).filter(([, annotation]) => annotation.text);
  return {
    id: String(record.id || `measure-restored-${index + 1}`).slice(0, 120),
    name: String(record.name || `${inferredMode === 'area' ? 'Area' : 'Distance'} ${index + 1}`).slice(0, 120),
    mode: inferredMode,
    points,
    importedPolygons,
    selectedImportedPolygons: (Array.isArray(record.selectedImportedPolygons) ? record.selectedImportedPolygons : []).map(Number)
      .filter(value => Number.isInteger(value) && value >= 0 && value < importedPolygons.length),
    hiddenPoints,
    annotations,
    lastTouchedPoint: Number.isInteger(Number(record.lastTouchedPoint)) ? Number(record.lastTouchedPoint) : (points.length ? points.length - 1 : null),
    editingImportedPolygonIndex: null,
    visible: record.visible !== false,
    analysis: record.analysis && typeof record.analysis === 'object' ? abearcMultiMeasureClone(record.analysis) : null,
    gravityPath: record.gravityPath && typeof record.gravityPath === 'object' ? abearcMultiMeasureClone(record.gravityPath) : null
  };
}

function abearcMultiApplyCurrentRecord(record) {
  const sanitized = abearcMultiSanitizeRecord(record);
  if (!sanitized) return false;
  abearcMapActiveMeasurementId = sanitized.id;
  abearcMapActiveMeasurementName = sanitized.name;
  abearcMapMeasureMode = sanitized.mode;
  abearcMapImportedPolygons = sanitized.importedPolygons.map(polygon => ({ name: polygon.name, points: polygon.points.map(point => [...point]) }));
  abearcMapMeasurePoints = abearcMapImportedPolygons.length
    ? (abearcMapImportedPolygons[Math.max(0, Math.min(abearcMapImportedPolygons.length - 1, sanitized.selectedImportedPolygons[0] ?? 0))]?.points || [])
    : sanitized.points.map(point => [...point]);
  abearcMapSelectedImportedPolygons = new Set(sanitized.selectedImportedPolygons);
  if (abearcMapImportedPolygons.length && !abearcMapSelectedImportedPolygons.size) abearcMapSelectedImportedPolygons.add(0);
  abearcMapImportedPolygonContextIndex = null;
  abearcMapEditingImportedPolygonIndex = null;
  abearcMapHiddenMeasurePointIndexes = new Set(sanitized.hiddenPoints);
  abearcMapElevationAnnotations = new Map(sanitized.annotations.map(([index, annotation]) => [index, { ...annotation }]));
  abearcMapLastTouchedMeasureIndex = sanitized.lastTouchedPoint;
  abearcMultiClearAnalysis();
  window.restoreAbearcGravityPathState?.(sanitized.gravityPath || null);
  if (sanitized.analysis && typeof restoreAbearcMapLayoutAnalysisState === 'function') restoreAbearcMapLayoutAnalysisState(sanitized.analysis);
  return true;
}

function abearcMultiResetCurrent(mode = 'off', { keepIdentity = false } = {}) {
  abearcMapMeasureMode = mode;
  abearcMapMeasurePoints = [];
  abearcMapImportedPolygons = [];
  abearcMapSelectedImportedPolygons.clear();
  abearcMapImportedPolygonContextIndex = null;
  abearcMapEditingImportedPolygonIndex = null;
  abearcMapHiddenMeasurePointIndexes.clear();
  abearcMapElevationAnnotations.clear();
  abearcMapLastTouchedMeasureIndex = null;
  if (!keepIdentity) {
    abearcMapActiveMeasurementId = mode === 'off' ? null : abearcMultiMeasureId();
    abearcMapActiveMeasurementName = mode === 'off' ? '' : abearcMultiMeasurementDefaultName(mode);
  }
  abearcMultiClearAnalysis();
  window.restoreAbearcGravityPathState?.(null);
  resetAbearcElevationProfile?.();
}

function abearcMultiStashCurrent() {
  const current = abearcMultiCaptureCurrentRecord();
  if (!current) return null;
  const existingIndex = abearcMapMeasurements.findIndex(record => record.id === current.id);
  if (existingIndex >= 0) abearcMapMeasurements.splice(existingIndex, 1);
  abearcMapMeasurements.push(current);
  return current;
}

function captureAbearcMultiMeasurementState() {
  const active = abearcMultiCaptureCurrentRecord({ allowInvalid: true });
  return {
    version: 1,
    sequence: abearcMapMeasurementSequence,
    inactive: abearcMapMeasurements.map(record => abearcMultiMeasureClone(record)),
    active: active ? abearcMultiMeasureClone(active) : null
  };
}

function hasAbearcMultiMeasurements() {
  return abearcMapMeasurements.some(record => abearcMultiMeasurementIsValid(record.mode, record.points, record.importedPolygons));
}

function restoreAbearcMultiMeasurementState(state, { skipRender = false } = {}) {
  if (!state || typeof state !== 'object' || Number(state.version) !== 1) return false;
  const inactive = (Array.isArray(state.inactive) ? state.inactive : []).slice(0, 1000)
    .map((record, index) => abearcMultiSanitizeRecord(record, index)).filter(Boolean);
  const active = state.active ? abearcMultiSanitizeRecord(state.active, inactive.length) : null;
  abearcMapMeasurements = inactive;
  abearcMapMeasurementSequence = Math.max(Number(state.sequence) || 0, inactive.length + (active ? 1 : 0));
  if (active) abearcMultiApplyCurrentRecord(active);
  else abearcMultiResetCurrent('off');
  if (!skipRender) {
    saveAbearcMapMeasure?.();
    updateAbearcMapMeasureTools?.();
    renderAbearcMapMeasure?.();
  }
  return true;
}

function startAbearcMultiMeasurementMode(mode) {
  if (!['distance', 'area'].includes(mode)) return false;
  rememberAbearcMapMeasureState?.();
  const validCurrent = abearcMultiMeasurementIsValid();
  if (validCurrent) abearcMultiStashCurrent();
  else if (abearcMapMeasureMode === mode && abearcMapMeasurePoints.length === 0 && !abearcMapImportedPolygons.length) {
    abearcMultiResetCurrent('off');
    saveAbearcMapMeasure?.();
    updateAbearcMapMeasureTools?.();
    renderAbearcMapMeasure?.();
    toast('Ruler off');
    return true;
  }
  abearcMultiResetCurrent(mode);
  saveAbearcMapMeasure?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  toast(`${mode === 'area' ? 'Area' : 'Distance'} ruler on${validCurrent ? ' · previous measurement saved' : ''}`);
  return true;
}

function prepareAbearcMultiMeasurementImport(mode, name = '') {
  if (!['distance', 'area'].includes(mode)) return;
  if (abearcMultiMeasurementIsValid()) abearcMultiStashCurrent();
  abearcMultiResetCurrent(mode);
  if (name) abearcMapActiveMeasurementName = String(name).slice(0, 120);
}

function selectAbearcMapMeasurement(id) {
  const targetIndex = abearcMapMeasurements.findIndex(record => record.id === id);
  if (targetIndex < 0) return false;
  rememberAbearcMapMeasureState?.();
  if (abearcMultiMeasurementIsValid()) abearcMultiStashCurrent();
  const refreshedIndex = abearcMapMeasurements.findIndex(record => record.id === id);
  if (refreshedIndex < 0) return false;
  const [target] = abearcMapMeasurements.splice(refreshedIndex, 1);
  if (!abearcMultiApplyCurrentRecord(target)) return false;
  saveAbearcMapMeasure?.();
  resetAbearcElevationProfile?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  return true;
}

function clearSelectedAbearcMapMeasurement() {
  const hadCurrent = abearcMultiMeasurementIsValid() || abearcMapMeasurePoints.length || abearcMapImportedPolygons.length;
  if (!hadCurrent && !abearcMapMeasurements.length) return true;
  rememberAbearcMapMeasureState?.();
  abearcMultiResetCurrent('off');
  if (abearcMapMeasurements.length) {
    const target = abearcMapMeasurements.pop();
    abearcMultiApplyCurrentRecord(target);
  }
  saveAbearcMapMeasure?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  if (hadCurrent) toast('Selected measurement cleared');
  return true;
}

async function clearAllAbearcMapMeasurements() {
  const count = abearcMapMeasurements.length + (abearcMultiMeasurementIsValid() ? 1 : 0);
  if (!count) return;
  const confirmed = typeof confirmModalChoice === 'function'
    ? await confirmModalChoice(`Clear all ${count} measurement${count === 1 ? '' : 's'} from the map?`, {
        title: 'Clear All Measurements', confirmText: 'Clear All', confirmClass: 'px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium'
      })
    : window.confirm(`Clear all ${count} measurements?`);
  if (!confirmed) return;
  rememberAbearcMapMeasureState?.();
  abearcMapMeasurements = [];
  abearcMultiResetCurrent('off');
  removeSavedAbearcMapMeasure?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  toast('All measurements cleared');
}

function finishAbearcMapMeasurement() {
  if (!abearcMultiMeasurementIsValid()) return toast('Add at least two points for distance or three for area.', 'error');
  rememberAbearcMapMeasureState?.();
  abearcMultiStashCurrent();
  abearcMultiResetCurrent('off');
  saveAbearcMapMeasure?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  toast('Measurement finished');
}

function cancelAbearcMapMeasurement() {
  rememberAbearcMapMeasureState?.();
  abearcMultiResetCurrent('off');
  saveAbearcMapMeasure?.();
  updateAbearcMapMeasureTools?.();
  renderAbearcMapMeasure?.();
  toast('Drawing cancelled · use Undo to restore it');
}

function renameAbearcMapMeasurement(id = abearcMapActiveMeasurementId, next) {
  const isActive = id && id === abearcMapActiveMeasurementId;
  const target = isActive ? null : abearcMapMeasurements.find(record => record.id === id);
  const currentName = isActive ? abearcMapActiveMeasurementName : target?.name;
  if (!currentName) return;
  if (next === undefined) {
    const row = [...document.querySelectorAll('[data-map-measurement-id]')].find(item => item.dataset.mapMeasurementId === id);
    const form = row?.querySelector('[data-map-measure-rename]');
    if (!form) return;
    form.classList.remove('hidden');
    const input = form.querySelector('input');
    input.value = currentName;
    input.focus();
    input.select();
    return;
  }
  if (next === null) return;
  const name = String(next).trim().slice(0, 120);
  if (!name) return;
  rememberAbearcMapMeasureState?.();
  if (isActive) abearcMapActiveMeasurementName = name;
  else target.name = name;
  saveAbearcMapMeasure?.();
  renderAbearcMeasurementManager();
  toast('Measurement renamed');
}

function toggleAbearcMapMeasurementVisibility(id) {
  const target = abearcMapMeasurements.find(record => record.id === id);
  if (!target) return;
  rememberAbearcMapMeasureState?.();
  target.visible = target.visible === false;
  saveAbearcMapMeasure?.();
  renderAbearcMapMeasure?.();
}

function deleteAbearcStoredMeasurement(id) {
  const index = abearcMapMeasurements.findIndex(record => record.id === id);
  if (index < 0) return;
  rememberAbearcMapMeasureState?.();
  abearcMapMeasurements.splice(index, 1);
  saveAbearcMapMeasure?.();
  renderAbearcMapMeasure?.();
  toast('Measurement deleted');
}

function abearcMultiRecordPoints(record) {
  if (record?.importedPolygons?.length) return record.importedPolygons.flatMap(polygon => polygon.points || []);
  return Array.isArray(record?.points) ? record.points : [];
}

function zoomToAbearcMapMeasurement(id = abearcMapActiveMeasurementId) {
  const record = id === abearcMapActiveMeasurementId ? abearcMultiCaptureCurrentRecord({ includeAnalysis: false }) : abearcMapMeasurements.find(item => item.id === id);
  const points = abearcMultiRecordPoints(record);
  if (!points.length || !abearcMap) return;
  fitAbearcMapToSearchResults(points.map(coordinates => ({ geometry: { coordinates } })));
}

function abearcMultiMeasurementSummary(record) {
  const mode = abearcMultiMeasurementKind(record);
  if (mode === 'area') {
    const polygons = record.importedPolygons?.length ? record.importedPolygons.map(polygon => polygon.points) : [record.points];
    const areaM2 = polygons.reduce((sum, points) => sum + abearcPolygonArea(points), 0);
    return `${(areaM2 / 10000).toFixed(2)} ha`;
  }
  return formatAbearcDistance(abearcMeasurePathDistance(record.points || []));
}

function abearcMultiMeasurementAllRecords() {
  const records = abearcMapMeasurements.map(record => ({ ...record, active: false }));
  const active = abearcMultiCaptureCurrentRecord({ includeAnalysis: false });
  if (active && abearcMultiMeasurementIsValid(active.mode, active.points, active.importedPolygons)) records.push({ ...active, active: true });
  return records;
}

function renderAbearcMeasurementManager() {
  const drawing = document.querySelector('[data-map-measure-drawing]');
  if (drawing) drawing.classList.toggle('hidden', !['distance', 'area'].includes(abearcMapMeasureMode));
  const list = document.querySelector('[data-map-measure-list]');
  const count = document.querySelector('[data-map-measure-count]');
  const empty = document.querySelector('[data-map-measure-empty]');
  if (!list) return;
  const records = abearcMultiMeasurementAllRecords();
  if (count) count.textContent = String(records.length);
  if (empty) empty.classList.toggle('hidden', records.length > 0);
  list.innerHTML = records.map(record => {
    const type = abearcMultiMeasurementKind(record);
    const selected = record.active;
    const hidden = !record.active && record.visible === false;
    return `<div class="abearc-map-measure-item${selected ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}" data-map-measurement-id="${esc(record.id)}">
      <button type="button" class="abearc-map-measure-item-main" onclick="${selected ? `zoomToAbearcMapMeasurement('${esc(record.id)}')` : `selectAbearcMapMeasurement('${esc(record.id)}')`}" title="${selected ? 'Zoom to selected measurement' : 'Select measurement'}">
        <span class="abearc-map-measure-item-icon" aria-hidden="true">${type === 'area' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4Z"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 19 14-14M5 14v5h5M14 5h5v5"/></svg>'}</span>
        <span><strong>${esc(record.name)}</strong><small>${type === 'area' ? 'Area' : 'Distance'} · ${esc(abearcMultiMeasurementSummary(record))}${selected ? ' · Selected' : ''}</small></span>
      </button>
      <div class="abearc-map-measure-item-actions">
        ${selected ? '' : `<button type="button" onclick="event.stopPropagation(); toggleAbearcMapMeasurementVisibility('${esc(record.id)}')" title="${hidden ? 'Show' : 'Hide'} measurement" aria-label="${hidden ? 'Show' : 'Hide'} measurement">${hidden ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10 6h2c6 0 10 6 10 6l-3 3M6 6l-4 6s4 6 10 6h2"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/></svg>'}</button>`}
        <button type="button" onclick="event.stopPropagation(); zoomToAbearcMapMeasurement('${esc(record.id)}')" title="Zoom to measurement" aria-label="Zoom to measurement"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button>
        <button type="button" onclick="event.stopPropagation(); renameAbearcMapMeasurement('${esc(record.id)}')" title="Rename measurement" aria-label="Rename measurement"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg></button>
        ${selected ? '' : `<button type="button" class="is-danger" onclick="event.stopPropagation(); deleteAbearcStoredMeasurement('${esc(record.id)}')" title="Delete measurement" aria-label="Delete measurement"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>`}
      </div>
      <form data-map-measure-rename class="abearc-map-measure-rename hidden" onsubmit="event.preventDefault(); renameAbearcMapMeasurement('${esc(record.id)}', this.querySelector('input').value)">
        <input aria-label="Measurement name" maxlength="120" required onkeydown="if(event.key === 'Escape') { event.preventDefault(); this.closest('form').classList.add('hidden'); }">
        <button type="submit">Save</button>
        <button type="button" onclick="this.closest('form').classList.add('hidden')">Cancel</button>
      </form>
    </div>`;
  }).join('');
}

function abearcMultiRenderPath(svg, record, points, type, selected = false) {
  if (!points?.length) return;
  const projected = points.map(point => abearcMap.project(point));
  const isArea = type === 'area' && projected.length >= 3;
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `abearc-map-multi-measurement${selected ? ' is-selected' : ''}`);
  group.setAttribute('data-measurement-id', record.id);
  const linePoints = isArea ? [...projected, projected[0]] : projected;
  if (isArea) {
    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    fill.setAttribute('points', projected.map(point => `${point.x},${point.y}`).join(' '));
    fill.setAttribute('class', 'abearc-map-measure-fill abearc-map-multi-measure-fill');
    fill.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); selectAbearcMapMeasurement(record.id); });
    fill.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      if (selectAbearcMapMeasurement(record.id)) setTimeout(() => openAbearcMapMeasureContextMenu(event), 0);
    });
    group.appendChild(fill);
  }
  if (linePoints.length >= 2) {
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    hit.setAttribute('points', linePoints.map(point => `${point.x},${point.y}`).join(' '));
    hit.setAttribute('class', 'abearc-map-measure-hit abearc-map-multi-measure-hit');
    hit.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); selectAbearcMapMeasurement(record.id); });
    hit.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      if (selectAbearcMapMeasurement(record.id)) setTimeout(() => openAbearcMapMeasureContextMenu(event), 0);
    });
    group.appendChild(hit);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', linePoints.map(point => `${point.x},${point.y}`).join(' '));
    line.setAttribute('class', 'abearc-map-measure-line abearc-map-multi-measure-line');
    group.appendChild(line);
  }
  if (projected.length > 1) {
    const anchor = isArea ? abearcScreenInteriorPoint(projected) : projected[projected.length - 1];
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.textContent = abearcMultiMeasurementSummary(record);
    label.setAttribute('x', isArea ? anchor.x : anchor.x + 12);
    label.setAttribute('y', isArea ? anchor.y : anchor.y - 12);
    label.setAttribute('class', 'abearc-map-measure-label is-total abearc-map-multi-measure-label');
    group.appendChild(label);
  }
  svg.appendChild(group);
}

function abearcMultiRenderInactiveAnalysis(svg, record) {
  const analysis = record?.analysis;
  if (!analysis || !abearcMap) return;
  if (Array.isArray(analysis.contours?.paths) && analysis.contours.paths.length) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `abearc-map-contours abearc-map-multi-analysis${abearcMapBasemap === 'google-satellite' ? ' is-satellite' : ' is-light-basemap'}`);
    analysis.contours.paths.forEach(contour => {
      const points = (contour.points || []).map(point => abearcMap.project(point));
      if (points.length < 2) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
      path.setAttribute('class', `abearc-map-contour-line${contour.index ? ' is-index' : ''}`);
      group.appendChild(path);
    });
    svg.appendChild(group);
  }
  const salt = analysis.saltLayout;
  if (Array.isArray(salt?.paths) && salt.paths.length) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `abearc-map-salt-layout abearc-map-multi-analysis${abearcMapBasemap === 'google-satellite' ? ' is-satellite' : ' is-light-basemap'}`);
    salt.paths.forEach(pathData => {
      const points = (pathData.points || []).map(point => abearcMap.project(point));
      if (points.length < 2) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
      path.setAttribute('class', 'abearc-map-salt-row');
      group.appendChild(path);
    });
    svg.appendChild(group);
  }
}

function renderAbearcInactiveMeasurements(svg) {
  if (!svg || !abearcMap) return;
  abearcMapMeasurements.filter(record => record.visible !== false).forEach(record => {
    abearcMultiRenderInactiveAnalysis(svg, record);
    if (record.importedPolygons?.length) {
      record.importedPolygons.forEach(polygon => abearcMultiRenderPath(svg, record, polygon.points, 'area'));
    } else {
      abearcMultiRenderPath(svg, record, record.points, record.mode);
    }
  });
  renderAbearcMeasurementManager();
}

function abearcMultiExportRecords() {
  return abearcMultiMeasurementAllRecords().filter(record => record.visible !== false);
}

async function exportAllAbearcMapMeasurementsKml() {
  const records = abearcMultiExportRecords();
  if (!records.length) return toast('There are no measurements to export.', 'error');
  const confirmed = typeof confirmModalChoice === 'function' ? await confirmModalChoice(`Export all ${records.length} measurement${records.length === 1 ? '' : 's'} as one KML file?`, {
    title: 'Export All Measurements', confirmText: 'Export KML', confirmClass: 'px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium'
  }) : true;
  if (!confirmed) return;
  const xmlEscape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
  const placemarks = [];
  records.forEach(record => {
    const type = abearcMultiMeasurementKind(record);
    const geometries = record.importedPolygons?.length ? record.importedPolygons.map((polygon, index) => ({ name: polygon.name || `${record.name} ${index + 1}`, points: polygon.points, type: 'area' })) : [{ name: record.name, points: record.points, type }];
    geometries.forEach(geometry => {
      if (geometry.type === 'area') {
        const coordinates = [...geometry.points, geometry.points[0]].map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},0`).join(' ');
        placemarks.push(`<Placemark><name>${xmlEscape(geometry.name)}</name><styleUrl>#area</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`);
      } else {
        const coordinates = geometry.points.map(point => `${Number(point[0]).toFixed(8)},${Number(point[1]).toFixed(8)},0`).join(' ');
        placemarks.push(`<Placemark><name>${xmlEscape(geometry.name)}</name><styleUrl>#distance</styleUrl><LineString><coordinates>${coordinates}</coordinates></LineString></Placemark>`);
      }
    });
  });
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ABEARC measurements</name><Style id="area"><LineStyle><color>ff15ccfa</color><width>3</width></LineStyle><PolyStyle><color>4015ccfa</color></PolyStyle></Style><Style id="distance"><LineStyle><color>ff15ccfa</color><width>3</width></LineStyle></Style>${placemarks.join('')}</Document></kml>`;
  downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `ABEARC-all-measurements-${new Date().toISOString().slice(0, 10)}.kml`);
}

async function exportAllAbearcMapMeasurementsGeoJson() {
  const records = abearcMultiExportRecords();
  if (!records.length) return toast('There are no measurements to export.', 'error');
  const features = [];
  records.forEach(record => {
    const type = abearcMultiMeasurementKind(record);
    const geometries = record.importedPolygons?.length ? record.importedPolygons.map((polygon, index) => ({ name: polygon.name || `${record.name} ${index + 1}`, points: polygon.points, type: 'area' })) : [{ name: record.name, points: record.points, type }];
    geometries.forEach(geometry => features.push({
      type: 'Feature',
      properties: { measurement_id: record.id, name: geometry.name, measurement_type: geometry.type },
      geometry: geometry.type === 'area'
        ? { type: 'Polygon', coordinates: [[...geometry.points, geometry.points[0]]] }
        : { type: 'LineString', coordinates: geometry.points }
    }));
  });
  downloadBlob(new Blob([JSON.stringify({ type: 'FeatureCollection', name: 'ABEARC measurements', features }, null, 2)], { type: 'application/geo+json;charset=utf-8' }), `ABEARC-all-measurements-${new Date().toISOString().slice(0, 10)}.geojson`);
}

Object.assign(window, {
  captureAbearcMultiMeasurementState,
  resetAbearcMultiMeasurementCollection,
  restoreAbearcMultiMeasurementState,
  hasAbearcMultiMeasurements,
  startAbearcMultiMeasurementMode,
  prepareAbearcMultiMeasurementImport,
  selectAbearcMapMeasurement,
  clearSelectedAbearcMapMeasurement,
  clearAllAbearcMapMeasurements,
  finishAbearcMapMeasurement,
  cancelAbearcMapMeasurement,
  renameAbearcMapMeasurement,
  toggleAbearcMapMeasurementVisibility,
  deleteAbearcStoredMeasurement,
  zoomToAbearcMapMeasurement,
  renderAbearcMeasurementManager,
  renderAbearcInactiveMeasurements,
  exportAllAbearcMapMeasurementsKml,
  exportAllAbearcMapMeasurementsGeoJson
});
