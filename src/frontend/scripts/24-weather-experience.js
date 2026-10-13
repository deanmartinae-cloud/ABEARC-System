// Shared presentation for observed series and explicitly labeled modeled forecasts.
const weatherValue = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const weatherPalette = {air_temperature:'#d97745',relative_humidity:'#0891b2',precipitation:'#3688d5',wind_speed:'#637d94',wind_gust:'#925ab5',solar_radiation:'#c38c20'};
let abearcWeatherForecast = null;
let weatherForecastDay = null;
let weatherOpenSequence = 0;
let weatherHistorySequence = 0;
let weatherFocusReturn = null;
let weatherAllHistory = null;
let weatherRecentHistory = null;
let weatherTimelineHistory = null;
let weatherTimelineDays = 3;
let weatherTimelineStep = 3;
let weatherPopup = null;
let weatherLabelMode = localStorage.getItem('abearcWeatherLabelMode') || 'status';
window.abearcWeatherLabelMode = weatherLabelMode;
function setWeatherLabelMode(value){weatherLabelMode=['status','temperature','wind'].includes(value)?value:'status';window.abearcWeatherLabelMode=weatherLabelMode;localStorage.setItem('abearcWeatherLabelMode',weatherLabelMode);document.querySelectorAll('[data-weather-label-mode]').forEach(el=>el.value=weatherLabelMode);renderAbearcWeatherMapSource();}
function weatherStationMapLabel(s){const key=weatherLabelMode==='temperature'?'air_temperature':'wind_speed';const r=s.current?.find(v=>v.normalized_key===key);return s.display_name+(weatherLabelMode==='status'?'':r?'\n'+abearcWeatherNum(r.value)+' '+r.unit:'\nNo measurement');}
function weatherStationConditionSymbol(kind){
  const code=({sun:0,partly:2,cloud:3,'light-rain':61,rain:63,'heavy-rain':65,'night-clear':0,'night-partly':2,storm:95})[kind]??null;
  return weatherConditionSymbol({weather_code:code,is_day:kind?.startsWith('night-')?0:1});
}
function renderWeatherStationList(){document.querySelectorAll('[data-weather-stations-list]').forEach(el=>el.innerHTML=abearcWeatherStationsCache.length?abearcWeatherStationsCache.map(s=>`<button type="button" onclick="focusWeatherStation(${Number(s.id)})"><span class="wx-drawer-condition" aria-hidden="true">${weatherStationConditionSymbol(weatherStationCondition(s).icon)}</span><span><strong>${abearcWeatherEsc(s.display_name)}</strong><small>${abearcWeatherEsc(weatherStationCondition(s).label)} · ${abearcWeatherEsc(s.health?.label||'Unknown')} · ${abearcWeatherEsc(abearcWeatherAgo(s.last_measurement_ts))}</small></span></button>`).join(''):'<p>No visible weather stations found.</p>');}
async function loadWeatherDrawerAdmin() {
  const region=document.querySelector('[data-weather-admin-setup]');
  if(!region)return;
  const allowed=hasPrivilege('manage_weather_integration');
  region.classList.toggle('hidden',!allowed);
  if(!allowed)return;
  const status=document.getElementById('weatherDrawerApiStatus');
  try {const result=await fetchJson(`${API}/weather/admin/credentials`,{silentLoading:true});
    status.textContent=result.configured?'API token configured on server. Devices can be discovered.':'No API token configured. Enter a token to add weather stations.';
  }catch(e){status.textContent='Unable to load credential status.';}
}
async function saveWeatherApiCredential(event) {
  event.preventDefault();if(!hasPrivilege('manage_weather_integration'))return;
  const input=document.getElementById('weatherDrawerApiKey');
  const status=document.getElementById('weatherDrawerApiStatus');
  const key=input?.value?.trim();if(!key)return;
  status.textContent='Validating API token and discovering stations…';
  try {const result=await fetchJson(`${API}/weather/admin/credentials`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key}),silentLoading:true});
    input.value='';status.textContent=result.warning?`Saved; discovery: ${result.warning}`:`Token saved. ${result.discovered} station(s) discovered.`;
    await reloadAbearcWeatherStations({silent:false});
    toast('Weather integration updated.');
  }catch(e){status.textContent=e.message||'Unable to save API token.';toast(status.textContent,'error');}
}
async function discoverWeatherDrawerStations() {
  if(!hasPrivilege('manage_weather_integration'))return;
  const status=document.getElementById('weatherDrawerApiStatus');
  status.textContent='Discovering weather stations…';
  try {const data=await fetchJson(`${API}/weather/admin/discover`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',silentLoading:true});
    status.textContent=`Discovered ${data.discovered||0} station(s).`;
    await reloadAbearcWeatherStations({silent:false});
  }catch(e){status.textContent=e.message||'Station discovery failed.';}
}
async function removeWeatherApiCredential() {
  if(!hasPrivilege('manage_weather_integration'))return;
  if(!await confirmModalChoice('Remove the saved ZENTRA API token? Automatic station synchronization will stop unless a server environment key exists.',{title:'Remove saved API token',confirmText:'Remove token'}))return;
  try {await fetchJson(`${API}/weather/admin/credentials`,{method:'DELETE',silentLoading:true});
    document.getElementById('weatherDrawerApiStatus').textContent='Stored token removed.';
    document.getElementById('weatherDrawerApiKey').value='';
  }catch(e){toast(e.message||'Unable to remove token.','error');}
}
function openWeatherIntegrationModal(){
  if(!hasPrivilege('manage_weather_integration'))return;
  document.getElementById('weatherIntegrationModal').classList.remove('hidden');
  loadWeatherDrawerAdmin();
  document.getElementById('weatherDrawerApiKey').focus();
}
function closeWeatherIntegrationModal(){
  closeModal('weatherIntegrationModal');
  document.getElementById('weatherDrawerApiKey').value='';
  document.querySelector('[data-weather-integration-gear]')?.focus();
}
function toggleWeatherStationsDrawer(force){if(!hasPrivilege('view_weather_stations'))return false;const el=document.querySelector('[data-weather-stations-drawer]');if(!el)return false;const open=typeof force==='boolean'?force:el.classList.contains('hidden');const resultsPanel=document.querySelector('[data-map-results-panel]');if(open){window.toggleAbearcOrthomosaicDrawer?.(false);window.toggleAbearcMapLayoutsDrawer?.(false);window.toggleAbearcRamPumpDrawer?.(false);window.toggleAbearcMapFilters?.(false);window.toggleAbearcMapLayerMenu?.(false);window.toggleAbearcQuickLayers?.(false);reloadAbearcWeatherStations();document.querySelector('[data-weather-integration-gear]')?.classList.toggle('hidden',!hasPrivilege('manage_weather_integration'));}el.classList.toggle('hidden',!open);if(open)resultsPanel?.classList.add('hidden');document.querySelectorAll('[data-weather-stations-rail]').forEach(b=>{b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-pressed',String(open));b.classList.toggle('is-active',open);});window.syncAbearcMapRail?.();window.animateAbearcMapResize?.();renderWeatherStationList();return open;}
function focusWeatherStation(id){const s=abearcWeatherStationsCache.find(v=>Number(v.id)===Number(id));if(!s||!abearcMap)return;if(s.longitude==null||s.latitude==null||!Number.isFinite(Number(s.longitude))||!Number.isFinite(Number(s.latitude)))return toast('Station coordinates are unavailable.','error');setAbearcWeatherStationsVisible(true,{reload:false});toggleWeatherStationsDrawer(false);openAbearcWeatherMapPopup(s.id,[Number(s.longitude),Number(s.latitude)]);}

function weatherIcon(kind='cloud') {
  const paths={'light-rain':'<path d="M5 15a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1A4 4 0 0 1 19 15M12 16c-7 8 7 8 0 0Z"/>','heavy-rain':'<path d="M5 14a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1A4 4 0 0 1 19 14M5 16c-6 7 6 7 0 0Zm7-2c-6 7 6 7 0 0Zm7 2c-6 7 6 7 0 0Z"/>','night-clear':'<path d="M14 2a9 9 0 1 0 8 12A9 9 0 0 1 14 2Z"/>','night-partly':'<path d="M15 2a6 6 0 0 0 6 8 6 6 0 0 1-5 4M6 21a4 4 0 0 1-1-7.9 6 6 0 0 1 11.7-1.4A4.7 4.7 0 1 1 18 21Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',cloud:'<path d="M6 18a4 4 0 0 1-1-7.9 6 6 0 0 1 11.7-1.4A4.7 4.7 0 1 1 18 18Z"/>',rain:'<path d="M5 15a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1A4 4 0 0 1 19 15M7 18l-1 3m7-3-1 3m7-3-1 3"/>',storm:'<path d="M5 14a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1A4 4 0 0 1 19 14M12 12l-4 6h5l-2 5 6-8h-5"/>',fog:'<path d="M5 12a3 3 0 0 1 0-6 5 5 0 0 1 9 0 3 3 0 0 1 4 6M3 16h18M5 20h14"/>',wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3"/>',temperature:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 7v10"/><circle cx="12" cy="18" r="1"/>',drop:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',station:'<path d="M12 8v13M7 21h10M5 7h14M12 7l4-4M12 7 8 3M5 7l-2 2m16-2 2 2M7 13h10v4H7Z"/><circle cx="12" cy="7" r="2"/>',leaf:'<path d="M20 3C8 2 2 8 5 15s14 7 15-12ZM4 21 16 8"/>'};
  return `<svg class="wx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]||paths.cloud}</svg>`;
}
function weatherCondition(code){if(code==null)return {icon:'cloud',label:'Conditions unavailable'};if(code===0)return {icon:'sun',label:'Clear'};if(code<=3)return {icon:'cloud',label:code<3?'Partly cloudy':'Overcast'};if(code<50)return {icon:'fog',label:'Fog'};if(code>=95)return {icon:'storm',label:'Thunderstorms'};return {icon:'rain',label:code>=80?'Rain showers':'Rain'};}
// NOAA solar position approximation and Haurwitz clear-sky GHI (pvlib.clearsky.haurwitz).
function weatherClearSky(ts,station){
  const lat=weatherValue(station?.latitude),lon=weatherValue(station?.longitude);if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||weatherValue(ts)===null)return null;
  const d=new Date(ts*1000),year=d.getUTCFullYear(),day=(Date.UTC(year,d.getUTCMonth(),d.getUTCDate())-Date.UTC(year,0,0))/86400000,hour=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
  const leap=new Date(Date.UTC(year,1,29)).getUTCMonth()===1,g=2*Math.PI/(leap?366:365)*(day-1+(hour-12)/24),rad=Math.PI/180;
  const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const angle=((hour*60+eq+4*lon)%1440/4-180)*rad,cos=Math.sin(lat*rad)*Math.sin(dec)+Math.cos(lat*rad)*Math.cos(dec)*Math.cos(angle);
  return {is_day:cos>0?1:0,ghi:cos>0?1098*cos*Math.exp(-.059/cos):0};
}
// shortcut: solar cloud bands are indicative, calibrate against local cloud observations.
const weatherCloudThresholds={clear:.8,partly:.45,minGhi:150};
function weatherObservedCondition(row,station=abearcWeatherStationDetail?.station){
  const sky=weatherClearSky(row.cloud_timestamp??row.condition_timestamp??row.timestamp,station),rain=weatherValue(row.precipitation)>0||weatherValue(row.rain_rate)>0,lightning=weatherValue(row.lightning_count)>0;
  const base={is_day:sky?.is_day,estimated:true};
  if(lightning)return {...base,icon:'storm',weather_code:95,label:`Estimated from station readings: lightning detected${weatherValue(row.lightning_distance)!==null?' ('+abearcWeatherNum(row.lightning_distance)+' km)':''}${rain?' with rain':''}`};
  if(rain){
    const measuredRate=weatherValue(row.rain_rate),interval=weatherValue(row.interval_minutes);
    const rate=measuredRate>0?measuredRate:interval>0&&weatherValue(row.precipitation)>0?Number(row.precipitation)*60/interval:null;
    // PAGASA hourly intensity: https://www.pagasa.dost.gov.ph/information/weather-terminologies
    const icon=rate===null?'rain':rate<=2.5?'light-rain':rate<=7.5?'rain':'heavy-rain';
    const label=icon==='light-rain'?'light rain':icon==='heavy-rain'?'heavy rain':'rain';
    return {...base,icon,weather_code:icon==='light-rain'?61:icon==='heavy-rain'?65:63,label:rate===null?'Station rain recorded; intensity unavailable':
      `Estimated from station readings: ${label} (${rate.toFixed(1)} mm/h${measuredRate>0?', measured rate':', logging-interval average'})`};
  }
  const cloud=weatherValue(row.cloud_cover);
  if(cloud!==null&&cloud>=0&&cloud<=100&&sky){
    const clear=cloud<30,partly=cloud<=70,night=sky.is_day===0;
    const icon=clear?(night?'night-clear':'sun'):partly?(night?'night-partly':'partly'):'cloud';
    return {...base,icon,weather_code:clear?0:partly?2:3,label:`Station cloud cover: ${cloud.toFixed(0)}% · ${clear?'clear':partly?'partly cloudy':'cloudy / overcast'}${night?' at night':''}`};
  }
  const solar=weatherValue(row.shortwave_radiation);
  if(!sky||sky.ghi<weatherCloudThresholds.minGhi||solar===null||solar<0)return {...base,icon:'unknown',weather_code:null,label:'Cloud condition unknown: nighttime, low sun or missing solar radiation'};
  const ratio=solar/sky.ghi,code=ratio>=weatherCloudThresholds.clear?0:ratio>=weatherCloudThresholds.partly?2:3;
  return {...base,icon:code===0?'sun':code===2?'partly':'cloud',weather_code:code,label:`Estimated from station readings: ${code===0?'likely clear':code===2?'partly cloudy':'cloudy'} (clear-sky index ${ratio.toFixed(2)})`};
}
function weatherStationCondition(station){
  const row={timestamp:station.last_measurement_ts},now=Date.now()/1000,limit=Math.max(3600,Number(station.logging_interval_minutes||15)*120);
  const keys={precipitation:'precipitation',rain_rate:'rain_rate',cloud_cover:'cloud_cover',other_cloud_cover:'cloud_cover',solar_radiation:'shortwave_radiation',lightning_count:'lightning_count',other_lightning_activity:'lightning_count',lightning_distance:'lightning_distance'};
  const timestamps={};
  for(const r of station.current||[]){
    const key=keys[r.normalized_key],value=weatherValue(r.value),ts=weatherValue(r.timestamp_utc);
    if(!key||value===null||value<0||r.quality_status&&r.quality_status!=='valid'||ts===null||now-ts>limit||ts>now+300||ts<(timestamps[key]??-Infinity))continue;
    if(/^(min|max)\b/i.test(r.measurement||''))continue;
    if(key==='precipitation'&&(r.unit!=='mm'||/cumulative|daily|today|since|total/i.test(r.measurement||'')))continue;
    if(key==='rain_rate'&&!/^mm\s*\/\s*(h|hr|hour)$/i.test(r.unit||''))continue;
    if(key==='cloud_cover'&&(r.unit!=='%'||value>100))continue;
    if(key==='shortwave_radiation'&&!/^W\s*\/\s*m(?:²|2|\^2)$/i.test(r.unit||''))continue;
    row[key]=value;timestamps[key]=ts;
    if(key==='shortwave_radiation')row.condition_timestamp=ts;
    if(key==='cloud_cover')row.cloud_timestamp=ts;
    if(key==='precipitation')row.interval_minutes=weatherValue(station.logging_interval_minutes);
  }
  const observed=weatherObservedCondition(row,station);
  if(observed.icon!=='unknown'||weatherClearSky(now,station)?.is_day!==0)return observed;
  const forecast=station.night_forecast,age=Date.now()-Date.parse(forecast?.fetched_at);
  if(!forecast||forecast.stale||!Number.isFinite(age)||age<0||age>3600000)return observed;
  const hour=(forecast.hourly||[]).find(h=>h.timestamp<=now&&now<h.timestamp+3600);
  if(!hour)return observed;
  const code=weatherValue(hour.weather_code),cover=weatherValue(hour.cloud_cover);
  let rainIcon=null;
  if(row.lightning_count===undefined&&[95,96,99].includes(code))rainIcon='storm';
  else if(row.precipitation===undefined&&row.rain_rate===undefined)rainIcon=({51:'light-rain',53:'light-rain',55:'rain',61:'light-rain',63:'rain',65:'heavy-rain',80:'light-rain',81:'rain',82:'heavy-rain'})[code];
  if(rainIcon)return {icon:rainIcon,is_day:0,estimated:true,source:'forecast',weather_code:code,label:weatherMapConditionTitle(rainIcon)};
  const skyIcon=cover!==null&&cover>=0&&cover<=100?(cover<30?'night-clear':cover<=70?'night-partly':'cloud'):code===0?'night-clear':[1,2].includes(code)?'night-partly':code===3?'cloud':null;
  if(!skyIcon)return observed;
  return {icon:skyIcon,is_day:0,estimated:true,source:'forecast',weather_code:code,label:skyIcon==='night-clear'?'Clear sky at night':skyIcon==='night-partly'?'Partly cloudy at night':'Cloudy / overcast'};
}
async function loadWeatherMapNightForecasts(stations){
  await Promise.allSettled(stations.filter(station=>weatherStationCondition(station).icon==='unknown'&&weatherClearSky(Date.now()/1000,station)?.is_day===0).map(async station=>{
    station.night_forecast=await fetchJson(`${API}/weather/stations/${Number(station.id)}/forecast`,{silentLoading:true});
    if(!abearcWeatherStationsCache.includes(station))return;
    renderAbearcWeatherMapSource();renderWeatherStationList();
    const root=document.querySelector(`[data-weather-popup-station="${Number(station.id)}"]`);
    if(root){const condition=weatherStationCondition(station);root.querySelector('[data-weather-popup-condition-title]').textContent=weatherMapConditionTitle(condition.icon);root.querySelector('.wx-snapshot-condition-icon').innerHTML=weatherStationConditionSymbol(condition.icon);root.querySelector('[data-weather-popup-condition-note]').textContent=condition.label;}
  }));
}
function weatherMapConditionTitle(icon){return ({sun:'Sunny',partly:'Partly Cloudy',cloud:'Cloudy / Overcast','light-rain':'Light Rain',rain:'Rain','heavy-rain':'Heavy Rain','night-clear':'Clear Night','night-partly':'Partly Cloudy Night',storm:'Thunderstorms'})[icon]||'Condition Unknown';}

function weatherConditionSymbol(row){
  const c=weatherCondition(row.weather_code);if(row.weather_code==null)return weatherIcon('cloud');
  const moon='<path d="M14 2a8 8 0 1 0 7 11 7 7 0 0 1-7-11Z" fill="#c6ccdf"/>';
  if(row.weather_code<=2){const sky=row.is_day===0?moon:'<circle cx="9" cy="8" r="5" fill="#edb723"/><path d="M9 0v2M1 8h2m12 0h2M3 2l2 2m8 0 2-2M9 14v2M3 14l2-2m8 0 2 2" stroke="#edb723" stroke-width="1.6"/>';return `<svg class="wx-icon" viewBox="0 0 24 24" aria-hidden="true">${sky}${row.weather_code>0?'<path d="M7 21a4 4 0 0 1 0-8 5 5 0 0 1 9-1 4.5 4.5 0 1 1 2 9Z" fill="#9fa8b1"/>':''}</svg>`;}
  return `<span class="wx-condition-${c.icon}">${weatherIcon(c.icon)}</span>`;
}
function weatherLocalTime(ts,options={}) {return Number.isFinite(Number(ts))?new Date(Number(ts)*1000).toLocaleString('en-PH',{timeZone:abearcWeatherStationDetail?.station?.timezone||'Asia/Manila',...options}):'—';}
function weatherEmpty(message){return `<div class="wx-empty">${weatherIcon('station')}<p>${abearcWeatherEsc(message)}</p></div>`;}
function weatherMetric(label,value,unit='',note='',icon='drop'){return `<article class="abearc-weather-card"><small>${weatherIcon(icon)}${abearcWeatherEsc(label)}</small><strong>${weatherQuantityNumber(value,unit,1)} <span>${abearcWeatherEsc(weatherDisplayUnit(unit))}</span></strong><span>${abearcWeatherEsc(note)}</span></article>`;}

function weatherGroupPoints(history, filterKey=null){
  if(!history)return [];
  const series=new Map((history.series||[]).map(s=>[Number(s.id),s])), groups=new Map();
  for(const row of history.data||[]){const sid=Number(row.series_id),s=series.get(sid)||{};if(filterKey&&(s.normalized_key!==filterKey||(filterKey==='precipitation'&&s.unit!=='mm')))continue;
    if(!groups.has(sid))groups.set(sid,{series:s,expectedGap:({raw:Number(abearcWeatherStationDetail?.station?.logging_interval_minutes||15)*60,hourly:3600,daily:86400,weekly:604800,monthly:31*86400,yearly:366*86400})[history.aggregation],points:[]});
    const bucket=String(row.bucket||'');
    const week=bucket.match(/^(\d{4})-W(\d{2})$/);let x;
    if(week){const jan4=new Date(Date.UTC(Number(week[1]),0,4));x=(jan4.getTime()-((jan4.getUTCDay()||7)-1)*86400000+(Number(week[2])-1)*604800000)/1000;}
    else x=history.aggregation==='raw'?Number(row.timestamp_utc):Date.parse(bucket.length===4?bucket+'-01-01':bucket.length===7?bucket+'-01':bucket)/1000;
    groups.get(sid).points.push({x,y:row.quality_status&&row.quality_status!=='valid'?null:weatherValue(row.value),min:weatherValue(row.min),max:weatherValue(row.max),avg:weatherValue(row.avg),completeness:weatherValue(row.completeness),label:history.aggregation==='raw'?weatherLocalTime(row.timestamp_utc):bucket,quality:row.quality_status||'valid'});
  }
  return [...groups.values()].map(g=>({...g,points:g.points.sort((a,b)=>a.x-b.x)}));
}

function weatherChartTimeAxis(times,x,{zone=abearcWeatherStationDetail?.station?.timezone||'Asia/Manila',top=24,bottom=205,labelY=228,centerDates=false}={}){
  const stamps=[...new Set(times.filter(Number.isFinite))].sort((a,b)=>a-b);
  const date=ts=>new Date(ts*1000).toLocaleDateString('en-US',{timeZone:zone,year:'numeric',month:'short',day:'numeric'});
  const short=stamps.at(-1)-stamps[0]<=7*86400;
  const count=Math.min(7,stamps.length),indices=[...new Set(Array.from({length:count},(_,i)=>Math.round(i*(stamps.length-1)/(count-1||1))))];
  const separators=stamps.slice(1).filter((ts,i)=>date(ts)!==date(stamps[i])).map(ts=>`<line data-weather-date-boundary x1="${x(ts)}" x2="${x(ts)}" y1="${top}" y2="${bottom}" stroke="currentColor" opacity=".25" stroke-dasharray="3 4"/>`).join('');
  const ticks=indices.map((index,i)=>{const ts=stamps[index],time=new Date(ts*1000).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}),day=new Date(ts*1000).toLocaleDateString('en-US',{timeZone:zone,month:'short',day:'numeric',...(short?{}:{year:'numeric'})});return `<text data-weather-time-tick x="${x(ts)}" y="${labelY}" text-anchor="${i===0?'start':i===indices.length-1?'end':'middle'}" fill="currentColor" opacity=".7" font-size="11"><tspan x="${x(ts)}">${abearcWeatherEsc(short?time:day)}</tspan>${short&&!centerDates?`<tspan x="${x(ts)}" dy="15">${abearcWeatherEsc(day)}</tspan>`:''}</text>`;}).join('');
  const dates=[];
  if(centerDates&&short)stamps.forEach((ts,i)=>{
    if(i>0&&date(ts)===date(stamps[i-1]))return;
    const next=stamps.slice(i+1).find(value=>date(value)!==date(ts))??stamps.at(-1);
    const label=new Date(ts*1000).toLocaleDateString('en-US',{timeZone:zone,month:'short',day:'numeric'});
    dates.push(`<text data-weather-date-label x="${(x(ts)+x(next))/2}" y="${labelY+15}" text-anchor="middle" fill="currentColor" opacity=".7" font-size="11">${abearcWeatherEsc(label)}</text>`);
  });
  return separators+ticks+dates.join('');
}
function weatherChart(group,{bars=false,start=null,end=null}={}){
  group=weatherDisplayChart(group);
  const all=group.points.filter(p=>(start===null||p.x>=start)&&(end===null||p.x<=end)),valid=all.filter(p=>p.y!==null&&Number.isFinite(p.x));
  if(!valid.length)return weatherEmpty(`No ${abearcWeatherLabel(group.series.normalized_key,group.series.measurement).toLowerCase()} data was recorded for this period.`);
  const w=960,h=260,p={l:54,r:26,t:24,b:55},color=group.color||weatherPalette[group.series.normalized_key]||'#248a80';
  const values=valid.flatMap(v=>[v.y,v.min,v.max].filter(n=>n!==null&&Number.isFinite(n)));
  let lo=bars?0:Math.min(...values),hi=Math.max(...values);if(lo===hi){if(bars)hi=1;else{lo-=1;hi+=1;}}if(!bars){const pad=(hi-lo)*.1;lo-=pad;hi+=pad;}else hi=Math.max(1,hi*1.15);
  const times=all.map(v=>v.x).filter(Number.isFinite),t0=Math.min(...times),t1=Math.max(...times),span=t1-t0||1;
  const x=t=>p.l+10+(t-t0)/span*(w-p.l-p.r-20),y=v=>p.t+(hi-v)/(hi-lo)*(h-p.t-p.b);
  const diffs=times.slice(1).map((t,i)=>t-times[i]).filter(n=>n>0).sort((a,b)=>a-b),gap=group.expectedGap||diffs[Math.floor(diffs.length/2)]||3600;
  const path=key=>{let d='',last=null;all.forEach(v=>{const a=weatherValue(v[key]);if(a===null||!Number.isFinite(v.x)){last=null;return;}d+=`${last===null||v.x-last>gap*1.6?'M':'L'}${x(v.x).toFixed(1)},${y(a).toFixed(1)} `;last=v.x;});return d;};
  const useBars=bars||group.series.normalized_key==='precipitation';
  const stats=!useBars&&valid.some(v=>v.min!==null&&v.max!==null);
  const grid=[0,.25,.5,.75,1].map(f=>{const a=p.t+f*(h-p.t-p.b);return `<line x1="${p.l}" x2="${w-p.r}" y1="${a}" y2="${a}" stroke="currentColor" opacity=".1"/><text x="${p.l-9}" y="${a+4}" text-anchor="end" fill="currentColor" font-size="11" opacity=".65">${abearcWeatherNum(hi-f*(hi-lo),1)}</text>`;}).join('');
  const bw=Math.max(1,Math.min(24,(w-p.l-p.r)*gap/span*.65));
  const attr=v=>`data-weather-chart-point data-label="${abearcWeatherEsc(v.label)}" data-value="${abearcWeatherNum(v.y,2)}" data-unit="${abearcWeatherEsc(group.series.unit||'')}" data-summary="${stats?abearcWeatherEsc(`Min ${abearcWeatherNum(v.min)} · Avg ${abearcWeatherNum(v.avg)} · Max ${abearcWeatherNum(v.max)}`):''}"`;
  const marks=useBars?valid.map(v=>`<rect ${attr(v)} x="${x(v.x)-bw/2}" y="${y(v.y)}" width="${bw}" height="${Math.max(1,y(0)-y(v.y))}" rx="2" fill="${color}" opacity=".85"/>`).join(''):`${group.area?`<path d="${path('y')} L${x(valid.at(-1).x)},${y(lo)} L${x(valid[0].x)},${y(lo)} Z" fill="${color}" opacity=".14"/>`:''}${stats?`<path d="${path('max')}" stroke="${color}" opacity=".4" fill="none" stroke-dasharray="4 3"/><path d="${path('min')}" stroke="${color}" opacity=".4" fill="none" stroke-dasharray="4 3"/>`:''}<path d="${path('y')}" stroke="${color}" stroke-width="2.3" fill="none" ${group.forecast?'stroke-dasharray="6 4"':''}/>${valid.map(v=>`<circle ${attr(v)} cx="${x(v.x)}" cy="${y(v.y)}" r="7" fill="${color}" fill-opacity=".01"><title>${abearcWeatherEsc(v.label)}: ${abearcWeatherNum(v.y,2)} ${abearcWeatherEsc(group.series.unit)}</title></circle>`).join('')}`;
  const ticks=weatherChartTimeAxis(times,x,{centerDates:true});
  return `<section class="abearc-weather-chart-series" data-weather-chart-series data-chart-group="${abearcWeatherEsc(JSON.stringify(group))}" data-chart-bars="${bars}"><header><div><strong>${abearcWeatherEsc(group.series.measurement||abearcWeatherLabel(group.series.normalized_key))}</strong><span>${abearcWeatherEsc(group.series.unit||'')} ${stats?' · Min / average / max':''} ${group.forecast?' · FORECAST':' · OBSERVED'}</span></div><div class="abearc-weather-chart-zoom"><button type="button" data-weather-chart-fit title="Reset zoom">Reset</button><button type="button" data-weather-chart-detail title="Zoom into the time range">Zoom +</button><button type="button" data-wx-out title="Zoom out">−</button><button type="button" data-wx-pan="-1" aria-label="Earlier time range">←</button><button type="button" data-wx-pan="1" aria-label="Later time range">→</button><button type="button" data-wx-export title="Export this chart as PNG">PNG</button></div></header><div class="abearc-weather-chart-scroll" data-weather-chart-scroll tabindex="0" aria-label="Chart. Use left and right arrow keys or drag to pan after zooming."><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${abearcWeatherEsc(group.series.measurement)}">${grid}${marks}${ticks}<line data-wx-crosshair y1="24" y2="205" stroke="currentColor" opacity=".3" visibility="hidden"/></svg></div><div class="abearc-weather-chart-tooltip" data-weather-chart-tooltip hidden></div></section>`;
}
function weatherCombinedChart(groups){
  groups=(groups||[]).map(weatherDisplayChart);
  const chosen=(groups||[]).filter(g=>g?.points?.some(p=>p.y!==null&&Number.isFinite(p.x)));if(!chosen.length)return weatherEmpty('No recent weather data was recorded.');
  const w=960,h=300,p={l:58,r:88,t:34,b:58},top=p.t,bottom=h-p.b,allTimes=[...new Set(chosen.flatMap(g=>g.points.map(v=>v.x)).filter(Number.isFinite))].sort((a,b)=>a-b),t0=allTimes[0],t1=allTimes.at(-1),span=t1-t0||1,x=t=>p.l+(t-t0)/span*(w-p.l-p.r);
  const temp=chosen.find(g=>g.series.normalized_key==='air_temperature')||chosen.find(g=>g.series.normalized_key!=='precipitation'&&g.series.normalized_key!=='solar_radiation'),solar=chosen.find(g=>g.series.normalized_key==='solar_radiation'),rain=chosen.find(g=>g.series.normalized_key==='precipitation');
  const extent=g=>{const values=(g?.points||[]).map(v=>weatherValue(v.y)).filter(Number.isFinite);if(!values.length)return [0,1];let lo=Math.min(...values),hi=Math.max(...values);if(lo===hi){lo-=1;hi+=1;}const pad=(hi-lo)*.1;return [lo-pad,hi+pad];};
  const tempRange=extent(temp),solarValues=(solar?.points||[]).map(v=>weatherValue(v.y)).filter(Number.isFinite),solarHi=Math.max(1,...solarValues)*1.1,rainValues=(rain?.points||[]).map(v=>weatherValue(v.y)).filter(Number.isFinite),rainHi=Math.max(1,...rainValues)*1.15;
  const yLeft=v=>top+(tempRange[1]-v)/(tempRange[1]-tempRange[0])*(bottom-top),ySolar=v=>bottom-(v/solarHi)*(bottom-top),yRain=v=>bottom-(v/rainHi)*(bottom-top),path=(g,y)=>{let d='',last=null;g?.points.forEach(v=>{const a=weatherValue(v.y);if(a===null||!Number.isFinite(v.x)){last=null;return;}d+=`${last===null||v.x-last>(g.expectedGap||3600)*1.6?'M':'L'}${x(v.x).toFixed(1)},${y(a).toFixed(1)} `;last=v.x;});return d;};
  const grid=[0,.25,.5,.75,1].map(f=>{const yy=top+f*(bottom-top);return `<line x1="${p.l}" x2="${w-p.r}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".1"/><text x="${p.l-9}" y="${yy+4}" text-anchor="end" fill="${weatherPalette.air_temperature}" font-size="11" opacity=".8">${abearcWeatherNum(tempRange[1]-f*(tempRange[1]-tempRange[0]),1)}</text>`;}).join('');
  const rainMarks=rain?(rain.points||[]).filter(v=>weatherValue(v.y)>0&&Number.isFinite(v.x)).map(v=>`<rect x="${x(v.x)-4}" y="${yRain(v.y)}" width="8" height="${Math.max(1,bottom-yRain(v.y))}" rx="2" fill="${weatherPalette.precipitation}" opacity=".82"><title>${abearcWeatherEsc(v.label)}: ${abearcWeatherNum(v.y,2)} ${abearcWeatherEsc(rain.series.unit||'mm')}</title></rect>`).join(''):'';
  const solarPath=path(solar,ySolar),solarArea=solarPath&&solar?`<path d="${solarPath} L${x(solar.points.at(-1).x)},${bottom} L${x(solar.points[0].x)},${bottom} Z" fill="${weatherPalette.solar_radiation}" opacity=".14"/>`:'';
  const lines=[temp?`<path d="${path(temp,yLeft)}" stroke="${weatherPalette.air_temperature}" stroke-width="2.5" fill="none"/>`: '',solar?solarArea:''].join('');
  const rainLabels=rain?[0,.5,1].map(f=>`<text x="${w-p.r+8}" y="${bottom-f*(bottom-top)+4}" fill="${weatherPalette.precipitation}" font-size="11" opacity=".8">${abearcWeatherNum(rainHi*f,1)}</text>`).join(''):'';
  const solarLabels=solar?[0,.5,1].map(f=>`<text x="${w-8}" y="${bottom-f*(bottom-top)+4}" text-anchor="end" fill="${weatherPalette.solar_radiation}" font-size="11" opacity=".8">${abearcWeatherNum(solarHi*f,0)}</text>`).join(''):'';
  const rightLabels=rainLabels+solarLabels;
  const ticks=weatherChartTimeAxis(allTimes,x,{top,bottom,labelY:bottom+24,centerDates:true});
  const legend=chosen.map(g=>{const key=g.series.normalized_key,color=weatherPalette[key]||'#248a80',kind=key==='precipitation'?'bar':'line';return `<span class="wx-combined-legend-item"><i class="wx-combined-legend-${kind}" style="--legend:${color}"></i>${abearcWeatherEsc(g.series.measurement||abearcWeatherLabel(key))} (${abearcWeatherEsc(g.series.unit||'')})</span>`;}).join('');
  return `<section class="abearc-weather-chart-series wx-combined-chart"><div class="abearc-weather-chart-scroll" data-weather-chart-scroll><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Weather at a glance">${grid}${rainMarks}${lines}${rightLabels}${ticks}<text x="${p.l-9}" y="18" text-anchor="end" fill="${weatherPalette.air_temperature}" font-size="11" opacity=".8">${temp?abearcWeatherEsc(temp.series.unit||''):''}</text>${rain?`<text x="${w-p.r+8}" y="18" fill="${weatherPalette.precipitation}" font-size="11" opacity=".7">${abearcWeatherEsc(rain.series.unit||'mm')}</text>`:''}${solar?`<text x="${w-8}" y="18" text-anchor="end" fill="${weatherPalette.solar_radiation}" font-size="11" opacity=".7">${abearcWeatherEsc(solar.series.unit||'')}</text>`:''}</svg></div><div class="wx-combined-legend">${legend}</div></section>`;
}
function weatherChartInteractions(root){root?.querySelectorAll('[data-weather-chart-series]').forEach(section=>{
  const group=JSON.parse(section.dataset.chartGroup),bars=section.dataset.chartBars==='true',points=group.points.filter(p=>Number.isFinite(p.x));
  const first=Math.min(...points.map(p=>p.x)),last=Math.max(...points.map(p=>p.x));let start=first,end=last;
  const change=(factor=1,pan=0)=>{const next=weatherChartWindow(points,start,end,factor,pan);start=next.start;end=next.end;const holder=document.createElement('div');holder.innerHTML=weatherChart(group,{bars,start,end});section.innerHTML=holder.firstElementChild.innerHTML;bind();};
  const bind=()=>{
    const scroll=section.querySelector('[data-weather-chart-scroll]'),svg=scroll?.querySelector('svg'),tip=section.querySelector('[data-weather-chart-tooltip]');if(!svg)return;
    section.querySelector('[data-weather-chart-fit]').onclick=()=>{start=first;end=last;change();};
    section.querySelector('[data-weather-chart-detail]').onclick=()=>change(.5);
    section.querySelector('[data-wx-out]').onclick=()=>change(2);
    section.querySelectorAll('[data-wx-pan]').forEach(b=>b.onclick=()=>change(1,Number(b.dataset.wxPan)*.5));
    section.querySelector('[data-wx-export]').onclick=()=>weatherExportSvg(svg);
    scroll.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();change(1,e.key==='ArrowLeft'?-.5:.5);section.querySelector('[data-weather-chart-scroll]').focus();}};
    let drag=null;const marks=[...svg.querySelectorAll('[data-weather-chart-point]')];
    scroll.onpointerdown=e=>{if(end-start<last-first){drag={x:e.clientX};scroll.setPointerCapture(e.pointerId);}};
    scroll.onpointerup=e=>{if(drag){const pan=(drag.x-e.clientX)/Math.max(1,scroll.clientWidth);drag=null;if(Math.abs(pan)>.01)change(1,pan);}};
    scroll.onpointercancel=()=>{drag=null;};
    scroll.onpointermove=e=>{if(drag)return;const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*960;let point=null,best=Infinity;marks.forEach(n=>{const nx=Number(n.getAttribute('cx')??n.getAttribute('x'));if(Math.abs(nx-px)<best){best=Math.abs(nx-px);point=n;}});if(!point)return;
      tip.innerHTML=`<strong>${point.dataset.value} ${abearcWeatherEsc(point.dataset.unit)}</strong><span>${abearcWeatherEsc(point.dataset.label)}</span><span>${abearcWeatherEsc(point.dataset.summary||'')}</span>`;const box=section.getBoundingClientRect();tip.style.left=`${Math.max(8,Math.min(box.width-210,e.clientX-box.left-80))}px`;tip.style.top='46px';tip.hidden=false;const line=svg.querySelector('[data-wx-crosshair]');line.setAttribute('x1',px);line.setAttribute('x2',px);line.setAttribute('visibility','visible');};
    scroll.onpointerleave=()=>{tip.hidden=true;svg.querySelector('[data-wx-crosshair]').setAttribute('visibility','hidden');};
  };bind();
});}
function weatherChartWindow(points,start,end,factor=1,pan=0){
  const times=[...new Set(points.map(p=>p.x).filter(Number.isFinite))].sort((a,b)=>a-b),first=times[0],last=times.at(-1);
  if(times.length<3)return {start:first,end:last};
  const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b),minimum=gaps[Math.floor(gaps.length/2)]*2;
  const span=Math.min(last-first,Math.max(minimum,(end-start)*factor)),center=(start+end)/2+(end-start)*pan;
  let a=Math.max(first,Math.min(last-span,center-span/2)),b=a+span;
  if(!points.some(p=>p.x>=a&&p.x<=b&&p.y!==null))return {start,end};
  return {start:a,end:b};
}
function weatherExportSvg(svg){if(!hasPrivilege('export_weather_data'))return toast('Weather export permission is required.','error');const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('color','#334155');clone.setAttribute('width','1920');clone.setAttribute('height','490');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=550;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1920,550);ctx.drawImage(img,0,45,1920,490);ctx.fillStyle='#334155';ctx.font='20px sans-serif';ctx.fillText((abearcWeatherStationDetail?.station?.display_name||'ABEARC')+' · '+(svg.closest('section')?.querySelector('header')?.innerText||'Weather'),30,28);canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='abearc-weather-chart.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});URL.revokeObjectURL(url);};img.onerror=()=>{URL.revokeObjectURL(url);toast('Chart export failed.','error');};img.src=url;}

async function loadAbearcWeatherForecast(stationId,sequence){
  const forecastEl=document.getElementById('wxForecast');forecastEl.innerHTML='<div class="wx-skeleton">Loading the station-area forecast…</div>';
  try{const data=await fetchJson(`${API}/weather/stations/${stationId}/forecast`,{silentLoading:true});if(sequence!==weatherOpenSequence)return;abearcWeatherForecast=data;weatherForecastDay=null;renderWeatherForecast();}
  catch(error){if(sequence!==weatherOpenSequence)return;abearcWeatherForecast=null;forecastEl.innerHTML=weatherEmpty('Forecast service is temporarily unavailable. AWS observations remain available.');forecastEl.insertAdjacentHTML('afterbegin','<div data-weather-combined-grid></div>');weatherRenderTimeline();document.getElementById('wxForecastPreview').innerHTML=weatherEmpty('Forecast temporarily unavailable.');}
}
function weatherForecastHours(){return (abearcWeatherForecast?.hourly||[]).filter(r=>r.timestamp>=Math.floor(Date.now()/3600000)*3600);}
function weatherBucketTimestamp(bucket,zone=abearcWeatherStationDetail?.station?.timezone||'Asia/Manila'){
  if(/Z$|[+-]\d\d:\d\d$/.test(bucket))return Date.parse(bucket)/1000;
  const guess=Date.parse(bucket+'Z')/1000;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess*1000));
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return guess-(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)/1000-guess);
}
function weatherObservedTimeline(history){
  if(!history)return [];
  const keys={air_temperature:'temperature_2m',relative_humidity:'relative_humidity_2m',precipitation:'precipitation',wind_speed:'wind_speed_10m',wind_gust:'wind_gusts_10m',wind_direction:'wind_direction_10m',solar_radiation:'shortwave_radiation',lightning_count:'lightning_count',other_lightning_activity:'lightning_count',lightning_distance:'lightning_distance',apparent_temperature:'apparent_temperature'};
  const chosen=new Map();for(const s of history.series||[]){if(!keys[s.normalized_key]||s.normalized_key==='solar_radiation'&&!/^W\s*\/\s*m(?:²|2|\^2)$/i.test(s.unit||'')||/^(min|max)\b/i.test(s.measurement)||s.normalized_key==='precipitation'&&s.unit!=='mm'||s.normalized_key==='relative_humidity'&&/temp/i.test(s.measurement))continue;const prior=chosen.get(s.normalized_key);if(!prior||Number(s.port_num||0)<Number(prior.port_num||0))chosen.set(s.normalized_key,s);}
  const series=new Map([...chosen.values()].map(s=>[Number(s.id),s])),rows=new Map();
  for(const r of history.data||[]){const s=series.get(Number(r.series_id));if(!s)continue;const timestamp=history.aggregation==='raw'?Math.floor(r.timestamp_utc/3600)*3600:weatherBucketTimestamp(r.bucket,history.station?.timezone);if(!Number.isFinite(timestamp))continue;if(!rows.has(timestamp))rows.set(timestamp,{timestamp,observed:true});rows.get(timestamp)[keys[s.normalized_key]]=r.quality_status&&r.quality_status!=='valid'?null:weatherValue(r.value);}
  return [...rows.values()].sort((a,b)=>a.timestamp-b.timestamp).map(r=>({...r,condition_timestamp:r.timestamp+1800,condition:weatherObservedCondition({...r,condition_timestamp:r.timestamp+1800},history.station||abearcWeatherStationDetail?.station)}));
}
async function weatherLoadTimeline(){
  const id=abearcWeatherSelectedStationId,sequence=weatherOpenSequence,days=weatherTimelineDays;
  try{const now=Math.floor(Date.now()/1000),h=await fetchJson(`${API}/weather/stations/${id}/history?start=${now-days*86400}&end=${now}&aggregation=hourly`,{silentLoading:true});if(id!==abearcWeatherSelectedStationId||sequence!==weatherOpenSequence||days!==weatherTimelineDays)return;weatherTimelineHistory=h;weatherRenderTimeline();}
  catch(_){if(sequence===weatherOpenSequence){weatherTimelineHistory=null;weatherRenderTimeline();}}
}
function weatherTimelineChange(key,value){if(key==='days'){weatherTimelineDays=Number(value);weatherLoadTimeline();}else weatherTimelineStep=Number(value);weatherRenderTimeline();}
function weatherRenderTimeline(){const el=document.querySelector('[data-weather-combined-grid]');if(!el)return;const now=Math.floor(Date.now()/3600000)*3600;const observed=weatherObservedTimeline(weatherTimelineHistory).filter(r=>r.timestamp<now);const future=weatherForecastHours();const day=ts=>weatherLocalTime(ts,{year:'numeric',month:'2-digit',day:'2-digit'});const rows=[...observed,...future].filter(r=>!weatherForecastDay||day(r.timestamp)===day(weatherForecastDay));el.innerHTML=weatherForecastGrid(rows);const grid=el.querySelector('.wx-forecast-grid'),boundary=el.querySelector('.wx-forecast-start');if(grid&&boundary)grid.scrollLeft=Math.max(0,boundary.offsetLeft-grid.clientWidth*.45);}
function weatherTimelineCondition(row,external){
  const observed=weatherObservedCondition(row);
  if(observed.icon!=='unknown'||!external)return observed;
  let code=weatherValue(external.weather_code);
  const cloud=weatherValue(external.cloud_cover);
  if(code===null||(weatherValue(row.precipitation)===0&&code>=51))code=cloud!==null&&cloud>=0&&cloud<=100?(cloud<30?0:cloud<=70?2:3):null;
  if(![0,1,2,3,45,48,51,53,55,61,63,65,80,81,82,95,96,99].includes(code))return observed;
  return {...weatherCondition(code),weather_code:code,is_day:external.is_day??observed.is_day};
}
function weatherForecastGrid(rows){
  if(!rows.length)return weatherEmpty('Hourly forecast unavailable.');
  const externalConditions=new Map((abearcWeatherForecast?.stale?[]:abearcWeatherForecast?.hourly||[]).map(row=>[row.timestamp,row]));
  const step=weatherTimelineStep,all=rows;rows=rows.filter(r=>Number(weatherLocalTime(r.timestamp,{hour:'2-digit',hourCycle:'h23'}))%step===0);
  rows=rows.map(r=>{const samples=all.filter(a=>a.observed===r.observed&&a.timestamp>=r.timestamp&&a.timestamp<r.timestamp+step*3600),valid=samples.map(a=>weatherValue(a.precipitation)),result={...r,precipitation:valid.length===step&&valid.every(v=>v!==null)?valid.reduce((a,b)=>a+b,0):null};if(r.observed){const storm=samples.find(a=>weatherValue(a.lightning_count)>0);if(storm){result.lightning_count=storm.lightning_count;result.lightning_distance=storm.lightning_distance;}const evidence={...result,precipitation:valid.some(v=>v>0)?1:result.precipitation};result.condition=weatherTimelineCondition(evidence,externalConditions.get(r.timestamp));result.is_day=result.condition.is_day;}return result;});
  const days=[];rows.forEach(r=>{const label=weatherLocalTime(r.timestamp,{weekday:'short',month:'short',day:'numeric'});if(days.at(-1)?.label===label)days.at(-1).count++;else days.push({label,count:1});});
  const cell=(key,r)=>{const v=weatherValue(r[key]);if(v===null)return '—';if(key==='wind_direction_10m')return `<span class="wx-wind-arrow" style="transform:rotate(${v+180}deg)" aria-hidden="true">↑</span><small>${weatherQuantity(v,'°',0)}</small>`;const unit=metrics.find(m=>m[2]===key)?.[1]||'';const value=weatherQuantityNumber(v,unit,key==='precipitation'||key.startsWith('wind_')?1:0);return key==='precipitation'||key==='wind_gusts_10m'?`<span class="wx-amount" style="background:rgba(40,168,200,${Math.min(.65,v/(key==='precipitation'?20:30))})">${value}</span>`:value;};
  const metrics=[['Temperature','°C','temperature_2m'],['Feels like','°C','apparent_temperature'],[`Rain / ${step}h`,'mm','precipitation'],['Rain chance','%','precipitation_probability'],['Humidity','%','relative_humidity_2m'],['Wind','m/s','wind_speed_10m'],['Gusts','m/s','wind_gusts_10m'],['Direction from','°','wind_direction_10m']];
  const attrs=(r,i)=>{const hour=Number(weatherLocalTime(r.timestamp,{hour:'2-digit',hourCycle:'h23'})),night=r.is_day===0||(r.is_day==null&&(hour<6||hour>=18)),newDay=i>0&&weatherLocalTime(rows[i-1].timestamp,{day:'numeric'})!==weatherLocalTime(r.timestamp,{day:'numeric'}),boundary=i>0&&rows[i-1].observed&&!r.observed;return `class="${night?'wx-night ':''}${newDay?'wx-day-start ':''}${boundary?'wx-forecast-start ':''}"`;};
  const forecastIndex=rows.findIndex(r=>!r.observed),transition=forecastIndex>0?`<tr class="wx-forecast-boundary-row"><th aria-hidden="true"></th><th colspan="${rows.length}" class="wx-forecast-boundary-cell"><div class="wx-forecast-boundary" style="--forecast-split:${(forecastIndex/rows.length)*100}%"><span class="wx-forecast-boundary-arrow wx-forecast-boundary-observed">Observed</span><span class="wx-forecast-boundary-arrow wx-forecast-boundary-forecast">Forecast</span></div></th></tr>`:'';
  return `<div class="wx-timeline-controls"><strong>Observed → Forecast</strong><label>Past <select onchange="weatherTimelineChange('days',this.value)">${[1,3,7,30].map(n=>`<option value="${n}" ${n===weatherTimelineDays?'selected':''}>${n} day${n===1?'':'s'}</option>`).join('')}</select></label><label>Columns <select onchange="weatherTimelineChange('step',this.value)"><option value="3" ${step===3?'selected':''}>3 hours</option><option value="1" ${step===1?'selected':''}>1 hour</option></select></label><span>ZENTRA observations · Open-Meteo forecast</span></div><div class="wx-forecast-grid wx-compact-grid" tabindex="0" role="region" aria-label="Hourly forecast table"><table><thead>${transition}<tr><th scope="col">Local time</th>${days.map(d=>`<th scope="colgroup" colspan="${d.count}">${d.label}</th>`).join('')}</tr><tr><th scope="row">Hours</th>${rows.map((r,i)=>`<th scope="col" ${attrs(r,i)}><button type="button" title="${r.observed?'Observed':'Forecast'}" onclick="weatherShowTimelineHour(${r.timestamp},${!!r.observed})">${weatherLocalTime(r.timestamp,{hour:'numeric'}).replace(' ','')}</button></th>`).join('')}</tr></thead><tbody><tr><th scope="row">Conditions</th>${rows.map((r,i)=>{const c=r.observed?(r.condition||weatherObservedCondition(r)):weatherCondition(r.weather_code);return `<td ${attrs(r,i)} title="${c.label}" aria-label="${c.label}">${weatherConditionSymbol(r.observed?c:r)}${r.observed&&c.icon==='unknown'?'<sup>?</sup>':''}</td>`;}).join('')}</tr>${metrics.map(([label,unit,key])=>`<tr><th scope="row">${label}<small>${abearcWeatherEsc(weatherDisplayUnit(unit))}</small></th>${rows.map((r,i)=>`<td ${attrs(r,i)}>${cell(key,r)}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">Source</th>${rows.map((r,i)=>`<td ${attrs(r,i)}>${r.observed?'AWS':'FCST'}</td>`).join('')}</tr></tbody></table></div><p class="wx-freshness">Condition icons show the best available weather information for each time. A question mark means condition data is unavailable. Feels-like temperature is unavailable unless measured. Night shading for observations uses local 18:00–06:00; forecasts use provider day/night data. Rain is the total for the column interval; incomplete intervals show —.</p>`;
}
function weatherShowTimelineHour(ts,observed){if(!observed)return weatherShowForecastHour(ts);const r=weatherObservedTimeline(weatherTimelineHistory).find(r=>r.timestamp===ts);if(!r)return;document.getElementById('wxForecastHourDetail').innerHTML=`<strong>${weatherLocalTime(ts,{month:'short',day:'numeric',hour:'numeric'})} · OBSERVED / ZENTRA AWS</strong><p>Temperature ${weatherQuantity(r.temperature_2m,'°C')} · Hourly rain ${weatherQuantity(r.precipitation,'mm')} · Humidity ${weatherQuantity(r.relative_humidity_2m,'%')} · Wind ${weatherQuantity(r.wind_speed_10m,'m/s')}</p>`;}
function weatherHourCards(rows){return `<div class="wx-hour-strip">${rows.map(r=>{const c=weatherCondition(r.weather_code);return `<button type="button" class="wx-hour" onclick="weatherShowForecastHour(${r.timestamp})"><small>${weatherLocalTime(r.timestamp,{hour:'numeric'})}</small>${weatherIcon(c.icon)}<strong>${weatherQuantity(r.temperature_2m,'°C',0)}</strong><span>${weatherQuantity(r.precipitation_probability,'%',0)}</span><small>${weatherQuantity(r.precipitation,'mm',1)}</small></button>`;}).join('')}</div>`;}
function renderWeatherForecast(){const f=abearcWeatherForecast;if(!f)return;const hours=weatherForecastHours();const dateKey=ts=>weatherLocalTime(ts,{year:'numeric',month:'2-digit',day:'2-digit'});const selected=weatherForecastDay?hours.filter(r=>dateKey(r.timestamp)===dateKey(weatherForecastDay)):hours.slice(0,24);
  const freshness=`${f.stale?'Stale forecast · last successful fetch':'Forecast retrieved'} ${weatherLocalTime(Date.parse(f.fetched_at)/1000,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
  document.getElementById('wxForecast').innerHTML=`<div class="wx-source forecast"><span>FORECAST · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · ${abearcWeatherEsc(f.model)}</span><span>${abearcWeatherEsc(freshness)}</span></div>${f.stale?`<div class="abearc-weather-error">${abearcWeatherEsc(f.warning)}</div>`:''}<div class="wx-section-heading"><h3>Seven days ahead</h3><span>Station-area model forecast · CC BY 4.0</span></div><div class="wx-days">${f.daily.map(r=>{const c=weatherCondition(r.weather_code);return `<button type="button" class="wx-day ${weatherForecastDay===r.timestamp?'is-active':''}" onclick="weatherSelectForecastDay(${r.timestamp})" aria-pressed="${weatherForecastDay===r.timestamp}"><small>${weatherLocalTime(r.timestamp,{weekday:'short',day:'numeric'})}</small>${weatherIcon(c.icon)}<strong>${weatherQuantity(r.temperature_2m_max,'°C',0)} <span>${weatherQuantity(r.temperature_2m_min,'°C',0)}</span></strong><span>${c.label}</span><b>${weatherQuantity(r.precipitation_probability_max,'%',0)} · ${weatherQuantity(r.precipitation_sum,'mm')}</b></button>`;}).join('')}</div><div class="wx-section-heading"><h3>${weatherForecastDay?'Selected day':'Next 24 hours'}</h3><button type="button" onclick="weatherSelectForecastDay(null)">Next 24 hours</button></div>${weatherHourCards(selected)}<div id="wxForecastHourDetail" class="wx-hour-detail">Select an hour to explore forecast conditions.</div><div class="wx-section-heading"><h3>Rain outlook</h3><span>Amount and probability are separate measures</span></div><div id="wxForecastRain"></div><div class="wx-advisory">Forecasts describe the surrounding model grid, not an instrument measurement at the station. Local thunderstorms and terrain can differ from the forecast.</div>`;
  document.getElementById('wxForecast').insertAdjacentHTML('afterbegin','<div data-weather-combined-grid></div>');weatherRenderTimeline();
  const group=(key,name,unit)=>({series:{normalized_key:key==='precipitation'?'precipitation':'probability',measurement:name,unit},forecast:true,points:selected.map(r=>({x:r.timestamp,y:weatherValue(r[key]),label:weatherLocalTime(r.timestamp,{month:'short',day:'numeric',hour:'numeric'}),min:null,max:null}))});
  renderAbearcWeatherChart('wxForecastRain',[group('precipitation','Forecast precipitation amount','mm'),group('precipitation_probability','Probability of precipitation','%')]);
  document.getElementById('wxForecastPreview').innerHTML=`<div class="wx-section-heading"><div><small>FORECAST · OPEN-METEO</small><h3>Next 24 hours</h3></div><button type="button" onclick="setAbearcWeatherTab('forecast')">Full forecast →</button></div><p class="wx-freshness">${abearcWeatherEsc(freshness)}</p>${weatherHourCards(hours.slice(0,24))}`;
  weatherRenderAdvisories();weatherRenderTransition();
}
function weatherSelectForecastDay(ts){weatherForecastDay=ts;renderWeatherForecast();}
function weatherShowForecastHour(ts){if(document.querySelector('[data-weather-panel="forecast"]').classList.contains('hidden'))setAbearcWeatherTab('forecast');const r=abearcWeatherForecast?.hourly.find(row=>row.timestamp===ts);if(!r)return;const el=document.getElementById('wxForecastHourDetail');el.innerHTML=`<strong>${weatherLocalTime(ts,{weekday:'long',hour:'numeric'})} · Forecast</strong><div class="wx-detail-grid">${[['Temperature',r.temperature_2m,'°C'],['Feels like',r.apparent_temperature,'°C'],['Rain probability',r.precipitation_probability,'%'],['Precipitation',r.precipitation,'mm'],['Humidity',r.relative_humidity_2m,'%'],['Wind at 10 m',r.wind_speed_10m,'m/s'],['Gust at 10 m',r.wind_gusts_10m,'m/s'],['Direction',r.wind_direction_10m,'°'],['Cloud',r.cloud_cover,'%'],['Surface pressure',r.surface_pressure,'hPa'],['Solar (hour mean)',r.shortwave_radiation,'W/m²']].map(([l,v,u])=>`<div><small>${l}</small><b>${weatherQuantity(v,u)}</b></div>`).join('')}</div>`;el.scrollIntoView({block:'nearest',behavior:'smooth'});}
function weatherRenderAdvisories(){const f=abearcWeatherForecast,el=document.getElementById('wxAdvisories');if(!f||!el)return;const hours=weatherForecastHours().slice(0,24),valid=hours.filter(r=>r.precipitation!==null),total=valid.reduce((s,r)=>s+r.precipitation,0),rain=hours.find(r=>r.precipitation_probability>=60&&r.precipitation>=.2),heat=hours.filter(r=>r.temperature_2m>=35),wind=hours.filter(r=>r.wind_gusts_10m>=10),dry=f.daily.slice(0,3).filter(r=>r.precipitation_sum!==null&&r.precipitation_sum<1&&r.precipitation_probability_max!==null&&r.precipitation_probability_max<30);
  const items=[['Rain outlook',rain?`Rain likely around ${weatherLocalTime(rain.timestamp,{weekday:'short',hour:'numeric'})}.`:'No hour reaches the 60% rain-probability threshold in the next 24 hours.'],['Next 24 hours',valid.length===24?`${total.toFixed(1)} mm forecast precipitation. Amounts can vary locally.`:'Forecast rainfall coverage is incomplete.'],['Field conditions',dry.length?`${dry.length} of the next 3 days have less than 1 mm and under 30% peak rain probability. Check the daily forecast for timing.`:'No low-rainfall day identified in the next 3 days.'],['Heat & wind',`${heat.length?`${heat.length} hour(s) at or above 35 °C. `:''}${wind.length?`${wind.length} hour(s) with gusts at or above 10 m/s.`:'No 10 m/s gust threshold exceedance in the next 24 hours.'}`]];
  el.innerHTML=items.map(([h,t])=>`<article><small>${weatherIcon('leaf')}${h}</small><p>${abearcWeatherEsc(t)}</p></article>`).join('')+`<p class="wx-advisory">${f.stale?'Based on a stale forecast. ':''}Planning context only. Confirm local conditions before field work; these indicators do not determine spray safety or an irrigation dose.</p>`;
}
function weatherRenderTransition(){const el=document.getElementById('wxTransition');if(!el)return;const observed=weatherGroupPoints(weatherRecentHistory,'air_temperature').slice(0,1),future=weatherForecastHours().slice(0,24);if(!observed.length&&!future.length){el.innerHTML=weatherEmpty('Recent observations and forecast will appear when available.');return;}
  const forecast={series:{measurement:'Forecast temperature · next 24 hours',normalized_key:'air_temperature',unit:'°C'},forecast:true,points:future.map(r=>({x:r.timestamp,y:r.temperature_2m,min:null,max:null,label:weatherLocalTime(r.timestamp,{day:'numeric',month:'short',hour:'numeric'})}))};
  el.innerHTML=`<div class="wx-transition"><div><div class="wx-source">OBSERVED · ZENTRA AWS · PAST 24 HOURS</div>${observed.length?weatherChart(observed[0]):weatherEmpty('Recent observations unavailable.')}</div><div><div class="wx-source forecast">NOW → FORECAST · OPEN-METEO</div>${future.length?weatherChart(forecast):weatherEmpty('Forecast unavailable.')}</div></div>`;weatherChartInteractions(el);
}
function weatherRenderRainExtras(){const rain=abearcWeatherAgriculture?.rainfall;if(!rain)return;const groups=weatherGroupPoints(weatherAllHistory,'precipitation');const primary=groups.sort((a,b)=>a.series.id-b.series.id)[0];let total=0,broken=false;
  renderAbearcWeatherChart('wxCumulativeRain',primary?[{series:{...primary.series,measurement:'Cumulative recorded rainfall'},points:primary.points.map((p,i)=>{if(p.y===null||(i&&p.x-primary.points[i-1].x>weatherChartGap(primary)*1.6))broken=true;if(p.y!==null)total+=p.y;return {...p,y:broken?null:total};})}]:[]);
  document.getElementById('wxRainComparisons').innerHTML=`<div class="wx-section-heading"><h3>Recorded totals</h3><span>Partial current period vs full previous period</span></div><div class="wx-comparisons">${[['7 days',rain.last_7d_mm,rain.previous_7d_mm],['Month',rain.month_mm,rain.previous_month_mm],['Year',rain.year_mm,rain.previous_year_mm]].map(([l,a,b])=>`<article><small>${l}</small><strong>${weatherQuantityNumber(a,'mm')} <span>${abearcWeatherEsc(weatherDisplayUnit('mm'))}</span></strong><p>Previous: ${weatherQuantity(b,'mm')}</p></article>`).join('')}</div><p class="wx-advisory">${abearcWeatherEsc(rain.source_note||'Recorded samples only.')} Missing periods make these partial totals. Cumulative rainfall stops at the first detected gap.</p>`;
}
function weatherChartGap(group){const d=group.points.slice(1).map((p,i)=>p.x-group.points[i].x).filter(n=>n>0).sort((a,b)=>a-b);return d[Math.floor(d.length/2)]||3600;}
function weatherRenderWindRose(){const el=document.getElementById('wxWindRose');if(!el)return;const dirs=weatherGroupPoints(weatherAllHistory,'wind_direction')[0],speeds=weatherGroupPoints(weatherAllHistory,'wind_speed')[0];if(!dirs||!speeds){el.innerHTML=weatherEmpty('Wind speed and direction are needed for a wind rose.');return;}const byTime=new Map(speeds.points.map(p=>[p.x,p.y])),bins=Array.from({length:16},()=>[0,0,0]);let count=0,calm=0;dirs.points.forEach(p=>{const speed=byTime.get(p.x);if(p.y===null||speed===null||speed===undefined)return;count++;if(speed<.5){calm++;return;}bins[Math.round(((p.y%360)+360)%360/22.5)%16][speed<2?0:speed<5?1:2]++;});if(count<8){el.innerHTML=weatherEmpty('At least 8 paired wind samples are needed for a wind rose.');return;}const max=Math.max(...bins.map(b=>b.reduce((a,v)=>a+v,0)),1),colors=['#bed7e3','#5b9bb9','#24627f'];const wedges=bins.map((b,i)=>{let r=12;return b.map((n,j)=>{const next=r+n/max*95,a=(i*22.5-9-90)*Math.PI/180,z=(i*22.5+9-90)*Math.PI/180;const d=`M${150+r*Math.cos(a)},${150+r*Math.sin(a)} L${150+next*Math.cos(a)},${150+next*Math.sin(a)} A${next},${next} 0 0 1 ${150+next*Math.cos(z)},${150+next*Math.sin(z)} L${150+r*Math.cos(z)},${150+r*Math.sin(z)} Z`;r=next;return `<path d="${d}" fill="${colors[j]}"><title>${weatherQuantity(i*22.5,'°',0)} · ${[`${weatherQuantityNumber(.5,'m/s')}–${weatherQuantity(2,'m/s')}`,`${weatherQuantityNumber(2,'m/s')}–${weatherQuantity(5,'m/s')}`,`≥${weatherQuantity(5,'m/s')}`][j]}: ${(n/count*100).toFixed(1)}%</title></path>`;}).join('');}).join('');el.innerHTML=`<div class="wx-section-heading"><h3>Wind rose</h3><span>Direction wind comes from · paired ${abearcWeatherEsc(weatherAllHistory.aggregation)} samples</span></div><div class="wx-rose"><svg viewBox="0 0 300 300" role="img" aria-label="Wind direction and speed frequency">${[40,75,110].map(r=>`<circle cx="150" cy="150" r="${r}" fill="none" stroke="currentColor" opacity=".15"/>`).join('')}${wedges}<text x="150" y="25" text-anchor="middle" fill="currentColor">N</text><text x="280" y="155" fill="currentColor">E</text><text x="150" y="287" text-anchor="middle" fill="currentColor">S</text><text x="12" y="155" fill="currentColor">W</text></svg><div><p>${count.toLocaleString()} paired samples</p><p>Calm (&lt;${weatherQuantity(.5,'m/s')}): ${(calm/count*100).toFixed(1)}%</p><p>Light ${weatherQuantityNumber(.5,'m/s')}–${weatherQuantity(2,'m/s')} · Moderate ${weatherQuantityNumber(2,'m/s')}–${weatherQuantity(5,'m/s')} · Strong ≥${weatherQuantity(5,'m/s')}</p><small>Radial length shows frequency. Aggregated direction and speed are period summaries.</small></div></div>`;}

function weatherTrapFocus(event){const modal=document.getElementById('abearcWeatherDashboard');if(modal?.classList.contains('hidden'))return;if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,summary,[tabindex="0"],a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}}}
document.addEventListener('keydown',weatherTrapFocus);
document.addEventListener('keydown',event=>{if(!event.target.matches?.('[data-weather-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...document.querySelectorAll('[data-weather-tab]')];let i=tabs.indexOf(event.target);i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();tabs[i].focus();tabs[i].click();});

function weatherRenderOverviewSummary(){
  const a=abearcWeatherAgriculture;if(!a)return;const d=a.daily?.at(-1)||{},rain=a.rainfall||{};
  document.getElementById('wxTodaySummary').innerHTML=`<div class="wx-section-heading"><div><small>OBSERVED & CALCULATED</small><h3>Field conditions</h3></div><span>Daily indicators: ${abearcWeatherEsc(d.date||'unavailable')}</span></div><div>${weatherMetric('Rain today',rain.today_mm,'mm','Recorded samples','rain')}${weatherMetric('Daily minimum',d.temperature_min_c,'°C','','temperature')}${weatherMetric('Daily maximum',d.temperature_max_c,'°C','','temperature')}${weatherMetric('Solar energy',d.solar_energy_mj_m2,'MJ/m²','Integrated measured radiation','sun')}${weatherMetric('VPD',d.vpd_avg_kpa,'kPa','Calculated from temperature & RH','leaf')}${weatherMetric('Reference ET₀',d.et0_mm,'mm',d.et0_mm==null?'Required inputs unavailable':'Calculated / station-derived','leaf')}</div>`;
}

async function renderWeatherCropAdvisoryLibrary(){
  const node=document.getElementById('wxCropAdvisoryLibrary');
  if(!node||!abearcWeatherSelectedStationId)return;
  const stationId=abearcWeatherSelectedStationId;
  try {const [data,library]=await Promise.all([fetchJson(`${API}/weather/stations/${stationId}/crop-advisories`,{silentLoading:true}),fetchJson(`${API}/weather/crop-advisory-library`,{silentLoading:true})]);
    if(stationId!==abearcWeatherSelectedStationId)return;
    const cropCards=(data.crop_specific||[]).map(c=>`<article class="wx-crop-advisory"><strong>${abearcWeatherEsc(c.crop.toUpperCase())}</strong>${(c.recommendations?.length?c.recommendations:[c]).map(r=>`<p>${abearcWeatherEsc(r.advice)}<br><small>${abearcWeatherEsc(r.basis)}</small></p>`).join('')}</article>`).join('');
    node.innerHTML=`<div class="wx-crop-advisory-head"><strong>Crop-focused station advisories</strong><small>${data.library_count} rules · ${data.observed_days} observed days · ${data.forecast_included?'fresh forecast included':'observations only'}</small></div><div class="wx-crop-advisory-grid">${data.advisories.map(a=>`<article class="wx-crop-advisory ${a.source==='forecast'?'is-forecast':''}"><small>${abearcWeatherEsc(a.source_label)} · ${abearcWeatherEsc(a.category)}</small><strong>${abearcWeatherEsc(a.title)}</strong><p>${abearcWeatherEsc(a.basis)}. ${abearcWeatherEsc(a.advice)}</p><small>Crops: ${abearcWeatherEsc(a.crop_groups.join(', '))}</small></article>`).join('')}</div><div class="wx-crop-advisory-grid">${cropCards}</div><details><summary>Browse all ${library.rules.length} crop-advisory rules</summary><div class="wx-crop-advisory-grid">${library.rules.map(r=>`<article class="wx-crop-advisory"><strong>${abearcWeatherEsc(r.title)}</strong><small>${abearcWeatherEsc(r.source)} · ${abearcWeatherEsc(r.threshold)}</small><p>${abearcWeatherEsc(r.advice)}</p></article>`).join('')}</div></details><p class="wx-freshness">${abearcWeatherEsc(data.methodology)} ${abearcWeatherEsc(data.climate_note)} ${abearcWeatherEsc(library.disclaimer)}</p>`;
  }catch(e){node.innerHTML='<p class="wx-freshness">Crop-advisory data are currently unavailable.</p>';}
}
