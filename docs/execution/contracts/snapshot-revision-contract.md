# Snapshot revision contract

`run_id`, `attempt_no`, `revision_id`, and `payload_sha256` are separate immutable identities.
The same `(run_id, attempt_no, payload_sha256)` is an idempotent replay; a different hash for the
same `(run_id, attempt_no)` is `409 PAYLOAD_HASH_CONFLICT`. Recovery increments the attempt, names
`supersedes_revision_id`, and may supersede only the immediately prior `partial` revision.

The server derives freshness from UTC-normalized `sourceUpdatedAt`; `fetchedAt` is permitted only as
the explicit degraded basis. Ages `<=30`, `<=90`, and `<=180` minutes are fresh, delayed, and stale;
older data is expired. More than five minutes of future skew is rejected, while smaller skew clamps to
zero and records `clock_skew_clamped=true`.

Every accepted generation reconciles exactly 121 unique catalog identities and all counters. First
activation needs 97 refreshed-fresh places. Replacement needs at least one refreshed place and 97
refreshed-fresh plus non-expired carried places. All-unavailable/all-expired generations are audit-only
and never activate; an existing last-known-good generation remains active.

`migrations/0003_snapshot_revision_and_provenance.sql` is additive and forward-only. Its legacy
fixture backfill reads old rows before new writes; rollback restores application compatibility in a
later forward migration and never claims a destructive schema rollback. A pre-existing `0003_*`
sequence collision is `NOT_RUN_BLOCKED` until a v4.1 authority amendment approves the sequence.
