#!/bin/bash
set -e

# G4-QA: Visual Evidence Generator
# Usage: ./tools/gate/manual/generate_visual_sheets.sh <mp4_path> <shots_json> <output_dir>

MP4="$1"
SHOTS_JSON="$2"
OUT_DIR="$3"

if [ -z "$MP4" ] || [ -z "$OUT_DIR" ]; then
    echo "Usage: $0 <mp4_path> <shots_json> <output_dir>"
    exit 1
fi

mkdir -p "$OUT_DIR/frames"
mkdir -p "$OUT_DIR/shot_frames"

echo "=== Generating Visual Sheets for G4-QA ==="

# 1) Contact Sheet (5s sampling)
echo "抽样全片 (5s/frame)..."
ffmpeg -y -i "$MP4" -vf "fps=1/5,scale=320:180,tile=10x10" -frames:v 1 "$OUT_DIR/contact_sheet.png"

# 2) Shot First-Frame Sheet
# We'll use a small node script to generate the ffmpeg command for shot extractions
echo "抽样镜头首帧 (194 shots)..."
node -e "
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('$SHOTS_JSON', 'utf8'));
const shots = plan.renderShots || plan.shots || [];
const frames = shots.map(s => s.startFrame || 0);
const outDir = '$OUT_DIR/shot_frames';
frames.forEach((f, i) => {
    const ts = f / 24;
    const cmd = \`ffmpeg -y -ss \${ts} -i \"$MP4\" -frames:v 1 -vf \"scale=480:270\" \${outDir}/shot_\${i.toString().padStart(3, '0')}.jpg 2>/dev/null\`;
    require('child_process').execSync(cmd);
});
"

# Combine shot frames into a grid (using ffmpeg tile filter on a combined list)
# Limit to first 100 shots for the grid to keep it readable
ls "$OUT_DIR/shot_frames"/*.jpg | head -n 100 > "$OUT_DIR/shot_list.txt"
ffmpeg -y -pattern_type glob -i "$OUT_DIR/shot_frames/shot_*.jpg" -filter_complex "tile=10x10:padding=10:color=white" -frames:v 1 "$OUT_DIR/shot_firstframes_sheet.png"

echo "✅ Visual Sheets Ready in $OUT_DIR"
