"""Validated evidence writes, immutable panel revisions, and portable exports."""

from contextlib import contextmanager
import csv
from datetime import date, datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import sqlite3
import uuid

from . import SCHEMA_VERSION


def now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def json_text(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True, allow_nan=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def identity(*parts):
    return digest(json_text(parts))[:32]


def iso_date(value, field, optional=False):
    if value in (None, "") and optional:
        return None
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError(f"{field}: expected YYYY-MM-DD")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field}: invalid calendar date {value!r}") from exc
    if parsed.isoformat() != value:
        raise ValueError(f"{field}: expected YYYY-MM-DD")
    return value


def timestamp(value, field="retrieved_at"):
    if isinstance(value, str) and len(value) == 10:
        # Date-only source metadata has day precision, so availability is conservatively end-of-day.
        return iso_date(value, field) + "T23:59:59.999999Z"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone required")
        return parsed.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError(f"{field}: expected ISO date or timezone-aware timestamp") from exc


def number(value, field, optional=False):
    if value in (None, "") and optional:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{field}: expected finite number")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field}: expected finite number, got {value!r}") from exc
    if not math.isfinite(parsed):
        raise ValueError(f"{field}: expected finite number")
    return parsed


def required(row, field):
    value = row.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field}: required non-empty text")
    return value.strip()


class Warehouse:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA busy_timeout=30000")
        self.run_id = None
        self.artifact_id = None
        self.rows_seen = 0
        self.rows_changed = 0

    def close(self):
        self.db.close()

    def init(self):
        existing = self.db.execute("SELECT name FROM sqlite_master WHERE name='schema_version'").fetchone()
        if existing:
            versions = [r[0] for r in self.db.execute("SELECT version FROM schema_version")]
            if versions != [SCHEMA_VERSION]:
                raise ValueError(f"Unsupported schema version: {versions}")
        self.db.executescript(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
        self.db.commit()

    @contextmanager
    def ingest(self, command, content, source_url="local-file", retrieved_at=None):
        if self.run_id:
            raise RuntimeError("Nested ingestion is not supported")
        self.run_id = uuid.uuid4().hex
        self.rows_seen = self.rows_changed = 0
        self.db.execute("INSERT INTO ingestion_run(id,command,input_sha256,started_at,status) VALUES(?,?,?,?,?)",
                        (self.run_id, command, digest(content), now(), "running"))
        self.db.commit()
        try:
            self.db.execute("BEGIN IMMEDIATE")
            retrieved = timestamp(retrieved_at or now())
            self.artifact_id = identity(digest(content), source_url)
            self.db.execute("INSERT OR IGNORE INTO artifact VALUES(?,?,?,?,?)",
                            (self.artifact_id, digest(content), source_url, retrieved, content))
            yield self
            self.db.execute("UPDATE ingestion_run SET status='succeeded',completed_at=?,rows_seen=?,rows_changed=? WHERE id=?",
                            (now(), self.rows_seen, self.rows_changed, self.run_id))
            self.db.commit()
        except Exception as exc:
            self.db.rollback()
            self.db.execute("UPDATE ingestion_run SET status='failed',completed_at=?,rows_seen=?,error=? WHERE id=?",
                            (now(), self.rows_seen, str(exc)[:2000], self.run_id))
            self.db.commit()
            raise
        finally:
            self.run_id = self.artifact_id = None

    def upsert(self, table, row, immutable=False):
        if not self.run_id:
            raise RuntimeError("Writes require an audited ingestion transaction")
        allowed = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if table not in allowed:
            raise ValueError(f"Unknown table: {table}")
        columns = {r[1] for r in self.db.execute(f'PRAGMA table_info("{table}")')}
        if not set(row) <= columns or "id" not in row:
            raise ValueError(f"Invalid columns for {table}: {set(row) - columns}")
        old = self.db.execute(f'SELECT * FROM "{table}" WHERE id=?', (row["id"],)).fetchone()
        if old and all(old[k] == v for k, v in row.items()):
            return False
        if old and immutable:
            raise ValueError(f"Conflicting immutable {table} metadata: {row['id']}")
        names = list(row)
        quoted = ",".join(f'"{k}"' for k in names)
        if old:
            changed = [k for k in names if k != "id"]
            assignments = ",".join(f'"{k}"=?' for k in changed)
            self.db.execute(f'UPDATE "{table}" SET {assignments} WHERE id=?', [row[k] for k in changed] + [row["id"]])
        else:
            self.db.execute(f'INSERT INTO "{table}" ({quoted}) VALUES ({",".join("?" for _ in names)})', [row[k] for k in names])
        self.db.execute("INSERT INTO audit_log(run_id,entity_type,entity_id,action,before_json,after_json,changed_at) VALUES(?,?,?,?,?,?,?)",
                        (self.run_id, table, row["id"], "update" if old else "insert",
                         json_text(dict(old)) if old else None, json_text(row), now()))
        self.rows_changed += 1
        return True

    def evidence(self, row, locator, raw=None):
        source_id = required(row, "source_id")
        source_url = required(row, "source_url")
        existing_source = self.db.execute("SELECT * FROM source WHERE id=?", (source_id,)).fetchone()
        self.upsert("source", {"id": source_id, "name": row.get("source_name") or source_id,
                               "url": row.get("source_homepage") or (existing_source["url"] if existing_source else source_url)}, immutable=True)
        release_key = required(row, "release_key")
        release_id = identity(source_id, release_key)
        release_date = iso_date(row.get("release_date"), "release_date", optional=True)
        retrieved = timestamp(required(row, "retrieved_at"))
        if release_date and release_date > retrieved[:10]:
            raise ValueError("release_date cannot be after retrieved_at")
        release = {"id": release_id, "source_id": source_id, "release_key": release_key,
                   "release_date": release_date, "release_date_source": row.get("release_date_source") or None}
        self.upsert("source_release", release, immutable=True)
        provenance_id = identity(release_id, self.artifact_id, locator)
        self.upsert("provenance", {"id": provenance_id, "release_id": release_id,
                    "artifact_id": self.artifact_id, "source_url": source_url,
                    "record_locator": str(locator), "raw_record": json_text(raw if raw is not None else row)}, immutable=True)
        self.db.execute("INSERT OR IGNORE INTO ingestion_evidence VALUES(?,?)", (self.run_id, provenance_id))
        return release_id, provenance_id, retrieved

    def geography(self, row):
        code = required(row, "geography_id")
        kind = row.get("geography_type") or "unspecified"
        vintage = str(row.get("geography_vintage") or "unspecified")
        key = identity(code, kind, vintage)
        self.upsert("geography", {"id": key, "code": code, "name": row.get("geography_name") or code,
                                 "geography_type": kind, "vintage": vintage}, immutable=True)
        return key

    def observation(self, row, locator):
        self.rows_seen += 1
        indicator_id = required(row, "indicator_id")
        start = iso_date(required(row, "period_start"), "period_start")
        end = iso_date(required(row, "period_end"), "period_end")
        if start > end:
            raise ValueError("period_start must not be after period_end")
        retrieved = timestamp(required(row, "retrieved_at"))
        observed = iso_date(row.get("observed_date") or end, "observed_date")
        if end > retrieved[:10] or observed > retrieved[:10]:
            raise ValueError("Observed data cannot have a future period/date relative to retrieval")
        status = required(row, "status")
        if status not in {"observed", "missing", "suppressed", "not_applicable"}:
            raise ValueError(f"Invalid observation status: {status}")
        value = number(row.get("value"), "value", optional=status != "observed")
        if status != "observed" and value is not None:
            raise ValueError("Missing/suppressed/not_applicable observations must have an empty value")
        moe = number(row.get("margin_of_error"), "margin_of_error", optional=True)
        confidence = number(row.get("moe_confidence"), "moe_confidence", optional=True)
        if moe is not None and (moe < 0 or status != "observed"):
            raise ValueError("margin_of_error requires observed status and a nonnegative value")
        flags = row.get("quality_flags") or []
        if isinstance(flags, str):
            flags = json.loads(flags)
        if not isinstance(flags, list) or any(not isinstance(f, str) for f in flags):
            raise ValueError("quality_flags must be a JSON array of strings")
        release_id, provenance_id, retrieved = self.evidence(row, locator)
        geography_id = self.geography(row)
        domain = {"labor": "employment", "industry": "business", "household_context": "demographics"}.get(row.get("domain"), row.get("domain") or "other")
        self.upsert("indicator", {"id": indicator_id, "name": row.get("indicator_name") or indicator_id,
                    "domain": domain, "unit": row.get("unit") or "unspecified",
                    "universe": row.get("universe") or "unspecified",
                    "seasonal_adjustment": row.get("seasonal_adjustment") or "not_applicable"}, immutable=True)
        industry_id = row.get("industry_id") or None
        if industry_id:
            self.upsert("industry", {"id": industry_id, "system": row.get("industry_system") or "NAICS",
                        "code": row.get("industry_code") or industry_id,
                        "vintage": row.get("industry_vintage") or "unspecified",
                        "name": row.get("industry_name") or industry_id}, immutable=True)
        observation = {"indicator_id": indicator_id, "geography_id": geography_id, "industry_id": industry_id,
                       "population_group": row.get("population_group") or "all", "period_start": start,
                       "period_end": end, "frequency": "five_year" if row.get("frequency") == "five_year_pooled" else row.get("frequency") or "annual", "source_id": row["source_id"]}
        observation_id = identity(observation)
        self.upsert("panel_observation", {"id": observation_id, **observation}, immutable=True)
        values = {"value": value, "status": status, "margin_of_error": moe, "moe_confidence": confidence,
                  "observed_date": observed, "method": row.get("method") or "direct",
                  "quality_flags": json_text(sorted(set(flags)))}
        fingerprint = digest(json_text({**values, "retrieved_at": retrieved}))
        revision_id = identity(observation_id, release_id, fingerprint)
        latest = self.db.execute("SELECT * FROM observation_revision WHERE observation_id=? AND release_id=? ORDER BY retrieved_at DESC,id DESC LIMIT 1",
                                 (observation_id, release_id)).fetchone()
        same_values = latest and all(latest[k] == v for k, v in values.items())
        if latest and latest["retrieved_at"] == retrieved and not same_values:
            raise ValueError("Conflicting values for the same observation, release and retrieval timestamp")
        unchanged = same_values and retrieved >= latest["retrieved_at"]
        # A changed value can later revert. Keep that later revision even when the value was seen before.
        if not unchanged and not self.db.execute("SELECT 1 FROM observation_revision WHERE id=?", (revision_id,)).fetchone():
            self.upsert("observation_revision", {"id": revision_id, "observation_id": observation_id,
                        "release_id": release_id, **values, "retrieved_at": retrieved,
                        "provenance_id": provenance_id, "fingerprint": fingerprint}, immutable=True)
        return revision_id

    def panel(self, as_of=None, all_revisions=False):
        if all_revisions:
            sql, args = "SELECT * FROM panel_all_revisions", ()
        elif as_of:
            cutoff = timestamp(as_of, "as_of")
            sql = """SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY observation_id
                ORDER BY release_date DESC,retrieved_at DESC,revision_id DESC) AS revision_rank
                FROM panel_all_revisions WHERE release_date IS NOT NULL AND release_date<=?
                AND retrieved_at<=?) WHERE revision_rank=1"""
            args = (cutoff[:10], cutoff)
        else:
            sql, args = "SELECT * FROM panel_current", ()
        return [dict(r) for r in self.db.execute(sql + " ORDER BY geography_id,indicator_id,period_end,revision_id", args)]

    def quality(self):
        integrity = [r[0] for r in self.db.execute("PRAGMA integrity_check")]
        foreign_keys = [tuple(r) for r in self.db.execute("PRAGMA foreign_key_check")]
        tables = [r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        counts = {t: self.db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
        warnings = []
        queries = {
            "release_date_unknown": "SELECT COUNT(*) FROM source_release WHERE release_date IS NULL",
            "geography_vintage_unknown": "SELECT COUNT(*) FROM geography WHERE vintage='unspecified'",
            "unreviewed_document_candidates": "SELECT COUNT(*) FROM document_candidate WHERE review_status='pending'",
            "unverified_business_events": "SELECT COUNT(*) FROM business_event WHERE verification='candidate'",
            "missing_or_suppressed": "SELECT COUNT(*) FROM panel_current WHERE status<>'observed'",
            "unverified_directory_coordinates": "SELECT COUNT(*) FROM business_location_history WHERE latitude IS NOT NULL AND coordinate_method='public_directory_unverified'",
            "acs_overlapping_period_estimates": "SELECT COUNT(*) FROM panel_current WHERE frequency='five_year'",
            "failed_ingestions": "SELECT COUNT(*) FROM ingestion_run WHERE status='failed'",
            "models_without_inputs": "SELECT COUNT(*) FROM model_run r WHERE status='succeeded' AND NOT EXISTS(SELECT 1 FROM model_input i WHERE i.run_id=r.id)",
        }
        for code, query in queries.items():
            count = self.db.execute(query).fetchone()[0]
            if count:
                warnings.append({"code": code, "count": count})
        return {"ok": integrity == ["ok"] and not foreign_keys, "integrity": integrity,
                "foreignKeyErrors": foreign_keys, "counts": counts, "warnings": warnings}

    def export(self, output, as_of=None, all_revisions=False):
        target = Path(output)
        if target.resolve() == self.path.resolve():
            raise ValueError("Export path must not be the database")
        target.parent.mkdir(parents=True, exist_ok=True)
        panel = self.panel(as_of=as_of, all_revisions=all_revisions)
        if target.suffix.lower() == ".csv":
            buffer = io.StringIO(newline="")
            columns = list(panel[0]) if panel else [r[1] for r in self.db.execute("PRAGMA table_info(panel_all_revisions)")]
            writer = csv.DictWriter(buffer, fieldnames=columns)
            writer.writeheader()
            writer.writerows(panel)
            content = buffer.getvalue()
        else:
            tables = [] if as_of else [r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            content = json.dumps({"schemaVersion": SCHEMA_VERSION, "exportedAt": now(), "asOf": as_of,
                                  "panel": panel, "quality": self.quality(),
                                  "tables": {t: [dict(r) for r in self.db.execute(
                                      'SELECT id,sha256,source_url,retrieved_at FROM artifact' if t == "artifact" else f'SELECT * FROM "{t}"')]
                                             for t in tables}}, indent=2, allow_nan=False)
        temp = target.with_name(target.name + ".tmp")
        temp.write_text(content, encoding="utf-8")
        temp.replace(target)
        return {"output": str(target), "panelRows": len(panel)}


CSV_FIELDS = set("indicator_id indicator_name domain unit universe seasonal_adjustment geography_id geography_name geography_type geography_vintage industry_id industry_system industry_code industry_vintage industry_name population_group period_start period_end frequency value status margin_of_error moe_confidence observed_date source_id source_name source_url source_homepage release_key release_date release_date_source retrieved_at method quality_flags observation_id revision_id geography_key provenance_id revision_rank".split())
CSV_REQUIRED = set("indicator_id geography_id period_start period_end value status source_id source_url release_key retrieved_at".split())


def import_csv(store, path):
    content = Path(path).read_text(encoding="utf-8-sig")
    with store.ingest("import-csv", content, str(Path(path).resolve())):
        reader = csv.DictReader(io.StringIO(content, newline=""))
        fields = reader.fieldnames or []
        if len(fields) != len(set(fields)):
            raise ValueError("CSV contains duplicate column headers")
        missing, extra = CSV_REQUIRED - set(fields), set(fields) - CSV_FIELDS
        if missing or extra:
            raise ValueError(f"CSV columns: missing {sorted(missing)}; unsupported {sorted(extra)}")
        seen = {}
        for line, row in enumerate(reader, 2):
            try:
                if None in row or any(v is None for v in row.values()):
                    raise ValueError("CSV row does not match header width")
                key = tuple(row.get(k, "") for k in ("indicator_id", "geography_id", "geography_type", "geography_vintage",
                            "industry_id", "population_group", "period_start", "period_end", "frequency", "source_id", "release_key"))
                if key in seen and seen[key] != row:
                    raise ValueError("Conflicting duplicate observation/release in the same CSV")
                seen[key] = row
                store.observation(row, f"csv:row:{line}")
            except (ValueError, sqlite3.IntegrityError) as exc:
                raise ValueError(f"CSV row {line}: {exc}") from exc
    return {"rowsSeen": store.rows_seen, "rowsChanged": store.rows_changed}
