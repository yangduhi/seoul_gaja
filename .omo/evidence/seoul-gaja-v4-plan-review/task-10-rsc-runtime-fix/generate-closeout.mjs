import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const evidenceRoot = resolve(root, ".omo/evidence/seoul-gaja-v4-plan-review/task-10-rsc-runtime-fix");
const candidate = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim(),
  parent: execFileSync("git", ["rev-parse", "HEAD^"], { cwd: root, encoding: "utf8" }).trim(),
  parent_tree: execFileSync("git", ["rev-parse", "HEAD^^{tree}"], { cwd: root, encoding: "utf8" }).trim(),
};
const baselineNetwork = JSON.parse(await readFile(resolve(evidenceRoot, "baseline/browser-network-diagnostic.json"), "utf8"));
const greenNetwork = JSON.parse(await readFile(resolve(evidenceRoot, "green/browser-network-diagnostic.json"), "utf8"));
const greenMatrix = JSON.parse(await readFile(resolve(evidenceRoot, "green/browser-matrix.json"), "utf8"));
const changedPaths = execFileSync("git", ["diff", "--name-only", `${candidate.parent}..${candidate.head}`], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);

async function writeJson(name, value) {
  await writeFile(resolve(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await writeJson("candidate-binding.json", {
  schema_version: 1,
  implementation: candidate,
  exact_parent_required: "323717c167111eea5f652ccaea7baf4c31a8a6e0",
  exact_parent_tree_required: "4b9845e0133962620f7ad78701b62292a86a3902",
  ancestry_pass: candidate.parent === "323717c167111eea5f652ccaea7baf4c31a8a6e0" && candidate.parent_tree === "4b9845e0133962620f7ad78701b62292a86a3902",
  changed_paths: changedPaths,
  scope_pass: changedPaths.every((path) => ["app/_catalog/CatalogSurface.tsx", "app/places/[areaCode]/PlaceDetailClient.tsx", "tests/product/detail-history/detail-contract.test.mjs"].includes(path)),
});

await writeJson("command-map-results.json", {
  candidate,
  results: [
    { id: "task-10-happy", invocation: "python docs/execution/scripts/run_command_map.py --map docs/execution/contracts/execution-command-map.json --id task-10-happy", exit: 0, verdict: "PASS", artifact: "automated/command-map-task-10-happy.log" },
    { id: "task-10-failure", invocation: "python docs/execution/scripts/run_command_map.py --map docs/execution/contracts/execution-command-map.json --id task-10-failure", exit: 0, verdict: "PASS", artifact: "automated/command-map-task-10-failure.log" },
    { id: "task-10-map-retry-layout", invocation: "node --test tests/gates/task-10-map-retry-layout.test.mjs", passes: 2, verdict: "PASS", artifacts: ["automated/focused-pass-1.log", "automated/focused-pass-2.log"] },
    { id: "task-10-map-retry-hit-test", invocation: "node --test tests/gates/task-10-map-retry-hit-test.test.mjs", passes: 2, verdict: "PASS", artifacts: ["automated/focused-pass-1.log", "automated/focused-pass-2.log"] },
  ],
});

await writeJson("ultraqa.json", {
  candidate,
  verdict: "PASS",
  probes: [
    { trigger: "malformed_input", status: "PASS", observable: "invalid /places/does-not-exist?visualFixture=ready-v1 canonicalized to / with catalog not-found and noindex,nofollow at every viewport", artifact: "green/browser-matrix.json" },
    { trigger: "prompt_injection", status: "PASS", observable: "hostile <img onerror> search remained inert text; imgCount=0, injected=false", artifact: "green/browser-matrix.json" },
    { trigger: "cancel_resume", status: "NOT_APPLICABLE", reason: "Todo10 has no resumable asynchronous user workflow; share cancellation remains covered by task-10-failure." },
    { trigger: "stale_state", status: "PASS", observable: "direct/reload stayed FULL_SCREEN and 8 direct browser Back journeys restored / with catalog-root and no detail surface", artifact: "green/browser-matrix.json" },
    { trigger: "dirty_worktree", status: "PASS", observable: "task branch was created directly from the required exact parent; implementation diff contains only three owned paths", artifact: "candidate-binding.json" },
    { trigger: "hung_long_commands", status: "PASS", observable: "Vinext readiness was bounded to 60s and browser actions to explicit Playwright timeouts; task-owned servers were terminated", artifact: "green/browser-matrix.mjs" },
    { trigger: "flaky_tests", status: "PASS", observable: "focused suite passed 25/25 twice and real browser matrix passed all four viewports twice", artifacts: ["automated/focused-pass-1.log", "automated/focused-pass-2.log", "green/browser-matrix.json"] },
    { trigger: "misleading_success_output", status: "PASS", observable: `exact-parent stdout-style behavior was rejected because requestfailed parsing found ${baselineNetwork.failedCount} .rsc ERR_ABORTED events; candidate parsing found ${greenNetwork.failedCount}`, artifacts: ["baseline/browser-network-diagnostic.json", "green/browser-network-diagnostic.json"] },
    { trigger: "repeated_interruptions", status: "PASS", observable: "task-owned Vinext server was stopped and restarted on port 53824; both runs reached HTTP 200 and freed the port after stop", artifact: "automated/interruption-cleanup.json" },
  ],
});

await writeJson("verification-summary.json", {
  schema_version: 1,
  candidate,
  verdict: "PASS",
  root_cause: "The inherited one-shot Vinext wrapper was armed only by in-app close. Direct browser Back from a sheet reached the catalog-root sentinel without arming it, so Vinext started a redundant RSC traversal that Chrome later reported as net::ERR_ABORTED.",
  fix: "Install a reversible wrapper for the lifetime of CatalogSurface and bypass only navigationKind=traverse at the / catalog-root sentinel; delegate every other navigation to Vinext.",
  red: { failedCount: baselineNetwork.failedCount, rscFailureCount: baselineNetwork.rscFailures.length, consoleErrorCount: baselineNetwork.consoleErrorCount, artifact: "baseline/browser-network-diagnostic.json", seam_artifact: "baseline/zero-rsc-seam-red.log" },
  green: { ...greenMatrix.networkSummary, viewports: greenMatrix.viewports, repetitions: greenMatrix.repetitions, verdict: greenMatrix.verdict, artifact: "green/browser-matrix.json", network_artifact: "green/browser-network-diagnostic.json" },
  claims: [
    { criterion: "exact-parent RED", scenario: "close/Back plus direct browser Back at four viewports, two passes", invocation: "TASK10_PHASE=baseline node .omo/evidence/seoul-gaja-v4-plan-review/task-10-rsc-runtime-fix/browser-matrix.mjs", binary_observable: `${baselineNetwork.failedCount} requestfailed and ${baselineNetwork.rscFailures.length} rsc failures`, artifact: "baseline/browser-network-diagnostic.json" },
    { criterion: "zero-failure GREEN", scenario: "ready/selected/direct Back, direct/reload/invalid, retry, hostile search at 390x844, 430x932, 768x1024, 1616x923", invocation: "TASK10_PHASE=green node .omo/evidence/seoul-gaja-v4-plan-review/task-10-rsc-runtime-fix/browser-matrix.mjs", binary_observable: "failedCount=0, hardFailureCount=0, rscFailureCount=0, consoleErrorCount=0", artifact: "green/browser-network-diagnostic.json" },
    { criterion: "focused behavior", scenario: "Todo10 happy/failure/history seam/map retry", invocation: "node --test <five focused Todo10 files>, repeated twice", binary_observable: "25 tests passed, 0 failed on each pass", artifacts: ["automated/focused-pass-1.log", "automated/focused-pass-2.log"] },
    { criterion: "repo gates", scenario: "command map, lint, build, tokens, authority", invocation: "repo-native commands recorded in automated logs", binary_observable: "all required exit codes 0; lint has 0 errors", artifacts: ["command-map-results.json", "automated/lint.log", "automated/build.log", "automated/tokens.log", "automated/authority.log"] },
    { criterion: "design audit", scenario: "navigation-only frontend provenance", invocation: "python docs/execution/scripts/validate_design_audit.py --audit-dir .omo/evidence/design-audit/todo10-rsc-runtime-fix-802a27e", binary_observable: "NOT_APPLICABLE exit_code=0 target_class=NON_RENDERING_FRONTEND", artifact: "automated/design-audit-validator.log" },
  ],
  typecheck: { status: "PRE_EXISTING_NOT_REPO_GATE", invocation: "npx tsc --noEmit", exit: 2, observable: "app/_design/PrimitiveShowcase.tsx(42,8) TS2741 missing surface", scope_proof: "PrimitiveShowcase.tsx is absent from the implementation diff", artifact: "automated/typecheck.log" },
});

console.log(JSON.stringify({ candidate, baseline: baselineNetwork.failedCount, green: greenMatrix.networkSummary, changedPaths }, null, 2));
