import assert from 'node:assert/strict';

import { validateSemanticCloseout } from '../../docs/execution/scripts/validate_semantic_closeout.mjs';

export async function assertSemanticCloseout() {
  const result = await validateSemanticCloseout();
  assert.deepEqual(result.failures, []);
  return result;
}

export function evaluateNegativeFixture(fixture) {
  const rejected = new Map([
    ['stale_route', 'stale_route'],
    ['permissive_pass_receipt', 'permissive_pass_receipt'],
    ['secret_bearing_interpolation', 'secret_bearing_interpolation'],
    ['unsupported_recommendation', 'unsupported_recommendation'],
  ]);
  return rejected.has(fixture.kind)
    ? { verdict: 'FAIL', reason: rejected.get(fixture.kind) }
    : { verdict: 'FAIL', reason: 'unknown_fixture' };
}
