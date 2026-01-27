#!/bin/bash
set -e

# Gate: Anti-Bypass Discipline Enforcer (G0-1)
# Ensures no "skip", "force", or "no-verify" terms are present in commits or code changes.

echo "=== Gate: No Bypass Commit Started ==="

FORBIDDEN_TERMS_MSG=("--no-verify" "skip" "force" "bypass")
FORBIDDEN_TERMS_CODE=("|| true" "set +e" "no-verify" "force: true")

# 1. Scan Commit Message (HEAD)
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    COMMIT_MSG=$(git --no-pager log -1 --pretty=%B)
    echo "Scanning commit message for bypass terms..."
    for term in "${FORBIDDEN_TERMS_MSG[@]}"; do
        # Use -e to handle terms starting with hyphens
        if echo "$COMMIT_MSG" | grep -Fq -e "$term"; then
            echo "❌ FAIL: Commit message contains forbidden bypass term: '$term'"
            echo "   Please adhere to factory discipline. Do not bypass gates."
            exit 1
        fi
    done
else
    echo "⚠ No HEAD commit found (fresh repo?), skipping message scan."
fi

# 2. Scan Code Changes (HEAD~1..HEAD)
# Determine comparison base
if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    BASE="HEAD~1"
else
    # Fallback for initial commit or shallow clone
    BASE="HEAD" 
fi

# Get changed file list
CHANGED_FILES=$(git --no-pager diff --name-only $BASE HEAD 2>/dev/null || echo "")

if [ -n "$CHANGED_FILES" ]; then
    echo "Scanning code changes for bypass patterns..."
    # Check for forbidden terms in added/modified lines
    # Only scan text files, exclude this script itself to avoid false positive on grep args
    git --no-pager diff $BASE HEAD -- . ':!tools/gate/gates/gate-no-bypass-commit.sh' | grep "^+" | while read -r line; do
        for term in "${FORBIDDEN_TERMS_CODE[@]}"; do
             # Use -e to handle terms starting with hyphens
            if echo "$line" | grep -Fq -e "$term"; then
                echo "❌ FAIL: Forbidden bypass pattern found in code change: '$term'"
                echo "   Offending line: $line"
                exit 1
            fi
        done
    done
fi

# 3. Governance Coupling Check
# If required_checks.sh is modified, docs/ must also be modified
if echo "$CHANGED_FILES" | grep -q "tools/gate/ci/required_checks.sh"; then
    echo "🔍 Critical Gate modification detected: required_checks.sh"
    if ! echo "$CHANGED_FILES" | grep -q "^docs/"; then
        echo "❌ FAIL: Modification to required_checks.sh requires accompanying updates in docs/ (SSOT or Governance)."
        echo "   Rule: You cannot lower or change the bar without documenting WHY in SSOT."
        exit 1
    fi
fi

echo "✅ SUCCESS: No bypass attempts detected. Factory discipline maintained."
echo "=== Gate Completed ==="
