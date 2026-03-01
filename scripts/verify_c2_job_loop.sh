#!/bin/bash
set -e

echo "======================================"
echo "    P9.2B Stage C2 Job Loop Script    "
echo "======================================"

npx tsx scripts/verify_c2_job_loop.ts | tee docs/_evidence/p9_2b/c2/verify_c2_job_loop.log

echo ""
echo "=== Script finished ==="
