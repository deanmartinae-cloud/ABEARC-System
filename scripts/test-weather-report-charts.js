const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx=vm.createContext({console,window:{},localStorage:{getItem:()=>null},document:{addEventListener:()=>{}},abearcWeatherStationDetail:{station:{timezone:'Asia/Manila'}},abearcWeatherEsc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;'),abearcWeatherNum:(n,d=1)=>n==null?'—':Number(n).toFixed(d),abearcWeatherLabel:(_,s)=>s});
vm.runInContext(read('src/frontend/scripts/23-weather-units.js'),ctx);
vm.runInContext(read('src/frontend/scripts/24-weather-experience.js')+'\nthis.chartWindow=weatherChartWindow;this.chart=weatherChart;this.combined=weatherCombinedChart;this.grid=weatherForecastGrid;',ctx);
const localMidnight=Date.parse('2026-10-08T16:00:00Z')/1000;
const axis=ctx.weatherChartTimeAxis([localMidnight-3600,localMidnight,localMidnight+3600],ts=>ts-localMidnight,{zone:'Asia/Manila'});
assert.equal((axis.match(/data-weather-date-boundary/g)||[]).length,1);
assert.match(axis,/12:00 AM/);assert.match(axis,/Oct 9/);assert.match(axis,/Oct 8/);
const centeredAxis=ctx.weatherChartTimeAxis([localMidnight-3600,localMidnight,localMidnight+3600],ts=>ts-localMidnight,{zone:'Asia/Manila',centerDates:true});
assert.equal((centeredAxis.match(/Oct 8/g)||[]).length,1);assert.equal((centeredAxis.match(/Oct 9/g)||[]).length,1);
assert.match(centeredAxis,/data-weather-date-label x="-1800"/);assert.match(centeredAxis,/data-weather-date-label x="1800"/);
assert.equal((centeredAxis.match(/data-weather-time-tick/g)||[]).length,3);
const points=Array.from({length:25},(_,i)=>({x:i*3600,y:i,min:null,max:null,label:`Hour ${i}`}));
let range=ctx.chartWindow(points,0,86400,.5);assert.equal(range.end-range.start,43200);
let pan=ctx.chartWindow(points,range.start,range.end,1,1);assert.equal(pan.end,86400);assert.equal(pan.end-pan.start,43200);
const chart=ctx.chart({series:{measurement:'Temperature',unit:'C'},points},{start:range.start,end:range.end});
assert.equal((chart.match(/<circle /g)||[]).length,13);
assert.equal((chart.match(/data-weather-time-tick/g)||[]).length,7);
assert.match(chart,/data-weather-date-label/);
assert.doesNotMatch(chart,/<tspan[^>]+dy="15"/);assert.ok(!chart.includes('data-detail-width'));
const rainfallChart=ctx.chart({series:{normalized_key:'precipitation',measurement:'Rainfall',unit:'mm'},points:points.map(p=>({...p,y:1}))});
assert.equal((rainfallChart.match(/<rect /g)||[]).length,25);assert.match(rainfallChart,/data-weather-chart-point/);
const solarChart=ctx.chart({series:{normalized_key:'solar_radiation',measurement:'Solar radiation',unit:'W\/m²'},area:true,points:points.map(p=>({...p,y:p.x/3600}))});
assert.match(solarChart,/fill="#[0-9a-f]+" opacity="\.14"/);assert.match(solarChart,/Solar radiation/);
const combined=ctx.combined([
  {series:{normalized_key:'air_temperature',measurement:'Air temperature',unit:'°C'},points:points.map(p=>({...p,y:24+p.x/24}))},
  {series:{normalized_key:'precipitation',measurement:'Rainfall',unit:'mm'},points:points.map((p,i)=>({...p,y:i%3===0?1:0}))},
  {series:{normalized_key:'solar_radiation',measurement:'Solar radiation',unit:'W\/m²'},points:points.map(p=>({...p,y:p.x*10}))}
]);
assert.equal((combined.match(/<svg /g)||[]).length,1);assert.match(combined,/wx-combined-legend/);assert.match(combined,/<rect /);assert.match(combined,/Solar radiation/);
assert.equal((combined.match(/<rect /g)||[]).length,9);
assert.doesNotMatch(combined,/stroke="#c38c20"/);
assert.match(combined,/>1\.1<\/text>/);assert.match(combined,/>mm<\/text>/);
assert.match(combined,/<text x="49"[^>]+fill="#d97745"/);assert.match(combined,/<text x="49" y="18" text-anchor="end"[^>]*>°C<\/text>/);
assert.equal(ctx.chartWindow(points,0,86400,2).end,86400);
vm.runInContext('weatherTimelineStep=1;',ctx);
const html=ctx.grid([{timestamp:0,temperature_2m:0,precipitation:null,wind_direction_10m:0}]);assert.match(html,/Rain \/ 1h/);assert.match(html,/rotate\(180deg\)/);assert.match(html,/—/);
const timeline=ctx.grid([{timestamp:Date.parse('2026-10-07T15:00:00Z')/1000,observed:true,precipitation:0},{timestamp:Date.parse('2026-10-07T16:00:00Z')/1000,observed:false,precipitation:1,is_day:0}]);assert.match(timeline,/wx-night/);assert.match(timeline,/wx-day-start/);assert.match(timeline,/wx-forecast-start/);assert.match(timeline,/wx-forecast-boundary/);assert.match(timeline,/wx-forecast-boundary-observed/);assert.match(timeline,/wx-forecast-boundary-forecast/);assert.match(timeline,/>Observed</);assert.match(timeline,/>Forecast</);assert.match(timeline,/>AWS</);assert.match(timeline,/>FCST</);
assert.equal(ctx.weatherBucketTimestamp('2026-10-08T00:00'),Date.parse('2026-10-07T16:00:00Z')/1000);
const site={latitude:7.19,longitude:125.43},noon=Date.parse('2026-10-08T04:00:00Z')/1000,sky=ctx.weatherClearSky(noon,site);
assert.ok(sky.ghi>900&&sky.ghi<1100);
for(const [ratio,icon] of [[1,'sun'],[.6,'partly'],[.2,'cloud']])assert.equal(ctx.weatherObservedCondition({timestamp:noon,shortwave_radiation:sky.ghi*ratio},site).icon,icon);
assert.equal(ctx.weatherObservedCondition({timestamp:noon,precipitation:.2,shortwave_radiation:sky.ghi},site).icon,'rain');
assert.equal(ctx.weatherObservedCondition({timestamp:noon,precipitation:.2,lightning_count:1,lightning_distance:5},site).icon,'storm');
assert.equal(ctx.weatherObservedCondition({timestamp:noon,shortwave_radiation:null},site).icon,'unknown');
assert.equal(ctx.weatherObservedCondition({timestamp:noon+43200,shortwave_radiation:0},site).icon,'unknown');
const unknownNight={timestamp:noon+43200,precipitation:0,shortwave_radiation:0};
const externalNight={timestamp:noon+43200,weather_code:0,is_day:0,cloud_cover:0};
assert.equal(ctx.weatherTimelineCondition(unknownNight,externalNight).weather_code,0);
assert.equal(ctx.weatherTimelineCondition({...unknownNight,precipitation:1},externalNight).icon,'rain');
assert.equal(ctx.weatherTimelineCondition({...unknownNight,lightning_count:1},externalNight).icon,'storm');
assert.equal(ctx.weatherTimelineCondition(unknownNight,null).icon,'unknown');
assert.equal(ctx.weatherTimelineCondition(unknownNight,{weather_code:71}).icon,'unknown');
assert.equal(ctx.weatherTimelineCondition(unknownNight,{weather_code:65,cloud_cover:100,is_day:0}).weather_code,3);
vm.runInContext('abearcWeatherForecast='+JSON.stringify({hourly:[externalNight]})+';',ctx);
assert.doesNotMatch(ctx.grid([{...unknownNight,observed:true}]),/<sup>\?<\/sup>/);
assert.match(ctx.grid([{...unknownNight,timestamp:noon+39600,observed:true}]),/<sup>\?<\/sup>/);
vm.runInContext('weatherTimelineStep=3;',ctx);
assert.doesNotMatch(ctx.grid([{...unknownNight,observed:true}]),/<sup>\?<\/sup>/);
vm.runInContext('weatherTimelineStep=1;abearcWeatherForecast=null;',ctx);
const old=Date.now()/1000-7200;assert.equal(ctx.weatherStationCondition({...site,current:[{normalized_key:'solar_radiation',unit:'W/m²',value:1000,timestamp_utc:old}]}).icon,'unknown');
assert.match(read('src/frontend/scripts/23-map-weather.js'),/\['value','min','avg','max','sum'\].includes\(c\)\?abearcWeatherNum\(r\[c\],weatherQuantityDigits\(r\.unit,1\)\)/);
const measured=ctx.weatherObservedTimeline({aggregation:'hourly',series:[{id:1,normalized_key:'precipitation',unit:'mm',port_num:1},{id:2,normalized_key:'precipitation',unit:'mm',port_num:2}],data:[{series_id:1,bucket:'2026-10-08T00:00',value:0},{series_id:2,bucket:'2026-10-08T00:00',value:5}]});assert.equal(measured.length,1);assert.equal(measured[0].precipitation,0);
let flight,popup;ctx.abearcWeatherStationsCache=[{id:1,latitude:7.19,longitude:125.43}];ctx.abearcMap={getZoom:()=>10,flyTo:v=>flight=v};ctx.setAbearcWeatherStationsVisible=()=>{};ctx.toggleWeatherStationsDrawer=()=>{};ctx.openAbearcWeatherMapPopup=(id,coords)=>popup={id,coords};ctx.focusWeatherStation(1);assert.equal(flight,undefined);assert.equal(popup.coords[0],125.43);assert.equal(popup.id,1);
const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const pdfLib=require('pdf-lib');const backend=new Function('fs','path','__dirname','PDFDocument','StandardFonts','rgb','weatherFinite','WEATHER_DEFAULT_TIMEZONE','weatherStationHealth',read('src/backend/services/22-weather-advisory.service.js')+'\n'+read('src/backend/controllers/21-weather.controller.js')+'\nreturn {buildReport:weatherBuildPdfReport};')(fs,path,root,pdfLib.PDFDocument,pdfLib.StandardFonts,pdfLib.rgb,finite,'Asia/Manila',()=>({label:'Online'}));
(async()=>{
  const analytics=vm.createContext({console,WEATHER_DEFAULT_TIMEZONE:'Asia/Manila',WEATHER_MAX_HISTORY_ROWS:1000,dbAll:async()=>[
    {timestamp_utc:1791421200,normalized_key:'relative_humidity',measurement:'Relative Humidity',value:85,unit:'%',port_num:1,quality_status:'valid'},
    {timestamp_utc:1791421200,normalized_key:'relative_humidity',measurement:'RH Sensor Temp',value:27,unit:'C',port_num:1,quality_status:'valid'}
  ]});
  vm.runInContext(read('src/backend/services/21-weather-analytics.service.js')+'\nthis.classify=weatherClassifyMeasurement;this.agriculture=weatherDailyAgriculture;',analytics);
  assert.equal(analytics.classify({measurement:'RH Sensor Temp',unit:'C'}).normalizedKey,'sensor_temperature');
  assert.equal(analytics.classify({measurement:'Lightning Activity'}).normalizedKey,'lightning_count');
  const days=await analytics.agriculture({station:{id:1,timezone:'Asia/Manila'},startTs:1791400000,endTs:1791500000});assert.equal(days[0].relative_humidity_avg_pct,85);
  const now=Math.floor(Date.now()/3600000)*3600,station={display_name:'Report verification station',provider_device_id:'test',latitude:7.19,longitude:125.43,timezone:'Asia/Manila'},summary={stats:{temperature:[{measurement:'Air temperature',unit:'C',min:23,avg:28,max:34}]},daily_agriculture:[],et0_total_mm:null,data_days:0};
  const forecast={model:'Best Match',fetched_at:new Date().toISOString(),stale:true,warning:'Last successful forecast',daily:[{timestamp:now,temperature_2m_min:23,temperature_2m_max:32,precipitation_sum:0}],hourly:[{timestamp:now,temperature_2m:28,precipitation:null}]};
  for(const options of [{},{forecastRequested:true,forecast},{forecastRequested:true,forecastError:'Forecast unavailable'}]){const bytes=await backend.buildReport({station,start:now-86400,end:now,summary,...options});const doc=await pdfLib.PDFDocument.load(bytes);assert.ok(doc.getPageCount()>=2);}
  const firstPage=await backend.buildReport({station,start:now-86400,end:now,summary,firstPageOnly:true});assert.equal((await pdfLib.PDFDocument.load(firstPage)).getPageCount(),1);
  if(process.argv.includes('--live')){
    const response=await fetch('http://127.0.0.1:3013/api/weather/stations/1/report.pdf?start_date=2026-10-01&end_date=2026-10-08&include_forecast=1');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/pdf/);
    const bytes=Buffer.from(await response.arrayBuffer());fs.mkdirSync(path.join(root,'output/pdf'),{recursive:true});fs.writeFileSync(path.join(root,'output/pdf/abearc-weather-report.pdf'),bytes);console.log(`Live report generated: ${(await pdfLib.PDFDocument.load(bytes)).getPageCount()} pages.`);
  }
  console.log('Weather report/chart checks passed: time-window zoom, pan bounds, grid nulls/direction, PDF observations, stale forecast and unavailable forecast.');
})().catch(e=>{console.error(e);process.exitCode=1;});
