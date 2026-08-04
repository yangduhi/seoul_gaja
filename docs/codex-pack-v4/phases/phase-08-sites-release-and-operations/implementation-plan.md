# Phase 08 — Sites Release and Operations Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 검증된 exact candidate를 ChatGPT Sites에 안전하게 공유하고 GitHub Actions production 수집과 rollback을 확인한다.

**Architecture:** Save version과 preview를 먼저 사용한다. 가족 피드백 후 사용자 승인으로 Deploy한다. production domain·secret·ingest URL을 등록한 뒤 scheduler smoke를 수행한다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 08.

## Files

- Create: `docs/runbook/release.md`
- Create: `docs/runbook/scheduler.md`
- Create: `docs/runbook/rollback.md`
- Create: `docs/runbook/family-sharing.md`
- Create: `docs/evidence/phase-08/release-receipt.json`
- Modify: GitHub Actions production secrets
- Modify: Kakao JavaScript SDK domains

---


### Task 1: Release preparation

- [ ] Confirm Phase 07 PASS and exact commit/tree.
- [ ] Confirm previous Sites version is saved for rollback.
- [ ] Confirm production secret names without printing values.
- [ ] Confirm selected storage migration is applied.

### Task 2: Save version and private/family preview

- [ ] Save a Sites version without replacing the current live version.
- [ ] Test owner preview.
- [ ] Share with 1–2 family testers using the narrowest available audience.
- [ ] Record usability feedback and classify blocker/non-blocker.
- [ ] Apply fixes through a new exact candidate and rerun affected tests.

### Task 3: Production domains and access

- [ ] Register final Sites domain in Kakao JavaScript SDK domain settings.
- [ ] Set public env and server secrets in Sites.
- [ ] Choose `selected users` when supported and practical; otherwise use public link.
- [ ] Add noindex/nofollow and public-link boundary copy.

### Task 4: Deploy with approval

- [ ] Obtain explicit user approval.
- [ ] Deploy the saved and reviewed version.
- [ ] Open the URL in an incognito browser.
- [ ] Test home, search, detail, share, map failure fallback, and dark mode.

### Task 5: Production scheduler smoke

- [ ] Set GitHub secrets `SITE_INGEST_URL`, `SITE_INGEST_TOKEN`, and Seoul key.
- [ ] Manually trigger live collection.
- [ ] Verify snapshot time changes and no duplicate rows appear.
- [ ] Manually trigger hourly materialization in dry-run or safe mode.
- [ ] Confirm next scheduled run appears in Actions.

### Task 6: Runbook and rollback

- [ ] Document how to rotate token, change interval, inspect health, and re-enable a disabled schedule.
- [ ] Document Sites version rollback.
- [ ] Document Kakao domain update after URL change.
- [ ] Record production URL, deployment time, commit/tree, saved version ID, and workflow run IDs.


## Required Commands

```bash
pnpm test
pnpm exec playwright test tests/e2e/production-smoke.spec.ts
# Sites Save version / Deploy are performed through the product UI after approval.
gh workflow run collect-seoul-crowd-live --ref main
```

## Completion

- Produce `docs/evidence/phase-08/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
