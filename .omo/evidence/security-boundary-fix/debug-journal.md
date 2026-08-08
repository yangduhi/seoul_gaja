# Security boundary fix journal

- Base candidate: `89683167b28788d111ca165f272e2f492851ad37` / `7e22e3269a10868d8f0ae40c2dd585e6c3d4ffd0`.
- Registered resources before runtime: none. The focused handler checks run in-process and do not start a server, browser, listener, temporary script, or external service.
- Scope: health bearer/expiry boundary and streamed request byte limits only.
- Secrets: fixtures use `token-redacted` only.
