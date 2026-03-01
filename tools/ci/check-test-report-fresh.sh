#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Stage8] Checking TEST_REPORT freshness..."

# 检查是否为 git 仓库
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "⚠️  Not a git repository, skipping freshness check"
  exit 0
fi

# 获取基础分支（PR 时用 base，push 时用 HEAD~1）
BASE_BRANCH="${GITHUB_BASE_REF:-main}"
EVENT_NAME="${GITHUB_EVENT_NAME:-}"

CHANGED=""

if [ "$EVENT_NAME" = "push" ]; then
  # push 事件：比较 HEAD~1 和 HEAD
  if git rev-parse --verify HEAD~1 > /dev/null 2>&1; then
    CHANGED=$(git diff --name-only HEAD~1...HEAD 2>/dev/null | grep -E '(^|/)docs/TEST_REPORT_.*\.md$' || true)
  fi
elif [ -n "$EVENT_NAME" ]; then
  # PR 事件：比较 base 和 HEAD
  if git rev-parse --verify origin/${BASE_BRANCH} > /dev/null 2>&1; then
    CHANGED=$(git diff --name-only origin/${BASE_BRANCH}...HEAD 2>/dev/null | grep -E '(^|/)docs/TEST_REPORT_.*\.md$' || true)
  fi
else
  # 本地环境：检查未提交的变更
  if git rev-parse --verify HEAD > /dev/null 2>&1; then
    CHANGED=$(git diff --name-only HEAD 2>/dev/null | sed 's/^"//;s/"$//' | grep -E '(^|/)docs/TEST_REPORT_.*\.md$' || true)
    if [ -z "$CHANGED" ]; then
      # 如果没有未提交的变更，检查暂存区
      # 处理可能包含引号和转义字符的路径
      CHANGED=$(git diff --cached --name-only 2>/dev/null | sed 's/^"//;s/"$//' | grep -i 'TEST_REPORT_.*\.md$' || true)
    fi
  else
    # 如果 HEAD 不存在（新仓库），检查暂存区
    CHANGED=$(git diff --cached --name-only 2>/dev/null | sed 's/^"//;s/"$//' | grep -i 'TEST_REPORT_.*\.md$' || true)
  fi
fi

if [ -z "$CHANGED" ]; then
  echo "❌ No new TEST_REPORT added in this change set"
  echo "❌ Reusing old reports is forbidden"
  exit 1
fi

echo "✅ [Stage8] New TEST_REPORT detected:"
echo "$CHANGED"

