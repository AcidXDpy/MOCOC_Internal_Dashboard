export const censusDatasetConfig = {
  acs5Profile: { slug: "acs/acs5/profile", year: 2024 },
  acs5Detailed: { slug: "acs/acs5", year: 2024 },
  countyBusinessPatterns: { slug: "cbp", year: 2023 },
} as const;

export type CensusDatasetKey = keyof typeof censusDatasetConfig;

export interface CensusQuery {
  dataset: CensusDatasetKey;
  year?: number;
  variables: string[];
  geography: "mount-olive" | "morris-county" | "zcta-07828" | "zcta-07836";
}

export interface CensusResult {
  columns: string[];
  rows: Record<string, string>[];
  provenance: {
    sourceOrganization: "U.S. Census Bureau";
    dataset: CensusDatasetKey;
    datasetYear: number;
    geography: string;
    variables: string[];
    retrievedAt: string;
    requestId: string;
    normalizedQuery: string;
  };
  cache: "hit" | "miss";
}

type FetchLike = typeof fetch;
type CacheEntry = { expiresAt: number; value: Omit<CensusResult, "cache"> };

const responseCache = new Map<string, CacheEntry>();
const allowedYears = new Set([2023, 2024]);
const geographyConfig = {
  "mount-olive": {
    forValue: "county subdivision:49080",
    inValue: "state:34 county:027",
  },
  "morris-county": { forValue: "county:027", inValue: "state:34" },
  "zcta-07828": {
    forValue: "zip code tabulation area:07828",
    inValue: "state:34",
  },
  "zcta-07836": {
    forValue: "zip code tabulation area:07836",
    inValue: "state:34",
  },
} as const;

export function validateCensusQuery(query: CensusQuery) {
  if (!(query.dataset in censusDatasetConfig))
    throw new Error("Unsupported Census dataset");
  const year = query.year ?? censusDatasetConfig[query.dataset].year;
  if (!allowedYears.has(year))
    throw new Error("Unsupported Census dataset year");
  if (!(query.geography in geographyConfig))
    throw new Error("Unsupported geography");
  if (!query.variables.length || query.variables.length > 40)
    throw new Error("Request between 1 and 40 Census variables");
  if (query.variables.some((variable) => !/^[A-Z0-9_-]+$/.test(variable)))
    throw new Error("Invalid Census variable");
  return {
    ...query,
    year,
    variables: [
      ...new Set([
        "NAME",
        ...query.variables.filter((variable) => variable !== "NAME"),
      ]),
    ].sort(),
  };
}

export function parseCensusResponse(payload: unknown) {
  if (
    !Array.isArray(payload) ||
    payload.length < 2 ||
    !Array.isArray(payload[0])
  )
    throw new Error("Unexpected Census API response");
  const columns = payload[0].map(String);
  const rows = payload.slice(1).map((row) => {
    if (!Array.isArray(row) || row.length !== columns.length)
      throw new Error("Malformed Census API row");
    return Object.fromEntries(
      columns.map((column, index) => [column, String(row[index] ?? "")]),
    ) as Record<string, string>;
  });
  return { columns, rows };
}

function buildRequestUrl(
  query: ReturnType<typeof validateCensusQuery>,
  apiKey: string,
) {
  const dataset = censusDatasetConfig[query.dataset];
  const geography = geographyConfig[query.geography];
  const url = new URL(
    `https://api.census.gov/data/${query.year}/${dataset.slug}`,
  );
  url.searchParams.set("get", query.variables.join(","));
  url.searchParams.set("for", geography.forValue);
  url.searchParams.set("in", geography.inValue);
  url.searchParams.set("key", apiKey);
  return url;
}

async function requestWithRetry(
  url: URL,
  fetcher: FetchLike,
  timeoutMs: number,
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (response.ok) return response.json();
      if (response.status !== 429 && response.status < 500)
        throw new Error(`Census API returned ${response.status}`);
      lastError = new Error(
        `Census API temporarily unavailable (${response.status})`,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Census API request failed");
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError ?? new Error("Census API request failed");
}

export async function fetchCensusData(
  rawQuery: CensusQuery,
  options: {
    apiKey?: string;
    fetcher?: FetchLike;
    now?: () => number;
    timeoutMs?: number;
    cacheTtlMs?: number;
  } = {},
): Promise<CensusResult> {
  const query = validateCensusQuery(rawQuery);
  const apiKey = options.apiKey ?? process.env.CENSUS_API_KEY;
  if (!apiKey) throw new Error("CENSUS_API_KEY is not configured");
  const now = options.now ?? Date.now;
  const cacheKey = JSON.stringify(query);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now())
    return { ...cached.value, cache: "hit" };

  const requestUrl = buildRequestUrl(query, apiKey);
  const payload = await requestWithRetry(
    requestUrl,
    options.fetcher ?? fetch,
    options.timeoutMs ?? Number(process.env.CENSUS_REQUEST_TIMEOUT_MS ?? 8000),
  );
  const parsed = parseCensusResponse(payload);
  const normalizedQuery = requestUrl.toString().replace(apiKey, "[redacted]");
  const value: Omit<CensusResult, "cache"> = {
    ...parsed,
    provenance: {
      sourceOrganization: "U.S. Census Bureau",
      dataset: query.dataset,
      datasetYear: query.year,
      geography: query.geography,
      variables: query.variables,
      retrievedAt: new Date(now()).toISOString(),
      requestId: `census-${simpleHash(normalizedQuery)}`,
      normalizedQuery,
    },
  };
  responseCache.set(cacheKey, {
    expiresAt:
      now() +
      (options.cacheTtlMs ??
        Number(process.env.CENSUS_CACHE_TTL_SECONDS ?? 604800) * 1000),
    value,
  });
  return { ...value, cache: "miss" };
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

export function clearCensusCache() {
  responseCache.clear();
}
