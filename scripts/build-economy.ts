import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import "./export-economic-snapshot";

const args = process.argv.slice(2);
if (
  args.some((arg) => !["--refresh", "--offline"].includes(arg)) ||
  (args.includes("--refresh") && args.includes("--offline"))
) {
  throw new Error("Use --refresh or --offline, not both.");
}
const python = process.env.PYTHON ?? "python";
const runtime =
  process.env.ECONOMY_DATA_DIR ??
  join(
    process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"),
    "MountOliveEconomy",
  );
const db = join(runtime, "economy.sqlite");
function run(command: string[]) {
  const child = spawnSync(python, command, { stdio: "inherit", shell: false });
  if (child.error) throw child.error;
  if (child.status !== 0)
    throw new Error(
      `Economic pipeline stage failed: ${command.slice(0, 3).join(" ")} (exit ${child.status})`,
    );
}
run(["-m", "research.build", ...args]);
for (const [command, path] of [
  ["import-snapshot", "public/economy/source-snapshot.json"],
  ["import-csv", "research/data/observations.csv"],
  ["import-model", "public/economy/model-results.json"],
]) {
  run(["-m", "warehouse", "--db", db, command, path]);
}
run(["-m", "warehouse", "--db", db, "quality"]);
run([
  "-m",
  "warehouse",
  "--db",
  db,
  "export",
  "--output",
  join(runtime, "warehouse-export.json"),
]);
console.log(
  `Rebuilt public research artifacts and audited warehouse at ${db}.`,
);
