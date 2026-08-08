# Automation Start Here

## 역할 분담

- **GitHub Actions:** 서울시 데이터 수집, 검증, Sites ingest, 시간별·일별 집계 trigger, retention, deterministic quality metrics
- **ChatGPT Sites:** public/family UI, server routes, hosted values, D1, versions, deployment, sharing
- **Codex:** 코드·계약·workflow·visual regression 검토와 PR 제안
- **ChatGPT:** owner가 deterministic quality report를 읽고 운영 판단을 내릴 때 사용

Codex나 ChatGPT conversation은 production scheduler가 아니다. OpenAI API key도 초기 제품에 필요하지 않다.

## 기본 cron

```text
7,22,37,52 * * * *  current collection
17 * * * *           hourly materialization trigger
27 18 * * *          daily maintenance, 03:27 KST
37 19 * * 6          weekly quality, Sunday 04:37 KST
```

GitHub Actions schedule은 정확한 시각을 보장하지 않으므로 모든 job은 지연·누락·중복에 안전해야 한다. 실제 수집 interval은 Seoul API quota probe 후 15/30/60분 중 결정한다.

## 금지

- GitHub Actions에서 ChatGPT Site Deploy
- Site sharing/access 변경
- runtime history를 Git commit으로 누적
- external DB에 write
- Codex/ChatGPT가 숫자를 생성·보정

Template 위치: `templates/github-actions/`
