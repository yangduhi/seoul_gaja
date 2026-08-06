"""Core candidate and evidence validation for the design-audit gate."""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TypeAlias

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]

PASS: Final = 0
FAIL: Final = 1
BLOCKED: Final = 3
TARGET_SCORE: Final = 100
TARGET_CLASSES: Final = frozenset({"RENDERED_UI", "NON_RENDERING_FRONTEND", "SERVER_ONLY"})
REQUIRED_ARTIFACTS: Final = (
    "audit-manifest.json", "mengto-recommendation.json", "contract-matrix.json",
    "scorecard.json", "improvement-plan.json", "loop-ledger.json", "findings.json",
    "verdict.json", "worktree-snapshot.json",
)
LOOP_FIELDS: Final = (
    "iteration", "baseline_score", "target_score", "improvement_plan_id", "applied_changes",
    "score_after", "score_delta", "recheck_verdict", "head_sha", "head_tree_sha",
    "worktree_snapshot_sha256", "next_loop_state",
)


class ValidationFailure(Exception):
    """A named contract failure that is safe to serialize."""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """The machine-readable result of one audit-directory validation."""

    verdict: str
    exit_code: int
    failures: tuple[str, ...]
    audit_dir: str
    target_class: str | None

    def as_json(self) -> dict[str, JsonValue]:
        return {"verdict": self.verdict, "exit_code": self.exit_code, "failures": list(self.failures), "audit_dir": self.audit_dir, "target_class": self.target_class}


def read_json(path: Path) -> JsonValue:
    return json.loads(path.read_text(encoding="utf-8"))


def mapping(value: JsonValue, label: str) -> dict[str, JsonValue]:
    if not isinstance(value, dict):
        raise ValidationFailure("JSON_OBJECT_REQUIRED", f"{label} must be an object")
    return value


def string(value: JsonValue, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValidationFailure("STRING_REQUIRED", f"{label} must be a non-empty string")
    return value


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_value(root: Path, revision: str) -> str:
    try:
        result = subprocess.run(["git", "rev-parse", revision], cwd=root, check=True, capture_output=True, text=True, encoding="utf-8")
    except subprocess.CalledProcessError as error:
        raise ValidationFailure("GIT_ID_UNAVAILABLE", f"git rev-parse failed for {revision}") from error
    return result.stdout.strip()


def candidate_manifest(manifest: dict[str, JsonValue]) -> dict[str, str]:
    candidate = mapping(manifest.get("candidate"), "audit-manifest.candidate")
    fields = ("head_sha", "head_tree_sha", "plan_sha256", "authority_lock_sha256", "worktree_snapshot_sha256")
    values: dict[str, str] = {}
    for field in fields:
        values[field] = string(candidate.get(field), f"candidate.{field}")
    if "tree_sha" in candidate:
        raise ValidationFailure("LEGACY_TREE_SHA", "use candidate.head_tree_sha; tree_sha is not a valid worktree binding")
    return values


def snapshot_digest(root: Path, manifest: dict[str, JsonValue]) -> str:
    snapshot = mapping(manifest.get("snapshot"), "audit-manifest.snapshot")
    entries_value = snapshot.get("entries")
    if not isinstance(entries_value, list) or not entries_value:
        raise ValidationFailure("SNAPSHOT_ENTRIES_REQUIRED", "snapshot.entries must be a non-empty array")
    entries: list[tuple[str, str]] = []
    for index, raw_entry in enumerate(entries_value):
        entry = mapping(raw_entry, f"snapshot.entries[{index}]")
        relative = string(entry.get("path"), f"snapshot.entries[{index}].path")
        digest = string(entry.get("sha256"), f"snapshot.entries[{index}].sha256")
        path = (root / relative).resolve()
        if Path(relative).is_absolute() or root.resolve() not in path.parents and path != root.resolve():
            raise ValidationFailure("SNAPSHOT_PATH_ESCAPE", relative)
        if relative.startswith(".omo/evidence/design-audit"):
            raise ValidationFailure("SNAPSHOT_INCLUDES_OUTPUT", relative)
        if not path.is_file() or sha256_file(path) != digest:
            raise ValidationFailure("SNAPSHOT_INPUT_MISMATCH", relative)
        entries.append((relative, f"{digest}  {relative}\n"))
    return hashlib.sha256("".join(line for _, line in sorted(entries)).encode("utf-8")).hexdigest()


def validate_candidate(root: Path, manifest: dict[str, JsonValue]) -> dict[str, str]:
    candidate = candidate_manifest(manifest)
    actual = {
        "head_sha": git_value(root, "HEAD"),
        "head_tree_sha": git_value(root, "HEAD^{tree}"),
        "plan_sha256": sha256_file(root / ".omo/plans/seoul-gaja-v4-plan-review.md"),
        "authority_lock_sha256": sha256_file(root / ".omo/authority-lock.json"),
        "worktree_snapshot_sha256": snapshot_digest(root, manifest),
    }
    for field, expected in actual.items():
        if candidate[field] != expected:
            raise ValidationFailure(f"{field.upper()}_MISMATCH", f"expected {expected}, found {candidate[field]}")
    return candidate


def load_artifacts(audit_dir: Path) -> dict[str, dict[str, JsonValue]]:
    artifacts: dict[str, dict[str, JsonValue]] = {}
    for name in REQUIRED_ARTIFACTS:
        path = audit_dir / name
        if not path.is_file():
            raise ValidationFailure("ARTIFACT_MISSING", name)
        artifacts[name] = mapping(read_json(path), name)
    return artifacts


def validate_loop(ledger: dict[str, JsonValue], candidate: dict[str, str]) -> None:
    iterations = ledger.get("iterations")
    if not isinstance(iterations, list) or not iterations:
        raise ValidationFailure("LOOP_ITERATIONS_REQUIRED", "loop-ledger.iterations must be non-empty")
    for index, raw_iteration in enumerate(iterations):
        iteration = mapping(raw_iteration, f"loop-ledger.iterations[{index}]")
        missing = [field for field in LOOP_FIELDS if field not in iteration]
        if missing:
            raise ValidationFailure("LOOP_FIELD_MISSING", f"iteration {index + 1}: {', '.join(missing)}")
        if iteration["head_sha"] != candidate["head_sha"] or iteration["head_tree_sha"] != candidate["head_tree_sha"]:
            raise ValidationFailure("LOOP_CANDIDATE_MISMATCH", f"iteration {index + 1}")
        if iteration["worktree_snapshot_sha256"] != candidate["worktree_snapshot_sha256"]:
            raise ValidationFailure("LOOP_SNAPSHOT_MISMATCH", f"iteration {index + 1}")


def validate_snapshot_artifact(snapshot: dict[str, JsonValue], candidate: dict[str, str]) -> None:
    if snapshot.get("algorithm") != "sha256-path-manifest-v1":
        raise ValidationFailure("SNAPSHOT_ALGORITHM_INVALID", "worktree-snapshot.algorithm")
    if snapshot.get("aggregate_sha256") != candidate["worktree_snapshot_sha256"]:
        raise ValidationFailure("SNAPSHOT_ARTIFACT_MISMATCH", "worktree-snapshot.aggregate_sha256")
    for field in ("head_sha", "head_tree_sha", "worktree_snapshot_sha256"):
        if snapshot.get(field) != candidate[field]:
            raise ValidationFailure("SNAPSHOT_CANDIDATE_MISMATCH", f"worktree-snapshot.{field}")


def validate_artifact_bindings(artifacts: dict[str, dict[str, JsonValue]], candidate: dict[str, str]) -> None:
    fields = ("head_sha", "head_tree_sha", "worktree_snapshot_sha256")
    for name, artifact in artifacts.items():
        if name in {"audit-manifest.json", "worktree-snapshot.json"}:
            continue
        for field in fields:
            if artifact.get(field) != candidate[field]:
                raise ValidationFailure("ARTIFACT_CANDIDATE_MISMATCH", f"{name}.{field}")


def validate_non_rendering(artifacts: dict[str, dict[str, JsonValue]]) -> None:
    verdict = string(artifacts["verdict.json"].get("verdict"), "verdict.verdict")
    if verdict != "NOT_APPLICABLE":
        raise ValidationFailure("NON_RENDERING_VERDICT_REQUIRED", verdict)


def validate_blocker(verdict: dict[str, JsonValue]) -> None:
    blocker = mapping(verdict.get("blocker"), "verdict.blocker")
    fields = ("type", "reason", "owner_or_tool", "next_allowed_action", "candidate_snapshot")
    missing = [field for field in fields if field not in blocker]
    if missing:
        raise ValidationFailure("BLOCKER_FIELD_MISSING", ", ".join(missing))


def validate_audit(root: Path, audit_dir: Path) -> ValidationResult:
    manifest = mapping(read_json(audit_dir / "audit-manifest.json"), "audit-manifest.json")
    candidate = validate_candidate(root, manifest)
    target = mapping(manifest.get("target"), "audit-manifest.target")
    target_class = string(target.get("target_class"), "target.target_class")
    if target_class not in TARGET_CLASSES:
        raise ValidationFailure("TARGET_CLASS_INVALID", target_class)
    artifacts = load_artifacts(audit_dir)
    validate_snapshot_artifact(artifacts["worktree-snapshot.json"], candidate)
    validate_artifact_bindings(artifacts, candidate)
    for name in ("scorecard.json", "improvement-plan.json", "loop-ledger.json", "verdict.json"):
        if artifacts[name].get("target_class") != target_class:
            raise ValidationFailure("TARGET_CLASS_MISMATCH", name)
    validate_loop(artifacts["loop-ledger.json"], candidate)
    mengto = artifacts["mengto-recommendation.json"]
    if mengto.get("router") != "mengto-skills" or mengto.get("status") != "PASS":
        raise ValidationFailure("MENGTO_EVIDENCE_REQUIRED", "fresh mengto-skills PASS is required")
    if target_class == "RENDERED_UI":
        gate_verdict = string(artifacts["verdict.json"].get("verdict"), "verdict.verdict")
        if gate_verdict == "NOT_RUN_BLOCKED":
            validate_blocker(artifacts["verdict.json"])
            return ValidationResult("NOT_RUN_BLOCKED", BLOCKED, (), str(audit_dir), target_class)
        from design_audit_validator_visual import validate_rendered_ui, validate_matrix

        capture_path = audit_dir / "capture-manifest.json"
        if capture_path.is_file():
            artifacts["capture-manifest.json"] = mapping(read_json(capture_path), "capture-manifest.json")
        for matrix_name in ("state-transition-matrix.json", "responsive-acceptance.json"):
            matrix_path = audit_dir / matrix_name
            if not matrix_path.is_file():
                raise ValidationFailure("MATRIX_ARTIFACT_REQUIRED", matrix_name)
            artifacts[matrix_name] = mapping(read_json(matrix_path), matrix_name)
        validate_artifact_bindings(artifacts, candidate)
        validate_matrix(artifacts["contract-matrix.json"], ("source_requirement_id", "source_anchor", "applicable_route", "applicable_state", "applicable_viewport", "expected_observable", "observation_method", "actual_evidence", "classification"), "contract-matrix")
        validate_matrix(artifacts["state-transition-matrix.json"], ("surface_id", "trigger", "precondition", "visible_result", "focus_target", "live_announcement", "history_effect", "recovery_or_exit", "evidence_id"), "state-transition-matrix")
        validate_matrix(artifacts["responsive-acceptance.json"], ("viewport_or_range", "layout_mode", "visible_regions", "sheet_or_drawer", "scroll_owner", "primary_action_visibility", "evidence_id"), "responsive-acceptance")
        validate_rendered_ui(artifacts, candidate)
    else:
        validate_non_rendering(artifacts)
    verdict = "PASS" if target_class == "RENDERED_UI" else "NOT_APPLICABLE"
    return ValidationResult(verdict, PASS, (), str(audit_dir), target_class)
