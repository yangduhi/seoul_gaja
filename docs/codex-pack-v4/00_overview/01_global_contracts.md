# 전역 계약

## 1. 제품

- 제품명은 `서울 인파 레이더`다.
- 대상은 가족·지인 소수다.
- 로그인, 계정, 프로필, 결제, 광고, 댓글, 위치 이력을 만들지 않는다.
- 공식 121개 장소 밖의 인구를 임의 추정하지 않는다.

## 2. 데이터 진실성

- 현재 인구는 `최소~최대` 범위로 표시한다.
- 혼잡도는 원천 enum을 정규화한 텍스트·아이콘·색상으로 표시한다.
- `sourceUpdatedAt`, `fetchedAt`, `storedAt`을 분리한다.
- invalid·malformed 신규 응답은 현재 정상 snapshot을 덮어쓰지 않는다.
- 180분 초과 데이터는 `expired`로 현재 인구와 공식 예측을 숨긴다.
- 서울시 공식 forecast point만 사용한다. 보간·외삽으로 숫자를 만들지 않는다.
- 누적 데이터 기반 문구에는 sample count, 기간, maturity를 함께 제공한다.

## 3. 수집

- 기본 interval은 15분이다.
- 실제 API quota를 Phase 01에서 확인하고 `15|30|60`분 중 허용 가능한 값을 선택한다.
- GitHub Actions schedule은 정확한 시계가 아니다. 모든 job은 지연·중복 실행에 안전해야 한다.
- snapshot ID는 `source-time + catalog-version` 기반으로 결정적이어야 한다.
- 동일 snapshot ID 재전송은 동일 결과를 반환한다.

## 4. 저장·보존

- raw 15분 observation: 7일
- hourly observation: 90일
- daily summary: 2년 또는 저장 한도에 맞춰 조정
- weekday-hour profile: 장기 보관
- 현재 snapshot과 active catalog는 보존 기간과 무관하게 유지
- 결측을 0명 또는 여유로 저장하지 않는다.

## 5. 최소 보안

- public read API는 인증 없음.
- internal write API만 `Authorization: Bearer <SITE_INGEST_TOKEN>`을 요구한다.
- token은 32 random bytes 이상이며 GitHub Actions와 Sites secret store에만 존재한다.
- payload size limit은 5MB 이하, method는 POST만 허용한다.
- secret, raw upstream URL, precise coordinates를 로그하지 않는다.
- noindex는 접근 제어가 아니다.

## 6. 위치

- `내 주변` 버튼 클릭 전 위치 권한을 요청하지 않는다.
- 좌표는 브라우저 메모리에서만 거리 계산에 사용한다.
- 서버, DB, analytics, localStorage, share URL에 좌표를 보내지 않는다.

## 7. 디자인

- `design/design.md`가 시각 권위다.
- AI concept board는 스타일 탐색용이다.
- glass 효과는 본문 가독성을 해치지 않는 범위에서만 사용한다.
- crowd state는 색상만으로 전달하지 않는다.
- 44 CSS px 이상 touch target과 visible focus를 제공한다.
- mobile 390×844, 430×932와 desktop 1616×923을 검증한다.

## 8. AI 사용

- LLM은 수치 계산이나 source truth 결정을 담당하지 않는다.
- 주간 AI 요약은 deterministic metric JSON만 입력받는다.
- AI 출력 실패가 수집·저장·사이트 조회를 막지 않는다.
- OpenAI API 사용은 선택 사항이며 사용자 승인과 별도 비용 설정이 필요하다.

## 9. 배포

- Sites의 모든 Deploy URL을 production으로 취급한다.
- 순서: tests → screenshot review → Save version → 가족 preview → 승인 → Deploy → incognito smoke.
- 사용자 승인 없이 Deploy, access 변경, custom domain 연결을 수행하지 않는다.

## 10. Phase gate

- 상태는 `PASS`, `FAIL`, `NOT_RUN_BLOCKED`만 허용한다.
- external credential이 없어 live 검증을 못한 항목은 `NOT_RUN_BLOCKED`다.
- fixture test 통과만으로 live capability를 PASS 처리하지 않는다.
