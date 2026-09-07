import { useState } from "react";
import type { EconomyResults } from "./types";
import { ForecastChart } from "./ForecastChart";
import { Caveat, DownloadButton, Evidence, Section, Stat } from "./shared";
import { downloadJson, month, number } from "./formatters";
import { ModelDetails, Readiness } from "./ModelDetails";

export default function LaborView({ data }: { data: EconomyResults }) {
  const [years, setYears] = useState(5);
  const [horizon, setHorizon] = useState(6);
  const [onlyAlerts, setOnlyAlerts] = useState(true);
  const f = data.forecast.result,
    n = data.nowcast.result,
    a = data.anomalies.result;
  if (!f) return <Readiness model={data.forecast} />;
  const latest = f.history.at(-1);
  const prior = f.history.at(-13);
  return (
    <>
      <div className="eco-stats">
        <Stat
          label="Observed unemployment"
          value={`${number(latest?.value, 1)}%`}
          detail={
            latest
              ? `${month(latest.date)} · Morris County · NSA`
              : "Unavailable"
          }
        />
        <Stat
          label="Year-over-year change"
          value={
            latest?.value != null && prior?.value != null
              ? `${number(latest.value - prior.value, 1)} pp`
              : "Unavailable"
          }
          detail="Percentage points, same calendar month"
        />
        <Stat
          label="Current-month projection"
          value={n ? `${number(n.estimate.value, 1)}%` : "Unavailable"}
          detail={
            n
              ? `${month(n.estimate.date)} · ${number(n.estimate.lower, 1)}-${number(n.estimate.upper, 1)}% interval`
              : "Insufficient input data"
          }
        />
        <Stat
          label="Model validation"
          value={`${f.validation.folds} origins`}
          detail="Time-ordered evaluation · revised history"
        />
      </div>
      <Caveat>
        County unemployment is a resident labor-market indicator. It is not
        Mount Olive business revenue, workplace employment or local GDP. The
        current-month estimate projects from lagged official observations; it is
        not a high-frequency nowcast.
      </Caveat>
      {f.predictions.some((p) => p.lower < 0 || p.upper > 100) && (
        <Caveat>
          The Gaussian benchmark produces some interval bounds outside the
          feasible 0-100% range. These raw bounds expose a model limitation, not
          possible negative unemployment. The final holdout does not establish
          superiority over the simple baseline; horizons 4-6 have not been
          validated at their matching horizons.
        </Caveat>
      )}
      <Section
        title="Labor-market trajectory"
        note={`${f.selectedModel} · ${Math.round(f.intervalLevel * 100)}% prediction interval · not seasonally adjusted`}
        action={
          <div className="eco-inline">
            <select
              aria-label="History window"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            >
              <option value={3}>3 years</option>
              <option value={5}>5 years</option>
              <option value={15}>15 years</option>
              <option value={30}>All history</option>
            </select>
            <select
              aria-label="Forecast horizon"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              <option value={3}>3 months ahead</option>
              <option value={6}>6 months ahead</option>
            </select>
          </div>
        }
      >
        <ForecastChart forecast={f} years={years} horizon={horizon} />
        <div className="eco-chart-legend">
          <span>
            <i style={{ background: "#15816e" }} />
            Observed
          </span>
          <span>
            <i style={{ background: "#b86f32" }} />
            Forecast
          </span>
          <span>
            <i style={{ background: "#ecd9c3" }} />
            Prediction interval
          </span>
        </div>
      </Section>
      <Section
        title="Out-of-sample performance"
        note={f.validation.design}
        action={
          <DownloadButton
            onClick={() =>
              downloadJson("labor-model-and-validation.json", {
                forecast: data.forecast,
                nowcast: data.nowcast,
                sources: data.sources.filter((s) =>
                  data.forecast.sourceIds.includes(s.id),
                ),
              })
            }
          />
        }
      >
        <div className="eco-table-wrap">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>MAE (pp)</th>
                <th>RMSE (pp)</th>
                <th>Interval coverage</th>
                <th>Mean width (pp)</th>
                <th>Evaluations</th>
              </tr>
            </thead>
            <tbody>
              {f.validation.metrics.map((m) => (
                <tr key={m.model}>
                  <td>
                    <strong>{m.model}</strong>
                    {m.model === f.selectedModel && (
                      <Evidence tone="model">Selected</Evidence>
                    )}
                  </td>
                  <td>{number(m.mae, 3)}</td>
                  <td>{number(m.rmse, 3)}</td>
                  <td>{number(m.coverage * 100, 1)}%</td>
                  <td>{number(m.meanIntervalWidth, 2)}</td>
                  <td>{m.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="eco-footnote">{f.validation.vintagePolicy}</p>
        {f.validation.holdoutMetrics?.length > 0 && (
          <div className="eco-inline-metrics">
            {f.validation.holdoutMetrics.map((m) => (
              <span key={m.model}>
                Final holdout · {m.model}: MAE {number(m.mae, 3)} pp, coverage{" "}
                {number(m.coverage * 100, 1)}%, n={m.n}
              </span>
            ))}
          </div>
        )}
      </Section>
      <ModelDetails model={data.forecast} />
      {n && (
        <Section
          title="Current-month estimate"
          note={`Information cutoff: ${month(n.observedThrough)}`}
          action={<Evidence tone="model">Lagged-data projection</Evidence>}
        >
          <p>{n.informationSet}</p>
          <ModelDetails model={data.nowcast} />
        </Section>
      )}
      {a && (
        <Section
          title="Early-warning monitor"
          note={a.interpretation}
          action={
            <label className="eco-checkbox">
              <input
                type="checkbox"
                checked={onlyAlerts}
                onChange={(e) => setOnlyAlerts(e.target.checked)}
              />
              Flagged observations only
            </label>
          }
        >
          <div className="eco-table-wrap">
            <table className="eco-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Observed</th>
                  <th>Expected</th>
                  <th>Residual score</th>
                  <th>Adjusted q</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {(onlyAlerts ? a.alerts : a.observations)
                  .slice(-36)
                  .reverse()
                  .map((row) => (
                    <tr key={row.date}>
                      <td>{month(row.date)}</td>
                      <td>{number(row.value, 1)}%</td>
                      <td>{number(row.expected, 1)}%</td>
                      <td>{number(row.score, 2)}</td>
                      <td>{number(row.qValue, 3)}</td>
                      <td>
                        <Evidence tone={row.flagged ? "scenario" : "observed"}>
                          {row.flagged ? "Unusual" : "Within range"}
                        </Evidence>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {onlyAlerts && a.alerts.length === 0 && (
            <p className="eco-empty">
              No observations pass the configured multiple-testing threshold.
              This is not evidence that the economy is risk-free.
            </p>
          )}
          <ModelDetails model={data.anomalies} />
        </Section>
      )}
    </>
  );
}
