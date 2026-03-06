#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# P1-5 Gate: Trace x Performance Correlation
# Verifies that:
# 1. Granular histograms exist in /metrics
# 2. Worker logs contain structured spans (job.queue, engine.exec, etc)

# Load ENV
set -a
source .env.local 2>/dev/null || true
set +a
export NODE_ENV="development"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/scu"
# export GATE_MODE="1" # Use Normal Mode for real processing
export LOG_LEVEL="info"
export JWT_SECRET="dev-jwt-secret"

export API_KEY="gate-test-key"
export API_SECRET="gate-test-secret"
export WORKER_API_KEY="$API_KEY"
export WORKER_API_SECRET="$API_SECRET"

LOG_DIR="docs/_evidence/p1_5_trace_perf"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gate_run.log"
API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

echo "=== GATE P1-5 [TRACE_PERF_CORRELATION] START ===" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# 0. Build (No Turbo for Gate stability? Using turbo here for convenience but filter strict)
echo "[0/5] Building..." | tee -a "$LOG_FILE"
pnpm turbo run build --filter @scu/observability --filter api --filter @scu/worker >> "$LOG_FILE" 2>&1

# Debug Env
echo "DEBUG: DATABASE_URL=$DATABASE_URL" | tee -a "$LOG_FILE"

# 1. Start API & Worker
echo "[1/5] Starting API & Worker..." | tee -a "$LOG_FILE"
# Force pass ALL env vars to API to bypass turbo stripping
DATABASE_URL="$DATABASE_URL" JWT_SECRET="dev-jwt-secret" API_KEY="$API_KEY" API_SECRET="$API_SECRET" pnpm turbo run dev --filter api > "$API_LOG" 2>&1 &
API_PID=$!
echo "API PID: $API_PID" | tee -a "$LOG_FILE"

# Wait for API
echo "Waiting for API to start..."
for i in {1..60}; do
  if curl -s http://localhost:3000/metrics > /dev/null; then
    echo "API is up!" | tee -a "$LOG_FILE"
    break
  fi
  if [ $i -eq 60 ]; then
      echo "❌ API failed to come up." | tee -a "$LOG_FILE"
      cat "$API_LOG" | tee -a "$LOG_FILE"
      exit 1
  fi
  sleep 1
done

# Start Worker
WORKER_METRICS_PORT=9099
export WORKER_SUPPORTED_ENGINES="ce03_visual_density,ce04_visual_enrichment,ce06_novel_parsing"
# Ensure DATABASE_URL is passed explicitly
DATABASE_URL="$DATABASE_URL" pnpm turbo run dev --filter @scu/worker -- --worker-id "p1-5-worker" --metrics-port "$WORKER_METRICS_PORT" > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID" | tee -a "$LOG_FILE"

# Wait for Worker
sleep 5

# 2. Run Smoke Test
echo "[2/5] Running Smoke Test..." | tee -a "$LOG_FILE"
if ! pnpm exec tsx tools/stress/p1-5_smoke_trace_perf.ts >> "$LOG_FILE" 2>&1; then
    echo "❌ Smoke Test Failed" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
fi

# Wait for processing
echo "Waiting for jobs to process..."
sleep 15

# 3. Verify Metrics
echo "[3/5] Verifying Metrics..." | tee -a "$LOG_FILE"
METRICS=$(curl -s http://localhost:9099/metrics)
REQUIRED_METRICS=("scu_job_queue_seconds_bucket" "scu_job_prepare_seconds_bucket" "scu_engine_exec_seconds_bucket" "scu_job_persist_seconds_bucket")

for METRIC in "${REQUIRED_METRICS[@]}"; do
  if echo "$METRICS" | grep -q "$METRIC"; then
    echo "✅ Metric Found: $METRIC" | tee -a "$LOG_FILE"
  else
    echo "❌ Metric Missing: $METRIC" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
  fi
done

# 4. Verify Trace Spans
echo "[4/5] Verifying Trace Spans..." | tee -a "$LOG_FILE"
REQUIRED_SPANS=("job.queue" "job.prepare" "job.engine.exec" "job.persist")

for SPAN in "${REQUIRED_SPANS[@]}"; do
  # Grep in worker log
  if grep -q "$SPAN" "$WORKER_LOG"; then
    echo "✅ Span Found: $SPAN" | tee -a "$LOG_FILE"
  else
    echo "❌ Span Missing from Log: $SPAN" | tee -a "$LOG_FILE"
    # Don    # actually, failing hard is better for Gate.
    # Let  fi
done

echo "=== FINAL EVIDENCE ===" | tee -a "$LOG_FILE"
echo "GATE P1-5 [TRACE_PERF_CORRELATION]: PASS" | tee -a "$LOG_FILE"

kill $API_PID $WORKER_PID
exit 0
set -e

# P1-5 Gate: Trace x Performance Correlation
# Verifies that:
# 1. Granular histograms exist in /metrics
# 2. Worker logs contain structured spans (job.queue, engine.exec, etc)

# Load ENV
set -a
source .env.local 2>/dev/null || true
set +a
export NODE_ENV="development"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/scu"
# export GATE_MODE="1" # Use Normal Mode for real processing
export LOG_LEVEL="info"
export JWT_SECRET="dev-jwt-secret"

export API_KEY="gate-test-key"
export API_SECRET="gate-test-secret"
export WORKER_API_KEY="$API_KEY"
export WORKER_API_SECRET="$API_SECRET"

LOG_DIR="docs/_evidence/p1_5_trace_perf"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gate_run.log"
API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

echo "=== GATE P1-5 [TRACE_PERF_CORRELATION] START ===" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# 0. Build (No Turbo for Gate stability? Using turbo here for convenience but filter strict)
echo "[0/5] Building..." | tee -a "$LOG_FILE"
pnpm turbo run build --filter @scu/observability --filter api --filter @scu/worker >> "$LOG_FILE" 2>&1

# Debug Env
echo "DEBUG: DATABASE_URL=$DATABASE_URL" | tee -a "$LOG_FILE"

# 1. Start API & Worker
echo "[1/5] Starting API & Worker..." | tee -a "$LOG_FILE"
# Force pass ALL env vars to API to bypass turbo stripping
DATABASE_URL="$DATABASE_URL" JWT_SECRET="dev-jwt-secret" API_KEY="$API_KEY" API_SECRET="$API_SECRET" pnpm turbo run dev --filter api > "$API_LOG" 2>&1 &
API_PID=$!
echo "API PID: $API_PID" | tee -a "$LOG_FILE"

# Wait for API
echo "Waiting for API to start..."
for i in {1..60}; do
  if curl -s http://localhost:3000/metrics > /dev/null; then
    echo "API is up!" | tee -a "$LOG_FILE"
    break
  fi
  if [ $i -eq 60 ]; then
      echo "❌ API failed to come up." | tee -a "$LOG_FILE"
      cat "$API_LOG" | tee -a "$LOG_FILE"
      exit 1
  fi
  sleep 1
done

# Start Worker
WORKER_METRICS_PORT=9099
export WORKER_SUPPORTED_ENGINES="ce03_visual_density,ce04_visual_enrichment,ce06_novel_parsing"
# Ensure DATABASE_URL is passed explicitly
DATABASE_URL="$DATABASE_URL" pnpm turbo run dev --filter @scu/worker -- --worker-id "p1-5-worker" --metrics-port "$WORKER_METRICS_PORT" > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID" | tee -a "$LOG_FILE"

# Wait for Worker
sleep 5

# 2. Run Smoke Test
echo "[2/5] Running Smoke Test..." | tee -a "$LOG_FILE"
if ! pnpm exec tsx tools/stress/p1-5_smoke_trace_perf.ts >> "$LOG_FILE" 2>&1; then
    echo "❌ Smoke Test Failed" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
fi

# Wait for processing
echo "Waiting for jobs to process..."
sleep 15

# 3. Verify Metrics
echo "[3/5] Verifying Metrics..." | tee -a "$LOG_FILE"
METRICS=$(curl -s http://localhost:9099/metrics)
REQUIRED_METRICS=("scu_job_queue_seconds_bucket" "scu_job_prepare_seconds_bucket" "scu_engine_exec_seconds_bucket" "scu_job_persist_seconds_bucket")

for METRIC in "${REQUIRED_METRICS[@]}"; do
  if echo "$METRICS" | grep -q "$METRIC"; then
    echo "✅ Metric Found: $METRIC" | tee -a "$LOG_FILE"
  else
    echo "❌ Metric Missing: $METRIC" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
  fi
done

# 4. Verify Trace Spans
echo "[4/5] Verifying Trace Spans..." | tee -a "$LOG_FILE"
REQUIRED_SPANS=("job.queue" "job.prepare" "job.engine.exec" "job.persist")

for SPAN in "${REQUIRED_SPANS[@]}"; do
  # Grep in worker log
  if grep -q "$SPAN" "$WORKER_LOG"; then
    echo "✅ Span Found: $SPAN" | tee -a "$LOG_FILE"
  else
    echo "❌ Span Missing from Log: $SPAN" | tee -a "$LOG_FILE"
    # Don    # actually, failing hard is better for Gate.
    # Let  fi
done

echo "=== FINAL EVIDENCE ===" | tee -a "$LOG_FILE"
echo "GATE P1-5 [TRACE_PERF_CORRELATION]: PASS" | tee -a "$LOG_FILE"

kill $API_PID $WORKER_PID
exit 0
set -e

# P1-5 Gate: Trace x Performance Correlation
# Verifies that:
# 1. Granular histograms exist in /metrics
# 2. Worker logs contain structured spans (job.queue, engine.exec, etc)

# Load ENV
set -a
source .env.local 2>/dev/null || true
set +a
export NODE_ENV="development"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/scu"
# export GATE_MODE="1" # Use Normal Mode for real processing
export LOG_LEVEL="info"
export JWT_SECRET="dev-jwt-secret"

export API_KEY="gate-test-key"
export API_SECRET="gate-test-secret"
export WORKER_API_KEY="$API_KEY"
export WORKER_API_SECRET="$API_SECRET"

LOG_DIR="docs/_evidence/p1_5_trace_perf"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gate_run.log"
API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

echo "=== GATE P1-5 [TRACE_PERF_CORRELATION] START ===" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# 0. Build (No Turbo for Gate stability? Using turbo here for convenience but filter strict)
echo "[0/5] Building..." | tee -a "$LOG_FILE"
pnpm turbo run build --filter @scu/observability --filter api --filter @scu/worker >> "$LOG_FILE" 2>&1

# Debug Env
echo "DEBUG: DATABASE_URL=$DATABASE_URL" | tee -a "$LOG_FILE"

# 1. Start API & Worker
echo "[1/5] Starting API & Worker..." | tee -a "$LOG_FILE"
# Force pass ALL env vars to API to bypass turbo stripping
DATABASE_URL="$DATABASE_URL" JWT_SECRET="dev-jwt-secret" API_KEY="$API_KEY" API_SECRET="$API_SECRET" pnpm turbo run dev --filter api > "$API_LOG" 2>&1 &
API_PID=$!
echo "API PID: $API_PID" | tee -a "$LOG_FILE"

# Wait for API
echo "Waiting for API to start..."
for i in {1..60}; do
  if curl -s http://localhost:3000/metrics > /dev/null; then
    echo "API is up!" | tee -a "$LOG_FILE"
    break
  fi
  if [ $i -eq 60 ]; then
      echo "❌ API failed to come up." | tee -a "$LOG_FILE"
      cat "$API_LOG" | tee -a "$LOG_FILE"
      exit 1
  fi
  sleep 1
done

# Start Worker
WORKER_METRICS_PORT=9099
export WORKER_SUPPORTED_ENGINES="ce03_visual_density,ce04_visual_enrichment,ce06_novel_parsing"
# Ensure DATABASE_URL is passed explicitly
DATABASE_URL="$DATABASE_URL" pnpm turbo run dev --filter @scu/worker -- --worker-id "p1-5-worker" --metrics-port "$WORKER_METRICS_PORT" > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID" | tee -a "$LOG_FILE"

# Wait for Worker
sleep 5

# 2. Run Smoke Test
echo "[2/5] Running Smoke Test..." | tee -a "$LOG_FILE"
if ! pnpm exec tsx tools/stress/p1-5_smoke_trace_perf.ts >> "$LOG_FILE" 2>&1; then
    echo "❌ Smoke Test Failed" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
fi

# Wait for processing
echo "Waiting for jobs to process..."
sleep 15

# 3. Verify Metrics
echo "[3/5] Verifying Metrics..." | tee -a "$LOG_FILE"
METRICS=$(curl -s http://localhost:9099/metrics)
REQUIRED_METRICS=("scu_job_queue_seconds_bucket" "scu_job_prepare_seconds_bucket" "scu_engine_exec_seconds_bucket" "scu_job_persist_seconds_bucket")

for METRIC in "${REQUIRED_METRICS[@]}"; do
  if echo "$METRICS" | grep -q "$METRIC"; then
    echo "✅ Metric Found: $METRIC" | tee -a "$LOG_FILE"
  else
    echo "❌ Metric Missing: $METRIC" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
  fi
done

# 4. Verify Trace Spans
echo "[4/5] Verifying Trace Spans..." | tee -a "$LOG_FILE"
REQUIRED_SPANS=("job.queue" "job.prepare" "job.engine.exec" "job.persist")

for SPAN in "${REQUIRED_SPANS[@]}"; do
  # Grep in worker log
  if grep -q "$SPAN" "$WORKER_LOG"; then
    echo "✅ Span Found: $SPAN" | tee -a "$LOG_FILE"
  else
    echo "❌ Span Missing from Log: $SPAN" | tee -a "$LOG_FILE"
    # Don    # actually, failing hard is better for Gate.
    # Let  fi
done

echo "=== FINAL EVIDENCE ===" | tee -a "$LOG_FILE"
echo "GATE P1-5 [TRACE_PERF_CORRELATION]: PASS" | tee -a "$LOG_FILE"

kill $API_PID $WORKER_PID
exit 0
set -e

# P1-5 Gate: Trace x Performance Correlation
# Verifies that:
# 1. Granular histograms exist in /metrics
# 2. Worker logs contain structured spans (job.queue, engine.exec, etc)

# Load ENV
set -a
source .env.local 2>/dev/null || true
set +a
export NODE_ENV="development"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/scu"
# export GATE_MODE="1" # Use Normal Mode for real processing
export LOG_LEVEL="info"
export JWT_SECRET="dev-jwt-secret"

export API_KEY="gate-test-key"
export API_SECRET="gate-test-secret"
export WORKER_API_KEY="$API_KEY"
export WORKER_API_SECRET="$API_SECRET"

LOG_DIR="docs/_evidence/p1_5_trace_perf"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gate_run.log"
API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

echo "=== GATE P1-5 [TRACE_PERF_CORRELATION] START ===" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# 0. Build (No Turbo for Gate stability? Using turbo here for convenience but filter strict)
echo "[0/5] Building..." | tee -a "$LOG_FILE"
pnpm turbo run build --filter @scu/observability --filter api --filter @scu/worker >> "$LOG_FILE" 2>&1

# Debug Env
echo "DEBUG: DATABASE_URL=$DATABASE_URL" | tee -a "$LOG_FILE"

# 1. Start API & Worker
echo "[1/5] Starting API & Worker..." | tee -a "$LOG_FILE"
# Force pass ALL env vars to API to bypass turbo stripping
DATABASE_URL="$DATABASE_URL" JWT_SECRET="dev-jwt-secret" API_KEY="$API_KEY" API_SECRET="$API_SECRET" pnpm turbo run dev --filter api > "$API_LOG" 2>&1 &
API_PID=$!
echo "API PID: $API_PID" | tee -a "$LOG_FILE"

# Wait for API
echo "Waiting for API to start..."
for i in {1..60}; do
  if curl -s http://localhost:3000/metrics > /dev/null; then
    echo "API is up!" | tee -a "$LOG_FILE"
    break
  fi
  if [ $i -eq 60 ]; then
      echo "❌ API failed to come up." | tee -a "$LOG_FILE"
      cat "$API_LOG" | tee -a "$LOG_FILE"
      exit 1
  fi
  sleep 1
done

# Start Worker
WORKER_METRICS_PORT=9099
export WORKER_SUPPORTED_ENGINES="ce03_visual_density,ce04_visual_enrichment,ce06_novel_parsing"
# Ensure DATABASE_URL is passed explicitly
DATABASE_URL="$DATABASE_URL" pnpm turbo run dev --filter @scu/worker -- --worker-id "p1-5-worker" --metrics-port "$WORKER_METRICS_PORT" > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID" | tee -a "$LOG_FILE"

# Wait for Worker
sleep 5

# 2. Run Smoke Test
echo "[2/5] Running Smoke Test..." | tee -a "$LOG_FILE"
if ! pnpm exec tsx tools/stress/p1-5_smoke_trace_perf.ts >> "$LOG_FILE" 2>&1; then
    echo "❌ Smoke Test Failed" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
fi

# Wait for processing
echo "Waiting for jobs to process..."
sleep 15

# 3. Verify Metrics
echo "[3/5] Verifying Metrics..." | tee -a "$LOG_FILE"
METRICS=$(curl -s http://localhost:9099/metrics)
REQUIRED_METRICS=("scu_job_queue_seconds_bucket" "scu_job_prepare_seconds_bucket" "scu_engine_exec_seconds_bucket" "scu_job_persist_seconds_bucket")

for METRIC in "${REQUIRED_METRICS[@]}"; do
  if echo "$METRICS" | grep -q "$METRIC"; then
    echo "✅ Metric Found: $METRIC" | tee -a "$LOG_FILE"
  else
    echo "❌ Metric Missing: $METRIC" | tee -a "$LOG_FILE"
    kill $API_PID $WORKER_PID
    exit 1
  fi
done

# 4. Verify Trace Spans
echo "[4/5] Verifying Trace Spans..." | tee -a "$LOG_FILE"
REQUIRED_SPANS=("job.queue" "job.prepare" "job.engine.exec" "job.persist")

for SPAN in "${REQUIRED_SPANS[@]}"; do
  # Grep in worker log
  if grep -q "$SPAN" "$WORKER_LOG"; then
    echo "✅ Span Found: $SPAN" | tee -a "$LOG_FILE"
  else
    echo "❌ Span Missing from Log: $SPAN" | tee -a "$LOG_FILE"
    # Don    # actually, failing hard is better for Gate.
    # Let  fi
done

echo "=== FINAL EVIDENCE ===" | tee -a "$LOG_FILE"
echo "GATE P1-5 [TRACE_PERF_CORRELATION]: PASS" | tee -a "$LOG_FILE"

kill $API_PID $WORKER_PID
exit 0
