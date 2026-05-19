$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "[ICS-PROD] $Message" -ForegroundColor Cyan
}

function Require-File([string]$Path, [string]$Message) {
    if (-not (Test-Path $Path)) {
        throw "$Message Missing: $Path"
    }
}

function Wait-HttpOk([string]$Url, [int]$MaxAttempts = 40, [int]$DelaySeconds = 3) {
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
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

Set-Location (Join-Path $PSScriptRoot "..")

Require-File ".env" "Production requires a real root .env copied from .env.example and edited."
Require-File "backend/.env" "Production requires a real backend/.env copied from backend/.env.example and edited."
Require-File "ml-service/.env" "Production requires a real ml-service/.env copied from ml-service/.env.example and edited."

Write-Step "Validating production TLS files"
$tlsCertPath = if ($env:TLS_CERT_PATH) { $env:TLS_CERT_PATH } else { "./gateway/certs/fullchain.pem" }
$tlsKeyPath = if ($env:TLS_KEY_PATH) { $env:TLS_KEY_PATH } else { "./gateway/certs/privkey.pem" }
Require-File $tlsCertPath "Production requires a TLS certificate. Set TLS_CERT_PATH or place the default file."
Require-File $tlsKeyPath "Production requires a TLS private key. Set TLS_KEY_PATH or place the default file."
docker compose -f docker-compose.yml -f docker-compose.prod.yml config | Out-Null

Write-Step "Building and starting production profile"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

Write-Step "Verifying gateway and backend readiness"
$gatewayHttpPort = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "80" }
Wait-HttpOk -Url "http://localhost:$gatewayHttpPort/healthz" -MaxAttempts 20 -DelaySeconds 2

Write-Host ""
Write-Host "ICS production profile started. Verify HTTPS, /readyz, auth, CSRF, SSE, and CSP in the target environment." -ForegroundColor Green
