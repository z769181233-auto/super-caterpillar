#!/bin/bash
# gate_no_physical_logic_in_processors.sh
# 审计 Worker 处理器中是否还残留直接调用 FFmpeg/Say/Spawn 等物理执行代码

TARGET_DIR="apps/workers/src/processors"
echo "[GATE] Auditing Physical Logic in $TARGET_DIR..."

FORBIDDEN_KEYWORDS=(
  "spawn("
  "spawnSync("
  "execSync("
  "ffmpeg"
  "say"
  "espeak"
)

HITS=0

for KEYWORD in "${FORBIDDEN_KEYWORDS[@]}"; do
  # 搜索时排除已经 Hub 化的处理器（如果需要例外，但目前目标是 100% 剥离）
  MATCHES=$(grep -rn "$KEYWORD" "$TARGET_DIR" --exclude-dir=node_modules | grep -v "//" | grep -v "/*")
  
  if [ ! -z "$MATCHES" ]; then
    echo "❌ ERROR: Residual physical logic '$KEYWORD' found in processors:"
    echo "$MATCHES"
    HITS=$((HITS + 1))
  fi
done

if [ $HITS -gt 0 ]; then
  echo "❌ [FAIL] Physical logic audit failed. Processors MUST use EngineHub."
  exit 1
else
  echo "✅ [PASS] All physical logic stripped from processors (Hub-only Architecture)."
  exit 0
fi
