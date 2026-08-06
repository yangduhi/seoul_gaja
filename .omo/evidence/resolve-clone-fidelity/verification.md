# Clone-fidelity token and map verification

- Base: `ba26b2f53ecf9974c17b1dface8773e558070b8d` / tree `4a1361afdfc3cf872024eeba7918d8286d7b294d`
- Scenario: authoritative design tokens generate the checked-in CSS exactly.
  - Invocation: `npm run tokens:check`
  - Observable: exit `0`; no stale CSS error.
- Scenario: token, catalog map, and detail material contracts remain enforced.
  - Invocation: `node --test tests/product/design/design-token-source.test.mjs tests/product/catalog/catalog-contract.test.mjs tests/product/detail-history/detail-contract.test.mjs`
  - Observable: `12` tests, `12` pass, `0` fail.
- Scenario: repository lint accepts the bounded UI/token changes.
  - Invocation: `npm run lint`
  - Observable: exit `0`; only Babel size notices for pre-existing `.omo/teams` build output.
- Scenario: TypeScript contracts compile without emitting.
  - Invocation: `npx tsc --noEmit`
  - Observable: exit `0`.
- Scenario: production application bundle builds with generated tokens and CSS modules.
  - Invocation: `npm run build`
  - Observable: exit `0`; `Build complete.`
- Captured artifact: this UTF-8 manifest records the exact scenarios, invocations, and binary observables for the bounded pass.
- Mobile screenshot gate: `NOT_RUN_BLOCKED` for this bounded pass. The existing dev capture process retained an open handle on its prior evidence log and the prior capture recorded a hydration mismatch; no new stable 430x932 artifact is claimed.
