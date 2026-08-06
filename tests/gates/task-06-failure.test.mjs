import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateBackfillRange } from '../../scripts/validate_backfill_inputs.mjs';
import { evaluateWorkflowSecurityFixture } from '../../scripts/validate_workflow_security_fixture.mjs';

const negativeRoot = resolve(process.cwd(), 'tests/fixtures/workflow-security/negative');
const policyPath = resolve(process.cwd(), 'docs/execution/contracts/workflow-security-policy.json');
const expectedCodes = Object.freeze({
  'expired-token.json': 'TOKEN_STATE_REJECTED',
  'invalid-date.json': 'INVALID_BACKFILL_RANGE',
  'malformed-input.json': 'MALFORMED_INPUT',
  'missing-token.json': 'TOKEN_STATE_REJECTED',
  'old-token.json': 'TOKEN_STATE_REJECTED',
  'oversized-range.json': 'INVALID_BACKFILL_RANGE',
  'payload-conflict.json': 'PAYLOAD_CONFLICT',
  'replay.json': 'REPLAY_NOT_IDEMPOTENT',
  'shell-metacharacters.json': 'INVALID_BACKFILL_RANGE',
  'unauthorized-branch.json': 'BRANCH_NOT_PROTECTED',
  'unauthorized-dispatcher.json': 'DISPATCHER_NOT_ALLOWED',
  'unauthorized-environment.json': 'ENVIRONMENT_NOT_ALLOWED',
});

for (const name of readdirSync(negativeRoot)) {
  test(`rejects ${name} through the local security-policy evaluator without exposing a token value`, () => {
    const fixture = JSON.parse(readFileSync(resolve(negativeRoot, name), 'utf8'));
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    assert.equal(fixture.secret_status, 'REDACTED');
    assert.doesNotMatch(JSON.stringify(fixture), /(?:Bearer\s+[^\s]+|SITE_INGEST_TOKEN\s*=|sk-[a-z0-9_-]{8,})/i);
    const evaluation = evaluateWorkflowSecurityFixture(fixture, policy);
    assert.deepEqual(evaluation, { verdict: 'REJECTED', code: expectedCodes[name] });
    if (fixture.kind === 'invalid_date_range') {
      assert.throws(() => validateBackfillRange(fixture.start_date, fixture.end_date));
    }
    if (fixture.kind === 'injection_attempt') {
      assert.throws(() => validateBackfillRange(fixture.input, '2026-08-31'));
    }
    if (fixture.kind === 'malformed_json') {
      assert.throws(() => JSON.parse(fixture.raw_payload));
    }
  });
}
