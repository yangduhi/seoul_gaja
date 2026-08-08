# Weekly Codex Maintenance Prompt

```text
Review the current Seoul Crowd Radar repository and the latest deterministic weekly-quality.json.

Scope:
1. Check scheduled workflow health, missed intervals, duplicate snapshot IDs, and retention jobs.
2. Check Seoul API schema drift against stored fixtures and contracts.
3. Check history coverage and maturity transitions for all 121 places.
4. Check that official current/forecast values remain separate from historical profiles.
5. Check UI/design drift against design/design.md and the latest deterministic mockups.
6. Run unit, contract, integration, and focused browser tests.
7. Do not change code automatically unless explicitly asked. Produce a ranked patch plan.
8. Do not deploy or alter secrets.

Return:
VERDICT: PASS | REVISE
BLOCKERS: ...
DATA_QUALITY: ...
SCHEDULE_HEALTH: ...
DESIGN_DRIFT: ...
PATCH_PLAN: ...
```
