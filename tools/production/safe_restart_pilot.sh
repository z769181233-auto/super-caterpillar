#!/bin/bash
set -eo pipefail

echo "🛡️  Safe Pilot Restart Sequence Initiated..."

# 1. Kill old processes safely (using lsof ports if available, or pids)
echo "🧹 Cleaning up old ports (3000, 3001)..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4222 | xargs kill -9 2>/dev/null || true
# Configured max concurrency port range? Worker typically just polls, but lets kill by PIDs if exists
if [ -f "/tmp/scu_gate_runtime/api.pid" ]; then
    kill -9 $(cat /tmp/scu_gate_runtime/api.pid) 2>/dev/null || true
fi
if [ -f "/tmp/scu_gate_runtime/worker.pid" ]; then
    kill -9 $(cat /tmp/scu_gate_runtime/worker.pid) 2>/dev/null || true
fi

# 2. Setup Environment
# Detect Mass Ready evidence, else fallback to pilot evidence
EVI=$(find docs/_evidence/real_pilot_massready_* -maxdepth 0 -type d | sort -r | head -n 1)
if [ -z "$EVI" ]; then
    EVI=$(find docs/_evidence/real_pilot_sealed42_* -maxdepth 0 -type d | sort -r | head -n 1)
fi
echo "📂 Evidence: $EVI"

export SHOT_RENDER_PROVIDER=local
export SHOT_RENDER_BASE_URL=""
export GATE_MODE=0
export WORKER_MAX_CONCURRENCY=5
export DATABASE_URL="postgresql://postgres:password@localhost:5433/scu"
export STORAGE_ROOT="$(pwd)/.data/storage"
echo "🔧 Env: PROVIDER=$SHOT_RENDER_PROVIDER, GATE_MODE=$GATE_MODE, DB=:5433, MOCK_URL=OFF, STORAGE=$STORAGE_ROOT"

# 3. Boot Runtime
echo "🚀 Booting Runtime..."
bash tools/dev/boot_gate_runtime.sh 2>&1 | tee "$EVI/runtime_boot_safe.log"

# 4. Wait for API to be responsive
echo "⏳ Waiting for API (localhost:3000)..."
x=0
while [ $x -lt 30 ]; do
    if curl -s http://localhost:3000/health >/dev/null; then
        echo "✅ API is UP"
        break
    fi
    sleep 2
    x=$((x+1))
done

# 5. Execute Real Pilot
echo "🏎️  Starting Real Pilot..."
INPUT_FILE="$EVI/input/pilot_text.txt"
mkdir -p "$EVI/run"

pnpm -w exec tsx tools/production/run_production_pilot.ts "$INPUT_FILE" 2>&1 | tee "$EVI/run/real_pilot_safe.log"

EXIT_CODE=${PIPESTATUS[0]}
echo "EXIT=$EXIT_CODE" | tee "$EVI/run/real_pilot.exit"

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "✅ Real Pilot Executed Successfully"
else
    echo "❌ Real Pilot Failed"
    exit "$EXIT_CODE"
fi
