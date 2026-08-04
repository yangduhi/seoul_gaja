# Phase 00 Acceptance Contract — ChatGPT Sites Capability Proof

## PASS Conditions

All must be directly verified in the owner account:

- local `yangduhi/seoul_gaja` project is accepted as a compatible Sites project;
- `.openai/hosting.json` is provisioned by Sites and contains no secret;
- a supported server route executes;
- D1 binding `DB` passes write/read/update/transaction rollback/cleanup;
- hosted `SITE_INGEST_TOKEN` is server-readable and absent client-side;
- Save version is associated with the exact reviewed Git commit;
- at least one practical family sharing mode is available;
- after explicit owner deployment approval, an external protected synthetic POST reaches the Site and is read back from D1;
- all synthetic data is removed and temporary exposure is disabled or converted;
- browser evidence has no unhandled console/page/request/overflow errors.

## Automatic FAIL

- secret value in source, prompt, log, screenshot, fixture or receipt;
- fabricated capability evidence;
- hand-created or guessed Sites `project_id`;
- product implementation beyond the phase;
- reference-site code/asset/copy/branding duplication;
- unapproved Deploy, sharing change, custom domain, paid API activation or Git push;
- unresolved required test failure.

## NOT_RUN_BLOCKED

Use when any required Sites/account capability is unavailable or the owner has not approved the external deployment probe. State the exact missing feature/action. Do not introduce another host or database.

## Terminal Output

```text
PHASE: 00
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: commands and results
BROWSER: viewports/routes/errors/screenshots
SITES: capability matrix
EVIDENCE: docs/evidence/phase-00/phase-receipt.json
BLOCKERS: none or exact blockers
NEXT_ALLOWED_PHASE: 01 or none
```
