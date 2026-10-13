let weatherSchedulerTimer = null;
let weatherSchedulerBusy = false;
let weatherDiscoveryBusy = false;
const weatherStationLocks = new Set();

const weatherSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const weatherNowIso = () => new Date().toISOString();
const weatherSettingGet = async key => (await dbGet(`SELECT setting_value FROM WeatherSystemSettings WHERE setting_key=?`, [key]))?.setting_value || '';
const weatherSettingSet = async (key, value) => dbRun(`INSERT INTO WeatherSystemSettings(setting_key,setting_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP`, [key, String(value ?? '')]);

const weatherUpsertStation = async device => {
  const existing = await dbGet(`SELECT * FROM WeatherStations WHERE provider=? AND provider_device_id=?`, [device.provider, device.provider_device_id]);
  const syncMinutes = existing?.sync_interval_minutes || WEATHER_SYNC_INTERVAL_MINUTES;
  const displayName = existing?.display_name || device.display_name || device.source_name;
  if (existing) {
    await dbRun(`UPDATE WeatherStations SET
      source_name=?, organization_id=?, organization_name=?, device_type=?, model=?, can_read_data=?, latitude=?, longitude=?, elevation=?, elevation_unit=?,
      timezone=?, location_path=?, logging_interval_minutes=?, upload_frequency_minutes=?, firmware_version=?, hardware_revision=?, connectivity_type=?, subscription_status=?,
      ports_json=?, metadata_json=?, connectivity_json=?, subscription_json=?, data_first_timestamp=?, data_last_timestamp=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`, [device.source_name,device.organization_id,device.organization_name,device.device_type,device.model,device.can_read_data,device.latitude,device.longitude,device.elevation,device.elevation_unit,
      existing.timezone || device.timezone || WEATHER_DEFAULT_TIMEZONE,device.location_path,device.logging_interval_minutes,device.upload_frequency_minutes,device.firmware_version,device.hardware_revision,device.connectivity_type,device.subscription_status,
      JSON.stringify(device.ports||[]),JSON.stringify(device.metadata||{}),JSON.stringify(device.connectivity||{}),JSON.stringify(device.subscription||{}),device.data_first_timestamp,device.data_last_timestamp,existing.id]);
    await dbRun(`INSERT OR IGNORE INTO WeatherSyncState(station_id,cursor_reading_id) VALUES(?,0)`, [existing.id]);
    return { ...existing, ...device, id: existing.id, display_name: displayName, timezone: existing.timezone || device.timezone || WEATHER_DEFAULT_TIMEZONE, sync_interval_minutes: syncMinutes };
  }
  const result = await dbRun(`INSERT INTO WeatherStations(
    provider,provider_device_id,source_name,display_name,organization_id,organization_name,device_type,model,can_read_data,latitude,longitude,elevation,elevation_unit,
    timezone,location_path,logging_interval_minutes,upload_frequency_minutes,firmware_version,hardware_revision,connectivity_type,subscription_status,sync_interval_minutes,
    ports_json,metadata_json,connectivity_json,subscription_json,data_first_timestamp,data_last_timestamp
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    device.provider,device.provider_device_id,device.source_name,displayName,device.organization_id,device.organization_name,device.device_type,device.model,device.can_read_data,device.latitude,device.longitude,device.elevation,device.elevation_unit,
    device.timezone||WEATHER_DEFAULT_TIMEZONE,device.location_path,device.logging_interval_minutes,device.upload_frequency_minutes,device.firmware_version,device.hardware_revision,device.connectivity_type,device.subscription_status,WEATHER_SYNC_INTERVAL_MINUTES,
    JSON.stringify(device.ports||[]),JSON.stringify(device.metadata||{}),JSON.stringify(device.connectivity||{}),JSON.stringify(device.subscription||{}),device.data_first_timestamp,device.data_last_timestamp
  ]);
  await dbRun(`INSERT OR IGNORE INTO WeatherSyncState(station_id,cursor_reading_id) VALUES(?,0)`, [result.lastID]);
  return { id: result.lastID, ...device, display_name: displayName, sync_interval_minutes: WEATHER_SYNC_INTERVAL_MINUTES };
};

const weatherDiscoverStations = async ({ force = false } = {}) => {
  if (weatherDiscoveryBusy) return { skipped: true, reason: 'discovery_in_progress' };
  const last = await weatherSettingGet('last_discovery_at');
  if (!force && last) {
    const ageMin = (Date.now() - Date.parse(last)) / 60000;
    if (Number.isFinite(ageMin) && ageMin < WEATHER_DISCOVERY_INTERVAL_MINUTES) return { skipped: true, reason: 'not_due', last_discovery_at: last };
  }
  weatherDiscoveryBusy = true;
  try {
    if (WEATHER_PROVIDER !== 'zentra') throw new WeatherProviderError(`Unsupported weather provider: ${WEATHER_PROVIDER}`, { statusCode: 503, code: 'WEATHER_PROVIDER_UNSUPPORTED' });
    const devices = await discoverZentraDevices();
    const stations = [];
    for (const device of devices) stations.push(await weatherUpsertStation(device));
    const now = weatherNowIso();
    await weatherSettingSet('last_discovery_at', now);
    await weatherSettingSet('last_discovery_error', '');
    return { discovered: stations.length, stations, last_discovery_at: now };
  } catch (error) {
    await weatherSettingSet('last_discovery_error', error.message || 'Discovery failed.');
    throw error;
  } finally { weatherDiscoveryBusy = false; }
};

const weatherExtractPayloadValues = payload => {
  if (Array.isArray(payload?.values)) return payload.values;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.readings)) return payload.readings;
  if (Array.isArray(payload)) return payload;
  const out = [];
  // Defensive support for responses grouped by reading/port while preserving actual API fields.
  for (const container of [payload?.data, payload?.readings, payload?.values]) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    Object.values(container).forEach(v => { if (Array.isArray(v)) out.push(...v); });
  }
  return out;
};

const weatherErrorMapFromPayload = payload => {
  const map = new Map();
  const source = payload?.error_codes;
  if (Array.isArray(source)) {
    source.forEach(item => {
      const code = Number(item?.code ?? item?.error_code);
      if (Number.isFinite(code)) map.set(code, String(item?.message || item?.description || item?.name || `Sensor error ${code}`));
    });
  } else if (source && typeof source === 'object') {
    Object.entries(source).forEach(([rawCode, description]) => {
      const code = Number(rawCode);
      if (Number.isFinite(code)) map.set(code, String(description || `Sensor error ${code}`));
    });
  }
  return map;
};

const weatherReadingSourceKey = (station, reading) => crypto.createHash('sha1').update([
  station.provider_device_id, reading.readingId ?? '', reading.timestamp, reading.portNum ?? '', reading.measurement, reading.sensorName, reading.position, reading.statistic
].join('|')).digest('hex');

const weatherEnsureSeries = async (stationId, reading, cache) => {
  const key = reading.seriesKey;
  if (cache.has(key)) return cache.get(key);
  let row = await dbGet(`SELECT * FROM WeatherSeries WHERE station_id=? AND series_key=?`, [stationId,key]);
  if (!row) {
    const result = await dbRun(`INSERT OR IGNORE INTO WeatherSeries(station_id,series_key,port_num,measurement,normalized_key,unit,sensor_name,position,aggregation_method,category,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [stationId,key,reading.portNum == null?null:String(reading.portNum),reading.measurement,reading.normalizedKey,reading.unit,reading.sensorName,reading.position,reading.aggregationMethod,reading.category,'{}']);
    row = result.lastID ? await dbGet(`SELECT * FROM WeatherSeries WHERE id=?`,[result.lastID]) : await dbGet(`SELECT * FROM WeatherSeries WHERE station_id=? AND series_key=?`,[stationId,key]);
  } else {
    await dbRun(`UPDATE WeatherSeries SET normalized_key=?,unit=?,aggregation_method=?,category=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?`, [reading.normalizedKey,reading.unit,reading.aggregationMethod,reading.category,row.id]);
    row = { ...row, normalized_key: reading.normalizedKey, unit: reading.unit, aggregation_method: reading.aggregationMethod, category: reading.category };
  }
  cache.set(key,row);
  return row;
};

const weatherInsertReadings = async (station, payload) => {
  const rawValues = weatherExtractPayloadValues(payload);
  const metadata = { ...(payload?.metadata || {}), position_unit: payload?.metadata?.position_unit || 'cm' };
  const errorMap = weatherErrorMapFromPayload(payload);
  const normalized = rawValues.map(raw => weatherNormalizeReadingValue(raw, metadata)).filter(Boolean);
  const seriesCache = new Map();
  const prepared = [];
  let latestTs = Number(station.last_measurement_ts || 0) || 0;
  let maxReadingId = null;
  for (const reading of normalized) {
    const series = await weatherEnsureSeries(station.id, reading, seriesCache);
    const errorMessage = reading.errorCode ? (errorMap.get(reading.errorCode) || `Sensor error ${reading.errorCode}`) : null;
    const quality = reading.errorCode ? 'error' : (reading.value === null ? 'missing' : 'valid');
    latestTs = Math.max(latestTs, reading.timestamp || 0);
    if (Number.isFinite(reading.readingId)) maxReadingId = maxReadingId === null ? reading.readingId : Math.max(maxReadingId, reading.readingId);
    prepared.push([station.id,series.id,weatherReadingSourceKey(station,reading),reading.readingId,reading.timestamp,reading.datetimeSource,reading.portNum == null?null:String(reading.portNum),reading.measurement,reading.normalizedKey,reading.unit,reading.sensorName,reading.position,reading.value,reading.errorCode,errorMessage,reading.statistic,quality]);
  }
  if (!prepared.length) return { received: rawValues.length, normalized: 0, inserted: 0, latestTs, maxReadingId };
  const inserted = await new Promise((resolve,reject) => {
    let count = 0;
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      const stmt = db.prepare(`INSERT OR IGNORE INTO WeatherReadings(station_id,series_id,source_key,reading_id,timestamp_utc,datetime_source,port_num,measurement,normalized_key,unit,sensor_name,position,value,error_code,error_message,statistic,quality_status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      let failed = false;
      prepared.forEach(params => stmt.run(params,function(err){ if (err) failed=true; else count += Number(this.changes||0); }));
      stmt.finalize(err => {
        if (err || failed) return db.run('ROLLBACK', () => reject(err || new Error('Failed to insert weather readings.')));
        db.run('COMMIT', commitErr => commitErr ? reject(commitErr) : resolve(count));
      });
    });
  });
  return { received: rawValues.length, normalized: prepared.length, inserted, latestTs, maxReadingId };
};

const weatherPaginationFromPayload = payload => {
  const p = payload?.pagination || {};
  const nextReadingRaw = p.next_reading_id ?? payload?.next_reading_id ?? null;
  const nextReadingId = Number.isFinite(Number(nextReadingRaw)) ? Number(nextReadingRaw) : null;
  const maxRaw = payload?.metadata?.reading_id_max_available ?? p.reading_id_max_available ?? null;
  const maxAvailable = Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;
  const nextToken = p.next_token ?? payload?.next_token ?? null;
  const nextUrl = weatherValidateZentraNextUrl(p.next_url ?? payload?.next_url ?? null);
  return { nextReadingId, maxAvailable, nextToken: nextToken ? String(nextToken) : null, nextUrl };
};

const weatherCoordinatesFromReadingMetadata = metadata => {
  const raw = metadata?.coordinates;
  if (Array.isArray(raw) && raw.length >= 2) {
    const latitude = Number(raw[0]);
    const longitude = Number(raw[1]);
    return {
      latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
      longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null
    };
  }
  const match = String(raw || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: null, longitude: null };
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return {
    latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null
  };
};

const weatherUpdateStationFromReadingPayload = async (station, payload, persist, successAt = null) => {
  const metadata = payload?.metadata || {};
  const coordinates = weatherCoordinatesFromReadingMetadata(metadata);
  const elevation = Number(metadata.elevation);
  const sourceName = String(metadata.device_name || '').trim();
  const locationPath = String(metadata.location || '').trim();
  const elevationUnit = String(metadata.elevation_unit || '').trim();
  const errorMap = weatherErrorMapFromPayload(payload);
  const sensorErrors = JSON.stringify((Array.isArray(payload?.sensor_errors) ? payload.sensor_errors : []).map(item => {
    const code = Number(item?.error_code);
    return { ...item, description: Number.isFinite(code) ? (errorMap.get(code) || item?.description || `Sensor error ${code}`) : (item?.description || 'Sensor error') };
  }));
  const latestTs = Number(persist?.latestTs || 0);
  await dbRun(`UPDATE WeatherStations SET
    source_name=CASE WHEN ?<>'' THEN ? ELSE source_name END,
    latitude=COALESCE(?,latitude),longitude=COALESCE(?,longitude),
    elevation=COALESCE(?,elevation),
    elevation_unit=CASE WHEN ?<>'' THEN ? ELSE elevation_unit END,
    location_path=CASE WHEN ?<>'' THEN ? ELSE location_path END,
    last_measurement_ts=CASE WHEN ? > COALESCE(last_measurement_ts,0) THEN ? ELSE last_measurement_ts END,
    last_successful_sync_at=COALESCE(?,last_successful_sync_at),last_sync_error=CASE WHEN ? IS NOT NULL THEN NULL ELSE last_sync_error END,
    sensor_errors_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
      sourceName,sourceName,coordinates.latitude,coordinates.longitude,
      Number.isFinite(elevation)?elevation:null,elevationUnit,elevationUnit,locationPath,locationPath,
      latestTs,latestTs,successAt,successAt,sensorErrors,station.id
    ]);
};

const weatherRecordSyncRunStart = async ({ stationId, mode, startTs = null, endTs = null, cursorBefore = null }) => {
  const startedAt = weatherNowIso();
  const result = await dbRun(`INSERT INTO WeatherSyncRuns(station_id,mode,status,requested_from_ts,requested_to_ts,cursor_before,started_at) VALUES(?,?,?,?,?,?,?)`, [stationId,mode,'running',startTs,endTs,cursorBefore,startedAt]);
  return { id: result.lastID, startedAt };
};
const weatherRecordSyncRunEnd = async (runId, { status, cursorAfter = null, received = 0, inserted = 0, error = null }) => dbRun(`UPDATE WeatherSyncRuns SET status=?,cursor_after=?,rows_received=?,rows_inserted=?,completed_at=?,error_message=? WHERE id=?`, [status,cursorAfter,received,inserted,weatherNowIso(),error,runId]);

const weatherSyncStationIncremental = async (stationId, { force = false } = {}) => {
  if (weatherStationLocks.has(Number(stationId))) return { skipped:true,reason:'station_sync_in_progress' };
  const station = await dbGet(`SELECT * FROM WeatherStations WHERE id=?`,[stationId]);
  if (!station || !station.enabled || !station.can_read_data) return { skipped:true,reason:'station_disabled_or_unreadable' };
  const state = await dbGet(`SELECT * FROM WeatherSyncState WHERE station_id=?`,[stationId]) || { cursor_reading_id:0,consecutive_failures:0 };
  if (!force && state.next_allowed_at && Date.parse(state.next_allowed_at) > Date.now()) return { skipped:true,reason:'backoff',next_allowed_at:state.next_allowed_at };
  if (!force && state.last_attempt_at) {
    const ageMin = (Date.now()-Date.parse(state.last_attempt_at))/60000;
    // While the initial cursor walk is still catching up, advance at most once per
    // scheduler minute. After catch-up, use the station's configured steady-state interval.
    const dueMinutes = Number(state.initial_backfill_complete||0) ? Math.max(5,Number(station.sync_interval_minutes||WEATHER_SYNC_INTERVAL_MINUTES)) : 1;
    if (Number.isFinite(ageMin) && ageMin < dueMinutes) return { skipped:true,reason:'not_due' };
  }
  weatherStationLocks.add(Number(stationId));
  const cursorBefore = Math.max(0,Number(state.cursor_reading_id||0));
  const run = await weatherRecordSyncRunStart({ stationId,mode:'incremental',cursorBefore });
  await dbRun(`UPDATE WeatherSyncState SET last_attempt_at=? WHERE station_id=?`,[run.startedAt,stationId]);
  await dbRun(`UPDATE WeatherStations SET last_sync_attempt_at=? WHERE id=?`,[run.startedAt,stationId]);
  try {
    const payload = await fetchZentraReadingPage(station.provider_device_id,{sinceReadingId:cursorBefore});
    const persist = await weatherInsertReadings(station,payload);
    const pagination = weatherPaginationFromPayload(payload);
    const finished = pagination.nextReadingId === null;
    let cursorAfter = cursorBefore;
    // ZENTRA documents next_reading_id as the authoritative exclusive continuation
    // cursor. Some reading IDs can legitimately contain no values visible to this API
    // key, so using only the highest observed value can repeatedly fetch the same page.
    if (pagination.nextReadingId !== null) cursorAfter = Math.max(cursorAfter, pagination.nextReadingId);
    else {
      if (persist.maxReadingId !== null) cursorAfter = Math.max(cursorAfter, persist.maxReadingId);
      if (pagination.maxAvailable !== null) cursorAfter = Math.max(cursorAfter, pagination.maxAvailable);
    }
    const now = weatherNowIso();
    const initialComplete = finished ? 1 : Number(state.initial_backfill_complete||0);
    await dbRun(`UPDATE WeatherSyncState SET cursor_reading_id=?,initial_backfill_complete=?,latest_source_reading_id=?,last_success_at=?,consecutive_failures=0,last_error=NULL,next_allowed_at=NULL WHERE station_id=?`, [cursorAfter,initialComplete,pagination.maxAvailable??persist.maxReadingId??state.latest_source_reading_id,now,stationId]);
    await weatherUpdateStationFromReadingPayload(station,payload,persist,now);
    await weatherRecordSyncRunEnd(run.id,{status:'success',cursorAfter,received:persist.received,inserted:persist.inserted});
    await weatherEvaluateAlerts(stationId).catch(err => logError('WEATHER_ALERT_EVALUATION_FAILED',err.message,err.stack));
    return { success:true,cursor_before:cursorBefore,cursor_after:cursorAfter,finished_initial_backfill:Boolean(initialComplete),...persist };
  } catch (error) {
    const failures = Number(state.consecutive_failures||0)+1;
    const providerDelay = Number(error.retryAfterSeconds||0);
    const backoffSec = Math.max(providerDelay,Math.min(6*3600,60*Math.pow(2,Math.min(8,failures-1))));
    const nextAllowed = new Date(Date.now()+backoffSec*1000).toISOString();
    await dbRun(`UPDATE WeatherSyncState SET consecutive_failures=?,last_error=?,next_allowed_at=? WHERE station_id=?`,[failures,String(error.message||'Weather sync failed.').slice(0,1000),nextAllowed,stationId]);
    await dbRun(`UPDATE WeatherStations SET last_sync_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[String(error.message||'Weather sync failed.').slice(0,1000),stationId]);
    await weatherRecordSyncRunEnd(run.id,{status:'error',cursorAfter:cursorBefore,error:String(error.message||'Weather sync failed.').slice(0,1000)});
    throw error;
  } finally { weatherStationLocks.delete(Number(stationId)); }
};

const weatherQueueBackfill = async ({ stationId, fromTs, toTs, userId = null }) => {
  if (!Number.isFinite(Number(fromTs)) || !Number.isFinite(Number(toTs)) || Number(fromTs) >= Number(toTs)) throw Object.assign(new Error('A valid historical date range is required.'),{statusCode:400});
  const active = await dbGet(`SELECT id FROM WeatherBackfillJobs WHERE station_id=? AND status IN ('queued','running') LIMIT 1`,[stationId]);
  if (active) throw Object.assign(new Error('This station already has a historical resynchronization queued or running.'),{statusCode:409});
  const result = await dbRun(`INSERT INTO WeatherBackfillJobs(station_id,from_ts,to_ts,created_by_user_id) VALUES(?,?,?,?)`,[stationId,Math.floor(fromTs),Math.floor(toTs),userId]);
  return dbGet(`SELECT * FROM WeatherBackfillJobs WHERE id=?`,[result.lastID]);
};

const weatherBackfillErrorIsTransient = error => ['WEATHER_RATE_LIMITED','WEATHER_PROVIDER_TIMEOUT','WEATHER_PROVIDER_UNREACHABLE','WEATHER_PROVIDER_SERVER_ERROR'].includes(String(error?.code || ''));
const weatherBackfillRetryDelaySeconds = (error, retryCount) => Math.max(Number(error?.retryAfterSeconds || 0), Math.min(6 * 3600, 60 * Math.pow(2, Math.min(8, Math.max(0, Number(retryCount || 0))))));

const weatherProcessBackfillJob = async () => {
  const job = await dbGet(`SELECT j.*,s.provider_device_id FROM WeatherBackfillJobs j JOIN WeatherStations s ON s.id=j.station_id WHERE j.status IN ('queued','running') AND (j.next_attempt_at IS NULL OR datetime(j.next_attempt_at) <= datetime('now')) ORDER BY CASE j.status WHEN 'running' THEN 0 ELSE 1 END,j.created_at ASC LIMIT 1`);
  if (!job || weatherStationLocks.has(Number(job.station_id))) return null;
  const station = await dbGet(`SELECT * FROM WeatherStations WHERE id=?`,[job.station_id]);
  if (!station) return null;
  weatherStationLocks.add(Number(job.station_id));
  const run = await weatherRecordSyncRunStart({stationId:job.station_id,mode:'backfill',startTs:job.from_ts,endTs:job.to_ts});
  try {
    await dbRun(`UPDATE WeatherBackfillJobs SET status='running',started_at=COALESCE(started_at,?),next_attempt_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[weatherNowIso(),job.id]);
    const payload = await fetchZentraReadingPage(job.provider_device_id,{startTs:job.from_ts,endTs:job.to_ts,nextToken:job.next_token||null,nextUrl:job.next_url||null,direction:'asc'});
    const persist = await weatherInsertReadings(station,payload);
    const pagination = weatherPaginationFromPayload(payload);
    if (pagination.nextToken || pagination.nextUrl) {
      // Prefer the opaque token, but retain the already-origin-validated next_url as a
      // fallback because ZENTRA may evolve its pagination envelope without a token field.
      let token = pagination.nextToken;
      if (!token && pagination.nextUrl) { try { token = new URL(pagination.nextUrl).searchParams.get('next_token'); } catch (_) {} }
      await dbRun(`UPDATE WeatherBackfillJobs SET next_token=?,next_url=?,retry_count=0,next_attempt_at=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[token,pagination.nextUrl||null,job.id]);
    } else {
      await dbRun(`UPDATE WeatherBackfillJobs SET status='completed',completed_at=?,next_token=NULL,next_url=NULL,retry_count=0,next_attempt_at=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[weatherNowIso(),job.id]);
    }
    await weatherUpdateStationFromReadingPayload(station,payload,persist,weatherNowIso());
    await weatherRecordSyncRunEnd(run.id,{status:'success',received:persist.received,inserted:persist.inserted});
    return {job_id:job.id,station_id:Number(job.station_id),completed:!(pagination.nextToken||pagination.nextUrl),...persist};
  } catch(error) {
    const message = String(error.message || 'Backfill failed.').slice(0,1000);
    const transient = weatherBackfillErrorIsTransient(error);
    if (transient) {
      const retryCount = Number(job.retry_count || 0) + 1;
      const retryAt = new Date(Date.now() + weatherBackfillRetryDelaySeconds(error, retryCount - 1) * 1000).toISOString();
      await dbRun(`UPDATE WeatherBackfillJobs SET status='queued',retry_count=?,next_attempt_at=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[retryCount,retryAt,message,job.id]);
    } else {
      await dbRun(`UPDATE WeatherBackfillJobs SET status='error',next_attempt_at=NULL,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[message,job.id]);
    }
    await weatherRecordSyncRunEnd(run.id,{status:'error',error:message});
    error.weatherStationId = Number(job.station_id);
    throw error;
  } finally { weatherStationLocks.delete(Number(job.station_id)); }
};

const weatherRuleCondition = (rule,value) => {
  if (value===null||value===undefined||value===''||!Number.isFinite(Number(value))) return false;
  const v=Number(value),t=Number(rule.threshold);
  if (rule.threshold===null||rule.threshold===undefined||rule.threshold===''||!Number.isFinite(t)) return false;
  if (rule.comparator==='lt') return v<t;
  if (rule.comparator==='lte') return v<=t;
  if (rule.comparator==='gt') return v>t;
  return v>=t;
};

const weatherEvaluateAlerts = async stationId => {
  const station = await dbGet(`SELECT * FROM WeatherStations WHERE id=?`,[stationId]);
  if (!station) return;
  const rules = await dbAll(`SELECT * FROM WeatherAlertRules WHERE station_id=? AND enabled=1`,[stationId]);
  if (!rules.length) return;
  const current = await weatherCurrentConditions(station);
  const currentByKey = new Map(current.readings.map(r=>[r.normalized_key,r]));
  const rain = await weatherRainTotals(station);
  const agri = await weatherDailyAgriculture({station,startTs:Math.floor(Date.now()/1000)-45*86400,endTs:Math.floor(Date.now()/1000)+1,gddBaseC:10});
  let dryDays=0; for(let i=agri.length-1;i>=0;i-=1){ const rainfall=agri[i].rainfall_mm; if(rainfall===null||rainfall===undefined) break; if(Number(rainfall)<1) dryDays+=1; else break; }
  const recipients = await getUsersWithPrivilege('manage_weather_alerts');
  const fallbackRecipients = recipients.length?recipients:await getSuperAdminIdsAsync();
  for(const rule of rules){
    let value=null; let active=false; let suffix='';
    if(rule.alert_type==='station_offline'){ active=['offline','error'].includes(current.health.status); value=current.health.age_minutes; suffix=current.health.label; }
    else if(rule.alert_type==='sensor_error'){ const errors=weatherJsonParse(station.sensor_errors_json,[])||[]; value=errors.length; active=value>0; suffix=value?`${value} sensor error(s) reported`:'No sensor errors'; }
    else if(rule.alert_type==='missing_data'){ value=current.health.age_minutes; active=['delayed','offline','error','unknown'].includes(current.health.status)||current.readings.some(r=>r.quality_status!=='valid'); suffix=`${current.health.label}; latest data ${value==null?'unavailable':`${Number(value).toFixed(0)} min old`}`; }
    else if(rule.alert_type==='heavy_rainfall'){
      if(rule.measurement_key==='rain_rate'){
        const row=currentByKey.get('rain_rate'),scale=({'mm/hr':1,'mm/h':1,'cm/hr':10,'in/hr':25.4})[row?.unit];
        value=row?.quality_status==='valid'&&scale&&weatherFinite(row.value)!==null?Number(row.value)*scale:null;
        suffix=value===null?'Rain rate unavailable':`${value.toFixed(1)} mm/hr`;
      }else{
        // Keep existing 24-hour thresholds in mm; new rules use rain_rate.
        value=rain.last_24h_mm;suffix=value==null?'24-hour rainfall unavailable':`${Number(value).toFixed(1)} mm in 24 h`;
      }
      active=weatherRuleCondition({...rule,comparator:rule.comparator||'gte'},value);
    }
    else if(rule.alert_type==='extended_dry_period'){ value=dryDays; active=weatherRuleCondition({...rule,comparator:rule.comparator||'gte'},value); suffix=`${dryDays} consecutive dry day(s)`; }
    else if(rule.alert_type==='high_vpd'){
      const t=currentByKey.get('air_temperature')?.value,rh=currentByKey.get('relative_humidity')?.value; value=weatherVpdKpa(t,rh); active=weatherRuleCondition({...rule,comparator:rule.comparator||'gte'},value); suffix=value==null?'VPD unavailable':`${value.toFixed(2)} kPa`;
    } else {
      const key=rule.measurement_key || ({high_temperature:'air_temperature',low_temperature:'air_temperature',strong_wind:'wind_gust',low_soil_moisture:'soil_water_content'}[rule.alert_type]);
      const row=rule.alert_type==='strong_wind'?(currentByKey.get(key)||currentByKey.get('wind_speed')):currentByKey.get(key);
      value=row?.value;
      active=weatherRuleCondition(rule,value);
      suffix=value==null?'measurement unavailable':`${Number(value).toFixed(2)} ${row?.unit||''}`.trim();
    }
    const eventKey=`${rule.alert_type}:${rule.measurement_key||''}`;
    const existing=await dbGet(`SELECT * FROM WeatherAlertEvents WHERE rule_id=? AND event_key=?`,[rule.id,eventKey]);
    if(active){
      const message=`${rule.label||String(rule.alert_type).replace(/_/g,' ')} — ${station.display_name}: ${suffix}`;
      if(existing) await dbRun(`UPDATE WeatherAlertEvents SET status='active',value=?,message=?,resolved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[value,message,existing.id]);
      else await dbRun(`INSERT INTO WeatherAlertEvents(rule_id,station_id,event_key,status,value,message,triggered_at) VALUES(?,?,?,?,?,?,?)`,[rule.id,station.id,eventKey,'active',value,message,weatherNowIso()]);
      if(rule.notification_enabled && fallbackRecipients.length) insertNotifications({recipients:fallbackRecipients,actorId:null,type:`weather_${rule.alert_type}`,message,targetKind:'weather_station',targetMeta:{station_id:station.id,rule_id:rule.id,alert_type:rule.alert_type},alertKey:`weather:${station.id}:${rule.id}`,includeActor:true,cooldownMinutes:WEATHER_ALERT_COOLDOWN_MINUTES,dedupeMode:'cooldown'});
    } else if(existing?.status==='active') await dbRun(`UPDATE WeatherAlertEvents SET status='resolved',resolved_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[weatherNowIso(),existing.id]);
  }
};

const weatherSchedulerTick = async () => {
  if(weatherSchedulerBusy) return;
  weatherSchedulerBusy=true;
  try{
    if(!ZENTRA_API_KEY) return;
    try{ await weatherDiscoverStations({force:false}); }catch(error){ logError('WEATHER_DISCOVERY_FAILED',error.message,error.stack); }
    let backfillResult=null;
    try{ backfillResult=await weatherProcessBackfillJob(); }catch(error){ backfillResult=error?.weatherStationId?{station_id:Number(error.weatherStationId),failed:true}:null;logError('WEATHER_BACKFILL_FAILED',error.message,error.stack); }
    const stations=await dbAll(`SELECT id FROM WeatherStations WHERE enabled=1 AND can_read_data=1 ORDER BY COALESCE(last_sync_attempt_at,'') ASC,id ASC`);
    for(const station of stations){
      // Avoid a second ZENTRA reading request for the same device in the minute in
      // which a historical backfill page was already fetched.
      if(Number(backfillResult?.station_id)!==Number(station.id)) {
        try{ await weatherSyncStationIncremental(station.id,{force:false}); }
        catch(error){ logError('WEATHER_INCREMENTAL_SYNC_FAILED',`Station ${station.id}: ${error.message}`,error.stack); }
      }
      // Health alerts must still be evaluated when the provider is unreachable; an
      // offline station is exactly the condition that can prevent a successful sync.
      try{ await weatherEvaluateAlerts(station.id); }
      catch(error){ logError('WEATHER_ALERT_EVALUATION_FAILED',`Station ${station.id}: ${error.message}`,error.stack); }
    }
  }finally{ weatherSchedulerBusy=false; }
};

const startWeatherScheduler = () => {
  if(weatherSchedulerTimer) clearInterval(weatherSchedulerTimer);
  weatherSchedulerTimer=setInterval(()=>weatherSchedulerTick().catch(err=>logError('WEATHER_SCHEDULER_FAILED',err.message,err.stack)),60*1000);
  setTimeout(()=>weatherSchedulerTick().catch(err=>logError('WEATHER_SCHEDULER_START_FAILED',err.message,err.stack)),2500);
};
