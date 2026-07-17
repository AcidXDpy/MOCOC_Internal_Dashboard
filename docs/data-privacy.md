# Data Privacy and Responsible Use

The platform uses public business listings and aggregate government statistics. It must not infer an individual's race, health, religion, immigration status, political view, or other sensitive characteristic. It must not identify residents, facilitate exclusionary targeting, or present demographic composition as a judgment about community quality.

Member users may view only their assigned business and anonymized aggregates. Chamber administrators may view all member records. Analysts are read-only. The SQL migration enforces these boundaries with row-level policies after a verified API sets the transaction user. Hiding navigation is never treated as authorization.

The current static deployment has no authentication and is labeled as a preview. It must not receive confidential business data, private performance data, passwords, or internal notes. The member selector exists for staff evaluation only.

Public project materials must not expose member names, phone numbers, exact addresses, internal status, private feedback, or another business's performance. Comparison groups must be suppressed below a configurable minimum size before first-party confidential metrics are introduced.

Logs may contain request IDs, dataset versions, geography IDs, row counts, rule versions, and error categories. Logs must not contain API keys, raw passwords, complete confidential records, or unredacted authorization tokens.
