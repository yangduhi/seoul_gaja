# Phase 04 Acceptance Contract — Detail and Official Forecast

## PASS Conditions


- detail shows population range, source time, and section states truthfully.
- better-time uses two consecutive lower official points and no interpolation.
- expired current hides forecast and better-time.
- one malformed city section does not erase valid sections.
- share URL contains official place identity only.
- mockup 02 hierarchy is visually represented.


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
PHASE: 04
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewport/routes/errors/screenshots or n/a
EVIDENCE: docs/evidence/phase-04/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 05 or none
```
