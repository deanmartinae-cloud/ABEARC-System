const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const service=read('src/backend/services/21-weather-sync.service.js');
const events=new Map(),rules=[{id:1,alert_type:'heavy_rainfall',measurement_key:'rain_rate',threshold:10},{id:2,alert_type:'heavy_rainfall',measurement_key:null,threshold:100}];
let rate={normalized_key:'rain_rate',value:5,unit:'mm/hr',quality_status:'valid'};
const ctx=vm.createContext({
  weatherFinite:v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v),
  weatherCurrentConditions:async()=>({readings:[rate],health:{status:'online'}}),weatherRainTotals:async()=>({last_24h_mm:300}),weatherDailyAgriculture:async()=>[],
  getUsersWithPrivilege:async()=>[],getSuperAdminIdsAsync:async()=>[],weatherNowIso:()=>new Date().toISOString(),
  dbAll:async()=>rules,dbGet:async(sql,args)=>sql.includes('WeatherStations')?{id:7,display_name:'Fixture AWS'}:events.get(args[0]),
  dbRun:async(sql,args)=>{
    if(sql.startsWith('INSERT INTO WeatherAlertEvents'))events.set(args[0],{id:args[0],status:'active',value:args[4],message:args[5]});
    else if(sql.includes("status='resolved'"))events.get(args[1]).status='resolved';
    else if(sql.includes("status='active'"))Object.assign(events.get(args[2]),{status:'active',value:args[0],message:args[1]});
  }
});
vm.runInContext(service.slice(service.indexOf('const weatherRuleCondition'),service.indexOf('const weatherSchedulerTick'))+'\nthis.evaluate=weatherEvaluateAlerts;this.condition=weatherRuleCondition;',ctx);
const controller=read('src/backend/controllers/21-weather.controller.js');
const normalize=new Function(controller.slice(controller.indexOf('const weatherAllowedAlertTypes'),controller.indexOf('const __routeController516'))+';return weatherNormalizeAlertRuleBody;')();
(async()=>{
  assert.equal(normalize({alert_type:'heavy_rainfall',threshold:10}).measurement_key,'rain_rate');
  assert.equal(normalize({alert_type:'heavy_rainfall',measurement_key:null,threshold:100}).measurement_key,null);
  for(const threshold of [null,undefined,'',NaN])assert.throws(()=>normalize({alert_type:'heavy_rainfall',threshold}));
  assert.equal(ctx.condition({threshold:0},null),false);assert.equal(ctx.condition({threshold:0},0),true);
  await ctx.evaluate(7);assert(!events.has(1),'daily accumulation must not trigger an intensity rule');assert.equal(events.get(2).status,'active');assert.match(events.get(2).message,/mm in 24 h/);
  rate.value=12;await ctx.evaluate(7);assert.equal(events.get(1).value,12);assert.match(events.get(1).message,/12.0 mm\/hr/);
  rate.value=0.5;rate.unit='in/hr';await ctx.evaluate(7);assert(Math.abs(events.get(1).value-12.7)<1e-9);
  rate.quality_status='invalid';await ctx.evaluate(7);assert.equal(events.get(1).status,'resolved');
  rate.quality_status='valid';rate.value=null;await ctx.evaluate(7);assert.equal(events.get(1).status,'resolved');
  rate.value=20;rate.unit='mm';await ctx.evaluate(7);assert.equal(events.get(1).status,'resolved','rain depth is not rain rate');
  console.log('Weather rainfall alert checks passed: rate triggers/units, missing and invalid readings, legacy 24-hour rules and threshold validation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
