#!/usr/bin/env bash
# [NEGATIVE_TEST] simulate violations to check gate effectiveness
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

EVID_DIR="docs/_evidence/negative_test_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() { echo "--- [NEGATIVE_TEST] $* ---"; }

HAS_FAIL=0
# 1. Test Shell Safety Redline (Missing Baseline)
log "Testing Shell Safety Redline (Missing IFS)..."
CAT_BAD_SHELL="$EVID_DIR/bad_shell.sh"
cat > "$CAT_BAD_SHELL" <<EOF
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
# Missing IFS
echo "test"
EOF
mv "$CAT_BAD_SHELL" tools/gate/gates/temp_bad_shell.sh
if (bash tools/gate/gates/gate-audit_shell_safety_redline.sh 2>&1 || true) | grep -q "missing required line"; then
  log "SUCCESS: Missing IFS blocked."
else
  log "FAIL: Missing IFS NOT blocked."
  HAS_FAIL=1
fi
rm tools/gate/gates/temp_bad_shell.sh

# 2. Test Shell Safety Redline (Eval violation)
log "Testing Shell Safety Redline (Eval violation)..."
CAT_EVAL_SHELL="$EVID_DIR/eval_shell.sh"
cat > "$CAT_EVAL_SHELL" <<EOF
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=\$'\n\t'
eval "ls"
EOF
mv "$CAT_EVAL_SHELL" tools/gate/gates/temp_bad_eval.sh
if (bash tools/gate/gates/gate-audit_shell_safety_redline.sh 2>&1 || true) | grep -q "contains forbidden pattern"; then
  log "SUCCESS: Eval blocked."
else
  log "FAIL: Eval NOT blocked."
  HAS_FAIL=1
fi
rm tools/gate/gates/temp_bad_eval.sh

# 3. Test SQL DQ Redline (Unquoted injection)
log "Testing SQL DQ Redline (Unquoted injection)..."
CAT_SQL_SHELL="$EVID_DIR/bad_sql.sh"
cat > "$CAT_SQL_SHELL" <<EOF
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=\$'\n\t'
DB="test"
VAL="leak"
psql "\$DB" -c "SELECT * FROM users WHERE id='\$VAL'"
EOF
mv "$CAT_SQL_SHELL" tools/gate/gates/temp_bad_sql.sh
# 审计脚本已改为中文报错，需匹配 "缺失" 关键字
if (bash tools/gate/gates/gate-audit_psql_dq_redline.sh 2>&1 || true) | grep -q "缺失"; then
  log "SUCCESS: Unquoted SQL injection blocked."
else
  log "FAIL: Unquoted SQL injection NOT blocked."
  HAS_FAIL=1
fi
rm tools/gate/gates/temp_bad_sql.sh

log "Negative testing complete. Status: $HAS_FAIL"
rm -rf "$EVID_DIR"
exit $HAS_FAIL
