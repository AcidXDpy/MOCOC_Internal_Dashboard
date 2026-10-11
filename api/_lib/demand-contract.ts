import { createHash } from "node:crypto";
import {
  categories,
  type CategoryId,
  type DemandSeries,
} from "../../src/economy/demand/types";
import type {
  DemandComparison,
  DemandFrequency,
  DemandGeography,
  DemandPublishRequest,
  DemandSourceType,
  DemandValueUnit,
  PublishedDemandDataset,
} from "../../src/economy/demand/api-types";

const MAX_BODY_BYTES = 2_000_000;
const categoryIds = new Set<string>(categories.map((category) => category.id));

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength)
    throw new Error(`${label} is invalid`);
  return value.trim();
}

function isoInstant(value: unknown, label: string) {
  const parsed = text(value, label, 40);
  const date = new Date(parsed);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed)
    throw new Error(`${label} must be an ISO timestamp`);
  return parsed;
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Each observation must use a valid ISO date");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Each observation must use a valid ISO date");
  return value;
}

function parseGeography(value: unknown): DemandGeography {
  const input = record(value, "geography");
  const level = input.level;
  if (!new Set(["state", "metro", "county", "other"]).has(String(level)))
    throw new Error("geography level is invalid");
  const code = input.code;
  if (code !== null && (typeof code !== "string" || code.length > 40))
    throw new Error("geography code is invalid");
  return {
    label: text(input.label, "geography label", 120),
    level: level as DemandGeography["level"],
    code: code === null ? null : code.trim(),
  };
}

function parseSeries(value: unknown): DemandSeries[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8)
    throw new Error("Publish one to eight series");
  const seenCategories = new Set<string>();
  return value.map((raw, seriesIndex) => {
    const input = record(raw, `series ${seriesIndex + 1}`);
    if (typeof input.category !== "string" || !categoryIds.has(input.category))
      throw new Error(`Series ${seriesIndex + 1} has an unsupported category`);
    const category = input.category as CategoryId;
    if (seenCategories.has(category))
      throw new Error("Each series must map to a distinct category");
    seenCategories.add(category);
    if (
      !Array.isArray(input.points) ||
      input.points.length < 1 ||
      input.points.length > 10_000
    )
      throw new Error("Each series must contain at most 10,000 observations");
    const dates = new Set<string>();
    const points = input.points.map((rawPoint) => {
      const point = record(rawPoint, "observation");
      const date = isoDate(point.date);
      if (dates.has(date))
        throw new Error(`Duplicate observation date: ${date}`);
      dates.add(date);
      const interest = point.interest;
      if (
        interest !== null &&
        (typeof interest !== "number" ||
          !Number.isFinite(interest) ||
          interest < 0 ||
          interest > 100)
      )
        throw new Error("Interest must be between 0 and 100 or missing");
      return { date, interest };
    });
    return {
      category,
      query: text(input.query, "query", 150),
      points,
    };
  });
}

export function validatePublishRequest(value: unknown): DemandPublishRequest {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Dataset must be valid JSON");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES)
    throw new Error("Dataset exceeds the 2 MB limit");
  const input = record(value, "dataset");
  if (input.demoSample === true)
    throw new Error("Demo data cannot be published as verified");

  const sourceType = input.sourceType;
  if (
    !new Set(["google-trends-csv", "google-trends-api"]).has(String(sourceType))
  )
    throw new Error("Unsupported source type");
  const valueUnit = input.valueUnit;
  if (
    !new Set(["normalized-index-0-100", "google-trends-api-scaled"]).has(
      String(valueUnit),
    )
  )
    throw new Error("Unsupported value unit");
  const frequency = input.frequency;
  if (!new Set(["Month", "Week", "Day", "Date"]).has(String(frequency)))
    throw new Error("Unsupported observation frequency");

  const comparisonInput = record(input.comparison, "comparison");
  const method = comparisonInput.method;
  if (!new Set(["single-export", "official-api"]).has(String(method)))
    throw new Error("Unsupported comparison method");
  if (typeof comparisonInput.sharedScale !== "boolean")
    throw new Error("comparison sharedScale must be explicit");
  const comparison: DemandComparison = {
    sharedScale: comparisonInput.sharedScale,
    method: method as DemandComparison["method"],
  };

  const provenanceInput = record(input.provenance, "provenance");
  const acquisitionMethod = provenanceInput.acquisitionMethod;
  if (
    !new Set(["official-csv-export", "official-api"]).has(
      String(acquisitionMethod),
    )
  )
    throw new Error("Unsupported acquisition method");
  if (
    (sourceType === "google-trends-csv" &&
      acquisitionMethod !== "official-csv-export") ||
    (sourceType === "google-trends-api" && acquisitionMethod !== "official-api")
  )
    throw new Error("Source type and acquisition method do not match");
  if (
    (sourceType === "google-trends-csv" &&
      valueUnit !== "normalized-index-0-100") ||
    (sourceType === "google-trends-api" &&
      valueUnit !== "google-trends-api-scaled")
  )
    throw new Error("Source type and value unit do not match");
  const sourceUrl = text(provenanceInput.sourceUrl, "source URL", 2_000);
  let source: URL;
  try {
    source = new URL(sourceUrl);
  } catch {
    throw new Error("source URL is invalid");
  }
  if (
    source.protocol !== "https:" ||
    !/(^|\.)google\.com$/.test(source.hostname)
  )
    throw new Error("source URL must be an official Google HTTPS URL");
  const notesInput = provenanceInput.notes;
  if (
    !Array.isArray(notesInput) ||
    notesInput.length > 20 ||
    !notesInput.every((note) => typeof note === "string" && note.length <= 500)
  )
    throw new Error("provenance notes are invalid");
  const originalFilename = provenanceInput.originalFilename;
  if (
    originalFilename !== null &&
    (typeof originalFilename !== "string" || originalFilename.length > 255)
  )
    throw new Error("original filename is invalid");

  const parsedSeries = parseSeries(input.series);
  if (parsedSeries.length > 1 && !comparison.sharedScale)
    throw new Error("Multi-series publications require one shared scale");

  return {
    name: text(input.name, "dataset name", 120),
    sourceType: sourceType as DemandSourceType,
    valueUnit: valueUnit as DemandValueUnit,
    frequency: frequency as DemandFrequency,
    geography: parseGeography(input.geography),
    comparison,
    provenance: {
      sourceOrganization: "Google",
      sourceProduct: "Google Trends",
      sourceUrl: source.toString(),
      retrievedAt: isoInstant(provenanceInput.retrievedAt, "retrievedAt"),
      originalFilename:
        originalFilename === null ? null : originalFilename.trim(),
      acquisitionMethod: acquisitionMethod as
        "official-csv-export" | "official-api",
      notes: notesInput.map((note) => note.trim()),
    },
    series: parsedSeries,
  };
}

function semanticDataset(dataset: PublishedDemandDataset) {
  return {
    schemaVersion: dataset.schemaVersion,
    name: dataset.name,
    sourceType: dataset.sourceType,
    valueUnit: dataset.valueUnit,
    frequency: dataset.frequency,
    geography: dataset.geography,
    comparison: dataset.comparison,
    provenance: {
      sourceOrganization: dataset.provenance.sourceOrganization,
      sourceProduct: dataset.provenance.sourceProduct,
      sourceUrl: dataset.provenance.sourceUrl,
      retrievedAt: dataset.provenance.retrievedAt,
      originalFilename: dataset.provenance.originalFilename,
      acquisitionMethod: dataset.provenance.acquisitionMethod,
      notes: dataset.provenance.notes,
    },
    series: dataset.series,
  };
}

export function contentFingerprint(dataset: PublishedDemandDataset) {
  return createHash("sha256")
    .update(JSON.stringify(semanticDataset(dataset)))
    .digest("hex");
}

export function canonicalDataset(
  request: DemandPublishRequest,
  serverFields: { id: string; publishedAt: string },
): PublishedDemandDataset {
  const dataset: PublishedDemandDataset = {
    id: serverFields.id,
    schemaVersion: "1.0",
    status: "verified",
    name: request.name,
    sourceType: request.sourceType,
    valueUnit: request.valueUnit,
    frequency: request.frequency,
    geography: request.geography,
    comparison: request.comparison,
    provenance: {
      ...request.provenance,
      publishedAt: serverFields.publishedAt,
      contentSha256: "",
    },
    series: [...request.series]
      .sort((a, b) => a.category.localeCompare(b.category))
      .map((series) => ({
        ...series,
        points: [...series.points].sort((a, b) => a.date.localeCompare(b.date)),
      })),
  };
  dataset.provenance.contentSha256 = contentFingerprint(dataset);
  return dataset;
}
