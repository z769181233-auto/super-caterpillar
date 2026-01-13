#!/bin/bash
set -euo pipefail

echo "========================================================"
echo "   COMMERCIAL HARD SEAL GATE (PHASE 3)"
echo "   Enforcing: Assets + Audit + Metrics + Orchestration"
echo "========================================================"

./tools/gate/gates/gate-phase3-commercial-e2e.sh

echo "✅ COMMERCIAL SEAL VERIFIED"
