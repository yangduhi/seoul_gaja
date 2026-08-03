# Architecture — ChatGPT Sites Only

## 1. Decision

`seoul_gaja` uses **ChatGPT Sites as the only application host and deployment surface**.

GitHub is not an application host. It provides source control, pull requests, CI, scheduled collection, and audit evidence. The public or family-facing application, its server-side runtime, durable structured storage, preview, saved versions, deployment URL, and sharing controls all belong to ChatGPT Sites.

## 2. System boundary

```text
Seoul Open Data API
        │
        │ scheduled HTTPS collection
        ▼
GitHub Actions collector
  - source request
  - schema validation
  - normalization
  - run receipt
        │
        │ authenticated POST
        ▼
ChatGPT Sites server route
  - SITE_INGEST_TOKEN validation
  - semantic validation
  - atomic D1 transaction
        │
        ▼
ChatGPT Sites D1
  - place catalog
  - current last-known-good
  - official forecast
  - collection runs
  - hourly history
  - daily summaries
  - weekday/time profiles
        │
        ▼
ChatGPT Sites UI
  - map/list/search/filter
  - place details
  - official forecast
  - accumulated pattern
  - family recommendations
```

Kakao JavaScript SDK may be loaded by the browser for map rendering. Its JavaScript key is domain-restricted. A server-side Kakao REST key is optional and is used only if address-to-coordinate search is approved.

## 3. Responsibility matrix

| Component | Responsibility | Explicitly not responsible for |
|---|---|---|
| ChatGPT Sites | Site runtime, server routes, D1/R2, secrets, preview, versions, deployment, sharing | Background cron reliability outside supported runtime |
| GitHub repository | Source, contracts, fixtures, migrations, docs, review history | Serving the production app or retaining live history |
| GitHub Actions | Scheduled data collection, deterministic aggregation, CI, manual replay | User-facing hosting, database, Sites deployment |
| Seoul API | Official current/forecast and integrated city data | First-party historical pattern or family score |
| Kakao API | Map rendering and optional geocoding | Crowd truth or historical prediction |
| Codex | Implementation, testing, review, maintenance proposals | Unattended production deployment |

## 4. ChatGPT Sites capability gate

The architecture is valid only after Phase 00 proves all of the following in the owner’s actual account:

1. The repository can be opened as a compatible local Sites project.
2. The generated project supports server-side routes or an equivalent protected ingest surface.
3. A D1 binding named `DB` can be provisioned and read/written.
4. Hosted environment secrets can be read server-side and are absent from client bundles.
5. A deployed protected route can receive a synthetic POST from outside the Site.
6. Save version associates the deployment candidate with the reviewed Git commit.
7. An acceptable family sharing mode is available.

Failure of items 2–5 is a blocking architecture failure. Do not add Vercel, Supabase, Firebase, a cloud worker, or another backend as a workaround.

## 5. Runtime data model

Minimum tables:

```text
place_catalog
source_artifact
collection_run
collection_result
population_lkg
forecast_lkg
life_info_lkg
observation_hourly
summary_daily
weekday_time_profile
schema_migration
```

### Current record contract

Every current record includes:

```text
areaCode
areaName
congestionLevel
populationMin
populationMax
sourceUpdatedAt
fetchedAt
freshnessState
recordState
sourceArtifactSha256
```

`freshnessState`:

```text
FRESH
DELAYED
STALE
EXPIRED
```

`recordState`:

```text
REFRESHED
CARRIED_FORWARD
UNAVAILABLE
```

An expired record must not be presented as current. A carried-forward record must retain its original source time and visible carried-forward label.

## 6. Ingest contract

Preferred request:

```http
POST /api/internal/ingest
Authorization: Bearer <SITE_INGEST_TOKEN>
Content-Type: application/json
Idempotency-Key: <collector-run-id>
```

The server must:

1. compare the bearer token using a constant-time strategy available in the runtime;
2. reject oversized or malformed bodies before parsing expensive fields;
3. validate catalog identity and source timestamps;
4. reject unknown congestion enums and invalid population ranges;
5. preserve the source body hash;
6. write a new snapshot generation atomically;
7. return the same receipt for an already accepted idempotency key;
8. redact credentials from logs and error bodies.

A simple bearer token is sufficient for this family project. HMAC, nonce, and external identity infrastructure are intentionally excluded unless the threat model changes.

## 7. Collection and accumulation

Default interval: 15 minutes, subject to the actual Seoul API quota measured in Phase 02.

Retention:

| Layer | Retention |
|---|---:|
| 15-minute raw/current snapshots | 7 days |
| Hourly aggregates | 90 days |
| Daily summaries | 2 years |
| Weekday × time profiles | Long-lived |

Accumulated history improves the stability of recurring patterns and recommendation confidence. It does not modify the official current estimate or official forecast.

## 8. Sharing model

Preferred order:

1. selected active users or groups, when supported and practical for the family;
2. public unlisted-style link through `Anyone on the internet`, with no personal data stored;
3. no custom authentication in the initial product.

User geolocation is requested only after an explicit action, used in browser memory for distance sorting, and not stored.

## 9. Deployment model

```text
reviewed Git commit
→ full tests and browser evidence
→ Save version
→ private candidate review
→ explicit owner approval
→ Deploy
→ intended-family-path smoke test
```

Every deployment URL is treated as production. GitHub Actions must not invoke deployment or change sharing settings.

## 10. Excluded architecture

The following are out of scope and must not appear in dependencies, configuration, workflows, or documentation:

```text
Vercel
Netlify
GitHub Pages
Cloudflare Pages or Workers
Supabase
Firebase
Neon
PlanetScale
separately hosted cron/backend
```

The only exception is GitHub Actions, which is already required as the scheduled collector and CI runner.