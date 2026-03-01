#!/bin/bash
set -euo pipefail

# R-0: Baseline & Evidence
TS=$(date +"%Y%m%d_%H%M%S")
EVI="docs/_evidence/real_pilot_sealed42_${TS}"
mkdir -p "$EVI/input"
echo "📂 Evidence: $EVI"

# Git State
git rev-parse HEAD > "$EVI/git_head.txt"
git status -sb > "$EVI/git_status.txt"

# R-1: Input Generation
# Manual fallback input generation to avoid 'find' hanging
echo "Generating multi-scene input..."
cat << EOF > "$EVI/input/pilot_text.txt"
【场景1】
The server hums in the darkness. A green light blinks, signaling the start of the real pilot.
Details emerge from the digital mist as the system wakes up.

【场景2】
The journey continues into the second phase.
Data flows through the pipeline, transforming into visual reality.
EOF

echo "✅ Input Generated:"
wc -l "$EVI/input/pilot_text.txt"

# R-2: Export Provider selection
echo "SHOT_RENDER_PROVIDER=local" > "$EVI/provider_selected.txt"
echo "✅ Provider Selected: local"
