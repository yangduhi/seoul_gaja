import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

export const CANONICAL_INGEST_TARGET = 'POST /api/internal/ingest/snapshot';

const execFileAsync = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REPEATED_HEX = /^([a-f0-9])\1+$/;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const approvedPlanPath = '.omo/plans/seoul-gaja-v4-plan-review.md';
const requiredOwnerAction = 'Approve the exact candidate merge to main and provide the resulting default-branch workflow run and receipt bound to that merge.';

function isSha(value) {
  return typeof value === 'string' && SHA.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function isPlaceholder(value) {
  return typeof value === 'string' && REPEATED_HEX.test(value);
}

function hasProof(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function blocked(candidateSha, code, ownerAction) {
  return {
    verdict: 'NOT_RUN_BLOCKED',
    candidate_sha: candidateSha,
    blocker_code: code,
    ...(ownerAction ? { owner_action: ownerAction } : {}),
  };
}

function candidateValueResult(value, expectedValue, requiredCode, placeholderCode, mismatchCode, candidateSha) {
  if (expectedValue === undefined) {
    return blocked(candidateSha, 'LOCAL_CANDIDATE_BINDING_REQUIRED');
  }

  if (!value) {
    return blocked(candidateSha, requiredCode);
  }

  if (isPlaceholder(value)) {
    return blocked(candidateSha, placeholderCode);
  }

  if (value !== expectedValue) {
    return blocked(candidateSha, mismatchCode);
  }

  return null;
}

export function evaluateBranchLocal(record, { candidateBinding } = {}) {
  const branchLocal = record?.branch_local;
  if (!branchLocal || !isSha(branchLocal.candidate_sha)) {
    return blocked(null, 'CANDIDATE_SHA_REQUIRED');
  }

  const candidateSha = branchLocal.candidate_sha;
  const candidateShaResult = candidateValueResult(
    candidateSha,
    candidateBinding?.candidate_sha,
    'CANDIDATE_SHA_REQUIRED',
    'CANDIDATE_SHA_PLACEHOLDER',
    'CANDIDATE_SHA_MISMATCH',
    candidateSha,
  );
  if (candidateShaResult) return candidateShaResult;

  if (!isSha(branchLocal.candidate_tree)) {
    return blocked(candidateSha, 'CANDIDATE_TREE_REQUIRED');
  }

  const candidateTreeResult = candidateValueResult(
    branchLocal.candidate_tree,
    candidateBinding?.candidate_tree,
    'CANDIDATE_TREE_REQUIRED',
    'CANDIDATE_TREE_PLACEHOLDER',
    'CANDIDATE_TREE_MISMATCH',
    candidateSha,
  );
  if (candidateTreeResult) return candidateTreeResult;

  if (!isSha256(branchLocal.plan_sha256)) {
    return blocked(candidateSha, 'PLAN_SHA256_REQUIRED');
  }

  const planShaResult = candidateValueResult(
    branchLocal.plan_sha256,
    candidateBinding?.plan_sha256,
    'PLAN_SHA256_REQUIRED',
    'PLAN_SHA256_PLACEHOLDER',
    'PLAN_SHA256_MISMATCH',
    candidateSha,
  );
  if (planShaResult) return planShaResult;

  if (branchLocal.reviewed_candidate_sha !== candidateSha) {
    return blocked(candidateSha, 'REVIEWED_CANDIDATE_SHA_MISMATCH');
  }

  if (branchLocal.reviewed_candidate_tree !== branchLocal.candidate_tree) {
    return blocked(candidateSha, 'REVIEWED_CANDIDATE_TREE_MISMATCH');
  }

  if (branchLocal.reviewed_plan_sha256 !== branchLocal.plan_sha256) {
    return blocked(candidateSha, 'REVIEWED_PLAN_SHA256_MISMATCH');
  }

  if (!Array.isArray(branchLocal.tests) || branchLocal.tests.length === 0) {
    return blocked(candidateSha, 'BRANCH_LOCAL_TESTS_REQUIRED');
  }

  if (!branchLocal.tests.every((test) => test?.exit_code === 0)) {
    return {
      verdict: 'FAIL',
      candidate_sha: candidateSha,
      blocker_code: 'BRANCH_LOCAL_TEST_FAILURE',
    };
  }

  if (!branchLocal.tests.every((test) => (
    test?.candidate_sha === candidateSha
    && test.candidate_tree === branchLocal.candidate_tree
    && test.plan_sha256 === branchLocal.plan_sha256
  ))) {
    return blocked(candidateSha, 'BRANCH_LOCAL_TEST_BINDING_MISMATCH');
  }

  return {
    verdict: 'PASS',
    candidate_sha: candidateSha,
    candidate_tree: branchLocal.candidate_tree,
    plan_sha256: branchLocal.plan_sha256,
  };
}

function hasTrustedExternalAuthorization(authorization, candidateBinding) {
  return authorization?.kind === 'OWNER_AUTHORIZED_EXTERNAL_RUN'
    && authorization.candidate_sha === candidateBinding.candidate_sha
    && authorization.candidate_tree === candidateBinding.candidate_tree
    && authorization.plan_sha256 === candidateBinding.plan_sha256;
}

export function evaluateCandidateGate(record, { candidateBinding, externalAuthorization } = {}) {
  const branchResult = evaluateBranchLocal(record, { candidateBinding });
  if (branchResult.verdict !== 'PASS') return branchResult;

  const candidateSha = branchResult.candidate_sha;
  if (!externalAuthorization) {
    return blocked(candidateSha, 'OWNER_AUTHORIZED_EXTERNAL_RUN_REQUIRED', requiredOwnerAction);
  }

  if (!hasTrustedExternalAuthorization(externalAuthorization, candidateBinding)) {
    return blocked(candidateSha, 'EXTERNAL_AUTHORIZATION_CANDIDATE_MISMATCH', requiredOwnerAction);
  }

  const smoke = record.default_branch_smoke;
  if (!smoke?.owner_approved_merge) {
    return blocked(candidateSha, 'OWNER_APPROVED_MERGE_REQUIRED');
  }

  if (!hasProof(smoke.owner_merge_proof)) {
    return blocked(candidateSha, 'OWNER_MERGE_PROOF_REQUIRED');
  }

  if (
    !isSha(smoke.approved_merge_sha)
    || !isSha(smoke.approved_merge_tree)
    || smoke.merged_candidate_sha !== candidateSha
    || smoke.merged_candidate_tree !== branchResult.candidate_tree
  ) {
    return blocked(candidateSha, 'APPROVED_MERGE_CANDIDATE_MISMATCH');
  }

  const workflowRun = smoke.workflow_run;
  if (!workflowRun?.workflow_present_on_default_branch) {
    return blocked(candidateSha, 'WORKFLOW_NOT_ON_DEFAULT_BRANCH');
  }

  if (workflowRun.default_branch !== 'main') {
    return blocked(candidateSha, 'WORKFLOW_DEFAULT_BRANCH_REQUIRED');
  }

  if (!workflowRun.non_production_endpoint_available) {
    return blocked(candidateSha, 'NON_PRODUCTION_ENDPOINT_REQUIRED');
  }

  if (!hasProof(workflowRun.run_id) || !hasProof(workflowRun.run_proof)) {
    return blocked(candidateSha, 'WORKFLOW_RUN_PROOF_REQUIRED');
  }

  if (
    workflowRun.head_sha !== smoke.approved_merge_sha
    || workflowRun.head_tree !== smoke.approved_merge_tree
  ) {
    return blocked(candidateSha, 'WORKFLOW_HEAD_SHA_MISMATCH');
  }

  if (workflowRun.ingest_target !== CANONICAL_INGEST_TARGET) {
    return blocked(candidateSha, 'CANONICAL_INGEST_TARGET_REQUIRED');
  }

  const receipt = smoke.receipt;
  if (
    !receipt
    || receipt.candidate_sha !== candidateSha
    || receipt.candidate_tree !== branchResult.candidate_tree
    || receipt.plan_sha256 !== branchResult.plan_sha256
  ) {
    return blocked(candidateSha, 'RECEIPT_CANDIDATE_MISMATCH');
  }

  if (
    receipt.approved_merge_sha !== smoke.approved_merge_sha
    || receipt.approved_merge_tree !== smoke.approved_merge_tree
  ) {
    return blocked(candidateSha, 'RECEIPT_APPROVED_MERGE_MISMATCH');
  }

  if (
    receipt.workflow_head_sha !== workflowRun.head_sha
    || receipt.workflow_head_tree !== workflowRun.head_tree
    || receipt.workflow_run_id !== workflowRun.run_id
  ) {
    return blocked(candidateSha, 'RECEIPT_WORKFLOW_HEAD_SHA_MISMATCH');
  }

  return {
    verdict: 'PASS',
    candidate_sha: candidateSha,
    candidate_tree: branchResult.candidate_tree,
    plan_sha256: branchResult.plan_sha256,
    approved_merge_sha: smoke.approved_merge_sha,
    approved_merge_tree: smoke.approved_merge_tree,
    workflow_head_sha: workflowRun.head_sha,
    workflow_head_tree: workflowRun.head_tree,
  };
}

export async function readLocalCandidateBinding(root = repositoryRoot) {
  const [head, tree, plan] = await Promise.all([
    execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD']),
    execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD^{tree}']),
    execFileAsync('git', ['-C', root, 'show', `HEAD:${approvedPlanPath}`], { encoding: 'buffer' }),
  ]);

  return {
    candidate_sha: head.stdout.trim(),
    candidate_tree: tree.stdout.trim(),
    plan_sha256: createHash('sha256').update(plan.stdout).digest('hex'),
  };
}

function writeResult(result) {
  console.log(JSON.stringify(result));
  process.exitCode = result.verdict === 'PASS' ? 0 : result.verdict === 'FAIL' ? 1 : 3;
}

async function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) throw new Error('fixture path is required');

  let record;
  try {
    record = JSON.parse(await readFile(fixturePath, 'utf8'));
  } catch {
    writeResult(blocked(null, 'MALFORMED_RECORD'));
    return;
  }

  try {
    const candidateBinding = await readLocalCandidateBinding();
    writeResult(evaluateCandidateGate(record, { candidateBinding }));
  } catch {
    writeResult(blocked(null, 'LOCAL_CANDIDATE_BINDING_REQUIRED'));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
