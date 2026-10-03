# Demand API Design

**Date:** October 3, 2026  
**Product:** Mount Olive Economic Observatory  
**Status:** Proposed for implementation  
**Scope:** Server-backed Local Demand datasets, provenance, controlled publishing, and resilient client integration

## Purpose

Replace browser-only demand imports with a credible public research data service. Visitors may read verified aggregate datasets without authentication. Only an administrator may publish, activate, supersede, or archive a dataset. The existing Local Demand demonstration and browser imports remain available when the API has no verified dataset or is unavailable.

This work does not claim access to individual searches, exact Google query counts, or Mount Olive-specific Google Trends observations. It does not build a runtime dependency on undocumented Google endpoints.

## Success Criteria

1. `GET /api/demand` exposes active, verified aggregate datasets and complete public provenance.
2. Administrative mutations require a server-configured secret and never expose that secret in source code, logs, API responses, or persistent browser storage.
3. Published datasets are immutable and content-addressed. Activation, supersession, and archival are separate append-only events.
4. The dashboard prefers verified API data when available and clearly identifies its exact geography, source, retrieval date, observation period, value unit, and verification status.
5. Demo data remains unmistakably synthetic. API failure never causes demo values to receive a verified label.
6. Existing Observatory, Local Economic Pulse, Chamber workspace, map, browser import, CSV export, and print paths continue to work.
7. Validation rejects malformed, independently scaled, geographically mixed, unverifiable, oversized, or incomplete administrative submissions.
8. Automated and browser tests demonstrate authorization, provenance, concurrency behavior, fallback, and existing-page regression safety.

## Existing System Reused

- React 18, TypeScript, Vite, hash-based Observatory navigation
- Vercel Node.js functions under `api/`
- Existing API handler shape and test conventions from `api/census.ts`
- Existing `DemandBatch`, CSV parser, statistical engine, category taxonomy, business-supply normalization, source badges, and methodology components
- Existing browser-local imports as an offline/private fallback
- Existing research acquisition cache and provenance pattern in `research/acquire.py`

No router, UI framework, charting library, database, AI component, or unofficial Google Trends client is introduced.

## Architecture

### Public API

`GET /api/demand`

Returns a versioned public envelope:

```ts
type DemandApiEnvelope = {
  schemaVersion: "1.0";
  generatedAt: string;
  activeDatasetId: string | null;
  datasets: PublishedDemandDataset[];
  warnings: string[];
};
```

Only active, non-archived, verified datasets are returned by default. `?include=history` returns public superseded versions for methodology and reproducibility. Responses use `ETag`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, and `X-Content-Type-Options: nosniff`.

`POST /api/demand`

Publishes a validated dataset. Requires `Authorization: Bearer <DEMAND_ADMIN_TOKEN>`. The request is JSON, limited to 2 MB, one to eight distinct categories, and 10,000 observations per series. The server assigns the dataset ID, publication timestamp, verification state, and SHA-256 content fingerprint. A caller-provided idempotency key prevents accidental duplicate publication.

`PATCH /api/demand?id=<datasetId>`

Appends an administrative event: `activate`, `supersede`, or `archive`. It never edits the dataset blob. Activation requires the target dataset to remain valid and verified. Archival removes it from the default public response but preserves the research record.

Physical deletion is deliberately absent from the public application. Exceptional removal occurs through the Vercel storage administration surface, outside this API, and is documented as a destructive administrative action.

### Storage

Use a **private Vercel Blob store**. API functions access it server-side; visitors never receive Blob credentials or private object URLs.

Immutable objects:

```text
demand/v1/datasets/<dataset-id>-<sha256>.json
demand/v1/events/<iso-time>-<event-id>.json
```

The current state is derived from immutable datasets plus ordered events. This avoids a mutable shared index and lost-update races. The expected corpus is small, so listing and deriving state is simpler and safer than introducing a relational database. The storage layer is an interface with Vercel Blob and in-memory test implementations.

Vercel configuration:

- Private Blob store connected to the project
- `BLOB_READ_WRITE_TOKEN` or project-scoped Vercel OIDC, according to the connected store configuration
- `DEMAND_ADMIN_TOKEN`, generated randomly and stored only in Vercel environment settings and the administrator's password manager
- `DEMAND_ALLOWED_ORIGIN=https://mountolivechamberanalytics.com`

Missing storage configuration produces a structured `503` response. It never writes to a serverless function's temporary filesystem.

### Authentication and Request Safety

- Public reads need no token.
- Writes use a bearer token compared in constant time.
- Missing server configuration returns `503`; missing or invalid credentials return the same `401` shape.
- Mutation responses set `Cache-Control: no-store`.
- Same-origin requests are expected; no wildcard CORS header is emitted.
- No cookies are used, so the write path does not introduce cookie-based CSRF.
- Body, series, point, string-length, date, and enum limits are enforced before storage access.
- Error messages expose validation context but not secrets, stack traces, storage URLs, or internal tokens.
- A small per-instance rate guard protects obvious repeated failures; Vercel Firewall is the deployment-level protection.

## Dataset Contract

The server contract extends the existing browser model without changing the statistical formulas:

```ts
type PublishedDemandDataset = {
  id: string;
  schemaVersion: "1.0";
  name: string;
  status: "verified";
  sourceType: "google-trends-csv" | "google-trends-api";
  valueUnit: "normalized-index-0-100" | "google-trends-api-scaled";
  geography: {
    label: string;
    level: "state" | "metro" | "county" | "other";
    code: string | null;
  };
  comparison: {
    sharedScale: boolean;
    method: "single-export" | "official-api";
  };
  provenance: {
    sourceOrganization: "Google";
    sourceProduct: "Google Trends";
    sourceUrl: string;
    retrievedAt: string;
    publishedAt: string;
    originalFilename: string | null;
    contentSha256: string;
    acquisitionMethod: "official-csv-export" | "official-api";
    notes: string[];
  };
  series: DemandSeries[];
};
```

Raw observations and derived analysis remain separate. Demand Gap, trend, rankings, and signals are calculated in the existing tested browser engine from published observations. API data with `google-trends-api-scaled` units requires a provider-specific normalization adapter before it can enter the existing 0-100 chart contract.

The API never accepts `demo` as a verified source type. The server recomputes the content hash from a canonical form and ignores client-provided IDs, timestamps, hashes, or verification claims.

## Verification Rules

A dataset may be published as verified only when all conditions hold:

- Source is an official Google Trends CSV export or authenticated official API response.
- Exact geography is supplied and consistent across all series.
- Dates parse to supported daily, weekly, or monthly observations.
- Values match the declared unit and contain no out-of-range numbers.
- Every category and query is explicit and distinct.
- A demand-gap cohort has one shared comparison scale. Separately scaled exports cannot be merged.
- The observation source, retrieval time, source URL, and acquisition method are present.
- The dataset passes the same missingness and completeness rules used by the dashboard.

Data collected through an undocumented endpoint, a rate-limit bypass, an unattributed repost, or an unverifiable third-party scrape is rejected. A failed acquisition may be retained only as local research diagnostics, never published.

## Acquisition and Initial Population

Add a research command that accepts official exported CSV files, validates them with the shared parser, records the raw file hash and acquisition metadata, and produces a publishable canonical JSON artifact. It can publish through the protected API when credentials are explicitly configured.

The first acquisition attempt will use Google's official Explore interface and export workflow. On October 3, 2026, the automated Explore request returned HTTP 429. The implementation will retry only with bounded backoff and normal browser behavior; it will not bypass rate limits, imitate internal tokens, or depend on undocumented endpoints.

If a valid official export cannot be obtained in this environment, the API ships fully functional but without a verified search dataset. The visible dashboard continues to show its clearly labeled demonstration. Official public Census, BLS, or BigQuery data may inform separate economic modules, but Google BigQuery's top/rising-query tables will not be substituted for category-level historical demand.

The initial query plan uses broad, interpretable terms or Google topics when available, a single geographic scope, a single observation window, and one shared export. Query definitions are retained in provenance. A broader state or metro geography is displayed exactly as such, never labeled Mount Olive search demand.

## Client Behavior

Add a demand API client and a small state hook. On page load:

1. Render the existing labeled demo immediately.
2. Request `/api/demand` with an abort timeout.
3. If an active verified dataset arrives, add and select **Verified API Data**.
4. If the API is empty or unavailable, keep Demo selected and show a restrained availability note; do not block the page.

Data Source options become:

- Demo Data
- Verified API Data, when available
- This Browser, when local imports exist

The homepage Local Demand Pulse follows the same preference and always shows its source/geography badge. A provenance panel exposes source organization, exact geography, observation dates, retrieval/publication timestamps, query definitions, unit, and fingerprint.

The import dialog retains **Save in this browser**. An administrator can choose **Publish verified dataset**, enter the admin key for that request, preview the full provenance record, and publish. The key is held only in component memory for the active dialog and cleared on close; it is not placed in localStorage, sessionStorage, URLs, analytics, or logs.

If publishing fails, the validated local import remains available and the existing server dataset remains unchanged.

## Error Handling

API errors use this envelope:

```ts
type DemandApiError = {
  error: {
    code: "UNAUTHORIZED" | "NOT_CONFIGURED" | "INVALID_DATASET" | "CONFLICT" | "RATE_LIMITED" | "STORAGE_FAILURE";
    message: string;
    requestId: string;
  };
};
```

Storage reads are all-or-nothing: malformed stored objects are excluded and reported in server logs/request warnings rather than crashing the public endpoint. An activation conflict returns `409`. Client fetches abort and fall back without replacing good in-memory data.

## Testing

### Unit and API tests

- public GET and history filtering
- missing, incorrect, and correct admin credentials
- constant-time-safe comparison inputs of different lengths
- canonical serialization and stable SHA-256 fingerprints
- rejection of demo, malformed dates, mixed geography, duplicate categories, oversized bodies, too many points, independent scales, and fabricated verification fields
- idempotent duplicate POST
- immutable activation/archive event reduction
- concurrent event ordering and stale activation conflicts
- private storage adapter error mapping
- sanitization of public responses and error messages

### Client tests

- verified API data becomes the default when present
- demo remains labeled and selected when API is empty, slow, malformed, or unavailable
- local imports remain usable
- admin key is never persisted
- publish success refreshes and selects the verified dataset
- publish failure preserves current data
- provenance, geography, unit, fingerprint, and timestamps are visible
- exports preserve source distinctions

### Regression and visual tests

- homepage Local Demand Pulse
- Local Demand controls, matrix, chart, table, details, map, CSV, and print
- desktop, tablet, and mobile layouts
- existing Observatory, Local Economic Pulse, Chamber workspace, lint, typecheck, production build, research tests, and warehouse tests

## Files Expected to Change

New:

- `api/demand.ts`
- `api/_lib/demand-contract.ts`
- `api/_lib/demand-store.ts`
- API unit tests beside those modules
- `src/economy/demand/api.ts`
- client API/hook tests
- `research/demand_acquisition.py` and focused tests
- deployment and operations documentation

Modified:

- `src/economy/demand/types.ts`
- `src/economy/demand/LocalDemand.tsx`
- `src/economy/demand/DemandPulse.tsx`
- `src/economy/demand/ImportDialog.tsx`
- `src/economy/demand/store.ts`
- `src/economy/demand/demand.css`
- `e2e/demand.spec.ts`
- `package.json`, lockfile, and `vercel.json`

Exact file boundaries may tighten during planning, but the public contract, trust rules, failure behavior, and security model above are fixed unless the specification is revised.

## Deployment and Operations

1. Create and connect a private Vercel Blob store.
2. Generate a high-entropy `DEMAND_ADMIN_TOKEN`; configure it for Preview and Production.
3. Configure `DEMAND_ALLOWED_ORIGIN` for production and preview policy.
4. Deploy with no dataset; verify the demo fallback and `GET /api/demand` empty response.
5. Acquire and validate an official export.
6. Publish it through the protected API and inspect provenance.
7. Activate it and verify the public dashboard changes.
8. Preserve the source CSV and generated canonical artifact in the research archive.

No production deployment, storage creation, environment-variable write, or publication occurs without the corresponding Vercel project access and credentials. The codebase remains buildable and demonstrable locally without those external resources.

## Explicit Limitations

- This API makes our data handling durable and auditable; it does not grant Google Trends API access.
- Google Trends is normalized aggregate interest, not exact search counts, purchases, or individual histories.
- Available search geography may be broader than Mount Olive.
- Chamber directory supply is incomplete and coordinates/category mappings are imperfect.
- A Demand Gap remains a descriptive screening signal, not proof of unmet demand or a business recommendation.
- A server-backed verified dataset can become stale; its retrieval and observation dates remain visible so staleness cannot be mistaken for freshness.
