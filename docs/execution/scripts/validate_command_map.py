from __future__ import annotations

import argparse
import json
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("map_path", type=Path)
    args = parser.parse_args()

    map_path = args.map_path.resolve()
    data = json.loads(map_path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        fail("schema_version must be 1")

    commands = data.get("commands")
    if not isinstance(commands, list) or not commands:
        fail("commands must be a non-empty list")

    required_ids = {
        "task-01-packet",
        "task-01-baseline",
        "task-01-reference-only",
        "task-01-authority",
        *(f"task-{task:02d}-{scenario}" for task in range(2, 13) for scenario in ("happy", "failure")),
        *(f"final-f{gate}" for gate in range(1, 5)),
    }

    seen: set[str] = set()
    for index, command in enumerate(commands):
        if not isinstance(command, dict):
            fail(f"commands[{index}] must be an object")
        command_id = command.get("id")
        if not isinstance(command_id, str) or not command_id:
            fail(f"commands[{index}].id must be non-empty")
        if command_id in seen:
            fail(f"duplicate command id: {command_id}")
        seen.add(command_id)

        argv = command.get("argv")
        if not isinstance(argv, list) or not argv or not all(isinstance(value, str) and value for value in argv):
            fail(f"{command_id}: argv must be a non-empty string array")
        if not isinstance(command.get("cwd"), str) or not command["cwd"]:
            fail(f"{command_id}: cwd must be non-empty")
        expected_exit = command.get("expected_exit")
        if not isinstance(expected_exit, list) or not expected_exit or not all(isinstance(value, int) for value in expected_exit):
            fail(f"{command_id}: expected_exit must be a non-empty integer array")
        assertions = command.get("assertions")
        if not isinstance(assertions, list) or not assertions or not all(isinstance(value, str) and value for value in assertions):
            fail(f"{command_id}: assertions must be a non-empty string array")
        required_paths = command.get("required_paths")
        if not isinstance(required_paths, list) or not all(isinstance(value, str) and value for value in required_paths):
            fail(f"{command_id}: required_paths must be a string array")
        if not isinstance(command.get("evidence"), str) or not command["evidence"]:
            fail(f"{command_id}: evidence must be non-empty")

    missing = sorted(required_ids - seen)
    if missing:
        fail(f"required command ids missing: {missing}")
    print(f"PASS: {len(commands)} command entries validated")


if __name__ == "__main__":
    main()
