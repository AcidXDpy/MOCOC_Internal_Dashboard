"""Transparent planning-text candidate extraction with exact stored-text spans."""

from datetime import datetime
import json
from pathlib import Path
import re
import uuid

from .store import digest, identity, now, required, timestamp


EXTRACTOR_VERSION = "planning-rules-1"
CATEGORIES = {
    "residential_development": r"\b(?:residential development|apartments?|townhouses?|housing development|subdivision)\b",
    "commercial_development": r"\b(?:commercial development|retail development|shopping cent(?:er|re)|warehouse|office building)\b",
    "infrastructure": r"\b(?:road (?:construction|closure|improvement)|bridge|sidewalk|water main|sewer|traffic signal)\b",
    "zoning_change": r"\b(?:rezon(?:e|ing)|zoning (?:change|amendment)|use variance)\b",
    "business_expansion": r"\b(?:business expansion|expand(?:ing|ed)? (?:the |its )?(?:business|facility|store)|building addition)\b",
}
DATE_PATTERN = re.compile(r"\b(?:\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b", re.I)
ADDRESS_PATTERN = re.compile(r"\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,6}(?:Street|St\b|Road|Rd\b|Avenue|Ave\b|Drive|Dr\b|Lane|Ln\b|Boulevard|Blvd\b|Court|Ct\b|Highway|Way)\b", re.I)


def candidates(text, places=()):
    output = []
    place_patterns = [re.compile(r"\b" + re.escape(p) + r"\b", re.I) for p in places if p.strip()]
    for segment in re.finditer(r"[^\n]+", text):
        sentence = segment.group()
        date_spans, place_spans = [], []
        for match in DATE_PATTERN.finditer(sentence):
            date_text = match.group()
            try:
                date_value = datetime.strptime(date_text, "%Y-%m-%d").date().isoformat() if "-" in date_text else datetime.strptime(date_text.replace(",", ""), "%B %d %Y").date().isoformat()
            except ValueError:
                continue
            date_spans.append(span("date", match, segment.start(), date_value))
        for pattern in [ADDRESS_PATTERN, *place_patterns]:
            for match in pattern.finditer(sentence):
                place_spans.append(span("place", match, segment.start(), match.group()))
        for category, pattern in CATEGORIES.items():
            matches = list(re.finditer(pattern, sentence, re.I))
            if not matches:
                continue
            evidence = [span("category", m, segment.start(), category) for m in matches] + date_spans + place_spans
            dates = {s["value"] for s in date_spans}
            places_found = {s["value"] for s in place_spans}
            output.append({"category": category, "candidate_date": next(iter(dates)) if len(dates) == 1 else None,
                           "candidate_place": next(iter(places_found)) if len(places_found) == 1 else None,
                           "span_start": segment.start(), "span_end": segment.end(), "source_span": sentence,
                           "evidence_spans": json.dumps(evidence, sort_keys=True), "extractor_version": EXTRACTOR_VERSION})
    return output


def span(kind, match, offset, value):
    return {"kind": kind, "start": offset + match.start(), "end": offset + match.end(),
            "text": match.group(), "value": value}


def import_document(store, path, source_url, retrieved_at, title=None, places=()):
    text = Path(path).read_text(encoding="utf-8-sig")
    document_id = identity(source_url, digest(text))
    with store.ingest("extract-document", text, source_url, retrieved_at):
        _, provenance, _ = store.evidence({"source_id": "planning_documents", "source_name": "Public planning documents",
                "source_homepage": "public-planning-documents", "source_url": source_url,
                "release_key": document_id, "retrieved_at": retrieved_at}, "full_text", {"text_sha256": digest(text)})
        store.upsert("document", {"id": document_id, "title": title or Path(path).name,
                    "text": text, "text_sha256": digest(text), "provenance_id": provenance})
        items = candidates(text, places)
        for item in items:
            candidate_id = identity(document_id, item["span_start"], item["span_end"], item["category"], EXTRACTOR_VERSION)
            # An extraction repeat must not reset a human review.
            existing = store.db.execute("SELECT id FROM document_candidate WHERE id=?", (candidate_id,)).fetchone()
            if not existing:
                store.upsert("document_candidate", {"id": candidate_id, "document_id": document_id, **item}, immutable=True)
            store.rows_seen += 1
    return {"documentId": document_id, "candidates": len(items), "reviewStatus": "pending for new candidates"}


def review_candidate(store, candidate_id, decision, reviewer, notes):
    reviewer = required({"reviewer": reviewer}, "reviewer")
    notes = required({"notes": notes}, "notes")
    if decision not in {"accepted", "rejected"}:
        raise ValueError("Review decision must be accepted or rejected")
    payload = {"candidate_id": candidate_id, "reviewer": reviewer, "notes": notes, "decision": decision}
    with store.ingest("review-candidate", json.dumps(payload)):
        if not store.db.execute("SELECT 1 FROM document_candidate WHERE id=?", (candidate_id,)).fetchone():
            raise ValueError("Unknown candidate ID")
        store.upsert("candidate_review", {"id": uuid.uuid4().hex, **payload, "reviewed_at": now()}, immutable=True)
        store.upsert("document_candidate", {"id": candidate_id, "review_status": decision})
    return {"candidateId": candidate_id, "decision": decision,
            "economicEventCreated": False}
