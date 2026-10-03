import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categories, type CategoryId, type CategorySummary } from "./types";
import { fmt, signed, offsetMonth } from "./engine";
import { chartTooltip } from "../formatters";

export function InterestChart({
  rows,
  start,
  onSelect,
  small = false,
}: {
  rows: CategorySummary[];
  start: string;
  onSelect?: (id: CategoryId) => void;
  small?: boolean;
}) {
  const observed = [
    ...new Set(rows.flatMap((r) => r.history.map((p) => p.date))),
  ]
    .filter((d) => d.slice(0, 7) >= start)
    .sort();
  // Keep entirely absent months on the axis so lines do not bridge missing data.
  const dates =
    start && observed.length
      ? Array.from(
          { length: 24 },
          (_, i) => `${offsetMonth(start, i)}-01`,
        ).filter((date) => date <= observed.at(-1)!)
      : [];
  const data = dates.map((date) => ({
    date: date.slice(0, 7),
    ...Object.fromEntries(
      rows.map((r) => [
        r.category,
        r.history.find((p) => p.date === date)?.interest ?? null,
      ]),
    ),
  }));
  return (
    <div
      className={small ? "demand-spark" : "demand-line"}
      role="img"
      aria-label="Search Interest Index over time, normalized 0 to 100"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 4, left: small ? 0 : 6 }}
          accessibilityLayer
        >
          {!small && (
            <CartesianGrid
              stroke="#dce4df"
              vertical={false}
              strokeDasharray="3 3"
            />
          )}
          <XAxis
            hide={small}
            dataKey="date"
            tick={{ fontSize: 10 }}
            minTickGap={24}
          />
          <YAxis
            hide={small}
            domain={[0, 100]}
            width={32}
            tick={{ fontSize: 10 }}
          />
          {!small && (
            <Tooltip
              {...chartTooltip}
              formatter={(v: number) => `${v.toFixed(1)} / 100`}
            />
          )}
          {rows.map((r) => (
            <Line
              key={r.category}
              dataKey={r.category}
              name={r.name}
              stroke={categories.find((c) => c.id === r.category)!.color}
              strokeWidth={small ? 1.6 : 2.2}
              type="linear"
              isAnimationActive={false}
              connectNulls={false}
              dot={small ? false : { r: 2 }}
              activeDot={
                onSelect
                  ? {
                      r: 6,
                      onClick: () => onSelect(r.category),
                      cursor: "pointer",
                    }
                  : { r: 5 }
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GapMatrix({
  rows,
  onSelect,
  reason,
}: {
  rows: CategorySummary[];
  onSelect: (id: CategoryId) => void;
  reason: string | null;
}) {
  if (reason)
    return (
      <div className="demand-matrix-empty">
        <strong>Comparison not available</strong>
        <p>{reason}</p>
        <p>Interest history and observed supply remain available below.</p>
      </div>
    );
  const valid = rows.filter((r) => r.demandGap !== null);
  const extent =
    Math.max(
      2,
      ...valid.flatMap((r) => [Math.abs(r.demandZ!), Math.abs(r.supplyZ!)]),
    ) + 0.4;
  return (
    <>
      <div
        className="demand-matrix"
        role="img"
        aria-label="Demand Gap Matrix: standardized search interest versus standardized supply"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 22, right: 22, bottom: 24, left: 5 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="#dce4df" strokeDasharray="2 5" />
            <XAxis
              type="number"
              dataKey="supplyZ"
              domain={[-extent, extent]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => Number(v).toFixed(1)}
              name="Standardized supply"
              label={{
                value: "Local business supply (standardized)",
                position: "bottom",
                offset: 2,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="demandZ"
              domain={[-extent, extent]}
              width={32}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => Number(v).toFixed(1)}
              name="Standardized interest"
            />
            <ReferenceArea
              x1={-extent}
              x2={0}
              y1={0}
              y2={extent}
              fill="#d6ebd6"
              fillOpacity={0.65}
              label={{
                value: "Opportunity signals",
                position: "insideTopLeft",
                fontSize: 11,
                fill: "#35624a",
              }}
            />
            <ReferenceArea
              x1={0}
              x2={extent}
              y1={0}
              y2={extent}
              fill="#deebf2"
              fillOpacity={0.65}
              label={{
                value: "High activity",
                position: "insideTopRight",
                fontSize: 11,
                fill: "#416c84",
              }}
            />
            <ReferenceArea
              x1={-extent}
              x2={0}
              y1={-extent}
              y2={0}
              fill="#e9eeeb"
              fillOpacity={0.7}
              label={{
                value: "Low activity",
                position: "insideBottomLeft",
                fontSize: 11,
                fill: "#65766b",
              }}
            />
            <ReferenceArea
              x1={0}
              x2={extent}
              y1={-extent}
              y2={0}
              fill="#f2e7d6"
              fillOpacity={0.7}
              label={{
                value: "Potential saturation",
                position: "insideBottomRight",
                fontSize: 11,
                fill: "#8b6231",
              }}
            />
            <ReferenceLine x={0} stroke="#9bad9f" />
            <ReferenceLine y={0} stroke="#9bad9f" />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as CategorySummary | undefined;
                return active && r ? (
                  <div className="demand-tooltip">
                    <b>{r.name}</b>
                    <span>Search Interest: {fmt(r.averageInterest)} / 100</span>
                    <span>Local listings: {r.businessCount}</span>
                    <span>Demand Gap: {signed(r.demandGap, 2)}</span>
                    <span>
                      3M trend:{" "}
                      {r.change3m === null
                        ? "Unavailable"
                        : `${signed(r.change3m)}%`}
                    </span>
                  </div>
                ) : null;
              }}
            />
            <Scatter
              data={valid}
              isAnimationActive={false}
              shape={(props: unknown) => {
                const {
                  cx = 0,
                  cy = 0,
                  payload: r,
                } = props as {
                  cx: number;
                  cy: number;
                  payload: CategorySummary;
                };
                const c = categories.find((c) => c.id === r.category)!;
                const group = valid
                  .filter((v) => v.supplyZ === r.supplyZ)
                  .sort((a, b) => b.demandZ! - a.demandZ!);
                const left =
                  r.supplyZ! > 1 ||
                  group.findIndex((v) => v.category === r.category) % 2 === 1;
                return (
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${r.name} details`}
                    onClick={() => onSelect(r.category)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(r.category);
                      }
                    }}
                    className="demand-bubble"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7 + Math.sqrt(r.businessCount) * 1.3}
                      fill={c.color}
                      stroke="white"
                      strokeWidth={2}
                    />
                    <text
                      className="demand-bubble-label"
                      x={cx + (left ? -12 : 12)}
                      y={cy - 12}
                      textAnchor={left ? "end" : "start"}
                      fill="#253f30"
                      fontSize={10}
                    >
                      {c.short}
                    </text>
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="eco-footnote">
        Y: standardized consumer search interest. Bubble size: represented
        listings. Zero lines are the comparison-cohort means, not economic
        thresholds.
      </p>
    </>
  );
}
