#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Stage6] Checking Prisma single-source constraint..."

# 1) apps/api 目录禁止任何 @prisma/client 引用（import / require / 文本）
# 排除 scripts 目录（Stage5 约束：scripts 目录例外）
if grep -R --line-number --fixed-strings "@prisma/client" "apps/api" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next \
  --exclude-dir=scripts --exclude="*.eslintrc.json"; then
  echo "❌ Forbidden reference detected: @prisma/client under apps/api"
  exit 1
fi

echo "✅ [Stage6] Prisma single-source constraint OK"

