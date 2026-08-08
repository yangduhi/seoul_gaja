from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest


SCRIPT_PATH = Path(__file__).parents[2] / "docs" / "execution" / "scripts" / "validate_authority_lock.py"
FROZEN_HEAD = "frozen-head"
FROZEN_TREE = "frozen-tree"
MUTABLE_HEAD = "advanced-preparation-head"
CANDIDATE_HEAD = "candidate-head"


@pytest.fixture
def validator_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("authority_validator", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("authority validator module could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure_transition(
    monkeypatch: pytest.MonkeyPatch,
    validator_module: ModuleType,
    *,
    frozen_tree: str = FROZEN_TREE,
    preparation_is_descendant: bool = True,
    candidate_is_descendant: bool = True,
) -> None:
    def fake_git(*args: str) -> str:
        match args:
            case ("rev-parse", "frozen-head^{tree}"):
                return frozen_tree
            case ("rev-parse", "codex/prep-v4-1^{commit}"):
                return MUTABLE_HEAD
            case _:
                raise AssertionError(f"unexpected git invocation: {args}")

    def fake_is_ancestor(ancestor: str, descendant: str) -> bool:
        match (ancestor, descendant):
            case ("frozen-head", "advanced-preparation-head"):
                return preparation_is_descendant
            case ("frozen-head", "candidate-head"):
                return candidate_is_descendant
            case unexpected:
                raise AssertionError(f"unexpected ancestry query: {unexpected}")

    monkeypatch.setattr(validator_module, "git", fake_git)
    monkeypatch.setattr(validator_module, "is_ancestor", fake_is_ancestor)


def test_advanced_preparation_branch_passes_from_frozen_candidate(
    monkeypatch: pytest.MonkeyPatch, validator_module: ModuleType
) -> None:
    configure_transition(monkeypatch, validator_module)

    assert validator_module.transition_failures(
        {
            "preparation_head": FROZEN_HEAD,
            "preparation_tree": FROZEN_TREE,
        },
        "codex/prep-v4-1",
        CANDIDATE_HEAD,
    ) == []


@pytest.mark.parametrize(
    ("frozen_tree", "preparation_is_descendant", "candidate_is_descendant", "failure"),
    [
        (FROZEN_TREE, False, True, "preparation branch head is not a descendant"),
        (FROZEN_TREE, True, False, "candidate head is not a descendant"),
        ("wrong-tree", True, True, "frozen preparation tree"),
    ],
)
def test_transition_rejects_non_descendant_or_wrong_frozen_tree(
    monkeypatch: pytest.MonkeyPatch,
    validator_module: ModuleType,
    frozen_tree: str,
    preparation_is_descendant: bool,
    candidate_is_descendant: bool,
    failure: str,
) -> None:
    configure_transition(
        monkeypatch,
        validator_module,
        frozen_tree=frozen_tree,
        preparation_is_descendant=preparation_is_descendant,
        candidate_is_descendant=candidate_is_descendant,
    )

    failures = validator_module.transition_failures(
        {
            "preparation_head": FROZEN_HEAD,
            "preparation_tree": FROZEN_TREE,
        },
        "codex/prep-v4-1",
        CANDIDATE_HEAD,
    )

    assert any(failure in message for message in failures)
