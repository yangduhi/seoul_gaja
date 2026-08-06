import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const placeCatalog = sqliteTable("place_catalog", {
  areaCode: text("area_code").primaryKey(),
  areaName: text("area_name").notNull(),
  category: text("category"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  catalogVersion: text("catalog_version").notNull(),
  active: integer("active").notNull().default(1),
});

export const snapshotRuns = sqliteTable("snapshot_runs", {
  snapshotId: text("snapshot_id").primaryKey(),
  sourceTime: text("source_time"),
  fetchedAt: text("fetched_at").notNull(),
  storedAt: text("stored_at").notNull(),
  catalogVersion: text("catalog_version").notNull(),
  attemptedCount: integer("attempted_count").notNull(),
  refreshedCount: integer("refreshed_count").notNull(),
  carriedCount: integer("carried_count").notNull(),
  unavailableCount: integer("unavailable_count").notNull(),
  payloadSha256: text("payload_sha256").notNull(),
  status: text("status").notNull(),
});

export const currentSnapshot = sqliteTable("current_snapshot", {
  areaCode: text("area_code").primaryKey(),
  snapshotId: text("snapshot_id").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  fetchedAt: text("fetched_at").notNull(),
  storedAt: text("stored_at").notNull(),
  availability: text("availability").notNull(),
  provenance: text("provenance").notNull(),
  crowdLevel: text("crowd_level").notNull(),
  populationMin: integer("population_min"),
  populationMax: integer("population_max"),
  rawHash: text("raw_hash"),
});

export const rawObservation15m = sqliteTable("raw_observation_15m", {
  areaCode: text("area_code").notNull(),
  observationBucket: text("observation_bucket").notNull(),
  snapshotId: text("snapshot_id").notNull(),
  crowdLevel: text("crowd_level"),
  populationMin: integer("population_min"),
  populationMax: integer("population_max"),
  availability: text("availability").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.areaCode, table.observationBucket] }) }));

export const hourlyObservation = sqliteTable("hourly_observation", {
  areaCode: text("area_code").notNull(),
  hourBucket: text("hour_bucket").notNull(),
  crowdRankMedian: real("crowd_rank_median"),
  populationMidpointMedian: real("population_midpoint_median"),
  sampleCount: integer("sample_count").notNull(),
  missingCount: integer("missing_count").notNull(),
  computedAt: text("computed_at").notNull(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.areaCode, table.hourBucket] }) }));

export const dailySummary = sqliteTable("daily_summary", {
  areaCode: text("area_code").notNull(),
  localDate: text("local_date").notNull(),
  crowdRankMedian: real("crowd_rank_median"),
  crowdRankMax: real("crowd_rank_max"),
  populationMidpointMedian: real("population_midpoint_median"),
  observationCount: integer("observation_count").notNull(),
  missingCount: integer("missing_count").notNull(),
  computedAt: text("computed_at").notNull(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.areaCode, table.localDate] }) }));

export const weekdayHourProfile = sqliteTable("weekday_hour_profile", {
  areaCode: text("area_code").notNull(),
  weekday: integer("weekday").notNull(),
  hour: integer("hour").notNull(),
  maturity: text("maturity").notNull(),
  crowdRankMedian: real("crowd_rank_median"),
  populationMidpointMedian: real("population_midpoint_median"),
  populationMidpointIqr: real("population_midpoint_iqr"),
  sampleCount: integer("sample_count").notNull(),
  missingCount: integer("missing_count").notNull(),
  coverage: real("coverage").notNull(),
  computedAt: text("computed_at").notNull(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.areaCode, table.weekday, table.hour] }) }));

export const detailCache = sqliteTable("detail_cache", {
  areaCode: text("area_code").notNull(),
  sectionName: text("section_name").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  state: text("state").notNull(),
  normalizedJson: text("normalized_json"),
  rawHash: text("raw_hash"),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.areaCode, table.sectionName] }) }));

export const jobReceipts = sqliteTable("job_receipts", {
  jobName: text("job_name").notNull(),
  runId: text("run_id").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  metricsJson: text("metrics_json"),
  errorCode: text("error_code"),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.jobName, table.runId] }) }));
