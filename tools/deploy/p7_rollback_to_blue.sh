#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_p7_lib.sh"
need_env P7_ROLLBACK_TO_BLUE_CMD
run_cmd "P7-ROLLBACK-TO-BLUE" "$P7_ROLLBACK_TO_BLUE_CMD"
