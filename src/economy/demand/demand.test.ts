import { describe, expect, it } from "vitest";
import { parseTrends } from "./csv";
import {
  gapScores,
  percentageChange,
  sortSummaries,
  summarize,
} from "./engine";
import { normalizeCategory, localSupply, inTownship } from "./supply";
import { demoBatch } from "./demo";

describe("Local Demand research calculations", () => {
  it("uses township geometry instead of mailing city and excludes unknown locations", () => {
    expect(inTownship(40.873, -74.742)).toBe(true);
    expect(inTownship(40.8, -74.48)).toBe(false);
    expect(inTownship(undefined, undefined)).toBe(false);
    expect(inTownship(NaN, -74.742)).toBe(false);
  });
  it("standardizes demand against supply with population z-scores", () => {
    const gaps = gapScores([90, 10], [1, 9]);
    expect(gaps).toEqual([2, -2]);
    expect(gapScores([10, 10], [1, 2])).toEqual([null, null]);
    expect(gapScores([90], [1])).toEqual([null]);
  });
  it("does not fabricate growth for a zero or missing baseline", () => {
    expect(percentageChange(12, 10)).toBeCloseTo(20);
    expect(percentageChange(0, 10)).toBe(-100);
    expect(percentageChange(5, 0)).toBeNull();
    expect(percentageChange(null, 10)).toBeNull();
  });
  it("does not calculate three-month growth from sparse daily or open-month observations", () => {
    const series = [
      {
        ...demoBatch.series[0],
        points: Array.from({ length: 6 }, (_, i) => ({
          date: `2025-0${i + 1}-01`,
          interest: i === 5 ? 100 : 10,
        })),
      },
    ];
    expect(
      summarize({ ...demoBatch, frequency: "Day", series }, 12).rows[0]
        .change3m,
    ).toBeNull();
  });
  it("normalizes conservatively without treating general healthcare as dentistry", () => {
    expect(normalizeCategory("Italian Restaurant", "Example")).toBe(
      "restaurants",
    );
    expect(normalizeCategory("Uncategorized", "Longhorn Steakhouse")).toBe(
      "restaurants",
    );
    expect(normalizeCategory("Personal Services", "Example Hair Salon")).toBe(
      "beauty",
    );
    expect(
      normalizeCategory("Health Care Services", "Example Clinic"),
    ).toBeNull();
    expect(normalizeCategory("", "Unknown")).toBeNull();
    expect(new Set(localSupply.map((b) => b.member_id)).size).toBe(
      localSupply.length,
    );
    expect(localSupply.every((b) => b.data_source === "public_directory")).toBe(
      true,
    );
  });
  it("demo uses real supply and does not synthesize missing imported demand", () => {
    const summary = summarize(demoBatch, 12);
    expect(summary.rows).toHaveLength(10);
    expect(summary.rows.reduce((n, r) => n + r.businessCount, 0)).toBe(
      localSupply.length,
    );
    const empty = summarize({ ...demoBatch, series: [] }, 12);
    expect(empty.rows).toHaveLength(0);
    const single = summarize(
      {
        ...demoBatch,
        series: demoBatch.series.slice(0, 1),
        source: "google-trends-csv",
      },
      12,
    );
    expect(single.rows[0].demandGap).toBeNull();
  });
  it("suppresses gaps for independent scales and sorts nulls last", () => {
    const { rows } = summarize({ ...demoBatch, comparable: false }, 12);
    expect(rows.every((r) => r.demandGap === null)).toBe(true);
    const items = [
      { ...rows[0], change3m: null },
      { ...rows[1], change3m: 20 },
      { ...rows[2], change3m: -5 },
    ];
    expect(
      sortSummaries(items, "change3m", "desc").map((r) => r.change3m),
    ).toEqual([20, -5, null]);
    expect(
      sortSummaries(items, "change3m", "asc").map((r) => r.change3m),
    ).toEqual([-5, 20, null]);
  });
});

describe("Google Trends CSV", () => {
  it("parses metadata, BOM, quoted columns, blank lines and censored values", () => {
    const result = parseTrends(
      '\ufeffCategory: All categories\r\n\r\nMonth,"coffee, cafes: (New Jersey)",gym: (New Jersey)\r\n2026-01,50,<1\r\n2026-02,60,0\r\n',
    );
    expect(result.columns).toEqual([
      "coffee, cafes: (New Jersey)",
      "gym: (New Jersey)",
    ]);
    expect(result.rows[0].values).toEqual([50, null]);
    expect(result.rows[1].values).toEqual([60, 0]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("accepts weekly dates and rejects regions, invalid dates, duplicate periods and out-of-range data", () => {
    expect(
      parseTrends("Week,coffee\n2026-01-04,80\n2026-01-11,90").rows[0].date,
    ).toBe("2026-01-04");
    for (const csv of [
      "Region,coffee\nNew Jersey,100",
      "Day,coffee\n2026-02-30,10",
      "Month,coffee\n2026-01,101",
      "Month,coffee\n2026-01,1\n2026-01,2",
      'Month,"coffee\n2026-01,4',
    ])
      expect(() => parseTrends(csv)).toThrow();
  });
});
