#!/bin/bash
# gate_p5_unit_cost.sh: 断言单位成本模型严谨性
EVI_DIR=$1
COST_JSON="$EVI_DIR/unit_cost_audit.json"

echo "--- [GATE] P5-1 Unit Cost Assertion ---"

if [ ! -f "$COST_JSON" ]; then
    echo "ERROR: unit_cost_audit.json not found"
    exit 1
fi

# 断言 1: 基准环境参数齐全
ENV_CHECK=$(jq -r '.benchmark_env | keys | join(",")' "$COST_JSON")
if [[ ! "$ENV_CHECK" =~ "cpu" ]] || [[ ! "$ENV_CHECK" =~ "os" ]] || [[ ! "$ENV_CHECK" =~ "ffmpeg_ver" ]]; then
    echo "ASSERTION FAIL: Missing benchmark environment metadata"
    exit 2
fi

# 断言 2: 计算系数在安全阈值内 (<= 12.0x)
COMPUTE_RATIO=$(jq -r '.benchmark.compute_to_video_ratio' "$COST_JSON")
echo "Compute Ratio: ${COMPUTE_RATIO}x"
if (( $(echo "$COMPUTE_RATIO > 12.0" | bc -l) )); then
    echo "ASSERTION FAIL: Compute ratio exceeds threshold (12.0x)"
    exit 3
fi

# 断言 3: 存储密度在安全阈值内 (<= 5.0 MB/min)
STORAGE_DENSITY=$(jq -r '.storage.mb_per_minute' "$COST_JSON")
echo "Storage Density: ${STORAGE_DENSITY} MB/min"
if (( $(echo "$STORAGE_DENSITY > 5.0" | bc -l) )); then
    echo "ASSERTION FAIL: Storage density exceeds threshold (5.0 MB/min)"
    exit 3
fi

echo "--- [GATE] P5-1 UNIT COST PASS ---"
exit 0
