#!/usr/bin/env bash
set -euo pipefail

echo "[GATE] Running Global Check for Processor IO Safety..."

# Gate B: Check ALL processors for readFileSync
# Exclude tests and internal tools

FOUND=$(grep -r "readFileSync" apps/workers/src/processors \
  --include="*.ts" \
  | grep -v "test.ts" \
  | grep -v "spec.ts" \
  | grep -v "stream_scan.ts" || true)

if [[ -n "${FOUND}" ]]; then
  echo "⛔ [GATE B] FAIL: readFileSync found in WORKER PROCESSORS"
  echo "${FOUND}"
  echo ""
  echo "Rationale: Processors must never block Event Loop. Use 'readFileUnderLimit' or streams."
  exit 2
else
  echo "✅ [GATE B] PASS: No readFileSync in Worker Processors."
  exit 0
fi
