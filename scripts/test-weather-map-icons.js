'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,Path2D}=require('@napi-rs/canvas');
const {DOMParser}=require('@xmldom/xmldom');
const read=p=>fs.readFileSync(p,'utf8');
const noon=Date.parse('2026-10-08T04:00:00Z')/1000;
let now=noon;
class Clock extends Date {static now(){return now*1000;}}
const ctx=vm.createContext({Date:Clock,DOMParser,Path2D,console,window:{},localStorage:{getItem:()=>null},document:{addEventListener(){},createElement:()=>createCanvas(72,72)},abearcWeatherNum:(n)=>Number(n).toFixed(1)});
vm.runInContext(read('src/frontend/scripts/23-weather-units.js'),ctx);
vm.runInContext(read('src/frontend/scripts/24-weather-experience.js'),ctx);
const map=read('src/frontend/scripts/23-map-weather.js');
vm.runInContext(map.slice(map.indexOf('const abearcWeatherMapKinds='),map.indexOf('function setupAbearcWeatherLayers('))+'\nthis.kinds=abearcWeatherMapKinds;',ctx);
const site={latitude:7.19,longitude:125.43,logging_interval_minutes:15};
const reading=(normalized_key,value,unit,extra={})=>({normalized_key,value,unit,timestamp_utc:now,quality_status:'valid',...extra});
const condition=(current,extra={})=>ctx.weatherStationCondition({...site,last_measurement_ts:now,current,...extra});
const solar=ctx.weatherClearSky(noon,site).ghi;
for(const [ratio,icon] of [[1,'sun'],[.6,'partly'],[.2,'cloud']])assert.equal(condition([reading('solar_radiation',solar*ratio,'W/m²')]).icon,icon);
for(const [rate,icon] of [[.1,'light-rain'],[2.5,'light-rain'],[2.51,'rain'],[7.5,'rain'],[7.51,'heavy-rain'],[25,'heavy-rain']])assert.equal(condition([reading('rain_rate',rate,'mm/hr')]).icon,icon);
assert.equal(condition([reading('precipitation',.5,'mm')]).icon,'light-rain');
assert.equal(condition([reading('precipitation',2,'mm')]).icon,'heavy-rain');
assert.equal(condition([reading('precipitation',2,'mm')],{logging_interval_minutes:null}).icon,'rain');
assert.equal(condition([reading('precipitation',100,'mm',{measurement:'Daily rainfall total'})]).icon,'unknown');
assert.equal(condition([reading('rain_rate',1,'mm/h'),reading('precipitation',3,'mm')]).icon,'light-rain');
assert.equal(condition([reading('rain_rate',10,'mm/h'),reading('lightning_count',1,'count')]).icon,'storm');
for(const extra of [{quality_status:'invalid'},{timestamp_utc:now-7200},{timestamp_utc:now+1000},{measurement:'Max Precip Rate'}])assert.equal(condition([reading('rain_rate',20,'mm/h',extra)]).icon,'unknown');
for(const [key,unit] of [['rain_rate','mm'],['cloud_cover','oktas'],['solar_radiation','kW/m²']])assert.equal(condition([reading(key,1,unit)]).icon,'unknown');
assert.equal(condition([reading('rain_rate',1,'mm/h'),reading('rain_rate',20,'mm/h',{timestamp_utc:now-600})]).icon,'light-rain');
assert.equal(condition([reading('rain_rate',-2,'mm/h')]).icon,'unknown');
now=noon+43200;
assert.equal(condition([reading('solar_radiation',0,'W/m²')]).icon,'unknown');
for(const [cover,icon] of [[0,'night-clear'],[50,'night-partly'],[100,'cloud']])assert.equal(condition([reading('cloud_cover',cover,'%')]).icon,icon);
assert.equal(condition([reading('cloud_cover',101,'%')]).icon,'unknown');
assert.equal(condition([reading('cloud_cover',0,'%'),reading('precipitation',3,'mm')]).icon,'heavy-rain');
assert.equal(condition([reading('cloud_cover',0,'%',{timestamp_utc:now-7200})]).icon,'unknown');
const forecast=cloud=>({fetched_at:new Date(now*1000).toISOString(),stale:false,hourly:[{timestamp:now,cloud_cover:cloud,weather_code:0}]});
for(const [cloud,icon] of [[0,'night-clear'],[50,'night-partly'],[100,'cloud']]){
  const result=condition([],{night_forecast:forecast(cloud)});assert.equal(result.icon,icon);assert.equal(result.source,'forecast');assert(!/forecast|fallback|Open-Meteo/i.test(result.label));
}
assert.equal(condition([reading('cloud_cover',50,'%')],{night_forecast:forecast(0)}).icon,'night-partly');
assert.equal(condition([reading('rain_rate',8,'mm/h')],{night_forecast:forecast(0)}).icon,'heavy-rain');
for(const extra of [{stale:true},{fetched_at:new Date((now-7200)*1000).toISOString()},{fetched_at:'bad'},{hourly:[{timestamp:now-7200,cloud_cover:0}]}])assert.equal(condition([],{night_forecast:{...forecast(0),...extra}}).icon,'unknown');
const rainy={...forecast(90),hourly:[{timestamp:now,weather_code:65,cloud_cover:90}]};
assert.equal(condition([],{night_forecast:rainy}).icon,'heavy-rain');
assert.equal(condition([reading('precipitation',0,'mm')],{night_forecast:rainy}).icon,'cloud');
now=noon;assert.equal(condition([],{night_forecast:forecast(0)}).icon,'unknown');now=noon+43200;
const list={innerHTML:''};ctx.document.querySelectorAll=()=>[list];ctx.abearcWeatherStationsCache=[{...site,id:1,display_name:'Test station',current:[],night_forecast:forecast(0)}];ctx.abearcWeatherEsc=v=>String(v);ctx.abearcWeatherAgo=()=>'';ctx.renderWeatherStationList();assert.match(list.innerHTML,/<svg/);assert.doesNotMatch(list.innerHTML,/<img|wx-drawer-pin|data:image/);
assert.equal(ctx.weatherStationConditionSymbol('night-partly'),ctx.weatherConditionSymbol({weather_code:2,is_day:0}));
const backend=vm.createContext({});vm.runInContext(read('src/backend/services/21-weather-analytics.service.js')+'\nthis.classify=weatherClassifyMeasurement;',backend);
assert.equal(backend.classify({measurement:'Cloud cover',unit:'%'}).normalizedKey,'cloud_cover');
assert.equal(backend.classify({measurement:'Rain rate',unit:'mm/hr'}).normalizedKey,'rain_rate');
assert.equal(ctx.kinds.length,10);assert(!ctx.kinds.some(k=>/snow|sleet/.test(k)));
const hashes=new Set();for(const kind of ctx.kinds){const data=ctx.abearcWeatherMapImage(kind);assert.equal(data.width,72);assert.equal(data.height,72);hashes.add(require('node:crypto').createHash('sha256').update(data.data).digest('hex'));}assert.equal(hashes.size,8);
assert.deepEqual(ctx.abearcWeatherMapImage('light-rain').data,ctx.abearcWeatherMapImage('rain').data);
if(process.env.WEATHER_ICONS_PREVIEW){
  const labels={'sun':'Sunny','partly':'Partly cloudy','cloud':'Cloudy / overcast','light-rain':'Light rain','rain':'Rain','heavy-rain':'Heavy rain','night-clear':'Clear night','night-partly':'Partly cloudy night','storm':'Thunderstorm','unknown':'Unknown'};
  const canvas=createCanvas(1000,480),x=canvas.getContext('2d');x.fillStyle='#f4f7f6';x.fillRect(0,0,1000,480);x.fillStyle='#183c3d';x.font='bold 24px sans-serif';x.fillText('Weather station map icons',28,38);x.font='14px sans-serif';x.fillStyle='#657879';x.fillText('Forecast Conditions symbols · existing pin border · station-driven conditions',28,64);
  ctx.kinds.forEach((kind,i)=>{const icon=createCanvas(72,72);icon.getContext('2d').putImageData(ctx.abearcWeatherMapImage(kind),0,0);const cx=100+i%5*200,top=94+Math.floor(i/5)*180;x.drawImage(icon,cx-54,top,108,108);x.fillStyle='#183c3d';x.textAlign='center';x.font='bold 15px sans-serif';x.fillText(labels[kind],cx,top+136);});
  fs.writeFileSync(process.env.WEATHER_ICONS_PREVIEW,canvas.toBuffer('image/png'));
}
console.log('Weather icons passed: 10 conditions using shared forecast symbols; sensor quality, freshness, units, rain intensity, lightning priority and measured nighttime cloud cover.');

(async()=>{
  const station={...site,id:42,last_measurement_ts:now,current:[]};
  const observed={...site,id:43,last_measurement_ts:now,current:[reading('rain_rate',8,'mm/h')]};
  let calls=0,updates=0;ctx.API='/api';ctx.abearcWeatherStationsCache=[station,observed];ctx.fetchJson=async url=>{assert.equal(url,'/api/weather/stations/42/forecast');calls++;return forecast(0);};ctx.renderAbearcWeatherMapSource=()=>updates++;ctx.renderWeatherStationList=()=>{};ctx.document.querySelector=()=>null;
  await ctx.loadWeatherMapNightForecasts([station,observed]);assert.equal(calls,1);assert.equal(updates,1);assert.equal(ctx.weatherStationCondition(station).icon,'night-clear');
  delete station.night_forecast;ctx.fetchJson=async()=>{throw new Error('offline');};await ctx.loadWeatherMapNightForecasts([station]);assert.equal(ctx.weatherStationCondition(station).icon,'unknown');
  console.log('Nighttime external data passed: station priority, fresh hourly data, no fallback label, failure recovery and map refresh.');
})().catch(error=>{console.error(error);process.exitCode=1;});
