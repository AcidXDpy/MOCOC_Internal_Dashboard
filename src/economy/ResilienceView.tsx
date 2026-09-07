import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EconomyResults } from "./types";
import { exposureScenario } from "./scenario";
import {
  Caveat,
  DownloadButton,
  Evidence,
  Method,
  Section,
  Stat,
} from "./shared";
import { chartTooltip, downloadJson, number } from "./formatters";
import { Readiness } from "./ModelDetails";

export default function ResilienceView({ data }: { data: EconomyResults }) {
  const n = data.network.result;
  const [sector, setSector] = useState(
    n?.nodes.find((x) => x.id === "72")?.id ?? n?.nodes[0]?.id ?? "",
  );
  const [shock, setShock] = useState(0.2);
  const [coupling, setCoupling] = useState(0);
  const result = useMemo(
    () => (n ? exposureScenario(n, sector, shock, coupling) : null),
    [n, sector, shock, coupling],
  );
  if (!n || !result) return <Readiness model={data.resilience} />;
  const chart = result.sectors
    .slice()
    .sort((a, b) => b.weightedExposure - a.weightedExposure)
    .map((s) => ({
      ...s,
      direct: s.directShock * s.share * 100,
      propagated: (s.totalShock - s.directShock) * s.share * 100,
    }));
  return (
    <>
      <Caveat>
        <strong>Conditional exposure experiment.</strong> Sector weights are
        observed. The shock and propagation strength are assumptions. Similarity
        between industries is not a measured supply relationship; the results
        are exposure shares, not predicted closures, job losses or dollar
        losses. Weights are normalized within the {n.nodes.length} comparable
        sectors, covering{" "}
        {number(n.sectorCoverage.morrisEstablishmentShare * 100, 1)}% of county
        establishments.
      </Caveat>
      <div className="eco-lab-layout">
        <section className="eco-controls">
          <h3>Shock assumptions</h3>
          <label>
            Affected sector
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              aria-label="Shocked sector"
            >
              {n.nodes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direct activity shock<strong>{number(shock * 100)}%</strong>
            <input
              aria-label="Direct shock"
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={shock}
              onChange={(e) => setShock(Number(e.target.value))}
            />
          </label>
          <label>
            Assumed propagation<strong>{coupling.toFixed(2)}</strong>
            <input
              aria-label="Propagation strength"
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={coupling}
              onChange={(e) => setCoupling(Number(e.target.value))}
            />
          </label>
          <p className="eco-footnote">
            Zero propagation is the uncalibrated default. Positive values test
            an assumed transmission mechanism.
          </p>
          {n.nodes.find((node) => node.id === sector)?.degree === 0 && (
            <p className="eco-footnote">
              This sector has no edges under the current relatedness definition.
              Assumed propagation therefore remains zero.
            </p>
          )}
          <DownloadButton
            label="Export scenario"
            onClick={() =>
              downloadJson("economic-exposure-scenario.json", {
                evidence: "conditional assumptions, not a forecast",
                year: n.year,
                ...result,
              })
            }
          />
        </section>
        <div>
          <div className="eco-stats three">
            <Stat
              label="Direct exposure"
              value={`${number(result.directExposure * 100, 2)}%`}
              detail="Shock-weighted establishment share"
            />
            <Stat
              label="Total scenario exposure"
              value={`${number(result.aggregateExposure * 100, 2)}%`}
              detail="Includes assumed network propagation"
            />
            <Stat
              label="Propagation contribution"
              value={`${number((result.aggregateExposure - result.directExposure) * 100, 2)} pp`}
              detail="Entirely conditional on the chosen coupling"
            />
          </div>
          <Section
            title="Exposure by sector"
            note="Percentage points of total establishment-weighted exposure"
            action={<Evidence tone="scenario">Conditional scenario</Evidence>}
          >
            <div className="eco-chart tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart}
                  layout="vertical"
                  margin={{ left: 0, right: 20, bottom: 10 }}
                >
                  <CartesianGrid horizontal={false} stroke="#e3e8e5" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="id"
                    width={42}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    {...chartTooltip}
                    labelFormatter={(id) =>
                      chart.find((s) => s.id === String(id))?.label ?? id
                    }
                  />
                  <Bar
                    dataKey="direct"
                    stackId="exposure"
                    fill="#d05b48"
                    name="Direct (pp)"
                  />
                  <Bar
                    dataKey="propagated"
                    stackId="exposure"
                    fill="#ceac69"
                    name="Assumed propagation (pp)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>
      <Method title="Transmission equation & identification">
        <pre>z = (I - rho W)^(-1) d; exposure = sum(s[i] z[i])</pre>
        <p>
          W is the row-normalized, symmetric sector-similarity graph; s is the
          observed sector establishment share and d the assumed direct shock.
          The spectral radius of row-stochastic W is at most one. Limiting rho
          to 0-0.5 keeps I - rho W invertible. The numerical system is solved
          with ml-matrix.
        </p>
        <p>
          This is an input-output-inspired sensitivity experiment, not a local
          input-output model. Actual supply-use or worker-flow evidence is
          necessary to estimate propagation. The choice of W, geographic scale
          and establishment rather than employment weights changes the answer.
        </p>
      </Method>
    </>
  );
}
