# ============================================================================
# BANQ -- verify-all.ps1
#
# One command that runs every BANQ verifier and reports one honest total.
#
# WHY THIS EXISTS: three verifiers existed and nothing ran them together, so
# "is the project green?" was answered by remembering which script to run. A
# project with more than one verifier and no aggregate is a project where the
# second verifier stops being run.
#
# Exit code is 0 only if EVERY verifier passed -- a partial pass must not look
# like a pass.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/verify-all.ps1
# ============================================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
Set-Location $root

# Ordered cheapest-first: smoke needs nothing, the others need seeded data.
$suites = @(
  @{ name = 'smoke (site + API shape)'; file = 'verify-v1-smoke.cjs' },
  @{ name = 'unified ad page (BANQ-021)'; file = 'verify-unified-ad-page.cjs' },
  @{ name = 'identity bridge (BANQ-024)'; file = 'verify-banq-identity-bridge.cjs' },
  @{ name = 'partner reward door (F3)'; file = 'verify-banq-partner-reward.cjs' },
  @{ name = 'intelligence system (E0-E4)'; file = 'verify-banq-intelligence.cjs' }
)

$results = @()
foreach ($s in $suites) {
  $path = Join-Path $scriptDir $s.file
  Write-Host ''
  Write-Host ('=' * 66) -ForegroundColor DarkGray
  Write-Host ('RUNNING: ' + $s.name) -ForegroundColor Cyan
  Write-Host ('=' * 66) -ForegroundColor DarkGray

  if (-not (Test-Path $path)) {
    Write-Host ('MISSING: ' + $s.file) -ForegroundColor Yellow
    $results += [pscustomobject]@{ Suite = $s.name; Result = 'MISSING'; Exit = 1 }
    continue
  }

  node $path
  $code = $LASTEXITCODE
  $label = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
  $colour = if ($code -eq 0) { 'Green' } else { 'Red' }
  Write-Host ('' + $s.name + ': ' + $label + ' (exit ' + $code + ')') -ForegroundColor $colour
  $results += [pscustomobject]@{ Suite = $s.name; Result = $label; Exit = $code }
}

Write-Host ''
Write-Host ('=' * 66) -ForegroundColor DarkGray
Write-Host 'BANQ -- ALL VERIFIERS' -ForegroundColor Cyan
Write-Host ('=' * 66) -ForegroundColor DarkGray
$results | Format-Table -AutoSize | Out-String | Write-Host

$failed = @($results | Where-Object { $_.Exit -ne 0 })
if ($failed.Count -eq 0) {
  Write-Host ('verify-all: PASS -- ' + $results.Count + '/' + $results.Count + ' suites green') -ForegroundColor Green
  exit 0
}

Write-Host ('verify-all: FAIL -- ' + $failed.Count + ' of ' + $results.Count + ' suites failed') -ForegroundColor Red
exit 1
