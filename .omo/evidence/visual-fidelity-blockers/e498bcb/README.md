# Exact-head visual fidelity evidence

Source identity: commit `e498bcb938731e10b31066e972dfd814ad5ff70b`, tree `94deab8a3ccf205704a1e3e8f05f68f5ed4485e1`.

The local ready-state path is explicitly fixture-only. `app/_visual-evidence/ready-fixture.ts` adapts the checked-in `tests/fixtures/product/data/ready.json` through the production read-model parsers. `app/_visual-evidence/resolve.ts` rejects it unless `NODE_ENV === "development"` and `visualFixture=ready-v1`. It does not call a live API, read a secret, execute a migration, or assert live/Sites/D1 capability.

## Scenarios and binary observables

- Token authority: `npm run tokens:check`; exit `0` proves `app/design-tokens.generated.css` exactly equals generator output from `design/design-tokens.json`. `rg -n "#[0-9A-Fa-f]{3,8}|rgba?\\(" app/_catalog/CatalogSurface.module.css app/places/[areaCode]/PlaceDetail.module.css` returned exit `1`, recorded as `DIRECT_COMPONENT_COLOR_LITERAL_MATCHES=0`.
- Home ready mobile: `playwright screenshot --channel msedge --viewport-size "390, 844" --wait-for-selector '[data-selected-area-code]' --wait-for-timeout 500 "http://localhost:4173/?visualFixture=ready-v1" home-390x844.png`; selector found and non-empty PNG captured.
- Home ready desktop: same invocation at `1616, 923`; selector found and non-empty `home-1616x923.png` captured.
- Direct detail mobile/desktop: the same Playwright command targeted `/places/alpha?visualFixture=ready-v1` and `[data-detail-surface]`; both PNGs are non-empty.
- Selected-detail dashboard: Playwright targeted `/?visualFixture=ready-v1&visualState=selected-detail` and `[data-selected-area-code="alpha"]` at `1616x923`; `dashboard-selected-alpha-1616x923.png` proves the 390px explorer + flexible map + 410px selected-detail composition.
- Direct-route divergence: `detail-alpha-1616x923.png` separately records the canonical direct/reload route as a standalone right-aligned 410px detail surface. It is not used as evidence for the three-pane selected dashboard; that state has its own capture above.
- Static/product checks: `npx tsc --noEmit`, the 9 targeted `node --test` cases, targeted `npx eslint`, and `npm run build` each exited `0`. `git diff --quiet HEAD -- app design package.json scripts tests` emitted `EXACT_HEAD_PRODUCT_DIFF=0` before recording this report.

Hashes and exact state bindings are machine-readable in `provenance.json` beside the captures.

Residual: production-preview/live ready-state verification remains `NOT_RUN_BLOCKED`; the development fixture intentionally cannot activate there and these artifacts must never be reported as live capability proof.
