# Population endpoint RED to GREEN

## Binding

| Field | Value |
| --- | --- |
| Worktree | `D:\vscode\seoul_gaja-worktrees\realdata-population-endpoint-fix` |
| Branch | `codex/realdata-population-endpoint-fix` |
| Base commit | `d6bc9fdace41ed2d2bb7d67769681f22ef050699` |
| Base tree | `70cfcf4186ff96109c25ab73d3a3e6c1a26101f0` |

The source, tests, registry, and this evidence are committed atomically. The
resulting commit and tree are supplied in the member terminal receipt rather
than embedded recursively in a committed evidence file.

## RED

Against a faithful `SeoulRtd.citydata_ppltn` one-row envelope with
`RESULT.RESULT.CODE=INFO-000` and six `FCST_PPLTN` rows, the pre-change code
was run with:

```powershell
python -m pytest collector/tests/test_seoul_api.py -q
```

It failed twice: the URL asserted `/json/citydata_ppltn/1/5/` while the old
source built `/json/citydata/1/5/`, and decoding raised
`SourceDataError: CITYDATA response missing CITYDATA object`.

The pre-change normalizer was also run against the population-only flat row:

```powershell
python -m pytest collector/tests/test_normalize.py -q
```

It reported `8 failed, 2 passed` because it required the retired nested
`LIVE_PPLTN_STTS` shape and forecast-row `FCST_YN` flag.

After changing the receipt test first, the registry RED was:

```powershell
node --test tests/gates/collector-provenance-receipt.test.mjs
```

It reported `4 pass, 1 fail`: `sourceRegistry.citydata_ppltn` was undefined.

## GREEN

The collector now requests only:

```text
http://openapi.seoul.go.kr:8088/{SEOUL_OPEN_DATA_KEY}/json/citydata_ppltn/1/5/{AREA_NM}
```

It accepts only the one-row `SeoulRtd.citydata_ppltn` envelope with
`RESULT.RESULT.CODE=INFO-000`. The normalizer reads flat current fields,
requires top-level `FCST_YN=Y`, and rejects absent, malformed, insufficient,
duplicate, nonfuture, or unexpected-identity data before snapshot output.
There is no `citydata` endpoint, `CITYDATA`, or fallback compatibility path in
the production source or registry.

Observed GREEN commands:

```powershell
python -m pytest collector/tests -q
python -m pytest collector/tests -q
python -m ruff check collector/cli.py collector/source collector/tests/test_seoul_api.py collector/tests/test_normalize.py collector/tests/test_cli_collection.py collector/tests/fixture_snapshot.py
python -m compileall -q collector
node --test tests/gates/collector-provenance-receipt.test.mjs tests/gates/realdata-d1-materialization.test.mjs
node tests/gates/collector-provenance-manual.mjs
python docs/execution/scripts/validate_authority_lock.py
git diff --check
```

Results before the atomic commit: collector suite passed twice (final count
recorded in `verification.md`); ruff and compileall passed; Node gates passed
11/11; manual materialization accepted 121 rows; authority lock passed at the
approved base; and `git diff --check` passed. No owner key was read or emitted.
