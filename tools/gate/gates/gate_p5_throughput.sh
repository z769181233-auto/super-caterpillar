#!/bin/bash
# gate_p5_throughput.sh: 断言并发吞吐能力
EVI_DIR=$1
PERF_JSON="$EVI_DIR/concurrency_perf.json"

echo "--- [GATE] P5-0 Throughput Assertion ---"

if [ ! -f "$PERF_JSON" ]; then
    echo "ERROR: concurrency_perf.json not found"
    exit 1
fi

SUCCESS_COUNT=$(jq '.results | map(select(.success == true)) | length' "$PERF_JSON")
CONCURRENCY=$(jq '.concurrency' "$PERF_JSON")
TOTAL_COUNT=$(jq '.results | length' "$PERF_JSON")

echo "Concurrency: $CONCURRENCY"
echo "Success Count: $SUCCESS_COUNT / $TOTAL_COUNT"

# 断言 1: 成功率 100%
if [ "$SUCCESS_COUNT" -ne "$CONCURRENCY" ]; then
    echo "ASSERTION FAIL: Success rate is not 100%"
    exit 2
fi

# 断言 2: 任务无失败记录
FAIL_COUNT=$(jq '.results | map(select(.success == false)) | length' "$PERF_JSON")
if [ "$FAIL_COUNT" -ne 0 ]; then
    echo "ASSERTION FAIL: Found $FAIL_COUNT job failures"
    exit 2
fi

echo "--- [GATE] P5-0 THROUGHPUT PASS ---"
exit 0
