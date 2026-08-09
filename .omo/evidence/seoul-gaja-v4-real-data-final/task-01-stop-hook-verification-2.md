# Todo 1 stop-hook verification 2

Verdict: `PASS`

This is a fresh verification run, not a copy of the first stop-hook evidence.

## Exact verified candidate

- Commit: `ba19c0e69268259073fe3cd80e6476858335d709`
- Tree: `9da4646cc7a8c999a709a149827b1c367ca93f8c`
- Branch: `codex/realdata-provenance-receipt`
- Worktree entries before creating this evidence: `0`
- Commits from required base: `1`

## Direct executions

| Scenario | Result | Output |
| --- | --- | --- |
| `node --test tests/gates/collector-provenance-receipt.test.mjs` | exit 0, 5 passed | `task-01-stop-hook-2-artifacts/collector-policy.log` |
| `python -m pytest collector/tests -q` | exit 0, 13 passed | `task-01-stop-hook-2-artifacts/collector-python.log` |
| `node --test tests/gates/task-08-happy.test.mjs tests/gates/task-08-failure.test.mjs` | exit 0, 20 passed | `task-01-stop-hook-2-artifacts/existing-policy.log` |
| `node tests/gates/collector-provenance-manual.mjs` | exit 0, HTTP 202 accepted, 121 identities/source/fetch times, one receipt, two bindings, zero forbidden keys | `task-01-stop-hook-2-artifacts/manual-qa.log` |
| `python -m compileall -q collector` | exit 0 | `task-01-stop-hook-2-artifacts/compileall.log` |
| Authority-lock validator | PASS at the exact commit/tree above | `task-01-stop-hook-2-artifacts/authority.log` |
| Command-map validator | PASS, 30 entries | `task-01-stop-hook-2-artifacts/command-map.log` |
| Python rule checker | exit 0, no violations | `task-01-stop-hook-2-artifacts/python-rules.log` |
| Diff/secret hygiene | exit 0, zero secret matches | `task-01-stop-hook-2-artifacts/diff-check.log`, `task-01-stop-hook-2-artifacts/secret-scan.log` |
| Cleanup | processes/listeners/cache/temp residue all zero | `task-01-stop-hook-2-artifacts/cleanup.log` |

Manual-QA canonical hash: `8e71640e19ff41802b3cb7bb8d5fe74f552cba0e221c0419e505e303de93b94b`.

No live API, secret, `.env`, external D1, workflow mutation, migration, push, deploy, or merge was used.
