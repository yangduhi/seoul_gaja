import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

import { validateSemanticCloseout } from '../../docs/execution/scripts/validate_semantic_closeout.mjs';

const execFileAsync = promisify(execFile);

test('Given the integrated candidate, When release scope is audited, Then local scope passes and owner-bound release proof remains blocked', async () => {
  const [semantic, blockersText, status] = await Promise.all([
    validateSemanticCloseout(),
    readFile('tests/fixtures/final/owner-blockers.json', 'utf8'),
    execFileAsync('git', ['status', '--short']),
  ]);
  const blockers = JSON.parse(blockersText);

  assert.equal(semantic.verdict, 'PASS');
  assert.equal(blockers.verdict, 'NOT_RUN_BLOCKED');
  for (const line of status.stdout.split(/\r?\n/).filter(Boolean)) {
    assert.match(line.replaceAll('\\', '/'), /(?:tests\/(?:gates\/final-f[1-4]\.test\.mjs|fixtures\/final\/)|\.omo\/evidence\/seoul-gaja-v4-plan-review\/final-F[1-4]\.json)/);
  }
  const { stdout: head } = await execFileAsync('git', ['rev-parse', 'HEAD']);
  const { stdout: tree } = await execFileAsync('git', ['rev-parse', 'HEAD^{tree}']);
  assert.match(head.trim(), /^[a-f0-9]{40}$/);
  assert.match(tree.trim(), /^[a-f0-9]{40}$/);
  await execFileAsync('git', ['diff', '--check']);
});
