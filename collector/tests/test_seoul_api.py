from __future__ import annotations

from collector.domain.models import CatalogPlace
from collector.source.seoul_api import citydata_url


def test_citydata_url_uses_the_official_location_name_path_parameter() -> None:
    # Given: an official catalog identity containing spaces and Korean text.
    place = CatalogPlace(area_code="POI001", area_name="강남 MICE 관광특구")

    # When: the collector builds a CITYDATA URL.
    url = citydata_url("redacted", place)

    # Then: it uses the official endpoint and URL-encoded AREA_NM, never a row number.
    assert url.startswith("https://openapi.seoul.go.kr:8088/redacted/json/citydata/1/5/")
    assert url.endswith("%EA%B0%95%EB%82%A8%20MICE%20%EA%B4%80%EA%B4%91%ED%8A%B9%EA%B5%AC")
