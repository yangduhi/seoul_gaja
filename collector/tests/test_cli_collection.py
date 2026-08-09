from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, tzinfo
from pathlib import Path

from pytest import MonkeyPatch

from collector import cli
from collector.domain.models import CatalogPlace
from collector.source.normalize import CROWD_LEVELS
from collector.source.seoul_api import CityDataResponse


FIXED_FETCHED_AT = datetime(2026, 8, 8, 9, 0, tzinfo=UTC)


class FixedDateTime(datetime):
    @classmethod
    def now(cls, timezone: tzinfo | None = None) -> datetime:
        return FIXED_FETCHED_AT


def _citydata_response(_api_key: str, place: CatalogPlace) -> CityDataResponse:
    crowd_level = next(iter(CROWD_LEVELS))
    return CityDataResponse(
        raw_sha256=hashlib.sha256(place.area_code.encode()).hexdigest(),
        raw_size=1,
        payload={
            "AREA_CD": place.area_code,
            "AREA_NM": place.area_name,
            "LIVE_PPLTN_STTS": [
                {
                    "AREA_CONGEST_LVL": crowd_level,
                    "AREA_PPLTN_MIN": "100",
                    "AREA_PPLTN_MAX": "200",
                    "PPLTN_TIME": "2026-08-08 17:55",
                }
            ],
            "FCST_PPLTN": [
                {
                    "FCST_YN": "Y",
                    "FCST_TIME": forecast_time,
                    "FCST_CONGEST_LVL": crowd_level,
                    "FCST_PPLTN_MIN": "100",
                    "FCST_PPLTN_MAX": "200",
                }
                for forecast_time in (
                    "2026-08-08 19:00",
                    "2026-08-08 20:00",
                    "2026-08-08 21:00",
                    "2026-08-08 22:00",
                    "2026-08-08 23:00",
                    "2026-08-09 00:00",
                )
            ],
        },
    )


def test_collect_emits_source_backed_future_official_forecasts(
    monkeypatch: MonkeyPatch, tmp_path: Path
) -> None:
    # Given: all 121 official catalog identities and one complete CITYDATA response per place.
    output = tmp_path / "snapshot.json"
    receipt = tmp_path / "receipt.json"
    monkeypatch.setenv("SEOUL_OPEN_DATA_KEY", "fixture-redacted")
    monkeypatch.setenv("GITHUB_RUN_ID", "fixture-run-001")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "1")
    monkeypatch.setenv("GITHUB_SHA", "fixture-collector-sha")
    monkeypatch.setattr(cli, "datetime", FixedDateTime)
    monkeypatch.setattr(cli, "fetch_citydata", _citydata_response)

    # When: the collector creates its canonical snapshot.
    result = cli._collect(Path("data/seoul-places.json"), output, receipt)

    # Then: every row retains six source-backed future official forecast points without recommendations.
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert result == 0
    assert len(payload["rows"]) == 121
    assert all("officialForecast" in row for row in payload["rows"])
    for row in payload["rows"]:
        forecast = row["officialForecast"]
        assert forecast["authority"] == "official"
        assert forecast["rawHash"] == row["rawHash"]
        assert len(forecast["points"]) >= 6
        assert all(point["timestamp"] > row["fetchedAt"] for point in forecast["points"])
        assert not any("percentile" in point or "recommendation" in point for point in forecast["points"])
