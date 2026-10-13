'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const weather=read('src/frontend/scripts/24-weather-experience.js');
const map=read('src/frontend/scripts/12-abearc-map.js');
const page=read('src/frontend/pages/map.page.html');
assert(!page.includes('data-weather-admin-setup'));
assert.match(page,/data-weather-integration-gear[\s\S]*?<circle cx="12" cy="12"/);
assert.match(read('src/frontend/modals/map-weather.modals.html'),/id="weatherIntegrationModal"[\s\S]*data-weather-admin-setup/);
function element(hidden=false){const classes=new Set(hidden?['hidden']:[]);return {classList:{contains:c=>classes.has(c),add:c=>classes.add(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},setAttribute(){}};}
async function main(){
  let accepted=false,deletes=0;
  const status={},input={value:'secret'};
  const ctx={hasPrivilege:()=>true,confirmModalChoice:async()=>accepted,fetchJson:async()=>{deletes++;},API:'/api',document:{getElementById:id=>id==='weatherDrawerApiKey'?input:status},toast:()=>assert.fail('Unexpected error')};
  vm.createContext(ctx);
  vm.runInContext(weather.slice(weather.indexOf('async function removeWeatherApiCredential'),weather.indexOf('function openWeatherIntegrationModal')),ctx);
  await ctx.removeWeatherApiCredential();assert.equal(deletes,0);assert.equal(input.value,'secret');
  accepted=true;await ctx.removeWeatherApiCredential();assert.equal(deletes,1);assert.equal(input.value,'');
  for(const [name,scope,rail] of [['showAbearcSavedPhotos','saved','saved'],['showAbearcGeotagPhotos','all','photos'],['showAbearcMyGeotagPhotos','mine','mine']]){
    const panel=element(true),button=element();let selected;
    const c={window:{},document:{querySelector:selector=>selector==='[data-map-results-panel]'?panel:button},toggleAbearcMapResults(){},syncAbearcMapRail(){button.classList.toggle('is-active',!panel.classList.contains('hidden'));},setAbearcMapPhotoScope(value){selected=value;panel.classList.toggle('hidden',false);button.classList.toggle('is-active',true);}};
    vm.createContext(c);const start=map.indexOf(`function ${name}()`);const end=map.indexOf('\n    }',start)+6;vm.runInContext(map.slice(start,end),c);
    c[name]();assert.equal(selected,scope);assert.equal(panel.classList.contains('hidden'),false);
    c[name]();assert.equal(panel.classList.contains('hidden'),true);
    c[name]();assert.equal(panel.classList.contains('hidden'),false);
  }
  const drawer=element(true),results=element(),rail=element();
  const c={window:{},hasPrivilege:()=>true,document:{querySelector:s=>s==='[data-weather-stations-drawer]'?drawer:s==='[data-map-results-panel]'?results:null,querySelectorAll:()=>[rail]},reloadAbearcWeatherStations(){},renderWeatherStationList(){}};
  vm.createContext(c);vm.runInContext(weather.slice(weather.indexOf('function toggleWeatherStationsDrawer'),weather.indexOf('function focusWeatherStation')),c);
  assert.equal(c.toggleWeatherStationsDrawer(),true);assert.equal(c.toggleWeatherStationsDrawer(),false);assert.equal(results.classList.contains('hidden'),true);assert.equal(c.toggleWeatherStationsDrawer(),true);
  console.log('Sidebar repeated clicks, integration modal, and token confirmation checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
