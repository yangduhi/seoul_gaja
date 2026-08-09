from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from collector.domain.models import CatalogPlace, SourceDataError


SEOUL_OPEN_API_BASE_URL = "http://openapi.seoul.go.kr:8088"
POPULATION_SERVICE_KEY = "SeoulRtd.citydata_ppltn"
SUCCESS_RESULT_CODE = "INFO-000"


@dataclass(frozen=True, slots=True)
class PopulationResponse:
    raw_sha256: str
    raw_size: int
    payload: Mapping[str, object]


def population_url(api_key: str, place: CatalogPlace) -> str:
    return (
        f"{SEOUL_OPEN_API_BASE_URL}/{quote(api_key, safe='')}/json/citydata_ppltn/1/5/"
        f"{quote(place.area_name, safe='')}"
    )


def fetch_population_data(api_key: str, place: CatalogPlace) -> PopulationResponse:
    request = Request(population_url(api_key, place), headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
    except HTTPError as error:
        raise SourceDataError(f"population API HTTP status {error.code}") from error
    except URLError as error:
        raise SourceDataError("population API network request failed") from error
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SourceDataError("population API response was not JSON") from error
    if not isinstance(decoded, dict):
        raise SourceDataError("population API response must be an object")
    result = decoded.get("RESULT")
    if not isinstance(result, dict):
        raise SourceDataError("population API response missing RESULT object")
    if result.get("RESULT.CODE") != SUCCESS_RESULT_CODE:
        raise SourceDataError("population API response reported a non-success result")
    rows = decoded.get(POPULATION_SERVICE_KEY)
    if not isinstance(rows, list) or len(rows) != 1:
        raise SourceDataError("population API response must contain exactly one row")
    payload = rows[0]
    if not isinstance(payload, dict):
        raise SourceDataError("population API response row must be an object")
    if not isinstance(payload.get("FCST_PPLTN"), list):
        raise SourceDataError("population API response missing forecast section")
    return PopulationResponse(raw_sha256=hashlib.sha256(raw).hexdigest(), raw_size=len(raw), payload=payload)
