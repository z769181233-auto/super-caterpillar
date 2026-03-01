#!/bin/bash
IFS=$'
	'
# gate-p2-no-fallback-real-render.sh
# V3.0 P2-1: Real Render No-Fallback Verification

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

GATE_ID="P2-1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="docs/_evidence/gate_${GATE_ID}_${TIMESTAMP}"
mkdir -p "${EVIDENCE_DIR}"

LOG_FILE="${EVIDENCE_DIR}/gate.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "--- [GATE ${GATE_ID}] Real Render No-Fallback Verification ---"

# Run the TypeScript Test Harness
echo "[Step 1] Executing Test: verified_fallback.ts"
# We execute from packages/engines/shot_render directory context or root via ts-node
# Since it imports from sibling files, best to run from root but targeting file.

# Need tsconfig-paths for any aliases, but this file is self-contained mostly.
# However, runShotRenderSDXL uses 'providers/...' imports which are relative.
# So running from packages/engines/shot_render/real might fail if baseurl is different.
# Let's try running from packages/engines/shot_render directory.

cd packages/engines/shot_render
npx ts-node real/verify_fallback.ts
TEST_EXIT_CODE=$?
cd ../../../

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ PASS: No-Fallback logic verified."
else
    echo "❌ FAIL: Test failed."
    exit 1
fi

echo "--- [GATE ${GATE_ID}] SUCCESS ---"
