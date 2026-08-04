import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('Given the integrated local candidate, When security and data semantics are audited, Then local gates pass while owner-bound proof remains blocked', async () => {
  const [blockerText, cadenceText, phase00Text] = await Promise.all([
    readFile('tests/fixtures/final/owner-blockers.json', 'utf8'),
    readFile('docs/execution/contracts/provenance-cadence-contract.json', 'utf8'),
    readFile('docs/evidence/phase-00/phase-receipt.json', 'utf8'),
  ]);
  const blockers = JSON.parse(blockerText);
  const cadence = JSON.parse(cadenceText);
  const phase00 = JSON.parse(phase00Text);

  assert.equal(blockers.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(cadence.capacity.required_live_cadence_runs, 4);
  assert.equal(cadence.capacity.catalog_place_count, 121);
  assert.equal(phase00.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(phase00.secret_status, 'REDACTED');
  await execFileAsync('node', ['--test', 'tests/gates/task-04-happy.test.mjs', 'tests/gates/task-04-failure.test.mjs', 'tests/gates/task-05-happy.test.mjs', 'tests/gates/task-05-failure.test.mjs', 'tests/gates/task-06-happy.test.mjs', 'tests/gates/task-06-failure.test.mjs', 'tests/gates/task-07-happy.test.mjs', 'tests/gates/task-07-failure.test.mjs', 'tests/gates/task-08-happy.test.mjs', 'tests/gates/task-08-failure.test.mjs', 'tests/gates/task-09-happy.test.mjs', 'tests/gates/task-09-failure.test.mjs'], { maxBuffer: 16 * 1024 * 1024 });
  await execFileAsync('python', ['docs/execution/scripts/validate_phase_receipts.py', 'docs/execution/contracts/phase-receipt.schema.json', 'docs/evidence/phase-00/phase-receipt.json']);
});
