#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# gate-audit_psql_dq_redline.sh
# 使用 Node.js 进行高保真 SQL 注入红线审计

fail() { echo "[SQL][FAIL] $*" >&2; exit 1; }
pass() { echo "[SQL][PASS] $*"; }

# 核心审计逻辑：使用 Node.js 确保变量识别的准确度
node <<'EOF'
const fs = require("fs");
const path = require("path");

const dir = "tools/gate/gates";
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith(".sh") && !f.startsWith("gate-audit_") && f !== "negative_tests.sh")
  .map(f => path.join(dir, f));

let hasError = false;

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) return;
    
    if (/\bpsql\b|\bpsqlq\b/.test(trimmed)) {
       if (/\$/.test(trimmed)) {
          // 豁免连接变量引用
          const isConnOnly = /^[^$]*(psql|psqlq)[[:space:]]+["']?\$[A-Z0-9_]+["']?([[:space:]]+-[^$]*)*$/.test(trimmed);
          
          if (!/\$gate\$/.test(trimmed) && !isConnOnly) {
            console.error(`[SQL][FAIL] ${f}:${i+1}: psql 缺失 $gate$ 标记。行: ${trimmed}`);
            hasError = true;
          }
       }
    }
  });
}
if (hasError) process.exit(1);
EOF

if [ $? -eq 0 ]; then
  pass "所有 gate 脚本中的 psql 调用均符合 Tagged Dollar-Quoting 规范。"
else
  exit 1
fi
