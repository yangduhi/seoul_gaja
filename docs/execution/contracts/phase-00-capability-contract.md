# Phase 00 local capability contract

`phase-00-capability-probe` is disposable and exists only at `POST /api/internal/capability-probe/ingest`.
It is not the production ingest route and cannot prove Phase 02 behavior.

The local contract requires a server-only `SITE_INGEST_TOKEN`, a health query, D1 write/read/update,
an atomic rollback assertion, and confirmed cleanup. The probe returns no secret value or database detail.

No Site is called by local verification. A live capability verdict requires an owner-approved Site version,
deployment, and cleanup deployment. Until those owner actions are supplied, the only valid receipt verdict is
`NOT_RUN_BLOCKED` with `Approve the Phase 00 external capability probe in ChatGPT Sites.`
