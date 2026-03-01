#!/usr/bin/env bash
set -euo pipefail

echo "[GATE] Running Static Check for Ingest Memory Safety..."

# Define pattern: readFileSync inside specific directories/files related to ingest
# Exclude test files, migration files, or script files if necessary
# We target 'apps', 'packages' but explicitly look for 'ingest', 'scan', 'processor' keywords in content or path

# Method:
# 1. Search for 'readFileSync' in all TS files.
# 2. Filter for files that seem to be production ingest logic.

# Strict Ingest Gate (Gate A)
# Only key patterns: novel-*.ts or packages/ingest

FOUND=$(grep -r "readFileSync" apps/workers/src/processors/novel-*.ts packages/ingest \
  --include="*.ts" \
  | grep -v "test.ts" \
  | grep -v "spec.ts" \
  | grep -v "stream_scan.ts" || true)

if [[ -n "${FOUND}" ]]; then
  echo "[GATE A] FAIL: readFileSync found in INGEST Critical Path"
  echo "$VIOLATIONS"
  echo ""
  echo "Rationale: Ingest must be streaming to handle 3M+ words. Use fs.createReadStream."
  exit 1
else
  echo "✅ [GATE] PASS: No readFileSync found in Ingest Critical Path."
  exit 0
fi
