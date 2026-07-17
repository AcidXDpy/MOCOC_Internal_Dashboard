import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  MapPinned,
  Search,
  Table2,
  UserRoundSearch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import chamberLogo from "../assets/mount-olive-chamber-logo.png";
import { lastUpdatedLabel } from "../utils/analytics";

export type ViewKey =
  | "overview"
  | "businessIntelligence"
  | "memberWorkspace"
  | "directory"
  | "map"
  | "insights"
  | "outreach"
  | "dataQuality"
  | "methodology"
  | "project";

const navItems: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  {
    key: "businessIntelligence",
    label: "Business Intel",
    icon: BriefcaseBusiness,
  },
  { key: "memberWorkspace", label: "Member Preview", icon: UserRoundSearch },
  { key: "directory", label: "Members", icon: Table2 },
  { key: "map", label: "Map", icon: MapPinned },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "outreach", label: "Outreach", icon: ClipboardList },
  { key: "dataQuality", label: "Data Quality", icon: Database },
  { key: "methodology", label: "Methodology", icon: FileText },
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
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-ink-900/95 p-4 lg:block">
        <div className="mb-7 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <img
            src={chamberLogo}
            alt="Mount Olive Area Chamber of Commerce"
            className="h-auto w-40"
          />
          <h1 className="mt-5 text-xl font-semibold leading-tight">
            Mount Olive Chamber Analytics
          </h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Member Intelligence & Outreach Platform
          </p>
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-signal-teal/50 ${
                  active
                    ? "bg-signal-teal/[0.12] text-white ring-1 ring-signal-teal/25"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
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
      <main className="app-main-shell lg:pl-64">
        <div className="mobile-nav sticky top-0 z-20 border-b border-white/10 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`shrink-0 rounded-md px-3 py-2 text-xs ${activeView === item.key ? "bg-signal-teal text-ink-950" : "bg-white/10 text-slate-300"}`}
                onClick={() => setActiveView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="app-content px-4 py-6 sm:px-6 lg:px-7 xl:px-8">
          {children}
          <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
            Developed by Nakul Ramprasad
          </footer>
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-signal-teal">
          Mount Olive Chamber Analytics
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
        <Search size={16} />
        Last updated {lastUpdatedLabel}
      </div>
    </header>
  );
}
