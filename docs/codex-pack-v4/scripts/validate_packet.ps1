param(
    [string]$Root = "."
)
$ErrorActionPreference = "Stop"
python "$PSScriptRoot/validate_packet.py" $Root
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
