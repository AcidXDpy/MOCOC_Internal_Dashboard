# Demand API Operations

## Trust and Data Model

`GET /api/demand` is public. `POST` and `PATCH` require bearer authorization. Datasets are immutable, content-addressed JSON objects in a private Vercel Blob store. Activation, supersession and archival are separate append-only events; no API route physically deletes research data.

The application distinguishes Demo Data, Verified API Data and This Browser. Only data that passes the server contract and cites an official Google CSV export or official API response can become verified. Demo samples, independently scaled comparisons and unofficial scraping are rejected.

## Vercel Setup

1. Create a private Vercel Blob store and connect it to the project.
2. Confirm the project receives `BLOB_READ_WRITE_TOKEN`, or use the project-scoped Blob/OIDC configuration supported by Vercel.
3. Generate a high-entropy random administrator token in a password manager. Add it as `DEMAND_ADMIN_TOKEN` for Preview and Production. Never use the examples in this document as values.
4. Set `DEMAND_ALLOWED_ORIGIN` to the exact production origin, for example `https://mountolivechamberanalytics.com`. Configure the appropriate exact preview origin while testing preview deployments.
5. Redeploy and open `/api/demand`. Before the first publication it should return HTTP 200 with `activeDatasetId: null` and an empty `datasets` array.

The code does not create Blob stores, domains or environment variables automatically. Local Vite development has no private store by default; the dashboard therefore shows Demo Data while browser imports remain usable. `vercel dev` with pulled project environment variables can exercise the function locally. Preview and Production use their own configured environment values.

## Public Read

```text
GET /api/demand
GET /api/demand?include=history
```

Default reads return only the active verified dataset. History reads also include superseded, non-archived datasets. Responses include an ETag and short shared-cache policy. Private Blob URLs, object paths and provider errors are never included.

## First Publication

1. Obtain one official Google Trends comparison export with one geography, time window and shared scale.
2. Preserve the original export and calculate its SHA-256.
3. Import it in Local Demand and verify every query/category mapping and the exact geography.
4. Choose **Publish verified dataset** and provide the official source URL, retrieval time, geography level/code and administrator key.
5. Review the publication preview, then publish. The client first saves the browser copy, posts the canonical dataset and appends an activation event.
6. Reload `/api/demand`, inspect the public provenance and verify the homepage and Local Demand page both show **Verified API Data** with the correct geography.

The command-line path accepts a canonical request JSON artifact plus a metadata JSON file:

```text
DEMAND_ADMIN_TOKEN=<from-password-manager> npm run demand:publish -- --file dataset.json --metadata metadata.json --endpoint https://example.org/api/demand
```

Metadata must include `sourceUrl`, exact `geography` (`label`, `level`, `code`), ISO `retrievedAt` and `originalFileSha256`. The CLI verifies that hash against `--file`, reads the token only from the environment and never prints it.

## State Changes and Recovery

Administrative state changes use:

```text
PATCH /api/demand?id=<dataset-id>
Authorization: Bearer <administrator token>
Content-Type: application/json

{"action":"activate","expectedActiveDatasetId":null}
{"action":"supersede","expectedActiveDatasetId":"<current-id>"}
{"action":"archive","expectedActiveDatasetId":"<current-id>"}
```

Always read current state before a mutation and send its `activeDatasetId` as `expectedActiveDatasetId`. A stale mutation returns HTTP 409 and does not override the deterministic winner. To roll back, activate a prior valid dataset from the history response using the current active ID as the expectation. Archive removes a dataset from public history without deleting its immutable object.

If a malformed object is present, public reads exclude it and return a generic warning while valid data remains available. If storage is unavailable, the API returns a structured 503 and the browser retains its current demo or local state. Exceptional physical deletion must be performed manually in Vercel storage only after preserving the research record; it is intentionally absent from the application API.

## Token Rotation

1. Generate a new high-entropy token and store it in the password manager.
2. Replace `DEMAND_ADMIN_TOKEN` in Preview and Production.
3. Redeploy all environments that accept administrative mutations.
4. Verify that the old token receives the same generic 401 response as a missing token and the new token can perform a non-destructive validation/publication workflow.
5. Remove the old token from any operator environment. Tokens must never enter source control, browser storage, URLs, API bodies, screenshots, analytics or logs.

## Current Acquisition Status

The official Explore retry on October 3, 2026 returned HTTP 429 for the New Jersey five-query cohort recorded in `research/data/demand-acquisition-log.json`. No official CSV was obtained, so nothing was published. The production-ready API may therefore deploy empty and visibly fall back to Demo Data. Do not populate it with the synthetic sample, an undocumented Google endpoint, a proxy bypass, an unattributed repost or fabricated observations.
