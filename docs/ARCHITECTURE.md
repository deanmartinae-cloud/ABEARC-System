# ABEARC Modular Architecture

## Runtime design

The application keeps the original execution order through a compatibility loader. `server.js` builds the frontend and compiles the backend fragment manifest into one Node.js lexical scope. This preserves existing cross-function references, route order, SQLite schema/migrations, upload paths, session logic, and API behavior while allowing maintainers to work in smaller domain files.

## Backend

- `src/backend/config/` – dependencies, Express setup, storage paths, SQLite connection.
- `src/backend/utils/` – shared utilities and cross-domain helper functions.
- `src/backend/middleware/` – authentication, authorization, uploads, API protection, global error handling.
- `src/backend/models/` – SQLite schema, tables, indexes, compatibility migrations, seed data.
- `src/backend/services/` – shared application and domain services.
- `src/backend/controllers/` – named Express route handlers extracted from route registration.
- `src/backend/routes/` – endpoint groups by domain, loaded in the original order.
- `src/backend/migrations/` – blocking startup migrations.
- `src/backend/startup/` – final migration wait and HTTP listener.

## Frontend

- `src/frontend/pages/` – login, dashboard, review, My Drive, calendar, notifications, project detail, settings.
- `src/frontend/components/` – header, sidebar, notification drawer, toast and print shells.
- `src/frontend/modals/` – modal markup grouped by feature.
- `src/frontend/styles/` – externalized stylesheet modules.
- `src/frontend/services/` – theme bootstrap and API/state service code.
- `src/frontend/scripts/` – feature scripts grouped by domain.
- `public/` – generated runtime assets; do not edit directly.

## Commands

- `npm start` – builds the frontend and starts the server.
- `npm run build` – rebuilds `public/index.html` and assets.
- `npm run check` – validates backend syntax, browser-script syntax, and preserved DOM IDs.

## Compatibility rule

Keep entries in both manifests ordered. Moving a fragment can change middleware or route precedence. New code should be added to the appropriate domain file and, where practical, use explicit service/controller functions rather than adding more logic directly inside route handlers.
