import { describe, expect, it } from "vitest";
import type { Member } from "../types";
import { getContactability, getDataCompletenessScore, getDataQualityScore, getOutreachCandidates, getRenewalUrgency } from "./analytics";

const baseMember: Member = {
  member_id: "T-001",
  business_name: "Test Business",
  contact_name: "",
  industry: "Business Services",
  address: "1 Main St",
  city: "Budd Lake",
  state: "NJ",
  zip_code: "07828",
  email: "",
  phone: "(973) 555-0100",
  website: "https://example.com",
  membership_start_date: "2020-01-01",
  renewal_date: "2026-08-01",
  membership_status: "active",
  notes: "Test record",
  latitude: 40.87,
  longitude: -74.73,
  data_source: "public_directory",
  synthetic_fields: ["email"],
};

describe("analytics helpers", () => {
  it("classifies renewal urgency from the current analysis date", () => {
    expect(getRenewalUrgency(baseMember)).toBe("Due Soon");
    expect(getRenewalUrgency({ ...baseMember, renewal_date: "2026-12-15" })).toBe("Scheduled");
  });

  it("reports practical contactability labels", () => {
    expect(getContactability(baseMember)).toBe("Phone Listed");
    expect(getContactability({ ...baseMember, phone: "", email: "" })).toBe("Needs Contact");
    expect(getContactability({ ...baseMember, email: "staff@example.com" })).toBe("Phone + Email");
  });

  it("computes profile completeness from available record fields", () => {
    expect(getDataCompletenessScore(baseMember)).toBeGreaterThan(70);
    expect(getDataCompletenessScore({ ...baseMember, phone: "", website: "", latitude: null, longitude: null })).toBeLessThan(70);
  });

  it("ranks outreach candidates with transparent factors", () => {
    const candidates = getOutreachCandidates([baseMember], [], [], 1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].reasons).toContain("Renewal Follow-Up");
    expect(candidates[0].reasons).toContain("Staff Verification");
  });

  it("keeps data quality score in a bounded percentage range", () => {
    const score = getDataQualityScore([baseMember], 0, 0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
