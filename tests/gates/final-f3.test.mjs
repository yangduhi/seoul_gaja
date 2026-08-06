import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const designAuditValidator = resolve(repositoryRoot, 'docs/execution/scripts/validate_design_audit.py');

test('Given no attached browser runtime, When final product QA is evaluated, Then it remains blocked without fixture promotion', async () => {
  const capability = JSON.parse(await readFile('tests/fixtures/final/f3-browser-capability.json', 'utf8'));

  assert.equal(capability.verdict, 'NOT_RUN_BLOCKED');
  assert.match(capability.reason, /No browser is attached/);
  assert.deepEqual(capability.forbidden_evidence, ['deterministic mockup', 'screenshot-only', 'source fixture']);
});

test('Given the final F3 gate, When an active design audit exists, Then the candidate-bound validator is mandatory', async () => {
  const result = await execFileAsync(
    'python',
    [designAuditValidator, '--active', '--audit-root', resolve(repositoryRoot, '.omo/evidence/design-audit')],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
  const verdict = JSON.parse(result.stdout);
  assert.ok(['PASS', 'NOT_APPLICABLE'].includes(verdict.verdict));
});
