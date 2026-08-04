# 사전 준비 목록

## A. ChatGPT Sites

- [ ] Sites가 현재 계정·지역·workspace에서 보임
- [ ] latest ChatGPT desktop app 또는 ChatGPT web의 Sites 사용 가능
- [ ] compatible local project를 준비할 수 있음
- [ ] private preview 확인 가능
- [ ] Save version 가능
- [ ] Deploy 가능
- [ ] D1 storage binding 추가 가능
- [ ] hosted environment variables/secrets 설정 가능
- [ ] Share에서 실제 사용할 audience 확인

초기 릴리스에는 custom domain이 필요하지 않다. 기본 Sites URL을 사용한다.

## B. GitHub

Repository: `yangduhi/seoul_gaja`

- [ ] owner/admin permission 확인
- [ ] GitHub Actions enabled
- [ ] default branch `main`
- [ ] main direct push를 막거나 PR review 절차 사용
- [ ] collector workflow permission은 기본 `contents: read`
- [ ] runtime data를 Git에 commit하지 않음
- [ ] Actions에서 ChatGPT Sites Deploy를 호출하지 않음

현재 저장소는 public이다. key와 개인정보를 commit하지 않는 한 기술적으로 가능하지만, 소스·계획의 공개를 원하지 않으면 구현 시작 전에 private로 전환한다.

## C. 서울 열린데이터광장

- [ ] 계정 생성 또는 기존 계정 사용
- [ ] production Open API 인증키 발급
- [ ] 실시간 도시데이터 API service name/format 확인
- [ ] 121개 장소 수집에 적용되는 quota 확인
- [ ] `SEOUL_OPEN_DATA_KEY`를 GitHub Actions Secret에 저장

이 key는 ChatGPT Sites에 저장하지 않는다. GitHub Actions collector만 원천 API를 호출한다.

## D. Kakao Developers

- [ ] application 생성
- [ ] JavaScript map product 활성화
- [ ] JavaScript key 확인
- [ ] localhost domain 등록
- [ ] approved Sites URL 생성 후 해당 domain 등록
- [ ] `PUBLIC_KAKAO_JAVASCRIPT_KEY`를 Sites hosted public value에 입력

일반 주소 검색을 포함할 때만:

- [ ] Local REST API 활성화
- [ ] `KAKAO_REST_API_KEY`를 Sites secret에 입력

## E. Secret names

| Name | GitHub Actions | ChatGPT Sites | Client visible | Purpose |
|---|---:|---:|---:|---|
| `SEOUL_OPEN_DATA_KEY` | required | no | never | Seoul source collection |
| `SITE_INGEST_URL` | required after approved deployment | no | never | Sites protected route |
| `SITE_INGEST_TOKEN` | required | required | never | write authentication |
| `PUBLIC_KAKAO_JAVASCRIPT_KEY` | no | required | yes, domain-restricted | map SDK |
| `KAKAO_REST_API_KEY` | no | optional | never | optional geocoding |
| `COLLECT_INTERVAL_MINUTES` | optional | no | no | 15/30/60 minute decision |

`SITE_INGEST_TOKEN`은 32 random bytes 이상으로 생성하고 GitHub와 Sites에 별도로 동일 값을 입력한다. 값을 채팅이나 문서에 붙이지 않는다.

## F. 공유 결정

### Selected users/groups

계정에서 지원되고 가족이 초대 계정으로 로그인할 수 있을 때 사용한다.

### Public link

가족이 로그인 없이 열어야 할 때 사용한다. 이 경우 이름·일정·집 주소·위치 이력·검색 이력·free-text submission을 저장하지 않는다.

## G. 필요하지 않음

```text
Vercel account/token/project
external application database
separate backend server
Netlify/Cloudflare/Firebase hosting
custom domain for v1
OpenAI API key
```

## H. 준비 순서

1. Sites 접근과 D1/hosted settings 확인
2. GitHub Actions 확인
3. Seoul API key 발급
4. Kakao app/JavaScript key 생성
5. Phase 00 capability proof
6. approved Site URL domain을 Kakao에 등록
7. `SITE_INGEST_URL`·token을 Actions에 입력
8. Phase 02 acceptance 후 production collection 시작
