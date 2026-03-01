#!/bin/bash
set -euo pipefail
echo "=== P25 3M DOUBLE PASS START ==="

# R1
echo "[R1] Executing First Pass..."
bash tools/ops/cleanup_p25_2_15m.sh --confirm
bash tools/gate/gates/gate-p25-1_full_novel_e2e_3m.sh
EVI_R1=$(ls -dt docs/_evidence/p25_1_full_3m_* | head -n 1)
mv "$EVI_R1" "docs/_evidence/p25_1_full_3m_R1"

# R2
echo "[R2] Executing Second Pass..."
bash tools/ops/cleanup_p25_2_15m.sh --confirm
bash tools/gate/gates/gate-p25-1_full_novel_e2e_3m.sh
EVI_R2=$(ls -dt docs/_evidence/p25_1_full_3m_* | head -n 1)
mv "$EVI_R2" "docs/_evidence/p25_1_full_3m_R2"

echo "=== P25 3M DOUBLE PASS COMPLETE ==="
