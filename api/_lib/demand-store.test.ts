import { describe, expect, it, vi } from "vitest";
import type {
  DemandAdminEvent,
  PublishedDemandDataset,
} from "../../src/economy/demand/api-types";
import {
  MemoryDemandRepository,
  VercelBlobDemandRepository,
  deriveDemandState,
} from "./demand-store";
import { contentFingerprint } from "./demand-contract";

function dataset(id: string): PublishedDemandDataset {
  const result: PublishedDemandDataset = {
    id,
    schemaVersion: "1.0",
    status: "verified",
    name: `Dataset ${id}`,
    sourceType: "google-trends-csv",
    valueUnit: "normalized-index-0-100",
    frequency: "Month",
    geography: { label: "New Jersey", level: "state", code: "US-NJ" },
    comparison: { sharedScale: true, method: "single-export" },
    provenance: {
      sourceOrganization: "Google",
      sourceProduct: "Google Trends",
      sourceUrl: "https://trends.google.com/trends/explore?geo=US-NJ",
      retrievedAt: "2026-10-03T14:00:00.000Z",
      publishedAt: "2026-10-03T15:00:00.000Z",
      originalFilename: "multiTimeline.csv",
      contentSha256: "",
      acquisitionMethod: "official-csv-export",
      notes: [],
    },
    series: [
      {
        category: "restaurants",
        query: "restaurants",
        points: [{ date: "2026-01-01", interest: 50 }],
      },
    ],
  };
  result.provenance.contentSha256 = contentFingerprint(result);
  return result;
}

function event(
  type: DemandAdminEvent["type"],
  datasetId: string,
  minute: number,
): DemandAdminEvent {
  return {
    id: `event-${minute}`,
    type,
    datasetId,
    occurredAt: `2026-10-03T15:${String(minute).padStart(2, "0")}:00.000Z`,
  };
}

describe("immutable demand repository", () => {
  it("stores datasets immutably under content-addressed paths", async () => {
    const repository = new MemoryDemandRepository();
    const original = dataset("demand-1");
    expect(await repository.putDataset(original, "publish-1")).toBe("created");
    original.name = "mutated outside repository";
    const stored = await repository.listDatasets();
    expect(stored).toHaveLength(1);
    expect(stored[0].pathname).toBe(
      `demand/v1/datasets/demand-1-${original.provenance.contentSha256}.json`,
    );
    expect(stored[0].value?.name).toBe("Dataset demand-1");
  });

  it("derives active verified state from ordered append-only events", () => {
    const result = deriveDemandState(
      [
        { pathname: "one", value: dataset("one") },
        { pathname: "two", value: dataset("two") },
      ],
      [
        { pathname: "later-name", value: event("activate", "two", 20) },
        { pathname: "earlier-name", value: event("activate", "one", 10) },
      ],
      { now: "2026-10-03T16:00:00.000Z" },
    );
    expect(result.activeDatasetId).toBe("two");
    expect(result.datasets.map((item) => item.id)).toEqual(["two"]);
  });

  it("keeps superseded history only when requested", () => {
    const datasets = [
      { pathname: "one", value: dataset("one") },
      { pathname: "two", value: dataset("two") },
      { pathname: "three", value: dataset("three") },
    ];
    const events = [
      { pathname: "e1", value: event("activate", "one", 1) },
      { pathname: "e2", value: event("supersede", "one", 2) },
      { pathname: "e3", value: event("activate", "two", 3) },
      { pathname: "e4", value: event("archive", "three", 4) },
    ];
    expect(
      deriveDemandState(datasets, events, {
        now: "2026-10-03T16:00:00.000Z",
      }).datasets.map((item) => item.id),
    ).toEqual(["two"]);
    expect(
      deriveDemandState(datasets, events, {
        includeHistory: true,
        now: "2026-10-03T16:00:00.000Z",
      }).datasets.map((item) => item.id),
    ).toEqual(["one", "two"]);
  });

  it("excludes malformed stored objects and returns a public warning", () => {
    const result = deriveDemandState(
      [
        { pathname: "valid-private-path", value: dataset("one") },
        {
          pathname:
            "https://secret.private.blob.vercel-storage.com/malformed.json",
          error: "invalid object containing token=secret",
        },
      ],
      [
        { pathname: "e1", value: event("activate", "one", 1) },
        { pathname: "bad-event", error: "bad private event" },
      ],
      { now: "2026-10-03T16:00:00.000Z" },
    );
    expect(result.datasets.map((item) => item.id)).toEqual(["one"]);
    expect(result.warnings).toEqual([
      "1 stored dataset was excluded because it failed validation.",
      "1 administrative event was excluded because it failed validation.",
    ]);
    expect(JSON.stringify(result)).not.toContain("private.blob");
    expect(JSON.stringify(result)).not.toContain("token=secret");
  });

  it("makes an idempotency key produce one stored dataset", async () => {
    const repository = new MemoryDemandRepository();
    expect(await repository.putDataset(dataset("one"), "same-key")).toBe(
      "created",
    );
    expect(await repository.putDataset(dataset("one"), "same-key")).toBe(
      "exists",
    );
    expect(await repository.listDatasets()).toHaveLength(1);
    await expect(
      repository.putDataset(dataset("two"), "same-key"),
    ).rejects.toThrow("Idempotency key is already associated");
  });

  it("maps Blob configuration and storage failures without exposing private URLs", async () => {
    expect(() => new VercelBlobDemandRepository({ token: "" })).toThrow(
      "Demand storage is not configured",
    );
    const repository = new VercelBlobDemandRepository({
      token: "secret-token",
      client: {
        list: async () => {
          throw new Error(
            "GET https://store.private.blob.vercel-storage.com?token=secret-token",
          );
        },
        get: async () => null,
        put: async () => ({ pathname: "unused" }),
      },
    });
    await expect(repository.listDatasets()).rejects.toThrow(
      "Demand storage operation failed",
    );
    try {
      await repository.listDatasets();
    } catch (error) {
      expect(String(error)).not.toContain("private.blob");
      expect(String(error)).not.toContain("secret-token");
    }
  });

  it("orders accepted events by durable commit order, not request timestamp", () => {
    const result = deriveDemandState(
      ["one", "two", "three"].map((id) => ({
        pathname: id,
        value: dataset(id),
      })),
      [
        {
          pathname: "e1",
          order: "001",
          value: {
            ...event("activate", "one", 1),
            expectedActiveDatasetId: null,
          },
        },
        {
          pathname: "e2",
          order: "002",
          value: {
            ...event("activate", "two", 3),
            expectedActiveDatasetId: "one",
          },
        },
        {
          pathname: "e3",
          order: "003",
          value: {
            ...event("activate", "three", 2),
            expectedActiveDatasetId: "one",
          },
        },
      ],
      { now: "2026-10-03T16:00:00.000Z" },
    );
    expect(result.activeDatasetId).toBe("two");
  });

  it("keeps the displaced active dataset in reproducible history", () => {
    const result = deriveDemandState(
      ["one", "two"].map((id) => ({ pathname: id, value: dataset(id) })),
      [
        {
          pathname: "e1",
          order: "001",
          value: {
            ...event("activate", "one", 1),
            expectedActiveDatasetId: null,
          },
        },
        {
          pathname: "e2",
          order: "002",
          value: {
            ...event("activate", "two", 2),
            expectedActiveDatasetId: "one",
          },
        },
      ],
      { includeHistory: true, now: "2026-10-03T16:00:00.000Z" },
    );
    expect(result.datasets.map((item) => item.id)).toEqual(["one", "two"]);
  });

  it("repairs an idempotency marker left before its dataset write", async () => {
    const candidate = dataset("one");
    const marker = JSON.stringify({
      datasetId: candidate.id,
      contentSha256: candidate.provenance.contentSha256,
    });
    const put = vi.fn(async (pathname: string) => ({ pathname }));
    const repository = new VercelBlobDemandRepository({
      token: "token",
      client: {
        list: async () => ({ blobs: [], hasMore: false }),
        get: async (pathname: string) =>
          pathname.includes("idempotency")
            ? { statusCode: 200 as const, stream: new Response(marker).body! }
            : null,
        put,
      },
    });
    expect(await repository.putDataset(candidate, "retry-key")).toBe("created");
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("demand/v1/datasets/one-"),
      expect.any(String),
      expect.any(Object),
    );
  });

  it("fails the whole state read when a stored event cannot be fetched", async () => {
    const repository = new VercelBlobDemandRepository({
      token: "token",
      client: {
        list: async () => ({
          blobs: [
            { pathname: "demand/v1/events/e.json", uploadedAt: new Date() },
          ],
          hasMore: false,
        }),
        get: async () => {
          throw new Error("network unavailable");
        },
        put: async (pathname: string) => ({ pathname }),
      },
    });
    await expect(repository.listEvents()).rejects.toThrow(
      "Demand storage operation failed",
    );
  });
});
