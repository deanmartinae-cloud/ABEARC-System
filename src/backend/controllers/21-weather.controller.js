const weatherPublicStationShape = station => ({
  id:Number(station.id), provider:station.provider, provider_label:WEATHER_PROVIDER_LABELS[station.provider]||station.provider,
  provider_device_id:station.provider_device_id, source_name:station.source_name, display_name:station.display_name,
  organization_name:station.organization_name||'', device_type:station.device_type||'', model:station.model||'', can_read_data:Boolean(station.can_read_data),
  latitude:weatherFinite(station.latitude),longitude:weatherFinite(station.longitude),elevation:weatherFinite(station.elevation),elevation_unit:station.elevation_unit||'',
  timezone:station.timezone||WEATHER_DEFAULT_TIMEZONE,location_path:station.location_path||'',logging_interval_minutes:weatherFinite(station.logging_interval_minutes),upload_frequency_minutes:weatherFinite(station.upload_frequency_minutes),
  firmware_version:station.firmware_version||'',hardware_revision:station.hardware_revision||'',connectivity_type:station.connectivity_type||'',subscription_status:station.subscription_status||'',
  visible:Boolean(station.visible),enabled:Boolean(station.enabled),sync_interval_minutes:Number(station.sync_interval_minutes||WEATHER_SYNC_INTERVAL_MINUTES),
  data_first_timestamp:weatherTsSeconds(station.data_first_timestamp),data_last_timestamp:weatherTsSeconds(station.data_last_timestamp),last_measurement_ts:weatherTsSeconds(station.last_measurement_ts),
  last_successful_sync_at:station.last_successful_sync_at||null,last_sync_attempt_at:station.last_sync_attempt_at||null,last_sync_error:station.last_sync_error||null,
  health:weatherStationHealth(station)
});

const weatherFindStation = async id => dbGet(`SELECT * FROM WeatherStations WHERE id=?`,[Number(id)]);
const weatherValidateTimezone = value => {
  const timezone=String(value||'').trim();
  if(!timezone || timezone.length>100) return null;
  try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date());return timezone;}catch(_){return null;}
};
const weatherParseTimestamp = value => {
  if(value===undefined||value===null||value==='') return null;
  if(Number.isFinite(Number(value))) return weatherTsSeconds(Number(value));
  const ms=Date.parse(String(value)); return Number.isFinite(ms)?Math.floor(ms/1000):null;
};
const weatherRangeFromRequest = (req, station, defaultDays=7) => {
  const now=Math.floor(Date.now()/1000);
  const timezone=station?.timezone||WEATHER_DEFAULT_TIMEZONE;
  const startDate=String(req.query.start_date||'').trim();
  const endDate=String(req.query.end_date||'').trim();
  const start=/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? weatherLocalDateRangeUtc(startDate,timezone).start : (weatherParseTimestamp(req.query.start ?? req.query.from) ?? (now-defaultDays*86400));
  const end=/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? weatherLocalDateRangeUtc(endDate,timezone).end : (weatherParseTimestamp(req.query.end ?? req.query.to) ?? (now+1));
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end) throw Object.assign(new Error('Invalid weather date range.'),{statusCode:400});
  const maxSpan=10*366*86400;
  if(end-start>maxSpan) throw Object.assign(new Error('Weather date range cannot exceed 10 years.'),{statusCode:400});
  return {start,end};
};
const weatherParseSeriesIds = value => String(value||'').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0).slice(0,100);
const weatherNormalizeAggregation = value => ['raw','hourly','daily','weekly','monthly','yearly'].includes(String(value||''))?String(value):'raw';

const weatherHistoryPayload = async ({station,start,end,aggregation,seriesIds=[],limit=WEATHER_MAX_HISTORY_ROWS}) => {
  const series=(await weatherGetStationSeries(station.id)).filter(s=>!seriesIds.length||seriesIds.includes(Number(s.id)));
  const selectedIds=series.map(s=>Number(s.id));
  const rows=selectedIds.length?await weatherQueryRows({stationId:station.id,startTs:start,endTs:end,seriesIds:selectedIds,limit}):[];
  const truncated=rows.length>=limit;
  const data=weatherAggregateRows({rows,series,aggregation,timezone:station.timezone||WEATHER_DEFAULT_TIMEZONE,loggingIntervalMinutes:station.logging_interval_minutes});
  let dataCompletenessPct=null;
  const intervalMinutes=Number(station.logging_interval_minutes);
  if(selectedIds.length&&Number.isFinite(intervalMinutes)&&intervalMinutes>0){
    const expectedPerSeries=Math.max(1,Math.floor((end-start)/(intervalMinutes*60)));
    const validCounts=new Map(); rows.forEach(r=>{if(r.quality_status==='valid'&&r.value!==null&&r.value!==undefined)validCounts.set(Number(r.series_id),(validCounts.get(Number(r.series_id))||0)+1);});
    const percentages=selectedIds.map(id=>Math.min(100,(validCounts.get(id)||0)/expectedPerSeries*100));
    dataCompletenessPct=percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:null;
  }
  return {station:weatherPublicStationShape(station),range:{start,end,start_iso:weatherUtcIso(start),end_iso:weatherUtcIso(end)},aggregation,series:series.map(s=>({id:Number(s.id),measurement:s.measurement,normalized_key:s.normalized_key,unit:s.unit||'',sensor_name:s.sensor_name||'',position:s.position||'',port_num:s.port_num,category:s.category,aggregation_method:s.aggregation_method})),data,truncated,raw_rows_examined:rows.length,data_completeness_pct:dataCompletenessPct};
};

const __routeController500 = async (req,res) => {
  try{
    const rows=await dbAll(`SELECT * FROM WeatherStations WHERE visible=1 AND enabled=1 ORDER BY display_name,id`);
    const currentByStation=await weatherCurrentConditionsMany(rows);
    const stations=await Promise.all(rows.map(async row=>{const current=currentByStation.get(Number(row.id))||{readings:[]};const readings=current.readings.filter(r=>r.quality_status==='valid').map(r=>({normalized_key:r.normalized_key,measurement:r.measurement,unit:r.unit||'',value:r.value,timestamp_utc:r.timestamp_utc}));return {...weatherPublicStationShape(row),current:readings,rain_today_mm:(await weatherRainTotals(row,Math.floor(Date.now()/1000),true)).today_mm};}));
    res.json({stations,generated_at:weatherNowIso()});
  }catch(error){logError('WEATHER_MAP_STATIONS_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load weather stations.'});}
};

const __routeController501 = async (req,res) => {
  try{ const rows=await dbAll(`SELECT * FROM WeatherStations ORDER BY display_name,id`);res.json({stations:rows.map(weatherPublicStationShape)}); }
  catch(error){logError('WEATHER_STATIONS_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load weather stations.'});}
};

const __routeController502 = async (req,res) => {
  try{
    const station=await weatherFindStation(req.params.id); if(!station) return res.status(404).json({error:'Weather station not found.'});
    const series=await weatherGetStationSeries(station.id); const state=await dbGet(`SELECT * FROM WeatherSyncState WHERE station_id=?`,[station.id]);
    res.json({station:weatherPublicStationShape(station),series:series.map(s=>({...s,id:Number(s.id),station_id:Number(s.station_id)})),sync_state:state||null,ports:weatherJsonParse(station.ports_json,[])||[],sensor_errors:weatherJsonParse(station.sensor_errors_json,[])||[]});
  }catch(error){logError('WEATHER_STATION_DETAIL_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load weather station details.'});}
};

const __routeController503 = async (req,res) => {
  try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const current=await weatherCurrentConditions(station);res.json({station:weatherPublicStationShape(station),health:current.health,readings:current.readings.map(r=>({series_id:Number(r.series_id),normalized_key:r.normalized_key,measurement:r.measurement,unit:r.unit||'',value:r.value,quality_status:r.quality_status,error_code:r.error_code,error_message:r.error_message,timestamp_utc:r.timestamp_utc,timestamp_iso:weatherUtcIso(r.timestamp_utc),sensor_name:r.sensor_name||'',position:r.position||''}))});}
  catch(error){logError('WEATHER_CURRENT_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load current weather conditions.'});}
};

const __routeController504 = async (req,res) => {
  try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const {start,end}=weatherRangeFromRequest(req,station,7);const aggregation=weatherNormalizeAggregation(req.query.aggregation);const seriesIds=weatherParseSeriesIds(req.query.series);const payload=await weatherHistoryPayload({station,start,end,aggregation,seriesIds});res.json(payload);}
  catch(error){logError('WEATHER_HISTORY_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to load weather history.'});}
};

const __routeController505 = async (req,res) => {
  try{
    const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});
    const {start,end}=weatherRangeFromRequest(req,station,30);const base=Number.isFinite(Number(req.query.gdd_base_c))?Number(req.query.gdd_base_c):10;const kc=Number.isFinite(Number(req.query.crop_kc))?Number(req.query.crop_kc):null;
    const [rain,days]=await Promise.all([weatherRainTotals(station),weatherDailyAgriculture({station,startTs:start,endTs:end,gddBaseC:base,cropKc:kc})]);
    let dry=0,rainy=0; for(let i=days.length-1;i>=0;i-=1){const rainfall=days[i].rainfall_mm;if(rainfall===null||rainfall===undefined)break;if(Number(rainfall)<1){if(rainy)break;dry+=1;}else{if(dry)break;rainy+=1;}}
    res.json({station:weatherPublicStationShape(station),range:{start,end},rainfall:rain,gdd_base_c:base,crop_kc:kc,daily:days,consecutive_dry_days:dry,consecutive_rainy_days:rainy,method_notes:{vpd:'Saturation vapor pressure from air temperature and relative humidity.',gdd:'Daily GDD = max(0, ((Tmin + Tmax) / 2) - base temperature).',et0:'FAO-56 Penman-Monteith is calculated only when daily air temperature, humidity, solar radiation in W/m², and wind speed with a known sensor mounting height are available; wind is normalized to 2 m. A station-provided reference ET series takes precedence.',irrigation:'Crop ET and water deficit are indicative estimates only when a crop coefficient is supplied; they are not a prescriptive irrigation design.'}});
  }catch(error){logError('WEATHER_AGRICULTURE_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to calculate agricultural weather analytics.'});}
};

const weatherSummaryForRange = async (station,start,end) => {
  const series=await weatherGetStationSeries(station.id);const rows=await weatherQueryRows({stationId:station.id,startTs:start,endTs:end,limit:WEATHER_MAX_HISTORY_ROWS});
  const stats={};
  for(const s of series){const sr=rows.filter(r=>Number(r.series_id)===Number(s.id));if(!sr.length)continue;const a=weatherAggregateValues(sr,s.aggregation_method,end-start);stats[s.normalized_key]=stats[s.normalized_key]||[];stats[s.normalized_key].push({series_id:Number(s.id),measurement:s.measurement,unit:s.unit,...a});}
  const agri=await weatherDailyAgriculture({station,startTs:start,endTs:end,gddBaseC:10});
  const et0=agri.map(d=>d.et0_mm).filter(Number.isFinite);return {stats,daily_agriculture:agri,et0_total_mm:et0.length?et0.reduce((a,b)=>a+b,0):null,data_days:agri.length};
};
const __routeController506 = async (req,res) => {try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const {start,end}=weatherRangeFromRequest(req,station,1);const summary=await weatherSummaryForRange(station,start,end);res.json({station:weatherPublicStationShape(station),range:{start,end},...summary});}catch(error){logError('WEATHER_SUMMARY_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to create weather summary.'});}};

const weatherExportRows = payload => {
  if(payload.aggregation==='raw') return payload.data.map(r=>({timestamp_utc:weatherUtcIso(r.timestamp_utc),measurement:r.measurement,normalized_key:r.normalized_key,value:r.value,unit:r.unit,quality_status:r.quality_status,error_code:r.error_code||'',sensor_name:r.sensor_name||'',position:r.position||''}));
  return payload.data.map(r=>({period:r.bucket,measurement:r.measurement,normalized_key:r.normalized_key,value:r.value,min:r.min,max:r.max,average:r.avg,sum:r.sum,solar_energy_mj_m2:r.energy_mj_m2,unit:r.unit,count:r.count,expected_count:r.expected_count,completeness_pct:r.completeness}));
};
const weatherExportMetaRows = (station,payload) => [
  ['Station',station.display_name],['Provider',WEATHER_PROVIDER_LABELS[station.provider]||station.provider],['Device ID',station.provider_device_id],['Coordinates',[station.latitude,station.longitude].filter(v=>v!==null&&v!==undefined).join(', ')],['Elevation',station.elevation==null?'':`${station.elevation} ${station.elevation_unit||'m'}`],['Timezone',station.timezone],['Range',`${payload.range.start_iso} to ${payload.range.end_iso}`],['Aggregation',payload.aggregation],['Generated',weatherNowIso()],['Source','ZENTRA Cloud via ABEARC local weather cache']
];

const __routeController507 = async (req,res) => {
  try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).end();const {start,end}=weatherRangeFromRequest(req,station,7);const aggregation=weatherNormalizeAggregation(req.query.aggregation);const payload=await weatherHistoryPayload({station,start,end,aggregation,seriesIds:weatherParseSeriesIds(req.query.series),limit:WEATHER_MAX_EXPORT_ROWS});const rows=weatherExportRows(payload);const meta=weatherExportMetaRows(station,payload).map(([k,v])=>`# ${k}: ${String(v??'').replace(/[\r\n]+/g,' ')}`).join('\n');const cols=rows.length?Object.keys(rows[0]):['message'];const escCsv=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};const body=[cols.join(','),...rows.map(r=>cols.map(c=>escCsv(r[c])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="weather-${weatherSlug(station.display_name)}-${aggregation}.csv"`);res.send(`\uFEFF${meta}\n${body}\n`);}
  catch(error){logError('WEATHER_CSV_EXPORT_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to export weather CSV.'});}
};

const __routeController508 = async (req,res) => {
  try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).end();const {start,end}=weatherRangeFromRequest(req,station,7);const aggregation=weatherNormalizeAggregation(req.query.aggregation);const payload=await weatherHistoryPayload({station,start,end,aggregation,seriesIds:weatherParseSeriesIds(req.query.series),limit:WEATHER_MAX_EXPORT_ROWS});const wb=XLSX.utils.book_new();const metaSheet=XLSX.utils.aoa_to_sheet(weatherExportMetaRows(station,payload));const dataRows=weatherExportRows(payload);const dataSheet=XLSX.utils.json_to_sheet(dataRows.length?dataRows:[{message:'No weather data in the selected period.'}]);XLSX.utils.book_append_sheet(wb,metaSheet,'Metadata');XLSX.utils.book_append_sheet(wb,dataSheet,'Weather Data');const buffer=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="weather-${weatherSlug(station.display_name)}-${aggregation}.xlsx"`);res.send(buffer);}
  catch(error){logError('WEATHER_XLSX_EXPORT_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to export weather workbook.'});}
};

const weatherPdfText = value => String(value??'').replace(/[^\x20-\x7E]/g,' ');
const weatherBuildPdfReport = async ({station,start,end,summary,forecast,forecastRequested=false,forecastError=null,current=null,rainToday=null,advisoryDaily=null,firstPageOnly=false}) => {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoFolder=path.join(__dirname,'src','backend','assets','weather');
  let agricultureSeal=null,citySeal=null;
  try {agricultureSeal=await pdf.embedJpg(fs.readFileSync(path.join(logoFolder,'city-agriculture-office.jpg')));
    citySeal=await pdf.embedJpg(fs.readFileSync(path.join(logoFolder,'davao-city-seal.jpg')));
  }catch(e){console.warn('[WEATHER] Official PDF logos unavailable:',e.message);}
  const ink=rgb(.09,.23,.24),muted=rgb(.38,.46,.47),accent=rgb(.08,.39,.30),soft=rgb(.92,.96,.94),blue=rgb(.22,.52,.78);
  const timezone=station.timezone||WEATHER_DEFAULT_TIMEZONE,fmt=(v,d=1)=>weatherFinite(v)===null?'N/A':Number(v).toFixed(d);
  const date=(ts,withTime=false)=>new Date(ts*1000).toLocaleString('en-GB',{timeZone:timezone,day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})});
  let page,y;
  const text=(value,x,top,size=9,isBold=false,color=ink)=>page.drawText(weatherPdfText(value),{x,y:top,size,font:isBold?bold:font,color});
  const wrap=(value,width,size=9,isBold=false)=>{const words=weatherPdfText(value).split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if((isBold?bold:font).widthOfTextAtSize(next,size)>width&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;};
  const newPage=(label)=>{page=pdf.addPage([595.28,841.89]);
    page.drawRectangle({x:0,y:769.89,width:595.28,height:72,color:accent});
    if(agricultureSeal)page.drawImage(agricultureSeal,{x:35,y:782,width:46,height:46});
    if(citySeal)page.drawImage(citySeal,{x:513,y:782,width:46,height:46});
    text('CITY AGRICULTURIST OFFICE  |  CITY OF DAVAO',94,814,9,true,rgb(1,1,1));
    text(label,94,792,16,true,rgb(1,1,1));y=745;};
  const ensure=h=>{if(y-h<55)newPage('Farm weather advisory / continued');};
  const paragraph=(value,size=9,color=muted)=>{for(const line of wrap(value,515,size)){ensure(size+6);text(line,40,y,size,false,color);y-=size+5;}y-=5;};
  const heading=label=>{ensure(48);y-=9;text(label,40,y,13,true,accent);y-=24;};
  const table=(headers,rows,widths)=>{
    const header=()=>{page.drawRectangle({x:40,y:y-8,width:515,height:23,color:soft});let x=46;headers.forEach((v,i)=>{text(v,x,y,8,true);x+=widths[i];});y-=25;};ensure(65);header();
    rows.forEach((row,index)=>{const cells=row.map((v,i)=>wrap(v,widths[i]-12,8)),height=Math.max(...cells.map(c=>c.length),1)*12+10;if(y-height<55){newPage('Farm weather advisory / continued');header();}if(index%2===0)page.drawRectangle({x:40,y:y-height+10,width:515,height,color:rgb(.97,.98,.98)});let x=46;cells.forEach((lines,i)=>{lines.forEach((v,j)=>text(v,x,y-j*12,8));x+=widths[i];});y-=height;});y-=12;
  };
  const chart=(label,rows,key,{bars=false,minKey=null,maxKey=null,forecastLine=false}={})=>{
    if(rows.length>7){for(let i=0;i<rows.length;i+=7)chart(label+' / '+(i+1)+'-'+Math.min(i+7,rows.length),rows.slice(i,i+7),key,{bars,minKey,maxKey,forecastLine});return;}
    ensure(210);heading(label);const top=y,bottom=y-115,left=75,width=470,values=rows.flatMap(r=>[r[key],minKey?r[minKey]:null,maxKey?r[maxKey]:null]).map(weatherFinite).filter(v=>v!==null);
    if(!values.length){paragraph('No valid measurements available for this chart.');return;}
    let lo=bars?0:Math.min(...values),hi=Math.max(...values);if(lo===hi){hi+=1;if(!bars)lo-=1;}const pad=(hi-lo)*.12;if(!bars)lo-=pad;hi+=pad;
    const xx=i=>left+(i+.5)/Math.max(1,rows.length)*width,yy=v=>bottom+(Number(v)-lo)/(hi-lo)*115;
    for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,py=yy(v);page.drawLine({start:{x:left,y:py},end:{x:left+width,y:py},thickness:.4,color:rgb(.83,.88,.87)});text(fmt(v),40,py-3,8,false,muted);}
    if(bars)rows.forEach((r,i)=>{if(weatherFinite(r[key])!==null)page.drawRectangle({x:xx(i)-Math.min(18,width/rows.length*.65)/2,y:yy(0),width:Math.min(18,width/rows.length*.65),height:Math.max(.5,yy(r[key])-yy(0)),color:blue});});
    else [minKey,maxKey,key].filter(Boolean).forEach(k=>{let previous=null;rows.forEach((r,i)=>{if(weatherFinite(r[k])===null){previous=null;return;}const point={x:xx(i),y:yy(r[k])};if(previous)page.drawLine({start:previous,end:point,thickness:k===key?1.7:.7,color:k===key?accent:muted,...(forecastLine?{dashArray:[4,3]}:{})});else page.drawCircle({x:point.x,y:point.y,size:1.5,color:accent});previous=point;});});
    rows.forEach((r,i)=>{const label=r.date||date(r.timestamp),size=8,w=font.widthOfTextAtSize(weatherPdfText(label),size);text(label,xx(i)-w/2,bottom-16,size,false,muted);page.drawLine({start:{x:xx(i),y:bottom},end:{x:xx(i),y:bottom-4},thickness:.5,color:muted});});y=bottom-36;
  };
  pdf.setTitle(`${station.display_name} - Farm Weather Advisory`);pdf.setAuthor('ABEARC / Agricultural and Biosystems Engineering');
  const daily=summary.daily_agriculture||[],rainValues=daily.map(d=>weatherFinite(d.rainfall_mm)).filter(v=>v!==null);
  const cropAdvisory=weatherBuildCropAdvisories({daily:advisoryDaily||daily,forecast,station});
  // Keep the supplied artwork intact; all sample readings and advice are covered by live content.
  const artwork=await pdf.embedPng(fs.readFileSync(path.join(logoFolder,'farm-advisory-reference.png')));
  const scale=595.28/1122,H=1402;
  const artworkPage=pdf.addPage([1122,H]);
  artworkPage.drawImage(artwork,{x:0,y:0,width:1122,height:H});
  const artworkCrop=async(x,top,w,h)=>pdf.embedPage(artworkPage,{left:x,bottom:H-top-h,right:x+w,top:H-top});
  const rainArt=await artworkCrop(76,410,195,153),cloudArt=await artworkCrop(76,410,195,111),partlyArt=await artworkCrop(767,1125,112,76);
  pdf.removePage(pdf.getPageCount()-1);
  page=pdf.addPage([595.28,H*scale]);
  page.drawImage(artwork,{x:0,y:0,width:595.28,height:H*scale});
  const color=hex=>rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
  const cover=(x,top,w,h,hex='ffffff')=>page.drawRectangle({x:x*scale,y:(H-top-h)*scale,width:w*scale,height:h*scale,color:color(hex)});
  const fitText=(value,x,top,w,h,{size=19,boldText=false,hex='092439',align='left'}={})=>{
    const face=boldText?bold:font,clean=String(value??'').replace(/[^\x20-\x7E\xB0\xB2\xB7]/g,'-');
    let rows=[];
    for(;size>=9;size-=.5){
      rows=[];let line='';
      for(const word of clean.split(/\s+/)){const candidate=line?line+' '+word:word;if(face.widthOfTextAtSize(candidate,size)>w&&line){rows.push(line);line=word;}else line=candidate;}
      if(line)rows.push(line);
      if(rows.length*size*1.15<=h&&rows.every(v=>face.widthOfTextAtSize(v,size)<=w))break;
    }
    rows.forEach((line,i)=>page.drawText(line,{x:(x+(align==='center'?(w-face.widthOfTextAtSize(line,size))/2:0))*scale,y:(H-top-size-i*size*1.15)*scale,size:size*scale,font:face,color:color(hex)}));
  };
  const readings=(current?.readings||[]).filter(r=>!r.quality_status||r.quality_status==='valid');
  const reading=key=>weatherFinite(readings.find(r=>r.normalized_key===key)?.value);
  const weatherSymbol=(code,x,top,w)=>{
    if(code!==null&&code!==0){const art=code<=2?partlyArt:code>=51?rainArt:cloudArt;page.drawPage(art,{x:x*scale,y:(H-top-w*art.height/art.width)*scale,width:w*scale,height:w*art.height/art.width*scale});return;}
    const cloud=(cx,cy,r,hex)=>page.drawCircle({x:(x+cx*w)*scale,y:(H-top-cy*w)*scale,size:r*w*scale,color:color(hex)});
    if(code===0){
      cloud(.57,.25,.16,'ffbe19');
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;page.drawLine({start:{x:(x+(.57+Math.cos(angle)*.21)*w)*scale,y:(H-top-(.25+Math.sin(angle)*.21)*w)*scale},end:{x:(x+(.57+Math.cos(angle)*.29)*w)*scale,y:(H-top-(.25+Math.sin(angle)*.29)*w)*scale},thickness:2*scale,color:color('ffbe19')});}
      return;
    }
    if(code===null){fitText('Unavailable',x,top+w*.3,w,35,{size:17,align:'center'});return;}
  };
  cover(265,251,372,32,'005b48');
  fitText('Crop Focus · '+station.display_name,271,252,358,26,{size:21,boldText:true,hex:'ffffff'});
  cover(106,339,515,51,'004d53');
  fitText("TODAY'S WEATHER CONDITION",112,335,508,33,{size:29,boldText:true,hex:'ffffff'});
  fitText('Based on latest station data · '+station.display_name,113,370,505,22,{size:17,hex:'ffffff'});
  cover(700,363,143,27,'ffda26');
  fitText(cropAdvisory.level,702,362,138,29,{size:22,boldText:true});
  cover(902,343,185,47,'004d53');
  fitText(station.last_measurement_ts?date(Number(station.last_measurement_ts),true)+' (PHT)':'Observation unavailable',915,347,170,43,{size:16,hex:'ffffff'});
  const metrics=[
    [430,414,137,43,reading('air_temperature'),'°C'],
    [680,414,140,43,rainToday,'mm'],
    [932,414,149,43,reading('relative_humidity'),'%'],
    [434,530,140,45,reading('wind_speed'),'m/s'],
    [684,530,140,45,reading('wind_gust'),'m/s'],
    [946,530,142,45,reading('wind_direction'),'°']
  ];
  for(const [x,top,w,h,value,unit] of metrics){cover(x,top,w,h);fitText(fmt(value)+' '+unit,x+3,top,w-6,h,{size:34,boldText:true});}
  // Match the condition to the since-midnight total; an interval with zero rain does not erase earlier rain.
  const dailyRain=weatherFinite(rainToday),condition=dailyRain>0?'Rain recorded today':dailyRain===0?'No rain recorded today':'Condition unavailable';
  cover(40,405,277,218);
  weatherSymbol(dailyRain>0?61:dailyRain===0?3:null,65,414,216);
  fitText(condition,63,580,225,40,{size:24,boldText:true,align:'center'});
  const pageAdvisories=cropAdvisory.advisories.filter((item,index,items)=>items.findIndex(other=>other.kind===item.kind)===index);
  const featured=pageAdvisories.slice(0,4);
  [697,774,851,918].forEach((top,i)=>{
    cover(160,top-3,374,67,i%2?'d9edcf':'edf6e7');
    fitText(featured[i]?.impact||'Continue field checks; use current station data and local crop observations.',167,top,359,60,{size:20});
  });
  const actions=pageAdvisories.map(item=>item.advice).slice(0,6);
  const routine=['Inspect crop condition and soil moisture before field work.','Match irrigation to measured soil moisture and crop needs.','Follow local crop-protection guidance when symptoms are confirmed.','Inspect stakes, trellises and plant supports.','Plan planting and harvest around the latest forecast.','Monitor pest and disease symptoms in all crops.'];
  for(let i=0;i<6;i++){const x=i%2?381:119,top=[1047,1125,1222][Math.floor(i/2)],height=[67,83,70][Math.floor(i/2)];cover(x,top-3,i%2?151:166,height+5);fitText(actions[i]||routine[i],x+7,top,i%2?144:156,height,{size:17});}
  cropAdvisory.crop_specific.forEach((crop,i)=>{
    const top=[694,758,823,887,969][i],height=[47,44,45,60,44][i];
    cover(751,top-3,341,height+7,['eaf3e5','fff2da','e7f4e9','fff1c8','f8e8dc'][i]);
    const advice=crop.recommendations.length?crop.recommendations.slice(0,2).map(r=>r.advice).join(' '):crop.advice;
    fitText(advice,756,top,331,height,{size:16});
  });
  for(let i=0;i<3;i++){
    const d=cropAdvisory.outlook[i],x=582+i*171;
    cover(x,1109,153,178);
    fitText(d?date(d.timestamp).slice(0,6):'Unavailable',x,1111,153,24,{size:16,align:'center'});
    const code=d?weatherFinite(d.weather_code):null;
    weatherSymbol(code,x+26,1135,100);
    const label=code===null?'Forecast unavailable':code===0?'Clear sky':code<=2?'Partly cloudy':code===3?'Overcast':code>=95?'Thunderstorms':code>=51?'Rain / showers':'Fog / mist';
    fitText(d?fmt(d.temperature_2m_min,0)+'-'+fmt(d.temperature_2m_max,0)+'°C':'N/A',x,1213,153,30,{size:24,boldText:true,align:'center'});
    fitText(label,x+5,1248,143,39,{size:17,align:'center'});
  }
  cover(105,1335,581,46,'004e43');
  fitText('Station: ZENTRA · Forecast: Open-Meteo · Field screening',110,1341,568,23,{size:17,hex:'ffffff'});
  fitText('Issued '+date(Date.now()/1000,true)+' PHT · Verify field conditions.',110,1366,568,22,{size:14,hex:'ffffff'});
  if(firstPageOnly)return pdf.save();
  newPage('Advisory evidence & methodology');
  paragraph(station.display_name,16,ink);
  paragraph(`Generated ${date(Date.now()/1000,true)} | ${timezone} | Station health: ${weatherStationHealth(station).label}`);
  paragraph(`Latest station readings are separate from the selected historical reporting period: ${date(start,true)} to ${date(end,true)} (end exclusive).`);
  paragraph(`Crop screening uses recent observations and fresh model forecasts. Library: ${cropAdvisory.library_count} rules. Observed days: ${cropAdvisory.observed_days}.`);
  heading('Priority crop-weather advisories');
  for(const item of cropAdvisory.advisories){heading(item.title);paragraph(`${item.source_label} | ${item.basis} | Rule: ${item.id}`);paragraph(item.impact+' '+item.advice);}
  heading('Crop-specific evidence');
  for(const item of cropAdvisory.crop_specific)paragraph(`${item.crop.toUpperCase()}: ${item.advice} Basis: ${item.basis}.`);
  heading('Rule library & sources');
  paragraph(cropAdvisory.climate_note);
  paragraph('Numeric trigger thresholds are ABEARC field-screening defaults; they are not validated disease predictions or official warning levels. Dry/wet streaks require consecutive completed local days with at least 90% rain-sample coverage. Missing days break streaks.');
  paragraph('Leaf wetness sums recorded minutes from one duration channel. Soil water trends compare the same probe over three consecutive complete days with at least 90% coverage; they do not establish field capacity or irrigation amounts. Solar-energy triggers require a completed day with at least 90% coverage. Combined rules require their conditions on the same date. First-page crop advice shows the two highest-priority categories; the dashboard and full report include all applicable categories.');
  for(const source of WEATHER_CROP_ADVISORY_SOURCES)paragraph(source.title+': '+source.url,8);
  heading('Advisory interpretation');
  paragraph('Guidance is a preliminary agricultural field-screening aid. It is not a PAGASA alert, a crop-specific irrigation prescription, a flood prediction, or a substitute for site inspection.',9);
  paragraph('Observed station measurements and modeled forecast are separate evidence sources. Verify station freshness, local conditions and official PAGASA warnings before taking safety-critical actions.',9);
  heading('Selected-period weather summary');table(['Rainfall (available days)','Days represented','Reference ET0'],[[rainValues.length?fmt(rainValues.reduce((a,b)=>a+b,0))+' mm':'N/A',String(summary.data_days),fmt(summary.et0_total_mm)+' mm']],[190,155,170]);
  paragraph('Totals include available observations only. N/A means missing or insufficient data; it does not mean zero. Forecast values are excluded from these totals.');
  chart('Daily observed rainfall / mm',daily,'rainfall_mm',{bars:true});
  chart('Daily air temperature / C - min, mean and max',daily,'temperature_avg_c',{minKey:'temperature_min_c',maxKey:'temperature_max_c'});
  newPage('Field weather indicators');
  paragraph(`Reporting period: ${date(start)} to ${date(end)} | Source: ZENTRA Cloud via ABEARC local cache`);
  heading('Measurement summary');
  const stats=Object.values(summary.stats).flat();table(['Measurement / unit','Minimum','Mean','Maximum'],stats.length?stats.map(s=>[`${s.measurement} / ${s.unit||''}`,fmt(s.min),fmt(s.avg),fmt(s.max)]):[['No observations','N/A','N/A','N/A']],[275,80,80,80]);
  heading('Agricultural indicators by day');table(['Date','Rain mm','Mean C','RH %','ET0 mm','GDD'],daily.length?daily.map(d=>[d.date,fmt(d.rainfall_mm),fmt(d.temperature_avg_c),fmt(d.relative_humidity_avg_pct),fmt(d.et0_mm),fmt(d.gdd)]):[['No observations','N/A','N/A','N/A','N/A','N/A']],[115,80,80,80,80,80]);
  paragraph('ET0 uses station reference ET where available, otherwise FAO-56 with sufficient measurements and known wind sensor height. GDD uses a 10 C base. Field indicators support assessment and are not an irrigation prescription.');
  if(forecastRequested){
    newPage('Farm forecast outlook');
    paragraph('MODELED FORECAST - separate from measured station observations',10,accent);
    if(!forecast)paragraph(forecastError||'Forecast unavailable at report generation. Observed sections remain valid.');
    else{
      paragraph(`Open-Meteo | ${forecast.model} | CC BY 4.0 | https://open-meteo.com/`);
      paragraph(`Retrieved ${forecast.fetched_at} | ${forecast.stale?'STALE: last successful forecast':'Cached provider forecast'} | Station-area model grid`);
      if(forecast.stale)paragraph(forecast.warning||'Forecast refresh failed; check freshness before use.');
      paragraph('This is the current outlook at report generation, independently of the historical reporting period. Local terrain and thunderstorms can differ from the model.');
      heading('Seven-day outlook');table(['Local date','Low / high C','Rain mm','Rain %','Wind / gust m/s'],forecast.daily.map(d=>[date(d.timestamp),`${fmt(d.temperature_2m_min)} / ${fmt(d.temperature_2m_max)}`,fmt(d.precipitation_sum),fmt(d.precipitation_probability_max,0),`${fmt(d.wind_speed_10m_max)} / ${fmt(d.wind_gusts_10m_max)}`]),[110,100,80,65,160]);
      chart('Forecast daily precipitation / mm',forecast.daily,'precipitation_sum',{bars:true});
      heading('Next 24 hours');const hours=forecast.hourly.filter(r=>r.timestamp>=Math.floor(Date.now()/3600000)*3600).slice(0,24);
      table(['Local time','Temp / feels C','Rain mm / %','Wind / gust m/s','From deg'],hours.map(r=>[date(r.timestamp,true),`${fmt(r.temperature_2m)} / ${fmt(r.apparent_temperature)}`,`${fmt(r.precipitation)} / ${fmt(r.precipitation_probability,0)}`,`${fmt(r.wind_speed_10m)} / ${fmt(r.wind_gusts_10m)}`,fmt(r.wind_direction_10m,0)]),[135,110,95,115,60]);
    }
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>{if(i===0)return;page=p;page.drawLine({start:{x:40,y:40},end:{x:555,y:40},thickness:.5,color:rgb(.8,.86,.84)});text('ABEARC | Observations: ZENTRA Cloud | Forecast: Open-Meteo when included',40,27,7,false,muted);text(`${i+1} / ${pages.length}`,520,27,8,false,muted);});
  return pdf.save();
};
const __routeController509 = async (req,res) => {
  try{
    const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).end();const {start,end}=weatherRangeFromRequest(req,station,7);const summary=await weatherSummaryForRange(station,start,end);
    const forecastRequested=req.query.include_forecast==='1';let forecast=null,forecastError=null;
    if(forecastRequested){try{forecast=await weatherGetForecast(station);}catch(_){forecastError='Forecast unavailable at report generation. Observed sections remain valid.';}}
    const now=Math.floor(Date.now()/1000);
    const [current,rain,advisoryDaily]=await Promise.all([weatherCurrentConditions(station),weatherRainTotals(station,now,true),weatherDailyAgriculture({station,startTs:now-32*86400,endTs:now+1})]);
    const bytes=await weatherBuildPdfReport({station,start,end,summary,forecast,forecastRequested,forecastError,current,rainToday:rain.today_mm,advisoryDaily,firstPageOnly:req.query.first_page==='1'});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="farm-weather-advisory-${weatherSlug(station.display_name)}.pdf"`);res.send(Buffer.from(bytes));
  }catch(error){logError('WEATHER_PDF_EXPORT_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'Unable to generate weather report.'});}
};

const __routeController510 = async (req,res) => {
  try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const updates=[],params=[];if(Object.hasOwn(req.body||{},'display_name')){const name=String(req.body.display_name||'').trim().slice(0,160);if(!name)return res.status(400).json({error:'Station display name cannot be empty.'});updates.push('display_name=?');params.push(name);}for(const key of ['visible','enabled'])if(Object.hasOwn(req.body||{},key)){updates.push(`${key}=?`);params.push(req.body[key]?1:0);}if(Object.hasOwn(req.body||{},'sync_interval_minutes')){const n=Math.max(5,Math.min(1440,Number(req.body.sync_interval_minutes)||WEATHER_SYNC_INTERVAL_MINUTES));updates.push('sync_interval_minutes=?');params.push(n);}if(Object.hasOwn(req.body||{},'timezone')){const timezone=weatherValidateTimezone(req.body.timezone);if(!timezone)return res.status(400).json({error:'Enter a valid IANA timezone such as Asia/Manila.'});updates.push('timezone=?');params.push(timezone);}if(!updates.length)return res.json({success:true,station:weatherPublicStationShape(station)});updates.push('updated_at=CURRENT_TIMESTAMP');params.push(station.id);await dbRun(`UPDATE WeatherStations SET ${updates.join(',')} WHERE id=?`,params);const updated=await weatherFindStation(station.id);logActivity({req,action:'WEATHER_STATION_UPDATED',details:`${updated.display_name} (#${updated.id})`});res.json({success:true,station:weatherPublicStationShape(updated)});}
  catch(error){logError('WEATHER_STATION_UPDATE_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to update weather station.'});}
};

const __routeController511 = async (req,res) => {try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const result=await weatherSyncStationIncremental(station.id,{force:true});logActivity({req,action:'WEATHER_STATION_SYNC',details:`${station.display_name} (#${station.id})`});res.json(result);}catch(error){logError('WEATHER_MANUAL_SYNC_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.message||'Weather synchronization failed.',code:error.code||null,retry_after_seconds:error.retryAfterSeconds||null});}};
const __routeController512 = async (req,res) => {try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const timezone=station.timezone||WEATHER_DEFAULT_TIMEZONE;const startDate=String(req.body?.start_date||'').trim(),endDate=String(req.body?.end_date||'').trim();const from=/^\d{4}-\d{2}-\d{2}$/.test(startDate)?weatherLocalDateRangeUtc(startDate,timezone).start:weatherParseTimestamp(req.body?.start??req.body?.from);const to=/^\d{4}-\d{2}-\d{2}$/.test(endDate)?weatherLocalDateRangeUtc(endDate,timezone).end:weatherParseTimestamp(req.body?.end??req.body?.to);const job=await weatherQueueBackfill({stationId:station.id,fromTs:from,toTs:to,userId:req.user.id});logActivity({req,action:'WEATHER_HISTORY_RESYNC_QUEUED',details:`${station.display_name}: ${weatherUtcIso(from)} to ${weatherUtcIso(to)}`});res.status(202).json({job});}catch(error){res.status(error.statusCode||500).json({error:error.message||'Unable to queue historical weather synchronization.'});}};

const __routeController513 = async (req,res) => {
  try{const lastDiscovery=await weatherSettingGet('last_discovery_at'),lastError=await weatherSettingGet('last_discovery_error');const stations=await dbAll(`SELECT s.*,ss.cursor_reading_id,ss.initial_backfill_complete,ss.latest_source_reading_id,ss.consecutive_failures,ss.last_error AS sync_state_error,ss.next_allowed_at FROM WeatherStations s LEFT JOIN WeatherSyncState ss ON ss.station_id=s.id ORDER BY s.display_name`);const jobs=await dbAll(`SELECT * FROM WeatherBackfillJobs ORDER BY id DESC LIMIT 25`);res.json({provider:WEATHER_PROVIDER,api_base_url:ZENTRA_API_BASE_URL,api_key_configured:weatherApiKeyConfigured(),sync_interval_default_minutes:WEATHER_SYNC_INTERVAL_MINUTES,discovery_interval_minutes:WEATHER_DISCOVERY_INTERVAL_MINUTES,last_discovery_at:lastDiscovery||null,last_discovery_error:lastError||null,scheduler_running:Boolean(weatherSchedulerTimer),stations:stations.map(s=>({...weatherPublicStationShape(s),sync_state:{cursor_reading_id:Number(s.cursor_reading_id||0),initial_backfill_complete:Boolean(s.initial_backfill_complete),latest_source_reading_id:s.latest_source_reading_id,consecutive_failures:Number(s.consecutive_failures||0),last_error:s.sync_state_error||null,next_allowed_at:s.next_allowed_at||null}})),backfill_jobs:jobs});}
  catch(error){logError('WEATHER_ADMIN_STATUS_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load weather integration status.'});}
};
const __routeController514 = async (req,res) => {try{const result=await weatherDiscoverStations({force:true});logActivity({req,action:'WEATHER_DEVICE_DISCOVERY',details:`Discovered ${result.discovered||0} station(s)`});res.json({discovered:result.discovered||0,stations:(result.stations||[]).map(weatherPublicStationShape),last_discovery_at:result.last_discovery_at});}catch(error){logError('WEATHER_MANUAL_DISCOVERY_FAILED',error.message,error.stack);res.status(error.statusCode||500).json({error:error.message||'ZENTRA discovery failed.',code:error.code||null,retry_after_seconds:error.retryAfterSeconds||null});}};

const __routeController515 = async (req,res) => {try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const rules=await dbAll(`SELECT * FROM WeatherAlertRules WHERE station_id=? ORDER BY id`,[station.id]);const events=await dbAll(`SELECT * FROM WeatherAlertEvents WHERE station_id=? ORDER BY datetime(triggered_at) DESC LIMIT 100`,[station.id]);res.json({rules,events});}catch(error){res.status(500).json({error:'Unable to load weather alert rules.'});}};
const weatherAllowedAlertTypes=new Set(['heavy_rainfall','high_temperature','low_temperature','strong_wind','extended_dry_period','high_vpd','low_soil_moisture','station_offline','sensor_error','missing_data']);
const weatherNormalizeAlertRuleBody = body => {const type=String(body?.alert_type||'').trim();if(!weatherAllowedAlertTypes.has(type))throw Object.assign(new Error('Unsupported weather alert type.'),{statusCode:400});const threshold=body?.threshold!==null&&body?.threshold!==undefined&&String(body.threshold).trim()!==''&&Number.isFinite(Number(body.threshold))?Number(body.threshold):null;const automaticTypes=new Set(['station_offline','sensor_error','missing_data']);if(!automaticTypes.has(type)&&threshold===null)throw Object.assign(new Error('A numeric threshold is required for this weather alert type.'),{statusCode:400});return {alert_type:type,measurement_key:Object.hasOwn(body||{},'measurement_key')?String(body.measurement_key||'').trim().slice(0,100)||null:type==='heavy_rainfall'?'rain_rate':null,comparator:['gte','gt','lte','lt'].includes(body?.comparator)?body.comparator:(['low_temperature','low_soil_moisture'].includes(type)?'lte':'gte'),threshold,secondary_threshold:Number.isFinite(Number(body?.secondary_threshold))?Number(body.secondary_threshold):null,duration_minutes:Number.isFinite(Number(body?.duration_minutes))?Math.max(0,Math.round(Number(body.duration_minutes))):null,enabled:body?.enabled===false?0:1,notification_enabled:body?.notification_enabled===false?0:1,label:String(body?.label||type.replace(/_/g,' ')).trim().slice(0,160)};};
const __routeController516 = async (req,res) => {try{const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});const r=weatherNormalizeAlertRuleBody(req.body);const result=await dbRun(`INSERT INTO WeatherAlertRules(station_id,alert_type,measurement_key,comparator,threshold,secondary_threshold,duration_minutes,enabled,notification_enabled,label,created_by_user_id,updated_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[station.id,r.alert_type,r.measurement_key,r.comparator,r.threshold,r.secondary_threshold,r.duration_minutes,r.enabled,r.notification_enabled,r.label,req.user.id,req.user.id]);res.status(201).json({rule:await dbGet(`SELECT * FROM WeatherAlertRules WHERE id=?`,[result.lastID])});}catch(error){res.status(error.statusCode||500).json({error:error.message||'Unable to create weather alert rule.'});}};
const __routeController517 = async (req,res) => {try{const existing=await dbGet(`SELECT * FROM WeatherAlertRules WHERE id=?`,[Number(req.params.ruleId)]);if(!existing)return res.status(404).json({error:'Weather alert rule not found.'});const r=weatherNormalizeAlertRuleBody({...existing,...req.body});await dbRun(`UPDATE WeatherAlertRules SET alert_type=?,measurement_key=?,comparator=?,threshold=?,secondary_threshold=?,duration_minutes=?,enabled=?,notification_enabled=?,label=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[r.alert_type,r.measurement_key,r.comparator,r.threshold,r.secondary_threshold,r.duration_minutes,r.enabled,r.notification_enabled,r.label,req.user.id,existing.id]);res.json({rule:await dbGet(`SELECT * FROM WeatherAlertRules WHERE id=?`,[existing.id])});}catch(error){res.status(error.statusCode||500).json({error:error.message||'Unable to update weather alert rule.'});}};
const __routeController518 = async (req,res) => {try{const existing=await dbGet(`SELECT * FROM WeatherAlertRules WHERE id=?`,[Number(req.params.ruleId)]);if(!existing)return res.status(404).json({error:'Weather alert rule not found.'});await dbRun(`DELETE FROM WeatherAlertRules WHERE id=?`,[existing.id]);res.json({success:true});}catch(error){res.status(500).json({error:'Unable to delete weather alert rule.'});}};

// Only manage_weather_integration users may set or remove the system-wide API key.
// The cleartext token is never returned by these endpoints, logged or sent to clients.
const weatherCredentialStatusController = (req,res) => res.json({
  provider:WEATHER_PROVIDER,api_base_url:ZENTRA_API_BASE_URL,
  configured:weatherApiKeyConfigured(),
  storage:fs.existsSync(WEATHER_CREDENTIAL_FILE)?'encrypted_persistent':'environment_or_none'
});
const weatherSaveCredentialController = async (req,res) => {
  const apiKey=String(req.body?.api_key||'').trim();
  if(apiKey.length<12 || apiKey.length>2048 || /[\r\n]/.test(apiKey))return res.status(400).json({error:'Enter a valid API token (12–2048 characters).'});
  try {
    // Provider test before commit; never replace a working key with one that cannot authenticate.
    await weatherApiFetch('/devices',{query:{page_num:1,limit:1,units:'metric'},apiKey});
    weatherWriteApiCredential(apiKey);
    ZENTRA_API_KEY=apiKey;
    await weatherSettingSet('last_discovery_at','');
    logActivity({req,action:'WEATHER_PROVIDER_CREDENTIAL_UPDATED',details:'ZENTRA integration token updated by authorized administrator; token redacted'});
    let result=null,warning=null;
    try { result=await weatherDiscoverStations({force:true}); }
    catch(e) {warning=e.message||'Station discovery failed. Run Discover Stations to retry.';}
    res.json({success:true,configured:true,discovered:result?.discovered||0,warning});
  } catch(e) {
    res.status(e.statusCode===502?400:e.statusCode||500).json({error:e.statusCode?e.message:'Unable to save API credential.'});
  }
};
const weatherRemoveCredentialController = async (req,res) => {
  try {
    if(fs.existsSync(WEATHER_CREDENTIAL_FILE))fs.unlinkSync(WEATHER_CREDENTIAL_FILE);
    ZENTRA_API_KEY=String(process.env.ZENTRA_API_KEY||'').trim();
    logActivity({req,action:'WEATHER_PROVIDER_CREDENTIAL_CLEARED',details:'ABEARC-managed ZENTRA integration key cleared'});
    res.json({success:true,configured:weatherApiKeyConfigured(),environment_fallback:Boolean(ZENTRA_API_KEY)});
  } catch(e){res.status(500).json({error:'Unable to clear the stored weather credential.'});}
};

const weatherCropAdvisoriesController = async (req,res) => {
  try {const station=await weatherFindStation(req.params.id);if(!station)return res.status(404).json({error:'Weather station not found.'});
    const now=Math.floor(Date.now()/1000); const summary=await weatherSummaryForRange(station,now-32*86400,now+1);
    let forecast=null;
    try {forecast=await weatherGetForecast(station);}catch(_){/* valid observation-only advisory */}
    res.json({station:weatherPublicStationShape(station),generated_at:weatherNowIso(),...weatherBuildCropAdvisories({daily:summary.daily_agriculture||[],forecast,station}),methodology:'Preliminary crop-management screening; not PAGASA alerts or a substitute for field measurements.'});
  }catch(e){logError('WEATHER_CROP_ADVISORY_FAILED',e.message,e.stack);res.status(500).json({error:'Unable to generate crop advisories.'});}
};
const weatherCropAdvisoryLibraryController = (req,res) => res.json({rules:WEATHER_CROP_ADVISORY_LIBRARY,disclaimer:'Screening thresholds are provisional, not official weather alerts or crop-specific validated thresholds.'});
