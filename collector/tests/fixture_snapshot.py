from __future__ import annotations

import hashlib
import os
import sys
from datetime import UTC, datetime, tzinfo
from pathlib import Path
from unittest.mock import patch

from collector import cli
from collector.domain.models import CatalogPlace
from collector.source.normalize import CROWD_LEVELS
from collector.source.seoul_api import CityDataResponse


FIXED_FETCHED_AT = datetime(2026, 8, 8, 9, 0, tzinfo=UTC)


class FixedDateTime(datetime):
    @classmethod
    def now(cls, timezone: tzinfo | None = None) -> datetime:
        return FIXED_FETCHED_AT


def _fake_fetch(_api_key: str, place: CatalogPlace) -> CityDataResponse:
    area_code = place.area_code
    area_name = place.area_name
    return CityDataResponse(
        raw_sha256=hashlib.sha256(area_code.encode()).hexdigest(),
        raw_size=1,
        payload={
            "AREA_CD": area_code,
            "AREA_NM": area_name,
            "LIVE_PPLTN_STTS": [
                {
                    "AREA_CONGEST_LVL": next(iter(CROWD_LEVELS)),
                    "AREA_PPLTN_MIN": "100",
                    "AREA_PPLTN_MAX": "200",
                    "PPLTN_TIME": "2026-08-08 17:55",
                }
            ],
        },
    )


def main() -> int:
    snapshot_path = Path(sys.argv[1])
    receipt_path = Path(sys.argv[2])
    environment = {
        "SEOUL_OPEN_DATA_KEY": "fixture-redacted",
        "GITHUB_RUN_ID": "fixture-run-001",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": "2c4d4f6fb2cd25385edce729d6f26df42f99d3ab",
    }
    with (
        patch.dict(os.environ, environment, clear=False),
        patch.object(cli, "datetime", FixedDateTime),
        patch.object(cli, "fetch_citydata", _fake_fetch),
    ):
        return cli._collect(Path("data/seoul-places.json"), snapshot_path, receipt_path)


if __name__ == "__main__":
    raise SystemExit(main())
