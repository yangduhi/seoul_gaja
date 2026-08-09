from __future__ import annotations

import json
from io import BytesIO

import pytest

from collector.domain.models import CatalogPlace, SourceDataError
from collector.source import seoul_api


PLACE = CatalogPlace(area_code="POI009", area_name="광화문·덕수궁")


OFFICIAL_POPULATION_ENVELOPE = {
    "SeoulRtd.citydata_ppltn": [
        {
            "AREA_NM": "광화문·덕수궁",
            "AREA_CD": "POI009",
            "AREA_CONGEST_LVL": "여유",
            "AREA_CONGEST_MSG": "원활",
            "AREA_PPLTN_MIN": "1000",
            "AREA_PPLTN_MAX": "1200",
            "MALE_PPLTN_RATE": "50.0",
            "FEMALE_PPLTN_RATE": "50.0",
            "PPLTN_RATE_0": "1.0",
            "PPLTN_RATE_10": "2.0",
            "PPLTN_RATE_20": "3.0",
            "PPLTN_RATE_30": "4.0",
            "PPLTN_RATE_40": "5.0",
            "PPLTN_RATE_50": "6.0",
            "PPLTN_RATE_60": "7.0",
            "PPLTN_RATE_70": "8.0",
            "RESNT_PPLTN_RATE": "9.0",
            "NON_RESNT_PPLTN_RATE": "91.0",
            "REPLACE_YN": "N",
            "PPLTN_TIME": "2026-08-10 04:15",
            "FCST_YN": "Y",
            "FCST_PPLTN": [
                {
                    "FCST_TIME": forecast_time,
                    "FCST_CONGEST_LVL": "여유",
                    "FCST_PPLTN_MIN": "1000",
                    "FCST_PPLTN_MAX": "1200",
                }
                for forecast_time in (
                    "2026-08-10 05:00",
                    "2026-08-10 06:00",
                    "2026-08-10 07:00",
                    "2026-08-10 08:00",
                    "2026-08-10 09:00",
                    "2026-08-10 10:00",
                )
            ],
        }
    ],
    "RESULT": {
        "RESULT.CODE": "INFO-000",
        "RESULT.MESSAGE": "정상 처리되었습니다.",
    },
}


def test_population_url_uses_the_official_location_name_path_parameter() -> None:
    # Given: an official catalog identity containing spaces and Korean text.
    place = CatalogPlace(area_code="POI001", area_name="강남 MICE 관광특구")

    # When: the collector builds a population-only city-data URL.
    url = seoul_api.population_url("redacted", place)

    # Then: it uses the official endpoint and URL-encoded AREA_NM, never a row number.
    assert url.startswith("http://openapi.seoul.go.kr:8088/redacted/json/citydata_ppltn/1/5/")
    assert url.endswith("%EA%B0%95%EB%82%A8%20MICE%20%EA%B4%80%EA%B4%91%ED%8A%B9%EA%B5%AC")


def test_fetch_population_data_decodes_the_official_population_only_envelope(monkeypatch) -> None:
    # Given: the public population-only service envelope with one official row and its forecast.
    encoded = json.dumps(OFFICIAL_POPULATION_ENVELOPE, ensure_ascii=False).encode("utf-8")
    monkeypatch.setattr(seoul_api, "urlopen", lambda *_args, **_kwargs: BytesIO(encoded))

    # When: the collector decodes the official response at the HTTP boundary.
    response = seoul_api.fetch_population_data("redacted", PLACE)

    # Then: it returns the one authoritative row without looking for the integrated CITYDATA shape.
    assert response.payload == OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0]


def test_fetch_population_data_uses_a_bounded_http_timeout(monkeypatch) -> None:
    encoded = json.dumps(OFFICIAL_POPULATION_ENVELOPE, ensure_ascii=False).encode("utf-8")
    observed: dict[str, object] = {}

    def bounded_urlopen(_request, *, timeout: object) -> BytesIO:
        observed["timeout"] = timeout
        return BytesIO(encoded)

    monkeypatch.setattr(seoul_api, "urlopen", bounded_urlopen)

    seoul_api.fetch_population_data("redacted", PLACE)

    assert observed["timeout"] == 30


@pytest.mark.parametrize(
    ("envelope", "reason"),
    [
        ([], "population API response must be an object"),
        ({"SeoulRtd.citydata_ppltn": [OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0]]}, "population API response missing RESULT object"),
        ({"RESULT": {"RESULT.CODE": "ERROR-300"}, "SeoulRtd.citydata_ppltn": [OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0]]}, "population API response reported a non-success result"),
        ({"RESULT": {"RESULT.CODE": "INFO-000"}, "SeoulRtd.citydata_ppltn": []}, "population API response must contain exactly one row"),
        ({"RESULT": {"RESULT.CODE": "INFO-000"}, "SeoulRtd.citydata_ppltn": [OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0], OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0]]}, "population API response must contain exactly one row"),
        ({"RESULT": {"RESULT.CODE": "INFO-000"}, "CITYDATA": OFFICIAL_POPULATION_ENVELOPE["SeoulRtd.citydata_ppltn"][0]}, "population API response must contain exactly one row"),
        ({"RESULT": {"RESULT.CODE": "INFO-000"}, "SeoulRtd.citydata_ppltn": [{"AREA_NM": "광화문·덕수궁", "AREA_CD": "POI009"}]}, "population API response missing forecast section"),
    ],
)
def test_fetch_population_data_rejects_invalid_population_envelopes(monkeypatch, envelope, reason: str) -> None:
    # Given: an invalid population-only envelope, including the retired integrated shape.
    encoded = json.dumps(envelope, ensure_ascii=False).encode("utf-8")
    monkeypatch.setattr(seoul_api, "urlopen", lambda *_args, **_kwargs: BytesIO(encoded))

    # When / Then: it fails closed before a row reaches the collector.
    with pytest.raises(SourceDataError, match=reason):
        seoul_api.fetch_population_data("redacted", PLACE)
