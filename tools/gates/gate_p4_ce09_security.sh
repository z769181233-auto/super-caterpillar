#!/bin/bash
# P4-1: CE09 Security Audit Gate
set -e

EVI_DIR=$1
if [ -z "$EVI_DIR" ]; then
    echo "Usage: $0 <evidence_dir>"
    exit 1
fi

echo "--- [GATE] P4 CE09 Security Audit ---"

# 1. 存在性检查
[ -f "$EVI_DIR/audit/framemd5.txt" ] || (echo "FAILED: Frame fingerprint missing"; exit 1)
[ -f "$EVI_DIR/audit/watermark_frame_1s.jpg" ] || (echo "FAILED: Watermark screenshot missing"; exit 1)

# 2. 水印 Metadata 检查
WM_VIDEO="$EVI_DIR/output/scene_8k_hevc_watermarked.mp4"
WM_TAG=$(ffprobe -v error -show_entries format_tags=comment -of default=noprint_wrappers=1:nokey=1 "$WM_VIDEO")

echo "Detected Watermark Tag: $WM_TAG"

if [[ "$WM_TAG" != *"SCU|P4|8K_HEVC|"* ]]; then
    echo "FAILED: Metadata Watermark mismatch or missing"
    exit 1
fi

# 3. 渲染指标延续性检查 (必须仍是 8K HEVC)
bash tools/gates/gate_p4_8k_hevc.sh "$WM_VIDEO"

echo "--- [GATE] CE09 SECURITY AUDIT PASS ---"
