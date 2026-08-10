# Mandatory GeoCam Monitoring Confirmation

## Accepted confirmation sources

A new monitoring visit requires at least one server-verified photo captured using the GeoCam Android app. The user may obtain the confirmation photo from any one of these sources:

1. **Geotag Map** — select a valid GeoCam photo already received by ABEARC Map.
2. **Upload from Device** — manually upload the original GeoCam JPG or JPEG file.
3. **My Drive** — select a valid GeoCam photo previously received through the GeoCam mobile upload to My Drive.

The user chooses the source inside **Record Monitoring Visit**. Optional supporting documents remain separate and cannot confirm a visit.

## Server-side confirmation rules

Every selected confirmation photo must pass server validation before the visit is finalized:

- GeoCam Android source must be verifiable.
- The photo must contain valid geotag latitude and longitude.
- The GeoCam image-stamp metadata must contain readable Latitude and Longitude values.
- The stamped coordinates must match the photo's geotag coordinates within the configured tolerance.
- The original capture date must match the monitoring visit date.
- The original image file must still exist.
- The photo must not already confirm another monitoring visit.
- The photo must not already be linked to a different monitoring inventory item.

Additional source checks apply:

- **Geotag Map:** active map status, original coordinate source, GeoCam capture identifier, ownership/access, and valid map location status are required.
- **Manual upload:** the original JPG/JPEG must contain embedded EXIF GPS, capture time, and recoverable GeoCam stamp metadata. Screenshots, edited copies, and files without embedded proof are rejected.
- **My Drive:** the file must be an active GeoCam mobile-upload photo owned by the current user, have the ABEDGEOCAM/geotagged source markers and stored GeoCam stamp details, and any embedded EXIF GPS/date must agree with the stored mobile-upload metadata.

## Automatic Geotag Map behavior

- A photo selected from **Geotag Map** remains in place and is linked to the monitoring inventory item and visit.
- A valid photo selected from **My Drive** is copied into Geotag Map, preserving the My Drive original.
- A valid photo uploaded manually is copied into Geotag Map after validation.
- The Geotag Map copy is categorized as **Monitoring Confirmation** and linked to the finalized monitoring visit.
- A confirmation photo linked to a monitoring visit cannot be hidden, permanently deleted, bulk-deleted, manually relocated, or reused for another visit.

## User workflow

1. Conduct the field visit.
2. Capture the monitored item using the GeoCam Android app with the normal geotag image stamp.
3. Open the inventory item and choose **Record Visit**.
4. Set the monitoring date to the photo capture date.
5. Choose **Geotag Map**, **Upload from Device**, or **Select from My Drive**.
6. Select or upload at least one eligible photo.
7. Enter findings, observed condition, recommendations, and optional supporting documents.
8. Save the monitoring visit.

The visit is finalized only after all confirmation photos pass the server-side checks and are successfully linked to Geotag Map in the same database transaction.

## Existing records

The mandatory photo requirement applies only to newly recorded monitoring visits. The 92 imported historical visits and any legacy visits already stored in the database remain unchanged and are identified as historical or legacy entries in monitoring history.
