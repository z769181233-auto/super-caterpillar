#!/usr/bin/env bash
set -euo pipefail
DIR="${1:-}"
test -n "$DIR" && test -d "$DIR" || { echo "Usage: gate_no_secrets_in_evidence.sh <evidence_dir>"; exit 2; }

echo "[GATE-SECRET] Auditing $DIR for sensitive tokens..."

# 扫描常见的敏感信息模式
if rg -n "(Bearer\s+|sk-|pk-|api[_-]?key|token=)" "$DIR"; then
  echo "[GATE-SECRET] FAIL: possible secret found in evidence"
  exit 2
fi

echo "[GATE-SECRET] PASS"
