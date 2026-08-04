# Phase 01 — Data Source Foundation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Use test-first changes, small reviewable commits, and stop at the Phase gate.

**Goal:** 공식 121개 장소 카탈로그와 서울시 API parser·normalizer를 fail-closed 방식으로 구현하고 실제 quota·latency를 측정한다.

**Architecture:** 수집기와 UI가 공유하는 순수 domain model을 먼저 만든다. 원본 fixture를 SHA-256으로 고정하고 parser는 malformed row를 거부한다. live probe는 최소 요청으로 quota와 응답시간만 확인한다.

**Tech Stack:** Sites-selected JavaScript/TypeScript starter, TypeScript strict when supported, D1 binding `DB`, Python 3.11 collector, starter-compatible test runner, Playwright or equivalent, GitHub Actions.

## Global Constraints

- Read `00_overview/01_global_contracts.md`, `contracts/*`, and `design/design.md` first.
- Do not expose secrets or precise location.
- Do not fabricate population, forecast, missing history, or recommendation inputs.
- Do not deploy, change public access, activate paid APIs, or push without approval.
- Execute only Phase 01.

## Files

- Create: `data/seoul-places.json`
- Create: `data/source-registry.json`
- Create: `collector/domain/models.py`
- Create: `collector/source/seoul_api.py`
- Create: `collector/source/normalize.py`
- Create: `collector/fixtures/*.json`
- Create: `collector/tests/test_catalog.py`
- Create: `collector/tests/test_normalize.py`
- Create: `collector/tests/test_forecast.py`
- Create: `collector/tests/test_quota_probe.py`
- Create: `src/domain/contracts.ts`

---


### Task 1: Official catalog

- [ ] Acquire the official area list and store source URL, fetched time, raw SHA-256, and parser version.
- [ ] Build `data/seoul-places.json` with exactly 121 unique `areaCode` and `areaName` values.
- [ ] Add tests for exact count, unique identities, finite coordinates when present, and stable sorting.
- [ ] Reject fallback IDs based on hashes or row positions.

### Task 2: Current observation parser

**Produces:** `normalize_current(raw: Mapping[str, Any], fetchedAt: datetime) -> CurrentObservation`.

- [ ] Write failing tests for valid, missing, malformed, negative range, reversed range, unknown crowd text, and identity mismatch cases.
- [ ] Implement strict parsing into `populationMin`, `populationMax`, `crowdLevel`, `sourceUpdatedAt`, and provenance.
- [ ] Preserve missing as null; never substitute zero.
- [ ] Hash the exact raw response bytes used for parsing.

### Task 3: Official forecast parser

**Produces:** `normalize_forecast(raw: Mapping[str, Any], now: datetime) -> list[ForecastPoint]`.

- [ ] Test `FCST_YN=Y`, future-only, duplicate time, invalid range, unknown level, and fewer-than-six-point cases.
- [ ] Sort valid points by time.
- [ ] Do not interpolate, extrapolate, smooth, or synthesize values.

### Task 4: Integrated section parsers

- [ ] Add independent parsers for parking, road, bike, incident, event, weather, and disaster sections.
- [ ] Make each section return `available | empty | unavailable` independently.
- [ ] Test that one malformed section does not fabricate empty values for other sections.

### Task 5: Quota and latency probe

- [ ] Use the real key for a bounded sample of official places.
- [ ] Measure p50/p95 latency, timeout rate, response size, and documented/observed quota headers or errors.
- [ ] Calculate daily request counts for 15, 30, and 60 minutes.
- [ ] Select `COLLECT_INTERVAL_MINUTES` without exceeding the approved quota.
- [ ] Do not retry 4xx or quota errors as transient failures.

### Task 6: Shared contract generation

- [ ] Mirror Python domain enums and field names in `src/domain/contracts.ts`.
- [ ] Add fixture compatibility tests between collector JSON and TypeScript schema.
- [ ] Record parser and catalog versions in source registry.


## Required Commands

```bash
python -m pytest collector/tests/test_catalog.py -q
python -m pytest collector/tests/test_normalize.py collector/tests/test_forecast.py -q
python -m pytest collector/tests -q
pnpm test -- contracts
python -m collector.cli quota-probe --sample-size 3
```

## Completion

- Produce `docs/evidence/phase-01/phase-receipt.json` matching the schema.
- Include commit, tree, commands and exit codes, screenshots where relevant, blockers, and limitations.
- Stop after returning the terminal receipt.
