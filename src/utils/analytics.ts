import type { Attendance, Member, Outreach } from "../types";
import { countyBusinessPatterns } from "../data/localEconomy";

export const today = new Date("2026-07-16T12:00:00");
export const lastUpdatedLabel = "July 16, 2026";

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function chartFromCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function getMissingFields(member: Member) {
  return [
    ["contact", member.contact_name],
    ["email", member.email],
    ["phone", member.phone],
    ["website", member.website],
    ["coordinates", member.latitude && member.longitude ? "yes" : ""],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => field);
}

export function getDataCompletenessScore(member: Member) {
  const requiredFields = [
    member.business_name,
    member.industry,
    member.address,
    member.city,
    member.phone,
    member.website,
    member.email,
    member.latitude && member.longitude ? "coordinates" : "",
  ];
  const complete = requiredFields.filter(Boolean).length;
  return Math.round((complete / requiredFields.length) * 100);
}

export function getMemberHealth(member: Member) {
  const score = getDataCompletenessScore(member);
  const urgency = getRenewalUrgency(member);
  if (urgency === "Due Soon") return "Renewal Approaching";
  if (score < 55) return "Needs Review";
  if (!member.email || !member.phone) return "Missing Contact Data";
  if (score >= 85) return "Profile Complete";
  return "Baseline Record";
}

export function getRecommendedAction(member: Member) {
  const missing = getMissingFields(member);
  if (getRenewalUrgency(member) === "Due Soon") return "Schedule renewal follow-up and confirm current contact information.";
  if (missing.includes("email")) return "Collect a direct email contact for campaign and renewal tracking.";
  if (missing.includes("coordinates")) return "Verify address and geocode for territory analysis.";
  if (missing.includes("website")) return "Add website to improve public-facing referral readiness.";
  return "Maintain record and include in routine member communications.";
}

export function getDataCompletenessMetrics(members: Member[], attendanceCount: number, outreachCount: number) {
  const percent = (count: number) => Math.round((count / Math.max(members.length, 1)) * 100);
  return [
    { label: "Contact phone coverage", value: percent(members.filter((member) => member.phone).length), detail: "Members with a phone number" },
    { label: "Email readiness", value: percent(members.filter((member) => member.email).length), detail: "Members with an email address" },
    { label: "Website coverage", value: percent(members.filter((member) => member.website).length), detail: "Members with a website link" },
    { label: "Map readiness", value: percent(members.filter((member) => member.latitude && member.longitude).length), detail: "Members with coordinates" },
    { label: "Attendance tracking", value: attendanceCount ? 100 : 0, detail: `${attendanceCount} attendance rows loaded` },
    { label: "Outreach tracking", value: outreachCount ? 100 : 0, detail: `${outreachCount} outreach rows loaded` },
  ];
}

export function getOutreachCandidates(members: Member[], attendance: Attendance[], outreach: Outreach[], limit = 12) {
  const attended = new Set(attendance.filter((item) => item.attended).map((item) => item.member_id));
  const contacted = new Set(outreach.map((item) => item.member_id));
  const upcoming = new Set(getUpcomingRenewals(members, 120).map((member) => member.member_id));

  return members
    .map((member) => {
      const missing = getMissingFields(member);
      const reasons = [
        upcoming.has(member.member_id) ? "Renewal Follow-Up" : "",
        missing.includes("email") || missing.includes("phone") ? "Contact Information Update" : "",
        missing.includes("website") ? "Profile Completion" : "",
        missing.includes("coordinates") ? "Mapping Cleanup" : "",
        !contacted.has(member.member_id) ? "Staff Verification" : "",
        !attended.has(member.member_id) && attendance.length > 0 ? "Re-engagement Review" : "",
      ].filter(Boolean);
      const score = reasons.length * 10 + missing.length * 3 + (upcoming.has(member.member_id) ? 15 : 0);
      return { member, reasons, score };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.member.business_name.localeCompare(b.member.business_name))
    .slice(0, limit);
}

export const getPilotCandidates = getOutreachCandidates;

export function getPriorityAlerts(members: Member[], attendance: Attendance[], outreach: Outreach[]) {
  const missingEmail = members.filter((member) => !member.email).length;
  const upcoming = getUpcomingRenewals(members, 60).length;
  const missingCoordinates = members.filter((member) => !member.latitude || !member.longitude).length;
  const outreachCandidates = getOutreachCandidates(members, attendance, outreach, 7).length;

  return [
    { label: "Missing email", value: missingEmail, detail: "blocks direct engagement campaigns", tone: "red" as const },
    { label: "60-day renewals", value: upcoming, detail: "need proactive outreach", tone: "amber" as const },
    { label: "Missing coordinates", value: missingCoordinates, detail: "need map cleanup", tone: "amber" as const },
    { label: "Outreach candidates", value: outreachCandidates, detail: "records needing staff review", tone: "blue" as const },
  ];
}

export function getRenewalUrgency(member: Member) {
  const renewal = new Date(`${member.renewal_date}T12:00:00`);
  const days = Math.ceil((renewal.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Past Due";
  if (days <= 60) return "Due Soon";
  if (days <= 120) return "Upcoming";
  return "Scheduled";
}

export function getContactability(member: Member) {
  if (member.phone && member.email) return "Phone + Email";
  if (member.phone) return "Phone Listed";
  if (member.email) return "Email Listed";
  return "Needs Contact";
}

export function getRenewalsByMonth(members: Member[]) {
  return chartFromCounts(countBy(members, (member) => {
    const date = new Date(`${member.renewal_date}T12:00:00`);
    return date.toLocaleString("en-US", { month: "short" });
  }));
}

export function getDataQualityScore(members: Member[], attendanceCount: number, outreachCount: number) {
  const metrics = getDataCompletenessMetrics(members, attendanceCount, outreachCount);
  const contact = metrics.find((metric) => metric.label === "Contact phone coverage")?.value ?? 0;
  const website = metrics.find((metric) => metric.label === "Website coverage")?.value ?? 0;
  const map = metrics.find((metric) => metric.label === "Map readiness")?.value ?? 0;
  const industry = Math.round((members.filter((member) => member.industry).length / Math.max(members.length, 1)) * 100);
  const renewal = Math.round((members.filter((member) => !Number.isNaN(new Date(member.renewal_date).getTime())).length / Math.max(members.length, 1)) * 100);
  return Math.round(contact * 0.25 + website * 0.2 + map * 0.2 + industry * 0.2 + renewal * 0.15);
}

export function getUpcomingRenewals(members: Member[], days = 90) {
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return members
    .filter((member) => {
      const renewal = new Date(`${member.renewal_date}T12:00:00`);
      return renewal >= today && renewal <= limit;
    })
    .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));
}

export function getNewMembersByYear(members: Member[]) {
  return chartFromCounts(countBy(members, (member) => member.membership_start_date.slice(0, 4))).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

export function getReadiness(members: Member[], eventCount: number, attendanceCount: number, outreachCount: number) {
  const missing = members.reduce((sum, member) => sum + getMissingFields(member).length, 0);
  return [
    { label: "Member data", status: members.length ? "Available" : "Missing", detail: `${members.length} records loaded` },
    { label: "Event data", status: eventCount ? "Partial" : "Missing", detail: `${eventCount} event records` },
    { label: "Attendance data", status: attendanceCount ? "Partial" : "Missing", detail: `${attendanceCount} attendance records` },
    { label: "Outreach data", status: outreachCount ? "Partial" : "Missing", detail: `${outreachCount} outreach records` },
    { label: "Data cleanup", status: missing ? "Needs work" : "Strong", detail: `${missing} missing data items` },
  ];
}

export function generateInsights(members: Member[]) {
  const industries = chartFromCounts(countBy(members, (member) => member.industry));
  const cities = chartFromCounts(countBy(members, (member) => member.city));
  const upcoming = getUpcomingRenewals(members, 60);
  const incomplete = members.filter((member) => getMissingFields(member).length > 0);

  return [
    `${industries[0]?.name ?? "Unknown"} is the largest member category with ${industries[0]?.value ?? 0} members.`,
    `${cities[0]?.name ?? "Unknown"} has the highest concentration with ${cities[0]?.value ?? 0} member records.`,
    `${upcoming.length} members have renewals in the next 60 days.`,
    `${incomplete.length} records are missing at least one key field for engagement tracking.`,
  ];
}

export function filterMembers(members: Member[], query: string, industry: string, city: string, status: string) {
  const q = query.trim().toLowerCase();
  return members.filter((member) => {
    const matchesQuery = !q || [member.business_name, member.industry, member.city, member.phone, member.address]
      .join(" ")
      .toLowerCase()
      .includes(q);
    return (
      matchesQuery &&
      (!industry || member.industry === industry) &&
      (!city || member.city === city) &&
      (!status || member.membership_status === status)
    );
  });
}

export function getAttendanceSummary(members: Member[], attendance: Attendance[]) {
  const attendedIds = new Set(attendance.filter((item) => item.attended).map((item) => item.member_id));
  return {
    trackedAttendance: attendance.length,
    membersWithAttendance: attendedIds.size,
    membersWithZeroAttendance: members.length - attendedIds.size,
  };
}

export function membersWithoutOutreach(members: Member[], outreach: Outreach[]) {
  const contacted = new Set(outreach.map((item) => item.member_id));
  return members.filter((member) => !contacted.has(member.member_id));
}

export function getSourceCoverage(members: Member[]) {
  const pct = (count: number) => Math.round((count / Math.max(members.length, 1)) * 100);
  const synthetic = members.reduce((sum, member) => sum + (member.synthetic_fields?.length ?? 0), 0);
  return [
    { label: "Public directory records", value: pct(members.filter((member) => member.data_source === "public_directory").length), detail: `${members.length} live member listings loaded` },
    { label: "Website coverage", value: pct(members.filter((member) => member.website).length), detail: "From public directory map/listing data" },
    { label: "Coordinate coverage", value: pct(members.filter((member) => member.latitude && member.longitude).length), detail: "From public directory map data" },
    { label: "Synthetic field load", value: Math.min(100, Math.round(synthetic / Math.max(members.length * 5, 1) * 100)), detail: `${synthetic} placeholder fields awaiting official exports` },
  ];
}

export function mapIndustryToSector(industry: string) {
  const value = industry.toLowerCase();
  if (value.includes("health") || value.includes("wellness") || value.includes("family wellness") || value.includes("care")) return "Health care and social assistance";
  if (value.includes("real estate") || value.includes("mortgage")) return "Real estate and rental and leasing";
  if (value.includes("restaurant") || value.includes("food") || value.includes("brewery") || value.includes("catering") || value.includes("venue")) return "Accommodation and food services";
  if (value.includes("financial") || value.includes("bank") || value.includes("insurance") || value.includes("accounting") || value.includes("cpa")) return "Finance and insurance";
  if (value.includes("consult") || value.includes("marketing") || value.includes("advertising") || value.includes("architect") || value.includes("legal") || value.includes("technology") || value.includes("staffing") || value.includes("media") || value.includes("photography") || value.includes("videography")) return "Professional, scientific, and technical services";
  if (value.includes("home") || value.includes("plumbing") || value.includes("landscaping") || value.includes("construction") || value.includes("inspection") || value.includes("pest")) return "Construction";
  if (value.includes("shopping") || value.includes("hardware") || value.includes("jewelry") || value.includes("automotive") || value.includes("car wash")) return "Retail trade";
  if (value.includes("manufacturing") || value.includes("trailer")) return "Manufacturing";
  if (value.includes("transport") || value.includes("travel") || value.includes("moving") || value.includes("storage")) return "Transportation and warehousing";
  if (value.includes("education") || value.includes("college") || value.includes("tutor")) return "Educational services";
  if (value.includes("non-profit") || value.includes("community")) return "Other services";
  return "Other services";
}

export function getChamberSectorBenchmarks(members: Member[]) {
  const chamber = chartFromCounts(countBy(members, (member) => mapIndustryToSector(member.industry)));
  return chamber.map((item) => {
    const county = countyBusinessPatterns.sectors.find((sector) => sector.label === item.name);
    const chamberShare = Math.round((item.value / Math.max(members.length, 1)) * 1000) / 10;
    const countyShare = county ? Math.round((county.establishments / countyBusinessPatterns.total.establishments) * 1000) / 10 : 0;
    return {
      name: item.name,
      chamberMembers: item.value,
      chamberShare,
      countyEstablishments: county?.establishments ?? 0,
      countyShare,
      representationGap: Math.round((chamberShare - countyShare) * 10) / 10,
    };
  }).sort((a, b) => b.chamberMembers - a.chamberMembers);
}

export function getRealBusinessInsights(members: Member[]) {
  const sectors = getChamberSectorBenchmarks(members);
  const top = sectors[0];
  const under = sectors.filter((sector) => sector.countyShare > 0).sort((a, b) => a.representationGap - b.representationGap)[0];
  const over = sectors.filter((sector) => sector.countyShare > 0).sort((a, b) => b.representationGap - a.representationGap)[0];
  const missingWebsite = members.filter((member) => !member.website).length;
  const mapped = members.filter((member) => member.latitude && member.longitude).length;

  return [
    `${top?.name ?? "Unknown"} is the largest Chamber sector mapping with ${top?.chamberMembers ?? 0} public member listings.`,
    under ? `${under.name} appears underrepresented against Morris County employer patterns by ${Math.abs(under.representationGap)} percentage points.` : "County benchmark coverage is limited for some Chamber categories.",
    over ? `${over.name} is more concentrated in Chamber membership than in Morris County employer establishments by ${over.representationGap} percentage points.` : "No overrepresentation signal is available.",
    `${mapped} of ${members.length} public listings include coordinates; ${missingWebsite} listings are missing a website in the public directory.`,
  ];
}
