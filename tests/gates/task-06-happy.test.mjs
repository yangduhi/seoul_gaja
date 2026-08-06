import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateBackfillRange } from '../../scripts/validate_backfill_inputs.mjs';
import { evaluateWorkflowSecurityFixture } from '../../scripts/validate_workflow_security_fixture.mjs';
import { assertWorkflowSecurityBoundary } from './task-06-contract.mjs';

const policyPath = resolve(process.cwd(), 'docs/execution/contracts/workflow-security-policy.json');
const fixtureEvaluatorPath = resolve(process.cwd(), 'scripts/validate_workflow_security_fixture.mjs');

test('accepts a strict ordered manual-backfill range within the policy bound', () => {
  const range = validateBackfillRange('2026-08-01', '2026-08-31');
  if (range.start_date !== '2026-08-01' || range.end_date !== '2026-08-31' || range.days !== 30) {
    throw new Error('validated range did not preserve calendar inputs');
  }
});

test('accepts the redacted authorized workflow fixture', async () => {
  const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'tests/fixtures/workflow-security/positive/valid-manual-backfill.json'), 'utf8'));
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  assert.deepEqual(evaluateWorkflowSecurityFixture(fixture, policy), {
    verdict: 'ACCEPTED',
    code: 'AUTHORIZED_MANUAL_BACKFILL',
  });
  assert.equal(fixture.secret_status, 'REDACTED');
});

test('CLI exits zero only for accepted redacted fixtures', () => {
  for (const fixture of [
    'tests/fixtures/workflow-security/positive/valid-manual-backfill.json',
    'tests/fixtures/workflow-security/positive/rotation-cutover.json',
  ]) {
    const result = spawnSync(process.execPath, [fixtureEvaluatorPath, fixture], { encoding: 'utf8' });
    assert.equal(result.status, 0, `accepted fixture CLI exit: ${fixture}`);
    assert.match(result.stdout, /"verdict":"ACCEPTED"/);
  }
});

test('rejects an authorized fixture when its canonical ingest method or path changes', async () => {
  const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'tests/fixtures/workflow-security/positive/valid-manual-backfill.json'), 'utf8'));
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  assert.deepEqual(evaluateWorkflowSecurityFixture({ ...fixture, method: 'GET' }, policy), {
    verdict: 'REJECTED',
    code: 'INGEST_ROUTE_NOT_ALLOWED',
  });
  assert.deepEqual(evaluateWorkflowSecurityFixture({ ...fixture, path: '/api/internal/ingest/other' }, policy), {
    verdict: 'REJECTED',
    code: 'INGEST_ROUTE_NOT_ALLOWED',
  });
});

test('rejects an authorized fixture when its ingest scope changes', async () => {
  const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'tests/fixtures/workflow-security/positive/valid-manual-backfill.json'), 'utf8'));
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  assert.deepEqual(evaluateWorkflowSecurityFixture({ ...fixture, scopes: ['public:read'] }, policy), {
    verdict: 'REJECTED',
    code: 'INGEST_SCOPE_NOT_ALLOWED',
  });
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
  assert.deepEqual(evaluateWorkflowSecurityFixture(fixture, policy), {
    verdict: 'ACCEPTED',
    code: 'ROTATION_LIFECYCLE_ACCEPTED',
  });
});

test('enforces the workflow, supply-chain, token, rotation, and replay policy', async () => {
  await assertWorkflowSecurityBoundary();
});
