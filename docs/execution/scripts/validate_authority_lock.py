from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
LOCK_PATH = REPOSITORY_ROOT / ".omo" / "authority-lock.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


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


def main() -> None:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    authority = lock["authority"]
    packet = lock["audit_packet_v4_0_0"]
    starter = lock["starter"]
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
    expected = {
        "remote": expected_remote,
        "branch": authority["preparation_branch"],
        "head": authority["base_commit"],
        "tree": authority["base_tree"],
    }
    for key in ("remote", "branch", "head", "tree"):
        if observed[key] != expected[key]:
            failures.append(f"{key}: expected {expected[key]}, observed {observed[key]}")

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
        {"path": starter["manifest"], "sha256": starter["manifest_sha256"]},
        {"path": starter["lockfile"], "sha256": starter["lockfile_sha256"]},
        {"path": starter["hosting_config"], "sha256": starter["hosting_config_sha256"]},
        {"path": "docs/codex-pack-v4/manifest.sha256", "sha256": packet["extracted_manifest_sha256"]},
    ]
    for artifact in artifacts:
        path = REPOSITORY_ROOT / artifact["path"]
        if not path.is_file():
            failures.append(f"missing file: {artifact['path']}")
            continue
        actual_hash = sha256(path)
        if actual_hash != artifact["sha256"]:
            failures.append(f"sha256 mismatch: {artifact['path']}")

    zip_path = Path(packet["source_zip"])
    if not zip_path.is_file():
        failures.append(f"missing preserved ZIP: {zip_path}")
    elif sha256(zip_path) != packet["zip_sha256"]:
        failures.append(f"sha256 mismatch: {zip_path}")

    verdict = "PASS" if not failures else "FAIL"
    print(json.dumps({"verdict": verdict, "observed": observed, "failures": failures}, indent=2))
    raise SystemExit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
