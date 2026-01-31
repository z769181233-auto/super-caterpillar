#!/bin/bash
# tools/ops/p25_priority_fairness_rollback.sh
# 目的：一键回撤 P25 优先级治理变更，并验证回滚后的系统稳定性。
# 包含：Dirty Workspace Stash、Fail-fast 校验、自动回归闭环。

set -euo pipefail

echo "=============================================="
echo "ACTION: P25 Priority Fairness Rollback (HARDENED)"
echo "=============================================="

# 1. Workspace Protection
echo "[STEP 1/4] Checking Workspace Purity..."
STASH_ID=""
if ! git diff --quiet; then
    echo "⚠️ Workspace is dirty. Performing auto-stash..."
    STASH_MSG="p25_rollback_auto_stash_$(date +%s)"
    git stash push -m "$STASH_MSG"
    STASH_ID=$(git stash list | grep "$STASH_MSG" | cut -d: -f1)
    echo "✅ Stashed changes in $STASH_ID ($STASH_MSG)"
fi

# 2. Fail-fast Validation
echo "[STEP 2/4] Validating Target Commit/Tag..."
SEAL_TAG="seal/p25_priority_fairness_20260125"
if ! git rev-parse "$SEAL_TAG" >/dev/null 2>&1; then
    echo "❌ CRITICAL: Target Seal Label [$SEAL_TAG] not found in Git history."
    echo "Rollback aborted to prevent workspace corruption."
    [ -n "$STASH_ID" ] && git stash pop "$STASH_ID"
    exit 1
fi
echo "✅ Target label confirmed."

# 3. Execution
if [ "${1:-}" == "--confirm" ]; then
    echo "[STEP 3/4] REVERTING CHANGED FILES..."
    git checkout "$SEAL_TAG^" -- \
        apps/api/src/job/job.service.ts \
        apps/api/src/orchestrator/orchestrator.service.ts \
        apps/workers/src/processors/novel-chunk.processor.ts
    echo "✅ Files reverted to pre-seal state."
else
    echo "[STEP 3/4] DRY-RUN MODE"
    echo "Would revert to commit: $(git rev-parse $SEAL_TAG^)"
    echo "Affected files: job.service.ts, orchestrator.service.ts, novel-chunk.processor.ts"
    echo "Run with --confirm to execute."
    [ -n "$STASH_ID" ] && git stash pop "$STASH_ID"
    exit 0
fi

# 4. Regression & Verification
if [ "${1:-}" == "--confirm" ]; then
    echo "[STEP 4/4] Running Post-Rollback Regression (Confirm Mode)..."

    # Regression 1: Fairness Gate (Old State)
    echo ">>> Running Fairness Gate (Regression)..."
    bash tools/gate/gates/gate-p25-priority-fairness.sh || { echo "❌ Post-rollback Fairness baseline failed"; exit 1; }

    # Regression 2: Light Video Probe
    echo ">>> Running Video Probe (Regression)..."
    bash tools/gate/gates/gate-video-p22-0-probe.sh || { echo "❌ Post-rollback Video baseline failed"; exit 1; }
    
    echo "=============================================="
    echo "✅ ROLLBACK & REGRESSION COMPLETE"
    echo "Note: If you had stashed changes, they are remaining in: $STASH_ID"
    echo "=============================================="
else
    echo "[STEP 4/4] Skipping Regression in Dry-Run Mode."
    echo "=============================================="
    echo "✅ DRY-RUN COMPLETE (No changes applied)"
    echo "To execute rollback: $0 --confirm"
    echo "=============================================="
fi
