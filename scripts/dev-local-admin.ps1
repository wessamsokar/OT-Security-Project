# Generate one-time local bootstrap credentials (development only).
# Usage: dot-source then start backend, or copy values into backend/.env
$ErrorActionPreference = "Stop"

function New-RandomPassword([int]$Length = 24) {
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Substring(0, [Math]::Min(32, $Length + 8))
}

$email = if ($env:BOOTSTRAP_ADMIN_EMAIL) { $env:BOOTSTRAP_ADMIN_EMAIL } else { "admin@ics.local" }
$password = New-RandomPassword

Write-Host ""
Write-Host "Local bootstrap (development only) — copy into backend/.env for one startup:" -ForegroundColor Cyan
Write-Host "  BOOTSTRAP_ADMIN_ENABLED=true"
Write-Host "  BOOTSTRAP_ADMIN_EMAIL=$email"
Write-Host "  BOOTSTRAP_ADMIN_PASSWORD=$password"
Write-Host "  BOOTSTRAP_ADMIN_NAME=Admin"
Write-Host ""
Write-Host "After the first admin exists, set BOOTSTRAP_ADMIN_ENABLED=false and remove BOOTSTRAP_ADMIN_PASSWORD." -ForegroundColor Yellow
Write-Host "Password is shown once and is not stored by this script." -ForegroundColor Yellow
