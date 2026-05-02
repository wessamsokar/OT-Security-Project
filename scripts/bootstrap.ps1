$ErrorActionPreference = "Stop"

Copy-Item -Path .env.example -Destination .env -Force

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build `
    postgres redis ml-service backend backend-worker frontend-dev gateway
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed"
}

docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    throw "database migration failed"
}

docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -w /app backend python seed_data.py
if ($LASTEXITCODE -ne 0) {
    throw "seed script failed"
}

Write-Host "Platform is ready at http://localhost:8080" -ForegroundColor Green
