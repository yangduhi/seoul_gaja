---
description: Autonomous design audit contract for every UI implementation slice
alwaysApply: true
---

# Autonomous design audit rule

This project rule applies to every UI, frontend, responsive, accessibility, visual-token, route-surface, or component implementation change.

The governing contract is `docs/execution/contracts/design-audit-contract.json` and the operating procedure is `docs/execution/design-audit-runbook.md`. Read both before starting a UI slice.

## Mandatory behavior

- Bind the slice to the exact `HEAD`, `HEAD^{tree}`, plan SHA, authority-lock SHA, route, surface, and changed paths.
- Classify the target as `RENDERED_UI`, `NON_RENDERING_FRONTEND`, or `SERVER_ONLY`. Bind `head_sha`, `head_tree_sha`, `plan_sha256`, `authority_lock_sha256`, and `worktree_snapshot_sha256`; never include audit outputs in the snapshot.
- Run `mengto-skills` before selecting the audit lenses. Record the recommendation output with the audit evidence.
- Use `ui/redesign-existing-projects` only as a read-only diagnostic checklist. Use the approved structural lenses, `codex/playwright`, and `codex/audit-verify-explain-grade-5` as defined by the contract.
- Read the existing execution and design authority before proposing a change. MengTo or generic aesthetic guidance never overrides tokens, component contracts, screen specs, or owner gates.
- Audit the real route at `390x844`, `430x932`, `768x1024`, and `1616x923` when the surface is available. Check responsive geometry, Korean CJK wrapping, interaction states, keyboard/focus, `aria-live`, reduced motion, chart alternatives, 44px targets, and unclipped primary actions.
- Run the ten-component design scorecard after every audit. The target is exactly `100/100`; any lower score is `BELOW_TARGET` and can never be reported as `PASS`.
- Score each component from atomic, source-anchored checks with explicit applicability, acceptance criteria, observation method, and evidence ID. Unresolved P0/P1 findings cap the gate below PASS regardless of numeric score.
- When the score is below 100, create `improvement-plan.json` before changing code. The plan must cover every unmet component, expected score delta, changed paths, acceptance criteria, and blockers.
- Automatically apply safe local improvements inside the assigned bounded slice without asking the user for routine approval. There is no cycle-count limit. Rebind and run the full audit after every improvement, including uncommitted working-tree changes, and continue until 100 or a named hard owner/tool blocker.
- Every iteration must increase score, close a finding, add required evidence, or create a typed blocker/design-decision packet. This is a progress invariant, not a cycle limit. Never repeat a no-op plan silently.
- P3 findings that are in scope contribute to the score and are not report-only. A below-target `FAIL` is non-terminal; do not hand it off as complete.
- Treat mockup-only, fixture-only, stale-HEAD, or browser-unavailable evidence as non-PASS. Use `NOT_RUN_BLOCKED` when the required browser or route capability is unavailable.
- Use `NOT_APPLICABLE` only for `NON_RENDERING_FRONTEND` or `SERVER_ONLY` slices. Such a receipt never approves a rendered UI.
- After any visual or route-affecting change, invalidate prior design evidence and rebind the new candidate before closing the slice.
- Run `python docs/execution/scripts/validate_design_audit.py --audit-dir <audit-dir>` before closing an audit. F3 uses `python docs/execution/scripts/validate_design_audit.py --active --audit-root .omo/evidence/design-audit`.
- Keep authority changes, new packages/routes, external actions, secrets, migrations, deploy, push, merge, sharing, paid resources, destructive operations, and scope expansion behind their existing explicit gates.

## Forbidden shortcuts

- Do not invoke `gstack:design-review` as an automatic fixer in the audit lane.
- Do not replace the repository font, token system, motion policy, gradients, surfaces, or information architecture solely because a generic design skill suggests it.
- Do not report visual `PASS` from a screenshot, deterministic mockup, fixture, or static inspection without real-surface evidence when the contract requires a browser.
- Do not reuse evidence from another `HEAD` or tree.
- Do not use legacy `tree_sha`, `changes_applied`, or `score` loop fields. The canonical fields are `head_tree_sha`, `applied_changes`, and `score_after`.

## Required terminal report

Every completed loop iteration reports the exact candidate identity, snapshot hash, target class, MengTo pack, baseline score, current score, score delta, improvement-plan ID, findings with `MATCH | DEVIATION | OMISSION | UNVERIFIED`, loop state, gate verdict `PASS | FAIL | NOT_RUN_BLOCKED | NOT_APPLICABLE`, evidence paths, fixes applied, and any typed hard owner/tool/design-decision blocker. `PASS` requires score `100/100`, real-surface capture/matrix evidence, and a full recheck ledger.
