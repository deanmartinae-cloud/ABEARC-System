# ABEARC Ram-Pump — Gilman Offline Model Recommender Refinement

**Baseline:** user-uploaded `ABEARC_SYSTEM_v1.52(1).zip`  
**Date:** 2026-10-07

## Implemented

- Enlarged the colored source / ram-pump / destination marker cores so they nearly fill the existing white halo.
- Reduced annotation leader visual weight and default leader length:
  - smaller default annotation offsets,
  - thinner contrast halo,
  - thinner guideline,
  - smaller leader anchor dot.
- Preserved basemap-aware leader contrast behavior.
- Changed the new/default **Available source flow** to **5 L/min**. Internally this remains SI-compatible as `5/60 L/s`.
- Normalized Ram-Pump user-facing flow notation to **L/min**.
- Embedded an offline Gilman Ram Pump catalog snapshot directly in the Ram-Pump core.
- Added a reviewable catalog snapshot at `docs/GILMAN-RAM-PUMP-CATALOG-2026-10-07.json`.
- Catalog contains **24 listed models**:
  - MF10, MF15, MF20
  - RP75 / RP75-H
  - RP100 / RP100-H
  - RP125 / RP125-H
  - RP150 / RP150-H / RP150-X
  - RP200 / RP200-H / RP200-X
  - RP250 / RP250-H / RP250-X
  - RP300 / RP300-H / RP300-X
  - RP400 / RP400-H / RP400-X
- Stored local model fields include:
  - duty class,
  - published source-flow range,
  - published daily output,
  - maximum pump-lift statement,
  - drive port,
  - delivery port,
  - pumping distance statement,
  - weight,
  - packaging,
  - application summary,
  - price snapshot,
  - stock snapshot,
  - original product URL.
- ABEARC **does not query Gilman at runtime** for recommendation.
- Added automatic manufacturer-model suggestion using:
  - entered available source flow,
  - generated delivery head,
  - optional desired delivery flow/day target.
- Recommendation is conservative:
  - a model is not auto-selected outside its published source-flow range;
  - with the default 5 L/min, ABEARC reports that no exact Gilman model matches and shows the nearest entries;
  - at 15 L/min / 40 m it recommends RP75;
  - at 15 L/min / 80 m it recommends RP75-H.
- The suggestion panel lets the user apply a suggested/nearest model or retain a manual model entry.
- The full detailed calculation includes an **offline manufacturer model cross-check**.

## Important catalog behavior

Prices and stock are a dated 2026-10-07 snapshot and are **not** used to decide hydraulic suitability.

Some extreme-lift product pages use qualitative wording such as `Above 100 meters` rather than a numeric upper limit. ABEARC keeps that wording and flags those cases for manufacturer/final-design verification rather than inventing an upper rating.

## Verification

Passed on the exact final tree:

- `check-structure.js` — **73 backend modules / 668 DOM IDs preserved**
- `check-frontend-cache-safety.js`
- `check-map-analysis.js`
- `check-runtime-wiring.js` — **287 routes**
- `check-map-layouts.js`
- `check-map-print.js`
- `check-map-ram-pump.js`
- `test-map-ram-pump-workflow.js`
- `check-map-salt.js`
- `check-map-undo.js`
- `check-map-multi-measure.js`
- `check-map-gravity-path.js`
- `check-map-gravity-native.js`
- `check-map-gravity-ascent.js`

No baseline application file was deleted.
