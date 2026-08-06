import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const validatorPath = resolve(repositoryRoot, 'docs/execution/scripts/validate_design_audit.py');

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function gitValue(revision) {
  const { stdout } = await execFileAsync('git', ['rev-parse', revision], { cwd: repositoryRoot });
  return stdout.trim();
}

async function createAuditDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'seoul-gaja-design-audit-'));
  const planPath = resolve(repositoryRoot, '.omo/plans/seoul-gaja-v4-plan-review.md');
  const authorityPath = resolve(repositoryRoot, '.omo/authority-lock.json');
  const contractPath = resolve(repositoryRoot, 'docs/execution/contracts/design-audit-contract.json');
  const snapshotPaths = [
    '.omo/authority-lock.json',
    '.omo/plans/seoul-gaja-v4-plan-review.md',
    'docs/execution/contracts/design-audit-contract.json',
  ];
  const snapshotEntries = await Promise.all(snapshotPaths.map(async (path) => ({
    path,
    sha256: await sha256(resolve(repositoryRoot, path)),
    role: path === 'docs/execution/contracts/design-audit-contract.json' ? 'contract' : 'authority',
  })));
  const snapshotDigest = createHash('sha256')
    .update(snapshotEntries
      .slice()
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map((entry) => `${entry.sha256}  ${entry.path}\n`)
      .join(''))
    .digest('hex');
  const candidate = {
    head_sha: await gitValue('HEAD'),
    head_tree_sha: await gitValue('HEAD^{tree}'),
    plan_sha256: await sha256(planPath),
    authority_lock_sha256: await sha256(authorityPath),
    worktree_snapshot_sha256: snapshotDigest,
  };
  const writeJson = async (name, value) => writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  await writeJson('audit-manifest.json', {
    schema_version: 3,
    audit_id: basename(directory),
    candidate,
    target: {
      target_class: 'SERVER_ONLY',
      route: '/api/internal/ingest/snapshot',
      surface: 'server/API route',
      source_paths: ['server/ingest-snapshot-request.mjs'],
      changed_paths: ['server/ingest-snapshot-request.mjs'],
    },
    snapshot: { algorithm: 'sha256-path-manifest-v1', entries: snapshotEntries, excluded_paths: ['.omo/evidence/design-audit/**'] },
  });
  await writeJson('worktree-snapshot.json', {
    schema_version: 1,
    algorithm: 'sha256-path-manifest-v1',
    aggregate_sha256: candidate.worktree_snapshot_sha256,
    entries: snapshotEntries,
    excluded_paths: ['.omo/evidence/design-audit/**'],
    ...candidate,
  });
  await writeJson('mengto-recommendation.json', { schema_version: 1, status: 'PASS', router: 'mengto-skills', ...candidate });
  await writeJson('contract-matrix.json', { schema_version: 1, rows: [], ...candidate });
  await writeJson('scorecard.json', {
    schema_version: 3,
    target_class: 'SERVER_ONLY',
    score: null,
    target_score: 100,
    status: 'NOT_APPLICABLE',
    loop_state: 'NON_RENDERING_PROVENANCE_COMPLETE',
    components: [],
    ...candidate,
  });
  await writeJson('improvement-plan.json', { schema_version: 3, status: 'NOT_REQUIRED', target_class: 'SERVER_ONLY', target_score: 100, ...candidate });
  await writeJson('loop-ledger.json', {
    schema_version: 3,
    target_class: 'SERVER_ONLY',
    ...candidate,
    iterations: [{
      iteration: 1,
      baseline_score: null,
      target_score: 100,
      improvement_plan_id: null,
      applied_changes: [],
      score_after: null,
      score_delta: 0,
      recheck_verdict: 'NOT_APPLICABLE',
      head_sha: candidate.head_sha,
      head_tree_sha: candidate.head_tree_sha,
      worktree_snapshot_sha256: candidate.worktree_snapshot_sha256,
      next_loop_state: 'NON_RENDERING_PROVENANCE_COMPLETE',
    }],
  });
  await writeJson('findings.json', { schema_version: 3, findings: [], ...candidate });
  await writeJson('verdict.json', {
    schema_version: 3,
    verdict: 'NOT_APPLICABLE',
    target_class: 'SERVER_ONLY',
    score: null,
    target_score: 100,
    loop_state: 'NON_RENDERING_PROVENANCE_COMPLETE',
    baseline_score: null,
    score_delta: 0,
    improvements_applied: [],
    recheck_evidence: ['static source inspection'],
    ...candidate,
    blocker: null,
  });
  return { directory, candidate };
}

async function runValidator(directory, ...extraArgs) {
  try {
    const result = await execFileAsync('python', [validatorPath, '--audit-dir', directory, ...extraArgs], {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    });
    return { code: 0, stdout: result.stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

test('accepts a candidate-bound non-rendering audit without entering the UI score loop', async () => {
  const { directory } = await createAuditDirectory();
  try {
    const result = await runValidator(directory);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /NOT_APPLICABLE/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects stale HEAD evidence and canonical loop-field drift', async () => {
  const { directory } = await createAuditDirectory();
  try {
    const manifestPath = join(directory, 'audit-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.candidate.head_sha = '0123456789abcdef0123456789abcdef01234567';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const stale = await runValidator(directory);
    assert.equal(stale.code, 1);
    assert.match(stale.stdout, /HEAD_SHA_MISMATCH/);

    manifest.candidate.head_sha = await gitValue('HEAD');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const ledgerPath = join(directory, 'loop-ledger.json');
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
    ledger.iterations[0].score = null;
    delete ledger.iterations[0].score_after;
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    const drift = await runValidator(directory);
    assert.equal(drift.code, 1);
    assert.match(drift.stdout, /LOOP_FIELD_MISSING/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('blocks a rendered UI PASS without score 100 and real capture evidence', async () => {
  const { directory } = await createAuditDirectory();
  try {
    const manifestPath = join(directory, 'audit-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.target.target_class = 'RENDERED_UI';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    for (const name of ['scorecard.json', 'improvement-plan.json', 'loop-ledger.json']) {
      const path = join(directory, name);
      const artifact = JSON.parse(await readFile(path, 'utf8'));
      artifact.target_class = 'RENDERED_UI';
      await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    }
    const verdictPath = join(directory, 'verdict.json');
    const verdict = JSON.parse(await readFile(verdictPath, 'utf8'));
    verdict.target_class = 'RENDERED_UI';
    verdict.verdict = 'PASS';
    verdict.score = 90;
    verdict.loop_state = 'BELOW_TARGET';
    await writeFile(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
    const result = await runValidator(directory);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /SCORE_REQUIRED|SCORECARD_COMPONENTS_REQUIRED|PASS_REQUIRES_SCORE_100|CAPTURE_MANIFEST_REQUIRED|MATRIX_ARTIFACT_REQUIRED/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('returns NOT_RUN_BLOCKED only with a typed blocker for an unavailable rendered surface', async () => {
  const { directory, candidate } = await createAuditDirectory();
  try {
    const manifestPath = join(directory, 'audit-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.target.target_class = 'RENDERED_UI';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    for (const name of ['scorecard.json', 'improvement-plan.json', 'loop-ledger.json']) {
      const path = join(directory, name);
      const artifact = JSON.parse(await readFile(path, 'utf8'));
      artifact.target_class = 'RENDERED_UI';
      await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    }
    const verdictPath = join(directory, 'verdict.json');
    const verdict = JSON.parse(await readFile(verdictPath, 'utf8'));
    verdict.target_class = 'RENDERED_UI';
    verdict.verdict = 'NOT_RUN_BLOCKED';
    verdict.loop_state = 'HARD_BLOCKED';
    verdict.blocker = {
      type: 'TOOL',
      reason: 'browser unavailable',
      owner_or_tool: 'repository browser adapter',
      next_allowed_action: 'start the real preview and rerun D3',
      candidate_snapshot: candidate,
    };
    await writeFile(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
    const result = await runValidator(directory);
    assert.equal(result.code, 3);
    assert.match(result.stdout, /NOT_RUN_BLOCKED/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('active mode is non-blocking when no UI audit is active', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seoul-gaja-empty-audit-'));
  try {
    const result = await execFileAsync('python', [validatorPath, '--active', '--audit-root', directory], {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    });
    assert.match(result.stdout, /NOT_APPLICABLE/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
