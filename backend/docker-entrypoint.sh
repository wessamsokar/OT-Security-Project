#!/bin/sh
cd /app

# Worker uses the same image; only the API container must run migrations. Parallel
# `alembic upgrade head` from backend + backend-worker often fails the first one
# (dependency "backend failed to start" in compose) with a non-zero exit.
if [ "${SKIP_ALEMBIC:-}" = "1" ]; then
  exec "$@"
fi

# Postgres can report healthy before the first connection from this process works.
n=0
max=40
while [ "$n" -lt "$max" ]; do
  if alembic upgrade head; then
    exec "$@"
  fi
  n=$((n + 1))
  echo "alembic not ready yet ($n/$max), retrying in 2s..." >&2
  sleep 2
done
echo "ERROR: alembic upgrade head failed after $max attempts" >&2
exit 1
