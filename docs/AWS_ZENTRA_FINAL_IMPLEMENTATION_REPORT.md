# ABEARC 1.52 — Automated Weather Station / ZENTRA Cloud Final Implementation Report

Date: 2026-10-07
Baseline: `ABEARC 1.52.zip`

## Implemented

- Native **Automated Weather Stations** map layer with clustered, health-aware station markers and fast cached current-condition popups.
- Backend-only **ZENTRA Cloud v5** provider using `X-API-Key`; the API credential is read only from `ZENTRA_API_KEY` and is never returned to the browser, exports, logs, or release package.
- Automatic multi-station device discovery with location, logger/device, settings, ports/sensor metadata, connectivity, subscription and data-range metadata where supplied by ZENTRA.
- Local SQLite weather cache with normalized stations, measurement series, readings, incremental cursor state, historical backfill jobs, sync audit runs, alert rules/events, and weather system state.
- Incremental synchronization based on ZENTRA reading IDs, including delayed/backfilled measurements, duplicate prevention, page cursor persistence, request backoff and restart-safe recovery.
- Historical resynchronization jobs with persisted pagination state and automatic retry after transient 429/network/timeout/provider-5xx failures; authentication/configuration failures remain visible as terminal errors.
- Dynamic current conditions and historical dashboard: **Overview | Charts | Rainfall | Agriculture | Data Table | Reports | Station**.
- Measurement-specific aggregation: rainfall/count accumulation, temperature/RH min-average-max, wind average/max, gust max, circular wind direction mean, solar irradiance plus integrated energy, and appropriate generic continuous-series statistics.
- Agriculture analytics: rainfall totals, wet/dry spell indicators, configurable GDD base temperature, VPD, guarded FAO-56 Penman-Monteith ET0, measured reference ET preference, crop coefficient inputs, and clearly labeled indicative crop-water deficit.
- Data-quality handling that preserves null/missing values separately from genuine zero values and surfaces sensor/source error codes.
- Interactive weather charts with missing-data gaps, tooltips, series show/hide, responsive fit/detail horizontal zoom/pan for dense series, rainfall bars, and PNG export.
- CSV, XLSX, and A4 PDF weather-report exports with station/source metadata.
- Station health logic using configured upload/logging intervals rather than assuming minute-by-minute uploads.
- Configurable weather/health alerts integrated with the existing ABEARC notification system.
- Existing ABEARC privilege framework extended with weather view/export/manage/alert/integration privileges.
- Authorized station settings for display name, map visibility, sync interval, enable/disable state, and validated IANA station timezone.
- Weather layer state persisted through **My Map Layouts**.
- Responsive desktop/tablet/mobile weather dashboard and compact map popup.
- Persistent NAS/local secret configuration using `data/weather.env`; NAS container recreation reuses this file automatically.

## Important architectural decisions

1. **Browser -> ABEARC Backend -> local weather cache -> ZENTRA Cloud**. Browser clients never call ZENTRA directly.
2. **Provider abstraction** separates ZENTRA-specific transport/normalization from ABEARC weather storage, analytics and UI so later providers can be added without redesigning the database/dashboard.
3. **Server-owned synchronization** means multiple browser users do not independently consume ZENTRA request budgets.
4. **Reading-ID cursors** are used for routine incremental synchronization so late-arriving logger data is not missed because of measurement timestamps.
5. **Local-time aggregation** uses each station's IANA timezone while source timestamps remain UTC internally.
6. **Scientific guardrails** prevent ET0 or irrigation-demand figures from being produced when compatible required measurements/metadata are insufficient.

## Bugs/problems discovered and fixed during implementation

- Corrected ZENTRA v5 history direction values from shorthand `asc/desc` to the documented `ascending/descending` values.
- Changed cursor advancement to trust ZENTRA's continuation reading-ID semantics rather than only the highest visible sample ID.
- Preserved validated `next_url` as a backfill pagination fallback in addition to opaque page tokens.
- Fixed historical backfills becoming permanently failed after transient outages/rate limits; jobs now persist retry count/next-attempt state and automatically resume.
- Prevented a failed backfill request from immediately triggering a second incremental request for the same device during that scheduler minute.
- Fixed rainfall missing samples being interpreted as 0 mm; genuine zero rainfall remains zero while missing rainfall remains unknown.
- Fixed positive ZENTRA metric sensor positions such as `+200 cm` being misclassified as soil depth; negative positions remain below-ground depth.
- Tightened ET0 wind handling so wind is converted to 2 m only when installation height is known/compatible.
- Preserved manager-configured station timezones across provider rediscovery.
- Replaced per-station current-condition map queries with one bulk ranked query for all visible stations.
- Made the NAS restart/update launcher preserve and reuse a persistent server-side weather credential file.
- Upgraded chart interaction from native SVG titles to explicit date/value tooltips and dense-series detail/pan mode.

## Database/schema changes

Runtime migration creates or upgrades:

- `WeatherStations`
- `WeatherSeries`
- `WeatherReadings`
- `WeatherSyncState`
- `WeatherBackfillJobs`
- `WeatherSyncRuns`
- `WeatherAlertRules`
- `WeatherAlertEvents`
- `WeatherSystemSettings`

`WeatherBackfillJobs` includes durable `next_token`, validated `next_url`, `retry_count`, and `next_attempt_at` state. Existing ABEARC project tables are not redesigned.

## Main API endpoints added

- `GET /api/weather/map-stations`
- `GET /api/weather/stations`
- `GET /api/weather/stations/:id`
- `GET /api/weather/stations/:id/current`
- `GET /api/weather/stations/:id/history`
- `GET /api/weather/stations/:id/agriculture`
- `GET /api/weather/stations/:id/summary`
- `GET /api/weather/stations/:id/export.csv`
- `GET /api/weather/stations/:id/export.xlsx`
- `GET /api/weather/stations/:id/report.pdf`
- station sync/resync/settings routes
- alert CRUD routes
- integration discovery/status routes

## Tests performed

Passed after the final implementation:

- frontend build
- structure / generated-DOM compatibility
- frontend cache safety
- map analysis
- runtime route wiring (306 routes)
- document-date regression
- orthomosaic regression
- My Map Layouts regression
- Print Mode regression
- Ram Pump structural/workflow regression
- SALT regression
- map undo regression
- multi-measure regression
- Gravity Flow path/native/ascent regressions
- weather structural/security checks
- ZENTRA provider contract fixtures
- SQLite-backed weather workflow fixtures including migration, normalization, duplicates, error codes, missing-vs-zero rainfall, bulk current conditions, aggregation, VPD/GDD/ET0 safeguards, timezone boundaries, station health, and durable backfill recovery
- release secret scan: supplied credential/JWT pattern is absent from source, generated browser assets, docs and deployment package configuration

Known pre-existing/environment-specific test facts:

- `scripts/check-map-view.js` fails with `1 !== 0` in both the untouched ABEARC 1.52 baseline and this build; it is not introduced by the AWS feature.
- `scripts/check-dashboard-assignments.js` cannot execute in this Linux sandbox because the uploaded baseline carries a Windows `sqlite3` native DLL (`invalid ELF header`). The original Windows binding was restored byte-for-byte before packaging. The Dockerfile installs a Linux-native dependency set with `npm ci` during NAS image build.

## Main affected/changed files

Backend weather module:

- `src/backend/config/21-weather.config.js`
- `src/backend/migrations/21-weather.migration.js`
- `src/backend/services/21-weather-provider.service.js`
- `src/backend/services/21-weather-analytics.service.js`
- `src/backend/services/21-weather-sync.service.js`
- `src/backend/controllers/21-weather.controller.js`
- `src/backend/routes/21-weather.routes.js`

ABEARC integration:

- `src/backend/manifest.json`
- `src/backend/utils/00-core.utils.js`
- `src/backend/services/00-shared.service.js`
- `src/backend/startup/00-listen.startup.js`
- `src/frontend/manifest.json`
- `src/frontend/script-manifest.json`
- `src/frontend/layout/head.html`
- `src/frontend/pages/map.page.html`
- `src/frontend/scripts/12-abearc-map.js`
- `src/frontend/scripts/16-map-layouts.js`
- `src/frontend/scripts/23-map-weather.js`
- `src/frontend/modals/map-weather.modals.html`
- `src/frontend/styles/map-weather.css`
- corresponding generated files under `public/`
- `docs/frontend-dom-id-baseline.json`

Deployment/docs/tests:

- `2. Restart_Update ABEACR Server.bat`
- `run-local-server.bat`
- `README.md`
- `docs/WEATHER_STATION_INTEGRATION.md`
- `package.json`
- `scripts/check-weather-stations.js`
- `scripts/test-weather-provider.js`
- `scripts/test-weather-workflow.js`
- `scripts/test-weather-workflow.fixture.js`
- `scripts/check-runtime-wiring.js`

## Remaining limitation that could not be verified in this sandbox

The runnable ABEARC process in this environment cannot resolve/access outbound Internet hosts, so the supplied live credential could not be used here to authenticate to the user's actual ZENTRA account and enumerate the actual station/device data. The provider behavior was instead validated against the current ZENTRA v5 contract and deterministic fixtures. This is the only material deployment-specific verification step remaining.

The supplied API credential is intentionally **not** included in the release ZIP.

## Exact final real-world verification

1. On the NAS create `/volume1/docker/my-node-app/data/weather.env` if it does not exist.
2. Put the current credential there as `ZENTRA_API_KEY=<current key>`; do not put it in source files.
3. Copy/deploy the completed ABEARC build and run `2. Restart_Update ABEACR Server.bat`.
4. Confirm the container becomes healthy and ABEARC starts normally.
5. Log in as Administrator/Superadmin and open **ABEARC Map -> Automated Weather Stations**.
6. Open the **Station** tab and run **Discover stations**.
7. Compare the discovered station name/device ID, coordinates/elevation, sensor ports/serial numbers, logging/upload intervals and available measurements with ZENTRA Cloud.
8. Confirm the weather marker is at the actual AWS coordinates and the popup shows cached real readings with the correct last-updated time.
9. Trigger one manual sync and compare several readings/timestamps/units directly with ZENTRA Cloud.
10. Queue a 7-day historical resync; compare daily rainfall totals and temperature min/average/max with ZENTRA for the identical local-date range.
11. Verify Overview, Charts, Rainfall, Agriculture, Data Table, Reports and Station tabs; test chart tooltips, series toggles, Fit/Detail mode and PNG export.
12. Export the same period to CSV, XLSX and PDF and verify metadata/units/date boundaries.
13. Restart the ABEARC container and verify cached readings, reading cursor, backfill state, alert rules and scheduler state persist.
14. If practical, interrupt outbound Internet access during a backfill; verify the job remains queued with a future retry time and resumes when connectivity returns.
15. Save a My Map Layout with the AWS layer on/off, reload it, and verify the layer state restores correctly.
16. Verify a general user can view/export weather data but cannot access station/integration management unless granted the appropriate privileges.
17. Verify desktop, tablet and phone layouts, especially popup bounds, dashboard scrolling and chart readability.
