#!/bin/bash
IFS=$'
	'
set -e

# P19-0: Audio Engine Production Go-Live Drill
# Logic: Double Pass verification of Kill Switch, Whitelist, Cache Safety and Preview Audit.

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-0' < /dev/urandom | head -c 4 || echo "rand")
PARENT_EVIDENCE_DIR="docs/_evidence/p19_0_audio_golive_${TS}_${RAND}"
mkdir -p "$PARENT_EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P19-0 Audio Production Go-Live Drill"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="p19_0_drill_key"

run_drill() {
    local label=$1
    echo "--- Drill $label ---"
    local OUT="$PARENT_EVIDENCE_DIR/$label"
    EVIDENCE_DIR="$OUT" npx ts-node -T tools/ops/p19_0_audio_golive_drills.js --out "$OUT"
}

run_drill "R1"
run_drill "R2"

echo "--- Consistency Check ---"
diff "$PARENT_EVIDENCE_DIR/R1/results_sanitized.json" "$PARENT_EVIDENCE_DIR/R2/results_sanitized.json" || { echo "❌ Consistency Check FAIL"; exit 1; }
echo "✅ Consistency Check PASS"

echo "--- Integrity Check (R1) ---"
cd "$PARENT_EVIDENCE_DIR/R1" && sha256sum -c --status SHA256SUMS.txt && cd - || { echo "❌ Integrity Check R1 FAIL"; exit 1; }
echo "✅ Integrity Check R1 PASS"

echo "--- Integrity Check (R2) ---"
cd "$PARENT_EVIDENCE_DIR/R2" && sha256sum -c --status SHA256SUMS.txt && cd - || { echo "❌ Integrity Check R2 FAIL"; exit 1; }
echo "✅ Integrity Check R2 PASS"

echo "--- Drill Validation (Kill Switch) ---"
K1_CALLS=$(grep -c "REAL_CALL" "$PARENT_EVIDENCE_DIR/R1/mock_vendor_access.log" || true)
if [ "$K1_CALLS" -ne 1 ]; then
    # Note: K1 is Kill Switch ON (0 calls expected), W1 is OFF (0 calls as projectReal=false), W2 is ON (1 call).
    # In my JS script: K1 (Kill ON), W1 (OFF), W2 (ON), C1a/b/c (OFF), P1 (OFF). Total REAL_CALL should be 1.
    echo "❌ Kill Switch Validation FAIL, total calls: $K1_CALLS (Expected 1 from W2 only)"
    exit 1
fi
echo "✅ Kill Switch/Whitelist Drill PASS"

echo "✅ GATE PASS: $PARENT_EVIDENCE_DIR"
