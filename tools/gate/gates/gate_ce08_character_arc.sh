#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===

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
