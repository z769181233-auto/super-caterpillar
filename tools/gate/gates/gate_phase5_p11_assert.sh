#!/usr/bin/env bash
set -euo pipefail

EVI_DIR="docs/_evidence/phase5_p11_seal_finalize_20260208_205011"

echo "[1] evidence dir exists"
test -d "$EVI_DIR"

echo "[2] evidence_index exists"
test -f "$EVI_DIR/EVIDENCE_INDEX.md"

echo "[3] metrics endpoint reachable"
curl -fsS "http://localhost:3000/metrics" > "$EVI_DIR/metrics_snapshot.assert.txt"

echo "[4] histogram buckets present (duration)"
grep -qE "_bucket" "$EVI_DIR/metrics_snapshot.assert.txt" || (echo "FAIL: histogram missing" && exit 1)

echo "[5] unauthorized admin metrics must fail (401/403)"
set +e
STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/admin/metrics/p1")"
set -e
if [[ "$STATUS" != "401" && "$STATUS" != "403" ]]; then
  echo "FAIL: expected 401/403, got $STATUS"
  exit 1
fi
echo "PASS: unauthorized status = $STATUS"

echo "ALL PASS"
