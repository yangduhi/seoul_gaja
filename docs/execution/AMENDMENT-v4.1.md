# Seoul Gaja ChatGPT Sites-only v4.1 Amendment

Status: execution-authority amendment, preparation complete; product implementation not yet approved.

## Exact bindings

- Repository: `https://github.com/yangduhi/seoul_gaja`
- Default branch: `main`
- Preparation base commit: `23b4023870c47e1280f15f4dd5abcce7bcadcbd9`
- Preparation base tree: `323a2481592e4351c95f2985e2955a1a9a1d2550`
- Approved plan SHA-256: `9ec41b95cdcc22c5d8f0135dcb8103d90f00e3610931b54d1c8015a88a0c4849`
- Preserved v4.0.0 ZIP SHA-256: `af2ea053fe540e62e886ffb107434bc89f370e6242210afa25cc73f24d470e83`
- Preserved v4.0.0 content-root SHA-256: `9d70c004be12e2f5da5685074714bcb48c8dc1bef1560c035d31a4ea99ad34e6`
- Extracted `MANIFEST.sha256` file SHA-256: `91de32a795a8800c65190c03f0f504e8ab81feb637051ab1723097691783190f`

The copied v4.0.0 packet remains byte-for-byte audit evidence. This amendment supersedes only conflicting execution semantics. It does not claim that structural packet validation is semantic, product, Sites, or live capability PASS.

## Authority order

1. `.omo/authority-lock.json` exact hashes.
2. This amendment.
3. `.omo/plans/seoul-gaja-v4-plan-review.md` at the bound SHA.
4. Non-conflicting v4.0.0 packet contracts.
5. `docs/reference/FINAL_IMPLEMENTATION_PLAN.md` as human context only.

## Superseding decisions

1. Production ingest is only `POST /api/internal/ingest/snapshot`. A Phase 00 disposable probe has a separate name and never proves production behavior.
2. Phase evidence is `docs/evidence/phase-XX/phase-receipt.json`. Phase 08 release identifiers live in one required nested `release` object; no alternate receipt is authoritative.
3. Recommendations use only current crowd, official forecast, and eligible history on lower-is-better `[0,1]` percentile inputs. NOW, NEXT, history maturity, horizons, weights, tie order, suppression, and no-renormalization rules are exactly those in Todo 9 of the approved plan. Incident, transport, event, purpose-fit, momentum, safety, and fabricated best-time inputs are forbidden.
4. Snapshot identity separates `run_id`, `attempt_no`/`revision_id`, and `payload_sha256`; replay, 409 conflict, recovery, supersession, freshness, clock skew, counter reconciliation, 121-identity, activation, replacement, and LKG rules are exactly those in Todo 7.
5. The planned additive migration is `migrations/0003_snapshot_revision_and_provenance.sql`. A sequence collision is `NOT_RUN_BLOCKED` pending an authority update; never silently rename or execute it.
6. `SITE_INGEST_TOKEN` is ingest-only and may exist only in the Sites hosted-secret store and a protected default-branch GitHub Environment. Rotation overlap is at most 30 minutes and old-token rejection is mandatory.
7. Capacity proof requires owner/account quota evidence and four consecutive whole-catalog scheduled runs at the selected cadence. A sample or one canary cannot PASS.
8. Canonical place detail is `/places/{areaCode}`. In-app selection uses transient `history.state.entry="sheet"`; direct/reload/shared navigation uses full-screen detail. Canonical sharing omits transient state and Back/close restores prior URL/selection/focus.
9. Todo 1 must derive the execution command map from the actual starter `package.json` and `package-lock.json` before Todo 2. The canonical sidecar paths are `docs/execution/contracts/execution-command-map.json`, `docs/execution/scripts/validate_command_map.py`, and `docs/execution/scripts/run_command_map.py`. These paths supersede the plan's `docs/codex-pack-v4/...` execution-tool paths because the v4.0.0 packet directory is immutable audit evidence and its validator rejects added members. Missing commands or capabilities fail closed.
10. Current preparation does not authorize product implementation, migration execution, workflow mutation, secrets, live APIs, push/merge, Sites Save/Deploy, or sharing changes.

## Execution gate

The operating leader may finish local preparation and readiness verification autonomously. Product implementation begins only after a separate explicit implementation approval is recorded in `.omo/IMPLEMENTATION_READINESS.json`. After that approval, safe local Waves may advance without repeated user prompts, while every owner-action gate remains explicit.
