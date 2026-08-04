from __future__ import annotations

import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


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
