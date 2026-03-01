#!/usr/bin/env bash
set -euo pipefail
umask 022

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
EVI="$ROOT/docs/_evidence/w3_1_origin_native_drop_${TS}"
mkdir -p "$EVI/artifacts"

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export GATE_ENV_MODE="${GATE_ENV_MODE:-local}"
export ENGINE_REAL=1
export ARTIFACT_DIR="$EVI/artifacts"

echo "EVI=$EVI"
echo "ARTIFACT_DIR=$ARTIFACT_DIR"
echo "ENGINE_REAL=$ENGINE_REAL"
echo "GATE_ENV_MODE=$GATE_ENV_MODE"
echo "DATABASE_URL=$DATABASE_URL" > "$EVI/env_snapshot.txt"
env | grep -E '^(ENGINE_REAL|ARTIFACT_DIR|GATE_ENV_MODE|API_URL|NGINX_URL|DATABASE_URL)=' >> "$EVI/env_snapshot.txt" || true

# 运行全量 gates（输出实时落盘）
bash tools/gate/run_launch_gates.sh 2>&1 | tee "$EVI/run_launch_gates.log" || true

# 抓最新 run_launch_gates evidence（包含 Gate17 contract log + report）
LATEST_GATES="$(ls -td "$ROOT/docs/_evidence/run_launch_gates_"* 2>/dev/null | head -n 1 || true)"
echo "LATEST_GATES=$LATEST_GATES" | tee "$EVI/latest_run_launch_gates_dir.txt"

if [ -n "$LATEST_GATES" ]; then
  cp -f "$LATEST_GATES/GATEKEEPER_VERIFICATION_REPORT.md" "$EVI/" 2>/dev/null || true
  cp -f "$LATEST_GATES/gate17_origin_native_drop_contract.log" "$EVI/" 2>/dev/null || true
  cp -R "$LATEST_GATES/gate17_engine_sanity" "$EVI/" 2>/dev/null || true
fi

# 再补一次"独立契约复检"（确保 w3_1 evidence 目录内也有契约日志）
ARTIFACT_DIR="$ARTIFACT_DIR" bash tools/gate/gates/gate_origin_native_drop_contract.sh \
  > "$EVI/contract_direct_recheck.log" 2>&1 || true

# 产物与 sha 对齐快检（硬证据）
ls -al "$ARTIFACT_DIR" | tee "$EVI/artifacts_ls.txt" || true
if [ -s "$ARTIFACT_DIR/shot_render_output.mp4" ] && [ -s "$ARTIFACT_DIR/shot_render_output.mp4.sha256" ]; then
  (cd "$ARTIFACT_DIR" && shasum -a 256 shot_render_output.mp4 | tee "$EVI/shasum_mp4.txt") || true
fi
if [ -s "$ARTIFACT_DIR/shot_render_output.provenance.json" ] && [ -s "$ARTIFACT_DIR/shot_render_output.provenance.json.sha256" ]; then
  (cd "$ARTIFACT_DIR" && shasum -a 256 shot_render_output.provenance.json | tee "$EVI/shasum_prov.txt") || true
fi

echo "DONE. Evidence: $EVI"
