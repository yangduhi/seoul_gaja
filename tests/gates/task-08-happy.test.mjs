import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  appendReceipt,
  bindDerivedRow,
  canonicalPayloadSha256,
  createProvenanceReceipt,
  evaluateCadenceCapacity,
  findRetainedReceipt,
  persistProvenanceReceipt,
  readProvenanceReceipt,
} from '../../server/provenance-cadence.mjs';
import { handleIngestSnapshot } from '../../server/ingest-snapshot-request.mjs';
import { readJson } from './task-08-contract.mjs';
import { createD1Mock, createNormalizedSnapshot } from './task-08-d1-mock.mjs';

test('Given an accepted ingest, When provenance is persisted, Then its redacted canonical receipt remains queryable after the raw horizon', async () => {
  // Given
  const fixture = await readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json');
  const expectedHash = canonicalPayloadSha256(fixture.accepted_ingest.canonical_payload);

  // When
  const receipt = createProvenanceReceipt(fixture.accepted_ingest);
  const ledger = appendReceipt([], receipt);
  const retained = findRetainedReceipt(ledger, {
    receipt_id: receipt.receipt_id,
    receipt_version: receipt.receipt_version,
    query_at: fixture.retention_query_at,
  });

  // Then
  assert.equal(receipt.canonical_payload_sha256, expectedHash);
  assert.equal(retained?.canonical_payload_sha256, expectedHash);
  assert.equal(JSON.stringify(receipt).match(/authorization|token|api_key|raw_response_body/gi), null);
  assert.deepEqual(bindDerivedRow(receipt), {
    source_receipt_id: receipt.receipt_id,
    source_receipt_version: receipt.receipt_version,
  });
});

test('Given four local whole-catalog runs, When capacity is evaluated without owner/live authority, Then local structure passes but production capacity is blocked', async () => {
  // Given
  const [contract, fixture] = await Promise.all([
    readJson('docs/execution/contracts/provenance-cadence-contract.json'),
    readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json'),
  ]);

  // When
  const result = evaluateCadenceCapacity(fixture.capacity_proof, contract.capacity);

  // Then
  assert.equal(result.local_validation, 'PASS');
  assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(result.math.requests_per_run, 242);
  assert.equal(result.math.requests_per_day, 23_232);
  assert.deepEqual(result.blockers, ['OWNER_BOUND_QUOTA_EVIDENCE_REQUIRED', 'FOUR_LIVE_SCHEDULED_RUN_RECEIPTS_REQUIRED']);
});

test('Given accepted provenance metadata and a D1 binding, When the canonical ingest runs, Then it writes a durable receipt before accepting', async () => {
  // Given
  const fixture = await readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json');
  const database = createD1Mock();
  const { accepted_status: _acceptedStatus, canonical_payload: _canonicalPayload, ...provenanceReceipt } = fixture.accepted_ingest;
  const request = new Request('http://localhost/api/internal/ingest/snapshot', {
    method: 'POST',
    headers: { authorization: 'Bearer local-token', 'content-type': 'application/json' },
    body: JSON.stringify(createNormalizedSnapshot(provenanceReceipt)),
  });

  // When
  const response = await handleIngestSnapshot(request, 'local-token', database);

  // Then
  assert.equal(response.status, 202);
  assert.equal(database.statements.filter(({ sql }) => /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+provenance_receipts/i.test(sql)).length, 1);
  assert.equal(database.receipts.size, 1);
  assert.doesNotMatch(JSON.stringify([...database.receipts.values()]), /"(?:authorization|token|api_key|raw_response_body)"\s*:/i);
  assert.deepEqual(database.bindings.get('materialization:snapshot-local-0001'), {
    source_receipt_id: provenanceReceipt.receipt_id,
    source_receipt_version: provenanceReceipt.receipt_version,
    bound_at: provenanceReceipt.accepted_at,
  });
  const body = await response.json();
  assert.equal(body.canonicalPayloadSha256, database.receipts.values().next().value.canonical_payload_sha256);
});

test('Given an existing D1 receipt, When identical content is persisted and read, Then the row is idempotent and retained', async () => {
  // Given
  const fixture = await readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json');
  const receipt = createProvenanceReceipt(fixture.accepted_ingest);
  const database = createD1Mock();

  // When
  await persistProvenanceReceipt(database, receipt);
  await persistProvenanceReceipt(database, receipt);
  const retained = await readProvenanceReceipt(database, receipt);

  // Then
  assert.equal(database.receipts.size, 1);
  assert.deepEqual(retained, receipt);
  assert.equal(retained.retained_until, '2026-11-02T00:00:10.000Z');
});

test('Given migration 0003, When provenance storage is inspected, Then append-only receipt and derived source bindings are additive', async () => {
  // Given
  const migration = await readFile('migrations/0003_snapshot_revision_and_provenance.sql', 'utf8');

  // When
  const receiptTable = migration.match(/CREATE TABLE provenance_receipts \([\s\S]*?\n\);/)?.[0] ?? '';
  const bindingTable = migration.match(/CREATE TABLE provenance_source_bindings \([\s\S]*?\n\);/)?.[0] ?? '';

  // Then
  for (const field of [
    'receipt_id', 'receipt_version', 'workflow_run_id', 'collector_version', 'parser_version',
    'catalog_version', 'raw_response_sha256', 'per_place_outcome_counts', 'source_times',
    'fetch_times', 'canonical_payload_sha256', 'accepted_at', 'retained_until',
  ]) assert.match(receiptTable, new RegExp(`\\b${field}\\b`));
  assert.match(bindingTable, /derived_kind[\s\S]*source_receipt_id[\s\S]*source_receipt_version/);
  assert.match(migration, /provenance_receipts_no_update[\s\S]*provenance_receipts_no_delete/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|RENAME\s+TABLE/i);
});
