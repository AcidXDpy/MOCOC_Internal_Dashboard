import { members } from "../src/data/members";
import {
  buildAllBusinessIntelligence,
  getAdminIntelligenceSummary,
} from "../src/intelligence/engine";

const records = buildAllBusinessIntelligence();
const summary = getAdminIntelligenceSummary(records);
const failures: { businessId: string; error: string }[] = [];

for (const member of members) {
  try {
    const record = records.find(
      (item) => item.profile.businessId === member.member_id,
    );
    if (!record) throw new Error("Profile was not generated");
  } catch (error) {
    failures.push({
      businessId: member.member_id,
      error:
        error instanceof Error ? error.message : "Unknown initialization error",
    });
  }
}

const importSummary = {
  businessesProcessed: members.length,
  profilesCreated: summary.profilesCreated,
  addressesValidated: members.filter(
    (member) => member.address && member.city && member.state,
  ).length,
  geocodingSuccesses: summary.geocoded,
  geocodingFailures: members.length - summary.geocoded,
  naicsSuggestionsAssigned: records.filter(
    (record) => record.profile.primaryNaics.code !== "00",
  ).length,
  classificationsNeedingReview: summary.classificationsNeedingReview,
  businessesReceivingInsights: summary.currentInsights,
  businessesLackingSufficientData: records.filter(
    (record) => record.insights.length === 0,
  ).length,
  recommendationsGenerated: summary.recommendations,
  apiErrors: 0,
  failures,
  note: "Profiles are generated deterministically at runtime. Persisting them requires applying the SQL migration and connecting the authenticated database adapter.",
};

console.log(JSON.stringify(importSummary, null, 2));
if (failures.length) process.exitCode = 1;
