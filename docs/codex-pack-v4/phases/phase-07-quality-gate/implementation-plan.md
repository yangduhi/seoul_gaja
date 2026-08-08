# Phase 07 — Quality Gate Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 데이터·자동화·UI·접근성·성능·보안의 최종 출시 전 검증을 수행한다.

**Architecture:** contract, unit, integration, E2E, visual, chaos를 분리해 실행하고 exact commit/tree receipt에 결합한다. fixture와 live smoke를 명확히 구분한다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 07.

## Files

- Create: `tests/contract/`
- Create: `tests/chaos/`
- Create: `tests/security/`
- Create: `tests/performance/`
- Create: `scripts/secret_scan.py`
- Create: `scripts/check_bundle.py`
- Create: `docs/evidence/phase-07/browser-ledger.json`
- Create: `docs/evidence/phase-07/phase-receipt.json`

---


### Task 1: Full contract suite

- [ ] Validate catalog, API, storage, schedule, maturity, recommendation, and UI contracts.
- [ ] Verify Python and TypeScript enum parity.
- [ ] Verify database constraints reject invalid population ranges and duplicate IDs.

### Task 2: Chaos scenarios

- [ ] Seoul timeout for 30% of places.
- [ ] malformed one-place response.
- [ ] full upstream outage.
- [ ] Kakao SDK failure.
- [ ] delayed GitHub Actions run.
- [ ] duplicate ingest replay.
- [ ] DB transaction failure.
- [ ] expired current snapshot.

Each scenario must preserve truthful UI and previous valid state where applicable.

### Task 3: Security and privacy

- [ ] Scan repository, build output, logs, screenshots, and receipts for key patterns.
- [ ] Confirm public routes cannot write.
- [ ] Confirm internal route rejects absent/wrong token.
- [ ] Confirm precise coordinates never appear in server requests or DB.
- [ ] Confirm no third-party analytics script exists.

### Task 4: Accessibility

- [ ] Automated axe or equivalent checks.
- [ ] Keyboard-only map/list/detail flow.
- [ ] focus trap and restoration.
- [ ] chart text alternative.
- [ ] color-independent crowd state.
- [ ] reduced motion and forced-colors sanity.

### Task 5: Performance

- [ ] Measure first snapshot payload and render time.
- [ ] Verify one initial application-data request.
- [ ] Check 121 markers/list rows without long tasks that block interaction.
- [ ] Check map fallback before timeout budget.
- [ ] Record desktop and mobile metrics without promising fixed public-beta limits.

### Task 6: Exact candidate receipt

- [ ] Run clean build and all tests from the candidate commit.
- [ ] Record commit/tree and fully accounted worktree.
- [ ] Hash screenshots, build output manifest, and command log.
- [ ] Mark live-only unverified items `NOT_RUN_BLOCKED`.


## Required Commands

```bash
pnpm test
python -m pytest collector/tests -q
pnpm exec playwright test
python scripts/secret_scan.py .
pnpm build
python scripts/check_bundle.py dist
```

## Completion

- Produce `docs/evidence/phase-07/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
