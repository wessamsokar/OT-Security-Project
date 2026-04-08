$ErrorActionPreference = "Stop"

docker compose exec backend pytest -q
docker compose exec ml-service pytest -q
python scripts/integration_test.py
