const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const core = require('../src/frontend/scripts/21-map-ram-pump-core.js');
const source = fs.readFileSync(path.join(root, 'src/frontend/scripts/22-map-ram-pump.js'), 'utf8');

class ClassList {
  constructor(initial = '') { this.values = new Set(String(initial).split(/\s+/).filter(Boolean)); }
  add(...v) { v.forEach(x => this.values.add(x)); }
  remove(...v) { v.forEach(x => this.values.delete(x)); }
  contains(v) { return this.values.has(v); }
  toggle(v, force) { const on = force == null ? !this.contains(v) : Boolean(force); on ? this.add(v) : this.remove(v); return on; }
}
class Element {
  constructor(name = 'div', classes = '') { this.tagName = name.toUpperCase(); this.classList = new ClassList(classes); this.attributes = {}; this.children = []; this.value = ''; this.checked = false; this.style = {}; this.textContent = ''; this._html = ''; this.options = []; this.clientWidth = 390; this.clientHeight = 760; }
  set innerHTML(value) { this._html = String(value); if (this.tagName === 'SELECT') this.options = [...this._html.matchAll(/<option(?:\s+value="([^"]*)")?[^>]*>([^<]*)<\/option>/g)].map(m => ({ value:m[1] ?? m[2], textContent:m[2] })); }
  get innerHTML() { return this._html; }
  get childElementCount() { return this.children.length; }
  setAttribute(k,v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  setPointerCapture() {}
  querySelector(selector) { return this._query?.[selector] || null; }
  getBoundingClientRect() { return { left:0, top:0, width:this.clientWidth, height:this.clientHeight }; }
}

const selectors = new Map();
const add = (selector, element = new Element()) => { selectors.set(selector, element); return element; };
const panel = add('[data-map-ram-pump-panel]', new Element('aside', 'abearc-map-ram-pump-drawer hidden'));
const toolbar = add('[data-map-ram-pump-toolbar]', new Element('button'));
const resultsPanel = add('[data-map-results-panel]', new Element('aside'));
const measurement = add('[data-ram-measurement]', new Element('select'));
const elevationSource = add('[data-ram-elevation-source]', new Element('select')); elevationSource.value = 'namria-dtm5-prs92';
for (const [selector, value] of [
  ['[data-ram-source-flow]','12'], ['[data-ram-desired-flow]',''], ['[data-ram-efficiency]','0.60'], ['[data-ram-c]','140'], ['[data-ram-min-head]','1.5'], ['[data-ram-max-lift]','180'], ['[data-ram-max-support-height]','6'], ['[data-ram-hours]','24'],
  ['[data-ram-drive-diameter]',''], ['[data-ram-delivery-diameter]',''], ['[data-ram-material]','HDPE'], ['[data-ram-model]','']
]) { const el = add(selector, new Element('input')); el.value = value; }
const driveInstallation = add('[data-ram-drive-installation]', new Element('select')); driveInstallation.value='ground';
const driveAlignment = add('[data-ram-drive-alignment]', new Element('select')); driveAlignment.value='straight-preferred';
const designBasis = add('[data-ram-design-basis]', new Element('select')); designBasis.value='generic';
const driveLengthRule = add('[data-ram-drive-length-rule]', new Element('select')); driveLengthRule.value='peace-corps';
const longDriveTreatment = add('[data-ram-long-drive-treatment]', new Element('select')); longDriveTreatment.value='auto-standpipe';
add('[data-ram-support-height-field]', new Element('label'));
const visible = add('[data-ram-visible]', new Element('input')); visible.checked = true;
const progress = add('[data-ram-progress]', new Element('section', 'hidden'));
progress._query = {};
for (const selector of ['[data-ram-progress-bar]','[data-ram-progress-percent]','[data-ram-progress-stage]','[data-ram-progress-detail]']) progress._query[selector] = new Element();
add('[data-ram-result-status]', new Element()); add('[data-ram-summary]', new Element()); add('[data-ram-measurement-summary]', new Element()); add('[data-ram-source-flow-label]', new Element('span')); add('[data-ram-source-flow-note]', new Element('div')); add('[data-ram-drive-installation-note]', new Element('div')); add('[data-ram-drive-length-note]', new Element('div')); add('[data-ram-model-suggestion]', new Element('div')); add('[data-ram-full-calculation]', new Element('button')); add('[data-ram-profile-slot]', new Element('div')); add('[data-ram-profile]', new Element('div','hidden')); add('[data-ram-candidates]', new Element()); add('[data-ram-assessment]', new Element());
const overlay = add('[data-map-ram-pump-layer]', new Element('svg'));
const stage = add('.abearc-map-stage', new Element('div')); stage.clientWidth=900; stage.clientHeight=700;

const document = {
  querySelector(selector) { return selectors.get(selector) || null; },
  querySelectorAll() { return []; },
  createElementNS(_ns, name) { return new Element(name); },
  createElement(name) { return new Element(name); },
  addEventListener() {},
  body: new Element('body')
};
const toastMessages = [];
let openedCalculationHtml = '';
const context = {
  console, document, window:null, globalThis:null, abearcRamPumpCore:core,
  abearcMapElevationSource:'namria-dtm5-prs92', abearcMapActiveMeasurementId:'distance-ram-test',
  abearcMapMeasurements:[{ id:'distance-ram-test', name:'Synthetic source to reservoir', mode:'distance', visible:true, points:[[125,7],[125.008,7]] }],
  abearcMultiCaptureCurrentRecord:()=>null,
  closeAbearcMapMeasureContextMenu:()=>{}, rememberAbearcMapLayoutChange:()=>{},
  toast:(message,type='ok')=>toastMessages.push({message:String(message),type}),
  requestAnimationFrame:fn=>{fn();return 0;}, cancelAnimationFrame:()=>{}, setTimeout:fn=>{fn();return 0;}, clearTimeout:()=>{},
  Blob, URL, DOMException, AbortController, AbortSignal,
  open(){ return { opener:null, document:{ open(){}, write(html){ openedCalculationHtml=String(html); }, close(){} }, focus(){}, close(){} }; },
};
context.window = context; context.globalThis = context;
context.toggleAbearcMapLayoutsDrawer=()=>false; context.toggleAbearcOrthomosaicDrawer=()=>false;
context.abearcMap={
  project(point){ return {x:(Number(point[0])-124.999)*90000,y:(7.002-Number(point[1]))*90000}; },
  unproject(point){ return {lng:124.999+Number(point[0])/90000,lat:7.002-Number(point[1])/90000}; },
  on(){}, off(){}, dragPan:{disable(){},enable(){}}
};
context.requestAbearcElevations=async locations=>({ sourceKey:'namria-dtm5-prs92', sourceLabel:'Synthetic DTM 5 m', elevations:locations.map(item=>{
  const lng=Number(item.longitude), lat=Number(item.latitude), x=(lng-125)*110000, y=(lat-7)*110000;
  const ds=Math.hypot(x,y), dd=Math.hypot((lng-125.008)*110000,y);
  if(ds<4) return 100; if(dd<4) return 120;
  if(x>110&&x<520&&y>55&&y<150) return 92;
  return 99;
})});
context.abearcGravityBuildPlan=(start,end)=>{
  const dx=(end[0]-start[0])*110000, dy=(end[1]-start[1])*110000, d=Math.max(1,Math.hypot(dx,dy));
  return {rows:1,columns:2,startIndex:0,endIndex:1,spacingM:d,locations:[{longitude:start[0],latitude:start[1]},{longitude:end[0],latitude:end[1]}],local:[{x:0,y:0},{x:d,y:0}],activeMask:[1,1]};
};
context.abearcGravityFindPathOnGrid=(plan,elevations)=>Number(elevations[1])<=Number(elevations[0])+0.15?[0,1]:null;

vm.createContext(context); vm.runInContext(source, context, { filename:'22-map-ram-pump.js' });

(async()=>{
  await context.openAbearcRamPumpFromMeasurement();
  assert(!panel.classList.contains('hidden'), 'Ram-pump panel must open from the distance-line context action.');
  assert(resultsPanel.classList.contains('hidden'), 'Opening Ram Pump must hide the competing photo-results drawer.');
  assert(measurement.options.some(option=>option.value==='distance-ram-test'), 'Distance measurement must populate the panel.');
  assert.match(selectors.get('[data-ram-measurement-summary]').innerHTML, /A · Source[\s\S]+B · Destination[\s\S]+Measured alignment/, 'Selected measurement must be clearly summarized in the drawer.');
  const generated = context.captureAbearcRamPumpState();
  assert.equal(selectors.get('[data-ram-source-flow]').value, 12, 'Default source flow must display as 12 L/min.');
  assert(Math.abs(generated.inputs.sourceFlowLps - 12/60) < 1e-12, '12 L/min must convert to 12/60 L/s internally.');
  assert.equal(generated.inputs.maxDeliveryLiftM, 180, 'Default maximum delivery lift must be 180 m.');
  assert.equal(generated.inputs.driveInstallation, 'ground', 'Default drive-pipe installation must be on ground.');
  assert.equal(generated.inputs.driveAlignment, 'straight-preferred', 'Straight-preferred must be the default drive-pipe alignment.');
  assert.equal(generated.inputs.maxSupportHeightM, 6, 'Default elevated support-height planning limit must be 6 m.');
  assert.equal(generated.inputs.driveLengthRule, 'peace-corps', 'Peace Corps 150D–1000D must be the default drive-pipe length reference.');
  assert.equal(generated.inputs.longDriveTreatment, 'auto-standpipe', 'Long drive runs must default to automatic standpipe treatment.');
  assert(generated?.metrics, `Generation failed: ${JSON.stringify(toastMessages)}`);
  assert.equal(generated.metrics.drivePipeControl?.enabled, true, 'Generated layout must evaluate the Peace Corps drive-pipe length rule.');
  if (generated.metrics.drivePipeControl.totalLengthM > generated.metrics.drivePipeControl.maxM + 0.05) {
    assert.equal(generated.metrics.drivePipeControl.deviceType, 'standpipe', 'A source-to-pump run beyond Lmax must automatically insert a standpipe by default.');
    assert(generated.metrics.drivePipeControl.effectiveDriveLengthM <= generated.metrics.drivePipeControl.maxM + 0.25, 'Automatic standpipe must reduce the effective rigid drive-pipe length to Lmax or less.');
    assert(generated.metrics.drivePipeControl.supplyPipeDiameterMm > generated.metrics.drivePipe.diameterMm, 'Standpipe arrangement must upsize the upstream supply pipe relative to the drive pipe.');
  }
  assert(generated.candidates.length >= 1, 'Generation must retain pump-site candidates.');
  const offset = core.distancePointToSegmentM(generated.pump, generated.source, generated.destination);
  assert(offset > 45, `Pump location must search off A→B; got ${offset.toFixed(1)} m.`);
  assert(generated.driveRoute.length >= 2 && generated.deliveryRoute.length >= 2, 'Both pipe routes must be generated.');
  assert.equal(generated.metrics.driveRouteStraight, true, 'Straight-preferred generation should use a no-turn drive pipe when the direct descending alignment is feasible.');
  assert(generated.profile.some(item=>item.segment==='drive') && generated.profile.some(item=>item.segment==='delivery'), 'Elevation profile must contain drive and delivery segments.');
  assert(generated.metrics.hydraulic.deliveredFlowLps > 0, 'Hydraulic calculation must estimate positive delivery flow.');
  context.toggleAbearcRamPumpProfileFloating(true);
  assert(selectors.get('[data-ram-profile]').classList.contains('is-floating'), 'Elevation profile must support floating over the map.');
  context.toggleAbearcRamPumpProfileExpanded(true);
  assert(selectors.get('[data-ram-profile]').classList.contains('is-expanded'), 'Elevation profile must support a larger view.');
  context.showAbearcRamPumpFullCalculation();
  assert.match(openedCalculationHtml, /12\.00 L\/min/);
  assert.match(openedCalculationHtml, /Qd × 0\.06 × operating hours/);
  assert(!openedCalculationHtml.includes(' L/s'), 'Report flow units must consistently use litres per minute.');
  assert.match(openedCalculationHtml, /Detailed Calculation[\s\S]+Ram-pump system figure[\s\S]+Lmin = 150D[\s\S]+Lmax = 1000D[\s\S]+Pipe sizing calculation[\s\S]+Hazen-Williams[\s\S]+Delivered flow/, 'Full calculation tab must show the ram-pump figure, Peace Corps drive-pipe length check, pipe sizing and hydraulic equation workflow.');
  assert.match(openedCalculationHtml, /ram-pump-manual-reference\.png[\s\S]+Current generated layout/, 'Full calculation must include the exact manual reference image and current project annotations.');
  assert(!/downloadRamPumpFigureSvg\(\)|downloadRamPumpFigureDxf\(\)|Export DXF/.test(openedCalculationHtml), 'SVG and DXF export buttons must not appear in the calculation page.');
  assert.match(openedCalculationHtml, /class="report-sheet"[\s\S]+sheet-masthead[\s\S]+Pipe sizing calculation[\s\S]+Feasibility assessment/, 'Detailed calculation must render the new report-style engineering sheet.');
  assert.match(openedCalculationHtml, /Equivalent D \(in\)[\s\S]+nearest standard nominal inch pipe size/, 'Detailed calculation must present equivalent diameter using standard nominal inch sizes.');
  assert.match(openedCalculationHtml, /data-ram-calculation-profile[\s\S]+Elevation profile/, 'Detailed calculation must include the elevation profile in the report sheet.');
  assert(overlay.childElementCount > 0, 'Generated map overlay must contain visible engineering geometry.');
  assert.equal(context.abearcMapMeasurements?.find(record => record.id === 'distance-ram-test')?.visible, false, 'Successful Ram Pump generation must hide the originating distance measurement to reduce clutter.');
  assert.equal(context.abearcRamPumpHiddenMeasurementId, 'distance-ram-test', 'Successful generation must also hide the currently active source distance measurement.');

  // Peace Corps / Warwick S-2 mode must apply its model-specific envelope and Table 2 drive diameter.
  selectors.get('[data-ram-design-basis]').value = 'peace-corps-s2';
  selectors.get('[data-ram-source-flow]').value = '60';
  await context.updateAbearcRamPumpInputs({recalculate:true});
  const s2Design = context.captureAbearcRamPumpState();
  assert.notEqual(s2Design.assessment.level, 'not-feasible', `The synthetic site should remain within the S-2 head/flow envelope at 60 L/min: ${JSON.stringify(s2Design.assessment)}`);
  assert(Math.abs(Number(s2Design.metrics.drivePipe?.diameterMm) - 25.4) < 0.05, 'S-2 reference mode must apply the 1-inch / 25.4 mm Table 2 drive-pipe diameter at 60 L/min.');
  assert((s2Design.assessment.reasons || []).some(reason => /rigid drive pipe/i.test(reason)), 'S-2/Peace Corps review must warn that the ram-pump drive pipe needs sufficient rigidity for water-hammer transmission.');
  selectors.get('[data-ram-source-flow]').value = '150';
  await context.updateAbearcRamPumpInputs({recalculate:true});
  const s2OutOfRange = context.captureAbearcRamPumpState();
  assert.equal(s2OutOfRange.assessment.level, 'not-feasible', 'S-2 reference mode must reject source flow outside its published 40–120 L/min envelope.');
  assert((s2OutOfRange.assessment.reasons || []).some(reason => /40.*120 L\/min/i.test(reason)), 'S-2 out-of-range diagnostic must state the reference source-flow envelope.');
  context.restoreAbearcRamPumpState(generated);

  selectors.get('[data-ram-desired-flow]').value = '1';
  await context.updateAbearcRamPumpInputs();
  const targeted = context.captureAbearcRamPumpState();
  assert.equal(selectors.get('[data-ram-source-flow]').readOnly, true, 'Entering desired delivery flow must make source flow an automatically calculated field.');
  assert.equal(selectors.get('[data-ram-source-flow-label]').textContent, 'Required source flow (L/min)', 'Source-flow label must switch to Required source flow.');
  assert(targeted.inputs.sourceFlowLps > 0 && Math.abs(targeted.inputs.sourceFlowLps - 12/60) > 1e-6, 'Desired delivery flow must replace the 12 L/min default with a computed required source flow.');
  assert(Math.abs(targeted.metrics.hydraulic.deliveredFlowLps - 1/60) < 0.0015, 'Computed required source flow must satisfy the desired delivery target within hydraulic tolerance.');
  selectors.get('[data-ram-desired-flow]').value = '';
  await context.updateAbearcRamPumpInputs();
  assert.equal(selectors.get('[data-ram-source-flow]').readOnly, false, 'Clearing desired delivery flow must return source flow to an editable field.');
  assert.equal(Number(selectors.get('[data-ram-source-flow]').value), 12, 'Clearing desired delivery flow must restore the 12 L/min default.');
  context.restoreAbearcRamPumpState(generated);

  const failed = JSON.parse(JSON.stringify(generated));
  failed.assessment = { level:'not-feasible', title:'No Practical Ram Pump Layout Found', reasons:['Synthetic infeasible condition'] };
  context.restoreAbearcRamPumpState(failed);
  assert.equal(overlay.childElementCount, 0, 'A No Practical Ram Pump Layout Found result must not leave ram-pump points or routes on the map.');

  const saved = JSON.parse(JSON.stringify(generated));
  context.restoreAbearcRamPumpState(saved);
  assert(overlay.childElementCount > 0, 'Restoring a feasible Ram Pump state must redraw the map overlay.');

  // Uneven natural ground may locally rise while remaining below a straight continuously descending elevated drive-pipe grade.
  const supportState = JSON.parse(JSON.stringify(saved));
  supportState.driveRoute = [supportState.source, supportState.pump];
  supportState.inputs.driveAlignment = 'straight-only';
  supportState.inputs.driveInstallation = 'ground';
  const driveFrame = core.localFrame([supportState.source, supportState.pump]);
  const da = driveFrame.project(supportState.source), db = driveFrame.project(supportState.pump), ddx=db[0]-da[0], ddy=db[1]-da[1], dden=Math.max(1e-9,ddx*ddx+ddy*ddy);
  const deliveryFrame = core.localFrame([supportState.pump, supportState.destination]);
  const pa = deliveryFrame.project(supportState.pump), pb = deliveryFrame.project(supportState.destination), pdx=pb[0]-pa[0], pdy=pb[1]-pa[1], pden=Math.max(1e-9,pdx*pdx+pdy*pdy);
  context.requestAbearcElevations = async locations => ({ sourceKey:'namria-dtm5-prs92', sourceLabel:'Undulating support-mode DTM', elevations:locations.map(item=>{
    const point=[Number(item.longitude),Number(item.latitude)], xy=driveFrame.project(point);
    const t=((xy[0]-da[0])*ddx+(xy[1]-da[1])*ddy)/dden;
    const driveOffset=core.distancePointToSegmentM(point,supportState.source,supportState.pump);
    if(t>=-0.01 && t<=1.01 && driveOffset<12){
      const tc=Math.max(0,Math.min(1,t)), design=100+(92-100)*tc;
      if(tc<0.01 || tc>0.99) return design;
      const support=2+1.45*Math.sin(tc*Math.PI*4);
      return design-support;
    }
    const pxy=deliveryFrame.project(point), u=Math.max(0,Math.min(1,((pxy[0]-pa[0])*pdx+(pxy[1]-pa[1])*pdy)/pden));
    return 92+(120-92)*u;
  })});
  context.restoreAbearcRamPumpState(supportState);
  await context.recalculateAbearcRamPumpLayout({remember:false,quiet:true});
  const onGroundUneven=context.captureAbearcRamPumpState();
  assert.equal(onGroundUneven.assessment.level,'not-feasible','On-ground straight-only mode must reject a drive route with sampled terrain ascent.');
  selectors.get('[data-ram-drive-installation]').value='elevated-supports'; selectors.get('[data-ram-drive-alignment]').value='straight-only'; selectors.get('[data-ram-max-support-height]').value='6';
  await context.updateAbearcRamPumpInputs({recalculate:true});
  const elevatedUneven=context.captureAbearcRamPumpState();
  assert.notEqual(elevatedUneven.assessment.level,'not-feasible',`Elevated support mode should accept uneven ground below a continuous descending pipe grade: ${JSON.stringify(elevatedUneven.assessment)}`);
  assert.equal(elevatedUneven.metrics.driveRouteStraight,true,'Elevated straight-only mode must retain a no-turn drive pipe.');
  assert(elevatedUneven.metrics.driveSupport.maxRequiredSupportHeightM>0 && elevatedUneven.metrics.driveSupport.maxRequiredSupportHeightM<=6.25,'Elevated mode must calculate a finite support-frame height within the planning limit.');
  assert(elevatedUneven.metrics.driveSupport.terrainIntrusionM<=0.35,'Elevated mode must verify that terrain does not protrude through the drive-pipe grade.');

  context.requestAbearcElevations = async locations => ({ sourceKey:'namria-dtm5-prs92', sourceLabel:'Flat synthetic DTM 5 m', elevations:locations.map(()=>100) });
  await context.generateAbearcRamPumpSystemLayout();
  const noLayout = context.captureAbearcRamPumpState();
  assert.equal(noLayout?.assessment?.level, 'not-feasible', 'Flat terrain must produce No Practical Ram Pump Layout Found.');
  assert.equal(noLayout?.pump, null, 'Failed terrain generation must clear the proposed ram-pump point.');
  assert.equal(noLayout?.metrics, null, 'Failed terrain generation must not retain generated hydraulic metrics.');
  assert.equal(overlay.childElementCount, 0, 'Failed terrain generation must clear all Ram Pump overlay points/routes.');

  context.restoreAbearcRamPumpState(null);
  assert.equal(context.captureAbearcRamPumpState(), null, 'Restoring a layout without Ram Pump state must clear Ram Pump state.');
  assert.equal(overlay.childElementCount, 0, 'Restoring a layout without Ram Pump state must clear stale overlay geometry.');
  assert.equal(context.abearcMapMeasurements?.find(record => record.id === 'distance-ram-test')?.visible, true, 'Clearing/restoring a null Ram Pump state must restore the source distance measurement visibility.');
  assert.equal(context.abearcRamPumpHiddenMeasurementId || '', '', 'Clearing the Ram Pump layout must restore the active-measurement hide marker.');
  assert.equal(context.restoreAbearcRamPumpState(saved), true);
  const restored = context.captureAbearcRamPumpState();
  assert(overlay.childElementCount > 0, 'Restored Ram Pump state must redraw its overlay.');
  assert.equal(restored.metrics.driveHeadM, saved.metrics.driveHeadM, 'Restored engineering metrics must be stable.');
  assert.equal(restored.driveRoute.length, saved.driveRoute.length, 'Restored drive route must preserve editable geometry.');

  console.log(`Ram Pump workflow passed: ${generated.candidates.length} candidate(s), off-line pump offset ${offset.toFixed(1)} m, assessment=${generated.assessment.level}, delivered=${generated.metrics.hydraulic.deliveredFlowLps.toFixed(3)} L/s; null restore cleared stale overlay and saved state restored it.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
