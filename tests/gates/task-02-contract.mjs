import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const staleRules = [
  ['canonical-ingest-route', /\/api\/internal\/ingest(?!\/snapshot\b)/],
  ['phase-receipt-path', /docs\/evidence\/phase-\d{2}\/(?:receipt|release-receipt)\.json/],
  ['design-token-path', /design\/tokens\.json/],
  ['legacy-transcript-path', /transcript\//],
  ['legacy-shared-chat-path', /source\/shared-chat\.html/],
];

function lineFor(content, match) {
  return content.slice(0, match.index).split('\n').length;
}

export function assertTerminologyContract(filePath, content) {
  for (const [rule, expression] of staleRules) {
    const match = expression.exec(content);
    assert.equal(
      match,
      null,
      `${relative(repositoryRoot, filePath)}:${match ? lineFor(content, match) : 0}: ${rule}`,
    );
  }

}

export async function assertRepositoryTerminologyContract() {
  const activePaths = [
    join(repositoryRoot, 'docs', 'execution', 'AMENDMENT-v4.1.md'),
    join(repositoryRoot, 'docs', 'reference', 'FINAL_IMPLEMENTATION_PLAN.md'),
  ];
  const source = new Map(await Promise.all(activePaths.map(async (filePath) => [filePath, await readFile(filePath, 'utf8')])));

  for (const [filePath, content] of source) {
    assertTerminologyContract(filePath, content);
  }

  const amendment = source.get(activePaths[0]);
  const replacement = source.get(activePaths[1]);

  assert.match(amendment, /POST \/api\/internal\/ingest\/snapshot/);
  assert.match(amendment, /docs\/evidence\/phase-XX\/phase-receipt\.json/);
  assert.match(replacement, /POST \/api\/internal\/ingest\/snapshot/);
  assert.match(replacement, /phase-00-capability-probe/);
  assert.match(replacement, /POST \/api\/internal\/capability-probe\/ingest/);
  assert.match(replacement, /cannot prove Phase 02 production behavior/);
  assert.match(replacement, /docs\/evidence\/phase-08\/phase-receipt\.json/);
  assert.match(replacement, /nested `release` object/);
  assert.match(replacement, /sourceUpdatedAt/);
  assert.match(replacement, /fetchedAt/);
  assert.match(replacement, /source_updated_at/);
  assert.match(replacement, /fetched_at/);
  assert.match(replacement, /design\/design-tokens\.json/);
}
