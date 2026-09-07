# Executable economic research pipeline

This directory owns Python analysis and generated public model artifacts. It does
not edit the frontend or infer economic outcomes from Chamber renewal placeholders.

## Run

```powershell
python -m pip install -r research/requirements.txt
python -m research.build
python -m unittest discover -s research/tests -v
```

The build uses checked-in source caches when present. `--refresh` deliberately
downloads new snapshots and changes their provenance; `--offline` requires cached
responses and never contacts the network. The build fails if the main labor series
or industry data cannot be used, and labels tract modules blocked if their source
inputs fail eligibility. No fake observations are substituted.

Outputs:

- `public/economy/model-results.json`: typed, chart-ready results and readiness gates.
- `public/economy/tracts.geojson`: 110 simplified source tract boundaries; full
  `14000US...` identifiers in both `properties.GEOID` and `properties.geoid`.
- `research/data/observations.csv`: 1,206 direct observations/status records for
  the warehouse, with source URLs, source hashes, retrieval times and ACS MOEs.
- `research/data/*.json`: observed source caches with full raw BLS/ACS responses
  and a filtered NJ sector subset from each CBP bulk county file.

The root interface is documented in `INTERFACE.md`. Extra fields are compatible
additions. Every analytical module declares status, evidence type, requirements,
limitations and source IDs. Readiness fields have a null result.

## Observed sources

1. [BLS LAUS API](https://www.bls.gov/developers/api_signature_v2.htm):
   `LAUCN340270000000003` county unemployment rate and
   `LAUCN340270000000005` resident employment, monthly and not seasonally adjusted.
   Three requests per series cover 2000-2009, 2010-2019 and 2020-2026. July 2026 is
   the last observation in this build. BLS marks October 2025 unavailable because
   of the lapse in appropriations; its original footnote and missing status remain.
   [FRED NJMORR5URN](https://fred.stlouisfed.org/series/NJMORR5URN) identifies the
   same unemployment-rate target, but its graph CSV endpoint returned HTTP 404
   during acquisition, so this pipeline uses BLS directly.
2. [Census CBP bulk county downloads](https://www2.census.gov/programs-surveys/cbp/datasets/2023/):
   fixed 2018-2023 comparison window, employer establishments, March-reference
   employment, and nominal annual payroll in thousands of dollars. All 21 actual
   NJ county FIPS are included; unallocated county `999` is excluded. Group codes
   `31----`, `44----`, `48----` map to `31-33`, `44-45`, `48-49`. Only sectors
   published for every county enter the RCA reference matrix. This is a fixed
   comparison window, not a declaration of the latest CBP release.
3. [ACS 2024 tract data through Census Reporter](https://api.censusreporter.org/1.0/data/show/acs2024_5yr?table_ids=B19013,B23025,B17001&geo_ids=140%7C05000US34027):
   original Census tables B19013, B23025 and B17001, including 90% MOEs. These are
   pooled 2020-2024 estimates, not 2024 point observations. A project-specific User
   Agent is required by the redistribution service. TIGER2024 geometries come from
   the matching Census Reporter geography endpoint. Their source data are Census
   geographic boundaries; representative interior points support distance weights.
4. `public/economy/source-snapshot.json`: main application's sanitized, public
   Chamber directory. Its coverage date is July 16, 2026; original retrieval time
   is unknown and remains null. Its 116 listings span several communities and
   counties, so no township census or business-population inference is justified.

Source response SHA256 hashes are preserved. CBP cache hashes refer to downloaded
ZIP bytes, not filtered JSON bytes. Release timestamps are not guessed from HTTP
headers, observation dates, or retrieval times. Cached builds retain source retrieval
times. These are latest-vintage histories, not real-time vintage archives. The build
timestamp does not claim that cached sources have been refreshed.

## Methods and interpretation

### Household socioeconomic PCA

Use log median income, negative poverty percentage and employed/population age 16+
on 105 complete, non-top-coded tracts. Scale variables with StandardScaler, then
fit PCA. Orient PC1 toward income; display mean 50, standard deviation 10 without
clipping to 0-100. Eight geographic KMeans blocks provide 250 bootstrap loading
stability checks. The observed component explains about 54% of standardized
variance but loads negatively on employment/population. Its orientation gate
therefore fails: the component is a socioeconomic contrast, not an ordered health
scale. `overallEconomicHealthScore` remains null. No independent commercial outcome
validation or score confidence interval is claimed. Spatial resampling, unknown
survey covariances and age composition remain substantive limitations.

### County forecast and current-month projection

Compare a last-observed-same-calendar-month baseline with a statsmodels Gaussian
local-level state-space model plus deterministic 12-month seasonal states. Use a
rolling 120-month fitting window and 30 rolling origins with 1-3 month horizons.
Select by mean absolute error on the early folds, purge their target months that
overlap the final ten held-out origins, and never select on that holdout. Record
every origin, prediction, interval and actual value. Missing official values are
not scored or interpolated; the Kalman observation update is skipped naturally.

The selected state-space model's selection MAE is approximately 0.33 percentage
points versus 0.38 for the baseline. On the held-out targets its MAE is about 0.57
versus 0.49 for the baseline. Both attain 100% empirical coverage on nominal 90%
intervals in this small sample, with broad widths. These results establish a
reproducible benchmark, not predictive superiority. They are latest-vintage
pseudo-out-of-sample tests; release revisions are not reconstructed. Errors at
overlapping horizons are dependent. Months 4-6 have no matching-horizon validation.

The September 2026 current-month estimate projects the county unemployment target
from July's published observation. No high-frequency current-month signal exists.
It is an experimental univariate projection with a prediction interval, not a
mixed-frequency nowcast, growth estimate or GDP claim. Parameter uncertainty and
future structural breaks are not included in the model intervals.

### Spatial inference

Analyze tract median household income itself, so the map's variable matches Moran's
statistic. Build union-symmetrized six-nearest-neighbor haversine weights from real
tract interior points, then row-standardize. Use 999 permutations for global Moran's
I and conditional local tests holding the focal value fixed. Two-sided tails are
centered on the randomization expectation. Local tests use Benjamini-Hochberg
correction. Repeat global tests at k=4 and k=8. Perturb estimates using source
MOE/1.64485 in 300 draws to show sensitivity, not a confidence interval, because
cross-tract survey covariances are unavailable. This is residential association;
it identifies neither business hotspots nor causal geographic spillovers.

### Industry, directory networks and resilience

RCA is county sector share divided by pooled NJ sector share. Shared specialization
defines proximity as the minimum conditional co-occurrence probability. An edge
threshold of 0.55 supports descriptive NetworkX betweenness, degree, weighted degree,
Louvain groups and reproducible spring layouts. ECI is withheld: 21 counties and
broad sectors are a fragile complexity ranking basis. Complete-sector coverage is
16 sectors, 16,343 of Morris County's 16,518 establishments (98.94%); the omitted
175 establishments are explicitly reported, not set to zero.

The separate directory graph uses a shared category or distance <=500m. Layout and
centrality describe that relation graph only; they do not measure firm influence,
transactions or supply dependencies. Coordinates remain public directory values.

Resilience solves `s=(I-cW)^(-1)d` with observed sector shares as exposure weights,
an illustrative 20% accommodation/food sector stress, and assumed coupling 0, 0.15
or 0.30. The spectral radius stays below one. Zero coupling is the direct-only
baseline. All outputs are hypothetical exposure units, not lost establishments,
employment, dollars or GDP. Coupling is not inferred from the association graph.

### Anomalies, survival, causal readiness and policy

Anomaly scores center seasonal differences on a past-only rolling median and MAD.
Empirical-tail p-values use prior residuals and BH correction over the displayed
36-observation family. A magnitude-three MAD screen is separate from an adjusted
alert. Serial dependence, regime shifts and finite-tail resolution limit calibration.

`kaplan_meier` supports right censoring and delayed entry with statsmodels.
`difference_in_differences` supports balanced panels, one common adoption time,
unit/time fixed effects and unit-clustered uncertainty. It rejects staggered timing,
unbalanced data and fewer than ten treated or ten control clusters. Known-effect,
censoring and risk-set fixtures are synthetic and confined to tests. No business
survival curve or causal effect is presented for observed data lacking dates,
outcomes, comparisons, and identification. Parallel trends and independent
censoring remain assumptions, not tests that can be made true by the estimator.

Main's live browser policy lab handles user proposals and optimization. Python's
policy field is a readiness envelope with no invented benefit coefficients.

## Scope and next data

Priority acquisitions are business opening/verified closure/censoring dates;
permit and vacancy panels; contemporaneous county or municipal activity signals;
historical source release vintages; and a documented intervention with credible
untreated controls. These enable commercial outcome validation, calibrated nowcast
evaluation, survival inference and a defensible policy design. More elaborate
estimators cannot replace those missing observations and assumptions.
