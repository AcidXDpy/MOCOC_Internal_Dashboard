# Local Demand Implementation Plan

**Goal:** Ship the user's supplied Local Demand specification as a visible expansion, not a redesign.
**Architecture:** Reuse the React/Vite Observatory hash navigation, Recharts, Leaflet, shared evidence/section controls and public directory. Isolate parsing and calculations in `src/economy/demand`. Save imports in versioned browser localStorage; no unconfigured database or live scraper.
**Spec:** User attachment `7be53c8a-e6cc-49c9-8cc7-9d983a7411f6/Pasted text.txt`.

## Constraints

Preserve uncommitted Local Economic Pulse work. Demo is obvious and never merged into imported results. Search geography is explicit. A shared comparison export is the unit of comparability: independent 0-100 exports cannot support cross-category gaps. Boundary-matched public directory listings are incomplete representation, not a census.

## Implementation

- [x] Test then implement `engine.ts`, `csv.ts`, `types.ts`, `supply.ts`, `demo.ts`: common-period means, population z-scores, six-month trend, defensible missingness, stable sorting, CSV fixtures and normalization.
- [x] Implement `store.ts`, `ImportDialog.tsx`: quote-safe parser, source preview, per-column category and term mapping, geography, explicit common-scale confirmation, persistence failure reporting, deletion/replacement.
- [x] Implement `LocalDemand.tsx`, `DemandCharts.tsx`, `CategoryDialog.tsx`, `DemandMap.tsx`, `demand.css`: populated demo dashboard, KPIs, line chart, matrix, table, rising interest, rankings, deterministic insights, methodology, CSV export and optional map.
- [x] Implement `DemandPulse.tsx` and integrate into `EconomyViews.tsx`; add `demand` to primary navigation and route types.
- [x] Add a labeled synthetic sample CSV, developer/methodology documentation and browser tests; verify homepage, filters, chart clicks, modal, import/reload/replace/delete, export, mobile/tablet, legacy routes, lint and production build.

Verification: 35 TypeScript unit tests, 27 research tests, 29 warehouse tests and 15 browser tests passed. After the final print-spacing fix, all five Demand browser tests passed again. Production build and lint passed; production dependency audit reported zero vulnerabilities. Inspected homepage, desktop/tablet/mobile demand, import dialog, lower-page chart/table and print screenshots. Reviewed and corrected incomplete-month growth and multi-tab storage risks. No deployment or push was performed.

## Scientific Rules

Supply: public directory coordinates inside the Census TIGER 2024 township polygon, acquired through Census Reporter. Coordinates are not independently verified. Unknown/outside coordinates are excluded. Classify conservatively from raw industry/name without modifying records; unmapped records are reported. At most one category per listing. Initial snapshot: 116 public records, 40 boundary matches, eight taxonomy matches. Six categories have no represented listings.

Demand: monthly means of reported daily/weekly/monthly samples, with weekly samples assigned to their start month. `<1` and blanks are missing/censored, never zero-filled. Common valid months within the selected window determine cross-category averages. Gap requires at least two mapped categories, two common months, positive variance and a confirmed common comparison scale. Gap = population z(mean interest) - population z(category supply share). Supply share uses all mapped local records in the ten-category taxonomy; z-scoring uses the eligible comparison cohort. No causal or unmet-demand proof.

Change: percent change of latest three complete calendar-month aggregates versus the preceding three, anchored to the last imported/demo observation month. Require all six months and a positive prior mean. This is a within-query trend, not a change in search counts.
