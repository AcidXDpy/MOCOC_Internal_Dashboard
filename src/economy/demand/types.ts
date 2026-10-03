export const categories = [
  { id: "restaurants", name: "Restaurants", short: "Dining", color: "#15816e" },
  { id: "coffee", name: "Coffee & Cafes", short: "Coffee", color: "#a36b38" },
  { id: "fitness", name: "Gyms & Fitness", short: "Fitness", color: "#518bb0" },
  { id: "auto", name: "Auto Repair", short: "Auto repair", color: "#9466a0" },
  { id: "dentists", name: "Dentists", short: "Dentists", color: "#43869b" },
  {
    id: "home",
    name: "Home Improvement",
    short: "Home services",
    color: "#b16b21",
  },
  { id: "childcare", name: "Childcare", short: "Childcare", color: "#d05b48" },
  {
    id: "accounting",
    name: "Accounting",
    short: "Accounting",
    color: "#667c49",
  },
  { id: "beauty", name: "Hair & Beauty", short: "Beauty", color: "#a4567d" },
  {
    id: "real-estate",
    name: "Real Estate",
    short: "Real estate",
    color: "#577078",
  },
] as const;
export type CategoryId = (typeof categories)[number]["id"];
export type DemandPoint = { date: string; interest: number | null };
export type DemandSeries = {
  category: CategoryId;
  query: string;
  points: DemandPoint[];
};
export type DemandBatch = {
  id: string;
  name: string;
  geography: string;
  source: "demo" | "google-trends-csv" | "google-trends-api";
  importedAt: string | null;
  filename: string | null;
  comparable: boolean;
  demoSample: boolean;
  frequency: "Month" | "Week" | "Day" | "Date";
  warnings: string[];
  series: DemandSeries[];
  verification?: "demo" | "browser" | "verified-api";
  geographyDetail?: {
    label: string;
    level: "state" | "metro" | "county" | "other";
    code: string | null;
  };
  valueUnit?: "normalized-index-0-100" | "google-trends-api-scaled";
  provenance?: {
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
};
export type CategorySummary = {
  category: CategoryId;
  name: string;
  query: string;
  currentInterest: number | null;
  averageInterest: number | null;
  change3m: number | null;
  businessCount: number;
  supplyShare: number;
  demandGap: number | null;
  demandZ: number | null;
  supplyZ: number | null;
  signal: string;
  history: DemandPoint[];
  monthsObserved: number;
};
export type SortKey =
  "averageInterest" | "change3m" | "businessCount" | "demandGap";
export type DemandAnalysis = {
  rows: CategorySummary[];
  start: string;
  end: string;
  commonMonths: number;
  gapReason: string | null;
};
// Future providers must return an explicit geography and a verified comparison cohort.
export interface DemandProvider {
  load(): Promise<DemandBatch[]>;
}
