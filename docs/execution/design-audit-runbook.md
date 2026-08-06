# Seoul Gaja v4.1 Autonomous Design Audit Runbook

## Purpose

This runbook makes design review an automatic part of local UI implementation. The implementation executor may audit and improve a bounded UI slice without waiting for a routine user prompt. It does not authorize secrets, live APIs, migrations, Sites actions, push, merge, sharing, paid resources, or destructive operations.

The machine-readable contract is `docs/execution/contracts/design-audit-contract.json`. It is an additive process contract: the existing authority lock, amendment, approved plan, design tokens, component contracts, and screen specifications remain authoritative.

## Operating invariants

1. Every UI slice is bound to one exact `HEAD`, tree, plan SHA, authority-lock SHA, route, and surface.
2. `mengto-skills` runs before the audit pack is selected. Its scores are recommendations, not design authority.
3. `ui/redesign-existing-projects` is diagnostic-only in this lane. It may identify a fix but may not silently mutate the repository.
4. Routine safe local fixes are autonomous. The executor may resolve P0-P2 findings in the same bounded slice and re-audit without asking the user.
5. A remediation loop is limited to two cycles per slice. If the finding set does not converge, the slice is `FAIL` with an explicit handoff.
6. A browser or target route is required for visual PASS. Mockups, fixtures, and stale screenshots never approve a real-surface design gate.
7. Any commit or integration invalidates evidence from the previous candidate. Re-audit from candidate binding; do not rename stale evidence as current.
8. Owner-controlled gates remain explicit even when the design loop is autonomous.

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

Every finding receives a severity and one of `MATCH`, `DEVIATION`, `OMISSION`, or `UNVERIFIED`. Findings must cite their source contract and candidate-bound evidence.

### D5. Improve autonomously

The implementation executor may fix safe local P0-P2 findings in the assigned slice without user intervention. It must not change authority documents, add packages, add public routes, expand scope, or cross an owner gate as an incidental design fix.

After each fix, re-run the applicable static and browser checks. Stop after two cycles if the finding set does not converge.

### D6. Re-audit and close

After the final local change, rebind the new `HEAD/tree`, rerun MengTo selection if the repository shape changed, and repeat the applicable lifecycle stages. Close only with `PASS` when all required viewports, states, accessibility checks, and evidence bindings are present.

## Evidence contract

Store audit artifacts under `.omo/evidence/design-audit/<audit-id>/` when the operating leader has designated that evidence path. The minimum set is:

- `audit-manifest.json`
- `mengto-recommendation.json`
- `contract-matrix.json`
- browser captures or a named `NOT_RUN_BLOCKED` record
- `findings.json`
- `verdict.json`

Each artifact must carry the exact `head_sha` and `tree_sha`. The report must distinguish:

- `MATCH`: source and observed surface agree
- `DEVIATION`: observed surface differs from an applicable source contract
- `OMISSION`: required state or behavior is absent
- `UNVERIFIED`: evidence is insufficient

The design gate uses `PASS`, `FAIL`, or `NOT_RUN_BLOCKED`. No other status is a release approval.

## Handoff and escalation

The audit lane sends bounded findings to the implementation lane. The implementation lane returns the new candidate identity and changed paths before re-audit. A finding that requires an authority change, new dependency, public route, external action, or scope expansion is not silently fixed; it is recorded with the existing owner gate and remains non-PASS until resolved.

The audit lane must not use `gstack:design-review` as an automatic fixer. That skill belongs only in an explicitly approved implementation/fix lane.

## Closeout rule

The design audit is complete only when there are no unresolved P0/P1 findings, required P2 fixes have converged or been explicitly deferred, all required viewports and accessibility checks are proven on the current candidate, and no `NOT_RUN_BLOCKED` condition remains for the applicable F3/final gate.
