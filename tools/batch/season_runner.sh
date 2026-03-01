#!/bin/bash
set -e
# Wrapper for Season Batch Runner (Node.js)
# Usage: ./season_runner.sh <season_dir> [output_dir]

SEASON_DIR=${1:-"docs/story_bank/season_01/produced"}
TS=$(date +%Y%m%d_%H%M%S)
EVI_DIR=${2:-"docs/_evidence/phase_g_batch_$TS"}

echo "=== Launching Batch Runner ==="
echo "Node: tools/batch/season_runner.js"
echo "Season: $SEASON_DIR"
echo "Evidence: $EVI_DIR"

node tools/batch/season_runner.js "$SEASON_DIR" "$EVI_DIR"
