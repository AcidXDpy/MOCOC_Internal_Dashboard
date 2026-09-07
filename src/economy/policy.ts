import solver, { type Model, type SolveResult } from "javascript-lp-solver";

export type Proposal = {
  id: string;
  name: string;
  area: string;
  sector: string;
  cost: number;
  benefit: number;
  risk: number;
};
export type PolicyConstraints = {
  budget: number;
  equity: boolean;
  maxPerSector: number;
  riskPenalty: number;
};
export const initialProposals: Proposal[] = [
  {
    id: "p1",
    name: "Storefront access improvements",
    area: "Budd Lake",
    sector: "Retail",
    cost: 30,
    benefit: 45,
    risk: 0.15,
  },
  {
    id: "p2",
    name: "Commercial corridor wayfinding",
    area: "Flanders",
    sector: "Retail",
    cost: 25,
    benefit: 32,
    risk: 0.1,
  },
  {
    id: "p3",
    name: "Small-business energy upgrades",
    area: "Budd Lake",
    sector: "Services",
    cost: 40,
    benefit: 51,
    risk: 0.25,
  },
  {
    id: "p4",
    name: "Workforce training partnership",
    area: "Flanders",
    sector: "Services",
    cost: 35,
    benefit: 50,
    risk: 0.3,
  },
  {
    id: "p5",
    name: "Shared commercial workspace",
    area: "Flanders",
    sector: "Professional",
    cost: 60,
    benefit: 72,
    risk: 0.4,
  },
  {
    id: "p6",
    name: "Local supplier procurement pilot",
    area: "Budd Lake",
    sector: "Professional",
    cost: 20,
    benefit: 29,
    risk: 0.2,
  },
];

export function solvePolicy(
  proposals: Proposal[],
  settings: PolicyConstraints,
) {
  const values = [
    settings.budget,
    settings.maxPerSector,
    settings.riskPenalty,
    ...proposals.flatMap((p) => [p.cost, p.benefit, p.risk]),
  ];
  if (
    values.some((v) => !Number.isFinite(v) || v < 0) ||
    proposals.some((p) => p.risk > 1 || p.cost <= 0) ||
    new Set(proposals.map((p) => p.id)).size !== proposals.length
  )
    throw new Error(
      "Enter finite, non-negative assumptions, unique projects, and positive costs.",
    );
  const model: Model = {
    optimize: "value",
    opType: "max",
    constraints: { budget: { max: settings.budget } },
    variables: {},
    binaries: {},
  };
  const areas = [...new Set(proposals.map((p) => p.area))];
  const sectors = [...new Set(proposals.map((p) => p.sector))];
  areas.forEach((_, i) => {
    if (settings.equity) model.constraints[`area${i}`] = { min: 1 };
  });
  sectors.forEach((_, i) => {
    model.constraints[`sector${i}`] = { max: settings.maxPerSector };
  });
  proposals.forEach((p, i) => {
    const key = `project${i}`;
    model.variables[key] = {
      budget: p.cost,
      value: p.benefit * (1 - settings.riskPenalty * p.risk),
      [`area${areas.indexOf(p.area)}`]: 1,
      [`sector${sectors.indexOf(p.sector)}`]: 1,
    };
    model.binaries![key] = 1;
  });
  const solution = solver.Solve(model) as SolveResult;
  const selected = solution.feasible
    ? proposals.filter((_, i) => Number(solution[`project${i}`] ?? 0) > 0.5)
    : [];
  return {
    feasible: solution.feasible,
    selected,
    cost: selected.reduce((s, p) => s + p.cost, 0),
    benefit: selected.reduce((s, p) => s + p.benefit, 0),
    objective: selected.reduce(
      (s, p) => s + p.benefit * (1 - settings.riskPenalty * p.risk),
      0,
    ),
    settings,
    assumptions: proposals,
  };
}
