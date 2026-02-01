#!/usr/bin/env bash
set -euo pipefail
# gate_ce08_character_arc.sh <evidence_dir>
EVI="${1:-docs/_evidence/ce08_character_arc_20260201}"
mkdir -p "$EVI"
echo "Running CE08 Runner..."
npx ts-node -r tsconfig-paths/register tools/p3/run_ce08_character_arc.ts > "$EVI/runner_ce08.txt" 2>&1 || {
    echo "❌ CE08 Failed"
    cat "$EVI/runner_ce08.txt"
    exit 1
}
echo "✅ CE08 Passed"
