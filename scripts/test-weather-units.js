const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/frontend/scripts/23-weather-units.js'),'utf8');
const preferences={7:{temperature:'°F',rainfall:'in',speed:'km/h',pressure:'hPa',distance:'ft',radiation:'kW/m²',energy:'kWh/m²',voltage:'V',conductivity:'µS/cm',percent:'fraction',soilWater:'%',duration:'h',angle:'rad',degreeDays:'°F·day',rainRate:'in/hr'}};
const storage=new Map([['abearcWeatherUnits',JSON.stringify(preferences)]]);let renders=0;
const ctx=vm.createContext({abearcWeatherSelectedStationId:7,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  abearcWeatherNum:(v,d=1)=>v==null?'—':Number(v).toFixed(d),abearcWeatherEsc:v=>String(v??''),
  document:{getElementById:()=>null},toast:()=>assert.fail('Unexpected storage failure'),
  ...Object.fromEntries(['renderAbearcWeatherStationHeader','renderAbearcWeatherCurrent','renderAbearcWeatherCharts','renderAbearcWeatherTable','renderAbearcWeatherAgriculture','weatherRenderOverviewSummary','renderWeatherForecast'].map(name=>[name,()=>renders++]))});
vm.runInContext(source+'\nthis.convert=weatherDisplayQuantity;this.chart=weatherDisplayChart;this.quantity=weatherQuantity;this.change=setWeatherDisplayUnit;',ctx);
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
for(const [value,unit,expected,target] of [[0,'°C',32,'°F'],[25.4,'mm',1,'in'],[25.4,'mm/hr',1,'in/hr'],[10,'m/s',36,'km/h'],[100,'kPa',1000,'hPa'],[.3048,'m',1,'ft'],[1000,'W/m²',1,'kW/m²'],[3.6,'MJ/m²',1,'kWh/m²'],[12000,'mV',12,'V'],[1,'mS/cm',1000,'µS/cm'],[80,'%',.8,'fraction'],[.25,'m³/m³',25,'%'],[120,'min',2,'h'],[180,'°',Math.PI,'rad'],[10,'degree-days',18,'°F·day']]){
  const result=ctx.convert(value,unit);near(result.value,expected);assert.equal(result.unit,target);
}
near(ctx.convert(40,'°C',7,2).value,136);assert.equal(ctx.convert(40,'°C',7,null).value,null);
for(const value of [null,undefined,'',NaN,Infinity])assert.equal(ctx.convert(value,'°C').value,null);
assert.equal(ctx.convert(0,'mm').value,0);assert.equal(ctx.convert(123,'raw').unit,'raw');assert.equal(ctx.convert(123,'raw').value,123);
assert.equal(ctx.convert(25,'°C',8).value,25);assert.equal(ctx.convert(25,'°C',8).unit,'°C');
const group={series:{unit:'°C'},points:[{x:1,y:0,min:-10,max:20},{x:2,y:null}]};
const converted=ctx.chart(group);near(converted.points[0].y,32);near(converted.points[0].min,14);near(converted.points[0].max,68);
assert.equal(converted.points[1].y,null);assert.equal(group.points[0].y,0);assert.equal(group.series.unit,'°C');assert.equal(ctx.chart(converted),converted);
assert.equal(ctx.quantity(.5,'mm'),'0.020 in');
ctx.change('temperature','invalid');assert.equal(renders,0);
ctx.change('temperature','K');assert.equal(renders,7);near(ctx.convert(0,'°C').value,273.15);
const reopened=vm.createContext({localStorage:ctx.localStorage,abearcWeatherSelectedStationId:7});vm.runInContext(source+'\nthis.convert=weatherDisplayQuantity;',reopened);near(reopened.convert(0,'°C').value,273.15);
console.log('Weather unit checks passed: all dimensions, affine sums, missing/zero/raw values, station isolation, chart redraws, unchanged inputs and persistence.');
