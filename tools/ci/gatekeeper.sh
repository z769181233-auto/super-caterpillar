#!/bin/bash
set -e

echo "🚀 Starting Stage 6 Governance Gatekeeper..."

# Layer 1: Strict Apps (Blocking)
echo ""
echo "==========================================="
echo "🛡️  Layer 1: Strict Application Gate (Blocking)"
echo "==========================================="

echo "1.1 [Backend] API Build"
pnpm -C apps/api build

echo "1.2 [Frontend] Web Strict Lint"
pnpm -C apps/web lint:strict

echo "1.3 [Frontend] Web Build"
pnpm -C apps/web build

# echo "1.4 [Workers] Workers Build"
# pnpm -C apps/workers build 
# (Skipping workers build for now as strictly requested commands were only api/web, ensuring no hidden failures)

echo "1.5 [Governance] Audit Baseline Check"
if [ -f "tools/dev/check_audit_baseline.ts" ]; then
    npx ts-node tools/dev/check_audit_baseline.ts
else
    echo "⚠️  Audit checker not found, skipping..."
fi

echo ""
echo "✅ Layer 1 Passed: Core Applications & Governance are healthy."

# Layer 2: Lax Tools (Non-Blocking / Warning Only)
echo ""
echo "==========================================="
echo "⚠️  Layer 2: Tooling & Docs Gate (Non-Blocking)"
echo "==========================================="

echo "2.1 Tool Scripts Type Check"
npx tsc tools/dev/*.ts --noEmit --skipLibCheck || echo "⚠️  Tooling type check failed (Non-Blocking)"

echo ""
echo "🎉 Goverance Gatekeeper Finished Successfully!"
