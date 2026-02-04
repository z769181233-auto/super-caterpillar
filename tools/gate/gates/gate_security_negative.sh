#!/bin/bash
set -e

# P6-0-5: Negative Tests (Security Degradation Check)
echo "===================================================="
echo "P6-0-5 NEGATIVE SECURITY TESTS"
echo "===================================================="

# Ensure tools/test_p6_0_2.ts exists
if [ ! -f "tools/test_p6_0_2.ts" ]; then
    echo "❌ Error: tools/test_p6_0_2.ts not found."
    exit 1
fi

echo "Running Security Loop Negative Tests..."
# Run the TS script which asserts 401/403 for bad requests
npx ts-node tools/test_p6_0_2.ts

echo "✅ P6-0-5 PASSED: All negative security assertions verified."
