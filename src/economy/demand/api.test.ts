import { describe, expect, it, vi } from "vitest";
import type { PublishedDemandDataset } from "./api-types";
import { fetchDemandApi, publishedToDemandBatch } from "./api";

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
});
