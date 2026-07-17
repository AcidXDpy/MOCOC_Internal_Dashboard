import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCensusCache,
  fetchCensusData,
  parseCensusResponse,
  validateCensusQuery,
} from "./census";

beforeEach(() => clearCensusCache());

describe("Census client", () => {
  it("parses tabular Census responses into records", () => {
    expect(
      parseCensusResponse([
        ["NAME", "B01003001E"],
        ["Mount Olive", "29149"],
      ]).rows[0],
    ).toEqual({ NAME: "Mount Olive", B01003001E: "29149" });
  });

  it("rejects unapproved geographies and malformed variables", () => {
    expect(() =>
      validateCensusQuery({
        dataset: "acs5Profile",
        variables: ["B01001;DROP"],
        geography: "mount-olive",
      }),
    ).toThrow("Invalid Census variable");
  });

  it("retries transient failures, redacts the key, and caches successful results", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          ["NAME", "B01003001E"],
          ["Mount Olive", "29149"],
        ],
      });
    const query = {
      dataset: "acs5Profile" as const,
      variables: ["B01003001E"],
      geography: "mount-olive" as const,
    };
    const first = await fetchCensusData(query, {
      apiKey: "secret-key",
      fetcher: fetcher as typeof fetch,
      now: () => 1000,
    });
    const second = await fetchCensusData(query, {
      apiKey: "secret-key",
      fetcher: fetcher as typeof fetch,
      now: () => 1001,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.cache).toBe("miss");
    expect(second.cache).toBe("hit");
    expect(first.provenance.normalizedQuery).not.toContain("secret-key");
  });
});
