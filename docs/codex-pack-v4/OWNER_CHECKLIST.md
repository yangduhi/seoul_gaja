# Owner Checklist — `yangduhi/seoul_gaja`

## 필수 계정·권한

- [ ] ChatGPT 계정에서 Sites 메뉴가 보임
- [ ] local project 기반 Site 생성 또는 준비 가능
- [ ] Save version 가능
- [ ] Deploy 가능
- [ ] D1 storage 추가 가능
- [ ] hosted environment values/secrets 설정 가능
- [ ] 가족 공유에 사용할 access option 확인
- [ ] GitHub 저장소 `yangduhi/seoul_gaja` admin 권한 확인
- [ ] GitHub Actions 활성화
- [ ] 서울 열린데이터광장 Open API 인증키 발급
- [ ] Kakao Developers 앱과 JavaScript key 발급

## 필수 Secret·환경값

### GitHub Actions Secrets

- [ ] `SEOUL_OPEN_DATA_KEY`
- [ ] `SITE_INGEST_URL` — approved Site deployment 후 입력
- [ ] `SITE_INGEST_TOKEN`

### ChatGPT Sites Settings

- [ ] `SITE_INGEST_TOKEN` — GitHub와 동일 값
- [ ] `PUBLIC_KAKAO_JAVASCRIPT_KEY`

실제 값은 채팅, prompt, issue, commit, log, screenshot, evidence에 기록하지 않는다.

## Kakao domain

- [ ] localhost 개발 domain 등록
- [ ] Sites preview 또는 approved deployment domain 확인
- [ ] 실제 사용 domain을 Kakao JavaScript SDK 허용 domain에 등록

## 공유 방식

- [ ] `Selected active users or groups`가 실제 가족에게 사용 가능한지 확인
- [ ] 불가능하면 공개 링크 사용 여부 결정
- [ ] 공개 링크 선택 시 개인 일정·가족 이름·집 주소·위치 이력·검색 이력을 저장하지 않음

## 선택

- [ ] 일반 주소 검색 승인 시 `KAKAO_REST_API_KEY`
- [ ] custom domain — 초기 릴리스에는 권장하지 않음
- [ ] 홈 화면 icon/PWA — Sites runtime 실증 후 결정

## 필요하지 않음

- Vercel account/token/project
- 외부 application database
- 별도 backend server
- Cloudflare/Netlify/Firebase hosting
- OpenAI API key

상세 절차: `00_overview/04_owner_prerequisites.md`
