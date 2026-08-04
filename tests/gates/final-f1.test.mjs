import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

import { validateSemanticCloseout } from '../../docs/execution/scripts/validate_semantic_closeout.mjs';

const execFileAsync = promisify(execFile);

test('Given the integrated candidate, When authority and coherence are audited, Then one v4.1 route and receipt authority remain coherent', async () => {
  const [semantic, detailContract, receiptSchema, commandMap] = await Promise.all([
    validateSemanticCloseout(),
    readFile('docs/execution/contracts/detail-ui-state-contract.json', 'utf8'),
    readFile('docs/execution/contracts/phase-receipt.schema.json', 'utf8'),
    readFile('docs/execution/contracts/execution-command-map.json', 'utf8'),
  ]);

  assert.equal(semantic.verdict, 'PASS');
  assert.equal(JSON.parse(detailContract).canonical_route, '/places/{areaCode}');
  assert.ok(JSON.parse(receiptSchema).allOf.length >= 3);
  assert.equal(JSON.parse(commandMap).commands.filter(({ id }) => id.startsWith('final-f')).length, 4);
  await execFileAsync('node', ['--test', 'tests/gates/task-02-happy.test.mjs', 'tests/gates/task-02-failure.test.mjs', 'tests/gates/task-03-happy.test.mjs', 'tests/gates/task-03-failure.test.mjs'], { maxBuffer: 16 * 1024 * 1024 });
});
