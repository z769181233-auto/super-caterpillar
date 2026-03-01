#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

echo "=================================================="
echo "[GATE] Repo-wide Zero Direct Link (Worker Domain)"
echo "Purpose: 禁止 Worker 业务层直连 Provider/Selector/Adapter，结构性防退化"
echo "=================================================="

# 扫描范围（Worker 代码域）
SCAN_DIRS=(
  "apps/workers/src"
  "apps/workers/tools"
  "apps/workers/test"
)

# 允许关键字（最小白名单：合法母引擎路径/Hub/Invoker/内部入口）
ALLOW_PATTERN="EngineHubClient|EngineInvokerHubService|/_internal/engine/invoke|EngineRegistryHubService|engine-hub"

# 禁止模式（直连 Provider/Selector/本地适配器/engines 包）
DENY_PATTERN="CE03.*Selector|CE04.*Selector|ShotRender.*Selector|EngineSelector|@scu/engines-|/providers/|LocalAdapter|adapterToken:"

# 证据输出
EVID_DIR="docs/_evidence/CE02_SEAL_20260110/zero_direct_link"
mkdir -p "${EVID_DIR}"
OUT="${EVID_DIR}/zero_direct_link_repo_scan_$(date +%Y%m%d_%H%M%S).txt"

echo "[1/3] Static scan (deny patterns) ..." | tee -a "${OUT}"
echo "Scan dirs: ${SCAN_DIRS[*]}" | tee -a "${OUT}"
echo "Deny pattern: ${DENY_PATTERN}" | tee -a "${OUT}"
echo "Allow pattern: ${ALLOW_PATTERN}" | tee -a "${OUT}"
echo "" | tee -a "${OUT}"
echo "Technical Debt Files (Known Legacy, Tolerated):" | tee -a "${OUT}"
echo "  - apps/workers/src/engine-adapter-client.ts (未被引用，待清理)" | tee -a "${OUT}"
echo "  - apps/workers/src/novel-analysis-processor.ts (CE06 内部逻辑)" | tee -a "${OUT}"
echo "  - apps/workers/src/adapters/*.adapter.ts (遗留本地适配器)" | tee -a "${OUT}"
echo "  - apps/workers/src/billing/cost-ledger.service.ts (类型引用)" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

HIT=0
SCANNED_DIRS=()
SKIPPED_DIRS=()

for d in "${SCAN_DIRS[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "[SKIP] Missing dir (not scanned): $d" | tee -a "${OUT}"
    SKIPPED_DIRS+=("$d")
    continue
  fi

  SCANNED_DIRS+=("$d")
  # 找到 deny 命中后，先过滤白名单关键字，再排除已知技术债文件
  if rg -n "${DENY_PATTERN}" "$d" \
      --glob       --glob       --glob       --glob       --glob       --glob       | rg -v "${ALLOW_PATTERN}" \
      | tee -a "${OUT}"; then
    HIT=1
  fi
done

echo "----" | tee -a "${OUT}"
echo "Summary:" | tee -a "${OUT}"
echo "  Scanned: ${SCANNED_DIRS[*]}" | tee -a "${OUT}"
echo "  Skipped: ${SKIPPED_DIRS[*]}" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

if [[ "${HIT}" -eq 1 ]]; then
  echo "[FAIL] Repo-wide zero-direct-link violated. See: ${OUT}" | tee -a "${OUT}"
  exit 1
fi

echo "[2/3] PASS. Business layer zero-direct-link satisfied." | tee -a "${OUT}"
echo "[3/3] Technical debt acknowledged (legacy adapters excluded from gate)." | tee -a "${OUT}"
echo "Evidence: ${OUT}"

echo "=================================================="
echo "[GATE] Repo-wide Zero Direct Link (Worker Domain)"
echo "Purpose: 禁止 Worker 业务层直连 Provider/Selector/Adapter，结构性防退化"
echo "=================================================="

# 扫描范围（Worker 代码域）
SCAN_DIRS=(
  "apps/workers/src"
  "apps/workers/tools"
  "apps/workers/test"
)

# 允许关键字（最小白名单：合法母引擎路径/Hub/Invoker/内部入口）
ALLOW_PATTERN="EngineHubClient|EngineInvokerHubService|/_internal/engine/invoke|EngineRegistryHubService|engine-hub"

# 禁止模式（直连 Provider/Selector/本地适配器/engines 包）
DENY_PATTERN="CE03.*Selector|CE04.*Selector|ShotRender.*Selector|EngineSelector|@scu/engines-|/providers/|LocalAdapter|adapterToken:"

# 证据输出
EVID_DIR="docs/_evidence/CE02_SEAL_20260110/zero_direct_link"
mkdir -p "${EVID_DIR}"
OUT="${EVID_DIR}/zero_direct_link_repo_scan_$(date +%Y%m%d_%H%M%S).txt"

echo "[1/3] Static scan (deny patterns) ..." | tee -a "${OUT}"
echo "Scan dirs: ${SCAN_DIRS[*]}" | tee -a "${OUT}"
echo "Deny pattern: ${DENY_PATTERN}" | tee -a "${OUT}"
echo "Allow pattern: ${ALLOW_PATTERN}" | tee -a "${OUT}"
echo "" | tee -a "${OUT}"
echo "Technical Debt Files (Known Legacy, Tolerated):" | tee -a "${OUT}"
echo "  - apps/workers/src/engine-adapter-client.ts (未被引用，待清理)" | tee -a "${OUT}"
echo "  - apps/workers/src/novel-analysis-processor.ts (CE06 内部逻辑)" | tee -a "${OUT}"
echo "  - apps/workers/src/adapters/*.adapter.ts (遗留本地适配器)" | tee -a "${OUT}"
echo "  - apps/workers/src/billing/cost-ledger.service.ts (类型引用)" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

HIT=0
SCANNED_DIRS=()
SKIPPED_DIRS=()

for d in "${SCAN_DIRS[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "[SKIP] Missing dir (not scanned): $d" | tee -a "${OUT}"
    SKIPPED_DIRS+=("$d")
    continue
  fi

  SCANNED_DIRS+=("$d")
  # 找到 deny 命中后，先过滤白名单关键字，再排除已知技术债文件
  if rg -n "${DENY_PATTERN}" "$d" \
      --glob       --glob       --glob       --glob       --glob       --glob       | rg -v "${ALLOW_PATTERN}" \
      | tee -a "${OUT}"; then
    HIT=1
  fi
done

echo "----" | tee -a "${OUT}"
echo "Summary:" | tee -a "${OUT}"
echo "  Scanned: ${SCANNED_DIRS[*]}" | tee -a "${OUT}"
echo "  Skipped: ${SKIPPED_DIRS[*]}" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

if [[ "${HIT}" -eq 1 ]]; then
  echo "[FAIL] Repo-wide zero-direct-link violated. See: ${OUT}" | tee -a "${OUT}"
  exit 1
fi

echo "[2/3] PASS. Business layer zero-direct-link satisfied." | tee -a "${OUT}"
echo "[3/3] Technical debt acknowledged (legacy adapters excluded from gate)." | tee -a "${OUT}"
echo "Evidence: ${OUT}"

echo "=================================================="
echo "[GATE] Repo-wide Zero Direct Link (Worker Domain)"
echo "Purpose: 禁止 Worker 业务层直连 Provider/Selector/Adapter，结构性防退化"
echo "=================================================="

# 扫描范围（Worker 代码域）
SCAN_DIRS=(
  "apps/workers/src"
  "apps/workers/tools"
  "apps/workers/test"
)

# 允许关键字（最小白名单：合法母引擎路径/Hub/Invoker/内部入口）
ALLOW_PATTERN="EngineHubClient|EngineInvokerHubService|/_internal/engine/invoke|EngineRegistryHubService|engine-hub"

# 禁止模式（直连 Provider/Selector/本地适配器/engines 包）
DENY_PATTERN="CE03.*Selector|CE04.*Selector|ShotRender.*Selector|EngineSelector|@scu/engines-|/providers/|LocalAdapter|adapterToken:"

# 证据输出
EVID_DIR="docs/_evidence/CE02_SEAL_20260110/zero_direct_link"
mkdir -p "${EVID_DIR}"
OUT="${EVID_DIR}/zero_direct_link_repo_scan_$(date +%Y%m%d_%H%M%S).txt"

echo "[1/3] Static scan (deny patterns) ..." | tee -a "${OUT}"
echo "Scan dirs: ${SCAN_DIRS[*]}" | tee -a "${OUT}"
echo "Deny pattern: ${DENY_PATTERN}" | tee -a "${OUT}"
echo "Allow pattern: ${ALLOW_PATTERN}" | tee -a "${OUT}"
echo "" | tee -a "${OUT}"
echo "Technical Debt Files (Known Legacy, Tolerated):" | tee -a "${OUT}"
echo "  - apps/workers/src/engine-adapter-client.ts (未被引用，待清理)" | tee -a "${OUT}"
echo "  - apps/workers/src/novel-analysis-processor.ts (CE06 内部逻辑)" | tee -a "${OUT}"
echo "  - apps/workers/src/adapters/*.adapter.ts (遗留本地适配器)" | tee -a "${OUT}"
echo "  - apps/workers/src/billing/cost-ledger.service.ts (类型引用)" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

HIT=0
SCANNED_DIRS=()
SKIPPED_DIRS=()

for d in "${SCAN_DIRS[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "[SKIP] Missing dir (not scanned): $d" | tee -a "${OUT}"
    SKIPPED_DIRS+=("$d")
    continue
  fi

  SCANNED_DIRS+=("$d")
  # 找到 deny 命中后，先过滤白名单关键字，再排除已知技术债文件
  if rg -n "${DENY_PATTERN}" "$d" \
      --glob       --glob       --glob       --glob       --glob       --glob       | rg -v "${ALLOW_PATTERN}" \
      | tee -a "${OUT}"; then
    HIT=1
  fi
done

echo "----" | tee -a "${OUT}"
echo "Summary:" | tee -a "${OUT}"
echo "  Scanned: ${SCANNED_DIRS[*]}" | tee -a "${OUT}"
echo "  Skipped: ${SKIPPED_DIRS[*]}" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

if [[ "${HIT}" -eq 1 ]]; then
  echo "[FAIL] Repo-wide zero-direct-link violated. See: ${OUT}" | tee -a "${OUT}"
  exit 1
fi

echo "[2/3] PASS. Business layer zero-direct-link satisfied." | tee -a "${OUT}"
echo "[3/3] Technical debt acknowledged (legacy adapters excluded from gate)." | tee -a "${OUT}"
echo "Evidence: ${OUT}"

echo "=================================================="
echo "[GATE] Repo-wide Zero Direct Link (Worker Domain)"
echo "Purpose: 禁止 Worker 业务层直连 Provider/Selector/Adapter，结构性防退化"
echo "=================================================="

# 扫描范围（Worker 代码域）
SCAN_DIRS=(
  "apps/workers/src"
  "apps/workers/tools"
  "apps/workers/test"
)

# 允许关键字（最小白名单：合法母引擎路径/Hub/Invoker/内部入口）
ALLOW_PATTERN="EngineHubClient|EngineInvokerHubService|/_internal/engine/invoke|EngineRegistryHubService|engine-hub"

# 禁止模式（直连 Provider/Selector/本地适配器/engines 包）
DENY_PATTERN="CE03.*Selector|CE04.*Selector|ShotRender.*Selector|EngineSelector|@scu/engines-|/providers/|LocalAdapter|adapterToken:"

# 证据输出
EVID_DIR="docs/_evidence/CE02_SEAL_20260110/zero_direct_link"
mkdir -p "${EVID_DIR}"
OUT="${EVID_DIR}/zero_direct_link_repo_scan_$(date +%Y%m%d_%H%M%S).txt"

echo "[1/3] Static scan (deny patterns) ..." | tee -a "${OUT}"
echo "Scan dirs: ${SCAN_DIRS[*]}" | tee -a "${OUT}"
echo "Deny pattern: ${DENY_PATTERN}" | tee -a "${OUT}"
echo "Allow pattern: ${ALLOW_PATTERN}" | tee -a "${OUT}"
echo "" | tee -a "${OUT}"
echo "Technical Debt Files (Known Legacy, Tolerated):" | tee -a "${OUT}"
echo "  - apps/workers/src/engine-adapter-client.ts (未被引用，待清理)" | tee -a "${OUT}"
echo "  - apps/workers/src/novel-analysis-processor.ts (CE06 内部逻辑)" | tee -a "${OUT}"
echo "  - apps/workers/src/adapters/*.adapter.ts (遗留本地适配器)" | tee -a "${OUT}"
echo "  - apps/workers/src/billing/cost-ledger.service.ts (类型引用)" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

HIT=0
SCANNED_DIRS=()
SKIPPED_DIRS=()

for d in "${SCAN_DIRS[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "[SKIP] Missing dir (not scanned): $d" | tee -a "${OUT}"
    SKIPPED_DIRS+=("$d")
    continue
  fi

  SCANNED_DIRS+=("$d")
  # 找到 deny 命中后，先过滤白名单关键字，再排除已知技术债文件
  if rg -n "${DENY_PATTERN}" "$d" \
      --glob       --glob       --glob       --glob       --glob       --glob       | rg -v "${ALLOW_PATTERN}" \
      | tee -a "${OUT}"; then
    HIT=1
  fi
done

echo "----" | tee -a "${OUT}"
echo "Summary:" | tee -a "${OUT}"
echo "  Scanned: ${SCANNED_DIRS[*]}" | tee -a "${OUT}"
echo "  Skipped: ${SKIPPED_DIRS[*]}" | tee -a "${OUT}"
echo "----" | tee -a "${OUT}"

if [[ "${HIT}" -eq 1 ]]; then
  echo "[FAIL] Repo-wide zero-direct-link violated. See: ${OUT}" | tee -a "${OUT}"
  exit 1
fi

echo "[2/3] PASS. Business layer zero-direct-link satisfied." | tee -a "${OUT}"
echo "[3/3] Technical debt acknowledged (legacy adapters excluded from gate)." | tee -a "${OUT}"
echo "Evidence: ${OUT}"
