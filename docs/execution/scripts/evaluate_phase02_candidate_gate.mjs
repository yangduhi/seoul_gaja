import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const CANONICAL_INGEST_TARGET = 'POST /api/internal/ingest/snapshot';

const SHA = /^[a-f0-9]{40}$/;

function isSha(value) {
  return typeof value === 'string' && SHA.test(value);
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

  if (branchLocal.reviewed_candidate_sha !== branchLocal.candidate_sha) {
    return blocked(branchLocal.candidate_sha, 'REVIEWED_CANDIDATE_SHA_MISMATCH');
  }

  if (!Array.isArray(branchLocal.tests) || branchLocal.tests.length === 0) {
    return blocked(branchLocal.candidate_sha, 'BRANCH_LOCAL_TESTS_REQUIRED');
  }

  if (!branchLocal.tests.every((test) => test && test.exit_code === 0)) {
    return {
      verdict: 'FAIL',
      candidate_sha: branchLocal.candidate_sha,
      blocker_code: 'BRANCH_LOCAL_TEST_FAILURE',
    };
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

  if (!isSha(smoke.approved_merge_sha) || smoke.merged_candidate_sha !== candidateSha) {
    return blocked(candidateSha, 'APPROVED_MERGE_CANDIDATE_MISMATCH');
  }

  const workflowRun = smoke.workflow_run;
  if (!workflowRun?.workflow_present_on_default_branch) {
    return blocked(candidateSha, 'WORKFLOW_NOT_ON_DEFAULT_BRANCH');
  }

  if (!workflowRun.non_production_endpoint_available) {
    return blocked(candidateSha, 'NON_PRODUCTION_ENDPOINT_REQUIRED');
  }

  if (workflowRun.head_sha !== smoke.approved_merge_sha) {
    return blocked(candidateSha, 'WORKFLOW_HEAD_SHA_MISMATCH');
  }

  if (workflowRun.ingest_target !== CANONICAL_INGEST_TARGET) {
    return blocked(candidateSha, 'CANONICAL_INGEST_TARGET_REQUIRED');
  }

  const receipt = smoke.receipt;
  if (!receipt || receipt.candidate_sha !== candidateSha) {
    return blocked(candidateSha, 'RECEIPT_CANDIDATE_MISMATCH');
  }

  if (receipt.approved_merge_sha !== smoke.approved_merge_sha) {
    return blocked(candidateSha, 'RECEIPT_APPROVED_MERGE_MISMATCH');
  }

  if (receipt.workflow_head_sha !== workflowRun.head_sha) {
    return blocked(candidateSha, 'RECEIPT_WORKFLOW_HEAD_SHA_MISMATCH');
  }

  return {
    verdict: 'PASS',
    candidate_sha: candidateSha,
    approved_merge_sha: smoke.approved_merge_sha,
    workflow_head_sha: workflowRun.head_sha,
  };
}

async function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) throw new Error('fixture path is required');

  const record = JSON.parse(await readFile(fixturePath, 'utf8'));
  const result = evaluateCandidateGate(record);
  console.log(JSON.stringify(result));
  process.exitCode = result.verdict === 'PASS' ? 0 : result.verdict === 'FAIL' ? 1 : 3;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
