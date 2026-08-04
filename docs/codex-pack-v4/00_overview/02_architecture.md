# 아키텍처 — Sites Runtime Only

## 1. Topology

```text
Browser
 ├─ Sites-compatible JavaScript/TypeScript UI
 ├─ Kakao Maps JavaScript SDK
 ├─ explicit browser-memory geolocation
 └─ same-origin read routes
      ├─ GET /api/v1/snapshot
      ├─ GET /api/v1/places/{areaCode}
      ├─ GET /api/v1/history/{areaCode}
      └─ GET /api/v1/health
              │
              ▼
ChatGPT Sites runtime
 ├─ public read routes
 ├─ protected POST /api/internal/ingest
 ├─ deterministic materialization routes/jobs supported by the starter
 ├─ hosted environment values/secrets
 └─ D1 binding `DB`
              ▲
              │ HTTPS + Bearer token + idempotency key
GitHub Actions
 ├─ current collection
 ├─ bounded replay
 ├─ hourly/daily aggregation trigger
 ├─ weekly deterministic quality report
 └─ no Site deployment
              │
              ▼
Seoul Open Data API
```

## 2. Platform ownership

| Responsibility | Owner |
|---|---|
| App hosting, server routes, D1, preview, versions, deployment, sharing | ChatGPT Sites |
| Source, PR, tests, migrations, fixtures, design, evidence | GitHub repository |
| Scheduled collection and deterministic maintenance | GitHub Actions |
| Official current/forecast/city data | Seoul API |
| Map rendering and optional geocoding | Kakao APIs |
| Implementation and review proposal | Codex/ChatGPT |

GitHub Actions is allowed because it is repository automation, not an application host. It may call the approved Site ingest route but must not deploy the Site or change sharing.

## 3. Capability gate

Phase 00 must directly prove in the owner account:

1. compatible local Git project;
2. supported server-side route;
3. D1 binding `DB`, transaction and rollback;
4. hosted secret readable server-side and absent client-side;
5. Save version associated with exact Git commit;
6. usable family sharing option;
7. protected route callable externally after explicit deployment approval.

A missing required capability blocks the architecture. There is no external DB/host fallback.

## 4. Ingest flow

```text
scheduled slot
→ immutable 121-place catalog
→ bounded source requests
→ same bytes hashed, decoded, parsed
→ schema and semantic validation
→ normalized generation payload
→ POST /api/internal/ingest
→ D1 transaction
→ current last-known-good + raw history + run receipt
```

Rules:

- exact 121-place catalog identity is preserved;
- failed places are never fabricated;
- valid non-expired last-known-good may be visibly carried forward;
- expired records become unavailable and current values/forecast are hidden;
- the previous active generation survives a failed transaction;
- replay is idempotent by deterministic key and payload hash.

## 5. D1 storage layers

| Layer | Purpose | Retention |
|---|---|---:|
| `current_snapshot` | fast initial read | active generation |
| `raw_observation_15m` | reprocessing and quality | 7 days |
| `hourly_observation` | recurring patterns | 90 days |
| `daily_summary` | long-term trend | 730 days default |
| `weekday_hour_profile` | family recommendations | long-lived |
| `detail_cache` | parking/roads/events/etc. | per-section TTL |
| `job_receipts` | operations | 90 days |

Production history is not committed to Git.

## 6. Failure behavior

1. fresh official snapshot;
2. non-expired carried-forward value with original source time;
3. unavailable place row;
4. Kakao SDK failure → fully usable list-only view;
5. geolocation denial → hide distance sort;
6. address search failure → retain official place-name search;
7. quality summary failure → deterministic metrics remain available;
8. Sites D1/server route unavailable → stop as `NOT_RUN_BLOCKED`, not external fallback.
