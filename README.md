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

The current dataset is normalized from the provided MOCOC directory scrape. The scrape contains member names, categories, descriptions, addresses, and some phone numbers. Fields such as email, contact names, renewal details, and exact coordinates are incomplete or demo-derived, so the dashboard intentionally surfaces those gaps as readiness signals.

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
- Local TypeScript mock data

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
