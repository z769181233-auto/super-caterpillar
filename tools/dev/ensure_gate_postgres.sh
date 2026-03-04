#!/usr/bin/env bash
set -euo pipefail

PORT="${GATE_PG_PORT:-5433}"
NAME="${GATE_PG_CONTAINER:-scu-gate-pg}"
USER="${GATE_PG_USER:-scu}"
PASS="${GATE_PG_PASSWORD:-scu}"
DB="${GATE_PG_DB:-scu}"

# If DB already reachable, do nothing
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h 127.0.0.1 -p "${PORT}" >/dev/null 2>&1; then
    echo "[GATE_PG] Postgres already ready on :${PORT}"
    exit 0
  fi
fi

# If docker not available, hard fail (gate must be self-contained)
if ! command -v docker >/dev/null 2>&1; then
  echo "[GATE_PG][ERR] docker not found. Install Docker or run Postgres on localhost:${PORT}."
  exit 1
fi

# Check if docker daemon is running
if ! docker version >/dev/null 2>&1; then
  echo "[GATE_PG][ERR] Docker daemon is not running. Please start Docker Desktop."
  exit 1
fi

# Start (or reuse) a dedicated gate postgres container
if docker ps -a --format '{{.Names}}' | grep -qx "${NAME}"; then
  echo "[GATE_PG] Container ${NAME} exists; starting..."
  docker start "${NAME}" >/dev/null
else
  echo "[GATE_PG] Creating container ${NAME} on localhost:${PORT}..."
  docker run -d --name "${NAME}" \
    -e POSTGRES_USER="${USER}" \
    -e POSTGRES_PASSWORD="${PASS}" \
    -e POSTGRES_DB="${DB}" \
    -p "${PORT}:5432" \
    --health-cmd="pg_isready -U ${USER} -d ${DB}" \
    --health-interval=2s --health-timeout=3s --health-retries=30 \
    postgres:15-alpine >/dev/null
fi

# Wait for health
echo "[GATE_PG] Waiting for Postgres to be healthy..."
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "${NAME}" 2>/dev/null || true)"
  if [[ "${status}" == "healthy" ]]; then
    echo "[GATE_PG] Postgres healthy."
    exit 0
  fi
  sleep 1
done

echo "[GATE_PG][ERR] Postgres not healthy after timeout."
docker logs "${NAME}" --tail 200 || true
exit 1
