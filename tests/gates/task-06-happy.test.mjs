import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateBackfillRange } from '../../scripts/validate_backfill_inputs.mjs';
import { assertWorkflowSecurityBoundary } from './task-06-contract.mjs';

test('accepts a strict ordered manual-backfill range within the policy bound', () => {
  const range = validateBackfillRange('2026-08-01', '2026-08-31');
  if (range.start_date !== '2026-08-01' || range.end_date !== '2026-08-31' || range.days !== 30) {
    throw new Error('validated range did not preserve calendar inputs');
  }
});

test('accepts the redacted authorized workflow fixture', async () => {
  const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'tests/fixtures/workflow-security/positive/valid-manual-backfill.json'), 'utf8'));
  assert.equal(fixture.expected_result, 'ACCEPTED');
  assert.equal(fixture.secret_status, 'REDACTED');
});

test('binds reviewer identity, protected branch ref, and redacted token rotation lifecycle', async () => {
  const policy = JSON.parse(await readFile(resolve(process.cwd(), 'docs/execution/contracts/workflow-security-policy.json'), 'utf8'));
  const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'tests/fixtures/workflow-security/positive/rotation-cutover.json'), 'utf8'));

  assert.deepEqual(policy.github_environment.required_reviewer_logins, ['yangduhi']);
  assert.equal(policy.github_environment.protected_branch_ref, 'refs/heads/main');
  assert.deepEqual(policy.rotation.required_steps, ['install_next', 'verify_next', 'cut_over', 'revoke_prior']);
  assert.equal(fixture.secret_status, 'REDACTED');
  assert.doesNotMatch(JSON.stringify(fixture), /(?:Bearer\s+[^\s]+|SITE_INGEST_TOKEN\s*=|sk-[a-z0-9_-]{8,})/i);
  assert.equal(fixture.overlap_minutes, policy.rotation.maximum_overlap_minutes);
});

test('enforces the workflow, supply-chain, token, rotation, and replay policy', async () => {
  await assertWorkflowSecurityBoundary();
});
