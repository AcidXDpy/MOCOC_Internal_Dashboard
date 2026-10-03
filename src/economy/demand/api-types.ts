import type { DemandSeries } from "./types";

export type DemandSourceType = "google-trends-csv" | "google-trends-api";
export type DemandValueUnit =
  "normalized-index-0-100" | "google-trends-api-scaled";
export type DemandFrequency = "Month" | "Week" | "Day" | "Date";

export type DemandGeography = {
  label: string;
  level: "state" | "metro" | "county" | "other";
  code: string | null;
};

export type DemandComparison = {
  sharedScale: boolean;
  method: "single-export" | "official-api";
};

export type DemandProvenance = {
  sourceOrganization: "Google";
  sourceProduct: "Google Trends";
  sourceUrl: string;
  retrievedAt: string;
  publishedAt: string;
  originalFilename: string | null;
  contentSha256: string;
  acquisitionMethod: "official-csv-export" | "official-api";
  notes: string[];
};

export type DemandPublishRequest = {
  name: string;
  sourceType: DemandSourceType;
  valueUnit: DemandValueUnit;
  frequency: DemandFrequency;
  geography: DemandGeography;
  comparison: DemandComparison;
  provenance: Omit<DemandProvenance, "publishedAt" | "contentSha256">;
  series: DemandSeries[];
};

export type PublishedDemandDataset = Omit<
  DemandPublishRequest,
  "provenance"
> & {
  id: string;
  schemaVersion: "1.0";
  status: "verified";
  provenance: DemandProvenance;
};

export type DemandAdminEvent = {
  id: string;
  type: "activate" | "supersede" | "archive";
  datasetId: string;
  occurredAt: string;
  expectedActiveDatasetId?: string | null;
};

export type DemandApiEnvelope = {
  schemaVersion: "1.0";
  generatedAt: string;
  activeDatasetId: string | null;
  datasets: PublishedDemandDataset[];
  warnings: string[];
};

export type DemandApiErrorCode =
  | "UNAUTHORIZED"
  | "NOT_CONFIGURED"
  | "INVALID_DATASET"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "STORAGE_FAILURE";

export type DemandApiError = {
  error: {
    code: DemandApiErrorCode;
    message: string;
    requestId: string;
  };
};
