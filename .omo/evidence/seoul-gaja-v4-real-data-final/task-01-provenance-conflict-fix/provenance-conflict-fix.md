# Task 01 — provenance conflict atomicity fix

Classification: `SERVER_ONLY`
Status: `NOT_RUN_BLOCKED` only for cleanup platform control; all code and local behavior gates below passed.

## Bound source and scope

- Branch: `codex/realdata-provenance-conflict-fix`
- Exact base HEAD: `eb839d65869fe938ce5887aa07a0c3e7a967d112`
- Exact base tree: `bc35d8e126dc35a478ff003ede8414d24cda1ace`
- Changed product paths: `server/ingest-snapshot-request.mjs`, `server/provenance-cadence.mjs`
- Direct test support: `tests/gates/task-08-d1-mock.mjs`
- Regression: `tests/gates/provenance-conflict-atomicity.test.mjs`
- Observed source hashes before the evidence commit:
  - `server/ingest-snapshot-request.mjs`: `aa95e16540f57fe675183cd0018aa0476f5cb809448613b6658abb91e111c4bc`
  - `server/provenance-cadence.mjs`: `3613f67c2f14584d39c05f35a727c2e56e9e259c86556cad98c7f0c1c7f7d96c`
  - `tests/gates/task-08-d1-mock.mjs`: `24fc6653fa96b1df0e4d7610e05fa10a54a84b10534301de0838b10c6f60ea05`
  - `tests/gates/provenance-conflict-atomicity.test.mjs`: `8e933841e62979c03276111feab389349842eb1e7d6f6585c7a87d3c8c2953ac`

The exact post-commit HEAD/tree is emitted in the terminal handoff. This avoids an evidence-only amend loop while committing this direct evidence with the fix and regression.

## Root cause and fix

The handler persisted a new immutable receipt, then checked each derived source binding in separate awaits. A stale/replayed snapshot with a new receipt ID therefore returned `409 provenance_conflict` only after the new receipt had committed.

`persistProvenanceReceiptAndBindings` now performs immutable receipt and source-binding conflict guards before the writes in one D1 `batch`. The guards intentionally touch only mismatched immutable rows, causing the existing immutable triggers to abort the batch; D1 batch rollback leaves no rejected receipt or binding. Existing post-batch readback preserves strict receipt and binding validation.

## RED and GREEN

- RED command: `node --test tests/gates/provenance-conflict-atomicity.test.mjs`
- RED exit: `1`
- RED observation: the handler returned the expected conflict, but the receipt-count assertion failed with `2 !== 1`.
- GREEN command: `node --test tests/gates/provenance-conflict-atomicity.test.mjs`
- GREEN exit: `0` (`1` passing test, `0` failures).

## Manual handler seam

The real `handleIngestSnapshot` path was driven with a fresh in-memory D1 adapter. The sanitized observable was:

```json
{"first":202,"second":409,"receipts_after_second":1,"bindings_after_second":1,"physical_source_binding_rows_after_second":2,"rejected_receipt_present":false,"valid_follow_up":202,"receipts_after_follow_up":2,"bindings_after_follow_up":2,"physical_source_binding_rows_after_follow_up":4}
```

`bindings_after_second` is the logical snapshot binding group count; the two physical immutable rows are the required `materialization` and `profile` bindings. A separate SQLite in-memory trigger check produced `sqlite_guard_conflict=true`, `receipts_after_rollback=1`, and `bindings_after_rollback=1`.

## Focused gates and scope review

- Focused server/provenance/collector/security command passed: `32` tests, `0` failures.
- `npm run lint`: exit `0`.
- `npm run build`: exit `0`; canonical ingest route included.
- Authority lock: `PASS` on the bound base HEAD/tree.
- Command map: `PASS: 30 command entries validated`.
- `git diff --check`: exit `0` before evidence staging.
- Diff review found only the two server persistence paths, the direct D1 test adapter, the behavior regression, and this task evidence. No collector, workflow, Sites, GitHub, secret, live API, migration, or production-store path changed.

## UltraQA

| Probe | Result |
| --- | --- |
| malformed provenance | `422`, zero receipts, zero bindings |
| stale/replay conflict | first `202`, repeated conflicts `409`, one receipt and two physical bindings remain |
| immutable receipt mutation | `409`, one receipt and two physical bindings remain |
| misleading success | an initial manual tally was rejected because it sampled after follow-up; the retained observation snapshots state immediately after the conflict |
| bounded long command | regression child completed in `433 ms`, under the `30000 ms` limit, exit `0` |
| flaky repeat | `10/10` regression repetitions passed |
| prompt injection | not applicable: no prompt/LLM surface in changed server paths |
| cancel/resume | not applicable: no cancel/resume surface in changed handler path |
| repeated interruption | two sequential conflicts both returned `409` with no rejected receipt |
| secret scan | zero changed files matched credential-shaped patterns |

## Cleanup receipt and no-live-mutation statement

No external API, live D1, Sites, GitHub, secret, credential, deployment, push, merge, migration execution, or production data mutation occurred. No owned process or debug port remains.

Cleanup is `NOT_RUN_BLOCKED`: after a read-only literal-path inventory and containment verification, the platform rejected the one `Remove-Item` command before the shell began. No alternate deletion was attempted. The exact remaining task-owned local paths are:

- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\node_modules`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\collector\__pycache__`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\collector\domain\__pycache__`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\collector\source\__pycache__`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\collector\tests\__pycache__`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\dist`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\.wrangler`
- `D:\vscode\seoul_gaja-worktrees\realdata-provenance-conflict-fix\.realdata-provenance-conflict-fix.debug-journal.md`
