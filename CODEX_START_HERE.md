# Codex Start Here — ChatGPT Sites Only

## Repository

- Repository: `yangduhi/seoul_gaja`
- Default branch: `main`
- Planning branch: `plan/chatgpt-sites-only-v1`
- Recommended local clone: `D:\vscode\seoul_gaja`
- Product hosting/deployment: **ChatGPT Sites only**

## First assignment: Phase 00 capability proof

Do not build the product UI or the live collector yet. Prove the runtime contract first from a clean branch named `codex/phase-00-sites-capability`.

### Required proof

1. Clone this repository and inventory the branch, commit, tree, lockfile, local tool versions, existing files, and all applicable `AGENTS.md` rules.
2. Read `contracts/platform-boundary.yaml`, `AGENTS.md`, `docs/architecture.md`, `docs/owner-prerequisites.md`, `docs/phase-plan.md`, and `design/design.md`.
3. In the latest ChatGPT desktop app, open the local repository as a compatible existing project and ask Sites to prepare it **without deploying**.
4. Generate or adapt the starter recommended by Sites. Do not impose a framework that the Sites runtime does not support.
5. Ask Sites to provision one D1 binding named `DB`. Do not request R2.
6. Confirm that Sites generates or updates `.openai/hosting.json`. Do not invent a `project_id`, and do not place secrets in this file.
7. Add one temporary hosted secret in Site Settings: `SITE_INGEST_TOKEN`. Use a disposable test value and never record the value in source, prompts, screenshots, logs, or evidence.
8. Implement the smallest supported server-side health route and D1 round-trip probe.
9. Implement a temporary protected ingest probe that accepts one synthetic JSON record only when the bearer token matches.
10. Save a version without deploying and record the exact Git commit associated with the saved version.
11. Record the sharing modes visible in the owner’s actual Sites account. Do not change access yet.
12. Only after explicit owner approval, deploy the temporary probe. From a local command or a manually triggered GitHub Action, POST the synthetic record and verify that it can be read back from D1.
13. Remove the synthetic row and disable or convert the temporary route before Phase 01.

`SEOUL_OPEN_DATA_KEY` is not required in ChatGPT Sites during Phase 00. The production architecture keeps that key in GitHub Actions because the collector fetches and validates the Seoul source before sending normalized records to the Site.

### Required evidence

Create `docs/evidence/phase-00/receipt.json` containing at least:

```json
{
  "phase": "00",
  "verdict": "PASS | FAIL | NOT_RUN_BLOCKED",
  "commit_sha": "<40 hex or null>",
  "tree_sha": "<40 hex or null>",
  "site_project_id_present": true,
  "d1_binding": "DB",
  "r2_binding": null,
  "hosted_secret_server_read": "PASS | FAIL | NOT_RUN_BLOCKED",
  "saved_version_commit_bound": "PASS | FAIL | NOT_RUN_BLOCKED",
  "external_ingest_probe": "PASS | FAIL | NOT_RUN_BLOCKED",
  "available_sharing_modes": [],
  "browser_console_errors": [],
  "page_errors": [],
  "request_errors": [],
  "cleanup_complete": true
}
```

Also include:

- commands and exit codes;
- response-body hashes;
- redacted request/response headers;
- desktop and mobile screenshots where relevant;
- the generated `.openai/hosting.json` with any account-specific identifier treated as project metadata, not a secret;
- exact blockers and the owner action needed to unblock them.

Never include actual secret values.

### Gate

Phase 00 is `PASS` only when all of the following are directly proven in the owner account:

- compatible local-project linkage;
- a supported server-side route;
- D1 write/read/rollback behavior;
- hosted-secret server access with no client exposure;
- exact-commit Save version binding;
- externally callable protected ingest after an approved deployment;
- at least one usable family sharing mode.

Otherwise stop with `FAIL` or `NOT_RUN_BLOCKED`. Do not add Vercel, Supabase, Firebase, another database, or another application host as a fallback.

## After Phase 00

Proceed one phase at a time using `docs/phase-plan.md`. Each phase uses its own branch, tests, evidence, pull request, and explicit approval. Do not automatically merge, deploy, change sharing, or start the next phase.
