# 리스크 등록부

| ID | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | Seoul API quota가 15분×121 요청을 허용하지 않음 | freshness 저하 | quota probe 후 30/60분으로 조정 |
| R2 | GitHub Actions schedule 지연·누락 | snapshot 지연 | 정각 회피, idempotent replay, visible health |
| R3 | owner account에서 Sites D1 또는 server route를 사용할 수 없음 | architecture blocked | Phase 00 `NOT_RUN_BLOCKED`; 외부 fallback 금지 |
| R4 | external caller가 Sites protected route에 도달하지 못함 | scheduled ingest 불가 | approved probe로 실증; 미지원 시 block |
| R5 | Kakao domain 미등록 또는 quota | map failure | domain checklist와 list-only fallback |
| R6 | 공개 링크가 전달됨 | 의도하지 않은 접근 | personal data 없음, narrowest supported sharing |
| R7 | concept board의 잘못된 text/number가 구현됨 | truth/design drift | design.md와 deterministic mockup 우선 |
| R8 | missing history를 0으로 채움 | false pattern | null/missing 유지, coverage gate |
| R9 | history가 official forecast를 개선한다고 오해 | 과장 | source authority를 UI/schema에서 분리 |
| R10 | glass blur로 contrast 저하 | usability/accessibility | token bounds와 AA checks |
| R11 | D1 usage/plan limit | retention 압박 | raw/hourly/daily tiering, visible capacity alert |
| R12 | source schema change | collection failure | contract fixtures, fail-closed parser, alerts |
| R13 | Actions에 deployment 권한 추가 | release bypass | workflow policy test, no Sites deploy step |
