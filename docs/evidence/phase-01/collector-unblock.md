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
