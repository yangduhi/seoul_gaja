---
slug: seoul-gaja-v4-plan-review
status: plan-reviewed
intent: clear
review_required: false
pending-action: await separate implementation approval and an actual checkout; execution may then transition to the default model
approach: Contract-first v4 review: preserve the ChatGPT Sites-only boundary, repair all cross-document gate/route/evidence contradictions, make data and UX states decision-complete, then produce one execution plan that fails closed.
---

# Draft: seoul-gaja-v4-plan-review

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| product | 가족·지인이 121개 공식 장소의 현재값, 공식 예측, 누적 패턴을 오해 없이 판단 | active | `contracts/product-contract.yaml`, `00_overview/01_global_contracts.md` |
| platform | ChatGPT Sites + Sites D1 + GitHub Actions 경계와 Phase 00 capability gate가 직접 검증됨 | active | `contracts/platform-boundary.yaml`, `CODEX_START_HERE.md` |
| data | 서울시 원천값·예측·history가 provenance/freshness/idempotency 규칙으로 보존됨 | active | `contracts/data-contract.yaml`, `contracts/storage-schema.sql` |
| security | protected ingest, workflow secrets, public read, family sharing이 최소 위협 모델을 충족 | active | `contracts/privacy-and-security-contract.yaml`, `templates/github-actions/*` |
| experience | 지도·목록·상세·추천·history가 상태·접근성·공유 fallback까지 일관됨 | active | `design/design.md`, `design/component-contracts.md`, `design/screen-specs.md` |
| operations | Phase receipt, exact commit/tree, scheduler, rollback, owner approval이 검증 가능한 release evidence로 남음 | active | `contracts/phase-receipt.schema.json`, `contracts/release-contract.yaml` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

| execution boundary | review and plan refinement only; no product code, Sites secret values, deploy/share change, push, PR merge, or external API activation | user requested review before implementation | yes |
| platform | keep ChatGPT Sites-only + Sites D1 + GitHub Actions; missing Sites capability remains `NOT_RUN_BLOCKED` | explicit v4 boundary | no, owner change required |
| verification | Todo 1 derives an exact command map from the actual manifest/lockfile; TDD/failing-gate first, agent-executed happy/failure QA, exact receipts; fixture evidence never proves live capability | prevents false PASS and invented commands | yes |
| security | owner performs or explicitly approves Sites/GitHub Environment secret entry; values never enter prompts/logs/evidence; rotation/revocation is receipt-bound | safety-critical boundary | no |

## Findings (cited - path:lines)

### Blocking / high-impact findings

- **P0 platform lifecycle:** Phase 00 deploys a disposable protected probe, then requires disabling/converting it, but has no cleanup commit → Save version → approval → cleanup deploy sequence. A source-only removal cannot close the deployed route while preserving exact-commit binding. Evidence: `phases/phase-00-owner-setup-and-capability/implementation-plan.md:72-83`, `contracts/platform-boundary.yaml:39-46`.
- **P0 route identity:** architecture uses `POST /api/internal/ingest`, while OpenAPI and Phase 02 use `/api/internal/ingest/snapshot`. Phase 00 proof cannot establish the Phase 02 route until one canonical endpoint is selected. Evidence: `00_overview/02_architecture.md:17-24,63-75`, `contracts/api-contract.openapi.yaml:52-68`, `phases/phase-02-automation-and-storage/implementation-plan.md:23-26`.
- **P0 workflow gate:** Phase 02 requires an external Actions smoke on `--ref main` while prohibiting push/deploy and requiring workflows on the default branch; this can only test stale `main` or cannot run at all. Evidence: `phases/phase-02-automation-and-storage/acceptance-contract.md:9`, `phases/phase-02-automation-and-storage/implementation-plan.md:93`, `contracts/schedule-contract.yaml:5-8`, `00_overview/11_repository_integration.md:17-26`.
- **P0 receipt integrity:** the receipt schema permits `PASS` with null commit/tree and empty tests/evidence, and does not carry required Phase 08 release identifiers. Evidence: `contracts/phase-receipt.schema.json:27-81`, `phases/phase-08-sites-release-and-operations/implementation-plan.md:71-74`.
- **P0 workflow injection:** manual backfill interpolates unvalidated dispatch dates into a shell command while production secrets are in the job environment. Evidence: `templates/github-actions/manual-backfill.yml:38-46`.
- **P0 supply chain:** production-secret workflows use mutable action tags and do not require hash-locked Python dependencies. Evidence: `templates/github-actions/collect-live.yml:20-43`, `phases/phase-02-automation-and-storage/implementation-plan.md:68-75`.

### Correctness / scope findings

- Phase 00 receipt path is `receipt.json` in the human plan but `phase-receipt.json` in the packet and schema. Evidence: `FINAL_IMPLEMENTATION_PLAN.md:183`, `CODEX_START_HERE.md:57`, `phases/phase-00-owner-setup-and-capability/acceptance-contract.md:42`.
- The plan says to register `SITE_INGEST_URL` and `SITE_INGEST_TOKEN` after Phase 00, while Phase 00 requires a temporary Sites token before protected-ingest proof. Evidence: `FINAL_IMPLEMENTATION_PLAN.md:134-142,169-172`, `CODEX_START_HERE.md:34-35`.
- Prompt B lists `push` as allowed, conflicting with packet and `codex/AGENTS.md` explicit approval requirements. Evidence: `FINAL_IMPLEMENTATION_PLAN.md:221-224`, `CODEX_START_HERE.md:45`, `codex/AGENTS.md:27`.
- Phase 00 task ordering copies/validates the packet before branch creation, while `CODEX_START_HERE.md` creates the branch first. Evidence: `phases/phase-00-owner-setup-and-capability/implementation-plan.md:41-43`, `CODEX_START_HERE.md:28-29`.
- Snapshot identity based only on source time + catalog version can reject a legitimate partial-then-recovered retry with a changed canonical payload. Evidence: `00_overview/01_global_contracts.md:25-26`, `contracts/storage-schema.sql:13-24`, `phases/phase-02-automation-and-storage/implementation-plan.md:50-51`.
- Freshness thresholds do not specify the reference clock or server-side derivation of availability/provenance. Evidence: `contracts/data-contract.yaml:42-52`, `contracts/api-contract.openapi.yaml:84-102`.
- A 121-row all-unavailable generation can become active because the contract lacks usable-generation and counter-reconciliation rules. Evidence: `contracts/api-contract.openapi.yaml:103-122`, `phases/phase-02-automation-and-storage/acceptance-contract.md:3-10`.
- Successful source provenance is only retained in runner temp/on failure; long-lived D1 provenance is insufficient for later audit. Evidence: `templates/github-actions/collect-live.yml:31-51`, `contracts/storage-schema.sql:13-24`.
- A three-place quota probe cannot prove a 121-place cadence. Evidence: `phases/phase-01-data-source-foundation/implementation-plan.md:66-72,88`.
- Purpose recommendation weights (`noIncident`, `transportAndParking`, `cultureEvent`, etc.) have no authoritative input/freshness contract, allowing silently degraded purpose labels. Evidence: `contracts/recommendation-contract.yaml:9-29`, `contracts/data-contract.yaml:12-65`, `phases/phase-05-history-and-family-presets/implementation-plan.md:60-64`.
- Phase 06 introduces the design primitives after Phases 03-05 already build screens that depend on them. Evidence: `phases/phase-03-core-map-and-list/implementation-plan.md:59,71-74`, `phases/phase-06-calm-glass-design/implementation-plan.md:21`.
- UI state taxonomy, mobile detail model, navigation destinations, search/filter/geolocation flows, sharing fallback, incomplete-history recommendation behavior, responsive breakpoints, and dynamic accessibility announcements are not decision-complete. Evidence: `contracts/ui-state-contract.yaml:2-30`, `design/design.md:60-76`, `design/component-contracts.md:53-105`, `design/screen-specs.md:3-76`.
- Phase 04 adds an uncontracted `settings/help` surface; use the existing share disclosure/detail surface unless separately approved. Evidence: `phases/phase-04-detail-and-forecast/implementation-plan.md:70`, `contracts/product-contract.yaml:22`, `design/screen-specs.md:3-58`.
- Human plan contains stale references after archive cleanup (`transcript/`, `source/shared-chat.html`) and the wrong token path `design/tokens.json`; packet uses `design/design-tokens.json`. Evidence: `FINAL_IMPLEMENTATION_PLAN.md:9,241,251-258`, `design/design.md:17`, `DESIGN_START_HERE.md:5`.
- UI-facing plan uses snake_case `source_updated_at`/`fetched_at`, while API/data contracts use `sourceUpdatedAt`/`fetchedAt`; reserve snake_case for D1 storage. Evidence: `FINAL_IMPLEMENTATION_PLAN.md:76`, `contracts/data-contract.yaml:15-16,45-46`, `contracts/api-contract.openapi.yaml:101-102`.

## Decisions (with rationale)

- Review all six topology components together, per user-selected “전 영역 동시” criterion.
- Keep the v4 platform boundary and fail-closed gate; do not introduce a fallback host/database to make a test pass.
- Preserve the v4.0.0 packet and SHA as audit-only; the canonical execution authority is an explicit v4.1 amendment/re-hash. A fallback supersession record is allowed only when it binds old/new SHA, precedence, approver, and approval time.
- Keep the current review in planning mode; implementation starts only after a separate explicit user instruction.
- Lock crowd/time-backed recommendations: NOW uses 0.60 current + 0.40 first valid <=60-minute official forecast; NEXT evaluates <=180-minute official points with 0.40 current + 0.60 forecast; eligible PROVISIONAL history automatically uses 0.50/0.30/0.20. Inputs are lower-is-better [0,1] percentiles, with no interpolation, extrapolation, missing-weight renormalization, or incident/transport/event/purpose-fit/momentum signal.
- Lock snapshot identity and activation: run_id + attempt/revision + payload SHA, 409 on same-attempt payload conflict, linked recovery revision, exact freshness/skew boundaries, 121 identities, first activation >=97 refreshed-fresh, replacement >=1 refreshed and >=97 refreshed plus non-expired carried, otherwise retain LKG.
- Lock the additive migration target as `migrations/0003_snapshot_revision_and_provenance.sql`; a sequence collision blocks for authority amendment rather than silently renaming it.
- Lock Phase 08 release evidence to the required nested `release` object in `docs/evidence/phase-08/phase-receipt.json`.
- Lock ingest credentials to Sites hosted secrets plus a protected default-branch GitHub Environment, ingest-only scope, <=30-minute rotation overlap, revocation, and old-token rejection.
- Lock two mobile detail entry modes on `/places/{areaCode}`: in-app list/marker/recommendation selection uses transient `history.state.entry="sheet"` and a bottom sheet; reload/direct/shared links use full-screen detail; canonical sharing omits transient state and Back/close restores prior URL/selection/focus.
- Require four consecutive whole-catalog scheduled runs at selected cadence; owner/quota/live evidence absence remains `NOT_RUN_BLOCKED`.

## Review resolution ledger

| event | exact evidence / disposition |
| --- | --- |
| prior plan review | plan SHA `d843ed9815721789dec81208a8ae74c87dabe272ab7f858bdfd90e64b4809372`; Momus `REJECT`; dependency, references, exact QA, and final-gate gaps required revision |
| user authorization | 2026-08-04: “검수안으로 최종 수정까지 승인”; authorizes plan/draft correction only, not implementation or external mutation |
| final reviewed plan | SHA `9ec41b95cdcc22c5d8f0135dcb8103d90f00e3610931b54d1c8015a88a0c4849`; 12 Todos, 4 final gates, dependency matrix consistent, 65/65 anchored reference entries across 40 files resolve; Momus `OKAY` bound to this SHA (`019fcae2-fc54-74d3-9f02-86962642bf04`) |
| current workspace | `D:\vscode\seoul_gaja` is `NOT_A_GIT_WORKTREE` and has no root manifest/lockfile; implementation is `NOT_RUN_BLOCKED` until Todo 1 receives an actual checkout |
| v4.0.0 validator meaning | 106-file packet structure and recorded hashes may PASS, but that is not semantic/product/live capability PASS |

## Scope IN

- Product intent, user flows, scope/non-goals, data truth, crowd/time recommendation semantics, platform capability gates, security/privacy, phase sequencing, evidence receipts, release/rollback, and design state contracts.
- One decision-complete implementation plan derived from the reviewed v4 packet.

## Scope OUT (Must NOT have)

- Product code, migrations, GitHub workflow edits, Sites project creation, secret entry, deployment, sharing/access changes, Git push/merge, live Seoul/Kakao calls, or packet binary edits.
- New application host, external database, user accounts, personal profiles, server-side location history, incident/transport/event/momentum recommendation scoring without authoritative contracts, or input-image restoration.

## Remaining owner gates (not design questions)

- Supply the actual Git checkout with its manifest/lockfile before Todo 1 can produce a startable command map; the current reference-only workspace remains `NOT_RUN_BLOCKED`.
- Separately authorize any future secret entry, merge/push, Sites Save/Deploy, default-branch workflow run, live Seoul/Kakao call, sharing/access change, or migration execution. This review grants none of them.

## Approval gate
status: plan-reviewed
approach: Contract-first v4.1 authority, exact command-map startability, fail-closed data/security/release gates, source-backed crowd/time formulas, and decision-complete two-entry UX.
next-action: await a separate explicit implementation instruction and an actual repository checkout; implementation may use the default model after that approval.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
