const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const oldKey = process.env.ZENTRA_API_KEY;
process.env.ZENTRA_API_KEY = 'fixture-server-secret';
process.env.WEATHER_DEFAULT_TIMEZONE = 'Asia/Manila';

const requests = [];
const fixtureDevice = {
  device_id: 'z6-fixture',
  name: 'Fixture AWS',
  organization_id: 42,
  organization_name: 'Fixture Org',
  device_type: 'ZL6',
  can_read_data: true,
  settings: { logging_interval: 15, upload_frequency: 60 },
  location: { latitude: 7.12345, longitude: 125.54321, elevation: 118, elevation_unit: 'm' },
  hardware: { firmware_version: 2.11, hardware_revision: null },
  connectivity: { connectivity_type: 'cellular', module: 'Fixture modem' },
  subscription: { status: 'active' },
  ports: [{ port_num: 1, sensor_short_name: 'ATMOS 41', sensor_serial_number: 'ATM-FIXTURE', position: { value: 200, unit: 'cm' } }],
  data_range: { first_measurement: 1700000000, last_measurement: 1700003600 }
};

global.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ devices: [fixtureDevice], pagination: { page_num: 1, total_pages: 1 } })
  };
};

const config = fs.readFileSync(path.join(ROOT, 'src/backend/config/21-weather.config.js'), 'utf8');
const provider = fs.readFileSync(path.join(ROOT, 'src/backend/services/21-weather-provider.service.js'), 'utf8');
const test = `
(async()=>{
  assert.strictEqual(weatherNormalizeIntervalMinutes(15),15,'numeric logging interval must remain minutes');
  assert.strictEqual(weatherNormalizeIntervalMinutes(2880),2880,'large numeric interval must not be mistaken for seconds');
  assert.strictEqual(weatherNormalizeIntervalMinutes('2 hours'),120);
  assert.strictEqual(weatherValidateZentraNextUrl('https://evil.example/devices/1'),null,'cross-origin pagination URL must be rejected');
  const normalized=weatherNormalizeZentraDevice(${JSON.stringify(fixtureDevice)});
  assert.strictEqual(normalized.connectivity_type,'cellular');
  assert.strictEqual(normalized.logging_interval_minutes,15);
  assert.strictEqual(normalized.upload_frequency_minutes,60);
  assert.strictEqual(normalized.latitude,7.12345);
  assert.strictEqual(normalized.longitude,125.54321);
  assert.strictEqual(normalized.ports[0].sensor_serial_number,'ATM-FIXTURE');
  const found=await discoverZentraDevices();
  assert.strictEqual(found.length,1);
  assert.strictEqual(found[0].provider_device_id,'z6-fixture');
  assert.strictEqual(requests.length,1);
  assert.strictEqual(requests[0].options.headers['X-API-Key'],'fixture-server-secret','API key must be sent only in backend provider request header');
  const u=new URL(requests[0].url);
  assert.strictEqual(u.origin,'https://api.zentracloud.io');
  assert.strictEqual(u.pathname,'/v5/devices');
  assert.strictEqual(u.searchParams.get('units'),'metric');
  assert(u.searchParams.get('expand').includes('ports')&&u.searchParams.get('expand').includes('location'),'device discovery must request expanded metadata');
  await fetchZentraReadingPage('z6-fixture',{startTs:1700000000,endTs:1700003600,direction:'asc'});
  const firstPageUrl=new URL(requests[1].url);
  assert.strictEqual(firstPageUrl.searchParams.get('start_timestamp'),'1700000000');
  assert.strictEqual(firstPageUrl.searchParams.get('end_timestamp'),'1700003600');
  assert.strictEqual(firstPageUrl.searchParams.get('direction'),'ascending','ZENTRA v5 requires ascending/descending, not asc/desc shorthand');
  await fetchZentraReadingPage('z6-fixture',{startTs:1700000000,endTs:1700003600,nextToken:'page-token',direction:'asc'});
  const pageUrl=new URL(requests[2].url);
  assert.strictEqual(pageUrl.searchParams.get('next_token'),'page-token');
  assert.strictEqual(pageUrl.searchParams.has('start_timestamp'),false,'next_token request must not repeat the original time window');
  assert.strictEqual(pageUrl.searchParams.has('end_timestamp'),false,'next_token request must not repeat the original time window');
  assert.strictEqual(pageUrl.searchParams.has('direction'),false,'next_token request must not repeat direction encoded by the token');
  console.log('Weather provider contract tests passed: secure header, discovery expansion, interval units, connectivity, coordinates, ports, cursor/token paging and URL validation.');
})().catch(e=>{console.error(e);process.exitCode=1;});`;
new Function('require','console','process','URL','fetch','setTimeout','clearTimeout','AbortController','assert','requests','fs','crypto','path','DATA_DIR', config+'\n'+provider+'\n'+test)(require,console,process,URL,global.fetch,setTimeout,clearTimeout,AbortController,assert,requests,fs,require('crypto'),path,require('os').tmpdir());

if (oldKey === undefined) delete process.env.ZENTRA_API_KEY; else process.env.ZENTRA_API_KEY = oldKey;
