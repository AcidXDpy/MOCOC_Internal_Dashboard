import { describe, expect, it } from "vitest";
import {
  canonicalDataset,
  contentFingerprint,
  validatePublishRequest,
} from "./demand-contract";

const series = [
  {
    category: "restaurants",
    query: "restaurants",
    points: [
      { date: "2026-01-01", interest: 25 },
      { date: "2026-02-01", interest: 40 },
    ],
  },
  {
    category: "coffee",
    query: "coffee shops",
    points: [
      { date: "2026-01-01", interest: 80 },
      { date: "2026-02-01", interest: null },
    ],
  },
];

function validRequest() {
  return {
    name: "NJ local-services comparison",
    sourceType: "google-trends-csv",
    valueUnit: "normalized-index-0-100",
    frequency: "Month",
    geography: { label: "New Jersey", level: "state", code: "US-NJ" },
    comparison: { sharedScale: true, method: "single-export" },
    provenance: {
      sourceOrganization: "Google",
      sourceProduct: "Google Trends",
      sourceUrl:
        "https://trends.google.com/trends/explore?geo=US-NJ&q=restaurants,coffee",
      retrievedAt: "2026-10-03T14:00:00.000Z",
      originalFilename: "multiTimeline.csv",
      acquisitionMethod: "official-csv-export",
      notes: ["Exported from Interest over time."],
    },
    series,
  };
}

describe("verified demand publication contract", () => {
  it("accepts an official shared-scale CSV publication and strips server-owned fields", () => {
    const parsed = validatePublishRequest({
      ...validRequest(),
      id: "client-id",
      status: "verified",
      publishedAt: "2000-01-01T00:00:00.000Z",
      contentSha256: "client-hash",
    });
    expect(parsed.name).toBe("NJ local-services comparison");
    expect(parsed.series).toHaveLength(2);
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("publishedAt");
    expect(parsed).not.toHaveProperty("contentSha256");
  });

  it("rejects demo and undocumented acquisition methods", () => {
    expect(() =>
      validatePublishRequest({ ...validRequest(), demoSample: true }),
    ).toThrow("Demo data cannot be published as verified");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        provenance: {
          ...validRequest().provenance,
          acquisitionMethod: "scraped-internal-endpoint",
        },
      }),
    ).toThrow("Unsupported acquisition method");
  });

  it("rejects mixed geography, duplicate categories, invalid dates and out-of-range values", () => {
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        geography: [
          validRequest().geography,
          { label: "New York", level: "state", code: "US-NY" },
        ],
      }),
    ).toThrow("geography");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        series: [series[0], { ...series[1], category: "restaurants" }],
      }),
    ).toThrow("distinct category");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        series: [
          {
            ...series[0],
            points: [{ date: "2026-02-30", interest: 20 }],
          },
        ],
      }),
    ).toThrow("valid ISO date");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        series: [
          { ...series[0], points: [{ date: "2026-01-01", interest: 101 }] },
        ],
      }),
    ).toThrow("between 0 and 100");
  });

  it("rejects more than eight series, more than 10000 points, and payloads beyond 2 MB", () => {
    const categoryIds = [
      "restaurants",
      "coffee",
      "fitness",
      "auto",
      "dentists",
      "home",
      "childcare",
      "accounting",
      "beauty",
    ];
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        series: categoryIds.map((category) => ({
          category,
          query: category,
          points: [{ date: "2026-01-01", interest: 50 }],
        })),
      }),
    ).toThrow("one to eight series");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        series: [
          {
            ...series[0],
            points: Array.from({ length: 10001 }, (_, index) => ({
              date: new Date(Date.UTC(1990, 0, index + 1))
                .toISOString()
                .slice(0, 10),
              interest: 50,
            })),
          },
        ],
      }),
    ).toThrow("at most 10,000 observations");
    expect(() =>
      validatePublishRequest({
        ...validRequest(),
        provenance: {
          ...validRequest().provenance,
          notes: ["x".repeat(2_000_001)],
        },
      }),
    ).toThrow("2 MB");
  });

  it("produces the same SHA-256 for semantically identical canonical datasets", () => {
    const request = validatePublishRequest(validRequest());
    const first = canonicalDataset(request, {
      id: "demand-1",
      publishedAt: "2026-10-03T15:00:00.000Z",
    });
    const reordered = validatePublishRequest({
      ...validRequest(),
      series: [...series]
        .reverse()
        .map((item) => ({ ...item, points: [...item.points].reverse() })),
    });
    const second = canonicalDataset(reordered, {
      id: "demand-2",
      publishedAt: "2026-10-03T16:00:00.000Z",
    });
    expect(first.provenance.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(contentFingerprint(first)).toBe(contentFingerprint(second));
    expect(first.provenance.contentSha256).toBe(
      second.provenance.contentSha256,
    );
  });

  it("does not include admin credentials or private storage locations in the public contract", () => {
    const parsed = validatePublishRequest({
      ...validRequest(),
      adminToken: "top-secret",
      privateBlobUrl: "https://private.blob.vercel-storage.com/object",
      provenance: {
        ...validRequest().provenance,
        storageToken: "blob-secret",
      },
    });
    const dataset = canonicalDataset(parsed, {
      id: "demand-safe",
      publishedAt: "2026-10-03T15:00:00.000Z",
    });
    const publicJson = JSON.stringify(dataset);
    expect(publicJson).not.toContain("top-secret");
    expect(publicJson).not.toContain("blob-secret");
    expect(publicJson).not.toContain("private.blob.vercel-storage.com");
  });
});
