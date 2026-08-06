CREATE TABLE snapshot_runs (
  snapshot_id TEXT PRIMARY KEY,
  source_time TEXT,
  fetched_at TEXT NOT NULL,
  stored_at TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  attempted_count INTEGER NOT NULL,
  refreshed_count INTEGER NOT NULL,
  carried_count INTEGER NOT NULL,
  unavailable_count INTEGER NOT NULL,
  payload_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('accepted', 'replayed', 'rejected'))
);

INSERT INTO snapshot_runs (
  snapshot_id,
  source_time,
  fetched_at,
  stored_at,
  catalog_version,
  attempted_count,
  refreshed_count,
  carried_count,
  unavailable_count,
  payload_sha256,
  status
) VALUES (
  'legacy-snapshot-001',
  '2026-08-06T23:55:00Z',
  '2026-08-07T00:00:00Z',
  '2026-08-07T00:00:01Z',
  'catalog-v1',
  121,
  121,
  0,
  0,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'accepted'
);
