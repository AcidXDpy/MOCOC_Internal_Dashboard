import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Caveat, DownloadButton, Method, Section, Source } from "../shared";
import { downloadJson } from "../formatters";
import {
  ComparisonChart,
  GeographyControls,
  MetricKind,
  ObservationDetail,
} from "./PulseComponents";
import { geoColors, latestObserved, observedAt, period } from "./statistics";
import {
  parsePulse,
  type DisplayMode,
  type GeoId,
  type PulseBundle,
} from "./types";
import "./pulse.css";

export default function LocalEconomicPulse() {
  const [data, setData] = useState<PulseBundle | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/economy/local-pulse.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error(`Comparison data could not load (${r.status}).`);
        return r.json();
      })
      .then(parsePulse)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <div className="eco-error" role="alert">
        <p>{error}</p>
        <button
          className="eco-button"
          onClick={() => {
            setError("");
            setAttempt((n) => n + 1);
          }}
        >
          <RefreshCw size={15} />
          Retry comparison data
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="eco-loading" role="status">
        Loading Local Economic Pulse...
      </div>
    );
  return <PulseDashboard data={data} />;
}

function PulseDashboard({ data }: { data: PulseBundle }) {
  const [selected, setSelected] = useState<GeoId[]>([
    "mount-olive",
    "morris",
    "new-jersey",
  ]);
  const [year, setYear] = useState(2024);
  const [residentMetric, setResidentMetric] = useState("employment-rate");
  const [businessMetric, setBusinessMetric] = useState("establishments");
  const [residentMode, setResidentMode] = useState<DisplayMode>("published");
  const [businessMode, setBusinessMode] = useState<DisplayMode>("index");
  const [residentStart, setResidentStart] = useState(2014);
  const [businessStart, setBusinessStart] = useState(2018);
  const geographies = data.geographies.filter((g) => selected.includes(g.id));
  const resident = data.datasets.find((d) => d.id === residentMetric)!;
  const business = data.datasets.find((d) => d.id === businessMetric)!;
  const headlineIds = [
    "population",
    "household-income",
    "per-capita-income",
    "employment-rate",
    "unemployment",
    "earnings",
  ];
  const headline = headlineIds.map((id) =>
    data.datasets.find((d) => d.id === id)!,
  );
  const industry = data.datasets.filter((d) => d.group === "industry");
  const acsYears = [
    ...new Set(resident.observations.map((o) => o.year)),
  ].sort();
  const recent = Math.max(...business.observations.map((o) => o.year));
  const exportSelection = () =>
    downloadJson("local-economic-pulse.json", {
      ...data,
      selection: {
        geographies: selected,
        acsYear: year,
        residentMetric,
        residentMode,
        residentStart,
        businessMetric,
        businessMode,
        businessStart,
      },
      datasets: data.datasets.map((d) => ({
        ...d,
        observations: d.observations.filter((o) =>
          selected.includes(o.geographyId),
        ),
      })),
    });
  return (
    <div className="pulse-module">
      <div className="pulse-toolbar">
        <GeographyControls
          geographies={data.geographies}
          selected={selected}
          onChange={setSelected}
        />
        <DownloadButton label="Export evidence" onClick={exportSelection} />
      </div>
      <p className="eco-footnote">
        {data.coverage} Bundle prepared {data.builtAt.slice(0, 10)}.
      </p>
      {data.issues.length > 0 && (
        <Caveat>
          {data.issues.length} source retrieval issue(s). Missing observations
          remain unavailable; see the source register below.
        </Caveat>
      )}
      <Section
        title="Resident economy"
        note="Comparable geographies, common survey window. Estimates describe residents, including people who work elsewhere."
        action={
          <label className="pulse-control">
            ACS observation window
            <select
              aria-label="ACS observation window"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {acsYears.map((y) => (
                <option key={y} value={y}>
                  {y - 4}-{y}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="eco-table-wrap pulse-headlines">
          <table className="eco-table">
            <caption>
              Headline indicators - {year - 4}-{year} ACS five-year estimates
            </caption>
            <thead>
              <tr>
                <th scope="col">Indicator / measurement</th>
                {geographies.map((g) => (
                  <th key={g.id} scope="col">
                    <i
                      className="pulse-dot"
                      style={{ background: geoColors[g.id] }}
                    />
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {headline.map((d) => (
                <tr key={d.id}>
                  <th scope="row">
                    <strong>{d.label}</strong>
                    <MetricKind dataset={d} />
                    <small>{d.universe}</small>
                  </th>
                  {geographies.map((g) => (
                    <td key={g.id}>
                      <ObservationDetail
                        dataset={d}
                        observation={observedAt(d, g.id, year)}
                        sources={data.sources}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section
        title="Long-run resident trends"
        note="Non-overlapping five-year windows. Connecting lines summarize period estimates, not annual observations."
        action={
          <MetricKind dataset={resident} indexed={residentMode === "index"} />
        }
      >
        <div className="pulse-controls">
          <label className="pulse-control">
            Indicator
            <select
              aria-label="Resident trend indicator"
              value={residentMetric}
              onChange={(e) => {
                setResidentMetric(e.target.value);
                setResidentMode("published");
              }}
            >
              {data.datasets
                .filter((d) => d.group === "residents")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="pulse-control">
            History
            <select
              aria-label="Resident history"
              value={residentStart}
              onChange={(e) => setResidentStart(Number(e.target.value))}
            >
              <option value={2014}>2010-2024</option>
              <option value={2019}>2015-2024</option>
            </select>
          </label>
          <ModeControl
            name="Resident trend units"
            value={residentMode}
            onChange={setResidentMode}
            allowIndex={resident.unit !== "percent"}
          />
        </div>
        <p className="eco-footnote">
          {resident.universe}.{" "}
          {residentMode === "index"
            ? "Derived: value / first displayed period x 100; a missing or zero base remains unavailable. Index uncertainty is not estimated."
            : resident.unit === "USD"
              ? "Dollars of each window's final year; not constant-dollar growth."
              : `Unit: ${resident.unit}.`}{" "}
          {resident.unit === "USD" &&
            residentMode === "index" &&
            "Income indexes are not inflation-adjusted."}
        </p>
        <ComparisonChart
          dataset={resident}
          geographies={geographies}
          sources={data.sources}
          start={residentStart}
          mode={residentMode}
        />
        <Method>
          <p>
            {resident.formula}. {resident.notes.join(" ")}
          </p>
          <p>
            ACS earnings include all work schedules and are not an hourly wage
            or a full-time salary. Margins of error appear with the underlying
            observations; the chart does not imply statistically significant
            differences.
          </p>
        </Method>
      </Section>
      <Section
        title="Employer establishments & payroll"
        note="County/state workplace evidence. Township CBP totals are not published; no ZIP-code proxy is substituted."
        action={
          <MetricKind dataset={business} indexed={businessMode === "index"} />
        }
      >
        <div className="pulse-controls">
          <label className="pulse-control">
            Measure
            <select
              aria-label="Business trend indicator"
              value={businessMetric}
              onChange={(e) => setBusinessMetric(e.target.value)}
            >
              {data.datasets
                .filter((d) => d.group === "business")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="pulse-control">
            History
            <select
              aria-label="Business history"
              value={businessStart}
              onChange={(e) => setBusinessStart(Number(e.target.value))}
            >
              <option value={2018}>2018-2023</option>
              <option value={2020}>2020-2023</option>
            </select>
          </label>
          <ModeControl
            name="Business trend units"
            value={businessMode}
            onChange={setBusinessMode}
            allowIndex
          />
        </div>
        <div
          className="pulse-latest"
          style={{
            gridTemplateColumns: `repeat(${geographies.length}, minmax(0, 1fr))`,
          }}
        >
          {geographies.map((g) => {
            const last = latestObserved(business, g.id);
            return (
              <div key={g.id}>
                <h4>{g.name}</h4>
                <span>
                  Latest loaded {business.label.toLowerCase()} / published value
                </span>
                <ObservationDetail
                  dataset={business}
                  observation={last ?? observedAt(business, g.id, recent)}
                  sources={data.sources}
                />
                {last && last.year < recent && (
                  <span>Stale relative to comparison window</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="eco-footnote">
          {businessMode === "index"
            ? `Derived index: ${businessStart} = 100. Equal starting values remove differences in scale, not economic structure.`
            : `Unit: ${business.unit}. Raw levels reflect very different geography sizes.`}{" "}
          {businessMetric === "annual-payroll" &&
            "Payroll is nominal, not inflation-adjusted, and is not a wage rate."}
        </p>
        <ComparisonChart
          dataset={business}
          geographies={geographies}
          sources={data.sources}
          start={businessStart}
          mode={businessMode}
        />
        <Method>
          <p>
            {business.formula}. {business.notes.join(" ")}
          </p>
          <p>
            No business openings, closures, or township wage estimates are
            inferred from the directory. Source disclosure/noise flags are
            retained in the evidence export. Publication lag does not mean zero
            recent activity.
          </p>
        </Method>
      </Section>
      <Section
        title="Industry composition of employed residents"
        note={`${year - 4}-${year} ACS C24030. Shares of civilian employed residents age 16+, not the locations of their employers.`}
      >
        <div className="eco-table-wrap pulse-industry">
          <table className="eco-table">
            <caption>
              Derived industry shares - {year - 4}-{year}; approximate 90%
              margins of error
            </caption>
            <thead>
              <tr>
                <th scope="col">Industry group</th>
                {geographies.map((g) => (
                  <th key={g.id} scope="col">
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {industry.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.label}</th>
                  {geographies.map((g) => {
                    const o = observedAt(d, g.id, year);
                    return (
                      <td key={g.id}>
                        <div className="pulse-share-track" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.min(100, Math.max(0, o?.value ?? 0))}%`,
                              background: geoColors[g.id],
                            }}
                          />
                        </div>
                        <ObservationDetail
                          dataset={d}
                          observation={o}
                          sources={data.sources}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Method title="Industry definitions & uncertainty">
          <p>
            Each industry count sums the published male and female categories;
            the share divides by C24030001. The 13 broad categories are mutually
            exclusive. Summed MOEs use the square root of summed squares;
            subset-ratio MOEs fall back to the general-ratio approximation when
            necessary. Sampling covariance is unavailable. These are descriptive
            estimates, not precise local specialization rankings.
          </p>
        </Method>
      </Section>
      <Section
        title="Provenance & comparison limits"
        note="Observation period, retrieval date and publication date are different concepts. No release date is inferred from a download date."
      >
        <Caveat>
          Mount Olive is inside Morris County, which is inside New Jersey. These
          are nested benchmarks, not independent samples. No causal claims or
          significance rankings are made. Resident employment, workplace jobs,
          employer establishments, household income and payroll measure
          different economic populations.
        </Caveat>
        <details className="eco-method">
          <summary>
            Source register ({data.sources.length} cached sources)
          </summary>
          <div className="pulse-sources">
            {data.sources.map((s) => (
              <div key={s.id}>
                <Source href={s.url}>{s.name}</Source>
                <span>
                  Observations {s.observationStart.slice(0, 10)} to{" "}
                  {s.observationEnd.slice(0, 10)}; retrieved{" "}
                  {s.retrievedAt.slice(0, 10)}; release{" "}
                  {s.releaseDate ?? "not recorded"}.
                </span>
                <small>{s.notes.join(" ")}</small>
              </div>
            ))}
            {data.issues.map((issue, i) => (
              <p key={i}>
                {issue.sourceId ?? issue.source}: {issue.message ?? issue.error}
              </p>
            ))}
          </div>
        </details>
        <p className="eco-footnote">
          <Source href="https://www.census.gov/programs-surveys/acs/guidance/comparing-acs-data.html">
            Census ACS comparison guidance
          </Source>
          <Source href="https://www.census.gov/programs-surveys/cbp/technical-documentation/methodology.html">
            CBP coverage & methodology
          </Source>
        </p>
        <p className="eco-footnote">
          Latest resident observation loaded:{" "}
          {period(latestObserved(resident, "mount-olive"))}. Fixed research
          vintages preserve comparability; this module does not claim to contain
          every newly released source.
        </p>
      </Section>
    </div>
  );
}

function ModeControl({
  name,
  value,
  onChange,
  allowIndex,
}: {
  name: string;
  value: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  allowIndex: boolean;
}) {
  return (
    <fieldset className="pulse-modes">
      <legend>{name}</legend>
      <label>
        <input
          type="radio"
          name={name}
          value="published"
          checked={value === "published"}
          onChange={() => onChange("published")}
        />
        Published units
      </label>
      <label>
        <input
          type="radio"
          name={name}
          value="index"
          checked={value === "index"}
          disabled={!allowIndex}
          onChange={() => onChange("index")}
        />
        Index = 100
      </label>
    </fieldset>
  );
}
