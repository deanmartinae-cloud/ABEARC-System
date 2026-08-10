# Geotag Map

Geotag Map stores GeoCamera field photos outside My Drive in dedicated persistent storage:

- `/data/map-media/originals`
- `/data/map-media/thumbnails`
- `/data/map-media/temp`

Map media is served only through authenticated API routes.

## Database

`MapMedia` is created by `src/backend/migrations/14-map-media.migration.js`. It records owner, uploader, optional project/calendar links, original and thumbnail paths, SHA-256 hash, GeoCamera metadata, coordinate status, visibility, and map status. Migrations are idempotent.

Location statuses are `valid`, `missing_coordinates`, `invalid_coordinates`, `low_accuracy`, `outside_davao_city`, and `manual_location`. The initial low-accuracy threshold is `25` meters.

## Privileges

- `view_abearc_map`
- `upload_map_media`
- `manage_own_map_media`
- `manage_all_map_media`
- `review_map_locations`

## API

Mobile upload:

- `POST /api/mobile/map-media/upload`
- `POST /api/mobile/map-media/upload-batch`
- `GET /api/mobile/map-media/projects`

Map data:

- `GET /api/map/config`
- `GET /api/map/media`
- `GET /api/map/media/:id`
- `GET /api/map/media/:id/original`
- `GET /api/map/media/:id/thumbnail`
- `GET /api/map/summary`
- `GET /api/map/filter-options`
- `GET /api/map/clusters`
- `GET /api/map/clusters/:clusterId`

Editing, linking, and maintenance endpoints are implemented in `src/backend/routes/14-map-media.routes.js`.

## GeoCamera Upload

GeoCamera `Send to ABEARC` presents two separate destinations:

- `My Drive` posts each selected image to `/api/mobile/geocam/upload`, preserving the organized `ABEDGEOCAM Uploads` folder hierarchy and skipping existing filenames.
- `Geotag Map` posts each stamped image to `/api/mobile/map-media/upload` with multipart field `photo`. Raw copies and photos without a valid ABEDGEOCAM image stamp are skipped locally.

The Send action is available only while GeoCamera is signed in to ABEARC. Its destination chooser uses explicit folder and map icons, destination descriptions, and the selected-photo count.

Map uploads send per-photo metadata from the selected image, including stable `client_capture_id`, capture time, coordinates, accuracy, altitude, bearing, zoning, district, barangay, stamp text, category, and remarks. Local images are preserved for both destinations.

Duplicate retries are handled server-side by owner plus `client_capture_id`, then SHA-256 hash, then original filename fallback.

If GeoCamera shows an upload failure, install GeoCamera `1.0.167` or newer before retrying. That version displays the Geotag Map HTTP status and server error detail, which distinguishes expired login, missing Map upload privilege, old server package, invalid image type, and network/server URL problems.

## Clustering And Explosion

The web map uses local MapLibre GL JS assets with a GeoJSON source and native clustering. Defaults mirror the inspected GeoCamera behavior:

- Cluster radius: `56` px
- Cluster max zoom / close-range explosion zoom: `17`
- Minimum cluster points: `2`
- Cluster taps zoom toward the MapLibre expansion zoom first.
- Close-range unresolved groups explode instead of creating unbounded marker piles.

Exploded groups use compact alternating multi-rings in screen space. Leader lines connect thumbnails to the true coordinate anchor. Visible thumbnails and radius are capped by configuration.

Collapse behavior: Escape, empty map click, meaningful pan, zoom, filter change, or source reload.

## Backup And Restore

Backup ZIPs include `map-media/originals/` and `map-media/thumbnails/`. Temporary map-media files are excluded. Restore brings map media back with the database after ZIP path validation.

## Configuration

Configuration is read from the `MAP_MEDIA_*` environment variables declared in `src/backend/config/01-storage-and-database.config.js`.
