# Seoul Gaja Design System

## 1. Authority and source order

The implementation contract is ordered as follows:

1. `docs/codex-pack-v4/design/design.md`
2. `design/design-tokens.json`
3. `docs/codex-pack-v4/design/component-contracts.md`
4. `docs/codex-pack-v4/design/screen-specs.md`
5. `docs/codex-pack-v4/design/mockups/*.png`

The deterministic mockups are `01-home-map-light.png`, `02-place-detail-light.png`, `03-family-recommendations-light.png`, `04-history-insights-dark.png`, and `05-desktop-dashboard.png`. AI concept boards are inspiration only and never pixel authority.

## 2. Product intent and truthful content

Calm Glass supports a family planner choosing between source-backed NOW and NEXT guidance or understanding why no recommendation is available. Preserve ranges, source timestamps, freshness, and unavailable/expired states. Never show unsupported score meanings or renormalize missing inputs.

## 3. Tokens

Use `design/design-tokens.json` as the machine-readable source. Light surfaces use `#EEF3FB`; dark surfaces use `#07101D`; primary text uses `#0D1726`; the focus color is `#0A84FF`. Glass has only `content`, `floating`, and `strong` depths. Gradients and elevated glass are reserved for the current-decision CTA.

## 4. Typography, spacing, and motion

Use the system Korean-capable sans stack declared in `app/globals.css`. Spacing tokens are 8, 10, 14, 18, and 28px. Panel and sheet radii are 22px and 28px. Motion uses 160ms, 240ms, or 360ms with `cubic-bezier(.2,.8,.2,1)` and is suppressed for `prefers-reduced-motion`.

## 5. Primitives and states

`GlassPanel` supports the three depth states and optional current-decision emphasis. `Navigation` is button-only and has default and active states. `PlaceDetailSheet` is keyboard-dismissible and modal. `ChartAlternatives` always pairs a summary with a table. `Phase03CatalogSurface` announces state changes through polite `aria-live`.

`PrimitiveShowcase` is test-only and route-less. It exercises each primitive and its declared presentation modes without adding public navigation, a Settings route, Help route, or design route.

## 6. Responsive geometry

Validate 390x844, 430x932, 768x1024, and 1616x923. Mobile keeps a 44px minimum target and a bottom-sheet presentation. The desktop dashboard uses a 390px explorer, flexible map, and 410px detail pane with 14px gaps. No primary action may clip or depend on horizontal page scrolling.

## 7. Accessibility and cognitive constraints

Visible focus uses a 2px blue ring with a 2px offset. Keyboard users can operate navigation and close a sheet with Escape. Status changes use polite `aria-live`; charts include a text summary and table; color is never the only status signal. Motion reduction, plain language, source times, and explicit unavailable/expired explanations reduce cognitive load.

## 8. Verification and accepted debt

The task-11 gates verify authority binding, deterministic mockup names, token/primitives-before-screen order, required states, responsive geometry, and route isolation. Visual QA is intentionally deferred to a consuming product route: this foundation has no authorized public route and mockups alone are not a visual PASS.
