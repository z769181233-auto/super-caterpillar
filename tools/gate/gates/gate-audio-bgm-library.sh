#!/bin/bash
IFS=$'
	'
set -e

# P18-4: BGM Library Gate
# Logic: Verify track selection consistency and metadata audit.

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-0' < /dev/urandom | head -c 4 || echo "rand")
PARENT_EVID_DIR="docs/_evidence/p18_4_audio_bgm_library_${TS}_${RAND}"
mkdir -p "$PARENT_EVID_DIR"

echo "=============================================="
echo "GATE: P18-4 BGM Library & Selection (Hardened)"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="bgm_test_key"

run_test() {
  local label=$1
  echo "--- Run $label ---"
  local RUN_DIR="$PARENT_EVID_DIR/$label"
  mkdir -p "$RUN_DIR"
  
  EVIDENCE_DIR="$RUN_DIR" npx ts-node -T tools/ops/test_audio_bgm_library.ts > "$RUN_DIR/stdout.log" 2>&1
  if [ $? -eq 0 ]; then
    echo "[$label] PASS"
  else
    echo "[$label] FAIL"
    cat "$RUN_DIR/stdout.log"
    exit 1
  fi
}

run_test "R1"
run_test "R2"

# Double PASS: confirm output logs are identical
grep -v -E "\[TEST\]|Selection Counts|┌|└|├|┤|│" "$PARENT_EVID_DIR/R1/stdout.log" > "$PARENT_EVID_DIR/R1/clean.log"
grep -v -E "\[TEST\]|Selection Counts|┌|└|├|┤|│" "$PARENT_EVID_DIR/R2/stdout.log" > "$PARENT_EVID_DIR/R2/clean.log"

diff "$PARENT_EVID_DIR/R1/clean.log" "$PARENT_EVID_DIR/R2/clean.log" || { echo "Double PASS failed (Non-deterministic signals)"; exit 1; }

echo "✅ GATE PASS: $PARENT_EVID_DIR"
