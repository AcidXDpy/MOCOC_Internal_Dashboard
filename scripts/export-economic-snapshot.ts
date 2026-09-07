import { mkdir, writeFile } from "node:fs/promises";
import { members } from "../src/data/members";
import {
  acsEvidence,
  countyBusinessPatterns,
  zipBusinessPatterns,
  ECONOMIC_DATA_RETRIEVED_AT,
} from "../src/data/localEconomy";

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  directorySnapshotDate: "2026-07-16",
  economicRetrievedAt: ECONOMIC_DATA_RETRIEVED_AT,
  businesses: members
    .filter((member) => member.data_source === "public_directory")
    .map((member) => ({
      id: member.member_id,
      name: member.business_name,
      industry: member.industry,
      address: member.address,
      city: member.city,
      zip: member.zip_code,
      latitude: member.latitude,
      longitude: member.longitude,
      description: member.notes,
      sourceUrl: member.source_url,
    })),
  acs: acsEvidence,
  county: countyBusinessPatterns,
  zip: zipBusinessPatterns,
};

await mkdir("public/economy", { recursive: true });
await writeFile(
  "public/economy/source-snapshot.json",
  JSON.stringify(snapshot, null, 2) + "\n",
);
console.log(
  `Exported ${snapshot.businesses.length} public listings; synthetic lifecycle fields excluded.`,
);
