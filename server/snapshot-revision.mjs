const CATALOG_SIZE = 121;
const FRESH_MAX_MS = 30 * 60 * 1000;
const DELAYED_MAX_MS = 90 * 60 * 1000;
const STALE_MAX_MS = 180 * 60 * 1000;
const FUTURE_SKEW_MAX_MS = 5 * 60 * 1000;
const SHA256 = /^[a-f0-9]{64}$/;

function rejected(code, status) {
  return status ? { verdict: 'REJECTED', status, code } : { verdict: 'REJECTED', code };
}

function parseUtc(value) {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function classifyFreshness(place, serverNow) {
  const hasSourceTimestamp = place.sourceUpdatedAt !== null && place.sourceUpdatedAt !== undefined;
  const hasFetchedTimestamp = place.fetchedAt !== null && place.fetchedAt !== undefined;
  let timestamp;
  let fetchedAtDegraded = false;
  if (hasSourceTimestamp) {
    timestamp = parseUtc(place.sourceUpdatedAt);
    if (timestamp === null) return { kind: 'rejected', code: 'MALFORMED_SOURCE_TIMESTAMP' };
  } else if (hasFetchedTimestamp) {
    if (place.freshness_basis !== 'fetched_at_degraded') return { kind: 'rejected', code: 'FETCHED_AT_DEGRADED_BASIS_REQUIRED' };
    timestamp = parseUtc(place.fetchedAt);
    if (timestamp === null) return { kind: 'rejected', code: 'MALFORMED_FETCHED_TIMESTAMP' };
    fetchedAtDegraded = true;
  } else {
    return { kind: 'unavailable', clockSkewClamped: false, fetchedAtDegraded: false };
  }
  const age = serverNow - timestamp;
  if (age < -FUTURE_SKEW_MAX_MS) return { kind: 'future_rejected', clockSkewClamped: false, fetchedAtDegraded };
  const effectiveAge = age < 0 ? 0 : age;
  const clockSkewClamped = age < 0;
  if (effectiveAge <= FRESH_MAX_MS) return { kind: 'fresh', clockSkewClamped, fetchedAtDegraded };
  if (effectiveAge <= DELAYED_MAX_MS) return { kind: 'delayed', clockSkewClamped, fetchedAtDegraded };
  if (effectiveAge <= STALE_MAX_MS) return { kind: 'stale', clockSkewClamped, fetchedAtDegraded };
  return { kind: 'expired', clockSkewClamped, fetchedAtDegraded };
}

function identityResult(record) {
  if (typeof record?.run_id !== 'string' || record.run_id.length === 0) return rejected('RUN_ID_REQUIRED');
  if (!Number.isInteger(record.attempt_no) || record.attempt_no < 1) return rejected('ATTEMPT_NO_REQUIRED');
  if (typeof record.revision_id !== 'string' || record.revision_id.length === 0) return rejected('REVISION_ID_REQUIRED');
  if (typeof record.payload_sha256 !== 'string' || !SHA256.test(record.payload_sha256)) return rejected('PAYLOAD_SHA256_REQUIRED');
  const existing = Array.isArray(record.existing_revisions) ? record.existing_revisions : [];
  const priorAttempt = existing.find((revision) => revision?.run_id === record.run_id && revision.attempt_no === record.attempt_no);
  if (priorAttempt) return priorAttempt.payload_sha256 === record.payload_sha256 ? { verdict: 'REPLAY', receipt_id: priorAttempt.receipt_id } : rejected('PAYLOAD_HASH_CONFLICT', 409);
  if (existing.some((revision) => revision?.revision_id === record.revision_id)) return rejected('REVISION_ID_CONFLICT', 409);
  if (record.attempt_no > 1) {
    if (typeof record.supersedes_revision_id !== 'string' || record.supersedes_revision_id.length === 0) return rejected('RECOVERY_SUPERSEDES_REQUIRED');
    const superseded = existing.find((revision) => revision?.run_id === record.run_id && revision.revision_id === record.supersedes_revision_id);
    if (!superseded || superseded.status !== 'partial') return rejected('RECOVERY_MUST_SUPERSEDE_PARTIAL');
    if (record.attempt_no !== superseded.attempt_no + 1) return rejected('RECOVERY_ATTEMPT_MUST_INCREMENT');
  }
  return null;
}

function aggregatePlaces(record) {
  if (!Array.isArray(record.places) || record.places.length !== CATALOG_SIZE) return rejected('CATALOG_IDENTITY_COUNT_REQUIRED');
  const areaCodes = record.places.map((place) => place?.area_code);
  if (areaCodes.some((areaCode) => typeof areaCode !== 'string' || areaCode.length === 0) || new Set(areaCodes).size !== CATALOG_SIZE) return rejected('CATALOG_IDENTITIES_UNIQUE_REQUIRED');
  const serverNow = parseUtc(record.server_now);
  if (serverNow === null) return rejected('SERVER_UTC_TIME_REQUIRED');
  const counts = { total: CATALOG_SIZE, fresh: 0, delayed: 0, stale: 0, expired: 0, unavailable: 0 };
  let clockSkewClamped = false;
  let fetchedAtDegraded = false;
  let refreshedFreshCount = 0;
  let refreshedCount = 0;
  let carriedNonExpiredCount = 0;
  for (const place of record.places) {
    if (typeof place.refreshed !== 'boolean' || typeof place.carried !== 'boolean') return rejected('PLACE_PROVENANCE_REQUIRED');
    if (place.refreshed && place.carried) return rejected('PLACE_PROVENANCE_CONFLICT');
    const freshness = classifyFreshness(place, serverNow);
    if (freshness.kind === 'rejected') return rejected(freshness.code);
    if (freshness.kind === 'future_rejected') return rejected('FUTURE_SOURCE_TIMESTAMP');
    counts[freshness.kind] += 1;
    clockSkewClamped ||= freshness.clockSkewClamped;
    fetchedAtDegraded ||= freshness.fetchedAtDegraded;
    if (place.refreshed) {
      refreshedCount += 1;
      if (freshness.kind === 'fresh') refreshedFreshCount += 1;
    }
    if (place.carried && freshness.kind !== 'expired' && freshness.kind !== 'unavailable') carriedNonExpiredCount += 1;
  }
  const counters = record.counters;
  if (!counters || Object.keys(counters).length !== Object.keys(counts).length || Object.keys(counts).some((key) => counters[key] !== counts[key])) return rejected('COUNTER_RECONCILIATION_FAILED');
  const counterTotal = counts.fresh + counts.delayed + counts.stale + counts.expired + counts.unavailable;
  if (counterTotal !== CATALOG_SIZE) return rejected('COUNTER_RECONCILIATION_FAILED');
  return { counts, clockSkewClamped, fetchedAtDegraded, refreshedFreshCount, refreshedCount, carriedNonExpiredCount };
}

export function evaluateSnapshotRevision(record) {
  const identity = identityResult(record);
  if (identity) return identity;
  const aggregate = aggregatePlaces(record);
  if (aggregate.verdict === 'REJECTED') return aggregate;
  const refreshedOrCarried = aggregate.refreshedFreshCount + aggregate.carriedNonExpiredCount;
  const allUnavailableOrExpired = aggregate.counts.unavailable + aggregate.counts.expired === CATALOG_SIZE;
  let activation = 'RETAIN_LKG';
  if (allUnavailableOrExpired) activation = record.has_last_known_good ? 'AUDIT_ONLY_LKG_RETAINED' : 'AUDIT_ONLY_NOT_ACTIVATED';
  else if (!record.has_last_known_good && aggregate.refreshedFreshCount >= 97) activation = 'ACTIVATE_FIRST';
  else if (record.has_last_known_good && aggregate.refreshedCount >= 1 && refreshedOrCarried >= 97) activation = 'ACTIVATE_REPLACEMENT';
  return { verdict: 'ACCEPTED', activation, refreshed_fresh_count: aggregate.refreshedFreshCount, refreshed_count: aggregate.refreshedCount, refreshed_or_carried_non_expired_count: refreshedOrCarried, clock_skew_clamped: aggregate.clockSkewClamped, fetched_at_degraded: aggregate.fetchedAtDegraded };
}

export function evaluateMigrationContract(record) {
  const migrationId = '0003_snapshot_revision_and_provenance';
  if (!Array.isArray(record?.existing_migration_ids) || record.existing_migration_ids.some((id) => typeof id === 'string' && id.startsWith('0003_'))) return { verdict: 'NOT_RUN_BLOCKED', code: 'MIGRATION_SEQUENCE_COLLISION', owner_action: 'Approve a v4.1 authority amendment for the migration sequence; do not rename or execute the migration.' };
  if (record.migration_id !== migrationId || record.phase_08_release_migration_id !== migrationId || !record.read_old_before_write_new || !record.fixture_backfill_verified || record.rollback !== 'forward_only_restore_application_compatibility_without_schema_drop') return { verdict: 'FAIL', code: 'MIGRATION_COMPATIBILITY_CONTRACT_FAILED' };
  return { verdict: 'PASS', migration_id: migrationId };
}
