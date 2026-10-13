# ABEARC Project Management System

ABEARC is a full-stack project-management and geospatial operations system for the City Agriculturist Office. It combines project records, document workflows, monitoring, mapping, terrain analysis, automated weather-station data, crop advisories, and Telegram distribution in one role-based application.

This repository contains the consolidated **ABEARC v1.53 production source** (internal package version `1.0.96`), updated on **October 13, 2026**.

## Highlights

- Project lifecycle, document, due-date, review, notification, calendar, and user-management workflows
- Per-user file storage and controlled downloads/forms
- Established-project and asset monitoring with geotagged field evidence
- MapLibre-based Geotag Map with clustering, layouts, print composer, orthomosaics, measurements, undo, and contextual tools
- CHIRPS rainfall, TerraClimate, zoning, administrative boundaries, and NAMRIA elevation integration
- Gravity-flow route analysis with source-locked terrain validation
- Ram-Pump layout and hydraulic screening tools with engineering profiles
- ZENTRA Cloud automated weather stations, analytics, forecasts, alerts, exports, and farm advisory reports
- Telegram weather alerts, approved-chat registration, scheduled reports, retry handling, and encrypted credential storage
- SQLite persistence, modular backend/frontend manifests, Docker deployment, and automated structural/workflow checks

## Current release

ABEARC v1.53 consolidates the v1.52 map and terrain work with Ram-Pump engineering, ZENTRA weather integration, forecasting, crop advisories, farm advisory PDFs, Telegram distribution, and interface refinements.

- [v1.53 release notes](docs/ABEARC_v1.53_RELEASE_NOTES.md)
- [v1.53 merge manifest](ABEARC_v1.53_MERGE_MANIFEST.txt)
- [Telegram release notes](docs/ABEARC_v1.54_RELEASE_NOTES.md)
- [Weather-station integration](docs/WEATHER_STATION_INTEGRATION.md)
- [Weather administration and crop advisories](docs/WEATHER_ADMIN_SETUP_AND_CROP_ADVISORIES.md)
- [Ram-Pump refinement report](ABEARC_RamPump_Gilman_Offline_Refinement_REPORT.md)

## Technology

- Node.js 22 and Express
- SQLite (`sqlite3`)
- HTML, CSS, and browser JavaScript assembled from modular source files
- MapLibre GL, PMTiles, GeoTIFF, GDAL, and geospatial JSON datasets
- PDF, spreadsheet, Word-document, QR-code, and image-processing libraries
- Docker with a persistent `/data` volume

## Repository layout

```text
.
├── src/
│   ├── backend/              # Config, middleware, migrations, models, routes, services
│   └── frontend/             # Layouts, pages, components, styles, scripts, map data
├── scripts/                  # Build, structure checks, integration checks, workflow tests
├── docs/                     # Architecture, deployment, feature, and release documentation
├── public/                   # Generated at build/start time; intentionally not tracked
├── server.js                 # Application entry point
├── package.json
└── Dockerfile
```

For the modular design and maintenance rules, see [Architecture](docs/ARCHITECTURE.md). For map storage, APIs, permissions, and GeoCamera behavior, see [ABEARC Map](docs/ABEARC_MAP.md).

## Prerequisites

- Node.js 22.x and npm
- Docker, if using the container workflow
- GDAL command-line tools for local workflows that use the configured NAMRIA raster
- Outbound HTTPS access for configured weather and climate providers

## Local setup

```bash
git clone https://github.com/deanmartinae-cloud/ABEARC-System.git
cd ABEARC-System
npm ci
npm run check
npm start
```

Open `http://localhost:3000` unless `PORT` is set to another value.

The startup process rebuilds `public/` from `src/frontend/`. Edit source modules under `src/`; do not edit generated browser files directly.

Persistent local state defaults to `data/`. Set `ABEARC_DATA_DIR` to use another data directory. The `data/` directory is ignored because it can contain databases, uploads, credentials, caches, backups, and other operational records.

## Validation

Run the complete checked-in verification suite:

```bash
npm run check
```

The suite validates module structure, runtime wiring, frontend cache safety, dashboard assignments, document dates, map analysis and tools, Ram-Pump behavior, weather providers/workflows, Telegram integration, credential handling, and alert-rate behavior.

To rebuild only the frontend:

```bash
npm run build
```

## Docker

```bash
docker build -t abearc-system .
docker run -d \
  --name abearc-system \
  -p 3000:3000 \
  -e PORT=3000 \
  -e ABEARC_DATA_DIR=/data \
  -v abearc-data:/data \
  --restart unless-stopped \
  abearc-system
```

The image includes a health check and uses the `Asia/Manila` timezone. Production deployments should back up the mounted data volume before upgrades.

## Optional integrations

### ZENTRA weather stations

Configure the integration through the administrator interface, which stores the credential encrypted. The legacy server-side environment fallback is `ZENTRA_API_KEY`. Never place a real key in source control. See [Weather Station Integration](docs/WEATHER_STATION_INTEGRATION.md).

### Telegram

Configure the bot and approved chats through the administrator workflow. A server-side `TELEGRAM_BOT_TOKEN` fallback is supported for deployment, but the token must remain outside the repository. See [Telegram Integration](docs/TELEGRAM_INTEGRATION.md) and the [setup guide](docs/telegram-setup.md).

### NAMRIA elevation data

The NAMRIA DTM is operational data and is not committed. Install it in the persistent data directory and configure `NAMRIA_DTM_PATH` when the default location is not used.

## Security and repository hygiene

- `.env`, runtime data, generated frontend files, uploads, caches, logs, backups, and deployment packages are ignored.
- Credentials belong in the administrator credential store, environment variables, or deployment-only files outside Git.
- Windows deployment helpers are ignored because they may contain machine-specific paths or credentials.
- Operational source workbooks are imported at runtime and are not part of the repository.
- Rotate any credential immediately if it is ever committed or shared outside its intended deployment environment.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Established project asset monitoring](docs/ESTABLISHED_PROJECT_ASSET_MONITORING.md)
- [Telegram integration](docs/TELEGRAM_INTEGRATION.md)
- [Weather station integration](docs/WEATHER_STATION_INTEGRATION.md)
- [Weather administration and crop advisories](docs/WEATHER_ADMIN_SETUP_AND_CROP_ADVISORIES.md)
- [System audit](docs/SYSTEM-AUDIT-2026-09-24.md)
- [AWS/ZENTRA implementation report](docs/AWS_ZENTRA_FINAL_IMPLEMENTATION_REPORT.md)

## License and access

`package.json` marks this application as private. No open-source license is included; use and redistribution require authorization from the project owner.
