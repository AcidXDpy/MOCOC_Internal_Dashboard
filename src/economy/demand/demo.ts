import { categories, type DemandBatch } from "./types";

export const demoBatch: DemandBatch = {
  id: "demo-v1",
  name: "Demonstration comparison",
  geography: "Morris County, NJ (demo)",
  source: "demo",
  importedAt: null,
  filename: null,
  comparable: true,
  demoSample: true,
  frequency: "Month",
  warnings: [
    "Synthetic search signals; no Google observations. Supply uses real public directory records.",
  ],
  series: categories.map((c, i) => ({
    category: c.id,
    query: c.name.toLowerCase(),
    points: Array.from({ length: 24 }, (_, t) => ({
      date: new Date(Date.UTC(2024, 9 + t, 1)).toISOString().slice(0, 10),
      interest: Math.round(
        Math.max(
          5,
          Math.min(
            100,
            [70, 46, 41, 54, 36, 48, 57, 25, 39, 66][i] +
              [0.2, 0.35, 0.9, 0.1, 0.2, 1, 0.85, 0.1, 0.3, -0.4][i] * t +
              7 * Math.sin(((t + i) * Math.PI) / 6),
          ),
        ),
      ),
    })),
  })),
};
