# Local Demand

## Visible Product

Home (`/#overview`) now starts with Local Demand Pulse. The primary navigation opens `/#demand`: a populated ten-category demonstration, comparison controls, demand-gap matrix, historical chart, sortable opportunity table, category dialogs, rising-interest cards, deterministic insights and methodology. The Map tab reuses Leaflet to show represented businesses, never search locations. Download exports CSV; the printer icon uses the app's browser print / Save PDF workflow.

## Repository Audit and Reuse

The existing application uses React 18, TypeScript, Vite, hash-based Observatory views, Recharts, Lucide and Leaflet. The green/charcoal shell, source-conscious language, Section/Method/Caveat components, chart tooltip theme and public member directory are reused. No new router, charting stack, database, AI service or membership workflow was introduced. The Chamber workspace and Local Economic Pulse remain separate and intact.

New files are scoped to `src/economy/demand/`, one acquisition script, tests and sample data. Integration changes are in `EconomicPlatform.tsx`, `EconomyViews.tsx` and `types.ts`. PapaParse handles structured CSV; Turf handles point-in-polygon geometry. These are domain parsers, not replacement UI libraries.

## Supply Provenance

Source of truth: `src/data/members.ts`, 116 public-directory records acquired July 16, 2026. Only public names, industry, coordinates, addresses and source URLs are used. Synthetic contact, membership, renewal and status fields are ignored.

`research/demand_geography.py` acquires the Census TIGER 2024 Mount Olive Township boundary (06000US3402749080) through [Census Reporter](https://api.censusreporter.org/1.0/geo/show/tiger2024?geo_ids=06000US3402749080), using the existing acquisition cache with retrieval time and content hash. It writes `src/economy/demand/township-boundary.json`. Regenerate with `python -m research.demand_geography`.

The boundary contains coordinates for 40 directory records. Eight map conservatively to the ten requested categories: restaurants 3, home improvement 2, real estate 2, accounting 1. Six categories have no represented listings. The other 32 inside-boundary records are outside this taxonomy or insufficiently classified. Unknown/outside coordinates are excluded. Coordinates and category mappings are not independently verified. This is not a census, an establishment count or a complete measure of market competition; zero means no represented listings, not no local businesses.

## Search Data and Imports

Default search data is deterministic synthetic data for October 2024 through September 2026, clearly labeled Demo Data and Morris County, NJ (demo). No observed Google data is bundled. The homepage preview is explicitly always the demonstration; the full page supports imports.

1. Export **Interest over time** from Google Trends using one geography, date range and search configuration. For cross-category gaps use terms from the same comparison, not separately downloaded independently scaled queries.
2. Open Local Demand > Import Trends Data > Upload Google Trends CSV.
3. Review detected rows/dates and assign each term to a distinct industry; verify the actual search geography.
4. Confirm shared comparison settings only if true, then Import Data.
5. Select saved geography/comparison; use replace or delete icons to manage imports.

Supports one to five term columns; Month, Week, Day or Date headers; ISO dates; common Google metadata; BOM, quoted fields, commas/semicolons/tabs; optional isPartial. Mixed-region columns, duplicate dates, invalid dates, values outside 0-100, files above 2 MB and more than 10,000 observations are rejected. `<1`, blanks, NA and hyphens remain missing; explicit zero remains zero. The downloadable synthetic sample retains its Demo Data label after import.

Imports are user-provided, not authenticated Google exports. Schema-validated batches store in browser localStorage under `mococ.local-demand.v1`, at most 12 comparisons. They do not sync to a server or another device. Storage errors are surfaced without silently substituting demo data. Other tabs synchronize through storage events and mutations re-read current saved records. Export CSV is the portable analysis, not an original-observation backup; keep original source CSVs.

## Exact Methodology

For each query, take the arithmetic mean of nonmissing samples in each calendar month (weekly samples are assigned to their start month). Missing monthly values remain gaps. Cross-category means use only common observed months within the selected 3/6/12/24-month window.

For category c, define D(c) = mean monthly search interest over those common months. S(c) = 100 * mapped local listings in c / all eight mapped local listings. Across the selected comparison cohort:

`z(x_c) = (x_c - mean(x)) / sqrt(sum((x_i - mean(x))^2) / N)`

`Demand Gap(c) = z(D(c)) - z(S(c))`

At least two categories, two common months, a confirmed common export scale and nonzero variation in both measures are required. Otherwise the gap and matrix are unavailable, while histories and supply remain. Separate files are never pooled. Changing cohort or window changes the index. Bands (+/-0.75) are descriptive, not significance thresholds.

Three-month change is `100 * (mean(latest 3 months) / mean(prior 3 months) - 1)`, anchored to the source's latest month. All six months must be closed and complete: one monthly sample, all daily samples, or all scheduled weekly start dates. Censored/missing samples, an open current month, unspecified Date frequency or nonpositive prior mean suppress growth. Monthly averages used for histories/gaps can still reflect sparse source coverage, disclosed in methodology. No confidence intervals or causal inference are claimed.

## Live Source Investigation

Checked October 2, 2026. Google's [official API page](https://developers.google.com/search/apis/trends) still describes limited alpha access. No Trends or BigQuery credential configuration was found in the inspected environment. No live connection is claimed. The [public BigQuery source](https://support.google.com/trends/answer/12764470?hl=en-GB) exposes top/rising queries, not arbitrary complete histories for these ten business categories, so it is not substituted for the required comparison. `DemandProvider` is a future adapter boundary; a live provider must preserve geography and scaling semantics. The official API's consistently scaled values would require a distinct value-unit contract rather than assuming website-style 0-100 indexes.

## Verification

Unit tests cover z-scores, zero variance, percentage changes, incomplete observations, missing series, category normalization, boundary matching, sorting and CSV errors. Browser tests cover homepage/navigation, controls, chart selections, details, real listing links, map, import errors/preview/save/reload/replace/delete, geography, demo labeling, independent-scale suppression, multi-tab persistence, CSV download, print source context and desktop/tablet/mobile layouts. Existing Observatory and Chamber browser regressions run alongside them.
