import { BarChart3, ClipboardList, LayoutDashboard, MapPinned, Search, Sparkles, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import chamberLogo from "../assets/mount-olive-chamber-logo.png";

export type ViewKey = "overview" | "directory" | "map" | "insights" | "engagement" | "actions";

const navItems: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Executive Overview", icon: LayoutDashboard },
  { key: "directory", label: "Member Directory", icon: Table2 },
  { key: "map", label: "Member Map", icon: MapPinned },
  { key: "insights", label: "Chamber Insights", icon: BarChart3 },
  { key: "engagement", label: "Engagement Prep", icon: Sparkles },
  { key: "actions", label: "Action Center", icon: ClipboardList },
];

export function Shell({
  activeView,
  setActiveView,
  children,
}: {
  activeView: ViewKey;
  setActiveView: (view: ViewKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-ink-900/95 p-5 lg:block">
        <div className="mb-8">
          <img
            src={chamberLogo}
            alt="Mount Olive Area Chamber of Commerce"
            className="h-auto w-52"
          />
          <h1 className="mt-4 text-2xl font-semibold leading-tight">Chamber Engagement Command Center</h1>
          <p className="mt-2 text-sm text-slate-400">Internal analytics dashboard for member engagement and retention</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  active ? "bg-signal-blue/[0.15] text-white ring-1 ring-signal-blue/30" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => setActiveView(item.key)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`shrink-0 rounded-full px-3 py-2 text-xs ${activeView === item.key ? "bg-signal-blue text-ink-950" : "bg-white/10 text-slate-300"}`}
                onClick={() => setActiveView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-signal-teal">Internal Dashboard</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
        <Search size={16} />
        Phase 1 readiness view
      </div>
    </header>
  );
}
