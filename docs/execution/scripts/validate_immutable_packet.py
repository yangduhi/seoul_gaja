from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Final


REPOSITORY_ROOT: Final = Path(__file__).resolve().parents[3]
PACKET_PATH: Final = "docs/codex-pack-v4"


def git_bytes(*args: str) -> bytes:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        check=True,
        shell=False,
    )
    return completed.stdout


def git_text(*args: str) -> str:
    return git_bytes(*args).decode("utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-git-blob-listing-sha256", required=True)
    args = parser.parse_args()

    status = git_text("status", "--porcelain", "--untracked-files=all", "--", PACKET_PATH)
    if status:
        fail("immutable packet has tracked or untracked working-tree changes")

    listing = git_bytes("ls-tree", "-r", "HEAD", "--", PACKET_PATH)
    listing_hash = hashlib.sha256(listing).hexdigest()
    if listing_hash != args.expected_git_blob_listing_sha256:
        fail("immutable packet Git blob listing does not match the bound preparation candidate")

    temp_root = REPOSITORY_ROOT / ".omo" / "tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="immutable-packet-", dir=temp_root) as directory:
        archive_root = Path(directory)
        paths = git_bytes("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", PACKET_PATH).split(b"\0")
        for raw_path in paths:
            if not raw_path:
                continue
            relative_path = raw_path.decode("utf-8")
            target = archive_root / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git_bytes("show", f"HEAD:{relative_path}"))
        packet_root = archive_root / PACKET_PATH
        completed = subprocess.run(
            [sys.executable, str(packet_root / "scripts" / "validate_packet.py"), str(packet_root)],
            cwd=REPOSITORY_ROOT,
            text=True,
            capture_output=True,
            check=False,
            shell=False,
        )
    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="")
    if completed.returncode:
        raise SystemExit(completed.returncode)


if __name__ == "__main__":
    main()
