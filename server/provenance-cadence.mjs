import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = new Set(['authorization', 'token', 'api_key', 'raw_response_body']);
const DAY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_RETENTION_DAYS = 90;

export class ProvenancePolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProvenancePolicyError';
    this.code = code;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function forbiddenKey(value) {
  if (Array.isArray(value)) return value.map(forbiddenKey).find(Boolean) ?? null;
  if (value === null || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return key;
    const nested = forbiddenKey(child);
    if (nested) return nested;
  }
  return null;
}

function requireAcceptedIngest(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ProvenancePolicyError('MALFORMED_INPUT');
  if (input.accepted_status !== 'accepted') throw new ProvenancePolicyError('ACCEPTED_INGEST_REQUIRED');
  if (forbiddenKey(input)) throw new ProvenancePolicyError('PROVENANCE_FORBIDDEN_FIELD');
  const strings = ['receipt_id', 'workflow_run_id', 'collector_version', 'parser_version', 'catalog_version'];
  if (strings.some((field) => typeof input[field] !== 'string' || input[field].length === 0)) throw new ProvenancePolicyError('PROVENANCE_REQUIRED_FIELD');
  if (!Number.isInteger(input.receipt_version) || input.receipt_version < 1) throw new ProvenancePolicyError('PROVENANCE_REQUIRED_FIELD');
  if (!SHA256.test(input.raw_response_sha256)) throw new ProvenancePolicyError('RAW_RESPONSE_SHA256_REQUIRED');
  if (!Array.isArray(input.source_times) || input.source_times.length === 0 || !input.source_times.every(isTimestamp)) throw new ProvenancePolicyError('SOURCE_TIMES_REQUIRED');
  if (!Array.isArray(input.fetch_times) || input.fetch_times.length === 0 || !input.fetch_times.every(isTimestamp)) throw new ProvenancePolicyError('FETCH_TIMES_REQUIRED');
  if (!isTimestamp(input.accepted_at)) throw new ProvenancePolicyError('ACCEPTED_AT_REQUIRED');
  if (input.canonical_payload === null || typeof input.canonical_payload !== 'object') throw new ProvenancePolicyError('CANONICAL_PAYLOAD_REQUIRED');
  const counts = input.per_place_outcome_counts;
  if (counts === null || typeof counts !== 'object' || Object.values(counts).some((count) => !Number.isInteger(count) || count < 0)) throw new ProvenancePolicyError('OUTCOME_COUNTS_REQUIRED');
  if (Object.values(counts).reduce((total, count) => total + count, 0) !== 121) throw new ProvenancePolicyError('OUTCOME_COUNT_RECONCILIATION_FAILED');
}

export function canonicalPayloadSha256(payload) {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

export function createProvenanceReceipt(input) {
  requireAcceptedIngest(input);
  const acceptedAt = Date.parse(input.accepted_at);
  return deepFreeze({
    receipt_id: input.receipt_id,
    receipt_version: input.receipt_version,
    workflow_run_id: input.workflow_run_id,
    collector_version: input.collector_version,
    parser_version: input.parser_version,
    catalog_version: input.catalog_version,
    raw_response_sha256: input.raw_response_sha256,
    per_place_outcome_counts: { ...input.per_place_outcome_counts },
    source_times: [...input.source_times],
    fetch_times: [...input.fetch_times],
    canonical_payload_sha256: canonicalPayloadSha256(input.canonical_payload),
    accepted_at: input.accepted_at,
    retained_until: new Date(acceptedAt + RECEIPT_RETENTION_DAYS * DAY_MS).toISOString(),
  });
}

export function appendReceipt(ledger, receipt) {
  const prior = ledger.find((item) => item.receipt_id === receipt.receipt_id && item.receipt_version === receipt.receipt_version);
  if (prior && JSON.stringify(prior) !== JSON.stringify(receipt)) throw new ProvenancePolicyError('IMMUTABLE_RECEIPT_CONFLICT');
  if (prior) return ledger;
  return Object.freeze([...ledger, receipt]);
}

export function findRetainedReceipt(ledger, query) {
  const queryAt = Date.parse(query.query_at);
  if (Number.isNaN(queryAt)) throw new ProvenancePolicyError('RETENTION_QUERY_TIME_REQUIRED');
  return ledger.find((receipt) => receipt.receipt_id === query.receipt_id
    && receipt.receipt_version === query.receipt_version
    && queryAt <= Date.parse(receipt.retained_until)) ?? null;
}

export function bindDerivedRow(receipt) {
  return Object.freeze({ source_receipt_id: receipt.receipt_id, source_receipt_version: receipt.receipt_version });
}

const RECEIPT_SELECT_SQL = `SELECT receipt_id, receipt_version, workflow_run_id, collector_version,
  parser_version, catalog_version, raw_response_sha256, per_place_outcome_counts,
  source_times, fetch_times, canonical_payload_sha256, accepted_at, retained_until
FROM provenance_receipts WHERE receipt_id = ? AND receipt_version = ?`;

function requireDatabase(database) {
  if (database === null || database === undefined || typeof database.prepare !== 'function') {
    throw new ProvenancePolicyError('PROVENANCE_STORAGE_UNAVAILABLE');
  }
}

function receiptFromRow(row) {
  if (row === null) return null;
  return deepFreeze({
    receipt_id: row.receipt_id,
    receipt_version: row.receipt_version,
    workflow_run_id: row.workflow_run_id,
    collector_version: row.collector_version,
    parser_version: row.parser_version,
    catalog_version: row.catalog_version,
    raw_response_sha256: row.raw_response_sha256,
    per_place_outcome_counts: JSON.parse(row.per_place_outcome_counts),
    source_times: JSON.parse(row.source_times),
    fetch_times: JSON.parse(row.fetch_times),
    canonical_payload_sha256: row.canonical_payload_sha256,
    accepted_at: row.accepted_at,
    retained_until: row.retained_until,
  });
}

export async function readProvenanceReceipt(database, key) {
  requireDatabase(database);
  const row = await database.prepare(RECEIPT_SELECT_SQL)
    .bind(key.receipt_id, key.receipt_version)
    .first();
  return receiptFromRow(row);
}

export async function persistProvenanceReceipt(database, receipt) {
  requireDatabase(database);
  await database.prepare(`INSERT OR IGNORE INTO provenance_receipts (
    receipt_id, receipt_version, workflow_run_id, collector_version, parser_version,
    catalog_version, raw_response_sha256, per_place_outcome_counts, source_times,
    fetch_times, canonical_payload_sha256, accepted_at, retained_until
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
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
    )
    .run();
  const persisted = await readProvenanceReceipt(database, receipt);
  if (persisted === null) throw new ProvenancePolicyError('PROVENANCE_STORAGE_FAILED');
  if (JSON.stringify(canonicalize(persisted)) !== JSON.stringify(canonicalize(receipt))) throw new ProvenancePolicyError('IMMUTABLE_RECEIPT_CONFLICT');
  return persisted;
}

export async function persistDerivedSourceBinding(database, binding) {
  requireDatabase(database);
  if (!['materialization', 'profile'].includes(binding.derived_kind) || typeof binding.derived_key !== 'string' || binding.derived_key.length === 0) {
    throw new ProvenancePolicyError('INVALID_SOURCE_BINDING');
  }
  const source = bindDerivedRow(binding.receipt);
  await database.prepare(`INSERT OR IGNORE INTO provenance_source_bindings (
    derived_kind, derived_key, source_receipt_id, source_receipt_version, bound_at
  ) VALUES (?, ?, ?, ?, ?)`)
    .bind(binding.derived_kind, binding.derived_key, source.source_receipt_id, source.source_receipt_version, binding.receipt.accepted_at)
    .run();
  const persisted = await database.prepare(`SELECT source_receipt_id, source_receipt_version
    FROM provenance_source_bindings WHERE derived_kind = ? AND derived_key = ?`)
    .bind(binding.derived_kind, binding.derived_key)
    .first();
  if (persisted === null) throw new ProvenancePolicyError('SOURCE_BINDING_STORAGE_FAILED');
  if (persisted.source_receipt_id !== source.source_receipt_id || persisted.source_receipt_version !== source.source_receipt_version) {
    throw new ProvenancePolicyError('IMMUTABLE_SOURCE_BINDING_CONFLICT');
  }
  return source;
}

function failed(code, math) {
  return { verdict: 'FAIL', local_validation: 'FAIL', code, math };
}

function quotaEvidenceComplete(evidence, requiredFields, minimum) {
  return evidence !== null && typeof evidence === 'object'
    && evidence.evidence_scope === 'OWNER_ACCOUNT_SERVICE'
    && requiredFields.every((field) => evidence[field] !== undefined && evidence[field] !== '')
    && typeof evidence.observed_rate_limit_behavior === 'string'
    && evidence.observed_rate_limit_behavior.length > 0
    && Number.isInteger(evidence.documented_limit)
    && evidence.documented_limit >= minimum;
}

export function evaluateCadenceCapacity(proof, capacity) {
  const math = {
    scheduled_runs_per_day: 24 * 60 / capacity.selected_cadence_minutes,
    requests_per_run: capacity.catalog_place_count * capacity.max_attempts_per_place,
    requests_per_day: 24 * 60 / capacity.selected_cadence_minutes * capacity.catalog_place_count * capacity.max_attempts_per_place,
    max_concurrent_requests: capacity.max_concurrent_requests,
  };
  if (proof === null || typeof proof !== 'object' || Array.isArray(proof)) return failed('MALFORMED_INPUT', math);
  if (proof.catalog_place_count !== capacity.catalog_place_count) return failed('WHOLE_CATALOG_REQUIRED', math);
  if (!Array.isArray(proof.runs) || proof.runs.length !== capacity.required_live_cadence_runs) return failed('FOUR_WHOLE_CATALOG_RUNS_REQUIRED', math);
  for (const [index, run] of proof.runs.entries()) {
    if (run.status !== 'accepted' || run.attempted_count !== capacity.catalog_place_count) return failed('WHOLE_CATALOG_RUN_REQUIRED', math);
    if (!Number.isInteger(run.request_attempts) || run.request_attempts < capacity.catalog_place_count || run.request_attempts > math.requests_per_run) return failed('UNBOUNDED_RETRY', math);
    if (index > 0) {
      const interval = Date.parse(run.scheduled_at) - Date.parse(proof.runs[index - 1].scheduled_at);
      if (interval !== capacity.selected_cadence_minutes * 60_000) return failed('CADENCE_INTERVAL_MISMATCH', math);
    }
  }
  if (proof.overlap?.scheduled !== 'REJECTED_OVERLAP') return failed('SCHEDULED_OVERLAP_NOT_REJECTED', math);
  if (proof.overlap?.manual_backfill !== 'REJECTED_OVERLAP') return failed('MANUAL_BACKFILL_OVERLAP_NOT_REJECTED', math);
  const blockers = [];
  if (!quotaEvidenceComplete(proof.owner_quota_evidence, capacity.required_owner_quota_evidence, math.requests_per_day)) blockers.push('OWNER_BOUND_QUOTA_EVIDENCE_REQUIRED');
  const liveRuns = proof.live_scheduled_receipts;
  if (!Array.isArray(liveRuns) || liveRuns.length !== capacity.required_live_cadence_runs || liveRuns.some((run) => run.evidence_scope !== 'LIVE_SCHEDULED' || run.attempted_count !== capacity.catalog_place_count)) blockers.push('FOUR_LIVE_SCHEDULED_RUN_RECEIPTS_REQUIRED');
  if (blockers.length > 0) return { verdict: 'NOT_RUN_BLOCKED', local_validation: 'PASS', code: 'OWNER_OR_LIVE_EVIDENCE_REQUIRED', blockers, math };
  return { verdict: 'PASS', local_validation: 'PASS', code: 'CAPACITY_PROVEN', blockers, math };
}

export function evaluateTask08Fixture(fixture, capacity = fixture?.capacity_contract) {
  try {
    if (fixture === null || typeof fixture !== 'object' || Array.isArray(fixture)) return { verdict: 'FAIL', code: 'MALFORMED_INPUT' };
    if (fixture.accepted_ingest !== undefined) {
      const receipt = createProvenanceReceipt(fixture.accepted_ingest);
      const ledger = appendReceipt([], receipt);
      if (fixture.retention_query_at && !findRetainedReceipt(ledger, { receipt_id: receipt.receipt_id, receipt_version: receipt.receipt_version, query_at: fixture.retention_query_at })) return { verdict: 'FAIL', code: 'RECEIPT_RETENTION_HORIZON_FAILED' };
    }
    if (!capacity || !fixture.capacity_proof) return { verdict: 'FAIL', code: 'MALFORMED_INPUT' };
    return evaluateCadenceCapacity(fixture.capacity_proof, capacity);
  } catch (error) {
    if (error instanceof ProvenancePolicyError) return { verdict: 'FAIL', code: error.code };
    throw error;
  }
}
