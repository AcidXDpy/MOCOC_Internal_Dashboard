# Mount Olive Chamber Analytics

Member Intelligence & Outreach Platform for the Mount Olive Area Chamber of Commerce.

## Purpose

This application converts public Chamber directory data into a practical internal analytics system for membership review, renewal follow-up, outreach prioritization, geographic analysis, and data-quality management.

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
- Public-safe project overview at `/project`

## Data Sources

The current member dataset is normalized from the public Mount Olive Area Chamber/Membee directory. It includes 116 unique public listings as of July 16, 2026. Public fields include business names, categories, descriptions, addresses, phone numbers, websites, and map coordinates when exposed by the directory.

The app also includes local economic context from public sources:

- ACS 2024 5-year indicators for Mount Olive township via Census Reporter, using U.S. Census Bureau data.
- U.S. Census Bureau 2023 County Business Patterns for Morris County employer establishments, employment, and payroll by sector.

Fields such as email, contact names, renewal dates, membership start dates, and internal member status are still synthetic placeholders until the Chamber provides official exports. The UI labels these limitations and does not treat them as verified facts.

## Methodology

Current scoring is deterministic and transparent:

- Profile completeness is based on available public fields.
- Renewal urgency is based on the renewal-date field.
- Outreach priority uses renewal timing, missing contact fields, website coverage, mapping coverage, and outreach-log availability.
- Data Quality Score weights phone, website, map, industry, and renewal-date coverage.

The app does not train or claim a predictive retention-risk model because labeled renewal outcomes and engagement history are not yet available.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts
- React Leaflet / Leaflet
- Local TypeScript public-data snapshots and clearly labeled synthetic placeholders

No backend, authentication, payments, or production database are included in this version.

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
```

## Deployment

The app is a Vite single-page application. Vercel should use:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` rewrites direct route visits such as `/project` back to the SPA entry point.

## Known Limitations

- Public directory data is not the same as an official internal Chamber roster.
- Attendance, outreach, renewal history, and staff notes require official Chamber exports or a future database.
- Renewal dates and member lifecycle fields are placeholders until verified source data exists.
- Sector benchmarking maps Chamber categories to broad NAICS-style sectors for descriptive comparison only.
