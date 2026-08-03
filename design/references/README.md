# Approved Design Reference Images

The following PNG files were approved in the planning conversation and belong in this directory. They are visual references, not executable UI or data authority.

| File | SHA-256 |
|---|---|
| `01-home-map-light.png` | `f461bc346fa65adea7c0517d58307ae8f0a56537663b27b31268dbdf6e4be557` |
| `02-place-detail-light.png` | `46f409a4609b546ef49d948774509d1a0a2a9da3ea2c3c8bcd082b9ef7ad9d72` |
| `03-family-recommendations-light.png` | `bf072e88119096b3fc81fc596a159fb74578a97ab560a671235f11ff4a379006` |
| `04-history-insights-dark.png` | `d3b29b540cc83c9886431fa755f90e14ccbb508eb1a6450571dfe51096900b84` |
| `05-desktop-dashboard.png` | `af2b979d5c49b7a7135775ee86513b7f9743e9d8e628e02cb3c22e89ab996dd7` |
| `concept-01-system-and-design-board.png` | `4d3152ce4f0ce0dd86c76660927cfa2f177d0e0bf6487b422035e4c0e8f2b002` |
| `concept-02-light-family-architecture-board.png` | `ee61ae7e788d51ea1b6408a12448059d97757be3fc0ba2da25c8bbb70582b84b` |
| `concept-03-family-product-board.png` | `e55052bd81d8d15eb56f8a57a8c76b129ae0f22b6093081dc747bf8d54018f5d` |
| `concept-04-dark-product-system-board.png` | `7074dd52a80a60609e6a845b4902dd89fa14f729200049f76e2ca68469888849` |

## Import procedure

1. Download the approved design pack from the planning conversation.
2. Copy the nine PNG files into this directory without renaming them.
3. Run:

```bash
sha256sum design/references/*.png
```

4. Compare each result to the table above.
5. Commit the verified files in the Phase 01 design PR.

Do not regenerate a PNG and retain the old file name/hash. A changed concept or mockup requires a new versioned file name and an entry in `design/CHANGELOG.md`.

## Authority

Use this order when a visual reference conflicts with a written contract:

```text
design/design.md
→ design/tokens.json
→ implemented component contracts/tests
→ deterministic browser screenshots
→ these generated reference images
```

Text, numbers, maps, icons, and charts shown inside these images are illustrative and must not be treated as product data.