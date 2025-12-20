#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPEC_DIR="$ROOT/docs/_specs"

need_files=(
  "$SPEC_DIR/INDEX.md"
  "$SPEC_DIR/REQUIRED_RULES.md"
)

for f in "${need_files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "[FAIL] missing required file: $f"
    exit 1
  fi
done

# 至少有 1 个真实规范文件（INDEX/REQUIRED_RULES 不算；TEMP 占位也不算）
real_count=$(find "$SPEC_DIR" -maxdepth 1 -type f \( -name "*.pdf" -o -name "*.md" \) \
  ! -name "INDEX.md" ! -name "REQUIRED_RULES.md" ! -name "00_TEMP_SPEC_PLACEHOLDER.md" \
  | wc -l | tr -d ' ')
if [ "$real_count" -lt 1 ]; then
  echo "[FAIL] no REAL spec documents found in $SPEC_DIR (TEMP placeholder does not count)"
  echo "       Put at least one real PDF/MD spec here, e.g. 01_*.pdf / 02_*.pdf"
  exit 1
fi

# 禁止 TEMP 还留在目录（避免“假通过”长期存在）
if [ -f "$SPEC_DIR/00_TEMP_SPEC_PLACEHOLDER.md" ]; then
  echo "[FAIL] TEMP placeholder still exists: $SPEC_DIR/00_TEMP_SPEC_PLACEHOLDER.md"
  echo "       Remove it after you add real specs."
  exit 1
fi

# REQUIRED_RULES 至少 10 个“来源：”
src_count=$(grep -o "来源：" "$SPEC_DIR/REQUIRED_RULES.md" | wc -l | tr -d ' ')
if [ "$src_count" -lt 10 ]; then
  echo "[FAIL] REQUIRED_RULES.md not strict enough (need >= 10 '来源：' entries)"
  exit 1
fi

# REQUIRED_RULES 的“来源：”必须引用 INDEX.md 里列出的真实文件名（防止乱写）
# 从 INDEX 里抽取 Files 段的文件名列表（排除 system files），使用 sed 以兼容 BSD/macOS
index_files=$(
  sed -n '/^## Files$/,/^## System Files (auto)$/p' "$SPEC_DIR/INDEX.md" \
    | sed '1d;$d;/^#/d;s/^- //;s/\r//;/^\s*$/d'
)

if [ -z "$index_files" ]; then
  echo "[FAIL] INDEX.md has empty Files section"
  exit 1
fi

# 逐个检查来源行是否包含至少一个 INDEX 文件名
missing=0
while IFS= read -r line; do
  echo "$line" | grep -q "来源：" || continue
  ok=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if echo "$line" | grep -Fq "$f"; then
      ok=1
      break
    fi
  done <<< "$index_files"

  if [ "$ok" -ne 1 ]; then
    echo "[FAIL] REQUIRED_RULES source does not reference any file in INDEX.md:"
    echo "       $line"
    missing=1
  fi
done < "$SPEC_DIR/REQUIRED_RULES.md"

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "[OK] doc gate passed"

