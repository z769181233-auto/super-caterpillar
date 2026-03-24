#!/bin/bash
# Cold Start Verification Script
# Purpose: Verify that migrations can be replayed on an empty database

set -e

echo "=== Database Governance: Cold Start Verification ==="

# Get the base DATABASE_URL from .env (remove the database name)
if [ -f packages/database/.env ]; then
    source packages/database/.env
fi

# Use default if not set
BASE_URL=${DATABASE_URL:-"postgresql://postgres@127.0.0.1:5432"}
# Extract base URL without database name
BASE_URL=$(echo $BASE_URL | sed 's|/[^/]*$||')

VERIFY_DB_NAME="super_caterpillar_verify_$(date +%s)"
VERIFY_DB_URL="${BASE_URL}/${VERIFY_DB_NAME}"

echo "Base URL: ${BASE_URL}"
echo "Verify DB: ${VERIFY_DB_NAME}"

# Step 1: Create empty database
echo ""
echo "Step 1: Creating empty database '${VERIFY_DB_NAME}'..."
psql "${BASE_URL}/postgres" -c "DROP DATABASE IF EXISTS ${VERIFY_DB_NAME};" 2>/dev/null || true
psql "${BASE_URL}/postgres" -c "CREATE DATABASE ${VERIFY_DB_NAME};"
echo "✅ Database created."

# Step 2: Run migrations
echo ""
echo "Step 2: Running migrations (prisma migrate deploy)..."
export DATABASE_URL="${VERIFY_DB_URL}"
cd packages/database
pnpm prisma migrate deploy
cd ../..
echo "✅ Migrations applied."

# Step 3: Generate Prisma Client
echo ""
echo "Step 3: Generating Prisma Client..."
cd packages/database
pnpm prisma generate
cd ../..
echo "✅ Client generated."

# Step 4: Build API
echo ""
echo "Step 4: Building API..."
pnpm -F api build
echo "✅ API built."

# Step 5: Run verification script
echo ""
echo "Step 5: Running verify_stage10.ts..."
pnpm -w exec tsx scripts/verify_stage10.ts
echo "✅ Verification passed."

# Step 6: Cleanup
echo ""
echo "Step 6: Cleaning up..."
psql "${BASE_URL}/postgres" -c "DROP DATABASE ${VERIFY_DB_NAME};"
echo "✅ Database dropped."

echo ""
echo "=== Cold Start Verification PASSED ==="
echo "证明：整个过程未使用 patch_db.ts"
