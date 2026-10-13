let abearcWeatherStationsVisible = localStorage.getItem('abearcWeatherStationsVisible') !== 'false';
let abearcWeatherStationsCache = [];
let abearcWeatherMapEventsBound = false;
let abearcWeatherSelectedStationId = null;
let abearcWeatherStationDetail = null;
let abearcWeatherCurrent = null;
let abearcWeatherHistory = null;
let abearcWeatherAgriculture = null;
let abearcWeatherTablePage = 0;
let abearcWeatherTableSort = { key: 'period', direction: 1 };
let abearcWeatherExactRange = null;
const ABEARC_WEATHER_TABLE_PAGE_SIZE = 100;

const abearcWeatherMetricLabels = {
  air_temperature:'Air Temperature',relative_humidity:'Relative Humidity',precipitation:'Rainfall',rain_rate:'Rain Intensity',wind_speed:'Wind Speed',wind_gust:'Wind Gust',wind_direction:'Wind Direction',solar_radiation:'Solar Radiation',atmospheric_pressure:'Atmospheric Pressure',vapor_pressure:'Vapor Pressure',lightning_count:'Lightning Strikes',lightning_distance:'Lightning Distance',soil_temperature:'Soil Temperature',soil_water_content:'Soil Moisture',soil_ec:'Soil EC',soil_matric_potential:'Soil Matric Potential',leaf_wetness:'Leaf Wetness',battery_percent:'Battery',battery_voltage:'Battery Voltage',signal_strength:'Signal Strength',reference_et:'Reference ET',actual_et:'Evapotranspiration',dew_point:'Dew Point'
};
const abearcWeatherPriority = ['air_temperature','relative_humidity','precipitation','wind_speed','wind_gust','wind_direction','solar_radiation','atmospheric_pressure','soil_water_content','soil_temperature'];
const abearcWeatherLabel = (key, fallback='') => abearcWeatherMetricLabels[key] || fallback || String(key||'').replace(/^other_/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const abearcWeatherNum = (value, digits=1) => value===null||value===undefined||value===''?'—':(Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined,{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—');
const abearcWeatherCompass = value => {const n=Number(value);if(!Number.isFinite(n))return '';const dirs=['N','NE','E','SE','S','SW','W','NW'];return dirs[Math.round(((n%360)+360)%360/45)%8];};
const abearcWeatherDate = ts => Number.isFinite(Number(ts)) ? new Date(Number(ts)*1000).toLocaleString() : '—';
const abearcWeatherAgo = ts => { const sec=Math.max(0,Date.now()/1000-Number(ts||0)); if(!Number.isFinite(sec)||!ts)return 'No measurements'; if(sec<90)return 'Just now'; if(sec<3600)return `${Math.round(sec/60)} min ago`; if(sec<86400)return `${Math.round(sec/3600)} h ago`; return `${Math.round(sec/86400)} d ago`; };
const abearcWeatherEsc = value => typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function syncAbearcWeatherLayerControl(){
  document.querySelectorAll('[data-weather-stations-rail]').forEach(el=>el.classList.toggle('hidden',!hasPrivilege('view_weather_stations')));
  renderWeatherStationList();
  document.querySelectorAll('[data-map-weather-toggle]').forEach(input=>{input.checked=abearcWeatherStationsVisible;});
  document.querySelectorAll('[data-map-weather-control]').forEach(control=>control.setAttribute('aria-checked',String(abearcWeatherStationsVisible)));
  if(typeof syncAbearcMapLayerCount==='function') syncAbearcMapLayerCount();
}

function setAbearcWeatherStationsVisible(visible,{persist=true,reload=true}={}){
  abearcWeatherStationsVisible=Boolean(visible);
  window.abearcWeatherStationsVisible=abearcWeatherStationsVisible;
  if(persist)localStorage.setItem('abearcWeatherStationsVisible',String(abearcWeatherStationsVisible));
  ['abearc-weather-clusters','abearc-weather-cluster-count','abearc-weather-station-health','abearc-weather-stations'].forEach(id=>{if(abearcMap?.getLayer(id))abearcMap.setLayoutProperty(id,'visibility',abearcWeatherStationsVisible?'visible':'none');});
  syncAbearcWeatherLayerControl();
  if(reload&&abearcWeatherStationsVisible) reloadAbearcWeatherStations();
}
window.setAbearcWeatherStationsVisible=setAbearcWeatherStationsVisible;
window.abearcWeatherStationsVisible=abearcWeatherStationsVisible;

const abearcWeatherMapKinds=['sun','partly','cloud','light-rain','rain','heavy-rain','night-clear','night-partly','storm','unknown'];
function abearcWeatherMapImage(kind='unknown'){
  const c=document.createElement('canvas');c.width=72;c.height=72;const x=c.getContext('2d');
  const face=x.createLinearGradient(0,5,0,58);face.addColorStop(0,'#ffffff');face.addColorStop(1,'#edf5f8');
  x.beginPath();x.moveTo(36,68);x.bezierCurveTo(31,57,11,44,11,29);x.arc(36,29,25,Math.PI,0);x.bezierCurveTo(61,44,41,57,36,68);x.closePath();
  x.save();x.shadowColor='#102f4055';x.shadowBlur=3;x.shadowOffsetY=1;x.fillStyle=face;x.fill();x.restore();
  x.strokeStyle='#fff';x.lineWidth=6;x.lineJoin='round';x.stroke();
  x.strokeStyle='#176d68';x.lineWidth=2.5;x.stroke();
  const markup=weatherStationConditionSymbol(kind);
  const svg=new DOMParser().parseFromString(markup.match(/<svg[\s\S]*?<\/svg>/)[0],'image/svg+xml').documentElement;
  const color=['light-rain','rain','heavy-rain','storm'].includes(kind)?'#448cc0':'#8a959f';
  x.save();x.translate(16,9);x.scale(40/24,40/24);
  if(kind==='sun')x.translate(3,4);
  for(const shape of Array.from(svg.getElementsByTagName('*'))){
    const path=new Path2D();
    if(shape.tagName==='path')path.addPath(new Path2D(shape.getAttribute('d')));
    else if(shape.tagName==='circle')path.arc(Number(shape.getAttribute('cx')),Number(shape.getAttribute('cy')),Number(shape.getAttribute('r')),0,Math.PI*2);
    else continue;
    const fill=shape.getAttribute('fill')||svg.getAttribute('fill')||'#000';
    const stroke=shape.getAttribute('stroke')||svg.getAttribute('stroke')||'none';
    if(fill!=='none'){x.fillStyle=fill==='currentColor'?color:fill;x.fill(path);}
    if(stroke!=='none'){x.strokeStyle=stroke==='currentColor'?color:stroke;x.lineWidth=Number(shape.getAttribute('stroke-width')||svg.getAttribute('stroke-width')||1);x.lineCap=shape.getAttribute('stroke-linecap')||svg.getAttribute('stroke-linecap')||'butt';x.lineJoin=shape.getAttribute('stroke-linejoin')||svg.getAttribute('stroke-linejoin')||'miter';x.stroke(path);}
  }
  x.restore();
  if(kind==='unknown'){x.fillStyle='#237b6c';x.font='bold 14px sans-serif';x.textAlign='center';x.fillText('?',36,35);}
  return x.getImageData(0,0,72,72);
}

function setupAbearcWeatherLayers(){
  if(!abearcMap||!hasPrivilege('view_weather_stations'))return false;
  if(typeof abearcMap.isStyleLoaded==='function'&&!abearcMap.isStyleLoaded()){
    abearcMap.once('idle',setupAbearcWeatherLayers);
    return false;
  }
  if(!abearcMap.hasImage('abearc-weather-station-icon')){try{abearcMap.addImage('abearc-weather-station-icon',abearcWeatherMapImage(),{pixelRatio:1});}catch(_){}}
  if(!abearcMap.hasImage('abearc-weather-rain-pin'))abearcMap.addImage('abearc-weather-rain-pin',abearcWeatherMapImage('rain'),{pixelRatio:1});
  for(const kind of abearcWeatherMapKinds.filter(kind=>!['rain','unknown'].includes(kind)))if(!abearcMap.hasImage('abearc-weather-'+kind+'-pin'))abearcMap.addImage('abearc-weather-'+kind+'-pin',abearcWeatherMapImage(kind),{pixelRatio:1});
  if(!abearcMap.getSource('abearc-weather-stations'))abearcMap.addSource('abearc-weather-stations',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterMaxZoom:9,clusterRadius:44});
  if(!abearcMap.getLayer('abearc-weather-clusters'))abearcMap.addLayer({id:'abearc-weather-clusters',type:'circle',source:'abearc-weather-stations',filter:['has','point_count'],layout:{visibility:abearcWeatherStationsVisible?'visible':'none'},paint:{'circle-color':'#0e7490','circle-radius':['step',['get','point_count'],18,10,22,30,27],'circle-stroke-width':3,'circle-stroke-color':'rgba(255,255,255,.9)','circle-opacity':.92}});
  if(!abearcMap.getLayer('abearc-weather-cluster-count'))abearcMap.addLayer({id:'abearc-weather-cluster-count',type:'symbol',source:'abearc-weather-stations',filter:['has','point_count'],layout:{visibility:abearcWeatherStationsVisible?'visible':'none','text-field':['get','point_count_abbreviated'],'text-size':12,'text-font':['Open Sans Regular']},paint:{'text-color':'#fff'}});
  if(!abearcMap.getLayer('abearc-weather-station-health'))abearcMap.addLayer({id:'abearc-weather-station-health',type:'circle',source:'abearc-weather-stations',filter:['!',['has','point_count']],layout:{visibility:abearcWeatherStationsVisible?'visible':'none'},paint:{'circle-radius':['case',['boolean',['feature-state','hover'],false],14,11],'circle-color':['match',['get','health'],'online','#22c55e','delayed','#eab308','offline','#ef4444','error','#ef4444','#94a3b8'],'circle-opacity':['case',['boolean',['feature-state','hover'],false],.45,.25],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
  if(!abearcMap.getLayer('abearc-weather-stations'))abearcMap.addLayer({id:'abearc-weather-stations',type:'symbol',source:'abearc-weather-stations',filter:['!',['has','point_count']],layout:{visibility:abearcWeatherStationsVisible?'visible':'none','icon-image':'abearc-weather-station-icon','icon-size':.76,'icon-allow-overlap':true,'text-field':['step',['zoom'],'',11,['get','name']],'text-size':11,'text-offset':[0,2.15],'text-anchor':'top','text-font':['Open Sans Regular'],'text-optional':true},paint:{'text-color':'#153544','text-halo-color':'rgba(255,255,255,.96)','text-halo-width':1.5}});
  if(!abearcWeatherMapEventsBound){
    abearcMap.on('click','abearc-weather-clusters',async e=>{const f=e.features?.[0];if(!f)return;const source=abearcMap.getSource('abearc-weather-stations');try{const zoom=await Promise.resolve(source.getClusterExpansionZoom(Number(f.properties.cluster_id)));abearcMap.easeTo({center:f.geometry.coordinates,zoom});}catch(_){}});
    abearcMap.on('click','abearc-weather-stations',e=>{const f=e.features?.[0];if(f)openAbearcWeatherMapPopup(Number(f.properties.station_id),f.geometry.coordinates);});
    for(const layer of ['abearc-weather-clusters','abearc-weather-stations']){abearcMap.on('mouseenter',layer,()=>{abearcMap.getCanvas().style.cursor='pointer';});abearcMap.on('mouseleave',layer,()=>{abearcMap.getCanvas().style.cursor='';});}
    abearcMap.on('mousemove','abearc-weather-stations',e=>{const f=e.features?.[0];if(f?.id!=null){abearcMap.setFeatureState({source:'abearc-weather-stations',id:f.id},{hover:true});abearcMap.getCanvas().title=f.properties.name;}});abearcMap.on('mouseleave','abearc-weather-stations',()=>{abearcWeatherStationsCache.forEach(s=>abearcMap.setFeatureState({source:'abearc-weather-stations',id:Number(s.id)},{hover:false}));abearcMap.getCanvas().title='';});abearcWeatherMapEventsBound=true;
  }
  abearcMap.setLayoutProperty('abearc-weather-stations','icon-image',['match',['get','condition'],...abearcWeatherMapKinds.filter(kind=>kind!=='unknown').flatMap(kind=>[kind,'abearc-weather-'+kind+'-pin']),'abearc-weather-station-icon']);
  abearcMap.setLayoutProperty('abearc-weather-stations','icon-anchor','bottom');
  syncAbearcWeatherLayerControl();
  renderAbearcWeatherMapSource();
  return true;
}
window.setupAbearcWeatherLayers=setupAbearcWeatherLayers;

function renderAbearcWeatherMapSource(){
  const source=abearcMap?.getSource('abearc-weather-stations');if(!source)return;
  const features=abearcWeatherStationsCache.filter(s=>s.longitude!==null&&s.latitude!==null&&Number.isFinite(Number(s.longitude))&&Number.isFinite(Number(s.latitude))).map(s=>({type:'Feature',id:Number(s.id),geometry:{type:'Point',coordinates:[Number(s.longitude),Number(s.latitude)]},properties:{station_id:Number(s.id),name:weatherStationMapLabel(s),health:s.health?.status||'unknown',condition:weatherStationCondition(s).icon}}));
  source.setData({type:'FeatureCollection',features});
}

async function reloadAbearcWeatherStations({silent=true}={}){
  if(!currentUser||!hasPrivilege('view_weather_stations'))return [];
  try{const data=await fetchJson(`${API}/weather/map-stations`,{silentLoading:silent});abearcWeatherStationsCache=Array.isArray(data.stations)?data.stations:[];setupAbearcWeatherLayers();renderAbearcWeatherMapSource();syncAbearcWeatherLayerControl();loadWeatherMapNightForecasts(abearcWeatherStationsCache);return abearcWeatherStationsCache;}catch(error){if(!silent)toast(error.message||'Unable to load weather stations.','error');return [];}
}
window.reloadAbearcWeatherStations=reloadAbearcWeatherStations;

function abearcWeatherPopupMetrics(station){
  const by = new Map((Array.isArray(station?.current) ? station.current : []).filter(r => r?.normalized_key).map(r => [r.normalized_key, r]));
  const definitions = [
    ['relative_humidity', 'Relative Humidity', 'drop', '%'],
    ['wind_speed', 'Wind Speed', 'wind', 'm/s'],
    ['wind_gust', 'Wind Gust', 'wind', 'm/s'],
    ['wind_direction', 'Wind Direction', 'compass', '°'],
  ];
  return definitions.map(([key,label,icon,defaultUnit]) => {
    const reading = by.get(key);
    const available = reading?.value !== null && reading?.value !== undefined && reading?.value !== '' && Number.isFinite(Number(reading.value));
    const unit = reading?.unit || defaultUnit;
    const value = available ? abearcWeatherNum(reading.value) : '—';
    const suffix = !available ? '' : key==='wind_direction' ? abearcWeatherCompass(reading.value) : key==='relative_humidity' ? (Number(reading.value)>70?'Humidity: High':Number(reading.value)<30?'Humidity: Low':'Humidity: Moderate') : key==='wind_speed' ? (Number(reading.value)<0.3?'Calm':Number(reading.value)<1.6?'Light Air':Number(reading.value)<3.4?'Light Breeze':Number(reading.value)<5.5?'Gentle Breeze':'Windy') : '';
    const symbol=key==='wind_direction'?'<svg class="wx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7 12 10-5-5 10-1-4Z" fill="currentColor"/></svg>':weatherIcon(icon);
    return `<div class="wx-snapshot-metric" role="listitem">${symbol}<div><span class="wx-snapshot-metric-label">${abearcWeatherEsc(label)}</span><div class="wx-snapshot-metric-value">${value}<span class="wx-snapshot-metric-unit">${available ? ' '+abearcWeatherEsc(unit) : ''}</span></div>${suffix ? `<span class="wx-snapshot-compass">${abearcWeatherEsc(suffix)}</span>` : ''}</div></div>`;
  }).join('');
}
function abearcWeatherPopupPdfUrl(stationId){
  // Forecast is optional and labeled separately inside the advisory report.
  return `${API}/weather/stations/${encodeURIComponent(stationId)}/report.pdf?include_forecast=1&first_page=1`;
}
async function downloadAbearcWeatherStationAdvisory(stationId, button){
  if (!hasPrivilege('export_weather_data')) return toast('Permission denied: export_weather_data', 'error');
  if (button?.disabled) return;
  if (button) { button.disabled=true;button.classList.add('is-loading');button.setAttribute('aria-busy','true'); }
  try {
    await abearcWeatherDownload(abearcWeatherPopupPdfUrl(stationId), `farm-weather-advisory-${stationId}.pdf`);
  } finally {
    if (button) { button.disabled=false;button.classList.remove('is-loading');button.removeAttribute('aria-busy'); }
  }
}
function abearcWeatherHeatIndex(temperature,humidity){
  if([temperature,humidity].some(v=>v==null||v===''||!Number.isFinite(Number(v))))return null;
  const c=Number(temperature),rh=Number(humidity);
  // Warm-weather estimate only; no cold-weather wind-chill extrapolation.
  if(c<20||c>50||rh<0||rh>100)return null;
  const t=c*9/5+32;
  // NWS algorithm: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
  let hi=(0.5*(t+61+(t-68)*1.2+rh*0.094)+t)/2;
  if(hi>=80){
    hi=-42.379+2.04901523*t+10.14333127*rh-0.22475541*t*rh-0.00683783*t*t-0.05481717*rh*rh+0.00122874*t*t*rh+0.00085282*t*rh*rh-0.00000199*t*t*rh*rh;
    if(rh<13&&t>=80&&t<=112)hi-=(13-rh)/4*Math.sqrt((17-Math.abs(t-95))/17);
    else if(rh>85&&t>=80&&t<=87)hi+=(rh-85)/10*(87-t)/5;
  }
  return (hi-32)*5/9;
}

function openAbearcWeatherMapPopup(stationId,coordinates){
  const station=abearcWeatherStationsCache.find(s=>Number(s.id)===Number(stationId));
  if(!station||!abearcMap)return;
  weatherPopup?.remove();
  const root=document.createElement('section');
  root.className='abearc-weather-popup wx-station-snapshot';
  root.setAttribute('data-weather-popup-station',String(station.id));
  root.setAttribute('aria-label',`Weather conditions at ${station.display_name||'station'}`);
  const current=Array.isArray(station.current)?station.current:[];
  const temp=current.find(r=>r.normalized_key==='air_temperature');
  const validTemp=temp?.value!==null&&temp?.value!==undefined&&temp.value!==''&&Number.isFinite(Number(temp.value));
  const validRain=station.rain_today_mm!==null&&station.rain_today_mm!==undefined&&station.rain_today_mm!==''&&Number.isFinite(Number(station.rain_today_mm));
  const condition=typeof weatherStationCondition==='function'?weatherStationCondition(station):{icon:'unknown',label:'Condition unavailable'};
  const status=String(station.health?.status||'unknown').toLowerCase();
  const statusLabel=station.health?.label||'Status unknown';
  const updated=abearcWeatherAgo(station.last_measurement_ts);
  const sourceName=station.provider_name||'ZENTRA AWS';
  const feels=current.find(r=>r.normalized_key==='apparent_temperature');
  const humidity=current.find(r=>r.normalized_key==='relative_humidity');
  const measuredFeels=feels?.value!=null&&feels.value!==''&&Number.isFinite(Number(feels.value))&&(!feels.quality_status||feels.quality_status==='valid')&&feels.unit==='°C';
  const estimatedFeels=temp?.unit==='°C'&&humidity?.unit==='%'&&(!temp.quality_status||temp.quality_status==='valid')&&(!humidity.quality_status||humidity.quality_status==='valid')?abearcWeatherHeatIndex(temp.value,humidity.value):null;
  const feelsValue=measuredFeels?Number(feels.value):estimatedFeels;
  const feelsNote=measuredFeels?'Reported by the weather station':feelsValue!=null?'Computed heat index from station temperature and humidity, for shade and light wind.':'Requires valid station temperature (20–50 °C) and relative humidity.';
  const conditionTitle=weatherMapConditionTitle(condition.icon);
  const conditionArt=weatherStationConditionSymbol(condition.icon);
  const coord=(value,positive,negative)=>value==null?'—':`${Math.abs(Number(value)).toFixed(4)}° ${Number(value)<0?negative:positive}`;
  root.innerHTML=`
    <header class="wx-snapshot-header">
      <div><div class="wx-snapshot-source"><div class="wx-snapshot-eyebrow">OBSERVED - ${abearcWeatherEsc(sourceName)}</div>${hasPrivilege('manage_weather_stations')?'<button type="button" class="wx-snapshot-sync" data-weather-popup-sync title="Synchronize this station">Sync</button>':''}</div>
      <h4 class="wx-snapshot-station-name"><span data-weather-popup-station-name>${abearcWeatherEsc(station.display_name||'Weather station')}</span>${hasPrivilege('manage_weather_stations')?'<button type="button" class="wx-snapshot-rename" data-weather-popup-rename aria-label="Rename weather station" title="Rename weather station">✎</button>':''}</h4>
      <div class="wx-snapshot-status"><span class="wx-snapshot-status-text is-${abearcWeatherEsc(status)}">${abearcWeatherEsc(statusLabel)}</span><span aria-hidden="true">·</span><span class="wx-snapshot-age">${abearcWeatherEsc(updated)}</span></div>
      <div class="wx-snapshot-location">${coord(station.latitude,'N','S')}, ${coord(station.longitude,'E','W')} <span>▲ &nbsp; Elev. ${abearcWeatherNum(station.elevation,0)} ${abearcWeatherEsc(station.elevation_unit||'m')}</span></div></div>
      <div class="wx-snapshot-condition"><div class="wx-snapshot-condition-icon">${conditionArt}</div><div><strong data-weather-popup-condition-title>${conditionTitle}</strong><small>Updated ${station.last_measurement_ts?abearcWeatherEsc(new Date(station.last_measurement_ts*1000).toLocaleString('en-US',{timeZone:station.timezone||'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})):'—'}</small></div></div>
    </header>
    <div class="wx-snapshot-hero">
      <div class="wx-snapshot-temperature"><span class="wx-snapshot-thermometer">${weatherIcon('temperature')}</span><div><span class="wx-snapshot-hero-label">Temperature</span><strong>${validTemp?abearcWeatherNum(temp.value):'—'} <span>°C</span></strong><small title="${abearcWeatherEsc(feelsNote)}">Feels like ${abearcWeatherNum(feelsValue)} °C</small></div></div>
      <div class="wx-snapshot-rain">${weatherIcon('rain')}<div><span class="wx-snapshot-hero-label">Rainfall (Today)</span><strong>${validRain?abearcWeatherNum(station.rain_today_mm):'—'} <span>mm</span><span class="wx-snapshot-since">Since midnight</span></strong><small><span data-weather-popup-rain-total>Last 24h: —</span></small></div></div>
    </div>
    <div class="wx-snapshot-metrics" role="list" aria-label="Latest station measurements">${abearcWeatherPopupMetrics(station)}</div>
    <section class="wx-snapshot-trend"><header><h5>▥ &nbsp;24-Hour Forecast</h5><div class="wx-snapshot-tabs" aria-label="Trend measurement">${[['precipitation','Rainfall'],['temperature_2m','Temperature'],['relative_humidity_2m','Humidity'],['wind_speed_10m','Wind']].map(([key,label])=>`<button type="button" data-weather-popup-trend="${key}" aria-pressed="${key==='precipitation'}">${label}</button>`).join('')}</div></header><div data-weather-popup-chart aria-live="polite"><p class="wx-snapshot-empty">Loading station history…</p></div></section>
    <div class="wx-snapshot-actions"><button type="button" class="wx-snapshot-primary" data-weather-popup-dashboard>Open weather dashboard</button>${hasPrivilege('export_weather_data')?'<button type="button" class="wx-snapshot-secondary" data-weather-popup-pdf>Download Farm Advisory</button>':''}</div>`;
  root.querySelector('[data-weather-popup-dashboard]')?.addEventListener('click',()=>{weatherPopup?.remove();openAbearcWeatherDashboard(station.id);});
  root.querySelector('[data-weather-popup-rename]')?.addEventListener('click',()=>renameWeatherStationFromPopup(root,station));
  const syncButton=root.querySelector('[data-weather-popup-sync]');
  syncButton?.addEventListener('click',()=>syncAbearcWeatherPopup(root,station,syncButton,coordinates));
  const pdfButton=root.querySelector('[data-weather-popup-pdf]');
  pdfButton?.addEventListener('click',()=>downloadAbearcWeatherStationAdvisory(station.id,pdfButton));
  weatherPopup=new maplibregl.Popup({anchor:'center',offset:0,maxWidth:'480px',className:'wx-map-popup wx-station-map-popup',closeButton:true,focusAfterOpen:false})
    .setLngLat(coordinates).setDOMContent(root).addTo(abearcMap);
  const width=abearcMap.getContainer().clientWidth;
  const popupWidth=Math.min(480,Math.max(245,width-35));
  abearcMap.easeTo({center:coordinates,zoom:abearcMapScaleZoom(coordinates[1],20.5),bearing:0,pitch:0,offset:[-Math.min(popupWidth/2+40,width/2-24),0],duration:350,essential:false});
  loadAbearcWeatherPopupTrend(root,station);
}

async function syncAbearcWeatherPopup(root,station,button,coordinates){
  if(!hasPrivilege('manage_weather_stations'))return toast('Permission denied: manage_weather_stations','error');
  if(button.disabled)return;
  button.disabled=true;button.textContent='Syncing…';button.setAttribute('aria-busy','true');
  try{
    const result=await fetchJson(`${API}/weather/stations/${encodeURIComponent(station.id)}/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',silentLoading:true});
    await reloadAbearcWeatherStations();
    if(weatherPopup?.getElement().contains(root))openAbearcWeatherMapPopup(station.id,coordinates);
    toast(`Weather sync complete: ${Number(result.inserted||0)} new value(s).`);
  }catch(error){toast(error.message||'Weather synchronization failed.','error');}
  finally{button.disabled=false;button.textContent='Sync';button.removeAttribute('aria-busy');}
}

async function renameWeatherStationFromPopup(root,station){
  const name=root.querySelector('[data-weather-popup-station-name]');
  const button=root.querySelector('[data-weather-popup-rename]');
  if(!name||!button||root.querySelector('[data-weather-popup-name-input]'))return;
  const input=document.createElement('input');input.type='text';input.maxLength=160;input.value=station.display_name||'';input.className='wx-snapshot-name-input';input.setAttribute('data-weather-popup-name-input','');
  name.replaceWith(input);input.focus();input.select();button.textContent='✓';button.title='Save station name';
  const makeName=()=>{const span=document.createElement('span');span.textContent=station.display_name;span.setAttribute('data-weather-popup-station-name','');return span;};
  const cancel=()=>{input.replaceWith(makeName());button.textContent='✎';button.title='Rename weather station';button.onclick=()=>renameWeatherStationFromPopup(root,station);};
  const save=async()=>{const value=input.value.trim();if(!value)return input.focus();button.disabled=true;try{const data=await fetchJson(`${API}/weather/stations/${Number(station.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({display_name:value}),silentLoading:true});station.display_name=data.station?.display_name||value;root.setAttribute('aria-label',`Weather conditions at ${station.display_name}`);input.replaceWith(makeName());button.textContent='✎';button.title='Rename weather station';button.disabled=false;button.onclick=()=>renameWeatherStationFromPopup(root,station);if(abearcWeatherStationDetail?.station&&Number(abearcWeatherStationDetail.station.id)===Number(station.id)){abearcWeatherStationDetail.station.display_name=station.display_name;renderAbearcWeatherStationHeader();}renderAbearcWeatherMapSource();renderWeatherStationList();toast('Weather station renamed.');}catch(error){toast(error.message||'Unable to rename weather station.','error');button.disabled=false;}};
  button.onclick=save;input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save();}if(event.key==='Escape')cancel();});
}

function setAbearcWeatherLoading(active){document.getElementById('abearcWeatherLoading')?.classList.toggle('hidden',!active);}
function showAbearcWeatherError(message=''){const el=document.getElementById('abearcWeatherError');if(!el)return;el.textContent=message;el.classList.toggle('hidden',!message);}
function setAbearcWeatherTab(tab){document.querySelectorAll('[data-weather-tab]').forEach(b=>{b.classList.toggle('is-active',b.dataset.weatherTab===tab);b.setAttribute('aria-selected',String(b.dataset.weatherTab===tab));});document.querySelectorAll('[data-weather-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.weatherPanel!==tab));document.querySelector('.abearc-weather-toolbar').classList.toggle('hidden',['overview','forecast','station'].includes(tab));if(tab==='charts')document.querySelector('.wx-measurements')?.removeAttribute('open');if(tab==='station')loadAbearcWeatherStationAdmin();if(tab==='agriculture')renderWeatherCropAdvisoryLibrary();}
window.setAbearcWeatherTab=setAbearcWeatherTab;

async function openAbearcWeatherDashboard(stationId){
  if(!hasPrivilege('view_weather_stations'))return toast('Permission denied: view_weather_stations','error');
  const sequence=++weatherOpenSequence;weatherFocusReturn=document.activeElement;abearcWeatherSelectedStationId=Number(stationId);abearcWeatherTablePage=0;abearcWeatherExactRange=null;abearcWeatherHistory=null;weatherAllHistory=null;weatherRecentHistory=null;abearcWeatherForecast=null;abearcWeatherAgriculture=null;
  weatherTimelineHistory=null;weatherForecastDay=null;document.querySelector('.wx-measurements')?.removeAttribute('open');
  document.getElementById('abearcWeatherDashboard').classList.remove('hidden');document.body.classList.add('modal-open');setAbearcWeatherTab('overview');showAbearcWeatherError('');setAbearcWeatherLoading(true);document.querySelector('.abearc-weather-close').focus();
  document.getElementById('abearcWeatherTitle').textContent='Weather station';document.getElementById('abearcWeatherCurrentCards').innerHTML='<div class="wx-skeleton">Loading observed conditions…</div>';document.getElementById('wxForecastPreview').innerHTML='<div class="wx-skeleton">Loading forecast…</div>';
  loadAbearcWeatherForecast(stationId,sequence);
  try{
    const detail=await fetchJson(`${API}/weather/stations/${stationId}`,{silentLoading:true});if(sequence!==weatherOpenSequence)return;
    abearcWeatherStationDetail=detail;renderAbearcWeatherStationHeader();renderAbearcWeatherSeriesChooser();applyAbearcWeatherPreset('7d',{reload:false});
    weatherLoadTimeline();
    const observations=await Promise.allSettled([fetchJson(`${API}/weather/stations/${stationId}/current`,{silentLoading:true}),fetchJson(`${API}/weather/stations/${stationId}/history?start=${Math.floor(Date.now()/1000)-86400}&end=${Math.floor(Date.now()/1000)+1}&aggregation=hourly`,{silentLoading:true}),fetchJson(`${API}/weather/stations/${stationId}/alerts`,{silentLoading:true})]);
    if(sequence!==weatherOpenSequence)return;
    if(observations[0].status==='fulfilled'){abearcWeatherCurrent=observations[0].value;renderAbearcWeatherCurrent();renderAbearcWeatherStationHeader();}else document.getElementById('abearcWeatherCurrentCards').innerHTML=weatherEmpty('Observed conditions are temporarily unavailable.');
    if(observations[1].status==='fulfilled')weatherRecentHistory=observations[1].value;
    const events=observations[2].status==='fulfilled'?observations[2].value.events.filter(e=>e.status==='active'):[];
    document.getElementById('wxActiveAlerts').innerHTML=events.length?events.map(e=>'<div class="wx-alert">'+abearcWeatherEsc(e.message)+'</div>').join(''):'<p class="wx-freshness">No active station alerts.</p>';
    weatherRenderTransition();await reloadAbearcWeatherDashboardData();
  }catch(error){if(sequence===weatherOpenSequence)showAbearcWeatherError(error.message||'Unable to load observations. Forecast remains available.');}finally{if(sequence===weatherOpenSequence)setAbearcWeatherLoading(false);}
}

window.openAbearcWeatherDashboard=openAbearcWeatherDashboard;
function closeAbearcWeatherDashboard(){document.getElementById('abearcWeatherDashboard')?.classList.add('hidden');document.body.classList.remove('modal-open');weatherOpenSequence++;weatherHistorySequence++;weatherFocusReturn?.focus?.();}
window.closeAbearcWeatherDashboard=closeAbearcWeatherDashboard;

function renderAbearcWeatherStationHeader(){
  const s=abearcWeatherStationDetail?.station||abearcWeatherCurrent?.station;if(!s)return;
  const title=document.getElementById('abearcWeatherTitle');if(title)title.textContent=s.display_name;
  const sub=document.getElementById('abearcWeatherSubtitle');if(sub)sub.textContent=[s.latitude!=null&&s.longitude!=null?Number(s.latitude).toFixed(5)+'°, '+Number(s.longitude).toFixed(5)+'°':null,s.elevation!=null?'Elevation '+weatherQuantity(s.elevation,s.elevation_unit||'m'):null,s.timezone].filter(Boolean).join(' · ');
  const health=abearcWeatherCurrent?.health||s.health||{};const badge=document.getElementById('abearcWeatherHealth');if(badge){badge.textContent=health.label||'Unknown';badge.className=`abearc-weather-health is-${health.status||'unknown'}`;}
  document.querySelector('[data-weather-sync]')?.classList.toggle('hidden',!hasPrivilege('manage_weather_stations'));
  document.querySelector('[data-weather-advisory-download]')?.classList.toggle('hidden',!hasPrivilege('export_weather_data'));
}

function renderAbearcWeatherCurrent(){
  const readings=abearcWeatherCurrent?.readings||[];const valid=readings.filter(r=>r.quality_status==='valid');
  const selected=[...valid.filter(r=>r.normalized_key!=='precipitation')].sort((a,b)=>{const ai=abearcWeatherPriority.indexOf(a.normalized_key),bi=abearcWeatherPriority.indexOf(b.normalized_key);return (ai<0?999:ai)-(bi<0?999:bi);}).slice(0,6);
  const container=document.getElementById('abearcWeatherCurrentCards');if(container)container.innerHTML=selected.length?selected.map(raw=>{const r={...raw,...weatherDisplayQuantity(raw.value,raw.unit)};return `<article class="abearc-weather-card"><small>${abearcWeatherEsc(abearcWeatherLabel(r.normalized_key,r.measurement))}</small><strong>${weatherQuantityNumber(raw.value,raw.unit,raw.normalized_key==='wind_direction'?0:1)}${r.normalized_key==='wind_direction'&&abearcWeatherCompass(raw.value)?` ${abearcWeatherEsc(r.unit)} ${abearcWeatherCompass(raw.value)}`:` ${abearcWeatherEsc(r.unit||'')}`} </strong><span>${abearcWeatherEsc(abearcWeatherAgo(r.timestamp_utc))}</span></article>`;}).join(''):'<div class="abearc-weather-card"><small>Current conditions</small><strong>—</strong><span>No synchronized measurements yet.</span></div>';
  renderAbearcWeatherQuality();
}
function renderAbearcWeatherQuality(){
  const s=abearcWeatherStationDetail?.station||{};const h=abearcWeatherCurrent?.health||{};const errors=abearcWeatherStationDetail?.sensor_errors||[];const el=document.getElementById('abearcWeatherQuality');if(!el)return;
  el.innerHTML=`<dl class="abearc-weather-kv"><dt>Status</dt><dd>${abearcWeatherEsc(h.label||'Unknown')}</dd><dt>Last measurement</dt><dd>${abearcWeatherEsc(abearcWeatherDate(s.last_measurement_ts))} (${abearcWeatherEsc(abearcWeatherAgo(s.last_measurement_ts))})</dd><dt>Expected upload</dt><dd>${abearcWeatherNum(h.expected_upload_minutes,0)} min</dd><dt>Last sync</dt><dd>${abearcWeatherEsc(s.last_successful_sync_at?new Date(s.last_successful_sync_at).toLocaleString():'Not synchronized')}</dd><dt>Sensor errors</dt><dd>${errors.length?`${errors.length} reported`:'None reported'}</dd></dl>`;
}

function renderAbearcWeatherSeriesChooser(){
  const list=abearcWeatherStationDetail?.series||[];const container=document.getElementById('abearcWeatherSeriesChooser');if(!container)return;
  const uniqueDefaults=new Map();[...list].sort((a,b)=>Number(b.id)-Number(a.id)).filter(s=>! /^(min|max)\b/i.test(s.measurement)).forEach(s=>{if(!uniqueDefaults.has(s.normalized_key))uniqueDefaults.set(s.normalized_key,s);});const defaults=new Set([...uniqueDefaults.values()].sort((a,b)=>{const ai=abearcWeatherPriority.indexOf(a.normalized_key),bi=abearcWeatherPriority.indexOf(b.normalized_key);return (ai<0?999:ai)-(bi<0?999:bi);}).slice(0,6).map(s=>Number(s.id)));
  container.innerHTML=list.map(s=>`<label><input type="checkbox" data-weather-series="${Number(s.id)}" ${defaults.has(Number(s.id))?'checked':''} onchange="weatherSelectMeasurements()"><span>${abearcWeatherEsc(s.measurement||abearcWeatherLabel(s.normalized_key))}${s.position?` · ${abearcWeatherEsc(s.position)}`:''}</span></label>`).join('')||'<span>No measurement series discovered yet.</span>';
}
function selectedAbearcWeatherSeriesIds(){return [...document.querySelectorAll('[data-weather-series]:checked')].map(i=>Number(i.dataset.weatherSeries)).filter(Number.isFinite);}

function abearcWeatherDateInputValue(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
function applyAbearcWeatherPreset(value,{reload=true}={}){
  const preset=document.getElementById('abearcWeatherPreset');if(preset&&preset.value!==value)preset.value=value;
  const from=document.getElementById('abearcWeatherFrom'),to=document.getElementById('abearcWeatherTo');if(!from||!to)return;
  const localParts=new Intl.DateTimeFormat('en-CA',{timeZone:abearcWeatherStationDetail?.station?.timezone||'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=k=>Number(localParts.find(p=>p.type===k).value);const now=new Date(part('year'),part('month')-1,part('day'));let a=new Date(now.getFullYear(),now.getMonth(),now.getDate()),b=new Date(a);abearcWeatherExactRange=null;
  if(value==='yesterday'){a.setDate(a.getDate()-1);b=new Date(a);}else if(value==='24h'){abearcWeatherExactRange={start:Math.floor(Date.now()/1000)-86400,end:Math.floor(Date.now()/1000)+1};a=new Date(Date.now()-86400000);b=now;}
  else if(value==='7d'){a.setDate(a.getDate()-6);}else if(value==='30d'){a.setDate(a.getDate()-29);}else if(value==='this-month'){a=new Date(now.getFullYear(),now.getMonth(),1);}else if(value==='previous-month'){a=new Date(now.getFullYear(),now.getMonth()-1,1);b=new Date(now.getFullYear(),now.getMonth(),0);}else if(value==='1y'){a=new Date(now.getFullYear()-1,now.getMonth(),now.getDate());}else if(value==='3m'){a=new Date(now.getFullYear(),now.getMonth()-3,now.getDate());}else if(value==='6m'){a=new Date(now.getFullYear(),now.getMonth()-6,now.getDate());}else if(value==='this-year'){a=new Date(now.getFullYear(),0,1);}else if(value==='previous-year'){a=new Date(now.getFullYear()-1,0,1);b=new Date(now.getFullYear()-1,11,31);}else if(value==='custom'){if(reload)reloadAbearcWeatherDashboardData();return;}
  from.value=abearcWeatherDateInputValue(a);to.value=abearcWeatherDateInputValue(b);
  const agg=document.getElementById('abearcWeatherAggregation');if(agg&&value!=='custom'){const days=Math.max(1,(b-a)/86400000+1);agg.value=days<=2?'raw':days<=10?'hourly':days<=120?'daily':days<=800?'monthly':'yearly';}
  if(reload)reloadAbearcWeatherDashboardData();
}
window.applyAbearcWeatherPreset=applyAbearcWeatherPreset;
function weatherDateRangeChanged(){abearcWeatherExactRange=null;const p=document.getElementById('abearcWeatherPreset');if(p)p.value='custom';reloadAbearcWeatherDashboardData();}
window.weatherDateRangeChanged=weatherDateRangeChanged;
function abearcWeatherQueryParams({includeSeries=true}={}){const q=new URLSearchParams();if(abearcWeatherExactRange){q.set('start',abearcWeatherExactRange.start);q.set('end',abearcWeatherExactRange.end);}else{const a=document.getElementById('abearcWeatherFrom')?.value,b=document.getElementById('abearcWeatherTo')?.value;if(a)q.set('start_date',a);if(b)q.set('end_date',b);}q.set('aggregation',document.getElementById('abearcWeatherAggregation')?.value||'hourly');if(includeSeries){const ids=selectedAbearcWeatherSeriesIds();if(ids.length)q.set('series',ids.join(','));}return q;}

async function reloadAbearcWeatherDashboardData(){
  if(!abearcWeatherSelectedStationId)return;const sequence=++weatherHistorySequence;const stationId=abearcWeatherSelectedStationId;showAbearcWeatherError('');setAbearcWeatherLoading(true);abearcWeatherTablePage=0;
  try{const q=abearcWeatherQueryParams({includeSeries:false});const data=await fetchJson(`${API}/weather/stations/${stationId}/history?${q}`,{silentLoading:true});if(sequence!==weatherHistorySequence||stationId!==abearcWeatherSelectedStationId)return;weatherAllHistory=data;weatherSelectMeasurements();if(data.truncated)showAbearcWeatherError('This period exceeds the cached query limit. Shorten the date range to see complete results.');await loadAbearcWeatherAgriculture({silent:true});}
  catch(error){if(sequence===weatherHistorySequence)showAbearcWeatherError(error.message||'Unable to load historical weather data.');}finally{if(sequence===weatherHistorySequence)setAbearcWeatherLoading(false);}
}
function weatherSelectMeasurements(){if(!weatherAllHistory)return;const ids=new Set(selectedAbearcWeatherSeriesIds());abearcWeatherHistory={...weatherAllHistory,series:weatherAllHistory.series.filter(s=>ids.has(Number(s.id))),data:weatherAllHistory.data.filter(r=>ids.has(Number(r.series_id)))};renderAbearcWeatherCharts();renderAbearcWeatherTable();renderAbearcWeatherReportMeta();}

window.reloadAbearcWeatherDashboardData=reloadAbearcWeatherDashboardData;

function abearcWeatherHistoryGroups(filterKey=null){return weatherGroupPoints(filterKey?weatherAllHistory:abearcWeatherHistory,filterKey);}
function abearcWeatherSvgForGroup(group,options){return weatherChart(group,options);}
function wireAbearcWeatherChartInteractions(root){weatherChartInteractions(root);}

function renderAbearcWeatherChart(containerId,groups,{forceBars=false}={}){const el=document.getElementById(containerId);if(!el)return;el.innerHTML=groups.length?groups.map(g=>abearcWeatherSvgForGroup(g,{bars:forceBars||g.series.normalized_key==='precipitation'})).join(''):'<div class="abearc-weather-card"><small>Chart</small><strong>—</strong><span>No selected data for this period.</span></div>';wireAbearcWeatherChartInteractions(el);}
function renderAbearcWeatherCharts(){const groups=abearcWeatherHistoryGroups();renderAbearcWeatherChart('abearcWeatherMainChart',groups);const overviewKeys=['air_temperature','precipitation','solar_radiation'];const overview=overviewKeys.flatMap(key=>weatherGroupPoints(weatherRecentHistory,key).filter(g=>! /^(min|max)\b/i.test(g.series.measurement)).slice(-1).map(g=>g.series.normalized_key==='solar_radiation'?{...g,area:true}:g));const overviewEl=document.getElementById('abearcWeatherOverviewChart');if(overviewEl)overviewEl.innerHTML=weatherCombinedChart(overview);renderAbearcWeatherChart('abearcWeatherRainChart',abearcWeatherHistoryGroups('precipitation'),{forceBars:true});weatherRenderWindRose();weatherRenderRainExtras();}

async function loadAbearcWeatherAgriculture({silent=false}={}){
  if(!abearcWeatherSelectedStationId)return;const stationId=abearcWeatherSelectedStationId,sequence=weatherHistorySequence;try{const q=abearcWeatherQueryParams({includeSeries:false});q.delete('aggregation');q.set('gdd_base_c',document.getElementById('abearcWeatherGddBase')?.value||10);const kc=document.getElementById('abearcWeatherCropKc')?.value;if(kc)q.set('crop_kc',kc);const agriculture=await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/agriculture?${q}`,{silentLoading:true});if(stationId!==abearcWeatherSelectedStationId||sequence!==weatherHistorySequence)return;abearcWeatherAgriculture=agriculture;renderAbearcWeatherAgriculture();weatherRenderRainExtras();weatherRenderOverviewSummary();}catch(error){if(!silent)showAbearcWeatherError(error.message||'Unable to load agricultural analytics.');}}
window.loadAbearcWeatherAgriculture=loadAbearcWeatherAgriculture;
function renderAbearcWeatherAgriculture(){const a=abearcWeatherAgriculture;if(!a)return;const rain=a.rainfall||{};const rainCards=document.getElementById('abearcWeatherRainCards');if(rainCards)rainCards.innerHTML=[['Today',rain.today_mm,'mm'],['Last hour',rain.last_hour_mm,'mm'],['Last 24 hours',rain.last_24h_mm,'mm'],['Last 7 days',rain.last_7d_mm,'mm'],['This month',rain.month_mm,'mm'],['This year',rain.year_mm,'mm'],['Dry spell',a.consecutive_dry_days,'days'],['Rainy spell',a.consecutive_rainy_days,'days']].map(([l,v,u])=>`<article class="abearc-weather-card"><small>${l}</small><strong>${weatherQuantityNumber(v,u,u==='days'?0:1)} <span>${abearcWeatherEsc(weatherDisplayUnit(u))}</span></strong></article>`).join('');
  const days=a.daily||[],last=days.at(-1)||{};const sumGdd=days.some(d=>Number.isFinite(d.gdd))?days.map(d=>d.gdd).filter(Number.isFinite).reduce((x,y)=>x+y,0):null,sumEt0=days.map(d=>d.et0_mm).filter(Number.isFinite).reduce((x,y)=>x+y,0);const hasEt0=days.some(d=>Number.isFinite(d.et0_mm));const agri=document.getElementById('abearcWeatherAgriCards');if(agri)agri.innerHTML=[['VPD (latest day)',last.vpd_avg_kpa,'kPa'],['GDD (period)',sumGdd,'degree-days'],['ET₀ (period)',hasEt0?sumEt0:null,'mm'],['Dry days',a.consecutive_dry_days,'days'],['Rainy days',a.consecutive_rainy_days,'days'],['Indicative deficit (latest)',last.indicative_water_deficit_mm,'mm']].map(([l,v,u])=>`<article class="abearc-weather-card"><small>${l}</small><strong>${weatherQuantityNumber(v,u,2)} <span>${abearcWeatherEsc(weatherDisplayUnit(u))}</span></strong></article>`).join('');
  const table=document.getElementById('abearcWeatherAgriTable');if(table)table.innerHTML=days.length?`<table><thead><tr><th>Date</th><th>T min</th><th>T avg</th><th>T max</th><th>RH</th><th>Rain</th><th>VPD</th><th>GDD</th><th>Solar energy</th><th>ET₀</th><th>Method</th></tr></thead><tbody>${days.slice(-120).map(d=>`<tr><td>${abearcWeatherEsc(d.date)}</td><td>${weatherQuantity(d.temperature_min_c,'°C',1)}</td><td>${weatherQuantity(d.temperature_avg_c,'°C',1)}</td><td>${weatherQuantity(d.temperature_max_c,'°C',1)}</td><td>${weatherQuantity(d.relative_humidity_avg_pct,'%',1)}</td><td>${weatherQuantity(d.rainfall_mm,'mm',1)}</td><td>${weatherQuantity(d.vpd_avg_kpa,'kPa',2)}</td><td>${weatherQuantity(d.gdd,'degree-days',2)}</td><td>${weatherQuantity(d.solar_energy_mj_m2,'MJ/m²',2)}</td><td>${weatherQuantity(d.et0_mm,'mm',2)}</td><td>${abearcWeatherEsc(d.et0_method)}</td></tr>`).join('')}</tbody></table>`:'<p>No complete daily agricultural indicators in the selected period.</p>';
  const notes=document.getElementById('abearcWeatherAgriNotes');if(notes){const n=a.method_notes||{};notes.innerHTML=`<strong>Methods and limitations.</strong> ${abearcWeatherEsc(n.gdd||'')} ${abearcWeatherEsc(n.vpd||'')} ${abearcWeatherEsc(n.et0||'')} ${abearcWeatherEsc(n.irrigation||'')}`;}}

function renderAbearcWeatherTable(){const h=abearcWeatherHistory,el=document.getElementById('abearcWeatherDataTable');if(!h||!el)return;const seriesById=new Map((h.series||[]).map(s=>[Number(s.id),s]));let rows=(h.data||[]).map(row=>{const s=seriesById.get(Number(row.series_id))||{};return h.aggregation==='raw'?{period:abearcWeatherDate(row.timestamp_utc),measurement:abearcWeatherLabel(s.normalized_key,row.measurement),value:row.value,unit:row.unit||s.unit||'',quality:row.quality_status||'',sensor:row.sensor_name||s.sensor_name||''}:{period:row.bucket,measurement:abearcWeatherLabel(s.normalized_key,row.measurement),value:row.value,min:row.min,avg:row.avg,max:row.max,sum:row.sum,count:row.count,unit:row.unit||s.unit||'',completeness:row.completeness};}).map(row=>{const unit=row.unit;return {...row,...Object.fromEntries(['value','min','avg','max','sum'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,weatherDisplayQuantity(row[key],unit,undefined,key==='sum'?row.count??null:1).value])),unit:weatherDisplayUnit(unit)};});const search=String(document.getElementById('abearcWeatherTableSearch')?.value||'').toLowerCase();if(search)rows=rows.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(search)));const key=abearcWeatherTableSort.key,dir=abearcWeatherTableSort.direction;rows.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''),undefined,{numeric:true})*dir);const pages=Math.max(1,Math.ceil(rows.length/ABEARC_WEATHER_TABLE_PAGE_SIZE));abearcWeatherTablePage=Math.min(abearcWeatherTablePage,pages-1);const shown=rows.slice(abearcWeatherTablePage*ABEARC_WEATHER_TABLE_PAGE_SIZE,(abearcWeatherTablePage+1)*ABEARC_WEATHER_TABLE_PAGE_SIZE);const cols=h.aggregation==='raw'?['period','measurement','value','unit','quality','sensor']:['period','measurement','value','min','avg','max','sum','unit','completeness'];el.innerHTML=shown.length?`<table><thead><tr>${cols.map(c=>`<th><button type="button" onclick="sortAbearcWeatherTable('${c}')">${abearcWeatherEsc(c.replace(/_/g,' '))}</button></th>`).join('')}</tr></thead><tbody>${shown.map(r=>`<tr>${cols.map(c=>`<td>${c==='completeness'&&Number.isFinite(Number(r[c]))?`${abearcWeatherNum(r[c],1)}%`:['value','min','avg','max','sum'].includes(c)?abearcWeatherNum(r[c],weatherQuantityDigits(r.unit,1)):abearcWeatherEsc(r[c]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p style="padding:12px">No weather rows match this view.</p>';const meta=document.getElementById('abearcWeatherTableMeta');if(meta)meta.textContent=`${rows.length.toLocaleString()} row(s) · page ${abearcWeatherTablePage+1} of ${pages}${Number.isFinite(Number(h.data_completeness_pct))?` · data completeness ${abearcWeatherNum(h.data_completeness_pct,1)}%`:''}${h.truncated?' · server safety limit reached':''}`;}
window.renderAbearcWeatherTable=renderAbearcWeatherTable;function weatherChangeTablePage(delta){abearcWeatherTablePage=Math.max(0,abearcWeatherTablePage+Number(delta||0));renderAbearcWeatherTable();}window.weatherChangeTablePage=weatherChangeTablePage;function sortAbearcWeatherTable(key){if(abearcWeatherTableSort.key===key)abearcWeatherTableSort.direction*=-1;else abearcWeatherTableSort={key,direction:1};renderAbearcWeatherTable();}window.sortAbearcWeatherTable=sortAbearcWeatherTable;

function renderAbearcWeatherReportMeta(){const s=abearcWeatherStationDetail?.station,h=abearcWeatherHistory,el=document.getElementById('abearcWeatherReportMeta');if(!s||!h||!el)return;el.innerHTML=`<strong>${abearcWeatherEsc(s.display_name)}</strong><br>Coordinates: ${abearcWeatherEsc(`${s.latitude??'—'}, ${s.longitude??'—'}`)} · Elevation: ${abearcWeatherEsc(s.elevation??'—')} ${abearcWeatherEsc(s.elevation_unit||'m')} · Timezone: ${abearcWeatherEsc(s.timezone)}<br>Aggregation: ${abearcWeatherEsc(h.aggregation)} · Source: ZENTRA Cloud via ABEARC local weather cache.`;}

async function abearcWeatherDownload(url,filename){try{const r=await fetch(url,{headers:{Authorization:`Bearer ${authToken}`}});if(!r.ok){let msg='Download failed.';try{msg=(await r.json()).error||msg;}catch(_){}throw new Error(msg);}const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename||'weather-export';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}catch(error){toast(error.message||'Weather download failed.','error');}}
async function downloadAbearcWeatherExport(type){if(!abearcWeatherSelectedStationId||!hasPrivilege('export_weather_data'))return toast('Permission denied: export_weather_data','error');const q=abearcWeatherQueryParams();if(type==='pdf'&&document.querySelector('[data-weather-report-forecast]')?.checked)q.set('include_forecast','1');const ext=type==='pdf'?'pdf':type;const endpoint=type==='pdf'?'report.pdf':`export.${type}`;await abearcWeatherDownload(`${API}/weather/stations/${abearcWeatherSelectedStationId}/${endpoint}?${q}`,type==='pdf'?`farm-weather-advisory-${abearcWeatherSelectedStationId}.pdf`:`weather-${abearcWeatherSelectedStationId}.${ext}`);}
window.downloadAbearcWeatherExport=downloadAbearcWeatherExport;


function abearcWeatherKvHtml(entries){return `<dl class="abearc-weather-kv">${entries.map(([k,v])=>`<dt>${abearcWeatherEsc(k)}</dt><dd>${abearcWeatherEsc(v??'—')}</dd>`).join('')}</dl>`;}
function renderAbearcWeatherSensorInventory(detail){const el=document.getElementById('abearcWeatherSensorInventory');if(!el)return;const ports=Array.isArray(detail?.ports)?detail.ports:[],errors=Array.isArray(detail?.sensor_errors)?detail.sensor_errors:[];if(!ports.length){el.innerHTML='<p class="abearc-weather-empty-inline">No port metadata has been synchronized yet.</p>';return;}el.innerHTML=`<div class="abearc-weather-sensor-list">${ports.map(port=>{const n=port.port_num??'—',name=port.sensor_short_name||port.sensor_name||`Port ${n}`,serial=port.sensor_serial_number||'—',fw=port.sensor_firmware_version||'—',pos=port.position&&typeof port.position==='object'?`${port.position.value??'—'} ${port.position.unit||''}`:(port.position??'—'),faults=errors.filter(e=>String(e.port_num)===String(port.port_num));return `<div class="abearc-weather-sensor-item${faults.length?' has-error':''}"><strong>${abearcWeatherEsc(name)}</strong><span>Port ${abearcWeatherEsc(n)} · S/N ${abearcWeatherEsc(serial)}</span><span>Position ${abearcWeatherEsc(pos)} · FW ${abearcWeatherEsc(fw)}</span>${faults.length?`<em>${faults.map(f=>abearcWeatherEsc(f.description||f.message||`Sensor error ${f.error_code}`)).join(' · ')}</em>`:''}</div>`;}).join('')}</div>`;}
async function loadAbearcWeatherStationAdmin(){const d=abearcWeatherStationDetail;if(!d)return;renderWeatherUnitSettings();updateAbearcWeatherAlertThreshold();renderAbearcWeatherSensorInventory(d);const s=d.station||{},health=abearcWeatherCurrent?.health||s.health||{};const info=document.getElementById('abearcWeatherStationInfo');if(info)info.innerHTML=abearcWeatherKvHtml([['Provider',s.provider_label],['Device ID',s.provider_device_id],['Model',s.model],['Organization',s.organization_name],['Coordinates',`${s.latitude??'—'}, ${s.longitude??'—'}`],['Elevation',`${s.elevation??'—'} ${s.elevation_unit||'m'}`],['Timezone',s.timezone],['Logging interval',s.logging_interval_minutes?`${s.logging_interval_minutes} min`:'—'],['Upload frequency',s.upload_frequency_minutes?`${s.upload_frequency_minutes} min`:'—'],['Firmware',s.firmware_version||'—']]);const h=document.getElementById('abearcWeatherStationHealth');if(h)h.innerHTML=abearcWeatherKvHtml([['Status',health.label],['Last measurement',abearcWeatherDate(s.last_measurement_ts)],['Last successful sync',s.last_successful_sync_at?new Date(s.last_successful_sync_at).toLocaleString():'—'],['Last sync error',s.last_sync_error||'None'],['Sensor errors',(d.sensor_errors||[]).length||'None'],['Initial history',d.sync_state?.initial_backfill_complete?'Caught up':'Synchronizing incrementally']]);
  document.querySelectorAll('[data-weather-manager]').forEach(x=>x.classList.toggle('hidden',!hasPrivilege('manage_weather_stations')));document.querySelectorAll('[data-weather-alert-manager]').forEach(x=>x.classList.toggle('hidden',!hasPrivilege('manage_weather_alerts')));document.querySelectorAll('[data-weather-integration-manager]').forEach(x=>x.classList.toggle('hidden',!hasPrivilege('manage_weather_integration')));
  if(hasPrivilege('manage_weather_stations')){document.getElementById('abearcWeatherDisplayName').value=s.display_name||'';document.getElementById('abearcWeatherTimezone').value=s.timezone||'Asia/Manila';document.getElementById('abearcWeatherSyncInterval').value=s.sync_interval_minutes||15;document.getElementById('abearcWeatherVisible').checked=s.visible!==false;document.getElementById('abearcWeatherEnabled').checked=s.enabled!==false;}
  if(hasPrivilege('manage_weather_alerts'))await loadAbearcWeatherAlerts();if(hasPrivilege('manage_weather_integration'))await loadAbearcWeatherIntegrationStatus();}

async function saveAbearcWeatherStation(event){event?.preventDefault();try{const body={display_name:document.getElementById('abearcWeatherDisplayName')?.value,timezone:document.getElementById('abearcWeatherTimezone')?.value,sync_interval_minutes:Number(document.getElementById('abearcWeatherSyncInterval')?.value),visible:Boolean(document.getElementById('abearcWeatherVisible')?.checked),enabled:Boolean(document.getElementById('abearcWeatherEnabled')?.checked)};const data=await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),silentLoading:true});abearcWeatherStationDetail.station=data.station;renderAbearcWeatherStationHeader();await reloadAbearcWeatherStations();toast('Weather station settings saved.');}catch(error){toast(error.message||'Unable to save weather station settings.','error');}}
window.saveAbearcWeatherStation=saveAbearcWeatherStation;
async function syncAbearcWeatherStation(){try{setAbearcWeatherLoading(true);const result=await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',silentLoading:true});toast(`Weather sync complete: ${Number(result.inserted||0)} new value(s).`);const [d,c]=await Promise.all([fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}`,{silentLoading:true}),fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/current`,{silentLoading:true})]);abearcWeatherStationDetail=d;abearcWeatherCurrent=c;renderAbearcWeatherStationHeader();renderAbearcWeatherCurrent();await reloadAbearcWeatherDashboardData();await reloadAbearcWeatherStations();}catch(error){toast(error.message||'Weather synchronization failed.','error');}finally{setAbearcWeatherLoading(false);}}
window.syncAbearcWeatherStation=syncAbearcWeatherStation;
async function queueAbearcWeatherResync(){const from=document.getElementById('abearcWeatherFrom')?.value,to=document.getElementById('abearcWeatherTo')?.value;if(!from||!to)return toast('Choose the historical date range first.','error');try{await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/resync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start_date:from,end_date:to}),silentLoading:true});toast('Historical weather resynchronization queued.');}catch(error){toast(error.message||'Unable to queue weather resynchronization.','error');}}
window.queueAbearcWeatherResync=queueAbearcWeatherResync;

function abearcWeatherAlertUnit(type,key){return type==='heavy_rainfall'?(key==='rain_rate'?'mm/hr':'mm / 24 h'):({high_temperature:'°C',low_temperature:'°C',strong_wind:'m/s',extended_dry_period:'days',high_vpd:'kPa',low_soil_moisture:'m³/m³'})[type]||'';}
function updateAbearcWeatherAlertThreshold(){
  const type=document.getElementById('abearcWeatherAlertType')?.value,input=document.getElementById('abearcWeatherAlertThreshold');if(!input)return;
  const unit=abearcWeatherAlertUnit(type,type==='heavy_rainfall'?'rain_rate':null);
  input.disabled=!unit;input.required=Boolean(unit);input.placeholder=unit?`Threshold (${unit})`:'Automatic — no threshold';
}
async function loadAbearcWeatherAlerts(){try{const data=await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/alerts`,{silentLoading:true});const el=document.getElementById('abearcWeatherAlertRules');if(el)el.innerHTML=(data.rules||[]).map(r=>`<div class="abearc-weather-alert-rule"><span><strong>${abearcWeatherEsc(r.label||r.alert_type)}</strong> · ${abearcWeatherEsc(r.comparator||'')} ${r.threshold==null?'automatic':abearcWeatherEsc(r.threshold)+' '+abearcWeatherEsc(abearcWeatherAlertUnit(r.alert_type,r.measurement_key))}</span><button type="button" onclick="deleteAbearcWeatherAlert(${Number(r.id)})">Remove</button></div>`).join('')||'<p>No custom alert rules configured.</p>';}catch(error){toast(error.message||'Unable to load weather alerts.','error');}}
async function createAbearcWeatherAlert(event){event?.preventDefault();const type=document.getElementById('abearcWeatherAlertType')?.value,raw=document.getElementById('abearcWeatherAlertThreshold')?.value;const threshold=document.getElementById('abearcWeatherAlertThreshold')?.disabled||raw===''?null:Number(raw);const defaults={heavy_rainfall:'rain_rate',high_temperature:'air_temperature',low_temperature:'air_temperature',strong_wind:'wind_gust',low_soil_moisture:'soil_water_content'};try{await fetchJson(`${API}/weather/stations/${abearcWeatherSelectedStationId}/alerts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({alert_type:type,measurement_key:defaults[type]||null,threshold,label:abearcWeatherLabel(type)}),silentLoading:true});document.getElementById('abearcWeatherAlertThreshold').value='';await loadAbearcWeatherAlerts();toast('Weather alert rule added.');}catch(error){toast(error.message||'Unable to add weather alert.','error');}}
window.createAbearcWeatherAlert=createAbearcWeatherAlert;async function deleteAbearcWeatherAlert(id){try{await fetchJson(`${API}/weather/alerts/${id}`,{method:'DELETE',silentLoading:true});await loadAbearcWeatherAlerts();toast('Weather alert removed.');}catch(error){toast(error.message||'Unable to remove weather alert.','error');}}window.deleteAbearcWeatherAlert=deleteAbearcWeatherAlert;

async function loadAbearcWeatherIntegrationStatus(){try{const data=await fetchJson(`${API}/weather/admin/status`,{silentLoading:true});const el=document.getElementById('abearcWeatherIntegrationStatus');if(el)el.innerHTML=abearcWeatherKvHtml([['API key configured',data.api_key_configured?'Yes':'No'],['Provider',data.provider],['Last discovery',data.last_discovery_at?new Date(data.last_discovery_at).toLocaleString():'Never'],['Discovery error',data.last_discovery_error||'None'],['Scheduler',data.scheduler_running?'Running':'Stopped'],['Stations discovered',data.stations?.length||0]]);}catch(error){toast(error.message||'Unable to load weather integration status.','error');}}
async function discoverAbearcWeatherStations(){try{setAbearcWeatherLoading(true);const data=await fetchJson(`${API}/weather/admin/discover`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',silentLoading:true});toast(`Weather discovery complete: ${data.discovered||0} station(s).`);await reloadAbearcWeatherStations({silent:false});await loadAbearcWeatherIntegrationStatus();}catch(error){toast(error.message||'Weather station discovery failed.','error');}finally{setAbearcWeatherLoading(false);}}
window.discoverAbearcWeatherStations=discoverAbearcWeatherStations;

function exportAbearcWeatherChartPng(){const svg=document.querySelector('#abearcWeatherMainChart svg');if(svg)weatherExportSvg(svg);else toast('No chart to export.','error');}
window.exportAbearcWeatherChartPng=exportAbearcWeatherChartPng;

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('abearcWeatherDashboard')?.classList.contains('hidden'))closeAbearcWeatherDashboard();});
async function loadAbearcWeatherPopupTrend(root,station){
  const chart=root.querySelector('[data-weather-popup-chart]');
  const end=Math.floor(Date.now()/3600000)*3600,start=end-86400;
  try{
    const history=await fetchJson(`${API}/weather/stations/${encodeURIComponent(station.id)}/history?start=${start}&end=${end}&aggregation=hourly`,{silentLoading:true});
    const rows=weatherObservedTimeline({...history,station,data:(history.data||[]).map(row=>row.normalized_key==='precipitation'&&row.completeness!=null&&Number(row.completeness)<100?{...row,value:null}:row)});
    const hours=Array.from({length:24},(_,i)=>rows.find(r=>r.timestamp===start+i*3600)||{timestamp:start+i*3600});
    const rain=hours.map(r=>weatherValue(r.precipitation));
    root.querySelector('[data-weather-popup-rain-total]').textContent=`Last 24h: ${rain.every(v=>v!==null)?abearcWeatherNum(rain.reduce((a,b)=>a+b,0))+' mm':'— (incomplete)'}`;
    const render=key=>{chart.innerHTML=abearcWeatherPopupChart(hours,key,station.timezone||'Asia/Manila');};
    root.querySelectorAll('[data-weather-popup-trend]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelectorAll('[data-weather-popup-trend]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));render(button.dataset.weatherPopupTrend);
    }));render('precipitation');
  }catch(_){chart.innerHTML='<p class="wx-snapshot-empty">Station history is unavailable. Open the dashboard to retry.</p>';}
}
function abearcWeatherPopupChart(hours,key,zone){
  const [label,unit,color]=({precipitation:['Hourly Rainfall','mm','#0789fa'],temperature_2m:['Temperature','°C','#f87919'],relative_humidity_2m:['Humidity','%','#169bac'],wind_speed_10m:['Wind Speed','m/s','#527799']})[key];
  const values=hours.map(r=>weatherValue(r[key]));
  if(values.every(v=>v===null))return '<p class="wx-snapshot-empty">No measurements available for this period.</p>';
  const low=Math.min(0,...values.filter(v=>v!==null)),high=Math.max(1,...values.filter(v=>v!==null));
  const max=high===low?high+1:high*1.15,range=max-low;
  const x=i=>58+i*638/(hours.length-1||1),y=v=>178-(v-low)/range*145;
  const rain=key==='precipitation';
  let total=0,complete=true;
  const cumulative=values.map(value=>{if(value===null)complete=false;if(!complete)return null;total+=value;return total;});
  const totalMax=Math.max(1,total*1.15);
  const grid=Array.from({length:6},(_,i)=>{const py=178-i*29;return `<path d="M48 ${py}H721" stroke="#e7edf3"/><text x="36" y="${py+4}" text-anchor="end">${abearcWeatherNum(low+range*i/5,1)}</text>${rain?`<text x="734" y="${py+4}">${abearcWeatherNum(totalMax*i/5,1)}</text>`:''}`;}).join('');
  let path='',previous=null;
  values.forEach((value,i)=>{if(value!==null)path+=`${previous===null?'M':'L'}${x(i)} ${y(value)} `;previous=value;});
  let marks='';
  if(rain){
    marks=values.map((value,i)=>value===null?'':`<rect x="${x(i)-8}" y="${y(value)}" width="16" height="${Math.max(0,178-y(value))}" fill="${color}" opacity=".45"/>`).join('');
    const sumPath=cumulative.map((value,i)=>value===null?'':`${i===0?'M':'L'}${x(i)} ${178-value/totalMax*145}`).join(' ');
    marks+=`<path data-weather-cumulative d="${sumPath}" fill="none" stroke="#0789fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }else marks=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"/>`+values.map((value,i)=>value===null?'':`<circle cx="${x(i)}" cy="${y(value)}" r="3" fill="${color}"/>`).join('');
  const axis=weatherChartTimeAxis(hours.map(r=>r.timestamp),ts=>x((ts-hours[0].timestamp)/3600),{zone,top:33,bottom:178,labelY:205,centerDates:true});
  return `<svg viewBox="0 0 790 238" role="img" aria-label="24-hour observed ${label} chart in ${unit}"><g font-size="12" fill="#52677e" font-family="inherit">${grid}${axis}<text transform="translate(13 112) rotate(-90)" text-anchor="middle">${label} (${unit})</text>${rain?'<text transform="translate(778 112) rotate(90)" text-anchor="middle">Cumulative (mm)</text>':''}${marks}</g></svg><div class="wx-snapshot-legend"><span class="${rain?'wx-legend-bar':'wx-legend-line'}" style="--legend:${color}">${label} (${unit})</span>${rain?'<span class="wx-legend-line" style="--legend:#0789fa">Cumulative (mm)</span>':''}</div>${values.some(v=>v===null)?'<p class="wx-snapshot-gap">Missing readings appear as gaps; cumulative rain stops at the first gap.</p>':''}`;
}
