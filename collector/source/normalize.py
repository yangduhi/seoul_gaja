from __future__ import annotations

from datetime import UTC, datetime
from typing import Mapping
from zoneinfo import ZoneInfo

from collector.domain.models import CatalogPlace, CrowdLevel, CurrentObservation, ForecastPoint, SourceDataError


SEOUL_TIMEZONE = ZoneInfo("Asia/Seoul")
CROWD_LEVELS: Mapping[str, CrowdLevel] = {
    "여유": "RELAXED",
    "보통": "NORMAL",
    "약간 붐빔": "BUSY",
    "붐빔": "CROWDED",
}


def normalize_current(
    raw: Mapping[str, object], place: CatalogPlace, fetched_at: datetime
) -> CurrentObservation:
    _validate_identity(raw, place)
    section = _single_mapping(raw.get("LIVE_PPLTN_STTS"), "missing current section")
    population_min, population_max = _population_range(section, "AREA_PPLTN_MIN", "AREA_PPLTN_MAX")
    return CurrentObservation(
        area_code=place.area_code,
        area_name=place.area_name,
        crowd_level=_crowd_level(section.get("AREA_CONGEST_LVL")),
        population_min=population_min,
        population_max=population_max,
        source_updated_at=_parse_time(section.get("PPLTN_TIME"), "current observation time"),
        fetched_at=fetched_at,
    )


def normalize_forecast(raw: Mapping[str, object], now: datetime) -> list[ForecastPoint]:
    rows = raw.get("FCST_PPLTN")
    if not isinstance(rows, list):
        raise SourceDataError("missing forecast section")
    points: list[ForecastPoint] = []
    for row in rows:
        if not isinstance(row, dict):
            raise SourceDataError("forecast row must be an object")
        if row.get("FCST_YN") != "Y":
            continue
        time = _parse_time(row.get("FCST_TIME"), "forecast time")
        if time <= now:
            continue
        population_min, population_max = _population_range(row, "FCST_PPLTN_MIN", "FCST_PPLTN_MAX")
        points.append(
            ForecastPoint(
                time=time,
                crowd_level=_crowd_level(row.get("FCST_CONGEST_LVL")),
                population_min=population_min,
                population_max=population_max,
            )
        )
    if len(points) < 6:
        raise SourceDataError("fewer than six future official forecast points")
    points.sort(key=lambda point: point.time)
    if len({point.time for point in points}) != len(points):
        raise SourceDataError("duplicate forecast time")
    return points


def _validate_identity(raw: Mapping[str, object], place: CatalogPlace) -> None:
    area_code = raw.get("AREA_CD")
    area_name = raw.get("AREA_NM")
    if not isinstance(area_code, str) or not isinstance(area_name, str):
        raise SourceDataError("missing area identity")
    if area_code != place.area_code:
        raise SourceDataError("area code mismatch")
    if area_name != place.area_name:
        raise SourceDataError("area name mismatch")


def _single_mapping(value: object, missing_reason: str) -> Mapping[str, object]:
    if not isinstance(value, list) or len(value) != 1 or not isinstance(value[0], dict):
        raise SourceDataError(missing_reason)
    return value[0]


def _crowd_level(value: object) -> CrowdLevel:
    if not isinstance(value, str):
        raise SourceDataError("unknown crowd level")
    level = CROWD_LEVELS.get(value)
    if level is None:
        raise SourceDataError("unknown crowd level")
    return level


def _population_range(raw: Mapping[str, object], minimum_key: str, maximum_key: str) -> tuple[int, int]:
    minimum = _non_negative_integer(raw.get(minimum_key), "population")
    maximum = _non_negative_integer(raw.get(maximum_key), "population")
    if minimum > maximum:
        raise SourceDataError("reversed population")
    return minimum, maximum


def _non_negative_integer(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, str | int):
        raise SourceDataError(f"invalid {field}")
    try:
        result = int(value)
    except ValueError as error:
        raise SourceDataError(f"invalid {field}") from error
    if result < 0:
        raise SourceDataError(f"negative {field}")
    return result


def _parse_time(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise SourceDataError(f"invalid {field}")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M")
    except ValueError as error:
        raise SourceDataError(f"invalid {field}") from error
    return parsed.replace(tzinfo=SEOUL_TIMEZONE).astimezone(UTC)
