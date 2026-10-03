import { members } from "../../data/members";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import boundary from "./township-boundary.json";
import type { CategoryId } from "./types";

export function normalizeCategory(
  industry: string,
  name: string,
): CategoryId | null {
  const raw = `${industry} ${name}`.toLowerCase();
  if (/\b(coffee|cafe|cafes|café|espresso)\b/.test(raw)) return "coffee";
  if (
    /\b(restaurant|restaurants|dining|pizzeria|pizza|diner|grill|steakhouse)\b/.test(
      raw,
    )
  )
    return "restaurants";
  if (/\b(dentist|dentists|dental|orthodontics)\b/.test(raw)) return "dentists";
  if (/\b(gym|fitness|yoga|pilates|athletic club)\b/.test(raw))
    return "fitness";
  if (/\b(childcare|child care|daycare|day care|preschool)\b/.test(raw))
    return "childcare";
  if (/\b(accounting|bookkeeping|cpa|cpas|tax preparation)\b/.test(raw))
    return "accounting";
  if (/\b(hair|beauty|salon|barber|nails)\b/.test(raw)) return "beauty";
  if (
    /\b(auto repair|automotive repair|auto service|tire|tires|collision)\b/.test(
      raw,
    )
  )
    return "auto";
  if (
    /\b(home improvement|landscaping|plumbing|roofing|electrician|pest control|hvac)\b/.test(
      raw,
    )
  )
    return "home";
  if (/\b(real estate|realtor|realty)\b/.test(raw)) return "real-estate";
  return null;
}
export function inTownship(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    booleanPointInPolygon(
      [longitude, latitude],
      boundary.feature as Feature<Polygon | MultiPolygon>,
    )
  );
}
export const boundaryMatched = members.filter(
  (m) =>
    m.data_source === "public_directory" && inTownship(m.latitude, m.longitude),
);
export const localSupply = boundaryMatched.flatMap((m) => {
  const category = normalizeCategory(m.industry, m.business_name);
  return category
    ? [
        {
          member_id: m.member_id,
          business_name: m.business_name,
          industry: m.industry,
          category,
          address: m.address,
          city: m.city,
          latitude: m.latitude,
          longitude: m.longitude,
          source_url: m.source_url,
          data_source: m.data_source,
        },
      ]
    : [];
});
export type SupplyListing = (typeof localSupply)[number];
export const supplyNote = `Public directory snapshot: July 16, 2026. ${boundaryMatched.length} listings have coordinates inside the Census TIGER 2024 township boundary; ${localSupply.length} map to these categories; ${boundaryMatched.length - localSupply.length} are unclassified/outside this taxonomy. Directory coordinates are not independently verified. Missing/outside coordinates are excluded. Not a complete business census.`;
