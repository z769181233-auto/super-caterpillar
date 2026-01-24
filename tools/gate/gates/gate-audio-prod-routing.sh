#!/bin/bash
set -e

# P18-1: Audio Production Routing Gate
# Logic: Double PASS verification of routing signals and bit-level determinism.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_1_audio_prod_routing_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-1 Audio Production Routing"
echo "=============================================="

run_test() {
  local label=$1
  echo "--- Run $label ---"
  mkdir -p "$EVIDENCE_DIR/$label"
  npx ts-node -T tools/ops/test_audio_routing.ts > "$EVIDENCE_DIR/$label/stdout.log" 2>&1
  if [ $? -eq 0 ]; then
    echo "[$label] PASS"
  else
    echo "[$label] FAIL"
    cat "$EVIDENCE_DIR/$label/stdout.log"
    exit 1
  fi
}

run_test "R1"
run_test "R2"

# Double PASS: confirm output logs are identical (deterministic signals)
# Filter out the [TEST] line which contains a timestamped ID
grep -v "\[TEST\]" "$EVIDENCE_DIR/R1/stdout.log" > "$EVIDENCE_DIR/R1/clean.log"
grep -v "\[TEST\]" "$EVIDENCE_DIR/R2/stdout.log" > "$EVIDENCE_DIR/R2/clean.log"

diff "$EVIDENCE_DIR/R1/clean.log" "$EVIDENCE_DIR/R2/clean.log" || { echo "Double PASS failed (Non-deterministic output)"; exit 1; }

echo "✅ GATE PASS: $EVIDENCE_DIR"

# Cleanup temp projects is handled by the TS script itself.
