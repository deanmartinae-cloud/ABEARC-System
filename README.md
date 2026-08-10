# ABEARC Project Management System

This package is the modular refactor of the existing full-stack application. Existing features, API paths, database tables, migrations, file storage conventions, and interface IDs are retained.

## Repository contents

- `src/backend` - Express routes, controllers, services, database configuration, and bundled reference assets.
- `src/frontend` - source HTML fragments, styles, scripts, services, and frontend data.
- `scripts` - frontend build, runtime loading, and structural validation utilities.
- `docs` - architecture, mapping, monitoring, compatibility, and deployment documentation.
- `server.js` - application entry point; it rebuilds the generated `public` assets before loading the backend.

Runtime data, uploaded user files, databases, deployment state, local credentials, generated frontend files, dependency folders, APKs, and deployment archives are intentionally not committed.

See `docs/ARCHITECTURE.md` for the folder map and maintenance rules.

See `docs/ABEARC_MAP.md` for the Geotag Map storage, API, privilege, clustering, and GeoCamera upload notes.

See `docs/ESTABLISHED_PROJECT_ASSET_MONITORING.md` for the established asset registry, packaged AFME data migration, monitoring visits, tasks, calendar scheduling, and privileges.

```bash
npm ci
npm run check
npm start
```

The server requires Node.js and npm. Install dependencies with `npm ci`; do not copy a local `node_modules` directory into a deployment or commit it to source control.

Generated files under `public/` are rebuilt automatically at startup. Edit the source modules under `src/` instead.

## Deployment and operations

- Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing module boundaries.
- Read [`docs/ABEARC_MAP.md`](docs/ABEARC_MAP.md) for map storage and GeoCamera integration.
- Read [`docs/ESTABLISHED_PROJECT_ASSET_MONITORING.md`](docs/ESTABLISHED_PROJECT_ASSET_MONITORING.md) for asset monitoring behavior.
- The full Synology NAS installation, update, backup, and rollback guide is included as a Word document in this repository.

Keep NAS passwords, environment-specific settings, operational databases, backups, and user uploads outside Git. The excluded local restart/update script contains deployment credentials and must never be committed.

## CHIRPS rainfall map (v1.0.89)

The Geotag Map Layers menu includes a nationwide Philippines CHIRPS v3 accumulated-precipitation overlay with adjustable start/end dates, 7/30/90/365-day presets, opacity control, point graphs/downloads, and a millimetre legend. The server reads official CHIRPS final cloud-optimized rasters, uses monthly files for complete months and daily RNL files for partial months, and caches prepared Philippines datasets and tiles under `data/map-chirps`.

Deployment requirement: the ABEARC server must have outbound HTTPS access to `data.chc.ucsb.edu`. The selectable range defaults to the latest final CHIRPS period and is limited to 1,826 days per request; both the limit and cache size can be adjusted with `MAP_CHIRPS_MAX_RANGE_DAYS` and `MAP_CHIRPS_MAX_CACHED_RANGES`.
