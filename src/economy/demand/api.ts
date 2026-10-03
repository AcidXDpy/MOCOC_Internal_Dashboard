import type {
  DemandApiEnvelope,
  DemandPublishRequest,
  DemandProvenance,
  PublishedDemandDataset,
} from "./api-types";
import { categories, type DemandBatch, type DemandSeries } from "./types";

export type DemandFetchResult =
  | { status: "available"; data: DemandApiEnvelope }
  | { status: "unavailable"; reason: "timeout" | "network" | "invalid" };

type FetchOptions = {
  endpoint?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

const categoryIds = new Set<string>(categories.map((category) => category.id));

function isInstant(value: unknown) {
  return (
    typeof value === "string" &&
    Number.isFinite(new Date(value).getTime()) &&
    new Date(value).toISOString() === value
  );
}

function validSeries(value: unknown): value is DemandSeries[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8)
    return false;
  const mapped = new Set<string>();
  return value.every((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const series = raw as Record<string, unknown>;
    if (
      !categoryIds.has(String(series.category)) ||
      mapped.has(String(series.category)) ||
      typeof series.query !== "string" ||
      !series.query ||
      !Array.isArray(series.points) ||
      !series.points.length ||
      series.points.length > 10_000
    )
      return false;
    mapped.add(String(series.category));
    const dates = new Set<string>();
    return series.points.every((rawPoint) => {
      if (!rawPoint || typeof rawPoint !== "object") return false;
      const point = rawPoint as Record<string, unknown>;
      if (
        typeof point.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(point.date) ||
        dates.has(point.date) ||
        new Date(`${point.date}T00:00:00Z`).toISOString().slice(0, 10) !==
          point.date ||
        (point.interest !== null &&
          (typeof point.interest !== "number" ||
            !Number.isFinite(point.interest) ||
            point.interest < 0 ||
            point.interest > 100))
      )
        return false;
      dates.add(point.date);
      return true;
    });
  });
}

function validDataset(value: unknown): value is PublishedDemandDataset {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const dataset = value as Record<string, unknown>;
  const geography = dataset.geography as Record<string, unknown> | undefined;
  const comparison = dataset.comparison as Record<string, unknown> | undefined;
  const provenance = dataset.provenance as Record<string, unknown> | undefined;
  return Boolean(
    typeof dataset.id === "string" &&
    dataset.schemaVersion === "1.0" &&
    dataset.status === "verified" &&
    typeof dataset.name === "string" &&
    new Set(["google-trends-csv", "google-trends-api"]).has(
      String(dataset.sourceType),
    ) &&
    new Set(["normalized-index-0-100", "google-trends-api-scaled"]).has(
      String(dataset.valueUnit),
    ) &&
    new Set(["Month", "Week", "Day", "Date"]).has(String(dataset.frequency)) &&
    geography &&
    typeof geography.label === "string" &&
    new Set(["state", "metro", "county", "other"]).has(
      String(geography.level),
    ) &&
    (geography.code === null || typeof geography.code === "string") &&
    comparison &&
    typeof comparison.sharedScale === "boolean" &&
    new Set(["single-export", "official-api"]).has(String(comparison.method)) &&
    provenance &&
    provenance.sourceOrganization === "Google" &&
    provenance.sourceProduct === "Google Trends" &&
    typeof provenance.sourceUrl === "string" &&
    provenance.sourceUrl.startsWith("https://") &&
    isInstant(provenance.retrievedAt) &&
    isInstant(provenance.publishedAt) &&
    /^[a-f0-9]{64}$/.test(String(provenance.contentSha256)) &&
    new Set(["official-csv-export", "official-api"]).has(
      String(provenance.acquisitionMethod),
    ) &&
    Array.isArray(provenance.notes) &&
    provenance.notes.every((note) => typeof note === "string") &&
    validSeries(dataset.series),
  );
}

function parseEnvelope(value: unknown): DemandApiEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (
    envelope.schemaVersion !== "1.0" ||
    !isInstant(envelope.generatedAt) ||
    (envelope.activeDatasetId !== null &&
      typeof envelope.activeDatasetId !== "string") ||
    !Array.isArray(envelope.datasets) ||
    !envelope.datasets.every(validDataset) ||
    !Array.isArray(envelope.warnings) ||
    !envelope.warnings.every((warning) => typeof warning === "string")
  )
    return null;
  if (
    envelope.activeDatasetId !== null &&
    !envelope.datasets.some(
      (dataset) =>
        (dataset as PublishedDemandDataset).id === envelope.activeDatasetId,
    )
  )
    return null;
  return envelope as DemandApiEnvelope;
}

export async function fetchDemandApi(
  options: FetchOptions = {},
): Promise<DemandFetchResult> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 900,
  );
  try {
    const response = await (options.fetcher ?? fetch)(
      options.endpoint ?? "/api/demand",
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) return { status: "unavailable", reason: "network" };
    const envelope = parseEnvelope(await response.json());
    return envelope
      ? { status: "available", data: envelope }
      : { status: "unavailable", reason: "invalid" };
  } catch (error) {
    return {
      status: "unavailable",
      reason:
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
          ? "timeout"
          : "network",
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export function publishedToDemandBatch(
  dataset: PublishedDemandDataset,
): DemandBatch {
  if (dataset.valueUnit !== "normalized-index-0-100")
    throw new Error(
      "Google Trends API-scaled data requires a normalization adapter before charting.",
    );
  return {
    id: dataset.id,
    name: dataset.name,
    geography: `${dataset.geography.label} (${dataset.geography.level}${
      dataset.geography.code ? `: ${dataset.geography.code}` : ""
    })`,
    source: dataset.sourceType,
    importedAt: dataset.provenance.publishedAt,
    filename: dataset.provenance.originalFilename,
    comparable: dataset.comparison.sharedScale,
    demoSample: false,
    frequency: dataset.frequency,
    warnings: dataset.provenance.notes,
    series: dataset.series,
    verification: "verified-api",
    geographyDetail: dataset.geography,
    valueUnit: dataset.valueUnit,
    provenance: dataset.provenance,
  };
}

type PublishOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
  idempotencyKey?: string;
  activate?: boolean;
  expectedActiveDatasetId?: string | null;
};

export async function publishDemandDataset(
  request: DemandPublishRequest & { demoSample?: boolean },
  adminToken: string,
  options: PublishOptions = {},
): Promise<PublishedDemandDataset> {
  if (request.demoSample || !request.comparison.sharedScale)
    throw new Error(
      "Demo or independently scaled data cannot be published as verified.",
    );
  if (!adminToken) throw new Error("Administrator key is required");
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint ?? "/api/demand";
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
    "Idempotency-Key":
      options.idempotencyKey ?? `publish-${crypto.randomUUID()}`,
  };
  const response = await fetcher(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Publication failed (${response.status})`);
  let dataset: PublishedDemandDataset;
  try {
    const payload = (await response.json()) as { dataset?: unknown };
    if (!validDataset(payload.dataset)) throw new Error("invalid");
    dataset = payload.dataset;
  } catch {
    throw new Error("Publication returned an invalid response");
  }
  if (options.activate) {
    const activation = await fetcher(
      `${endpoint}?id=${encodeURIComponent(dataset.id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "activate",
          expectedActiveDatasetId: options.expectedActiveDatasetId ?? null,
        }),
      },
    );
    if (!activation.ok)
      throw new Error(`Activation failed (${activation.status})`);
  }
  return dataset;
}

export type { DemandProvenance };
