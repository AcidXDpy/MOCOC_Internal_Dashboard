import { fetchCensusData, type CensusDatasetKey } from "./_lib/census";

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(value: unknown): void;
  setHeader(name: string, value: string): void;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  response.setHeader(
    "Cache-Control",
    "s-maxage=86400, stale-while-revalidate=604800",
  );
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed" });
  try {
    const variables = (first(request.query.variables) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const result = await fetchCensusData({
      dataset: (first(request.query.dataset) ??
        "acs5Profile") as CensusDatasetKey,
      year: first(request.query.year)
        ? Number(first(request.query.year))
        : undefined,
      geography: (first(request.query.geography) ??
        "mount-olive") as "mount-olive",
      variables,
    });
    return response.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Census request failed";
    const status = message.includes("configured") ? 503 : 400;
    return response
      .status(status)
      .json({ error: message, staleDataAvailable: true });
  }
}
