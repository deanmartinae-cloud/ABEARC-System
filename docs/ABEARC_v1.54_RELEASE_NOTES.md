# ABEARC v1.54 — Telegram Weather Distribution Release

Date: 2026-10-08  
Baseline: `ABEARC_SYSTEM_v1.53_AWS_ZENTRA_RAMPUMP_FINAL_NAS.zip`  
Internal Node package version: `1.0.97`

## New feature: official Telegram Bot integration

ABEARC now includes a first-class Telegram delivery channel designed with the same modular production pattern used for the ZENTRA weather integration.

### Backend module

Added module 22:

- `src/backend/config/22-telegram.config.js`
- `src/backend/migrations/22-telegram.migration.js`
- `src/backend/services/22-telegram.service.js`
- `src/backend/controllers/22-telegram.controller.js`
- `src/backend/routes/22-telegram.routes.js`

### Persistent storage

Runtime migration creates:

- `TelegramTargets`
- `TelegramRegistrationCodes`
- `TelegramWeatherRoutes`
- `TelegramWeatherRouteState`
- `TelegramReportSchedules`
- `TelegramDeliveries`
- `TelegramSystemState`

### NAS-safe Bot API connection

- Bot token is read only from `TELEGRAM_BOT_TOKEN`.
- Persistent NAS/local configuration uses `data/telegram.env`.
- Token is not stored in SQLite and is not returned to browser APIs.
- Default update transport is Telegram long polling (`getUpdates`).
- ABEARC removes an existing webhook before long polling because Telegram does not permit webhook and `getUpdates` operation at the same time.
- The `update_id` offset is persisted across restart.

### Approved chat registration

- Settings can generate one-time, expiring Telegram registration codes.
- Run `/abearc_register <code>` inside the intended Telegram group, supergroup, channel, or private chat.
- Successful registration stores only the Telegram chat identity/metadata in ABEARC.
- Registration codes are single-use and expire automatically.

### Weather alert distribution

- Telegram routes consume the existing `WeatherAlertEvents` table.
- Weather thresholds and calculations remain owned by the ZENTRA/AWS weather engine.
- Rules can be assigned to one or more registered Telegram targets.
- Triggered and cleared phases can be sent separately.
- Per-route transition state allows the same weather condition to alert again after it resolves and later reactivates.
- Delivery source keys prevent duplicate sends across scheduler cycles or NAS restarts.

### Scheduled reports

- Daily, weekly, and monthly station reports.
- Station-local scheduling using each station's configured timezone.
- Summary includes station health, current conditions, rainfall totals, period temperature range, and available ET0 totals.

### Reliability

- Durable queued delivery state.
- Single-flight scheduler and delivery processing prevent overlapping minute ticks from double-sending queued work.
- Weekly/monthly station-local schedules catch up after a NAS restart within the same reporting period instead of silently missing the report.
- Bounded retry/backoff.
- Telegram `retry_after` handling for rate limits.
- Permanent failures stop retrying.
- A recipient returning Telegram 403 is disabled for administrator review.
- Telegram failures are isolated from weather synchronization and alert evaluation.

### Settings / privileges

Added Settings -> Integrations -> Telegram with:

- Bot connection status and test;
- one-time chat registration;
- registered target enable/disable;
- target test-send;
- weather-rule routing;
- scheduled report configuration;
- delivery audit history.

New privileges:

- `view_telegram_integration`
- `manage_telegram_integration`
- `manage_telegram_notifications`

## Version changes

- ABEARC user-facing release: v1.53 -> v1.54
- Node package version: 1.0.96 -> 1.0.97
