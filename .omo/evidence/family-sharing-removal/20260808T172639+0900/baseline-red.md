# RED-before-GREEN

- Candidate base: `5d4c2dcbcd8caec1f0ee76c8a0a9cd18a17addc1` (`44b893ec646a511c4783aa04cd4aa9b6c5dda50b`).
- Baseline observable: `PlaceDetailClient.tsx` contained the visible `가족과 공유` button and `navigator.share`/clipboard helper; `CatalogSurface.tsx` contained share-only public-link copy.
- Failing-first invocation: `node --test tests/gates/family-sharing-removal.test.mjs`
- Binary result before production edits: exit `1`; two intended removal assertions failed and the preservation assertion passed.
- Failed seams: detail share action/helper remained; catalog share-only link/copy remained.

