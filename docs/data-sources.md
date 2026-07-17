# Data Sources

## Chamber Directory

- Source: public Mount Olive Area Chamber/Membee directory pages.
- Snapshot: July 16, 2026.
- Records: 116 unique public listings.
- Public fields: name, category, description, address, phone, website, and coordinates when exposed.
- Limitation: this is not an official internal roster export. Synthetic lifecycle/contact placeholders remain explicitly marked.

## American Community Survey

- Organization: U.S. Census Bureau.
- Product: ACS 2024 five-year detailed tables, covering 2020-2024.
- Geography: Mount Olive township (`06000US3402749080`) and Morris County (`05000US34027`).
- Tables: B01003, B01002, B19013, B19301, B15003, B17001, B05002, B11005, B25003, B28002, B08013, and B08006.
- Retrieval: July 17, 2026 through Census Reporter using original Census Bureau data.
- UI treatment: estimate, margin of error, derivation, dataset year, geography, and confidence are shown.

ACS values are period estimates, not real-time measurements or exact counts. Small-area estimates may be unstable.

## County Business Patterns

- Organization: U.S. Census Bureau.
- Product: 2023 County Business Patterns county file.
- Geography: Morris County, New Jersey.
- Use: employer establishments, employment, payroll, and broad-sector shares.

## ZIP Business Patterns

- Organization: U.S. Census Bureau.
- Product: 2023 ZIP Business Patterns detail file.
- ZIPs: 07828 Budd Lake and 07836 Flanders.
- Use: employer-establishment counts by broad NAICS sector.
- Source file: `https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23detail.zip`.

CBP/ZBP omit most nonemployer businesses and do not represent a complete competitor list. Suppressed values must not be reverse engineered.

## Dataset Configuration

Latest supported years are centralized in `api/_lib/census.ts`: ACS 2024 and CBP/ZBP 2023. A refresh must validate metadata before changing a year. Different products must not be assumed to share a release year.

## Failure Behavior

External refresh failures do not erase the checked-in last-known-good snapshot. The refresh script exits nonzero, reports the failure, and leaves the existing file unchanged. Production refresh jobs should store request metadata and error status without secrets.
