import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchCensusData } from "../api/_lib/census";

const variableSets = {
  profile: ["DP05_0001E", "DP05_0001M", "DP03_0062E", "DP03_0062M"],
  detailed: [
    "B11005001E",
    "B11005001M",
    "B11005002E",
    "B11005002M",
    "B25003001E",
    "B25003001M",
    "B25003002E",
    "B25003002M",
  ],
};

async function refresh() {
  const [profile, detailed] = await Promise.all([
    fetchCensusData({
      dataset: "acs5Profile",
      variables: variableSets.profile,
      geography: "mount-olive",
    }),
    fetchCensusData({
      dataset: "acs5Detailed",
      variables: variableSets.detailed,
      geography: "mount-olive",
    }),
  ]);
  const target = resolve("data/cache/census-latest.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), profile, detailed }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote verified Census snapshot to ${target}`);
}

refresh().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Census refresh failed",
  );
  console.error("The existing checked-in snapshot remains unchanged.");
  process.exitCode = 1;
});
