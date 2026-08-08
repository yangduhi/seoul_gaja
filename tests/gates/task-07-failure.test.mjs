import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateMigrationContract, evaluateSnapshotRevision } from '../../server/snapshot-revision.mjs';

const root = resolve(import.meta.dirname, '..', '..');

function places(overrides = {}) {
  return Array.from({ length: 121 }, (_, index) => ({
    area_code: `area-${String(index + 1).padStart(3, '0')}`,
    sourceUpdatedAt: index < 96 ? '2026-08-04T10:00:00Z' : '2026-08-04T07:00:00Z',
    refreshed: index < 96,
    carried: false,
    ...overrides,
  }));
}

async function fixture(name) {
  return JSON.parse(await readFile(resolve(root, 'tests/fixtures/task-07', name), 'utf8'));
}

test('Given the same run attempt and a different payload hash, when it is retried, then the ingest conflicts with 409', async () => {
  const result = evaluateSnapshotRevision(await fixture('payload-conflict.json'));
  assert.deepEqual(result, { verdict: 'REJECTED', status: 409, code: 'PAYLOAD_HASH_CONFLICT' });
});

test('Given a replay with the identical identity and hash, when it is retried, then the existing receipt is returned', async () => {
  const result = evaluateSnapshotRevision(await fixture('replay.json'));
  assert.deepEqual(result, { verdict: 'REPLAY', receipt_id: 'receipt-existing' });
});

test('Given recovery of a non-partial revision or a skipped attempt, when it is evaluated, then it is rejected', async () => {
  for (const name of ['recovery-non-partial.json', 'recovery-skipped-attempt.json']) {
    const result = evaluateSnapshotRevision(await fixture(name));
    assert.equal(result.verdict, 'REJECTED');
    assert.match(result.code, /^RECOVERY_/);
  }
});

test('Given more than five minutes of future skew, when server freshness is derived, then it is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-future', attempt_no: 1, revision_id: 'revision-future', payload_sha256: 'd'.repeat(64),
    server_now: '2026-08-04T10:00:00Z', places: places({ sourceUpdatedAt: '2026-08-04T10:05:01Z' }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: false,
  });
  assert.deepEqual(result, { verdict: 'REJECTED', code: 'FUTURE_SOURCE_TIMESTAMP' });
});

test('Given smaller future skew, when server freshness is derived, then it clamps to zero and records the flag', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-clamped', attempt_no: 1, revision_id: 'revision-clamped', payload_sha256: 'e'.repeat(64),
    server_now: '2026-08-04T10:00:00Z', places: places({ sourceUpdatedAt: '2026-08-04T10:05:00Z' }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: false,
  });
  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.clock_skew_clamped, true);
});

test('Given a counter mismatch, 96-place first activation, or all unavailable snapshot, when evaluated, then it fails closed or retains LKG', () => {
  const base = {
    run_id: 'run-failure', attempt_no: 1, revision_id: 'revision-failure', payload_sha256: 'f'.repeat(64),
    server_now: '2026-08-04T10:30:00Z', places: places(), counters: { total: 121, fresh: 96, delayed: 0, stale: 0, expired: 25, unavailable: 0 }, has_last_known_good: false,
  };
  assert.deepEqual(evaluateSnapshotRevision({ ...base, counters: { ...base.counters, fresh: 120 } }), { verdict: 'REJECTED', code: 'COUNTER_RECONCILIATION_FAILED' });
  assert.equal(evaluateSnapshotRevision(base).activation, 'RETAIN_LKG');
  assert.deepEqual(evaluateSnapshotRevision({
    ...base, has_last_known_good: true, places: places({ sourceUpdatedAt: null, refreshed: false }),
    counters: { total: 121, fresh: 0, delayed: 0, stale: 0, expired: 0, unavailable: 121 },
  }), { verdict: 'ACCEPTED', activation: 'AUDIT_ONLY_LKG_RETAINED', refreshed_fresh_count: 0, refreshed_count: 0, refreshed_or_carried_non_expired_count: 0, clock_skew_clamped: false, fetched_at_degraded: false });
});

test('Given a pre-existing migration sequence collision, when the migration contract is evaluated, then it remains owner-blocked', async () => {
  const result = evaluateMigrationContract(await fixture('migration-collision.json'));
  assert.deepEqual(result, {
    verdict: 'NOT_RUN_BLOCKED',
    code: 'MIGRATION_SEQUENCE_COLLISION',
    owner_action: 'Approve a v4.1 authority amendment for the migration sequence; do not rename or execute the migration.',
  });
});

test('Given a malformed upstream timestamp, when fetchedAt is present, then degraded fallback is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-malformed-source', attempt_no: 1, revision_id: 'revision-malformed-source', payload_sha256: '1'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: places({ sourceUpdatedAt: 'not-a-timestamp', fetchedAt: '2026-08-04T10:00:00Z', freshness_basis: 'fetched_at_degraded' }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: false,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', code: 'MALFORMED_SOURCE_TIMESTAMP' });
});

test('Given source time is absent without explicit degraded provenance, when fetchedAt is present, then fallback is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-implicit-degraded', attempt_no: 1, revision_id: 'revision-implicit-degraded', payload_sha256: '2'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: places({ sourceUpdatedAt: null, fetchedAt: '2026-08-04T10:00:00Z' }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: false,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', code: 'FETCHED_AT_DEGRADED_BASIS_REQUIRED' });
});

test('Given a revision id already belongs to another attempt, when a new tuple reuses it, then identity is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-new', attempt_no: 1, revision_id: 'revision-existing', payload_sha256: '3'.repeat(64),
    existing_revisions: [{ run_id: 'run-existing', attempt_no: 1, revision_id: 'revision-existing', payload_sha256: '4'.repeat(64), status: 'accepted' }],
    server_now: '2026-08-04T10:30:00Z', places: places(),
    counters: { total: 121, fresh: 96, delayed: 0, stale: 0, expired: 25, unavailable: 0 }, has_last_known_good: false,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', status: 409, code: 'REVISION_ID_CONFLICT' });
});

test('Given overlapping refreshed and carried provenance, when usable places are counted, then double counting is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-overlap', attempt_no: 1, revision_id: 'revision-overlap', payload_sha256: '5'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: places().map((place, index) => ({ ...place, refreshed: index === 0, carried: index < 97 })),
    counters: { total: 121, fresh: 96, delayed: 0, stale: 0, expired: 25, unavailable: 0 }, has_last_known_good: true,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', code: 'PLACE_PROVENANCE_CONFLICT' });
});

test('Given a non-string catalog identity, when 121 rows are reconciled, then catalog identity validation rejects it', () => {
  const malformedPlaces = places();
  malformedPlaces[120] = { ...malformedPlaces[120], area_code: null };
  const result = evaluateSnapshotRevision({
    run_id: 'run-malformed-identity', attempt_no: 1, revision_id: 'revision-malformed-identity', payload_sha256: '6'.repeat(64),
    server_now: '2026-08-04T10:30:00Z', places: malformedPlaces,
    counters: { total: 121, fresh: 96, delayed: 0, stale: 0, expired: 25, unavailable: 0 }, has_last_known_good: false,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', code: 'CATALOG_IDENTITIES_UNIQUE_REQUIRED' });
});

test('Given an undeclared counter, when freshness counters are reconciled, then the generation is rejected', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-extra-counter', attempt_no: 1, revision_id: 'revision-extra-counter', payload_sha256: '7'.repeat(64),
    server_now: '2026-08-04T10:30:00Z', places: places(),
    counters: { total: 121, fresh: 96, delayed: 0, stale: 0, expired: 25, unavailable: 0, ignored: 121 }, has_last_known_good: false,
  });

  assert.deepEqual(result, { verdict: 'REJECTED', code: 'COUNTER_RECONCILIATION_FAILED' });
});

test('Given every place is expired, when a generation is evaluated with an LKG, then it is audit-only and retains the LKG', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-all-expired', attempt_no: 1, revision_id: 'revision-all-expired', payload_sha256: '8'.repeat(64),
    server_now: '2026-08-04T10:30:00Z', places: places({ sourceUpdatedAt: '2026-08-04T07:29:59Z', refreshed: false }),
    counters: { total: 121, fresh: 0, delayed: 0, stale: 0, expired: 121, unavailable: 0 }, has_last_known_good: true,
  });

  assert.deepEqual(result, { verdict: 'ACCEPTED', activation: 'AUDIT_ONLY_LKG_RETAINED', refreshed_fresh_count: 0, refreshed_count: 0, refreshed_or_carried_non_expired_count: 0, clock_skew_clamped: false, fetched_at_degraded: false });
});
