#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""CLI for the candidate-bound design-audit validator."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from design_audit_validator_core import FAIL, PASS, ValidationFailure, ValidationResult, mapping, read_json, string, validate_audit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit-dir", type=Path)
    parser.add_argument("--active", action="store_true")
    parser.add_argument("--audit-root", type=Path, default=Path(".omo/evidence/design-audit"))
    args = parser.parse_args()
    root = Path.cwd().resolve()
    audit_dir = args.audit_dir.resolve() if args.audit_dir else None
    if args.active:
        active_path = args.audit_root.resolve() / "ACTIVE.json"
        if not active_path.is_file():
            print(json.dumps({"verdict": "NOT_APPLICABLE", "exit_code": PASS, "reason": "no active UI audit"}, ensure_ascii=False))
            return PASS
        active = mapping(read_json(active_path), "ACTIVE.json")
        relative_audit_dir = string(active.get("audit_dir"), "ACTIVE.audit_dir")
        audit_root = args.audit_root.resolve()
        audit_dir = (audit_root / relative_audit_dir).resolve()
        if audit_root not in audit_dir.parents:
            result = ValidationResult("FAIL", FAIL, (f"ACTIVE_PATH_ESCAPE: {relative_audit_dir}",), str(audit_dir), None)
            print(json.dumps(result.as_json(), ensure_ascii=False))
            return FAIL
    if audit_dir is None:
        parser.error("--audit-dir or --active is required")
    try:
        result = validate_audit(root, audit_dir)
    except ValidationFailure as error:
        result = ValidationResult("FAIL", FAIL, (f"{error.code}: {error.detail}",), str(audit_dir), None)
    except (OSError, json.JSONDecodeError) as error:
        result = ValidationResult("FAIL", FAIL, (f"INPUT_ERROR: {error}",), str(audit_dir), None)
    print(json.dumps(result.as_json(), ensure_ascii=False))
    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
