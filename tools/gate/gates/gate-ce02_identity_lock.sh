#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE-CE02: Identity Lock Verifier
# Scope: Verify CE02 Processor Logic (Idempotency, SSOT Path, Validation)

# 1. Setup Evidence
EVD_DIR=$(cat .current_evidence_dir)
LOG_FILE="$EVD_DIR/GATE_CE02_IDENTITY_LOCK.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[GATE] Starting CE02 Identity Lock Gate at $(date)"
echo "[GATE] Evidence Dir: $EVD_DIR"

# 2. Env Setup
export SSOT_ROOT=$(pwd)
# Load env for Prisma
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# 3. Compile first (ensure fresh code)
# echo "[GATE] Compiling workers..."
# (cd apps/workers && ../../node_modules/.bin/tsc --noEmit)

# 4. Run Verification Runner
echo "[GATE] Running CE02 TS Runner..."
# Use ts-node from root
./node_modules/.bin/ts-node tools/gate/runners/run-ce02-processor.ts

RUN_EXIT_CODE=$?

if [ $RUN_EXIT_CODE -eq 0 ]; then
  echo "[GATE] ✅ Runner passed."
else
  echo "[GATE] ❌ Runner failed with code $RUN_EXIT_CODE"
  exit $RUN_EXIT_CODE
fi

# 5. Generate Evidence Index
INDEX_FILE="$EVD_DIR/EVIDENCE_INDEX.json"
echo "{" > "$INDEX_FILE"
echo "  \"gate\": \"gate-ce02_identity_lock\"," >> "$INDEX_FILE"
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$INDEX_FILE"
echo "  \"files\": [" >> "$INDEX_FILE"
echo "    \"IDENTITY_TRIVIEW_LIST.txt\"," >> "$INDEX_FILE"
echo "    \"IDENTITY_TRIVIEW_SHA256.txt\"," >> "$INDEX_FILE"
echo "    \"DECODE_ASSERT.log\"," >> "$INDEX_FILE"
echo "    \"DB_ANCHOR_ROW.sql.out\"" >> "$INDEX_FILE"
echo "  ]" >> "$INDEX_FILE"
echo "}" >> "$INDEX_FILE"

echo "[GATE] CE02 Gate FINISHED SUCCESS"
