#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Stage6] Checking NonceService fallback guard..."

FILE="apps/api/src/auth/nonce.service.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Missing file: $FILE"
  exit 1
fi

# 必须包含 fallback 的关键标记（任选其一：TODO 标记 / warn 文案 / $queryRaw）
# 这里用三重断言，避免误报：
grep -q 'TODO(Stage5-P0):.*queryRaw fallback' "$FILE" || {
  echo "❌ Missing required marker: TODO(Stage5-P0): \$queryRaw fallback"
  exit 1
}

grep -q 'queryRaw' "$FILE" || {
  echo "❌ Missing required usage: \$queryRaw"
  exit 1
}

grep -q "NonceService.*fallback" "$FILE" || {
  echo "❌ Missing required log/wording about fallback (NonceService.*fallback)"
  exit 1
}

echo "✅ [Stage6] NonceService fallback guard OK"

