const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const controller=read('src/backend/controllers/21-weather.controller.js');
const build=new Function('PDFDocument','StandardFonts','rgb','weatherFinite','weatherStationHealth','fs','path','__dirname',read('src/backend/services/22-weather-advisory.service.js')+'\n'+controller.slice(controller.indexOf('const weatherPdfText ='),controller.indexOf('const __routeController509 ='))+'\nreturn weatherBuildPdfReport;')(PDFDocument,StandardFonts,rgb,v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v),()=>({label:'Online'}),fs,path,root);
(async()=>{
  const now=Math.floor(Date.now()/1000),date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
  const station={id:1,display_name:'Malagos Nursery Weather Station',timezone:'Asia/Manila',last_measurement_ts:now};
  const daily=[{date,rainfall_mm:.1,temperature_max_c:30,temperature_min_c:23,temperature_avg_c:29.5,relative_humidity_avg_pct:94},...[1,2,3].map(n=>({date:new Date(Date.parse(date+'T00:00:00Z')-n*86400000).toISOString().slice(0,10),rainfall_mm:30,temperature_max_c:36,relative_humidity_avg_pct:94,leaf_wetness_hours:13,soil_water_content_avg_pct:28+n*3,soil_water_completeness_pct:100,soil_water_series:'teros-40cm',solar_energy_mj_m2:25,solar_completeness_pct:100}))];
  const forecast={fetched_at:new Date().toISOString(),daily:[1,2,3].map((n)=>({timestamp:now+n*86400,weather_code:[61,2,61][n-1],temperature_2m_min:23,temperature_2m_max:29,precipitation_sum:25,precipitation_probability_max:80})),hourly:[]};
  const current={readings:[['air_temperature',29.5,'°C'],['relative_humidity',81.8,'%'],['precipitation',0,'mm'],['wind_speed',1,'m/s'],['wind_gust',3,'m/s'],['wind_direction',279.3,'°']].map(([normalized_key,value,unit])=>({normalized_key,value,unit,quality_status:'valid'}))};
  const options={station,start:now-86400,end:now,summary:{daily_agriculture:daily,data_days:1,stats:{}},forecast,current,rainToday:.1,firstPageOnly:true};
  const bytes=await build(options),pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),1);assert(Math.abs(pdf.getPage(0).getHeight()/pdf.getPage(0).getWidth()-1402/1122)<.0001);
  const empty=await build({...options,summary:{daily_agriculture:[],stats:{},data_days:0},current:null,forecast:null,rainToday:null});assert.equal((await PDFDocument.load(empty)).getPageCount(),1);
  if(process.argv.includes('--preview')){const folder=path.join(root,'output/pdf');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'farm-advisory-design-preview.pdf'),bytes);fs.writeFileSync(path.join(root,'tmp/pdfs/farm-advisory-empty.pdf'),empty);}
  console.log('Reference advisory checks passed: page proportions, single-page output, populated and missing-data cases.');
})().catch(error=>{console.error(error);process.exitCode=1;});
