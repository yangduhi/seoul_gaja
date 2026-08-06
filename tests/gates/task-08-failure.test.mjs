import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { appendReceipt, createProvenanceReceipt, evaluateTask08Fixture } from '../../server/provenance-cadence.mjs';
import { readJson } from './task-08-contract.mjs';

const negativeRoot = 'tests/fixtures/task-08/negative';
const capacity = (await readJson('docs/execution/contracts/provenance-cadence-contract.json')).capacity;

for (const name of await readdir(resolve(process.cwd(), negativeRoot))) {
  test(`Given ${name}, When provenance or capacity proof is unsafe, Then policy fails closed`, async () => {
    // Given
    const fixture = await readJson(`${negativeRoot}/${name}`);

    // When
    const result = evaluateTask08Fixture(fixture, capacity);

    // Then
    assert.equal(result.verdict, fixture.expected_verdict);
    assert.equal(result.code, fixture.expected_code);
  });
}

test('Given an immutable receipt key, When different content is appended, Then the ledger rejects the overwrite', async () => {
  // Given
  const fixture = await readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json');
  const original = createProvenanceReceipt(fixture.accepted_ingest);
  const ledger = appendReceipt([], original);
  const changed = Object.freeze({ ...original, collector_version: 'collector-v2' });

  // When / Then
  assert.throws(() => appendReceipt(ledger, changed), /IMMUTABLE_RECEIPT_CONFLICT/);
});
