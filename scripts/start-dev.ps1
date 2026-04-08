$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "[ICS-DEV] $Message" -ForegroundColor Cyan
}

Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Write-Step "No .env found. Creating from .env.example"
    Copy-Item -Path ".env.example" -Destination ".env" -Force
}

Write-Step "Starting stack in development mode with frontend hot reload"
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

Write-Step "Running migrations"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend alembic upgrade head

Write-Step "Seeding sample data"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend python seed_data.py

Write-Step "Current service status"
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

Write-Host ""
Write-Host "Dev mode is ready with hot reload" -ForegroundColor Green
Write-Host "Open: http://localhost:8080" -ForegroundColor Green
Write-Host "Any frontend file change will refresh automatically." -ForegroundColor Green
