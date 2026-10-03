"""Pinned township boundary used to filter public directory coordinates."""
import json
from research.acquire import Acquisition, ROOT

if __name__ == "__main__":
    acquisition = Acquisition()
    result = acquisition.fetch("demand-township-tiger2024", "https://api.censusreporter.org/1.0/geo/show/tiger2024?geo_ids=06000US3402749080", {
        "name": "Census TIGER 2024 Mount Olive Township boundary via Census Reporter",
        "geography": "Mount Olive Township, Morris County, NJ", "frequency": "geography vintage",
        "variables": ["geometry", "geoid"], "observationStart": "2024-01-01", "observationEnd": "2024-12-31",
        "notes": ["Point-in-polygon inclusion uses unverified public directory coordinates, not verified establishment locations."]})
    features = result.get("features", [])
    if len(features) != 1 or features[0].get("properties", {}).get("geoid") != "06000US3402749080":
        raise ValueError("Expected exactly the Mount Olive Township feature")
    target = ROOT / "src" / "economy" / "demand" / "township-boundary.json"
    target.write_text(json.dumps({"source": acquisition.sources[0], "feature": features[0]}, indent=2) + "\n", encoding="utf-8")
    print(target)
