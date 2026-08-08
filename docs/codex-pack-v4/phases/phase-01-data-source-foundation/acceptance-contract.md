# Phase 01 Acceptance Contract — Data Source Foundation

## PASS Conditions


- catalog has exactly 121 unique official identities.
- raw fixtures and source registry include SHA-256 and fetch metadata.
- invalid ranges, malformed timestamps, identity mismatch, and unknown required structures fail closed.
- forecast uses official future points only and exposes no synthetic point.
- live quota/latency result selects 15, 30, or 60 minute interval with evidence.
- no secret appears in fixture, source registry, or command log.


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
PHASE: 01
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-01/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 02 or none
```
