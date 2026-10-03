import Papa from "papaparse";

export type ParsedTrends = {
  columns: string[];
  rows: { date: string; values: (number | null)[] }[];
  frequency: "Month" | "Week" | "Day" | "Date";
  warnings: string[];
  demoSample: boolean;
  geographyHint: string;
  mixedGeographies: boolean;
};
export function parseTrends(text: string): ParsedTrends {
  if (text.length > 2_000_000)
    throw new Error("CSV is too large. Maximum size is 2 MB.");
  const header = text.match(/^\s*"?(Month|Week|Day|Date)"?([,;\t])/im);
  if (!header)
    throw new Error(
      "No time-series header found. Export Interest over time with a Day, Week or Month column, not a regional ranking.",
    );
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    delimiter: header[2],
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length)
    throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  const headerIndex = parsed.data.findIndex((r) =>
    /^(month|week|day|date)$/i.test(r[0]?.trim()),
  );
  const fields = parsed.data[headerIndex]?.map((s) => s.trim()) ?? [];
  const indexes = fields.flatMap((f, i) =>
    i > 0 && f && !/^ispartial$/i.test(f) ? [i] : [],
  );
  if (indexes.length < 1 || indexes.length > 5)
    throw new Error(
      "Import one to five search-term columns from a single comparison export.",
    );
  const columns = indexes.map((i) => fields[i]);
  if (new Set(columns).size !== columns.length)
    throw new Error("Duplicate search-term column names.");
  const partial = fields.findIndex((f) => /^ispartial$/i.test(f));
  const warnings = new Set<string>();
  const seen = new Set<string>();
  const rows = parsed.data
    .slice(headerIndex + 1)
    .flatMap((r, n) => {
      if (r.length !== fields.length)
        throw new Error(
          `Row ${n + headerIndex + 2} has an unexpected number of columns.`,
        );
      if (partial >= 0 && /^(true|1)$/i.test(r[partial].trim())) {
        warnings.add("Partial observations were excluded.");
        return [];
      }
      const raw = r[0].trim();
      const match = raw.match(
        /^(\d{4}-\d{2})(?:-(\d{2}))?(?:\s+-\s+\d{4}-\d{2}-\d{2})?$/,
      );
      if (!match)
        throw new Error(
          `Unsupported date '${raw}'. Use an ISO YYYY-MM or YYYY-MM-DD export.`,
        );
      const date = `${match[1]}-${match[2] ?? "01"}`;
      const valid = new Date(`${date}T00:00:00Z`);
      if (
        !Number.isFinite(valid.getTime()) ||
        valid.toISOString().slice(0, 10) !== date
      )
        throw new Error(`Invalid calendar date '${raw}'.`);
      if (seen.has(date)) throw new Error(`Duplicate observation date: ${raw}`);
      seen.add(date);
      const values = indexes.map((i) => {
        const cell = r[i].trim();
        if (["", "<1", "< 1", "NA", "N/A", "-"].includes(cell)) {
          warnings.add(
            "Blank/censored (<1) values remain missing; they are not zero-filled.",
          );
          return null;
        }
        const value = Number(cell);
        if (
          !/^\d+(\.\d+)?$/.test(cell) ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100
        )
          throw new Error(
            `Interest must be between 0 and 100 (row ${n + headerIndex + 2}).`,
          );
        return value;
      });
      return [{ date, values }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length || !rows.some((r) => r.values.some((v) => v !== null)))
    throw new Error("No numeric search-interest observations found.");
  if (rows.length > 10000)
    throw new Error("Import at most 10,000 observations per comparison.");
  const geographies = [
    ...new Set(
      columns
        .map((c) => c.match(/:\s*\(([^)]+)\)\s*$/)?.[1])
        .filter((v): v is string => !!v),
    ),
  ];
  if (geographies.length > 1)
    throw new Error(
      "This file mixes search geographies. Export one geography per comparison so every series has an accurate geographic label.",
    );
  return {
    columns,
    rows,
    warnings: [...warnings],
    frequency: (header[1][0].toUpperCase() +
      header[1].slice(1).toLowerCase()) as ParsedTrends["frequency"],
    demoSample: /DEMONSTRATION|DEMO DATA/i.test(
      text.slice(0, text.indexOf(header[0])),
    ),
    geographyHint: geographies.length === 1 ? geographies[0] : "",
    mixedGeographies: geographies.length > 1,
  };
}
