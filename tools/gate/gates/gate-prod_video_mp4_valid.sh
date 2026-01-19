#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-prod_video_mp4_valid.sh
# 验证理由：封板必须确保导出的 MP4 是标准且可播放的。

API_URL=${API_URL:-"http://localhost:3000"}
TEST_PROJECT_ID=${TEST_PROJECT_ID:-"gate_project_video"}
EVIDENCE_SUBDIR=".gate_evidence/video_valid"
mkdir -p "${EVIDENCE_SUBDIR}"

echo "--- STEP 1: Trigger Timeline Preview/Video Export ---"
RESPONSE=$(curl -s -X POST "${API_URL}/api/timeline/preview" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"${TEST_PROJECT_ID}\"
  }")

JOB_ID=$(echo $RESPONSE | jq -r '.id')

if [ "$JOB_ID" == "null" ] || [ -z "$JOB_ID" ]; then
  echo "FAIL: Failed to trigger preview job. Response: $RESPONSE"
  exit 1
fi

echo "Job triggered: ${JOB_ID}. Waiting for completion..."

MAX_RETRIES=24
RETRY_COUNT=0
STATUS="PENDING"

while [ "$STATUS" != "SUCCEEDED" ] && [ "$STATUS" != "FAILED" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 5
  JOB_CHECK=$(curl -s "${API_URL}/api/job/${JOB_ID}")
  STATUS=$(echo $JOB_CHECK | jq -r '.status')
  echo "Current status: ${STATUS}..."
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$STATUS" != "SUCCEEDED" ]; then
  echo "FAIL: Job failed. Status: ${STATUS}"
  exit 1
fi

VIDEO_URI=$(echo $JOB_CHECK | jq -r '.result.videoUri')
echo "Video URI: ${VIDEO_URI}"

if [[ "${VIDEO_URI}" == mock://* ]]; then
  echo "FAIL: Video output URI is mock://."
  exit 1
fi

if [[ -z "${VIDEO_URI}" ]] || [[ "${VIDEO_URI}" == "null" ]]; then
   echo "FAIL: Video URI is empty."
   exit 1
fi

echo "--- STEP 2: Verify MP4 Validity & Export Metadata ---"
if [ ! -f "${VIDEO_URI}" ]; then
  echo "FAIL: Video file not found at ${VIDEO_URI}."
  exit 1
fi

# Export detailed ffprobe to JSON
ffprobe -v quiet -print_format json -show_format -show_streams "${VIDEO_URI}" > "${EVIDENCE_SUBDIR}/ffprobe.json"

DURATION=$(jq -r '.format.duration' "${EVIDENCE_SUBDIR}/ffprobe.json")
CODEC=$(jq -r '.streams[0].codec_name' "${EVIDENCE_SUBDIR}/ffprobe.json")

echo "Duration: ${DURATION}s"
echo "Codec: ${CODEC}"

# Use python for float comparison if bc is strict
if python3 -c "import sys; sys.exit(0 if float('${DURATION}') > 0 else 1)"; then
  echo "Duration check passed."
else
  echo "FAIL: Video duration is 0 or invalid."
  exit 1
fi

cp "${VIDEO_URI}" "${EVIDENCE_SUBDIR}/video_sample.mp4"
echo "PASS: gate-prod_video_mp4_valid.sh"
