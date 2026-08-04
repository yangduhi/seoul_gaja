# 서울 인파 레이더 최종 구현안

출처 대화: `ChatGPT 사이트 활용 검토`

공유 URL: `https://chatgpt.com/share/6a7078a5-de78-83e8-83e4-0112171bef80`

원본 대화 URL: `https://chatgpt.com/c/6a6f7659-f0ac-83e8-a1ed-1e0c3a3da2a9`

이 문서는 대화에서 확정된 구현 계약을 실행 가능한 형태로 정리한 것이다. 실행자는 `.omo/authority-lock.json`에 고정된 문서만 사용한다.

## 1. 최종 경계

사용자-facing 사이트, 서버 runtime, database, deployment, sharing은 `ChatGPT Sites`만 사용한다.

`GitHub`와 `GitHub Actions`는 source control, PR, CI, 주기적 데이터 수집·집계 스케줄러로만 사용한다. GitHub Actions가 Site를 배포하지 않는다.

사용하지 않는 것:

- `Vercel`, `Netlify`, `GitHub Pages`, `Cloudflare Pages/Workers`
- `Supabase`, `Firebase`
- 별도 application server/database
- 초기 서비스 runtime의 `OPENAI_API_KEY`
- 불필요한 custom domain

기존 `v3.0.0-family-final`의 `Supabase fallback`, 외부 애플리케이션 서버, Vercel 배포 가정, Sites 이외의 hosting은 폐기한다. 유지하는 것은 GitHub Actions 주기 수집, history maturity, Calm Glass 디자인, 가족 공유 목적, 서울시 공식값과 자체 history 분리, mockup/Design Pack 관리다.

## 2. 최종 아키텍처

```text
서울시 실시간 도시데이터 API
        |
        v
GitHub Actions Collector
  - 15/30/60분 주기
  - 공식 121개 장소 수집
  - source body hash
  - schema·의미 검증
  - run receipt
        |
        | Bearer token + idempotency key
        v
ChatGPT Sites 내부 ingest route
  - token 검증
  - payload 재검증
  - 중복 ingest 방지
  - D1 원자적 저장
        v
ChatGPT Sites D1
  - 장소 catalog
  - 현재 Last-Known-Good
  - 서울시 공식 예측
  - 수집 실행 이력
  - 시간별·일별 집계
  - 요일×시간 profile
        v
ChatGPT Sites UI
  - 지도·목록·검색·필터·정렬
  - 현재 혼잡도
  - 공식 12시간 예측
  - 주차·도로·따릉이·행사
  - 누적 패턴
  - 가족 목적 추천
```

역할은 `ChatGPT Sites`(hosting, API route, D1, secret, preview, version, deploy, share), `GitHub`(코드·문서·schema·migration·fixture·PR), `GitHub Actions`(수집·집계·품질 검사), `Codex`(구현·테스트·유지보수 PR), 서울시 API(공식 현재값·예측), Kakao API(지도·선택적 주소 검색)로 분리한다.

모든 Sites deploy URL은 production URL이므로, 검토 시 먼저 `Save version`을 저장하고 승인 후 배포한다.

## 3. 데이터 의미와 운영

### 3.1 현재값과 예측

- 서울시 혼잡도는 실제 현장 인구가 아닌 추정 지표다.
- `KT 기지국 기반`으로 고정하지 않고 서울시 최신 계약의 통신사 비교·가중 융합 설명을 사용한다.
- 절대적 안전 판정, 정확한 현장 인원, 특정 시각의 확정적 한산함을 말하지 않는다.
- UI/API에는 `sourceUpdatedAt`(서울시 기준 시각)과 `fetchedAt`(수집 시각)을 분리해 표시한다. D1 persistence columns use the database snake_case convention.
- 원천 지연 시 `현재 원천 데이터 갱신이 지연되고 있습니다`를 표시한다.
- 공식 12시간 예측은 자체 예측보다 우선한다.

### 3.2 수집·보존

기본 scheduler 표현은 다음과 같다.

```text
7,22,37,52 * * * *  현재 데이터 수집
17 * * * *           시간별 집계
27 18 * * *          일별 집계·보존 정리 (03:27 KST)
37 19 * * 6          주간 품질 분석 (일요일 04:37 KST)
workflow_dispatch    수동 복구·재집계
```

초기 수집 주기는 15분이며 Phase 01에서 quota와 latency를 측정한 뒤 `COLLECT_INTERVAL_MINUTES=15|30|60` 중 하나로 확정한다. 121개 장소 기준 일일 최대 요청은 각각 `11,616`, `5,808`, `2,904`회다. 여러 key나 계정으로 우회하지 않고 주기를 늘린다.

보존 정책:

- 15분 raw observation: 7일
- 시간별 observation: 90일
- 일별 summary: 기본 2년
- 요일×시간 profile: 장기 보존

Git에는 runtime snapshot을 계속 commit하지 않는다. history는 Sites D1에 저장한다.

History maturity는 기간과 coverage를 동시에 만족해야 한다.

| 상태 | 최소 기간 | 최소 coverage | UI 표시 |
|---|---:|---:|---|
| `ACCUMULATING` | 0일 | 제한 없음 | 데이터 축적 중 |
| `PROVISIONAL` | 7일 | 70% | 참고용 패턴 |
| `STABLE` | 28일 | 80% | 안정화된 패턴 |
| `MATURE` | 56일 | 90% | 높은 신뢰도의 반복 패턴 |

누적 데이터는 장기 반복 패턴, 추천 순위·confidence, 결측·갱신 지연 탐지에 사용한다. 서울시 현재 추정치, 공식 예측, 실제 현장 인구, 원천 오류의 자동 보정값이 더 정확해진다고 표현하지 않는다.

## 4. 가족 공유용 최소 보안

로그인·회원가입, 사용자 profile, 위치 이력, 서버 저장 즐겨찾기, third-party analytics를 두지 않는다. 공개 조회 API는 인증하지 않고 쓰기 ingest route만 `SITE_INGEST_TOKEN`으로 보호한다. 현재 위치는 브라우저 메모리에서만 거리 계산한다. 검색엔진 억제는 `noindex,nofollow`를 사용한다.

공유 우선순위:

1. 가능하면 `Selected active users or groups`
2. 가족 편의성이 우선이고 계정 공유가 불가능하면 `Anyone on the internet` 링크
3. 가족 단체방으로 링크 전달

공개 링크를 선택하더라도 개인 일정, 가족 이름, 현재 위치를 Site에 저장하지 않는다.

## 5. 사용자 사전 준비

필수:

- ChatGPT Sites 메뉴·로컬 프로젝트 연결·D1·hosted environment variable/secret·`Save version`·공유/public publishing 권한 확인
- `yangduhi/seoul_gaja` GitHub repository와 Actions 활성화, Secrets 등록 권한, `main` 직접 push 대신 PR 사용
- 서울 열린데이터광장 계정·운영 Open API key·121개 요청량 quota 확인
- Kakao Developers 앱, JavaScript 지도 API, JavaScript key, `localhost`와 Sites URL 등록
- Phase 00 검증 후 `SITE_INGEST_URL`과 `SITE_INGEST_TOKEN` 등록

Secret 이름과 위치:

| 이름 | GitHub Actions | ChatGPT Sites | 브라우저 노출 |
|---|---|---|---|
| `SEOUL_OPEN_DATA_KEY` | 필수 | 불필요 | 금지 |
| `SITE_INGEST_URL` | 필수 | 불필요 | 금지 |
| `SITE_INGEST_TOKEN` | 필수 | 필수 | 금지 |
| `PUBLIC_KAKAO_JAVASCRIPT_KEY` | 선택 | 필수 | 허용(등록 도메인으로 제한) |

선택: `KAKAO_REST_API_KEY`(일반 주소 검색/주소→좌표), Sites D1이 실제 계정에서 unavailable인 경우가 아니라면 Supabase는 선택지가 아니다. 주간 자연어 요약이 정말 필요할 때만 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 별도 검토한다.

## 6. Phase 00~08 순서

| Phase | 핵심 완료 조건 |
|---:|---|
| 00 | Sites·storage·secret·share capability 실증 |
| 01 | 공식 121개 catalog와 parser |
| 02 | GitHub Actions, ingest, D1, history 누적 |
| 03 | 지도·목록·검색·필터·정렬 |
| 04 | 장소 상세·공식 예측·주차·도로·따릉이·행사·공유 |
| 05 | history maturity·heatmap·가족 추천 |
| 06 | Calm Glass 디자인 구현 |
| 07 | 전체 테스트·보안·접근성·성능·브라우저 검증 |
| 08 | Save version·가족 공유·Deploy·운영 인계 |

실행 순서는 ZIP 검증 → `OWNER_CHECKLIST.md` → `DESIGN_START_HERE.md` → `AUTOMATION_START_HERE.md` → `CODEX_START_HERE.md` 전달 → Phase 00만 실행 → receipt 검토 → PASS일 때 다음 Phase다. 한 작업이 모든 Phase를 자동으로 진행하지 않는다.

## 7. Phase 00 gate

Phase 00에서는 UI, 서울시 live collector, history model을 구현하지 않는다. 실제 사용자 계정에서 다음을 증명한다.

- local Git project linkage와 Sites 권장 starter/framework
- server-side route
- D1 binding과 write/read/rollback
- hosted secret의 server-side 접근 및 client bundle 비노출
- synthetic 한 건 protected ingest
- Bearer token 누락·불일치와 malformed payload 거부
- exact Git commit과 `Save version` 연결
- 실제 family sharing mode 최소 하나

문서나 기억만으로 PASS하지 않는다. Sites capability가 없거나 external provider가 필요하면 다른 provider로 우회하지 않고 `NOT_RUN_BLOCKED`로 종료한다.

PASS/FAIL/NOT_RUN_BLOCKED만 허용한다. 실제 secret 입력, Deploy, sharing 변경, paid resource, `main` merge는 사용자 승인이 필요하다.

필수 evidence:

```text
docs/evidence/phase-00/phase-receipt.json
docs/evidence/phase-00/commands.txt
docs/evidence/phase-00/test-results.txt
docs/evidence/phase-00/browser-checks.json
docs/evidence/phase-00/source-hashes.sha256
```

receipt에는 phase/verdict, base·candidate commit/tree, changed files, 정확한 명령·exit code, test 결과, Site linkage, D1, secret server-side, external ingest, Save version binding, sharing mode, 오류, cleanup, blocker, owner action을 포함한다.

## 8. Codex 실행 단위

가장 안정적인 단위는 `한 Codex 작업 = 한 Phase = 한 branch = 한 Draft PR = 한 receipt`다.

### Prompt A: 계획 PR review-only

대상은 `yangduhi/seoul_gaja`, base `main`, PR `#1`, head `plan/chatgpt-sites-only-v1`다. 구현·파일 수정·commit·push·merge·deployment를 금지하고, README, AGENTS, `CODEX_START_HERE.md`, platform boundary, architecture, prerequisites, phase plan, automation, ADR, design docs, tokens, env/gitignore와 PR diff를 직접 확인한다.

검토 항목은 요구 누락·상충, Sites 외 provider 잔존, 검증되지 않은 capability 가정, secret 노출, Actions deployment 오해, Phase gate 우회, 현재값·공식 예측·history 혼합, 디자인 reference/계약 혼동, 전 Phase 자동 실행 모호성이다.

출력:

```text
VERDICT: APPROVE | REVISE
BLOCKER_COUNT: <integer>
BLOCKING_FINDINGS:
- severity:
  file:
  section:
  finding:
  required_change:
NON_BLOCKING_FINDINGS:
INTEGRATION_READINESS:
- ready_to_merge: true | false
- recommended_next_action:
```

### Prompt B: main 병합 후 Phase 00

`origin` fetch, base commit/tree·branch·status 기록, `codex/phase-00-sites-capability` isolated worktree/branch 생성, 적용 가능한 `AGENTS.md` 확인 후 계약 문서를 읽는다. failing capability gate부터 시작하고, Sites starter를 우선하며, 최소 health route·D1 round-trip·synthetic protected ingest probe와 secret 비노출 검사를 만든다. local focused/full validation과 evidence를 남기되 Phase 01은 시작하지 않는다.

허용: local read/edit, dependency, test/typecheck/lint/build, fixture, branch/commit/push, Draft PR. 승인 필요: Sites Deploy, sharing 변경, hosted/GitHub secret 실제값 입력, paid resource, `main` merge, external provider, 범위 확대, destructive action.

### Prompt C: owner action 후 재개

같은 작업에서 branch/HEAD/tree/status와 기존 receipt를 재확인하고 완료된 작업을 반복하지 않는다. 승인 범위 밖의 외부 작업은 금지하고 Phase 00 남은 검증·evidence·Draft PR만 끝낸다. Phase 01은 시작하지 않는다.

### Prompt D: Phase 반복 템플릿

Phase 00 receipt가 `PASS`이고 main에 병합된 뒤에만 `<01~08>`을 한 번에 하나씩 실행한다. 이전 Phase가 PASS가 아니면 `NOT_RUN_BLOCKED`. 각 Phase는 failing gate, 최소 구현, focused/full test, browser 검증, hash, receipt, Draft PR, terminal verdict로 끝낸다.

## 9. 디자인 권위

방향은 `Calm Glass`, `restrained glassmorphism + Apple-app-inspired hierarchy`, family utility다. 3단계 glass depth, floating glass control, iOS bottom sheet/segmented control, 44px touch target, light/dark theme, source-vs-history 분리를 적용하고 과한 glow·blur·shadow는 금지한다.

권위 우선순위:

```text
design/design.md
→ design/design-tokens.json
→ component/screen contracts
→ deterministic mockup
→ AI concept board
```

PNG 내부 문구·숫자·지도·장소명은 fixture일 수 있으며 데이터 계약이 아니다. 승인된 화면은 모바일 `01-home-map-light`, `02-place-detail-light`, `03-family-recommendations-light`, `04-history-insights-dark`, 데스크톱 `05-desktop-dashboard`, AI concept board 4장이다.

## 10. 현재 보존 상태와 미해결 자산

- Active execution authority is `.omo/authority-lock.json`, `docs/execution/AMENDMENT-v4.1.md`, and the bound approved plan. Legacy capture paths are audit-only and are not executor inputs.
- Design Pack ZIP은 실제 다운로드·추출·manifest 검증 완료다.
- 최신 답변의 `seoul-gaja-chatgpt-sites-only-v4.0.0.zip`은 실제 다운로드·추출했다. ZIP SHA-256은 `af2ea053fe540e62e886ffb107434bc89f370e6242210afa25cc73f24d470e83`, 크기는 `8,575,163 bytes`, content-root SHA-256은 `9d70c004be12e2f5da5685074714bcb48c8dc1bef1560c035d31a4ea99ad34e6`, `MANIFEST.sha256`는 `106/106` 일치한다. 추출 경로는 `assets/codex-pack-v4/seoul-gaja-chatgpt-sites-only-v4.0.0/`이다.
- 생성 컨셉 이미지는 AI concept board `4장`과 deterministic mockup `5장`, 총 `9 PNG`를 `assets/generated-concept-images/`에 별도 보관하고 `INVENTORY.json`에 파일 크기·SHA-256을 기록했다.
- 구버전 `seoul-crowd-radar-family-final-v3.0.0.zip`과 SHA-256 `3f2116f1453e1e8f34e3743bd641cff0b6169f4d79e4793e07c6448d8f6789b1`은 최신 v4로 교체된 대화상 구버전이며, 별도 파일은 보존하지 않는다.
- 사용자 입력 `1000023624.png`, `1000023627.png`은 사용자가 저장 불필요로 지정했으므로 보관 범위에서 제외했다. Historical signed-URL error material remains audit-only and is not an execution input.
