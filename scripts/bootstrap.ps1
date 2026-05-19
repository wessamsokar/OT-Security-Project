$ErrorActionPreference = "Stop"

Write-Host "[ICS] bootstrap.ps1 is kept as a compatibility wrapper. Use start-dev.ps1 for local development." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "start-dev.ps1")
