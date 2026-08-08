from __future__ import annotations

from pathlib import Path

from collector.catalog import load_catalog


ROOT = Path(__file__).parents[2]


def test_catalog_preserves_the_authoritative_121_official_identities() -> None:
    # Given: the checked-in OA-21285 catalog and its source registry.
    catalog = load_catalog(ROOT / "data" / "seoul-places.json")

    # When: the catalog is loaded for a collection run.
    places = catalog.places

    # Then: every official identity is present once and preserves AREA_CD ordering.
    assert len(places) == 121
    assert len({place.area_code for place in places}) == 121
    assert len({place.area_name for place in places}) == 121
    assert [place.area_code for place in places] == sorted(place.area_code for place in places)
    assert places[0].area_code == "POI001"
    assert places[-1].area_code == "POI131"


def test_catalog_binds_to_the_downloaded_official_workbook_hash() -> None:
    # Given: the authoritative catalog and its checked-in source registry.
    catalog = load_catalog(ROOT / "data" / "seoul-places.json")

    # When: a collector resolves its source metadata.
    source = catalog.source

    # Then: the public OA-21285 workbook identity is retained without a key.
    assert source["infId"] == "OA-21285"
    assert source["seq"] == "23"
    assert source["rawSha256"] == "60aedf332efef1535623e22c14af2acd6b3ccfa35e60423fbbea8cc8188f1ff7"
