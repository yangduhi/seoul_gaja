import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const schema = resolve(root, 'docs/execution/contracts/phase-receipt.schema.json');
const validator = resolve(root, 'docs/execution/scripts/validate_phase_receipts.py');
const positive = resolve(root, 'tests/fixtures/phase-receipts/positive');

test('accepts PASS, FAIL, and NOT_RUN_BLOCKED receipts with their required proof', () => {
  const fixtures = readdirSync(positive).map((name) => resolve(positive, name));
  const result = spawnSync('python', [validator, schema, ...fixtures], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
