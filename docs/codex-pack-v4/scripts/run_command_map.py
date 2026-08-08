#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

# How to run:
#   python docs/codex-pack-v4/scripts/run_command_map.py --map <path> --id <id>

from __future__ import annotations

import runpy
from pathlib import Path


def main() -> None:
    canonical = Path(__file__).resolve().parents[2] / "execution" / "scripts" / "run_command_map.py"
    runpy.run_path(str(canonical), run_name="__main__")


if __name__ == "__main__":
    main()
