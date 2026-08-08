# AGENTS.md — `seoul_gaja`

## Authority

1. `docs/codex-pack-v4/contracts/platform-boundary.yaml`
2. `docs/codex-pack-v4/00_overview/01_global_contracts.md`
3. `docs/codex-pack-v4/contracts/*`
4. `docs/codex-pack-v4/design/design.md`
5. current Phase acceptance contract
6. current Phase work order
7. current Phase implementation plan

## Platform boundary

- ChatGPT Sites is the only application host/runtime/deployment/sharing surface.
- Sites D1 binding `DB` is the only production structured store.
- GitHub is source/review/automation, not application hosting.
- GitHub Actions may collect and ingest data but must never deploy the Site or change sharing.
- Missing required Sites capability returns `NOT_RUN_BLOCKED`; do not add an external fallback.

## Workflow

- Execute one Phase at a time on `codex/phase-XX-*` branches.
- Start with inventory and a failing test or machine-checkable failing gate.
- Do not implement later-Phase scope opportunistically.
- Use small causal commits and fresh verification.
- Do not push, merge or deploy without explicit approval.

## Product truth

- Official 121-place catalog only.
- Population remains a range.
- Keep `sourceUpdatedAt` separate from `fetchedAt`.
- Official forecast points only; no interpolation/extrapolation.
- Missing is not zero.
- History improves recurring-pattern confidence, not official current/forecast values.
- No account/profile/server favorites/location history.
- Geolocation stays in browser memory after explicit user action.

## Secrets

- Real values exist only in GitHub Actions Secrets or ChatGPT Sites Settings.
- Never expose them in prompt, source, logs, fixtures, screenshots or receipts.
- `.openai/hosting.json` contains project linkage/bindings, not secrets.

## Design

- `design/design.md` and deterministic mockups are authoritative.
- AI concept boards and reference screenshots are non-authoritative.
- Do not copy reference-site code, assets, copy, brand or deployment architecture.
- Verify 390×844, 430×932 and 1616×923.

## Terminal receipt

```text
PHASE: NN
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: ...
TREE: ...
TESTS: ...
BROWSER: ...
SITES: ...
EVIDENCE: ...
BLOCKERS: ...
NEXT_ALLOWED_PHASE: ...
```
