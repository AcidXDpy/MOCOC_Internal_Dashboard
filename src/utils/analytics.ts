import type { Attendance, Member, Outreach } from "../types";

export const today = new Date("2026-06-25T12:00:00");
export const lastUpdatedLabel = "June 25, 2026";

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
  if (member.membership_status === "at-risk" || member.membership_status === "inactive") return "At Risk";
  if (score < 55) return "Needs Data";
  if (!member.email || !member.website) return "Engagement Unknown";
  return "Healthy";
}

export function getRecommendedAction(member: Member) {
  const missing = getMissingFields(member);
  if (member.membership_status === "at-risk" || member.membership_status === "inactive") return "Prioritize outreach before renewal conversation.";
  if (missing.includes("email")) return "Collect a direct email contact for campaign and renewal tracking.";
  if (missing.includes("coordinates")) return "Verify address and geocode for territory analysis.";
  if (missing.includes("website")) return "Add website to improve public-facing referral readiness.";
  return "Keep record current and invite to the next engagement touchpoint.";
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

export function getPilotCandidates(members: Member[], attendance: Attendance[], outreach: Outreach[], limit = 7) {
  const attended = new Set(attendance.filter((item) => item.attended).map((item) => item.member_id));
  const contacted = new Set(outreach.map((item) => item.member_id));
  const upcoming = new Set(getUpcomingRenewals(members, 120).map((member) => member.member_id));

  return members
    .map((member) => {
      const missing = getMissingFields(member);
      const reasons = [
        member.membership_status === "at-risk" ? "at-risk status" : "",
        member.membership_status === "inactive" ? "inactive status" : "",
        upcoming.has(member.member_id) ? "renewal approaching" : "",
        !attended.has(member.member_id) ? "no attendance history" : "",
        !contacted.has(member.member_id) ? "no outreach logged" : "",
        missing.length >= 3 ? "incomplete record" : "",
      ].filter(Boolean);
      const score = reasons.length * 10 + missing.length * 2 + (upcoming.has(member.member_id) ? 8 : 0);
      return { member, reasons, score };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.member.business_name.localeCompare(b.member.business_name))
    .slice(0, limit);
}

export function getPriorityAlerts(members: Member[], attendance: Attendance[], outreach: Outreach[]) {
  const missingEmail = members.filter((member) => !member.email).length;
  const upcoming = getUpcomingRenewals(members, 60).length;
  const missingCoordinates = members.filter((member) => !member.latitude || !member.longitude).length;
  const pilotCandidates = getPilotCandidates(members, attendance, outreach, 7).length;

  return [
    { label: "Missing email", value: missingEmail, detail: "blocks direct engagement campaigns", tone: "red" as const },
    { label: "60-day renewals", value: upcoming, detail: "need proactive outreach", tone: "amber" as const },
    { label: "Missing coordinates", value: missingCoordinates, detail: "need map cleanup", tone: "amber" as const },
    { label: "Pilot candidates", value: pilotCandidates, detail: "ready for Phase 2 review", tone: "blue" as const },
  ];
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
