import { categories, type DemandBatch } from "./types";
export const storageKey = "mococ.local-demand.v1";
export function validateImports(value: unknown): DemandBatch[] {
  if (!Array.isArray(value) || value.length > 12)
    throw new Error("Saved imports have an unsupported format.");
  const ids = new Set<string>();
  for (const item of value as DemandBatch[]) {
    if (
      !item ||
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      typeof item.geography !== "string" ||
      !item.geography.trim() ||
      item.source !== "google-trends-csv" ||
      typeof item.importedAt !== "string" ||
      typeof item.comparable !== "boolean" ||
      typeof item.demoSample !== "boolean" ||
      !Array.isArray(item.warnings) ||
      !item.warnings.every((w) => typeof w === "string") ||
      !["Month", "Week", "Day", "Date"].includes(item.frequency) ||
      !Array.isArray(item.series) ||
      !item.series.length ||
      item.series.length > 5
    )
      throw new Error("Saved import metadata is invalid.");
    ids.add(item.id);
    const mapped = new Set<string>();
    for (const series of item.series) {
      if (
        !categories.some((c) => c.id === series.category) ||
        mapped.has(series.category) ||
        typeof series.query !== "string" ||
        !Array.isArray(series.points) ||
        !series.points.length ||
        series.points.length > 10000
      )
        throw new Error("Saved series is invalid.");
      mapped.add(series.category);
      const dates = new Set<string>();
      for (const p of series.points) {
        if (
          !p ||
          typeof p.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
          dates.has(p.date) ||
          !Number.isFinite(Date.parse(p.date)) ||
          new Date(p.date).toISOString().slice(0, 10) !== p.date ||
          (p.interest !== null &&
            (!Number.isFinite(p.interest) ||
              p.interest < 0 ||
              p.interest > 100))
        )
          throw new Error("Saved observation is invalid.");
        dates.add(p.date);
      }
    }
  }
  return value as DemandBatch[];
}
export function readImports(): { imports: DemandBatch[]; error: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    return { imports: raw ? validateImports(JSON.parse(raw)) : [], error: "" };
  } catch {
    return {
      imports: [],
      error:
        "Saved imports could not be read. They have not been overwritten. Export/restore your browser data before replacing it.",
    };
  }
}
export function saveImports(imports: DemandBatch[]) {
  validateImports(imports);
  try {
    localStorage.setItem(storageKey, JSON.stringify(imports));
  } catch {
    throw new Error(
      "Import could not be saved in this browser. Storage may be disabled or full. Existing imports were not changed.",
    );
  }
}
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
