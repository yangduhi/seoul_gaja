# Codex Start Here — ChatGPT Sites Only

## Repository

- Repository: `yangduhi/seoul_gaja`
- Default branch: `main`
- Current planning branch: `plan/chatgpt-sites-only-v1`
- Product hosting/deployment: **ChatGPT Sites only**

## First assignment: Phase 00 capability proof

Do not build the product UI yet. Prove the runtime contract first from a clean branch named `codex/phase-00-sites-capability`.

### Required proof

1. Clone this repository and inspect `AGENTS.md`, `docs/architecture.md`, `docs/owner-prerequisites.md`, `docs/phase-plan.md`, and `design/design.md`.
2. In the latest ChatGPT desktop app, open the local repository as a compatible existing project and ask Sites to prepare it without deploying.
3. Generate or adapt the Sites-recommended local starter. Follow the starter selected by Sites; do not impose an unsupported framework.
4. Ask Sites to provision one D1 binding named `DB`. Do not request R2.
5. Confirm that `.openai/hosting.json` is generated or updated by Sites and contains no secret values.
6. Add hosted secrets in Site Settings, using temporary test values only:
   - `SITE_INGEST_TOKEN`
   - `SEOUL_OPEN_DATA_KEY`
7. Implement the smallest server-side health route and D1 probe supported by the generated starter.
8. Implement a temporary protected ingest probe that accepts one synthetic JSON record only when the bearer token matches.
9. Save a version without deploying and record the Git commit associated with the saved version.
10. Deploy only after explicit owner approval. From GitHub Actions or a local curl command, POST the synthetic record to the deployed probe and verify that it can be read back from D1.
11. Remove or disable the temporary probe before Phase 01 unless it is converted into the production contract.

### Required evidence

Create `evidence/phase-00/receipt.json` containing at least:

```json
{
  "phase": "00",
  "verdict": "PASS | FAIL | NOT_RUN_BLOCKED",
  "commit_sha": "<40 hex>",
  "tree_sha": "<40 hex>",
  "site_project_id_present": true,
  "d1_binding": "DB",
  "r2_binding": null,
  "hosted_secrets_read_server_side": true,
  "saved_version_commit_bound": true,
  "external_ingest_probe": "PASS | FAIL | NOT_RUN_BLOCKED",
  "deployment_url_redacted": false,
  "browser_console_errors": [],
  "cleanup_complete": true
}
```

Also include commands, exit codes, browser screenshots, response-body hashes, and redacted headers. Never include actual secret values.

### Gate

Phase 00 is `PASS` only when D1, hosted secrets, a compatible server-side route, exact-commit Save version, and an externally callable protected ingest route are all proven. Otherwise stop with `NOT_RUN_BLOCKED` or `FAIL`. Do not add Vercel or another database as a fallback.

## After Phase 00

Proceed one phase at a time using `docs/phase-plan.md`. Do not automatically merge, deploy, or start the next phase.
