# Business Intelligence Expansion

## Repository Audit

The project is a React 18 single-page application built with Vite, TypeScript, Tailwind CSS, Recharts, React Leaflet, and Leaflet. It deploys to Vercel as static assets. Before this expansion it had no backend, database, ORM, authentication, authorization, API routes, migrations, scheduled jobs, or environment-variable contract.

The existing data layer contains 116 stable member IDs in `src/data/members.ts`. Public directory fields include business name, Chamber category, description, address, phone, website, and coordinates where listed. Contact names, email, membership dates, renewal dates, and status are explicitly marked synthetic. Attendance and outreach schemas exist, but their datasets are empty.

Existing Chamber functions were preserved: overview, member directory, map, regional insights, outreach queue, data quality, methodology, and public project overview.

## Implemented Product Slice

The expansion adds:

- A deterministic intelligence profile for every member ID.
- Suggested 2022 NAICS classifications with confidence, evidence, and review status.
- Structured business goals and member-side goal selection.
- ACS 2024 evidence with estimates, margins of error, derivation metadata, and confidence grades.
- County Business Patterns 2023 sector context for Morris County.
- ZIP Business Patterns 2023 employer-establishment context for 07828 and 07836.
- Evidence-backed insight templates and a recommendation engine.
- Recommendation factor contributions, limitations, versioning, and feedback states.
- An administrator member-intelligence table across all 116 records.
- A member workspace with local market, industry, network, profile, recommendations, and printable report views.
- A server-only Census client with validation, timeouts, retries, caching, provenance, and mocked tests.
- A PostgreSQL migration for the durable production model and row-level access policies.

## Architecture

```text
Public directory snapshot ----> profile normalization ----> NAICS suggestion
                                         |                         |
ACS / CBP / ZBP evidence -----> evidence registry --------> insights
                                         |                         |
Business-selected goals -----------------+---------------> recommendations
                                                                  |
                                                member UI / admin review / report
```

`src/intelligence/engine.ts` is deterministic and does not depend on an LLM. `api/_lib/census.ts` is server-only and reads `CENSUS_API_KEY`; no key is included in the browser bundle. The checked-in public-data snapshot remains available when an external refresh fails.

## Production Boundary

The current Vercel deployment is still a static preview. It does not authenticate users or persist profile edits and recommendation feedback. Member mode is labeled accordingly. The authorization helpers and SQL row-level policies are testable contracts, but secure member accounts require:

1. A managed PostgreSQL database.
2. An identity provider that verifies JWTs server-side.
3. An API layer that sets `app.current_user_id` only from a verified token.
4. Application of `database/migrations/001_business_intelligence.sql`.
5. Replacement of runtime-generated records with database reads and writes.

Do not remove the preview label until those five items are deployed and isolation tests pass against the live API.

## Routes and Navigation

- `/` opens the Chamber administrator workspace.
- `/business` opens the member intelligence preview.
- `/project` opens the public-safe project overview.
- `Business Intel` shows the administrator intelligence center.
- `Member Preview` shows an individual business workspace.

## Initialization

```bash
npm run data:init
```

The command processes all member IDs, reports profile/NAICS/geocode/insight/recommendation coverage, and exits nonzero if a record fails. Runtime generation preserves existing member IDs. Database persistence is intentionally not claimed until the migration and database adapter are connected.

## Data Refresh

Set `CENSUS_API_KEY` and run:

```bash
npm run data:refresh-census
```

The command uses the server client, retrieves approved variable sets, and writes `data/cache/census-latest.json` only after a successful response. A failure leaves the previous snapshot unchanged.

Annual datasets should be checked after release, not polled daily. A production scheduler should record each run in `data_refresh_job`, preserve the last successful version, and regenerate affected insights only after validation.

## Suggested Next Phase

Connect authentication and PostgreSQL first. Then add administrator approval for NAICS/geocoding, durable profile edits and feedback, Census geography lookup for every verified address, nonemployer statistics, authorized Chamber event/referral imports, and background refresh jobs. Predictive renewal or engagement models should wait for substantially more labeled first-party history.
