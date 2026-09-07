# Implementation Architecture and Contracts

This architecture describes the present economic platform and specific extensions. Repository and integration context checked on 2026-09-07: React 18/Vite/TypeScript frontend, 11 analysis routes at the application root, integrated Markdown/KaTeX research reader, Python source-cache acquisition/model computation, and a SQLite warehouse/provenance subsystem. The current working pipeline must be preserved; optional infrastructure is identified explicitly below.

## Present State

| Layer                   | Present implementation                                                                                                                                                                                          | Remaining integration or extension                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                | `src/economy/` has economic platform/views, labor/spatial/network/resilience/policy views and `ResearchView.tsx`; all five research documents are eagerly imported, with GFM and KaTeX                          | Finish integration/verification of the 11 routes; analytical capabilities below can share routes rather than require one per method                                                                 |
| Acquired inputs         | `research/data/` holds Morris LAUS employment/unemployment-rate caches, ACS 2024 tract data/boundaries and NJ CBP histories; source metadata includes URLs, hashes and retrieval times                          | Broaden actual county/tract time panels, archive future vintages, audit additional source support                                                                                                   |
| Statistical computation | `research/acquire.py`, `research/build.py`, `research/methods.py`; `python -m research.build` exports `public/economy/model-results.json`; refresh entry point reacquires inputs                                | Current models consume source caches. The implemented orchestrator imports their normalized observations/results into SQLite; model estimation is not yet driven by SQLite queries                  |
| Public artifacts        | `model-results.json`, `source-snapshot.json`, `tracts.geojson` with explicit model status/evidence/requirements; `research/INTERFACE.md` defines current schema                                                 | Keep compatible adapters; version the schema when field meanings change                                                                                                                             |
| Warehouse               | `warehouse/schema.sql`, store/ingest/records/documents modules: SQLite source/release/artifact/provenance/audit/geography/industry/business structures, ACS ingestion and evidence-span support                 | The orchestrator imports snapshots, observations and model results, runs warehouse quality checks and exports an audit bundle. DuckDB remains an optional analytical upgrade                        |
| Methods                 | County unemployment forecast/rolling comparison, experimental current-month projection, household-context PCA, income Moran/LISA, RCA/similarity, conditional graph scenarios; browser binary policy allocation | Full LEHI and hierarchical spatial dynamic model remain proposed; survival and common-adoption DiD economic outputs remain gated despite reusable tested engines                                    |
| Scheduling              | `.github/workflows/economic-research.yml` configures Monday 12:00 UTC refresh/recomputation plus push/PR/manual checks and uploaded review artifacts                                                            | `economy:pipeline` now invokes the end-to-end orchestrator. Workflow code is present; successful remote runs/publication are separate evidence, and there is no automatic commit or deployment step |

Current model limitations are part of the architecture contract: nominal forecast intervals and latest-vintage evaluation, mixed-sign household PCA with no overall health score, similarity edges with no measured transmission, and hypothetical policy benefits. A working module is not an assurance that its strongest possible scientific interpretation is established.

## Deployment Shape

```text
CURRENT MODEL PATH
Official source downloads / preserved source caches
  -> Python feature construction and statistical models
  -> Validation + typed model-results.json + tract boundaries
  -> React/Vite economic routes and research reader

CURRENT WAREHOUSE PATH
Directory snapshot + normalized observations + documents
  -> SQLite sources, releases, provenance, observations, audit/evidence

INTEGRATION
npm run economy:pipeline: build -> SQLite imports -> quality -> export
Scheduled GitHub recomputation: artifacts -> review -> publication

OPTIONAL EXTENSIONS
SQLite / raw archive -> Parquet + DuckDB analytical views
Versioned public output -> read-only FastAPI when queries require it
PostgreSQL/PostGIS only for demonstrated shared/live database needs
```

Use Python scheduled batch jobs. The present GitHub workflow runs `economy:pipeline --refresh` on its weekly schedule (or explicit manual refresh), uses `--offline` otherwise, executes research/warehouse/frontend/browser checks, and uploads review artifacts with 30-day retention. It has read-only repository contents permission and no commit/deployment step. An equivalent local scheduler can be useful during development. A local workstation must be awake for its scheduled runs; GitHub runners require caches/artifacts to be persisted explicitly. One owner process updates the warehouse. Promote reviewed immutable output bundles atomically; the React application consumes public output snapshots. Heavy model estimation is offline; the small browser binary optimizer and conditional scenario controls remain intentionally interactive.

SQLite is the current primary local warehouse and provenance store. `scripts/build-economy.ts` exports the public directory snapshot, invokes `research.build`, imports the snapshot/normalized observations/model bundle into SQLite, runs warehouse quality checks and exports `warehouse-export.json`. It supports mutually exclusive `--refresh`/`--offline` flags and stops on a failed child stage. Models still estimate from source caches; record that path explicitly. Add Parquet/DuckDB only if analytical joins/window scans become a measured bottleneck, with derived views referencing the same release IDs rather than creating competing truths. [DuckDB's concurrency documentation](https://duckdb.org/docs/current/connect/concurrency) motivates a single-writer design if added. [SQLite WAL](https://www.sqlite.org/wal.html) supports reader/writer concurrency but still requires controlled writes and appropriate local filesystem behavior.

The repository is under OneDrive. Keep live DuckDB/SQLite databases and lock files in a configurable local runtime directory outside the synchronized tree. Back up closed databases and immutable artifacts; do not sync an actively written database or separate WAL files as a backup strategy. Keep only source/configuration and small approved public outputs in the repository. The present orchestrator implements this separation through `ECONOMY_DATA_DIR`, defaulting outside OneDrive to a local `MountOliveEconomy` runtime directory; GitHub uses runner-temporary storage.

## Required and Optional Components

| Layer                 | Need now                                                                                                                                    | Add only when justified                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime/dependencies  | Existing pinned Python environment, current HTTP client, pandas, NumPy/SciPy, standard-library `sqlite3`                                    | pyarrow/DuckDB for measured analytical needs; Docker for repeatability across deployment machines                                                                                                           |
| Geographic processing | GeoPandas, Shapely, pyproj; libpysal/esda/spreg for actual spatial analysis                                                                 | PostGIS for concurrent geometry queries; OSMnx when a routable network adds information                                                                                                                     |
| Statistics            | statsmodels for initial state-space/count models, scikit-learn for preprocessing/baselines, ArviZ for probabilistic diagnostics when needed | PyMC for hierarchical spatial latent models; Stan or R packages for a specific validated method, not duplicate implementations                                                                              |
| Specialized methods   | NetworkX for measured graph analysis                                                                                                        | `igraph`/Leiden implementation for stable community study; `lifelines`/scikit-survival after survival gate; R `did` for a prespecified causal study; Pyomo or SciPy MILP for explicit allocation objectives |
| Text                  | Parser/OCR only where required, rules and TF-IDF/logistic baseline, human review table                                                      | Embeddings, BERTopic, or constrained LLM extraction only after labeled evaluation and cost review                                                                                                           |
| Frontend              | Existing React/Vite, Recharts, Leaflet, lucide-react; typed adapter for economic outputs                                                    | Plotly for analytical interactions not supported cleanly; deck.gl/vector tiles only after measured map-size bottleneck; no framework rewrite                                                                |
| Serving               | Static versioned aggregate files and manifest                                                                                               | FastAPI for authenticated queries, analyst filters or scenario job submission; read-only worker snapshot                                                                                                    |
| Scheduling            | One Python command per deterministic stage, task lock, source-release calendar                                                              | GitHub Actions when credentials/runtime/storage fit and artifacts persist outside ephemeral runners; workflow scheduler only when failure recovery becomes difficult                                        |
| Database service      | Local SQLite primary warehouse and current immutable source caches                                                                          | DuckDB analytical views first if useful; PostgreSQL/PostGIS for multiple writers, shared reviews/auth, remote access or large live spatial filtering                                                        |

No need for Kafka, Kubernetes, a graph database, feature-store service, vector database, Next.js migration, or an always-on model server at this scale. The costly work is source harmonization and inference, not request throughput.

## Warehouse Model

Use text geography codes to preserve leading zeros, UTC timestamps for availability, source-local dates for events, numeric value plus units, and explicit NAICS/geography vintages. The SQLite schema already implements core source/provenance/geography/business infrastructure. The comprehensive uppercase model below defines conceptual grains and planned extensions; it is not a claim that every listed table is populated or a replacement migration for the current schema.

| Table                                 | Grain / primary key                                 | Essential fields / constraints                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOURCE                                | One product/access contract, `source_id`            | Organization, landing/API URL, terms, license, update policy, parser version, owner, coverage notes                                                                          |
| SOURCE_RELEASE                        | Product x release, `release_id`                     | Period coverage, source release time, retrieved time, first-known time, availability basis, raw URI, SHA-256, schema fingerprint, supersedes ID, request sans secrets        |
| GEOGRAPHY                             | Entity x boundary vintage, `geo_key`                | Source GEOID, type, name, geometry/WKB, CRS, valid-from/to, land area, parent relation through bridge                                                                        |
| GEOGRAPHY_BRIDGE                      | From/to keys x weighting scheme                     | Intersection/support weight, basis (population/jobs/area), vintage, uncertainty, unmatched share; weights sum to one only for full target partition                          |
| INDUSTRY                              | Classification system x vintage x code              | Parent code, label, depth, aggregate flag; code crosswalk is separate many-to-many table with weight/evidence                                                                |
| BUSINESS                              | One legal/organizational entity, `business_id`      | Public source IDs, name, entity type, resolution status; membership ID optional; no synthetic economic fields                                                                |
| ESTABLISHMENT                         | Operating site identity, `establishment_id`         | Entity FK, site label, observation-universe flag, verification status; branches separate                                                                                     |
| BUSINESS_LOCATION_HISTORY             | Establishment x location spell, `location_spell_id` | Address, coordinate/parcel, valid-from/to or bounds, geocode method/confidence, evidence release; no silently overlapping verified spells                                    |
| ESTABLISHMENT_OBSERVATION             | Establishment x observed date x source              | Observed status, employment band, industry evidence, occupancy, source/review ID, reliability; source observation distinct from inferred event                               |
| INDUSTRY_ASSIGNMENT                   | Establishment x classification spell                | NAICS code/vintage, primary/secondary role, probability, reviewer/evidence, effective dates; primary assignment sums to one when probabilistic                               |
| INDICATOR_DEFINITION                  | One source measure/transformation                   | Code, label, units, universe, frequency, support, seasonal adjustment, numerator/denominator, aggregation rule, sign convention                                              |
| ECONOMIC_INDICATORS                   | Geography x industry x measure x period x release   | Value, missingness reason, standard error/MOE/confidence level, unit, vintage and source flags; one value per full key                                                       |
| DEMOGRAPHICS                          | View on indicators plus universe                    | ACS numerator/denominator, period span, covariance availability, measurement error; avoid redundant storage                                                                  |
| EMPLOYMENT                            | View on indicators                                  | Resident/workplace distinction, ownership/job type, employment reference date, source universe                                                                               |
| PROPERTY                              | Parcel x source vintage                             | Parcel lineage, land use/class, assessment components/year, geometry, area; current owner details restricted when unnecessary                                                |
| PROPERTY_TRANSACTION                  | Transfer x parcel bridge                            | Date, consideration, arms-length flag, multi-parcel group, release/evidence                                                                                                  |
| TRANSPORTATION                        | Station/segment/network x observation period        | Counts, count hours, direction/class, adjustment status, travel-time assumptions, network version                                                                            |
| PERMITS                               | Source permit/version, `permit_record_id`           | Municipal/project/parcel FKs, permit/processing dates, use group, authorized area/value, status, revision, source record key                                                 |
| BUSINESS_EVENTS                       | Establishment x event hypothesis/version            | Opening/closure/relocation/expansion/contraction, event-date lower/upper bounds, observed-at, evidence/reviewer, competing-event reason; a disappeared listing is unverified |
| BUSINESS_OPENINGS / BUSINESS_CLOSURES | Reviewed views on BUSINESS_EVENTS                   | Verified/interval-censored events only; retain unresolved candidates in source table                                                                                         |
| COMMERCIAL_ACTIVITY                   | Stable sensor/storefront/survey x period            | Value, denominator/exposure, coverage, sampling frame, vendor version, missingness; no synthetic visits                                                                      |
| DOCUMENT / DOCUMENT_EVENT             | Document/version and extracted event                | Hash, source URL, publication date, page/span, project entity, labels, confidence, review and supersession; unique real-world event dedup key                                |
| EVENTS                                | Public local event/treatment ledger                 | Event type, location/support, start/end, announcement date, evidence, realized versus planned status; Chamber events separate and optional                                   |
| EXTERNAL_SHOCKS                       | Defined observed shock or scenario                  | Shock type, start/end, geographic/sector exposure, intensity/units, observed/simulated flag, source or scenario assumptions                                                  |
| NETWORK_EDGE                          | Graph version x layer x ordered pair                | Weight/units, source period, measured/inferred/scenario type, uncertainty, direction; never mix edge semantics in one centrality calculation                                 |
| FEATURE_SET / FEATURE_VALUE           | Definition version and unit-period-as-of            | Input release IDs, transformation, training-only parameters, support, availability mask, missingness; reproducible query hash                                                |
| MODEL_RUN                             | One fit/inference/validation run                    | Model/data/code/config hashes, cutoff, training/holdout spans, random seed, diagnostics, target/estimand, approved state                                                     |
| MODEL_OUTPUT                          | Run x geography x target period x statistic         | Target, estimate, quantile, unit, forecast horizon, latent/observed/scenario label, valid support, calibration version                                                       |
| VALIDATION_RESULT                     | Run x fold x metric x subgroup                      | Baseline, score, coverage, sample/cluster counts, uncertainty, evaluation mode, rejection reason                                                                             |
| ALERT / REVIEW                        | Alert/version and reviewer action                   | Detector, threshold policy, exposed denominator, data-quality gate, dedup key, status, source evidence; audit trail                                                          |

## Minimal Observation Contract

Illustrative DDL, not a migration applied by this task:

```sql
CREATE TABLE indicator_observation (
  observation_id VARCHAR PRIMARY KEY,
  source_id VARCHAR NOT NULL,
  release_id VARCHAR NOT NULL,
  geo_key VARCHAR NOT NULL,
  industry_key VARCHAR NOT NULL,
  measure_id VARCHAR NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value DOUBLE,
  unit VARCHAR NOT NULL,
  seasonal_adjustment VARCHAR NOT NULL,
  standard_error DOUBLE,
  missing_reason VARCHAR,
  available_at TIMESTAMP,
  availability_basis VARCHAR NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  CHECK (period_end >= period_start),
  CHECK (standard_error IS NULL OR standard_error >= 0),
  CHECK ((value IS NULL AND missing_reason IS NOT NULL)
      OR (value IS NOT NULL AND missing_reason IS NULL)),
  UNIQUE (release_id, geo_key, industry_key, measure_id,
          period_start, period_end, seasonal_adjustment)
);
```

Use an explicit `all_industries` key, not SQL NULL, in uniqueness keys. Preserve special source annotations separately; a published sentinel is not a numeric value. Date precision is recorded in the release table; a date-only publication should be made available conservatively after that date if intra-day timing is unknown.

For a retrospective vintage query, first filter `available_at <= cutoff` using **verified** historical availability, then choose the most recent eligible revision within the observation key. For a live reproduction of what this application actually knew, also filter `retrieved_at <= cutoff`. An archived public vintage retrieved today can support a historical public-information experiment, but cannot establish that this application had it then. Estimated release delays go through a different query path and an explicit `pseudo_real_time` evaluation label.

## Pipeline and Refresh

1. Discover source releases on their calendars; retry transient failures with backoff and limits. Monthly sources are checked around release, annual sources around annual publication; optional document ingestion weekly. Save failed-run metadata without replacing good data.
2. Save immutable raw response/file and sanitized request, hash, retrieval time, source release ID, parser version. Keys stay in environment/secret storage and out of URLs written to logs.
3. Parse into staging; validate schema, uniqueness, geography, units, counts, revisions, disclosure and period continuity. Quarantine invalid rows/releases. Separate data revision from new observation.
4. Build fixed-support panels; verify universe and aggregation identities. Compute rates with exposure and measurement error. Fit imputers, scalers, sector aggregation and feature selection only on training data for each evaluation fold.
5. Run a county baseline first. Recompute filtered states when new observations arrive with parameters fixed; refit parameters quarterly or when an audited source revision changes training history. Refit sparse annual structure after annual releases. Refit experimental hierarchical models on a scheduled batch only after diagnostics.
6. Run chronological validation and model-specific checks. A challenger replaces the approved model only with documented predictive/calibration improvement or a corrected material defect. Do not keep tuning on the published holdout.
7. Build results into a fresh version directory; validate serialization, nonfinite numbers, dates, units, suppression, provenance and interval ordering. Atomically publish the manifest pointer. Preserve rollback bundles and a log of revisions visible to users.

Dependencies determine recomputation: a boundary change invalidates crosswalks, spatial features and fitted results; a corrected permit affects its count aggregates and downstream forecasts; an updated document duplicate should not increment event counts twice. Use dependency hashes rather than recomputing everything on every page load.

## Frontend/API Contract

```ts
type EconomicOutputStatus =
  | "observed"
  | "derived"
  | "nowcast"
  | "forecast"
  | "experimental"
  | "scenario"
  | "unavailable";

interface EconomicOutput {
  id: string;
  runId: string;
  targetId: string;
  geography: { id: string; type: string; boundaryVintage: string };
  period: { start: string; end: string };
  asOf: string;
  status: EconomicOutputStatus;
  estimate: number | null;
  unit: string;
  interval: null | {
    lower: number;
    upper: number;
    level: number;
    kind: "confidence" | "credible" | "predictive" | "scenario";
  };
  sourceReleaseIds: string[];
  coverage: { observed: number; expected: number; definition: string };
  evaluation:
    "none" | "retrospective" | "pseudo_real_time" | "vintage" | "prospective";
  modelVersion: string | null;
  caveats: string[];
}
```

The current bundle uses the schema in `research/INTERFACE.md`: `status` is `ready | experimental | blocked`, `evidenceType` is `observed | modeled | conditional | readiness`, and each method carries requirements/limitations/result. Blocked results are null. The richer interface above is an extension sketch, not a demand to replace that working contract. Add multiple quantiles/targets through compatible additions. Current static resources are `model-results.json`, `source-snapshot.json` and `tracts.geojson`; split them into versioned manifests/resources only if size or independent refresh justifies it. A later API could expose `GET /economic/indicators`, `/forecasts`, `/sources`, `/runs/{id}`. A server scenario job is optional; the existing browser scenario must remain explicitly conditional.

Cache by immutable run ID. URL state includes geography, date, measure, comparison and source/model mode. Null produces an explanation and coverage view, not a zero bar. Keep model families that lack data visibly unavailable or omit their route from the operational release. Development previews can show synthetic fixtures only with persistent fixture labeling and no production exports.

## Verification and Operations

Required engineering checks: parser fixtures for real schema edge cases; no synthetic directory dates entering model features; zero versus suppressed distinction; duplicate revisions; valid boundaries/leading zeros; disjoint sector sums; coordinate order and CRS; ACS period spans; as-of query excludes later releases; target horizon arithmetic; frontend round-trip of nulls and intervals; atomic failure leaves last good bundle intact.

Required scientific checks are in [validation and release gates](validation-and-release-gates.md). Browser verification for implementation should cover desktop/mobile, map legend and missing-data patterns, accessible colors, keyboard filters, persistent filters, nonoverlapping text, source links, honest units, and interval display. No application tests or browser checks are claimed by these documentation files.

Run catalog stores start/end/status, input/output checksums, rows accepted/quarantined, periods covered, source age, memory/time and failure summary. Show refresh status and source release status separately. Back up immutable releases and catalog; rehearse restoration with a reproducible output hash. Restrict sensitive surveys, exact confidential transaction flows, and unnecessary personal data to private storage; only reviewed aggregates enter the static public bundle.
