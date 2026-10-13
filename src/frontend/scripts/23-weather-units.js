// Convert only display values; analytics and alert thresholds use source units.
const weatherUnitGroups = {
  temperature:{label:'Temperature',units:{'°C':[1,0],'°F':[5/9,-160/9],K:[1,-273.15]}},
  rainfall:{label:'Rainfall / evapotranspiration',units:{mm:[1,0],cm:[10,0],in:[25.4,0]}},
  rainRate:{label:'Rain rate',units:{'mm/hr':[1,0],'cm/hr':[10,0],'in/hr':[25.4,0]}},
  speed:{label:'Wind speed / gust',units:{'m/s':[1,0],'km/h':[1/3.6,0],mph:[0.44704,0],kn:[0.5144444444,0]}},
  pressure:{label:'Pressure / VPD',units:{kPa:[1,0],hPa:[0.1,0],Pa:[0.001,0],bar:[100,0],psi:[6.894757293,0],mmHg:[0.1333223874,0],inHg:[3.386389,0]}},
  distance:{label:'Distance / elevation',units:{m:[1,0],km:[1000,0],ft:[0.3048,0],mi:[1609.344,0]}},
  radiation:{label:'Solar radiation',units:{'W/m²':[1,0],'kW/m²':[1000,0]}},
  energy:{label:'Solar energy',units:{'MJ/m²':[1,0],'kWh/m²':[3.6,0],'Wh/m²':[0.0036,0]}},
  voltage:{label:'Battery voltage',units:{mV:[1,0],V:[1000,0]}},
  conductivity:{label:'Electrical conductivity',units:{'mS/cm':[1,0],'µS/cm':[0.001,0],'dS/m':[1,0],'S/m':[10,0]}},
  percent:{label:'Humidity / probability / battery / signal',units:{'%':[1,0],fraction:[100,0]}},
  soilWater:{label:'Soil water content',units:{'m³/m³':[1,0],'%':[0.01,0]}},
  duration:{label:'Measured duration',units:{min:[1,0],s:[1/60,0],h:[60,0]}},
  angle:{label:'Direction / sensor angle',units:{'°':[1,0],rad:[180/Math.PI,0]}},
  degreeDays:{label:'Growing degree days',units:{'degree-days':[1,0],'°F·day':[5/9,0]}}
};
const weatherUnitAliases={'mm/h':'mm/hr','W/m2':'W/m²','W/m^2':'W/m²','m3/m3':'m³/m³','μS/cm':'µS/cm'};
let weatherUnitPreferences={};
try{weatherUnitPreferences=JSON.parse(localStorage.getItem('abearcWeatherUnits')||'{}')||{};}catch(_){}
function weatherDisplayQuantity(value,unit,stationId=typeof abearcWeatherSelectedStationId==='undefined'?null:abearcWeatherSelectedStationId,count=1){
  const source=weatherUnitAliases[unit]||unit;
  const entry=Object.entries(weatherUnitGroups).find(([,group])=>Object.hasOwn(group.units,source));
  const number=value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
  if(!entry)return {value:number,unit:unit||''};
  const [key,group]=entry,target=weatherUnitPreferences[stationId]?.[key];
  if(!target||!Object.hasOwn(group.units,target))return {value:number,unit:unit||''};
  const [scale,offset]=group.units[source],[targetScale,targetOffset]=group.units[target];
  return {value:number===null||count===null&&offset!==targetOffset?null:(number*scale+(offset-targetOffset)*(count??1))/targetScale,unit:target};
}
function weatherDisplayUnit(unit){return weatherDisplayQuantity(null,unit).unit;}
function weatherQuantityDigits(unit,digits){return Math.max(digits,['in','in/hr','fraction','rad','kW/m²','kWh/m²','m³/m³'].includes(unit)?3:digits);}
function weatherQuantityNumber(value,unit,digits=1){
  const display=weatherDisplayQuantity(value,unit);
  const precision=display.unit===unit?digits:weatherQuantityDigits(display.unit,Math.max(digits,2));
  return abearcWeatherNum(display.value,precision);
}
function weatherQuantity(value,unit,digits=1){return `${weatherQuantityNumber(value,unit,digits)} ${abearcWeatherEsc(weatherDisplayUnit(unit))}`.trim();}
function weatherDisplayChart(group){
  if(group.displayUnits)return group;
  const unit=group.series.unit;
  const convert=value=>weatherDisplayQuantity(value,unit).value;
  return {...group,displayUnits:true,series:{...group.series,unit:weatherDisplayUnit(unit)},points:group.points.map(p=>({...p,y:convert(p.y),min:convert(p.min),max:convert(p.max),avg:convert(p.avg)}))};
}
function renderWeatherUnitSettings(){
  const el=document.getElementById('abearcWeatherUnitSettings');if(!el)return;
  el.innerHTML=Object.entries(weatherUnitGroups).map(([key,group])=>`<label>${group.label}<select data-weather-unit="${key}" onchange="setWeatherDisplayUnit(this.dataset.weatherUnit,this.value)"><option value="">Source units</option>${Object.keys(group.units).map(unit=>`<option value="${abearcWeatherEsc(unit)}" ${weatherUnitPreferences[abearcWeatherSelectedStationId]?.[key]===unit?'selected':''}>${abearcWeatherEsc(unit)}</option>`).join('')}</select></label>`).join('');
}
function setWeatherDisplayUnit(group,unit){
  if(!Object.hasOwn(weatherUnitGroups,group)||unit&&!Object.hasOwn(weatherUnitGroups[group].units,unit))return;
  const preferences={...weatherUnitPreferences,[abearcWeatherSelectedStationId]:{...weatherUnitPreferences[abearcWeatherSelectedStationId],[group]:unit}};
  try{localStorage.setItem('abearcWeatherUnits',JSON.stringify(preferences));}catch(_){return toast('Unable to save unit preferences in this browser.','error');}
  weatherUnitPreferences=preferences;
  renderAbearcWeatherStationHeader();renderAbearcWeatherCurrent();renderAbearcWeatherCharts();renderAbearcWeatherTable();renderAbearcWeatherAgriculture();weatherRenderOverviewSummary();renderWeatherForecast();
}
