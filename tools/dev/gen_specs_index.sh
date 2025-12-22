#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPEC_DIR="$ROOT/docs/_specs"
OUT="$SPEC_DIR/INDEX.md"

if [ ! -d "$SPEC_DIR" ]; then
  echo "[FAIL] missing $SPEC_DIR"
  exit 1
fi

# macOS find lacks -printf; strip path with sed
files=$(find "$SPEC_DIR" -maxdepth 1 -type f \( -name "*.md" -o -name "*.pdf" \) -print \
  | sed 's|.*/||' \
  | sort || true)

# 规范文件列表：排除 INDEX/REQUIRED_RULES 自身
spec_files=$(echo "$files" | grep -vE '^(INDEX\.md|REQUIRED_RULES\.md)$' || true)

{
  echo "# Specs Index"
  echo ""
  echo "> 本目录放置所有“项目规范/说明书/执行顺序/安全规范/API 规范/引擎规范”等权威文档。"
  echo "> 任何开发必须先阅读这些文档，并在变更报告中引用对应条款。"
  echo ""
  echo "## Files"
  if [ -z "$spec_files" ]; then
    echo "- (none)"
  else
    while IFS= read -r f; do
      [ -n "$f" ] && echo "- $f"
    done <<< "$spec_files"
  fi
  echo ""
  echo "## System Files (auto)"
  echo "- INDEX.md"
  echo "- REQUIRED_RULES.md"
} > "$OUT"

echo "[OK] wrote $OUT"

