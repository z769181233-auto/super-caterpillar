#!/bin/bash
set -u

LOG_FILE="e2e_signoff.log"
: > "$LOG_FILE"

echo "🚀 Starting 3x E2E Sign-off Cycle..." | tee -a "$LOG_FILE"

for i in {1..3}; do
  echo "" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  echo "🏃 Run #$i: $(date)" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  # Run and capture output (preserving exit code)
  bash tools/smoke/run_e2e_vertical_slice.sh >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Run #$i FAILED with exit code $EXIT_CODE" | tee -a "$LOG_FILE"
    echo "⛔️ Sign-off Cycle Aborted." | tee -a "$LOG_FILE"
    exit 1
  else
    echo "✅ Run #$i PASSED" | tee -a "$LOG_FILE"
  fi
  
  # Optional: Sleep to ensure port cleanup
  sleep 5
done

echo "" | tee -a "$LOG_FILE"
echo "🎉 Sign-off Cycle Complete: 3/3 Passed." | tee -a "$LOG_FILE"
