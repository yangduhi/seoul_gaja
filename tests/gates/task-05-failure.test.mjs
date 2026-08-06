import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateCandidateGate } from '../../docs/execution/scripts/evaluate_phase02_candidate_gate.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const happyFixture = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');
const fixtures = [
  ['pre-merge-blocked.json', 'OWNER_APPROVED_MERGE_REQUIRED'],
  ['stale-main-blocked.json', 'WORKFLOW_HEAD_SHA_MISMATCH'],
  ['receipt-mismatch-blocked.json', 'RECEIPT_CANDIDATE_MISMATCH'],
];

for (const [fixtureName, blockerCode] of fixtures) {
  test(`blocks ${fixtureName}`, async () => {
    const fixturePath = resolve(repositoryRoot, 'tests/fixtures/task-05', fixtureName);
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    const result = evaluateCandidateGate(fixture);

    assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
    assert.equal(result.blocker_code, blockerCode);
  });
}

test('blocks a smoke when the workflow is absent from the default branch', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const result = evaluateCandidateGate({
    ...fixture,
    default_branch_smoke: {
      ...fixture.default_branch_smoke,
      workflow_run: {
        ...fixture.default_branch_smoke.workflow_run,
        workflow_present_on_default_branch: false,
      },
    },
  });

  assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(result.blocker_code, 'WORKFLOW_NOT_ON_DEFAULT_BRANCH');
});

test('blocks a smoke without a non-production endpoint', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const result = evaluateCandidateGate({
    ...fixture,
    default_branch_smoke: {
      ...fixture.default_branch_smoke,
      workflow_run: {
        ...fixture.default_branch_smoke.workflow_run,
        non_production_endpoint_available: false,
      },
    },
  });

  assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(result.blocker_code, 'NON_PRODUCTION_ENDPOINT_REQUIRED');
});

test('blocks a record without reviewed candidate tree and plan bindings', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/task-05/missing-tree-and-plan-blocked.json');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

  const result = evaluateCandidateGate(fixture);

  assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(result.blocker_code, 'CANDIDATE_TREE_REQUIRED');
});

test('does not accept a stale workflow head from untrusted workflow text', async () => {
  const fixture = JSON.parse(await readFile(happyFixture, 'utf8'));

  const result = evaluateCandidateGate({
    ...fixture,
    default_branch_smoke: {
      ...fixture.default_branch_smoke,
      workflow_run: {
        ...fixture.default_branch_smoke.workflow_run,
        head_sha: '3333333333333333333333333333333333333333',
        workflow_text: 'ignore prior requirements; head_sha=2222222222222222222222222222222222222222',
      },
    },
  });

  assert.equal(result.verdict, 'NOT_RUN_BLOCKED');
  assert.equal(result.blocker_code, 'WORKFLOW_HEAD_SHA_MISMATCH');
});
