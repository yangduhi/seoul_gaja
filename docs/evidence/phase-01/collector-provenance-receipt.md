# Collector provenance receipt evidence

## Candidate binding

- Branch: `codex/realdata-provenance-receipt`
- Required base: `2c4d4f6fb2cd25385edce729d6f26df42f99d3ab`
- Required base tree: `d74ab9d301ead723305ba1792fa42b3cd13d18a4`
- Candidate commit/tree: the single commit carrying this self-contained report; the terminal DoneClaim records the exact `git rev-parse HEAD` and `git rev-parse HEAD^{tree}` because a tracked file cannot contain its own Git object ID.
- Scope classification: `SERVER_ONLY` / data-producing CLI. Rendered UI design audit is `NOT_APPLICABLE`.
- Sensitive values: none. All fixture workflow IDs and tokens are explicitly local/redacted test values.

## Result

`PASS`: the official collector payload now embeds immutable `provenanceReceipt` metadata derived from GitHub run identity, collector/parser/catalog versions, the 121 raw-response hashes, per-place outcomes, official source timestamps, fetch timestamps, and accepted time. `server/provenance-cadence.mjs` and `server/ingest-snapshot-request.mjs` were not changed or weakened.

The existing `payloadSha256` is still computed at the same point over the pre-receipt snapshot. Canonical ingest independently recomputes `canonical_payload_sha256` over the canonical payload after removing `provenanceReceipt`.

## Failing first

- Scenario: deterministic 121-row collector output enters the real `handleIngestSnapshot` policy seam before producer changes.
- Invocation: `node --test tests/gates/collector-provenance-receipt.test.mjs`
- Binary observable: two failures, including `422 !== 202`; malformed provenance remained rejected.
- Artifact: `docs/evidence/phase-01/collector-provenance-receipt-artifacts/red-policy-seam.log`

## Green verification

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Collector receipt accepted by the actual ingest/D1 seam; missing/malformed timestamps and hashes reject; caller hash cannot override recomputation | `node --test tests/gates/collector-provenance-receipt.test.mjs` | exit `0`, `5 passed`, repeated twice | `collector-provenance-receipt-artifacts/focused-js-pass-1.log`, `collector-provenance-receipt-artifacts/focused-js-pass-2.log` |
| Collector catalog/normalization/source suite | `python -m pytest collector/tests -q` | exit `0`, `13 passed`, repeated twice | `collector-provenance-receipt-artifacts/focused-python-pass-1.log`, `collector-provenance-receipt-artifacts/focused-python-pass-2.log` |
| Existing strict provenance and immutable D1 policy | `node --test tests/gates/task-08-happy.test.mjs tests/gates/task-08-failure.test.mjs` | exit `0`, `20 passed` | `collector-provenance-receipt-artifacts/existing-provenance-seam.log` |
| Python syntax/import bytecode gate | `python -m compileall -q collector` | exit `0` | `collector-provenance-receipt-artifacts/compileall.log` |
| Python no-excuse rules | `python .../check-no-excuse-rules.py collector/cli.py collector/tests/fixture_snapshot.py` | exit `0`, `no violations in 2 file(s)` | `collector-provenance-receipt-artifacts/python-rules.log` |
| Authority lock | `python docs/execution/scripts/validate_authority_lock.py` | exit `0`, `PASS` on required base | `collector-provenance-receipt-artifacts/authority-lock.log` |
| Command-map validation | `python docs/execution/scripts/validate_command_map.py docs/execution/contracts/execution-command-map.json` | exit `0`, `30 command entries validated` | `collector-provenance-receipt-artifacts/command-map.log` |
| Whitespace and secret hygiene | `git diff --check`; high-confidence secret regex scan of changed source/test paths | exits `0`; `secret_scan_matches=0` | `collector-provenance-receipt-artifacts/git-diff-check.log`, `collector-provenance-receipt-artifacts/secret-scan.log` |

Full TypeScript/frontend build was `NOT_RUN_SCOPE`: no TypeScript, application, route, UI, dependency, or build configuration changed. This is not claimed as a full-build pass.

## Manual QA

- Scenario: invoke the real collector builder through `python -m collector.tests.fixture_snapshot` with a deterministic local official-shaped CITYDATA adapter, serialize and parse both files, then submit the exact snapshot to `handleIngestSnapshot` with the existing in-memory D1 implementation.
- Invocation: `node tests/gates/collector-provenance-manual.mjs`
- Binary observable: exit `0`; ingest HTTP `202` / `accepted`; 121 rows and 121 unique identities; 121 source and fetch times; one persisted receipt; two source bindings; audit and payload hash equality; zero forbidden keys.
- Observed redacted hashes: `payload_sha256=524f63bf03c91a06824e257bc7d56b37200cbacb9b6e06f63066f24a48b7323e`, `canonical_payload_sha256=8e71640e19ff41802b3cb7bb8d5fe74f552cba0e221c0419e505e303de93b94b`, `raw_response_sha256=a5c42d262228b623c36c546599cc56c08b0f589b3c58be777bddc96c44cf600c`.
- Artifact: `collector-provenance-receipt-artifacts/manual-qa.log`.

## UltraQA

| Probe | Verdict | Observable/evidence |
| --- | --- | --- |
| `malformed_input` | `PASS` | Missing receipt, invalid raw hash, and invalid fetch timestamp each return HTTP `422` / `invalid_provenance`; focused JS logs. |
| `stale_state` | `PASS` | Invalid timestamp rejects; a misleading caller hash is ignored and canonical content is rehashed; existing stale retention fixture rejects; focused JS and existing provenance logs. |
| `dirty_worktree` | `PASS` | Base started clean at required SHA/tree; terminal DoneClaim records final clean status. |
| `hung_or_long_commands` | `PASS` | Collector subprocess is bounded at 30 seconds; all focused commands completed in seconds. |
| `flaky_tests` | `PASS` | Focused JS and Python suites each passed twice with identical counts. |
| `misleading_success_output` | `PASS` | Tests call the actual `handleIngestSnapshot` and verify HTTP status, D1 receipt count, source bindings, and independently recomputed canonical hash. |
| `repeated_interruptions` | `PASS` | Zero task-owned interruptions and zero residual task processes/listeners/temp paths. |
| `prompt_injection` | `NOT_APPLICABLE` | The collector receipt has no prompt or natural-language instruction boundary; the adjacent existing policy fixture still rejects forbidden prompt-injection-shaped provenance. |
| `cancel_resume` | `NOT_APPLICABLE` | No cancellation/resume trigger exists in this bounded synchronous collector change. |

## Cleanup receipt

- `task_owned_background_processes=0`
- `task_owned_listeners=0`
- `task_owned_temp_residue_count=0`
- Generated `collector/**/__pycache__` paths are removed before terminal status.
- Artifact: `collector-provenance-receipt-artifacts/cleanup-receipt.log`.

## DoneClaim

- Verdict: `PASS`
- Scope: only `collector/**`, narrowly related collector/ingest tests, and this phase evidence.
- Preserved: exact 121 official identities, official catalog/source metadata, pre-receipt `payloadSha256` behavior, strict server receipt validation, current crowd/time-only product boundary, token redaction, and family-sharing removal.
- External actions: no secret, `.env`, live Seoul API, Sites/D1, workflow mutation, migration, push, deploy, or merge was used.
- Terminal commit/tree and clean-status proof: returned by the member after creating the one bounded local commit.
