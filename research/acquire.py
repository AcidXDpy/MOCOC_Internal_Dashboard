"""Keyless public downloads, cached with immutable retrieval provenance."""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "research" / "data"
USER_AGENT = "MountOliveEconomicResearch/1.0 (public county economic analysis)"
SECTORS = {
    "11": "Agriculture and forestry", "21": "Mining", "22": "Utilities",
    "23": "Construction", "31-33": "Manufacturing", "42": "Wholesale trade",
    "44-45": "Retail trade", "48-49": "Transportation and warehousing",
    "51": "Information", "52": "Finance and insurance", "53": "Real estate",
    "54": "Professional and technical services", "55": "Management of companies",
    "56": "Administrative and waste services", "61": "Educational services",
    "62": "Health care and social assistance", "71": "Arts and recreation",
    "72": "Accommodation and food services", "81": "Other services",
    "99": "Unclassified establishments",
}
NJ_COUNTIES = {f"{code:03d}" for code in range(1, 42, 2)}


def normalize_cbp_sector(raw):
    code = raw.rstrip("-/")
    return {"31": "31-33", "44": "44-45", "48": "48-49"}.get(code, code)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Acquisition:
    def __init__(self, refresh=False, offline=False):
        if refresh and offline:
            raise ValueError("--refresh and --offline cannot be combined")
        self.refresh = refresh
        self.offline = offline
        self.sources = []
        self.errors = []
        DATA.mkdir(parents=True, exist_ok=True)

    def fetch(self, source_id, url, metadata, parser=None):
        path = DATA / f"{source_id}.json"
        if path.exists() and not self.refresh:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if cached["source"].get("parserVersion") == metadata.get("parserVersion"):
                self.sources.append(cached["source"])
                return cached["data"]
        if self.offline:
            raise RuntimeError(f"No cached response for {source_id}")
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=(10, 60))
        response.raise_for_status()
        payload = parser(response.content) if parser else response.json()
        source = {
            "id": source_id, "url": url, "retrievedAt": utc_now(),
            "sha256": hashlib.sha256(response.content).hexdigest(),
            "cachePath": str(path.relative_to(ROOT)).replace("\\", "/"),
            "releaseDate": None, **metadata,
        }
        path.write_text(json.dumps({"source": source, "data": payload}, indent=2,
                                   allow_nan=False), encoding="utf-8")
        self.sources.append(source)
        return payload

    def labor(self, measure, end_year):
        series_id = {"unemployment_rate": "LAUCN340270000000003",
                     "employment": "LAUCN340270000000005"}[measure]
        rows = []
        for start in range(2000, end_year + 1, 10):
            end = min(start + 9, end_year)
            url = (f"https://api.bls.gov/publicAPI/v2/timeseries/data/{series_id}"
                   f"?startyear={start}&endyear={end}")
            source_id = f"bls-{measure}-{start}-{end}"

            def parse(body):
                obj = json.loads(body)
                if obj.get("status") != "REQUEST_SUCCEEDED":
                    raise ValueError(f"BLS failed: {obj.get('message')}")
                messages = obj.get("message", [])
                if messages:
                    raise ValueError(f"BLS request caveat requires review: {messages}")
                series = obj["Results"]["series"][0]
                if series["seriesID"] != series_id:
                    raise ValueError("BLS returned wrong series")
                return series["data"]

            data = self.fetch(source_id, url, {
                "name": f"BLS Local Area Unemployment Statistics: {measure}",
                "geography": "Morris County, New Jersey (34027)",
                "frequency": "monthly", "variables": [series_id],
                "observationStart": f"{start}-01-01", "observationEnd": None,
                "notes": ["Not seasonally adjusted; resident labor force, not workplace jobs.",
                          "Latest-vintage history; historical release vintages unavailable.",
                          "Preliminary footnotes retained; source release date not inferred."],
            }, parse)
            dates = []
            for row in data:
                if row["period"] == "M13":
                    continue
                date = f"{row['year']}-{row['period'][1:]}-01"
                if not start <= int(row["year"]) <= end:
                    raise ValueError("BLS returned data outside requested years")
                if row["value"] == "-":
                    self.errors.append({"source": source_id, "error": f"Source missing value at {date}; retained as missing"})
                else:
                    dates.append(date)
                rows.append({"date": date, "value": None if row["value"] == "-" else float(row["value"]),
                             "footnotes": [x.get("text") for x in row["footnotes"] if x.get("text")],
                             "sourceId": source_id})
            self.sources[-1]["observationStart"] = min(dates)
            self.sources[-1]["observationEnd"] = max(dates)
        frame = pd.DataFrame(rows).sort_values("date")
        if frame.date.duplicated().any():
            raise ValueError("Duplicate labor periods")
        return frame

    def cbp(self, years=(2018, 2019, 2020, 2021, 2022, 2023)):
        output = {}
        for year in years:
            yy = str(year)[-2:]
            url = f"https://www2.census.gov/programs-surveys/cbp/datasets/{year}/cbp{yy}co.zip"

            def parse(body):
                with zipfile.ZipFile(io.BytesIO(body)) as archive:
                    frames = []
                    with archive.open(f"cbp{yy}co.txt") as stream:
                        for chunk in pd.read_csv(stream, dtype=str, chunksize=100000,
                                                 keep_default_na=False):
                            nj = chunk[chunk.fipstate.eq("34") & chunk.fipscty.isin(NJ_COUNTIES)].copy()
                            nj["sector"] = nj.naics.map(normalize_cbp_sector)
                            nj = nj[nj.sector.isin(SECTORS) | nj.naics.eq("------")]
                            frames.append(nj)
                records = pd.concat(frames).to_dict("records")
                if not any(x["fipscty"] == "027" and x["naics"] == "------" for x in records):
                    raise ValueError("CBP Morris County total absent")
                return records

            try:
                output[year] = self.fetch(f"cbp-{year}-nj", url, {
                    "name": f"Census County Business Patterns {year}",
                    "parserVersion": 2,
                    "geography": "All New Jersey counties", "frequency": "annual",
                    "variables": ["naics", "est", "emp", "ap", "emp_nf", "ap_nf"],
                    "observationStart": f"{year}-01-01", "observationEnd": f"{year}-12-31",
                    "notes": ["Cache retains NJ two-digit sectors and totals from bulk county file.",
                              "Only actual county FIPS 001,003,...,041 included; county 999/000 statewide or unallocated records excluded.",
                              "Bulk sector codes 31----,44----,48---- normalize to 31-33,44-45,48-49.",
                              "Employer establishments only; not all businesses. Employment is March reference week.",
                              "Noise flags retained. Payroll is nominal thousands of dollars.",
                              "2018-2023 fixed NAICS2017 comparison window, not a claim of latest available CBP."],
                }, parse)
            except (requests.RequestException, ValueError, RuntimeError) as exc:
                self.errors.append({"source": f"cbp-{year}", "error": str(exc)})
        return output

    def tracts(self):
        query = "https://api.censusreporter.org/1.0/data/show/acs2024_5yr?table_ids=B19013,B23025,B17001&geo_ids=140%7C05000US34027"
        acs = self.fetch("acs2024-tracts", query, {
            "name": "ACS 2024 5-year via Census Reporter", "geography": "Morris County census tracts",
            "frequency": "five-year pooled estimate", "variables": ["B19013", "B23025", "B17001"],
            "observationStart": "2020-01-01", "observationEnd": "2024-12-31",
            "notes": ["Original source U.S. Census Bureau; Census Reporter is redistribution service.",
                      "ACS margins of error are 90%; five-year estimates are not 2024 point observations."],
        })
        if acs.get("release", {}).get("id") != "acs2024_5yr":
            raise ValueError("Unexpected ACS vintage")
        geo = self.fetch("tiger2024-tracts", "https://api.censusreporter.org/1.0/geo/show/tiger2024?geo_ids=140%7C05000US34027", {
            "name": "Census TIGER 2024 tract geography via Census Reporter",
            "geography": "Morris County census tracts", "frequency": "geography vintage",
            "variables": ["geometry", "geoid"], "observationStart": "2024-01-01",
            "observationEnd": "2024-12-31",
            "notes": ["Geometries are source boundaries. Representative interior points used for distance weights."],
        })
        return acs, geo
