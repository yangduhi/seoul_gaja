from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Mapping

from collector.domain.models import Catalog, CatalogPlace, SourceDataError


EXPECTED_PLACE_COUNT = 121


def load_catalog(path: Path) -> Catalog:
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(raw, dict):
        raise SourceDataError("catalog must be a JSON object")
    version = _required_string(raw, "catalogVersion", "catalog")
    source = _string_mapping(raw.get("source"), "catalog source")
    places_raw = raw.get("places")
    if not isinstance(places_raw, list):
        raise SourceDataError("catalog places must be an array")
    places = tuple(_parse_place(place) for place in places_raw)
    _validate_places(places)
    return Catalog(version=version, source=source, places=places)


def _parse_place(raw: object) -> CatalogPlace:
    if not isinstance(raw, dict):
        raise SourceDataError("catalog place must be an object")
    return CatalogPlace(
        area_code=_required_string(raw, "areaCode", "catalog place"),
        area_name=_required_string(raw, "areaName", "catalog place"),
        latitude=_coordinate(raw.get("latitude"), "latitude"),
        longitude=_coordinate(raw.get("longitude"), "longitude"),
    )


def _validate_places(places: tuple[CatalogPlace, ...]) -> None:
    if len(places) != EXPECTED_PLACE_COUNT:
        raise SourceDataError("catalog must contain exactly 121 places")
    codes = tuple(place.area_code for place in places)
    names = tuple(place.area_name for place in places)
    if len(set(codes)) != EXPECTED_PLACE_COUNT:
        raise SourceDataError("catalog area codes must be unique")
    if len(set(names)) != EXPECTED_PLACE_COUNT:
        raise SourceDataError("catalog area names must be unique")
    if codes != tuple(sorted(codes)):
        raise SourceDataError("catalog must be sorted by official area code")


def _required_string(raw: Mapping[str, object], field: str, context: str) -> str:
    value = raw.get(field)
    if not isinstance(value, str) or not value:
        raise SourceDataError(f"{context} {field} must be a non-empty string")
    return value


def _string_mapping(raw: object, context: str) -> Mapping[str, str]:
    if not isinstance(raw, dict):
        raise SourceDataError(f"{context} must be an object")
    result: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str) or not value:
            raise SourceDataError(f"{context} must contain non-empty strings")
        result[key] = value
    return result


def _coordinate(value: object, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise SourceDataError(f"catalog {field} must be finite or null")
    return float(value)
