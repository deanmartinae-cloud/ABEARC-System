// Optional integration test with the real Worker and NAMRIA raster, no app database.
// PLAYWRIGHT_MODULE and CHROME_EXECUTABLE may point to existing local installations.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const backend = read('src/backend/controllers/14-map-media.controller.js');
const terrain = new Function('fs', 'MAP_NAMRIA_DTM_PATH',
  backend.slice(backend.indexOf('const mapElevationSources'), backend.indexOf('const __routeController303')) +
  ';return {mapElevationNamria,mapGravityNamriaNativePath};')(fs, process.env.NAMRIA_DTM_PATH || path.join(root, 'data/namria/DTM_5m.tif'));
const map = read('src/frontend/scripts/12-abearc-map.js');
const setup = `
const API='/api',authToken='test';
const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE='namria-dtm5-prs92';
const ABEARC_MAP_ELEVATION_SOURCES=new Set([ABEARC_MAP_DEFAULT_ELEVATION_SOURCE]);
const ABEARC_MAP_ELEVATION_RESOLUTION_M={'namria-dtm5-prs92':5};
let abearcMapElevationSource=ABEARC_MAP_DEFAULT_ELEVATION_SOURCE;
let abearcMapMeasurePoints=[[125.385277,7.4338092],[125.37986155,7.42925961]];
let abearcMapMeasureMode='distance',abearcMapImportedPolygons=[];
${map.slice(map.indexOf('    function haversineMetres('), map.indexOf('    function formatAbearcDistance('))}
${map.slice(map.indexOf('    async function requestAbearcElevations('), map.indexOf('    async function loadAbearcElevationProfile('))}
`;
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST') {
      let body=''; for await (const chunk of req) body += chunk;
      const data=JSON.parse(body);
      const result=req.url.endsWith('/gravity-path')
        ? await terrain.mapGravityNamriaNativePath({start:data.start,end:data.end,corridorM:data.corridor_m})
        : {source_key:data.source,source:'NAMRIA',elevations:await terrain.mapElevationNamria(data.locations)};
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    const name = req.url.split('?')[0];
    const files = {'/assets/js/map-gravity-worker.js':'src/frontend/scripts/map-gravity-worker.js',
      '/assets/js/19-map-gravity-path.js':'src/frontend/scripts/19-map-gravity-path.js'};
    if (files[name]) {res.setHeader('Content-Type','application/javascript');res.end(read(files[name]));return;}
    res.setHeader('Content-Type','text/html');
    res.end('<button id="interact" onclick="clicks++">Map interaction</button><button id="cancel" onclick="abearcMapGravityPathAbort?.abort()">Cancel</button>' +
      '<script>let clicks=0;' + setup + '</script><script src="/assets/js/19-map-gravity-path.js"></script>');
  } catch (error) {res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
      window.maxFrameGap=0;window.frames=0;let last=performance.now();
      window.timer=setInterval(()=>{const now=performance.now();maxFrameGap=Math.max(maxFrameGap,now-last);last=now;frames++;},16);
      window.stages=[];updateAbearcGravityProgress=(_percent,stage)=>stages.push(stage);
      window.result=null;window.failure=null;
      abearcGravitySearch('namria-dtm5-prs92',true).then(value=>result=value).catch(error=>failure=error.message);
    });
    await page.waitForFunction(()=>stages.includes('Tracing native NAMRIA contours…'));
    await page.locator('#interact').click({timeout:1000});
    await page.waitForFunction(()=>result || failure, null, {timeout:120000});
    const completed=await page.evaluate(()=>({failure,result,clicks,maxFrameGap,frames}));
    assert.equal(completed.failure,null);
    assert.equal(completed.clicks,1);
    assert.ok(completed.frames>30,'page timer must keep running during the search');
    assert.ok(completed.maxFrameGap<500,`main thread stalled ${completed.maxFrameGap}ms`);
    assert.ok(completed.result.uniformSlope.improved);
    assert.ok(completed.result.uniformSlope.improvementPct>10);
    assert.deepEqual(completed.result.plan.locations[0],{longitude:125.385277,latitude:7.4338092});
    assert.deepEqual(completed.result.plan.locations.at(-1),{longitude:125.37986155,latitude:7.42925961});
    assert.ok(completed.result.validatedMaximumStepAscentM<=0.1);
    assert.ok(!completed.result.finalTerrainValidation,'worker should return the route, not large sampling grids');
    // Termination must work while the worker is inside synchronous contour work.
    await page.evaluate(()=>{stages.length=0;window.cancelled=false;window.cancelResult=null;
      abearcGravitySearch('namria-dtm5-prs92',true).then(value=>cancelResult=value).catch(error=>cancelled=error.name==='AbortError');});
    await page.waitForFunction(()=>stages.includes('Tracing native NAMRIA contours…'));
    await page.locator('#cancel').click({timeout:1000});
    await page.waitForFunction(()=>cancelled, null, {timeout:1000});
    assert.equal(await page.evaluate(()=>cancelResult),null);
    // Superseding a search must cancel it without tearing down its replacement.
    const superseded=await page.evaluate(async()=>{
      const old=abearcGravitySearch('namria-dtm5-prs92',false).catch(error=>error.name);
      const replacement=abearcGravitySearch('namria-dtm5-prs92',false);
      const result=await replacement;
      return {old:await old,points:result.indexes.length,uniformSlope:result.uniformSlope};
    });
    assert.equal(superseded.old,'AbortError');assert.ok(superseded.points>=2);assert.equal(superseded.uniformSlope,undefined);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({maxFrameGapMs:completed.maxFrameGap,uiTimerTicks:completed.frames,
      uniformSlope:completed.result.uniformSlope,cancellation:'passed',supersession:'passed'},null,2));
  } finally {if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
