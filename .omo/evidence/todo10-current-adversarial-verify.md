# Todo 10 current adversarial verification

## Terminal verdict

`confirmed`

This review is bound to implementation commit `c75e7368dab758701865620328512560e9e467cb` / tree `f49b00bd38d1b5fb9f7200770ec372b31ddead31`, and evidence commit `1f0f0431548032a1b948c4a8c42092d874afee46` / tree `6704e789d591b96fe3c23294a0d62ddb655e81d1`.

The product candidate, source bindings, authority validation, ready/invalid matrix, unavailable matrix, and persisted PNG files all passed. The v2 evidence commit uses valid repository-relative `capture.unavailableScreenshot` paths for all eight unavailable captures.

## Candidate-linked evidence result

No blocker found. Every top-level `capture.unavailableScreenshot` value is repository-relative under `.omo/evidence/task-10-unavailable-branch-fix/browser/current-c75e736/unavailable/`; `Test-Path` succeeds for all eight and `git rev-parse 1f0f043...:<capture.unavailableScreenshot>` resolves each to a committed PNG blob.

## Candidate and source binding recomputation

`git cat-file -t` confirmed the requested object kinds: candidate is a `commit`, candidate tree is a `tree`, evidence is a `commit`, evidence tree is a `tree`. `git show -s --format='%H %T %P'` confirmed the candidate tree `f49b00...` and v2 evidence tree `6704e789...`; evidence commit `1f0f043...` is a descendant of the original candidate-bound evidence chain.

All eight entries from `.omo/evidence/task-10-unavailable-branch-fix/current-c75e736-rebind.json` exactly matched `git rev-parse c75e7368dab758701865620328512560e9e467cb:<path>`:

| Path | Blob | Match |
|---|---|---|
| `app/_catalog/CatalogSurface.module.css` | `fee645807601cb07d823935e755c78a29a575f8d` | PASS |
| `app/_catalog/CatalogSurface.tsx` | `0ea6a1c6d94075bb65411a3ccc63758382c9b0f9` | PASS |
| `app/places/[areaCode]/InvalidPlaceFallback.tsx` | `993eca51497c7b853d73822aa40aa09f448f4e62` | PASS |
| `app/places/[areaCode]/PlaceDetailClient.tsx` | `de51d502d8acc0736c201b0d972317338e8e0d83` | PASS |
| `app/places/[areaCode]/page.tsx` | `ae9dd6ff0bfdb011ac3d72f5481383fc56b3b94a` | PASS |
| `tests/product/detail-history/detail-contract.test.mjs` | `16a8f3343c390ccf5455358d0032270dd616c225` | PASS |
| `tests/product/detail-history/route-safe-invalid-fallback.test.mjs` | `2ad26265222e14251bbe7e5cbe38a06f9904899a` | PASS |
| `tests/product/detail-history/unavailable-detail-state.test.mjs` | `b769439f448a1afdd47e07495bcaeeb7ffa17122` | PASS |

`python docs/execution/scripts/validate_authority_lock.py` returned `PASS`, observing the checkout's v2 evidence commit/tree (`1f0f043...` / `6704e789...`).

## Matrix and artifact checks

- Parsed all current candidate JSON artifacts successfully: the rebind, `browser-full-matrix.json`, unavailable `browser-observations.json`, and unavailable `cleanup.json`.
- `browser-full-matrix.json` candidate fields exactly equal `c75e736...` / `f49b00...`; it records two repetitions over `390x844`, `430x932`, `768x1024`, and `1616x923` (8 ready/history journeys).
- Ready/invalid summary is exact: `failedCount=0`, `rscFailureCount=0`, `consoleErrorCount=0`, `pageErrorCount=0`, and `unexpectedRequestErrors=0`. Direct/reload are `FULL_SCREEN`; click/keyboard transitions use `sheet`; invalid/malformed inputs restore catalog with `noindex, nofollow` and no detail/share surface.
- Unavailable matrix has 8 captures: alpha detail visible, `aria-live="polite"`, retry visible, retry height exactly `44`, and empty RSC request lists. It records `failures=0`, `consoleErrors=0`, and `pageErrors=0`.
- All 32 persisted candidate-bound PNG artifacts have the PNG signature and valid Git object IDs in evidence commit `1f0f043...` (24 ready/invalid and 8 unavailable). Every unavailable JSON capture now resolves to its durable PNG.
- The candidate rebind declares `SITE_INGEST_TOKEN`, live API, Sites Save/Deploy, and push/default-branch merge as `NOT_RUN_BLOCKED`; no artifact claims a successful owner-gated live action. A generic dev-server line, `Using secrets defined in .env`, contains no secret value and is not a live-action claim.

## Adversarial and cleanup checks

- Malformed input, invalid route, hostile HTML input, stale history replay, retry hit boxes, and repeated two-pass observations are present in the candidate-bound matrix. Hostile HTML was rendered as no image and `window.__injected` remained `false`.
- Dirty worktree was detected and preserved. It has unrelated/uncommitted evidence and preview changes; none overlaps the eight candidate source/test paths. No fresh server or browser was launched, so no task-owned process was created.
- The persisted evidence's cleanup states browser closed and ports `53940`/`51176` free. A fresh `Get-NetTCPConnection` check found zero listeners on those ports and the recorded unavailable server PID `155096` absent.
- Prompt-injection probe over the two candidate-bound evidence directories found no instruction-like payload. Cancel/resume: N/A, because this read-only verifier launched no cancellable task process. Hung/long-command and flaky-test probes: N/A as no fresh test/server was run against a deliberately dirty shared checkout; the bounded authority validator completed normally.

## Closeout

The exact candidate-bound evidence is confirmed. No product, plan, or ledger file was modified by this verifier.
