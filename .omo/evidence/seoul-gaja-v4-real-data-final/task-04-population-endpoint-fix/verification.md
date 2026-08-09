# Population endpoint verification receipt

## Verdict

`PASS` for the population-only source-contract implementation. Cleanup alone
is `NOT_RUN_BLOCKED` as recorded in `cleanup-receipt.json`.

## Scope and binding

| Field | Value |
| --- | --- |
| Worktree | `D:\vscode\seoul_gaja-worktrees\realdata-population-endpoint-fix` |
| Branch | `codex/realdata-population-endpoint-fix` |
| Base commit | `d6bc9fdace41ed2d2bb7d67769681f22ef050699` |
| Base tree | `70cfcf4186ff96109c25ab73d3a3e6c1a26101f0` |
| Candidate commit/tree | supplied exactly by the terminal receipt after this atomic commit |
| Source contract | `SeoulRtd.citydata_ppltn` / `RESULT.RESULT.CODE=INFO-000` |

The candidate commit/tree are intentionally terminal-bound: placing the
derived Git object IDs inside a file that is itself part of the atomic tree
would recursively change those IDs.

## Observed results

- RED: old decoder rejected the official population-only fixture because it
  expected `CITYDATA`; old URL used `citydata`. See `red-green.md`.
- Public manual QA: `curl.exe` with the public `sample` key returned HTTP 200,
  top-level `SeoulRtd.citydata_ppltn`, `RESULT.CODE=INFO-000`, exactly one row,
  and 12 forecast entries. No owner key was used or recorded.
- Final collector test run 1: `29 passed in 3.83s`.
- Final collector test run 2: `29 passed in 4.78s`.
- Targeted ruff: `All checks passed!`; `python -m compileall -q collector`
  passed.
- Node provenance/materialization gates: `11 pass, 0 fail`.
- Manual fixture materialization: accepted 121 rows, 121 identities, and no
  forbidden key field.
- Authority lock: PASS at the approved base/branch/tree before edits.
- Build: `NOT_RUN_BLOCKED` because `node_modules` was absent; no dependency
  installation was authorized or needed for this source-only change.
- Diff check: passed before commit; rechecked immediately before commit.
- Secret scan: production paths and this receipt report zero literal secret
  assignments; identifiers and the public `sample` placeholder only are
  retained.

## Artifact index

- `red-green.md` — behavior-level RED and GREEN proof.
- `manual-qa.json` — public sample source URL/status and seam binding.
- `ultraqa.json` — failure-mode probes and results.
- `cleanup-receipt.json` — cleanup-only policy blocker and literal targets.
- `verification.md.sha256` — SHA-256 sidecar for this receipt.
