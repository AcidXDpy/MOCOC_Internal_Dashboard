"""Source-linked descriptive comparisons; no forecasts or synthetic observations."""

import argparse
import csv
import io
import json
import math
import zipfile

from research.acquire import Acquisition, ROOT, utc_now
from research.pulse_archive import archived_acs

GEOGRAPHIES = [
    {"id": "mount-olive", "name": "Mount Olive Township", "geoid": "06000US3402749080", "level": "county subdivision"},
    {"id": "morris", "name": "Morris County", "geoid": "05000US34027", "level": "county"},
    {"id": "new-jersey", "name": "New Jersey", "geoid": "04000US34", "level": "state"},
]
ACS_YEARS = (2014, 2019, 2024)
CBP_YEARS = tuple(range(2018, 2024))
TABLES = "B01003,B19013,B19301,B23025,B20002,C24030"


def numeric(value):
    try:
        number = float(value)
        return number if math.isfinite(number) and number >= 0 else None
    except (ValueError, TypeError):
        return None


def subset_percentage(n, d, nm, dm):
    """ACS subset-ratio MOE, with general-ratio fallback for negative radicands."""
    if n is None or d is None or d <= 0 or n > d:
        return None, None
    ratio = n / d
    if nm is None or dm is None:
        return ratio * 100, None
    radicand = nm * nm - ratio * ratio * dm * dm
    if radicand < 0:
        radicand = nm * nm + ratio * ratio * dm * dm
    return ratio * 100, math.sqrt(radicand) / d * 100


def dataset(key, label, unit, universe, variables, denominator=None, group="residents"):
    return {
        "id": key, "label": label, "unit": unit, "universe": universe,
        "group": group, "kind": "derived" if denominator or len(variables) > 1 else "published",
        "frequency": "five-year estimate", "variables": variables,
        "denominator": denominator,
        "formula": "100 x sum(numerator estimates) / denominator" if denominator else "Published estimate",
        "notes": ["Non-overlapping ACS windows; not annual point observations.",
                  "90% margins of error; geographic nesting means these samples are not independent."] +
                 (["Dollar values use each release's end-year dollars; not adjusted to a common purchasing-power year."] if unit == "USD" else []),
        "observations": [],
    }


def acs_datasets():
    result = [
        dataset("population", "Population", "people", "All residents", ["B01003001"]),
        dataset("household-income", "Median household income", "USD", "Households", ["B19013001"]),
        dataset("per-capita-income", "Per-capita income", "USD", "All residents", ["B19301001"]),
        dataset("resident-employment", "Employed residents", "people", "Civilian employed residents age 16+", ["B23025004"]),
        dataset("employment-rate", "Employment / population 16+", "percent", "All residents age 16+ (including Armed Forces); numerator civilian employed", ["B23025004"], "B23025001"),
        dataset("unemployment", "Unemployment rate (ACS)", "percent", "Civilian labor force age 16+", ["B23025005"], "B23025003"),
        dataset("earnings", "Median annual earnings", "USD", "Residents age 16+ with earnings, all work schedules", ["B20002001"]),
    ]
    # C24030 indent=2 categories partition each sex; nested subcategories are excluded.
    sectors = {3: "Agriculture & mining", 6: "Construction", 7: "Manufacturing", 8: "Wholesale trade",
               9: "Retail trade", 10: "Transportation & utilities", 13: "Information",
               14: "Finance & real estate", 17: "Professional & administrative services",
               21: "Education & health care", 24: "Arts, accommodation & food",
               27: "Other services", 28: "Public administration"}
    for column, name in sectors.items():
        result.append(dataset(f"industry-{column}", name, "percent", "Civilian employed residents age 16+",
                              [f"C24030{column:03d}", f"C24030{column + 27:03d}"],
                              "C24030001", "industry"))
    return result


def observation(geography, year, source_ids, five_year=True, status="missing"):
    return {"geographyId": geography, "year": year,
            "periodStart": f"{year - 4 if five_year else year}-01-01", "periodEnd": f"{year}-12-31",
            "value": None, "moe": None, "status": status, "sourceIds": source_ids,
            "flags": [], "inputs": {}}


def fill_acs(target, payload, geo, year, source_id):
    row = observation(geo["id"], year, [source_id])
    values, margins = [], []
    variables = target["variables"] + ([target["denominator"]] if target["denominator"] else [])
    for variable in variables:
        table = variable[:-3]
        raw = payload.get("data", {}).get(geo["geoid"], {}).get(table, {})
        value = numeric(raw.get("estimate", {}).get(variable))
        moe = numeric(raw.get("error", {}).get(variable))
        row["inputs"][variable] = {"value": value, "moe": moe}
        values.append(value)
        margins.append(moe)
    if any(v is None for v in values):
        row["flags"].append("Source estimate unavailable; never filled with zero")
        return row
    if target["denominator"]:
        numerator = sum(values[:-1])
        numerator_moe = math.sqrt(sum(m * m for m in margins[:-1])) if all(m is not None for m in margins[:-1]) else None
        row["value"], row["moe"] = subset_percentage(numerator, values[-1], numerator_moe, margins[-1])
        row["flags"].append("Approximate derived 90% MOE; covariance not available")
    else:
        row["value"], row["moe"] = values[0], margins[0]
    row["status"] = "observed" if row["value"] is not None else "missing"
    return row


def state_total(body):
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        filename = next(n for n in archive.namelist() if n.lower().endswith("st.txt"))
        with archive.open(filename) as stream:
            rows = [r for r in csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))
                    if r.get("fipstate") == "34" and r.get("naics") == "------" and r.get("lfo") == "-"]
    if len(rows) != 1:
        raise ValueError("Expected exactly one NJ all-industry, all-legal-forms total")
    return rows


def cbp_value(raw, field):
    flag = raw.get(f"{field}_nf", "")
    if flag in ("D", "S") or (field == "emp" and raw.get("empflag", "")):
        return None
    return numeric(raw.get(field))


def build(refresh=False, offline=False):
    acquisition = Acquisition(refresh=refresh, offline=offline)
    datasets = acs_datasets()
    issues = []
    for year in ACS_YEARS:
        source_id = f"pulse-acs-{year}"
        url = f"https://api.censusreporter.org/1.0/data/show/acs{year}_5yr?table_ids={TABLES}&geo_ids=" + ",".join(g["geoid"] for g in GEOGRAPHIES)
        payload = {}
        source_map = {}
        try:
            if year < 2024:
                payload, source_map = archived_acs(acquisition, year, GEOGRAPHIES, TABLES.split(","))
            else:
                payload = acquisition.fetch(source_id, url, {
                "name": f"U.S. Census Bureau ACS {year} five-year (via Census Reporter)",
                "parserVersion": 1, "geography": "Mount Olive Township, Morris County, New Jersey",
                "frequency": "five-year pooled estimate", "variables": TABLES.split(","),
                "observationStart": f"{year - 4}-01-01", "observationEnd": f"{year}-12-31",
                    "notes": ["Original Census estimates redistributed by Census Reporter.", "MOEs have 90% confidence; missing or special negative values become null."]})
            if payload.get("release", {}).get("id") != f"acs{year}_5yr":
                raise ValueError("Unexpected ACS release")
            if any(g["geoid"] not in payload.get("data", {}) for g in GEOGRAPHIES):
                raise ValueError("Incomplete ACS geography coverage")
        except Exception as error:
            if offline:
                raise
            issues.append({"sourceId": source_id, "url": url, "message": str(error)})
            payload = {}
        for target in datasets:
            for geo in GEOGRAPHIES:
                sid = source_map.get(target["variables"][0][:-3], source_id)
                target["observations"].append(fill_acs(target, payload, geo, year, sid))

    county = acquisition.cbp(CBP_YEARS)
    if offline and len(county) != len(CBP_YEARS):
        raise ValueError("Offline CBP coverage incomplete")
    cbp = []
    for key, label, unit, field in [
        ("establishments", "Employer establishments", "establishments", "est"),
        ("workplace-employment", "Covered workplace employment", "jobs", "emp"),
        ("annual-payroll", "Annual payroll", "USD", "ap"),
    ]:
        cbp.append({"id": key, "label": label, "unit": unit, "group": "business",
                    "universe": "CBP covered private employer establishments", "kind": "published",
                    "frequency": "annual", "variables": [field], "denominator": None,
                    "formula": "Source payroll in $1,000 multiplied by 1,000" if field == "ap" else "Published count",
                    "notes": ["No township CBP geography; ZIP counts are not township counts.",
                              "Establishments are locations, not firms or chamber members; excludes nonemployers and most government.",
                              "Employment refers to the week of March 12; payroll is a calendar-year total in nominal dollars.",
                              "Net count changes are not business openings or closures.",
                              "Fixed 2018-2023 research window, not a claim of latest available CBP."], "observations": []})
    for year in CBP_YEARS:
        source_id = f"pulse-cbp-{year}-state"
        url = f"https://www2.census.gov/programs-surveys/cbp/datasets/{year}/cbp{str(year)[-2:]}st.zip"
        states = []
        try:
            states = acquisition.fetch(source_id, url, {
                "name": f"U.S. Census Bureau State Business Patterns {year}", "parserVersion": 1,
                "geography": "New Jersey", "frequency": "annual", "variables": ["est", "emp", "ap", "emp_nf", "ap_nf"],
                "observationStart": f"{year}-01-01", "observationEnd": f"{year}-12-31",
                "notes": ["Direct state total; not a sum of county counts.", "All industries and all legal forms; employer establishments only."]}, state_total)
        except Exception as error:
            if offline:
                raise
            issues.append({"sourceId": source_id, "url": url, "message": str(error)})
        for target in cbp:
            for geo in GEOGRAPHIES:
                sid = f"cbp-{year}-nj" if geo["id"] == "morris" else source_id
                row = observation(geo["id"], year, [] if geo["id"] == "mount-olive" else [sid], False)
                if geo["id"] == "mount-olive":
                    row.update(status="not_available", flags=["CBP does not publish a township total"])
                else:
                    rows = ([r for r in county.get(year, []) if r["fipscty"] == "027" and r["naics"] == "------"]
                            if geo["id"] == "morris" else states)
                    if len(rows) == 1:
                        field = target["variables"][0]
                        raw = rows[0]
                        value = cbp_value(raw, field)
                        row.update(value=value * 1000 if value is not None and field == "ap" else value,
                                   status="observed" if value is not None else "suppressed",
                                   inputs={field: raw.get(field), f"{field}_nf": raw.get(f"{field}_nf")},
                                   flags=[f"Source {field}_nf flag: {raw[field + '_nf']}"] if raw.get(field + "_nf") else [])
                target["observations"].append(row)
    datasets.extend(cbp)
    issues.extend(acquisition.errors)
    result = {"schemaVersion": "pulse/1", "builtAt": utc_now(), "geographies": GEOGRAPHIES,
              "sources": acquisition.sources, "datasets": datasets, "issues": issues,
              "coverage": "ACS 2010-2014, 2015-2019, 2020-2024; CBP 2018-2023. Latest loaded observations, not real-time conditions."}
    path = ROOT / "public" / "economy" / "local-pulse.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Local Economic Pulse: {len(datasets)} datasets, {len(acquisition.sources)} sources, {len(issues)} acquisition issues")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--offline", action="store_true")
    modes.add_argument("--refresh", action="store_true")
    options = parser.parse_args()
    build(refresh=options.refresh, offline=options.offline)
