# Owner Prerequisites

This checklist contains everything the owner must prepare before implementation and deployment. No Vercel account, external database, or separate server is required.

## A. Required accounts and permissions

### 1. ChatGPT Sites

- [ ] ChatGPT account has Sites access in the intended workspace.
- [ ] The latest ChatGPT desktop app is installed if a local repository will be opened from Codex.
- [ ] The account can create a private preview.
- [ ] The account can Save version.
- [ ] The account can provision D1 storage.
- [ ] The account can configure hosted environment variables and secrets.
- [ ] The desired family sharing option is visible.
- [ ] Public publishing is enabled only if a public family link is selected.

Do not buy or configure a custom domain for the initial release. The ChatGPT Sites URL is sufficient.

### 2. GitHub repository

Repository: `yangduhi/seoul_gaja`

- [ ] Owner/admin permission is available.
- [ ] GitHub Actions is enabled.
- [ ] Actions may read repository contents.
- [ ] Actions may write only workflow artifacts and status; production data must be sent to Sites D1 rather than committed.
- [ ] Branch protection or an equivalent manual PR review rule is configured for `main`.
- [ ] Workflow permissions do not include automatic deployment to ChatGPT Sites.

The repository is currently public. This is acceptable only because no secret or personal family data will be committed. Change it to private if the owner prefers to keep source and planning documents private.

### 3. Seoul Open Data

- [ ] Create or use a Seoul Open Data account.
- [ ] Issue a production API authentication key.
- [ ] Confirm the API quota and terms applicable to the 121-place collection workload.
- [ ] Confirm the exact API service name and response format in the current official documentation.
- [ ] Store the key only as the GitHub Actions secret `SEOUL_OPEN_DATA_KEY`.

Never place the live key in `.env.example`, a prompt, a screenshot, an issue, or a commit.

### 4. Kakao Developers

- [ ] Create a Kakao Developers application.
- [ ] Enable the JavaScript map product.
- [ ] Obtain the JavaScript key.
- [ ] Register `localhost` for local development.
- [ ] Register the ChatGPT Sites preview/deployment domain after it exists.
- [ ] Store the key in Sites as `PUBLIC_KAKAO_JAVASCRIPT_KEY`.

Optional only when general address search is approved:

- [ ] Enable the Local REST API.
- [ ] Store `KAKAO_REST_API_KEY` in Sites hosted secrets.

## B. Required secret names

| Name | GitHub Actions | ChatGPT Sites | Client-visible | Purpose |
|---|---:|---:|---:|---|
| `SEOUL_OPEN_DATA_KEY` | Required | No | Never | Collector access to Seoul API |
| `SITE_INGEST_URL` | Required after first approved deploy | No | Never | Protected Sites ingest endpoint |
| `SITE_INGEST_TOKEN` | Required | Required | Never | Minimal write authentication |
| `PUBLIC_KAKAO_JAVASCRIPT_KEY` | No | Required | Yes, domain-restricted | Browser map SDK |
| `KAKAO_REST_API_KEY` | No | Optional | Never | Optional address geocoding |
| `COLLECT_INTERVAL_MINUTES` | Optional | No | No | Collector interval, default 15 |

Generate `SITE_INGEST_TOKEN` as at least 32 random bytes encoded as hexadecimal or URL-safe base64. The actual value must be entered separately in GitHub Actions Secrets and ChatGPT Sites Settings.

## C. Family sharing decision

Choose one before Phase 08.

### Option A — Selected family accounts

Use `Selected active users or groups` when supported. Each invited family member must sign in with the account that received access.

### Option B — Public link

Use `Anyone on the internet` when family members should open the link without workspace access. In this mode:

- do not store names, schedules, home addresses, or location history;
- do not add free-text submission forms;
- request current location only after a click and keep it in browser memory;
- add `noindex,nofollow` where the runtime permits, while recognizing that this is not access control.

Initial recommendation: Option B for convenience, provided the Site contains only public Seoul data and transient browser location.

## D. Local development prerequisites

Codex should confirm and document the versions selected by the Sites starter. Do not preselect a framework that Sites cannot deploy.

Expected local tools:

- [ ] Git
- [ ] Node.js version required by the Sites starter
- [ ] package manager selected by the starter
- [ ] latest ChatGPT desktop app
- [ ] Chromium-compatible browser for test evidence

## E. Explicitly not required

```text
Vercel account or token
Vercel project
Netlify account
Cloudflare account
Supabase project
Firebase project
AWS/GCP/Azure account
custom domain
OpenAI API key
```

An OpenAI API key is not part of the initial product. ChatGPT and Codex are used interactively for development and review, not as a required runtime dependency.

## F. Preparation order

1. Confirm ChatGPT Sites access.
2. Confirm D1 and hosted settings are visible.
3. Confirm GitHub Actions is enabled.
4. Obtain the Seoul API key.
5. Create the Kakao app and JavaScript key.
6. Run Phase 00 capability proof.
7. After an approved Site URL exists, register its domain in Kakao Developers.
8. Add `SITE_INGEST_URL` and the matching token to GitHub Actions Secrets.
9. Begin production collection only after Phase 02 acceptance.