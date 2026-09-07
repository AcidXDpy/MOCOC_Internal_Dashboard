import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  acsEvidence,
  countyBusinessPatterns,
  zipBusinessPatterns,
} from "../data/localEconomy";
import type { EconomyResults, EconomicView } from "./types";
import {
  Caveat,
  DownloadButton,
  Evidence,
  Method,
  Section,
  Source,
  Stat,
} from "./shared";
import {
  chartTooltip,
  colors,
  downloadJson,
  month,
  number,
} from "./formatters";
import { ModelDetails, Readiness } from "./ModelDetails";
import { ForecastChart } from "./ForecastChart";

export function EconomyOverview({
  data,
  navigate,
}: {
  data: EconomyResults;
  navigate: (view: EconomicView) => void;
}) {
  const labor = data.forecast.result;
  const latest = labor?.history.at(-1);
  const population = acsEvidence.find((d) => d.id === "acs.population");
  const income = acsEvidence.find(
    (d) => d.id === "acs.median_household_income",
  );
  const zipTotals = [
    ...new Map(
      zipBusinessPatterns.map((z) => [z.zipCode, z.totalEstablishments]),
    ).values(),
  ].reduce((a, b) => a + b, 0);
  const sectors = (
    data.network.result?.nodes ??
    countyBusinessPatterns.sectors.map((s) => ({
      id: s.code,
      label: s.label,
      establishments: s.establishments,
    }))
  )
    .slice()
    .sort((a, b) => b.establishments - a.establishments)
    .slice(0, 6);
  return (
    <>
      <div className="eco-stats">
        <Stat
          label="Mount Olive residents"
          value={number(population?.estimate)}
          detail={`ACS 2024 five-year · +/- ${number(population?.marginOfError)}`}
        />
        <Stat
          label="Core ZIP establishments"
          value={number(zipTotals)}
          detail="07828 + 07836 · employer locations · 2023"
        />
        <Stat
          label="Median household income"
          value={`$${number(income?.estimate)}`}
          detail={`ACS 2024 · +/- $${number(income?.marginOfError)}`}
          tone="#518bb0"
        />
        <Stat
          label="County unemployment"
          value={latest ? `${number(latest.value, 1)}%` : "Unavailable"}
          detail={
            latest
              ? `${month(latest.date)} · Morris County · NSA`
              : "Source not available"
          }
          tone="#d05b48"
        />
      </div>
      <div className="eco-split-main">
        <Section
          title="The regional labor pulse"
          note={
            latest
              ? `Morris County · observed through ${month(latest.date)}`
              : "Labor series not yet available"
          }
          action={
            <button
              className="eco-link-button"
              onClick={() => navigate("labor")}
            >
              Forecasts <ArrowUpRight size={16} />
            </button>
          }
        >
          {labor ? (
            <ForecastChart forecast={labor} years={5} />
          ) : (
            <Readiness model={data.forecast} />
          )}
          <div className="eco-chart-legend">
            <span>
              <i style={{ background: "#15816e" }} />
              Observed unemployment
            </span>
            <span>
              <i style={{ background: "#b86f32" }} />
              Model forecast
            </span>
            <span>
              {Math.round((labor?.intervalLevel ?? 0.9) * 100)}% prediction
              interval
            </span>
          </div>
          {labor?.predictions.some((p) => p.lower < 0) && (
            <p className="eco-footnote">
              Below-zero interval bounds reflect the Gaussian model's
              limitations, not possible negative unemployment. Full validation
              is in Labor & early warnings.
            </p>
          )}
        </Section>
        <Section
          title="Research signals"
          note="What the available evidence can tell us"
        >
          <div className="eco-signals">
            <button onClick={() => navigate("spatial")}>
              <Evidence tone="model">Spatial association</Evidence>
              <strong>
                {data.spatial.result
                  ? `Moran's I: ${number(data.spatial.result.global.statistic, 3)}`
                  : "Spatial analysis awaiting data"}
              </strong>
              <p>
                {data.spatial.result
                  ? `${data.spatial.result.n} county tracts · income clustering, not business growth`
                  : "Needs tract observations and locations"}
              </p>
              <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate("industry")}>
              <Evidence>Economic structure</Evidence>
              <strong>
                {data.network.result
                  ? `${number(data.network.result.concentration.effectiveSectors, 1)} effective sectors`
                  : "Employer establishment mix"}
              </strong>
              <p>Concentration and regional specialization</p>
              <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate("health")}>
              <Evidence tone="model">Index research</Evidence>
              <strong>What does economic health measure?</strong>
              <p>A tract context factor, with uncertainty and limits</p>
              <ArrowRight size={16} />
            </button>
          </div>
        </Section>
      </div>
      <div className="eco-two-col">
        <Section
          title="Where establishments concentrate"
          note={`Morris County · ${data.network.result?.year ?? 2023} · largest sectors`}
          action={
            <button
              className="eco-link-button"
              onClick={() => navigate("industry")}
            >
              All industries <ArrowRight size={16} />
            </button>
          }
        >
          <div className="eco-ranked-list">
            {sectors.map((s, i) => (
              <div key={s.id}>
                <span className="eco-rank">0{i + 1}</span>
                <div>
                  <strong>{s.label}</strong>
                  <div className="eco-bar-track">
                    <i
                      style={{
                        width: `${(s.establishments / sectors[0].establishments) * 100}%`,
                        background: colors[i],
                      }}
                    />
                  </div>
                </div>
                <b>{number(s.establishments)}</b>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="A local economy, in context"
          note="Different sources describe different populations"
        >
          <div className="eco-geography-list">
            <div>
              <span>01</span>
              <div>
                <strong>Mount Olive township</strong>
                <p>Resident demographics and household conditions</p>
              </div>
              <Evidence>ACS</Evidence>
            </div>
            <div>
              <span>02</span>
              <div>
                <strong>Budd Lake & Flanders ZIPs</strong>
                <p>Employer-establishment structure; ZIPs cross boundaries</p>
              </div>
              <Evidence>ZBP</Evidence>
            </div>
            <div>
              <span>03</span>
              <div>
                <strong>Morris County & NJ peers</strong>
                <p>
                  Monthly labor conditions, industry structure and tract context
                </p>
              </div>
              <Evidence>BLS / CBP</Evidence>
            </div>
          </div>
          <Caveat>
            A Chamber directory is a selected sample of businesses. Its listing
            count is not the size of the local economy.
          </Caveat>
        </Section>
      </div>
    </>
  );
}

export function IndustryView({ data }: { data: EconomyResults }) {
  const [area, setArea] = useState("county");
  const [metric, setMetric] = useState("establishments");
  const n = data.network.result;
  const rows =
    area === "county"
      ? (n?.nodes ?? []).map((s) => ({
          code: s.id,
          label: s.label,
          count: s.establishments,
          employment: s.employment,
          rca: s.rca,
          share: s.share,
        }))
      : zipBusinessPatterns
          .filter((z) => z.zipCode === area)
          .map((z) => ({
            code: z.sectorCode,
            label: z.sectorLabel,
            count: z.establishments,
            employment: null,
            share: z.establishments / z.totalEstablishments,
            rca: null,
          }));
  const display = rows
    .slice()
    .sort((a, b) =>
      metric === "specialization"
        ? (b.rca ?? 0) - (a.rca ?? 0)
        : b.count - a.count,
    );
  return (
    <>
      <div className="eco-toolbar">
        <label>
          Geography
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              if (e.target.value !== "county") setMetric("establishments");
            }}
            aria-label="Industry geography"
          >
            <option value="county">Morris County</option>
            <option value="07828">Budd Lake ZIP 07828</option>
            <option value="07836">Flanders ZIP 07836</option>
          </select>
        </label>
        <div className="eco-segmented" aria-label="Industry metric">
          <button
            aria-pressed={metric === "establishments"}
            onClick={() => setMetric("establishments")}
          >
            Establishments
          </button>
          <button
            disabled={area !== "county"}
            aria-pressed={metric === "specialization"}
            onClick={() => setMetric("specialization")}
          >
            Specialization
          </button>
        </div>
        <DownloadButton
          onClick={() =>
            downloadJson("industry-structure.json", {
              geography: area,
              year: area === "county" ? n?.year : 2023,
              rows,
            })
          }
        />
      </div>
      {n && area === "county" && (
        <div className="eco-stats three">
          <Stat
            label="Establishment concentration"
            value={number(n.concentration.hhi, 3)}
            detail="Herfindahl index · sum of squared sector shares"
          />
          <Stat
            label="Effective number of sectors"
            value={number(n.concentration.effectiveSectors, 1)}
            detail="Inverse Herfindahl concentration"
          />
          <Stat
            label="Normalized diversity"
            value={number(n.concentration.normalizedEntropy, 3)}
            detail="Shannon entropy / log(sector count)"
          />
        </div>
      )}
      <Section
        title={
          metric === "specialization"
            ? "Regional specialization"
            : "Industry composition"
        }
        note={
          metric === "specialization"
            ? `Location quotient / RCA relative to ${n?.referenceGeography}`
            : `${area === "county" ? n?.year : 2023} employer establishments · Census Business Patterns`
        }
      >
        <div className="eco-chart tall">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={display}
              layout="vertical"
              margin={{ left: 0, right: 24, top: 10, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="#e3e8e5" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="code"
                width={45}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                {...chartTooltip}
                labelFormatter={(code) =>
                  display.find((r) => r.code === String(code))?.label ?? code
                }
              />
              <Bar
                dataKey={metric === "specialization" ? "rca" : "count"}
                name={
                  metric === "specialization"
                    ? "RCA / location quotient"
                    : "Establishments"
                }
                radius={[0, 3, 3, 0]}
              >
                {display.map((r, i) => (
                  <Cell key={r.code} fill={colors[i % colors.length]} />
                ))}
              </Bar>
              {metric === "specialization" && (
                <ReferenceLine x={1} stroke="#d05b48" strokeDasharray="4 3" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="eco-table-wrap">
          <table className="eco-table">
            <thead>
              <tr>
                <th>NAICS / sector</th>
                <th>Establishments</th>
                <th>Share</th>
                <th>RCA</th>
                <th>Employment</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <tr key={r.code}>
                  <td>
                    <strong>
                      {r.code} · {r.label}
                    </strong>
                  </td>
                  <td>{number(r.count)}</td>
                  <td>{number(r.share * 100, 1)}%</td>
                  <td>{r.rca == null ? "Not computed" : number(r.rca, 2)}</td>
                  <td>{number(r.employment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Caveat>
        Employer establishments exclude most self-employed businesses.
        {n && area === "county" && (
          <>
            {" "}
            The comparable matrix covers{" "}
            {number(n.sectorCoverage.includedMorrisEstablishments)} of{" "}
            {number(n.sectorCoverage.totalMorrisEstablishments)} county
            establishments (
            {number(n.sectorCoverage.morrisEstablishmentShare * 100, 1)}%).
            Shares and diversity use included sectors only;{" "}
            {number(n.sectorCoverage.excludedMorrisEstablishments)}{" "}
            establishments are excluded because their sectors are not published
            for every county.{" "}
          </>
        )}
        Establishments are locations, not firms. ZIP boundaries do not define
        the township; county specialization cannot identify an individual
        business's performance.
      </Caveat>
      {n && (
        <>
          <ModelDetails model={data.network} />
          <Method title="Can two ZIP codes support an Economic Complexity Index?">
            <p>
              No defensible complexity ranking comes from only two local ZIPs.
              RCA measures relative specialization. An ECI requires a
              sufficiently broad and stable geography-by-industry matrix; a
              second eigenvector of a small matrix is not evidence of productive
              sophistication.
            </p>
            <p>{n.complexityReadiness}</p>
          </Method>
        </>
      )}
    </>
  );
}

export function HealthView({ data }: { data: EconomyResults }) {
  const h = data.health.result;
  const [sort, setSort] = useState("high");
  if (!h) return <Readiness model={data.health} />;
  const rows = h.tracts
    .slice()
    .sort((a, b) => (sort === "high" ? b.score - a.score : a.score - b.score));
  return (
    <>
      <Caveat>
        <strong>This is an exploratory household-context factor.</strong> It is
        not a validated Local Economic Health Index. It does not measure
        commercial growth, business survival or monthly momentum, and should not
        be used to rank neighborhood worth.
        {!h.orientationGatePassed && (
          <>
            {" "}
            <strong>The direction check failed:</strong> the fitted component
            has mixed loading signs. A higher score is not uniformly healthier;
            the employment-to-population loading is negative.
          </>
        )}
      </Caveat>
      <div className="eco-stats">
        <Stat
          label="Cross-sectional sample"
          value={`${h.sampleSize} tracts`}
          detail="Morris County · common ACS vintage"
        />
        <Stat
          label="Variance captured"
          value={`${number(h.explainedVarianceRatio * 100, 1)}%`}
          detail="First principal component"
        />
        <Stat
          label="Loading stability"
          value={number(h.stability.medianLoadingCosine, 3)}
          detail="Median bootstrap cosine similarity"
        />
        <Stat
          label="Overall economic health"
          value="Not estimated"
          detail="Commercial outcomes required for validation"
        />
      </div>
      <div className="eco-two-col">
        <Section
          title="What the factor captures"
          note={h.indexName}
          action={<Evidence tone="model">Exploratory PCA</Evidence>}
        >
          <p>{h.interpretation}</p>
          <div className="eco-loading-list">
            {h.loadings.map((l) => (
              <div key={l.variable}>
                <strong>
                  {h.variables.find((v) => v.id === l.variable)?.label ??
                    l.variable}
                </strong>
                <span>{number(l.weight, 3)}</span>
                <div className="eco-bar-track">
                  <i
                    style={{
                      width: `${Math.min(100, Math.abs(l.weight) * 100)}%`,
                      background: l.weight < 0 ? colors[1] : colors[0],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Validation gates for a health index">
          <div className="eco-requirements">
            {[
              {
                name: "Independent commercial outcomes",
                detail:
                  "Vacancy, verified formation/survival and workplace employment.",
              },
              {
                name: "Multiple independent dimensions",
                detail:
                  "Labor conditions, commercial vitality, diversity and development pressure.",
              },
              {
                name: "Temporal & geographic validation",
                detail:
                  "Held-out periods and places, loading stability and revision sensitivity.",
              },
              {
                name: "Meaningful uncertainty",
                detail:
                  "Propagate survey error, parameter uncertainty and index-weight sensitivity.",
              },
            ].map((r) => (
              <div key={r.name}>
                <span className="eco-status-dot" />
                <div>
                  <strong>{r.name}</strong>
                  <p>{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title="Tract comparison"
        note="Exploratory factor scores; this is not a probability or economic growth rate"
        action={
          <select
            aria-label="Tract score order"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="high">Highest score first</option>
            <option value="low">Lowest score first</option>
          </select>
        }
      >
        <div className="eco-table-wrap bounded">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Tract</th>
                <th>GEOID</th>
                <th>Factor score</th>
                <th>Display score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.geoid}>
                  <td>{t.name}</td>
                  <td className="mono">{t.geoid}</td>
                  <td>{number(t.componentScore, 3)}</td>
                  <td>{number(t.score, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <ModelDetails model={data.health} />
      <DownloadButton
        onClick={() => downloadJson("tract-context-factor.json", data.health)}
      />
    </>
  );
}

export function DynamicsView({ data }: { data: EconomyResults }) {
  return (
    <>
      <Caveat>
        The directory contains a single selected snapshot. A removed listing is
        not a verified business closure, and a membership start date is not a
        business birth date. There are currently no verified local lifecycle
        outcomes to fit.
      </Caveat>
      <div className="eco-stats three">
        <Stat
          label="Verified business births"
          value="Not collected"
          detail="No registry event history imported"
        />
        <Stat
          label="Verified business closures"
          value="Not collected"
          detail="No outcome ascertainment panel"
        />
        <Stat
          label="Individual survival forecast"
          value="Withheld"
          detail="Requires cohort, follow-up and censoring data"
        />
      </div>
      <Readiness model={data.survival} />
      <Readiness model={data.causal} />
      <Section title="Event evidence required">
        <div className="eco-table-wrap">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Evidence</th>
                <th>Primary source</th>
                <th>Economic interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Opening</td>
                <td>Verified first operating date</td>
                <td>Registration + occupancy / direct confirmation</td>
                <td>Formation; account for registry-to-operation lag</td>
              </tr>
              <tr>
                <td>Closure</td>
                <td>Confirmed cessation, event interval</td>
                <td>Official record + independent corroboration</td>
                <td>Separate relocation from permanent exit</td>
              </tr>
              <tr>
                <td>Relocation</td>
                <td>Old and new address validity dates</td>
                <td>Location history with stable entity identifier</td>
                <td>Competing risk, not business death</td>
              </tr>
              <tr>
                <td>Policy treatment</td>
                <td>Documented eligibility and implementation</td>
                <td>Ordinance, project timeline and affected geography</td>
                <td>Identification and spillover checks required</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

export function EvidenceView({ data }: { data: EconomyResults }) {
  const [query, setQuery] = useState("");
  const sources = data.sources.filter((s) =>
    `${s.name} ${s.geography} ${s.variables.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="eco-toolbar">
        <input
          className="eco-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a dataset, geography or variable"
          aria-label="Search data sources"
        />
        <DownloadButton
          label="Export model results & provenance"
          onClick={() => downloadJson("economic-research-bundle.json", data)}
        />
      </div>
      <Caveat>
        {data.coverage.geography.scopeNote} {data.coverage.vintagePolicy}
      </Caveat>
      <Section
        title="Model source register"
        note={`Bundle built ${new Date(data.generatedAt).toLocaleDateString("en-US")} · observation dates remain source-specific`}
      >
        <div className="eco-source-list">
          {sources.map((s) => (
            <article key={s.id}>
              <div>
                <h4>{s.name}</h4>
                <Source href={s.url}>Original source</Source>
              </div>
              <dl>
                <div>
                  <dt>Geography</dt>
                  <dd>{s.geography}</dd>
                </div>
                <div>
                  <dt>Frequency</dt>
                  <dd>{s.frequency}</dd>
                </div>
                <div>
                  <dt>Observations</dt>
                  <dd>
                    {s.observationStart?.slice(0, 10) ?? "See source"} to{" "}
                    {s.observationEnd?.slice(0, 10) ?? "See source"}
                  </dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd>
                    {s.retrievedAt?.slice(0, 10) ??
                      "Original timestamp unavailable"}
                  </dd>
                </div>
              </dl>
              <p className="mono eco-footnote">{s.variables.join(", ")}</p>
              <details>
                <summary>Provenance & caveats</summary>
                <p className="mono eco-hash">SHA-256: {s.sha256}</p>
                <ul>
                  {s.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
        {sources.length === 0 && (
          <p className="eco-empty">No datasets match this search.</p>
        )}
      </Section>
      <Section
        title="Local baseline estimates"
        note="ACS 2024 five-year · Mount Olive township · margins of error are 90%"
      >
        <div className="eco-table-wrap">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Estimate</th>
                <th>Margin of error</th>
                <th>County comparison</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {acsEvidence.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.label}</strong>
                  </td>
                  <td>{m.formatted}</td>
                  <td>+/- {number(m.marginOfError, 2)}</td>
                  <td>{m.comparisonFormatted ?? "Unavailable"}</td>
                  <td>
                    <Source href={m.provenance.queryUrl}>
                      {m.provenance.table}
                    </Source>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      {data.coverage.warnings.length > 0 && (
        <Section title="Coverage limitations">
          <ul className="eco-list">
            {data.coverage.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>
      )}
      {data.coverage.acquisitionErrors.length > 0 && (
        <Section title="Unavailable acquisitions">
          <ul className="eco-list">
            {data.coverage.acquisitionErrors.map((e, i) => (
              <li key={i}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
