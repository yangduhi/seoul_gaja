import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateBranchLocal,
  evaluateCandidateGate,
  readLocalCandidateBinding,
} from '../../docs/execution/scripts/evaluate_phase02_candidate_gate.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const templatePath = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');

function bindTemplate(template, candidateBinding) {
  return {
    ...template,
    branch_local: {
      ...template.branch_local,
      ...candidateBinding,
      reviewed_candidate_sha: candidateBinding.candidate_sha,
      reviewed_candidate_tree: candidateBinding.candidate_tree,
      reviewed_plan_sha256: candidateBinding.plan_sha256,
      tests: [{
        id: 'task-05-happy',
        exit_code: 0,
        ...candidateBinding,
      }],
    },
  };
}

test('accepts branch-local verification only when it is bound to this checkout candidate', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);

  assert.deepEqual(evaluateBranchLocal(record, { candidateBinding }), {
    verdict: 'PASS',
    ...candidateBinding,
  });
});

test('keeps the complete gate blocked without injected owner-authorized external proof', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);

  assert.deepEqual(evaluateCandidateGate(record, { candidateBinding }), {
    verdict: 'NOT_RUN_BLOCKED',
    candidate_sha: candidateBinding.candidate_sha,
    blocker_code: 'OWNER_AUTHORIZED_EXTERNAL_RUN_REQUIRED',
    owner_action: 'Approve the exact candidate merge to main and provide the resulting default-branch workflow run and receipt bound to that merge.',
  });
});
