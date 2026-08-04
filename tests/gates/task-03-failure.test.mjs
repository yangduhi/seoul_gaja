import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const schema = resolve(root, 'docs/codex-pack-v4/contracts/phase-receipt.schema.json');
const validator = resolve(root, 'docs/execution/scripts/validate_phase_receipts.py');
const negative = resolve(root, 'tests/fixtures/phase-receipts/negative');

for (const fixture of readdirSync(negative)) {
  test(`rejects ${fixture}`, () => {
    const result = spawnSync('python', [validator, schema, resolve(negative, fixture)], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, `${fixture} was accepted unexpectedly`);
  });
}
