# AGENTS.md

## Mission

Build `seoul_gaja` as a family-oriented Seoul crowd decision app whose only application hosting and deployment surface is **ChatGPT Sites**.

## Non-negotiable boundaries

1. Do not add Vercel, Netlify, GitHub Pages, Cloudflare Pages, Firebase Hosting, Supabase hosting, or a separately operated application server.
2. GitHub is used only for source control, pull requests, review evidence, and scheduled data collection through GitHub Actions.
3. Durable structured data must use ChatGPT Sites D1 when the account/runtime supports it.
4. R2 is allowed only for product-owned files that genuinely require object storage. Do not add it by default.
5. Do not invent a Sites capability. Phase 00 must prove local-project linkage, D1, hosted secrets, server-side execution, and an external ingest request before product implementation.
6. If a required Sites capability is unavailable, record `NOT_RUN_BLOCKED`; do not silently introduce another hosting or database provider.
7. Never commit secret values. Keep `.openai/hosting.json` free of secrets and let Sites provision or update its own project binding.
8. Every production deployment must follow: exact Git commit → tests/evidence → Save version → private review → explicit owner approval → Deploy.
9. Do not automatically deploy or change Site sharing settings.
10. Do not copy source code, brand assets, or wording from the reference Vercel site. Recreate only the validated product behavior and information architecture.

## Product truthfulness

- Display Seoul population as a range when the source provides a range.
- Keep `source_updated_at` separate from `fetched_at`.
- Distinguish current official data, official forecast, and locally accumulated historical pattern.
- Never interpolate, extrapolate, or fabricate missing crowd values.
- Stale or unavailable data must be visibly labeled and fail closed.
- User geolocation is requested only after an explicit action and remains in browser memory.

## Delivery workflow

For each phase:

1. Read the phase plan and acceptance contract.
2. Write a failing test or a machine-checkable failing gate.
3. Implement the minimum change.
4. Run focused tests, then the full regression suite.
5. Capture real-browser evidence where UI or runtime behavior is involved.
6. Produce a receipt containing commit SHA, tree SHA, commands, outputs, hashes, and unresolved blockers.
7. Commit on a `codex/phase-XX-*` branch and open a pull request.

Allowed terminal verdicts are `PASS`, `FAIL`, and `NOT_RUN_BLOCKED`.

## Design authority

Use `design/design.md` and the versioned design pack as the design authority. The direction is restrained glassmorphism with Apple-app-inspired hierarchy, not imitation of Apple-owned marks or assets.
