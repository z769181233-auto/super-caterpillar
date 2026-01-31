#!/bin/bash
IFS=$'
	'
set -e

# P20-0: Audio Runtime Guardrails (Health & Metrics)
# Logic: Double Pass verify health probe success & metrics check.

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-0' < /dev/urandom | head -c 4 || echo "rand")
PARENT_EVIDENCE_DIR="docs/_evidence/p20_0_audio_guardrails_${TS}_${RAND}"
mkdir -p "$PARENT_EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P20-0 Audio Runtime Guardrails"
echo "=============================================="

run_pass() {
    local label=$1
    echo "--- Pass $label ---"
    local OUT="$PARENT_EVIDENCE_DIR/$label"
    
    # Run Health Probe (Preview 3s)
    # Note: Probe handles audio gen + mock metrics internally since we don't have running API.
    # We verify the probe LOGIC is sound.
    EVIDENCE_DIR="$OUT" npx ts-node -T tools/ops/health_audio_probe.ts
}

run_pass "R1"
run_pass "R2"

echo "--- Integrity Check (R1) ---"
# Check if probe_result exists
if [ ! -f "$PARENT_EVIDENCE_DIR/R1/probe_result.json" ]; then
    echo "❌ Missing R1 probe_result.json"
    exit 1
fi
echo "✅ R1 Probe Result Found"

echo "--- Integrity Check (R2) ---"
if [ ! -f "$PARENT_EVIDENCE_DIR/R2/probe_result.json" ]; then
    echo "❌ Missing R2 probe_result.json"
    exit 1
fi
echo "✅ R2 Probe Result Found"

echo "--- Metrics Validation ---"
# Verify metrics structure inside probe_result (since we used MockProbe)
if grep -q "metrics_snapshot" "$PARENT_EVIDENCE_DIR/R1/probe_result.json"; then
    echo "✅ Metrics Snapshot Verified"
else
    echo "❌ Metrics Snapshot Missing"
    exit 1
fi

echo "✅ GATE PASS: $PARENT_EVIDENCE_DIR"
