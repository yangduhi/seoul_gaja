import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateNegativeFixture, readJson } from './task-08-contract.mjs';

const negativeRoot = 'tests/fixtures/task-08/negative';

for (const name of await readdir(resolve(process.cwd(), negativeRoot))) {
  test(`Given ${name}, When provenance capacity proof is incomplete or unsafe, Then it fails closed`, async () => {
    const fixture = await readJson(`${negativeRoot}/${name}`);
    assert.deepEqual(evaluateNegativeFixture(fixture), { verdict: fixture.expected_verdict });
  });
}
