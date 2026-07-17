# Recommendation Engine

The engine is deterministic, versioned, and works without an LLM. Version `1.0.0` uses only structured public directory fields, selected business goals, ACS evidence, CBP/ZBP context, and a documented category crosswalk.

## Current Rules

- Profile readiness: triggers below 80% completeness.
- Digital visibility: triggers when the public listing has no website.
- Family-market test: triggers only for family-relevant categories when the local household-with-children share clears the practical-difference and confidence thresholds.
- Referral introductions: triggers when at least three listings exist in complementary categories.
- Housing-tenure messaging: triggers for home-related categories when the local owner-occupied share differs materially from the county.
- Differentiation review: triggers when a supported ZIP's broad-sector location quotient is at least 1.2.

Each recommendation contains rationale, action steps, effort, potential-impact category, confidence, time horizon, limitation, evidence references, ranking factors, validity dates, status, and engine version.

## Suppression

Rules do not run from unavailable values. Recommendations at `Insufficient data` confidence are removed. Category matches describe compatibility only and never claim an existing relationship. Establishment counts are not labeled competitors. Household metrics never imply purchase intent.

## Feedback

The UI supports useful, not relevant, already doing this, completed, revisit later, and dismissed. Feedback is local preview state in the current static deployment. In production it belongs in `recommendation_feedback`, scoped to the authenticated business. Dismissed rules should be down-ranked or suppressed for that business after product review; feedback must not be described as proof of economic impact.

## Version Changes

Any threshold, factor weight, crosswalk, template, or evidence requirement change increments the engine version. Existing recommendations remain auditable. Administrators should be able to disable a rule and record a reason before regeneration.
