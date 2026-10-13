// Forecasts are modeled data, deliberately isolated from WeatherReadings.
const weatherForecastPending = new Map();
const WEATHER_FORECAST_TTL_MS = 60 * 60 * 1000;
const WEATHER_FORECAST_STALE_MS = 24 * 60 * 60 * 1000;
const weatherForecastNumber = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

const weatherFetchOpenMeteo = async station => {
  const latitude = weatherForecastNumber(station.latitude), longitude = weatherForecastNumber(station.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Station coordinates are unavailable.');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  const key = String(process.env.OPEN_METEO_API_KEY || '').trim();
  if (key) { url.hostname = 'customer-api.open-meteo.com'; url.searchParams.set('apikey', key); }
  const hourly = ['temperature_2m','relative_humidity_2m','apparent_temperature','precipitation_probability','precipitation','weather_code','cloud_cover','surface_pressure','wind_speed_10m','wind_direction_10m','wind_gusts_10m','shortwave_radiation','is_day'];
  const daily = ['weather_code','temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','wind_speed_10m_max','wind_gusts_10m_max','shortwave_radiation_sum','et0_fao_evapotranspiration'];
  Object.entries({ latitude, longitude, timezone: station.timezone || WEATHER_DEFAULT_TIMEZONE, forecast_days:7, past_days:30, timeformat:'unixtime', wind_speed_unit:'ms', hourly:hourly.join(','), daily:daily.join(',') }).forEach(([k,v]) => url.searchParams.set(k,String(v)));
  let payload;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal:AbortSignal.timeout(12000), headers:{Accept:'application/json'} });
      if (!response.ok) { const error = new Error('Forecast service is temporarily unavailable.'); error.retryable = response.status >= 500; throw error; }
      payload = await response.json();
      if (!Array.isArray(payload.hourly?.time) || payload.hourly.time.length < 24 || !Array.isArray(payload.daily?.time)) throw new Error('Forecast response is incomplete.');
      break;
    } catch (error) {
      if (attempt || error.retryable === false) throw new Error('Forecast service is temporarily unavailable.');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  const rows = (section, keys) => payload[section].time.map((timestamp,i) => Object.fromEntries([['timestamp',Number(timestamp)], ...keys.map(k => [k, weatherForecastNumber(payload[section][k]?.[i])])]));
  return { source_type:'forecast', provider:'Open-Meteo', model:'Best Match (provider-selected models)', attribution_url:'https://open-meteo.com/', licence:'CC BY 4.0', timezone:station.timezone||WEATHER_DEFAULT_TIMEZONE,
    requested_coordinates:{latitude,longitude}, grid_coordinates:{latitude:payload.latitude,longitude:payload.longitude}, fetched_at:new Date().toISOString(), hourly:rows('hourly',hourly), daily:rows('daily',daily).slice(-7), hourly_units:payload.hourly_units, daily_units:payload.daily_units };
};

const weatherGetForecast = async station => {
  const cacheKey = JSON.stringify(['open-meteo-past30',station.latitude,station.longitude,station.timezone||WEATHER_DEFAULT_TIMEZONE]);
  const cached = await dbGet('SELECT * FROM WeatherForecastCache WHERE station_id=?',[station.id]);
  let saved = null;
  try { if(cached?.cache_key===cacheKey) saved=JSON.parse(cached.payload_json||'null'); } catch (_) {}
  const age = saved ? Date.now()-Date.parse(saved.fetched_at) : Infinity;
  if (saved && age < WEATHER_FORECAST_TTL_MS) return {...saved,stale:false};
  const fallback = () => {
    if(saved && age < WEATHER_FORECAST_STALE_MS && saved.hourly.some(row=>row.timestamp>Date.now()/1000)) return {...saved,stale:true,warning:'Forecast temporarily unavailable — showing the last successful forecast.'};
    throw Object.assign(new Error('Forecast service is temporarily unavailable. AWS observations remain available.'),{statusCode:503});
  };
  if(cached?.cache_key===cacheKey && Date.parse(cached.retry_at||'')>Date.now()) return fallback();
  if(weatherForecastPending.has(cacheKey)) return weatherForecastPending.get(cacheKey);
  const pending = (async()=>{
    try {
      const payload = await weatherFetchOpenMeteo(station);
      await dbRun(`INSERT INTO WeatherForecastCache(station_id,cache_key,payload_json,retry_at) VALUES(?,?,?,NULL)
        ON CONFLICT(station_id) DO UPDATE SET cache_key=excluded.cache_key,payload_json=excluded.payload_json,retry_at=NULL`,[station.id,cacheKey,JSON.stringify(payload)]);
      return {...payload,stale:false};
    } catch (_) {
      await dbRun(`INSERT INTO WeatherForecastCache(station_id,cache_key,payload_json,retry_at) VALUES(?,?,?,?)
        ON CONFLICT(station_id) DO UPDATE SET cache_key=excluded.cache_key,payload_json=excluded.payload_json,retry_at=excluded.retry_at`,[station.id,cacheKey,JSON.stringify(saved),new Date(Date.now()+5*60000).toISOString()]);
      return fallback();
    } finally { weatherForecastPending.delete(cacheKey); }
  })();
  weatherForecastPending.set(cacheKey,pending);
  return pending;
};

const weatherForecastController = async (req,res) => {
  try {
    const station=await weatherFindStation(req.params.id);
    if(!station)return res.status(404).json({error:'Weather station not found.'});
    res.json(await weatherGetForecast(station));
  } catch(error) { res.status(error.statusCode||503).json({error:error.message}); }
};
