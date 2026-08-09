# Todo 1 stop-hook verification

Verdict: `PASS`

## Directly verified candidate

- Product commit: `7f9738cb5013a252bbccf42d7efaeef470e018ab`
- Product tree: `299d893af339ee41055c986e0b61bb7751c1310e`
- Branch: `codex/realdata-provenance-receipt`
- Commit count from required base: `1`
- Verification occurred before this evidence-only amendment. The amendment changes only `.omo/evidence/**`; product source and tests remain byte-identical.

## Executed scenarios

| Scenario | Invocation | Observed result | Captured output |
| --- | --- | --- | --- |
| Collector payload through actual strict ingest policy | `node --test tests/gates/collector-provenance-receipt.test.mjs` | exit `0`; 5 passed, 0 failed | `task-01-stop-hook-artifacts/collector-policy.log` |
| Focused Python collector suite | `python -m pytest collector/tests -q` | exit `0`; 13 passed | `task-01-stop-hook-artifacts/collector-python.log` |
| Existing strict provenance/D1 suite | `node --test tests/gates/task-08-happy.test.mjs tests/gates/task-08-failure.test.mjs` | exit `0`; 20 passed, 0 failed | `task-01-stop-hook-artifacts/existing-policy.log` |
| Data-shaped manual QA | `node tests/gates/collector-provenance-manual.mjs` | exit `0`; HTTP 202 accepted; 121 rows/identities/source times/fetch times; 1 receipt; 2 bindings; 0 forbidden keys | `task-01-stop-hook-artifacts/manual-qa.log` |
| Collector bytecode compilation | `python -m compileall -q collector` | exit `0` | `task-01-stop-hook-artifacts/compileall.log` |
| Authority lock | `python docs/execution/scripts/validate_authority_lock.py` | exit `0`; `PASS` at verified product SHA/tree | `task-01-stop-hook-artifacts/authority.log` |
| Command map | `python docs/execution/scripts/validate_command_map.py docs/execution/contracts/execution-command-map.json` | exit `0`; 30 entries validated | `task-01-stop-hook-artifacts/command-map.log` |
| Python rule audit | `python .../check-no-excuse-rules.py collector/cli.py collector/tests/fixture_snapshot.py` | exit `0`; no violations | `task-01-stop-hook-artifacts/python-rules.log` |
| Diff and secret hygiene | `git diff HEAD --check`; high-confidence secret regex over changed source/test paths | exits `0`; zero secret matches | `task-01-stop-hook-artifacts/diff-check.log`, `task-01-stop-hook-artifacts/secret-scan.log` |
| Cleanup | cache/temp/process/listener inspection | all zero | `task-01-stop-hook-artifacts/cleanup.log` |

## Manual-QA observables

- `ingest_status=202`
- `ingest_result=accepted`
- `row_count=121`, `identity_count=121`
- `source_time_count=121`, `fetch_time_count=121`
- `persisted_receipt_count=1`, `source_binding_count=2`
- `forbidden_key_count=0`
- `audit_payload_hash_matches=true`
- `canonical_payload_sha256=8e71640e19ff41802b3cb7bb8d5fe74f552cba0e221c0419e505e303de93b94b`

No live Seoul API, secret, `.env`, Sites/D1, workflow mutation, migration, push, deploy, or merge was used.
