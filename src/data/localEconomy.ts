export const localDemographics = {
  geography: "Mount Olive township, Morris County, NJ",
  source: "ACS 2024 5-year via Census Reporter; original data from the U.S. Census Bureau",
  sourceUrl: "https://censusreporter.org/profiles/06000US3402749080-mount-olive-township-morris-county-nj/",
  metrics: [
    { label: "Population", value: 29149, formatted: "29,149", detail: "ACS 2024 5-year estimate" },
    { label: "Median household income", value: 117394, formatted: "$117,394", detail: "Compared with Morris County at $137,326" },
    { label: "Per capita income", value: 59099, formatted: "$59,099", detail: "Compared with New Jersey at $54,253" },
    { label: "Bachelor's degree or higher", value: 48.8, formatted: "48.8%", detail: "Adult educational attainment" },
    { label: "Median age", value: 39.8, formatted: "39.8", detail: "Years" },
    { label: "Mean commute", value: 31.7, formatted: "31.7 min", detail: "Mean travel time to work" },
    { label: "Poverty rate", value: 4.4, formatted: "4.4%", detail: "Persons below poverty line" },
    { label: "Foreign-born population", value: 21.6, formatted: "21.6%", detail: "Share of residents" },
  ],
};

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
    { code: "54", label: "Professional, scientific, and technical services", establishments: 2409, employment: 43205, annualPayrollThousand: 6238626 },
    { code: "62", label: "Health care and social assistance", establishments: 1829, employment: 40387, annualPayrollThousand: 2889835 },
    { code: "23", label: "Construction", establishments: 1654, employment: 12891, annualPayrollThousand: 1190160 },
    { code: "44-45", label: "Retail trade", establishments: 1633, employment: 29350, annualPayrollThousand: 1160129 },
    { code: "81", label: "Other services", establishments: 1587, employment: 10497, annualPayrollThousand: 443136 },
    { code: "72", label: "Accommodation and food services", establishments: 1415, employment: 22146, annualPayrollThousand: 617326 },
    { code: "56", label: "Administrative/support and waste services", establishments: 1271, employment: 25414, annualPayrollThousand: 1328110 },
    { code: "52", label: "Finance and insurance", establishments: 1006, employment: 16584, annualPayrollThousand: 2754730 },
    { code: "42", label: "Wholesale trade", establishments: 926, employment: 22948, annualPayrollThousand: 3826233 },
    { code: "53", label: "Real estate and rental and leasing", establishments: 704, employment: 5682, annualPayrollThousand: 664442 },
    { code: "31-33", label: "Manufacturing", establishments: 503, employment: 15364, annualPayrollThousand: 1323474 },
    { code: "48-49", label: "Transportation and warehousing", establishments: 436, employment: 8647, annualPayrollThousand: 563261 },
  ],
};

export const publicDataNotes = [
  "The member directory is scraped from public Chamber/Membee listing pages; it is not an official internal roster export.",
  "Coordinates, websites, addresses, and phone numbers are used only when exposed by the public directory.",
  "Membership start dates, renewal dates, emails, contact names, and member-status fields remain synthetic placeholders until the Chamber provides official data.",
  "County Business Patterns covers employer establishments with paid employees; it excludes most nonemployer businesses and some public-sector activity.",
];
