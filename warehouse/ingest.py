"""Adapters for the sanitized application export and public Census estimates."""

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .store import identity, iso_date, json_text, now, number, required, timestamp


def import_snapshot(store, path, directory_only=False):
    content = Path(path).read_text(encoding="utf-8-sig")
    payload = json.loads(content)
    with store.ingest("import-directory" if directory_only else "import-snapshot", content,
                      str(Path(path).resolve()), payload.get("generatedAt")):
        import_businesses(store, payload)
        if not directory_only:
            import_economy(store, payload)
    return {"rowsSeen": store.rows_seen, "rowsChanged": store.rows_changed}


def import_businesses(store, payload):
    snapshot = iso_date(payload.get("directorySnapshotDate"), "directorySnapshotDate")
    businesses = payload.get("businesses")
    if not isinstance(businesses, list):
        raise ValueError("businesses must be an array")
    seen = set()
    for index, item in enumerate(businesses):
        business_id, name = required(item, "id"), required(item, "name")
        if business_id in seen:
            raise ValueError(f"Duplicate business ID: {business_id}")
        seen.add(business_id)
        source_url = required(item, "sourceUrl")
        raw = {k: item.get(k) for k in ("id", "name", "industry", "address", "city", "zip", "latitude", "longitude", "description", "sourceUrl")}
        synthetic = set(item.get("synthetic_fields", []))
        if synthetic.intersection(raw):
            raise ValueError(f"Business {business_id}: sanitized export contains synthetic public fields")
        _, provenance, _ = store.evidence({"source_id": "chamber_directory", "source_name": "Mount Olive Area Chamber public directory",
                "source_url": source_url, "source_homepage": "https://memberservices.membee.com/",
                "release_key": f"directory:{snapshot}", "retrieved_at": snapshot}, f"businesses[{index}]", raw)
        current = store.db.execute("SELECT snapshot_date FROM business WHERE id=?", (business_id,)).fetchone()
        if not current or snapshot >= current[0]:
            store.upsert("business", {"id": business_id, "name": name, "description": item.get("description") or "",
                        "source_url": source_url, "snapshot_date": snapshot, "provenance_id": provenance})
        latitude = number(item.get("latitude"), "latitude", optional=True)
        longitude = number(item.get("longitude"), "longitude", optional=True)
        store.upsert("business_location_history", {"id": identity(business_id, "directory", snapshot),
                    "business_id": business_id, "snapshot_date": snapshot,
                    "address": item.get("address") or None, "city": item.get("city") or None,
                    "postal_code": item.get("zip") or None, "latitude": latitude, "longitude": longitude,
                    "provenance_id": provenance})
        category = item.get("industry")
        if category:
            industry_id = "directory:" + identity(category)
            store.upsert("industry", {"id": industry_id, "system": "chamber_category", "code": category,
                                     "vintage": "unspecified", "name": category}, immutable=True)
            store.upsert("business_industry", {"id": identity(business_id, industry_id, snapshot),
                        "business_id": business_id, "industry_id": industry_id, "snapshot_date": snapshot,
                        "verification": "directory_category", "provenance_id": provenance})
        store.rows_seen += 1


def import_economy(store, payload):
    retrieved = iso_date(payload.get("economicRetrievedAt"), "economicRetrievedAt")
    for index, item in enumerate(payload.get("acs", [])):
        p = item["provenance"]
        year = int(p["datasetYear"])
        for comparison in (False, True):
            if comparison and item.get("comparisonEstimate") is None:
                continue
            value = item.get("comparisonEstimate" if comparison else "estimate")
            flags = list(p.get("qualityFlags") or []) + ["checked_in_snapshot", "acs_five_year_period_estimate", "boundary_vintage_unspecified"]
            if comparison:
                flags.append("comparison_moe_not_supplied")
            row = {"indicator_id": item["id"], "indicator_name": item["label"], "domain": "demographics",
                   "unit": item["unit"], "value": value, "status": "observed" if value is not None else "missing",
                   "margin_of_error": None if comparison else item.get("marginOfError"),
                   "moe_confidence": None if comparison else 0.9,
                   "geography_id": "05000US34027" if comparison else p["geographyId"],
                   "geography_name": item.get("comparisonGeography") if comparison else p["geography"],
                   "geography_type": "county" if comparison else "county_subdivision",
                   "period_start": f"{year - 4}-01-01", "period_end": f"{year}-12-31", "frequency": "five_year",
                   "source_id": "acs_checked_in", "source_name": "U.S. Census Bureau ACS via checked-in Census Reporter snapshot",
                   "source_homepage": "https://censusreporter.org/", "source_url": p["queryUrl"],
                   "release_key": f"acs{year}_5yr", "retrieved_at": p.get("retrievedAt") or retrieved,
                   "method": p.get("transformation") or "Direct estimate", "quality_flags": flags}
            store.observation(row, f"acs[{index}].{'comparisonEstimate' if comparison else 'estimate'}")
    county = payload.get("county")
    if county:
        # The application export identifies this specific snapshot as CBP 2023 in its source text/URL.
        if "2023" not in county.get("sourceUrl", "") or "2023" not in county.get("source", ""):
            raise ValueError("County snapshot needs a recognized explicit dataset year; expected CBP 2023")
        groups = [(None, "All industries", county["total"])] + [(s["code"], s["label"], s) for s in county["sectors"]]
        for code, name, group in groups:
            for field, indicator, label, unit in (
                ("establishments", "cbp.establishments", "Employer establishments", "count"),
                ("employment", "cbp.employment", "Employer establishment employment", "count"),
                ("annualPayrollThousand", "cbp.annual_payroll", "Annual payroll", "thousand_USD_current_year"),
            ):
                row = business_pattern_row("census_cbp_snapshot", county["sourceUrl"], retrieved, 2023,
                    "05000US34027", county["geography"], "county", code, name, indicator, label, unit, group.get(field))
                row["domain"] = "employment" if field == "employment" else "business"
                store.observation(row, f"county.{code or 'total'}.{field}")
    for index, item in enumerate(payload.get("zip", [])):
        row = business_pattern_row("census_zbp_snapshot", item["provenanceUrl"], retrieved, int(item["datasetYear"]),
                item["zipCode"], item["zipName"], "postal_zip", item["sectorCode"], item["sectorLabel"],
                "zbp.establishments", "ZIP employer establishments", "count", item.get("establishments"))
        row["quality_flags"].extend(["postal_zip_is_not_zcta", "sector_code_from_legacy_snapshot"])
        store.observation(row, f"zip[{index}].establishments")
        total = {**row, "industry_id": None, "value": item.get("totalEstablishments")}
        total["status"] = "observed" if total["value"] is not None else "missing"
        store.observation(total, f"zip[{index}].totalEstablishments")


def business_pattern_row(source, url, retrieved, year, geo, geo_name, kind, code, name, indicator, label, unit, value):
    return {"indicator_id": indicator, "indicator_name": label, "domain": "business", "unit": unit,
            "universe": "employer_establishments", "geography_id": geo, "geography_name": geo_name,
            "geography_type": kind, "period_start": f"{year}-01-01", "period_end": f"{year}-12-31",
            "frequency": "annual", "value": value, "status": "observed" if value is not None else "missing",
            "source_id": source, "source_name": source, "source_url": url, "source_homepage": "https://www.census.gov/",
            "release_key": str(year), "retrieved_at": retrieved,
            "industry_id": f"NAICS:unspecified:{code}" if code else None,
            "industry_code": code, "industry_name": name, "industry_system": "NAICS", "industry_vintage": "unspecified",
            "quality_flags": ["checked_in_snapshot", "employer_establishments_only", "classification_vintage_unspecified"]}


ACS_VARIABLES = {
    "B01003001": ("acs.population.direct", "Population", "demographics", "count", "total_population"),
    "B19013001": ("acs.median_household_income.direct", "Median household income", "demographics", "USD_current_vintage", "households"),
    "B23025003": ("acs.civilian_labor_force", "Civilian labor force", "employment", "count", "civilian_population_age_16_plus"),
    "B23025004": ("acs.employed", "Civilian employed residents", "employment", "count", "civilian_population_age_16_plus"),
    "B23025005": ("acs.unemployed", "Civilian unemployed residents", "employment", "count", "civilian_population_age_16_plus"),
}


def fetch_acs(store, years, geo_ids, release_dates=None):
    results = []
    for year in years:
        if not 2009 <= year <= 2100:
            raise ValueError("ACS five-year end year must be between 2009 and 2100")
        query = urlencode({"table_ids": "B01003,B19013,B23025", "geo_ids": ",".join(geo_ids)})
        url = f"https://api.censusreporter.org/1.0/data/show/acs{year}_5yr?{query}"
        request = Request(url, headers={"User-Agent": "MountOliveEconomicResearch/1.0 (public county economic analysis)", "Accept": "application/json"})
        try:
            with urlopen(request, timeout=30) as response:
                content = response.read(10_000_001)
                if len(content) > 10_000_000:
                    raise ValueError("ACS response exceeds 10 MB")
                text = content.decode("utf-8")
        except Exception as exc:
            # Failed requests are auditable even when no observation batch exists.
            with store.ingest("fetch-acs", json_text({"url": url}), url):
                raise ValueError(f"ACS {year} retrieval failed: {exc}. Fixed vintage availability is provider-dependent.") from exc
        retrieved = now()
        with store.ingest("fetch-acs", text, url, retrieved):
            payload = json.loads(text)
            release = payload.get("release", {})
            if release.get("id") != f"acs{year}_5yr" or release.get("years") != f"{year - 4}-{year}":
                raise ValueError("ACS response release does not match requested fixed vintage")
            if not set(geo_ids) <= set(payload.get("data", {})):
                raise ValueError("ACS response is missing requested geographies")
            for geo in geo_ids:
                geo_type = {"050": "county", "060": "county_subdivision", "140": "tract"}.get(geo[:3], "other")
                for variable, (indicator, label, domain, unit, universe) in ACS_VARIABLES.items():
                    table_id = variable[:6]
                    table = payload["data"][geo][table_id]
                    if variable not in table["estimate"]:
                        raise ValueError(f"ACS response missing {variable} for {geo}")
                    value = table["estimate"][variable]
                    moe = table.get("error", {}).get(variable)
                    flags = ["acs_five_year_period_estimate", "boundary_vintage_unspecified", "live_public_retrieval"]
                    if value is None:
                        status = "missing"
                    elif number(value, variable) <= -100000000:
                        status, value = "missing", None
                        flags.append("census_special_value_unavailable")
                    else:
                        status = "observed"
                    if value is None or (moe is not None and number(moe, "moe") < 0):
                        moe = None
                    row = {"indicator_id": indicator, "indicator_name": label, "domain": domain,
                           "unit": unit, "universe": universe, "geography_id": geo,
                           "geography_name": payload["geography"][geo]["name"], "geography_type": geo_type,
                           "period_start": f"{year - 4}-01-01", "period_end": f"{year}-12-31", "frequency": "five_year",
                           "value": value, "status": status, "margin_of_error": moe, "moe_confidence": 0.9 if moe is not None else None,
                           "source_id": "acs_censusreporter", "source_name": "U.S. Census Bureau ACS via Census Reporter",
                           "source_url": url, "source_homepage": "https://api.censusreporter.org/",
                           "release_key": f"acs{year}_5yr", "release_date": (release_dates or {}).get(year),
                           "retrieved_at": retrieved, "quality_flags": flags}
                    store.observation(row, f"data.{geo}.{table_id}.estimate.{variable}")
        results.append({"year": year, "rowsSeen": store.rows_seen, "rowsChanged": store.rows_changed, "sourceUrl": url})
    return results
