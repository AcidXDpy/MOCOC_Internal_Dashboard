# Mount Olive Chamber Analytics

Member Intelligence & Outreach Platform for the Mount Olive Area Chamber of Commerce.

## Purpose

This application converts public Chamber directory data and official public economic statistics into a two-sided local intelligence platform for Chamber administrators and individual member businesses.

The platform is designed to help Chamber staff answer operational questions:

- Which member records need renewal follow-up?
- Which listings are contactable today?
- Where is the member base geographically concentrated?
- Which industries and communities are most represented?
- What data must be cleaned up before attendance, outreach, and retention analytics are reliable?

## Current Modules

- Overview
- Members
- Map
- Insights
- Outreach
- Data Quality
- Methodology
- Member Intelligence Center
- Individual Business Intelligence workspace
- Explainable recommendations and feedback states
- Printable business intelligence report
- Public-safe project overview at `/project`

## Data Sources

The current member dataset is normalized from the public Mount Olive Area Chamber/Membee directory. It includes 116 unique public listings as of July 16, 2026. Public fields include business names, categories, descriptions, addresses, phone numbers, websites, and map coordinates when exposed by the directory.

The app also includes local economic context from public sources:

- ACS 2024 5-year indicators for Mount Olive township via Census Reporter, using U.S. Census Bureau data.
- U.S. Census Bureau 2023 County Business Patterns for Morris County employer establishments, employment, and payroll by sector.
- U.S. Census Bureau 2023 ZIP Business Patterns for Budd Lake (07828) and Flanders (07836).
- ACS estimate margins of error, confidence grades, and metric provenance.

Fields such as email, contact names, renewal dates, membership start dates, and internal member status are still synthetic placeholders until the Chamber provides official exports. The UI labels these limitations and does not treat them as verified facts.

## Methodology

Current scoring is deterministic and transparent:

- Profile completeness is based on available public fields.
- Renewal urgency is based on the renewal-date field.
- Outreach priority uses renewal timing, missing contact fields, website coverage, mapping coverage, and outreach-log availability.
- Data Quality Score weights phone, website, map, industry, and renewal-date coverage.
- Business recommendations combine goal alignment, evidence quality, feasibility, measured relevance, and freshness.
- NAICS codes are category-crosswalk suggestions until a business or administrator verifies them.

The app does not train or claim a predictive retention-risk model because labeled renewal outcomes and engagement history are not yet available.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts
- React Leaflet / Leaflet
- Vercel server function for approved Census API requests
- PostgreSQL migration and row-level access-control contract for the production persistence phase
- Local TypeScript last-known-good public-data snapshots and clearly labeled synthetic placeholders

The current deployment remains a static preview: authentication and a production database are not connected. Member mode is labeled accordingly and must not receive confidential data until the migration, identity provider, and authenticated API adapter are deployed.

## Run Locally

Install Node.js with npm, then run:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Run checks:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

Initialize all 116 intelligence profiles and print an import summary:

```bash
npm run data:init
```

Refresh approved Census variables after setting `CENSUS_API_KEY`:

```bash
npm run data:refresh-census
```

## Deployment

The app is a Vite single-page application. Vercel should use:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` rewrites direct route visits such as `/project` back to the SPA entry point.

Set server-only environment variables from `.env.example`. Never expose `CENSUS_API_KEY` through a `VITE_` variable.

## Known Limitations

- Public directory data is not the same as an official internal Chamber roster.
- Attendance, outreach, renewal history, and staff notes require official Chamber exports or a future database.
- Renewal dates and member lifecycle fields are placeholders until verified source data exists.
- Sector benchmarking maps Chamber categories to broad NAICS-style sectors for descriptive comparison only.
- Business profile edits and recommendation feedback are preview state until authenticated persistence is connected.
- Only the two core ZIPs currently have checked-in ZBP context.
- The NAICS crosswalk is a suggestion queue, not a substitute for human classification review.

Detailed architecture, methods, source notes, recommendation logic, and privacy boundaries are in `docs/`.
