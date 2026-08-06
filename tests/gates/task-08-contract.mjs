import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluateTask08Fixture } from '../../server/provenance-cadence.mjs';

const root = process.cwd();

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

async function main(paths) {
  const capacity = (await readJson('docs/execution/contracts/provenance-cadence-contract.json')).capacity;
  const results = [];
  for (const path of paths) {
    const fixture = await readJson(path);
    const observed = evaluateTask08Fixture(fixture, capacity);
    results.push({ path, expected: fixture.expected_verdict, ...observed, matches_expected: observed.verdict === fixture.expected_verdict && observed.code === fixture.expected_code });
  }
  process.stdout.write(`${JSON.stringify({ results })}\n`);
  if (results.some((result) => !result.matches_expected)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.length > 2) {
  await main(process.argv.slice(2));
}
