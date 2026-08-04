from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


MANIFESTS = ("package.json", "pyproject.toml", "Cargo.toml", "go.mod")
LOCKFILES = ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock", "uv.lock", "Cargo.lock")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=True, type=Path)
    parser.add_argument("--expect", required=True, choices=("ready", "blocked"))
    args = parser.parse_args()

    root = args.path.resolve()
    git = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=root,
        text=True,
        capture_output=True,
        shell=False,
    )
    manifests = [name for name in MANIFESTS if (root / name).is_file()]
    lockfiles = [name for name in LOCKFILES if (root / name).is_file()]
    ready = git.returncode == 0 and bool(manifests) and bool(lockfiles)
    actual = "ready" if ready else "blocked"
    print(
        json.dumps(
            {
                "path": str(root),
                "git": git.stdout.strip() if git.returncode == 0 else "NOT_A_GIT_WORKTREE",
                "manifests": manifests,
                "lockfiles": lockfiles,
                "verdict": "PASS" if actual == args.expect else "FAIL",
                "observed": actual,
                "expected": args.expect,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    raise SystemExit(0 if actual == args.expect else 1)


if __name__ == "__main__":
    main()
