import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

async function markdownAndYamlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return markdownAndYamlFiles(entryPath);
    }
    return /\.(?:md|ya?ml)$/u.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
}

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

  if (filePath.endsWith('FINAL_IMPLEMENTATION_PLAN.md')) {
    for (const [rule, expression] of [
      ['ui-api-source-updated-at', /source_updated_at/],
      ['ui-api-fetched-at', /fetched_at/],
    ]) {
      const match = expression.exec(content);
      assert.equal(
        match,
        null,
        `${relative(repositoryRoot, filePath)}:${match ? lineFor(content, match) : 0}: ${rule}`,
      );
    }
  }
}

export async function assertRepositoryTerminologyContract() {
  const documentsRoot = join(repositoryRoot, 'docs');
  const files = await markdownAndYamlFiles(documentsRoot);
  const source = new Map(await Promise.all(files.map(async (filePath) => [filePath, await readFile(filePath, 'utf8')])));

  for (const [filePath, content] of source) {
    assertTerminologyContract(filePath, content);
  }

  const architecture = source.get(join(documentsRoot, 'codex-pack-v4', '00_overview', '02_architecture.md'));
  const phaseZero = source.get(join(documentsRoot, 'codex-pack-v4', 'phases', 'phase-00-owner-setup-and-capability', 'implementation-plan.md'));
  const phaseEight = source.get(join(documentsRoot, 'codex-pack-v4', 'phases', 'phase-08-sites-release-and-operations', 'implementation-plan.md'));
  const apiContract = source.get(join(documentsRoot, 'codex-pack-v4', 'contracts', 'api-contract.openapi.yaml'));
  const dataContract = source.get(join(documentsRoot, 'codex-pack-v4', 'contracts', 'data-contract.yaml'));
  const storageSchema = await readFile(join(documentsRoot, 'codex-pack-v4', 'contracts', 'storage-schema.sql'), 'utf8');

  assert.match(architecture, /POST \/api\/internal\/ingest\/snapshot/);
  assert.match(apiContract, /^  \/api\/internal\/ingest\/snapshot:$/m);
  assert.match(phaseZero, /phase-00-capability-probe/);
  assert.match(phaseZero, /POST \/api\/internal\/capability-probe\/ingest/);
  assert.match(phaseZero, /cannot prove Phase 02 production behavior/);
  assert.match(phaseEight, /docs\/evidence\/phase-08\/phase-receipt\.json/);
  assert.match(phaseEight, /nested `release` object/);
  assert.match(dataContract, /sourceUpdatedAt/);
  assert.match(dataContract, /fetchedAt/);
  assert.match(storageSchema, /source_updated_at/);
  assert.match(storageSchema, /fetched_at/);
}
