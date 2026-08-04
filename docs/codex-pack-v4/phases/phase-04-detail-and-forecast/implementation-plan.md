# Phase 04 — Detail and Official Forecast Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 장소 상세, 공식 12시간 예측, 방문시각 요약, 생활정보, 길찾기·공유를 구현한다.

**Architecture:** detail은 cache-first same-origin API에서 section별 상태를 반환한다. forecast와 better-time은 공식 point만 사용한다. 한 section 장애가 전체 detail을 실패시키지 않는다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 04.

## Files

- Create: `src/server/routes/api/v1/place-detail.ts`
- Create: `src/domain/forecast.ts`
- Create: `src/domain/better-time.ts`
- Create: `src/ui/detail/PlaceDetailSheet.tsx`
- Create: `src/ui/detail/ForecastChart.tsx`
- Create: `src/ui/detail/CityMetricGrid.tsx`
- Create: `src/ui/detail/ExternalMapLinks.tsx`
- Create: `src/ui/detail/ShareButton.tsx`
- Test: `tests/unit/better-time.test.ts`
- Test: `tests/e2e/place-detail.spec.ts`

---


### Task 1: Detail API and section state

- [ ] Test official area code validation and unknown-place 404.
- [ ] Return current observation, valid official forecast, and independent section states.
- [ ] Use cache TTL per section; never label missing data as zero.
- [ ] Preserve source and fetched timestamps.

### Task 2: Better-time algorithm

**Interface:** `findBetterTime(current, forecast) -> BetterTimeResult`.

- [ ] Rank crowd levels deterministically.
- [ ] Require two consecutive lower-rank official points.
- [ ] Return unavailable when current is unknown/expired or fewer than six valid points exist.
- [ ] Test midnight crossing and duplicate-time rejection.

### Task 3: Forecast chart

- [ ] Plot only supplied official points.
- [ ] Do not use smoothing that changes y values.
- [ ] Provide text/table alternative for accessibility.
- [ ] Hide chart with an explicit state when points are insufficient.

### Task 4: Mobile sheet and desktop drawer

- [ ] Follow mockup 02 and desktop detail hierarchy.
- [ ] Implement focus trap, Escape close, and focus restoration.
- [ ] Keep current range and source time above the fold.
- [ ] Show section-level unavailable cards without global failure.

### Task 5: Navigation and sharing

- [ ] Build Kakao and Naver map links from official place coordinates/name.
- [ ] Add share URL with official `areaCode`, not precise user coordinates.
- [ ] Use Web Share API with clipboard fallback.
- [ ] Add family-public-link boundary copy in settings/help.

### Task 6: Browser evidence

- [ ] Test available, carried-forward, expired, partial-section, and insufficient-forecast fixtures.
- [ ] Capture 430×932 detail and 1616×923 drawer screenshots.


## Required Commands

```bash
pnpm test -- better-time forecast
pnpm test -- place-detail
pnpm exec playwright test tests/e2e/place-detail.spec.ts
pnpm build
```

## Completion

- Produce `docs/evidence/phase-04/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
