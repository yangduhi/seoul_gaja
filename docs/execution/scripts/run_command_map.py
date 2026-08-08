from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


BLOCKED_EXIT = 3


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", dest="map_path", required=True, type=Path)
    parser.add_argument("--id", dest="command_id", required=True)
    args = parser.parse_args()

    map_path = args.map_path.resolve()
    data = json.loads(map_path.read_text(encoding="utf-8"))
    command = next((item for item in data["commands"] if item["id"] == args.command_id), None)
    if command is None:
        raise SystemExit(f"FAIL: unknown command id: {args.command_id}")

    repository_root = (map_path.parent / data["repository_root"]).resolve()
    cwd = (repository_root / command["cwd"]).resolve()
    if repository_root != cwd and repository_root not in cwd.parents:
        raise SystemExit("FAIL: command cwd escapes repository root")

    missing = [path for path in command["required_paths"] if not (repository_root / path).exists()]
    if missing:
        print(
            json.dumps(
                {
                    "id": args.command_id,
                    "verdict": "NOT_RUN_BLOCKED",
                    "exit": BLOCKED_EXIT,
                    "missing_paths": missing,
                    "evidence": command["evidence"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        raise SystemExit(BLOCKED_EXIT)

    completed = subprocess.run(command["argv"], cwd=cwd, text=True, capture_output=True, shell=False)
    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="")
    if completed.returncode not in command["expected_exit"]:
        print(
            json.dumps(
                {
                    "id": args.command_id,
                    "verdict": "FAIL",
                    "actual_exit": completed.returncode,
                    "expected_exit": command["expected_exit"],
                    "evidence": command["evidence"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        raise SystemExit(1)

    print(
        json.dumps(
            {
                "id": args.command_id,
                "verdict": "PASS",
                "actual_exit": completed.returncode,
                "assertions": command["assertions"],
                "evidence": command["evidence"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
