#!/bin/bash
set -e

# P18-3: Production Mixing & BGM Gate
# Logic: Double PASS for deterministic mixing and duration alignment.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_3_audio_production_mix_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-3 Production Mixing & BGM"
echo "=============================================="

run_test() {
  local label=$1
  echo "--- Run $label ---"
  mkdir -p "$EVIDENCE_DIR/$label"
  npx ts-node -T tools/ops/test_audio_production_mix.ts > "$EVIDENCE_DIR/$label/stdout.log" 2>&1
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

# Double PASS: confirm output logs are identical (except timestamped project IDs)
# T3 uses a seed for BGM, so it MUST be deterministic. 
# We filter out timestamps and random RequestIDs.
grep -v -E "\[TEST\]|RequestID|Latency|Duration" "$EVIDENCE_DIR/R1/stdout.log" > "$EVIDENCE_DIR/R1/clean.log"
grep -v -E "\[TEST\]|RequestID|Latency|Duration" "$EVIDENCE_DIR/R2/stdout.log" > "$EVIDENCE_DIR/R2/clean.log"

diff "$EVIDENCE_DIR/R1/clean.log" "$EVIDENCE_DIR/R2/clean.log" || { echo "Double PASS failed (Non-deterministic signals)"; exit 1; }

echo "✅ GATE PASS: $EVIDENCE_DIR"
