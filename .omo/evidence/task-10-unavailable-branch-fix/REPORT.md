# Todo 10 unavailable-detail repair

Candidate: `bad11ca1165cd31212d1c386fe8ba662c7d920c3`
Tree: `db1cb5768c6e47fe9b91446e819fc26bd33fa87b`
Requested plan SHA-256: `f5359c2a91169a66195383ac935259b56780c8069d1e0fd85de641141138dc3`
Requested authority SHA-256: `af138ab215937fb8737f690073eee8c8f27ecd777d506f4aed8badfb7cfb91d3`
Actual c87-derived candidate plan SHA-256: `7974ee83ac2f4bfedbb37b3e9c29e8d92978f7f8edaca80c1a439f255c8510b9`
Actual c87-derived candidate authority SHA-256: `db939f67b3f85438fb9e472d89825fd37c1bbad11992c82450253c7e31e078f5`

The requested plan/authority pair does not match the c87-derived candidate lock. No plan or authority file was edited; this is an owner integration gate, not a satisfied binding.

## Source blobs

- `app/places/[areaCode]/page.tsx`: blob `ae9dd6ff0bfdb011ac3d72f5481383fc56b3b94a`, SHA-256 `25126f56ad8e3ae92e286cfc52c4f05dc7c2f0ff4c9ffd80a7f6a0205456623d`
- `app/places/[areaCode]/PlaceDetailClient.tsx`: blob `de51d502d8acc0736c201b0d972317338e8e0d83`, SHA-256 `cd2693af70c8c7fa560d75487b681ec94f2ac96529c582bb908536ee2fbb6a05`
- `tests/product/detail-history/unavailable-detail-state.test.mjs`: blob `b769439f448a1afdd47e07495bcaeeb7ffa17122`, SHA-256 `f6c7f93d2f49057458779d39a77c01da7f8f0bc23b08cff53f29adab9fafa908`

## Verification

- RED: `node --test tests/product/detail-history/unavailable-detail-state.test.mjs` failed 2/2 before source edits.
- GREEN pass 1 and pass 2: focused detail contract command passed 14/14 on each invocation.
- Command map: `task-10-happy` and `task-10-failure` both returned exit 0 and `PASS`; the Python runner emitted a Windows `cp949` reader-thread warning while capturing child output.
- `python docs/execution/scripts/validate_authority_lock.py`: `PASS` for the committed candidate.
- `npm run tokens:check`, targeted `npx eslint`, and `npm run build`: passed.
- Real Chrome capture: `browser/browser-observations.json` contains two unavailable-detail passes at 390x844, 430x932, 768x1024, and 1616x923. Every capture observed area code `alpha`, visible `data-detail-unavailable`, `aria-live=polite`, a 44px retry, zero RSC requests, zero request failures, zero console errors, and zero page errors.
- Candidate-bound corrected matrix: `browser/matrix-ready-invalid/bad11ca-ready-invalid/browser-full-matrix.json` is `PASS` using cached Chrome/Playwright. Its evidence-only runner copy changes only the direct unknown navigation to `/places/does-not-exist?visualFixture=ready-v1`; it records 4 viewports × 2 passes, correct history/Back/focus, invalid catalog fallback with `noindex, nofollow`, malformed fallback, unavailable retry/aria-live, hostile input safety, and zero request/RSC/console/page errors.
- HTTP probe: `curl -i` against `/places/does-not-exist?visualFixture=ready-v1` and `/places/%2F%2Fevil` returned `HTTP/1.1 200 OK`, no `Location` header, and HTML `meta[name=robots]` `noindex, nofollow`; both emitted `data-invalid-place-fallback`. The dev-server log is `curl-server.log`. Browser navigation then proved the client fallback reaches `/?placeNotFound=1`.

## Blocked observables

The unmodified parent runner failure is preserved at `../seoul-gaja-v4-plan-review/task-10-combined-fix/bad11ca-final/`: it omitted `?visualFixture=ready-v1` only on its direct unknown navigation, so this candidate correctly rendered the truthful unavailable state instead of a false not-found fallback. The evidence-only corrected runner provides the intended READY-catalog unknown/removed proof without product changes.

## Cleanup

- Chrome browser closed and listener `51148` PID `228620` was stopped.
- The parent matrix listener `51731`, corrected-matrix listener `51732`, and curl listener `51733` have no remaining listening PID (also rechecked `51148`).
- The temporary `node_modules` junction and Python `__pycache__` cleanup were attempted with exact targets but rejected by the host destructive-command policy; neither was committed.
