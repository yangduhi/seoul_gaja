# Phase 06 Acceptance Contract — Calm Glass Design

## PASS Conditions


- code tokens exactly match design-tokens.json.
- only three glass depths are used.
- reference screens preserve the documented hierarchy and geometry.
- dark mode text is readable and heatmap states are distinguishable.
- reduced motion and focus behavior pass.
- no horizontal overflow at reference viewports.


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
PHASE: 06
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-06/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 07 or none
```
