# Phase 00 — ChatGPT Sites Capability Proof Implementation Plan

> **For agentic workers:** Execute only this phase. Use test-first changes, fresh evidence, small commits, and stop at the gate.

**Goal:** Prove that the owner account and a compatible local `yangduhi/seoul_gaja` project support the exact ChatGPT Sites runtime needed by the product.

**Architecture:** Build a disposable capability spike. D1 is mandatory. Missing D1, server routes, hosted secrets, exact-commit Save version, family sharing, or external protected ingest ends as `NOT_RUN_BLOCKED`; no external fallback is introduced.

**Tech Stack:** Use the starter/runtime recommended by Sites, TypeScript strict when supported, D1 binding `DB`, the starter’s test runner, Playwright or equivalent real-browser checks, Git.

## Global Constraints

- Read `contracts/platform-boundary.yaml` first.
- Work from `codex/phase-00-sites-capability`, not directly on `main`.
- Do not build product screens or production collectors.
- Do not provision R2.
- Do not add another host/database.
- Do not Deploy without explicit owner approval.
- Do not expose secret values.

## Files

Exact runtime paths are selected from the Sites starter and documented in the receipt. Expected responsibilities:

- Create: one server health route
- Create: one D1 probe migration/table
- Create: one server-only hosted-secret probe
- Create: one disposable `phase-00-capability-probe` route at `POST /api/internal/capability-probe/ingest`
- Test: unit/contract tests for all probes
- Test: real-browser preview checks
- Create: `docs/adr/0001-chatgpt-sites-runtime.md`
- Create: `docs/adr/0002-family-sharing.md`
- Create: `docs/evidence/phase-00/capability-matrix.yaml`
- Create: `docs/evidence/phase-00/phase-receipt.json`

---

### Task 1: Repository and packet binding

- [ ] Record branch, commit, tree, Git status, files, lockfile, package manager, local tools and existing AGENTS rules.
- [ ] Copy this packet to `docs/codex-pack-v4/` without modifying approved binary assets.
- [ ] Run `python docs/codex-pack-v4/scripts/validate_packet.py docs/codex-pack-v4` and save the output.
- [ ] Create `codex/phase-00-sites-capability`.
- [ ] Ensure local secrets and `docs/evidence/` are not committed unless the repository’s evidence policy explicitly permits redacted receipts.

### Task 2: Existing-project compatibility

- [ ] Open the local Git repository through ChatGPT desktop Sites.
- [ ] Ask Sites to check compatibility and prepare the project without deployment.
- [ ] Use the starter/framework Sites recommends; record all generated/modified files.
- [ ] Confirm Sites creates or updates `.openai/hosting.json`.
- [ ] Verify `project_id` is platform-provisioned and no secrets appear in the file.

### Task 3: Server route and D1

- [ ] Write a failing test for `GET /api/v1/health` with a minimal non-secret response.
- [ ] Implement the smallest supported server route.
- [ ] Request D1 binding `DB` and add one disposable probe table through a migration.
- [ ] Test insert, read, update, transaction rollback and cleanup.
- [ ] Confirm no browser bundle contains D1 credentials or server implementation details that expose secrets.

### Task 4: Hosted secret and protected ingest

- [ ] Add temporary `SITE_INGEST_TOKEN` through Site Settings; never record its value.
- [ ] Write tests for missing, wrong and matching Bearer token.
- [ ] Implement the bounded synthetic JSON `phase-00-capability-probe` route at `POST /api/internal/capability-probe/ingest`.
- [ ] The disposable capability probe is not the production ingest route and cannot prove Phase 02 production behavior; production ingest is exclusively `POST /api/internal/ingest/snapshot`.
- [ ] Verify hosted secret is available server-side and absent client-side.
- [ ] Keep the route inaccessible from a deployment until the owner approves the deployment step.

### Task 5: Version and sharing proof

- [ ] Save a version without deploying.
- [ ] Record the saved version and exact Git commit used for its build.
- [ ] Record available sharing modes without changing access.
- [ ] Test the private preview at required viewports for console/page/request/overflow errors.

### Task 6: Approved external ingest proof

- [ ] Present the candidate evidence and request explicit owner approval to Deploy the disposable capability probe.
- [ ] After approval, Deploy the saved version through ChatGPT web/desktop only.
- [ ] POST one synthetic record from local curl or manually triggered GitHub Action.
- [ ] Read it back from D1, verify response-body hashes, then delete the synthetic row.
- [ ] Disable or remove the disposable `phase-00-capability-probe` route before Phase 01.

### Task 7: Gate and receipt

- [ ] Record exact commands, exit codes, commit/tree, file hashes, browser evidence, redacted HTTP evidence and cleanup.
- [ ] `PASS` only when every required capability is directly proven.
- [ ] Use `NOT_RUN_BLOCKED` for a missing account feature or unapproved deployment step.
- [ ] Use `FAIL` for an implementation/test defect.
- [ ] Stop; do not start Phase 01.

## Required verification

```bash
python docs/codex-pack-v4/scripts/validate_packet.py docs/codex-pack-v4
# plus exact starter-specific test/type/build commands selected by Sites
```

## Completion receipt

```text
PHASE: 00
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: <40-char SHA or null>
TREE: <40-char SHA or null>
TESTS: <commands, exit codes, counts>
BROWSER: <viewports and error ledger>
SITES: <local project, route, D1, secret, version, share, external ingest>
EVIDENCE: docs/evidence/phase-00/phase-receipt.json
BLOCKERS: <none or exact owner/platform action>
NEXT_ALLOWED_PHASE: 01 or none
```
