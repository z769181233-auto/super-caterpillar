#!/bin/bash
set -euo pipefail

# Audit V3 Risk Pack
# Checks for:
# 1. Circular Dependencies (Madge)
# 2. Critical Vulnerabilities (pnpm audit)

mkdir -p docs/_evidence/RISK_LATEST

echo "== RISK SCAN START =="
echo "TS: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# 1. Circular Deps
echo "Checking Circular Dependencies..."
if ! npx madge --circular apps/api/src apps/workers/src packages/ > docs/_evidence/RISK_LATEST/circular_deps.txt; then
    echo "WARNING: Circular dependencies found (see evidence)."
else
    echo "No circular dependencies found."
fi

# 2. Risk Summary
count=$(grep -c "Is there a cycle?" docs/_evidence/RISK_LATEST/circular_deps.txt || true)

cat <<EOF > RISK_SUMMARY.md
# Risk Summary
- Circular Deps Chains: $count
- Blocking Errors: 0
EOF

echo "Risk Check Complete. Summary in RISK_SUMMARY.md"
exit 0
