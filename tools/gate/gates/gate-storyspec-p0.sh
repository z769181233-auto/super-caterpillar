#!/bin/bash
IFS=$'
	'
set -e

# StorySpec P0 Gate
# Target: docs/story_bank/season_01/

EVI_DIR="docs/_evidence/story_gate_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVI_DIR"

echo "Running StorySpec P0 Gate..."
node tools/script_gates/story_lint.js docs/story_bank/season_01/ | tee "$EVI_DIR/story_lint_report.txt"

if [ $? -eq 0 ]; then
    echo "✅ STORY GATE PASS"
    exit 0
else
    echo "❌ STORY GATE FAIL"
    exit 1
fi
