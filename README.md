# 서울 가자 (`seoul_gaja`)

가족이 서울 나들이 장소의 현재 혼잡도, 공식 예측, 생활정보와 누적 패턴을 확인하는 **ChatGPT Sites 전용 웹앱**입니다.

## 확정된 배포 경계

- **유일한 앱 호스팅·배포:** ChatGPT Sites
- **소스·리뷰·자동 수집:** GitHub 저장소와 GitHub Actions
- **영속 데이터:** ChatGPT Sites D1
- **선택 파일 저장:** ChatGPT Sites R2
- **공유:** ChatGPT Sites의 가족 제한 공유 또는 공개 링크
- **사용하지 않음:** Vercel, Netlify, GitHub Pages, Cloudflare Pages, Supabase, Firebase 및 별도 앱 서버

GitHub Actions는 서울시 데이터를 주기적으로 수집해 ChatGPT Site의 내부 ingest API로 전달할 뿐, 사이트를 호스팅하거나 배포하지 않습니다. ChatGPT Sites 배포는 ChatGPT 웹 또는 데스크톱 앱에서 승인된 Git commit을 기준으로 Save version 후 수동 Deploy합니다.

## 현재 상태

이 저장소는 초기 계획 단계입니다. 제품 코드 구현 전에 `Phase 00`에서 다음 기능을 실제 계정으로 검증합니다.

1. Git 저장소 기반 로컬 프로젝트를 ChatGPT Sites가 호환 프로젝트로 인식하는지
2. D1 바인딩과 서버 route가 제공되는지
3. hosted secret을 내부 ingest route에서 읽을 수 있는지
4. GitHub Actions에서 Site endpoint로 POST할 수 있는지
5. Save version이 exact Git commit에 연결되는지
6. 가족에게 적용할 수 있는 공유 옵션

D1 또는 서버 route가 지원되지 않으면 외부 DB나 Vercel로 우회하지 않고 `NOT_RUN_BLOCKED`로 종료합니다.

## 시작 문서

- [`CODEX_START_HERE.md`](CODEX_START_HERE.md)
- [`AGENTS.md`](AGENTS.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/owner-prerequisites.md`](docs/owner-prerequisites.md)
- [`docs/phase-plan.md`](docs/phase-plan.md)
- [`design/design.md`](design/design.md)

## Secret 원칙

실제 값은 GitHub Actions Secrets와 ChatGPT Sites Settings에만 저장합니다. `.env`, prompt, issue, commit, log, screenshot 또는 evidence packet에 실제 key를 기록하지 않습니다.

필수 이름:

```text
SEOUL_OPEN_DATA_KEY
SITE_INGEST_URL
SITE_INGEST_TOKEN
PUBLIC_KAKAO_JAVASCRIPT_KEY
```

## 브랜치 정책

- `main`: 승인된 통합 상태
- 작업 브랜치: `codex/phase-XX-*`
- 직접 `main` push 금지
- Phase별 PR, 테스트, 브라우저 증거 및 receipt 후 통합
