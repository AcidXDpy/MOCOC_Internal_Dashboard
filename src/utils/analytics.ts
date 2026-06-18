import type { Attendance, Member, Outreach } from "../types";

export const today = new Date("2026-06-18T12:00:00");

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
