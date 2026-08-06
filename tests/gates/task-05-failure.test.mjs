import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateBranchLocal,
  evaluateCandidateGate,
  readLocalCandidateBinding,
} from '../../docs/execution/scripts/evaluate_phase02_candidate_gate.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const evaluatorPath = resolve(repositoryRoot, 'docs/execution/scripts/evaluate_phase02_candidate_gate.mjs');
const templatePath = resolve(repositoryRoot, 'tests/fixtures/task-05/happy.json');
const malformedPath = resolve(repositoryRoot, 'tests/fixtures/task-05/malformed-record.json');

function bindTemplate(template, candidateBinding) {
  return {
    ...template,
    branch_local: {
      ...template.branch_local,
      ...candidateBinding,
      reviewed_candidate_sha: candidateBinding.candidate_sha,
      reviewed_candidate_tree: candidateBinding.candidate_tree,
      reviewed_plan_sha256: candidateBinding.plan_sha256,
      tests: [{ id: 'task-05-happy', exit_code: 0, ...candidateBinding }],
    },
  };
}

function externalAuthorization(candidateBinding) {
  return {
    kind: 'OWNER_AUTHORIZED_EXTERNAL_RUN',
    ...candidateBinding,
  };
}

test('rejects the checked-in placeholder template through the real CLI', async () => {
  await assert.rejects(
    execFileAsync('node', [evaluatorPath, templatePath], { cwd: repositoryRoot }),
    (error) => {
      assert.equal(error.code, 3);
      assert.match(error.stdout, /CANDIDATE_SHA_PLACEHOLDER/);
      return true;
    },
  );
});

test('rejects repeated candidate identifiers before they can match each other', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  record.branch_local.candidate_tree = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  record.branch_local.reviewed_candidate_tree = record.branch_local.candidate_tree;
  record.branch_local.tests[0].candidate_tree = record.branch_local.candidate_tree;

  assert.equal(evaluateBranchLocal(record, { candidateBinding }).blocker_code, 'CANDIDATE_TREE_PLACEHOLDER');
});

test('rejects a branch-local candidate SHA that is not this checkout HEAD', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  const staleSha = '0123456789abcdef0123456789abcdef01234567';
  record.branch_local.candidate_sha = staleSha;
  record.branch_local.reviewed_candidate_sha = staleSha;
  record.branch_local.tests[0].candidate_sha = staleSha;

  assert.equal(evaluateBranchLocal(record, { candidateBinding }).blocker_code, 'CANDIDATE_SHA_MISMATCH');
});

test('rejects missing candidate tree and plan bindings', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  delete record.branch_local.candidate_tree;

  assert.equal(evaluateBranchLocal(record, { candidateBinding }).blocker_code, 'CANDIDATE_TREE_REQUIRED');
});

test('rejects a missing plan binding', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  delete record.branch_local.plan_sha256;

  assert.equal(evaluateBranchLocal(record, { candidateBinding }).blocker_code, 'PLAN_SHA256_REQUIRED');
});

test('keeps fabricated owner and workflow proof blocked without injected authorization', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  record.default_branch_smoke = {
    owner_approved_merge: true,
    owner_merge_proof: 'fabricated-owner-proof',
  };

  assert.equal(
    evaluateCandidateGate(record, { candidateBinding }).blocker_code,
    'OWNER_AUTHORIZED_EXTERNAL_RUN_REQUIRED',
  );
});

test('rejects a stale default-branch workflow head even with trusted external authorization', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  record.default_branch_smoke = {
    owner_approved_merge: true,
    owner_merge_proof: 'external-owner-proof',
    approved_merge_sha: '0123456789abcdef0123456789abcdef01234567',
    approved_merge_tree: '89abcdef0123456789abcdef0123456789abcdef',
    merged_candidate_sha: candidateBinding.candidate_sha,
    merged_candidate_tree: candidateBinding.candidate_tree,
    workflow_run: {
      workflow_present_on_default_branch: true,
      default_branch: 'main',
      non_production_endpoint_available: true,
      run_id: 'external-run-id',
      run_proof: 'external-run-proof',
      head_sha: 'fedcba9876543210fedcba9876543210fedcba98',
      head_tree: '76543210fedcba9876543210fedcba9876543210',
      ingest_target: 'POST /api/internal/ingest/snapshot',
    },
  };

  assert.equal(
    evaluateCandidateGate(record, { candidateBinding, externalAuthorization: externalAuthorization(candidateBinding) }).blocker_code,
    'WORKFLOW_HEAD_SHA_MISMATCH',
  );
});

test('rejects a non-canonical ingest target even with trusted external authorization', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  const mergeSha = '0123456789abcdef0123456789abcdef01234567';
  const mergeTree = '89abcdef0123456789abcdef0123456789abcdef';
  record.default_branch_smoke = {
    owner_approved_merge: true,
    owner_merge_proof: 'external-owner-proof',
    approved_merge_sha: mergeSha,
    approved_merge_tree: mergeTree,
    merged_candidate_sha: candidateBinding.candidate_sha,
    merged_candidate_tree: candidateBinding.candidate_tree,
    workflow_run: {
      workflow_present_on_default_branch: true,
      default_branch: 'main',
      non_production_endpoint_available: true,
      run_id: 'external-run-id',
      run_proof: 'external-run-proof',
      head_sha: mergeSha,
      head_tree: mergeTree,
      ingest_target: 'POST /api/internal/ingest/other',
    },
  };

  assert.equal(
    evaluateCandidateGate(record, { candidateBinding, externalAuthorization: externalAuthorization(candidateBinding) }).blocker_code,
    'CANONICAL_INGEST_TARGET_REQUIRED',
  );
});

test('rejects a stale default branch and stale workflow tree with trusted external authorization', async () => {
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  const candidateBinding = await readLocalCandidateBinding(repositoryRoot);
  const record = bindTemplate(template, candidateBinding);
  const mergeSha = '0123456789abcdef0123456789abcdef01234567';
  const mergeTree = '89abcdef0123456789abcdef0123456789abcdef';
  record.default_branch_smoke = {
    owner_approved_merge: true,
    owner_merge_proof: 'external-owner-proof',
    approved_merge_sha: mergeSha,
    approved_merge_tree: mergeTree,
    merged_candidate_sha: candidateBinding.candidate_sha,
    merged_candidate_tree: candidateBinding.candidate_tree,
    workflow_run: {
      workflow_present_on_default_branch: true,
      default_branch: 'stale-main',
      non_production_endpoint_available: true,
      run_id: 'external-run-id',
      run_proof: 'external-run-proof',
      head_sha: mergeSha,
      head_tree: '76543210fedcba9876543210fedcba9876543210',
      ingest_target: 'POST /api/internal/ingest/snapshot',
    },
  };

  assert.equal(
    evaluateCandidateGate(record, { candidateBinding, externalAuthorization: externalAuthorization(candidateBinding) }).blocker_code,
    'WORKFLOW_DEFAULT_BRANCH_REQUIRED',
  );
  record.default_branch_smoke.workflow_run.default_branch = 'main';
  assert.equal(
    evaluateCandidateGate(record, { candidateBinding, externalAuthorization: externalAuthorization(candidateBinding) }).blocker_code,
    'WORKFLOW_HEAD_SHA_MISMATCH',
  );
});

test('returns malformed-record blocking from the real CLI', async () => {
  await assert.rejects(
    execFileAsync('node', [evaluatorPath, malformedPath], { cwd: repositoryRoot }),
    (error) => {
      assert.equal(error.code, 3);
      assert.match(error.stdout, /MALFORMED_RECORD/);
      return true;
    },
  );
});
