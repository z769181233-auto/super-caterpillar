#!/bin/bash
set -e

# R-0: Baseline & Evidence
TS=$(date +"%Y%m%d_%H%M%S")
EVI="docs/_evidence/real_pilot_sealed42_${TS}"
mkdir -p "$EVI/input"
echo "📂 Evidence: $EVI"

# Git State
git rev-parse HEAD | tee "$EVI/git_head.txt"
git status -sb | tee "$EVI/git_status.txt"

# R-1: Input Generation
SPEC="docs/_specs"
# Find largest file
CAND=$(find "$SPEC" -type f \( -name "*.txt" -o -name "*.md" -o -name "*.json" \) -print0 | xargs -0 ls -S | head -n 1)

if [ -z "$CAND" ]; then
    echo "❌ No spec files found. Defaulting to fallback text."
    echo -e "Scene 1: The real world.\nDetails emerge from the mist.\n\nScene 2: The journey continues.\nA path reveals itself." > "$EVI/input/pilot_text.txt"
else
    echo "📜 Source Spec: $CAND"
    cp "$CAND" "$EVI/input/source_file_copy"
    
    # Extract 200 lines
    head -n 200 "$CAND" > "$EVI/input/raw_excerpt.txt"
    
    # Construct Mult-Scene Input
    echo "【场景1】" > "$EVI/input/pilot_text.txt"
    cat "$EVI/input/raw_excerpt.txt" >> "$EVI/input/pilot_text.txt"
    echo -e "\n\n【场景2】\nTo be continued..." >> "$EVI/input/pilot_text.txt"
fi

echo "Input Stats:"
wc -l "$EVI/input/pilot_text.txt"

# R-2: Export Provider selection to evidence
echo "SHOT_RENDER_PROVIDER=local" | tee "$EVI/provider_selected.txt"
