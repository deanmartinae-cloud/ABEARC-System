# ABEARC v1.53 — Merged Production Release

**Release date:** 2026-10-13  
**ABEARC release:** v1.53  
**Internal Node package version:** 1.0.96

This release entry consolidates the changes present in the current workspace since v1.52, including Telegram work previously documented as v1.54. The historical implementation reports and archive manifests retain their original names.

## Merge parents

1. **ABEARC 1.52 AWS/ZENTRA NAS Deployment Build**  
   File: `ABEARC_1.52_AWS_ZENTRA_NAS_Deployment.zip`  
   SHA-256: `3e6a438132926a32a73c2b306185a6b4dcb764af08ea85901c9ca8167085092c`

2. **Final full ABEARC Ram-Pump build**  
   File: `ABEARC_RamPump_PeaceCorps_Standpipe_S2_FINAL_FULL_BUILD.zip`  
   SHA-256: `f2048840619f8b1fdabb6640ad86253f01b7d6b6bbbd2999e80af550710c7e18`

Reference v1.52 release baseline:  
`ABEARC_SYSTEM_v1.52.zip`  
SHA-256: `5f8064086c914697b102a48c058f1a57f01574f35d5838a60937ac7f5c04698b`

## Merge method

The final Ram-Pump build was used as the engineering-feature base. AWS/ZENTRA changes were applied as a branch delta against its own 1.52 parent so weather/NAS changes were added without replacing newer Ram-Pump work. The two true overlapping source files (`src/frontend/pages/map.page.html` and `src/frontend/scripts/12-abearc-map.js`) merged cleanly because the weather and final Ram-Pump changes occupy separate functional sections. Generated `public/` files were then rebuilt from the merged `src/frontend/` tree.

No unresolved merge markers remain.

## v1.53 changes since v1.52

### Ram-Pump System Layout
- Adds `Generate Ram Pump System Layout` to the Distance Measure context menu.
- Treats Point A as Water Source / Intake and Point B as Service Area / Reservoir.
- Searches surrounding terrain for practical pump sites instead of forcing the pump onto the original A→B line.
- Retains up to three spatially separated candidate sites.
- Uses strict descending terrain routing for the drive side and a separate pressure-capable terrain route for the delivery side.
- Provides editable source, pump, destination, drive/delivery vertices and movable engineering annotations.
- Integrates with My Map Layouts, Undo, Print Mode, progress/cancellation and responsive map drawers.

### Ram-Pump hydraulics, pipe sizing and feasibility
- Calculates drive head, delivery head, H/h ratio, route lengths/slopes, high-point lift and Hazen-Williams losses.
- Calculates net drive head, estimated delivery flow, waste flow, source/delivery/waste daily volumes and planning efficiency.
- Adds automatic/manual drive and delivery pipe sizing with standard-diameter, velocity and head-loss screening.
- Supports desired delivery flow and solves required source flow when a delivery target is entered.
- Adds governing delivery-lift checking with a configurable limit up to 180 m.
- Provides `Feasible`, `Engineering Review Required`, and `No Practical Ram Pump Layout Found` diagnostics with engineering reasons.
- Includes an offline Gilman model catalog and conservative model suggestion/cross-check without runtime vendor queries.

### Drive-pipe construction, profile and drawing
- Adds On Ground / Terrain-Following and Elevated on Support Frames installation modes.
- Adds Straight Preferred, Terrain-Following Allowed and Straight Only alignment choices.
- Calculates descending design grade, required variable support-frame heights, maximum support height and terrain intrusion.
- Adds downloadable, expandable and movable/dockable combined elevation profile.
- Adds a full calculation sheet with substituted equations, pipe-size screening and engineering limitations.
- Reworks the hydraulic-ram schematic to a physically coherent source → drive pipe → pump/waste branch → delivery check/air chamber → delivery line → reservoir arrangement.
- Adds SVG export and AutoCAD-compatible R12 DXF export.
- Hides the originating distance measurement after successful Ram-Pump generation and restores it when the layout is cleared.

### Peace Corps / Warwick S-2 reference and long-drive treatment
- Adds selectable Peace Corps / Warwick S-2 screening.
- Adds rigid drive-pipe guideline checks using `Lmin = 150D` and `Lmax = 1000D`.
- Adds automatic open standpipe or optional drive-tank treatment when the source-to-pump run exceeds the reference maximum.
- Separates upstream supply pipe from the final rigid drive pipe and applies friction/straightness/support checks to the effective rigid segment.
- Adds standpipe/drive-tank chainage, elevations, riser height, supply length and diameters.
- Adds an engineering-review warning for flexible HDPE/PE when the rigid-pipe reference rule is selected.
- Extends map/profile/CSV/GeoJSON/drawing output for supply pipe, rigid drive and dissipation device.

### Automated Weather Stations / ZENTRA Cloud
- Adds a native Automated Weather Stations map layer with clustered health-aware markers and cached current-condition popups.
- Adds a backend-only ZENTRA Cloud v5 provider using `X-API-Key`; credentials never reach browser assets or exports.
- Adds multi-station/device/sensor discovery and normalized station/series metadata.
- Adds local SQLite tables for stations, series, readings, sync state, backfill jobs, sync runs, alert rules/events and weather system settings.
- Adds reading-ID incremental synchronization, duplicate prevention, durable pagination/cursor state and restart-safe retry/backoff for historical backfill.
- Adds station health logic based on configured upload/logging intervals.
- Adds station settings, weather privileges, alerts and existing-notification-system integration.
- Persists weather-layer visibility through My Map Layouts.
- Persists the server credential in NAS/local `data/weather.env` across container recreation.

### Weather dashboard, analytics and exports
- Adds Overview, Charts, Rainfall, Agriculture, Data Table, Reports and Station views.
- Adds measurement-specific aggregation for rainfall/counts, temperature/RH, wind/gust/direction and solar irradiance/energy.
- Preserves missing/null measurements separately from genuine zero values and surfaces source error codes.
- Adds configurable GDD, VPD and guarded FAO-56 Penman-Monteith ET0, with measured reference ET preferred where available.
- Adds crop coefficient inputs and clearly labeled indicative crop-water deficit.
- Adds interactive tooltips, series visibility, dense-series Fit/Detail pan mode, rainfall bars and PNG chart export.
- Adds CSV, XLSX and A4 PDF weather exports/reports.

### Telegram weather distribution
- Adds backend-only bot configuration, connection tests, approved chat registration with single-use expiring codes, and target management.
- Routes triggered/cleared weather alerts to registered chats and schedules daily, weekly and monthly station-local reports.
- Adds durable delivery queues, duplicate prevention, retry/backoff, rate-limit handling, restart recovery and delivery audit history.
- Adds Telegram integration privileges and administrator credential management.

### Weather setup, forecast and farm advisories
- Adds administrator ZENTRA token validation, encrypted persistent credential storage and automatic station discovery through the interface.
- Adds modeled forecast outlooks, explicitly separated from station observations, with stale-forecast guards.
- Adds crop-focused advisory cards for observed rainfall, wetness, dry days, temperature/humidity and forecast rain, wind and temperature.
- Adds the Farm Weather Advisory A4 PDF with City Agriculturist Office/Davao City branding, observed metrics, charts, advisory cards and optional forecast outlook.
- Refines sensor/unit handling, weather report charts, station icons/popups and sidebar presentation, and weather alert rate handling.

### Map and interface refinements
- Refines Ram-Pump/weather controls and responsive map panels.
- Updates orthomosaic integration, map printing and saved-layout handling, plus frontend build/cache recovery and project/dashboard integration.

## Version and changelog
- User-facing system version updated from **v1.52** to **v1.53**.
- Changelog now includes a complete v1.53 section while retaining historical v1.52 and earlier entries.
- Sidebar footer updated to `ABEARC System v1.53`.
- Internal package version advanced from `1.0.95` to `1.0.96`.
- Runtime wiring version consistency check updated for v1.53.

## Historical verification performed on the merged tree

The following results describe the earlier merged build; they are not a fresh full-suite validation of the October 13 release metadata update.

Passed:
- frontend build;
- structure check: **80 backend modules / 707 protected DOM IDs**;
- frontend cache safety;
- Map Analysis;
- runtime wiring: **306 routes**;
- document-date checks;
- Orthomosaics;
- My Map Layouts;
- Print Mode;
- Ram-Pump static integration;
- Ram-Pump end-to-end workflow;
- SALT/contours;
- Undo;
- Multi-Measure;
- Gravity Flow path/native/ascent;
- weather structural/security checks;
- ZENTRA provider contract fixtures;
- SQLite-backed weather workflow fixtures.

Known pre-existing check:
- `scripts/check-map-view.js` still reports the same `1 !== 0` assertion documented against the untouched v1.52 baseline and both parent feature branches. It is not introduced by the v1.53 merge.

## Security
- No JWT-like credential string was found in the merged source/release tree.
- `ZENTRA_API_KEY` remains configuration-only and is not embedded with a credential value.
- No merge-conflict markers remain.

## Deployment
Use the existing NAS deployment workflow. Create or retain `data/weather.env` on the server and set:

`ZENTRA_API_KEY=<current ZENTRA API key>`

Do not place the credential in application source or browser files.
