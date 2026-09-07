import { describe, expect, it } from "vitest";
import { initialProposals, solvePolicy } from "./policy";

describe("policy allocation", () => {
  it("matches exhaustive binary optimization under budget, equity and diversification", () => {
    const settings = {
      budget: 110,
      equity: true,
      maxPerSector: 1,
      riskPenalty: 0.8,
    };
    const result = solvePolicy(initialProposals, settings);
    const valid = Array.from(
      { length: 1 << initialProposals.length },
      (_, mask) => initialProposals.filter((_, i) => (mask & (1 << i)) !== 0),
    ).filter(
      (s) =>
        s.reduce((v, p) => v + p.cost, 0) <= settings.budget &&
        new Set(s.map((p) => p.area)).size === 2 &&
        new Set(s.map((p) => p.sector)).size === s.length,
    );
    const expected = Math.max(
      ...valid.map((s) =>
        s.reduce(
          (v, p) => v + p.benefit * (1 - settings.riskPenalty * p.risk),
          0,
        ),
      ),
    );
    expect(result.feasible).toBe(true);
    expect(result.objective).toBeCloseTo(expected);
  });
  it("reports infeasible equity requirements rather than returning a recommendation", () => {
    expect(
      solvePolicy(initialProposals, {
        budget: 10,
        equity: true,
        maxPerSector: 2,
        riskPenalty: 0,
      }).feasible,
    ).toBe(false);
  });
  it("allows zero allocation and rejects invalid assumptions", () => {
    expect(
      solvePolicy(initialProposals, {
        budget: 0,
        equity: false,
        maxPerSector: 2,
        riskPenalty: 0,
      }).selected,
    ).toHaveLength(0);
    expect(() =>
      solvePolicy([{ ...initialProposals[0], cost: NaN }], {
        budget: 100,
        equity: false,
        maxPerSector: 2,
        riskPenalty: 0,
      }),
    ).toThrow();
  });
});
