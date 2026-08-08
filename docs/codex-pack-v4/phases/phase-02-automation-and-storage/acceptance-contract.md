# Phase 02 Acceptance Contract — Automation and Storage

## PASS Conditions


- valid 121-row payload activates one snapshot transactionally.
- identical replay is idempotent; conflicting replay is rejected.
- previous snapshot survives invalid payload and transaction failure.
- GitHub Actions manual run reaches the non-production test ingest endpoint.
- hourly materialization and retention are idempotent.
- public snapshot endpoint never calls the Seoul API.


## Automatic FAIL

- fabricated or interpolated population/forecast/history values
- secret or precise user location in source, bundle, log, screenshot, or receipt
- executing next-Phase scope without approval
- public Deploy or access change without approval
- claiming live capability from fixture-only evidence
- copying reference-site code, assets, brand, or text
- unresolved required test failure

## NOT_RUN_BLOCKED

Use only when an external account, API key, quota, Sites feature, or production URL is unavailable despite the implementation and fixture tests being complete. State the exact missing input and the command or UI action required to unblock it.

## Terminal Output

```text
PHASE: 02
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-02/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 03 or none
```
