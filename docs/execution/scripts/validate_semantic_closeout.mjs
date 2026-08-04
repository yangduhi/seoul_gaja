import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { assertWorkflowSecurityBoundary } from '../../../tests/gates/task-06-contract.mjs';

const root = process.cwd();

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function json(path) {
  return JSON.parse(await text(path));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function gitBytes(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
}

function gitSha256(path) {
  return createHash('sha256').update(gitBytes(path)).digest('hex');
}

function contentRoot(entries) {
  return createHash('sha256')
    .update([...entries.entries()]
      .filter(([path]) => path !== 'PACKET-INTEGRITY.json')
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([path, digest]) => `${digest}  ${path}\n`)
      .join(''))
    .digest('hex');
}

async function validatePacket(lock) {
  const packet = lock.audit_packet_v4_0_0;
  const packetRoot = 'docs/codex-pack-v4';
  const manifest = new Map(gitBytes(`${packetRoot}/MANIFEST.sha256`).toString('utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [digest, path] = line.split('  ', 2);
      return [path, digest];
    }));
  const failures = [];

  for (const [path, digest] of manifest) {
    if (path === 'MANIFEST.sha256') continue;
    if (gitSha256(`${packetRoot}/${path}`) !== digest) failures.push(`packet hash mismatch: ${path}`);
  }
  if (contentRoot(manifest) !== packet.content_root_sha256) failures.push('packet content-root mismatch');
  if (await sha256(resolve(root, packet.source_zip)) !== packet.zip_sha256) failures.push('packet zip mismatch');
  if (gitSha256(`${packetRoot}/MANIFEST.sha256`) !== packet.extracted_manifest_sha256) failures.push('packet manifest mismatch');
  return failures;
}

function validateHumanPlan(plan, contract) {
  const failures = contract.forbidden_human_plan_literals
    .filter((literal) => plan.includes(literal))
    .map((literal) => `stale human-plan literal: ${literal}`);
  const required = [
    contract.canonical.production_ingest,
    contract.canonical.capability_probe,
    contract.canonical.evidence_pattern,
    contract.canonical.detail_route,
    ...contract.canonical.ui_time_fields,
    contract.canonical.token_name,
  ];
  for (const literal of required) {
    if (!plan.includes(literal)) failures.push(`missing human-plan authority literal: ${literal}`);
  }
  for (const blocker of contract.owner_blockers) {
    if (!plan.includes(blocker)) failures.push(`missing owner blocker: ${blocker}`);
  }
  return failures;
}

function validateScope() {
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  const allowed = [
    'docs/reference/FINAL_IMPLEMENTATION_PLAN.md',
    'docs/execution/contracts/semantic-closeout-contract.json',
    'docs/execution/scripts/validate_semantic_closeout.mjs',
    'tests/gates/task-12-contract.mjs',
    'tests/gates/task-12-happy.test.mjs',
    'tests/gates/task-12-failure.test.mjs',
    'tests/fixtures/task-12/',
    '.omo/evidence/seoul-gaja-v4-plan-review/task-12-',
  ];
  return changed.filter((path) => !allowed.some((prefix) => path === prefix || path.startsWith(prefix)))
    .map((path) => `out-of-scope change: ${path}`);
}

export async function validateSemanticCloseout() {
  const [lock, contract, plan] = await Promise.all([
    json('.omo/authority-lock.json'),
    json('docs/execution/contracts/semantic-closeout-contract.json'),
    text('docs/reference/FINAL_IMPLEMENTATION_PLAN.md'),
  ]);
  const failures = [];
  for (const artifact of contract.authority_artifacts) {
    const binding = artifact === lock.authority.plan.path ? lock.authority.plan : lock.authority.amendment;
    if (gitSha256(artifact) !== binding.sha256) failures.push(`authority hash mismatch: ${artifact}`);
  }
  failures.push(...await validatePacket(lock));
  failures.push(...validateHumanPlan(plan, contract));
  failures.push(...validateScope());
  try {
    execFileSync('python', ['docs/execution/scripts/validate_phase_receipts.py', 'docs/execution/contracts/phase-receipt.schema.json', 'docs/evidence/phase-00/phase-receipt.json'], { cwd: root, stdio: 'pipe' });
  } catch {
    failures.push('phase receipt schema validation failed');
  }
  try {
    await assertWorkflowSecurityBoundary();
  } catch {
    failures.push('workflow security scan failed');
  }
  return {
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    packet: { structural_scope: contract.packet.scope },
    owner_blockers: contract.owner_blockers,
  };
}

if (import.meta.main) {
  const result = await validateSemanticCloseout();
  console.log(JSON.stringify(result));
  process.exitCode = result.verdict === 'PASS' ? 0 : 1;
}
