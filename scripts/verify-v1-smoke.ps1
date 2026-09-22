# ============================================================================
# BANQ -- verify-v1-smoke.ps1
#
# Thin wrapper around scripts/verify-v1-smoke.cjs, following the ecosystem
# convention of verify-v{number}-{feature}.ps1 scripts. The exit code is the
# checker's exit code, so this can gate a build.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/verify-v1-smoke.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
Set-Location $root

Write-Host 'BANQ smoke test -- is the running site actually serving an API?' -ForegroundColor Cyan

node "$scriptDir\verify-v1-smoke.cjs"
$code = $LASTEXITCODE

if ($code -eq 0) {
  Write-Host ''
  Write-Host 'verify-v1-smoke: PASS (exit 0)' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host 'verify-v1-smoke: FAIL (exit ' + $code + ')' -ForegroundColor Red
}

exit $code
