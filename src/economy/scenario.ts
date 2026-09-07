import { Matrix, solve } from "ml-matrix";
import type { Network } from "./types";

export function exposureScenario(
  network: Pick<Network, "nodes" | "edges">,
  sectorId: string,
  shock: number,
  coupling: number,
) {
  if (
    !Number.isFinite(shock) ||
    shock < 0 ||
    shock > 0.5 ||
    !Number.isFinite(coupling) ||
    coupling < 0 ||
    coupling > 0.5
  )
    throw new Error("Shock and coupling must be between 0 and 0.5.");
  const ids = network.nodes.map((n) => n.id);
  if (!ids.includes(sectorId) || new Set(ids).size !== ids.length)
    throw new Error("A unique, known sector is required.");
  const weights = Matrix.zeros(ids.length, ids.length);
  for (const edge of network.edges) {
    const i = ids.indexOf(edge.source),
      j = ids.indexOf(edge.target);
    if (
      i < 0 ||
      j < 0 ||
      i === j ||
      !Number.isFinite(edge.weight) ||
      edge.weight < 0
    )
      throw new Error("Invalid network edge.");
    weights.set(i, j, edge.weight);
    weights.set(j, i, edge.weight);
  }
  for (let i = 0; i < ids.length; i++) {
    const sum = weights.getRow(i).reduce((a, b) => a + b, 0);
    if (sum > 0)
      for (let j = 0; j < ids.length; j++)
        weights.set(i, j, weights.get(i, j) / sum);
  }
  const direct = Matrix.columnVector(
    ids.map((id) => (id === sectorId ? shock : 0)),
  );
  const total = solve(
    Matrix.eye(ids.length).sub(weights.mul(coupling)),
    direct,
  ).to1DArray();
  const sectors = network.nodes.map((node, i) => ({
    id: node.id,
    label: node.label,
    share: node.share,
    directShock: node.id === sectorId ? shock : 0,
    totalShock: total[i],
    weightedExposure: node.share * total[i],
  }));
  return {
    sectorId,
    shock,
    coupling,
    sectors,
    aggregateExposure: sectors.reduce((a, s) => a + s.weightedExposure, 0),
    directExposure: sectors.reduce((a, s) => a + s.share * s.directShock, 0),
  };
}
