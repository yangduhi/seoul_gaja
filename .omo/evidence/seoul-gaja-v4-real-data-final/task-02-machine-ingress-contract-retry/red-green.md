# RED to GREEN record

## Baseline capture

Command:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
Remove-Item Env:PYTHONPYCACHEPREFIX -ErrorAction SilentlyContinue
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py::test_push_keeps_canonical_path_and_bearer_without_machine_header -q
```

Result: `1 passed in 1.49s`.

The task-owned loopback capture observed the canonical path and existing
application authorization scheme, with zero `OAI-Sites-Authorization` fields.

## RED

New behavior commands:

```powershell
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py::test_push_sends_machine_header_from_declared_environment -q
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py::test_push_blocks_before_http_when_declared_machine_header_is_blank -q
```

Both tests failed before implementation because `collector.cli push` rejected
`--machine-header-env OAI_SITES_AUTHORIZATION` as an unrecognized argument.
The CLI returned argparse exit `2`; the pytest test processes each returned
failure exit `1`. This isolates the missing machine-ingress capability rather
than a TLS, path, or test-fixture error.

## GREEN

After the minimal CLI and workflow change:

```powershell
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py -q
python -m pytest -p no:cacheprovider collector/tests -q
ruff check --no-cache collector/cli.py collector/tests/test_machine_ingress.py
```

Results:

- machine-ingress tests: `3 passed in 2.21s`;
- focused collector suite: `16 passed in 4.00s`;
- ruff: `All checks passed!`.

The blank-value test proves deterministic `BLOCKED_EXIT` before the local
listener observes HTTP. The configured-header test proves one machine header,
canonical path, preserved application authorization, and empty CLI stdout and
stderr.
