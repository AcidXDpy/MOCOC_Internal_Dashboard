# Verified Demand API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, provenance-preserving API for shared verified Local Demand datasets while keeping the current demo and browser-import experience resilient.

**Architecture:** Vercel Node.js functions expose public reads and bearer-protected administrative mutations. A private Vercel Blob repository stores immutable content-addressed datasets and append-only state events; the React client prefers verified API data but falls back to existing sources without relabeling them.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, Vercel Functions, private Vercel Blob, PapaParse, Node crypto

**Spec:** `docs/superpowers/specs/2026-10-03-demand-api-design.md`

## Global Constraints

- Preserve all existing Local Demand, Local Economic Pulse, Observatory, Chamber workspace, map, CSV export, and print behavior.
- Public visitors can read verified data; only bearer-authenticated administrators can publish or change active state.
- Never persist the administrator token in browser storage, URLs, logs, analytics, API bodies, or API responses.
- Never label demo, third-party, rate-limit-bypassed, undocumented-endpoint, mixed-geography, or independently scaled data as verified.
- Exact search geography, source URL, retrieval/publication time, query definitions, value unit, and SHA-256 fingerprint remain visible.
- API/storage failure leaves the existing demo and browser imports usable.
- Production serverless code never uses temporary filesystem persistence.
- All behavior changes follow red-green-refactor; run the full project verification before completion.

## Review Focus

- A malformed stored Blob must be excluded with a warning rather than crashing public GET; Task 3 pins this behavior.
- Two administrative requests with the same idempotency key must produce one dataset; Task 3 pins this behavior.
- A stale activation must return `409` and leave the active dataset unchanged; Task 3 pins this behavior.
- A slow or malformed API response must not replace valid demo/local state; Task 4 pins this behavior.
- Closing the publish dialog after any outcome must erase the entered token; Task 5 pins this behavior.

---

### Task 0: Preserve the Verified Local Demand Baseline

**Files:**

- Commit existing completed Local Demand, Local Economic Pulse, research, test, and documentation changes already present in the working tree

**Interfaces:**

- Consumes: current tested workspace
- Produces: a clean Git baseline before server-backed behavior changes

- [x] **Step 1: Run the current baseline verification**

Run: `npm test && npm run test:research && npm run test:warehouse && npx playwright test && npm run lint && npm run build`

Expected: 35 TypeScript tests, 27 research tests, 29 warehouse tests, 15 browser tests, lint, and build pass.

- [x] **Step 2: Inspect the baseline diff for generated secrets or unrelated files**

Run: `git status --short && git diff --check && rg -n "BLOB_READ_WRITE_TOKEN=|DEMAND_ADMIN_TOKEN=" . --glob '!node_modules/**' --glob '!.git/**'`

Expected: no token values; only the already-reviewed Observatory work is included.

- [x] **Step 3: Commit the baseline**

```bash
git add e2e package.json package-lock.json scripts src docs public research
git commit -m "Build local economic pulse and demand observatory"
```

### Task 1: Published Dataset Contract and Verification

**Files:**

- Create: `src/economy/demand/api-types.ts`
- Create: `api/_lib/demand-contract.ts`
- Create: `api/_lib/demand-contract.test.ts`
- Modify: `src/economy/demand/types.ts`
- Modify: `tsconfig.server.json`

**Interfaces:**

- Consumes: `CategoryId`, `DemandPoint`, `DemandSeries`, and existing category IDs
- Produces: `PublishedDemandDataset`, `DemandApiEnvelope`, `DemandApiError`, `DemandPublishRequest`, `DemandAdminEvent`, `validatePublishRequest(value: unknown): DemandPublishRequest`, `canonicalDataset(request, serverFields): PublishedDemandDataset`, `contentFingerprint(dataset): string`

- [x] **Step 1: Write failing contract tests**

Add tests named:

- `accepts an official shared-scale CSV publication and strips server-owned fields`
- `rejects demo and undocumented acquisition methods`
- `rejects mixed geography, duplicate categories, invalid dates and out-of-range values`
- `rejects more than eight series, more than 10000 points, and payloads beyond 2 MB`
- `produces the same SHA-256 for semantically identical canonical datasets`
- `does not include admin credentials or private storage locations in the public contract`

- [x] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run api/_lib/demand-contract.test.ts`

Expected: FAIL because the contract module and functions do not exist.

- [x] **Step 3: Implement the pure public types and server validator**

Implement the exact exported interfaces from the spec in `api-types.ts`. In `demand-contract.ts`, use strict structural validation, canonical key/series/point ordering, server-owned IDs/timestamps/status, and Node `createHash("sha256")`. Permit only `official-csv-export` and `official-api`; reject `demoSample: true`.

- [x] **Step 4: Run focused and full unit tests**

Run: `npx vitest run api/_lib/demand-contract.test.ts && npm test`

Expected: contract tests and all project unit tests pass.

- [x] **Step 5: Commit**

```bash
git add src/economy/demand/api-types.ts src/economy/demand/types.ts api/_lib/demand-contract.ts api/_lib/demand-contract.test.ts tsconfig.server.json
git commit -m "Add verified demand dataset contract"
```

### Task 2: Immutable Private Blob Repository

**Files:**

- Create: `api/_lib/demand-store.ts`
- Create: `api/_lib/demand-store.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: `PublishedDemandDataset`, `DemandAdminEvent`
- Produces: `DemandRepository`, `MemoryDemandRepository`, `VercelBlobDemandRepository`, `deriveDemandState(datasets, events, options): DemandApiEnvelope`

`DemandRepository` methods:

```ts
listDatasets(): Promise<RepositoryItem<PublishedDemandDataset>[]>;
listEvents(): Promise<RepositoryItem<DemandAdminEvent>[]>;
putDataset(dataset: PublishedDemandDataset, idempotencyKey: string): Promise<"created" | "exists">;
appendEvent(event: DemandAdminEvent): Promise<void>;
```

- [x] **Step 1: Write failing repository tests**

Add tests named:

- `stores datasets immutably under content-addressed paths`
- `derives active verified state from ordered append-only events`
- `keeps superseded history only when requested`
- `excludes malformed stored objects and returns a public warning`
- `makes an idempotency key produce one stored dataset`
- `maps Blob configuration and storage failures without exposing private URLs`

- [x] **Step 2: Run the repository test and verify RED**

Run: `npx vitest run api/_lib/demand-store.test.ts`

Expected: FAIL because repository implementations do not exist.

- [x] **Step 3: Add `@vercel/blob` and implement both repositories**

Use private access and prefixes `demand/v1/datasets/` and `demand/v1/events/`. Parse each listed object independently. The memory repository is the real test implementation, not a mock. Do not add a mutable index or filesystem adapter.

- [x] **Step 4: Run focused and full unit tests**

Run: `npx vitest run api/_lib/demand-store.test.ts && npm test`

Expected: repository tests and all unit tests pass.

- [x] **Step 5: Commit**

```bash
git add api/_lib/demand-store.ts api/_lib/demand-store.test.ts package.json package-lock.json
git commit -m "Add immutable demand dataset repository"
```

### Task 3: Secure Vercel Demand Function

**Files:**

- Create: `api/demand.ts`
- Create: `api/demand.test.ts`
- Modify: `vercel.json`

**Interfaces:**

- Consumes: `DemandRepository`, contract validation/canonicalization, `DEMAND_ADMIN_TOKEN`, `DEMAND_ALLOWED_ORIGIN`
- Produces: `createDemandHandler(dependencies): (request, response) => Promise<void>` and default Vercel handler for `GET`, `POST`, `PATCH`

- [x] **Step 1: Write failing handler tests**

Use `MemoryDemandRepository` and real request/response test doubles. Add tests named:

- `GET is public, sanitized, cacheable and supports explicit history`
- `POST returns identical 401 responses for missing and invalid credentials`
- `POST publishes canonical verified data and honors idempotency`
- `POST rejects oversized bodies before repository access`
- `PATCH activates and archives by append-only events`
- `PATCH rejects a stale expected active id with 409 and does not mutate state`
- `malformed stored data yields warnings while valid data remains readable`
- `unconfigured storage or token returns structured 503 without secrets`
- `disallowed origins and repeated failed authorization are rejected`

- [x] **Step 2: Run the handler test and verify RED**

Run: `npx vitest run api/demand.test.ts`

Expected: FAIL because the demand handler does not exist.

- [x] **Step 3: Implement the injected handler and default Vercel wiring**

Use constant-time bearer comparison, request IDs, no-store mutation responses, same-origin policy, bounded per-instance failed-auth guard, exact error codes from the spec, ETags on GET, and a lazy Blob repository so missing configuration maps to `503` rather than import-time failure. Update the Vercel rewrite so `/api/*` functions are resolved before the SPA fallback.

- [x] **Step 4: Run API, unit, type, and lint checks**

Run: `npx vitest run api/demand.test.ts && npm test && npm run typecheck && npm run lint`

Expected: all pass with no credential or private URL in snapshots/output.

- [x] **Step 5: Commit**

```bash
git add api/demand.ts api/demand.test.ts vercel.json
git commit -m "Expose secured verified demand API"
```

### Task 4: Resilient Public Client and Provenance UI

**Files:**

- Create: `src/economy/demand/api.ts`
- Create: `src/economy/demand/api.test.ts`
- Create: `src/economy/demand/useDemandApi.ts`
- Modify: `src/economy/demand/LocalDemand.tsx`
- Modify: `src/economy/demand/DemandPulse.tsx`
- Modify: `src/economy/demand/CategoryDialog.tsx`
- Modify: `src/economy/demand/engine.ts`
- Modify: `src/economy/demand/demand.css`
- Modify: `e2e/demand.spec.ts`

**Interfaces:**

- Consumes: `DemandApiEnvelope`, `PublishedDemandDataset`, existing `DemandBatch` and statistical engine
- Produces: `fetchDemandApi(options): Promise<DemandApiEnvelope>`, `publishedToDemandBatch(dataset): DemandBatch`, `useDemandApi(): DemandApiState`

- [x] **Step 1: Write failing API-client tests**

Add tests named:

- `converts a verified published dataset without losing geography or provenance`
- `rejects malformed success responses instead of coercing them`
- `aborts slow requests and returns a typed unavailable result`
- `does not map API-scaled units into the 0-100 engine without an adapter`

Add Playwright route-controlled tests named:

- `verified API data becomes the default and exposes complete provenance`
- `empty, malformed, slow and failed API responses retain labeled demo data`
- `browser imports remain selectable beside verified API data`
- `homepage pulse identifies verified source or explicit demo fallback`

- [x] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run src/economy/demand/api.test.ts && npx playwright test e2e/demand.spec.ts`

Expected: FAIL because the client, hook, API source option, and provenance UI do not exist.

- [x] **Step 3: Implement client validation, conversion, hook, and UI integration**

Render demo immediately, fetch with an abort timeout, auto-select an active verified 0-100 dataset only before the user changes source, and preserve good state on refresh failures. Add `Demo Data`, `Verified API Data`, and `This Browser` source options. Show source URL, exact geography level/code, acquisition method, query definitions, observation dates, retrieved/published timestamps, value unit, and abbreviated fingerprint in an accessible provenance section.

- [x] **Step 4: Run focused, unit, and browser tests**

Run: `npx vitest run src/economy/demand/api.test.ts && npm test && npx playwright test e2e/demand.spec.ts`

Expected: focused and all existing demand tests pass.

- [x] **Step 5: Commit**

```bash
git add src/economy/demand e2e/demand.spec.ts
git commit -m "Integrate verified API demand data"
```

### Task 5: Administrator Publishing and Acquisition Record

**Files:**

- Modify: `src/economy/demand/ImportDialog.tsx`
- Modify: `src/economy/demand/LocalDemand.tsx`
- Modify: `src/economy/demand/api.ts`
- Modify: `src/economy/demand/api.test.ts`
- Modify: `src/economy/demand/demand.css`
- Modify: `e2e/demand.spec.ts`
- Create: `scripts/publish-demand.ts`
- Create: `scripts/publish-demand.test.ts`
- Create: `research/data/demand-acquisition-log.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: validated local `DemandBatch`, protected `POST /api/demand`, protected `PATCH /api/demand`
- Produces: `publishDemandDataset(request, adminToken, options)`, `demand:publish` CLI reading `DEMAND_ADMIN_TOKEN` from environment, and a dated acquisition log

- [x] **Step 1: Write failing publishing tests**

Add unit tests named:

- `publishes a validated official CSV request with bearer auth outside the body`
- `never sends demo data or an independently scaled comparison`
- `clears credentials from returned errors and client state`
- `CLI requires source URL, exact geography, retrieval time and original file hash`

Add browser tests named:

- `administrator can preview provenance, publish and select verified data`
- `closing or failing the publish flow erases the admin key and keeps local data`

- [x] **Step 2: Run publishing tests and verify RED**

Run: `npx vitest run src/economy/demand/api.test.ts scripts/publish-demand.test.ts && npx playwright test e2e/demand.spec.ts`

Expected: FAIL because publishing UI/client/CLI do not exist.

- [x] **Step 3: Implement publish mode and CLI**

Keep the admin key only in ImportDialog component memory. Require explicit source URL, acquisition method, retrieval timestamp, exact geography level/code, and shared-scale confirmation. On server failure, retain the local validated import. The CLI accepts `--file`, `--metadata`, and `--endpoint`; it reads the token only from `DEMAND_ADMIN_TOKEN` and never prints it.

- [x] **Step 4: Record the official acquisition attempt**

Retry the official Google Trends Explore/export workflow once with bounded normal browser behavior. Record date, URL, intended geography/query cohort, HTTP outcome, and whether an official CSV was obtained in `demand-acquisition-log.json`. If the result remains `429`, publish nothing and state that explicitly. Do not call undocumented endpoints or use a rate-limit bypass.

- [x] **Step 5: Run focused and full demand tests**

Run: `npx vitest run src/economy/demand/api.test.ts scripts/publish-demand.test.ts && npx playwright test e2e/demand.spec.ts`

Expected: all pass; acquisition result matches the evidence actually obtained.

- [x] **Step 6: Commit**

```bash
git add src/economy/demand scripts package.json research/data/demand-acquisition-log.json e2e/demand.spec.ts
git commit -m "Add controlled demand dataset publishing"
```

### Task 6: Deployment Documentation, Full Verification, and GitHub Push

**Files:**

- Modify: `docs/local-demand.md`
- Create: `docs/demand-api-operations.md`
- Modify: `docs/superpowers/plans/2026-10-03-demand-api.md`
- Modify: `.gitignore` only if local Vercel artifacts require an explicit exclusion

**Interfaces:**

- Consumes: completed API, storage adapter, public client, publishing workflow
- Produces: reproducible private Blob/environment setup, publication/rollback instructions, completed verification record

- [x] **Step 1: Document operations and research interpretation**

Document private Blob creation, `DEMAND_ADMIN_TOKEN`, allowed origin, local/preview/production behavior, first publication, activation, archival, recovery, token rotation, API examples without secrets, current acquisition status, and the distinction among demo, verified API, and browser-only data.

- [x] **Step 2: Run the complete verification suite**

Run: `npm test && npm run test:research && npm run test:warehouse && npx playwright test && npm run lint && npm run format:check && npm run build && npm audit --omit=dev && git diff --check`

Expected: all tests and checks pass; production dependency audit reports no unresolved production vulnerability.

- [x] **Step 3: Inspect desktop, tablet, mobile, import, provenance, and print screenshots**

Use browser automation at 1440x1000, 820x1180, and 390x844. Verify no page-level overflow, overlapping labels, blank charts, hidden source badges, inaccessible dialog actions, console errors, or API failure regressions.

- [ ] **Step 4: Request an independent whole-change code review and resolve findings**

Review focus: authorization, secret leakage, immutable state reduction, malformed storage, source-label honesty, race conditions, fallback behavior, and deployment configuration.

- [ ] **Step 5: Mark plan checkboxes and commit final documentation/fixes**

```bash
git add docs .gitignore api src scripts research e2e package.json package-lock.json vercel.json tsconfig.server.json
git commit -m "Complete verified demand API"
```

- [ ] **Step 6: Push the tested branch to the configured GitHub remote**

Run: `git status --short && git remote -v && git push origin main`

Expected: clean working tree and successful push. Do not create or configure Vercel resources during this step; document the required deployment setup if credentials are unavailable.
