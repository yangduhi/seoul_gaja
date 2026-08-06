from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
LOCK_PATH = REPOSITORY_ROOT / ".omo" / "authority-lock.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPOSITORY_ROOT,
        text=True,
        capture_output=True,
        shell=False,
        check=True,
    )
    return completed.stdout.strip()


def git_bytes(*args: str) -> bytes:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        shell=False,
        check=True,
    )
    return completed.stdout


def sha256_tracked(path: Path) -> str:
    relative_path = path.relative_to(REPOSITORY_ROOT).as_posix()
    if git("status", "--porcelain", "--", relative_path):
        raise SystemExit(f"FAIL: tracked authority artifact has working-tree changes: {relative_path}")
    return sha256_bytes(git_bytes("show", f"HEAD:{relative_path}"))


def is_ancestor(ancestor: str, descendant: str) -> bool:
    completed = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        cwd=REPOSITORY_ROOT,
        text=True,
        capture_output=True,
        shell=False,
        check=False,
    )
    return completed.returncode == 0


def main() -> None:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    authority = lock["authority"]
    packet = lock["audit_packet_v4_0_0"]
    starter = lock["starter"]
    readiness_path = REPOSITORY_ROOT / ".omo" / "IMPLEMENTATION_READINESS.json"
    readiness = json.loads(readiness_path.read_text(encoding="utf-8"))
    failures: list[str] = []

    actual_remote = git("remote", "get-url", "origin").removesuffix(".git")
    expected_remote = authority["repository_url"].removesuffix(".git")
    observed = {
        "repository_root": str(REPOSITORY_ROOT),
        "remote": actual_remote,
        "branch": git("branch", "--show-current"),
        "head": git("rev-parse", "HEAD"),
        "tree": git("rev-parse", "HEAD^{tree}"),
    }
    if observed["remote"] != expected_remote:
        failures.append(f"remote: expected {expected_remote}, observed {observed['remote']}")

    base_tree = git("rev-parse", f"{authority['base_commit']}^{{tree}}")
    if base_tree != authority["base_tree"]:
        failures.append(f"frozen base tree: expected {authority['base_tree']}, observed {base_tree}")

    if readiness.get("implementation_allowed") is True:
        transition = authority["implementation_candidate"]
        preparation_head = git("rev-parse", f"{authority['preparation_branch']}^{{commit}}")
        if preparation_head != transition["preparation_head"]:
            failures.append(
                f"preparation branch head: expected {transition['preparation_head']}, observed {preparation_head}"
            )
        preparation_tree = git("rev-parse", f"{preparation_head}^{{tree}}")
        if preparation_tree != transition["preparation_tree"]:
            failures.append(
                f"preparation branch tree: expected {transition['preparation_tree']}, observed {preparation_tree}"
            )
        if not observed["branch"]:
            failures.append("candidate must be on a named branch")
        if not is_ancestor(preparation_head, observed["head"]):
            failures.append(
                "candidate head is not a descendant of the bound preparation branch head"
            )
    else:
        expected = {
            "branch": authority["preparation_branch"],
            "head": authority["base_commit"],
            "tree": authority["base_tree"],
        }
        for key, value in expected.items():
            if observed[key] != value:
                failures.append(f"{key}: expected {value}, observed {observed[key]}")

    artifacts = [
        authority["plan"],
        authority["amendment"],
        authority["agents"],
        authority["operations_runbook"],
        authority["command_map"],
        {"path": "docs/execution/scripts/validate_authority_lock.py", "sha256": authority["command_map"]["authority_validator_sha256"]},
        {"path": "docs/execution/scripts/validate_command_map.py", "sha256": authority["command_map"]["validator_sha256"]},
        {"path": "docs/execution/scripts/run_command_map.py", "sha256": authority["command_map"]["runner_sha256"]},
        {"path": "docs/execution/scripts/check_checkout.py", "sha256": authority["command_map"]["checkout_checker_sha256"]},
        {"path": "docs/execution/scripts/validate_immutable_packet.py", "sha256": authority["command_map"]["immutable_packet_validator_sha256"]},
        {"path": starter["manifest"], "sha256": starter["manifest_sha256"]},
        {"path": starter["lockfile"], "sha256": starter["lockfile_sha256"]},
        {"path": starter["hosting_config"], "sha256": starter["hosting_config_sha256"]},
        {"path": "docs/codex-pack-v4/MANIFEST.sha256", "sha256": packet["extracted_manifest_sha256"]},
    ]
    for artifact in artifacts:
        path = REPOSITORY_ROOT / artifact["path"]
        if not path.is_file():
            failures.append(f"missing file: {artifact['path']}")
            continue
        actual_hash = sha256_tracked(path)
        if actual_hash != artifact["sha256"]:
            failures.append(f"sha256 mismatch: {artifact['path']}")

    readiness_authority = readiness.get("authority", {})
    for key, artifact in (
        ("plan_sha256", authority["plan"]),
        ("amendment_sha256", authority["amendment"]),
        ("command_map_sha256", authority["command_map"]),
    ):
        if readiness_authority.get(key) != artifact["sha256"]:
            failures.append(f"readiness {key} does not match authority lock")
    if readiness_authority.get("authority_lock_sha256") != sha256_tracked(LOCK_PATH):
        failures.append("readiness authority_lock_sha256 does not match authority lock")

    zip_path = Path(packet["source_zip"])
    if not zip_path.is_file():
        failures.append(f"missing preserved ZIP: {zip_path}")
    elif sha256_file(zip_path) != packet["zip_sha256"]:
        failures.append(f"sha256 mismatch: {zip_path}")

    verdict = "PASS" if not failures else "FAIL"
    print(json.dumps({"verdict": verdict, "observed": observed, "failures": failures}, indent=2))
    raise SystemExit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
