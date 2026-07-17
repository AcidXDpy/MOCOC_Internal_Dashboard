import type { ConfidenceGrade, EvidenceMetric } from "./types";

const Z_90 = 1.645;

export function coefficientOfVariation(
  estimate: number,
  marginOfError: number | null,
) {
  if (!marginOfError || estimate === 0) return null;
  return Math.abs(marginOfError / Z_90 / estimate) * 100;
}

export function derivePercentage(
  numerator: number,
  numeratorMarginOfError: number,
  denominator: number,
  denominatorMarginOfError: number,
) {
  if (denominator <= 0) return { estimate: 0, marginOfError: null };
  const ratio = numerator / denominator;
  const radicand =
    numeratorMarginOfError ** 2 - ratio ** 2 * denominatorMarginOfError ** 2;
  const margin = Math.sqrt(Math.max(0, radicand)) / denominator;
  return { estimate: ratio * 100, marginOfError: margin * 100 };
}

export function gradeConfidence(
  estimate: number,
  marginOfError: number | null,
  dataAgeYears = 2,
): ConfidenceGrade {
  if (!Number.isFinite(estimate)) return "Insufficient data";
  const cv = coefficientOfVariation(estimate, marginOfError);
  if (cv === null)
    return dataAgeYears <= 2 ? "Moderate confidence" : "Directional";
  if (cv <= 12 && dataAgeYears <= 2) return "High confidence";
  if (cv <= 25 && dataAgeYears <= 3) return "Moderate confidence";
  if (cv <= 40) return "Directional";
  return "Insufficient data";
}

export function confidenceRank(confidence: ConfidenceGrade) {
  return {
    "High confidence": 4,
    "Moderate confidence": 3,
    Directional: 2,
    "Insufficient data": 1,
  }[confidence];
}

export function practicalDifference(local: EvidenceMetric, minimumPoints = 3) {
  if (local.comparisonEstimate === undefined) return false;
  const difference = Math.abs(local.estimate - local.comparisonEstimate);
  const combinedMargin = (local.marginOfError ?? 0) * 0.5;
  return difference >= Math.max(minimumPoints, combinedMargin);
}

export function locationQuotient(
  localSector: number,
  localTotal: number,
  benchmarkSector: number,
  benchmarkTotal: number,
) {
  if (localTotal <= 0 || benchmarkTotal <= 0 || benchmarkSector <= 0)
    return null;
  return localSector / localTotal / (benchmarkSector / benchmarkTotal);
}

export function percentileRank(value: number, values: number[]) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const below = valid.filter((item) => item < value).length;
  const equal = valid.filter((item) => item === value).length;
  return ((below + equal * 0.5) / valid.length) * 100;
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
