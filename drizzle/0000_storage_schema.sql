CREATE TABLE place_catalog (
  area_code TEXT PRIMARY KEY,
  area_name TEXT NOT NULL UNIQUE,
  category TEXT,
  latitude REAL,
  longitude REAL,
  catalog_version TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint

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
  status TEXT NOT NULL CHECK(status IN ('accepted','replayed','rejected'))
);
--> statement-breakpoint

CREATE TABLE current_snapshot (
  area_code TEXT PRIMARY KEY REFERENCES place_catalog(area_code),
  snapshot_id TEXT NOT NULL REFERENCES snapshot_runs(snapshot_id),
  source_updated_at TEXT,
  fetched_at TEXT NOT NULL,
  stored_at TEXT NOT NULL,
  availability TEXT NOT NULL CHECK(availability IN ('available','carried_forward','unavailable','expired')),
  provenance TEXT NOT NULL CHECK(provenance IN ('refreshed','carried_forward','missing')),
  crowd_level TEXT NOT NULL,
  population_min INTEGER,
  population_max INTEGER,
  raw_hash TEXT,
  CHECK ((population_min IS NULL AND population_max IS NULL) OR
         (population_min >= 0 AND population_max >= population_min))
);
--> statement-breakpoint

CREATE TABLE raw_observation_15m (
  area_code TEXT NOT NULL REFERENCES place_catalog(area_code),
  observation_bucket TEXT NOT NULL,
  snapshot_id TEXT NOT NULL REFERENCES snapshot_runs(snapshot_id),
  crowd_level TEXT,
  population_min INTEGER,
  population_max INTEGER,
  availability TEXT NOT NULL,
  source_updated_at TEXT,
  PRIMARY KEY(area_code, observation_bucket)
);
--> statement-breakpoint

CREATE TABLE hourly_observation (
  area_code TEXT NOT NULL REFERENCES place_catalog(area_code),
  hour_bucket TEXT NOT NULL,
  crowd_rank_median REAL,
  population_midpoint_median REAL,
  sample_count INTEGER NOT NULL,
  missing_count INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY(area_code, hour_bucket)
);
--> statement-breakpoint

CREATE TABLE daily_summary (
  area_code TEXT NOT NULL REFERENCES place_catalog(area_code),
  local_date TEXT NOT NULL,
  crowd_rank_median REAL,
  crowd_rank_max REAL,
  population_midpoint_median REAL,
  observation_count INTEGER NOT NULL,
  missing_count INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY(area_code, local_date)
);
--> statement-breakpoint

CREATE TABLE weekday_hour_profile (
  area_code TEXT NOT NULL REFERENCES place_catalog(area_code),
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),
  maturity TEXT NOT NULL,
  crowd_rank_median REAL,
  population_midpoint_median REAL,
  population_midpoint_iqr REAL,
  sample_count INTEGER NOT NULL,
  missing_count INTEGER NOT NULL,
  coverage REAL NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY(area_code, weekday, hour)
);
--> statement-breakpoint

CREATE TABLE detail_cache (
  area_code TEXT NOT NULL REFERENCES place_catalog(area_code),
  section_name TEXT NOT NULL,
  source_updated_at TEXT,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL,
  normalized_json TEXT,
  raw_hash TEXT,
  PRIMARY KEY(area_code, section_name)
);
--> statement-breakpoint

CREATE TABLE job_receipts (
  job_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  metrics_json TEXT,
  error_code TEXT,
  PRIMARY KEY(job_name, run_id)
);
--> statement-breakpoint

CREATE INDEX idx_raw_observation_bucket ON raw_observation_15m(observation_bucket);
--> statement-breakpoint
CREATE INDEX idx_hourly_bucket ON hourly_observation(hour_bucket);
--> statement-breakpoint
CREATE INDEX idx_daily_date ON daily_summary(local_date);
