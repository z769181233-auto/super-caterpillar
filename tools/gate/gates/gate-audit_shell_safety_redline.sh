#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-audit_shell_safety_redline.sh
# Redline: All shell scripts in tools/ must have safety baseline
# and MUST NOT use forbidden commands (eval).

fail() { echo "[SHELL][FAIL] $*" >&2; exit 1; }
pass() { echo "[SHELL][PASS] $*"; }

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"

while read -r f; do
  [[ -z "$f" ]] && continue
  
  # Exclude tester itself
  if [[ "$f" == *"negative_tests.sh" ]]; then
     continue
  fi

  # Audit baseline
  grep -Fq "#!/usr/bin/env bash" "$f" || fail "$f missing required shebang"
  grep -Fq "set -euo pipefail" "$f" || fail "$f missing required line: set -euo pipefail"
  
  # Check IFS with flexibility for escaping
  if ! grep -Fq "IFS=\$'\n\t'" "$f" && ! grep -Fq "IFS=$'\n\t'" "$f"; then
     fail "$f missing required line: IFS=\$'\n\t'"
  fi
  
  # Check forbidden patterns (eval), excluding comments and the auditor itself
  # Use -w to match whole word 'eval' to avoid matching 'evaluate', 'retrieval' etc.
  if grep -v "^#" "$f" | grep -wq "eval" ; then
     # Special case for the auditor itself
     if [[ "$f" == *"gate-audit_shell_safety_redline.sh" ]]; then
        continue
     fi
     fail "$f contains forbidden pattern: eval"
  fi

done < <(find tools/gate/gates -name "*.sh" 2>/dev/null)

pass "All gate scripts meet shell safety redline."
