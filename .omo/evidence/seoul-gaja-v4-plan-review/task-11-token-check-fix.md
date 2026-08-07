# Task 11 generated-token freshness CRLF fix

## Candidate binding

- Task worktree: `D:\vscode\seoul_gaja-worktrees\task-11-token-check-crlf`
- Branch: `codex/task-11-token-check-crlf`
- Base candidate commit: `20a66d9c0113621070cf54ff91a1e3e539cc2aad`
- Base candidate tree: `153bb52bd6c9446959240f81a2967287bb05939a`
- Target class: `NON_RENDERING_FRONTEND`; terminal manual QA is the requested terminal command only. No browser, port, or external system was opened.

## Failing-first evidence

Before any edit, `app/design-tokens.generated.css` contained `117` LF bytes, all `117` paired as CRLF; `git ls-files --eol -- app/design-tokens.generated.css` reported `i/lf w/crlf`.

| Command | Result | Observable |
| --- | --- | --- |
| `npm run tokens:check` | exit `1` | `app/design-tokens.generated.css is stale` from `scripts/generate-design-token-css.mjs:85` |
| `node --test tests/product/design/design-token-source.test.mjs` | exit `1`; 2 pass, 1 fail | raw CRLF versus LF equality only |

## Minimal correction

- Changed `scripts/generate-design-token-css.mjs` so the freshness predicate converts only CRLF pairs to LF before comparison. Generation output remains LF and no token value or generated file byte is rewritten.
- Changed `tests/product/design/design-token-source.test.mjs` to assert that CRLF is current and a changed token declaration is stale.
- No authority file, product UI file, dependency, secret, external system, browser, server, port, push, or merge was touched.

## Green verification

| Command | Runs | Result |
| --- | --- | --- |
| `node --test tests/product/design/design-token-source.test.mjs` | 2 | exit `0`; 4/4 pass on each run |
| `npm run tokens:check` | 2 | exit `0`; no stale-token error on the untouched CRLF checkout |
| normalized semantic comparison | 1 | exit `0`; `NORMALIZED_SEMANTICS_MATCH=true`; raw CRLF SHA-256 `1ab3e148c5324dce63bd272b6c25354eececed9fa5af6ed8538e3b05a0c0e0f6`; expected LF SHA-256 `2f00d0f8241cb7b193abfd8671da44e6aa80401f747ca1f380d8b6e21384ecf8` |
| malformed token JSON fixture | 1 | script exit `1` with `SyntaxError`; malformed input remains fail-closed |

Lint, TypeScript typecheck, and build were not run: this is a Node `.mjs` comparison-only seam with a focused `node:test` regression and the exact `npm run tokens:check` manual QA requested.

## UltraQA and cleanup

- Dirty-worktree/CRLF state: PASS. The actual clean-checkout generated CSS remained CRLF and the command passed without regeneration.
- Misleading success: PASS. Raw bytes intentionally differ only by EOL; normalized semantics exactly match generated LF output, while a token declaration mutation is tested stale.
- Repetition/flakiness: PASS. Two focused tests and two terminal checks completed with exit `0`.
- Hung command: PASS. All commands completed under the bounded terminal invocation.
- Prompt injection, cancel/resume, browser, process, and port scenarios: NOT_APPLICABLE; this seam consumes only local token JSON and created none of those resources.
- Cleanup receipt: PASS. The sole temporary fixture `.omo/tmp/token-check-invalid-json` was removed; no child process, QA server, browser context, or port remains.

## Changed paths

- `scripts/generate-design-token-css.mjs`
- `tests/product/design/design-token-source.test.mjs`
- `.omo/evidence/seoul-gaja-v4-plan-review/task-11-token-check-fix.md`

`artifact_sha256` is SHA-256 of this UTF-8 report with the line that begins `artifact_sha256:` omitted.

artifact_sha256: 03c81d4a01d8c5d986769eeafcecdec51ad5d3652d827faab4f3a51527fa6f20
