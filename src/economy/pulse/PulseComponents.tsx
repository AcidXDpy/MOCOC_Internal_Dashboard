import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Evidence, Source } from "../shared";
import {
  comparisonRows,
  formatValue,
  geoColors,
  observedAt,
  period,
} from "./statistics";
import type {
  DisplayMode,
  GeoId,
  Observation,
  PulseBundle,
  PulseDataset,
} from "./types";

export function ObservationDetail({
  observation: o,
  dataset,
  sources,
  value,
  indexed = false,
}: {
  observation?: Observation;
  dataset: PulseDataset;
  sources: PulseBundle["sources"];
  value?: number | null;
  indexed?: boolean;
}) {
  const shown = indexed ? value : o?.value;
  return (
    <div className="pulse-observation">
      <strong>{formatValue(shown, indexed ? "index" : dataset.unit)}</strong>
      <span>
        {period(o)}
        {dataset.frequency === "five-year estimate" ? " pooled" : " annual"}
      </span>
      {o?.value != null &&
        !indexed &&
        dataset.frequency === "five-year estimate" && (
          <span>
            90% MOE:{" "}
            {o.moe === null
              ? "unavailable"
              : `+/- ${dataset.unit === "percent" ? `${o.moe.toFixed(1)} pp` : formatValue(o.moe, dataset.unit)}`}
          </span>
        )}
      {shown == null && (
        <span>
          {o?.status === "not_available"
            ? "Not published for township"
            : o?.status === "suppressed"
              ? "Suppressed by source"
              : indexed
                ? "Missing value or nonpositive base"
                : "Missing observation"}
        </span>
      )}
      {o?.sourceIds.map((id) => {
        const source = sources.find((s) => s.id === id);
        return source ? (
          <Source key={id} href={source.url}>
            {dataset.frequency === "annual"
              ? "Census CBP"
              : source.url.includes("censusreporter")
                ? "Census ACS / Reporter"
                : "Census ACS archive"}
          </Source>
        ) : (
          <span key={id}>Source retrieval unavailable</span>
        );
      })}
    </div>
  );
}

export function MetricKind({
  dataset,
  indexed = false,
}: {
  dataset: PulseDataset;
  indexed?: boolean;
}) {
  return (
    <Evidence
      tone={indexed || dataset.kind === "derived" ? "model" : "observed"}
    >
      {indexed
        ? "Derived index"
        : dataset.kind === "derived"
          ? "Derived ratio"
          : "Published value"}
    </Evidence>
  );
}

export function ComparisonChart({
  dataset,
  geographies,
  sources,
  start,
  mode,
}: {
  dataset: PulseDataset;
  geographies: PulseBundle["geographies"];
  sources: PulseBundle["sources"];
  start: number;
  mode: DisplayMode;
}) {
  const geos = geographies.map((g) => g.id);
  const rows = comparisonRows(dataset, geos, start, mode);
  const unit = mode === "index" ? "index" : dataset.unit;
  return (
    <>
      <div
        className="pulse-chart"
        role="img"
        aria-label={`${dataset.label} historical comparison, ${mode === "index" ? "indexed to first displayed period" : "published units"}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 14, right: 20, bottom: 8, left: 2 }}
            accessibilityLayer
          >
            <CartesianGrid
              stroke="#dce4df"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickFormatter={(y) =>
                dataset.frequency === "annual"
                  ? String(y)
                  : `${Number(y) - 4}-${y}`
              }
            />
            <YAxis
              width={62}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatValue(v, unit, true)}
              domain={mode === "index" ? ["auto", "auto"] : [0, "auto"]}
            />
            <Tooltip
              content={({ active, label }) =>
                active ? (
                  <div className="pulse-tooltip">
                    <b>
                      {dataset.label} | {String(label)}
                    </b>
                    {geographies.map((g) => (
                      <div key={g.id}>
                        <span style={{ color: geoColors[g.id] }}>{g.name}</span>
                        <ObservationDetail
                          dataset={dataset}
                          sources={sources}
                          observation={observedAt(dataset, g.id, Number(label))}
                          indexed={mode === "index"}
                          value={
                            rows.find((r) => r.year === Number(label))?.[g.id]
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            {geographies
              .filter((g) => rows.some((r) => r[g.id] !== null))
              .map((g) => (
                <Line
                  key={g.id}
                  name={g.name}
                  dataKey={g.id}
                  stroke={geoColors[g.id]}
                  strokeWidth={2}
                  strokeDasharray={
                    g.id === "mount-olive"
                      ? undefined
                      : g.id === "morris"
                        ? "7 3"
                        : "2 3"
                  }
                  dot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                  type="linear"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!rows.some((r) => geos.some((g) => r[g] !== null)) && (
        <p role="status" className="eco-caveat">
          No observations available for these areas and units.
        </p>
      )}
      <div className="eco-chart-legend">
        {geographies.map((g) => (
          <span key={g.id}>
            <i style={{ background: geoColors[g.id] }} />
            {g.name}
            {!rows.some((r) => r[g.id] !== null) && " (unavailable)"}
          </span>
        ))}
      </div>
      <details className="eco-method pulse-table-detail">
        <summary>Observations & source details</summary>
        <div className="eco-table-wrap">
          <table className="eco-table">
            <caption>
              {dataset.label} -{" "}
              {mode === "index"
                ? `derived index, ${rows[0]?.year} = 100`
                : "source values"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                {geographies.map((g) => (
                  <th key={g.id} scope="col">
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year}>
                  <th scope="row">
                    {dataset.frequency === "annual"
                      ? r.year
                      : `${r.year - 4}-${r.year}`}
                  </th>
                  {geos.map((g) => (
                    <td key={g}>
                      <ObservationDetail
                        dataset={dataset}
                        sources={sources}
                        observation={observedAt(dataset, g, r.year)}
                        indexed={mode === "index"}
                        value={r[g]}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function GeographyControls({
  geographies,
  selected,
  onChange,
}: {
  geographies: PulseBundle["geographies"];
  selected: GeoId[];
  onChange: (ids: GeoId[]) => void;
}) {
  return (
    <fieldset className="pulse-geographies">
      <legend>Comparison areas</legend>
      {geographies.map((g) => (
        <label key={g.id}>
          <input
            type="checkbox"
            checked={selected.includes(g.id)}
            disabled={selected.length === 1 && selected.includes(g.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, g.id]
                  : selected.filter((id) => id !== g.id),
              )
            }
          />
          <i style={{ background: geoColors[g.id] }} />
          {g.name}
        </label>
      ))}
    </fieldset>
  );
}
