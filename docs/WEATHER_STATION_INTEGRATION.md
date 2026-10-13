# ABEARC Automated Weather Station Integration

## Purpose

ABEARC integrates authorized weather stations through a server-side weather provider layer. The first provider is ZENTRA Cloud v5. The browser never communicates with ZENTRA directly and never receives the provider API key.

Architecture:

`ABEARC Browser -> ABEARC Weather API -> Local SQLite weather cache -> ZENTRA Cloud v5`

The local cache is the source for map popups, dashboards, analytics, exports, and alerts. A single server-side scheduler performs discovery and synchronization for all ABEARC users.

## Secure configuration

The integration reads the ZENTRA credential only from the backend environment variable `ZENTRA_API_KEY`. Do not put the key in frontend JavaScript, HTML, Git, exported files, or screenshots.

### Synology / Docker

The supplied `2. Restart_Update ABEACR Server.bat` automatically uses this persistent host file when present:

`/volume1/docker/my-node-app/data/weather.env`

Create the file on the NAS with permissions appropriate for the ABEARC service account. Minimum content:

```text
ZENTRA_API_KEY=REPLACE_WITH_A_CURRENT_ZENTRA_API_KEY
```

Optional settings:

```text
WEATHER_PROVIDER=zentra
ZENTRA_API_BASE_URL=https://api.zentracloud.io/v5
WEATHER_DEFAULT_TIMEZONE=Asia/Manila
WEATHER_SYNC_INTERVAL_MINUTES=15
WEATHER_DISCOVERY_INTERVAL_MINUTES=60
WEATHER_REQUEST_TIMEOUT_MS=30000
WEATHER_ALERT_COOLDOWN_MINUTES=180
WEATHER_MAX_HISTORY_ROWS=100000
WEATHER_MAX_EXPORT_ROWS=250000
```

The `data` folder is preserved by the existing NAS deployment workflow, so `weather.env` survives application updates. The deployment ZIP contains no credential.

### Windows local runner

`run-local-server.bat` also reads `data\weather.env` if present. The project already ignores `data/`, preventing normal Git commits of this file.

## ZENTRA v5 synchronization behavior

- Device discovery: `GET /v5/devices`, expanded with settings, ports, current location, hardware, connectivity, subscription, and available data range.
- Reading synchronization: `GET /v5/devices/{device_id}/data` with metric units.
- Incremental synchronization uses ZENTRA `since_reading_id` and the returned `next_reading_id`. This is deliberately not based only on measurement timestamps because delayed/backfilled logger uploads can contain older measurement timestamps with newer reading IDs.
- Historical resynchronization uses date-range pagination and is queued server-side. Transient 429/network/timeout/provider-5xx failures remain queued with persisted exponential backoff, so jobs resume after outages and server restarts; authentication/configuration failures remain visible as terminal errors.
- Only one sync for a station may execute at a time.
- Provider throttling uses server-side scheduling, retry/backoff, and provider `Retry-After` information where available.
- Duplicate values are prevented by a stable source key plus a database uniqueness constraint.
- Missing data remains missing. It is never silently replaced with zero, including rainfall.

## Local database tables

The runtime migration creates these tables without altering existing ABEARC project tables:

- `WeatherStations` — provider/device metadata, map coordinates, health/configuration and visibility.
- `WeatherSeries` — normalized measurement series and aggregation rules.
- `WeatherReadings` — cached normalized observations and quality/error state.
- `WeatherSyncState` — incremental reading cursor and recovery state.
- `WeatherBackfillJobs` — queued historical range synchronization.
- `WeatherSyncRuns` — sync audit/history.
- `WeatherAlertRules` — authorized alert configuration.
- `WeatherAlertEvents` — emitted/cooldown-tracked alerts.
- `WeatherSystemSettings` — discovery/system state.

## Normalization and aggregation

ABEARC dynamically discovers the station's measurements instead of assuming a fixed ATMOS sensor set. Normalized categories include temperature, humidity, rainfall/rain rate, wind speed/gust/direction, solar radiation, atmospheric pressure, vapor pressure, lightning, soil measurements, leaf wetness, battery, signal, and evapotranspiration where available.

Aggregation is measurement-specific:

- rainfall / precipitation: sum;
- temperature: min / average / max;
- relative humidity: min / average / max;
- wind speed: average / maximum;
- wind gust: maximum;
- wind direction: circular mean;
- solar radiation: average irradiance plus time-integrated energy when sufficient samples exist;
- count measurements: sum;
- other continuous measurements: average/min/max as defined by the measurement registry.

Raw metric ZENTRA sensor positions are interpreted in centimetres. Positive positions are above ground and negative positions are below ground. A positive `+200 cm` weather sensor is not classified as a soil sensor; soil classification uses sensor/measurement semantics and below-ground depth.

## Agricultural analytics

The Agriculture view provides calculations only when required inputs are present:

- rainfall totals and wet/dry spell indicators;
- min/mean/max temperature;
- configurable Growing Degree Days (GDD) base temperature;
- Vapor Pressure Deficit (VPD) from compatible temperature and humidity;
- FAO-56 Penman-Monteith reference ET0 when the required weather inputs are available and compatible;
- wind is normalized to 2 m only when its installation height is known;
- measured reference ET from the source is preferred when valid;
- optional crop coefficient (`Kc`) produces an indicative crop ET / water-balance value, clearly separated from a complete irrigation engineering design.

ABEARC does not fabricate ET0 when the required variables or units are insufficient.

## Station health and quality control

Station health considers the configured upload/logging interval instead of assuming minute-by-minute communication. The UI distinguishes online, delayed and offline/error states. Current sensor faults from ZENTRA are stored and shown with port metadata.

The cache preserves:

- valid zero readings;
- null/missing values;
- non-zero source error codes;
- sensor status errors;
- data gaps;
- source timestamps in UTC.

Daily/monthly/yearly boundaries are calculated in the station timezone. Davao stations default to `Asia/Manila`. Authorized station managers can set a validated IANA timezone (for example `Asia/Manila`) for future stations outside the default zone, and provider rediscovery preserves that station-specific setting.

## Map and dashboard

The ABEARC Map includes a dedicated Automated Weather Stations layer with clustering, health-aware station markers and cached current-condition popups. The layer does not perform browser-side calls to ZENTRA.

Dashboard sections:

- Overview
- Charts
- Rainfall
- Agriculture
- Data Table
- Reports
- Station

The Station section includes discovered logger/device information, operational status, installed port/sensor metadata, sensor serial numbers, firmware, positions and current faults.

`My Map Layouts` stores/restores the weather-station layer state. Weather controls are isolated from existing measure tools, Geotag Map, orthomosaics, DEM/DTM overlays, Gravity Flow, Ram Pump and Print Mode interactions.

## Exports

Authorized users can export the selected station/range/aggregation/series as:

- CSV;
- Excel/XLSX;
- A4 PDF weather report;
- PNG from the visible chart.

Reports include station/source metadata and do not include the ZENTRA API key.

## Privileges

ABEARC reuses its existing privilege framework:

- `view_weather_stations`
- `export_weather_data`
- `manage_weather_stations`
- `manage_weather_alerts`
- `manage_weather_integration`

General users receive view/export behavior through existing defaults; management and integration actions remain privilege protected.

## Alerts

Authorized users can configure heavy rainfall, high/low temperature, strong wind/gust, extended dry period, high VPD, low soil moisture, station offline, sensor error and missing-data rules. Alert events are routed through the existing ABEARC notification infrastructure and use cooldown tracking to avoid repeated notification storms.

## API routes

Read:

- `GET /api/weather/map-stations`
- `GET /api/weather/stations`
- `GET /api/weather/stations/:id`
- `GET /api/weather/stations/:id/current`
- `GET /api/weather/stations/:id/history`
- `GET /api/weather/stations/:id/agriculture`
- `GET /api/weather/stations/:id/summary`
- `GET /api/weather/stations/:id/alerts`

Export:

- `GET /api/weather/stations/:id/export.csv`
- `GET /api/weather/stations/:id/export.xlsx`
- `GET /api/weather/stations/:id/report.pdf`

Management:

- `PATCH /api/weather/stations/:id`
- `POST /api/weather/stations/:id/sync`
- `POST /api/weather/stations/:id/resync`
- `POST /api/weather/stations/:id/alerts`
- `PATCH /api/weather/alerts/:ruleId`
- `DELETE /api/weather/alerts/:ruleId`
- `GET /api/weather/admin/status`
- `POST /api/weather/admin/discover`

## Verification

Automated checks are part of `npm run check`:

- structural/security wiring;
- provider contract fixture test;
- SQLite-backed weather workflow test;
- all existing ABEARC structural/map/regression checks.

The fixture suite covers migration, discovery normalization, secure provider header behavior, exact ZENTRA direction/cursor pagination parameters, object-form ZENTRA error codes, numeric metric sensor positions, duplicate prevention, missing-vs-zero rainfall, bulk current-condition loading, aggregation, VPD, GDD, ET0 safeguards, timezone boundaries, health rules, and durable transient/permanent backfill failure handling.

### Final live verification on the actual NAS

1. Put a current ZENTRA API key in `/volume1/docker/my-node-app/data/weather.env` as `ZENTRA_API_KEY=...`.
2. Run `1. Copy_Fullstack_to_ABEARC_NAS.bat` and then `2. Restart_Update ABEACR Server.bat`.
3. Log in as an Administrator/Superadmin and open ABEARC Map -> Automated Weather Stations.
4. In the Station tab, open integration status and select **Discover stations**.
5. Confirm the actual station name, device ID, coordinates/elevation and installed sensors/serial numbers match ZENTRA Cloud.
6. Confirm the map marker is at the actual station location.
7. Trigger one manual sync and verify current measurements/timestamps/units against ZENTRA Cloud.
8. Queue a short historical resync (for example 7 days), then compare daily rainfall and temperature min/avg/max against the same source period. If practical, interrupt outbound connectivity during a backfill page and confirm the job returns to `queued` with a next-attempt time, then resumes after connectivity returns.
9. Check CSV, XLSX and PDF exports.
10. Refresh ABEARC and restart the container once to verify cached data, cursor state and scheduler recovery persist.
11. Verify a general user can view/export but cannot access management/integration actions unless granted those privileges.
12. On phone/tablet and desktop, verify the popup, dashboard tabs, chart/table scrolling, and close/Escape behavior.

## Live-network limitation of the development sandbox

The implementation environment used for this build could not resolve outbound Internet hosts from the runnable ABEARC process. Therefore the supplied credential was not used to authenticate against the user's live ZENTRA account in this environment. The production logic was validated against the current v5 API contract and deterministic provider/data fixtures. Actual station/device discovery is the one deployment-specific verification step that must occur on the NAS with outbound HTTPS access to `api.zentracloud.io`.
