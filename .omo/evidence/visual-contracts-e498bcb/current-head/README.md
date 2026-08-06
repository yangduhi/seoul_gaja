# Current-head visual QA evidence

The captures are bound to product-source commit `24cabb9469e92c2676f49e9126933295406a7a1c` and product-source tree `d35a43ca59d8e6eb974936e4ed5b4a47c88e6868`. Any later commit containing this evidence is evidence-only and must preserve that product-source binding.

The local server was started on `http://localhost:3100` from this worktree and the deterministic development-only fixture `visualFixture=ready-v1` was used. No live API, Sites, D1, secret, deploy, or external workflow was used.

## Fresh captures

- `home-390x844.png`: `/` at 390x844. The mobile map, 44px purpose controls, bottom list sheet, legend, and fixed navigation are visible.
- `home-1616x923.png`: `/` at 1616x923. The three-pane explorer, tokenized map grid/river/road cues, centered legend, and detail rail are visible.
- `detail-390x844.png`: `/places/alpha` at 390x844. The direct detail route, close control, crowd card, recommendation state, forecast chart/table, and fixed navigation are visible.
- `detail-1616x923.png`: `/places/alpha` at 1616x923. The standalone detail surface is centered at its maximum width.

All four captures were written by Playwright against the current candidate and validated as non-empty PNGs with the requested dimensions. The browser console reported only local font-file loading errors from the dev runtime; no hydration mismatch or application HTTP error occurred on port 3100.

This is local deterministic visual evidence only. It does not promote fixture data to live capability or replace the Sites owner/live proof gate.
