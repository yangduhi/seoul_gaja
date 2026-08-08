# Visual contract repair evidence

This evidence uses `visualFixture=ready-v1`, which is deterministic development-only fixture data. It does not prove a live API, Sites, or D1 capability.

## Scenarios

- Direct desktop detail: `npx playwright screenshot --browser chromium --channel msedge --viewport-size '1616,923' --wait-for-selector '[data-detail-surface="FULL_SCREEN"]' --wait-for-timeout 500 'http://localhost:3005/places/alpha?visualFixture=ready-v1' .omo/evidence/visual-contracts-e498bcb/direct-detail-1616x923.png`. The non-empty 1616x923 PNG visibly shows the canonical direct route centered at its standalone maximum width.
- Desktop map: `npx playwright screenshot --browser chromium --channel msedge --viewport-size '1616,923' --wait-for-selector '[data-selected-area-code]' --wait-for-timeout 500 'http://localhost:3005/?visualFixture=ready-v1' .omo/evidence/visual-contracts-e498bcb/home-1616x923.png`. The non-empty 1616x923 PNG visibly shows the map legend bottom-centered.
- Mobile map at 390x844 and 430x932: the same invocation with each viewport writes `home-390x844.png` and `home-430x932.png`. Both non-empty PNGs visibly show the legend above the list sheet and fixed navigation; the chip controls retain the 44px CSS touch target.
- Contract checks: `node --test tests/product/detail-history/detail-contract.test.mjs tests/product/catalog/catalog-contract.test.mjs` exited 0 with 7 passing tests. The preceding RED run exited 1 with exactly the two new visual-contract tests failing before implementation.
- Type and lint checks: `npx tsc --noEmit` exited 0. Targeted `npx eslint` exited 0 with only the existing configuration warnings that CSS files have no matching ESLint configuration.

## Captured artifact validation

Each PNG was opened after capture. The four artifacts have the requested dimensions, PNG signature `89-50-4E-47-0D-0A-1A-0A`, and non-zero length.
