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
- Automatically fix safe local P0-P2 findings inside the assigned bounded slice, without asking the user for routine approval. Re-audit after each fix and stop after two non-converging cycles.
- Treat mockup-only, fixture-only, stale-HEAD, or browser-unavailable evidence as non-PASS. Use `NOT_RUN_BLOCKED` when the required browser or route capability is unavailable.
- After any visual or route-affecting change, invalidate prior design evidence and rebind the new candidate before closing the slice.
- Keep authority changes, new packages/routes, external actions, secrets, migrations, deploy, push, merge, sharing, paid resources, destructive operations, and scope expansion behind their existing explicit gates.

## Forbidden shortcuts

- Do not invoke `gstack:design-review` as an automatic fixer in the audit lane.
- Do not replace the repository font, token system, motion policy, gradients, surfaces, or information architecture solely because a generic design skill suggests it.
- Do not report visual `PASS` from a screenshot, deterministic mockup, fixture, or static inspection without real-surface evidence when the contract requires a browser.
- Do not reuse evidence from another `HEAD` or tree.

## Required terminal report

Every completed slice reports the exact candidate identity, MengTo pack, findings with `MATCH | DEVIATION | OMISSION | UNVERIFIED`, gate verdict `PASS | FAIL | NOT_RUN_BLOCKED`, evidence paths, fixes applied, and any owner-gated blocker.
