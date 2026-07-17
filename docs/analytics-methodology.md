# Analytics Methodology

## Confidence Grades

ACS margins of error use the Census Bureau's 90% confidence convention. The coefficient of variation is:

```text
standard error = margin of error / 1.645
coefficient of variation = absolute(standard error / estimate) * 100
```

- High confidence: CV at or below 12% and data age at most two years.
- Moderate confidence: CV at or below 25% and data age at most three years.
- Directional: CV at or below 40%.
- Insufficient data: non-finite values or CV above 40%.

Direct administrative counts without sampling error receive a high-confidence data-coverage label. This does not make an inferred business conclusion high confidence.

## Derived Percentages

For a numerator that is a subset of its denominator:

```text
percentage = numerator / denominator * 100
MOE percentage = sqrt(MOE numerator^2 - percentage_ratio^2 * MOE denominator^2) / denominator * 100
```

The calculation floors a negative radicand at zero and records the transformation. This is an ACS ratio approximation, not a substitute for a published percentage variable where one is available.

## Practical Significance

An area difference becomes an insight only when it exceeds both a business-rule threshold and half the local margin of error. Current percentage-point thresholds are three points for household composition and five points for housing tenure. Recommendations are suppressed at `Insufficient data` confidence.

## Location Quotient

```text
LQ = (ZIP sector establishments / ZIP total establishments)
     / (county sector establishments / county total establishments)
```

An LQ of 1.2 or higher can trigger a competition-review recommendation. It is a broad-sector concentration signal, not a count of direct competitors. ZBP excludes most nonemployers.

## Profile Completeness

Public fields contribute up to 70 points. Business-selected goals contribute 10 points. The remaining 20 points are reserved for human verification and structured business-supplied fields once persistence is connected. The score measures data coverage only.

## Recommendation Ranking

The score is capped at 100 and is the sum of:

- Goal alignment: 25 selected, 12 suggested, 4 otherwise; profile readiness receives 15.
- Evidence quality: 22 high, 16 moderate, 9 directional, 0 insufficient.
- Feasibility: 15 low effort, 10 moderate, 4 high.
- Measured relevance: rule-specific, normally 12 to 20.
- Data freshness: 10 for the current configured snapshot.

The interface exposes each contribution. Ranking affects order only; it does not estimate revenue or causal impact.

## Validation

Unit tests cover ratio/MOE calculations, CV grading, location quotient, percentile rank, deterministic profile generation, NAICS matching, recommendation generation, and authorization. Census ingestion tests mock retries, parsing, provenance redaction, and cache behavior.
