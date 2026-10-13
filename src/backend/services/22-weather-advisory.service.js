// ABEARC field-screening thresholds, not official warnings or diagnosed crop damage.
const WEATHER_CROP_ADVISORY_SOURCES = Object.freeze([
  {title:'PAGASA agricultural weather guidance',url:'https://www.pagasa.dost.gov.ph/ten-day-regional-agri-weather'},
  {title:'IRRI field water management',url:'https://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd'},
  {title:'METER PHYTOS 31 wetness-duration measurement',url:'https://library.metergroup.com/Manuals/20434_PHYTOS31_Manual_Web.pdf'},
  {title:'METER soil water content and plant-available water',url:'https://metergroup.com/measurement-insights/plant-available-water-how-do-i-determine-field-capacity-and-permanent-wilting-point/'}
]);
const WEATHER_CROP_ADVISORY_LIBRARY = Object.freeze([
  ['observed_heavy_rain','observed','Drainage','rainfall_mm',25,'gte','Inspect crop-field drainage','Recorded rain can leave low beds waterlogged.','Clear blocked drains; inspect roots and soil before entering wet fields.'],
  ['observed_soaking_rain','observed','Soil & roots','rainfall_mm',50,'gte','Check prolonged saturation','High recorded rainfall can increase root saturation and erosion.','Inspect outlets and contour barriers; postpone machinery on saturated soil.'],
  ['observed_heat','observed','Crop stress','temperature_max_c',35,'gte','Scout crops for heat symptoms','High temperatures can stress seedlings and flowering crops.','Scout for wilting; check soil moisture before irrigating and shade nursery starts as needed.'],
  ['observed_cool','observed','Crop growth','temperature_min_c',15,'lte','Watch temperature-sensitive crops','Cool conditions can slow warm-season crop growth.','Check nursery growth and postpone transplanting if field conditions are unsuitable.'],
  ['observed_humidity','observed','Crop disease','relative_humidity_avg_pct',90,'gte','Inspect foliage for disease','High humidity may prolong drying and favor disease development.','Scout leaves and pods; improve airflow and remove diseased material using local guidance.'],
  ['observed_low_humidity','observed','Transplant care','relative_humidity_avg_pct',35,'lte','Check transplant water stress','Dry air can increase water loss from young plants.','Check root-zone moisture and mulch; transplant during cooler hours.'],
  ['forecast_rain','forecast','Field preparation','precipitation_sum',20,'gte','Prepare drainage for possible rain','Forecast rainfall may interrupt field work and saturate low beds.','Clear outlets before rain; reconsider fertilizer timing and protect harvested produce.'],
  ['forecast_high_rain','forecast','Erosion','precipitation_sum',50,'gte','Protect exposed soil and slopes','Heavy forecast rain can increase runoff and erosion.','Check contour barriers, drains and seedbed covers; consult official weather warnings.'],
  ['forecast_wind','forecast','Crop protection','wind_gusts_10m_max',15,'gte','Secure plant supports and covers','Forecast gusts may damage exposed leaves and weak supports.','Secure trellises, nursery covers and banana supports before windy conditions.'],
  ['forecast_hot','forecast','Irrigation & shade','temperature_2m_max',35,'gte','Prepare for possible heat stress','Forecast heat may increase crop water demand.','Plan work in cooler hours and verify irrigation availability from field moisture readings.'],
  ['forecast_low','forecast','Transplants','temperature_2m_min',15,'lte','Prepare for cool conditions','Forecast cool conditions may slow seedlings.','Protect sensitive nursery starts and confirm local temperatures before transplanting.'],
  ['forecast_showers','forecast','Harvest planning','precipitation_probability_max',60,'gte','Plan around possible showers','Rain is possible during drying and harvest operations.','Check hourly forecasts; keep drying grain and harvested produce under ready-to-use cover.'],
  ['observed_dry_run','observed','Irrigation','dry_days',3,'gte','Check soil moisture and water supply','A measured dry run can reduce root-zone water availability.','Measure soil moisture and field water depth; prioritize vulnerable crop stages.'],
  ['observed_prolonged_dry','observed','Extended dry conditions','dry_days',14,'gte','Review the farm water budget','A prolonged measured dry period can strain irrigation supplies.','Review water storage, mulch and irrigation priorities with the local agriculturist.'],
  ['observed_30day_dry','observed','Monthly conditions','dry_days',30,'gte','Review planting and water availability','Thirty measured dry days indicate sustained low rainfall at this station.','Review planting dates and water supplies against official seasonal outlooks.'],
  ['observed_wet_run','observed','Persistent wet conditions','wet_days',7,'gte','Inspect fields after persistent rain','Repeated wet days may limit soil aeration and drying opportunities.','Check drainage, root condition and covered drying capacity.'],
  ['observed_leaf_wetness','observed','Wet foliage','leaf_wetness_hours',6,'gte','Inspect crops after extended leaf wetness','Measured wet foliage may favor disease development and delay field drying.','Scout foliage and pods; improve airflow and avoid unnecessary overhead watering.',{kind:'disease',priority:75}],
  ['observed_long_leaf_wetness','observed','Persistent wet foliage','leaf_wetness_hours',12,'gte','Prioritize wet-canopy inspection','Twelve or more recorded wet hours indicate extended canopy wetness.','Inspect leaves and pods promptly; check drainage and canopy ventilation.',{kind:'disease',priority:85}],
  ['observed_soil_drying','observed','Root-zone moisture','soil_water_change_3day_pp',-3,'lte','Check declining soil water content','Measured soil water content has fallen by at least three percentage points over three complete days.','Check moisture at crop root depth against the local soil baseline before deciding on irrigation.',{kind:'dry',priority:65}],
  ['observed_soil_wetting','observed','Drainage & soil moisture','soil_water_change_3day_pp',5,'gte','Inspect rapidly wetter soil after rain','Rising measured soil water content with substantial rain warrants a drainage and root-zone check.','Inspect ponding, drains and roots; verify soil condition before irrigating or using machinery.',{kind:'wet',priority:85,conditions:[['rainfall_mm',25,'gte']]}],
  ['observed_low_solar','observed','Produce drying','solar_energy_mj_m2',8,'lte','Allow extra time for crop and produce drying','Low measured daily solar energy may limit foliage and harvested-produce drying.','Use covered, ventilated drying; check produce moisture before storage.',{kind:'harvest',priority:45}],
  ['observed_high_solar','observed','Radiation & water demand','solar_energy_mj_m2',20,'gte','Check exposed crops and nursery shade','High measured daily solar energy may increase crop water demand.','Check root-zone moisture and nursery shade; schedule demanding field work in cooler hours.',{kind:'dry',priority:50}],
  ['observed_wet_humid','observed','Combined canopy conditions','leaf_wetness_hours',6,'gte','Prioritize scouting in wet, humid crops','Recorded leaf wetness and high mean humidity together favor prolonged wet-canopy conditions.','Scout leaves and pods; improve ventilation and avoid adding water to wet foliage.',{kind:'disease',priority:95,conditions:[['relative_humidity_avg_pct',90,'gte']]}],
  ['observed_hot_drying_soil','observed','Combined heat & soil conditions','soil_water_change_3day_pp',-3,'lte','Check crops under heat and declining soil moisture','High recorded temperature coincides with declining measured soil water content.','Inspect wilting and root-zone moisture; prioritize vulnerable seedlings and verify irrigation need.',{kind:'dry',priority:95,conditions:[['temperature_max_c',35,'gte']]}],
  ['forecast_field_window','forecast','Field-work planning','work_window_hours',2,'gte','Review a possible field-work window','A forecast daylight window has low rain risk, moderate gusts and temperatures below the heat trigger.','Consider harvesting or field checks in this window; verify ground conditions and the latest forecast first.',{kind:'work',priority:20,severity:'routine',threshold:'At least 2 consecutive daylight hours: rain <=0.1 mm/h, rain chance <=20%, gust <10 m/s, temperature 15 to below 35 C, solar >=200 W/m2'}]
].map(([id,source,category,metric,limit,operator,title,impact,advice,options={}])=>{
  const labels={rainfall_mm:'Daily rain (mm)',temperature_max_c:'Maximum temperature (C)',temperature_min_c:'Minimum temperature (C)',relative_humidity_avg_pct:'Mean humidity (%)',precipitation_sum:'Daily forecast rain (mm)',wind_gusts_10m_max:'Forecast gust (m/s)',temperature_2m_max:'Forecast high (C)',temperature_2m_min:'Forecast low (C)',precipitation_probability_max:'Rain chance (%)',dry_days:'Consecutive complete days below 1 mm',wet_days:'Consecutive complete days at least 1 mm',leaf_wetness_hours:'Recorded leaf wetness (hours/day)',soil_water_change_3day_pp:'3-complete-day soil water change (percentage points)',solar_energy_mj_m2:'Complete-day solar energy (MJ/m2)'};
  const threshold=([key,value,op])=>`${labels[key]} ${op==='gte'?'>=':'<='} ${value}`;
  const priority=/soaking|high_rain|30day/.test(id)?90:/wind|prolonged/.test(id)?80:60;
  const kind=/wind/.test(id)?'wind':/humidity/.test(id)&&!id.includes('low_humidity')?'disease':/showers/.test(id)?'harvest':/cool|forecast_low$/.test(id)?'cool':/dry|heat|hot|low_humidity/.test(id)?'dry':'wet';
  return Object.freeze({id,source,category,metric,limit,operator,title,impact,advice,severity:'watch',priority,kind,crop_groups:['rice','corn','vegetables','banana','cacao'],threshold:[threshold([metric,limit,operator]),...(options.conditions||[]).map(threshold)].join(' AND '),references:WEATHER_CROP_ADVISORY_SOURCES.map(s=>s.url),...options});
}));
const weatherBuildCropAdvisories = ({daily=[],forecast=null,station=null,now=Date.now()/1000}={}) => {
  const number=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const day=ts=>new Date(ts*1000).toLocaleDateString('en-CA',{timeZone:station?.timezone||'Asia/Manila'});
  const today=day(now),dayNumber=value=>Date.parse(value+'T00:00:00Z')/86400000;
  const rows=daily.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&dayNumber(today)-dayNumber(r.date)>=0&&dayNumber(today)-dayNumber(r.date)<=31).map(r=>({...r,soil_water_change_3day_pp:null})).sort((a,b)=>b.date.localeCompare(a.date));
  const recent=rows.filter(r=>dayNumber(today)-dayNumber(r.date)<7);
  const age=now-Date.parse(forecast?.fetched_at||'')/1000;
  const freshForecast=!forecast?.stale&&Number.isFinite(age)&&age>=-300&&age<=86400;
  const forecastRows=Array.isArray(forecast?.daily)&&freshForecast?forecast.daily.filter(d=>number(d.timestamp)!==null&&day(d.timestamp)>=today&&dayNumber(day(d.timestamp))-dayNumber(today)<4).sort((a,b)=>a.timestamp-b.timestamp):[];
  const soilDays=[1,2,3].map(offset=>rows.find(r=>dayNumber(r.date)===dayNumber(today)-offset));
  // Soil texture is unknown; trends from the same probe prompt checks, not absolute irrigation limits.
  if(soilDays.every(r=>r&&number(r.soil_water_completeness_pct)>=90&&number(r.soil_water_content_avg_pct)!==null&&r.soil_water_content_avg_pct>=0&&r.soil_water_content_avg_pct<=100&&r.soil_water_series&&r.soil_water_series===soilDays[0].soil_water_series))soilDays[0].soil_water_change_3day_pp=Number((soilDays[0].soil_water_content_avg_pct-soilDays[2].soil_water_content_avg_pct).toFixed(6));
  const hours=freshForecast&&Array.isArray(forecast?.hourly)?forecast.hourly.filter(h=>number(h.timestamp)!==null&&h.timestamp>=now&&h.timestamp<now+86400).sort((a,b)=>a.timestamp-b.timestamp):[];
  let window=null,previous=null;
  for(const h of hours){
    const valid=['precipitation','precipitation_probability','wind_gusts_10m','temperature_2m','shortwave_radiation'].every(k=>number(h[k])!==null);
    const suitable=valid&&h.is_day===1&&h.precipitation>=0&&h.precipitation<=.1&&h.precipitation_probability>=0&&h.precipitation_probability<=20&&h.wind_gusts_10m>=0&&h.wind_gusts_10m<10&&h.temperature_2m>=15&&h.temperature_2m<35&&h.shortwave_radiation>=200;
    if(suitable&&previous&&h.timestamp-previous.timestamp===3600){window={...previous,work_window_hours:2,end_timestamp:h.timestamp+3600};break;}
    previous=suitable?h:null;
  }
  const streak=wet=>{let count=0,expected=dayNumber(today)-1;for(const d of rows){if(d.date===today)continue;const rain=number(d.rainfall_mm);if(dayNumber(d.date)!==expected||rain===null||number(d.rainfall_completeness_pct)===null||d.rainfall_completeness_pct<90||(wet?rain<1:rain>=1))break;count++;expected--;}return count;};
  const dryDays=streak(false),wetDays=streak(true),result=[];
  for(const rule of WEATHER_CROP_ADVISORY_LIBRARY){
    const sensorRule=/leaf_wetness|soil_water|solar_energy/.test(rule.metric);
    const candidates=rule.metric==='work_window_hours'?(window?[window]:[]):rule.source==='forecast'?forecastRows:rule.metric==='rainfall_mm'?recent.slice(0,1):sensorRule?recent.filter(r=>dayNumber(today)-dayNumber(r.date)<=2):recent;
    let hit=null,value=null;
    if(rule.metric==='dry_days'||rule.metric==='wet_days'){value=rule.metric==='dry_days'?dryDays:wetDays;if(value>=rule.limit)hit={date:today};}
    else for(const row of candidates){
      const v=number(row[rule.metric]);if(v===null)continue;
      if((rule.metric.includes('humidity')||rule.metric.includes('probability'))&&(v<0||v>100))continue;
      if((rule.metric.includes('rain')||rule.metric.includes('precipitation')||rule.metric.includes('gust')||rule.metric==='solar_energy_mj_m2')&&v<0)continue;
      if(rule.metric==='leaf_wetness_hours'&&(v<0||v>24))continue;
      if(rule.metric==='solar_energy_mj_m2'&&(row.date===today||number(row.solar_completeness_pct)<90||number(row.solar_completeness_pct)===null))continue;
      if((rule.conditions||[]).some(([key,limit,operator])=>{const actual=number(row[key]);return actual===null||actual<0||(/humidity/.test(key)&&actual>100)||(operator==='gte'?actual<limit:actual>limit);}))continue;
      if(rule.operator==='gte'?v>=rule.limit:v<=rule.limit){if(value===null||(rule.operator==='gte'?v>value:v<value)){hit=row;value=v;}}
    }
    if(!hit)continue;
    const date=hit.date||day(hit.timestamp),unit=/rain|precipitation_sum/.test(rule.metric)?'mm':/humidity|probability/.test(rule.metric)?'%':/gust/.test(rule.metric)?'m/s':/days/.test(rule.metric)?'complete days':rule.metric==='leaf_wetness_hours'?'wet hours':rule.metric==='soil_water_change_3day_pp'?'percentage points':rule.metric==='solar_energy_mj_m2'?'MJ/m2':'C';
    const extra=(rule.conditions||[]).map(([key])=>`${key==='relative_humidity_avg_pct'?'mean humidity':key==='rainfall_mm'?'rain':'maximum temperature'} ${Number(hit[key]).toFixed(1)} ${key==='relative_humidity_avg_pct'?'%':key==='rainfall_mm'?'mm':'C'}`);
    const time=ts=>new Date(ts*1000).toLocaleString('en-GB',{timeZone:station?.timezone||'Asia/Manila',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    const basis=rule.metric==='work_window_hours'?`${time(hit.timestamp)} to ${time(hit.end_timestamp)} (local time); verify conditions`:`${date}: ${Number(value).toFixed(unit==='complete days'?0:1)} ${unit}${unit==='complete days'?' ending yesterday':''}${extra.length?'; '+extra.join('; '):''}`;
    result.push({...rule,basis,value,source_label:rule.source==='observed'?'Observed station data':'Modeled forecast'});
  }
  result.sort((a,b)=>b.priority-a.priority);
  const observedAvailable=recent.some(r=>['rainfall_mm','temperature_max_c','temperature_min_c','relative_humidity_avg_pct','leaf_wetness_hours','soil_water_content_avg_pct','solar_energy_mj_m2'].some(k=>number(r[k])!==null));
  if(!result.length)result.push({id:observedAvailable||forecastRows.length?'routine':'insufficient_data',source:'screening',source_label:'Data screening',category:'Crop monitoring',crop_groups:['rice','corn','vegetables','banana','cacao'],severity:'routine',title:observedAvailable||forecastRows.length?'Continue field monitoring':'Weather evidence unavailable',basis:observedAvailable||forecastRows.length?'No library threshold triggered in available data':'No recent valid daily observations or fresh forecast',impact:'Field conditions still require direct inspection.',advice:'Check crop condition and soil moisture; unavailable data do not establish safe or dry conditions.'});
  const categoryActions={
    wet:{rice:'Inspect bunds, spillways and field water depth; manage water for the crop stage.',corn:'Clear drains and inspect waterlogged roots before field work.',vegetables:'Clear bed drains; inspect foliage and root-zone saturation.',banana:'Inspect mat drainage and supports; scout leaves for symptoms.',cacao:'Check drainage and pod health; remove affected pods using local guidance.'},
    dry:{rice:'Monitor field water depth and irrigation supply, especially near flowering.',corn:'Check root-zone moisture, especially around tasseling and silking.',vegetables:'Check seedling moisture; mulch and irrigate only to measured need.',banana:'Check soil moisture around mats and maintain suitable mulch.',cacao:'Check young-tree moisture and shade; avoid disturbing dry roots.'},
    wind:{rice:'Inspect lodging after gusts; review harvest timing against the forecast.',corn:'Inspect stalk stability and lodging-prone plots.',vegetables:'Secure stakes, trellises and nursery covers.',banana:'Inspect and secure supports before forecast gusts.',cacao:'Inspect weak branches and young-tree supports.'},
    disease:{rice:'Scout leaves for disease symptoms and review canopy condition.',corn:'Inspect leaves and ears; maintain airflow and drying conditions.',vegetables:'Scout foliage and improve ventilation; avoid unnecessary leaf wetting.',banana:'Scout leaves for spots and inspect canopy ventilation.',cacao:'Inspect pods for disease symptoms; maintain sanitation and airflow.'},
    harvest:{rice:'Prepare covered grain drying and check harvest weather windows.',corn:'Keep harvested ears dry and check the hourly forecast.',vegetables:'Protect harvested produce and select a workable harvest window.',banana:'Protect harvested bunches and plan transport around showers.',cacao:'Protect drying beans from showers and monitor drying conditions.'},
    cool:{rice:'Monitor nursery growth and local water temperature.',corn:'Check emergence and seedling development.',vegetables:'Protect sensitive nursery starts where appropriate.',banana:'Check young-plant growth and leaf condition.',cacao:'Monitor nursery growth and protect young trees.'},
    work:{rice:'Check field access and grain moisture before harvest or drying.',corn:'Verify field access and ear moisture before harvesting.',vegetables:'Consider harvest and field checks after foliage dries.',banana:'Check footing and bunch readiness before harvest.',cacao:'Check pod readiness and covered bean-drying capacity.'}
  };
  const cropSpecific=['rice','corn','vegetables','banana','cacao'].map(crop=>{
    const evidence=result.filter(r=>r.source!=='screening');
    const recommendations=[],seen=new Set();
    for(const item of evidence){
      const kind=item.kind;
      if(seen.has(kind))continue;seen.add(kind);
      recommendations.push({kind,advice:categoryActions[kind][crop],basis:`${item.source_label}: ${item.basis}`,rule_id:item.id});
    }
    return {crop,recommendations,advice:recommendations.length?recommendations.map(r=>r.advice).join(' '):'No specific trigger in available data. Continue crop and soil-moisture checks.',basis:recommendations.length?recommendations.map(r=>r.basis).join(' | '):result[0].basis,rule_id:recommendations[0]?.rule_id||null};
  });
  return {advisories:result,crop_specific:cropSpecific,library_count:WEATHER_CROP_ADVISORY_LIBRARY.length,observed_days:recent.length,forecast_included:forecastRows.length>0||Boolean(window),forecast_stale:Boolean(forecast?.stale),outlook:forecastRows.filter(d=>day(d.timestamp)>today).slice(0,3),station_id:station?.id||null,level:!observedAvailable&&!forecastRows.length&&!window?'DATA LIMITED':result.some(r=>r.severity==='watch')?'WATCH':'ROUTINE',climate_note:'Station trends are not a climate diagnosis. Seasonal/ENSO advice requires an official climate outlook.',sources:WEATHER_CROP_ADVISORY_SOURCES};
};
