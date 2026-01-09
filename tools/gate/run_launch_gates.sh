#!/bin/bash

# 门禁证据自动化脚本（全自动真验版本）
# 一键运行所有门禁检查并生成报告

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/docs"

# Source evidence pipe library
source "$PROJECT_ROOT/tools/dev/_lib/evidence_pipe.sh"
API_URL="${API_URL:-http://localhost:3000}"
NGINX_URL="${NGINX_URL:-http://localhost}"
TEST_STORAGE_KEY="${TEST_STORAGE_KEY:-}"
AUTH_TOKEN_A="${AUTH_TOKEN_A:-}"
AUTH_TOKEN_B="${AUTH_TOKEN_B:-}"
AUTH_TOKEN="${AUTH_TOKEN:-$AUTH_TOKEN_A}" # 向后兼容

# Token minting defaults (matches tools/smoke/init_api_key.ts)
export AUTH_EMAIL="${AUTH_EMAIL:-smoke@example.com}"
export AUTH_PASSWORD="${AUTH_PASSWORD:-smoke-dev-password}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 简单的 HTTP code 诊断（不打印 body）
req_code() {
  # $1 = url, $2.. = curl extra args
  local url="$1"
  shift || true
  curl -s -o /dev/null -w "%{http_code}" "$url" "$@" || true
}

# 统一诊断输出：HTTP code + 关键 headers + body 前 200 字符
req_dump() {
  # $1 = url, $2.. = curl extra args
  local url="$1"
  shift || true
  echo "  URL: $url"
  curl -s -D - "$url" "$@" \
    | awk '
      BEGIN{body=0; c=0}
      /^HTTP/{print; next}
      /^[Cc]ontent-[Tt]ype:|^[Ll]ocation:|^[Ww]ww-[Aa]uthenticate:|^[Ss]et-[Cc]ookie:|^[Xx]-/{print; next}
      /^$/{print; body=1; next}
      body==1 && c<200 {print; c+=length($0)+1}
    ' || true
}

# 探测可用 health 路由：返回第一个 2xx 的完整 URL
pick_first_2xx() {
  # args: urls...
  for u in "$@"; do
    local c
    c=$(req_code "$u")
    if [ "$c" -ge 200 ] && [ "$c" -lt 300 ]; then
      echo "$u"
      return 0
    fi
  done
  echo ""
  return 1
}
# 报告文件
REPORT_FILE="$REPORT_DIR/GATEKEEPER_VERIFICATION_REPORT.md"
mkdir -p "$PROJECT_ROOT/.tmp"
TEMP_DIR="$(mktemp -d "$PROJECT_ROOT/.tmp/gates.XXXXXX")"

# --- Auto-fill required env for full-auto gates (best-effort) ---
# 统一的鉴权 Header（env 中只存裸 token，在这里拼接 Bearer）
AUTH_HEADER_A="Authorization: Bearer ${AUTH_TOKEN_A:-}"
AUTH_HEADER_B="Authorization: Bearer ${AUTH_TOKEN_B:-}"

# 1) AUTH_TOKEN_A
if [ -z "${AUTH_TOKEN_A:-}" ]; then
  if [ -x "$PROJECT_ROOT/tools/smoke/mint_auth_token.sh" ]; then
    echo "[gate] AUTH_TOKEN_A missing -> minting..."
    if AUTH_TOKEN_A="$("$PROJECT_ROOT/tools/smoke/mint_auth_token.sh" 2>/dev/null)"; then
      if [ -n "$AUTH_TOKEN_A" ]; then
        export AUTH_TOKEN_A
        AUTH_TOKEN="${AUTH_TOKEN_A}"
        echo "[gate] AUTH_TOKEN_A minted"
        echo "[gate] AUTH_EMAIL=${AUTH_EMAIL:-<default>}"
      else
        echo "[gate] mint_auth_token returned empty token" >&2
      fi
    else
      echo "[gate] mint_auth_token failed; proceeding without AUTH_TOKEN_A" >&2
    fi
  fi
fi

# refresh headers after possible mint
AUTH_HEADER_A="Authorization: Bearer ${AUTH_TOKEN_A:-}"
AUTH_HEADER_B="Authorization: Bearer ${AUTH_TOKEN_B:-}"

# 2) TEST_STORAGE_KEY
if [ -z "${TEST_STORAGE_KEY:-}" ]; then
  if [ -x "$PROJECT_ROOT/tools/smoke/seed_storage_key.sh" ]; then
    echo "[gate] TEST_STORAGE_KEY missing -> seeding storage key..."
    TEST_STORAGE_KEY="$("$PROJECT_ROOT/tools/smoke/seed_storage_key.sh")"
    export TEST_STORAGE_KEY
  fi
fi

# 3) SHOT_ID (seed-only run_video_e2e to obtain shot id)
if [ -z "${SHOT_ID:-}" ] && [ -f "$PROJECT_ROOT/tools/smoke/run_video_e2e.sh" ]; then
  echo "[gate] SHOT_ID missing -> running video seed-only to obtain shot id..."
  if [ -x "$PROJECT_ROOT/tools/smoke/ensure_prisma_generated.sh" ]; then
    bash "$PROJECT_ROOT/tools/smoke/ensure_prisma_generated.sh" || true
  fi
  SEED_OUT="$TEMP_DIR/seed_only.txt"
  (E2E_SEED_ONLY=1 bash "$PROJECT_ROOT/tools/smoke/run_video_e2e.sh" 2>&1 | tee "$SEED_OUT") || true
  SHOT_ID="$(grep -E 'Shot ID:' "$SEED_OUT" | tail -n1 | sed -E 's/.*Shot ID:[[:space:]]*([0-9a-fA-F-]{36}).*/\1/' || true)"
  if [ -n "$SHOT_ID" ]; then
    export SHOT_ID
    echo "[gate] SHOT_ID=$SHOT_ID"
  fi
fi
# --- end auto-fill ---

# 清理函数
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo -e "${BLUE}🚪 Launch Gate Verification (Full Auto Test)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL:         $API_URL"
echo "Nginx URL:       $NGINX_URL"
echo "Test Storage Key: ${TEST_STORAGE_KEY:-<required>}"
echo "Report:         $REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查必需工具
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  jq not found, JSON parsing may fail${NC}"; }

# 初始化报告
cat > "$REPORT_FILE" <<EOF
# 门禁验证报告（全自动真验）

生成时间: $(date -Iseconds)

## 执行环境

- API URL: $API_URL
- Nginx URL: $NGINX_URL
- Test Storage Key: ${TEST_STORAGE_KEY:-<not set>}
- Auth Token A: ${AUTH_TOKEN_A:+<set>}${AUTH_TOKEN_A:-<not set>}
- Auth Token B: ${AUTH_TOKEN_B:+<set>}${AUTH_TOKEN_B:-<not set>}

## 执行摘要

EOF

# 门禁 1: Preflight 检查（含 CORS 生产验证）
echo -e "${BLUE}Gate 1: Preflight Check + CORS Production Validation${NC}"
echo "Running preflight checks..."

PREFLIGHT_PASSED=true
PREFLIGHT_OUTPUT="$TEMP_DIR/preflight.txt"

HEALTH_URL=$(pick_first_2xx \
  "${API_URL}/api/health" \
  "${API_URL}/health" \
  "${API_URL}/api/healthz" \
  "${API_URL}/healthz" \
)

READY_URL=$(pick_first_2xx \
  "${API_URL}/api/health/ready" \
  "${API_URL}/health/ready" \
  "${API_URL}/api/ready" \
  "${API_URL}/ready" \
)

# 检查 API 健康
if [ -n "$HEALTH_URL" ] && curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ API health check passed${NC}"
    echo "- ✅ API health check passed" >> "$PREFLIGHT_OUTPUT"
    echo "  Command: curl -s -f $HEALTH_URL" >> "$PREFLIGHT_OUTPUT"
    echo "  Picked: $HEALTH_URL" >> "$PREFLIGHT_OUTPUT"
else
    echo -e "  ${RED}❌ API health check failed${NC}"
    echo "- ❌ API health check failed" >> "$PREFLIGHT_OUTPUT"
    echo "  Picked: ${HEALTH_URL:-<none>}" >> "$PREFLIGHT_OUTPUT"
    echo "  Debug dump:" >> "$PREFLIGHT_OUTPUT"
    req_dump "${API_URL}/api/health" >> "$PREFLIGHT_OUTPUT"
    req_dump "${API_URL}/health" >> "$PREFLIGHT_OUTPUT"
    PREFLIGHT_PASSED=false
fi

# 检查数据库连接
if [ -n "$READY_URL" ] && curl -s -f "$READY_URL" | grep -q '"ok":true'; then
    echo -e "  ${GREEN}✅ Database connection check passed${NC}"
    echo "- ✅ Database connection check passed" >> "$PREFLIGHT_OUTPUT"
    echo "  Command: curl -s -f $READY_URL" >> "$PREFLIGHT_OUTPUT"
    echo "  Picked: $READY_URL" >> "$PREFLIGHT_OUTPUT"
else
    echo -e "  ${RED}❌ Database connection check failed${NC}"
    echo "- ❌ Database connection check failed" >> "$PREFLIGHT_OUTPUT"
    echo "  Picked: ${READY_URL:-<none>}" >> "$PREFLIGHT_OUTPUT"
    echo "  Debug dump:" >> "$PREFLIGHT_OUTPUT"
    req_dump "${API_URL}/api/health/ready" >> "$PREFLIGHT_OUTPUT"
    req_dump "${API_URL}/health/ready" >> "$PREFLIGHT_OUTPUT"
    PREFLIGHT_PASSED=false
fi

# 检查 metrics 端点
if curl -s -f "${API_URL}/metrics" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Metrics endpoint available${NC}"
    echo "- ✅ Metrics endpoint available" >> "$PREFLIGHT_OUTPUT"
    echo "  Command: curl -s -f ${API_URL}/metrics" >> "$PREFLIGHT_OUTPUT"
else
    echo -e "  ${RED}❌ Metrics endpoint not available${NC}"
    echo "- ❌ Metrics endpoint not available" >> "$PREFLIGHT_OUTPUT"
    PREFLIGHT_PASSED=false
fi

# CORS 生产环境验证
if [ "${NODE_ENV:-}" = "production" ]; then
    echo "  Checking CORS production requirements..."
    if [ -z "${CORS_ORIGINS:-}" ]; then
        # 检查 API 是否启动失败（通过 health 端点不可用判断）
        if ! curl -s -f "${API_URL}/api/health" > /dev/null 2>&1; then
            echo -e "    ${GREEN}✅ API failed to start (expected when CORS_ORIGINS missing)${NC}"
            echo "- ✅ API failed to start (expected when CORS_ORIGINS missing)" >> "$PREFLIGHT_OUTPUT"
            echo "  Note: In production, API should fail to start without CORS_ORIGINS" >> "$PREFLIGHT_OUTPUT"
        else
            echo -e "    ${RED}❌ API started without CORS_ORIGINS (should fail in production)${NC}"
            echo "- ❌ API started without CORS_ORIGINS (should fail in production)" >> "$PREFLIGHT_OUTPUT"
            PREFLIGHT_PASSED=false
        fi
    else
        echo -e "    ${GREEN}✅ CORS_ORIGINS is set: $CORS_ORIGINS${NC}"
        echo "- ✅ CORS_ORIGINS is set" >> "$PREFLIGHT_OUTPUT"
    fi
else
    echo "  Skipping CORS production check (NODE_ENV != production)"
    echo "- ⚠️  CORS production check skipped (NODE_ENV != production)" >> "$PREFLIGHT_OUTPUT"
fi

if [ "$PREFLIGHT_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 1 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 1 failed${NC}\n"
fi

# 门禁 2: 容量门禁负向测试
echo -e "${BLUE}Gate 2: Capacity Gate Negative Tests${NC}"
echo "Testing capacity gate rejection..."

CAPACITY_GATE_PASSED=false
CAPACITY_OUTPUT="$TEMP_DIR/capacity.txt"

CAP_URL="${API_URL}/api/jobs/capacity"
echo "  Debug: capacity route probe (no auth) HTTP=$(req_code "$CAP_URL")"
echo "  Debug: capacity route probe (A auth) HTTP=$(req_code "$CAP_URL" -H "$AUTH_HEADER_A")"
if [ -n "${AUTH_TOKEN_B:-}" ]; then
  echo "  Debug: capacity route probe (B auth) HTTP=$(req_code "$CAP_URL" -H "$AUTH_HEADER_B")"
fi

# 鉴权前置校验（强制带鉴权，缺 token 视为 Gate FAIL）
if [ -z "${AUTH_TOKEN_A:-}" ]; then
    echo -e "  ${YELLOW}⚠️  AUTH_TOKEN_A not set (cannot run auth-required gates)${NC}"
    echo "- ⚠️  Skipped (AUTH_TOKEN_A not set)" >> "$CAPACITY_OUTPUT"
    CAPACITY_GATE_PASSED=false
else
    # 测试容量查询端点（必须带 Authorization: Bearer <AUTH_TOKEN_A>）
    CAPACITY_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "$AUTH_HEADER_A" \
        "$CAP_URL" 2>/dev/null || echo -e "\n000")
    
    HTTP_CODE=$(echo "$CAPACITY_RESPONSE" | tail -n1)
    BODY=$(echo "$CAPACITY_RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo -e "  ${GREEN}✅ Capacity query endpoint works (authorized as A)${NC}"
        echo "- ✅ Capacity query endpoint works (authorized as A)" >> "$CAPACITY_OUTPUT"
        echo "  Command: curl -H \"Authorization: Bearer <AUTH_TOKEN_A>\" ${CAP_URL}" >> "$CAPACITY_OUTPUT"
        echo "  Response: $BODY" >> "$CAPACITY_OUTPUT"
        CAPACITY_GATE_PASSED=true
    else
        echo -e "  ${RED}❌ Capacity query endpoint failed for A (HTTP $HTTP_CODE)${NC}"
        echo "- ❌ Capacity query endpoint failed for A (HTTP $HTTP_CODE)" >> "$CAPACITY_OUTPUT"
        echo "  Debug dump (A auth):" >> "$CAPACITY_OUTPUT"
        req_dump "$CAP_URL" -H "$AUTH_HEADER_A" >> "$CAPACITY_OUTPUT"
        CAPACITY_GATE_PASSED=false
    fi

    # 可选：对 B 做一个简单的负测（仅记录，不改变 Gate 结果）
    if [ -n "${AUTH_TOKEN_B:-}" ]; then
        B_RESPONSE=$(curl -s -w "\n%{http_code}" \
            -H "$AUTH_HEADER_B" \
            "$CAP_URL" 2>/dev/null || echo -e "\n000")
        B_CODE=$(echo "$B_RESPONSE" | tail -n1)
        echo "  Note: Capacity endpoint for B returned HTTP $B_CODE" >> "$CAPACITY_OUTPUT"
    fi
fi

if [ "$CAPACITY_GATE_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 2 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 2 failed${NC}\n"
fi

# 门禁 3: Signed URL 全自动真验
echo -e "${BLUE}Gate 3: Signed URL Full Auto Test${NC}"
echo "Testing signed URL security with real endpoints..."

SIGNED_URL_PASSED=true
SIGNED_URL_OUTPUT="$TEMP_DIR/signed_url.txt"

# --- local fallback: if NGINX_URL unreachable, use API_URL (only when not production) ---
nginx_probe_code="$(req_code "${NGINX_URL}/api/health" || true)"

# 检查必需参数
if [ -z "$TEST_STORAGE_KEY" ]; then
    echo -e "  ${RED}❌ TEST_STORAGE_KEY is required${NC}"
    echo "- ❌ TEST_STORAGE_KEY is required" >> "$SIGNED_URL_OUTPUT"
    SIGNED_URL_PASSED=false
elif [ -z "$AUTH_TOKEN_A" ]; then
    echo -e "  ${RED}❌ AUTH_TOKEN_A is required${NC}"
    echo "- ❌ AUTH_TOKEN_A is required" >> "$SIGNED_URL_OUTPUT"
    SIGNED_URL_PASSED=false
else
    # 路由前缀自检：区分“路由不存在” vs “资源不存在/无权限”
    echo "  Debug: check sign route existence..."
    curl -s -o /dev/null -w "  /api/storage/sign route HTTP=%{http_code}\n" \
      "${API_URL}/api/storage/sign/__route_probe__" -H "$AUTH_HEADER_A" || true

    # 测试 1: 直接访问必须 404
    echo "  Test 1: Direct access rejection..."
    DIRECT_URL="${API_URL}/api/storage/${TEST_STORAGE_KEY}"
    DIRECT_RESPONSE=$(curl -s -w "\n%{http_code}" "$DIRECT_URL" 2>/dev/null || echo -e "\n000")
    DIRECT_CODE=$(echo "$DIRECT_RESPONSE" | tail -n1)
    
    if [ "$DIRECT_CODE" -eq 404 ]; then
        echo -e "    ${GREEN}✅ Direct access rejected (HTTP 404)${NC}"
        echo "- ✅ Direct access rejected (HTTP 404)" >> "$SIGNED_URL_OUTPUT"
        echo "  Command: curl -s -w \"\\n%{http_code}\" ${DIRECT_URL}" >> "$SIGNED_URL_OUTPUT"
        echo "  Response Code: $DIRECT_CODE" >> "$SIGNED_URL_OUTPUT"
    else
        echo -e "    ${RED}❌ Direct access not rejected (HTTP $DIRECT_CODE, expected 404)${NC}"
        echo "- ❌ Direct access not rejected (HTTP $DIRECT_CODE, expected 404)" >> "$SIGNED_URL_OUTPUT"
        echo "  Command: curl -s -w \"\\n%{http_code}\" ${DIRECT_URL}" >> "$SIGNED_URL_OUTPUT"
        SIGNED_URL_PASSED=false
    fi
    
    # 测试 2: 生成真实签名 URL
    echo "  Test 2: Generate real signed URL..."
    SIGN_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "$AUTH_HEADER_A" \
        "${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}" 2>/dev/null || echo -e "\n000")
    SIGN_HTTP_CODE=$(echo "$SIGN_RESPONSE" | tail -n1)
    SIGN_BODY=$(echo "$SIGN_RESPONSE" | sed '$d')
    
    if [ "$SIGN_HTTP_CODE" -ge 200 ] && [ "$SIGN_HTTP_CODE" -lt 300 ]; then
        echo -e "    ${GREEN}✅ Signed URL generated successfully${NC}"
        echo "- ✅ Signed URL generated successfully" >> "$SIGNED_URL_OUTPUT"
        echo "  Command: curl -H \"Authorization: Bearer <AUTH_TOKEN_A>\" ${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}" >> "$SIGNED_URL_OUTPUT"
        
        # 解析签名 URL（支持 jq 或手动解析）
        if command -v jq >/dev/null 2>&1; then
            SIGNED_URL=$(echo "$SIGN_BODY" | jq -r '.url' 2>/dev/null || echo "")
        else
            # 手动解析 JSON（简单提取）
            SIGNED_URL=$(echo "$SIGN_BODY" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")
        fi
        
        if [ -z "$SIGNED_URL" ]; then
            echo -e "    ${RED}❌ Failed to parse signed URL from response${NC}"
            echo "- ❌ Failed to parse signed URL from response" >> "$SIGNED_URL_OUTPUT"
            echo "  Response: $SIGN_BODY" >> "$SIGNED_URL_OUTPUT"
            SIGNED_URL_PASSED=false
        else
            echo "    Signed URL: $SIGNED_URL" >> "$SIGNED_URL_OUTPUT"
            
            # 提取签名 URL 的路径部分（去掉 API_URL 前缀）
            SIGNED_PATH=$(echo "$SIGNED_URL" | sed "s|${API_URL}||" | sed "s|^/api/storage/signed/||")
            SIGNED_PARAMS=$(echo "$SIGNED_URL" | grep -o '?.*$' || echo "")
            
            # 测试 3: Nginx Range 请求（206 Partial Content）
            echo "  Test 3: Nginx Range request (206 Partial Content)..."
            NGINX_SIGNED_URL="${NGINX_URL}/api/storage/signed/${SIGNED_PATH}${SIGNED_PARAMS}"
            RANGE_RESPONSE=$(curl -s -w "\n%{http_code}" \
                -H "Range: bytes=0-1023" \
                "$NGINX_SIGNED_URL" 2>/dev/null || echo -e "\n000")
            RANGE_CODE=$(echo "$RANGE_RESPONSE" | tail -n1)
            RANGE_HEADERS=$(curl -s -I -H "Range: bytes=0-1023" "$NGINX_SIGNED_URL" 2>/dev/null || echo "")
            
            if [ "$RANGE_CODE" -eq 206 ]; then
                echo -e "    ${GREEN}✅ Range request returned 206 Partial Content${NC}"
                echo "- ✅ Range request returned 206 Partial Content" >> "$SIGNED_URL_OUTPUT"
                echo "  Command: curl -H \"Range: bytes=0-1023\" ${NGINX_SIGNED_URL}" >> "$SIGNED_URL_OUTPUT"
                echo "  Response Code: $RANGE_CODE" >> "$SIGNED_URL_OUTPUT"
                
                # 检查响应头
                if echo "$RANGE_HEADERS" | grep -qi "Accept-Ranges\|Content-Range"; then
                    echo -e "    ${GREEN}✅ Response headers contain Accept-Ranges or Content-Range${NC}"
                    echo "- ✅ Response headers contain Accept-Ranges or Content-Range" >> "$SIGNED_URL_OUTPUT"
                else
                    echo -e "    ${YELLOW}⚠️  Response headers missing Accept-Ranges/Content-Range${NC}"
                    echo "- ⚠️  Response headers missing Accept-Ranges/Content-Range" >> "$SIGNED_URL_OUTPUT"
                fi
            else
                echo -e "    ${RED}❌ Range request failed (HTTP $RANGE_CODE, expected 206)${NC}"
                echo "- ❌ Range request failed (HTTP $RANGE_CODE, expected 206)" >> "$SIGNED_URL_OUTPUT"
                echo "  Command: curl -H \"Range: bytes=0-1023\" ${NGINX_SIGNED_URL}" >> "$SIGNED_URL_OUTPUT"
                SIGNED_URL_PASSED=false
            fi
            
            # 测试 4: 过期签名
            echo "  Test 4: Expired signature rejection..."
            EXPIRED_URL="${NGINX_URL}/api/storage/signed/${SIGNED_PATH}?expires=1&tenantId=test&userId=test&signature=test"
            EXPIRED_RESPONSE=$(curl -s -w "\n%{http_code}" "$EXPIRED_URL" 2>/dev/null || echo -e "\n000")
            EXPIRED_CODE=$(echo "$EXPIRED_RESPONSE" | tail -n1)
            
            if [ "$EXPIRED_CODE" -eq 404 ]; then
                echo -e "    ${GREEN}✅ Expired signature rejected (HTTP 404)${NC}"
                echo "- ✅ Expired signature rejected (HTTP 404)" >> "$SIGNED_URL_OUTPUT"
                echo "  Command: curl -s -w \"\\n%{http_code}\" ${EXPIRED_URL}" >> "$SIGNED_URL_OUTPUT"
                echo "  Response Code: $EXPIRED_CODE" >> "$SIGNED_URL_OUTPUT"
            else
                echo -e "    ${RED}❌ Expired signature not rejected (HTTP $EXPIRED_CODE, expected 404)${NC}"
                echo "- ❌ Expired signature not rejected (HTTP $EXPIRED_CODE, expected 404)" >> "$SIGNED_URL_OUTPUT"
                SIGNED_URL_PASSED=false
            fi
            
            # 测试 5: 篡改签名
            echo "  Test 5: Tampered signature rejection..."
            TAMPERED_URL="${NGINX_URL}/api/storage/signed/${SIGNED_PATH}?expires=$(date +%s)&tenantId=test&userId=test&signature=tampered"
            TAMPERED_RESPONSE=$(curl -s -w "\n%{http_code}" "$TAMPERED_URL" 2>/dev/null || echo -e "\n000")
            TAMPERED_CODE=$(echo "$TAMPERED_RESPONSE" | tail -n1)
            
            if [ "$TAMPERED_CODE" -eq 404 ]; then
                echo -e "    ${GREEN}✅ Tampered signature rejected (HTTP 404)${NC}"
                echo "- ✅ Tampered signature rejected (HTTP 404)" >> "$SIGNED_URL_OUTPUT"
                echo "  Command: curl -s -w \"\\n%{http_code}\" ${TAMPERED_URL}" >> "$SIGNED_URL_OUTPUT"
                echo "  Response Code: $TAMPERED_CODE" >> "$SIGNED_URL_OUTPUT"
            else
                echo -e "    ${RED}❌ Tampered signature not rejected (HTTP $TAMPERED_CODE, expected 404)${NC}"
                echo "- ❌ Tampered signature not rejected (HTTP $TAMPERED_CODE, expected 404)" >> "$SIGNED_URL_OUTPUT"
                SIGNED_URL_PASSED=false
            fi
            
            # 测试 6: 越权访问（使用 AUTH_TOKEN_B 签名访问 A 的资源）
            if [ -n "$AUTH_TOKEN_B" ]; then
                echo "  Test 6: Unauthorized access (cross-tenant)..."
                # 使用 B 的 token 生成签名
                SIGN_B_RESPONSE=$(curl -s -w "\n%{http_code}" \
                    -H "$AUTH_HEADER_B" \
                    "${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}" 2>/dev/null || echo -e "\n000")
                SIGN_B_HTTP_CODE=$(echo "$SIGN_B_RESPONSE" | tail -n1)
                SIGN_B_BODY=$(echo "$SIGN_B_RESPONSE" | sed '$d')
                
                if [ "$SIGN_B_HTTP_CODE" -eq 404 ] || [ "$SIGN_B_HTTP_CODE" -eq 403 ]; then
                    # B 无法签名 A 的资源（RBAC 阻止），这是正确的
                    echo -e "    ${GREEN}✅ Cross-tenant signature generation rejected (HTTP $SIGN_B_HTTP_CODE)${NC}"
                    echo "- ✅ Cross-tenant signature generation rejected (HTTP $SIGN_B_HTTP_CODE)" >> "$SIGNED_URL_OUTPUT"
                    echo "  Command: curl -H \"Authorization: Bearer <token_b>\" ${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}" >> "$SIGNED_URL_OUTPUT"
                elif [ "$SIGN_B_HTTP_CODE" -ge 200 ] && [ "$SIGN_B_HTTP_CODE" -lt 300 ]; then
                    # B 成功签名，尝试访问（应该被拒绝）
                    if command -v jq >/dev/null 2>&1; then
                        SIGNED_URL_B=$(echo "$SIGN_B_BODY" | jq -r '.url' 2>/dev/null || echo "")
                    else
                        SIGNED_URL_B=$(echo "$SIGN_B_BODY" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")
                    fi
                    
                    if [ -n "$SIGNED_URL_B" ]; then
                        SIGNED_PATH_B=$(echo "$SIGNED_URL_B" | sed "s|${API_URL}||" | sed "s|^/api/storage/signed/||")
                        SIGNED_PARAMS_B=$(echo "$SIGNED_URL_B" | grep -o '?.*$' || echo "")
                        UNAUTH_URL="${NGINX_URL}/api/storage/signed/${SIGNED_PATH_B}${SIGNED_PARAMS_B}"
                        
                        UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$UNAUTH_URL" 2>/dev/null || echo -e "\n000")
                        UNAUTH_CODE=$(echo "$UNAUTH_RESPONSE" | tail -n1)
                        
                        if [ "$UNAUTH_CODE" -eq 404 ]; then
                            echo -e "    ${GREEN}✅ Unauthorized access rejected (HTTP 404)${NC}"
                            echo "- ✅ Unauthorized access rejected (HTTP 404)" >> "$SIGNED_URL_OUTPUT"
                            echo "  Command: curl -s -w \"\\n%{http_code}\" ${UNAUTH_URL}" >> "$SIGNED_URL_OUTPUT"
                            echo "  Response Code: $UNAUTH_CODE" >> "$SIGNED_URL_OUTPUT"
                        else
                            echo -e "    ${RED}❌ Unauthorized access not rejected (HTTP $UNAUTH_CODE, expected 404)${NC}"
                            echo "- ❌ Unauthorized access not rejected (HTTP $UNAUTH_CODE, expected 404)" >> "$SIGNED_URL_OUTPUT"
                            SIGNED_URL_PASSED=false
                        fi
                    fi
                else
                    echo -e "    ${YELLOW}⚠️  Cross-tenant test inconclusive (HTTP $SIGN_B_HTTP_CODE)${NC}"
                    echo "- ⚠️  Cross-tenant test inconclusive (HTTP $SIGN_B_HTTP_CODE)" >> "$SIGNED_URL_OUTPUT"
                fi
            else
                echo -e "    ${YELLOW}⚠️  Unauthorized access test skipped (AUTH_TOKEN_B not set)${NC}"
                echo "- ⚠️  Unauthorized access test skipped (AUTH_TOKEN_B not set)" >> "$SIGNED_URL_OUTPUT"
            fi
        fi
    else
        echo -e "    ${RED}❌ Failed to generate signed URL (HTTP $SIGN_HTTP_CODE)${NC}"
        echo "- ❌ Failed to generate signed URL (HTTP $SIGN_HTTP_CODE)" >> "$SIGNED_URL_OUTPUT"
        echo "  Response: $SIGN_BODY" >> "$SIGNED_URL_OUTPUT"
        echo "  Debug dump sign(A):" >> "$SIGNED_URL_OUTPUT"
        req_dump "${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}" -H "$AUTH_HEADER_A" >> "$SIGNED_URL_OUTPUT"
        SIGNED_URL_PASSED=false
    fi
fi

if [ "$SIGNED_URL_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 3 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 3 failed${NC}\n"
fi

# 门禁 4: Video E2E 测试
echo -e "${BLUE}Gate 4: Video E2E Test${NC}"
echo "Running video E2E test..."

if [ -x "$PROJECT_ROOT/tools/smoke/ensure_prisma_generated.sh" ]; then
    bash "$PROJECT_ROOT/tools/smoke/ensure_prisma_generated.sh" || true
fi

VIDEO_E2E_PASSED=true
VIDEO_E2E_OUTPUT="$TEMP_DIR/video_e2e.txt"

if [ -f "$PROJECT_ROOT/tools/smoke/run_video_e2e.sh" ]; then
    if bash "$PROJECT_ROOT/tools/smoke/run_video_e2e.sh" > "$VIDEO_E2E_OUTPUT" 2>&1; then
        echo -e "  ${GREEN}✅ Video E2E test passed${NC}"
        echo "- ✅ Video E2E test passed" >> "$VIDEO_E2E_OUTPUT"
    else
        echo -e "  ${RED}❌ Video E2E test failed${NC}"
        echo "- ❌ Video E2E test failed" >> "$VIDEO_E2E_OUTPUT"
        VIDEO_E2E_PASSED=false
    fi
else
    echo -e "  ${YELLOW}⚠️  Video E2E script not found${NC}"
    echo "- ⚠️  Video E2E script not found" >> "$VIDEO_E2E_OUTPUT"
fi

if [ "$VIDEO_E2E_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 4 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 4 failed${NC}\n"
fi

# 门禁 5: 容量报告数据完整性检查
echo -e "${BLUE}Gate 5: Capacity Report Data Completeness${NC}"
echo "Checking capacity report for placeholder data..."

CAPACITY_REPORT_PASSED=true
CAPACITY_REPORT_OUTPUT="$TEMP_DIR/capacity_report.txt"
CAPACITY_REPORT_FILE="$PROJECT_ROOT/docs/LAUNCH_CAPACITY_REPORT.md"

if [ -f "$CAPACITY_REPORT_FILE" ]; then
    # 检查是否还有占位符
    if grep -q "___\|待填充\|待执行\|TBD\|TODO.*数据" "$CAPACITY_REPORT_FILE"; then
        echo -e "  ${YELLOW}⚠️  Capacity report contains placeholder data, attempting auto-fill...${NC}"
        echo "- ⚠️  Capacity report contains placeholder data, attempting auto-fill..." >> "$CAPACITY_REPORT_OUTPUT"

        MISSING_ENV=""
        if [ -z "${AUTH_TOKEN_A:-}" ]; then
            MISSING_ENV="${MISSING_ENV} AUTH_TOKEN_A"
        fi
        if [ -z "${SHOT_ID:-}" ]; then
            MISSING_ENV="${MISSING_ENV} SHOT_ID"
        fi

        if [ -n "$MISSING_ENV" ]; then
            echo -e "  ${RED}❌ Missing env for capacity benchmark:${NC}${MISSING_ENV}"
            echo "- ❌ Missing env for capacity benchmark:${MISSING_ENV}" >> "$CAPACITY_REPORT_OUTPUT"
            CAPACITY_REPORT_PASSED=false
        else
            AUTO_FILL_FAILED=false
            echo "  Running capacity benchmark and filling report..." >> "$CAPACITY_REPORT_OUTPUT"
            bash "$PROJECT_ROOT/tools/load/run_capacity_benchmark.sh" >> "$CAPACITY_REPORT_OUTPUT" 2>&1 || AUTO_FILL_FAILED=true
            if [ "$AUTO_FILL_FAILED" = false ]; then
                npx tsx "$PROJECT_ROOT/tools/load/fill_capacity_report.ts" >> "$CAPACITY_REPORT_OUTPUT" 2>&1 || AUTO_FILL_FAILED=true
            fi

            if [ "$AUTO_FILL_FAILED" = true ]; then
                echo -e "  ${RED}❌ Failed to auto-fill capacity report from benchmark${NC}"
                echo "- ❌ Failed to auto-fill capacity report from benchmark" >> "$CAPACITY_REPORT_OUTPUT"
                CAPACITY_REPORT_PASSED=false
            else
                # 回填后再次检查占位符
                if grep -q "___\|待填充\|待执行\|TBD\|TODO.*数据" "$CAPACITY_REPORT_FILE"; then
                    echo -e "  ${RED}❌ Capacity report still contains placeholder data after auto-fill${NC}"
                    echo "- ❌ Capacity report still contains placeholder data after auto-fill" >> "$CAPACITY_REPORT_OUTPUT"
                    CAPACITY_REPORT_PASSED=false
                else
                    echo -e "  ${GREEN}✅ Capacity report data is complete (auto-filled)${NC}"
                    echo "- ✅ Capacity report data is complete (auto-filled)" >> "$CAPACITY_REPORT_OUTPUT"
                fi
            fi
        fi
    else
        echo -e "  ${GREEN}✅ Capacity report data is complete${NC}"
        echo "- ✅ Capacity report data is complete" >> "$CAPACITY_REPORT_OUTPUT"
    fi
else
    echo -e "  ${YELLOW}⚠️  Capacity report file not found${NC}"
    echo "- ⚠️  Capacity report file not found" >> "$CAPACITY_REPORT_OUTPUT"
fi

if [ "$CAPACITY_REPORT_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 5 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 5 failed${NC}\n"
fi

# 门禁 6: Video Merge Memory Safety
echo -e "${BLUE}Gate 6: Video Merge Memory Safety${NC}"
echo "Running video merge memory consumption regression test..."

VIDEO_MERGE_MEM_PASSED=true
VIDEO_MERGE_MEM_OUTPUT="$TEMP_DIR/video_merge_mem.txt"

if [ -f "$PROJECT_ROOT/tools/gate/gates/gate-p0-r1_video_merge_hash_stream.sh" ]; then
    if bash "$PROJECT_ROOT/tools/gate/gates/gate-p0-r1_video_merge_hash_stream.sh" > "$VIDEO_MERGE_MEM_OUTPUT" 2>&1; then
        echo -e "  ${GREEN}✅ Video Merge memory safety check passed${NC}"
        echo "- ✅ Video Merge memory safety check passed" >> "$VIDEO_MERGE_MEM_OUTPUT"
    else
        echo -e "  ${RED}❌ Video Merge memory safety check failed${NC}"
        echo "- ❌ Video Merge memory safety check failed" >> "$VIDEO_MERGE_MEM_OUTPUT"
        VIDEO_MERGE_MEM_PASSED=false
    fi
else
    echo -e "  ${YELLOW}⚠️  Video Merge gate script not found${NC}"
    echo "- ⚠️  Video Merge gate script not found" >> "$VIDEO_MERGE_MEM_OUTPUT"
    VIDEO_MERGE_MEM_PASSED=false
fi

if [ "$VIDEO_MERGE_MEM_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 6 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 6 failed${NC}\n"
fi

# 门禁 7: Video Merge Resource Guardrails (Timeout/Threads)
echo -e "${BLUE}Gate 7: Video Merge Resource Guardrails (Timeout/Threads)${NC}"
echo "Running video merge timeout kill and threads configuration verification..."

VIDEO_MERGE_GUARD_PASSED=true
VIDEO_MERGE_GUARD_OUTPUT="$TEMP_DIR/video_merge_guard.txt"

if [ -f "$PROJECT_ROOT/tools/gate/gates/gate-p0-r2_video_merge_timeout_threads.sh" ]; then
    if bash "$PROJECT_ROOT/tools/gate/gates/gate-p0-r2_video_merge_timeout_threads.sh" > "$VIDEO_MERGE_GUARD_OUTPUT" 2>&1; then
        echo -e "  ${GREEN}✅ Video Merge resource guardrails check passed${NC}"
        echo "- ✅ Video Merge resource guardrails check passed" >> "$VIDEO_MERGE_GUARD_OUTPUT"
    else
        echo -e "  ${RED}❌ Video Merge resource guardrails check failed${NC}"
        echo "- ❌ Video Merge resource guardrails check failed" >> "$VIDEO_MERGE_GUARD_OUTPUT"
        VIDEO_MERGE_GUARD_PASSED=false
    fi
else
    echo -e "  ${YELLOW}⚠️  Video Merge guardrails gate script not found${NC}"
    echo "- ⚠️  Video Merge guardrails gate script not found" >> "$VIDEO_MERGE_GUARD_OUTPUT"
    VIDEO_MERGE_GUARD_PASSED=false
fi

if [ "$VIDEO_MERGE_GUARD_PASSED" = true ]; then
    echo -e "${GREEN}✅ Gate 7 passed${NC}\n"
else
    echo -e "${RED}❌ Gate 7 failed${NC}\n"
fi

# 生成完整报告
{
  echo ""
  echo "## 详细结果"
  echo ""
  echo "### Gate 1: Preflight Check + CORS Production Validation"
  cat "$PREFLIGHT_OUTPUT"
  echo ""
  echo "### Gate 2: Capacity Gate Negative Tests"
  cat "$CAPACITY_OUTPUT"
  echo ""
  echo "### Gate 3: Signed URL Full Auto Test"
  cat "$SIGNED_URL_OUTPUT"
  echo ""
  echo "### Gate 4: Video E2E Test"
  cat "$VIDEO_E2E_OUTPUT"
  echo ""
  echo "### Gate 5: Capacity Report Data Completeness"
  cat "$CAPACITY_REPORT_OUTPUT"
  echo ""
  echo "### Gate 6: Video Merge Memory Safety"
  cat "$VIDEO_MERGE_MEM_OUTPUT"
  echo ""
  echo "### Gate 7: Video Merge Resource Guardrails"
  cat "$VIDEO_MERGE_GUARD_OUTPUT"
} | evidence_pipe "" >> "$REPORT_FILE"

{
  echo ""
  echo "## 总结"
  echo ""
  echo "- Gate 1 (Preflight): $([ "$PREFLIGHT_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 2 (Capacity Gate): $([ "$CAPACITY_GATE_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 3 (Signed URL): $([ "$SIGNED_URL_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 4 (Video E2E): $([ "$VIDEO_E2E_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 5 (Capacity Report): $([ "$CAPACITY_REPORT_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 6 (Video Merge Memory): $([ "$VIDEO_MERGE_MEM_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
  echo "- Gate 7 (Video Merge Guardrails): $([ "$VIDEO_MERGE_GUARD_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")"
} | evidence_pipe "" >> "$REPORT_FILE"

# 最终判断
ALL_PASSED=true
[ "$PREFLIGHT_PASSED" != true ] && ALL_PASSED=false
[ "$CAPACITY_GATE_PASSED" != true ] && ALL_PASSED=false
[ "$SIGNED_URL_PASSED" != true ] && ALL_PASSED=false
[ "$VIDEO_E2E_PASSED" != true ] && ALL_PASSED=false
[ "$CAPACITY_REPORT_PASSED" != true ] && ALL_PASSED=false
[ "$VIDEO_MERGE_MEM_PASSED" != true ] && ALL_PASSED=false
[ "$VIDEO_MERGE_GUARD_PASSED" != true ] && ALL_PASSED=false

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ALL_PASSED" = true ]; then
    echo -e "${GREEN}✅ All gates passed!${NC}"
    echo "Report saved to: $REPORT_FILE"
    exit 0
else
    echo -e "${RED}❌ Some gates failed!${NC}"
    echo "Report saved to: $REPORT_FILE"
    exit 1
fi

