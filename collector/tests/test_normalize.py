from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from collector.domain.models import CatalogPlace, SourceDataError
from collector.source.normalize import normalize_current, normalize_forecast


PLACE = CatalogPlace(area_code="POI001", area_name="강남 MICE 관광특구")
FETCHED_AT = datetime(2026, 8, 8, 9, 0, tzinfo=UTC)


def test_normalize_current_preserves_official_population_and_time() -> None:
    # Given: one valid population-only city-data row.
    raw = {
        "AREA_CD": "POI001",
        "AREA_NM": "강남 MICE 관광특구",
        "AREA_CONGEST_LVL": "보통",
        "AREA_PPLTN_MIN": "100",
        "AREA_PPLTN_MAX": "200",
        "PPLTN_TIME": "2026-08-08 17:55",
    }

    # When: the official response is normalized.
    observation = normalize_current(raw, PLACE, FETCHED_AT)

    # Then: source values survive without invented values.
    assert observation.crowd_level == "NORMAL"
    assert observation.population_min == 100
    assert observation.population_max == 200
    assert observation.source_updated_at == datetime(2026, 8, 8, 8, 55, tzinfo=UTC)
    assert observation.fetched_at == FETCHED_AT


@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ({}, "missing area identity"),
        ({"AREA_CD": "POI001", "AREA_NM": "강남 MICE 관광특구", "AREA_PPLTN_MIN": "1", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "unknown crowd level"),
        ({"AREA_CD": "POI001", "AREA_NM": "강남 MICE 관광특구", "AREA_CONGEST_LVL": "보통", "AREA_PPLTN_MIN": "-1", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "negative population"),
        ({"AREA_CD": "POI001", "AREA_NM": "강남 MICE 관광특구", "AREA_CONGEST_LVL": "보통", "AREA_PPLTN_MIN": "3", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "reversed population"),
        ({"AREA_CD": "POI001", "AREA_NM": "강남 MICE 관광특구", "AREA_CONGEST_LVL": "??", "AREA_PPLTN_MIN": "1", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "unknown crowd level"),
        ({"AREA_CD": "POI999", "AREA_NM": "강남 MICE 관광특구", "AREA_CONGEST_LVL": "보통", "AREA_PPLTN_MIN": "1", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "area code mismatch"),
        ({"AREA_CD": "POI001", "AREA_NM": "unexpected identity", "AREA_CONGEST_LVL": "보통", "AREA_PPLTN_MIN": "1", "AREA_PPLTN_MAX": "2", "PPLTN_TIME": "2026-08-08 17:55"}, "area name mismatch"),
    ],
)
def test_normalize_current_rejects_untrusted_population_shapes(raw: dict[str, object], reason: str) -> None:
    # Given: a malformed or identity-conflicting population-only response row.
    # When / Then: it is rejected before it can become a snapshot row.
    with pytest.raises(SourceDataError, match=reason):
        normalize_current(raw, PLACE, FETCHED_AT)


def test_normalize_forecast_keeps_only_valid_future_official_points() -> None:
    # Given: six official future population-only forecast rows in reverse order.
    now = FETCHED_AT
    raw = {
        "FCST_YN": "Y",
        "FCST_PPLTN": [
            {
                "FCST_TIME": (now + timedelta(minutes=offset)).astimezone(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M"),
                "FCST_CONGEST_LVL": "여유",
                "FCST_PPLTN_MIN": "10",
                "FCST_PPLTN_MAX": "20",
            }
            for offset in (360, 300, 240, 180, 120, 60)
        ]
    }

    # When: the forecast section is normalized.
    forecast = normalize_forecast(raw, now)

    # Then: it is future-only, source-backed, and ordered by official time.
    assert len(forecast) == 6
    assert [point.time for point in forecast] == sorted(point.time for point in forecast)
    assert all(point.time > now for point in forecast)
    assert all(point.crowd_level == "RELAXED" for point in forecast)


def test_normalize_forecast_rejects_duplicate_or_insufficient_official_points() -> None:
    # Given: malformed official forecast rows that cannot satisfy the contract.
    now = FETCHED_AT
    point = {
        "FCST_TIME": "2026-08-08 20:00",
        "FCST_CONGEST_LVL": "보통",
        "FCST_PPLTN_MIN": "10",
        "FCST_PPLTN_MAX": "20",
    }
    raw = {"FCST_YN": "Y", "FCST_PPLTN": [point] * 6}

    # When / Then: duplicate timestamps are rejected instead of fabricated.
    with pytest.raises(SourceDataError, match="duplicate forecast time"):
        normalize_forecast(raw, now)

    insufficient = [
        {
            **point,
            "FCST_TIME": (now + timedelta(hours=offset))
            .astimezone(ZoneInfo("Asia/Seoul"))
            .strftime("%Y-%m-%d %H:%M"),
        }
        for offset in range(1, 6)
    ]
    with pytest.raises(SourceDataError, match="fewer than six future official forecast points"):
        normalize_forecast({"FCST_YN": "Y", "FCST_PPLTN": insufficient}, now)


def test_normalize_forecast_rejects_a_missing_or_disabled_official_forecast() -> None:
    # Given: a population-only row without an eligible official forecast flag.
    raw = {"FCST_YN": "N", "FCST_PPLTN": []}

    # When / Then: it fails closed instead of inventing a forecast.
    with pytest.raises(SourceDataError, match="official forecast unavailable"):
        normalize_forecast(raw, FETCHED_AT)
