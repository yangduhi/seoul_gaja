from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import TypeAlias
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from collector.catalog import load_catalog
from collector.domain.models import CurrentObservation, ForecastPoint, SourceDataError
from collector.source.normalize import normalize_current, normalize_forecast
from collector.source.seoul_api import fetch_citydata


BLOCKED_EXIT = 3
PARSER_VERSION = "1.0.0"
JsonPrimitive: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m collector.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)
    collect = subparsers.add_parser("collect")
    collect.add_argument("--catalog", required=True, type=Path)
    collect.add_argument("--output", required=True, type=Path)
    collect.add_argument("--receipt", required=True, type=Path)
    push = subparsers.add_parser("push")
    push.add_argument("--input", required=True, type=Path)
    push.add_argument("--url", required=True)
    push.add_argument("--path", required=True)
    push.add_argument("--token-env", required=True)
    push.add_argument("--machine-header-env")
    probe = subparsers.add_parser("quota-probe")
    probe.add_argument("--sample-size", required=True, type=int)
    arguments = parser.parse_args()
    if arguments.command == "collect":
        return _collect(arguments.catalog, arguments.output, arguments.receipt)
    if arguments.command == "push":
        return _push(arguments.input, arguments.url, arguments.path, arguments.token_env, arguments.machine_header_env)
    return _quota_probe(arguments.sample_size)


def _collect(catalog_path: Path, output: Path, receipt: Path) -> int:
    api_key = _api_key_or_block()
    if api_key is None:
        return BLOCKED_EXIT
    workflow_run_id = os.environ.get("GITHUB_RUN_ID")
    workflow_run_attempt = os.environ.get("GITHUB_RUN_ATTEMPT")
    collector_version = os.environ.get("GITHUB_SHA")
    if not workflow_run_id or not workflow_run_attempt or not collector_version:
        print("GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, and GITHUB_SHA are required", file=sys.stderr)
        return BLOCKED_EXIT
    try:
        receipt_version = int(workflow_run_attempt)
    except ValueError:
        print("GITHUB_RUN_ATTEMPT must be a positive integer", file=sys.stderr)
        return BLOCKED_EXIT
    if receipt_version < 1:
        print("GITHUB_RUN_ATTEMPT must be a positive integer", file=sys.stderr)
        return BLOCKED_EXIT
    try:
        catalog = load_catalog(catalog_path)
        rows: list[dict[str, JsonValue]] = []
        raw_hashes: list[str] = []
        for place in catalog.places:
            fetched_at = datetime.now(UTC)
            response = fetch_citydata(api_key, place)
            observation = normalize_current(response.payload, place, fetched_at)
            forecast = normalize_forecast(response.payload, fetched_at)
            rows.append(_snapshot_row(observation, forecast, response.raw_sha256))
            raw_hashes.append(response.raw_sha256)
    except SourceDataError as error:
        print(f"collection failed: {error}", file=sys.stderr)
        return 1
    payload = {
        "contractVersion": "1.0.0",
        "snapshotId": _snapshot_id(catalog.version, rows),
        "catalogVersion": catalog.version,
        "rows": rows,
        "meta": {"attempted": len(rows), "refreshed": len(rows), "carriedForward": 0, "unavailable": 0},
    }
    payload["payloadSha256"] = _canonical_sha256(payload)
    source_times = [row["sourceUpdatedAt"] for row in rows if row["sourceUpdatedAt"] is not None]
    fetch_times = [row["fetchedAt"] for row in rows]
    provenance_receipt = {
        "receipt_id": f"github:{workflow_run_id}:{receipt_version}:{payload['snapshotId']}",
        "receipt_version": receipt_version,
        "workflow_run_id": workflow_run_id,
        "collector_version": collector_version,
        "parser_version": PARSER_VERSION,
        "catalog_version": catalog.version,
        "raw_response_sha256": _canonical_sha256(raw_hashes),
        "per_place_outcome_counts": {"refreshed": len(rows), "carried_forward": 0, "unavailable": 0},
        "source_times": source_times,
        "fetch_times": fetch_times,
        "accepted_at": max(fetch_times),
    }
    payload["provenanceReceipt"] = provenance_receipt
    _write_json(output, payload)
    _write_json(
        receipt,
        {
            "catalogVersion": catalog.version,
            "catalogSourceRawSha256": catalog.source["rawSha256"],
            "rawResponseSha256": raw_hashes,
            "payloadSha256": payload["payloadSha256"],
            "placeCount": len(rows),
            "provenanceReceipt": provenance_receipt,
        },
    )
    return 0


def _push(input_path: Path, base_url: str, path: str, token_env: str, machine_header_env: str | None = None) -> int:
    token = os.environ.get(token_env)
    if not token:
        print(f"{token_env} is required", file=sys.stderr)
        return BLOCKED_EXIT
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if machine_header_env is not None:
        machine_authorization = os.environ.get(machine_header_env)
        if not machine_authorization or not machine_authorization.strip():
            print(f"{machine_header_env} is required", file=sys.stderr)
            return BLOCKED_EXIT
        if "\r" in machine_authorization or "\n" in machine_authorization:
            print(f"{machine_header_env} is invalid", file=sys.stderr)
            return BLOCKED_EXIT
        headers["OAI-Sites-Authorization"] = machine_authorization
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc or not path.startswith("/"):
        print("push target must be an HTTPS base URL and absolute path", file=sys.stderr)
        return 1
    body = input_path.read_bytes()
    request = Request(
        urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            response.read()
    except HTTPError as error:
        print(f"push failed with HTTP status {error.code}", file=sys.stderr)
        return 1
    except URLError:
        print("push network request failed", file=sys.stderr)
        return 1
    return 0


def _quota_probe(sample_size: int) -> int:
    if sample_size < 1 or sample_size > 3:
        print("sample-size must be between 1 and 3", file=sys.stderr)
        return 1
    api_key = _api_key_or_block()
    if api_key is None:
        return BLOCKED_EXIT
    try:
        catalog = load_catalog(Path("data/seoul-places.json"))
        durations: list[float] = []
        sizes: list[int] = []
        for place in catalog.places[:sample_size]:
            started_at = time.perf_counter()
            response = fetch_citydata(api_key, place)
            durations.append(time.perf_counter() - started_at)
            sizes.append(response.raw_size)
    except SourceDataError as error:
        print(f"quota probe failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"sampleSize": sample_size, "p50Seconds": _percentile(durations, 0.5), "p95Seconds": _percentile(durations, 0.95), "responseBytes": sizes}))
    return 0


def _api_key_or_block() -> str | None:
    api_key = os.environ.get("SEOUL_OPEN_DATA_KEY")
    if not api_key:
        print("SEOUL_OPEN_DATA_KEY is required", file=sys.stderr)
        return None
    return api_key


def _snapshot_row(
    observation: CurrentObservation, forecast: list[ForecastPoint], raw_hash: str
) -> dict[str, JsonValue]:
    source_updated_at = observation.source_updated_at
    if source_updated_at is None:
        raise SourceDataError("missing current source timestamp")
    source_timestamp = source_updated_at.isoformat()
    fetched_timestamp = observation.fetched_at.isoformat()
    return {
        "areaCode": observation.area_code,
        "areaName": observation.area_name,
        "availability": "available",
        "provenance": "refreshed",
        "crowdLevel": observation.crowd_level,
        "populationMin": observation.population_min,
        "populationMax": observation.population_max,
        "sourceUpdatedAt": source_timestamp,
        "fetchedAt": fetched_timestamp,
        "rawHash": raw_hash,
        "officialForecast": {
            "authority": "official",
            "sourceUpdatedAt": source_timestamp,
            "fetchedAt": fetched_timestamp,
            "rawHash": raw_hash,
            "points": [
                {
                    "timestamp": point.time.isoformat(),
                    "crowdLevel": point.crowd_level,
                    "populationMin": point.population_min,
                    "populationMax": point.population_max,
                    "sourceUpdatedAt": source_timestamp,
                }
                for point in forecast
            ],
        },
    }


def _snapshot_id(catalog_version: str, rows: list[dict[str, JsonValue]]) -> str:
    return f"{catalog_version}-{_canonical_sha256(rows)[:16]}"


def _canonical_sha256(value: JsonValue) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _write_json(path: Path, value: JsonValue) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    index = round((len(ordered) - 1) * percentile)
    return ordered[index]


if __name__ == "__main__":
    raise SystemExit(main())
