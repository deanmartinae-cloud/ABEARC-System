class WeatherProviderError extends Error {
  constructor(message, { statusCode = 502, code = 'WEATHER_PROVIDER_ERROR', retryAfterSeconds = null, upstreamStatus = null } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.upstreamStatus = upstreamStatus;
  }
}

const weatherSafeJson = async response => {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { return { raw: text.slice(0, 1000) }; }
};

const weatherValidateZentraNextUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(String(value), ZENTRA_API_BASE_URL);
    const base = new URL(ZENTRA_API_BASE_URL);
    if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/devices`)) return null;
    return url.toString();
  } catch (_) { return null; }
};

const weatherApiFetch = async (urlOrPath, { query = null, apiKey = null } = {}) => {
  const activeKey = apiKey === null ? ZENTRA_API_KEY : String(apiKey);
  if (!activeKey) throw new WeatherProviderError('ZENTRA API key is not configured on the ABEARC server.', { statusCode: 503, code: 'WEATHER_KEY_NOT_CONFIGURED' });
  const url = /^https?:\/\//i.test(String(urlOrPath || '')) ? new URL(String(urlOrPath)) : new URL(`${ZENTRA_API_BASE_URL}/${String(urlOrPath || '').replace(/^\/+/, '')}`);
  if (query && typeof query === 'object') Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: { 'X-API-Key': activeKey, Accept: 'application/json' }, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new WeatherProviderError('ZENTRA request timed out.', { statusCode: 504, code: 'WEATHER_PROVIDER_TIMEOUT' });
    throw new WeatherProviderError('Unable to reach ZENTRA Cloud.', { statusCode: 502, code: 'WEATHER_PROVIDER_UNREACHABLE' });
  } finally { clearTimeout(timer); }
  const payload = await weatherSafeJson(response);
  if (!response.ok) {
    const retryAfterHeader = Number(response.headers.get('retry-after') || 0);
    const retryAfterPayload = Number(payload?.retry_after_seconds || payload?.detail?.retry_after_seconds || 0);
    const retryAfterSeconds = Math.max(0, retryAfterHeader || retryAfterPayload || 0) || null;
    const safeMessage = response.status === 401 || response.status === 403
      ? 'ZENTRA authentication was rejected. Check the server API key and account permissions.'
      : response.status === 429
        ? 'ZENTRA rate limit reached. Synchronization will retry later.'
        : `ZENTRA API returned HTTP ${response.status}.`;
    const code = response.status === 429 ? 'WEATHER_RATE_LIMITED'
      : (response.status === 401 || response.status === 403) ? 'WEATHER_AUTH_REJECTED'
        : response.status >= 500 ? 'WEATHER_PROVIDER_SERVER_ERROR' : 'WEATHER_PROVIDER_HTTP';
    throw new WeatherProviderError(safeMessage, { statusCode: response.status === 429 ? 429 : 502, code, retryAfterSeconds, upstreamStatus: response.status });
  }
  return payload || {};
};

const weatherArrayFromPayload = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};

const weatherNormalizeIntervalMinutes = value => {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*(second|minute|hour|day)/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (m[2].startsWith('second')) return amount / 60;
  if (m[2].startsWith('hour')) return amount * 60;
  if (m[2].startsWith('day')) return amount * 1440;
  return amount;
};

const weatherNormalizeZentraDevice = device => {
  const location = device?.location || {};
  const settings = device?.settings || {};
  const hardware = device?.hardware || {};
  const connectivity = device?.connectivity || {};
  const subscription = device?.subscription || {};
  const dataRange = device?.data_range || {};
  const latitude = Number(location.latitude ?? device.latitude);
  const longitude = Number(location.longitude ?? device.longitude);
  const elevation = Number(location.elevation ?? device.elevation);
  return {
    provider: 'zentra',
    provider_device_id: String(device.device_id ?? device.id ?? '').trim(),
    source_name: String(device.name || '').trim(),
    display_name: String(device.name || `Weather Station ${device.device_id || ''}`).trim(),
    organization_id: device.organization_id == null ? null : String(device.organization_id),
    organization_name: String(device.organization_name || ''),
    device_type: String(device.device_type || ''),
    model: String(device.model || ''),
    can_read_data: device.can_read_data === false ? 0 : 1,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    elevation: Number.isFinite(elevation) ? elevation : null,
    elevation_unit: String(location.elevation_unit || ''),
    timezone: String(location.timezone || settings.timezone || '').trim() || null,
    location_path: Array.isArray(location.path) ? location.path.join(' / ') : String(location.path || location.name || ''),
    logging_interval_minutes: weatherNormalizeIntervalMinutes(settings.logging_interval),
    upload_frequency_minutes: weatherNormalizeIntervalMinutes(settings.upload_frequency),
    firmware_version: String(hardware.firmware_version || device.firmware_version || ''),
    hardware_revision: String(hardware.hardware_revision || hardware.revision || ''),
    connectivity_type: String(connectivity.connectivity_type || connectivity.type || connectivity.connection_type || ''),
    subscription_status: String(subscription.status || ''),
    ports: Array.isArray(device.ports) ? device.ports : [],
    data_first_timestamp: Number.isFinite(Number(dataRange.first_measurement)) ? Number(dataRange.first_measurement) : null,
    data_last_timestamp: Number.isFinite(Number(dataRange.last_measurement)) ? Number(dataRange.last_measurement) : null,
    metadata: device,
    connectivity,
    subscription
  };
};

const discoverZentraDevices = async () => {
  const devices = [];
  let pageNum = 1;
  for (let safety = 0; safety < 100; safety += 1) {
    const payload = await weatherApiFetch('/devices', { query: { page_num: pageNum, limit: 1000, expand: 'max_min_timestamp,settings,ports,location,hardware,connectivity,subscription', units: 'metric' } });
    const page = weatherArrayFromPayload(payload, ['devices', 'data', 'results']);
    devices.push(...page.map(weatherNormalizeZentraDevice).filter(item => item.provider_device_id));
    const pagination = payload.pagination || {};
    const nextPage = Number(pagination.next_page_num ?? payload.next_page_num ?? 0);
    const totalPages = Number(pagination.total_pages ?? payload.total_pages ?? 0);
    if (nextPage > pageNum) pageNum = nextPage;
    else if (totalPages && pageNum < totalPages) pageNum += 1;
    else if (page.length >= 1000) pageNum += 1;
    else break;
  }
  return devices;
};

const fetchZentraReadingPage = async (providerDeviceId, options = {}) => {
  const id = encodeURIComponent(String(providerDeviceId));
  if (options.nextUrl) {
    const validated = weatherValidateZentraNextUrl(options.nextUrl);
    if (!validated) throw new WeatherProviderError('Invalid ZENTRA pagination URL.', { statusCode: 502, code: 'WEATHER_PAGINATION_INVALID' });
    return weatherApiFetch(validated);
  }
  const query = { units: 'metric' };
  if (Number.isFinite(Number(options.sinceReadingId))) query.since_reading_id = Math.max(0, Number(options.sinceReadingId));
  else if (options.nextToken) {
    // ZENTRA pagination tokens already encode the original time window/direction.
    // Re-sending start/end/window arguments with next_token conflicts with the token.
    query.next_token = options.nextToken;
  } else {
    if (Number.isFinite(Number(options.startTs))) query.start_timestamp = Math.floor(Number(options.startTs));
    if (Number.isFinite(Number(options.endTs))) query.end_timestamp = Math.floor(Number(options.endTs));
    if (options.aggregate && ['raw', 'hourly', 'daily'].includes(options.aggregate)) query.aggregate = options.aggregate;
    query.direction = ['desc','descending'].includes(String(options.direction || '').toLowerCase()) ? 'descending' : 'ascending';
  }
  return weatherApiFetch(`/devices/${id}/data`, { query });
};
