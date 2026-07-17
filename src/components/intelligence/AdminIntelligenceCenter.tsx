import { useMemo, useState } from "react";
import { ArrowUpRight, Filter, Search } from "lucide-react";
import {
  buildAllBusinessIntelligence,
  getAdminIntelligenceSummary,
} from "../../intelligence/engine";
import { MetricCard, Panel, ProgressLine, StatusBadge } from "../Cards";
import { PageHeader, type ViewKey } from "../Shell";

export function AdminIntelligenceCenter({
  openMember,
}: {
  openMember: (memberId: string, view: ViewKey) => void;
}) {
  const records = useMemo(() => buildAllBusinessIntelligence(), []);
  const summary = useMemo(
    () => getAdminIntelligenceSummary(records),
    [records],
  );
  const [query, setQuery] = useState("");
  const [confidence, setConfidence] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const filtered = records.filter((record) => {
    const haystack =
      `${record.profile.displayName} ${record.profile.chamberCategory} ${record.profile.municipality} ${record.profile.primaryNaics.code}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (!confidence || record.dataConfidence === confidence) &&
      (!reviewOnly ||
        record.profile.primaryNaics.verificationStatus === "needs_review")
    );
  });
  const categoryCounts = Object.entries(
    records.reduce<Record<string, number>>((counts, record) => {
      counts[record.profile.industryGroup] =
        (counts[record.profile.industryGroup] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  return (
    <>
      <PageHeader
        title="Member Intelligence Center"
        description="Profile readiness, industry classification, evidence quality, and supported opportunities across all current Chamber directory records."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Intelligence Profiles"
          value={summary.profilesCreated}
          detail="Generated from current directory IDs"
          tone="green"
        />
        <MetricCard
          label="Successfully Mapped"
          value={summary.geocoded}
          detail={`${Math.round((summary.geocoded / summary.profilesCreated) * 100)}% coordinate coverage`}
          tone="blue"
        />
        <MetricCard
          label="NAICS Review Queue"
          value={summary.classificationsNeedingReview}
          detail="Low-confidence category crosswalk matches"
          tone="amber"
        />
        <MetricCard
          label="Supported Recommendations"
          value={summary.recommendations}
          detail="Deterministic and evidence-linked"
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Intelligence Readiness">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressLine
              label="Profiles with current insights"
              value={Math.round(
                (summary.currentInsights / summary.profilesCreated) * 100,
              )}
              detail={`${summary.currentInsights} of ${summary.profilesCreated}`}
            />
            <ProgressLine
              label="Geographic coverage"
              value={Math.round(
                (summary.geocoded / summary.profilesCreated) * 100,
              )}
              detail="Public coordinates from directory pages"
            />
            <ProgressLine
              label="Human-verified NAICS"
              value={0}
              detail="No administrator approvals are stored yet"
            />
            <ProgressLine
              label="Recommendation feedback"
              value={0}
              detail="Requires authenticated persistent member accounts"
            />
          </div>
        </Panel>
        <Panel title="Industry Groups">
          {categoryCounts.map(([label, count]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-white/10 py-2.5 first:pt-0 last:border-0"
            >
              <span className="text-sm text-slate-300">{label}</span>
              <span className="text-sm font-medium text-white">{count}</span>
            </div>
          ))}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`${filtered.length} business intelligence profiles`}>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <label className="relative">
              <Search
                className="absolute left-3 top-3.5 text-slate-500"
                size={16}
              />
              <input
                className="control pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search business, industry, city, or NAICS"
              />
            </label>
            <select
              className="control"
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
              aria-label="Filter data confidence"
            >
              <option value="">All confidence grades</option>
              <option>High confidence</option>
              <option>Moderate confidence</option>
              <option>Directional</option>
              <option>Insufficient data</option>
            </select>
            <label className="flex min-h-[42px] items-center gap-2 border border-white/10 px-3 text-sm text-slate-300">
              <Filter size={15} />
              <input
                type="checkbox"
                checked={reviewOnly}
                onChange={(event) => setReviewOnly(event.target.checked)}
              />{" "}
              NAICS review only
            </label>
          </div>
          <div className="max-h-[680px] overflow-auto">
            <table className="min-w-[1100px] divide-y divide-white/10 text-sm">
              <thead className="sticky top-0 z-10 bg-ink-850 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Business</th>
                  <th className="py-3 pr-4">Industry</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Profile</th>
                  <th className="py-3 pr-4">NAICS confidence</th>
                  <th className="py-3 pr-4">Freshness</th>
                  <th className="py-3 pr-4">Top opportunity</th>
                  <th className="py-3 pr-4">Top recommendation</th>
                  <th className="py-3 pr-4">Feedback</th>
                  <th className="sticky right-0 z-20 bg-ink-850 py-3 pl-3">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((record) => (
                  <tr
                    key={record.profile.businessId}
                    className="hover:bg-white/[0.025]"
                  >
                    <td className="max-w-64 py-3 pr-4 font-medium text-white">
                      {record.profile.displayName}
                    </td>
                    <td className="max-w-48 py-3 pr-4 text-slate-300">
                      {record.profile.chamberCategory}
                      <span className="block text-xs text-slate-500">
                        {record.profile.primaryNaics.code}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {record.profile.municipality}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {record.profile.profileCompleteness}%
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        value={`${Math.round(record.profile.primaryNaics.confidence * 100)}% ${record.profile.primaryNaics.verificationStatus.replace("_", " ")}`}
                      />
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      ACS 2024<span className="block text-xs">ZBP 2023</span>
                    </td>
                    <td className="max-w-56 py-3 pr-4 text-slate-300">
                      {record.insights[0]?.type ?? "Profile enrichment"}
                    </td>
                    <td className="max-w-64 py-3 pr-4 text-slate-400">
                      {record.recommendations[0]?.title ?? "Complete profile"}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      Awaiting member
                    </td>
                    <td className="sticky right-0 bg-ink-875/95 py-3 pl-3 shadow-[-12px_0_18px_rgba(10,18,16,0.55)]">
                      <button
                        className="icon-button"
                        aria-label={`Open ${record.profile.displayName} intelligence`}
                        title={`Open ${record.profile.displayName} intelligence`}
                        onClick={() =>
                          openMember(
                            record.profile.businessId,
                            "memberWorkspace",
                          )
                        }
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
