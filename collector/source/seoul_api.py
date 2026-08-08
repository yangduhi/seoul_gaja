from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from collector.domain.models import CatalogPlace, SourceDataError


CITYDATA_BASE_URL = "https://openapi.seoul.go.kr:8088"


@dataclass(frozen=True, slots=True)
class CityDataResponse:
    raw_sha256: str
    raw_size: int
    payload: Mapping[str, object]


def citydata_url(api_key: str, place: CatalogPlace) -> str:
    return (
        f"{CITYDATA_BASE_URL}/{quote(api_key, safe='')}/json/citydata/1/5/"
        f"{quote(place.area_name, safe='')}"
    )


def fetch_citydata(api_key: str, place: CatalogPlace) -> CityDataResponse:
    request = Request(citydata_url(api_key, place), headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
    except HTTPError as error:
        raise SourceDataError(f"CITYDATA HTTP status {error.code}") from error
    except URLError as error:
        raise SourceDataError("CITYDATA network request failed") from error
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SourceDataError("CITYDATA response was not JSON") from error
    if not isinstance(decoded, dict):
        raise SourceDataError("CITYDATA response must be an object")
    payload = decoded.get("CITYDATA")
    if not isinstance(payload, dict):
        raise SourceDataError("CITYDATA response missing CITYDATA object")
    return CityDataResponse(raw_sha256=hashlib.sha256(raw).hexdigest(), raw_size=len(raw), payload=payload)
