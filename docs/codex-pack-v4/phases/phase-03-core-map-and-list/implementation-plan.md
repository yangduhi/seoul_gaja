# Phase 03 — Core Map and List Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 단일 snapshot read로 121개 장소 지도·목록·검색·필터·정렬·내 주변 기능을 구현한다.

**Architecture:** client query는 `/api/v1/snapshot` 한 번으로 초기 상태를 만든다. 지도와 목록은 동일 normalized store를 공유한다. Kakao SDK가 실패해도 목록 중심 앱은 유지된다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 03.

## Files

- Create: `src/client/api/snapshot.ts`
- Create: `src/client/state/explorer-store.ts`
- Create: `src/ui/map/CrowdMap.tsx`
- Create: `src/ui/map/CrowdMarker.tsx`
- Create: `src/ui/explorer/PlaceSearch.tsx`
- Create: `src/ui/explorer/CrowdFilter.tsx`
- Create: `src/ui/explorer/PlaceList.tsx`
- Create: `src/ui/explorer/NearMeButton.tsx`
- Create: `src/ui/shell/MobileHome.tsx`
- Create: `src/ui/shell/DesktopWorkspace.tsx`
- Test: `tests/e2e/core-explorer.spec.ts`

---


### Task 1: Snapshot client and store

- [ ] Test exact mapping of 121 rows and meta counts.
- [ ] Implement one initial application-data request.
- [ ] Preserve unavailable rows so official place identity remains searchable.
- [ ] Add deterministic selectors for search, crowd filter, alphabetical, crowded, relaxed, and distance sorting.

### Task 2: Official place search

- [ ] Implement normalized Korean text search over official names and aliases.
- [ ] Add clear, no-result, keyboard navigation, and Escape behavior.
- [ ] Keep official-name search when Kakao address search is disabled.

### Task 3: Map and marker

- [ ] Load Kakao SDK only after public key and registered domain are available.
- [ ] Render marker state from the shared store.
- [ ] Synchronize map marker and list selection.
- [ ] Implement selected marker emphasis without altering crowd color truth.
- [ ] Add map-load timeout and list-only fallback.

### Task 4: List and filter

- [ ] Build `PlaceListItem` from the design contract.
- [ ] Show range, crowd label, distance when available, and freshness warning.
- [ ] Add virtualized or bounded rendering if performance measurement requires it.
- [ ] Ensure unavailable rows are visibly unavailable, not omitted by default.

### Task 5: Near me

- [ ] Request geolocation only after button click.
- [ ] Compute distance in browser memory.
- [ ] Do not store or transmit coordinates.
- [ ] Handle granted, denied, timeout, and unsupported states.

### Task 6: Responsive shells

- [ ] Implement mobile home from mockup 01.
- [ ] Implement desktop three-pane layout from mockup 05.
- [ ] Verify no page-level horizontal overflow at all reference viewports.
- [ ] Add E2E tests for map ready and map unavailable flows.


## Required Commands

```bash
pnpm test -- explorer-store
pnpm test -- PlaceSearch CrowdFilter PlaceList NearMeButton
pnpm exec playwright test tests/e2e/core-explorer.spec.ts
pnpm build
```

## Completion

- Produce `docs/evidence/phase-03/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
