# Local Economic Evidence Warehouse

The runnable warehouse uses Python's standard-library `sqlite3` and stores its database at `warehouse/data/economy.sqlite`. Python 3.10+ is required. No account, database server, Python package installation, or network connection is needed to initialize it or import existing files. The optional ACS fetch uses public network access. It is an evidence store, not an economic model or a substitute for the whole local business population.

## Commands

Run from the project root. `--db` goes before the subcommand. Initialization is automatic and version checked on every command.

```powershell
python -m warehouse init
python -m warehouse import-directory public/economy/source-snapshot.json
python -m warehouse import-snapshot public/economy/source-snapshot.json
python -m warehouse import-csv research/data/observations.csv
python -m warehouse fetch-acs --years 2024
python -m warehouse import-model public/economy/model-results.json
python -m warehouse quality
python -m warehouse export --output warehouse/data/warehouse-export.json
python -m warehouse export --output warehouse/data/panel.csv
python -m warehouse export --output warehouse/data/revisions.csv --all-revisions
python -m warehouse export --output warehouse/data/as-of-panel.csv --as-of 2026-07-17
python -m unittest discover -s warehouse/tests -v
```

`import-directory` loads only sanitized businesses. `import-snapshot` loads that same directory plus the existing ACS, county CBP, and ZIP Business Patterns snapshot. These are alternatives; running both is safe. The main application's `scripts/export-economic-snapshot.ts` owns creating the source JSON. The research build owns `research/data/observations.csv` and `public/economy/model-results.json`; run the research build before importing those outputs.

Commands return JSON. Exit 0 means success, 1 means failed database integrity/foreign-key quality checks, and 2 means an import, validation, or access error. Quality warnings do not turn a structurally valid database into a failed run.

To choose another database:

```powershell
python -m warehouse --db warehouse/data/another.sqlite import-snapshot public/economy/source-snapshot.json
```

For routine pipeline runs, prefer a live database outside the OneDrive-synchronized repository, for example `--db "$env:LOCALAPPDATA/MountOliveEconomy/economy.sqlite"`. The orchestrator can pass this path to each command. Relative paths resolve from the working directory. The in-repository default is useful for a disposable local evaluation.

The SQLite file is locally generated and ignored by `warehouse/.gitignore`. JSON/CSV exports are portable inspection artifacts. The database retains raw source payloads; the JSON export includes artifact metadata but omits their potentially large raw `content` fields. It is not a full database backup. Keep a copy of the database while no writer is active for a complete archive. SQLite allows one writer at a time; concurrent network/cloud-sync writers are not a supported deployment mode.

## Schema

SQL definitions are in `warehouse/schema.sql`. SQLite table names are case insensitive, so `BUSINESS` and `business` identify the same table.

| Tables / Views                                                   | Grain and Purpose                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `business`                                                       | Stable directory business ID and latest public snapshot description. A listing is not proof of current operation.                                                        |
| `business_location_history`                                      | Business, location label, snapshot date. Observed addresses/coordinates; unknown occupancy start/end remain NULL.                                                        |
| `industry`, `business_industry`                                  | Separate Chamber categories and NAICS codes, including classification vintage and verification state. Chamber categories are never silently converted to verified NAICS. |
| `geography`                                                      | Code, type, boundary vintage; optional parent and WGS84 GeoJSON. Postal ZIP is distinct from Census ZCTA.                                                                |
| `indicator`                                                      | Name, unit, economic domain, universe, seasonal-adjustment metadata. Conflicting units for an existing indicator are rejected.                                           |
| `panel_observation`                                              | Indicator x geography vintage x industry x population group x observation interval x frequency x source. Stable identity, no value stored here.                          |
| `observation_revision`                                           | Immutable published value/status/MOE, observed date, retrieval time, method, flags, source release and provenance.                                                       |
| `panel_all_revisions`, `panel_current`                           | Every revision, or the most recent eligible revision of each observation.                                                                                                |
| `economic_indicators`, `demographics`, `employment`              | Domain views over current panel values.                                                                                                                                  |
| `property`, `property_observation`                               | Parcel snapshot and dated assessment/property measurements with source evidence.                                                                                         |
| `transportation`, `transportation_observation`                   | Network feature or station snapshot and dated measurements.                                                                                                              |
| `business_event`, `business_openings`, `business_closures`       | Candidate/verified/rejected operating events. Opening and closure views expose verified events only.                                                                     |
| `permit`                                                         | Application/decision dates, category, status, declared value, optional parcel/business/geography joins. Approval does not imply construction or operation.               |
| `commercial_activity`                                            | Dated business/geography activity measures with explicit coverage descriptions.                                                                                          |
| `external_shock`                                                 | Source-supported event intervals. Presence does not establish an economic causal effect.                                                                                 |
| `source`, `source_release`                                       | Provider/dataset identifiers, release identifiers, nullable publication dates and publication-date evidence.                                                             |
| `artifact`, `provenance`, `ingestion_evidence`                   | Content-addressed input payloads, exact record locators, row evidence and audited import sightings.                                                                      |
| `ingestion_run`, `audit_log`                                     | Success/failure, input hash, counts, before/after changes; failed batches leave no partly imported observations.                                                         |
| `document`, `document_candidate`, `candidate_review`             | Preserved planning text, rule matches with spans, explicit human decisions.                                                                                              |
| `model_run`, `model_input`, `model_source_input`, `model_output` | Versioned model manifests, exact input revision links or explicitly broader source links, cached input artifacts, validation and output payloads.                        |

Geography IDs inside normalized tables are deterministic keys, not raw GEOIDs. `panel` exports expose both `geography_key` (foreign key) and `geography_id` (published code). Use the normalized key for `import-records` joins. Directory addresses are not assigned to tracts by city name or ZIP. The public directory includes businesses outside Mount Olive and is a selected Chamber sample, not a census of businesses.

## Time and Revision Rules

`period_start` and `period_end` describe the measurement's reference interval. `observed_date` defaults to its interval end; this is a reference date, not a survey interview date. `release_date` is when the source published the release and stays NULL if unknown. `retrieved_at` is the supplied source retrieval timestamp. `ingestion_run.started_at` separately records when this machine imported it. Date-only retrieval metadata is conservatively interpreted as end-of-day UTC, not a precisely known retrieval hour.

The panel identity excludes values and releases. New releases and changed values append revisions. A later correction reverting to a previous value still creates a revision; an identical re-fetch does not. An exact repeated import adds an ingestion-run record, but does not duplicate canonical rows, revisions or row provenance. An older imported release cannot replace a newer published release. Current selection orders by publication date (reference interval end if publication is unknown), then retrieval time, then a deterministic ID. For an undocumented release chronology, retrieval order is only a latest-known convention, not proof of publisher revision order.

`export --as-of` requires both a known publication date on/before the cutoff and retrieval on/before the cutoff. Rows whose publication dates are unknown are excluded. Current imports are not retrospective real-time vintages: knowing a 2018 value today does not establish that today's revised value was known in 2018. An empty strict as-of export can be the correct answer. `--all-revisions` and `--as-of` are mutually exclusive. Historical JSON exports omit the unrestricted `tables` archive so future observations are not accidentally included; their `quality` section still describes the current database's structural checks and warning counts, not historical coverage.

Each CSV import is one transaction. A bad row rolls back all its canonical changes and records a failed ingestion with the row number. The source CSV text and parsed row evidence are retained on successful imports. JSON decoding, finite numeric checks, date validation, status validation, SQL constraints and foreign keys all run before commit. No interpolation, carry-forward, synthetic historical observations, imputed event dates, or reverse engineering of suppressed cells occurs.

## CSV Contract

Start with the header-only `warehouse/examples/observations-template.csv`. The populated format example lives only in `warehouse/tests/fixtures/observations.csv`; it is labeled `SYNTHETIC_TEST_ONLY` and is used exclusively by temporary test databases. Production commands never auto-load test fixtures.

Required headers: `indicator_id, geography_id, period_start, period_end, value, status, source_id, source_url, release_key, retrieved_at`.

| Columns                                                                                                    | Rules                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `indicator_id`, `indicator_name`, `domain`, `unit`, `universe`, `seasonal_adjustment`                      | Stable definition. Prefer explicit descriptors. Canonical domains: demographics, employment, business, property, transportation, activity, other.                                                                           |
| `geography_id`, `geography_name`, `geography_type`, `geography_vintage`                                    | Preserve published codes as text, including leading zeros. Missing boundary vintage is `unspecified`, never a guessed census year.                                                                                          |
| `industry_id`, `industry_code`, `industry_name`, `industry_system`, `industry_vintage`, `population_group` | Optional additional dimensions. Omit industry ID for all industries.                                                                                                                                                        |
| `period_start`, `period_end`, `observed_date`                                                              | ISO `YYYY-MM-DD`; start <= end; observed intervals cannot extend past retrieval.                                                                                                                                            |
| `frequency`                                                                                                | daily, monthly, quarterly, annual, five_year, irregular.                                                                                                                                                                    |
| `value`, `status`                                                                                          | `observed` requires a finite number, including a valid zero. `missing`, `suppressed`, `not_applicable` require an empty value. Sentinels such as `(D)` must be explicitly mapped by the producer, not submitted as numbers. |
| `margin_of_error`, `moe_confidence`                                                                        | Optional nonnegative MOE and confidence fraction (e.g. 0.9). No MOE is assigned when the source does not provide one. Nonobserved rows cannot carry MOEs.                                                                   |
| `source_id`, `source_name`, `source_url`, `source_homepage`                                                | Provider/dataset identity and exact retrieval URL. Use a stable source ID across successive releases, and a stable homepage if query URLs vary.                                                                             |
| `release_key`, `release_date`, `release_date_source`, `retrieved_at`                                       | Explicit release identifier; nullable verified publication date; timestamp with timezone or date-only retrieval. Publication after retrieval is rejected.                                                                   |
| `method`, `quality_flags`                                                                                  | Direct/derived measurement description, and a JSON array of source/quality flags. CSV-escape embedded quotes.                                                                                                               |

For the research CSV, aliases `labor -> employment`, `industry -> business`, `household_context -> demographics`, and `five_year_pooled -> five_year` are supported. Original labels remain in row provenance. Research source IDs are acquisition-window-specific; these distinguish their source windows in the panel and must not be summed across overlapping windows.

Malformed header widths, duplicate headers, unknown columns, conflicting duplicate observation/release rows, invalid dates, non-finite numbers, and definition changes are rejected. CSV exports include warehouse identifiers for inspection; these extra identifier columns are accepted on import but regenerated from the supplied observation dimensions. When reimporting industry-specific exports, provide their industry classification descriptors as well.

## Data Actually Loaded

The integration run imports the following observed inputs, without filling gaps:

| Input                         | Grain                                                                                       | Limitations                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Sanitized directory snapshot  | 116 business listings as of 2026-07-16                                                      | 96 listings expose coordinates; unverified directory coordinates, selection bias, no operating start/end dates.                   |
| Existing ACS snapshot         | Mount Olive and Morris County, 2020-2024 pooled period                                      | Retains estimates, available MOEs and direct/derived methods; comparison MOEs absent from export remain NULL.                     |
| Existing CBP/ZBP snapshot     | Morris County and postal ZIPs 07828/07836, 2023                                             | Employer establishments; ZIPs are not ZCTAs; original broad industry codes are retained with a classification-vintage flag.       |
| Fresh fixed-vintage ACS fetch | Mount Olive/Morris County, 2020-2024 pooled period                                          | Five direct variables per geography; population, household income, civilian labor force, employed and unemployed residents.       |
| Research observations CSV     | 1,206 rows: BLS 2000-Jul 2026, CBP 2018-2023 county totals, ACS 2024 tract variables        | Latest-vintage history; official missing October 2025 BLS values remain missing. ACS periods are pooled, not annual measurements. |
| Research model results        | Ten module manifests; seven output bundles and three readiness gates at initial integration | Ready vs experimental is preserved in the full envelope. Blocked modules remain gated, with no numerical output.                  |

The initial combined panel has 1,305 observation identities. Counts may change on future source refreshes; `quality` and the export are authoritative. Overlapping ACS windows are dependent and cannot be treated as independent annual increments. Resident employment from ACS/BLS is not workplace jobs from CBP. Payroll/income denominated in current-vintage dollars are not inflation-adjusted time series unless explicitly transformed by a documented model.

Public retrieval endpoints verified during this implementation:

- [Census Reporter fixed ACS 2024 response](https://api.censusreporter.org/1.0/data/show/acs2024_5yr?table_ids=B01003%2CB19013%2CB23025&geo_ids=06000US3402749080%2C05000US34027).
- [Census ACS API geography documentation](https://api.census.gov/data/2023/acs/acs5/geography.html).
- [BLS public API, Morris County unemployment rate](https://api.bls.gov/publicAPI/v2/timeseries/data/LAUCN340270000000003?startyear=2020&endyear=2026).
- [Census 2023 County Business Patterns](https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html).

The official Census API returned a Missing Key HTML page for keyless data requests in this session. The portable fetch therefore uses Census Reporter with an explicit requested vintage and validates the returned release. Tested older Reporter vintages 2023, 2019 and 2014 were unavailable; the importer never substitutes the latest release for a requested year. Historical BLS/CBP series come from the research pipeline. ACS publication dates are left unknown unless explicitly provided from a verified release source; `fetch-acs --release-date YEAR=YYYY-MM-DD` accepts those dates.

Property, transportation measurements, verified business events, permits, commercial activity, and external shocks have schemas and audited imports but no acquired observations in this run. Their empty tables are intentional. No local planning document is claimed to have been processed; only isolated synthetic text fixtures test extraction.

## Domain Records

`python -m warehouse import-records PATH.json` accepts `{ "source": { ...source/release/retrieval fields from the CSV contract... }, "records": { "property": [...], "business_event": [...], ... } }`. Supported table keys are `property`, `property_observation`, `transportation`, `transportation_observation`, `business_event`, `permit`, `commercial_activity`, `external_shock`. Row fields follow `warehouse/schema.sql`; each row needs a stable `id`. Evidence is assigned automatically, so callers must not supply `provenance_id`.

Insert referenced records first within the JSON object, and use normalized geography/business/indicator keys from the database/export. Foreign keys enforce joins. The importer validates dates, finite numeric values, required columns and source evidence, and audits updates. Domain snapshots preserve old values in the audit log; panel revisions have a dedicated immutable history. An opening/closure marked `verified` requires an identified human reviewer, verification timestamp and evidence text; a future scheduled event cannot be verified as already occurring. A disappearing directory listing or expired Chamber membership is not closure evidence.

## Planning Text Review

```powershell
python -m warehouse extract-document path/to/minutes.txt --source-url https://municipality.example/minutes --retrieved-at 2026-09-07 --places "Mount Olive" "Budd Lake"
python -m warehouse export --output warehouse/data/review-queue.json
python -m warehouse review-candidate CANDIDATE_ID --decision accepted --reviewer "Reviewer name" --notes "Checked the source passage; classification mention is correct."
```

Rules identify residential development, commercial development, infrastructure, zoning change and business expansion mentions. Each candidate retains its line's exact span, plus category/date/place match spans. Offsets are zero-based Python character indices, end-exclusive, against the stored text (UTF-8 BOM removed and newlines normalized on read). The full document and its hash are retained. Named places come from explicit `--places`; a bounded street-address rule supplies address candidates. Ambiguous dates/places remain NULL with all matching spans available for review.

Extraction cannot tell whether a proposal was approved, denied, completed or economically consequential. A negated phrase is still a review candidate. Dates on a line can be meeting dates or proposed action dates; they are not automatically event dates. Accepting a candidate confirms the reviewed extraction only. It never creates an economic observation, permit, verified business event, sentiment score, or causal claim. A separate reviewed source-record import is required for an economic fact. Re-extraction does not reset human review decisions.

## Model Lineage

`import-model` automatically detects the current `public/economy/model-results.json` research contract; `import-results` is an explicit alias for that format. It archives every declared cached source under its own content digest, retains the original reported HTTP hash in source metadata, and validates that the local cache's acquisition metadata agrees. The original raw HTTP bytes may differ from parsed cache JSON; the importer does not pretend the cache digest re-verifies the original HTTP hash. An unknown original retrieval time stays unknown in source metadata; local cache capture time is separate artifact metadata. Cache paths must stay inside the project.

`model_source_input` records complete declared source artifacts, including geometries, county/industry source files and directory inputs that are not fully represented by the observation CSV. `model_input.role='source_scope'` links warehouse revisions belonging to each declared acquisition. This is a deliberately broader lineage relationship than the exact fitted subset. The result envelope retains each model's method, requirements, evidence type, ready/experimental status, validation and limitations. The current research export does not attest a code commit/full fit parameter manifest, so the warehouse records that limitation explicitly instead of inventing a version. Rebuilding the research output creates a new run; importing the same output again is idempotent.

For model producers that can provide exact fitted-row lineage, `python -m warehouse import-model PATH.json` accepts:

```json
{
  "run": {
    "id": "producer-assigned-immutable-run-id",
    "model_name": "Producer model name",
    "model_version": "1",
    "code_version": "actual-code-commit-or-digest",
    "as_of": "2026-09-07T15:00:00Z",
    "status": "gated",
    "parameters_json": {},
    "validation_json": {},
    "limitations": "Required observations have not yet been acquired."
  },
  "inputs": [],
  "outputs": []
}
```

Successful empirical runs require `inputs[]` containing actual `revision_id`, `role` (default `training`) and a `transformation` description. Their input revisions must be available by `as_of`; unknown publication dates require an explicit "unknown release" limitation and cannot establish vintage backtesting. Outputs contain `id`, `target_period`, `output_type`, `unit`, optional `estimate`, both interval bounds with `interval_level`, and optional `payload_json`. Bounds must contain the estimate. Failed/gated runs cannot publish outputs. Run metadata, complete input sets and output sets are immutable for a given run ID.

## Verification and Limits

Offline tests cover schema initialization, foreign keys, exact repeat imports, preserved missing/suppressed/zero values, changed and reverted revisions, historical availability filtering, invalid dates/numbers, unit conflicts, transaction rollback, conflicting CSV duplicates, sanitized directory history, verified events, model lineage/intervals, and reviewable document spans. They create temporary SQLite databases and never write fixture observations into the real warehouse. The command-line test exercises initialization, import, quality and export.

Quality reports database integrity, foreign keys, table counts and warnings for unknown release dates/vintages, missing values, unverified coordinates/events, ACS pooled periods, unreviewed candidates, failed import attempts and models without panel inputs. A warning is evidence to inspect, not an invitation to fill data. Empty domain tables, missing historical release vintages, unverified spatial assignment and source-scope model lineage remain substantive acquisition/validation limits.
