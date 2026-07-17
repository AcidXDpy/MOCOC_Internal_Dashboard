import type { EvidenceMetric, ZipIndustryMetric } from "../intelligence/types";
import {
  coefficientOfVariation,
  derivePercentage,
  gradeConfidence,
} from "../intelligence/statistics";

export const ECONOMIC_DATA_RETRIEVED_AT = "2026-07-17";

export const localDemographics = {
  geography: "Mount Olive township, Morris County, NJ",
  source:
    "ACS 2024 5-year via Census Reporter; original data from the U.S. Census Bureau",
  sourceUrl:
    "https://censusreporter.org/profiles/06000US3402749080-mount-olive-township-morris-county-nj/",
  metrics: [
    {
      label: "Population",
      value: 29149,
      formatted: "29,149",
      detail: "ACS 2024 5-year estimate",
    },
    {
      label: "Median household income",
      value: 117394,
      formatted: "$117,394",
      detail: "Compared with Morris County at $137,326",
    },
    {
      label: "Per capita income",
      value: 59099,
      formatted: "$59,099",
      detail: "Compared with New Jersey at $54,253",
    },
    {
      label: "Bachelor's degree or higher",
      value: 48.8,
      formatted: "48.8%",
      detail: "Adult educational attainment",
    },
    { label: "Median age", value: 39.8, formatted: "39.8", detail: "Years" },
    {
      label: "Mean commute",
      value: 31.7,
      formatted: "31.7 min",
      detail: "Mean travel time to work",
    },
    {
      label: "Poverty rate",
      value: 4.4,
      formatted: "4.4%",
      detail: "Persons below poverty line",
    },
    {
      label: "Foreign-born population",
      value: 21.6,
      formatted: "21.6%",
      detail: "Share of residents",
    },
  ],
};

const acsQueryUrl =
  "https://api.censusreporter.org/1.0/data/show/latest?table_ids=B01003%2CB01002%2CB19013%2CB19301%2CB15003%2CB17001%2CB05002%2CB11005%2CB25003%2CB28002%2CB08013%2CB08006&geo_ids=06000US3402749080%2C05000US34027";

function directMetric(
  input: Omit<
    EvidenceMetric,
    "coefficientOfVariation" | "confidence" | "provenance"
  > & { table: string; variables: string[]; transformation?: string },
): EvidenceMetric {
  const confidence = gradeConfidence(input.estimate, input.marginOfError);
  return {
    ...input,
    coefficientOfVariation: coefficientOfVariation(
      input.estimate,
      input.marginOfError,
    ),
    confidence,
    provenance: {
      sourceOrganization: "U.S. Census Bureau",
      dataset: "ACS 2024 5-year detailed tables",
      datasetYear: 2024,
      table: input.table,
      variables: input.variables,
      geography: "Mount Olive township, Morris County, NJ",
      geographyId: "06000US3402749080",
      retrievedAt: ECONOMIC_DATA_RETRIEVED_AT,
      queryUrl: acsQueryUrl,
      transformation: input.transformation ?? "Direct estimate",
      direct: !input.transformation,
      qualityFlags:
        confidence === "Insufficient data" ? ["unstable_estimate"] : [],
    },
  };
}

function percentageMetric(input: {
  id: string;
  label: string;
  description: string;
  numerator: number;
  numeratorMoe: number;
  denominator: number;
  denominatorMoe: number;
  comparisonNumerator: number;
  comparisonNumeratorMoe: number;
  comparisonDenominator: number;
  comparisonDenominatorMoe: number;
  table: string;
  variables: string[];
}) {
  const local = derivePercentage(
    input.numerator,
    input.numeratorMoe,
    input.denominator,
    input.denominatorMoe,
  );
  const comparison = derivePercentage(
    input.comparisonNumerator,
    input.comparisonNumeratorMoe,
    input.comparisonDenominator,
    input.comparisonDenominatorMoe,
  );
  return directMetric({
    id: input.id,
    label: input.label,
    description: input.description,
    estimate: local.estimate,
    formatted: `${local.estimate.toFixed(1)}%`,
    unit: "percent",
    marginOfError: local.marginOfError,
    comparisonEstimate: comparison.estimate,
    comparisonFormatted: `${comparison.estimate.toFixed(1)}%`,
    comparisonGeography: "Morris County, NJ",
    table: input.table,
    variables: input.variables,
    transformation:
      "Percentage derived from numerator and denominator estimates; margin of error uses the ACS subset-ratio approximation",
  });
}

export const acsEvidence: EvidenceMetric[] = [
  directMetric({
    id: "acs.population",
    label: "Population",
    description: "Estimated residents in Mount Olive township.",
    estimate: 29149,
    formatted: "29,149",
    unit: "count",
    marginOfError: 54,
    comparisonEstimate: 514528,
    comparisonFormatted: "514,528",
    comparisonGeography: "Morris County, NJ",
    table: "B01003",
    variables: ["B01003001"],
  }),
  directMetric({
    id: "acs.median_household_income",
    label: "Median household income",
    description:
      "Middle household income in 2024 inflation-adjusted dollars; a purchasing-capacity proxy, not household spending.",
    estimate: 117394,
    formatted: "$117,394",
    unit: "currency",
    marginOfError: 14409,
    comparisonEstimate: 137326,
    comparisonFormatted: "$137,326",
    comparisonGeography: "Morris County, NJ",
    table: "B19013",
    variables: ["B19013001"],
  }),
  directMetric({
    id: "acs.per_capita_income",
    label: "Per-capita income",
    description:
      "Aggregate personal income divided by population in 2024 inflation-adjusted dollars.",
    estimate: 59099,
    formatted: "$59,099",
    unit: "currency",
    marginOfError: 4361,
    comparisonEstimate: 71044,
    comparisonFormatted: "$71,044",
    comparisonGeography: "Morris County, NJ",
    table: "B19301",
    variables: ["B19301001"],
  }),
  percentageMetric({
    id: "acs.households_with_children",
    label: "Households with people under 18",
    description:
      "Share of households that include one or more people under age 18.",
    numerator: 3853,
    numeratorMoe: 348,
    denominator: 11197,
    denominatorMoe: 353,
    comparisonNumerator: 60271,
    comparisonNumeratorMoe: 1222,
    comparisonDenominator: 193245,
    comparisonDenominatorMoe: 705,
    table: "B11005",
    variables: ["B11005002", "B11005001"],
  }),
  percentageMetric({
    id: "acs.owner_occupied",
    label: "Owner-occupied housing",
    description: "Share of occupied homes that are owner occupied.",
    numerator: 6821,
    numeratorMoe: 418,
    denominator: 11197,
    denominatorMoe: 353,
    comparisonNumerator: 143562,
    comparisonNumeratorMoe: 1613,
    comparisonDenominator: 193245,
    comparisonDenominatorMoe: 705,
    table: "B25003",
    variables: ["B25003002", "B25003001"],
  }),
  percentageMetric({
    id: "acs.broadband",
    label: "Households with broadband",
    description:
      "Share of households reporting a broadband subscription of any type.",
    numerator: 10375,
    numeratorMoe: 474,
    denominator: 11197,
    denominatorMoe: 353,
    comparisonNumerator: 184044,
    comparisonNumeratorMoe: 880,
    comparisonDenominator: 193245,
    comparisonDenominatorMoe: 705,
    table: "B28002",
    variables: ["B28002004", "B28002001"],
  }),
  percentageMetric({
    id: "acs.bachelors_or_higher",
    label: "Bachelor's degree or higher",
    description:
      "Share of residents age 25 and older with a bachelor's, graduate, professional, or doctorate degree.",
    numerator: 10143,
    numeratorMoe: 885,
    denominator: 20770,
    denominatorMoe: 534,
    comparisonNumerator: 211897,
    comparisonNumeratorMoe: 3258,
    comparisonDenominator: 366541,
    comparisonDenominatorMoe: 50,
    table: "B15003",
    variables: [
      "B15003022",
      "B15003023",
      "B15003024",
      "B15003025",
      "B15003001",
    ],
  }),
  percentageMetric({
    id: "acs.foreign_born",
    label: "Foreign-born population",
    description:
      "Share of residents born outside the United States who were not U.S. citizens at birth.",
    numerator: 6301,
    numeratorMoe: 828,
    denominator: 29149,
    denominatorMoe: 54,
    comparisonNumerator: 101789,
    comparisonNumeratorMoe: 2406,
    comparisonDenominator: 514528,
    comparisonDenominatorMoe: 0,
    table: "B05002",
    variables: ["B05002013", "B05002001"],
  }),
  percentageMetric({
    id: "acs.poverty",
    label: "Population below poverty level",
    description:
      "Share of residents for whom poverty status is determined who are below the federal poverty threshold.",
    numerator: 1267,
    numeratorMoe: 409,
    denominator: 29149,
    denominatorMoe: 54,
    comparisonNumerator: 24928,
    comparisonNumeratorMoe: 2028,
    comparisonDenominator: 506944,
    comparisonDenominatorMoe: 359,
    table: "B17001",
    variables: ["B17001002", "B17001001"],
  }),
];

const zbpSectorLabels: Record<string, string> = {
  "23": "Construction",
  "31": "Manufacturing",
  "42": "Wholesale trade",
  "44": "Retail trade",
  "48": "Transportation and warehousing",
  "51": "Information",
  "52": "Finance and insurance",
  "53": "Real estate and rental and leasing",
  "54": "Professional, scientific, and technical services",
  "55": "Management of companies",
  "56": "Administrative/support and waste services",
  "61": "Educational services",
  "62": "Health care and social assistance",
  "71": "Arts, entertainment, and recreation",
  "72": "Accommodation and food services",
  "81": "Other services",
};

const zbpSnapshots = {
  "07828": {
    name: "Budd Lake, NJ",
    total: 275,
    population: 15461,
    sectors: {
      "23": 26,
      "31": 11,
      "42": 16,
      "44": 35,
      "48": 15,
      "51": 4,
      "52": 5,
      "53": 10,
      "54": 41,
      "55": 3,
      "56": 13,
      "62": 30,
      "71": 3,
      "72": 30,
      "81": 29,
    },
  },
  "07836": {
    name: "Flanders, NJ",
    total: 352,
    population: 11694,
    sectors: {
      "23": 44,
      "31": 18,
      "42": 32,
      "44": 44,
      "48": 6,
      "51": 11,
      "52": 14,
      "53": 7,
      "54": 31,
      "56": 27,
      "61": 9,
      "62": 41,
      "71": 6,
      "72": 30,
      "81": 31,
    },
  },
} as const;

export const zipBusinessPatterns: ZipIndustryMetric[] = Object.entries(
  zbpSnapshots,
).flatMap(([zipCode, snapshot]) =>
  Object.entries(snapshot.sectors).map(([sectorCode, establishments]) => ({
    zipCode,
    zipName: snapshot.name,
    sectorCode,
    sectorLabel: zbpSectorLabels[sectorCode],
    establishments,
    totalEstablishments: snapshot.total,
    population: snapshot.population,
    establishmentsPerTenThousand: Number(
      ((establishments / snapshot.population) * 10000).toFixed(1),
    ),
    datasetYear: 2023,
    provenanceUrl:
      "https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23detail.zip",
  })),
);

export const countyBusinessPatterns = {
  geography: "Morris County, NJ",
  source: "U.S. Census Bureau 2023 County Business Patterns county file",
  sourceUrl: "https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html",
  total: {
    establishments: 16518,
    employment: 301249,
    annualPayrollThousand: 29798600,
  },
  sectors: [
    {
      code: "54",
      label: "Professional, scientific, and technical services",
      establishments: 2409,
      employment: 43205,
      annualPayrollThousand: 6238626,
    },
    {
      code: "62",
      label: "Health care and social assistance",
      establishments: 1829,
      employment: 40387,
      annualPayrollThousand: 2889835,
    },
    {
      code: "23",
      label: "Construction",
      establishments: 1654,
      employment: 12891,
      annualPayrollThousand: 1190160,
    },
    {
      code: "44-45",
      label: "Retail trade",
      establishments: 1633,
      employment: 29350,
      annualPayrollThousand: 1160129,
    },
    {
      code: "81",
      label: "Other services",
      establishments: 1587,
      employment: 10497,
      annualPayrollThousand: 443136,
    },
    {
      code: "72",
      label: "Accommodation and food services",
      establishments: 1415,
      employment: 22146,
      annualPayrollThousand: 617326,
    },
    {
      code: "56",
      label: "Administrative/support and waste services",
      establishments: 1271,
      employment: 25414,
      annualPayrollThousand: 1328110,
    },
    {
      code: "52",
      label: "Finance and insurance",
      establishments: 1006,
      employment: 16584,
      annualPayrollThousand: 2754730,
    },
    {
      code: "42",
      label: "Wholesale trade",
      establishments: 926,
      employment: 22948,
      annualPayrollThousand: 3826233,
    },
    {
      code: "53",
      label: "Real estate and rental and leasing",
      establishments: 704,
      employment: 5682,
      annualPayrollThousand: 664442,
    },
    {
      code: "31-33",
      label: "Manufacturing",
      establishments: 503,
      employment: 15364,
      annualPayrollThousand: 1323474,
    },
    {
      code: "48-49",
      label: "Transportation and warehousing",
      establishments: 436,
      employment: 8647,
      annualPayrollThousand: 563261,
    },
  ],
};

export const publicDataNotes = [
  "The member directory is scraped from public Chamber/Membee listing pages; it is not an official internal roster export.",
  "Coordinates, websites, addresses, and phone numbers are used only when exposed by the public directory.",
  "Membership start dates, renewal dates, emails, contact names, and member-status fields remain synthetic placeholders until the Chamber provides official data.",
  "County Business Patterns covers employer establishments with paid employees; it excludes most nonemployer businesses and some public-sector activity.",
  "ZIP Business Patterns 2023 supplies employer-establishment counts for Budd Lake (07828) and Flanders (07836); counts describe establishments, not a complete competitor list.",
  "ACS values are estimates with sampling uncertainty. The intelligence views show margin-of-error and confidence labels rather than treating estimates as exact counts.",
];
