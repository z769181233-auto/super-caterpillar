#!/bin/bash
# run_p5_full_audit.sh: Phase 5 商业审计全链路运行器
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVI_DIR="$REPO_ROOT/docs/_evidence/p5_full_audit_$TIMESTAMP"

mkdir -p "$EVI_DIR"
echo "[PHASE-5] Starting Full Audit -> $EVI_DIR"

# 1. Reuse existing evidence if available for P5-0/P5-1, or run new ones
# For this run, we assume we want fresh evidence for P5-2 and reuse or re-run P5-0/P5-1 data
# To be thorough, let's copy the latest successful P5-0/P5-1 evidence to the new dir
LATEST_P5_EVI=$(ls -td "$REPO_ROOT/docs/_evidence/p5_commercial_audit_"* | head -1 || echo "")

if [ -n "$LATEST_P5_EVI" ]; then
    echo "[PHASE-5] Reusing P5-0/P5-1 baseline from $LATEST_P5_EVI"
    cp "$LATEST_P5_EVI/concurrency_perf.json" "$EVI_DIR/" || true
    cp "$LATEST_P5_EVI/unit_cost_audit.json" "$EVI_DIR/" || true
fi

# 2. Run P5-2 Stability Audit
echo "[PHASE-5] Running P5-2 Stability Audit..."
node "$REPO_ROOT/tools/audit/analyze_stability_logs.js" --evi "$EVI_DIR"

# 3. Execute Gates
echo "[PHASE-5] Executing Gate Chain..."
bash "$REPO_ROOT/tools/gate/gates/gate_p5_throughput.sh" "$EVI_DIR"
bash "$REPO_ROOT/tools/gate/gates/gate_p5_unit_cost.sh" "$EVI_DIR"
bash "$REPO_ROOT/tools/gate/gates/gate_p5_stability.sh" "$EVI_DIR"

# 4. Generate Evidence Index
echo "[PHASE-5] Generating Evidence Index..."
node "$REPO_ROOT/tools/evidence/gen_evidence_index.mjs" "$EVI_DIR"

echo "✅ [PHASE-5] Full Audit PASS"
echo "Evidence: $EVI_DIR"
