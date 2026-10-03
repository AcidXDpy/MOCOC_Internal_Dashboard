import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { DemandDialog } from "./DemandDialog";
import { parseTrends, type ParsedTrends } from "./csv";
import { categories, type CategoryId, type DemandBatch } from "./types";
import { normalizeCategory } from "./supply";
import type { DemandPublishRequest } from "./api-types";

export default function ImportDialog({
  onClose,
  onSave,
  imports,
  replace = "",
  onPublish,
}: {
  onClose: () => void;
  onSave: (batch: DemandBatch, replaceId: string) => void;
  imports: DemandBatch[];
  replace?: string;
  onPublish?: (
    request: DemandPublishRequest,
    adminToken: string,
  ) => Promise<void>;
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
  const [publish, setPublish] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [retrievedAt, setRetrievedAt] = useState("");
  const [geographyLevel, setGeographyLevel] =
    useState<DemandPublishRequest["geography"]["level"]>("state");
  const [geographyCode, setGeographyCode] = useState("");
  const [adminToken, setAdminToken] = useState("");
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
  function close() {
    setAdminToken("");
    onClose();
  }
  async function submit() {
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
    if (
      publish &&
      (batch.demoSample ||
        !batch.comparable ||
        !sourceUrl.trim() ||
        !retrievedAt ||
        !geographyCode.trim() ||
        !adminToken)
    ) {
      setError(
        "Verified publication requires an official source URL, retrieval time, exact geography code, shared scale and administrator key.",
      );
      return;
    }
    try {
      onSave(batch, replaceId);
      if (!publish || !onPublish) {
        close();
        return;
      }
      setBusy(true);
      const request: DemandPublishRequest = {
        name: batch.name,
        sourceType: "google-trends-csv",
        valueUnit: "normalized-index-0-100",
        frequency: batch.frequency,
        geography: {
          label: batch.geography,
          level: geographyLevel,
          code: geographyCode.trim(),
        },
        comparison: { sharedScale: true, method: "single-export" },
        provenance: {
          sourceOrganization: "Google",
          sourceProduct: "Google Trends",
          sourceUrl: sourceUrl.trim(),
          retrievedAt: new Date(retrievedAt).toISOString(),
          originalFilename: batch.filename,
          acquisitionMethod: "official-csv-export",
          notes: batch.warnings,
        },
        series: batch.series,
      };
      await onPublish(request, adminToken);
      close();
    } catch (e) {
      setError(
        (e as Error).message.startsWith("Publication") ||
          (e as Error).message.startsWith("Activation")
          ? (e as Error).message
          : "Publication failed. The browser copy was kept.",
      );
    } finally {
      setAdminToken("");
      setBusy(false);
    }
  }
  return (
    <DemandDialog title="Import Trends Data" onClose={close}>
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
            {!parsed.demoSample && onPublish && (
              <div className="demand-publish-controls">
                <label className="demand-check">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(event) => setPublish(event.target.checked)}
                  />
                  Publish verified dataset
                </label>
                {publish && (
                  <>
                    <h3>Verified publication record</h3>
                    <label className="demand-field">
                      Official Google Trends source URL
                      <input
                        aria-label="Official Google Trends source URL"
                        type="url"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                      />
                    </label>
                    <div className="demand-mapping">
                      <label>
                        Retrieved at
                        <input
                          aria-label="Retrieved at"
                          type="datetime-local"
                          value={retrievedAt}
                          onChange={(event) =>
                            setRetrievedAt(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Geography level
                        <select
                          aria-label="Geography level"
                          value={geographyLevel}
                          onChange={(event) =>
                            setGeographyLevel(
                              event.target
                                .value as DemandPublishRequest["geography"]["level"],
                            )
                          }
                        >
                          <option value="state">State</option>
                          <option value="metro">Metro</option>
                          <option value="county">County</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                    <label className="demand-field">
                      Geography code
                      <input
                        aria-label="Geography code"
                        value={geographyCode}
                        onChange={(event) =>
                          setGeographyCode(event.target.value)
                        }
                        placeholder="e.g. US-NJ"
                      />
                    </label>
                    <label className="demand-field">
                      Administrator key
                      <input
                        aria-label="Administrator key"
                        type="password"
                        autoComplete="off"
                        value={adminToken}
                        onChange={(event) => setAdminToken(event.target.value)}
                      />
                    </label>
                    <div className="demand-publish-preview">
                      <strong>Publication preview</strong>
                      <span>{geography || "Exact geography required"}</span>
                      <span>{sourceUrl || "Official source URL required"}</span>
                      <span>{retrievedAt || "Retrieval time required"}</span>
                    </div>
                  </>
                )}
              </div>
            )}
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
            <button
              className="eco-button demand-primary"
              onClick={() => void submit()}
              disabled={busy}
            >
              <Upload size={16} />
              {publish ? "Publish Verified Data" : "Import Data"}
            </button>
          </footer>
        </>
      )}
    </DemandDialog>
  );
}
