# Seoul Gaja v4.1 Autonomous Operations Runbook

## Purpose

This runbook lets the operating leader execute the approved v4.1 plan without waiting for a new user prompt between safe local Waves. It does not grant external-action authority.

## Fixed inputs

- Authority repository: `https://github.com/yangduhi/seoul_gaja`
- Default branch: `main`
- Clean base commit: `23b4023870c47e1280f15f4dd5abcce7bcadcbd9`
- Clean base tree: `323a2481592e4351c95f2985e2955a1a9a1d2550`
- Preparation worktree: `D:\vscode\seoul_gaja-worktrees\prep-v4-1`
- Preparation branch: `codex/prep-v4-1`
- Approved plan: `.omo/plans/seoul-gaja-v4-plan-review.md`
- Approved plan SHA-256: `9ec41b95cdcc22c5d8f0135dcb8103d90f00e3610931b54d1c8015a88a0c4849`
- v4.1 amendment: `docs/execution/AMENDMENT-v4.1.md`
- Execution command map: `docs/execution/contracts/execution-command-map.json`
- Audit packet ZIP SHA-256: `af2ea053fe540e62e886ffb107434bc89f370e6242210afa25cc73f24d470e83`
- Audit packet content-root SHA-256: `9d70c004be12e2f5da5685074714bcb48c8dc1bef1560c035d31a4ea99ad34e6`
- Generated design assets: the 4 concept boards and 5 deterministic mockups already under `docs/codex-pack-v4/design/`; all 9 byte/hash pairs match `D:\\vscode\\seoul_gaja\\project_reference\\assets\\generated-concept-images\\INVENTORY.json`. No new input image or image generation is required.
- Starter lockfile SHA-256 after Windows portability setup: `e991413abfdf76b3f95990c11837a3942abca069ced94220ceb9f1d6f6162c1a`

## State machine

1. `PREPARING`: checkout, starter, authority, runbook, and thread topology are prepared. Product behavior is forbidden.
2. `WAITING_IMPLEMENTATION_APPROVAL`: all local preparation checks pass; wait for one explicit implementation approval.
3. `IMPLEMENTING_LOCAL`: after that approval, execute eligible local Todos/Waves autonomously.
4. `WAITING_OWNER_ACTION`: stop only for secrets, live API, migration execution, push/merge, Sites Save/Deploy/share, paid resources, or destructive actions. Name the exact action and resume automatically when supplied.
5. `FINAL_GATES`: run F1-F4 against one exact integrated HEAD.
6. `COMPLETE` only when all four approve; otherwise remain `FAIL` or `NOT_RUN_BLOCKED`.

The operating leader updates `.omo/IMPLEMENTATION_READINESS.json` at every state transition. Never skip a state or rewrite history to make a gate appear green.

## Startup algorithm for every operating turn

1. Verify cwd, Git common dir, branch, `git status --short --branch`, origin URL, default branch, HEAD, and tree.
2. Run `python docs/execution/scripts/validate_authority_lock.py`, then verify the sidecar command map.
3. Read `.omo/IMPLEMENTATION_READINESS.json` and the latest phase/final evidence.
4. If implementation is not approved, perform only preparation/readiness checks and stop at `WAITING_IMPLEMENTATION_APPROVAL`.
5. If approved, select only Todos whose dependencies are satisfied and whose evidence is not already valid for the current HEAD.
6. Dispatch bounded members, verify their work, integrate one result at a time, record the new HEAD/tree, then release the next dependency.
7. Ask the user only for the explicit owner actions listed above. Do not ask for routine local edits, tests, reviews, or progression between already approved Waves.

## Team transport and current roster

Preferred transport is native MultiAgentV2 when the complete flat tool set exists. Otherwise use Codex App threads only when create/read/send/title/archive tools all work. Transport is immutable after team initialization.

Current pre-implementation members:

| ID | Name | Lens | Focus | Deliverable |
| --- | --- | --- | --- | --- |
| A | `authority-bootstrap` | ownership | Todo 1 authority, checkout inventory, command map, v4.1 hash binding | Todo 1 happy/failure evidence and `READY` or exact blocker |
| B | `readiness-gate` | perspective | Read-only audit of checkout, starter, authority, command map, scope, and baseline | `APPROVE | FAIL | NOT_RUN_BLOCKED` bound to exact branch HEAD/tree |

Do not create Wave 2 implementation members until A reports PASS, B approves the same HEAD, and implementation approval is recorded.

If the complete thread transport is unavailable, record `THREAD_TOOL_UNAVAILABLE`; do not hand-write `.omo/teams`. Plain subagents may audit A/B independently but are not durable team-member substitutes.

### Standing thread-bootstrap authority

The user's current setup request is standing authority to create and bind the pre-implementation `authority-bootstrap` and `readiness-gate` tasks; do not ask for that permission again. At the start of a later operating turn, while no team has been initialized and readiness still records `THREAD_TOOL_UNAVAILABLE`, probe the complete durable-task tool surface once. If it works, immediately create A and B against this exact preparation checkout, pass the fixed inputs and stop conditions above, record their task/host IDs in readiness, and continue orchestration. If it still fails, retain `THREAD_TOOL_UNAVAILABLE` without fabricating state or repeatedly probing in the same turn. Transport becomes immutable after successful initialization.

This standing authority does not approve product implementation or any owner-action gate. Before implementation approval, A may only refresh checkout/authority evidence and B remains read-only. After implementation approval, a still-unavailable durable transport selects the documented serial isolated-worktree fallback without another routing question.

## Wave dispatch after implementation approval

- Wave 1: Todo 1, serial. A completes; B audits.
- Wave 2: Todo 2 and Todo 3, up to two worktree members.
- Wave 3: Todo 4, Todo 5, Todo 6, up to three worktree members.
- Wave 4a: Todo 7 and Todo 8. Freeze schema ownership first; integrate Todo 7 before Todo 8 if files overlap.
- Wave 4b: Todo 9, serial.
- Wave 5: Todo 10 and Todo 11 in parallel only after a file-ownership scan proves disjoint writes; otherwise execute serially.
- Wave 6: Todo 12, serial closeout.
- Final: independent read-only F1-F4 against the same exact integrated HEAD.

## Worktree and integration protocol

- Use one branch/worktree per implementation member. Never let two members edit the same checkout.
- Member bootstrap includes exact cwd, base HEAD/tree, plan SHA, Todo number, owned paths, forbidden actions, acceptance, QA, evidence, and stop condition.
- A member result is integration-eligible only when its branch is clean, changed paths match ownership, focused checks pass, failure fixtures fail closed, and evidence names exact commit/tree.
- Integrate serially. After every integration, rerun the narrow integration gate and update candidate HEAD/tree. Do not reuse evidence bound to an older HEAD.
- Before implementation approval, keep preparation uncommitted. The separate implementation approval is standing authority for local commits and local candidate integration/cherry-pick on isolated `codex/*` branches so Waves can proceed without another routine prompt. It does not authorize push, PR publication, merge to the default/protected branch, rebase, force operations, or deletion.

## Owner-action gates

Always stop and request explicit authority before:

- entering or rotating any secret value;
- calling live Seoul/Kakao/Sites ingest APIs;
- executing a D1 migration or production backfill;
- Git push, PR publication, or merge to the default/protected branch;
- Sites Save version, Deploy, sharing/access/domain change;
- paid resource activation or destructive cleanup.

When blocked, record the exact missing action, the command/UI operation that would resume the gate, and `NEXT_ALLOWED_PHASE: none`. Resume from the same evidence ledger after the owner action; do not restart completed local work.

## Verification and closeout

- Baseline commands are taken from the checked-in `package.json` and lockfile; invoke the sidecar runner at `docs/execution/scripts/run_command_map.py` and never invent a runner.
- Structural packet validation remains separate from semantic, browser, Sites, and live capability gates.
- Product UI work requires real browser evidence. Mockups and screenshots alone do not approve behavior.
- F1-F4 each record `APPROVE`, `FAIL`, or `NOT_RUN_BLOCKED` plus exact triggers and evidence. Final completion requires four `APPROVE` values on one HEAD.
- Archive member threads and remove worktrees only after their evidence is preserved and integration disposition is known. Delete team state only after successful archival or explicit acceptance of an archival blocker.
