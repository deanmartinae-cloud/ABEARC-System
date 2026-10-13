const WEATHER_MEASUREMENT_RULES = [
  { key: 'cloud_cover', category: 'atmosphere', aggregate: 'avg_min_max', re: /cloud (?:cover|coverage|fraction)/i },
  { key: 'rain_rate', category: 'rain', aggregate: 'avg_max', re: /(rain rate|precip(?:itation)? rate|rain intensity|mm\/(?:hr|h)\b)/i },
  { key: 'precipitation', category: 'rain', aggregate: 'sum', re: /(precip|rainfall|rain accumulation|rain total|precipitation)/i },
  { key: 'wind_gust', category: 'wind', aggregate: 'max', re: /(wind gust|gust speed|maximum wind)/i },
  { key: 'wind_direction', category: 'wind', aggregate: 'circular_mean', re: /(wind direction|wind dir)/i },
  { key: 'wind_speed', category: 'wind', aggregate: 'avg_max', re: /(wind speed|windspeed)/i },
  { key: 'relative_humidity', category: 'atmosphere', aggregate: 'avg_min_max', re: /(relative humidity|humidity|rh\b)/i },
  { key: 'solar_radiation', category: 'radiation', aggregate: 'avg_max_energy', re: /(solar radiation|solar irradiance|radiation|pyranometer)/i },
  { key: 'atmospheric_pressure', category: 'atmosphere', aggregate: 'avg_min_max', re: /(atmospheric pressure|barometric pressure|barometer|air pressure)/i },
  { key: 'vapor_pressure', category: 'atmosphere', aggregate: 'avg_min_max', re: /(vapor pressure(?! deficit)|vapour pressure(?! deficit))/i },
  { key: 'reference_et', category: 'water', aggregate: 'sum', re: /(reference et|eto\b|et0\b|reference evapotranspiration)/i },
  { key: 'actual_et', category: 'water', aggregate: 'sum', re: /(actual et|evapotranspiration|\bet\b)/i },
  { key: 'lightning_count', category: 'storm', aggregate: 'sum', re: /(lightning.*count|lightning activity|strike count|lightning strikes)/i },
  { key: 'lightning_distance', category: 'storm', aggregate: 'avg_min', re: /(lightning.*distance|strike distance)/i },
  { key: 'leaf_wetness', category: 'plant', aggregate: 'avg_min_max', re: /(leaf wetness|wetness)/i },
  { key: 'soil_water_content', category: 'soil', aggregate: 'avg_min_max', re: /(volumetric water|water content|soil moisture|vwc)/i },
  { key: 'soil_ec', category: 'soil', aggregate: 'avg_min_max', re: /(electrical conductivity|conductivity|bulk ec|pore water ec|soil ec)/i },
  { key: 'soil_matric_potential', category: 'soil', aggregate: 'avg_min_max', re: /(matric potential|water potential|soil potential)/i },
  { key: 'battery_percent', category: 'health', aggregate: 'last', re: /(battery.*percent|battery level|battery state)/i },
  { key: 'battery_voltage', category: 'health', aggregate: 'avg_min_max', re: /(battery voltage|battery volt)/i },
  { key: 'signal_strength', category: 'health', aggregate: 'avg_min_max', re: /(signal strength|rssi|signal quality)/i },
  { key: 'dew_point', category: 'atmosphere', aggregate: 'avg_min_max', re: /(dew point)/i },
  { key: 'temperature', category: 'temperature', aggregate: 'avg_min_max', re: /(temperature|temp\b)/i }
];

const weatherSlug = value => String(value || 'measurement').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'measurement';
const weatherJsonParse = (value, fallback = null) => { try { return JSON.parse(value); } catch (_) { return fallback; } };
const weatherFinite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const weatherTsSeconds = value => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n > 1e12 ? n / 1000 : n);
};
const weatherUtcIso = seconds => Number.isFinite(Number(seconds)) ? new Date(Number(seconds) * 1000).toISOString() : null;

const weatherClassifyMeasurement = ({ measurement = '', sensorName = '', unit = '', position = '' } = {}) => {
  if(/\brh\s+sensor\s+temp/i.test(measurement))return {normalizedKey:'sensor_temperature',category:'health',aggregationMethod:'avg_min_max'};
  const source = `${measurement} ${sensorName} ${unit} ${position}`.trim();
  for (const rule of WEATHER_MEASUREMENT_RULES) {
    if (!rule.re.test(source)) continue;
    if (rule.key === 'temperature') {
      const semanticSoil = /(soil|teros|substrate|root|media|probe|depth)/i.test(`${sensorName} ${measurement}`);
      const belowGround = /^\s*-\d/.test(String(position || ''));
      const soilLike = semanticSoil || belowGround;
      return { normalizedKey: soilLike ? 'soil_temperature' : 'air_temperature', category: soilLike ? 'soil' : 'atmosphere', aggregationMethod: 'avg_min_max' };
    }
    return { normalizedKey: rule.key, category: rule.category, aggregationMethod: rule.aggregate };
  }
  return { normalizedKey: `other_${weatherSlug(measurement)}`, category: 'other', aggregationMethod: 'avg' };
};

const weatherSeriesKey = value => [value.port_num ?? value.port ?? '', value.measurement ?? value.measurement_name ?? '', value.sensor_name ?? value.sensorName ?? '', value.position ?? '', value.unit ?? '']
  .map(v => String(v ?? '').trim().toLowerCase()).join('|');

const weatherNormalizeReadingValue = (raw, metadata = {}) => {
  const measurement = String(raw.measurement ?? raw.measurement_name ?? raw.name ?? metadata.measurement ?? '').trim();
  if (!measurement) return null;
  const sensorName = String(raw.sensor_name ?? raw.sensor ?? raw.sensor_short_name ?? metadata.sensor_name ?? '').trim();
  const rawPosition = raw.position ?? metadata.position ?? null;
  const positionUnit = String(raw.position_unit ?? metadata.position_unit ?? '').trim();
  const position = rawPosition === null || rawPosition === undefined || rawPosition === ''
    ? ''
    : (positionUnit && !/[a-zA-Z]/.test(String(rawPosition)) ? `${rawPosition} ${positionUnit}` : String(rawPosition).trim());
  const unit = String(raw.unit ?? metadata.unit ?? '').trim();
  const portNum = raw.port_num ?? raw.port ?? metadata.port_num ?? null;
  const classification = weatherClassifyMeasurement({ measurement, sensorName, unit, position });
  const timestamp = weatherTsSeconds(raw.timestamp ?? raw.time ?? raw.timestamp_utc ?? (raw.datetime ? Date.parse(raw.datetime) : null));
  if (!timestamp) return null;
  const readingIdRaw = raw.reading_id ?? raw.readingId ?? metadata.reading_id ?? null;
  const readingId = Number.isFinite(Number(readingIdRaw)) ? Number(readingIdRaw) : null;
  const errorCodeRaw = raw.error_code ?? raw.errorCode ?? null;
  const errorCode = Number.isFinite(Number(errorCodeRaw)) && Number(errorCodeRaw) !== 0 ? Number(errorCodeRaw) : null;
  const value = raw.value === null || raw.value === undefined || raw.value === '' ? null : weatherFinite(raw.value);
  const statistic = String(raw.stats ?? raw.stat ?? raw.statistic ?? '').trim();
  return {
    readingId, timestamp, datetimeSource: String(raw.datetime || raw.datetime_source || ''), portNum,
    measurement, sensorName, position, unit, value, errorCode, statistic,
    normalizedKey: classification.normalizedKey, category: classification.category, aggregationMethod: classification.aggregationMethod,
    seriesKey: weatherSeriesKey({ port_num: portNum, measurement, sensor_name: sensorName, position, unit })
  };
};

const weatherGetTimeParts = (seconds, timezone) => {
  const date = new Date(Number(seconds) * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || WEATHER_DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(date);
  const out = {};
  parts.forEach(p => { if (p.type !== 'literal') out[p.type] = p.value; });
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(out.hour), minute: Number(out.minute), second: Number(out.second), weekday: out.weekday };
};

const weatherIsoWeekKey = (parts) => {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const weatherBucketKey = (seconds, aggregation, timezone) => {
  const p = weatherGetTimeParts(seconds, timezone);
  const ymd = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  if (aggregation === 'hourly') return `${ymd}T${String(p.hour).padStart(2, '0')}:00`;
  if (aggregation === 'daily') return ymd;
  if (aggregation === 'weekly') return weatherIsoWeekKey(p);
  if (aggregation === 'monthly') return `${p.year}-${String(p.month).padStart(2, '0')}`;
  if (aggregation === 'yearly') return String(p.year);
  return String(seconds);
};

const weatherCircularMean = values => {
  const valid = values.filter(v => Number.isFinite(v));
  if (!valid.length) return null;
  const sin = valid.reduce((a, v) => a + Math.sin(v * Math.PI / 180), 0) / valid.length;
  const cos = valid.reduce((a, v) => a + Math.cos(v * Math.PI / 180), 0) / valid.length;
  let angle = Math.atan2(sin, cos) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
};

const weatherAggregateValues = (rows, method, bucketSeconds = null) => {
  const valid = rows.filter(r => r.quality_status === 'valid' && weatherFinite(r.value)!==null).map(r => Number(r.value));
  const base = { count: valid.length, expected_count: null, completeness: null, value: null, min: null, max: null, avg: null, sum: null, energy_mj_m2: null };
  if (!valid.length) return base;
  const min = Math.min(...valid), max = Math.max(...valid), sum = valid.reduce((a, b) => a + b, 0), avg = sum / valid.length;
  base.min = min; base.max = max; base.avg = avg; base.sum = sum;
  if (method === 'sum') base.value = sum;
  else if (method === 'max') base.value = max;
  else if (method === 'min') base.value = min;
  else if (method === 'last') base.value = Number(rows.filter(r => r.quality_status === 'valid' && Number.isFinite(Number(r.value))).sort((a,b) => a.timestamp_utc - b.timestamp_utc).at(-1)?.value ?? avg);
  else if (method === 'circular_mean') base.value = weatherCircularMean(valid);
  else base.value = avg;
  if (method === 'avg_max_energy') {
    base.value = avg;
    // W/m² averaged over a bucket integrates to MJ/m² when bucket duration is known.
    if (Number.isFinite(bucketSeconds) && bucketSeconds > 0) base.energy_mj_m2 = avg * bucketSeconds / 1e6;
  }
  return base;
};

const weatherBucketDurationSeconds = aggregation => ({ hourly: 3600, daily: 86400, weekly: 604800, monthly: null, yearly: null }[aggregation] ?? null);

const weatherAggregateRows = ({ rows = [], series = [], aggregation = 'raw', timezone = WEATHER_DEFAULT_TIMEZONE, loggingIntervalMinutes = null }) => {
  if (aggregation === 'raw') return rows.map(row => ({ ...row, bucket: weatherUtcIso(row.timestamp_utc) }));
  const seriesById = new Map(series.map(s => [Number(s.id), s]));
  const buckets = new Map();
  rows.forEach(row => {
    const bucket = weatherBucketKey(row.timestamp_utc, aggregation, timezone);
    const key = `${bucket}|${row.series_id}`;
    if (!buckets.has(key)) buckets.set(key, { bucket, series_id: Number(row.series_id), rows: [] });
    buckets.get(key).rows.push(row);
  });
  const duration = weatherBucketDurationSeconds(aggregation);
  return [...buckets.values()].map(group => {
    const s = seriesById.get(group.series_id) || {};
    const stats = weatherAggregateValues(group.rows, s.aggregation_method || 'avg', duration);
    if (Number.isFinite(Number(loggingIntervalMinutes)) && Number(loggingIntervalMinutes) > 0 && duration) {
      stats.expected_count = Math.max(1, Math.round(duration / (Number(loggingIntervalMinutes) * 60)));
      stats.completeness = Math.min(100, stats.count / stats.expected_count * 100);
    }
    return { bucket: group.bucket, series_id: group.series_id, normalized_key: s.normalized_key || group.rows[0]?.normalized_key, measurement: s.measurement || group.rows[0]?.measurement, unit: s.unit || group.rows[0]?.unit, aggregation_method: s.aggregation_method || 'avg', ...stats };
  }).sort((a,b) => String(a.bucket).localeCompare(String(b.bucket)) || a.series_id - b.series_id);
};

const weatherStationHealth = (station, nowSeconds = Math.floor(Date.now() / 1000)) => {
  const last = weatherTsSeconds(station?.last_measurement_ts || station?.data_last_timestamp);
  const upload = Math.max(1, Number(station?.upload_frequency_minutes || station?.logging_interval_minutes || WEATHER_SYNC_INTERVAL_MINUTES));
  if (!last) return { status: 'unknown', label: 'No data', age_minutes: null, expected_upload_minutes: upload };
  const age = Math.max(0, (nowSeconds - last) / 60);
  const onlineLimit = Math.max(30, upload * 2 + 15);
  const delayedLimit = Math.max(180, upload * 6);
  const errors = weatherJsonParse(station.sensor_errors_json, []) || [];
  if (errors.length) return { status: 'error', label: 'Sensor error', age_minutes: age, expected_upload_minutes: upload, sensor_error_count: errors.length };
  if (age <= onlineLimit) return { status: 'online', label: 'Online', age_minutes: age, expected_upload_minutes: upload };
  if (age <= delayedLimit) return { status: 'delayed', label: 'Delayed', age_minutes: age, expected_upload_minutes: upload };
  return { status: 'offline', label: 'Offline', age_minutes: age, expected_upload_minutes: upload };
};

const weatherVpdKpa = (temperatureC, rhPercent) => {
  if(weatherFinite(temperatureC)===null||weatherFinite(rhPercent)===null)return null;
  const t = Number(temperatureC), rh = Number(rhPercent);
  if (!Number.isFinite(t) || !Number.isFinite(rh) || rh < 0 || rh > 100) return null;
  const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
  return Math.max(0, es * (1 - rh / 100));
};

const weatherDailyGdd = (minC, maxC, baseC) => {
  if([minC,maxC,baseC].some(v=>weatherFinite(v)===null))return null;
  const min = Number(minC), max = Number(maxC), base = Number(baseC);
  if (![min,max,base].every(Number.isFinite)) return null;
  return Math.max(0, ((min + max) / 2) - base);
};


const weatherNormalizeWindMs = (value, unit = '') => {
  const v = Number(value); if (!Number.isFinite(v)) return null;
  const u = String(unit || '').trim().toLowerCase().replace(/\s+/g,'');
  if (!u || /^(m\/s|ms-1|mps)$/.test(u)) return v;
  if (/^(km\/h|kmh|kph)$/.test(u)) return v / 3.6;
  if (/^(mph|mi\/h)$/.test(u)) return v * 0.44704;
  return null;
};

const weatherPositionHeightMeters = position => {
  const text = String(position || '').trim().toLowerCase();
  if (!text) return null;
  let m = text.match(/(-?\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres)\b/); if (m) return Number(m[1]);
  m = text.match(/(-?\d+(?:\.\d+)?)\s*(cm|centimeter|centimeters|centimetre|centimetres)\b/); if (m) return Number(m[1]) / 100;
  m = text.match(/(-?\d+(?:\.\d+)?)\s*(ft|foot|feet)\b/); if (m) return Number(m[1]) * 0.3048;
  return null;
};

const weatherWindAt2m = row => {
  const speed = weatherNormalizeWindMs(row?.value,row?.unit); if (speed === null) return null;
  const z = weatherPositionHeightMeters(row?.position);
  if (z === null) return null; // Do not silently assume sensor mounting height for FAO-56 ET₀.
  if (z <= 0.1) return null;
  if (Math.abs(z-2) <= 0.15) return speed;
  const denom = Math.log(67.8*z - 5.42);
  return Number.isFinite(denom) && denom > 0 ? speed * 4.87 / denom : null;
};

const weatherSolarRowsWattsPerM2 = rows => rows.filter(row => {
  const u=String(row?.unit||'').toLowerCase().replace(/\s+/g,'');
  return /^(w\/m2|w\/m²|wm-2|watt\/m2|watts\/m2)$/.test(u);
});

const weatherSolarRadiationDailyMj = rows => {
  const valid = rows.filter(r => r.quality_status === 'valid' && Number.isFinite(Number(r.value))).sort((a,b) => a.timestamp_utc - b.timestamp_utc);
  if (valid.length < 2) return null;
  let joules = 0;
  for (let i = 1; i < valid.length; i += 1) {
    const dt = valid[i].timestamp_utc - valid[i-1].timestamp_utc;
    if (dt <= 0 || dt > 4 * 3600) continue;
    joules += ((Number(valid[i].value) + Number(valid[i-1].value)) / 2) * dt;
  }
  return joules / 1e6;
};

const weatherFao56Et0Daily = ({ latitude, elevation = 0, dayOfYear, tMin, tMax, tMean, rhMean, wind2m, solarMj }) => {
  if([latitude,dayOfYear,tMin,tMax,tMean,rhMean,wind2m,solarMj].some(v=>weatherFinite(v)===null))return null;
  const nums = [latitude, dayOfYear, tMin, tMax, tMean, rhMean, wind2m, solarMj].map(Number);
  if (!nums.every(Number.isFinite) || Number(rhMean) < 0 || Number(rhMean) > 100 || Number(solarMj) < 0 || Number(wind2m) < 0) return null;
  const latRad = Number(latitude) * Math.PI / 180;
  const j = Number(dayOfYear);
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI / 365 * j);
  const delta = 0.409 * Math.sin(2 * Math.PI / 365 * j - 1.39);
  const wsArg = Math.max(-1, Math.min(1, -Math.tan(latRad) * Math.tan(delta)));
  const ws = Math.acos(wsArg);
  const ra = (24 * 60 / Math.PI) * 0.0820 * dr * (ws * Math.sin(latRad) * Math.sin(delta) + Math.cos(latRad) * Math.cos(delta) * Math.sin(ws));
  const rso = (0.75 + 2e-5 * Number(elevation || 0)) * ra;
  const rns = (1 - 0.23) * Number(solarMj);
  const esTmin = 0.6108 * Math.exp(17.27 * Number(tMin) / (Number(tMin) + 237.3));
  const esTmax = 0.6108 * Math.exp(17.27 * Number(tMax) / (Number(tMax) + 237.3));
  const es = (esTmin + esTmax) / 2;
  const ea = es * Number(rhMean) / 100;
  const sigma = 4.903e-9;
  const tmaxK = Number(tMax) + 273.16, tminK = Number(tMin) + 273.16;
  const cloudTerm = rso > 0 ? Math.max(0.05, Math.min(1.0, 1.35 * Number(solarMj) / rso - 0.35)) : 0.05;
  const rnl = sigma * ((Math.pow(tmaxK, 4) + Math.pow(tminK, 4)) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * cloudTerm;
  const rn = rns - rnl;
  const pressure = 101.3 * Math.pow((293 - 0.0065 * Number(elevation || 0)) / 293, 5.26);
  const gamma = 0.000665 * pressure;
  const slope = 4098 * (0.6108 * Math.exp(17.27 * Number(tMean) / (Number(tMean) + 237.3))) / Math.pow(Number(tMean) + 237.3, 2);
  const numerator = 0.408 * slope * rn + gamma * (900 / (Number(tMean) + 273)) * Number(wind2m) * (es - ea);
  const denominator = slope + gamma * (1 + 0.34 * Number(wind2m));
  const et0 = denominator > 0 ? numerator / denominator : null;
  return Number.isFinite(et0) ? Math.max(0, et0) : null;
};

const weatherLocalDateRangeUtc = (dateKey, timezone) => {
  // Convert local YYYY-MM-DD midnight boundaries to UTC by iterative offset resolution.
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const resolve = (y,m,d) => {
    let utc = Date.UTC(y, m-1, d, 0, 0, 0) / 1000;
    for (let i=0;i<3;i+=1) {
      const p = weatherGetTimeParts(utc, timezone);
      const represented = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)/1000;
      const wanted = Date.UTC(y,m-1,d,0,0,0)/1000;
      utc += wanted - represented;
    }
    return Math.floor(utc);
  };
  const start = resolve(year,month,day);
  const next = new Date(Date.UTC(year,month-1,day)+86400000);
  return { start, end: resolve(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate()) };
};

const weatherDayOfYear = dateKey => {
  const [y,m,d] = String(dateKey).split('-').map(Number);
  return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(y,0,0))/86400000);
};

const weatherGetStationSeries = stationId => dbAll(`SELECT * FROM WeatherSeries WHERE station_id=? AND enabled=1 ORDER BY category, measurement, id`, [stationId]);

const weatherQueryRows = async ({ stationId, startTs, endTs, seriesIds = [], normalizedKeys = [], limit = WEATHER_MAX_HISTORY_ROWS }) => {
  const conditions = ['station_id=?', 'timestamp_utc>=?', 'timestamp_utc<?'];
  const params = [stationId, Math.floor(startTs), Math.floor(endTs)];
  if (seriesIds.length) { conditions.push(`series_id IN (${seriesIds.map(()=>'?').join(',')})`); params.push(...seriesIds); }
  if (normalizedKeys.length) { conditions.push(`normalized_key IN (${normalizedKeys.map(()=>'?').join(',')})`); params.push(...normalizedKeys); }
  params.push(Math.max(1, Number(limit) || WEATHER_MAX_HISTORY_ROWS));
  return dbAll(`SELECT id,station_id,series_id,reading_id,timestamp_utc,datetime_source,port_num,measurement,normalized_key,unit,sensor_name,position,value,error_code,error_message,statistic,quality_status
    FROM WeatherReadings WHERE ${conditions.join(' AND ')} ORDER BY timestamp_utc ASC, series_id ASC, id ASC LIMIT ?`, params);
};

const weatherCurrentConditions = async station => {
  const latest = await dbAll(`SELECT * FROM (
      SELECT wr.*,ws.category AS series_category,ws.aggregation_method AS series_aggregation_method,ws.enabled AS series_enabled,
        ROW_NUMBER() OVER (PARTITION BY wr.series_id ORDER BY wr.timestamp_utc DESC,wr.id DESC) AS rn
      FROM WeatherReadings wr JOIN WeatherSeries ws ON ws.id=wr.series_id
      WHERE wr.station_id=? AND ws.enabled=1
    ) ranked WHERE rn=1`, [station.id]);
  const best = new Map();
  latest.forEach(item => {
    const key = item.normalized_key;
    const existing = best.get(key);
    if (!existing || (item.quality_status === 'valid' && existing.quality_status !== 'valid') || Number(item.timestamp_utc) > Number(existing.timestamp_utc) || (Number(item.timestamp_utc)===Number(existing.timestamp_utc)&&/^(min|max)\b/i.test(existing.measurement)&&! /^(min|max)\b/i.test(item.measurement))) best.set(key, item);
  });
  return { station, health: weatherStationHealth(station), readings: [...best.values()].sort((a,b) => String(a.series_category||'').localeCompare(String(b.series_category||'')) || String(a.measurement).localeCompare(String(b.measurement))) };
};

const weatherCurrentConditionsMany = async stations => {
  const list=Array.isArray(stations)?stations.filter(s=>Number.isInteger(Number(s?.id))):[];
  if(!list.length) return new Map();
  const ids=list.map(s=>Number(s.id));
  const placeholders=ids.map(()=>'?').join(',');
  const latest=await dbAll(`SELECT * FROM (
      SELECT wr.*,ws.category AS series_category,ws.aggregation_method AS series_aggregation_method,ws.enabled AS series_enabled,
        ROW_NUMBER() OVER (PARTITION BY wr.station_id,wr.series_id ORDER BY wr.timestamp_utc DESC,wr.id DESC) AS rn
      FROM WeatherReadings wr JOIN WeatherSeries ws ON ws.id=wr.series_id
      WHERE wr.station_id IN (${placeholders}) AND ws.enabled=1
    ) ranked WHERE rn=1`,ids);
  const byStation=new Map(list.map(station=>[Number(station.id),new Map()]));
  latest.forEach(item=>{
    const best=byStation.get(Number(item.station_id));if(!best)return;
    const key=item.normalized_key,existing=best.get(key);
    if(!existing||(item.quality_status==='valid'&&existing.quality_status!=='valid')||Number(item.timestamp_utc)>Number(existing.timestamp_utc)||(Number(item.timestamp_utc)===Number(existing.timestamp_utc)&&/^(min|max)\b/i.test(existing.measurement)&&! /^(min|max)\b/i.test(item.measurement)))best.set(key,item);
  });
  const out=new Map();
  list.forEach(station=>{const readings=[...(byStation.get(Number(station.id))||new Map()).values()].sort((a,b)=>String(a.series_category||'').localeCompare(String(b.series_category||''))||String(a.measurement).localeCompare(String(b.measurement)));out.set(Number(station.id),{station,health:weatherStationHealth(station),readings});});
  return out;
};

const weatherRainTotals = async (station, nowSeconds = Math.floor(Date.now()/1000), todayOnly = false) => {
  const timezone = station.timezone || WEATHER_DEFAULT_TIMEZONE;
  const p = weatherGetTimeParts(nowSeconds, timezone);
  const todayKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  const todayRange = weatherLocalDateRangeUtc(todayKey, timezone);
  const monthKey = `${p.year}-${String(p.month).padStart(2,'0')}-01`;
  const monthStart = weatherLocalDateRangeUtc(monthKey, timezone).start;
  const yearStart = weatherLocalDateRangeUtc(`${p.year}-01-01`, timezone).start;
  const querySum = async (start,end) => {
    const row = await dbGet(`SELECT SUM(value) total,COUNT(*) count FROM (
      SELECT wr.value,ROW_NUMBER() OVER(PARTITION BY wr.timestamp_utc ORDER BY wr.id DESC) rn
      FROM WeatherReadings wr JOIN WeatherSeries ws ON ws.id=wr.series_id
      WHERE wr.station_id=? AND ws.enabled=1 AND wr.normalized_key='precipitation' AND wr.unit='mm'
      AND wr.port_num=(SELECT MIN(port_num) FROM WeatherSeries WHERE station_id=? AND normalized_key='precipitation' AND unit='mm' AND enabled=1)
      AND wr.quality_status='valid' AND wr.value IS NOT NULL AND wr.timestamp_utc>=? AND wr.timestamp_utc<?
    ) WHERE rn=1`, [station.id,station.id,start,end]);
    const count=Number(row?.count||0); return { total: count ? Number(row.total) : null, count };
  };
  if(todayOnly){const today=await querySum(todayRange.start,Math.min(todayRange.end,nowSeconds+1));return {today_mm:today.total};}
  const previousMonthStart = weatherLocalDateRangeUtc(`${p.month===1?p.year-1:p.year}-${String(p.month===1?12:p.month-1).padStart(2,'0')}-01`,timezone).start;
  const previousYearStart = weatherLocalDateRangeUtc(`${p.year-1}-01-01`,timezone).start;
  const [today,last24,last7,month,year,hour,previous7,previousMonth,previousYear] = await Promise.all([
    querySum(todayRange.start,Math.min(todayRange.end,nowSeconds+1)), querySum(nowSeconds-86400,nowSeconds+1), querySum(nowSeconds-7*86400,nowSeconds+1), querySum(monthStart,nowSeconds+1), querySum(yearStart,nowSeconds+1),querySum(nowSeconds-3600,nowSeconds+1),querySum(nowSeconds-14*86400,nowSeconds-7*86400),querySum(previousMonthStart,monthStart),querySum(previousYearStart,yearStart)
  ]);
  return { today_mm: today.total, last_hour_mm:hour.total,last_24h_mm: last24.total, last_7d_mm: last7.total, month_mm: month.total, year_mm: year.total, previous_7d_mm:previous7.total,previous_month_mm:previousMonth.total,previous_year_mm:previousYear.total, source_note:'Primary enabled rain gauge; sums of recorded samples, not gap-filled totals.',sample_counts: { today: today.count, last24: last24.count, last7: last7.count } };
};

const weatherDailyAgriculture = async ({ station, startTs, endTs, gddBaseC = 10, cropKc = null }) => {
  const timezone = station.timezone || WEATHER_DEFAULT_TIMEZONE;
  const rows = await weatherQueryRows({ stationId: station.id, startTs, endTs, normalizedKeys: ['air_temperature','relative_humidity','precipitation','wind_speed','solar_radiation','soil_water_content','leaf_wetness','reference_et'], limit: WEATHER_MAX_HISTORY_ROWS });
  const byDay = new Map();
  rows.forEach(row => {
    const key = weatherBucketKey(row.timestamp_utc,'daily',timezone);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  });
  const days = [];
  for (const [date, dayRows] of [...byDay.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))) {
    const values = key => {
      let candidates=dayRows.filter(r=>r.normalized_key===key&&r.quality_status==='valid'&&weatherFinite(r.value)!==null&&!/^(min|max)\b/i.test(r.measurement)&&(key!=='precipitation'||r.unit==='mm')&&(key!=='relative_humidity'||! /temp/i.test(r.measurement)));
      if(key==='soil_water_content')candidates=candidates.filter(r=>/^(%|m[³3]\/m[³3]|cm[³3]\/cm[³3])$/.test(String(r.unit).replace(/\s/g,''))&&Number(r.value)>=0&&Number(r.value)<=(r.unit.trim()==='%'?100:1));
      if(key==='leaf_wetness'){
        candidates=candidates.filter(r=>/^(min|minutes?)$/i.test(r.unit)&&Number(r.value)>=0&&Number(r.value)<=Math.max(1,Number(station.logging_interval_minutes)||15));
        if(candidates.some(r=>! /high/i.test(r.measurement)))candidates=candidates.filter(r=>! /high/i.test(r.measurement));
      }
      const port=Math.min(...candidates.map(r=>Number(r.port_num||0)));
      const unique=new Map();candidates.filter(r=>Number(r.port_num||0)===port).forEach(r=>unique.set(r.timestamp_utc,r));
      return [...unique.values()];
    };
    const temp = values('air_temperature').map(r=>Number(r.value));
    const rh = values('relative_humidity').map(r=>Number(r.value));
    const rain = values('precipitation').map(r=>Number(r.value));
    const windRows = values('wind_speed');
    const wind2mValues = windRows.map(weatherWindAt2m).filter(Number.isFinite);
    const solarRows = weatherSolarRowsWattsPerM2(values('solar_radiation')).filter(r=>Number(r.value)>=0);
    const soilRows = values('soil_water_content'),leafRows=values('leaf_wetness');
    const soilPct=soilRows.map(r=>Number(r.value)*(r.unit.trim()==='%'?1:100));
    const sourceEtRows = values('reference_et');
    const sourceEt = sourceEtRows.length ? sourceEtRows.reduce((a,r)=>a+Number(r.value),0) : null;
    const tMin = temp.length ? Math.min(...temp) : null, tMax = temp.length ? Math.max(...temp) : null, tMean = temp.length ? temp.reduce((a,b)=>a+b,0)/temp.length : null;
    const rhMean = rh.length ? rh.reduce((a,b)=>a+b,0)/rh.length : null;
    const windMean = wind2mValues.length ? wind2mValues.reduce((a,b)=>a+b,0)/wind2mValues.length : null;
    const solarMj = weatherSolarRadiationDailyMj(solarRows);
    const expectedDaily = 1440 / Math.max(1,Number(station.logging_interval_minutes)||15);
    const completeInputs = Math.min(temp.length,rh.length,solarRows.length,wind2mValues.length) >= expectedDaily*.9;
    const calculatedEt0 = sourceEt !== null || !completeInputs ? null : weatherFao56Et0Daily({ latitude: station.latitude, elevation: station.elevation || 0, dayOfYear: weatherDayOfYear(date), tMin, tMax, tMean, rhMean, wind2m: windMean, solarMj });
    const et0 = sourceEt !== null ? sourceEt : calculatedEt0;
    const rainTotal = rain.length ? rain.reduce((a,b)=>a+b,0) : null;
    const kc = weatherFinite(cropKc);
    const estimatedEtc = Number.isFinite(et0) && kc !== null ? et0 * kc : null;
    days.push({ date, rainfall_completeness_pct:Math.min(100,rain.length/expectedDaily*100), temperature_min_c:tMin,temperature_avg_c:tMean,temperature_max_c:tMax,relative_humidity_avg_pct:rhMean,rainfall_mm:rainTotal,
      leaf_wetness_hours:leafRows.length?leafRows.reduce((sum,r)=>sum+Number(r.value),0)/60:null,leaf_wetness_completeness_pct:Math.min(100,leafRows.length/expectedDaily*100),
      soil_water_content_avg_pct:soilPct.length?soilPct.reduce((sum,v)=>sum+v,0)/soilPct.length:null,soil_water_completeness_pct:Math.min(100,soilRows.length/expectedDaily*100),
      soil_water_series:soilRows.length?String(soilRows[0].series_id||[soilRows[0].port_num,soilRows[0].sensor_name,soilRows[0].position,soilRows[0].measurement,soilRows[0].unit].join('|')):null,
      solar_completeness_pct:Math.min(100,solarRows.length/expectedDaily*100),
      vpd_avg_kpa: weatherVpdKpa(tMean,rhMean),gdd: weatherDailyGdd(tMin,tMax,gddBaseC),solar_energy_mj_m2:solarMj,
      et0_mm:et0, et0_method: sourceEt!==null?'station_reference_et':(calculatedEt0!==null?'FAO-56 Penman-Monteith (daily; wind normalized to 2 m from sensor position)':'unavailable'),
      crop_kc:kc, estimated_crop_et_mm:estimatedEtc, indicative_water_deficit_mm: estimatedEtc===null||rainTotal===null?null:Math.max(0,estimatedEtc-rainTotal) });
  }
  return days;
};
