from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Mapping


CrowdLevel = Literal["RELAXED", "NORMAL", "BUSY", "CROWDED", "UNKNOWN"]


class SourceDataError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)

    def __str__(self) -> str:
        return self.reason


@dataclass(frozen=True, slots=True)
class CatalogPlace:
    area_code: str
    area_name: str
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True, slots=True)
class Catalog:
    version: str
    source: Mapping[str, str]
    places: tuple[CatalogPlace, ...]


@dataclass(frozen=True, slots=True)
class CurrentObservation:
    area_code: str
    area_name: str
    crowd_level: CrowdLevel
    population_min: int | None
    population_max: int | None
    source_updated_at: datetime | None
    fetched_at: datetime


@dataclass(frozen=True, slots=True)
class ForecastPoint:
    time: datetime
    crowd_level: CrowdLevel
    population_min: int | None
    population_max: int | None
