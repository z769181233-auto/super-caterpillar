#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-audit_path_hygiene_redline.sh
# Redline: 禁止泄露绝对路径或敏感环境前缀。

fail() { echo "[PATH][FAIL] $*" >&2; exit 1; }
pass() { echo "[PATH][PASS] $*"; }

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"

# 扫描 tools 目录下的所有脚本
while read -r f; do
  [[ -z "$f" ]] && continue
  
  # 排除测试脚本和审计脚本中的正则本身
  if [[ "$f" == *"negative_tests.sh"* ]] || [[ "$f" == *"gate-audit_path_hygiene"* ]]; then
     continue
  fi

  # 匹配绝对路径模式 (Unix /Users, /home, /root; Windows C:\)
  # 并在匹配时排除典型的合法引用
  bad_line=$(grep -E "/Users/|/home/|/root/|[A-Za-z]:\\\\" "$f" | \
             grep -vE "http|https|git@|docker|node:" | \
             head -n 1 || true)

  if [[ -n "$bad_line" ]]; then
     fail "$f: 检测到绝对路径泄露。行内容: $bad_line"
  fi
done < <(find tools/gate/gates -name "*.sh" 2>/dev/null)

pass "所有 gate 脚本路径引用符合相对化标准。"
