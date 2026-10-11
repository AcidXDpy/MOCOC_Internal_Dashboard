import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  Database,
  FlaskConical,
  Globe2,
  MapPinned,
  Menu,
  Network,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import logo from "../assets/mount-olive-chamber-logo.png";
import type { EconomicView, EconomyResults } from "./types";
import {
  EconomyOverview,
  IndustryView,
  HealthView,
  DynamicsView,
  EvidenceView,
} from "./EconomyViews";
import { Evidence } from "./shared";
import "./economy.css";

const LaborView = lazy(() => import("./LaborView"));
const NetworkView = lazy(() => import("./NetworkView"));
const SpatialView = lazy(() => import("./SpatialView"));
const ResilienceView = lazy(() => import("./ResilienceView"));
const PolicyLab = lazy(() => import("./PolicyLab"));
const ResearchView = lazy(() => import("./ResearchView"));
const LocalEconomicPulse = lazy(() => import("./pulse/LocalEconomicPulse"));
const LocalDemand = lazy(() => import("./demand/LocalDemand"));
const items = [
  {
    id: "overview",
    label: "Local economy",
    icon: Globe2,
    scope: "Mount Olive / Morris County",
  },
  {
    id: "pulse",
    label: "Local Economic Pulse",
    icon: Activity,
    scope: "Mount Olive Township / Morris County / New Jersey",
  },
  {
    id: "demand",
    label: "Local Demand",
    icon: Search,
    scope: "Search behavior as a signal of the local economy",
  },
  {
    id: "health",
    label: "Health index research",
    icon: Activity,
    scope: "Morris County census tracts",
  },
  {
    id: "labor",
    label: "Labor & early warnings",
    icon: ChartNoAxesCombined,
    scope: "Morris County · monthly",
  },
  {
    id: "industry",
    label: "Industry structure",
    icon: Building2,
    scope: "County / core ZIP comparison",
  },
  {
    id: "spatial",
    label: "Spatial economics",
    icon: MapPinned,
    scope: "Morris County / directory footprint",
  },
  {
    id: "network",
    label: "Economic network",
    icon: Network,
    scope: "Regional sector / business relationships",
  },
  {
    id: "dynamics",
    label: "Business dynamics",
    icon: Activity,
    scope: "Cohort evidence & causal identification",
  },
  {
    id: "resilience",
    label: "Resilience lab",
    icon: ShieldCheck,
    scope: "Conditional sector exposure",
  },
  {
    id: "policy",
    label: "Policy lab",
    icon: Scale,
    scope: "Hypothetical resource allocation",
  },
  {
    id: "evidence",
    label: "Data observatory",
    icon: Database,
    scope: "Sources, vintage & coverage",
  },
  {
    id: "research",
    label: "Research library",
    icon: BookOpen,
    scope: "Technical design & scientific roadmap",
  },
] as const;
const fromHash = (): EconomicView => {
  const key = window.location.hash.slice(1);
  return items.some((i) => i.id === key) ? (key as EconomicView) : "overview";
};
class ViewBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div role="alert" className="eco-error">
        This analysis could not render.{" "}
        <button className="eco-button" onClick={() => window.location.reload()}>
          Reload data
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function EconomicPlatform() {
  const [view, setView] = useState<EconomicView>(fromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<EconomyResults | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const update = () => {
      if (window.location.hash !== "#economic-content") setView(fromHash());
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/economy/model-results.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error(`Economic bundle could not be loaded (${r.status}).`);
        return r.json();
      })
      .then((result: EconomyResults) => {
        if (
          result.schemaVersion !== "1.0.0" ||
          !result.coverage ||
          !Array.isArray(result.sources) ||
          !result.forecast?.method
        )
          throw new Error("Economic bundle has an unsupported format.");
        setData(result);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  const navigate = (next: EconomicView) => {
    window.history.pushState(null, "", `#${next}`);
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  };
  const current = items.find((i) => i.id === view)!;
  return (
    <div className="eco-app">
      <a className="eco-skip" href="#economic-content">
        Skip to analysis
      </a>
      <aside className={`eco-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="eco-brand">
          <img src={logo} alt="Mount Olive Area Chamber of Commerce" />
          <strong>MOCA</strong>
          <span>Mount Olive, New Jersey</span>
        </div>
        <button
          className="eco-mobile-close eco-icon-button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Economic analysis">
          {items.map((item, i) => (
            <div key={item.id}>
              {(i === 0 ||
                item.id === "resilience" ||
                item.id === "evidence") && (
                <p className="eco-nav-label">
                  {i === 0
                    ? "Monitor & analyze"
                    : item.id === "resilience"
                      ? "Experiment"
                      : "Evidence & methods"}
                </p>
              )}
              <button
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
                {view === item.id && <span className="eco-active-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <a className="eco-legacy" href="/chamber">
          Chamber workspace <ArrowUpRight size={14} />
        </a>
        <p className="eco-sidebar-credit">
          Developed by
          <br />
          <strong>Nakul Ramprasad</strong>
        </p>
      </aside>
      {mobileOpen && (
        <button
          className="eco-scrim"
          aria-label="Dismiss navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="eco-main" id="economic-content">
        <div className="eco-topbar">
          <button
            className="eco-mobile-menu eco-icon-button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span>
            <FlaskConical size={15} />
            Regional economic research
          </span>
          <div>
            <span className="eco-status-dot" />
            <span>
              {view === "demand"
                ? "Search signals / represented supply"
                : view === "pulse"
                  ? "ACS & business patterns"
                  : data
                    ? `Evidence bundle · ${data.asOfDate}`
                    : "Loading evidence"}
            </span>
          </div>
        </div>
        <div className="eco-content">
          <header className="eco-page-heading">
            <div>
              <p>Mount Olive / MOCA</p>
              <h1>{current.label}</h1>
              <span>{current.scope}</span>
            </div>
            <Evidence
              tone={
                view === "policy" || view === "resilience" || view === "demand"
                  ? "scenario"
                  : "observed"
              }
            >
              {view === "demand"
                ? "Exploratory demand analysis"
                : view === "policy" || view === "resilience"
                  ? "Assumption-driven scenario"
                  : "Source-linked evidence"}
            </Evidence>
          </header>
          {view === "demand" ? (
            <ViewBoundary key={view}>
              <Suspense
                fallback={
                  <div className="eco-loading" role="status">
                    Loading Local Demand...
                  </div>
                }
              >
                <LocalDemand />
              </Suspense>
            </ViewBoundary>
          ) : view === "pulse" ? (
            <ViewBoundary key={view}>
              <Suspense
                fallback={
                  <div className="eco-loading" role="status">
                    Loading comparison...
                  </div>
                }
              >
                <LocalEconomicPulse />
              </Suspense>
            </ViewBoundary>
          ) : error ? (
            <div className="eco-error" role="alert">
              <p>{error}</p>
              <button
                className="eco-button"
                onClick={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          ) : !data ? (
            <div className="eco-loading" role="status">
              Loading economic observations and model results...
            </div>
          ) : (
            <ViewBoundary key={view}>
              <Suspense
                fallback={
                  <div className="eco-loading" role="status">
                    Loading analysis...
                  </div>
                }
              >
                {view === "overview" && (
                  <EconomyOverview data={data} navigate={navigate} />
                )}
                {view === "health" && <HealthView data={data} />}
                {view === "labor" && <LaborView data={data} />}
                {view === "industry" && <IndustryView data={data} />}
                {view === "spatial" && <SpatialView data={data} />}
                {view === "network" && <NetworkView data={data} />}
                {view === "dynamics" && <DynamicsView data={data} />}
                {view === "resilience" && <ResilienceView data={data} />}
                {view === "policy" && <PolicyLab />}
                {view === "evidence" && <EvidenceView data={data} />}
                {view === "research" && <ResearchView />}
              </Suspense>
            </ViewBoundary>
          )}
          <footer className="eco-footer">
            <span>MOCA</span>
            <span>Developed by Nakul Ramprasad</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
