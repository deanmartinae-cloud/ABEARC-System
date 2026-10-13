const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const core = require('../src/frontend/scripts/21-map-ram-pump-core.js');
const ram = read('src/frontend/scripts/22-map-ram-pump.js');
const map = read('src/frontend/scripts/12-abearc-map.js');
const layouts = read('src/frontend/scripts/16-map-layouts.js');
const print = read('src/frontend/scripts/15-map-print.js');
const orthomosaic = read('src/frontend/scripts/14-map-orthomosaic.js');
const page = read('src/frontend/pages/map.page.html');
const head = read('src/frontend/layout/head.html');
const css = read('src/frontend/styles/map-ram-pump.css');
const manifest = JSON.parse(read('src/frontend/script-manifest.json'));

const requireText = (source, pattern, message) => assert.match(source, pattern, message);

// Native Measure Tools + frontend wiring.
assert(manifest.includes('src/frontend/scripts/21-map-ram-pump-core.js'), 'Ram-pump core is missing from the frontend manifest.');
assert(manifest.includes('src/frontend/scripts/22-map-ram-pump.js'), 'Ram-pump map module is missing from the frontend manifest.');
assert(manifest.indexOf('src/frontend/scripts/19-map-gravity-path.js') < manifest.indexOf('src/frontend/scripts/22-map-ram-pump.js'), 'Gravity routing primitives must load before the ram-pump map module.');
requireText(head, /map-ram-pump\.css/, 'Ram-pump stylesheet is not linked.');
requireText(page, /data-map-measure-ram-pump[\s\S]+Generate Ram Pump System Layout/, 'Distance-measure context menu is missing the Ram Pump action.');
requireText(map, /data-map-measure-ram-pump[\s\S]+abearcMapMeasureMode !== 'distance'/, 'Ram Pump context action must be restricted to valid distance measurements.');
requireText(page, /data-map-ram-pump-panel[\s\S]+Point A = water source[\s\S]+Point B = service area \/ reservoir/, 'Ram-pump engineering panel is incomplete.');
requireText(page, /data-map-ram-pump-layer/, 'Ram-pump map overlay layer is missing.');
requireText(page, /data-ram-drive-installation[\s\S]+On ground \/ terrain-following[\s\S]+Elevated on support frames/, 'Drive-pipe installation dropdown must offer on-ground and elevated support-frame modes.');
requireText(page, /data-ram-drive-alignment[\s\S]+Straight preferred \(recommended\)[\s\S]+Terrain-following allowed[\s\S]+Straight only/, 'Drive-pipe alignment selector must support straight-preferred, routed and straight-only modes.');
requireText(page, /data-ram-max-support-height[\s\S]+value="6"/, 'Elevated drive-pipe support mode must expose a maximum support-height planning limit.');
requireText(page, /data-ram-design-basis[\s\S]+Peace Corps \/ Warwick S-2/, 'Ram Pump drawer must expose the Peace Corps / Warwick S-2 reference design basis.');
requireText(page, /data-ram-drive-length-rule[\s\S]+150D–1000D/, 'Ram Pump drawer must expose the Peace Corps drive-pipe length guideline.');
requireText(page, /data-ram-long-drive-treatment[\s\S]+Auto standpipe[\s\S]+Drive tank/, 'Ram Pump drawer must expose long-drive standpipe/drive-tank treatment.');
requireText(ram, /drivePipeLengthControl[\s\S]+standpipeDiameterMm[\s\S]+supplyPipeDiameterMm/, 'Ram Pump calculations must create a standpipe/drive-tank control record with reference pipe sizes.');
requireText(ram, /allowLongDriveSupply[\s\S]+splitRouteByTailLength[\s\S]+deliveryRouteAStar/, 'Long source-to-pump runs must allow an upstream supply pipe and evaluate only the effective rigid drive segment.');
requireText(ram, /analyzeElevatedDriveGrade[\s\S]+terrainIntrusionM[\s\S]+maxRequiredSupportHeightM/, 'Elevated drive-pipe mode must calculate terrain intrusion and support-frame height.');
requireText(ram, /straight-preferred[\s\S]+straight-only[\s\S]+routeDrivePipe/, 'Drive-pipe routing must prefer a straight no-turn alignment and support straight-only mode.');
requireText(ram, /abearcGravityBuildPlan[\s\S]+abearcGravityFindPathOnGrid/, 'Drive-pipe routing must reuse the existing gravity-flow grid/path primitives.');
requireText(ram, /deliveryRouteAStar/, 'Delivery pipe must use terrain-aware routing distinct from gravity-only routing.');
requireText(ram, /function openAbearcRamPumpFromMeasurement[\s\S]+return generateAbearcRamPumpSystemLayout\(\)/, 'Right-click Ram Pump action must immediately start terrain analysis.');
requireText(ram, /sourceM3Day[\s\S]+deliveryHighPointElevationM[\s\S]+HIGH POINT/, 'Performance/profile polish must include source volume and delivery high-point annotation.');
requireText(ram, /Potentially Feasible/, 'Potential-feasibility diagnostic is missing.');
requireText(ram, /No Practical Ram Pump Layout Found/, 'No-practical-layout diagnostic is missing.');
requireText(ram, /Recommended site[\s\S]+Alternative/, 'Multiple candidate pump-site UI is missing.');
requireText(ram, /insertRouteVertex[\s\S]+removeRouteVertex[\s\S]+beginGeometryDrag/, 'Editable ram-pump geometry is incomplete.');
requireText(ram, /ram-profile-drive[\s\S]+ram-profile-delivery[\s\S]+SOURCE[\s\S]+RAM PUMP[\s\S]+DESTINATION/, 'Elevation profile must distinguish both pipes and all three engineering locations.');
requireText(ram, /WATER SOURCE \/ INTAKE[\s\S]+DRIVE PIPE[\s\S]+RAM PUMP[\s\S]+DELIVERY PIPE[\s\S]+SERVICE AREA \/ RESERVOIR/, 'Engineering map annotations are incomplete.');
requireText(css, /@media \(max-width: 520px\)[\s\S]+grid-template-columns:minmax\(0,1fr\)/, 'Narrow-screen engineering panel rules are missing.');

requireText(page, /data-ram-measurement-summary/, 'Ram-pump drawer must show the selected distance measurement details.');
requireText(ram, /measurementDisplay[\s\S]+A · Source[\s\S]+B · Destination[\s\S]+Measured alignment/, 'Selected distance measurement must show source, destination and measured length.');
requireText(ram, /toggleAbearcRamPumpDrawer[\s\S]+data-map-results-panel[\s\S]+if \(open\) resultsPanel\?\.classList\.add\('hidden'\)/, 'Opening Ram Pump must hide the normal results drawer.');
requireText(ram, /toggleAbearcMapLayoutsDrawer\?\.\(false\)[\s\S]+toggleAbearcOrthomosaicDrawer\?\.\(false\)[\s\S]+toggleAbearcMapFilters\?\.\(false\)/, 'Opening Ram Pump must close competing map drawers/popovers.');
requireText(page, /abearc-ram-rail-icon[\s\S]+ram-body[\s\S]+ram-rise/, 'Ram Pump rail icon must use the dedicated hydraulic-ram symbol.');
requireText(ram, /downloadAbearcRamPumpProfilePng[\s\S]+toggleAbearcRamPumpProfileExpanded[\s\S]+toggleAbearcRamPumpProfileFloating/, 'Elevation profile controls must support download, larger view and movable map view.');
requireText(css, /abearc-ram-profile\.is-floating[\s\S]+position:absolute[\s\S]+abearc-ram-profile\.is-expanded/, 'Movable/expanded profile styling is missing.');
requireText(page, /Show full calculation/, 'Engineering results must expose the full calculation link.');
requireText(ram, /report-sheet[\s\S]+sheet-masthead[\s\S]+sheet-grid-3[\s\S]+sheet-panel/, 'Full calculation must use the report-style engineering sheet layout.');
requireText(ram, /nominalPipeInchLabel[\s\S]+Equivalent D \(in\)[\s\S]+nearest standard nominal inch pipe size/, 'Full calculation pipe sizing must show nominal inch trade sizes instead of decimal inch conversions.');
requireText(ram, /detailedCalculationProfileFigure[\s\S]+data-ram-calculation-profile[\s\S]+data-ram-draggable-label/, 'Full calculation must include a draggable-label elevation profile.');
requireText(ram, /Hydraulic Ram Pump — Detailed Calculation[\s\S]+Hazen-Williams[\s\S]+Qd = Qs[\s\S]+function showAbearcRamPumpFullCalculation/, 'Full calculation page must contain step-by-step hydraulic equations.');
requireText(ram, /ram-pump-manual-reference\.png[\s\S]+data-ram-engineering-figure/, 'Detailed calculation must show the exact supplied classic pump-system reference image.');
assert(!/downloadRamPumpFigureSvg\(\)|downloadRamPumpFigureDxf\(\)|Export Figure SVG|Export DXF/.test(ram), 'Removed SVG and DXF export controls must remain absent.');
requireText(ram, /measurementRecordById[\s\S]+setMeasurementVisibilityForRamPump[\s\S]+syncRamPumpMeasurementVisibility/, 'Ram Pump workflow must manage source distance-measurement visibility while the layout is active.');
requireText(map, /abearcRamPumpHiddenMeasurementId[\s\S]+ramPumpHidesActiveMeasurement[\s\S]+return;/, 'Active distance-measure rendering must be suppressed while its Ram Pump layout is active.');

// My Map Layouts persistence and explicit stale-overlay cleanup.
requireText(layouts, /ramPump: window\.captureAbearcRamPumpState\?\.\(\) \|\| null/, 'My Map Layouts does not capture ram-pump state.');
requireText(layouts, /restoreAbearcRamPumpState\?\.\(state\.ramPump \|\| null, \{ skipRender: true \}\)/, 'My Map Layouts must restore or explicitly clear ram-pump state.');
requireText(layouts, /renderAbearcMapMeasure\(\);[\s\S]+renderAbearcRamPumpOverlay/, 'Restored ram-pump overlays must render after map measurement restoration.');
requireText(ram, /function restoreAbearcRamPumpState[\s\S]+clearOverlayOnly\(\);[\s\S]+state = sanitizeState\(value\)/, 'Ram-pump restore must clear stale overlay geometry before applying restored state.');
requireText(print, /data-map-ram-pump-layer/, 'Print Mode does not snapshot the ram-pump overlay.');
requireText(print, /abearc-ram-route-hit[\s\S]+abearc-ram-route-vertex/, 'Print Mode must omit ram-pump editing targets.');

// Guard against cross-project contamination.
for (const [name, source] of [['core', read('src/frontend/scripts/21-map-ram-pump-core.js')], ['map module', ram], ['style', css]]) {
  assert(!/\bSPIS\b|\bSWIP\b|small water impounding|dam design|engineering-designs/i.test(source), `Unrelated SPIS/Dam/SWIP content leaked into Ram Pump ${name}.`);
}

// Hydraulic sanity: friction should reduce usable head/delivery but remain finite.
const noFriction = core.ramPumpSizing({ sourceFlowLps: 5, driveHeadM: 8, deliveryHeadM: 30, efficiency: 0.6, operatingHours: 24 });
const withFriction = core.ramPumpSizing({ sourceFlowLps: 5, driveHeadM: 8, deliveryHeadM: 30, efficiency: 0.6, drivePipeLengthM: 180, drivePipeDiameterMm: 75, deliveryPipeLengthM: 600, deliveryPipeDiameterMm: 63, operatingHours: 24 });
assert(noFriction.deliveredFlowLps > 0, 'Basic ram-pump sizing must produce delivery flow.');
assert(withFriction.deliveredFlowLps > 0 && withFriction.deliveredFlowLps < noFriction.deliveredFlowLps, 'Pipe friction must reduce estimated delivery flow.');
assert(withFriction.wasteFlowLps >= 0 && withFriction.deliveredM3Day > 0, 'Daily delivery/waste estimates must be physical.');
const requiredSource = core.requiredSourceFlowForDelivery({ desiredDeliveryFlowLps: 1/60, driveHeadM: 8, deliveryHeadM: 28, efficiency: 0.6, drivePipeLengthM: 120, drivePipeDiameterMm: 63, deliveryPipeLengthM: 500, deliveryPipeDiameterMm: 32, hazenWilliamsC: 140 });
assert(Number.isFinite(requiredSource.requiredSourceFlowLps) && requiredSource.requiredSourceFlowLps > 1/60, 'Required source-flow solver must invert the ram-pump energy relationship and include pipe friction.');
const reproduced = core.ramPumpSizing({ sourceFlowLps: requiredSource.requiredSourceFlowLps, driveHeadM: 8, deliveryHeadM: 28, efficiency: 0.6, drivePipeLengthM: 120, drivePipeDiameterMm: 63, deliveryPipeLengthM: 500, deliveryPipeDiameterMm: 32, hazenWilliamsC: 140 });
assert(Math.abs(reproduced.deliveredFlowLps - 1/60) < 0.001, 'Computed required source flow must reproduce the desired delivery flow within solver tolerance.');

// Peace Corps / Warwick S-2 reference rules.
assert.equal(core.peaceCorpsS2DriveDiameterMm(0.8), 25.4, 'S-2 Table 2 should use 1-inch drive pipe for 0.66–1.0 L/s.');
assert.equal(core.peaceCorpsS2DriveDiameterMm(1.2), 38.1, 'S-2 Table 2 should use 1.5-inch drive pipe for >1.0–1.33 L/s.');
assert.equal(core.peaceCorpsS2DriveDiameterMm(1.6), 50.8, 'S-2 Table 2 should use 2-inch drive pipe for >1.33–2.0 L/s.');
assert.equal(core.peaceCorpsS2DriveDiameterMm(0.2), null, 'Flows outside the S-2 Table 2 range must not be assigned a false S-2 diameter.');
const s2Length = core.peaceCorpsDrivePipeLengthLimits(38.1);
assert(Math.abs(s2Length.minM - 5.715) < 0.001 && Math.abs(s2Length.maxM - 38.1) < 0.001, 'S-2 drive-pipe length limits must implement Lmin=150D and Lmax=1000D using consistent units.');
assert(core.nextStandardDiameterMm(50.8) >= 50.8, 'Standpipe/supply sizing helper must round upward to a standard diameter.');

// Synthetic terrain: the only practical lower bench is deliberately offset from A→B.
const source = [125.0000, 7.0000];
const destination = [125.0080, 7.0000];
const polygon = core.corridorPolygon(source, destination, 180);
const grid = core.createGridPlan(polygon, { maxSamples: 1600, preferredSpacingM: 22 });
const frame = core.localFrame([source, destination]);
const elevations = grid.locations.map(location => {
  const ll = [location.longitude, location.latitude];
  const [x, y] = frame.project(ll);
  if (x > 110 && x < 520 && y > 55 && y < 150) return 92;
  return 99;
});
const candidates = core.findRamPumpCandidates({ grid, elevations, sourcePoint: source, destinationPoint: destination, sourceElevationM: 100, destinationElevationM: 120, minDriveHeadM: 1.5, maxCandidates: 8 });
assert(candidates.length >= 1, 'Off-line terrain search should find the lower bench.');
assert(candidates.some(candidate => core.distancePointToSegmentM(candidate.location, source, destination) > 45), 'Pump-site search must not be confined to the original A→B line.');
assert(candidates.every(candidate => candidate.driveHeadM >= 1.5 && candidate.headRatio > 0 && candidate.headRatio <= 20), 'Candidates must satisfy preliminary drive-head/head-ratio screening.');
const overLiftCandidates = core.findRamPumpCandidates({ grid, elevations, sourcePoint: source, destinationPoint: destination, sourceElevationM: 100, destinationElevationM: 300, minDriveHeadM: 1.5, maxDeliveryHeadM: 180, maxCandidates: 8 });
assert.equal(overLiftCandidates.length, 0, 'Candidate generation must reject pump sites requiring more than the configured 180 m delivery lift.');

// A destination below the source can still be hydraulically reachable from a lower ram-pump site;
// the tool should generate it and flag design appropriateness for review instead of suppressing all candidates.
const lowerDestinationCandidates = core.findRamPumpCandidates({ grid, elevations, sourcePoint: source, destinationPoint: destination, sourceElevationM: 100, destinationElevationM: 97, minDriveHeadM: 1.5, maxCandidates: 8 });
assert(lowerDestinationCandidates.length >= 1 && lowerDestinationCandidates.some(candidate => candidate.headRatio < 1), 'Candidate search must not incorrectly require delivery head to exceed drive head.');

// Pipe selection must produce a real standard diameter for positive flow.
const pipe = core.selectPipeDiameter({ flowLps: 2, lengthM: 300, coefficient: 140 });
assert(pipe && core.STANDARD_HDPE_DIAMETERS_MM.includes(pipe.diameterMm), 'Automatic pipe selection must use a standard diameter.');

assert.match(ram, /assessment\?\.level === 'not-feasible'/, 'Not-feasible results must suppress the generated map overlay.');
assert.match(ram, /Pipe sizing calculation/, 'Full calculation must include a pipe sizing section.');
assert.match(ram, /Minimum rigid drive-pipe length[\s\S]+Lmin = 150D[\s\S]+Maximum rigid drive-pipe length[\s\S]+Lmax = 1000D/, 'Full calculation must show the Peace Corps drive-pipe length equations.');
assert.match(ram, /STANDPIPE|Standpipe placement/, 'Engineering drawing/calculation must support a generated standpipe.');
assert.match(ram, /Friction-based minimum diameter/, 'Full calculation must show the theoretical pipe-diameter equation.');
assert.match(ram, /Standard D \(mm\)/, 'Full calculation must show the standard-diameter sizing table.');
assert.match(ram, /Ram-pump system figure/, 'Full calculation must include the hydraulic ram-pump system figure section.');
assert.match(ram, /air chamber/, 'Ram-pump system figure must identify the air chamber.');
assert.match(ram, /waste flow/, 'Ram-pump system figure must identify waste flow.');
assert.match(page, /abearc-ram-alignment-card/, 'Ram Pump drawer must use a dedicated selected-alignment card.');
assert.match(page, /Selected distance measurement[\s\S]+Design inputs/, 'Selected distance measurement must appear before the design inputs.');
assert.match(css, /abearc-ram-form-actions[\s\S]+overflow:visible/, 'Ram Pump design input/action layout must not clip the generate controls.');

console.log('Ram Pump check passed: native Measure integration, exclusive drawer behavior, measurement display, off-line site search, hydraulic estimates, editable/downloadable/movable profiles, full calculation page, layouts/Print persistence, responsive UI, and project separation verified.');


// Offline Gilman manufacturer catalog + recommendation.
assert.equal(core.GILMAN_RAM_PUMP_MODELS.length, 24, 'Embedded Gilman catalog should contain all 24 listed pump models.');
assert.equal(core.GILMAN_CATALOG_SNAPSHOT.capturedAt, '2026-10-07', 'Gilman catalog snapshot date should be explicit.');
const lowFlowGilman = core.recommendGilmanRamPump({ sourceFlowLpm: 5, deliveryHeadM: 30 });
assert.equal(lowFlowGilman.status, 'below-catalog-flow', '5 L/min must not be falsely matched to a Gilman model rated from 12 L/min upward.');
assert.equal(lowFlowGilman.recommended, null, 'No exact manufacturer model should be auto-selected outside its published supply-flow range.');
const rp75Gilman = core.recommendGilmanRamPump({ sourceFlowLpm: 15, deliveryHeadM: 40 });
assert.equal(rp75Gilman.recommended?.code, 'RP75', '15 L/min and 40 m lift should prefer the smaller standard RP75.');
const rp75HighGilman = core.recommendGilmanRamPump({ sourceFlowLpm: 15, deliveryHeadM: 80 });
assert.equal(rp75HighGilman.recommended?.code, 'RP75-H', '15 L/min and 80 m lift should prefer RP75-H.');
assert.match(page, /data-ram-source-flow[\s\S]+value="12"/, 'Available source flow must default to 12 L/min when no delivery target is entered.');
assert.match(page, /data-ram-max-lift[\s\S]+max="180"[\s\S]+value="180"/, 'Maximum delivery lift must default to and be capped at 180 m.');
assert.match(ram, /Required source flow \(L\/min\)[\s\S]+requiredSourceFlowForDelivery/, 'Desired delivery flow must switch the source-flow field to an automatically calculated required source flow.');
assert.match(orthomosaic, /toggleAbearcRamPumpDrawer\?\.\(false\)/, 'Opening Drone Orthomaps must close/unhighlight the Ram Pump drawer.');
assert.match(page, /data-ram-model[\s\S]+data-ram-model-suggestion/, 'Ram Pump model field must expose the embedded Gilman auto-suggestion panel.');
assert.match(ram, /recommendGilmanRamPump[\s\S]+does not query gilmanrampump\.com at runtime/i, 'Ram Pump model recommendation must use the embedded offline catalog.');
