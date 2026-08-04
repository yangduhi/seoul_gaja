import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Given no attached browser runtime, When final product QA is evaluated, Then it remains blocked without fixture promotion', async () => {
  const capability = JSON.parse(await readFile('tests/fixtures/final/f3-browser-capability.json', 'utf8'));

  assert.equal(capability.verdict, 'NOT_RUN_BLOCKED');
  assert.match(capability.reason, /No browser is attached/);
  assert.deepEqual(capability.forbidden_evidence, ['deterministic mockup', 'screenshot-only', 'source fixture']);
});
