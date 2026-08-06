import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const CANONICAL_INGEST_TARGET = 'POST /api/internal/ingest/snapshot';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function isSha(value) {
  return typeof value === 'string' && SHA.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function hasProof(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function blocked(candidateSha, code) {
  return {
    verdict: 'NOT_RUN_BLOCKED',
    candidate_sha: candidateSha,
    blocker_code: code,
  };
}

function branchLocalResult(branchLocal) {
  if (!branchLocal || !isSha(branchLocal.candidate_sha)) {
    return blocked(null, 'CANDIDATE_SHA_REQUIRED');
  }

  if (!isSha(branchLocal.candidate_tree)) {
    return blocked(branchLocal.candidate_sha, 'CANDIDATE_TREE_REQUIRED');
  }

  if (!isSha256(branchLocal.plan_sha256)) {
    return blocked(branchLocal.candidate_sha, 'PLAN_SHA256_REQUIRED');
  }

  if (branchLocal.reviewed_candidate_sha !== branchLocal.candidate_sha) {
    return blocked(branchLocal.candidate_sha, 'REVIEWED_CANDIDATE_SHA_MISMATCH');
  }

  if (branchLocal.reviewed_candidate_tree !== branchLocal.candidate_tree) {
    return blocked(branchLocal.candidate_sha, 'REVIEWED_CANDIDATE_TREE_MISMATCH');
  }

  if (branchLocal.reviewed_plan_sha256 !== branchLocal.plan_sha256) {
    return blocked(branchLocal.candidate_sha, 'REVIEWED_PLAN_SHA256_MISMATCH');
  }

  if (!Array.isArray(branchLocal.tests) || branchLocal.tests.length === 0) {
    return blocked(branchLocal.candidate_sha, 'BRANCH_LOCAL_TESTS_REQUIRED');
  }

  if (!branchLocal.tests.every((test) => test?.exit_code === 0)) {
    return {
      verdict: 'FAIL',
      candidate_sha: branchLocal.candidate_sha,
      blocker_code: 'BRANCH_LOCAL_TEST_FAILURE',
    };
  }

  if (!branchLocal.tests.every((test) => (
    test?.candidate_sha === branchLocal.candidate_sha
    && test.candidate_tree === branchLocal.candidate_tree
    && test.plan_sha256 === branchLocal.plan_sha256
  ))) {
    return blocked(branchLocal.candidate_sha, 'BRANCH_LOCAL_TEST_BINDING_MISMATCH');
  }

  return null;
}

export function evaluateCandidateGate(record) {
  const branchLocal = record?.branch_local;
  const branchResult = branchLocalResult(branchLocal);
  if (branchResult) return branchResult;

  const candidateSha = branchLocal.candidate_sha;
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
    || smoke.merged_candidate_tree !== branchLocal.candidate_tree
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
    || receipt.candidate_tree !== branchLocal.candidate_tree
    || receipt.plan_sha256 !== branchLocal.plan_sha256
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
    candidate_tree: branchLocal.candidate_tree,
    plan_sha256: branchLocal.plan_sha256,
    approved_merge_sha: smoke.approved_merge_sha,
    approved_merge_tree: smoke.approved_merge_tree,
    workflow_head_sha: workflowRun.head_sha,
    workflow_head_tree: workflowRun.head_tree,
  };
}

async function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) throw new Error('fixture path is required');

  try {
    const record = JSON.parse(await readFile(fixturePath, 'utf8'));
    const result = evaluateCandidateGate(record);
    console.log(JSON.stringify(result));
    process.exitCode = result.verdict === 'PASS' ? 0 : result.verdict === 'FAIL' ? 1 : 3;
  } catch {
    console.log(JSON.stringify(blocked(null, 'MALFORMED_RECORD')));
    process.exitCode = 3;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
