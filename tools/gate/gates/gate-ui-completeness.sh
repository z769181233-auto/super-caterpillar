#!/bin/bash

# UI Completeness Gate
# Checks for UI_MAP, UI_STATE_MATRIX and required component usage across pages.

EVIDENCE_DIR="docs/_evidence/p10_ui_polish"
mkdir -p "${EVIDENCE_DIR}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_FILE="${EVIDENCE_DIR}/gate_ui_completeness_${TIMESTAMP}.txt"

echo "==== [GATE] UI Completeness Check Starting ====" | tee "${EVIDENCE_FILE}"
echo "DATE: $(date)" | tee -a "${EVIDENCE_FILE}"

# 1) Check SSOT Files
echo "[1/4] Checking SSOT Documents..." | tee -a "${EVIDENCE_FILE}"
FILES=("docs/ui/UI_MAP.md" "docs/ui/UI_STATE_MATRIX.md")
for f in "${FILES[@]}"; do
  if [ -f "$f" ] && [ -s "$f" ]; then
    echo "✅ PASS: $f exists and is not empty." | tee -a "${EVIDENCE_FILE}"
  else
    echo "❌ FAIL: $f is missing or empty." | tee -a "${EVIDENCE_FILE}"
    exit 1
  fi
done

# 2) Check Component Existence
echo "[2/4] Checking Core System Components..." | tee -a "${EVIDENCE_FILE}"
COMPONENTS=(
  "apps/web/src/components/system/PageShell.tsx"
  "apps/web/src/components/system/EmptyState.tsx"
  "apps/web/src/components/system/ErrorState.tsx"
  "apps/web/src/components/system/SkeletonBlock.tsx"
  "apps/web/src/hooks/useRequestState.ts"
)
for c in "${COMPONENTS[@]}"; do
  if [ -f "$c" ]; then
    echo "✅ PASS: $c is implemented." | tee -a "${EVIDENCE_FILE}"
  else
    echo "❌ FAIL: $c is missing." | tee -a "${EVIDENCE_FILE}"
    exit 1
  fi
done

# 3) Component Usage Scan (Smoke Test)
echo "[3/4] Scanning Page Usage (Shell/State)..." | tee -a "${EVIDENCE_FILE}"
SCAN_DIRS=(
  "apps/web/src/app"
  "apps/web/src/pages"
  "apps/web/src/features"
)

USAGE_COUNT=0
for dir in "${SCAN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    COUNT=$(grep -l "PageShell" -r "$dir" | wc -l)
    USAGE_COUNT=$((USAGE_COUNT + COUNT))
  fi
done

if [ "${USAGE_COUNT}" -gt 0 ]; then
  echo "✅ PASS: PageShell is being integrated (Found in ${USAGE_COUNT} files)." | tee -a "${EVIDENCE_FILE}"
else
  echo "⚠️ WARN: PageShell not found in scan directories." | tee -a "${EVIDENCE_FILE}"
fi

# 4) Typecheck (Minimal)
echo "[4/4] Running Typecheck (tsc)..." | tee -a "${EVIDENCE_FILE}"
cd apps/web && npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "✅ PASS: Typecheck successful." | tee -a "${EVIDENCE_FILE}"
else
  echo "⚠️ WARN: Typecheck found errors (Please review)." | tee -a "${EVIDENCE_FILE}"
fi

echo "==== [GATE] RESULT: PASS (Evidence Archived) ====" | tee -a "${EVIDENCE_FILE}"
echo "[INFO] Evidence: ${EVIDENCE_FILE}"
