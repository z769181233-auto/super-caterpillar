#!/bin/bash
set -euo pipefail

# Load Env
if [ -f .env.local ]; then
  source .env.local
  export DATABASE_URL
fi

# Set Gate Env
export GATE_MODE=1
export WORKER_MAX_CONCURRENCY=50
export HMAC_DEBUG=1
export NODE_OPTIONS="--max-old-space-size=8192"

# Fixed Smoke Credentials (from gate_auth_seed.sh default)
export VALID_API_KEY_ID=scu_smoke_key
export API_SECRET=scu_smoke_secret
export ORG_ID=875614d2-c63f-4fd7-9c95-956c0079348b
export USER_ID=gate_user_p25_stable

LOG_DIR="docs/_evidence/p25_1_full_manual_$(date +%s)"
mkdir -p "$LOG_DIR"

echo "=== MANUAL P25-1 RUNNER START ==="
echo "Logs: $LOG_DIR"

# Assuming API is ALREADY UP (PID found in process list or manually started)
# If not, user must start it.
# We will check.
if ! nc -z localhost 3000; then
    echo "❌ API is NOT UP. Please start API first."
    exit 1
fi

echo ">>> Starting 3M Execution Pass..."
# Run runner
pnpm exec tsx tools/stress/p25/run_p25_tier.ts \
    --tier=p25_1 \
    --words=3000000 \
    --seed="p25_1_full_manual_$(date +%s)" \
    --concurrency=50 \
    --out="$LOG_DIR" \
    --label="E2E" 2>&1 | tee "$LOG_DIR/run_stdout.log"

# Extract Project ID
RUN_OUT=$(cat "$LOG_DIR/run_stdout.log")
PROJ_ID=$(echo "$RUN_OUT" | grep "PROJECT_ID=" | cut -d= -f2 || true)

if [ -z "$PROJ_ID" ]; then
    echo "❌ Failed to extract ProjectID"
    exit 1
fi

echo "ProjectID detected: $PROJ_ID"

# Finalize
echo ">>> Initiating Snapshot..."
SEED="p25_1_manual_$(date +%Y%m%d)"
bash tools/ops/finalize_p25_1_snapshot.sh --projectId="$PROJ_ID" --out="$LOG_DIR/E2E" --seed="$SEED"

echo "✅ MANUAL RUN SUCCESS"
ls -F "$LOG_DIR/E2E/"
