#!/bin/bash
set -euo pipefail

# gate_fullchain_minloop.sh
# 验证全链路引擎集成与数据完整性 (Text -> Visual -> Render -> QC)

echo "=== [GATE] Full-Chain Minloop Verification ==="

export NODE_ENV=test
export STORAGE_ROOT=".runtime"

# Ensure runtime directories
mkdir -p .runtime/assets .runtime/storage/qc

npx ts-node -T tools/run_fullchain_minloop.ts

echo "=== [GATE] PASS: Full-Chain Integrity Verified ==="
