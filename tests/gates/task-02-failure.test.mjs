import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertTerminologyContract } from './task-02-contract.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('Given stale route and receipt fixtures, When terminology is validated, Then each fixture is rejected with its file and line', async () => {
  for (const fixtureName of ['stale-route.md', 'stale-receipt.md']) {
    const fixturePath = join(repositoryRoot, 'tests', 'fixtures', 'task-02', fixtureName);
    const fixture = await readFile(fixturePath, 'utf8');
    assert.throws(
      () => assertTerminologyContract(fixturePath, fixture),
      new RegExp(`tests[\\\\/]fixtures[\\\\/]task-02[\\\\/]${fixtureName.replace('.', '\\.')}:1:`),
    );
  }
});
