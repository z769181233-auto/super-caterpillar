#!/bin/bash
# G5 Truly Compliant Production Orchestrator
# From Protocol to Pixels.

set -e

STAGED_DIR="docs/_evidence/g5_compliant_staged"
mkdir -p "$STAGED_DIR"

echo "=== G5 COMPLIANT PRODUCTION: STARTING E0001 ==="

# 1. Prepare Inputs
STORY_FILE="$STAGED_DIR/E0001.story.json"
RENDER_PLAN="$STAGED_DIR/E0001.render_plan.json"

cat > "$STORY_FILE" << 'EOF'
{
  "episode": "E0001",
  "title": "真正合规的逃离",
  "beats": [
    { "id": "beat-0", "speaker": "CH_XueZhiYing", "dialogue": "这是第一句合规的对白，带有起止缓冲。", "durationSec": 5 },
    { "id": "beat-1", "speaker": "UNKNOWN", "dialogue": "", "goal": "深林中的脚步声", "durationSec": 5 }
  ]
}
EOF

cat > "$RENDER_PLAN" << 'EOF'
{
  "episodeId": "E0001",
  "shots": [
    { "id": "shot_0000", "beatId": "beat-0", "characterId": "CH_XueZhiYing", "locationId": "LO_XueFuYuanZi", "action": "Standing", "durationFrames": 120 },
    { "id": "shot_0001", "beatId": "beat-1", "characterId": "CH_XiaoYunQi", "locationId": "LO_ShuFang", "action": "Idle", "durationFrames": 120 }
  ]
}
EOF

# 2. Invoke G5 Standalone Synthesizer
echo "[Step 1] Invoking G5 Standalone Synthesizer (Zero-Dependency)..."
node tools/g5/g5_synth.js "$STORY_FILE" "$RENDER_PLAN" "$STAGED_DIR"


# 3. Compliance Guard
echo "[Step 2] Running Compliance Guard..."
bash tools/g5/g5_compliance_guard.sh "$STAGED_DIR"

# 4. Final Render
echo "[Step 3] Rendering Pixels (Unreal V4.1)..."
node tools/renderer/unreal_executor.js "$RENDER_PLAN" "$STAGED_DIR/preview_g5_compliant.mp4" "$STAGED_DIR" "COMPLIANT_V4"

echo "=== G5 COMPLIANT PRODUCTION SUCCESS ==="
echo "Artifact: $STAGED_DIR/preview_g5_compliant.mp4"
