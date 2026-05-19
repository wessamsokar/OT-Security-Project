# Fail CI/local checks if known default credentials appear in application/scripts source.
$ErrorActionPreference = "Stop"
$Root = Join-Path $PSScriptRoot ".."
Set-Location $Root

# Dangerous literals only (documentation may mention banned values in prose).
$patterns = @(
    'get_password_hash\("admin123"\)',
    'get_password_hash\(''admin123''\)',
    '"password": "admin123"',
    "BOOTSTRAP_ADMIN_PASSWORD=admin123",
    'password.*=.*"admin123"'
)

$excludeDirs = @("node_modules", "dist", ".git", "agent-transcripts")
$excludeFiles = @("insecure_defaults.py", "verify-no-default-credentials.ps1", "test_bootstrap_security.py")

function Test-ExcludedPath([string]$path) {
    foreach ($dir in $excludeDirs) {
        if ($path -match [regex]::Escape($dir)) { return $true }
    }
    foreach ($file in $excludeFiles) {
        if ($path -like "*$file") { return $true }
    }
    if ($path -match "\\\.env($|\.)") { return $true }
    if ($path -like "*\README.md") { return $true }
    return $false
}

$failed = $false
$files = Get-ChildItem -Recurse -File -Include *.py,*.http,*.ps1,*.yml,*.yaml,*.ini,*.ts,*.tsx |
    Where-Object { -not (Test-ExcludedPath $_.FullName) }

foreach ($pattern in $patterns) {
    $hits = $files | Select-String -Pattern $pattern -CaseSensitive:$false
    if ($hits) {
        Write-Host "FAIL: pattern '$pattern' found:" -ForegroundColor Red
        $hits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
        $failed = $true
    }
}

if ($failed) {
    exit 1
}

Write-Host "OK: no known default credential literals in repository source." -ForegroundColor Green
