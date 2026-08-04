# Phase 05 Acceptance Contract — History and Family Presets

## PASS Conditions


- maturity requires both elapsed days and coverage.
- missing history remains missing.
- heatmap includes sample count and maturity label.
- recommendation scoring is deterministic and explainable.
- history never changes official current or forecast values.
- mockup 03 and 04 information hierarchy is present.


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
PHASE: 05
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-05/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 06 or none
```
