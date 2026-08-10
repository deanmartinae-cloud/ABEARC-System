# ABEARC v1.45 Established Monitoring Integration Validation

## Comparison basis

This release was audited against:

- the current modular deployment package supplied by the user; and
- the earlier `ABEARC-v1.45-Established-Project-Asset-Monitoring-Integrated.zip` package.

The audit compared every packaged file by relative path and SHA-256 content, reviewed all monitoring source modules and all existing files changed by the integration, rebuilt the modular frontend, checked runtime route registration, simulated the monitoring database migration, and exercised the monitoring schedule, calendar synchronization, visit, task, and import paths with focused route tests.

## Regressions found in the earlier integrated package

### 1. Existing ABEARC Map vendor files were missing

The earlier integrated ZIP omitted all eight MapLibre runtime files already present in the current deployment:

- `public/assets/vendor/maplibre-gl-dev.mjs`
- `public/assets/vendor/maplibre-gl-shared-dev.mjs`
- `public/assets/vendor/maplibre-gl-shared.mjs`
- `public/assets/vendor/maplibre-gl-worker-dev.mjs`
- `public/assets/vendor/maplibre-gl-worker.mjs`
- `public/assets/vendor/maplibre-gl.css`
- `public/assets/vendor/maplibre-gl.js`
- `public/assets/vendor/maplibre-gl.mjs`

This could break or degrade the existing ABEARC Geotag Map. The audited release restores all eight files byte-for-byte from the supplied deployment package.

### 2. Unrelated data-directory behavior was introduced

The earlier integration added an `ABEARC_DATA_DIR` environment-variable override even though this was not required by Established Monitoring. The audited release restores the current deployment's original data-directory logic and adds only the required `monitoring-attachments` path.

### 3. Monitoring child modals could appear behind or close the wrong modal

`Edit Master Record` used the same stacking level as the open inventory detail. Visit, schedule, and task overlays also needed a defined child-modal order for Escape and browser Back behavior.

The audited release keeps the inventory detail at `z-50`, places all monitoring child modals at `z-[60]`, and orders monitoring overlays child-first in navigation history. Closing Edit, Visit, Schedule, or Task now returns to the still-open inventory detail instead of hiding or closing the wrong layer.

### 4. Schedule Monitoring Visit used one assignee instead of calendar participants

The schedule modal now reuses the existing Calendar user-picker behavior and supports multiple **Participants / Involved Users**. The current user and the inventory master assignee are preselected when available, duplicates are removed, and all selected users receive participant records in the Calendar event.

The inventory's permanent master assignee is no longer silently changed by creating a schedule.

### 5. Schedule date and time validation was incomplete

The audited release now:

- defaults the monitoring schedule date to the current date in `Asia/Manila`;
- defaults the time to 8:00 AM–12:00 PM;
- warns and requires confirmation when the date is earlier than the current Manila date;
- verifies the confirmation again on the server;
- requires at least one participant;
- rejects invalid times and an end time that is not later than the start time; and
- rejects unavailable, hidden, or system-account participants.

### 6. Calendar changes could leave the inventory schedule stale

When a monitoring event is moved, cancelled, converted to another event type, or permanently deleted through the normal Calendar, the related inventory's `next_monitoring_date` is now synchronized. If no future monitoring event remains, the value falls back to the last monitoring date plus the inventory monitoring frequency.

### 7. Monitoring transaction and validation gaps

The audited release also corrects monitoring-only failure paths:

- visit, evidence metadata, optional follow-up task, and inventory status updates are saved transactionally;
- moved or temporary evidence files are removed when saving fails;
- a checked “Create a follow-up task” option requires a task title;
- task creation from a visit requires the task-management privilege;
- task assignees, dates, status, and related visits are validated;
- Excel import is all-or-nothing and cannot leave a partial batch after a row failure;
- invalid inventory dates, costs, coordinates, assignments, and linked projects are rejected;
- archived inventory cannot receive new visits, schedules, or tasks until restored;
- dashboard priority and attention totals exclude archived inventory; and
- project choices load correctly even when Established Monitoring is opened before the Projects dashboard.

### 8. Monitoring date labels used the activity-feed formatter

Monitoring dates were previously routed through the relative activity-time formatter, which could show labels such as “Just now” or include an unnecessary time. Monitoring records now use the application's date-only formatter.

## Scope-control result

Compared with the supplied deployment package, the audited release has:

- **0 missing deployment files**;
- **12 new monitoring files**;
- **25 existing files changed** only for required monitoring registration or compatibility hooks.

The changed existing-file categories are:

- monitoring evidence directory creation, backup, restore, and health reporting;
- monitoring privileges and default role grants;
- backend/frontend manifests and expected route-count checks;
- monitoring navigation, notification targeting, mobile/sidebar entry, and release version text;
- one narrow Calendar synchronization hook for monitoring-linked events; and
- generated frontend output corresponding to the source changes.

No existing project, document, My Drive, Geotag Map, authentication, deployment BAT, or unrelated Calendar workflow was intentionally redesigned.

## Inventory-data validation

No operational inventory workbook is packaged with the repository and a fresh database does not preload monitoring records. Excel inventory is accepted only through the privilege-protected runtime import workflow.

## Automated checks completed

- Frontend modular build: passed
- Backend modules: 55, all present
- Frontend DOM IDs: 598 unique IDs, zero duplicates
- Runtime API registrations: 252, with public login before API protection
- JavaScript syntax: all source, generated frontend, and check scripts passed
- Monitoring route catalog: all 13 endpoints privilege-protected
- MapLibre restoration: all 8 files matched the supplied deployment byte-for-byte
- Schedule route tests: multi-user participants, creator ownership, past-date confirmation, time validation, invalid-user rejection, and master-assignee preservation passed
- Calendar synchronization tests: Manila date conversion, move, cancel/delete, next-event selection, and visit-frequency fallback passed
- Visit/import tests: required findings, coordinate and next-date validation, embedded-task validation and privilege enforcement, transaction commit/rollback, and all-or-nothing import passed
- Fresh-database validation: no packaged monitoring inventory is inserted; eligible Monitoring/Completed projects still synchronize through Project Control

## Mandatory GeoCam visit-confirmation update

The audited monitoring package was extended without changing unrelated project, drive, map rendering, authentication, deployment, or general calendar workflows.

New monitoring visits now require an existing GeoCam photo from Geotag Map. Server-side validation verifies the GeoCam source, capture ID, original GPS coordinate source, active map state, physical image-file presence, image-stamp latitude and longitude, coordinate agreement, visit-date agreement, ownership/access, inventory linkage, and single-use confirmation rule.

Saving a visit transactionally links the selected `MapMedia` rows to the inventory item and `MonitoringVisits` row. A concurrent reuse attempt causes the full visit transaction to roll back. Linked confirmation photos are protected from hide, permanent delete, bulk delete, and manual coordinate correction. Historical imported and legacy visits are retained unchanged.

Focused validation covered:

- accepted stamped GeoCam photo;
- rejection of missing stamp, missing capture time, manual coordinates, mismatched coordinates, wrong capture date, reused photo, missing image file, inaccessible owner, and another-inventory linkage;
- transaction linking and single-use race guard;
- monitoring-history display of confirmation thumbnails;
- preservation of optional supporting attachments;
- unchanged monitoring schema and privilege-protected runtime import workflow.

## Runtime limitation

A full production Express/Docker session with browser interaction was not launched in the analysis container because the package did not include installed `node_modules` and the available package mirror did not provide every locked runtime package. Static structure, generated frontend, route-registration, SQL/migration, focused controller-route behavior, archive integrity, and source-diff validations were completed. A normal staging deployment with the existing NAS data volume remains the final environment-specific verification step.

## Multi-source GeoCam confirmation patch

The monitoring confirmation workflow now accepts a valid GeoCam photo from Geotag Map, a manual original JPG/JPEG upload, or the current user's My Drive. The same final server-side checks apply to all sources: GeoCam source evidence, stamped Latitude and Longitude, geotag/stamp coordinate agreement, capture-date agreement, original file presence, inventory linkage, and single-use protection.

Manual uploads additionally require embedded EXIF GPS and capture time plus recoverable GeoCam stamp metadata. My Drive selections require the immutable file to be present and the existing GeoCam mobile-upload markers and stored stamp metadata; when embedded EXIF is present, it must agree with the stored mobile metadata.

Validated My Drive and manual photos are copied into Geotag Map and linked to the monitoring visit transactionally. A failed validation, database operation, map insertion, supporting-file save, or follow-up-task save rolls back the visit and removes newly created map files. Existing Geotag Map photos are linked without duplication.

Patch-specific structure results:

- 55 backend modules retained;
- 608 unique frontend DOM IDs with zero duplicates;
- 253 runtime API route registrations, with public authentication still before API protection;
- 16 monitoring endpoints, all privilege-protected;
- all eight existing MapLibre files retained unchanged;
- no changes to the packaged 218 inventory rows or 92 imported historical visits.
