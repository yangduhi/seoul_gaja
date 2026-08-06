import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateCandidateGate } from '../../docs/execution/scripts/evaluate_phase02_candidate_gate.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const happyFixture = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');

test('accepts an owner-approved default-branch smoke bound to the reviewed candidate', async () => {
  const fixture = JSON.parse(await readFile(happyFixture, 'utf8'));
  const result = evaluateCandidateGate(fixture);

  assert.deepEqual(result, {
    verdict: 'PASS',
    candidate_sha: fixture.branch_local.candidate_sha,
    candidate_tree: fixture.branch_local.candidate_tree,
    plan_sha256: fixture.branch_local.plan_sha256,
    approved_merge_sha: fixture.default_branch_smoke.approved_merge_sha,
    approved_merge_tree: fixture.default_branch_smoke.approved_merge_tree,
    workflow_head_sha: fixture.default_branch_smoke.workflow_run.head_sha,
    workflow_head_tree: fixture.default_branch_smoke.workflow_run.head_tree,
  });
});
