import { describe, expect, it } from "vitest";
import { validateCliInputs } from "./publish-demand";

describe("demand publishing CLI", () => {
  it("CLI requires source URL, exact geography, retrieval time and original file hash", () => {
    const complete = {
      sourceUrl: "https://trends.google.com/trends/explore?geo=US-NJ",
      geography: { label: "New Jersey", level: "state", code: "US-NJ" },
      retrievedAt: "2026-10-03T14:00:00.000Z",
      originalFileSha256: "a".repeat(64),
    };
    expect(() =>
      validateCliInputs(
        {
          file: "dataset.json",
          metadata: "metadata.json",
          endpoint: "https://example.com/api/demand",
        },
        complete,
        "admin-token",
      ),
    ).not.toThrow();
    for (const key of [
      "sourceUrl",
      "geography",
      "retrievedAt",
      "originalFileSha256",
    ] as const) {
      expect(() =>
        validateCliInputs(
          {
            file: "dataset.json",
            metadata: "metadata.json",
            endpoint: "https://example.com/api/demand",
          },
          { ...complete, [key]: undefined },
          "admin-token",
        ),
      ).toThrow();
    }
    expect(() =>
      validateCliInputs(
        {
          file: "dataset.json",
          metadata: "metadata.json",
          endpoint: "https://example.com/api/demand",
        },
        complete,
        "",
      ),
    ).toThrow("DEMAND_ADMIN_TOKEN");
  });
});
