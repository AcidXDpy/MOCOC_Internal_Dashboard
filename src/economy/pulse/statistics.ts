import type {
  DisplayMode,
  GeoId,
  Observation,
  PulseDataset,
  PulseUnit,
} from "./types";

export const geoColors: Record<GeoId, string> = {
  "mount-olive": "#15816e",
  morris: "#d05b48",
  "new-jersey": "#518bb0",
};
export function observedAt(dataset: PulseDataset, geo: GeoId, year: number) {
  return dataset.observations.find(
    (o) => o.geographyId === geo && o.year === year,
  );
}
export function latestObserved(dataset: PulseDataset, geo: GeoId) {
  return dataset.observations
    .filter((o) => o.geographyId === geo && o.value !== null)
    .sort((a, b) => b.year - a.year)[0];
}
export function period(o: Observation | undefined) {
  if (!o) return "No observation";
  const start = o.periodStart.slice(0, 4);
  return start === String(o.year) ? String(o.year) : `${start}-${o.year}`;
}
export function formatValue(
  value: number | null | undefined,
  unit: PulseUnit | "index",
  compact = false,
) {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return (
    new Intl.NumberFormat("en-US", {
      ...(unit === "USD" ? { style: "currency", currency: "USD" } : {}),
      notation: compact ? "compact" : "standard",
      maximumFractionDigits:
        unit === "percent" || unit === "index" || compact ? 1 : 0,
    }).format(value) + (unit === "percent" ? "%" : "")
  );
}
export function indexed(
  value: number | null | undefined,
  base: number | null | undefined,
) {
  return value == null || base == null || base <= 0
    ? null
    : (value / base) * 100;
}
export function comparisonRows(
  dataset: PulseDataset,
  geos: GeoId[],
  start: number,
  mode: DisplayMode,
) {
  const years = [...new Set(dataset.observations.map((o) => o.year))]
    .filter((y) => y >= start)
    .sort((a, b) => a - b);
  const baseYear = years[0];
  return years.map((year) => ({
    year,
    ...Object.fromEntries(
      geos.map((geo) => {
        const o = observedAt(dataset, geo, year);
        return [
          geo,
          mode === "index"
            ? indexed(o?.value, observedAt(dataset, geo, baseYear)?.value)
            : (o?.value ?? null),
        ];
      }),
    ),
  })) as ({ year: number } & Record<GeoId, number | null>)[];
}
