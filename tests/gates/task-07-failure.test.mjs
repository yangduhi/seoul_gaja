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
