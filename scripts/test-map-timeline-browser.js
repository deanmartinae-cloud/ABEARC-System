// Optional visual/interaction check using an existing Playwright installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),http=require('http');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const map=read('src/frontend/scripts/12-abearc-map.js');
const html=read('src/frontend/pages/map.page.html').match(/<section class="abearc-map-viewport-timeline[\s\S]*?<\/section>/)[0];
const mapHtml=read('src/frontend/pages/map.page.html');
const layers=mapHtml.slice(mapHtml.indexOf('<div class="abearc-map-quick-layer-control">'),mapHtml.indexOf('<div class="abearc-map-layer-control">'));
const code=map.slice(map.indexOf('    function formatAbearcMapViewportTimelineDate('),map.indexOf('    function abearcMapScopedFeatureCollection('));
const setup=`
${map.match(/let abearcMapViewportTimelineState = [\s\S]*?;/)[0]}
let abearcMapViewportTimelineDate='',abearcMapViewportTimelineMode='exact',abearcMapViewportTimelineZoom=1;
let abearcMapViewportTimelineScrubTime=null,abearcMapViewportTimelinePlaying=false,abearcMapViewportTimelineTimer=null;
const ABEARC_MAP_VIEWPORT_TIMELINE_PLAY_MS=10000;
let entries=['2025-09-01','2026-09-01','2026-10-05'].map(key=>({key,time:Date.parse(key),count:2,features:[]}));
const abearcMapViewportTimelineEntries=()=>entries,esc=String;
const animateAbearcMapResize=()=>{},collapseAbearcMapExplosion=()=>{},refreshAbearcMapPhotoScope=()=>{},toast=()=>{};
const abearcMap=null,scheduleAbearcMapMarkerRender=()=>{},renderAbearcMapList=()=>{};
`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<style>${read('src/frontend/styles/application.css')} body{margin:0}.hidden{display:none}#mapPage{position:relative;height:100vh;background:#dbe7df}#mapPage .abearc-map-stage{position:relative;width:100%;height:100%}</style><div id="mapPage"><div class="abearc-map-stage">${html}${layers}</div></div><script>${setup}${code}syncAbearcMapViewportTimeline();</script>`)});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const panel=page.locator('[data-map-viewport-timeline]'), launcher=page.locator('[data-map-viewport-timeline-launcher]'), handle=page.locator('[data-map-viewport-timeline-handle]');
  const state=()=>panel.getAttribute('data-state');
  const checkLayers=async()=>{
   for(const open of [false,true]){
    await page.locator('.abearc-map-quick-layers').evaluate((n,open)=>n.classList.toggle('hidden',!open),open);
    const timeline=await panel.boundingBox();
    const layer=await page.locator(open?'.abearc-map-quick-layers':'.abearc-map-quick-layer-launcher').boundingBox();
    assert.ok(timeline.y+timeline.height<=layer.y,'timeline must stay above the basemap controls');
    assert.ok(await launcher.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'timeline launcher must be unobstructed');
   }
   await page.locator('.abearc-map-quick-layers').evaluate(n=>n.classList.add('hidden'));
  };
  const shot=async name=>{await page.waitForTimeout(350);await page.screenshot({path:path.join(root,'output/timeline-'+name+'.png')});};
  fs.mkdirSync(path.join(root,'output'),{recursive:true});
  assert.equal(await state(),'icon');await shot('icon');
  await checkLayers();
  assert.ok((await panel.boundingBox()).width<=44);
  await launcher.click();assert.equal(await state(),'mini');await shot('mini');
  await checkLayers();
  const miniBox=await panel.boundingBox();assert.ok(miniBox.width<=460&&miniBox.height<=102);
  const scrubber=page.locator('[data-map-viewport-timeline-scrubber]');
  await scrubber.focus();await page.keyboard.press('Home');
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelineDate),'2025-09-01');
  await page.locator('[data-map-viewport-timeline-next]').click();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelineDate),'2026-09-01');
  const spacing=await page.locator('[data-map-viewport-timeline-date]').evaluateAll(nodes=>nodes.map(n=>parseFloat(n.style.left)));
  assert.ok(spacing[1]>85&&spacing[1]<100,'date positions must reflect elapsed time');
  await page.locator('[data-map-viewport-timeline-date="2025-09-01"]').click();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelineDate),'2025-09-01');
  const sliderBox=await scrubber.boundingBox();
  await page.mouse.move(sliderBox.x+4,sliderBox.y+sliderBox.height/2);await page.mouse.down();
  await page.mouse.move(sliderBox.x+sliderBox.width-4,sliderBox.y+sliderBox.height/2,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelineDate),'2026-10-05');
  await page.locator('[data-map-viewport-timeline-play]').click();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelinePlaying),true);
  await handle.click();assert.equal(await state(),'full');await shot('full');
  await checkLayers();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelinePlaying),true,'expanding must preserve playback');
  await page.locator('[data-map-viewport-timeline-play]').click();
  await page.locator('[data-map-viewport-timeline-mode-asof]').click();
  assert.equal(await page.evaluate(()=>abearcMapViewportTimelineMode),'asof');
  await page.getByRole('button',{name:'Zoom timeline in',exact:true}).click();
  assert.equal(await page.locator('[data-map-viewport-timeline-zoom-label]').innerText(),'2×');
  await handle.click();assert.equal(await state(),'mini');
  await launcher.click();assert.equal(await state(),'icon');
  assert.equal(await page.locator('[data-map-viewport-timeline-body]').evaluate(n=>n.inert),true);
  await page.reload();assert.equal(await state(),'icon');
  await page.setViewportSize({width:360,height:740});await checkLayers();await launcher.click();await shot('mini-mobile');await checkLayers();
  const mobile=await panel.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=360);
  await handle.click();await shot('full-mobile');
  await checkLayers();
  await page.keyboard.press('Escape');assert.equal(await state(),'mini');
  await page.keyboard.press('Escape');assert.equal(await state(),'icon');
  await page.evaluate(()=>{entries=[];syncAbearcMapViewportTimeline()});await launcher.click();
  assert.equal(await page.locator('[data-map-viewport-timeline-next]').isDisabled(),true);
  assert.equal(await scrubber.isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('Timeline check passed: three animated states, mini dragging, real date spacing, clickable marks, playback, modes, zoom, keyboard, persistence and mobile fit.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
