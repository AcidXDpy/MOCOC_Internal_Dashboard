PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES (1);

CREATE TABLE IF NOT EXISTS source (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
    license TEXT NOT NULL DEFAULT 'unspecified', limitations TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS source_release (
    id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source,
    release_key TEXT NOT NULL, release_date TEXT, release_date_source TEXT,
    UNIQUE(source_id, release_key)
);
CREATE TABLE IF NOT EXISTS ingestion_run (
    id TEXT PRIMARY KEY, command TEXT NOT NULL, input_sha256 TEXT NOT NULL,
    started_at TEXT NOT NULL, completed_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    rows_seen INTEGER NOT NULL DEFAULT 0, rows_changed INTEGER NOT NULL DEFAULT 0,
    error TEXT
);
CREATE TABLE IF NOT EXISTS artifact (
    id TEXT PRIMARY KEY, sha256 TEXT NOT NULL, source_url TEXT NOT NULL,
    retrieved_at TEXT NOT NULL, content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provenance (
    id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES source_release,
    artifact_id TEXT NOT NULL REFERENCES artifact, source_url TEXT NOT NULL,
    record_locator TEXT NOT NULL, raw_record TEXT NOT NULL,
    UNIQUE(release_id, artifact_id, record_locator)
);
CREATE TABLE IF NOT EXISTS ingestion_evidence (
    run_id TEXT NOT NULL REFERENCES ingestion_run,
    provenance_id TEXT NOT NULL REFERENCES provenance,
    PRIMARY KEY(run_id, provenance_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ingestion_run,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('insert','update')),
    before_json TEXT, after_json TEXT NOT NULL, changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS geography (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL,
    geography_type TEXT NOT NULL, vintage TEXT NOT NULL,
    parent_id TEXT REFERENCES geography, geometry_geojson TEXT,
    crs TEXT NOT NULL DEFAULT 'EPSG:4326', provenance_id TEXT REFERENCES provenance,
    UNIQUE(code, geography_type, vintage)
);
CREATE TABLE IF NOT EXISTS industry (
    id TEXT PRIMARY KEY, system TEXT NOT NULL, code TEXT NOT NULL,
    vintage TEXT NOT NULL, name TEXT NOT NULL, parent_id TEXT REFERENCES industry,
    UNIQUE(system, code, vintage)
);
CREATE TABLE IF NOT EXISTS business (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL, snapshot_date TEXT NOT NULL,
    provenance_id TEXT NOT NULL REFERENCES provenance
);
CREATE TABLE IF NOT EXISTS business_industry (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business,
    industry_id TEXT NOT NULL REFERENCES industry, snapshot_date TEXT NOT NULL,
    verification TEXT NOT NULL CHECK(verification IN ('directory_category','candidate','verified')),
    provenance_id TEXT NOT NULL REFERENCES provenance,
    UNIQUE(business_id, industry_id, snapshot_date)
);
CREATE TABLE IF NOT EXISTS business_location_history (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business,
    location_label TEXT NOT NULL DEFAULT 'directory', snapshot_date TEXT NOT NULL,
    valid_from TEXT, valid_to TEXT,
    address TEXT, city TEXT, state TEXT, postal_code TEXT,
    geography_id TEXT REFERENCES geography,
    latitude REAL CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL CHECK(longitude BETWEEN -180 AND 180),
    coordinate_method TEXT NOT NULL DEFAULT 'public_directory_unverified',
    provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK((latitude IS NULL) = (longitude IS NULL)),
    CHECK(valid_to IS NULL OR (valid_from IS NOT NULL AND valid_to >= valid_from)),
    UNIQUE(business_id, location_label, snapshot_date)
);
CREATE TABLE IF NOT EXISTS indicator (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL
      CHECK(domain IN ('demographics','employment','business','property','transportation','activity','other')),
    unit TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    universe TEXT NOT NULL DEFAULT 'unspecified', seasonal_adjustment TEXT NOT NULL DEFAULT 'not_applicable'
);
CREATE TABLE IF NOT EXISTS panel_observation (
    id TEXT PRIMARY KEY, indicator_id TEXT NOT NULL REFERENCES indicator,
    geography_id TEXT NOT NULL REFERENCES geography,
    industry_id TEXT REFERENCES industry,
    population_group TEXT NOT NULL DEFAULT 'all',
    period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','monthly','quarterly','annual','five_year','irregular')),
    source_id TEXT NOT NULL REFERENCES source,
    CHECK(period_end >= period_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS panel_identity ON panel_observation
 (indicator_id, geography_id, COALESCE(industry_id,''), population_group, period_start, period_end, frequency, source_id);
CREATE TABLE IF NOT EXISTS observation_revision (
    id TEXT PRIMARY KEY, observation_id TEXT NOT NULL REFERENCES panel_observation,
    release_id TEXT NOT NULL REFERENCES source_release,
    value REAL, status TEXT NOT NULL CHECK(status IN ('observed','missing','suppressed','not_applicable')),
    margin_of_error REAL CHECK(margin_of_error >= 0), moe_confidence REAL CHECK(moe_confidence > 0 AND moe_confidence < 1),
    observed_date TEXT NOT NULL, retrieved_at TEXT NOT NULL,
    method TEXT NOT NULL, quality_flags TEXT NOT NULL DEFAULT '[]',
    provenance_id TEXT NOT NULL REFERENCES provenance, fingerprint TEXT NOT NULL,
    CHECK((status = 'observed' AND value IS NOT NULL) OR (status <> 'observed' AND value IS NULL)),
    CHECK(status = 'observed' OR margin_of_error IS NULL),
    UNIQUE(observation_id, release_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS revisions_panel ON observation_revision(observation_id, retrieved_at);

CREATE TABLE IF NOT EXISTS property (
    id TEXT PRIMARY KEY, parcel_id TEXT NOT NULL, geography_id TEXT REFERENCES geography,
    address TEXT, zoning TEXT, geometry_geojson TEXT,
    snapshot_date TEXT NOT NULL, provenance_id TEXT NOT NULL REFERENCES provenance
);
CREATE TABLE IF NOT EXISTS property_observation (
    id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES property,
    indicator_id TEXT NOT NULL REFERENCES indicator, observed_date TEXT NOT NULL,
    value REAL, status TEXT NOT NULL CHECK(status IN ('observed','missing','suppressed','not_applicable')),
    provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK((status='observed' AND value IS NOT NULL) OR (status<>'observed' AND value IS NULL))
);
CREATE TABLE IF NOT EXISTS transportation (
    id TEXT PRIMARY KEY, geography_id TEXT REFERENCES geography,
    feature_type TEXT NOT NULL, name TEXT, geometry_geojson TEXT,
    snapshot_date TEXT NOT NULL, provenance_id TEXT NOT NULL REFERENCES provenance
);
CREATE TABLE IF NOT EXISTS transportation_observation (
    id TEXT PRIMARY KEY, transportation_id TEXT NOT NULL REFERENCES transportation,
    indicator_id TEXT NOT NULL REFERENCES indicator, observed_date TEXT NOT NULL,
    value REAL, status TEXT NOT NULL CHECK(status IN ('observed','missing','suppressed','not_applicable')),
    provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK((status='observed' AND value IS NOT NULL) OR (status<>'observed' AND value IS NULL))
);
CREATE TABLE IF NOT EXISTS business_event (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business,
    event_type TEXT NOT NULL CHECK(event_type IN ('opening','closure','relocation','expansion','contraction')),
    event_date TEXT NOT NULL, geography_id TEXT REFERENCES geography,
    verification TEXT NOT NULL CHECK(verification IN ('candidate','verified','rejected')),
    verified_by TEXT, verified_at TEXT, evidence_text TEXT NOT NULL,
    provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK(verification <> 'verified' OR
      (verified_by IS NOT NULL AND length(trim(verified_by)) > 0 AND verified_at IS NOT NULL AND length(trim(evidence_text)) > 0))
);
CREATE TABLE IF NOT EXISTS permit (
    id TEXT PRIMARY KEY, permit_number TEXT NOT NULL, property_id TEXT REFERENCES property,
    geography_id TEXT REFERENCES geography, business_id TEXT REFERENCES business,
    category TEXT NOT NULL, status TEXT NOT NULL, application_date TEXT, decision_date TEXT,
    declared_value REAL, provenance_id TEXT NOT NULL REFERENCES provenance
);
CREATE TABLE IF NOT EXISTS commercial_activity (
    id TEXT PRIMARY KEY, geography_id TEXT REFERENCES geography,
    business_id TEXT REFERENCES business, indicator_id TEXT NOT NULL REFERENCES indicator,
    period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    value REAL, status TEXT NOT NULL CHECK(status IN ('observed','missing','suppressed','not_applicable')),
    coverage_description TEXT NOT NULL, provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK(period_end >= period_start),
    CHECK((status='observed' AND value IS NOT NULL) OR (status<>'observed' AND value IS NULL))
);
CREATE TABLE IF NOT EXISTS external_shock (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    geography_id TEXT REFERENCES geography, start_date TEXT NOT NULL, end_date TEXT,
    evidence_text TEXT NOT NULL, provenance_id TEXT NOT NULL REFERENCES provenance,
    CHECK(end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS document (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, text TEXT NOT NULL,
    text_sha256 TEXT NOT NULL, provenance_id TEXT NOT NULL REFERENCES provenance
);
CREATE TABLE IF NOT EXISTS document_candidate (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES document,
    category TEXT NOT NULL, candidate_date TEXT, candidate_place TEXT,
    span_start INTEGER NOT NULL CHECK(span_start >= 0), span_end INTEGER NOT NULL,
    source_span TEXT NOT NULL, evidence_spans TEXT NOT NULL,
    extractor_version TEXT NOT NULL, review_status TEXT NOT NULL DEFAULT 'pending'
      CHECK(review_status IN ('pending','accepted','rejected')),
    CHECK(span_end > span_start)
);
CREATE TABLE IF NOT EXISTS candidate_review (
    id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES document_candidate,
    reviewer TEXT NOT NULL CHECK(length(trim(reviewer)) > 0), reviewed_at TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
    notes TEXT NOT NULL CHECK(length(trim(notes)) > 0)
);
CREATE TABLE IF NOT EXISTS model_run (
    id TEXT PRIMARY KEY, model_name TEXT NOT NULL, model_version TEXT NOT NULL,
    code_version TEXT NOT NULL, parameters_json TEXT NOT NULL, training_start TEXT,
    training_end TEXT, as_of TEXT NOT NULL, created_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('succeeded','failed','gated')),
    validation_json TEXT NOT NULL, limitations TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_input (
    run_id TEXT NOT NULL REFERENCES model_run,
    revision_id TEXT NOT NULL REFERENCES observation_revision,
    role TEXT NOT NULL DEFAULT 'training', transformation TEXT NOT NULL,
    PRIMARY KEY(run_id, revision_id, role)
);
CREATE TABLE IF NOT EXISTS model_source_input (
    run_id TEXT NOT NULL REFERENCES model_run, source_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifact, content_sha256 TEXT NOT NULL,
    source_metadata_json TEXT NOT NULL,
    PRIMARY KEY(run_id, source_id)
);
CREATE TABLE IF NOT EXISTS model_output (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES model_run,
    geography_id TEXT REFERENCES geography, indicator_id TEXT REFERENCES indicator,
    target_period TEXT NOT NULL, output_type TEXT NOT NULL,
    estimate REAL, lower_bound REAL, upper_bound REAL, interval_level REAL,
    unit TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
    CHECK(lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound),
    CHECK(interval_level IS NULL OR (interval_level > 0 AND interval_level < 1))
);

CREATE VIEW IF NOT EXISTS panel_all_revisions AS
SELECT o.id AS observation_id, r.id AS revision_id, i.id AS indicator_id,
 i.name AS indicator_name, i.domain, i.unit, i.universe, i.seasonal_adjustment,
 g.id AS geography_key, g.code AS geography_id, g.name AS geography_name,
 g.geography_type, g.vintage AS geography_vintage,
 o.industry_id, o.population_group, o.period_start, o.period_end, o.frequency,
 r.value, r.status, r.margin_of_error, r.moe_confidence, r.observed_date,
 s.id AS source_id, s.name AS source_name, p.source_url,
 rel.release_key, rel.release_date, r.retrieved_at, r.method, r.quality_flags,
 r.provenance_id
FROM panel_observation o JOIN observation_revision r ON r.observation_id=o.id
JOIN indicator i ON i.id=o.indicator_id JOIN geography g ON g.id=o.geography_id
JOIN source s ON s.id=o.source_id JOIN source_release rel ON rel.id=r.release_id
JOIN provenance p ON p.id=r.provenance_id;
CREATE VIEW IF NOT EXISTS panel_current AS
SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY observation_id
 ORDER BY COALESCE(release_date, period_end) DESC, retrieved_at DESC, revision_id DESC) AS revision_rank
 FROM panel_all_revisions) WHERE revision_rank=1;
CREATE VIEW IF NOT EXISTS demographics AS SELECT * FROM panel_current WHERE domain='demographics';
CREATE VIEW IF NOT EXISTS employment AS SELECT * FROM panel_current WHERE domain='employment';
CREATE VIEW IF NOT EXISTS economic_indicators AS SELECT * FROM panel_current;
CREATE VIEW IF NOT EXISTS business_openings AS SELECT * FROM business_event WHERE event_type='opening' AND verification='verified';
CREATE VIEW IF NOT EXISTS business_closures AS SELECT * FROM business_event WHERE event_type='closure' AND verification='verified';
