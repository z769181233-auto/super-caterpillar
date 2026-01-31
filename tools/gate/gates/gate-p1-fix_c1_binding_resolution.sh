#!/bin/bash
IFS=$'
	'
# gate-p1-fix_c1_binding_resolution.sh
# V3.0 P1-FIX-0: Hardening C1 & Binding Resolution

set -e

# Load environment variables (standard gate preamble)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

GATE_ID="P1-FIX-0"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="docs/_evidence/gate_${GATE_ID}_${TIMESTAMP}"
mkdir -p "${EVIDENCE_DIR}"

LOG_FILE="${EVIDENCE_DIR}/gate.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "--- [GATE ${GATE_ID}] C1 Binding Resolution Hardening ---"

# 1. Run the TypeScript Verification Script using ts-node
echo "[Step 1] Executing Unit Test: verify_c1_controlnet.ts"
echo "Running in apps/workers context..."

# Using npx ts-node with tsconfig-paths/register to support path aliases if needed (though local file imports don't need it)
# We run from the root, pointing to the file, but we need to ensure ts-node is found.
# safely execute inside apps/workers to ensure dependencies are resolved
cd apps/workers
npx ts-node -r tsconfig-paths/register src/v3/render/verify_c1_controlnet.ts
TEST_EXIT_CODE=$?
cd ../..

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ PASS: Unit Test passed."
else
    echo "❌ FAIL: Unit Test failed."
    exit 1
fi

echo "--- [GATE ${GATE_ID}] SUCCESS ---"
