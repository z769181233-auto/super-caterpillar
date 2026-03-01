#!/bin/bash
# P3'-6: Scale Verification Gate
set -e

EVI_DIR=$1
if [ -z "$EVI_DIR" ]; then
    echo "Usage: $0 <evidence_dir>"
    exit 1
fi

PERF_FILE="$EVI_DIR/output/perf_stats.json"
REPORT_FILE="$EVI_DIR/output/shot_gate_report_real.json"
VIDEO_FILE="$EVI_DIR/output/scene.mp4"

echo "--- [GATE] Scale Verification (200k Words) ---"

# 1. 文件存在性检查
[ -f "$PERF_FILE" ] || (echo "FAILED: perf_stats.json missing"; exit 1)
[ -f "$REPORT_FILE" ] || (echo "FAILED: report missing"; exit 1)
[ -f "$VIDEO_FILE" ] || (echo "FAILED: scene.mp4 missing"; exit 1)

# 2. 性能指标断言 (Peak Efficiency)
DURATION=$(jq -r '.novel_scan_duration_ms' "$PERF_FILE")
RSS_DELTA=$(jq -r '.memory_delta_rss_mb' "$PERF_FILE" | cut -d. -f1)

echo "Scan Duration: ${DURATION}ms"
echo "RSS Delta: ${RSS_DELTA}MB"

if [ "$DURATION" -gt 5000 ]; then
    echo "FAILED: Scan took too long (> 5s)"
    exit 1
fi

if [ "$RSS_DELTA" -gt 100 ]; then
    echo "FAILED: Memory RSS delta too high (> 100MB)"
    exit 1
fi

# 3. 验收口径校验
VERDICT=$(jq -r '.verdict.status' "$REPORT_FILE")
REASON=$(jq -r '.reasons[0]' "$REPORT_FILE")

echo "Verdict: $VERDICT"
echo "Reason: $REASON"

if [ "$VERDICT" != "PASS" ]; then
    echo "FAILED: Verdict is not PASS"
    exit 1
fi

if [[ "$REASON" != *"Scale Verification"* ]]; then
    echo "FAILED: Reason does not mention Scale Verification"
    exit 1
fi

echo "--- [GATE] SCALE VERIFICATION PASS ---"
