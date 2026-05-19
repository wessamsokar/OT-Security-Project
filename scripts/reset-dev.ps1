$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[ICS-RESET] Stopping and removing dev containers, volumes, and local build outputs." -ForegroundColor Yellow
docker compose -f docker-compose.yml -f docker-compose.dev.yml down --volumes --remove-orphans

if (Test-Path "frontend/dist") {
    Remove-Item -Recurse -Force "frontend/dist"
}
if (Test-Path "frontend/tsconfig.app.tsbuildinfo") {
    Remove-Item -Force "frontend/tsconfig.app.tsbuildinfo"
}
Get-ChildItem -Path . -Directory -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Directory -Recurse -Filter ".pytest_cache" | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Directory -Filter "pytest-cache-files-*" | Remove-Item -Recurse -Force

Write-Host "[ICS-RESET] Done. Run ./ICS.bat or ./scripts/start-dev.ps1 to rebuild." -ForegroundColor Green
