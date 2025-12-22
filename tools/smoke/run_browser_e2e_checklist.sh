#!/bin/bash
set -euo pipefail

# Config
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASS="admin123"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
d='\033[0;37m'
NC='\033[0m'

echo -e "${BLUE}=== Browser E2E Checklist Setup ===${NC}"

# 0. Load env like run_all.sh
if [ -f .env.smoke.local ]; then
  # shellcheck disable=SC1091
  source .env.smoke.local
  echo -e "${d}Loaded .env.smoke.local${NC}"
fi

# 1. Ensure API is reachable
if ! curl -s "${API_URL}/api/health" >/dev/null; then
  echo -e "${YELLOW}API not reachable at ${API_URL}. Is it running?${NC}"
  # Optional: Try start
  echo "Trying to ensure auth state (which might verify API)..."
fi

# 2. Get/Create User & Token (using existing script)
echo -e "${d}Getting admin token...${NC}"
if ! pnpm -w exec tsx tools/smoke/ensure_auth_state.ts "${ADMIN_EMAIL}" "${ADMIN_PASS}"; then
    echo "❌ Failed to authenticate."
    exit 1
fi

# Load auth env
source tools/smoke/.auth_env

# 3. Create Demo Project via API (Simulating UI or external integration)
echo -e "${d}Setting up Demo Project via API...${NC}"

# Ensure we have the AUTH_COOKIE_HEADER or Token
if [ -z "${AUTH_COOKIE_HEADER:-}" ]; then
    echo "❌ Missing AUTH_COOKIE_HEADER. ensure_auth_state failed?"
    exit 1
fi

DEMO_RESP=$(curl -s -X POST "${API_URL}/api/projects/demo-structure" \
  -H "Content-Type: application/json" \
  -H "${AUTH_COOKIE_HEADER}")

# Check for success
if [[ "$DEMO_RESP" == *"success"* ]]; then
   # Extract projectId using grep/sed (simple JSON parsing)
   # Response format: {"success":true,"data":{"projectId":"..."},...}
   PROJECT_ID=$(echo "$DEMO_RESP" | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
   
   if [ -n "$PROJECT_ID" ]; then
       echo "✅ Demo Project Created: $PROJECT_ID"
       # Update .demo_env
       echo "TEST_PROJECT_ID=\"$PROJECT_ID\"" > tools/smoke/.demo_env
   else
       echo "❌ Failed to extract projectId from response: $DEMO_RESP"
       exit 1
   fi
else
    echo "❌ API Call Failed: $DEMO_RESP"
    exit 1
fi

# Load demo env to get PROJECT_ID (just created)
source tools/smoke/.demo_env

# 4. Output Checklist
echo ""
echo -e "${GREEN}=== ✅ READY FOR MANUAL BROWSER CHECK ===${NC}"
echo ""
echo "1. Login:"
echo -e "   URL:      ${BLUE}http://localhost:3001/zh/login${NC}"
echo -e "   Email:    ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e "   Password: ${YELLOW}${ADMIN_PASS}${NC}"
echo ""
echo "2. Projects List:"
echo -e "   URL:      ${BLUE}http://localhost:3001/zh/projects${NC}"
echo "   Action:   Verify 'Demo Structure Project' exists."
echo ""
echo "3. Structure View (Direct):"
echo -e "   URL (Alias): ${BLUE}http://localhost:3001/zh/projects/${TEST_PROJECT_ID}/structure${NC}"
echo -e "   URL (Raw):   ${BLUE}http://localhost:3001/zh/projects/${TEST_PROJECT_ID}?module=structure${NC}"
echo "   Action:      Verify Tree (Season->Ep->Scene->Shot) and Counts (1/2/6/30)."
echo ""
echo "4. Demo Import (Button):"
echo "   Action:   Click 'Import Demo Project' in Projects List (if visible)."
echo ""
echo "5. Login Redirect:"
echo -e "   URL:      ${BLUE}http://localhost:3001/projects/${TEST_PROJECT_ID}/structure${NC} (Open Incognito)"
echo "   Action:   Should redirect to login?from=... -> Login -> Back to Structure."
echo ""
