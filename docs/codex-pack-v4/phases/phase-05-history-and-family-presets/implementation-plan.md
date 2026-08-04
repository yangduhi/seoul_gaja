# Phase 05 — History and Family Presets Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 누적 history의 maturity·요일×시간 profile을 제공하고 설명 가능한 가족 목적 추천을 구현한다.

**Architecture:** raw/hourly data에서 deterministic profile을 계산한다. maturity가 낮으면 history weight를 제한한다. recommendation score는 contract weights와 가용 input coverage로 계산한다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 05.

## Files

- Create: `src/server/history/materialize.ts`
- Create: `src/server/history/profile.ts`
- Create: `src/domain/maturity.ts`
- Create: `src/domain/recommendation.ts`
- Create: `src/server/routes/api/v1/history.ts`
- Create: `src/ui/history/HistoryHeatmap.tsx`
- Create: `src/ui/history/MaturityCard.tsx`
- Create: `src/ui/recommendation/FamilyPresetScreen.tsx`
- Create: `src/ui/recommendation/RecommendationCard.tsx`
- Test: `tests/unit/maturity.test.ts`
- Test: `tests/unit/recommendation.test.ts`
- Test: `tests/e2e/history-and-presets.spec.ts`

---


### Task 1: Hourly and profile computation

- [ ] Test median, IQR, sample count, missing count, and timezone bucket boundaries.
- [ ] Rebuild only from stored observations.
- [ ] Make all materialization idempotent.
- [ ] Do not remove outliers without an explicit tested rule.

### Task 2: Maturity

- [ ] Implement elapsed-day and coverage gates from the contract.
- [ ] Test exact boundaries at 7, 28, and 56 days.
- [ ] Prevent maturity upgrade when coverage is below threshold.
- [ ] Expose human label and history weight.

### Task 3: History API and heatmap

- [ ] Return 7×24 profile cells with null for missing.
- [ ] Show PROVISIONAL warning and sample count.
- [ ] Provide table alternative and tooltip values.
- [ ] Match mockup 04 dark hierarchy.

### Task 4: Recommendation engine

- [ ] Implement preset weight tables from the contract.
- [ ] Renormalize only available weights when total input coverage is at least 60%.
- [ ] Set history contribution to zero below PROVISIONAL.
- [ ] Produce at most three deterministic reasons.
- [ ] Test ties with stable official-name ordering.

### Task 5: Family recommendation UI

- [ ] Build the mockup 03 structure.
- [ ] Show score, crowd, distance, reasons, and maturity.
- [ ] Allow expanding the score breakdown.
- [ ] Use `데이터 축적 중` instead of fabricated confidence.

### Task 6: Quality checks

- [ ] Compare profile output to a reference Python calculation.
- [ ] Test missing days, daylight boundary assumptions, and partial coverage.
- [ ] Verify official forecast values are not overwritten by history.


## Required Commands

```bash
pnpm test -- maturity recommendation history
pnpm exec playwright test tests/e2e/history-and-presets.spec.ts
python -m pytest collector/tests/test_profile_reference.py -q
pnpm build
```

## Completion

- Produce `docs/evidence/phase-05/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
