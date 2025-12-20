#!/usr/bin/env bash
set -euo pipefail

echo "[deprecation_guard] start"

# Forbidden tracked prefixes (must never be reintroduced as tracked content)
FORBIDDEN_TRACKED_PREFIXES=(
  "apps/web/src/components/_legacy/studio/"
  "apps/api_tests_backup/"
)

# Forbidden tracked files
FORBIDDEN_TRACKED_FILES=(
  "tools/headless-worker.ts"
  "tools/mock-worker.ts"
)

# Forbidden references in code roots (apps/packages/tools)
FORBIDDEN_CODE_PATTERNS=(
  "_legacy/studio"
)

fail() { echo "[deprecation_guard] FAIL: $1" >&2; exit 1; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }

# A) tracked prefixes
for pfx in "${FORBIDDEN_TRACKED_PREFIXES[@]}"; do
  if git ls-files | grep -E -q "^${pfx//\//\\/}"; then
    echo "[deprecation_guard] found tracked files under forbidden prefix: $pfx"
    git ls-files | grep -E "^${pfx//\//\\/}" | head -n 80
    fail "forbidden tracked prefix reintroduced: $pfx"
  fi
done

# B) tracked files
for f in "${FORBIDDEN_TRACKED_FILES[@]}"; do
  if git ls-files | grep -x -q "$f"; then
    fail "forbidden tracked file reintroduced: $f"
  fi
done

# C) forbidden code references
SEARCH_ROOTS=(apps packages tools)

if have_cmd rg; then
  for pat in "${FORBIDDEN_CODE_PATTERNS[@]}"; do
    if rg -n --hidden --glob '!.git/**' --glob '!docs/_evidence/**' --glob '!tools/dev/deprecation_guard.sh' "$pat" "${SEARCH_ROOTS[@]}" >/dev/null 2>&1; then
      echo "[deprecation_guard] forbidden reference detected: $pat"
      rg -n --hidden --glob '!.git/**' --glob '!docs/_evidence/**' --glob '!tools/dev/deprecation_guard.sh' "$pat" "${SEARCH_ROOTS[@]}" | head -n 120
      fail "forbidden code reference: $pat"
    fi
  done
else
  for pat in "${FORBIDDEN_CODE_PATTERNS[@]}"; do
    if grep -RIn --exclude-dir=.git --exclude-dir=docs/_evidence --exclude="deprecation_guard.sh" "$pat" "${SEARCH_ROOTS[@]}" >/dev/null 2>&1; then
      echo "[deprecation_guard] forbidden reference detected: $pat"
      grep -RIn --exclude-dir=.git --exclude-dir=docs/_evidence --exclude="deprecation_guard.sh" "$pat" "${SEARCH_ROOTS[@]}" | head -n 120
      fail "forbidden code reference: $pat"
    fi
  done
fi

echo "[deprecation_guard] PASS"
