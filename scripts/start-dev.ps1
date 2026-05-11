$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "[ICS-DEV] $Message" -ForegroundColor Cyan
}

function Wait-ForDocker([int]$MaxSeconds = 240) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $MaxSeconds) {
        try {
            docker info *>$null
            Write-Step "Docker engine is ready"
            return
        }
        catch {
            Start-Sleep -Seconds 3
        }
    }
    throw "Docker engine did not become ready in time."
}

function Ensure-DockerDesktopRunning {
    try {
        docker info *>$null
        Write-Step "Docker Desktop is already running"
        return
    }
    catch {
        Write-Step "Docker Desktop is not running. Starting it now..."
    }

    $candidates = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LocalAppData\Docker\Docker Desktop.exe"
    )
    $dockerDesktopExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerDesktopExe) {
        throw "Docker Desktop executable not found. Please open Docker Desktop manually."
    }

    Start-Process -FilePath $dockerDesktopExe | Out-Null
    Wait-ForDocker -MaxSeconds 240
}

function Wait-HttpOk([string]$Url, [int]$MaxAttempts = 40, [int]$DelaySeconds = 3) {
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 8 -UseBasicParsing
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-Step "Health check passed: $Url"
                return
            }
        }
        catch { }
        Write-Host "  Waiting... ($i/$MaxAttempts)" -ForegroundColor DarkGray
        Start-Sleep -Seconds $DelaySeconds
    }
    throw "Health check failed for $Url"
}

# ─── Main ───────────────────────────────────────────────────────────────────

Write-Step "Ensuring Docker Desktop is running"
Ensure-DockerDesktopRunning

Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Write-Step "No .env found - copying from .env.example"
    Copy-Item -Path ".env.example" -Destination ".env" -Force
}

Write-Step "Starting infrastructure (postgres + redis + ml-service) in background"
docker compose up -d postgres redis ml-service

Write-Step "Starting backend with hot-reload + frontend with Vite HMR"
# -f base compose, -f dev override - merges volume mounts + reload commands
# Omit --build on every startup: reuses cached images/pip layers (~GB TensorFlow installs).
# Rebuild explicitly when Dockerfile/requirements change: docker compose -f docker-compose.yml -f docker-compose.dev.yml build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d `
    backend backend-worker frontend-dev gateway

Write-Step "Running database migrations"
Start-Sleep -Seconds 5
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app -T backend alembic upgrade head

Write-Step "Verifying services"
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

Wait-HttpOk -Url "http://localhost:8080" -MaxAttempts 40 -DelaySeconds 3
Wait-HttpOk -Url "http://localhost:8080/healthz" -MaxAttempts 20 -DelaySeconds 2

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  ICS Platform is running in HOT-RELOAD DEV MODE"          -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  App:     http://localhost:8080"                           -ForegroundColor Yellow
Write-Host "  API:     http://localhost:8080/api/v1/docs"               -ForegroundColor Yellow
Write-Host "  Login:   admin / admin123"                                -ForegroundColor Yellow
Write-Host ""
Write-Host "  Backend  auto-reloads on any Python file change"          -ForegroundColor Cyan
Write-Host "  Frontend auto-reloads on any React/TS file change"        -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop (ICS.bat q): compose stop keeps images/cache"             -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Green
