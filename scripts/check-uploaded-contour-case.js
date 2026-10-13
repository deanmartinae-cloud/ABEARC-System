const fs=require('fs'), vm=require('vm'), path=require('path');
const root=path.resolve(__dirname,'..');
const gravity=fs.readFileSync(path.join(root,'src/frontend/scripts/19-map-gravity-path.js'),'utf8');
function parseDistance(file){
 const t=fs.readFileSync(file,'utf8');
 const m=t.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i);
 return m[1].trim().split(/\s+/).map(v=>v.split(',').slice(0,2).map(Number));
}
function parseContours(file){
 const t=fs.readFileSync(file,'utf8'); const out=[];
 for(const pm of t.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/gi)){
   const b=pm[1]; const lm=b.match(/<Data name="elevation_m"><value>([-\d.]+)<\/value>/i); const cm=b.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i);
   if(!lm||!cm) continue;
   out.push({level:Number(lm[1]),points:cm[1].trim().split(/\s+/).map(v=>v.split(',').slice(0,2).map(Number))});
 }
 return out;
}
const endpoints=parseDistance('/mnt/data/ABEARC-distance-measurement-2026-09-22.kml');
const paths=parseContours('/mnt/data/ABEARC-contours-2026-09-22.kml');
const context={console,window:{},document:{},Date,Math,Number,String,Array,Set,Map,Float64Array,Int32Array,Uint8Array}; vm.createContext(context);
vm.runInContext(`
let abearcMapMeasurePoints=[]; let abearcMapMeasureMode='distance'; let abearcMapImportedPolygons=[]; let abearcMapElevationSource='opentopo-srtm30';
const ABEARC_MAP_DEFAULT_ELEVATION_SOURCE='opentopo-srtm30';
const ABEARC_MAP_ELEVATION_SOURCES=new Set(['opentopo-srtm30']);
const ABEARC_MAP_ELEVATION_RESOLUTION_M={'opentopo-srtm30':30};
function haversineMetres(a,b){ const R=6371000,toRad=x=>x*Math.PI/180; const p1=toRad(a[1]),p2=toRad(b[1]),dp=toRad(b[1]-a[1]),dl=toRad(b[0]-a[0]); const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
const esc=v=>String(v); const formatAbearcDistance=v=>v+' m'; const toast=()=>{}; const toggleLoad=()=>{}; const closeAbearcMapMeasureContextMenu=()=>{};
${gravity}
`,context);
context.paths=paths; context.endpoints=endpoints;
const result=vm.runInContext(`abearcGravityRouteContourPaths(endpoints[0],endpoints[1],1074,990,paths,{sourceKey:'opentopo-srtm30',sourceLabel:'Open Topo Data SRTM Radar DEM',sourceResolutionM:30,effectiveSpacingM:30,intervalM:10})`,context);
if(!result?.indexes?.length){console.error('FAIL exact uploaded KML case');process.exit(1)}
const ev=Array.from(result.elevations); for(let i=1;i<ev.length;i++){if(ev[i]>ev[i-1]+0.1){console.error('ASCENT',i,ev[i-1],ev[i]);process.exit(1)}}
let dist=0; for(let i=1;i<result.indexes.length;i++){const a=result.plan.locations[result.indexes[i-1]],b=result.plan.locations[result.indexes[i]];dist+=context.haversineMetres([a.longitude,a.latitude],[b.longitude,b.latitude])}
console.log(`Uploaded KML case passed: ${result.indexes.length} route vertices, ${dist.toFixed(1)} m, levels ${[...new Set(ev)].join(' -> ')}`);
