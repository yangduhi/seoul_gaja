# Phase 07 Acceptance Contract — Quality Gate

## PASS Conditions


- all contract, unit, integration, E2E, visual, and chaos tests pass.
- no secret or precise location is found in source/build/evidence.
- no browser console/page errors or horizontal overflow in required flows.
- initial UI uses one snapshot application-data request.
- exact commit/tree and artifact hashes are recorded.
- any unavailable live verification is clearly blocked rather than assumed.


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
PHASE: 07
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-07/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 08 or none
```
