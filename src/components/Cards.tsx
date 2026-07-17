import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "text-signal-blue",
    green: "text-signal-green",
    amber: "text-signal-amber",
    red: "text-signal-red",
  };
  const surfaces = {
    blue: "border-signal-blue/35 bg-signal-blue/[0.1]",
    green: "border-signal-green/35 bg-signal-green/[0.12]",
    amber: "border-signal-amber/35 bg-signal-amber/[0.12]",
    red: "border-signal-red/35 bg-signal-red/[0.1]",
  };
  const topBars = {
    blue: "bg-signal-blue",
    green: "bg-signal-green",
    amber: "bg-signal-amber",
    red: "bg-signal-red",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-4 shadow-glow ${surfaces[tone]}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${topBars[tone]}`} />
      <p className="text-sm text-slate-300">{label}</p>
      <div className={`mt-3 text-3xl font-semibold ${tones[tone]}`}>
        {value}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export function AlertCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "border-signal-blue/35 bg-signal-blue/[0.12] text-signal-blue",
    green: "border-signal-green/35 bg-signal-green/[0.14] text-signal-green",
    amber: "border-signal-amber/35 bg-signal-amber/[0.14] text-signal-amber",
    red: "border-signal-red/35 bg-signal-red/[0.12] text-signal-red",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-signal-blue/15 bg-ink-900/80 p-5 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProgressLine({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  const tone =
    value >= 75
      ? "bg-signal-green"
      : value >= 40
        ? "bg-signal-amber"
        : "bg-signal-red";
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-slate-300">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
      ) : null}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-md border border-signal-blue/25 bg-signal-blue/[0.08] px-3 py-2 text-xs leading-5 text-slate-200">
      <span className="font-semibold text-slate-100">Data status:</span> current
      analysis is based on the latest public Chamber directory snapshot.
      Attendance and outreach metrics will populate when those records are
      added.
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-signal-blue/30 bg-ink-900/70 p-5 text-center">
      <CircleDashed className="mx-auto text-slate-500" size={24} />
      <p className="mt-3 font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const healthy =
    normalized === "active" ||
    normalized.includes("available") ||
    normalized.includes("strong") ||
    normalized.includes("complete") ||
    normalized.includes("listed");
  const risky =
    normalized.includes("missing") ||
    normalized.includes("needs") ||
    normalized.includes("past due") ||
    normalized === "inactive";
  const cls = healthy
    ? "bg-signal-green/[0.12] text-signal-green ring-signal-green/25"
    : risky
      ? "bg-signal-red/[0.12] text-signal-red ring-signal-red/25"
      : "bg-signal-amber/[0.12] text-signal-amber ring-signal-amber/25";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cls}`}
    >
      {value}
    </span>
  );
}

export function InsightCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-signal-blue/35 bg-signal-blue/[0.12] p-4 text-sm leading-6 text-slate-100">
      <CheckCircle2 className="mb-3 text-signal-teal" size={20} />
      {text}
    </div>
  );
}

export function RiskLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-signal-amber/35 bg-signal-amber/[0.12] p-3 text-sm text-slate-200">
      <AlertTriangle className="mt-0.5 shrink-0 text-signal-amber" size={16} />
      {text}
    </div>
  );
}
