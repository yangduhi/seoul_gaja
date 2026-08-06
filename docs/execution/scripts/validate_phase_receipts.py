from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import assert_never

from jsonschema import Draft202012Validator, FormatChecker


JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
SECRET_VALUE_PATTERN = re.compile(r"(?i)(bearer\s+[^\s]+|site_ingest_token\s*[:=]|sk-[a-z0-9_-]{8,}|api[_-]?key\s*[:=])")
HIGH_ENTROPY_TOKEN_PATTERN = re.compile(r"^(?=.{32,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9_-]+$")
SENSITIVE_KEY_NAMES = frozenset({"apikey", "accesstoken", "clientsecret", "authorization", "bearer", "token", "secret", "password", "privatekey"})


def receipt_paths(repository_root: Path, supplied_paths: list[Path]) -> list[Path]:
    if supplied_paths:
        return supplied_paths
    return sorted((repository_root / "docs" / "evidence").glob("phase-*/phase-receipt.json"))


def secret_locations(value: JsonValue, location: str) -> list[str]:
    match value:
        case dict() as mapping:
            locations = [
                f"{location}.{key}"
                for key in mapping
                if re.sub(r"[^a-z0-9]", "", key.lower()) in SENSITIVE_KEY_NAMES
            ]
            for key, child in mapping.items():
                locations.extend(secret_locations(child, f"{location}.{key}"))
            return locations
        case list() as items:
            return [
                secret_location
                for index, item in enumerate(items)
                for secret_location in secret_locations(item, f"{location}[{index}]")
            ]
        case str() as text:
            return [location] if SECRET_VALUE_PATTERN.search(text) or HIGH_ENTROPY_TOKEN_PATTERN.fullmatch(text) else []
        case None | bool() | int() | float():
            return []
        case unreachable:
            assert_never(unreachable)


def semantic_failures(receipt: dict[str, JsonValue], receipt_path: Path) -> list[str]:
    failures: list[str] = []
    locations = secret_locations(receipt, "$")
    if locations:
        failures.append(f"{receipt_path}: receipt contains forbidden secret-shaped JSON at {locations[0]}")

    if receipt.get("phase") == "08" and receipt.get("verdict") == "PASS":
        release = receipt.get("release")
        if isinstance(release, dict):
            expected_fields = {
                "deployed_commit": receipt.get("commit"),
                "deployed_tree": receipt.get("tree"),
                "workflow_head_sha": receipt.get("commit"),
            }
            for field, expected in expected_fields.items():
                if release.get(field) != expected:
                    failures.append(f"{receipt_path}: release.{field} must equal the receipt candidate identity")
    return failures


def expected_identity_failures(receipt: dict[str, JsonValue], receipt_path: Path, args: argparse.Namespace) -> list[str]:
    expected = {
        "commit": args.expected_commit,
        "tree": args.expected_tree,
        "plan_sha256": args.expected_plan_sha256,
    }
    return [
        f"{receipt_path}: {field} does not match the expected binding"
        for field, expected_value in expected.items()
        if expected_value is not None and receipt.get(field) != expected_value
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate verdict-safe phase receipts.")
    parser.add_argument("schema", type=Path)
    parser.add_argument("receipts", nargs="+", type=Path)
    args = parser.parse_args()

    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    failures: list[str] = []
    for receipt_path in args.receipts:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(receipt), key=lambda error: list(error.absolute_path))
        if errors:
            failures.extend(f"{receipt_path}: {error.message}" for error in errors)

    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
