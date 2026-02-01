#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===

# gate-ce05_m1_hard.sh <evidence_dir>
EVI="${1:-docs/_evidence/ce05_conflict_detector_$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$EVI"
echo "Running CE05 Runner..."
npx ts-node -r tsconfig-paths/register tools/p3/run_ce05_conflict_detector.ts > "$EVI/runner_ce05.txt" 2>&1 || {
    echo "❌ CE05 Failed"
    cat "$EVI/runner_ce05.txt"
    exit 1
}
echo "✅ CE05 Passed"
