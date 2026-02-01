#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

LOG_DIR="${1:-/tmp/scu_gate_runtime}"
mkdir -p "$LOG_DIR"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_DIR/boot.log"; }

log "=== Super Caterpillar Gate Runtime Boot ==="
log "ROOT=$ROOT"
log "LOG_DIR=$LOG_DIR"

# 1) Start infra (postgres/redis) if compose exists
COMPOSE=""
for f in docker-compose.yml docker-compose.yaml infra/docker-compose.yml infra/docker-compose.yaml tools/dev/docker-compose.yml; do
  if [[ -f "$f" ]]; then COMPOSE="$f"; break; fi
done

if [[ -n "$COMPOSE" ]]; then
  log "Using compose file: $COMPOSE"
  if command -v docker compose >/dev/null 2>&1; then
    docker compose -f "$COMPOSE" up -d 2>&1 | tee -a "$LOG_DIR/compose.log"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE" up -d 2>&1 | tee -a "$LOG_DIR/compose.log"
  else
    log "[WARN] docker compose not found, skipping infra start"
  fi
else
  log "[INFO] No compose file found. Assume services already running."
fi

# 2) Export common env if not set
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

log "DATABASE_URL=${DATABASE_URL}"
log "REDIS_URL=${REDIS_URL}"

# 3) Migrate/seed if scripts exist
if [[ -f "package.json" ]] && command -v pnpm >/dev/null 2>&1; then
  if pnpm -w -s run 2>/dev/null | grep -q "db:migrate"; then
    log "Running pnpm db:migrate"
    pnpm -w db:migrate 2>&1 | tee -a "$LOG_DIR/db_migrate.log" || log "[WARN] db:migrate failed or not applicable"
  fi
  if pnpm -w -s run 2>/dev/null | grep -q "db:seed"; then
    log "Running pnpm db:seed"
    pnpm -w db:seed 2>&1 | tee -a "$LOG_DIR/db_seed.log" || log "[WARN] db:seed failed or not applicable"
  fi
fi

# 4) Start api/worker (background) if scripts exist
start_bg(){
  local name="$1"
  local cmd="$2"
  local out="$LOG_DIR/${name}.log"
  log "Starting $name: $cmd"
  nohup bash -lc "$cmd" > "$out" 2>&1 &
  local pid=$!
  echo $pid > "$LOG_DIR/${name}.pid"
  log "  PID: $pid"
  sleep 2
}

if command -v pnpm >/dev/null 2>&1; then
  if pnpm -w -s run 2>/dev/null | grep -q "dev:api"; then
    start_bg "api" "cd '$ROOT' && pnpm -w dev:api"
  elif pnpm -w -s run 2>/dev/null | grep -q "start:api"; then
    start_bg "api" "cd '$ROOT' && pnpm -w start:api"
  fi
  
  if pnpm -w -s run 2>/dev/null | grep -q "dev:worker"; then
    start_bg "worker" "cd '$ROOT' && pnpm -w dev:worker"
  elif pnpm -w -s run 2>/dev/null | grep -q "start:worker"; then
    start_bg "worker" "cd '$ROOT' && pnpm -w start:worker"
  fi
fi

log "✅ Runtime boot completed"
log "Evidence: $LOG_DIR"

exit 0
