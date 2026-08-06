CREATE TABLE IF NOT EXISTS phase_00_capability_probe (
  probe_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('written', 'updated', 'rollback_candidate', 'duplicate')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
