"""Offline unit/integration tests. Every value in this module is synthetic."""

import csv
import io
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from warehouse.documents import candidates, import_document, review_candidate
from warehouse.ingest import fetch_acs, import_snapshot
from warehouse.records import import_model, import_records, import_results
from warehouse.store import Warehouse, import_csv, json_text, timestamp


FIXTURE = Path(__file__).parent / "fixtures" / "observations.csv"


class WarehouseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = Warehouse(self.root / "test.sqlite")
        self.store.init()

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def row(self, **changes):
        row = {"indicator_id": "TEST_ONLY.employment", "indicator_name": "Synthetic test employment",
               "domain": "employment", "unit": "persons", "geography_id": "TEST_ONLY_AREA",
               "geography_name": "Synthetic test area", "geography_type": "county", "geography_vintage": "2020",
               "period_start": "2024-01-01", "period_end": "2024-01-31", "frequency": "monthly",
               "value": 10, "status": "observed", "source_id": "TEST_ONLY_SOURCE", "source_name": "Synthetic test source",
               "source_url": "https://example.invalid/test", "release_key": "2024-02", "release_date": "2024-02-15",
               "retrieved_at": "2024-02-16T12:00:00Z", "quality_flags": ["SYNTHETIC_TEST_ONLY"]}
        row.update(changes)
        return row

    def put(self, row):
        with self.store.ingest("test", json_text(row), retrieved_at=row["retrieved_at"]):
            return self.store.observation(row, "row:1")

    def write_json(self, name, payload):
        path = self.root / name
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def count(self, table):
        return self.store.db.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]

    def snapshot(self):
        return {"directorySnapshotDate": "2024-01-01", "generatedAt": "2024-01-02T00:00:00Z",
                "businesses": [{"id": "TEST_ONLY_BUSINESS", "name": "Synthetic business", "industry": "Test category",
                    "address": "10 Test Road", "city": "Testville", "zip": "00000", "latitude": 40.0,
                    "longitude": -74.0, "description": "Synthetic test record", "sourceUrl": "https://example.invalid/business"}]}

    def test_init_repeat_and_foreign_keys(self):
        self.store.init()
        self.assertEqual(self.count("schema_version"), 1)
        self.assertEqual(self.store.db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        self.assertTrue(self.store.quality()["ok"])

    def test_csv_idempotence_preserves_null_statuses(self):
        import_csv(self.store, FIXTURE)
        counts = (self.count("panel_observation"), self.count("observation_revision"), self.count("provenance"))
        result = import_csv(self.store, FIXTURE)
        self.assertEqual(result["rowsChanged"], 0)
        self.assertEqual(counts, (3, 3, 3))
        self.assertEqual(counts, (self.count("panel_observation"), self.count("observation_revision"), self.count("provenance")))
        self.assertEqual([(r["status"], r["value"]) for r in self.store.panel()], [("observed", 10), ("suppressed", None), ("missing", None)])
        self.assertEqual(self.count("ingestion_run"), 2)

    def test_zero_is_an_observation(self):
        self.put(self.row(value=0))
        self.assertEqual(self.store.panel()[0]["value"], 0)

    def test_invalid_status_value_combinations_and_nonfinite(self):
        for change in ({"status": "suppressed", "value": 0}, {"status": "missing", "value": 5},
                       {"status": "observed", "value": ""}, {"value": "NaN"}, {"value": "Infinity"},
                       {"value": True}, {"status": "estimated"}, {"margin_of_error": -1},
                       {"quality_flags": "not json"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.put(self.row(**change))
        self.assertEqual(self.count("observation_revision"), 0)

    def test_invalid_dates_rollback_and_failed_audit(self):
        for change in ({"period_end": "2024-02-30"}, {"period_start": "2025-01-01"},
                       {"retrieved_at": "2024-02-16T12:00:00"}, {"release_date": "2024-03-01"},
                       {"period_end": "2024-03-31"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.put(self.row(**change))
        self.assertEqual(self.count("source"), 0)
        self.assertEqual(self.count("artifact"), 0)
        self.assertTrue(all(r[0] == "failed" for r in self.store.db.execute("SELECT status FROM ingestion_run")))

    def test_revisions_and_as_of_no_future_leakage(self):
        first = self.put(self.row())
        second = self.put(self.row(value=12, release_key="2024-03", release_date="2024-03-15", retrieved_at="2024-03-16T12:00:00Z"))
        self.assertNotEqual(first, second)
        self.assertEqual(self.count("panel_observation"), 1)
        self.assertEqual(self.store.panel()[0]["value"], 12)
        self.assertEqual(self.store.panel(as_of="2024-02-20")[0]["value"], 10)
        self.assertEqual(self.store.panel(as_of="2024-02-15"), [])
        self.put(self.row())
        self.assertEqual(self.store.panel()[0]["value"], 12)
        self.assertEqual(self.count("observation_revision"), 2)

    def test_reversion_is_a_new_revision_but_unchanged_refetch_is_not(self):
        self.put(self.row())
        self.put(self.row(value=12, retrieved_at="2024-02-17T12:00:00Z"))
        self.put(self.row(value=10, retrieved_at="2024-02-18T12:00:00Z"))
        self.assertEqual(self.store.panel()[0]["value"], 10)
        self.assertEqual(self.count("observation_revision"), 3)
        self.put(self.row(value=10, retrieved_at="2024-02-19T12:00:00Z"))
        self.assertEqual(self.count("observation_revision"), 3)

    def test_unknown_release_excluded_from_strict_asof(self):
        self.put(self.row(release_date=""))
        self.assertEqual(len(self.store.panel()), 1)
        self.assertEqual(self.store.panel(as_of="2025-01-01"), [])
        self.assertIn("release_date_unknown", [w["code"] for w in self.store.quality()["warnings"]])

    def test_same_retrieval_conflict_is_rejected(self):
        self.put(self.row())
        with self.assertRaisesRegex(ValueError, "Conflicting values"):
            self.put(self.row(value=11))
        self.assertEqual(self.count("observation_revision"), 1)

    def test_earlier_evidence_of_identical_value_is_available_asof(self):
        self.put(self.row(retrieved_at="2024-02-18T00:00:00Z"))
        self.put(self.row())
        self.assertEqual(self.store.panel(as_of="2024-02-17")[0]["value"], 10)

    def test_units_cannot_drift_with_same_indicator(self):
        self.put(self.row())
        with self.assertRaisesRegex(ValueError, "indicator"):
            self.put(self.row(unit="USD"))
        self.assertEqual(self.store.panel()[0]["unit"], "persons")

    def test_geography_vintages_and_sources_are_separate(self):
        self.put(self.row())
        self.put(self.row(geography_vintage="2030"))
        self.put(self.row(source_id="TEST_OTHER_SOURCE"))
        self.assertEqual(self.count("panel_observation"), 3)

    def test_batch_validation_is_atomic_and_line_numbered(self):
        rows = list(csv.DictReader(io.StringIO(FIXTURE.read_text(encoding="utf-8"))))
        rows[1]["value"] = "12"
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=rows[0])
        writer.writeheader()
        writer.writerows(rows)
        path = self.root / "invalid.csv"
        path.write_text(stream.getvalue(), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "CSV row 3"):
            import_csv(self.store, path)
        self.assertEqual(self.count("panel_observation"), 0)
        self.assertEqual(self.count("audit_log"), 0)
        self.assertEqual(self.count("ingestion_run"), 1)

    def test_conflicting_duplicate_csv_rows_rejected(self):
        content = FIXTURE.read_text(encoding="utf-8")
        row = content.splitlines()[1].replace(",10,observed,", ",11,observed,")
        path = self.root / "duplicates.csv"
        path.write_text(content + row + "\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Conflicting duplicate"):
            import_csv(self.store, path)
        self.assertEqual(self.count("panel_observation"), 0)

    def test_directory_has_no_lifecycle_claims_and_keeps_location_snapshots(self):
        payload = self.snapshot()
        payload["businesses"][0]["membership_start_date"] = "1990-01-01"
        path = self.write_json("directory.json", payload)
        import_snapshot(self.store, path, True)
        self.assertEqual(import_snapshot(self.store, path, True)["rowsChanged"], 0)
        self.assertEqual(self.count("business_event"), 0)
        location = dict(self.store.db.execute("SELECT * FROM business_location_history").fetchone())
        self.assertIsNone(location["valid_from"])
        self.assertIsNone(location["valid_to"])
        raw = self.store.db.execute("SELECT raw_record FROM provenance").fetchone()[0]
        self.assertNotIn("membership_start_date", raw)
        payload["directorySnapshotDate"] = "2024-06-01"
        payload["businesses"][0]["address"] = "20 Test Road"
        import_snapshot(self.store, self.write_json("new.json", payload), True)
        self.assertEqual(self.count("business_location_history"), 2)
        import_snapshot(self.store, path, True)
        self.assertEqual(self.store.db.execute("SELECT snapshot_date FROM business").fetchone()[0], "2024-06-01")

    def test_duplicate_directory_id_and_invalid_coordinates_rejected(self):
        payload = self.snapshot()
        payload["businesses"].append(payload["businesses"][0])
        with self.assertRaises(ValueError):
            import_snapshot(self.store, self.write_json("duplicate.json", payload), True)
        self.assertEqual(self.count("business"), 0)
        payload = self.snapshot()
        payload["businesses"][0]["latitude"] = 100
        with self.assertRaises(sqlite3.IntegrityError):
            import_snapshot(self.store, self.write_json("invalid.json", payload), True)

    def test_document_spans_and_review_are_not_economic_events(self):
        text = "Planning board\nOn March 2, 2024, commercial development at 10 Test Road was discussed.\nNo zoning change was approved."
        path = self.root / "planning.txt"
        path.write_text(text, encoding="utf-8")
        result = import_document(self.store, path, "https://example.invalid/minutes", "2024-03-03")
        self.assertEqual(result["candidates"], 2)
        rows = [dict(r) for r in self.store.db.execute("SELECT * FROM document_candidate")]
        for row in rows:
            self.assertEqual(text[row["span_start"]:row["span_end"]], row["source_span"])
            for item in json.loads(row["evidence_spans"]):
                self.assertEqual(text[item["start"]:item["end"]], item["text"])
        commercial = next(r for r in rows if r["category"] == "commercial_development")
        self.assertEqual(commercial["candidate_date"], "2024-03-02")
        self.assertEqual(commercial["candidate_place"], "10 Test Road")
        review_candidate(self.store, commercial["id"], "accepted", "Test reviewer", "Confirmed category mention only")
        import_document(self.store, path, "https://example.invalid/minutes", "2024-03-03")
        self.assertEqual(self.store.db.execute("SELECT review_status FROM document_candidate WHERE id=?", (commercial["id"],)).fetchone()[0], "accepted")
        self.assertEqual(self.count("business_event"), 0)

    def test_document_ambiguous_dates_no_invented_choice(self):
        rows = candidates("Zoning change discussed January 2, 2024 and February 3, 2024 near Testville.", ["Testville"])
        self.assertIsNone(rows[0]["candidate_date"])
        self.assertEqual(rows[0]["candidate_place"], "Testville")
        self.assertEqual(candidates("General discussion of the agenda."), [])

    def test_verified_event_needs_human_evidence(self):
        import_snapshot(self.store, self.write_json("dir.json", self.snapshot()), True)
        event = {"id": "TEST_EVENT", "business_id": "TEST_ONLY_BUSINESS", "event_type": "opening",
                 "event_date": "2024-01-01", "verification": "verified", "evidence_text": "Synthetic test evidence"}
        payload = {"source": self.row(), "records": {"business_event": [event]}}
        with self.assertRaises(ValueError):
            import_records(self.store, self.write_json("events.json", payload))
        event.update(verified_by="Test reviewer", verified_at="2024-01-02T00:00:00Z")
        import_records(self.store, self.write_json("events.json", payload))
        self.assertEqual(self.count("business_openings"), 1)
        self.assertEqual(self.count("business_closures"), 0)

    def model_manifest(self, revision):
        return {"run": {"id": "TEST_MODEL", "model_name": "Synthetic test model", "model_version": "1",
                        "code_version": "test", "as_of": "2024-02-20", "status": "succeeded", "limitations": "Synthetic test only"},
                "inputs": [{"revision_id": revision, "transformation": "identity"}],
                "outputs": [{"id": "TEST_OUTPUT", "target_period": "2024-03-01", "output_type": "forecast",
                             "estimate": 10, "lower_bound": 8, "upper_bound": 12, "interval_level": 0.95, "unit": "persons"}]}

    def test_model_manifest_lineage_and_idempotence(self):
        revision = self.put(self.row())
        path = self.write_json("model.json", self.model_manifest(revision))
        import_model(self.store, path)
        import_model(self.store, path)
        self.assertEqual((self.count("model_run"), self.count("model_input"), self.count("model_output")), (1, 1, 1))
        manifest = self.model_manifest(revision)
        manifest["outputs"][0]["estimate"] = 11
        with self.assertRaisesRegex(ValueError, "immutable"):
            import_model(self.store, self.write_json("model.json", manifest))

    def test_model_rejects_leakage_and_bad_interval(self):
        revision = self.put(self.row())
        manifest = self.model_manifest(revision)
        manifest["run"]["as_of"] = "2024-02-15"
        with self.assertRaisesRegex(ValueError, "unavailable"):
            import_model(self.store, self.write_json("model.json", manifest))
        self.assertEqual(self.count("model_run"), 0)
        manifest["run"]["as_of"] = "2024-02-20"
        manifest["outputs"][0]["lower_bound"] = 11
        with self.assertRaisesRegex(ValueError, "interval"):
            import_model(self.store, self.write_json("model.json", manifest))

    def test_model_cannot_add_outputs_to_existing_run(self):
        revision = self.put(self.row())
        manifest = self.model_manifest(revision)
        path = self.write_json("model.json", manifest)
        import_model(self.store, path)
        manifest["outputs"].append({**manifest["outputs"][0], "id": "TEST_SECOND_OUTPUT"})
        with self.assertRaisesRegex(ValueError, "immutable"):
            import_model(self.store, self.write_json("model.json", manifest))
        self.assertEqual(self.count("model_output"), 1)

    def test_research_model_envelope_auto_detects_and_preserves_gates(self):
        payload = {"schemaVersion": "1.0.0", "generatedAt": "2024-02-20T00:00:00Z", "asOfDate": "2024-02-20", "sources": [],
                   "policy": {"id": "policy", "title": "Synthetic gated test", "status": "blocked", "method": {"name": "test"},
                              "requirements": [], "sourceIds": [], "limitations": ["Synthetic test only"], "result": None}}
        path = self.write_json("model-results.json", payload)
        import_model(self.store, path)
        result = import_model(self.store, path)
        self.assertEqual(result["rowsChanged"], 0)
        self.assertEqual(self.count("model_run"), 1)
        self.assertEqual(self.count("model_output"), 0)
        self.assertEqual(self.store.db.execute("SELECT status FROM model_run").fetchone()[0], "gated")

    def test_research_artifact_retains_unknown_retrieval_and_scope(self):
        source = {"id": "TEST_SOURCE", "url": "https://example.invalid/test", "retrievedAt": None,
                  "sha256": "SYNTHETIC_TEST_HASH", "cachePath": "cache.json"}
        self.write_json("cache.json", {"source": source, "data": {"test": 10}})
        payload = {"schemaVersion": "1.0.0", "generatedAt": "2024-02-20T00:00:00Z", "asOfDate": "2024-02-20", "sources": [source],
                   "forecast": {"id": "forecast", "title": "Synthetic test forecast", "status": "experimental", "method": {"name": "test"},
                                "sourceIds": [source["id"]], "limitations": ["Synthetic test only"], "result": {"value": 10}}}
        path = self.write_json("model-results.json", payload)
        import_results(self.store, path, root=self.root)
        self.assertEqual(self.count("model_source_input"), 1)
        self.assertEqual(self.count("model_input"), 0)
        metadata = json.loads(self.store.db.execute("SELECT source_metadata_json FROM model_source_input").fetchone()[0])
        self.assertIsNone(metadata["retrievedAt"])
        source["cachePath"] = "../outside.json"
        with self.assertRaisesRegex(ValueError, "within the project"):
            import_results(self.store, self.write_json("unsafe.json", payload), root=self.root)
        self.assertEqual(self.count("model_run"), 1)

    def test_unknown_model_release_requires_disclosure(self):
        revision = self.put(self.row(release_date=""))
        manifest = self.model_manifest(revision)
        with self.assertRaisesRegex(ValueError, "unknown release"):
            import_model(self.store, self.write_json("model.json", manifest))
        manifest["run"]["limitations"] = "Unknown release dates; latest-vintage run only. Synthetic test."
        import_model(self.store, self.write_json("model.json", manifest))

    def test_export_and_database_overwrite_protection(self):
        self.put(self.row())
        output = self.root / "panel.json"
        self.store.export(output)
        data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(len(data["panel"]), 1)
        self.assertIn("artifact", data["tables"])
        self.assertNotIn("content", data["tables"]["artifact"][0])
        self.store.export(output, as_of="2024-02-15")
        historical = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(historical["panel"], [])
        self.assertEqual(historical["tables"], {})
        with self.assertRaises(ValueError):
            self.store.export(self.store.path)

    def test_csv_panel_roundtrip(self):
        self.put(self.row())
        path = self.root / "export.csv"
        self.store.export(path)
        self.assertEqual(import_csv(self.store, path)["rowsSeen"], 1)
        self.assertEqual(self.count("observation_revision"), 1)

    def test_fetch_wrong_release_rolls_back(self):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'{"release":{"id":"acs2023_5yr","years":"2019-2023"}}'
        with patch("warehouse.ingest.urlopen", return_value=response), self.assertRaisesRegex(ValueError, "release"):
            fetch_acs(self.store, [2024], ["05000US34027"])
        self.assertEqual(self.count("panel_observation"), 0)

    def test_cli_end_to_end(self):
        db = str(self.root / "cli.sqlite")
        base = [sys.executable, "-m", "warehouse", "--db", db]
        for command in (["init"], ["import-csv", str(FIXTURE)], ["quality"], ["export", "--output", str(self.root / "cli.json")]):
            completed = subprocess.run(base + command, capture_output=True, text=True, check=False)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIsInstance(json.loads(completed.stdout), dict)


if __name__ == "__main__":
    unittest.main()
