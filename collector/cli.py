from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from collector.catalog import load_catalog
from collector.domain.models import CurrentObservation, SourceDataError
from collector.source.normalize import normalize_current
from collector.source.seoul_api import fetch_citydata


BLOCKED_EXIT = 3


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
    probe = subparsers.add_parser("quota-probe")
    probe.add_argument("--sample-size", required=True, type=int)
    arguments = parser.parse_args()
    if arguments.command == "collect":
        return _collect(arguments.catalog, arguments.output, arguments.receipt)
    if arguments.command == "push":
        return _push(arguments.input, arguments.url, arguments.path, arguments.token_env)
    return _quota_probe(arguments.sample_size)


def _collect(catalog_path: Path, output: Path, receipt: Path) -> int:
    api_key = _api_key_or_block()
    if api_key is None:
        return BLOCKED_EXIT
    try:
        catalog = load_catalog(catalog_path)
        rows: list[dict[str, object]] = []
        raw_hashes: list[str] = []
        for place in catalog.places:
            fetched_at = datetime.now(UTC)
            response = fetch_citydata(api_key, place)
            observation = normalize_current(response.payload, place, fetched_at)
            rows.append(_snapshot_row(observation))
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
    _write_json(output, payload)
    _write_json(
        receipt,
        {
            "catalogVersion": catalog.version,
            "catalogSourceRawSha256": catalog.source["rawSha256"],
            "rawResponseSha256": raw_hashes,
            "payloadSha256": payload["payloadSha256"],
            "placeCount": len(rows),
        },
    )
    return 0


def _push(input_path: Path, base_url: str, path: str, token_env: str) -> int:
    token = os.environ.get(token_env)
    if not token:
        print(f"{token_env} is required", file=sys.stderr)
        return BLOCKED_EXIT
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc or not path.startswith("/"):
        print("push target must be an HTTPS base URL and absolute path", file=sys.stderr)
        return 1
    body = input_path.read_bytes()
    request = Request(
        urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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


def _snapshot_row(observation: CurrentObservation) -> dict[str, object]:
    return {
        "areaCode": observation.area_code,
        "areaName": observation.area_name,
        "availability": "available",
        "provenance": "refreshed",
        "crowdLevel": observation.crowd_level,
        "populationMin": observation.population_min,
        "populationMax": observation.population_max,
        "sourceUpdatedAt": observation.source_updated_at.isoformat() if observation.source_updated_at else None,
        "fetchedAt": observation.fetched_at.isoformat(),
    }


def _snapshot_id(catalog_version: str, rows: list[dict[str, object]]) -> str:
    return f"{catalog_version}-{_canonical_sha256(rows)[:16]}"


def _canonical_sha256(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    index = round((len(ordered) - 1) * percentile)
    return ordered[index]


if __name__ == "__main__":
    raise SystemExit(main())
