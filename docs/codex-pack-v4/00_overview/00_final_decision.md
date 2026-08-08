# 최종 결정 — ChatGPT Sites 단일 배포

## 결론

`seoul_gaja`는 **ChatGPT Sites + Sites D1 + GitHub Actions**로 구현한다.

- ChatGPT Sites: 유일한 app host, server runtime, D1, preview, version, deployment, sharing
- GitHub repository: source, contracts, design assets, migrations, tests, PR, evidence
- GitHub Actions: 서울시 데이터의 주기 수집·검증·집계와 protected ingest 호출
- Kakao JavaScript SDK: browser map

```text
서울시 API
  → GitHub Actions collector
  → ChatGPT Sites protected ingest route
  → ChatGPT Sites D1
  → ChatGPT Sites UI and family link
```

## 고정 경계

1. Vercel 및 다른 application host를 사용하지 않는다.
2. 외부 DB를 사용하지 않는다.
3. GitHub Actions는 Site를 배포하지 않는다.
4. Sites background scheduler를 production 권위로 사용하지 않는다.
5. D1·server route·hosted secret·external ingest가 실제 계정에서 지원되지 않으면 `NOT_RUN_BLOCKED`다.
6. 막힌 기능을 외부 서비스로 우회하려면 사용자가 architecture contract를 명시적으로 변경해야 한다.

## 가족 공유

우선순위:

1. 실제 계정에서 지원되고 가족이 로그인할 수 있으면 `Selected active users or groups`;
2. 편의성이 더 중요하면 `Anyone on the internet` 공개 링크;
3. 초기 버전에는 별도 login/authentication을 구현하지 않는다.

공개 링크는 비밀 링크가 아니므로 개인정보를 저장하지 않는다. `내 주변` 좌표는 명시적 클릭 후 브라우저 메모리에서만 사용한다.

## 누적 데이터의 의미

누적으로 개선되는 항목:

- 요일×시간 반복 패턴의 안정성
- 평소 대비 혼잡 비교
- 결측·지연 탐지
- deterministic family recommendation confidence

누적으로 개선된다고 주장하지 않는 항목:

- 서울시 공식 현재 인구 추정 자체
- 서울시 공식 12시간 예측 자체
- 실제 현장 인구의 절대 정확도

현재·공식 예측·프로젝트 누적 history는 UI와 schema에서 분리한다.
