import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { DemandDialog } from "./DemandDialog";
import { parseTrends, type ParsedTrends } from "./csv";
import { categories, type CategoryId, type DemandBatch } from "./types";
import { normalizeCategory } from "./supply";

export default function ImportDialog({
  onClose,
  onSave,
  imports,
  replace = "",
}: {
  onClose: () => void;
  onSave: (batch: DemandBatch, replaceId: string) => void;
  imports: DemandBatch[];
  replace?: string;
}) {
  const [parsed, setParsed] = useState<ParsedTrends | null>(null);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<(CategoryId | "")[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [geography, setGeography] = useState("");
  const [comparable, setComparable] = useState(false);
  const [replaceId, setReplaceId] = useState(replace);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  async function upload(file?: File) {
    const token = ++version.current;
    setParsed(null);
    setError("");
    setComparable(false);
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("File exceeds the 2 MB limit.");
      return;
    }
    setBusy(true);
    try {
      const result = parseTrends(await file.text());
      if (token !== version.current) return;
      setFilename(file.name);
      setParsed(result);
      setGeography(result.geographyHint);
      setQueries(result.columns.map((c) => c.replace(/:\s*\([^)]+\)\s*$/, "")));
      setMapping(result.columns.map((c) => normalizeCategory(c, "") ?? ""));
    } catch (e) {
      if (token === version.current) setError((e as Error).message);
    } finally {
      if (token === version.current) setBusy(false);
    }
  }
  function submit() {
    if (!parsed) return;
    if (mapping.some((m) => !m) || new Set(mapping).size !== mapping.length) {
      setError("Assign each column to a different category.");
      return;
    }
    if (!geography.trim() || queries.some((q) => !q.trim())) {
      setError("Search term and actual search geography are required.");
      return;
    }
    if (parsed.mixedGeographies && comparable) {
      setError(
        "Different search geographies cannot share a demand-gap cohort.",
      );
      return;
    }
    const batch: DemandBatch = {
      id: crypto.randomUUID(),
      name: filename,
      filename,
      geography: geography.trim(),
      source: "google-trends-csv",
      importedAt: new Date().toISOString(),
      comparable,
      demoSample: parsed.demoSample,
      frequency: parsed.frequency,
      warnings: parsed.warnings,
      series: mapping.map((category, i) => ({
        category: category as CategoryId,
        query: queries[i].trim(),
        points: parsed.rows.map((r) => ({
          date: r.date,
          interest: r.values[i],
        })),
      })),
    };
    try {
      onSave(batch, replaceId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DemandDialog title="Import Trends Data" onClose={onClose}>
      <div className="demand-import-step">
        <span>01 / Upload CSV</span>
        <label className="demand-file">
          <Upload size={23} />
          <strong>Upload Google Trends CSV</strong>
          <input
            aria-label="Google Trends CSV file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        <a
          className="eco-link-button"
          href="/sample-data/google-trends/demonstration.csv"
          download
        >
          <Download size={14} />
          Download Sample CSV (Demo Data)
        </a>
      </div>
      {busy && <p role="status">Reading and validating observations...</p>}
      {error && (
        <p role="alert" className="demand-error">
          {error}
        </p>
      )}
      {parsed && (
        <>
          <div className="demand-import-step">
            <span>02 / Preview detected data</span>
            <p>
              {parsed.rows.length} observations · {parsed.rows[0].date} to{" "}
              {parsed.rows.at(-1)!.date} · {parsed.frequency} format
            </p>
            {parsed.demoSample && (
              <strong className="demand-demo">
                Demo Data · synthetic sample, not Google observations
              </strong>
            )}
            <div className="eco-table-wrap">
              <table className="eco-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {parsed.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 4).map((r) => (
                    <tr key={r.date}>
                      <td>{r.date}</td>
                      {r.values.map((v, i) => (
                        <td key={i}>{v ?? "Missing / censored"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.warnings.map((w) => (
              <p className="eco-footnote" key={w}>
                {w}
              </p>
            ))}
          </div>
          <div className="demand-import-step">
            <span>03 / Associate terms & geography</span>
            {parsed.columns.map((c, i) => (
              <div className="demand-mapping" key={c}>
                <label>
                  Search term {i + 1}
                  <input
                    aria-label={`Search term ${i + 1}`}
                    maxLength={150}
                    value={queries[i]}
                    onChange={(e) =>
                      setQueries((q) =>
                        q.map((v, n) => (n === i ? e.target.value : v)),
                      )
                    }
                  />
                </label>
                <label>
                  Mapped industry {i + 1}
                  <select
                    aria-label={`Mapped industry ${i + 1}`}
                    value={mapping[i]}
                    onChange={(e) =>
                      setMapping((m) =>
                        m.map((v, n) =>
                          n === i ? (e.target.value as CategoryId) : v,
                        ),
                      )
                    }
                  >
                    <option value="">Choose category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            <label className="demand-field">
              Actual search geography
              <input
                aria-label="Actual search geography"
                maxLength={120}
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. New Jersey or New York DMA"
              />
            </label>
            <label className="demand-check">
              <input
                type="checkbox"
                checked={comparable}
                disabled={parsed.columns.length < 2 || parsed.mixedGeographies}
                onChange={(e) => setComparable(e.target.checked)}
              />
              These columns came from one Google Trends comparison, with the
              same geography, time span and search settings.
            </label>
            <p className="eco-footnote">
              Independent exports each have their own 0-100 scale. Unconfirmed
              or single-term imports show history without a cross-category gap.
              Uploaded files are user-supplied, not independently authenticated.
            </p>
            {imports.length > 0 && (
              <label className="demand-field">
                Import action
                <select
                  aria-label="Import action"
                  value={replaceId}
                  onChange={(e) => setReplaceId(e.target.value)}
                >
                  <option value="">Save as a new comparison</option>
                  {imports.map((b) => (
                    <option value={b.id} key={b.id}>
                      Replace {b.name} ({b.geography})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <footer>
            <small>
              Saved only in this browser on this device. Not synced or uploaded
              to a server.
            </small>
            <button className="eco-button demand-primary" onClick={submit}>
              <Upload size={16} />
              Import Data
            </button>
          </footer>
        </>
      )}
    </DemandDialog>
  );
}
