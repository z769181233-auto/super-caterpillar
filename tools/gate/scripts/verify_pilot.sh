#!/bin/bash
EVI=$(find docs/_evidence/prod_pilot_sealed42_* -maxdepth 0 -type d | sort -r | head -n 1)
echo "📂 EVI: $EVI"

echo ""
echo "=== A: Artifacts ==="
ls -lh "$EVI/artifacts/"
echo "Stats for final_video_black1s.mp4:"
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of default=nw=1 "$EVI/artifacts/final_video_black1s.mp4"

echo ""
echo "=== B: Source Scenes ==="
head -n 2 "$EVI/postprocess_black1s/scene_list.txt"
FIRST=$(head -n 1 "$EVI/postprocess_black1s/scene_list.txt")
echo "Check Scene: $FIRST"
ls -lh "$FIRST"
ffprobe -v error -show_entries format=duration -of default=nw=1 "$FIRST"

echo ""
echo "=== C: Concat Input ==="
cat "$EVI/postprocess_black1s/concat_inputs.txt"
