#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENTRY="tools/smoke/stage1_stage2_smoke.ts"
HC="tools/smoke/helpers/health_check.ts"
HR="tools/smoke/helpers/hmac_request.ts"
RB="tools/smoke/helpers/response_body.ts"

err() {
  echo "ERROR: $*" >&2
  exit 1
}

say() {
  echo "[verify] $*"
}

say "root=$ROOT"
say "entry=$ENTRY"
say "expected:"
say "  $HC"
say "  $HR"
say "  $RB"

# 0) 基础存在性检查
[ -f "$ENTRY" ] || err "entry not found: $ENTRY"
[ -f "$HC" ] || err "expected file not found: $HC"
[ -f "$HR" ] || err "expected file not found: $HR"
[ -f "$RB" ] || err "expected file not found: $RB"

# 1) 同名文件唯一性（防止 shadowing）
say "unique file check..."
for f in "health_check.ts" "hmac_request.ts" "response_body.ts"; do
  # 排除 node_modules / .git；兼容空格路径
  matches="$(find . -type f -name "$f" \
    -not -path "./node_modules/*" \
    -not -path "./.git/*" \
    2>/dev/null || true)"
  cnt="$(printf '%s\n' "$matches" | sed '/^\s*$/d' | wc -l | tr -d ' ')"
  if [ "$cnt" != "1" ]; then
    echo "$matches" >&2
    err "$f appears $cnt times (expected 1)."
  fi
done

# 2) 关键标识串唯一性（防止重复定义/复制残留）
say "unique markers..."
test "$(grep -F -c "Health Check Helper" "$HC" || echo "0")" = "1" || err "marker 'Health Check Helper' not unique in $HC"
test "$(grep -F -c "export async function checkHealth" "$HC" || echo "0")" = "1" || err "signature 'checkHealth' not unique in $HC"

test "$(grep -F -c "HMAC Request Helper" "$HR" || echo "0")" = "1" || err "marker 'HMAC Request Helper' not unique in $HR"
test "$(grep -F -c "export async function makeHmacRequest" "$HR" || echo "0")" = "1" || err "signature 'makeHmacRequest' not unique in $HR"

# 3) 入口 import 约束：必须从 ./helpers/... 导入（兼容单双引号，兼容可选 .ts）
say "entry import constraints..."
grep -Eq "from[[:space:]]+['\"]\.\/helpers\/health_check(\.ts)?['\"]" "$ENTRY" \
  || err "entry must import health_check from ./helpers (not found in $ENTRY)"

grep -Eq "from[[:space:]]+['\"]\.\/helpers\/hmac_request(\.ts)?['\"]" "$ENTRY" \
  || err "entry must import hmac_request from ./helpers (not found in $ENTRY)"

say "OK"
