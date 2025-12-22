#!/bin/bash
set -e

# Project ID from previous session (Sim Project J)
PROJECT_ID="1af90dd0-1d08-40e2-b335-2f0ddf3a03c4"

echo "[SMOKE] Verifying Structure Tree for Project $PROJECT_ID..."
export NEXT_PUBLIC_API_URL="http://localhost:3000"

pnpm -w exec tsx tools/smoke/verify_structure_data.ts "$PROJECT_ID"
