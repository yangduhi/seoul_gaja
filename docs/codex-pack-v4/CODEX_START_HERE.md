# Codex 시작 지시문 — ChatGPT Sites Only v4

아래 블록을 Codex 최초 요청으로 전달한다.

```text
D:\vscode\seoul_gaja 저장소에서 "서울 가자 — 인파 레이더" 구현을 시작하라.

Repository:
- https://github.com/yangduhi/seoul_gaja
- default branch: main
- planning branch: plan/chatgpt-sites-only-v1

Authoritative packet:
- seoul-gaja-chatgpt-sites-only-v4.0.0

Authority order:
1. contracts/platform-boundary.yaml
2. 00_overview/01_global_contracts.md
3. contracts/*
4. design/design.md
5. phases/phase-00-owner-setup-and-capability/*
6. codex/AGENTS.md

이번 작업은 Phase 00 capability proof만 수행한다. 제품 UI, 서울시 live collector, production workflow, Phase 01 이후 기능을 구현하지 말라.

절차:
1. 저장소의 branch, commit, tree, Git status, 파일 구조, lockfile, package manager, local tool version, 기존 AGENTS.md 규칙을 inventory한다. reset, clean, 삭제, 강제 덮어쓰기를 금지한다.
2. main을 직접 수정하지 말고 `codex/phase-00-sites-capability` branch를 만든다.
3. 이 패킷을 `docs/codex-pack-v4/`에 복사하고 `python docs/codex-pack-v4/scripts/validate_packet.py docs/codex-pack-v4`를 실행한다.
4. 기존 AGENTS.md와 `codex/AGENTS.md`를 충돌 없이 병합한다. deeper AGENTS 규칙을 존중한다.
5. ChatGPT desktop의 Sites에서 이 local Git project를 compatible existing project로 준비한다. Sites가 제안하는 starter/runtime을 따른다. 지원되지 않는 framework를 강제하지 않는다.
6. Sites가 `.openai/hosting.json`을 생성·갱신하도록 한다. project_id를 추정하거나 직접 만들지 않는다. secret을 이 파일에 넣지 않는다.
7. D1 binding 이름은 `DB` 하나만 요청한다. R2는 요청하지 않는다.
8. `SITE_INGEST_TOKEN` temporary test value를 Sites hosted secret에 입력하되 값은 source, prompt, log, screenshot, receipt에 남기지 않는다.
9. 최소 health route, D1 transaction/rollback probe, server-only secret probe, synthetic protected ingest probe를 TDD로 구현한다.
10. Save version을 수행하되 Deploy하지 않고 saved version이 exact Git commit에 연결되는지 기록한다.
11. 실제 계정에서 보이는 Share 옵션을 기록하되 access는 변경하지 않는다.
12. external ingest 검증은 사용자에게 deployment 승인을 받은 뒤에만 수행한다. 모든 deployment URL을 production으로 취급한다.
13. 승인된 deployment 후 local curl 또는 manual GitHub Action으로 synthetic record를 POST하고 D1 read-back과 cleanup을 검증한다.
14. D1, supported server route, hosted secret, external ingest, exact-commit Save version 또는 usable family sharing이 없으면 `NOT_RUN_BLOCKED`로 종료한다. 외부 host나 외부 DB를 추가하지 않는다.
15. SEOUL_OPEN_DATA_KEY는 Phase 00 Site에 넣지 않는다. production collector가 GitHub Actions에서만 사용한다.
16. Vercel, Netlify, GitHub Pages, Cloudflare hosting, Supabase, Firebase, separate backend를 추가하지 않는다.
17. 참고 서비스의 source, bundle, asset, wording, branding, deployment architecture를 복제하지 않는다.
18. design/design.md와 deterministic mockup을 시각 권위로 사용한다. AI concept board의 text/number/map은 계약이 아니다.
19. 사용자 승인 없이 git push, PR merge, Deploy, sharing 변경, custom domain, paid API activation을 수행하지 않는다.
20. `docs/evidence/phase-00/`에 receipt, command log, capability matrix, redacted responses, screenshots, known limitations를 남긴다.

Terminal response:
PHASE: 00
VERDICT: PASS | FAIL | NOT_RUN_BLOCKED
COMMIT: 40-char SHA or null
TREE: 40-char SHA or null
TESTS: exact commands and results
BROWSER: viewports, console/page/request/overflow status
SITES: local-project/server-route/D1/secret/save-version/share/external-ingest status
DESIGN_BASELINE: design.md + deterministic mockup filenames
EVIDENCE: docs/evidence/phase-00/phase-receipt.json
BLOCKERS: none or exact blockers with owner action
NEXT_ALLOWED_PHASE: 01 or none
```

Phase 00 승인 후에도 다음 Phase를 자동 시작하지 않는다. 해당 Phase의 `codex-work-order.md`를 새 작업으로 전달한다.
