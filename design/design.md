# Design Authority — Calm Glass

## 1. Product character

`seoul_gaja` is a calm family decision tool, not a command center. It should let a parent answer three questions quickly:

1. Is the place crowded now?
2. When is a better time to go?
3. Is there practical context that changes the decision?

The visual direction combines restrained glassmorphism with an Apple-app-inspired information hierarchy. It must not copy Apple trademarks, proprietary icons, screenshots, or exact component layouts.

## 2. Design principles

### Calm before decorative

Glass effects frame information; they must not reduce contrast, legibility, or map clarity.

### One screen, one primary decision

The home screen prioritizes current conditions. The detail screen prioritizes source truth and official forecast. Historical patterns and recommendations are secondary.

### Provenance is visible

Official current data, official forecast, and first-party historical pattern use different labels and visual treatments.

### Family speed

The common path is no more than three actions:

```text
open Site → find/select place → decide or open route
```

### Graceful fallback

The list remains fully functional when the map SDK fails, location permission is denied, or some integrated data sections are missing.

## 3. Visual system

### Glass depth

Use no more than three levels:

1. `glass-surface`: page panels and large sheets;
2. `glass-control`: search, filter, segmented control, buttons;
3. `glass-popover`: temporary tooltip, menu, or status explanation.

Do not stack two blurred surfaces unless the inner element is small and interactive. Prefer an opaque/tinted inner surface when nesting is unavoidable.

### Shape

- mobile sheet radius: 28 px;
- major card radius: 24 px;
- compact control radius: 16–20 px;
- pill control radius: 999 px;
- minimum touch target: 44 × 44 CSS px;
- avoid decorative blobs behind dense text.

### Typography

Use the Sites starter’s system font stack. Korean must remain the primary typographic test language.

Recommended hierarchy:

```text
Display: 32/38, 700
Title 1: 26/33, 700
Title 2: 21/28, 650
Headline: 17/23, 650
Body: 16/23, 400
Callout: 15/21, 500
Caption: 13/18, 500
Micro: 12/16, 500
```

No essential label may use less than 12 CSS px.

### Motion

- standard transition: 180–240 ms;
- bottom sheet: spring-like but bounded, no overshoot that obscures content;
- map marker selection: scale or halo only;
- loading: skeleton or subtle pulse, not constant moving gradients;
- honor `prefers-reduced-motion` by removing nonessential transforms and smooth scrolling.

## 4. Congestion semantics

The exact accessible palette is finalized by automated contrast checks. Semantic states require both text and color:

```text
여유
보통
약간 붐빔
붐빔
정보 없음
```

Never rely on green/red alone. Every marker has an accessible name containing place, state, and source time.

Historical maturity uses a separate neutral/indigo scale so it cannot be confused with current congestion.

## 5. Information architecture

### Mobile

```text
Home
 ├─ search and family modes
 ├─ map or list-only surface
 ├─ current legend and freshness
 └─ nearby/place list sheet

Place detail
 ├─ current official state
 ├─ best-time guidance derived from official forecast
 ├─ official 12-hour forecast
 ├─ practical city context
 ├─ usual pattern from accumulated history
 └─ route/share actions

Patterns
 ├─ weekday × time heatmap
 ├─ maturity and coverage
 └─ collection quality explanation
```

### Desktop

Three-pane layout at 1616 × 923:

```text
left 360–400 px: search, filters, result list
center flexible: map and map status
right 400–460 px: selected-place detail
```

At narrower desktop widths, the right panel becomes a modal sheet. The page must never create horizontal document overflow.

## 6. Screen contracts

### Home map

Required:

- product name and current source status;
- search;
- family mode chips;
- congestion legend;
- map markers or list-only fallback;
- synchronized place cards;
- source update time;
- explicit refresh/delay state.

### Place detail

Required:

- place name and category;
- official current congestion and population range;
- source time and fetched time;
- official forecast chart;
- derived better-time card with explanation;
- available practical context sections;
- history section with maturity;
- route and share actions.

### Family recommendation

Each recommendation card exposes:

- recommendation mode;
- place and current state;
- deterministic reasons;
- forecast/historical inputs used;
- confidence or suppression reason;
- source time.

### History

Required:

- maturity badge;
- period and valid coverage;
- sample count or quality explanation;
- weekday × time heatmap;
- clear statement that history does not replace official current/forecast data.

## 7. State matrix

Every major surface supports:

```text
LOADING
READY
DELAYED
STALE
EXPIRED
PARTIAL
UNAVAILABLE
ERROR
```

Rules:

- `DELAYED`: show data with source age explanation.
- `STALE`: show only when the stale threshold permits, with a prominent label.
- `EXPIRED`: hide current number/forecast and show unavailable guidance.
- `PARTIAL`: keep independent sections available; do not show a global success state.
- `ERROR`: include retry when safe and preserve last-known-good only with original time.

## 8. Map behavior

- Markers cluster only when needed to avoid overlap.
- Selected marker, list card, and detail title remain synchronized.
- Panning the map must not silently redefine the place list unless a visible “이 지역 검색” action is used.
- Location is requested only after the user selects `내 주변`.
- Location is not persisted.
- When Kakao fails, replace the map with a status panel and keep search/filter/list/detail fully functional.

## 9. Accessibility

Acceptance requirements:

- keyboard reachable controls and visible focus;
- logical heading hierarchy;
- accessible names for markers, charts, icon buttons, and status chips;
- text alternatives for chart trends;
- minimum WCAG AA contrast for essential text and controls;
- 200% zoom without loss of operation;
- reduced-motion support;
- no color-only meaning;
- screen-reader announcement for data refresh and errors without repetitive noise.

## 10. Design references and pack management

Approved generated images from the conversation must be copied into:

```text
design/references/concept-01-system-and-design-board.png
design/references/concept-02-light-family-architecture-board.png
design/references/concept-03-family-product-board.png
design/references/concept-04-dark-product-system-board.png
design/references/01-home-map-light.png
design/references/02-place-detail-light.png
design/references/03-family-recommendations-light.png
design/references/04-history-insights-dark.png
design/references/05-desktop-dashboard.png
```

Reference priority:

```text
design/design.md
→ design/tokens.json
→ implemented component contracts and tests
→ deterministic screenshots
→ generated concept images
```

Generated images are direction references only. Their text, numbers, logos, and map geometry are not product data or implementation authority.

Each approved visual change updates:

1. `design/design.md` if the rule changes;
2. `design/tokens.json` if a token changes;
3. deterministic browser screenshots;
4. `design/CHANGELOG.md` with the reason and affected screens.

## 11. Anti-patterns

Do not use:

- excessive blur that makes content muddy;
- five or more competing gradients;
- translucent text directly on a complex map;
- tiny gray metadata below accessible contrast;
- imitation Apple logos or native-app screenshots;
- generic dashboard grids on the mobile home screen;
- invented metrics or unexplained recommendation scores;
- automatic carousels;
- glass treatment on every element;
- map-only operation without a list alternative.