import type { Member } from "../types";

export type UserRole = "chamber_admin" | "business_member" | "analyst";
export type BusinessAudience =
  "b2b" | "b2c" | "hybrid" | "nonprofit" | "government";
export type OperatingModel =
  "physical" | "service_area" | "online" | "hybrid" | "unknown";
export type EmployeeRange =
  "1" | "2-4" | "5-9" | "10-19" | "20-49" | "50+" | "unknown";
export type PriceTier =
  "value" | "mid_market" | "premium" | "varied" | "unknown";
export type ConfidenceGrade =
  | "High confidence"
  | "Moderate confidence"
  | "Directional"
  | "Insufficient data";
export type RecommendationStatus =
  | "new"
  | "useful"
  | "not_relevant"
  | "already_doing"
  | "completed"
  | "revisit_later"
  | "dismissed";
export type RecommendationEffort = "Low" | "Moderate" | "High";
export type RecommendationImpact = "Focused" | "Meaningful" | "Strategic";
export type BusinessGoal =
  | "Acquire more local customers"
  | "Reach higher-income households"
  | "Reach younger customers"
  | "Reach older customers"
  | "Expand B2B partnerships"
  | "Improve customer retention"
  | "Increase weekday traffic"
  | "Increase weekend traffic"
  | "Hire employees"
  | "Open another location"
  | "Introduce a new service"
  | "Improve digital visibility"
  | "Increase Chamber engagement"
  | "Find event sponsorship opportunities"
  | "Find referral partners"
  | "Understand local competition";

export interface MetricProvenance {
  sourceOrganization: string;
  dataset: string;
  datasetYear: number;
  table: string;
  variables: string[];
  geography: string;
  geographyId: string;
  retrievedAt: string;
  queryUrl: string;
  transformation: string;
  direct: boolean;
  qualityFlags: string[];
}

export interface EvidenceMetric {
  id: string;
  label: string;
  description: string;
  estimate: number;
  formatted: string;
  unit: "count" | "percent" | "currency" | "years" | "minutes" | "rate";
  marginOfError: number | null;
  comparisonEstimate?: number;
  comparisonFormatted?: string;
  comparisonGeography?: string;
  coefficientOfVariation: number | null;
  confidence: ConfidenceGrade;
  provenance: MetricProvenance;
}

export interface NaicsClassification {
  code: string;
  title: string;
  confidence: number;
  method: "category_crosswalk" | "human_verified";
  evidence: string[];
  verificationStatus: "suggested" | "verified" | "needs_review";
  updatedAt: string;
}

export interface BusinessProfile {
  businessId: string;
  displayName: string;
  description: string;
  address: string;
  municipality: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  chamberCategory: string;
  industryGroup: string;
  primaryNaics: NaicsClassification;
  secondaryNaics: NaicsClassification[];
  audience: BusinessAudience;
  operatingModel: OperatingModel;
  employeeRange: EmployeeRange;
  numberOfLocations: number | null;
  yearFounded: number | null;
  website: string;
  serviceRadiusMiles: number | null;
  productsAndServices: string[];
  priceTier: PriceTier;
  targetSegments: string[];
  desiredSegments: string[];
  selectedGoals: BusinessGoal[];
  suggestedGoals: BusinessGoal[];
  growthChallenges: string[];
  operatingHours: string;
  languages: string[];
  profileCompleteness: number;
  sourceMember: Member;
  lastVerifiedAt: string | null;
  generatedAt: string;
  inferenceNotes: string[];
}

export interface BusinessInsight {
  id: string;
  businessId: string;
  type: string;
  statement: string;
  relevance: string;
  evidenceIds: string[];
  comparisonGeography: string;
  confidence: ConfidenceGrade;
  caveat: string;
  sourceLabel: string;
  datasetYear: number;
}

export interface RecommendationEvidence {
  metricId: string;
  explanation: string;
}

export interface BusinessRecommendation {
  id: string;
  businessId: string;
  category: string;
  title: string;
  summary: string;
  rationale: string;
  actionSteps: string[];
  evidence: RecommendationEvidence[];
  goalInfluence: BusinessGoal | "Profile readiness";
  impact: RecommendationImpact;
  effort: RecommendationEffort;
  confidence: ConfidenceGrade;
  timeHorizon: string;
  limitation: string;
  validFrom: string;
  reviewAfter: string;
  status: RecommendationStatus;
  engineVersion: string;
  generatedAt: string;
  score: number;
  scoreFactors: { label: string; points: number }[];
}

export interface ZipIndustryMetric {
  zipCode: string;
  zipName: string;
  sectorCode: string;
  sectorLabel: string;
  establishments: number;
  totalEstablishments: number;
  population: number;
  establishmentsPerTenThousand: number;
  datasetYear: number;
  provenanceUrl: string;
}

export interface BusinessIntelligenceRecord {
  profile: BusinessProfile;
  evidence: EvidenceMetric[];
  insights: BusinessInsight[];
  recommendations: BusinessRecommendation[];
  complementaryMembers: Member[];
  zipIndustryMetric: ZipIndustryMetric | null;
  dataConfidence: ConfidenceGrade;
}

export interface AuthorizationContext {
  userId: string;
  role: UserRole;
  businessId?: string;
}
