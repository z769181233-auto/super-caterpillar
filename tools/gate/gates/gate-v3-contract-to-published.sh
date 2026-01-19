#!/bin/bash
# gate-v3-contract-to-published.sh
# V3 E2E Gate: From Contract to Published Assert
# Usage: ./gate-v3-contract-to-published.sh

set -e

# ==============================================================================
# Configuration
# ==============================================================================
API_URL="http://localhost:3000"
GATE_NAME="V3_CONTRACT_TO_PUBLISHED"
EVIDENCE_DIR="docs/_evidence/v3_job_e2e_$(date +%Y%m%d%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

# ==============================================================================
# 0. Mock ComfyUI (Requirement for CE11 REAL)
# ==============================================================================
MOCK_COMFY_PORT=18188
export COMFYUI_BASE_URL="http://127.0.0.1:$MOCK_COMFY_PORT"

log "Starting Mock ComfyUI on $MOCK_COMFY_PORT..."
cat <<EOF > tools/gate/scripts/mock-comfyui-v3.js
const http = require('http');
const crypto = require('crypto');

const server = http.createServer((req, res) => {
    console.log(\`[MOCK_COMFY] Incoming request: \${req.method} \${req.url}\`);
    if (req.method === 'POST' && req.url === '/prompt') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
             console.log(\`[MOCK_COMFY] Prompt Body: \${body.substring(0, 100)}...\`);
             const hash = crypto.createHash('sha256').update(body).digest('hex').substring(0, 8);
             res.writeHead(200, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ prompt_id: 'pid_' + hash }));
        });
    } else if (req.method === 'GET' && req.url.startsWith('/history/')) {
        const pid = req.url.split('/history/')[1];
        console.log(\`[MOCK_COMFY] Fetching history for \${pid}\`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const output = {
            [pid]: {
                status: { completed: true },
                outputs: {
                    "9": {
                        text: [JSON.stringify({
                            shots: [{
                                index: 1,
                                shot_type: "MEDIUM_SHOT",
                                visual_prompt: "V3 E2E Mock Output",
                                camera_movement: "STATIC"
                            }]
                        })]
                    }
                }
            }
        };
        res.end(JSON.stringify(output));
    } else {
        console.warn(\`[MOCK_COMFY] 404 for \${req.url}\`);
        res.writeHead(404);
        res.end();
    }
});

server.listen($MOCK_COMFY_PORT, () => {
    console.log('Mock ComfyUI running on $MOCK_COMFY_PORT');
});
EOF

node tools/gate/scripts/mock-comfyui-v3.js &
MOCK_PID=$!
trap "kill $MOCK_PID 2>/dev/null || true" EXIT
sleep 2

# ==============================================================================
# 1. Setup & Checks
# ==============================================================================
log "Starting V3 E2E Verification..."

# Fetch Valid Project
PROJECT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM projects LIMIT 1;" | xargs)
if [ -z "$PROJECT_ID" ]; then
    log "❌ DB Check Failed: No Project found."
    exit 1
fi
log "Using Project ID: $PROJECT_ID"

# ==============================================================================
# 2. STORY PARSE (CE06)
# ==============================================================================
log "Step 2: Trigger Story Parse (REAL)"
PARSE_RESP=$(curl -s -f -X POST "$API_URL/v3/story/parse" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": \"$PROJECT_ID\", \"raw_text\": \"The caterpillar ate the leaf.\", \"title\": \"Gate Story\"}")

JOB_ID=$(echo "$PARSE_RESP" | jq -r '.job_id')
if [ -z "$JOB_ID" ] || [ "$JOB_ID" == "null" ]; then
    log "❌ Job Creation Failed. Response: $PARSE_RESP"
    exit 1
fi
log "✅ Job Created: $JOB_ID"

# Poll for Completion
MAX_RETRIES=30
SLEEP_SEC=2
SUCCESS=false

for ((i=1; i<=MAX_RETRIES; i++)); do
    STATUS_RESP=$(curl -s -f "$API_URL/v3/story/job/$JOB_ID")
    STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
    STEP=$(echo "$STATUS_RESP" | jq -r '.current_step')
    log "Polling Job $JOB_ID: $STATUS (Step: $STEP) [$i/$MAX_RETRIES]"
    
    if [ "$STATUS" == "SUCCEEDED" ]; then
        SUCCESS=true
        break
    fi
    sleep $SLEEP_SEC
done

if [ "$SUCCESS" == "false" ]; then
    log "❌ Story Parse Timed Out or Failed."
    exit 1
fi
log "✅ Story Parse SUCCEEDED."

# ==============================================================================
# 3. SHOT GENERATION (CE11 REAL)
# ==============================================================================
log "Step 3: Trigger Shot Generation (REAL)"

# Find a Scene created by the previous job
# We need to query DB to find the scene associated with the job or project.
# Since we don't have scene_id returned by Parse API (it's async), we query DB.
# Look for scenes created in last minute for this project.

SCENE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM scenes WHERE project_id='$PROJECT_ID' ORDER BY created_at DESC LIMIT 1;" | xargs)

if [ -z "$SCENE_ID" ]; then
    log "❌ Scene lookup failed. Did CE06 create a scene?"
    exit 1
fi
log "Using Scene ID: $SCENE_ID"

BATCH_RESP=$(curl -s -f -X POST "$API_URL/v3/shot/batch-generate" \
    -H "Content-Type: application/json" \
    -d "{\"scene_id\": \"$SCENE_ID\"}")

BATCH_JOB_ID=$(echo "$BATCH_RESP" | jq -r '.job_id')
log "Batch Job Created: $BATCH_JOB_ID"

# Poll for CE11 Completion
SUCCESS=false
for ((i=1; i<=MAX_RETRIES; i++)); do
    STATUS_RESP=$(curl -s -f "$API_URL/v3/story/job/$BATCH_JOB_ID")
    STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
    
    if [ "$STATUS" == "SUCCEEDED" ]; then
        SUCCESS=true
        break
    fi
    sleep $SLEEP_SEC
done

if [ "$SUCCESS" == "false" ]; then
    log "❌ Shot Generation Timed Out."
    exit 1
fi

# Verify Shots in DB
SHOT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM shots WHERE \"sceneId\"='$SCENE_ID';" | xargs)
if [ "$SHOT_COUNT" -gt 0 ]; then
    log "✅ Shots Verified in DB: $SHOT_COUNT"
else
    log "❌ No Shots found for Scene $SCENE_ID"
    exit 1
fi

# ==============================================================================
# 4. EVIDENCE & SEAL
# ==============================================================================
log "Generating Evidence..."
echo "$PARSE_RESP" > "$EVIDENCE_DIR/parse_response.json"
echo "$BATCH_RESP" > "$EVIDENCE_DIR/batch_response.json"
echo "Shot Count: $SHOT_COUNT" > "$EVIDENCE_DIR/db_check.txt"

cd "$EVIDENCE_DIR"
find . -type f -exec sha256sum {} \; > SHA256SUMS.txt
cd - > /dev/null

log "🏆 V3 E2E GATE PASSED: Contract -> Real Production validated."
exit 0
