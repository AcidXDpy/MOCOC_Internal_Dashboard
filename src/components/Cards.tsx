import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

export function MetricCard({ label, value, detail, tone = "blue" }: { label: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "red" }) {
  const tones = {
    blue: "text-signal-blue",
    green: "text-signal-green",
    amber: "text-signal-amber",
    red: "text-signal-red",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-glow">
      <p className="text-sm text-slate-400">{label}</p>
      <div className={`mt-3 text-3xl font-semibold ${tones[tone]}`}>{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export function AlertCard({ label, value, detail, tone = "blue" }: { label: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "red" }) {
  const tones = {
    blue: "border-signal-blue/25 bg-signal-blue/[0.08] text-signal-blue",
    green: "border-signal-green/25 bg-signal-green/[0.08] text-signal-green",
    amber: "border-signal-amber/25 bg-signal-amber/[0.08] text-signal-amber",
    red: "border-signal-red/25 bg-signal-red/[0.08] text-signal-red",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProgressLine({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const tone = value >= 75 ? "bg-signal-green" : value >= 40 ? "bg-signal-amber" : "bg-signal-red";
  return (
    <div className="rounded-lg bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-slate-300">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      {detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-6 rounded-lg border border-signal-teal/25 bg-signal-teal/[0.08] px-4 py-3 text-sm leading-6 text-slate-200">
      <span className="font-semibold text-signal-teal">Phase 1 prototype:</span> using the current directory scrape with visible placeholders where structured engagement, renewal, and outreach data still needs to be collected.
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-ink-900/60 p-5 text-center">
      <CircleDashed className="mx-auto text-slate-500" size={24} />
      <p className="mt-3 font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const healthy = normalized === "active" || normalized.includes("available") || normalized.includes("strong");
  const risky = normalized.includes("risk") || normalized.includes("missing") || normalized.includes("needs") || normalized === "inactive";
  const cls = healthy
    ? "bg-signal-green/[0.12] text-signal-green ring-signal-green/25"
    : risky
      ? "bg-signal-red/[0.12] text-signal-red ring-signal-red/25"
      : "bg-signal-amber/[0.12] text-signal-amber ring-signal-amber/25";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cls}`}>{value}</span>;
}

export function InsightCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-signal-blue/20 bg-signal-blue/[0.08] p-4 text-sm leading-6 text-slate-200">
      <CheckCircle2 className="mb-3 text-signal-teal" size={20} />
      {text}
    </div>
  );
}

export function RiskLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-signal-amber/20 bg-signal-amber/[0.08] p-3 text-sm text-slate-300">
      <AlertTriangle className="mt-0.5 shrink-0 text-signal-amber" size={16} />
      {text}
    </div>
  );
}
