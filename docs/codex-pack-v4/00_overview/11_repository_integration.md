# GitHub Repository Integration

## Authority repository

```text
https://github.com/yangduhi/seoul_gaja
```

At packet creation:

- default branch: `main`
- planning branch: `plan/chatgpt-sites-only-v1`
- draft pull request: `#1 docs: establish ChatGPT Sites-only implementation plan`

The planning branch contains the Sites-only README, repository AGENTS rules, architecture, automation, owner prerequisites, phase roadmap, design authority and machine-readable platform boundary.

## Working model

```text
main
  └─ codex/phase-00-sites-capability
      └─ PR and review
          └─ approved merge
```

Repeat for each Phase. Do not work directly on `main`.

## Binary design assets

This packet includes versioned PNG/HTML design assets. Add them through the local Git workflow because repository text connectors may not preserve binary files. Review file sizes and hashes before commit.

## Deployment separation

A Git merge does not deploy the Site. A GitHub Action does not deploy the Site. ChatGPT web/desktop Sites saves and deploys a reviewed version associated with an exact Git commit.
