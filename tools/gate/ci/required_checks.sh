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

# Cost Budget Enforcement (G3)
# Note: Inputs come from valid render plan execution in previous steps or implicit compilation.
# For CI context, we often need to ensure compilation happens first.
# Current flow: tools/gate/gates/gate-render-plan-p0.sh does compilation and outputs to evidence.
# We will use that evidence.
bash tools/gate/gates/gate-cost-budget.sh docs/_evidence/phase_f_commissioning_20260127_224500/E0001_full/cost_estimate.json docs/budgets/season_01_budget.json

# Frame Continuity Enforcement (8640 Frames)
bash tools/gate/gates/gate-frame-continuity.sh

# Real Engine Dry-Run (R1/R2 Determinism)
bash tools/gate/gates/gate-real-render-dryrun.sh
