# Seoul Gaja v4.1 Autonomous Design Audit Runbook

## Purpose

This runbook makes design review an automatic part of local UI implementation. The implementation executor may audit and improve a bounded UI slice without waiting for a routine user prompt. It does not authorize secrets, live APIs, migrations, Sites actions, push, merge, sharing, paid resources, or destructive operations.

The machine-readable contract is `docs/execution/contracts/design-audit-contract.json`. It is an additive process contract: the existing authority lock, amendment, approved plan, design tokens, component contracts, and screen specifications remain authoritative.

## Operating invariants

1. Every UI slice is bound to one exact `HEAD`, tree, plan SHA, authority-lock SHA, route, and surface.
2. `mengto-skills` runs before the audit pack is selected. Its scores are recommendations, not design authority.
3. `ui/redesign-existing-projects` is diagnostic-only in this lane. It may identify a fix but may not silently mutate the repository.
4. Routine safe local fixes are autonomous. The executor may resolve in-scope P0-P2 findings in the same bounded slice and re-audit without asking the user.
5. Every audit produces a 100-point score. A score below 100 is `BELOW_TARGET` and must enter the improvement-plan loop; it can never be reported as `PASS`.
6. The loop has no cycle-count limit: `검수 -> 미달 -> 개선안 작성 -> 개선안 적용 -> 전체 재검수 -> 100점 여부 확인`. It continues until score `100` or a named hard owner/tool blocker produces `NOT_RUN_BLOCKED`.
7. A browser or target route is required for visual PASS. Mockups, fixtures, and stale screenshots never approve a real-surface design gate.
8. Any working-tree change, commit, or integration invalidates evidence from the previous candidate. Rebind and re-audit; do not rename stale evidence as current.
9. Owner-controlled gates remain explicit even when the design loop is autonomous.

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

### D0. Bind the candidate

Record the exact candidate identity, target route/surface, assigned UI slice, required viewport set, and changed paths. Missing identity is `UNVERIFIED` and cannot produce design `PASS`.

### D1. Select the audit pack

Run `mengto-skills` and store its recommendation beside the audit evidence. Use the approved core pack:

- `ui/redesign-existing-projects` in diagnostic-only mode
- `web-design/framed-grid-layout`
- `web-design/split-layout-technical`
- `web-design/nested-container-frames`
- `codex/playwright`
- `codex/audit-verify-explain-grade-5`

Use `ui/design-taste-frontend` only as a secondary anti-slop lens. Use `codex/screenshot` only when the browser capture path is unavailable.

### D2. Inspect contracts and implementation

Compare the target implementation to the authority before changing it. Check tokens, primitives, component states, route shape, frame hierarchy, responsive geometry, Korean wrapping, and forbidden route or decoration patterns.

### D3. Observe the real surface

Use Playwright and the project’s browser wrapper at `390x844`, `430x932`, `768x1024`, and `1616x923`. Verify the required interaction and accessibility states, including focus, sheet close, `aria-live`, reduced motion, chart alternatives, 44px targets, and unclipped primary actions.

If the actual browser or route is unavailable, record `NOT_RUN_BLOCKED`; do not convert static evidence into a visual PASS.

### D4. Classify findings

Every finding receives a severity and one of `MATCH`, `DEVIATION`, `OMISSION`, or `UNVERIFIED`. Findings must cite their source contract, candidate-bound evidence, iteration, expected score delta, and improvement-plan ID.

### D5. Score the design

Run the ten-component scorecard from the contract. Each component is worth 10 points and earns its points only when all of its checks are proven on the current candidate. Write `scorecard.json` with the baseline score, component results, evidence, target score `100`, and current loop state.

The only successful score is `100/100`. A score below 100 is `BELOW_TARGET`, even when the remaining gap is only visual polish or a P3 finding.

### D6. Write the improvement plan

When the score is below 100, create `improvement-plan.json` before changing code. The plan must cover every unmet score component and contain:

- baseline score and target score;
- ordered findings and proposed improvements;
- expected score delta for each improvement;
- exact changed paths and owner;
- acceptance criteria for the next full audit;
- any hard owner/tool blocker.

No improvement may be applied without an improvement plan. If the score is already 100, write an empty `NOT_REQUIRED` plan so the evidence shape remains stable.

### D7. Apply the improvement plan

The implementation executor applies safe local actions from the plan without routine user intervention. There is no maximum iteration count. P3 findings that are in scope also contribute to the score and cannot be silently report-only.

Authority changes, new packages or routes, external actions, and scope expansion remain behind their existing owner gates.

### D8. Re-audit and rescore

After every improvement change, including an uncommitted working-tree change, rebind the candidate and repeat D0 through D5. Record the new score, score delta, changed paths, and recheck evidence. If the score remains below 100, return to D6 and write the next improvement plan.

If the score cannot advance because a required browser, source, owner action, or genuine design decision is unavailable, record the exact hard blocker and `NOT_RUN_BLOCKED`. This is the only non-100 terminal path.

### D9. Close at 100

Close only when the score is exactly `100/100`, every in-scope finding is resolved, all required viewports, states, accessibility checks, and evidence bindings are current, and no hard blocker remains. A below-target `FAIL` is non-terminal and must not be handed off as complete.

## Evidence contract

Store audit artifacts under `.omo/evidence/design-audit/<audit-id>/` when the operating leader has designated that evidence path. The minimum set is:

- `audit-manifest.json`
- `mengto-recommendation.json`
- `contract-matrix.json`
- `scorecard.json`
- `improvement-plan.json`
- `loop-ledger.json`
- browser captures or a named `NOT_RUN_BLOCKED` record
- `findings.json`
- `verdict.json`

Each artifact must carry the exact `head_sha` and `tree_sha`. The report must distinguish:

- `MATCH`: source and observed surface agree
- `DEVIATION`: observed surface differs from an applicable source contract
- `OMISSION`: required state or behavior is absent
- `UNVERIFIED`: evidence is insufficient

`loop-ledger.json` contains one entry for every iteration. Each entry records the iteration number, baseline score, target score, improvement-plan ID, applied changes, resulting score, score delta, recheck verdict, exact candidate identity, and next loop state. A missing ledger entry invalidates `PASS`.

The design gate uses `PASS`, `FAIL`, or `NOT_RUN_BLOCKED`. `PASS` is valid only with `score=100`; below-target `FAIL` is non-terminal; `NOT_RUN_BLOCKED` is reserved for a named hard owner/tool blocker.

## Handoff and escalation

The audit lane sends an improvement plan for every score below 100. The implementation lane returns the new candidate identity, changed paths, applied plan ID, and actual score delta before full re-audit. A finding that requires an authority change, new dependency, public route, external action, or scope expansion is not silently fixed; it is recorded as a hard blocker and remains non-PASS until resolved.

The audit lane must not use `gstack:design-review` as an automatic fixer. That skill belongs only in an explicitly approved implementation/fix lane.

## Closeout rule

The design audit is complete only when the current candidate scores exactly `100/100`, no in-scope finding remains unresolved, all required viewports and accessibility checks are proven, every improvement has a subsequent full recheck, and no `NOT_RUN_BLOCKED` condition remains for the applicable F3/final gate.
