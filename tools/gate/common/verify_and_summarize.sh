#!/bin/bash
E2=$(ls -dt docs/_evidence/stage3_ce06_billing_* | head -1)
E1=$(ls -dt docs/_evidence/stage3_ce06_billing_* | head -2 | tail -1)

echo "Generating summary from:"
echo "RUN2: $E2"
echo "RUN1: $E1"

{
  echo "RUN2_DIR: $E2"
  cat "$E2/FINAL_REPORT.txt" || echo "RUN2 REPORT MISSING"
  echo "---"
  echo "RUN1_DIR: $E1"
  cat "$E1/FINAL_REPORT.txt" || echo "RUN1 REPORT MISSING"
} > "$E2/FINAL_2RUN_SUMMARY.txt"

echo "Summary saved to $E2/FINAL_2RUN_SUMMARY.txt"
cat "$E2/FINAL_2RUN_SUMMARY.txt"
