# OPS E2E Runbook

## 1. Prerequisites

- **Node.js**: v18+
- **pnpm**: Latest
- **PostgreSQL**: Running on port 5433 (or configured via `DATABASE_URL`)
- **Redis**: Running (for BullMQ, if enabled)

## 2. Environment Setup

Ensure `.env` in root contains:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/scu?schema=public"
API_BASE_URL="http://localhost:3000/api"
WORKER_ID="e2e-worker"
WORKER_API_KEY="<generated_by_seed_if_needed>"
# Note: Smoke script seeds its own key, but worker needs one to register if it restarts.
# For local dev, loose auth might be on, or use the dev seed.
```

## 3. Starting Services

Open separate terminals:

1.  **Database**: `docker-compose up -d db redis` (if applicable) or ensure local services.
2.  **API**: `pnpm -C apps/api dev`
3.  **Worker**: `pnpm -C apps/workers dev` (Wait for "Worker Agent started successfully")

## 4. Running the Smoke Test

Execute the vertical slice verification:

```bash
./tools/smoke/run_e2e_vertical_slice.sh
```

### Expected Output

```
🚀 Starting E2E Vertical Slice Verification...
...
✅ Fail Fast Case Passed
...
✅ Happy Path Passed
🎉 E2E Verification Complete!
✅ Vertical Slice Verified.
```

## 5. Troubleshooting

- **DB Connection Fail**: Check `DATABASE_URL` matches `tools/smoke/e2e_verify.ts` config.
- **Worker Not Picking Up**: Check if `pnpm dev:worker` is running. Check Redis connection.
- **Auth Fail (401)**: The script seeds a key `e2e_sk_...`. If API rejects it, check if API is serving from the same DB as the script seeded.
