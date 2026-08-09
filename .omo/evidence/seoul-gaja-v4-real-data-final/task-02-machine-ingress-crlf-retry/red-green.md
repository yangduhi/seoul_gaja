# RED to GREEN record

## RED

The narrow CR/LF behavior test was added before production code changed and
run with cache creation disabled:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
Remove-Item Env:PYTHONPYCACHEPREFIX -ErrorAction SilentlyContinue
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py::test_push_blocks_before_http_when_machine_header_contains_crlf -q
```

It failed against `1b22ea0…`. A controlled local red probe recorded only
redacted observables: return code `1`, zero HTTP requests, no stdout marker,
and `marker_in_stderr=true`. No raw test marker or header value was emitted.

## GREEN

The request boundary now rejects CR and LF before it constructs the request.
The same focused test passed in `0.62s`, followed by:

```powershell
python -m pytest -p no:cacheprovider collector/tests/test_machine_ingress.py -q
python -m pytest -p no:cacheprovider collector/tests -q
ruff check --no-cache collector/cli.py collector/tests/test_machine_ingress.py
node --test tests/gates/task-06-happy.test.mjs tests/gates/task-06-failure.test.mjs
python docs/execution/scripts/validate_authority_lock.py
python docs/execution/scripts/validate_command_map.py docs/execution/contracts/execution-command-map.json
git diff --check
```

Results: machine-ingress `4 passed`; repeated three times without failure;
collector `17 passed`; ruff passed; workflow policy `19 passed`; authority and
command-map validators passed; diff check passed.

The local capture additionally repeated normal, blank, missing, and CR/LF
cases with return codes, request counts, and redaction booleans only.
