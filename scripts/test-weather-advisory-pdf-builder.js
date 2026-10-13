const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const text=fs.readFileSync(path.join(ROOT,'src/backend/controllers/21-weather.controller.js'),'utf8');
const start=text.indexOf('const weatherPdfText = '),end=text.indexOf('const __routeController509 = ',start);
assert(start>=0&&end>start);
const service=fs.readFileSync(path.join(ROOT,'src/backend/services/22-weather-advisory.service.js'),'utf8');
const collected={texts:[],images:0,pages:0};
const fakePage={drawText(v){collected.texts.push(v);},drawRectangle(){},drawLine(){},drawCircle(){},drawSvgPath(){},drawPage(){},drawImage(){collected.images++;}};
const pdf={
  embedFont:async()=>({widthOfTextAtSize:(t,size)=>t.length*size*.49}),
  embedJpg:async data=>{assert(data.length>0);return {dummy:true};},
  embedPng:async data=>{assert(data.length>0);return {dummy:true};},
  embedPage:async()=>({width:195,height:153}),getPageCount:()=>collected.pages,removePage(){collected.pages--;},
  addPage(){collected.pages++;return fakePage;},getPages(){return Array.from({length:collected.pages},()=>fakePage);},
  setTitle(v){collected.title=v;},setAuthor(){},save:async()=>Buffer.from('%PDF simulated only; structure test')
};
const create=()=>pdf, finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const build=new Function('PDFDocument','StandardFonts','rgb','weatherFinite','weatherStationHealth','fs','path','__dirname',
  service+'\n'+text.slice(start,end)+'\nreturn weatherBuildPdfReport;')(
  {create},{Helvetica:'Helvetica',HelveticaBold:'HelveticaBold'},()=>({}),finite,()=>({label:'Connected'}),fs,path,ROOT);
(async()=>{
 const daily=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,rainfall_mm:i?3:32,temperature_max_c:i?31:36,temperature_min_c:24,temperature_avg_c:28,relative_humidity_avg_pct:82,et0_mm:4,gdd:11}));
 const forecast={stale:false,model:'Test only',fetched_at:'2026-10-08T06:00:00Z',daily:[{timestamp:1791427200,precipitation_sum:24,wind_gusts_10m_max:16,temperature_2m_min:24,temperature_2m_max:32,precipitation_probability_max:75,wind_speed_10m_max:8}],hourly:[]};
 const bytes=await build({station:{id:1,display_name:'Fixture Crop Station',timezone:'Asia/Manila',provider_device_id:'fixture-1',latitude:7.2,longitude:125.6,elevation:230},start:1790812800,end:1791417600,summary:{daily_agriculture:daily,data_days:7,stats:{},et0_total_mm:28},forecast,forecastRequested:true,current:{readings:[{normalized_key:'air_temperature',unit:'C',value:31.7,quality_status:'valid'},{normalized_key:'relative_humidity',unit:'%',value:73.2,quality_status:'valid'},{normalized_key:'wind_gust',unit:'m/s',value:99,quality_status:'invalid'}]},rainToday:9.2});
 assert(bytes.length>0);
 assert(collected.texts.includes('31.7 °C'));
 assert(collected.texts.includes('73.2 %'));
 assert(collected.texts.includes('9.2 mm'));
 assert(!collected.texts.includes('99.0 m/s'));
 assert(!collected.texts.includes('26.9 C'));
 assert(collected.texts.includes('Rain recorded today'));
 assert(!collected.texts.join(' ').match(/livestock|poultry|cattle/i));
 assert.equal(collected.title,'Fixture Crop Station - Farm Weather Advisory');
 assert(collected.pages>=2,'Multi-page weather report with charts must have multiple pages');
 assert(collected.images>=4,'The two official seals should render on pages');
 for(const token of ['Priority crop-weather advisories',"TODAY'S WEATHER CONDITION"]) {
   assert(collected.texts.some(v=>v.includes(token)),`PDF is missing '${token}'`);
 }
 const conditionOptions={station:{id:1,display_name:'Rain condition fixture',timezone:'Asia/Manila'},start:1790812800,end:1791417600,summary:{daily_agriculture:[],stats:{}},firstPageOnly:true};
 for(const [rainToday,intervalRain,label] of [[.1,0,'Rain recorded today'],[0,0,'No rain recorded today'],[null,.1,'Condition unavailable']]){
   collected.texts=[];
   await build({...conditionOptions,rainToday,current:{readings:[{normalized_key:'precipitation',unit:'mm',value:intervalRain,quality_status:'valid'}]}});
   assert(collected.texts.includes(label),`Rain label must use the daily total: ${rainToday}`);
   if(rainToday>0)assert(!collected.texts.some(v=>v.includes('No rain recorded')));
 }
 console.log('Weather advisory PDF-builder smoke passed: measured indicator tiles, crop rules, observed/forecast distinction and multi-page report.');
})().catch(e=>{console.error(e);process.exitCode=1;});
