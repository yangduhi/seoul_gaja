# Design Authority — Calm Glass

## 1. 목적

`Calm Glass`는 서울 가자 — 인파 레이더의 구현 권위 디자인이다. 핵심은 화려한 반투명 효과가 아니라 **빠르게 판단할 수 있는 정보 계층**이다.

- Glassmorphism: 배경과 콘텐츠를 부드럽게 분리
- Apple-app inspired: 큰 제목, 명확한 계층, bottom sheet, segmented control, 자연스러운 motion
- 서울 지도 서비스: 혼잡도 색상, 지도와 목록의 동시 탐색
- 가족용: 공격적인 경고보다 차분하고 이해하기 쉬운 문구

Apple의 상표, 전용 아이콘, 화면을 복제하지 않는다. 시스템 폰트와 자체 컴포넌트를 사용한다.

## 2. 디자인 권위 순서

1. 이 문서
2. `design-tokens.json`
3. `component-contracts.md`
4. `screen-specs.md`
5. `mockups/*.png`
6. `ai-concept-boards/*.png`

AI concept board의 텍스트, 숫자, API 이름, 로고는 구현 근거가 아니다.

## 3. 디자인 원칙

### 3.1 Calm hierarchy

- 한 화면에 primary decision은 하나만 둔다.
- 현재 혼잡도, 방문 추천 시각, 주요 생활정보를 먼저 보인다.
- 분석용 정보는 상세나 패턴 화면으로 이동한다.

### 3.2 Glass with restraint

- glass panel은 최대 3개 depth만 허용한다.
- body text가 놓이는 panel은 opacity 0.72 이상을 권장한다.
- 지도 위 floating control만 강한 blur를 사용한다.
- 카드마다 다른 임의 blur·shadow를 금지한다.

### 3.3 Truthful color

| 상태 | 색 | 의미 |
|---|---|---|
| 여유 | Green `#34C759` | 상대적으로 낮은 혼잡 |
| 보통 | Cyan `#5AC8FA` | 일반적인 수준 |
| 약간 붐빔 | Amber `#FF9F0A` | 방문 전 확인 권장 |
| 붐빔 | Red `#FF453A` | 혼잡도가 높은 상태 |
| Unknown | Gray `#8E99A8` | 원천값 없음 |

색상만 사용하지 않고 항상 텍스트와 아이콘 또는 aria-label을 함께 제공한다.

### 3.4 Range, not false precision

- `8,100~9,200명`처럼 범위를 크게 표시한다.
- source time을 범위 아래 보조문구로 제공한다.
- carried-forward, delayed, expired를 숨기지 않는다.

## 4. 화면 구조

### Mobile

1. status/header
2. search
3. 목적 preset chips
4. map 또는 fallback banner
5. legend
6. place list bottom sheet
7. bottom navigation

장소 선택 후에는 full-height route가 아니라 bottom sheet를 우선한다. detail content가 길면 sheet가 90%까지 확장된다.

### Desktop 1616×923

```text
[Explorer 390] [Map flexible] [Detail 410]
```

- 좌측: 검색·preset·목록·수집 상태
- 중앙: 지도·legend·filter
- 우측: 선택 장소의 현재값·예측·생활정보·공유
- 중앙 지도 최소폭 620px
- detail이 닫히면 지도 공간을 확장

## 5. 주요 화면

### 5.1 Home map

- 큰 제목 `서울 가자 — 인파 레이더`
- `14:35 기준 · 121곳`
- 검색 입력
- `내 주변 / 아이와 / 데이트 / 지금 핫플`
- 혼잡도 marker
- 하단 장소 목록

### 5.2 Place detail

- 장소명과 원천 시각
- 혼잡도 badge
- 인구 범위
- `가면 좋은 시간`
- 공식 forecast line chart
- 주차·따릉이·사고·행사 four-up metrics
- Kakao/Naver 길찾기
- 가족 공유 CTA

### 5.3 Family recommendation

- 목적 preset
- 현재 추천 조건 요약
- top 3 recommendation
- 각 row에 점수, 현재 혼잡, 거리, 추천 이유
- history maturity와 confidence

### 5.4 History insight

- maturity state
- 누적기간·유효 sample·결측률
- weekday×hour heatmap
- 토요일/일요일 방문 제안
- 공식 forecast와 역사 pattern을 시각적으로 분리

## 6. 색상

Light background:

- Base: `#EEF3FB`
- Secondary gradient: `#F8F2FF`, `#EDF9F7`
- Text primary: `#0D1726`
- Text secondary: `#657387`

Dark background:

- Base: `#07101D`
- Elevated: `#111B2D`
- Text primary: `#F7F9FC`
- Text secondary: `#9BA9BD`

Brand:

- Blue: `#0A84FF`
- Indigo: `#5E5CE6`
- Purple: `#8E7DFF`

## 7. Glass recipes

### Floating control

```css
background: rgba(255,255,255,.62);
border: 1px solid rgba(255,255,255,.68);
backdrop-filter: blur(26px) saturate(145%);
box-shadow: 0 18px 50px rgba(31,48,73,.16);
```

### Content card

```css
background: rgba(255,255,255,.82);
border: 1px solid rgba(255,255,255,.72);
backdrop-filter: blur(30px) saturate(150%);
```

Dark mode에서는 white opacity를 0.05~0.09 범위로 사용하고 border를 0.09~0.14로 제한한다.

## 8. Typography

```css
font-family: -apple-system, BlinkMacSystemFont,
             "Segoe UI", "Noto Sans KR", sans-serif;
```

| 용도 | 크기 | weight |
|---|---:|---:|
| Large title | 28–34 | 800–850 |
| Screen title | 21–24 | 800 |
| Card title | 17–19 | 750–800 |
| Body | 14–16 | 450–600 |
| Caption | 11–12 | 450–600 |
| Badge | 10–12 | 750–800 |

숫자 범위는 tabular number를 권장한다.

## 9. Radius·spacing

- radius: 14 / 18 / 22 / 28 / 36
- mobile outer margin: 18px
- card internal padding: 14–18px
- card gap: 10–12px
- touch target: 최소 44×44px
- bottom navigation: 68–74px

## 10. Motion

- duration: 160ms / 240ms / 360ms
- easing: `cubic-bezier(.2,.8,.2,1)`
- bottom sheet: translate + opacity
- marker selection: scale 1 → 1.08 → 1
- chart reveal은 360ms 이하
- `prefers-reduced-motion: reduce`일 때 모든 비필수 transition을 제거

## 11. Accessibility

- body text contrast 4.5:1 목표
- large text 3:1 이상
- focus ring: 2px brand blue + 2px offset
- map marker는 keyboard list에서 동일 장소로 접근 가능해야 함
- chart에는 table 또는 text summary 제공
- bottom sheet는 focus trap, Escape close, trigger focus restore
- blur 미지원 브라우저에는 불투명 background fallback

## 12. 콘텐츠 문구

권장:

- `14:30 원천 기준`
- `추정 범위 · 실제 현장과 차이가 있을 수 있음`
- `18:00 이후 보통 예상`
- `데이터 축적 34일 · 참고용 패턴`
- `지도 연결이 지연되어 목록으로 표시합니다`

금지:

- `현재 정확히 8,800명`
- `18시에 반드시 한산`
- `안전함`
- `AI가 예측한 정확한 인파`

## 13. Design Pack 관리

- 모든 디자인 변경은 `design/change-log.md`에 기록한다.
- token 변경은 `design-tokens.json`과 실제 CSS를 동시에 변경한다.
- 주요 화면 변경 시 동일 viewport screenshot을 갱신한다.
- Codex는 screenshot과 DOM measurement를 함께 검증한다.
- AI concept board를 수정해도 implementation contract가 자동 변경되지 않는다.
- 최종 UI 리뷰는 `design-review-checklist.md`를 사용한다.
