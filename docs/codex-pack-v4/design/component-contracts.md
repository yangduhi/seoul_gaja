# Component Contracts

## `CrowdBadge`

Inputs:

- `level: RELAXED | NORMAL | BUSY | CROWDED | UNKNOWN`
- `label: string`
- `size: sm | md`

Rules:

- color, text, icon/aria-label을 함께 사용
- UNKNOWN은 회색과 `정보 없음`
- badge만으로 current freshness를 표현하지 않음

## `GlassPanel`

Inputs:

- `depth: floating | content | strong`
- `interactive: boolean`

Rules:

- depth는 3단계만 사용
- interactive panel은 focus style 필수
- backdrop-filter 미지원 fallback 필수

## `PlaceListItem`

Content:

- rank 또는 status icon
- official place name
- distance, 선택 시
- population range, available 시
- crowd badge
- freshness/replacement indicator, 필요한 경우

State:

- default, hover, focus, selected, unavailable

## `MapMarker`

- crowd color
- white outline
- selected scale 1.08
- cluster는 숫자를 표시하되 crowd level을 단일 색으로 왜곡하지 않음
- 동일 장소의 list item과 selection state 공유

## `SearchBar`

- 공식 장소명 검색은 항상 제공
- Kakao address search가 unavailable이면 자동으로 공식 장소명 검색만 유지
- clear button과 keyboard Escape 지원

## `PresetChip`

- single-select
- `내 주변`은 별도 action이며 목적 preset과 동시에 활성화될 수 있음
- selected state는 fill + text contrast로 표현

## `PlaceDetailSheet`

- mobile bottom sheet, desktop right drawer
- initial focus는 제목이 아니라 첫 interactive element 또는 sheet container
- Escape close
- close 후 trigger focus restore
- content section 실패를 전체 sheet 실패로 만들지 않음

## `ForecastChart`

- 공식 future points만 표시
- 점 개수가 부족하면 chart 자체를 숨김
- smoothing으로 새로운 y value 생성 금지
- text summary와 data table 접근성 제공

## `HistoryHeatmap`

- maturity가 PROVISIONAL 이상일 때만 표시
- cell color 외 tooltip/text table 제공
- missing cell은 gray hatch 또는 `—`
- sample count가 적으면 opacity를 낮추되 숨기지 않음

## `FamilyRecommendationCard`

- score 0~100
- current crowd
- distance, available 시
- 최대 3개의 추천 이유
- history maturity 표시
- score 구성 요소를 확장해서 볼 수 있어야 함

## `HealthPill`

State:

- NORMAL
- DELAYED
- PARTIAL
- UNAVAILABLE

원천 시각과 scheduler 상태를 혼동하지 않도록 tooltip 또는 detail text를 제공한다.
