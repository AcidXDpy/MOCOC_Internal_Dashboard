"""Observed-output checks; these never generate or substitute economic observations."""

import csv
import json
import unittest
from pathlib import Path

import numpy as np
from shapely.geometry import shape

from research.acquire import ROOT


class OutputContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "public/economy/model-results.json"
        if not cls.path.exists():
            raise unittest.SkipTest("Build the observed outputs before running contract tests")
        cls.data = json.loads(cls.path.read_text(encoding="utf-8"))

    def test_model_envelopes_and_provenance(self):
        keys = ["health", "forecast", "nowcast", "spatial", "network", "anomalies", "resilience", "policy", "survival", "causal"]
        self.assertEqual(self.data["schemaVersion"], "1.0.0")
        source_ids = {s["id"] for s in self.data["sources"]}
        for key in keys:
            model = self.data[key]
            self.assertIn(model["status"], ["ready", "experimental", "blocked"])
            self.assertTrue(set(model["sourceIds"]).issubset(source_ids))
            self.assertTrue(model["method"]["description"])
            if model["status"] == "blocked":
                self.assertIsNone(model["result"])
        self.assertIsNone(self.data["health"]["result"]["overallEconomicHealthScore"])
        self.assertIsInstance(self.data["network"]["result"]["complexityReadiness"], str)
        self.assertIsInstance(self.data["nowcast"]["result"]["informationSet"], str)
        self.assertNotIn("NaN", self.path.read_text(encoding="utf-8"))

    def test_real_monthly_missing_observation_and_intervals(self):
        forecast = self.data["forecast"]["result"]
        history = {r["date"]: r["value"] for r in forecast["history"]}
        self.assertIsNone(history["2025-10-01"])
        self.assertGreater(len(history), 300)
        for point in forecast["predictions"]:
            self.assertGreater(point["date"], forecast["observedThrough"])
            self.assertLessEqual(point["lower"], point["value"])
            self.assertGreaterEqual(point["upper"], point["value"])
        for point in forecast["validation"]["predictions"]:
            self.assertEqual(point["actual"], history[point["date"]])
            self.assertLess(point["origin"], point["date"])

    def test_county_universe_and_full_grouped_sector_counts(self):
        result = self.data["network"]["result"]
        self.assertEqual(result["nGeographies"], 21)
        self.assertNotIn("34999", [c["fips"] for c in result["counties"]])
        ids = {n["id"] for n in result["nodes"]}
        self.assertTrue({"31-33", "44-45", "48-49", "72"}.issubset(ids))
        coverage = result["sectorCoverage"]
        self.assertGreater(coverage["morrisEstablishmentShare"], 0.98)
        self.assertEqual(coverage["includedMorrisEstablishments"] + coverage["excludedMorrisEstablishments"],
                         coverage["totalMorrisEstablishments"])
        self.assertAlmostEqual(coverage["morrisEstablishmentShare"],
                               coverage["includedMorrisEstablishments"] / coverage["totalMorrisEstablishments"])
        self.assertAlmostEqual(sum(n["share"] for n in result["nodes"]), 1, places=6)
        self.assertEqual(result["annualTotals"][-1]["establishments"], 16518)
        for node in result["nodes"] + result["directoryNetwork"]["nodes"]:
            self.assertTrue(np.isfinite(node["x"]) and np.isfinite(node["y"]))

    def test_geojson_join_and_validity(self):
        path = ROOT / "public/economy/tracts.geojson"
        geo = json.loads(path.read_text(encoding="utf-8"))
        ids = {f["properties"]["geoid"] for f in geo["features"]}
        analytical_ids = {t["geoid"] for t in self.data["spatial"]["result"]["tracts"]}
        self.assertTrue(analytical_ids.issubset(ids))
        self.assertEqual(len(ids), len(geo["features"]))
        self.assertLess(path.stat().st_size, 400000)
        for feature in geo["features"]:
            self.assertEqual(feature["properties"]["GEOID"], feature["properties"]["geoid"])
            self.assertTrue(shape(feature["geometry"]).is_valid)

    def test_warehouse_observations_preserve_missing_and_moes(self):
        with (ROOT / "research/data/observations.csv").open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        missing = [r for r in rows if r["status"] == "missing" and r["indicator_id"].startswith("laus_")]
        self.assertEqual(len(missing), 2)
        self.assertTrue(all(r["value"] == "" and r["period_start"] == "2025-10-01" for r in missing))
        self.assertTrue(any(r["margin_of_error"] for r in rows if r["source_id"] == "acs2024-tracts"))
        self.assertTrue(all(r["release_date"] == "" for r in rows))
        self.assertTrue(all(r["release_key"] and r["retrieved_at"] for r in rows))


if __name__ == "__main__":
    unittest.main()
