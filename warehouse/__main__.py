"""Run with python -m warehouse; no third-party dependency or account required."""

import argparse
import json
import sqlite3
import sys

from .documents import import_document, review_candidate
from .ingest import fetch_acs, import_snapshot
from .records import import_model, import_records, import_results
from .store import Warehouse, import_csv


def parser():
    cli = argparse.ArgumentParser(description="Local economic evidence warehouse")
    cli.add_argument("--db", default="warehouse/data/economy.sqlite", help="SQLite database path")
    sub = cli.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="Initialize/version-check the schema")
    for command in ("import-directory", "import-snapshot", "import-csv", "import-records", "import-model", "import-results"):
        sub.add_parser(command).add_argument("path")
    acs = sub.add_parser("fetch-acs", help="Fetch fixed-vintage public ACS estimates through Census Reporter")
    acs.add_argument("--years", nargs="+", type=int, default=[2024])
    acs.add_argument("--geographies", nargs="+", default=["06000US3402749080", "05000US34027"])
    acs.add_argument("--release-date", action="append", default=[], metavar="YEAR=YYYY-MM-DD", help="Only supply a verified publication date")
    export = sub.add_parser("export")
    export.add_argument("--output", required=True, help=".json normalized export or .csv panel")
    versions = export.add_mutually_exclusive_group()
    versions.add_argument("--as-of", help="Strict historical availability cutoff, excluding unknown publication dates")
    versions.add_argument("--all-revisions", action="store_true")
    sub.add_parser("quality")
    extract = sub.add_parser("extract-document", help="Extract review candidates from planning text")
    extract.add_argument("path")
    extract.add_argument("--source-url", required=True)
    extract.add_argument("--retrieved-at", required=True)
    extract.add_argument("--title")
    extract.add_argument("--places", nargs="*", default=[])
    review = sub.add_parser("review-candidate")
    review.add_argument("candidate_id")
    review.add_argument("--decision", choices=["accepted", "rejected"], required=True)
    review.add_argument("--reviewer", required=True)
    review.add_argument("--notes", required=True)
    return cli


def main(argv=None):
    args = parser().parse_args(argv)
    store = None
    try:
        store = Warehouse(args.db)
        store.init()
        command = args.command
        if command == "init":
            result = {"database": str(store.path), "schemaVersion": 1}
        elif command in {"import-directory", "import-snapshot"}:
            result = import_snapshot(store, args.path, directory_only=command == "import-directory")
        elif command == "import-csv":
            result = import_csv(store, args.path)
        elif command == "import-records":
            result = import_records(store, args.path)
        elif command == "import-model":
            result = import_model(store, args.path)
        elif command == "import-results":
            result = import_results(store, args.path)
        elif command == "fetch-acs":
            release_dates = {int(k): v for k, v in (item.split("=", 1) for item in args.release_date)}
            result = fetch_acs(store, args.years, args.geographies, release_dates)
        elif command == "export":
            result = store.export(args.output, args.as_of, args.all_revisions)
        elif command == "quality":
            result = store.quality()
        elif command == "extract-document":
            result = import_document(store, args.path, args.source_url, args.retrieved_at, args.title, args.places)
        elif command == "review-candidate":
            result = review_candidate(store, args.candidate_id, args.decision, args.reviewer, args.notes)
        print(json.dumps(result, indent=2, allow_nan=False))
        return 1 if command == "quality" and not result["ok"] else 0
    except (ValueError, KeyError, TypeError, OSError, sqlite3.Error) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    finally:
        if store:
            store.close()


if __name__ == "__main__":
    raise SystemExit(main())
