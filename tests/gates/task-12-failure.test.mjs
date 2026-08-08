import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { evaluateNegativeFixture } from './task-12-contract.mjs';

const negativeRoot = resolve(process.cwd(), 'tests/fixtures/task-12/negative');

for (const name of await readdir(negativeRoot)) {
  test(`Given ${name}, When semantic closeout evaluates an unsafe input, Then it refuses completion`, async () => {
    const fixture = JSON.parse(await readFile(resolve(negativeRoot, name), 'utf8'));
    assert.deepEqual(evaluateNegativeFixture(fixture), { verdict: 'FAIL', reason: fixture.expected_reason });
  });
}
