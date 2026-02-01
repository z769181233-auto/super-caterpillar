#!/usr/bin/env bash
set -euo pipefail
# gate_ce12_theme_extractor.sh <evidence_dir>
EVI="${1:-docs/_evidence/ce12_theme_extractor_20260201}"
mkdir -p "$EVI"
echo "Running CE12 Runner..."
npx ts-node -r tsconfig-paths/register tools/p3/run_ce12_theme_extractor.ts > "$EVI/runner_ce12.txt" 2>&1 || {
    echo "❌ CE12 Failed"
    cat "$EVI/runner_ce12.txt"
    exit 1
}
echo "✅ CE12 Passed"
