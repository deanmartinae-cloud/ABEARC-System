# ABEARC Telegram Integration

ABEARC v1.54 adds an official Telegram Bot API channel for weather alerts and scheduled weather-station reports.

## Architecture

`ZENTRA / Weather Station -> ABEARC WeatherAlertEvents -> Telegram queue -> Telegram Bot API -> approved chat`

Telegram is a delivery channel only. Weather thresholds remain owned by the existing ABEARC weather module, so a dry-period, heavy-rain, high-VPD, station-offline, or other rule is evaluated once and reused by ABEARC notifications and Telegram.

ABEARC uses Telegram `getUpdates` long polling by default. No public webhook, public NAS IP, port-forward, or inbound HTTPS endpoint is required.

## 1. Create the Telegram bot

1. Open Telegram and start a chat with `@BotFather`.
2. Run `/newbot` and follow the prompts.
3. Copy the Bot API token shown by BotFather.
4. Do not paste the token into ABEARC browser pages, source code, screenshots, or chat messages.

## 2. Configure the NAS secret

Create this persistent file on the NAS:

`/volume1/docker/my-node-app/data/telegram.env`

Contents:

```text
TELEGRAM_BOT_TOKEN=REPLACE_WITH_YOUR_BOTFATHER_TOKEN
```

Optional settings:

```text
TELEGRAM_POLL_TIMEOUT_SECONDS=25
TELEGRAM_REQUEST_TIMEOUT_MS=40000
TELEGRAM_DELIVERY_BATCH_SIZE=20
TELEGRAM_REGISTRATION_CODE_TTL_MINUTES=10
TELEGRAM_MAX_RETRY_COUNT=8
```

The deployment scripts mount `data/` persistently and load `telegram.env` at container startup. The release ZIP contains no Telegram token.

For local Windows use, create `data\telegram.env` with the same variable. `run-local-server.bat` loads it automatically.

## 3. Register a Telegram group, supergroup, channel, or private chat

1. Restart ABEARC after configuring the token.
2. Sign in with a user who has **Manage Telegram Integration**.
3. Open **Settings -> Integrations -> Telegram**.
4. Press **Test bot connection**. ABEARC should display the bot username.
5. Add the bot to the intended Telegram group/channel if it is not already present.
6. Press **Generate registration code** in ABEARC.
7. Send the generated `/abearc_register XXXXXXXX` command in the target chat before it expires.
8. The Telegram bot confirms registration and the chat appears in ABEARC.

Registration codes are one-time and expire automatically. This prevents arbitrary groups that happen to add the bot from becoming approved ABEARC destinations.

For groups, normal Telegram privacy mode is sufficient because registration and supported interactive actions are bot commands. ABEARC does not need to read unrelated group conversation traffic.

## 4. Route weather alerts

Create weather alert rules from the ABEARC weather-station interface first. Then open **Settings -> Integrations -> Telegram -> Weather alert routing** and select:

- Telegram target;
- existing ABEARC weather alert rule;
- whether to send the resolved/cleared notification.

ABEARC queues a unique delivery per alert-event phase. Restarting the NAS does not intentionally resend the same triggered or cleared event.

## 5. Scheduled station reports

ABEARC supports:

- Daily reports;
- Weekly reports;
- Monthly reports.

Schedules use the weather station's configured IANA timezone. Reports can include current temperature, relative humidity, wind, rainfall, period temperature range, and available ET0 totals.

These are ABEARC station summaries, not official PAGASA severe-weather warnings.

## 6. Retry and audit behavior

Telegram deliveries are written to `TelegramDeliveries` before sending. Statuses include:

- `queued`
- `retry`
- `sent`
- `skipped`
- `failed`

HTTP/API rate-limit responses respect Telegram's `retry_after` value. Other temporary failures use bounded exponential retry. Permanent recipient/API failures stop retrying. A Telegram `403` delivery failure disables that target until an administrator reviews it.

Telegram delivery failures do not interrupt ZENTRA synchronization or WeatherAlertEvents processing.

## 7. Privileges

ABEARC v1.54 adds:

- `view_telegram_integration`
- `manage_telegram_integration`
- `manage_telegram_notifications`

The bot token is never returned by an API route. Integration status only reports whether the token is configured.

## 8. Telegram commands

For an approved chat:

- `/weather` — sends a current daily-style summary from the first enabled ABEARC weather station.
- `/abearc_help` — shows available ABEARC bot commands.

Registration uses the temporary `/abearc_register <code>` command.

## 9. Telegram platform behavior

Telegram supports both long polling (`getUpdates`) and webhooks, but they are mutually exclusive. ABEARC deliberately calls `deleteWebhook` before starting long polling so a previous webhook does not silently block updates.

ABEARC processes updates sequentially and persists the next `update_id` offset so acknowledged updates are not reprocessed after restart.

The normal free bot limits are more than sufficient for typical ABEARC weather alerts. ABEARC sends deliveries sequentially and honors Telegram rate-limit responses rather than enabling paid broadcasts.

## Scheduler resilience

Telegram scheduler and delivery-queue execution are single-flight to prevent overlapping ticks from double-processing a queued batch. Daily schedules can catch up later the same station-local day, weekly schedules later in the same local week, and monthly schedules later in the same local month after NAS downtime or a container restart.
