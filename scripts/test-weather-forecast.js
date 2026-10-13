const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/backend/services/21-weather-forecast.service.js'),'utf8');
const cache=new Map();let calls=0,failed=false;
const station={id:1,latitude:7.1927995,longitude:125.4355417,timezone:'Asia/Manila'};
const payload={hourly:{time:Array.from({length:168},(_,i)=>Math.floor(Date.now()/3600000)*3600+i*3600),temperature_2m:Array(168).fill(28),precipitation:[0,null,...Array(166).fill(1)]},daily:{time:[Math.floor(Date.now()/1000)]}};
const create=()=>vm.createContext({Map,URL,Date,JSON,Number,Math,Error,Promise,process:{env:{}},WEATHER_DEFAULT_TIMEZONE:'Asia/Manila',AbortSignal,setTimeout:fn=>{fn();},
  dbGet:async(_,args)=>cache.get(args[0]),dbRun:async(_,args)=>cache.set(args[0],{cache_key:args[1],payload_json:args[2],retry_at:args[3]||null}),
  fetch:async url=>{calls++;assert.equal(url.hostname,'api.open-meteo.com');assert.equal(url.searchParams.get('latitude'),String(station.latitude));assert.equal(url.searchParams.get('wind_speed_unit'),'ms');assert.equal(url.searchParams.get('past_days'),'30');if(failed)return {ok:false,status:429};return {ok:true,json:async()=>payload};}
});
(async()=>{let context=create();vm.runInContext(source+'\nthis.getForecast=weatherGetForecast;',context);
  const first=await Promise.all([context.getForecast(station),context.getForecast(station)]);assert.equal(calls,1);assert.equal(first[0].hourly[0].precipitation,0);assert.equal(first[0].hourly[1].precipitation,null);assert.equal(first[0].source_type,'forecast');
  await context.getForecast(station);assert.equal(calls,1,'fresh shared cache avoids external requests');
  context=create();vm.runInContext(source+'\nthis.getForecast=weatherGetForecast;',context);await context.getForecast(station);assert.equal(calls,1,'persisted cache survives service restart');
  let saved=JSON.parse(cache.get(1).payload_json);saved.fetched_at=new Date(Date.now()-2*3600000).toISOString();cache.get(1).payload_json=JSON.stringify(saved);failed=true;
  const stale=await context.getForecast(station);assert.equal(stale.stale,true);assert.match(stale.warning,/last successful/);const afterFailure=calls;await context.getForecast(station);assert.equal(calls,afterFailure,'backoff suppresses repeated failures');
  saved.fetched_at=new Date(Date.now()-25*3600000).toISOString();cache.get(1).payload_json=JSON.stringify(saved);await assert.rejects(context.getForecast(station),/AWS observations remain available/);
  console.log('Forecast checks passed: coordinates, null/zero, shared requests, restart cache, stale labeling, expiry and backoff.');
})().catch(e=>{console.error(e);process.exitCode=1;});
