import json
import math
import unittest

from research.acquire import ROOT
from research.pulse import cbp_value, numeric, subset_percentage


class PulseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = json.loads((ROOT / "public/economy/local-pulse.json").read_text())

    def test_special_values_and_suppression(self):
        for raw in [None, "", "-666666666", "NaN", "Infinity", "N"]:
            self.assertIsNone(numeric(raw))
        self.assertEqual(numeric("0"), 0)
        self.assertIsNone(cbp_value({"emp": "0", "emp_nf": "D"}, "emp"))
        self.assertIsNone(cbp_value({"emp": "0", "empflag": "A"}, "emp"))

    def test_ratio_missing_and_zero_denominator(self):
        self.assertEqual(subset_percentage(1, 0, 0, 0), (None, None))
        self.assertEqual(subset_percentage(None, 10, 0, 0), (None, None))
        self.assertEqual(subset_percentage(20, 10, 0, 0), (None, None))
        self.assertEqual(subset_percentage(0, 10, 1, 0), (0, 10))

    def test_ratio_fallback_does_not_report_zero_uncertainty(self):
        value, moe = subset_percentage(50, 100, 1, 10)
        self.assertEqual(value, 50)
        self.assertAlmostEqual(moe, math.sqrt(26))

    def test_sources_unique_and_fully_linked(self):
        b = self.bundle
        self.assertEqual(b["issues"], [])
        sources = {s["id"]: s for s in b["sources"]}
        self.assertEqual(len(sources), len(b["sources"]))
        for source in sources.values():
            self.assertEqual(len(source["sha256"]), 64)
            for dependency in source.get("dependencySourceIds", []):
                self.assertIn(dependency, sources)
        for dataset in b["datasets"]:
            self.assertTrue(dataset["universe"])
            keys = set()
            for row in dataset["observations"]:
                key = (row["geographyId"], row["year"])
                self.assertNotIn(key, keys)
                keys.add(key)
                if row["status"] == "observed":
                    self.assertIsNotNone(row["value"])
                    self.assertTrue(row["sourceIds"])
                    self.assertTrue(all(s in sources for s in row["sourceIds"]))

    def test_township_business_not_substituted_with_zip(self):
        for dataset in self.bundle["datasets"]:
            if dataset["group"] == "business":
                for row in dataset["observations"]:
                    if row["geographyId"] == "mount-olive":
                        self.assertIsNone(row["value"])
                        self.assertEqual(row["status"], "not_available")
                    else:
                        self.assertGreater(row["value"], 0)

    def test_industry_partition_and_all_acs_periods(self):
        for geo in self.bundle["geographies"]:
            for year in [2014, 2019, 2024]:
                total = 0
                for dataset in self.bundle["datasets"]:
                    if dataset["group"] != "business":
                        row = next(r for r in dataset["observations"] if r["year"] == year and r["geographyId"] == geo["id"])
                        self.assertIsNotNone(row["value"], (dataset["id"], geo["id"], year))
                        self.assertEqual(row["periodStart"], f"{year - 4}-01-01")
                        if dataset["group"] == "industry":
                            total += row["value"]
                self.assertAlmostEqual(total, 100, places=7)

    def test_known_totals_and_payroll_units(self):
        datasets = {d["id"]: d for d in self.bundle["datasets"]}
        def value(key, geo):
            return next(r["value"] for r in datasets[key]["observations"] if r["year"] == 2023 and r["geographyId"] == geo)
        self.assertEqual(value("establishments", "morris"), 16518)
        self.assertEqual(value("establishments", "new-jersey"), 237968)
        self.assertEqual(value("annual-payroll", "morris"), 29798600000)


if __name__ == "__main__":
    unittest.main()
