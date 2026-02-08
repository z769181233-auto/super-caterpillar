#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-audit_psql_dq_redline.sh (Refactored to respect config)
fail() { echo "[SQL][FAIL] $*" >&2; exit 1; }
pass() { echo "[SQL][PASS] $*"; }

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"
[[ -f "$CONFIG" ]] || fail "Missing config: $CONFIG"

node <<'NODE_EOF'
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = "docs/_specs/governance/gov_post_sealed.config.json";
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const requirementEnabled = config.psql_dq.require_tagged_dq_if_psql_c_has_vars;

if (!requirementEnabled) {
  process.exit(0);
}

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
NODE_EOF

if [ $? -eq 0 ]; then
  pass "SQL data quality check passed (Config Aware)."
else
  exit 1
fi
