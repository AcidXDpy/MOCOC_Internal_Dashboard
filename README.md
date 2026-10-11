# MOCA

A local economic research platform deployed through the Mount Olive Area Chamber of Commerce. The economy is the primary unit of analysis.

## Implemented

The default `/` route has eleven economic analysis views. The original member application remains at `/chamber`; existing business/project routes remain available.

- Source-linked township demographics, core-ZIP establishments and county labor conditions.
- BLS monthly forecasts, seasonal-naive benchmark, rolling-origin selection, final holdout and 90% prediction intervals.
- Lagged-data current-month projection and seasonal-residual early-warning diagnostics.
- Exploratory tract PCA with loading stability; no unsupported overall health score.
- Actual tract polygons, global/local Moran statistics, permutations, FDR-adjusted clusters and neighbor sensitivity.
- Industry composition, RCA, concentration, regional similarity and directory relationship graphs.
- Live matrix-based conditional shock exposure and binary policy optimization with editable assumptions.
- Evidence gates for business survival and causal inference; reusable estimators are implemented and tested without invented local outcomes.
- A complete 20-section research library with 40 research questions, equations, ranked priorities and a seven-component roadmap.
- Audited SQLite panel warehouse, source revisions, location histories, document-review candidates and model-source lineage.

## Data and Scientific Limits

The September 7, 2026 bundle contains BLS Morris County monthly history from 2000 through July 2026, ACS 2020-2024 pooled tract estimates, 110 tract boundaries (105 eligible analytical tracts), a fixed 2018-2023 NJ CBP comparison window, 2023 ZBP for 07828/07836, and 116 public directory listings from July 16, 2026. The directory has 96 coordinates and is a selected multi-community sample, not a census of businesses. Synthetic lifecycle fields are excluded.

The comparable industry matrix contains 21 counties and 16 sectors, covering 16,343 of 16,518 Morris establishments in 2023. Missing sectors are not zero-filled. October 2025 BLS data remain missing. Survey margins of error and source-specific dates remain visible.

The selected state-space model wins the selection sample but **loses the final holdout** to the seasonal-naive baseline (MAE approximately 0.568 versus 0.489 percentage points). Nominal 90% intervals over-cover this small holdout. The app reports this. Current-month projections are not measured current activity or GDP. The PCA has mixed loading directions and fails the health-orientation gate. Network similarity is not a transaction relationship. Policy benefits and shock propagation are explicitly hypothetical assumptions.

Source publication dates are not guessed. These latest-vintage snapshots do not support a real-time historical backtest. Property, traffic, permit and verified business-event tables remain empty until evidence is acquired.

## Run the Website

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run build
npm test
npm run lint
npm run test:browser
```

Open `http://127.0.0.1:5173/`. The static site reads checked-in results; viewing it needs no Python or account. Browser tests use Edge on Windows and Chromium elsewhere; install Chromium first with `npx playwright install chromium` on non-Windows machines.

## Reproduce the Evidence

Use Python 3.12 or later:

```sh
python -m pip install -r research/requirements.txt
npm run economy:pipeline -- --offline
npm run test:research
npm run test:warehouse
```

The pipeline exports public directory fields, rebuilds models from observed caches, imports the snapshot and 1,206 source records into SQLite, registers model lineage, checks integrity and exports the database view. A clean base run contains 116 businesses and 1,295 panel identities.

Use `npm run economy:pipeline -- --refresh` to deliberately download new official snapshots. Without either flag, caches are reused. Models read source-cache observations; SQLite indexes those same observations and revisions. Models do not yet query a shared database server. Review updated coverage and validation before publication.

The live database is outside the OneDrive repository: `%LOCALAPPDATA%/MountOliveEconomy/economy.sqlite` on Windows, or `~/.local/share/MountOliveEconomy/economy.sqlite` elsewhere. Override `ECONOMY_DATA_DIR` and `PYTHON` when needed. Use an explicit database path with the standalone CLI.

```sh
python -m warehouse --db PATH/economy.sqlite quality
python -m warehouse --db PATH/economy.sqlite import-csv observations.csv
python -m warehouse --db PATH/economy.sqlite extract-document minutes.txt --source-url https://example.gov/minutes --retrieved-at 2026-09-07T12:00:00Z
```

Text classifications are source-spanned review candidates, not verified development or economic-impact events. See [warehouse operations](docs/economic-warehouse.md) for formats, review commands, revisions and as-of restrictions.

## Architecture and Delivery

React/Vite/TypeScript, Recharts, Leaflet, Python (NumPy/SciPy/statsmodels/scikit-learn/NetworkX/Shapely), and SQLite. D3 separates graph nodes visually; ml-matrix solves live exposure scenarios; jsLPSolver solves policy allocation. Markdown and KaTeX render the research library. Heavy estimation runs in the batch pipeline.

GitHub Actions verifies commits/PRs and recomputes candidate evidence weekly or on demand. It uploads artifacts for review; **it does not automatically overwrite published data or commit refreshed observations**. Vercel remains a Vite deployment: build `npm run build`, output `dist`.

No production authentication, shared database, commercial-footfall feed or private business account is implied. The older member preview remains a preview. PostgreSQL/PostGIS and the signature hierarchical spatiotemporal model are later stages, gated by data and validation.

## Research Deliverables

- [Full 20-section technical design](docs/economic-intelligence/technical-design.md)
- [Exact source acquisition matrix](docs/economic-intelligence/source-acquisition-matrix.md)
- [Seven-component mathematical roadmap](docs/economic-intelligence/component-roadmap.md)
- [Architecture and contracts](docs/economic-intelligence/implementation-architecture.md)
- [Statistical validity and release gates](docs/economic-intelligence/validation-and-release-gates.md)
- [Executable methods and limitations](research/README.md)
- [Model-output schema](research/INTERFACE.md)
- [Warehouse operations](docs/economic-warehouse.md)

Developed by Nakul Ramprasad.
