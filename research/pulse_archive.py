"""Extract a small, reproducible ACS panel from official sequence archives."""

import csv
import io
import zipfile


def archived_acs(acquisition, year, geographies, tables):
    base = f"https://www2.census.gov/programs-surveys/acs/summary_file/{year}"
    folder = f"{base}/data/5_year_seq_by_state/NewJersey/All_Geographies_Not_Tracts_Block_Groups"
    meta = {"parserVersion": 1, "geography": "Mount Olive Township, Morris County, New Jersey",
            "frequency": "five-year pooled estimate", "observationStart": f"{year - 4}-01-01",
            "observationEnd": f"{year}-12-31", "notes": ["Direct Census ACS summary file; estimates and 90% MOEs preserved."]}

    def lookup_parser(body):
        return [r for r in csv.DictReader(io.StringIO(body.decode("cp1252")))
                if r["Table ID"] in tables and r["Start Position"]]

    lookup_id = f"pulse-acs-{year}-lookup"
    lookup = acquisition.fetch(lookup_id, f"{base}/documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt",
                               {**meta, "name": f"ACS {year} sequence/table dictionary", "variables": tables}, lookup_parser)
    lookup = [row for row in lookup if row["Start Position"].strip()]
    if {r["Table ID"] for r in lookup} != set(tables):
        raise ValueError("Requested ACS tables missing from sequence dictionary")

    def geo_parser(body):
        matches = {}
        for row in csv.reader(io.StringIO(body.decode("cp1252"))):
            for geo in geographies:
                if geo["geoid"] in row:
                    if geo["geoid"] in matches:
                        raise ValueError("Duplicate ACS geography")
                    matches[geo["geoid"]] = {"logrecno": row[4], "raw": row}
        if len(matches) != len(geographies):
            raise ValueError("ACS geography crosswalk incomplete")
        return matches

    geography_id = f"pulse-acs-{year}-geography"
    geography = acquisition.fetch(geography_id, f"{folder}/g{year}5nj.csv",
                                  {**meta, "name": f"ACS {year} NJ geography crosswalk", "variables": ["LOGRECNO", "GEOID"]}, geo_parser)
    by_record = {v["logrecno"]: k for k, v in geography.items()}
    payload = {"release": {"id": f"acs{year}_5yr"}, "data": {g["geoid"]: {} for g in geographies}}
    source_map = {}
    for sequence in sorted({r["Sequence Number"] for r in lookup}):
        selected = [r for r in lookup if r["Sequence Number"] == sequence]

        def parse(body):
            output = {g["geoid"]: {} for g in geographies}
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                for prefix, kind in [("e", "estimate"), ("m", "error")]:
                    name = f"{prefix}{year}5nj{sequence}000.txt"
                    with archive.open(name) as stream:
                        matched = set()
                        for row in csv.reader(io.TextIOWrapper(stream, encoding="utf-8-sig")):
                            if row[5] not in by_record:
                                continue
                            geoid = by_record[row[5]]
                            matched.add(geoid)
                            for spec in selected:
                                table = spec["Table ID"]
                                start = int(spec["Start Position"]) - 1
                                cells = int(spec["Total Cells in Table"].split()[0])
                                output[geoid].setdefault(table, {})[kind] = {
                                    f"{table}{i + 1:03d}": row[start + i] for i in range(cells)}
                        if matched != set(output):
                            raise ValueError("Missing ACS sequence geography rows")
            return output

        sid = f"pulse-acs-{year}-seq-{sequence}"
        values = acquisition.fetch(sid, f"{folder}/{year}5nj{sequence}000.zip",
                                   {**meta, "name": f"U.S. Census Bureau ACS {year} five-year: {', '.join(r['Table ID'] for r in selected)}",
                                    "variables": [r["Table ID"] for r in selected],
                                    "dependencySourceIds": [lookup_id, geography_id]}, parse)
        for geoid, table_values in values.items():
            payload["data"][geoid].update(table_values)
        for spec in selected:
            source_map[spec["Table ID"]] = sid
    return payload, source_map
