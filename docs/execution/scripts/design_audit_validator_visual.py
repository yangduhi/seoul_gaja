"""Rendered-surface score, capture, and matrix checks."""

from __future__ import annotations

from typing import Final

from design_audit_validator_core import JsonValue, ValidationFailure, mapping, string

TARGET_SCORE: Final = 100
COMPONENT_IDS: Final = frozenset({
    "C01_SOURCE_FIDELITY", "C02_LAYOUT_GEOMETRY", "C03_RESPONSIVE_VIEWPORTS", "C04_TYPOGRAPHY_CJK",
    "C05_SURFACE_TOKENS", "C06_INTERACTION_STATES", "C07_ACCESSIBILITY", "C08_CONTENT_HIERARCHY",
    "C09_SYSTEM_CONSISTENCY", "C10_EVIDENCE_COMPLETENESS",
})


def validate_rendered_ui(artifacts: dict[str, dict[str, JsonValue]], candidate: dict[str, str]) -> None:
    scorecard = artifacts["scorecard.json"]
    score = scorecard.get("score")
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        raise ValidationFailure("SCORE_REQUIRED", "rendered UI score must be numeric")
    components = scorecard.get("components")
    if not isinstance(components, list) or len(components) != len(COMPONENT_IDS):
        raise ValidationFailure("SCORECARD_COMPONENTS_REQUIRED", "rendered UI scorecard must contain ten components")
    points = 0
    observed_ids: set[str] = set()
    for index, raw_component in enumerate(components):
        component = mapping(raw_component, f"scorecard.components[{index}]")
        component_id = string(component.get("id"), "scorecard.component.id")
        if component_id not in COMPONENT_IDS or component_id in observed_ids:
            raise ValidationFailure("SCORECARD_COMPONENT_ID_INVALID", component_id)
        observed_ids.add(component_id)
        if component.get("status") == "PASS" and component.get("points") == 10:
            points += 10
        elif component.get("status") != "FAIL" or component.get("points") != 0:
            raise ValidationFailure("SCORECARD_COMPONENT_POINTS_INVALID", component_id)
    if observed_ids != COMPONENT_IDS:
        raise ValidationFailure("SCORECARD_COMPONENT_SET_INVALID", "component set differs from contract")
    if points != score:
        raise ValidationFailure("SCORE_SUM_MISMATCH", f"component sum {points} differs from score {score}")
    verdict = string(artifacts["verdict.json"].get("verdict"), "verdict.verdict")
    if verdict == "PASS" and score != TARGET_SCORE:
        raise ValidationFailure("PASS_REQUIRES_SCORE_100", f"score={score}")
    if score < TARGET_SCORE and artifacts["improvement-plan.json"].get("status") == "NOT_REQUIRED":
        raise ValidationFailure("IMPROVEMENT_PLAN_REQUIRED", f"score={score}")
    findings = artifacts["findings.json"].get("findings")
    if isinstance(findings, list):
        for item in findings:
            finding = mapping(item, "findings[]")
            if finding.get("severity") in {"P0", "P1"} and finding.get("status") != "MATCH":
                raise ValidationFailure("SEVERITY_CAP", string(finding.get("finding_id"), "finding.finding_id"))
    capture = artifacts.get("capture-manifest.json")
    if capture is None:
        raise ValidationFailure("CAPTURE_MANIFEST_REQUIRED", "capture-manifest.json")
    captures = capture.get("captures")
    if not isinstance(captures, list) or not captures:
        raise ValidationFailure("CAPTURES_REQUIRED", "capture-manifest.captures")
    required_viewports = {"390x844", "430x932", "768x1024", "1616x923"}
    observed: set[str] = set()
    capture_fields = ("capture_id", "route", "state", "viewport", "dpr", "browser", "candidate_snapshot", "evidence_kind", "evidence_sha256", "source_anchors")
    for index, item in enumerate(captures):
        current = mapping(item, f"capture-manifest.captures[{index}]")
        missing = [field for field in capture_fields if field not in current]
        if missing:
            raise ValidationFailure("CAPTURE_FIELD_MISSING", f"capture {index + 1}: {', '.join(missing)}")
        observed.add(string(current["viewport"], "capture.viewport"))
        if current["evidence_kind"] != "real_surface":
            raise ValidationFailure("REAL_SURFACE_EVIDENCE_REQUIRED", f"capture {index + 1}")
        if mapping(current["candidate_snapshot"], "capture.candidate_snapshot").get("head_sha") != candidate["head_sha"]:
            raise ValidationFailure("CAPTURE_CANDIDATE_MISMATCH", f"capture {index + 1}")
    if not required_viewports.issubset(observed):
        raise ValidationFailure("VIEWPORT_EVIDENCE_INCOMPLETE", ", ".join(sorted(required_viewports - observed)))
    if artifacts["verdict.json"].get("head_sha") != candidate["head_sha"]:
        raise ValidationFailure("VERDICT_CANDIDATE_MISMATCH", "verdict.head_sha")


def validate_matrix(artifact: dict[str, JsonValue], fields: tuple[str, ...], label: str) -> None:
    rows = artifact.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValidationFailure("MATRIX_ROWS_REQUIRED", label)
    for index, raw_row in enumerate(rows):
        row = mapping(raw_row, f"{label}.rows[{index}]")
        missing = [field for field in fields if field not in row]
        if missing:
            raise ValidationFailure("MATRIX_FIELD_MISSING", f"{label}.rows[{index}]: {', '.join(missing)}")
