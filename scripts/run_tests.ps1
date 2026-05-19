$ErrorActionPreference = "Stop"

docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend pytest -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T ml-service pytest -q

if (-not $env:ICS_TEST_PASSWORD) {
    Write-Host "Skipping integration_test.py because ICS_TEST_PASSWORD is not set." -ForegroundColor Yellow
    exit 0
}

python scripts/integration_test.py
