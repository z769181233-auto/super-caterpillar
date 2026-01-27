#!/bin/bash
set -euo pipefail

# CI Required Checks Wrapper

# [G0] Anti-Bypass Discipline Enforcer
bash tools/gate/gates/gate-no-bypass-commit.sh

# Currently requires L3 Seal Verification
bash tools/gate/gates/gate-orch-v2-audio-l3-manifest.sh

# Baseline Compliance Enforcement
bash tools/gate/gates/gate-baseline-compliance.sh

# Sample SSOT Path Enforcement (Anti-Pollution)
bash tools/gate/gates/gate-sample-ssot-path.sh

# Asset Binding Integrity Scan
bash tools/gate/gates/gate-asset-binding-resolve.sh

# RenderPlan P0 Industrial Audit (Drift/HitRate)
bash tools/gate/gates/gate-render-plan-p0.sh

# Frame Continuity Enforcement (8640 Frames)
bash tools/gate/gates/gate-frame-continuity.sh

# Real Engine Dry-Run (R1/R2 Determinism)
bash tools/gate/gates/gate-real-render-dryrun.sh
