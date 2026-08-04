import test from 'node:test';

import { assertProvenanceCadenceContract, readJson } from './task-08-contract.mjs';

test('Given a whole-catalog fixture, When provenance and cadence capacity are checked, Then the source receipt and four scheduled runs are required', async () => {
  const [contract, fixture] = await Promise.all([
    readJson('docs/execution/contracts/provenance-cadence-contract.json'),
    readJson('tests/fixtures/task-08/positive/whole-catalog-cadence.json'),
  ]);

  assertProvenanceCadenceContract(contract, fixture);
});
