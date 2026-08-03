# ADR-0001: ChatGPT Sites Is the Only Application Host

- Status: Accepted
- Date: 2026-08-03
- Decision owner: repository owner

## Context

Early planning referenced a Vercel-hosted example and considered generic web-hosting patterns. The owner clarified that the final product must use ChatGPT Sites, not Vercel, and supplied the GitHub repository `yangduhi/seoul_gaja` as the implementation source.

The product also requires periodic Seoul data collection and long-term accumulation. ChatGPT Sites supports hosted experiences, saved versions, sharing, hosted environment values, and optional D1/R2 bindings, while some background-service and hosting patterns may not be supported. GitHub Actions is therefore retained as the scheduler and CI runner, not as an application host.

## Decision

1. ChatGPT Sites is the sole user-facing host and deployment target.
2. ChatGPT Sites D1 is the sole production structured-data store.
3. R2 is added only if product-owned file storage becomes necessary.
4. GitHub stores code, contracts, migrations, fixtures, documents, and evidence.
5. GitHub Actions periodically collects and validates external data, then sends it to a protected ChatGPT Sites ingest route.
6. ChatGPT Sites deployment and sharing changes remain manual, review-gated operations.
7. Phase 00 must prove the required Sites capabilities in the owner’s actual account before implementation continues.

## Rejected alternatives

- Vercel hosting or serverless functions
- Netlify or GitHub Pages
- Cloudflare Pages/Workers
- Supabase/Firebase/external database
- Data snapshots committed continuously to Git
- Browser-direct collection of all Seoul places
- Codex or ChatGPT conversation sessions as the production scheduler

## Consequences

### Positive

- One user-facing deployment surface.
- Minimal family-operation burden.
- Site access, secrets, storage, versions, analytics, and deployment are managed in one product.
- GitHub remains a conventional reviewable engineering source.

### Negative

- The design depends on the Sites capabilities and limits available to the owner account.
- GitHub Actions must call a Sites route; this must be proven after a controlled deployment.
- There is no external-host fallback under the accepted scope.
- If D1, server-side routes, or external ingest are unavailable, the project is blocked until Sites supports them or the owner changes this decision.

## Verification

Phase 00 records:

- local-project compatibility;
- Sites project identifier;
- D1 binding name;
- hosted secret server-read result;
- server route result;
- external ingest result;
- saved-version Git commit;
- available family sharing modes;
- explicit cleanup and deployment status.

A verbal claim or documentation-only inference is not sufficient. The proof must run in the owner’s actual Sites account.