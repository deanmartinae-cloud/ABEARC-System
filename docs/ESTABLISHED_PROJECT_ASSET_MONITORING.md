# Established Project & Asset Monitoring

ABEARC v1.45 adds a permanent registry and recurring monitoring workflow for completed or established machinery, infrastructure, irrigation systems, facilities, vehicles, and other project outputs.

## Inventory data

The repository does not include operational monitoring inventory or source workbooks. A fresh database starts with an empty monitoring registry, except for eligible projects synchronized from Project Control. Authorized users can add records manually or import an approved Excel workbook at runtime.

Operational workbooks can contain contact, equipment, and precise-location data. Keep them outside Git and distribute them only through approved protected storage.

## Main capabilities

- Monitoring dashboard and priority visit queue
- Master inventory add, edit, archive, and restore
- Repeat monitoring history with mandatory GeoCam confirmation photos and optional supporting attachments
- Condition, utilization, findings, recommendations, and next-monitoring date
- Follow-up tasks with category, priority, due date, status, and assignee
- Calendar scheduling through the existing ABEARC calendar
- Multiple Participants / Involved Users for a monitoring schedule
- Project linkage and permanent master user assignment
- Search and filters for asset type, condition, district, priority, due status, lifecycle, and assignee
- Excel import and three-sheet Excel export
- Consolidated daily admin and assignee alerts
- Backup and restore of monitoring evidence files

## Mandatory GeoCam confirmation for new monitoring visits

A newly recorded monitoring visit cannot be finalized unless the user selects at least one eligible photo that has already been sent by the GeoCam Android app to ABEARC Geotag Map.

The selected confirmation photo must:

- have `source_type = geocam` and a stable GeoCam `client_capture_id`;
- remain active in Geotag Map and contain its original stored image file;
- contain original GPS coordinates with `valid` or `low_accuracy` location status;
- retain `coordinate_source = upload_payload` rather than a manually positioned location;
- include readable Latitude and Longitude values in the GeoCam image-stamp text;
- have stamped coordinates that match the uploaded map coordinates;
- have a GeoCam capture date matching the monitoring visit date; and
- not already confirm another monitoring visit or belong to another inventory item.

When the visit is saved, ABEARC links the existing `MapMedia` record to the inventory item and monitoring visit through `inventory_item_id` and `monitoring_record_id`. The monitoring visit coordinates come from the selected GeoCam photo. The original photo is not copied or modified.

A confirmation photo linked to a finalized monitoring visit cannot be hidden, permanently deleted, or manually relocated through Geotag Map. Optional PDFs, office documents, and additional images may still be attached, but those files do not replace the mandatory GeoCam confirmation photo.

The 92 packaged historical visits and legacy visits recorded before this rule remain unchanged and are labeled as imported or legacy records in monitoring history.

## Schedule Monitoring Visit behavior

- The date defaults to the current date in the `Asia/Manila` timezone.
- Start and end times default to 8:00 AM and 12:00 PM.
- A date earlier than today requires a confirmation warning in the interface and server-side confirmation.
- The end time must be later than the start time.
- At least one active Participants / Involved Users account is required.
- The current user and the inventory's permanent assigned user are preselected when available.
- Scheduling does not change the permanent assigned user in the master inventory record.
- Moving, cancelling, changing the type of, or deleting the linked event in Calendar synchronizes the inventory's next-monitoring date.

## Modal behavior

The inventory detail remains open while Edit Master Record, Record Visit, Schedule Monitoring Visit, or Add Monitoring Task is used. The child modal appears above the detail and Escape or browser Back closes the child first.

## Validation and transaction safeguards

- Inventory names, codes, dates, costs, coordinates, assignees, and project links are validated.
- Archived records cannot receive new visits, schedules, or tasks until restored.
- A monitoring visit and its evidence metadata, optional task, and inventory condition/date update commit together or roll back together.
- Failed evidence saves clean temporary and moved files.
- Follow-up tasks require a valid title and authorized task-management access.
- Excel import commits the full batch or rolls back the full batch; partial imports are not retained.

## Privileges

- `view_monitoring_inventory`
- `add_monitoring_inventory`
- `edit_monitoring_inventory`
- `conduct_monitoring_visit`
- `schedule_monitoring_visit`
- `manage_monitoring_tasks`
- `import_monitoring_inventory`
- `export_monitoring_reports`

Admins receive all monitoring privileges by default. Users receive view, add, conduct-visit, and schedule privileges by default. Privileges remain configurable in User Management.

## Data storage

- SQLite tables: `MonitoringInventory`, `MonitoringVisits`, `MonitoringTasks`, `MonitoringVisitAttachments`
- Evidence directory: `data/monitoring-attachments`
- Calendar linkage: `CalendarEvents.related_inventory_id`

All additions are migration-safe and preserve the existing ABEARC database and current project, map, drive, calendar, notification, and deployment features.
