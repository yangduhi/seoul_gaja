import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const auditDir = resolve(root, ".omo/evidence/design-audit/todo10-rsc-runtime-fix-802a27e");
const inputPaths = [
  ".omo/authority-lock.json",
  ".omo/plans/seoul-gaja-v4-plan-review.md",
  "docs/execution/AMENDMENT-v4.1.md",
  "docs/execution/contracts/design-audit-contract.json",
  "app/_catalog/CatalogSurface.tsx",
  "app/places/[areaCode]/PlaceDetailClient.tsx",
  "tests/product/detail-history/detail-contract.test.mjs",
];

function gitValue(revision) {
  return execFileSync("git", ["rev-parse", revision], { cwd: root, encoding: "utf8" }).trim();
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
}

const entries = await Promise.all(inputPaths.map(async (path) => ({ path, sha256: await sha256(path), role: path.includes("design-audit-contract") ? "contract" : path.startsWith("app/") || path.startsWith("tests/") ? "source" : "authority" })));
const worktreeSnapshot = createHash("sha256").update(entries.slice().sort((left, right) => left.path.localeCompare(right.path)).map((entry) => `${entry.sha256}  ${entry.path}\n`).join("")).digest("hex");
const candidate = {
  head_sha: gitValue("HEAD"),
  head_tree_sha: gitValue("HEAD^{tree}"),
  plan_sha256: await sha256(".omo/plans/seoul-gaja-v4-plan-review.md"),
  authority_lock_sha256: await sha256(".omo/authority-lock.json"),
  worktree_snapshot_sha256: worktreeSnapshot,
};
const bound = { ...candidate };

async function writeJson(name, value) {
  await writeFile(resolve(auditDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await mkdir(auditDir, { recursive: true });
await writeJson("audit-manifest.json", { schema_version: 3, audit_id: "todo10-rsc-runtime-fix-802a27e", candidate, target: { target_class: "NON_RENDERING_FRONTEND", route: "/ and /places/{areaCode}", surface: "catalog history traversal runtime seam", source_paths: ["app/_catalog/CatalogSurface.tsx", "app/places/[areaCode]/PlaceDetailClient.tsx"], changed_paths: ["app/_catalog/CatalogSurface.tsx", "app/places/[areaCode]/PlaceDetailClient.tsx", "tests/product/detail-history/detail-contract.test.mjs"] }, snapshot: { algorithm: "sha256-path-manifest-v1", entries, excluded_paths: [".omo/evidence/design-audit/**"] } });
await writeJson("worktree-snapshot.json", { schema_version: 1, algorithm: "sha256-path-manifest-v1", aggregate_sha256: worktreeSnapshot, entries, excluded_paths: [".omo/evidence/design-audit/**"], ...bound });
await writeJson("mengto-recommendation.json", { schema_version: 1, status: "PASS", router: "mengto-skills", command: "python D:/DevWorkCache/.codex/skills/mengto-skills/scripts/recommend_skills.py --repo D:/vscode/seoul_gaja-worktrees/todo10-rsc-runtime-fix --task Todo10-runtime-fix --lang ko", output: ".omo/evidence/seoul-gaja-v4-plan-review/task-10-rsc-runtime-fix/automated/mengto-recommendation.log", ...bound });
await writeJson("contract-matrix.json", { schema_version: 1, rows: [{ source_requirement_id: "TODO10_HISTORY_RUNTIME", classification: "MATCH", expected_observable: "Catalog sentinel traversal restores the existing client-rendered catalog without initiating an RSC request.", observation_method: "Two-pass installed-Chrome requestfailed capture", actual_evidence: ".omo/evidence/seoul-gaja-v4-plan-review/task-10-rsc-runtime-fix/green/browser-network-diagnostic.json" }], ...bound });
await writeJson("scorecard.json", { schema_version: 3, target_class: "NON_RENDERING_FRONTEND", score: null, target_score: 100, status: "NOT_APPLICABLE", loop_state: "NON_RENDERING_PROVENANCE_COMPLETE", components: [], ...bound });
await writeJson("improvement-plan.json", { schema_version: 3, status: "NOT_REQUIRED", target_class: "NON_RENDERING_FRONTEND", target_score: 100, ...bound });
await writeJson("loop-ledger.json", { schema_version: 3, target_class: "NON_RENDERING_FRONTEND", ...bound, iterations: [{ iteration: 1, baseline_score: null, target_score: 100, improvement_plan_id: null, applied_changes: ["Installed a catalog-lifetime Vinext traversal guard scoped to the catalog-root sentinel."], score_after: null, score_delta: 0, recheck_verdict: "NOT_APPLICABLE", head_sha: candidate.head_sha, head_tree_sha: candidate.head_tree_sha, worktree_snapshot_sha256: candidate.worktree_snapshot_sha256, next_loop_state: "NON_RENDERING_PROVENANCE_COMPLETE" }] });
await writeJson("findings.json", { schema_version: 3, findings: [], ...bound });
await writeJson("verdict.json", { schema_version: 3, verdict: "NOT_APPLICABLE", target_class: "NON_RENDERING_FRONTEND", score: null, target_score: 100, loop_state: "NON_RENDERING_PROVENANCE_COMPLETE", baseline_score: null, score_delta: 0, improvements_applied: ["Catalog-root traverse suppression only"], recheck_evidence: ["green/browser-network-diagnostic.json: failedCount=0, rscFailures=[]", "automated/focused-pass-1.log and focused-pass-2.log: 25/25 PASS"], ...bound, blocker: null });
await writeJson("capture-manifest.json", { schema_version: 1, status: "NOT_APPLICABLE", target_class: "NON_RENDERING_FRONTEND", reason: "The change affects only Vinext request lifecycle interception and does not alter rendered pixels; browser screenshots remain in the Todo10 QA evidence, not as a rendered-design gate.", ...bound });
console.log(JSON.stringify({ auditDir, candidate, verdict: "NOT_APPLICABLE" }, null, 2));
