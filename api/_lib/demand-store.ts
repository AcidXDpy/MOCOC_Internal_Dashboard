import { createHash } from "node:crypto";
import {
  get as blobGet,
  list as blobList,
  put as blobPut,
} from "@vercel/blob";
import type {
  DemandAdminEvent,
  DemandApiEnvelope,
  PublishedDemandDataset,
} from "../../src/economy/demand/api-types";
import {
  canonicalDataset,
  validatePublishRequest,
} from "./demand-contract";

const DATASET_PREFIX = "demand/v1/datasets/";
const EVENT_PREFIX = "demand/v1/events/";
const IDEMPOTENCY_PREFIX = "demand/v1/idempotency/";

export type RepositoryItem<T> = {
  pathname: string;
  value?: T;
  error?: string;
};

export interface DemandRepository {
  listDatasets(): Promise<RepositoryItem<PublishedDemandDataset>[]>;
  listEvents(): Promise<RepositoryItem<DemandAdminEvent>[]>;
  putDataset(
    dataset: PublishedDemandDataset,
    idempotencyKey: string,
  ): Promise<"created" | "exists">;
  appendEvent(event: DemandAdminEvent): Promise<void>;
}

type BlobListResult = {
  blobs: Array<{ pathname: string }>;
  cursor?: string;
  hasMore: boolean;
};

type BlobGetResult =
  | { statusCode: 200; stream: ReadableStream<Uint8Array> }
  | { statusCode: 304; stream: null }
  | null;

type BlobClient = {
  list(options: {
    prefix: string;
    cursor?: string;
    token: string;
  }): Promise<BlobListResult>;
  get(
    pathname: string,
    options: { access: "private"; token: string; useCache: false },
  ): Promise<BlobGetResult>;
  put(
    pathname: string,
    body: string,
    options: {
      access: "private";
      addRandomSuffix: false;
      allowOverwrite: false;
      contentType: "application/json";
      token: string;
    },
  ): Promise<{ pathname: string }>;
};

type DeriveOptions = {
  includeHistory?: boolean;
  now?: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function datasetPath(dataset: PublishedDemandDataset) {
  return `${DATASET_PREFIX}${dataset.id}-${dataset.provenance.contentSha256}.json`;
}

function eventPath(event: DemandAdminEvent) {
  const instant = event.occurredAt.replace(/[:.]/g, "-");
  return `${EVENT_PREFIX}${instant}-${event.id}.json`;
}

function storedDataset(value: unknown): PublishedDemandDataset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.id !== "string" ||
    !input.id ||
    input.schemaVersion !== "1.0" ||
    input.status !== "verified"
  )
    return null;
  const provenance = input.provenance as Record<string, unknown> | undefined;
  if (
    !provenance ||
    typeof provenance.publishedAt !== "string" ||
    typeof provenance.contentSha256 !== "string"
  )
    return null;
  const publishedAt = new Date(provenance.publishedAt);
  if (
    !Number.isFinite(publishedAt.getTime()) ||
    publishedAt.toISOString() !== provenance.publishedAt
  )
    return null;
  try {
    const canonical = canonicalDataset(validatePublishRequest(input), {
      id: input.id,
      publishedAt: provenance.publishedAt,
    });
    return canonical.provenance.contentSha256 === provenance.contentSha256
      ? canonical
      : null;
  } catch {
    return null;
  }
}

function storedEvent(value: unknown): DemandAdminEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.id !== "string" ||
    !input.id ||
    !new Set(["activate", "supersede", "archive"]).has(String(input.type)) ||
    typeof input.datasetId !== "string" ||
    !input.datasetId ||
    typeof input.occurredAt !== "string"
  )
    return null;
  const occurredAt = new Date(input.occurredAt);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt.toISOString() !== input.occurredAt
  )
    return null;
  if (
    input.expectedActiveDatasetId !== undefined &&
    input.expectedActiveDatasetId !== null &&
    typeof input.expectedActiveDatasetId !== "string"
  )
    return null;
  return {
    id: input.id,
    type: input.type as DemandAdminEvent["type"],
    datasetId: input.datasetId,
    occurredAt: input.occurredAt,
    ...(input.expectedActiveDatasetId !== undefined
      ? { expectedActiveDatasetId: input.expectedActiveDatasetId as
          | string
          | null }
      : {}),
  };
}

function warning(count: number, subject: string) {
  return `${count} ${subject}${count === 1 ? " was" : "s were"} excluded because ${
    count === 1 ? "it" : "they"
  } failed validation.`;
}

export function deriveDemandState(
  datasetItems: RepositoryItem<PublishedDemandDataset>[],
  eventItems: RepositoryItem<DemandAdminEvent>[],
  options: DeriveOptions = {},
): DemandApiEnvelope {
  const warnings: string[] = [];
  const datasets = new Map<string, PublishedDemandDataset>();
  let invalidDatasets = 0;
  for (const item of datasetItems) {
    const dataset = item.error ? null : storedDataset(item.value);
    if (!dataset) invalidDatasets += 1;
    else datasets.set(dataset.id, dataset);
  }
  if (invalidDatasets)
    warnings.push(warning(invalidDatasets, "stored dataset"));

  const events: DemandAdminEvent[] = [];
  let invalidEvents = 0;
  for (const item of eventItems) {
    const event = item.error ? null : storedEvent(item.value);
    if (!event) invalidEvents += 1;
    else events.push(event);
  }
  if (invalidEvents)
    warnings.push(warning(invalidEvents, "administrative event"));

  events.sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
  let activeDatasetId: string | null = null;
  const superseded = new Set<string>();
  const archived = new Set<string>();
  for (const event of events) {
    if (
      event.expectedActiveDatasetId !== undefined &&
      event.expectedActiveDatasetId !== activeDatasetId
    )
      continue;
    if (event.type === "activate") {
      activeDatasetId = event.datasetId;
      archived.delete(event.datasetId);
    } else if (event.type === "supersede") {
      superseded.add(event.datasetId);
      if (activeDatasetId === event.datasetId) activeDatasetId = null;
    } else {
      archived.add(event.datasetId);
      superseded.delete(event.datasetId);
      if (activeDatasetId === event.datasetId) activeDatasetId = null;
    }
  }
  if (
    !activeDatasetId ||
    !datasets.has(activeDatasetId) ||
    archived.has(activeDatasetId)
  )
    activeDatasetId = null;

  const visibleIds = options.includeHistory
    ? new Set([
        ...(activeDatasetId ? [activeDatasetId] : []),
        ...[...superseded].filter((id) => !archived.has(id)),
      ])
    : new Set(activeDatasetId ? [activeDatasetId] : []);
  const visible = [...datasets.values()]
    .filter((dataset) => visibleIds.has(dataset.id))
    .sort(
      (left, right) =>
        left.provenance.publishedAt.localeCompare(
          right.provenance.publishedAt,
        ) || left.id.localeCompare(right.id),
    );

  return {
    schemaVersion: "1.0",
    generatedAt: options.now ?? new Date().toISOString(),
    activeDatasetId,
    datasets: visible,
    warnings,
  };
}

export class MemoryDemandRepository implements DemandRepository {
  private readonly datasets = new Map<
    string,
    RepositoryItem<PublishedDemandDataset>
  >();
  private readonly events: RepositoryItem<DemandAdminEvent>[] = [];
  private readonly idempotency = new Map<string, string>();

  async listDatasets() {
    return clone([...this.datasets.values()]);
  }

  async listEvents() {
    return clone(this.events);
  }

  async putDataset(dataset: PublishedDemandDataset, idempotencyKey: string) {
    const existingHash = this.idempotency.get(idempotencyKey);
    if (existingHash && existingHash !== dataset.provenance.contentSha256)
      throw new Error("Idempotency key is already associated with another dataset");
    const pathname = datasetPath(dataset);
    if (existingHash) return "exists" as const;
    this.idempotency.set(idempotencyKey, dataset.provenance.contentSha256);
    this.datasets.set(pathname, { pathname, value: clone(dataset) });
    return "created" as const;
  }

  async appendEvent(event: DemandAdminEvent) {
    const pathname = eventPath(event);
    this.events.push({ pathname, value: clone(event) });
  }
}

function storageFailure(): Error {
  return new Error("Demand storage operation failed");
}

export class VercelBlobDemandRepository implements DemandRepository {
  private readonly token: string;
  private readonly client: BlobClient;

  constructor(options: { token: string; client?: BlobClient }) {
    if (!options.token.trim()) throw new Error("Demand storage is not configured");
    this.token = options.token;
    this.client =
      options.client ??
      ({
        list: (input) => blobList(input),
        get: (pathname, input) => blobGet(pathname, input),
        put: (pathname, body, input) => blobPut(pathname, body, input),
      } satisfies BlobClient);
  }

  private async paths(prefix: string) {
    const paths: string[] = [];
    let cursor: string | undefined;
    try {
      do {
        const result = await this.client.list({
          prefix,
          ...(cursor ? { cursor } : {}),
          token: this.token,
        });
        paths.push(...result.blobs.map((blob) => blob.pathname));
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
      return paths;
    } catch {
      throw storageFailure();
    }
  }

  private async read(pathname: string): Promise<unknown | null> {
    try {
      const result = await this.client.get(pathname, {
        access: "private",
        token: this.token,
        useCache: false,
      });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.stream) throw storageFailure();
      return JSON.parse(await new Response(result.stream).text()) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError) throw error;
      if (error instanceof Error && error.message === storageFailure().message)
        throw error;
      throw storageFailure();
    }
  }

  private async listObjects<T>(
    prefix: string,
    parse: (value: unknown) => T | null,
  ): Promise<RepositoryItem<T>[]> {
    const paths = await this.paths(prefix);
    return Promise.all(
      paths.map(async (pathname) => {
        try {
          const value = parse(await this.read(pathname));
          return value
            ? { pathname, value }
            : { pathname, error: "invalid stored object" };
        } catch {
          return { pathname, error: "invalid stored object" };
        }
      }),
    );
  }

  async listDatasets() {
    return this.listObjects(DATASET_PREFIX, storedDataset);
  }

  async listEvents() {
    return this.listObjects(EVENT_PREFIX, storedEvent);
  }

  private async write(pathname: string, value: unknown) {
    try {
      await this.client.put(pathname, JSON.stringify(value), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
        token: this.token,
      });
    } catch {
      throw storageFailure();
    }
  }

  async putDataset(dataset: PublishedDemandDataset, idempotencyKey: string) {
    const keyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const markerPath = `${IDEMPOTENCY_PREFIX}${keyHash}.json`;
    const marker = {
      datasetId: dataset.id,
      contentSha256: dataset.provenance.contentSha256,
    };
    let existing: unknown | null;
    try {
      existing = await this.read(markerPath);
    } catch {
      throw storageFailure();
    }
    if (existing) {
      const record = existing as Record<string, unknown>;
      if (record.contentSha256 !== marker.contentSha256)
        throw new Error("Idempotency key is already associated with another dataset");
      return "exists";
    }
    try {
      await this.write(markerPath, marker);
    } catch {
      const concurrent = await this.read(markerPath).catch(() => null);
      if (
        !concurrent ||
        (concurrent as Record<string, unknown>).contentSha256 !==
          marker.contentSha256
      )
        throw storageFailure();
    }
    const pathname = datasetPath(dataset);
    try {
      await this.write(pathname, dataset);
      return "created";
    } catch {
      const existingDataset = storedDataset(
        await this.read(pathname).catch(() => null),
      );
      if (
        existingDataset?.provenance.contentSha256 ===
        dataset.provenance.contentSha256
      )
        return "exists";
      throw storageFailure();
    }
  }

  async appendEvent(event: DemandAdminEvent) {
    await this.write(eventPath(event), event);
  }
}
