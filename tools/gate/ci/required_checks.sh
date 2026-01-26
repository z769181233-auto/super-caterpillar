#!/bin/bash
set -euo pipefail

# CI Required Checks Wrapper
# Currently requires L3 Seal Verification
bash tools/gate/gates/gate-orch-v2-audio-l3-manifest.sh
