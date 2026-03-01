#!/usr/bin/env bash
set -euo pipefail

# [GATE-C] 扫描 Processor 目录，禁止任何 Sync IO
echo "[GATE-C] Scanning for forbidden Sync IO in processors..."

# 关注点：readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync
FOUND=$(rg -n "\\w+Sync\\(" apps/workers/src/processors packages --glob "**/*processor*.ts" --glob "!**/*.test.*" || true)

if [[ -n "${FOUND}" ]]; then
  echo "❌ FAIL: Sync FS/API detected in critical path:"
  echo "${FOUND}"
  exit 2
fi

echo "✅ PASS: No Sync IO detected in processors."
