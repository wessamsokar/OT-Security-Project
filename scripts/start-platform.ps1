$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "[ICS] $Message" -ForegroundColor Cyan
}

function Ensure-Command([string]$CommandName, [string]$WingetId, [string]$DisplayName) {
    if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
        Write-Step "$DisplayName is installed"
        return
    }

    Write-Step "$DisplayName is missing. Trying to install with winget..."

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget is not available. Please install $DisplayName manually."
    }

    winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Failed to install $DisplayName automatically. Please install it manually and run again."
    }

    Write-Step "$DisplayName installed successfully"
}

function Wait-ForDocker([int]$MaxSeconds = 240) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    while ($stopwatch.Elapsed.TotalSeconds -lt $MaxSeconds) {
        try {
            docker info *> $null
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
        docker info *> $null
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

function Wait-HttpOk([string]$Url, [int]$MaxAttempts = 30, [int]$DelaySeconds = 2) {
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
                Write-Step "Health check passed: $Url"
                return
            }
        }
        catch {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "Health check failed for $Url"
}

function Ensure-EnvFile([string]$ExamplePath, [string]$TargetPath) {
    if (-not (Test-Path $TargetPath)) {
        Write-Step "No $TargetPath found. Creating from $ExamplePath"
        Copy-Item -Path $ExamplePath -Destination $TargetPath -Force
    }
}

Write-Step "Checking required tools"
Ensure-Command -CommandName "docker" -WingetId "Docker.DockerDesktop" -DisplayName "Docker Desktop"
Ensure-Command -CommandName "npm" -WingetId "OpenJS.NodeJS.LTS" -DisplayName "Node.js"

Write-Step "Ensuring Docker Desktop is running"
Ensure-DockerDesktopRunning

Write-Step "Checking Docker Compose"
docker compose version | Out-Null

Set-Location (Join-Path $PSScriptRoot "..")

Ensure-EnvFile -ExamplePath ".env.example" -TargetPath ".env"
Ensure-EnvFile -ExamplePath "backend/.env.example" -TargetPath "backend/.env"
Ensure-EnvFile -ExamplePath "ml-service/.env.example" -TargetPath "ml-service/.env"

Write-Step "Building and starting services in hot-reload dev mode"
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build `
    postgres redis ml-service backend backend-worker frontend-dev gateway

Write-Step "Running database migrations"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend alembic upgrade head

Write-Step "Seeding sample data"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend python seed_data.py

Write-Step "Verifying services"
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
Wait-HttpOk -Url "http://localhost:8080/healthz" -MaxAttempts 30 -DelaySeconds 2
Wait-HttpOk -Url "http://localhost:8080/readyz" -MaxAttempts 30 -DelaySeconds 2
Wait-HttpOk -Url "http://localhost:8080" -MaxAttempts 40 -DelaySeconds 2

Write-Host "" 
Write-Host "ICS platform is up and ready" -ForegroundColor Green
Write-Host "Open: http://localhost:8080" -ForegroundColor Green
Write-Host "Login: use the one-time password printed by seed_data.py (username: admin)" -ForegroundColor Green
Write-Host "       Or run scripts/dev-local-admin.ps1 for optional bootstrap credentials." -ForegroundColor Green
