import { describe, expect, it } from "vitest";
import { members } from "../data";
import {
  canEditBusiness,
  canManageAccess,
  canViewBusiness,
} from "./authorization";
import { buildBusinessIntelligence, createBusinessProfile } from "./engine";
import { classifyMember } from "./naics";
import {
  coefficientOfVariation,
  derivePercentage,
  gradeConfidence,
  locationQuotient,
  percentileRank,
} from "./statistics";

describe("business intelligence foundation", () => {
  it("creates one profile without inventing unavailable operational fields", () => {
    const profile = createBusinessProfile(members[0]);
    expect(profile.businessId).toBe(members[0].member_id);
    expect(profile.employeeRange).toBe("unknown");
    expect(profile.yearFounded).toBeNull();
    expect(profile.lastVerifiedAt).toBeNull();
  });

  it("suggests traceable NAICS classifications and queues weak matches", () => {
    const strong = classifyMember(
      members.find((member) => member.industry === "Legal Services")!,
    );
    const weak = classifyMember(
      members.find((member) => member.industry === "Uncategorized")!,
    );
    expect(strong.code).toBe("541110");
    expect(strong.evidence[0]).toContain("Chamber category");
    expect(weak.verificationStatus).toBe("needs_review");
  });

  it("generates evidence-backed recommendations without unsupported values", () => {
    const member = members.find(
      (item) => item.industry === "Home Improvement",
    )!;
    const record = buildBusinessIntelligence(member, [
      "Understand local competition",
    ]);
    expect(record.recommendations.length).toBeGreaterThan(0);
    expect(
      record.recommendations.every((item) => item.engineVersion === "1.0.0"),
    ).toBe(true);
    expect(
      record.insights.some((item) => item.sourceLabel.includes("Census")),
    ).toBe(true);
  });
});

describe("statistical helpers", () => {
  it("derives bounded percentages and uncertainty", () => {
    const result = derivePercentage(3853, 348, 11197, 353);
    expect(result.estimate).toBeCloseTo(34.4, 1);
    expect(result.marginOfError).toBeGreaterThan(0);
    expect(
      coefficientOfVariation(result.estimate, result.marginOfError),
    ).toBeLessThan(10);
  });

  it("grades reliability and calculates interpretable benchmarks", () => {
    expect(gradeConfidence(100, 5)).toBe("High confidence");
    expect(locationQuotient(20, 100, 10, 100)).toBe(2);
    expect(percentileRank(3, [1, 2, 3, 4, 5])).toBe(50);
  });
});

describe("authorization helpers", () => {
  const memberContext = {
    userId: "u1",
    role: "business_member" as const,
    businessId: "MOC-001",
  };
  it("isolates member access to the assigned business", () => {
    expect(canViewBusiness(memberContext, "MOC-001")).toBe(true);
    expect(canEditBusiness(memberContext, "MOC-002")).toBe(false);
    expect(canManageAccess(memberContext)).toBe(false);
  });
  it("allows administrators to manage access while analysts remain read-only", () => {
    expect(canManageAccess({ userId: "admin", role: "chamber_admin" })).toBe(
      true,
    );
    expect(
      canEditBusiness({ userId: "analyst", role: "analyst" }, "MOC-001"),
    ).toBe(false);
  });
});
