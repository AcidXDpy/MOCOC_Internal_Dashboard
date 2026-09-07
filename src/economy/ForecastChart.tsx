import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast } from "./types";
import { chartTooltip, month } from "./formatters";

export function ForecastChart({
  forecast,
  years = 5,
  horizon = 6,
}: {
  forecast: Forecast;
  years?: number;
  horizon?: number;
}) {
  const historic = forecast.history.slice(-years * 12).map((p) => ({
    date: p.date,
    actual: p.value,
    predicted: null as number | null,
    band: null as [number, number] | null,
  }));
  const last = historic.at(-1);
  if (last) last.predicted = last.actual;
  const points = [
    ...historic,
    ...forecast.predictions.slice(0, horizon).map((p) => ({
      date: p.date,
      actual: null,
      predicted: p.value,
      band: [p.lower, p.upper] as [number, number],
    })),
  ];
  return (
    <div
      className="eco-chart"
      role="img"
      aria-label="Observed Morris County unemployment rate with forecast and prediction interval"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 20, right: 18, left: -20, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#e3e8e5" />
          <XAxis
            dataKey="date"
            tickFormatter={month}
            minTickGap={60}
            tick={{ fontSize: 11, fill: "#68776f" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#68776f" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...chartTooltip}
            labelFormatter={(value) => month(String(value))}
          />
          <ReferenceLine
            x={forecast.observedThrough}
            stroke="#99aaa0"
            strokeDasharray="3 4"
          />
          <Area
            type="linear"
            dataKey="band"
            name={`${forecast.intervalLevel * 100}% prediction interval`}
            stroke="none"
            fill="#cba277"
            fillOpacity={0.24}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="actual"
            name="Observed rate (%)"
            stroke="#15816e"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="predicted"
            name="Forecast (%)"
            stroke="#b86f32"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
