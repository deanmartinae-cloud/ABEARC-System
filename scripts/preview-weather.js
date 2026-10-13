// Local review harness: reads the station database, writes only an isolated forecast cache.
const fs=require('node:fs'),path=require('node:path'),express=require('express'),sqlite3=require('sqlite3');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=new sqlite3.Database(path.join(root,'data/data.db'),sqlite3.OPEN_READONLY);
const cache=new sqlite3.Database(path.join(root,'output/weather-preview-cache.db'));
const connection=sql=>sql.includes('WeatherForecastCache')?cache:source;
const dbGet=(sql,args=[])=>new Promise((resolve,reject)=>connection(sql).get(sql,args,(e,r)=>e?reject(e):resolve(r)));
const dbAll=(sql,args=[])=>new Promise((resolve,reject)=>connection(sql).all(sql,args,(e,r)=>e?reject(e):resolve(r||[])));
const dbRun=(sql,args=[])=>new Promise((resolve,reject)=>connection(sql).run(sql,args,function(e){e?reject(e):resolve({lastID:this.lastID,changes:this.changes});}));
const app=express();
const mapMarkup=read('src/frontend/pages/map.page.html');
const stationDrawer=mapMarkup.match(/<aside data-weather-stations-drawer[\s\S]*?<\/aside>/)?.[0]||'';
const stationRail=mapMarkup.match(/<button[^>]*data-weather-stations-rail[\s\S]*?<\/button>/)?.[0]||'';
const boot=`const logError=()=>{};const weatherNowIso=()=>new Date().toISOString();const weatherJsonExtra=null;`;
const files=['src/backend/config/21-weather.config.js','src/backend/services/21-weather-analytics.service.js','src/backend/services/22-weather-advisory.service.js','src/backend/controllers/21-weather.controller.js','src/backend/services/21-weather-forecast.service.js'];
const handlers=new Function('crypto','DATA_DIR','fs','path','__dirname','dbGet','dbAll','dbRun','XLSX','PDFDocument','StandardFonts','rgb',boot+files.map(read).join('\n')+'\nreturn {__routeController500,__routeController501,__routeController502,__routeController503,__routeController504,__routeController505,__routeController506,__routeController507,__routeController508,__routeController509,__routeController515,weatherForecastController,weatherCropAdvisoriesController,weatherCropAdvisoryLibraryController};')(require('node:crypto'),path.join(root,'data'),fs,path,root,dbGet,dbAll,dbRun,require('xlsx'),require('pdf-lib').PDFDocument,require('pdf-lib').StandardFonts,require('pdf-lib').rgb);
const endpoints={'crop-advisory-library':'weatherCropAdvisoryLibraryController','stations/:id/crop-advisories':'weatherCropAdvisoriesController','map-stations':'__routeController500','stations':'__routeController501','stations/:id':'__routeController502','stations/:id/current':'__routeController503','stations/:id/history':'__routeController504','stations/:id/agriculture':'__routeController505','stations/:id/summary':'__routeController506','stations/:id/export.csv':'__routeController507','stations/:id/export.xlsx':'__routeController508','stations/:id/report.pdf':'__routeController509','stations/:id/alerts':'__routeController515','stations/:id/forecast':'weatherForecastController'};
Object.entries(endpoints).forEach(([route,handler])=>app.get('/api/weather/'+route,(req,res)=>handlers[handler](req,res)));
app.use('/assets',express.static(path.join(root,'public/assets')));
app.get('/',(req,res)=>res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor/maplibre-gl.css"><style>body{margin:0;font-family:system-ui;background:#dce7e3}.hidden{display:none}button{cursor:pointer}#map{height:100vh}.review{position:absolute;z-index:1;top:12px;left:12px;background:#fff;padding:8px 12px;border-radius:8px;font-size:11px}.review button{margin-left:8px}.review svg{width:20px;height:20px;vertical-align:middle}.review .abearc-map-rail-button span{display:inline} ${read('src/frontend/styles/map-weather.css')}</style></head><body><div id="map"></div>${stationDrawer}<div class="review">Weather UI review · cached station data<button onclick="openAbearcWeatherDashboard(1)">Dashboard</button><button onclick="document.documentElement.classList.toggle('dark')">Theme</button>${stationRail}<button onclick="weatherPreviewPhoto()">Test photo overlap</button></div>${read('src/frontend/modals/map-weather.modals.html')}<script src="/assets/vendor/maplibre-gl.js"></script><script>
const API='/api',currentUser={id:1},authToken='';let abearcMap=null;
const hasPrivilege=p=>!p.startsWith('manage_'),toast=(m)=>console.log(m),fetchJson=async(url,opts={})=>{const r=await fetch(url,opts);const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
function weatherPreviewPhoto(){const el=document.createElement('div');el.style.cssText='width:160px;height:170px;background:#ca9c6888;border:4px solid #a87046;z-index:40;display:grid;place-items:center';el.textContent='Test geotagged image';new maplibregl.Marker({element:el,anchor:'top'}).setLngLat([125.4355417,7.1927995]).addTo(abearcMap);}
${read('src/frontend/scripts/23-weather-units.js')}
${read('src/frontend/scripts/23-map-weather.js')}
${read('src/frontend/scripts/24-weather-experience.js')}
window.abearcMapLibreReady.then(()=>{abearcMap=new maplibregl.Map({container:'map',style:{version:8,sources:{base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'base'}]},center:[125.4355417,7.1927995],zoom:14});abearcMap.on('load',()=>{setupAbearcWeatherLayers();reloadAbearcWeatherStations();});});
openAbearcWeatherDashboard(1);
</script></body></html>`));
const port=Number(process.env.WEATHER_PREVIEW_PORT)||3012;
dbRun('CREATE TABLE IF NOT EXISTS WeatherForecastCache(station_id INTEGER PRIMARY KEY,cache_key TEXT,payload_json TEXT,retry_at TEXT)').then(()=>app.listen(port,'127.0.0.1',()=>console.log(`Weather review http://127.0.0.1:${port}`)));
