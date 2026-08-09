# Task 02 machine-ingress contract retry

## Verdict

`PASS_LOCAL` — the scheduled collector can source the protected
`OAI_SITES_AUTHORIZATION` environment name and constructs exactly one
`OAI-Sites-Authorization` request header at the collector request boundary.
The canonical path and application authorization scheme remain unchanged.

## Bindings and scope

| Field | Value |
| --- | --- |
| Retry worktree | `D:\vscode\seoul_gaja-worktrees\realdata-machine-ingress-contract-retry` |
| Retry branch | `codex/realdata-machine-ingress-contract-retry` |
| Required base commit | `eb839d65869fe938ce5887aa07a0c3e7a967d112` |
| Required base tree | `bc35d8e126dc35a478ff003ede8414d24cda1ace` |
| Pre-edit retry worktree state | clean |
| Live Sites/GitHub/D1 mutation | not attempted |

The old failed worktree was neither read, changed, nor cleaned. The dirty
`prep-v4-1` worktree was observed read-only with 227 entries while this retry
worktree contained only the three scoped code/test changes before evidence.

## Implemented request contract

- `collector.cli push` accepts optional `--machine-header-env`.
- If supplied, its environment value must be nonblank. A blank or missing value
  exits with `BLOCKED_EXIT` before URL parsing, body read, `Request`, or HTTP.
- The only new header construction is
  `OAI-Sites-Authorization: <redacted machine authorization>`.
- The existing canonical path `/api/internal/ingest/snapshot` and existing
  application authorization scheme are preserved.
- `collect-seoul-crowd-live.yml` reads only
  `${{ secrets.OAI_SITES_AUTHORIZATION }}` into the protected
  `production-ingest` job and passes the environment name to `collector.cli`.

`manual-backfill.yml` was inspected but not changed: it invokes
`collector.cli backfill`, not the `_push` request path modified here.

## Local-only manual observation

The direct CLI subprocess used one task-owned loopback HTTPS listener on
`127.0.0.1` with ephemeral certificate material. It made exactly one local
request; no live hostname, secret value, Sites, GitHub, or D1 surface was used.
The observed wire spelling was `Oai-Sites-Authorization`; HTTP field names are
case-insensitive, and the source construction remains the exact required
`OAI-Sites-Authorization` spelling. See
`local-loopback-capture.json` for redacted observables.

## Commit binding

These direct evidence files are committed atomically with the source and test.
The resulting local commit and tree are reported by the member terminal result;
a committed file cannot contain its own final Git object identifier without a
self-referential evidence amend.

## Evidence index

- `red-green.md` — test-first failure and green command results.
- `local-loopback-capture.json` — redacted local request-boundary observation.
- `ultraqa.json` — adversarial/local checks.
- `cache-free-inventory.json` — cache/process/scope inventory.
- `cleanup-receipt.json` — no leftover task resources or external mutation.
