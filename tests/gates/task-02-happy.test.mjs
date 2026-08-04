import test from 'node:test';
import { assertRepositoryTerminologyContract } from './task-02-contract.mjs';

test('Given the v4 contract sources, When terminology is validated, Then canonical route and evidence terms agree', async () => {
  await assertRepositoryTerminologyContract();
});
