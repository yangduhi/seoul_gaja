# Changelog

## 4.0.0-sites-only — 2026-08-03

- Bound the implementation to GitHub repository `yangduhi/seoul_gaja`.
- Made ChatGPT Sites the sole application host, server runtime, deployment and sharing surface.
- Made ChatGPT Sites D1 binding `DB` the sole production structured-data store.
- Removed every external database fallback and separate application-host option.
- Clarified that GitHub Actions is scheduler/collector only and can never deploy Sites.
- Reworked Phase 00 into a strict local-project/server-route/D1/secret/version/share/external-ingest proof.
- Updated owner prerequisites, secrets, architecture, risks, ADRs and phase work orders.
- Preserved Calm Glass design pack and deterministic mockups.
- Added machine-readable `contracts/platform-boundary.yaml`.

## Superseded

The previous `3.0.0-family-final` packet is superseded because it allowed an external database fallback and used an obsolete project path.
