# Phase 00 local capability contract

`phase-00-capability-probe` is disposable and exists only at `POST /api/internal/capability-probe/ingest`.
It is not the production ingest route and cannot prove Phase 02 behavior.

The local contract requires server-only `SITE_INGEST_TOKEN`, `SITE_INGEST_TOKEN_EXPIRES_AT`, and
`PHASE_00_CAPABILITY_PROBE_STATE` settings. The probe version sets the state to `probe` and uses a
future RFC 3339 expiry; missing, malformed, or expired configuration fails closed. The cleanup version
sets the state to `cleanup` (or removes the setting), which makes both probe routes return 404.

The probe performs a health query, D1 write/read/update, an atomic rollback assertion, and confirmed
cleanup against the disposable `phase_00_capability_probe` table. The probe returns no secret value or
database detail and has a bounded per-operation timeout with abort signalling.

Owner records only the hosted secret name, redacted `token_id`, and status. The required sequence is:
enter `SITE_INGEST_TOKEN` and its future expiry in the Sites hosted-secret store; Save the probe version
with `PHASE_00_CAPABILITY_PROBE_STATE=probe`; explicitly approve and Deploy; verify the protected probe;
Save a cleanup version with the state disabled; obtain a second explicit cleanup approval; Deploy cleanup;
then verify no synthetic row remains.

No Site is called by local verification. A live capability verdict requires an owner-approved Site version,
deployment, and cleanup deployment. Until those owner actions are supplied, the only valid receipt verdict is
`NOT_RUN_BLOCKED` with `Approve the Phase 00 external capability probe in ChatGPT Sites.`
