-- Forward-only D1 migration. Do not execute from local verification.
-- Compatibility order: readers continue using snapshot_runs/current_snapshot first;
-- writers populate snapshot_revisions and provenance links before any reader cutover.
-- Rollback limit: do not drop columns or tables. Restore application compatibility in a
-- later forward migration and retain revision/provenance rows for audit.

ALTER TABLE snapshot_runs ADD COLUMN run_id TEXT;
ALTER TABLE snapshot_runs ADD COLUMN attempt_no INTEGER;
ALTER TABLE snapshot_runs ADD COLUMN revision_id TEXT;
ALTER TABLE snapshot_runs ADD COLUMN supersedes_revision_id TEXT;
ALTER TABLE snapshot_runs ADD COLUMN clock_skew_clamped INTEGER NOT NULL DEFAULT 0;

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

-- Fixture backfill only: one revision per legacy snapshot, preserving the old snapshot_id.
INSERT OR IGNORE INTO snapshot_revisions (revision_id, run_id, attempt_no, payload_sha256, supersedes_revision_id, status, created_at)
SELECT snapshot_id, snapshot_id, 1, payload_sha256, NULL,
  CASE status WHEN 'accepted' THEN 'accepted' WHEN 'replayed' THEN 'replayed' ELSE 'rejected' END,
  stored_at
FROM snapshot_runs;
