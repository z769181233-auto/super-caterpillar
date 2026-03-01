#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

source "$ROOT/tools/dev/_lib/evidence_pipe.sh"

export API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
export API_KEY="${API_KEY:-ak_test_mj5h0knr}"
export API_SECRET="${API_SECRET:-3612e5bc385aaec44c3171156ee8a8be49aceb9ab1e6ce969ab7e0201674911c}"
export TEST_PROJECT_ID="${TEST_PROJECT_ID:-0445ea75-2178-4119-8e3b-4c67265561e2}"

echo "ROOT=$ROOT"
echo "API_BASE_URL=$API_BASE_URL"
echo "TEST_PROJECT_ID=$TEST_PROJECT_ID"

# 1) 确保 3000 不被占用
echo "== Check port 3000 =="
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ Port 3000 is already in use:"
  lsof -nP -iTCP:3000 -sTCP:LISTEN || true
  exit 1
fi

# 2) 启动 API（后台）并写日志
echo "== Start API (pnpm --filter api dev) =="
rm -f /tmp/api_dev.log
( pnpm --filter api dev 2>&1 | tee /tmp/api_dev.log ) &
API_PID=$!
echo "API_PID=$API_PID"

# 3) 等待健康：优先等端口监听，其次探测路由（不再 404）
echo "== Wait for API listening on 3000 =="
for i in $(seq 1 60); do
  if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✅ Port 3000 is listening (t=$i)"
    break
  fi
  sleep 1
done

if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ API did not start listening within 60s."
  echo "Last 120 lines of /tmp/api_dev.log:"
  tail -n 120 /tmp/api_dev.log || true
  kill -9 "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "== Probe routes (must NOT be 404) =="
probe() {
  local url="$1"
  local code
  code="$(curl -s -o /tmp/probe.out -w '%{http_code}' -X POST "$url" -H 'Content-Type: application/json' -d '{}' || true)"
  echo "POST $url -> $code"
  if [[ "$code" == "404" ]]; then
    echo "❌ Route still 404. Output:"
    cat /tmp/probe.out || true
    return 1
  fi
  return 0
}

probe "$API_BASE_URL/api/story/parse"
probe "$API_BASE_URL/api/text/visual-density"
probe "$API_BASE_URL/api/text/enrich"

# 4) 运行 smoke（包含 /api/jobs/:id/report 触发质量闭环）
echo "== Run smoke test =="
pnpm -w dlx tsx tools/smoke/ce-core-commercialization-smoke.ts | tee /tmp/ce_core_smoke.log

# 5) 查询 DB（只读）
echo "== Query verification data (DB read-only) =="
node tools/smoke/query-verification-data.js | tee /tmp/ce_core_db_verify.log

# 6) 回填报告（追加证据块）
echo "== Append evidence to report =="
REPORT="docs/CE_CORE_COMMERCIALIZATION_VERIFICATION_REPORT.md"
{
  echo ''
  echo '## 运行时验证实际输出（自动采集）'
  echo ''
  echo '### API 启动日志（尾部 120 行）'
  echo '```'
  tail -n 120 /tmp/api_dev.log || true
  echo '```'
  echo ''
  echo '### Smoke 输出（头 260 行）'
  echo '```'
  sed -n '1,260p' /tmp/ce_core_smoke.log || true
  echo '```'
  echo ''
  echo '### DB Verify 输出（头 320 行）'
  echo '```'
  sed -n '1,320p' /tmp/ce_core_db_verify.log || true
  echo '```'
} | evidence_pipe "" >> "$REPORT"

echo "✅ Runtime verification completed."
echo "Artifacts:"
echo "  /tmp/api_dev.log"
echo "  /tmp/ce_core_smoke.log"
echo "  /tmp/ce_core_db_verify.log"
echo "  $REPORT"

# 7) 结束 API（避免占用端口影响后续）
echo "== Stop API =="
kill -15 "$API_PID" 2>/dev/null || true
sleep 1
kill -9 "$API_PID" 2>/dev/null || true


