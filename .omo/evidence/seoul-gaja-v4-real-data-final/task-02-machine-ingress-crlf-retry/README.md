# Task 02 CR/LF machine-ingress retry

## Verdict

`PASS_LOCAL` — the machine authorization request boundary now rejects carriage
return or line feed before `Request` construction. Invalid values produce only
a generic environment-name error, never the value itself. Safe values retain
the canonical path, application authorization scheme, and exactly one
`OAI-Sites-Authorization` field.

## Bindings and scope

| Field | Value |
| --- | --- |
| Worktree | `D:\vscode\seoul_gaja-worktrees\realdata-machine-ingress-crlf-fix` |
| Branch | `codex/realdata-machine-ingress-crlf-fix` |
| Retry base commit | `1b22ea06743e670ec1bd40cc6526cde808a9c853` |
| Retry base tree | `1d372f589b050c8439b7ad279f1d58cf9eb236bb` |
| Pre-edit state | clean |
| Changed production path | `collector/cli.py` only |
| Live mutation | not attempted |

The older retry worktree was not edited or cleaned. No workflow, server,
Sites, GitHub, D1, secret store, deployment, push, or external host was used.

## Boundary behavior

- Missing or whitespace-only `OAI_SITES_AUTHORIZATION` returns exit `3` with a
  generic required-value error before HTTP.
- A value containing CR or LF returns exit `3` with a generic invalid-value
  error before URL/body/request/HTTP work.
- The test-only unsafe marker is absent from stdout, stderr, and this evidence.
- A safe local value produces one machine header, preserves canonical
  `/api/internal/ingest/snapshot`, and preserves application authorization.

## Commit binding

Source, narrow test, and this direct evidence are committed atomically. The
resulting commit and tree are supplied by the member terminal result rather
than embedded recursively in a committed evidence file.

## Evidence index

- `red-green.md` — failure reproduction and passing checks.
- `local-boundary-capture.json` — redacted normal/blank/missing/CRLF capture.
- `ultraqa.json` — timeout, repeat, redaction, and boundary review.
- `cache-free-inventory.json` — no cache or task resource residue.
- `cleanup-receipt.json` — no manual deletion or external mutation.
