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
