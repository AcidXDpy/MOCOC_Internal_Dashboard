import { DemandDialog } from "./DemandDialog";
import { InterestChart } from "./DemandCharts";
import { fmt, interpretation, signed } from "./engine";
import { localSupply } from "./supply";
import type { CategorySummary, DemandBatch } from "./types";
export default function CategoryDialog({
  row,
  batch,
  start,
  onClose,
}: {
  row: CategorySummary;
  batch: DemandBatch;
  start: string;
  onClose: () => void;
}) {
  const businesses = localSupply.filter((b) => b.category === row.category);
  return (
    <DemandDialog title={row.name} onClose={onClose}>
      <p className="demand-context">
        {batch.demoSample ? (
          <strong className="demand-demo">Demo Data</strong>
        ) : batch.verification === "verified-api" ? (
          <strong className="demand-verified-badge">Verified API Data</strong>
        ) : (
          <strong>Google Trends Import</strong>
        )}{" "}
        Search geography: {batch.geography}
      </p>
      <p className="eco-footnote">
        Query: {row.query} · normalized aggregate interest, not search counts
      </p>
      <div className="demand-detail-stats">
        <div>
          <span>Current interest</span>
          <strong>
            {fmt(row.currentInterest)}
            {row.currentInterest !== null && " / 100"}
          </strong>
        </div>
        <div>
          <span>3-month change</span>
          <strong>
            {signed(row.change3m)}
            {row.change3m !== null && "%"}
          </strong>
        </div>
        <div>
          <span>Local directory listings</span>
          <strong>{row.businessCount}</strong>
        </div>
        <div>
          <span>Demand Gap Index</span>
          <strong>{signed(row.demandGap, 2)}</strong>
        </div>
      </div>
      <h3>Search Interest History</h3>
      <InterestChart rows={[row]} start={start} />
      <h3>Interpretation</h3>
      <p>{interpretation(row)}</p>
      <h3>Local Supply</h3>
      <p className="eco-footnote">
        Boundary-matched public directory coordinates (unverified); category
        mapping uses name and industry. Snapshot: July 16, 2026. Raw records are
        unchanged.
      </p>
      {!businesses.length ? (
        <p>
          No represented listings mapped to this category. This does not mean no
          businesses operate locally.
        </p>
      ) : (
        <ul className="demand-businesses">
          {businesses.map((b) => (
            <li key={b.member_id}>
              <strong>{b.business_name}</strong>
              <span>
                {b.address}, {b.city}
              </span>
              <small>Original category: {b.industry}</small>
              {b.source_url && (
                <a href={b.source_url} target="_blank" rel="noreferrer">
                  Public directory source
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </DemandDialog>
  );
}
