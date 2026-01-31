#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# gate-engine_entry_ssot.sh# 禁止在非适配层新增对 src/engine/ 或 src/engines/ 的引用


ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[$GATE_NAME] $*"; }
GATE_NAME="ENGINE_ENTRY_SSOT"

log "Staring Entry SSOT Audit..."

# 1. 扫描除了允许引用旧入口的模块（如 JobModule/engine-hub 自己）之外的所有新模块
# 规则：禁止 import ... from 
# 我们主要关注 apps/api/src 下的所有目录，排除 engine-hub 和底层基座
VIOLATIONS=$(grep -rE "from   --exclude-dir="engine-hub" \
  --exclude-dir="engine" \
  --exclude-dir="engines" \
  --exclude-dir="job" \
  --exclude-dir="orchestrator" \
  --exclude-dir="task" \
  --exclude-dir="engines" || true)

if [ -n "$VIOLATIONS" ]; then
    log "❌ FAIL: Illegal cross-reference to DEPRECATED engine directories found!"
    echo "$VIOLATIONS"
    exit 1
fi

log "✅ PASS: No illegal engine entry-point bypass detected."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[$GATE_NAME] $*"; }
GATE_NAME="ENGINE_ENTRY_SSOT"

log "Staring Entry SSOT Audit..."

# 1. 扫描除了允许引用旧入口的模块（如 JobModule/engine-hub 自己）之外的所有新模块
# 规则：禁止 import ... from 
# 我们主要关注 apps/api/src 下的所有目录，排除 engine-hub 和底层基座
VIOLATIONS=$(grep -rE "from   --exclude-dir="engine-hub" \
  --exclude-dir="engine" \
  --exclude-dir="engines" \
  --exclude-dir="job" \
  --exclude-dir="orchestrator" \
  --exclude-dir="task" \
  --exclude-dir="engines" || true)

if [ -n "$VIOLATIONS" ]; then
    log "❌ FAIL: Illegal cross-reference to DEPRECATED engine directories found!"
    echo "$VIOLATIONS"
    exit 1
fi

log "✅ PASS: No illegal engine entry-point bypass detected."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[$GATE_NAME] $*"; }
GATE_NAME="ENGINE_ENTRY_SSOT"

log "Staring Entry SSOT Audit..."

# 1. 扫描除了允许引用旧入口的模块（如 JobModule/engine-hub 自己）之外的所有新模块
# 规则：禁止 import ... from 
# 我们主要关注 apps/api/src 下的所有目录，排除 engine-hub 和底层基座
VIOLATIONS=$(grep -rE "from   --exclude-dir="engine-hub" \
  --exclude-dir="engine" \
  --exclude-dir="engines" \
  --exclude-dir="job" \
  --exclude-dir="orchestrator" \
  --exclude-dir="task" \
  --exclude-dir="engines" || true)

if [ -n "$VIOLATIONS" ]; then
    log "❌ FAIL: Illegal cross-reference to DEPRECATED engine directories found!"
    echo "$VIOLATIONS"
    exit 1
fi

log "✅ PASS: No illegal engine entry-point bypass detected."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[$GATE_NAME] $*"; }
GATE_NAME="ENGINE_ENTRY_SSOT"

log "Staring Entry SSOT Audit..."

# 1. 扫描除了允许引用旧入口的模块（如 JobModule/engine-hub 自己）之外的所有新模块
# 规则：禁止 import ... from 
# 我们主要关注 apps/api/src 下的所有目录，排除 engine-hub 和底层基座
VIOLATIONS=$(grep -rE "from   --exclude-dir="engine-hub" \
  --exclude-dir="engine" \
  --exclude-dir="engines" \
  --exclude-dir="job" \
  --exclude-dir="orchestrator" \
  --exclude-dir="task" \
  --exclude-dir="engines" || true)

if [ -n "$VIOLATIONS" ]; then
    log "❌ FAIL: Illegal cross-reference to DEPRECATED engine directories found!"
    echo "$VIOLATIONS"
    exit 1
fi

log "✅ PASS: No illegal engine entry-point bypass detected."
