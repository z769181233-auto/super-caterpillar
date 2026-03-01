#!/bin/bash
# gate_no_sync_in_adapters.sh
# 审计所有 Engine Adapters 是否存在同步阻塞 IO (readFileSync, spawnSync 等)

TARGET_DIR="apps/api/src/engines/adapters"
echo "[GATE] Scanning for Sync IO in $TARGET_DIR..."

# 禁止的关键字列表
FORBIDDEN_KEYWORDS=(
  "readFileSync"
  "writeFileSync"
  "copyFileSync"
  "existsSync"
  "statSync"
  "mkdirSync"
  "spawnSync"
  "execSync"
  "unlinkSync"
  "rmSync"
)

HITS=0

for KEYWORD in "${FORBIDDEN_KEYWORDS[@]}"; do
  # 使用 grep 查找，排除注释行（简单匹配）
  # -r 递归, -n 行号, -w 全词匹配, -E 正则
  MATCHES=$(grep -rnw "$TARGET_DIR" -e "$KEYWORD" --exclude-dir=node_modules | grep -v "//" | grep -v "/*")
  
  if [ ! -z "$MATCHES" ]; then
    echo "❌ ERROR: Forbidden Sync IO '$KEYWORD' found in adapters:"
    echo "$MATCHES"
    HITS=$((HITS + 1))
  fi
done

if [ $HITS -gt 0 ]; then
  echo "❌ [FAIL] Sync IO audit failed. Adapters MUST use async IO."
  exit 1
else
  echo "✅ [PASS] No sync IO found in adapters."
  exit 0
fi
