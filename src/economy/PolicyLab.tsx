import { useMemo, useState } from "react";
import { RotateCcw, Check, X } from "lucide-react";
import { initialProposals, solvePolicy } from "./policy";
import {
  Caveat,
  DownloadButton,
  Evidence,
  Method,
  Section,
  Stat,
} from "./shared";
import { downloadJson, number } from "./formatters";

export default function PolicyLab() {
  const [proposals, setProposals] = useState(initialProposals);
  const [budget, setBudget] = useState(100);
  const [equity, setEquity] = useState(true);
  const [maxPerSector, setMaxPerSector] = useState(2);
  const [riskPenalty, setRiskPenalty] = useState(0.5);
  const result = useMemo(
    () => solvePolicy(proposals, { budget, equity, maxPerSector, riskPenalty }),
    [proposals, budget, equity, maxPerSector, riskPenalty],
  );
  const selected = new Set(result.selected.map((p) => p.id));
  return (
    <>
      <Caveat>
        <strong>Hypothetical policy experiment.</strong> Projects, costs,
        benefit points and risks are editable assumptions. These are not
        approved projects, measured returns or a spending recommendation.
      </Caveat>
      <div className="eco-lab-layout">
        <section className="eco-controls">
          <h3>Allocation constraints</h3>
          <label>
            Budget <strong>${number(budget)}k</strong>
            <input
              aria-label="Policy budget"
              type="range"
              min="0"
              max="250"
              step="5"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </label>
          <label>
            Risk penalty <strong>{riskPenalty.toFixed(1)}</strong>
            <input
              aria-label="Risk penalty"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={riskPenalty}
              onChange={(e) => setRiskPenalty(Number(e.target.value))}
            />
          </label>
          <label>
            Projects per sector
            <select
              aria-label="Projects per sector"
              value={maxPerSector}
              onChange={(e) => setMaxPerSector(Number(e.target.value))}
            >
              <option value={1}>At most 1</option>
              <option value={2}>At most 2</option>
            </select>
          </label>
          <label className="eco-checkbox">
            <input
              type="checkbox"
              checked={equity}
              onChange={(e) => setEquity(e.target.checked)}
            />
            At least one project in each area
          </label>
          <button
            className="eco-button"
            onClick={() => {
              setProposals(initialProposals);
              setBudget(100);
              setRiskPenalty(0.5);
              setEquity(true);
              setMaxPerSector(2);
            }}
          >
            <RotateCcw size={15} />
            Reset assumptions
          </button>
        </section>
        <div>
          <div className="eco-stats three">
            <Stat
              label="Allocation"
              value={
                result.feasible
                  ? `${result.selected.length} projects`
                  : "Infeasible"
              }
              detail={
                result.feasible
                  ? "Optimal for these assumptions"
                  : "Constraints cannot all be met"
              }
            />
            <Stat
              label="Budget allocated"
              value={`$${number(result.cost)}k`}
              detail={`$${number(budget - result.cost)}k unallocated`}
            />
            <Stat
              label="Risk-adjusted benefit"
              value={number(result.objective, 1)}
              detail="Assumed benefit points, not dollars"
            />
          </div>
          <Section
            title="Candidate interventions"
            note="Illustrative proposals · costs in $1,000s"
            action={<Evidence tone="scenario">Scenario</Evidence>}
          >
            <div className="eco-table-wrap">
              <table className="eco-table">
                <thead>
                  <tr>
                    <th>Project / area</th>
                    <th>Cost ($k)</th>
                    <th>Benefit points</th>
                    <th>Risk (0-1)</th>
                    <th>Funded</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p, i) => (
                    <tr
                      key={p.id}
                      className={selected.has(p.id) ? "selected" : ""}
                    >
                      <td>
                        <strong>{p.name}</strong>
                        <small>
                          {p.area} · {p.sector}
                        </small>
                      </td>
                      {(["cost", "benefit", "risk"] as const).map((field) => (
                        <td key={field}>
                          <input
                            className="eco-number"
                            aria-label={`${p.name} ${field}`}
                            type="number"
                            min={field === "cost" ? 1 : 0}
                            max={field === "risk" ? 1 : 1000}
                            step={field === "risk" ? 0.05 : 1}
                            value={p[field]}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value))
                                setProposals((ps) =>
                                  ps.map((item, j) =>
                                    j === i
                                      ? {
                                          ...item,
                                          [field]: Math.max(
                                            field === "cost" ? 1 : 0,
                                            Math.min(
                                              field === "risk" ? 1 : 1000,
                                              value,
                                            ),
                                          ),
                                        }
                                      : item,
                                  ),
                                );
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        {selected.has(p.id) ? (
                          <Check size={18} aria-label="Funded" />
                        ) : (
                          <X size={16} aria-label="Not funded" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {!result.feasible && (
            <p role="status" className="eco-error">
              No feasible allocation. The budget or sector limit is too
              restrictive for the required geographic coverage.
            </p>
          )}
          <DownloadButton
            label="Export allocation & assumptions"
            onClick={() =>
              downloadJson("mount-olive-policy-scenario.json", {
                evidence: "hypothetical",
                ...result,
              })
            }
          />
        </div>
      </div>
      <Method title="Optimization model">
        <p>
          Maximize sum of b[j] (1 - lambda r[j]) x[j], with binary project
          choices x[j]. Total cost cannot exceed the budget; optional geographic
          coverage requires one project per area, and sector counts obey the
          selected cap. Solved as a mixed integer linear program with
          jsLPSolver.
        </p>
        <p>
          Risk is an assumed discount, not an estimated probability of failure.
          Geographic coverage is one explicit equity rule; it does not establish
          that the resulting allocation is fair. Changing benefit assumptions
          can change the optimal portfolio.
        </p>
      </Method>
    </>
  );
}
