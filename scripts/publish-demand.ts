import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { DemandPublishRequest } from "../src/economy/demand/api-types";
import { publishDemandDataset } from "../src/economy/demand/api";

type CliArgs = { file?: string; metadata?: string; endpoint?: string };
type Metadata = {
  sourceUrl?: string;
  geography?: { label?: string; level?: string; code?: string | null };
  retrievedAt?: string;
  originalFileSha256?: string;
};

export function validateCliInputs(
  args: CliArgs,
  metadata: Metadata,
  adminToken: string,
) {
  if (!args.file || !args.metadata || !args.endpoint)
    throw new Error("--file, --metadata and --endpoint are required");
  if (!adminToken) throw new Error("DEMAND_ADMIN_TOKEN is required");
  let endpoint: URL;
  let source: URL;
  try {
    endpoint = new URL(args.endpoint);
    source = new URL(String(metadata.sourceUrl));
  } catch {
    throw new Error("Endpoint and source URL must be valid HTTPS URLs");
  }
  if (endpoint.protocol !== "https:" || source.protocol !== "https:")
    throw new Error("Endpoint and source URL must use HTTPS");
  if (
    !metadata.geography?.label ||
    !new Set(["state", "metro", "county", "other"]).has(
      String(metadata.geography.level),
    ) ||
    metadata.geography.code === undefined
  )
    throw new Error("Exact geography label, level and code are required");
  if (
    !metadata.retrievedAt ||
    new Date(metadata.retrievedAt).toISOString() !== metadata.retrievedAt
  )
    throw new Error("A valid retrieval timestamp is required");
  if (!/^[a-f0-9]{64}$/.test(metadata.originalFileSha256 ?? ""))
    throw new Error("The original file SHA-256 is required");
}

function parseArgs(values: string[]): CliArgs {
  const result: CliArgs = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index]?.replace(/^--/, "") as keyof CliArgs;
    if (!new Set(["file", "metadata", "endpoint"]).has(name))
      throw new Error(`Unsupported argument: ${values[index] ?? ""}`);
    result[name] = values[index + 1];
  }
  return result;
}

export async function runPublishCli(
  argv = process.argv.slice(2),
  adminToken = process.env.DEMAND_ADMIN_TOKEN ?? "",
) {
  const args = parseArgs(argv);
  if (!args.file || !args.metadata)
    throw new Error("--file, --metadata and --endpoint are required");
  const [fileBytes, metadataBytes] = await Promise.all([
    readFile(args.file),
    readFile(args.metadata, "utf8"),
  ]);
  const metadata = JSON.parse(metadataBytes) as Metadata;
  validateCliInputs(args, metadata, adminToken);
  const actualHash = createHash("sha256").update(fileBytes).digest("hex");
  if (actualHash !== metadata.originalFileSha256)
    throw new Error("Original file SHA-256 does not match --file");
  const request = JSON.parse(
    fileBytes.toString("utf8"),
  ) as DemandPublishRequest;
  request.geography = {
    label: metadata.geography!.label!,
    level: metadata.geography!
      .level as DemandPublishRequest["geography"]["level"],
    code: metadata.geography!.code ?? null,
  };
  request.provenance.sourceUrl = metadata.sourceUrl!;
  request.provenance.retrievedAt = metadata.retrievedAt!;
  request.provenance.notes = [
    ...request.provenance.notes,
    `Original publish artifact SHA-256: ${actualHash}`,
  ];
  const dataset = await publishDemandDataset(request, adminToken, {
    endpoint: args.endpoint,
    idempotencyKey: actualHash,
  });
  process.stdout.write(`Published ${dataset.id}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runPublishCli().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Publication failed"}\n`,
    );
    process.exitCode = 1;
  });
}
