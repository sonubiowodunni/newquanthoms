# ============================================================================
# BANQ-021 -- verify-v1-unified-ad-page.ps1
#
# Thin wrapper around the node checker, following the ecosystem convention of
# verify-v{number}-{feature}.ps1 scripts. Exit code is the checker's exit code,
# so this can gate a build.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/verify-v1-unified-ad-page.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
Set-Location $root

Write-Host 'BANQ-021 unified advertising page -- verification' -ForegroundColor Cyan

node "$scriptDir\verify-unified-ad-page.cjs"
$code = $LASTEXITCODE

if ($code -eq 0) {
  Write-Host ''
  Write-Host 'verify-v1-unified-ad-page: PASS (exit 0)' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host 'verify-v1-unified-ad-page: FAIL (exit ' + $code + ')' -ForegroundColor Red
}

exit $code
