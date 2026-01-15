#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-audit_governance_integrity.sh
# 红线的红线：确保治理体系本身不被旁路、不被降级。

fail() { echo "[INTEGRITY][FAIL] $*" >&2; exit 1; }
pass() { echo "[INTEGRITY][PASS] $*"; }

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"
AGGREGATOR="tools/gate/gates/gate-post_sealed_governance.sh"
HUSKY_HOOK=".husky/pre-push"

log() { echo "[INTEGRITY][INFO] $*"; }

# 1. 检查 Husky 强绑定
if [[ -f "$HUSKY_HOOK" ]]; then
  if ! grep -q "gate-post_sealed_governance.sh" "$HUSKY_HOOK"; then
    fail "Husky pre-push hook bypass detect: Must call gate-post_sealed_governance.sh"
  fi
else
  fail "Husky hook missing: .husky/pre-push"
fi

# 2. 检查聚合器自举能力
if ! grep -q "Self-audit OK" "$AGGREGATOR"; then
  fail "Aggregator $AGGREGATOR missing self-audit execution logic."
fi

# 4. 检查 SSOT 宣言文件
MANIFEST="docs/_specs/governance/GOVERNANCE_SEAL_MANIFEST.md"
if [[ ! -f "$MANIFEST" ]]; then
  fail "Governance Seal Manifest missing: $MANIFEST"
fi

# 5. 检查审计脚本是否引用 SSOT 配置 (禁止硬编码)
# 规则：审计脚本通过 node 读取 config 且包含 CONFIG 变量引用
while read -r f; do
  [[ "$f" == *"gate-audit_governance_integrity.sh" ]] && continue
  if ! grep -q "gov_post_sealed.config.json" "$f"; then
    # 特别例外确认
    if [[ "$f" == *"structure"* ]] || [[ "$f" == *"safety"* ]] || [[ "$f" == *"path_hygiene"* ]]; then
       fail "$f bypasses SSOT: Must reference gov_post_sealed.config.json"
    fi
  fi
done < <(find tools/gate/gates -name "gate-audit_*.sh" 2>/dev/null)

pass "Governance integrity verified. Anti-bypass rules active."
