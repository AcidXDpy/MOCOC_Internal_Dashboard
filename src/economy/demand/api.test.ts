import { describe, expect, it, vi } from "vitest";
import type { PublishedDemandDataset } from "./api-types";
import {
  fetchDemandApi,
  publishDemandDataset,
  publishedToDemandBatch,
} from "./api";

function published(
  overrides: Partial<PublishedDemandDataset> = {},
): PublishedDemandDataset {
  return {
    id: "verified-one",
    schemaVersion: "1.0",
    status: "verified",
    name: "Official New Jersey demand",
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
      contentSha256: "a".repeat(64),
      acquisitionMethod: "official-csv-export",
      notes: ["Official export"],
    },
    series: [
      {
        category: "restaurants",
        query: "restaurants",
        points: [{ date: "2026-01-01", interest: 50 }],
      },
    ],
    ...overrides,
  };
}

describe("demand API client", () => {
  it("converts a verified published dataset without losing geography or provenance", () => {
    const batch = publishedToDemandBatch(published());
    expect(batch.geography).toBe("New Jersey (state: US-NJ)");
    expect(batch.verification).toBe("verified-api");
    expect(batch.provenance?.sourceUrl).toContain("trends.google.com");
    expect(batch.provenance?.contentSha256).toBe("a".repeat(64));
    expect(batch.series[0].query).toBe("restaurants");
  });

  it("rejects malformed success responses instead of coercing them", async () => {
    const result = await fetchDemandApi({
      fetcher: vi.fn(
        async () =>
          new Response(
            JSON.stringify({ schemaVersion: "1.0", datasets: [{}] }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid" });
  });

  it("rejects enum-shaped nested category values", async () => {
    const malformed = published();
    (malformed.series[0] as unknown as { category: unknown }).category = [
      "restaurants",
    ];
    const result = await fetchDemandApi({
      fetcher: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schemaVersion: "1.0",
              generatedAt: "2026-10-03T16:00:00.000Z",
              activeDatasetId: malformed.id,
              datasets: [malformed],
              warnings: [],
            }),
            { status: 200 },
          ),
      ),
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid" });
  });

  it("aborts slow requests and returns a typed unavailable result", async () => {
    const fetcher = vi.fn(
      (_url: URL | RequestInfo, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const result = await fetchDemandApi({ fetcher, timeoutMs: 10 });
    expect(result).toEqual({ status: "unavailable", reason: "timeout" });
  });

  it("does not map API-scaled units into the 0-100 engine without an adapter", () => {
    expect(() =>
      publishedToDemandBatch(
        published({
          sourceType: "google-trends-api",
          valueUnit: "google-trends-api-scaled",
          comparison: { sharedScale: true, method: "official-api" },
          provenance: {
            ...published().provenance,
            acquisitionMethod: "official-api",
          },
        }),
      ),
    ).toThrow("normalization adapter");
  });

  it("publishes a validated official CSV request with bearer auth outside the body", async () => {
    const calls: Array<{ body: string; headers: HeadersInit }> = [];
    const fetcher = vi.fn(
      async (_url: URL | RequestInfo, init?: RequestInit) => {
        calls.push({ body: String(init?.body), headers: init?.headers ?? {} });
        return new Response(
          JSON.stringify({ dataset: published(), outcome: "created" }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
    );
    const request = {
      name: published().name,
      sourceType: published().sourceType,
      valueUnit: published().valueUnit,
      frequency: published().frequency,
      geography: published().geography,
      comparison: published().comparison,
      provenance: {
        sourceOrganization: "Google" as const,
        sourceProduct: "Google Trends" as const,
        sourceUrl: published().provenance.sourceUrl,
        retrievedAt: published().provenance.retrievedAt,
        originalFilename: published().provenance.originalFilename,
        acquisitionMethod: "official-csv-export" as const,
        notes: [],
      },
      series: published().series,
    };
    const result = await publishDemandDataset(request, "top-secret-admin", {
      fetcher,
      idempotencyKey: "official-export-october-2026",
    });
    expect(result.id).toBe("verified-one");
    expect(new Headers(calls[0].headers).get("authorization")).toBe(
      "Bearer top-secret-admin",
    );
    expect(calls[0].body).not.toContain("top-secret-admin");
  });

  it("never sends demo data or an independently scaled comparison", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const request = {
      name: "Bad cohort",
      sourceType: "google-trends-csv" as const,
      valueUnit: "normalized-index-0-100" as const,
      frequency: "Month" as const,
      geography: published().geography,
      comparison: { sharedScale: false, method: "single-export" as const },
      provenance: {
        sourceOrganization: "Google" as const,
        sourceProduct: "Google Trends" as const,
        sourceUrl: published().provenance.sourceUrl,
        retrievedAt: published().provenance.retrievedAt,
        originalFilename: "demo.csv",
        acquisitionMethod: "official-csv-export" as const,
        notes: [],
      },
      series: published().series,
      demoSample: true,
    };
    await expect(
      publishDemandDataset(request, "secret", { fetcher }),
    ).rejects.toThrow("Demo or independently scaled data cannot be published");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("clears credentials from returned errors and client state", async () => {
    const request = {
      name: published().name,
      sourceType: published().sourceType,
      valueUnit: published().valueUnit,
      frequency: published().frequency,
      geography: published().geography,
      comparison: published().comparison,
      provenance: {
        sourceOrganization: "Google" as const,
        sourceProduct: "Google Trends" as const,
        sourceUrl: published().provenance.sourceUrl,
        retrievedAt: published().provenance.retrievedAt,
        originalFilename: published().provenance.originalFilename,
        acquisitionMethod: "official-csv-export" as const,
        notes: [],
      },
      series: published().series,
    };
    let token = "never-return-this-token";
    try {
      await publishDemandDataset(request, token, {
        fetcher: vi.fn(
          async () =>
            new Response(
              JSON.stringify({ error: { message: `bad ${token}` } }),
              { status: 401 },
            ),
        ),
      });
    } catch (error) {
      expect(String(error)).toBe("Error: Publication failed (401)");
    } finally {
      token = "";
    }
    expect(token).toBe("");
  });
});
