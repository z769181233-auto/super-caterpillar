#!/usr/bin/env bash
set -euo pipefail

# ===== Gate: CE14 Narrative Climax =====
echo "--- [GATE] CE14 Narrative Climax START ---"

# 断言 1: 物理文件存在
ADAPTER="apps/api/src/engines/adapters/ce14_narrative_climax.adapter.ts"
if [ ! -f "$ADAPTER" ]; then
    echo "❌ FAIL: Adapter not found at $ADAPTER"
    exit 1
fi

# 断言 2: 禁止 STUB 特征
if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "apps/api/src/engines/adapters/ce14_narrative_climax.adapter.ts"; then
    echo "❌ FAIL: CE14 contains STUB features!"
    exit 1
fi

echo "✅ CE14 Passed"
echo "--- [GATE] CE14 Narrative Climax PASS ---"
exit 0
