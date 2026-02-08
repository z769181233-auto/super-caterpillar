#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
FILE="$ROOT/tools/gate/run_launch_gates.sh"

echo "=== Negative Test: Gate17 must use ARTIFACT_DIR (single SSOT) ==="

# Gate17 块内如果出现 ART_DIR="$EVI_DIR/artifacts" 视为违规
if grep -nE 'ART_DIR="\$EVI_DIR/artifacts"' "$FILE" >/dev/null; then
  echo "❌ FAIL: Gate17 still hard-codes EVI_DIR/artifacts"
  grep -nE 'ART_DIR="\$EVI_DIR/artifacts"' "$FILE" || true
  exit 1
fi

# 必须出现 ART_DIR="$ARTIFACT_DIR"
if ! grep -nE 'ART_DIR="\$ARTIFACT_DIR"' "$FILE" >/dev/null; then
  echo "❌ FAIL: Gate17 does not bind ART_DIR to ARTIFACT_DIR"
  exit 1
fi

echo "✅ PASS: Gate17 uses ARTIFACT_DIR"
