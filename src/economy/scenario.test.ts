import { describe, expect, it } from "vitest";
import { exposureScenario } from "./scenario";
import type { NetworkNode } from "./types";
const nodes = [
  { id: "a", label: "A", share: 0.6 },
  { id: "b", label: "B", share: 0.4 },
] as NetworkNode[];
describe("conditional exposure", () => {
  it("reduces to direct exposure without assumed propagation", () => {
    const r = exposureScenario(
      { nodes, edges: [{ source: "a", target: "b", weight: 1 }] },
      "a",
      0.2,
      0,
    );
    expect(r.aggregateExposure).toBeCloseTo(0.12);
    expect(r.sectors[1].totalShock).toBe(0);
  });
  it("matches the closed form solution for a two-node reciprocal network", () => {
    const r = exposureScenario(
      { nodes, edges: [{ source: "a", target: "b", weight: 1 }] },
      "a",
      0.2,
      0.4,
    );
    expect(r.sectors[0].totalShock).toBeCloseTo(0.2 / (1 - 0.16));
    expect(r.sectors[1].totalShock).toBeCloseTo(0.08 / (1 - 0.16));
  });
  it("does not propagate to isolates and rejects unstable or invalid input", () => {
    expect(
      exposureScenario({ nodes, edges: [] }, "a", 0.2, 0.5).aggregateExposure,
    ).toBeCloseTo(0.12);
    expect(() => exposureScenario({ nodes, edges: [] }, "a", 0.2, 1)).toThrow();
    expect(() => exposureScenario({ nodes, edges: [] }, "c", 0.2, 0)).toThrow();
  });
});
