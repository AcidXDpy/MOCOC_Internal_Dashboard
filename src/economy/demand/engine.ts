import Papa from "papaparse";
import {
  categories,
  type DemandBatch,
  type DemandAnalysis,
  type CategorySummary,
  type SortKey,
  type DemandPoint,
} from "./types";
import { localSupply } from "./supply";

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const offsetMonth = (month: string, delta: number) =>
  new Date(
    Date.UTC(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)) - 1 + delta,
      1,
    ),
  )
    .toISOString()
    .slice(0, 7);
function zScores(values: number[]) {
  const avg = mean(values);
  if (avg === null || values.length < 2) return values.map(() => null);
  const sd = Math.sqrt(
    values.reduce((sum, n) => sum + (n - avg) ** 2, 0) / values.length,
  );
  return values.map((n) => (sd > 1e-10 ? (n - avg) / sd : null));
}
export function gapScores(demand: number[], supply: number[]) {
  if (demand.length !== supply.length)
    throw new Error("Comparison cohorts must match");
  const dz = zScores(demand),
    sz = zScores(supply);
  return dz.map((v, i) => (v === null || sz[i] === null ? null : v - sz[i]!));
}
export function percentageChange(current: number | null, prior: number | null) {
  return current === null || prior === null || prior <= 0
    ? null
    : (current / prior - 1) * 100;
}
export function monthly(points: DemandPoint[]) {
  const groups = new Map<string, number[]>();
  points.forEach((p) => {
    const key = p.date.slice(0, 7);
    const values = groups.get(key) ?? [];
    if (p.interest !== null) values.push(p.interest);
    groups.set(key, values);
  });
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date: `${date}-01`, interest: mean(values) }));
}
export function completeMonth(
  points: DemandPoint[],
  frequency: DemandBatch["frequency"],
  month: string,
) {
  if (month >= new Date().toISOString().slice(0, 7)) return false;
  const samples = points.filter((p) => p.date.startsWith(month));
  if (!samples.length || samples.some((p) => p.interest === null)) return false;
  if (frequency === "Month") return samples.length === 1;
  if (frequency === "Date") return false; // An unspecified sampling interval cannot certify coverage.
  const days = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  if (frequency === "Day")
    return new Set(samples.map((p) => p.date)).size === days;
  const weekday = new Date(`${points[0].date}T00:00:00Z`).getUTCDay();
  const expected = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  ).filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === weekday);
  return (
    samples.length === expected.length &&
    expected.every((date) => samples.some((p) => p.date === date))
  );
}
export function summarize(batch: DemandBatch, months: number): DemandAnalysis {
  const histories = batch.series.map((s) => monthly(s.points));
  const end =
    histories
      .flat()
      .map((p) => p.date.slice(0, 7))
      .sort()
      .at(-1) ?? "";
  if (!end)
    return {
      rows: [],
      start: "",
      end: "",
      commonMonths: 0,
      gapReason: "No imported observations.",
    };
  const start = offsetMonth(end, 1 - months);
  const common = [...new Set(histories.flat().map((p) => p.date))].filter(
    (date) =>
      date.slice(0, 7) >= start &&
      histories.every((h) =>
        h.some((p) => p.date === date && p.interest !== null),
      ),
  );
  const rows: CategorySummary[] = batch.series.map((series, i) => {
    const history = histories[i];
    const at = (month: string) =>
      history.find((p) => p.date.slice(0, 7) === month)?.interest ?? null;
    const six = Array.from({ length: 6 }, (_, t) => {
      const month = offsetMonth(end, t - 5);
      return completeMonth(series.points, batch.frequency, month)
        ? at(month)
        : null;
    });
    const businessCount = localSupply.filter(
      (b) => b.category === series.category,
    ).length;
    const values = history
      .filter((p) => common.includes(p.date))
      .flatMap((p) => (p.interest === null ? [] : [p.interest]));
    const own = history
      .filter((p) => p.date.slice(0, 7) >= start)
      .flatMap((p) => (p.interest === null ? [] : [p.interest]));
    return {
      category: series.category,
      name: categories.find((c) => c.id === series.category)!.name,
      query: series.query,
      currentInterest: at(end),
      averageInterest: mean(common.length >= 2 ? values : own),
      change3m: six.every((v) => v !== null)
        ? percentageChange(
            mean(six.slice(3) as number[]),
            mean(six.slice(0, 3) as number[]),
          )
        : null,
      businessCount,
      supplyShare: localSupply.length
        ? (businessCount / localSupply.length) * 100
        : 0,
      demandGap: null,
      demandZ: null,
      supplyZ: null,
      signal: "Not comparable",
      history,
      monthsObserved: own.length,
    };
  });
  let gapReason = !batch.comparable
    ? "This import has not confirmed a shared comparison scale. Independent 0-100 exports cannot be ranked against each other."
    : rows.length < 2
      ? "At least two categories from one shared-scale comparison export are required."
      : common.length < 2
        ? "At least two common observed months are required; missing data is not filled."
        : null;
  if (!gapReason) {
    const demand = rows.map((r) => r.averageInterest!),
      supply = rows.map((r) => r.supplyShare);
    const gaps = gapScores(demand, supply),
      dz = zScores(demand),
      sz = zScores(supply);
    if (gaps.some((g) => g === null))
      gapReason =
        "Demand or supply has no cross-category variation; the standardized gap is undefined.";
    else
      rows.forEach((r, i) => {
        r.demandGap = gaps[i];
        r.demandZ = dz[i];
        r.supplyZ = sz[i];
        r.signal =
          gaps[i]! >= 0.75
            ? "High interest / lower supply"
            : gaps[i]! <= -0.75
              ? "Supply-heavy"
              : "Balanced";
      });
  }
  return { rows, start, end, commonMonths: common.length, gapReason };
}
export function sortSummaries(
  rows: CategorySummary[],
  key: SortKey,
  direction: "asc" | "desc",
) {
  return [...rows].sort((a, b) => {
    const x = a[key],
      y = b[key];
    if (x === null) return y === null ? a.name.localeCompare(b.name) : 1;
    if (y === null) return -1;
    return (
      (direction === "asc" ? x - y : y - x) || a.name.localeCompare(b.name)
    );
  });
}
export function interpretation(row: CategorySummary) {
  if (row.demandGap === null)
    return "This series can describe interest over time, but does not support a cross-category demand gap. A shared-scale export, common observations and variation in both measures are needed.";
  if (row.demandGap >= 0.75)
    return `${row.name} has higher standardized search interest relative to its share of represented local listings (gap ${row.demandGap.toFixed(2)}). This is worth investigating, not proof of unmet demand; directory coverage and regional search geography may explain the difference.`;
  if (row.demandGap <= -0.75)
    return `${row.name} has more represented supply relative to its standardized search interest (gap ${row.demandGap.toFixed(2)}). This is a supply-heavy signal, not evidence that businesses are unviable or that the market is saturated.`;
  return `${row.name} has a relatively balanced standardized signal (gap ${row.demandGap.toFixed(2)}). Balanced does not imply market equilibrium, sufficient competition or equal service access.`;
}
export const fmt = (v: number | null, digits = 1) =>
  v === null ? "Unavailable" : v.toFixed(digits);
export const signed = (v: number | null, digits = 1) =>
  v === null ? "Unavailable" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
export function exportAnalysis(batch: DemandBatch, analysis: DemandAnalysis) {
  return Papa.unparse(
    analysis.rows.map((r) => ({
      category: r.name,
      query: r.query,
      current_interest: r.currentInterest,
      average_interest: r.averageInterest,
      change_3m_percent: r.change3m,
      business_count: r.businessCount,
      supply_share_percent: r.supplyShare,
      demand_gap: r.demandGap,
      signal: r.signal,
      geography: batch.geography,
      date_start: analysis.start,
      date_end: analysis.end,
      source:
        batch.verification === "verified-api"
          ? "Verified API Data"
          : batch.demoSample
            ? "Demo Data"
            : "This Browser",
      import_date: batch.importedAt,
      common_months: analysis.commonMonths,
      gap_limitation:
        analysis.gapReason ?? "Descriptive signal, not causal proof",
      supply_scope:
        "Public directory, TIGER 2024 township-boundary matched coordinates; incomplete and coordinates unverified",
      supply_snapshot: "2026-07-16",
    })),
    { escapeFormulae: true },
  );
}
