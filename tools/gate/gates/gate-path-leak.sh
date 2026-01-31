#!/bin/bash
# gate-path-leak.sh
# 路径泄露门禁：扫描数据库及日志中的绝对路径泄露 (SSOT 锁死版)

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

EVD_DIR=$(cat .current_evidence_dir 2>/dev/null || echo "docs/_evidence/path_leak_$(date +%Y%m%d_%H%M%S)")
mkdir -p "$EVD_DIR"
LOG_FILE="$EVD_DIR/PATH_LEAK_GATE.log"

echo "==== [GATE] Path Leak Scan Starting (Scope: SSOT Locked) ====" | tee "$LOG_FILE"

# 环境变量加载
set -a && source .env.local && set +a

LEAK_COUNT=0

# 1. 数据库扫描 (只读)
echo "[1/2] Scanning Database..." | tee -a "$LOG_FILE"

# 定义扫描靶点 (表名|主键名|字段名)
TARGETS=(
  "assets|id|storageKey"
  "shot_jobs|id|payload"
  "audit_logs|id|details"
)

for target in "${TARGETS[@]}"; do
  IFS='|' read -r TABLE PK FIELD <<< "$target"
  echo "  Scanning $TABLE.$FIELD..." | tee -a "$LOG_FILE"
  
  # 查找包含绝对路径的记录 (排除常见合法路径)
  # 掩码脱敏示例：/Users/adam/ -> /Users/***/
  QUERY="SELECT $PK, $FIELD FROM $TABLE WHERE $FIELD::text LIKE '%/Users/%' LIMIT 10;"
  HITS=$(psql -d "$DATABASE_URL" -t -A -c "$QUERY" 2>/dev/null || true)
  
  if [ -n "$HITS" ]; then
    echo "  [FOUND] Leaks in $TABLE.$FIELD:" | tee -a "$LOG_FILE"
    while IFS='|' read -r ID VAL; do
      LEAK_COUNT=$((LEAK_COUNT + 1))
      DESENSITIZED=$(echo "$VAL" | sed 's/\/Users\/[^\/]*\//\/Users\/***\//g')
      echo "    - PK: $ID | Sample: $DESENSITIZED" | tee -a "$LOG_FILE"
    done <<< "$HITS"
  fi
done

# 2. 运行时日志扫描
LOG_SCAN_DIR=".runtime/logs"
echo "[2/2] Scanning Runtime Logs ($LOG_SCAN_DIR)..." | tee -a "$LOG_FILE"

if [ -d "$LOG_SCAN_DIR" ]; then
  HITS=$(grep -r "/Users/" "$LOG_SCAN_DIR" --exclude-dir=node_modules | head -n 10 || true)
  if [ -n "$HITS" ]; then
    echo "  [FOUND] Leaks in Logs:" | tee -a "$LOG_FILE"
    while read -r line; do
      LEAK_COUNT=$((LEAK_COUNT + 1))
      DESENSITIZED=$(echo "$line" | sed 's/\/Users\/[^\/]*\//\/Users\/***\//g')
      echo "    - $DESENSITIZED" | tee -a "$LOG_FILE"
    done <<< "$HITS"
  fi
else
  echo "  [SKIP] $LOG_SCAN_DIR does not exist." | tee -a "$LOG_FILE"
fi

echo "==== [GATE] SUMMARY ====" | tee -a "$LOG_FILE"
echo "Total Leaks Found: $LEAK_COUNT" | tee -a "$LOG_FILE"

if [ "$LEAK_COUNT" -gt 0 ]; then
  echo "RESULT: FAIL (Absolute paths detected)" | tee -a "$LOG_FILE"
  exit 1
else
  echo "RESULT: PASS" | tee -a "$LOG_FILE"
  exit 0
fi
