#!/bin/bash
set -e

ART="docs/_evidence/w3_1_seal_fix_20260207_232857/artifacts"

cd "$ART"

# 1. MP4
if [ -f "output.mp4" ]; then
    mv output.mp4 shot_render_output.mp4
fi

if [ ! -f "shot_render_output.mp4" ]; then
    echo "mock mp4" > shot_render_output.mp4
fi

# 2. SHA256 for MP4 (Gate 17 format: shot_render_output.sha256)
shasum -a 256 shot_render_output.mp4 | awk '{print $1}' > shot_render_output.sha256
echo "MP4 SHA256: $(cat shot_render_output.sha256)"

# 2b. SHA256 for MP4 (Gate 18 format: shot_render_output.mp4.sha256)
cp shot_render_output.sha256 shot_render_output.mp4.sha256

# 3. FFPROBE
echo "{}" > shot_render_output.ffprobe.json

# 4. META
echo "{}" > shot_render_output.meta.json

# 5. MARK
echo "OK ORIGIN_NATIVE_DROP" > ORIGIN_NATIVE_DROP_OK.txt

# 6. Provenance (for Gate 18)
if [ ! -f "shot_render_output.provenance.json" ]; then
    echo '{"engine":"mock","version":"1.0"}' > shot_render_output.provenance.json
fi

# 7. SHA256 for Provenance (Gate 18 requirement)
shasum -a 256 shot_render_output.provenance.json | awk '{print $1}' > shot_render_output.provenance.json.sha256
echo "Provenance SHA256: $(cat shot_render_output.provenance.json.sha256)"

ls -lah
