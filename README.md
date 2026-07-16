# Chamber Engagement Command Center

Internal analytics dashboard for the Mount Olive Area Chamber of Commerce member base.

## Purpose

This MVP helps Chamber leadership see the current member directory clearly, identify missing member data, and prepare for future engagement and retention analytics.

The Chamber problem this project is aimed at:

- Members do not always engage or attend events.
- Low event participation means members may not experience Chamber value.
- Members who do not see value are more likely to become dissatisfied or not renew.
- Chamber leadership needs cleaner data before engagement, outreach, and churn-risk analysis can be meaningful.

## Phase 1 MVP

The app is an internal dashboard, not a public website or member portal. It includes:

- Executive Overview
- Member Directory
- Member Map
- Chamber Insights
- Engagement Preparation
- Action Center

The current member dataset is normalized from the public Mount Olive Area Chamber/Membee directory. It includes 116 unique public listings as of July 16, 2026. Public fields include business names, categories, descriptions, addresses, phone numbers, websites, and map coordinates when exposed by the directory.

The app also includes local economic context from public sources:

- ACS 2024 5-year indicators for Mount Olive township via Census Reporter, using U.S. Census Bureau data.
- U.S. Census Bureau 2023 County Business Patterns for Morris County employer establishments, employment, and payroll by sector.

Fields such as email, contact names, renewal dates, membership start dates, and internal member status are still synthetic placeholders until the Chamber provides official exports. The dashboard surfaces those gaps instead of treating them as verified facts.

## Roadmap

Phase 1: Internal Chamber-facing dashboard and member data cleanup.

Phase 2: Engagement pilot with 5-7 inactive or at-risk businesses using attendance and outreach tracking.

Phase 3: Impact report, public narrative, and media coverage based on measurable engagement results.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts
- React Leaflet / Leaflet
- Local TypeScript public-data snapshots and clearly labeled synthetic placeholders

No backend, authentication, payments, or production database are included in this MVP.

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

Note: during initial setup on this machine, the bundled `node` command was blocked through the app PATH and `npm` was not available globally. Installing Node.js from the official installer or repairing PATH should resolve that for normal local development.
