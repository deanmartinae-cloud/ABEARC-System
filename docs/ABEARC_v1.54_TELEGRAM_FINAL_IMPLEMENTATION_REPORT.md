# ABEARC v1.54 — Telegram Integration Final Implementation Report

Date: 2026-10-08  
Baseline: `ABEARC_SYSTEM_v1.53_AWS_ZENTRA_RAMPUMP_FINAL_NAS.zip`  
Baseline SHA-256: `a513a36640fdde6c6d6f2ebe7101c38dd5bd016596eeaabec1fa7ee4f9745dcf`

## Scope

This release adds Telegram as a first-class ABEARC integration without redesigning the existing ZENTRA/AWS weather calculations, Geotag Map, Gravity Flow, Ram-Pump, orthomosaic, My Map Layouts, Print Mode, SALT, Multi-Measure, document, calendar, or project-management workflows.

The Telegram integration uses the official Telegram Bot API. It does not automate Telegram Desktop/Web and does not require a personal Telegram account session.

## Architecture

`Weather station / ZENTRA -> ABEARC WeatherAlertEvents -> Telegram routing/queue -> Telegram Bot API -> approved Telegram chat`

Telegram is intentionally a delivery layer. Existing ABEARC weather rules remain the single source of truth for dry periods, heavy rainfall, temperature, wind, VPD, sensor/station health, and other alert conditions.

## Telegram connection

- Server-only `TELEGRAM_BOT_TOKEN` configuration.
- Persistent NAS/local secret file: `data/telegram.env`.
- Token is not stored in SQLite and is never returned by an ABEARC API endpoint.
- Long polling through `getUpdates` is the default, so no public webhook, inbound NAS port, or public HTTPS endpoint is required.
- ABEARC calls `deleteWebhook` before long polling to prevent a previous webhook from blocking `getUpdates`.
- `update_id` offset is stored in SQLite and advanced sequentially after each handled update.
- Poll failures are logged and retried without stopping ABEARC.

## Approved chat registration

ABEARC does not automatically trust every chat that adds the bot.

1. An authorized ABEARC administrator generates a one-time registration code.
2. The code expires after a short configurable period and is stored only as a SHA-256 hash.
3. The administrator sends `/abearc_register <code>` in the target Telegram group, supergroup, channel, or private chat.
4. Long polling receives the command and validates the one-time code.
5. The Telegram chat is stored as an approved ABEARC target.
6. The code is marked used and cannot be reused.

The bot does not need access to unrelated group conversation traffic for this workflow.

## Weather alert routing

The Settings UI allows an authorized user to map an existing ABEARC weather alert rule to one or more registered Telegram targets.

Supported behavior includes:

- send when the alert becomes active;
- optional send when the alert is cleared/resolved;
- durable queue and delivery audit;
- per-route transition tracking;
- repeated active scheduler evaluations do not spam duplicate messages;
- after an alert resolves and later becomes active again, the new active transition is delivered again;
- enabling a route after an already-resolved historical event does not send a stale cleared message.

`TelegramWeatherRouteState` tracks the last delivered logical state per route/event. This is necessary because ABEARC's existing `WeatherAlertEvents` row is reused when the same condition resolves and later reactivates.

## Scheduled weather reports

Authorized users can schedule:

- Daily station summaries;
- Weekly station summaries;
- Monthly station summaries.

Schedules use the weather station's configured IANA timezone. Daily reports recover later the same local day, weekly reports recover later in the same local week, and monthly reports recover later in the same local month after a restart/outage. Reports include available station health/current conditions, rainfall totals, period temperature range, and available ET0 totals. ABEARC labels these as station-generated reports rather than official PAGASA severe-weather warnings.

## Delivery queue and reliability

`TelegramDeliveries` persists every logical send before transmission.

Statuses:

- `queued`
- `retry`
- `sent`
- `skipped`
- `failed`

Reliability rules:

- sequential sending avoids unnecessary Telegram flood limits;
- scheduler and delivery queue execution are single-flight so overlapping timer/manual activity cannot process the same queued batch concurrently;
- Telegram `retry_after` is honored on 429 responses;
- temporary failures use bounded exponential retry;
- retry count is capped;
- permanent 400/401/403/404 failures do not retry indefinitely;
- a 403 target is disabled for administrator review;
- source-key uniqueness prevents repeat transmission of the same logical delivery;
- Telegram failures are isolated from the weather scheduler and cannot stop ZENTRA synchronization.

## Database additions

- `TelegramTargets`
- `TelegramRegistrationCodes`
- `TelegramWeatherRoutes`
- `TelegramWeatherRouteState`
- `TelegramReportSchedules`
- `TelegramDeliveries`
- `TelegramSystemState`

## ABEARC privileges

- `view_telegram_integration`
- `manage_telegram_integration`
- `manage_telegram_notifications`

Administrator defaults include the Telegram privileges. Superadmin continues to receive the normal privilege bypass/default behavior.

## Settings UI

Added **Settings -> Integrations -> Telegram** with:

- connection state;
- bot identity;
- last poll/error information;
- active target count;
- queue/failure counts;
- Test Bot Connection;
- one-time registration-code generation;
- target enable/disable;
- target test send;
- weather alert routing;
- scheduled station reports;
- delivery history.

## Telegram commands

- `/abearc_register <one-time-code>` — authorize the current chat.
- `/weather` — current daily-style summary from the first enabled ABEARC station for an already-approved chat.
- `/abearc_help` or `/help` — show supported bot commands.

## Deployment changes

- `run-local-server.bat` loads `data\telegram.env` when present.
- `2. Restart_Update ABEACR Server.bat` independently loads both `data/weather.env` and `data/telegram.env` into the Docker container.
- The existing NAS fullstack copy workflow preserves the `data` directory, so both secret files survive updates.
- Docker image build now runs the Telegram structural/security, Bot API contract, and SQLite workflow fixtures.

## Version changes

- ABEARC v1.53 -> v1.54
- Node package 1.0.96 -> 1.0.97
- Backend compatibility modules: 85
- Protected DOM IDs: 709
- Runtime API routes: 321

## Verification completed

Passed on the final source tree:

- frontend build, including preservation of committed MapLibre/PMTiles/pdf-lib vendor assets when rebuilding an extracted release without `node_modules`;
- structure / backend combined-scope syntax;
- 709-DOM-ID compatibility baseline;
- runtime route wiring: 321 routes;
- frontend cache safety;
- Telegram structural/security checks;
- Telegram Bot API contract/formatter fixtures;
- Telegram SQLite workflow covering migration, one-time registration, alert deduplication, active -> resolved -> active transitions, queue transmission, and scheduled-report persistence;
- NAS readiness health-state checks;
- map analysis;
- orthomosaics;
- My Map Layouts and switching;
- Print Mode;
- Ram-Pump static/integration checks;
- Ram-Pump synthetic end-to-end workflow;
- SALT/contours;
- Map Undo;
- Multi-Measure;
- Gravity Flow path routing;
- Gravity native NAMRIA routing;
- Gravity ascent routing;
- document-date regression;
- ZENTRA provider contract fixtures;
- SQLite-backed weather workflow fixtures.

### Known existing test/environment facts

- `scripts/check-map-view.js` still reports the same `1 !== 0` assertion documented in v1.53/v1.52 and was not introduced by Telegram.
- `scripts/check-dashboard-assignments.js` cannot execute in this extracted sandbox because `node_modules/sqlite3` is not installed here. The Docker dependency stage still runs `npm ci --omit=dev`, which installs the production dependency before runtime.
- A Docker/Podman daemon is not available in this sandbox, so an actual container image start was not executed here. Dockerfile structural/runtime checks and NAS launcher readiness logic were tested directly.

## Real Telegram verification remaining

No real BotFather token was supplied for this implementation, so the release intentionally contains no live Telegram credentials. After deployment:

1. Create a bot through `@BotFather`.
2. Create `/volume1/docker/my-node-app/data/telegram.env` with `TELEGRAM_BOT_TOKEN=<token>`.
3. Restart ABEARC.
4. Open Settings -> Integrations -> Telegram.
5. Test the bot connection.
6. Add the bot to a test Telegram group.
7. Generate a one-time registration code and run the command in that group.
8. Send an ABEARC test message.
9. Route a test weather alert rule to the group and verify active/cleared delivery.
10. Create a temporary scheduled report and verify station-local delivery timing.
11. Restart the NAS container and confirm the registered chat, update offset, route state, schedules, and delivery history persist.

## Security status

The release contains no user Telegram token. Telegram credentials are expected only in persistent server-side `data/telegram.env`, which is excluded from normal source/deployment packaging.
