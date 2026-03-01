#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_p7_lib.sh"
need_env P7_CUTOVER_TO_GREEN_CMD
run_cmd "P7-CUTOVER-TO-GREEN" "$P7_CUTOVER_TO_GREEN_CMD"
