import {
  acsEvidence,
  countyBusinessPatterns,
  ECONOMIC_DATA_RETRIEVED_AT,
  members,
  zipBusinessPatterns,
} from "../data";
import type { Member } from "../types";
import {
  classifyMember,
  getClassificationDefaults,
  naicsSector,
} from "./naics";
import {
  clampScore,
  confidenceRank,
  locationQuotient,
  practicalDifference,
} from "./statistics";
import type {
  BusinessGoal,
  BusinessInsight,
  BusinessIntelligenceRecord,
  BusinessProfile,
  BusinessRecommendation,
  ConfidenceGrade,
  EvidenceMetric,
  RecommendationEffort,
  ZipIndustryMetric,
} from "./types";

export const RECOMMENDATION_ENGINE_VERSION = "1.0.0";
const GENERATED_AT = "2026-07-17T12:00:00-04:00";

const b2bCategories = new Set([
  "Accounting and Bookkeeping Services",
  "Advertising",
  "Architect",
  "Business Service - Staffing",
  "Business Services",
  "Business Services - Consulting",
  "Business Services - Promotional Goods",
  "Business Services - Technology",
  "Consultant",
  "CPAs and Advisors",
  "Environmental Services",
  "Legal Services",
  "Manufacturing",
  "Marketing",
  "Social Media Marketing",
  "Waste Management",
]);
const familyRelevantCategories = new Set([
  "Education",
  "Family Wellness",
  "Health & Wellness",
  "Health Care Services",
  "Jeweler",
  "Photography",
  "Restaurant",
  "Shopping",
  "Travel",
]);
const homeRelevantCategories = new Set([
  "Home Improvement",
  "Home Inspection Service",
  "Landscaping Service",
  "Pest Control",
  "Real Estate",
  "Mortgages",
  "Insurance",
  "Moving and Storage",
]);
const premiumTestCategories = new Set([
  "Architect",
  "Financial Services",
  "Health & Wellness",
  "Home Improvement",
  "Insurance",
  "Jeweler",
  "Legal Services",
  "Photography",
  "Real Estate",
  "Travel",
]);

const complementMap: Record<string, string[]> = {
  "Home Improvement": [
    "Real Estate",
    "Mortgages",
    "Home Inspection Service",
    "Insurance",
    "Landscaping Service",
    "Pest Control",
  ],
  "Home Inspection Service": [
    "Real Estate",
    "Mortgages",
    "Home Improvement",
    "Insurance",
  ],
  "Real Estate": [
    "Mortgages",
    "Home Inspection Service",
    "Home Improvement",
    "Insurance",
    "Moving and Storage",
    "Photography",
  ],
  Mortgages: [
    "Real Estate",
    "Insurance",
    "CPAs and Advisors",
    "Legal Services",
  ],
  Restaurant: [
    "Party & Equipment Rental",
    "Photography",
    "Marketing",
    "Social Media Marketing",
    "Radio Station",
  ],
  "Food and Beverage Venue": [
    "Party & Equipment Rental",
    "Photography",
    "Marketing",
    "Social Media Marketing",
  ],
  "Health Care Services": [
    "Family Wellness",
    "Health & Wellness",
    "Insurance",
    "Transportation",
  ],
  "Health & Wellness": [
    "Family Wellness",
    "Health Care Services",
    "Insurance",
    "Personal Services",
  ],
  "Family Wellness": [
    "Health Care Services",
    "Health & Wellness",
    "Education",
    "Insurance",
  ],
  "Legal Services": [
    "Accounting and Bookkeeping Services",
    "CPAs and Advisors",
    "Banking",
    "Insurance",
    "Real Estate",
  ],
  "Accounting and Bookkeeping Services": [
    "Legal Services",
    "Banking",
    "Insurance",
    "Business Services - Consulting",
  ],
  Marketing: [
    "Business Services",
    "Photography",
    "Videography",
    "Radio Station",
    "Newspaper",
  ],
  "Social Media Marketing": [
    "Business Services",
    "Photography",
    "Videography",
    "Radio Station",
    "Newspaper",
  ],
};

function suggestedGoals(member: Member): BusinessGoal[] {
  const result: BusinessGoal[] = [];
  if (b2bCategories.has(member.industry))
    result.push("Expand B2B partnerships", "Find referral partners");
  else
    result.push("Acquire more local customers", "Improve customer retention");
  if (!member.website) result.push("Improve digital visibility");
  if (familyRelevantCategories.has(member.industry))
    result.push("Increase weekend traffic");
  if (complementMap[member.industry]) result.push("Find referral partners");
  return [...new Set(result)].slice(0, 3);
}

export function createBusinessProfile(
  member: Member,
  selectedGoals: BusinessGoal[] = [],
): BusinessProfile {
  const classification = classifyMember(member);
  const defaults = getClassificationDefaults(member);
  const inferred = [
    "Audience and operating model are deterministic suggestions based on the Chamber category.",
    "NAICS is a suggestion and does not replace administrator or business verification.",
  ];
  return {
    businessId: member.member_id,
    displayName: member.business_name,
    description: member.notes,
    address: member.address,
    municipality: member.city,
    state: member.state,
    zipCode: member.zip_code,
    latitude: member.latitude,
    longitude: member.longitude,
    chamberCategory: member.industry,
    industryGroup: defaults.industryGroup,
    primaryNaics: classification,
    secondaryNaics: [],
    audience: defaults.audience,
    operatingModel: defaults.operatingModel,
    employeeRange: "unknown",
    numberOfLocations: null,
    yearFounded: null,
    website: member.website,
    serviceRadiusMiles: null,
    productsAndServices: member.notes ? [member.notes] : [],
    priceTier: "unknown",
    targetSegments: [],
    desiredSegments: [],
    selectedGoals,
    suggestedGoals: suggestedGoals(member),
    growthChallenges: [],
    operatingHours: "",
    languages: [],
    profileCompleteness: getIntelligenceProfileCompleteness(
      member,
      selectedGoals,
    ),
    sourceMember: member,
    lastVerifiedAt: null,
    generatedAt: GENERATED_AT,
    inferenceNotes: inferred,
  };
}

export function getIntelligenceProfileCompleteness(
  member: Member,
  goals: BusinessGoal[] = [],
) {
  const fields = [
    member.business_name,
    member.notes,
    member.address,
    member.city,
    member.state,
    member.zip_code,
    member.latitude,
    member.longitude,
    member.industry,
    member.website,
    member.phone,
  ];
  const available = fields.filter(
    (value) => value !== "" && value !== null && value !== undefined,
  ).length;
  const publicCoverage = (available / fields.length) * 70;
  const enrichmentCoverage = goals.length ? 10 : 0;
  const verifiedCoverage = 0;
  return clampScore(publicCoverage + enrichmentCoverage + verifiedCoverage);
}

function directoryEvidence(
  profile: BusinessProfile,
  complementaryCount: number,
): EvidenceMetric[] {
  const baseProvenance = {
    sourceOrganization: "Mount Olive Area Chamber of Commerce public directory",
    dataset: "Public member directory snapshot",
    datasetYear: 2026,
    geography: "Chamber service area",
    geographyId: "MOCOC",
    retrievedAt: ECONOMIC_DATA_RETRIEVED_AT,
    queryUrl: profile.sourceMember.source_url ?? "",
    direct: false,
    qualityFlags: profile.sourceMember.synthetic_fields ?? [],
  };
  return [
    {
      id: "directory.profile_completeness",
      label: "Intelligence profile completeness",
      description:
        "Coverage of public directory fields plus business-supplied goals; human verification is not yet recorded.",
      estimate: profile.profileCompleteness,
      formatted: `${profile.profileCompleteness}%`,
      unit: "percent",
      marginOfError: null,
      coefficientOfVariation: null,
      confidence: "High confidence",
      provenance: {
        ...baseProvenance,
        table: "member_profile",
        variables: ["public fields", "selected goals"],
        transformation: "Weighted field coverage",
      },
    },
    {
      id: "directory.complementary_members",
      label: "Complementary member categories",
      description:
        "Public Chamber listings in deterministic complementary categories; this does not imply an existing relationship.",
      estimate: complementaryCount,
      formatted: String(complementaryCount),
      unit: "count",
      marginOfError: null,
      coefficientOfVariation: null,
      confidence: "High confidence",
      provenance: {
        ...baseProvenance,
        queryUrl: "https://mountolivechambernj.com/",
        table: "member_directory",
        variables: ["business category"],
        transformation: "Count of crosswalk-compatible member categories",
      },
    },
  ];
}

function complementaryMembers(member: Member) {
  const categories =
    complementMap[member.industry] ??
    (b2bCategories.has(member.industry)
      ? ["Banking", "Insurance", "Legal Services", "CPAs and Advisors"]
      : [
          "Marketing",
          "Social Media Marketing",
          "Photography",
          "Radio Station",
        ]);
  return members.filter(
    (candidate) =>
      candidate.member_id !== member.member_id &&
      categories.includes(candidate.industry),
  );
}

function zipMetric(profile: BusinessProfile): ZipIndustryMetric | null {
  const sector = naicsSector(profile.primaryNaics.code);
  return (
    zipBusinessPatterns.find(
      (metric) =>
        metric.zipCode === profile.zipCode && metric.sectorCode === sector,
    ) ?? null
  );
}

function metricById(evidence: EvidenceMetric[], id: string) {
  return evidence.find((metric) => metric.id === id);
}

function createInsights(
  profile: BusinessProfile,
  evidence: EvidenceMetric[],
  zipIndustry: ZipIndustryMetric | null,
  complementaryCount: number,
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const income = metricById(evidence, "acs.median_household_income")!;
  insights.push({
    id: `${profile.businessId}.income_context`,
    businessId: profile.businessId,
    type: "household-income divergence",
    statement: `Mount Olive's median household income is ${income.formatted}, compared with ${income.comparisonFormatted} across Morris County.`,
    relevance: premiumTestCategories.has(profile.chamberCategory)
      ? "Use the difference to test tiered offers and messaging; it does not establish willingness to pay."
      : "This is useful context for offer design, but it is not direct consumer-spending data.",
    evidenceIds: [income.id],
    comparisonGeography: "Morris County, NJ",
    confidence: income.confidence,
    caveat:
      "Household income is an area estimate and does not describe an individual customer or guarantee demand.",
    sourceLabel: "U.S. Census Bureau ACS 2024 5-year",
    datasetYear: 2024,
  });

  const children = metricById(evidence, "acs.households_with_children")!;
  if (
    familyRelevantCategories.has(profile.chamberCategory) &&
    practicalDifference(children, 3)
  ) {
    insights.push({
      id: `${profile.businessId}.family_households`,
      businessId: profile.businessId,
      type: "above-benchmark customer concentration",
      statement: `${children.formatted} of Mount Olive households include someone under 18, versus ${children.comparisonFormatted} countywide.`,
      relevance:
        "The measured local difference is relevant to a family-facing offer and is large enough to warrant a small market test.",
      evidenceIds: [children.id],
      comparisonGeography: "Morris County, NJ",
      confidence: children.confidence,
      caveat:
        "Household composition does not indicate purchase intent; validate through a limited campaign.",
      sourceLabel: "U.S. Census Bureau ACS 2024 5-year",
      datasetYear: 2024,
    });
  }

  const ownership = metricById(evidence, "acs.owner_occupied")!;
  if (
    homeRelevantCategories.has(profile.chamberCategory) &&
    practicalDifference(ownership, 5)
  ) {
    insights.push({
      id: `${profile.businessId}.housing_tenure`,
      businessId: profile.businessId,
      type: "housing-market composition",
      statement: `${ownership.formatted} of occupied homes in Mount Olive are owner occupied, compared with ${ownership.comparisonFormatted} across Morris County.`,
      relevance:
        "A home-related business should avoid assuming the county's ownership mix applies locally and may benefit from separate homeowner and renter messaging.",
      evidenceIds: [ownership.id],
      comparisonGeography: "Morris County, NJ",
      confidence: ownership.confidence,
      caveat:
        "Housing tenure is not a measure of current demand for a particular home service.",
      sourceLabel: "U.S. Census Bureau ACS 2024 5-year",
      datasetYear: 2024,
    });
  }

  if (zipIndustry) {
    const countySector = countyBusinessPatterns.sectors.find(
      (sector) => sector.code.split("-")[0] === zipIndustry.sectorCode,
    );
    const lq = countySector
      ? locationQuotient(
          zipIndustry.establishments,
          zipIndustry.totalEstablishments,
          countySector.establishments,
          countyBusinessPatterns.total.establishments,
        )
      : null;
    insights.push({
      id: `${profile.businessId}.zip_industry`,
      businessId: profile.businessId,
      type: "industry-concentration signal",
      statement: `${zipIndustry.zipName} has ${zipIndustry.establishments} employer establishments in ${zipIndustry.sectorLabel.toLowerCase()} (${zipIndustry.establishmentsPerTenThousand} per 10,000 residents).`,
      relevance:
        lq && lq >= 1.2
          ? `The ZIP's sector share is ${lq.toFixed(2)} times the county share, a signal to examine differentiation.`
          : "Use this as a market-structure baseline when reviewing direct competitors and partners.",
      evidenceIds: [],
      comparisonGeography: "Morris County, NJ",
      confidence: "High confidence",
      caveat:
        "ZIP Business Patterns counts employer establishments, not brands or direct competitors; nonemployers are excluded.",
      sourceLabel: "U.S. Census Bureau ZIP Business Patterns 2023",
      datasetYear: 2023,
    });
  }

  if (complementaryCount >= 3) {
    insights.push({
      id: `${profile.businessId}.network`,
      businessId: profile.businessId,
      type: "Chamber-network opportunity",
      statement: `${complementaryCount} public Chamber listings fall in complementary categories defined by the referral crosswalk.`,
      relevance:
        "The Chamber can use this list to facilitate introductions around shared customer needs.",
      evidenceIds: ["directory.complementary_members"],
      comparisonGeography: "Chamber network",
      confidence: "High confidence",
      caveat:
        "Category compatibility does not imply an existing relationship, mutual fit, availability, or endorsement.",
      sourceLabel: "Mount Olive Area Chamber public directory",
      datasetYear: 2026,
    });
  }
  return insights;
}

function recommendationScore(
  goal: BusinessGoal | "Profile readiness",
  selected: BusinessGoal[],
  suggested: BusinessGoal[],
  confidence: ConfidenceGrade,
  effort: RecommendationEffort,
  signalPoints = 12,
) {
  const goalPoints =
    goal !== "Profile readiness" && selected.includes(goal)
      ? 25
      : goal !== "Profile readiness" && suggested.includes(goal)
        ? 12
        : goal === "Profile readiness"
          ? 15
          : 4;
  const confidencePoints = {
    "High confidence": 22,
    "Moderate confidence": 16,
    Directional: 9,
    "Insufficient data": 0,
  }[confidence];
  const effortPoints = { Low: 15, Moderate: 10, High: 4 }[effort];
  const scoreFactors = [
    { label: "Goal alignment", points: goalPoints },
    { label: "Evidence quality", points: confidencePoints },
    { label: "Feasibility", points: effortPoints },
    { label: "Measured relevance", points: signalPoints },
    { label: "Data freshness", points: 10 },
  ];
  return {
    score: clampScore(
      scoreFactors.reduce((sum, factor) => sum + factor.points, 0),
    ),
    scoreFactors,
  };
}

function recommendation(
  input: Omit<
    BusinessRecommendation,
    | "score"
    | "scoreFactors"
    | "status"
    | "engineVersion"
    | "generatedAt"
    | "validFrom"
    | "reviewAfter"
  >,
  profile: BusinessProfile,
  signalPoints?: number,
): BusinessRecommendation {
  const ranking = recommendationScore(
    input.goalInfluence,
    profile.selectedGoals,
    profile.suggestedGoals,
    input.confidence,
    input.effort,
    signalPoints,
  );
  return {
    ...input,
    ...ranking,
    status: "new",
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    generatedAt: GENERATED_AT,
    validFrom: "2026-07-17",
    reviewAfter: "2027-01-17",
  };
}

function createRecommendations(
  profile: BusinessProfile,
  evidence: EvidenceMetric[],
  insights: BusinessInsight[],
  complementaryCount: number,
  zipIndustry: ZipIndustryMetric | null,
): BusinessRecommendation[] {
  const items: BusinessRecommendation[] = [];
  const profileMetric = metricById(evidence, "directory.profile_completeness")!;
  if (profile.profileCompleteness < 80) {
    items.push(
      recommendation(
        {
          id: `${profile.businessId}.complete_profile`,
          businessId: profile.businessId,
          category: "Profile readiness",
          title: "Complete the business intelligence profile",
          summary:
            "Verify the suggested NAICS code and add goals, customer segments, employee range, service area, and operating details before relying on highly personalized guidance.",
          rationale: `The intelligence profile is ${profileMetric.formatted} complete and the NAICS classification is ${profile.primaryNaics.verificationStatus.replace("_", " ")}.`,
          actionSteps: [
            "Review the suggested NAICS classification",
            "Select two or three current business goals",
            "Add target customers, employee range, service area, and operating hours",
          ],
          evidence: [
            {
              metricId: profileMetric.id,
              explanation:
                "Profile coverage controls how specific the recommendation engine can responsibly be.",
            },
          ],
          goalInfluence: "Profile readiness",
          impact: "Strategic",
          effort: "Low",
          confidence: "High confidence",
          timeHorizon: "This month",
          limitation:
            "Profile completeness measures field coverage, not business quality or performance.",
        },
        profile,
        18,
      ),
    );
  }

  if (!profile.website) {
    items.push(
      recommendation(
        {
          id: `${profile.businessId}.digital_visibility`,
          businessId: profile.businessId,
          category: "Digital visibility",
          title: "Add a verified website destination to the Chamber profile",
          summary:
            "The public Chamber listing does not currently expose a website, which limits a visitor's path from discovery to action.",
          rationale:
            "This recommendation is triggered by a directly observed missing public-directory field, not by an estimate.",
          actionSteps: [
            "Confirm the preferred website or booking page",
            "Ask Chamber staff to update the public listing",
            "Add a measurable contact or booking action on the destination page",
          ],
          evidence: [
            {
              metricId: profileMetric.id,
              explanation:
                "The website field is missing from the current public directory snapshot.",
            },
          ],
          goalInfluence: "Improve digital visibility",
          impact: "Meaningful",
          effort: "Low",
          confidence: "High confidence",
          timeHorizon: "Within 30 days",
          limitation:
            "A listed website improves discoverability but does not guarantee visits or conversions.",
        },
        profile,
        20,
      ),
    );
  }

  const familyInsight = insights.find(
    (insight) => insight.type === "above-benchmark customer concentration",
  );
  const childMetric = metricById(evidence, "acs.households_with_children")!;
  if (familyInsight) {
    items.push(
      recommendation(
        {
          id: `${profile.businessId}.family_test`,
          businessId: profile.businessId,
          category: "Customer-segment targeting",
          title: "Run a limited family-focused offer test",
          summary:
            "Test one family-relevant bundle, message, or weekend activation before committing to a broader campaign.",
          rationale: `${childMetric.formatted} of Mount Olive households include someone under 18, compared with ${childMetric.comparisonFormatted} countywide.`,
          actionSteps: [
            "Choose one offer connected to a real family use case",
            "Run it for two to four weeks with a trackable response method",
            "Compare response with the normal offer before expanding",
          ],
          evidence: [
            {
              metricId: childMetric.id,
              explanation:
                "The local household share is meaningfully above the county benchmark for this family-relevant category.",
            },
          ],
          goalInfluence: "Acquire more local customers",
          impact: "Meaningful",
          effort: "Moderate",
          confidence: childMetric.confidence,
          timeHorizon: "Next 90 days",
          limitation:
            "Aggregate household composition does not establish purchase intent; results from the test should drive the final decision.",
        },
        profile,
        17,
      ),
    );
  }

  if (complementaryCount >= 3) {
    const networkMetric = metricById(
      evidence,
      "directory.complementary_members",
    )!;
    items.push(
      recommendation(
        {
          id: `${profile.businessId}.referral_partners`,
          businessId: profile.businessId,
          category: "B2B referrals",
          title: "Request three category-matched Chamber introductions",
          summary:
            "Use the Chamber network to test referral fit with complementary businesses rather than cold outreach across unrelated categories.",
          rationale: `${networkMetric.formatted} public member listings match the deterministic complementary-category crosswalk.`,
          actionSteps: [
            "Review the suggested complementary categories",
            "Ask Chamber staff for up to three opt-in introductions",
            "Define a simple reciprocal referral use case and review it after 60 days",
          ],
          evidence: [
            {
              metricId: networkMetric.id,
              explanation:
                "The count comes from current public Chamber categories; it does not imply an existing partnership.",
            },
          ],
          goalInfluence: "Find referral partners",
          impact: "Meaningful",
          effort: "Low",
          confidence: "High confidence",
          timeHorizon: "Next Chamber cycle",
          limitation:
            "Introductions require consent and category compatibility does not guarantee strategic fit.",
        },
        profile,
        16,
      ),
    );
  }

  const housingInsight = insights.find(
    (insight) => insight.type === "housing-market composition",
  );
  const ownership = metricById(evidence, "acs.owner_occupied")!;
  if (housingInsight) {
    items.push(
      recommendation(
        {
          id: `${profile.businessId}.tenure_messages`,
          businessId: profile.businessId,
          category: "Customer-segment targeting",
          title: "Separate homeowner and renter use cases",
          summary:
            "Review whether current messaging assumes homeownership and test a renter-appropriate service path where the offering permits it.",
          rationale: `${ownership.formatted} of occupied Mount Olive homes are owner occupied versus ${ownership.comparisonFormatted} countywide.`,
          actionSteps: [
            "Audit current examples and calls to action for ownership assumptions",
            "Identify one renter-relevant and one homeowner-relevant use case",
            "Track inquiries by use case without collecting sensitive resident data",
          ],
          evidence: [
            {
              metricId: ownership.id,
              explanation:
                "The local housing-tenure mix differs materially from the county benchmark.",
            },
          ],
          goalInfluence: "Acquire more local customers",
          impact: "Focused",
          effort: "Low",
          confidence: ownership.confidence,
          timeHorizon: "Next 60 days",
          limitation:
            "Housing tenure is an aggregate context signal, not a list of customers or a measure of service demand.",
        },
        profile,
        14,
      ),
    );
  }

  if (zipIndustry) {
    const countySector = countyBusinessPatterns.sectors.find(
      (sector) => sector.code.split("-")[0] === zipIndustry.sectorCode,
    );
    const lq = countySector
      ? locationQuotient(
          zipIndustry.establishments,
          zipIndustry.totalEstablishments,
          countySector.establishments,
          countyBusinessPatterns.total.establishments,
        )
      : null;
    if (lq && lq >= 1.2) {
      items.push(
        recommendation(
          {
            id: `${profile.businessId}.differentiate`,
            businessId: profile.businessId,
            category: "Market monitoring",
            title: "Validate a sharper differentiation position",
            summary:
              "The local ZIP has an above-county share of employer establishments in this broad sector; review direct competitors before expanding broad-reach promotion.",
            rationale: `${zipIndustry.establishments} ${zipIndustry.sectorLabel.toLowerCase()} employer establishments are recorded in ${zipIndustry.zipCode}; the broad-sector location quotient is ${lq.toFixed(2)}.`,
            actionSteps: [
              "Identify the five most relevant direct alternatives",
              "Compare offer, audience, proof, and response time",
              "Choose one defensible differentiator to test in messaging",
            ],
            evidence: [],
            goalInfluence: "Understand local competition",
            impact: "Strategic",
            effort: "Moderate",
            confidence: "Moderate confidence",
            timeHorizon: "Next quarter",
            limitation:
              "ZIP Business Patterns excludes nonemployers and broad NAICS sectors include businesses that may not compete directly.",
          },
          profile,
          16,
        ),
      );
    }
  }

  return items
    .filter((item) => confidenceRank(item.confidence) >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildBusinessIntelligence(
  member: Member,
  selectedGoals: BusinessGoal[] = [],
): BusinessIntelligenceRecord {
  const profile = createBusinessProfile(member, selectedGoals);
  const complements = complementaryMembers(member);
  const evidence = [
    ...acsEvidence,
    ...directoryEvidence(profile, complements.length),
  ];
  const localZipMetric = zipMetric(profile);
  const insights = createInsights(
    profile,
    evidence,
    localZipMetric,
    complements.length,
  );
  const recommendations = createRecommendations(
    profile,
    evidence,
    insights,
    complements.length,
    localZipMetric,
  );
  const weakestEvidence = evidence
    .filter((metric) => metric.id.startsWith("acs."))
    .reduce<ConfidenceGrade>(
      (lowest, metric) =>
        confidenceRank(metric.confidence) < confidenceRank(lowest)
          ? metric.confidence
          : lowest,
      "High confidence",
    );
  return {
    profile,
    evidence,
    insights,
    recommendations,
    complementaryMembers: complements,
    zipIndustryMetric: localZipMetric,
    dataConfidence: weakestEvidence,
  };
}

export function buildAllBusinessIntelligence() {
  return members.map((member) => buildBusinessIntelligence(member));
}

export function getAdminIntelligenceSummary(
  records = buildAllBusinessIntelligence(),
) {
  return {
    profilesCreated: records.length,
    geocoded: records.filter(
      (record) => record.profile.latitude && record.profile.longitude,
    ).length,
    verifiedNaics: records.filter(
      (record) => record.profile.primaryNaics.verificationStatus === "verified",
    ).length,
    classificationsNeedingReview: records.filter(
      (record) =>
        record.profile.primaryNaics.verificationStatus === "needs_review",
    ).length,
    currentInsights: records.filter((record) => record.insights.length > 0)
      .length,
    weakProfiles: records.filter(
      (record) => record.profile.profileCompleteness < 60,
    ).length,
    recommendations: records.reduce(
      (sum, record) => sum + record.recommendations.length,
      0,
    ),
  };
}
