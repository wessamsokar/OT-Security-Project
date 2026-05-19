$ErrorActionPreference = "Stop"

$ComposeFiles = @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml")

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

function Test-UrlOk([string]$Url) {
    # curl.exe avoids PowerShell proxy issues on some Windows setups
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $code = & curl.exe -sf -o NUL -w "%{http_code}" --connect-timeout 5 $Url 2>$null
        if ($code -match "^(2|3)\d\d$") {
            return $true
        }
    }

    $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 8 -UseBasicParsing -Proxy $null
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300)
}

function Build-Url([Uri]$BaseUri, [string]$HostName) {
    $builder = [UriBuilder]::new($BaseUri)
    $builder.Host = $HostName
    return $builder.Uri.AbsoluteUri
}

function Wait-HttpOk([string]$Url, [int]$MaxAttempts = 40, [int]$DelaySeconds = 3) {
    $uri = [Uri]$Url
    $hostCandidates = [System.Collections.Generic.List[string]]::new()
    $hostCandidates.Add($uri.Host) | Out-Null
    if ($uri.Host -eq "localhost") {
        $hostCandidates.Add("127.0.0.1") | Out-Null
    }

    $lastError = $null
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        foreach ($hostName in ($hostCandidates | Select-Object -Unique)) {
            $tryUrl = Build-Url -BaseUri $uri -HostName $hostName
            try {
                if (Test-UrlOk -Url $tryUrl) {
                    Write-Step "Health check passed: $tryUrl"
                    return
                }
            }
            catch {
                $lastError = $_.Exception.Message
            }
        }
        Write-Host "  Waiting... ($i/$MaxAttempts) $lastError" -ForegroundColor DarkGray
        Start-Sleep -Seconds $DelaySeconds
    }

    Write-Host ""
    Write-Host "Container status:" -ForegroundColor Yellow
    docker compose @ComposeFiles ps
    Write-Host ""
    Write-Host "Gateway logs:" -ForegroundColor Yellow
    docker compose @ComposeFiles logs gateway --tail 40
    throw "Health check failed for $Url. Last error: $lastError"
}

function Ensure-EnvFile([string]$ExamplePath, [string]$TargetPath) {
    if (-not (Test-Path $TargetPath)) {
        Write-Step "No $TargetPath found - copying from $ExamplePath"
        Copy-Item -Path $ExamplePath -Destination $TargetPath -Force
    }
}

function Invoke-Compose([string[]]$ComposeArgs) {
    docker compose @ComposeFiles @ComposeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($ComposeArgs -join ' ')"
    }
}

# ─── Main ───────────────────────────────────────────────────────────────────

Write-Step "Ensuring Docker Desktop is running"
Ensure-DockerDesktopRunning

Set-Location (Join-Path $PSScriptRoot "..")

Ensure-EnvFile -ExamplePath ".env.example" -TargetPath ".env"
Ensure-EnvFile -ExamplePath "backend/.env.example" -TargetPath "backend/.env"
Ensure-EnvFile -ExamplePath "ml-service/.env.example" -TargetPath "ml-service/.env"

Write-Step "Starting infrastructure (postgres + redis + ml-service)"
Invoke-Compose @("up", "-d", "postgres", "redis", "ml-service")

Write-Step "Starting backend (hot-reload) and waiting until healthy"
Invoke-Compose @("up", "-d", "--wait", "backend", "backend-worker")

Write-Step "Running database migrations"
Invoke-Compose @("exec", "-w", "/app", "-T", "backend", "alembic", "upgrade", "head")

Write-Step "Starting Vite dev server and waiting until healthy"
Invoke-Compose @("up", "-d", "--wait", "frontend-dev")

Write-Step "Starting gateway and waiting until healthy"
Invoke-Compose @("up", "-d", "--wait", "gateway")

Write-Step "Verifying services"
Invoke-Compose @("ps")

Wait-HttpOk -Url "http://localhost:8080/healthz" -MaxAttempts 25 -DelaySeconds 2
Wait-HttpOk -Url "http://localhost:8080/readyz" -MaxAttempts 40 -DelaySeconds 2
Wait-HttpOk -Url "http://localhost:8080" -MaxAttempts 40 -DelaySeconds 3

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  ICS Platform is running in HOT-RELOAD DEV MODE"          -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  App:     http://localhost:8080"                           -ForegroundColor Yellow
Write-Host "  API:     http://localhost:8080/api/v1/docs"               -ForegroundColor Yellow
Write-Host "  Login:   seed output (admin) or scripts/dev-local-admin.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Backend  auto-reloads on any Python file change"          -ForegroundColor Cyan
Write-Host "  Frontend auto-reloads on any React/TS file change"        -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop (ICS.bat q): compose stop keeps images/cache"             -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Green
