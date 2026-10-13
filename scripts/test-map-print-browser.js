// Optional browser integration check. Uses synthetic, explicitly labelled map/photo
// fixtures and the real MapLibre renderer; never opens the production database.
// Set PLAYWRIGHT_MODULE to an installed Playwright module path if not on NODE_PATH.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const http=require('http');
const sharp=require('sharp');
const {PDFDocument}=require('pdf-lib');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'docs/map-print/verification');fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'};
const html=`<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/assets/vendor/maplibre-gl.css"><link rel="stylesheet" href="/assets/css/map-print.css"></head><body>
<div id="mapPage"><div class="abearc-map-stage" style="position:relative"><div id="live" style="width:1100px;height:700px"></div><button class="abearc-map-print-control" aria-label="Open map print mode" onclick="openAbearcMapPrint()">P</button><svg id="abearcMapMeasureLayer" width="1100" height="700" style="position:absolute;top:0;left:0;pointer-events:none"><polyline points="400,300 600,340 650,450" style="fill:none;stroke:#e11d48;stroke-width:3"/><text x="500" y="330" style="fill:#111;font:12px Arial">Test measurement</text></svg></div></div>
<script src="/assets/vendor/maplibre-gl.js"></script><script>
var abearcMap,currentUser={id:1},abearcMapPhotosVisible=true,features=[];var hasPrivilege=()=>true,toast=message=>{throw Error(message)},abearcAuthenticatedMediaUrl=url=>url,abearcMapScopedFeatures=()=>features;
var abearcMapSessionHiddenPhotoIds=new Set(),abearcMapMovedPhotoPositions=new Map(),abearcMapExpandedPhotos=new Map(),abearcFeatureId=f=>f.id||f.properties.id;
window.boot=async()=>{await abearcMapLibreReady;const on=maplibregl.Map.prototype.on;window.maps=[];maplibregl.Map.prototype.on=function(...args){if(!maps.includes(this))maps.push(this);return on.apply(this,args)};
abearcMap=new maplibregl.Map({container:'live',center:[125.5,7.1],zoom:14,bearing:12,style:{version:8,sources:{fixture:{type:'geojson',attribution:'Synthetic test data — ABEARC verification',data:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[125.49,7.095],[125.51,7.105]]},properties:{}}]}}},layers:[{id:'background',type:'background',paint:{'background-color':'#e1e8dc'}},{id:'test-route',type:'line',source:'fixture',paint:{'line-color':'#ca8a04','line-width':5}}]}});
await new Promise(resolve=>abearcMap.on('load',resolve));for(let i=0;i<10;i++)features.push({type:'Feature',geometry:{type:'Point',coordinates:[125.5+(i%5-2)*.0015,7.1+(Math.floor(i/5)-.5)*.002]},properties:{id:i+1,category:'Test photo '+(i+1),thumbnail_url:'/fixture.png',bearing_deg:i*30}});};
</script><script src="/assets/js/15-map-print.js"></script></body></html>`;
(async()=>{
const fixture=await sharp(Buffer.from('<svg width="240" height="160" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="160" fill="#307a54"/><path d="M0 140L70 50 130 120 185 40 240 140" fill="#a9d58a"/><circle cx="195" cy="30" r="16" fill="#ffe296"/><text x="20" y="150" font-size="16" fill="white">TEST PHOTO</text></svg>')).png().toBuffer();
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}if(req.url==='/fixture.png'){res.setHeader('Content-Type','image/png');return res.end(fixture);}const file=path.resolve(root,'public','.'+req.url.split('?')[0]);if(!file.startsWith(path.join(root,'public')+path.sep)){res.statusCode=403;return res.end();}try{res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());});
await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>boot());
const before=await page.evaluate(()=>JSON.stringify({camera:[abearcMap.getCenter(),abearcMap.getZoom(),abearcMap.getBearing()],style:abearcMap.getStyle(),features,storage:{...localStorage}}));
await page.getByRole('button',{name:'Open map print mode'}).click();await page.getByRole('status').filter({hasText:'authorized photos copied'}).waitFor();
assert.deepStrictEqual(await page.evaluate(()=>[maps[1].getCenter().toArray(),maps[1].getZoom(),maps[1].getBearing()]),await page.evaluate(()=>[maps[0].getCenter().toArray(),maps[0].getZoom(),maps[0].getBearing()]));
const photo=page.locator('[data-photo="0"]');const b=await photo.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+70,b.y+b.height/2+45,{steps:8});await page.mouse.up();const moved=await photo.boundingBox();assert(Math.abs(moved.x-b.x)>20);
await page.keyboard.press('Escape');await page.waitForFunction(x=>Math.abs(document.querySelector('[data-photo="0"]').getBoundingClientRect().x-x)<1,b.x);const cancelled=await photo.boundingBox();assert(Math.abs(cancelled.x-b.x)<1);
await photo.click();await photo.locator('[data-corner=se]').waitFor({state:'visible'});const h=await photo.locator('[data-corner=se]').boundingBox();await page.mouse.move(h.x+5,h.y+5);await page.mouse.down();await page.mouse.move(h.x+45,h.y+30,{steps:5});await page.mouse.up();const resized=await photo.boundingBox();assert(resized.width>b.width);assert(Math.abs(resized.width/resized.height-1.5)<.02);await page.keyboard.press('Enter');
await photo.click({button:'right'});await page.getByRole('menuitem',{name:'Hide from Print',exact:true}).click();await photo.waitFor({state:'hidden'});
await page.getByRole('button',{name:'Arrange photos / restore hidden'}).click();await photo.waitFor({state:'visible'});
await photo.click({button:'right'});await page.getByRole('menuitem',{name:'Photo Details',exact:true}).click();await page.getByText('Longitude:',{exact:false}).waitFor();await page.getByRole('button',{name:'Close photo',exact:true}).click();
await photo.click({button:'right'});await page.getByRole('menuitem',{name:'Reset Position and Size',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-photo="0"]').classList.contains('is-selected'));
assert(Math.abs((await photo.boundingBox()).width-b.width)<1);
const target=await page.locator('[data-photo="1"]').boundingBox(),own=await photo.boundingBox();
await page.mouse.move(own.x+own.width/2,own.y+own.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2+2,own.y+own.height/2+20,{steps:6});await page.screenshot({path:path.join(out,'alignment-guides.png')});await page.mouse.up();await page.keyboard.press('Escape');
await page.locator('.map-print details').first().locator('summary').click();await page.locator('input[type=checkbox][data-layer="test-route"]').uncheck();assert.strictEqual(await page.evaluate(()=>maps[1].getLayoutProperty('test-route','visibility')),'none');assert.notStrictEqual(await page.evaluate(()=>maps[0].getLayoutProperty('test-route','visibility')),'none');await page.locator('input[type=checkbox][data-layer="test-route"]').check();
await page.screenshot({path:path.join(out,'composer-desktop.png')});
await page.locator('[name=margin]').fill('12');await page.locator('[name=margin]').blur();
assert(Math.abs(await page.locator('.map-print-map').evaluate(n=>parseFloat(n.style.left))-12*96/25.4)<.01);
await page.getByRole('button',{name:'Undo',exact:true}).click();
assert.strictEqual(await page.locator('[name=margin]').inputValue(),'8.5');
assert(Math.abs(await page.locator('.map-print-map').evaluate(n=>parseFloat(n.style.left))-8.5*96/25.4)<.01);
const dims=require('../src/frontend/scripts/15-map-print.js').papers;
for(const [paper,mm] of Object.entries(dims))for(const orientation of ['Portrait','Landscape']) {
 await page.locator('[name=paper]').selectOption(paper);await page.locator('[name=orientation]').selectOption(orientation);await page.locator('[name=dpi]').selectOption('96');
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const download=await downloading;const dest=path.join(out,download.suggestedFilename());await download.saveAs(dest);
 const pdf=await PDFDocument.load(fs.readFileSync(dest));const size=orientation==='Portrait'?mm:[...mm].reverse();const box=pdf.getPage(0).getSize();assert(Math.abs(box.width-size[0]*72/25.4)<.01);assert(Math.abs(box.height-size[1]*72/25.4)<.01);
 await page.waitForFunction(()=>!document.querySelector('.map-print').classList.contains('is-exporting'));
}
await page.locator('[name=paper]').selectOption('A4');await page.locator('[name=orientation]').selectOption('Portrait');await page.locator('[name=dpi]').selectOption('300');
const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const download=await downloading;const png=path.join(out,'A4-300dpi.png');await download.saveAs(png);const meta=await sharp(png).metadata();assert.strictEqual(meta.width,2480);assert.strictEqual(meta.height,3508);
await page.waitForFunction(()=>!document.querySelector('.map-print').classList.contains('is-exporting'));
// Exercise the direct-print document without sending a job to a physical printer.
await page.evaluate(()=>{window.printDocumentChecked=false;const observer=new MutationObserver(()=>{const frame=document.querySelector('.map-print iframe');if(frame){frame.contentWindow.print=()=>{window.printDocumentChecked=frame.contentDocument.querySelectorAll('img').length===1 && !frame.contentDocument.querySelector('button,canvas,.map-print-menu');};observer.disconnect();}});observer.observe(document.querySelector('.map-print'),{childList:true});});
await page.getByRole('button',{name:'Print',exact:true}).click();await page.waitForFunction(()=>window.printDocumentChecked);await page.waitForFunction(()=>!document.querySelector('.map-print').classList.contains('is-exporting'));
await page.evaluate(()=>maps[1].jumpTo({center:[125.6,7.2],zoom:13}));await page.waitForFunction(()=>[...document.querySelectorAll('.map-print-photo')].every(n=>n.hidden));
await page.getByRole('button',{name:'Close',exact:true}).click();
const after=await page.evaluate(()=>JSON.stringify({camera:[abearcMap.getCenter(),abearcMap.getZoom(),abearcMap.getBearing()],style:abearcMap.getStyle(),features,storage:{...localStorage}}));assert.strictEqual(after,before);assert.deepStrictEqual(writes,[]);assert.deepStrictEqual(errors,[]);
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open map print mode'}).click();await page.getByRole('status').filter({hasText:'authorized photos copied'}).waitFor();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.screenshot({path:path.join(out,'composer-mobile.png')});await page.getByRole('button',{name:'Close',exact:true}).click();
const crowded=[];
for(const count of [1,50,100]) {await page.evaluate(count=>{const template=features[0];features=Array.from({length:count},(_,i)=>({...template,geometry:{type:'Point',coordinates:[125.5+(i%10-5)*.0002,7.1+(Math.floor(i/10)-5)*.0002]},properties:{...template.properties,id:i+1}}));},count);const start=Date.now();await page.getByRole('button',{name:'Open map print mode'}).click();await page.getByRole('status').filter({hasText:'authorized photos copied'}).waitFor();assert.strictEqual(await page.locator('.map-print-photo').count(),count);crowded.push({photos:count,openMs:Date.now()-start});await page.getByRole('button',{name:'Close',exact:true}).click();}
assert.deepStrictEqual(writes,[]);assert.deepStrictEqual(errors,[]);
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,pdfPages:10,png:[meta.width,meta.height],writes,errors,sandboxUnchanged:after===before,directPrintDocument:true,crowded},null,2));console.log('Browser print checks passed; artifacts: '+out);
} finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
