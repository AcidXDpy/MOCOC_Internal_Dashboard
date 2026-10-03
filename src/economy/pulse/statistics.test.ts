import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { comparisonRows, formatValue, indexed, observedAt } from "./statistics";
import { parsePulse } from "./types";

const fixture = () =>
  JSON.parse(readFileSync("public/economy/local-pulse.json", "utf-8"));
describe("Local Economic Pulse", () => {
  it("validates the actual artifact and rejects broken provenance", () => {
    const b = parsePulse(fixture());
    expect(b.datasets).toHaveLength(23);
    const broken = fixture();
    broken.datasets[0].observations[0].sourceIds = ["unknown"];
    expect(() => parsePulse(broken)).toThrow();
  });
  it("rejects duplicate observations, invalid schema, and nonfinite values", () => {
    const b = fixture();
    b.datasets[0].observations.push(b.datasets[0].observations[0]);
    expect(() => parsePulse(b)).toThrow();
    expect(() => parsePulse({ schemaVersion: "wrong" })).toThrow();
    const invalid = fixture();
    invalid.datasets[0].observations[0].value = NaN;
    expect(() => parsePulse(invalid)).toThrow();
  });
  it("retains missing values rather than constructing zeroes", () => {
    expect(indexed(null, 100)).toBeNull();
    expect(indexed(2, 0)).toBeNull();
    expect(indexed(0, 100)).toBe(0);
    expect(formatValue(null, "USD")).toBe("Unavailable");
  });
  it("uses the same first displayed period for each index without shifting missing bases", () => {
    const d = parsePulse(fixture()).datasets.find(
      (d) => d.id === "establishments",
    )!;
    const rows = comparisonRows(
      d,
      ["morris", "new-jersey", "mount-olive"],
      2020,
      "index",
    );
    expect(rows[0].morris).toBe(100);
    expect(rows[0]["new-jersey"]).toBe(100);
    expect(rows.every((r) => r["mount-olive"] === null)).toBe(true);
    observedAt(d, "morris", 2020)!.value = null;
    expect(
      comparisonRows(d, ["morris"], 2020, "index").every(
        (r) => r.morris === null,
      ),
    ).toBe(true);
  });
  it("keeps a missing intermediate point as a gap", () => {
    const d = parsePulse(fixture()).datasets[0];
    observedAt(d, "mount-olive", 2019)!.value = null;
    const rows = comparisonRows(d, ["mount-olive"], 2014, "published");
    expect(rows.map((r) => r.year)).toEqual([2014, 2019, 2024]);
    expect(rows[1]["mount-olive"]).toBeNull();
    expect(rows[2]["mount-olive"]).toBeGreaterThan(0);
  });
});
