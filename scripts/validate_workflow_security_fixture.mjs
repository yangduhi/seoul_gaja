import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { validateBackfillRange } from './validate_backfill_inputs.mjs';

const accepted = (code) => Object.freeze({ verdict: 'ACCEPTED', code });
const rejected = (code) => Object.freeze({ verdict: 'REJECTED', code });

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasRawTokenField(fixture) {
  return ['token', 'token_value', 'raw_token'].some((field) => Object.hasOwn(fixture, field));
}

function evaluateRotationLifecycle(fixture, policy) {
  const requiredSteps = policy.rotation?.required_steps;
  const configuredOverlap = policy.rotation?.maximum_overlap_minutes;
  if (!Array.isArray(requiredSteps) || !Number.isInteger(configuredOverlap)) {
    return rejected('INVALID_POLICY');
  }

  const stepsMatch = Array.isArray(fixture.rotation_steps)
    && fixture.rotation_steps.length === requiredSteps.length
    && fixture.rotation_steps.every((step, index) => step === requiredSteps[index]);
  const metadataPresent = ['token_id', 'prior_token_id', 'issued_at', 'cut_over_at', 'revoked_at']
    .every((field) => isString(fixture[field]));
  const overlapIsBounded = Number.isInteger(fixture.overlap_minutes)
    && fixture.overlap_minutes >= 0
    && fixture.overlap_minutes <= configuredOverlap;

  return stepsMatch && metadataPresent && overlapIsBounded
    ? accepted('ROTATION_LIFECYCLE_ACCEPTED')
    : rejected('ROTATION_LIFECYCLE_INVALID');
}

function evaluateAuthorizedRequest(fixture, policy) {
  const tokenBoundary = policy.ingest?.token_boundary;
  const allowedRoute = policy.ingest?.allowed_route;
  const scopes = policy.ingest?.scopes;
  const maintainers = policy.maintainer_allowlist;
  const environment = policy.github_environment;
  if (
    !isRecord(tokenBoundary)
    || !isRecord(allowedRoute)
    || !Array.isArray(scopes)
    || !Array.isArray(maintainers)
    || !isRecord(environment)
    || environment.protected_branch_ref !== tokenBoundary.allowed_branch_ref
    || environment.name !== tokenBoundary.allowed_environment
  ) {
    return rejected('INVALID_POLICY');
  }
  if (fixture.branch_ref !== tokenBoundary.allowed_branch_ref) {
    return rejected('BRANCH_NOT_PROTECTED');
  }
  if (fixture.environment !== tokenBoundary.allowed_environment) {
    return rejected('ENVIRONMENT_NOT_ALLOWED');
  }
  if (!maintainers.includes(fixture.dispatcher)) {
    return rejected('DISPATCHER_NOT_ALLOWED');
  }
  if (tokenBoundary.rejected_states.includes(fixture.token_state) || fixture.token_state !== 'current') {
    return rejected('TOKEN_STATE_REJECTED');
  }
  if (fixture.method !== allowedRoute.method || fixture.path !== allowedRoute.path) {
    return rejected('INGEST_ROUTE_NOT_ALLOWED');
  }
  if (!Array.isArray(fixture.scopes) || fixture.scopes.length !== 1 || fixture.scopes[0] !== scopes[0]) {
    return rejected('INGEST_SCOPE_NOT_ALLOWED');
  }
  try {
    validateBackfillRange(fixture.start_date, fixture.end_date);
  } catch {
    return rejected('INVALID_BACKFILL_RANGE');
  }
  return accepted('AUTHORIZED_MANUAL_BACKFILL');
}

export function evaluateWorkflowSecurityFixture(fixture, policy) {
  if (!isRecord(fixture) || !isRecord(policy) || hasRawTokenField(fixture)) {
    return rejected('MALFORMED_INPUT');
  }

  switch (fixture.kind) {
    case 'authorized_manual_backfill':
      return evaluateAuthorizedRequest(fixture, policy);
    case 'rotation_lifecycle':
      return evaluateRotationLifecycle(fixture, policy);
    case 'invalid_date_range':
    case 'injection_attempt':
      try {
        validateBackfillRange(fixture.start_date ?? fixture.input, fixture.end_date ?? '2026-08-31');
      } catch {
        return rejected('INVALID_BACKFILL_RANGE');
      }
      return rejected('MALFORMED_INPUT');
    case 'malformed_json':
      try {
        JSON.parse(fixture.raw_payload);
      } catch {
        return rejected('MALFORMED_INPUT');
      }
      return rejected('MALFORMED_INPUT');
    case 'missing_token':
    case 'old_token':
    case 'expired_token':
      return policy.ingest?.token_boundary?.rejected_states?.includes(fixture.token_state)
        ? rejected('TOKEN_STATE_REJECTED')
        : rejected('INVALID_POLICY');
    case 'unauthorized_branch':
      return fixture.branch_ref === policy.ingest?.token_boundary?.allowed_branch_ref
        ? rejected('MALFORMED_INPUT')
        : rejected('BRANCH_NOT_PROTECTED');
    case 'unauthorized_environment':
      return fixture.environment === policy.ingest?.token_boundary?.allowed_environment
        ? rejected('MALFORMED_INPUT')
        : rejected('ENVIRONMENT_NOT_ALLOWED');
    case 'unauthorized_dispatcher':
      return policy.maintainer_allowlist?.includes(fixture.dispatcher)
        ? rejected('MALFORMED_INPUT')
        : rejected('DISPATCHER_NOT_ALLOWED');
    case 'replay':
      return fixture.idempotent_match === true
        ? accepted('IDEMPOTENT_RECEIPT')
        : rejected('REPLAY_NOT_IDEMPOTENT');
    case 'payload_conflict':
      return fixture.existing_payload_sha256 === fixture.payload_sha256
        ? accepted('IDEMPOTENT_RECEIPT')
        : rejected('PAYLOAD_CONFLICT');
    default:
      return rejected('MALFORMED_INPUT');
  }
}

async function main() {
  const fixturePath = process.argv[2];
  if (process.argv.length !== 3 || !isString(fixturePath)) {
    throw new Error('usage: validate_workflow_security_fixture.mjs <fixture-path>');
  }
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const [policyText, fixtureText] = await Promise.all([
    readFile(resolve(root, 'docs/execution/contracts/workflow-security-policy.json'), 'utf8'),
    readFile(resolve(process.cwd(), fixturePath), 'utf8'),
  ]);
  const result = evaluateWorkflowSecurityFixture(JSON.parse(fixtureText), JSON.parse(policyText));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.verdict === 'ACCEPTED' ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'workflow security fixture validation failed'}\n`);
    process.exitCode = 1;
  });
}
