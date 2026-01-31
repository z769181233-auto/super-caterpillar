#!/usr/bin/env bash
set -euo pipefail
EVI="${1:?usage: gate_p6_slo_latency.sh <evi_dir>}"
J="$EVI/slo_latency.json"
echo "[GATE-P6-0] checking $J"

jq -e '.p95_ms and .p99_ms and .p50_ms' "$J" >/dev/null
P95=$(jq -r '.p95_ms' "$J")
P99=$(jq -r '.p99_ms' "$J")

# Hard assertions
# 120s = 2 min
if [ "$P95" -gt 120000 ]; then
  echo "FAIL: P95 ($P95) > 120000"
  exit 1
fi
if [ "$P99" -gt 150000 ]; then
  echo "FAIL: P99 ($P99) > 150000"
  exit 1
fi

echo "PASS: p95_ms=$P95 p99_ms=$P99"
