# Local Economic Pulse

## Repository Audit and Scope

The existing application is React 18 + TypeScript on Vite, hosted on Vercel.
`src/App.tsx` sends `/` and `/economy` to the Economic Observatory; the legacy
Chamber workspace remains on `/chamber`, `/business`, `/project` and `/about`.
The Observatory uses hash navigation, lazy views, an error boundary and a shared
sidebar. Its green/charcoal identity, logo, typography, spacing and mobile menu
are retained. No framework, chart library, authentication or hosting migration
is required.

The repository contains three distinct data surfaces:

- The legacy directory/intelligence workspace combines public listings with
  explicitly synthetic administrative placeholders. None enter this module.
- `research/acquire.py` downloads public evidence into provenance-bearing caches;
  `research/build.py` publishes model results. The existing BLS series is county
  only and is therefore not reused as a three-geography comparison.
- `warehouse/` maintains SQLite source releases, observation revisions and model
  runs. The new descriptive bundle is generated from source caches, not presented
  as a database-backed live query. No warehouse schema or migration is needed.

The existing Census API adapter is limited to configured geographies/vintages and
requires a server-side key. The new reproducible ingestion uses public archives
and the established Census Reporter redistribution service, without browser keys.

Reused components: `Section`, `Evidence`, `Method`, `Caveat`, `Source`,
`DownloadButton`, `downloadJson`, Recharts and Lucide. The existing forecasting,
maps, network and scenario components retain their meanings and behavior.
The old `derivePercentage` helper was not reused: it clips a negative MOE
radicand to zero. Pulse uses the ACS general-ratio fallback in that situation.

## Files and Data Flow

- `research/pulse.py`: metric definitions, ACS ratios, CBP totals, disclosure
  handling and the reproducible artifact builder.
- `research/pulse_archive.py`: direct Census 2014/2019 sequence extraction,
  using the official table dictionary and geography crosswalk. Census Reporter
  no longer serves these releases. Geographic joins use GEOID and LOGRECNO.
- `research/data/pulse-*.json`: source response extracts, retrieval times,
  URLs, response hashes and extraction dependencies. Existing county CBP caches
  are reused; state totals are fetched directly, not summed from counties.
- `public/economy/local-pulse.json`: version `pulse/1`, 23 datasets with
  geography-period observations, units, universes, transformations and sources.
- `src/economy/pulse/types.ts`: explicit contract and runtime validation.
- `src/economy/pulse/statistics.ts`: pure null-aware selectors and indexing.
- `src/economy/pulse/PulseComponents.tsx`: reusable observation display,
  provenance links, metric classification, geography filter and comparison chart
  with accessible observation tables and detailed tooltips.
- `src/economy/pulse/LocalEconomicPulse.tsx`, `pulse.css`: the research view and
  locally scoped styling. Its fetch/retry lifecycle does not depend on a
  successful model-results request.
- `EconomicPlatform.tsx` and `types.ts`: register `#pulse`; other views unchanged.
- `scripts/build-economy.ts`: include Pulse in the existing verification pipeline.
- `research/tests/test_pulse.py`, `src/economy/pulse/statistics.test.ts`,
  `e2e/pulse.spec.ts`: source, transformation, rendering and interaction checks.

No presentation component downloads upstream economic data or estimates missing
values. Ingestion produces artifacts; the browser applies only explicitly labeled
display normalization. The export includes the selected geographies and display
settings, all underlying observations for those geographies, and provenance.

## Measures and Coverage

| Measure                     | Source                | Universe / interpretation                                                          |
| --------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Population                  | ACS B01003            | Residents; survey estimate, not an exact census count                              |
| Median household income     | ACS B19013            | Households, release-end-year dollars                                               |
| Per-capita income           | ACS B19301            | Published income-per-resident measure                                              |
| Employed residents          | ACS B23025            | Civilian employed residents age 16+                                                |
| Employment / population 16+ | B23025004 / B23025001 | Civilian employed divided by all residents 16+, including Armed Forces             |
| Unemployment rate           | B23025005 / B23025003 | Unemployed / civilian labor force, not LAUS monthly unemployment                   |
| Median annual earnings      | ACS B20002            | People age 16+ with earnings, all work schedules; not an hourly wage               |
| 13 industry shares          | ACS C24030            | Male + female broad industry counts divided by all civilian employed residents 16+ |
| Employer establishments     | CBP `est`             | Covered employer locations, not firms, memberships or all businesses               |
| Workplace employment        | CBP `emp`             | Covered jobs in the March 12 reference week, not employed residents                |
| Annual payroll              | CBP `ap` x 1,000      | Nominal calendar-year dollars; not a wage rate                                     |

ACS compares 2010-2014, 2015-2019 and 2020-2024, all five-year estimates at all
three geographic levels. Windows do not overlap. These are three period
observations, not annual measurements, monthly pulses or interpolated values.
Industry definitions and population controls can change across releases; the
broad categories support descriptive comparisons, not a causal growth estimate.
Income/earnings values use each release's final-year dollars. No real purchasing-
power growth is asserted; nominal-dollar indexes remain explicitly labeled.

CBP uses the existing fixed 2018-2023 research window. The site says latest
**loaded** observation, not latest available release. It does not replace these
vintages silently when a source updates. Refreshing retrieves the configured
vintages; changing the window requires a reviewed code/data change.

Township CBP data is structurally unavailable. ZIPs 07828 and 07836 do not define
the township and are never substituted. No opening, closure, business failure or
local wage rate is inferred from directory listings or establishment differences.

## Uncertainty and Missingness

Every observation retains its period, status, source IDs, transformation inputs
and quality flags. Missing/suppressed observations are null, not zero. Charts do
not connect across null points. Unavailable series have no line and are explicitly
identified; a wholly unavailable selection has an empty-state message.

Published ACS margins of error are 90%. Null/special negative MOEs stay
unavailable. Sum MOEs are approximated by root-sum-of-squares. Subset-ratio MOEs
use `sqrt(M_n^2 - p^2 M_d^2) / d`, multiplied by 100; a negative radicand falls
back to `sqrt(M_n^2 + p^2 M_d^2) / d`, not zero. Covariance is not available.
Percentage margins are displayed in percentage points.

An index is `100 * value / first displayed period`. All geographies use the same
base period. Missing/nonpositive bases yield null for the series; the system does
not choose a different base for each geography. Zero current observations remain
valid. Ratio indicators already have a common denominator and cannot be indexed
in the UI. Index uncertainty is not estimated or presented as a confidence band.

Mount Olive is nested within Morris County within New Jersey. Their samples and
economies are not independent. No significance ranking, health score, forecast,
causal impact estimate or policy recommendation is generated by this module.

## Rebuild and Verify

`npm run pulse:build` rebuilds offline from the checked-in evidence caches.
`npm run pulse:refresh` retrieves the same configured source vintages again.
`npm run economy:pipeline -- --offline` includes Pulse in the full pipeline.
The current CI's research tests, TypeScript tests, build and browser suite include
the new tests automatically. Public artifacts need a normal reviewed deployment
to appear on the hosted site; refreshing local files alone does not publish them.

Focused checks: `python -m unittest research.tests.test_pulse`, `npm test`,
`npx playwright test e2e/pulse.spec.ts`, `npm run build`.

References: [ACS comparison guidance](https://www.census.gov/programs-surveys/acs/guidance/comparing-acs-data.html),
[2024 comparison limitations](https://www.census.gov/programs-surveys/acs/guidance/comparing-acs-data/2024.html),
[CBP coverage](https://www.census.gov/programs-surveys/cbp/technical-documentation/methodology.html).
