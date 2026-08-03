# Automation and Data Accumulation

## Purpose

GitHub Actions provides the periodic execution requested by the owner. It collects Seoul data and writes validated records into ChatGPT Sites D1 through the Site’s protected ingest route.

GitHub Actions is **not** the application host, deployment provider, database, or authority for UI values.

## Workflow set

```text
.github/workflows/collect-current.yml
.github/workflows/aggregate-hourly.yml
.github/workflows/aggregate-daily.yml
.github/workflows/quality-weekly.yml
.github/workflows/ci.yml
```

Do not create these production workflows until Phase 02 has completed the source and quota tests and Phase 03 has proven the Sites ingest route.

## Proposed schedules

Schedules deliberately avoid the top of the hour because GitHub may delay busy cron periods.

```yaml
collect-current:    "7,22,37,52 * * * *"
aggregate-hourly:   "17 * * * *"
aggregate-daily:    "27 18 * * *"   # 03:27 KST
quality-weekly:     "37 19 * * 6"   # Sunday 04:37 KST
```

The current-data cadence is finalized after quota measurement:

```text
15 minutes — 11,616 place requests/day at 121 places
30 minutes — 5,808 place requests/day
60 minutes — 2,904 place requests/day
```

Do not evade an API quota with multiple accounts or keys. Increase the interval and expose the resulting freshness honestly.

## Workflow safety contract

Every production workflow must include:

- `workflow_dispatch` for controlled replay;
- `concurrency` to prevent overlapping runs;
- a bounded timeout;
- explicit least-privilege `permissions`;
- secret redaction;
- deterministic exit codes;
- run receipt artifact;
- idempotency key derived from scheduled slot and collector version;
- replay of missed slots within a bounded window;
- no `git push` of runtime data;
- no ChatGPT Sites deployment action.

Example permissions:

```yaml
permissions:
  contents: read
  actions: read
```

A workflow that needs to open a maintenance PR must be separate and require owner approval. The collector itself must never request write permission to repository contents.

## Collection run

One run performs:

1. load the versioned 121-place catalog;
2. determine the exact scheduled slot;
3. fetch one place at a time with bounded concurrency and retry;
4. retain the response bytes used for hash, decode, and parse;
5. validate transport status, content type, schema, enums, timestamps, and ranges;
6. normalize valid records;
7. mark invalid place results explicitly;
8. assemble a generation payload and source hashes;
9. POST to `SITE_INGEST_URL` with bearer token and idempotency key;
10. verify the response receipt and generation count;
11. upload a redacted GitHub Actions artifact;
12. fail the run when the accepted generation violates the minimum coverage contract.

The collector never fabricates a record for a failed place.

## Secrets

GitHub Actions Secrets:

```text
SEOUL_OPEN_DATA_KEY
SITE_INGEST_URL
SITE_INGEST_TOKEN
```

Values must be accessed only through `${{ secrets.NAME }}`. Never echo them, serialize the environment, or include request headers in artifacts.

## Historical aggregation

### Hourly

For each place and hour:

- valid observation count;
- expected observation count;
- coverage ratio;
- congestion-level distribution;
- population minimum median;
- population maximum median;
- first/last source time;
- source quality flags.

### Daily

For each place and day:

- hourly coverage;
- peak official congestion level;
- peak observed population range;
- longest low-congestion interval;
- collection failure count;
- carried-forward count;
- stale/expired duration.

### Weekday × time profile

Use valid historical observations only. Store sample count, period range, coverage, central tendency, and dispersion. Do not produce a profile cell without its quality metadata.

## History maturity

```text
ACCUMULATING: less than 7 elapsed days or insufficient samples
PROVISIONAL:  at least 7 days and at least 70% coverage
STABLE:       at least 28 days and at least 80% coverage
MATURE:       at least 56 days and at least 90% coverage
```

A place or time cell uses the lowest maturity implied by elapsed days, coverage, and sample count. Maturity must fall when recent collection quality deteriorates.

## Weekly Codex review

The weekly workflow produces deterministic metrics only. Codex reviews the repository and the redacted metrics to propose a patch or maintenance PR for:

- workflow failures or delayed slots;
- source schema changes;
- catalog changes;
- falling coverage;
- unusual stale/carry-forward rates;
- data-contract drift;
- visual or accessibility regression;
- dependency updates.

Codex must not deploy, rotate secrets, change Site sharing, or edit production D1 automatically.

## Optional ChatGPT summary

An interactive ChatGPT review may summarize the deterministic weekly report for the owner. It is not part of the runtime and requires no OpenAI API key. Any narrative must cite the exact report fields and must not invent missing measurements.

## Recovery

Recovery order:

1. pause the collector workflow if writes may be unsafe;
2. inspect the latest accepted D1 generation and run receipt;
3. replay a bounded missed slot through `workflow_dispatch`;
4. rely on idempotency to avoid duplicate rows;
5. reduce collection frequency if quota or runtime limits are the cause;
6. keep the UI on last-known-good or unavailable states with honest source age;
7. never switch to another host or database as an emergency shortcut.