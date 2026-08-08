# Screen Specifications

## 01 Home Map — Mobile 430×932

Reference: `mockups/01-home-map-light.png`

- header 112px 내
- search 48px
- preset chip row 38px
- map visible area 최소 360px
- legend map 위 floating
- bottom sheet collapsed height 약 260px
- bottom nav 70px
- list item 60px 이상

## 02 Place Detail — Mobile 430×932

Reference: `mockups/02-place-detail-light.png`

- large crowd card at top
- population range 28–34px
- forecast card 190–215px
- four metrics in one row
- share CTA primary
- nav fixed bottom

## 03 Family Recommendations — Mobile 430×932

Reference: `mockups/03-family-recommendations-light.png`

- top purpose chips
- rule summary card
- recommendation card height 92–104px
- score circle 42px
- maturity card

## 04 History Insight — Mobile Dark 430×932

Reference: `mockups/04-history-insights-dark.png`

- dark mode base `#07101D`
- maturity card
- 7-column heatmap
- missing cell visually distinct
- weekend summary

## 05 Desktop Dashboard — 1616×923

Reference: `mockups/05-desktop-dashboard.png`

- outer padding 14px
- explorer 390px
- detail 410px
- gap 14px
- panel radius 30px
- map legend bottom center
- no page-level vertical scroll at reference viewport
- internal list/detail scroll is allowed

## Loading

- skeleton은 최대 1.5초 이후 stale indicator로 전환
- 무한 spinner 금지
- snapshot unavailable이면 official catalog list와 retry action 제공

## Map unavailable

- central pane에 neutral illustration와 `지도를 불러오지 못했습니다`
- explorer list와 detail은 유지
- retry와 Kakao map external link 제공

## Expired data

- population number와 forecast를 숨김
- `최근 데이터 확인 불가`
- 마지막 정상 시각은 보조문구로 표시 가능
