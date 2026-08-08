# 서울 가자 — ChatGPT Sites Only Codex Pack

- 패킷 버전: `4.0.0-sites-only`
- 기준일: `2026-08-03` (Asia/Seoul)
- GitHub 저장소: `yangduhi/seoul_gaja`
- 권장 로컬 경로: `D:\vscode\seoul_gaja`
- 유일한 앱 호스팅·배포·공유 채널: **ChatGPT Sites**
- 영속 구조화 데이터: **ChatGPT Sites D1**
- 소스·PR·CI·정기 수집: **GitHub + GitHub Actions**
- 주요 이용자: 가족·지인 소수
- 제품명: **서울 가자 — 인파 레이더**
- 디자인: **Calm Glass — restrained glassmorphism × Apple-app-inspired hierarchy**

이 패킷은 서울시 주요 121개 장소의 현재 혼잡도, 공식 향후 12시간 예측, 생활정보와 누적 패턴을 가족이 확인할 수 있는 웹앱을 `yangduhi/seoul_gaja`에서 구현하기 위한 Codex 문서·계약·디자인 패키지다.

## 확정된 플랫폼 경계

```text
서울시 실시간 도시데이터 API
        │
        ▼
GitHub Actions collector
  - 정기 실행
  - 원천 검증·정규화
  - run receipt
        │
        ▼
ChatGPT Sites protected ingest route
        │
        ▼
ChatGPT Sites D1
        │
        ▼
ChatGPT Sites UI·공유 URL
```

다음 원칙은 변경 요청이 없는 한 고정한다.

1. **ChatGPT Sites가 유일한 앱 host/runtime/deploy/share surface다.**
2. **GitHub는 앱 host가 아니다.** 저장소, PR, 테스트, 디자인 자산과 GitHub Actions scheduler에만 사용한다.
3. **GitHub Actions는 Site를 배포하지 않는다.** 서울시 데이터를 수집·검증해 Site의 보호된 ingest route로 전송한다.
4. **D1이 유일한 production structured-data store다.** 외부 DB fallback은 없다.
5. D1, server route, hosted secret 또는 external ingest가 실제 계정에서 지원되지 않으면 `NOT_RUN_BLOCKED`로 중지한다.
6. Vercel, Netlify, GitHub Pages, Cloudflare hosting, Supabase, Firebase, 별도 backend server는 구현 대상이 아니다.
7. 참고 Vercel URL은 정보구조·사용자 흐름 연구 전용이며 코드·자산·문구·배포방식은 복제하지 않는다.
8. 모든 Sites Deploy URL은 production으로 취급하며, exact Git commit → 테스트·증거 → Save version → 검수 → 사용자 승인 → Deploy 순서를 따른다.

## 저장소 상태

- `main`: 초기 저장소 상태
- 계획 브랜치: `plan/chatgpt-sites-only-v1`
- Draft PR: `#1 docs: establish ChatGPT Sites-only implementation plan`
- 이 패킷은 위 계획 브랜치의 플랫폼 경계와 일치하도록 구성됐다.
- 패킷의 binary mockup과 concept board는 Codex가 로컬 Git workflow로 저장소에 추가한다.

## 먼저 준비할 것

필수:

- ChatGPT 계정에서 Sites 생성·Save version·Deploy·Share 사용 가능 여부 확인
- GitHub 저장소 `yangduhi/seoul_gaja` 관리자 권한과 Actions 활성화
- 서울 열린데이터광장 Open API 인증키
- Kakao Developers 앱과 JavaScript key
- GitHub Actions Secrets:
  - `SEOUL_OPEN_DATA_KEY`
  - `SITE_INGEST_URL`
  - `SITE_INGEST_TOKEN`
- ChatGPT Sites hosted values:
  - `SITE_INGEST_TOKEN`
  - `PUBLIC_KAKAO_JAVASCRIPT_KEY`

선택:

- `KAKAO_REST_API_KEY`: 일반 주소 검색을 승인할 때만
- custom domain: 초기 가족 공유에는 불필요

Vercel 계정·token, 외부 DB, 별도 server, OpenAI API key는 초기 제품에 필요하지 않다.

## 권위 순서

충돌 시 다음 순서를 적용한다.

1. `contracts/platform-boundary.yaml`
2. `00_overview/01_global_contracts.md`
3. `contracts/*`
4. `design/design.md`
5. 현재 Phase의 `acceptance-contract.md`
6. 현재 Phase의 `codex-work-order.md`
7. 현재 Phase의 `implementation-plan.md`
8. AI concept board·참고 이미지

## Phase

| Phase | 목표 |
|---:|---|
| 00 | 실제 계정에서 Sites local project·server route·D1·secret·Save version·share·external ingest 실증 |
| 01 | 공식 121개 카탈로그와 서울 API parser·quota 검증 |
| 02 | D1 migration, protected ingest, GitHub Actions 수집·누적 |
| 03 | 지도·목록·검색·필터·내 주변 |
| 04 | 상세·공식 12시간 예측·생활정보 |
| 05 | 누적 패턴·성숙도·가족 추천 |
| 06 | Calm Glass 디자인 구현 |
| 07 | 품질·접근성·성능·장애 감사 |
| 08 | Save version·가족 검수·Sites Deploy·운영 |

## 사용법

1. ZIP을 압축 해제한다.
2. `python scripts/validate_packet.py .`를 실행한다.
3. 로컬 저장소 `D:\vscode\seoul_gaja`를 준비한다.
4. `CODEX_START_HERE.md`를 Codex에 전달한다.
5. Codex는 Phase 00만 수행한 뒤 terminal receipt를 반환하고 중지한다.
6. `PASS`와 사용자 승인이 확인된 뒤에만 다음 Phase로 이동한다.
7. 공개 또는 가족 공유 배포는 Phase 08에서만 수행한다.

## 최소 개인정보 원칙

- 로그인·회원·가족 프로필·서버 즐겨찾기·위치 이력을 만들지 않는다.
- `내 주변` 위치는 버튼 클릭 후 브라우저 메모리에서만 사용한다.
- public read는 서울시 공개 데이터와 비개인 집계만 제공한다.
- write route만 `SITE_INGEST_TOKEN`으로 보호한다.
- `noindex`는 노출 억제 수단일 뿐 접근통제가 아니다.
