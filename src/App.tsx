import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { attendance, countyBusinessPatterns, events, localDemographics, members, outreach, publicDataNotes } from "./data";
import type { Member } from "./types";
import {
  chartFromCounts,
  countBy,
  filterMembers,
  generateInsights,
  getChamberSectorBenchmarks,
  getContactability,
  getDataCompletenessMetrics,
  getDataCompletenessScore,
  getDataQualityScore,
  getMemberHealth,
  getMissingFields,
  getOutreachCandidates,
  getRealBusinessInsights,
  getRecommendedAction,
  getRenewalUrgency,
  getRenewalsByMonth,
  getSourceCoverage,
  getUpcomingRenewals,
  lastUpdatedLabel,
  membersWithoutOutreach,
  unique,
} from "./utils/analytics";
import { AlertCard, DemoBanner, EmptyState, InsightCard, MetricCard, Panel, ProgressLine, RiskLine, StatusBadge } from "./components/Cards";
import { MemberMapView } from "./components/MemberMapView";
import { PageHeader, Shell, type ViewKey } from "./components/Shell";

const palette = ["#4ea8ff", "#2dd4bf", "#39d98a", "#f59e0b", "#fb7185", "#a78bfa", "#94a3b8"];
const pageSize = 25;

type MemberFilters = {
  query: string;
  industry: string;
  city: string;
  status: string;
  renewalWindow: string;
  completeness: string;
  contactability: string;
  mapping: string;
  health: string;
};

const defaultFilters: MemberFilters = {
  query: "",
  industry: "",
  city: "",
  status: "",
  renewalWindow: "",
  completeness: "",
  contactability: "",
  mapping: "",
  health: "",
};

export default function App() {
  const initialView: ViewKey = window.location.pathname === "/project" || window.location.pathname === "/about" ? "project" : "overview";
  const [activeView, setActiveView] = useState<ViewKey>(initialView);

  return (
    <Shell activeView={activeView} setActiveView={setActiveView}>
      {activeView === "overview" && <Overview setActiveView={setActiveView} />}
      {activeView === "directory" && <MembersPage />}
      {activeView === "map" && <MapPage />}
      {activeView === "insights" && <Insights />}
      {activeView === "outreach" && <Outreach />}
      {activeView === "dataQuality" && <DataQuality />}
      {activeView === "methodology" && <Methodology setActiveView={setActiveView} />}
      {activeView === "project" && <ProjectOverview setActiveView={setActiveView} />}
    </Shell>
  );
}

function Overview({ setActiveView }: { setActiveView: (view: ViewKey) => void }) {
  const upcoming60 = getUpcomingRenewals(members, 60);
  const outreachCandidates = getOutreachCandidates(members, attendance, outreach, 7);
  const mapped = members.filter((member) => member.latitude && member.longitude);
  const renewalsByMonth = getRenewalsByMonth(members);
  const statuses = chartFromCounts(countBy(members, (member) => getMemberHealth(member)));
  const cities = chartFromCounts(countBy(members, (member) => member.city));
  const industries = chartFromCounts(countBy(members, (member) => member.industry));
  const dataQualityScore = getDataQualityScore(members, attendance.length, outreach.length);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Operational summary of the Chamber member directory, renewal workload, outreach priorities, geographic coverage, and data quality."
      />
      <div className="mb-5 flex justify-end">
        <DemoBanner />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiButton label="Total Members" value={members.length} detail="Public directory listings currently loaded" target="directory" setActiveView={setActiveView} />
        <KpiButton label="Renewals in Next 60 Days" value={upcoming60.length} detail="Records requiring renewal review" target="outreach" tone="amber" setActiveView={setActiveView} />
        <KpiButton label="Priority Outreach Candidates" value={outreachCandidates.length} detail="Ranked by transparent outreach score" target="outreach" tone="blue" setActiveView={setActiveView} />
        <KpiButton label="Mapped Members" value={mapped.length} detail={`${Math.round((mapped.length / members.length) * 100)}% of public listings`} target="map" tone="green" setActiveView={setActiveView} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_.85fr]">
        <div className="space-y-5">
          <Panel title="Renewal Pipeline">
            <ChartBars data={renewalsByMonth} />
          </Panel>
          <Panel title="Priority Outreach Queue">
            <OutreachQueueTable candidates={outreachCandidates} compact />
          </Panel>
          <Panel title="Member Record Status">
            <StatusPie data={statuses} />
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Geographic Concentration">
            <CompactChartList data={cities.slice(0, 6)} total={members.length} />
          </Panel>
          <Panel title="Top Industries">
            <CompactChartList data={industries.slice(0, 8)} total={members.length} />
          </Panel>
          <Panel title="Data Quality Summary">
            <ProgressLine label="Data Quality Score" value={dataQualityScore} detail="Phone, website, map, category, and renewal-date coverage" />
            <div className="mt-3 space-y-2">
              {getSourceCoverage(members).slice(0, 3).map((item) => (
                <ProgressLine key={item.label} label={item.label} value={item.value} detail={item.detail} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <Panel title="Upcoming Renewals">
          <MemberList members={upcoming60.slice(0, 8)} empty="No renewals in this window." />
        </Panel>
        <Panel title="Recent System Updates">
          <div className="space-y-3 text-sm text-slate-300">
            <RiskLine text={`Public directory snapshot refreshed on ${lastUpdatedLabel}.`} />
            <RiskLine text={`${members.length} member listings, ${mapped.length} mapped records, and ${members.filter((member) => member.website).length} websites are available for analysis.`} />
            <RiskLine text="Attendance and outreach records are not yet loaded; related metrics are documented in Methodology." />
          </div>
        </Panel>
      </div>
    </>
  );
}

function MembersPage() {
  const [filters, setFilters] = useState<MemberFilters>(defaultFilters);
  const [sort, setSort] = useState<keyof Member>("business_name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Member | null>(null);

  const filtered = useMemo(() => {
    return applyAdvancedFilters(filterMembers(members, filters.query, filters.industry, filters.city, filters.status), filters)
      .sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")));
  }, [filters, sort]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <>
      <PageHeader title="Members" description="Search, filter, and review public member records with practical outreach and data-quality labels." />
      <AdvancedFilters filters={filters} setFilters={(next) => { setFilters(next); setPage(1); }} />
      <Panel title={`${filtered.length} member records`} action={<SortSelect sort={sort} setSort={setSort} />}>
        <div className="max-h-[680px] overflow-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="sticky top-0 z-10 bg-ink-850 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 pr-4">Business</th>
                <th className="py-3 pr-4">Industry</th>
                <th className="py-3 pr-4">City</th>
                <th className="py-3 pr-4">Renewal</th>
                <th className="py-3 pr-4">Urgency</th>
                <th className="py-3 pr-4">Completeness</th>
                <th className="py-3 pr-4">Contactability</th>
                <th className="py-3 pr-4">Record Label</th>
                <th className="py-3 pr-4">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {visible.map((member) => (
                <tr key={member.member_id} className="cursor-pointer hover:bg-white/[0.04]" onClick={() => setSelected(member)}>
                  <td className="max-w-[280px] py-3 pr-4 font-medium text-white">{member.business_name}</td>
                  <td className="py-3 pr-4 text-slate-300">{member.industry}</td>
                  <td className="py-3 pr-4 text-slate-300">{member.city}</td>
                  <td className="py-3 pr-4 text-slate-400">{formatDate(member.renewal_date)}</td>
                  <td className="py-3 pr-4"><StatusBadge value={getRenewalUrgency(member)} /></td>
                  <td className="py-3 pr-4 text-slate-300">{getDataCompletenessScore(member)}%</td>
                  <td className="py-3 pr-4"><StatusBadge value={getContactability(member)} /></td>
                  <td className="py-3 pr-4"><StatusBadge value={getMemberHealth(member)} /></td>
                  <td className="min-w-[260px] py-3 pr-4 text-slate-400">{getRecommendedAction(member)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="control max-w-28" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <button className="control max-w-28" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      </Panel>
      {selected ? <MemberDrawer member={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function MapPage() {
  const [filters, setFilters] = useState<MemberFilters>(defaultFilters);
  const filtered = applyAdvancedFilters(filterMembers(members, filters.query, filters.industry, filters.city, filters.status), filters);
  const mapped = filtered.filter((member) => member.latitude && member.longitude);
  const unmapped = filtered.filter((member) => !member.latitude || !member.longitude);
  const cityCounts = chartFromCounts(countBy(filtered, (member) => member.city));

  return (
    <>
      <PageHeader title="Map" description="Geographic view of the Chamber's regional business network across Mount Olive and surrounding communities." />
      <AdvancedFilters filters={filters} setFilters={setFilters} compact />
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricCard label="Visible Members" value={filtered.length} detail="Current filtered records" />
        <MetricCard label="Mapped Members" value={mapped.length} detail="Records with public coordinates" tone="green" />
        <MetricCard label="Unmapped Records" value={unmapped.length} detail="Need address verification" tone="amber" />
        <MetricCard label="Top City" value={cityCounts[0]?.name ?? "None"} detail={`${cityCounts[0]?.value ?? 0} visible records`} />
      </div>
      <p className="mt-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
        The Chamber membership base includes businesses across Mount Olive and surrounding communities.
      </p>
      <div className="mt-5"><MemberMapView members={filtered} /></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Panel title="Map Legend">
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {["active", "at-risk", "inactive", "prospect"].map((status) => (
              <div key={status} className="flex items-center gap-3 rounded-lg bg-white/[0.035] p-3">
                <span className={`map-pin ${status}`} />
                <span className="capitalize">{status.replace("-", " ")}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Unmapped Members">
          <MemberList members={unmapped.slice(0, 8)} empty="All filtered members are mapped." />
        </Panel>
      </div>
    </>
  );
}

function Insights() {
  const industryData = chartFromCounts(countBy(members, (member) => member.industry)).slice(0, 12);
  const cityData = chartFromCounts(countBy(members, (member) => member.city));
  const zipData = chartFromCounts(countBy(members, (member) => member.zip_code || "Unlisted"));
  const upcoming = getUpcomingRenewals(members, 60);
  const sectorBenchmarks = getChamberSectorBenchmarks(members);
  const topFiveCities = cityData.slice(0, 5).reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <PageHeader title="Insights" description="Decision-focused observations from the public member directory and local economic context." />
      <SectionTitle title="Membership Composition" detail="Where the current directory is concentrated by category." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {generateInsights(members).map((insight) => <InsightCard key={insight} text={insight} />)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Industry Distribution"><ChartBars data={industryData} /></Panel>
        <Panel title="City Distribution"><ChartBars data={cityData} /></Panel>
        <Panel title="ZIP Concentration"><ChartBars data={zipData} /></Panel>
      </div>

      <SectionTitle title="Geographic Footprint" detail={`The five largest city clusters account for ${Math.round((topFiveCities / members.length) * 100)}% of current records.`} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <Panel title="ACS Local Market Indicators">
          <div className="grid gap-3 sm:grid-cols-2">
            {localDemographics.metrics.map((metric) => (
              <FactTile key={metric.label} label={metric.label} value={metric.formatted} detail={metric.detail} />
            ))}
          </div>
        </Panel>
        <Panel title="Chamber Mix vs Morris County Employers">
          <BenchmarkTable rows={sectorBenchmarks.slice(0, 10)} />
        </Panel>
      </div>

      <SectionTitle title="Renewal Pipeline" detail={`${upcoming.length} members renew within 60 days based on the current renewal placeholder field.`} />
      <Panel title="Upcoming Renewals">
        <MemberList members={upcoming} empty="No renewals in the next 60 days." />
      </Panel>

      <SectionTitle title="Data Coverage" detail="Use these signals to decide what staff should clean up first." />
      <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Panel title="Coverage Metrics">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {getDataCompletenessMetrics(members, attendance.length, outreach.length).map((item) => (
              <ProgressLine key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </Panel>
        <Panel title="Recommended Staff Focus">
          <div className="space-y-2">
            {getRealBusinessInsights(members).map((insight) => <RiskLine key={insight} text={insight} />)}
            <RiskLine text="Email coverage is not available in the public directory, so direct digital outreach requires an official contact export." />
          </div>
        </Panel>
      </div>
    </>
  );
}

function Outreach() {
  const candidates = getOutreachCandidates(members, attendance, outreach, 40);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = candidates.filter(({ reasons }) => !statusFilter || reasons.includes(statusFilter));

  return (
    <>
      <PageHeader title="Outreach" description="Workflow queue for renewal follow-up, contact cleanup, profile completion, and staff verification." />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Open Outreach Records" value={filtered.length - filtered.filter(({ member }) => completed.has(member.member_id)).length} detail="Current filtered queue" />
        <MetricCard label="60-Day Renewal Follow-Up" value={getUpcomingRenewals(members, 60).length} detail="Renewals needing staff review" tone="amber" />
        <MetricCard label="No Recorded Interaction Data" value={membersWithoutOutreach(members, outreach).length} detail="Outreach log not yet imported" tone="blue" />
      </div>
      <Panel
        title="Outreach Priority Score"
        action={
          <select className="control max-w-64" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All categories</option>
            {["Renewal Follow-Up", "Contact Information Update", "Profile Completion", "Mapping Cleanup", "Staff Verification", "Re-engagement Review"].map((item) => <option key={item}>{item}</option>)}
          </select>
        }
      >
        <p className="mb-4 text-sm leading-6 text-slate-400">
          This score ranks records using renewal timing, directory status, and data completeness. It is not a prediction of member behavior.
        </p>
        <OutreachQueueTable candidates={filtered} completed={completed} onToggle={(id) => setCompleted((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        })} />
      </Panel>
    </>
  );
}

function DataQuality() {
  const missingEmail = members.filter((member) => !member.email);
  const missingWebsite = members.filter((member) => !member.website);
  const missingCoordinates = members.filter((member) => !member.latitude || !member.longitude);
  const incomplete = members.filter((member) => getDataCompletenessScore(member) < 70);
  const qualityScore = getDataQualityScore(members, attendance.length, outreach.length);

  return (
    <>
      <PageHeader title="Data Quality" description="Single source for coverage, missing values, cleanup queues, and source limitations." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Data Quality Score" value={`${qualityScore}%`} detail="Weighted coverage score" tone={qualityScore >= 75 ? "green" : "amber"} />
        <MetricCard label="Duplicate Records" value="0" detail="No duplicate public names detected" tone="green" />
        <MetricCard label="Attendance Records" value={attendance.length} detail="Not yet imported" tone="amber" />
        <MetricCard label="Outreach Records" value={outreach.length} detail="Not yet imported" tone="amber" />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <Panel title="Coverage">
          <div className="grid gap-3 md:grid-cols-2">
            {getDataCompletenessMetrics(members, attendance.length, outreach.length).map((item) => (
              <ProgressLine key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </Panel>
        <Panel title="Scoring Method">
          <div className="space-y-2 text-sm text-slate-300">
            <RiskLine text="25% phone coverage, 20% website coverage, 20% map coverage, 20% industry category coverage, 15% valid renewal-date coverage." />
            <RiskLine text={`Last directory refresh: ${lastUpdatedLabel}. Source: public Chamber/Membee directory.`} />
            {publicDataNotes.map((note) => <RiskLine key={note} text={note} />)}
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Panel title="Missing Email"><MemberList members={missingEmail.slice(0, 10)} empty="No missing emails." /></Panel>
        <Panel title="Missing Website"><MemberList members={missingWebsite.slice(0, 10)} empty="No missing websites." /></Panel>
        <Panel title="Missing Coordinates"><MemberList members={missingCoordinates.slice(0, 10)} empty="No missing coordinates." /></Panel>
        <Panel title="Incomplete Records"><MemberList members={incomplete.slice(0, 10)} empty="No incomplete records." /></Panel>
        <Panel title="Invalid Dates"><EmptyState title="No invalid dates detected" description="All current renewal-date fields parse successfully." /></Panel>
        <Panel title="Category Review"><CompactChartList data={chartFromCounts(countBy(members, (member) => member.industry)).slice(0, 8)} total={members.length} /></Panel>
      </div>
    </>
  );
}

function Methodology({ setActiveView }: { setActiveView: (view: ViewKey) => void }) {
  const roadmap = [
    ["Attendance-Based Engagement Score", "Attendance history", "Unavailable", "Activates after consistent event check-in tracking"],
    ["Renewal-Risk Modeling", "Historical renewals and outcomes", "Unavailable", "Do not train until labeled renewal outcomes exist"],
    ["Event Participation Trends", "Event, RSVP, and attendance rows", "Partial schema only", "Ready for import workflow"],
    ["Outreach-Response Tracking", "Staff outreach log and outcomes", "Unavailable", "Requires staff workflow adoption"],
    ["Member Collaboration Network", "Referral and collaboration records", "Unavailable", "Future descriptive analysis"],
    ["Segment Analysis", "Attendance, tenure, renewal, and outreach features", "Limited", "Use only after enough behavioral data exists"],
  ];
  return (
    <>
      <PageHeader title="Methodology" description="Plain-English documentation for current metrics, scoring logic, limitations, and responsible use." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Current Data Sources">
          <div className="space-y-2">
            {publicDataNotes.map((note) => <RiskLine key={note} text={note} />)}
          </div>
        </Panel>
        <Panel title="Privacy and Responsible Use">
          <div className="space-y-2">
            <RiskLine text="Analytics support staff judgment and should not be treated as definitive assessments of any business." />
            <RiskLine text="Public project materials must not expose member names, phone numbers, exact addresses, or internal notes." />
            <RiskLine text="No generative AI is used to determine priority scores or retention status." />
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {[
          ["Profile completeness", "Business name, category, phone, website, address, and coordinates.", "A percentage of available public fields. Missing official emails lower readiness until official exports are imported."],
          ["Renewal urgency", "Renewal date field.", "Past Due, Due Soon, Upcoming, or Scheduled based on days from the current analysis date."],
          ["Outreach priority", "Renewal timing, missing contact fields, website coverage, map coverage, and outreach log availability.", "Deterministic queue score. It is not machine learning and not a behavior prediction."],
          ["Map readiness", "Latitude and longitude from public directory map data.", "Shows whether a record can appear on the geographic view."],
          ["Data coverage", "Directory fields plus imported attendance/outreach tables.", "Coverage percentages identify cleanup queues and import gaps."],
          ["Membership status", "Directory/status field where available.", "Current snapshot treats public listings as active directory records unless official internal status is provided."],
        ].map(([title, inputs, limitations]) => (
          <Panel key={title} title={title}>
            <p className="text-sm leading-6 text-slate-300"><span className="font-medium text-white">Inputs:</span> {inputs}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400"><span className="font-medium text-white">Limitations:</span> {limitations}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-6">
        <Panel title="Future Analytics Roadmap">
          <RoadmapTable rows={roadmap} />
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Public Project Overview">
          <p className="text-sm leading-6 text-slate-300">A public-safe project page is available for civic leaders and admissions readers. It excludes member names, contact details, addresses, and internal status fields.</p>
          <button className="mt-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white hover:bg-white/[0.1]" onClick={() => setActiveView("project")}>
            Open project overview
          </button>
        </Panel>
      </div>
    </>
  );
}

function ProjectOverview({ setActiveView }: { setActiveView: (view: ViewKey) => void }) {
  return (
    <>
      <PageHeader title="Mount Olive Chamber Analytics" description="Public-safe project overview for civic, educational, and economic-development audiences." />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="Problem Addressed">
          <p className="text-sm leading-6 text-slate-300">
            Local Chambers often manage member records, outreach work, renewal follow-up, and event participation across scattered spreadsheets and directory exports. This project converts public directory information into a structured internal analytics interface while documenting what official data is still needed.
          </p>
        </Panel>
        <Panel title="Development Status">
          <div className="grid gap-3 sm:grid-cols-2">
            <FactTile label="Current records" value={members.length.toString()} detail="Public directory listings" />
            <FactTile label="Mapped records" value={members.filter((member) => member.latitude && member.longitude).length.toString()} detail="Public coordinates available" />
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {["Member directory analysis", "Renewal workload review", "Outreach priority queue", "Geographic business map", "Data quality audit", "Methodology documentation"].map((item) => (
          <Panel key={item} title={item}>
            <p className="text-sm leading-6 text-slate-400">Implemented as part of the internal analytics platform using public source data and clearly labeled placeholder fields.</p>
          </Panel>
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Panel title="Privacy Approach">
          <div className="space-y-2">
            <RiskLine text="This page intentionally avoids displaying member names, phone numbers, exact addresses, internal notes, or individual priority labels." />
            <RiskLine text="The internal app uses public directory data and marks synthetic fields until official Chamber exports are available." />
          </div>
        </Panel>
        <Panel title="Technology">
          <p className="text-sm leading-6 text-slate-300">React, Vite, TypeScript, Tailwind CSS, Recharts, React Leaflet, public Chamber directory data, ACS indicators, and U.S. Census County Business Patterns context.</p>
          <button className="mt-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white hover:bg-white/[0.1]" onClick={() => setActiveView("overview")}>
            Return to internal overview
          </button>
        </Panel>
      </div>
    </>
  );
}

function AdvancedFilters({ filters, setFilters, compact = false }: { filters: MemberFilters; setFilters: (filters: MemberFilters) => void; compact?: boolean }) {
  const industries = unique(members.map((member) => member.industry)).sort();
  const cities = unique(members.map((member) => member.city)).sort();
  const update = (key: keyof MemberFilters, value: string) => setFilters({ ...filters, [key]: value });
  return (
    <div className={`mb-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-[1.3fr_repeat(4,1fr)] xl:grid-cols-[1.4fr_repeat(7,1fr)_auto]"}`}>
      <input aria-label="Search members" value={filters.query} onChange={(event) => update("query", event.target.value)} placeholder="Search businesses, categories, phones, addresses" className="control" />
      <Select label="Industry" value={filters.industry} onChange={(value) => update("industry", value)} options={industries} empty="All industries" />
      <Select label="City" value={filters.city} onChange={(value) => update("city", value)} options={cities} empty="All cities" />
      <Select label="Status" value={filters.status} onChange={(value) => update("status", value)} options={["active", "inactive", "prospect"]} empty="All statuses" />
      <Select label="Renewal window" value={filters.renewalWindow} onChange={(value) => update("renewalWindow", value)} options={["Due Soon", "Upcoming", "Scheduled", "Past Due"]} empty="Any renewal" />
      {!compact ? <Select label="Completeness" value={filters.completeness} onChange={(value) => update("completeness", value)} options={["Complete", "Review"]} empty="Any completeness" /> : null}
      {!compact ? <Select label="Contactability" value={filters.contactability} onChange={(value) => update("contactability", value)} options={["Phone Listed", "Needs Contact"]} empty="Any contact" /> : null}
      {!compact ? <Select label="Mapping" value={filters.mapping} onChange={(value) => update("mapping", value)} options={["Mapped", "Unmapped"]} empty="Any map status" /> : null}
      {!compact ? <button className="control min-w-28" onClick={() => setFilters(defaultFilters)}>Reset</button> : null}
    </div>
  );
}

function Select({ label, value, onChange, options, empty }: { label: string; value: string; onChange: (value: string) => void; options: string[]; empty: string }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="control">
      <option value="">{empty}</option>
      {options.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}

function applyAdvancedFilters(base: Member[], filters: MemberFilters) {
  return base.filter((member) => {
    const completeness = getDataCompletenessScore(member);
    return (
      (!filters.renewalWindow || getRenewalUrgency(member) === filters.renewalWindow) &&
      (!filters.completeness || (filters.completeness === "Complete" ? completeness >= 85 : completeness < 85)) &&
      (!filters.contactability || (filters.contactability === "Phone Listed" ? Boolean(member.phone) : !member.phone && !member.email)) &&
      (!filters.mapping || (filters.mapping === "Mapped" ? Boolean(member.latitude && member.longitude) : !member.latitude || !member.longitude)) &&
      (!filters.health || getMemberHealth(member) === filters.health)
    );
  });
}

function KpiButton({ label, value, detail, target, setActiveView, tone = "blue" }: { label: string; value: string | number; detail: string; target: ViewKey; setActiveView: (view: ViewKey) => void; tone?: "blue" | "green" | "amber" | "red" }) {
  return (
    <button className="text-left focus:outline-none focus:ring-2 focus:ring-signal-blue/50" title={`${label}: ${detail}`} onClick={() => setActiveView(target)}>
      <MetricCard label={label} value={value} detail={`${detail}. Click to open ${target === "directory" ? "Members" : target}.`} tone={tone} />
    </button>
  );
}

function SortSelect({ sort, setSort }: { sort: keyof Member; setSort: (value: keyof Member) => void }) {
  return (
    <select value={sort} onChange={(event) => setSort(event.target.value as keyof Member)} className="control max-w-44" aria-label="Sort members">
      <option value="business_name">Sort by name</option>
      <option value="industry">Sort by industry</option>
      <option value="city">Sort by city</option>
      <option value="renewal_date">Sort by renewal</option>
      <option value="membership_status">Sort by status</option>
    </select>
  );
}

function MemberDrawer({ member, onClose }: { member: Member; onClose: () => void }) {
  const missing = getMissingFields(member);
  return (
    <div className="fixed inset-0 z-50 bg-black/50" role="dialog" aria-modal="true" aria-label={`${member.business_name} member profile`}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-ink-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-signal-teal">Member profile</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{member.business_name}</h3>
            <p className="mt-1 text-sm text-slate-400">{member.industry} | {member.city}</p>
          </div>
          <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/[0.06]" onClick={onClose}>Close</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusBadge value={getRenewalUrgency(member)} />
          <StatusBadge value={getMemberHealth(member)} />
          <StatusBadge value={getContactability(member)} />
        </div>
        <div className="mt-5"><ProgressLine label="Profile completeness" value={getDataCompletenessScore(member)} detail="Based on currently available directory fields" /></div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Address" value={`${member.address}, ${member.city}, ${member.state} ${member.zip_code}`} />
          <Detail label="Phone" value={member.phone || "Missing"} />
          <Detail label="Email" value={member.email || "Not in public directory"} />
          <Detail label="Website" value={member.website || "Missing"} />
          <Detail label="Renewal" value={formatDate(member.renewal_date)} />
          <Detail label="Mapping" value={member.latitude && member.longitude ? "Mapped" : "Unmapped"} />
        </dl>
        <Panel title="Current Priority">
          <p className="text-sm leading-6 text-slate-300">{getRecommendedAction(member)}</p>
          {missing.length ? <p className="mt-3 text-sm text-signal-amber">Missing fields: {missing.join(", ")}</p> : null}
        </Panel>
        <Panel title="Internal Notes">
          <textarea className="control min-h-28 py-3" placeholder="Add staff note. Notes are local UI only until a database is added." aria-label="Internal notes" />
        </Panel>
        {member.source_url ? (
          <a className="mt-4 inline-flex rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/[0.06]" href={member.source_url} target="_blank" rel="noreferrer">
            Open public directory source
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OutreachQueueTable({ candidates, compact = false, completed, onToggle }: { candidates: ReturnType<typeof getOutreachCandidates>; compact?: boolean; completed?: Set<string>; onToggle?: (id: string) => void }) {
  if (!candidates.length) return <EmptyState title="No outreach records" description="No records match the current queue filters." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-3 pr-4">Business</th>
            <th className="py-3 pr-4">Reason</th>
            <th className="py-3 pr-4">Priority</th>
            <th className="py-3 pr-4">Renewal</th>
            <th className="py-3 pr-4">Recommended Action</th>
            {!compact ? <th className="py-3 pr-4">Owner</th> : null}
            {!compact ? <th className="py-3 pr-4">Due</th> : null}
            {!compact ? <th className="py-3 pr-4">Complete</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {candidates.slice(0, compact ? 7 : 40).map(({ member, reasons, score }) => (
            <tr key={member.member_id}>
              <td className="max-w-[260px] py-3 pr-4 font-medium text-white">{member.business_name}</td>
              <td className="min-w-[220px] py-3 pr-4 text-slate-300">{reasons.join(", ")}</td>
              <td className="py-3 pr-4 text-signal-blue">{score}</td>
              <td className="py-3 pr-4 text-slate-400">{formatDate(member.renewal_date)}</td>
              <td className="min-w-[280px] py-3 pr-4 text-slate-400">{getRecommendedAction(member)}</td>
              {!compact ? <td className="py-3 pr-4"><input className="control min-w-32" placeholder="Owner" aria-label={`Owner for ${member.business_name}`} /></td> : null}
              {!compact ? <td className="py-3 pr-4"><input className="control min-w-36" type="date" aria-label={`Due date for ${member.business_name}`} /></td> : null}
              {!compact ? (
                <td className="py-3 pr-4">
                  <input type="checkbox" checked={completed?.has(member.member_id) ?? false} onChange={() => onToggle?.(member.member_id)} aria-label={`Mark ${member.business_name} complete`} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberList({ members, empty }: { members: Member[]; empty: string }) {
  if (!members.length) return <EmptyState title={empty} description="No records currently match this list." />;
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.member_id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] p-3 text-sm">
          <div>
            <p className="font-medium text-white">{member.business_name}</p>
            <p className="text-slate-500">{member.city} | {member.industry}</p>
          </div>
          <span className="text-xs text-slate-400">{formatDate(member.renewal_date)}</span>
        </div>
      ))}
    </div>
  );
}

function BenchmarkTable({ rows }: { rows: ReturnType<typeof getChamberSectorBenchmarks> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-3 pr-4">Sector</th>
            <th className="py-3 pr-4">Members</th>
            <th className="py-3 pr-4">Chamber</th>
            <th className="py-3 pr-4">County</th>
            <th className="py-3 pr-4">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="max-w-[260px] py-3 pr-4 font-medium text-white">{row.name}</td>
              <td className="py-3 pr-4 text-slate-300">{row.chamberMembers}</td>
              <td className="py-3 pr-4 text-slate-300">{row.chamberShare}%</td>
              <td className="py-3 pr-4 text-slate-300">{row.countyShare}%</td>
              <td className={`py-3 pr-4 ${row.representationGap >= 0 ? "text-signal-green" : "text-signal-amber"}`}>{row.representationGap > 0 ? "+" : ""}{row.representationGap} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-5 text-slate-500">Chamber categories are mapped to broad NAICS-style sectors for comparison. This is descriptive, not a formal industry classification.</p>
    </div>
  );
}

function RoadmapTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
          <tr><th className="py-3 pr-4">Capability</th><th className="py-3 pr-4">Required Data</th><th className="py-3 pr-4">Readiness</th><th className="py-3 pr-4">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map(([capability, data, readiness, status]) => (
            <tr key={capability}><td className="py-3 pr-4 font-medium text-white">{capability}</td><td className="py-3 pr-4 text-slate-300">{data}</td><td className="py-3 pr-4 text-slate-300">{readiness}</td><td className="py-3 pr-4 text-slate-400">{status}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactChartList({ data, total }: { data: { name: string; value: number }[]; total: number }) {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <ProgressLine key={item.name} label={`${item.name} (${item.value})`} value={Math.round((item.value / total) * 100)} />
      ))}
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4 mt-8">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function FactTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-3">
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}

function ChartBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
          <XAxis type="number" stroke="#94a3b8" />
          <YAxis type="category" width={132} dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,.06)" }} contentStyle={{ background: "#0f1d2b", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#4ea8ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={2}>
              {data.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#0f1d2b", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.035] p-2 text-sm">
            <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette[index % palette.length] }} />{item.name}</span>
            <span className="text-slate-400">{item.value} | {Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Missing";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
