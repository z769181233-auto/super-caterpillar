#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-audit_shell_safety_redline.sh (Refactored to respect config)
EXIT_CODE=0
fail() { echo "[SHELL][FAIL] $*" >&2; EXIT_CODE=1; }
pass() { echo "[SHELL][PASS] $*"; }

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"
[[ -f "$CONFIG" ]] || fail "Missing config: $CONFIG"

# Read requirements from config
SHEBANG=$(node -e "const c=require('./$CONFIG'); console.log(c.gate_shell.required_shebang || '')")
CONTAINS=$(node -e "const c=require('./$CONFIG'); console.log(c.gate_shell.required_contains.join('\n'))")

while read -r f; do
  [[ -z "$f" ]] && continue
  [[ "$f" == *"gate-audit_shell_safety_redline.sh" ]] && continue
  [[ "$f" == *"negative_tests.sh" ]] && continue

  # Audit shebang if required
  if [[ -n "$SHEBANG" ]]; then
    grep -Fq "$SHEBANG" "$f" || fail "$f missing required shebang: $SHEBANG"
  fi

  # Audit contains if required
  while read -r line; do
    [[ -z "$line" ]] && continue
    if ! grep -Fq "$line" "$f"; then
      fail "$f missing required line: $line"
    fi
  done <<<"$CONTAINS"

done < <(find tools/gate/gates -name "*.sh")

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "All gate scripts meet shell safety redline (Config Aware)."
else
  exit 1
fi
