from __future__ import annotations

import os
import subprocess
import sys


def test_quota_probe_fails_closed_without_the_owner_controlled_key() -> None:
    # Given: an environment without the owner-controlled API key.
    environment = {name: value for name, value in os.environ.items() if name != "SEOUL_OPEN_DATA_KEY"}

    # When: a bounded quota probe is requested.
    result = subprocess.run(
        [sys.executable, "-m", "collector.cli", "quota-probe", "--sample-size", "3"],
        capture_output=True,
        check=False,
        cwd=".",
        env=environment,
        text=True,
    )

    # Then: it remains blocked and does not echo a secret value.
    assert result.returncode == 3
    assert "SEOUL_OPEN_DATA_KEY is required" in result.stderr
