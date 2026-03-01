#!/bin/bash
IFS=$'
	'
# gate_p5_stability.sh: 断言 SLO 稳定性与延迟
EVI_DIR=$1
STABILITY_JSON="$EVI_DIR/stability_audit.json"

echo "--- [GATE] P5-2 Stability Assertion ---"

if [ ! -f "$STABILITY_JSON" ]; then
    echo "ERROR: stability_audit.json not found"
    exit 1
fi

VERDICT=$(jq -r '.verdict' "$STABILITY_JSON")
P99_LATENCY=$(jq -r '.slos.p99_latency_ms' "$STABILITY_JSON")
ERROR_COUNT=$(jq -r '.slos.filtered_error_count' "$STABILITY_JSON")

echo "Verdict: $VERDICT"
echo "P99 Latency: ${P99_LATENCY}ms"
echo "Error Count: $ERROR_COUNT"

# 断言 1: Verdict 必须为 PASS
if [ "$VERDICT" != "PASS" ]; then
    echo "ASSERTION FAIL: Stability verdict is not PASS"
    exit 2
fi

# 断言 2: P99 延迟 < 5s
if [ "$P99_LATENCY" -gt 5000 ]; then
    echo "ASSERTION FAIL: P99 Latency ${P99_LATENCY}ms exceeds 5000ms threshold"
    exit 2
fi

# 断言 3: 零误差
if [ "$ERROR_COUNT" -ne 0 ]; then
    echo "ASSERTION FAIL: Found $ERROR_COUNT errors in logs"
    exit 2
fi

echo "--- [GATE] P5-2 STABILITY PASS ---"
exit 0
