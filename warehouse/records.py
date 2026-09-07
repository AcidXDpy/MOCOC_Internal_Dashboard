"""Explicit domain evidence and model-lineage imports; no inferred economic events."""

import json
from pathlib import Path

from .store import digest, identity, iso_date, json_text, now, number, required, timestamp


DOMAIN_TABLES = {
    "property", "property_observation", "transportation", "transportation_observation",
    "business_event", "permit", "commercial_activity", "external_shock",
}


def import_records(store, path):
    content = Path(path).read_text(encoding="utf-8-sig")
    payload = json.loads(content)
    with store.ingest("import-records", content, str(Path(path).resolve())):
        source = payload["source"]
        for table, items in payload["records"].items():
            if table not in DOMAIN_TABLES:
                raise ValueError(f"Unsupported domain table: {table}")
            if not isinstance(items, list):
                raise ValueError(f"{table} must be an array")
            types = {r[1]: r[2] for r in store.db.execute(f'PRAGMA table_info("{table}")')}
            for index, item in enumerate(items):
                row = dict(item)
                required(row, "id")
                if "provenance_id" in row:
                    raise ValueError("provenance_id is assigned from this import's evidence")
                for key, value in list(row.items()):
                    if key not in types:
                        raise ValueError(f"Unknown field {table}.{key}")
                    if key.endswith("_date") or key in {"period_start", "period_end", "valid_from", "valid_to"}:
                        row[key] = iso_date(value, key, optional=True)
                    elif key.endswith("_at") and value:
                        row[key] = timestamp(value, key)
                    elif types[key] == "REAL":
                        row[key] = number(value, key, optional=True)
                    elif key == "geometry_geojson" and value:
                        geometry = json.loads(value) if isinstance(value, str) else value
                        if not isinstance(geometry, dict) or "type" not in geometry:
                            raise ValueError("geometry_geojson must be a GeoJSON object")
                        row[key] = json_text(geometry)
                if table == "business_event" and row.get("verification") == "verified":
                    for field in ("verified_by", "verified_at", "evidence_text"):
                        required(row, field)
                    if row["event_date"] > row["verified_at"][:10]:
                        raise ValueError("A future event cannot be verified as having occurred")
                _, provenance, _ = store.evidence(source, f"records.{table}[{index}]", item)
                store.upsert(table, {**row, "provenance_id": provenance})
                store.rows_seen += 1
    return {"rowsSeen": store.rows_seen, "rowsChanged": store.rows_changed}


def import_model(store, path):
    content = Path(path).read_text(encoding="utf-8-sig")
    payload = json.loads(content)
    if "run" not in payload and "sources" in payload and "generatedAt" in payload:
        return import_results(store, path)
    with store.ingest("import-model", content, str(Path(path).resolve())):
        run = dict(payload["run"])
        for field in ("id", "model_name", "model_version", "code_version", "as_of", "status", "limitations"):
            required(run, field)
        run["as_of"] = timestamp(run["as_of"], "as_of")
        previous_run = store.db.execute("SELECT created_at FROM model_run WHERE id=?", (run["id"],)).fetchone()
        run["created_at"] = timestamp(run.get("created_at") or (previous_run[0] if previous_run else now()), "created_at")
        for field in ("training_start", "training_end"):
            run[field] = iso_date(run.get(field), field, optional=True)
        if run["training_start"] and run["training_end"] and run["training_start"] > run["training_end"]:
            raise ValueError("Model training window is reversed")
        if run["training_end"] and run["training_end"] > run["as_of"][:10]:
            raise ValueError("Model training window extends beyond as_of")
        for field in ("parameters_json", "validation_json"):
            value = run.get(field, {})
            run[field] = json_text(json.loads(value) if isinstance(value, str) else value)
        inputs, outputs = payload.get("inputs", []), payload.get("outputs", [])
        if previous_run:
            old_inputs = {(r[0], r[1]) for r in store.db.execute("SELECT revision_id,role FROM model_input WHERE run_id=?", (run["id"],))}
            old_outputs = {r[0] for r in store.db.execute("SELECT id FROM model_output WHERE run_id=?", (run["id"],))}
            if old_inputs != {(r["revision_id"], r.get("role", "training")) for r in inputs} or old_outputs != {r["id"] for r in outputs}:
                raise ValueError("A model run's complete input/output sets are immutable")
        if run["status"] == "succeeded" and not inputs:
            raise ValueError("Successful empirical model runs require explicit observation revision lineage")
        if run["status"] != "succeeded" and outputs:
            raise ValueError("Gated or failed models cannot publish numeric outputs")
        store.upsert("model_run", run, immutable=True)
        for item in inputs:
            revision_id = required(item, "revision_id")
            revision = store.db.execute("SELECT * FROM panel_all_revisions WHERE revision_id=?", (revision_id,)).fetchone()
            if not revision:
                raise ValueError(f"Unknown input revision: {revision_id}")
            if revision["retrieved_at"] > run["as_of"] or (revision["release_date"] and revision["release_date"] > run["as_of"][:10]):
                raise ValueError("Model input was unavailable at the run's as_of cutoff")
            if revision["release_date"] is None and "unknown release" not in run["limitations"].lower():
                raise ValueError("Inputs with unknown release dates require 'unknown release' disclosure in limitations")
            role = item.get("role", "training")
            transformation = required(item, "transformation")
            previous = store.db.execute("SELECT transformation FROM model_input WHERE run_id=? AND revision_id=? AND role=?",
                                        (run["id"], revision_id, role)).fetchone()
            if previous and previous[0] != transformation:
                raise ValueError("A model input transformation is immutable")
            store.db.execute("INSERT OR IGNORE INTO model_input VALUES(?,?,?,?)", (run["id"], revision_id, role, transformation))
        existing_inputs = {(r[0], r[1]) for r in store.db.execute("SELECT revision_id,role FROM model_input WHERE run_id=?", (run["id"],))}
        if existing_inputs != {(r["revision_id"], r.get("role", "training")) for r in inputs}:
            raise ValueError("A model run's complete input lineage is immutable")
        for item in outputs:
            row = {**item, "run_id": run["id"]}
            for field in ("estimate", "lower_bound", "upper_bound", "interval_level"):
                row[field] = number(row.get(field), field, optional=True)
            if (row["lower_bound"] is None) != (row["upper_bound"] is None):
                raise ValueError("Model intervals require both bounds")
            if row["lower_bound"] is not None and (row["interval_level"] is None or row["estimate"] is None
                    or not row["lower_bound"] <= row["estimate"] <= row["upper_bound"]):
                raise ValueError("Model intervals need a level and must contain the estimate")
            row["payload_json"] = json_text(row.get("payload_json", {}))
            store.upsert("model_output", row, immutable=True)
        existing_outputs = {r[0] for r in store.db.execute("SELECT id FROM model_output WHERE run_id=?", (run["id"],))}
        if existing_outputs != {r["id"] for r in outputs}:
            raise ValueError("A model run's complete output set is immutable")
    return {"modelRunId": run["id"], "inputs": len(inputs), "outputs": len(outputs)}


def import_results(store, path, root=None):
    """Archive the research export and declared inputs without inventing fitted-row lineage."""
    content = Path(path).read_text(encoding="utf-8-sig")
    payload = json.loads(content)
    root = Path(root or Path(__file__).resolve().parents[1]).resolve()
    generated = timestamp(required(payload, "generatedAt"))
    sources = {source["id"]: source for source in payload["sources"]}
    modules = {k: v for k, v in payload.items() if isinstance(v, dict) and "method" in v and "status" in v}
    imported = []
    with store.ingest("import-results", content, str(Path(path).resolve()), generated):
        for key, module in modules.items():
            state = module["status"]
            if state not in {"ready", "experimental", "blocked"}:
                raise ValueError(f"Unknown research status: {state}")
            run_id = identity(key, generated, module, payload["sources"])
            source_ids = module.get("sourceIds", [])
            missing = set(source_ids) - set(sources)
            if missing:
                raise ValueError(f"Research result has undeclared sources: {missing}")
            limitations = list(module.get("limitations", [])) + [
                "Unknown release dates prevent a historical vintage availability claim.",
                "Observation links have source_scope role: they identify the declared source snapshot, not exact fitted rows.",
                "Research export did not record a code commit or full fit parameter manifest; the original result envelope is retained.",
            ]
            result = module.get("result")
            if state == "blocked" and result is not None:
                raise ValueError("Blocked research modules must have result:null")
            store.upsert("model_run", {"id": run_id, "model_name": module.get("title") or key,
                        "model_version": str(payload["schemaVersion"]), "code_version": "not_recorded_by_research_export",
                        "parameters_json": json_text({k: v for k, v in module.items() if k != "result"}),
                        "as_of": generated, "created_at": generated,
                        "status": "gated" if state == "blocked" else "succeeded",
                        "validation_json": json_text(result.get("validation", {}) if isinstance(result, dict) else {}),
                        "limitations": " ".join(limitations)}, immutable=True)
            for source_id in source_ids:
                source = sources[source_id]
                retrieved = timestamp(source["retrievedAt"]) if source.get("retrievedAt") else None
                if retrieved and retrieved > generated:
                    raise ValueError("Research source was retrieved after the result was generated")
                cache_path = (root / source["cachePath"]).resolve()
                if not cache_path.is_relative_to(root):
                    raise ValueError("Source cache path must remain within the project")
                cache_content = cache_path.read_text(encoding="utf-8-sig")
                cache = json.loads(cache_content)
                if "source" in cache:
                    if cache["source"].get("id") != source_id or cache["source"].get("sha256") != source["sha256"]:
                        raise ValueError("Research source metadata does not match the cached acquisition")
                elif source_id == "directory-snapshot":
                    import hashlib
                    if hashlib.sha256(cache_path.read_bytes()).hexdigest() != source["sha256"]:
                        raise ValueError("Directory source snapshot digest does not match model provenance")
                else:
                    raise ValueError("Unsupported research source cache format")
                artifact_id = identity(digest(cache_content), source["url"])
                store.db.execute("INSERT OR IGNORE INTO artifact VALUES(?,?,?,?,?)",
                                 (artifact_id, digest(cache_content), source["url"], retrieved or now(), cache_content))
                store.db.execute("INSERT OR IGNORE INTO model_source_input VALUES(?,?,?,?,?)",
                                 (run_id, source_id, artifact_id, digest(cache_content), json_text(source)))
                # The hash suffix binds panel rows to this acquisition when the CSV supplies one.
                release_key = source_id + ":" + source["sha256"][:12]
                revisions = store.db.execute("SELECT revision_id,retrieved_at FROM panel_all_revisions WHERE source_id=? AND release_key=?",
                                             (source_id, release_key)).fetchall()
                for revision in revisions:
                    if revision["retrieved_at"] > generated:
                        raise ValueError("Source-scope panel revision was unavailable when the model ran")
                    store.db.execute("INSERT OR IGNORE INTO model_input VALUES(?,?,?,?)",
                                     (run_id, revision["revision_id"], "source_scope", "Declared acquisition scope; exact fit subset is recorded only in the research pipeline"))
            if result is not None:
                store.upsert("model_output", {"id": identity(run_id, "result"), "run_id": run_id,
                            "target_period": payload["asOfDate"], "output_type": "research_result_bundle",
                            "unit": "mixed_explicit_in_payload", "payload_json": json_text(module)}, immutable=True)
            imported.append({"module": key, "runId": run_id, "status": state})
    return {"models": imported, "rowsChanged": store.rows_changed}
