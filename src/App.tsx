import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { attendance, events, members, outreach } from "./data";
import type { Member } from "./types";
import { chartFromCounts, countBy, filterMembers, generateInsights, getAttendanceSummary, getDataCompletenessMetrics, getDataCompletenessScore, getMemberHealth, getMissingFields, getNewMembersByYear, getPilotCandidates, getPriorityAlerts, getReadiness, getRecommendedAction, getUpcomingRenewals, membersWithoutOutreach, unique } from "./utils/analytics";
import { AlertCard, DemoBanner, EmptyState, InsightCard, MetricCard, Panel, ProgressLine, RiskLine, StatusBadge } from "./components/Cards";
import { MemberMapView } from "./components/MemberMapView";
import { PageHeader, Shell, type ViewKey } from "./components/Shell";

const palette = ["#4ea8ff", "#2dd4bf", "#39d98a", "#f59e0b", "#fb7185", "#a78bfa", "#f472b6"];

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");

  return (
    <Shell activeView={activeView} setActiveView={setActiveView}>
      {activeView === "overview" && <Overview />}
      {activeView === "directory" && <Directory />}
      {activeView === "map" && <MapPage />}
      {activeView === "insights" && <Insights />}
      {activeView === "engagement" && <Engagement />}
      {activeView === "actions" && <Actions />}
    </Shell>
  );
}

function Overview() {
  const industries = chartFromCounts(countBy(members, (member) => member.industry));
  const statuses = chartFromCounts(countBy(members, (member) => member.membership_status));
  const newMembers = getNewMembersByYear(members);
  const upcoming = getUpcomingRenewals(members);
  const missingItems = members.reduce((sum, member) => sum + getMissingFields(member).length, 0);
  const readiness = getReadiness(members, events.length, attendance.length, outreach.length);
  const alerts = getPriorityAlerts(members, attendance, outreach);
  const completeness = getDataCompletenessMetrics(members, attendance.length, outreach.length);

  return (
    <>
      <PageHeader
        title="Executive Overview"
        description="A leadership view of MOCOC member composition, data completeness, and readiness for future engagement and retention analytics."
      />
      <DemoBanner />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert) => (
          <AlertCard key={alert.label} {...alert} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Members" value={members.length} detail="Loaded from the directory scrape" />
        <MetricCard label="Active Members" value={members.filter((m) => m.membership_status === "active").length} detail="Demo status assignments" tone="green" />
        <MetricCard label="Unique Industries" value={unique(members.map((m) => m.industry)).length} detail="Directory categories represented" />
        <MetricCard label="Cities Represented" value={unique(members.map((m) => m.city)).length} detail="Demo geocoding coverage" />
        <MetricCard label="Upcoming Renewals" value={upcoming.length} detail="Next 90 days" tone="amber" />
        <MetricCard label="Missing Data Items" value={missingItems} detail="Contact, email, web, or map gaps" tone="red" />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Panel title="Members by Industry">
          <ChartBars data={industries.slice(0, 10)} />
        </Panel>
        <Panel title="Membership Status">
          <StatusPie data={statuses} />
        </Panel>
        <Panel title="New Members Over Time">
          <Trend data={newMembers} />
        </Panel>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Panel title="Dashboard Readiness">
          <div className="space-y-3">
            {readiness.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] p-3">
                <div>
                  <p className="font-medium text-white">{item.label}</p>
                  <p className="text-sm text-slate-400">{item.detail}</p>
                </div>
                <StatusBadge value={item.status} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Current System Story">
          <p className="text-sm leading-6 text-slate-300">
            This dashboard currently provides Chamber composition and member intelligence. It is structured to become a retention and engagement system once attendance and outreach data are collected consistently.
          </p>
        </Panel>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <Panel title="Data Completeness Dashboard">
          <div className="grid gap-3 sm:grid-cols-2">
            {completeness.map((item) => (
              <ProgressLine key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </Panel>
        <Panel title="Phase 2 Pilot Candidates">
          <PilotCandidateList candidates={getPilotCandidates(members, attendance, outreach, 7)} />
        </Panel>
      </div>
    </>
  );
}

function Directory() {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<keyof Member>("business_name");
  const filtered = useMemo(
    () => filterMembers(members, query, industry, city, status).sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""))),
    [query, industry, city, status, sort],
  );
  const [selectedId, setSelectedId] = useState(members[0]?.member_id);
  const selected = members.find((member) => member.member_id === selectedId) ?? filtered[0];

  return (
    <>
      <PageHeader title="Member Directory" description="Browse, filter, and audit member records from the current MOCOC directory export." />
      <Filters query={query} setQuery={setQuery} industry={industry} setIndustry={setIndustry} city={city} setCity={setCity} status={status} setStatus={setStatus} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title={`${filtered.length} member records`} action={<SortSelect sort={sort} setSort={setSort} />}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Business</th>
                  <th className="py-3 pr-4">Industry</th>
                  <th className="py-3 pr-4">City</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Renewal</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Health</th>
                  <th className="py-3 pr-4">Gaps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((member) => (
                  <tr key={member.member_id} className="cursor-pointer hover:bg-white/[0.04]" onClick={() => setSelectedId(member.member_id)}>
                    <td className="max-w-[260px] py-3 pr-4 font-medium text-white">{member.business_name}</td>
                    <td className="py-3 pr-4 text-slate-300">{member.industry}</td>
                    <td className="py-3 pr-4 text-slate-300">{member.city}</td>
                    <td className="py-3 pr-4 text-slate-400">{member.phone || "Missing"}</td>
                    <td className="py-3 pr-4 text-slate-400">{member.renewal_date}</td>
                    <td className="py-3 pr-4"><StatusBadge value={member.membership_status} /></td>
                    <td className="py-3 pr-4"><StatusBadge value={getMemberHealth(member)} /></td>
                    <td className="py-3 pr-4 text-signal-amber">{getMissingFields(member).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {selected ? <MemberDetail member={selected} /> : null}
      </div>
    </>
  );
}

function MapPage() {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const filtered = filterMembers(members, query, industry, city, status);
  const mapped = filtered.filter((member) => member.latitude && member.longitude);
  const unmapped = filtered.filter((member) => !member.latitude || !member.longitude);
  const cityCounts = chartFromCounts(countBy(filtered, (member) => member.city));

  return (
    <>
      <PageHeader title="Member Map" description="A geographic operating view of the Chamber membership base, using demo coordinates where the scrape did not include geocoded fields." />
      <Filters query={query} setQuery={setQuery} industry={industry} setIndustry={setIndustry} city={city} setCity={setCity} status={status} setStatus={setStatus} />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Mapped Members" value={mapped.length} detail="Records with coordinates" tone="green" />
        <MetricCard label="Missing Coordinates" value={filtered.length - mapped.length} detail="Needs geocoding before field use" tone="amber" />
        <MetricCard label="Top City" value={cityCounts[0]?.name ?? "None"} detail={`${cityCounts[0]?.value ?? 0} filtered records`} />
      </div>
      <div className="mt-5"><MemberMapView members={filtered} /></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Panel title="Map Legend">
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {["active", "at-risk", "inactive", "prospect"].map((status) => (
              <div key={status} className="flex items-center gap-3 rounded-lg bg-white/[0.035] p-3">
                <span className={`map-pin ${status}`} />
                <span className="capitalize">{status}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Unmapped Members">
          <CompactList members={unmapped.slice(0, 6)} empty="All filtered members are mapped." />
        </Panel>
      </div>
    </>
  );
}

function Insights() {
  const industryData = chartFromCounts(countBy(members, (member) => member.industry)).slice(0, 12);
  const cityData = chartFromCounts(countBy(members, (member) => member.city));
  const zipData = chartFromCounts(countBy(members, (member) => member.zip_code));
  const upcoming = getUpcomingRenewals(members, 60);
  return (
    <>
      <PageHeader title="Chamber Insights" description="Data-supported observations about member composition, concentration, renewals, and missing fields." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {generateInsights(members).map((insight) => <InsightCard key={insight} text={insight} />)}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Panel title="Industry Distribution"><ChartBars data={industryData} /></Panel>
        <Panel title="City Distribution"><ChartBars data={cityData} /></Panel>
        <Panel title="Zip Concentration"><ChartBars data={zipData} /></Panel>
      </div>
      <div className="mt-6">
        <Panel title="Renewals In The Next 60 Days">
          <CompactList members={upcoming} empty="No renewals in the next 60 days." />
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Data Completeness Signals">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {getDataCompletenessMetrics(members, attendance.length, outreach.length).map((item) => (
              <ProgressLine key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Engagement() {
  const summary = getAttendanceSummary(members, attendance);
  return (
    <>
      <PageHeader title="Engagement Preparation" description="The Phase 2 foundation for measuring attendance, outreach, renewal risk, and member collaboration." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {["Engagement Score", "Renewal Risk Level", "Last Activity Date", "Event Attendance Trends", "Collaboration Network"].map((title) => (
          <Panel key={title} title={title}>
            <EmptyState title="Planned module" description="This becomes active once attendance and outreach are tracked consistently." />
          </Panel>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Future Engagement Formula">
          <div className="space-y-3 text-sm text-slate-300">
            <RiskLine text="Attendance frequency: 40%" />
            <RiskLine text="Recency of participation: 30%" />
            <RiskLine text="Diversity of event participation: 20%" />
            <RiskLine text="Outreach responsiveness: 10%" />
          </div>
        </Panel>
        <Panel title="Current Attendance Readiness">
          {attendance.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Attendance Rows" value={summary.trackedAttendance} detail="Event participation records" />
              <MetricCard label="Members Seen" value={summary.membersWithAttendance} detail="Have at least one attended event" />
              <MetricCard label="Zero Attendance" value={summary.membersWithZeroAttendance} detail="Need engagement review" tone="amber" />
            </div>
          ) : (
            <EmptyState title="No attendance data yet" description="This section becomes the Chamber's retention engine after events, attendance, and outreach are tracked consistently." />
          )}
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Recommended 5-7 Business Engagement Pilot">
          <PilotCandidateList candidates={getPilotCandidates(members, attendance, outreach, 7)} />
        </Panel>
      </div>
    </>
  );
}

function Actions() {
  const missingEmail = members.filter((member) => !member.email);
  const missingWebsite = members.filter((member) => !member.website);
  const missingCoordinates = members.filter((member) => !member.latitude || !member.longitude);
  const incomplete = members.filter((member) => getMissingFields(member).length > 2);
  const upcoming = getUpcomingRenewals(members, 60);
  const noOutreach = membersWithoutOutreach(members, outreach);
  const checklist = ["Standardize member records", "Collect event attendance", "Track outreach", "Identify at-risk members", "Run 5-7 business engagement pilot", "Measure before/after engagement"];

  return (
    <>
      <PageHeader title="Action Center" description="Convert current data gaps into an operational cleanup list and Phase 2 engagement pilot checklist." />
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {getPriorityAlerts(members, attendance, outreach).map((alert) => (
          <AlertCard key={alert.label} {...alert} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Members Missing Email"><CompactList members={missingEmail.slice(0, 8)} empty="All records have email." /></Panel>
        <Panel title="Members Missing Website"><CompactList members={missingWebsite.slice(0, 8)} empty="All records have website." /></Panel>
        <Panel title="Members Missing Coordinates"><CompactList members={missingCoordinates.slice(0, 8)} empty="All records are mapped." /></Panel>
        <Panel title="Upcoming Renewals"><CompactList members={upcoming.slice(0, 8)} empty="No near-term renewals." /></Panel>
        <Panel title="Incomplete Records"><CompactList members={incomplete.slice(0, 8)} empty="No heavily incomplete records." /></Panel>
        <Panel title="No Follow-up Logged"><CompactList members={noOutreach.slice(0, 8)} empty="Every member has outreach." /></Panel>
      </div>
      <div className="mt-6">
        <Panel title="Phase 1 To Phase 2 Checklist">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {checklist.map((item, index) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <span className="text-xs font-semibold text-signal-teal">Step {index + 1}</span>
                <p className="mt-2 font-medium text-white">{item}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Pilot Candidate Shortlist">
          <PilotCandidateList candidates={getPilotCandidates(members, attendance, outreach, 7)} />
        </Panel>
      </div>
    </>
  );
}

function Filters(props: {
  query: string; setQuery: (value: string) => void; industry: string; setIndustry: (value: string) => void; city: string; setCity: (value: string) => void; status: string; setStatus: (value: string) => void;
}) {
  const industries = unique(members.map((member) => member.industry)).sort();
  const cities = unique(members.map((member) => member.city)).sort();
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[1fr_220px_180px_160px]">
      <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search businesses, categories, phones, addresses" className="control" />
      <select value={props.industry} onChange={(event) => props.setIndustry(event.target.value)} className="control">
        <option value="">All industries</option>
        {industries.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={props.city} onChange={(event) => props.setCity(event.target.value)} className="control">
        <option value="">All cities</option>
        {cities.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={props.status} onChange={(event) => props.setStatus(event.target.value)} className="control">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="at-risk">At-risk</option>
        <option value="inactive">Inactive</option>
        <option value="prospect">Prospect</option>
      </select>
    </div>
  );
}

function SortSelect({ sort, setSort }: { sort: keyof Member; setSort: (value: keyof Member) => void }) {
  return (
    <select value={sort} onChange={(event) => setSort(event.target.value as keyof Member)} className="control max-w-44">
      <option value="business_name">Sort by name</option>
      <option value="industry">Sort by industry</option>
      <option value="city">Sort by city</option>
      <option value="renewal_date">Sort by renewal</option>
      <option value="membership_status">Sort by status</option>
    </select>
  );
}

function MemberDetail({ member }: { member: Member }) {
  const missing = getMissingFields(member);
  const completeness = getDataCompletenessScore(member);
  const health = getMemberHealth(member);
  return (
    <Panel title="Member Detail">
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{member.business_name}</h3>
          <p className="mt-1 text-sm text-slate-400">{member.industry}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={member.membership_status} />
          <StatusBadge value={health} />
        </div>
        <ProgressLine label="Record completeness" value={completeness} detail="Preview score based on available directory fields" />
        <dl className="grid gap-3 text-sm">
          <Detail label="Address" value={`${member.address}, ${member.city}, ${member.state} ${member.zip_code}`} />
          <Detail label="Phone" value={member.phone || "Missing"} />
          <Detail label="Email" value={member.email || "Missing"} />
          <Detail label="Website" value={member.website || "Missing"} />
          <Detail label="Renewal" value={member.renewal_date} />
        </dl>
        <p className="text-sm leading-6 text-slate-300">{member.notes}</p>
        {missing.length ? <RiskLine text={`Missing fields: ${missing.join(", ")}`} /> : null}
        <div className="rounded-lg border border-signal-blue/20 bg-signal-blue/[0.08] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-signal-blue">Recommended next action</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{getRecommendedAction(member)}</p>
          <button className="mt-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white transition hover:bg-white/[0.1]">
            Add to pilot list
          </button>
        </div>
      </div>
    </Panel>
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

function CompactList({ members, empty }: { members: Member[]; empty: string }) {
  if (!members.length) return <EmptyState title={empty} description="No action is needed for this category right now." />;
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.member_id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] p-3 text-sm">
          <div>
            <p className="font-medium text-white">{member.business_name}</p>
            <p className="text-slate-500">{member.city} - {member.industry}</p>
          </div>
          <span className="text-xs text-slate-400">{member.renewal_date}</span>
        </div>
      ))}
    </div>
  );
}

function PilotCandidateList({ candidates }: { candidates: ReturnType<typeof getPilotCandidates> }) {
  if (!candidates.length) {
    return <EmptyState title="No pilot candidates yet" description="Candidates will appear once renewal, outreach, and attendance signals are available." />;
  }

  return (
    <div className="space-y-3">
      {candidates.map(({ member, reasons, score }, index) => (
        <div key={member.member_id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-signal-teal">Candidate {index + 1}</p>
              <h4 className="mt-1 font-semibold text-white">{member.business_name}</h4>
              <p className="mt-1 text-sm text-slate-400">{member.city} - {member.industry}</p>
            </div>
            <div className="rounded-full bg-signal-blue/[0.12] px-3 py-1 text-xs font-medium text-signal-blue">
              Priority {score}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">
                {reason}
              </span>
            ))}
          </div>
        </div>
      ))}
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
          <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#4ea8ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={3}>
            {data.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#0f1d2b", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Trend({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0f1d2b", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
          <Line type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
