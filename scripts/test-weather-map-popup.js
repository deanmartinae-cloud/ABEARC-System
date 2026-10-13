'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/23-map-weather.js'), 'utf8');
const baseStation={
  latitude:7.0732,longitude:125.6128,elevation:152,timezone:'Asia/Manila',
  id:41, display_name:'LGU DAVAO CITY', health:{status:'online',label:'Online'},
  last_measurement_ts:Math.floor(Date.now()/1000)-420, rain_today_mm:0.5,
  current:[
    {normalized_key:'air_temperature',value:26.9,unit:'°C'},
    {normalized_key:'relative_humidity',value:85.9,unit:'%'},
    {normalized_key:'wind_speed',value:0.5,unit:'m/s'},
    {normalized_key:'wind_gust',value:1.1,unit:'m/s'},
    {normalized_key:'wind_direction',value:312.1,unit:'°'}
  ]
};
function fixture(station,permissions={}){
  const map={getContainer(){return {clientWidth:1000};},easeTo(options){this.camera=options;}};
  const elements={};
  let popup;
  const urls=[];
  const root={
    className:'',attributes:{},handlers:{},html:'',
    setAttribute(key,value){this.attributes[key]=value;},
    set innerHTML(value){this.html=value;}, get innerHTML(){return this.html;},
    querySelector(selector){const el=elements[selector]||={handlers:{},classList:{add(){},remove(){}},attributes:{},disabled:false,
      addEventListener(type,cb){this.handlers[type]=cb;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}};return el;}
  };
  class Popup {
    constructor(options){this.options=options;popup=this;}
    setLngLat(coordinates){this.coordinates=coordinates;return this;}
    setDOMContent(element){this.content=element;return this;}
    addTo(_map){return this;}
    remove(){this.removed=true;}
  }
  const ctx={
    localStorage:{getItem(){return null;}},Date,Math,Number,Array,Map,String,encodeURIComponent,
    window:{},document:{createElement(){return root;},addEventListener(){},getElementById(){return null;}},
    abearcMap:map, maplibregl:{Popup},weatherPopup:null,
    abearcWeatherStationsCache:[station],
    weatherStationCondition(){return {icon:'rain',label:'Estimated from station observations: rain recorded'};},
    weatherMapConditionTitle(){return 'Rain';},
    weatherStationConditionSymbol(){return '<svg class="wx-icon"></svg>';},
    weatherIcon(){return '<svg class="wx-icon"></svg>';},
    hasPrivilege(priv){return permissions[priv]!==false;},
    toast(){throw new Error('unexpected toast');},
    API:'/api',
    fetchJson:async()=>{throw new Error('offline');},
    abearcWeatherDownload(url,filename){urls.push([url,filename]);return Promise.resolve();}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/frontend/scripts/23-weather-units.js'),'utf8'),ctx);
  const mapSource=fs.readFileSync(path.join(__dirname,'../src/frontend/scripts/12-abearc-map.js'),'utf8');
  vm.runInContext(mapSource.slice(mapSource.indexOf('    function abearcMapScaleZoom('),mapSource.indexOf('    function openAbearcMapResultPhoto(')),ctx);
  vm.runInContext(source,ctx);
  const experience=fs.readFileSync(path.join(__dirname,'../src/frontend/scripts/24-weather-experience.js'),'utf8');
  vm.runInContext(experience.slice(experience.indexOf('function weatherChartTimeAxis('),experience.indexOf('function weatherChart(group,')),ctx);
  vm.runInContext(experience.slice(experience.indexOf('function weatherIcon('),experience.indexOf('function weatherCondition(')),ctx);
  vm.runInContext('abearcWeatherStationsCache = '+JSON.stringify([station])+';',ctx);
  ctx.abearcWeatherDownload=(url,filename)=>{urls.push([url,filename]);return Promise.resolve();};
  return {ctx,root,elements,urls,get popup(){return popup;}};
}
async function main(){
  const f=fixture(baseStation);
  f.ctx.openAbearcWeatherMapPopup(41,[125.43,7.19]);
  assert(f.popup && f.popup.options.maxWidth==='480px');
  assert.equal(f.popup.options.anchor,'center');
  assert.equal(f.ctx.abearcMap.camera.offset[0],-280);
  const camera=f.ctx.abearcMap.camera;
  const scaleMeters=40075016.686*Math.cos(camera.center[1]*Math.PI/180)*140/(512*2**camera.zoom);
  assert(Math.abs(scaleMeters-20.5)<0.001);
  assert.equal(camera.pitch,0);
  assert.equal(camera.bearing,0);
  assert.deepEqual(Array.from(f.ctx.abearcMap.camera.center),[125.43,7.19]);
  assert.match(f.root.html, /LGU DAVAO CITY/);
  assert.match(f.root.html,/Feels like [0-9.]+ °C<\/small>/);
  assert.match(f.root.html,/Computed heat index from station temperature and humidity/);
  assert.doesNotMatch(f.root.html,/\(est\.\)/);
  const heat=f.ctx.abearcWeatherHeatIndex;
  assert(Math.abs(heat(32.2222222222,70)-41.0677892)<0.001);
  assert(Math.abs(heat(25,50)-24.9305556)<0.001);
  assert(Math.abs(heat(26.6666666667,90)-30.1899398)<0.01);
  assert(Math.abs(heat(40,10)-36.7053059)<0.001);
  for(const inputs of [[null,70],[30,null],['',70],[30,101],[30,-1],[NaN,80],[15,80],[60,80]])assert.equal(heat(...inputs),null);
  assert.match(f.root.html, /26\.9/);
  assert.match(f.root.html, /0\.5/);
  assert.match(f.root.html, /85\.9/);
  assert.match(f.root.html, /312\.1/);
  assert.match(f.root.html, /OBSERVED -/);
  assert.match(f.root.html, /data-weather-popup-sync/);
  const deniedSync=fixture(baseStation,{manage_weather_stations:false});
  deniedSync.ctx.openAbearcWeatherMapPopup(41,[125.43,7.19]);
  assert.doesNotMatch(deniedSync.root.html,/data-weather-popup-sync/);
  const syncing=fixture(baseStation);
  syncing.ctx.openAbearcWeatherMapPopup(41,[125.43,7.19]);
  let syncCalls=0,refreshCalls=0;
  syncing.ctx.fetchJson=async(url,options)=>{if(!url.endsWith('/sync'))return {data:[]};syncCalls++;assert.equal(url,'/api/weather/stations/41/sync');assert.equal(options.method,'POST');assert.equal(syncing.elements['[data-weather-popup-sync]'].disabled,true);return {inserted:2};};
  syncing.ctx.reloadAbearcWeatherStations=async()=>{refreshCalls++;};
  syncing.popup.getElement=()=>({contains:root=>root===syncing.root});
  syncing.ctx.toast=message=>assert.match(message,/Weather sync complete: 2/);
  await syncing.elements['[data-weather-popup-sync]'].handlers.click();
  assert.equal(syncCalls,1);assert.equal(refreshCalls,1);
  assert.equal(syncing.elements['[data-weather-popup-sync]'].disabled,false);
  syncing.ctx.fetchJson=async()=>{throw new Error('offline');};
  syncing.ctx.toast=message=>assert.equal(message,'offline');
  await syncing.elements['[data-weather-popup-sync]'].handlers.click();
  assert.equal(syncing.elements['[data-weather-popup-sync]'].disabled,false);
  assert.equal(syncing.elements['[data-weather-popup-sync]'].attributes['aria-busy'],undefined);
  assert.match(f.root.html, /wx-snapshot-condition-icon/);
  assert.match(f.root.html, /wx-snapshot-condition-icon"><svg/);
  assert.doesNotMatch(f.root.html, /data-weather-popup-condition-image|data:image/);
  assert.match(f.root.html, /24-Hour Forecast/);
  assert.doesNotMatch(f.root.html, /↗|Open weather dashboard.*→/);
  assert.doesNotMatch(f.root.html, /data-weather-popup-settings|⚙\s+Settings/);
  assert.match(f.root.html, /data-weather-popup-rename/);
  assert.match(f.root.html, /wx-snapshot-thermometer/);
  assert.match(f.root.html, /Online<\/span><span aria-hidden="true">·/);
  assert.match(f.root.html, /data-weather-popup-dashboard/);
  assert.match(f.root.html, /data-weather-popup-pdf/);
  assert.match(f.root.html, /Download Farm Advisory/);
  assert.doesNotMatch(f.root.html, /Rain today: recorded samples since local midnight|Weather condition for this station location|Download Farm Advisory PDF/);
  assert.match(fs.readFileSync(path.join(__dirname,'../src/frontend/styles/map-weather.css'),'utf8'), /width:480px/);
  const pdf=f.elements['[data-weather-popup-pdf]'];
  await pdf.handlers.click();
  assert.equal(f.urls.length,1);
  assert.match(f.urls[0][0], /\/stations\/41\/report\.pdf\?include_forecast=1&first_page=1$/);
  assert.equal(f.urls[0][1], 'farm-weather-advisory-41.pdf');
  assert.equal(pdf.disabled,false);
  const changed=fixture({...baseStation,latitude:8.1234,longitude:124.5678,elevation:321,rain_today_mm:7.8,current:[
    {normalized_key:'air_temperature',value:31.2,unit:'°C'},
    {normalized_key:'relative_humidity',value:63.4,unit:'%'},
    {normalized_key:'wind_speed',value:2.7,unit:'m/s'},
    {normalized_key:'wind_gust',value:4.6,unit:'m/s'},
    {normalized_key:'wind_direction',value:180,unit:'°'},
    {normalized_key:'apparent_temperature',value:34.1,unit:'°C'}
  ]});
  changed.ctx.openAbearcWeatherMapPopup(41,[124.5678,8.1234]);
  assert.match(changed.root.html,/Feels like 34\.1 °C<\/small>/);
  for(const value of ['31.2','63.4','2.7','4.6','180.0','34.1','7.8','8.1234','124.5678','321'])assert(changed.root.html.includes(value),`Missing station value ${value}`);
  for(const value of ['26.9','85.9','312.1'])assert(!changed.root.html.includes(value),`Unexpected sample value ${value}`);
  const noDownload=fixture({...baseStation, current:[], rain_today_mm:null, last_measurement_ts:null}, {export_weather_data:false});
  noDownload.ctx.openAbearcWeatherMapPopup(41,[125.43,7.19]);
  assert.doesNotMatch(noDownload.root.html,/data-weather-popup-pdf/);
  assert.doesNotMatch(noDownload.root.html,/No recent synchronized observations/);
  assert.match(noDownload.root.html,/No measurements/);
  assert.match(noDownload.root.html,/class="wx-snapshot-metric-value">—/);
  f.ctx.weatherValue=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const chartNode={innerHTML:''},rainNode={textContent:''};
  const tabs=['precipitation','temperature_2m'].map(key=>({dataset:{weatherPopupTrend:key},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(_,handler){this.click=handler;}}));
  const trendRoot={querySelector(selector){return selector==='[data-weather-popup-chart]'?chartNode:rainNode;},querySelectorAll(){return tabs;}};
  const end=Math.floor(Date.now()/3600000)*3600;
  const requested=[];
  f.ctx.fetchJson=async url=>{requested.push(url);return {data:[]};};
  f.ctx.weatherObservedTimeline=()=>Array.from({length:24},(_,i)=>({timestamp:end-86400+i*3600,precipitation:0.5,temperature_2m:26}));
  await f.ctx.loadAbearcWeatherPopupTrend(trendRoot,baseStation);
  assert.equal(rainNode.textContent,'Last 24h: 12.0 mm');
  assert.equal(requested.length,1);
  assert.match(requested[0],/\/history\?/);
  assert(!requested.some(url=>url.endsWith('/forecast')));
  assert.match(chartNode.innerHTML,/24-hour observed/);
  assert.doesNotMatch(chartNode.innerHTML,/<circle/);
  assert.match(chartNode.innerHTML,/Cumulative/);
  assert.match(f.root.html, /class="wx-snapshot-since">Since midnight<\/span><\/strong>/);
  tabs[1].click();
  assert.match(chartNode.innerHTML,/Temperature/);
  assert.equal(tabs[0].attributes['aria-pressed'],'false');
  assert.equal(tabs[1].attributes['aria-pressed'],'true');
  f.ctx.fetchJson=async()=>{throw new Error('offline');};
  await f.ctx.loadAbearcWeatherPopupTrend(trendRoot,baseStation);
  assert.match(chartNode.innerHTML,/Station history is unavailable/);
  const hours=Array.from({length:24},(_,i)=>({timestamp:1700000000+i*3600,precipitation:0.5,temperature_2m:i-12}));
  const rain=f.ctx.abearcWeatherPopupChart(hours,'precipitation','Asia/Manila');
  assert.match(rain,/stroke="#0789fa"/);
  assert.match(rain,/wx-legend-bar/);assert.match(rain,/wx-legend-line/);
  assert.match(rain,/data-weather-date-boundary/);
  assert.doesNotMatch(rain,/<circle/);
  assert.equal((rain.match(/<rect /g)||[]).length,24);
  assert.match(rain,/data-weather-cumulative[^>]+stroke="#0789fa"/);
  assert.equal((rain.match(/data-weather-time-tick/g)||[]).length,7);
  const gap=f.ctx.abearcWeatherPopupChart(hours.map((r,i)=>({...r,precipitation:i===2?null:r.precipitation})),'precipitation','Asia/Manila');
  assert.doesNotMatch(gap,/<circle/);
  const cumulative=gap.match(/data-weather-cumulative d="([^"]*)"/)[1];
  assert.equal((cumulative.match(/L/g)||[]).length,1);
  assert.match(gap,/cumulative rain stops at the first gap/);
  assert.match(f.ctx.abearcWeatherPopupChart(hours.map(r=>({...r,precipitation:null})),'precipitation','Asia/Manila'),/No measurements/);
  assert.doesNotMatch(f.ctx.abearcWeatherPopupChart(hours,'temperature_2m','Asia/Manila'),/NaN|Cumulative/);
  if (process.env.WEATHER_POPUP_PREVIEW_HTML) {
    const css=fs.readFileSync(path.join(__dirname,'../src/frontend/styles/map-weather.css'),'utf8');
    fs.writeFileSync(process.env.WEATHER_POPUP_PREVIEW_HTML, `<!doctype html><html><meta charset="utf-8"><style>:root{--wx-card:#fff;--wx-ink:#173c42;--wx-muted:#64748b;--wx-accent:#187b70;--wx-line:#dfe7ed}body{font-family:Arial;background:#394845;margin:0;}#mapPage{position:relative;height:100vh;}#mapPage .wx-station-map-popup{position:absolute;margin:auto;width:480px}.maplibregl-popup-close-button{position:absolute;border:none;background:none;right:0;top:0}.wx-map-popup{position:relative}.maplibregl-popup-content{padding:0} ${css}</style><div id="mapPage"><div class="maplibregl-popup wx-map-popup wx-station-map-popup"><div class="maplibregl-popup-content"><button class="maplibregl-popup-close-button">×</button><section class="abearc-weather-popup wx-station-snapshot">${f.root.html.replace('<p class="wx-snapshot-empty">Loading station history…</p>',rain)}</section></div></div></div></html>`);
  }
  console.log('Weather station popup checks passed: map condition icon, observed metrics, PDF action, permission gate, empty readings and responsive popup container.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
