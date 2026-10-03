export type GeoId = "mount-olive" | "morris" | "new-jersey";
export type PulseUnit =
  "people" | "jobs" | "establishments" | "USD" | "percent";
export type Observation = {
  geographyId: GeoId;
  year: number;
  periodStart: string;
  periodEnd: string;
  value: number | null;
  moe: number | null;
  status: "observed" | "missing" | "suppressed" | "not_available";
  sourceIds: string[];
  flags: string[];
  inputs: Record<string, unknown>;
};
export type PulseDataset = {
  id: string;
  label: string;
  unit: PulseUnit;
  universe: string;
  group: "residents" | "industry" | "business";
  kind: "published" | "derived";
  frequency: "five-year estimate" | "annual";
  variables: string[];
  denominator: string | null;
  formula: string;
  notes: string[];
  observations: Observation[];
};
export type PulseSource = {
  id: string;
  name: string;
  url: string;
  retrievedAt: string;
  releaseDate: string | null;
  sha256: string;
  observationStart: string;
  observationEnd: string;
  notes: string[];
};
export type PulseBundle = {
  schemaVersion: "pulse/1";
  builtAt: string;
  coverage: string;
  geographies: { id: GeoId; name: string; geoid: string; level: string }[];
  sources: PulseSource[];
  datasets: PulseDataset[];
  issues: {
    sourceId?: string;
    source?: string;
    url?: string;
    message?: string;
    error?: string;
  }[];
};
export type DisplayMode = "published" | "index";

export function parsePulse(input: unknown): PulseBundle {
  const fail = (): never => {
    throw new Error(
      "The Local Economic Pulse dataset has an unsupported or invalid format.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const b = input as PulseBundle;
  if (
    b.schemaVersion !== "pulse/1" ||
    typeof b.builtAt !== "string" ||
    typeof b.coverage !== "string" ||
    !Array.isArray(b.sources) ||
    !Array.isArray(b.datasets) ||
    !Array.isArray(b.geographies) ||
    !Array.isArray(b.issues)
  )
    return fail();
  const geos = new Set(b.geographies.map((g) => g?.id));
  if (
    geos.size !== 3 ||
    !["mount-olive", "morris", "new-jersey"].every((id) =>
      geos.has(id as GeoId),
    ) ||
    b.geographies.some(
      (g) => typeof g.name !== "string" || typeof g.geoid !== "string",
    )
  )
    return fail();
  const sources = new Set(b.sources.map((s) => s?.id));
  if (
    sources.size !== b.sources.length ||
    b.sources.some(
      (s) =>
        typeof s.id !== "string" ||
        typeof s.name !== "string" ||
        typeof s.url !== "string" ||
        !s.url.startsWith("https://") ||
        typeof s.retrievedAt !== "string" ||
        !Array.isArray(s.notes),
    )
  )
    return fail();
  const ids = new Set<string>();
  for (const d of b.datasets) {
    if (
      !d ||
      typeof d.id !== "string" ||
      ids.has(d.id) ||
      typeof d.label !== "string" ||
      typeof d.universe !== "string" ||
      !["people", "jobs", "establishments", "USD", "percent"].includes(
        d.unit,
      ) ||
      !["residents", "industry", "business"].includes(d.group) ||
      !["published", "derived"].includes(d.kind) ||
      !["annual", "five-year estimate"].includes(d.frequency) ||
      !Array.isArray(d.notes) ||
      !Array.isArray(d.variables) ||
      typeof d.formula !== "string" ||
      !Array.isArray(d.observations)
    )
      return fail();
    ids.add(d.id);
    const keys = new Set<string>();
    for (const o of d.observations) {
      if (!o) return fail();
      const key = `${o.geographyId}:${o.year}`;
      if (
        keys.has(key) ||
        !geos.has(o.geographyId) ||
        !Number.isInteger(o.year) ||
        !["observed", "missing", "suppressed", "not_available"].includes(
          o.status,
        ) ||
        !Array.isArray(o.sourceIds) ||
        !Array.isArray(o.flags) ||
        typeof o.periodStart !== "string" ||
        typeof o.periodEnd !== "string" ||
        o.periodEnd < o.periodStart
      )
        return fail();
      keys.add(key);
      if (
        o.status === "observed"
          ? o.value === null ||
            !Number.isFinite(o.value) ||
            o.value < 0 ||
            o.sourceIds.length === 0 ||
            o.sourceIds.some((s) => !sources.has(s))
          : o.value !== null
      )
        return fail();
      if (o.moe !== null && (!Number.isFinite(o.moe) || o.moe < 0))
        return fail();
    }
  }
  if (
    ![
      "population",
      "household-income",
      "per-capita-income",
      "employment-rate",
      "unemployment",
      "earnings",
      "resident-employment",
      "establishments",
      "workplace-employment",
      "annual-payroll",
    ].every((id) => ids.has(id))
  )
    return fail();
  return b;
}
