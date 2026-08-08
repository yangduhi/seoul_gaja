# Phase 01 collector unblock

Status: `LOCAL_IMPLEMENTATION_COMPLETE`; live quota evidence is `NOT_RUN_BLOCKED`.

## Authority and catalog

- Base commit/tree: `3d15b59daffe556b3755712d9cfc9a18dd9d01e9` / `a39fb8d1b9946cf2d641bfb2c5fe9ce4edbc077c`.
- Official catalog page: `https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do`.
- Official public workbook identity: `OA-21285`, `seq=23`, `seqNo=23`, `infSeq=2`.
- Downloaded workbook SHA-256: `60aedf332efef1535623e22c14af2acd6b3ccfa35e60423fbbea8cc8188f1ff7`.
- Parsed result: 121 unique `AREA_CD` / `AREA_NM` identities; first `POI001`, final `POI131`; non-contiguous official codes preserved.

## RED then GREEN

- RED: `python -m pytest collector/tests -q` exited `1` before implementation because `collector.catalog` and `collector.domain` did not exist.
- GREEN: `python -m pytest collector/tests -q` exited `0`; `13 passed in 0.36s`.
- `python -m compileall -q collector` exited `0`.
- `python docs/execution/scripts/validate_authority_lock.py` exited `0`.
- `python docs/execution/scripts/validate_command_map.py docs/execution/contracts/execution-command-map.json` exited `0`; `30 command entries validated`.
- Catalog JSON check exited `0`: 121 rows, 121 unique codes, 121 unique names, and matching catalog/source-registry workbook hashes.
- `git diff --check` exited `0`; changed-path secret-value scan exited `0` with `SECRET_VALUE_SCAN=PASS`.

## Live gate

`SEOUL_OPEN_DATA_KEY` is absent from the local environment. The bounded `quota-probe --sample-size 3` command stopped locally with exit `3` and `SEOUL_OPEN_DATA_KEY is required` before any CITYDATA request. No live quota, latency, or production ingest claim is made.

## Cleanup

Generated `collector/**/__pycache__` directories were removed after verification.

## CITYDATA transport correction

- Protected workflow run `31257100605` failed at `python -m collector.cli collect` with `CITYDATA network request failed` while the required secret was present.
- RED: `python -m pytest collector/tests/test_seoul_api.py -q` exited `1` because the URL builder used `https://openapi.seoul.go.kr:8088` while the official smoke and source documentation use `http://openapi.seoul.go.kr:8088`.
- GREEN: `CITYDATA_BASE_URL`, the source registry, and the focused endpoint expectation now use the official HTTP endpoint. `python -m pytest collector/tests -q` exited `0`; `13 passed in 0.37s`. `python -m compileall -q collector` exited `0`.
- `npm run build` was attempted and exited `1` before the application build because `cross-env` is unavailable in this worktree. No dependency installation was attempted. This is `NOT_RUN_BLOCKED` for the unrelated frontend build environment, not a collector test failure.
