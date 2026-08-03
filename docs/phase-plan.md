# Phased Implementation Plan

> Execute one phase at a time. Each phase ends with a pull request and one terminal verdict: `PASS`, `FAIL`, or `NOT_RUN_BLOCKED`.

## Global goal

Build and operate a family-oriented Seoul crowd decision app using ChatGPT Sites as the only application host, runtime, database, deployment, and sharing surface. GitHub supplies source control, CI, and periodic collection through Actions.

---

## Phase 00 — ChatGPT Sites capability proof

### Goal

Prove the exact Sites runtime needed by the product before building features.

### Work

- Open the local repository as a compatible existing Sites project.
- Use the Sites-recommended starter rather than forcing a framework.
- Provision D1 binding `DB`; do not provision R2.
- Verify hosted environment values and server-only secret access.
- Implement a temporary health route, D1 round-trip, and bearer-protected synthetic ingest route.
- Save a version without deployment and verify its Git commit association.
- With explicit owner approval, deploy the probe and call it from a local command or GitHub Action.
- Inspect the sharing options available to the owner account.

### Gate

`PASS` requires compatible local project linkage, server route, D1, secret access, external ingest, saved-version commit binding, and a usable sharing option. No external hosting/database fallback is allowed.

---

## Phase 01 — Calm Glass design system and application shell

### Goal

Create the visual foundation and responsive shell before data-driven screens expand.

### Work

- Import the approved concept images into `design/references/`.
- Finalize `design/design.md`, `design/tokens.json`, component states, and screen contracts.
- Build the mobile-first shell, desktop shell, navigation, map/list frame, bottom sheet, detail panel, and system light/dark themes.
- Implement reduced-motion, keyboard, focus, contrast, and list-only map fallback foundations.
- Add deterministic fixture screens matching the approved design pack.

### Gate

All reference screens render at agreed mobile and desktop viewports without horizontal overflow. Visual regression baselines, accessibility smoke checks, and design-token validation pass.

---

## Phase 02 — Source contracts, 121-place catalog, and collectors

### Goal

Create authoritative source handling without yet enabling continuous production writes.

### Work

- Bind the official 121-place catalog and prove uniqueness by area code and normalized name.
- Add source response fixtures and hashes.
- Implement fetch, stable-read/hash, decode, parse, normalize, and semantic validation.
- Preserve current population ranges, official congestion enum, source times, and official forecast provenance.
- Define `REFRESHED`, `CARRIED_FORWARD`, and `UNAVAILABLE` records.
- Implement GitHub Actions collector in dry-run and artifact-only modes.
- Measure quota and select 15, 30, or 60-minute schedule.

### Gate

All catalog, parser, malformed-source, stale-source, duplicate, partial-failure, and quota-planning tests pass. No production ingest is enabled.

---

## Phase 03 — Sites D1 ingest and scheduled accumulation

### Goal

Persist current and historical records in ChatGPT Sites D1 through a minimal protected endpoint.

### Work

- Add D1 migrations and migration tests.
- Implement bearer token, body-size, schema, semantic, and idempotency checks.
- Write snapshot generations atomically.
- Add last-known-good carry-forward logic with visible source age.
- Add collection run/result receipts and source body hashes.
- Enable GitHub Actions schedule and `workflow_dispatch` recovery.
- Add hourly, daily, retention, and weekday/time profile jobs.
- Ensure GitHub Actions never deploys the Site and never commits runtime data.

### Gate

A complete synthetic collection and a bounded live collection write to D1, can be read back, are idempotent, and survive one partial place failure without false freshness.

---

## Phase 04 — Home map, list, search, filters, and nearby

### Goal

Deliver the primary family decision screen.

### Work

- Fetch one normalized snapshot from a Sites API route.
- Render all available places on map and synchronized list.
- Add name search, congestion filters, crowd sorting, and explicit geolocation-based distance sorting.
- Keep geolocation in browser memory only.
- Provide map SDK loading/error/quota fallback to a fully usable list view.
- Display source time, fetch time, freshness, and record state.

### Gate

Mobile and desktop browser tests cover map/list synchronization, filters, search, location denial, list-only fallback, stale records, unavailable records, and zero horizontal overflow.

---

## Phase 05 — Place detail, official forecast, and city context

### Goal

Answer “Should our family go now, and when would be better?” without mixing data authorities.

### Work

- Add deep-linked place detail.
- Display official current range and official 12-hour forecast.
- Compute “better time” only from valid official future forecast points and label the rule.
- Add available accident/control, parking, road speed, bicycle, weather, disaster, and culture-event sections.
- Add Kakao/Naver route links without embedding unsupported third-party applications.
- Keep missing sections explicit and independently unavailable.

### Gate

Official current, official forecast, derived guidance, and first-party history have distinct labels and schemas. Missing source sections cannot create a false complete state.

---

## Phase 06 — Historical maturity and family recommendations

### Goal

Use accumulated data to improve recurring-pattern and recommendation confidence while preserving source truth.

### Work

- Implement maturity states: `ACCUMULATING`, `PROVISIONAL`, `STABLE`, `MATURE`.
- Require both elapsed period and valid coverage/sample thresholds.
- Render weekday × time heatmaps and “usual for this time” comparisons.
- Implement deterministic recommendation rules for child outing, date, quiet place, and currently lively place.
- Expose recommendation reasons and confidence inputs.
- Never use history to rewrite official current values or forecasts.

### Gate

Recommendations are deterministic, reproducible from stored inputs, explainable in the UI, and suppressed when maturity or source quality is insufficient.

---

## Phase 07 — Quality, privacy, performance, and failure audit

### Goal

Prove the family release candidate under realistic failures.

### Work

- Run unit, contract, migration, integration, type, lint, build, accessibility, and visual tests.
- Audit client bundles and logs for secrets.
- Test API timeouts, malformed data, stale data, partial 121-place data, D1 errors, map errors, no geolocation, and offline/retry behavior.
- Measure mobile and desktop performance.
- Verify no user location or personal data persists.
- Produce exact commit/tree-bound evidence.

### Gate

No P0/P1 defects, no secret leakage, no false current/forecast state, no critical accessibility issue, and all required viewports pass.

---

## Phase 08 — Save version, family review, deploy, and operations

### Goal

Publish through ChatGPT Sites only and establish a maintainable operating loop.

### Work

- Freeze the reviewed commit and tree.
- Save a version without deploying.
- Review the private candidate against the evidence packet.
- Select the family sharing mode.
- Obtain explicit owner approval.
- Deploy the saved version.
- Verify the production URL using the intended family visitor path.
- Register the deployment domain in Kakao Developers if needed.
- Enable production collection only after the ingest URL and token match the deployed Site.
- Document rollback, take-down, secret rotation, quota reduction, and weekly Codex review.

### Gate

The deployed URL is bound to the approved version, family access behaves as intended, data collection is healthy, and rollback/take-down instructions have been tested or explicitly dry-run verified.

---

## Completion definition

The project is complete only when:

- ChatGPT Sites is the sole app runtime and deployment target;
- GitHub Actions continuously accumulates validated data into Sites D1;
- the family can open the approved Site URL and understand freshness and provenance;
- recurring patterns become more stable as coverage accumulates;
- Vercel and every other external host/database remain absent.