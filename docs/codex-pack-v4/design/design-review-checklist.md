# Design Review Checklist

## Authority

- [ ] design.md와 token이 코드에 반영됨
- [ ] AI concept board의 잘못된 문구를 복사하지 않음
- [ ] reference site의 로고·아이콘·문구·asset을 복제하지 않음

## Layout

- [ ] 390×844 overflow 없음
- [ ] 430×932 overflow 없음
- [ ] 1616×923 overflow 없음
- [ ] fixed nav가 content를 가리지 않음
- [ ] mobile bottom sheet와 desktop drawer가 동일 정보 순서 사용

## Glass

- [ ] panel depth 3단계 이하
- [ ] body text panel opacity 충분
- [ ] blur 미지원 fallback 확인
- [ ] shadow가 과도하지 않음

## Data UI

- [ ] population 범위 표시
- [ ] source time 표시
- [ ] stale/carried-forward/expired 구분
- [ ] official forecast와 history pattern 구분
- [ ] color 외 label/icon 제공

## Interaction

- [ ] touch target 44px 이상
- [ ] visible focus
- [ ] Escape close
- [ ] focus restore
- [ ] reduced motion
- [ ] keyboard로 장소 선택 가능

## Content

- [ ] `정확히`, `반드시`, `안전` 같은 과장 문구 없음
- [ ] history maturity와 sample count 표시
- [ ] public link 경계 안내
