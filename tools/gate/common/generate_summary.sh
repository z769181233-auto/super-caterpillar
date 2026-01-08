#!/bin/bash
E2="docs/_evidence/stage3_ce06_billing_20260108_182239"
E1="docs/_evidence/stage3_ce06_billing_20260108_182221"

{
  echo "RUN2_DIR: $E2"
  cat "$E2/FINAL_REPORT.txt"
  echo "---"
  echo "RUN1_DIR: $E1"
  cat "$E1/FINAL_REPORT.txt"
} > "$E2/FINAL_2RUN_SUMMARY.txt"

cat "$E2/FINAL_2RUN_SUMMARY.txt"
echo "---- RUN 2 GATE LOG TAIL ----"
tail -n 60 "$E2/gate.log"
