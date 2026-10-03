import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  MapPinned,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Caveat, Method, Section } from "../shared";
import {
  categories,
  type CategoryId,
  type DemandBatch,
  type SortKey,
} from "./types";
import { demoBatch } from "./demo";
import {
  exportAnalysis,
  fmt,
  interpretation,
  signed,
  sortSummaries,
  summarize,
} from "./engine";
import { localSupply, supplyNote } from "./supply";
import { downloadText, readImports, saveImports, storageKey } from "./store";
import { GapMatrix, InterestChart } from "./DemandCharts";
import ImportDialog from "./ImportDialog";
import CategoryDialog from "./CategoryDialog";
import "./demand.css";
const DemandMap = lazy(() => import("./DemandMap"));

export default function LocalDemand() {
  const [saved, setSaved] = useState(readImports);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === storageKey || e.key === null) setSaved(readImports());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const [source, setSource] = useState("demo");
  const [batchId, setBatchId] = useState("");
  const [months, setMonths] = useState(12);
  const [importOpen, setImportOpen] = useState(false);
  const [replace, setReplace] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<CategoryId[]>([
    "home",
    "fitness",
    "childcare",
  ]);
  const [detail, setDetail] = useState<CategoryId | null>(null);
  const [mapCategory, setMapCategory] = useState<CategoryId>("home");
  const [tab, setTab] = useState("demand");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("demandGap");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const batch =
    source === "demo"
      ? demoBatch
      : (saved.imports.find((b) => b.id === batchId) ??
        saved.imports[0] ??
        null);
  const analysis = useMemo(
    () => summarize(batch ?? { ...demoBatch, series: [] }, months),
    [batch, months],
  );
  const { rows } = analysis;
  const validSelected = selected.filter((id) =>
    rows.some((r) => r.category === id),
  );
  const chartIds = validSelected.length
    ? validSelected
    : rows.slice(0, 3).map((r) => r.category);
  const byGap = sortSummaries(rows, "demandGap", "desc");
  const ranking = sortSummaries(rows, "averageInterest", "desc");
  const rising = sortSummaries(rows, "change3m", "desc").filter(
    (r) => r.change3m !== null && r.change3m > 0,
  );
  const strongest =
    batch?.comparable && analysis.commonMonths >= 2 ? ranking[0] : undefined;
  const biggest = byGap.find((r) => r.demandGap !== null && r.demandGap > 0);
  const shown = sortSummaries(rows, sort, direction).filter((r) =>
    `${r.name} ${r.query}`.toLowerCase().includes(search.toLowerCase()),
  );
  const chosen = rows.find((r) => r.category === detail);
  const mapRow = rows.find((r) => r.category === mapCategory) ?? rows[0];
  const geographies =
    source === "demo"
      ? [demoBatch.geography]
      : [...new Set(saved.imports.map((b) => b.geography))];

  function save(batch: DemandBatch, replaceId: string) {
    const current = readImports();
    if (current.error)
      throw new Error(
        "Unreadable saved data is protected. Restore it or clear this site's storage before saving new imports.",
      );
    if (replaceId && !current.imports.some((b) => b.id === replaceId))
      throw new Error(
        "This comparison changed in another tab. Close this dialog and select the current import before replacing it.",
      );
    const imports = [
      ...current.imports.filter((b) => b.id !== replaceId),
      batch,
    ];
    saveImports(imports);
    setSaved({ imports, error: "" });
    setBatchId(batch.id);
    setSource("import");
    setSelected(batch.series.slice(0, 3).map((s) => s.category));
    setNotice(`Imported ${batch.name}. Saved on this browser only.`);
  }
  function remove() {
    if (
      !batch ||
      batch.source === "demo" ||
      !window.confirm(`Delete ${batch.name} from this browser?`)
    )
      return;
    try {
      const current = readImports();
      if (current.error) throw new Error(current.error);
      const imports = current.imports.filter((b) => b.id !== batch.id);
      saveImports(imports);
      setSaved({ imports, error: "" });
      setBatchId(imports[0]?.id ?? "");
      setNotice("Import deleted from this browser.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const setSorting = (key: SortKey) => {
    setDirection(key === sort && direction === "desc" ? "asc" : "desc");
    setSort(key);
  };
  return (
    <div className="demand-module">
      <p className="demand-print-method">
        Demand Gap = population z(mean Search Interest Index) minus population
        z(represented supply share), across the selected comparison cohort.
        Supply is an incomplete public directory snapshot from July 16, 2026.
        Search interest is normalized, not search counts or purchasing demand.
        Signals are descriptive, not causal proof.
      </p>
      <p className="demand-intro">
        Compare consumer search interest with Mount Olive's represented business
        landscape.
      </p>
      <div className="demand-toolbar">
        <label>
          Data Source
          <select
            aria-label="Demand data source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setDetail(null);
            }}
          >
            <option value="demo">Demo</option>
            <option value="import">Imported Google Trends</option>
          </select>
        </label>
        <label>
          Geography
          <select
            aria-label="Demand geography"
            value={batch?.geography ?? ""}
            disabled={!geographies.length}
            onChange={(e) =>
              setBatchId(
                saved.imports.find((b) => b.geography === e.target.value)?.id ??
                  "",
              )
            }
          >
            {!geographies.length && (
              <option value="">No imported geography</option>
            )}
            {geographies.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Time Range
          <select
            aria-label="Demand time range"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {[3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
          </select>
        </label>
        <button
          className="eco-button demand-primary"
          onClick={() => {
            setReplace("");
            setImportOpen(true);
          }}
        >
          <Upload size={16} />
          Import Trends Data
        </button>
        <button
          className="eco-icon-button"
          title="Export Analysis"
          aria-label="Export Analysis"
          disabled={!batch || !rows.length}
          onClick={() =>
            batch &&
            downloadText(
              "local-demand-analysis.csv",
              exportAnalysis(batch, analysis),
            )
          }
        >
          <Download size={18} />
        </button>
        <button
          className="eco-icon-button"
          title="Print / Save PDF"
          aria-label="Print / Save PDF"
          disabled={!batch || !rows.length}
          onClick={() => window.print()}
        >
          <Printer size={18} />
        </button>
      </div>
      {source === "import" && saved.imports.length > 0 && (
        <div className="demand-imports">
          <label>
            Comparison export
            <select
              aria-label="Comparison export"
              value={batch?.id ?? ""}
              onChange={(e) => setBatchId(e.target.value)}
            >
              {saved.imports
                .filter((b) => b.geography === batch?.geography)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <span>
            Imported{" "}
            {batch?.importedAt
              ? new Date(batch.importedAt).toLocaleString()
              : ""}{" "}
            · browser-local
          </span>
          <button
            className="eco-icon-button"
            title="Replace this import"
            aria-label="Replace this import"
            onClick={() => {
              setReplace(batch!.id);
              setImportOpen(true);
            }}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="eco-icon-button"
            title="Delete this import"
            aria-label="Delete this import"
            onClick={remove}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {saved.error && (
        <p role="alert" className="demand-error">
          {saved.error}
        </p>
      )}
      {notice && (
        <p role="status" className="demand-notice">
          {notice}
        </p>
      )}
      {batch ? (
        <>
          <div className="demand-evidence">
            <span
              className={
                batch.demoSample ? "demand-demo" : "demand-import-badge"
              }
            >
              {batch.demoSample ? "Demo Data" : "Google Trends Import"}
            </span>
            <strong>Search geography: {batch.geography}</strong>
            <span>
              {analysis.start} to {analysis.end}
            </span>
          </div>
          <p className="eco-footnote">
            {batch.demoSample
              ? "Import Google Trends data to replace demonstration search signals. "
              : "User-supplied aggregate search-interest indexes, not independently authenticated. "}
            Normalized interest, not raw search counts or individual histories.
            Supply: {localSupply.length} mapped public listings with coordinates
            inside the township boundary; coordinates unverified.
          </p>
          <p className="eco-footnote">
            Coverage caution: {rows.filter((r) => r.businessCount === 0).length}{" "}
            of {rows.length} selected categories have no represented listings.
            This is not evidence of no local businesses.
          </p>
          <div className="demand-kpis">
            <div>
              <span>Categories Tracked</span>
              <strong>{rows.length}</strong>
              <small>{analysis.commonMonths} common observed months</small>
            </div>
            <button
              disabled={!strongest}
              onClick={() => strongest && setDetail(strongest.category)}
            >
              <span>Strongest Demand Signal</span>
              <strong>{strongest?.name ?? "Not comparable"}</strong>
              <small>
                {strongest
                  ? `${fmt(strongest.averageInterest)} / 100 average interest`
                  : "Shared comparison scale required"}
              </small>
            </button>
            <button
              disabled={!biggest}
              onClick={() => biggest && setDetail(biggest.category)}
            >
              <span>Largest Demand Gap</span>
              <strong>{biggest?.name ?? "Unavailable"}</strong>
              <small>
                {biggest
                  ? `${signed(biggest.demandGap, 2)} standardized gap`
                  : "No eligible positive gap"}
              </small>
            </button>
            <button
              disabled={!rising.length}
              onClick={() => rising[0] && setDetail(rising[0].category)}
            >
              <span>Fastest Rising Interest</span>
              <strong>{rising[0]?.name ?? "No positive trend"}</strong>
              <small>
                {rising[0]
                  ? `${signed(rising[0].change3m)}% / latest 3M vs prior 3M`
                  : "Six observed months required"}
              </small>
            </button>
          </div>
          <div role="tablist" aria-label="Demand view" className="demand-tabs">
            <button
              role="tab"
              aria-selected={tab === "demand"}
              onClick={() => setTab("demand")}
            >
              Demand
            </button>
            <button
              role="tab"
              aria-selected={tab === "map"}
              onClick={() => setTab("map")}
            >
              <MapPinned size={15} />
              Map
            </button>
          </div>
          {tab === "map" ? (
            <Section
              title="Business supply footprint"
              note={`Search geography: ${batch.geography}. Markers represent public business locations, not search activity.`}
              action={
                <select
                  aria-label="Map industry"
                  value={mapRow?.category ?? ""}
                  onChange={(e) => setMapCategory(e.target.value as CategoryId)}
                >
                  {rows.map((r) => (
                    <option key={r.category} value={r.category}>
                      {r.name}
                    </option>
                  ))}
                </select>
              }
            >
              {mapRow && (
                <Suspense
                  fallback={<p role="status">Loading business map...</p>}
                >
                  <DemandMap
                    row={mapRow}
                    onDetail={() => setDetail(mapRow.category)}
                  />
                </Suspense>
              )}
            </Section>
          ) : (
            <>
              <div className="demand-main-grid">
                <Section
                  title="Demand Gap Matrix"
                  note="Where regional interest and represented local supply differ."
                >
                  <GapMatrix
                    rows={rows}
                    reason={analysis.gapReason}
                    onSelect={setDetail}
                  />
                </Section>
                <Section
                  title="What People Are Looking For"
                  note="Ranked by mean Search Interest Index, not spending."
                >
                  <div className="demand-ranking">
                    {strongest ? (
                      ranking.slice(0, 5).map((r, i) => (
                        <button
                          key={r.category}
                          onClick={() => setDetail(r.category)}
                        >
                          <span className="demand-rank-number">{i + 1}</span>
                          <span>
                            <strong>{r.name}</strong>
                            <small>
                              {r.change3m === null
                                ? "3M change unavailable"
                                : `${signed(r.change3m)}% / 3M`}
                            </small>
                          </span>
                          <b>{fmt(r.averageInterest)}</b>
                        </button>
                      ))
                    ) : (
                      <p>
                        Cross-category ranking requires a confirmed common scale
                        and common months. Individual series remain in the
                        table.
                      </p>
                    )}
                  </div>
                  <div className="demand-research-note">
                    <strong>A signal, not a verdict.</strong>
                    <p>
                      Search interest does not equal purchases. A high gap can
                      reflect missing directory listings or a broader search
                      region, not an underserved market.
                    </p>
                  </div>
                </Section>
              </div>
              <Section
                title="Local Search Interest Over Time"
                note={`Search geography: ${batch.geography} · 0-100 index · monthly mean of reported samples`}
              >
                <fieldset className="demand-category-select">
                  <legend>Chart categories (up to five)</legend>
                  {rows.map((r) => (
                    <label key={r.category}>
                      <input
                        type="checkbox"
                        checked={chartIds.includes(r.category)}
                        disabled={
                          chartIds.includes(r.category)
                            ? chartIds.length === 1
                            : chartIds.length >= 5
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...chartIds, r.category]
                              : chartIds.filter((id) => id !== r.category),
                          )
                        }
                      />
                      <i
                        style={{
                          background: categories.find(
                            (c) => c.id === r.category,
                          )!.color,
                        }}
                      />
                      {r.name}
                    </label>
                  ))}
                </fieldset>
                <InterestChart
                  rows={rows.filter((r) => chartIds.includes(r.category))}
                  start={analysis.start}
                  onSelect={setDetail}
                />
                <div className="demand-legend">
                  {rows
                    .filter((r) => chartIds.includes(r.category))
                    .map((r) => (
                      <button
                        key={r.category}
                        onClick={() => setDetail(r.category)}
                      >
                        <i
                          style={{
                            background: categories.find(
                              (c) => c.id === r.category,
                            )!.color,
                          }}
                        />
                        {r.name}
                      </button>
                    ))}
                </div>
                <details className="eco-method">
                  <summary>Underlying monthly observations</summary>
                  <div className="eco-table-wrap">
                    <table className="eco-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          {rows
                            .filter((r) => chartIds.includes(r.category))
                            .map((r) => (
                              <th key={r.category}>{r.name}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...new Set(
                            rows.flatMap((r) => r.history.map((p) => p.date)),
                          ),
                        ]
                          .filter((d) => d.slice(0, 7) >= analysis.start)
                          .sort()
                          .map((date) => (
                            <tr key={date}>
                              <td>{date.slice(0, 7)}</td>
                              {rows
                                .filter((r) => chartIds.includes(r.category))
                                .map((r) => (
                                  <td key={r.category}>
                                    {fmt(
                                      r.history.find((p) => p.date === date)
                                        ?.interest ?? null,
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Section>
              <Section
                title="Industry Opportunity Table"
                note="Mean interest uses common months where available. 3M change always compares the latest three months with the prior three."
                action={
                  <label className="demand-search">
                    <Search size={15} />
                    <input
                      aria-label="Filter demand categories"
                      placeholder="Find a category"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                }
              >
                <div className="eco-table-wrap">
                  <table className="eco-table demand-opportunity">
                    <thead>
                      <tr>
                        <th>Category</th>
                        {(
                          [
                            ["averageInterest", "Search Interest"],
                            ["change3m", "3M Change"],
                            ["businessCount", "Businesses"],
                          ] as [SortKey, string][]
                        ).map(([key, label]) => (
                          <th
                            key={key}
                            aria-sort={
                              sort === key
                                ? direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button onClick={() => setSorting(key)}>
                              {label}
                              <ArrowUpDown size={12} />
                            </button>
                          </th>
                        ))}
                        <th>Supply Share</th>
                        <th
                          aria-sort={
                            sort === "demandGap"
                              ? direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button onClick={() => setSorting("demandGap")}>
                            Demand Gap
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.category}>
                          <th scope="row">
                            <button onClick={() => setDetail(r.category)}>
                              {r.name}
                            </button>
                            <small>{r.query}</small>
                          </th>
                          <td>
                            {fmt(r.averageInterest)}
                            {r.averageInterest !== null && <small>/ 100</small>}
                          </td>
                          <td>
                            {r.change3m !== null &&
                              (r.change3m >= 0 ? (
                                <ArrowUp size={12} />
                              ) : (
                                <ArrowDown size={12} />
                              ))}{" "}
                            {signed(r.change3m)}
                            {r.change3m !== null && "%"}
                          </td>
                          <td>{r.businessCount}</td>
                          <td>{fmt(r.supplyShare)}%</td>
                          <td>
                            <strong>{signed(r.demandGap, 2)}</strong>
                          </td>
                          <td>
                            <span
                              className={`demand-signal ${r.demandGap === null ? "missing" : r.demandGap >= 0.75 ? "positive" : r.demandGap <= -0.75 ? "negative" : "balanced"}`}
                            >
                              {r.signal}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shown.length && (
                    <p className="demand-empty">
                      No categories match this filter.
                    </p>
                  )}
                </div>
              </Section>
              <Section
                title="Rising Local Interest"
                note="Largest positive changes in mean interest: last three months versus preceding three."
              >
                <div className="demand-rising">
                  {rising.slice(0, 6).map((r) => (
                    <button
                      key={r.category}
                      onClick={() => setDetail(r.category)}
                    >
                      <span>{r.name}</span>
                      <strong>{signed(r.change3m)}%</strong>
                      <InterestChart rows={[r]} start={analysis.start} small />
                      <small>Relative index change, not search volume</small>
                    </button>
                  ))}
                </div>
                {!rising.length && (
                  <p>
                    No positive, computable three-month changes in this
                    comparison.
                  </p>
                )}
              </Section>
              <Section
                title="Signals Worth Watching"
                note="Deterministic observations from this selection; not AI-generated advice."
              >
                <ul className="demand-insights">
                  {rising[0] && (
                    <li>
                      <button onClick={() => setDetail(rising[0].category)}>
                        {rising[0].name}
                      </button>{" "}
                      has the largest positive three-month index change among
                      these categories: {signed(rising[0].change3m)}%.
                      Seasonality and query wording may contribute.
                    </li>
                  )}
                  {biggest && <li>{interpretation(biggest)}</li>}
                  {strongest && (
                    <li>
                      {strongest.name} has the highest comparable mean interest
                      ({fmt(strongest.averageInterest)} / 100), alongside{" "}
                      {strongest.businessCount} represented local listings. This
                      does not establish total consumer demand.
                    </li>
                  )}
                  <li>
                    {localSupply.length} directory listings map to the
                    ten-category taxonomy. Zero represented listings means a
                    coverage gap or absence in this dataset, not necessarily no
                    local supply.
                  </li>
                  {analysis.gapReason && <li>{analysis.gapReason}</li>}
                </ul>
              </Section>
            </>
          )}
          {batch.warnings.length > 0 && (
            <details className="eco-method">
              <summary>Source quality notes ({batch.warnings.length})</summary>
              {batch.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </details>
          )}
        </>
      ) : (
        <Section title="Your imported comparisons">
          <p>
            No Google Trends files are saved in this browser yet. The
            demonstration remains available under Data Source: Demo.
          </p>
          <button className="eco-button" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            Import Trends Data
          </button>
        </Section>
      )}
      <Section
        title="Search Demand Methodology"
        note="Normalized, aggregated search signals and incomplete business representation."
      >
        <Method title="Calculation, sources & limitations">
          <h4>Search Interest</h4>
          <p>
            Google Trends reports normalized aggregate interest, not exact
            searches or individual search histories. Zero can reflect
            insufficient data, not no searches. Monthly values are arithmetic
            means of reported samples; weekly samples belong to their start
            month. Partial rows flagged in the export are omitted. Blank and
            &lt;1 values remain missing. Sparse samples and partial calendar
            months may bias these means.
          </p>
          <h4>Geography & supply</h4>
          <p>
            The search geography is shown next to every analysis. Broader
            regional search interest is not township-only demand. {supplyNote}{" "}
            One listing maps to at most one category; ambiguous
            health/education/automotive listings are not forced into narrower
            specialties. Mapping uses only the raw business name and industry,
            never synthetic membership status.
          </p>
          <h4>Demand Gap Index</h4>
          <p>
            <strong>
              Gap(c) = z(mean search interest(c)) - z(supply share(c))
            </strong>
            , where z(x) = (x - cohort mean) / population standard deviation.
            Supply share = category's represented listings / all mapped local
            listings x 100. Demand means use months with numeric values for
            every category in this comparison, within the selected range. At
            least two categories and two common months, a confirmed shared
            export scale and nonzero variation in both measures are required.
          </p>
          <p>
            Separate exports are never merged or independently rescaled. If any
            prerequisite fails, gaps and matrix are unavailable. The index
            changes when the comparison cohort changes; it is not comparable
            between exports. Signal bands are descriptive: gap &gt;= 0.75 high
            interest/lower supply; gap &lt;= -0.75 supply-heavy; otherwise
            balanced. These are not statistical significance thresholds.
          </p>
          <h4>Recent change</h4>
          <p>
            100 x (mean of last 3 calendar-month aggregates / mean of preceding
            3 - 1). All six months must be closed and complete: one monthly
            observation, every calendar day, or every weekly start date on the
            source weekday, without missing values. Unspecified Date frequency
            cannot certify completeness. A positive prior mean is required. This
            window is anchored to the latest source month, even when the display
            shows only three months; incomplete windows show no growth estimate.
            Current interest is the latest month, not the window average.
          </p>
          <h4>Limitations & persistence</h4>
          <p>
            Search does not equal spending, intent or purchases. This is a
            research signal, not causal proof, a business-opening recommendation
            or a saturation diagnosis. Demo search data is synthetic; supply is
            the real represented directory. Imports are user-supplied and
            retained only in this browser's localStorage. Clearing site data
            removes them. No cross-device sync, background refresh, live feed or
            LLM is used.
          </p>
          <a
            href="https://support.google.com/trends/answer/4365533"
            target="_blank"
            rel="noreferrer"
          >
            Google Trends data definitions
          </a>
          <p>
            <a
              href="https://api.censusreporter.org/1.0/geo/show/tiger2024?geo_ids=06000US3402749080"
              target="_blank"
              rel="noreferrer"
            >
              Census TIGER 2024 boundary via Census Reporter
            </a>
          </p>
        </Method>
      </Section>
      <Caveat>
        Possible mismatches are questions for local market research. The
        directory omits businesses, category mappings are approximate, and
        search regions may extend far beyond Mount Olive.
      </Caveat>
      {importOpen && (
        <ImportDialog
          imports={saved.imports}
          replace={replace}
          onClose={() => setImportOpen(false)}
          onSave={save}
        />
      )}
      {chosen && batch && (
        <CategoryDialog
          row={chosen}
          batch={batch}
          start={analysis.start}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
