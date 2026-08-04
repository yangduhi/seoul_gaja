import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateSnapshotRevision, evaluateMigrationContract } from '../../server/snapshot-revision.mjs';

const root = resolve(import.meta.dirname, '..', '..');

function places({ fresh = 121, carried = 0 } = {}) {
  return Array.from({ length: 121 }, (_, index) => ({
    area_code: `area-${String(index + 1).padStart(3, '0')}`,
    sourceUpdatedAt: '2026-08-04T10:00:00Z',
    refreshed: index < fresh,
    carried: index >= fresh && index < fresh + carried,
  }));
}

test('Given 121 server-fresh refreshed places, when a first snapshot arrives, then it activates at the 97 threshold', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-first',
    attempt_no: 1,
    revision_id: 'revision-1',
    payload_sha256: 'a'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: places({ fresh: 121 }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 },
    has_last_known_good: false,
  });

  assert.deepEqual(result, {
    verdict: 'ACCEPTED',
    activation: 'ACTIVATE_FIRST',
    refreshed_fresh_count: 121,
    refreshed_count: 121,
    refreshed_or_carried_non_expired_count: 121,
    clock_skew_clamped: false,
    fetched_at_degraded: false,
  });
});

test('Given a replacement with one refreshed-fresh and 96 non-expired carried places, when it arrives, then it activates', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-replacement',
    attempt_no: 1,
    revision_id: 'revision-2',
    payload_sha256: 'b'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: Array.from({ length: 121 }, (_, index) => ({
      area_code: `area-${String(index + 1).padStart(3, '0')}`,
      sourceUpdatedAt: index < 97 ? '2026-08-04T10:00:00Z' : '2026-08-04T07:00:00Z',
      refreshed: index === 0,
      carried: index >= 1 && index < 97,
    })),
    counters: { total: 121, fresh: 97, delayed: 0, stale: 0, expired: 24, unavailable: 0 },
    has_last_known_good: true,
  });

  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.activation, 'ACTIVATE_REPLACEMENT');
  assert.equal(result.refreshed_count, 1);
  assert.equal(result.refreshed_or_carried_non_expired_count, 97);
});

test('Given a partial revision, when the next attempt explicitly supersedes it, then recovery is accepted', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-recovery', attempt_no: 2, revision_id: 'revision-2', payload_sha256: 'd'.repeat(64), supersedes_revision_id: 'revision-1',
    existing_revisions: [{ run_id: 'run-recovery', attempt_no: 1, revision_id: 'revision-1', payload_sha256: 'e'.repeat(64), status: 'partial' }],
    server_now: '2026-08-04T10:30:00Z', places: places({ fresh: 121 }),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: true,
  });

  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.activation, 'ACTIVATE_REPLACEMENT');
});

test('Given an upstream timestamp is absent, when fetchedAt is used, then the receipt records degraded freshness provenance', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-degraded', attempt_no: 1, revision_id: 'revision-degraded', payload_sha256: 'f'.repeat(64),
    server_now: '2026-08-04T10:30:00Z',
    places: places({ fresh: 121 }).map((place, index) => index === 0 ? { ...place, sourceUpdatedAt: null, fetchedAt: '2026-08-04T10:00:00Z' } : place),
    counters: { total: 121, fresh: 121, delayed: 0, stale: 0, expired: 0, unavailable: 0 }, has_last_known_good: false,
  });

  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.fetched_at_degraded, true);
});

test('Given a source timestamp at every freshness boundary, when the server derives age, then boundary classes are stable', () => {
  const result = evaluateSnapshotRevision({
    run_id: 'run-boundaries',
    attempt_no: 1,
    revision_id: 'revision-boundaries',
    payload_sha256: 'c'.repeat(64),
    server_now: '2026-08-04T13:00:00Z',
    places: Array.from({ length: 121 }, (_, index) => ({
      area_code: `area-${String(index + 1).padStart(3, '0')}`,
      sourceUpdatedAt: index < 97 ? '2026-08-04T12:30:00Z' : index === 97 ? '2026-08-04T11:30:00Z' : index === 98 ? '2026-08-04T10:00:00Z' : '2026-08-04T09:59:59Z',
      refreshed: index < 97,
      carried: false,
    })),
    counters: { total: 121, fresh: 97, delayed: 1, stale: 1, expired: 22, unavailable: 0 },
    has_last_known_good: false,
  });

  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.activation, 'ACTIVATE_FIRST');
});

test('Given the declared 0003 migration, when its compatibility fixture is evaluated, then it is forward-only and release-bound', async () => {
  const fixture = JSON.parse(await readFile(resolve(root, 'tests/fixtures/task-07/migration-compatible.json'), 'utf8'));
  const result = evaluateMigrationContract(fixture);

  assert.deepEqual(result, { verdict: 'PASS', migration_id: '0003_snapshot_revision_and_provenance' });
  const migration = await readFile(resolve(root, 'migrations/0003_snapshot_revision_and_provenance.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE snapshot_revisions/);
  assert.match(migration, /INSERT OR IGNORE INTO snapshot_revisions/);
  assert.match(migration, /Rollback limit: do not drop columns or tables/);
});
