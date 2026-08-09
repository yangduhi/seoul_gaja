import { ProvenancePolicyError } from "./provenance-cadence.mjs";

const FORECAST_TTL_MS = 180 * 60 * 1000;

export class SnapshotMaterializationError extends Error {
  constructor(code) {
    super(code);
    this.name = "SnapshotMaterializationError";
    this.code = code;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function receiptValues(receipt) {
  return [
    receipt.receipt_id,
    receipt.receipt_version,
    receipt.workflow_run_id,
    receipt.collector_version,
    receipt.parser_version,
    receipt.catalog_version,
    receipt.raw_response_sha256,
    JSON.stringify(canonicalize(receipt.per_place_outcome_counts)),
    JSON.stringify(receipt.source_times),
    JSON.stringify(receipt.fetch_times),
    receipt.canonical_payload_sha256,
    receipt.accepted_at,
    receipt.retained_until,
  ];
}

function receiptConflictGuardStatement(database, receipt) {
  return database.prepare(`UPDATE provenance_receipts
    SET accepted_at = accepted_at
    WHERE receipt_id = ? AND receipt_version = ?
      AND NOT (workflow_run_id = ? AND collector_version = ? AND parser_version = ?
        AND catalog_version = ? AND raw_response_sha256 = ? AND per_place_outcome_counts = ?
        AND source_times = ? AND fetch_times = ? AND canonical_payload_sha256 = ?
        AND accepted_at = ? AND retained_until = ?)`)
    .bind(...receiptValues(receipt));
}

function receiptInsertStatement(database, receipt) {
  return database.prepare(`INSERT OR IGNORE INTO provenance_receipts (
    receipt_id, receipt_version, workflow_run_id, collector_version, parser_version,
    catalog_version, raw_response_sha256, per_place_outcome_counts, source_times,
    fetch_times, canonical_payload_sha256, accepted_at, retained_until
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(...receiptValues(receipt));
}

function sourceBindingConflictGuardStatement(database, binding) {
  return database.prepare(`UPDATE provenance_source_bindings
    SET bound_at = bound_at
    WHERE derived_kind = ? AND derived_key = ?
      AND (source_receipt_id <> ? OR source_receipt_version <> ?)`)
    .bind(binding.derivedKind, binding.derivedKey, binding.receipt.receipt_id, binding.receipt.receipt_version);
}

function sourceBindingInsertStatement(database, binding) {
  return database.prepare(`INSERT OR IGNORE INTO provenance_source_bindings (
    derived_kind, derived_key, source_receipt_id, source_receipt_version, bound_at
  ) VALUES (?, ?, ?, ?, ?)`)
    .bind(binding.derivedKind, binding.derivedKey, binding.receipt.receipt_id, binding.receipt.receipt_version, binding.receipt.accepted_at);
}

function latestTimestamp(timestamps) {
  return timestamps.reduce((latest, timestamp) => Date.parse(timestamp) > Date.parse(latest) ? timestamp : latest);
}

function observationBucket(timestamp) {
  const parsed = new Date(timestamp);
  parsed.setUTCMinutes(Math.floor(parsed.getUTCMinutes() / 15) * 15, 0, 0);
  return parsed.toISOString();
}

function forecastCacheRow(row, snapshotId) {
  const forecast = row.officialForecast;
  return {
    areaCode: row.areaCode,
    sourceUpdatedAt: forecast.sourceUpdatedAt,
    fetchedAt: forecast.fetchedAt,
    expiresAt: new Date(Date.parse(forecast.fetchedAt) + FORECAST_TTL_MS).toISOString(),
    rawHash: forecast.rawHash,
    normalizedJson: JSON.stringify({
      authority: "official",
      synthetic: false,
      points: forecast.points.map((point) => ({
        timestamp: point.timestamp,
        crowd_level: point.crowdLevel,
        source_updated_at: point.sourceUpdatedAt,
        snapshot_id: snapshotId,
        population_min: point.populationMin,
        population_max: point.populationMax,
        authority: "official",
        synthetic: false,
      })),
    }),
  };
}

function acceptedSnapshotRows(snapshot, receipt) {
  const sourceTimes = snapshot.rows.map((row) => row.sourceUpdatedAt);
  const fetchTimes = snapshot.rows.map((row) => row.fetchedAt);
  return {
    sourceTime: latestTimestamp(sourceTimes),
    fetchedAt: latestTimestamp(fetchTimes),
    storedAt: receipt.accepted_at,
    catalogRows: snapshot.rows.map((row) => ({
      areaCode: row.areaCode,
      areaName: row.areaName,
      catalogVersion: snapshot.catalogVersion,
    })),
    currentRows: snapshot.rows.map((row) => ({
      areaCode: row.areaCode,
      sourceUpdatedAt: row.sourceUpdatedAt,
      fetchedAt: row.fetchedAt,
      availability: row.availability,
      provenance: row.provenance,
      crowdLevel: row.crowdLevel,
      populationMin: row.populationMin,
      populationMax: row.populationMax,
      rawHash: row.rawHash,
    })),
    rawRows: snapshot.rows.map((row) => ({
      areaCode: row.areaCode,
      observationBucket: observationBucket(row.sourceUpdatedAt),
      crowdLevel: row.crowdLevel,
      populationMin: row.populationMin,
      populationMax: row.populationMax,
      availability: row.availability,
      sourceUpdatedAt: row.sourceUpdatedAt,
    })),
    forecastRows: snapshot.rows.map((row) => forecastCacheRow(row, snapshot.snapshotId)),
  };
}

function materializationStatements(database, snapshot, receipt) {
  const data = acceptedSnapshotRows(snapshot, receipt);
  const bindings = [
    { derivedKind: "materialization", derivedKey: snapshot.snapshotId, receipt },
    { derivedKind: "profile", derivedKey: snapshot.snapshotId, receipt },
  ];
  const snapshotValues = [
    snapshot.snapshotId,
    data.sourceTime,
    data.fetchedAt,
    data.storedAt,
    snapshot.catalogVersion,
    snapshot.meta.attempted,
    snapshot.meta.refreshed,
    snapshot.meta.carriedForward,
    snapshot.meta.unavailable,
    snapshot.payloadSha256,
    snapshot.snapshotId,
    snapshot.snapshotId,
  ];

  return [
    receiptConflictGuardStatement(database, receipt),
    ...bindings.map((binding) => sourceBindingConflictGuardStatement(database, binding)),
    receiptInsertStatement(database, receipt),
    ...bindings.map((binding) => sourceBindingInsertStatement(database, binding)),
    database.prepare(`INSERT OR IGNORE INTO snapshot_runs (
      snapshot_id, source_time, fetched_at, stored_at, catalog_version, attempted_count,
      refreshed_count, carried_count, unavailable_count, payload_sha256, status, run_id,
      attempt_no, revision_id, supersedes_revision_id, clock_skew_clamped
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?, 1, ?, NULL, 0)`).bind(...snapshotValues),
    database.prepare(`INSERT OR IGNORE INTO snapshot_revisions (
      revision_id, run_id, attempt_no, payload_sha256, supersedes_revision_id, status, created_at
    ) VALUES (?, ?, 1, ?, NULL, 'accepted', ?)`).bind(
      snapshot.snapshotId,
      snapshot.snapshotId,
      snapshot.payloadSha256,
      data.storedAt,
    ),
    database.prepare(`INSERT OR IGNORE INTO snapshot_revision_provenance (
      revision_id, source_updated_at, fetched_at, freshness_basis, clock_skew_clamped,
      catalog_identity_count, refreshed_fresh_count, carried_non_expired_count,
      unavailable_count, expired_count
    ) VALUES (?, ?, ?, 'source_updated_at', 0, 121, ?, ?, ?, 0)`).bind(
      snapshot.snapshotId,
      data.sourceTime,
      data.fetchedAt,
      snapshot.meta.refreshed,
      snapshot.meta.carriedForward,
      snapshot.meta.unavailable,
    ),
    database.prepare(`INSERT INTO place_catalog (
      area_code, area_name, category, latitude, longitude, catalog_version, active
    ) SELECT json_extract(value, '$.areaCode'), json_extract(value, '$.areaName'),
      NULL, NULL, NULL, json_extract(value, '$.catalogVersion'), 1
    FROM json_each(?) WHERE 1
    ON CONFLICT(area_code) DO UPDATE SET
      area_name = excluded.area_name,
      catalog_version = excluded.catalog_version,
      active = 1`).bind(JSON.stringify(data.catalogRows)),
    database.prepare(`INSERT INTO current_snapshot (
      area_code, snapshot_id, source_updated_at, fetched_at, stored_at, availability,
      provenance, crowd_level, population_min, population_max, raw_hash
    ) SELECT json_extract(value, '$.areaCode'), ?, json_extract(value, '$.sourceUpdatedAt'),
      json_extract(value, '$.fetchedAt'), ?, json_extract(value, '$.availability'),
      json_extract(value, '$.provenance'), json_extract(value, '$.crowdLevel'),
      json_extract(value, '$.populationMin'), json_extract(value, '$.populationMax'),
      json_extract(value, '$.rawHash')
    FROM json_each(?) WHERE 1
    ON CONFLICT(area_code) DO UPDATE SET
      snapshot_id = excluded.snapshot_id,
      source_updated_at = excluded.source_updated_at,
      fetched_at = excluded.fetched_at,
      stored_at = excluded.stored_at,
      availability = excluded.availability,
      provenance = excluded.provenance,
      crowd_level = excluded.crowd_level,
      population_min = excluded.population_min,
      population_max = excluded.population_max,
      raw_hash = excluded.raw_hash`).bind(snapshot.snapshotId, data.storedAt, JSON.stringify(data.currentRows)),
    database.prepare(`INSERT INTO raw_observation_15m (
      area_code, observation_bucket, snapshot_id, crowd_level, population_min,
      population_max, availability, source_updated_at
    ) SELECT json_extract(value, '$.areaCode'), json_extract(value, '$.observationBucket'),
      ?, json_extract(value, '$.crowdLevel'), json_extract(value, '$.populationMin'),
      json_extract(value, '$.populationMax'), json_extract(value, '$.availability'),
      json_extract(value, '$.sourceUpdatedAt')
    FROM json_each(?) WHERE 1
    ON CONFLICT(area_code, observation_bucket) DO UPDATE SET
      snapshot_id = excluded.snapshot_id,
      crowd_level = excluded.crowd_level,
      population_min = excluded.population_min,
      population_max = excluded.population_max,
      availability = excluded.availability,
      source_updated_at = excluded.source_updated_at`).bind(snapshot.snapshotId, JSON.stringify(data.rawRows)),
    database.prepare(`INSERT INTO detail_cache (
      area_code, section_name, source_updated_at, fetched_at, expires_at, state,
      normalized_json, raw_hash
    ) SELECT json_extract(value, '$.areaCode'), 'official_forecast',
      json_extract(value, '$.sourceUpdatedAt'), json_extract(value, '$.fetchedAt'),
      json_extract(value, '$.expiresAt'), 'available', json_extract(value, '$.normalizedJson'),
      json_extract(value, '$.rawHash')
    FROM json_each(?) WHERE 1
    ON CONFLICT(area_code, section_name) DO UPDATE SET
      source_updated_at = excluded.source_updated_at,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at,
      state = excluded.state,
      normalized_json = excluded.normalized_json,
      raw_hash = excluded.raw_hash`).bind(JSON.stringify(data.forecastRows)),
  ];
}

function immutableStorageConflictCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("PROVENANCE_RECEIPT_IMMUTABLE")) return "IMMUTABLE_RECEIPT_CONFLICT";
  if (message.includes("PROVENANCE_SOURCE_BINDING_IMMUTABLE")) return "IMMUTABLE_SOURCE_BINDING_CONFLICT";
  return null;
}

export async function persistAcceptedSnapshot(database, snapshot, receipt) {
  if (database === null || database === undefined || typeof database.prepare !== "function" || typeof database.batch !== "function") {
    throw new ProvenancePolicyError("PROVENANCE_STORAGE_UNAVAILABLE");
  }
  try {
    await database.batch(materializationStatements(database, snapshot, receipt));
  } catch (error) {
    const conflict = immutableStorageConflictCode(error);
    if (conflict !== null) throw new ProvenancePolicyError(conflict);
    throw new SnapshotMaterializationError("MATERIALIZATION_STORAGE_ERROR");
  }
}
