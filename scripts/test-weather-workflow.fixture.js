(async()=>{
  await ensureWeatherMigration();
  const tables=(await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Weather%' ORDER BY name")).map(r=>r.name);
  assert(tables.includes('WeatherStations')&&tables.includes('WeatherReadings')&&tables.includes('WeatherAlertRules'),'weather migration tables missing');
  const backfillColumns=new Set((await dbAll('PRAGMA table_info(WeatherBackfillJobs)')).map(row=>row.name));
  assert(backfillColumns.has('next_url')&&backfillColumns.has('retry_count')&&backfillColumns.has('next_attempt_at'),'backfill pagination/retry persistence columns missing');
  assert.strictEqual(weatherBackfillErrorIsTransient({code:'WEATHER_PROVIDER_UNREACHABLE'}),true);
  assert.strictEqual(weatherBackfillErrorIsTransient({code:'WEATHER_RATE_LIMITED'}),true);
  assert.strictEqual(weatherBackfillErrorIsTransient({code:'WEATHER_AUTH_REJECTED'}),false);
  const tzInsert=await dbRun("INSERT INTO WeatherStations(provider,provider_device_id,source_name,display_name,timezone) VALUES('zentra','timezone-preserve','Timezone Fixture','Timezone Fixture','Asia/Tokyo')");
  await weatherUpsertStation({provider:'zentra',provider_device_id:'timezone-preserve',source_name:'Timezone Fixture Updated',display_name:'Timezone Fixture Updated',organization_id:null,organization_name:'',device_type:'',model:'',can_read_data:1,latitude:null,longitude:null,elevation:null,elevation_unit:'',timezone:null,location_path:'',logging_interval_minutes:15,upload_frequency_minutes:15,firmware_version:'',hardware_revision:'',connectivity_type:'',subscription_status:'',ports:[],metadata:{},connectivity:{},subscription:{},data_first_timestamp:null,data_last_timestamp:null});
  assert.strictEqual((await dbGet('SELECT timezone FROM WeatherStations WHERE id=?',[tzInsert.lastID])).timezone,'Asia/Tokyo','provider rediscovery must preserve a manager-configured timezone');

  const now=Math.floor(Date.now()/1000); const local=weatherGetTimeParts(now,'Asia/Manila');
  const dateKey=local.year+'-'+String(local.month).padStart(2,'0')+'-'+String(local.day).padStart(2,'0');
  const range=weatherLocalDateRangeUtc(dateKey,'Asia/Manila');
  const base=range.start+8*3600;
  const stationInsert=await dbRun('INSERT INTO WeatherStations(provider,provider_device_id,source_name,display_name,latitude,longitude,elevation,timezone,logging_interval_minutes,upload_frequency_minutes,last_measurement_ts) VALUES(?,?,?,?,?,?,?,?,?,?,?)',['zentra','fixture-device','Fixture AWS','Fixture AWS',7.1,125.6,100,'Asia/Manila',15,15,base+3600]);
  const station=await dbGet('SELECT * FROM WeatherStations WHERE id=?',[stationInsert.lastID]);
  await dbRun('INSERT INTO WeatherSyncState(station_id,cursor_reading_id) VALUES(?,0)',[station.id]);

  const values=[
    {reading_id:1,timestamp:base,port_num:1,sensor_name:'ATMOS 41',measurement:'Air Temperature',value:27,unit:'°C',position:200},
    {reading_id:2,timestamp:base+3600,port_num:1,sensor_name:'ATMOS 41',measurement:'Air Temperature',value:31,unit:'°C',position:200},
    {reading_id:3,timestamp:base,port_num:1,sensor_name:'ATMOS 41',measurement:'Relative Humidity',value:82,unit:'%',position:200},
    {reading_id:4,timestamp:base+3600,port_num:1,sensor_name:'ATMOS 41',measurement:'Relative Humidity',value:70,unit:'%',position:200},
    {reading_id:5,timestamp:base,port_num:1,sensor_name:'ATMOS 41',measurement:'Precipitation',value:0,unit:'mm',position:200},
    {reading_id:6,timestamp:base+3600,port_num:1,sensor_name:'ATMOS 41',measurement:'Precipitation',value:null,unit:'mm',position:200},
    {reading_id:7,timestamp:base,port_num:1,sensor_name:'ATMOS 41',measurement:'Wind Speed',value:3.6,unit:'km/h',position:200},
    {reading_id:8,timestamp:base+3600,port_num:1,sensor_name:'ATMOS 41',measurement:'Wind Speed',value:7.2,unit:'km/h',position:200},
    {reading_id:9,timestamp:base,port_num:1,sensor_name:'ATMOS 41',measurement:'Solar Radiation',value:350,unit:'W/m2',position:200},
    {reading_id:10,timestamp:base+3600,port_num:1,sensor_name:'ATMOS 41',measurement:'Solar Radiation',value:650,unit:'W/m2',position:200},
    {reading_id:11,timestamp:base+1800,port_num:1,sensor_name:'ATMOS 41',measurement:'Reference ET',value:0,unit:'mm',position:200},
    {reading_id:12,timestamp:base+1800,port_num:2,sensor_name:'Soil probe',measurement:'Soil Temperature',value:24,unit:'°C',position:-10,error_code:5}
  ];
  const payload={values,error_codes:{'5':'Fixture sensor error'}};
  const first=await weatherInsertReadings(station,payload); assert.strictEqual(first.inserted,12,'initial insert count');
  const second=await weatherInsertReadings(station,payload); assert.strictEqual(second.inserted,0,'duplicate prevention failed');
  const syncIso=new Date().toISOString();
  await weatherUpdateStationFromReadingPayload(station,{metadata:{device_name:'Fixture AWS Renamed',location:'Malagos Nursery',coordinates:'7.19001, 125.41002',elevation:131,elevation_unit:'m'},sensor_errors:[{port_num:2,error_code:100}]},first,syncIso);
  const refreshedStation=await dbGet('SELECT * FROM WeatherStations WHERE id=?',[station.id]);
  assert.strictEqual(refreshedStation.source_name,'Fixture AWS Renamed');
  assert.strictEqual(Number(refreshedStation.latitude),7.19001); assert.strictEqual(Number(refreshedStation.longitude),125.41002);
  assert.strictEqual(Number(refreshedStation.elevation),131); assert.strictEqual(refreshedStation.location_path,'Malagos Nursery');
  assert.strictEqual(JSON.parse(refreshedStation.sensor_errors_json)[0].error_code,100);
  assert.strictEqual(Number((await dbGet('SELECT COUNT(*) count FROM WeatherReadings WHERE station_id=?',[station.id])).count),12,'duplicate rows persisted');
  const err=await dbGet('SELECT error_message,quality_status FROM WeatherReadings WHERE error_code=5'); assert.strictEqual(err.error_message,'Fixture sensor error'); assert.strictEqual(err.quality_status,'error');
  const missing=await dbGet("SELECT quality_status,value FROM WeatherReadings WHERE normalized_key='precipitation' AND reading_id=6"); assert.strictEqual(missing.quality_status,'missing'); assert.strictEqual(missing.value,null);
  const windSeriesPosition=await dbGet("SELECT position FROM WeatherSeries WHERE normalized_key='wind_speed' LIMIT 1"); assert.strictEqual(windSeriesPosition.position,'200 cm','metric ZENTRA numeric positions must be normalized from cm');
  const soilSeriesPosition=await dbGet("SELECT position FROM WeatherSeries WHERE normalized_key='soil_temperature' LIMIT 1"); assert.strictEqual(soilSeriesPosition.position,'-10 cm','negative ZENTRA position must preserve soil depth');
  const pageInfo=weatherPaginationFromPayload({metadata:{reading_id_max_available:99},pagination:{next_reading_id:77,next_token:null}}); assert.strictEqual(pageInfo.nextReadingId,77); assert.strictEqual(pageInfo.maxAvailable,99);

  const rain=await weatherRainTotals(station,base+4000); assert.strictEqual(rain.today_mm,0,'real zero rainfall must remain zero'); assert(rain.sample_counts.today>=1);
  const emptyInsert=await dbRun("INSERT INTO WeatherStations(provider,provider_device_id,source_name,display_name,timezone) VALUES('zentra','no-rain','No Rain Data','No Rain Data','Asia/Manila')");
  const emptyStation=await dbGet('SELECT * FROM WeatherStations WHERE id=?',[emptyInsert.lastID]); const noRain=await weatherRainTotals(emptyStation,base+4000); assert.strictEqual(noRain.today_mm,null,'missing rainfall must not become zero');

  const current=await weatherCurrentConditions(station); assert(current.readings.some(r=>r.normalized_key==='air_temperature'),'current temperature missing');
  const tempCurrent=current.readings.find(r=>r.normalized_key==='air_temperature'); assert.strictEqual(Number(tempCurrent.value),31,'latest current reading not selected');
  const bulkCurrent=await weatherCurrentConditionsMany([station,emptyStation]); assert.strictEqual(Number(bulkCurrent.get(Number(station.id)).readings.find(r=>r.normalized_key==='air_temperature').value),31,'bulk current-condition query must preserve latest values'); assert.strictEqual(bulkCurrent.get(Number(emptyStation.id)).readings.length,0,'bulk current-condition query must support stations without readings');

  const series=await weatherGetStationSeries(station.id); const rows=await weatherQueryRows({stationId:station.id,startTs:range.start,endTs:range.end});
  const daily=weatherAggregateRows({rows,series,aggregation:'daily',timezone:'Asia/Manila',loggingIntervalMinutes:15});
  const rainAgg=daily.find(r=>r.normalized_key==='precipitation'); assert.strictEqual(rainAgg.sum,0,'rain aggregation must sum genuine zeros without using missing value');
  const tempAgg=daily.find(r=>r.normalized_key==='air_temperature'); assert.strictEqual(tempAgg.min,27); assert.strictEqual(tempAgg.max,31); assert.strictEqual(tempAgg.avg,29);

  const agri=await weatherDailyAgriculture({station,startTs:range.start,endTs:range.end,gddBaseC:10,cropKc:1});
  assert(agri.length>=1,'agricultural daily row missing'); const day=agri.find(d=>d.date===dateKey); assert(day);
  assert.strictEqual(day.rainfall_mm,0); assert.strictEqual(day.et0_mm,0,'station-provided ET0=0 must take precedence'); assert.strictEqual(day.et0_method,'station_reference_et');
  assert(Number.isFinite(day.vpd_avg_kpa)&&day.vpd_avg_kpa>0,'VPD should be available'); assert(Number.isFinite(day.gdd)&&day.gdd>0,'GDD should be available');
  assert.strictEqual(weatherNormalizeWindMs(3.6,'km/h'),1); assert(Math.abs(weatherWindAt2m({value:3.6,unit:'km/h',position:'200 cm'})-1)<1e-9);
  assert.strictEqual(weatherWindAt2m({value:2,unit:'m/s',position:''}),null,'ET0 wind should require known height');
  const fao=weatherFao56Et0Daily({latitude:7.1,elevation:100,dayOfYear:200,tMin:24,tMax:32,tMean:28,rhMean:75,wind2m:2,solarMj:18}); assert(Number.isFinite(fao)&&fao>0&&fao<20,'FAO-56 ET0 plausibility failure');

  const nextTs=range.end+8*3600;
  const tempSeries=series.find(s=>s.normalized_key==='air_temperature');
  await dbRun('INSERT INTO WeatherReadings(station_id,series_id,source_key,reading_id,timestamp_utc,measurement,normalized_key,unit,sensor_name,position,value,quality_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[station.id,tempSeries.id,'later-temp',999,nextTs,'Air Temperature','air_temperature','°C','ATMOS 41','2 m',30,'valid']);
  const later=await weatherDailyAgriculture({station,startTs:range.start,endTs:nextTs+1,gddBaseC:10}); const laterDay=later.at(-1); assert.strictEqual(laterDay.rainfall_mm,null,'day with no rainfall samples must remain unknown');

  const online=weatherStationHealth({...station,last_measurement_ts:now-10*60},now); assert.strictEqual(online.status,'online');
  const offline=weatherStationHealth({...station,last_measurement_ts:now-10*3600},now); assert.strictEqual(offline.status,'offline');
  const davaoRange=weatherLocalDateRangeUtc(dateKey,'Asia/Manila'); assert.strictEqual(davaoRange.end-davaoRange.start,86400,'Davao local day should span 24 hours');

  const transientJob=await weatherQueueBackfill({stationId:station.id,fromTs:range.start,toTs:range.end,userId:1});
  fetchZentraReadingPage=async()=>{throw Object.assign(new Error('fixture network outage'),{code:'WEATHER_PROVIDER_UNREACHABLE'});};
  await assert.rejects(()=>weatherProcessBackfillJob(),/fixture network outage/);
  const transientState=await dbGet('SELECT * FROM WeatherBackfillJobs WHERE id=?',[transientJob.id]);
  assert.strictEqual(transientState.status,'queued','transient backfill failure must stay queued for automatic recovery');
  assert.strictEqual(Number(transientState.retry_count),1,'transient backfill failure must persist retry count');
  assert(transientState.next_attempt_at,'transient backfill failure must persist next attempt time');
  await dbRun("UPDATE WeatherBackfillJobs SET status='completed',next_attempt_at=NULL WHERE id=?",[transientJob.id]);
  const permanentJob=await weatherQueueBackfill({stationId:station.id,fromTs:range.start,toTs:range.end,userId:1});
  fetchZentraReadingPage=async()=>{throw Object.assign(new Error('fixture authentication failure'),{code:'WEATHER_AUTH_REJECTED'});};
  await assert.rejects(()=>weatherProcessBackfillJob(),/fixture authentication failure/);
  const permanentState=await dbGet('SELECT * FROM WeatherBackfillJobs WHERE id=?',[permanentJob.id]);
  assert.strictEqual(permanentState.status,'error','non-transient backfill failure must remain visible as terminal error');

  assert.strictEqual(weatherClassifyMeasurement({measurement:'Max Precip Rate',unit:'mm/hr'}).normalizedKey,'rain_rate');
  assert.strictEqual(weatherVpdKpa(null,50),null);
  assert.strictEqual(weatherDailyGdd(null,30,10),null);
  assert.strictEqual(weatherAggregateValues([{quality_status:'valid',value:null}],'sum').value,null);
  assert.strictEqual(weatherFao56Et0Daily({latitude:7,dayOfYear:100,tMin:20,tMax:30,tMean:25,rhMean:70,wind2m:null,solarMj:12}),null);
  console.log('Weather workflow tests passed: migration, normalization, object error codes, duplicate prevention, missing-vs-zero rainfall, current conditions, aggregation, VPD/GDD/ET0 safeguards, timezone, station health, and durable backfill recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
