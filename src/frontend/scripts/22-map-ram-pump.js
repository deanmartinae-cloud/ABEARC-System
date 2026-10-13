/* ABEARC Ram Pump System Layout
 * Native Measure Tools extension: Point A is the water source, Point B is the
 * intended service area/reservoir. Terrain analysis determines the pump site
 * and preliminary drive/delivery pipe routes.
 */
(function(root) {
  'use strict';

  const STATE_VERSION = 2;
  const SOURCE_RESOLUTION_M = {
    'namria-dtm5-prs92': 5,
    'aws-copernicus-glo30': 30,
    'copernicus-glo90': 90,
    'aws-copernicus-glo90': 90,
    'aws-mapzen': 30,
    'opentopo-srtm30': 30
  };
  const SOURCE_LABELS = {
    'namria-dtm5-prs92': 'NAMRIA DTM 5 m (PRS92)',
    'aws-copernicus-glo30': 'AWS Copernicus GLO-30 DSM',
    'copernicus-glo90': 'Copernicus GLO-90',
    'aws-copernicus-glo90': 'AWS Copernicus GLO-90',
    'aws-mapzen': 'AWS Terrain Tiles (Mapzen)',
    'opentopo-srtm30': 'OpenTopoData SRTM 30 m'
  };

  let state = null;
  let operationAbort = null;
  let operationSerial = 0;
  let renderRaf = 0;
  let mapListenersMap = null;
  let geometryDrag = null;
  let labelDrag = null;
  let profileDrag = null;
  let profileResize = null;
  let profileLabelDrag = null;
  const profileUi = { floating: false, expanded: false, left: null, top: null, width: null, height: null };

  function core() { return root.abearcRamPumpCore; }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function now() { return new Date().toISOString(); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function format(value, digits = 2) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(digits) : '—'; }
  function flow(value, digits = 2) { return format(Number(value) * 60, digits); }
  function flowNote(text) { return String(text).replace(/([\d.]+) L\/s\b/g, (_, value) => `${flow(value)} L/min`); }
  function validPoint(point) { return core()?.validLngLat(point); }
  function safeSource(source) { return SOURCE_RESOLUTION_M[source] ? source : 'namria-dtm5-prs92'; }
  function rememberChange() { try { rememberAbearcMapLayoutChange?.(); } catch (_) {} }

  function defaultInputs() {
    return {
      sourceFlowLps: 12 / 60,
      desiredDeliveryFlowLps: 0,
      efficiency: 0.60,
      hazenWilliamsC: 140,
      minDriveHeadM: 1.5,
      maxDeliveryLiftM: 180,
      driveInstallation: 'ground',
      driveAlignment: 'straight-preferred',
      maxSupportHeightM: 6,
      designBasis: 'generic',
      driveLengthRule: 'peace-corps',
      longDriveTreatment: 'auto-standpipe',
      operatingHours: 24,
      drivePipeDiameterMm: 0,
      deliveryPipeDiameterMm: 0,
      pipeMaterial: 'HDPE',
      pumpModel: ''
    };
  }

  function defaultState() {
    return {
      stateVersion: STATE_VERSION,
      name: 'Ram Pump System Layout',
      visible: true,
      measurementId: '',
      elevationSource: safeSource(typeof abearcMapElevationSource === 'string' ? abearcMapElevationSource : ''),
      elevationSourceLabel: '',
      inputs: defaultInputs(),
      source: null,
      pump: null,
      destination: null,
      driveRoute: [],
      deliveryRoute: [],
      candidates: [],
      selectedCandidateIndex: 0,
      profile: [],
      pumpChainageM: 0,
      metrics: null,
      assessment: null,
      annotations: {},
      profileAnnotations: {},
      generatedAt: '',
      updatedAt: now()
    };
  }

  function sanitizeRoute(route, limit = 800) {
    return (Array.isArray(route) ? route : []).slice(0, limit).filter(validPoint).map(point => [Number(point[0]), Number(point[1])]);
  }

  function sanitizeInputs(inputs = {}) {
    const base = defaultInputs();
    const pipeMaterial = String(inputs.pipeMaterial || base.pipeMaterial).trim().slice(0, 40) || base.pipeMaterial;
    const pumpModel = String(inputs.pumpModel || '').trim().slice(0, 120);
    return {
      sourceFlowLps: Math.max(0, Math.min(10000, number(inputs.sourceFlowLps, base.sourceFlowLps))),
      desiredDeliveryFlowLps: Math.max(0, Math.min(10000, number(inputs.desiredDeliveryFlowLps, 0))),
      efficiency: Math.max(0.2, Math.min(0.85, number(inputs.efficiency, base.efficiency))),
      hazenWilliamsC: Math.max(80, Math.min(160, number(inputs.hazenWilliamsC, base.hazenWilliamsC))),
      minDriveHeadM: Math.max(0.5, Math.min(30, number(inputs.minDriveHeadM, base.minDriveHeadM))),
      maxDeliveryLiftM: Math.max(1, Math.min(180, number(inputs.maxDeliveryLiftM, base.maxDeliveryLiftM))),
      driveInstallation: inputs.driveInstallation === 'elevated-supports' ? 'elevated-supports' : 'ground',
      driveAlignment: ['straight-preferred','terrain-following','straight-only'].includes(inputs.driveAlignment) ? inputs.driveAlignment : base.driveAlignment,
      maxSupportHeightM: Math.max(0.5, Math.min(30, number(inputs.maxSupportHeightM, base.maxSupportHeightM))),
      designBasis: inputs.designBasis === 'peace-corps-s2' ? 'peace-corps-s2' : 'generic',
      driveLengthRule: inputs.driveLengthRule === 'manufacturer' ? 'manufacturer' : 'peace-corps',
      longDriveTreatment: ['auto-standpipe','drive-tank','none'].includes(inputs.longDriveTreatment) ? inputs.longDriveTreatment : base.longDriveTreatment,
      operatingHours: Math.max(0.5, Math.min(24, number(inputs.operatingHours, base.operatingHours))),
      drivePipeDiameterMm: Math.max(0, Math.min(2000, number(inputs.drivePipeDiameterMm, 0))),
      deliveryPipeDiameterMm: Math.max(0, Math.min(2000, number(inputs.deliveryPipeDiameterMm, 0))),
      pipeMaterial,
      pumpModel
    };
  }

  function sanitizeAssessment(value) {
    if (!value || typeof value !== 'object') return null;
    const allowed = ['feasible', 'review', 'not-feasible'];
    return {
      level: allowed.includes(value.level) ? value.level : 'review',
      title: String(value.title || '').slice(0, 180),
      reasons: (Array.isArray(value.reasons) ? value.reasons : []).slice(0, 20).map(reason => String(reason).slice(0, 320))
    };
  }

  function sanitizeState(value) {
    if (!value || typeof value !== 'object') return null;
    const next = defaultState();
    next.name = String(value.name || next.name).slice(0, 160);
    next.visible = value.visible !== false;
    next.measurementId = String(value.measurementId || '').slice(0, 120);
    next.elevationSource = safeSource(value.elevationSource);
    next.elevationSourceLabel = String(value.elevationSourceLabel || '').slice(0, 160);
    next.inputs = sanitizeInputs(value.inputs);
    next.source = validPoint(value.source) ? [Number(value.source[0]), Number(value.source[1])] : null;
    next.pump = validPoint(value.pump) ? [Number(value.pump[0]), Number(value.pump[1])] : null;
    next.destination = validPoint(value.destination) ? [Number(value.destination[0]), Number(value.destination[1])] : null;
    next.driveRoute = sanitizeRoute(value.driveRoute);
    next.deliveryRoute = sanitizeRoute(value.deliveryRoute);
    next.candidates = (Array.isArray(value.candidates) ? value.candidates : []).slice(0, 5).map(candidate => ({
      location: validPoint(candidate?.location) ? [Number(candidate.location[0]), Number(candidate.location[1])] : null,
      pumpElevationM: number(candidate?.pumpElevationM, NaN),
      driveHeadM: number(candidate?.driveHeadM, NaN),
      deliveryHeadM: number(candidate?.deliveryHeadM, NaN),
      headRatio: number(candidate?.headRatio, NaN),
      driveDistanceM: number(candidate?.driveDistanceM, NaN),
      deliveryDistanceM: number(candidate?.deliveryDistanceM, NaN),
      score: number(candidate?.score, 0),
      driveRoute: sanitizeRoute(candidate?.driveRoute, 500),
      deliveryRoute: sanitizeRoute(candidate?.deliveryRoute, 500)
    })).filter(candidate => candidate.location && candidate.driveRoute.length >= 2 && candidate.deliveryRoute.length >= 2);
    next.selectedCandidateIndex = Math.max(0, Math.min(next.candidates.length - 1, Math.trunc(number(value.selectedCandidateIndex, 0))));
    next.profile = (Array.isArray(value.profile) ? value.profile : []).slice(0, 400).map(item => ({
      chainageM: number(item?.chainageM, 0), elevationM: number(item?.elevationM, NaN), segment: item?.segment === 'delivery' ? 'delivery' : 'drive'
    })).filter(item => Number.isFinite(item.elevationM));
    next.pumpChainageM = Math.max(0, number(value.pumpChainageM, 0));
    next.metrics = value.metrics && typeof value.metrics === 'object' ? clone(value.metrics) : null;
    next.assessment = sanitizeAssessment(value.assessment);
    next.annotations = {};
    Object.entries(value.annotations || {}).slice(0, 20).forEach(([key, offset]) => {
      const dx = number(offset?.dx, NaN), dy = number(offset?.dy, NaN);
      if (Number.isFinite(dx) && Number.isFinite(dy)) next.annotations[String(key).slice(0, 50)] = { dx: Math.max(-600, Math.min(600, dx)), dy: Math.max(-500, Math.min(500, dy)) };
    });
    next.generatedAt = String(value.generatedAt || '').slice(0, 40);
    for (const key of ['source', 'pump', 'destination', 'high-point', 'standpipe']) {
      const offset = value.profileAnnotations?.[key];
      if (Number.isFinite(offset?.dx) && Number.isFinite(offset?.dy)) next.profileAnnotations[key] = { dx:Math.max(-760, Math.min(760, offset.dx)), dy:Math.max(-230, Math.min(230, offset.dy)) };
    }
    next.updatedAt = String(value.updatedAt || now()).slice(0, 40);
    return next;
  }

  function captureAbearcRamPumpState() { return state ? sanitizeState(state) : null; }

  function restoreAbearcRamPumpState(value, { skipRender = false } = {}) {
    cancelAbearcRamPumpOperation();
    clearOverlayOnly();
    const previousMeasurementId = String(state?.measurementId || '');
    if (previousMeasurementId) setMeasurementVisibilityForRamPump(previousMeasurementId, true);
    state = sanitizeState(value);
    syncUiFromState();
    renderResults();
    if (!skipRender) renderAbearcRamPumpOverlay();
    return Boolean(state);
  }

  function clearOverlayOnly() {
    const layer = document.querySelector('[data-map-ram-pump-layer]');
    if (layer) layer.replaceChildren();
  }

  function clearAbearcRamPumpLayout({ remember = true, quiet = false } = {}) {
    if (remember && state) rememberChange();
    cancelAbearcRamPumpOperation();
    const measurementId = String(state?.measurementId || '');
    if (measurementId) setMeasurementVisibilityForRamPump(measurementId, true);
    state = null;
    clearOverlayOnly();
    renderResults();
    syncUiFromState();
    if (!quiet) toast('Ram-pump layout cleared');
  }

  function measurements() {
    const records = (Array.isArray(abearcMapMeasurements) ? abearcMapMeasurements : []).map(clone).filter(Boolean);
    try {
      const active = abearcMultiCaptureCurrentRecord?.({ includeAnalysis: false });
      if (active) {
        const index = records.findIndex(record => String(record.id) === String(active.id));
        if (index >= 0) records[index] = active; else records.push(active);
      }
    } catch (_) {}
    return records.filter(record => record?.visible !== false && record?.mode === 'distance' && Array.isArray(record.points) && record.points.length >= 2);
  }

  function geometry(record) { return sanitizeRoute(record?.points, 4000); }

  function measurementDisplay(record) {
    const points = geometry(record), lengthM = points.length >= 2 ? core().lineDistanceMetres(points) : 0;
    const name = String(record?.name || 'Distance measurement').trim() || 'Distance measurement';
    return { name, points, lengthM, label: `${name} · ${format(lengthM, lengthM >= 1000 ? 0 : 1)} m` };
  }

  function refreshMeasurementOptions(preferredId = '') {
    const select = document.querySelector('[data-ram-measurement]');
    if (!select) return;
    const records = measurements(), previous = preferredId || select.value || state?.measurementId || '';
    select.innerHTML = records.length ? records.map(record => {
      const display = measurementDisplay(record);
      return `<option value="${esc(record.id)}">${esc(display.label)}</option>`;
    }).join('') : '<option value="">No distance measurements available</option>';
    if (records.some(record => String(record.id) === String(previous))) select.value = String(previous);
    refreshAbearcRamPumpMeasurementSummary();
  }

  function selectedMeasurement() {
    const id = String(document.querySelector('[data-ram-measurement]')?.value || state?.measurementId || '');
    return measurements().find(record => String(record.id) === id) || null;
  }

  function refreshAbearcRamPumpMeasurementSummary() {
    const panel = document.querySelector('[data-ram-measurement-summary]');
    if (!panel) return null;
    const record = selectedMeasurement();
    if (!record) {
      panel.innerHTML = '<span>No completed distance measurement is selected.</span>';
      panel.classList.add('is-empty');
      return null;
    }
    const display = measurementDisplay(record), a = display.points[0], b = display.points.at(-1);
    panel.classList.remove('is-empty');
    panel.innerHTML = `<strong>${esc(display.name)}</strong><div><span><b>A · Source</b>${format(a?.[1], 6)}, ${format(a?.[0], 6)}</span><span><b>B · Destination</b>${format(b?.[1], 6)}, ${format(b?.[0], 6)}</span></div><small>Measured alignment: <b>${format(display.lengthM, 1)} m</b> · ${display.points.length} ${display.points.length === 1 ? 'vertex' : 'vertices'}</small>`;
    return record;
  }


  function measurementRecordById(id) {
    if (!id || !Array.isArray(abearcMapMeasurements)) return null;
    return abearcMapMeasurements.find(record => String(record?.id || '') === String(id)) || null;
  }

  function setMeasurementVisibilityForRamPump(id, visible) {
    const key = String(id || '');
    if (!key) return false;
    let changed = false;
    const record = measurementRecordById(key);
    if (record && record.visible !== visible) {
      record.visible = visible;
      changed = true;
      try { saveAbearcMapMeasure?.(); } catch (_) {}
    }
    if (String(root.abearcMapActiveMeasurementId || '') === key) {
      const nextHidden = visible ? '' : key;
      if (String(root.abearcRamPumpHiddenMeasurementId || '') !== nextHidden) {
        root.abearcRamPumpHiddenMeasurementId = nextHidden;
        changed = true;
      }
    } else if (visible && String(root.abearcRamPumpHiddenMeasurementId || '') === key) {
      root.abearcRamPumpHiddenMeasurementId = '';
      changed = true;
    }
    if (changed) {
      try { renderAbearcMapMeasure?.(); } catch (_) {}
      try { renderAbearcMeasurementManager?.(); } catch (_) {}
    }
    return changed;
  }

  function syncRamPumpMeasurementVisibility(forceVisible = null) {
    const id = String(state?.measurementId || '');
    if (!id) return false;
    const visible = forceVisible == null
      ? !(state?.metrics && state?.assessment?.level !== 'not-feasible')
      : Boolean(forceVisible);
    return setMeasurementVisibilityForRamPump(id, visible);
  }

  function syncUiFromState() {
    refreshMeasurementOptions(state?.measurementId || '');
    const next = state || defaultState(), inputs = next.inputs || defaultInputs();
    const set = (selector, value) => { const el = document.querySelector(selector); if (el && document.activeElement !== el) el.value = value ?? ''; };
    set('[data-ram-elevation-source]', next.elevationSource);
    set('[data-ram-source-flow]', inputs.sourceFlowLps > 0 ? Number(flow(inputs.sourceFlowLps, 6)) : '');
    set('[data-ram-desired-flow]', inputs.desiredDeliveryFlowLps ? Number(flow(inputs.desiredDeliveryFlowLps, 6)) : '');
    set('[data-ram-efficiency]', inputs.efficiency);
    set('[data-ram-c]', inputs.hazenWilliamsC);
    set('[data-ram-min-head]', inputs.minDriveHeadM);
    set('[data-ram-max-lift]', inputs.maxDeliveryLiftM);
    set('[data-ram-drive-installation]', inputs.driveInstallation);
    set('[data-ram-drive-alignment]', inputs.driveAlignment);
    set('[data-ram-max-support-height]', inputs.maxSupportHeightM);
    set('[data-ram-design-basis]', inputs.designBasis);
    set('[data-ram-drive-length-rule]', inputs.driveLengthRule);
    set('[data-ram-long-drive-treatment]', inputs.longDriveTreatment);
    set('[data-ram-hours]', inputs.operatingHours);
    set('[data-ram-drive-diameter]', inputs.drivePipeDiameterMm || '');
    set('[data-ram-delivery-diameter]', inputs.deliveryPipeDiameterMm || '');
    set('[data-ram-material]', inputs.pipeMaterial);
    set('[data-ram-model]', inputs.pumpModel);
    const visible = document.querySelector('[data-ram-visible]'); if (visible) visible.checked = next.visible !== false;
    syncSourceFlowField(inputs);
    syncDriveInstallationUi(inputs);
    syncDriveLengthUi(inputs);
    renderGilmanModelSuggestion();
  }

  function readUiInputs() {
    const get = selector => document.querySelector(selector)?.value;
    const desiredLpm = Math.max(0, number(get('[data-ram-desired-flow]'), 0));
    const sourceLpm = desiredLpm > 0 ? Math.max(0, number(get('[data-ram-source-flow]'), 0)) : Math.max(0, number(get('[data-ram-source-flow]'), 12));
    return sanitizeInputs({
      sourceFlowLps: sourceLpm / 60, desiredDeliveryFlowLps: desiredLpm / 60, efficiency: get('[data-ram-efficiency]'),
      hazenWilliamsC: get('[data-ram-c]'), minDriveHeadM: get('[data-ram-min-head]'), maxDeliveryLiftM: get('[data-ram-max-lift]'),
      driveInstallation: get('[data-ram-drive-installation]'), driveAlignment: get('[data-ram-drive-alignment]'), maxSupportHeightM: get('[data-ram-max-support-height]'),
      designBasis: get('[data-ram-design-basis]'), driveLengthRule: get('[data-ram-drive-length-rule]'), longDriveTreatment: get('[data-ram-long-drive-treatment]'), operatingHours: get('[data-ram-hours]'),
      drivePipeDiameterMm: get('[data-ram-drive-diameter]'), deliveryPipeDiameterMm: get('[data-ram-delivery-diameter]'),
      pipeMaterial: get('[data-ram-material]'), pumpModel: get('[data-ram-model]')
    });
  }

  function syncSourceFlowField(inputs = state?.inputs || defaultInputs()) {
    const desired = Number(inputs.desiredDeliveryFlowLps || 0) > 0;
    const field = document.querySelector('[data-ram-source-flow]');
    const label = document.querySelector('[data-ram-source-flow-label]');
    const note = document.querySelector('[data-ram-source-flow-note]');
    if (label) label.textContent = desired ? 'Required source flow (L/min)' : 'Available source flow (L/min)';
    if (field) {
      field.readOnly = desired;
      field.classList.toggle('is-computed', desired);
      field.title = desired
        ? 'Automatically calculated from desired delivery flow, site heads, efficiency and pipe friction.'
        : 'Measured/available source flow in litres per minute.';
      field.placeholder = desired ? 'Calculated after terrain analysis' : '';
      if (document.activeElement !== field) field.value = inputs.sourceFlowLps > 0 ? Number(flow(inputs.sourceFlowLps, 6)) : '';
    }
    if (note) {
      if (desired) {
        note.textContent = inputs.sourceFlowLps > 0
          ? `Required source flow is calculated automatically for the ${flow(inputs.desiredDeliveryFlowLps, 3)} L/min delivery target using the current site heads and pipe losses.`
          : 'Required source flow will be calculated after ABEARC determines the ram-pump site, drive head, delivery lift and pipe losses.';
      } else note.textContent = 'Without a desired delivery-flow target, enter the measured available source flow. Default: 12 L/min.';
    }
  }


  function syncDriveInstallationUi(inputs = state?.inputs || defaultInputs()) {
    const elevated = inputs.driveInstallation === 'elevated-supports';
    const field = document.querySelector('[data-ram-support-height-field]');
    const support = document.querySelector('[data-ram-max-support-height]');
    const note = document.querySelector('[data-ram-drive-installation-note]');
    if (field) field.classList.toggle('is-disabled', !elevated);
    if (support) support.disabled = !elevated;
    if (note) {
      const alignment = inputs.driveAlignment === 'straight-only' ? 'Straight-only alignment is enforced.' : inputs.driveAlignment === 'terrain-following' ? 'Terrain-following plan alignment is allowed.' : 'Straight/no-turn alignment is tried first and is the recommended option.';
      note.textContent = elevated
        ? `Elevated support mode keeps the drive pipe on a continuously descending design grade above uneven terrain. ${alignment} Support frames can bridge low ground, but they cannot pass the pipe through terrain above the design grade. Maximum support height: ${format(inputs.maxSupportHeightM, 1)} m.`
        : `On-ground mode requires the drive-pipe terrain profile itself to descend continuously. ${alignment}`;
    }
  }

  function syncDriveLengthUi(inputs = state?.inputs || defaultInputs()) {
    const note = document.querySelector('[data-ram-drive-length-note]');
    if (!note) return;
    const s2 = inputs.designBasis === 'peace-corps-s2';
    const reference = inputs.driveLengthRule === 'peace-corps';
    const treatment = inputs.longDriveTreatment === 'drive-tank'
      ? 'If L > Lmax, ABEARC will insert a drive tank near the maximum allowable distance from the pump.'
      : inputs.longDriveTreatment === 'none'
        ? 'If L > Lmax, ABEARC will flag the run for engineering review instead of inserting a dissipation device.'
        : 'If L > Lmax, ABEARC will insert an open standpipe near the maximum allowable distance from the pump.';
    note.textContent = reference
      ? `${s2 ? 'Peace Corps / Warwick S-2 design basis selected. ' : ''}Drive-pipe planning guideline: Lmin = 150D and Lmax = 1000D using consistent units. ${treatment}${s2 ? ' S-2 limits are 40–120 L/min source flow, 2–15 m drive head, and up to 100 m delivery head.' : ' For non-S-2/manufacturer pumps this rule is treated as a reference guideline unless verified by the selected manufacturer.'}`
      : `${s2 ? 'S-2 design basis still applies its published operating envelope. ' : ''}Drive-pipe length is left to manufacturer/final engineering review; no 150D–1000D automatic standpipe rule is applied.`;
  }

  function gilmanCatalog() {
    return Array.isArray(core()?.GILMAN_RAM_PUMP_MODELS) ? core().GILMAN_RAM_PUMP_MODELS : [];
  }

  function gilmanModelByName(value) {
    const needle = String(value || '').trim().toUpperCase();
    if (!needle) return null;
    return gilmanCatalog().find(model => String(model.model || '').toUpperCase() === needle || String(model.code || '').toUpperCase() === needle) || null;
  }

  function currentGilmanRecommendation() {
    const inputs = state?.inputs || defaultInputs();
    const desiredDailyOutputL = Math.max(0, Number(inputs.desiredDeliveryFlowLps || 0)) * 60 * 60 * 24;
    return core()?.recommendGilmanRamPump?.({
      sourceFlowLpm: Math.max(0, Number(inputs.sourceFlowLps || 0)) * 60,
      deliveryHeadM: Number.isFinite(Number(state?.metrics?.deliveryHeadM)) ? Number(state.metrics.deliveryHeadM) : null,
      desiredDailyOutputL
    }) || null;
  }

  function gilmanModelSummaryHtml(model) {
    if (!model) return '';
    const stock = Number(model.stock) > 0 ? `Stock snapshot: ${Number(model.stock)}` : 'Stock snapshot: out of stock';
    const price = Number(model.salePricePhp || 0) > 0 ? `₱${Number(model.salePricePhp).toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : 'Price not listed';
    return `<strong>${esc(model.model)}</strong><span>${esc(model.duty)}</span><small>${format(model.supplyFlowMinLpm,0)}–${format(model.supplyFlowMaxLpm,0)} L/min source · max lift ${esc(model.maxPumpLift)} · drive ${esc(model.drivePort)} · delivery ${esc(model.deliveryPort)}</small><small>${esc(model.dailyOutput)} · ${esc(price)} · ${esc(stock)}</small>`;
  }

  function renderGilmanModelSuggestion() {
    const panel = document.querySelector('[data-ram-model-suggestion]');
    if (!panel) return;
    if ((state?.inputs || defaultInputs()).designBasis === 'peace-corps-s2') {
      const ref = core()?.PEACE_CORPS_S2 || {};
      panel.className = 'abearc-ram-model-suggestion is-selected';
      panel.innerHTML = `<div><b>Reference design selected</b><strong>Peace Corps / Warwick S-2</strong><small>Source flow ${format(ref.sourceFlowMinLpm || 40,0)}–${format(ref.sourceFlowMaxLpm || 120,0)} L/min · drive head ${format(ref.driveHeadMinM || 2,0)}–${format(ref.driveHeadMaxM || 15,0)} m · delivery head up to ${format(ref.deliveryHeadMaxM || 100,0)} m.</small><small>Drive-pipe Table 2 and the 150D–1000D length rule are applied as S-2 reference checks. Final fabrication and field design must follow the manual and verified local engineering details.</small></div>`;
      return;
    }
    const recommendation = currentGilmanRecommendation();
    const selected = gilmanModelByName(state?.inputs?.pumpModel);
    const snapshot = core()?.GILMAN_CATALOG_SNAPSHOT;
    if (!selected && Number(state?.inputs?.desiredDeliveryFlowLps || 0) > 0 && !(Number(state?.inputs?.sourceFlowLps) > 0)) {
      panel.className = 'abearc-ram-model-suggestion';
      panel.innerHTML = '<small>Generate or recalculate the layout first. ABEARC will calculate the required source flow, then match it against the embedded Gilman catalog.</small>';
      return;
    }
    if (selected) {
      panel.className = 'abearc-ram-model-suggestion is-selected';
      panel.innerHTML = `<div>${gilmanModelSummaryHtml(selected)}</div><button type="button" onclick="useAbearcGilmanRamPumpModel('')">Return to auto suggestion</button><small class="abearc-ram-catalog-note">Local Gilman catalog snapshot ${esc(snapshot?.capturedAt || '')}; no live website lookup.</small>`;
      return;
    }
    if (!recommendation) {
      panel.className = 'abearc-ram-model-suggestion';
      panel.innerHTML = '<small>Local manufacturer model suggestion is unavailable.</small>';
      return;
    }
    if (recommendation.recommended) {
      const model = recommendation.recommended;
      panel.className = 'abearc-ram-model-suggestion is-match';
      panel.innerHTML = `<div><b>Auto-suggested manufacturer model</b>${gilmanModelSummaryHtml(model)}<small>${esc(recommendation.reason)}</small></div><button type="button" onclick="useAbearcGilmanRamPumpModel('${esc(model.model)}')">Use ${esc(model.code)}</button><small class="abearc-ram-catalog-note">Offline snapshot ${esc(snapshot?.capturedAt || '')}. Verify current manufacturer performance before final design.</small>`;
      return;
    }
    const alternatives = (recommendation.alternatives || []).map(model => `<button type="button" class="abearc-ram-model-chip" onclick="useAbearcGilmanRamPumpModel('${esc(model.model)}')" title="${esc(model.maxPumpLift)}">${esc(model.code)} · ${format(model.supplyFlowMinLpm,0)}–${format(model.supplyFlowMaxLpm,0)} L/min</button>`).join('');
    panel.className = 'abearc-ram-model-suggestion is-warning';
    panel.innerHTML = `<div><b>No exact Gilman model match</b><small>${esc(recommendation.reason)}</small>${alternatives ? `<div class="abearc-ram-model-nearest"><span>Nearest catalog entries:</span>${alternatives}</div>` : ''}</div><small class="abearc-ram-catalog-note">Offline snapshot ${esc(snapshot?.capturedAt || '')}; ABEARC does not query gilmanrampump.com at runtime.</small>`;
  }

  function useAbearcGilmanRamPumpModel(modelName) {
    if (!state) state = defaultState();
    rememberChange();
    state.inputs = sanitizeInputs({ ...state.inputs, designBasis: modelName ? 'generic' : state.inputs.designBasis, pumpModel: String(modelName || '') });
    const input = document.querySelector('[data-ram-model]');
    if (input) input.value = state.inputs.pumpModel;
    state.updatedAt = now();
    renderGilmanModelSuggestion();
    renderResults();
    return state.inputs.pumpModel;
  }

  function setAbearcRamPumpElevationSource(source) {
    source = safeSource(source);
    if (!state) state = defaultState();
    state.elevationSource = source; state.updatedAt = now();
  }

  function updateAbearcRamPumpInputs({ recalculate = false, regenerate = false } = {}) {
    if (!state) state = defaultState();
    const previouslyDesired = Number(state.inputs?.desiredDeliveryFlowLps || 0) > 0;
    rememberChange();
    const nextInputs = readUiInputs();
    const desired = Number(nextInputs.desiredDeliveryFlowLps || 0) > 0;
    if (desired && !state.metrics) nextInputs.sourceFlowLps = 0;
    else if (!desired && previouslyDesired) nextInputs.sourceFlowLps = 12 / 60;
    state.inputs = sanitizeInputs(nextInputs);
    state.elevationSource = safeSource(document.querySelector('[data-ram-elevation-source]')?.value || state.elevationSource);
    state.updatedAt = now();
    syncSourceFlowField(state.inputs);
    syncDriveInstallationUi(state.inputs);
    syncDriveLengthUi(state.inputs);
    renderGilmanModelSuggestion();
    if (regenerate && selectedMeasurement()) return generateAbearcRamPumpSystemLayout();
    if ((recalculate || ((desired || previouslyDesired !== desired) && state.source && state.pump && state.destination)) && state.source && state.pump && state.destination) return recalculateAbearcRamPumpLayout({ remember: false });
    renderResults();
    return true;
  }

  function toggleAbearcRamPumpVisibility(force = null) {
    if (!state) return false;
    rememberChange();
    state.visible = force == null ? !state.visible : Boolean(force);
    const checkbox = document.querySelector('[data-ram-visible]'); if (checkbox) checkbox.checked = state.visible;
    state.updatedAt = now(); renderAbearcRamPumpOverlay(); return state.visible;
  }

  function toggleAbearcRamPumpDrawer(force = null) {
    const drawer = document.querySelector('[data-map-ram-pump-panel]');
    if (!drawer) return false;
    const open = force == null ? drawer.classList.contains('hidden') : Boolean(force);
    const resultsPanel = document.querySelector('[data-map-results-panel]');
    const button = document.querySelector('[data-map-ram-pump-toolbar]');
    if (open) {
      root.toggleWeatherStationsDrawer?.(false);
      root.toggleAbearcMapLayoutsDrawer?.(false);
      root.toggleAbearcOrthomosaicDrawer?.(false);
      root.toggleAbearcMapFilters?.(false);
      root.toggleAbearcMapLayerMenu?.(false);
      root.toggleAbearcQuickLayers?.(false);
    }
    drawer.classList.toggle('hidden', !open);
    if (open) resultsPanel?.classList.add('hidden');
    button?.classList.toggle('is-active', open);
    button?.setAttribute('aria-expanded', String(open)); button?.setAttribute('aria-pressed', String(open));
    try { root.syncAbearcMapRail?.(); } catch (_) {}
    try { root.animateAbearcMapResize?.(); } catch (_) {}
    setTimeout(() => { try { abearcMap?.resize?.(); renderAbearcRamPumpOverlay(); } catch (_) {} }, 0);
    if (open) {
      refreshMeasurementOptions(); syncUiFromState(); renderResults(); ensureMapListeners(); renderAbearcRamPumpOverlay();
    }
    return open;
  }

  function openAbearcRamPumpFromMeasurement() {
    closeAbearcMapMeasureContextMenu?.();
    toggleAbearcRamPumpDrawer(true);
    const activeId = String(abearcMapActiveMeasurementId || '');
    refreshMeasurementOptions(activeId);
    const select = document.querySelector('[data-ram-measurement]');
    if (select && [...select.options].some(option => option.value === activeId)) select.value = activeId;
    return generateAbearcRamPumpSystemLayout();
  }

  function setProgress(percent, stage, detail = '') {
    const panel = document.querySelector('[data-ram-progress]'); if (!panel) return;
    const safe = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    panel.classList.remove('hidden');
    const bar = panel.querySelector('[data-ram-progress-bar]'); if (bar) bar.style.width = `${safe}%`;
    const p = panel.querySelector('[data-ram-progress-percent]'); if (p) p.textContent = `${safe}%`;
    const s = panel.querySelector('[data-ram-progress-stage]'); if (s) s.textContent = stage;
    const d = panel.querySelector('[data-ram-progress-detail]'); if (d) d.textContent = detail;
  }
  function hideProgress() { document.querySelector('[data-ram-progress]')?.classList.add('hidden'); }
  function cancelAbearcRamPumpOperation() { if (operationAbort) operationAbort.abort(); operationAbort = null; operationSerial++; hideProgress(); }

  async function fetchElevations(points, sourceKey, signal, start = 0, end = 100, label = 'Sampling terrain') {
    const locations = (Array.isArray(points) ? points : []).map(point => validPoint(point) ? { longitude: Number(point[0]), latitude: Number(point[1]) } : point)
      .filter(point => Number.isFinite(Number(point?.longitude)) && Number.isFinite(Number(point?.latitude)));
    const elevations = []; let sourceLabel = SOURCE_LABELS[sourceKey] || sourceKey, effectiveSource = sourceKey;
    for (let offset = 0; offset < locations.length; offset += 250) {
      if (signal?.aborted) throw new DOMException('Calculation cancelled', 'AbortError');
      const part = locations.slice(offset, offset + 250);
      const result = await requestAbearcElevations(part, signal, effectiveSource, false);
      if (!Array.isArray(result.elevations) || result.elevations.length !== part.length || result.elevations.some(value => !Number.isFinite(Number(value)))) throw new Error('Elevation data is incomplete for part of the analysis area.');
      elevations.push(...result.elevations.map(Number)); effectiveSource = result.sourceKey || effectiveSource; sourceLabel = result.sourceLabel || sourceLabel;
      const ratio = locations.length ? Math.min(1, (offset + part.length) / locations.length) : 1;
      setProgress(start + (end - start) * ratio, label, `${Math.min(locations.length, offset + part.length).toLocaleString()} / ${locations.length.toLocaleString()} terrain samples`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { elevations, sourceKey: effectiveSource, sourceLabel };
  }

  function routePlanPoints(plan, indexes) {
    return (Array.isArray(indexes) ? indexes : []).map(index => {
      const point = plan.locations[index]; return [Number(point.longitude), Number(point.latitude)];
    }).filter(validPoint);
  }

  function analyzeElevatedDriveGrade(terrainProfile, sourceElevationM, pumpElevationM, maxSupportHeightM = 6) {
    const profile = Array.isArray(terrainProfile) ? terrainProfile : [];
    const totalLengthM = Math.max(0.001, Number(profile.at(-1)?.chainageM) || 0.001);
    let maxRequiredSupportHeightM = 0, meanSupportHeightM = 0, terrainIntrusionM = 0, positiveCount = 0;
    const designProfile = profile.map((item, index) => {
      const ratio = Math.max(0, Math.min(1, Number(item.chainageM || 0) / totalLengthM));
      const pipeElevationM = Number(sourceElevationM) + (Number(pumpElevationM) - Number(sourceElevationM)) * ratio;
      const terrainElevationM = Number(item.elevationM);
      const signedSupportHeightM = pipeElevationM - terrainElevationM;
      if (index > 0 && index < profile.length - 1) {
        terrainIntrusionM = Math.max(terrainIntrusionM, Math.max(0, -signedSupportHeightM));
        maxRequiredSupportHeightM = Math.max(maxRequiredSupportHeightM, Math.max(0, signedSupportHeightM));
        if (signedSupportHeightM > 0) { meanSupportHeightM += signedSupportHeightM; positiveCount++; }
      }
      return { chainageM:Number(item.chainageM || 0), elevationM:pipeElevationM, terrainElevationM, supportHeightM:Math.max(0, signedSupportHeightM), segment:'drive' };
    });
    meanSupportHeightM = positiveCount ? meanSupportHeightM / positiveCount : 0;
    const terrainToleranceM = 0.35, supportToleranceM = 0.25;
    return {
      feasible: terrainIntrusionM <= terrainToleranceM && maxRequiredSupportHeightM <= Number(maxSupportHeightM) + supportToleranceM,
      maxRequiredSupportHeightM, meanSupportHeightM, terrainIntrusionM, maxSupportHeightM:Number(maxSupportHeightM), terrainToleranceM,
      designProfile
    };
  }

  async function inspectDriveRoute(route, sourceKey, signal, progressStart, progressEnd, { installation = 'ground', sourceElevationM, pumpElevationM, maxSupportHeightM = 6, useRouteStartElevation = false } = {}) {
    const sampled = await sampleRouteProfile(route, sourceKey, signal, 90, progressStart, progressEnd, installation === 'elevated-supports' ? 'Checking elevated drive-pipe support grade' : 'Checking straight drive-pipe terrain');
    if (installation === 'elevated-supports') {
      const supportSourceElevationM = useRouteStartElevation ? Number(sampled.elevations[0]) : Number(sourceElevationM);
      const support = analyzeElevatedDriveGrade(sampled.profile, supportSourceElevationM, pumpElevationM, maxSupportHeightM);
      return { feasible:support.feasible, sampled, support, ascent:null };
    }
    const ascent = profileAscent(sampled.profile);
    return { feasible:ascent.total <= 0.35 && ascent.maximumStep <= 0.20, sampled, support:null, ascent };
  }

  async function routeDrivePipe(source, pump, sourceKey, signal, progressStart, progressEnd, options = {}) {
    const installation = options.installation === 'elevated-supports' ? 'elevated-supports' : 'ground';
    const alignment = ['straight-preferred','terrain-following','straight-only'].includes(options.alignment) ? options.alignment : 'straight-preferred';
    const direct = [source, pump];
    const directEnd = progressStart + (progressEnd - progressStart) * 0.34;
    const maxDriveLengthM = Number(options.maxDriveLengthM || 0), totalDirectM = core().haversineMetres(source, pump);
    const longDriveSupply = Boolean(options.allowLongDriveSupply && maxDriveLengthM > 0 && totalDirectM > maxDriveLengthM + 0.05);
    if (longDriveSupply && alignment !== 'terrain-following') {
      const split = splitRouteByTailLength(direct, maxDriveLengthM * 0.995);
      const inspection = await inspectDriveRoute(split.driveRoute, sourceKey, signal, progressStart, directEnd, { ...options, useRouteStartElevation:true });
      if (inspection.feasible) return { route:direct, straight:true, supplyStraight:true, strategy:installation === 'elevated-supports' ? 'straight-supply-elevated-drive' : 'straight-supply-ground-drive', supportAnalysis:inspection.support, longDriveSupply:true };
      if (alignment === 'straight-only') return null;
    }
    if (alignment !== 'terrain-following') {
      const inspection = await inspectDriveRoute(direct, sourceKey, signal, progressStart, directEnd, options);
      if (inspection.feasible) return { route:direct, straight:true, strategy:installation === 'elevated-supports' ? 'straight-elevated' : 'straight-ground', supportAnalysis:inspection.support };
      if (alignment === 'straight-only') return null;
    }

    const distanceM = core().haversineMetres(source, pump), resolution = SOURCE_RESOLUTION_M[sourceKey] || 30;
    const corridorM = Math.max(resolution * 4, Math.min(350, Math.max(60, distanceM * 0.28)));
    const plan = root.abearcGravityBuildPlan(source, pump, { sourceKey, corridorM, spacingM: Math.max(resolution * 1.6, 8), budget: sourceKey === 'namria-dtm5-prs92' ? 3600 : 1800 });
    const terrain = await fetchElevations(plan.locations, sourceKey, signal, alignment === 'terrain-following' ? progressStart : directEnd, progressEnd - Math.max(1, (progressEnd-progressStart)*0.18), installation === 'elevated-supports' ? 'Routing elevated drive pipe' : 'Routing descending drive pipe');
    let indexes = null;
    if (installation === 'elevated-supports' && !longDriveSupply) {
      const frame = core().localFrame([source, pump]), a = frame.project(source), b = frame.project(pump), dx = b[0]-a[0], dy = b[1]-a[1], denom = Math.max(1e-9, dx*dx+dy*dy);
      const active = Array.from(plan.activeMask || new Uint8Array(plan.locations.length).fill(1));
      plan.locations.forEach((location, index) => {
        if (!active[index] || !Number.isFinite(Number(terrain.elevations[index]))) return active[index] = 0;
        const xy = frame.project([Number(location.longitude), Number(location.latitude)]);
        const t = ((xy[0]-a[0])*dx + (xy[1]-a[1])*dy) / denom;
        if (t < -0.04 || t > 1.04) return active[index] = 0;
        const clamped = Math.max(0, Math.min(1, t));
        const pipeElevationM = Number(options.sourceElevationM) + (Number(options.pumpElevationM)-Number(options.sourceElevationM))*clamped;
        const supportHeightM = pipeElevationM - Number(terrain.elevations[index]);
        if (supportHeightM < -0.35 || supportHeightM > Number(options.maxSupportHeightM || 6) + 0.25) active[index] = 0;
      });
      active[plan.startIndex] = 1; active[plan.endIndex] = 1; plan.activeMask = active;
      indexes = core().deliveryRouteAStar(plan, terrain.elevations, { ascentPenalty:3, highPointPenalty:4, slopePenalty:1.2 });
    } else indexes = longDriveSupply
      ? core().deliveryRouteAStar(plan, terrain.elevations, { ascentPenalty:1.2, highPointPenalty:1.5, slopePenalty:0.6 })
      : root.abearcGravityFindPathOnGrid(plan, terrain.elevations);
    if (!indexes?.length) return null;
    const route = core().simplifyRoute(routePlanPoints(plan, indexes), Math.max(2, plan.spacingM * 0.45));
    if (route.length < 2) return null;
    if (longDriveSupply) {
      const split = splitRouteByTailLength(route, maxDriveLengthM * 0.995);
      const inspection = await inspectDriveRoute(split.driveRoute, sourceKey, signal, Math.max(progressStart, progressEnd - Math.max(1, (progressEnd-progressStart)*0.18)), progressEnd, { ...options, useRouteStartElevation:true });
      if (!inspection.feasible) return null;
      return { route, straight:split.driveRoute.length === 2, supplyStraight:split.supplyRoute.length <= 2, strategy:installation === 'elevated-supports' ? 'routed-supply-elevated-drive' : 'routed-supply-ground-drive', supportAnalysis:inspection.support, longDriveSupply:true };
    }
    if (installation === 'elevated-supports') {
      const inspection = await inspectDriveRoute(route, sourceKey, signal, Math.max(progressStart, progressEnd - Math.max(1, (progressEnd-progressStart)*0.18)), progressEnd, options);
      if (!inspection.feasible) return null;
      return { route, straight:route.length === 2, strategy:'routed-elevated', supportAnalysis:inspection.support };
    }
    return { route, straight:route.length === 2, strategy:'routed-ground', supportAnalysis:null };
  }

  async function routeDeliveryPipe(pump, destination, sourceKey, signal, progressStart, progressEnd) {
    const distanceM = core().haversineMetres(pump, destination), resolution = SOURCE_RESOLUTION_M[sourceKey] || 30;
    const corridorM = Math.max(resolution * 4, Math.min(500, Math.max(80, distanceM * 0.3)));
    const plan = root.abearcGravityBuildPlan(pump, destination, { sourceKey, corridorM, spacingM: Math.max(resolution * 1.8, 10), budget: sourceKey === 'namria-dtm5-prs92' ? 3200 : 1600 });
    const terrain = await fetchElevations(plan.locations, sourceKey, signal, progressStart, progressEnd, 'Routing delivery pipe');
    const indexes = core().deliveryRouteAStar(plan, terrain.elevations);
    if (!indexes?.length) return [pump, destination];
    const route = core().simplifyRoute(routePlanPoints(plan, indexes), Math.max(3, plan.spacingM * 0.55));
    return route.length >= 2 ? route : [pump, destination];
  }

  function noCandidateAssessment(grid, elevations, sourceElevationM, destinationElevationM, minDriveHeadM, maxDeliveryLiftM = 180) {
    const valid = elevations.filter(Number.isFinite), minimum = valid.length ? Math.min(...valid) : NaN;
    const maximumDrop = Number.isFinite(minimum) ? sourceElevationM - minimum : 0;
    const reasons = [];
    if (!(maximumDrop >= minDriveHeadM)) reasons.push(`Insufficient terrain drop: the search area provides only about ${format(Math.max(0, maximumDrop))} m below the source, less than the ${format(minDriveHeadM)} m minimum drive head.`);
    else {
      const lowerSites = valid.map(elevation => ({ drive: sourceElevationM - elevation, delivery: destinationElevationM - elevation })).filter(item => item.drive >= minDriveHeadM && item.delivery > 0.25);
      const minimumDeliveryLift = lowerSites.length ? Math.min(...lowerSites.map(item => item.delivery)) : Infinity;
      if (Number.isFinite(minimumDeliveryLift) && minimumDeliveryLift > maxDeliveryLiftM) reasons.push(`The lowest practical delivery lift found is about ${format(minimumDeliveryLift)} m, above the configured ${format(maxDeliveryLiftM, 0)} m maximum delivery lift.`);
      else {
        const bestRatio = lowerSites.reduce((best, item) => item.delivery <= maxDeliveryLiftM ? Math.min(best, item.delivery / item.drive) : best, Infinity);
        if (!Number.isFinite(bestRatio) || bestRatio > 20) reasons.push('Available lower terrain would require an excessive delivery-head-to-drive-head ratio for a practical preliminary ram-pump arrangement.');
        else reasons.push('Lower terrain exists, but no candidate satisfied the combined drive-head, drive-pipe length/slope, delivery-lift, and practical routing criteria.');
      }
    }
    if (!grid?.locations?.length) reasons.push('No terrain samples were available around the selected source and destination.');
    return { level: 'not-feasible', title: 'No Practical Ram Pump Layout Found', reasons };
  }

  async function generateAbearcRamPumpSystemLayout() {
    const c = core(); if (!c) return toast('Ram-pump calculation module is unavailable. Refresh the page and try again.', 'error');
    const record = selectedMeasurement(), points = geometry(record);
    if (!record || points.length < 2) return toast('Select a completed Distance measurement first.', 'error');
    rememberChange(); cancelAbearcRamPumpOperation();
    operationAbort = new AbortController(); const signal = operationAbort.signal, serial = ++operationSerial;
    const inputs = readUiInputs(), sourceKey = safeSource(document.querySelector('[data-ram-elevation-source]')?.value || abearcMapElevationSource);
    const source = points[0], destination = points[points.length - 1];
    state = defaultState(); state.measurementId = String(record.id || ''); state.name = `${record.name || 'Distance'} · Ram Pump Layout`; state.inputs = inputs; state.elevationSource = sourceKey; state.source = source; state.destination = destination;
    renderResults(); clearOverlayOnly();
    try {
      setProgress(3, 'Reading endpoints', 'Sampling source and service-area elevations.');
      const endpoints = await fetchElevations([source, destination], sourceKey, signal, 3, 8, 'Reading endpoint elevations');
      if (serial !== operationSerial) throw new DOMException('Request superseded', 'AbortError');
      const sourceElevationM = endpoints.elevations[0], destinationElevationM = endpoints.elevations[1]; state.elevationSource = endpoints.sourceKey; state.elevationSourceLabel = endpoints.sourceLabel;
      const directDistanceM = c.haversineMetres(source, destination), resolution = SOURCE_RESOLUTION_M[state.elevationSource] || 30;
      const halfWidthM = Math.max(120, Math.min(1000, Math.max(directDistanceM * 0.42, resolution * 8)));
      const polygon = c.corridorPolygon(source, destination, halfWidthM);
      const grid = c.createGridPlan(polygon, { maxSamples: state.elevationSource === 'namria-dtm5-prs92' ? 2200 : 1200, preferredSpacingM: Math.max(resolution, Math.min(35, Math.max(8, directDistanceM / 70))) });
      setProgress(10, 'Analyzing surrounding terrain', `Searching roughly ±${Math.round(halfWidthM)} m around the source-to-destination intent line.`);
      const terrain = await fetchElevations(grid.locations, state.elevationSource, signal, 10, 42, 'Searching potential ram-pump sites');
      state.elevationSource = terrain.sourceKey; state.elevationSourceLabel = terrain.sourceLabel || state.elevationSourceLabel;
      const s2Ref = c.PEACE_CORPS_S2 || {}, s2Basis = inputs.designBasis === 'peace-corps-s2';
      const candidateMinDriveHeadM = s2Basis ? Math.max(inputs.minDriveHeadM, Number(s2Ref.driveHeadMinM || 2)) : inputs.minDriveHeadM;
      const candidateMaxDeliveryLiftM = s2Basis ? Math.min(inputs.maxDeliveryLiftM, Number(s2Ref.deliveryHeadMaxM || 100)) : inputs.maxDeliveryLiftM;
      const rawCandidates = c.findRamPumpCandidates({ grid, elevations: terrain.elevations, sourcePoint: source, destinationPoint: destination, sourceElevationM, destinationElevationM,
        minDriveHeadM: candidateMinDriveHeadM,
        maxDriveHeadM: s2Basis ? Number(s2Ref.driveHeadMaxM || 15) : 30,
        maxDeliveryHeadM: candidateMaxDeliveryLiftM, maxHeadRatio: 20, maxCandidates: 10 });
      if (!rawCandidates.length) {
        state.pump = null; state.driveRoute = []; state.deliveryRoute = []; state.candidates = []; state.selectedCandidateIndex = 0; state.profile = []; state.pumpChainageM = 0; state.metrics = null; state.annotations = {}; state.generatedAt = '';
        state.assessment = noCandidateAssessment(grid, terrain.elevations, sourceElevationM, destinationElevationM, candidateMinDriveHeadM, candidateMaxDeliveryLiftM); state.updatedAt = now(); renderResults(); syncRamPumpMeasurementVisibility(true); renderAbearcRamPumpOverlay(); hideProgress(); return toast(state.assessment.title, 'error');
      }

      const routed = [];
      const attempts = Math.min(6, rawCandidates.length);
      for (let index = 0; index < attempts; index++) {
        if (signal.aborted) throw new DOMException('Calculation cancelled', 'AbortError');
        const candidate = rawCandidates[index], base = 44 + index * (38 / attempts);
        setProgress(base, `Evaluating pump-site candidate ${index + 1}`, `Drive head ${candidate.driveHeadM.toFixed(2)} m · head ratio ${candidate.headRatio.toFixed(2)}.`);
        const candidateSourceFlow = inputs.desiredDeliveryFlowLps > 0
          ? Math.max(0.0001, inputs.desiredDeliveryFlowLps * Math.max(0.25, candidate.deliveryHeadM) / Math.max(1e-6, inputs.efficiency * Math.max(0.01, candidate.driveHeadM)))
          : Math.max(0.0001, inputs.sourceFlowLps);
        const candidateDriveDistanceM = c.haversineMetres(source, candidate.location);
        const candidateS2Diameter = inputs.designBasis === 'peace-corps-s2' && !(inputs.drivePipeDiameterMm > 0) ? c.peaceCorpsS2DriveDiameterMm?.(candidateSourceFlow) : null;
        const candidateDriveDiameter = inputs.drivePipeDiameterMm > 0 ? inputs.drivePipeDiameterMm : (candidateS2Diameter || c.selectPipeDiameter({ flowLps:candidateSourceFlow, lengthM:candidateDriveDistanceM, coefficient:inputs.hazenWilliamsC, maxHeadlossPercent:8 })?.diameterMm);
        const candidateLengthLimits = inputs.driveLengthRule === 'peace-corps' && candidateDriveDiameter ? c.peaceCorpsDrivePipeLengthLimits?.(candidateDriveDiameter) : null;
        const allowLongDriveSupply = Boolean(candidateLengthLimits?.maxM && inputs.longDriveTreatment !== 'none' && candidateDriveDistanceM > candidateLengthLimits.maxM);
        const drivePlan = await routeDrivePipe(source, candidate.location, state.elevationSource, signal, base, base + 4.5, {
          installation:inputs.driveInstallation, alignment:inputs.driveAlignment, maxSupportHeightM:inputs.maxSupportHeightM,
          sourceElevationM, pumpElevationM:candidate.pumpElevationM,
          allowLongDriveSupply, maxDriveLengthM:candidateLengthLimits?.maxM || 0
        });
        const driveRoute = drivePlan?.route;
        if (!driveRoute) continue;
        const deliveryRoute = await routeDeliveryPipe(candidate.location, destination, state.elevationSource, signal, base + 4.5, base + 7.5);
        const driveLengthM = c.lineDistanceMetres(driveRoute), deliveryLengthM = c.lineDistanceMetres(deliveryRoute);
        const straightBonus = drivePlan.straight ? 0.45 : 0;
        routed.push({ ...candidate, driveRoute, deliveryRoute, driveDistanceM: driveLengthM, deliveryDistanceM: deliveryLengthM, driveStrategy:drivePlan.strategy, driveRouteStraight:Boolean(drivePlan.straight), supportAnalysis:drivePlan.supportAnalysis || null,
          score: candidate.score + straightBonus - (driveLengthM + deliveryLengthM) / Math.max(1, directDistanceM) * 0.18 });
      }
      if (!routed.length) {
        state.pump = null; state.driveRoute = []; state.deliveryRoute = []; state.candidates = []; state.selectedCandidateIndex = 0; state.profile = []; state.pumpChainageM = 0; state.metrics = null; state.annotations = {}; state.generatedAt = '';
        state.assessment = inputs.driveInstallation === 'elevated-supports'
          ? { level: 'not-feasible', title: 'No Practical Ram Pump Layout Found', reasons: [
              `Potential lower pump sites were identified, but no elevated drive-pipe alignment could maintain a continuous descending grade within the ${format(inputs.maxSupportHeightM,1)} m support-height planning limit.`,
              'Support frames can bridge low or undulating ground beneath the drive pipe, but they cannot make the pipe pass through terrain that rises above the required descending pipe grade. Try another pump site/alignment, increase the support-height planning limit only if structurally reasonable, or consider a cut/trench at the obstructing high ground.'
            ] }
          : { level: 'not-feasible', title: 'No Practical Ram Pump Layout Found', reasons: [
              'Potential lower pump sites were identified, but none could be connected from the water source by a continuously descending on-ground drive-pipe route on the selected terrain surface.',
              'Try Elevated on support frames, a different source point, a wider field-aligned measurement, or another supported elevation source if the current DEM does not represent the local channel accurately.'
            ] };
        state.updatedAt = now(); renderResults(); syncRamPumpMeasurementVisibility(true); renderAbearcRamPumpOverlay(); hideProgress(); return toast(state.assessment.title, 'error');
      }
      routed.sort((a, b) => b.score - a.score); state.candidates = routed.slice(0, 3); state.selectedCandidateIndex = 0;
      state.pump = [...state.candidates[0].location]; state.driveRoute = clone(state.candidates[0].driveRoute); state.deliveryRoute = clone(state.candidates[0].deliveryRoute); state.generatedAt = now(); state.updatedAt = now();
      setProgress(84, 'Calculating hydraulic performance', 'Sampling the final drive and delivery routes and checking preliminary pipe sizing.');
      await recalculateAbearcRamPumpLayout({ remember: false, signal, progressStart: 84, progressEnd: 98, quiet: true });
      syncRamPumpMeasurementVisibility();
      setProgress(100, 'Ram-pump layout ready', state.assessment?.title || 'Preliminary engineering layout generated.');
      setTimeout(() => { if (serial === operationSerial) hideProgress(); }, 700);
      toast(state.assessment?.title || 'Ram-pump system layout generated');
    } catch (error) {
      hideProgress();
      if (error?.name === 'AbortError') return toast('Ram-pump analysis cancelled');
      console.error('Ram-pump system layout failed', error);
      if (state) {
        state.assessment = { level: 'not-feasible', title: 'Ram Pump Layout Could Not Be Generated', reasons: [String(error.message || 'Terrain analysis failed.')] };
        state.updatedAt = now(); renderResults(); syncRamPumpMeasurementVisibility(true); renderAbearcRamPumpOverlay();
      }
      toast(error.message || 'Ram-pump layout could not be generated.', 'error');
    } finally { if (operationAbort?.signal === signal) operationAbort = null; }
  }

  function splitRouteByTailLength(route, tailLengthM) {
    const clean = sanitizeRoute(route, 5000);
    const totalLengthM = core()?.lineDistanceMetres(clean) || 0;
    if (clean.length < 2 || !(tailLengthM > 0) || tailLengthM >= totalLengthM - 0.05) {
      return { point: clean[0] || null, stationChainageM: 0, supplyRoute: clean.slice(0,1), driveRoute: clean, supplyLengthM: 0, driveLengthM: totalLengthM };
    }
    const targetChainageM = Math.max(0, totalLengthM - tailLengthM);
    let walked = 0;
    const supplyRoute = [clean[0]], driveRoute = [];
    for (let index = 1; index < clean.length; index++) {
      const a = clean[index-1], b = clean[index], segmentM = core().haversineMetres(a,b);
      if (walked + segmentM >= targetChainageM) {
        const ratio = segmentM > 0 ? (targetChainageM - walked) / segmentM : 0;
        const point = [a[0] + (b[0]-a[0]) * ratio, a[1] + (b[1]-a[1]) * ratio];
        if (core().haversineMetres(supplyRoute.at(-1), point) > 0.01) supplyRoute.push(point);
        driveRoute.push(point, ...clean.slice(index));
        return { point, stationChainageM: targetChainageM, supplyRoute, driveRoute, supplyLengthM: targetChainageM, driveLengthM: totalLengthM-targetChainageM };
      }
      supplyRoute.push(b); walked += segmentM;
    }
    return { point: clean[0], stationChainageM: 0, supplyRoute: clean.slice(0,1), driveRoute: clean, supplyLengthM: 0, driveLengthM: totalLengthM };
  }

  function profileElevationAt(profile, chainageM) {
    const items = Array.isArray(profile) ? profile : [];
    if (!items.length) return NaN;
    const target = Math.max(0, Number(chainageM) || 0);
    for (let index=1; index<items.length; index++) {
      const a=items[index-1], b=items[index];
      if (target <= Number(b.chainageM)) {
        const span=Math.max(1e-9,Number(b.chainageM)-Number(a.chainageM));
        const t=Math.max(0,Math.min(1,(target-Number(a.chainageM))/span));
        return Number(a.elevationM)+(Number(b.elevationM)-Number(a.elevationM))*t;
      }
    }
    return Number(items.at(-1)?.elevationM);
  }

  function sliceProfileFromChainage(profile, startChainageM) {
    const items = Array.isArray(profile) ? profile : [];
    const start = Math.max(0, Number(startChainageM) || 0);
    if (!items.length || start <= 0) return items.map(item => ({ ...item, chainageM:Number(item.chainageM || 0), originalChainageM:Number(item.chainageM || 0) }));
    const result = [];
    const startElevation = profileElevationAt(items, start);
    result.push({ chainageM:0, originalChainageM:start, elevationM:startElevation });
    for (const item of items) {
      const ch=Number(item.chainageM || 0);
      if (ch > start + 1e-6) result.push({ ...item, chainageM:ch-start, originalChainageM:ch });
    }
    return result;
  }

  function drivePipeLengthControl(route, profile, diameterMm, inputs, sourceElevationM) {
    const totalLengthM = core()?.lineDistanceMetres(route) || 0;
    const enabled = inputs.driveLengthRule === 'peace-corps' && Number(diameterMm) > 0;
    if (!enabled) return { enabled:false, totalLengthM, effectiveDriveLengthM:totalLengthM, supplyLengthM:0, requiresDevice:false, deviceType:'none', status:'manufacturer-review' };
    const limits = core().peaceCorpsDrivePipeLengthLimits?.(diameterMm) || {minM:NaN,maxM:NaN};
    const minM=Number(limits.minM), maxM=Number(limits.maxM);
    const tooShort=Number.isFinite(minM) && totalLengthM < minM - 0.05;
    const tooLong=Number.isFinite(maxM) && totalLengthM > maxM + 0.05;
    const treatment = inputs.longDriveTreatment || 'auto-standpipe';
    const deviceType = tooLong && treatment !== 'none' ? (treatment === 'drive-tank' ? 'drive-tank' : 'standpipe') : 'none';
    const split = deviceType !== 'none' ? splitRouteByTailLength(route, Math.max(minM, maxM * 0.995)) : { point:null,stationChainageM:0,supplyRoute:[],driveRoute:route,supplyLengthM:0,driveLengthM:totalLengthM };
    const localElevationM = deviceType !== 'none' ? profileElevationAt(profile, split.stationChainageM) : NaN;
    const topElevationM = deviceType !== 'none' ? Number(sourceElevationM) + Number(core()?.PEACE_CORPS_S2?.standpipeFreeboardM || 0.3) : NaN;
    const standpipeDiameterMm = deviceType !== 'none' ? core().nextStandardDiameterMm?.(Number(diameterMm) + Number(core()?.PEACE_CORPS_S2?.standpipeOversizeMm || 25.4)) : null;
    const supplyPipeDiameterMm = deviceType !== 'none' ? core().nextStandardDiameterMm?.(Number(diameterMm) + Number(core()?.PEACE_CORPS_S2?.supplyPipeOversizeMm || 12.7)) : null;
    return {
      enabled:true, rule:'Peace Corps / Warwick S-2 150D–1000D', totalLengthM, minM, maxM, tooShort, tooLong,
      requiresDevice:tooLong, deviceType, treatment, effectiveDriveLengthM:deviceType !== 'none' ? split.driveLengthM : totalLengthM,
      supplyLengthM:deviceType !== 'none' ? split.supplyLengthM : 0, stationChainageM:deviceType !== 'none' ? split.stationChainageM : null,
      point:deviceType !== 'none' ? split.point : null, supplyRoute:deviceType !== 'none' ? split.supplyRoute : [], effectiveDriveRoute:deviceType !== 'none' ? split.driveRoute : sanitizeRoute(route,5000),
      localElevationM, topElevationM, riserHeightM:Number.isFinite(localElevationM) ? Math.max(0,topElevationM-localElevationM) : NaN,
      standpipeDiameterMm, supplyPipeDiameterMm,
      status:tooShort?'too-short':tooLong?(deviceType!=='none'?'device-required-and-added':'too-long-unresolved'):'within-range'
    };
  }

  function profileAscent(profile) {
    let total = 0, maximumStep = 0;
    for (let i = 1; i < profile.length; i++) { const rise = Number(profile[i].elevationM) - Number(profile[i - 1].elevationM); if (rise > 0) { total += rise; maximumStep = Math.max(maximumStep, rise); } }
    return { total, maximumStep };
  }

  function buildAssessment(metrics, inputs, driveProfile) {
    const hard = [], review = [], ascent = profileAscent(driveProfile);
    if (!(metrics.driveHeadM >= inputs.minDriveHeadM)) hard.push(`Available drive head is ${format(metrics.driveHeadM)} m, below the configured ${format(inputs.minDriveHeadM)} m minimum.`);
    const governingLift = Math.max(Number(metrics.deliveryHeadM) || 0, Number(metrics.deliveryHighPointLiftM) || 0);
    if (governingLift > inputs.maxDeliveryLiftM + 1e-6) hard.push(`Required delivery lift reaches ${format(governingLift)} m, above the configured ${format(inputs.maxDeliveryLiftM, 0)} m maximum.`);
    if (Number(inputs.desiredDeliveryFlowLps || 0) > 0 && !(Number.isFinite(metrics.requiredSourceFlow?.requiredSourceFlowLps) && metrics.requiredSourceFlow.requiredSourceFlowLps > 0)) hard.push('No finite required source flow could satisfy the requested delivery flow with the current heads and pipe friction. Increase drive head, reduce delivery lift/flow, or revise the pipe sizes.');
    const driveControl = metrics.drivePipeControl || {};
    const s2 = inputs.designBasis === 'peace-corps-s2', s2Ref = core()?.PEACE_CORPS_S2 || {};
    if (s2) {
      const sourceLpm = Number(inputs.sourceFlowLps || 0) * 60;
      if (sourceLpm < Number(s2Ref.sourceFlowMinLpm || 40) - 1e-6 || sourceLpm > Number(s2Ref.sourceFlowMaxLpm || 120) + 1e-6) hard.push(`Peace Corps / Warwick S-2 reference flow range is ${format(s2Ref.sourceFlowMinLpm || 40,0)}–${format(s2Ref.sourceFlowMaxLpm || 120,0)} L/min; the current design uses ${format(sourceLpm,1)} L/min.`);
      if (metrics.driveHeadM < Number(s2Ref.driveHeadMinM || 2) - 1e-6 || metrics.driveHeadM > Number(s2Ref.driveHeadMaxM || 15) + 1e-6) hard.push(`S-2 reference drive head is ${format(s2Ref.driveHeadMinM || 2,0)}–${format(s2Ref.driveHeadMaxM || 15,0)} m; this site provides ${format(metrics.driveHeadM,2)} m.`);
      if (governingLift > Number(s2Ref.deliveryHeadMaxM || 100) + 1e-6) hard.push(`S-2 reference delivery head is limited to about ${format(s2Ref.deliveryHeadMaxM || 100,0)} m; this layout reaches ${format(governingLift,2)} m.`);
      const chartDiameter = core()?.peaceCorpsS2DriveDiameterMm?.(inputs.sourceFlowLps);
      if (chartDiameter && Math.abs(Number(metrics.drivePipe?.diameterMm || 0) - chartDiameter) > 1.5) review.push(`S-2 Table 2 suggests about ${format(chartDiameter,1)} mm (${format(chartDiameter/25.4,1)} in) drive pipe for this source flow; the current design uses Ø${format(metrics.drivePipe?.diameterMm,1)} mm.`);
    }
    if (driveControl.enabled) {
      const material = String(inputs.pipeMaterial || '').toLowerCase();
      if (/\bhdpe\b|polyethylene|\bpe\b/.test(material)) review.push('The Peace Corps design basis requires a rigid drive pipe for effective water-hammer transmission. HDPE/PE can flex unless specifically restrained and engineered; verify drive-pipe rigidity, transient-pressure capacity and anchorage or use a suitably rigid pressure pipe.');
      if (driveControl.tooShort) (s2 ? hard : review).push(`Rigid drive-pipe length ${format(driveControl.totalLengthM,1)} m is below the Peace Corps 150D minimum of ${format(driveControl.minM,1)} m for Ø${format(metrics.drivePipe?.diameterMm,1)} mm.`);
      if (driveControl.tooLong && driveControl.deviceType === 'none') (s2 ? hard : review).push(`Source-to-pump run ${format(driveControl.totalLengthM,1)} m exceeds the Peace Corps 1000D maximum of ${format(driveControl.maxM,1)} m. Add a standpipe/drive tank or verify a different manufacturer-specific drive-pipe rule.`);
      if (driveControl.deviceType !== 'none') review.push(`${driveControl.deviceType === 'drive-tank' ? 'Drive tank' : 'Standpipe'} inserted at about chainage ${format(driveControl.stationChainageM,1)} m so the effective rigid drive pipe is ${format(driveControl.effectiveDriveLengthM,1)} m (reference range ${format(driveControl.minM,1)}–${format(driveControl.maxM,1)} m). Survey the device elevation and verify the upstream supply-pipe capacity.`);
    }
    if (inputs.driveInstallation === 'elevated-supports') {
      const support = metrics.driveSupport || {};
      if (Number(support.terrainIntrusionM || 0) > Number(support.terrainToleranceM || 0.35) + 1e-6) hard.push(`The elevated descending drive-pipe grade intersects terrain by up to ${format(support.terrainIntrusionM,2)} m. Support frames only raise the pipe above low ground; a cut/trench, reroute, or different pump site is required where terrain rises above the pipe grade.`);
      if (Number(support.maxRequiredSupportHeightM || 0) > Number(inputs.maxSupportHeightM || 0) + 0.25) hard.push(`The elevated drive pipe requires support frames up to about ${format(support.maxRequiredSupportHeightM,2)} m, above the configured ${format(inputs.maxSupportHeightM,1)} m planning limit.`);
      if (inputs.driveAlignment === 'straight-only' && !metrics.driveRouteStraight) hard.push('Straight-only drive-pipe alignment is selected, but the edited drive route contains one or more bends.');
      else if (inputs.driveAlignment === 'straight-preferred' && !metrics.driveRouteStraight) review.push(`The generated/edited drive pipe contains ${metrics.driveBendCount} bend${metrics.driveBendCount === 1 ? '' : 's'}. A straight rigid drive pipe is preferred for ram-pump service; keep bends only where site constraints require them.`);
    } else {
      if (ascent.total > 0.35 || ascent.maximumStep > 0.20) hard.push(`The edited on-ground drive-pipe route is not continuously descending on the selected terrain surface (${format(ascent.total, 2)} m sampled ascent). Switch to Elevated on support frames if a continuously descending pipe grade can be supported above the uneven ground.`);
      if (inputs.driveAlignment === 'straight-only' && !metrics.driveRouteStraight) hard.push('Straight-only drive-pipe alignment is selected, but the edited drive route contains one or more bends.');
      else if (inputs.driveAlignment === 'straight-preferred' && !metrics.driveRouteStraight) review.push(`The generated/edited drive pipe contains ${metrics.driveBendCount} bend${metrics.driveBendCount === 1 ? '' : 's'}. Straight/no-turn alignment is preferred when terrain permits.`);
    }
    if (!(metrics.deliveryHeadM > metrics.driveHeadM)) review.push('Delivery head is not substantially greater than drive head; confirm that a ram pump is the appropriate conveyance method for this site.');
    if (metrics.headRatio > 20) hard.push(`Delivery-head / drive-head ratio is ${format(metrics.headRatio, 1)}, above the preliminary planning limit of 20 used by this tool.`);
    else if (metrics.headRatio > 12) review.push(`Delivery-head / drive-head ratio is high at ${format(metrics.headRatio, 1)}; verify the selected ram-pump model against manufacturer performance data.`);
    if (!(metrics.hydraulic?.netDriveHeadM > 0)) hard.push('Estimated drive-pipe friction consumes the available drive head. Increase the drive-pipe diameter, shorten the route, or choose another pump site.');
    if (!(metrics.hydraulic?.deliveredFlowLps > 0.001)) hard.push('Estimated delivered flow is effectively zero with the current source flow, heads, and pipe assumptions.');
    if (inputs.desiredDeliveryFlowLps > 0 && metrics.hydraulic?.deliveredFlowLps + 1e-6 < inputs.desiredDeliveryFlowLps) review.push(`Estimated delivery ${flow(metrics.hydraulic.deliveredFlowLps, 3)} L/min is below the requested ${flow(inputs.desiredDeliveryFlowLps, 3)} L/min.`);
    if (metrics.drivePipe && !metrics.drivePipe.meetsCriteria) review.push('Drive-pipe velocity/friction falls outside the preliminary automatic sizing criteria. Review the selected diameter.');
    if (metrics.deliveryPipe && !metrics.deliveryPipe.meetsCriteria) review.push('Delivery-pipe velocity/friction falls outside the preliminary automatic sizing criteria. Review the selected diameter.');
    if (hard.length) return { level: 'not-feasible', title: 'No Practical Ram Pump Layout Found', reasons: [...hard, ...review] };
    if (review.length) return { level: 'review', title: 'Ram Pump Layout Potentially Feasible — Engineering Review Required', reasons: review };
    return { level: 'feasible', title: 'Ram Pump Layout Feasible — Preliminary', reasons: ['Terrain and preliminary hydraulic checks passed. Verify field elevations, dependable source flow, access, foundation conditions, pipe pressure rating, and the selected ram-pump performance curve before final design.'] };
  }

  async function sampleRouteProfile(route, sourceKey, signal, maxSamples, progressStart, progressEnd, label) {
    const lengthM = core().lineDistanceMetres(route), resolution = SOURCE_RESOLUTION_M[sourceKey] || 30;
    const spacingM = Math.max(2, Math.min(Math.max(resolution, lengthM / Math.max(2, maxSamples - 1)), Math.max(resolution * 2, 25)));
    let points = core().interpolateLine(route, spacingM);
    if (points.length > maxSamples) {
      const step = (points.length - 1) / (maxSamples - 1); points = Array.from({ length: maxSamples }, (_, index) => points[Math.min(points.length - 1, Math.round(index * step))]);
      points[0] = route[0]; points[points.length - 1] = route[route.length - 1];
    }
    const terrain = await fetchElevations(points, sourceKey, signal, progressStart, progressEnd, label);
    return { points, elevations: terrain.elevations, sourceKey: terrain.sourceKey, sourceLabel: terrain.sourceLabel, profile: core().cumulativeProfile(points, terrain.elevations) };
  }

  async function recalculateAbearcRamPumpLayout({ remember = true, signal = null, progressStart = 0, progressEnd = 100, quiet = false } = {}) {
    if (!state?.source || !state?.pump || !state?.destination || state.driveRoute.length < 2 || state.deliveryRoute.length < 2) return false;
    if (remember) rememberChange();
    const ownController = !signal ? new AbortController() : null; signal = signal || ownController.signal;
    if (remember) { operationAbort?.abort(); operationAbort = ownController; }
    state.inputs = readUiInputs(); state.elevationSource = safeSource(document.querySelector('[data-ram-elevation-source]')?.value || state.elevationSource);
    try {
      const span = progressEnd - progressStart;
      setProgress(progressStart, 'Recalculating ram-pump layout', 'Sampling edited drive-pipe terrain.');
      const drive = await sampleRouteProfile(state.driveRoute, state.elevationSource, signal, 110, progressStart, progressStart + span * 0.48, 'Checking drive-pipe terrain');
      const delivery = await sampleRouteProfile(state.deliveryRoute, drive.sourceKey, signal, 110, progressStart + span * 0.48, progressStart + span * 0.86, 'Checking delivery-pipe terrain');
      const driveLengthM = core().lineDistanceMetres(state.driveRoute), deliveryLengthM = core().lineDistanceMetres(state.deliveryRoute);
      const sourceElevationM = Number(drive.elevations[0]), pumpElevationM = Number(drive.elevations.at(-1)), destinationElevationM = Number(delivery.elevations.at(-1));
      const driveHeadM = sourceElevationM - pumpElevationM, deliveryHeadM = destinationElevationM - pumpElevationM, headRatio = driveHeadM > 0 ? deliveryHeadM / driveHeadM : Infinity;
      const inputs = state.inputs, desiredFlow = Math.max(0, Number(inputs.desiredDeliveryFlowLps || 0));
      let sourceFlow = desiredFlow > 0
        ? desiredFlow * Math.max(0.25, deliveryHeadM) / Math.max(1e-6, inputs.efficiency * Math.max(0.01, driveHeadM))
        : Math.max(0, Number(inputs.sourceFlowLps || 0));
      sourceFlow = Math.max(0.0001, sourceFlow);

      const s2AutoDiameter = inputs.designBasis === 'peace-corps-s2' && !(inputs.drivePipeDiameterMm > 0)
        ? core().peaceCorpsS2DriveDiameterMm?.(sourceFlow)
        : null;
      const initialDriveDiameterMm = inputs.drivePipeDiameterMm > 0 ? inputs.drivePipeDiameterMm : s2AutoDiameter;
      let drivePipe = initialDriveDiameterMm
        ? core().evaluatePipe({ flowLps: sourceFlow, lengthM: driveLengthM, diameterMm: initialDriveDiameterMm, coefficient: inputs.hazenWilliamsC })
        : core().selectPipeDiameter({ flowLps: sourceFlow, lengthM: driveLengthM, coefficient: inputs.hazenWilliamsC, maxHeadlossPercent: 8 });
      let driveLengthControl = drivePipeLengthControl(state.driveRoute, drive.profile, drivePipe?.diameterMm, inputs, sourceElevationM);
      let effectiveDriveLengthM = Number(driveLengthControl?.effectiveDriveLengthM) > 0 ? Number(driveLengthControl.effectiveDriveLengthM) : driveLengthM;
      if (drivePipe?.diameterMm) {
        drivePipe = core().evaluatePipe({ flowLps: sourceFlow, lengthM: effectiveDriveLengthM, diameterMm: drivePipe.diameterMm, coefficient: inputs.hazenWilliamsC });
        drivePipe.meetsCriteria = Boolean(drivePipe.meetsCriteria && drivePipe.headlossPercent <= 8);
      }

      const ideal = core().ramPumpSizing({ sourceFlowLps: sourceFlow, driveHeadM, deliveryHeadM, efficiency: inputs.efficiency, drivePipeLengthM: effectiveDriveLengthM, drivePipeDiameterMm: drivePipe?.diameterMm, operatingHours: inputs.operatingHours, hazenWilliamsC: inputs.hazenWilliamsC });
      const sizingFlow = Math.max(0.0001, desiredFlow || ideal.deliveredFlowLps);
      let deliveryPipe = inputs.deliveryPipeDiameterMm > 0
        ? core().evaluatePipe({ flowLps: sizingFlow, lengthM: deliveryLengthM, diameterMm: inputs.deliveryPipeDiameterMm, coefficient: inputs.hazenWilliamsC, minVelocityMps: 0.15 })
        : core().selectPipeDiameter({ flowLps: sizingFlow, lengthM: deliveryLengthM, coefficient: inputs.hazenWilliamsC, minVelocityMps: 0.15, maxVelocityMps: 2.5, maxHeadlossPercent: 8 });
      let requiredSourceFlow = null;
      if (desiredFlow > 0) {
        const solveRequiredSource = diameterMm => {
          const control = drivePipeLengthControl(state.driveRoute, drive.profile, diameterMm, inputs, sourceElevationM);
          const frictionLengthM = Number(control?.effectiveDriveLengthM) > 0 ? Number(control.effectiveDriveLengthM) : driveLengthM;
          const required = core().requiredSourceFlowForDelivery({
            desiredDeliveryFlowLps: desiredFlow, driveHeadM, deliveryHeadM, efficiency: inputs.efficiency,
            drivePipeLengthM: frictionLengthM, drivePipeDiameterMm: diameterMm, deliveryPipeLengthM: deliveryLengthM, deliveryPipeDiameterMm: deliveryPipe?.diameterMm,
            hazenWilliamsC: inputs.hazenWilliamsC
          });
          return { required, control, frictionLengthM };
        };
        if (inputs.drivePipeDiameterMm > 0 || s2AutoDiameter) {
          let diameterMm = inputs.drivePipeDiameterMm > 0 ? inputs.drivePipeDiameterMm : s2AutoDiameter;
          let solved = solveRequiredSource(diameterMm);
          if (!(inputs.drivePipeDiameterMm > 0) && inputs.designBasis === 'peace-corps-s2' && Number.isFinite(solved.required?.requiredSourceFlowLps)) {
            const revisedDiameter = core().peaceCorpsS2DriveDiameterMm?.(solved.required.requiredSourceFlowLps);
            if (revisedDiameter && Math.abs(revisedDiameter - diameterMm) > 0.5) { diameterMm = revisedDiameter; solved = solveRequiredSource(diameterMm); }
          }
          requiredSourceFlow = solved.required; driveLengthControl = solved.control; effectiveDriveLengthM = solved.frictionLengthM;
          sourceFlow = Number.isFinite(requiredSourceFlow?.requiredSourceFlowLps) && requiredSourceFlow.requiredSourceFlowLps > 0 ? requiredSourceFlow.requiredSourceFlowLps : 0;
          drivePipe = core().evaluatePipe({ flowLps: Math.max(0.0001, sourceFlow), lengthM: effectiveDriveLengthM, diameterMm, coefficient: inputs.hazenWilliamsC });
          drivePipe.meetsCriteria = Boolean(drivePipe.meetsCriteria && drivePipe.headlossPercent <= 8 && requiredSourceFlow?.netDriveHeadM > 0);
        } else {
          let fallback = null, selected = null;
          for (const diameterMm of (core().STANDARD_HDPE_DIAMETERS_MM || [])) {
            const solved = solveRequiredSource(diameterMm), required = solved.required;
            if (!Number.isFinite(required?.requiredSourceFlowLps) || !(required.requiredSourceFlowLps > 0) || !(required.netDriveHeadM > 0)) continue;
            const pipe = core().evaluatePipe({ flowLps: required.requiredSourceFlowLps, lengthM: solved.frictionLengthM, diameterMm, coefficient: inputs.hazenWilliamsC });
            pipe.meetsCriteria = Boolean(pipe.meetsCriteria && pipe.headlossPercent <= 8 && required.driveLossM < driveHeadM);
            const penalty = Math.max(0, pipe.velocityMps - 2.5) * 8 + Math.max(0, 0.25 - pipe.velocityMps) * 5 + Math.max(0, pipe.headlossPercent - 8) * 2 + required.driveLossM / Math.max(0.1, driveHeadM);
            const candidate = { pipe, required, control:solved.control, frictionLengthM:solved.frictionLengthM, penalty };
            if (!fallback || candidate.penalty < fallback.penalty) fallback = candidate;
            if (pipe.meetsCriteria) { selected = candidate; break; }
          }
          const choice = selected || fallback;
          drivePipe = choice?.pipe || drivePipe; requiredSourceFlow = choice?.required || null; driveLengthControl = choice?.control || driveLengthControl; effectiveDriveLengthM = choice?.frictionLengthM || effectiveDriveLengthM;
          sourceFlow = Number.isFinite(requiredSourceFlow?.requiredSourceFlowLps) && requiredSourceFlow.requiredSourceFlowLps > 0 ? requiredSourceFlow.requiredSourceFlowLps : 0;
        }
        inputs.sourceFlowLps = sourceFlow;
        state.inputs.sourceFlowLps = sourceFlow;
        syncSourceFlowField(state.inputs);
      } else {
        driveLengthControl = drivePipeLengthControl(state.driveRoute, drive.profile, drivePipe?.diameterMm, inputs, sourceElevationM);
        effectiveDriveLengthM = Number(driveLengthControl?.effectiveDriveLengthM) > 0 ? Number(driveLengthControl.effectiveDriveLengthM) : driveLengthM;
        if (drivePipe?.diameterMm) {
          drivePipe = core().evaluatePipe({ flowLps: sourceFlow, lengthM: effectiveDriveLengthM, diameterMm: drivePipe.diameterMm, coefficient: inputs.hazenWilliamsC });
          drivePipe.meetsCriteria = Boolean(drivePipe.meetsCriteria && drivePipe.headlossPercent <= 8);
        }
      }
      const hydraulic = core().ramPumpSizing({ sourceFlowLps: sourceFlow, driveHeadM, deliveryHeadM, efficiency: inputs.efficiency,
        drivePipeLengthM: effectiveDriveLengthM, drivePipeDiameterMm: drivePipe?.diameterMm, deliveryPipeLengthM: deliveryLengthM, deliveryPipeDiameterMm: deliveryPipe?.diameterMm,
        hazenWilliamsC: inputs.hazenWilliamsC, operatingHours: inputs.operatingHours });
      const groundDriveProfile = drive.profile.map(item => ({ chainageM:Number(item.chainageM), elevationM:Number(item.elevationM), segment:'drive' }));
      const hasDissipationDevice = Boolean(driveLengthControl?.deviceType && driveLengthControl.deviceType !== 'none' && Number.isFinite(Number(driveLengthControl.stationChainageM)));
      const effectiveTerrainProfile = hasDissipationDevice ? sliceProfileFromChainage(drive.profile, driveLengthControl.stationChainageM) : drive.profile;
      const supportStartElevationM = hasDissipationDevice ? Number(driveLengthControl.localElevationM) : sourceElevationM;
      const driveSupport = inputs.driveInstallation === 'elevated-supports'
        ? analyzeElevatedDriveGrade(effectiveTerrainProfile, supportStartElevationM, pumpElevationM, inputs.maxSupportHeightM)
        : null;
      let driveProfile;
      if (hasDissipationDevice) {
        const supplyProfile = groundDriveProfile.filter(item => item.chainageM < Number(driveLengthControl.stationChainageM) - 1e-6).map(item => ({ ...item, segment:'supply' }));
        const devicePoint = { chainageM:Number(driveLengthControl.stationChainageM), elevationM:Number(driveLengthControl.localElevationM), segment:'supply' };
        const effectiveProfile = driveSupport
          ? driveSupport.designProfile.map(item => ({ ...item, chainageM:Number(driveLengthControl.stationChainageM) + Number(item.chainageM), segment:'drive' }))
          : effectiveTerrainProfile.map(item => ({ chainageM:Number(driveLengthControl.stationChainageM) + Number(item.chainageM), elevationM:Number(item.elevationM), segment:'drive' }));
        driveProfile = [...supplyProfile, devicePoint, ...effectiveProfile.slice(1)];
      } else driveProfile = driveSupport ? driveSupport.designProfile : groundDriveProfile;
      const assessmentDriveProfile = hasDissipationDevice ? driveProfile.filter(item => item.segment === 'drive') : driveProfile;
      const deliveryProfile = delivery.profile.slice(1).map(item => ({ chainageM: driveLengthM + item.chainageM, elevationM: item.elevationM, segment: 'delivery' }));
      const deliveryHighPoint = [{ chainageM: driveLengthM, elevationM: pumpElevationM }, ...deliveryProfile].reduce((best, item) => Number(item.elevationM) > Number(best.elevationM) ? item : best);
      const deliveryHighPointLiftM = Number(deliveryHighPoint.elevationM) - pumpElevationM;
      const governingDeliveryLiftM = Math.max(deliveryHeadM, deliveryHighPointLiftM);
      const effectiveAlignmentRoute = driveLengthControl?.deviceType && driveLengthControl.deviceType !== 'none'
        ? sanitizeRoute(driveLengthControl.effectiveDriveRoute, 5000)
        : sanitizeRoute(state.driveRoute, 5000);
      const effectiveDriveRouteStraight = effectiveAlignmentRoute.length === 2;
      const effectiveDriveBendCount = Math.max(0, effectiveAlignmentRoute.length - 2);
      const rigidDriveStartElevationM = hasDissipationDevice && Number.isFinite(Number(driveLengthControl.localElevationM))
        ? Number(driveLengthControl.localElevationM)
        : sourceElevationM;
      const rigidDriveDropM = rigidDriveStartElevationM - pumpElevationM;
      const rigidDriveSlopePct = effectiveDriveLengthM > 0 ? rigidDriveDropM / effectiveDriveLengthM * 100 : 0;
      const metrics = {
        sourceElevationM, pumpElevationM, destinationElevationM, driveHeadM, deliveryHeadM, headRatio,
        sourceToDestinationLiftM: destinationElevationM - sourceElevationM,
        deliveryHighPointElevationM: Number(deliveryHighPoint.elevationM), deliveryHighPointChainageM: Number(deliveryHighPoint.chainageM), deliveryHighPointLiftM, governingDeliveryLiftM,
        requiredSourceFlow,
        driveLengthM, deliveryLengthM, totalPipeLengthM: driveLengthM + deliveryLengthM,
        driveSlopePct: rigidDriveSlopePct, rigidDriveStartElevationM, rigidDriveDropM,
        deliveryAverageSlopePct: deliveryLengthM > 0 ? (destinationElevationM - pumpElevationM) / deliveryLengthM * 100 : 0,
        driveInstallation:inputs.driveInstallation, driveAlignment:inputs.driveAlignment, driveRouteStraight:effectiveDriveRouteStraight, driveBendCount:effectiveDriveBendCount, supplyRouteStraight:driveLengthControl?.deviceType && driveLengthControl.deviceType !== 'none' ? sanitizeRoute(driveLengthControl.supplyRoute,5000).length <= 2 : true,
        driveSupport, driveTerrainProfile:driveSupport ? groundDriveProfile.map(item => ({ chainageM:item.chainageM, elevationM:item.elevationM })) : null,
        drivePipeControl: driveLengthControl, effectiveDriveLengthM,
        designBasis: inputs.designBasis, driveLengthRule: inputs.driveLengthRule,
        drivePipe, deliveryPipe, hydraulic,
        pipeSizing: {
          drive: { mode: inputs.drivePipeDiameterMm > 0 ? 'manual' : (inputs.designBasis === 'peace-corps-s2' ? 'peace-corps-s2-table' : 'automatic'), designFlowLps: sourceFlow, minVelocityMps: 0.25, maxVelocityMps: 2.5, maxHeadlossPercent: 8 },
          delivery: { mode: inputs.deliveryPipeDiameterMm > 0 ? 'manual' : 'automatic', designFlowLps: sizingFlow, minVelocityMps: 0.15, maxVelocityMps: 2.5, maxHeadlossPercent: 8 }
        },
        sourceLabel: drive.sourceLabel || delivery.sourceLabel || SOURCE_LABELS[state.elevationSource]
      };
      state.elevationSource = drive.sourceKey; state.elevationSourceLabel = metrics.sourceLabel; state.profile = [...driveProfile, ...deliveryProfile]; state.pumpChainageM = driveLengthM; state.metrics = metrics;
      state.assessment = buildAssessment(metrics, inputs, assessmentDriveProfile); state.updatedAt = now();
      setProgress(progressStart + span * 0.94, 'Updating annotations', 'Refreshing map labels and elevation profile.');
      renderResults(); renderAbearcRamPumpOverlay();
      if (!quiet) { setProgress(progressEnd, 'Ram-pump layout updated', state.assessment.title); setTimeout(hideProgress, 500); toast(state.assessment.title); }
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') { if (!quiet) toast('Ram-pump recalculation cancelled'); return false; }
      console.error('Ram-pump recalculation failed', error); if (!quiet) toast(error.message || 'Unable to recalculate ram-pump layout.', 'error'); return false;
    } finally { if (ownController && operationAbort === ownController) operationAbort = null; }
  }

  async function selectAbearcRamPumpCandidate(index) {
    index = Number(index); const candidate = state?.candidates?.[index]; if (!candidate) return false;
    rememberChange(); state.selectedCandidateIndex = index; state.pump = [...candidate.location]; state.driveRoute = clone(candidate.driveRoute); state.deliveryRoute = clone(candidate.deliveryRoute); state.annotations = {}; state.updatedAt = now();
    await recalculateAbearcRamPumpLayout({ remember: false }); return true;
  }

  function summaryRows() {
    const m = state?.metrics, h = m?.hydraulic, i = state?.inputs; if (!m) return [];
    return [
      ['Source elevation', `${format(m.sourceElevationM)} m`], ['Ram-pump elevation', `${format(m.pumpElevationM)} m`], ['Destination elevation', `${format(m.destinationElevationM)} m`],
      ['Available drive head', `${format(m.driveHeadM)} m`], ['Required delivery head', `${format(m.deliveryHeadM)} m`], ['Head ratio H/h', format(m.headRatio, 2)],
      ['Drive pipe', `${format(m.driveLengthM, 1)} m source-to-pump · effective rigid drive ${format(m.effectiveDriveLengthM ?? m.driveLengthM,1)} m · Ø${m.drivePipe?.diameterMm || '—'} mm · ${format(m.driveSlopePct, 2)}% rigid-pipe grade`],
      ['Drive installation', m.driveInstallation === 'elevated-supports' ? `Elevated on support frames · ${m.driveRouteStraight ? 'straight / no turns' : `${m.driveBendCount} bend${m.driveBendCount===1?'':'s'}`} · max support ${format(m.driveSupport?.maxRequiredSupportHeightM,2)} m` : `On ground · ${m.driveRouteStraight ? 'straight / no turns' : `${m.driveBendCount} bend${m.driveBendCount===1?'':'s'}`}`],
      ...(m.drivePipeControl?.enabled ? [['Drive-pipe length check', `${format(m.drivePipeControl.totalLengthM,1)} m run · reference ${format(m.drivePipeControl.minM,1)}–${format(m.drivePipeControl.maxM,1)} m${m.drivePipeControl.deviceType && m.drivePipeControl.deviceType !== 'none' ? ` · ${m.drivePipeControl.deviceType === 'drive-tank' ? 'drive tank' : 'standpipe'} at Ch ${format(m.drivePipeControl.stationChainageM,1)} m` : ''}`]] : []),
      ...(m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' ? [['Supply / dissipation device', `${format(m.drivePipeControl.supplyLengthM,1)} m supply pipe Ø${m.drivePipeControl.supplyPipeDiameterMm || '—'} mm · ${m.drivePipeControl.deviceType === 'drive-tank' ? 'drive tank' : 'standpipe'} Ø${m.drivePipeControl.standpipeDiameterMm || '—'} mm · top EL ${format(m.drivePipeControl.topElevationM,2)} m`]] : []),
      ['Delivery pipe', `${format(m.deliveryLengthM, 1)} m · Ø${m.deliveryPipe?.diameterMm || '—'} mm`], ['Total pipe length', `${format(m.totalPipeLengthM, 1)} m`],
      ['Source → destination lift', `${format(m.sourceToDestinationLiftM)} m`], [i?.desiredDeliveryFlowLps > 0 ? 'Required source / drive flow' : 'Available source / drive flow', `${flow(i?.sourceFlowLps, 3)} L/min · ${format(h?.sourceM3Day, 1)} m³/day`],
      ['Estimated delivery', `${flow(h?.deliveredFlowLps, 3)} L/min · ${format(h?.deliveredM3Day, 1)} m³/day`], ['Estimated waste flow', `${flow(h?.wasteFlowLps, 3)} L/min · ${format(h?.wasteM3Day, 1)} m³/day`],
      ['Planning efficiency', `${format((i?.efficiency || 0) * 100, 0)}%`], ['Delivery high point', `${format(m.deliveryHighPointElevationM)} m @ ${format(m.deliveryHighPointChainageM, 0)} m · lift ${format(m.deliveryHighPointLiftM)} m`],
      ['Maximum delivery lift', `${format(m.governingDeliveryLiftM)} m used / ${format(i?.maxDeliveryLiftM, 0)} m limit`], ['Net drive head after friction', `${format(h?.netDriveHeadM)} m`]
    ];
  }

  function profileMarkup() {
    const profile = state?.profile || []; if (profile.length < 2) return '';
    const width = 760, height = 230, left = 54, right = 18, top = 24, bottom = 38, plotW = width - left - right, plotH = height - top - bottom;
    const terrainDrive = Array.isArray(state?.metrics?.driveTerrainProfile) ? state.metrics.driveTerrainProfile : [];
    const xs = profile.map(item => Number(item.chainageM)), ys = [...profile.map(item => Number(item.elevationM)), ...terrainDrive.map(item => Number(item.elevationM))].filter(Number.isFinite);
    const xMax = Math.max(1, ...xs), yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys), pad = Math.max(1, (yMaxRaw - yMinRaw) * 0.12), yMin = yMinRaw - pad, yMax = yMaxRaw + pad;
    const px = x => left + x / xMax * plotW, py = y => top + (yMax - y) / Math.max(1e-6, yMax - yMin) * plotH;
    const supply = profile.filter(item => item.segment === 'supply'), drive = profile.filter(item => item.segment === 'drive'), delivery = profile.filter(item => item.segment === 'delivery');
    const line = items => items.map(item => `${px(item.chainageM).toFixed(1)},${py(item.elevationM).toFixed(1)}`).join(' ');
    const grid = [];
    for (let i = 0; i <= 4; i++) { const y = top + plotH * i / 4, value = yMax - (yMax - yMin) * i / 4; grid.push(`<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-7}" y="${y+3}" text-anchor="end">${value.toFixed(1)}</text>`); }
    for (let i = 0; i <= 5; i++) { const x = left + plotW * i / 5, value = xMax * i / 5; grid.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top+plotH}"/><text x="${x}" y="${height-14}" text-anchor="middle">${Math.round(value)}</text>`); }
    const marker = (chainage, elevation, label, cls) => {
      const text = `${label} ${format(elevation)} m`, half = text.length * 3.2;
      const ax = px(chainage), ay = py(elevation), offset = state.profileAnnotations?.[cls];
      const x = Math.max(half + 4, Math.min(width - half - 4, ax + number(offset?.dx))), y = Math.max(14, Math.min(height - 5, ay + number(offset?.dy, -12)));
      return `<g class="ram-profile-marker ${cls}"><line x1="${ax}" y1="${top}" x2="${ax}" y2="${top+plotH}"/><circle cx="${ax}" cy="${ay}" r="4"/><line class="ram-profile-label-leader" x1="${ax}" y1="${ay}" x2="${x}" y2="${y-3}" opacity="${Math.hypot(x-ax,y-ay)>20 ? 1 : 0}"/><text data-ram-profile-label="${cls}" data-anchor-x="${ax}" data-anchor-y="${ay}" x="${x}" y="${y}" tabindex="0" role="button" aria-label="Move ${esc(label)} label: drag or use arrow keys" text-anchor="middle">${esc(text)}</text></g>`;
    };
    const m = state.metrics;
    return `<div class="abearc-ram-profile-head" data-ram-profile-drag>
        <div class="abearc-ram-profile-meta"><span><b>Elevation profile</b> · ${esc(m?.sourceLabel || state.elevationSourceLabel || SOURCE_LABELS[state.elevationSource])}</span><span>Chainage (m)</span></div>
        <div class="abearc-ram-profile-actions" data-ram-profile-no-drag>
          <button type="button" onclick="downloadAbearcRamPumpProfilePng()" title="Download elevation profile as PNG" aria-label="Download elevation profile as PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg><span>Download</span></button>
          <button type="button" onclick="toggleAbearcRamPumpProfileExpanded()" title="Toggle larger elevation profile" aria-label="Toggle larger elevation profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 3H3v5m13-5h5v5M8 21H3v-5m18 0v5h-5"/></svg><span data-ram-profile-expand-label>${profileUi.expanded ? 'Reduce' : 'Expand'}</span></button>
          <button type="button" onclick="toggleAbearcRamPumpProfileFloating()" title="${profileUi.floating ? 'Dock elevation profile in drawer' : 'Move elevation profile onto map'}" aria-label="${profileUi.floating ? 'Dock elevation profile in drawer' : 'Move elevation profile onto map'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18M3 12h18m-9-9-3 3m3-3 3 3m6 6-3-3m3 3-3 3m-6 6-3-3m3 3 3-3M3 12l3-3m-3 3 3 3"/></svg><span>${profileUi.floating ? 'Dock' : 'Move'}</span></button>
        </div>
      </div>
      <svg class="abearc-ram-profile-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ram-pump system elevation profile">
        <g class="ram-profile-grid">${grid.join('')}<text x="380" y="228" text-anchor="middle">Chainage (m)</text><text transform="translate(12 120) rotate(-90)" text-anchor="middle">Elevation (m)</text></g>
        ${terrainDrive.length ? `<polyline class="ram-profile-drive-terrain" points="${line(terrainDrive)}"/>` : ''}
        ${supply.length >= 2 ? `<polyline class="ram-profile-supply" points="${line(supply)}"/>` : ''}
        <polyline class="ram-profile-drive" points="${line(drive)}"/>
        <polyline class="ram-profile-delivery" points="${line(delivery.length ? [{ chainageM: state.pumpChainageM, elevationM: m.pumpElevationM }, ...delivery] : [])}"/>
        ${marker(0, m.sourceElevationM, 'SOURCE', 'source')}${m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' && Number.isFinite(Number(m.drivePipeControl.stationChainageM)) ? marker(m.drivePipeControl.stationChainageM, Number.isFinite(Number(m.drivePipeControl.localElevationM)) ? m.drivePipeControl.localElevationM : profileElevationAt(profile, m.drivePipeControl.stationChainageM), m.drivePipeControl.deviceType === 'drive-tank' ? 'DRIVE TANK' : 'STANDPIPE', 'standpipe') : ''}${marker(state.pumpChainageM, m.pumpElevationM, 'RAM PUMP', 'pump')}${marker(xMax, m.destinationElevationM, 'DESTINATION', 'destination')}
        ${Number.isFinite(Number(m.deliveryHighPointChainageM)) && m.deliveryHighPointChainageM > state.pumpChainageM + 1 && m.deliveryHighPointChainageM < xMax - 1 ? marker(m.deliveryHighPointChainageM, m.deliveryHighPointElevationM, 'HIGH POINT', 'high-point') : ''}
      </svg>${['n','s','e','w','ne','nw','se','sw'].map(edge => `<span class="ram-profile-resize ram-profile-resize-${edge}" data-ram-profile-resize="${edge}" tabindex="0" role="separator" aria-label="Resize profile ${edge} edge with arrow keys"></span>`).join('')}`;
  }

  function renderResults() {
    renderGilmanModelSuggestion();
    const status = document.querySelector('[data-ram-result-status]'), summary = document.querySelector('[data-ram-summary]'), profile = document.querySelector('[data-ram-profile]'), candidates = document.querySelector('[data-ram-candidates]'), warnings = document.querySelector('[data-ram-assessment]'), fullCalculation = document.querySelector('[data-ram-full-calculation]');
    if (!summary) return;
    if (!state) {
      if (status) status.textContent = 'No ram-pump layout generated';
      summary.innerHTML = '<span class="abearc-ram-empty">Draw/select a distance measurement from the water source to the intended service area, then generate the system layout.</span>';
      if (profile) { profile.innerHTML = ''; profile.classList.add('hidden'); dockAbearcRamPumpProfile({ reset: true }); } if (candidates) candidates.innerHTML = ''; if (warnings) warnings.innerHTML = '';
      if (fullCalculation) fullCalculation.disabled = true;
      refreshAbearcRamPumpMeasurementSummary();
      return;
    }
    if (status) status.textContent = state.assessment?.title || (state.metrics ? 'Ram-pump layout generated' : 'Terrain analysis pending');
    if (fullCalculation) fullCalculation.disabled = !state.metrics;
    refreshAbearcRamPumpMeasurementSummary();
    const rows = summaryRows();
    summary.innerHTML = rows.length ? `<div class="abearc-ram-summary-grid">${rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>` : '<span class="abearc-ram-empty">Generate the layout to calculate terrain and hydraulic results.</span>';
    if (profile) { profile.innerHTML = profileMarkup(); profile.classList.toggle('hidden', !state.profile?.length); applyAbearcRamPumpProfileUi(); }
    if (candidates) {
      candidates.innerHTML = state.candidates?.length > 1 ? `<div class="abearc-ram-candidate-head"><strong>Pump-site candidates</strong><span>Select an alternative if field access favors another location.</span></div><div class="abearc-ram-candidate-buttons">${state.candidates.map((candidate, index) => `<button type="button" class="${index === state.selectedCandidateIndex ? 'is-active' : ''}" onclick="selectAbearcRamPumpCandidate(${index})"><b>${index === 0 ? 'Recommended site' : `Alternative ${index}`}</b><small>Hd ${format(candidate.driveHeadM)} m · H/h ${format(candidate.headRatio, 1)} · ${candidate.driveRoute?.length === 2 ? 'straight' : 'routed'}</small></button>`).join('')}</div>` : '';
    }
    if (warnings) {
      const assessment = state.assessment;
      warnings.innerHTML = assessment ? `<div class="abearc-ram-assessment is-${assessment.level}"><strong>${esc(assessment.title)}</strong>${assessment.reasons?.length ? `<ul>${assessment.reasons.map(reason => `<li>${esc(flowNote(reason))}</li>`).join('')}</ul>` : ''}</div>` : '';
    }
  }

  function profileElement() { return document.querySelector('[data-ram-profile]'); }
  function profileSlot() { return document.querySelector('[data-ram-profile-slot]'); }
  function profileStage() { return document.querySelector('.abearc-map-stage'); }

  function dockAbearcRamPumpProfile({ reset = false } = {}) {
    const profile = profileElement(), slot = profileSlot();
    if (profile && slot?.parentNode && profile.parentNode !== slot.parentNode) slot.parentNode.insertBefore(profile, slot.nextSibling);
    profileUi.floating = false;
    if (reset) { profileUi.expanded = false; profileUi.left = null; profileUi.top = null; profileUi.width = null; profileUi.height = null; }
    if (profile) { profile.classList.remove('is-floating', 'is-expanded'); profile.style.left = ''; profile.style.top = ''; profile.style.width = ''; profile.style.height = ''; }
  }

  function clampProfilePosition() {
    const profile = profileElement(), stage = profileStage(); if (!profile || !stage || !profileUi.floating) return;
    const stageRect = stage.getBoundingClientRect(), rect = profile.getBoundingClientRect();
    const left = Math.max(8, Math.min(number(profileUi.left, 18), Math.max(8, stageRect.width - rect.width - 8)));
    const top = Math.max(8, Math.min(number(profileUi.top, 18), Math.max(8, stageRect.height - rect.height - 8)));
    profileUi.left = left; profileUi.top = top; profile.style.left = `${left}px`; profile.style.top = `${top}px`;
  }

  function applyAbearcRamPumpProfileUi() {
    const profile = profileElement(); if (!profile) return;
    profile.classList.toggle('is-expanded', profileUi.expanded);
    if (profileUi.floating) {
      const stage = profileStage(); if (stage && profile.parentNode !== stage) stage.append(profile);
      profile.classList.add('is-floating');
      profile.style.width = profileUi.width ? `${profileUi.width}px` : '';
      profile.style.height = profileUi.height ? `${profileUi.height}px` : '';
      if (!Number.isFinite(profileUi.left) || !Number.isFinite(profileUi.top)) {
        const width = profileUi.expanded ? Math.min(1040, Math.max(560, stage?.clientWidth * .78 || 760)) : Math.min(760, Math.max(460, stage?.clientWidth * .58 || 620));
        profileUi.left = Math.max(12, ((stage?.clientWidth || width) - width) / 2);
        profileUi.top = Math.max(12, (stage?.clientHeight || 500) * .12);
      }
      requestAnimationFrame(clampProfilePosition);
    } else {
      dockAbearcRamPumpProfile();
      profile.classList.toggle('is-expanded', profileUi.expanded);
    }
    profile.querySelector('[data-ram-profile-expand-label]')?.replaceChildren(document.createTextNode(profileUi.expanded ? 'Reduce' : 'Expand'));
  }

  function toggleAbearcRamPumpProfileFloating(force = null) {
    if (!state?.profile?.length) return false;
    profileUi.floating = force == null ? !profileUi.floating : Boolean(force);
    if (!profileUi.floating) profileUi.expanded = false;
    renderResults();
    return profileUi.floating;
  }

  function toggleAbearcRamPumpProfileExpanded(force = null) {
    if (!state?.profile?.length) return false;
    profileUi.expanded = force == null ? !profileUi.expanded : Boolean(force);
    profileUi.width = null; profileUi.height = null;
    if (profileUi.expanded) profileUi.floating = true;
    renderResults();
    return profileUi.expanded;
  }

  function beginProfileDrag(event) {
    if (!profileUi.floating || event.button !== 0 || event.target.closest('[data-ram-profile-no-drag]')) return;
    const profile = profileElement(), stage = profileStage(); if (!profile || !stage) return;
    event.preventDefault(); event.stopPropagation();
    const profileRect = profile.getBoundingClientRect(), stageRect = stage.getBoundingClientRect();
    profileUi.left = profileRect.left - stageRect.left; profileUi.top = profileRect.top - stageRect.top;
    profileDrag = { startX:event.clientX, startY:event.clientY, left:profileUi.left, top:profileUi.top };
    profile.classList.add('is-dragging');
    try { abearcMap?.dragPan?.disable?.(); } catch (_) {}
  }

  function beginProfileResize(event, handle) {
    if (!profileUi.floating || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const rect = profileElement().getBoundingClientRect(), stage = profileStage().getBoundingClientRect();
    profileResize = { edge:handle.dataset.ramProfileResize, x:event.clientX, y:event.clientY, left:rect.left-stage.left, top:rect.top-stage.top, width:rect.width, height:rect.height };
    if (event.pointerId != null) handle.setPointerCapture?.(event.pointerId);
    abearcMap?.dragPan?.disable?.();
  }

  function moveProfileResize(event) {
    if (!profileResize) return false;
    const r = profileResize, stage = profileStage(), dx = event.clientX-r.x, dy = event.clientY-r.y;
    const minW = Math.min(300, stage.clientWidth-16), minH = Math.min(180, stage.clientHeight-16);
    let left=r.left, top=r.top, right=r.left+r.width, bottom=r.top+r.height;
    if (r.edge.includes('w')) left=Math.max(8, Math.min(right-minW, r.left+dx));
    if (r.edge.includes('e')) right=Math.min(stage.clientWidth-8, Math.max(left+minW, r.left+r.width+dx));
    if (r.edge.includes('n')) top=Math.max(8, Math.min(bottom-minH, r.top+dy));
    if (r.edge.includes('s')) bottom=Math.min(stage.clientHeight-8, Math.max(top+minH, r.top+r.height+dy));
    Object.assign(profileUi, { left, top, width:right-left, height:bottom-top, expanded:false });
    const panel = profileElement(); panel.classList.remove('is-expanded');
    Object.assign(panel.style, { left:`${left}px`, top:`${top}px`, width:`${right-left}px`, height:`${bottom-top}px` });
    const label = panel.querySelector('[data-ram-profile-expand-label]'); if (label) label.textContent='Expand';
    return true;
  }

  function positionProfileLabel(label, x, y) {
    const half = label.textContent.length*3.2, ax=Number(label.dataset.anchorX), ay=Number(label.dataset.anchorY);
    x=Math.max(half+4, Math.min(756-half,x)); y=Math.max(14,Math.min(225,y));
    label.setAttribute('x',x); label.setAttribute('y',y);
    const leader=label.parentNode.querySelector('.ram-profile-label-leader');
    leader.setAttribute('x2',x); leader.setAttribute('y2',y-3); leader.setAttribute('opacity',Math.hypot(x-ax,y-ay)>20 ? '1' : '0');
    state.profileAnnotations ||= {}; state.profileAnnotations[label.dataset.ramProfileLabel]={dx:x-ax,dy:y-ay}; state.updatedAt=now();
  }

  function beginProfileLabelDrag(event, label) {
    if (!state || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); rememberChange();
    const matrix=label.ownerSVGElement.getScreenCTM()?.inverse(); if (!matrix) return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix);
    profileLabelDrag={label,matrix,x:point.x,y:point.y,left:Number(label.getAttribute('x')),top:Number(label.getAttribute('y'))};
    label.setPointerCapture?.(event.pointerId); abearcMap?.dragPan?.disable?.();
  }

  function moveProfileDrag(event) {
    if (!profileDrag) return false;
    event.preventDefault(); event.stopPropagation();
    profileUi.left = profileDrag.left + event.clientX - profileDrag.startX;
    profileUi.top = profileDrag.top + event.clientY - profileDrag.startY;
    clampProfilePosition(); return true;
  }

  function endProfileDrag() {
    if (!profileDrag) return false;
    profileDrag = null; profileElement()?.classList.remove('is-dragging');
    try { abearcMap?.dragPan?.enable?.(); } catch (_) {}
    return true;
  }

  function downloadAbearcRamPumpProfilePng() {
    const svg = profileElement()?.querySelector('.abearc-ram-profile-svg');
    if (!svg || !state?.profile?.length) return toast('Generate an elevation profile first.', 'error');
    const cloneSvg = svg.cloneNode(true);
    cloneSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); cloneSvg.setAttribute('width', '1520'); cloneSvg.setAttribute('height', '460');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `.ram-profile-grid line{stroke:#e4ebef;stroke-width:1}.ram-profile-grid text{fill:#64748b;font:650 9px Arial,sans-serif}.ram-profile-drive,.ram-profile-supply,.ram-profile-delivery,.ram-profile-drive-terrain{fill:none;stroke-linejoin:round;stroke-linecap:round}.ram-profile-drive,.ram-profile-delivery{stroke-width:3}.ram-profile-drive{stroke:#0f766e}.ram-profile-supply{stroke:#0f766e;stroke-width:2.2;stroke-dasharray:7 4;opacity:.75}.ram-profile-delivery{stroke:#2563eb}.ram-profile-drive-terrain{stroke:#8b7355;stroke-width:1.5;stroke-dasharray:5 4;opacity:.8}.ram-profile-marker line{stroke:#94a3b8;stroke-width:1;stroke-dasharray:3 3}.ram-profile-marker circle{fill:#fff;stroke-width:2.5}.ram-profile-marker text{fill:#334155;font:800 9px Arial,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:3px}.ram-profile-marker.source circle{stroke:#0f766e}.ram-profile-marker.pump circle{stroke:#d97706}.ram-profile-marker.destination circle{stroke:#2563eb}.ram-profile-marker.high-point circle{stroke:#7c3aed}.ram-profile-marker.high-point line{stroke:#a78bfa}`;
    style.textContent += '.ram-profile-marker .ram-profile-label-leader{stroke:#475569;stroke-dasharray:none;stroke-width:1.2}';
    cloneSvg.prepend(style);
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); background.setAttribute('width','100%'); background.setAttribute('height','100%'); background.setAttribute('fill','#ffffff'); cloneSvg.insertBefore(background, style.nextSibling);
    const source = new XMLSerializer().serializeToString(cloneSvg), url = URL.createObjectURL(new Blob([source], { type:'image/svg+xml;charset=utf-8' })), image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 1520; canvas.height = 460; const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob => { if (!blob) return; const href = URL.createObjectURL(blob), a = document.createElement('a'); a.href = href; a.download = `${String(state?.name || 'ABEARC-Ram-Pump-Layout').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,90)}-elevation-profile.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000); }, 'image/png');
      } finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); toast('Unable to export the elevation profile image.', 'error'); };
    image.src = url;
  }

  function engineeringSchematicSupportFrames({ hasDevice = false, deviceX = 220 } = {}) {
    const pipeY = x => 150 + (321 - 150) * ((Number(x) - 220) / (505 - 220));
    const groundPoints = [[208,335],[250,315],[312,324],[355,307],[411,327],[458,315],[505,326]];
    const groundY = x => {
      const value = Number(x);
      for (let index = 1; index < groundPoints.length; index++) {
        const a = groundPoints[index - 1], b = groundPoints[index];
        if (value <= b[0]) {
          const ratio = Math.max(0, Math.min(1, (value - a[0]) / Math.max(1e-9, b[0] - a[0])));
          return a[1] + (b[1] - a[1]) * ratio;
        }
      }
      return groundPoints.at(-1)[1];
    };
    const start = hasDevice ? Math.max(232, Number(deviceX) + 9) : 258;
    const end = 490;
    const span = end - start;
    const count = span >= 150 ? 3 : span >= 78 ? 2 : span >= 26 ? 1 : 0;
    const positions = [];
    for (let index = 0; index < count; index++) positions.push(start + span * ((index + 1) / (count + 1)));
    return positions.map(x => ({ x, topY: pipeY(x), bottomY: Math.max(pipeY(x) + 12, groundY(x)) }));
  }

  function engineeringSchematicDeviceLabel(dc, deviceX, deviceY) {
    if (!dc?.deviceType || dc.deviceType === 'none') return '';
    const crowded = deviceX > 385;
    const labelX = crowded ? Math.max(228, deviceX - 188) : Math.max(225, deviceX - 58);
    const labelY = crowded ? 137 : 98;
    const leaderStartX = crowded ? labelX + 154 : labelX + 52;
    const title = dc.deviceType === 'drive-tank'
      ? `DRIVE TANK · top EL ${format(dc.topElevationM,2)} m`
      : `STANDPIPE · Ø${format(dc.standpipeDiameterMm,0)} mm · top EL ${format(dc.topElevationM,2)} m`;
    return `<text class="small" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}">${title}</text><path class="leader" d="M${leaderStartX.toFixed(1)} ${(labelY+4).toFixed(1)}L${deviceX.toFixed(1)} ${dc.deviceType === 'drive-tank' ? '104' : '108'}"/>`;
  }

  function nominalPipeInchLabel(mm, withUnit = false) {
    const value = Number(mm);
    if (!Number.isFinite(value) || value <= 0) return '—';
    const series = [
      { mm:20, label:'1/2' }, { mm:25, label:'3/4' }, { mm:32, label:'1' }, { mm:40, label:'1 1/4' },
      { mm:50, label:'1 1/2' }, { mm:63, label:'2' }, { mm:75, label:'2 1/2' }, { mm:90, label:'3' },
      { mm:110, label:'4' }, { mm:125, label:'5' }, { mm:140, label:'5 1/2' }, { mm:160, label:'6' },
      { mm:180, label:'7' }, { mm:200, label:'8' }, { mm:225, label:'9' }, { mm:250, label:'10' },
      { mm:280, label:'11' }, { mm:315, label:'12' }
    ];
    let best = series[0];
    for (const item of series) if (Math.abs(item.mm - value) < Math.abs(best.mm - value)) best = item;
    return withUnit ? `${best.label} in` : best.label;
  }

  function engineeringFigure(m, h) {
    const i = state?.inputs || defaultInputs();
    const dc = m.drivePipeControl || {};
    const deviceNote = dc.deviceType && dc.deviceType !== 'none'
      ? ` / ${dc.deviceType === 'drive-tank' ? 'Drive tank' : 'Open standpipe'} before rigid drive line`
      : '';
    const detail = [
      ['Water source / intake', `EL ${format(m.sourceElevationM)} m · Source ${flow(h.sourceFlowLps)} L/min`],
      ['Drive pipe', `Rigid Ø${format(m.drivePipe?.diameterMm,0)} mm (${nominalPipeInchLabel(m.drivePipe?.diameterMm,true)}) · ${format(m.effectiveDriveLengthM || m.driveLengthM,1)} m${deviceNote}`],
      ['Hydraulic ram pump', `EL ${format(m.pumpElevationM)} m · Drive head ${format(m.driveHeadM)} m`],
      ['Delivery pipe', `Ø${format(m.deliveryPipe?.diameterMm,0)} mm (${nominalPipeInchLabel(m.deliveryPipe?.diameterMm,true)}) · ${format(m.deliveryLengthM,1)} m · Delivered ${flow(h.deliveredFlowLps)} L/min`],
      ['Storage tank / reservoir', `EL ${format(m.destinationElevationM)} m · Delivery head ${format(m.deliveryHeadM)} m`],
      ['Drive pipe installation', i.driveInstallation === 'elevated-supports' ? `Elevated on frames (maximum support height ${format(m.driveSupport?.maxRequiredSupportHeightM,2)} m)` : 'On-ground continuously descending'],
    ];
    return `<figure class="ram-figure ram-manual-figure" data-ram-engineering-figure>
      <img class="ram-manual-reference" src="/assets/media/ram-pump-manual-reference.png" width="464" height="466" loading="eager" alt="Figure 1 shows Stage 3: water enters the air chamber and compresses trapped air; Stage 4: compressed air forces water into the delivery pipe. Figure 2 shows the water source, descending drive pipe, ram pump, ascending delivery pipe and storage tank on hilly terrain." />
      <figcaption><b>Figures 1 and 2.</b> The hydraulic ram pump and the complete hydraulic ram-pump system, as in the supplied manual reference. The illustrations are general operating-principle references, not dimensioned construction drawings.</figcaption>
      <div class="ram-manual-design-annotations"><strong>Current generated layout — engineering annotations</strong>
        <dl>${detail.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
      </div>
    </figure>`;
  }

  function detailedCalculationProfileFigure() {
    const profile = state?.profile || [];
    const m = state?.metrics;
    if (!m || profile.length < 2) return '';
    const width = 980, height = 320, left = 62, right = 26, top = 26, bottom = 46, plotW = width - left - right, plotH = height - top - bottom;
    const terrainDrive = Array.isArray(m.driveTerrainProfile) ? m.driveTerrainProfile : [];
    const xs = profile.map(item => Number(item.chainageM));
    const ys = [...profile.map(item => Number(item.elevationM)), ...terrainDrive.map(item => Number(item.elevationM))].filter(Number.isFinite);
    const xMax = Math.max(1, ...xs), yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys), pad = Math.max(1, (yMaxRaw - yMinRaw) * 0.12), yMin = yMinRaw - pad, yMax = yMaxRaw + pad;
    const px = x => left + x / xMax * plotW, py = y => top + (yMax - y) / Math.max(1e-6, yMax - yMin) * plotH;
    const supply = profile.filter(item => item.segment === 'supply');
    const drive = profile.filter(item => item.segment === 'drive');
    const delivery = profile.filter(item => item.segment === 'delivery');
    const line = items => items.map(item => `${px(item.chainageM).toFixed(1)},${py(item.elevationM).toFixed(1)}`).join(' ');
    const grid = [];
    for (let index = 0; index <= 4; index++) {
      const y = top + plotH * index / 4;
      const value = yMax - (yMax - yMin) * index / 4;
      grid.push(`<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-8}" y="${y+3}" text-anchor="end">${value.toFixed(1)}</text>`);
    }
    for (let index = 0; index <= 6; index++) {
      const x = left + plotW * index / 6;
      const value = xMax * index / 6;
      grid.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top+plotH}"/><text x="${x}" y="${height-16}" text-anchor="middle">${Math.round(value)}</text>`);
    }
    const label = (id, chainage, elevation, lines, tone, dx, dy) => {
      const ax = px(chainage), ay = py(elevation), x = ax + dx, y = ay + dy, width = Math.max(120, Math.min(220, Math.max(...lines.map(line => String(line).length)) * 5.8 + 18)), height = 24 + lines.length * 13.5;
      const leaderY = y + Math.min(height - 8, Math.max(8, ay - y));
      return `<g class="ram-profile-draggable-label ${tone}" data-ram-draggable-label="profile-${id}"><line class="ram-profile-label-leader" data-drag-line x1="${ax}" y1="${ay}" x2="${x}" y2="${leaderY}"/><rect class="ram-profile-label-box" data-drag-box x="${x}" y="${y}" width="${width}" height="${height}" rx="5"/><text class="ram-profile-label-text" data-drag-text x="${x + 10}" y="${y + 18}">${lines.map((textLine, index) => `<tspan x="${x + 10}" dy="${index ? 13.5 : 0}" class="${index === 0 ? 'is-title' : ''}">${esc(textLine)}</tspan>`).join('')}</text></g>`;
    };
    const standpipeLabel = m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' && Number.isFinite(Number(m.drivePipeControl.stationChainageM))
      ? label('device', m.drivePipeControl.stationChainageM, Number.isFinite(Number(m.drivePipeControl.localElevationM)) ? m.drivePipeControl.localElevationM : profileElevationAt(profile, m.drivePipeControl.stationChainageM), [m.drivePipeControl.deviceType === 'drive-tank' ? 'DRIVE TANK' : 'STANDPIPE', `Top EL ${format(m.drivePipeControl.topElevationM,2)} m`], 'standpipe', 18, -56)
      : '';
    const highPointLabel = Number.isFinite(Number(m.deliveryHighPointChainageM)) && m.deliveryHighPointChainageM > state.pumpChainageM + 1 && m.deliveryHighPointChainageM < xMax - 1
      ? label('high-point', m.deliveryHighPointChainageM, m.deliveryHighPointElevationM, ['DELIVERY HIGH POINT', `EL ${format(m.deliveryHighPointElevationM)} m`, `Lift ${format(m.deliveryHighPointLiftM)} m`], 'high-point', 14, -58)
      : '';
    return `<figure class="ram-profile-figure" data-ram-calculation-profile><div class="ram-profile-figure-head"><strong>Elevation profile</strong><span>Drive terrain, drive grade and delivery alignment · drag the callouts to declutter the view</span></div><svg class="ram-profile-figure-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Hydraulic ram pump elevation profile"><g class="ram-profile-grid">${grid.join('')}<text x="${left + plotW / 2}" y="${height - 4}" text-anchor="middle">Chainage (m)</text><text transform="translate(18 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Elevation (m)</text></g>${terrainDrive.length ? `<polyline class="ram-profile-drive-terrain" points="${line(terrainDrive)}"/>` : ''}${supply.length >= 2 ? `<polyline class="ram-profile-supply" points="${line(supply)}"/>` : ''}<polyline class="ram-profile-drive" points="${line(drive)}"/><polyline class="ram-profile-delivery" points="${line(delivery.length ? [{ chainageM: state.pumpChainageM, elevationM: m.pumpElevationM }, ...delivery] : [])}"/>${label('source', 0, m.sourceElevationM, ['SOURCE', `EL ${format(m.sourceElevationM)} m`], 'source', 16, -58)}${standpipeLabel}${label('pump', state.pumpChainageM, m.pumpElevationM, ['RAM PUMP', `EL ${format(m.pumpElevationM)} m`, `h = ${format(m.driveHeadM)} m`], 'pump', 14, 12)}${label('destination', xMax, m.destinationElevationM, ['DESTINATION / TANK', `EL ${format(m.destinationElevationM)} m`, `H = ${format(m.deliveryHeadM)} m`], 'destination', -190, -54)}${highPointLabel}</svg><figcaption><b>Figure 2.</b> Elevation profile for the generated ram-pump layout. Brown dashed = sampled terrain, green = source/supply/drive profile, blue = delivery profile from the ram pump to the storage tank or service area.</figcaption></figure>`;
  }

  function calculationPageHtml() {
    const m = state?.metrics, h = m?.hydraulic, i = state?.inputs; if (!m || !h || !i) return '';
    const driveD = Number(m.drivePipe?.diameterMm), deliveryD = Number(m.deliveryPipe?.diameterMm);
    const driveV = core().pipeVelocityMps(i.sourceFlowLps, driveD), deliveryV = core().pipeVelocityMps(h.deliveredFlowLps, deliveryD);
    const f = (value, digits=3) => format(value, digits);
    const equation = (title, symbolic, substituted, result, note='') => `<article class="calc"><h3>${esc(title)}</h3><div class="formula">${esc(symbolic)}</div><div class="sub">${esc(substituted)}</div><div class="result">= ${esc(result)}</div>${note ? `<p>${esc(note)}</p>` : ''}</article>`;
    const pipeSizingDetail = ({ flowLps, lengthM, selectedDiameterMm, coefficient, mode, minVelocityMps, maxVelocityMps, maxHeadlossPercent }) => {
      const q = Math.max(0, Number(flowLps) || 0) / 1000, length = Math.max(0, Number(lengthM) || 0), c = Math.max(1, Number(coefficient) || 140);
      const allowedLossM = length * Math.max(0, Number(maxHeadlossPercent) || 0) / 100;
      const frictionDiameterMm = q > 0 && length > 0 && allowedLossM > 0
        ? Math.pow((10.67 * length * Math.pow(q, 1.852)) / (Math.pow(c, 1.852) * allowedLossM), 1 / 4.871) * 1000 : NaN;
      const minimumByMaxVelocityMm = q > 0 && maxVelocityMps > 0 ? Math.sqrt(4 * q / (Math.PI * maxVelocityMps)) * 1000 : NaN;
      const maximumByMinVelocityMm = q > 0 && minVelocityMps > 0 ? Math.sqrt(4 * q / (Math.PI * minVelocityMps)) * 1000 : NaN;
      const standards = Array.isArray(core().STANDARD_HDPE_DIAMETERS_MM) ? [...core().STANDARD_HDPE_DIAMETERS_MM] : [];
      if (Number(selectedDiameterMm) > 0 && !standards.some(value => Math.abs(Number(value)-Number(selectedDiameterMm)) < 0.01)) standards.push(Number(selectedDiameterMm));
      standards.sort((a,b)=>a-b);
      const checks = standards.map(diameterMm => ({ diameterMm, ...core().evaluatePipe({ flowLps, lengthM:length, diameterMm, coefficient:c, minVelocityMps, maxVelocityMps }) }))
        .map(record => ({ ...record, accepted: record.meetsCriteria && record.headlossPercent <= maxHeadlossPercent }));
      return { flowLps:Number(flowLps), lengthM:length, selectedDiameterMm:Number(selectedDiameterMm), coefficient:c, mode, minVelocityMps, maxVelocityMps, maxHeadlossPercent, allowedLossM, frictionDiameterMm, minimumByMaxVelocityMm, maximumByMinVelocityMm, checks };
    };
    const driveSizing = pipeSizingDetail({ flowLps:i.sourceFlowLps, lengthM:Number(m.effectiveDriveLengthM || m.driveLengthM), selectedDiameterMm:driveD, coefficient:i.hazenWilliamsC,
      mode:m.pipeSizing?.drive?.mode || (i.drivePipeDiameterMm > 0 ? 'manual' : 'automatic'), minVelocityMps:0.25, maxVelocityMps:2.5, maxHeadlossPercent:8 });
    const deliverySizingFlow = Number(m.pipeSizing?.delivery?.designFlowLps) || Math.max(0.01, Number(h.deliveredFlowLps) || 0, Number(i.desiredDeliveryFlowLps) || 0);
    const deliverySizing = pipeSizingDetail({ flowLps:deliverySizingFlow, lengthM:m.deliveryLengthM, selectedDiameterMm:deliveryD, coefficient:i.hazenWilliamsC,
      mode:m.pipeSizing?.delivery?.mode || (i.deliveryPipeDiameterMm > 0 ? 'manual' : 'automatic'), minVelocityMps:0.15, maxVelocityMps:2.5, maxHeadlossPercent:8 });
    const sizingTable = (label, detail) => {
      const showInches = detail === deliverySizing;
      const rows = detail.checks.map(record => `<tr class="${Number(record.diameterMm) === Number(detail.selectedDiameterMm) ? 'selected' : ''}"><td>${f(record.diameterMm,0)}</td>${showInches ? `<td>${esc(nominalPipeInchLabel(record.diameterMm))}</td>` : ''}<td>${f(record.velocityMps,3)}</td><td>${f(record.headlossM,3)}</td><td>${f(record.headlossPercent,2)}%</td><td>${record.accepted ? 'PASS' : '—'}</td>${Number(record.diameterMm) === Number(detail.selectedDiameterMm) ? '<td><b>SELECTED</b></td>' : '<td></td>'}</tr>`).join('');
      return `<div class="sizing-block"><h3>${esc(label)}</h3><div class="sizing-badges"><span>${esc(detail.mode === 'automatic' ? 'Automatic standard-size selection' : detail.mode === 'peace-corps-s2-table' ? 'Peace Corps S-2 Table 2 reference selection' : 'Manual diameter entered')}</span><span>Design flow ${flow(detail.flowLps)} L/min</span><span>Loss limit ${f(detail.maxHeadlossPercent,1)}% of length</span></div>
        <div class="grid sizing-equations">
          ${equation('Friction-based minimum diameter','d = [10.67 L Q^1.852 / (C^1.852 hf,allow)]^(1/4.871)',`[10.67 × ${f(detail.lengthM,1)} × (${flow(detail.flowLps,6)}/60000)^1.852 ÷ (${f(detail.coefficient,0)}^1.852 × ${f(detail.allowedLossM,3)})]^(1/4.871)`,`${f(detail.frictionDiameterMm,1)} mm`,`hf,allow = ${f(detail.maxHeadlossPercent,1)}% × ${f(detail.lengthM,1)} m = ${f(detail.allowedLossM,3)} m.`)}
          ${equation('Velocity lower-bound diameter','Dmin = √(4Q / πVmax)',`√(4 × ${f(detail.flowLps/1000,6)} ÷ (π × ${f(detail.maxVelocityMps,2)})) × 1000`,`${f(detail.minimumByMaxVelocityMm,1)} mm`,`Diameter must be at least this large to keep velocity ≤ ${f(detail.maxVelocityMps,2)} m/s.`)}
          ${equation('Velocity upper-bound diameter','Dmax = √(4Q / πVmin)',`√(4 × ${f(detail.flowLps/1000,6)} ÷ (π × ${f(detail.minVelocityMps,2)})) × 1000`,`${f(detail.maximumByMinVelocityMm,1)} mm`,`Diameter should not exceed this value if the preliminary minimum velocity ${f(detail.minVelocityMps,2)} m/s is to be maintained.`)}
          ${equation('Adopted drive diameter', detail.mode === 'automatic' ? 'Select first standard D passing velocity + hf/L criteria' : detail.mode === 'peace-corps-s2-table' ? 'Use S-2 Table 2 source-flow band' : 'D = user-entered design diameter', detail.mode === 'automatic' ? `Standard series: ${detail.checks.map(record => f(record.diameterMm,0)).join(', ')} mm` : detail.mode === 'peace-corps-s2-table' ? `S-2 Table 2 adopted diameter = ${f(detail.selectedDiameterMm,1)} mm (nominal ${nominalPipeInchLabel(detail.selectedDiameterMm, true)})` : `Entered diameter = ${f(detail.selectedDiameterMm,0)} mm`,`${f(detail.selectedDiameterMm,1)} mm`, detail.mode === 'automatic' ? 'If no standard diameter satisfies every preliminary criterion, the sizing helper returns the closest penalty-ranked standard size and flags it for engineering review.' : detail.mode === 'peace-corps-s2-table' ? 'Shown also as the nearest common nominal inch trade size for convenience; verify local availability and actual internal diameter.' : 'Manual diameters are checked but are not replaced by the automatic selector.')}
        </div>
        <div class="table-scroll"><table class="sizing-table"><thead><tr><th>Standard D (mm)</th>${showInches ? '<th>Equivalent D (in)</th>' : ''}<th>Velocity (m/s)</th><th>hf (m)</th><th>hf/L</th><th>Criteria</th><th>Selection</th></tr></thead><tbody>${rows}</tbody></table></div>${showInches ? '<p class="note">Equivalent D (in) is shown as the nearest standard nominal inch pipe size instead of a decimal conversion.</p>' : ''}</div>`;
    };
    const hwDrive = `10.67 × ${f(m.effectiveDriveLengthM || m.driveLengthM,1)} × (${flow(i.sourceFlowLps,6)}/60000)^1.852 ÷ (${f(i.hazenWilliamsC,0)}^1.852 × (${f(driveD,0)}/1000)^4.871)`;
    const hwDelivery = `10.67 × ${f(m.deliveryLengthM,1)} × (${flow(h.deliveredFlowLps,6)}/60000)^1.852 ÷ (${f(i.hazenWilliamsC,0)}^1.852 × (${f(deliveryD,0)}/1000)^4.871)`;
    const rows = summaryRows().map(([label,value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join('');
    const reasons = (state.assessment?.reasons || []).map(reason => `<li>${esc(flowNote(reason))}</li>`).join('');
    const model = i.designBasis === 'peace-corps-s2' ? 'Peace Corps / Warwick S-2 reference design' : (i.pumpModel ? esc(i.pumpModel) : 'Not specified — generic preliminary energy estimate');
    const pumpFigure = engineeringFigure(m, h);
    const elevationProfileFigure = detailedCalculationProfileFigure();
    const dc = m.drivePipeControl || {};
    const driveLengthCheckHtml = dc.enabled ? `<h2>4. Peace Corps / Warwick drive-pipe length check</h2><div class="grid">
      ${equation('Minimum rigid drive-pipe length','Lmin = 150D',`150 × ${f(driveD/1000,4)} m`,`${f(dc.minM,2)} m`,'Reference guideline from the Peace Corps / Warwick S-2 manual; confirm manufacturer-specific requirements for other pump models.')}
      ${equation('Maximum rigid drive-pipe length','Lmax = 1000D',`1000 × ${f(driveD/1000,4)} m`,`${f(dc.maxM,2)} m`,'If the source-to-pump run is longer than Lmax, the manual calls for a standpipe or drive tank.')}
      ${equation('Source-to-pump route length','Lroute = measured routed length',`${f(dc.totalLengthM,2)} m`,`${dc.tooShort ? 'BELOW Lmin' : dc.tooLong ? 'ABOVE Lmax' : 'WITHIN REFERENCE RANGE'}`)}
      ${dc.deviceType && dc.deviceType !== 'none' ? equation(dc.deviceType === 'drive-tank' ? 'Drive tank placement' : 'Standpipe placement','Leffective ≈ Lmax',`Device at chainage ${f(dc.stationChainageM,1)} m; supply ${f(dc.supplyLengthM,1)} m + rigid drive ${f(dc.effectiveDriveLengthM,1)} m`,`${f(dc.effectiveDriveLengthM,1)} m rigid drive`,`Open top / tank top EL ${f(dc.topElevationM,2)} m (≥ source EL + 0.3 m). Supply pipe Ø${f(dc.supplyPipeDiameterMm,0)} mm; ${dc.deviceType === 'drive-tank' ? 'tank connection' : 'standpipe'} Ø${f(dc.standpipeDiameterMm,0)} mm.`) : ''}
      </div>` : '';
    const requiredSourceEquation = i.desiredDeliveryFlowLps > 0 ? equation(
      'Required source flow',
      'Qs,req = Qd,target × Ht / (η × Hd,net)',
      `${flow(i.desiredDeliveryFlowLps)} × ${f(m.requiredSourceFlow?.totalDeliveryHeadM ?? h.totalDeliveryHeadM)} ÷ (${f(i.efficiency,3)} × ${f(m.requiredSourceFlow?.netDriveHeadM ?? h.netDriveHeadM)})`,
      Number.isFinite(Number(m.requiredSourceFlow?.requiredSourceFlowLps)) ? `${flow(m.requiredSourceFlow.requiredSourceFlowLps)} L/min` : 'No finite solution',
      `Because drive-pipe friction depends on source flow, ABEARC iterates this equation with the selected drive-pipe diameter. Iterations: ${m.requiredSourceFlow?.iterations || 0}; ${m.requiredSourceFlow?.converged ? 'converged' : 'engineering review required'}.`
    ) : '';

    const selectedGilman = gilmanModelByName(i.pumpModel) || currentGilmanRecommendation()?.recommended || null;
    const assessmentClass = state.assessment?.level === 'feasible' ? 'ok' : state.assessment?.level === 'review' ? 'warn' : 'fail';
    const assessmentLabel = state.assessment?.title || (assessmentClass === 'ok' ? 'Feasible for preliminary design' : assessmentClass === 'warn' ? 'Engineering review required' : 'No practical ram-pump layout');
    const reportCheck = (label, value, ok=true) => `<tr><td><span class="sheet-check ${ok ? 'ok' : 'no'}">${ok ? '✓' : '!'}</span>${esc(label)}</td><td>${esc(value)}</td><td class="sheet-status ${ok ? 'ok' : 'no'}">${ok ? 'OK' : 'REVIEW'}</td></tr>`;
    const reportSheetHtml = `<section class="report-sheet">
      <header class="sheet-masthead">
        <div class="sheet-brand"><b>ABEARC</b><span>Agricultural and Biosystems Engineering<br>Planning & Design System</span></div>
        <div class="sheet-title"><h1>Hydraulic Ram Pump — Detailed Calculation</h1><p>Terrain-aware preliminary hydraulic ram-pump planning</p></div>
        <table class="sheet-meta"><tr><th>Project</th><td>${esc(state.name)}</td></tr><tr><th>Generated</th><td>${esc(String(state.updatedAt || state.generatedAt || now()).slice(0,19).replace('T',' '))}</td></tr><tr><th>Elevation</th><td>${esc(m.sourceLabel || state.elevationSourceLabel || SOURCE_LABELS[state.elevationSource])}</td></tr><tr><th>Basis</th><td>${esc(i.designBasis === 'peace-corps-s2' ? 'Peace Corps / Warwick S-2' : 'Generic / manufacturer-specific')}</td></tr></table>
      </header>
      <div class="sheet-section sheet-figure-section"><div class="sheet-section-head"><span>1</span><strong>Ram-pump system figure</strong><div class="sheet-actions"><button onclick="window.print()">Print / PDF</button></div></div><div class="sheet-section-body">${pumpFigure}</div></div>
      <div class="sheet-section"><div class="sheet-section-head"><span>2</span><strong>Elevation profile</strong></div><div class="sheet-section-body">${elevationProfileFigure || '<p class="note">Elevation profile unavailable.</p>'}</div></div>
      <div class="sheet-grid sheet-grid-3">
        <section class="sheet-panel"><h3><span>3</span>Design inputs and geometry</h3><table><tr><th>Item</th><th>Value</th><th>Unit / note</th></tr><tr><td>Source elevation</td><td>${f(m.sourceElevationM)}</td><td>m</td></tr><tr><td>Pump elevation</td><td>${f(m.pumpElevationM)}</td><td>m</td></tr><tr><td>Tank / destination elevation</td><td>${f(m.destinationElevationM)}</td><td>m</td></tr><tr><td>Drive-pipe length</td><td>${f(m.effectiveDriveLengthM || m.driveLengthM,1)}</td><td>m</td></tr><tr><td>Delivery-pipe length</td><td>${f(m.deliveryLengthM,1)}</td><td>m</td></tr><tr><td>${i.desiredDeliveryFlowLps > 0 ? 'Required source flow' : 'Available source flow'}</td><td>${flow(i.sourceFlowLps)}</td><td>L/min</td></tr><tr><td>Desired delivery flow</td><td>${i.desiredDeliveryFlowLps > 0 ? flow(i.desiredDeliveryFlowLps) : '—'}</td><td>L/min</td></tr></table></section>
        <section class="sheet-panel"><h3><span>4</span>Elevation and head calculation</h3><table><tr><th>Item</th><th>Calculation</th><th>Value</th></tr><tr><td>Drive head h</td><td>Zs − Zp</td><td>${f(m.driveHeadM)} m</td></tr><tr><td>Delivery head H</td><td>Zd − Zp</td><td>${f(m.deliveryHeadM)} m</td></tr><tr><td>Head ratio H/h</td><td>H ÷ h</td><td>${f(m.headRatio,2)}</td></tr><tr><td>Delivery high point</td><td>Zhigh − Zp</td><td>${f(m.deliveryHighPointLiftM)} m</td></tr><tr><td>Governing lift</td><td>max(H,Hhigh)</td><td>${f(m.governingDeliveryLiftM)} m</td></tr></table></section>
        <section class="sheet-panel"><h3><span>5</span>Pipe sizing calculation</h3><table><tr><th>Pipe</th><th>D (mm)</th><th>Equivalent D (in)</th><th>Length</th></tr><tr><td>Drive pipe</td><td>${f(driveD,0)}</td><td>${esc(nominalPipeInchLabel(driveD))}</td><td>${f(m.effectiveDriveLengthM || m.driveLengthM,1)} m</td></tr><tr><td>Delivery pipe</td><td>${f(deliveryD,0)}</td><td>${esc(nominalPipeInchLabel(deliveryD))}</td><td>${f(m.deliveryLengthM,1)} m</td></tr>${dc.deviceType && dc.deviceType !== 'none' ? `<tr><td>Supply pipe</td><td>${f(dc.supplyPipeDiameterMm,0)}</td><td>${esc(nominalPipeInchLabel(dc.supplyPipeDiameterMm))}</td><td>${f(dc.supplyLengthM,1)} m</td></tr>` : ''}</table><p class="sheet-note">Equivalent D (in) uses nearest standard nominal inch sizes, not decimal conversion.</p></section>
      </div>
      <div class="sheet-grid sheet-grid-3">
        <section class="sheet-panel"><h3><span>6</span>Pipe hydraulics — Hazen-Williams</h3><table><tr><th>Item</th><th>Drive</th><th>Delivery</th></tr><tr><td>Design flow</td><td>${flow(i.sourceFlowLps)} L/min</td><td>${flow(h.deliveredFlowLps)} L/min</td></tr><tr><td>Velocity</td><td>${f(driveV,3)} m/s</td><td>${f(deliveryV,3)} m/s</td></tr><tr><td>Head loss hf</td><td>${f(h.driveFrictionLossM)} m</td><td>${f(h.deliveryFrictionLossM)} m</td></tr><tr><td>H-W C</td><td colspan="2">${f(i.hazenWilliamsC,0)}</td></tr></table><div class="sheet-formula">h<sub>f</sub> = 10.67 LQ<sup>1.852</sup> / (C<sup>1.852</sup>D<sup>4.871</sup>)</div></section>
        <section class="sheet-panel"><h3><span>7</span>Ram-pump flow estimate</h3><table><tr><th>Item</th><th>Value</th></tr><tr><td>Source / drive flow Qs</td><td>${flow(i.sourceFlowLps)} L/min</td></tr><tr><td>Delivery flow Qd</td><td>${flow(h.deliveredFlowLps)} L/min</td></tr><tr><td>Waste flow</td><td>${flow(h.wasteFlowLps)} L/min</td></tr><tr><td>Planning efficiency η</td><td>${f(i.efficiency*100,1)}%</td></tr><tr><td>Operating hours/day</td><td>${f(i.operatingHoursPerDay,1)}</td></tr><tr><td>Daily delivered volume</td><td>${f(h.deliveredM3Day,2)} m³/day</td></tr></table></section>
        <section class="sheet-panel"><h3><span>8</span>Calculated engineering results</h3><table><tr><th>Result</th><th>Value</th></tr><tr><td>Net drive head</td><td>${f(h.netDriveHeadM)} m</td></tr><tr><td>Total delivery head</td><td>${f(h.totalDeliveryHeadM)} m</td></tr><tr><td>Drive alignment</td><td>${m.driveRouteStraight ? 'Straight / no turns' : `${m.driveBendCount} bend${m.driveBendCount===1?'':'s'}`}</td></tr><tr><td>Drive installation</td><td>${i.driveInstallation === 'elevated-supports' ? 'Elevated support frames' : 'On ground'}</td></tr><tr><td>Maximum support height</td><td>${i.driveInstallation === 'elevated-supports' ? `${f(m.driveSupport?.maxRequiredSupportHeightM,2)} m` : '—'}</td></tr><tr><td>Model basis</td><td>${model}</td></tr></table></section>
      </div>
      <div class="sheet-grid sheet-grid-3">
        <section class="sheet-panel"><h3><span>9</span>Feasibility assessment</h3><table class="sheet-check-table">${reportCheck('Drive head ≥ minimum', `${f(m.driveHeadM)} m`, m.driveHeadM >= i.minDriveHeadM)}${reportCheck('Governing lift ≤ configured limit', `${f(m.governingDeliveryLiftM)} / ${f(i.maxDeliveryLiftM,0)} m`, m.governingDeliveryLiftM <= i.maxDeliveryLiftM)}${reportCheck('Net drive head positive', `${f(h.netDriveHeadM)} m`, h.netDriveHeadM > 0)}${reportCheck('Estimated delivery flow positive', `${flow(h.deliveredFlowLps)} L/min`, h.deliveredFlowLps > 0)}${reportCheck('Drive alignment constructible', m.driveRouteStraight ? 'Straight' : `${m.driveBendCount} bends`, state.assessment?.level !== 'not-feasible')}</table><div class="sheet-result ${assessmentClass}"><strong>${esc(assessmentLabel)}</strong></div></section>
        <section class="sheet-panel"><h3><span>10</span>Peace Corps / Warwick S-2 cross-check</h3><table><tr><th>Reference</th><th>Typical / published</th><th>Our value</th></tr><tr><td>Source flow</td><td>40–120 L/min</td><td>${flow(i.sourceFlowLps)} L/min</td></tr><tr><td>Drive head</td><td>2–15 m</td><td>${f(m.driveHeadM)} m</td></tr><tr><td>Delivery head</td><td>≤ 100 m</td><td>${f(m.deliveryHeadM)} m</td></tr><tr><td>Rigid drive length</td><td>150D–1000D</td><td>${f(dc.effectiveDriveLengthM || m.effectiveDriveLengthM || m.driveLengthM,1)} m</td></tr></table><p class="sheet-note">S-2 limits apply only when that reference basis is selected; other pump models require their own manufacturer limits.</p></section>
        <section class="sheet-panel"><h3><span>11</span>Manufacturer model cross-check</h3>${selectedGilman ? `<table><tr><th>Model</th><td>${esc(selectedGilman.model)}</td></tr><tr><th>Duty</th><td>${esc(selectedGilman.duty)}</td></tr><tr><th>Source-flow range</th><td>${f(selectedGilman.supplyFlowMinLpm,0)}–${f(selectedGilman.supplyFlowMaxLpm,0)} L/min</td></tr><tr><th>Published lift</th><td>${esc(selectedGilman.maxPumpLift)}</td></tr><tr><th>Ports</th><td>${esc(selectedGilman.drivePort)} / ${esc(selectedGilman.deliveryPort)}</td></tr></table>` : `<p class="sheet-note">No exact offline Gilman model match for the generated duty point.</p>`}<p class="sheet-note">Manufacturer selection remains preliminary until the applicable performance curve is verified.</p></section>
      </div>
      <section class="sheet-panel sheet-notes"><h3><span>12</span>Calculation method notes</h3><ol><li>Terrain elevations are DEM/DTM planning values and require survey verification.</li><li>Pipe sizing is preliminary and must be checked against actual pipe ID, SDR/class, fittings and availability.</li><li>Hazen-Williams friction uses the configured C value; minor losses and transient pressure are outside this preliminary model.</li><li>Ram-pump delivery uses the preliminary energy relationship Qd ≈ Qs × η × Hd,net / Ht.</li><li>Final construction requires manufacturer performance verification, anchorage, foundation/support-frame design, access and site inspection.</li></ol></section>
    </section>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.name)} — Full Ram Pump Calculation</title><style>
      :root{font-family:Inter,Arial,sans-serif;color:#1f2937;background:#eef2f5}*{box-sizing:border-box}body{margin:0}.page{max-width:1120px;margin:24px auto;padding:28px;background:#fff;box-shadow:0 8px 30px #0f172a18}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #0f6f9f;padding-bottom:16px}h1{font-size:24px;margin:0 0 5px}h2{font-size:17px;margin:28px 0 10px;color:#0f5f87}h3{font-size:14px;margin:0 0 8px}.muted,.note{color:#64748b;font-size:12px;line-height:1.5}.actions{display:flex;gap:8px}.actions button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dce5eb;padding:8px;text-align:left;vertical-align:top}th{width:36%;background:#f8fafc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.calc{border:1px solid #dce5eb;border-radius:8px;padding:12px;break-inside:avoid}.formula{font-family:Cambria Math,serif;font-size:15px;background:#f8fafc;padding:8px;border-radius:5px}.sub{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:#475569;margin-top:7px;word-break:break-word}.result{font-weight:800;color:#0f6f9f;margin-top:6px}.calc p{font-size:11px;color:#64748b;margin:7px 0 0}.assessment{border-left:4px solid #d97706;background:#fffbeb;padding:12px 14px}.assessment strong{display:block;margin-bottom:5px}.assessment li{font-size:12px;margin:4px 0}.coords{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.report-hero{margin:16px 0 22px;border:1px solid #cfe0ea;border-radius:12px;background:linear-gradient(180deg,#ffffff,#f7fbfe);padding:14px;break-inside:avoid}.report-hero-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-end;margin-bottom:10px}.report-hero-head strong{display:block;font-size:18px;color:#12263f}.report-hero-head span{display:block;font-size:12px;color:#64748b;margin-top:3px}.report-hero-note{font-size:12px;color:#475569;max-width:420px;line-height:1.45;margin:0}.report-hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:0 0 12px}.hero-card{border:1px solid #dde8ef;border-radius:10px;background:#fff;padding:10px 12px;box-shadow:0 1px 2px rgba(15,23,42,.04)}.hero-card strong{display:block;font-size:11px;letter-spacing:.02em;text-transform:uppercase;color:#0f4c81;margin-bottom:4px}.hero-card span{display:block;font-size:14px;font-weight:700;color:#172033;line-height:1.35}.report-hero-image{margin:0;border:1px solid #d6e3ea;border-radius:10px;background:#fff;overflow:hidden}.report-hero-image img{display:block;width:100%;height:auto}.report-hero-image figcaption{padding:10px 12px;font-size:11px;color:#64748b;line-height:1.45;background:#f8fafc;border-top:1px solid #e5edf3}.ram-manual-figure{display:grid;justify-items:center;gap:10px}.ram-manual-reference{display:block;width:min(100%,850px);max-width:850px;height:auto;object-fit:contain;image-rendering:auto}.ram-manual-design-annotations{width:100%;border:1px solid #dbe5ea;border-radius:8px;background:#f8fbfd;padding:14px}.ram-manual-design-annotations>strong{display:block;color:#173f5b;font-size:13px;margin-bottom:10px}.ram-manual-design-annotations dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ram-manual-design-annotations dl>div{padding:10px;border:1px solid #e1e9ee;border-radius:6px;background:#fff;min-width:0}.ram-manual-design-annotations dt{font-size:10px;color:#64748b;font-weight:800;margin-bottom:4px}.ram-manual-design-annotations dd{margin:0;font-size:11px;line-height:1.55;overflow-wrap:anywhere}@media(max-width:720px){.ram-manual-design-annotations dl{grid-template-columns:1fr}.ram-manual-figure img{min-width:0!important}}.ram-figure,.ram-profile-figure{margin:16px 0 22px;border:1px solid #d6e3ea;border-radius:10px;background:#fbfdfe;padding:12px;break-inside:avoid}.ram-figure svg,.ram-profile-figure svg{display:block;width:100%;height:auto}.ram-figure figcaption,.ram-profile-figure figcaption{font-size:11px;color:#64748b;line-height:1.45;margin:7px 4px 1px}.ram-profile-figure-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-end;margin:0 0 10px}.ram-profile-figure-head strong{font-size:14px;color:#172033}.ram-profile-figure-head span{font-size:11px;color:#64748b}.ram-profile-grid line{stroke:#e4ebef;stroke-width:1}.ram-profile-grid text{fill:#64748b;font:650 10px Arial,sans-serif}.ram-profile-drive,.ram-profile-supply,.ram-profile-delivery,.ram-profile-drive-terrain{fill:none;stroke-linejoin:round;stroke-linecap:round}.ram-profile-drive,.ram-profile-delivery{stroke-width:3}.ram-profile-drive{stroke:#0f766e}.ram-profile-supply{stroke:#0f766e;stroke-width:2.2;stroke-dasharray:7 4;opacity:.75}.ram-profile-delivery{stroke:#2563eb}.ram-profile-drive-terrain{stroke:#8b7355;stroke-width:1.7;stroke-dasharray:5 4;opacity:.85}.ram-profile-label-leader{stroke:#475569;stroke-width:1.1}.ram-profile-label-box{fill:#f8fafc;stroke:#cbd5e1;stroke-width:1;cursor:move}.ram-profile-draggable-label:hover .ram-profile-label-box{fill:#f0f9ff;stroke:#7dd3fc}.ram-profile-label-text{fill:#334155;font:800 10px Arial,sans-serif}.ram-profile-label-text .is-title{fill:#172033;font-weight:900}.ram-profile-draggable-label.source .ram-profile-label-box{stroke:#14b8a6}.ram-profile-draggable-label.pump .ram-profile-label-box{stroke:#f59e0b}.ram-profile-draggable-label.destination .ram-profile-label-box{stroke:#3b82f6}.ram-profile-draggable-label.high-point .ram-profile-label-box,.ram-profile-draggable-label.standpipe .ram-profile-label-box{stroke:#8b5cf6}.report-sheet{border:1px solid #7894ab;background:#fff;margin:18px 0 28px;box-shadow:0 4px 18px rgba(15,23,42,.08)}.sheet-masthead{display:grid;grid-template-columns:210px 1fr 285px;border-bottom:3px solid #164f7e;min-height:92px}.sheet-brand{padding:14px 16px;border-right:1px solid #aebdca}.sheet-brand b{display:block;font-size:30px;line-height:1;color:#12385f;letter-spacing:.02em}.sheet-brand span{display:block;margin-top:7px;font-size:10px;line-height:1.35;color:#475569}.sheet-title{padding:12px 18px;text-align:center;align-self:center}.sheet-title h1{font-size:24px;margin:0;color:#172033}.sheet-title p{margin:6px 0 0;color:#526476;font-size:12px}.sheet-meta{border-collapse:collapse;width:100%;font-size:10px}.sheet-meta th,.sheet-meta td{padding:5px 7px;border:0;border-left:1px solid #d7e1e8;border-bottom:1px solid #e6edf2}.sheet-meta th{width:72px;background:#f6f9fb;color:#425466}.sheet-section{border-top:1px solid #8fa8bb}.sheet-section:first-of-type{border-top:0}.sheet-section-head{display:flex;align-items:center;min-height:34px;border-bottom:1px solid #b6c7d4;background:#f8fbfd}.sheet-section-head>span,.sheet-panel h3>span{display:inline-grid;place-items:center;align-self:stretch;min-width:38px;margin-right:10px;background:#0e4d7a;color:#fff;font-size:17px;font-weight:900}.sheet-section-head>strong{font-size:15px;color:#172033}.sheet-actions{margin-left:auto;display:flex;gap:5px;padding-right:7px}.sheet-actions button{font-size:10px;border:1px solid #9eb5c6;background:#fff;border-radius:4px;padding:5px 8px;color:#194d75;font-weight:800}.sheet-section-body{padding:8px}.sheet-section-body .ram-figure,.sheet-section-body .ram-profile-figure{margin:0;border:0;padding:0;background:#fff}.sheet-grid{display:grid;border-top:1px solid #8fa8bb}.sheet-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.sheet-panel{min-width:0;border-right:1px solid #8fa8bb;background:#fff}.sheet-panel:last-child{border-right:0}.sheet-panel h3{height:32px;display:flex;align-items:center;margin:0;border-bottom:1px solid #b6c7d4;background:#f8fbfd;font-size:12px;color:#172033}.sheet-panel h3>span{height:32px;min-width:32px;font-size:14px}.sheet-panel table{border-collapse:collapse;width:100%;font-size:9.5px}.sheet-panel th,.sheet-panel td{padding:5px 6px;border:1px solid #dce5eb;border-top:0}.sheet-panel th{background:#f8fafc;width:auto;font-weight:800}.sheet-panel .sheet-note{margin:6px 8px 8px;font-size:9.5px;color:#64748b;line-height:1.35}.sheet-formula{margin:8px;padding:7px;background:#f6f9fb;border:1px solid #e2eaf0;border-radius:4px;font-family:Cambria Math,serif;font-size:11px}.sheet-check-table td:first-child{white-space:normal}.sheet-check{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;margin-right:5px;font-size:10px;font-weight:900}.sheet-check.ok{background:#dcfce7;color:#15803d}.sheet-check.no{background:#fee2e2;color:#b91c1c}.sheet-status{font-weight:900}.sheet-status.ok{color:#15803d}.sheet-status.no{color:#b91c1c}.sheet-result{margin:7px;border-radius:5px;padding:7px 9px;font-size:10px}.sheet-result.ok{background:#dcfce7;color:#166534}.sheet-result.warn{background:#fef3c7;color:#92400e}.sheet-result.fail{background:#fee2e2;color:#991b1b}.sheet-notes{border-top:1px solid #8fa8bb;border-right:0}.sheet-notes ol{columns:2;column-gap:28px;margin:9px 14px 12px;padding-left:18px;font-size:9.5px;color:#475569}.sheet-notes li{margin:0 0 5px;break-inside:avoid}.detailed-appendix-title{margin-top:36px!important;border-top:3px solid #0f5f87;padding-top:20px}@media(max-width:900px){.sheet-masthead{grid-template-columns:1fr}.sheet-brand,.sheet-meta{border:0}.sheet-title{text-align:left}.sheet-grid-3{grid-template-columns:1fr}.sheet-panel{border-right:0;border-bottom:1px solid #8fa8bb}.sheet-notes ol{columns:1}}@media print{.report-sheet{box-shadow:none}.sheet-actions{display:none}.sheet-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}}.sizing-block{border:1px solid #dce5eb;border-radius:9px;padding:12px;margin:10px 0 16px;break-inside:avoid}.sizing-badges{display:flex;gap:6px;flex-wrap:wrap;margin:-2px 0 10px}.sizing-badges span{background:#eef6fa;border:1px solid #cfe0e9;border-radius:999px;padding:4px 8px;color:#476273;font-size:10px;font-weight:800}.table-scroll{overflow:auto}.sizing-table th{width:auto;white-space:nowrap}.sizing-table td{font-variant-numeric:tabular-nums}.sizing-table tr.selected td{background:#ecfeff;border-color:#67e8f9}.sizing-table tr.selected td:last-child{color:#0f6f9f}.sizing-equations{margin-bottom:10px}@media(max-width:720px){.page{margin:0;padding:16px}.grid{grid-template-columns:1fr}.top{display:block}.actions{margin-top:12px}.ram-figure,.ram-profile-figure{padding:6px;overflow:auto}.ram-figure svg,.ram-profile-figure svg{min-width:980px}}@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none}.actions{display:none}.table-scroll{overflow:visible}.ram-figure svg,.ram-profile-figure svg{min-width:0}}
    </style></head><body><main class="page">${reportSheetHtml}<div class="top"><div><h1 class="detailed-appendix-title">Detailed equation appendix</h1><div class="muted">${esc(state.name)} · Generated ${esc(state.updatedAt || state.generatedAt || now())}</div><div class="muted">Elevation source: ${esc(m.sourceLabel || state.elevationSourceLabel || SOURCE_LABELS[state.elevationSource])}</div></div><div class="actions"><button onclick="window.print()">Print / Save PDF</button></div></div>
      <p class="note"><b>Engineering status:</b> Preliminary planning calculation only. Verify surveyed elevations, dependable source discharge, pipe internal diameter/pressure class, actual fittings, valve losses, foundation/access conditions, and the selected manufacturer's ram-pump performance curve before construction.</p>
      <h2>1. Ram-pump system figure</h2>${pumpFigure}
      <h2>2. Elevation profile</h2>${elevationProfileFigure || '<p class="note">Elevation profile unavailable for this generated layout.</p>'}
      <h2>3. Design inputs and geometry</h2><table><tr><th>Water source</th><td class="coords">${f(state.source?.[1],6)}, ${f(state.source?.[0],6)}</td></tr><tr><th>Ram pump</th><td class="coords">${f(state.pump?.[1],6)}, ${f(state.pump?.[0],6)}</td></tr><tr><th>Service area / reservoir</th><td class="coords">${f(state.destination?.[1],6)}, ${f(state.destination?.[0],6)}</td></tr><tr><th>${i.desiredDeliveryFlowLps > 0 ? 'Required source flow Qs' : 'Available source flow Qs'}</th><td>${flow(i.sourceFlowLps)} L/min${i.desiredDeliveryFlowLps > 0 ? ' · automatically calculated' : ''}</td></tr><tr><th>Desired delivery flow</th><td>${i.desiredDeliveryFlowLps > 0 ? `${flow(i.desiredDeliveryFlowLps)} L/min` : 'Not specified'}</td></tr><tr><th>Maximum delivery lift</th><td>${f(i.maxDeliveryLiftM,0)} m (hard planning limit)</td></tr><tr><th>Drive pipe installation</th><td>${i.driveInstallation === 'elevated-supports' ? `Elevated on support frames · max frame ${f(i.maxSupportHeightM,1)} m` : 'On ground / terrain-following'}</td></tr><tr><th>Drive alignment rule</th><td>${i.driveAlignment === 'straight-only' ? 'Straight only' : i.driveAlignment === 'terrain-following' ? 'Terrain-following allowed' : 'Straight preferred (recommended)'}</td></tr><tr><th>Reference design basis</th><td>${i.designBasis === 'peace-corps-s2' ? 'Peace Corps / Warwick S-2' : 'Generic / manufacturer-specific'}</td></tr><tr><th>Drive-pipe length guideline</th><td>${i.driveLengthRule === 'peace-corps' ? 'Peace Corps / Warwick 150D–1000D' : 'Manufacturer / final engineering review'}</td></tr><tr><th>Long-drive treatment</th><td>${i.longDriveTreatment === 'drive-tank' ? 'Drive tank when required' : i.longDriveTreatment === 'none' ? 'No automatic device' : 'Automatic standpipe when required'}</td></tr><tr><th>Generated drive alignment</th><td>${m.driveRouteStraight ? 'Straight / no turns' : `${m.driveBendCount} bend${m.driveBendCount===1?'':'s'}`}</td></tr><tr><th>Planning efficiency η</th><td>${f(i.efficiency*100,1)}%</td></tr><tr><th>Hazen-Williams coefficient C</th><td>${f(i.hazenWilliamsC,0)}</td></tr><tr><th>Pipe material</th><td>${esc(i.pipeMaterial)}</td></tr><tr><th>Ram-pump model / size</th><td>${model}</td></tr></table>
      <h2>4. Elevation and head calculation</h2><div class="grid">
      ${equation('Available drive head','Hd = Zsource − Zpump',`${f(m.sourceElevationM)} − ${f(m.pumpElevationM)}`,`${f(m.driveHeadM)} m`)}
      ${equation('Gross delivery head','H = Zdestination − Zpump',`${f(m.destinationElevationM)} − ${f(m.pumpElevationM)}`,`${f(m.deliveryHeadM)} m`,'This is the static pump-to-destination head used by the current preliminary ram-pump energy estimate. Review the mapped delivery high point separately below.')}
      ${equation('Head ratio','H/h = H ÷ Hd',`${f(m.deliveryHeadM)} ÷ ${f(m.driveHeadM)}`,`${f(m.headRatio,2)}`)}
      ${equation('Source-to-destination lift','ΔZ = Zdestination − Zsource',`${f(m.destinationElevationM)} − ${f(m.sourceElevationM)}`,`${f(m.sourceToDestinationLiftM)} m`)}
      ${equation('Rigid drive-pipe grade','Slope = ΔZpipe ÷ Leffective × 100',`${f(m.rigidDriveDropM ?? m.driveHeadM)} ÷ ${f(m.effectiveDriveLengthM ?? m.driveLengthM,1)} × 100`,`${f(m.driveSlopePct,2)} %`, m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' ? `The open ${m.drivePipeControl.deviceType === 'drive-tank' ? 'drive tank' : 'standpipe'} preserves source-water static head; available drive head Hd remains Zsource − Zpump, while the physical rigid pipe begins at the device connection elevation.` : '')}
      ${i.driveInstallation === 'elevated-supports' ? equation('Elevated support-frame check','Zsupport = Zpipe,grade − Zterrain',`Maximum required support = ${f(m.driveSupport?.maxRequiredSupportHeightM)} m`,`${f(m.driveSupport?.maxRequiredSupportHeightM)} m ≤ ${f(i.maxSupportHeightM,1)} m limit`,`The drive-pipe design grade is a continuous straight-line descent in elevation from source to pump. Maximum terrain intrusion above that grade = ${f(m.driveSupport?.terrainIntrusionM,2)} m; supports alone cannot correct a positive terrain intrusion.`) : ''}
      ${equation('Delivery high point','Hhigh = Zhigh − Zpump',`${f(m.deliveryHighPointElevationM)} − ${f(m.pumpElevationM)}`,`${f(m.deliveryHighPointLiftM)} m`,`Highest sampled delivery-route elevation occurs at chainage ${f(m.deliveryHighPointChainageM,1)} m.`)}
      ${equation('Maximum-lift check','Hgoverning = max(Hdestination, Hhigh)',`max(${f(m.deliveryHeadM)}, ${f(m.deliveryHighPointLiftM)})`,`${f(m.governingDeliveryLiftM)} m ≤ ${f(i.maxDeliveryLiftM,0)} m limit`, m.governingDeliveryLiftM <= i.maxDeliveryLiftM ? 'PASS — generated layout is within the configured maximum lift.' : 'FAIL — the layout exceeds the configured maximum lift and is not considered practical by this tool.')}
      </div>
      ${driveLengthCheckHtml}
      <h2>${dc.enabled ? '6' : '5'}. Pipe sizing calculation</h2><p class="note">For automatic sizing, ABEARC checks the standard HDPE diameter series in ascending order. A standard diameter passes the preliminary screen when velocity is within the configured range and Hazen-Williams friction is no more than 8% of pipe length. The theoretical equations below explain the diameter bounds; the adopted size is a discrete standard diameter, not a continuously solved diameter.</p>
      ${sizingTable('Drive pipe sizing', driveSizing)}${sizingTable('Delivery pipe sizing', deliverySizing)}
      <h2>${dc.enabled ? '7' : '6'}. Pipe hydraulics — Hazen-Williams</h2><p class="note">Flow is displayed in L/min (litres per minute). For SI hydraulic equations, Q (m³/s) = Q (L/min) ÷ 60,000; pipe diameter d is in metres.</p><div class="grid">
      ${equation('Drive-pipe friction loss','hf = 10.67 L Q^1.852 / (C^1.852 d^4.871)',hwDrive,`${f(h.driveLossM)} m`,`Drive pipe Ø${f(driveD,0)} mm; velocity ${f(driveV)} m/s.`)}
      ${equation('Net drive head','Hd,net = Hd,gross − hf,drive',`${f(h.grossDriveHeadM)} − ${f(h.driveLossM)}`,`${f(h.netDriveHeadM)} m`)}
      ${equation('Delivery-pipe friction loss','hf = 10.67 L Q^1.852 / (C^1.852 d^4.871)',hwDelivery,`${f(h.deliveryLossM)} m`,`Delivery pipe Ø${f(deliveryD,0)} mm; final delivery velocity ${f(deliveryV)} m/s. The solver iterates because delivery friction depends on the unknown delivered flow.`)}
      ${equation('Total delivery head in energy estimate','Ht = Hgross + hf,delivery',`${f(h.grossDeliveryHeadM)} + ${f(h.deliveryLossM)}`,`${f(h.totalDeliveryHeadM)} m`)}
      </div>
      <h2>${dc.enabled ? '8' : '7'}. Ram-pump flow estimate</h2><div class="grid">
      ${requiredSourceEquation}
      ${equation('Delivered flow','Qd = Qs × Hd,net / Ht × η',`${flow(h.sourceFlowLps)} × ${f(h.netDriveHeadM)} ÷ ${f(h.totalDeliveryHeadM)} × ${f(h.efficiency,3)}`,`${flow(h.deliveredFlowLps)} L/min`,`Delivery-friction solver: ${h.iterations || 0} iteration(s); ${h.converged ? 'converged' : 'did not fully converge within the iteration limit'}.`)}
      ${equation('Waste flow','Qw = Qs − Qd',`${flow(h.sourceFlowLps)} − ${flow(h.deliveredFlowLps)}`,`${flow(h.wasteFlowLps)} L/min`)}
      ${equation('Daily delivered volume','Vd = Qd × 0.06 × operating hours',`${flow(h.deliveredFlowLps)} × 0.06 × ${f(h.operatingHours,1)}`,`${f(h.deliveredM3Day,1)} m³/day`)}
      ${equation('Daily source water','Vs = Qs × 0.06 × operating hours',`${flow(h.sourceFlowLps)} × 0.06 × ${f(h.operatingHours,1)}`,`${f(h.sourceM3Day,1)} m³/day`)}
      </div>
      <h2>${dc.enabled ? '9' : '8'}. Calculated engineering results</h2><table>${rows}</table>
      <h2>${dc.enabled ? '10' : '9'}. Feasibility assessment</h2><div class="assessment"><strong>${esc(state.assessment?.title || 'Engineering review required')}</strong><ul>${reasons || '<li>No additional diagnostic notes.</li>'}</ul></div>
      ${(() => {
        if (i.designBasis === 'peace-corps-s2') {
          const ref = core()?.PEACE_CORPS_S2 || {}, chartD = core()?.peaceCorpsS2DriveDiameterMm?.(i.sourceFlowLps);
          return `<h2>${dc.enabled ? '11' : '10'}. Peace Corps / Warwick S-2 reference cross-check</h2><table><tr><th>Reference source-flow range</th><td>${f(ref.sourceFlowMinLpm || 40,0)}–${f(ref.sourceFlowMaxLpm || 120,0)} L/min</td></tr><tr><th>Current source / required source flow</th><td>${flow(i.sourceFlowLps)} L/min</td></tr><tr><th>Reference drive-head range</th><td>${f(ref.driveHeadMinM || 2,0)}–${f(ref.driveHeadMaxM || 15,0)} m</td></tr><tr><th>Current drive head</th><td>${f(m.driveHeadM,2)} m</td></tr><tr><th>Reference maximum delivery head</th><td>${f(ref.deliveryHeadMaxM || 100,0)} m</td></tr><tr><th>Current governing delivery lift</th><td>${f(m.governingDeliveryLiftM,2)} m</td></tr><tr><th>Table 2 reference drive diameter</th><td>${chartD ? `${f(chartD,1)} mm (${nominalPipeInchLabel(chartD, true)})` : 'Outside the S-2 Table 2 source-flow range'}</td></tr><tr><th>Adopted drive diameter</th><td>${f(m.drivePipe?.diameterMm,1)} mm</td></tr></table><p class="note">The S-2 operating envelope and drive-pipe rules are reference design constraints from the Peace Corps Philippines manual. Field survey, fabrication details, valve settings, anchorage, pipe pressure class and final engineering verification remain required.</p>`;
        }
        const rec = currentGilmanRecommendation(), selected = gilmanModelByName(i.pumpModel), model = selected || rec?.recommended;
        const snapshot = core()?.GILMAN_CATALOG_SNAPSHOT;
        if (!model) return `<h2>${dc.enabled ? '11' : '10'}. Manufacturer model cross-check — offline Gilman catalog</h2><div class="warn"><strong>No exact model match</strong><br>${esc(rec?.reason || 'No model recommendation available.')}</div><p class="note">Catalog snapshot ${esc(snapshot?.capturedAt || '')}; ABEARC does not query the manufacturer website at runtime.</p>`;
        return `<h2>${dc.enabled ? '11' : '10'}. Manufacturer model cross-check — offline Gilman catalog</h2><table><tr><th>Model</th><td>${esc(model.model)}${selected ? ' (user selected)' : ' (auto suggested)'}</td></tr><tr><th>Duty class</th><td>${esc(model.duty)}</td></tr><tr><th>Published source-flow range</th><td>${f(model.supplyFlowMinLpm,0)}–${f(model.supplyFlowMaxLpm,0)} L/min</td></tr><tr><th>Published maximum pump lift</th><td>${esc(model.maxPumpLift)}</td></tr><tr><th>Published daily output</th><td>${esc(model.dailyOutput)}</td></tr><tr><th>Drive / delivery ports</th><td>${esc(model.drivePort)} / ${esc(model.deliveryPort)}</td></tr><tr><th>Weight / package</th><td>${esc(model.weight)} / ${esc(model.packaging)}</td></tr></table><p class="note">${esc(rec?.reason || '')} Catalog snapshot ${esc(snapshot?.capturedAt || '')}. Current price/stock and final manufacturer performance must be re-verified for procurement/final design.</p>`;
      })()}
      <h2>${dc.enabled ? '12' : '11'}. Calculation method notes</h2><ol class="note"><li>Terrain elevations are sampled from the selected DEM/DTM source; they are not a substitute for site survey elevations.</li><li>Automatic pipe sizing evaluates the published standard diameter list used by this ABEARC planning module. Confirm actual pipe internal diameter, SDR/pressure class and locally available commercial sizes.</li><li>Drive-pipe friction and delivery-pipe friction use Hazen-Williams with the entered C coefficient and selected/automatic planning diameter. When a standpipe/drive tank is inserted, the ram-pump drive-pipe friction calculation uses only the effective rigid drive segment from the dissipation device to the pump; the upstream supply pipe is reported separately.</li><li>When the Peace Corps / Warwick rule is enabled, ABEARC checks Lmin = 150D and Lmax = 1000D. For a long run, the generated standpipe/drive-tank top is set at least 0.3 m above source-water elevation; the reference standpipe is sized at least 1 in larger than the drive pipe and the upstream supply pipe about 0.5 in larger, rounded upward to the local standard diameter list.</li><li>The generic ram-pump estimate applies the energy relationship Qd ≈ Qs × (Hd,net/Ht) × η. When a desired delivery flow is entered, ABEARC rearranges this relationship and iterates drive-pipe friction to calculate the required source flow. It is not a manufacturer performance curve.</li><li>The delivery solver iterates friction loss and delivered flow until the change is below 0.03 L/min or the iteration limit is reached.</li><li>For Elevated on support frames, ABEARC checks a continuously descending drive-pipe design grade independently from the natural-ground profile. Support frames may bridge low/undulating ground, but terrain above the pipe grade requires a cut/trench, reroute or different pump site; structural sizing, bracing, foundations and support spacing are outside this preliminary model.</li><li>Minor losses, water-hammer/transient pressure, valve-specific losses, pipe wall class, air-valve requirements and structural anchorage are outside this preliminary model and require final engineering design.</li><li>The reference illustrations are for explanation only, not a fabrication detail. Final construction drawings and pipe pressure class must be verified for the selected pump and site.</li></ol>
    </main><script>
      function toSvgPoint(svg, event) {
        const matrix = svg.getScreenCTM();
        if (!matrix) return { x: 0, y: 0 };
        return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      }
      function installDraggableSvgLabels() {
        document.querySelectorAll('[data-ram-engineering-figure] svg rect.label, [data-ram-calculation-profile] [data-ram-draggable-label]').forEach(node => {
          const svg = node.ownerSVGElement;
          if (!svg) return;
          const group = node.matches('[data-ram-draggable-label]') ? node : null;
          const box = group ? group.querySelector('[data-drag-box]') : node;
          const line = group ? group.querySelector('[data-drag-line]') : null;
          const texts = group ? [...group.querySelectorAll('[data-drag-text]')] : [];
          if (!group) {
            const x = Number(box.getAttribute('x')), y = Number(box.getAttribute('y')), w = Number(box.getAttribute('width')), h = Number(box.getAttribute('height'));
            let cursor = box.nextElementSibling;
            while (cursor && cursor.tagName && cursor.tagName.toLowerCase() === 'text') {
              const tx = Number(cursor.getAttribute('x')), ty = Number(cursor.getAttribute('y'));
              if (tx >= x - 2 && tx <= x + w + 4 && ty >= y - 2 && ty <= y + h + 10) texts.push(cursor); else break;
              cursor = cursor.nextElementSibling;
            }
            box.style.cursor = 'move';
          }
          box.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const start = toSvgPoint(svg, event), boxX = Number(box.getAttribute('x')), boxY = Number(box.getAttribute('y'));
            const lineX2 = line ? Number(line.getAttribute('x2')) : 0, lineY2 = line ? Number(line.getAttribute('y2')) : 0;
            const textState = texts.map(text => ({ node:text, x:Number(text.getAttribute('x')), y:Number(text.getAttribute('y')), tspans:[...text.querySelectorAll('tspan')].map(t => Number(t.getAttribute('x'))) }));
            const move = e => {
              e.preventDefault();
              const point = toSvgPoint(svg, e), dx = point.x - start.x, dy = point.y - start.y;
              box.setAttribute('x', String(boxX + dx)); box.setAttribute('y', String(boxY + dy));
              if (line) { line.setAttribute('x2', String(lineX2 + dx)); line.setAttribute('y2', String(lineY2 + dy)); }
              textState.forEach(item => {
                item.node.setAttribute('x', String(item.x + dx)); item.node.setAttribute('y', String(item.y + dy));
                [...item.node.querySelectorAll('tspan')].forEach((tspan, idx) => tspan.setAttribute('x', String(item.tspans[idx] + dx)));
              });
            };
            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
            event.preventDefault();
            window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
          });
        });
      }
      installDraggableSvgLabels();
    </script></body></html>`;
  }

  function showAbearcRamPumpFullCalculation() {
    if (!state?.metrics) return toast('Generate a ram-pump layout first.', 'error');
    const tab = window.open('', '_blank');
    if (!tab) return toast('Allow pop-ups for ABEARC to open the full calculation.', 'error');
    try { tab.opener = null; tab.document.open(); tab.document.write(calculationPageHtml()); tab.document.close(); tab.focus(); }
    catch (error) { console.error('Unable to open ram-pump calculation page', error); try { tab.close(); } catch (_) {} toast('Unable to open the full calculation page.', 'error'); }
  }

  function svgEl(name, attributes = {}) { const element = document.createElementNS('http://www.w3.org/2000/svg', name); Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value))); return element; }
  function project(point) { const p = abearcMap?.project(point); return p ? [p.x, p.y] : null; }
  function pointsAttr(route) { return route.map(project).filter(Boolean).map(point => `${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' '); }
  function midpoint(route) { if (!route?.length) return null; const total = core().lineDistanceMetres(route); let walked = 0; for (let i = 1; i < route.length; i++) { const length = core().haversineMetres(route[i-1], route[i]); if (walked + length >= total / 2) { const ratio = length ? (total / 2 - walked) / length : 0; return [route[i-1][0] + (route[i][0]-route[i-1][0])*ratio, route[i-1][1] + (route[i][1]-route[i-1][1])*ratio]; } walked += length; } return route.at(-1); }

  function annotationDefinitions() {
    if (!state?.metrics) return [];
    const m = state.metrics, i = state.inputs;
    return [
      { id:'source', anchor:state.source, lines:['WATER SOURCE / INTAKE', `EL ${format(m.sourceElevationM)} m`, `Q ${flow(i.sourceFlowLps, 2)} L/min`], offset:[26,-46] },
      ...(m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' ? [
        { id:'supply', anchor:midpoint(m.drivePipeControl.supplyRoute), lines:['SUPPLY PIPE', `L ${format(m.drivePipeControl.supplyLengthM,1)} m · Ø${m.drivePipeControl.supplyPipeDiameterMm || '—'} mm`, `Feeds ${m.drivePipeControl.deviceType === 'drive-tank' ? 'drive tank' : 'standpipe'}`], offset:[18,30] },
        { id:'standpipe', anchor:m.drivePipeControl.point, lines:[m.drivePipeControl.deviceType === 'drive-tank' ? 'DRIVE TANK' : 'STANDPIPE', `Ch ${format(m.drivePipeControl.stationChainageM,1)} m`, `Top EL ${format(m.drivePipeControl.topElevationM,2)} m · Ø${m.drivePipeControl.standpipeDiameterMm || '—'} mm`], offset:[20,-64] },
        { id:'drive', anchor:midpoint(m.drivePipeControl.effectiveDriveRoute), lines:[m.driveInstallation === 'elevated-supports' ? 'ELEVATED RIGID DRIVE PIPE' : 'RIGID DRIVE PIPE', `L ${format(m.drivePipeControl.effectiveDriveLengthM,1)} m · Ø${m.drivePipe?.diameterMm || '—'} mm`, `Reference ${format(m.drivePipeControl.minM,1)}–${format(m.drivePipeControl.maxM,1)} m`, ...(m.driveInstallation === 'elevated-supports' ? [`Support frames ≤ ${format(m.driveSupport?.maxRequiredSupportHeightM,2)} m`] : [])], offset:[22,34] }
      ] : [{ id:'drive', anchor:midpoint(state.driveRoute), lines:[m.driveInstallation === 'elevated-supports' ? 'ELEVATED DRIVE PIPE' : 'DRIVE PIPE', `L ${format(m.driveLengthM,1)} m · Ø${m.drivePipe?.diameterMm || '—'} mm`, `Drop ${format(m.driveHeadM)} m · ${format(m.driveSlopePct,1)}%${m.driveRouteStraight ? ' · straight' : ` · ${m.driveBendCount} bend${m.driveBendCount===1?'':'s'}`}`, ...(m.driveInstallation === 'elevated-supports' ? [`Support frames ≤ ${format(m.driveSupport?.maxRequiredSupportHeightM,2)} m`] : [])], offset:[22,34] }]),
      { id:'pump', anchor:state.pump, lines:['RAM PUMP', `EL ${format(m.pumpElevationM)} m`, `Hd ${format(m.driveHeadM)} m · H ${format(m.deliveryHeadM)} m`], offset:[30,-52] },
      { id:'delivery', anchor:midpoint(state.deliveryRoute), lines:['DELIVERY PIPE', `L ${format(m.deliveryLengthM,1)} m · Ø${m.deliveryPipe?.diameterMm || '—'} mm`, `Est. Q ${flow(m.hydraulic?.deliveredFlowLps,3)} L/min`], offset:[24,38] },
      { id:'destination', anchor:state.destination, lines:['SERVICE AREA / RESERVOIR', `EL ${format(m.destinationElevationM)} m`], offset:[-154,-42] }
    ].filter(item => validPoint(item.anchor));
  }

  function appendAnnotation(svg, definition) {
    const anchor = project(definition.anchor); if (!anchor) return;
    const saved = state.annotations?.[definition.id], dx = number(saved?.dx, definition.offset[0]), dy = number(saved?.dy, definition.offset[1]);
    const x = anchor[0] + dx, y = anchor[1] + dy, width = Math.max(126, Math.min(220, Math.max(...definition.lines.map(line => line.length)) * 6.4 + 20)), height = 18 + definition.lines.length * 15;
    const group = svgEl('g', { class:'abearc-ram-label', 'data-ram-label-id':definition.id, tabindex:'0' });
    const targetX = Math.max(x, Math.min(x+width,anchor[0])), targetY = Math.max(y, Math.min(y+height,anchor[1]));
    const satellite = (typeof abearcMapCurrentBasemap === 'function' ? abearcMapCurrentBasemap() : 'google-satellite') === 'google-satellite';
    const ink = satellite ? '#ffffff' : '#172033', halo = satellite ? '#172033' : '#ffffff';
    const line = { x1:anchor[0], y1:anchor[1], x2:targetX, y2:targetY, 'pointer-events':'none' };
    group.append(svgEl('line', { ...line, class:'abearc-ram-label-leader-halo', stroke:halo, 'stroke-width':3.2 }));
    group.append(svgEl('line', { ...line, class:'abearc-ram-label-leader', style:`stroke:${ink};stroke-width:1.15` }));
    group.append(svgEl('circle', { cx:anchor[0],cy:anchor[1],r:2.3,fill:ink,stroke:halo,'stroke-width':1.1,'pointer-events':'none' }));
    group.append(svgEl('rect', { x, y, width, height, rx:5, class:'abearc-ram-label-box' }));
    const text = svgEl('text', { x:x+9, y:y+17, class:'abearc-ram-label-text' });
    definition.lines.forEach((line, index) => { const tspan = svgEl('tspan', { x:x+9, dy:index ? 15 : 0, class:index===0?'is-title':'' }); tspan.textContent = line; text.append(tspan); });
    group.append(text); group.addEventListener('pointerdown', event => beginLabelDrag(event, definition.id, definition.anchor, { dx, dy })); svg.append(group);
  }

  function appendPassiveRoute(svg, route, kind) {
    if (!Array.isArray(route) || route.length < 2) return;
    svg.append(svgEl('polyline', { points:pointsAttr(route), class:`abearc-ram-route is-${kind}`, fill:'none', 'pointer-events':'none' }));
  }

  function appendRoute(svg, route, kind) {
    if (route.length < 2) return;
    const polyline = svgEl('polyline', { points:pointsAttr(route), class:`abearc-ram-route is-${kind}`, fill:'none' }); svg.append(polyline);
    const hit = svgEl('polyline', { points:pointsAttr(route), class:'abearc-ram-route-hit', fill:'none', 'data-ram-route-kind':kind });
    hit.addEventListener('dblclick', event => insertRouteVertex(event, kind)); svg.append(hit);
    route.forEach((point, index) => {
      const isEndpoint = index === 0 || index === route.length - 1; if (isEndpoint) return;
      const p = project(point); if (!p) return;
      const circle = svgEl('circle', { cx:p[0], cy:p[1], r:4.5, class:'abearc-ram-route-vertex', 'data-route-kind':kind, 'data-route-index':index });
      circle.addEventListener('pointerdown', event => beginGeometryDrag(event, 'route', { routeKind:kind, index }));
      circle.addEventListener('contextmenu', event => removeRouteVertex(event, kind, index)); svg.append(circle);
    });
  }

  function appendMarker(svg, point, kind, label) {
    const p = project(point); if (!p) return;
    const group = svgEl('g', { class:`abearc-ram-marker is-${kind}`, 'data-ram-marker':kind });
    group.append(svgEl('circle', { cx:p[0], cy:p[1], r:kind==='pump'?7:5.5, class:'abearc-ram-marker-halo' }));
    group.append(svgEl('circle', { cx:p[0], cy:p[1], r:kind==='pump'?6.15:4.85, class:'abearc-ram-marker-core' }));
    const title = svgEl('title'); title.textContent = `${label} · drag to adjust`; group.append(title);
    group.addEventListener('pointerdown', event => beginGeometryDrag(event, kind, {})); svg.append(group);
  }

  function renderAbearcRamPumpOverlay() {
    const svg = document.querySelector('[data-map-ram-pump-layer]'); if (!svg) return;
    svg.replaceChildren();
    if (!state?.visible || !abearcMap || !state.source || !state.destination || state.assessment?.level === 'not-feasible' || !state.metrics) return;
    ensureMapListeners();
    const stage = document.querySelector('.abearc-map-stage'); if (stage) { svg.setAttribute('viewBox', `0 0 ${Math.max(1, stage.clientWidth)} ${Math.max(1, stage.clientHeight)}`); }
    if (state.driveRoute.length >= 2) appendRoute(svg, state.driveRoute, 'drive');
    if (state.metrics?.drivePipeControl?.deviceType && state.metrics.drivePipeControl.deviceType !== 'none') appendPassiveRoute(svg, state.metrics.drivePipeControl.supplyRoute, 'supply');
    if (state.deliveryRoute.length >= 2) appendRoute(svg, state.deliveryRoute, 'delivery');
    appendMarker(svg, state.source, 'source', 'Water Source');
    if (state.metrics?.drivePipeControl?.deviceType && state.metrics.drivePipeControl.deviceType !== 'none' && validPoint(state.metrics.drivePipeControl.point)) appendMarker(svg, state.metrics.drivePipeControl.point, 'standpipe', state.metrics.drivePipeControl.deviceType === 'drive-tank' ? 'Drive Tank' : 'Standpipe');
    if (state.pump) appendMarker(svg, state.pump, 'pump', 'Ram Pump'); appendMarker(svg, state.destination, 'destination', 'Service Area / Reservoir');
    annotationDefinitions().forEach(definition => appendAnnotation(svg, definition));
  }

  function scheduleOverlayRender() { if (renderRaf) return; renderRaf = requestAnimationFrame(() => { renderRaf = 0; renderAbearcRamPumpOverlay(); }); }
  function ensureMapListeners() {
    if (!abearcMap || mapListenersMap === abearcMap) return;
    if (mapListenersMap) ['move','zoom','rotate','pitch','resize','style.load'].forEach(event => mapListenersMap.off?.(event, scheduleOverlayRender));
    mapListenersMap = abearcMap; ['move','zoom','rotate','pitch','resize','style.load'].forEach(event => mapListenersMap.on?.(event, scheduleOverlayRender));
  }

  function mapPointFromPointer(event) {
    const stage = document.querySelector('.abearc-map-stage'); if (!stage || !abearcMap) return null; const rect = stage.getBoundingClientRect();
    const ll = abearcMap.unproject([event.clientX - rect.left, event.clientY - rect.top]); return ll ? [ll.lng, ll.lat] : null;
  }

  function beginGeometryDrag(event, kind, detail) {
    if (!state || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); rememberChange();
    state.candidates = []; state.selectedCandidateIndex = 0;
    geometryDrag = { kind, ...detail, pointerId:event.pointerId }; try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
    abearcMap?.dragPan?.disable?.();
  }

  function beginLabelDrag(event, id, anchor, renderedOffset = { dx:0, dy:0 }) {
    if (!state || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); rememberChange();
    const p = project(anchor); if (!p) return; labelDrag = { id, anchor, startX:event.clientX, startY:event.clientY, initial:state.annotations?.[id] || renderedOffset, anchorPx:p };
    abearcMap?.dragPan?.disable?.();
  }

  function handlePointerMove(event) {
    if (moveProfileResize(event)) return;
    if (profileLabelDrag) {
      const d=profileLabelDrag, p=new DOMPoint(event.clientX,event.clientY).matrixTransform(d.matrix);
      positionProfileLabel(d.label,d.left+p.x-d.x,d.top+p.y-d.y); return;
    }
    if (moveProfileDrag(event)) return;
    if (labelDrag && state) {
      state.annotations[labelDrag.id] = { dx:number(labelDrag.initial.dx, 0) + event.clientX - labelDrag.startX, dy:number(labelDrag.initial.dy, 0) + event.clientY - labelDrag.startY }; state.updatedAt = now(); scheduleOverlayRender(); return;
    }
    if (!geometryDrag || !state) return; const point = mapPointFromPointer(event); if (!validPoint(point)) return;
    if (geometryDrag.kind === 'source') { state.source = point; if (state.driveRoute.length) state.driveRoute[0] = point; }
    else if (geometryDrag.kind === 'pump') { state.pump = point; if (state.driveRoute.length) state.driveRoute[state.driveRoute.length - 1] = point; if (state.deliveryRoute.length) state.deliveryRoute[0] = point; }
    else if (geometryDrag.kind === 'destination') { state.destination = point; if (state.deliveryRoute.length) state.deliveryRoute[state.deliveryRoute.length - 1] = point; }
    else if (geometryDrag.kind === 'route') { const route = geometryDrag.routeKind === 'drive' ? state.driveRoute : state.deliveryRoute; if (route?.[geometryDrag.index]) route[geometryDrag.index] = point; }
    state.updatedAt = now(); scheduleOverlayRender();
  }

  function handlePointerUp() {
    if (profileResize || profileLabelDrag) { profileResize=null; profileLabelDrag=null; abearcMap?.dragPan?.enable?.(); return; }
    if (endProfileDrag()) return;
    const changedGeometry = Boolean(geometryDrag); geometryDrag = null; labelDrag = null; abearcMap?.dragPan?.enable?.();
    if (changedGeometry) recalculateAbearcRamPumpLayout({ remember:false });
  }

  function nearestRouteSegment(route, screenPoint) {
    let best = { index:0, distance:Infinity };
    for (let index = 0; index < route.length - 1; index++) {
      const a = project(route[index]), b = project(route[index+1]); if (!a || !b) continue;
      const dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy,t=denom?Math.max(0,Math.min(1,((screenPoint[0]-a[0])*dx+(screenPoint[1]-a[1])*dy)/denom)):0;
      const d=Math.hypot(screenPoint[0]-(a[0]+dx*t),screenPoint[1]-(a[1]+dy*t)); if(d<best.distance)best={index,distance:d};
    }
    return best.index;
  }

  function insertRouteVertex(event, kind) {
    if (!state) return; event.preventDefault(); event.stopPropagation(); const point = mapPointFromPointer(event); if (!validPoint(point)) return; rememberChange();
    const route = kind === 'drive' ? state.driveRoute : state.deliveryRoute, stage = document.querySelector('.abearc-map-stage'), rect = stage?.getBoundingClientRect(); if (!route || !rect) return;
    state.candidates = []; state.selectedCandidateIndex = 0;
    const index = nearestRouteSegment(route, [event.clientX - rect.left, event.clientY - rect.top]); route.splice(index + 1, 0, point); state.updatedAt = now(); renderAbearcRamPumpOverlay(); recalculateAbearcRamPumpLayout({ remember:false });
  }

  function removeRouteVertex(event, kind, index) {
    event.preventDefault(); event.stopPropagation(); const route = kind === 'drive' ? state?.driveRoute : state?.deliveryRoute; if (!route || index <= 0 || index >= route.length - 1) return;
    rememberChange(); state.candidates = []; state.selectedCandidateIndex = 0; route.splice(index, 1); state.updatedAt = now(); renderAbearcRamPumpOverlay(); recalculateAbearcRamPumpLayout({ remember:false });
  }

  function resetAbearcRamPumpLabels() { if (!state) return; rememberChange(); state.annotations = {}; state.updatedAt = now(); renderAbearcRamPumpOverlay(); toast('Ram-pump label positions reset'); }

  function downloadText(text, filename, type) { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportName(extension) { return `${String(state?.name || 'ABEARC-Ram-Pump-Layout').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,100)}.${extension}`; }

  function exportAbearcRamPumpGeoJson() {
    if (!state?.metrics) return toast('Generate a ram-pump layout first.', 'error');
    const m = state.metrics, features = [
      { type:'Feature', properties:{ role:'water-source', elevation_m:m.sourceElevationM }, geometry:{ type:'Point', coordinates:state.source } },
      { type:'Feature', properties:{ role:'ram-pump', elevation_m:m.pumpElevationM, drive_head_m:m.driveHeadM, delivery_head_m:m.deliveryHeadM }, geometry:{ type:'Point', coordinates:state.pump } },
      { type:'Feature', properties:{ role:'service-area-reservoir', elevation_m:m.destinationElevationM }, geometry:{ type:'Point', coordinates:state.destination } },
      { type:'Feature', properties:{ role:'drive-pipe', source_to_pump_length_m:m.driveLengthM, effective_rigid_length_m:m.effectiveDriveLengthM ?? m.driveLengthM, diameter_mm:m.drivePipe?.diameterMm, material:state.inputs.pipeMaterial, installation:m.driveInstallation, alignment:m.driveRouteStraight?'straight':'routed', bend_count:m.driveBendCount, max_support_height_m:m.driveSupport?.maxRequiredSupportHeightM ?? null }, geometry:{ type:'LineString', coordinates:state.driveRoute } },
      { type:'Feature', properties:{ role:'delivery-pipe', length_m:m.deliveryLengthM, diameter_mm:m.deliveryPipe?.diameterMm, material:state.inputs.pipeMaterial }, geometry:{ type:'LineString', coordinates:state.deliveryRoute } },
      ...(m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' && validPoint(m.drivePipeControl.point) ? [
        { type:'Feature', properties:{ role:m.drivePipeControl.deviceType, chainage_m:m.drivePipeControl.stationChainageM, top_elevation_m:m.drivePipeControl.topElevationM, diameter_mm:m.drivePipeControl.standpipeDiameterMm, supply_pipe_diameter_mm:m.drivePipeControl.supplyPipeDiameterMm }, geometry:{ type:'Point', coordinates:m.drivePipeControl.point } },
        { type:'Feature', properties:{ role:'supply-pipe', length_m:m.drivePipeControl.supplyLengthM, diameter_mm:m.drivePipeControl.supplyPipeDiameterMm }, geometry:{ type:'LineString', coordinates:m.drivePipeControl.supplyRoute } },
        { type:'Feature', properties:{ role:'effective-rigid-drive-pipe', length_m:m.drivePipeControl.effectiveDriveLengthM, diameter_mm:m.drivePipe?.diameterMm }, geometry:{ type:'LineString', coordinates:m.drivePipeControl.effectiveDriveRoute } }
      ] : [])
    ];
    downloadText(JSON.stringify({ type:'FeatureCollection', name:state.name, properties:{ assessment:state.assessment, elevation_source:state.elevationSourceLabel || state.elevationSource }, features }, null, 2), exportName('geojson'), 'application/geo+json');
  }

  function exportAbearcRamPumpCsv() {
    if (!state?.metrics) return toast('Generate a ram-pump layout first.', 'error');
    const m = state.metrics, h = m.hydraulic || {};
    const numeric = (label, value, unit) => [label, value != null && Number.isFinite(Number(value)) ? Number(Number(value).toFixed(6)) : '', unit];
    const perMinute = value => value == null ? null : Number(value) * 60;
    const rows = [
      ['Parameter','Value','Unit'], ['Layout',state.name,''],
      numeric('Source elevation',m.sourceElevationM,'m'), numeric('Ram-pump elevation',m.pumpElevationM,'m'), numeric('Destination elevation',m.destinationElevationM,'m'),
      numeric('Available drive head',m.driveHeadM,'m'), numeric('Required delivery head',m.deliveryHeadM,'m'), numeric('Head ratio H/h',m.headRatio,'ratio'),
      numeric('Drive source-to-pump route length',m.driveLengthM,'m'), numeric('Effective rigid drive-pipe length',m.effectiveDriveLengthM ?? m.driveLengthM,'m'), numeric('Rigid drive-pipe vertical drop',m.rigidDriveDropM ?? m.driveHeadM,'m'), numeric('Drive pipe diameter',m.drivePipe?.diameterMm,'mm'), numeric('Rigid drive-pipe grade',m.driveSlopePct,'%'),
      ['Drive-pipe length guideline',state.inputs.driveLengthRule === 'peace-corps' ? 'Peace Corps / Warwick 150D–1000D' : 'Manufacturer / final engineering review',''], numeric('Reference minimum drive-pipe length',m.drivePipeControl?.minM,'m'), numeric('Reference maximum drive-pipe length',m.drivePipeControl?.maxM,'m'),
      ['Drive pipe installation',m.driveInstallation === 'elevated-supports' ? 'Elevated on support frames' : 'On ground',''], ['Drive pipe alignment',m.driveRouteStraight ? 'Straight / no turns' : `${m.driveBendCount} bend(s)`,''], numeric('Maximum required support height',m.driveSupport?.maxRequiredSupportHeightM,'m'),
      ['Long-drive device',m.drivePipeControl?.deviceType && m.drivePipeControl.deviceType !== 'none' ? (m.drivePipeControl.deviceType === 'drive-tank' ? 'Drive tank' : 'Standpipe') : 'None',''], numeric('Long-drive device chainage',m.drivePipeControl?.stationChainageM,'m'), numeric('Supply pipe length',m.drivePipeControl?.supplyLengthM,'m'), numeric('Supply pipe diameter',m.drivePipeControl?.supplyPipeDiameterMm,'mm'), numeric('Standpipe / drive-tank connection diameter',m.drivePipeControl?.standpipeDiameterMm,'mm'), numeric('Standpipe / drive-tank top elevation',m.drivePipeControl?.topElevationM,'m'),
      numeric('Delivery pipe length',m.deliveryLengthM,'m'), numeric('Delivery pipe diameter',m.deliveryPipe?.diameterMm,'mm'), numeric('Total pipe length',m.totalPipeLengthM,'m'),
      numeric('Source to destination lift',m.sourceToDestinationLiftM,'m'), numeric('Maximum delivery lift limit',state.inputs.maxDeliveryLiftM,'m'), numeric('Governing delivery lift',m.governingDeliveryLiftM,'m'),
      numeric(state.inputs.desiredDeliveryFlowLps > 0 ? 'Required source / drive flow' : 'Available source / drive flow',perMinute(h.sourceFlowLps),'L/min'), numeric('Desired delivery flow',perMinute(state.inputs.desiredDeliveryFlowLps),'L/min'), numeric('Daily source volume',h.sourceM3Day,'m³/day'),
      numeric('Estimated delivery flow',perMinute(h.deliveredFlowLps),'L/min'), numeric('Daily delivered volume',h.deliveredM3Day,'m³/day'),
      numeric('Estimated waste flow',perMinute(h.wasteFlowLps),'L/min'), numeric('Daily waste volume',h.wasteM3Day,'m³/day'),
      numeric('Planning efficiency',h.efficiency == null ? null : h.efficiency * 100,'%'),
      numeric('Delivery high point elevation',m.deliveryHighPointElevationM,'m'), numeric('Delivery high point chainage',m.deliveryHighPointChainageM,'m'),
      numeric('Drive pipe friction loss',h.driveLossM,'m'), numeric('Delivery pipe friction loss',h.deliveryLossM,'m'),
      numeric('Net drive head after friction',h.netDriveHeadM,'m'), numeric('Total delivery head including friction',h.totalDeliveryHeadM,'m'),
      numeric('Operating hours per day',h.operatingHours,'h/day'),
      ['Assessment',state.assessment?.title || '',''], ...(state.assessment?.reasons || []).map(reason => ['Assessment note',flowNote(reason),'']),
      ['Elevation source',state.elevationSourceLabel || SOURCE_LABELS[state.elevationSource] || state.elevationSource,''],
      ['Flow unit','L/min means litres per minute','']
    ];
    const csv = rows.map(row => row.map(value => {
      // Keep user text literal in spreadsheets while preserving signed numeric results.
      const text = typeof value === 'string' && /^\s*[=+\-@]/.test(value) ? `'${value}` : String(value ?? '');
      return `"${text.replace(/"/g,'""')}"`;
    }).join(',')).join('\r\n');
    downloadText(`\uFEFF${csv}\r\n`, exportName('csv'), 'text/csv;charset=utf-8');
  }

  document.addEventListener('pointerdown', event => {
    const label=event.target.closest('[data-ram-profile-label]'), handle=event.target.closest('[data-ram-profile-resize]');
    if (label) beginProfileLabelDrag(event,label);
    else if (handle) beginProfileResize(event,handle);
    else if (event.target.closest('[data-ram-profile-drag]')) beginProfileDrag(event);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (profileResize || profileLabelDrag || profileDrag)) return handlePointerUp();
    if (!event.key.startsWith('Arrow')) return;
    const label=event.target.closest('[data-ram-profile-label]'), handle=event.target.closest('[data-ram-profile-resize]');
    if (!label && !handle) return;
    event.preventDefault(); event.stopPropagation();
    const dx=event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0, dy=event.key === 'ArrowUp' ? -5 : event.key === 'ArrowDown' ? 5 : 0;
    if (label) { rememberChange(); positionProfileLabel(label,Number(label.getAttribute('x'))+dx,Number(label.getAttribute('y'))+dy); }
    else { beginProfileResize({button:0,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}},handle); moveProfileResize({clientX:dx,clientY:dy}); handlePointerUp(); }
  }, true);
  document.addEventListener('pointermove', handlePointerMove, true); document.addEventListener('pointerup', handlePointerUp, true); document.addEventListener('pointercancel', handlePointerUp, true);
  if (typeof window.addEventListener === 'function') window.addEventListener('resize', () => { if (profileUi.floating) requestAnimationFrame(clampProfilePosition); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && (geometryDrag || labelDrag)) { geometryDrag = null; labelDrag = null; abearcMap?.dragPan?.enable?.(); renderAbearcRamPumpOverlay(); } });

  Object.assign(root, {
    toggleAbearcRamPumpDrawer, openAbearcRamPumpFromMeasurement, generateAbearcRamPumpSystemLayout, cancelAbearcRamPumpOperation,
    recalculateAbearcRamPumpLayout, selectAbearcRamPumpCandidate, setAbearcRamPumpElevationSource, updateAbearcRamPumpInputs,
    toggleAbearcRamPumpVisibility, clearAbearcRamPumpLayout, captureAbearcRamPumpState, restoreAbearcRamPumpState,
    renderAbearcRamPumpOverlay, resetAbearcRamPumpLabels, exportAbearcRamPumpGeoJson, exportAbearcRamPumpCsv,
    refreshAbearcRamPumpMeasurementSummary, toggleAbearcRamPumpProfileFloating, toggleAbearcRamPumpProfileExpanded,
    downloadAbearcRamPumpProfilePng, showAbearcRamPumpFullCalculation, useAbearcGilmanRamPumpModel
  });
})(window);
