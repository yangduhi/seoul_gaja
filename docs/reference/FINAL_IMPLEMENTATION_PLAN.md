# 서울 가자 v4.1 최종 구현 합성본

## 상태와 권한

이 문서는 사람이 읽는 실행 요약이다. 실행 권한은 다음 순서만 따른다.

1. `.omo/authority-lock.json`의 고정 SHA-256 binding
2. `docs/execution/AMENDMENT-v4.1.md`
3. `.omo/plans/seoul-gaja-v4-plan-review.md`
4. 비충돌 `docs/codex-pack-v4` 계약

`docs/codex-pack-v4`는 v4.0.0 audit packet이다. 구조 검증은 audit-only이며 제품, Sites, 브라우저, 외부 release의 성공을 뜻하지 않는다. 이 문서는 그 packet을 변경하지 않으며, packet 외부의 v4.1 sidecar 계약을 설명한다.

현재 로컬 구현 및 source-backed 계약 검증은 수행되었지만, 이 문서로 외부 action 권한이 생기지 않는다. 각 owner-only gate는 아래 ledger가 명시적으로 해제할 때까지 `NOT_RUN_BLOCKED`다.

## 고정 플랫폼 경계

- 애플리케이션 host와 structured store는 각각 ChatGPT Sites 및 Sites D1 `DB`다.
- GitHub와 GitHub Actions는 source, review, CI, collector 실행용이다. application host가 아니다.
- production ingest는 오직 `POST /api/internal/ingest/snapshot`이다.
- `phase-00-capability-probe`의 `POST /api/internal/capability-probe/ingest`는 disposable capability 확인용이며 cannot prove Phase 02 production behavior; production ingest를 증명하지 않는다.
- ingest credential 이름은 `SITE_INGEST_TOKEN` 하나다. 값은 source, receipt, 로그, fixture에 기록하지 않는다. rotation overlap의 최대값은 30분이다.

## 데이터와 추천 계약

- snapshot identity는 `run_id`, `attempt_no`, `revision_id`, `payload_sha256`을 서로 다른 immutable identity로 다룬다. 같은 attempt의 다른 payload는 `409 PAYLOAD_HASH_CONFLICT`다.
- freshness는 UTC-normalized `sourceUpdatedAt`을 우선 사용하고, `fetchedAt`은 명시된 degraded basis일 때만 사용한다.
- 121개 공식 장소 identity와 counter가 reconcile되어야 한다. 활성화, replacement, last-known-good 보존은 Todo 7 contract를 따른다.
- `migrations/0003_snapshot_revision_and_provenance.sql`은 additive, forward-only 계획이다. 이미 존재하는 `0003_*` collision은 권한 amendment 전까지 `NOT_RUN_BLOCKED`다.
- NOW와 NEXT 추천은 current crowd, official forecast, eligible history의 lower-is-better `[0,1]` percentile만 사용한다. 미지원 입력, 보간, 외삽, cohort mismatch, 부족한 history는 점수를 만들지 않고 suppress한다.
- selected cadence는 15분이며, capacity acceptance에는 owner-bound quota와 연속된 네 번의 전체 121-place receipt가 필요하다. sample 또는 단일 canary는 PASS 근거가 아니다.

## UI와 evidence 계약

- canonical detail route는 `/places/{areaCode}`다.
- in-app 선택은 transient `history.state.entry="sheet"`로 sheet 또는 desktop detail pane을 열고, direct/reload/shared 진입은 full-screen detail을 사용한다.
- canonical URL은 transient state와 user coordinates를 포함하지 않는다. Back/close는 이전 URL, selection, focus를 복원한다.
- phase evidence의 유일한 경로 패턴은 `docs/evidence/phase-XX/phase-receipt.json`이다. Phase 08 식별자는 `docs/evidence/phase-08/phase-receipt.json`의 nested `release` object에만 둔다.
- UI/API는 `sourceUpdatedAt`과 `fetchedAt`을 쓰며 D1 column은 `source_updated_at`과 `fetched_at`을 쓴다. design token authority는 `design/design-tokens.json`이다.
- phase receipt는 verdict-safe schema를 통과해야 한다. local fixture 또는 source assertion은 Sites나 browser PASS로 승격되지 않는다.

## 로컬 closeout 범위

다음 검증은 동일한 repository source와 authority binding을 대상으로 한다.

```text
python docs/execution/scripts/run_command_map.py --map docs/execution/contracts/execution-command-map.json --id task-12-happy
python docs/execution/scripts/run_command_map.py --map docs/execution/contracts/execution-command-map.json --id task-12-failure
node docs/execution/scripts/validate_semantic_closeout.mjs
python docs/execution/scripts/validate_phase_receipts.py docs/execution/contracts/phase-receipt.schema.json docs/evidence/phase-00/phase-receipt.json
```

semantic closeout은 authority plan/amendment hash, immutable packet ZIP/content-root/manifest hash, phase receipt schema, workflow security policy, stale-literal scan, scope scan을 함께 확인한다. `git diff --check`, declared lint, test, build 결과는 candidate receipt에 기록하되, baseline이 아닌 오류를 성공으로 바꾸지 않는다.

## Owner-only blocker ledger

아래 항목은 로컬 fixture나 screenshot으로 해제할 수 없다.

- Sites Phase00 owner approval
- D1 migration execution/sequence collision authority
- account/service quota plus four full 121-place cadence receipts
- actionlint authoritative lint
- protected default-branch workflow
- browser/visual QA
- baseline Cloudflare ambient TypeScript errors

각 항목은 해당 owner action, exact candidate identity, 그리고 실제 surface evidence와 함께 갱신된다. 그 전에는 semantic closeout이 local source contract를 확인했을 뿐이며 live capability 또는 release 완료를 주장하지 않는다.
