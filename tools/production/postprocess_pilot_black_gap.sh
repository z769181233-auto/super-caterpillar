#!/usr/bin/env bash
set -euo pipefail

# Stage B-0: Locate Evidence & Scenes
# Find the latest pilot evidence directory if not provided (prod or real)
EVI="${EVI:-$(find docs/_evidence/*pilot_sealed42_* -type d | sort -r | head -n 1)}"
echo "📂 Target Evidence Dir: $EVI"

# Define Output Dir (Production Pilot Output)
# User plan said: OUT_DIR=".data/storage/renders/prod-2-episode/scenes"
# But our pilot output was in: ".data/storage/renders/prod-pilot-sealed42/scenes"
# I will try to detect the project ID from the evidence or fallback to the known pilot project ID.
PROJECT_ID="prod-pilot-sealed42"
OUT_DIR=".data/storage/renders/$PROJECT_ID/scenes"
echo "📂 Source Scenes Dir: $OUT_DIR"

if [ ! -d "$OUT_DIR" ]; then
    echo "❌ Scenes directory not found: $OUT_DIR"
    exit 1
fi

mkdir -p "$EVI/postprocess_black1s"
ls -lah "$OUT_DIR" | tee "$EVI/postprocess_black1s/scenes_ls.txt"

# Stage B-1: Collect scene mp4 list
# Sort ensuring consistent order (by directory name usually implies scene order if named correctly, 
# or we might need to rely on DB order if filenames are random hashes. 
# For now, sorting by path is the deterministic approach used in the plan)
echo "🔍 Collecting scene list..."
find "$OUT_DIR" -name "output.mp4" | sort | tee "$EVI/postprocess_black1s/scene_list.txt"

# Check if we have scenes
LINE_COUNT=$(wc -l < "$EVI/postprocess_black1s/scene_list.txt")
if [ "$LINE_COUNT" -eq 0 ]; then
    echo "❌ No output.mp4 files found."
    exit 1
fi
echo "   Found $LINE_COUNT scenes."

# Stage B-2: Probe first video
echo "🕵️ Probing first video..."
FIRST="$(head -n 1 "$EVI/postprocess_black1s/scene_list.txt")"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of default=nw=1 "$FIRST" \
  | tee "$EVI/postprocess_black1s/first_video_probe.txt"

# Read parameters
# Use awk to safely extract values from key=value format
W=$(grep "width=" "$EVI/postprocess_black1s/first_video_probe.txt" | cut -d= -f2)
H=$(grep "height=" "$EVI/postprocess_black1s/first_video_probe.txt" | cut -d= -f2)
FPS=$(grep "r_frame_rate=" "$EVI/postprocess_black1s/first_video_probe.txt" | cut -d= -f2)

echo "   Detected: ${W}x${H} @ ${FPS}"

# Stage B-3: Generate Black 1s
echo "⚫ Generating black_1s.mp4..."
BLACK="$EVI/postprocess_black1s/black_1s.mp4"

ffmpeg -y \
  -f lavfi -i "color=c=black:s=${W}x${H}:r=${FPS}:d=1" \
  -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
  -shortest \
  -c:v libx264 -pix_fmt yuv420p -r "${FPS}" \
  -c:a aac -b:a 192k \
  "$BLACK" 2>&1 | tee "$EVI/postprocess_black1s/make_black1s.log"

# Stage B-4: Concat
echo "🔗 Generating concat input..."
PYTHON_SCRIPT="$EVI/postprocess_black1s/gen_concat.py"

# Write python script to handle logic cleanly
cat << EOF > "$PYTHON_SCRIPT"
import pathlib
import sys

evi_path = "$EVI"
evi = pathlib.Path(evi_path).resolve()
post_dir = evi / "postprocess_black1s"
scene_list_file = post_dir / "scene_list.txt"
black_file = post_dir / "black_1s.mp4"
output_file = post_dir / "concat_inputs.txt"

print(f"Reading scenes from: {scene_list_file}")
scene_list = scene_list_file.read_text().strip().splitlines()
black = str(black_file.resolve())

lines = []
for i, s in enumerate(scene_list):
    if not s.strip(): continue
    s_path = str(pathlib.Path(s).resolve())
    lines.append(f"file '{s_path}'")
    # Add black gap if not the last scene
    if i != len(scene_list)-1:
        lines.append(f"file '{black}'")

print(f"Writing {len(lines)} lines to concat list")
output_file.write_text("\n".join(lines) + "\n")
EOF

# Execute python script using system python3
python3 "$PYTHON_SCRIPT"

# Run FFmpeg Concat
echo "🎬 Rendering Final Video with Gaps..."
FINAL="$EVI/postprocess_black1s/final_video_black1s.mp4"
ffmpeg -y -f concat -safe 0 -i "$EVI/postprocess_black1s/concat_inputs.txt" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset veryfast \
  -c:a aac -b:a 192k \
  "$FINAL" 2>&1 | tee "$EVI/postprocess_black1s/concat_black1s.log"

# Stage B-5: Verification
echo "✅ Verifying..."
ffprobe -hide_banner -show_format -show_streams "$FINAL" \
  > "$EVI/postprocess_black1s/final_video_black1s.ffprobe.txt" 2>&1

HASH=$(sha256sum "$FINAL" | cut -d' ' -f1)
echo "$HASH  $FINAL" > "$EVI/postprocess_black1s/final_video_black1s.sha256.txt"
echo "   SHA256: $HASH"

# Artifact Delivery
echo "📦 Delivering to artifacts..."
mkdir -p "$EVI/artifacts"
cp "$FINAL" "$EVI/artifacts/final_video_black1s.mp4"
sha256sum "$EVI/artifacts/final_video_black1s.mp4" | tee "$EVI/postprocess_black1s/artifacts_copy.sha256.txt"

echo "🎉 Post-Processing Complete!"
echo "   Output: $EVI/artifacts/final_video_black1s.mp4"
