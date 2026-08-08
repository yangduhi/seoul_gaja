# Phase 02 — Automation and Storage Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** idempotent snapshot 저장, 현재 조회, history 누적, GitHub Actions 정기 수집을 구현한다.

**Architecture:** ChatGPT Sites D1에 versioned migrations와 명시적 repository interface를 적용한다. GitHub Actions collector가 normalized 121-row payload를 internal ingest API로 전송한다. DB transaction은 current snapshot과 raw history를 함께 갱신한다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 02.

## Files

- Create: `migrations/0001_catalog_and_snapshot.sql`
- Create: `migrations/0002_history.sql`
- Create: `src/server/storage/adapter.ts`
- Create: `src/server/storage/d1-adapter.ts`
- Create: `src/server/routes/internal/ingest-snapshot.ts`
- Create: `src/server/routes/api/v1/snapshot.ts`
- Create: `collector/cli.py`
- Create: `collector/push.py`
- Create: `.github/workflows/collect-live.yml`
- Create: `.github/workflows/materialize-hourly.yml`
- Create: `.github/workflows/daily-maintenance.yml`
- Test: `tests/integration/ingest-snapshot.test.ts`
- Test: `tests/integration/history-materialization.test.ts`

---


### Task 1: Migrations and repository adapter

- [ ] Translate `contracts/storage-schema.sql` into versioned D1 migrations.
- [ ] Add migration tests on a clean database and repeated migration run.
- [ ] Define `StorageAdapter` interfaces for catalog, ingest, snapshot read, raw append, hourly materialize, retention, and health.
- [ ] Keep D1-specific persistence behind one repository interface for testability; do not add another backend.

### Task 2: Bearer-token internal ingest

- [ ] Write tests for missing token, wrong token, oversized payload, invalid JSON, invalid row count, duplicate area code, and hash mismatch.
- [ ] Implement POST-only endpoint with constant response shape and no secret echo.
- [ ] Validate exactly 121 rows and count reconciliation.
- [ ] Use `snapshotId` unique constraint for idempotency.
- [ ] Return the existing receipt for an identical replay and 409 for same ID with different payload hash.

### Task 3: Transactional active snapshot

- [ ] Test that a failed transaction preserves the previous active snapshot.
- [ ] Upsert valid rows, select non-expired prior values for failed rows, and mark others unavailable.
- [ ] Store current snapshot and raw 15-minute observations in one transaction.
- [ ] Verify population and forecast are hidden after 180 minutes.

### Task 4: Collector CLI

- [ ] Implement bounded concurrency, timeout, one retry for timeout/5xx only, and stable catalog order.
- [ ] Produce normalized snapshot JSON and non-secret receipt.
- [ ] Compute payload SHA-256 from canonical serialized bytes.
- [ ] Implement push with Bearer token from environment only.
- [ ] Test partial failures and retry boundaries.

### Task 5: GitHub Actions

- [ ] Copy and adapt templates after collector tests pass.
- [ ] Keep `permissions: contents: read`.
- [ ] Add concurrency groups and non-zero cron minutes.
- [ ] Run `workflow_dispatch` dry run with a test endpoint.
- [ ] Verify logs contain no URL path with key, token, or raw payload.

### Task 6: History materialization and retention

- [ ] Materialize all missing completed hours, not only the most recent scheduled hour.
- [ ] Use median and explicit missing counts.
- [ ] Implement raw 7-day, hourly 90-day, daily 730-day retention.
- [ ] Verify current snapshot and profiles survive retention.
- [ ] Add job receipts and health thresholds.


## Required Commands

```bash
pnpm test -- ingest-snapshot
pnpm test -- history-materialization
python -m pytest collector/tests -q
pnpm test
pnpm build
gh workflow run collect-seoul-crowd-live --ref main
```

## Completion

- Produce `docs/evidence/phase-02/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
