# Phase 06 — Calm Glass Design Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** Design Pack의 token·component·responsive 계약을 제품 전체에 적용하고 light/dark 시각 기준을 완성한다.

**Architecture:** design tokens를 CSS variables와 typed theme으로 생성한다. primitive component를 먼저 고정한 뒤 screen을 맞춘다. screenshot parity는 정보구조와 geometry를 검증하며 pixel-perfect Apple 복제를 목표로 하지 않는다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 06.

## Files

- Create: `src/styles/tokens.css`
- Create: `src/styles/theme.ts`
- Create: `src/ui/primitives/GlassPanel.tsx`
- Create: `src/ui/primitives/Pill.tsx`
- Create: `src/ui/primitives/IconButton.tsx`
- Create: `src/ui/primitives/BottomNavigation.tsx`
- Create: `src/ui/primitives/BottomSheet.tsx`
- Create: `tests/visual/*.spec.ts`
- Create: `docs/evidence/phase-06/screenshots/`

---


### Task 1: Token generation

- [ ] Parse `design/design-tokens.json` in a build-time script.
- [ ] Generate CSS variables and typed TypeScript token exports.
- [ ] Test exact token parity and fail on unknown token names.
- [ ] Prevent arbitrary new colors/radii in component CSS without change request.

### Task 2: Glass primitives

- [ ] Implement floating, content, and strong depth only.
- [ ] Add opaque fallback when backdrop-filter is unavailable.
- [ ] Verify body text contrast in light and dark mode.
- [ ] Add consistent shadow and border recipes.

### Task 3: Interaction primitives

- [ ] Implement 44px IconButton, pill, segmented control, bottom navigation, and sheet.
- [ ] Add visible focus, keyboard, Escape, and focus restoration.
- [ ] Test `prefers-reduced-motion`.

### Task 4: Screen alignment

- [ ] Align home map to mockup 01.
- [ ] Align detail to mockup 02.
- [ ] Align family recommendations to mockup 03.
- [ ] Align history dark mode to mockup 04.
- [ ] Align desktop workspace to mockup 05.
- [ ] Preserve real-data states even where mockup shows sample values.

### Task 5: Responsive and dark mode

- [ ] Test 390×844, 430×932, 768×1024, and 1616×923.
- [ ] Ensure desktop has 390px explorer, flexible map, 410px detail at reference viewport.
- [ ] Make system theme default with user override stored locally.
- [ ] Verify no fixed element covers actionable content.

### Task 6: Visual receipts

- [ ] Capture screenshots for all five references and major failure states.
- [ ] Record viewport, route, fixture, browser errors, and image SHA-256.
- [ ] Run design review checklist and fix all blockers.


## Required Commands

```bash
pnpm test -- tokens primitives
pnpm exec playwright test tests/visual
pnpm exec playwright test tests/e2e --project=chromium
pnpm build
```

## Completion

- Produce `docs/evidence/phase-06/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
