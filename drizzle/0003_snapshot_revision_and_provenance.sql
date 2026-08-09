-- Forward-only D1 migration. Do not execute from local verification.
-- Compatibility order: readers continue using snapshot_runs/current_snapshot first;
-- writers populate snapshot_revisions and provenance links before any reader cutover.
-- Rollback limit: do not drop columns or tables. Restore application compatibility in a
-- later forward migration and retain revision/provenance rows for audit.

ALTER TABLE snapshot_runs ADD COLUMN run_id TEXT;
--> statement-breakpoint
ALTER TABLE snapshot_runs ADD COLUMN attempt_no INTEGER;
--> statement-breakpoint
ALTER TABLE snapshot_runs ADD COLUMN revision_id TEXT;
--> statement-breakpoint
ALTER TABLE snapshot_runs ADD COLUMN supersedes_revision_id TEXT;
--> statement-breakpoint
ALTER TABLE snapshot_runs ADD COLUMN clock_skew_clamped INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint

CREATE TABLE snapshot_revisions (
  revision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK(attempt_no >= 1),
  payload_sha256 TEXT NOT NULL,
  supersedes_revision_id TEXT REFERENCES snapshot_revisions(revision_id),
  status TEXT NOT NULL CHECK(status IN ('partial', 'accepted', 'replayed', 'rejected')),
  created_at TEXT NOT NULL,
  UNIQUE(run_id, attempt_no)
);
--> statement-breakpoint

CREATE TABLE snapshot_revision_provenance (
  revision_id TEXT PRIMARY KEY REFERENCES snapshot_revisions(revision_id),
  source_updated_at TEXT,
  fetched_at TEXT,
  freshness_basis TEXT NOT NULL CHECK(freshness_basis IN ('source_updated_at', 'fetched_at_degraded')),
  clock_skew_clamped INTEGER NOT NULL DEFAULT 0,
  catalog_identity_count INTEGER NOT NULL CHECK(catalog_identity_count = 121),
  refreshed_fresh_count INTEGER NOT NULL,
  carried_non_expired_count INTEGER NOT NULL,
  unavailable_count INTEGER NOT NULL,
  expired_count INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE provenance_receipts (
  receipt_id TEXT NOT NULL,
  receipt_version INTEGER NOT NULL CHECK(receipt_version >= 1),
  workflow_run_id TEXT NOT NULL,
  collector_version TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  raw_response_sha256 TEXT NOT NULL CHECK(length(raw_response_sha256) = 64),
  per_place_outcome_counts TEXT NOT NULL,
  source_times TEXT NOT NULL,
  fetch_times TEXT NOT NULL,
  canonical_payload_sha256 TEXT NOT NULL CHECK(length(canonical_payload_sha256) = 64),
  accepted_at TEXT NOT NULL,
  retained_until TEXT NOT NULL,
  PRIMARY KEY(receipt_id, receipt_version)
);
--> statement-breakpoint

CREATE TRIGGER provenance_receipts_no_update
BEFORE UPDATE ON provenance_receipts
BEGIN
  SELECT RAISE(ABORT, 'PROVENANCE_RECEIPT_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TRIGGER provenance_receipts_no_delete
BEFORE DELETE ON provenance_receipts
BEGIN
  SELECT RAISE(ABORT, 'PROVENANCE_RECEIPT_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TABLE provenance_source_bindings (
  derived_kind TEXT NOT NULL CHECK(derived_kind IN ('materialization', 'profile')),
  derived_key TEXT NOT NULL,
  source_receipt_id TEXT NOT NULL,
  source_receipt_version INTEGER NOT NULL,
  bound_at TEXT NOT NULL,
  PRIMARY KEY(derived_kind, derived_key),
  FOREIGN KEY(source_receipt_id, source_receipt_version)
    REFERENCES provenance_receipts(receipt_id, receipt_version)
);
--> statement-breakpoint

CREATE TRIGGER provenance_source_bindings_no_update
BEFORE UPDATE ON provenance_source_bindings
BEGIN
  SELECT RAISE(ABORT, 'PROVENANCE_SOURCE_BINDING_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TRIGGER provenance_source_bindings_no_delete
BEFORE DELETE ON provenance_source_bindings
BEGIN
  SELECT RAISE(ABORT, 'PROVENANCE_SOURCE_BINDING_IMMUTABLE');
END;
--> statement-breakpoint

-- Fixture backfill only: one revision per legacy snapshot, preserving the old snapshot_id.
INSERT OR IGNORE INTO snapshot_revisions (revision_id, run_id, attempt_no, payload_sha256, supersedes_revision_id, status, created_at)
SELECT snapshot_id, snapshot_id, 1, payload_sha256, NULL,
  CASE status WHEN 'accepted' THEN 'accepted' WHEN 'replayed' THEN 'replayed' ELSE 'rejected' END,
  stored_at
FROM snapshot_runs;
