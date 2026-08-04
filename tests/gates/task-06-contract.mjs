import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const workflowPaths = [
  resolve(root, '.github/workflows/collect-seoul-crowd-live.yml'),
  resolve(root, '.github/workflows/manual-backfill.yml'),
];

const fullCommitSha = /^[0-9a-f]{40}$/;

export async function assertWorkflowSecurityBoundary() {
  const policy = JSON.parse(await readFile(resolve(root, 'docs/execution/contracts/workflow-security-policy.json'), 'utf8'));
  assert.deepEqual(policy.ingest.allowed_route, { method: 'POST', path: '/api/internal/ingest/snapshot' });
  assert.deepEqual(policy.ingest.scopes, ['ingest:snapshot']);
  assert.equal(policy.ingest.secret_locations.sites_hosted_secret_store, true);
  assert.equal(policy.ingest.secret_locations.github_environment, 'production-ingest');
  assert.deepEqual(policy.github_environment.protected_branches, ['main']);
  assert.equal(policy.github_environment.required_reviewers, true);
  assert.deepEqual(policy.maintainer_allowlist, ['yangduhi']);
  assert.equal(policy.rotation.maximum_overlap_minutes, 30);
  assert.deepEqual(policy.receipts.permitted_token_fields, ['token_id', 'issued_at', 'revoked_at']);
  assert.equal(policy.replay.duplicate_request, 'idempotent_receipt');
  assert.equal(policy.replay.payload_conflict, 'reject_409');

  const workflows = await Promise.all(workflowPaths.map(async (filePath) => readFile(filePath, 'utf8')));
  for (const workflow of workflows) {
    assert.match(workflow, /^permissions:\r?\n  contents: read$/m);
    assert.match(workflow, /python-version: "3\.11\.11"/);
    assert.match(workflow, /pip install --require-hashes --only-binary=:all: -r collector\/requirements\.lock/);
    assert.doesNotMatch(workflow, /\b(?:contents|actions|id-token|packages|pull-requests):\s*write\b/);
    for (const match of workflow.matchAll(/^\s*- uses: [^@\s]+@([^\s]+)$/gm)) {
      assert.match(match[1], fullCommitSha, `un-pinned action: ${match[0]}`);
    }
  }

  const manualBackfill = workflows[1];
  assert.match(manualBackfill, /BACKFILL_START_DATE: \$\{\{ inputs\.start_date \}\}/);
  assert.match(manualBackfill, /node scripts\/validate_backfill_inputs\.mjs --github-output "\$GITHUB_OUTPUT"/);
  const secretJob = manualBackfill.slice(manualBackfill.indexOf('  ingest:'));
  assert.match(secretJob, /environment: production-ingest/);
  assert.match(secretJob, /SITE_INGEST_TOKEN: \$\{\{ secrets\.SITE_INGEST_TOKEN \}\}/);
  assert.match(secretJob, /SITE_INGEST_PATH: \/api\/internal\/ingest\/snapshot/);
  assert.doesNotMatch(secretJob, /\$\{\{\s*(?:inputs|github\.event\.inputs)\./);
  assert.match(secretJob, /--start "\$BACKFILL_START_DATE"/);
  assert.match(secretJob, /--end "\$BACKFILL_END_DATE"/);
  assert.match(secretJob, /--path "\$SITE_INGEST_PATH"/);
}
