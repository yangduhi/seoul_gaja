# seoul_gaja v4.1 Execution Contract

## Authority order

1. `.omo/authority-lock.json` and its exact SHA bindings.
2. `docs/execution/AMENDMENT-v4.1.md`.
3. `.omo/plans/seoul-gaja-v4-plan-review.md` at the SHA recorded in the lock.
4. `docs/codex-pack-v4/contracts/*` and `00_overview/01_global_contracts.md`.
5. The current Todo's acceptance contract and work order.

The copied v4.0.0 packet is audit evidence. Where it conflicts with the amendment or approved plan, it is superseded. A human summary cannot silently override this order.

## Lifecycle gate

- Read `.omo/IMPLEMENTATION_READINESS.json` before any edit.
- While `implementation_allowed` is `false`, perform preparation, inventory, verification, thread orchestration, and documentation only. Do not implement product behavior.
- A separate user implementation approval changes this gate. After that approval, the operating leader may advance safe local Todos and Waves, create isolated worktrees, make local `codex/*` commits, and integrate the local candidate without asking again between them.
- Never infer approval for secrets, live API calls, migration execution, push/merge, Sites Save/Deploy, sharing/access changes, paid resources, or destructive operations. Those remain explicit owner gates.

## Operating leader

- The main operating task is the only leader. It owns plan SHA, current integration HEAD/tree, dependency release, dispatch, verification, integration, and owner-gate requests.
- In team mode the leader does not edit product code. Each code change belongs to one bounded member thread and one worktree.
- Keep at most three implementation members active. Create only members whose dependencies are satisfied; archive completed members and disband the team after F1-F4.
- If Codex App team tools are unavailable before initialization, do not fake `.omo/teams` state. Use visible plain subagents only for independent read-only checks, or continue serially in an isolated worktree after implementation approval while reporting `THREAD_TOOL_UNAVAILABLE`.

## Member contract

- Verify the assigned cwd is a real Git checkout/worktree before editing.
- Read this file, `.omo/OPERATIONS_RUNBOOK.md`, the approved plan, and the assigned Todo.
- Own only the named Todo/files. Do not revert user or peer changes.
- Start with the Todo's failing gate, then implement the minimum change, run happy/failure QA, and write the named evidence.
- Report `WORKING`, `BLOCKED`, and terminal `PASS | FAIL | NOT_RUN_BLOCKED` with exact commit/tree, commands, results, evidence paths, and blockers.
- Never treat packet-validator, fixture, screenshot, or mockup PASS as semantic/live capability PASS.

## Product and platform boundaries

- ChatGPT Sites is the only application host/runtime/deployment surface; Sites D1 binding `DB` is the only production structured store.
- GitHub is source/review/automation, not application hosting. GitHub Actions never deploys the Site or changes sharing.
- Recommendations use only current crowd, official forecast, and eligible history exactly as amended. Never fabricate or silently renormalize unsupported inputs.
- Secret values exist only in approved Sites settings or protected GitHub Environments and never in prompts, source, logs, screenshots, fixtures, receipts, or `.openai/hosting.json`.

## Git and evidence

- Do not modify `main` directly. Use isolated `codex/*` branches/worktrees.
- Before implementation approval, keep preparation uncommitted. That approval authorizes local commits and local candidate integration only on isolated `codex/*` branches. It never authorizes push, PR publication, merge to the default/protected branch, rebase/force operations, deploy, or deletion.
- Every integration changes the candidate HEAD and invalidates downstream evidence bound to an older HEAD.
- Final success requires F1-F4 to approve the same exact HEAD. Any `FAIL` or `NOT_RUN_BLOCKED` stops release.
