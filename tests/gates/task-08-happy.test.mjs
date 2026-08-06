import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendReceipt,
  bindDerivedRow,
  canonicalPayloadSha256,
  createProvenanceReceipt,
  evaluateCadenceCapacity,
  findRetainedReceipt,
} from '../../server/provenance-cadence.mjs';
import { readJson } from './task-08-contract.mjs';

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
