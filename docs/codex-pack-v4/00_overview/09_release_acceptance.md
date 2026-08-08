# 최종 출시 수락 기준

## Platform boundary

- [ ] application host/runtime/deployment/share가 ChatGPT Sites뿐임
- [ ] structured production data가 Sites D1 `DB`에만 존재함
- [ ] GitHub Actions에 Site deploy/access-change step이 없음
- [ ] Vercel 또는 외부 host/database configuration/dependency가 없음
- [ ] `.openai/hosting.json`이 Sites-provisioned project linkage만 포함하고 secret이 없음

## Product truth

- [ ] official 121 places are unique and complete
- [ ] initial app data is loaded through one normalized snapshot route
- [ ] population is displayed as a range
- [ ] source/fetch times and freshness are visible
- [ ] fresh/carried/stale/expired/unavailable states are distinct
- [ ] official forecast uses source points only
- [ ] accumulated pattern shows period, samples, coverage and maturity
- [ ] recommendations expose deterministic reasons or suppression reason

## Automation and D1

- [ ] GitHub Actions current collection succeeds against approved Site ingest
- [ ] identical replay creates no duplicate
- [ ] conflicting replay is rejected
- [ ] failed transaction preserves previous active generation
- [ ] hourly/daily materialization is idempotent
- [ ] retention preserves current snapshot and profile metadata
- [ ] delayed collector state is visible
- [ ] runtime history is not committed to Git

## Privacy and security

- [ ] secret scan PASS
- [ ] client bundle/logs/evidence contain no Seoul key, REST key or ingest token
- [ ] browser coordinates are not sent or persisted
- [ ] no login/profile/personal data/free-text collection
- [ ] Site is for adult family planners, not direct child users
- [ ] selected sharing audience is tested from intended visitor path
- [ ] public-link boundary is disclosed when applicable

## Design and accessibility

- [ ] design tokens and component contract match implementation
- [ ] five deterministic mockups match information architecture
- [ ] 390×844, 430×932 and 1616×923 have no document overflow
- [ ] glass surfaces preserve essential text/control contrast
- [ ] status is not color-only
- [ ] keyboard/focus/reduced-motion/chart alternative pass
- [ ] map failure leaves a fully usable list

## Release

- [ ] exact commit/tree and migrations are reviewed
- [ ] all required tests and fresh browser captures pass
- [ ] Save version completed and associated with exact commit
- [ ] family candidate review completed
- [ ] explicit owner approval recorded
- [ ] Kakao deployment domain registered
- [ ] selected saved version deployed through ChatGPT web/desktop
- [ ] production visitor-path smoke passes
- [ ] production ingest smoke passes
- [ ] previous saved version/rollback and take-down instructions verified
