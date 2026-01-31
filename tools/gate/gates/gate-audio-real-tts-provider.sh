#!/bin/bash
IFS=$'
	'
set -e

# P18-2: Real TTS Provider Gate
# Logic: Double PASS verification of provider signals and fail-fast behaviors.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_2_audio_real_tts_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-2 Real TTS Provider Integration"
echo "=============================================="

run_test() {
  local label=$1
  echo "--- Run $label ---"
  mkdir -p "$EVIDENCE_DIR/$label"
  
  # P18-2-HARD: Setup Audit Log
  export MOCK_VENDOR_LOG="$EVIDENCE_DIR/$label/mock_vendor_access.log"
  touch "$MOCK_VENDOR_LOG"

  npx ts-node -T tools/ops/test_audio_real_provider.ts > "$EVIDENCE_DIR/$label/stdout.log" 2>&1
  
  if [ $? -eq 0 ]; then
    # Assertions
    # 1. KS=1 -> Call count MUST be 0
    # Note: test_audio_real_provider.ts runs Case T1 when KS=1.
    # We need to filter the log for that specific time window (though here we can just check if any calls happened)
    # Actually, the TS script handles multiple cases. We'll check the log content.
    CALL_COUNT=$(grep -c "CALL_START" "$MOCK_VENDOR_LOG" || true)
    echo "[$label] External call count: $CALL_COUNT"
    
    # In test_audio_real_provider.ts: 
    # T1: KS=1 -> should be 0 call
    # T2: Stub -> 0 call
    # T3: Real -> 1 call
    # T4: Fail -> 0 call (fails before call)
    if [ "$CALL_COUNT" != "1" ]; then
        echo "[$label] ERROR: Expected exactly 1 external call in the whole script (Case T3), but got $CALL_COUNT"
        exit 1
    fi
    
    echo "[$label] PASS"
  else
    echo "[$label] FAIL"
    cat "$EVIDENCE_DIR/$label/stdout.log"
    exit 1
  fi
}

run_test "R1"
run_test "R2"

# Double PASS: confirm output logs are identical (except for random IDs/latencies-handled by filter)
# Filter out non-deterministic lines: [TEST], RequestID, Latency, startFrames, durationSec, timestamp
grep -v -E "\[TEST\]|RequestID|Latency|CALL_START" "$EVIDENCE_DIR/R1/stdout.log" > "$EVIDENCE_DIR/R1/clean.log"
grep -v -E "\[TEST\]|RequestID|Latency|CALL_START" "$EVIDENCE_DIR/R2/stdout.log" > "$EVIDENCE_DIR/R2/clean.log"

diff "$EVIDENCE_DIR/R1/clean.log" "$EVIDENCE_DIR/R2/clean.log" || { echo "Double PASS failed (Non-deterministic signals)"; exit 1; }

echo "✅ GATE PASS: $EVIDENCE_DIR"
