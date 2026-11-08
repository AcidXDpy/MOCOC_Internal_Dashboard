import csv from "../../../research/data/google-trends-new-jersey-2021-10-17_2026-10-18.csv?raw";
import { parseTrends } from "./csv";
import type { DemandBatch } from "./types";

const parsed = parseTrends(csv);
const ids = ["restaurants", "coffee", "fitness", "home", "childcare"] as const;
export const snapshot: DemandBatch = {
  id: "nj-trends-2026-10-18",
  name: "Google Trends export",
  geography: "New Jersey",
  source: "google-trends-csv",
  filename: "multiTimeline.csv",
  importedAt: "2026-10-18T14:19:47.000Z",
  comparable: true,
  demoSample: false,
  frequency: parsed.frequency,
  warnings: [...parsed.warnings, "Retrieved October 18, 2026. The final partial month is excluded."],
  series: ids.map((category, i) => ({
    category,
    query: parsed.columns[i].split(":")[0],
    points: parsed.rows.filter(r => r.date < "2026-10-01").map(r => ({date: r.date, interest: r.values[i]})),
  })),
};
