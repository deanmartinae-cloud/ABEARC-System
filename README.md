# ABEARC Project Management System

![ABEARC logo](psabe.png)

ABEARC is a full-stack project management and field-monitoring platform for organizing project records, requirements, documents, schedules, geotagged media, monitoring activities, and team collaboration in one system.

This repository contains the modular application source. It preserves the established API paths, database schema, migrations, storage conventions, privileges, and frontend element identifiers used by existing ABEARC deployments and companion Android applications.

## Core capabilities

- Project registry with proposal, implementation, monitoring, completion, and disposition workflows.
- Document requirements, uploads, due dates, reviews, and project documentation.
- Calendar scheduling, notifications, activity history, and approval workflows.
- User, role, privilege, requestee, project-type, and document-type administration.
- Established asset registry with monitoring visits, tasks, media, and AFME data integration.
- Geotag map with project locations, clustered media, zoning data, and GeoCamera uploads.
- Personal My Drive storage, folder management, sharing, trash, and file downloads.
- Dashboards, analytics, feedback, configuration, backup, and maintenance tools.
- QR-compatible authentication flows for supported ABEARC Android clients.

## Technology

- Node.js and Express
- SQLite
- Modular HTML, CSS, and browser JavaScript frontend
- MapLibre GL and PMTiles mapping support
- Server-side document, spreadsheet, PDF, image, and QR-processing libraries
- Docker and Synology NAS deployment support

## Repository structure

```text
ABEARC-System/
|-- docs/                 Architecture, mapping, monitoring, and deployment guides
|-- scripts/              Build, validation, and runtime-loading utilities
|-- src/
|   |-- backend/          API routes, controllers, services, models, and migrations
|   `-- frontend/         Pages, components, styles, scripts, and services
|-- Dockerfile            Container build configuration
|-- package.json          Dependencies and project commands
`-- server.js             Application entry point
```

The `public/` directory is generated from `src/frontend` whenever the server starts. Make frontend changes in `src/frontend`, not in generated files.

## Getting started

### Requirements

- Node.js with npm
- A writable location for the application database and runtime storage

### Install and run

```bash
npm ci
npm run check
npm start
```

`npm run check` validates the modular structure, preserved frontend identifiers, route wiring, and authentication order before deployment.

## Runtime data

Operational data is intentionally kept outside version control. The following are not committed:

- Application databases and database sidecar files
- Uploaded documents, map media, My Drive files, and backups
- Generated frontend output and installed dependencies
- Deployment state, local environment configuration, and credentials
- APKs, deployment archives, logs, and temporary files

Back up the runtime data directory and database according to the deployment guide before updating an existing installation.

## Mobile QR login security

Configure either `MOBILE_QR_LOGIN_SECRET` or `SESSION_SECRET` with at least 32 characters before enabling mobile QR login. There is no built-in fallback secret.

QR authorization codes expire after two minutes and can be exchanged only once. The mobile session created by a successful exchange remains long-lived according to the existing mobile session policy.

## Backup restore safety

Backup restores inspect the archive's total uncompressed size before extraction. The defaults allow at most 20 GB and 100,000 ZIP entries; deployments can lower these with `BACKUP_RESTORE_MAX_UNCOMPRESSED_BYTES` and `BACKUP_RESTORE_MAX_ENTRIES`.

## Documentation

- [Architecture and maintenance rules](docs/ARCHITECTURE.md)
- [Geotag Map storage and integration](docs/ABEARC_MAP.md)
- [Established project asset monitoring](docs/ESTABLISHED_PROJECT_ASSET_MONITORING.md)
- [Monitoring integration validation](docs/ESTABLISHED_MONITORING_INTEGRATION_VALIDATION.md)
- [Modular refactor summary](docs/REFACTOR_SUMMARY.md)
- [Synology NAS installation, update, backup, and rollback guide](docs/ABEARC%20Synology%20NAS%20Installation,%20Update,%20Backup,%20and%20Rollback%20Guide.docx)

Review the architecture guide before adding modules or changing application startup order.

## Deployment

The repository includes a `Dockerfile` and documentation for Synology NAS deployments. A deployment should provide persistent storage for the database and uploaded files, restrict access to trusted users, and use HTTPS when the system is accessible outside a trusted local network.

For an existing installation:

1. Back up the database, runtime files, and current deployment configuration.
2. Install dependencies with `npm ci`.
3. Run `npm run check`.
4. Start the application and verify authentication, projects, documents, maps, and uploads.
5. Keep a tested rollback copy until the updated deployment is confirmed stable.

## Security

- Never commit NAS passwords, signing keys, API credentials, session secrets, or production configuration.
- Keep operational databases, user uploads, and backups out of Git.
- Use HTTPS or a trusted VPN for remote access.
- Apply least-privilege roles and review administrative permissions regularly.
- Store deployment secrets using the target environment's protected configuration mechanism.

The local NAS restart/update helper that contains deployment credentials is excluded from this repository.
