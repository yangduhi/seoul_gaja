import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

import { assertSemanticCloseout } from './task-12-contract.mjs';

const execFileAsync = promisify(execFile);

test('Given the v4.1 candidate, When semantic closeout runs, Then authority, packet, receipts, workflow, and scope remain coherent', async () => {
  await assertSemanticCloseout();
  const { stdout } = await execFileAsync('node', ['docs/execution/scripts/validate_semantic_closeout.mjs']);
  const result = JSON.parse(stdout);

  assert.equal(result.verdict, 'PASS');
  assert.equal(result.packet.structural_scope, 'AUDIT_ONLY');
  assert.equal(result.owner_blockers.length, 7);
});
