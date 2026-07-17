import { useMemo, useState } from "react";
import { Building2, Check, Download, Info, MapPin, Target } from "lucide-react";
import { acsEvidence, members } from "../../data";
import { buildBusinessIntelligence } from "../../intelligence/engine";
import type {
  BusinessGoal,
  RecommendationStatus,
} from "../../intelligence/types";
import { EmptyState, Panel, ProgressLine, StatusBadge } from "../Cards";
import { PageHeader } from "../Shell";

const goals: BusinessGoal[] = [
  "Acquire more local customers",
  "Reach higher-income households",
  "Reach younger customers",
  "Reach older customers",
  "Expand B2B partnerships",
  "Improve customer retention",
  "Increase weekday traffic",
  "Increase weekend traffic",
  "Hire employees",
  "Open another location",
  "Introduce a new service",
  "Improve digital visibility",
  "Increase Chamber engagement",
  "Find event sponsorship opportunities",
  "Find referral partners",
  "Understand local competition",
];

type MemberTab =
  "overview" | "market" | "industry" | "recommendations" | "profile" | "report";

export function BusinessIntelligenceWorkspace({
  initialMemberId,
}: {
  initialMemberId?: string;
}) {
  const [memberId, setMemberId] = useState(
    initialMemberId ?? members[0].member_id,
  );
  const [selectedGoals, setSelectedGoals] = useState<BusinessGoal[]>([]);
  const [tab, setTab] = useState<MemberTab>("overview");
  const [feedback, setFeedback] = useState<
    Record<string, RecommendationStatus>
  >({});
  const member =
    members.find((item) => item.member_id === memberId) ?? members[0];
  const record = useMemo(
    () => buildBusinessIntelligence(member, selectedGoals),
    [member, selectedGoals],
  );

  const chooseMember = (value: string) => {
    setMemberId(value);
    setSelectedGoals([]);
    setFeedback({});
    setTab("overview");
  };

  const topRecommendation = record.recommendations[0];
  const topInsight = record.insights[0];
  const partnerCategories = [
    ...new Set(record.complementaryMembers.map((item) => item.industry)),
  ];

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Business Intelligence"
          description="Personalized local-market evidence, explainable recommendations, and Chamber-network opportunities for an individual member business."
        />
      </div>
      <div className="mb-5 flex flex-col gap-3 border border-signal-amber/25 bg-signal-amber/[0.07] p-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-white">Member access preview</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Business isolation is implemented in the server authorization
            contract, but this static deployment does not yet authenticate users
            or persist edits.
          </p>
        </div>
        <select
          className="control max-w-md"
          value={memberId}
          onChange={(event) => chooseMember(event.target.value)}
          aria-label="Preview a member business"
        >
          {members.map((item) => (
            <option key={item.member_id} value={item.member_id}>
              {item.business_name}
            </option>
          ))}
        </select>
      </div>

      <section className="border-b border-white/10 pb-5 print:hidden">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-signal-teal/25 bg-signal-teal/[0.1] text-signal-teal">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-signal-teal">
                Member intelligence profile
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {record.profile.displayName}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                <span>{record.profile.chamberCategory}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {record.profile.municipality || "Location needs review"}
                </span>
                <span>NAICS {record.profile.primaryNaics.code}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              className="button-secondary"
              onClick={() => setTab("profile")}
            >
              <Target size={16} /> Profile & goals
            </button>
            <button
              className="button-primary"
              onClick={() => {
                setTab("report");
                setTimeout(() => window.print(), 100);
              }}
            >
              <Download size={16} /> Print report
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderFact
            label="Profile completeness"
            value={`${record.profile.profileCompleteness}%`}
            detail="Public and business-supplied fields"
          />
          <HeaderFact
            label="Data confidence"
            value={record.dataConfidence}
            detail="Lowest current ACS evidence grade"
          />
          <HeaderFact
            label="Data freshness"
            value="Current"
            detail="ACS 2024 / ZBP 2023 / directory 2026"
          />
          <HeaderFact
            label="Last intelligence refresh"
            value="Jul 17, 2026"
            detail="Deterministic engine v1.0.0"
          />
        </div>
      </section>

      <nav
        className="my-5 flex gap-1 overflow-x-auto border-b border-white/10 print:hidden"
        aria-label="Business intelligence sections"
      >
        {(
          [
            ["overview", "Overview"],
            ["market", "Local market"],
            ["industry", "Industry & network"],
            ["recommendations", "Recommendations"],
            ["profile", "Profile"],
            ["report", "Report"],
          ] as [MemberTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm ${tab === key ? "border-signal-teal text-white" : "border-transparent text-slate-400 hover:text-white"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Panel title="Executive Summary">
              <SummaryLine
                label="Local market signal"
                text={
                  topInsight?.statement ??
                  "More verified profile information is needed before a market signal can be generated."
                }
              />
              <SummaryLine
                label="Priority action"
                text={
                  topRecommendation?.title ?? "Complete the business profile."
                }
              />
              <SummaryLine
                label="Chamber opportunity"
                text={
                  partnerCategories.length
                    ? `${record.complementaryMembers.length} public member listings across ${partnerCategories.length} complementary categories can support opt-in introduction review.`
                    : "No category-matched network opportunity is currently supported by the crosswalk."
                }
              />
            </Panel>
            <Panel title="Intelligence Readiness">
              <ProgressLine
                label="Profile coverage"
                value={record.profile.profileCompleteness}
                detail="Verification and business-supplied fields raise recommendation specificity."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  value={record.profile.primaryNaics.verificationStatus.replace(
                    "_",
                    " ",
                  )}
                />
                <StatusBadge value={record.dataConfidence} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                No business-performance, customer, revenue, or foot-traffic data
                is inferred.
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <IntelligenceCard
              label="Local purchasing-capacity proxy"
              value={evidence("acs.median_household_income").formatted}
              comparison={`${evidence("acs.median_household_income").comparisonFormatted} county`}
              confidence={evidence("acs.median_household_income").confidence}
            />
            <IntelligenceCard
              label="Family-household context"
              value={evidence("acs.households_with_children").formatted}
              comparison={`${evidence("acs.households_with_children").comparisonFormatted} county`}
              confidence={evidence("acs.households_with_children").confidence}
            />
            <IntelligenceCard
              label="Broadband access"
              value={evidence("acs.broadband").formatted}
              comparison={`${evidence("acs.broadband").comparisonFormatted} county`}
              confidence={evidence("acs.broadband").confidence}
            />
            <IntelligenceCard
              label="Partnership potential"
              value={`${record.complementaryMembers.length} listings`}
              comparison={`${partnerCategories.length} complementary categories`}
              confidence="High confidence"
            />
          </div>

          <Panel
            title="Highest-Priority Actions"
            action={
              <button
                className="text-sm text-signal-teal hover:text-white"
                onClick={() => setTab("recommendations")}
              >
                View all
              </button>
            }
          >
            <RecommendationList
              recommendations={record.recommendations.slice(0, 3)}
              evidenceMetrics={record.evidence}
              feedback={feedback}
              setFeedback={setFeedback}
              compact
            />
          </Panel>
        </div>
      )}

      {tab === "market" && (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Panel title="Mount Olive Local Market Snapshot">
            <MetricBenchmarkTable
              metrics={record.evidence.filter((item) =>
                item.id.startsWith("acs."),
              )}
            />
          </Panel>
          <div className="space-y-5">
            <Panel title="Evidence-Backed Findings">
              {record.insights
                .filter((item) => item.sourceLabel.includes("Census"))
                .map((insight) => (
                  <div
                    key={insight.id}
                    className="border-b border-white/10 py-4 first:pt-0 last:border-0 last:pb-0"
                  >
                    <p className="font-medium text-white">
                      {insight.statement}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {insight.relevance}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {insight.confidence} | {insight.sourceLabel} |{" "}
                      {insight.caveat}
                    </p>
                  </div>
                ))}
            </Panel>
            <Panel title="Responsible Use">
              <p className="text-sm leading-6 text-slate-300">
                These are aggregate area statistics. They must not be used to
                identify residents, infer sensitive personal traits, exclude
                protected groups, or promise business outcomes.
              </p>
            </Panel>
          </div>
        </div>
      )}

      {tab === "industry" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Industry Position">
            {record.zipIndustryMetric ? (
              <div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <HeaderFact
                    label="ZIP employer establishments"
                    value={record.zipIndustryMetric.establishments}
                    detail={record.zipIndustryMetric.sectorLabel}
                  />
                  <HeaderFact
                    label="Per 10,000 residents"
                    value={
                      record.zipIndustryMetric.establishmentsPerTenThousand
                    }
                    detail={`${record.zipIndustryMetric.zipName} estimate`}
                  />
                  <HeaderFact
                    label="ZIP total establishments"
                    value={record.zipIndustryMetric.totalEstablishments}
                    detail="All published employer sectors"
                  />
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  U.S. Census Bureau ZIP Business Patterns 2023 and ACS 2024
                  population. Employer establishments are not a complete
                  competitor list and exclude nonemployers.
                </p>
              </div>
            ) : (
              <EmptyState
                title="ZIP industry benchmark unavailable"
                description="The current ZIP is outside the two core ZBP snapshots or the category needs NAICS review."
              />
            )}
          </Panel>
          <Panel title="Chamber Network Potential">
            {partnerCategories.length ? (
              partnerCategories.map((category) => {
                const count = record.complementaryMembers.filter(
                  (item) => item.industry === category,
                ).length;
                return (
                  <div
                    key={category}
                    className="flex items-center justify-between border-b border-white/10 py-3 first:pt-0 last:border-0"
                  >
                    <span className="text-sm text-slate-300">{category}</span>
                    <span className="text-sm font-medium text-white">
                      {count} listings
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No category match yet"
                description="Verify the NAICS and business model to improve partnership matching."
              />
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Matches are category-based suggestions. They do not imply consent,
              fit, endorsement, or an existing relationship.
            </p>
          </Panel>
        </div>
      )}

      {tab === "recommendations" && (
        <Panel
          title={`${record.recommendations.length} ranked recommendations`}
        >
          <RecommendationList
            recommendations={record.recommendations}
            evidenceMetrics={record.evidence}
            feedback={feedback}
            setFeedback={setFeedback}
          />
        </Panel>
      )}

      {tab === "profile" && (
        <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <Panel title="Classification & Public Profile">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ProfileFact
                label="Suggested NAICS"
                value={`${record.profile.primaryNaics.code} ${record.profile.primaryNaics.title}`}
              />
              <ProfileFact
                label="Classification confidence"
                value={`${Math.round(record.profile.primaryNaics.confidence * 100)}% | ${record.profile.primaryNaics.verificationStatus.replace("_", " ")}`}
              />
              <ProfileFact
                label="Business audience"
                value={`${record.profile.audience} (suggested)`}
              />
              <ProfileFact
                label="Operating model"
                value={`${record.profile.operatingModel.replace("_", " ")} (suggested)`}
              />
              <ProfileFact label="Employee range" value="Not supplied" />
              <ProfileFact label="Year founded" value="Not supplied" />
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Suggested values come from the Chamber category crosswalk. They
              remain unverified until approved by the business or an
              administrator.
            </p>
          </Panel>
          <Panel title="Business Goals">
            <p className="mb-4 text-sm leading-6 text-slate-400">
              Selected goals immediately re-rank recommendations in this
              preview. Persistence requires the production database and
              authenticated member account.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {goals.map((goal) => {
                const checked = selectedGoals.includes(goal);
                return (
                  <label
                    key={goal}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 py-2 text-sm ${checked ? "border-signal-teal/45 bg-signal-teal/[0.08] text-white" : "border-white/10 text-slate-300"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedGoals((current) =>
                          checked
                            ? current.filter((item) => item !== goal)
                            : [...current, goal],
                        )
                      }
                    />
                    {goal}
                  </label>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "report" && <BusinessReport record={record} />}
    </>
  );

  function evidence(id: string) {
    return record.evidence.find((item) => item.id === id) ?? acsEvidence[0];
  }
}

function RecommendationList({
  recommendations,
  evidenceMetrics,
  feedback,
  setFeedback,
  compact = false,
}: {
  recommendations: ReturnType<
    typeof buildBusinessIntelligence
  >["recommendations"];
  evidenceMetrics: ReturnType<typeof buildBusinessIntelligence>["evidence"];
  feedback: Record<string, RecommendationStatus>;
  setFeedback: React.Dispatch<
    React.SetStateAction<Record<string, RecommendationStatus>>
  >;
  compact?: boolean;
}) {
  if (!recommendations.length)
    return (
      <EmptyState
        title="No supported recommendations"
        description="Complete and verify the business profile to unlock stronger evidence-based actions."
      />
    );
  return (
    <div>
      {recommendations.map((item, index) => (
        <article
          key={item.id}
          className="border-b border-white/10 py-5 first:pt-0 last:border-0 last:pb-0"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.14em] text-signal-teal">
                Priority {index + 1} | {item.category}
              </p>
              <h4 className="mt-2 text-lg font-semibold text-white">
                {item.title}
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {item.summary}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatusBadge value={item.confidence} />
              <StatusBadge value={`${item.score} priority`} />
            </div>
          </div>
          {!compact && (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <ProfileFact label="Expected effort" value={item.effort} />
                <ProfileFact label="Potential impact" value={item.impact} />
                <ProfileFact label="Time horizon" value={item.timeHorizon} />
              </div>
              <ol className="mt-4 space-y-2 text-sm text-slate-300">
                {item.actionSteps.map((step, stepIndex) => (
                  <li key={step} className="flex gap-3">
                    <span className="text-signal-teal">{stepIndex + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <details className="mt-4 border-t border-white/10 pt-4">
                <summary className="cursor-pointer text-sm font-medium text-white">
                  Why am I seeing this?
                </summary>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                  <p>{item.rationale}</p>
                  <p>
                    <span className="text-slate-200">Goal influence:</span>{" "}
                    {item.goalInfluence}
                  </p>
                  {item.evidence.map((entry) => {
                    const metric = evidenceMetrics.find(
                      (candidate) => candidate.id === entry.metricId,
                    );
                    return (
                      <p key={entry.metricId}>
                        <span className="text-slate-200">Evidence:</span>{" "}
                        {entry.explanation}
                        {metric
                          ? ` Source: ${metric.provenance.dataset}, ${metric.provenance.datasetYear}.`
                          : ""}
                      </p>
                    );
                  })}
                  <p>
                    <span className="text-slate-200">Limitation:</span>{" "}
                    {item.limitation}
                  </p>
                  <p>
                    <span className="text-slate-200">Rule version:</span>{" "}
                    {item.engineVersion}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.scoreFactors.map((factor) => (
                      <span
                        key={factor.label}
                        className="border border-white/10 px-2 py-1 text-xs"
                      >
                        {factor.label}: +{factor.points}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                <span className="mr-1 text-xs text-slate-500">Feedback</span>
                {(
                  [
                    "useful",
                    "not_relevant",
                    "already_doing",
                    "completed",
                    "revisit_later",
                    "dismissed",
                  ] as RecommendationStatus[]
                ).map((status) => (
                  <button
                    key={status}
                    className={`feedback-button ${feedback[item.id] === status ? "active" : ""}`}
                    onClick={() =>
                      setFeedback((current) => ({
                        ...current,
                        [item.id]: status,
                      }))
                    }
                  >
                    {feedback[item.id] === status ? <Check size={13} /> : null}
                    {status.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </>
          )}
        </article>
      ))}
    </div>
  );
}

function MetricBenchmarkTable({
  metrics,
}: {
  metrics: ReturnType<typeof buildBusinessIntelligence>["evidence"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-3 pr-4">Metric</th>
            <th className="py-3 pr-4">Mount Olive</th>
            <th className="py-3 pr-4">Morris County</th>
            <th className="py-3 pr-4">Reliability</th>
            <th className="py-3">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {metrics.map((metric) => (
            <tr key={metric.id}>
              <td className="min-w-56 py-3 pr-4 font-medium text-white">
                {metric.label}
                <p className="mt-1 text-xs font-normal leading-5 text-slate-500">
                  {metric.description}
                </p>
              </td>
              <td className="py-3 pr-4 text-slate-200">
                {metric.formatted}
                {metric.marginOfError !== null ? (
                  <span className="block text-xs text-slate-500">
                    +/- {formatMargin(metric.marginOfError, metric.unit)}
                  </span>
                ) : null}
              </td>
              <td className="py-3 pr-4 text-slate-300">
                {metric.comparisonFormatted ?? "Not applicable"}
              </td>
              <td className="py-3 pr-4">
                <StatusBadge value={metric.confidence} />
              </td>
              <td className="py-3">
                <details>
                  <summary className="cursor-pointer text-signal-teal">
                    <Info className="inline" size={15} /> About
                  </summary>
                  <p className="mt-2 min-w-64 text-xs leading-5 text-slate-500">
                    {metric.provenance.dataset}, table {metric.provenance.table}
                    , variables {metric.provenance.variables.join(", ")}.{" "}
                    {metric.provenance.transformation}. Retrieved{" "}
                    {metric.provenance.retrievedAt}.
                  </p>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        ACS values are five-year estimates, not exact counts. Margins of error
        use the Census Bureau's 90% confidence convention.
      </p>
    </div>
  );
}

function BusinessReport({
  record,
}: {
  record: ReturnType<typeof buildBusinessIntelligence>;
}) {
  return (
    <article className="report-sheet bg-white p-7 text-slate-900 sm:p-10">
      <header className="border-b border-slate-300 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
          Mount Olive Chamber Business Intelligence
        </p>
        <h3 className="mt-3 text-3xl font-semibold">
          {record.profile.displayName}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Prepared July 17, 2026 | ACS 2024 | ZIP Business Patterns 2023 |
          Public directory snapshot 2026
        </p>
      </header>
      <ReportSection title="1. Business Intelligence Summary">
        <p>
          {record.insights[0]?.statement ??
            "Insufficient verified information for a market summary."}
        </p>
        <p className="mt-2">
          <strong>Priority action:</strong>{" "}
          {record.recommendations[0]?.title ??
            "Complete and verify the business profile."}
        </p>
      </ReportSection>
      <ReportSection title="2. Local Market Snapshot">
        <ReportMetricRows
          metrics={record.evidence.filter((item) =>
            [
              "acs.population",
              "acs.median_household_income",
              "acs.households_with_children",
              "acs.owner_occupied",
            ].includes(item.id),
          )}
        />
      </ReportSection>
      <ReportSection title="3. Target Customer Indicators">
        <ReportMetricRows
          metrics={record.evidence.filter((item) =>
            [
              "acs.broadband",
              "acs.bachelors_or_higher",
              "acs.foreign_born",
            ].includes(item.id),
          )}
        />
      </ReportSection>
      <ReportSection title="4. Industry Position">
        <p>
          {record.zipIndustryMetric
            ? `${record.zipIndustryMetric.zipName} records ${record.zipIndustryMetric.establishments} employer establishments in ${record.zipIndustryMetric.sectorLabel.toLowerCase()}, or ${record.zipIndustryMetric.establishmentsPerTenThousand} per 10,000 residents.`
            : "No supported ZIP-sector benchmark is available for this profile."}
        </p>
      </ReportSection>
      <ReportSection title="5. Top Opportunities">
        {record.insights.map((item) => (
          <p key={item.id} className="mb-2">
            <strong>{item.type}:</strong> {item.relevance}
          </p>
        ))}
      </ReportSection>
      <ReportSection title="6. Recommended Actions">
        {record.recommendations.slice(0, 3).map((item, index) => (
          <div key={item.id} className="mb-4">
            <p>
              <strong>
                {index + 1}. {item.title}
              </strong>{" "}
              ({item.confidence})
            </p>
            <p className="mt-1">{item.summary}</p>
            <p className="mt-1 text-xs text-slate-600">
              Limitation: {item.limitation}
            </p>
          </div>
        ))}
      </ReportSection>
      <ReportSection title="7. Chamber Partnership Opportunities">
        <p>
          {record.complementaryMembers.length} public member listings fall
          within complementary categories. Request opt-in introductions through
          Chamber staff; no existing relationship is implied.
        </p>
      </ReportSection>
      <ReportSection title="8. Methodology and Data Sources">
        <p>
          Recommendations use deterministic rule version 1.0.0. Inputs are
          verified public-directory fields, ACS estimates and margins of error,
          ZIP Business Patterns employer-establishment counts, and selected
          business goals.
        </p>
      </ReportSection>
      <ReportSection title="9. Data Limitations">
        <p>
          This report does not use revenue, customer, foot-traffic, or
          transaction data. ACS estimates carry sampling uncertainty. CBP/ZBP
          exclude most nonemployers. Recommendations are testable hypotheses,
          not forecasts or guaranteed outcomes.
        </p>
      </ReportSection>
    </article>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 py-5 last:border-0">
      <h4 className="mb-3 text-lg font-semibold">{title}</h4>
      <div className="text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
function ReportMetricRows({
  metrics,
}: {
  metrics: ReturnType<typeof buildBusinessIntelligence>["evidence"];
}) {
  return (
    <div>
      {metrics.map((item) => (
        <p key={item.id} className="mb-2">
          <strong>{item.label}:</strong> {item.formatted}
          {item.comparisonFormatted
            ? ` (Morris County: ${item.comparisonFormatted})`
            : ""}{" "}
          | {item.confidence}
        </p>
      ))}
    </div>
  );
}
function SummaryLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-b border-white/10 py-4 first:pt-0 last:border-0 last:pb-0">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
    </div>
  );
}
function HeaderFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="border-l-2 border-signal-teal/60 pl-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white print:text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}
function IntelligenceCard({
  label,
  value,
  comparison,
  confidence,
}: {
  label: string;
  value: string;
  comparison: string;
  confidence: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs leading-5 text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{comparison}</p>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs text-signal-teal">
        {confidence}
      </p>
    </section>
  );
}
function formatMargin(value: number, unit: string) {
  if (unit === "currency") return `$${Math.round(value).toLocaleString()}`;
  if (unit === "percent") return `${value.toFixed(1)} pts`;
  return Math.round(value).toLocaleString();
}
