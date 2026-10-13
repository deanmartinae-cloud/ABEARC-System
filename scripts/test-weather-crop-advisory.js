const fs=require('fs'),assert=require('node:assert/strict');
const {build,library}=new Function(fs.readFileSync('src/backend/services/22-weather-advisory.service.js','utf8')+';return {build:weatherBuildCropAdvisories,library:WEATHER_CROP_ADVISORY_LIBRARY};')();
const now=Date.parse('2026-10-08T06:00:00Z')/1000,station={id:1,timezone:'Asia/Manila'};
const daily=Array.from({length:31},(_,i)=>({date:new Date(Date.UTC(2026,9,7-i)).toISOString().slice(0,10),rainfall_mm:0,rainfall_completeness_pct:100,temperature_max_c:36,temperature_min_c:24,relative_humidity_avg_pct:80}));
const forecast={fetched_at:'2026-10-08T05:00:00Z',stale:false,daily:Array.from({length:4},(_,i)=>({timestamp:Date.parse(`2026-10-${String(8+i).padStart(2,'0')}T00:00:00+08:00`)/1000,precipitation_sum:28,wind_gusts_10m_max:16,temperature_2m_max:36,precipitation_probability_max:80}))};
const run=(d=daily,f=forecast)=>build({daily:d,forecast:f,station,now});
const ids=r=>r.advisories.map(a=>a.id);
for(const id of ['observed_dry_run','observed_prolonged_dry','observed_30day_dry','observed_heat','forecast_rain','forecast_wind','forecast_hot'])assert(ids(run()).includes(id),id);
assert.equal(run().outlook.length,3);assert.equal(run().crop_specific.length,5);
assert(!ids(run(daily.filter((_,i)=>i!==1))).includes('observed_dry_run'));
assert(!ids(run(daily.map((d,i)=>i===1?{...d,rainfall_completeness_pct:20}:d))).includes('observed_dry_run'));
assert(!ids(run(daily.map(d=>({...d,rainfall_mm:null})))).includes('observed_dry_run'));
assert(!run(daily,{...forecast,stale:true}).advisories.some(a=>a.source==='forecast'));
assert(!run(daily,{...forecast,fetched_at:'2026-10-01T00:00:00Z'}).advisories.some(a=>a.source==='forecast'));
assert.equal(run([],null).level,'DATA LIMITED');
assert(ids(run(daily.map(d=>({...d,rainfall_mm:30})))).includes('observed_wet_run'));
assert(!JSON.stringify(library).match(/livestock|poultry|cattle/i));
console.log(`Crop library checks passed: ${library.length} rules, five crops, actual triggers, missing days, incomplete rainfall, stale forecast, three-day dates and empty data.`);

for(const rule of library.filter(r=>!r.metric.endsWith('_days')&&!['soil_water_change_3day_pp','work_window_hours'].includes(r.metric))){
  const observed=rule.source==='observed';
  const d=[{date:'2026-10-07',solar_completeness_pct:100,[rule.metric]:rule.limit,...Object.fromEntries((rule.conditions||[]).map(([key,limit])=>[key,limit]))}];
  const f={...forecast,daily:[{timestamp:forecast.daily[1].timestamp,[rule.metric]:rule.limit}]};
  assert(ids(run(observed?d:[],observed?null:f)).includes(rule.id),`Threshold must trigger ${rule.id}`);
  const outside=rule.limit+(rule.operator==='gte'?-0.1:0.1);
  if(observed)d[0][rule.metric]=outside;else f.daily[0][rule.metric]=outside;
  assert(!ids(run(observed?d:[],observed?null:f)).includes(rule.id),`Below threshold must not trigger ${rule.id}`);
}
const humid=run([{date:'2026-10-07',relative_humidity_avg_pct:93}],null);
assert(humid.crop_specific.find(c=>c.crop==='cacao').advice.includes('pods'));
assert(!humid.crop_specific.find(c=>c.crop==='corn').advice.includes('waterlogged'));
console.log('All scalar-rule boundaries and crop-specific humidity advice passed.');
