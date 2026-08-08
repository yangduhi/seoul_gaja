# 결정 로그

| ID | 결정 | 이유 |
|---|---|---|
| D01 | ChatGPT Sites가 유일한 application host/deploy/share surface | 별도 배포 서비스 제거 |
| D02 | GitHub repository를 source/review authority로 사용 | 기존 `yangduhi/seoul_gaja` 활용 |
| D03 | GitHub Actions를 production scheduler로 사용 | Sites background service를 가정하지 않음 |
| D04 | Sites D1을 유일한 production structured store로 사용 | runtime/data surface 단순화 |
| D05 | missing Sites capability는 `NOT_RUN_BLOCKED` | external host/DB fallback 방지 |
| D06 | public read + token-protected write | family-minimal threat model |
| D07 | login/profile/location history 제외 | privacy/operations 최소화 |
| D08 | raw 7일, hourly 90일, daily 730일, profile long-lived | 품질과 저장량 균형 |
| D09 | custom current/12h prediction 제외 | official data와 혼동 방지 |
| D10 | deterministic recommendations | 재현성·설명 가능성 |
| D11 | Codex/ChatGPT는 review·proposal 역할 | 숫자 truth와 scheduler 분리 |
| D12 | Calm Glass design | family utility와 정보 계층 균형 |
| D13 | concept images are non-authoritative | generated text/geometry uncertainty |
| D14 | GitHub Actions never deploys Sites | exact-commit Save version release gate 유지 |
