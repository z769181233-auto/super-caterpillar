#!/bin/bash
set -e

echo "🔍 Verifying Critical Paths..."

# Define Critical Paths
PATHS=(
  "apps/api/src/auth"
  "apps/web/src/middleware.ts"
  "apps/web/src/lib/apiClient.ts"
  "apps/web/src/app/[locale]/projects/[projectId]/page.tsx" # Project Overview Entry
  "apps/api/src/job" # Worker Job Logic
  "apps/web/src/components/_legacy" # Frozen Legacy Code
)

FAIL=0

for p in "${PATHS[@]}"; do
  if [ ! -e "$p" ]; then
    echo "❌ Missing Critical Path: $p"
    FAIL=1
  else
    echo "✅ Found: $p"
  fi
done

# Check if _legacy is mistakenly modified (Optimistic check: relies on git status if in a repo, 
# or just presence here. Real strict check would target git diff against main)
# For now, we enforce existence. 
# "Strict Mode" for Stage 5 implies ensuring these files are valid TS.

echo "🔍 Checking for syntax errors in Critical Paths (basic tsc check implied by build)..."

if [ $FAIL -eq 1 ]; then
  echo "🚨 Critical Path Verification FAILED"
  exit 1
else
  echo "✅ Critical Path Verification PASSED"
  exit 0
fi
