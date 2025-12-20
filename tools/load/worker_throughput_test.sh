#!/bin/bash

# Worker 吞吐量测试脚本（真实端点版本）
# 使用 POST /api/shots/:shotId/jobs 创建真实 jobs

set -e

# 配置
API_URL="${API_URL:-http://localhost:3000}"
JOB_COUNT="${JOB_COUNT:-50}"
CONCURRENT="${CONCURRENT:-5}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
SHOT_ID="${SHOT_ID:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Worker Throughput Test (Real Endpoint)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL:      $API_URL"
echo "Shot ID:      ${SHOT_ID:-<required>}"
echo "Job Count:    $JOB_COUNT"
echo "Concurrent:   $CONCURRENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查必需参数
if [ -z "$SHOT_ID" ]; then
    echo -e "${RED}❌ Error: SHOT_ID is required${NC}"
    echo "Usage: SHOT_ID=<shot-id> AUTH_TOKEN=<token> ./tools/load/worker_throughput_test.sh"
    exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Error: AUTH_TOKEN is required${NC}"
    echo "Usage: SHOT_ID=<shot-id> AUTH_TOKEN=<token> ./tools/load/worker_throughput_test.sh"
    exit 1
fi

# 检查 API 是否可用
echo "Checking API availability..."
if ! curl -s -f "${API_URL}/api/health" > /dev/null; then
    echo -e "${RED}❌ API is not available at ${API_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ API is available${NC}"
echo ""

# 使用临时文件锁避免并发计数错误
LOCK_FILE=$(mktemp)
COUNTER_FILE=$(mktemp)
echo 0 > "$COUNTER_FILE"
SUCCESS_FILE=$(mktemp)
echo 0 > "$SUCCESS_FILE"
FAILED_FILE=$(mktemp)
echo 0 > "$FAILED_FILE"
JOB_IDS_FILE=$(mktemp)

# 清理函数
cleanup() {
    rm -f "$LOCK_FILE" "$COUNTER_FILE" "$SUCCESS_FILE" "$FAILED_FILE" "$JOB_IDS_FILE"
}
trap cleanup EXIT

# 原子递增计数器
increment_counter() {
    local file=$1
    (
        flock -x 200
        local value=$(cat "$file")
        echo $((value + 1)) > "$file"
    ) 200>"$LOCK_FILE"
}

# 创建 job 的函数（使用真实 API）
create_job() {
    local job_num=$1
    local response
    local http_code
    local body
    
    # 使用真实的 API 端点
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{\"type\":\"VIDEO_RENDER\",\"payload\":{\"test\":true,\"jobNum\":$job_num,\"timestamp\":$(date +%s)}}" \
        "${API_URL}/api/shots/${SHOT_ID}/jobs" 2>/dev/null || echo -e "\n000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        # 提取 job ID
        local job_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || \
                       echo "$body" | grep -o '"data"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"' || echo "")
        
        if [ -n "$job_id" ]; then
            echo "$job_id" >> "$JOB_IDS_FILE"
            increment_counter "$SUCCESS_FILE"
            echo -e "${GREEN}✅ Job $job_num created: $job_id${NC}"
            return 0
        else
            increment_counter "$SUCCESS_FILE"
            echo -e "${YELLOW}⚠️  Job $job_num created but no ID returned${NC}"
            return 0
        fi
    elif [ "$http_code" -eq 429 ]; then
        # 容量超限
        increment_counter "$FAILED_FILE"
        echo -e "${YELLOW}⚠️  Job $job_num capacity exceeded (429)${NC}"
        return 1
    else
        increment_counter "$FAILED_FILE"
        echo -e "${RED}❌ Job $job_num failed: HTTP $http_code${NC}"
        return 1
    fi
}

# 并发创建 jobs（使用串行统计）
echo "Creating $JOB_COUNT jobs (concurrent: $CONCURRENT)..."
START_TIME=$(date +%s)

# 使用后台任务和 wait 控制并发
for ((i=1; i<=JOB_COUNT; i++)); do
    # 等待直到有可用槽位
    while [ $(jobs -r | wc -l) -ge $CONCURRENT ]; do
        sleep 0.1
    done
    
    # 启动后台任务
    (
        create_job $i
        increment_counter "$COUNTER_FILE"
    ) &
done

# 等待所有任务完成
wait

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 读取统计结果
SUCCESS_COUNT=$(cat "$SUCCESS_FILE")
FAILED_COUNT=$(cat "$FAILED_FILE")
TOTAL_CREATED=$((SUCCESS_COUNT + FAILED_COUNT))

# 等待一段时间让 jobs 处理
echo ""
echo "Waiting 10 seconds for jobs to be processed..."
sleep 10

# 检查 job 状态（读取 job IDs）
if [ -f "$JOB_IDS_FILE" ] && [ -s "$JOB_IDS_FILE" ]; then
    echo ""
    echo "Checking job statuses..."
    PROCESSED_COUNT=0
    SUCCEEDED_COUNT=0
    FAILED_JOBS=0
    PENDING_COUNT=0
    
    while IFS= read -r job_id; do
        if [ -z "$job_id" ]; then
            continue
        fi
        
        status=$(curl -s \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "${API_URL}/api/jobs/${job_id}" 2>/dev/null | \
            grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "UNKNOWN")
        
        case "$status" in
            "SUCCEEDED")
                ((SUCCEEDED_COUNT++))
                ((PROCESSED_COUNT++))
                ;;
            "FAILED")
                ((FAILED_JOBS++))
                ((PROCESSED_COUNT++))
                ;;
            "PENDING"|"DISPATCHED"|"RUNNING")
                ((PENDING_COUNT++))
                ;;
        esac
    done < "$JOB_IDS_FILE"
else
    PROCESSED_COUNT=0
    SUCCEEDED_COUNT=0
    FAILED_JOBS=0
    PENDING_COUNT=0
fi

# 输出结果
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📊 Test Results:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Jobs Created:    $TOTAL_CREATED"
echo "Creation Successful:   $SUCCESS_COUNT"
echo "Creation Failed:       $FAILED_COUNT"
echo "Duration:              ${DURATION}s"
if [ $DURATION -gt 0 ]; then
    echo "Creation Rate:         $(echo "scale=2; $TOTAL_CREATED / $DURATION" | bc) jobs/sec"
fi
echo ""
echo "Job Status:"
echo "  Succeeded:           $SUCCEEDED_COUNT"
echo "  Failed:              $FAILED_JOBS"
echo "  Pending/Running:      $PENDING_COUNT"
echo "  Processed:           $PROCESSED_COUNT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 计算成功率
if [ $TOTAL_CREATED -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_CREATED" | bc)
    echo -e "Creation Success Rate: ${GREEN}${SUCCESS_RATE}%${NC}"
    
    if [ $PROCESSED_COUNT -gt 0 ]; then
        PROCESSING_SUCCESS_RATE=$(echo "scale=2; $SUCCEEDED_COUNT * 100 / $PROCESSED_COUNT" | bc)
        echo -e "Processing Success Rate: ${GREEN}${PROCESSING_SUCCESS_RATE}%${NC}"
    fi
else
    echo -e "${RED}No jobs were created${NC}"
    exit 1
fi

echo ""

# 判断测试是否通过
if [ $FAILED_COUNT -gt $((TOTAL_CREATED / 10)) ]; then
    echo -e "${RED}❌ Test failed: Too many creation failures (${FAILED_COUNT}/${TOTAL_CREATED})${NC}"
    exit 1
elif [ $SUCCESS_COUNT -lt $((TOTAL_CREATED / 2)) ]; then
    echo -e "${YELLOW}⚠️  Warning: Low creation success rate${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Test passed${NC}"
    exit 0
fi
