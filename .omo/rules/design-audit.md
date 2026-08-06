---
description: Autonomous design audit contract for every UI implementation slice
alwaysApply: true
---

# Autonomous design audit rule

This project rule applies to every UI, frontend, responsive, accessibility, visual-token, route-surface, or component implementation change.

The governing contract is `docs/execution/contracts/design-audit-contract.json` and the operating procedure is `docs/execution/design-audit-runbook.md`. Read both before starting a UI slice.

## Mandatory behavior

- Bind the slice to the exact `HEAD`, tree, plan SHA, authority-lock SHA, route, surface, and changed paths.
- Run `mengto-skills` before selecting the audit lenses. Record the recommendation output with the audit evidence.
- Use `ui/redesign-existing-projects` only as a read-only diagnostic checklist. Use the approved structural lenses, `codex/playwright`, and `codex/audit-verify-explain-grade-5` as defined by the contract.
- Read the existing execution and design authority before proposing a change. MengTo or generic aesthetic guidance never overrides tokens, component contracts, screen specs, or owner gates.
- Audit the real route at `390x844`, `430x932`, `768x1024`, and `1616x923` when the surface is available. Check responsive geometry, Korean CJK wrapping, interaction states, keyboard/focus, `aria-live`, reduced motion, chart alternatives, 44px targets, and unclipped primary actions.
- Run the ten-component design scorecard after every audit. The target is exactly `100/100`; any lower score is `BELOW_TARGET` and can never be reported as `PASS`.
- When the score is below 100, create `improvement-plan.json` before changing code. The plan must cover every unmet component, expected score delta, changed paths, acceptance criteria, and blockers.
- Automatically apply safe local improvements inside the assigned bounded slice without asking the user for routine approval. There is no cycle-count limit. Rebind and run the full audit after every improvement, including uncommitted working-tree changes, and continue until 100 or a named hard owner/tool blocker.
- P3 findings that are in scope contribute to the score and are not report-only. A below-target `FAIL` is non-terminal; do not hand it off as complete.
- Treat mockup-only, fixture-only, stale-HEAD, or browser-unavailable evidence as non-PASS. Use `NOT_RUN_BLOCKED` when the required browser or route capability is unavailable.
- After any visual or route-affecting change, invalidate prior design evidence and rebind the new candidate before closing the slice.
- Keep authority changes, new packages/routes, external actions, secrets, migrations, deploy, push, merge, sharing, paid resources, destructive operations, and scope expansion behind their existing explicit gates.

## Forbidden shortcuts

- Do not invoke `gstack:design-review` as an automatic fixer in the audit lane.
- Do not replace the repository font, token system, motion policy, gradients, surfaces, or information architecture solely because a generic design skill suggests it.
- Do not report visual `PASS` from a screenshot, deterministic mockup, fixture, or static inspection without real-surface evidence when the contract requires a browser.
- Do not reuse evidence from another `HEAD` or tree.

## Required terminal report

Every completed loop iteration reports the exact candidate identity, MengTo pack, baseline score, current score, score delta, improvement-plan ID, findings with `MATCH | DEVIATION | OMISSION | UNVERIFIED`, loop state, gate verdict `PASS | FAIL | NOT_RUN_BLOCKED`, evidence paths, fixes applied, and any hard owner/tool blocker. `PASS` requires score `100/100` and a full recheck ledger.
