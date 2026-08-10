# Refactor Summary

## What changed

- Replaced the two runtime monoliths with a five-line `server.js` bootstrap and manifest-driven modules.
- Split the backend into configuration, utilities, middleware, models, services, controllers, routes, migrations, and startup modules.
- Extracted 196 top-level Express handlers into named controller files while preserving route registration and middleware order.
- Split the frontend into eight page files, reusable layout/components, five modal groups, three stylesheet modules, an API/state service, and feature scripts.
- Added an automatic frontend builder. `npm start` rebuilds `public/index.html` before starting Express.
- Added structural and runtime-wiring checks that do not require a live database or installed application dependencies.

## Compatibility retained

- Existing SQLite table names, columns, indexes, seeds, migrations, and file paths.
- Existing API paths, HTTP methods, middleware precedence, permissions, sessions, notifications, uploads, backups, calendar behavior, My Drive behavior, project documentation, and reports.
- Existing interface markup, element IDs, inline event bindings, styles, and browser JavaScript behavior.
- Existing `package-lock.json`, dependency versions, batch launch scripts, and port behavior.

## Validation completed

- Backend compatibility-scope syntax check: passed.
- All externalized browser script syntax checks: passed.
- Static DOM compatibility baseline: 463 IDs preserved.
- Static API route catalog: 200 exact method/path matches.
- Runtime route wiring with dependency stubs: 208 registrations.
- Public login routes remain before `/api` authentication protection.
- Original main browser JavaScript reconstructs exactly from the new script modules.
- Original inline styles reconstruct exactly from the new stylesheet modules.

## Deployment

Retain the existing `data` directory when replacing the application source. Then run:

```bash
npm ci
npm run check
npm start
```

The generated `public/index.html` and `public/assets/` files are rebuilt automatically. Make future changes under `src/`.
