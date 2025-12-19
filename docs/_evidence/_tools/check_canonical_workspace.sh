#!/usr/bin/env bash
set -euo pipefail

echo "== Canonical workspace check =="

# 1) must be inside git work tree
git rev-parse --is-inside-work-tree >/dev/null

# 2) must have tracked files
TRACKED_N=$(git ls-files | wc -l | tr -d ' ')
echo "[canonical] tracked_count=$TRACKED_N"
if [ "$TRACKED_N" -le 0 ]; then
  echo "FAIL: no tracked files (likely init/new workspace)"
  exit 1
fi

# 3) must not be 'all-untracked' state (heuristic)
# if ratio of '??' to tracked is extremely high, it is not canonical
UNTRACKED_N=$(git status --porcelain | awk '$1=="??"{c++} END{print c+0}')
echo "[canonical] untracked_count=$UNTRACKED_N"

# heuristic threshold: untracked > tracked * 2 => treat as invalid workspace for allowlist verification
THRESH=$((TRACKED_N * 2))
if [ "$UNTRACKED_N" -gt "$THRESH" ]; then
  echo "FAIL: workspace appears non-canonical (mass untracked files)"
  exit 1
fi

echo "PASS: canonical workspace preconditions satisfied"
