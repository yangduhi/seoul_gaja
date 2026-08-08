# GitHub Actions Templates

이 파일들은 패킷 내부 template이다. Codex는 해당 Phase 구현과 test가 완료된 뒤 프로젝트의 `.github/workflows/`로 복사한다.

## Secrets

- `SEOUL_OPEN_DATA_KEY`
- `SITE_INGEST_URL`
- `SITE_INGEST_TOKEN`

선택:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## 원칙

- schedule workflow는 default branch에 있어야 한다.
- cron은 UTC다.
- 정각을 피한다.
- `concurrency`로 중복 실행을 제어한다.
- 데이터는 Git repository에 commit하지 않는다.
- workflow log에 upstream URL과 key를 출력하지 않는다.
