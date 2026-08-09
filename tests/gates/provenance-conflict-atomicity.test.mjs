import assert from 'node:assert/strict';
import test from 'node:test';

import { handleIngestSnapshot } from '../../server/ingest-snapshot-request.mjs';
import { createD1Mock, createNormalizedSnapshot } from './task-08-d1-mock.mjs';

function provenanceReceipt(receiptId) {
  return {
    receipt_id: receiptId,
    receipt_version: 1,
    workflow_run_id: 'run-local',
    collector_version: 'collector-v1',
    parser_version: 'parser-v1',
    catalog_version: 'catalog-v1',
    raw_response_sha256: 'a'.repeat(64),
    per_place_outcome_counts: { refreshed: 121 },
    source_times: ['2026-08-04T00:00:00Z'],
    fetch_times: ['2026-08-04T00:00:05Z'],
    accepted_at: '2026-08-04T00:00:10Z',
  };
}

function ingestRequest(receipt) {
  return new Request('http://localhost/api/internal/ingest/snapshot', {
    method: 'POST',
    headers: { authorization: 'Bearer local-token', 'content-type': 'application/json' },
    body: JSON.stringify(createNormalizedSnapshot(receipt)),
  });
}

test('Given a stale snapshot with an incompatible receipt, When canonical ingest rejects it, Then no rejected receipt or binding remains', async () => {
  // Given
  const database = createD1Mock();
  const first = await handleIngestSnapshot(ingestRequest(provenanceReceipt('receipt-first')), 'local-token', database);
  const receiptsBefore = structuredClone([...database.receipts.entries()]);
  const bindingsBefore = structuredClone([...database.bindings.entries()]);

  // When
  const second = await handleIngestSnapshot(ingestRequest(provenanceReceipt('receipt-replayed')), 'local-token', database);

  // Then
  assert.equal(first.status, 202);
  assert.equal(second.status, 409);
  assert.deepEqual(await second.json(), { error: 'provenance_conflict' });
  assert.equal(database.receipts.size, 1);
  assert.equal(database.bindings.size, 2);
  assert.deepEqual([...database.receipts.entries()], receiptsBefore);
  assert.deepEqual([...database.bindings.entries()], bindingsBefore);
});
