#!/bin/bash
set -eo pipefail

echo "🔍 Locating Evidence..."
EVI=$(find docs/_evidence/real_pilot_sealed42_* -maxdepth 0 -type d | sort -r | head -n 1)
echo "📂 Evidence: $EVI"

# Export Environment for Real Pilot
export SHOT_RENDER_PROVIDER=local
export GATE_MODE=0
export WORKER_MAX_CONCURRENCY=5
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/scu"
echo "🔧 Env: PROVIDER=$SHOT_RENDER_PROVIDER, GATE_MODE=$GATE_MODE, DB=:5433"

# R-3: Boot Runtime
echo "🚀 Booting Runtime..."
bash tools/dev/boot_gate_runtime.sh 2>&1 | tee "$EVI/runtime_boot.log"

# R-4: Execute Real Pilot
echo "🏎️  Starting Real Pilot..."
INPUT_FILE="$EVI/input/pilot_text.txt"
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Input file not found: $INPUT_FILE"
    exit 1
fi

mkdir -p "$EVI/run"
echo "Running: pnpm -w exec tsx tools/production/run_production_pilot.ts $INPUT_FILE"

pnpm -w exec tsx tools/production/run_production_pilot.ts "$INPUT_FILE" 2>&1 | tee "$EVI/run/real_pilot.log"

EXIT_CODE=${PIPESTATUS[0]}
echo "EXIT=$EXIT_CODE" | tee "$EVI/run/real_pilot.exit"

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "✅ Real Pilot Executed Successfully"
else
    echo "❌ Real Pilot Failed"
    exit "$EXIT_CODE"
fi
