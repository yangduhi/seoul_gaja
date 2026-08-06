# Seoul Gaja v4.1 Autonomous Design Audit Runbook

## Purpose

The machine-readable contract is `docs/execution/contracts/design-audit-contract.json`. The executable gate is `docs/execution/scripts/validate_design_audit.py`. This is an additive process contract: the existing authority lock, amendment, approved plan, design tokens, component contracts, and screen specifications remain authoritative.

The implementation executor may audit and improve a bounded UI slice without waiting for a routine user prompt. It does not authorize secrets, live APIs, migrations, Sites actions, push, merge, sharing, paid resources, or destructive operations.

## Operating invariants

1. Every slice is classified as `RENDERED_UI`, `NON_RENDERING_FRONTEND`, or `SERVER_ONLY` and bound to one exact `HEAD`, `HEAD^{tree}`, plan SHA, authority-lock SHA, worktree snapshot SHA, route, and surface.
2. `mengto-skills` runs before the audit pack is selected. Its scores are recommendations, not design authority.
3. `ui/redesign-existing-projects` is diagnostic-only in this lane. It may identify a fix but may not silently mutate the repository.
4. Routine safe local fixes are autonomous. The executor may resolve in-scope P0-P2 findings in the same bounded slice and re-audit without asking the user.
5. Every rendered UI audit produces a 100-point score. A score below 100 is `BELOW_TARGET` and must enter the improvement-plan loop; it can never be reported as `PASS`.
6. The loop has no cycle-count limit: `AUDIT_REQUIRED -> BELOW_TARGET -> IMPROVEMENT_PLAN_REQUIRED -> APPLYING_IMPROVEMENTS -> RECHECK_REQUIRED -> PASS_100`. It continues until score `100` or a named hard owner/tool/design-decision blocker produces `NOT_RUN_BLOCKED`.
7. A browser or target route is required for rendered UI visual PASS. Mockups, fixtures, and stale screenshots never approve a real-surface design gate.
8. Any working-tree change, commit, or integration invalidates evidence from the previous candidate. Rebind and re-audit; do not rename stale evidence as current.
9. Owner-controlled gates remain explicit even when the design loop is autonomous.
10. Every iteration must increase score, close a finding, add required evidence, or create a named blocker/decision packet. This is a progress invariant, not a cycle limit.

## Authority and source mapping

The execution authority is read in this order:

1. `.omo/authority-lock.json`
2. `docs/execution/AMENDMENT-v4.1.md`
3. `.omo/plans/seoul-gaja-v4-plan-review.md` at its bound SHA
4. `docs/codex-pack-v4/contracts/*`

The design source is then read in this order:

1. `docs/codex-pack-v4/design/design.md`
2. `design/design-tokens.json`
3. `docs/codex-pack-v4/design/component-contracts.md`
4. `docs/codex-pack-v4/design/screen-specs.md`
5. `docs/codex-pack-v4/design/mockups/*.png`

MengTo guidance cannot replace or weaken these sources.

## Automatic lifecycle

### D0. Bind and classify the candidate

Classify the target and record the exact candidate identity, target route/surface, assigned slice, required viewport set, and changed paths. Store `head_sha`, `head_tree_sha`, `plan_sha256`, `authority_lock_sha256`, and `worktree_snapshot_sha256`. The snapshot is calculated from the manifest's source and authority input hashes; audit outputs are excluded. For a rendered UI slice, write `.omo/evidence/design-audit/ACTIVE.json` with the relative `audit_dir`; remove or replace it when the slice closes.

`SERVER_ONLY` and `NON_RENDERING_FRONTEND` slices close as `NOT_APPLICABLE` after provenance/static evidence. They do not enter the visual score loop and never approve a rendered UI.

### D1. Select the audit pack

Run `mengto-skills` and store its recommendation, exact command, adapter version/hash, exit code, and redacted output beside the audit evidence. Use the approved core pack:

- `ui/redesign-existing-projects` in diagnostic-only mode
- `web-design/framed-grid-layout`
- `web-design/split-layout-technical`
- `web-design/nested-container-frames`
- `codex/playwright`
- `codex/audit-verify-explain-grade-5`

Use `ui/design-taste-frontend` only as a secondary anti-slop lens. Use `codex/screenshot` only when the browser capture path is unavailable. A stale or failed recommendation is `UNVERIFIED`, not a successful selection.

### D2. Inspect contracts and implementation

Compare the target implementation to the authority before changing it. Check tokens, primitives, component states, route shape, frame hierarchy, responsive geometry, Korean wrapping, and forbidden route or decoration patterns. Write source requirement rows to `contract-matrix.json` with source anchor, applicable route/state/viewport, expected observable, observation method, actual evidence, and classification.

### D3. Observe the real surface

Use the repository-owned browser adapter at `390x844`, `430x932`, `768x1024`, and `1616x923`. Record route, state, viewport, DPR, browser version, candidate snapshot, evidence hash, source anchors, DOM measurements, and accessibility-tree evidence in `capture-manifest.json`. Verify focus, sheet close, `aria-live`, reduced motion, chart alternatives, 44px targets, and unclipped primary actions.

If the actual browser or route is unavailable, record `NOT_RUN_BLOCKED`; do not convert static evidence into a visual PASS.

### D4. Classify findings

Every finding receives a severity and one of `MATCH`, `DEVIATION`, `OMISSION`, or `UNVERIFIED`. Findings must cite their source contract, source anchor, candidate-bound evidence, iteration, expected score delta, improvement-plan ID, and applicable matrix row. Use `state-transition-matrix.json` for component/route state transitions and `responsive-acceptance.json` for viewport-specific layout expectations.

### D5. Score the design

Run the ten-component scorecard from the contract. Each component is worth 10 points and earns its points only when all applicable atomic checks are proven on the current candidate. Each check names applicability, source authority, acceptance criteria, observation method, and evidence ID. Write `scorecard.json` with the baseline score, component results, evidence, target score `100`, current loop state, and severity-cap result.

The only successful rendered UI score is `100/100`. A score below 100 is `BELOW_TARGET`, even when the remaining gap is only visual polish or a P3 finding. An unresolved P0/P1 finding forbids PASS regardless of numeric score.

### D6. Write the improvement plan

When the score is below 100, create `improvement-plan.json` before changing code. The plan must cover every unmet score component and contain:

- baseline score and target score;
- ordered findings and proposed improvements;
- expected score delta for each improvement;
- exact changed paths and owner;
- acceptance criteria for the next full audit;
- any hard owner/tool/design-decision blocker;
- `change_class`, `requires_owner_gate`, `owner_gate_id`, `authorization_artifact`, `authorization_candidate_snapshot`, and `decision` for every proposed action.

No improvement may be applied without an improvement plan. If the score is already 100, write an empty `NOT_REQUIRED` plan so the evidence shape remains stable. A plan that changes no score, finding, or evidence must produce a named blocker or `design-decision.json`; it must not silently repeat.

### D7. Apply the improvement plan

The implementation executor applies safe local actions from the plan without routine user intervention. There is no maximum iteration count. P3 findings that are in scope also contribute to the score and cannot be silently report-only. Owner-gated changes remain unapplied without the matching authorization artifact.

Authority changes, new packages or routes, external actions, and scope expansion remain behind their existing owner gates.

### D8. Re-audit and rescore

After every improvement change, including an uncommitted working-tree change, rebind the candidate and repeat D0 through D5. Record the new score, score delta, changed paths, snapshot hash, and recheck evidence. If the score remains below 100, return to D6 and write the next improvement plan.

A no-progress iteration must terminate as `NOT_RUN_BLOCKED` with a typed blocker or decision packet. This does not impose a cycle limit; it prevents silent no-op repetition.

### D9. Close at 100

Close a rendered UI audit only when the score is exactly `100/100`, every in-scope finding is resolved, all required viewports, states, accessibility checks, and evidence bindings are current, and no hard blocker remains. A below-target `FAIL` is non-terminal and must not be handed off as complete. Non-rendering slices close only as `NOT_APPLICABLE` provenance receipts.

## Evidence contract

Store audit artifacts under `.omo/evidence/design-audit/<audit-id>/` when the operating leader has designated that evidence path. The minimum set is:

- `audit-manifest.json`
- `mengto-recommendation.json`
- `contract-matrix.json`
- `scorecard.json`
- `improvement-plan.json`
- `loop-ledger.json`
- `findings.json`
- `verdict.json`
- `worktree-snapshot.json`
- `capture-manifest.json` for `RENDERED_UI`, or a named `NOT_RUN_BLOCKED` record
- `state-transition-matrix.json` for `RENDERED_UI`
- `responsive-acceptance.json` for `RENDERED_UI`

Each artifact must carry the exact `head_sha`, `head_tree_sha`, and `worktree_snapshot_sha256`. The report must distinguish:

- `MATCH`: source and observed surface agree
- `DEVIATION`: observed surface differs from an applicable source contract
- `OMISSION`: required state or behavior is absent
- `UNVERIFIED`: evidence is insufficient

`loop-ledger.json` contains one entry for every iteration. Each entry records the canonical fields `iteration`, `baseline_score`, `target_score`, `improvement_plan_id`, `applied_changes`, `score_after`, `score_delta`, `recheck_verdict`, `head_sha`, `head_tree_sha`, `worktree_snapshot_sha256`, and `next_loop_state`. A missing or legacy field invalidates `PASS`.

The executable validator is:

```text
python docs/execution/scripts/validate_design_audit.py --audit-dir <audit-dir>
python docs/execution/scripts/validate_design_audit.py --active --audit-root .omo/evidence/design-audit
```

The design gate uses `PASS`, `FAIL`, `NOT_RUN_BLOCKED`, or `NOT_APPLICABLE`. `PASS` is valid only with `score=100`; below-target `FAIL` is non-terminal; `NOT_RUN_BLOCKED` is reserved for a typed hard owner/tool/design-decision blocker; `NOT_APPLICABLE` is reserved for non-rendering slices.

## Handoff and escalation

The audit lane sends an improvement plan for every score below 100. The implementation lane returns the new exact HEAD/tree, changed paths, applied plan ID, actual score delta, and snapshot hash before full re-audit. A finding that requires an authority change, new dependency, public route, external action, or scope expansion is not silently fixed; it is recorded as a typed blocker and remains non-PASS until resolved.

The audit lane must not use `gstack:design-review` as an automatic fixer. That skill belongs only in an explicitly approved implementation/fix lane.

## Closeout rule

The design audit is complete only when the current rendered-UI candidate scores exactly `100/100`, no in-scope finding remains unresolved, all required viewports and accessibility checks are proven, every improvement has a subsequent full recheck, and no `NOT_RUN_BLOCKED` condition remains for the applicable F3/final gate. Non-rendering slices close only as `NOT_APPLICABLE` provenance receipts.
