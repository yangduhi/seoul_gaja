# 데이터 누적과 품질 향상 전략

## 1. 누적으로 안정화되는 것

- 요일×시간대 혼잡도 대표값과 분산
- 장소별 평소 범위와 이상치 탐지
- “평소 이 시간보다 붐빔/여유” 비교
- 가족 방문 시간대 추천의 confidence
- API 결측률·지연률·schema drift 감지

## 2. 누적으로 바뀌지 않는 권위값

- 서울시 공식 현재 인구 추정
- 서울시 공식 혼잡 단계
- 서울시 공식 향후 12시간 예측
- 실제 현장 인구

프로젝트 history는 공식 현재·예측을 보정하거나 대체하지 않는다.

## 3. Scheduler

GitHub Actions가 유일한 production scheduler다. ChatGPT Sites background service, Codex run 또는 ChatGPT conversation을 수집 권위로 사용하지 않는다.

| Job | Cron | 목적 |
|---|---|---|
| current collection | `7,22,37,52 * * * *` | 기본 15분 근사 수집 |
| hourly materialization | `17 * * * *` | 누락된 완료 hour 집계 |
| daily maintenance | `27 18 * * *` | 03:27 KST retention/summary |
| weekly quality | `37 19 * * 6` | 일요일 04:37 KST deterministic report |
| manual replay | `workflow_dispatch` | bounded recovery |

실제 quota가 부족하면 30분 또는 60분으로 낮춘다. 여러 key/account로 quota를 우회하지 않는다.

## 4. Data flow

```text
GitHub Actions
→ source bytes stable-read/hash/decode/parse
→ semantic validation
→ normalized payload
→ ChatGPT Sites protected ingest route
→ D1 current + history + receipt
```

Runtime data는 Git에 commit하지 않는다.

## 5. Retention

```text
15-minute raw       7 days
hourly observation  90 days
daily summary       730 days default
weekday/hour profile long-lived
job receipts         90 days
```

D1 plan/usage limit이 가까워지면 raw retention을 먼저 줄이되 current snapshot과 quality metadata는 보존한다.

## 6. Maturity

| State | Minimum elapsed | Minimum coverage | UI |
|---|---:|---:|---|
| `ACCUMULATING` | 0 days | none | 데이터 축적 중 |
| `PROVISIONAL` | 7 days | 70% | 참고용 패턴 |
| `STABLE` | 28 days | 80% | 안정화된 패턴 |
| `MATURE` | 56 days | 90% | 높은 신뢰도의 반복 패턴 |

elapsed time, valid sample count and coverage 중 가장 낮은 기준을 적용한다. 최근 수집 품질이 낮아지면 maturity가 하락할 수 있다.

## 7. Deterministic recommendation

추천은 versioned rule과 저장된 입력만 사용한다. LLM이 점수나 결측값을 만들지 않는다.

```text
current crowd             0–35
official forecast quality 0–20
history confidence        0–15
incident/control          0–10
transport/parking         0–10
purpose fit               0–10
```

입력 coverage가 부족하면 recommendation을 숨기거나 이유와 함께 제한한다.

## 8. Codex·ChatGPT 운영 루프

### Weekly deterministic workflow

생성 항목:

- scheduled/accepted/failed run counts
- 121-place coverage
- stale/carried/unavailable rates
- schema/parser failures
- D1 usage/retention status
- maturity changes
- client performance/a11y regression result

### Codex review

`codex/weekly-maintenance-prompt.md`를 통해 source/contract/test/design drift와 개선 patch를 제안한다. 자동 merge·deploy·secret rotation은 금지한다.

### ChatGPT owner review

owner가 weekly JSON/Markdown report를 ChatGPT에 첨부해 운영 요약과 우선순위를 검토할 수 있다. 별도 OpenAI API key나 unattended ChatGPT automation은 초기 범위가 아니다.

## 9. Recovery

1. unsafe write 가능성이 있으면 collector를 pause한다.
2. latest accepted D1 generation과 receipt를 확인한다.
3. bounded missed slot을 `workflow_dispatch`로 replay한다.
4. idempotency로 duplicate를 방지한다.
5. quota/limits가 원인이면 interval 또는 retention을 줄인다.
6. UI는 original source time과 last-known-good/unavailable를 정직하게 표시한다.
7. 다른 host/database로 긴급 우회하지 않는다.
